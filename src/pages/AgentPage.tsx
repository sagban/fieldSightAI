import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Droplets, Calendar } from 'lucide-react';
import {
  AgentCenter,
  EnvironmentalContext,
  CriticalAlertModal,
  AlertToast,
  Footer,
  FLOW_STEPS,
  getFlowStep,
} from '../components';
import { useLiveSession } from '../hooks/useLiveSession';
import type { Asset } from '../constants';

const WEATHER = { temp: 28, humidity: 82, swell: 1.2 };

export function AgentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const assetIdFromState = (location.state as { assetId?: string } | null)?.assetId;

  const {
    isConnected,
    records,
    lastAlert,
    setLastAlert,
    assets,
    selectedAssetId,
    setSelectedAssetId,
    selectedAsset,
    agentStatus,
    toggleConnection,
    activityLog,
  } = useLiveSession();

  const [weather] = useState(WEATHER);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (assetIdFromState) {
      setSelectedAssetId(assetIdFromState);
    }
  }, [assetIdFromState, setSelectedAssetId]);

  useEffect(() => {
    if (!assetIdFromState && !selectedAssetId && assets.length > 0) {
      navigate('/', { replace: true });
    }
  }, [assetIdFromState, selectedAssetId, assets.length, navigate]);

  // When user comes from InspectionPage with an asset, start the session immediately so the agent begins communication
  useEffect(() => {
    if (!assetIdFromState || !selectedAsset || isConnected || autoStartedRef.current) return;
    autoStartedRef.current = true;
    toggleConnection();
  }, [assetIdFromState, selectedAsset, isConnected, toggleConnection]);

  // Reset auto-start when navigating with a different asset
  useEffect(() => {
    autoStartedRef.current = false;
  }, [assetIdFromState]);

  const currentStep = getFlowStep(isConnected, agentStatus.agent1);

  return (
    <>
      {/* Top: Progress */}
      <header className="border-b border-[#141414] bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#141414]/70 hover:text-[#141414] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex-1 flex justify-between items-center gap-1">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-1 items-center">
                <div
                  className={`flex-1 py-2 rounded-sm text-center font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Center: Agent (connection, voice, button, output) */}
        <div className="lg:col-span-8 flex flex-col min-h-0">
          <AgentCenter
            isConnected={isConnected}
            agentStatus={agentStatus.agent1}
            selectedAssetId={selectedAssetId}
            records={records}
            onToggleConnection={toggleConnection}
            activityLog={activityLog}
            showProgress={false}
            subtleConnection
          />
        </div>

        {/* Top right: Asset inspection + environment */}
        <div className="lg:col-span-4 space-y-6">
          <AssetInspectionCard asset={selectedAsset} />
          <EnvironmentalContext weather={weather} />
        </div>
      </main>

      <CriticalAlertModal alert={lastAlert} onDismiss={() => setLastAlert(null)} />
      <AlertToast alert={lastAlert} onDismiss={() => setLastAlert(null)} />

      <Footer />
    </>
  );
}

function AssetInspectionCard({ asset }: { asset: Asset | undefined }) {
  if (!asset) {
    return (
      <section className="border border-[#141414] p-6 rounded-sm bg-white/80 backdrop-blur-sm">
        <h2 className="font-serif italic text-lg mb-4">Asset Inspection</h2>
        <p className="text-sm text-[#141414]/50">No asset selected.</p>
      </section>
    );
  }

  return (
    <section className="border border-[#141414] p-6 rounded-sm bg-white/80 backdrop-blur-sm">
      <h2 className="font-serif italic text-lg mb-4">Asset Inspection</h2>
      <div className="space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#141414]/50">{asset.asset_id}</p>
          <p className="font-medium">{asset.name}</p>
        </div>
        <div className="space-y-2 pt-2 border-t border-[#141414]/10 text-xs">
          <div className="flex items-center gap-2">
            <MapPin size={12} className="shrink-0 opacity-50" />
            <span>{asset.location}</span>
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
        <div className="flex justify-between text-xs pt-2 border-t border-[#141414]/10">
          <span className="opacity-50">Type</span>
          <span className="font-medium">{asset.component_type}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="opacity-50">Material</span>
          <span className="font-medium">{asset.material}</span>
        </div>
      </div>
    </section>
  );
}
