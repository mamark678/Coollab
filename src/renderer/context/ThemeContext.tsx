import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { themes, Theme } from '../themes/themes';
import { Capacitor } from '@capacitor/core';

interface ThemeContextType {
  activeTheme: Theme;
  setTheme: (themeId: string) => void;
  themesList: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to determine if a hex color is dark
const isDark = (hex: string) => {
  // Convert hex to rgb
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeThemeId, setActiveThemeId] = useState<string>('coollab-classic');

  useEffect(() => {
    // Load saved theme on mount
    const saved = localStorage.getItem('collab-notes-theme');
    if (saved && themes.find((t) => t.id === saved)) {
      setActiveThemeId(saved);
    }
  }, []);

  const activeTheme = useMemo(() => {
    return themes.find((t) => t.id === activeThemeId) || themes[2] || themes[0]; // fallback to midnight or first
  }, [activeThemeId]);

  const setTheme = (themeId: string) => {
    if (themes.find((t) => t.id === themeId)) {
      setActiveThemeId(themeId);
      localStorage.setItem('collab-notes-theme', themeId);
    }
  };

  useEffect(() => {
    // Apply theme to :root
    const root = document.documentElement;
    const tokens = activeTheme.tokens;

    // Set new dynamic tokens
    root.style.setProperty('--theme-primary', tokens.primary);
    root.style.setProperty('--theme-secondary', tokens.secondary);
    root.style.setProperty('--theme-background', tokens.background);
    root.style.setProperty('--theme-surface', tokens.surface);
    root.style.setProperty('--theme-on-background', tokens.onBackground);
    root.style.setProperty('--theme-on-surface', tokens.onSurface);
    root.style.setProperty('--theme-on-primary', tokens.onPrimary);
    root.style.setProperty('--theme-text-primary', tokens.textPrimary);
    root.style.setProperty('--theme-text-secondary', tokens.textSecondary);
    root.style.setProperty('--theme-border', tokens.border);
    root.style.setProperty('--theme-error', tokens.error);
    root.style.setProperty('--theme-success', tokens.success);

    // Provide legacy mappings to ensure existing UI isn't completely broken while we migrate
    root.style.setProperty('--surface-crust', tokens.background);
    root.style.setProperty('--surface-mantle', tokens.surface);
    root.style.setProperty('--surface-base', tokens.background);
    root.style.setProperty('--surface-card', tokens.surface);
    root.style.setProperty('--surface-raised', tokens.surface);
    root.style.setProperty('--surface-overlay', tokens.border);

    root.style.setProperty('--text-primary', tokens.textPrimary);
    root.style.setProperty('--text-secondary', tokens.textSecondary);
    root.style.setProperty('--text-muted', tokens.textSecondary);
    root.style.setProperty('--text-faint', tokens.border);

    root.style.setProperty('--accent-primary', tokens.primary);
    root.style.setProperty('--accent-primary-hover', tokens.secondary);
    root.style.setProperty('--accent-secondary', tokens.secondary);

    root.style.setProperty('--status-success', tokens.success);
    root.style.setProperty('--status-error', tokens.error);
    root.style.setProperty('--border-primary', tokens.border);

    // Handle Capacitor StatusBar Native Theming
    if (Capacitor.isNativePlatform()) {
      // Use a variable to prevent Vite from trying to resolve this static path at build-time
      const statusBarPkg = '@capacitor/status-bar';
      // @ts-ignore
      import(/* @vite-ignore */ statusBarPkg).then(({ StatusBar, Style }) => {
        const isDarkTheme = isDark(tokens.background);
        StatusBar.setStyle({ style: isDarkTheme ? Style.Dark : Style.Light }).catch((e: any) => {
            console.log('Status bar style set failed or not supported', e);
        });
        StatusBar.setBackgroundColor({ color: tokens.background }).catch((e: any) => {
            console.log('Status bar background set failed or not supported', e);
        });
      }).catch((e: any) => {
        console.log('@capacitor/status-bar not installed or unavailable');
      });
    }

  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{ activeTheme, setTheme, themesList: themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
