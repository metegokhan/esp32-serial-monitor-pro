/**
 * Variable extraction and arithmetic/logic expression evaluation.
 *
 * Automatically parses `key: value` and `key = value` pairs from serial log lines,
 * and evaluates expressions like:
 *   - `fps > 10`
 *   - `sync = true`
 *   - `fps =! 15`
 *   - `fps > 5 ve sync = true`
 *   - `fps x audio > 1200`
 *   - `fps > 10 yada sync = true yada fps =! 15`
 */

export interface ExtractedVariables {
  [key: string]: number | boolean | string;
}

const MISSING_VAL = Symbol('MISSING_VAL');

/**
 * Extracts key-value variable pairs from a log line.
 * Pattern: "key" [whitespace] ":, =" [whitespace] "value"
 */
export function extractVariablesFromLine(line: string): ExtractedVariables {
  const vars: ExtractedVariables = {};
  if (!line) return vars;

  // Regex matches:
  // (preceded by start of line or space or bracket/punctuation)
  // group 1: key (alphanumeric identifier)
  // [:=] with optional surrounding whitespace
  // group 2/3/4: quoted string, or unquoted value
  const regex = /(?:^|[\s,;\[\]\(\)\{\}])([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([^\s,;\]\)\}\>]+))/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const key = match[1];
    const rawVal = match[2] ?? match[3] ?? match[4];
    if (rawVal !== undefined) {
      const lower = rawVal.toLowerCase();
      if (lower === 'true') {
        vars[key] = true;
      } else if (lower === 'false') {
        vars[key] = false;
      } else if (/^-?0x[0-9a-fA-F]+$/i.test(rawVal)) {
        vars[key] = parseInt(rawVal, 16);
      } else if (/^-?\d+(?:\.\d+)?$/.test(rawVal)) {
        vars[key] = parseFloat(rawVal);
      } else {
        vars[key] = rawVal;
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
  const tokens: Token[] = [];
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
      tokens.push({ type: 'OP', val: op });
      i += 2;
      continue;
    }

    // Single-character operators / punctuation
    if (['=', '>', '<', '+', '-', '*', '/', '%', '!', '(', ')'].includes(ch)) {
      let op = ch;
      if (op === '=') op = '==';
      tokens.push({
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
      tokens.push({ type: 'STR', val: str });
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
      tokens.push({ type: 'NUM', val });
      continue;
    }

    // Identifiers or keyword operators
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      const lower = ident.toLowerCase();

      // Check if "x" or "X" is used as multiplication operator: fps x audio
      if (lower === 'x') {
        const prev = tokens[tokens.length - 1];
        if (prev && (prev.type === 'IDENT' || prev.type === 'NUM' || prev.type === 'RPAREN')) {
          tokens.push({ type: 'OP', val: '*' });
          continue;
        }
      }

      // Logical keywords
      if (lower === 've' || lower === 'and') {
        tokens.push({ type: 'OP', val: '&&' });
        continue;
      }
      if (lower === 'veya' || lower === 'yada' || lower === 'or') {
        tokens.push({ type: 'OP', val: '||' });
        continue;
      }
      if (lower === 'not') {
        tokens.push({ type: 'OP', val: '!' });
        continue;
      }
      if (lower === 'true') {
        tokens.push({ type: 'BOOL', val: true });
        continue;
      }
      if (lower === 'false') {
        tokens.push({ type: 'BOOL', val: false });
        continue;
      }

      // Skip optional Turkish filler words e.g. "ikincisi", "ikinci", "ise"
      if (['ikincisi', 'ikinci', 'ise', 'olarak'].includes(lower)) {
        continue;
      }

      tokens.push({ type: 'IDENT', val: ident });
      continue;
    }

    // Skip any other unrecognized character
    i++;
  }

  return tokens;
}

/**
 * Checks whether an input string looks like a variable expression
 * (e.g. contains comparison or arithmetic operators or logic keywords).
 */
export function isVariableExpression(input: string): boolean {
  if (!input) return false;
  return /[:=<>!]|(\b(ve|and|yada|veya|or|not)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*\s+x\s+)/i.test(
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
    if (matchCase) {
      return vars[name] !== undefined ? vars[name] : MISSING_VAL;
    }
    const lower = name.toLowerCase();
    for (const k of Object.keys(vars)) {
      if (k.toLowerCase() === lower) {
        return vars[k];
      }
    }
    return MISSING_VAL;
  }

  // Expression precedence hierarchy:
  // parseOr -> parseAnd -> parseComparison -> parseAddSub -> parseMulDiv -> parseUnary -> parsePrimary

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

      // If either side is MISSING_VAL, check if the other is a string literal (e.g. status == OK)
      if (left !== MISSING_VAL && right === MISSING_VAL) {
        // Look up if right was an identifier that can be treated as string literal
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
