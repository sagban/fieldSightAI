import { useState, useEffect } from 'react';
import { Package, Database } from 'lucide-react';
import type { Asset } from '../constants';

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assets')
      .then((res) => res.json())
      .then((data: Asset[]) => {
        setAssets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="border-b border-[#141414] px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-serif italic text-xl">Assets</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
          Registered assets available for inspection
        </p>
      </header>

      <main className="p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="p-4 bg-[#E4E3E0] rounded-sm">
              <Database size={32} className="text-[#141414]/50 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="border border-[#141414] rounded-sm bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#141414] bg-[#F9F9F8] font-mono text-[10px] uppercase tracking-widest">
              <div className="col-span-2">Asset ID</div>
              <div className="col-span-2">Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Service Fluid</div>
              <div className="col-span-2">Last Inspection</div>
            </div>
            {assets.length === 0 ? (
              <div className="p-16 text-center">
                <Package size={40} className="mx-auto text-[#141414]/30 mb-4" />
                <p className="font-mono text-sm text-[#141414]/60">No assets loaded.</p>
              </div>
            ) : (
              assets.map((a) => (
                <div
                  key={a.asset_id}
                  className="grid grid-cols-12 gap-4 p-4 border-b border-[#141414]/10 hover:bg-[#E4E3E0]/30 transition-colors"
                >
                  <div className="col-span-2 font-medium">{a.asset_id}</div>
                  <div className="col-span-2">{a.name}</div>
                  <div className="col-span-2">{a.component_type}</div>
                  <div className="col-span-2">{a.location}</div>
                  <div className="col-span-2">{a.service_fluid}</div>
                  <div className="col-span-2 font-mono text-xs">{a.last_inspection}</div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </>
  );
}
