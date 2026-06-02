// Shared lick-generation config. Keep all call sites (Vercel api/, Cloudflare
// functions/, and the cron worker) pointed at the same model and limits.

// Haiku 4.5: ~2x faster than Sonnet for lick generation with comparable musical
// quality (and it follows rhythmic briefs like funk 16ths better in testing).
export const LICK_MODEL = "claude-haiku-4-5";

// A 4-bar lick generates ~1200 output tokens; 1536 leaves headroom for dense
// funk/8-bar lines without holding a needlessly large budget open.
export const LICK_MAX_TOKENS = 1536;
