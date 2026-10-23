use std::collections::{HashMap, VecDeque};
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use chrono::Local;
use serde::{Deserialize, Serialize};
use serialport::{SerialPort, SerialPortType};
use tauri::{AppHandle, Emitter};

use crate::archive::get_archive_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSessionInfo {
    pub session_id: String,
    pub port_name: String,
    pub baud_rate: u32,
    pub is_running: bool,
    pub rx_bytes: usize,
    pub tx_bytes: usize,
    pub lines_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialDeviceInfo {
    pub port_name: String,
    pub display_name: String,
    pub description: String,
    pub manufacturer: Option<String>,
    pub serial_number: Option<String>,
    pub usb_product: Option<String>,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub is_esp: bool,
    pub is_arduino: bool,
    pub category: String,
    pub safe_connect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProbeResult {
    pub port_name: String,
    pub baud_rate: u32,
    pub responsive: bool,
    pub response_sample: String,
    pub chip_family: String,
    pub device_info: Option<SerialDeviceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialDataPayload {
    pub session_id: String,
    pub line: String,
    pub rx_bytes: usize,
    pub tx_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialStatusPayload {
    pub session_id: String,
    pub port_name: String,
    pub baud_rate: u32,
    pub status: String, // "connected", "disconnected", "error", "reconnecting"
    pub message: String,
}

pub struct ActiveSession {
    pub session_id: String,
    pub port_name: String,
    pub baud_rate: u32,
    pub is_running: Arc<AtomicBool>,
    pub cancel_flag: Arc<AtomicBool>,
    pub reset_on_connect: bool,
    pub port_writer: Arc<Mutex<Option<Box<dyn SerialPort>>>>,
    pub rx_bytes: Arc<AtomicUsize>,
    pub tx_bytes: Arc<AtomicUsize>,
    pub recent_lines: Arc<Mutex<VecDeque<String>>>,
    pub total_lines_received: Arc<AtomicUsize>,
}

#[derive(Default)]
pub struct SerialManager {
    sessions: Arc<Mutex<HashMap<String, ActiveSession>>>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn scan_ports(&self, filter: &str) -> Vec<SerialDeviceInfo> {
        let mut devices = Vec::new();
        if let Ok(ports) = serialport::available_ports() {
            for p in ports {
                let mut is_esp = false;
                let mut is_arduino = false;
                let mut vid = None;
                let mut pid = None;
                let mut manufacturer = None;
                let mut serial_number = None;
                let mut usb_product = None;
                let mut description = p.port_name.clone();
                let mut chip_detail = String::new();

                match &p.port_type {
                    SerialPortType::UsbPort(usb) => {
                        vid = Some(usb.vid);
                        pid = Some(usb.pid);
                        manufacturer = usb.manufacturer.clone();
                        serial_number = usb.serial_number.clone();
                        usb_product = usb.product.clone();
                        if let Some(ref prod) = usb.product {
                            description = prod.clone();
                        }

                        // ESP32 VIDs & Product matching
                        if usb.vid == 0x303A {
                            is_esp = true;
                            chip_detail = match usb.pid {
                                0x1001 => "ESP32-S2/S3 (Native USB CDC)".to_string(),
                                0x1002 => "ESP32-C3/C6 (Native USB CDC)".to_string(),
                                0x1003 => "ESP32-H2 (Native USB CDC)".to_string(),
                                0x1004 | 0x1005 => "ESP32-P4 (Native USB CDC)".to_string(),
                                _ => "Espressif Native USB".to_string(),
                            };
                        } else if usb.vid == 0x10C4 {
                            is_esp = true;
                            chip_detail = "ESP32 (CP210x UART)".to_string();
                        } else if usb.vid == 0x1A86 {
                            is_esp = true;
                            chip_detail = "ESP32/Arduino (CH340/CH343 UART)".to_string();
                        } else if usb.vid == 0x0403 {
                            is_esp = true;
                            chip_detail = "ESP32 (FTDI UART / ESP-Prog)".to_string();
                        }

                        // Arduino VIDs
                        if usb.vid == 0x2341 || usb.vid == 0x2A03 || usb.vid == 0x1B4F {
                            is_arduino = true;
                        }

                        let combined = format!(
                            "{} {} {}",
                            description,
                            manufacturer.as_deref().unwrap_or(""),
                            p.port_name
                        ).to_lowercase();

                        if combined.contains("espressif") || combined.contains("esp32") || combined.contains("ch340") || combined.contains("cp210") {
                            is_esp = true;
                        }
                        if combined.contains("arduino") {
                            is_arduino = true;
                        }
                    }
                    _ => {}
                }

                let category = if is_esp {
                    "esp".to_string()
                } else if is_arduino {
                    "arduino".to_string()
                } else if vid.is_some() {
                    "usb".to_string()
                } else {
                    "other".to_string()
                };

                let should_include = match filter {
                    "esp" => is_esp,
                    "arduino" => is_arduino,
                    "usb" => vid.is_some(),
                    _ => true,
                };

                if should_include {
                    let mut display_name = p.port_name.clone();
                    if !chip_detail.is_empty() {
                        display_name = format!("⚡ {} — {} ({})", p.port_name, chip_detail, description);
                    } else if is_esp {
                        display_name = format!("⚡ {} [ESP32] ({})", p.port_name, description);
                    } else if is_arduino {
                        display_name = format!("🔌 {} [Arduino] ({})", p.port_name, description);
                    } else if description != p.port_name && !description.is_empty() {
                        display_name = format!("{} ({})", p.port_name, description);
                    }

                    devices.push(SerialDeviceInfo {
                        port_name: p.port_name,
                        display_name,
                        description,
                        manufacturer,
                        serial_number,
                        usb_product,
                        vid,
                        pid,
                        is_esp,
                        is_arduino,
                        category,
                        safe_connect: true,
                    });
                }
            }
        }

        // Sort so ESP32 and USB devices always appear at the top
        devices.sort_by(|a, b| {
            let score = |d: &SerialDeviceInfo| -> u8 {
                if d.is_esp {
                    0
                } else if d.is_arduino {
                    1
                } else if d.vid.is_some() {
                    2
                } else {
                    3
                }
            };
            score(a).cmp(&score(b)).then_with(|| a.port_name.cmp(&b.port_name))
        });

        devices
    }

    pub fn connect_session(
        &self,
        app: AppHandle,
        session_id: String,
        port_name: String,
        baud_rate: u32,
        reset_on_connect: bool,
    ) -> Result<(), String> {
        // Stop any existing session with the same session_id
        self.disconnect_session(&session_id)?;

        // Open serial port with zero-reset neutral settings by default
        let port_builder = serialport::new(&port_name, baud_rate)
            .timeout(Duration::from_millis(50));

        let port = port_builder.open().map_err(|e| format!("Port açılamadı {}: {}", port_name, e))?;

        // Clone port handle for writing / hardware pulse
        let port_writer = port.try_clone().map_err(|e| format!("Port çoğaltılamadı: {}", e))?;

        let is_running = Arc::new(AtomicBool::new(true));
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let rx_bytes = Arc::new(AtomicUsize::new(0));
        let tx_bytes = Arc::new(AtomicUsize::new(0));
        let recent_lines = Arc::new(Mutex::new(VecDeque::with_capacity(1000)));
        let total_lines_received = Arc::new(AtomicUsize::new(0));

        let writer_mutex = Arc::new(Mutex::new(Some(port_writer)));

        let active_session = ActiveSession {
            session_id: session_id.clone(),
            port_name: port_name.clone(),
            baud_rate,
            is_running: is_running.clone(),
            cancel_flag: cancel_flag.clone(),
            reset_on_connect,
            port_writer: writer_mutex.clone(),
            rx_bytes: rx_bytes.clone(),
            tx_bytes: tx_bytes.clone(),
            recent_lines: recent_lines.clone(),
            total_lines_received: total_lines_received.clone(),
        };

        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(session_id.clone(), active_session);
        }

        // Perform reset on connect ONLY if user requested it explicitly
        if reset_on_connect {
            let mut w = writer_mutex.lock().unwrap();
            if let Some(ref mut p) = *w {
                let _ = p.write_data_terminal_ready(false);
                let _ = p.write_request_to_send(true);
                thread::sleep(Duration::from_millis(100));
                let _ = p.write_request_to_send(false);
            }
        }

        // Prepare archive file for continuous session logging
        let clean_port = port_name.replace(['/', '\\', ':', '.'], "_").trim_matches('_').to_string();
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let archive_filename = format!("ESP32_{}_{}.log", clean_port, timestamp);
        let mut archive_path = get_archive_dir();
        archive_path.push(&archive_filename);

        let mut archive_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&archive_path)
            .ok();

        let header = format!(
            "=== ESP32 SERIAL MONITOR ARCHIVE ===\nSession: {}\nPort: {}\nBaud: {}\nMode: {}\nStart: {}\n=====================================\n\n",
            session_id,
            port_name,
            baud_rate,
            if reset_on_connect { "RESET_ON_CONNECT (Hardware reset triggered)" } else { "SAFE_CONNECT (DTR/RTS Neutral - No reset)" },
            Local::now().format("%Y-%m-%d %H:%M:%S")
        );

        if let Some(ref mut f) = archive_file {
            let _ = f.write_all(header.as_bytes());
        }

        // Add explicit safe connect / reset banner into recent lines
        let banner_line = if reset_on_connect {
            "⚠️ [RESETLİ BAĞLANTI] Port açıldı ve EN pini tetiklendi (Boot logları yakalanıyor)".to_string()
        } else {
            format!("🛡️ [GÜVENLİ BAĞLANTI] Port açıldı: {} @ {} baud | DTR: Nötr, RTS: Nötr (Donanımsal reset KAPALI)", port_name, baud_rate)
        };
        recent_lines.lock().unwrap().push_back(banner_line.clone());
        if let Some(ref mut f) = archive_file {
            let _ = f.write_all(format!("{}\n", banner_line).as_bytes());
        }

        // Emit connected status to frontend
        let _ = app.emit(
            "serial-status",
            SerialStatusPayload {
                session_id: session_id.clone(),
                port_name: port_name.clone(),
                baud_rate,
                status: "connected".to_string(),
                message: format!("Bağlandı: {} @ {} baud", port_name, baud_rate),
            },
        );

        // Reader Thread
        let s_id = session_id.clone();
        let p_name = port_name.clone();
        let app_handle = app.clone();
        let running_flag = is_running.clone();
        let rx_counter = rx_bytes.clone();
        let tx_counter = tx_bytes.clone();
        let lines_queue = recent_lines.clone();
        let total_lines_counter = total_lines_received.clone();

        thread::spawn(move || {
            let mut reader = BufReader::new(port);
            let mut line_buffer = String::new();

            while running_flag.load(Ordering::SeqCst) {
                line_buffer.clear();
                match reader.read_line(&mut line_buffer) {
                    Ok(bytes_read) => {
                        if bytes_read > 0 {
                            total_lines_counter.fetch_add(1, Ordering::SeqCst);
                            let total_rx = rx_counter.fetch_add(bytes_read, Ordering::SeqCst) + bytes_read;
                            let total_tx = tx_counter.load(Ordering::SeqCst);

                            // Clean line of trailing CRLF for UI, but preserve raw log
                            let trimmed = line_buffer.trim_end_matches(['\r', '\n']).to_string();

                            // Store in recent lines ring buffer
                            {
                                if let Ok(mut q) = lines_queue.lock() {
                                    if q.len() >= 1000 {
                                        q.pop_front();
                                    }
                                    q.push_back(trimmed.clone());
                                }
                            }

                            // Write to archive
                            if let Some(ref mut f) = archive_file {
                                let _ = f.write_all(line_buffer.as_bytes());
                            }

                            let _ = app_handle.emit(
                                "serial-data",
                                SerialDataPayload {
                                    session_id: s_id.clone(),
                                    line: trimmed,
                                    rx_bytes: total_rx,
                                    tx_bytes: total_tx,
                                },
                            );
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                        // Expected timeout on non-blocking reads, continue loop
                        thread::sleep(Duration::from_millis(5));
                    }
                    Err(e) => {
                        // Connection dropped or port closed
                        if running_flag.load(Ordering::SeqCst) {
                            let _ = app_handle.emit(
                                "serial-status",
                                SerialStatusPayload {
                                    session_id: s_id.clone(),
                                    port_name: p_name.clone(),
                                    baud_rate,
                                    status: "disconnected".to_string(),
                                    message: format!("Bağlantı koptu: {}", e),
                                },
                            );
                        }
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    pub fn disconnect_session(&self, session_id: &str) -> Result<(), String> {
        let mut map = self.sessions.lock().unwrap();
        if let Some(session) = map.remove(session_id) {
            session.is_running.store(false, Ordering::SeqCst);
            session.cancel_flag.store(true, Ordering::SeqCst);
            let mut writer = session.port_writer.lock().unwrap();
            *writer = None;
        }
        Ok(())
    }

    pub fn cancel_session(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            session.cancel_flag.store(true, Ordering::SeqCst);
            return true;
        }
        false
    }

    pub fn cancel_all(&self) {
        let map = self.sessions.lock().unwrap();
        for session in map.values() {
            session.cancel_flag.store(true, Ordering::SeqCst);
        }
    }

    pub fn is_cancelled(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            return session.cancel_flag.load(Ordering::SeqCst);
        }
        false
    }

    pub fn reset_cancel_flag(&self, session_id: &str) {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            session.cancel_flag.store(false, Ordering::SeqCst);
        }
    }

    pub fn send_data(&self, session_id: &str, data: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            let mut writer = session.port_writer.lock().unwrap();
            if let Some(ref mut port) = *writer {
                let bytes = data.as_bytes();
                port.write_all(bytes).map_err(|e| format!("Veri yazma hatası: {}", e))?;
                session.tx_bytes.fetch_add(bytes.len(), Ordering::SeqCst);
                return Ok(());
            }
        }
        Err("Bağlantı aktif değil".to_string())
    }

    pub fn send_multiline(
        &self,
        session_id: &str,
        lines: &[String],
        eol: &str,
        delay_ms: u64,
    ) -> Result<usize, String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            session.cancel_flag.store(false, Ordering::SeqCst);
            let mut writer = session.port_writer.lock().unwrap();
            if let Some(ref mut port) = *writer {
                let mut total_bytes = 0;
                let count = lines.len();
                for (idx, line) in lines.iter().enumerate() {
                    // Check cancellation flag for long running sends
                    if session.cancel_flag.load(Ordering::SeqCst) {
                        return Err(format!("İşlem kullanıcı tarafından iptal edildi (Gönderilen: {}/{})", idx, count));
                    }

                    let formatted = format!("{}{}", line, eol);
                    let bytes = formatted.as_bytes();
                    port.write_all(bytes).map_err(|e| format!("Veri yazma hatası: {}", e))?;
                    session.tx_bytes.fetch_add(bytes.len(), Ordering::SeqCst);
                    total_bytes += bytes.len();

                    if delay_ms > 0 && idx + 1 < count {
                        thread::sleep(Duration::from_millis(delay_ms));
                    }
                }
                return Ok(total_bytes);
            }
        }
        Err("Bağlantı aktif değil".to_string())
    }

    pub fn get_total_lines_count(&self, session_id: &str) -> Option<usize> {
        let map = self.sessions.lock().unwrap();
        map.get(session_id).map(|s| s.total_lines_received.load(Ordering::SeqCst))
    }

    pub fn get_lines_since(&self, session_id: &str, start_count: usize) -> Vec<String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            let current_count = session.total_lines_received.load(Ordering::SeqCst);
            if current_count <= start_count {
                return Vec::new();
            }
            let diff = current_count - start_count;
            let q = session.recent_lines.lock().unwrap();
            let available = diff.min(q.len());
            return q.iter().rev().take(available).cloned().collect::<Vec<_>>().into_iter().rev().collect();
        }
        Vec::new()
    }

    pub fn reset_esp(&self, session_id: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            let mut writer = session.port_writer.lock().unwrap();
            if let Some(ref mut port) = *writer {
                port.write_data_terminal_ready(false).map_err(|e| e.to_string())?;
                port.write_request_to_send(true).map_err(|e| e.to_string())?;
                thread::sleep(Duration::from_millis(100));
                port.write_request_to_send(false).map_err(|e| e.to_string())?;

                let marker = format!("⚡ [DONANIMSAL RESET] EN pinine 100ms darbe gönderildi - Cihaz yeniden başlatıldı ({})", Local::now().format("%H:%M:%S%.3f"));
                session.recent_lines.lock().unwrap().push_back(marker);
                return Ok(());
            }
        }
        Err("Bağlantı aktif değil".to_string())
    }

    pub fn boot_esp(&self, session_id: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(session_id) {
            let mut writer = session.port_writer.lock().unwrap();
            if let Some(ref mut port) = *writer {
                port.write_data_terminal_ready(true).map_err(|e| e.to_string())?; // IO0 LOW
                port.write_request_to_send(true).map_err(|e| e.to_string())?;   // EN LOW
                thread::sleep(Duration::from_millis(100));
                port.write_request_to_send(false).map_err(|e| e.to_string())?;  // EN HIGH
                thread::sleep(Duration::from_millis(50));
                port.write_data_terminal_ready(false).map_err(|e| e.to_string())?; // IO0 HIGH

                let marker = format!("⚡ [BOOTLOADER MODU] IO0 LOW + EN darbesi verildi - Download Modu ({})", Local::now().format("%H:%M:%S%.3f"));
                session.recent_lines.lock().unwrap().push_back(marker);
                return Ok(());
            }
        }
        Err("Bağlantı aktif değil".to_string())
    }

    pub fn probe_port(&self, port_name: &str, baud_rate: u32) -> Result<PortProbeResult, String> {
        let ports = self.scan_ports("");
        let dev_info = ports.into_iter().find(|p| p.port_name == port_name);

        let mut chip_family = "Generic UART".to_string();
        if let Some(ref d) = dev_info {
            if let Some(vid) = d.vid {
                if vid == 0x303A {
                    chip_family = match d.pid {
                        Some(0x1001) => "ESP32-S2/S3 (Native USB CDC)".to_string(),
                        Some(0x1002) => "ESP32-C3/C6 (Native USB CDC)".to_string(),
                        Some(0x1003) => "ESP32-H2 (Native USB CDC)".to_string(),
                        Some(0x1004) | Some(0x1005) => "ESP32-P4 (Native USB CDC)".to_string(),
                        _ => "Espressif Native USB".to_string(),
                    };
                } else if vid == 0x10C4 {
                    chip_family = "Silicon Labs CP210x (ESP32 UART)".to_string();
                } else if vid == 0x1A86 {
                    chip_family = "WCH CH340/CH343 (ESP32 UART)".to_string();
                } else if vid == 0x0403 {
                    chip_family = "FTDI FT232R/FT2232H (ESP-Prog)".to_string();
                }
            }
        }

        // If port is already open in an active session, probe gracefully without 'Device busy' error
        {
            let map = self.sessions.lock().unwrap();
            if let Some(session) = map.values().find(|s| s.port_name == port_name) {
                let sample = session.recent_lines.lock().unwrap().back().cloned().unwrap_or_default();
                return Ok(PortProbeResult {
                    port_name: port_name.to_string(),
                    baud_rate: session.baud_rate,
                    responsive: true,
                    response_sample: sample,
                    chip_family,
                    device_info: dev_info,
                });
            }
        }

        let port_builder = serialport::new(port_name, baud_rate)
            .timeout(Duration::from_millis(250));

        let mut port = port_builder.open().map_err(|e| format!("Port açılamadı {}: {}", port_name, e))?;

        let _ = port.write_all(b"\r\n");
        let mut buffer = [0u8; 512];
        let bytes_read = port.read(&mut buffer).unwrap_or(0);
        let response = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();

        Ok(PortProbeResult {
            port_name: port_name.to_string(),
            baud_rate,
            responsive: bytes_read > 0,
            response_sample: response.trim().to_string(),
            chip_family,
            device_info: dev_info,
        })
    }

    pub fn get_recent_lines(&self, session_id: Option<&str>, tail: usize) -> Vec<String> {
        let map = self.sessions.lock().unwrap();
        if let Some(s_id) = session_id {
            if let Some(session) = map.get(s_id) {
                let q = session.recent_lines.lock().unwrap();
                let count = tail.min(q.len());
                return q.iter().rev().take(count).cloned().collect::<Vec<_>>().into_iter().rev().collect();
            }
        }
        // Fallback: take from first session
        if let Some((_, session)) = map.iter().next() {
            let q = session.recent_lines.lock().unwrap();
            let count = tail.min(q.len());
            return q.iter().rev().take(count).cloned().collect::<Vec<_>>().into_iter().rev().collect();
        }
        Vec::new()
    }

    pub fn get_active_sessions_info(&self) -> Vec<ActiveSessionInfo> {
        let map = self.sessions.lock().unwrap();
        map.values().map(|s| ActiveSessionInfo {
            session_id: s.session_id.clone(),
            port_name: s.port_name.clone(),
            baud_rate: s.baud_rate,
            is_running: s.is_running.load(Ordering::SeqCst),
            rx_bytes: s.rx_bytes.load(Ordering::SeqCst),
            tx_bytes: s.tx_bytes.load(Ordering::SeqCst),
            lines_count: s.recent_lines.lock().unwrap().len(),
        }).collect()
    }

    pub fn get_first_session_id(&self) -> Option<String> {
        let map = self.sessions.lock().unwrap();
        map.keys().next().cloned()
    }

    pub fn get_lines_count(&self, session_id: Option<&str>) -> usize {
        let map = self.sessions.lock().unwrap();
        if let Some(s_id) = session_id {
            if let Some(session) = map.get(s_id) {
                return session.recent_lines.lock().unwrap().len();
            }
        }
        if let Some((_, session)) = map.iter().next() {
            return session.recent_lines.lock().unwrap().len();
        }
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serial_manager_init() {
        let manager = SerialManager::new();
        let ports = manager.scan_ports("");
        println!("== Discovered Ports ({} found) ==", ports.len());
        for p in &ports {
            println!("  Port: {} | Display: {} | ESP: {} | Arduino: {}", p.port_name, p.display_name, p.is_esp, p.is_arduino);
        }
    }
}
