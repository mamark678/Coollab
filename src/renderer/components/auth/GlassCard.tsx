import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-[400px] rounded-2xl"
      style={{
        background: 'rgba(20, 20, 30, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        padding: '36px 32px',
      }}
    >
      {children}
    </motion.div>
  );
};
