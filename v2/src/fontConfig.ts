export interface FontOption {
  id: string;
  label: string;
  css: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'JetBrains Mono', label: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
  { id: 'Fira Code', label: 'Fira Code', css: "'Fira Code', monospace" },
  { id: 'Roboto Mono', label: 'Roboto Mono', css: "'Roboto Mono', monospace" },
  { id: 'Source Code Pro', label: 'Source Code Pro', css: "'Source Code Pro', monospace" },
  { id: 'Cascadia Code', label: 'Cascadia Code', css: "'Cascadia Code', Consolas, monospace" },
  { id: 'Consolas', label: 'Consolas', css: "Consolas, monospace" },
  { id: 'Monaco', label: 'Monaco', css: "Monaco, Menlo, monospace" },
  { id: 'Courier New', label: 'Courier New', css: "'Courier New', monospace" },
  { id: 'System Monospace', label: 'System Monospace', css: 'monospace' },
];

export const FONT_SIZE_OPTIONS: number[] = [9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

export function getFontCss(fontId: string): string {
  const found = FONT_OPTIONS.find((f) => f.id === fontId);
  return found ? found.css : "'JetBrains Mono', monospace";
}
