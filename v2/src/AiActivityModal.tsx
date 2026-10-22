import React, { useState } from 'react';
import { AiCommandLog, I18nLanguage, AiModelClient } from './types';
import {
  Bot,
  X,
  Trash2,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  BookOpen,
  Search,
  Radio,
} from 'lucide-react';

interface AiActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
  aiLogs: AiCommandLog[];
  connectedAiModels?: AiModelClient[];
  onClearLogs: () => void;
  onNotification: (msg: string) => void;
}

export const AiActivityModal: React.FC<AiActivityModalProps> = ({
  isOpen,
  onClose,
  lang,
  aiLogs,
  connectedAiModels = [],
  onClearLogs,
  onNotification,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'success' | 'error'>('all');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLogs = aiLogs.filter((log) => {
    if (selectedFilter === 'success' && log.status !== 200) return false;
    if (selectedFilter === 'error' && log.status === 200) return false;
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.endpoint.toLowerCase().includes(q) ||
      log.method.toLowerCase().includes(q) ||
      log.payload.toLowerCase().includes(q) ||
      log.response.toLowerCase().includes(q)
    );
  });

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText('./smp');
    onNotification(lang === 'tr' ? './smp panoya kopyalandı.' : './smp copied to clipboard.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141622] border border-[#2d3047] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#25283b] flex items-center justify-between bg-[#10121d]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  {lang === 'tr' ? 'AI Agent & Terminal Komut Konsolu' : 'AI Agent & Terminal Command Console'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>http://127.0.0.1:4567</span>
                </span>
              </div>
              <p className="text-[11px] text-[#6c7086]">
                {lang === 'tr'
                  ? 'Harici AI modelleri ve terminal betikleri tarafından `./smp` veya HTTP API ile yürütülen canlı komutlar'
                  : 'Live commands executed by external AI models & terminal scripts via `./smp` or HTTP API'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSkillModal(!showSkillModal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showSkillModal ? (lang === 'tr' ? 'Logları Göster' : 'Show Logs') : (lang === 'tr' ? 'AI Yetenek Kılavuzu' : 'AI Skill Guide')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#6c7086] hover:text-white hover:bg-[#1e2030] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {showSkillModal ? (
          <div className="flex-1 overflow-y-auto p-5 bg-[#0d0e15] text-[#cdd6f4] font-mono text-xs leading-relaxed space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#25283b]">
              <div>
                <h3 className="text-sm font-bold text-white">🤖 AI Agent Skill & Headless API</h3>
                <p className="text-[11px] text-[#6c7086]">Terminalden `./smp` komutunu veya `curl http://127.0.0.1:4567/api/...` çağrısını kullanarak tüm sistemi kontrol edin.</p>
              </div>
              <button
                onClick={handleCopyCliCommand}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>./smp kopyala</span>
              </button>
            </div>

            <div className="bg-[#141622] p-4 rounded-xl border border-[#2d3047] space-y-3">
              <div className="text-emerald-400 font-bold"># Hızlı Kullanım Örnekleri (Terminal / AI Subagent):</div>
              <div className="bg-[#090a10] p-3 rounded-lg border border-[#25283b] space-y-2 text-[11px]">
                <div><span className="text-[#6c7086]"># 1. Cihaz ve Port Durumunu Sorgula</span></div>
                <div className="text-cyan-300">./smp status</div>
                <div><span className="text-[#6c7086]"># 2. Portları Tara (ESP32, Arduino otomatik bulunur)</span></div>
                <div className="text-cyan-300">./smp ports</div>
                <div><span className="text-[#6c7086]"># 3. Porta Bağlan (Opsiyonel: --reset ile boot logu yakala)</span></div>
                <div className="text-cyan-300">./smp connect /dev/ttyUSB0 115200 --reset</div>
                <div><span className="text-[#6c7086]"># 4. Son 20 Satır Logu Oku (Opsiyonel: filtre ile)</span></div>
                <div className="text-cyan-300">./smp logs --tail 20 --filter "HEAP"</div>
                <div><span className="text-[#6c7086]"># 5. Kritik Hata Satırına Pin / Tag Ekle</span></div>
                <div className="text-cyan-300">./smp pin 42 "Guru Meditation crash noktası"</div>
                <div><span className="text-[#6c7086]"># 6. Toplu Filtre Ekle</span></div>
                <div className="text-cyan-300">./smp filter add "CORRUPT HEAP, Guru Meditation, MEPC"</div>
                <div><span className="text-[#6c7086]"># 7. ESP32 Donanımsal Reset (EN) At</span></div>
                <div className="text-cyan-300">./smp reset</div>
                <div><span className="text-[#6c7086]"># 8. Seri Porta Komut Gönder</span></div>
                <div className="text-cyan-300">./smp send "status"</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter and Action Bar */}
            <div className="p-3 bg-[#11131e] border-b border-[#25283b] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6c7086]" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder={lang === 'tr' ? 'Komut veya çıktı ara...' : 'Filter commands or output...'}
                    className="w-full bg-[#0d0e15] border border-[#2d3047] focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#50546c] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#181a29] p-0.5 rounded-lg border border-[#2d3047] text-xs">
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                      selectedFilter === 'all'
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-[#898da0] hover:text-white'
                    }`}
                  >
                    {lang === 'tr' ? 'Tümü' : 'All'} ({aiLogs.length})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('success')}
                    className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                      selectedFilter === 'success'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-[#898da0] hover:text-emerald-400'
                    }`}
                  >
                    200 OK
                  </button>
                  <button
                    onClick={() => setSelectedFilter('error')}
                    className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                      selectedFilter === 'error'
                        ? 'bg-rose-600 text-white font-medium'
                        : 'text-[#898da0] hover:text-rose-400'
                    }`}
                  >
                    {lang === 'tr' ? 'Hatalar' : 'Errors'}
                  </button>
                </div>
              </div>

              <button
                onClick={onClearLogs}
                disabled={aiLogs.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'tr' ? 'Logları Temizle' : 'Clear Logs'}</span>
              </button>
            </div>

            {/* Connected AI Models Peer Discovery (Cross-Model Visibility) */}
            {connectedAiModels && connectedAiModels.length > 0 && (
              <div className="px-4 py-2.5 bg-[#0e101a] border-b border-[#25283b]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span>{lang === 'tr' ? 'Bağlı AI Modelleri & Portlar (Model Eşleri)' : 'Connected AI Models & Ports (Peer Discovery)'}</span>
                  </span>
                  <span className="text-[10px] text-[#6c7086]">
                    {connectedAiModels.length} {lang === 'tr' ? 'model aktif' : 'agents active'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {connectedAiModels.map((model) => {
                    const ago = (model as any).last_seen_seconds_ago ?? model.last_seen_sec ?? 0;
                    const isLive = ago < 120;
                    return (
                      <div
                        key={model.id || model.client_id}
                        className="bg-[#141624] border border-[#272b43] p-2.5 rounded-lg flex items-start justify-between gap-2 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-xs font-bold text-white truncate" title={model.model_name}>
                              {model.model_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-cyan-300 font-mono mt-1">
                            <span>📡 {model.active_port || (lang === 'tr' ? 'Port Bağlı Değil' : 'No Port Attached')}</span>
                          </div>
                          <div className="text-[10px] text-[#6c7086] truncate mt-0.5" title={model.last_command}>
                            {lang === 'tr' ? 'Son Komut' : 'Last'}: <span className="text-slate-400 font-mono">{model.last_command || 'status'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono shrink-0">
                          {ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Log List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0f111a]">
              {filteredLogs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-[#6c7086] space-y-2">
                  <Terminal className="w-8 h-8 opacity-40 text-indigo-400" />
                  <p className="text-xs">
                    {lang === 'tr'
                      ? 'Henüz bir AI komutu yürütülmedi. Terminal üzerinden `./smp status` veya `./smp connect` çalıştırabilirsiniz.'
                      : 'No AI commands recorded yet. Run `./smp status` or `./smp connect` from terminal.'}
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isOk = log.status === 200;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className={`bg-[#181a29] border rounded-xl p-3 transition cursor-pointer ${
                        isOk
                          ? 'border-[#2d3047] hover:border-indigo-500/50'
                          : 'border-rose-500/50 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.method === 'POST'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : log.method === 'DELETE'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className="font-bold text-white">{log.endpoint}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#898da0] font-mono">
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              isOk ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            <span>{log.status}</span>
                          </span>
                          <span>{log.timestamp}</span>
                        </div>
                      </div>

                      {log.payload && (
                        <div className="mt-2 text-[11px] font-mono text-[#a6adc8] truncate bg-[#10121d] px-2.5 py-1 rounded border border-[#25283b]">
                          <span className="text-[#6c7086]">Giriş: </span>
                          <span>{log.payload}</span>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#25283b] space-y-2 text-xs font-mono animate-in fade-in duration-100">
                          <div>
                            <span className="text-[#6c7086] text-[10px] uppercase font-bold block mb-1">
                              Çıktı / Yanıt:
                            </span>
                            <pre className="bg-[#090a10] p-3 rounded-lg border border-[#25283b] text-emerald-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                              {log.response}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#25283b] flex items-center justify-between bg-[#10121d] text-[11px] text-[#6c7086]">
          <span>
            {lang === 'tr' ? 'CLI komutları canlı dinlenir ve GUI tuvaline anında yansıtılır.' : 'CLI commands are listened to live and synced to the canvas.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
          >
            {lang === 'tr' ? 'Kapat' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
