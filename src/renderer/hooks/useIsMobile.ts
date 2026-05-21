import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    return Capacitor.isNativePlatform() || window.innerWidth < 640;
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return; // Always mobile on native

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};
