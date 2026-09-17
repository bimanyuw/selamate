import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { authenticate, createSession, expiredSessionCookie, getSessionUser, sessionCookie } from './auth.js';

function json(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}
async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error('PAYLOAD_TOO_LARGE');
  }
  try { return JSON.parse(body || '{}'); } catch { throw new Error('INVALID_JSON'); }
}

export function createApp() {
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const path = new URL(request.url, 'http://localhost').pathname;
    try {
      if (path === '/api/health' && request.method === 'GET') return json(response, 200, { status: 'ok', service: 'selamate-backend' });
      if (path === '/api/auth/login' && request.method === 'POST') {
        const { email, password } = await readJson(request);
        const user = await authenticate(email || '', password);
        if (!user) return json(response, 401, { error: 'Email atau password salah' });
        return json(response, 200, { user }, { 'Set-Cookie': sessionCookie(createSession(user), process.env.NODE_ENV === 'production') });
      }
      if (path === '/api/auth/logout' && request.method === 'POST') return json(response, 200, { message: 'Berhasil keluar' }, { 'Set-Cookie': expiredSessionCookie() });

      const user = await getSessionUser(request);
      if (path === '/api/auth/me' && request.method === 'GET') return user ? json(response, 200, { user }) : json(response, 401, { error: 'Belum login' });
      if (path === '/api/alerts' && request.method === 'GET') {
        if (!user) return json(response, 401, { error: 'Autentikasi diperlukan' });
        const alerts = JSON.parse(await readFile(new URL('../../data/samples/alerts.json', import.meta.url), 'utf8'));
        return json(response, 200, { source: 'simulation', alerts });
      }
      if (path === '/api/admin/summary' && request.method === 'GET') {
        if (!user) return json(response, 401, { error: 'Autentikasi diperlukan' });
        if (user.role !== 'Admin') return json(response, 403, { error: 'Akses khusus Admin' });
        return json(response, 200, { activeUsers: 2, systemStatus: 'Operasional', dataSource: 'Simulasi' });
      }
      const known = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/alerts', '/api/admin/summary'].includes(path);
      if (known) return json(response, 405, { error: 'Method not allowed' }, { Allow: path.includes('login') || path.includes('logout') ? 'POST' : 'GET' });
      return json(response, 404, { error: 'Not found' });
    } catch (error) {
      if (error.message === 'INVALID_JSON') return json(response, 400, { error: 'JSON tidak valid' });
      if (error.message === 'PAYLOAD_TOO_LARGE') return json(response, 413, { error: 'Payload terlalu besar' });
      console.error(error);
      return json(response, 500, { error: 'Terjadi kesalahan pada server' });
    }
  });
}
