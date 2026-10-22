import { invoke } from '@tauri-apps/api/core';
import { GDriveFileInfo, GDriveUser } from './types';

const FOLDER_NAME = 'ESP32 Serial Monitor Pro';

interface HttpResponse {
  status: u16;
  ok: boolean;
  body: string;
}
type u16 = number;

async function driveRequest(
  url: string,
  method: string,
  token: string,
  body?: string,
  contentType: string = 'application/json',
  retryCount: number = 0
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const activeToken = token || GoogleDriveService.getAccessToken() || '';
    const res = await invoke<HttpResponse>('http_request', {
      options: {
        url,
        method,
        headers: {
          Authorization: `Bearer ${activeToken.trim()}`,
          'Content-Type': contentType,
        },
        body,
      },
    });

    let data: unknown = null;
    try {
      data = JSON.parse(res.body);
    } catch {
      data = res.body;
    }

    // Auto-refresh token if 401 Unauthorized and refresh_token is available
    if (res.status === 401 && retryCount === 0 && GoogleDriveService.getRefreshToken()) {
      console.log('🔄 Access token süresi dolmuş, refresh_token ile yenileniyor...');
      try {
        const newToken = await GoogleDriveService.refreshAccessToken();
        return driveRequest(url, method, newToken, body, contentType, retryCount + 1);
      } catch (refreshErr) {
        console.warn('Otomatik token yenileme başarısız:', refreshErr);
      }
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('driveRequest error:', err);
    throw new Error(String(err));
  }
}

export class GoogleDriveService {
  private static TOKEN_KEY = 'gdrive_access_token';
  private static REFRESH_TOKEN_KEY = 'gdrive_refresh_token';
  private static USER_KEY = 'gdrive_user_profile';
  private static CLIENT_ID_KEY = 'gdrive_client_id';
  private static CLIENT_SECRET_KEY = 'gdrive_client_secret';

  static getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setAccessToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token.trim());
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string) {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token.trim());
  }

  static getSavedClientId(): string {
    return localStorage.getItem(this.CLIENT_ID_KEY) || '';
  }

  static setSavedClientId(clientId: string) {
    localStorage.setItem(this.CLIENT_ID_KEY, clientId.trim());
  }

  static getSavedClientSecret(): string {
    return localStorage.getItem(this.CLIENT_SECRET_KEY) || '';
  }

  static setSavedClientSecret(secret: string) {
    localStorage.setItem(this.CLIENT_SECRET_KEY, secret.trim());
  }

  static getSavedUser(): GDriveUser | null {
    try {
      const saved = localStorage.getItem(this.USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  static setSavedUser(user: GDriveUser | null) {
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  static logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Tarayıcı üzerinden tek tıkla OAuth 2.0 loopback flow başlatır.
   * Refresh Token alarak kalıcı oturum sağlar (Tampermonkey tarzı).
   */
  static async startBrowserOAuthFlow(clientId: string, clientSecret?: string): Promise<GDriveUser> {
    const cleanId = clientId.trim();
    if (!cleanId) {
      throw new Error('Lütfen geçerli bir Google OAuth Client ID girin.');
    }

    this.setSavedClientId(cleanId);
    if (clientSecret) {
      this.setSavedClientSecret(clientSecret.trim());
    }

    interface AuthTokensResult {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user_email?: string;
      user_name?: string;
    }

    const tokens = await invoke<AuthTokensResult>('start_google_oauth_flow', {
      clientId: cleanId,
      clientSecret: clientSecret?.trim() || null,
    });

    this.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      this.setRefreshToken(tokens.refresh_token);
    }

    const user: GDriveUser = {
      displayName: tokens.user_name || 'Google Drive Kullanıcısı',
      emailAddress: tokens.user_email || 'Kalıcı Oturum (Refresh Token)',
      refreshToken: tokens.refresh_token,
      isPermanent: !!tokens.refresh_token,
    };

    this.setSavedUser(user);
    return user;
  }

  /**
   * Refresh Token kullanarak arka planda sessizce yeni bir Access Token alır.
   */
  static async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    const clientId = this.getSavedClientId();
    const clientSecret = this.getSavedClientSecret();

    if (!refreshToken) {
      throw new Error('Kayıtlı refresh token bulunamadı.');
    }
    if (!clientId) {
      throw new Error('Kayıtlı Client ID bulunamadı.');
    }

    interface RefreshResult {
      access_token: string;
      expires_in?: number;
    }

    const res = await invoke<RefreshResult>('refresh_google_oauth_token', {
      clientId,
      clientSecret: clientSecret || null,
      refreshToken,
    });

    this.setAccessToken(res.access_token);
    return res.access_token;
  }

  /**
   * Google API hatalarını Türkçe ve açıklayıcı rehber formatında döndürür
   */
  static formatGoogleError(status: number, data: unknown): string {
    let rawMessage = '';
    if (typeof data === 'object' && data !== null) {
      const errObj = data as { error?: { message?: string; code?: number; status?: string } };
      if (errObj.error?.message) {
        rawMessage = errObj.error.message;
      } else {
        rawMessage = JSON.stringify(data);
      }
    } else {
      rawMessage = String(data || '');
    }

    if (
      status === 403 &&
      (rawMessage.toLowerCase().includes('insufficient') || rawMessage.toLowerCase().includes('scope'))
    ) {
      return (
        `[403 - Yetki Kapsamı Eksik]\n` +
        `Girdiğiniz Access Token Google Drive iznine sahip değil (Yalnızca e-posta/profil izni alınmış).\n\n` +
        `👉 Çözüm:\n` +
        `1. OAuth Playground'da Step 1 altında 'Drive API v3' listesini açın.\n` +
        `2. 'https://www.googleapis.com/auth/drive.file' kutucuğunu işaretleyin.\n` +
        `3. 'Authorize APIs' > 'Exchange authorization code' adımlarını tamamlayıp yeni token alın.`
      );
    }

    if (
      status === 403 &&
      (rawMessage.toLowerCase().includes('disabled') || rawMessage.toLowerCase().includes('not been used'))
    ) {
      return (
        `[403 - Google Drive API Kapalı]\n` +
        `Google Cloud projenizde "Google Drive API" etkinleştirilmemiş.\n\n` +
        `👉 Çözüm: Google Cloud Console > APIs & Services > Enable APIs > "Google Drive API" aratarak "Enable" butonuna basın.`
      );
    }

    if (status === 401) {
      return (
        `[401 - Oturum Geçersiz veya Süresi Dolmuş]\n` +
        `Access Token süresi dolmuş (Google tokenları varsayılan olarak 1 saat geçerlidir).\n\n` +
        `👉 Çözüm: Lütfen OAuth Playground üzerinden yeni bir Access Token alarak tekrar giriş yapın.`
      );
    }

    return `HTTP ${status}: ${rawMessage}`;
  }

  /**
   * Token ile hem kullanıcı profilini hem de doğrudan Google Drive yetkisini doğrular
   */
  static async verifyAndFetchUser(token: string): Promise<GDriveUser> {
    const cleanToken = token.trim();

    // 1. Doğrudan Google Drive API çağrısı ile Drive yetkisini test et
    const driveRes = await driveRequest(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      'GET',
      cleanToken
    );

    if (driveRes.ok) {
      const driveData = driveRes.data as {
        user?: { displayName?: string; emailAddress?: string; photoLink?: string };
      };
      const user: GDriveUser = {
        displayName: driveData.user?.displayName || 'Google Drive Kullanıcısı',
        emailAddress: driveData.user?.emailAddress,
        photoLink: driveData.user?.photoLink,
      };

      this.setAccessToken(cleanToken);
      this.setSavedUser(user);
      return user;
    }

    // 2. Drive çağrısı başarısız olduysa, userinfo ile token'ın geçerli olup olmadığını kontrol et
    const userinfoRes = await driveRequest(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      'GET',
      cleanToken
    );

    if (userinfoRes.ok) {
      // Token geçerli fakat Google Drive kapsamı verilmemiş!
      throw new Error(
        `Token geçerli ancak Google Drive iznine sahip değil (Yalnızca kullanıcı profili izni alınmış).\n\n` +
        `Google Drive'a log ve ayar kaydedebilmek için lütfen "https://www.googleapis.com/auth/drive.file" kapsamı ile yeni bir token oluşturun.`
      );
    }

    // Token tamamen geçersiz veya süresi dolmuş
    throw new Error(this.formatGoogleError(driveRes.status, driveRes.data));
  }

  /**
   * "ESP32 Serial Monitor Pro" klasörünün ID'sini bulur, yoksa oluşturur.
   */
  static async getOrCreateAppFolder(token: string): Promise<string | null> {
    // 1. Klasörü ara
    try {
      const query = encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`
      );
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

      const searchRes = await driveRequest(searchUrl, 'GET', token);
      if (searchRes.ok) {
        const files = (searchRes.data as { files?: { id: string }[] }).files;
        if (files && files.length > 0) {
          return files[0].id;
        }
      }
    } catch (e) {
      console.warn('Klasör arama hatası:', e);
    }

    // 2. Yoksa yeni oluştur
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const folderMeta = JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    });

    const createRes = await driveRequest(createUrl, 'POST', token, folderMeta);
    if (createRes.ok) {
      const data = createRes.data as { id: string };
      return data.id;
    }

    const errDetail = this.formatGoogleError(createRes.status, createRes.data);
    console.warn(`Klasör oluşturulamadı (${createRes.status}):`, errDetail);

    // Yetki veya oturum hatası ise açıkça bildir
    if (createRes.status === 403 || createRes.status === 401) {
      throw new Error(`Google Drive klasör hatası:\n${errDetail}`);
    }

    // Klasör oluşturulamasa dahi dosyaları Drive ana dizinine kaydetmek için null dönebilir
    return null;
  }

  /**
   * Google Drive klasörüne dosya yükler (Multipart upload)
   */
  static async uploadFile(
    filename: string,
    content: string,
    mimeType: string = 'text/plain'
  ): Promise<GDriveFileInfo> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Google Drive girişi yapılmamış.');

    // Klasör ID'sini al veya yoksa kök dizine yükle
    const folderId = await this.getOrCreateAppFolder(token);

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: Record<string, unknown> = {
      name: filename,
      mimeType,
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
      content +
      closeDelimiter;

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await driveRequest(
      uploadUrl,
      'POST',
      token,
      multipartRequestBody,
      `multipart/related; boundary=${boundary}`
    );

    if (!res.ok) {
      const errDetail = this.formatGoogleError(res.status, res.data);
      throw new Error(`Dosya yüklenemedi:\n${errDetail}`);
    }

    const data = res.data as { id: string; name: string; mimeType: string };
    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
    };
  }

  /**
   * Klasördeki dosyaları listeler
   */
  static async listFiles(): Promise<GDriveFileInfo[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Google Drive girişi yapılmamış.');

    let folderId: string | null = null;
    try {
      folderId = await this.getOrCreateAppFolder(token);
    } catch {
      folderId = null;
    }

    const query = folderId
      ? encodeURIComponent(`'${folderId}' in parents and trashed=false`)
      : encodeURIComponent(`(name contains 'ESP32' or name contains 'Filters' or name contains 'Settings' or name contains '.log') and trashed=false`);

    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=modifiedTime desc`;

    const res = await driveRequest(listUrl, 'GET', token);
    if (!res.ok) {
      const errDetail = this.formatGoogleError(res.status, res.data);
      throw new Error(`Dosyalar listelenemedi:\n${errDetail}`);
    }

    const files = (res.data as { files?: GDriveFileInfo[] }).files || [];
    return files;
  }

  /**
   * Dosya içeriğini indirir
   */
  static async downloadFile(fileId: string): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Google Drive girişi yapılmamış.');

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await driveRequest(downloadUrl, 'GET', token);
    if (!res.ok) {
      const errDetail = this.formatGoogleError(res.status, res.data);
      throw new Error(`Dosya indirilemedi:\n${errDetail}`);
    }

    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
  }

  /**
   * Dosyayı siler
   */
  static async deleteFile(fileId: string): Promise<void> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Google Drive girişi yapılmamış.');

    const delUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const res = await driveRequest(delUrl, 'DELETE', token);
    if (!res.ok && res.status !== 204) {
      const errDetail = this.formatGoogleError(res.status, res.data);
      throw new Error(`Dosya silinemedi:\n${errDetail}`);
    }
  }
}
