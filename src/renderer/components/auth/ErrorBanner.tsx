import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
  error?: string | null;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium text-[#e66b7a]"
          style={{
            background: 'rgba(230, 107, 122, 0.08)',
            border: '1px solid rgba(230, 107, 122, 0.2)',
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="leading-snug text-[13px]">{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
