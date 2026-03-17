# Lick of the Day

Practice and pick up a new lick every day. AI-generated musical licks across jazz, R&B, funk, blues, and bossa nova — with interactive sheet music and a playable piano.

## Features

- **Daily lick**: One shared lick for everyone, refreshed every 24 hours
- **New lick on demand**: Generate random licks by genre (jazz, R&B, funk, blues, bossa nova) and length (2/4/6/8 bars)
- **Sheet music**: Rendered via abcjs with chord symbols
- **Interactive piano**: Click or use your computer keyboard (A-K = white keys, W/E/T/Y/U = sharps)
- **Listen mode**: Hear the lick played back with adjustable tempo
- **Practice mode**: Play notes in sequence, get instant feedback on correctness

## Tech Stack

- React + TypeScript + Vite
- abcjs (sheet music rendering)
- Tone.js (audio playback)
- Tailwind CSS
- Vercel Edge Functions + Claude API (lick generation)

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel. Set `ANTHROPIC_API_KEY` in environment variables.

```bash
vercel
```
