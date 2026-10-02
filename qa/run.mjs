import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { CASES } from './cases.ts';

const mode = process.argv[2] || 'fixture';
if (!['fixture', 'negative', 'live'].includes(mode)) throw new Error('Use fixture, negative, or live');
if (mode === 'live' && !process.env.QA_LIVE_BASE_URL) throw new Error('Live mode requires QA_LIVE_BASE_URL');
const directory = `qa/artifacts/${mode === 'negative' ? 'html-negative' : mode}`;
const startedAt = new Date().toISOString();
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const diffHash = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD'])).digest('hex');
await rm(directory, { recursive: true, force: true });
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const args = [cli, 'test'];
if (mode === 'negative') args.push('--grep', CASES.daily);
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    QA_LIVE_BASE_URL: mode === 'live' ? process.env.QA_LIVE_BASE_URL : '',
    QA_INJECT_HTML: mode === 'negative' ? '1' : '0',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', (code, signal) => signal ? reject(new Error(`QA interrupted by ${signal}`)) : resolve(code));
});
const report = JSON.parse(await readFile(`${directory}/report.json`, 'utf8'));
function specs(suites) {
  return suites.flatMap(suite => [...suite.specs, ...specs(suite.suites || [])]);
}
const actual = specs(report.suites);
const expected = mode === 'live' ? [CASES.live] : mode === 'negative' ? [CASES.daily] : [CASES.daily, CASES.generate, CASES.fallback];
if (report.errors.length || actual.length !== expected.length || expected.some(id => actual.filter(s => s.title === id).length !== 1)) {
  throw new Error('QA report missing, duplicate, unknown cases, or runner errors');
}
for (const spec of actual) {
  if (spec.tests.length !== 1 || spec.tests[0].results.length !== 1) throw new Error('Expected one fresh attempt per case');
  const result = spec.tests[0].results[0];
  for (const contentType of ['application/zip', 'image/png', 'video/webm']) {
    if (!result.attachments.some(a => a.contentType === contentType && a.path)) throw new Error(`Missing evidence ${contentType} for ${spec.title}`);
  }
  if (mode === 'negative') {
    if (exitCode !== 1 || result.status !== 'failed' || !result.errors.some(e => e.message.includes('healthy daily rendered title'))) {
      throw new Error('HTML control did not fail the healthy daily UI end-state assertion');
    }
    const attachment = result.attachments.find(a => a.name === 'daily-transport');
    if (!attachment) throw new Error('Negative control missing HTTP evidence');
    const data = JSON.parse(attachment.body ? Buffer.from(attachment.body, 'base64').toString() : await readFile(attachment.path, 'utf8'));
    if (data.status !== 200 || !data.contentType.includes('text/html') || !data.body.includes('QA fixture: API returned HTML')) {
      throw new Error('Negative failure was not caused by the declared HTML injection');
    }
  } else if (exitCode !== 0 || result.status !== 'passed' || spec.tests[0].status !== 'expected') {
    throw new Error(`${spec.title} did not pass`);
  }
}
await writeFile(`${directory}/gate.json`, JSON.stringify({ mode, revision, diffHash, startedAt, expected, exitCode, verdict: mode === 'negative' ? 'expected assertion failure verified' : 'pass' }, null, 2));
console.log(`QA ${mode}: ${expected.length} required case(s), complete evidence verified`);
