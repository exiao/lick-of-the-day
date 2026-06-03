import type { Genre } from "../types/lick";

const GENRE_TECHNIQUES: Record<Genre, string> = {
  jazz: `Style: Jazz (Bebop)
Techniques: Use enclosures (surround a chord tone from above and below, e.g. D-B-C to target C). Flip enclosures so they move AGAINST the line's prevailing direction (if the line is descending, enclose from below moving up): this makes the line feel more alive. Use 1-2-3-5 digital patterns. Apply the bebop scale (add a chromatic passing tone so chord tones land on downbeats and the chromatic note falls on an upbeat). Land on guide tones (3rd or 7th) of each chord when outlining ii-V-I progressions. Avoid notes: keep the 4th (11th) off strong beats over major and dominant chords, and keep the natural 7 off strong beats over minor 7 chords. Use them only as quick passing tones on weak beats. Swing feel required (swing: 0.33-0.67).`,

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
  jazz: `Example jazz lick (ii-V-I in C, 4 bars, riff-based. Note how SIMPLE it is: a short motif repeated with variation, syncopation (notes pushed off the beat), and space. A catchy line, NOT a continuous scale run):
{
  "genre": "jazz",
  "title": "Simple Bebop Anticipation",
  "bars": 4,
  "tempo": 140,
  "timeSignature": "4/4",
  "key": "C",
  "swing": 0.55,
  "feel": "medium swing",
  "chords": [
    {"chord": "Dm7", "bar": 1, "beat": 1},
    {"chord": "G7", "bar": 2, "beat": 1},
    {"chord": "Cmaj7", "bar": 3, "beat": 1},
    {"chord": "Cmaj7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\"Dm7\"A2 z F D2 z D|\"G7\"D2 z F B2 z2|\"Cmaj7\"E2 z G c2 z B|\"Cmaj7\"G2 z D E4|",
  "notes": [
    {"pitch": "A4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.7, "articulation": "accent"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.65, "articulation": "ghost"},
    {"pitch": "B4", "duration": "4n", "velocity": 0.85, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C5", "duration": "4n", "velocity": 0.8, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "B4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.8, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.6, "articulation": "ghost"},
    {"pitch": "E4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
  ]
}`,

  blues: `Example blues lick (G blues, 4 bars, riff-based. Note how SIMPLE it is: a short motif repeated with variation, syncopation (notes pushed off the beat), and space. A catchy line, NOT a continuous scale run):
{
  "genre": "blues",
  "title": "Simple Blues Call & Answer",
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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:G\\n\"G7\"G2 z _B B2 z2|\"G7\"D2 z2 G z D2|\"C7\"G2 z _B c2 z2|\"G7\"D F z2 G4|",
  "notes": [
    {"pitch": "G4", "duration": "4n", "velocity": 0.9, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.6, "articulation": "ghost"},
    {"pitch": "B4", "duration": "4n", "velocity": 0.8, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "G4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.65, "articulation": "ghost"},
    {"pitch": "C5", "duration": "4n", "velocity": 0.8, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.6, "articulation": "ghost"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.6, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
  ]
}`,

  funk: `Example funk lick (Bb minor, 4 bars, riff-based. Note how SIMPLE it is: a short motif repeated with variation, syncopation (notes pushed off the beat), and space. A catchy line, NOT a continuous scale run):
{
  "genre": "funk",
  "title": "Two-Note Funk Stab",
  "bars": 4,
  "tempo": 96,
  "timeSignature": "4/4",
  "key": "Bbm",
  "swing": 0.0,
  "feel": "syncopated funk pocket",
  "chords": [
    {"chord": "Bbm7", "bar": 1, "beat": 1},
    {"chord": "Bbm7", "bar": 2, "beat": 1},
    {"chord": "Eb7", "bar": 3, "beat": 1},
    {"chord": "Bbm7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:Bbm\\n\"Bbm7\"_B2 z2 _A z z _B|\"Bbm7\"_B2 z2 _A z F2|\"Eb7\"_e2 z2 _d z z _B|\"Bbm7\"_B2 z _A _B4|",
  "notes": [
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.9, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Ab4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Ab4", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "F4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "Eb5", "duration": "4n", "velocity": 0.9, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Db5", "duration": "8n", "velocity": 0.7, "articulation": "staccato"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Ab4", "duration": "8n", "velocity": 0.6, "articulation": "ghost"},
    {"pitch": "Bb4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
  ]
}`,

  rnb: `Example R&B lick (Fmaj9 to Gm7, 4 bars, riff-based. Note how SIMPLE it is: a short motif repeated with variation, syncopation (notes pushed off the beat), and space. A catchy line, NOT a continuous scale run):
{
  "genre": "rnb",
  "title": "Neo-Soul Syncopated Stabs",
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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:F\\n\"Fmaj9\"A2 z2 c z A2|\"Fmaj9\"c2 z A F2 z2|\"Bbmaj7\"d2 z2 f z d2|\"Gm7\"_B2 z A D4|",
  "notes": [
    {"pitch": "A4", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "A4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "C5", "duration": "4n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "F4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D5", "duration": "4n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "F5", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D5", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "4n", "velocity": 0.75, "articulation": "normal"},
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "A4", "duration": "8n", "velocity": 0.6, "articulation": "ghost"},
    {"pitch": "D4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
  ]
}`,

  bossa: `Example bossa nova lick (Dm7-G7-Cmaj7, 4 bars, riff-based. Note how SIMPLE it is: a short motif repeated with variation, syncopation (notes pushed off the beat), and space. A catchy line, NOT a continuous scale run):
{
  "genre": "bossa",
  "title": "Simple Ipanema Motif",
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
    {"chord": "Cmaj7", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\"Dm7\"F3 E D2 z2|\"G7\"D3 B, D2 z2|\"Cmaj7\"E3 D C2 z2|\"Cmaj7\"E3 D C4|",
  "notes": [
    {"pitch": "F4", "duration": "4n.", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "E4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n.", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "B3", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "4n.", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "E4", "duration": "4n.", "velocity": 0.75, "articulation": "accent"},
    {"pitch": "D4", "duration": "8n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
  ]
}`,

};

export function buildLickPrompt(genre: Genre, bars: number): { system: string; user: string } {
  // SYSTEM: fully static across every request so prompt caching (cache_control
  // on this block) produces real cache hits. No genre/bars interpolation here.
  const system = `You are a music theory expert and composer. You generate musical licks as structured JSON data. Your licks must be:
- Musically valid and idiomatic to the requested genre
- Playable on piano with one hand
- Interesting and educational for practice
- Using correct ABC notation compatible with the abcjs library
- Expressive: vary velocity and articulation like a real musician — not every note the same

You must respond with ONLY valid JSON matching the exact schema provided. No markdown, no explanation, just JSON.

=== STRUCTURAL RULES (mandatory) ===
1. KEEP IT SIMPLE: A catchy line is simple. Build it from ONE short motif (2-4 notes) and repeat that motif with small variations. Most great hooks are just a few notes; if you can hum it three times in a row without strain, it is simple enough. Do not cram in notes. Fewer notes with a strong rhythm beats more notes every time.
2. SYNCOPATION: Place accents OFF the beat, not squarely on every downbeat. Three idiomatic moves: (a) anticipation/"push" - strike a chord tone on the "and" of beat 4 and sustain it across the bar line so it rings into the next downbeat; (b) missed beat - leave a strong beat as a rest, then hit the following weak beat hard; (c) offbeat stabs - put short accented notes on the "and" of a beat. Syncopation is what makes a rhythm feel alive instead of robotic.
3. CHORD TONE TARGETING: On beats 1 and 3 of every bar a chord tone (root, 3rd, 5th, or 7th of the active chord) should be SOUNDING, but it does not have to be struck exactly on the beat. A chord tone anticipated on the prior "and" and sustained across the beat counts. Other beats can use passing tones, approach notes, or chromatic connectors.
4. APPROACH NOTES: Use at least 2 approach notes (chromatic or diatonic) or enclosures per lick. An enclosure surrounds a target chord tone from above and below (e.g. D-B-C targets C).
5. APPROACH PLACEMENT: Put approach and chromatic notes on weak beats (the "e" and the "and" of a beat) and land the resolution chord tone on the FOLLOWING strong beat. Approach from a half-step below (C#->D), a step above (Eb->D), or both sides (enclosure). A chromatic note on a strong beat sounds like a wrong note; on a weak beat resolving to a strong beat it sounds intentional.
6. DIRECTION CHANGES: Reverse the melodic direction on an upbeat (the "and" of a beat), NOT on beats 1 or 3. Turning the line around on a downbeat sounds stiff and heavy; turning it off the beat creates swing and forward motion.
7. RESTS: Include at least one rest per 2 bars. Use { "pitch": "rest", "duration": "8n" } (or any duration). Not every beat needs a note. Space is part of the groove, not a gap to fill.
8. BREAK UP RUNS: Do not run more than ~4 consecutive notes of the same duration (especially straight 8ths or 16ths). Interrupt a run with a rest or a longer note. Nobody wants to hear a scale.
9. RHYTHMIC VARIETY: Use at least 3 different note durations. Do NOT write all 8th notes. Mix 16n, 8n, 4n, dotted values, etc.
10. PHRASE ACROSS THE BAR LINE: Do not resolve and reset neatly inside every bar. Let at least one phrase carry across a bar line and drive into the next bar.
11. STRONG ENDING: The last note MUST be a chord tone (root, 3rd, or 5th) of the final chord, on a strong beat (1 or 3), with duration "4n" or longer.
12. PICKUP NOTES: Start with 1-3 pickup notes on beat 4 or the "and" of beat 4 of an implied preceding bar. Do not always start squarely on beat 1.
13. RANGE: Keep all pitched notes within C4 to E5 (middle C up to E above the staff).
14. NOTE COUNT: For a ${bars}-bar lick, use 12-18 notes total. Lean simple. Quality and rhythm over quantity.
15. MELODIC CONTOUR: Shape the lick as an arch (rise then fall), cascade (descend then resolve up), or wave. No random jagged motion.

Respond with this exact JSON structure (fill in the requested genre and bar count):

{
  "genre": "<genre>",
  "title": "<descriptive title>",
  "bars": <number of bars>,
  "tempo": <appropriate tempo as integer>,
  "timeSignature": "4/4",
  "key": "<key signature, e.g. 'Bb', 'F', 'C'>",
  "swing": <0.0 to 1.0 — see style instructions>,
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
- The total duration of notes must fit within the requested number of bars of the time signature
- Rest notes use pitch "rest" with any valid duration. They produce silence but occupy rhythmic space.`;

  // USER: only the genre- and bars-specific content varies per request.
  const user = `${GENRE_TECHNIQUES[genre]}

Generate a ${bars}-bar lick in the style above. Set "genre" to "${genre}" and "bars" to ${bars} in the JSON.

=== REFERENCE EXAMPLE ===
Study this example carefully. Your output should match this level of musical quality, rhythmic variety, and structural integrity. Do NOT copy it — compose something original in the same style.

${GENRE_EXAMPLES[genre]}`;

  return { system, user };
}
