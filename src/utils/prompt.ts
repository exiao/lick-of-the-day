import type { Genre } from "../types/lick";

const GENRE_TECHNIQUES: Record<Genre, string> = {
  jazz: `Style: Jazz (Bebop)
Changes: Vary progression and key; do not default to ii-V-I in C. Pick one: major ii-V-I, minor ii-V-i (m7b5 - 7b9 - m6, e.g. Em7b5-A7b9-Dm6), or a I-vi-ii-V turnaround (two chords per bar allowed, the second on beat 3). Keys: F, Bb, Eb, G, C, or D minor.
Techniques: Guide tones: resolve each chord's 7th down by step to the next chord's 3rd (C over Dm7 -> B over G7), landing that 3rd on the downbeat or anticipated on the prior "and". Over 7b9 chords, use the b9 as a tension resolving down a half-step (Bb over A7b9 -> A). Motif sequencing: state a 3-5 note rhythmic cell, then restate it transposed over the next chord. Use enclosures (surround a chord tone from above and below, e.g. D-B-C to target C). Flip enclosures so they move AGAINST the line's prevailing direction (if the line is descending, enclose from below moving up): this makes the line feel more alive. Use 1-2-3-5 digital patterns. Apply the bebop scale (add a chromatic passing tone so chord tones land on downbeats and the chromatic note falls on an upbeat). Avoid notes: keep the 4th (11th) off strong beats over major and dominant chords, and keep the natural 7 off strong beats over minor 7 chords. Use them only as quick passing tones on weak beats. Swing feel required (swing: 0.33-0.67).`,

  blues: `Style: Blues
Techniques: Use the b3-to-natural-3 "blue note slide" (write it as a 16n on the b3 followed by the natural 3: a real note in both the notes array and the ABC, NOT an ABC grace note). Write call-and-response: a 2-bar question phrase followed by a 2-bar answering phrase. Emphasize b3, b5, and b7 (the blue notes). Mix major and minor pentatonic freely. Shuffle feel (swing: 0.33-0.5).`,

  funk: `Style: Funk
Techniques: Write tight 16th note patterns. At least 40% of notes should have articulation "staccato" or "ghost". Anchor lines on the root and b7. Syncopate by emphasizing offbeat 16ths (the "e" and "a"). Straight feel (swing: 0.0-0.2). The rhythm IS the melody.`,

  rnb: `Style: R&B / Neo-Soul (groove first)
Changes: Move through real changes, not a one-chord vamp. Pick one: ii-V-I-vi (e.g. Fm9-Bb13-Ebmaj9-Cm9), IVmaj7-iii7-vi7 (e.g. Abmaj7-Gm7-Cm7), or a minor i-iv groove (e.g. Cm9-Fm9). One chord per bar, or two per bar with the second on beat 3. Keys: Eb, Ab, F, Bb, Db, or C minor.
Techniques: The lick plays over a drum and bass groove, so leave it room. Call and response: bars 1-2 state a short CALL, bars 3-4 ANSWER it with the same rhythm and new pitches, and each phrase ends in a rest. Syncopate on the 16th grid: short notes on the "e" and "a" of a beat, longer notes that start on an "and" and sustain through the next strong beat. Scoop into target notes with a 16n a half or whole step below (a real 16n note in both the notes array and the ABC, NOT an ABC grace note). Land on each chord's 3rd, 7th or 9th as it arrives; mix major and minor pentatonic over the tonic. Stay in the vocal register (about E4 to Eb5). Light 16th-note swing (swing: 0.1-0.3).`,

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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\\"Dm7\\"A2 z F D2 z D|\\"G7\\"D2 z F B2 z2|\\"Cmaj7\\"E2 z G c2 z B|\\"Cmaj7\\"G2 z D E4|",
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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:G\\n\\"G7\\"G2 z _B =B2 z2|\\"G7\\"D2 z2 G z D2|\\"C7\\"G2 z _B c2 z2|\\"G7\\"D =F z2 G4|",
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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:Bbm\\n\\"Bbm7\\"_B2 z2 _A z z _B|\\"Bbm7\\"_B2 z2 _A z F2|\\"Eb7\\"_e2 z2 _d z z _B|\\"Bbm7\\"_B2 z _A _B4|",
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
    {"pitch": "F4", "duration": "4n", "velocity": 0.65, "articulation": "ghost"},
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

  rnb: `Example R&B lick (ii-V-I-vi in Eb, 4 bars, call and response. Note how SIMPLE it is: bars 1-2 are the call, bars 3-4 answer with the same rhythmic idea, 16th scoops and pushes give the syncopation, and rests leave room for the drums and bass. Every bar adds up to exactly 16 steps):
{
  "genre": "rnb",
  "title": "Neo-Soul Call & Answer in Eb",
  "bars": 4,
  "tempo": 84,
  "timeSignature": "4/4",
  "key": "Eb",
  "swing": 0.2,
  "feel": "laid-back 16th pocket",
  "chords": [
    {"chord": "Fm9", "bar": 1, "beat": 1},
    {"chord": "Bb13", "bar": 2, "beat": 1},
    {"chord": "Ebmaj9", "bar": 3, "beat": 1},
    {"chord": "Cm9", "bar": 4, "beat": 1}
  ],
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:Eb\\n\\"Fm9\\"z A/c/ e c3 F2|\\"Bb13\\"d A G F3 z2|\\"Ebmaj9\\"G z/B/ d3/2B3/2 G3|\\"Cm9\\"c z/B/ GF E4|",
  "notes": [
    {"pitch": "rest", "duration": "8n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Ab4", "duration": "16n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "C5", "duration": "16n", "velocity": 0.6, "articulation": "legato"},
    {"pitch": "Eb5", "duration": "8n", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "C5", "duration": "4n.", "velocity": 0.75, "articulation": "legato"},
    {"pitch": "F4", "duration": "4n", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "D5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "Ab4", "duration": "8n", "velocity": 0.6, "articulation": "staccato"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.55, "articulation": "normal"},
    {"pitch": "F4", "duration": "4n.", "velocity": 0.75, "articulation": "legato"},
    {"pitch": "rest", "duration": "4n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "rest", "duration": "16n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "16n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "D5", "duration": "8n.", "velocity": 0.85, "articulation": "accent"},
    {"pitch": "Bb4", "duration": "8n.", "velocity": 0.65, "articulation": "legato"},
    {"pitch": "G4", "duration": "4n.", "velocity": 0.7, "articulation": "normal"},
    {"pitch": "C5", "duration": "8n", "velocity": 0.8, "articulation": "accent"},
    {"pitch": "rest", "duration": "16n", "velocity": 0.0, "articulation": "normal"},
    {"pitch": "Bb4", "duration": "16n", "velocity": 0.35, "articulation": "ghost"},
    {"pitch": "G4", "duration": "8n", "velocity": 0.65, "articulation": "normal"},
    {"pitch": "F4", "duration": "8n", "velocity": 0.55, "articulation": "legato"},
    {"pitch": "Eb4", "duration": "2n", "velocity": 0.9, "articulation": "accent"}
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
  "abc": "X:1\\nM:4/4\\nL:1/8\\nK:C\\n\\"Dm7\\"F3 E D2 z2|\\"G7\\"D3 B, D2 z2|\\"Cmaj7\\"E3 D C2 z2|\\"Cmaj7\\"E3 D C4|",
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
2. SYNCOPATION: Place accents OFF the beat, not squarely on every downbeat. Three idiomatic moves: (a) anticipation/"push" - strike a chord tone of the NEXT chord on the "and" of beat 4, as the last note of the bar (it ends at the bar line: notes never cross a bar line), so the harmony arrives early; (b) missed beat - leave a strong beat as a rest, then hit the following weak beat hard; (c) offbeat stabs - put short accented notes on the "and" of a beat. Syncopation is what makes a rhythm feel alive instead of robotic.
3. CHORD TONE TARGETING: On beats 1 and 3 of every bar a chord tone (root, 3rd, 5th, or 7th of the active chord) should be SOUNDING, but it does not have to be struck exactly on the beat. A chord tone struck on the prior "and" and sustained across the beat counts (inside the bar; for beat 1, a push on the previous bar's "and" of 4 counts). Other beats can use passing tones, approach notes, or chromatic connectors.
4. APPROACH NOTES: Use at least 2 approach notes (chromatic or diatonic) or enclosures per lick. An enclosure surrounds a target chord tone from above and below (e.g. D-B-C targets C).
5. APPROACH PLACEMENT: Put approach and chromatic notes on weak beats (the "e" and the "and" of a beat) and land the resolution chord tone on the FOLLOWING strong beat. Approach from a half-step below (C#->D), a step above (Eb->D), or both sides (enclosure). A chromatic note on a strong beat sounds like a wrong note; on a weak beat resolving to a strong beat it sounds intentional.
6. DIRECTION CHANGES: Reverse the melodic direction on an upbeat (the "and" of a beat), NOT on beats 1 or 3. Turning the line around on a downbeat sounds stiff and heavy; turning it off the beat creates swing and forward motion.
7. RESTS: Include at least one rest per 2 bars. Use { "pitch": "rest", "duration": "8n" } (or any duration). Not every beat needs a note. Space is part of the groove, not a gap to fill.
8. BREAK UP RUNS: Do not run more than ~4 consecutive notes of the same duration (especially straight 8ths or 16ths). Interrupt a run with a rest or a longer note. Nobody wants to hear a scale.
9. RHYTHMIC VARIETY: Use at least 3 different note durations. Do NOT write all 8th notes. Mix 16n, 8n, 4n, dotted values, etc.
10. PHRASE ACROSS THE BAR LINE: Do not resolve and reset neatly inside every bar. Let at least one phrase carry across a bar line and drive into the next bar.
11. STRONG ENDING: The last note MUST be a chord tone (root, 3rd, or 5th) of the final chord, on a strong beat (1 or 3), with duration "4n" or longer.
12. PICKUP FEEL: Do not always start squarely on beat 1. Often open bar 1 with a short rest and enter on an upbeat, so the first notes feel like a pickup into the phrase (there is no separate pickup bar).
13. RANGE: Keep all pitched notes within C4 to E5 (middle C up to E above the staff).
14. NOTE COUNT: Keep it lean. Aim for roughly 3 to 5 notes per bar. A few extra is fine when the rhythm is strong, but never pad. Quality and rhythm over quantity.
15. MELODIC CONTOUR: Shape the lick as an arch (rise then fall), cascade (descend then resolve up), or wave. No random jagged motion.
16. BAR MATH (the most common failure; check it before answering): Compose bar by bar on a 16-step grid, one step = one 16th note. Steps: 16n=1, 8n=2, 8n.=3, 4n=4, 4n.=6, 2n=8, 2n.=12, 1n=16. In 4/4 the notes AND rests of every bar add up to exactly 16 steps, no note crosses a bar line, and the whole lick is exactly 16 x bars steps. In the ABC (L:1/8) the same bar adds up to 8: c/ = 16n, c = 8n, c3/2 = 8n., c2 = 4n, c3 = 4n., c4 = 2n, c6 = 2n., c8 = 1n (same for z rests).

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
- ALIGNMENT: The ABC must encode EXACTLY the notes array: one ABC note or rest (z) per array entry, with the same pitches, durations and order. No ties, no grace notes, no triplets, no pickup bar (a pickup = rests then notes inside bar 1). Every bar must sum to a full measure. Place each chord symbol directly before the note or rest that starts at that chord's bar and beat.
- Octaves: C, = C3, C = C4, c = C5. Accidentals persist to the end of the bar: after _B, a later B natural in that bar must be written =B. Key-signature accidentals apply unless overridden (in K:G, F natural is =F).

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

Generate a ${bars}-bar lick in the style above (aim for about ${bars * 3} to ${bars * 5} notes total, lean and simple). Set "genre" to "${genre}" and "bars" to ${bars} in the JSON.

=== REFERENCE EXAMPLE ===
Study this example carefully. Your output should match this level of musical quality, rhythmic variety, and structural integrity. Do NOT copy it — compose something original in the same style.

${GENRE_EXAMPLES[genre]}`;

  return { system, user };
}
