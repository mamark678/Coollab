import React, { useMemo } from 'react';

interface PasswordStrengthMeterProps {
  password: string;
}

export function getStrength(password: string): { score: number; label: string; color: string; width: string } {
  if (password.length < 6) {
    return { score: 1, label: 'Too Short', color: '#e66b7a', width: '20%' };
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);

  // Very Strong: 10+ chars, uppercase + lowercase + numbers + special characters
  if (password.length >= 10 && hasUpper && hasLower && hasNumbers && hasSpecial) {
    return { score: 5, label: 'Very Strong', color: '#6dd49e', width: '100%' };
  }

  // Strong: 8+ chars, letters + numbers + 1 special character
  if (password.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
    return { score: 4, label: 'Strong', color: '#6dd49e', width: '80%' };
  }

  // Fair: 6+ chars, mixed letters and numbers
  if (hasLetters && hasNumbers) {
    return { score: 3, label: 'Fair', color: '#e6c96e', width: '60%' };
  }

  // Weak: 6+ chars, only letters or only numbers
  return { score: 2, label: 'Weak', color: '#e66b7a', width: '40%' };
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const strength = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="w-full h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: strength.width,
            backgroundColor: strength.color,
            boxShadow: `0 0 8px ${strength.color}40`
          }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-medium" style={{ color: strength.color }}>
          {strength.label}
        </span>
        <span className="text-[11px] text-[#4a4d5e]">{password.length} characters</span>
      </div>
    </div>
  );
};

