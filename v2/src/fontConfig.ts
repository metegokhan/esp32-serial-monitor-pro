export interface FontOption {
  id: string;
  label: string;
  css: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'JetBrains Mono', label: 'JetBrains Mono', css: "'JetBrains Mono', 'Fira Code', monospace" },
  { id: 'Fira Code', label: 'Fira Code', css: "'Fira Code', 'JetBrains Mono', monospace" },
  { id: 'Cascadia Code', label: 'Cascadia Code', css: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace" },
  { id: 'Consolas', label: 'Consolas', css: "Consolas, 'Courier New', monospace" },
  { id: 'Roboto Mono', label: 'Roboto Mono', css: "'Roboto Mono', monospace" },
  { id: 'Source Code Pro', label: 'Source Code Pro', css: "'Source Code Pro', monospace" },
  { id: 'Monaco', label: 'Monaco / Menlo', css: "Monaco, Menlo, monospace" },
  { id: 'Courier New', label: 'Courier New', css: "'Courier New', Courier, monospace" },
  { id: 'System Monospace', label: 'System Monospace', css: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
];

export const FONT_SIZE_OPTIONS: number[] = [9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

export function getFontCss(fontId: string): string {
  const found = FONT_OPTIONS.find((f) => f.id === fontId);
  return found ? found.css : "'JetBrains Mono', monospace";
}
