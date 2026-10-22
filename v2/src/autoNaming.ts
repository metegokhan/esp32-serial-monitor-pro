/**
 * Otomatik Panel İsimlendirme Kuralı Değerlendiricisi
 * 
 * Kural Sözdizimi:
 * 1) "esp-rom:" -> anahtar kelimeden sonrası satır sonuna kadar alınır (örn: "esp32p4-eco2-20240710")
 * 2) "esp-rom"+ -> anahtar kelime dahil tüm satır başlık olarak alınır
 */

export function sanitizeTitle(raw: string): string {
  // Kontrol karakterlerini ve dosya sistemlerinde geçersiz karakterleri temizle
  return raw
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

export function evaluateAutoNaming(line: string, rawRule: string): string | null {
  if (!line || !rawRule) return null;

  // Çevreleyen tırnakları ve boşlukları temizle
  let rule = rawRule.trim().replace(/^["']|["']$/g, '').trim();
  if (!rule) return null;

  const isFullLineMode = rule.endsWith('+');
  if (isFullLineMode) {
    const keyword = rule.slice(0, -1).trim().toLowerCase();
    if (!keyword) return null;
    if (line.toLowerCase().includes(keyword)) {
      return sanitizeTitle(line);
    }
    return null;
  }

  // Standart mod: anahtar kelimeden sonrası
  const keyword = rule.toLowerCase();
  const lowerLine = line.toLowerCase();
  const idx = lowerLine.indexOf(keyword);

  if (idx !== -1) {
    const after = line.substring(idx + keyword.length).trim();
    if (after) {
      return sanitizeTitle(after);
    }
  }

  return null;
}
