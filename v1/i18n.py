"""
Internationalization (i18n) module for ESP32 Serial Capture & Monitor Pro.
Provides localization support for Turkish (tr) and English (en).
"""

from PyQt6.QtCore import QObject, pyqtSignal

TRANSLATIONS = {
    "tr": {
        # Window & App
        "app_title": "ESP32 Seri Port Yakalama ve İzleme Pro",
        
        # Menu Bar
        "menu_file": "📁 Dosya",
        "act_new_ref": "➕ Yeni Referans Paneli Aç",
        "act_make_ref": "📌 Aktif Logu Referans Yap",
        "act_archives": "📦 Oturum Arşivlerini Yönet...",
        "act_exit": "Çıkış",
        "menu_view": "👁️ Görünüm",
        "act_clear_all": "🧹 Tüm Panelleri Temizle",
        "menu_esp": "⚡ ESP32 Araçları",
        "act_esp_reset": "🔄 ESP32 Donanım Reset (EN Pin)",
        "act_esp_boot": "🚀 Bootloader Moduna Al (IO0+EN)",
        "act_reset_on_connect": "🔌 Bağlanırken Cihazı Resetle (DTR/RTS)",
        "act_reset_on_connect_tip": "Açıkken porta bağlanırken ESP32'yi resetler. Kapalıyken (Arduino gibi) cihaz kesintisiz çalışır.",
        "menu_lang": "🌐 Dil / Language",
        "lang_tr": "🇹🇷 Türkçe",
        "lang_en": "🇬🇧 English",

        # Top Control Toolbar
        "lbl_filter": "Filtre:",
        "filter_esp": "⚡ ESP Cihazları",
        "filter_arduino": "🔌 Arduino Cihazları",
        "filter_usb": "🖲️ Tüm USB Portlar",
        "filter_all": "🌐 Tüm Portlar",
        "lbl_port": "Port:",
        "btn_refresh_tip": "Portları Yenile",
        "lbl_baud": "Baud:",
        "btn_connect": "⚡ Bağlan",
        "btn_connecting": "⏳ Bağlanıyor...",
        "btn_disconnect": "⏹️ Bağlantıyı Kes",
        "chk_reset_on_connect": "Resetle",
        "chk_reset_on_connect_tip": "Bağlanırken Cihazı Resetle (DTR/RTS):\n• İşaretli: Port açıldığında donanımsal reset atılır (boot loglarını baştan yakalamak için).\n• İşaretsiz (Varsayılan): Tıpkı Arduino Serial Monitor gibi cihaz kesintisiz çalışmaya devam eder.",
        "chk_auto_reconnect": "Oto-Bağlan",
        "chk_auto_reconnect_tip": "Cihaz bağlantısı koptuğunda otomatik yeniden bağlan",
        "btn_reset_esp": "🔄 Reset (EN)",
        "btn_reset_esp_tip": "ESP32 Hardware Reset (F5)",
        "btn_boot_esp": "🚀 Boot (IO0)",
        "btn_boot_esp_tip": "ESP32 Bootloader Modu (F6)",
        "btn_add_panel": "➕ Referans Paneli Ekle",
        "btn_add_panel_tip": "Yan yana karşılaştırma için 3 adede kadar referans paneli ekleyin",
        "chk_timestamp": "⏰ Zaman Damgası",
        "chk_autoscroll": "⬇️ Oto-Kaydır",

        # Search & Filter Toolbar
        "lbl_search": "Arama:",
        "search_placeholder": "🔍 Kelime / regex ara veya süz...",
        "chk_filter_simultaneous": "🎯 Sadece Eşleşen Satırları Göster",
        "chk_filter_simultaneous_tip": "Tüm açık panellerde SADECE aranan kelimeyi içeren satırları eş zamanlı olarak gösterir",
        "chk_case": "Aa Eşle",
        "chk_case_tip": "Büyük / küçük harf duyarlı ara",
        "chk_regex": "Regex",
        "chk_regex_tip": "Düzenli ifade (regex) olarak ara",
        "btn_copy_matches": "📋 Eşleşenleri Kopyala",
        "btn_copy_matches_tip": "Tüm panellerdeki eşleşen satırları birleştirip panoya kopyalar",
        "lbl_trigger": "⚡ Tetikleyici:",
        "trigger_placeholder": "Örn: WiFi connected, Guru Meditation...",
        "chk_trigger_active": "Aktif",
        "chk_trigger_record": "Kayıt Başlat",
        "chk_trigger_record_tip": "Tetikleyici kelime görüldüğünde arka planda ayrı dosyaya otomatik kayıt başlat",

        # Bottom Command Bar
        "cmd_placeholder": "Cihaza gönderilecek komut... (Geçmiş komutlar için ↑/↓ tuşları)",
        "btn_send": "Gönder ⏎",
        "quick_cmd_sent": "Hızlı komut gönderildi: {cmd}",

        # Status Bar & Notifications
        "status_disconnected": "⚪ Bağlı Değil",
        "status_connected": "🟢 Bağlı: {port} @ {baudrate}",
        "status_no_archive": "📁 Arşiv: Pasif",
        "status_ready": "Hazır",
        "status_connected_msg": "✓ {port} portuna {baudrate} baud ile başarıyla bağlanıldı.",
        "status_disconnected_msg": "Bağlantı kesildi: {reason}",
        "status_bootloader_msg": "🚀 ESP32 Bootloader (İndirme) moduna alındı.",
        "status_copied_matches": "📋 Tüm panellerdeki eşleşen satırlar birleştirilip panoya kopyalandı!",
        "status_no_matches": "Hiçbir panelde eşleşen satır bulunamadı.",
        "status_word_copied": "📋 '{word}' kelimesi panoya kopyalandı.",

        # Panels
        "active_panel_title": "🟢 CANLI LOG AKIŞI",
        "ref_panel_title": "📌 REFERANS {idx}",
        "btn_make_ref": "📌 Referans Yap",
        "btn_make_ref_tip": "Bu paneldeki logları dondurup sol panele referans olarak kopyalar",
        "btn_load_log": "📂 Log Yükle",
        "btn_load_log_tip": "Eski bir log veya arşiv dosyasını bu panele yükleyin",
        "btn_export_tip": "Panel içeriğini .log veya .txt dosyasına kaydet",
        "btn_clear_tip": "Bu paneli temizle",
        "btn_close_panel_tip": "Bu paneli kapat",
        "badge_lines": "[ {count} Satır ]",
        "badge_filtered": "[ Süzüldü: {matched} / {total} Satır ]",

        # Gutter & Range Banner
        "range_banner_info": "📍 Nokta A ({start}) ➔ B ({end}) [{total} satır]",
        "btn_range_copy": "📋 Kopyala",
        "btn_range_save": "💾 Kaydet",
        "btn_range_clear_tip": "Seçimi Kaldır",

        # Archive Dialog
        "archive_title": "📦 Oturum Arşivi ve Log Yöneticisi",
        "archive_search_placeholder": "🔍 Arşiv dosyalarında veya portlarda ara...",
        "btn_open_folder": "📂 Klasörü Aç",
        "btn_refresh": "🔄 Yenile",
        "col_filename": "Dosya Adı",
        "col_datetime": "Tarih & Saat",
        "col_size": "Boyut",
        "archive_preview_title": "📄 Log Önizleme",
        "btn_archive_open_ref": "📌 Referans Olarak Aç",
        "btn_archive_open_ref_tip": "Seçili arşivi yan paneldeki referans alanına yükler",
        "btn_archive_export": "💾 Dışa Aktar",
        "btn_archive_delete": "🗑️ Sil",
        "btn_close": "Kapat",
        "del_confirm_title": "Arşiv Sil",
        "del_confirm_msg": "'{filename}' arşivi silinsin mi?",

        # Warnings & Dialogs
        "warn_select_port": "Lütfen geçerli bir seri port seçin.",
        "warn_invalid_baud": "Geçersiz Baud Rate.",
        "warn_max_panels": "En fazla 3 adet yan yana log paneli açabilirsiniz.",
        "warn_enter_filter_word": "Lütfen önce filtrelenecek kelimeyi girin.",
        "save_file_title": "Log Dosyasını Kaydet",
        "open_file_title": "Log Dosyası Aç",
        "no_port_found": "⚠️ Port bulunamadı",
        "user_disconnect_reason": "Kullanıcı tarafından bağlantı kesildi.",
    },
    "en": {
        # Window & App
        "app_title": "ESP32 Serial Capture & Monitor Pro",
        
        # Menu Bar
        "menu_file": "📁 File",
        "act_new_ref": "➕ Open New Reference Panel",
        "act_make_ref": "📌 Freeze Active Log as Reference",
        "act_archives": "📦 Manage Session Archives...",
        "act_exit": "Exit",
        "menu_view": "👁️ View",
        "act_clear_all": "🧹 Clear All Panels",
        "menu_esp": "⚡ ESP32 Tools",
        "act_esp_reset": "🔄 ESP32 Hardware Reset (EN Pin)",
        "act_esp_boot": "🚀 Enter Bootloader Mode (IO0+EN)",
        "act_reset_on_connect": "🔌 Reset Device on Connect (DTR/RTS)",
        "act_reset_on_connect_tip": "When checked, resets ESP32 when connecting. When unchecked (like Arduino), device runs uninterrupted.",
        "menu_lang": "🌐 Language / Dil",
        "lang_tr": "🇹🇷 Türkçe (Turkish)",
        "lang_en": "🇬🇧 English",

        # Top Control Toolbar
        "lbl_filter": "Filter:",
        "filter_esp": "⚡ ESP Devices",
        "filter_arduino": "🔌 Arduino Devices",
        "filter_usb": "🖲️ All USB Ports",
        "filter_all": "🌐 All Ports",
        "lbl_port": "Port:",
        "btn_refresh_tip": "Refresh Ports",
        "lbl_baud": "Baud:",
        "btn_connect": "⚡ Connect",
        "btn_connecting": "⏳ Connecting...",
        "btn_disconnect": "⏹️ Disconnect",
        "chk_reset_on_connect": "Reset on Connect",
        "chk_reset_on_connect_tip": "Reset Device on Connect (DTR/RTS):\n• Checked: Hardware reset is performed on connection (to capture boot logs).\n• Unchecked (Default): Device continues running uninterrupted, like Arduino Serial Monitor.",
        "chk_auto_reconnect": "Auto-Reconnect",
        "chk_auto_reconnect_tip": "Automatically reconnect if device connection drops",
        "btn_reset_esp": "🔄 Reset (EN)",
        "btn_reset_esp_tip": "ESP32 Hardware Reset (F5)",
        "btn_boot_esp": "🚀 Boot (IO0)",
        "btn_boot_esp_tip": "ESP32 Bootloader Mode (F6)",
        "btn_add_panel": "➕ Add Reference Panel",
        "btn_add_panel_tip": "Add up to 3 side-by-side reference panels for comparison",
        "chk_timestamp": "⏰ Timestamp",
        "chk_autoscroll": "⬇️ Auto-Scroll",

        # Search & Filter Toolbar
        "lbl_search": "Search:",
        "search_placeholder": "🔍 Search or filter word / regex...",
        "chk_filter_simultaneous": "🎯 Show Matching Lines Only",
        "chk_filter_simultaneous_tip": "Simultaneously displays ONLY lines matching the search term across all open panels",
        "chk_case": "Aa Match Case",
        "chk_case_tip": "Case sensitive search",
        "chk_regex": "Regex",
        "chk_regex_tip": "Regular expression search",
        "btn_copy_matches": "📋 Copy Matches",
        "btn_copy_matches_tip": "Merge and copy matched lines from all panels to clipboard",
        "lbl_trigger": "⚡ Trigger:",
        "trigger_placeholder": "e.g. WiFi connected, Guru Meditation...",
        "chk_trigger_active": "Active",
        "chk_trigger_record": "Auto-Record",
        "chk_trigger_record_tip": "Automatically start recording to a separate file when trigger word appears",

        # Bottom Command Bar
        "cmd_placeholder": "Command to send to device... (Up/Down arrow for history)",
        "btn_send": "Send ⏎",
        "quick_cmd_sent": "Quick command sent: {cmd}",

        # Status Bar & Notifications
        "status_disconnected": "⚪ Not Connected",
        "status_connected": "🟢 Connected: {port} @ {baudrate}",
        "status_no_archive": "📁 Archive: Inactive",
        "status_ready": "Ready",
        "status_connected_msg": "✓ Successfully connected to {port} @ {baudrate} baud.",
        "status_disconnected_msg": "Disconnected: {reason}",
        "status_bootloader_msg": "🚀 ESP32 placed in Bootloader (Download) mode.",
        "status_copied_matches": "📋 Matched lines from all panels merged and copied to clipboard!",
        "status_no_matches": "No matching lines found in any panel.",
        "status_word_copied": "📋 '{word}' copied to clipboard.",

        # Panels
        "active_panel_title": "🟢 LIVE LOG STREAM",
        "ref_panel_title": "📌 REFERENCE {idx}",
        "btn_make_ref": "📌 Make Reference",
        "btn_make_ref_tip": "Freeze this panel's logs and clone as a reference to the left",
        "btn_load_log": "📂 Load Log",
        "btn_load_log_tip": "Load an older log or archive file into this panel",
        "btn_export_tip": "Save panel content to .log or .txt file",
        "btn_clear_tip": "Clear this panel",
        "btn_close_panel_tip": "Close this panel",
        "badge_lines": "[ {count} Lines ]",
        "badge_filtered": "[ Filtered: {matched} / {total} Lines ]",

        # Gutter & Range Banner
        "range_banner_info": "📍 Point A ({start}) ➔ B ({end}) [{total} lines]",
        "btn_range_copy": "📋 Copy",
        "btn_range_save": "💾 Save",
        "btn_range_clear_tip": "Clear Selection",

        # Archive Dialog
        "archive_title": "📦 Session Archive & Log Manager",
        "archive_search_placeholder": "🔍 Search archives or ports...",
        "btn_open_folder": "📂 Open Folder",
        "btn_refresh": "🔄 Refresh",
        "col_filename": "File Name",
        "col_datetime": "Date & Time",
        "col_size": "Size",
        "archive_preview_title": "📄 Log Preview",
        "btn_archive_open_ref": "📌 Open as Reference",
        "btn_archive_open_ref_tip": "Loads selected archive into a reference panel",
        "btn_archive_export": "💾 Export",
        "btn_archive_delete": "🗑️ Delete",
        "btn_close": "Close",
        "del_confirm_title": "Delete Archive",
        "del_confirm_msg": "Delete archive '{filename}'?",

        # Warnings & Dialogs
        "warn_select_port": "Please select a valid serial port.",
        "warn_invalid_baud": "Invalid Baud Rate.",
        "warn_max_panels": "You can open up to 3 side-by-side log panels.",
        "warn_enter_filter_word": "Please enter a word to filter first.",
        "save_file_title": "Save Log File",
        "open_file_title": "Open Log File",
        "no_port_found": "⚠️ No port found",
        "user_disconnect_reason": "Disconnected by user.",
    }
}


class I18nManager(QObject):
    language_changed = pyqtSignal(str)

    def __init__(self, default_lang="tr"):
        super().__init__()
        self.lang = default_lang
        self.translations = TRANSLATIONS

    def set_language(self, lang: str):
        if lang in self.translations and lang != self.lang:
            self.lang = lang
            self.language_changed.emit(lang)

    def get_language(self) -> str:
        return self.lang

    def t(self, key: str, **kwargs) -> str:
        lang_dict = self.translations.get(self.lang, self.translations.get("tr", {}))
        text = lang_dict.get(key, self.translations.get("en", {}).get(key, key))
        if kwargs:
            try:
                return text.format(**kwargs)
            except Exception:
                return text
        return text


# Global instance
i18n = I18nManager()


def t(key: str, **kwargs) -> str:
    """Helper function to translate keys with optional formatting."""
    return i18n.t(key, **kwargs)
