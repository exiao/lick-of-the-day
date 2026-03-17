# Lick of the Day — Implementation Plan

Based on: `docs/superpowers/specs/2026-03-17-lick-of-the-day-design.md`

## Phase 1: Project Scaffold

1. Initialize Vite + React + TypeScript project
2. Install dependencies: `abcjs`, `tone`, `tailwindcss`, `@anthropic-ai/sdk`
3. Configure Tailwind CSS
4. Set up Vercel project structure with `/api` directory for edge functions
5. Create basic app shell with placeholder components

## Phase 2: Lick Data Layer

6. Define TypeScript types for the lick data format (`Lick`, `Note`, `Chord`)
7. Create a mock/hardcoded lick for development (valid ABC + notes array)
8. Build `useLick` hook that fetches from `/api/daily` or `/api/random`
9. Add loading and error states

## Phase 3: Sheet Music Rendering

10. Create `<SheetMusic>` component wrapping abcjs
11. Render ABC notation from lick data
12. Display chord symbols below staff
13. Add cursor/highlight API integration for note tracking during playback
14. Style with Tailwind for responsive sizing

## Phase 4: Piano Component

15. Create `<Piano>` component that renders keys based on a given note range
16. Compute range from lick's notes array (min/max pitch + 4-key padding, min 2 octaves)
17. Render white and black keys as clickable divs with proper CSS layout
18. Add mouse click handlers that trigger `onNotePlay(pitch)` callback
19. Add computer keyboard event listeners with the 2-octave mapping:
    - Lower: A-K (white), W/E/T/Y/U (black)
    - Upper: Z-, (white), contextual blacks
20. Show keyboard labels on each key
21. Add visual feedback: active state (key pressed), highlight state (expected note)

## Phase 5: Audio Playback (Listen Mode)

22. Create `usePlayback` hook using Tone.js
23. Initialize a `Tone.Sampler` or `Tone.Synth` with piano sound
24. Schedule note playback from lick's `notes` array using `Tone.Transport`
25. Emit current-note events to sync sheet music cursor and piano highlights
26. Add play/pause controls
27. Add tempo slider that rescales note timing proportionally
28. Wire up piano key clicks/presses to play sounds in both modes

## Phase 6: Practice Mode

29. Create `usePracticeMode` hook tracking: current note index, score, hint state
30. On key press, compare played pitch to expected pitch (enharmonic-aware)
31. Correct: green flash, advance index, increment score
32. Incorrect: red flash, stay on current note
33. Show progress on sheet music (checkmarks for completed notes)
34. Implement "Show Hint" toggle (highlights expected key on piano)
35. Implement "Restart" (reset index and score)
36. Show completion screen with score when all notes played

## Phase 7: Edge Functions + Claude Integration

37. Create `api/daily.ts` edge function:
    - Check Vercel KV for `lick:YYYY-MM-DD`
    - If miss: determine genre via `dayOfYear % 5`, call Claude API
    - Validate response JSON against schema
    - Cache with 24h TTL
    - Fallback to hardcoded lick on failure
38. Create `api/random.ts` edge function:
    - Parse and validate `{ genre, bars }` from request body
    - Rate limit: 10 req/IP/hour via KV counter
    - Call Claude API, return result
39. Write the Claude prompt template:
    - System prompt with music theory context and JSON schema
    - User prompt with genre, bar count, style guidance
    - Request structured JSON output
40. Add `ANTHROPIC_API_KEY` to Vercel environment variables

## Phase 8: UI Polish & Responsive

41. Build page layout: header, sheet music, transport, piano stacked vertically
42. Genre selector dropdown (Jazz, R&B, Funk, Blues, Bossa Nova)
43. "New Lick" button wired to `/api/random` with selected genre + bar count
44. Bar length selector [2][4][6][8] (visible only in New Lick flow)
45. Listen/Practice mode toggle
46. Date display showing today's date
47. Mobile responsive: narrower keys, hide keyboard labels, touch targets
48. Loading spinner during lick generation

## Phase 9: Testing & Deploy

49. Test with multiple lick fixtures across all 5 genres
50. Test piano keyboard mapping (all keys, both octaves)
51. Test practice mode scoring logic
52. Test edge functions locally with `vercel dev`
53. Deploy to Vercel
54. Verify daily lick caching works in production
55. Verify rate limiting on `/api/random`
