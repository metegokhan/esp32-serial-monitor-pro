import sys
import unittest
from PyQt6.QtWidgets import QApplication
from ui_main_window import MainWindow
from archive_dialog import ArchiveManagerDialog

app = QApplication.instance()
if not app:
    app = QApplication([])

class TestArchiveReference(unittest.TestCase):
    def test_open_archive_as_reference(self):
        win = MainWindow()
        self.assertEqual(len(win.panels), 1)

        dlg = ArchiveManagerDialog(win.archiver, win)
        self.assertGreater(dlg.table.rowCount(), 0)

        # Select first row
        dlg.table.selectRow(0)
        selected_path = dlg.get_selected_path()
        self.assertIsNotNone(selected_path)

        # Connect signal to MainWindow
        dlg.open_as_reference_requested.connect(win.load_archive_into_reference)

        # Call open_selected_as_reference
        dlg.open_selected_as_reference()

        # Check MainWindow now has a reference panel containing the archive
        self.assertEqual(len(win.panels), 2)
        ref_panel = win.panels[0]
        self.assertIn("📌", ref_panel._title)
        self.assertIn(selected_path.name, ref_panel._title)
        self.assertGreater(len(ref_panel.viewer.raw_lines), 0)

        print(f"[TEST] Arşiv başarıyla referans paneline aktarıldı: {ref_panel._title} ({len(ref_panel.viewer.raw_lines)} satır)")

if __name__ == "__main__":
    unittest.main()
