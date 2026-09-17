import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Buat .venv dan install backend serta ai sesuai README dahulu.');
  process.exit(1);
}
const commands = {
  dev: ['-m', 'uvicorn', 'selamate_backend.main:app', '--reload', '--reload-dir', 'backend/src', '--reload-dir', 'ai/src', '--host', '127.0.0.1', '--port', '3001'],
  migrate: ['-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'],
  seed: ['-m', 'selamate_backend.seed'],
  'demo-accounts': ['-m', 'selamate_backend.demo_accounts'],
  test: ['-m', 'pytest', 'backend/tests', 'ai/tests', '-q'],
};
const args = commands[process.argv[2]];
if (!args) { console.error('Perintah tidak dikenal'); process.exit(1); }
const result = spawnSync(python, args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
