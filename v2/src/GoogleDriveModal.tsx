import React, { useState, useEffect, useCallback } from 'react';
import { GoogleDriveService } from './gdriveService';
import { GDriveFileInfo, GDriveUser, I18nLanguage, PanelSession, FilterPreset, TriggerActionsConfig, AutoNamingConfig, LogPin } from './types';
import { t } from './i18n';
import {
  Cloud,
  Download,
  FolderOpen,
  Trash2,
  X,
  RefreshCw,
  CheckCircle2,
  LogOut,
  Key,
  ShieldCheck,
  FileText,
  Sliders,
  Bookmark,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Globe,
  Zap,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
  panels: PanelSession[];
  filterTags: string[];
  triggerTags: string[];
  filterPresets: FilterPreset[];
  maxLogCapacity: number;
  terminalFont: string;
  terminalFontSize: number;
  triggerActions: TriggerActionsConfig;
  autoNaming: AutoNamingConfig;
  defaultAutoCloseSec?: number;
  onRestoreFilters: (filters: { tags: string[]; triggerTags: string[]; presets: FilterPreset[] }) => void;
  onRestoreSettings: (settings: {
    maxLogCapacity?: number;
    terminalFont?: string;
    terminalFontSize?: number;
    triggerActions?: TriggerActionsConfig;
    autoNaming?: AutoNamingConfig;
    defaultAutoCloseSec?: number;
  }) => void;
  onRestorePins?: (pins: LogPin[], targetPanelId?: string) => void;
  onRestorePanels?: (panelsData: Partial<PanelSession>[]) => void;
  onOpenLogAsReference: (content: string, filename: string, pins?: LogPin[]) => void;
  onNotification: (msg: string) => void;
}

const PRECONFIGURED_OAUTH_PLAYGROUND_URL =
  'https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file';

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  lang,
  panels,
  filterTags,
  triggerTags,
  filterPresets,
  maxLogCapacity,
  terminalFont,
  terminalFontSize,
  triggerActions,
  autoNaming,
  defaultAutoCloseSec,
  onRestoreFilters,
  onRestoreSettings,
  onRestorePins,
  onRestorePanels,
  onOpenLogAsReference,
  onNotification,
}) => {
  const [authMethod, setAuthMethod] = useState<'browser' | 'manual'>('browser');
  const [clientIdInput, setClientIdInput] = useState(() => GoogleDriveService.getSavedClientId());
  const [clientSecretInput, setClientSecretInput] = useState(() => GoogleDriveService.getSavedClientSecret());
  const [tokenInput, setTokenInput] = useState('');
  const [currentUser, setCurrentUser] = useState<GDriveUser | null>(null);
  const [files, setFiles] = useState<GDriveFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowserWaiting, setIsBrowserWaiting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await GoogleDriveService.listFiles();
      setFiles(list);
    } catch (err) {
      console.warn('Failed to list files:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize user from storage
  useEffect(() => {
    if (isOpen) {
      const user = GoogleDriveService.getSavedUser();
      const token = GoogleDriveService.getAccessToken();
      if (token && user) {
        setCurrentUser(user);
        loadFiles();
      } else {
        setCurrentUser(null);
      }
      setClientIdInput(GoogleDriveService.getSavedClientId());
      setClientSecretInput(GoogleDriveService.getSavedClientSecret());
    }
  }, [isOpen, loadFiles]);

  // 1-Click Browser OAuth Login (Tampermonkey style - permanent refresh token)
  const handleBrowserOAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = clientIdInput.trim();
    if (!id) {
      setErrorMessage(
        lang === 'tr'
          ? 'Lütfen Google Cloud Console üzerinden oluşturulmuş OAuth 2.0 Client ID girin.'
          : 'Please enter a valid Google OAuth 2.0 Client ID from Google Cloud Console.'
      );
      return;
    }

    setIsLoading(true);
    setIsBrowserWaiting(true);
    setErrorMessage(null);
    try {
      const user = await GoogleDriveService.startBrowserOAuthFlow(id, clientSecretInput.trim() || undefined);
      setCurrentUser(user);
      onNotification(
        lang === 'tr'
          ? `✅ Google Drive Kalıcı Giriş Başarılı: ${user.displayName}`
          : `✅ Google Drive Connected Permanently: ${user.displayName}`
      );
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsLoading(false);
      setIsBrowserWaiting(false);
    }
  };

  // Manual Token Login (Temporary / 1-hour)
  const handleManualLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await GoogleDriveService.verifyAndFetchUser(token);
      setCurrentUser(user);
      setTokenInput('');
      onNotification(`✅ Google Drive Girişi Yapıldı: ${user.displayName}`);
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    GoogleDriveService.logout();
    setCurrentUser(null);
    setFiles([]);
    setErrorMessage(null);
    onNotification(lang === 'tr' ? 'Google Drive çıkışı yapıldı.' : 'Signed out from Google Drive.');
  };

  // 1. Logları Drive'a Yükle (Pinleri de içerir)
  const handleUploadLogs = async () => {
    if (panels.length === 0) {
      onNotification(lang === 'tr' ? 'Yüklenecek panel bulunmuyor.' : 'No active panel to upload.');
      return;
    }

    const activePanel = panels[0];
    const linesToSave = activePanel.lines;
    const pinsToSave = activePanel.pins || [];

    if (linesToSave.length === 0) {
      onNotification(lang === 'tr' ? 'Log paneli boş.' : 'Log panel is empty.');
      return;
    }

    setActionLoading('upload_logs');
    setErrorMessage(null);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cleanTitle = (activePanel.title || 'ESP32_Log').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${cleanTitle}_${ts}.log`;

      const pinsHeader = pinsToSave.length > 0 ? `Pins: ${JSON.stringify(pinsToSave)}\n` : '';
      const header = `=== ESP32 SERIAL MONITOR PRO LOG ARCHIVE ===\nTitle: ${activePanel.title}\nPort: ${activePanel.port}\nTimestamp: ${new Date().toLocaleString()}\nLines: ${linesToSave.length}\n${pinsHeader}============================================\n\n`;
      const content = header + linesToSave.join('\n');

      await GoogleDriveService.uploadFile(filename, content, 'text/plain');
      onNotification(`☁️ "${filename}" Google Drive'a başarıyla yüklendi (${pinsToSave.length} pin ile).`);
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Filtre Setlerini Drive'a Yedekle
  const handleUploadFilters = async () => {
    setActionLoading('upload_filters');
    setErrorMessage(null);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ESP32_Filters_Backup_${ts}.json`;

      const payload = {
        type: 'esp32_filter_sets_backup',
        createdAt: Date.now(),
        dateStr: new Date().toLocaleString(),
        filterTags,
        triggerTags,
        filterPresets,
      };

      await GoogleDriveService.uploadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
      onNotification(`☁️ Filtre setleri Google Drive'a yedeklendi: "${filename}".`);
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Ayarları Drive'a Yedekle
  const handleUploadSettings = async () => {
    setActionLoading('upload_settings');
    setErrorMessage(null);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ESP32_Settings_Backup_${ts}.json`;

      const payload = {
        type: 'esp32_settings_backup',
        createdAt: Date.now(),
        dateStr: new Date().toLocaleString(),
        maxLogCapacity,
        terminalFont,
        terminalFontSize,
        triggerActions,
        autoNaming,
        defaultAutoCloseSec: defaultAutoCloseSec || 30,
      };

      await GoogleDriveService.uploadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
      onNotification(`☁️ Ayarlar Google Drive'a yedeklendi: "${filename}".`);
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Tek Tıkla Tam Yedek (Paneller, Loglar, Pinler, Ayarlar, Filtreler)
  const handleFullBackup = async () => {
    setActionLoading('upload_full');
    setErrorMessage(null);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ESP32_FullBackup_${ts}.json`;

      const payload = {
        type: 'esp32_full_backup',
        createdAt: Date.now(),
        dateStr: new Date().toLocaleString(),
        settings: {
          maxLogCapacity,
          terminalFont,
          terminalFontSize,
          triggerActions,
          autoNaming,
          defaultAutoCloseSec: defaultAutoCloseSec || 30,
        },
        filters: {
          filterTags,
          triggerTags,
          filterPresets,
        },
        panels: panels.map((p) => ({
          id: p.id,
          title: p.title,
          port: p.port,
          baudRate: p.baudRate,
          lines: p.lines,
          pins: p.pins || [],
          isReference: p.isReference,
        })),
        pins: panels.length > 0 ? panels[0].pins || [] : [],
        activePanelsCount: panels.length,
      };

      await GoogleDriveService.uploadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
      onNotification(`☁️ Tam sistem paketi (Paneller, Pinler, Ayarlar, Filtreler) Google Drive'a kaydedildi.`);
      await loadFiles();
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  // Drive'dan Geri Yükle veya Referans Olarak Aç (Pinleri de restore eder)
  const handleRestoreOrOpen = async (file: GDriveFileInfo) => {
    setActionLoading(`file_${file.id}`);
    setErrorMessage(null);
    try {
      const content = await GoogleDriveService.downloadFile(file.id);

      if (file.name.endsWith('.log')) {
        let parsedPins: LogPin[] | undefined;
        const pinsMatch = content.match(/Pins:\s*(\[.*?\])(?:\r?\n|$)/);
        if (pinsMatch) {
          try {
            parsedPins = JSON.parse(pinsMatch[1]);
          } catch (e) {
            console.warn('Failed to parse pins from log header:', e);
          }
        }
        onOpenLogAsReference(content, file.name, parsedPins);
        onClose();
      } else if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.type === 'esp32_filter_sets_backup' || (parsed.filterTags && parsed.filterPresets)) {
            onRestoreFilters({
              tags: parsed.filterTags || [],
              triggerTags: parsed.triggerTags || [],
              presets: parsed.filterPresets || [],
            });
            onNotification(lang === 'tr' ? `Filtre setleri Drive'dan geri yüklendi!` : `Filters restored from Drive!`);
          } else if (parsed.type === 'esp32_settings_backup') {
            onRestoreSettings({
              maxLogCapacity: parsed.maxLogCapacity,
              terminalFont: parsed.terminalFont,
              terminalFontSize: parsed.terminalFontSize,
              triggerActions: parsed.triggerActions,
              autoNaming: parsed.autoNaming,
              defaultAutoCloseSec: parsed.defaultAutoCloseSec,
            });
            onNotification(lang === 'tr' ? `Ayarlar Drive'dan geri yüklendi!` : `Settings restored from Drive!`);
          } else if (parsed.type === 'esp32_full_backup') {
            if (parsed.filters) onRestoreFilters(parsed.filters);
            if (parsed.settings) onRestoreSettings(parsed.settings);
            if (parsed.panels && onRestorePanels) {
              onRestorePanels(parsed.panels);
            } else if (parsed.pins && onRestorePins) {
              onRestorePins(parsed.pins);
            }
            onNotification(
              lang === 'tr'
                ? `Tam sistem paketi (Paneller, Pinler, Filtreler ve Ayarlar) Drive'dan geri yüklendi!`
                : `Full backup (Panels, Pins, Filters and Settings) restored from Drive!`
            );
          } else {
            setErrorMessage('Tanınmayan yedek JSON formatı.');
          }
        } catch {
          setErrorMessage('JSON dosyası ayrıştırılamadı.');
        }
      }
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteFile = async (file: GDriveFileInfo) => {
    if (!window.confirm(`"${file.name}" dosyasını Google Drive'dan silmek istediğinize emin misiniz?`)) return;
    try {
      await GoogleDriveService.deleteFile(file.id);
      onNotification(lang === 'tr' ? `Dosya silindi: ${file.name}` : `Deleted: ${file.name}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setErrorMessage(String(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141622] border border-[#2d3047] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#25283b] flex items-center justify-between bg-[#10121d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {t('gdriveBackup', lang)}
              </h2>
              <p className="text-[11px] text-[#6c7086]">
                Google Drive API v3 • /ESP32 Serial Monitor Pro
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Hata Bildirimi Paneli */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="font-semibold text-rose-100">
                    {lang === 'tr' ? 'Google Drive İşlem Hatası' : 'Google Drive Error'}
                  </div>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="whitespace-pre-wrap font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-rose-900/40 text-rose-300 leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* User Auth Section */}
          {!currentUser ? (
            <div className="bg-[#181a29] border border-[#2e324c] rounded-xl p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-white">
                      {lang === 'tr' ? 'Google Drive Hesabınızı Bağlayın' : 'Connect Your Google Drive Account'}
                    </h3>
                    <div className="flex items-center bg-[#0d0e15] border border-[#2d3047] rounded-lg p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('browser')}
                        className={`px-2 py-0.5 rounded transition ${
                          authMethod === 'browser'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-[#898da0] hover:text-white'
                        }`}
                      >
                        🌐 {lang === 'tr' ? 'Tarayıcı (Kalıcı)' : 'Browser (Permanent)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('manual')}
                        className={`px-2 py-0.5 rounded transition ${
                          authMethod === 'manual'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-[#898da0] hover:text-white'
                        }`}
                      >
                        🔑 {lang === 'tr' ? 'Manuel Token' : 'Manual Token'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#898da0] leading-relaxed mt-1">
                    {lang === 'tr'
                      ? 'Loglarınızı, değişken filtre setlerinizi ve donanım ayarlarınızı Google Drive üzerinde saklayın. Tarayıcı ile giriş yaparak Tampermonkey tarzı kalıcı (Refresh Token ile otomatik yenilenen) oturum elde edersiniz.'
                      : 'Store your serial logs, dynamic filters, and hardware presets in your Google Drive. Sign in via browser for permanent session with auto-refreshing tokens.'}
                  </p>
                </div>
              </div>

              {/* Browser OAuth Method (Recommended) */}
              {authMethod === 'browser' ? (
                <form onSubmit={handleBrowserOAuth} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#898da0] font-mono block mb-1">
                        Google OAuth Client ID:
                      </label>
                      <input
                        type="text"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        placeholder="apps.googleusercontent.com Client ID"
                        className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#898da0] font-mono block mb-1">
                        Client Secret ({lang === 'tr' ? 'İsteğe bağlı' : 'Optional'}):
                      </label>
                      <input
                        type="password"
                        value={clientSecretInput}
                        onChange={(e) => setClientSecretInput(e.target.value)}
                        placeholder="Client Secret (desktop app)"
                        className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading || isBrowserWaiting || !clientIdInput.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
                    >
                      {isLoading || isBrowserWaiting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isBrowserWaiting
                          ? (lang === 'tr' ? 'Tarayıcı Açıldı, Onay Bekleniyor (Port 8989)...' : 'Waiting for Browser Approval...')
                          : (lang === 'tr' ? '🌐 Tarayıcı ile Kalıcı Giriş Yap' : '🌐 Sign in with Browser')}
                      </span>
                    </button>

                    <span className="text-[10px] text-emerald-400/80 font-mono flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      {lang === 'tr' ? 'Oturum süresi dolmaz (Refresh Token)' : 'Never expires (Refresh Token)'}
                    </span>
                  </div>

                  <div className="bg-[#10121d] p-2.5 rounded-lg border border-[#25283b] text-[10px] text-[#898da0] space-y-1">
                    <p className="font-semibold text-[#cdd6f4]">💡 Nasıl Çalışır?</p>
                    <p>
                      {lang === 'tr'
                        ? 'Butona bastığınızda varsayılan tarayıcınız açılır ve Google hesabınızla yetkilendirme istenir. Yerel dinleyici (http://127.0.0.1:8989/oauth/callback) onay kodunu yakalayıp kalıcı Refresh Token alır. Token süresi dolduğunda otomatik olarak yenilenir.'
                        : 'Your browser opens Google authorization. The local listener (port 8989) captures the code and receives a permanent refresh token.'}
                    </p>
                  </div>
                </form>
              ) : (
                /* Manual Token Method */
                <form onSubmit={handleManualLogin} className="space-y-3 pt-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6c7086]" />
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="OAuth Access Token (ya29....)"
                        className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#50546c] outline-none font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading || !tokenInput.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition shadow-md shadow-emerald-600/20 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      <span>{t('gdriveLogin', lang)}</span>
                    </button>
                  </div>

                  <div className="bg-[#10121d] p-3 rounded-lg border border-[#25283b] space-y-2 text-[11px] text-[#a6adc8]">
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>🔑 Geçici Token (OAuth Playground):</span>
                      <a
                        href={PRECONFIGURED_OAUTH_PLAYGROUND_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/40 text-[10px] transition font-sans flex items-center gap-1"
                      >
                        <span>OAuth Playground Aç</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-[#181a29] border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser.photoLink ? (
                  <img
                    src={currentUser.photoLink}
                    alt="User"
                    className="w-9 h-9 rounded-full border border-emerald-500/40"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-500/40">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{currentUser.displayName}</span>
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {currentUser.isPermanent
                        ? (lang === 'tr' ? '⚡ Kalıcı Oturum (Auto-Refresh)' : '⚡ Permanent (Auto-Refresh)')
                        : (lang === 'tr' ? 'Drive Bağlandı' : 'Drive Connected')}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#898da0] font-mono">{currentUser.emailAddress}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadFiles}
                  disabled={isLoading}
                  title={lang === 'tr' ? 'Yenile' : 'Refresh'}
                  className="p-1.5 rounded-lg bg-[#25283b] hover:bg-[#32364e] text-[#a6adc8] hover:text-white transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('gdriveLogout', lang)}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Backup Action Buttons (Only when logged in) */}
          {currentUser && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider">
                {lang === 'tr' ? 'Bulut Yedekleme Aksiyonları' : 'Cloud Backup Actions'}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* 1. Logları Yükle */}
                <button
                  onClick={handleUploadLogs}
                  disabled={actionLoading !== null}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#181a29] hover:bg-[#202337] border border-[#2d3047] hover:border-cyan-500/50 text-center transition group cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-md bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-cyan-300">
                    {t('gdriveSaveLogs', lang)}
                  </span>
                  <span className="text-[10px] text-[#6c7086] mt-0.5">
                    {panels.length > 0 ? `${panels[0].lines.length} satır • ${panels[0].pins?.length || 0} pin` : '0 satır'}
                  </span>
                </button>

                {/* 2. Filtre Setlerini Yedekle */}
                <button
                  onClick={handleUploadFilters}
                  disabled={actionLoading !== null}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#181a29] hover:bg-[#202337] border border-[#2d3047] hover:border-amber-500/50 text-center transition group cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-md bg-amber-600/20 text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Bookmark className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-amber-300">
                    {t('gdriveSaveFilters', lang)}
                  </span>
                  <span className="text-[10px] text-[#6c7086] mt-0.5">
                    {filterTags.length + triggerTags.length} etiket • {filterPresets.length} şablon
                  </span>
                </button>

                {/* 3. Ayarları Yedekle */}
                <button
                  onClick={handleUploadSettings}
                  disabled={actionLoading !== null}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#181a29] hover:bg-[#202337] border border-[#2d3047] hover:border-purple-500/50 text-center transition group cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-md bg-purple-600/20 text-purple-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-purple-300">
                    {t('gdriveSaveSettings', lang)}
                  </span>
                  <span className="text-[10px] text-[#6c7086] mt-0.5">
                    Max: {maxLogCapacity} • Font: {terminalFont}
                  </span>
                </button>

                {/* 4. Tek Tıkla Tam Yedek */}
                <button
                  onClick={handleFullBackup}
                  disabled={actionLoading !== null}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-gradient-to-br from-emerald-950/40 to-[#181a29] hover:from-emerald-900/50 hover:to-[#202337] border border-emerald-500/40 text-center transition group cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-900/20"
                >
                  <div className="w-7 h-7 rounded-md bg-emerald-600/30 text-emerald-300 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                    {t('gdriveFullBackup', lang)}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 mt-0.5">
                    {lang === 'tr' ? 'Paneller, Pinler & Ayarlar' : 'Panels, Pins & Settings'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Drive Files List */}
          {currentUser && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-[#898da0] uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('gdriveFiles', lang)} ({files.length})</span>
                </h4>
                <span className="text-[10px] text-[#6c7086]">
                  Klasör: Google Drive / ESP32 Serial Monitor Pro
                </span>
              </div>

              {files.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#26283b] rounded-xl text-xs text-[#6c7086]">
                  {isLoading
                    ? (lang === 'tr' ? 'Google Drive taranıyor...' : 'Scanning Google Drive...')
                    : (lang === 'tr' ? 'Klasörde henüz yedek dosyası yok. Yukarıdaki butonlarla yedek oluşturabilirsiniz.' : 'No backup files found yet. Use the buttons above to backup.')}
                </div>
              ) : (
                <div className="border border-[#26283b] rounded-xl divide-y divide-[#202337] overflow-hidden bg-[#0d0e15]">
                  {files.map((file) => {
                    const isLog = file.name.endsWith('.log');
                    const isFilters = file.name.includes('Filters');
                    const isSettings = file.name.includes('Settings');

                    return (
                      <div
                        key={file.id}
                        className="p-3 flex items-center justify-between hover:bg-[#151724] transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                              isLog
                                ? 'bg-cyan-600/20 text-cyan-400'
                                : isFilters
                                ? 'bg-amber-600/20 text-amber-400'
                                : isSettings
                                ? 'bg-purple-600/20 text-purple-400'
                                : 'bg-emerald-600/20 text-emerald-400'
                            }`}
                          >
                            {isLog ? (
                              <FileText className="w-3.5 h-3.5" />
                            ) : isFilters ? (
                              <Bookmark className="w-3.5 h-3.5" />
                            ) : isSettings ? (
                              <Sliders className="w-3.5 h-3.5" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-mono font-medium text-white block truncate">
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-[#6c7086]">
                              {file.modifiedTime && (
                                <span>{new Date(file.modifiedTime).toLocaleString()}</span>
                              )}
                              {file.size && <span>• {(Number(file.size) / 1024).toFixed(1)} KB</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          <button
                            onClick={() => handleRestoreOrOpen(file)}
                            disabled={actionLoading !== null}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                              isLog
                                ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            <Download className="w-3 h-3" />
                            <span>
                              {isLog ? t('gdriveOpenAsRef', lang) : t('gdriveRestore', lang)}
                            </span>
                          </button>

                          <button
                            onClick={() => handleDeleteFile(file)}
                            title={lang === 'tr' ? 'Sil' : 'Delete'}
                            className="p-1 rounded text-[#6c7086] hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#25283b] flex items-center justify-between bg-[#10121d] text-[11px] text-[#6c7086]">
          <span>
            {lang === 'tr'
              ? 'Tüm aktarımlar doğrudan Google Drive REST v3 API üzerinden gerçekleştirilir.'
              : 'Direct integration with Google Drive REST v3 API.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1e2030] hover:bg-[#282a3e] text-white text-xs transition cursor-pointer"
          >
            {t('close', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
