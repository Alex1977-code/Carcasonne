/**
 * Gemeinsames für Prüfläufe im Browser: Playwright finden, das Spiel
 * ausliefern.
 *
 * Die älteren Werkzeuge tragen beides noch selbst in sich. Neue nehmen es
 * von hier.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

export async function ladeChromium() {
  for (const p of ['playwright-core', 'playwright']) {
    try { return (await import(p)).chromium; } catch { /* weiter */ }
  }
  const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
  for (const p of [`${g}/playwright-core/index.js`, `${g}/playwright/index.js`,
                   `${g}/playwright/node_modules/playwright-core/index.js`]) {
    try {
      const m = await import(pathToFileURL(p).href);
      if (m.chromium) return m.chromium;
      if (m.default?.chromium) return m.default.chromium;
    } catch { /* weiter */ }
  }
  throw new Error('playwright nicht gefunden – npm i -g playwright');
}

/** Chromium starten – ohne festen Pfad; CHROMIUM bleibt als Ausweg. */
export async function starteBrowser() {
  const chromium = await ladeChromium();
  return chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
}

const TYPEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Einen Ordner ausliefern. Ohne Zwischenspeicher, damit ein Prüflauf nie
 * eine ältere Fassung sieht als die auf der Platte.
 *
 * @param {string} wurzel Ordner, Vorgabe ist das Projekt.
 * @returns {Promise<{port:number, url:string, close:()=>void}>}
 */
export async function starteServer(wurzel = ROOT) {
  const server = createServer((req, res) => {
    let pfad = decodeURIComponent(req.url.split('?')[0]);
    if (pfad.endsWith('/')) pfad += 'index.html';
    let inhalt;
    try { inhalt = readFileSync(join(wurzel, pfad)); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(inhalt);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  return { port, url: `http://127.0.0.1:${port}/index.html`, close: () => server.close() };
}
