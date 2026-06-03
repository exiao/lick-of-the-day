// Tolerant partial-JSON field extractor for streamed lick generation.
//
// Given an in-progress JSON string (the model's output so far), return whatever
// TOP-LEVEL fields have *fully* arrived. Only closed/terminated values are
// surfaced, so consumers never see a half-written `abc` string or a partial
// array element. Validated against every truncation boundary and adversarial
// inputs (escaped quotes inside abc, braces inside string values, chunked
// arrival) in partial-json.test.ts.
//
// Strategy: locate each known key, then read its value only if it is fully
// terminated:
//   - string: opening quote to the matching unescaped closing quote
//   - number/bool/null: a complete token followed by , } ] or whitespace
//   - array: balanced [ ... ] (objects/strings inside respected)
// The notes array additionally exposes any fully-closed leading elements, so
// the UI can show a progressive note count before the array's final `]`.

export interface PartialLick {
  genre?: string;
  title?: string;
  timeSignature?: string;
  key?: string;
  feel?: string;
  abc?: string;
  bars?: number | null;
  tempo?: number | null;
  swing?: number | null;
  chords?: unknown[];
  notes?: unknown[];
}

function readString(s: string, from: number): { value: string; end: number } | null {
  // `from` points at the opening quote. Returns null if not yet terminated.
  let i = from + 1;
  let out = "";
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      if (i + 1 >= s.length) return null; // escape split across a chunk boundary
      const n = s[i + 1];
      const map: Record<string, string> = {
        n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f",
      };
      if (n === "u") {
        if (i + 6 > s.length) return null;
        out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      out += map[n] !== undefined ? map[n] : n;
      i += 2;
      continue;
    }
    if (c === '"') return { value: out, end: i };
    out += c;
    i++;
  }
  return null; // no closing quote yet
}

function findKey(s: string, key: string): number {
  // Returns the index just past the colon of `"key":`, or -1.
  const m = s.match(new RegExp(`"${key}"\\s*:\\s*`));
  if (!m || m.index === undefined) return -1;
  return m.index + m[0].length;
}

function readScalar(s: string, from: number): number | boolean | null | undefined {
  // number / true / false / null, fully terminated by , } ] or whitespace.
  const m = s.slice(from).match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,}\]]|\s)/);
  if (!m) return undefined;
  const tok = m[1];
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "null") return null;
  return Number(tok);
}

function matchBalanced(s: string, from: number, open: string, close: string): { end: number } | null {
  // `from` points at the opening bracket. Returns the matching close, or null.
  let depth = 0;
  let inStr = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { end: i };
    }
  }
  return null;
}

function readClosedArrayPrefix(s: string, from: number): unknown[] {
  // `from` points at '['. Returns fully-closed leading elements of an
  // array that is itself not yet closed.
  const els: unknown[] = [];
  let inStr = false;
  let elemStart = -1;
  let depth = 0;
  const flush = (endExclusive: number) => {
    const raw = s.slice(elemStart, endExclusive).trim();
    if (!raw) return;
    try { els.push(JSON.parse(raw)); } catch { /* element not complete yet */ }
  };
  for (let i = from + 1; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { if (elemStart === -1) elemStart = i; inStr = true; continue; }
    if (c === "{" || c === "[") { if (elemStart === -1) elemStart = i; depth++; continue; }
    if (c === "}" || c === "]") {
      if (c === "]" && depth === 0) { flush(i); break; } // array closed
      depth--;
      continue;
    }
    if (c === ",") { if (depth === 0) { flush(i); elemStart = -1; } continue; }
    if (elemStart === -1 && !/\s/.test(c)) elemStart = i;
  }
  return els;
}

const STRING_KEYS = ["genre", "title", "timeSignature", "key", "feel", "abc"] as const;
const SCALAR_KEYS = ["bars", "tempo", "swing"] as const;

/**
 * Extract whatever top-level fields have fully arrived in an in-progress JSON
 * buffer. Never surfaces a partial/corrupt value. Safe to call on every chunk.
 */
export function extractClosedFields(buf: string): PartialLick {
  const out: PartialLick = {};

  for (const k of STRING_KEYS) {
    const at = findKey(buf, k);
    if (at === -1 || buf[at] !== '"') continue;
    const r = readString(buf, at);
    if (r) out[k] = r.value;
  }

  for (const k of SCALAR_KEYS) {
    const at = findKey(buf, k);
    if (at === -1) continue;
    const v = readScalar(buf, at);
    if (v !== undefined) out[k] = v as number | null;
  }

  // chords: small, surface only when fully closed (all-or-nothing is fine).
  const chAt = findKey(buf, "chords");
  if (chAt !== -1 && buf[chAt] === "[") {
    const bal = matchBalanced(buf, chAt, "[", "]");
    if (bal) {
      try { out.chords = JSON.parse(buf.slice(chAt, bal.end + 1)); } catch { /* not ready */ }
    }
  }

  // notes: surface the full array once closed, else the closed leading prefix
  // so the UI can show a progressive count.
  const nAt = findKey(buf, "notes");
  if (nAt !== -1 && buf[nAt] === "[") {
    const bal = matchBalanced(buf, nAt, "[", "]");
    if (bal) {
      try { out.notes = JSON.parse(buf.slice(nAt, bal.end + 1)); } catch { /* not ready */ }
    } else {
      out.notes = readClosedArrayPrefix(buf, nAt);
    }
  }

  return out;
}
