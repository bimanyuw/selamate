import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

export function createApp() {
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' });
      response.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    try {
      if (path === '/api/health') {
        response.end(JSON.stringify({ status: 'ok', service: 'selamate-backend' }));
      } else if (path === '/api/alerts') {
        const alerts = JSON.parse(await readFile(new URL('../../data/samples/alerts.json', import.meta.url), 'utf8'));
        response.end(JSON.stringify({ source: 'simulation', alerts }));
      } else {
        response.writeHead(404);
        response.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error(error);
      response.writeHead(500);
      response.end(JSON.stringify({ error: 'Gagal membaca data' }));
    }
  });
}
