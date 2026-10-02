import { test, expect, captureResponse, readyLick, playback } from './browser';
import { CASES, EXPECTED } from './cases';

test.beforeEach(async ({ request }, info) => {
  const daily = info.title === CASES.fallback ? 'unavailable' : 'healthy';
  const response = await request.post(`http://127.0.0.1:4319/__qa/scenario?daily=${daily}`);
  expect(response.ok()).toBe(true);
});

test(CASES.daily, async ({ page }, info) => {
  const daily = page.waitForResponse(r => new URL(r.url()).pathname === '/api/daily');
  await page.goto('/');
  const response = await daily;
  const body = await captureResponse(response, info, 'daily-transport');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 }), 'healthy daily rendered title').toHaveText(EXPECTED.daily.title);
  expect(response.headers()['content-type'], 'healthy daily JSON transport').toContain('application/json');
  expect(JSON.parse(body).id).toBe(EXPECTED.daily.id);
  await readyLick(page, EXPECTED.daily.title);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await playback(page);
});

test(CASES.generate, async ({ page }, info) => {
  // The mount prefetch is a real POST through Vite, and the button consumes it.
  const random = page.waitForResponse(r => new URL(r.url()).pathname === '/api/random' && r.request().method() === 'POST');
  await page.goto('/');
  await readyLick(page, EXPECTED.daily.title);
  const response = await random;
  const stream = await captureResponse(response, info, 'generation-transport');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/event-stream');
  expect(stream).toContain(`event: done\ndata: {"id":"${EXPECTED.generated.id}"}`);
  await page.getByRole('button', { name: 'Generate new lick', exact: true }).click();
  await readyLick(page, EXPECTED.generated.title);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await playback(page);
});

test(CASES.fallback, async ({ page }, info) => {
  const daily = page.waitForResponse(r => new URL(r.url()).pathname === '/api/daily');
  await page.goto('/');
  const response = await daily;
  await captureResponse(response, info, 'unavailable-transport');
  expect(response.status()).toBe(503);
  await expect(page.getByRole('alert')).toContainText('showing a practice lick instead');
  await readyLick(page, EXPECTED.fallback.title);
  await playback(page);
});
