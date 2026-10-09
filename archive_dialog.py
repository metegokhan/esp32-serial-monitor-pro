import os
import shutil
import subprocess
from pathlib import Path
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QHeaderView, QMessageBox, QFileDialog,
    QTextEdit, QSplitter
)
from PyQt6.QtGui import QColor, QFont
from PyQt6.QtCore import Qt, QUrl, pyqtSignal
from PyQt6.QtGui import QDesktopServices

from archiver import SessionArchiver

class ArchiveManagerDialog(QDialog):
    open_as_reference_requested = pyqtSignal(str, str)  # filepath, content

    def __init__(self, archiver: SessionArchiver, parent=None):
        super().__init__(parent)
        self.archiver = archiver
        self.setWindowTitle("📦 Oturum Arşivi ve Log Yöneticisi")
        self.resize(850, 550)
        self.setStyleSheet("""
            QDialog {
                background-color: #1E1E2E;
                color: #CDD6F4;
            }
            QTableWidget {
                background-color: #181825;
                color: #CDD6F4;
                border: 1px solid #313244;
                border-radius: 4px;
                gridline-color: #313244;
            }
            QHeaderView::section {
                background-color: #313244;
                color: #F5E0DC;
                padding: 4px;
                font-weight: bold;
                border: 1px solid #181825;
            }
            QLineEdit {
                background-color: #313244;
                color: #CDD6F4;
                border: 1px solid #45475A;
                border-radius: 4px;
                padding: 6px;
            }
            QPushButton {
                background-color: #313244;
                color: #CDD6F4;
                border: 1px solid #45475A;
                border-radius: 4px;
                padding: 6px 12px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45475A;
                color: #89B4FA;
            }
            QTextEdit {
                background-color: #11111B;
                color: #A6ADC8;
                font-family: monospace;
                border: 1px solid #313244;
                border-radius: 4px;
            }
        """)

        self._init_ui()
        self.load_archives()

    def _init_ui(self):
        layout = QVBoxLayout(self)

        # Üst Araç Çubuğu: Arama ve Klasörü Aç
        top_layout = QHBoxLayout()
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("🔍 Arşiv dosyalarında veya portlarda ara...")
        self.search_input.textChanged.connect(self.filter_archives)
        top_layout.addWidget(self.search_input)

        btn_open_folder = QPushButton("📂 Arşiv Klasörünü Aç")
        btn_open_folder.clicked.connect(self.open_archive_folder)
        top_layout.addWidget(btn_open_folder)

        layout.addLayout(top_layout)

        # Bölücü: Sol tarafta Liste, Sağ tarafta Önizleme
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Tablo
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["Dosya Adı", "Bağlantı Portu", "Tarih", "Boyut"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.table.itemSelectionChanged.connect(self.on_selection_changed)
        splitter.addWidget(self.table)

        # Önizleme
        self.preview_edit = QTextEdit()
        self.preview_edit.setReadOnly(True)
        self.preview_edit.setPlaceholderText("Seçilen log dosyasının önizlemesi burada gösterilir...")
        splitter.addWidget(self.preview_edit)

        splitter.setSizes([500, 350])
        layout.addWidget(splitter)

        # Alt Butonlar
        bottom_layout = QHBoxLayout()

        self.btn_open_as_ref = QPushButton("📌 Referans Olarak Aç")
        self.btn_open_as_ref.setStyleSheet("background-color: #0284C7; color: white; font-weight: bold;")
        self.btn_open_as_ref.setToolTip("Seçili arşiv logunu ana penceredeki referans paneline aktarır")
        self.btn_open_as_ref.clicked.connect(self.open_selected_as_reference)
        bottom_layout.addWidget(self.btn_open_as_ref)

        self.btn_export = QPushButton("💾 Seçili Logu Farklı Kaydet...")
        self.btn_export.clicked.connect(self.export_selected)
        bottom_layout.addWidget(self.btn_export)

        self.btn_delete = QPushButton("🗑️ Seçiliyi Sil")
        self.btn_delete.clicked.connect(self.delete_selected)
        bottom_layout.addWidget(self.btn_delete)

        bottom_layout.addStretch()

        btn_close = QPushButton("Kapat")
        btn_close.clicked.connect(self.accept)
        bottom_layout.addWidget(btn_close)

        layout.addLayout(bottom_layout)

        # Tabloya çift tıklayınca da referans olarak aç
        self.table.itemDoubleClicked.connect(lambda item: self.open_selected_as_reference())

    def load_archives(self):
        self.archives = self.archiver.list_archives()
        self.display_archives(self.archives)

    def display_archives(self, items):
        self.table.setRowCount(len(items))
        for row, item in enumerate(items):
            item_fn = QTableWidgetItem(item["filename"])
            item_fn.setData(Qt.ItemDataRole.UserRole, item["path"])
            item_port = QTableWidgetItem(item["port"])
            item_date = QTableWidgetItem(item["date"])
            item_size = QTableWidgetItem(item["size_str"])

            self.table.setItem(row, 0, item_fn)
            self.table.setItem(row, 1, item_port)
            self.table.setItem(row, 2, item_date)
            self.table.setItem(row, 3, item_size)

        if items:
            self.table.selectRow(0)

    def filter_archives(self, query: str):
        query = query.lower()
        if not query:
            self.display_archives(self.archives)
            return

        filtered = [
            a for a in self.archives
            if query in a["filename"].lower() or query in a["port"].lower() or query in a["date"].lower()
        ]
        self.display_archives(filtered)

    def get_selected_path(self) -> Path | None:
        selected_rows = self.table.selectionModel().selectedRows()
        if not selected_rows:
            return None
        row = selected_rows[0].row()
        item = self.table.item(row, 0)
        return item.data(Qt.ItemDataRole.UserRole)

    def on_selection_changed(self):
        path = self.get_selected_path()
        if not path or not path.exists():
            self.preview_edit.clear()
            return

        try:
            # Sadece ilk 150 satırı hızlıca önizle
            lines = []
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                for _ in range(200):
                    line = f.readline()
                    if not line:
                        break
                    lines.append(line)
            preview_text = "".join(lines)
            if len(lines) == 200:
                preview_text += "\n... [Önizleme ilk 200 satırla sınırlandırıldı] ..."
            self.preview_edit.setPlainText(preview_text)
        except Exception as e:
            self.preview_edit.setPlainText(f"Önizleme okunamadı: {e}")

    def open_archive_folder(self):
        folder = str(self.archiver.archive_dir)
        QDesktopServices.openUrl(QUrl.fromLocalFile(folder))

    def export_selected(self):
        path = self.get_selected_path()
        if not path or not path.exists():
            QMessageBox.warning(self, "Uyarı", "Lütfen dışa aktarılacak bir dosya seçin.")
            return

        dest_file, _ = QFileDialog.getSaveFileName(
            self,
            "Log Dosyasını Dışa Aktar",
            path.name,
            "Log Dosyaları (*.log);;Metin Dosyaları (*.txt);;Tüm Dosyalar (*.*)"
        )
        if dest_file:
            try:
                shutil.copyfile(path, dest_file)
                QMessageBox.information(self, "Başarılı", f"Dosya başarıyla dışa aktarıldı:\n{dest_file}")
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Dışa aktarma başarısız: {e}")

    def delete_selected(self):
        path = self.get_selected_path()
        if not path or not path.exists():
            return

        ret = QMessageBox.question(
            self,
            "Silme Onayı",
            f"Bu log dosyasını silmek istediğinize emin misiniz?\n{path.name}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if ret == QMessageBox.StandardButton.Yes:
            try:
                path.unlink()
                self.load_archives()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Dosya silinemedi: {e}")

    def open_selected_as_reference(self):
        path = self.get_selected_path()
        if not path or not path.exists():
            QMessageBox.warning(self, "Uyarı", "Lütfen önce referans olarak açılacak bir log dosyası seçin.")
            return

        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            self.open_as_reference_requested.emit(str(path), content)
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Dosya okunamadı: {e}")
