import { defineConfig, loadEnv } from 'vite';
import weather from './api/weather.js';
import shopping from './api/shopping.js';

function attach(server) {
  server.middlewares.use((req, res, next) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (path === '/api/weather') return weather(req, res);
    if (path === '/api/shopping') return shopping(req, res);
    next();
  });
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ADPICK_');
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
