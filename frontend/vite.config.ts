import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const allowedHosts = (process.env.FRONTEND_ALLOWED_HOSTS || env.FRONTEND_ALLOWED_HOSTS || '').split(',').map(host => host.trim()).filter(Boolean);
  return {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { allowedHosts, proxy: { '/api': 'http://127.0.0.1:3001' } },
  };
});
