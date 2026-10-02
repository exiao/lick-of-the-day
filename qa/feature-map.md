# Focused browser QA

Run from the project root after `npm ci` and `npx playwright install chromium`:

```sh
node --import tsx qa/run.mjs fixture
node --import tsx qa/run.mjs negative
QA_LIVE_BASE_URL=https://dailylick.com node --import tsx qa/run.mjs live
```

Live mode is opt-in and can spend API quota. It launches no fixture and installs no browser mocks. It opens the actual target, records daily id/title/notes and generated id/title/notes, consumes the real mount prefetch through Generate new lick, and verifies notation and playback. A missing target, service failure, malformed stream, missing end state, or missing evidence fails the run. Live was not run automatically.

Fixture mode starts a loopback HTTP service on 4319 and builds and starts real Vite preview on 4183 through Playwright webServer. The proxy must read `LICK_API_ORIGIN` for both server and preview. Browser requests go to preview `/api`, then to the fixture; there is no `page.route` interception. The service uses authored soul licks and production SSE framing. It never calls paid APIs. Existing occupied ports fail startup. Playwright owns readiness and teardown, with no fixed sleeps. One worker serializes fixture scenarios; each test has a fresh browser context.

| Case ID from cases.ts | User entry and prerequisites | Observable proof | Credible failure detected |
| --- | --- | --- | --- |
| daily-load | Open `/`, healthy daily fixture | JSON 200 and authored daily ID, matching title, rendered staff, playback note and piano highlight, Stop clears highlight, no alert or uncaught errors | Missing proxy silently returns index.html; stale fallback appears successful; audio never starts |
| generate-new-lick | Open `/`, wait for mount prefetch, click Generate new lick | Real POST/SSE, canonical generated ID, changed title and notation, usable playback, no alert | HTML random response, missing done event, button never consumes generated lick, stuck loading |
| unavailable-daily-playback | Open `/`, daily fixture returns 503 HTML | Captured 503, visible fallback message, Late Night Vamp staff, advancing playback/piano, Stop works | Alert-only recovery, unusable fallback notes or audio |
| live-daily-and-generation | Explicit target URL with real working service | Daily and generated id/title/notes receipts, UI titles/staff/playback, no browser mocks | Deployed transport or generation fails despite green fixture suite |

Independent expected daily and generated IDs/titles are in cases.ts. The daily fixture deliberately differs from the initial practice fallback. The playback helper permits the documented second Play gesture when the Tone module is cold. Tests observe abcjs notes and piano highlights as playback progresses; this proves browser scheduling and visible note delivery, not audio fidelity or musical quality.

The negative command injects a 200 HTML daily response using `QA_INJECT_HTML=1` in the fixture only and runs the unmodified healthy daily case. Playwright must exit 1 at `healthy daily rendered title`: the fallback title cannot count as a successful daily load. The wrapper also requires the injected HTML response receipt and failed trace, screenshot and video before marking detection verified. An unrelated failure or accidental pass fails the wrapper. The raw Playwright report remains failed; gate.json labels it as an expected assertion failure, never healthy service evidence.

Each mode clears only its own artifact directory before execution. Reports, HTTP receipts, browser errors/warnings, traces, screenshots and videos are saved under `qa/artifacts/{fixture,html-negative,live}/`. run.mjs rejects missing, duplicate, unknown, skipped, failed or incomplete required cases. Direct `npx playwright test` is useful for diagnosis; the wrapper enforces the complete inventory and evidence. CI runs lint, unit tests, browser installation, fixture QA including its build, and the negative control; it always uploads available evidence.

## Coverage gaps

| Feature and entry | Current coverage / gap |
| --- | --- |
| Today button and studio pathway selection | Mapped in App/Pathway; switching and return-to-daily not exercised |
| Listen/practice mode and keyboard input | ModeToggle/Piano; correctness, misses, hints and completion not exercised |
| Step sequencer editing and revert | Sequencer; mutation and notation/playback alignment not exercised |
| Groove, tempo, swing, loop, comp and click controls | TransportControls/GrooveControls; only Play and Stop exercised |
| Responsive layout, touch, Safari and accessibility | Desktop Chromium only; no layout or accessibility audit |
| Cold generation streaming, rollback and rate limits | Generation case covers the actual mount-prefetch/button path; progressive rendering, partial-stream failure and 429 not exercised |
| Daily KV, UTC rollover, coordinator and cron | Fixture substitutes the HTTP service; no persistence, paid model, cache freshness or cron verification |
| Sample quality and leaks across long sessions | UI scheduler advancement observed; no acoustic quality, pitch accuracy or leak claims |

No production hooks, framework adapters or per-function tests were added. Existing Vitest cases own parser, music and server contracts. These browser cases own preview transport and user end states.
