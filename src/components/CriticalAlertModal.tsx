import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { InspectionRecord } from '../constants';

interface CriticalAlertModalProps {
  alert: InspectionRecord | null;
  onDismiss: () => void;
}

export function CriticalAlertModal({ alert, onDismiss }: CriticalAlertModalProps) {
  return (
    <AnimatePresence>
      {alert && alert.category === 'A' && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-red-900/95 flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          className="bg-white rounded-sm p-8 max-w-lg w-full shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-600 rounded-sm">
              <AlertTriangle size={32} className="text-white" />
            </div>
            <div>
              <h2 className="font-serif italic text-2xl text-red-600">Category A — CRITICAL</h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mt-1">Immediate Action Required</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm border-b border-red-100 pb-2">
              <span className="text-red-400">Asset</span>
              <span className="font-bold">{alert.asset_id}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-red-100 pb-2">
              <span className="text-red-400">Location</span>
              <span className="font-bold">{alert.location}</span>
            </div>
            <div className="text-sm border-b border-red-100 pb-2">
              <span className="text-red-400 block mb-1">Verdict</span>
              <span className="font-bold italic">{alert.verdict}</span>
            </div>
            <div className="text-sm border-b border-red-100 pb-2">
              <span className="text-red-400 block mb-1">Prescribed Action</span>
              <span className="font-bold">{alert.action}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-400">Standard</span>
              <span className="font-mono text-xs">{alert.standard_cited}</span>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-full py-3 bg-red-600 text-white font-bold text-sm uppercase tracking-widest hover:bg-red-700 transition-colors rounded-sm"
          >
            Acknowledge Critical Finding
          </button>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
