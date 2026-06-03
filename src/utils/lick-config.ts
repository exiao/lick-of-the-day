// Shared lick-generation config. Keep all call sites (Vercel api/, Cloudflare
// functions/, and the cron worker) pointed at the same model and limits.

// Haiku 4.5: ~2x faster than Sonnet for lick generation with comparable musical
// quality (and it follows rhythmic briefs like funk 16ths better in testing).
export const LICK_MODEL = "claude-haiku-4-5";

// Keep generous headroom: an 8-bar dense funk lick can exceed 1500 output
// tokens, and a smaller cap only risks truncating the JSON (latency tracks
// the tokens actually generated, not the cap).
export const LICK_MAX_TOKENS = 2048;
