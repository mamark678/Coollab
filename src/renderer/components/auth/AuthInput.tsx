import { Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ElementType;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(({
  label,
  icon: Icon,
  type,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === 'password';
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col w-full">
      {/* Label - 11px, 0.08em tracking, 6px margin */}
      <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5 px-1">
        {label}
      </label>

      {/* Input wrapper - 10px radius, 0.04 bg, 0.1 border */}
      <div
        className="relative flex items-center rounded-[10px] transition-all duration-200"
        style={{
          background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
          border: isFocused
            ? '1px solid #7c3aed'
            : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(124, 58, 237, 0.2)'
            : 'none',
        }}
      >
        {/* Left icon */}
        <div
          className="absolute left-[16px] flex items-center pointer-events-none transition-colors duration-200"
          style={{ color: isFocused ? '#7c3aed' : 'rgba(255,255,255,0.2)' }}
        >
          <Icon size={16} strokeWidth={2} />
        </div>

        {/* Input - 12px 16px padding */}
        <input
          ref={ref}
          type={currentType}
          className="w-full bg-transparent text-white text-[14px] py-[12px] outline-none placeholder-white/10 font-medium"
          style={{
            paddingLeft: '46px',
            paddingRight: isPassword ? '46px' : '16px',
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {/* Eye toggle — password only */}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-[14px] flex items-center justify-center transition-colors duration-200"
            style={{ color: showPassword ? '#7c3aed' : 'rgba(255,255,255,0.2)' }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)')
            }
            onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              showPassword ? '#7c3aed' : 'rgba(255,255,255,0.2)')
            }
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={2} />
            ) : (
              <Eye size={16} strokeWidth={2} />
            )}
          </button>
        )}
      </div>
    </div>
  );
});

AuthInput.displayName = 'AuthInput';