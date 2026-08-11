# QA plan — t_1f020295

## Objective
Verify PR #16's self-hosted Salamander sampled piano executes through the real browser UI: fallback synth before sampler readiness, successful sample loads, melody/piano/practice interactions, and no browser console errors.

## Steps
1. Inspect PR #16 and runtime call paths; align this QA worktree to the PR commit without modifying product code.
2. Install dependencies and run the required automated checks (test, lint, build), recording exact results.
3. Start the real Vite application; drive daily-lick loading, playback, piano-key click, and practice-mode transition in a headless browser.
4. Instrument the browser observation layer only to capture sampler network requests, console errors, and intended playback path (fallback then sampler); take a shot-scraper interaction video and a rendered screenshot.
5. Re-read this plan, assess every acceptance criterion and residual coverage gaps, then complete the Kanban card with rubric evidence and artifacts.

## Acceptance criteria
- PR #16 implementation, not base branch, is the booted application.
- The visible app loads a daily lick and supports playback, piano click, and practice mode.
- The browser records successful `/samples/salamander/*.mp3` fetches without console errors.
- Evidence shows the fallback path is used before samples load and Tone.Sampler path is used after samples load (not merely audio output).
- Required automated test/build/lint outputs are recorded.
- A real UI video capture is attached to this card, with an explicit residual-risk assessment.
