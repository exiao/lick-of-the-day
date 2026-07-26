// Tolerant partial-JSON field extractor for streamed lick generation.
//
// Given an in-progress JSON string (the model's output so far), return whatever
// TOP-LEVEL fields have *fully* arrived. Only closed/terminated values are
// surfaced, so consumers never see a half-written `abc` string or a partial
// note object. This lets the UI paint the sheet music the instant `abc` closes
// while the much larger `notes` array is still streaming in.
//
// Validated against every truncation boundary of a real payload plus adversarial
// cases (escaped quotes inside abc, braces inside string values, token-sized
// chunked arrival). See partial-json.test.ts.

export interface PartialLick {
  genre?: string;
  title?: string;
  bars?: number;
  tempo?: number;
  timeSignature?: string;
  key?: string;
  swing?: number;
  feel?: string;
  chords?: unknown[];
  abc?: string;
  /** Fully-closed leading note objects (grows as the array streams). */
  notes?: unknown[];
  /** True once the `notes` array itself is closed (final `]` seen). */
  notesComplete?: boolean;
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
      if (n === "u") {
        if (i + 6 > s.length) return null;
        out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      const map: Record<string, string> = {
        n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f",
      };
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
  // Returns the index just past the colon of "key": , or -1.
  const m = s.match(new RegExp(`"${key}"\\s*:\\s*`));
  if (!m || m.index === undefined) return -1;
  return m.index + m[0].length;
}

function readScalar(s: string, from: number): number | boolean | null | undefined {
  // number / true / false / null, terminated by , } ] or whitespace.
  const m = s.slice(from).match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,}\]]|\s)/);
  if (!m) return undefined;
  const tok = m[1];
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "null") return null;
  return Number(tok);
}

function matchBalanced(
  s: string,
  from: number,
  open: string,
  close: string,
): { end: number } | null {
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

/** Fully-closed leading elements of an array that is itself not yet closed. */
function readClosedArrayPrefix(s: string, from: number): unknown[] {
  const els: unknown[] = [];
  let i = from + 1;
  let inStr = false;
  let elemStart = -1;
  let depth = 0;
  const flush = (endExclusive: number) => {
    const raw = s.slice(elemStart, endExclusive).trim();
    if (!raw) return;
    try { els.push(JSON.parse(raw)); } catch { /* element not complete yet */ }
  };
  for (; i < s.length; i++) {
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

/**
 * Extract every fully-arrived top-level field from an in-progress lick JSON
 * buffer. Safe to call on every streamed chunk.
 */
export function extractClosedFields(buf: string): PartialLick {
  const out: PartialLick = {};

  const stringKeys = ["genre", "title", "timeSignature", "key", "feel", "abc"] as const;
  for (const k of stringKeys) {
    const at = findKey(buf, k);
    if (at === -1 || buf[at] !== '"') continue;
    const r = readString(buf, at);
    if (r) out[k] = r.value;
  }

  const scalarKeys = ["bars", "tempo", "swing"] as const;
  for (const k of scalarKeys) {
    const at = findKey(buf, k);
    if (at === -1) continue;
    const v = readScalar(buf, at);
    if (typeof v === "number") out[k] = v;
  }

  // chords: small, surface all-or-nothing once closed.
  const chAt = findKey(buf, "chords");
  if (chAt !== -1 && buf[chAt] === "[") {
    const bal = matchBalanced(buf, chAt, "[", "]");
    if (bal) {
      try { out.chords = JSON.parse(buf.slice(chAt, bal.end + 1)); } catch { /* not closed */ }
    }
  }

  // notes: surface a progressive closed prefix, and mark complete once the
  // array's final `]` arrives.
  const nAt = findKey(buf, "notes");
  if (nAt !== -1 && buf[nAt] === "[") {
    const bal = matchBalanced(buf, nAt, "[", "]");
    if (bal) {
      try {
        out.notes = JSON.parse(buf.slice(nAt, bal.end + 1));
        out.notesComplete = true;
      } catch { /* shouldn't happen, fall through */ }
    } else {
      out.notes = readClosedArrayPrefix(buf, nAt);
      out.notesComplete = false;
    }
  }

  return out;
}
