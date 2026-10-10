import unittest
from PyQt6.QtWidgets import QApplication
from ui_main_window import MainWindow
from serial_worker import SerialWorker
from config_manager import ConfigManager
import sys

app = QApplication.instance()
if not app:
    app = QApplication(sys.argv)

class TestResetOnConnect(unittest.TestCase):
    def test_worker_reset_flag(self):
        worker = SerialWorker()
        self.assertFalse(worker.reset_on_connect)
        worker.configure("/dev/null", 115200, auto_reconnect=False, reset_on_connect=True)
        self.assertTrue(worker.reset_on_connect)

    def test_ui_checkbox_and_action_sync(self):
        window = MainWindow()
        # Initial should match config (False)
        self.assertFalse(window.chk_reset_on_connect.isChecked())
        self.assertFalse(window.act_reset_on_conn.isChecked())

        # Toggle checkbox -> should sync action and config
        window.chk_reset_on_connect.setChecked(True)
        self.assertTrue(window.act_reset_on_conn.isChecked())
        self.assertTrue(window.config.get("reset_on_connect"))

        # Toggle action -> should sync checkbox and config
        window.act_reset_on_conn.setChecked(False)
        self.assertFalse(window.chk_reset_on_connect.isChecked())
        self.assertFalse(window.config.get("reset_on_connect"))
        window.close()

if __name__ == "__main__":
    unittest.main()
