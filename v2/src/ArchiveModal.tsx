import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArchiveEntry, I18nLanguage } from './types';
import { t } from './i18n';
import { X, Search, FileText, Trash2, ExternalLink, RefreshCw, Folder, Download } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: I18nLanguage;
  onOpenAsReference: (filepath: string, content: string, filename: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenAsReference,
}) => {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArchive, setSelectedArchive] = useState<ArchiveEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const list: ArchiveEntry[] = await invoke('get_archives');
      setArchives(list);
      if (list.length > 0 && !selectedArchive) {
        selectArchive(list[0]);
      }
    } catch (err) {
      console.error('Failed to load archives:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectArchive = async (entry: ArchiveEntry) => {
    setSelectedArchive(entry);
    try {
      const content: string = await invoke('read_archive_file', { filepath: entry.path });
      // Truncate preview if gigantic
      setPreviewContent(content.slice(0, 10000) + (content.length > 10000 ? '\n... [Önizleme kesildi]' : ''));
    } catch (err) {
      setPreviewContent('Önizleme yüklenemedi: ' + String(err));
    }
  };

  const handleDelete = async (entry: ArchiveEntry) => {
    if (!window.confirm(t('confirmDelete', lang, { name: entry.filename }))) return;
    try {
      await invoke('delete_archive_file', { filepath: entry.path });
      if (selectedArchive?.path === entry.path) {
        setSelectedArchive(null);
        setPreviewContent('');
      }
      await loadArchives();
    } catch (err) {
      alert('Silme hatası: ' + String(err));
    }
  };

  const handleOpenReference = async (entry: ArchiveEntry) => {
    try {
      const content: string = await invoke('read_archive_file', { filepath: entry.path });
      onOpenAsReference(entry.path, content, entry.filename);
      onClose();
    } catch (err) {
      alert('Arşiv açılamadı: ' + String(err));
    }
  };

  const handleExportArchive = async (entry: ArchiveEntry) => {
    try {
      const content = previewContent || (await invoke<string>('read_archive_file', { filepath: entry.path }));
      await invoke('export_log_dialog', { defaultFilename: entry.filename, content });
    } catch (err) {
      alert('Dışa aktarma hatası: ' + String(err));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadArchives();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = archives.filter(
    (a) =>
      a.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.port.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#181825] border border-slate-700/80 rounded-lg shadow-2xl w-full max-w-4xl h-[650px] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e1e2e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">{t('archiveTitle', lang)}</h2>
              <p className="text-xs text-slate-400">{archives.length} {t('linesCount', lang, { count: archives.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadArchives}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-[#14141e] flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchArchives', lang)}
              className="w-full bg-[#181825] border border-slate-700/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Body: Split List & Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Archive List */}
          <div className="w-1/2 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60 bg-[#13141f]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">{t('noArchives', lang)}</div>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedArchive?.path === item.path;
                return (
                  <div
                    key={item.path}
                    onClick={() => selectArchive(item)}
                    onDoubleClick={() => handleOpenReference(item)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-500/15 border-l-4 border-sky-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 truncate">
                      <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.filename}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300 font-mono text-[10px]">
                            {item.port}
                          </span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-[11px] font-mono text-slate-400">{item.size_str}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Preview Pane */}
          <div className="w-1/2 flex flex-col bg-[#0f1017]">
            {selectedArchive ? (
              <>
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-[#161724]">
                  <span className="text-xs font-mono font-medium text-slate-300 truncate">
                    {selectedArchive.filename}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReference(selectedArchive)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('openAsRef', lang)}
                    </button>
                    <button
                      onClick={() => handleExportArchive(selectedArchive)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition-colors shadow-sm"
                      title={t('exportArchive', lang)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t('exportArchive', lang)}
                    </button>
                    <button
                      onClick={() => handleDelete(selectedArchive)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                      title={t('deleteArchive', lang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-3 font-mono text-xs text-slate-300 overflow-auto whitespace-pre-wrap select-text leading-5">
                  {previewContent || 'Log dosyası boş.'}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                Önizlemek için soldan bir arşiv seçin.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
