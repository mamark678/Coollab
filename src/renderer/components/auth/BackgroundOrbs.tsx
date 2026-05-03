import React from 'react';
import { motion } from 'framer-motion';

export const BackgroundOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-gradient-to-br from-[#0b0b12] via-[#0d0d18] to-[#0f0b1a]">
      <motion.div
        animate={{
          y: [-20, 30, -20],
          x: [-20, 20, -20],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#7c6bf0]/20 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{
          y: [30, -30, 30],
          x: [20, -20, 20],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#4ea1f7]/15 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          y: [-15, 25, -15],
          x: [15, -25, 15],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-[30%] left-[60%] w-[400px] h-[400px] bg-[#7c6bf0]/8 rounded-full blur-[90px]"
      />
      <motion.div
        animate={{
          y: [20, -20, 20],
          x: [-30, 30, -30],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute bottom-[20%] left-[10%] w-[450px] h-[450px] bg-[#4ea1f7]/8 rounded-full blur-[100px]"
      />
    </div>
  );
};
