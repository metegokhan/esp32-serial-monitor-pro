import React, { useState, useRef, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PanelSession, SerialDeviceInfo, I18nLanguage } from './types';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { t } from './i18n';
import { getFontCss } from './fontConfig';
import {
  Play,
  Square,
  RotateCcw,
  Download,
  Copy,
  Trash2,
  X,
  Send,
  Pin,
  FolderOpen,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface LogPanelProps {
  panel: PanelSession;
  lang: I18nLanguage;
  availablePorts: SerialDeviceInfo[];
  onRefreshPorts: () => void;
  onUpdatePanel: (id: string, updates: Partial<PanelSession>) => void;
  onClosePanel: (id: string) => void;
  onMakeReference: (id: string) => void;
  globalSearch: string;
  filterMatchingOnly: boolean;
  matchCase: boolean;
  isRegex: boolean;
  globalHighlightWord: string;
  onWordClick: (word: string) => void;
  onNotification: (msg: string) => void;
  terminalFont: string;
  terminalFontSize: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

const COMMON_BAUDS = [115200, 921600, 460800, 230400, 115200, 748800, 57600, 19200, 9600];

export const LogPanel: React.FC<LogPanelProps> = ({
  panel,
  lang,
  availablePorts,
  onRefreshPorts,
  onUpdatePanel,
  onClosePanel,
  onMakeReference,
  globalSearch,
  filterMatchingOnly,
  matchCase,
  isRegex,
  globalHighlightWord,
  onWordClick,
  onNotification,
  terminalFont,
  terminalFontSize,
  onZoomIn,
  onZoomOut,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [eol, setEol] = useState('\r\n');
  const [isResizing, setIsResizing] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zoom with Ctrl + Wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        onZoomIn?.();
      } else if (e.deltaY > 0) {
        onZoomOut?.();
      }
    }
  };

  // Editable Quick Commands state with persistence
  const [quickCommands, setQuickCommands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('esp32_quick_commands');
      return saved ? JSON.parse(saved) : ['help', 'status', 'version', 'reboot'];
    } catch {
      return ['help', 'status', 'version', 'reboot'];
    }
  });
  const [editingCmdIdx, setEditingCmdIdx] = useState<number | null>(null);
  const [editingCmdText, setEditingCmdText] = useState('');

  const handleStartEditCmd = (idx: number, currentText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCmdIdx(idx);
    setEditingCmdText(currentText);
  };

  const handleSaveCmd = (idx: number) => {
    if (editingCmdIdx === null) return;
    const trimmed = editingCmdText.trim();
    const next = [...quickCommands];
    if (trimmed) {
      next[idx] = trimmed;
    } else {
      next.splice(idx, 1);
    }
    setQuickCommands(next);
    localStorage.setItem('esp32_quick_commands', JSON.stringify(next));
    setEditingCmdIdx(null);
  };

  const handleAddCmd = () => {
    const next = [...quickCommands, 'custom'];
    setQuickCommands(next);
    setEditingCmdIdx(next.length - 1);
    setEditingCmdText('custom');
    localStorage.setItem('esp32_quick_commands', JSON.stringify(next));
  };

  // Auto-scroll on new lines
  useEffect(() => {
    if (panel.autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [panel.lines.length, panel.autoScroll]);

  // Connect / Disconnect handlers
  const handleToggleConnect = async () => {
    if (panel.isConnected) {
      try {
        await invoke('disconnect_port', { sessionId: panel.id });
        onUpdatePanel(panel.id, { isConnected: false });
        onNotification(t('disconnectedMsg', lang, { port: panel.port }));
      } catch (err) {
        onNotification('Hata: ' + String(err));
      }
    } else {
      if (!panel.port) {
        alert('Lütfen önce bir port seçin.');
        return;
      }
      try {
        await invoke('connect_port', {
          sessionId: panel.id,
          portName: panel.port,
          baudRate: panel.baudRate,
          resetOnConnect: panel.resetOnConnect,
        });
        onUpdatePanel(panel.id, { isConnected: true });
        onNotification(t('connectedMsg', lang, { port: panel.port, baud: panel.baudRate }));
      } catch (err) {
        alert('Bağlantı hatası: ' + String(err));
      }
    }
  };

  // Hardware Reset (EN pin pulse)
  const handleHardwareReset = async () => {
    if (!panel.isConnected) return;
    try {
      await invoke('reset_esp', { sessionId: panel.id });
      onNotification('🔄 ESP32 Hardware Reset (EN) tetiklendi.');
    } catch (err) {
      alert('Reset hatası: ' + String(err));
    }
  };

  // Enter Bootloader (IO0 pulse)
  const handleBootloader = async () => {
    if (!panel.isConnected) return;
    try {
      await invoke('boot_esp', { sessionId: panel.id });
      onNotification('🚀 ESP32 Bootloader (İndirme) moduna alındı.');
    } catch (err) {
      alert('Bootloader hatası: ' + String(err));
    }
  };

  // Send Command
  const handleSendCommand = async (cmdToSend?: string) => {
    const text = cmdToSend !== undefined ? cmdToSend : commandInput;
    if (!text.trim() || !panel.isConnected) return;

    try {
      await invoke('send_data', {
        sessionId: panel.id,
        data: text + eol,
      });

      // Update command history
      const history = [...panel.commandHistory, text];
      onUpdatePanel(panel.id, {
        commandHistory: history.slice(-50),
        historyIndex: history.length,
      });

      if (cmdToSend === undefined) {
        setCommandInput('');
      }
    } catch (err) {
      alert('Komut gönderme hatası: ' + String(err));
    }
  };

  // Command History keydown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      if (panel.commandHistory.length > 0 && panel.historyIndex > 0) {
        const nextIdx = panel.historyIndex - 1;
        setCommandInput(panel.commandHistory[nextIdx]);
        onUpdatePanel(panel.id, { historyIndex: nextIdx });
      }
    } else if (e.key === 'ArrowDown') {
      if (panel.historyIndex < panel.commandHistory.length - 1) {
        const nextIdx = panel.historyIndex + 1;
        setCommandInput(panel.commandHistory[nextIdx]);
        onUpdatePanel(panel.id, { historyIndex: nextIdx });
      } else {
        setCommandInput('');
        onUpdatePanel(panel.id, { historyIndex: panel.commandHistory.length });
      }
    }
  };

  // Gutter Point A & Point B clicking
  const handleGutterClick = (lineIndex: number) => {
    if (panel.pointA === null) {
      onUpdatePanel(panel.id, { pointA: lineIndex, pointB: null });
    } else if (panel.pointB === null) {
      if (lineIndex < panel.pointA) {
        onUpdatePanel(panel.id, { pointA: lineIndex, pointB: panel.pointA });
      } else {
        onUpdatePanel(panel.id, { pointB: lineIndex });
      }
    } else {
      // Clear points
      onUpdatePanel(panel.id, { pointA: null, pointB: null });
    }
  };

  // Copy selected range
  const handleCopyRange = () => {
    if (panel.pointA === null || panel.pointB === null) return;
    const [start, end] = [Math.min(panel.pointA, panel.pointB), Math.max(panel.pointA, panel.pointB)];
    const selected = panel.lines.slice(start, end + 1).join('\n');
    navigator.clipboard.writeText(selected);
    onNotification(t('copiedRangeMsg', lang, { count: end - start + 1 }));
  };

  // Export selected range
  const handleExportRange = async () => {
    if (panel.pointA === null || panel.pointB === null) return;
    const [start, end] = [Math.min(panel.pointA, panel.pointB), Math.max(panel.pointA, panel.pointB)];
    const selected = panel.lines.slice(start, end + 1).join('\n');
    if (!selected) {
      onNotification(lang === 'tr' ? 'Dışa aktarılacak satır yok.' : 'No lines to export.');
      return;
    }
    const safePort = (panel.port || 'log').replace(/[^a-zA-Z0-9]/g, '_');
    const defaultName = `Range_${safePort}_L${start + 1}-L${end + 1}_${Date.now()}.log`;
    try {
      const savedPath = await invoke<string | null>('export_log_dialog', {
        defaultFilename: defaultName,
        content: selected,
      });
      if (savedPath) {
        onNotification(lang === 'tr' ? `Aralık kaydedildi: ${savedPath}` : `Range saved: ${savedPath}`);
      }
    } catch (err) {
      console.error('Export range error:', err);
      onNotification(`Hata: ${err}`);
    }
  };

  // Export full log
  const handleExportFull = async () => {
    if (panel.lines.length === 0) {
      onNotification(lang === 'tr' ? 'Dışa aktarılacak log bulunmuyor.' : 'No logs to export.');
      return;
    }
    const text = panel.lines.join('\n');
    const safePort = (panel.port || 'log').replace(/[^a-zA-Z0-9]/g, '_');
    const defaultName = `Serial_${safePort}_${Date.now()}.log`;
    try {
      const savedPath = await invoke<string | null>('export_log_dialog', {
        defaultFilename: defaultName,
        content: text,
      });
      if (savedPath) {
        onNotification(lang === 'tr' ? `Log dışa aktarıldı: ${savedPath}` : `Log exported: ${savedPath}`);
      }
    } catch (err) {
      console.error('Export full error:', err);
      onNotification(`Hata: ${err}`);
    }
  };

  // Load log file from disk via native dialog or file input
  const handleOpenFile = async () => {
    try {
      const res = await invoke<[string, string] | null>('open_log_dialog');
      if (res) {
        const [filename, content] = res;
        const loadedLines = content.split(/\r?\n/);
        onUpdatePanel(panel.id, {
          lines: loadedLines,
          rawLines: loadedLines,
          title: `📌 ${filename}`,
          isReference: true,
        });
        onNotification(lang === 'tr' ? `Log yüklendi: ${filename} (${loadedLines.length} satır)` : `Log loaded: ${filename} (${loadedLines.length} lines)`);
      }
    } catch (err) {
      console.warn('Native open log error, fallback to file input:', err);
      fileInputRef.current?.click();
    }
  };

  // Fallback file load from input
  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const loadedLines = content.split(/\r?\n/);
      onUpdatePanel(panel.id, {
        lines: loadedLines,
        rawLines: loadedLines,
        title: `📌 ${file.name}`,
        isReference: true,
      });
      onNotification(lang === 'tr' ? `Log yüklendi: ${file.name} (${loadedLines.length} satır)` : `Log loaded: ${file.name} (${loadedLines.length} lines)`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter lines if global search is active and filterMatchingOnly is true
  const displayedLines = useMemo(() => {
    if (!globalSearch.trim() || !filterMatchingOnly) {
      return panel.lines.map((text, originalIndex) => ({ text, originalIndex }));
    }

    try {
      const pattern = isRegex
        ? new RegExp(globalSearch, matchCase ? 'g' : 'gi')
        : null;

      return panel.lines
        .map((text, originalIndex) => ({ text, originalIndex }))
        .filter(({ text }) => {
          if (pattern) {
            return pattern.test(text);
          }
          if (matchCase) {
            return text.includes(globalSearch);
          }
          return text.toLowerCase().includes(globalSearch.toLowerCase());
        });
    } catch {
      return panel.lines.map((text, originalIndex) => ({ text, originalIndex }));
    }
  }, [panel.lines, globalSearch, filterMatchingOnly, matchCase, isRegex]);

  // Width Resize Handler
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panel.width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(380, Math.min(1200, startWidth + (moveEvent.clientX - startX)));
      onUpdatePanel(panel.id, { width: newWidth });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isRangeActive = panel.pointA !== null && panel.pointB !== null;
  const rangeStart = isRangeActive ? Math.min(panel.pointA!, panel.pointB!) : 0;
  const rangeEnd = isRangeActive ? Math.max(panel.pointA!, panel.pointB!) : 0;

  return (
    <div
      style={{ width: `${panel.width}px` }}
      className="relative flex flex-col shrink-0 h-full bg-[#161824] border border-[#282b3d] rounded-lg shadow-xl overflow-hidden text-[#cdd6f4] select-none transition-shadow hover:shadow-2xl hover:border-[#3b3f5c]"
    >
      {/* 1. Panel Header */}
      <div className="flex flex-col border-b border-slate-800/90 bg-[#1c1e2e] p-2.5 gap-2">
        {/* Row 1: Title, Badges, Port, Baud, Connect & Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                panel.isConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : panel.isReference
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
              }`}
            >
              {panel.isConnected ? t('liveBadge', lang) : panel.isReference ? t('refBadge', lang) : 'OTURUM'}
            </span>
            <span className="text-xs font-bold text-slate-100 truncate" title={panel.title}>
              {panel.title}
            </span>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onMakeReference(panel.id)}
              className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-md transition-colors cursor-pointer"
              title={t('makeRefTip', lang)}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenFile}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 rounded-md transition-colors cursor-pointer"
              title={t('loadLogTip', lang)}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileLoad} className="hidden" accept=".log,.txt" />
            <button
              onClick={handleExportFull}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 rounded-md transition-colors cursor-pointer"
              title={t('export', lang)}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdatePanel(panel.id, { lines: [], rawLines: [], pointA: null, pointB: null })}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 rounded-md transition-colors cursor-pointer"
              title={t('clear', lang)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onClosePanel(panel.id)}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors cursor-pointer"
              title={t('close', lang)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Port Selector, Baud Selector, Connect Button, Reset Checkbox, EN/IO0 Buttons */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Port Dropdown */}
          <div className="flex items-center gap-1 min-w-[140px] flex-1">
            <select
              value={panel.port}
              disabled={panel.isConnected}
              onChange={(e) => onUpdatePanel(panel.id, { port: e.target.value })}
              style={{ backgroundColor: '#131522', color: '#cdd6f4', colorScheme: 'dark' }}
              className="w-full bg-[#131522] border border-[#2e324a] text-[#cdd6f4] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50 cursor-pointer"
            >
              <option value="" style={{ backgroundColor: '#131522', color: '#cdd6f4' }}>{t('selectPort', lang)}</option>
              {availablePorts.map((p) => (
                <option key={p.port_name} value={p.port_name} style={{ backgroundColor: '#131522', color: '#cdd6f4' }}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <button
              onClick={onRefreshPorts}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer"
              title="Portları Yenile"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Baud Rate */}
          <select
            value={panel.baudRate}
            disabled={panel.isConnected}
            onChange={(e) => onUpdatePanel(panel.id, { baudRate: Number(e.target.value) })}
            style={{ backgroundColor: '#131522', color: '#cdd6f4', colorScheme: 'dark' }}
            className="w-24 bg-[#131522] border border-[#2e324a] text-[#cdd6f4] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono cursor-pointer"
          >
            {COMMON_BAUDS.map((b) => (
              <option key={b} value={b} style={{ backgroundColor: '#131522', color: '#cdd6f4' }}>
                {b}
              </option>
            ))}
          </select>

          {/* Connect / Disconnect Button */}
          <button
            onClick={handleToggleConnect}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all shadow-sm ${
              panel.isConnected
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {panel.isConnected ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            {panel.isConnected ? t('disconnect', lang) : t('connect', lang)}
          </button>

          {/* KULLANICININ İSTEDİĞİ GİBİ: Resetleme onayı DOĞRUDAN Bağlan butonunun yanında tik şeklinde! */}
          <label
            className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-slate-300 hover:text-sky-300 transition-colors"
            title={t('resetOnConnectTip', lang)}
          >
            <input
              type="checkbox"
              checked={panel.resetOnConnect}
              onChange={(e) => onUpdatePanel(panel.id, { resetOnConnect: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>{t('resetOnConnect', lang)}</span>
          </label>

          {/* Hardware Reset (EN) */}
          <button
            onClick={handleHardwareReset}
            disabled={!panel.isConnected}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-40 transition-colors"
            title={t('hwResetTip', lang)}
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>EN</span>
          </button>

          {/* Bootloader Mode (IO0) */}
          <button
            onClick={handleBootloader}
            disabled={!panel.isConnected}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-40 transition-colors"
            title={t('bootloaderTip', lang)}
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>IO0</span>
          </button>
        </div>
      </div>

      {/* 2. Range Selection Banner (Nokta A - Nokta B seçildiğinde açılır) */}
      {isRangeActive && (
        <div className="bg-sky-950/80 border-b border-sky-500/40 px-3 py-1.5 flex items-center justify-between text-xs text-sky-200 animate-in slide-in-from-top-1 duration-100">
          <span className="font-mono font-medium truncate">
            {t('rangeSelected', lang, {
              a: rangeStart + 1,
              b: rangeEnd + 1,
              count: rangeEnd - rangeStart + 1,
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyRange}
              className="flex items-center gap-1 px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium shadow-sm transition-colors text-[11px]"
            >
              <Copy className="w-3 h-3" />
              {t('copyRange', lang)}
            </button>
            <button
              onClick={handleExportRange}
              className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
            >
              <Download className="w-3 h-3" />
              {t('exportRange', lang)}
            </button>
            <button
              onClick={() => onUpdatePanel(panel.id, { pointA: null, pointB: null })}
              className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
              title={t('clearSelection', lang)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Log Terminal Body with Gutter */}
      <div
        ref={logContainerRef}
        onWheel={handleWheel}
        className="flex-1 overflow-y-auto overflow-x-auto bg-[#0f111a] p-1 select-text focus:outline-none"
        style={{
          fontFamily: getFontCss(terminalFont),
          fontSize: `${terminalFontSize}px`,
          lineHeight: `${Math.max(16, Math.round(terminalFontSize * 1.45))}px`,
        }}
      >
        {displayedLines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            {panel.isConnected ? 'Veri bekleniyor...' : 'Bağlantı kapalı.'}
          </div>
        ) : (
          displayedLines.map(({ text, originalIndex }) => {
            const isPointA = panel.pointA === originalIndex;
            const isPointB = panel.pointB === originalIndex;
            const isInRange =
              isRangeActive && originalIndex >= rangeStart && originalIndex <= rangeEnd;

            // Check if line contains highlighted word
            const hasHighlightWord =
              globalHighlightWord &&
              globalHighlightWord.length > 0 &&
              text.toLowerCase().includes(globalHighlightWord.toLowerCase());

            return (
              <div
                key={originalIndex}
                className={`flex items-start group min-w-max hover:bg-slate-800/30 transition-colors rounded ${
                  isInRange
                    ? 'bg-sky-500/15 border-l-2 border-sky-400'
                    : hasHighlightWord
                    ? 'bg-amber-500/10'
                    : ''
                }`}
              >
                {/* Gutter Line Number & Clickable Dot Marker */}
                <div
                  onClick={() => handleGutterClick(originalIndex)}
                  className="w-12 shrink-0 select-none text-right pr-3 text-slate-600 group-hover:text-slate-400 cursor-pointer flex items-center justify-end gap-1 font-mono"
                  style={{
                    fontSize: `${Math.max(9, terminalFontSize - 1)}px`,
                    lineHeight: `${Math.max(16, Math.round(terminalFontSize * 1.45))}px`,
                  }}
                >
                  {isPointA ? (
                    <span className="w-4 h-4 bg-emerald-500 text-slate-950 font-black rounded-full flex items-center justify-center text-[10px] shadow">
                      A
                    </span>
                  ) : isPointB ? (
                    <span className="w-4 h-4 bg-rose-500 text-white font-black rounded-full flex items-center justify-center text-[10px] shadow">
                      B
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity">
                      •
                    </span>
                  )}
                  <span>{originalIndex + 1}</span>
                </div>

                {/* Log Line Content */}
                <div
                  className="flex-1 pl-1 pr-2 py-0.5 break-all select-text"
                  style={{
                    fontFamily: getFontCss(terminalFont),
                    fontSize: `${terminalFontSize}px`,
                    lineHeight: `${Math.max(16, Math.round(terminalFontSize * 1.45))}px`,
                  }}
                >
                  <SyntaxHighlighter
                    line={text}
                    highlightWord={globalHighlightWord}
                    onWordClick={onWordClick}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Bottom Command Bar */}
      <div className="border-t border-slate-800/90 bg-[#161824] p-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendCommand();
              else handleKeyDown(e);
            }}
            placeholder={t('commandPlaceholder', lang)}
            disabled={!panel.isConnected}
            className="flex-1 bg-[#10111a] border border-slate-700/60 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 disabled:opacity-40"
          />

          <select
            value={eol}
            onChange={(e) => setEol(e.target.value)}
            className="bg-[#10111a] border border-slate-700/60 rounded px-1.5 py-1 text-[11px] text-slate-400 focus:outline-none font-mono"
          >
            <option value="\r\n">CR+LF</option>
            <option value="\n">LF</option>
            <option value="\r">CR</option>
            <option value="">None</option>
          </select>

          <button
            onClick={() => handleSendCommand()}
            disabled={!panel.isConnected || !commandInput.trim()}
            className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold disabled:opacity-40 transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>{t('send', lang)}</span>
          </button>
        </div>

        {/* Quick Command Chips & Panel Footer Stats */}
        <div className="flex items-center justify-between text-[11px] text-[#6c7086] pt-0.5">
          <div className="flex items-center gap-1 flex-wrap">
            {quickCommands.map((cmd, idx) => (
              editingCmdIdx === idx ? (
                <input
                  key={idx}
                  autoFocus
                  type="text"
                  value={editingCmdText}
                  onChange={(e) => setEditingCmdText(e.target.value)}
                  onBlur={() => handleSaveCmd(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCmd(idx);
                    if (e.key === 'Escape') setEditingCmdIdx(null);
                  }}
                  className="w-16 px-1.5 py-0.5 bg-[#0d0e15] border border-cyan-500 rounded text-[10px] font-mono text-cyan-300 outline-none shadow-sm"
                />
              ) : (
                <button
                  key={idx}
                  onClick={() => {
                    if (panel.isConnected) {
                      handleSendCommand(cmd);
                    } else {
                      onNotification(lang === 'tr' ? 'Komut göndermek için önce porta bağlanın.' : 'Connect to port before sending.');
                    }
                  }}
                  onDoubleClick={(e) => handleStartEditCmd(idx, cmd, e)}
                  title={panel.isConnected ? 'Tek tık: Gönder | Çift tık: Düzenle' : 'Çift tık: Düzenle (Bağlı Değil)'}
                  className={`px-2 py-0.5 bg-[#181a28] hover:bg-[#25283d] border border-[#2d3047] rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    panel.isConnected ? 'text-[#a6adc8] hover:text-cyan-300' : 'text-[#7d829e] hover:text-[#cdd6f4]'
                  }`}
                >
                  {cmd}
                </button>
              )
            ))}
            <button
              onClick={handleAddCmd}
              title="Yeni Hızlı Komut Ekle"
              className="px-1.5 py-0.5 bg-[#141522] hover:bg-[#25283d] text-[#6c7086] hover:text-cyan-300 border border-[#2d3047] rounded text-[10px] font-mono transition-colors cursor-pointer"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span>
              {filterMatchingOnly && globalSearch
                ? t('filteredCount', lang, { matched: displayedLines.length, total: panel.lines.length })
                : t('linesCount', lang, { count: panel.lines.length })}
            </span>
            <span>Rx: {(panel.rxBytes / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      </div>

      {/* 5. Right Resizer Handle */}
      <div
        onMouseDown={handleMouseDownResize}
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-sky-500/50 transition-colors z-20 ${
          isResizing ? 'bg-sky-500' : ''
        }`}
        title="Genişliği Yeniden Boyutlandır"
      />
    </div>
  );
};
