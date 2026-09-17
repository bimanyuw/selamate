import { writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Gunakan: node scripts/configure-vercel.mjs https://alamat-backend');
const backend = new URL(input);
if (backend.protocol !== 'https:' || backend.username || backend.password || backend.search || backend.hash || !['', '/'].includes(backend.pathname)) {
  throw new Error('Gunakan origin HTTPS backend saja, tanpa /api atau kredensial.');
}
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'frontend/dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/:path*', destination: '/index.html' },
  ],
  headers: [{ source: '/api/:path*', headers: [
    { key: 'Cache-Control', value: 'no-store' },
    { key: 'x-vercel-enable-rewrite-caching', value: '0' },
  ] }],
};
writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log('vercel.json siap. Import root repository ke Vercel dan set VITE_API_BASE_URL=/api.');
