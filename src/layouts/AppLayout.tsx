import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F4] via-[#E4E3E0] to-[#D6D3D1] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
