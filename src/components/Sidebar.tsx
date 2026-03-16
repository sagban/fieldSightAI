import { NavLink } from 'react-router-dom';
import { ShieldAlert, Radio, History, Settings, Package } from 'lucide-react';
import logo from '/fieldsight-logo.png';

const navItems = [
  { to: '/', label: 'Inspection', icon: Radio },
  { to: '/history', label: 'History', icon: History },
  { to: '/assets', label: 'Assets', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen border-r border-[#141414]/10 bg-white/80 backdrop-blur-xl flex flex-col shrink-0 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="p-6 border-b border-[#141414]/5">
        <NavLink to="/" className="flex items-center gap-3 no-underline text-[#141414]">
          <div className="p-0 rounded-md bg-white">
            <img src={logo} alt="FieldSight AI logo" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <h1 className="font-serif italic text-lg leading-none">FieldSight AI</h1>
            <p className="font-mono text-[9px] opacity-60 uppercase tracking-widest mt-0.5">
              Inspection Co‑Pilot
            </p>
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
              `flex items-center gap-3 px-4 py-3 rounded-md font-mono text-sm transition-all no-underline ${
                isActive
                  ? 'bg-[#111827] text-[#F9FAFB] shadow-sm'
                  : 'text-[#111827]/80 hover:bg-[#111827]/5 hover:text-[#111827] hover:translate-x-0.5'
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
