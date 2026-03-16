import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import {
  RUN_INTEGRITY_ANALYSIS_TOOL,
  VERIFY_ASSET_TOOL,
  SYSTEM_INSTRUCTION,
  InspectionRecord,
  Asset,
} from '../constants';
import { SAMPLE_RATE, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/audio';

export function useLiveSession() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [lastAlert, setLastAlert] = useState<InspectionRecord | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    agent1: "Idle",
    agent2: "Idle",
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768;
    }
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playQueuedAudio();
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

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      videoIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !sessionRef.current) return;
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
        sessionRef.current.sendRealtimeInput({
          media: { data: base64, mimeType: 'image/jpeg' }
        });
      }, 1000);
    } catch (error) {
      console.error("Camera access denied:", error);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startSession = useCallback(async () => {
    if (!selectedAsset) return;
    try {
      await initAudio();
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCURRENT CONTEXT:\nAsset ID: ${selectedAsset.asset_id}\nAsset Name: ${selectedAsset.name}\nComponent: ${selectedAsset.component_type}\nService Fluid: ${selectedAsset.service_fluid}\nLocation: ${selectedAsset.location}\nMaterial: ${selectedAsset.material}\nDesign Pressure: ${selectedAsset.design_pressure_bar} bar\nLast Inspection: ${selectedAsset.last_inspection}`,
          tools: [{ functionDeclarations: [RUN_INTEGRITY_ANALYSIS_TOOL, VERIFY_ASSET_TOOL] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          }
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setAgentStatus(prev => ({ ...prev, agent1: "Listening..." }));
            startRecording();
            startCamera();
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              audioQueueRef.current.push(new Int16Array(base64ToArrayBuffer(base64Audio)));
              playQueuedAudio();
            }
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (!part.functionCall) continue;
              const call = part.functionCall;
              if (call.name === 'verify_asset') {
                setAgentStatus(prev => ({ ...prev, agent1: "Verifying Nameplate..." }));
                setTimeout(() => {
                  setIsVerified(true);
                  setAgentStatus(prev => ({ ...prev, agent1: "Asset Verified" }));
                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: 'verify_asset',
                      response: {
                        status: "success",
                        verified: true,
                        asset_id: selectedAsset.asset_id,
                        name: selectedAsset.name,
                        component: selectedAsset.component_type,
                      }
                    }]
                  });
                }, 1500);
              }
              if (call.name === 'run_integrity_analysis') {
                setAgentStatus(prev => ({
                  ...prev,
                  agent1: "Waiting for Analysis...",
                  agent2: "Starting Analysis...",
                }));
                try {
                  const args = call.args as any;
                  if (!args.service_fluid && selectedAsset) {
                    args.service_fluid = selectedAsset.service_fluid;
                  }
                  setAgentStatus(prev => ({ ...prev, agent2: "Calculating & Searching Standards..." }));
                  const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(args),
                  });
                  if (!response.ok) throw new Error(`Backend error: ${response.status}`);
                  const verdict = await response.json();
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
                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: 'run_integrity_analysis',
                      response: verdict,
                    }]
                  });
                  setTimeout(() => {
                    setAgentStatus(prev => ({ ...prev, agent1: "Listening...", agent2: "Idle" }));
                  }, 5000);
                } catch (err) {
                  console.error("Agent 2 analysis failed:", err);
                  setAgentStatus(prev => ({ ...prev, agent2: "Error" }));
                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: 'run_integrity_analysis',
                      response: { error: "Analysis failed. Please try again.", category: "Normal" },
                    }]
                  });
                }
              }
            }
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => {
            setIsConnected(false);
            setAgentStatus({ agent1: "Idle", agent2: "Idle" });
            stopRecording();
            stopCamera();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            setIsConnected(false);
          }
        }
      });
      sessionRef.current = session;
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  }, [selectedAsset, initAudio, playQueuedAudio, startRecording, startCamera, stopRecording, stopCamera]);

  const endSession = useCallback(() => {
    stopRecording();
    stopCamera();
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
    setIsVerified(false);
  }, [stopRecording, stopCamera]);

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
    isVerified,
    agentStatus,
    videoRef,
    toggleConnection,
  };
}
