import { ShieldAlert } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  return (
    <header className="border-b border-[#141414] px-6 py-4 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#141414] text-[#E4E3E0] rounded-sm">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h1 className="font-serif italic text-xl leading-none">FieldSight AI</h1>
          <p className="font-mono text-[10px] opacity-50 uppercase tracking-widest mt-1">Multi-Agent Asset Integrity Orchestrator</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 border border-[#141414] rounded-full">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider">{isConnected ? 'Inspector Online' : 'System Offline'}</span>
      </div>
    </header>
  );
}
