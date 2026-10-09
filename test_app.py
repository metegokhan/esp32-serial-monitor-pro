import sys
import unittest
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

from config_manager import ConfigManager
from port_scanner import PortScanner
from archiver import SessionArchiver
from syntax_highlighter import Esp32SyntaxHighlighter
from log_viewer import Esp32LogViewer
from trigger_manager import TriggerManager

app = QApplication.instance()
if not app:
    app = QApplication([])

SAMPLE_LOG = [
    "title: ESP32 Bootstrapping Test",
    "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    "configsip: 0, SPIWP:0xee",
    "clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00",
    "mode:DIO, clock div:1",
    "load:0x3fff0030,len:1184",
    "ho 0 tail 12 room 4",
    "load:0x40078000,len:13232",
    "I (341) cpu_start: Starting scheduler on PRO CPU.",
    "W (348) wifi: WiFi not initialized",
    "E (400) esp_netif: Failed to configure IP address",
    '{"sensor": "temp", "val": 24.5, "status": "ok"}'
]

class TestEsp32SerialMonitor(unittest.TestCase):
    def setUp(self):
        self.config = ConfigManager()
        self.archiver = SessionArchiver(self.config.get("archive_dir"))
        self.viewer = Esp32LogViewer()
        for line in SAMPLE_LOG:
            self.viewer.appendLogLine(line)

    def test_port_scanner(self):
        ports = PortScanner.scan_ports("all")
        self.assertIsInstance(ports, list)
        esp_ports = PortScanner.scan_ports("esp")
        self.assertIsInstance(esp_ports, list)
        print(f"[TEST] Port tarama başarılı. Bulunan toplam port: {len(ports)}, ESP portu: {len(esp_ports)}")

    def test_syntax_highlighting_and_log_viewer(self):
        self.assertEqual(self.viewer.blockCount(), len(SAMPLE_LOG) + 1)
        print(f"[TEST] Log satırları başarıyla yüklendi. Satır sayısı: {self.viewer.blockCount()}")

    def test_range_selection(self):
        # 1. Satır ve 4. Satır arasını seç
        self.viewer.setPointA(1)
        self.viewer.setPointB(4)
        self.assertEqual(self.viewer.point_a, 1)
        self.assertEqual(self.viewer.point_b, 4)

        text_range = self.viewer.getTextBetweenLines(1, 4)
        lines = text_range.split("\n")
        self.assertEqual(len(lines), 4)
        print(f"[TEST] Nokta A ve B seçimi başarılı. Seçilen 4 satır:\n{text_range}")

        copied = self.viewer.copySelectedRange()
        self.assertEqual(copied, text_range)

    def test_word_highlighting(self):
        self.viewer.applyWordHighlight("load")
        self.assertEqual(self.viewer.clicked_word, "load")
        self.assertGreater(len(self.viewer.clicked_word_lines), 0)
        print(f"[TEST] 'load' kelimesi tıklandı ve {len(self.viewer.clicked_word_lines)} satırda vurgulandı.")

    def test_copy_matching_lines(self):
        matched = self.viewer.copyMatchingLines("WiFi")
        self.assertIn("WiFi not initialized", matched)
        print(f"[TEST] 'WiFi' içeren satırlar kopyalandı:\n{matched}")

    def test_trigger_manager(self):
        trigger_mgr = TriggerManager(self.config.get("archive_dir"))
        trigger_mgr.configure("Failed", False, True, True)

        hits = []
        trigger_mgr.trigger_hit.connect(lambda line, word, count: hits.append((line, word, count)))

        test_line = "E (400) esp_netif: Failed to configure IP address"
        matched = trigger_mgr.check_line(test_line)
        self.assertTrue(matched)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0][1], "Failed")
        print(f"[TEST] Tetikleme yöneticisi başarıyla tetiklendi. Yakalanan: {hits[0]}")
        trigger_mgr.stop_trigger_recording()

    def test_archiver(self):
        path = self.archiver.start_session("/dev/ttyACM0")
        self.assertTrue(path.exists())
        self.archiver.write("Test Log Satırı 1\n")
        self.archiver.write("Test Log Satırı 2\n")
        self.archiver.stop_session()

        archives = self.archiver.list_archives()
        self.assertGreater(len(archives), 0)
        self.assertEqual(archives[0]["filename"], path.name)
        print(f"[TEST] Arşivleme başarılı. Oluşturulan arşiv: {path.name}, Boyut: {archives[0]['size_str']}")


if __name__ == "__main__":
    unittest.main()
