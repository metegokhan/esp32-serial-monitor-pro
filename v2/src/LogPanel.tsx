import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PanelSession, SerialDeviceInfo, I18nLanguage, LogPin, QuickTagPreset } from './types';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { t } from './i18n';
import { getFontCss } from './fontConfig';
import { isLineMatchingFilters, formatFilterDescription, getFirstMatchingFilterTerm } from './filterUtils';
import { getTagThemeByTag } from './filterColors';
import { loadQuickTagPresets, TagShapeIcon } from './quickTagConfig';
import { getTagMatchingIndices } from './tagFilterUtils';
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
  Target,
  Clock,
  Terminal,
  FileCode,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

interface LogPanelProps {
  panel: PanelSession;
  lang: I18nLanguage;
  availablePorts: SerialDeviceInfo[];
  onRefreshPorts: () => void;
  onUpdatePanel: (id: string, updates: Partial<PanelSession>) => void;
  onClosePanel: (id: string) => void;
  onMakeReference: (id: string) => void;
  filterTerms: string[];
  allFilterTags?: string[];
  filterMatchingOnly: boolean;
  matchCase: boolean;
  isRegex: boolean;
  isVariableMode?: boolean;
  globalHighlightWord: string;
  onWordClick: (word: string) => void;
  onNotification: (msg: string) => void;
  terminalFont: string;
  terminalFontSize: number;
  defaultAutoCloseSec?: number;
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
  filterTerms,
  allFilterTags,
  filterMatchingOnly,
  matchCase,
  isRegex,
  isVariableMode = false,
  globalHighlightWord,
  onWordClick,
  onNotification,
  terminalFont,
  terminalFontSize,
  defaultAutoCloseSec,
  onZoomIn,
  onZoomOut,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [eol, setEol] = useState('\r\n');
  const [isMultilineMode, setIsMultilineMode] = useState(false);
  const [lineDelayMs, setLineDelayMs] = useState<number>(50);
  const [isSendingCmd, setIsSendingCmd] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);

  // Pins & Tags Management
  const [isPinsMenuOpen, setIsPinsMenuOpen] = useState(false);
  const pinsMenuRef = useRef<HTMLDivElement>(null);

  const pinsMap = useMemo(() => {
    const map = new Map<number, LogPin>();
    (panel.pins || []).forEach((p) => map.set(p.lineIndex, p));
    return map;
  }, [panel.pins]);

  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [quickTagPresets, setQuickTagPresets] = useState<QuickTagPreset[]>(() => loadQuickTagPresets());

  useEffect(() => {
    const handleStorage = () => {
      setQuickTagPresets(loadQuickTagPresets());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('quick_tags_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('quick_tags_updated', handleStorage);
    };
  }, []);

  const handleApplyQuickTag = useCallback(
    (preset: QuickTagPreset, targetLineIndex?: number) => {
      let lineIdx: number;
      let isLastLine = false;

      if (targetLineIndex !== undefined && targetLineIndex !== null) {
        lineIdx = targetLineIndex;
      } else {
        if (!panel.lines || panel.lines.length === 0) {
          onNotification(
            lang === 'tr'
              ? '⚠️ Panelde henüz etiketlenecek serial satırı yok.'
              : '⚠️ No serial lines received yet to tag.'
          );
          return;
        }
        lineIdx = panel.lines.length - 1;
        isLastLine = true;
      }

      if (lineIdx < 0 || lineIdx >= panel.lines.length) {
        return;
      }

      const existingPin = (panel.pins || []).find((p) => p.lineIndex === lineIdx);
      const lineText = panel.lines[lineIdx] || '';

      // If the exact same preset is already applied, toggle it off!
      if (existingPin && existingPin.tagPresetId === preset.id) {
        handleRemovePin(lineIdx);
        onNotification(
          lang === 'tr'
            ? `⚡ Satır ${lineIdx + 1} etiketi kaldırıldı: "${preset.description}"`
            : `⚡ Line ${lineIdx + 1} tag removed: "${preset.description}"`
        );
        return;
      }

      const newPin: LogPin = {
        id: existingPin ? existingPin.id : `pin_${Date.now()}_${lineIdx}`,
        lineIndex: lineIdx,
        timestamp: new Date().toLocaleTimeString(),
        note: preset.description,
        text: `${preset.emoji} ${preset.description}`,
        lineContent: lineText.slice(0, 150),
        tagPresetId: preset.id,
        shape: preset.shape,
        color: preset.color,
        emoji: preset.emoji,
        description: preset.description,
        key: preset.key,
      };

      const updated = (panel.pins || []).filter((p) => p.lineIndex !== lineIdx).concat(newPin);
      onUpdatePanel(panel.id, { pins: updated });

      const lineBadge = isLastLine
        ? (lang === 'tr' ? `[Son Satır #L${lineIdx + 1}]` : `[Latest Line #L${lineIdx + 1}]`)
        : `[#L${lineIdx + 1}]`;

      onNotification(
        `⚡ ${lineBadge} ${preset.emoji} "${preset.description}" (${preset.key})`
      );
    },
    [panel.lines, panel.pins, panel.id, lang, onNotification, onUpdatePanel]
  );

  // Set default active panel on mount
  useEffect(() => {
    if (!window.__lastActivePanelId) {
      window.__lastActivePanelId = panel.id;
    }
  }, [panel.id]);

  // Keyboard shortcut listener for Quick Tag Hotkeys (1, 2, 3...)
  // Presses apply to latest received line instantly during events (or hovered line if Shift held)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const preset = quickTagPresets.find(
        (p) => p.key.toLowerCase() === e.key.toLowerCase()
      );
      if (!preset) return;

      const activeId = window.__hoveredPanelId || window.__lastActivePanelId;
      const shouldHandle = activeId ? activeId === panel.id : panel.isConnected;
      if (!shouldHandle) return;

      e.preventDefault();

      // If user holds Shift AND is hovering over an older line, tag that specific hovered line!
      // Otherwise (normal hotkey press during event/runtime), tag the LATEST received serial line!
      if (e.shiftKey && hoveredLineIndex !== null) {
        handleApplyQuickTag(preset, hoveredLineIndex);
      } else {
        handleApplyQuickTag(preset);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickTagPresets, hoveredLineIndex, handleApplyQuickTag, panel.id, panel.isConnected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pinsMenuRef.current && !pinsMenuRef.current.contains(e.target as Node)) {
        setIsPinsMenuOpen(false);
      }
    };
    if (isPinsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPinsMenuOpen]);

  const handleTogglePin = (lineIndex: number, lineText: string) => {
    const existing = pinsMap.get(lineIndex);
    if (existing) {
      const nextText = window.prompt(
        lang === 'tr'
          ? `📌 Satır ${lineIndex + 1} pin / tag notunu düzenleyin (Silmek için boş bırakıp Tamam'a basın):`
          : `📌 Edit pin / tag note for line ${lineIndex + 1} (Leave empty to remove):`,
        existing.text || ''
      );
      if (nextText === null) return;
      const trimmed = nextText.trim();
      if (!trimmed) {
        handleRemovePin(lineIndex);
      } else {
        const updated = (panel.pins || []).map((p) =>
          p.lineIndex === lineIndex ? { ...p, text: trimmed } : p
        );
        onUpdatePanel(panel.id, { pins: updated });
        onNotification(lang === 'tr' ? `📌 Pin güncellendi: "${trimmed}"` : `📌 Pin updated: "${trimmed}"`);
      }
    } else {
      const userPrompt = window.prompt(
        lang === 'tr'
          ? `📌 Satır ${lineIndex + 1}'e pin / tag ekleyin (Kısayol tuşu [1-6] veya özel not yazın):`
          : `📌 Add pin / tag for line ${lineIndex + 1} (Enter hotkey [1-6] or custom note):`,
        ''
      );
      if (userPrompt === null) return;
      const trimmed = userPrompt.trim();
      const matchedPreset = quickTagPresets.find(
        (p) => p.key.toLowerCase() === trimmed.toLowerCase()
      );
      if (matchedPreset) {
        handleApplyQuickTag(matchedPreset, lineIndex);
        return;
      }
      const note = trimmed || `${new Date().toLocaleTimeString()} Pin eklendi`;
      const newPin: LogPin = {
        id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        lineIndex,
        text: note,
        timestamp: Date.now(),
        lineContent: lineText.slice(0, 150),
      };
      const updated = [...(panel.pins || []), newPin];
      onUpdatePanel(panel.id, { pins: updated });
      onNotification(
        lang === 'tr' ? `📌 Satır ${lineIndex + 1} pinlendi: "${note}"` : `📌 Line ${lineIndex + 1} pinned: "${note}"`
      );
    }
  };

  const handleRemovePin = (lineIndex: number) => {
    const updated = (panel.pins || []).filter((p) => p.lineIndex !== lineIndex);
    onUpdatePanel(panel.id, { pins: updated });
    onNotification(lang === 'tr' ? `📌 Satır ${lineIndex + 1} pini kaldırıldı.` : `📌 Line ${lineIndex + 1} pin removed.`);
  };

  const handleClearAllPins = () => {
    if (!window.confirm(lang === 'tr' ? 'Bu paneldeki tüm pinler silinsin mi?' : 'Remove all pins in this panel?')) return;
    onUpdatePanel(panel.id, { pins: [] });
    setIsPinsMenuOpen(false);
    onNotification(lang === 'tr' ? 'Tüm pinler temizlendi.' : 'All pins cleared.');
  };

  const handleJumpToLine = (lineIndex: number) => {
    setIsPinsMenuOpen(false);
    const el = document.getElementById(`line_${panel.id}_${lineIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1600);
    } else {
      onNotification(lang === 'tr' ? `Satır ${lineIndex + 1} görünümde değil (filtreli olabilir).` : `Line ${lineIndex + 1} not in view.`);
    }
  };

  // Auto Close Countdown timer
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const isAutoCloseActive =
      panel.isConnected &&
      !!panel.autoCloseEnabled &&
      !!panel.autoCloseTimeoutSec &&
      panel.autoCloseTimeoutSec > 0;

    if (isAutoCloseActive) {
      let timeLeft = panel.autoCloseTimeoutSec!;
      setRemainingSeconds(timeLeft);

      timerRef.current = window.setInterval(async () => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setRemainingSeconds(null);
          try {
            await invoke('disconnect_port', { sessionId: panel.id });
            onUpdatePanel(panel.id, { isConnected: false });
            onNotification(
              lang === 'tr'
                ? `⏱️ [${panel.port || 'Port'}] Otomatik kapatma süresi (${panel.autoCloseTimeoutSec}sn) tamamlandı. Port serbest bırakıldı.`
                : `⏱️ [${panel.port || 'Port'}] Auto-close timeout (${panel.autoCloseTimeoutSec}s) reached. Port released.`
            );
          } catch (err) {
            console.error('Auto close disconnect error:', err);
          }
        } else {
          setRemainingSeconds(timeLeft);
        }
      }, 1000);
    } else {
      setRemainingSeconds(null);
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    panel.isConnected,
    panel.autoCloseEnabled,
    panel.autoCloseTimeoutSec,
    panel.id,
    panel.port,
    lang,
    onNotification,
    onUpdatePanel,
  ]);

  const handleCancelAutoClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRemainingSeconds(null);
    onUpdatePanel(panel.id, { autoCloseEnabled: false });
    onNotification(
      lang === 'tr'
        ? `⏱️ [${panel.port || 'Port'}] Otomatik kapatma iptal edildi, port açık kalacak.`
        : `⏱️ [${panel.port || 'Port'}] Auto-close cancelled, port will stay open.`
    );
  };

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

  // Title Inline Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(panel.title);

  useEffect(() => {
    setTitleInput(panel.title);
  }, [panel.title]);

  const handleStartEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitleInput(panel.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== panel.title) {
      onUpdatePanel(panel.id, { title: trimmed });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTitleInput(panel.title);
    }
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

  // Load Script from File
  const handleLoadScriptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content !== undefined) {
        setCommandInput(content);
        setIsMultilineMode(true);
        onNotification(
          lang === 'tr'
            ? `📄 "${file.name}" yüklendi (${content.split(/\r?\n/).length} satır)`
            : `📄 Loaded "${file.name}" (${content.split(/\r?\n/).length} lines)`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Send Command (Supports Single-Line, Multiline with delay, and Local Shell commands)
  const handleSendCommand = async (cmdToSend?: string) => {
    const rawText = cmdToSend !== undefined ? cmdToSend : commandInput;
    const text = rawText.trim();
    if (!text) return;

    // 1. Shell command detection (! or $)
    const isShellCmd = text.startsWith('!') || text.startsWith('$');

    if (isShellCmd) {
      const cleanShellCmd = text.slice(1).trim();
      if (!cleanShellCmd) return;

      setIsSendingCmd(true);
      try {
        const result = await invoke<{
          ok: boolean;
          stdout: string;
          stderr: string;
          exit_code: number;
          duration_ms: number;
          platform: string;
          command: string;
        }>('execute_shell_command', {
          command: cleanShellCmd,
          cwd: undefined,
          timeoutSec: 60,
        });

        // Format shell output into lines to display directly in the panel
        const outputLines: string[] = [];
        outputLines.push(`[💻 KABUK $ ${cleanShellCmd}]`);
        if (result.stdout) {
          result.stdout.split(/\r?\n/).forEach((l) => {
            if (l.length > 0) outputLines.push(`  ${l}`);
          });
        }
        if (result.stderr) {
          result.stderr.split(/\r?\n/).forEach((l) => {
            if (l.length > 0) outputLines.push(`  ⚠️ ${l}`);
          });
        }
        outputLines.push(
          `[💻 KABUK BİTTİ - Kod: ${result.exit_code} (${result.duration_ms}ms, ${result.platform})]`
        );

        onUpdatePanel(panel.id, {
          lines: [...panel.lines, ...outputLines],
          rawLines: [...(panel.rawLines || panel.lines), ...outputLines],
          commandHistory: [...panel.commandHistory, rawText].slice(-50),
          historyIndex: panel.commandHistory.length + 1,
        });

        onNotification(
          lang === 'tr'
            ? `💻 Kabuk komutu tamamlandı: "${cleanShellCmd}" (Kod: ${result.exit_code})`
            : `💻 Shell command completed: "${cleanShellCmd}" (Code: ${result.exit_code})`
        );

        if (cmdToSend === undefined) {
          setCommandInput('');
        }
      } catch (err) {
        alert('Kabuk çalıştırma hatası: ' + String(err));
      } finally {
        setIsSendingCmd(false);
      }
      return;
    }

    // 2. Serial Command
    if (!panel.isConnected) {
      onNotification(
        lang === 'tr'
          ? '⚠️ Seri porta bağlı değilsiniz. Önce bağlanın.'
          : '⚠️ Not connected to serial port. Connect first.'
      );
      return;
    }

    setIsSendingCmd(true);
    try {
      const lines = rawText.split(/\r?\n/);
      if (lines.length > 1) {
        // Multiline send
        await invoke('send_multiline_data', {
          sessionId: panel.id,
          lines,
          eol,
          delayMs: lineDelayMs,
        });

        onNotification(
          lang === 'tr'
            ? `⚡ ${lines.length} satır gönderildi (${lineDelayMs}ms gecikme)`
            : `⚡ ${lines.length} lines sent (${lineDelayMs}ms delay)`
        );
      } else {
        // Single line send
        await invoke('send_data', {
          sessionId: panel.id,
          data: rawText + eol,
        });
      }

      // Update command history
      const history = [...panel.commandHistory, rawText];
      onUpdatePanel(panel.id, {
        commandHistory: history.slice(-50),
        historyIndex: history.length,
      });

      if (cmdToSend === undefined) {
        setCommandInput('');
      }
    } catch (err) {
      alert('Komut gönderme hatası: ' + String(err));
    } finally {
      setIsSendingCmd(false);
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

  // Copy all content of current panel
  const handleCopyAll = () => {
    const linesToCopy = displayedLines.map((l) => l.text);
    if (linesToCopy.length === 0) {
      onNotification(lang === 'tr' ? 'Kopyalanacak satır yok.' : 'No lines to copy.');
      return;
    }

    let header = `${panel.title || 'Panel 1'}:\n`;
    if (filterMatchingOnly && filterTerms.length > 0) {
      header = `filtered as: ${formatFilterDescription(filterTerms)}\n${header}`;
    }

    const fullText = header + linesToCopy.join('\n');
    navigator.clipboard.writeText(fullText);
    onNotification(
      lang === 'tr'
        ? `"${panel.title}" panoya kopyalandı (${linesToCopy.length} satır).`
        : `"${panel.title}" copied to clipboard (${linesToCopy.length} lines).`
    );
  };

  // Copy selected range
  const handleCopyRange = () => {
    if (panel.pointA === null || panel.pointB === null) return;
    const [start, end] = [Math.min(panel.pointA, panel.pointB), Math.max(panel.pointA, panel.pointB)];
    const selected = panel.lines.slice(start, end + 1).join('\n');
    let header = `[${panel.title || 'Panel'} (L${start + 1}-L${end + 1})]:\n`;
    if (filterMatchingOnly && filterTerms.length > 0) {
      header = `filtered as: ${formatFilterDescription(filterTerms)}\n${header}`;
    }
    navigator.clipboard.writeText(header + selected);
    onNotification(t('copiedRangeMsg', lang, { count: end - start + 1 }));
  };

  // Helper to get sanitized prefix for file naming
  const getFileTitlePrefix = () => {
    const raw = (panel.title || 'Panel')
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_')
      .replace(/^_+|_+$/g, '');
    return raw || 'Panel';
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
    const prefix = getFileTitlePrefix();
    const safePort = (panel.port || 'log').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const defaultName = `${prefix}_Range_${safePort}_L${start + 1}-L${end + 1}_${Date.now()}.log`;
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
    const prefix = getFileTitlePrefix();
    const safePort = (panel.port || 'log').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const defaultName = `${prefix}_${safePort}_${Date.now()}.log`;

    const pinsHeader = (panel.pins && panel.pins.length > 0) ? `Pins: ${JSON.stringify(panel.pins)}\n` : '';
    const header = `=== ESP32 SERIAL MONITOR PRO LOG ARCHIVE ===\nTitle: ${panel.title}\nPort: ${panel.port}\nTimestamp: ${new Date().toLocaleString()}\nLines: ${panel.lines.length}\n${pinsHeader}============================================\n\n`;
    const text = header + panel.lines.join('\n');

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

  const parseAndLoadLogContent = (filename: string, content: string) => {
    if (filename.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.lines)) {
          onUpdatePanel(panel.id, {
            lines: parsed.lines,
            rawLines: parsed.lines,
            pins: Array.isArray(parsed.pins) ? parsed.pins : [],
            title: `📌 ${parsed.title || filename}`,
            isReference: true,
          });
          onNotification(
            lang === 'tr'
              ? `JSON oturum yüklendi: ${filename} (${parsed.lines.length} satır, ${(parsed.pins || []).length} pin)`
              : `JSON session loaded: ${filename} (${parsed.lines.length} lines, ${(parsed.pins || []).length} pins)`
          );
          return;
        }
      } catch (err) {
        console.warn('Not JSON session:', err);
      }
    }

    let parsedPins: LogPin[] = [];
    const pinsMatch = content.match(/Pins:\s*(\[.*?\])(?:\r?\n|$)/);
    if (pinsMatch) {
      try {
        parsedPins = JSON.parse(pinsMatch[1]);
      } catch (err) {
        console.warn('Failed to parse pins from header:', err);
      }
    }

    const loadedLines = content.split(/\r?\n/);
    onUpdatePanel(panel.id, {
      lines: loadedLines,
      rawLines: loadedLines,
      pins: parsedPins,
      title: `📌 ${filename}`,
      isReference: true,
    });
    onNotification(
      lang === 'tr'
        ? `Log yüklendi: ${filename} (${loadedLines.length} satır${parsedPins.length > 0 ? `, ${parsedPins.length} pin` : ''})`
        : `Log loaded: ${filename} (${loadedLines.length} lines${parsedPins.length > 0 ? `, ${parsedPins.length} pins` : ''})`
    );
  };

  // Load log file from disk via native dialog or file input
  const handleOpenFile = async () => {
    try {
      const res = await invoke<[string, string] | null>('open_log_dialog');
      if (res) {
        const [filename, content] = res;
        parseAndLoadLogContent(filename, content);
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
      parseAndLoadLogContent(file.name, content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter lines if filterTerms are present and filterMatchingOnly is true (supports tag+-N context window)
  const displayedLines = useMemo(() => {
    if (filterTerms.length === 0 || !filterMatchingOnly) {
      return panel.lines.map((text, originalIndex) => ({ text, originalIndex }));
    }

    const { tagFilteredIndices, hasTagFilter, tagFilterTerms } = getTagMatchingIndices(
      panel.lines.length,
      panel.pins,
      filterTerms
    );

    const nonTagTerms = filterTerms.filter((t) => !tagFilterTerms.includes(t));

    return panel.lines
      .map((text, originalIndex) => ({ text, originalIndex }))
      .filter(({ text, originalIndex }) => {
        // Tag-based match (with +- N context window)
        if (hasTagFilter && tagFilteredIndices.has(originalIndex)) {
          return true;
        }
        // Non-tag textual filter match
        if (nonTagTerms.length > 0) {
          return isLineMatchingFilters(text, nonTagTerms, matchCase, isRegex, isVariableMode);
        }
        return false;
      });
  }, [panel.lines, panel.pins, filterTerms, filterMatchingOnly, matchCase, isRegex, isVariableMode]);

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
      onMouseEnter={() => {
        window.__hoveredPanelId = panel.id;
      }}
      onMouseLeave={() => {
        if (window.__hoveredPanelId === panel.id) {
          window.__hoveredPanelId = null;
        }
      }}
      onMouseDown={() => {
        window.__lastActivePanelId = panel.id;
      }}
      className="relative flex flex-col shrink-0 h-full bg-[#161824] border border-[#282b3d] rounded-lg shadow-xl overflow-hidden text-[#cdd6f4] select-none transition-shadow hover:shadow-2xl hover:border-[#3b3f5c]"
    >
      {/* 1. Panel Header */}
      <div className="flex flex-col border-b border-slate-800/90 bg-[#1c1e2e] p-2.5 gap-2">
        {/* Row 1: Title, Badges, Port, Baud, Connect & Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                panel.isConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : panel.isReference
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
              }`}
            >
              {panel.isConnected ? t('liveBadge', lang) : panel.isReference ? t('refBadge', lang) : 'OTURUM'}
            </span>
            {panel.isReconnecting && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse shrink-0">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span>{lang === 'tr' ? 'Yeniden Bağlanıyor...' : 'Reconnecting...'}</span>
              </span>
            )}
            {panel.isArmed && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0"
                title={lang === 'tr' ? 'Tetikleme Modu: Filtreli satırlar dışında kayıt tutulmaz' : 'Armed Mode: Noise discarded until trigger'}
              >
                <Target className="w-2.5 h-2.5 text-rose-400" />
                <span>ARMED</span>
              </span>
            )}
            {remainingSeconds !== null && (
              <button
                type="button"
                onClick={handleCancelAutoClose}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 hover:border-amber-400 transition-all shrink-0 animate-pulse"
                title={t('autoCloseRemaining', lang, { sec: remainingSeconds })}
              >
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                <span>⏱️ {remainingSeconds} {t('autoCloseSeconds', lang)}</span>
                <span className="text-[9px] opacity-75 ml-0.5 hover:text-white" title={lang === 'tr' ? 'İptal Et' : 'Cancel'}>✕</span>
              </button>
            )}
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleTitleKeyDown}
                className="bg-[#12141f] border border-cyan-500 rounded px-1.5 py-0.5 text-xs font-bold text-cyan-200 outline-none w-full max-w-[200px]"
              />
            ) : (
              <span
                onDoubleClick={handleStartEditTitle}
                className="text-xs font-bold text-slate-100 truncate cursor-pointer hover:text-cyan-300 transition-colors select-none"
                title={lang === 'tr' ? 'Çift tıklayarak yeniden adlandırın' : 'Double-click to rename'}
              >
                {panel.title}
              </span>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Pinned Lines Dropdown Menu */}
            <div className="relative" ref={pinsMenuRef}>
              <button
                onClick={() => setIsPinsMenuOpen(!isPinsMenuOpen)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  (panel.pins?.length || 0) > 0
                    ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 font-mono text-[10px]'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/40'
                }`}
                title={lang === 'tr' ? `📌 Pinler / Taglar (${panel.pins?.length || 0})` : `📌 Pins / Tags (${panel.pins?.length || 0})`}
              >
                <span className="text-xs">📌</span>
                {(panel.pins?.length || 0) > 0 && <span className="font-bold">{panel.pins!.length}</span>}
              </button>

              {isPinsMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#141624] border border-[#2d3047] rounded-lg shadow-2xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#25283b]">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <span>📌</span>
                      <span>{lang === 'tr' ? 'Pinler / Taglar' : 'Pinned Lines'}</span>
                      <span className="text-[10px] text-[#6c7086]">({panel.pins?.length || 0})</span>
                    </div>
                    {(panel.pins?.length || 0) > 0 && (
                      <button
                        onClick={handleClearAllPins}
                        className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        {lang === 'tr' ? 'Tümünü Sil' : 'Clear All'}
                      </button>
                    )}
                  </div>

                  {(!panel.pins || panel.pins.length === 0) ? (
                    <div className="p-3 text-center text-[11px] text-[#6c7086]">
                      {lang === 'tr' ? 'Henüz pin eklenmemiş. Satır numarasının yanındaki 📌 simgesine tıklayarak pin ekleyebilirsiniz.' : 'No pins added yet. Click 📌 next to any line number to pin.'}
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-[#1e2030]">
                      {panel.pins.map((pin) => (
                        <div
                          key={pin.id || pin.lineIndex}
                          className="pt-1.5 pb-1 flex items-start justify-between gap-1.5 hover:bg-[#1a1d2e] p-1 rounded group cursor-pointer"
                          onClick={() => handleJumpToLine(pin.lineIndex)}
                          title={lang === 'tr' ? 'Satıra gitmek için tıklayın' : 'Click to jump to line'}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-mono font-bold text-amber-400">L{pin.lineIndex + 1}</span>
                              <span className="text-white font-medium truncate">{pin.text}</span>
                            </div>
                            {pin.lineContent && (
                              <p className="text-[10px] text-[#6c7086] font-mono truncate mt-0.5">
                                {pin.lineContent}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePin(pin.lineIndex);
                            }}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                            title="Pini Sil"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Tag Hotkey Strip */}
            <div
              className="hidden md:flex items-center gap-1 bg-[#10121d] border border-[#25283b] rounded-md px-1.5 py-0.5 select-none"
              title={
                lang === 'tr'
                  ? '⚡ Hızlı Tag: Olay anında [1-6] tuşuna basarak veya tıklayarak son serial satırına anında tag ekleyin (Shift+Tuş: seçili satır)'
                  : '⚡ Quick Tag: Press [1-6] or click to stamp the latest serial line instantly (Shift+Key: hovered line)'
              }
            >
              {quickTagPresets.slice(0, 6).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyQuickTag(preset)}
                  className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#1f2337] transition cursor-pointer"
                  title={`[${preset.key}] ${preset.shape} ${preset.emoji} ${preset.description}\n(${
                    lang === 'tr'
                      ? 'Tıklayarak veya [1-6] ile son gelen serial satırını anında etiketleyin'
                      : 'Click or press [1-6] to tag the latest received line'
                  })`}
                >
                  <TagShapeIcon shape={preset.shape} color={preset.color} emoji={preset.emoji} size={14} />
                  <span className="font-mono text-[10px] text-slate-400 font-bold">{preset.key}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => onMakeReference(panel.id)}
              className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-md transition-colors cursor-pointer"
              title={t('makeRefTip', lang)}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopyAll}
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-700/40 rounded-md transition-colors cursor-pointer"
              title={lang === 'tr' ? 'Tüm içeriği kopyala' : 'Copy all content'}
            >
              <Copy className="w-3.5 h-3.5" />
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

          {/* Safe Connect Mode Badge / Toggle */}
          <button
            type="button"
            onClick={() => onUpdatePanel(panel.id, { resetOnConnect: !panel.resetOnConnect })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium transition cursor-pointer select-none shadow-sm ${
              panel.resetOnConnect
                ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300 hover:bg-amber-900/90'
                : 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/90'
            }`}
            title={
              panel.resetOnConnect
                ? (lang === 'tr'
                    ? '⚠️ Resetli Bağlantı Açık: Bağlanırken EN darbesi ile kart sıfırlanır. Tıklayarak güvenli (resetsiz) moda dönebilirsiniz.'
                    : '⚠️ Reset on Connect Active: EN pulse will reset chip on open. Click to switch to Safe Connect.')
                : (lang === 'tr'
                    ? '🛡️ Güvenli Bağlantı (Reset Kapalı): RTS ve DTR sinyalleri nötr tutulur, karta donanımsal reset ASLA verilmez. Tıklayarak resetli moda geçebilirsiniz.'
                    : '🛡️ Safe Connect (Reset Disabled): Neutral RTS/DTR lines guaranteed, zero reset. Click to toggle reset.')
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${panel.resetOnConnect ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>
              {panel.resetOnConnect
                ? (lang === 'tr' ? '⚠️ Resetli Bağlantı' : '⚠️ Reset Active')
                : (lang === 'tr' ? '🛡️ Güvenli Bağlantı (Reset Kapalı)' : '🛡️ Safe Connect (No Reset)')}
            </span>
          </button>

          {/* Connected Signals Indicator (DTR / RTS) */}
          {panel.isConnected && (
            <div
              className="flex items-center gap-1 text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 shrink-0"
              title={lang === 'tr' ? 'UART Donanım Kontrol Hatları (Nötr / Reset Yok)' : 'UART Control Lines (Neutral / Zero Reset)'}
            >
              <span className="text-emerald-400 font-bold">DTR: 0</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-bold">RTS: 0</span>
            </div>
          )}

          {/* Auto Reconnect */}
          <label
            className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-slate-300 hover:text-cyan-300 transition-colors"
            title={t('autoReconnectTip', lang)}
          >
            <input
              type="checkbox"
              checked={panel.autoReconnect}
              onChange={(e) => onUpdatePanel(panel.id, { autoReconnect: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>{t('autoReconnect', lang)}</span>
          </label>

          {/* Auto Close Timeout */}
          <div
            className="flex items-center gap-1.5 bg-[#121422] border border-[#2e324a] px-2 py-0.5 rounded text-[11px] select-none hover:border-amber-500/50 transition-colors shrink-0"
            title={t('autoCloseTip', lang)}
          >
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!panel.autoCloseEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const fallback = defaultAutoCloseSec || 30;
                  onUpdatePanel(panel.id, {
                    autoCloseEnabled: checked,
                    autoCloseTimeoutSec: checked
                      ? (panel.autoCloseTimeoutSec && panel.autoCloseTimeoutSec > 0 ? panel.autoCloseTimeoutSec : fallback)
                      : panel.autoCloseTimeoutSec,
                  });
                }}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className={panel.autoCloseEnabled ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                {t('autoClose', lang)}
              </span>
            </label>

            <input
              type="number"
              min="1"
              max="86400"
              placeholder={String(defaultAutoCloseSec || 30)}
              value={panel.autoCloseTimeoutSec ?? ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val === '') {
                  onUpdatePanel(panel.id, {
                    autoCloseTimeoutSec: undefined,
                    autoCloseEnabled: false,
                  });
                } else {
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) {
                    onUpdatePanel(panel.id, {
                      autoCloseTimeoutSec: num,
                      autoCloseEnabled: true,
                    });
                  }
                }
              }}
              className="w-11 bg-[#0a0b12] border border-[#2a2d42] focus:border-amber-500 text-amber-300 text-[11px] rounded px-1 py-0 text-center font-mono outline-none"
              title={lang === 'tr' ? 'Saniye olarak süre girin (boş bırakılırsa hep açık kalır)' : 'Enter seconds (leave blank to stay open indefinitely)'}
            />
            <span className="text-[10px] text-slate-400 font-mono">{t('autoCloseSeconds', lang)}</span>
          </div>

          {/* Abort / Cancel Transfer Button */}
          {panel.isConnected && (
            <button
              onClick={async () => {
                try {
                  await invoke('cancel_active_session', { sessionId: panel.id });
                  onNotification(lang === 'tr' ? '⚠️ Devam eden aktarım durduruldu (İptal).' : '⚠️ Ongoing transfer cancelled.');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-[11px] font-mono transition cursor-pointer"
              title={lang === 'tr' ? 'Devam eden çok satırlı gönderimi veya işlemi iptal et' : 'Abort ongoing send or exec operation'}
            >
              <X className="w-3 h-3 text-rose-400" />
              <span>{lang === 'tr' ? 'İptal' : 'Abort'}</span>
            </button>
          )}

          {/* Hardware Reset (EN) */}
          <button
            onClick={handleHardwareReset}
            disabled={!panel.isConnected}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50 rounded disabled:opacity-40 transition-colors font-mono font-medium text-[11px]"
            title={t('hwResetTip', lang)}
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>⚡ EN Reset</span>
          </button>

          {/* Bootloader Mode (IO0) */}
          <button
            onClick={handleBootloader}
            disabled={!panel.isConnected}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-700/50 rounded disabled:opacity-40 transition-colors font-mono font-medium text-[11px]"
            title={t('bootloaderTip', lang)}
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>IO0 Boot</span>
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
        {/* Invisible header line for Ctrl+A selection */}
        {displayedLines.length > 0 && (
          <div
            className="select-text pointer-events-none"
            style={{
              height: '1px',
              marginTop: '-1px',
              opacity: 0,
              overflow: 'hidden',
              whiteSpace: 'pre',
              fontSize: '1px',
              lineHeight: '1px',
            }}
            aria-hidden="true"
          >
            {`${filterMatchingOnly && filterTerms.length > 0 ? `filtered as: ${formatFilterDescription(filterTerms)}\n` : ''}${panel.title || 'Panel 1'}:\n`}
          </div>
        )}
        {displayedLines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic select-none">
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

            // Check if line matches filter to get specific tag theme
            const matchingTerm =
              filterTerms.length > 0
                ? getFirstMatchingFilterTerm(text, filterTerms, matchCase, isRegex, isVariableMode)
                : null;

            const tagTheme = matchingTerm
              ? getTagThemeByTag(matchingTerm, allFilterTags || filterTerms)
              : null;

            return (
              <div
                key={originalIndex}
                id={`line_${panel.id}_${originalIndex}`}
                onMouseEnter={() => setHoveredLineIndex(originalIndex)}
                onMouseLeave={() => setHoveredLineIndex((prev) => (prev === originalIndex ? null : prev))}
                className={`flex items-start group min-w-max hover:bg-slate-800/30 transition-colors rounded ${
                  isInRange
                    ? 'bg-sky-500/15 border-l-2 border-sky-400'
                    : pinsMap.has(originalIndex)
                    ? 'bg-amber-500/15 border-l-2 border-amber-400 shadow-[inset_2px_0_0_0_#f59e0b]'
                    : hasHighlightWord
                    ? 'bg-amber-500/10'
                    : tagTheme
                    ? `${tagTheme.lineBgClass} ${tagTheme.lineBorderClass}`
                    : ''
                }`}
              >
                {/* Gutter Line Number & Clickable Dot/Pin Marker */}
                <div
                  className="w-14 shrink-0 select-none text-right pr-2 text-slate-600 group-hover:text-slate-400 cursor-pointer flex items-center justify-end gap-1 font-mono"
                  style={{
                    fontSize: `${Math.max(9, terminalFontSize - 1)}px`,
                    lineHeight: `${Math.max(16, Math.round(terminalFontSize * 1.45))}px`,
                  }}
                >
                  {pinsMap.has(originalIndex) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(originalIndex, text);
                      }}
                      className="p-0.5 rounded transition cursor-pointer shrink-0"
                      title={
                        pinsMap.get(originalIndex)?.description
                          ? `${pinsMap.get(originalIndex)?.emoji || '📌'} ${pinsMap.get(originalIndex)?.description} (L${originalIndex + 1})\n(${lang === 'tr' ? 'Düzenlemek/silmek için tıklayın' : 'Click to edit/remove'})`
                          : `📌 Pin: ${pinsMap.get(originalIndex)?.text}\n(${lang === 'tr' ? 'Düzenlemek/silmek için tıklayın' : 'Click to edit/remove'})`
                      }
                    >
                      {pinsMap.get(originalIndex)?.shape ? (
                        <TagShapeIcon
                          shape={pinsMap.get(originalIndex)!.shape!}
                          color={pinsMap.get(originalIndex)!.color || '#f59e0b'}
                          emoji={pinsMap.get(originalIndex)!.emoji}
                          size={16}
                        />
                      ) : (
                        <span className="text-amber-400 opacity-100 scale-110">📌</span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(originalIndex, text);
                      }}
                      className="p-0.5 rounded transition text-[10px] cursor-pointer opacity-0 group-hover:opacity-70 text-slate-500 hover:text-amber-300 hover:opacity-100 shrink-0"
                      title={lang === 'tr' ? 'Satıra pin / tag ekle (veya 1-6 tuşuna basın)' : 'Add pin / tag (or press 1-6)'}
                    >
                      📌
                    </button>
                  )}

                  {isPointA ? (
                    <span
                      onClick={() => handleGutterClick(originalIndex)}
                      className="w-4 h-4 bg-emerald-500 text-slate-950 font-black rounded-full flex items-center justify-center text-[10px] shadow"
                    >
                      A
                    </span>
                  ) : isPointB ? (
                    <span
                      onClick={() => handleGutterClick(originalIndex)}
                      className="w-4 h-4 bg-rose-500 text-white font-black rounded-full flex items-center justify-center text-[10px] shadow"
                    >
                      B
                    </span>
                  ) : (
                    <span
                      onClick={() => handleGutterClick(originalIndex)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity hover:text-emerald-400"
                    >
                      •
                    </span>
                  )}
                  <span onClick={() => handleGutterClick(originalIndex)}>{originalIndex + 1}</span>
                </div>

                {/* Log Line Content with optional Pin Tag Badge */}
                <div
                  className="flex-1 pl-1 pr-2 py-0.5 break-all select-text flex items-baseline gap-1.5"
                  style={{
                    fontFamily: getFontCss(terminalFont),
                    fontSize: `${terminalFontSize}px`,
                    lineHeight: `${Math.max(16, Math.round(terminalFontSize * 1.45))}px`,
                  }}
                >
                  {pinsMap.has(originalIndex) && (() => {
                    const pin = pinsMap.get(originalIndex)!;
                    const pinColor = pin.color || '#f59e0b';
                    return (
                      <span
                        onClick={() => handleTogglePin(originalIndex, text)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border select-none cursor-pointer transition-all shadow-sm hover:brightness-110 shrink-0"
                        style={{
                          backgroundColor: `${pinColor}28`,
                          borderColor: `${pinColor}88`,
                          color: '#ffffff',
                        }}
                        title={`${pin.emoji || '📌'} ${pin.description || pin.text || pin.note} (L${originalIndex + 1}) - ${lang === 'tr' ? 'Düzenlemek/silmek için tıklayın' : 'Click to edit/remove'}`}
                      >
                        {pin.shape ? (
                          <TagShapeIcon
                            shape={pin.shape}
                            color={pinColor}
                            emoji={pin.emoji}
                            size={15}
                          />
                        ) : (
                          <span>📌</span>
                        )}
                        <span className="font-semibold text-xs drop-shadow text-white">
                          {pin.description || pin.text || pin.note}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePin(originalIndex);
                          }}
                          className="text-slate-300 hover:text-white hover:bg-rose-500/50 rounded px-1 ml-0.5 cursor-pointer"
                          title="Pini Sil"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })()}
                  <SyntaxHighlighter
                    line={text}
                    highlightWord={globalHighlightWord}
                    filterTerms={filterTerms}
                    allFilterTags={allFilterTags}
                    matchCase={matchCase}
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
        <input
          type="file"
          ref={scriptInputRef}
          onChange={handleLoadScriptFile}
          className="hidden"
          accept=".py,.lua,.txt,.gcode,.sh,.json,.c,.cpp,.ino"
        />

        {isMultilineMode ? (
          <div className="flex flex-col gap-1.5 bg-[#10111a] border border-cyan-500/40 rounded-lg p-2 transition-all shadow-lg">
            {/* Multiline Header Toolbar */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1 text-cyan-400">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{lang === 'tr' ? 'Çok Satırlı Komut / Script' : 'Multiline Command / Script'}</span>
                </span>
                {(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$')) && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold flex items-center gap-1">
                    <Terminal className="w-2.5 h-2.5" />
                    <span>KABUK / SHELL</span>
                  </span>
                )}
                <span className="text-[10px] text-slate-500 font-mono">
                  ({commandInput.split(/\r?\n/).filter(Boolean).length} {lang === 'tr' ? 'satır' : 'lines'})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Delay selector */}
                {!(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$')) && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">{lang === 'tr' ? 'Gecikme:' : 'Delay:'}</span>
                    <select
                      value={lineDelayMs}
                      onChange={(e) => setLineDelayMs(Number(e.target.value))}
                      className="bg-[#181a27] border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none"
                    >
                      <option value={0}>0 ms (Ham Blok)</option>
                      <option value={20}>20 ms</option>
                      <option value={50}>50 ms (ESP32 REPL)</option>
                      <option value={100}>100 ms (AT Komutları)</option>
                      <option value={250}>250 ms</option>
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => scriptInputRef.current?.click()}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                  title={lang === 'tr' ? 'Dosyadan script yükle (.py, .lua, .txt, .gcode)' : 'Load script from file'}
                >
                  <FolderOpen className="w-2.5 h-2.5" />
                  <span>{lang === 'tr' ? 'Dosya Yükle' : 'Load File'}</span>
                </button>

                {commandInput && (
                  <button
                    type="button"
                    onClick={() => setCommandInput('')}
                    className="px-1.5 py-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-[10px] transition cursor-pointer"
                  >
                    {lang === 'tr' ? 'Temizle' : 'Clear'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsMultilineMode(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={lang === 'tr' ? 'Tek satırlı moda dön' : 'Switch to single-line mode'}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Multiline Textarea */}
            <textarea
              rows={4}
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSendCommand();
                }
              }}
              placeholder={
                lang === 'tr'
                  ? 'Çok satırlı komutlarınızı veya scriptinizi buraya yazın/yapıştırın...\n(Ctrl+Enter: Gönder, Satır başı ! veya $: Kabuk komutu)'
                  : 'Write or paste multiline commands or script here...\n(Ctrl+Enter: Send, ! or $ prefix: Shell command)'
              }
              className="w-full bg-[#090a0f] border border-slate-700/60 rounded p-2 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y min-h-[70px] max-h-[220px]"
            />

            {/* Multiline Footer Controls */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span>💡 <b>Ctrl + Enter</b> {lang === 'tr' ? 'ile gönderin' : 'to send'}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={eol}
                  onChange={(e) => setEol(e.target.value)}
                  className="bg-[#181a27] border border-slate-700/60 rounded px-1.5 py-1 text-[11px] text-slate-400 focus:outline-none font-mono"
                >
                  <option value="\r\n">CR+LF</option>
                  <option value="\n">LF</option>
                  <option value="\r">CR</option>
                  <option value="">None</option>
                </select>

                <button
                  onClick={() => handleSendCommand()}
                  disabled={
                    (!panel.isConnected &&
                      !(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$'))) ||
                    !commandInput.trim() ||
                    isSendingCmd
                  }
                  className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold disabled:opacity-40 transition-colors shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  {isSendingCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  <span>
                    {commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$')
                      ? lang === 'tr'
                        ? 'Kabukta Çalıştır'
                        : 'Run in Shell'
                      : lang === 'tr'
                      ? `Gönder (${commandInput.split(/\r?\n/).filter(Boolean).length || 1} Satır)`
                      : `Send (${commandInput.split(/\r?\n/).filter(Boolean).length || 1} Lines)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* Shell badge if input starts with ! or $ */}
            {(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$')) && (
              <span className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0 animate-in fade-in">
                <Terminal className="w-3 h-3" />
                <span>KABUK</span>
              </span>
            )}

            <input
              type="text"
              value={commandInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes('\n')) {
                  setCommandInput(val);
                  setIsMultilineMode(true);
                } else {
                  setCommandInput(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) {
                    e.preventDefault();
                    setIsMultilineMode(true);
                  } else {
                    handleSendCommand();
                  }
                } else {
                  handleKeyDown(e);
                }
              }}
              placeholder={
                lang === 'tr'
                  ? 'Komut yazın... (! veya $ ile kabuk komutu, Shift+Enter: Çok satırlı)'
                  : 'Type command... (! or $ for shell, Shift+Enter: Multiline)'
              }
              disabled={
                !panel.isConnected &&
                !(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$'))
              }
              className="flex-1 bg-[#10111a] border border-slate-700/60 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 disabled:opacity-40"
            />

            {/* Multiline Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMultilineMode(true)}
              className="p-1 rounded bg-[#10111a] border border-slate-700/60 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
              title={lang === 'tr' ? 'Çok satırlı script / komut moduna geç (Shift+Enter)' : 'Switch to multiline script mode'}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

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
              disabled={
                (!panel.isConnected &&
                  !(commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$'))) ||
                !commandInput.trim() ||
                isSendingCmd
              }
              className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isSendingCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>
                {commandInput.trim().startsWith('!') || commandInput.trim().startsWith('$')
                  ? lang === 'tr'
                    ? 'Kabuk'
                    : 'Shell'
                  : t('send', lang)}
              </span>
            </button>
          </div>
        )}

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
              {filterMatchingOnly && filterTerms.length > 0
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
