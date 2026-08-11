# QA plan — t_1f020295

## Objective
Verify the sampled-piano PR branch end-to-end in the real Vite app: fallback sound before the sampler is ready, loaded sampler path, lick playback, piano-key interaction, and practice-mode flow.

## Steps
1. Inspect the implementation, test setup, and existing repository rules; identify observable intended-path evidence.
2. Install dependencies and run the named automated checks (test, lint, build); record exact results.
3. Boot the Vite app, drive the genuine browser flow, inspect console/network evidence for sampler sample loads and errors, and validate fallback behavior before readiness.
4. Record a shot-scraper video of the playback interaction and attach it to the card and PR.
5. Re-read this plan and report every step as completed or an explicit deliberate cut, with the QA rubric.

## Acceptance criteria
- Real app boots and renders the daily-lick UI.
- A trace/log/network observation proves fallback then sampler code paths, with sample fetches successful and no relevant console errors.
- Play, piano-key click, and practice mode are exercised in the browser.
- Tests/build/lint results are cited.
- A genuine UI interaction video is attached to the card and PR.
