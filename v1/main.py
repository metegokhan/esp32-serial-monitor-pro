#!/usr/bin/env python3
"""
ESP32 Serial Capture & Monitor Pro
Gelişmiş Seri Port İzleme, Renklendirme, Arşivleme ve Analiz Aracı
"""

import sys
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from ui_main_window import MainWindow

def main():
    # High DPI ölçekleme desteği
    app = QApplication(sys.argv)
    app.setApplicationName("ESP32 Serial Monitor Pro")
    app.setOrganizationName("Antigravity")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
