use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub user_email: Option<String>,
    pub user_name: Option<String>,
}

fn percent_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn extract_query_param(req: &str, param: &str) -> Option<String> {
    // Find the first line (e.g. GET /oauth/callback?code=... HTTP/1.1)
    let first_line = req.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut parts = pair.split('=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k == param {
                // Decode %XX
                let mut decoded = String::new();
                let mut chars = v.chars();
                while let Some(c) = chars.next() {
                    if c == '%' {
                        let h1 = chars.next();
                        let h2 = chars.next();
                        if let (Some(c1), Some(c2)) = (h1, h2) {
                            if let Ok(byte) = u8::from_str_radix(&format!("{}{}", c1, c2), 16) {
                                decoded.push(byte as char);
                                continue;
                            }
                        }
                    } else if c == '+' {
                        decoded.push(' ');
                        continue;
                    }
                    decoded.push(c);
                }
                return Some(decoded);
            }
        }
    }
    None
}

async fn exchange_code_for_tokens(
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    redirect_uri: &str,
) -> Result<GoogleAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params = vec![
        ("client_id", client_id),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
    ];
    if let Some(sec) = client_secret {
        if !sec.is_empty() {
            params.push(("client_secret", sec));
        }
    }

    let body_str = params
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("Google OAuth token takas hatası: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Google Token Takası Başarısız: {}", err_text));
    }

    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: String,
        refresh_token: Option<String>,
        expires_in: Option<u64>,
    }

    let parsed: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Token cevabı okunamadı: {}", e))?;

    // Fetch user info with the new access token
    let mut user_email = None;
    let mut user_name = None;
    if let Ok(info_resp) = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&parsed.access_token)
        .send()
        .await
    {
        if info_resp.status().is_success() {
            #[derive(Deserialize)]
            struct UserInfo {
                email: Option<String>,
                name: Option<String>,
            }
            if let Ok(info) = info_resp.json::<UserInfo>().await {
                user_email = info.email;
                user_name = info.name;
            }
        }
    }

    Ok(GoogleAuthTokens {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
        expires_in: parsed.expires_in,
        user_email,
        user_name,
    })
}

pub async fn start_oauth_flow(
    app: AppHandle,
    client_id: String,
    client_secret: Option<String>,
) -> Result<GoogleAuthTokens, String> {
    let port = 8989;
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("Port {} bağlanamadı (zaten kullanımda olabilir): {}", port, e))?;

    let redirect_uri = format!("http://127.0.0.1:{}/oauth/callback", port);
    let scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        percent_encode(&client_id),
        percent_encode(&redirect_uri),
        percent_encode(scopes)
    );

    // Open URL in default browser
    let _ = open_in_browser(&auth_url);

    // Wait for the browser callback with a 180s timeout
    let timeout_duration = std::time::Duration::from_secs(180);
    let code_result = tokio::time::timeout(timeout_duration, async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buffer = [0u8; 4096];
            let bytes_read = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
            let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);

            if req_str.contains("/oauth/callback") {
                let code = extract_query_param(&req_str, "code");
                let error = extract_query_param(&req_str, "error");

                if let Some(err_msg) = error {
                    let html = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
                        <!DOCTYPE html><html><body style=\"background:#0f111a;color:#f38ba8;font-family:sans-serif;padding:40px;text-align:center;\">\
                        <h2>❌ Giriş İptal Edildi veya Hata Oluştu</h2><p>Hata: {}</p></body></html>",
                        err_msg
                    );
                    let _ = stream.write_all(html.as_bytes()).await;
                    return Err(format!("Google yetkilendirme hatası: {}", err_msg));
                }

                if let Some(c) = code {
                    let html = "\
                        HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
                        <!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Giriş Başarılı</title></head>\
                        <body style=\"background:#0f111a;color:#cdd6f4;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;\">\
                        <div style=\"background:#181a29;border:1px solid #2d3047;border-radius:16px;padding:36px;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,0.5);max-width:440px;\">\
                        <h1 style=\"color:#10b981;font-size:22px;margin-bottom:8px;\">✅ Google Drive Bağlandı!</h1>\
                        <p style=\"color:#a6adc8;font-size:14px;line-height:1.5;\">Kalıcı oturum anahtarı (Refresh Token) başarıyla alındı. ESP32 Serial Monitor Pro'ya dönebilirsiniz.</p>\
                        <p style=\"color:#6c7086;font-size:12px;margin-top:20px;\">Bu sekmeyi kapatabilirsiniz.</p>\
                        </div></body></html>";
                    let _ = stream.write_all(html.as_bytes()).await;
                    let _ = stream.flush().await;
                    return Ok(c);
                }
            } else {
                let _ = stream
                    .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    .await;
            }
        }
    })
    .await
    .map_err(|_| "Zaman aşımı: 3 dakika içinde tarayıcıdan giriş tamamlanmadı.".to_string())??;

    // Exchange code for tokens
    let tokens = exchange_code_for_tokens(
        &client_id,
        client_secret.as_deref(),
        &code_result,
        &redirect_uri,
    )
    .await?;

    let _ = app.emit("google-auth-success", &tokens);
    Ok(tokens)
}

pub async fn refresh_access_token(
    client_id: &str,
    client_secret: Option<&str>,
    refresh_token: &str,
) -> Result<GoogleAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params = vec![
        ("client_id", client_id),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];
    if let Some(sec) = client_secret {
        if !sec.is_empty() {
            params.push(("client_secret", sec));
        }
    }

    let body_str = params
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("Token yenileme HTTP hatası: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Google token yenileme reddedildi: {}", err_text));
    }

    #[derive(Deserialize)]
    struct TokenResp {
        access_token: String,
        expires_in: Option<u64>,
    }

    let parsed: TokenResp = resp
        .json()
        .await
        .map_err(|e| format!("Token JSON okunamadı: {}", e))?;

    Ok(GoogleAuthTokens {
        access_token: parsed.access_token,
        refresh_token: Some(refresh_token.to_string()),
        expires_in: parsed.expires_in,
        user_email: None,
        user_name: None,
    })
}
