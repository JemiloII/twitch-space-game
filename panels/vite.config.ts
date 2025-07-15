import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 2053,
    cors: true,
    open: '/game',
    allowedHosts: true,
    https: {
      cert: fs.readFileSync('C:\\Certbot\\live\\game.shibiko.ai\\fullchain.pem'),
      key: fs.readFileSync('C:\\Certbot\\live\\game.shibiko.ai\\privkey.pem')
    }
  }
});
