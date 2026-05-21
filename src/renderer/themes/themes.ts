export interface Theme {
  id: string;
  name: string;
  category: string;
  tokens: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    onBackground: string;
    onSurface: string;
    onPrimary: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
}

export const themes: Theme[] = [
  // ── Default ────────────────────────────────────────────────────────────────────
  {
    id: 'coollab-classic', name: 'Coollab Classic', category: 'Default',
    tokens: {
      primary: '#7c3aed', secondary: '#a855f7', background: '#07070d', surface: '#1a1a2e',
      onBackground: '#e8eaf0', onSurface: '#e8eaf0', onPrimary: '#ffffff',
      textPrimary: '#e8eaf0', textSecondary: '#94a3b8', border: 'rgba(255, 255, 255, 0.08)', error: '#ef4444', success: '#10b981'
    }
  },

  // ── Nature & Elements ──────────────────────────────────────────────────────────
  {
    id: 'forest', name: 'Forest', category: 'Nature & Elements',
    tokens: {
      primary: '#2d6a4f', secondary: '#40916c', background: '#081c15', surface: '#1b4332',
      onBackground: '#d8f3dc', onSurface: '#d8f3dc', onPrimary: '#ffffff',
      textPrimary: '#d8f3dc', textSecondary: '#95d5b2', border: '#2d6a4f', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'ocean', name: 'Ocean', category: 'Nature & Elements',
    tokens: {
      primary: '#0077b6', secondary: '#00b4d8', background: '#03045e', surface: '#023e8a',
      onBackground: '#caf0f8', onSurface: '#caf0f8', onPrimary: '#ffffff',
      textPrimary: '#caf0f8', textSecondary: '#90e0ef', border: '#0077b6', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'desert', name: 'Desert', category: 'Nature & Elements',
    tokens: {
      primary: '#d4a373', secondary: '#faedcd', background: '#fefae0', surface: '#e9edc9',
      onBackground: '#4a3f35', onSurface: '#4a3f35', onPrimary: '#ffffff',
      textPrimary: '#4a3f35', textSecondary: '#6b5e52', border: '#ccd5ae', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'arctic', name: 'Arctic', category: 'Nature & Elements',
    tokens: {
      primary: '#48cae4', secondary: '#90e0ef', background: '#f8f9fa', surface: '#e9ecef',
      onBackground: '#212529', onSurface: '#212529', onPrimary: '#ffffff',
      textPrimary: '#212529', textSecondary: '#495057', border: '#dee2e6', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'volcanic', name: 'Volcanic', category: 'Nature & Elements',
    tokens: {
      primary: '#d00000', secondary: '#e85d04', background: '#03071e', surface: '#370617',
      onBackground: '#ffba08', onSurface: '#ffba08', onPrimary: '#ffffff',
      textPrimary: '#ffba08', textSecondary: '#faa307', border: '#6a040f', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'storm', name: 'Storm', category: 'Nature & Elements',
    tokens: {
      primary: '#4a4e69', secondary: '#9a8c98', background: '#22223b', surface: '#4a4e69',
      onBackground: '#f2e9e4', onSurface: '#f2e9e4', onPrimary: '#ffffff',
      textPrimary: '#f2e9e4', textSecondary: '#c9ada7', border: '#22223b', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'sakura', name: 'Sakura', category: 'Nature & Elements',
    tokens: {
      primary: '#ffb5a7', secondary: '#fcd5ce', background: '#fff0f3', surface: '#ffe5ec',
      onBackground: '#590d22', onSurface: '#590d22', onPrimary: '#590d22',
      textPrimary: '#590d22', textSecondary: '#800f2f', border: '#ffb5a7', error: '#c1121f', success: '#2b9348'
    }
  },
  {
    id: 'jungle', name: 'Jungle', category: 'Nature & Elements',
    tokens: {
      primary: '#0a5c36', secondary: '#183a1d', background: '#0e1c15', surface: '#14291e',
      onBackground: '#e1f4cb', onSurface: '#e1f4cb', onPrimary: '#ffffff',
      textPrimary: '#e1f4cb', textSecondary: '#b7d898', border: '#2a5a3b', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'meadow', name: 'Meadow', category: 'Nature & Elements',
    tokens: {
      primary: '#55a630', secondary: '#80b918', background: '#f7fff7', surface: '#eaebed',
      onBackground: '#002910', onSurface: '#002910', onPrimary: '#ffffff',
      textPrimary: '#002910', textSecondary: '#144525', border: '#aacc00', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'cavern', name: 'Cavern', category: 'Nature & Elements',
    tokens: {
      primary: '#6b705c', secondary: '#a5a58d', background: '#1c1b18', surface: '#2b2a26',
      onBackground: '#ffe8d6', onSurface: '#ffe8d6', onPrimary: '#ffffff',
      textPrimary: '#ffe8d6', textSecondary: '#cb997e', border: '#3e3c36', error: '#ef4444', success: '#10b981'
    }
  },

  // ── Time of Day / Weather ──────────────────────────────────────────────────────
  {
    id: 'sunrise', name: 'Sunrise', category: 'Time of Day / Weather',
    tokens: {
      primary: '#ff7b54', secondary: '#ffb26b', background: '#ffd56b', surface: '#ffe699',
      onBackground: '#3d1c00', onSurface: '#3d1c00', onPrimary: '#ffffff',
      textPrimary: '#3d1c00', textSecondary: '#7a3800', border: '#ffb26b', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'golden-hour', name: 'Golden Hour', category: 'Time of Day / Weather',
    tokens: {
      primary: '#d68c45', secondary: '#f4a261', background: '#2b1b11', surface: '#412918',
      onBackground: '#fefae0', onSurface: '#fefae0', onPrimary: '#ffffff',
      textPrimary: '#fefae0', textSecondary: '#e9c46a', border: '#e76f51', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'midnight', name: 'Midnight', category: 'Time of Day / Weather',
    tokens: {
      primary: '#4361ee', secondary: '#3a0ca3', background: '#0b090a', surface: '#161a1d',
      onBackground: '#f8f9fa', onSurface: '#f8f9fa', onPrimary: '#ffffff',
      textPrimary: '#f8f9fa', textSecondary: '#adb5bd', border: '#343a40', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'overcast', name: 'Overcast', category: 'Time of Day / Weather',
    tokens: {
      primary: '#6c757d', secondary: '#495057', background: '#e9ecef', surface: '#dee2e6',
      onBackground: '#212529', onSurface: '#212529', onPrimary: '#ffffff',
      textPrimary: '#212529', textSecondary: '#495057', border: '#ced4da', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'foggy-morning', name: 'Foggy Morning', category: 'Time of Day / Weather',
    tokens: {
      primary: '#a3b18a', secondary: '#588157', background: '#dad7cd', surface: '#e3e0d8',
      onBackground: '#344e41', onSurface: '#344e41', onPrimary: '#ffffff',
      textPrimary: '#344e41', textSecondary: '#3a5a40', border: '#bcc7bc', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'neon-dusk', name: 'Neon Dusk', category: 'Time of Day / Weather',
    tokens: {
      primary: '#f72585', secondary: '#7209b7', background: '#0d0221', surface: '#1f0d3d',
      onBackground: '#4cc9f0', onSurface: '#4cc9f0', onPrimary: '#ffffff',
      textPrimary: '#4cc9f0', textSecondary: '#4895ef', border: '#3f37c9', error: '#ff0054', success: '#00f5d4'
    }
  },
  {
    id: 'twilight', name: 'Twilight', category: 'Time of Day / Weather',
    tokens: {
      primary: '#7b2cbf', secondary: '#9d4edd', background: '#10002b', surface: '#240046',
      onBackground: '#e0aaff', onSurface: '#e0aaff', onPrimary: '#ffffff',
      textPrimary: '#e0aaff', textSecondary: '#c77dff', border: '#3c096c', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'solar-noon', name: 'Solar Noon', category: 'Time of Day / Weather',
    tokens: {
      primary: '#ffb703', secondary: '#fb8500', background: '#ffffff', surface: '#f8f9fa',
      onBackground: '#023047', onSurface: '#023047', onPrimary: '#ffffff',
      textPrimary: '#023047', textSecondary: '#219ebc', border: '#8ecae6', error: '#ef4444', success: '#10b981'
    }
  },

  // ── Aesthetics / Eras ──────────────────────────────────────────────────────────
  {
    id: 'retro-80s', name: 'Retro 80s', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#ff0054', secondary: '#3a0ca3', background: '#0b090a', surface: '#161a1d',
      onBackground: '#00f5d4', onSurface: '#00f5d4', onPrimary: '#ffffff',
      textPrimary: '#00f5d4', textSecondary: '#f15bb5', border: '#ff0054', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'y2k', name: 'Y2K', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#9b5de5', secondary: '#f15bb5', background: '#f8f9fa', surface: '#e9ecef',
      onBackground: '#00bbf9', onSurface: '#00bbf9', onPrimary: '#ffffff',
      textPrimary: '#00bbf9', textSecondary: '#00f5d4', border: '#fee440', error: '#dc2626', success: '#10b981'
    }
  },
  {
    id: 'vaporwave', name: 'Vaporwave', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#ff71ce', secondary: '#01cdfe', background: '#110022', surface: '#220033',
      onBackground: '#05ffa1', onSurface: '#05ffa1', onPrimary: '#ffffff',
      textPrimary: '#05ffa1', textSecondary: '#b967ff', border: '#ff71ce', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'synthwave', name: 'Synthwave', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#ff007f', secondary: '#00f0ff', background: '#0d0221', surface: '#261447',
      onBackground: '#f3e8ff', onSurface: '#f3e8ff', onPrimary: '#ffffff',
      textPrimary: '#f3e8ff', textSecondary: '#00f0ff', border: '#ff007f', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'brutalist', name: 'Brutalist', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#0000ff', secondary: '#ff0000', background: '#ffffff', surface: '#f0f0f0',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#333333', border: '#000000', error: '#ff0000', success: '#00cc00'
    }
  },
  {
    id: 'bauhaus', name: 'Bauhaus', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#d62828', secondary: '#003049', background: '#eae2b7', surface: '#fcbf49',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#333333', border: '#003049', error: '#d62828', success: '#059669'
    }
  },
  {
    id: 'art-deco', name: 'Art Deco', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#d4af37', secondary: '#c5a059', background: '#1c1c1c', surface: '#2c2c2c',
      onBackground: '#fafafa', onSurface: '#fafafa', onPrimary: '#1c1c1c',
      textPrimary: '#fafafa', textSecondary: '#d4af37', border: '#d4af37', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'minimalist', name: 'Minimalist', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#111827', secondary: '#374151', background: '#ffffff', surface: '#f9fafb',
      onBackground: '#111827', onSurface: '#111827', onPrimary: '#ffffff',
      textPrimary: '#111827', textSecondary: '#6b7280', border: '#e5e7eb', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'maximalist', name: 'Maximalist', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#e63946', secondary: '#1d3557', background: '#a8dadc', surface: '#f1faee',
      onBackground: '#1d3557', onSurface: '#1d3557', onPrimary: '#ffffff',
      textPrimary: '#1d3557', textSecondary: '#e63946', border: '#457b9d', error: '#e63946', success: '#10b981'
    }
  },
  {
    id: 'cottagecore', name: 'Cottagecore', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#dda15e', secondary: '#bc6c25', background: '#fefae0', surface: '#faedcd',
      onBackground: '#283618', onSurface: '#283618', onPrimary: '#ffffff',
      textPrimary: '#283618', textSecondary: '#606c38', border: '#e9edc9', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#fcee0a', secondary: '#00ff00', background: '#000000', surface: '#111111',
      onBackground: '#00ffff', onSurface: '#00ffff', onPrimary: '#000000',
      textPrimary: '#00ffff', textSecondary: '#ff0055', border: '#fcee0a', error: '#ff0055', success: '#00ff00'
    }
  },
  {
    id: 'steampunk', name: 'Steampunk', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#c46210', secondary: '#cd7f32', background: '#2c1e16', surface: '#412b23',
      onBackground: '#d8c3a5', onSurface: '#d8c3a5', onPrimary: '#ffffff',
      textPrimary: '#d8c3a5', textSecondary: '#e85a4f', border: '#8e8d8a', error: '#e98074', success: '#10b981'
    }
  },
  {
    id: 'lo-fi', name: 'Lo-fi', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#a28089', secondary: '#846a6a', background: '#f0e5e5', surface: '#e6d8d8',
      onBackground: '#4a4040', onSurface: '#4a4040', onPrimary: '#ffffff',
      textPrimary: '#4a4040', textSecondary: '#6e6262', border: '#d1c0c0', error: '#c87979', success: '#668a73'
    }
  },
  {
    id: 'glassmorphism', name: 'Glassmorphism', category: 'Aesthetics / Eras',
    tokens: {
      primary: 'rgba(255, 255, 255, 0.4)', secondary: 'rgba(255, 255, 255, 0.2)', background: '#1c1b29', surface: 'rgba(255, 255, 255, 0.1)',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#ffffff',
      textPrimary: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.7)', border: 'rgba(255, 255, 255, 0.2)', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'neumorphism', name: 'Neumorphism', category: 'Aesthetics / Eras',
    tokens: {
      primary: '#e0e5ec', secondary: '#a3b1c6', background: '#e0e5ec', surface: '#e0e5ec',
      onBackground: '#4d5b6b', onSurface: '#4d5b6b', onPrimary: '#4d5b6b',
      textPrimary: '#4d5b6b', textSecondary: '#6f839c', border: '#ffffff', error: '#ef4444', success: '#10b981'
    }
  },

  // ── Color Palettes ─────────────────────────────────────────────────────────────
  {
    id: 'monochrome', name: 'Monochrome', category: 'Color Palettes',
    tokens: {
      primary: '#000000', secondary: '#333333', background: '#ffffff', surface: '#f5f5f5',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#666666', border: '#cccccc', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'pastel', name: 'Pastel', category: 'Color Palettes',
    tokens: {
      primary: '#ffb3ba', secondary: '#ffdfba', background: '#ffffba', surface: '#baffc9',
      onBackground: '#4a4a4a', onSurface: '#4a4a4a', onPrimary: '#4a4a4a',
      textPrimary: '#4a4a4a', textSecondary: '#6b6b6b', border: '#bae1ff', error: '#ffb3ba', success: '#baffc9'
    }
  },
  {
    id: 'neon', name: 'Neon', category: 'Color Palettes',
    tokens: {
      primary: '#39ff14', secondary: '#f000ff', background: '#000000', surface: '#121212',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#000000',
      textPrimary: '#ffffff', textSecondary: '#0ff0fc', border: '#39ff14', error: '#f000ff', success: '#39ff14'
    }
  },
  {
    id: 'earth-tones', name: 'Earth Tones', category: 'Color Palettes',
    tokens: {
      primary: '#7d4f50', secondary: '#cc9b6d', background: '#f5ebe0', surface: '#e3d5ca',
      onBackground: '#4a3b32', onSurface: '#4a3b32', onPrimary: '#ffffff',
      textPrimary: '#4a3b32', textSecondary: '#806e62', border: '#d6ccc2', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'jewel-tones', name: 'Jewel Tones', category: 'Color Palettes',
    tokens: {
      primary: '#0b3c5d', secondary: '#328cc1', background: '#1d2731', surface: '#0b3c5d',
      onBackground: '#d9b310', onSurface: '#d9b310', onPrimary: '#ffffff',
      textPrimary: '#d9b310', textSecondary: '#328cc1', border: '#d9b310', error: '#900c3f', success: '#059669'
    }
  },
  {
    id: 'warm-neutrals', name: 'Warm Neutrals', category: 'Color Palettes',
    tokens: {
      primary: '#cb997e', secondary: '#eddcd2', background: '#fff1e6', surface: '#f0efeb',
      onBackground: '#6b705c', onSurface: '#6b705c', onPrimary: '#ffffff',
      textPrimary: '#6b705c', textSecondary: '#a5a58d', border: '#ddbea9', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'cool-grays', name: 'Cool Grays', category: 'Color Palettes',
    tokens: {
      primary: '#4b5563', secondary: '#6b7280', background: '#f3f4f6', surface: '#e5e7eb',
      onBackground: '#111827', onSurface: '#111827', onPrimary: '#ffffff',
      textPrimary: '#111827', textSecondary: '#374151', border: '#d1d5db', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'high-contrast', name: 'High Contrast', category: 'Color Palettes',
    tokens: {
      primary: '#000000', secondary: '#000000', background: '#ffffff', surface: '#ffffff',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#000000', border: '#000000', error: '#000000', success: '#000000'
    }
  },
  {
    id: 'duotone', name: 'Duotone', category: 'Color Palettes',
    tokens: {
      primary: '#ff3366', secondary: '#20b2aa', background: '#1a1a24', surface: '#2d2d3a',
      onBackground: '#f8f8f2', onSurface: '#f8f8f2', onPrimary: '#ffffff',
      textPrimary: '#f8f8f2', textSecondary: '#20b2aa', border: '#ff3366', error: '#ff3366', success: '#20b2aa'
    }
  },
  {
    id: 'sepia', name: 'Sepia', category: 'Color Palettes',
    tokens: {
      primary: '#704214', secondary: '#a0522d', background: '#f4ecd8', surface: '#e8dcb8',
      onBackground: '#4a2f1d', onSurface: '#4a2f1d', onPrimary: '#ffffff',
      textPrimary: '#4a2f1d', textSecondary: '#704214', border: '#d2b48c', error: '#8b0000', success: '#228b22'
    }
  },

  // ── Materials & Textures ───────────────────────────────────────────────────────
  {
    id: 'frosted-glass', name: 'Frosted Glass', category: 'Materials & Textures',
    tokens: {
      primary: 'rgba(255, 255, 255, 0.5)', secondary: 'rgba(255, 255, 255, 0.3)', background: '#a1c4fd', surface: 'rgba(255, 255, 255, 0.2)',
      onBackground: '#2d3748', onSurface: '#2d3748', onPrimary: '#2d3748',
      textPrimary: '#2d3748', textSecondary: 'rgba(45, 55, 72, 0.7)', border: 'rgba(255, 255, 255, 0.4)', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'matte-black', name: 'Matte Black', category: 'Materials & Textures',
    tokens: {
      primary: '#333333', secondary: '#1f1f1f', background: '#121212', surface: '#1a1a1a',
      onBackground: '#e0e0e0', onSurface: '#e0e0e0', onPrimary: '#ffffff',
      textPrimary: '#e0e0e0', textSecondary: '#a0a0a0', border: '#2c2c2c', error: '#ff4444', success: '#00cc66'
    }
  },
  {
    id: 'rose-gold', name: 'Rose Gold', category: 'Materials & Textures',
    tokens: {
      primary: '#b76e79', secondary: '#c07c88', background: '#fff0f5', surface: '#fce4ec',
      onBackground: '#4a3036', onSurface: '#4a3036', onPrimary: '#ffffff',
      textPrimary: '#4a3036', textSecondary: '#7a5a60', border: '#e6c8ce', error: '#d32f2f', success: '#388e3c'
    }
  },
  {
    id: 'carbon-fiber', name: 'Carbon Fiber', category: 'Materials & Textures',
    tokens: {
      primary: '#4c4c4c', secondary: '#333333', background: '#111111', surface: '#1e1e1e',
      onBackground: '#f0f0f0', onSurface: '#f0f0f0', onPrimary: '#ffffff',
      textPrimary: '#f0f0f0', textSecondary: '#a3a3a3', border: '#2a2a2a', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'marble', name: 'Marble', category: 'Materials & Textures',
    tokens: {
      primary: '#d4d4d4', secondary: '#e5e5e5', background: '#ffffff', surface: '#f8f8f8',
      onBackground: '#333333', onSurface: '#333333', onPrimary: '#1a1a1a',
      textPrimary: '#333333', textSecondary: '#666666', border: '#e0e0e0', error: '#d32f2f', success: '#2e7d32'
    }
  },
  {
    id: 'concrete', name: 'Concrete', category: 'Materials & Textures',
    tokens: {
      primary: '#9e9e9e', secondary: '#bdbdbd', background: '#e0e0e0', surface: '#eeeeee',
      onBackground: '#212121', onSurface: '#212121', onPrimary: '#ffffff',
      textPrimary: '#212121', textSecondary: '#616161', border: '#757575', error: '#c62828', success: '#2e7d32'
    }
  },
  {
    id: 'wood-grain', name: 'Wood Grain', category: 'Materials & Textures',
    tokens: {
      primary: '#8b5a2b', secondary: '#cd853f', background: '#f5deb3', surface: '#deb887',
      onBackground: '#3e2723', onSurface: '#3e2723', onPrimary: '#ffffff',
      textPrimary: '#3e2723', textSecondary: '#5d4037', border: '#d2b48c', error: '#d32f2f', success: '#2e7d32'
    }
  },
  {
    id: 'paper', name: 'Paper', category: 'Materials & Textures',
    tokens: {
      primary: '#e0d8c8', secondary: '#c8bda3', background: '#f4f1ea', surface: '#ebe5d9',
      onBackground: '#332d22', onSurface: '#332d22', onPrimary: '#332d22',
      textPrimary: '#332d22', textSecondary: '#5a5241', border: '#d3cebe', error: '#d32f2f', success: '#2e7d32'
    }
  },
  {
    id: 'velvet', name: 'Velvet', category: 'Materials & Textures',
    tokens: {
      primary: '#800020', secondary: '#a81c3a', background: '#2c040d', surface: '#4a0a19',
      onBackground: '#f3e8eb', onSurface: '#f3e8eb', onPrimary: '#ffffff',
      textPrimary: '#f3e8eb', textSecondary: '#e0b8c3', border: '#66001a', error: '#ff3333', success: '#33cc33'
    }
  },
  {
    id: 'chrome', name: 'Chrome', category: 'Materials & Textures',
    tokens: {
      primary: '#c0c0c0', secondary: '#dcdcdc', background: '#f5f5f5', surface: '#e8e8e8',
      onBackground: '#2d2d2d', onSurface: '#2d2d2d', onPrimary: '#1a1a1a',
      textPrimary: '#2d2d2d', textSecondary: '#5a5a5a', border: '#b0b0b0', error: '#d32f2f', success: '#2e7d32'
    }
  },

  // ── Space & Sci-Fi ─────────────────────────────────────────────────────────────
  {
    id: 'deep-space', name: 'Deep Space', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#1d2731', secondary: '#0b3c5d', background: '#000000', surface: '#0d1117',
      onBackground: '#c9d1d9', onSurface: '#c9d1d9', onPrimary: '#ffffff',
      textPrimary: '#c9d1d9', textSecondary: '#8b949e', border: '#30363d', error: '#f85149', success: '#2ea043'
    }
  },
  {
    id: 'nebula', name: 'Nebula', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#8a2be2', secondary: '#4b0082', background: '#1a0033', surface: '#2d004d',
      onBackground: '#e6ccff', onSurface: '#e6ccff', onPrimary: '#ffffff',
      textPrimary: '#e6ccff', textSecondary: '#b366ff', border: '#6600cc', error: '#ff3366', success: '#00fa9a'
    }
  },
  {
    id: 'lunar', name: 'Lunar', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#b0c4de', secondary: '#778899', background: '#1c1c1c', surface: '#2a2a2a',
      onBackground: '#f0f4f8', onSurface: '#f0f4f8', onPrimary: '#1c1c1c',
      textPrimary: '#f0f4f8', textSecondary: '#aab7c4', border: '#4a4a4a', error: '#ef4444', success: '#10b981'
    }
  },
  {
    id: 'galactic', name: 'Galactic', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#00f0ff', secondary: '#ff007f', background: '#050014', surface: '#0f002b',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#050014',
      textPrimary: '#ffffff', textSecondary: '#00f0ff', border: '#4a0080', error: '#ff007f', success: '#00ffaa'
    }
  },
  {
    id: 'holographic', name: 'Holographic', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#00ffcc', secondary: '#cc00ff', background: '#e0ffff', surface: '#f0ffff',
      onBackground: '#003366', onSurface: '#003366', onPrimary: '#003366',
      textPrimary: '#003366', textSecondary: '#006699', border: '#99ffff', error: '#ff3399', success: '#00cc66'
    }
  },
  {
    id: 'alien', name: 'Alien', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#39ff14', secondary: '#32cd32', background: '#001a00', surface: '#003300',
      onBackground: '#ccffcc', onSurface: '#ccffcc', onPrimary: '#001a00',
      textPrimary: '#ccffcc', textSecondary: '#66ff66', border: '#006600', error: '#ff0000', success: '#39ff14'
    }
  },
  {
    id: 'terraform', name: 'Terraform', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#cd5c5c', secondary: '#8b4513', background: '#2f1b1b', surface: '#472a2a',
      onBackground: '#f4a460', onSurface: '#f4a460', onPrimary: '#ffffff',
      textPrimary: '#f4a460', textSecondary: '#d2b48c', border: '#8b0000', error: '#ff4500', success: '#32cd32'
    }
  },
  {
    id: 'satellite', name: 'Satellite', category: 'Space & Sci-Fi',
    tokens: {
      primary: '#00bcd4', secondary: '#009688', background: '#263238', surface: '#37474f',
      onBackground: '#eceff1', onSurface: '#eceff1', onPrimary: '#ffffff',
      textPrimary: '#eceff1', textSecondary: '#b0bec5', border: '#455a64', error: '#f44336', success: '#4caf50'
    }
  },

  // ── Fantasy & Mythology ────────────────────────────────────────────────────────
  {
    id: 'enchanted', name: 'Enchanted', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#9370db', secondary: '#ba55d3', background: '#2d1b3d', surface: '#3c2452',
      onBackground: '#e6e6fa', onSurface: '#e6e6fa', onPrimary: '#ffffff',
      textPrimary: '#e6e6fa', textSecondary: '#dda0dd', border: '#4b0082', error: '#ff69b4', success: '#7cfc00'
    }
  },
  {
    id: 'dark-fantasy', name: 'Dark Fantasy', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#8b0000', secondary: '#5c0000', background: '#111111', surface: '#1a1a1a',
      onBackground: '#c0c0c0', onSurface: '#c0c0c0', onPrimary: '#ffffff',
      textPrimary: '#c0c0c0', textSecondary: '#808080', border: '#333333', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'elvish', name: 'Elvish', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#556b2f', secondary: '#8fbc8f', background: '#f5fffa', surface: '#e0eee0',
      onBackground: '#2f4f4f', onSurface: '#2f4f4f', onPrimary: '#ffffff',
      textPrimary: '#2f4f4f', textSecondary: '#4f7942', border: '#c1d7c1', error: '#cd5c5c', success: '#2e8b57'
    }
  },
  {
    id: 'nordic-runes', name: 'Nordic Runes', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#4682b4', secondary: '#5f9ea0', background: '#2c3e50', surface: '#34495e',
      onBackground: '#ecf0f1', onSurface: '#ecf0f1', onPrimary: '#ffffff',
      textPrimary: '#ecf0f1', textSecondary: '#bdc3c7', border: '#7f8c8d', error: '#e74c3c', success: '#2ecc71'
    }
  },
  {
    id: 'ancient-egypt', name: 'Ancient Egypt', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#ffd700', secondary: '#daa520', background: '#fdf5e6', surface: '#faebd7',
      onBackground: '#8b4513', onSurface: '#8b4513', onPrimary: '#8b4513',
      textPrimary: '#8b4513', textSecondary: '#a0522d', border: '#deb887', error: '#b22222', success: '#228b22'
    }
  },
  {
    id: 'samurai', name: 'Samurai', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#800000', secondary: '#a52a2a', background: '#1a1a1a', surface: '#2b2b2b',
      onBackground: '#f5f5dc', onSurface: '#f5f5dc', onPrimary: '#ffffff',
      textPrimary: '#f5f5dc', textSecondary: '#cd853f', border: '#4a4a4a', error: '#ff4500', success: '#3cb371'
    }
  },
  {
    id: 'druidic', name: 'Druidic', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#228b22', secondary: '#006400', background: '#1e2b1e', surface: '#2a3b2a',
      onBackground: '#e8f4e8', onSurface: '#e8f4e8', onPrimary: '#ffffff',
      textPrimary: '#e8f4e8', textSecondary: '#8fbc8f', border: '#3cb371', error: '#ff6347', success: '#32cd32'
    }
  },
  {
    id: 'arcane', name: 'Arcane', category: 'Fantasy & Mythology',
    tokens: {
      primary: '#00ced1', secondary: '#48d1cc', background: '#191970', surface: '#27278a',
      onBackground: '#e0ffff', onSurface: '#e0ffff', onPrimary: '#ffffff',
      textPrimary: '#e0ffff', textSecondary: '#afeeee', border: '#4169e1', error: '#ff1493', success: '#00fa9a'
    }
  },

  // ── Moods / Feelings ───────────────────────────────────────────────────────────
  {
    id: 'calm', name: 'Calm', category: 'Moods / Feelings',
    tokens: {
      primary: '#a2d2ff', secondary: '#bde0fe', background: '#f8f9fa', surface: '#e9ecef',
      onBackground: '#495057', onSurface: '#495057', onPrimary: '#ffffff',
      textPrimary: '#495057', textSecondary: '#6c757d', border: '#ced4da', error: '#ffb4a2', success: '#95d5b2'
    }
  },
  {
    id: 'focused', name: 'Focused', category: 'Moods / Feelings',
    tokens: {
      primary: '#212529', secondary: '#343a40', background: '#ffffff', surface: '#f8f9fa',
      onBackground: '#212529', onSurface: '#212529', onPrimary: '#ffffff',
      textPrimary: '#212529', textSecondary: '#495057', border: '#dee2e6', error: '#dc2626', success: '#059669'
    }
  },
  {
    id: 'playful', name: 'Playful', category: 'Moods / Feelings',
    tokens: {
      primary: '#ffbe0b', secondary: '#fb5607', background: '#ff006e', surface: '#8338ec',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#000000',
      textPrimary: '#ffffff', textSecondary: '#ffbe0b', border: '#3a86ff', error: '#ff006e', success: '#3a86ff'
    }
  },
  {
    id: 'bold', name: 'Bold', category: 'Moods / Feelings',
    tokens: {
      primary: '#e63946', secondary: '#1d3557', background: '#f1faee', surface: '#a8dadc',
      onBackground: '#1d3557', onSurface: '#1d3557', onPrimary: '#ffffff',
      textPrimary: '#1d3557', textSecondary: '#e63946', border: '#457b9d', error: '#e63946', success: '#1d3557'
    }
  },
  {
    id: 'mysterious', name: 'Mysterious', category: 'Moods / Feelings',
    tokens: {
      primary: '#301934', secondary: '#4a0e4e', background: '#120515', surface: '#220a29',
      onBackground: '#d8b4e2', onSurface: '#d8b4e2', onPrimary: '#ffffff',
      textPrimary: '#d8b4e2', textSecondary: '#a569bd', border: '#5b2c6f', error: '#e74c3c', success: '#2ecc71'
    }
  },
  {
    id: 'cozy', name: 'Cozy', category: 'Moods / Feelings',
    tokens: {
      primary: '#d4a373', secondary: '#faedcd', background: '#fefae0', surface: '#e9edc9',
      onBackground: '#606c38', onSurface: '#606c38', onPrimary: '#ffffff',
      textPrimary: '#606c38', textSecondary: '#283618', border: '#ccd5ae', error: '#d9534f', success: '#5cb85c'
    }
  },
  {
    id: 'energetic', name: 'Energetic', category: 'Moods / Feelings',
    tokens: {
      primary: '#ff5722', secondary: '#ff9800', background: '#fff3e0', surface: '#ffe0b2',
      onBackground: '#e65100', onSurface: '#e65100', onPrimary: '#ffffff',
      textPrimary: '#e65100', textSecondary: '#ef6c00', border: '#ffb74d', error: '#d32f2f', success: '#388e3c'
    }
  },
  {
    id: 'serene', name: 'Serene', category: 'Moods / Feelings',
    tokens: {
      primary: '#88d8b0', secondary: '#ffcc5c', background: '#ffffee', surface: '#ffeead',
      onBackground: '#ff6f69', onSurface: '#ff6f69', onPrimary: '#ffffff',
      textPrimary: '#ff6f69', textSecondary: '#96ceb4', border: '#ffcc5c', error: '#ff6f69', success: '#88d8b0'
    }
  },
  {
    id: 'dramatic', name: 'Dramatic', category: 'Moods / Feelings',
    tokens: {
      primary: '#000000', secondary: '#800000', background: '#1a1a1a', surface: '#2a2a2a',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#ffffff',
      textPrimary: '#ffffff', textSecondary: '#cccccc', border: '#4d4d4d', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'nostalgic', name: 'Nostalgic', category: 'Moods / Feelings',
    tokens: {
      primary: '#b5838d', secondary: '#e5989b', background: '#ffcdb2', surface: '#ffb4a2',
      onBackground: '#6d6875', onSurface: '#6d6875', onPrimary: '#ffffff',
      textPrimary: '#6d6875', textSecondary: '#b5838d', border: '#e5989b', error: '#d9534f', success: '#5cb85c'
    }
  },

  // ── Industry / Professional ────────────────────────────────────────────────────
  {
    id: 'terminal-hacker', name: 'Terminal/Hacker', category: 'Industry / Professional',
    tokens: {
      primary: '#00ff00', secondary: '#008000', background: '#000000', surface: '#111111',
      onBackground: '#00ff00', onSurface: '#00ff00', onPrimary: '#000000',
      textPrimary: '#00ff00', textSecondary: '#006600', border: '#003300', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'blueprint', name: 'Blueprint', category: 'Industry / Professional',
    tokens: {
      primary: '#ffffff', secondary: '#e0e0e0', background: '#1a5276', surface: '#2471a3',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#1a5276',
      textPrimary: '#ffffff', textSecondary: '#a9cce3', border: '#ffffff', error: '#ff9999', success: '#99ff99'
    }
  },
  {
    id: 'medical', name: 'Medical', category: 'Industry / Professional',
    tokens: {
      primary: '#00a8cc', secondary: '#005c97', background: '#f0f8ff', surface: '#e0f7fa',
      onBackground: '#003366', onSurface: '#003366', onPrimary: '#ffffff',
      textPrimary: '#003366', textSecondary: '#005c97', border: '#b2ebf2', error: '#e53935', success: '#43a047'
    }
  },
  {
    id: 'legal', name: 'Legal', category: 'Industry / Professional',
    tokens: {
      primary: '#1a252f', secondary: '#2c3e50', background: '#ecf0f1', surface: '#ffffff',
      onBackground: '#2c3e50', onSurface: '#2c3e50', onPrimary: '#ffffff',
      textPrimary: '#2c3e50', textSecondary: '#7f8c8d', border: '#bdc3c7', error: '#c0392b', success: '#27ae60'
    }
  },
  {
    id: 'finance', name: 'Finance', category: 'Industry / Professional',
    tokens: {
      primary: '#006400', secondary: '#228b22', background: '#f5f5f5', surface: '#ffffff',
      onBackground: '#333333', onSurface: '#333333', onPrimary: '#ffffff',
      textPrimary: '#333333', textSecondary: '#666666', border: '#cccccc', error: '#cc0000', success: '#006400'
    }
  },
  {
    id: 'editorial', name: 'Editorial', category: 'Industry / Professional',
    tokens: {
      primary: '#000000', secondary: '#333333', background: '#fdfdfd', surface: '#f4f4f4',
      onBackground: '#111111', onSurface: '#111111', onPrimary: '#ffffff',
      textPrimary: '#111111', textSecondary: '#555555', border: '#dddddd', error: '#d9534f', success: '#5cb85c'
    }
  },
  {
    id: 'newsprint', name: 'Newsprint', category: 'Industry / Professional',
    tokens: {
      primary: '#222222', secondary: '#444444', background: '#f4f0ec', surface: '#e9e5e1',
      onBackground: '#222222', onSurface: '#222222', onPrimary: '#ffffff',
      textPrimary: '#222222', textSecondary: '#555555', border: '#d3cfcb', error: '#cc0000', success: '#008800'
    }
  },
  {
    id: 'corporate-clean', name: 'Corporate Clean', category: 'Industry / Professional',
    tokens: {
      primary: '#0056b3', secondary: '#004085', background: '#ffffff', surface: '#f8f9fa',
      onBackground: '#212529', onSurface: '#212529', onPrimary: '#ffffff',
      textPrimary: '#212529', textSecondary: '#6c757d', border: '#dee2e6', error: '#dc3545', success: '#28a745'
    }
  },

  // ── Seasons ────────────────────────────────────────────────────────────────────
  {
    id: 'spring-bloom', name: 'Spring Bloom', category: 'Seasons',
    tokens: {
      primary: '#ff69b4', secondary: '#ffb6c1', background: '#f0fff0', surface: '#e0ffe0',
      onBackground: '#2e8b57', onSurface: '#2e8b57', onPrimary: '#ffffff',
      textPrimary: '#2e8b57', textSecondary: '#3cb371', border: '#ffb6c1', error: '#ff4500', success: '#32cd32'
    }
  },
  {
    id: 'summer-heat', name: 'Summer Heat', category: 'Seasons',
    tokens: {
      primary: '#ff8c00', secondary: '#ffa500', background: '#ffffe0', surface: '#fffacd',
      onBackground: '#8b4500', onSurface: '#8b4500', onPrimary: '#ffffff',
      textPrimary: '#8b4500', textSecondary: '#cd853f', border: '#ffd700', error: '#ff0000', success: '#008000'
    }
  },
  {
    id: 'autumn-harvest', name: 'Autumn Harvest', category: 'Seasons',
    tokens: {
      primary: '#d2691e', secondary: '#8b4513', background: '#fff8dc', surface: '#ffebcd',
      onBackground: '#5c4033', onSurface: '#5c4033', onPrimary: '#ffffff',
      textPrimary: '#5c4033', textSecondary: '#a0522d', border: '#deb887', error: '#b22222', success: '#228b22'
    }
  },
  {
    id: 'winter-frost', name: 'Winter Frost', category: 'Seasons',
    tokens: {
      primary: '#87ceeb', secondary: '#add8e6', background: '#f0f8ff', surface: '#e6f2ff',
      onBackground: '#1e90ff', onSurface: '#1e90ff', onPrimary: '#ffffff',
      textPrimary: '#1e90ff', textSecondary: '#4682b4', border: '#b0e0e6', error: '#cd5c5c', success: '#3cb371'
    }
  },

  // ── Pop Culture ────────────────────────────────────────────────────────────────
  {
    id: 'pixel-art', name: 'Pixel Art / 8-bit', category: 'Pop Culture',
    tokens: {
      primary: '#ff0000', secondary: '#0000ff', background: '#000000', surface: '#333333',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#ffffff',
      textPrimary: '#ffffff', textSecondary: '#cccccc', border: '#ffff00', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'comic-book', name: 'Comic Book', category: 'Pop Culture',
    tokens: {
      primary: '#ed1d24', secondary: '#fdf41c', background: '#ffffff', surface: '#f0f0f0',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#333333', border: '#000000', error: '#ed1d24', success: '#4caf50'
    }
  },
  {
    id: 'anime', name: 'Anime', category: 'Pop Culture',
    tokens: {
      primary: '#ff7eb3', secondary: '#ff758c', background: '#fff0f5', surface: '#ffe4e1',
      onBackground: '#4a0e4e', onSurface: '#4a0e4e', onPrimary: '#ffffff',
      textPrimary: '#4a0e4e', textSecondary: '#ff7eb3', border: '#ffb6c1', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'noir', name: 'Noir', category: 'Pop Culture',
    tokens: {
      primary: '#000000', secondary: '#333333', background: '#111111', surface: '#222222',
      onBackground: '#e0e0e0', onSurface: '#e0e0e0', onPrimary: '#ffffff',
      textPrimary: '#e0e0e0', textSecondary: '#888888', border: '#555555', error: '#ff3333', success: '#33ff33'
    }
  },
  {
    id: 'western', name: 'Western', category: 'Pop Culture',
    tokens: {
      primary: '#8b4513', secondary: '#a0522d', background: '#f4a460', surface: '#deb887',
      onBackground: '#3e2723', onSurface: '#3e2723', onPrimary: '#ffffff',
      textPrimary: '#3e2723', textSecondary: '#5d4037', border: '#8b4513', error: '#b22222', success: '#2e8b57'
    }
  },
  {
    id: 'arcade-cabinet', name: 'Arcade Cabinet', category: 'Pop Culture',
    tokens: {
      primary: '#ff00ff', secondary: '#00ffff', background: '#111111', surface: '#222222',
      onBackground: '#ffff00', onSurface: '#ffff00', onPrimary: '#000000',
      textPrimary: '#ffff00', textSecondary: '#ff00ff', border: '#00ffff', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'glitch-art', name: 'Glitch Art', category: 'Pop Culture',
    tokens: {
      primary: '#00ffff', secondary: '#ff00ff', background: '#000000', surface: '#1a1a1a',
      onBackground: '#ffffff', onSurface: '#ffffff', onPrimary: '#000000',
      textPrimary: '#ffffff', textSecondary: '#cccccc', border: '#ff00ff', error: '#ff0000', success: '#00ff00'
    }
  },

  // ── Luxury & Premium ───────────────────────────────────────────────────────────
  {
    id: 'black-tie', name: 'Black Tie', category: 'Luxury & Premium',
    tokens: {
      primary: '#1a1a1a', secondary: '#333333', background: '#ffffff', surface: '#f5f5f5',
      onBackground: '#000000', onSurface: '#000000', onPrimary: '#ffffff',
      textPrimary: '#000000', textSecondary: '#666666', border: '#e0e0e0', error: '#d32f2f', success: '#2e7d32'
    }
  },
  {
    id: 'monaco', name: 'Monaco', category: 'Luxury & Premium',
    tokens: {
      primary: '#ce1126', secondary: '#ffffff', background: '#fdfdfd', surface: '#f4f4f4',
      onBackground: '#1a1a1a', onSurface: '#1a1a1a', onPrimary: '#ffffff',
      textPrimary: '#1a1a1a', textSecondary: '#555555', border: '#ce1126', error: '#ce1126', success: '#2e7d32'
    }
  },
  {
    id: 'penthouse', name: 'Penthouse', category: 'Luxury & Premium',
    tokens: {
      primary: '#2c3e50', secondary: '#34495e', background: '#ecf0f1', surface: '#ffffff',
      onBackground: '#2c3e50', onSurface: '#2c3e50', onPrimary: '#ffffff',
      textPrimary: '#2c3e50', textSecondary: '#7f8c8d', border: '#bdc3c7', error: '#e74c3c', success: '#27ae60'
    }
  },
  {
    id: 'yacht-club', name: 'Yacht Club', category: 'Luxury & Premium',
    tokens: {
      primary: '#002366', secondary: '#003399', background: '#f0f8ff', surface: '#ffffff',
      onBackground: '#001a4d', onSurface: '#001a4d', onPrimary: '#ffffff',
      textPrimary: '#001a4d', textSecondary: '#002366', border: '#b0c4de', error: '#cc0000', success: '#008800'
    }
  },
  {
    id: 'champagne', name: 'Champagne', category: 'Luxury & Premium',
    tokens: {
      primary: '#f7e7ce', secondary: '#fad6a5', background: '#fffdf9', surface: '#fdf5e6',
      onBackground: '#5c4e3a', onSurface: '#5c4e3a', onPrimary: '#5c4e3a',
      textPrimary: '#5c4e3a', textSecondary: '#8b7e66', border: '#e8d8c3', error: '#b22222', success: '#228b22'
    }
  },
  {
    id: 'private-members', name: 'Private Members', category: 'Luxury & Premium',
    tokens: {
      primary: '#004b49', secondary: '#006663', background: '#0a1413', surface: '#122220',
      onBackground: '#d4af37', onSurface: '#d4af37', onPrimary: '#ffffff',
      textPrimary: '#d4af37', textSecondary: '#a38a2e', border: '#263b39', error: '#d9534f', success: '#5cb85c'
    }
  },

  // ── Girly & Feminine ───────────────────────────────────────────────────────────
  {
    id: 'bubblegum', name: 'Bubblegum', category: 'Girly & Feminine',
    tokens: {
      primary: '#ff69b4', secondary: '#ff85c1', background: '#ffe6f2', surface: '#ffccdf',
      onBackground: '#cc0066', onSurface: '#cc0066', onPrimary: '#ffffff',
      textPrimary: '#cc0066', textSecondary: '#ff1493', border: '#ffb3d1', error: '#ff0000', success: '#00cc66'
    }
  },
  {
    id: 'coquette', name: 'Coquette', category: 'Girly & Feminine',
    tokens: {
      primary: '#ffb6c1', secondary: '#ffc0cb', background: '#fff0f5', surface: '#ffe4e1',
      onBackground: '#8b0a50', onSurface: '#8b0a50', onPrimary: '#8b0a50',
      textPrimary: '#8b0a50', textSecondary: '#cd1076', border: '#ffb6c1', error: '#d32f2f', success: '#388e3c'
    }
  },
  {
    id: 'kawaii', name: 'Kawaii', category: 'Girly & Feminine',
    tokens: {
      primary: '#ff99cc', secondary: '#ffb3e6', background: '#ffffff', surface: '#fff0f5',
      onBackground: '#660033', onSurface: '#660033', onPrimary: '#ffffff',
      textPrimary: '#660033', textSecondary: '#ff66b2', border: '#ffcce6', error: '#ff0000', success: '#00cc00'
    }
  },
  {
    id: 'balletcore', name: 'Balletcore', category: 'Girly & Feminine',
    tokens: {
      primary: '#fadadd', secondary: '#fde6e9', background: '#fffafb', surface: '#fdf5f6',
      onBackground: '#5a3d42', onSurface: '#5a3d42', onPrimary: '#5a3d42',
      textPrimary: '#5a3d42', textSecondary: '#8d6e73', border: '#f0ced3', error: '#cc3333', success: '#339966'
    }
  },
  {
    id: 'soft-girl', name: 'Soft Girl', category: 'Girly & Feminine',
    tokens: {
      primary: '#b5e2fa', secondary: '#eddea4', background: '#f9f9f9', surface: '#ffffff',
      onBackground: '#5c5c5c', onSurface: '#5c5c5c', onPrimary: '#5c5c5c',
      textPrimary: '#5c5c5c', textSecondary: '#a5a5a5', border: '#e8e8e8', error: '#f2a65a', success: '#7bdff2'
    }
  },
  {
    id: 'dollhouse', name: 'Dollhouse', category: 'Girly & Feminine',
    tokens: {
      primary: '#fcb9aa', secondary: '#ffdfd3', background: '#fdf6f5', surface: '#fcebe8',
      onBackground: '#7b4b4b', onSurface: '#7b4b4b', onPrimary: '#ffffff',
      textPrimary: '#7b4b4b', textSecondary: '#a67c7c', border: '#f6d5d5', error: '#e57373', success: '#81c784'
    }
  },
  {
    id: 'hot-pink', name: 'Hot Pink', category: 'Girly & Feminine',
    tokens: {
      primary: '#ff1493', secondary: '#ff69b4', background: '#1a0512', surface: '#2d0a1f',
      onBackground: '#ffe6f3', onSurface: '#ffe6f3', onPrimary: '#ffffff',
      textPrimary: '#ffe6f3', textSecondary: '#ff99cc', border: '#4d1136', error: '#ff0000', success: '#00ff00'
    }
  },
  {
    id: 'unicorn', name: 'Unicorn', category: 'Girly & Feminine',
    tokens: {
      primary: '#c4a1ff', secondary: '#ffb3ff', background: '#f5f0ff', surface: '#ffffff',
      onBackground: '#4b0082', onSurface: '#4b0082', onPrimary: '#ffffff',
      textPrimary: '#4b0082', textSecondary: '#9932cc', border: '#e6ccff', error: '#ff0066', success: '#00cc99'
    }
  },
  {
    id: 'cotton-candy', name: 'Cotton Candy', category: 'Girly & Feminine',
    tokens: {
      primary: '#ffb3ba', secondary: '#baffc9', background: '#ffffff', surface: '#bae1ff',
      onBackground: '#333333', onSurface: '#333333', onPrimary: '#333333',
      textPrimary: '#333333', textSecondary: '#666666', border: '#ffffba', error: '#ffb3ba', success: '#baffc9'
    }
  },
  {
    id: 'blush-rose', name: 'Blush Rose', category: 'Girly & Feminine',
    tokens: {
      primary: '#e6a8d7', secondary: '#f2c1e7', background: '#fff5fb', surface: '#fcebf6',
      onBackground: '#5c2d4e', onSurface: '#5c2d4e', onPrimary: '#ffffff',
      textPrimary: '#5c2d4e', textSecondary: '#8a567a', border: '#edcce2', error: '#d9534f', success: '#5cb85c'
    }
  },
  {
    id: 'dark-feminine', name: 'Dark Feminine', category: 'Girly & Feminine',
    tokens: {
      primary: '#800020', secondary: '#4a0013', background: '#0d0d0d', surface: '#1a1a1a',
      onBackground: '#e6e6e6', onSurface: '#e6e6e6', onPrimary: '#ffffff',
      textPrimary: '#e6e6e6', textSecondary: '#999999', border: '#333333', error: '#ff3333', success: '#33cc33'
    }
  },
  {
    id: 'barbie', name: 'Barbie', category: 'Girly & Feminine',
    tokens: {
      primary: '#e0218a', secondary: '#f9429e', background: '#ffffff', surface: '#ffebf5',
      onBackground: '#4a092d', onSurface: '#4a092d', onPrimary: '#ffffff',
      textPrimary: '#4a092d', textSecondary: '#e0218a', border: '#ffb6db', error: '#d32f2f', success: '#388e3c'
    }
  }
];

// Runtime validation of themes to prevent regressions during development
if (process.env.NODE_ENV !== 'production') {
  const requiredTokens = [
    'primary', 'secondary', 'background', 'surface',
    'onBackground', 'onSurface', 'onPrimary',
    'textPrimary', 'textSecondary', 'border', 'error', 'success'
  ];
  for (const theme of themes) {
    for (const token of requiredTokens) {
      if (!theme.tokens || !theme.tokens[token as keyof typeof theme.tokens]) {
        console.warn(`[Theme Warning] Theme "${theme.name}" (${theme.id}) is missing token "${token}".`);
      }
    }
  }
}

