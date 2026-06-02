/**
 * Dump the repo's real lick-generation prompts to JSON so the Python eval
 * runner tests the *actual* prompt (not a stale copy).
 *
 *   npx tsx evals/dump_prompts.ts > evals/prompts.json
 *
 * Output shape: { [genre]: { system: string, user: string } }
 */
import { buildLickPrompt } from "../src/utils/prompt";
import type { Genre } from "../src/types/lick";

const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
const BARS = Number(process.env.EVAL_BARS ?? 4);

const out: Record<string, { system: string; user: string }> = {};
for (const g of GENRES) out[g] = buildLickPrompt(g, BARS);

process.stdout.write(JSON.stringify(out, null, 2));
