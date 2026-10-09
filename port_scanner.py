import serial.tools.list_ports
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class SerialDeviceInfo:
    device: str
    description: str
    hwid: str
    vid: Optional[int]
    pid: Optional[int]
    manufacturer: Optional[str]
    is_esp: bool
    is_arduino: bool
    category: str

    @property
    def display_name(self) -> str:
        badge = ""
        if self.is_esp:
            badge = " [ESP32/ESP]"
        elif self.is_arduino:
            badge = " [Arduino]"
        desc = self.description if self.description and self.description != "n/a" else ""
        if desc and desc != self.device:
            return f"{self.device} - {desc}{badge}"
        return f"{self.device}{badge}"


class PortScanner:
    ESP_VIDS = {
        0x303A: "Espressif USB JTAG/CDC",
        0x10C4: "Silicon Labs CP210x (ESP32/NodeMCU)",
        0x1A86: "QinHeng CH340/CH341 (ESP/Arduino)",
        0x0403: "FTDI Chip (ESP-Prog)",
    }

    ARDUINO_VIDS = {
        0x2341: "Arduino LLC",
        0x2A03: "Arduino srl",
        0x1B4F: "SparkFun",
    }

    @classmethod
    def scan_ports(cls, filter_mode: str = "all") -> List[SerialDeviceInfo]:
        """
        filter_mode: 'all', 'esp', 'arduino', 'usb'
        """
        ports = serial.tools.list_ports.comports()
        device_list: List[SerialDeviceInfo] = []

        for p in ports:
            vid = p.vid
            pid = p.pid
            desc = p.description or ""
            manuf = p.manufacturer or ""
            hwid = p.hwid or ""
            text_summary = f"{desc} {manuf} {hwid}".lower()

            is_esp = False
            is_arduino = False

            if vid in cls.ESP_VIDS:
                is_esp = True
            elif any(k in text_summary for k in ["espressif", "esp32", "esp8266", "nodemcu", "wroom", "wrover", "cp210", "ch340", "ch341", "jtag/serial"]):
                is_esp = True

            if vid in cls.ARDUINO_VIDS:
                is_arduino = True
            elif any(k in text_summary for k in ["arduino", "uno", "mega 2560", "nano", "leonardo", "teensy"]):
                is_arduino = True

            # Category definition
            category = "other"
            if is_esp:
                category = "esp"
            elif is_arduino:
                category = "arduino"
            elif vid is not None or "ttyusb" in p.device.lower() or "ttyacm" in p.device.lower() or "com" in p.device.lower():
                category = "usb"

            # Filter logic
            if filter_mode == "esp" and not is_esp:
                # If ESP filter is active but user has a USB port that might be ESP, also check
                continue
            elif filter_mode == "arduino" and not is_arduino:
                continue
            elif filter_mode == "usb" and category not in ("esp", "arduino", "usb"):
                continue

            dev_info = SerialDeviceInfo(
                device=p.device,
                description=desc,
                hwid=hwid,
                vid=vid,
                pid=pid,
                manufacturer=manuf,
                is_esp=is_esp,
                is_arduino=is_arduino,
                category=category
            )
            device_list.append(dev_info)

        # Sort so that ESP/Arduino and USB devices come first, followed by device name
        def sort_key(d: SerialDeviceInfo):
            priority = 0
            if d.is_esp:
                priority = 3
            elif d.is_arduino:
                priority = 2
            elif d.category == "usb":
                priority = 1
            return (-priority, d.device)

        device_list.sort(key=sort_key)
        return device_list
