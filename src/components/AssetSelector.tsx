import type { Asset } from '../constants';

interface AssetSelectorProps {
  assets: Asset[];
  selectedAssetId: string;
  selectedAsset: Asset | undefined;
  onSelectAsset: (assetId: string) => void;
  disabled?: boolean;
}

export function AssetSelector({
  assets,
  selectedAssetId,
  selectedAsset,
  onSelectAsset,
  disabled = false,
}: AssetSelectorProps) {
  return (
    <section className="border border-[#141414] p-6 rounded-sm bg-white shadow-sm">
      <h2 className="font-serif italic text-lg mb-4">Asset Information</h2>
      <div className="space-y-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider block mb-1">Asset</label>
          <select
            value={selectedAssetId}
            onChange={e => onSelectAsset(e.target.value)}
            disabled={disabled}
            className="w-full p-2 border border-[#141414]/20 rounded-sm font-mono text-sm focus:outline-none focus:border-[#141414] disabled:opacity-60 disabled:cursor-not-allowed"
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
  );
}
