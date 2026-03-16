import { Mic, MicOff, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  selectedAssetId: string;
  onToggleConnection: () => void;
}

export function Header({ isConnected, selectedAssetId, onToggleConnection }: HeaderProps) {
  return (
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
          onClick={onToggleConnection}
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
  );
}
