import type { Genre } from "../types/lick";

const GENRE_GUIDANCE: Record<Genre, string> = {
  jazz: "Generate a jazz lick with bebop vocabulary: chromatic approach notes, enclosures, arpeggios over chord tones, eighth-note lines. Think Charlie Parker, Chet Baker, or Bill Evans. Use ii-V-I or blues progressions.",
  blues: "Generate a blues lick using the blues scale, bent notes (represented as grace notes), call-and-response phrasing, and soulful melodic lines. Think B.B. King or Muddy Waters. Use standard 12-bar blues or minor blues changes.",
  funk: "Generate a funky lick with syncopated rhythms, sixteenth-note patterns, staccato articulations, and groove-oriented lines. Think Herbie Hancock's Headhunters or Tower of Power. Use dominant 7th and minor 7th chords.",
  rnb: "Generate an R&B lick with smooth melodic lines, pentatonic runs, tasteful ornaments, and soulful phrasing. Think D'Angelo, Erykah Badu, or Robert Glasper. Use neo-soul chord progressions with extended harmonies.",
  bossa: "Generate a bossa nova lick with gentle syncopation, smooth melodic contours, and Brazilian harmonic flavor. Think Antonio Carlos Jobim or Joao Gilberto. Use major 7th, minor 7th, and altered dominant chords.",
};

export function buildLickPrompt(genre: Genre, bars: number): { system: string; user: string } {
  const system = `You are a music theory expert and composer. You generate musical licks as structured JSON data. Your licks must be:
- Musically valid and idiomatic to the requested genre
- Playable on piano with one hand
- Interesting and educational for practice
- Using correct ABC notation compatible with the abcjs library
- Expressive: vary velocity and articulation like a real musician — not every note the same

You must respond with ONLY valid JSON matching the exact schema provided. No markdown, no explanation, just JSON.`;

  const user = `${GENRE_GUIDANCE[genre]}

Generate a ${bars}-bar lick. Respond with this exact JSON structure:

{
  "genre": "${genre}",
  "title": "<descriptive title>",
  "bars": ${bars},
  "tempo": <appropriate tempo as integer>,
  "timeSignature": "4/4",
  "key": "<key signature, e.g. 'Bb', 'F', 'C'>",
  "swing": <0.0 to 1.0 — 0=straight, 0.33=light swing, 0.5=medium swing, 0.67=hard swing>,
  "feel": "<short description, e.g. 'medium swing', 'straight with ghost notes', 'shuffle'>",
  "chords": [
    {"chord": "<chord symbol>", "bar": <bar number starting at 1>, "beat": <beat number starting at 1>}
  ],
  "abc": "<valid ABC notation string with X:1, M:, L:, K: headers and chord symbols in quotes above notes>",
  "notes": [
    {
      "pitch": "<scientific pitch like C4 or Eb5>",
      "duration": "<Tone.js duration like 8n, 4n, 16n>",
      "time": <offset in seconds from start at the given tempo>,
      "velocity": <0.0-1.0 dynamics>,
      "articulation": "<normal|staccato|legato|accent|ghost>"
    }
  ]
}

Important rules for swing:
- Jazz: 0.33–0.67 (always swing)
- Blues: 0.33–0.5 (shuffle feel)
- Funk: 0.0–0.2 (mostly straight, tight 16th notes)
- R&B: 0.1–0.4 (laid-back, behind the beat)
- Bossa Nova: 0.0 (always straight — syncopation comes from rhythm, not swing)

Important rules for articulation:
- velocity: varies naturally. Accents (0.85-1.0) on downbeats and target chord tones.
  Ghost notes (0.2-0.4) for approach tones, passing tones, and rhythmic texture.
  Medium (0.55-0.75) for most notes.
- articulation: use "staccato" for short punchy notes (funk, blues). Use "legato" for smooth connected phrases (jazz, bossa). Use "accent" for strong beats and arrivals. Use "ghost" for quiet passing tones. Use "normal" as default.
- Vary both velocity AND articulation — real musicians don't play robotically.

Important rules for the ABC notation:
- Start with X:1, then M: (meter), L: (default note length), K: (key)
- Put chord symbols in double quotes above the notes: "Cm7" CDEF
- Use | for bar lines
- The ABC must be a single string (use \\n for newlines)

Important rules for the notes array:
- Pitch must use scientific pitch notation (C4 = middle C)
- Use sharps/flats matching the key signature (e.g., Eb not D# in Bb major)
- Duration uses Tone.js format: "16n"=sixteenth, "8n"=eighth, "4n"=quarter, "2n"=half, "1n"=whole
- Time is in seconds, calculated from the tempo. At tempo=120, a quarter note = 0.5s
- Notes must be sequential and time values must be monotonically increasing
- The total duration of notes must fit within ${bars} bars of the time signature`;

  return { system, user };
}
