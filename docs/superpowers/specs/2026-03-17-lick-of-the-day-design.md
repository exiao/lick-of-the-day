# Lick of the Day — Design Spec

## Overview

A web app that serves a single AI-generated musical lick each day. Users can listen to the lick, read the sheet music, and practice it on an interactive piano using mouse clicks or computer keyboard. Genres: jazz, R&B, funk, blues, bossa nova.

## Architecture

**Approach:** Static site (React + Vite) with a thin edge function backend.

```
Browser (React SPA)
  ├── abcjs — renders sheet music from ABC notation
  ├── Tone.js — audio playback via Web Audio API
  └── Piano UI — interactive clickable/keyboard-driven piano

Edge Function (Vercel)
  ├── GET /api/daily — cached daily lick (same for everyone, 24h TTL)
  └── POST /api/random — on-demand lick generation with genre param
  └── Claude API (claude-sonnet-4-6) — generates licks as structured JSON
```

## Lick Data Format

```json
{
  "id": "2026-03-17",
  "genre": "jazz",
  "title": "Minor ii-V-I in Bb",
  "bars": 4,
  "tempo": 120,
  "timeSignature": "4/4",
  "key": "Bb",
  "chords": [
    {"chord": "Cm7", "bar": 1, "beat": 1},
    {"chord": "F7", "bar": 2, "beat": 1},
    {"chord": "Bbmaj7", "bar": 3, "beat": 1}
  ],
  "abc": "X:1\nK:Bb\nM:4/4\n|:\"Cm7\"CDEFz|\"F7\"GABc|\"Bbmaj7\"d4:|",
  "notes": [
    {"pitch": "C4", "duration": "8n", "time": 0.0},
    {"pitch": "D4", "duration": "8n", "time": 0.5}
  ]
}
```

- `abc`: drives abcjs sheet music rendering directly (abcjs consumes ABC notation natively)
- `notes`: drives Tone.js playback and practice mode note-matching
  - `pitch`: scientific pitch notation (e.g., "C4", "Eb5")
  - `duration`: Tone.js duration format (e.g., "8n" = eighth note, "4n" = quarter note)
  - `time`: offset in **seconds** from the start of the lick (at the given tempo)
- `chords`: positioned by bar number and beat, allowing multiple chord changes per bar
- `bars`: fixed per lick (daily = 4 bars; random = user-selected from 2, 4, 6, or 8)

## UI Components

### Page Layout

- **Header:** App title, genre selector dropdown, "New Lick" button, date
- **Sheet Music Panel:** abcjs-rendered staff with notes and chord symbols, bar length selector [2][4][6][8] (only shown for "New Lick" — daily lick is always 4 bars)
- **Transport Controls:** Play, Pause, Tempo slider (BPM)
- **Piano Panel:** Interactive piano keyboard with computer keyboard labels
- **Mode Toggle:** Listen mode vs Practice mode

### Piano

- **Range:** Determined per lick — compute min/max pitch from notes array, pad 4 white keys on each side, minimum 2 octaves displayed
- **Interaction:** Click keys with mouse OR use computer keyboard
- **Keyboard mapping (2-octave layout):**
  - Lower octave white keys: A S D F G H J K → C D E F G A B C
  - Lower octave black keys: W E T Y U → C# D# F# G# A# (R skipped to match physical piano spacing)
  - Upper octave white keys: Z X C V B N M , → C D E F G A B C
  - Upper octave black keys: S D G H J → C# D# F# G# A# (keys between Z-row whites)
  - If lick exceeds 2-octave range, the keyboard scrolls/shifts and mapping anchors to the lick's lowest note
- **Visual feedback:** Keys light up during playback, highlight expected note in practice mode

### Listen Mode

- Plays the lick via Tone.js with a piano synth sound
- Current note highlighted on sheet music (via abcjs cursor API) and piano simultaneously
- Adjustable tempo via BPM slider (recalculates note `time` values proportionally)

### Practice Mode

- **Pitch-only evaluation** — user must play the correct note in sequence; timing is not evaluated
- Sheet music shows progress: checkmarks for correct notes, cursor on next expected note
- Piano shows the expected key label as a hint (toggleable via "Show Hint" button)
- User clicks/presses the key — correct = green flash + advance, incorrect = red flash + stay
- Score counter: X/N notes correct
- Controls: Show Hint, Restart, Next Lick

### Genre Selector

Dropdown with: Jazz, R&B, Funk, Blues, Bossa Nova. Selecting a genre and clicking "New Lick" generates a lick in that style. The bar length selector [2][4][6][8] is available when generating a new lick.

### Responsive Layout

- **Desktop:** Sheet music and piano stacked vertically, full width
- **Mobile:** Same stack, piano keys narrower, keyboard shortcut labels hidden (touch-only)

## Edge Function: Lick Generation

### GET /api/daily

1. Check Vercel KV cache for key `lick:YYYY-MM-DD`
2. If cached, return it
3. If not, determine genre: `["jazz", "blues", "funk", "rnb", "bossa"][dayOfYear % 5]`
4. Call Claude API (claude-sonnet-4-6) with genre, 4-bar count, and JSON schema
5. Validate response parses as valid JSON matching the schema
6. Cache with 24h TTL, return it
7. On Claude API failure, return a hardcoded fallback lick

### POST /api/random

1. Accept `{ genre: string, bars: number }` in request body
2. Validate genre is one of the 5 options, bars is one of [2, 4, 6, 8]
3. Call Claude API with the specified genre and bar count
4. Rate limit: 10 requests per IP per hour (via Vercel KV counter)
5. Return generated lick

### Claude Prompt Strategy

The prompt asks Claude to generate a musically valid lick as structured JSON, specifying:
- Genre and characteristic elements (e.g., "bebop eighth-note lines" for jazz, "syncopated rhythms" for funk)
- Key signature, time signature, chord progression
- ABC notation for sheet music rendering (must be valid abcjs-compatible ABC)
- Note array with pitch (scientific notation), duration (Tone.js format), and time in seconds
- Chords array with bar/beat positioning
- The lick should be idiomatic, playable, and musically interesting

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Sheet Music:** abcjs (native ABC notation rendering)
- **Audio:** Tone.js
- **Styling:** Tailwind CSS
- **Backend:** Vercel Edge Functions
- **AI:** Claude API — claude-sonnet-4-6 (Anthropic SDK)
- **Cache:** Vercel KV (Redis)

## Out of Scope (MVP)

- User accounts / auth
- Practice history / streaks
- MIDI keyboard input
- Multiple instruments / sounds
- Community features
- Offline support
- Rhythm/timing evaluation in practice mode
