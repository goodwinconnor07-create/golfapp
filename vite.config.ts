import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

/**
 * Link previews (iMessage, WhatsApp) need an absolute image URL. Set PUBLIC_URL
 * when building for a real domain, e.g. PUBLIC_URL=https://sendit.example.com npm run build
 */
function publicUrl(): Plugin {
  const url = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
  return {
    name: 'send-it-public-url',
    transformIndexHtml: (html) => html.replaceAll('%PUBLIC_URL%', url),
  };
}

// The Cloudflare plugin runs the Worker (and its Durable Object) inside the
// Vite dev server, so `npm run dev` gives you the app and the online API together.
export default defineConfig({
  plugins: [react(), cloudflare(), publicUrl()],
  server: { host: true },
});
