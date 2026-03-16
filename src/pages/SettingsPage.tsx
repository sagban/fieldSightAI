import { Settings as SettingsIcon, Mic, Camera, Cpu } from 'lucide-react';

export function SettingsPage() {
  return (
    <>
      <header className="border-b border-[#141414] px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-serif italic text-xl">Settings</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
          Inspection and system preferences
        </p>
      </header>

      <main className="p-6 flex-1 max-w-2xl">
        <div className="space-y-6">
          <section className="border border-[#141414] p-6 rounded-sm bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Mic size={18} className="text-[#141414]" />
              <h2 className="font-serif italic text-lg">Audio</h2>
            </div>
            <p className="font-mono text-sm text-[#141414]/70">
              Microphone is used for voice input during live inspection. Permissions are requested when you start a session.
            </p>
          </section>

          <section className="border border-[#141414] p-6 rounded-sm bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Camera size={18} className="text-[#141414]" />
              <h2 className="font-serif italic text-lg">Camera</h2>
            </div>
            <p className="font-mono text-sm text-[#141414]/70">
              Camera feed is sent to Gemini at ~1 FPS during inspection for nameplate verification and context.
            </p>
          </section>

          <section className="border border-[#141414] p-6 rounded-sm bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-[#141414]" />
              <h2 className="font-serif italic text-lg">Model</h2>
            </div>
            <p className="font-mono text-sm text-[#141414]/70">
              FieldSight uses Gemini Live API with integrity analysis tools and file-search RAG. Configuration is set in the environment.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
