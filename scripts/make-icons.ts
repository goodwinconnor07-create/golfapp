// Renders the PNG app icons, the link-preview image and the iPhone app's icon and launch
// screen from public/icons/icon.svg.
// Run with: npx tsx scripts/make-icons.ts  (or node --experimental-strip-types)
// Uses Playwright's Chromium. Set CHROMIUM_PATH to use a specific browser binary.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(`${root}public/icons/icon.svg`, 'utf8');

/** Full-bleed square (no rounded corners) with the artwork shrunk into the safe zone. */
function fullBleed(scale: number): string {
  const inner = svg
    .replace(/^[\s\S]*?<\/defs>/, '')
    .replace('</svg>', '')
    .replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '')
    // At full size the square itself is the edge (iOS rounds it), so the rounded clip would show.
    .replace(scale === 1 ? ' clip-path="url(#tile)"' : '\0', '');
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
    <rect width="512" height="512" fill="url(#bg)"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g></svg>`;
}

const page = (body: string, w: number, h: number) =>
  `<!doctype html><html><head><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${body}</body></html>`;

const ogPage = `<!doctype html><html><head><style>
  html,body{margin:0;width:1200px;height:630px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif}
  .wrap{display:flex;align-items:center;gap:56px;height:100%;padding:0 90px;box-sizing:border-box;position:relative;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.35}
  .icon{width:300px;height:300px;flex:none;position:relative}
  .icon svg{width:100%;height:100%;filter:drop-shadow(0 24px 40px rgba(11,29,63,.35))}
  h1{margin:0;font-size:132px;line-height:.95;font-weight:900;font-style:italic;letter-spacing:-4px;
     background:linear-gradient(90deg,#2B4F8F,#1E3A6E 50%,#0B1D3F);-webkit-background-clip:text;color:transparent}
  p{margin:22px 0 0;font-size:40px;font-weight:800;color:#0b0b12;line-height:1.2}
  .chips{display:flex;gap:14px;margin-top:28px}
  .chip{font-size:28px;font-weight:900;color:#fff;padding:12px 22px;border-radius:999px}
</style></head><body><div class="wrap">
  <div class="blob" style="width:420px;height:420px;background:#14B8A6;left:-120px;top:-160px"></div>
  <div class="blob" style="width:420px;height:420px;background:#F97316;right:-80px;bottom:-200px"></div>
  <div class="blob" style="width:300px;height:300px;background:#8B5CF6;right:280px;top:-180px"></div>
  <div class="icon">${svg}</div>
  <div style="position:relative"><h1>CARDSHOT</h1><p>Golf, but riskier.<br/>Pick your risk. Play the hole.</p>
    <div class="chips"><span class="chip" style="background:#0D9488">SAFE</span><span class="chip" style="background:#EA580C">BOLD</span><span class="chip" style="background:#7C3AED">INSANE</span></div>
  </div></div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const tab1x = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
// The link preview is rendered at 2x so it stays sharp on retina screens.
const tab2x = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();

async function render(html: string, w: number, h: number, out: string, transparent = true, sharp = false) {
  const tab = sharp ? tab2x : tab1x;
  await tab.setViewportSize({ width: w, height: h });
  await tab.setContent(html);
  const png = await tab.screenshot({ omitBackground: transparent, type: 'png' });
  writeFileSync(`${root}public/${out}`, png);
  console.log('wrote', out);
}

await render(page(svg, 192, 192), 192, 192, 'icons/icon-192.png');
await render(page(svg, 512, 512), 512, 512, 'icons/icon-512.png');
await render(page(fullBleed(0.78), 512, 512), 512, 512, 'icons/icon-maskable-512.png', false);
await render(page(fullBleed(0.9), 180, 180), 180, 180, 'icons/apple-touch-icon.png', false);
await render(ogPage, 1200, 630, 'og-image.png', false, true);

// The iPhone app: a 1024 icon with no transparency (iOS rounds the corners itself), and the
// launch screen, the icon on white.
const ios = '../ios/App/App/Assets.xcassets';
await render(page(fullBleed(1), 1024, 1024), 1024, 1024, `${ios}/AppIcon.appiconset/AppIcon-512@2x.png`, false);
const splash = `<!doctype html><html><head><style>html,body{margin:0;width:2732px;height:2732px;background:#fff;display:grid;place-items:center}
  .icon{width:560px;height:560px;filter:drop-shadow(0 30px 50px rgba(11,29,63,.3))}.icon svg{width:100%;height:100%}</style></head>
  <body><div class="icon">${svg}</div></body></html>`;
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await render(splash, 2732, 2732, `${ios}/Splash.imageset/${name}`, false);
}

await browser.close();
