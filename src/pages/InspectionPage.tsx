import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, MapPin, Droplets, Calendar } from 'lucide-react';
import type { Asset } from '../constants';

export function InspectionPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/assets')
      .then((res) => res.json())
      .then((data: Asset[]) => {
        setAssets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? assets.filter(
        (a) =>
          a.asset_id.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.location.toLowerCase().includes(search.toLowerCase()) ||
          a.component_type.toLowerCase().includes(search.toLowerCase())
      )
    : assets;

  const handleStartInspection = (assetId: string) => {
    navigate('/inspection/agent', { state: { assetId } });
  };

  return (
    <>
      <header className="border-b border-[#141414] px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-serif italic text-xl">Inspection</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
          Select an asset and start inspection
        </p>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/40" />
          <input
            type="text"
            placeholder="Search by ID, name, location, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#141414]/20 rounded-sm font-mono text-sm bg-white/80 focus:outline-none focus:border-[#141414] placeholder:text-[#141414]/40"
          />
        </div>
      </header>

      <main className="p-6 flex-1 min-h-0">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="p-4 bg-[#E4E3E0] rounded-sm">
              <Package size={32} className="text-[#141414]/50 animate-pulse" />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-[#141414]/10 rounded-sm bg-white/50">
            <Package size={40} className="mx-auto text-[#141414]/30 mb-4" />
            <p className="font-mono text-sm text-[#141414]/60">
              {search.trim() ? 'No assets match your search.' : 'No assets loaded.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((asset) => (
              <article
                key={asset.asset_id}
                className="border border-[#141414] rounded-sm bg-white/90 backdrop-blur-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="p-4 border-b border-[#141414]/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#141414]/50">
                        {asset.asset_id}
                      </p>
                      <h2 className="font-serif italic text-lg truncate">{asset.name}</h2>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-[#141414]/70">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="shrink-0 opacity-50" />
                      <span className="truncate">{asset.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets size={12} className="shrink-0 opacity-50" />
                      <span>{asset.service_fluid}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="shrink-0 opacity-50" />
                      <span className="font-mono">Last: {asset.last_inspection}</span>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#141414]/50">
                    {asset.component_type}
                  </p>
                </div>
                <div className="p-4 mt-auto">
                  <button
                    onClick={() => handleStartInspection(asset.asset_id)}
                    className="w-full py-2.5 rounded-sm font-mono text-[10px] uppercase tracking-wider bg-[#141414] text-[#E4E3E0] hover:bg-[#141414]/90 transition-colors"
                  >
                    Start Inspection
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
