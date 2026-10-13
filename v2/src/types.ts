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

export type I18nLanguage = 'tr' | 'en';
