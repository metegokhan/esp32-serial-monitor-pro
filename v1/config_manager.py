import os
import json
from pathlib import Path

DEFAULT_ARCHIVE_DIR = str(Path(__file__).parent / "archives")
CONFIG_PATH = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "last_port": "",
    "last_baudrate": 115200,
    "device_filter": "esp",  # "all", "esp", "arduino", "usb"
    "auto_reconnect": True,
    "timestamp_enabled": False,
    "auto_scroll": True,
    "trigger_word": "",
    "trigger_is_regex": False,
    "trigger_record_enabled": False,
    "max_buffer_lines": 30000,
    "archive_dir": DEFAULT_ARCHIVE_DIR,
    "line_ending": "\\r\\n",
    "font_size": 11,
    "reset_on_connect": False,
    "language": "tr",
    "command_history": []
}


class ConfigManager:
    def __init__(self, config_file: Path = CONFIG_PATH):
        self.config_file = config_file
        self.data = dict(DEFAULT_CONFIG)
        self.load()

    def load(self):
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    self.data.update(loaded)
            except Exception as e:
                print(f"[ConfigManager] Ayarlar yüklenirken hata oluştu: {e}")
        else:
            self.save()

    def save(self):
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"[ConfigManager] Ayarlar kaydedilirken hata oluştu: {e}")

    def get(self, key, default=None):
        return self.data.get(key, default)

    def set(self, key, value, auto_save=True):
        self.data[key] = value
        if auto_save:
            self.save()
