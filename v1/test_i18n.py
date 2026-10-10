import unittest
import sys
from PyQt6.QtWidgets import QApplication
from ui_main_window import MainWindow
from i18n import t, i18n
from config_manager import ConfigManager

app = QApplication.instance()
if not app:
    app = QApplication(sys.argv)

class TestI18nAndUILayout(unittest.TestCase):
    def test_translation_keys(self):
        i18n.set_language("tr")
        self.assertEqual(t("btn_connect"), "⚡ Bağlan")
        self.assertEqual(t("chk_reset_on_connect"), "Resetle")

        i18n.set_language("en")
        self.assertEqual(t("btn_connect"), "⚡ Connect")
        self.assertEqual(t("chk_reset_on_connect"), "Reset on Connect")

    def test_ui_language_switch(self):
        window = MainWindow()

        # Switch to English
        window.change_language("en")
        self.assertEqual(window.btn_connect.text(), "⚡ Connect")
        self.assertEqual(window.chk_reset_on_connect.text(), "Reset on Connect")
        self.assertEqual(window.chk_auto_reconnect.text(), "Auto-Reconnect")
        self.assertEqual(window.menu_file.title(), "📁 File")
        self.assertEqual(window.config.get("language"), "en")

        # Switch back to Turkish
        window.change_language("tr")
        self.assertEqual(window.btn_connect.text(), "⚡ Bağlan")
        self.assertEqual(window.chk_reset_on_connect.text(), "Resetle")
        self.assertEqual(window.chk_auto_reconnect.text(), "Oto-Bağlan")
        self.assertEqual(window.menu_file.title(), "📁 Dosya")
        self.assertEqual(window.config.get("language"), "tr")

        window.close()

    def test_reset_button_position_beside_connect(self):
        window = MainWindow()
        # In the top control layout, chk_reset_on_connect should be immediately after btn_connect
        top_layout = window.centralWidget().layout().itemAt(0)
        widgets = []
        for i in range(top_layout.count()):
            item = top_layout.itemAt(i)
            if item.widget():
                widgets.append(item.widget())

        connect_idx = widgets.index(window.btn_connect)
        reset_idx = widgets.index(window.chk_reset_on_connect)
        self.assertEqual(reset_idx, connect_idx + 1, "chk_reset_on_connect must be right next to btn_connect!")
        window.close()

if __name__ == "__main__":
    unittest.main()
