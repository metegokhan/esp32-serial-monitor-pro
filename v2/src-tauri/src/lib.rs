pub mod archive;
pub mod serial;

use std::sync::Arc;
use tauri::{AppHandle, State};

use archive::{delete_archive, get_archive_dir, list_archives, read_archive, ArchiveEntry};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let serial_manager = Arc::new(SerialManager::new());

    tauri::Builder::default()
        .manage(serial_manager)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            connect_port,
            disconnect_port,
            send_data,
            reset_esp,
            boot_esp,
            get_archives,
            read_archive_file,
            delete_archive_file,
            get_archive_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
