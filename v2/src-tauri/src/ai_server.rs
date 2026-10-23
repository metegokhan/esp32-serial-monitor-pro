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
pub struct AiTerminalLinePayload {
    pub model_name: String,
    pub client_id: String,
    pub session_id: Option<String>,
    pub port: Option<String>,
    pub timestamp: String,
    pub line: String,
    pub direction: String, // "tx" | "rx" | "stage" | "info" | "error"
    pub raw_response: Option<String>,
}

pub fn emit_ai_terminal_line(
    app: &AppHandle,
    model_name: &str,
    client_id: &str,
    session_id: Option<String>,
    port: Option<String>,
    direction: &str,
    line: &str,
    raw_response: Option<String>,
) {
    let payload = AiTerminalLinePayload {
        model_name: model_name.to_string(),
        client_id: client_id.to_string(),
        session_id,
        port,
        timestamp: Local::now().format("%H:%M:%S%.3f").to_string(),
        line: line.to_string(),
        direction: direction.to_string(),
        raw_response,
    };
    let _ = app.emit("ai-terminal-line", &payload);
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

### 3. `POST /api/connect` (or `./smp connect [port|"auto"] [baud] [--reset] [--match <hint>]`)
Connects to a serial port safely.
- JSON body: `{"port": "auto"|"/dev/ttyUSB0", "baud": 115200, "reset": false, "match": "ESP32"}`
- **🛡️ Safe Connect Default**: Neutral RTS/DTR lines guaranteed, zero reset.
- If `port` is omitted or `"auto"`, automatically detects and connects to the plugged ESP32/UART device!
- `--match <hint>` disambiguates when multiple devices are plugged in (matches chip name, VID/PID, serial number).
- If already connected, gracefully returns the existing active session without reset.

### 4. `POST /api/probe` (or `./smp probe [port] [baud]`)
Non-destructive chip and protocol probe without triggering an EN/IO0 hardware reset!
- Returns chip family, USB identifiers, and initial response sample.

### 5. `POST /api/disconnect` (or `./smp disconnect [session_id]`)
Disconnects the port cleanly and cleans up AI session mappings.
- JSON body: `{"session_id": "session_xxx"}` (or empty for default session).

### 6. `POST /api/cancel` (or `./smp cancel [session_id]`)
Aborts any active long-running serial upload or execution wait immediately (also bound to Ctrl+C in CLI).

### 7. `GET /api/logs` (or `./smp logs [--tail N] [--filter <term>]`)
Fetches the latest N log lines from the device.
- Query params: `tail=50`, `filter=HEAP`, `session_id=...`
- Returns: `{"lines": ["line 1", "line 2", ...], "count": 50}`

### 8. `POST /api/send` (or `./smp send <command> [--delay ms] [--raw] [-f file]`)
Sends single-line or multiline UART data to the connected device.
- JSON body:
  - `{"data": "AT+GMR\r\n", "session_id": "..."}` (single line)
  - `{"lines": ["AT+GMR", "AT+CIFSR"], "line_delay_ms": 50}` (multiline with inter-line delay)
  - `{"data": "print(1)\nprint(2)", "line_delay_ms": 30, "eol": "\r\n"}` (multiline string)
  - `{"data": "\x01\x02", "raw": true}` (raw bytes)

### 9. `POST /api/exec` (or `./smp exec <command> [--timeout ms] [--expect <text>] [--delay ms]`)
**⚡ Interactive Serial Execution with Granular Stage Breakdown**:
Sends command(s), streams live output lines to terminal, and returns 3 distinct stages:
- **`stages.uploaded`**: Technical transmission & CRC/byte transfer
- **`stages.started`**: Execution start & initial response detection
- **`stages.verified`**: Assertion verification (does not falsify technical `ok` if unverified)
- Supports up to 300,000ms timeout for large transfers.
- JSON body: `{"command": "help", "timeout_ms": 5000, "expect": ">>>", "line_delay_ms": 30}`

### 10. `POST /api/shell` (or `./smp shell <command>` / `./smp sh <command>`)
**💻 Cross-Platform Local Shell Execution**: Runs system shell command (Windows PowerShell / Linux bash/sh) and returns stdout/stderr.
- JSON body: `{"command": "idf.py build", "cwd": "/path", "timeout_sec": 60}`
- Returns: `{"ok": true, "stdout": "...", "stderr": "...", "exit_code": 0, "duration_ms": 250, "platform": "linux"|"windows"}`

### 11. `POST /api/reset` (or `./smp reset`)
Executes an explicit ESP32 Hardware Reset by pulsing the EN line (audited and recorded in stream).

### 12. `POST /api/boot` (or `./smp boot`)
Forces the ESP32 into ROM Bootloader / Download Mode (IO0 low + EN pulse).

### 13. `POST /api/pin` (or `./smp pin [line_index|"last"] [note] [--preset 1-6]`)
Tags and bookmarks a log line (or latest received line if omitted or "last") with timestamp, note, preset shape, and emoji.
- JSON body: `{"line_index": "last"|42, "note": "Crash occurred here", "shape": "circle", "color": "#a855f7", "emoji": "😡", "description": "ekran hatası"}`
- Supports presets (1-6) and shapes: circle, square, triangle, pentagon, diamond.

### 14. `GET /api/pins` (or `./smp pins`)
Lists all bookmarked pins and notes across panels.

### 15. `DELETE /api/pin` (or `./smp pin remove <id>`)
Removes a pin by ID or line index.

### 16. `POST /api/filter` (or `./smp filter add <tags...>`)
Adds or removes filter tags in the UI.
- JSON body: `{"action": "add"|"remove"|"clear", "tags": ["HEAP", "Guru Meditation"]}`
- Supports tag context window filters: `tag+5`, `tag+-5`, `tag:ekran hatası+3`

### 17. `POST /api/trigger` (or `./smp trigger add <tag>`)
Sets an armed target trigger word.

### 18. `GET /api/archives` (or `./smp archives`)
Lists all recorded session log archives on local disk.

### 19. `GET /api/ai-logs` (or `./smp ai-logs`)
Returns the audit trail of all commands executed by AI models, visible live in the UI.

### 20. `GET /api/ai-models` (or `./smp ai-models`)
Cross-model peer directory: lists connected AI models, their active ports, sessions, and last activity (auto-pruned when ports disconnect).
- Agents can supply headers `X-AI-Model: <name>` and `X-AI-Client: <id>` or query `?model=...`.

---

## 💡 Quick Examples (cURL or CLI):
```bash
# Auto-connect safely to ESP32 (DTR/RTS neutral, no reset)
smp connect auto
# Non-destructive probe of port
smp probe /dev/ttyUSB0
# Interactive query: send command, stream output live, view stage status
smp exec "help"
# Send multiline script with 30ms delay
smp send -f script.py --delay 30
# Run local shell tool
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

fn reconcile_models(state: &AiServerState) {
    let active_sessions = state.serial_manager.get_active_sessions_info();
    let active_sess_ids: std::collections::HashSet<String> = active_sessions.iter().map(|s| s.session_id.clone()).collect();
    let active_ports: std::collections::HashSet<String> = active_sessions.iter().map(|s| s.port_name.clone()).collect();

    let mut models = state.ai_models.lock().unwrap();
    let mut changed = false;
    for model in models.values_mut() {
        if let Some(ref sid) = model.session_id {
            if !active_sess_ids.contains(sid) {
                model.session_id = None;
                model.active_port = None;
                changed = true;
            }
        }
        if let Some(ref p) = model.active_port {
            if !active_ports.contains(p) {
                model.active_port = None;
                changed = true;
            }
        }
    }
    if changed {
        let all_models: Vec<AiModelSession> = models.values().cloned().collect();
        drop(models);
        let _ = state.app_handle.emit("ai-models-updated", all_models);
    }
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
            reconcile_models(state);
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

        // 4. Connect Port (Supports auto-detection, disambiguation hint, & safe connection without reset)
        ("POST", "/api/connect") => {
            #[derive(Deserialize)]
            struct ConnectReq {
                port: Option<String>,
                baud: Option<u32>,
                reset: Option<bool>,
                match_hint: Option<String>,
                #[serde(rename = "match")]
                port_match: Option<String>,
                session_id: Option<String>,
                model_name: Option<String>,
                client_id: Option<String>,
            }

            match serde_json::from_str::<ConnectReq>(body) {
                Ok(req_data) => {
                    let available = state.serial_manager.scan_ports("");
                    let pattern = req_data.port_match.or(req_data.match_hint).map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());

                    let target_port = match req_data.port.as_deref() {
                        Some(p) if !p.trim().is_empty() && p.to_lowercase() != "auto" => p.to_string(),
                        _ => {
                            let matched = if let Some(ref pat) = pattern {
                                available.iter().find(|d| {
                                    d.port_name.to_lowercase().contains(pat)
                                        || d.display_name.to_lowercase().contains(pat)
                                        || d.usb_product.as_deref().unwrap_or("").to_lowercase().contains(pat)
                                        || d.serial_number.as_deref().unwrap_or("").to_lowercase().contains(pat)
                                        || d.description.to_lowercase().contains(pat)
                                })
                            } else {
                                None
                            };

                            let best = matched
                                .or_else(|| available.iter().find(|d| d.is_esp))
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
                    let eff_m = req_data.model_name.clone().or(header_model.clone()).unwrap_or_else(|| "AI-Agent".to_string());
                    let eff_c = req_data.client_id.clone().or(header_client.clone()).unwrap_or_else(|| eff_m.clone());

                    if let Some(sess) = existing {
                        record_ai_activity(
                            state,
                            Some(eff_m.clone()),
                            Some(eff_c.clone()),
                            Some(target_port.clone()),
                            Some(sess.session_id.clone()),
                            "CONNECT (EXISTING)",
                        );
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(sess.session_id.clone()),
                            Some(target_port.clone()),
                            "tx",
                            &format!("🤖 [AI -> SMP] CONNECT: port={}, baud={}", target_port, sess.baud_rate),
                            None,
                        );
                        let resp = serde_json::json!({
                            "ok": true,
                            "already_connected": true,
                            "session_id": sess.session_id,
                            "port": target_port,
                            "baud": sess.baud_rate,
                            "safe_connect": true,
                            "reset_on_connect": false,
                            "dtr_neutral": true,
                            "rts_neutral": true,
                            "message": "Cihaz zaten bağlı, mevcut oturum döndürüldü (Reset kapalı, RTS/DTR nötr)."
                        });
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(sess.session_id.clone()),
                            Some(target_port.clone()),
                            "info",
                            &format!("🛡️ [SMP -> AI] Cihaz zaten bağlı, mevcut oturum hazır ({})", target_port),
                            Some(resp.to_string()),
                        );
                        return ("200 OK", "application/json", resp.to_string());
                    }

                    let s_id = req_data.session_id.unwrap_or_else(|| {
                        format!("session_ai_{}", Local::now().format("%Y%m%d_%H%M%S"))
                    });

                    emit_ai_terminal_line(
                        &state.app_handle,
                        &eff_m,
                        &eff_c,
                        Some(s_id.clone()),
                        Some(target_port.clone()),
                        "tx",
                        &format!("🤖 [AI -> SMP] CONNECT: port={}, baud={}, reset={}", target_port, baud, reset),
                        None,
                    );

                    match state.serial_manager.connect_session(
                        state.app_handle.clone(),
                        s_id.clone(),
                        target_port.clone(),
                        baud,
                        reset,
                    ) {
                        Ok(_) => {
                            record_ai_activity(
                                state,
                                Some(eff_m.clone()),
                                Some(eff_c.clone()),
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
                                    "resetOnConnect": reset,
                                    "safeConnect": !reset
                                }),
                            );
                            let resp = serde_json::json!({
                                "ok": true,
                                "session_id": s_id,
                                "port": target_port,
                                "baud": baud,
                                "safe_connect": !reset,
                                "reset_on_connect": reset,
                                "dtr_neutral": true,
                                "rts_neutral": true,
                                "message": if reset {
                                    "⚠️ Resetli bağlantı kuruldu (EN darbesi verildi)."
                                } else {
                                    "🛡️ Güvenli bağlantı kuruldu (Donanımsal reset kapalı, RTS/DTR nötr)."
                                }
                            });
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                Some(s_id.clone()),
                                Some(target_port.clone()),
                                "info",
                                &format!("🛡️ [SMP -> AI] Güvenli bağlantı kuruldu ({}, {} baud)", target_port, baud),
                                Some(resp.to_string()),
                            );
                            ("200 OK", "application/json", resp.to_string())
                        }
                        Err(e) => {
                            let resp = serde_json::json!({ "ok": false, "error": e });
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                None,
                                Some(target_port.clone()),
                                "error",
                                &format!("❌ [SMP -> AI] Bağlantı Hatası: {}", resp["error"]),
                                Some(resp.to_string()),
                            );
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

        // 4b. Non-destructive Chip & Protocol Probe (Zero Reset)
        ("GET", "/api/probe") | ("GET", "/api/ports/probe") | ("POST", "/api/probe") => {
            #[derive(Deserialize, Default)]
            struct ProbeReq {
                port: Option<String>,
                baud: Option<u32>,
            }
            let mut req_port = None;
            let mut req_baud = None;
            if method == "POST" {
                if let Ok(p) = serde_json::from_str::<ProbeReq>(body) {
                    req_port = p.port;
                    req_baud = p.baud;
                }
            }
            for pair in query.split('&') {
                let mut kv = pair.split('=');
                if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                    if (k == "port" || k == "port_name") && req_port.is_none() {
                        req_port = Some(v.to_string());
                    } else if (k == "baud" || k == "baud_rate") && req_baud.is_none() {
                        req_baud = v.parse::<u32>().ok();
                    }
                }
            }

            let available = state.serial_manager.scan_ports("");
            let target_port = match req_port.as_deref() {
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
                                "error": "Sorgulanacak seri port bulunamadı"
                            });
                            return ("400 Bad Request", "application/json", resp.to_string());
                        }
                    }
                }
            };

            let baud = req_baud.unwrap_or(115200);
            let eff_probe_m = header_model.clone().unwrap_or_else(|| "AI-Agent".to_string());
            let eff_probe_c = header_client.clone().unwrap_or_else(|| eff_probe_m.clone());

            emit_ai_terminal_line(
                &state.app_handle,
                &eff_probe_m,
                &eff_probe_c,
                None,
                Some(target_port.clone()),
                "tx",
                &format!("🔍 [AI -> SMP] PROBE: port={}", target_port),
                None,
            );

            match state.serial_manager.probe_port(&target_port, baud) {
                Ok(probe_result) => {
                    let resp = serde_json::json!({
                        "ok": true,
                        "probe": probe_result,
                        "port": target_port,
                        "baud": baud,
                        "safe_probe": true,
                        "dtr_neutral": true,
                        "rts_neutral": true,
                        "message": "Port güvenli şekilde (reset tetiklenmeden) sorgulandı."
                    });
                    emit_ai_terminal_line(
                        &state.app_handle,
                        &eff_probe_m,
                        &eff_probe_c,
                        None,
                        Some(target_port.clone()),
                        "info",
                        &format!("🔎 [SMP -> AI] Probe Sonucu: {} ({})", probe_result.chip_family, probe_result.device_info.as_ref().map(|d| d.description.as_str()).unwrap_or(target_port.as_str())),
                        Some(resp.to_string()),
                    );
                    ("200 OK", "application/json", resp.to_string())
                }
                Err(e) => {
                    let resp = serde_json::json!({
                        "ok": false,
                        "port": target_port,
                        "error": e
                    });
                    emit_ai_terminal_line(
                        &state.app_handle,
                        &eff_probe_m,
                        &eff_probe_c,
                        None,
                        Some(target_port.clone()),
                        "error",
                        &format!("❌ [SMP -> AI] Probe Hatası: {}", resp["error"]),
                        Some(resp.to_string()),
                    );
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
                let eff_m = header_model.clone().unwrap_or_else(|| "AI-Agent".to_string());
                let eff_c = header_client.clone().unwrap_or_else(|| eff_m.clone());
                emit_ai_terminal_line(
                    &state.app_handle,
                    &eff_m,
                    &eff_c,
                    Some(id.clone()),
                    None,
                    "info",
                    &format!("🔌 [AI -> SMP] Oturum bağlantısı kesildi: {}", id),
                    None,
                );
                let _ = state.serial_manager.disconnect_session(&id);
                reconcile_models(state);
                let _ = state.app_handle.emit(
                    "ai-action",
                    serde_json::json!({ "type": "disconnect", "sessionId": id, "model_name": eff_m, "client_id": eff_c }),
                );
                let resp = serde_json::json!({ "ok": true, "session_id": id });
                ("200 OK", "application/json", resp.to_string())
            } else {
                reconcile_models(state);
                let resp = serde_json::json!({ "ok": false, "error": "No active session to disconnect" });
                ("400 Bad Request", "application/json", resp.to_string())
            }
        }

        // 5b. Cancel Ongoing Transmission or Command
        ("POST", "/api/cancel") | ("POST", "/api/abort") => {
            #[derive(Deserialize)]
            struct CancelReq {
                session_id: Option<String>,
            }
            let s_id = serde_json::from_str::<CancelReq>(body)
                .ok()
                .and_then(|r| r.session_id)
                .or_else(|| state.serial_manager.get_first_session_id());

            let eff_m = header_model.clone().unwrap_or_else(|| "AI-Agent".to_string());
            let eff_c = header_client.clone().unwrap_or_else(|| eff_m.clone());

            emit_ai_terminal_line(
                &state.app_handle,
                &eff_m,
                &eff_c,
                s_id.clone(),
                None,
                "info",
                "🛑 [AI -> SMP] Yürütülen seri işlem iptal edildi (cancel)",
                None,
            );

            if let Some(ref id) = s_id {
                state.serial_manager.cancel_session(id);
            } else {
                state.serial_manager.cancel_all();
            }

            let _ = state.app_handle.emit(
                "ai-action",
                serde_json::json!({ "type": "cancel", "sessionId": s_id }),
            );

            let resp = serde_json::json!({
                "ok": true,
                "cancelled": true,
                "session_id": s_id,
                "message": "Devam eden seri işlem / aktarım iptal edildi."
            });
            ("200 OK", "application/json", resp.to_string())
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

                    let eff_m = header_model.clone().unwrap_or_else(|| "AI-Agent".to_string());
                    let eff_c = header_client.clone().unwrap_or_else(|| eff_m.clone());

                    if let Some(id) = s_id {
                        let eol = req_data.eol.unwrap_or_else(|| "\r\n".to_string());
                        let delay = req_data.line_delay_ms.unwrap_or(0);

                        let lines_to_send: Vec<String> = if let Some(l) = req_data.lines {
                            l
                        } else if let Some(d) = req_data.data {
                            if req_data.raw == Some(true) {
                                emit_ai_terminal_line(
                                    &state.app_handle,
                                    &eff_m,
                                    &eff_c,
                                    Some(id.clone()),
                                    None,
                                    "tx",
                                    &format!("📤 [TX RAW AI -> PORT] {} bayt ham veri", d.len()),
                                    None,
                                );
                                match state.serial_manager.send_data(&id, &d) {
                                    Ok(_) => {
                                        let resp = serde_json::json!({
                                            "ok": true,
                                            "session_id": id,
                                            "bytes_sent": d.len(),
                                            "raw": true
                                        });
                                        emit_ai_terminal_line(
                                            &state.app_handle,
                                            &eff_m,
                                            &eff_c,
                                            Some(id.clone()),
                                            None,
                                            "info",
                                            &format!("✅ [SMP -> AI] {} bayt ham veri iletildi", d.len()),
                                            Some(resp.to_string()),
                                        );
                                        return ("200 OK", "application/json", resp.to_string());
                                    }
                                    Err(e) => {
                                        let resp = serde_json::json!({ "ok": false, "error": e });
                                        emit_ai_terminal_line(
                                            &state.app_handle,
                                            &eff_m,
                                            &eff_c,
                                            Some(id.clone()),
                                            None,
                                            "error",
                                            &format!("❌ [SMP -> AI] Gönderim Hatası: {}", resp["error"]),
                                            Some(resp.to_string()),
                                        );
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

                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "tx",
                            &format!("📤 [TX AI -> PORT] {} satır gönderiliyor (gecikme: {}ms)", lines_to_send.len(), delay),
                            None,
                        );
                        for l in &lines_to_send {
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                Some(id.clone()),
                                None,
                                "tx",
                                &format!("📤 [TX] {}", l),
                                None,
                            );
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
                                emit_ai_terminal_line(
                                    &state.app_handle,
                                    &eff_m,
                                    &eff_c,
                                    Some(id.clone()),
                                    None,
                                    "info",
                                    &format!("✅ [SMP -> AI] 200 OK: {} bayt başarıyla iletildi", bytes),
                                    Some(resp.to_string()),
                                );
                                ("200 OK", "application/json", resp.to_string())
                            }
                            Err(e) => {
                                let resp = serde_json::json!({ "ok": false, "error": e });
                                emit_ai_terminal_line(
                                    &state.app_handle,
                                    &eff_m,
                                    &eff_c,
                                    Some(id.clone()),
                                    None,
                                    "error",
                                    &format!("❌ [SMP -> AI] Gönderim Hatası: {}", resp["error"]),
                                    Some(resp.to_string()),
                                );
                                ("400 Bad Request", "application/json", resp.to_string())
                            }
                        }
                    } else {
                        let resp = serde_json::json!({ "ok": false, "error": "Bağlı aktif oturum yok" });
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            None,
                            None,
                            "error",
                            "❌ [SMP -> AI] Bağlı aktif oturum yok",
                            Some(resp.to_string()),
                        );
                        ("400 Bad Request", "application/json", resp.to_string())
                    }
                }
                Err(e) => {
                    let resp = serde_json::json!({ "ok": false, "error": format!("Invalid JSON: {}", e) });
                    ("400 Bad Request", "application/json", resp.to_string())
                }
            }
        }

        // 7. Interactive Command Execution (Send, Stream Output, & Track 3-Stage Lifecycle)
        ("POST", "/api/exec") => {
            #[derive(Deserialize)]
            struct ExecReq {
                command: Option<String>,
                data: Option<String>,
                lines: Option<Vec<String>>,
                timeout_ms: Option<u64>,
                expect: Option<String>,
                verify_expect: Option<String>,
                start_expect: Option<String>,
                line_delay_ms: Option<u64>,
                eol: Option<String>,
                session_id: Option<String>,
                model_name: Option<String>,
                client_id: Option<String>,
            }

            match serde_json::from_str::<ExecReq>(body) {
                Ok(ereq) => {
                    let s_id = ereq
                        .session_id
                        .or_else(|| state.serial_manager.get_first_session_id());

                    let eff_m = ereq.model_name.or(header_model.clone()).unwrap_or_else(|| "AI-Agent".to_string());
                    let eff_c = ereq.client_id.or(header_client.clone()).unwrap_or_else(|| eff_m.clone());

                    if let Some(id) = s_id {
                        // Timeout up to 300,000 ms (5 min) for large transfers
                        let timeout = Duration::from_millis(ereq.timeout_ms.unwrap_or(5000).clamp(100, 300_000));
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
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                Some(id.clone()),
                                None,
                                "error",
                                "❌ [SMP -> AI] Komut veya veri belirtilmedi",
                                Some(resp.to_string()),
                            );
                            return ("400 Bad Request", "application/json", resp.to_string());
                        }

                        let cmd_summary = lines_to_send.join(" \\n ");
                        let exp_info = ereq.verify_expect.as_ref().or(ereq.expect.as_ref()).map(|e| format!(" --expect \"{}\"", e)).unwrap_or_default();
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "tx",
                            &format!("🤖 [AI -> SMP] EXEC: \"{}\"{}", if cmd_summary.len() > 80 { format!("{}...", &cmd_summary[..80]) } else { cmd_summary.clone() }, exp_info),
                            None,
                        );
                        for l in &lines_to_send {
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                Some(id.clone()),
                                None,
                                "tx",
                                &format!("📤 [TX -> ESP32] {}", l),
                                None,
                            );
                        }

                        // Reset any lingering cancel flag before starting execution
                        state.serial_manager.reset_cancel_flag(&id);

                        let start_count = state.serial_manager.get_total_lines_count(&id).unwrap_or(0);
                        let upload_start_time = std::time::Instant::now();

                        // --- Stage 1: Yüklendi (Payload Transmission) ---
                        let sent_bytes = match state.serial_manager.send_multiline(&id, &lines_to_send, &eol, delay) {
                            Ok(b) => b,
                            Err(e) => {
                                let upload_elapsed = upload_start_time.elapsed().as_millis() as u64;
                                let is_cancelled = state.serial_manager.is_cancelled(&id);
                                let resp = serde_json::json!({
                                    "ok": false,
                                    "cancelled": is_cancelled,
                                    "passed": false,
                                    "error": e,
                                    "stages": {
                                        "uploaded": {
                                            "name": "Yüklendi (Payload Gönderimi)",
                                            "status": if is_cancelled { "cancelled" } else { "failed" },
                                            "message": e,
                                            "elapsed_ms": upload_elapsed
                                        },
                                        "started": {
                                            "name": "Başlatıldı (Yürütme Akışı)",
                                            "status": "pending",
                                            "message": "Yükleme tamamlanamadığı için başlatılamadı",
                                            "elapsed_ms": 0
                                        },
                                        "verified": {
                                            "name": "Doğrulandı (Oynatma/Sonuç)",
                                            "status": "pending",
                                            "message": "Doğrulama aşamasına geçilemedi",
                                            "elapsed_ms": 0
                                        }
                                    }
                                });
                                emit_ai_terminal_line(
                                    &state.app_handle,
                                    &eff_m,
                                    &eff_c,
                                    Some(id.clone()),
                                    None,
                                    "error",
                                    &format!("❌ [SMP -> AI] Aktarım Hatası: {}", resp["error"]),
                                    Some(resp.to_string()),
                                );
                                return ("400 Bad Request", "application/json", resp.to_string());
                            }
                        };
                        let upload_duration_ms = upload_start_time.elapsed().as_millis() as u64;

                        // --- Stages 2 & 3: Başlatıldı (Started) & Doğrulandı (Verified) ---
                        let exec_start_time = std::time::Instant::now();
                        let mut started_detected = false;
                        let mut started_at_ms: Option<u64> = None;
                        let mut matched_expect = false;
                        let mut verified_at_ms: Option<u64> = None;
                        let mut response_lines = Vec::new();
                        let mut was_cancelled = false;

                        let verify_target = ereq.verify_expect.as_ref().or(ereq.expect.as_ref());
                        let start_target = ereq.start_expect.as_ref();
                        let mut last_stream_count = 0;

                        while exec_start_time.elapsed() < timeout {
                            // Support cancellation mid-wait
                            if state.serial_manager.is_cancelled(&id) {
                                was_cancelled = true;
                                break;
                            }

                            std::thread::sleep(Duration::from_millis(25));
                            let current = state.serial_manager.get_lines_since(&id, start_count);

                            // Detect Started stage
                            if !started_detected && !current.is_empty() {
                                if let Some(ref st_exp) = start_target {
                                    if current.iter().any(|l| l.contains(st_exp.as_str())) {
                                        started_detected = true;
                                        started_at_ms = Some(exec_start_time.elapsed().as_millis() as u64);
                                    }
                                } else {
                                    started_detected = true;
                                    started_at_ms = Some(exec_start_time.elapsed().as_millis() as u64);
                                }
                            }

                            // Stream live lines to UI
                            if current.len() > last_stream_count {
                                let new_lines = current[last_stream_count..].to_vec();
                                last_stream_count = current.len();
                                for l in &new_lines {
                                    emit_ai_terminal_line(
                                        &state.app_handle,
                                        &eff_m,
                                        &eff_c,
                                        Some(id.clone()),
                                        None,
                                        "rx",
                                        &format!("📥 [RX <- ESP32] {}", l),
                                        None,
                                    );
                                }
                                let _ = state.app_handle.emit(
                                    "ai-exec-stream",
                                    serde_json::json!({
                                        "sessionId": id,
                                        "newLines": new_lines,
                                        "totalLines": current.len(),
                                        "elapsedMs": exec_start_time.elapsed().as_millis() as u64
                                    }),
                                );
                            }

                            // Detect Verification stage
                            if let Some(exp) = verify_target {
                                if current.iter().any(|l| l.contains(exp.as_str())) {
                                    matched_expect = true;
                                    verified_at_ms = Some(exec_start_time.elapsed().as_millis() as u64);
                                    response_lines = current;
                                    break;
                                }
                            }
                            response_lines = current;
                        }

                        let exec_duration_ms = exec_start_time.elapsed().as_millis() as u64;
                        let total_duration_ms = upload_duration_ms + exec_duration_ms;
                        let response_text = response_lines.join("\n");

                        let uploaded_stage = serde_json::json!({
                            "name": "Yüklendi (Payload & CRC)",
                            "status": "passed",
                            "message": format!("{} satır ({} bayt) başarıyla aktarıldı", lines_to_send.len(), sent_bytes),
                            "elapsed_ms": upload_duration_ms
                        });

                        let started_stage = if started_detected {
                            serde_json::json!({
                                "name": "Başlatıldı (Yürütme Akışı)",
                                "status": "passed",
                                "message": "Cihaz yürütmeye başladı (çıktı akışı doğrulandı)",
                                "elapsed_ms": started_at_ms.unwrap_or(exec_duration_ms)
                            })
                        } else if was_cancelled {
                            serde_json::json!({
                                "name": "Başlatıldı (Yürütme Akışı)",
                                "status": "cancelled",
                                "message": "İşlem iptal edildi",
                                "elapsed_ms": exec_duration_ms
                            })
                        } else {
                            serde_json::json!({
                                "name": "Başlatıldı (Yürütme Akışı)",
                                "status": "waiting",
                                "message": "Cihazdan henüz çıktı satırı gelmedi",
                                "elapsed_ms": exec_duration_ms
                            })
                        };

                        let verified_stage = if let Some(exp) = verify_target {
                            if matched_expect {
                                serde_json::json!({
                                    "name": "Doğrulandı (Oynatma/Sonuç)",
                                    "status": "passed",
                                    "message": format!("Beklenen yanıt doğrulandı: '{}'", exp),
                                    "elapsed_ms": verified_at_ms.unwrap_or(exec_duration_ms)
                                })
                            } else if was_cancelled {
                                serde_json::json!({
                                    "name": "Doğrulandı (Oynatma/Sonuç)",
                                    "status": "cancelled",
                                    "message": "Doğrulama tamamlanmadan iptal edildi",
                                    "elapsed_ms": exec_duration_ms
                                })
                            } else {
                                serde_json::json!({
                                    "name": "Doğrulandı (Oynatma/Sonuç)",
                                    "status": "unverified",
                                    "message": format!("Doğrulama zaman aşımına uğradı ('{}' bulunamadı, {}ms)", exp, timeout.as_millis()),
                                    "elapsed_ms": exec_duration_ms
                                })
                            }
                        } else {
                            serde_json::json!({
                                "name": "Doğrulandı (Oynatma/Sonuç)",
                                "status": "skipped",
                                "message": "Özel doğrulama kriteri (expect) belirtilmedi",
                                "elapsed_ms": 0
                            })
                        };

                        // ok: technical success without crash or fatal error
                        // passed: whether assertions passed
                        let passed = if verify_target.is_some() { matched_expect } else { true };

                        let resp = serde_json::json!({
                            "ok": !was_cancelled,
                            "cancelled": was_cancelled,
                            "passed": passed,
                            "command": lines_to_send.join("\n"),
                            "response_lines": response_lines,
                            "response_text": response_text,
                            "line_count": response_lines.len(),
                            "duration_ms": total_duration_ms,
                            "upload_duration_ms": upload_duration_ms,
                            "exec_duration_ms": exec_duration_ms,
                            "matched_expect": matched_expect,
                            "session_id": id,
                            "stages": {
                                "uploaded": uploaded_stage,
                                "started": started_stage,
                                "verified": verified_stage
                            }
                        });

                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "stage",
                            &format!("🏁 [AŞAMA 1/3: YÜKLENDİ] {} satır ({} bayt) aktarıldı ({}ms)", lines_to_send.len(), sent_bytes, upload_duration_ms),
                            None,
                        );
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "stage",
                            &format!("🏁 [AŞAMA 2/3: BAŞLATILDI] {}", if started_detected { "Cihaz yürütmeye başladı (çıktı akışı doğrulandı)" } else if was_cancelled { "İşlem iptal edildi" } else { "Çıktı bekleniyor" }),
                            None,
                        );
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "stage",
                            &format!("🏁 [AŞAMA 3/3: DOĞRULANDI] {}", if matched_expect { format!("Beklenen yanıt doğrulandı: '{}'", verify_target.unwrap_or(&"".to_string())) } else if was_cancelled { "İptal edildi".to_string() } else if verify_target.is_some() { format!("Zaman aşımı ('{}' bulunamadı)", verify_target.unwrap_or(&"".to_string())) } else { "Özel doğrulama kriteri belirtilmedi".to_string() }),
                            None,
                        );
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            Some(id.clone()),
                            None,
                            "info",
                            &format!("✅ [SMP -> AI] 200 OK (passed: {}, süre: {}ms, satır: {})", passed, total_duration_ms, response_lines.len()),
                            Some(resp.to_string()),
                        );

                        ("200 OK", "application/json", resp.to_string())
                    } else {
                        let resp = serde_json::json!({ "ok": false, "error": "Bağlı aktif oturum yok" });
                        emit_ai_terminal_line(
                            &state.app_handle,
                            &eff_m,
                            &eff_c,
                            None,
                            None,
                            "error",
                            "❌ [SMP -> AI] Bağlı aktif oturum yok",
                            Some(resp.to_string()),
                        );
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
                model_name: Option<String>,
                client_id: Option<String>,
            }

            match serde_json::from_str::<ShellReq>(body) {
                Ok(sreq) => {
                    let eff_m = sreq.model_name.or(header_model.clone()).unwrap_or_else(|| "AI-Agent".to_string());
                    let eff_c = sreq.client_id.or(header_client.clone()).unwrap_or_else(|| eff_m.clone());

                    emit_ai_terminal_line(
                        &state.app_handle,
                        &eff_m,
                        &eff_c,
                        None,
                        None,
                        "tx",
                        &format!("💻 [AI -> KABUK] $ {}", sreq.command),
                        None,
                    );

                    match crate::shell::execute_shell(&sreq.command, sreq.cwd.as_deref(), sreq.timeout_sec) {
                        Ok(result) => {
                            let resp = serde_json::to_string(&result).unwrap_or_default();
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                None,
                                None,
                                "info",
                                &format!("💻 [KABUK -> AI] Çıkış Kodu: {} ({}ms, {})", result.exit_code, result.duration_ms, result.platform),
                                Some(resp.clone()),
                            );
                            ("200 OK", "application/json", resp)
                        }
                        Err(e) => {
                            let resp = serde_json::json!({ "ok": false, "error": e });
                            emit_ai_terminal_line(
                                &state.app_handle,
                                &eff_m,
                                &eff_c,
                                None,
                                None,
                                "error",
                                &format!("❌ [KABUK -> AI] Hata: {}", resp["error"]),
                                Some(resp.to_string()),
                            );
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
            reconcile_models(state);
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
