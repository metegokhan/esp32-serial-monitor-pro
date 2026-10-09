import os
import re
import datetime
from pathlib import Path
from typing import List, Dict, Optional
import threading

class SessionArchiver:
    def __init__(self, archive_dir: str):
        self.archive_dir = Path(archive_dir)
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        self.current_file: Optional[Path] = None
        self._file_handle = None
        self._lock = threading.Lock()
        self.current_port: str = ""
        self.session_start_time: Optional[datetime.datetime] = None
        self.total_bytes: int = 0
        self.total_lines: int = 0

    def start_session(self, port_name: str) -> Path:
        with self._lock:
            self.stop_session_unlocked()
            self.current_port = port_name
            self.session_start_time = datetime.datetime.now()
            # Clean port name for file name, e.g. /dev/ttyACM0 -> ttyACM0
            clean_port = port_name.replace("/", "_").strip("_")
            timestamp = self.session_start_time.strftime("%Y%m%d_%H%M%S")
            filename = f"ESP32_{clean_port}_{timestamp}.log"
            self.current_file = self.archive_dir / filename
            self._file_handle = open(self.current_file, "a", encoding="utf-8", buffering=1)
            header = (
                f"=== ESP32 SERIAL MONITOR ARCHIVE ===\n"
                f"Port: {port_name}\n"
                f"Başlangıç: {self.session_start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"=====================================\n\n"
            )
            self._file_handle.write(header)
            self.total_bytes = len(header.encode("utf-8"))
            self.total_lines = header.count("\n")
            return self.current_file

    def write(self, text: str):
        with self._lock:
            if self._file_handle and not self._file_handle.closed:
                self._file_handle.write(text)
                self.total_bytes += len(text.encode("utf-8"))
                self.total_lines += text.count("\n")

    def stop_session_unlocked(self):
        if self._file_handle and not self._file_handle.closed:
            try:
                footer = (
                    f"\n\n=====================================\n"
                    f"Oturum Sonu: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                    f"Toplam Satır: {self.total_lines}\n"
                    f"Toplam Boyut: {self.total_bytes} bayt\n"
                    f"=====================================\n"
                )
                self._file_handle.write(footer)
                self._file_handle.flush()
                self._file_handle.close()
            except Exception as e:
                print(f"[Archiver] Oturum kapatılırken hata: {e}")
            self._file_handle = None

    def stop_session(self):
        with self._lock:
            self.stop_session_unlocked()

    def get_current_filepath(self) -> Optional[Path]:
        return self.current_file

    def list_archives(self) -> List[Dict]:
        """
        Arşiv klasöründeki tüm log dosyalarını detaylarıyla listeler.
        """
        results = []
        if not self.archive_dir.exists():
            return results

        for log_file in sorted(self.archive_dir.glob("*.log"), key=os.path.getmtime, reverse=True):
            try:
                stat = log_file.stat()
                size_kb = stat.st_size / 1024
                mtime = datetime.datetime.fromtimestamp(stat.st_mtime)

                # Port adını dosya adından çıkar: ESP32_{port}_{timestamp}.log
                match = re.match(r"ESP32_(.+)_\d{8}_\d{6}\.log", log_file.name)
                port_extracted = match.group(1).replace("_", "/") if match else "Bilinmiyor"

                results.append({
                    "path": log_file,
                    "filename": log_file.name,
                    "port": port_extracted,
                    "date": mtime.strftime("%Y-%m-%d %H:%M:%S"),
                    "size_bytes": stat.st_size,
                    "size_str": f"{size_kb:.1f} KB" if size_kb < 1024 else f"{size_kb/1024:.2f} MB"
                })
            except Exception as e:
                print(f"Log stat error for {log_file}: {e}")

        return results

    @staticmethod
    def export_content(content: str, dest_path: str) -> bool:
        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"[Archiver] Dışa aktarma hatası: {e}")
            return False
