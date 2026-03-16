import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import {
  RUN_INTEGRITY_ANALYSIS_TOOL,
  SYSTEM_INSTRUCTION,
  InspectionRecord,
  Asset,
} from '../constants';
import { SAMPLE_RATE, OUTPUT_SAMPLE_RATE, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/audio';

export interface ActivityLogEntry {
  id: string;
  ts: number;
  type: 'agent1' | 'agent2' | 'tool' | 'system';
  message: string;
  detail?: string | Record<string, unknown>;
}

function pushLog(
  setLog: Dispatch<SetStateAction<ActivityLogEntry[]>>,
  type: ActivityLogEntry['type'],
  message: string,
  detail?: ActivityLogEntry['detail']
) {
  setLog((prev) => [
    ...prev,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      type,
      message,
      detail,
    },
  ]);
}

export function useLiveSession() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [lastAlert, setLastAlert] = useState<InspectionRecord | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [agentStatus, setAgentStatus] = useState({
    agent1: "Idle",
    agent2: "Idle",
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const speakingLoggedRef = useRef(false);

  const selectedAsset = assets.find(a => a.asset_id === selectedAssetId);

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then((data: Asset[]) => {
        setAssets(data);
        if (data.length > 0) setSelectedAssetId(data[0].asset_id);
      })
      .catch(err => console.error("Failed to fetch assets:", err));
  }, []);

  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const playQueuedAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768;
    }
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) {
        playQueuedAudio();
      } else {
        setAgentStatus(prev => (prev.agent1 === 'Speaking...' ? { ...prev, agent1: 'Listening...' } : prev));
      }
    };
    source.start();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      const audioContext = audioContextRef.current!;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        sessionRef.current.sendRealtimeInput({
          media: {
            data: arrayBufferToBase64(pcmData.buffer),
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      };
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startSession = useCallback(async () => {
    if (!selectedAsset) return;
    try {
      setActivityLog([]);
      pushLog(setActivityLog, 'system', 'Starting session…');
      await initAudio();
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCURRENT CONTEXT:\nAsset ID: ${selectedAsset.asset_id}\nAsset Name: ${selectedAsset.name}\nComponent: ${selectedAsset.component_type}\nService Fluid: ${selectedAsset.service_fluid}\nLocation: ${selectedAsset.location}\nMaterial: ${selectedAsset.material}\nDesign Pressure: ${selectedAsset.design_pressure_bar} bar\nLast Inspection: ${selectedAsset.last_inspection}`,
          tools: [{ functionDeclarations: [RUN_INTEGRITY_ANALYSIS_TOOL] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          }
        },
        callbacks: {
          onopen: () => {
            speakingLoggedRef.current = false;
            setIsConnected(true);
            setAgentStatus(prev => ({ ...prev, agent1: "Listening..." }));
            pushLog(setActivityLog, 'agent1', 'Session open — listening for voice');
            startRecording();
          },
          onmessage: async (message: any) => {
            try {
            // Detect tool call in any form — session closes if we don't respond. Log to debug.
            const hasToolCall = 'toolCall' in message || 'tool_call' in message;
            if (hasToolCall) {
              const payload = message.toolCall ?? message.tool_call;
              const calls = payload?.functionCalls ?? payload?.function_calls;
              const count = Array.isArray(calls) ? calls.length : 0;
              pushLog(setActivityLog, 'system', `Tool call message received (${count} call(s)) — sending response to keep session open`);
            }

            const toolCallPayload = message.toolCall ?? message.tool_call;
            let topLevelCalls: any[] = [];
            if (toolCallPayload) {
              const raw = toolCallPayload.functionCalls ?? toolCallPayload.function_calls;
              if (Array.isArray(raw)) {
                topLevelCalls = raw;
              } else if (raw && typeof raw === 'object') {
                topLevelCalls = [raw];
              } else if (Array.isArray(toolCallPayload)) {
                topLevelCalls = toolCallPayload;
              }
            }
            const parts = message.serverContent?.modelTurn?.parts ?? message.server_content?.model_turn?.parts ?? [];
            const hasAudio = parts.some((p: any) => p?.inlineData);

            const processRunIntegrityAnalysis = async (call: { id?: string; name?: string; args?: Record<string, unknown>; arguments?: Record<string, unknown> }) => {
              const args = (call.args ?? call.arguments ?? {}) as Record<string, unknown>;
              const callId = call.id ?? (call as any).id;
              const callName = call.name ?? (call as any).name;

              const sendErrorResponse = (errMessage: string) => {
                pushLog(setActivityLog, 'system', errMessage);
                try {
                  session.sendToolResponse({
                    functionResponses: [{
                      id: callId,
                      name: callName || 'run_integrity_analysis',
                      response: { error: errMessage, category: "Normal" },
                    }]
                  });
                } catch (e) {
                  console.error('Failed to send tool error response:', e);
                }
              };

              if (!selectedAsset) {
                sendErrorResponse('No asset selected. Please select an asset and try again.');
                return;
              }
              pushLog(setActivityLog, 'tool', 'Tool call: run_integrity_analysis', {
                avg_thickness: args.avg_thickness,
                min_thickness: args.min_thickness,
                max_pit_depth: args.max_pit_depth,
                coating_grade: args.coating_grade,
                has_cracks: args.has_cracks,
                location: args.location,
              });
              setAgentStatus(prev => ({
                ...prev,
                agent1: "Waiting for Analysis...",
                agent2: "Starting Analysis...",
              }));
              pushLog(setActivityLog, 'agent2', 'Starting analysis');
              try {
                if (!args.service_fluid && selectedAsset) {
                  args.service_fluid = selectedAsset.service_fluid;
                }
                setAgentStatus(prev => ({ ...prev, agent2: "Calculating & Searching Standards..." }));
                pushLog(setActivityLog, 'agent2', 'Running analysis (standards + calculations)');
                const response = await fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(args),
                });
                if (!response.ok) throw new Error(`Backend error: ${response.status}`);
                const verdict = await response.json();
                pushLog(setActivityLog, 'agent2', 'Verdict received');
                const record: InspectionRecord = {
                  id: verdict.id || Math.random().toString(36).substr(2, 9),
                  timestamp: verdict.timestamp || Date.now(),
                  asset_id: verdict.asset_id,
                  location: verdict.location,
                  avg_thickness: verdict.avg_thickness,
                  min_thickness: verdict.min_thickness,
                  max_pit_depth: verdict.max_pit_depth,
                  coating_condition: verdict.coating_condition || `Grade ${args.coating_grade}`,
                  has_cracks: verdict.has_cracks,
                  service_fluid: verdict.service_fluid || args.service_fluid,
                  category: verdict.category,
                  verdict: verdict.verdict,
                  action: verdict.action,
                  standard_cited: verdict.standard_cited,
                  corrosion_rate_mm_per_year: verdict.corrosion_rate_mm_per_year,
                  remaining_life_years: verdict.remaining_life_years,
                  citations: verdict.citations,
                };
                setRecords(prev => [record, ...prev]);
                if (record.category === 'A' || record.category === 'B') {
                  setLastAlert(record);
                }
                setAgentStatus(prev => ({
                  ...prev,
                  agent1: "Delivering Verdict...",
                  agent2: `Category ${record.category} Verdict`,
                }));
                pushLog(setActivityLog, 'agent1', 'Sending to Field Assistant');
                try {
                  session.sendToolResponse({
                    functionResponses: [{
                      id: callId,
                      name: callName || 'run_integrity_analysis',
                      response: verdict,
                    }]
                  });
                } catch (e) {
                  console.error('sendToolResponse failed:', e);
                  pushLog(setActivityLog, 'system', `Failed to send verdict to agent: ${e instanceof Error ? e.message : String(e)}`);
                }
                setTimeout(() => {
                  setAgentStatus(prev => ({ ...prev, agent1: "Listening...", agent2: "Idle" }));
                }, 5000);
              } catch (err) {
                console.error("Agent 2 analysis failed:", err);
                pushLog(setActivityLog, 'system', `Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
                setAgentStatus(prev => ({ ...prev, agent2: "Error" }));
                try {
                  session.sendToolResponse({
                    functionResponses: [{
                      id: callId,
                      name: callName || 'run_integrity_analysis',
                      response: { error: "Analysis failed. Please try again.", category: "Normal" },
                    }]
                  });
                } catch (e) {
                  console.error('sendToolResponse (error path) failed:', e);
                }
              }
            };

            let processedToolCall = false;
            const topLevelCallName = (c: any) => c?.name ?? c?.function_name;
            for (const call of topLevelCalls) {
              const cid = call?.id ?? (call as any).id;
              const cname = topLevelCallName(call) || 'run_integrity_analysis';
              if (topLevelCallName(call) === 'run_integrity_analysis') {
                try {
                  await processRunIntegrityAnalysis(call);
                } catch (e) {
                  console.error('processRunIntegrityAnalysis threw:', e);
                  pushLog(setActivityLog, 'system', `Tool processing error: ${e instanceof Error ? e.message : String(e)}`);
                  try {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: cid,
                        name: cname,
                        response: { error: 'Analysis failed. Please try again.', category: 'Normal' },
                      }]
                    });
                  } catch (sendErr) {
                    console.error('Fallback sendToolResponse failed:', sendErr);
                  }
                }
                processedToolCall = true;
                break;
              }
              // Unknown tool: still send a response so the server doesn't wait and close the session
              pushLog(setActivityLog, 'system', `Responding to unknown tool call: ${cname}`);
              try {
                session.sendToolResponse({
                  functionResponses: [{ id: cid, name: cname, response: { error: 'Unknown function' } }]
                });
              } catch (e) {
                console.error('sendToolResponse for unknown function failed:', e);
              }
            }

            if (hasAudio) {
              setAgentStatus(prev => ({ ...prev, agent1: "Speaking..." }));
              if (!speakingLoggedRef.current) {
                pushLog(setActivityLog, 'agent1', 'Speaking');
                speakingLoggedRef.current = true;
              }
              for (const part of parts) {
                if (part?.inlineData?.data) {
                  const base64Audio = part.inlineData.data;
                  audioQueueRef.current.push(new Int16Array(base64ToArrayBuffer(base64Audio)));
                  playQueuedAudio();
                }
              }
            } else {
              speakingLoggedRef.current = false;
              if (parts.length > 0) {
                const hasToolCallInParts = parts.some((p: any) => p?.functionCall);
                if (!hasToolCallInParts) {
                  setAgentStatus(prev => ({ ...prev, agent1: "Thinking..." }));
                  pushLog(setActivityLog, 'agent1', 'Thinking…');
                }
              }
            }

            if (!processedToolCall) {
              for (const part of parts) {
                const call = part.functionCall ?? part.function_call;
                if (!call) continue;
                const callNameVal = call.name ?? (call as any).name;
                if (callNameVal === 'run_integrity_analysis') {
                  await processRunIntegrityAnalysis(call);
                  break;
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              pushLog(setActivityLog, 'system', 'Turn interrupted');
            }
            } catch (err) {
              console.error('onmessage error:', err);
              pushLog(setActivityLog, 'system', `Message handling error: ${err instanceof Error ? err.message : String(err)}`);
            }
          },
          onclose: (e: any) => {
            const reason = e?.reason ?? e?.code ?? 'unknown';
            pushLog(setActivityLog, 'system', `Session closed (reason: ${reason})`);
            setIsConnected(false);
            setAgentStatus({ agent1: "Idle", agent2: "Idle" });
            stopRecording();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            pushLog(setActivityLog, 'system', `Error: ${err?.message || String(err)}`);
            setIsConnected(false);
          }
        }
      });
      sessionRef.current = session;
    } catch (error) {
      console.error("Failed to start session:", error);
      pushLog(setActivityLog, 'system', `Failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectedAsset, initAudio, playQueuedAudio, startRecording, stopRecording]);

  const endSession = useCallback(() => {
    stopRecording();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    const session = sessionRef.current;
    if (session) {
      try {
        session.close();
      } catch (e) {
        console.warn('Session close error:', e);
      }
      sessionRef.current = null;
    }
    setIsConnected(false);
    setAgentStatus({ agent1: "Idle", agent2: "Idle" });
  }, [stopRecording]);

  const toggleConnection = useCallback(() => {
    if (isConnected) {
      endSession();
    } else {
      startSession();
    }
  }, [isConnected, startSession, endSession]);

  return {
    isConnected,
    isRecording,
    records,
    lastAlert,
    setLastAlert,
    assets,
    selectedAssetId,
    setSelectedAssetId,
    selectedAsset,
    agentStatus,
    toggleConnection,
    activityLog,
  };
}
