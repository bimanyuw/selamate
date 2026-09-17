import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('API exposes health and explicitly labeled simulation data', async () => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).status, 'ok');
    const data = await (await fetch(`${base}/api/alerts`)).json();
    assert.equal(data.source, 'simulation');
    assert.ok(data.alerts.length > 0);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/api/alerts`, { method: 'POST' })).status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
