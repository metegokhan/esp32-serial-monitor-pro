import React from 'react';
import { I18nLanguage } from './types';
import {
  X,
  Download,
  Terminal,
  Layers,
  Sparkles,
  Keyboard,
  ExternalLink,
  Cpu,
  Monitor,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  const isTr = lang === 'tr';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141622] border border-[#2d3047] rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-[#cdd6f4]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#25283b] bg-[#1a1c2b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">Serial Monitor Pro</h2>
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 rounded">
                  v2.0.0
                </span>
              </div>
              <p className="text-[11px] text-[#6c7086]">
                {isTr ? 'Genel Kullanım Kılavuzu & Hakkında' : 'General Usage Guide & About'}
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

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-[#a6adc8] leading-relaxed font-sans">
          {/* Quick Intro */}
          <div className="bg-[#0f111a] border border-[#23263b] rounded-md p-3.5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium mb-1">
                {isTr
                  ? 'Gelişmiş Çok Kanallı Seri Port İzleme & Log Analiz Aracı'
                  : 'Advanced Multi-Channel Serial Monitor & Log Analysis Tool'}
              </p>
              <p className="text-[#8990b3] text-[11px]">
                {isTr
                  ? 'ESP32, ESP8266, Arduino ve tüm mikrodenetleyiciler için geliştirilmiş, Rust backend ve Tauri v2 mimarisiyle sıfır kurulum gerektiren bağımsız masaüstü uygulamasıdır.'
                  : 'A standalone desktop application built with Rust and Tauri v2, requiring zero complex installation, tailored for ESP32, Arduino, and embedded systems.'}
              </p>
            </div>
          </div>

          {/* Core Features / Guide */}
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isTr ? 'Öne Çıkan Özellikler & Kullanım' : 'Key Features & Usage'}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 bg-[#181a28] border border-[#26283d] rounded-md">
                <span className="font-semibold text-white block mb-0.5">
                  {isTr ? '🎛️ Eşzamanlı Çoklu Port & Panel' : '🎛️ Simultaneous Multi-Port'}
                </span>
                <span className="text-[#8990b3]">
                  {isTr
                    ? '"+ Yeni Panel Ekle" ile dilediğiniz sayıda panel açın. Her panel bağımsız port veya arşive bağlanabilir.'
                    : 'Open unlimited panels with "+ Add Panel". Each connects independently to different ports or log archives.'}
                </span>
              </div>

              <div className="p-2.5 bg-[#181a28] border border-[#26283d] rounded-md">
                <span className="font-semibold text-white block mb-0.5">
                  {isTr ? '🛡️ Kesintisiz Bağlantı (Reset Yok)' : '🛡️ Safe Neutral Connect'}
                </span>
                <span className="text-[#8990b3]">
                  {isTr
                    ? 'Bağlanırken cihazınız resetlenmez. Boot loglarını baştan yakalamak isterseniz "Resetle" kutusunu işaretleyin.'
                    : 'Device continues running without reset. Check "Reset on Connect" if you need to catch bootup logs.'}
                </span>
              </div>

              <div className="p-2.5 bg-[#181a28] border border-[#26283d] rounded-md">
                <span className="font-semibold text-white block mb-0.5">
                  {isTr ? '✏️ Düzenlenebilir Hızlı Komutlar' : '✏️ Editable Quick Commands'}
                </span>
                <span className="text-[#8990b3]">
                  {isTr
                    ? 'Alttaki komut butonlarına çift tıklayarak içine istediğinizi yazabilir, "+" ile yeni komut ekleyebilirsiniz.'
                    : 'Double-click any quick command chip at the bottom to edit. Click "+" to add new commands.'}
                </span>
              </div>

              <div className="p-2.5 bg-[#181a28] border border-[#26283d] rounded-md">
                <span className="font-semibold text-white block mb-0.5">
                  {isTr ? '🔍 Çapraz Vurgulama & Eşzamanlı Süzme' : '🔍 Cross-Highlight & Filter'}
                </span>
                <span className="text-[#8990b3]">
                  {isTr
                    ? 'Bir kelimeye tıklandığında tüm açık panellerde parlar. "Sadece Eşleşenler" ile tüm paneller anlık filtrelenir.'
                    : 'Click any token to highlight across all panels. Use "Show Matches Only" for simultaneous multi-panel filtering.'}
                </span>
              </div>
            </div>
          </div>

          {/* Shortcuts */}
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isTr ? 'Kısayollar' : 'Shortcuts'}</span>
            </h3>
            <div className="bg-[#181a28] border border-[#26283d] rounded-md p-2.5 text-[11px] grid grid-cols-2 gap-2 font-mono">
              <div><span className="text-cyan-400 font-bold">F5</span>: {isTr ? 'ESP32 Donanımsal Reset (EN)' : 'Hardware Reset (EN)'}</div>
              <div><span className="text-cyan-400 font-bold">F6</span>: {isTr ? 'ESP32 Bootloader Modu (IO0)' : 'Bootloader Mode (IO0)'}</div>
              <div><span className="text-cyan-400 font-bold">Shift + Scroll</span>: {isTr ? 'Paneller Arasında Yatay Gezinme' : 'Horizontal Panel Scroll'}</div>
              <div><span className="text-cyan-400 font-bold">Ctrl + Scroll / +/-</span>: {isTr ? 'Yazı Boyutu (Zoom In/Out)' : 'Zoom Font In / Out'}</div>
              <div><span className="text-cyan-400 font-bold">Ctrl + 0</span>: {isTr ? 'Yazı Boyutunu Sıfırla (12px)' : 'Reset Font Size (12px)'}</div>
              <div><span className="text-cyan-400 font-bold">Çift Tık (Komut)</span>: {isTr ? 'Hızlı Komut Düzenleme' : 'Edit Quick Command'}</div>
            </div>
          </div>

          {/* Downloads & Executables Reference */}
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isTr ? 'Çalıştırılabilir Dosyalar & İndirme Linkleri' : 'Executable Downloads & Binaries'}</span>
            </h3>
            <div className="bg-[#0f111a] border border-[#23263b] rounded-md p-3 space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="font-bold text-white block">Linux (x86_64)</span>
                    <span className="text-[#6c7086] text-[10px]">AppImage (Tek Tıkla Çalışır), .deb, .rpm</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  {isTr ? 'Hazır & Derlendi' : 'Ready & Built'}
                </span>
              </div>

              <div className="h-px bg-[#23263b]" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="font-bold text-white block">Windows (x64)</span>
                    <span className="text-[#6c7086] text-[10px]">Standalone .exe & .msi Installer</span>
                  </div>
                </div>
                <span className="text-amber-400 font-mono text-[10px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
                  {isTr ? 'GitHub Actions CI ile Otomatik' : 'Automated via CI'}
                </span>
              </div>

              <div className="h-px bg-[#23263b]" />

              <a
                href="https://github.com/metegokhan/esp32-serial-monitor-pro/releases"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded bg-[#181a28] hover:bg-[#202334] text-cyan-300 transition group border border-[#2a2d42]"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-medium">{isTr ? 'GitHub Sürümler & İndirme Sayfası' : 'GitHub Releases & Downloads'}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </a>
            </div>
          </div>

          {/* GitHub Repository Reference */}
          <div className="pt-2 border-t border-[#23263b] flex items-center justify-between text-[11px]">
            <a
              href="https://github.com/metegokhan/esp32-serial-monitor-pro"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white hover:text-cyan-300 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="font-mono">github.com/metegokhan/esp32-serial-monitor-pro</span>
            </a>
            <span className="text-[#6c7086]">MIT License</span>
          </div>
        </div>
      </div>
    </div>
  );
};
