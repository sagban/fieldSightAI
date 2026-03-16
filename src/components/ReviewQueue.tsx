import { motion, AnimatePresence } from 'motion/react';
import { Layers, History, Settings, Cpu, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { InspectionRecord } from '../constants';

interface ReviewQueueProps {
  records: InspectionRecord[];
}

export function ReviewQueue({ records }: ReviewQueueProps) {
  return (
    <section className="border border-[#141414] rounded-sm bg-white overflow-hidden flex flex-col h-full min-h-[600px] shadow-xl">
      <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#F9F9F8]">
        <div className="flex items-center gap-2">
          <Layers size={18} />
          <h2 className="font-serif italic text-lg">Engineering Review Queue</h2>
        </div>
        <div className="flex gap-2">
          <button className="p-2 border border-[#141414] rounded-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
            <History size={16} />
          </button>
          <button className="p-2 border border-[#141414] rounded-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-12 border-b border-[#141414] bg-[#E4E3E0]/30 font-mono text-[10px] uppercase tracking-widest p-4 sticky top-0 z-10 backdrop-blur-sm">
          <div className="col-span-1">TS</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-3">Health Metrics (UT/Pit/Coat)</div>
          <div className="col-span-1">Cat</div>
          <div className="col-span-3">Prescribed Action</div>
          <div className="col-span-2 text-right">Verdict</div>
        </div>

        <AnimatePresence initial={false}>
          {records.length === 0 ? (
            <div className="p-24 text-center space-y-4">
              <div className="flex justify-center">
                <Cpu size={48} className="opacity-10 animate-pulse" />
              </div>
              <p className="opacity-30 italic font-serif">No findings currently in review queue.</p>
              <p className="opacity-20 font-mono text-[10px]">Start an inspection to see Agent 2 verdicts here.</p>
            </div>
          ) : (
            records.map((record) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`grid grid-cols-12 p-4 border-b border-[#141414]/10 items-center hover:bg-[#141414] hover:text-[#E4E3E0] transition-all duration-200 group cursor-default ${
                  record.category === 'A' ? 'bg-red-50' : record.category === 'B' ? 'bg-amber-50' : ''
                }`}
              >
                <div className="col-span-1 font-mono text-[10px] opacity-60 group-hover:opacity-100">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="col-span-2 text-xs font-medium">
                  {record.location}
                  <p className="text-[8px] opacity-50 group-hover:opacity-100 uppercase tracking-tighter">{record.service_fluid}</p>
                </div>
                <div className="col-span-3">
                  <div className="flex gap-2 font-mono text-[10px]">
                    <span className="px-1 bg-blue-100 text-blue-700 rounded-sm group-hover:bg-blue-600 group-hover:text-white">UT: {record.min_thickness}mm</span>
                    <span className="px-1 bg-amber-100 text-amber-700 rounded-sm group-hover:bg-amber-600 group-hover:text-white">Pit: {record.max_pit_depth}mm</span>
                    <span className="px-1 bg-zinc-100 text-zinc-700 rounded-sm group-hover:bg-zinc-600 group-hover:text-white">{record.coating_condition}</span>
                  </div>
                  {record.has_cracks && <p className="text-[9px] text-red-600 font-bold mt-1 group-hover:text-white">CRACK DETECTED</p>}
                  {record.remaining_life_years != null && (
                    <p className={`text-[9px] mt-1 font-mono ${record.remaining_life_years < 0 ? 'text-red-600' : 'text-emerald-600'} group-hover:text-white`}>
                      Life: {record.remaining_life_years}yr
                    </p>
                  )}
                </div>
                <div className="col-span-1">
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full border ${
                    record.category === 'A'
                      ? 'border-red-500 text-red-600 bg-red-50 group-hover:bg-red-600 group-hover:text-white'
                      : record.category === 'B'
                      ? 'border-amber-500 text-amber-600 bg-amber-50 group-hover:bg-amber-600 group-hover:text-white'
                      : 'border-[#141414]/20 text-[#141414]/60 group-hover:border-white/40 group-hover:text-white'
                  }`}>
                    {record.category}
                  </span>
                </div>
                <div className="col-span-3 text-[11px] font-mono italic opacity-80 group-hover:opacity-100 pr-4">
                  {record.action}
                  <p className="text-[8px] mt-1 opacity-50 group-hover:opacity-100">Ref: {record.standard_cited}</p>
                </div>
                <div className="col-span-2 text-right flex justify-end items-center gap-2">
                  <div className="text-[9px] font-serif italic hidden group-hover:block opacity-70 max-w-[150px] truncate">{record.verdict}</div>
                  {record.category === 'A' ? (
                    <AlertTriangle size={14} className="text-red-600 group-hover:text-white" />
                  ) : record.category === 'B' ? (
                    <Info size={14} className="text-amber-600 group-hover:text-white" />
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-600 group-hover:text-white" />
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
