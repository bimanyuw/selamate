import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const children = new Set();
const exec = promisify(execFile);
const phoneMode = process.argv.includes('--hp');
const tailscalePath = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Tailscale/tailscale.exe');
const tailscale = process.platform === 'win32' && existsSync(tailscalePath) ? tailscalePath : 'tailscale';
let phoneUrl;
let closing = false;
let server;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(command, args, { quiet = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: quiet ? 'ignore' : 'inherit' });
    children.add(child);
    child.once('error', error => { children.delete(child); reject(error); });
    child.once('exit', code => { children.delete(child); code === 0 ? resolve() : reject(new Error(`${command} gagal (kode ${code}).`)); });
  });
}

async function waitUntil(check, seconds, label) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (closing) throw new Error('Dihentikan');
    try { if (await check()) return; } catch { /* Retry while the service starts. */ }
    await delay(1000);
  }
  throw new Error(`${label} belum siap setelah ${seconds} detik.`);
}

async function ensureFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} sedang dipakai. Hentikan backend/frontend lama atau launcher lain, lalu coba lagi.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function stop(code = 0) {
  if (closing) return;
  closing = true;
  if (server) await server.close();
  await Promise.all([...children].map(async child => {
    if (process.platform === 'win32' && child.pid) {
      try { await exec('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); } catch { /* Process may already have exited. */ }
    } else child.kill();
  }));
  console.log('\nSelamate dihentikan. Database Docker tetap berjalan untuk penggunaan berikutnya.');
  process.exitCode = code;
}

async function main() {
  if (!existsSync(python)) throw new Error('Jalankan instalasi Python/.venv sesuai README dahulu.');
  if (!existsSync(path.join(root, 'node_modules/vite'))) throw new Error('Jalankan npm.cmd install dahulu.');
  if (!existsSync(path.join(root, '.env'))) throw new Error('Salin .env.example ke .env dahulu.');
  await ensureFree(3001);
  await ensureFree(5173);

  if (phoneMode) {
    try {
      const { stdout } = await exec(tailscale, ['status', '--json'], { windowsHide: true, timeout: 10000 });
      const status = JSON.parse(stdout);
      if (status.BackendState !== 'Running' || !status.Self?.DNSName) throw new Error('Tailscale belum login');
      phoneUrl = `https://${status.Self.DNSName.replace(/\.$/, '')}`;
    } catch {
      throw new Error('Mode HP membutuhkan Tailscale. Install dan login di laptop serta HP dengan akun yang sama, lalu jalankan ulang. Lihat README.');
    }
  }

  console.log('Menyiapkan Docker dan database...');
  const dockerReady = async () => { await run('docker', ['info'], { quiet: true }); return true; };
  try { await dockerReady(); }
  catch {
    if (process.platform !== 'win32') throw new Error('Buka Docker terlebih dahulu, lalu jalankan ulang.');
    const desktop = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Docker/Docker/Docker Desktop.exe');
    if (!existsSync(desktop)) throw new Error('Docker Desktop belum terpasang.');
    await run('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${desktop.replaceAll("'", "''")}' -WindowStyle Hidden`]);
    await waitUntil(dockerReady, 120, 'Docker Desktop');
  }
  await run('docker', ['compose', 'up', '-d', 'db']);
  await waitUntil(async () => {
    await run('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { quiet: true });
    return true;
  }, 60, 'PostgreSQL');

  const env = { ...process.env, AUTH_COOKIE_SECURE: 'false', AUTH_COOKIE_SAMESITE: 'lax' };
  if (phoneUrl) env.CORS_ORIGINS = JSON.stringify(['http://localhost:5173', 'http://127.0.0.1:5173', phoneUrl]);
  console.log('Memperbarui tabel akun dan data contoh...');
  await run(python, ['-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'], { env });
  await run(python, ['-m', 'selamate_backend.seed'], { env });
  if (!existsSync(process.env.EYE_MODEL_PATH || path.join(root, 'models/eye_detector.pt'))) {
    console.log('Model mata belum tersedia. Untuk deteksi kantuk, sediakan models/eye_detector.pt dan install ai[vision].');
  }

  console.log('Menjalankan backend dan website...');
  const backend = spawn(python, ['-m', 'uvicorn', 'selamate_backend.main:app', '--host', '127.0.0.1', '--port', '3001', '--workers', '1'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  children.add(backend);
  backend.once('error', error => { console.error(error.message); void stop(1); });
  backend.once('exit', code => { children.delete(backend); if (!closing) { console.error(`Backend berhenti (kode ${code}).`); void stop(1); } });
  await waitUntil(async () => (await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(2000) })).ok, 45, 'Backend');
  process.env.VITE_API_BASE_URL = '/api';
  process.env.BACKEND_PROXY_TARGET = 'http://127.0.0.1:3001';
  if (phoneUrl) process.env.FRONTEND_ALLOWED_HOSTS = new URL(phoneUrl).hostname;
  const { createServer } = await import('vite');
  server = await createServer({ configFile: path.join(root, 'frontend/vite.config.ts'), root: path.join(root, 'frontend'), server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  if (closing) { await server.close(); return; }
  await server.listen();
  if (phoneUrl) {
    await run(tailscale, ['serve', '--bg', '--https=443', 'http://127.0.0.1:5173']);
    console.log(`\nAlamat tetap HP/laptop: ${phoneUrl}`);
    console.log('Aktifkan Tailscale di HP. Jika Serve meminta HTTPS diaktifkan, buka link pengaturan yang ditampilkan lalu jalankan ulang.');
  }
  console.log('\nBuka http://localhost:5173 — alamat tetap, tanpa Cloudflare/Jupyter.');
  console.log('Biarkan jendela ini terbuka. Tekan Ctrl+C untuk berhenti.');
  if (process.platform === 'win32' && !process.env.SELAMATE_NO_BROWSER) {
    await run('powershell.exe', ['-NoProfile', '-Command', "Start-Process 'http://localhost:5173'"], { quiet: true });
  }
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
main().catch(async error => { if (!closing) { console.error(`\n${error.message}`); await stop(1); } });
