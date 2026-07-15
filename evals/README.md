# Lick evals

Reproducible quality + speed comparison for the lick generator. Instead of
eyeballing one sample, this generates N licks per model per genre, scores each
with a deterministic music-theory scorer, and reports aggregates with variance.

## Files

| File | What it does |
|------|--------------|
| `scorer.py` | Deterministic musicality scorer. No LLM. Pure music-theory checks. |
| `test_scorer.py` | Self-test for the scorer (no API keys, no network). |
| `dump_prompts.ts` | Dumps the repo's **real** `buildLickPrompt` output to `prompts.json`. |
| `run_eval.py` | Generates N licks per arm/genre, scores them, prints aggregates. |
| `prompts.json` / `results.json` | Generated artifacts (gitignored). |

## Quick start

```bash
# 1. Refresh prompts from the live source (run after any prompt change)
#    tsx is declared as a devDependency, so install once then use the script:
npm install            # first time only, makes tsx available
npm run dump-prompts   # writes evals/prompts.json from the real buildLickPrompt

# 2. Provide credentials (the gateway env already has these)
export ANTHROPIC_TOKEN=... ANTHROPIC_BASE_URL=...   # for claude-* arms
export GEMINI_API_KEY=...                            # for gemini-* arms
export OPENROUTER_API_KEY=...                        # for openrouter arms (grok45)

# 3. Run (defaults: arms haiku + flash_think0, genres jazz/blues/funk, N=5)
python3 evals/run_eval.py
```

Verify the scorer without any keys:

```bash
python3 evals/test_scorer.py
```

## Configuration (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `EVAL_N` | 5 | Samples per genre per arm |
| `EVAL_GENRES` | `jazz,blues,funk` | Comma list |
| `EVAL_ARMS` | `haiku,flash_think0` | Comma list of arm names (see `ARMS` in `run_eval.py`) |
| `EVAL_BARS` | 4 | Bar count (must match the value passed to `dump_prompts.ts`) |

Arms are defined in `run_eval.py`'s `ARMS` registry: `haiku`, `sonnet`,
`sonnet5`, `grok45`, `flash_think0`, `flash_dynamic`. Add your own
`(provider, model, options)` there. `sonnet5` currently points at
`claude-sonnet-5`. `grok45` is Grok 4.5 via OpenRouter (OpenAI-compatible) with
reasoning enabled because the provider requires it.

## The musicality scorer

Every sub-score is 0..1 and verifies a constraint the generation prompt
mandates. The `composite` weights playback/theory correctness highest.

| Check | Weight | Catches |
|-------|--------|---------|
| `duration_fits` | 3 | Note durations don't sum to the bar count (broken rhythm) |
| `strong_beat_chordtones` | 3 | Beats 1 & 3 aren't real chord tones (a rest or unparseable pitch there counts as a miss) |
| `strong_ending` | 2 | Last note isn't a chord tone held a quarter+ landing on strong beat 1 or 3 |
| `valid_durations` | 2 | Notes use durations outside the Tone.js set (unplayable) |
| `in_range` | 1 | Notes outside the one-hand C4–E5 range |
| `rhythmic_variety` | 1 | Fewer than 3 distinct durations |
| `rest_density` | 1 | Fewer than one rest per 2 bars |
| `enharmonic_sane` | 1 | Double accidentals (e.g. `Bbb`, `F##`) |
| `playable_leaps` | 1 | Consecutive jumps bigger than a major 10th |
| `note_count` | 1 | Note count outside the mandated 12–24 window |
| `abc_valid` | 1 | Missing ABC headers or too few barlines |

It deliberately scores *constraint compliance*, not "is this beautiful music"
(no scorer can judge that). It's for catching regressions and comparing models
on the rules we actually ask for.

## Findings (the reason this exists)

Measured on this prompt, 4-bar licks, N=5/cell:

- **Haiku 4.5 and Gemini 3.5 Flash (thinking off) are a statistical tie**:
  composite ~0.876 each, ~6s each. They trade per-genre wins (Flash edges
  jazz/funk, Haiku edges blues). Both far beat Sonnet's ~13s.
- **Gemini 3.x Flash is a thinking model by default.** Without
  `thinkingConfig.thinkingBudget = 0`, reasoning tokens eat the output budget
  and the JSON truncates → parse failures.
- **A small thinking cap is the worst setting.** With `thinkingBudget=128`
  the model overran the cap (≈1960 thinking tokens anyway), produced ~68
  output tokens, and failed to parse ~80% of the time, *and* was slower.
  Use `0` (off) or a large/dynamic budget. Nothing in between.

Conclusion: stay on Haiku. Flash offers no meaningful quality or speed gain
to justify a second SDK, a new env var, and the thinking-budget landmine.
