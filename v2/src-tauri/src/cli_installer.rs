use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// Embed the smp CLI Python script directly into the binary at compile time
pub const SMP_CLI_SCRIPT: &str = include_str!("../../../smp");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmpInstallResult {
    pub ok: bool,
    pub target_path: String,
    pub in_path: bool,
    pub message: String,
}

pub fn get_user_bin_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".local").join("bin"))
}

pub fn is_dir_in_path(dir: &Path) -> bool {
    if let Some(path_var) = std::env::var_os("PATH") {
        for p in std::env::split_paths(&path_var) {
            if p == dir {
                return true;
            }
        }
    }
    false
}

pub fn install_smp_cli() -> SmpInstallResult {
    let bin_dir = match get_user_bin_dir() {
        Some(d) => d,
        None => {
            return SmpInstallResult {
                ok: false,
                target_path: String::new(),
                in_path: false,
                message: "Kullanıcı ana dizini (home dir) bulunamadı.".to_string(),
            };
        }
    };

    if let Err(e) = fs::create_dir_all(&bin_dir) {
        return SmpInstallResult {
            ok: false,
            target_path: bin_dir.to_string_lossy().to_string(),
            in_path: false,
            message: format!("~/.local/bin dizini oluşturulamadı: {}", e),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        let target_file = bin_dir.join("smp");
        if let Err(e) = fs::write(&target_file, SMP_CLI_SCRIPT) {
            return SmpInstallResult {
                ok: false,
                target_path: target_file.to_string_lossy().to_string(),
                in_path: false,
                message: format!("smp dosyası yazılamadı: {}", e),
            };
        }

        // Set chmod +x (0o755) on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&target_file) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&target_file, perms);
            }
        }

        let in_path = is_dir_in_path(&bin_dir);

        // If not in PATH, try to configure user's shell rc files
        if !in_path {
            ensure_shell_path_configured(&bin_dir);
        }

        SmpInstallResult {
            ok: true,
            target_path: target_file.to_string_lossy().to_string(),
            in_path,
            message: if in_path {
                format!("smp CLI aracı başarıyla yüklendi ({}) ve sistem PATH'inde hazır.", target_file.display())
            } else {
                format!("smp yüklendi ({}), ancak ~/.local/bin henüz aktif terminal PATH'inde görünmüyor. Terminali yeniden başlatın veya 'export PATH=\"$HOME/.local/bin:$PATH\"' ekleyin.", target_file.display())
            },
        }
    }

    #[cfg(target_os = "windows")]
    {
        let target_py = bin_dir.join("smp");
        let target_cmd = bin_dir.join("smp.cmd");

        if let Err(e) = fs::write(&target_py, SMP_CLI_SCRIPT) {
            return SmpInstallResult {
                ok: false,
                target_path: target_py.to_string_lossy().to_string(),
                in_path: false,
                message: format!("smp betiği yazılamadı: {}", e),
            };
        }

        let cmd_content = "@echo off\r\npython \"%~dp0smp\" %*\r\n";
        let _ = fs::write(&target_cmd, cmd_content);

        let in_path = is_dir_in_path(&bin_dir);
        if !in_path {
            let _ = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    &format!(
                        "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';{}', 'User')",
                        bin_dir.display()
                    ),
                ])
                .output();
        }

        SmpInstallResult {
            ok: true,
            target_path: target_cmd.to_string_lossy().to_string(),
            in_path,
            message: format!("smp.cmd başarıyla kuruldu: {}", target_cmd.display()),
        }
    }
}

pub fn get_smp_cli_status() -> SmpInstallResult {
    let bin_dir = match get_user_bin_dir() {
        Some(d) => d,
        None => {
            return SmpInstallResult {
                ok: false,
                target_path: String::new(),
                in_path: false,
                message: "Home dir not found".to_string(),
            };
        }
    };

    #[cfg(not(target_os = "windows"))]
    let target = bin_dir.join("smp");
    #[cfg(target_os = "windows")]
    let target = bin_dir.join("smp.cmd");

    let exists = target.exists();
    let in_path = is_dir_in_path(&bin_dir);

    SmpInstallResult {
        ok: exists,
        target_path: target.to_string_lossy().to_string(),
        in_path,
        message: if exists && in_path {
            "smp CLI aracı PATH üzerinde kullanıma hazır".to_string()
        } else if exists {
            "smp kurulu ancak PATH henüz güncellenmemiş olabilir".to_string()
        } else {
            "smp kurulu değil".to_string()
        },
    }
}

#[cfg(not(target_os = "windows"))]
fn ensure_shell_path_configured(_bin_dir: &Path) {
    if let Some(home) = dirs::home_dir() {
        let export_line = "\n# Serial Monitor Pro CLI (smp)\nexport PATH=\"$HOME/.local/bin:$PATH\"\n";

        // Bash
        let bashrc = home.join(".bashrc");
        if bashrc.exists() {
            if let Ok(content) = fs::read_to_string(&bashrc) {
                if !content.contains(".local/bin") {
                    use std::io::Write;
                    let _ = fs::OpenOptions::new().append(true).open(&bashrc).and_then(|mut f| {
                        f.write_all(export_line.as_bytes())
                    });
                }
            }
        }

        // Zsh
        let zshrc = home.join(".zshrc");
        if zshrc.exists() {
            if let Ok(content) = fs::read_to_string(&zshrc) {
                if !content.contains(".local/bin") {
                    use std::io::Write;
                    let _ = fs::OpenOptions::new().append(true).open(&zshrc).and_then(|mut f| {
                        f.write_all(export_line.as_bytes())
                    });
                }
            }
        }

        // Fish shell
        let fish_dir = home.join(".config").join("fish");
        let fish_config = fish_dir.join("config.fish");
        if fish_config.exists() {
            if let Ok(content) = fs::read_to_string(&fish_config) {
                if !content.contains(".local/bin") {
                    use std::io::Write;
                    let fish_line = "\n# Serial Monitor Pro CLI (smp)\nfish_add_path ~/.local/bin\n";
                    let _ = fs::OpenOptions::new().append(true).open(&fish_config).and_then(|mut f| {
                        f.write_all(fish_line.as_bytes())
                    });
                }
            }
        }
    }
}
