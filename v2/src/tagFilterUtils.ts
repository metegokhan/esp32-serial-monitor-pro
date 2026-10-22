import { LogPin } from './types';

export interface TagFilterParsed {
  isTagFilter: boolean;
  tagName?: string;
  contextLines: number;
}

/**
 * Parses terms like:
 * - "tag" => { isTagFilter: true, tagName: undefined, contextLines: 0 }
 * - "tag+5", "tag-5", "tag+-5" => { isTagFilter: true, tagName: undefined, contextLines: 5 }
 * - "tag:ekran hatası+5" => { isTagFilter: true, tagName: "ekran hatası", contextLines: 5 }
 * - "tag:cızırtı" => { isTagFilter: true, tagName: "cızırtı", contextLines: 0 }
 * - "#ekran hatası+5" => { isTagFilter: true, tagName: "ekran hatası", contextLines: 5 }
 * - "#cızırtı" => { isTagFilter: true, tagName: "cızırtı", contextLines: 0 }
 */
export function parseTagFilterTerm(term: string): TagFilterParsed | null {
  const trimmed = term.trim();
  if (!trimmed) return null;

  // Case 1: starts with "tag" (case-insensitive)
  // e.g. "tag", "tag+5", "tag-5", "tag+-5", "tag:ekran hatası+5", "tag:cızırtı"
  const tagRegex = /^tag(?::\s*|\s+)?(.*?)(?:(?:\+|\-|\+\-)(\d+))?$/i;
  const tagMatch = trimmed.match(tagRegex);
  if (tagMatch) {
    const rawName = tagMatch[1]?.trim() || '';
    const context = tagMatch[2] ? parseInt(tagMatch[2], 10) : 0;
    return {
      isTagFilter: true,
      tagName: rawName.length > 0 ? rawName : undefined,
      contextLines: isNaN(context) ? 0 : Math.max(0, context),
    };
  }

  // Case 2: starts with "#"
  // e.g. "#tag", "#tag+5", "#ekran hatası+5", "#cızırtı"
  const hashRegex = /^#(.*?)(?:(?:\+|\-|\+\-)(\d+))?$/i;
  const hashMatch = trimmed.match(hashRegex);
  if (hashMatch) {
    let rawName = hashMatch[1]?.trim() || '';
    if (rawName.toLowerCase() === 'tag') rawName = '';
    const context = hashMatch[2] ? parseInt(hashMatch[2], 10) : 0;
    return {
      isTagFilter: true,
      tagName: rawName.length > 0 ? rawName : undefined,
      contextLines: isNaN(context) ? 0 : Math.max(0, context),
    };
  }

  return null;
}

/**
 * Checks whether a pin matches an optional tag name filter.
 */
function isPinMatchingTagName(pin: LogPin, targetName?: string): boolean {
  if (!targetName) return true;
  const q = targetName.toLowerCase();

  if (pin.key && pin.key.toLowerCase() === q) return true;
  if (pin.description && pin.description.toLowerCase().includes(q)) return true;
  if (pin.note && pin.note.toLowerCase().includes(q)) return true;
  if (pin.text && pin.text.toLowerCase().includes(q)) return true;
  if (pin.emoji && pin.emoji === targetName.trim()) return true;
  if (pin.shape && pin.shape.toLowerCase() === q) return true;

  return false;
}

/**
 * Computes the set of line indices that should be shown based on tag filters with context windows (+- N lines).
 */
export function getTagMatchingIndices(
  totalLines: number,
  pins: LogPin[] | undefined,
  filterTerms: string[]
): { tagFilteredIndices: Set<number>; hasTagFilter: boolean; tagFilterTerms: string[] } {
  const result = new Set<number>();
  const activePins = pins || [];
  const tagFilterTerms: string[] = [];

  for (const term of filterTerms) {
    const parsed = parseTagFilterTerm(term);
    if (parsed && parsed.isTagFilter) {
      tagFilterTerms.push(term);

      // Find matching pins
      for (const pin of activePins) {
        if (isPinMatchingTagName(pin, parsed.tagName)) {
          const center = pin.lineIndex;
          const delta = parsed.contextLines;

          if (delta === 0) {
            if (center >= 0 && center < totalLines) {
              result.add(center);
            }
          } else {
            const start = Math.max(0, center - delta);
            const end = Math.min(totalLines - 1, center + delta);
            for (let idx = start; idx <= end; idx++) {
              result.add(idx);
            }
          }
        }
      }
    }
  }

  return {
    tagFilteredIndices: result,
    hasTagFilter: tagFilterTerms.length > 0,
    tagFilterTerms,
  };
}
