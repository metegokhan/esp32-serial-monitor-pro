import { I18nLanguage } from './types';

export const TRANSLATIONS = {
  tr: {
    appTitle: 'Serial Monitor Pro',
    addPanel: 'Yeni Panel Ekle',
    archives: 'Oturum Arşivleri',
    clearAll: 'Tümünü Temizle',
    language: 'Dil',
    langTr: 'Türkçe',
    langEn: 'English',
    searchPlaceholder: 'Tüm panellerde anlık ara veya süz (regex destekli)...',
    filterMatchingOnly: 'Sadece Eşleşenleri Göster',
    filterMatchingOnlyTip: 'Açık olan TÜM panellerde sadece aranan kelimeyi içeren satırları eş zamanlı olarak filtreler',
    matchCase: 'Aa Eşle',
    regex: 'Regex',
    copyMatches: 'Eşleşenleri Kopyala',
    triggerLabel: 'Tetikleyici:',
    triggerPlaceholder: 'Örn: WiFi connected, Guru Meditation...',
    autoRecord: 'Oto-Kayıt',
    
    // Panel
    liveBadge: 'CANLI BAĞLANTI',
    refBadge: 'REFERANS',
    selectPort: 'Port Seç...',
    connect: 'Bağlan',
    connecting: 'Bağlanıyor...',
    disconnect: 'Bağlantıyı Kes',
    resetOnConnect: 'Resetle',
    resetOnConnectTip: 'Bağlanırken Cihazı Resetle (DTR/RTS):\n• İşaretli: Port açıldığında donanımsal reset atılır (boot loglarını baştan yakalamak için).\n• İşaretsiz (Varsayılan): Tıpkı Arduino Serial Monitor gibi cihaz kesintisiz çalışmaya devam eder.',
    autoReconnect: 'Oto-Bağlan',
    hwReset: 'Reset (EN)',
    hwResetTip: 'ESP32 Donanımsal Reset (F5)',
    bootloader: 'Boot (IO0)',
    bootloaderTip: 'ESP32 Bootloader Modu (F6)',
    makeRef: 'Referans Yap',
    makeRefTip: 'Bu paneldeki logları dondurup sol tarafa yeni referans paneli olarak klonlar',
    loadLog: 'Log Yükle',
    loadLogTip: 'Eski bir log veya arşiv dosyasını bu panele yükleyin',
    export: 'Dışa Aktar',
    clear: 'Temizle',
    close: 'Kapat',
    autoScroll: 'Oto-Kaydır',
    timestamps: 'Zaman Damgası',
    commandPlaceholder: 'Komut gönder... (↑/↓ geçmiş)',
    send: 'Gönder',
    linesCount: '{count} satır',
    filteredCount: 'Süzüldü: {matched} / {total}',
    
    // Gutter banner
    rangeSelected: 'Nokta A (Satır {a}) ➔ Nokta B (Satır {b}) [{count} satır]',
    copyRange: 'Aralığı Kopyala',
    exportRange: 'Aralığı Kaydet',
    clearSelection: 'Seçimi Kaldır',
    
    // Archive Modal
    archiveTitle: 'Oturum Arşivleri Yöneticisi',
    searchArchives: 'Arşivlerde ara...',
    openAsRef: 'Referans Olarak Aç',
    deleteArchive: 'Sil',
    exportArchive: 'Dışa Aktar',
    archiveFolder: 'Arşiv Klasörü',
    noArchives: 'Henüz arşivlenmiş oturum bulunmuyor.',
    confirmDelete: '"{name}" arşivi silinsin mi?',
    
    // Notifications
    connectedMsg: 'Bağlantı kuruldu: {port} @ {baud} baud',
    disconnectedMsg: 'Bağlantı kesildi: {port}',
    copiedRangeMsg: 'Seçili aralık ({count} satır) panoya kopyalandı.',
    copiedWordMsg: '"{word}" panoya kopyalandı ve tüm panellerde vurgulandı.',
    copiedMatchesMsg: 'Tüm panellerdeki eşleşen satırlar birleştirilip panoya kopyalandı.',
  },
  en: {
    appTitle: 'Serial Monitor Pro',
    addPanel: 'Add Panel',
    archives: 'Session Archives',
    clearAll: 'Clear All',
    language: 'Language',
    langTr: 'Türkçe',
    langEn: 'English',
    searchPlaceholder: 'Search or filter across all panels (regex supported)...',
    filterMatchingOnly: 'Show Matches Only',
    filterMatchingOnlyTip: 'Simultaneously filters and displays ONLY lines matching the search term across ALL open panels',
    matchCase: 'Match Case',
    regex: 'Regex',
    copyMatches: 'Copy Matches',
    triggerLabel: 'Trigger:',
    triggerPlaceholder: 'e.g. WiFi connected, Guru Meditation...',
    autoRecord: 'Auto-Record',
    
    // Panel
    liveBadge: 'LIVE STREAM',
    refBadge: 'REFERENCE',
    selectPort: 'Select Port...',
    connect: 'Connect',
    connecting: 'Connecting...',
    disconnect: 'Disconnect',
    resetOnConnect: 'Reset on Connect',
    resetOnConnectTip: 'Reset Device on Connect (DTR/RTS):\n• Checked: Hardware reset is performed on connection (to capture boot logs).\n• Unchecked (Default): Device continues running uninterrupted, like Arduino Serial Monitor.',
    autoReconnect: 'Auto-Reconnect',
    hwReset: 'Reset (EN)',
    hwResetTip: 'ESP32 Hardware Reset (F5)',
    bootloader: 'Boot (IO0)',
    bootloaderTip: 'ESP32 Bootloader Mode (F6)',
    makeRef: 'Make Reference',
    makeRefTip: 'Freeze this panel\'s log and clone as a reference panel to the left',
    loadLog: 'Load Log',
    loadLogTip: 'Load a log file or archive into this panel',
    export: 'Export',
    clear: 'Clear',
    close: 'Close',
    autoScroll: 'Auto-Scroll',
    timestamps: 'Timestamps',
    commandPlaceholder: 'Send command... (↑/↓ history)',
    send: 'Send',
    linesCount: '{count} lines',
    filteredCount: 'Filtered: {matched} / {total}',
    
    // Gutter banner
    rangeSelected: 'Point A (Line {a}) ➔ Point B (Line {b}) [{count} lines]',
    copyRange: 'Copy Range',
    exportRange: 'Save Range',
    clearSelection: 'Clear Selection',
    
    // Archive Modal
    archiveTitle: 'Session Archive Manager',
    searchArchives: 'Search archives...',
    openAsRef: 'Open as Reference',
    deleteArchive: 'Delete',
    exportArchive: 'Export',
    archiveFolder: 'Archive Folder',
    noArchives: 'No archived sessions found.',
    confirmDelete: 'Delete archive "{name}"?',
    
    // Notifications
    connectedMsg: 'Connected: {port} @ {baud} baud',
    disconnectedMsg: 'Disconnected: {port}',
    copiedRangeMsg: 'Selected range ({count} lines) copied to clipboard.',
    copiedWordMsg: '"{word}" copied to clipboard and highlighted across all panels.',
    copiedMatchesMsg: 'Matched lines from all panels merged and copied to clipboard.',
  }
};

export function t(key: keyof typeof TRANSLATIONS.tr, lang: I18nLanguage, params?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return text;
}
