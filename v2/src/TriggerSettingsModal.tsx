import React, { useState } from 'react';
import { TriggerActionsConfig, AutoNamingConfig, I18nLanguage, QuickTagPreset, TagShape } from './types';
import { playTriggerSound } from './triggerActions';
import { loadQuickTagPresets, saveQuickTagPresets, DEFAULT_QUICK_TAG_PRESETS, TagShapeIcon } from './quickTagConfig';
import { t } from './i18n';
import { invoke } from '@tauri-apps/api/core';
import {
  Target,
  Bell,
  Globe,
  RotateCcw,
  Send,
  PowerOff,
  Tag,
  Database,
  X,
  Volume2,
  Check,
  Plus,
  Layers,
  Sparkles,
  Clock,
  Palette,
  Trash2,
} from 'lucide-react';

interface TriggerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
  triggerConfig: TriggerActionsConfig;
  onUpdateTriggerConfig: (config: TriggerActionsConfig) => void;
  autoNaming: AutoNamingConfig;
  onUpdateAutoNaming: (config: AutoNamingConfig) => void;
  maxLogCapacity: number;
  onUpdateMaxLogCapacity: (cap: number) => void;
  defaultAutoCloseSec?: number;
  onUpdateDefaultAutoCloseSec?: (sec: number) => void;
  onBulkAddFilters: (filters: string[], isTrigger: boolean) => void;
  onNotification: (msg: string) => void;
}

const CAPACITY_PRESETS = [1000, 2500, 5000, 10000, 25000, 50000];

export const TriggerSettingsModal: React.FC<TriggerSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  triggerConfig,
  onUpdateTriggerConfig,
  autoNaming,
  onUpdateAutoNaming,
  maxLogCapacity,
  onUpdateMaxLogCapacity,
  defaultAutoCloseSec = 30,
  onUpdateDefaultAutoCloseSec,
  onBulkAddFilters,
  onNotification,
}) => {
  const [bulkInput, setBulkInput] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [quickTagPresets, setQuickTagPresets] = useState<QuickTagPreset[]>(() => loadQuickTagPresets());

  const handleUpdatePreset = (id: string, updates: Partial<QuickTagPreset>) => {
    const next = quickTagPresets.map((p) => (p.id === id ? { ...p, ...updates } : p));
    setQuickTagPresets(next);
    saveQuickTagPresets(next);
    window.dispatchEvent(new Event('quick_tags_updated'));
  };

  const handleAddPreset = () => {
    const nextKey = String(quickTagPresets.length + 1);
    const newPreset: QuickTagPreset = {
      id: `qt_${Date.now()}`,
      key: nextKey,
      shape: 'circle',
      color: '#06b6d4',
      emoji: '🏷️',
      description: 'yeni etiket',
    };
    const next = [...quickTagPresets, newPreset];
    setQuickTagPresets(next);
    saveQuickTagPresets(next);
    window.dispatchEvent(new Event('quick_tags_updated'));
  };

  const handleDeletePreset = (id: string) => {
    const next = quickTagPresets.filter((p) => p.id !== id);
    setQuickTagPresets(next);
    saveQuickTagPresets(next);
    window.dispatchEvent(new Event('quick_tags_updated'));
  };

  const handleResetPresets = () => {
    if (!window.confirm(lang === 'tr' ? 'Hızlı tag tuş atamaları varsayılanlara sıfırlansın mı?' : 'Reset quick tag hotkeys to default?')) return;
    setQuickTagPresets(DEFAULT_QUICK_TAG_PRESETS);
    saveQuickTagPresets(DEFAULT_QUICK_TAG_PRESETS);
    window.dispatchEvent(new Event('quick_tags_updated'));
  };

  if (!isOpen) return null;

  const handleTestSound = () => {
    playTriggerSound();
    onNotification(lang === 'tr' ? '🔊 Uyarı sesi çalındı.' : '🔊 Alert sound played.');
  };

  const handleTestWebhook = async () => {
    if (!triggerConfig.httpsWebhookUrl.trim()) {
      alert(lang === 'tr' ? 'Lütfen bir Webhook URL girin.' : 'Please enter a webhook URL.');
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await invoke<{ ok: boolean; status: number; body: string }>('http_request', {
        options: {
          url: triggerConfig.httpsWebhookUrl.trim(),
          method: triggerConfig.httpsMethod || 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            test: true,
            message: 'Serial Monitor Pro Test Trigger Webhook',
            timestamp: new Date().toISOString(),
          }),
        },
      });
      if (res.ok) {
        onNotification(`✅ Webhook testi başarılı! HTTP ${res.status}`);
      } else {
        alert(`Webhook başarısız: HTTP ${res.status}\n${res.body}`);
      }
    } catch (err) {
      alert(`Webhook hatası: ${err}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleAddBulk = (isTrigger: boolean) => {
    const raw = bulkInput.trim().replace(/^[:\s]+/, '');
    if (!raw) return;

    // Virgül veya satır sonu ile ayır
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (items.length > 0) {
      onBulkAddFilters(items, isTrigger);
      setBulkInput('');
      onNotification(
        lang === 'tr'
          ? `✅ ${items.length} adet ${isTrigger ? 'tetikleyici' : 'filtre'} eklendi.`
          : `✅ Added ${items.length} ${isTrigger ? 'triggers' : 'filters'}.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141622] border border-[#2d3047] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#25283b] flex items-center justify-between bg-[#10121d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {t('triggerSettings', lang)}
              </h2>
              <p className="text-[11px] text-[#6c7086]">
                {lang === 'tr'
                  ? 'Tetikleme aksiyonları, sessiz mod ve otomatik isimlendirme kuralı'
                  : 'Trigger actions, pre-filtering, and auto-naming rule'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6c7086] hover:text-white hover:bg-[#1e2030] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Tetikleme Modu (Armed Mode) */}
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{t('triggerArmed', lang)}</span>
                    {triggerConfig.armedMode && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-mono animate-pulse">
                        ARMED / AKTİF
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-rose-200/70">
                    {t('triggerArmedTip', lang)}
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerConfig.armedMode}
                  onChange={(e) =>
                    onUpdateTriggerConfig({ ...triggerConfig, armedMode: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#25283b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            <div className="text-[10px] text-rose-300/80 bg-black/30 p-2.5 rounded-lg border border-rose-500/20">
              ⚡ {lang === 'tr'
                ? 'Bu mod etkinken: Cihazdan akan binlerce gürültülü satır belleğe kaydedilmez, yalnızca aktif filtre kelimelerini içeren satırlar tutulur. Tetikleyici kelime geldiğinde aksiyonlar anında çalıştırılır.'
                : 'When enabled: High-volume noisy lines are discarded until a trigger fires, keeping only lines matching active filter tags.'}
            </div>
          </div>

          {/* 2. Tetikleme Aksiyonları */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('triggerActions', lang)}</span>
            </h4>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-4">
              {/* Ses Çalma */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-medium text-white block">
                      {t('playAudio', lang)}
                    </span>
                    <span className="text-[10px] text-[#6c7086]">
                      {lang === 'tr' ? 'Web Audio API ile anlık kristal netliğinde çift ton' : 'Instant dual-chime alert tone via Web Audio API'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#25283b] hover:bg-[#32364e] text-cyan-300 text-[11px] transition cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{t('testAction', lang)}</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={triggerConfig.playAudio}
                    onChange={(e) =>
                      onUpdateTriggerConfig({ ...triggerConfig, playAudio: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* HTTPS Webhook */}
              <div className="space-y-2 pt-2 border-t border-[#25283b]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-medium text-white block">
                        {t('httpsTrigger', lang)}
                      </span>
                      <span className="text-[10px] text-[#6c7086]">
                        {lang === 'tr' ? 'Discord, Slack, n8n veya REST API Webhook' : 'Send payload to Discord, Slack, n8n, or REST API'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.httpsTrigger}
                    onChange={(e) =>
                      onUpdateTriggerConfig({ ...triggerConfig, httpsTrigger: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {triggerConfig.httpsTrigger && (
                  <div className="flex gap-2 pt-1">
                    <select
                      value={triggerConfig.httpsMethod}
                      onChange={(e) =>
                        onUpdateTriggerConfig({
                          ...triggerConfig,
                          httpsMethod: e.target.value as 'POST' | 'GET',
                        })
                      }
                      className="bg-[#0d0e15] border border-[#2d3047] text-xs text-white rounded-lg px-2.5 py-1.5 outline-none font-mono cursor-pointer"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                    <input
                      type="url"
                      value={triggerConfig.httpsWebhookUrl}
                      onChange={(e) =>
                        onUpdateTriggerConfig({
                          ...triggerConfig,
                          httpsWebhookUrl: e.target.value,
                        })
                      }
                      placeholder="https://api.example.com/webhook"
                      className="flex-1 bg-[#0d0e15] border border-[#2d3047] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={testingWebhook}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {testingWebhook ? '...' : t('testAction', lang)}
                    </button>
                  </div>
                )}
              </div>

              {/* Restart Connection */}
              <div className="flex items-center justify-between pt-2 border-t border-[#25283b]">
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-medium text-white block">
                      {t('restartConnection', lang)}
                    </span>
                    <span className="text-[10px] text-[#6c7086]">
                      {lang === 'tr' ? 'Tetiklendiğinde port bağlantısını anında kapatıp yeniden açar' : 'Reconnects serial port upon trigger'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={triggerConfig.restartConnection}
                  onChange={(e) =>
                    onUpdateTriggerConfig({ ...triggerConfig, restartConnection: e.target.checked })
                  }
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Send Serial Command */}
              <div className="space-y-2 pt-2 border-t border-[#25283b]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-medium text-white block">
                        {t('sendSerialCommand', lang)}
                      </span>
                      <span className="text-[10px] text-[#6c7086]">
                        {lang === 'tr' ? 'Cihaza otomatik UART komutu iletir' : 'Sends serial text command to device'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.sendSerialCommand}
                    onChange={(e) =>
                      onUpdateTriggerConfig({ ...triggerConfig, sendSerialCommand: e.target.checked })
                    }
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
                </div>

                {triggerConfig.sendSerialCommand && (
                  <input
                    type="text"
                    value={triggerConfig.serialCommandText}
                    onChange={(e) =>
                      onUpdateTriggerConfig({ ...triggerConfig, serialCommandText: e.target.value })
                    }
                    placeholder="Örn: reboot, help, AT+RST"
                    className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                  />
                )}
              </div>

              {/* End Serial Connection */}
              <div className="flex items-center justify-between pt-2 border-t border-[#25283b]">
                <div className="flex items-center gap-2.5">
                  <PowerOff className="w-4 h-4 text-rose-400" />
                  <div>
                    <span className="text-xs font-medium text-white block">
                      {t('endSerialConnection', lang)}
                    </span>
                    <span className="text-[10px] text-[#6c7086]">
                      {lang === 'tr' ? 'Tetiklendiğinde port bağlantısını dondurur ve keser' : 'Disconnects port immediately upon trigger'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={triggerConfig.endSerialConnection}
                  onChange={(e) =>
                    onUpdateTriggerConfig({ ...triggerConfig, endSerialConnection: e.target.checked })
                  }
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 3. Otomatik Panel İsimlendirme Kuralı */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('autoNaming', lang)}</span>
            </h4>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {lang === 'tr' ? 'Boot Loglarından Otomatik Başlık Çıkar' : 'Extract Panel Title from Boot Logs'}
                  </span>
                  <span className="text-[11px] text-[#898da0]">
                    {t('autoNamingTip', lang)}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoNaming.enabled}
                  onChange={(e) =>
                    onUpdateAutoNaming({ ...autoNaming, enabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              {autoNaming.enabled && (
                <div className="space-y-2 pt-2 border-t border-[#25283b]">
                  <label className="text-[11px] text-[#a6adc8] font-medium block">
                    {t('autoNamingRule', lang)}:
                  </label>
                  <input
                    type="text"
                    value={autoNaming.rule}
                    onChange={(e) =>
                      onUpdateAutoNaming({ ...autoNaming, rule: e.target.value })
                    }
                    placeholder='Örn: "esp-rom:" veya "esp-rom"+'
                    className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                  />
                  <div className="text-[10px] text-[#898da0] space-y-1 bg-[#10121d] p-2.5 rounded-lg border border-[#25283b]">
                    <div>
                      • <code className="text-cyan-300 font-mono">"esp-rom:"</code> : Satırdaki anahtar kelimeden sonrası başlık olur (örn: <span className="text-white font-mono">ESP-ROM:esp32p4-eco2-20240710</span> ➔ <span className="text-amber-300 font-mono">esp32p4-eco2-20240710</span>)
                    </div>
                    <div>
                      • <code className="text-cyan-300 font-mono">"esp-rom"+</code> : Kelimenin geçtiği tüm satır başlık yapılır.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Maksimum Log Kapasitesi (Max Log Caps) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('maxLogCapacity', lang)}</span>
            </h4>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {lang === 'tr' ? 'Hafıza Satır Limiti' : 'Memory Line Buffer Cap'}
                  </span>
                  <span className="text-[11px] text-[#898da0]">
                    {t('maxLogCapacityTip', lang)}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/50 border border-purple-500/40 px-2 py-0.5 rounded">
                  {maxLogCapacity.toLocaleString()} satır
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {CAPACITY_PRESETS.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => onUpdateMaxLogCapacity(cap)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer border ${
                      maxLogCapacity === cap
                        ? 'bg-purple-600/30 text-purple-200 border-purple-500 font-bold shadow-sm'
                        : 'bg-[#10121d] text-[#898da0] hover:text-white border-[#25283b] hover:bg-[#202337]'
                    }`}
                  >
                    {cap.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Otomatik Port Kapatma (Auto Close Timeout) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('defaultAutoCloseSec', lang)}</span>
            </h4>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {lang === 'tr' ? 'Varsayılan Kapanma Süresi' : 'Default Disconnect Timeout'}
                  </span>
                  <span className="text-[11px] text-[#898da0]">
                    {t('defaultAutoCloseTip', lang)}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded">
                  <span>{defaultAutoCloseSec}</span>
                  <span className="text-[10px] text-amber-400/80">{t('autoCloseSeconds', lang)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[10, 15, 30, 60, 120, 300].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onUpdateDefaultAutoCloseSec?.(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer border ${
                      defaultAutoCloseSec === sec
                        ? 'bg-amber-600/30 text-amber-200 border-amber-500 font-bold shadow-sm'
                        : 'bg-[#10121d] text-[#898da0] hover:text-white border-[#25283b] hover:bg-[#202337]'
                    }`}
                  >
                    {sec} {t('autoCloseSeconds', lang)}
                  </button>
                ))}

                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[11px] text-[#898da0]">{lang === 'tr' ? 'Özel:' : 'Custom:'}</span>
                  <input
                    type="number"
                    min="1"
                    max="86400"
                    value={defaultAutoCloseSec || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        onUpdateDefaultAutoCloseSec?.(val);
                      }
                    }}
                    className="w-16 bg-[#0d0e15] border border-[#2d3047] focus:border-amber-500 rounded-md px-2 py-1 text-xs text-amber-300 font-mono text-center outline-none"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">{t('autoCloseSeconds', lang)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Toplu Filtre Ekleme (Bulk Add Filters) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('bulkFilterModal', lang)}</span>
            </h4>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-3">
              <p className="text-[11px] text-[#898da0]">
                {t('bulkFilterTip', lang)}
              </p>
              <textarea
                rows={3}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={t('bulkFilterPlaceholder', lang)}
                className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white placeholder-[#50546c] outline-none font-mono resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddBulk(false)}
                  disabled={!bulkInput.trim()}
                  className="flex-1 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('addAsNormalFilters', lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBulk(true)}
                  disabled={!bulkInput.trim()}
                  className="flex-1 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{t('addAsTriggers', lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7. Hızlı Tag ve Kısayol Tuşları (Quick Tag Hotkeys) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>{lang === 'tr' ? 'Hızlı Tag & Kısayol Tuşları' : 'Quick Tag Hotkeys & Presets'}</span>
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPresets}
                  className="text-[11px] text-[#6c7086] hover:text-white transition cursor-pointer"
                >
                  {lang === 'tr' ? 'Varsayılanlara Sıfırla' : 'Reset Defaults'}
                </button>
                <button
                  type="button"
                  onClick={handleAddPreset}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-md transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{lang === 'tr' ? 'Yeni Tuş Ekle' : 'Add Key'}</span>
                </button>
              </div>
            </div>

            <div className="bg-[#181a29] border border-[#2d3047] rounded-xl p-3.5 space-y-3">
              <p className="text-[11px] text-[#898da0]">
                {lang === 'tr'
                  ? 'Terminalde satır üzerine gelindiğinde klavye tuşuna (ör. 1, 2) basarak satıra anında özel şekil, renk, emoji ve açıklama iliştirebilirsiniz.'
                  : 'Hover over any log line in the terminal and press the hotkey (e.g. 1, 2) to instantly stamp custom shapes, colors, emojis, and descriptions.'}
              </p>

              <div className="space-y-2">
                {quickTagPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center flex-wrap gap-2.5 p-2 bg-[#10121d] border border-[#25283b] rounded-lg text-xs"
                  >
                    {/* Key Badge & Input */}
                    <div className="flex items-center gap-1.5 min-w-[70px]">
                      <span className="text-[10px] text-[#6c7086] font-mono uppercase">{lang === 'tr' ? 'Tuş' : 'Key'}:</span>
                      <input
                        type="text"
                        maxLength={3}
                        value={preset.key}
                        onChange={(e) => handleUpdatePreset(preset.id, { key: e.target.value })}
                        className="w-8 text-center py-1 font-mono font-bold bg-[#1a1d2e] border border-[#2d3047] focus:border-purple-500 text-purple-300 rounded outline-none"
                      />
                    </div>

                    {/* Shape Selector */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={preset.shape}
                        onChange={(e) => handleUpdatePreset(preset.id, { shape: e.target.value as TagShape })}
                        style={{ backgroundColor: '#1a1d2e', color: '#cdd6f4' }}
                        className="bg-[#1a1d2e] border border-[#2d3047] text-slate-200 px-2 py-1 rounded text-xs outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="circle">⚪ {lang === 'tr' ? 'Yuvarlak' : 'Circle'}</option>
                        <option value="square">⬜ {lang === 'tr' ? 'Kare' : 'Square'}</option>
                        <option value="triangle">🔺 {lang === 'tr' ? 'Üçgen' : 'Triangle'}</option>
                        <option value="pentagon">⬟ {lang === 'tr' ? 'Beşgen' : 'Pentagon'}</option>
                        <option value="diamond">🔷 {lang === 'tr' ? 'Elmas' : 'Diamond'}</option>
                      </select>
                    </div>

                    {/* Color Picker & Hex */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={preset.color}
                        onChange={(e) => handleUpdatePreset(preset.id, { color: e.target.value })}
                        className="w-6 h-6 rounded border border-[#2d3047] bg-transparent cursor-pointer p-0"
                        title={lang === 'tr' ? 'Renk Seç' : 'Pick Color'}
                      />
                    </div>

                    {/* Emoji Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#6c7086]">Emoji:</span>
                      <input
                        type="text"
                        maxLength={4}
                        value={preset.emoji}
                        onChange={(e) => handleUpdatePreset(preset.id, { emoji: e.target.value })}
                        className="w-10 text-center py-1 bg-[#1a1d2e] border border-[#2d3047] focus:border-purple-500 text-white rounded outline-none"
                      />
                    </div>

                    {/* Description Input */}
                    <div className="flex-1 min-w-[130px]">
                      <input
                        type="text"
                        value={preset.description}
                        onChange={(e) => handleUpdatePreset(preset.id, { description: e.target.value })}
                        placeholder={lang === 'tr' ? 'Açıklama (ör. ekran hatası)' : 'Description (e.g. screen error)'}
                        className="w-full py-1 px-2.5 bg-[#1a1d2e] border border-[#2d3047] focus:border-purple-500 text-slate-200 placeholder-[#50546c] rounded outline-none text-xs"
                      />
                    </div>

                    {/* Live Preview */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                      <TagShapeIcon shape={preset.shape} color={preset.color} emoji={preset.emoji} size={16} />
                      <span className="text-[11px] text-white font-medium">{preset.description || preset.key}</span>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      className="p-1 text-[#6c7086] hover:text-rose-400 hover:bg-rose-950/30 rounded transition cursor-pointer"
                      title={lang === 'tr' ? 'Kısayolu Sil' : 'Delete Hotkey'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#25283b] flex items-center justify-between bg-[#10121d]">
          <span className="text-[11px] text-[#6c7086]">
            {lang === 'tr' ? 'Değişiklikler otomatik olarak kaydedilir.' : 'Changes are saved automatically.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{lang === 'tr' ? 'Tamam' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
