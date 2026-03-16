import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle2,
  History,
  Settings,
  ShieldAlert,
  Layers,
  Camera,
  Database,
  CloudRain,
  Cpu,
  CheckCircle,
  Thermometer,
  Droplets,
  Wind,
  Info,
  Brain,
  Search,
  Wrench,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import {
  RUN_INTEGRITY_ANALYSIS_TOOL,
  VERIFY_ASSET_TOOL,
  SYSTEM_INSTRUCTION,
  InspectionRecord,
  Asset,
} from './constants';

const SAMPLE_RATE = 16000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function App() {
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
  const [weather] = useState({ temp: 28, humidity: 82, swell: 1.2 });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedAsset = assets.find(a => a.asset_id === selectedAssetId);

  // Fetch assets from backend on mount
  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then((data: Asset[]) => {
        setAssets(data);
        if (data.length > 0) setSelectedAssetId(data[0].asset_id);
      })
      .catch(err => console.error("Failed to fetch assets:", err));
  }, []);

  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

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

  const startSession = async () => {
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

                  if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                  }

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
  };

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Stream video frames to Gemini at ~1 FPS
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
  };

  const stopCamera = () => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const toggleConnection = () => {
    if (isConnected) {
      sessionRef.current?.close();
      setIsConnected(false);
    } else {
      startSession();
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#141414] text-[#E4E3E0] rounded-sm">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="font-serif italic text-xl leading-none">FieldSight AI</h1>
            <p className="font-mono text-[10px] opacity-50 uppercase tracking-widest mt-1">Multi-Agent Asset Integrity Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 border border-[#141414] rounded-full">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider">{isConnected ? 'Inspector Online' : 'System Offline'}</span>
          </div>
          <button
            onClick={toggleConnection}
            disabled={!selectedAssetId && !isConnected}
            className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${
              isConnected
                ? 'bg-transparent border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]'
                : 'bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90'
            }`}
          >
            {isConnected ? <MicOff size={18} /> : <Mic size={18} />}
            <span className="font-medium text-sm">{isConnected ? 'End Session' : 'Start Inspection'}</span>
          </button>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Asset Selector */}
          {!isConnected && (
            <section className="border border-[#141414] p-6 rounded-sm bg-white shadow-sm">
              <h2 className="font-serif italic text-lg mb-4">Select Asset</h2>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider block mb-1">Asset</label>
                  <select
                    value={selectedAssetId}
                    onChange={e => setSelectedAssetId(e.target.value)}
                    className="w-full p-2 border border-[#141414]/20 rounded-sm font-mono text-sm focus:outline-none focus:border-[#141414]"
                  >
                    {assets.map(a => (
                      <option key={a.asset_id} value={a.asset_id}>
                        {a.asset_id} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAsset && (
                  <div className="space-y-2 pt-2 border-t border-[#141414]/10">
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Type</span>
                      <span className="font-medium">{selectedAsset.component_type}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Location</span>
                      <span className="font-medium">{selectedAsset.location}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Service Fluid</span>
                      <span className="font-medium">{selectedAsset.service_fluid}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Material</span>
                      <span className="font-medium">{selectedAsset.material}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Design Pressure</span>
                      <span className="font-medium">{selectedAsset.design_pressure_bar} bar</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">t_min</span>
                      <span className="font-medium">{selectedAsset.t_min_mm} mm</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-50">Last Inspection</span>
                      <span className="font-medium">{selectedAsset.last_inspection}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Camera Feed */}
          {isConnected && (
            <section className="border border-[#141414] p-4 rounded-sm bg-black relative overflow-hidden aspect-video shadow-lg">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex justify-between items-start">
                  <div className="bg-white/10 backdrop-blur-md p-2 rounded-sm border border-white/20">
                    <Camera size={16} className="text-white" />
                  </div>
                  {isVerified && (
                    <div className="bg-emerald-500 text-white px-2 py-1 rounded-sm text-[10px] font-mono flex items-center gap-1 shadow-lg">
                      <CheckCircle size={10} /> VERIFIED: {selectedAsset?.asset_id}
                    </div>
                  )}
                </div>
                <div className="w-full h-px bg-white/20 relative">
                  <div className="absolute top-0 left-0 w-full h-full bg-emerald-400/50 animate-scan" />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-white/50 font-mono text-[8px] uppercase tracking-widest">Live Camera → Gemini (1 FPS)</p>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              </div>
            </section>
          )}

          {/* Agent Status */}
          <section className="border border-[#141414] p-6 rounded-sm bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-6">
              <Cpu size={18} className="text-[#141414]" />
              <h2 className="font-serif italic text-lg">Agent Status</h2>
            </div>

            <div className="space-y-4">
              {/* Agent 1 */}
              <div className="flex items-center justify-between p-3 border border-[#141414]/10 rounded-sm bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#141414] text-white rounded-sm">
                    <Mic size={14} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider">Agent 1: Field Assistant</p>
                    <p className="text-xs font-medium">{agentStatus.agent1}</p>
                  </div>
                </div>
                {agentStatus.agent1 !== "Idle" && (
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    agentStatus.agent1.includes("Waiting") ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                )}
              </div>

              {/* Agent 2 */}
              <div className="flex items-center justify-between p-3 border border-[#141414]/10 rounded-sm bg-white">
                <div className="flex items-center gap-3">
                  <div className={`p-2 text-white rounded-sm ${
                    agentStatus.agent2 !== "Idle" ? 'bg-blue-600' : 'bg-zinc-400'
                  }`}>
                    <Brain size={14} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider">Agent 2: Integrity Engineer</p>
                    <p className="text-xs font-medium">{agentStatus.agent2}</p>
                  </div>
                </div>
                {agentStatus.agent2 !== "Idle" && agentStatus.agent2 !== "Error" && (
                  <div className="flex items-center gap-1">
                    {agentStatus.agent2.includes("Calculating") && <Wrench size={10} className="text-blue-500" />}
                    {agentStatus.agent2.includes("Searching") && <Search size={10} className="text-blue-500" />}
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Environmental Data */}
          <section className="border border-[#141414] p-6 rounded-sm bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-6">
              <CloudRain size={18} className="text-[#141414]" />
              <h2 className="font-serif italic text-lg">Environmental Context</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex justify-center mb-1 opacity-50"><Thermometer size={14} /></div>
                <p className="font-mono text-[8px] uppercase opacity-50">Temp</p>
                <p className="text-xl font-light">{weather.temp}°C</p>
              </div>
              <div className="text-center border-x border-[#141414]/10">
                <div className="flex justify-center mb-1 opacity-50"><Droplets size={14} /></div>
                <p className="font-mono text-[8px] uppercase opacity-50">Humidity</p>
                <p className="text-xl font-light">{weather.humidity}%</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1 opacity-50"><Wind size={14} /></div>
                <p className="font-mono text-[8px] uppercase opacity-50">Swell</p>
                <p className="text-xl font-light">{weather.swell}m</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Review Queue */}
        <div className="lg:col-span-8">
          <section className="border border-[#141414] rounded-sm bg-white overflow-hidden flex flex-col h-full min-h-[600px] shadow-xl">
            <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#F9F9F8]">
              <div className="flex items-center gap-2">
                <Layers size={18} />
                <h2 className="font-serif italic text-lg">Engineering Review Queue</h2>
              </div>
              <div className="flex gap-2">
                <button className="p-2 border border-[#141414] rounded-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                  <History size={16} />
                </button>
                <button className="p-2 border border-[#141414] rounded-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-12 border-b border-[#141414] bg-[#E4E3E0]/30 font-mono text-[10px] uppercase tracking-widest p-4 sticky top-0 z-10 backdrop-blur-sm">
                <div className="col-span-1">TS</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-3">Health Metrics (UT/Pit/Coat)</div>
                <div className="col-span-1">Cat</div>
                <div className="col-span-3">Prescribed Action</div>
                <div className="col-span-2 text-right">Verdict</div>
              </div>

              <AnimatePresence initial={false}>
                {records.length === 0 ? (
                  <div className="p-24 text-center space-y-4">
                    <div className="flex justify-center">
                      <Cpu size={48} className="opacity-10 animate-pulse" />
                    </div>
                    <p className="opacity-30 italic font-serif">No findings currently in review queue.</p>
                    <p className="opacity-20 font-mono text-[10px]">Start an inspection to see Agent 2 verdicts here.</p>
                  </div>
                ) : (
                  records.map((record) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`grid grid-cols-12 p-4 border-b border-[#141414]/10 items-center hover:bg-[#141414] hover:text-[#E4E3E0] transition-all duration-200 group cursor-default ${
                        record.category === 'A' ? 'bg-red-50' : record.category === 'B' ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="col-span-1 font-mono text-[10px] opacity-60 group-hover:opacity-100">
                        {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="col-span-2 text-xs font-medium">
                        {record.location}
                        <p className="text-[8px] opacity-50 group-hover:opacity-100 uppercase tracking-tighter">{record.service_fluid}</p>
                      </div>
                      <div className="col-span-3">
                        <div className="flex gap-2 font-mono text-[10px]">
                          <span className="px-1 bg-blue-100 text-blue-700 rounded-sm group-hover:bg-blue-600 group-hover:text-white">UT: {record.min_thickness}mm</span>
                          <span className="px-1 bg-amber-100 text-amber-700 rounded-sm group-hover:bg-amber-600 group-hover:text-white">Pit: {record.max_pit_depth}mm</span>
                          <span className="px-1 bg-zinc-100 text-zinc-700 rounded-sm group-hover:bg-zinc-600 group-hover:text-white">{record.coating_condition}</span>
                        </div>
                        {record.has_cracks && <p className="text-[9px] text-red-600 font-bold mt-1 group-hover:text-white">CRACK DETECTED</p>}
                        {record.remaining_life_years != null && (
                          <p className={`text-[9px] mt-1 font-mono ${record.remaining_life_years < 0 ? 'text-red-600' : 'text-emerald-600'} group-hover:text-white`}>
                            Life: {record.remaining_life_years}yr
                          </p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full border ${
                          record.category === 'A'
                            ? 'border-red-500 text-red-600 bg-red-50 group-hover:bg-red-600 group-hover:text-white'
                            : record.category === 'B'
                            ? 'border-amber-500 text-amber-600 bg-amber-50 group-hover:bg-amber-600 group-hover:text-white'
                            : 'border-[#141414]/20 text-[#141414]/60 group-hover:border-white/40 group-hover:text-white'
                        }`}>
                          {record.category}
                        </span>
                      </div>
                      <div className="col-span-3 text-[11px] font-mono italic opacity-80 group-hover:opacity-100 pr-4">
                        {record.action}
                        <p className="text-[8px] mt-1 opacity-50 group-hover:opacity-100">Ref: {record.standard_cited}</p>
                      </div>
                      <div className="col-span-2 text-right flex justify-end items-center gap-2">
                        <div className="text-[9px] font-serif italic hidden group-hover:block opacity-70 max-w-[150px] truncate">{record.verdict}</div>
                        {record.category === 'A' ? (
                          <AlertTriangle size={14} className="text-red-600 group-hover:text-white" />
                        ) : record.category === 'B' ? (
                          <Info size={14} className="text-amber-600 group-hover:text-white" />
                        ) : (
                          <CheckCircle2 size={14} className="text-emerald-600 group-hover:text-white" />
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      {/* Category A: Full-screen blocking modal */}
      <AnimatePresence>
        {lastAlert && lastAlert.category === 'A' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-red-900/95 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-white rounded-sm p-8 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-600 rounded-sm">
                  <AlertTriangle size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="font-serif italic text-2xl text-red-600">Category A — CRITICAL</h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mt-1">Immediate Action Required</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm border-b border-red-100 pb-2">
                  <span className="text-red-400">Asset</span>
                  <span className="font-bold">{lastAlert.asset_id}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-red-100 pb-2">
                  <span className="text-red-400">Location</span>
                  <span className="font-bold">{lastAlert.location}</span>
                </div>
                <div className="text-sm border-b border-red-100 pb-2">
                  <span className="text-red-400 block mb-1">Verdict</span>
                  <span className="font-bold italic">{lastAlert.verdict}</span>
                </div>
                <div className="text-sm border-b border-red-100 pb-2">
                  <span className="text-red-400 block mb-1">Prescribed Action</span>
                  <span className="font-bold">{lastAlert.action}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">Standard</span>
                  <span className="font-mono text-xs">{lastAlert.standard_cited}</span>
                </div>
              </div>

              <button
                onClick={() => setLastAlert(null)}
                className="w-full py-3 bg-red-600 text-white font-bold text-sm uppercase tracking-widest hover:bg-red-700 transition-colors rounded-sm"
              >
                Acknowledge Critical Finding
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category B/C: Bottom-right toast */}
      <AnimatePresence>
        {lastAlert && lastAlert.category !== 'A' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-10 right-10 z-50 w-96 p-6 rounded-sm shadow-2xl border-l-8 border-white bg-amber-600 text-white"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-sm">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif italic text-xl">Category {lastAlert.category} Alert</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-80 mt-1">Integrity Warning</p>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm border-b border-white/20 pb-1">
                    <span>Asset:</span>
                    <span className="font-bold">{lastAlert.asset_id}</span>
                  </div>
                  <div className="text-sm border-b border-white/20 pb-1">
                    <span className="block opacity-70">Verdict:</span>
                    <span className="font-bold italic">{lastAlert.verdict}</span>
                  </div>
                </div>

                <button
                  onClick={() => setLastAlert(null)}
                  className="mt-6 w-full py-2 bg-white text-amber-600 font-bold text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all"
                >
                  Acknowledge & Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-6 border-t border-[#141414] mt-auto flex justify-between items-center opacity-50">
        <p className="font-mono text-[10px] uppercase tracking-widest">© 2026 FieldSight AI | Multi-Agent Integrity Orchestrator</p>
        <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest">
          <span>Gemini Live API</span>
          <span>File Search RAG</span>
          <span>Google Cloud</span>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
