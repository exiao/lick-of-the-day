// Shared lick-generation config for Cloudflare Pages functions and the cron
// worker. Mirror of src/utils/lick-config.ts (kept separate to respect the
// functions/_shared import boundary). Keep both in sync.

// Haiku 4.5: ~2x faster than Sonnet for lick generation with comparable musical
// quality (and it follows rhythmic briefs like funk 16ths better in testing).
export const LICK_MODEL = "claude-haiku-4-5";

// Keep generous headroom: an 8-bar dense funk lick can exceed 1500 output
// tokens, and a smaller cap only risks truncating the JSON (latency tracks
// the tokens actually generated, not the cap).
export const LICK_MAX_TOKENS = 2048;

// Grok 4.5 (xAI) for the DAILY CRON ONLY. In a N=2 x 5-genre eval it scored a
// 0.939 composite and won every genre (vs haiku 0.797, sonnet-5 0.810), but its
// reasoning is uncappable: effort:"low", reasoning_effort, and
// reasoning.max_tokens all still emit ~13k reasoning tokens, so a single lick
// takes ~145s. That latency is invisible in the midnight cron (nobody waits),
// so the cron uses grok for best quality; the user-facing daily.ts cold-start
// and random.ts stay on LICK_MODEL (haiku) for instant response. If grok fails
// or times out, the cron falls back to haiku.
export const GROK_MODEL = "grok-4.5";
export const GROK_MAX_TOKENS = 20000; // grok needs headroom for reasoning + the visible lick
