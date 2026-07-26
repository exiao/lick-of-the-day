// Standalone test for the partial-JSON streaming parser.
//
//   node --experimental-strip-types src/utils/partial-json.test.ts
//
// No test-runner dependency. Sweeps a real lick payload across every truncation
// boundary plus adversarial cases. This is the make-or-break check for streamed
// rendering: the parser must NEVER surface a corrupt or partial field.
import { extractClosedFields } from "./partial-json.ts";

let fails = 0;
const check = (name: string, cond: boolean) => {
  console.log((cond ? "  ok   " : "  FAIL ") + name);
  if (!cond) fails++;
};

// A realistic lick in the exact schema field order the prompt emits.
const LICK = {
  genre: "rnb",
  title: "Neo-Soul Bounce in Eb",
  bars: 4,
  tempo: 95,
  timeSignature: "4/4",
  key: "Eb",
  swing: 0.25,
  feel: "laid-back, slightly behind the beat",
  chords: [
    { chord: "Ebmaj7", bar: 1, beat: 1 },
    { chord: "Cm7", bar: 2, beat: 1 },
    { chord: "Abmaj7", bar: 3, beat: 1 },
    { chord: "Bb7", bar: 4, beat: 1 },
  ],
  // abc with escaped chord quotes — the exact shape the production prompt uses.
  abc: 'X:1\nM:4/4\nL:1/8\nK:Eb\n"Ebmaj7" E2G2B2d2|"Cm7" c2_B2G2E2|"Abmaj7" _A,2C2E2G2|"Bb7" F2D2E4|',
  notes: [
    { pitch: "Eb4", duration: "4n", velocity: 0.85, articulation: "accent" },
    { pitch: "G4", duration: "4n", velocity: 0.65, articulation: "legato" },
    { pitch: "Bb4", duration: "4n", velocity: 0.7, articulation: "normal" },
    { pitch: "D5", duration: "4n", velocity: 0.8, articulation: "accent" },
    { pitch: "C5", duration: "4n", velocity: 0.85, articulation: "accent" },
    { pitch: "Bb4", duration: "4n", velocity: 0.6, articulation: "legato" },
    { pitch: "G4", duration: "4n", velocity: 0.4, articulation: "ghost" },
    { pitch: "Eb4", duration: "2n", velocity: 0.9, articulation: "accent" },
  ],
};
const full = JSON.stringify(LICK, null, 2);

// 1. Truncation sweep: every prefix must keep the invariants.
{
  let abcFirstSeenAt = -1;
  let abcAlwaysCorrect = true;
  let prevNotes = 0;
  let notesMonotonic = true;
  let maxNotes = 0;
  let corrupt = false;
  let titleEverWrong = false;

  for (let n = 1; n <= full.length; n++) {
    const got = extractClosedFields(full.slice(0, n));
    if (got.title !== undefined && got.title !== LICK.title) titleEverWrong = true;
    if (got.abc !== undefined) {
      if (abcFirstSeenAt === -1) abcFirstSeenAt = n;
      if (got.abc !== LICK.abc) abcAlwaysCorrect = false;
    }
    if (got.notes !== undefined) {
      if (got.notes.length < prevNotes) notesMonotonic = false;
      prevNotes = got.notes.length;
      maxNotes = Math.max(maxNotes, got.notes.length);
      if (got.notes.length > LICK.notes.length) corrupt = true;
      for (const el of got.notes) {
        if (typeof el !== "object" || el === null || !("pitch" in el) || !("duration" in el)) {
          corrupt = true;
          break;
        }
      }
    }
  }

  console.log("truncation sweep:");
  check("no corrupt/partial field ever surfaced", !corrupt && !titleEverWrong);
  check("abc, once surfaced, always equals real abc", abcAlwaysCorrect);
  check("abc with embedded chord quotes round-trips", abcFirstSeenAt !== -1);
  check("notes count grows monotonically", notesMonotonic);
  check(`notes reach full count (${LICK.notes.length})`, maxNotes === LICK.notes.length);
  const pct = ((100 * abcFirstSeenAt) / full.length).toFixed(0);
  check(`abc available before stream ends (${pct}%)`, abcFirstSeenAt < full.length);
}

// 2. notesComplete flips only when the array's final ] arrives.
{
  const idxNotesClose = full.lastIndexOf("]");
  const beforeClose = extractClosedFields(full.slice(0, idxNotesClose));
  const afterClose = extractClosedFields(full);
  console.log("notesComplete flag:");
  check("notesComplete is false before final ]", beforeClose.notesComplete === false);
  check("notesComplete is true after final ]", afterClose.notesComplete === true);
  check("complete notes length matches", (afterClose.notes ?? []).length === LICK.notes.length);
}

// 3. Adversarial: braces/brackets inside a string value must not fool the scan.
{
  const obj = { title: "weird } title ] value", abc: "X:1\nK:C\nC4|", notes: [{ pitch: "C4", duration: "4n" }] };
  const g = extractClosedFields(JSON.stringify(obj));
  console.log("braces inside string value:");
  check("title with } and ] read correctly", g.title === "weird } title ] value");
  check("abc still found after tricky title", g.abc === "X:1\nK:C\nC4|");
  check("notes still found after tricky title", Array.isArray(g.notes) && g.notes.length === 1);
}

// 4. Chunked (token-sized) arrival stays correct.
{
  let buf = "";
  let i = 0;
  let corrupt = false;
  let prevN = 0;
  let mono = true;
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (i < full.length) {
    const step = 3 + Math.floor(rand() * 9);
    buf += full.slice(i, i + step);
    i += step;
    const g = extractClosedFields(buf);
    if (g.abc !== undefined && g.abc !== LICK.abc) corrupt = true;
    if (g.notes) {
      if (g.notes.length < prevN) mono = false;
      prevN = g.notes.length;
    }
  }
  console.log("chunked arrival:");
  check("chunked: abc never corrupt", !corrupt);
  check("chunked: notes monotonic", mono);
  check("chunked: notes reach full count", prevN === LICK.notes.length);
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
if (fails) process.exit(1);
