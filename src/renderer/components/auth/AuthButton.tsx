import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AuthButtonProps extends HTMLMotionProps<"button"> {
  loading?: boolean;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ loading, children, disabled, ...props }) => {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.01, filter: disabled || loading ? 'brightness(1)' : 'brightness(1.15)' }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      className="w-full relative flex items-center justify-center rounded-[10px] font-semibold text-white transition-all outline-none"
      style={{
        background: 'linear-gradient(135deg, #7c6bf0, #4ea1f7)',
        padding: '12px 16px',
        fontSize: '14.5px',
        letterSpacing: '0.01em',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 18px rgba(124,107,240,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.55 : 1,
      }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Processing...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
};
