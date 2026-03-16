import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { InspectionRecord } from '../constants';

interface AlertToastProps {
  alert: InspectionRecord | null;
  onDismiss: () => void;
}

export function AlertToast({ alert, onDismiss }: AlertToastProps) {
  return (
    <AnimatePresence>
      {alert && alert.category !== 'A' && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="fixed bottom-10 right-10 z-50 w-96 p-6 rounded-sm shadow-2xl border-l-8 border-white bg-amber-600 text-white"
      >
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white rounded-sm">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif italic text-xl">Category {alert.category} Alert</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest opacity-80 mt-1">Integrity Warning</p>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm border-b border-white/20 pb-1">
                <span>Asset:</span>
                <span className="font-bold">{alert.asset_id}</span>
              </div>
              <div className="text-sm border-b border-white/20 pb-1">
                <span className="block opacity-70">Verdict:</span>
                <span className="font-bold italic">{alert.verdict}</span>
              </div>
            </div>

            <button
              onClick={onDismiss}
              className="mt-6 w-full py-2 bg-white text-amber-600 font-bold text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
