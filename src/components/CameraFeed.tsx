import { forwardRef } from 'react';
import { Camera, CheckCircle } from 'lucide-react';

interface CameraFeedProps {
  isVerified: boolean;
  selectedAssetId?: string;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  function CameraFeed({ isVerified, selectedAssetId }, ref) {
    return (
      <section className="border border-[#141414] p-4 rounded-sm bg-black relative overflow-hidden aspect-video shadow-lg">
        <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-sm border border-white/20">
              <Camera size={16} className="text-white" />
            </div>
            {isVerified && (
              <div className="bg-emerald-500 text-white px-2 py-1 rounded-sm text-[10px] font-mono flex items-center gap-1 shadow-lg">
                <CheckCircle size={10} /> VERIFIED: {selectedAssetId}
              </div>
            )}
          </div>
          <div className="w-full h-px bg-white/20 relative">
            <div className="absolute top-0 left-0 w-full h-full bg-emerald-400/50 animate-scan" />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-white/50 font-mono text-[8px] uppercase tracking-widest">Live Camera → Gemini (1 FPS)</p>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }
);
