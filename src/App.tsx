import { useState } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import {
  Header,
  AssetSelector,
  CameraFeed,
  AgentStatus,
  EnvironmentalContext,
  ReviewQueue,
  CriticalAlertModal,
  AlertToast,
  Footer,
} from './components';

const WEATHER = { temp: 28, humidity: 82, swell: 1.2 };

export default function App() {
  const [weather] = useState(WEATHER);
  const {
    isConnected,
    records,
    lastAlert,
    setLastAlert,
    assets,
    selectedAssetId,
    setSelectedAssetId,
    selectedAsset,
    isVerified,
    agentStatus,
    videoRef,
    toggleConnection,
  } = useLiveSession();

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      <Header
        isConnected={isConnected}
        selectedAssetId={selectedAssetId}
        onToggleConnection={toggleConnection}
      />

      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          {!isConnected && (
            <AssetSelector
              assets={assets}
              selectedAssetId={selectedAssetId}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAssetId}
            />
          )}

          {isConnected && (
            <CameraFeed
              ref={videoRef}
              isVerified={isVerified}
              selectedAssetId={selectedAsset?.asset_id}
            />
          )}

          <AgentStatus agent1={agentStatus.agent1} agent2={agentStatus.agent2} />
          <EnvironmentalContext weather={weather} />
        </div>

        <div className="lg:col-span-8">
          <ReviewQueue records={records} />
        </div>
      </main>

      <CriticalAlertModal alert={lastAlert} onDismiss={() => setLastAlert(null)} />
      <AlertToast alert={lastAlert} onDismiss={() => setLastAlert(null)} />

      <Footer />

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
