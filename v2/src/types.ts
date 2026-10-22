export interface SerialDeviceInfo {
  port_name: string;
  display_name: string;
  description: string;
  manufacturer: string | null;
  vid: number | null;
  pid: number | null;
  is_esp: boolean;
  is_arduino: boolean;
  category: string;
}

export interface ArchiveEntry {
  filename: string;
  path: string;
  port: string;
  date: string;
  size_bytes: number;
  size_str: string;
}

export interface SerialDataPayload {
  session_id: string;
  line: string;
  rx_bytes: number;
  tx_bytes: number;
}

export interface SerialStatusPayload {
  session_id: string;
  port_name: string;
  baud_rate: number;
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  message: string;
}

export interface PanelSession {
  id: string;
  title: string;
  port: string;
  baudRate: number;
  isConnected: boolean;
  isReconnecting: boolean;
  autoReconnect: boolean;
  reconnectAttempts: number;
  resetOnConnect: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  lines: string[];
  rawLines: string[];
  pointA: number | null;
  pointB: number | null;
  rxBytes: number;
  txBytes: number;
  isReference: boolean;
  width: number;
  commandHistory: string[];
  historyIndex: number;
  autoNamingRule?: string;
  autoNamingEnabled?: boolean;
  isArmed?: boolean;
  wasTriggered?: boolean;
  autoCloseEnabled?: boolean;
  autoCloseTimeoutSec?: number;
  pins: LogPin[];
}

export type TagShape = 'circle' | 'square' | 'triangle' | 'pentagon' | 'diamond';

export interface QuickTagPreset {
  id: string;
  key: string;
  color: string;
  shape: TagShape;
  emoji: string;
  description: string;
}

export interface LogPin {
  id: string;
  lineIndex: number;
  timestamp: string | number;
  note?: string;
  text?: string;
  lineContent?: string;
  tagPresetId?: string;
  shape?: TagShape;
  color?: string;
  emoji?: string;
  description?: string;
  key?: string;
}

export interface AiModelClient {
  id: string;
  model_name: string;
  client_id: string;
  active_port?: string;
  session_id?: string;
  last_seen_sec: number;
  last_command: string;
  registered_at: string;
}

export interface AiCommandLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  payload: string;
  response: string;
  status: number;
  command?: string;
  model_name?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  tags: string[];
  triggerTags?: string[];
  isVariableMode?: boolean;
  matchCase?: boolean;
  isRegex?: boolean;
  createdAt: number;
}

export interface TriggerActionsConfig {
  enabled: boolean;
  armedMode: boolean; // tetikleme açıksa tetiklene kadar filtrelenmiş kelimeli satırlar dışında hiçbir kayıt tutulmaz
  playAudio: boolean;
  httpsTrigger: boolean;
  httpsWebhookUrl: string;
  httpsMethod: 'POST' | 'GET';
  restartConnection: boolean;
  sendSerialCommand: boolean;
  serialCommandText: string;
  endSerialConnection: boolean;
}

export interface AutoNamingConfig {
  enabled: boolean;
  rule: string; // e.g. "esp-rom:" or "esp-rom"+
}

export interface GDriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface GDriveUser {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
  refreshToken?: string;
  isPermanent?: boolean;
}

export type I18nLanguage = 'tr' | 'en';

declare global {
  interface Window {
    __hoveredPanelId?: string | null;
    __lastActivePanelId?: string | null;
  }
}
