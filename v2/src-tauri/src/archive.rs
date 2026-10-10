use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct ArchiveEntry {
    pub filename: String,
    pub path: String,
    pub port: String,
    pub date: String,
    pub size_bytes: u64,
    pub size_str: String,
}

pub fn get_archive_dir() -> PathBuf {
    // Default to archives directory beside project/binary or local data dir
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("esp32-serial-monitor-pro");
    dir.push("archives");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn format_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

pub fn list_archives() -> Vec<ArchiveEntry> {
    let dir = get_archive_dir();
    let mut entries = Vec::new();

    if let Ok(read_dir) = fs::read_dir(&dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "log" || ext == "txt") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let metadata = entry.metadata().ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let size_str = format_bytes(size_bytes);

                let port = if filename.starts_with("ESP32_") {
                    let parts: Vec<&str> = filename.split('_').collect();
                    if parts.len() >= 2 {
                        parts[1].to_string()
                    } else {
                        "Unknown".to_string()
                    }
                } else if filename.starts_with("TRIGGER_") {
                    "Trigger".to_string()
                } else {
                    "General".to_string()
                };

                let date = metadata
                    .and_then(|m| m.modified().ok())
                    .map(|st| {
                        let dt: chrono::DateTime<chrono::Local> = st.into();
                        dt.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                    .unwrap_or_else(|| "-".to_string());

                entries.push(ArchiveEntry {
                    filename,
                    path: path.to_string_lossy().to_string(),
                    port,
                    date,
                    size_bytes,
                    size_str,
                });
            }
        }
    }

    entries.sort_by(|a, b| b.date.cmp(&a.date));
    entries
}

pub fn read_archive(filepath: &str) -> Result<String, String> {
    let path = Path::new(filepath);
    if !path.exists() {
        return Err("Dosya bulunamadı.".to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("Dosya okuma hatası: {}", e))
}

pub fn delete_archive(filepath: &str) -> Result<(), String> {
    let path = Path::new(filepath);
    if !path.exists() {
        return Err("Dosya bulunamadı.".to_string());
    }
    fs::remove_file(path).map_err(|e| format!("Dosya silme hatası: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.0 MB");
        assert_eq!(format_bytes(5 * 1024 * 1024), "5.0 MB");
    }

    #[test]
    fn test_archive_directory_created() {
        let dir = get_archive_dir();
        assert!(dir.exists());
    }
}
