import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AuthButtonProps extends HTMLMotionProps<"button"> {
  loading?: boolean;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ loading, children, disabled, ...props }) => {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      className="w-full relative flex items-center justify-center rounded-[10px] font-semibold text-white transition-all outline-none"
      style={{
        background: 'var(--theme-primary)',
        padding: '13px 20px',
        fontSize: '15px',
        letterSpacing: '0.01em',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) e.currentTarget.style.background = '#6d28d9';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) e.currentTarget.style.background = '#7c3aed';
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
