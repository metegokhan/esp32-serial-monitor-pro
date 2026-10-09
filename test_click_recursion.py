import sys
import unittest
from PyQt6.QtWidgets import QApplication
from ui_main_window import MainWindow

app = QApplication.instance()
if not app:
    app = QApplication([])

class TestClickRecursion(unittest.TestCase):
    def test_word_click_and_external_highlight(self):
        win = MainWindow()
        ref1 = win.add_reference_panel()
        ref2 = win.add_reference_panel()

        ref1.load_content("Line 1 with wifi\nLine 2 with error\nLine 3 with wifi")
        ref2.load_content("Line A with wifi\nLine B with normal\nLine C with error")
        win.active_panel.load_content("Live 1 with wifi\nLive 2 with ok\nLive 3 with error")

        # Simulate user clicking "wifi" in active panel
        win.active_panel.viewer.applyWordHighlight("wifi", emit_signal=True)

        # Check highlight in all panels
        self.assertEqual(win.active_panel.viewer.clicked_word, "wifi")
        self.assertEqual(ref1.viewer.clicked_word, "wifi")
        self.assertEqual(ref2.viewer.clicked_word, "wifi")

        # Simulate clicking "error" in ref1
        ref1.viewer.applyWordHighlight("error", emit_signal=True)
        self.assertEqual(win.active_panel.viewer.clicked_word, "error")
        self.assertEqual(ref1.viewer.clicked_word, "error")
        self.assertEqual(ref2.viewer.clicked_word, "error")

        print("[TEST] Kelime tıklama ve çapraz vurgulama recursion olmadan başarıyla tamamlandı!")

if __name__ == "__main__":
    unittest.main()
