import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PanelSession, SerialDeviceInfo, SerialDataPayload, SerialStatusPayload, I18nLanguage } from './types';
import { LogPanel } from './LogPanel';
import { ArchiveModal } from './ArchiveModal';
import { AboutModal } from './AboutModal';
import { t } from './i18n';
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
  HelpCircle,
} from 'lucide-react';

const MAX_BUFFERED_LINES = 5000;

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
  "[12:00:09.010] [INFO] Periodic memory check: free_heap=184320 bytes, min_free=180100"
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
  title?: string
): PanelSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title: title || (isReference ? `Ref: ${port || 'Log'}` : (port ? `Port: ${port}` : 'Yeni Panel')),
    port,
    baudRate: 115200,
    isConnected: false,
    isReconnecting: false,
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
  };
}

export function App() {
  const [lang, setLang] = useState<I18nLanguage>(() => {
    const saved = localStorage.getItem('esp32_monitor_lang');
    return saved === 'en' ? 'en' : 'tr';
  });

  const [availablePorts, setAvailablePorts] = useState<SerialDeviceInfo[]>([]);
  const [panels, setPanels] = useState<PanelSession[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterMatchingOnly, setFilterMatchingOnly] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [globalHighlightWord, setGlobalHighlightWord] = useState('');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

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
          setGlobalSearch('[DATA]');
          setFilterMatchingOnly(true);
        } else {
          setGlobalHighlightWord('Telemetry');
        }
      } else {
        setPanels([createSession(defaultPort, false)]);
      }
    });

    // Auto-poll ports every 4 seconds to discover newly plugged devices
    const interval = setInterval(() => {
      refreshPorts();
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshPorts]);

  // Setup Tauri Serial Event Listeners
  useEffect(() => {
    let unlistenData: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenData = await listen<SerialDataPayload>('serial-data', (event) => {
        const payload = event.payload;

        // Check trigger keyword if set
        if (triggerKeyword.trim() && payload.line.toLowerCase().includes(triggerKeyword.toLowerCase())) {
          showToast(`⚡ Tetikleyici Yakalandı: "${triggerKeyword}"`);
        }

        setPanels((prevPanels) =>
          prevPanels.map((p) => {
            if (p.id !== payload.session_id) return p;

            const nextLines = [...p.lines, payload.line];
            const nextRaw = [...p.rawLines, payload.line];

            return {
              ...p,
              lines: nextLines.length > MAX_BUFFERED_LINES ? nextLines.slice(-MAX_BUFFERED_LINES) : nextLines,
              rawLines: nextRaw.length > MAX_BUFFERED_LINES ? nextRaw.slice(-MAX_BUFFERED_LINES) : nextRaw,
              rxBytes: payload.rx_bytes,
              txBytes: payload.tx_bytes,
            };
          })
        );
      });

      unlistenStatus = await listen<SerialStatusPayload>('serial-status', (event) => {
        const payload = event.payload;
        setPanels((prevPanels) =>
          prevPanels.map((p) => {
            if (p.id !== payload.session_id) return p;
            return {
              ...p,
              isConnected: payload.status === 'connected',
              isReconnecting: payload.status === 'reconnecting',
            };
          })
        );

        if (payload.status === 'disconnected') {
          showToast(`⚠️ ${payload.message}`);
        } else if (payload.status === 'connected') {
          showToast(`✅ ${payload.message}`);
        }
      });
    };

    setupListeners();

    return () => {
      if (unlistenData) unlistenData();
      if (unlistenStatus) unlistenStatus();
    };
  }, [triggerKeyword, showToast]);

  // Panel Management
  const handleAddPanel = () => {
    const defaultPort = availablePorts.length > 0 ? availablePorts[0].port_name : '';
    const newPanel = createSession(defaultPort, false, [], `Panel ${panels.length + 1}`);
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
    const rawLines = content.split(/\r?\n/);
    const refPanel = createSession('', true, rawLines, `Arşiv: ${filename}`);
    setPanels((prev) => [refPanel, ...prev]);
    showToast(`📂 "${filename}" referans penceresinde açıldı.`);
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

  // Copy all matched lines from all panels
  const handleCopyMatches = () => {
    if (!globalSearch.trim()) {
      showToast('Arama kutusu boş.');
      return;
    }

    let regex: RegExp | null = null;
    try {
      regex = new RegExp(globalSearch, matchCase ? '' : 'i');
    } catch {
      regex = null;
    }

    let matchedCount = 0;
    const outputLines: string[] = [];

    panels.forEach((p) => {
      outputLines.push(`--- [${p.title || p.port || p.id}] ---`);
      p.lines.forEach((line) => {
        let isMatch = false;
        if (regex) {
          isMatch = regex.test(line);
        } else {
          isMatch = matchCase
            ? line.includes(globalSearch)
            : line.toLowerCase().includes(globalSearch.toLowerCase());
        }

        if (isMatch) {
          outputLines.push(line);
          matchedCount++;
        }
      });
      outputLines.push('');
    });

    if (matchedCount === 0) {
      showToast('Eşleşen satır bulunamadı.');
      return;
    }

    navigator.clipboard.writeText(outputLines.join('\n'));
    showToast(t('copiedMatchesMsg', lang));
  };

  // Compute total matched count across panels
  const totalMatchesCount = React.useMemo(() => {
    if (!globalSearch.trim()) return 0;
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(globalSearch, matchCase ? '' : 'i');
    } catch {
      regex = null;
    }

    let count = 0;
    panels.forEach((p) => {
      p.lines.forEach((line) => {
        if (regex ? regex.test(line) : matchCase ? line.includes(globalSearch) : line.toLowerCase().includes(globalSearch.toLowerCase())) {
          count++;
        }
      });
    });
    return count;
  }, [panels, globalSearch, matchCase]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0e15] text-[#cdd6f4] select-none font-sans overflow-hidden">
      {/* Top Global Command Bar */}
      <header className="h-13 min-h-13 bg-[#141622] border-b border-[#26283b] flex items-center justify-between px-3 gap-3 shrink-0 shadow-lg z-20">
        {/* Left: Branding & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={() => setIsAboutModalOpen(true)}
              title={lang === 'tr' ? 'Genel Kullanım ve Hakkında (?)' : 'General Usage & About (?)'}
              className="w-7 h-7 rounded-md bg-[#1e2030] hover:bg-[#282a3e] text-cyan-400 hover:text-cyan-300 border border-[#313244] flex items-center justify-center transition shadow-sm cursor-pointer shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white whitespace-nowrap">Serial Monitor Pro</span>
            </div>
          </div>

          <div className="h-5 w-px bg-[#26283b] mx-1" />

          {/* Add Panel */}
          <button
            onClick={handleAddPanel}
            title={t('addPanel', lang)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addPanel', lang)}</span>
          </button>

          {/* Session Archives */}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            title={t('archives', lang)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1e2030] text-[#a6adc8] hover:text-white hover:bg-[#282a3e] border border-[#313244] transition cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('archives', lang)}</span>
          </button>

          {/* Clear All */}
          <button
            onClick={handleClearAll}
            title={t('clearAll', lang)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-[#1e2030] text-[#6c7086] hover:text-red-400 hover:bg-red-950/30 border border-[#313244] transition cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('clearAll', lang)}</span>
          </button>
        </div>

        {/* Center: Global Search & Real-time Cross-Panel Filtering */}
        <div className="flex-1 max-w-2xl flex items-center gap-1.5 bg-[#0d0e15] border border-[#2d3047] focus-within:border-cyan-500/70 rounded-md px-2.5 py-1 transition shadow-inner">
          <Search className="w-4 h-4 text-[#6c7086] shrink-0" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={t('searchPlaceholder', lang)}
            className="flex-1 bg-transparent text-xs text-[#cdd6f4] placeholder-[#45475a] outline-none font-mono"
          />

          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="text-[#6c7086] hover:text-white text-xs px-1 cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}

          <div className="h-4 w-px bg-[#26283b] mx-0.5 shrink-0" />

          {/* Filter Only Matching Toggle */}
          <button
            onClick={() => setFilterMatchingOnly(!filterMatchingOnly)}
            title={t('filterMatchingOnlyTip', lang)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              filterMatchingOnly
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#1e2030]'
            }`}
          >
            <Filter className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[125px] inline-block">{t('filterMatchingOnly', lang)}</span>
            {globalSearch && (
              <span className="ml-0.5 px-1 py-0.2 text-[9px] rounded-full bg-[#181825] font-mono text-cyan-300 shrink-0">
                {totalMatchesCount}
              </span>
            )}
          </button>

          {/* Match Case */}
          <button
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

          {/* Copy Matches */}
          {globalSearch && (
            <button
              onClick={handleCopyMatches}
              title={t('copyMatches', lang)}
              className="p-1 rounded-md text-[#a6adc8] hover:text-white hover:bg-[#1e2030] transition cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Trigger Keyword & Language Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Trigger input */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#0d0e15] border border-[#2d3047] rounded-md px-2 py-1">
            <span className="text-[11px] text-[#6c7086] font-medium whitespace-nowrap">{t('triggerLabel', lang)}</span>
            <input
              type="text"
              value={triggerKeyword}
              onChange={(e) => setTriggerKeyword(e.target.value)}
              placeholder={t('triggerPlaceholder', lang)}
              className="w-36 bg-transparent text-xs text-amber-300 placeholder-[#45475a] outline-none font-mono"
            />
            {triggerKeyword && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>

          {/* Language Toggle */}
          <button
            onClick={handleToggleLang}
            title={t('language', lang)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded-md bg-[#1e2030] text-[#a6adc8] hover:text-white hover:bg-[#282a3e] border border-[#313244] transition cursor-pointer uppercase tracking-wider whitespace-nowrap"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang}</span>
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
              globalSearch={globalSearch}
              filterMatchingOnly={filterMatchingOnly}
              matchCase={matchCase}
              isRegex={isRegex}
              globalHighlightWord={globalHighlightWord}
              onWordClick={handleWordClick}
              onNotification={showToast}
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
