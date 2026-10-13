/**
 * Variable extraction and arithmetic/logic expression evaluation.
 *
 * Automatically parses:
 *   1. Explicit pairs: `key: value`, `key = value`
 *   2. Space-separated values: `aralik 69`, `gercek aralik 69 ms`, `latency 13 ms`, `temp 25.4 C`
 *
 * And evaluates expressions like:
 *   - `fps > 10`
 *   - `sync = true`
 *   - `aralik > 50` / `gercek aralik > 50` / `gercek_aralik > 50`
 *   - `fps =! 15`
 *   - `fps > 5 ve sync = true`
 *   - `fps x audio > 1200`
 *   - `fps > 10 yada sync = true yada fps =! 15`
 */

export interface ExtractedVariables {
  [key: string]: number | boolean | string;
}

const MISSING_VAL = Symbol('MISSING_VAL');

// Standard physical/measurement units to avoid treating units as next variable names
const COMMON_UNITS = new Set([
  'ms', 'us', 'ns', 's', 'sec', 'min', 'h',
  'hz', 'khz', 'mhz', 'ghz',
  'fps', 'kbps', 'mbps', 'gbps', 'bps',
  'b', 'bytes', 'byte', 'kb', 'mb', 'gb',
  'v', 'mv', 'a', 'ma', 'ua', 'w', 'mw', 'kw',
  'c', 'f', 'k', 'deg', 'celsius',
  'db', 'dbm', 'px', 'pct', '%',
  'rpm', 'kmh', 'mph', 'm/s'
]);

/**
 * Normalizes Turkish letters for resilient matching (e.g. aralık <-> aralik).
 */
export function normalizeTurkish(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Extracts key-value variable pairs from a log line.
 * Supports:
 * - "key : val" / "key = val"
 * - "aralik 69" / "gercek aralik 69 ms"
 */
export function extractVariablesFromLine(line: string): ExtractedVariables {
  const vars: ExtractedVariables = {};
  if (!line) return vars;

  // Tokenize the line into words, numbers, and symbols
  const tokenRegex = /([a-zA-Z_\u00C0-\u024F][a-zA-Z0-9_\u00C0-\u024F]*|-?\d+(?:\.\d+)?|[:=]|"[^"]*"|'[^']*')/g;
  const lineTokens: { text: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    lineTokens.push({ text: match[1], index: match.index });
  }

  const setVar = (key: string, valStr: string) => {
    const lower = valStr.toLowerCase();
    let val: number | boolean | string;
    if (lower === 'true') {
      val = true;
    } else if (lower === 'false') {
      val = false;
    } else if (/^-?0x[0-9a-fA-F]+$/i.test(valStr)) {
      val = parseInt(valStr, 16);
    } else if (/^-?\d+(?:\.\d+)?$/.test(valStr)) {
      val = parseFloat(valStr);
    } else {
      val = valStr;
    }

    vars[key] = val;
    vars[key.toLowerCase()] = val;
    vars[normalizeTurkish(key)] = val;
  };

  // 1. Explicit key [:=] val
  for (let i = 0; i < lineTokens.length - 2; i++) {
    const kTok = lineTokens[i];
    const opTok = lineTokens[i + 1];
    const vTok = lineTokens[i + 2];

    if (
      /^[a-zA-Z_\u00C0-\u024F]/.test(kTok.text) &&
      (opTok.text === ':' || opTok.text === '=')
    ) {
      setVar(kTok.text, vTok.text);
    }
  }

  // 2. Space-separated: word(s) followed directly by number/boolean (e.g. "gercek aralik 69 ms")
  for (let i = 0; i < lineTokens.length; i++) {
    const cur = lineTokens[i].text;
    const isNum = /^-?\d+(?:\.\d+)?$/.test(cur);
    const isBool = cur.toLowerCase() === 'true' || cur.toLowerCase() === 'false';

    if (isNum || isBool) {
      const prev1 = lineTokens[i - 1];
      if (prev1 && /^[a-zA-Z_\u00C0-\u024F]/.test(prev1.text)) {
        if (prev1.text !== ':' && prev1.text !== '=') {
          const varName1 = prev1.text;
          setVar(varName1, cur);

          // Check if there was another word preceding prev1 (e.g. "gercek aralik 69")
          const prev2 = lineTokens[i - 2];
          const prev3 = lineTokens[i - 3];
          if (
            prev2 &&
            /^[a-zA-Z_\u00C0-\u024F]/.test(prev2.text) &&
            prev2.text !== ':' &&
            prev2.text !== '='
          ) {
            // Ensure prev2 is not a unit attached to an earlier number
            const prev2IsUnit =
              prev3 &&
              /^-?\d+(?:\.\d+)?$/.test(prev3.text) &&
              COMMON_UNITS.has(prev2.text.toLowerCase());

            if (!prev2IsUnit) {
              setVar(`${prev2.text}_${varName1}`, cur);
              setVar(`${prev2.text} ${varName1}`, cur);
            }
          }
        }
      }
    }
  }

  return vars;
}

export type TokenType =
  | 'NUM'
  | 'BOOL'
  | 'STR'
  | 'IDENT'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN';

export interface Token {
  type: TokenType;
  val: any;
}

/**
 * Tokenizes a variable expression string.
 */
export function tokenizeExpression(input: string): Token[] {
  const rawTokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Two-character operators
    const two = input.substring(i, i + 2);
    if (['==', '!=', '=!', '<=', '>=', '&&', '||', '<>'].includes(two)) {
      let op = two;
      if (op === '=!' || op === '<>') op = '!=';
      rawTokens.push({ type: 'OP', val: op });
      i += 2;
      continue;
    }

    // Single-character operators / punctuation
    if (['=', '>', '<', '+', '-', '*', '/', '%', '!', '(', ')'].includes(ch)) {
      let op = ch;
      if (op === '=') op = '==';
      rawTokens.push({
        type: op === '(' ? 'LPAREN' : op === ')' ? 'RPAREN' : 'OP',
        val: op,
      });
      i++;
      continue;
    }

    // Quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && input[i] !== quote) {
        str += input[i];
        i++;
      }
      i++; // skip closing quote
      rawTokens.push({ type: 'STR', val: str });
      continue;
    }

    // Numbers (including hex 0x...)
    if (/[0-9]/.test(ch)) {
      let numStr = '';
      while (i < len && /[0-9a-fA-FxX.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      const val =
        numStr.startsWith('0x') || numStr.startsWith('0X')
          ? parseInt(numStr, 16)
          : parseFloat(numStr);
      rawTokens.push({ type: 'NUM', val });
      continue;
    }

    // Identifiers or keyword operators (including Turkish characters)
    if (/[a-zA-Z_\u00C0-\u024F]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_\u00C0-\u024F]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      const lower = ident.toLowerCase();

      // Check if "x" or "X" is used as multiplication operator: fps x audio
      if (lower === 'x') {
        const prev = rawTokens[rawTokens.length - 1];
        if (prev && (prev.type === 'IDENT' || prev.type === 'NUM' || prev.type === 'RPAREN')) {
          rawTokens.push({ type: 'OP', val: '*' });
          continue;
        }
      }

      // Logical keywords
      if (lower === 've' || lower === 'and') {
        rawTokens.push({ type: 'OP', val: '&&' });
        continue;
      }
      if (lower === 'veya' || lower === 'yada' || lower === 'or') {
        rawTokens.push({ type: 'OP', val: '||' });
        continue;
      }
      if (lower === 'not') {
        rawTokens.push({ type: 'OP', val: '!' });
        continue;
      }
      if (lower === 'true') {
        rawTokens.push({ type: 'BOOL', val: true });
        continue;
      }
      if (lower === 'false') {
        rawTokens.push({ type: 'BOOL', val: false });
        continue;
      }

      // Skip Turkish filler words
      if (['ikincisi', 'ikinci', 'ise', 'olarak'].includes(lower)) {
        continue;
      }

      rawTokens.push({ type: 'IDENT', val: ident });
      continue;
    }

    i++;
  }

  // Post-processing:
  // 1. Skip units following numbers (e.g. `aralik > 50 ms` -> `aralik > 50`)
  // 2. Combine consecutive IDENT tokens into multi-word identifier (e.g. `gercek aralik` -> `gercek aralik`)
  const cleaned: Token[] = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    if (cur.type === 'IDENT' && COMMON_UNITS.has(cur.val.toLowerCase())) {
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.type === 'NUM') {
        continue; // skip unit token following a number
      }
    }
    cleaned.push(cur);
  }

  const finalTokens: Token[] = [];
  let k = 0;
  while (k < cleaned.length) {
    const cur = cleaned[k];
    if (
      cur.type === 'IDENT' &&
      k + 1 < cleaned.length &&
      cleaned[k + 1].type === 'IDENT'
    ) {
      // Check next token is not a keyword
      const nextLower = cleaned[k + 1].val.toLowerCase();
      if (!['ve', 'and', 'yada', 'veya', 'or', 'not', 'x'].includes(nextLower)) {
        finalTokens.push({
          type: 'IDENT',
          val: `${cur.val} ${cleaned[k + 1].val}`,
        });
        k += 2;
        continue;
      }
    }
    finalTokens.push(cur);
    k++;
  }

  return finalTokens;
}

/**
 * Checks whether an input string looks like a variable expression.
 */
export function isVariableExpression(input: string): boolean {
  if (!input) return false;
  return /[:=<>!]|(\b(ve|and|yada|veya|or|not)\b)|(\b[a-zA-Z_\u00C0-\u024F][a-zA-Z0-9_\u00C0-\u024F]*\s+x\s+)/i.test(
    input.trim()
  );
}

/**
 * Evaluates a tokenized expression against a set of extracted variables.
 * Returns true if condition is met, false otherwise.
 */
export function evaluateVariableExpression(
  tokens: Token[],
  vars: ExtractedVariables,
  matchCase: boolean = false
): boolean {
  if (!tokens || tokens.length === 0) return false;

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token | undefined {
    return tokens[pos++];
  }

  function getVarVal(name: string): any {
    if (vars[name] !== undefined) return vars[name];

    const lower = name.toLowerCase();
    if (vars[lower] !== undefined) return vars[lower];

    const norm = normalizeTurkish(name);
    if (vars[norm] !== undefined) return vars[norm];

    const underscore = name.replace(/\s+/g, '_');
    if (vars[underscore] !== undefined) return vars[underscore];
    if (vars[underscore.toLowerCase()] !== undefined) return vars[underscore.toLowerCase()];
    if (vars[normalizeTurkish(underscore)] !== undefined) return vars[normalizeTurkish(underscore)];

    // If multi-word, check the last word as fallback (e.g. "gercek aralik" -> "aralik")
    if (name.includes(' ') || name.includes('_')) {
      const parts = name.split(/[\s_]+/);
      const last = parts[parts.length - 1];
      if (vars[last] !== undefined) return vars[last];
      if (vars[last.toLowerCase()] !== undefined) return vars[last.toLowerCase()];
      if (vars[normalizeTurkish(last)] !== undefined) return vars[normalizeTurkish(last)];
    }

    if (!matchCase) {
      for (const k of Object.keys(vars)) {
        if (normalizeTurkish(k) === norm) {
          return vars[k];
        }
      }
    }

    return MISSING_VAL;
  }

  // Precedence: parseOr -> parseAnd -> parseComparison -> parseAddSub -> parseMulDiv -> parseUnary -> parsePrimary

  function parseOr(): any {
    let left = parseAnd();
    while (peek() && peek()!.val === '||') {
      consume();
      const right = parseAnd();
      left = Boolean(left || right);
    }
    return left;
  }

  function parseAnd(): any {
    let left = parseComparison();
    while (peek() && peek()!.val === '&&') {
      consume();
      const right = parseComparison();
      left = Boolean(left && right);
    }
    return left;
  }

  function parseComparison(): any {
    let left = parseAddSub();
    const token = peek();
    if (token && ['==', '!=', '>', '<', '>=', '<='].includes(token.val)) {
      const op = consume()!.val;
      let right = parseAddSub();

      if (left !== MISSING_VAL && right === MISSING_VAL) {
        const lastTok = tokens[pos - 1];
        if (lastTok && lastTok.type === 'IDENT') {
          right = lastTok.val;
        } else {
          return false;
        }
      } else if (left === MISSING_VAL && right !== MISSING_VAL) {
        return false;
      } else if (left === MISSING_VAL && right === MISSING_VAL) {
        return false;
      }

      if (op === '==') return left == right;
      if (op === '!=') return left != right;
      if (op === '>') return Number(left) > Number(right);
      if (op === '<') return Number(left) < Number(right);
      if (op === '>=') return Number(left) >= Number(right);
      if (op === '<=') return Number(left) <= Number(right);
    }
    return left;
  }

  function parseAddSub(): any {
    let left = parseMulDiv();
    while (peek() && ['+', '-'].includes(peek()!.val)) {
      const op = consume()!.val;
      const right = parseMulDiv();
      if (left === MISSING_VAL || right === MISSING_VAL) return MISSING_VAL;
      left = op === '+' ? Number(left) + Number(right) : Number(left) - Number(right);
    }
    return left;
  }

  function parseMulDiv(): any {
    let left = parseUnary();
    while (peek() && ['*', '/', '%'].includes(peek()!.val)) {
      const op = consume()!.val;
      const right = parseUnary();
      if (left === MISSING_VAL || right === MISSING_VAL) return MISSING_VAL;
      if (op === '*') left = Number(left) * Number(right);
      else if (op === '/') left = Number(right) !== 0 ? Number(left) / Number(right) : 0;
      else if (op === '%') left = Number(left) % Number(right);
    }
    return left;
  }

  function parseUnary(): any {
    const token = peek();
    if (token && token.val === '!') {
      consume();
      const val = parseUnary();
      if (val === MISSING_VAL) return false;
      return !val;
    }
    if (token && token.val === '-') {
      consume();
      const val = parseUnary();
      return val !== MISSING_VAL ? -Number(val) : MISSING_VAL;
    }
    return parsePrimary();
  }

  function parsePrimary(): any {
    const token = consume();
    if (!token) return MISSING_VAL;

    if (token.type === 'NUM' || token.type === 'BOOL' || token.type === 'STR') {
      return token.val;
    }

    if (token.type === 'IDENT') {
      return getVarVal(token.val);
    }

    if (token.type === 'LPAREN') {
      const val = parseOr();
      if (peek() && peek()!.type === 'RPAREN') {
        consume();
      }
      return val;
    }

    return MISSING_VAL;
  }

  const result = parseOr();
  return result === MISSING_VAL ? false : Boolean(result);
}

/**
 * Checks whether a log line satisfies a raw variable expression string.
 */
export function checkLineVariableExpression(
  line: string,
  expression: string,
  matchCase: boolean = false
): boolean {
  try {
    const vars = extractVariablesFromLine(line);
    const tokens = tokenizeExpression(expression);
    return evaluateVariableExpression(tokens, vars, matchCase);
  } catch {
    return false;
  }
}
