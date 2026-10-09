import time
import serial
import serial.tools.list_ports
from PyQt6.QtCore import QThread, pyqtSignal, QMutex, QMutexLocker

class SerialWorker(QThread):
    # Signals
    line_received = pyqtSignal(str)
    connected = pyqtSignal(str, int)     # port, baudrate
    disconnected = pyqtSignal(str)      # reason
    reconnecting = pyqtSignal(str, int)  # port, attempt
    error = pyqtSignal(str)
    stats_updated = pyqtSignal(int, int) # rx_bytes, tx_bytes

    def __init__(self):
        super().__init__()
        self.port: str = ""
        self.baudrate: int = 115200
        self.auto_reconnect: bool = False

        self._ser: serial.Serial | None = None
        self._running: bool = False
        self._should_connect: bool = False
        self._mutex = QMutex()

        self.rx_bytes: int = 0
        self.tx_bytes: int = 0
        self._write_queue: list[bytes] = []

    def configure(self, port: str, baudrate: int, auto_reconnect: bool = True):
        with QMutexLocker(self._mutex):
            self.port = port
            self.baudrate = baudrate
            self.auto_reconnect = auto_reconnect

    def start_connection(self, port: str, baudrate: int, auto_reconnect: bool = True):
        self.configure(port, baudrate, auto_reconnect)
        self._should_connect = True
        if not self.isRunning():
            self._running = True
            self.start()

    def stop_connection(self):
        self._should_connect = False
        self.auto_reconnect = False
        ser_to_close = None
        with QMutexLocker(self._mutex):
            if self._ser:
                ser_to_close = self._ser
                self._ser = None
        if ser_to_close:
            try:
                if hasattr(ser_to_close, 'cancel_read'):
                    ser_to_close.cancel_read()
                ser_to_close.close()
            except Exception:
                pass
        self.disconnected.emit("Kullanıcı tarafından bağlantı kesildi.")

    def shutdown(self):
        self._running = False
        self._should_connect = False
        self.stop_connection()
        self.wait(1000)

    def send_data(self, data: bytes):
        with QMutexLocker(self._mutex):
            self._write_queue.append(data)

    def reset_esp32(self):
        """
        ESP32 Donanım Resetleme Sırası (EN pini).
        Standart ESP devkit'lerde DTR ve RTS transistör devresi ile EN ve IO0 pinlerine bağlıdır.
        """
        with QMutexLocker(self._mutex):
            if self._ser and self._ser.is_open:
                try:
                    self._ser.dtr = False
                    self._ser.rts = True
                    time.sleep(0.1)
                    self._ser.rts = False
                except Exception as e:
                    self.error.emit(f"Reset hatası: {e}")

    def enter_bootloader(self):
        """
        ESP32 Bootloader (İndirme/Flaş) Moduna Alma (IO0=LOW + EN puls).
        """
        with QMutexLocker(self._mutex):
            if self._ser and self._ser.is_open:
                try:
                    self._ser.dtr = True   # IO0 LOW
                    self._ser.rts = True   # EN LOW
                    time.sleep(0.1)
                    self._ser.rts = False  # EN HIGH (ESP IO0 LOW iken başlar)
                    time.sleep(0.05)
                    self._ser.dtr = False  # IO0 serbest bırak
                except Exception as e:
                    self.error.emit(f"Bootloader tetikleme hatası: {e}")

    def set_dtr(self, state: bool):
        with QMutexLocker(self._mutex):
            if self._ser and self._ser.is_open:
                try:
                    self._ser.dtr = state
                except Exception as e:
                    self.error.emit(f"DTR ayar hatası: {e}")

    def set_rts(self, state: bool):
        with QMutexLocker(self._mutex):
            if self._ser and self._ser.is_open:
                try:
                    self._ser.rts = state
                except Exception as e:
                    self.error.emit(f"RTS ayar hatası: {e}")

    def run(self):
        reconnect_attempts = 0
        line_buffer = bytearray()

        while self._running:
            if not self._should_connect:
                time.sleep(0.1)
                continue

            # Bağlantı açık değilse açmayı dene
            if not self._ser or not self._ser.is_open:
                try:
                    self._ser = serial.Serial(
                        port=self.port,
                        baudrate=self.baudrate,
                        timeout=0.05,
                        write_timeout=0.5
                    )
                    # Varsayılan DTR/RTS durumları
                    self._ser.dtr = False
                    self._ser.rts = False
                    reconnect_attempts = 0
                    self.connected.emit(self.port, self.baudrate)
                except Exception as e:
                    if self.auto_reconnect:
                        reconnect_attempts += 1
                        self.reconnecting.emit(self.port, reconnect_attempts)
                        time.sleep(1.5)
                        continue
                    else:
                        self.error.emit(f"Bağlantı hatası: {e}")
                        self._should_connect = False
                        time.sleep(0.1)
                        continue

            # Seri port üzerinden veri okuma ve yazma döngüsü
            try:
                # 1. Gönderilecek verileri yaz
                with QMutexLocker(self._mutex):
                    while self._write_queue:
                        chunk = self._write_queue.pop(0)
                        if self._ser and self._ser.is_open:
                            self._ser.write(chunk)
                            self.tx_bytes += len(chunk)
                            self.stats_updated.emit(self.rx_bytes, self.tx_bytes)

                # 2. Gelen verileri oku
                ser_inst = None
                with QMutexLocker(self._mutex):
                    if self._ser and self._ser.is_open:
                        ser_inst = self._ser

                if not ser_inst or not self._should_connect:
                    time.sleep(0.02)
                    continue

                in_wait = 0
                try:
                    in_wait = ser_inst.in_waiting if ser_inst.is_open else 0
                except Exception:
                    pass

                read_size = in_wait if in_wait > 0 else 1
                raw = ser_inst.read(read_size)

                if raw:
                    self.rx_bytes += len(raw)
                    self.stats_updated.emit(self.rx_bytes, self.tx_bytes)
                    line_buffer.extend(raw)

                    # Satır bazında ayıkla (\n veya \r\n)
                    while b'\n' in line_buffer:
                        split_idx = line_buffer.index(b'\n')
                        line_bytes = line_buffer[:split_idx]
                        del line_buffer[:split_idx + 1]

                        # Çözümle
                        line_str = line_bytes.decode('utf-8', errors='replace').rstrip('\r')
                        self.line_received.emit(line_str)
                else:
                    time.sleep(0.01)

            except (serial.SerialException, OSError, TypeError, ValueError, Exception) as e:
                # Kullanıcı bağlantıyı kestiğinde veya donanım koptuğunda
                with QMutexLocker(self._mutex):
                    if self._ser:
                        try:
                            self._ser.close()
                        except Exception:
                            pass
                        self._ser = None

                if not self._should_connect:
                    # Kullanıcı bağlantıyı manuel olarak sonlandırdı
                    continue

                self.error.emit(f"Bağlantı koptu: {e}")
                if self.auto_reconnect:
                    reconnect_attempts += 1
                    self.reconnecting.emit(self.port, reconnect_attempts)
                    time.sleep(1.5)
                else:
                    self._should_connect = False
                    self.disconnected.emit("Bağlantı sonlandı.")
