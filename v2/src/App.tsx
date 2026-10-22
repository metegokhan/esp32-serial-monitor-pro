import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PanelSession, SerialDeviceInfo, SerialDataPayload, SerialStatusPayload, I18nLanguage, FilterPreset, AutoNamingConfig, TriggerActionsConfig, AiCommandLog, LogPin, AiModelClient } from './types';
import { LogPanel } from './LogPanel';
import { ArchiveModal } from './ArchiveModal';
import { AboutModal } from './AboutModal';
import { FilterPresetsModal } from './FilterPresetsModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { TriggerSettingsModal } from './TriggerSettingsModal';
import { AiActivityModal } from './AiActivityModal';
import { t } from './i18n';
import { isLineMatchingFilters, formatFilterDescription } from './filterUtils';
import { getTagThemeByIndex } from './filterColors';
import { evaluateAutoNaming } from './autoNaming';
import { loadTriggerConfig, saveTriggerConfig, executeTriggerActions } from './triggerActions';
import {
  Plus,
  FolderOpen,
  Search,
  Trash2,
  Copy,
  Languages,
  Sparkles,
  Layers,
  Filter,
  Terminal,
  Type,
  Minus,
  Bookmark,
  Target,
  Cloud,
  Bot,
} from 'lucide-react';
import { FONT_OPTIONS } from './fontConfig';

const DEMO_LOGS_1 = [
  "[12:00:01.010] [INFO] System initialized. Chip: ESP32-D0WDQ6 (revision 1)",
  "[12:00:01.120] [INFO] Mounting virtual filesystem (/spiffs)... OK",
  "[12:00:01.250] [INFO] Network interface initialized. MAC: 24:6F:28:AB:CD:EF",
  "[12:00:01.400] [INFO] Connecting to AP 'Office_WiFi_2.4G'...",
  "[12:00:02.150] [INFO] WiFi Connected! IP: 192.168.1.105, Gateway: 192.168.1.1",
  "[12:00:02.320] [INFO] MQTT client connecting to mqtt://broker.emqx.io:1883...",
  "[12:00:02.890] [INFO] MQTT connected successfully. Subscribed to 'devices/sensor/cmd'",
  "[12:00:03.010] [DATA] Telemetry #1: temp=24.5C, humidity=48%, pressure=1013hPa",
  "[12:00:04.010] [DATA] Telemetry #2: temp=24.6C, humidity=48%, pressure=1013hPa",
  "[12:00:05.010] [DATA] Telemetry #3: temp=24.7C, humidity=47%, pressure=1013hPa",
  "[12:00:06.010] [DATA] Telemetry #4: temp=24.6C, humidity=48%, pressure=1013hPa",
  "[12:00:07.010] [DATA] Telemetry #5: temp=24.8C, humidity=47%, pressure=1013hPa",
  "[12:00:08.010] [DATA] Telemetry #6: temp=25.0C, humidity=46%, pressure=1013hPa",
  "[12:00:09.010] [INFO] Periodic memory check: free_heap=184320 bytes, min_free=180100",
  "[12:00:10.010] [vid] fps : 15 sync : true drop  = 3 audio= 123",
  "[12:00:11.010] [vid] fps : 16 sync : true drop  = 3 audio= 121",
  "[12:00:12.010] [vid] fps : 10 sync : false drop  = 3 audio= 120",
  "[12:00:13.010] [sensor] gercek aralik 69 ms latency 12 ms"
];

const DEMO_LOGS_2 = [
  "[11:45:00.001] ESP-ROM:esp32-20190601 Build:Jun 1 2019",
  "[11:45:00.012] rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
  "[11:45:00.025] configsip: 0, SPIWP:0xee",
  "[11:45:00.038] clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00",
  "[11:45:00.050] mode:DIO, clock div:2",
  "[11:45:00.065] load:0x3fff0018,len:4",
  "[11:45:00.078] load:0x3fff001c,len:1044",
  "[11:45:00.092] load:0x40078000,len:8896",
  "[11:45:00.105] load:0x40080400,len:5816",
  "[11:45:00.120] entry 0x400806ac",
  "[11:45:00.150] [INFO] Bootloader starting in normal mode",
  "[11:45:00.180] [INFO] Flash size: 4MB, Flash frequency: 40MHz",
  "[11:45:00.220] [INFO] Application partition loaded at 0x10000",
  "[11:45:00.250] [INFO] Starting main application task..."
];

const DEMO_LOGS_3 = [
  "[11:50:00.100] [UART] Initializing UART2 at 115200 baud (TX=17, RX=16)...",
  "[11:50:00.105] [UART] Ready for external packet transmission",
  "[11:50:01.002] [TX] 0xAA 0x05 0x01 0x20 0x55 [PING]",
  "[11:50:01.015] [RX] 0xAA 0x05 0x02 0x20 0x56 [PONG] (latency: 13ms)",
  "[11:50:02.002] [TX] 0xAA 0x08 0x10 0x00 0x00 0x00 0x01 0xB3 [GET_STATUS]",
  "[11:50:02.020] [RX] 0xAA 0x08 0x11 0x01 0x00 0x00 0x00 0xB4 [STATUS_OK]",
  "[11:50:03.002] [TX] 0xAA 0x06 0x30 0xFF 0x00 0x34 [SET_LED]",
  "[11:50:03.018] [RX] 0xAA 0x06 0x31 0x00 0x00 0x37 [ACK]",
  "[11:50:04.002] [TX] 0xAA 0x05 0x01 0x20 0x55 [PING]",
  "[11:50:04.015] [RX] 0xAA 0x05 0x02 0x20 0x56 [PONG] (latency: 13ms)",
  "[11:50:05.000] [UART] Packet test completed: 5 packets sent, 0 dropped"
];

function createSession(
  port: string = '',
  isReference: boolean = false,
  initialLines: string[] = [],
  title?: string,
  defaultAutoCloseSec?: number
): PanelSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title: title || (isReference ? `Ref: ${port || 'Log'}` : 'Panel 1'),
    port,
    baudRate: 115200,
    isConnected: false,
    isReconnecting: false,
    autoReconnect: true,
    reconnectAttempts: 0,
    resetOnConnect: false,
    autoScroll: true,
    showTimestamps: false,
    lines: initialLines,
    rawLines: initialLines,
    pointA: null,
    pointB: null,
    rxBytes: 0,
    txBytes: 0,
    isReference,
    width: 600,
    commandHistory: [],
    historyIndex: -1,
    autoNamingRule: 'esp-rom:',
    autoNamingEnabled: true,
    isArmed: false,
    wasTriggered: false,
    autoCloseEnabled: false,
    autoCloseTimeoutSec: defaultAutoCloseSec || 30,
    pins: [],
  };
}

export function App() {
  const [lang, setLang] = useState<I18nLanguage>(() => {
    const saved = localStorage.getItem('esp32_monitor_lang');
    return saved === 'en' ? 'en' : 'tr';
  });

  const [availablePorts, setAvailablePorts] = useState<SerialDeviceInfo[]>([]);
  const [panels, setPanels] = useState<PanelSession[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [searchTagInput, setSearchTagInput] = useState('');
  const [filterMatchingOnly, setFilterMatchingOnly] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [isVariableMode, setIsVariableMode] = useState(false);
  const [globalHighlightWord, setGlobalHighlightWord] = useState('');
  const [triggerTags, setTriggerTags] = useState<string[]>([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isFilterPresetsModalOpen, setIsFilterPresetsModalOpen] = useState(false);
  const [isGDriveModalOpen, setIsGDriveModalOpen] = useState(false);
  const [isTriggerSettingsModalOpen, setIsTriggerSettingsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiLogs, setAiLogs] = useState<AiCommandLog[]>(() => {
    try {
      const saved = localStorage.getItem('esp32_ai_command_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleClearAiLogs = () => {
    setAiLogs([]);
    localStorage.removeItem('esp32_ai_command_logs');
  };
  const [connectedAiModels, setConnectedAiModels] = useState<AiModelClient[]>([]);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Max log capacity setting
  const [maxLogCapacity, setMaxLogCapacity] = useState<number>(() => {
    const saved = Number(localStorage.getItem('serial_max_log_capacity'));
    return saved && saved >= 100 ? saved : 5000;
  });

  // Trigger actions configuration
  const [triggerConfig, setTriggerConfig] = useState<TriggerActionsConfig>(() => loadTriggerConfig());

  // Auto naming configuration
  const [autoNaming, setAutoNaming] = useState<AutoNamingConfig>(() => {
    try {
      const saved = localStorage.getItem('serial_auto_naming_config');
      return saved ? JSON.parse(saved) : { enabled: true, rule: 'esp-rom:' };
    } catch {
      return { enabled: true, rule: 'esp-rom:' };
    }
  });

  // Terminal typography settings with persistence
  const [terminalFont, setTerminalFont] = useState<string>(
    () => localStorage.getItem('serial_terminal_font') || 'JetBrains Mono'
  );
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem('serial_terminal_font_size'));
    return saved && saved >= 9 && saved <= 24 ? saved : 12;
  });

  // Reconnect timers map
  const reconnectTimers = useRef<Map<string, number>>(new Map());

  // Default Auto-Close Timeout (seconds)
  const [defaultAutoCloseSec, setDefaultAutoCloseSec] = useState<number>(() => {
    const saved = Number(localStorage.getItem('serial_default_auto_close_sec'));
    return saved && saved > 0 ? saved : 30;
  });

  const handleUpdateDefaultAutoCloseSec = (sec: number) => {
    setDefaultAutoCloseSec(sec);
    localStorage.setItem('serial_default_auto_close_sec', String(sec));
  };

  // Refs for asynchronous Tauri serial event listener to avoid stale closures
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const triggerConfigRef = useRef(triggerConfig);
  triggerConfigRef.current = triggerConfig;
  const autoNamingRef = useRef(autoNaming);
  autoNamingRef.current = autoNaming;
  const filterTagsRef = useRef(filterTags);
  filterTagsRef.current = filterTags;
  const triggerTagsRef = useRef(triggerTags);
  triggerTagsRef.current = triggerTags;
  const matchCaseRef = useRef(matchCase);
  matchCaseRef.current = matchCase;
  const isRegexRef = useRef(isRegex);
  isRegexRef.current = isRegex;
  const isVariableModeRef = useRef(isVariableMode);
  isVariableModeRef.current = isVariableMode;
  const maxLogCapacityRef = useRef(maxLogCapacity);
  maxLogCapacityRef.current = maxLogCapacity;
  const langRef = useRef(lang);
  langRef.current = lang;

  const handleUpdateMaxLogCapacity = (cap: number) => {
    setMaxLogCapacity(cap);
    localStorage.setItem('serial_max_log_capacity', String(cap));
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        lines: p.lines.slice(-cap),
        rawLines: p.rawLines.slice(-cap),
      }))
    );
  };

  const handleUpdateAutoNaming = (cfg: AutoNamingConfig) => {
    setAutoNaming(cfg);
    localStorage.setItem('serial_auto_naming_config', JSON.stringify(cfg));
  };

  const handleUpdateTriggerConfig = (cfg: TriggerActionsConfig) => {
    setTriggerConfig(cfg);
    saveTriggerConfig(cfg);
    setPanels((prev) => prev.map((p) => ({ ...p, isArmed: cfg.armedMode })));
  };

  const handleZoomIn = useCallback(() => {
    setTerminalFontSize((prev) => {
      const next = Math.min(24, prev + 1);
      localStorage.setItem('serial_terminal_font_size', String(next));
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setTerminalFontSize((prev) => {
      const next = Math.max(9, prev - 1);
      localStorage.setItem('serial_terminal_font_size', String(next));
      return next;
    });
  }, []);

  const handleFontChange = (newFont: string) => {
    setTerminalFont(newFont);
    localStorage.setItem('serial_terminal_font', newFont);
  };

  const handleFontSizeChange = (newSize: number) => {
    setTerminalFontSize(newSize);
    localStorage.setItem('serial_terminal_font_size', String(newSize));
  };

  // Keyboard zoom shortcut (Ctrl + = / Ctrl + - / Ctrl + 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        handleZoomOut();
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        handleFontSizeChange(12);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut]);

  // Close font menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setIsFontMenuOpen(false);
      }
    };
    if (isFontMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFontMenuOpen]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Language change
  const handleToggleLang = () => {
    const next: I18nLanguage = lang === 'tr' ? 'en' : 'tr';
    setLang(next);
    localStorage.setItem('esp32_monitor_lang', next);
  };

  // Scan serial ports
  const refreshPorts = useCallback(async () => {
    try {
      const ports: SerialDeviceInfo[] = await invoke('scan_ports', { filter: '' });
      setAvailablePorts(ports);
      return ports;
    } catch (err) {
      console.error('Scan ports error:', err);
      return [];
    }
  }, []);

  // Auto Reconnect Engine
  const startAutoReconnect = useCallback(
    (sessionId: string, portName: string, baudRate: number, resetOnConnect: boolean) => {
      if (reconnectTimers.current.has(sessionId)) {
        window.clearInterval(reconnectTimers.current.get(sessionId));
      }

      const intervalId = window.setInterval(async () => {
        try {
          const currentPorts: SerialDeviceInfo[] = await invoke('scan_ports', { filter: '' });
          const portExists = currentPorts.some((p) => p.port_name === portName);
          if (portExists) {
            await invoke('connect_port', {
              sessionId,
              portName,
              baudRate,
              resetOnConnect,
            });

            window.clearInterval(intervalId);
            reconnectTimers.current.delete(sessionId);
            setPanels((prev) =>
              prev.map((p) => (p.id === sessionId ? { ...p, isConnected: true, isReconnecting: false } : p))
            );
            showToast(
              langRef.current === 'tr'
                ? `✅ [${portName}] Bağlantı otomatik olarak yeniden sağlandı!`
                : `✅ [${portName}] Connection automatically restored!`
            );
          }
        } catch {
          // Port opening or still waiting, retry next interval
        }
      }, 1500);

      reconnectTimers.current.set(sessionId, intervalId);
    },
    [showToast]
  );

  // Initial port discovery and initial panel
  useEffect(() => {
    refreshPorts().then((ports) => {
      const defaultPort = ports.length > 0 ? ports[0].port_name : '/dev/ttyUSB0';
      const demo = new URLSearchParams(window.location.search).get('preview') || localStorage.getItem('esp32_demo_mode');
      if (demo === 'multipanel' || demo === 'filtered') {
        const p1 = createSession(defaultPort, false, DEMO_LOGS_1, 'Port: /dev/ttyUSB0 (ESP32 Live Stream)');
        p1.isConnected = true;
        p1.rxBytes = 18450;

        const p2 = createSession('', true, DEMO_LOGS_2, 'Ref: ESP32 Bootloader Log');
        p2.pointA = 3;
        p2.pointB = 10;

        const p3 = createSession('', true, DEMO_LOGS_3, 'Ref: UART Protocol Packets');

        setPanels([p1, p2, p3]);
        if (demo === 'filtered') {
          setFilterTags(['[DATA]']);
          setFilterMatchingOnly(true);
        } else {
          setGlobalHighlightWord('Telemetry');
        }
      } else {
        setPanels([createSession(defaultPort, false, [], 'Panel 1')]);
      }
    });

    const interval = setInterval(() => {
      refreshPorts();
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshPorts]);

  // Setup Tauri Serial Event Listeners
  useEffect(() => {
    let unlistenData: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;
    let unlistenAiAction: (() => void) | undefined;
    let unlistenAiCommand: (() => void) | undefined;
    let unlistenAiModels: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenData = await listen<SerialDataPayload>('serial-data', (event) => {
        const payload = event.payload;
        const currentPanels = panelsRef.current;
        const targetPanel = currentPanels.find((p) => p.id === payload.session_id);
        if (!targetPanel) return;

        // 1. Auto-naming rule evaluation
        let updatedTitle = targetPanel.title;
        if (autoNamingRef.current.enabled) {
          const extracted = evaluateAutoNaming(payload.line, autoNamingRef.current.rule);
          if (
            extracted &&
            extracted !== targetPanel.title &&
            (targetPanel.title.startsWith('Panel') ||
              targetPanel.title.startsWith('Port:') ||
              targetPanel.title.includes('esp32') ||
              !targetPanel.title)
          ) {
            updatedTitle = extracted;
            showToast(
              langRef.current === 'tr'
                ? `🏷️ Otomatik İsimlendirildi: "${extracted}"`
                : `🏷️ Auto-Named: "${extracted}"`
            );
          }
        }

        // 2. Check trigger tags
        let triggerMatched = false;
        let matchedTriggerWord = '';
        if (triggerTagsRef.current.length > 0) {
          for (const trig of triggerTagsRef.current) {
            const trimmed = trig.trim();
            if (trimmed && payload.line.toLowerCase().includes(trimmed.toLowerCase())) {
              triggerMatched = true;
              matchedTriggerWord = trimmed;
              break;
            }
          }
        }

        // Trigger action execution
        if (triggerMatched) {
          executeTriggerActions(
            triggerConfigRef.current,
            {
              panelId: targetPanel.id,
              port: targetPanel.port,
              panelTitle: updatedTitle,
              matchedLine: payload.line,
              triggerWord: matchedTriggerWord,
            },
            {
              onNotification: showToast,
              onSendCommand: async (pId, cmd) => {
                await invoke('send_data', { sessionId: pId, data: cmd + '\r\n' });
              },
              onRestartConnection: async (pId) => {
                await invoke('disconnect_port', { sessionId: pId });
                setTimeout(async () => {
                  const p = panelsRef.current.find((x) => x.id === pId);
                  if (p && p.port) {
                    await invoke('connect_port', {
                      sessionId: pId,
                      portName: p.port,
                      baudRate: p.baudRate,
                      resetOnConnect: p.resetOnConnect,
                    });
                  }
                }, 300);
              },
              onEndConnection: async (pId) => {
                await invoke('disconnect_port', { sessionId: pId });
              },
            }
          );
          showToast(
            langRef.current === 'tr'
              ? `🎯 TETİKLEYİCİ YAKALANDI: "${matchedTriggerWord}"`
              : `🎯 TRIGGER HIT: "${matchedTriggerWord}"`
          );
        }

        // 3. Armed Mode pre-trigger filtering:
        // "tetikleme açıksa tetiklene kadar filtrelenmiş kelimeli satırlar dışında hiçbir kayıt tutulmaz."
        const isArmed = triggerConfigRef.current.armedMode && !targetPanel.wasTriggered;
        let shouldRecordLine = true;

        if (isArmed && !triggerMatched) {
          const matchesFilter =
            filterTagsRef.current.length > 0 &&
            isLineMatchingFilters(
              payload.line,
              filterTagsRef.current,
              matchCaseRef.current,
              isRegexRef.current,
              isVariableModeRef.current
            );
          if (!matchesFilter) {
            shouldRecordLine = false;
          }
        }

        if (shouldRecordLine) {
          setPanels((prevPanels) =>
            prevPanels.map((p) => {
              if (p.id !== payload.session_id) return p;
              const nextLines = [...p.lines, payload.line];
              const nextRaw = [...p.rawLines, payload.line];
              const cap = maxLogCapacityRef.current;

              return {
                ...p,
                title: updatedTitle,
                wasTriggered: triggerMatched ? true : p.wasTriggered,
                lines: nextLines.length > cap ? nextLines.slice(-cap) : nextLines,
                rawLines: nextRaw.length > cap ? nextRaw.slice(-cap) : nextRaw,
                rxBytes: payload.rx_bytes,
                txBytes: payload.tx_bytes,
              };
            })
          );
        } else if (updatedTitle !== targetPanel.title) {
          setPanels((prevPanels) =>
            prevPanels.map((p) => (p.id === payload.session_id ? { ...p, title: updatedTitle } : p))
          );
        }
      });

      unlistenStatus = await listen<SerialStatusPayload>('serial-status', (event) => {
        const payload = event.payload;
        const currentPanels = panelsRef.current;
        const targetPanel = currentPanels.find((p) => p.id === payload.session_id);

        if (payload.status === 'disconnected') {
          showToast(`⚠️ ${payload.message}`);
          if (targetPanel && targetPanel.autoReconnect && !targetPanel.isReference && targetPanel.port) {
            setPanels((prevPanels) =>
              prevPanels.map((p) =>
                p.id === payload.session_id ? { ...p, isConnected: false, isReconnecting: true } : p
              )
            );
            startAutoReconnect(
              payload.session_id,
              targetPanel.port,
              targetPanel.baudRate,
              targetPanel.resetOnConnect
            );
          } else {
            setPanels((prevPanels) =>
              prevPanels.map((p) =>
                p.id === payload.session_id ? { ...p, isConnected: false, isReconnecting: false } : p
              )
            );
          }
        } else if (payload.status === 'connected') {
          showToast(`✅ ${payload.message}`);
          if (reconnectTimers.current.has(payload.session_id)) {
            window.clearInterval(reconnectTimers.current.get(payload.session_id));
            reconnectTimers.current.delete(payload.session_id);
          }
          setPanels((prevPanels) =>
            prevPanels.map((p) =>
              p.id === payload.session_id ? { ...p, isConnected: true, isReconnecting: false } : p
            )
          );
        }
      });

      unlistenAiAction = await listen<any>('ai-action', (event) => {
        const payload = event.payload || {};
        const actionType = payload.type || payload.action;

        if (actionType === 'filter') {
          if (payload.action === 'clear') {
            setFilterTags([]);
            showToast('🤖 AI: Filtreler temizlendi');
          } else if (payload.action === 'remove' && Array.isArray(payload.tags)) {
            setFilterTags((prev) => prev.filter((t) => !payload.tags.includes(t)));
            showToast(`🤖 AI: Filtreler silindi [${payload.tags.join(', ')}]`);
          } else if (Array.isArray(payload.tags)) {
            setFilterTags((prev) => {
              const set = new Set([...prev, ...payload.tags]);
              return Array.from(set);
            });
            showToast(`🤖 AI: Filtreler eklendi [${payload.tags.join(', ')}]`);
          } else {
            const filterStr = payload.filter || payload.tag || payload.text;
            if (filterStr && typeof filterStr === 'string') {
              const trimmed = filterStr.trim();
              if (trimmed && !filterTagsRef.current.includes(trimmed)) {
                setFilterTags((prev) => [...prev, trimmed]);
                showToast(`🤖 AI: Filtre eklendi "${trimmed}"`);
              }
            }
          }
        } else if (actionType === 'trigger') {
          const trigStr = payload.trigger || payload.tag || payload.word;
          if (trigStr && typeof trigStr === 'string') {
            const trimmed = trigStr.trim();
            if (trimmed && !triggerTagsRef.current.includes(trimmed)) {
              setTriggerTags((prev) => [...prev, trimmed]);
              showToast(`🤖 AI: Hedef tetikleyici eklendi "${trimmed}"`);
            }
          }
        } else if (actionType === 'add_pin' || actionType === 'pin') {
          const rawLineIdx = payload.lineIndex ?? payload.line ?? payload.line_idx;
          const isExplicitLast =
            Boolean(payload.isLastLine) ||
            rawLineIdx === undefined ||
            rawLineIdx === null ||
            rawLineIdx === 'last' ||
            Number(rawLineIdx) < 0;

          const pinText = payload.note || payload.description || payload.text || `${new Date().toLocaleTimeString()} AI Pin`;
          const pinEmoji = payload.emoji || '📌';
          const pinShape = payload.shape;
          const pinColor = payload.color;
          const pinDesc = payload.description || payload.note;
          const pinKey = payload.key;
          const pinId = payload.pinId || `pin_ai_${Date.now()}`;
          const sId = payload.sessionId;

          let taggedLineNum = 1;

          setPanels((prev) => {
            if (prev.length === 0) return prev;
            return prev.map((p) => {
              if (sId && p.id !== sId) return p;
              const effectiveLineIdx = isExplicitLast
                ? Math.max(0, p.lines.length - 1)
                : Math.max(0, Number(rawLineIdx));
              taggedLineNum = effectiveLineIdx + 1;

              const newPin: LogPin = {
                id: pinId,
                lineIndex: effectiveLineIdx,
                text: pinText,
                timestamp: payload.timestamp || Date.now(),
                lineContent: p.lines[effectiveLineIdx] ? p.lines[effectiveLineIdx].slice(0, 150) : undefined,
                shape: pinShape,
                color: pinColor,
                emoji: pinEmoji,
                description: pinDesc,
                key: pinKey,
              };
              const updatedPins = [...(p.pins || []).filter((x) => x.lineIndex !== effectiveLineIdx), newPin];
              return { ...p, pins: updatedPins };
            });
          });
          const lineLabel = isExplicitLast ? `[Son Satır #L${taggedLineNum}]` : `Satır ${taggedLineNum}`;
          showToast(`🤖 AI: ${lineLabel} etiketlendi: "${pinText}"`);
        } else if (actionType === 'remove_pin') {
          const pId = payload.pinId;
          const lineIdx = payload.lineIndex;
          setPanels((prev) =>
            prev.map((p) => ({
              ...p,
              pins: (p.pins || []).filter((x) => {
                if (pId && x.id === pId) return false;
                if (lineIdx !== undefined && x.lineIndex === lineIdx) return false;
                return true;
              }),
            }))
          );
        } else if (actionType === 'connect') {
          const portName = payload.port;
          const sId = payload.sessionId;
          setPanels((prev) =>
            prev.map((p) => (p.id === sId || p.port === portName ? { ...p, isConnected: true } : p))
          );
        } else if (actionType === 'disconnect') {
          const sId = payload.sessionId;
          setPanels((prev) =>
            prev.map((p) => (sId ? (p.id === sId ? { ...p, isConnected: false } : p) : { ...p, isConnected: false }))
          );
        }
      });

      unlistenAiModels = await listen<AiModelClient[]>('ai-models-updated', (event) => {
        setConnectedAiModels(event.payload || []);
      });

      unlistenAiCommand = await listen<AiCommandLog>('ai-command-log', (event) => {
        const entry = event.payload;
        setAiLogs((prev) => {
          const next = [entry, ...prev].slice(0, 200);
          try {
            localStorage.setItem('esp32_ai_command_logs', JSON.stringify(next));
          } catch (e) {
            console.warn('Failed to save ai command logs:', e);
          }
          return next;
        });
        showToast(`🤖 AI Terminal: ./smp ${entry.command || `${entry.method} ${entry.endpoint}`}`);
      });
    };

    setupListeners();

    return () => {
      if (unlistenData) unlistenData();
      if (unlistenStatus) unlistenStatus();
      if (unlistenAiAction) unlistenAiAction();
      if (unlistenAiModels) unlistenAiModels();
      if (unlistenAiCommand) unlistenAiCommand();
    };
  }, [showToast, startAutoReconnect]);

  // Panel Management
  const handleAddPanel = () => {
    const defaultPort = availablePorts.length > 0 ? availablePorts[0].port_name : '';
    const newPanel = createSession(defaultPort, false, [], `Panel ${panels.length + 1}`, defaultAutoCloseSec);
    setPanels((prev) => [...prev, newPanel]);
  };

  const handleClosePanel = async (id: string) => {
    const target = panels.find((p) => p.id === id);
    if (target && target.isConnected) {
      try {
        await invoke('disconnect_port', { sessionId: id });
      } catch (err) {
        console.error('Error disconnecting before close:', err);
      }
    }
    setPanels((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePanel = (id: string, updates: Partial<PanelSession>) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleMakeReference = (id: string) => {
    const target = panels.find((p) => p.id === id);
    if (!target) return;

    const refTitle = `Ref: ${target.port || target.title}`;
    const refPanel = createSession('', true, [...target.lines], refTitle);
    
    // Insert reference panel immediately before current panel
    setPanels((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return [...prev, refPanel];
      const copy = [...prev];
      copy.splice(idx, 0, refPanel);
      return copy;
    });

    showToast(`📌 "${refTitle}" referans paneli olarak eklendi.`);
  };

  const handleOpenArchiveAsReference = (_filepath: string, content: string, filename: string) => {
    let parsedPins: LogPin[] | undefined;
    const pinsMatch = content.match(/Pins:\s*(\[.*?\])(?:\r?\n|$)/);
    if (pinsMatch) {
      try {
        parsedPins = JSON.parse(pinsMatch[1]);
      } catch (e) {
        console.warn('Failed to parse pins from archive:', e);
      }
    }

    const rawLines = content.split(/\r?\n/);
    const refPanel = createSession('', true, rawLines, `Arşiv: ${filename}`);
    if (parsedPins) {
      refPanel.pins = parsedPins;
    }
    setPanels((prev) => [refPanel, ...prev]);
    showToast(`📂 "${filename}" referans penceresinde açıldı${parsedPins ? ` (${parsedPins.length} pin ile)` : ''}.`);
  };

  const handleClearAll = () => {
    if (!window.confirm('Tüm açık panellerin log geçmişi temizlensin mi?')) return;
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        lines: [],
        rawLines: [],
        pointA: null,
        pointB: null,
      }))
    );
    showToast('Tüm paneller temizlendi.');
  };

  const handleWordClick = (word: string) => {
    setGlobalHighlightWord(word);
    navigator.clipboard.writeText(word);
    showToast(t('copiedWordMsg', lang, { word }));
  };

  // Multi-tag filter state helpers: trigger tags + normal filter tags
  const activeFilterTerms = React.useMemo(() => {
    const terms = [...triggerTags, ...filterTags];
    const trimmed = searchTagInput.trim();
    if (trimmed && !terms.includes(trimmed)) {
      terms.push(trimmed);
    }
    return terms;
  }, [triggerTags, filterTags, searchTagInput]);

  // When hovering over a specific tag pill, isolate and show ONLY that tag across panels
  const effectiveFilterTerms = React.useMemo(() => {
    if (hoveredTag) return [hoveredTag];
    return activeFilterTerms;
  }, [hoveredTag, activeFilterTerms]);

  const effectiveFilterMatchingOnly = hoveredTag ? true : filterMatchingOnly;

  const handleApplyPreset = (preset: FilterPreset, append: boolean) => {
    if (append) {
      setFilterTags((prev) => {
        const next = [...prev];
        preset.tags.forEach((t) => {
          if (!next.includes(t)) next.push(t);
        });
        return next;
      });
      if (preset.triggerTags && preset.triggerTags.length > 0) {
        setTriggerTags((prev) => {
          const next = [...prev];
          preset.triggerTags!.forEach((t) => {
            if (!next.includes(t)) next.push(t);
          });
          return next;
        });
      }
    } else {
      setFilterTags(preset.tags);
      setTriggerTags(preset.triggerTags || []);
      if (preset.isVariableMode !== undefined) setIsVariableMode(preset.isVariableMode);
      if (preset.matchCase !== undefined) setMatchCase(preset.matchCase);
      if (preset.isRegex !== undefined) setIsRegex(preset.isRegex);
    }
    setFilterMatchingOnly(true);
    showToast(
      lang === 'tr'
        ? `"${preset.name}" şablonu ${append ? 'eklendi' : 'yüklendi'}.`
        : `${append ? 'Appended' : 'Applied'} "${preset.name}" preset.`
    );
  };

  const handleBulkAddFilters = (items: string[], isTrigger: boolean) => {
    if (isTrigger) {
      setTriggerTags((prev) => {
        const next = [...prev];
        for (const item of items) {
          if (!next.includes(item)) next.push(item);
        }
        return next;
      });
    } else {
      setFilterTags((prev) => {
        const next = [...prev];
        for (const item of items) {
          if (!next.includes(item)) next.push(item);
        }
        return next;
      });
    }
    setFilterMatchingOnly(true);
  };

  const handleAddTriggerTag = (tagText?: string) => {
    const raw = (tagText !== undefined ? tagText : searchTagInput).trim();
    if (!raw) return;
    const cleaned = raw.replace(/^[:\s]+/, '');
    const parts = cleaned.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      setTriggerTags((prev) => {
        const next = [...prev];
        for (const p of parts) {
          if (!next.includes(p)) next.push(p);
        }
        return next;
      });
      setSearchTagInput('');
      setFilterMatchingOnly(true);
      showToast(
        lang === 'tr'
          ? `🎯 Tetikleyici eklendi: "${parts.join(', ')}"`
          : `🎯 Added trigger: "${parts.join(', ')}"`
      );
    }
  };

  const handleRemoveTriggerTag = (tagToRemove: string) => {
    setTriggerTags((prev) => prev.filter((t) => t !== tagToRemove));
    if (hoveredTag === tagToRemove) setHoveredTag(null);
  };

  const handleAddTag = (tagText: string) => {
    const raw = tagText.trim();
    if (!raw) return;
    const cleaned = raw.replace(/^[:\s]+/, '');
    const parts = cleaned.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      setFilterTags((prev) => {
        const next = [...prev];
        for (const p of parts) {
          if (!next.includes(p)) next.push(p);
        }
        return next;
      });
      setSearchTagInput('');
      setFilterMatchingOnly(true);
    }
  };

  const handleSearchInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes(',') || pasted.includes('\n'))) {
      e.preventDefault();
      const cleaned = pasted.replace(/^[:\s]+/, '');
      const parts = cleaned.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        setFilterTags((prev) => {
          const next = [...prev];
          for (const p of parts) {
            if (!next.includes(p)) next.push(p);
          }
          return next;
        });
        setSearchTagInput('');
        setFilterMatchingOnly(true);
        showToast(
          lang === 'tr'
            ? `✅ ${parts.length} filtre toplu eklendi.`
            : `✅ Added ${parts.length} filters in bulk.`
        );
      }
    }
  };

  const handleRestoreFiltersFromDrive = (data: {
    tags: string[];
    triggerTags: string[];
    presets: FilterPreset[];
  }) => {
    if (data.tags) setFilterTags(data.tags);
    if (data.triggerTags) setTriggerTags(data.triggerTags);
    setFilterMatchingOnly(true);
  };

  const handleRestoreSettingsFromDrive = (data: {
    maxLogCapacity?: number;
    terminalFont?: string;
    terminalFontSize?: number;
    triggerActions?: TriggerActionsConfig;
    autoNaming?: AutoNamingConfig;
    defaultAutoCloseSec?: number;
  }) => {
    if (data.maxLogCapacity) handleUpdateMaxLogCapacity(data.maxLogCapacity);
    if (data.terminalFont) handleFontChange(data.terminalFont);
    if (data.terminalFontSize) handleFontSizeChange(data.terminalFontSize);
    if (data.triggerActions) handleUpdateTriggerConfig(data.triggerActions);
    if (data.autoNaming) handleUpdateAutoNaming(data.autoNaming);
    if (data.defaultAutoCloseSec) handleUpdateDefaultAutoCloseSec(data.defaultAutoCloseSec);
  };

  const handleRestorePinsFromDrive = (pins: LogPin[], targetPanelId?: string) => {
    if (!pins || pins.length === 0) return;
    setPanels((prev) => {
      if (prev.length === 0) return prev;
      const targetId = targetPanelId || prev[0].id;
      return prev.map((p) => (p.id === targetId ? { ...p, pins } : p));
    });
    showToast(lang === 'tr' ? `📌 ${pins.length} pin Drive'dan geri yüklendi!` : `📌 ${pins.length} pins restored from Drive!`);
  };

  const handleRestorePanelsFromDrive = (panelsData: Partial<PanelSession>[]) => {
    if (!panelsData || panelsData.length === 0) return;
    const newPanels = panelsData.map((d, idx) => {
      const s = createSession(d.port || '', d.isReference || false, d.lines || [], d.title || `Panel ${idx + 1}`);
      s.pins = d.pins || [];
      return s;
    });
    setPanels(newPanels);
    showToast(lang === 'tr' ? `📂 ${newPanels.length} panel Drive'dan eksiksiz geri yüklendi!` : `📂 ${newPanels.length} panels restored from Drive!`);
  };

  const handleOpenDriveLogAsReference = (content: string, filename: string, pins?: LogPin[]) => {
    const rawLines = content.split(/\r?\n/);
    const refPanel = createSession('', true, rawLines, `Drive: ${filename}`);
    if (pins && pins.length > 0) {
      refPanel.pins = pins;
    }
    setPanels((prev) => [refPanel, ...prev]);
    showToast(`☁️ "${filename}" referans panelinde açıldı${pins && pins.length > 0 ? ` (${pins.length} pin ile)` : ''}.`);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFilterTags((prev) => prev.filter((t) => t !== tagToRemove));
    if (hoveredTag === tagToRemove) setHoveredTag(null);
  };

  const handleClearAllFilters = () => {
    setFilterTags([]);
    setTriggerTags([]);
    setSearchTagInput('');
    setHoveredTag(null);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      handleAddTriggerTag(searchTagInput);
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(searchTagInput);
    } else if (e.key === 'Backspace' && searchTagInput === '') {
      if (filterTags.length > 0) {
        setFilterTags((prev) => prev.slice(0, prev.length - 1));
      } else if (triggerTags.length > 0) {
        setTriggerTags((prev) => prev.slice(0, prev.length - 1));
      }
    }
  };

  // Copy all matched lines from all panels
  const handleCopyMatches = () => {
    if (activeFilterTerms.length === 0) {
      showToast(lang === 'tr' ? 'Filtre boş.' : 'Filter is empty.');
      return;
    }

    let matchedCount = 0;
    const outputLines: string[] = [];
    const filterDesc = formatFilterDescription(activeFilterTerms);
    outputLines.push(`filtered as: ${filterDesc}`);

    panels.forEach((p) => {
      const panelMatches = p.lines.filter((line) =>
        isLineMatchingFilters(line, activeFilterTerms, matchCase, isRegex, isVariableMode)
      );

      if (panelMatches.length > 0) {
        outputLines.push(`\n--- [${p.title || p.port || p.id}] ---`);
        panelMatches.forEach((line) => {
          outputLines.push(line);
          matchedCount++;
        });
      }
    });

    if (matchedCount === 0) {
      showToast(lang === 'tr' ? 'Eşleşen satır bulunamadı.' : 'No matching lines found.');
      return;
    }

    navigator.clipboard.writeText(outputLines.join('\n'));
    showToast(t('copiedMatchesMsg', lang));
  };

  // Compute total matched count across panels
  const totalMatchesCount = React.useMemo(() => {
    if (effectiveFilterTerms.length === 0) return 0;
    let count = 0;
    panels.forEach((p) => {
      p.lines.forEach((line) => {
        if (isLineMatchingFilters(line, effectiveFilterTerms, matchCase, isRegex, isVariableMode)) {
          count++;
        }
      });
    });
    return count;
  }, [panels, effectiveFilterTerms, matchCase, isRegex, isVariableMode]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0e15] text-[#cdd6f4] select-none font-sans overflow-hidden">
      {/* Top Global Command Bar */}
      <header className="h-13 min-h-13 bg-[#141622] border-b border-[#26283b] flex items-center justify-between px-3 gap-3 shrink-0 shadow-lg z-20">
        {/* Left: Branding & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            onClick={() => setIsAboutModalOpen(true)}
            title={lang === 'tr' ? 'Serial Monitor Pro - Hakkında & Kılavuz' : 'Serial Monitor Pro - About & Guide'}
            className="flex items-center gap-2 mr-1 cursor-pointer group select-none transition"
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 group-hover:shadow-cyan-400/30 transition-transform">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white group-hover:text-cyan-300 transition-colors whitespace-nowrap">
                Serial Monitor Pro
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-[#26283b] mx-0.5" />

          {/* Add Panel - Just '+' icon */}
          <button
            onClick={handleAddPanel}
            title={t('addPanel', lang)}
            className="p-1.5 rounded-md bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 hover:text-cyan-200 border border-cyan-500/40 transition shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Session Archives - Just icon */}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            title={t('archives', lang)}
            className="p-1.5 rounded-md bg-[#1e2030] text-[#a6adc8] hover:text-amber-300 hover:bg-[#282a3e] border border-[#313244] transition cursor-pointer shrink-0"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
          </button>

          {/* Clear All Panels (Next to Archives) */}
          <button
            onClick={handleClearAll}
            title={t('clearAll', lang)}
            className="p-1.5 rounded-md bg-[#1e2030] text-[#6c7086] hover:text-rose-400 hover:bg-rose-950/30 border border-[#313244] transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[#26283b] mx-0.5" />

          {/* Google Drive Cloud Backup */}
          <button
            onClick={() => setIsGDriveModalOpen(true)}
            title={t('gdriveBackup', lang)}
            className="p-1.5 rounded-md bg-[#1e2030] text-[#a6adc8] hover:text-emerald-300 hover:bg-emerald-950/30 border border-[#313244] transition cursor-pointer shrink-0"
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Trigger Settings & Armed Mode */}
          <button
            onClick={() => setIsTriggerSettingsModalOpen(true)}
            title={`${t('triggerSettings', lang)}${triggerConfig.armedMode ? ' (ARMED)' : ''}`}
            className={`p-1.5 rounded-md border transition cursor-pointer shrink-0 flex items-center gap-1 ${
              triggerConfig.armedMode
                ? 'bg-rose-950/70 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/30'
                : 'bg-[#1e2030] text-[#a6adc8] hover:text-rose-300 hover:bg-rose-950/30 border-[#313244]'
            }`}
          >
            <Target className="w-4 h-4 text-rose-400" />
            {triggerConfig.armedMode && (
              <span className="text-[9px] font-mono font-bold text-rose-300">ARMED</span>
            )}
          </button>

          {/* AI Model Terminal & Audit Console */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            title={
              lang === 'tr'
                ? `🤖 AI Model Terminal & Denetim Konsolu (${aiLogs.length} işlem, ${connectedAiModels.length} bağlı model)\n• Tıkla: AI Ön Promptunu ve IP Adresini (http://127.0.0.1:4567) Kopyala`
                : `🤖 AI Model Terminal & Audit Console (${aiLogs.length} logs, ${connectedAiModels.length} active agents)\n• Click: Copy AI Agent Prompt & IP Address (http://127.0.0.1:4567)`
            }
            className={`p-1.5 rounded-md border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              connectedAiModels.length > 0
                ? 'bg-indigo-950/70 text-indigo-300 border-indigo-500/60 hover:bg-indigo-900/80 shadow-sm shadow-indigo-500/30'
                : aiLogs.length > 0
                ? 'bg-purple-950/70 text-purple-300 border-purple-500/50 hover:bg-purple-900/80 shadow-sm shadow-purple-500/20'
                : 'bg-[#1e2030] text-[#a6adc8] hover:text-purple-300 hover:bg-purple-950/30 border-[#313244]'
            }`}
          >
            {connectedAiModels.length > 0 ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <Bot className="w-4 h-4 text-purple-400 animate-pulse" />
            )}
            <span className="text-[10px] font-mono font-bold text-purple-300">
              {connectedAiModels.length > 0 ? `${connectedAiModels.length} AI` : 'AI'}
            </span>
            {aiLogs.length > 0 && (
              <span className="px-1 py-0.2 rounded-full bg-purple-500/30 text-purple-200 text-[9px] font-mono font-bold">
                {aiLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Center: Global Multi-Tag Search & Real-time Cross-Panel Filtering (OR logic) */}
        <div className="flex-1 flex items-center gap-1.5 bg-[#0d0e15] border border-[#2d3047] focus-within:border-cyan-500/70 rounded-md px-2.5 py-1 transition shadow-inner min-w-[240px]">
          <Search className="w-4 h-4 text-[#6c7086] shrink-0" />

          {/* Tags + Input Flex Container */}
          <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            {/* 1. FIRST: Trigger Tags (with Target icon) */}
            {triggerTags.map((tag) => {
              const isHovered = hoveredTag === tag;
              return (
                <span
                  key={`trig_${tag}`}
                  onMouseEnter={() => setHoveredTag(tag)}
                  onMouseLeave={() => setHoveredTag(null)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono shrink-0 select-none cursor-pointer transition-all border border-rose-500/60 bg-rose-950/80 text-rose-300 ${
                    isHovered
                      ? 'ring-2 ring-white/90 scale-105 shadow-md brightness-125 z-10'
                      : hoveredTag
                      ? 'opacity-35 scale-95'
                      : 'hover:border-rose-400 hover:bg-rose-900/80'
                  }`}
                  title={
                    lang === 'tr'
                      ? `🎯 Tetikleyici: "${tag}"\nÜzerinde dur: Sadece bunu göster (Önizleme)\nKaldırmak için ✕ tıklayın`
                      : `🎯 Trigger: "${tag}"\nHover: Show only this (Peek)\nClick ✕ to remove`
                  }
                >
                  <Target className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="truncate max-w-[120px] font-semibold">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTriggerTag(tag);
                    }}
                    className="text-rose-400 hover:text-white hover:bg-rose-800/50 rounded w-3.5 h-3.5 flex items-center justify-center text-[10px] cursor-pointer"
                    title={lang === 'tr' ? 'Tetikleyiciyi kaldır' : 'Remove trigger'}
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            {/* 2. SECOND: Normal Filter Tags (no target icon) */}
            {filterTags.map((tag, idx) => {
              const theme = getTagThemeByIndex(idx);
              const isHovered = hoveredTag === tag;
              return (
                <span
                  key={tag}
                  onMouseEnter={() => setHoveredTag(tag)}
                  onMouseLeave={() => setHoveredTag(null)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono shrink-0 select-none cursor-pointer transition-all border ${theme.pillClass} ${
                    isHovered
                      ? 'ring-2 ring-white/90 scale-105 shadow-md brightness-125 z-10'
                      : hoveredTag
                      ? 'opacity-35 scale-95'
                      : theme.pillHoverClass
                  }`}
                  title={
                    lang === 'tr'
                      ? `Üzerinde dur: Sadece "${tag}" göster (Önizleme)\nKaldırmak için ✕ tıklayın`
                      : `Hover: Show only "${tag}" (Peek)\nClick ✕ to remove`
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'currentColor' }}
                  />
                  <span className="truncate max-w-[120px]">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag);
                      if (hoveredTag === tag) setHoveredTag(null);
                    }}
                    className={`rounded w-3.5 h-3.5 flex items-center justify-center text-[10px] cursor-pointer ${theme.closeBtnClass}`}
                    title={lang === 'tr' ? 'Filtreyi kaldır' : 'Remove filter'}
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            {/* Hover Peek Indicator */}
            {hoveredTag && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/50 text-[10px] font-mono animate-pulse shrink-0">
                👁 {t('peekMode', lang)}: {hoveredTag}
              </span>
            )}

            <input
              type="text"
              value={searchTagInput}
              onChange={(e) => setSearchTagInput(e.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              onPaste={handleSearchInputPaste}
              placeholder={
                filterTags.length === 0 && triggerTags.length === 0
                  ? isVariableMode
                    ? t('variableSearchPlaceholder', lang)
                    : t('searchPlaceholder', lang)
                  : lang === 'tr'
                  ? '+ filtre (Enter/Virgül) / tetikleyici (🎯)...'
                  : '+ filter (Enter/Comma) / trigger (🎯)...'
              }
              className="flex-1 min-w-[90px] bg-transparent text-xs text-[#cdd6f4] placeholder-[#45475a] outline-none font-mono"
            />
          </div>

          {/* Add Target / Trigger Tag Button (Nişan ikonu) */}
          <button
            type="button"
            onClick={() => handleAddTriggerTag()}
            className={`p-1 rounded transition cursor-pointer shrink-0 ${
              searchTagInput.trim()
                ? 'text-rose-400 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 animate-pulse'
                : 'text-[#6c7086] hover:text-rose-400'
            }`}
            title={
              lang === 'tr'
                ? '🎯 Tetikleyici Ekle: Yazılan kelimeyi hedef tetikleyici olarak ekler'
                : '🎯 Add Trigger: Add current word as target trigger'
            }
          >
            <Target className="w-3.5 h-3.5" />
          </button>

          {/* Add Normal Tag Button if input has text */}
          {searchTagInput.trim() && (
            <button
              type="button"
              onClick={() => handleAddTag(searchTagInput)}
              className="px-1.5 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-[10px] font-mono border border-cyan-500/40 transition cursor-pointer shrink-0 whitespace-nowrap"
              title={lang === 'tr' ? 'Normal filtre etiketi olarak ekle (Enter)' : 'Add as filter tag (Enter)'}
            >
              + {lang === 'tr' ? 'Filtre' : 'Filter'}
            </button>
          )}

          {/* Clear All Tags & Input */}
          {(filterTags.length > 0 || triggerTags.length > 0 || searchTagInput) && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[#6c7086] hover:text-white text-xs px-1 cursor-pointer shrink-0"
              title={lang === 'tr' ? 'Tüm filtre ve tetikleyicileri temizle' : 'Clear all filters & triggers'}
            >
              ✕
            </button>
          )}

          <div className="h-4 w-px bg-[#26283b] mx-0.5 shrink-0" />

          {/* Filter Only Matching Toggle */}
          <button
            type="button"
            onClick={() => setFilterMatchingOnly(!filterMatchingOnly)}
            title={`${t('filterMatchingOnly', lang)}:\n${t('filterMatchingOnlyTip', lang)}`}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              filterMatchingOnly
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#1e2030]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 shrink-0" />
            {activeFilterTerms.length > 0 && (
              <span className="px-1 py-0.2 text-[9px] rounded-full bg-[#181825] font-mono text-cyan-300 shrink-0">
                {totalMatchesCount}
              </span>
            )}
          </button>

          {/* Match Case */}
          <button
            type="button"
            onClick={() => setMatchCase(!matchCase)}
            title={t('matchCase', lang)}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer shrink-0 ${
              matchCase
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-[#6c7086] hover:text-[#a6adc8]'
            }`}
          >
            Aa
          </button>

          {/* Regex */}
          <button
            type="button"
            onClick={() => setIsRegex(!isRegex)}
            title={t('regex', lang)}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer shrink-0 ${
              isRegex
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-[#6c7086] hover:text-[#a6adc8]'
            }`}
          >
            .*
          </button>

          {/* Variable / Expression Mode */}
          <button
            type="button"
            onClick={() => setIsVariableMode(!isVariableMode)}
            title={t('variableModeTip', lang)}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer shrink-0 ${
              isVariableMode
                ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/20'
                : 'text-[#6c7086] hover:text-[#a6adc8]'
            }`}
          >
            {'{x}'}
          </button>

          {/* Copy Matches */}
          {activeFilterTerms.length > 0 && (
            <button
              type="button"
              onClick={handleCopyMatches}
              title={t('copyMatches', lang)}
              className="p-1 rounded-md text-[#a6adc8] hover:text-white hover:bg-[#1e2030] transition cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Saved Filter Presets (Kayıtlı Filtreler) */}
          <button
            type="button"
            onClick={() => setIsFilterPresetsModalOpen(true)}
            title={t('filterPresetsTip', lang)}
            className="p-1 rounded-md text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/30 transition cursor-pointer shrink-0"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

        </div>

        {/* Right: Typography Popover & Language Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Typography Popover */}
          <div className="relative">
            <button
              onClick={() => setIsFontMenuOpen(!isFontMenuOpen)}
              title={lang === 'tr' ? 'Terminal Yazı Tipi & Boyutu' : 'Terminal Typography & Font Size'}
              className={`p-1.5 rounded-md border transition cursor-pointer shrink-0 ${
                isFontMenuOpen
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50'
                  : 'bg-[#1e2030] text-[#a6adc8] hover:text-white hover:bg-[#282a3e] border-[#313244]'
              }`}
            >
              <Type className="w-4 h-4 text-cyan-400" />
            </button>

            {isFontMenuOpen && (
              <div
                ref={fontMenuRef}
                className="absolute right-0 top-full mt-2 w-64 bg-[#141622] border border-[#2d3047] rounded-lg shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#25283b]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Type className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{lang === 'tr' ? 'Yazı Tipi & Boyutu' : 'Typography'}</span>
                  </div>
                  <button
                    onClick={() => setIsFontMenuOpen(false)}
                    className="text-[#6c7086] hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Font Family Selection */}
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6c7086] font-medium block">
                    {lang === 'tr' ? 'Yazı Tipi (Font)' : 'Font Family'}
                  </label>
                  <select
                    value={terminalFont}
                    onChange={(e) => handleFontChange(e.target.value)}
                    className="w-full bg-[#0d0e15] border border-[#2d3047] text-xs text-[#cdd6f4] rounded-md px-2 py-1.5 outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size & Zoom */}
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6c7086] font-medium block">
                    {lang === 'tr' ? 'Yazı Boyutu' : 'Font Size'}
                  </label>
                  <div className="flex items-center gap-2 bg-[#0d0e15] border border-[#2d3047] rounded-md p-1.5 justify-between">
                    <button
                      onClick={handleZoomOut}
                      title={t('decreaseFontSize', lang)}
                      className="p-1 rounded bg-[#1e2030] hover:bg-[#282a3e] text-[#a6adc8] hover:text-white transition cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-mono font-bold text-xs text-cyan-300">
                      {terminalFontSize}px
                    </span>

                    <button
                      onClick={handleZoomIn}
                      title={t('increaseFontSize', lang)}
                      className="p-1 rounded bg-[#1e2030] hover:bg-[#282a3e] text-[#a6adc8] hover:text-white transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick size presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[10, 12, 14, 16, 18].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleFontSizeChange(sz)}
                      className={`flex-1 py-1 rounded text-[10px] font-mono transition cursor-pointer border ${
                        terminalFontSize === sz
                          ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-[#1e2030] text-[#a6adc8] hover:text-white border-[#313244]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Language Toggle - Just icon */}
          <button
            onClick={handleToggleLang}
            title={lang === 'tr' ? 'Dil: Türkçe (Change to English)' : 'Language: English (Türkçe\'ye geç)'}
            className="p-1.5 rounded-md bg-[#1e2030] text-[#a6adc8] hover:text-cyan-300 hover:bg-[#282a3e] border border-[#313244] transition cursor-pointer shrink-0"
          >
            <Languages className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace Canvas with Horizontal Scroll */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 p-4 items-stretch scroll-smooth">
        {panels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#26283b] rounded-xl my-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1e2030] border border-[#313244] flex items-center justify-center text-cyan-400 mb-4 shadow-lg">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Açık Panel Yok</h3>
            <p className="text-sm text-[#6c7086] max-w-md mb-6">
              Seri portları dinlemek veya eski logları referans olarak incelemek için yeni bir panel ekleyin.
            </p>
            <button
              onClick={handleAddPanel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>İlk Paneli Aç</span>
            </button>
          </div>
        ) : (
          panels.map((panel) => (
            <LogPanel
              key={panel.id}
              panel={panel}
              lang={lang}
              availablePorts={availablePorts}
              onRefreshPorts={refreshPorts}
              onUpdatePanel={handleUpdatePanel}
              onClosePanel={handleClosePanel}
              onMakeReference={handleMakeReference}
              filterTerms={effectiveFilterTerms}
              allFilterTags={filterTags}
              filterMatchingOnly={effectiveFilterMatchingOnly}
              matchCase={matchCase}
              isRegex={isRegex}
              isVariableMode={isVariableMode}
              globalHighlightWord={globalHighlightWord}
              onWordClick={handleWordClick}
              onNotification={showToast}
              terminalFont={terminalFont}
              terminalFontSize={terminalFontSize}
              defaultAutoCloseSec={defaultAutoCloseSec}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
          ))
        )}
      </main>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#181825]/95 text-white border border-cyan-500/50 shadow-2xl backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Archive Modal Dialog */}
      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        lang={lang}
        onOpenAsReference={handleOpenArchiveAsReference}
        terminalFont={terminalFont}
        terminalFontSize={terminalFontSize}
      />

      {/* Filter Presets Modal Dialog */}
      <FilterPresetsModal
        isOpen={isFilterPresetsModalOpen}
        onClose={() => setIsFilterPresetsModalOpen(false)}
        lang={lang}
        currentTags={filterTags}
        currentTriggerTags={triggerTags}
        isVariableMode={isVariableMode}
        matchCase={matchCase}
        isRegex={isRegex}
        onApplyPreset={handleApplyPreset}
        onNotification={showToast}
      />

      {/* Google Drive Modal Dialog */}
      <GoogleDriveModal
        isOpen={isGDriveModalOpen}
        onClose={() => setIsGDriveModalOpen(false)}
        lang={lang}
        panels={panels}
        filterTags={filterTags}
        triggerTags={triggerTags}
        filterPresets={[]}
        maxLogCapacity={maxLogCapacity}
        terminalFont={terminalFont}
        terminalFontSize={terminalFontSize}
        triggerActions={triggerConfig}
        autoNaming={autoNaming}
        defaultAutoCloseSec={defaultAutoCloseSec}
        onRestoreFilters={handleRestoreFiltersFromDrive}
        onRestoreSettings={handleRestoreSettingsFromDrive}
        onRestorePins={handleRestorePinsFromDrive}
        onRestorePanels={handleRestorePanelsFromDrive}
        onOpenLogAsReference={handleOpenDriveLogAsReference}
        onNotification={showToast}
      />

      {/* AI Activity & Model Terminal Console */}
      <AiActivityModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        lang={lang}
        aiLogs={aiLogs}
        connectedAiModels={connectedAiModels}
        onClearLogs={handleClearAiLogs}
        onNotification={showToast}
      />

      {/* Trigger & Actions Settings Modal */}
      <TriggerSettingsModal
        isOpen={isTriggerSettingsModalOpen}
        onClose={() => setIsTriggerSettingsModalOpen(false)}
        lang={lang}
        triggerConfig={triggerConfig}
        onUpdateTriggerConfig={handleUpdateTriggerConfig}
        autoNaming={autoNaming}
        onUpdateAutoNaming={handleUpdateAutoNaming}
        maxLogCapacity={maxLogCapacity}
        onUpdateMaxLogCapacity={handleUpdateMaxLogCapacity}
        defaultAutoCloseSec={defaultAutoCloseSec}
        onUpdateDefaultAutoCloseSec={handleUpdateDefaultAutoCloseSec}
        onBulkAddFilters={handleBulkAddFilters}
        onNotification={showToast}
      />

      {/* About & General Usage Modal */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default App;
