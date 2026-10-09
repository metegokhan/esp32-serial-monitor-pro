import datetime
from pathlib import Path
from typing import List, Optional

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QComboBox, QPushButton, QLabel, QLineEdit, QCheckBox,
    QStatusBar, QFileDialog, QMessageBox, QFrame,
    QSplitter, QApplication
)
from PyQt6.QtGui import QAction, QKeySequence
from PyQt6.QtCore import Qt, pyqtSlot

from config_manager import ConfigManager
from port_scanner import PortScanner
from serial_worker import SerialWorker
from archiver import SessionArchiver
from trigger_manager import TriggerManager
from log_panel_widget import LogPanelWidget
from archive_dialog import ArchiveManagerDialog


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ESP32 Serial Capture & Monitor Pro - Çoklu Panel & Eşzamanlı Analiz")
        self.resize(1300, 800)

        # Temel Modüller
        self.config = ConfigManager()
        archive_dir = self.config.get("archive_dir")
        self.archiver = SessionArchiver(archive_dir)
        self.trigger_mgr = TriggerManager(archive_dir)
        self.serial_worker = SerialWorker()

        # Durum Değişkenleri
        self.is_connected = False
        self.command_history = self.config.get("command_history", [])
        self.history_index = len(self.command_history)
        self.panels: List[LogPanelWidget] = []
        self.active_panel: Optional[LogPanelWidget] = None
        self.ref_counter = 0

        self._setup_theme()
        self._init_ui()
        self._init_connections()

        # Ayarları Yükle ve Portları Keşfet
        self._apply_initial_config()
        self.refresh_ports()

    def _setup_theme(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #181825;
                color: #CDD6F4;
            }
            QLabel {
                color: #CDD6F4;
                font-weight: 500;
            }
            QComboBox, QLineEdit {
                background-color: #313244;
                color: #CDD6F4;
                border: 1px solid #45475A;
                border-radius: 4px;
                padding: 4px 8px;
                min-height: 24px;
            }
            QComboBox::drop-down {
                border: 0px;
            }
            QComboBox QAbstractItemView {
                background-color: #1E1E2E;
                color: #CDD6F4;
                selection-background-color: #45475A;
            }
            QPushButton {
                background-color: #313244;
                color: #CDD6F4;
                border: 1px solid #45475A;
                border-radius: 4px;
                padding: 4px 10px;
                font-weight: bold;
                min-height: 24px;
            }
            QPushButton:hover {
                background-color: #45475A;
                color: #89B4FA;
            }
            QPushButton:pressed {
                background-color: #585B70;
            }
            QPushButton#btnConnect {
                background-color: #2E7D32;
                color: #FFFFFF;
                border: 1px solid #388E3C;
            }
            QPushButton#btnConnect:hover {
                background-color: #388E3C;
            }
            QPushButton#btnDisconnect {
                background-color: #C62828;
                color: #FFFFFF;
                border: 1px solid #D32F2F;
            }
            QPushButton#btnDisconnect:hover {
                background-color: #D32F2F;
            }
            QCheckBox {
                color: #CDD6F4;
                spacing: 5px;
            }
            QStatusBar {
                background-color: #11111B;
                color: #A6ADC8;
                border-top: 1px solid #313244;
            }
            QSplitter::handle {
                background-color: #313244;
                width: 4px;
            }
            QSplitter::handle:hover {
                background-color: #89B4FA;
            }
        """)

    def _init_ui(self):
        self._init_menu_bar()

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(6, 6, 6, 4)
        main_layout.setSpacing(6)

        # 1. Üst Kontrol Paneli (Port, Baud, Bağlantı, ESP Araçları)
        top_bar = self._create_top_control_panel()
        main_layout.addLayout(top_bar)

        # 2. İkinci Araç Çubuğu (Arama, Eşzamanlı Satır Filtreleme, Tetikleyici)
        search_filter_bar = self._create_search_and_filter_panel()
        main_layout.addLayout(search_filter_bar)

        # 3. Orta Bölüm: 3 Taneye Kadar Yan Yana Log Alanı (QSplitter)
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        self.splitter.setChildrenCollapsible(False)
        main_layout.addWidget(self.splitter, 1)

        # 4. Alt Komut Gönderme Çubuğu
        cmd_bar = self._create_command_input_panel()
        main_layout.addLayout(cmd_bar)

        # 5. Durum Çubuğu
        self._init_status_bar()

        # Varsayılan olarak 1 aktif canlı log paneli oluştur
        self._init_panels()

    def _init_menu_bar(self):
        menu = self.menuBar()
        menu.setStyleSheet("background-color: #1E1E2E; color: #CDD6F4;")

        file_menu = menu.addMenu("📁 Dosya")
        act_add_ref = QAction("➕ Yeni Referans Paneli Aç", self)
        act_add_ref.setShortcut(QKeySequence("Ctrl+N"))
        act_add_ref.triggered.connect(self.add_reference_panel)
        file_menu.addAction(act_add_ref)

        act_make_ref = QAction("📌 Aktif Logu Referans Yap", self)
        act_make_ref.setShortcut(QKeySequence("Ctrl+R"))
        act_make_ref.triggered.connect(lambda: self.on_make_reference_requested(self.active_panel))
        file_menu.addAction(act_make_ref)

        file_menu.addSeparator()

        act_open_archives = QAction("📦 Oturum Arşivlerini Yönet...", self)
        act_open_archives.setShortcut(QKeySequence("Ctrl+H"))
        act_open_archives.triggered.connect(self.open_archive_manager)
        file_menu.addAction(act_open_archives)

        file_menu.addSeparator()
        act_exit = QAction("Çıkış", self)
        act_exit.setShortcut(QKeySequence("Ctrl+Q"))
        act_exit.triggered.connect(self.close)
        file_menu.addAction(act_exit)

        # Görünüm Menüsü
        view_menu = menu.addMenu("👁️ Görünüm")
        act_clear_all = QAction("🧹 Tüm Panelleri Temizle", self)
        act_clear_all.setShortcut(QKeySequence("Ctrl+Shift+L"))
        act_clear_all.triggered.connect(self.clear_all_panels)
        view_menu.addAction(act_clear_all)

        # ESP Araçları Menüsü
        esp_menu = menu.addMenu("⚡ ESP32 Araçları")
        act_reset = QAction("🔄 ESP32 Donanım Reset (EN Pin)", self)
        act_reset.setShortcut(QKeySequence("F5"))
        act_reset.triggered.connect(self.reset_esp32)
        esp_menu.addAction(act_reset)

        act_boot = QAction("🚀 Bootloader Moduna Al (IO0+EN)", self)
        act_boot.setShortcut(QKeySequence("F6"))
        act_boot.triggered.connect(self.enter_bootloader)
        esp_menu.addAction(act_boot)

    def _create_top_control_panel(self) -> QHBoxLayout:
        layout = QHBoxLayout()
        layout.setSpacing(6)

        layout.addWidget(QLabel("Filtre:"))
        self.combo_filter = QComboBox()
        self.combo_filter.addItem("⚡ ESP Cihazları", "esp")
        self.combo_filter.addItem("🔌 Arduino Cihazları", "arduino")
        self.combo_filter.addItem("🖲️ Tüm USB Portlar", "usb")
        self.combo_filter.addItem("🌐 Tüm Portlar", "all")
        self.combo_filter.currentIndexChanged.connect(self.refresh_ports)
        layout.addWidget(self.combo_filter)

        layout.addWidget(QLabel("Port:"))
        self.combo_port = QComboBox()
        self.combo_port.setMinimumWidth(240)
        layout.addWidget(self.combo_port)

        btn_refresh = QPushButton("🔄")
        btn_refresh.setToolTip("Portları Yenile")
        btn_refresh.clicked.connect(self.refresh_ports)
        layout.addWidget(btn_refresh)

        layout.addWidget(QLabel("Baud:"))
        self.combo_baud = QComboBox()
        self.combo_baud.setEditable(True)
        bauds = ["115200", "921600", "748800", "460800", "230400", "57600", "19200", "9600"]
        self.combo_baud.addItems(bauds)
        self.combo_baud.setCurrentText("115200")
        layout.addWidget(self.combo_baud)

        self.btn_connect = QPushButton("⚡ Bağlan")
        self.btn_connect.setObjectName("btnConnect")
        self.btn_connect.clicked.connect(self.toggle_connection)
        layout.addWidget(self.btn_connect)

        self.chk_auto_reconnect = QCheckBox("Oto-Bağlan")
        self.chk_auto_reconnect.setChecked(True)
        layout.addWidget(self.chk_auto_reconnect)

        layout.addSpacing(6)

        self.btn_reset_esp = QPushButton("🔄 Reset (EN)")
        self.btn_reset_esp.setToolTip("ESP32 Hardware Reset (F5)")
        self.btn_reset_esp.clicked.connect(self.reset_esp32)
        layout.addWidget(self.btn_reset_esp)

        self.btn_boot_esp = QPushButton("🚀 Boot (IO0)")
        self.btn_boot_esp.setToolTip("ESP32 Bootloader Modu (F6)")
        self.btn_boot_esp.clicked.connect(self.enter_bootloader)
        layout.addWidget(self.btn_boot_esp)

        layout.addStretch()

        # Panel Ekleme Düğmesi
        self.btn_add_panel = QPushButton("➕ Referans Paneli Ekle")
        self.btn_add_panel.setStyleSheet("background-color: #0284C7; color: white;")
        self.btn_add_panel.setToolTip("Yan yana karşılaştırma için 3 adede kadar referans paneli ekleyin")
        self.btn_add_panel.clicked.connect(self.add_reference_panel)
        layout.addWidget(self.btn_add_panel)

        self.chk_timestamp = QCheckBox("⏰ Zaman Damgası")
        self.chk_timestamp.toggled.connect(self._on_timestamp_toggled)
        layout.addWidget(self.chk_timestamp)

        self.chk_autoscroll = QCheckBox("⬇️ Oto-Kaydır")
        self.chk_autoscroll.setChecked(True)
        layout.addWidget(self.chk_autoscroll)

        return layout

    def _create_search_and_filter_panel(self) -> QHBoxLayout:
        layout = QHBoxLayout()
        layout.setSpacing(6)

        # Eşzamanlı Filtreleme ve Arama
        layout.addWidget(QLabel("🔍 Canlı Filtre / Ara:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Kelime veya kalıp yazın (Tüm panellerde anlık süzme)...")
        self.search_input.textChanged.connect(self.on_filter_changed)
        layout.addWidget(self.search_input, 2)

        # YALNIZCA EŞLEŞEN SATIRLARI GÖSTER (Eşzamanlı Süzme)
        self.chk_only_matching = QCheckBox("🎯 Sadece Eşleşen Satırları Göster (Eşzamanlı Süz)")
        self.chk_only_matching.setStyleSheet("font-weight: bold; color: #A6E3A1;")
        self.chk_only_matching.setToolTip("Aktif edildiğinde açık olan TÜM panellerde sadece aranan kelimeyi içeren satırlar gösterilir!")
        self.chk_only_matching.toggled.connect(self.on_filter_changed)
        layout.addWidget(self.chk_only_matching)

        self.chk_search_regex = QCheckBox("Regex")
        self.chk_search_regex.toggled.connect(self.on_filter_changed)
        layout.addWidget(self.chk_search_regex)

        self.chk_search_case = QCheckBox("Aa")
        self.chk_search_case.setToolTip("Büyük/Küçük Harfe Duyarlı")
        self.chk_search_case.toggled.connect(self.on_filter_changed)
        layout.addWidget(self.chk_search_case)

        btn_copy_all = QPushButton("📋 Tüm Eşleşenleri Kopyala")
        btn_copy_all.setToolTip("Açık olan panellerdeki tüm eşleşen satırları birleştirip panoya kopyalar")
        btn_copy_all.clicked.connect(self.copy_all_matching_lines)
        layout.addWidget(btn_copy_all)

        layout.addSpacing(10)

        # Tetikleyici Alanı
        layout.addWidget(QLabel("🎯 Tetikleyici:"))
        self.trigger_input = QLineEdit()
        self.trigger_input.setPlaceholderText("Örn: 'rst:', 'Guru', 'BOOT'...")
        self.trigger_input.editingFinished.connect(self.update_trigger_settings)
        layout.addWidget(self.trigger_input, 1)

        self.chk_trigger_record = QCheckBox("Oto-Kayıt")
        self.chk_trigger_record.setToolTip("Tetikleyici yakalandığında ayrı log dosyasına kayıt başlatır")
        self.chk_trigger_record.toggled.connect(self.update_trigger_settings)
        layout.addWidget(self.chk_trigger_record)

        self.chk_trigger_active = QCheckBox("Aktif")
        self.chk_trigger_active.toggled.connect(self.update_trigger_settings)
        layout.addWidget(self.chk_trigger_active)

        return layout

    def _create_command_input_panel(self) -> QHBoxLayout:
        layout = QHBoxLayout()
        layout.setSpacing(6)

        layout.addWidget(QLabel("Komut:"))
        self.cmd_input = QLineEdit()
        self.cmd_input.setPlaceholderText("ESP32'ye gönderilecek komut (Yukarı/Aşağı ok ile geçmiş)...")
        self.cmd_input.returnPressed.connect(self.send_command)
        self.cmd_input.installEventFilter(self)
        layout.addWidget(self.cmd_input, 1)

        self.combo_eol = QComboBox()
        self.combo_eol.addItem("CR + LF (\\r\\n)", "\r\n")
        self.combo_eol.addItem("LF (\\n)", "\n")
        self.combo_eol.addItem("CR (\\r)", "\r")
        self.combo_eol.addItem("Yok (None)", "")
        layout.addWidget(self.combo_eol)

        btn_send = QPushButton("📤 Gönder")
        btn_send.clicked.connect(self.send_command)
        layout.addWidget(btn_send)

        for cmd in ["help", "status", "version", "reboot"]:
            btn = QPushButton(cmd)
            btn.clicked.connect(lambda checked, c=cmd: self.send_quick_command(c))
            layout.addWidget(btn)

        return layout

    def _init_status_bar(self):
        self.status = QStatusBar()
        self.setStatusBar(self.status)

        self.lbl_status_panels = QLabel("🖥️ Panel: 1 / 3")
        self.lbl_status_conn = QLabel("⚪ Bağlı Değil")
        self.lbl_status_conn.setStyleSheet("padding: 0 10px; font-weight: bold;")
        self.lbl_status_rx = QLabel("Rx: 0 B | Tx: 0 B")
        self.lbl_status_lines = QLabel("Satır: 0")
        self.lbl_status_archive = QLabel("📁 Arşiv: Kapalı")
        self.lbl_status_trigger = QLabel("🎯 Tetikleme: 0")

        self.status.addPermanentWidget(self.lbl_status_panels)
        self.status.addPermanentWidget(self.lbl_status_conn)
        self.status.addPermanentWidget(self.lbl_status_lines)
        self.status.addPermanentWidget(self.lbl_status_rx)
        self.status.addPermanentWidget(self.lbl_status_archive)
        self.status.addPermanentWidget(self.lbl_status_trigger)

    def _init_connections(self):
        self.serial_worker.line_received.connect(self.on_serial_line_received)
        self.serial_worker.connected.connect(self.on_serial_connected)
        self.serial_worker.disconnected.connect(self.on_serial_disconnected)
        self.serial_worker.reconnecting.connect(self.on_serial_reconnecting)
        self.serial_worker.error.connect(self.on_serial_error)
        self.serial_worker.stats_updated.connect(self.on_stats_updated)

        self.trigger_mgr.trigger_hit.connect(self.on_trigger_hit)
        self.trigger_mgr.recording_started.connect(lambda f: self.show_status_message(f"🔥 Tetikleyici ile kayıt başladı: {f}"))
        self.trigger_mgr.recording_stopped.connect(lambda f, n: self.show_status_message(f"✓ Tetikleyici kaydı bitti: {f} ({n} satır)"))

    def show_status_message(self, msg: str):
        self.status.showMessage(msg, 4000)

    # --- Çoklu Panel Yönetimi (En fazla 3 panel) ---

    def _init_panels(self):
        # Canlı aktif paneli oluştur
        self.active_panel = LogPanelWidget(panel_id="active", title="🟢 Canlı Aktif Log", is_active=True, parent=self)
        self._register_panel(self.active_panel)
        self.splitter.addWidget(self.active_panel)
        self._update_panel_controls()

    def _register_panel(self, panel: LogPanelWidget):
        self.panels.append(panel)
        panel.make_reference_requested.connect(self.on_make_reference_requested)
        panel.close_requested.connect(self.on_close_panel_requested)
        panel.word_clicked_global.connect(self.on_word_clicked_global)
        panel.status_message.connect(self.show_status_message)

    def add_reference_panel(self) -> Optional[LogPanelWidget]:
        if len(self.panels) >= 3:
            QMessageBox.information(self, "Bilgi", "En fazla 3 adet yan yana log paneli açılabilir.")
            return None

        self.ref_counter += 1
        ref_title = f"📌 Referans Log {self.ref_counter}"
        ref_panel = LogPanelWidget(panel_id=f"ref_{self.ref_counter}", title=ref_title, is_active=False, parent=self)

        # Yeni paneli en sola veya aktif panelin soluna ekle
        idx = max(0, len(self.panels) - 1)
        self.panels.insert(idx, ref_panel)
        self.splitter.insertWidget(idx, ref_panel)

        ref_panel.make_reference_requested.connect(self.on_make_reference_requested)
        ref_panel.close_requested.connect(self.on_close_panel_requested)
        ref_panel.word_clicked_global.connect(self.on_word_clicked_global)
        ref_panel.status_message.connect(self.show_status_message)

        # Panelleri eşit genişlikte dağıt
        self._balance_splitter_sizes()
        self._update_panel_controls()
        self.show_status_message(f"✓ {ref_title} paneli eklendi.")
        return ref_panel

    def on_make_reference_requested(self, source_panel: LogPanelWidget):
        """
        'Bunu Referans Yap' tıklandığında:
        Mevcut canlı logu sola yeni/boş referans paneline aktarır ve aktif logu temizleyip yeni teste hazır eder.
        """
        raw_text = source_panel.viewer.get_full_raw_text()
        if not raw_text.strip():
            QMessageBox.information(self, "Bilgi", "Aktarılacak log verisi bulunmuyor.")
            return

        ts = datetime.datetime.now().strftime("%H:%M:%S")

        # Eğer zaten 3 panel varsa ve referans paneli boşaltılamıyorsa en eski referansa yazar
        if len(self.panels) < 3:
            ref_panel = self.add_reference_panel()
            if ref_panel:
                ref_panel.load_content(raw_text, source_title=f"📌 Referans ({ts})")
        else:
            # 3 panel doluysa ilk referans paneline aktar
            ref_panel = self.panels[0]
            ref_panel.load_content(raw_text, source_title=f"📌 Referans ({ts})")

        # Kullanıcıya aktif logu temizleyip yeni teste başlamak isteyip istemediğini sor
        ret = QMessageBox.question(
            self,
            "Aktif Log Temizlensin mi?",
            "Mevcut log sola referans paneline alındı.\nSağdaki aktif pencere temizlenip yeni oturuma başlansın mı?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if ret == QMessageBox.StandardButton.Yes:
            self.active_panel.clear_panel()

        self.show_status_message("✓ Log başarıyla referans paneline aktarıldı.")

    def on_close_panel_requested(self, panel: LogPanelWidget):
        if panel in self.panels and not panel.is_active:
            self.panels.remove(panel)
            panel.setParent(None)
            panel.deleteLater()
            self._balance_splitter_sizes()
            self._update_panel_controls()
            self.show_status_message(f"'{panel._title}' kapatıldı.")

    def _balance_splitter_sizes(self):
        count = len(self.panels)
        if count > 0:
            total_width = self.splitter.width() or 1200
            each_size = total_width // count
            self.splitter.setSizes([each_size] * count)

    def _update_panel_controls(self):
        count = len(self.panels)
        self.lbl_status_panels.setText(f"🖥️ Panel: {count} / 3")
        self.btn_add_panel.setEnabled(count < 3)

    def clear_all_panels(self):
        for p in self.panels:
            p.clear_panel()
        self.show_status_message("Tüm paneller temizlendi.")

    # --- Eşzamanlı Satır Filtreleme & Arama ---

    def on_filter_changed(self):
        query = self.search_input.text()
        only_matching = self.chk_only_matching.isChecked()
        is_regex = self.chk_search_regex.isChecked()
        case_sens = self.chk_search_case.isChecked()

        for p in self.panels:
            p.set_filter(query, is_regex, case_sens, only_matching)

    def on_word_clicked_global(self, source_panel, word: str):
        """Herhangi bir panelde bir kelimeye tıklandığında diğer panellerde o kelimeyi vurgula."""
        if getattr(self, '_syncing_word', False):
            return
        self._syncing_word = True
        try:
            for p in self.panels:
                if p != source_panel:
                    p.viewer.apply_external_word_highlight(word)
        finally:
            self._syncing_word = False

    def copy_all_matching_lines(self):
        query = self.search_input.text()
        if not query:
            QMessageBox.information(self, "Bilgi", "Lütfen önce filtrelenecek kelimeyi girin.")
            return

        is_regex = self.chk_search_regex.isChecked()
        case_sens = self.chk_search_case.isChecked()

        combined_lines = []
        for p in self.panels:
            res = p.viewer.copyMatchingLines(query, is_regex, case_sens)
            if res:
                combined_lines.append(f"=== {p._title} Eşleşmeleri ===\n" + res)

        if combined_lines:
            final_text = "\n\n".join(combined_lines)
            QApplication.clipboard().setText(final_text)
            self.show_status_message("📋 Tüm panellerdeki eşleşen satırlar birleştirilip panoya kopyalandı!")
        else:
            self.show_status_message("Hiçbir panelde eşleşen satır bulunamadı.")

    # --- Port Yönetimi ve Hatırlama ---

    def refresh_ports(self):
        filter_mode = self.combo_filter.currentData() or "all"
        self.config.set("device_filter", filter_mode)

        devices = PortScanner.scan_ports(filter_mode)
        current_selection = self.combo_port.currentData() or self.config.get("last_port", "")

        self.combo_port.clear()
        target_index = -1

        for idx, dev in enumerate(devices):
            self.combo_port.addItem(dev.display_name, dev.device)
            if dev.device == current_selection:
                target_index = idx

        if self.combo_port.count() == 0:
            self.combo_port.addItem("⚠️ Port bulunamadı", "")
        elif target_index >= 0:
            self.combo_port.setCurrentIndex(target_index)
        else:
            self.combo_port.setCurrentIndex(0)

    def _apply_initial_config(self):
        saved_baud = str(self.config.get("last_baudrate", 115200))
        self.combo_baud.setCurrentText(saved_baud)

        saved_filter = self.config.get("device_filter", "esp")
        idx = self.combo_filter.findData(saved_filter)
        if idx >= 0:
            self.combo_filter.setCurrentIndex(idx)

        self.chk_auto_reconnect.setChecked(self.config.get("auto_reconnect", True))
        self.chk_timestamp.setChecked(self.config.get("timestamp_enabled", False))
        self.chk_autoscroll.setChecked(self.config.get("auto_scroll", True))

        self.trigger_input.setText(self.config.get("trigger_word", ""))
        self.chk_trigger_record.setChecked(self.config.get("trigger_record_enabled", False))
        self.chk_trigger_active.setChecked(bool(self.config.get("trigger_word", "")))
        self.update_trigger_settings()

    # --- Bağlantı Yönetimi ---

    def toggle_connection(self):
        if self.is_connected:
            self.disconnect_serial()
        else:
            self.connect_serial()

    def connect_serial(self):
        port = self.combo_port.currentData()
        if not port:
            QMessageBox.warning(self, "Uyarı", "Lütfen geçerli bir seri port seçin.")
            return

        try:
            baudrate = int(self.combo_baud.currentText())
        except ValueError:
            QMessageBox.warning(self, "Hata", "Geçersiz Baud Rate.")
            return

        auto_reconn = self.chk_auto_reconnect.isChecked()

        self.config.set("last_port", port)
        self.config.set("last_baudrate", baudrate)
        self.config.set("auto_reconnect", auto_reconn)

        archive_path = self.archiver.start_session(port)
        self.lbl_status_archive.setText(f"📁 {archive_path.name}")
        self.lbl_status_archive.setToolTip(str(archive_path))

        self.btn_connect.setText("⏳ Bağlanıyor...")
        self.serial_worker.start_connection(port, baudrate, auto_reconn)

    def disconnect_serial(self):
        self.serial_worker.stop_connection()
        self.archiver.stop_session()
        self.trigger_mgr.stop_trigger_recording()

    @pyqtSlot(str, int)
    def on_serial_connected(self, port: str, baudrate: int):
        self.is_connected = True
        self.btn_connect.setText("⏹️ Bağlantıyı Kes")
        self.btn_connect.setObjectName("btnDisconnect")
        self.btn_connect.setStyle(self.btn_connect.style())

        self.lbl_status_conn.setText(f"🟢 Bağlı: {port} @ {baudrate}")
        self.lbl_status_conn.setStyleSheet("color: #A6E3A1; font-weight: bold; padding: 0 10px;")
        self.show_status_message(f"✓ {port} portuna {baudrate} baud ile başarıyla bağlanıldı.")

    @pyqtSlot(str)
    def on_serial_disconnected(self, reason: str):
        if not self.is_connected and self.btn_connect.text() == "⚡ Bağlan":
            return
        self.is_connected = False
        self.btn_connect.setText("⚡ Bağlan")
        self.btn_connect.setObjectName("btnConnect")
        self.btn_connect.setStyle(self.btn_connect.style())

        self.lbl_status_conn.setText("⚪ Bağlı Değil")
        self.lbl_status_conn.setStyleSheet("color: #CDD6F4; padding: 0 10px;")
        self.lbl_status_archive.setText("📁 Arşiv: Kapalı")
        self.show_status_message(f"Bağlantı kesildi: {reason}")

    @pyqtSlot(str, int)
    def on_serial_reconnecting(self, port: str, attempt: int):
        self.lbl_status_conn.setText(f"🟡 Yeniden Bağlanıyor ({attempt})... {port}")
        self.lbl_status_conn.setStyleSheet("color: #F9E2AF; font-weight: bold; padding: 0 10px;")

    @pyqtSlot(str)
    def on_serial_error(self, err_msg: str):
        self.show_status_message(f"Hata: {err_msg}")

    @pyqtSlot(int, int)
    def on_stats_updated(self, rx: int, tx: int):
        rx_str = f"{rx/1024:.1f} KB" if rx > 1024 else f"{rx} B"
        tx_str = f"{tx/1024:.1f} KB" if tx > 1024 else f"{tx} B"
        self.lbl_status_rx.setText(f"Rx: {rx_str} | Tx: {tx_str}")
        if self.active_panel:
            self.lbl_status_lines.setText(f"Satır: {self.active_panel.viewer.blockCount()}")

    # --- Veri Alma, Tetikleyici ve Log Akışı ---

    @pyqtSlot(str)
    def on_serial_line_received(self, line: str):
        self.trigger_mgr.check_line(line)

        display_line = line
        if self.chk_timestamp.isChecked():
            ts = datetime.datetime.now().strftime("[%H:%M:%S.%f]")[:-3] + " "
            display_line = ts + line

        self.archiver.write(display_line + "\n")

        # Yalnızca aktif canlı panele satır ekle
        if self.active_panel:
            self.active_panel.append_log_line(display_line, auto_scroll=self.chk_autoscroll.isChecked())

    @pyqtSlot(str, str, int)
    def on_trigger_hit(self, line: str, trigger_word: str, hit_count: int):
        self.lbl_status_trigger.setText(f"🎯 Tetikleme: {hit_count}")
        self.lbl_status_trigger.setStyleSheet("color: #F38BA8; font-weight: bold;")
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        divider = f"🔥 >>> TETİKLEME YAKALANDI (#{hit_count}): '{trigger_word}' - {ts} <<< 🔥"
        if self.active_panel:
            self.active_panel.append_log_line(divider, auto_scroll=self.chk_autoscroll.isChecked())

    # --- ESP32 Donanım Kontrolleri & Komutlar ---

    def reset_esp32(self):
        if not self.is_connected:
            self.show_status_message("Cihaz bağlı değilken reset atılamaz.")
            return
        self.serial_worker.reset_esp32()
        self.show_status_message("🔄 ESP32 Hardware Reset (EN) tetiklendi.")

    def enter_bootloader(self):
        if not self.is_connected:
            self.show_status_message("Cihaz bağlı değil.")
            return
        self.serial_worker.enter_bootloader()
        self.show_status_message("🚀 ESP32 Bootloader (İndirme) moduna alındı.")

    def send_command(self):
        text = self.cmd_input.text()
        if not text:
            return

        eol = self.combo_eol.currentData()
        payload = (text + eol).encode("utf-8")
        self.serial_worker.send_data(payload)

        if not self.command_history or self.command_history[-1] != text:
            self.command_history.append(text)
            self.config.set("command_history", self.command_history[-50:])
        self.history_index = len(self.command_history)

        self.cmd_input.clear()

    def send_quick_command(self, cmd: str):
        eol = self.combo_eol.currentData()
        payload = (cmd + eol).encode("utf-8")
        self.serial_worker.send_data(payload)
        self.show_status_message(f"Hızlı komut gönderildi: {cmd}")

    def eventFilter(self, obj, event):
        if obj == self.cmd_input and event.type() == event.Type.KeyPress:
            key = event.key()
            if key == Qt.Key.Key_Up:
                if self.command_history and self.history_index > 0:
                    self.history_index -= 1
                    self.cmd_input.setText(self.command_history[self.history_index])
                return True
            elif key == Qt.Key.Key_Down:
                if self.command_history and self.history_index < len(self.command_history) - 1:
                    self.history_index += 1
                    self.cmd_input.setText(self.command_history[self.history_index])
                else:
                    self.history_index = len(self.command_history)
                    self.cmd_input.clear()
                return True
        return super().eventFilter(obj, event)

    def update_trigger_settings(self):
        trigger_text = self.trigger_input.text()
        auto_record = self.chk_trigger_record.isChecked()
        active = self.chk_trigger_active.isChecked() and bool(trigger_text)

        self.trigger_mgr.configure(trigger_text, False, auto_record, active)
        self.config.set("trigger_word", trigger_text)
        self.config.set("trigger_record_enabled", auto_record)

    def open_archive_manager(self):
        dlg = ArchiveManagerDialog(self.archiver, self)
        dlg.open_as_reference_requested.connect(self.load_archive_into_reference)
        dlg.exec()

    def load_archive_into_reference(self, filepath: str, content: str):
        filename = Path(filepath).name
        ref_panel = None
        if len(self.panels) < 3:
            ref_panel = self.add_reference_panel()
        else:
            ref_panel = self.panels[0]

        if ref_panel:
            ref_panel.load_content(content, source_title=f"📌 {filename}")
            self.show_status_message(f"✓ '{filename}' referans paneline başarıyla yüklendi.")

    def _on_timestamp_toggled(self, checked: bool):
        self.config.set("timestamp_enabled", checked)

    def closeEvent(self, event):
        self.serial_worker.shutdown()
        self.archiver.stop_session()
        self.trigger_mgr.stop_trigger_recording()
        super().closeEvent(event)
