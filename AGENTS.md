# Lick of the Day

AI music-practice web app: a daily generated musical lick with interactive sheet music (abcjs) and a playable piano (Tone.js). React + TypeScript + Vite + Tailwind on the client; Cloudflare Pages Functions + Claude API for lick generation.

> This file is read by Codex GitHub code review (it loads `AGENTS.md` by name). The `CODEX-ONLY` block below carries review instructions for Codex. Keep this block within the first ~32 KiB of the file (Codex stops reading past `project_doc_max_bytes`, 32 KiB default). Do not replace this file with a symlink — Codex does not follow symlinks for AGENTS.md.

<!-- CODEX-ONLY:START -->
## Code Review Instructions (Codex)

Review this PR for "Lick of the Day," a music-practice web app (React + TypeScript + Vite, Tailwind, abcjs sheet music, Tone.js audio, Cloudflare Pages Functions + Claude API for lick generation). Correctness of the lick generation/parsing and audio/notation rendering come first, then security.

Operate with a skeptical, evidence-driven mindset. Verify every claim against the actual code in the diff and its surrounding call paths. Distinguish confirmed bugs from assumptions. You may be wrong; accuracy is the shared objective. Optimize for precision: the author acts on every finding, so a false alarm costs more than a missed nit.

**Find these, in priority order:**

1. **Bugs and regressions** (weight highest):
   - Lick generation: malformed ABC notation or chord data from the LLM rendered without validation (crashes abcjs).
   - Daily-lick caching: the "one shared lick per 24h" logic keyed on the wrong window or timezone, serving a stale/duplicate lick.
   - Tone.js playback: note scheduling off by an octave/beat, or audio context not resumed on user gesture (browser autoplay policy).
   - React state: practice-mode feedback comparing against the wrong expected note; missing cleanup of audio nodes (leak).
   - Pages/Worker function: Claude API key exposed client-side, or an unhandled API error returned as a valid lick.
2. **Data integrity:** generated licks persist/cache correctly across Edge function invocations.
3. **Security:** Claude API key must stay server-side (Edge/Worker), not bundled into the Vite client; injection on user input.

**Evidence gates — satisfy each before flagging, or say you can't and lower confidence:**

1. **Trace the call path.** For "reads the wrong thing / never runs / breaks at runtime," cite the line that writes the value, registers the route, or defines the behavior. If it's not in the diff or nearby code, mark confidence LOW and label "Needs author confirmation" instead of asserting a bug.
2. **Runtime-context check.** Lick generation runs in Cloudflare Pages Functions (server-side); the Claude key lives there. The Vite client is fully public. Before flagging a key, confirm whether it's in client or edge code.
3. **No fabrication.** Never invent endpoints, schemas, secrets, versions, or test results. If a claim can't be proven from the provided context, say so explicitly.
4. **No repeats.** If a prior review thread resolved or declined this exact issue, do not re-raise it.

**Severity (assign honestly, do not inflate):**

- **P0** = actively exploitable security hole or guaranteed production data loss/corruption. Merge-blocking. Rare. Unsure it's exploitable → not P0.
- **P1** = breaks production at runtime: crash, wrong data served, endpoint unreachable, or a real correctness/regression bug that ships broken behavior.
- **P2** = correctness issue that degrades behavior without breaking prod.
- **P3** = style, robustness, test gaps, and all documentation.
- Documentation, comments, and "update the README/docs" are **P3, never higher**. Bundle all doc suggestions into ONE comment.

**Do NOT flag:** style/naming, pre-existing issues not introduced by this PR, issues on unmodified lines, "this could be slightly better," premature optimization, or error handling for scenarios needing multiple unlikely conditions.

**Each finding must include:** (a) the concrete failure scenario ("when X hits Y, Z breaks"), (b) the evidence line/SHA, (c) a one-line fix. A vague concern → omit it.

**End every review with one line:** `N P0, M P1, K P2, J P3 — top issue: <one sentence>`. Zero P0/P1/P2 → "No blocking issues."
<!-- CODEX-ONLY:END -->
