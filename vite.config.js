import { defineConfig, loadEnv } from 'vite';
import weather from './api/weather.js';
import shopping from './api/shopping.js';

import { serveStylist } from './api/room-stylist.js';
import { vision } from './server/local-vision.mjs';
import fitting from './api/room-fitting.js';
import { localAvailable, localAdvice } from './server/local-stylist.mjs';

function attach(server) {
  server.middlewares.use((req, res, next) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (path === '/api/room-fitting') return fitting(req, res);
    if (path === '/api/room-stylist' || path === '/api/room-vision') {
      const loopback =
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
          req.socket.remoteAddress,
        ) &&
        /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
          req.headers.host || '',
        );
      if (path === '/api/room-vision') return vision(req, res, loopback);
      return serveStylist(
        req,
        res,
        loopback ? { available: localAvailable, ask: localAdvice } : null,
      );
    }
    if (path === '/api/weather') return weather(req, res);
    if (path === '/api/shopping') return shopping(req, res);
    next();
  });
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), [
    'ADPICK_',
    'ROOM_',
    'OPENAI_API_KEY',
    'FASHN_API_KEY',
  ]);
  for (const [key, value] of Object.entries(env))
    if (process.env[key] === undefined) process.env[key] = value;
  return {
    plugins: [
      {
        name: 'wardrobe-service-api',
        configureServer: attach,
        configurePreviewServer: attach,
      },
    ],
  };
});
