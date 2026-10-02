import { test as base, expect, type Page, type Response, type TestInfo } from '@playwright/test';

export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: [async ({ page }, use, info) => {
    const errors: string[] = [];
    const consoleMessages: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) consoleMessages.push(message.text());
    });
    await use();
    await info.attach('browser-state', {
      body: JSON.stringify({ url: page.url(), title: await page.locator('h1').textContent().catch(() => null), errors, consoleMessages }),
      contentType: 'application/json',
    });
    expect(errors, 'No uncaught browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function captureResponse(response: Response, info: TestInfo, name: string) {
  const body = await response.text();
  await info.attach(name, {
    body: JSON.stringify({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'], body }),
    contentType: 'application/json',
  });
  return body;
}

export async function readyLick(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByRole('button', { name: 'Generate new lick', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.locator('.sheet-music-container svg')).toBeVisible();
  await expect(page.locator('.abcjs-note').first()).toBeVisible();
}

export async function playback(page: Page) {
  // unlockAudio intentionally requires another user gesture if Tone is cold.
  // Poll the real control; every retry is a user click, never an audio mock.
  await expect(async () => {
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    if (!(await pause.isVisible())) {
      await page.getByRole('button', { name: 'Play', exact: true }).click();
    }
    await expect(pause).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  // Observe the scheduled notes moving through notation and the piano.
  await expect(page.locator('.abcjs-note.playing').first()).toBeVisible();
  await expect(page.locator('[data-midi][data-playing="true"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.locator('.abcjs-note.playing')).toHaveCount(0);
}
