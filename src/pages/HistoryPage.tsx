import { Layers, FileSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HistoryPage() {
  return (
    <>
      <header className="border-b border-[#141414] px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-serif italic text-xl">Inspection History</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
          Past integrity analyses and review queue exports
        </p>
      </header>

      <main className="p-6 flex-1">
        <div className="border border-[#141414] rounded-sm bg-white p-16 text-center max-w-xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[#E4E3E0] rounded-sm">
              <Layers size={48} className="text-[#141414]/60" />
            </div>
          </div>
          <h2 className="font-serif italic text-lg mb-2">History</h2>
          <p className="font-mono text-sm text-[#141414]/70 mb-8">
            View and export past inspection records. Run an inspection to populate the queue, then revisit findings here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-full font-medium text-sm hover:bg-[#141414]/90 transition-colors no-underline"
          >
            <FileSearch size={16} /> Go to Inspection
          </Link>
        </div>
      </main>
    </>
  );
}
