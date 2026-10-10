import re
import datetime
from pathlib import Path
from typing import Optional
from PyQt6.QtCore import QObject, pyqtSignal

class TriggerManager(QObject):
    # Signals
    trigger_hit = pyqtSignal(str, str, int)  # matched_line, trigger_text, total_hits
    recording_started = pyqtSignal(str)     # target_filename
    recording_stopped = pyqtSignal(str, int) # target_filename, line_count

    def __init__(self, archive_dir: str):
        super().__init__()
        self.archive_dir = Path(archive_dir)
        self.archive_dir.mkdir(parents=True, exist_ok=True)

        self.trigger_text: str = ""
        self.is_regex: bool = False
        self.auto_record_enabled: bool = False
        self.is_active: bool = False

        self.hit_count: int = 0
        self._compiled_regex: Optional[re.Pattern] = None

        # Tetikleme ile başlayan özel kayıt oturumu
        self._record_handle = None
        self._record_file: Optional[Path] = None
        self._record_lines_count: int = 0

    def configure(self, trigger_text: str, is_regex: bool, auto_record: bool, active: bool):
        self.trigger_text = trigger_text.strip()
        self.is_regex = is_regex
        self.auto_record_enabled = auto_record
        self.is_active = active
        self._update_regex()

    def _update_regex(self):
        if not self.trigger_text:
            self._compiled_regex = None
            return
        try:
            pattern = self.trigger_text if self.is_regex else re.escape(self.trigger_text)
            self._compiled_regex = re.compile(pattern, re.IGNORECASE)
        except re.error:
            self._compiled_regex = None

    def check_line(self, line: str) -> bool:
        if not self.is_active or not self._compiled_regex:
            if self._record_handle:
                self._record_line(line)
            return False

        matched = bool(self._compiled_regex.search(line))
        if matched:
            self.hit_count += 1
            self.trigger_hit.emit(line, self.trigger_text, self.hit_count)

            # Otomatik kayıt başlatma modu aktifse ve henüz başlamadıysa
            if self.auto_record_enabled and not self._record_handle:
                self.start_trigger_recording()

        if self._record_handle:
            self._record_line(line)

        return matched

    def start_trigger_recording(self):
        self.stop_trigger_recording()
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r'[^\w\-]', '_', self.trigger_text)[:20]
        self._record_file = self.archive_dir / f"TRIGGER_{safe_name}_{ts}.log"
        self._record_handle = open(self._record_file, "w", encoding="utf-8")
        header = (
            f"=== TETİKLEYİCİ KAYIT OTURUMU ===\n"
            f"Tetikleme Kelimesi: {self.trigger_text}\n"
            f"Zaman: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"=================================\n\n"
        )
        self._record_handle.write(header)
        self._record_lines_count = 0
        self.recording_started.emit(self._record_file.name)

    def _record_line(self, line: str):
        if self._record_handle:
            self._record_handle.write(line + "\n")
            self._record_lines_count += 1
            self._record_handle.flush()

    def stop_trigger_recording(self):
        if self._record_handle:
            try:
                footer = f"\n=== Kayıt Tamamlandı: {self._record_lines_count} Satır ===\n"
                self._record_handle.write(footer)
                self._record_handle.close()
                filename = self._record_file.name if self._record_file else ""
                self.recording_stopped.emit(filename, self._record_lines_count)
            except Exception:
                pass
            self._record_handle = None
            self._record_file = None
