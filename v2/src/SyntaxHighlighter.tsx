import React, { memo } from 'react';
import { getMatchingThemeForToken, TagColorTheme } from './filterColors';

interface SyntaxHighlighterProps {
  line: string;
  highlightWord?: string;
  filterTerms?: string[];
  allFilterTags?: string[];
  matchCase?: boolean;
  onWordClick: (word: string) => void;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = memo(({
  line,
  highlightWord,
  filterTerms,
  allFilterTags,
  matchCase = false,
  onWordClick,
}) => {
  // Check for critical crash headers
  if (line.includes('Guru Meditation Error') || line.includes('abort() was called')) {
    return (
      <span className="text-rose-400 bg-rose-950/60 font-bold px-1.5 py-0.5 rounded ring-1 ring-rose-500/50">
        {line}
      </span>
    );
  }

  // Tokenization regex: matches words, hex values, numbers, tags, or punctuation
  const tokenRegex = /(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z0-9_]+\b|[^\sA-Za-z0-9_]+|\s+)/g;
  const tokens = line.match(tokenRegex) || [line];

  return (
    <span>
      {tokens.map((token, index) => {
        // Whitespace preservation
        if (/^\s+$/.test(token)) {
          return <span key={index}>{token}</span>;
        }

        const isClickedWord =
          highlightWord &&
          highlightWord.length > 0 &&
          token.toLowerCase() === highlightWord.toLowerCase();

        const matchingTagTheme: TagColorTheme | null =
          filterTerms && filterTerms.length > 0
            ? getMatchingThemeForToken(token, filterTerms, allFilterTags || filterTerms, matchCase)
            : null;

        const highlightClass = isClickedWord
          ? 'bg-amber-400/30 text-amber-200 ring-1 ring-amber-400 font-bold px-0.5 rounded'
          : matchingTagTheme
          ? `font-bold px-0.5 rounded ${matchingTagTheme.tokenClass}`
          : '';

        // 1. Hex address / value: 0x...
        if (/^0x[0-9a-fA-F]+$/i.test(token)) {
          return (
            <span
              key={index}
              onClick={(e) => { e.stopPropagation(); onWordClick(token); }}
              className={`cursor-pointer transition-colors ${
                highlightClass
                  ? highlightClass
                  : 'text-cyan-400 font-semibold hover:underline'
              }`}
            >
              {token}
            </span>
          );
        }

        // 2. Pure Numbers
        if (/^\d+(?:\.\d+)?$/.test(token)) {
          return (
            <span
              key={index}
              onClick={(e) => { e.stopPropagation(); onWordClick(token); }}
              className={`cursor-pointer transition-colors ${
                highlightClass
                  ? highlightClass
                  : 'text-amber-300 font-medium hover:underline'
              }`}
            >
              {token}
            </span>
          );
        }

        // 3. ESP Log Level Tags (E, W, I, D, V)
        if (token === 'E' || token === '[E]') {
          return <span key={index} className="text-red-400 font-bold bg-red-950/40 px-1 rounded">{token}</span>;
        }
        if (token === 'W' || token === '[W]') {
          return <span key={index} className="text-amber-400 font-semibold bg-amber-950/40 px-1 rounded">{token}</span>;
        }
        if (token === 'I' || token === '[I]') {
          return <span key={index} className="text-emerald-400 font-medium">{token}</span>;
        }
        if (token === 'D' || token === '[D]') {
          return <span key={index} className="text-sky-400 font-medium">{token}</span>;
        }
        if (token === 'V' || token === '[V]') {
          return <span key={index} className="text-purple-400">{token}</span>;
        }

        // 4. Special Keywords (boot, rst, clk, title)
        if (token.toLowerCase() === 'title') {
          return <span key={index} className="text-purple-400 font-bold">{token}</span>;
        }
        if (['rst', 'boot', 'configsip', 'clk_drv', 'mode'].includes(token.toLowerCase())) {
          return <span key={index} className="text-orange-400 font-medium">{token}</span>;
        }

        // 5. Normal Alphanumeric Word (Clickable)
        if (/^[A-Za-z0-9_]+$/.test(token)) {
          return (
            <span
              key={index}
              onClick={(e) => { e.stopPropagation(); onWordClick(token); }}
              className={`cursor-pointer transition-colors ${
                highlightClass
                  ? highlightClass
                  : 'text-slate-200 hover:text-cyan-300 hover:underline'
              }`}
            >
              {token}
            </span>
          );
        }

        // 6. Symbols, Brackets, Punctuation
        return (
          <span key={index} className="text-slate-500">
            {token}
          </span>
        );
      })}
    </span>
  );
});
