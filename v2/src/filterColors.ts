/**
 * Distinct color palettes and themes for multi-tag filters in Serial Monitor Pro.
 */

export interface TagColorTheme {
  id: string;
  name: string;
  // Toolbar Pill Styles
  pillClass: string;
  pillHoverClass: string;
  closeBtnClass: string;
  // Line Highlight Styles in LogPanel
  lineBgClass: string;
  lineBorderClass: string;
  // Token Highlight in SyntaxHighlighter
  tokenClass: string;
}

export const TAG_COLOR_THEMES: TagColorTheme[] = [
  {
    id: 'cyan',
    name: 'Cyan',
    pillClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
    pillHoverClass: 'hover:bg-cyan-900/80 hover:border-cyan-400',
    closeBtnClass: 'text-cyan-400 hover:text-white hover:bg-cyan-800/50',
    lineBgClass: 'bg-cyan-500/10',
    lineBorderClass: 'border-l-2 border-cyan-400',
    tokenClass: 'bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50',
  },
  {
    id: 'amber',
    name: 'Amber',
    pillClass: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    pillHoverClass: 'hover:bg-amber-900/80 hover:border-amber-400',
    closeBtnClass: 'text-amber-400 hover:text-white hover:bg-amber-800/50',
    lineBgClass: 'bg-amber-500/10',
    lineBorderClass: 'border-l-2 border-amber-400',
    tokenClass: 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/50',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    pillClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    pillHoverClass: 'hover:bg-emerald-900/80 hover:border-emerald-400',
    closeBtnClass: 'text-emerald-400 hover:text-white hover:bg-emerald-800/50',
    lineBgClass: 'bg-emerald-500/10',
    lineBorderClass: 'border-l-2 border-emerald-400',
    tokenClass: 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50',
  },
  {
    id: 'purple',
    name: 'Purple',
    pillClass: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    pillHoverClass: 'hover:bg-purple-900/80 hover:border-purple-400',
    closeBtnClass: 'text-purple-400 hover:text-white hover:bg-purple-800/50',
    lineBgClass: 'bg-purple-500/10',
    lineBorderClass: 'border-l-2 border-purple-400',
    tokenClass: 'bg-purple-500/25 text-purple-200 ring-1 ring-purple-400/50',
  },
  {
    id: 'rose',
    name: 'Rose',
    pillClass: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
    pillHoverClass: 'hover:bg-rose-900/80 hover:border-rose-400',
    closeBtnClass: 'text-rose-400 hover:text-white hover:bg-rose-800/50',
    lineBgClass: 'bg-rose-500/10',
    lineBorderClass: 'border-l-2 border-rose-400',
    tokenClass: 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50',
  },
  {
    id: 'sky',
    name: 'Sky',
    pillClass: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
    pillHoverClass: 'hover:bg-sky-900/80 hover:border-sky-400',
    closeBtnClass: 'text-sky-400 hover:text-white hover:bg-sky-800/50',
    lineBgClass: 'bg-sky-500/10',
    lineBorderClass: 'border-l-2 border-sky-400',
    tokenClass: 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/50',
  },
  {
    id: 'orange',
    name: 'Orange',
    pillClass: 'bg-orange-950/80 text-orange-300 border-orange-500/40',
    pillHoverClass: 'hover:bg-orange-900/80 hover:border-orange-400',
    closeBtnClass: 'text-orange-400 hover:text-white hover:bg-orange-800/50',
    lineBgClass: 'bg-orange-500/10',
    lineBorderClass: 'border-l-2 border-orange-400',
    tokenClass: 'bg-orange-500/25 text-orange-200 ring-1 ring-orange-400/50',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia',
    pillClass: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/40',
    pillHoverClass: 'hover:bg-fuchsia-900/80 hover:border-fuchsia-400',
    closeBtnClass: 'text-fuchsia-400 hover:text-white hover:bg-fuchsia-800/50',
    lineBgClass: 'bg-fuchsia-500/10',
    lineBorderClass: 'border-l-2 border-fuchsia-400',
    tokenClass: 'bg-fuchsia-500/25 text-fuchsia-200 ring-1 ring-fuchsia-400/50',
  },
];

export function getTagThemeByIndex(index: number): TagColorTheme {
  const i = Math.abs(index) % TAG_COLOR_THEMES.length;
  return TAG_COLOR_THEMES[i];
}

export function getTagThemeByTag(tag: string, allTags: string[]): TagColorTheme {
  const idx = allTags.indexOf(tag);
  if (idx !== -1) {
    return getTagThemeByIndex(idx);
  }
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return getTagThemeByIndex(hash);
}

export function getMatchingThemeForToken(
  token: string,
  filterTerms: string[],
  allTags: string[],
  matchCase: boolean = false
): TagColorTheme | null {
  if (!filterTerms || filterTerms.length === 0) return null;
  const RESERVED = new Set(['ve', 'and', 'yada', 'veya', 'or', 'not', 'true', 'false', 'ikincisi', 'ikinci', 'ise', 'x']);

  for (const ft of filterTerms) {
    const trimmed = ft.trim();
    if (!trimmed) continue;

    // Direct substring or exact match
    if (matchCase ? token.includes(trimmed) : token.toLowerCase().includes(trimmed.toLowerCase())) {
      return getTagThemeByTag(trimmed, allTags);
    }

    // Expression identifiers (e.g. variable names in expressions like fps > 10)
    const exprWords = trimmed.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    if (exprWords) {
      const isVar = exprWords.some((w) => {
        if (RESERVED.has(w.toLowerCase())) return false;
        return matchCase ? token === w : token.toLowerCase() === w.toLowerCase();
      });
      if (isVar) {
        return getTagThemeByTag(trimmed, allTags);
      }
    }
  }

  return null;
}
