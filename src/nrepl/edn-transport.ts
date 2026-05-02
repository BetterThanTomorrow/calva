import * as cljsLib from '../../out/cljs-lib/cljs-lib';

const KEYWORD_VALUE_FIELDS = new Set(['op']);
const KEYWORD_ARRAY_FIELDS = new Set(['status']);

function ednEncodeValue(value: any): string {
  if (value === null || value === undefined) {
    return 'nil';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(ednEncodeValue).join(' ') + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => `:${k} ${ednEncodeValue(v)}`)
      .join(' ');
    return '{' + entries + '}';
  }
  return String(value);
}

function ednEncodeKeyword(value: string): string {
  return ':' + value;
}

function ednEncodeArrayAsKeywords(arr: any[]): string {
  return (
    '[' +
    arr
      .map((item) => (typeof item === 'string' ? ednEncodeKeyword(item) : ednEncodeValue(item)))
      .join(' ') +
    ']'
  );
}

/**
 * Serialize an nREPL request map as an EDN string.
 * Keys become EDN keywords. The `op` value becomes an EDN keyword.
 * Status array items become EDN keywords. All other string values
 * are EDN-quoted strings.
 */
export function ednEncodeNReplMessage(msg: Record<string, any>): string {
  const entries = Object.entries(msg)
    .map(([key, value]) => {
      const ednKey = ednEncodeKeyword(key);
      let ednValue: string;
      if (KEYWORD_VALUE_FIELDS.has(key) && typeof value === 'string') {
        ednValue = ednEncodeKeyword(value);
      } else if (KEYWORD_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
        ednValue = ednEncodeArrayAsKeywords(value);
      } else {
        ednValue = ednEncodeValue(value);
      }
      return `${ednKey} ${ednValue}`;
    })
    .join(' ');
  return '{' + entries + '}';
}

export function ednDecodeNReplMessage(ednString: string): Record<string, any> {
  return cljsLib.parseEdn(ednString);
}
