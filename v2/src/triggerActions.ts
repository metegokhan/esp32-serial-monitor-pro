import { invoke } from '@tauri-apps/api/core';
import { TriggerActionsConfig } from './types';

export const DEFAULT_TRIGGER_CONFIG: TriggerActionsConfig = {
  enabled: true,
  armedMode: false,
  playAudio: true,
  httpsTrigger: false,
  httpsWebhookUrl: '',
  httpsMethod: 'POST',
  restartConnection: false,
  sendSerialCommand: false,
  serialCommandText: 'reboot',
  endSerialConnection: false,
};

export function loadTriggerConfig(): TriggerActionsConfig {
  try {
    const saved = localStorage.getItem('serial_trigger_config');
    if (saved) {
      return { ...DEFAULT_TRIGGER_CONFIG, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('Error reading trigger config:', err);
  }
  return { ...DEFAULT_TRIGGER_CONFIG };
}

export function saveTriggerConfig(cfg: TriggerActionsConfig) {
  try {
    localStorage.setItem('serial_trigger_config', JSON.stringify(cfg));
  } catch (err) {
    console.warn('Error saving trigger config:', err);
  }
}

/**
 * Web Audio API ile sıfır harici dosya bağımlılığı olmadan kristal netliğinde uyarı sesi çalar.
 */
export function playTriggerSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Birinci zil frekansı (880 Hz -> 1320 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // İkinci armonik vuruş (1760 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now + 0.1);
    gain2.gain.setValueAtTime(0.28, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

export interface TriggerExecutionContext {
  panelId: string;
  port: string;
  panelTitle: string;
  matchedLine: string;
  triggerWord: string;
}

export interface TriggerActionCallbacks {
  onNotification: (msg: string) => void;
  onSendCommand?: (panelId: string, cmd: string) => Promise<void>;
  onRestartConnection?: (panelId: string) => Promise<void>;
  onEndConnection?: (panelId: string) => Promise<void>;
}

export async function executeTriggerActions(
  config: TriggerActionsConfig,
  context: TriggerExecutionContext,
  callbacks: TriggerActionCallbacks
) {
  if (!config.enabled) return;

  // 1. Ses Çalma
  if (config.playAudio) {
    playTriggerSound();
  }

  // 2. HTTPS Webhook Tetikleme
  if (config.httpsTrigger && config.httpsWebhookUrl.trim()) {
    const payload = JSON.stringify({
      event: 'serial_trigger_hit',
      timestamp: new Date().toISOString(),
      triggerWord: context.triggerWord,
      matchedLine: context.matchedLine,
      panelId: context.panelId,
      port: context.port,
      panelTitle: context.panelTitle,
    });

    try {
      // Rust HTTP komutunu çağır (WebKit CORS kısıtlamalarını aşar)
      await invoke('http_request', {
        options: {
          url: config.httpsWebhookUrl.trim(),
          method: config.httpsMethod || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SerialMonitorPro/2.0',
          },
          body: config.httpsMethod === 'POST' ? payload : undefined,
        },
      });
      callbacks.onNotification(`🌐 Webhook tetiklendi (${config.httpsMethod})`);
    } catch (err) {
      console.error('Webhook error:', err);
      callbacks.onNotification(`⚠️ Webhook hatası: ${err}`);
    }
  }

  // 3. Seri Porta Komut Gönderme
  if (config.sendSerialCommand && config.serialCommandText.trim() && callbacks.onSendCommand) {
    try {
      await callbacks.onSendCommand(context.panelId, config.serialCommandText.trim());
      callbacks.onNotification(`📤 Seri komut gönderildi: "${config.serialCommandText.trim()}"`);
    } catch (err) {
      console.error('Send serial cmd error:', err);
      callbacks.onNotification(`⚠️ Seri komut hatası: ${err}`);
    }
  }

  // 4. Bağlantıyı Yeniden Başlatma (Restart Connection)
  if (config.restartConnection && callbacks.onRestartConnection) {
    try {
      callbacks.onNotification(`🔄 Port bağlantısı yeniden başlatılıyor...`);
      await callbacks.onRestartConnection(context.panelId);
    } catch (err) {
      console.error('Restart connection error:', err);
    }
  }

  // 5. Bağlantıyı Sonlandırma (End Serial Connection)
  if (config.endSerialConnection && callbacks.onEndConnection) {
    try {
      callbacks.onNotification(`⏹️ Tetikleyici nedeniyle bağlantı sonlandırıldı.`);
      await callbacks.onEndConnection(context.panelId);
    } catch (err) {
      console.error('End connection error:', err);
    }
  }
}
