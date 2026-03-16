import { NavLink } from 'react-router-dom';
import { ShieldAlert, Radio, History, Settings, Package } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Inspection', icon: Radio },
  { to: '/history', label: 'History', icon: History },
  { to: '/assets', label: 'Assets', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen border-r border-[#141414] bg-white/90 backdrop-blur-md flex flex-col shrink-0">
      <div className="p-6 border-b border-[#141414]/10">
        <NavLink to="/" className="flex items-center gap-3 no-underline text-[#141414]">
          <div className="p-2 bg-[#141414] text-[#E4E3E0] rounded-sm">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="font-serif italic text-lg leading-none">FieldSight AI</h1>
            <p className="font-mono text-[9px] opacity-50 uppercase tracking-widest mt-0.5">Integrity Orchestrator</p>
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-sm transition-colors no-underline ${
                isActive
                  ? 'bg-[#141414] text-[#E4E3E0]'
                  : 'text-[#141414]/80 hover:bg-[#141414]/5 hover:text-[#141414]'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[#141414]/10">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-50">
          Gemini Live · RAG · GCP
        </p>
      </div>
    </aside>
  );
}
