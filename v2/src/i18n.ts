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
    searchPlaceholder: 'Filtrele veya ara (Enter / Virgül ile toplu ekle)...',
    filterMatchingOnly: 'Sadece Eşleşenleri Göster',
    filterMatchingOnlyTip: 'Açık olan TÜM panellerde etiketlerden en az birini içeren satırları filtreler (A veya B)',
    matchCase: 'Aa Eşle',
    regex: 'Regex',
    variableMode: '{x} Değişken',
    variableModeTip: 'Değişken Modu (Aritmetik & Mantıksal Filtreleme):\n• Loglardaki key:value ve key=value değerlerini otomatik tanır.\n• Örn: fps > 10 ve sync = true\n• Örn: fps x audio > 1200\n• Operatörler: >, <, >=, <=, ==, !=, =!, +, -, *, x, /, ve (and), veya/yada (or)',
    variableSearchPlaceholder: 'Değişken filtresi (örn: fps > 10 ve sync = true, fps x audio > 1200)...',
    filterPresets: 'Kayıtlı Filtreler',
    filterPresetsTip: 'Filtre şablonlarını yönetin veya mevcut filtreleri kaydedin',
    peekMode: 'Önizleme',
    hoverToPeekTip: 'Sadece bu filtreyi izole etmek için üzerine gelin',
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
    autoReconnect: 'Oto-Yeniden Bağlan',
    autoReconnectTip: 'Bağlantı koptuğunda veya cihaz yeniden başlatıldığında otomatik olarak tekrar bağlanır',
    autoClose: 'Oto Kapat',
    autoCloseTip: 'Belirtilen saniye sonra portu otomatik kapatır (portun boşuna tutulmasını önler). Değer girilmezse hep açık kalır.',
    autoCloseSeconds: 'sn',
    autoCloseRemaining: 'Otomatik kapanmaya {sec} sn kaldı (İptal etmek için tıklayın)',
    autoCloseTriggeredMsg: '⏱️ [{port}] Otomatik kapatma süresi ({sec} sn) tamamlandı. Port serbest bırakıldı.',
    defaultAutoCloseSec: 'Varsayılan Otomatik Kapatma (Saniye)',
    defaultAutoCloseTip: 'Yeni paneller için otomatik kapanma süresi. Portun boşuna tutulmasını önler (0 = devre dışı / hep açık kalır).',
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
    
    // Font & Display settings
    fontFamily: 'Yazı Tipi',
    fontSize: 'Yazı Boyutu',
    decreaseFontSize: 'Yazı Boyutunu Küçült (Ctrl+-)',
    increaseFontSize: 'Yazı Boyutunu Büyüt (Ctrl++)',
    maxLogCapacity: 'Maksimum Log Kapasitesi (Satır)',
    maxLogCapacityTip: 'Panel belleğinde tutulacak en fazla satır sayısı (aşınca eskiler otomatik temizlenir)',

    // Bulk Filters
    bulkFilterModal: 'Toplu Filtre Ekle',
    bulkFilterTip: 'Virgül veya yeni satır ile ayrılmış çoklu filtreleri tek seferde ekleyin',
    bulkFilterPlaceholder: 'Örn: HEAP BOZULDU, CORRUPT HEAP, uygulama TCB, jpeg, Guru Meditation, MEPC, TESHIS',
    addAsNormalFilters: 'Normal Filtre Olarak Ekle',
    addAsTriggers: '🎯 Tetikleyici Olarak Ekle',

    // Trigger Actions
    triggerActions: 'Tetikleme Aksiyonları',
    triggerSettings: 'Tetikleme & Aksiyon Ayarları',
    triggerArmed: 'Tetikleme Modu (Armed)',
    triggerArmedTip: 'Tetikleme açıksa tetiklenene kadar filtrelenmiş kelimeli satırlar dışında hiçbir kayıt tutulmaz',
    playAudio: 'Ses Çalma (Web Audio)',
    httpsTrigger: 'HTTPS Webhook Tetikleme',
    webhookUrl: 'Webhook URL',
    restartConnection: 'Bağlantıyı Yeniden Başlat (Restart Connection)',
    sendSerialCommand: 'Seri Porta Komut Gönder',
    endSerialConnection: 'Seri Bağlantıyı Sonlandır (End Connection)',
    testAction: 'Test Et',

    // Auto Naming
    autoNaming: 'Otomatik Panel İsimlendirme',
    autoNamingTip: 'Boot loglarından model/etiket yakalayarak paneli ve kayıt dosyalarını otomatik isimlendirir',
    autoNamingRule: 'İsimlendirme Kuralı',
    autoNamingRuleExample: 'Örn: "esp-rom:" (sonrasını alır) ya da "esp-rom"+ (tüm satırı alır)',

    // Google Drive
    gdrive: 'Google Drive',
    gdriveBackup: 'Google Drive Yedekleme & Senkronizasyon',
    gdriveLogin: 'Google Drive Girişi',
    gdriveLogout: 'Çıkış Yap',
    gdriveSaveLogs: 'Logları Drive\'a Yükle',
    gdriveSaveFilters: 'Filtre Setlerini Drive\'a Yedekle',
    gdriveSaveSettings: 'Ayarları Drive\'a Yedekle',
    gdriveFullBackup: 'Tek Tıkla Tam Yedek Al',
    gdriveFiles: 'Drive Yedek Dosyaları',
    gdriveRestore: 'Geri Yükle',
    gdriveOpenAsRef: 'Referans Olarak Aç',

    // Pins & Tags
    pins: 'Pinler / Taglar',
    addPin: 'Pin / Tag Ekle',
    clearAllPins: 'Tüm Pinleri Temizle',
    pinnedLines: 'Sabitlenmiş Satırlar (Pinler)',

    // AI Model Integration
    aiConsole: 'AI Model Denetim Konsolu',
    aiSkill: 'AI Model Beceri & Komut Rehberi',
    aiCommandsLogged: 'AI model komutları burada anlık loglanır',

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
    searchPlaceholder: 'Filter or search (Enter / Comma to bulk add)...',
    filterMatchingOnly: 'Show Matches Only',
    filterMatchingOnlyTip: 'Simultaneously filters lines matching ANY of the active filter tags (A or B) across all panels',
    matchCase: 'Match Case',
    regex: 'Regex',
    variableMode: '{x} Variable',
    variableModeTip: 'Variable Mode (Arithmetic & Logic Filtering):\n• Automatically parses key:value and key=value from logs.\n• e.g. fps > 10 and sync = true\n• e.g. fps * audio > 1200\n• Operators: >, <, >=, <=, ==, !=, =!, +, -, *, x, /, and, or',
    variableSearchPlaceholder: 'Variable filter (e.g. fps > 10 and sync = true, fps * audio > 1200)...',
    filterPresets: 'Filter Presets',
    filterPresetsTip: 'Manage filter presets or save current filters',
    peekMode: 'Peek',
    hoverToPeekTip: 'Hover to isolate and view only this filter',
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
    autoReconnectTip: 'Automatically re-establishes connection if device disconnects or resets',
    autoClose: 'Auto-Close',
    autoCloseTip: 'Automatically disconnects the port after specified seconds (prevents holding the port in vain). If no value is entered, it stays open indefinitely.',
    autoCloseSeconds: 's',
    autoCloseRemaining: 'Auto-closing in {sec}s (Click to cancel)',
    autoCloseTriggeredMsg: '⏱️ [{port}] Auto-close timeout ({sec}s) reached. Port released.',
    defaultAutoCloseSec: 'Default Auto-Close Timeout (Seconds)',
    defaultAutoCloseTip: 'Default auto-disconnect timeout for panels. Prevents holding the serial port unnecessarily (0 = disabled / always open).',
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
    
    // Font & Display settings
    fontFamily: 'Font Family',
    fontSize: 'Font Size',
    decreaseFontSize: 'Decrease Font Size (Ctrl+-)',
    increaseFontSize: 'Increase Font Size (Ctrl++)',
    maxLogCapacity: 'Max Log Capacity (Lines)',
    maxLogCapacityTip: 'Maximum number of buffered lines in memory per panel',

    // Bulk Filters
    bulkFilterModal: 'Bulk Add Filters',
    bulkFilterTip: 'Add multiple filters separated by comma or newlines at once',
    bulkFilterPlaceholder: 'e.g. HEAP BOZULDU, CORRUPT HEAP, uygulama TCB, jpeg, Guru Meditation, MEPC, TESHIS',
    addAsNormalFilters: 'Add as Normal Filters',
    addAsTriggers: '🎯 Add as Triggers',

    // Trigger Actions
    triggerActions: 'Trigger Actions',
    triggerSettings: 'Trigger & Action Settings',
    triggerArmed: 'Armed Mode',
    triggerArmedTip: 'When armed, no logs except matching filter words are stored until a trigger is hit',
    playAudio: 'Play Sound (Web Audio)',
    httpsTrigger: 'HTTPS Webhook Trigger',
    webhookUrl: 'Webhook URL',
    restartConnection: 'Restart Connection',
    sendSerialCommand: 'Send Serial Command',
    endSerialConnection: 'End Serial Connection',
    testAction: 'Test',

    // Auto Naming
    autoNaming: 'Auto Panel Naming',
    autoNamingTip: 'Automatically names panel and saved files from device boot logs',
    autoNamingRule: 'Naming Rule',
    autoNamingRuleExample: 'e.g. "esp-rom:" (takes text after) or "esp-rom"+ (takes full line)',

    // Google Drive
    gdrive: 'Google Drive',
    gdriveBackup: 'Google Drive Backup & Sync',
    gdriveLogin: 'Google Drive Sign-in',
    gdriveLogout: 'Sign Out',
    gdriveSaveLogs: 'Upload Logs to Drive',
    gdriveSaveFilters: 'Backup Filter Sets to Drive',
    gdriveSaveSettings: 'Backup Settings to Drive',
    gdriveFullBackup: 'Full One-Click Backup',
    gdriveFiles: 'Drive Backup Files',
    gdriveRestore: 'Restore',
    gdriveOpenAsRef: 'Open as Reference',
    // Pins & Tags
    pins: 'Pins / Tags',
    addPin: 'Add Pin / Tag',
    clearAllPins: 'Clear All Pins',
    pinnedLines: 'Pinned Lines',

    // AI Model Integration
    aiConsole: 'AI Model Audit Console',
    aiSkill: 'AI Model Skill & Command Guide',
    aiCommandsLogged: 'AI model terminal commands are logged here in real-time',

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
