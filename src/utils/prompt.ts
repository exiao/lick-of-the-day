import type { Genre } from "../types/lick";

const GENRE_TECHNIQUES: Record<Genre, string> = {
  jazz: `Style: Jazz (Bebop)
Techniques: Use enclosures (surround a chord tone from above and below, e.g. D-B-C to target C). Use 1-2-3-5 digital patterns. Apply the bebop scale (add natural 7 to Mixolydian on dominant chords). Land on guide tones (3rd or 7th) of each chord when outlining ii-V-I progressions. Swing feel required (swing: 0.33-0.67).`,

  blues: `Style: Blues
Techniques: Use the b3-to-natural-3 "blue note slide" (represent as a grace note 16n on b3 followed by the natural 3). Write call-and-response: a 2-bar question phrase followed by a 2-bar answering phrase. Emphasize b3, b5, and b7 (the blue notes). Mix major and minor pentatonic freely. Shuffle feel (swing: 0.33-0.5).`,

  funk: `Style: Funk
Techniques: Write tight 16th note patterns. At least 40% of notes should have articulation "staccato" or "ghost". Anchor lines on the root and b7. Syncopate by emphasizing offbeat 16ths (the "e" and "a"). Straight feel (swing: 0.0-0.2). The rhythm IS the melody.`,

  rnb: `Style: R&B / Neo-Soul
Techniques: Use descending pentatonic runs starting from upper extensions (9th, 11th). Add grace note slides (short 16n before target notes). Include at least one suspension resolving to a chord tone. Mix major and minor pentatonic. Laid-back feel (swing: 0.1-0.4).`,

  bossa: `Style: Bossa Nova
Techniques: Straight 8ths only (swing: 0.0). Use dotted-quarter rhythmic cells for the bossa syncopation feel. Keep motion mostly stepwise with chromatic passing tones between chord tones. Write a singable melody that follows guide tones through the changes. Simple and lyrical.`,
};

const GENRE_EXAMPLES: Record<Genre, string> = {
  jazz: `Example jazz lick (ii-V-I in C, 4 bars, use as pattern reference):
{
  "genre": "jazz",
  "title": "Bebop Enclosure ii-V-I",
  "bars": 4,
  "tempo": 140,
  "timeSignature": "4/4",
  "key": "C",
  "swing": 0.5,
  "feel": "medium swing",
  "chords": [
    {"chord": "Dm7", "bar": 1, "beat": 1},
    {"chord": "G7", "bar": 2, "beat": 1},
    {"chord": "Cmaj7", "bar": 3, "beat": 1},
    {"chord": "Cmaj7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\\"Dm7\\" A,F AF \\"G7\\" _AB cB|\\n\\"G7\\" d_B GA \\"Cmaj7\\" GE CE|\\n\\"Cmaj7\\" z2 EG Bc ed|\\n\\"Cmaj7\\" cE GE C4|",
  "notes": [
    {"pitch": "A3", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.55, "articulation": "ghost"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "Ab4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "B4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "B4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "D5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.55, "articulation": "ghost"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "C4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "B4", "duration": "8n", "velocity": 0.7, "articulation": "legato"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "E5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "D5", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "C4", "duration": "2n", "velocity": 0.85, "articulation": "accent"}
  ]
}`,

  blues: `Example blues lick (G blues, 4 bars, use as pattern reference):
{
  "genre": "blues",
  "title": "Call and Response Blues",
  "bars": 4,
  "tempo": 80,
  "timeSignature": "4/4",
  "key": "G",
  "swing": 0.45,
  "feel": "slow shuffle",
  "chords": [
    {"chord": "G7", "bar": 1, "beat": 1},
    {"chord": "G7", "bar": 2, "beat": 1},
    {"chord": "C7", "bar": 3, "beat": 1},
    {"chord": "G7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:G\\n\\"G7\\" B,2 _B,/B,/ D2 G2|\\"G7\\" _B2 A2 G2 z2|\\"C7\\" z2 _EG _Bc _BA|\\"G7\\" G2 D2 G4|",
  "notes": [
    {"pitch": "B3", "duration": "4n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "Bb3", "duration": "16n", "velocity": 0.5, "articulation": "ghost"},
    {"pitch": "B3", "duration": "8n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "A4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Eb4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "G4", "duration": "2n", "velocity": 0.85, "articulation": "accent"}
  ]
}`,

  funk: `Example funk lick (E minor, 4 bars, use as pattern reference):
{
  "genre": "funk",
  "title": "Staccato 16th Groove",
  "bars": 4,
  "tempo": 100,
  "timeSignature": "4/4",
  "key": "Em",
  "swing": 0.0,
  "feel": "straight with ghost notes",
  "chords": [
    {"chord": "Em7", "bar": 1, "beat": 1},
    {"chord": "Em7", "bar": 2, "beat": 1},
    {"chord": "A7", "bar": 3, "beat": 1},
    {"chord": "Em7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/16\\nK:Em\\n\\"Em7\\" E2z2 G2B,2 E2D2 E2z2|\\"Em7\\" B,2E2 D2E2 G4 z4|\\"A7\\" A2z2 G2E2 ^C2E2 A,2z2|\\"Em7\\" E2G2 B,2D2 E8|",
  "notes": [
    {"pitch": "E4", "duration": "8n", "velocity": 0.8, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "B3", "duration": "8n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.75, "articulation": "staccato"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.4, "articulation": "ghost"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "B3", "duration": "8n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.75, "articulation": "staccato"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.4, "articulation": "ghost"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.8, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.65, "articulation": "staccato"},
    {"pitch": "C#4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "A3", "duration": "8n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.75, "articulation": "staccato"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "B3", "duration": "8n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "E4", "duration": "2n", "velocity": 0.85, "articulation": "accent"}
  ]
}`,

  rnb: `Example R&B lick (Fmaj9 to Bbmaj7, 4 bars, use as pattern reference):
{
  "genre": "rnb",
  "title": "Pentatonic Cascade",
  "bars": 4,
  "tempo": 72,
  "timeSignature": "4/4",
  "key": "F",
  "swing": 0.2,
  "feel": "laid-back groove",
  "chords": [
    {"chord": "Fmaj9", "bar": 1, "beat": 1},
    {"chord": "Fmaj9", "bar": 2, "beat": 1},
    {"chord": "Bbmaj7", "bar": 3, "beat": 1},
    {"chord": "Gm7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:F\\n\\"Fmaj9\\" z2 GA cA GF|\\"Fmaj9\\" E2 C2 z2 EF|\\"Bbmaj7\\" GA _Bc dc _BA|\\"Gm7\\" G2 _B2 G4|",
  "notes": [
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "16n", "velocity": 0.45, "articulation": "ghost"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.6, "articulation": "legato"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "E4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C4", "duration": "4n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.75, "articulation": "legato"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "D5", "duration": "8n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.75, "articulation": "legato"},
    {"pitch": "G4", "duration": "2n", "velocity": 0.8, "articulation": "accent"}
  ]
}`,

  bossa: `Example bossa nova lick (Dm7-G7-Cmaj7, 4 bars, use as pattern reference):
{
  "genre": "bossa",
  "title": "Chromatic Guide Tone Walk",
  "bars": 4,
  "tempo": 130,
  "timeSignature": "4/4",
  "key": "C",
  "swing": 0.0,
  "feel": "straight bossa",
  "chords": [
    {"chord": "Dm7", "bar": 1, "beat": 1},
    {"chord": "G7", "bar": 2, "beat": 1},
    {"chord": "Cmaj7", "bar": 3, "beat": 1},
    {"chord": "A7b9", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\\"Dm7\\" D2 F2 A3 G|\\"G7\\" =F2 D2 B,2 z2|\\"Cmaj7\\" C2 E2 G3 A|\\"A7b9\\" G2 ^F2 E4|",
  "notes": [
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "F4", "duration": "4n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "A4", "duration": "4n.", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "F4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "B3", "duration": "4n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "C4", "duration": "4n", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "E4", "duration": "4n", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "G4", "duration": "4n.", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "F#4", "duration": "4n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "E4", "duration": "2n", "velocity": 0.8, "articulation": "accent"}
  ]
}`,
};

export function buildLickPrompt(genre: Genre, bars: number): { system: string; user: string } {
  const system = `You are a music theory expert and composer. You generate musical licks as structured JSON data. Your licks must be:
- Musically valid and idiomatic to the requested genre
- Playable on piano with one hand
- Interesting and educational for practice
- Using correct ABC notation compatible with the abcjs library
- Expressive: vary velocity and articulation like a real musician — not every note the same

You must respond with ONLY valid JSON matching the exact schema provided. No markdown, no explanation, just JSON.`;

  const user = `${GENRE_TECHNIQUES[genre]}

=== STRUCTURAL RULES (mandatory) ===
1. CHORD TONE TARGETING: On beats 1 and 3 of every bar, the note MUST be a chord tone (root, 3rd, 5th, or 7th) of the active chord. Other beats can use passing tones, approach notes, or chromatic connectors.
2. APPROACH NOTES: Use at least 2 approach notes (chromatic or diatonic) or enclosures per lick. An enclosure surrounds a target chord tone from above and below (e.g. D-B-C targets C).
3. RESTS: Include at least one rest per 2 bars. Use { "pitch": "rest", "duration": "8n" } (or any duration). Not every beat needs a note. Space creates musicality.
4. RHYTHMIC VARIETY: Use at least 3 different note durations. Do NOT write all 8th notes. Mix 16n, 8n, 4n, dotted values, etc.
5. MOTIVIC DEVELOPMENT: Establish a short motif (2-4 notes) in bar 1, then repeat it with variation (transposed, inverted, or rhythmically altered) later in the lick.
6. STRONG ENDING: The last note MUST be a chord tone (root, 3rd, or 5th) of the final chord, on a strong beat (1 or 3), with duration "4n" or longer.
7. PICKUP NOTES: Start with 1-3 pickup notes on beat 4 or the "and" of beat 4 of an implied preceding bar. Do not always start squarely on beat 1.
8. RANGE: Keep all pitched notes within C4 to E5 (middle C up to E above the staff).
9. NOTE COUNT: For a ${bars}-bar lick, use 12-24 notes total. Quality over quantity.
10. MELODIC CONTOUR: Shape the lick as an arch (rise then fall), cascade (descend then resolve up), or wave. No random jagged motion.

Generate a ${bars}-bar lick. Respond with this exact JSON structure:

{
  "genre": "${genre}",
  "title": "<descriptive title>",
  "bars": ${bars},
  "tempo": <appropriate tempo as integer>,
  "timeSignature": "4/4",
  "key": "<key signature, e.g. 'Bb', 'F', 'C'>",
  "swing": <0.0 to 1.0 — see style instructions above>,
  "feel": "<short description, e.g. 'medium swing', 'straight with ghost notes', 'shuffle'>",
  "chords": [
    {"chord": "<chord symbol>", "bar": <bar number starting at 1>, "beat": <beat number starting at 1>}
  ],
  "abc": "<valid ABC notation string>",
  "notes": [
    {
      "pitch": "<scientific pitch like C4, Eb5, or 'rest'>",
      "duration": "<Tone.js duration: 16n, 8n, 8n., 4n, 4n., 2n, 2n., 1n>",
      "velocity": <0.0-1.0 dynamics>,
      "articulation": "<normal|staccato|legato|accent|ghost>"
    }
  ]
}

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
- CRITICAL: To beam eighth notes together (connected flags), write them WITHOUT spaces: CDEF not C D E F. Group beams by beat (e.g. in 4/4 with L:1/8, beam pairs: CD EF GA Bc). Only put spaces where you want a beam break.

Important rules for the notes array:
- Pitch must use scientific pitch notation (C4 = middle C), or "rest" for silence
- Use sharps/flats matching the key signature (e.g., Eb not D# in Bb major)
- Duration uses Tone.js format: "16n"=sixteenth, "8n"=eighth, "4n"=quarter, "2n"=half, "1n"=whole. Add "." for dotted: "4n.", "8n."
- Do NOT include "time" — timing is computed from the duration sequence at playback
- Notes must be in sequential order
- The total duration of notes must fit within ${bars} bars of the time signature
- Rest notes use pitch "rest" with any valid duration. They produce silence but occupy rhythmic space.

=== REFERENCE EXAMPLE ===
Study this example carefully. Your output should match this level of musical quality, rhythmic variety, and structural integrity. Do NOT copy it — compose something original in the same style.

${GENRE_EXAMPLES[genre]}`;

  return { system, user };
}
