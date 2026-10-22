use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::archive::list_archives;
use crate::serial::SerialManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCommandLog {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub endpoint: String,
    pub payload: String,
    pub response: String,
    pub status: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiModelSession {
    pub id: String,
    pub model_name: String,
    pub client_id: String,
    pub active_port: Option<String>,
    pub session_id: Option<String>,
    pub last_seen_sec: u64,
    pub last_command: String,
    pub registered_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiPinInfo {
    pub id: String,
    pub session_id: String,
    pub line_index: usize,
    pub timestamp: String,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

#[derive(Clone)]
pub struct AiServerState {
    pub serial_manager: Arc<SerialManager>,
    pub app_handle: AppHandle,
    pub ai_logs: Arc<Mutex<Vec<AiCommandLog>>>,
    pub pins: Arc<Mutex<Vec<AiPinInfo>>>,
    pub filters: Arc<Mutex<Vec<String>>>,
    pub triggers: Arc<Mutex<Vec<String>>>,
    pub ai_models: Arc<Mutex<HashMap<String, AiModelSession>>>,
}

pub const AI_SKILL_DOCUMENT: &str = r##"# 🤖 Serial Monitor Pro - AI Agent Skill Guide

Serial Monitor Pro provides an autonomous Headless REST API and CLI tool (`smp` or `./smp`) for AI agents, LLMs, and terminal scripts to interact with embedded UART hardware (ESP32, Arduino, STM32, Pico).
*Note: `smp` is installed to system PATH (`~/.local/bin/smp`) automatically on startup, so you can execute `smp <command>` directly from ANY working directory.*

## 📡 Base URL
`http://127.0.0.1:4567` (or execute commands via `smp <command>`)

---

## 🛠️ Commands & Tool Endpoints

### 1. `GET /api/status` (or `./smp status`)
Returns the complete state of the serial monitor:
- Active panels & open ports
- Baud rates & connection statuses
- RX / TX byte counts & line counts
- Active filters, triggers, and pins count

### 2. `GET /api/ports` (or `./smp ports`)
Scans host USB/UART ports. Identifies ESP32, Arduino, CH340, CP2102, FTDI chips with VID/PID and category.

### 3. `POST /api/connect` (or `./smp connect [port|"auto"] [baud] [--reset]`)
Connects to a serial port.
- JSON body: `{"port": "auto"|"/dev/ttyUSB0", "baud": 115200, "reset": false}`
- If `port` is omitted or `"auto"`, automatically detects and connects to the plugged ESP32/UART device!
- If already connected, gracefully returns the existing active session without error.

### 4. `POST /api/disconnect` (or `./smp disconnect [session_id]`)
Disconnects the port cleanly.
- JSON body: `{"session_id": "session_xxx"}` (or empty for default session).

### 5. `GET /api/logs` (or `./smp logs [--tail N] [--filter <term>]`)
Fetches the latest N log lines from the device.
- Query params: `tail=50`, `filter=HEAP`, `session_id=...`
- Returns: `{"lines": ["line 1", "line 2", ...], "count": 50}`

### 6. `POST /api/send` (or `./smp send <command> [--delay ms] [--raw] [-f file]`)
Sends single-line or multiline UART data to the connected device.
- JSON body:
  - `{"data": "AT+GMR\r\n", "session_id": "..."}` (single line)
  - `{"lines": ["AT+GMR", "AT+CIFSR"], "line_delay_ms": 50}` (multiline with inter-line delay)
  - `{"data": "print(1)\nprint(2)", "line_delay_ms": 30, "eol": "\r\n"}` (multiline string)
  - `{"data": "\x01\x02", "raw": true}` (raw bytes)

### 7. `POST /api/exec` (or `./smp exec <command> [--timeout ms] [--expect <text>] [--delay ms]`)
**⚡ Interactive Serial Execution**: Sends command(s), waits for device response lines, and returns them immediately!
- JSON body: `{"command": "help", "timeout_ms": 2500, "expect": ">>>", "line_delay_ms": 30}`
- Returns: `{"ok": true, "command": "help", "response_lines": [...], "response_text": "...", "duration_ms": 140, "matched_expect": true}`

### 8. `POST /api/shell` (or `./smp shell <command>` / `./smp sh <command>`)
**💻 Cross-Platform Local Shell Execution**: Runs system shell command (Windows PowerShell / Linux bash/sh) and returns stdout/stderr.
- JSON body: `{"command": "idf.py build", "cwd": "/path", "timeout_sec": 60}`
- Returns: `{"ok": true, "stdout": "...", "stderr": "...", "exit_code": 0, "duration_ms": 250, "platform": "linux"|"windows"}`

### 9. `POST /api/reset` (or `./smp reset`)
Executes an ESP32 Hardware Reset by pulsing the EN line.

### 10. `POST /api/boot` (or `./smp boot`)
Forces the ESP32 into ROM Bootloader / Download Mode (IO0 low + EN pulse).

### 11. `POST /api/pin` (or `./smp pin [line_index|"last"] [note] [--preset 1-6]`)
Tags and bookmarks a log line (or latest received line if omitted or "last") with timestamp, note, preset shape, and emoji.
- JSON body: `{"line_index": "last"|42, "note": "Crash occurred here", "shape": "circle", "color": "#a855f7", "emoji": "😡", "description": "ekran hatası"}`
- Supports presets (1-6) and shapes: circle, square, triangle, pentagon, diamond.

### 12. `GET /api/pins` (or `./smp pins`)
Lists all bookmarked pins and notes across panels.

### 13. `DELETE /api/pin` (or `./smp pin remove <id>`)
Removes a pin by ID or line index.

### 14. `POST /api/filter` (or `./smp filter add <tags...>`)
Adds or removes filter tags in the UI.
- JSON body: `{"action": "add"|"remove"|"clear", "tags": ["HEAP", "Guru Meditation"]}`
- Supports tag context window filters: `tag+5`, `tag+-5`, `tag:ekran hatası+3`

### 15. `POST /api/trigger` (or `./smp trigger add <tag>`)
Sets an armed target trigger word.

### 16. `GET /api/archives` (or `./smp archives`)
Lists all recorded session log archives on local disk.

### 17. `GET /api/ai-logs` (or `./smp ai-logs`)
Returns the audit trail of all commands executed by AI models, visible live in the UI.

### 18. `GET /api/ai-models` (or `./smp ai-models`)
Cross-model peer visibility: lists connected AI models, their active ports, sessions, and last activity.
- Agents can supply headers `X-AI-Model: <name>` and `X-AI-Client: <id>` or query `?model=...`.

---

## 💡 Quick Examples (cURL or CLI):
```bash
# Auto-connect to plugged ESP32
smp connect auto
# Interactive query: send command and print device response immediately!
smp exec "help"
# Send multiline MicroPython script with 30ms delay
smp send -f script.py --delay 30
# Run local shell tool (e.g. esptool or idf)
smp shell "esptool.py chip_id"
# Read logs with tag context window (+- 5 lines)
smp logs --filter "tag+5"
# Tag a crash line with preset 1
smp pin --preset 1
```
"##;

pub fn start_ai_http_server(
    app: AppHandle,
    serial_manager: Arc<SerialManager>,
) {
    let state = AiServerState {
        serial_manager,
        app_handle: app,
        ai_logs: Arc::new(Mutex::new(Vec::new())),
        pins: Arc::new(Mutex::new(Vec::new())),
        filters: Arc::new(Mutex::new(Vec::new())),
        triggers: Arc::new(Mutex::new(Vec::new())),
        ai_models: Arc::new(Mutex::new(HashMap::new())),
    };

    std::thread::Builder::new()
        .name("ai-http-server".to_string())
        .spawn(move || {
            let rt = match tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
            {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("❌ [AI Agent Server] Failed to create Tokio runtime: {}", e);
                    return;
                }
            };

            rt.block_on(async move {
                // Try port 4567, or 4568..4580 if in use
                let mut port = 4567;
                let listener = loop {
                    match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                        Ok(l) => {
                            println!("🚀 [AI Agent Server] Listening on http://127.0.0.1:{}", port);
                            break l;
                        }
                        Err(_) => {
                            port += 1;
                            if port > 4580 {
                                eprintln!("❌ [AI Agent Server] Failed to bind to ports 4567-4580");
                                return;
                            }
                        }
                    }
                };

                loop {
                    match listener.accept().await {
                        Ok((mut stream, _addr)) => {
                            let st = state.clone();
                            tokio::spawn(async move {
                                let mut buffer = [0u8; 16384];
                                let bytes_read = match stream.read(&mut buffer).await {
                                    Ok(n) if n > 0 => n,
                                    _ => return,
                                };

                                let raw_req = String::from_utf8_lossy(&buffer[..bytes_read]);
                                let (res_status, res_type, res_body) = handle_http_request(&st, &raw_req).await;

                                let http_resp = format!(
                                    "HTTP/1.1 {}\r\nContent-Type: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                    res_status,
                                    res_type,
                                    res_body.as_bytes().len(),
                                    res_body
                                );

                                let _ = stream.write_all(http_resp.as_bytes()).await;
                                let _ = stream.flush().await;
                            });
                        }
                        Err(e) => {
                            eprintln!("AI server accept error: {}", e);
                        }
                    }
                }
            });
        })
        .expect("Failed to spawn ai-http-server thread");
}

fn record_ai_activity(
    state: &AiServerState,
    model_name: Option<String>,
    client_id: Option<String>,
    active_port: Option<String>,
    session_id: Option<String>,
    cmd_name: &str,
) {
    if model_name.is_none() && client_id.is_none() && cmd_name.starts_with("GET /api/status") {
        return;
    }

    let cid = client_id.unwrap_or_else(|| {
        model_name.clone().unwrap_or_else(|| "agent_anonymous".to_string())
    });
    let mname = model_name.unwrap_or_else(|| cid.clone());

    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut models = state.ai_models.lock().unwrap();
    let entry = models.entry(cid.clone()).or_insert_with(|| AiModelSession {
        id: format!("aim_{}", cid),
        model_name: mname.clone(),
        client_id: cid.clone(),
        active_port: None,
        session_id: None,
        last_seen_sec: now_ts,
        last_command: cmd_name.to_string(),
        registered_at: Local::now().format("%H:%M:%S").to_string(),
    });

    entry.model_name = mname;
    entry.last_seen_sec = now_ts;
    entry.last_command = cmd_name.to_string();
    if active_port.is_some() {
        entry.active_port = active_port;
    }
    if session_id.is_some() {
        entry.session_id = session_id;
    }

    let all_models: Vec<AiModelSession> = models.values().cloned().collect();
    drop(models);

    let _ = state.app_handle.emit("ai-models-updated", all_models);
}

async fn handle_http_request(
    state: &AiServerState,
    req: &str,
) -> (&'static str, &'static str, String) {
    let mut lines = req.lines();
    let first_line = match lines.next() {
        Some(l) => l,
        None => return ("400 Bad Request", "text/plain", "Empty request".into()),
    };

    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let full_path = parts.next().unwrap_or("/");

    // CORS preflight
    if method == "OPTIONS" {
        return ("200 OK", "text/plain", "OK".into());
    }

    let (path, query) = if let Some(idx) = full_path.find('?') {
        (&full_path[..idx], &full_path[idx + 1..])
    } else {
        (full_path, "")
    };

    // Extract headers (e.g. X-AI-Model, X-AI-Client)
    let mut header_model = None;
    let mut header_client = None;
    for l in req.lines().skip(1) {
        if l.is_empty() {
            break;
        }
        if let Some((k, v)) = l.split_once(':') {
            let k = k.trim().to_lowercase();
            let v = v.trim();
            if k == "x-ai-model" || k == "x-model" {
                header_model = Some(v.to_string());
            } else if k == "x-ai-client" || k == "x-client-id" {
                header_client = Some(v.to_string());
            }
        }
    }

    // Check query params for model & client fallback
    for pair in query.split('&') {
        let mut kv = pair.split('=');
        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
            if k == "model" && header_model.is_none() {
                header_model = Some(v.to_string());
            } else if k == "client" && header_client.is_none() {
                header_client = Some(v.to_string());
            }
        }
    }

    // Extract body if any
    let body = if let Some(idx) = req.find("\r\n\r\n") {
        &req[idx + 4..]
    } else if let Some(idx) = req.find("\n\n") {
        &req[idx + 2..]
    } else {
        ""
    };

    let (status, content_type, response_body) = match (method, path) {
        // 1. Skill Guide
        ("GET", "/") | ("GET", "/skill") | ("GET", "/help") | ("GET", "/api/skill") | ("GET", "/api/help") => {
            ("200 OK", "text/markdown; charset=utf-8", AI_SKILL_DOCUMENT.to_string())
        }

        // 2. Status
        ("GET", "/api/status") => {
            let sessions = state.serial_manager.get_active_sessions_info();
            let ports = state.serial_manager.scan_ports("");
            let pins_list = state.pins.lock().unwrap().clone();
            let filters_list = state.filters.lock().unwrap().clone();
            let triggers_list = state.triggers.lock().unwrap().clone();
            let models_map = state.ai_models.lock().unwrap();
            let now_ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            let connected_ai_models: Vec<serde_json::Value> = models_map
                .values()
                .map(|m| {
                    serde_json::json!({
                        "id": m.id,
                        "model_name": m.model_name,
                        "client_id": m.client_id,
                        "active_port": m.active_port,
                        "session_id": m.session_id,
                        "last_seen_seconds_ago": now_ts.saturating_sub(m.last_seen_sec),
                        "last_command": m.last_command,
                        "registered_at": m.registered_at,
                    })
                })
                .collect();
            drop(models_map);

            let payload = serde_json::json!({
                "app": "ESP32 Serial Monitor Pro",
                "version": "2.0.0",
                "status": "ready",
                "active_sessions": sessions,
                "available_ports_count": ports.len(),
                "connected_ai_models": connected_ai_models,
                "filters": filters_list,
                "triggers": triggers_list,
                "pins": pins_list,
            });
            ("200 OK", "application/json", payload.to_string())
        }

        // 3. Scan Ports
        ("GET", "/api/ports") => {
            let ports = state.serial_manager.scan_ports("");
            ("200 OK", "application/json", serde_json::to_string_pretty(&ports).unwrap_or_default())
        }

        // 4. Connect Port (Supports auto-detection & graceful reconnect)
        ("POST", "/api/connect") => {
            #[derive(Deserialize)]
            struct ConnectReq {
                port: Option<String>,
                baud: Option<u32>,
                reset: Option<bool>,
                session_id: Option<String>,
                model_name: Option<String>,
                client_id: Option<String>,
            }

            match serde_json::from_str::<ConnectReq>(body) {
                Ok(req_data) => {
                    let available = state.serial_manager.scan_ports("");
                    let target_port = match req_data.port.as_deref() {
                        Some(p) if !p.trim().is_empty() && p.to_lowercase() != "auto" => p.to_string(),
                        _ => {
                            let best = available.iter().find(|d| d.is_esp)
                                .or_else(|| available.iter().find(|d| d.is_arduino))
                                .or_else(|| available.first());
                            match best {
                                Some(dev) => dev.port_name.clone(),
                                None => {
                                    let resp = serde_json::json!({
                                        "ok": false,
                                        "error": "Bağlanacak seri port bulunamadı (Cihaz takılı mı?)"
                                    });
                                    return ("400 Bad Request", "application/json", resp.to_string());
                                }
                            }
                        }
                    };

                    let baud = req_data.baud.unwrap_or(115200);
                    let reset = req_data.reset.unwrap_or(false);

                    // Check if already connected
                    let existing = state.serial_manager.get_active_sessions_info().into_iter().find(|s| s.port_name == target_port);
                    if let Some(sess) = existing {
                        let eff_model = req_data.model_name.or(header_model.clone());
                        let eff_client = req_data.client_id.or(header_client.clone());
                        record_ai_activity(
                            state,
                            eff_model,
                            eff_client,
                            Some(target_port.clone()),
                            Some(sess.session_id.clone()),
                            "CONNECT (EXISTING)",
                        );
                        let resp = serde_json::json!({
                            "ok": true,
                            "already_connected": true,
                            "session_id": sess.session_id,
                            "port": target_port,
                            "baud": sess.baud_rate,
                            "message": "Cihaz zaten bağlı, mevcut oturum döndürüldü."
                        });
                        return ("200 OK", "application/json", resp.to_string());
                    }

                    let s_id = req_data.session_id.unwrap_or_else(|| {
                        format!("session_ai_{}", Local::now().format("%Y%m%d_%H%M%S"))
                    });

                    match state.serial_manager.connect_session(
                        state.app_handle.clone(),
                        s_id.clone(),
                        target_port.clone(),
                        baud,
                        reset,
                    ) {
                        Ok(_) => {
                            let eff_model = req_data.model_name.or(header_model.clone());
                            let eff_client = req_data.client_id.or(header_client.clone());
                            record_ai_activity(
                                state,
                                eff_model,
                                eff_client,
                                Some(target_port.clone()),
                                Some(s_id.clone()),
                                "CONNECT",
                            );

                            let _ = state.app_handle.emit(
                                "ai-action",
                                serde_json::json!({
                                    "type": "connect",
                                    "sessionId": s_id,
                                    "port": target_port,
                                    "baudRate": baud,
                                    "resetOnConnect": reset
                                }),
                            );
                            let resp = serde_json::json!({
                                "ok": true,
                                "session_id": s_id,
                                "port": target_port,
                                "baud": baud
                            });
                            ("200 OK", "application/json", resp.to_string())
                        }
                        Err(e) => {
                            let resp = serde_json::json!({ "ok": false, "error": e });
                            ("400 Bad Request", "application/json", resp.to_string())
                        }
                    }
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 5. Disconnect Port
        ("POST", "/api/disconnect") => {
            #[derive(Deserialize)]
            struct DisconnectReq {
                session_id: Option<String>,
            }

            let s_id = serde_json::from_str::<DisconnectReq>(body)
                .ok()
                .and_then(|r| r.session_id)
                .or_else(|| state.serial_manager.get_first_session_id());

            if let Some(id) = s_id {
                let _ = state.serial_manager.disconnect_session(&id);
                let _ = state.app_handle.emit(
                    "ai-action",
                    serde_json::json!({ "type": "disconnect", "sessionId": id }),
                );
                let resp = serde_json::json!({ "ok": true, "session_id": id });
                ("200 OK", "application/json", resp.to_string())
            } else {
                let resp = serde_json::json!({ "ok": false, "error": "No active session to disconnect" });
                ("400 Bad Request", "application/json", resp.to_string())
            }
        }

        // 6. Send Serial Data (Supports Single-line & Multiline with Delay)
        ("POST", "/api/send") => {
            #[derive(Deserialize)]
            struct SendReq {
                data: Option<String>,
                lines: Option<Vec<String>>,
                line_delay_ms: Option<u64>,
                eol: Option<String>,
                raw: Option<bool>,
                session_id: Option<String>,
            }

            match serde_json::from_str::<SendReq>(body) {
                Ok(req_data) => {
                    let s_id = req_data
                        .session_id
                        .or_else(|| state.serial_manager.get_first_session_id());

                    if let Some(id) = s_id {
                        let eol = req_data.eol.unwrap_or_else(|| "\r\n".to_string());
                        let delay = req_data.line_delay_ms.unwrap_or(0);

                        let lines_to_send: Vec<String> = if let Some(l) = req_data.lines {
                            l
                        } else if let Some(d) = req_data.data {
                            if req_data.raw == Some(true) {
                                match state.serial_manager.send_data(&id, &d) {
                                    Ok(_) => {
                                        let resp = serde_json::json!({
                                            "ok": true,
                                            "session_id": id,
                                            "bytes_sent": d.len(),
                                            "raw": true
                                        });
                                        return ("200 OK", "application/json", resp.to_string());
                                    }
                                    Err(e) => {
                                        let resp = serde_json::json!({ "ok": false, "error": e });
                                        return ("400 Bad Request", "application/json", resp.to_string());
                                    }
                                }
                            }
                            d.lines().map(|s| s.trim_end_matches('\r').to_string()).collect()
                        } else {
                            Vec::new()
                        };

                        if lines_to_send.is_empty() {
                            let resp = serde_json::json!({ "ok": false, "error": "Gönderilecek veri (data veya lines) bulunamadı" });
                            return ("400 Bad Request", "application/json", resp.to_string());
                        }

                        match state.serial_manager.send_multiline(&id, &lines_to_send, &eol, delay) {
                            Ok(bytes) => {
                                let resp = serde_json::json!({
                                    "ok": true,
                                    "session_id": id,
                                    "lines_count": lines_to_send.len(),
                                    "bytes_sent": bytes,
                                    "line_delay_ms": delay
                                });
                                ("200 OK", "application/json", resp.to_string())
                            }
                            Err(e) => {
                                let resp = serde_json::json!({ "ok": false, "error": e });
                                ("400 Bad Request", "application/json", resp.to_string())
                            }
                        }
                    } else {
                        let resp = serde_json::json!({ "ok": false, "error": "Bağlı aktif oturum yok" });
                        ("400 Bad Request", "application/json", resp.to_string())
                    }
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 7. Interactive Command Execution (Send & Collect Output)
        ("POST", "/api/exec") => {
            #[derive(Deserialize)]
            struct ExecReq {
                command: Option<String>,
                data: Option<String>,
                lines: Option<Vec<String>>,
                timeout_ms: Option<u64>,
                expect: Option<String>,
                line_delay_ms: Option<u64>,
                eol: Option<String>,
                session_id: Option<String>,
            }

            match serde_json::from_str::<ExecReq>(body) {
                Ok(ereq) => {
                    let s_id = ereq
                        .session_id
                        .or_else(|| state.serial_manager.get_first_session_id());

                    if let Some(id) = s_id {
                        let timeout = Duration::from_millis(ereq.timeout_ms.unwrap_or(2000).clamp(100, 60000));
                        let delay = ereq.line_delay_ms.unwrap_or(25);
                        let eol = ereq.eol.unwrap_or_else(|| "\r\n".to_string());

                        let lines_to_send: Vec<String> = if let Some(l) = ereq.lines {
                            l
                        } else if let Some(c) = ereq.command.or(ereq.data) {
                            c.lines().map(|s| s.trim_end_matches('\r').to_string()).collect()
                        } else {
                            Vec::new()
                        };

                        if lines_to_send.is_empty() {
                            let resp = serde_json::json!({ "ok": false, "error": "Komut veya veri (command/data/lines) belirtilmedi" });
                            return ("400 Bad Request", "application/json", resp.to_string());
                        }

                        let start_count = state.serial_manager.get_total_lines_count(&id).unwrap_or(0);
                        let start_time = std::time::Instant::now();

                        if let Err(e) = state.serial_manager.send_multiline(&id, &lines_to_send, &eol, delay) {
                            let resp = serde_json::json!({ "ok": false, "error": e });
                            return ("400 Bad Request", "application/json", resp.to_string());
                        }

                        let mut matched_expect = false;
                        let mut response_lines = Vec::new();

                        while start_time.elapsed() < timeout {
                            std::thread::sleep(Duration::from_millis(25));
                            let current = state.serial_manager.get_lines_since(&id, start_count);
                            if let Some(ref exp) = ereq.expect {
                                if current.iter().any(|l| l.contains(exp)) {
                                    matched_expect = true;
                                    response_lines = current;
                                    break;
                                }
                            }
                            response_lines = current;
                        }

                        let duration_ms = start_time.elapsed().as_millis() as u64;
                        let response_text = response_lines.join("\n");

                        let resp = serde_json::json!({
                            "ok": true,
                            "command": lines_to_send.join("\n"),
                            "response_lines": response_lines,
                            "response_text": response_text,
                            "line_count": response_lines.len(),
                            "duration_ms": duration_ms,
                            "matched_expect": matched_expect,
                            "session_id": id
                        });
                        ("200 OK", "application/json", resp.to_string())
                    } else {
                        let resp = serde_json::json!({ "ok": false, "error": "Bağlı aktif oturum yok" });
                        ("400 Bad Request", "application/json", resp.to_string())
                    }
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 8. Cross-Platform Local Shell Command Execution
        ("POST", "/api/shell") => {
            #[derive(Deserialize)]
            struct ShellReq {
                command: String,
                cwd: Option<String>,
                timeout_sec: Option<u64>,
            }

            match serde_json::from_str::<ShellReq>(body) {
                Ok(sreq) => {
                    match crate::shell::execute_shell(&sreq.command, sreq.cwd.as_deref(), sreq.timeout_sec) {
                        Ok(result) => {
                            let resp = serde_json::to_string(&result).unwrap_or_default();
                            ("200 OK", "application/json", resp)
                        }
                        Err(e) => {
                            let resp = serde_json::json!({ "ok": false, "error": e });
                            ("500 Internal Server Error", "application/json", resp.to_string())
                        }
                    }
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 7. Read Recent Logs
        ("GET", "/api/logs") => {
            let mut tail = 50;
            let mut filter_term = None;
            let mut session_id = None;

            for pair in query.split('&') {
                let mut kv = pair.split('=');
                if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                    if k == "tail" {
                        if let Ok(n) = v.parse::<usize>() {
                            tail = n;
                        }
                    } else if k == "filter" {
                        filter_term = Some(v.to_lowercase());
                    } else if k == "session_id" {
                        session_id = Some(v.to_string());
                    }
                }
            }

            let lines = state
                .serial_manager
                .get_recent_lines(session_id.as_deref(), tail);

            let filtered_lines: Vec<String> = if let Some(ref term) = filter_term {
                lines
                    .into_iter()
                    .filter(|l| l.to_lowercase().contains(term))
                    .collect()
            } else {
                lines
            };

            let resp = serde_json::json!({
                "count": filtered_lines.len(),
                "lines": filtered_lines,
            });
            ("200 OK", "application/json", resp.to_string())
        }

        // 8. Hardware Reset (EN)
        ("POST", "/api/reset") => {
            #[derive(Deserialize)]
            struct ResetReq {
                session_id: Option<String>,
            }
            let s_id = serde_json::from_str::<ResetReq>(body)
                .ok()
                .and_then(|r| r.session_id)
                .or_else(|| state.serial_manager.get_first_session_id());

            if let Some(id) = s_id {
                match state.serial_manager.reset_esp(&id) {
                    Ok(_) => {
                        let resp = serde_json::json!({ "ok": true, "message": "ESP32 Hardware Reset (EN) triggered" });
                        ("200 OK", "application/json", resp.to_string())
                    }
                    Err(e) => {
                        let resp = serde_json::json!({ "ok": false, "error": e });
                        ("400 Bad Request", "application/json", resp.to_string())
                    }
                }
            } else {
                let resp = serde_json::json!({ "ok": false, "error": "No active session connected" });
                ("400 Bad Request", "application/json", resp.to_string())
            }
        }

        // 9. Bootloader Mode (IO0)
        ("POST", "/api/boot") => {
            #[derive(Deserialize)]
            struct BootReq {
                session_id: Option<String>,
            }
            let s_id = serde_json::from_str::<BootReq>(body)
                .ok()
                .and_then(|r| r.session_id)
                .or_else(|| state.serial_manager.get_first_session_id());

            if let Some(id) = s_id {
                match state.serial_manager.boot_esp(&id) {
                    Ok(_) => {
                        let resp = serde_json::json!({ "ok": true, "message": "ESP32 Bootloader (IO0) triggered" });
                        ("200 OK", "application/json", resp.to_string())
                    }
                    Err(e) => {
                        let resp = serde_json::json!({ "ok": false, "error": e });
                        ("400 Bad Request", "application/json", resp.to_string())
                    }
                }
            } else {
                let resp = serde_json::json!({ "ok": false, "error": "No active session connected" });
                ("400 Bad Request", "application/json", resp.to_string())
            }
        }

        // 10. Filter Management
        ("POST", "/api/filter") => {
            #[derive(Deserialize)]
            struct FilterReq {
                action: String, // "add", "remove", "clear"
                tags: Option<Vec<String>>,
            }

            match serde_json::from_str::<FilterReq>(body) {
                Ok(freq) => {
                    let mut filters = state.filters.lock().unwrap();
                    let tags = freq.tags.unwrap_or_default();
                    if freq.action == "add" {
                        for t in &tags {
                            if !filters.contains(t) {
                                filters.push(t.clone());
                            }
                        }
                    } else if freq.action == "remove" {
                        filters.retain(|t| !tags.contains(t));
                    } else if freq.action == "clear" {
                        filters.clear();
                    }

                    let _ = state.app_handle.emit(
                        "ai-action",
                        serde_json::json!({
                            "type": "filter",
                            "action": freq.action,
                            "tags": tags,
                            "allFilters": filters.clone()
                        }),
                    );

                    let resp = serde_json::json!({ "ok": true, "filters": filters.clone() });
                    ("200 OK", "application/json", resp.to_string())
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 11. Pin Management (Add Pin with optional shape, color, emoji, description)
        // 11. Add Pin / Tag
        ("POST", "/api/pin") => {
            #[derive(Deserialize)]
            struct PinReq {
                line_index: Option<serde_json::Value>,
                note: Option<String>,
                session_id: Option<String>,
                shape: Option<String>,
                color: Option<String>,
                emoji: Option<String>,
                description: Option<String>,
                key: Option<String>,
            }

            match serde_json::from_str::<PinReq>(body) {
                Ok(preq) => {
                    let timestamp = Local::now().format("%H:%M:%S").to_string();
                    let note_text = preq
                        .note
                        .or_else(|| preq.description.clone())
                        .filter(|n| !n.trim().is_empty())
                        .unwrap_or_else(|| format!("[{}] Pin eklendi", timestamp));

                    let pin_id = format!("pin_{}", Local::now().timestamp_millis());
                    let s_id = preq
                        .session_id
                        .or_else(|| state.serial_manager.get_first_session_id())
                        .unwrap_or_else(|| "default".to_string());

                    let mut resolved_line_index: usize = 0;
                    let mut is_last_line = false;

                    match &preq.line_index {
                        Some(serde_json::Value::Number(n)) => {
                            if let Some(val) = n.as_i64() {
                                if val < 0 {
                                    is_last_line = true;
                                } else {
                                    resolved_line_index = val as usize;
                                }
                            }
                        }
                        Some(serde_json::Value::String(s)) => {
                            if s == "last" || s == "-1" {
                                is_last_line = true;
                            } else if let Ok(val) = s.parse::<i64>() {
                                if val < 0 {
                                    is_last_line = true;
                                } else {
                                    resolved_line_index = val as usize;
                                }
                            }
                        }
                        None | Some(serde_json::Value::Null) => {
                            is_last_line = true;
                        }
                        _ => {}
                    }

                    if is_last_line {
                        let total = state.serial_manager.get_lines_count(Some(&s_id));
                        resolved_line_index = if total > 0 { total - 1 } else { 0 };
                    }

                    let pin_info = AiPinInfo {
                        id: pin_id.clone(),
                        session_id: s_id.clone(),
                        line_index: resolved_line_index,
                        timestamp: timestamp.clone(),
                        note: note_text.clone(),
                        shape: preq.shape.clone(),
                        color: preq.color.clone(),
                        emoji: preq.emoji.clone(),
                        description: preq.description.clone(),
                        key: preq.key.clone(),
                    };

                    {
                        let mut pins = state.pins.lock().unwrap();
                        pins.push(pin_info.clone());
                    }

                    let _ = state.app_handle.emit(
                        "ai-action",
                        serde_json::json!({
                            "type": "add_pin",
                            "sessionId": s_id,
                            "lineIndex": resolved_line_index,
                            "isLastLine": is_last_line,
                            "note": note_text,
                            "timestamp": timestamp,
                            "pinId": pin_id,
                            "shape": preq.shape,
                            "color": preq.color,
                            "emoji": preq.emoji,
                            "description": preq.description,
                            "key": preq.key
                        }),
                    );

                    let resp = serde_json::json!({
                        "ok": true,
                        "pin": pin_info,
                        "is_last_line": is_last_line
                    });
                    ("200 OK", "application/json", resp.to_string())
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 12. List Pins
        ("GET", "/api/pins") => {
            let pins = state.pins.lock().unwrap().clone();
            ("200 OK", "application/json", serde_json::to_string_pretty(&pins).unwrap_or_default())
        }

        // 13. Delete Pin
        ("DELETE", "/api/pin") => {
            #[derive(Deserialize)]
            struct DelPinReq {
                pin_id: Option<String>,
                line_index: Option<usize>,
            }

            match serde_json::from_str::<DelPinReq>(body) {
                Ok(dreq) => {
                    let mut pins = state.pins.lock().unwrap();
                    pins.retain(|p| {
                        if let Some(ref id) = dreq.pin_id {
                            if &p.id == id {
                                return false;
                            }
                        }
                        if let Some(idx) = dreq.line_index {
                            if p.line_index == idx {
                                return false;
                            }
                        }
                        true
                    });

                    let _ = state.app_handle.emit(
                        "ai-action",
                        serde_json::json!({
                            "type": "remove_pin",
                            "pinId": dreq.pin_id,
                            "lineIndex": dreq.line_index
                        }),
                    );

                    let resp = serde_json::json!({ "ok": true, "remaining_pins": pins.len() });
                    ("200 OK", "application/json", resp.to_string())
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 14. Archives List
        ("GET", "/api/archives") => {
            let archives = list_archives();
            ("200 OK", "application/json", serde_json::to_string_pretty(&archives).unwrap_or_default())
        }

        // 15. AI Command Audit Logs
        ("GET", "/api/ai-logs") => {
            let logs = state.ai_logs.lock().unwrap().clone();
            ("200 OK", "application/json", serde_json::to_string_pretty(&logs).unwrap_or_default())
        }

        ("POST", "/api/ai-logs/clear") => {
            state.ai_logs.lock().unwrap().clear();
            let _ = state.app_handle.emit("ai-action", serde_json::json!({ "type": "clear_ai_logs" }));
            let resp = serde_json::json!({ "ok": true });
            ("200 OK", "application/json", resp.to_string())
        }

        // 16. Connected AI Models Peer Directory (Cross-Model Visibility)
        ("GET", "/api/ai-models") => {
            let models = state.ai_models.lock().unwrap();
            let now_ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            let list: Vec<serde_json::Value> = models
                .values()
                .map(|m| {
                    serde_json::json!({
                        "id": m.id,
                        "model_name": m.model_name,
                        "client_id": m.client_id,
                        "active_port": m.active_port,
                        "session_id": m.session_id,
                        "last_seen_seconds_ago": now_ts.saturating_sub(m.last_seen_sec),
                        "last_command": m.last_command,
                        "registered_at": m.registered_at,
                    })
                })
                .collect();

            let resp = serde_json::json!({
                "count": list.len(),
                "models": list
            });
            ("200 OK", "application/json", resp.to_string())
        }

        ("POST", "/api/ai-models/register") => {
            #[derive(Deserialize)]
            struct RegModelReq {
                model_name: String,
                client_id: Option<String>,
                active_port: Option<String>,
                session_id: Option<String>,
            }
            match serde_json::from_str::<RegModelReq>(body) {
                Ok(r) => {
                    record_ai_activity(
                        state,
                        Some(r.model_name.clone()),
                        r.client_id.clone(),
                        r.active_port.clone(),
                        r.session_id.clone(),
                        "REGISTER",
                    );
                    let resp = serde_json::json!({
                        "ok": true,
                        "model_name": r.model_name,
                        "client_id": r.client_id,
                        "active_port": r.active_port,
                        "session_id": r.session_id
                    });
                    ("200 OK", "application/json", resp.to_string())
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        _ => ("404 Not Found", "application/json", "{\"error\": \"Endpoint not found\"}".to_string()),
    };

    // Record activity for this model if model name or client id is known
    if header_model.is_some() || header_client.is_some() {
        record_ai_activity(
            state,
            header_model,
            header_client,
            None,
            None,
            &format!("{} {}", method, path),
        );
    }

    // Audit and broadcast command execution to UI
    let log_entry = AiCommandLog {
        id: format!("cmd_{}", Local::now().timestamp_millis()),
        timestamp: Local::now().format("%H:%M:%S").to_string(),
        method: method.to_string(),
        endpoint: path.to_string(),
        payload: if body.len() > 256 { format!("{}...", &body[..256]) } else { body.to_string() },
        response: if response_body.len() > 256 { format!("{}...", &response_body[..256]) } else { response_body.clone() },
        status: if status.starts_with("200") { 200 } else { 400 },
    };

    {
        let mut logs = state.ai_logs.lock().unwrap();
        if logs.len() >= 500 {
            logs.remove(0);
        }
        logs.push(log_entry.clone());
    }

    let _ = state.app_handle.emit("ai-command-log", &log_entry);

    (status, content_type, response_body)
}
