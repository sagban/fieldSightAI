import { Cpu, Mic, Brain, Search, Wrench } from 'lucide-react';

interface AgentStatusProps {
  agent1: string;
  agent2: string;
}

export function AgentStatus({ agent1, agent2 }: AgentStatusProps) {
  return (
    <section className="border border-[#141414] p-6 rounded-sm bg-white/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <Cpu size={18} className="text-[#141414]" />
        <h2 className="font-serif italic text-lg">Agent Status</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 border border-[#141414]/10 rounded-sm bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#141414] text-white rounded-sm">
              <Mic size={14} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider">Agent 1: Field Assistant</p>
              <p className="text-xs font-medium">{agent1}</p>
            </div>
          </div>
          {agent1 !== "Idle" && (
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agent1.includes("Waiting") ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
          )}
        </div>

        <div className="flex items-center justify-between p-3 border border-[#141414]/10 rounded-sm bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 text-white rounded-sm ${
              agent2 !== "Idle" ? 'bg-blue-600' : 'bg-zinc-400'
            }`}>
              <Brain size={14} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider">Agent 2: Integrity Engineer</p>
              <p className="text-xs font-medium">{agent2}</p>
            </div>
          </div>
          {agent2 !== "Idle" && agent2 !== "Error" && (
            <div className="flex items-center gap-1">
              {agent2.includes("Calculating") && <Wrench size={10} className="text-blue-500" />}
              {agent2.includes("Searching") && <Search size={10} className="text-blue-500" />}
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
