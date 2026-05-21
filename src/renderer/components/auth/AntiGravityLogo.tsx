import React from 'react';
import logo from '../../assets/logo.png';

export const AntiGravityLogo: React.FC = () => (
  <div className="flex flex-col items-center gap-3 mb-8">
    <div className="flex items-center justify-center"
      style={{ 
        width: 64, 
        height: 64,
        padding: 4,
        background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
        borderRadius: 16,
        border: '1px  solid var(--theme-border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}>
      <img src={logo} alt="Coollab Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
    <div className="flex flex-col items-center">
      <span className="text-[1.6rem] font-bold text-[#e8eaf0] tracking-tight leading-none">Coollab</span>
      <span className="text-[11px] text-[#6b6f82] tracking-widest uppercase font-semibold mt-1.5 opacity-80">Your workspace. Elevated.</span>
    </div>
  </div>
);