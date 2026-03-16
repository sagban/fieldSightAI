import { Mic, MicOff, Mic2, Cpu, Wrench, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { InspectionRecord } from '../constants';
import type { ActivityLogEntry } from '../hooks/useLiveSession';
import { useEffect, useRef } from 'react';

interface AgentCenterProps {
  isConnected: boolean;
  agentStatus: string;
  selectedAssetId: string;
  records: InspectionRecord[];
  onToggleConnection: () => void;
  /** Live activity log (tool calls, agent steps). */
  activityLog?: ActivityLogEntry[];
  /** When true, progress stepper and large connection pill are hidden (e.g. when shown at page level). */
  showProgress?: boolean;
  /** When true, connection status is rendered as a subtle inline indicator with animation. */
  subtleConnection?: boolean;
}

export const FLOW_STEPS = [
  { key: 'asset', label: 'Asset' },
  { key: 'connect', label: 'Start' },
  { key: 'collect', label: 'Collect' },
  { key: 'analyze', label: 'Analyze' },
  { key: 'verdict', label: 'Verdict' },
];

export function getFlowStep(isConnected: boolean, agentStatus: string): number {
  if (!isConnected) return 0;
  if (agentStatus === 'Idle') return 1;
  if (agentStatus === 'Listening...' || agentStatus === 'Thinking...' || agentStatus === 'Speaking...') return 2;
  if (agentStatus.includes('Analysis') || agentStatus.includes('Waiting')) return 3;
  if (agentStatus.includes('Delivering') || agentStatus.includes('Category')) return 4;
  return 2;
}

function LogIcon({ type }: { type: ActivityLogEntry['type'] }) {
  switch (type) {
    case 'agent1':
      return <Mic2 size={12} className="shrink-0 text-emerald-600" />;
    case 'agent2':
      return <Cpu size={12} className="shrink-0 text-blue-600" />;
    case 'tool':
      return <Wrench size={12} className="shrink-0 text-amber-600" />;
    default:
      return <Radio size={12} className="shrink-0 text-[#141414]/50" />;
  }
}

export function AgentCenter({
  isConnected,
  agentStatus,
  selectedAssetId,
  records,
  onToggleConnection,
  activityLog = [],
  showProgress = true,
  subtleConnection = false,
}: AgentCenterProps) {
  const currentStep = getFlowStep(isConnected, agentStatus);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const isActive = isConnected;
  const isThinking = agentStatus === 'Thinking...';
  const isSpeaking = agentStatus === 'Speaking...';

  // Keep the latest log visible at the bottom of the fixed-height panel
  useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activityLog, records]);

  return (
    <section className="border border-[#141414] rounded-sm bg-white/80 backdrop-blur-sm flex flex-col p-6 min-h-0 flex-1">
      {/* Connection status — subtle or full */}
      <div className={`flex ${subtleConnection ? 'justify-start items-center gap-2 mb-3' : 'justify-center mb-4'}`}>
        {subtleConnection ? (
          <div className="flex items-center gap-2 text-[#141414]/70">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-emerald-500 animate-ping' : 'bg-red-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
            {isConnected && (
              <span className="font-mono text-[10px] text-[#141414]/50">· {agentStatus}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[#141414] rounded-full">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider">{isConnected ? 'Inspector Online' : 'System Offline'}</span>
          </div>
        )}
      </div>

      {/* Agent activity & output — fixed-height log panel at the top */}
      <div className="mb-4 flex flex-col border-t border-[#141414]/20 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#141414]/60 mb-2">
          Agent activity & output
        </p>
        <div ref={logContainerRef} className="h-56 overflow-auto space-y-2">
          <AnimatePresence initial={false}>
            {(() => {
              type TimelineItem =
                | { key: string; ts: number; kind: 'log'; entry: ActivityLogEntry }
                | { key: string; ts: number; kind: 'record'; record: InspectionRecord };
              const items: TimelineItem[] = [
                ...activityLog.map((entry) => ({
                  key: `log-${entry.id}`,
                  ts: entry.ts,
                  kind: 'log' as const,
                  entry,
                })),
                ...records.map((record) => ({
                  key: `record-${record.id}`,
                  ts: record.timestamp,
                  kind: 'record' as const,
                  record,
                })),
              ].sort((a, b) => a.ts - b.ts); // oldest first, newest at bottom

              if (items.length === 0) {
                return (
                  <p className="text-sm italic text-[#141414]/40 py-4 text-center">
                    No activity yet. Start an inspection to see steps and verdicts here.
                  </p>
                );
              }
              return items.map((item) =>
                item.kind === 'log' ? (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2 items-start text-left p-2 rounded-sm border border-[#141414]/10 bg-[#141414]/[0.03]"
                  >
                    <LogIcon type={item.entry.type} />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] text-[#141414]/50 mr-2">
                        {new Date(item.entry.ts).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span className="text-xs text-[#141414]/90">{item.entry.message}</span>
                      {item.entry.detail &&
                        typeof item.entry.detail === 'object' &&
                        Object.keys(item.entry.detail).length > 0 && (
                          <pre className="mt-1 font-mono text-[10px] text-[#141414]/60 whitespace-pre-wrap break-all">
                            {JSON.stringify(item.entry.detail)}
                          </pre>
                        )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-sm border border-[#141414]/10 text-left ${
                      item.record.category === 'A'
                        ? 'bg-red-50 border-red-200'
                        : item.record.category === 'B'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-[#E4E3E0]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-[#141414]/60">
                            {new Date(item.record.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-xs font-medium">{item.record.location}</span>
                          <span
                            className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                              item.record.category === 'A'
                                ? 'border-red-500 text-red-600'
                                : item.record.category === 'B'
                                  ? 'border-amber-500 text-amber-600'
                                  : 'border-[#141414]/20 text-[#141414]/60'
                            }`}
                          >
                            {item.record.category}
                          </span>
                        </div>
                        <p className="text-xs mt-1 font-mono opacity-90">{item.record.action}</p>
                        {item.record.verdict && (
                          <p className="text-[10px] italic opacity-70 mt-0.5 truncate">
                            {item.record.verdict}
                          </p>
                        )}
                      </div>
                      {item.record.category === 'A' ? (
                        <AlertTriangle size={16} className="text-red-600 shrink-0" />
                      ) : item.record.category === 'B' ? (
                        <Info size={16} className="text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </motion.div>
                ),
              );
            })()}
          </AnimatePresence>
        </div>
      </div>

      {/* Flow — optional when progress is shown at page level */}
      {showProgress && (
        <div className="w-full flex justify-between items-center gap-1 mb-4">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.key} className="flex flex-1 items-center">
              <div
                className={`flex-1 py-1.5 rounded-sm text-center font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  i <= currentStep
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'bg-[#141414]/10 text-[#141414]/40'
                }`}
              >
                {step.label}
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div
                  className={`w-2 h-0.5 shrink-0 ${i < currentStep ? 'bg-[#141414]' : 'bg-[#141414]/20'}`}
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Voice / state animation */}
      <div className="flex flex-col items-center justify-center w-full py-4 shrink-0">
        <div className="relative flex items-center justify-center">
          {/* Outer ring pulse when active */}
          {isActive && (
            <div
              className={`absolute inset-0 rounded-full border-2 border-[#141414]/20 animate-agent-ring ${
                isSpeaking ? 'border-[#141414]' : ''
              }`}
              style={{ width: 140, height: 140, margin: -70 }}
            />
          )}

          {/* Main circle + animation */}
          <div
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-colors duration-300 ${
              isConnected
                ? isSpeaking
                  ? 'bg-[#141414] text-[#E4E3E0]'
                  : isThinking
                    ? 'bg-amber-500/20 text-amber-700 border-2 border-amber-400'
                    : 'bg-emerald-500/20 text-emerald-800 border-2 border-emerald-500'
                : 'bg-[#141414]/5 text-[#141414]/50 border-2 border-[#141414]/10'
            }`}
          >
            {!isConnected ? (
              <Mic size={40} className="opacity-60" />
            ) : isSpeaking ? (
              <div className="flex items-end gap-1 h-10" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-current rounded-full animate-agent-bar"
                    style={{ height: 8 + (i % 3) * 12, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            ) : isThinking ? (
              <div className="flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-current animate-agent-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Mic size={36} className="opacity-90" />
                <div className="flex gap-0.5" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-current rounded-full animate-agent-listen"
                      style={{ height: 4 + i * 3, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-[#141414]/50">
          {!isConnected ? 'Ready' : agentStatus}
        </p>
      </div>

      {/* Start / End button */}
      <button
        onClick={onToggleConnection}
        disabled={!selectedAssetId && !isConnected}
        className={`w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shrink-0 mx-auto ${
          isConnected
            ? 'bg-transparent border-2 border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]'
            : 'bg-[#141414] text-[#E4E3E0] hover:bg-[#141414]/90'
        }`}
      >
        {isConnected ? <MicOff size={20} /> : <Mic size={20} />}
        {isConnected ? 'End Inspection' : 'Start Inspection'}
      </button>

      <style>{`
        @keyframes agent-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .animate-agent-ring {
          animation: agent-ring 1.5s ease-out infinite;
        }
        @keyframes agent-bar {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .animate-agent-bar {
          animation: agent-bar 0.6s ease-in-out infinite;
          transform-origin: bottom;
        }
        @keyframes agent-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-agent-bounce {
          animation: agent-bounce 0.6s ease-in-out infinite;
        }
        @keyframes agent-listen {
          0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-agent-listen {
          animation: agent-listen 1s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
    </section>
  );
}
