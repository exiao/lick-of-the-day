// TEMPORARY local validation server (not committed). Streams a real lick slowly
// on /api/daily and /api/random so we can verify the streaming UI end-to-end
// against the actual React app, without needing Cloudflare + an API key.
import { createServer } from "node:http";

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

const PORT = 8799;
createServer(async (req, res) => {
  const full = JSON.stringify(LICK, null, 2);
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  });
  // Stream ~10 chars at a time with a delay, mimicking token streaming.
  for (let i = 0; i < full.length; i += 10) {
    res.write(full.slice(i, i + 10));
    await new Promise((r) => setTimeout(r, 60));
  }
  res.end();
}).listen(PORT, () => console.log(`mock stream server on :${PORT}`));
