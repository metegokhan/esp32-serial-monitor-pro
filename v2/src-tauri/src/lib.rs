pub mod ai_server;
pub mod archive;
pub mod cli_installer;
pub mod gdrive_oauth;
pub mod serial;
pub mod shell;

use std::sync::Arc;
use tauri::{AppHandle, State};

use archive::{delete_archive, get_archive_dir, list_archives, read_archive, save_archive, ArchiveEntry};
use serial::{SerialDeviceInfo, SerialManager};

#[tauri::command]
fn scan_ports(manager: State<'_, Arc<SerialManager>>, filter: String) -> Vec<SerialDeviceInfo> {
    manager.scan_ports(&filter)
}

#[tauri::command]
fn connect_port(
    app: AppHandle,
    manager: State<'_, Arc<SerialManager>>,
    session_id: String,
    port_name: String,
    baud_rate: u32,
    reset_on_connect: bool,
) -> Result<(), String> {
    manager.connect_session(app, session_id, port_name, baud_rate, reset_on_connect)
}

#[tauri::command]
fn cancel_active_session(manager: State<'_, Arc<SerialManager>>, session_id: Option<String>) -> bool {
    if let Some(id) = session_id {
        manager.cancel_session(&id)
    } else {
        manager.cancel_all();
        true
    }
}

#[tauri::command]
fn probe_port_cmd(
    manager: State<'_, Arc<SerialManager>>,
    port_name: String,
    baud_rate: Option<u32>,
) -> Result<serial::PortProbeResult, String> {
    manager.probe_port(&port_name, baud_rate.unwrap_or(115200))
}

#[tauri::command]
fn disconnect_port(manager: State<'_, Arc<SerialManager>>, session_id: String) -> Result<(), String> {
    manager.disconnect_session(&session_id)
}

#[tauri::command]
fn send_data(
    manager: State<'_, Arc<SerialManager>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    manager.send_data(&session_id, &data)
}

#[tauri::command]
fn send_multiline_data(
    manager: State<'_, Arc<SerialManager>>,
    session_id: String,
    lines: Vec<String>,
    eol: String,
    delay_ms: u64,
) -> Result<usize, String> {
    manager.send_multiline(&session_id, &lines, &eol, delay_ms)
}

#[tauri::command]
async fn execute_shell_command(
    command: String,
    cwd: Option<String>,
    timeout_sec: Option<u64>,
) -> Result<shell::ShellExecutionResult, String> {
    tokio::task::spawn_blocking(move || {
        shell::execute_shell(&command, cwd.as_deref(), timeout_sec)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn reset_esp(manager: State<'_, Arc<SerialManager>>, session_id: String) -> Result<(), String> {
    manager.reset_esp(&session_id)
}

#[tauri::command]
fn boot_esp(manager: State<'_, Arc<SerialManager>>, session_id: String) -> Result<(), String> {
    manager.boot_esp(&session_id)
}

#[tauri::command]
fn get_archives() -> Vec<ArchiveEntry> {
    list_archives()
}

#[tauri::command]
fn read_archive_file(filepath: String) -> Result<String, String> {
    read_archive(&filepath)
}

#[tauri::command]
fn delete_archive_file(filepath: String) -> Result<(), String> {
    delete_archive(&filepath)
}

#[tauri::command]
fn get_archive_path() -> String {
    get_archive_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn save_ai_session_archive(filename: String, content: String) -> Result<String, String> {
    save_archive(&filename, &content)
}

#[tauri::command]
async fn export_log_dialog(default_filename: String, content: String) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let file = rfd::FileDialog::new()
            .set_file_name(&default_filename)
            .add_filter("Log Files (*.log)", &["log"])
            .add_filter("Text Files (*.txt)", &["txt"])
            .add_filter("All Files (*.*)", &["*"])
            .save_file();

        if let Some(path) = file {
            std::fs::write(&path, content).map_err(|e| format!("Dosya kaydedilemedi: {}", e))?;
            Ok(Some(path.to_string_lossy().to_string()))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn open_log_dialog() -> Result<Option<(String, String)>, String> {
    tokio::task::spawn_blocking(move || {
        let file = rfd::FileDialog::new()
            .add_filter("Log & Text Files (*.log, *.txt)", &["log", "txt"])
            .add_filter("All Files (*.*)", &["*"])
            .pick_file();

        if let Some(path) = file {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Dosya okunamadı: {}", e))?;
            let filename = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "imported.log".to_string());
            Ok(Some((filename, content)))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct HttpRequestOptions {
    pub url: String,
    pub method: String,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct HttpResponsePayload {
    pub status: u16,
    pub ok: bool,
    pub body: String,
}

#[tauri::command]
async fn http_request(options: HttpRequestOptions) -> Result<HttpResponsePayload, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = match options.method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "PATCH" => reqwest::Method::PATCH,
        "DELETE" => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(method, &options.url);

    if let Some(headers) = options.headers {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }

    if let Some(body) = options.body {
        req = req.body(body);
    }

    let resp = req.send().await.map_err(|e| format!("HTTP hatası: {}", e))?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let body_text = resp.text().await.map_err(|e| format!("Cevap okunamadı: {}", e))?;

    Ok(HttpResponsePayload {
        status,
        ok,
        body: body_text,
    })
}

#[tauri::command]
async fn start_google_oauth_flow(
    app: AppHandle,
    client_id: String,
    client_secret: Option<String>,
) -> Result<gdrive_oauth::GoogleAuthTokens, String> {
    gdrive_oauth::start_oauth_flow(app, client_id, client_secret).await
}

#[tauri::command]
async fn refresh_google_oauth_token(
    client_id: String,
    client_secret: Option<String>,
    refresh_token: String,
) -> Result<gdrive_oauth::GoogleAuthTokens, String> {
    gdrive_oauth::refresh_access_token(&client_id, client_secret.as_deref(), &refresh_token).await
}

#[tauri::command]
fn get_ai_skill_guide() -> String {
    ai_server::AI_SKILL_DOCUMENT.to_string()
}

#[tauri::command]
fn install_smp_cli_cmd() -> cli_installer::SmpInstallResult {
    cli_installer::install_smp_cli()
}

#[tauri::command]
fn get_smp_cli_status_cmd() -> cli_installer::SmpInstallResult {
    cli_installer::get_smp_cli_status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let serial_manager = Arc::new(SerialManager::new());
    let sm_for_server = serial_manager.clone();

    tauri::Builder::default()
        .manage(serial_manager)
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Automatically ensure smp CLI tool is installed to user's PATH (~/.local/bin/smp)
            let install_res = cli_installer::install_smp_cli();
            if install_res.ok {
                println!("[SMP] CLI tool installed: {}", install_res.target_path);
            } else {
                eprintln!("[SMP] CLI install warning: {}", install_res.message);
            }

            // Start headless AI agent HTTP server on 127.0.0.1:4567
            ai_server::start_ai_http_server(app.handle().clone(), sm_for_server);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            connect_port,
            disconnect_port,
            send_data,
            send_multiline_data,
            execute_shell_command,
            reset_esp,
            boot_esp,
            get_archives,
            read_archive_file,
            delete_archive_file,
            get_archive_path,
            export_log_dialog,
            open_log_dialog,
            http_request,
            start_google_oauth_flow,
            refresh_google_oauth_token,
            get_ai_skill_guide,
            install_smp_cli_cmd,
            get_smp_cli_status_cmd,
            cancel_active_session,
            probe_port_cmd,
            save_ai_session_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

