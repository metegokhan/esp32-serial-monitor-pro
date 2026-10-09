import sys
import unittest
from PyQt6.QtWidgets import QApplication
from ui_main_window import MainWindow

app = QApplication.instance()
if not app:
    app = QApplication([])

SAMPLE_LOG_1 = [
    "title: ESP32 Run 1 (Old Firmware)",
    "rst:0x1 (POWERON_RESET),boot:0x13",
    "I (100) wifi: Connected to MyNetwork",
    "E (200) wifi: DHCP Timeout",
    "E (300) mqtt: Broker connection failed",
    "load:0x3fff0030,len:1184"
]

SAMPLE_LOG_2 = [
    "title: ESP32 Run 2 (Patched Firmware)",
    "rst:0x1 (POWERON_RESET),boot:0x13",
    "I (100) wifi: Connected to MyNetwork",
    "I (210) wifi: IP Address assigned: 192.168.1.150",
    "E (300) mqtt: Broker connection failed",
    "load:0x3fff0030,len:1184"
]

SAMPLE_LOG_3 = [
    "title: ESP32 Run 3 (Final Live)",
    "rst:0x1 (POWERON_RESET),boot:0x13",
    "I (100) wifi: Connected to MyNetwork",
    "I (210) wifi: IP Address assigned: 192.168.1.150",
    "I (320) mqtt: Connected successfully to test.mosquitto.org",
    "load:0x3fff0030,len:1184"
]


class TestMultiPanel(unittest.TestCase):
    def setUp(self):
        self.win = MainWindow()

    def test_multi_panel_creation_and_limit(self):
        # Varsayılan 1 panel
        self.assertEqual(len(self.win.panels), 1)

        # 2. Paneli ekle
        ref1 = self.win.add_reference_panel()
        self.assertIsNotNone(ref1)
        self.assertEqual(len(self.win.panels), 2)

        # 3. Paneli ekle
        ref2 = self.win.add_reference_panel()
        self.assertIsNotNone(ref2)
        self.assertEqual(len(self.win.panels), 3)

        # 4. Paneli eklemeye çalışınca izin vermemeli (Maksimum 3)
        ref3 = self.win.add_reference_panel()
        self.assertIsNone(ref3)
        self.assertEqual(len(self.win.panels), 3)
        print("[TEST] 3 panele kadar sınırlandırma başarılı.")

    def test_synchronized_simultaneous_filtering(self):
        # 3 Panelli düzen kur
        ref1 = self.win.add_reference_panel()
        ref2 = self.win.add_reference_panel()
        self.assertEqual(len(self.win.panels), 3)

        # Her panele farklı log yükle
        ref1.load_content("\n".join(SAMPLE_LOG_1))
        ref2.load_content("\n".join(SAMPLE_LOG_2))
        self.win.active_panel.load_content("\n".join(SAMPLE_LOG_3))

        # Eşzamanlı filtrelemeyi aktifleştir: "mqtt"
        self.win.search_input.setText("mqtt")
        self.win.chk_only_matching.setChecked(True)

        # 3 panelin de sadece "mqtt" içeren satırları gösterdiğini doğrula
        ref1_text = ref1.viewer.toPlainText().strip()
        ref2_text = ref2.viewer.toPlainText().strip()
        active_text = self.win.active_panel.viewer.toPlainText().strip()

        print(f"[TEST] Panel 1 Süzülmüş:\n{ref1_text}")
        print(f"[TEST] Panel 2 Süzülmüş:\n{ref2_text}")
        print(f"[TEST] Panel 3 Süzülmüş:\n{active_text}")

        self.assertIn("Broker connection failed", ref1_text)
        self.assertNotIn("DHCP Timeout", ref1_text)

        self.assertIn("Broker connection failed", ref2_text)
        self.assertNotIn("IP Address assigned", ref2_text)

        self.assertIn("Connected successfully to test.mosquitto.org", active_text)
        self.assertNotIn("POWERON_RESET", active_text)

        # Filtreyi kapatınca tüm satırların geri geldiğini doğrula
        self.win.chk_only_matching.setChecked(False)
        self.assertIn("DHCP Timeout", ref1.viewer.toPlainText())
        self.assertIn("IP Address assigned", ref2.viewer.toPlainText())
        self.assertIn("POWERON_RESET", self.win.active_panel.viewer.toPlainText())
        print("[TEST] Eşzamanlı satır filtreleme ve geri yükleme %100 başarılı!")


if __name__ == "__main__":
    unittest.main()
