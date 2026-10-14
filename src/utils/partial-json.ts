// Tolerant partial-JSON field extractor for streamed lick generation.
//
// Given an in-progress JSON string (the model's output so far), return whatever
// TOP-LEVEL fields have *fully* arrived. Only closed/terminated values are
// surfaced, so consumers never see a half-written `abc` string.
// Validated against every truncation boundary and adversarial
// inputs (escaped quotes inside abc, braces inside string values, chunked
// arrival) in partial-json.test.ts.
//
// Strategy: locate each known key, then read its value only if it is fully
// terminated:
//   - string: opening quote to the matching unescaped closing quote

import type { Lick } from "../types/lick";

export type PartialLick = Partial<Pick<Lick, "title" | "feel" | "abc">>;

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
  // Return the index just past the colon of a TOP-LEVEL `"key":`, or -1.
  // A naive regex search would also match key-shaped substrings inside string
  // values or nested objects (e.g. a title of `fake "abc": "x"`), so we scan
  // structurally and only accept a key sitting at object depth 1.
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      // Potential key start at top level.
      if (depth === 1) {
        const r = readString(s, i);
        if (r && r.value === key) {
          // Expect optional whitespace then a colon.
          let j = r.end + 1;
          while (j < s.length && /\s/.test(s[j])) j++;
          if (s[j] === ":") {
            j++;
            while (j < s.length && /\s/.test(s[j])) j++;
            return j;
          }
        }
        // Not our key (or unterminated): skip past this string so its contents
        // are never scanned as structure.
        if (r) { i = r.end; continue; }
        return -1; // string not closed yet; nothing further is parseable
      }
      inStr = true;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return -1;
}

const STRING_KEYS = ["title", "feel", "abc"] as const;

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

  return out;
}
