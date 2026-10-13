/**
 * Filter utility functions for multi-tag OR filtering and variable mode.
 */

import {
  isVariableExpression,
  checkLineVariableExpression,
  extractVariablesFromLine,
} from './variableFilter';

export {
  isVariableExpression,
  checkLineVariableExpression,
  extractVariablesFromLine,
};

/**
 * Checks whether a single log line matches any of the given filter terms (OR logic: A or B).
 * Supports both standard string/regex matching and variable arithmetic/logic expressions.
 * Returns true if filterTerms is empty (no filtering active).
 */
export function isLineMatchingFilters(
  line: string,
  filterTerms: string[],
  matchCase: boolean,
  isRegex: boolean,
  isVariableMode: boolean = false
): boolean {
  if (!filterTerms || filterTerms.length === 0) return true;

  return filterTerms.some((term) => {
    const trimmed = term.trim();
    if (!trimmed) return false;

    // Check if variable mode is toggled OR the term is recognized as a variable expression
    if (isVariableMode || isVariableExpression(trimmed)) {
      return checkLineVariableExpression(line, trimmed, matchCase);
    }

    if (isRegex) {
      try {
        const regex = new RegExp(trimmed, matchCase ? '' : 'i');
        return regex.test(line);
      } catch {
        return false;
      }
    }

    if (matchCase) {
      return line.includes(trimmed);
    }
    return line.toLowerCase().includes(trimmed.toLowerCase());
  });
}

/**
 * Formats a list of filter terms into a description string for copy and export headers.
 * e.g. "fps > 10" OR "sync = true"
 */
export function formatFilterDescription(filterTerms: string[]): string {
  const valid = (filterTerms || []).map((t) => t.trim()).filter(Boolean);
  if (valid.length === 0) return '';
  return valid.map((t) => `"${t}"`).join(' OR ');
}
