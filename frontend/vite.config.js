/** Configure the standalone frontend without a backend proxy. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    server: { host: env.DEV_HOST || '127.0.0.1', port: Number(env.DEV_PORT || 5173), strictPort: true },
    preview: { host: env.PREVIEW_HOST || '127.0.0.1', port: Number(env.PREVIEW_PORT || 4173), strictPort: true },
  };
});
