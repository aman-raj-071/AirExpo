import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { getRoutes, geocodeRoute } from './routeService.ts';
import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import {defineConfig} from 'vite';

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

// Also register route endpoints directly in Vite dev mode. This keeps the
// planner's API available when the app is started with `vite` instead of the
// Express wrapper in server.ts.
function routeApiPlugin() {
  return {
    name: 'airguard-route-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/api/routes' && req.method === 'POST') {
          try { return sendJson(res, 200, await getRoutes(await readJson(req))); }
          catch (error: any) { return sendJson(res, 502, { success: false, error: error?.message || 'Routing is temporarily unavailable.' }); }
        }
        if (url.pathname === '/api/route-geocode' && req.method === 'GET') {
          try { return sendJson(res, 200, await geocodeRoute(url.searchParams.get('q') || '')); }
          catch (error: any) { return sendJson(res, 502, { success: false, error: error?.message || 'Place search is unavailable.' }); }
        }        if (url.pathname === '/api/route-air-quality' && req.method === 'GET') {
          const lat = Number(url.searchParams.get('lat')); const lon = Number(url.searchParams.get('lon'));
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return sendJson(res, 400, { success: false, error: 'Valid latitude and longitude are required.' });
          try {
            const upstream = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&timezone=GMT&timeformat=unixtime`);
            if (!upstream.ok) return sendJson(res, 502, { success: false, error: 'Air-quality provider is temporarily unavailable.' });
            const data: any = await upstream.json().catch(() => null);
            if (!data) return sendJson(res, 502, { success: false, error: 'Air-quality provider returned an invalid response.' });
            return sendJson(res, 200, { success: true, source: 'Open-Meteo modeled grid', current: data.current || null });
          } catch { return sendJson(res, 502, { success: false, error: 'Air-quality provider is temporarily unavailable.' }); }
        }
        return next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [routeApiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore local Python environments, model artifacts, generated bundles,
      // and package stores so their churn cannot trigger dashboard reloads.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.venv/**', '**/ml/sagemaker/**', '**/.pnpm-store/**', '**/dist/**'],
      },
    },
  };
});
