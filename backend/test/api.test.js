import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(run) {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
async function login(base, email, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('health is public while alerts require authentication', () => withServer(async base => {
  assert.equal((await (await fetch(`${base}/api/health`)).json()).status, 'ok');
  assert.equal((await fetch(`${base}/api/alerts`)).status, 401);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
}));
test('login validates credentials and creates an HttpOnly session', () => withServer(async base => {
  assert.equal((await login(base, 'user@selamate.id', 'wrong')).response.status, 401);
  const { response, cookie } = await login(base, 'user@selamate.id', 'User123!');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  const me = await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json();
  assert.equal(me.user.role, 'User');
}));
test('User can read alerts but cannot access Admin summary', () => withServer(async base => {
  const { cookie } = await login(base, 'user@selamate.id', 'User123!');
  const alerts = await (await fetch(`${base}/api/alerts`, { headers: { cookie } })).json();
  assert.equal(alerts.source, 'simulation'); assert.ok(alerts.alerts.length > 0);
  assert.equal((await fetch(`${base}/api/admin/summary`, { headers: { cookie } })).status, 403);
}));
test('Admin can access Admin summary and logout clears cookie', () => withServer(async base => {
  const { cookie } = await login(base, 'admin@selamate.id', 'Admin123!');
  const summary = await fetch(`${base}/api/admin/summary`, { headers: { cookie } });
  assert.equal(summary.status, 200); assert.equal((await summary.json()).systemStatus, 'Operasional');
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
}));
test('known routes reject unsupported methods', () => withServer(async base => {
  assert.equal((await fetch(`${base}/api/alerts`, { method: 'POST' })).status, 405);
}));
