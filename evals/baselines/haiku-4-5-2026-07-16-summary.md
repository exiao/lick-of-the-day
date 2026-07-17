# Lick eval baseline — Haiku 4.5

Reference measurement for downstream lick-model and prompt experiments. This is a record-only baseline: no prompts or scorer logic were changed for this run.

## Run contract

| Field | Value |
|---|---|
| Production `LICK_MODEL` | `claude-haiku-4-5` |
| Eval arm | `haiku` (`claude-haiku-4-5`) |
| Grid | 5 genres × 5 samples = 25 total generations |
| Genres | `jazz`, `blues`, `funk`, `rnb`, `bossa` |
| Bars | 4 |
| Composite | deterministic `evals/scorer.py` weighted composite, range 0–1 |
| Prompt source | real `buildLickPrompt` output via `npm run dump-prompts` |
| Completed (UTC) | 2026-07-16T16:52:58Z |

## Results

All 25 responses parsed and were scored. Composite means include every generated sample; parse rate is `parsed / generated`.

| Genre | Generated | Parsed | Parse rate | Composite mean | Composite population SD |
|---|---:|---:|---:|---:|---:|
| Jazz | 5 | 5 | 100.0% | 0.901 | 0.043 |
| Blues | 5 | 5 | 100.0% | 0.746 | 0.055 |
| Funk | 5 | 5 | 100.0% | 0.774 | 0.056 |
| R&B | 5 | 5 | 100.0% | 0.831 | 0.102 |
| Bossa | 5 | 5 | 100.0% | 0.923 | 0.050 |
| **Overall** | **25** | **25** | **100.0%** | **0.835** | **0.095** |

Post-merge provenance correction: the committed raw rows yield an unrounded overall composite mean of `0.834960000000` (the rounded table value remains `0.835`).

## Provenance and raw artifacts

- Raw rows: [`haiku-4-5-2026-07-16-raw.json`](haiku-4-5-2026-07-16-raw.json) (25 rows; SHA-256 `58926bb142236a5009407c810332f36d7ba641da4d398d3dfd06628c3edb170b`)
- Harness console output: [`haiku-4-5-2026-07-16-run.log`](haiku-4-5-2026-07-16-run.log)
- Prompt snapshot SHA-256: `24f6d15af2e85e93ed8727b533a49f55cf501a296b87be1ad2fc6746e06985d9` (`evals/prompts.json`, generated from the live source at run time; ignored because it is regenerated)
- Scorer SHA-256: `43689b3b75c4b7649dedb7047e8320a883cc4eb1fdacab298fbf43b946693292` (`evals/scorer.py`)

`npm install` was attempted per the harness command but did not resolve because the repository currently combines Vite 8 with `@tailwindcss/vite` 4.2.1, whose peer range ends at Vite 7. The already-present dependency tree successfully ran `npm run dump-prompts`; no lockfile or dependency-resolution change was made for this measurement.
