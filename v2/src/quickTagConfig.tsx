import React from 'react';
import { TagShape, QuickTagPreset } from './types';
export type { TagShape, QuickTagPreset };

export const DEFAULT_QUICK_TAG_PRESETS: QuickTagPreset[] = [
  {
    id: 'qt_1',
    key: '1',
    color: '#a855f7', // Mor (Purple)
    shape: 'circle', // Yuvarlak
    emoji: '😡',
    description: 'ekran hatası',
  },
  {
    id: 'qt_2',
    key: '2',
    color: '#ef4444', // Kırmızı (Red)
    shape: 'square', // Kare
    emoji: '🔊',
    description: 'cızırtı',
  },
  {
    id: 'qt_3',
    key: '3',
    color: '#f59e0b', // Amber / Sarı
    shape: 'triangle', // Üçgen
    emoji: '⚠️',
    description: 'donanım uyarısı',
  },
  {
    id: 'qt_4',
    key: '4',
    color: '#10b981', // Yeşil (Emerald)
    shape: 'pentagon', // Beşgen
    emoji: '✅',
    description: 'başarılı test',
  },
  {
    id: 'qt_5',
    key: '5',
    color: '#06b6d4', // Camgöbeği (Cyan)
    shape: 'diamond', // Elmas
    emoji: '⚡',
    description: 'voltaj dalgalanması',
  },
  {
    id: 'qt_6',
    key: '6',
    color: '#ec4899', // Pembe (Pink)
    shape: 'circle',
    emoji: '🐛',
    description: 'bellek sızıntısı',
  },
];

const STORAGE_KEY = 'esp32_quick_tag_presets';

export function loadQuickTagPresets(): QuickTagPreset[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load quick tag presets:', err);
  }
  return DEFAULT_QUICK_TAG_PRESETS;
}

export function saveQuickTagPresets(presets: QuickTagPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error('Failed to save quick tag presets:', err);
  }
}

interface TagShapeIconProps {
  shape: TagShape;
  color: string;
  emoji?: string;
  size?: number;
  className?: string;
  showEmojiInside?: boolean;
}

export const TagShapeIcon: React.FC<TagShapeIconProps> = ({
  shape,
  color,
  emoji,
  size = 20,
  className = '',
  showEmojiInside = true,
}) => {
  const renderShapeSvg = () => {
    switch (shape) {
      case 'circle':
        return <circle cx="12" cy="12" r="10" fill={color} />;
      case 'square':
        return <rect x="3" y="3" width="18" height="18" rx="3" fill={color} />;
      case 'triangle':
        return <polygon points="12,2 23,21 1,21" fill={color} />;
      case 'pentagon':
        return <polygon points="12,2 22,9 18,22 6,22 2,9" fill={color} />;
      case 'diamond':
        return <polygon points="12,2 22,12 12,22 2,12" fill={color} />;
      default:
        return <circle cx="12" cy="12" r="10" fill={color} />;
    }
  };

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
      >
        {renderShapeSvg()}
      </svg>
      {showEmojiInside && emoji && (
        <span
          style={{
            fontSize: `${Math.max(9, Math.round(size * 0.58))}px`,
            lineHeight: 1,
            marginTop: shape === 'triangle' ? '2px' : '0px',
          }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow"
        >
          {emoji}
        </span>
      )}
    </div>
  );
};
