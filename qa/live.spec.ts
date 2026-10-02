import { test, expect, captureResponse, readyLick, playback } from './browser';
import { CASES } from './cases';

test(CASES.live, async ({ page }, info) => {
  // No route interception, API fixtures, or local web servers in live mode.
  const daily = page.waitForResponse(r => new URL(r.url()).pathname === '/api/daily');
  const random = page.waitForResponse(r => new URL(r.url()).pathname === '/api/random' && r.request().method() === 'POST');
  await page.goto('/');
  const response = await daily;
  const body = await captureResponse(response, info, 'live-daily-transport');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const lick = JSON.parse(body);
  expect(lick.id).toEqual(expect.any(String));
  expect(lick.id.length).toBeGreaterThan(0);
  expect(lick.title).toEqual(expect.any(String));
  expect(lick.notes.length).toBeGreaterThan(0);
  await info.attach('live-daily', { body: JSON.stringify({ id: lick.id, title: lick.title, notes: lick.notes }), contentType: 'application/json' });
  await readyLick(page, lick.title);
  const generatedResponse = await random;
  const stream = await captureResponse(generatedResponse, info, 'live-generation-transport');
  expect(generatedResponse.status()).toBe(200);
  expect(generatedResponse.headers()['content-type']).toContain('text/event-stream');
  const frames = stream.split(/\r?\n\r?\n/);
  const text = frames.filter(f => !f.startsWith('event:')).flatMap(f => f.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => JSON.parse(l.slice(5)).text || '')).join('');
  const done = frames.find(f => f.startsWith('event: done'));
  expect(done, 'Generation must finish with a canonical id').toBeTruthy();
  expect(frames.some(f => f.startsWith('event: error'))).toBe(false);
  const id = JSON.parse(done!.split(/\r?\n/).find(l => l.startsWith('data:'))!.slice(5)).id;
  // Same documented allowance as the service: model JSON may be fenced.
  const generated = JSON.parse(text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
  expect(id).toEqual(expect.any(String));
  expect(id).not.toBe(lick.id);
  expect(generated.title.length).toBeGreaterThan(0);
  expect(generated.notes.length).toBeGreaterThan(0);
  await info.attach('live-generated', { body: JSON.stringify({ id, title: generated.title, notes: generated.notes }), contentType: 'application/json' });
  await page.getByRole('button', { name: 'Generate new lick', exact: true }).click();
  await readyLick(page, generated.title);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await playback(page);
});
