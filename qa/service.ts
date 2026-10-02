import { createServer } from 'node:http';
import { SOUL_LICKS } from '../src/utils/soul-licks';
import { SSE_HEADERS, sseData, sseDone } from '../functions/_shared/sse';

// Only this loopback fixture accepts fault injection. No production flags.
const injectHTML = process.env.QA_INJECT_HTML === '1';
let unavailable = false;
const server = createServer((req, res) => {
  const path = new URL(req.url || '/', 'http://127.0.0.1:4319').pathname;
  if (path === '/__qa/health') {
    res.end('ready');
  } else if (path === '/__qa/scenario' && req.method === 'POST') {
    unavailable = new URL(req.url || '/', 'http://127.0.0.1:4319').searchParams.get('daily') === 'unavailable';
    res.end('ready');
  } else if (path === '/api/daily' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    if (injectHTML || unavailable) {
      res.writeHead(unavailable ? 503 : 200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><body>QA fixture: API returned HTML</body></html>');
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(SOUL_LICKS[1].lick));
    }
  } else if (path === '/api/random' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const input = JSON.parse(body);
        if (!['jazz', 'blues', 'funk', 'rnb', 'bossa'].includes(input.genre) || input.bars !== 4) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected a supported genre and four bars' }));
          return;
        }
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
        return;
      }
      const { id, ...lick } = SOUL_LICKS[2].lick;
      const text = JSON.stringify(lick);
      res.writeHead(200, SSE_HEADERS);
      res.write(sseData(text.slice(0, text.indexOf('"notes"'))));
      res.end(sseData(text.slice(text.indexOf('"notes"'))) + sseDone(id));
    });
  } else {
    res.writeHead(404);
    res.end('Unknown QA fixture route');
  }
});
server.listen(4319, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { server.closeAllConnections(); server.close(); });
}
