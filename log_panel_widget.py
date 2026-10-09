import datetime
from pathlib import Path
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QFileDialog, QMessageBox
)
from PyQt6.QtGui import QColor, QFont
from PyQt6.QtCore import Qt, pyqtSignal

from log_viewer import Esp32LogViewer
from archiver import SessionArchiver


class LogPanelWidget(QWidget):
    # Signals
    make_reference_requested = pyqtSignal(object)
    close_requested = pyqtSignal(object)
    word_clicked_global = pyqtSignal(object, str)
    status_message = pyqtSignal(str)

    def __init__(self, panel_id: str, title: str, is_active: bool = False, parent=None):
        super().__init__(parent)
        self.panel_id = panel_id
        self.is_active = is_active
        self._title = title

        self._init_ui()
        self._init_connections()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(4)

        # 1. Başlık ve Kontrol Çubuğu (Header)
        self.header_frame = QFrame()
        self.header_frame.setStyleSheet("""
            QFrame {
                background-color: #232534;
                border: 1px solid #313244;
                border-radius: 5px;
                padding: 2px 6px;
            }
            QLabel {
                font-weight: bold;
            }
        """)
        header_layout = QHBoxLayout(self.header_frame)
        header_layout.setContentsMargins(4, 2, 4, 2)
        header_layout.setSpacing(6)

        # Başlık Etiketi
        self.lbl_title = QLabel(self._title)
        if self.is_active:
            self.lbl_title.setStyleSheet("color: #A6E3A1; font-weight: bold;")
        else:
            self.lbl_title.setStyleSheet("color: #89B4FA; font-weight: bold;")
        header_layout.addWidget(self.lbl_title)

        # Satır ve Filtre Sayacı Rozeti
        self.lbl_badge = QLabel("[ 0 Satır ]")
        self.lbl_badge.setStyleSheet("color: #F9E2AF; font-size: 11px; font-weight: normal;")
        header_layout.addWidget(self.lbl_badge)

        header_layout.addStretch()

        # Butonlar
        if self.is_active:
            # Aktif Log Butonları
            self.btn_ref = QPushButton("📌 Referans Yap")
            self.btn_ref.setToolTip("Bu logu sola referans paneline aktarır ve sağda yeni canlı oturum açar")
            self.btn_ref.setStyleSheet("background-color: #3B82F6; color: white;")
            self.btn_ref.clicked.connect(lambda: self.make_reference_requested.emit(self))
            header_layout.addWidget(self.btn_ref)
        else:
            # Referans Panel Butonları
            self.btn_load = QPushButton("📂 Log Yükle")
            self.btn_load.setToolTip("Eski arşivden veya dosyadan log yükle")
            self.btn_load.clicked.connect(self.load_log_file)
            header_layout.addWidget(self.btn_load)

        self.btn_export = QPushButton("💾")
        self.btn_export.setToolTip("Bu paneldeki logu kaydet")
        self.btn_export.clicked.connect(self.export_log)
        header_layout.addWidget(self.btn_export)

        self.btn_clear = QPushButton("🧹")
        self.btn_clear.setToolTip("Bu paneli temizle")
        self.btn_clear.clicked.connect(self.clear_panel)
        header_layout.addWidget(self.btn_clear)

        if not self.is_active:
            self.btn_close = QPushButton("✕")
            self.btn_close.setToolTip("Bu referans panelini kapat")
            self.btn_close.setStyleSheet("background-color: #EF4444; color: white; padding: 2px 6px;")
            self.btn_close.clicked.connect(lambda: self.close_requested.emit(self))
            header_layout.addWidget(self.btn_close)

        layout.addWidget(self.header_frame)

        # 2. Log Viewer Bileşeni
        self.viewer = Esp32LogViewer(self)

        # 3. Aralık Seçim Bandı (Nokta A - Nokta B seçildiğinde görünür)
        self.range_banner = self._create_range_banner()
        layout.addWidget(self.range_banner)
        self.range_banner.hide()

        layout.addWidget(self.viewer, 1)

    def _create_range_banner(self) -> QFrame:
        banner = QFrame()
        banner.setStyleSheet("""
            QFrame {
                background-color: #1E293B;
                border: 1px solid #38BDF8;
                border-radius: 4px;
                padding: 2px 6px;
            }
            QLabel {
                color: #38BDF8;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton {
                font-size: 11px;
                padding: 2px 6px;
            }
        """)
        layout = QHBoxLayout(banner)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(6)

        self.lbl_range_info = QLabel("📍 Nokta A: 0  ➔  Nokta B: 0")
        layout.addWidget(self.lbl_range_info)

        layout.addStretch()

        btn_copy = QPushButton("📋 Kopyala")
        btn_copy.setStyleSheet("background-color: #0284C7; color: white;")
        btn_copy.clicked.connect(self.viewer.copySelectedRange)
        layout.addWidget(btn_copy)

        btn_save = QPushButton("💾 Kaydet")
        btn_save.clicked.connect(self.export_selected_range)
        layout.addWidget(btn_save)

        btn_clear = QPushButton("✕")
        btn_clear.setToolTip("Seçimi Kaldır")
        btn_clear.clicked.connect(self.viewer.clearPoints)
        layout.addWidget(btn_clear)

        return banner

    def _init_connections(self):
        self.viewer.range_selected.connect(self.on_range_selected)
        self.viewer.range_cleared.connect(self.range_banner.hide)
        self.viewer.word_clicked.connect(lambda w, o, l: self.word_clicked_global.emit(self, w))
        self.viewer.status_message.connect(self.status_message.emit)
        self.viewer.filter_stats_updated.connect(self.on_filter_stats_updated)

    def on_range_selected(self, start: int, end: int, text: str):
        total = end - start + 1
        self.lbl_range_info.setText(f"📍 Nokta A ({start}) ➔ B ({end}) [{total} satır]")
        self.range_banner.show()

    def on_filter_stats_updated(self, matched: int, total: int):
        if matched == total:
            self.lbl_badge.setText(f"[ {total} Satır ]")
            self.lbl_badge.setStyleSheet("color: #F9E2AF; font-size: 11px;")
        else:
            self.lbl_badge.setText(f"[ Süzüldü: {matched} / {total} Satır ]")
            self.lbl_badge.setStyleSheet("color: #A6E3A1; font-weight: bold; font-size: 11px;")

    def set_title(self, title: str):
        self._title = title
        self.lbl_title.setText(title)

    def append_log_line(self, line: str, auto_scroll: bool = True):
        self.viewer.appendLogLine(line, auto_scroll)
        # Sayaç otomatik güncellenir

    def load_content(self, text: str, source_title: str = ""):
        self.viewer.load_text(text)
        if source_title:
            self.set_title(source_title)

    def set_filter(self, query: str, is_regex: bool = False, case_sensitive: bool = False, only_matching: bool = False):
        self.viewer.set_filter_mode(query, is_regex, case_sensitive, only_matching)

    def clear_panel(self):
        self.viewer.clear_all()
        self.range_banner.hide()
        self.status_message.emit(f"'{self._title}' paneli temizlendi.")

    def export_log(self):
        dest_file, _ = QFileDialog.getSaveFileName(
            self,
            f"Log Kaydet ({self._title})",
            f"esp32_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            "Log Dosyaları (*.log);;Metin Dosyaları (*.txt);;Tüm Dosyalar (*.*)"
        )
        if dest_file:
            content = self.viewer.get_full_raw_text()
            if SessionArchiver.export_content(content, dest_file):
                self.status_message.emit(f"✓ '{self._title}' başarıyla kaydedildi: {Path(dest_file).name}")
            else:
                QMessageBox.critical(self, "Hata", "Log dosyası kaydedilemedi.")

    def export_selected_range(self):
        if self.viewer.point_a is None or self.viewer.point_b is None:
            return
        start = min(self.viewer.point_a, self.viewer.point_b)
        end = max(self.viewer.point_a, self.viewer.point_b)
        dest_file, _ = QFileDialog.getSaveFileName(
            self,
            f"Aralığı Kaydet (Satır {start}-{end})",
            f"range_{start}_{end}.log",
            "Log Dosyaları (*.log);;Metin Dosyaları (*.*)"
        )
        if dest_file:
            content = self.viewer.getTextBetweenLines(start, end)
            if SessionArchiver.export_content(content, dest_file):
                self.status_message.emit(f"✓ Satır {start}-{end} aralığı kaydedildi.")

    def load_log_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Log Dosyası Yükle",
            str(Path(__file__).parent / "archives"),
            "Log Dosyaları (*.log *.txt);;Tüm Dosyalar (*.*)"
        )
        if file_path:
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                filename = Path(file_path).name
                self.load_content(content, source_title=f"📌 {filename}")
                self.status_message.emit(f"✓ '{filename}' başarıyla yüklendi ({len(self.viewer.raw_lines)} satır).")
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Dosya açılamadı: {e}")
