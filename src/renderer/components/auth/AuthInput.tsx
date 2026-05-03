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
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label */}
      <label className="text-[12px] font-medium tracking-wide uppercase text-[#4a4d5e]">
        {label}
      </label>

      {/* Input wrapper */}
      <div
        className="relative flex items-center rounded-[10px] transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: isFocused
            ? '1px solid rgba(124,107,240,0.6)'
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(124,107,240,0.1), inset 0 1px 0 rgba(255,255,255,0.03)'
            : 'inset 0 1px 0 rgba(255,255,255,0.02)',
        }}
      >
        {/* Left icon */}
        <div
          className="absolute left-[13px] flex items-center pointer-events-none transition-colors duration-200"
          style={{ color: isFocused ? '#7c6bf0' : '#4a4d5e' }}
        >
          <Icon size={15} strokeWidth={1.75} />
        </div>

        {/* Input */}
        <input
          ref={ref}
          type={currentType}
          className="w-full bg-transparent text-[#e8eaf0] text-[13.5px] py-[11px] outline-none placeholder-[#2c2c3a]"
          style={{
            paddingLeft: '38px',
            paddingRight: isPassword ? '40px' : '14px',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.01em',
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
            className="absolute right-[12px] flex items-center justify-center transition-colors duration-200"
            style={{ color: showPassword ? '#7c6bf0' : '#4a4d5e' }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = '#a0a4b8')
            }
            onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              showPassword ? '#7c6bf0' : '#4a4d5e')
            }
          >
            {showPassword ? (
              <EyeOff size={15} strokeWidth={1.75} />
            ) : (
              <Eye size={15} strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>
    </div>
  );
});

AuthInput.displayName = 'AuthInput';