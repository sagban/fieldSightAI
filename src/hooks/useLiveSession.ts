import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { InspectionRecord, Asset } from '../constants';
import { SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from '../utils/audio';

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

function getLiveWsUrl(assetId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const wsScheme = base.startsWith('https') ? 'wss:' : 'ws:';
  const host = base.replace(/^https?:\/\//, '');
  const params = new URLSearchParams({ assetId });
  return `${wsScheme}//${host}/api/live/ws?${params.toString()}`;
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
  const wsRef = useRef<WebSocket | null>(null);
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
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    if (chunk.length === 0) {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) playQueuedAudio();
      return;
    }
    const audioBuffer = ctx.createBuffer(1, chunk.length, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) {
        playQueuedAudio().catch(console.error);
      } else {
        setAgentStatus(prev => (prev.agent1 === 'Speaking...' ? { ...prev, agent1: 'Listening...' } : prev));
      }
    };
    source.start();
  }, []);

  const startRecording = useCallback((ws: WebSocket) => {
    if (!audioContextRef.current) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
      setIsRecording(true);
      const audioContext = audioContextRef.current!;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        ws.send(pcmData.buffer);
      };
    }).catch((err) => console.error("Failed to start recording:", err));
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

      const wsUrl = getLiveWsUrl(selectedAsset.asset_id);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        speakingLoggedRef.current = false;
        setIsConnected(true);
        setAgentStatus(prev => ({ ...prev, agent1: "Listening..." }));
        pushLog(setActivityLog, 'agent1', 'Session open — listening for voice');
        startRecording(ws);
      };

      ws.onmessage = async (event: MessageEvent) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            const chunk = new Int16Array(event.data);
            if (chunk.length === 0) return;
            audioQueueRef.current.push(chunk);
            setAgentStatus(prev => (prev.agent1 !== 'Speaking...' ? { ...prev, agent1: "Speaking..." } : prev));
            if (!speakingLoggedRef.current) {
              pushLog(setActivityLog, 'agent1', 'Speaking');
              speakingLoggedRef.current = true;
            }
            if (audioContextRef.current?.state === 'suspended') {
              await audioContextRef.current.resume();
            }
            playQueuedAudio().catch((err) => {
              console.error('playQueuedAudio error:', err);
              pushLog(setActivityLog, 'system', `Playback error: ${err instanceof Error ? err.message : String(err)}`);
            });
            return;
          }

          const text = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          let message: Record<string, unknown>;
          try {
            message = JSON.parse(text);
          } catch {
            return;
          }

          const serverContent = message.serverContent as Record<string, unknown> | undefined;
          if (serverContent?.interrupted) {
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            pushLog(setActivityLog, 'system', 'Turn interrupted');
          }
          if (serverContent?.turnComplete) {
            speakingLoggedRef.current = false;
          }
          const modelTurn = serverContent?.modelTurn as { parts?: Array<{ inlineData?: { data?: string } }> } | undefined;
          const parts = modelTurn?.parts ?? [];
          for (const part of parts) {
            if (part?.inlineData?.data) {
              const binary = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
              audioQueueRef.current.push(new Int16Array(binary.buffer));
              playQueuedAudio();
            }
          }

          if (message.type === 'tool_result' && message.name === 'run_integrity_analysis') {
            const result = message.result as Record<string, unknown>;
            pushLog(setActivityLog, 'agent2', 'Verdict received');
            const record: InspectionRecord = {
              id: (result.id as string) || Math.random().toString(36).substr(2, 9),
              timestamp: (result.timestamp as number) || Date.now(),
              asset_id: (result.asset_id as string) ?? '',
              location: (result.location as string) ?? '',
              avg_thickness: (result.avg_thickness as number) ?? 0,
              min_thickness: (result.min_thickness as number) ?? 0,
              max_pit_depth: (result.max_pit_depth as number) ?? 0,
              coating_condition: (result.coating_condition as string) ?? '',
              has_cracks: (result.has_cracks as boolean) ?? false,
              service_fluid: (result.service_fluid as string) ?? '',
              category: (result.category as InspectionRecord['category']) ?? 'Normal',
              verdict: (result.verdict as string) ?? '',
              action: (result.action as string) ?? '',
              standard_cited: (result.standard_cited as string) ?? '',
              corrosion_rate_mm_per_year: result.corrosion_rate_mm_per_year as number | undefined,
              remaining_life_years: result.remaining_life_years as number | null | undefined,
              citations: result.citations as InspectionRecord['citations'],
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
            setTimeout(() => {
              setAgentStatus(prev => ({ ...prev, agent1: "Listening...", agent2: "Idle" }));
            }, 5000);
          }

          if (message.type === 'tool_call' && message.name === 'run_integrity_analysis') {
            pushLog(setActivityLog, 'tool', 'Tool call: run_integrity_analysis', message.args as Record<string, unknown>);
            setAgentStatus(prev => ({
              ...prev,
              agent1: "Waiting for Analysis...",
              agent2: "Starting Analysis...",
            }));
            pushLog(setActivityLog, 'agent2', 'Running analysis (standards + calculations)');
          }

          if (message.type === 'error') {
            pushLog(setActivityLog, 'system', `Error: ${message.error ?? 'Unknown'}`);
          }
        } catch (err) {
          console.error('onmessage error:', err);
          pushLog(setActivityLog, 'system', `Message handling error: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      ws.onclose = (e) => {
        const reason = e?.reason ?? e?.code ?? 'unknown';
        pushLog(setActivityLog, 'system', `Session closed (reason: ${reason})`);
        setIsConnected(false);
        setAgentStatus({ agent1: "Idle", agent2: "Idle" });
        stopRecording();
        wsRef.current = null;
      };

      ws.onerror = () => {
        pushLog(setActivityLog, 'system', 'WebSocket error');
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to start session:", error);
      pushLog(setActivityLog, 'system', `Failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectedAsset, initAudio, playQueuedAudio, startRecording, stopRecording]);

  const endSession = useCallback(() => {
    stopRecording();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.warn('WebSocket close error:', e);
      }
      wsRef.current = null;
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
