import React, { useState, useEffect } from 'react';
import { FilterPreset, I18nLanguage } from './types';
import { getTagThemeByIndex } from './filterColors';
import {
  X,
  Bookmark,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Target,
} from 'lucide-react';

const PRESETS_STORAGE_KEY = 'serial_filter_presets';

export const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'default_boot_wifi',
    name: 'ESP32 Boot & WiFi',
    tags: ['rst:0x', 'boot:', 'IP:'],
    triggerTags: ['WiFi Connected'],
    isVariableMode: false,
    matchCase: false,
    isRegex: false,
    createdAt: 1728000000000,
  },
  {
    id: 'default_errors',
    name: 'Hatalar & Uyarılar (Errors & Warnings)',
    tags: ['[E]', '[W]'],
    triggerTags: ['Guru Meditation', 'abort()'],
    isVariableMode: false,
    matchCase: false,
    isRegex: false,
    createdAt: 1728000000000,
  },
  {
    id: 'default_video_sync',
    name: 'Değişken Modu: Video & Sync',
    tags: ['fps > 10 ve sync = true', 'audio > 120'],
    triggerTags: [],
    isVariableMode: true,
    matchCase: false,
    isRegex: false,
    createdAt: 1728000000000,
  },
  {
    id: 'default_telemetry',
    name: 'Telemetri & Sensör Aralık',
    tags: ['temp > 24.6', 'gercek aralik'],
    triggerTags: [],
    isVariableMode: true,
    matchCase: false,
    isRegex: false,
    createdAt: 1728000000000,
  },
];

interface FilterPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
  currentTags: string[];
  currentTriggerTags?: string[];
  isVariableMode: boolean;
  matchCase: boolean;
  isRegex: boolean;
  onApplyPreset: (preset: FilterPreset, append: boolean) => void;
  onNotification: (msg: string) => void;
}

export const FilterPresetsModal: React.FC<FilterPresetsModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentTags,
  currentTriggerTags = [],
  isVariableMode,
  matchCase,
  isRegex,
  onApplyPreset,
  onNotification,
}) => {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const isTr = lang === 'tr';

  // Load presets from localStorage on open
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPresets(parsed);
          return;
        }
      }
      // Initialize with defaults if empty
      setPresets(DEFAULT_PRESETS);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
    } catch {
      setPresets(DEFAULT_PRESETS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrentAsPreset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = newPresetName.trim();
    if (!trimmedName) {
      onNotification(isTr ? 'Lütfen bir şablon adı girin.' : 'Please enter a preset name.');
      return;
    }

    const totalCount = currentTags.length + currentTriggerTags.length;
    if (totalCount === 0) {
      onNotification(
        isTr
          ? 'Kaydedilecek aktif filtre veya tetikleyici etiketi yok. Önce üst çubuğa etiketler ekleyin.'
          : 'No active filter or trigger tags to save. Add some tags in the toolbar first.'
      );
      return;
    }

    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      tags: [...currentTags],
      triggerTags: [...currentTriggerTags],
      isVariableMode,
      matchCase,
      isRegex,
      createdAt: Date.now(),
    };

    const updated = [newPreset, ...presets];
    setPresets(updated);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save presets:', err);
    }

    setNewPresetName('');
    onNotification(
      isTr
        ? `"${trimmedName}" filtre şablonu kaydedildi.`
        : `Filter preset "${trimmedName}" saved.`
    );
  };

  const handleDeletePreset = (id: string, name: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update presets:', err);
    }
    onNotification(
      isTr ? `"${name}" şablonu silindi.` : `Deleted preset "${name}".`
    );
  };

  const handleResetDefaults = () => {
    setPresets(DEFAULT_PRESETS);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
    } catch (err) {
      console.error('Failed to reset presets:', err);
    }
    onNotification(
      isTr ? 'Varsayılan şablonlar geri yüklendi.' : 'Reset to default presets.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141622] border border-[#2d3047] rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-[#cdd6f4]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#25283b] bg-[#1a1c2b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {isTr ? 'Kayıtlı Filtre Şablonları' : 'Filter Presets Manager'}
              </h2>
              <p className="text-[11px] text-[#6c7086]">
                {isTr
                  ? 'Filtre gruplarını isim vererek kaydedin, tek tıkla geri yükleyin'
                  : 'Save groups of filter tags by name and apply them with one click'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6c7086] hover:text-white hover:bg-[#25283b] rounded-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-[#a6adc8] leading-relaxed font-sans">
          {/* Section 1: Save Current Filter as Preset */}
          <div className="bg-[#0f111a] border border-[#23263b] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>{isTr ? 'Mevcut Filtreleri Kaydet' : 'Save Current Filters'}</span>
              </div>
              {currentTags.length > 0 && (
                <span className="text-[11px] text-cyan-400 font-mono">
                  {currentTags.length} {isTr ? 'aktif etiket' : 'active tags'}
                </span>
              )}
            </div>

            {/* Current Active Tags Preview */}
            {currentTags.length > 0 || currentTriggerTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#141622] border border-[#26283b] rounded-md">
                {/* Triggers first */}
                {currentTriggerTags.map((tag) => (
                  <span
                    key={`trig_${tag}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-rose-500/50 bg-rose-950/80 text-rose-300"
                    title={isTr ? 'Tetikleyici etiket' : 'Trigger tag'}
                  >
                    <Target className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>{tag}</span>
                  </span>
                ))}
                {/* Normal filter tags */}
                {currentTags.map((tag, idx) => {
                  const theme = getTagThemeByIndex(idx);
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${theme.pillClass}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                      <span>{tag}</span>
                    </span>
                  );
                })}
                {isVariableMode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40">
                    {'{x} Değişken'}
                  </span>
                )}
                {matchCase && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    Aa
                  </span>
                )}
                {isRegex && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    .*
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#6c7086] italic">
                {isTr
                  ? 'Şu anda üst filtre çubuğunda eklenmiş etiket veya tetikleyici bulunmuyor.'
                  : 'No filter tags or triggers are currently active in the top bar.'}
              </p>
            )}

            {/* Save Form */}
            <form onSubmit={handleSaveCurrentAsPreset} className="flex items-center gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={
                  isTr
                    ? 'Yeni şablon adı (örn: Video & Sensörler, ESP Boot)...'
                    : 'New preset name (e.g., Video & Sensors, ESP Boot)...'
                }
                disabled={currentTags.length === 0}
                className="flex-1 bg-[#161826] border border-[#2d3047] focus:border-amber-500/70 rounded-md px-3 py-1.5 text-xs text-[#cdd6f4] placeholder-[#45475a] outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={currentTags.length === 0 || !newPresetName.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium text-xs transition shadow-sm cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isTr ? 'Şablon Olarak Kaydet' : 'Save Preset'}</span>
              </button>
            </form>
          </div>

          {/* Section 2: Presets List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-xs flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>{isTr ? 'Kayıtlı Şablonlar' : 'Saved Presets'}</span>
                <span className="text-[10px] text-[#6c7086] font-mono">({presets.length})</span>
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-[#6c7086] hover:text-amber-400 flex items-center gap-1 cursor-pointer transition"
                title={isTr ? 'Varsayılan şablonları geri yükle' : 'Reset to default presets'}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isTr ? 'Varsayılanları Yükle' : 'Reset Defaults'}</span>
              </button>
            </div>

            {presets.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#26283b] rounded-lg text-[#6c7086]">
                <p>{isTr ? 'Henüz kayıtlı filtre şablonu bulunmuyor.' : 'No saved presets found.'}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 bg-[#0f111a] border border-[#23263b] hover:border-[#353852] rounded-lg transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{preset.name}</span>
                        {preset.isVariableMode && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40">
                            {'{x} Değişken'}
                          </span>
                        )}
                        {preset.matchCase && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                            Aa
                          </span>
                        )}
                        {preset.isRegex && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                            .*
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Apply Button */}
                        <button
                          type="button"
                          onClick={() => {
                            onApplyPreset(preset, false);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium transition cursor-pointer"
                          title={isTr ? 'Filtreleri bu şablonla değiştir' : 'Replace current filters with this preset'}
                        >
                          <Check className="w-3 h-3" />
                          <span>{isTr ? 'Yükle' : 'Apply'}</span>
                        </button>

                        {/* Append Button */}
                        <button
                          type="button"
                          onClick={() => {
                            onApplyPreset(preset, true);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e2030] hover:bg-[#282a3e] text-[#a6adc8] hover:text-white border border-[#313244] text-[11px] font-medium transition cursor-pointer"
                          title={isTr ? 'Bu etiketleri mevcut filtrelere ekle' : 'Append these tags to current filters'}
                        >
                          <Plus className="w-3 h-3 text-emerald-400" />
                          <span>{isTr ? '+ Ekle' : '+ Append'}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.id, preset.name)}
                          className="p-1 rounded text-[#6c7086] hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer ml-1"
                          title={isTr ? 'Şablonu sil' : 'Delete preset'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tag Pills Preview: Triggers first, then filters */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {preset.triggerTags && preset.triggerTags.map((tag) => (
                        <span
                          key={`preset_trig_${tag}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-rose-500/50 bg-rose-950/80 text-rose-300"
                          title={isTr ? 'Tetikleyici etiket' : 'Trigger tag'}
                        >
                          <Target className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{tag}</span>
                        </span>
                      ))}
                      {preset.tags.map((tag, idx) => {
                        const theme = getTagThemeByIndex(idx);
                        return (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${theme.pillClass}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: 'currentColor' }}
                            />
                            <span>{tag}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#25283b] bg-[#1a1c2b] flex items-center justify-between text-[11px] text-[#6c7086] shrink-0">
          <span>
            {isTr
              ? '💡 İpucu: Filtre etiketlerinin üzerine mouse ile geldiğinizde sadece o etiket gösterilir.'
              : '💡 Tip: Hovering over any filter tag pill temporarily isolates only that tag.'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-[#25283b] hover:bg-[#31344c] text-white transition cursor-pointer"
          >
            {isTr ? 'Kapat' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
