use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellExecutionResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub platform: String,
    pub command: String,
}

pub fn execute_shell(
    command: &str,
    cwd: Option<&str>,
    _timeout_sec: Option<u64>,
) -> Result<ShellExecutionResult, String> {
    let start = Instant::now();

    #[cfg(target_os = "windows")]
    let (program, args, platform) = (
        "powershell",
        vec!["-NoProfile", "-NonInteractive", "-Command", command],
        "windows",
    );

    #[cfg(not(target_os = "windows"))]
    let (program, args, platform) = {
        let sh = if std::path::Path::new("/bin/bash").exists() {
            "/bin/bash"
        } else {
            "sh"
        };
        (sh, vec!["-c", command], "linux")
    };

    let mut cmd = std::process::Command::new(program);
    cmd.args(&args);

    if let Some(dir) = cwd {
        if !dir.trim().is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Kabuk komutu çalıştırılamadı ({platform} - {program}): {e}"))?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(ShellExecutionResult {
        ok: output.status.success(),
        stdout,
        stderr,
        exit_code,
        duration_ms,
        platform: platform.to_string(),
        command: command.to_string(),
    })
}
