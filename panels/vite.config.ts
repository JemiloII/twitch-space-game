import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const certFile = env.TLS_CERT_FILE;
  const keyFile = env.TLS_KEY_FILE;
  if (Boolean(certFile) !== Boolean(keyFile)) {
    throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE to use HTTPS.');
  }
  return {
  plugins: [react()],
  server: {
    host: env.HOST || '127.0.0.1',
    port: 2053,
    cors: true,
    open: '/game',
    https: certFile ? {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile)
    } : undefined
  }
  };
});
