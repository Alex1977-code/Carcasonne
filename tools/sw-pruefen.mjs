/**
 * Den Service Worker mit zwei Fassungen des Spiels prüfen – im echten
 * Browser, mit einem Server, der mitten im Wechsel hängen, scheitern oder
 * ganz ausfallen kann.
 *
 *   node tools/sw-pruefen.mjs               # der Stand auf der Platte
 *   node tools/sw-pruefen.mjs --alt=<ref>   # ein früherer Stand, zur Gegenprobe
 *   node tools/sw-pruefen.mjs --alt=<ref> --ohne-http-cache
 *
 * Gebaut werden zwei Kopien. Die zweite unterscheidet sich so, wie sich
 * eine echte neue Fassung unterscheidet: ein Modul bekommt einen neuen
 * Namen, ein anderes importiert ihn. Trifft die neue main.js auf die alte
 * rng.js, gibt es den Namen nicht, und die App startet nicht.
 *
 * Genau das war der Fehler. Der frühere Worker holte jede Datei einzeln
 * aus dem Netz und nahm nach drei Sekunden die aus dem Speicher. Eine
 * einzige hängende Anfrage nach einer neuen Fassung mischte beide; und
 * weil die neuen Dateien einzeln in den Speicher geschrieben wurden, blieb
 * die Mischung auch ohne Netz bestehen.
 *
 * Der Server antwortet wie GitHub Pages mit `max-age=600`. Das allein
 * genügte dem früheren Worker schon: sein „Netz zuerst" ging durch den
 * HTTP-Zwischenspeicher des Browsers, und eine neue Fassung kam in den
 * ersten zehn Minuten gar nicht an. `--ohne-http-cache` nimmt das heraus,
 * damit bei der Gegenprobe das Mischen selbst zu sehen ist.
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { ROOT, starteBrowser } from './_browser.mjs';

const alt = (process.argv.find((a) => a.startsWith('--alt=')) || '').split('=')[1] || null;
const OHNE_HTTP_CACHE = process.argv.includes('--ohne-http-cache');

// ------------------------------------------------------------ zwei Fassungen
const arbeit = mkdtempSync(join(tmpdir(), 'carc-sw-'));
function baue(name) {
  const ziel = join(arbeit, name);
  mkdirSync(ziel);
  if (alt) {
    execSync(`git -C "${ROOT}" archive ${alt} | tar -x -C "${ziel}"`);
  } else {
    cpSync(ROOT, ziel, {
      recursive: true,
      filter: (q) => {
        const rel = q.slice(ROOT.length + 1);
        if (rel === '.git' || rel.startsWith('.git/') || rel.startsWith('node_modules')) return false;
        if (rel.startsWith('tests') || rel.startsWith('docs')) return false;
        // Die Lieferungen im Original sind groß und werden nicht ausgeliefert
        if (/^grafik\/[^/]+\.png$/.test(rel) || /^[^/]+\.png$/.test(rel)) return false;
        return true;
      },
    });
  }
  return ziel;
}
const anhaengen = (datei, text) => writeFileSync(datei, readFileSync(datei, 'utf8') + text);
const voranstellen = (datei, text) => writeFileSync(datei, text + readFileSync(datei, 'utf8'));

const v1 = baue('v1');
const v2 = baue('v2');
anhaengen(join(v1, 'js/ui/main.js'), "\nwindow.__stand = 'v1';\n");
anhaengen(join(v2, 'js/ui/render/rng.js'), "\nexport const NEU_IN_V2 = 'v2';\n");
voranstellen(join(v2, 'js/ui/main.js'), "import { NEU_IN_V2 } from './render/rng.js';\n");
anhaengen(join(v2, 'js/ui/main.js'), '\nwindow.__stand = NEU_IN_V2;\n');

/** sw.js der Kopie auf ihren Inhalt bringen; liefert die Nummer. */
function stelleStand(ordner, mindestens = 0) {
  const sw = join(ordner, 'sw.js');
  if (existsSync(join(ordner, 'tools/sw-stand.mjs'))) {
    execSync(`node "${join(ordner, 'tools/sw-stand.mjs')}"`, { stdio: 'pipe' });
    let q = readFileSync(sw, 'utf8');
    const m = /const STAND = \{ nr: (\d+),/.exec(q);
    let nr = Number(m[1]);
    if (nr <= mindestens) {
      nr = mindestens + 1;
      q = q.replace(m[0], `const STAND = { nr: ${nr},`);
      writeFileSync(sw, q);
    }
    return nr;
  }
  // Früherer Aufbau: eine Nummer im Namen des Speichers
  let q = readFileSync(sw, 'utf8');
  const m = /const CACHE = 'carcassonne-v(\d+)';/.exec(q);
  const nr = Math.max(Number(m[1]), mindestens) + 1;
  writeFileSync(sw, q.replace(m[0], `const CACHE = 'carcassonne-v${nr}';`));
  return nr;
}
const nr1 = stelleStand(v1);
const nr2 = stelleStand(v2, nr1);

// ------------------------------------------------------------------- Server
const TYPEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const lage = { wurzel: v1, offline: false, regeln: new Map() };
const server = createServer(async (req, res) => {
  if (lage.offline) { req.socket.destroy(); return; }
  let pfad = decodeURIComponent(req.url.split('?')[0]);
  if (pfad.endsWith('/')) pfad += 'index.html';
  const regel = lage.regeln.get(pfad) || {};
  if (regel.verzoegern) await new Promise((r) => setTimeout(r, regel.verzoegern));
  if (lage.offline) { req.socket.destroy(); return; }
  if (regel.status) { res.writeHead(regel.status); res.end(); return; }
  let inhalt;
  try { inhalt = readFileSync(join(lage.wurzel, pfad)); } catch { res.writeHead(404); res.end(); return; }
  // Wie GitHub Pages: der Browser darf zehn Minuten lang wiederverwenden.
  res.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream', 'Cache-Control': OHNE_HTTP_CACHE ? 'no-store' : 'max-age=600' });
  res.end(inhalt);
});
await new Promise((r) => server.listen(0, r));
const BASIS = `http://127.0.0.1:${server.address().port}/`;
const zurueck = () => { lage.wurzel = v1; lage.offline = false; lage.regeln.clear(); };

// ------------------------------------------------------------------ Prüfung
const browser = await starteBrowser();
let gut = 0, schlecht = 0;
const ok = (b, was) => { if (b) { gut++; console.log('  ✓', was); } else { schlecht++; console.log('  ✗', was); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function neu() {
  zurueck();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();
  page._fehler = [];
  page.on('pageerror', (e) => page._fehler.push(String(e.message || e)));
  await page.goto(BASIS);
  // Warten, bis der Worker die Seite hat und sein Speicher steht
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
  await pause(800);
  return { ctx, page };
}
/** Was läuft gerade? 'v1', 'v2' oder 'kaputt'. */
async function stand(page) {
  try {
    return await page.evaluate(() => (window.__carc ? window.__stand : 'kaputt'));
  } catch { return 'lädt'; }
}
async function warteAuf(page, soll, ms) {
  const ende = Date.now() + ms;
  let s;
  while (Date.now() < ende) {
    s = await stand(page);
    if (s === soll) return { ok: true, nach: ms - (ende - Date.now()), s };
    await pause(250);
  }
  return { ok: false, s };
}
const laden = (page) => page.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});

console.log(`Service Worker ${alt ? 'von ' + alt : 'von der Platte'} – v${nr1} gegen v${nr2}${OHNE_HTTP_CACHE ? ', ohne HTTP-Zwischenspeicher' : ''}\n`);

console.log('1. Eine neue Fassung kommt an');
{
  const { ctx, page } = await neu();
  ok(await stand(page) === 'v1', 'Ausgangslage: v1 läuft');
  lage.wurzel = v2;
  await laden(page);
  const r = await warteAuf(page, 'v2', 25000);
  ok(r.ok, r.ok ? `v2 läuft ${(r.nach / 1000).toFixed(1)} s nach dem Öffnen` : `v2 kommt nicht an (läuft: ${r.s})`);
  const fuss = await page.evaluate(() => document.getElementById('stand')?.textContent || '');
  await pause(600);
  const fuss2 = await page.evaluate(() => document.getElementById('stand')?.textContent || '');
  ok(fuss2.includes(String(nr2)), `die Fußzeile nennt den Stand, der läuft („${fuss2 || fuss}", erwartet v${nr2})`);
  await ctx.close();
}

console.log('2. Eine Anfrage hängt, während die neue Fassung kommt');
{
  const { ctx, page } = await neu();
  lage.wurzel = v2;
  lage.regeln.set('/js/ui/render/rng.js', { verzoegern: 6000 });
  await laden(page);
  await pause(4500);
  const mitten = await stand(page);
  ok(mitten === 'v1' || mitten === 'v2', `die App läuft, solange die Anfrage hängt (${mitten}${page._fehler.length ? ': ' + page._fehler[0].slice(0, 80) : ''})`);
  const r = await warteAuf(page, 'v2', 30000);
  ok(r.ok, r.ok ? 'danach kommt v2 vollständig an' : `v2 kommt nicht an (läuft: ${r.s})`);
  await ctx.close();
}

console.log('3. Eine Datei scheitert, danach kein Netz mehr');
{
  const { ctx, page } = await neu();
  lage.wurzel = v2;
  lage.regeln.set('/js/ui/render/rng.js', { status: 500 });
  await laden(page);
  await pause(2500);
  const online = await stand(page);
  ok(online === 'v1' || online === 'v2', `mit der gescheiterten Datei läuft die App (${online})`);
  lage.offline = true;
  await laden(page);
  await pause(1500);
  const ohne = await stand(page);
  ok(ohne === 'v1' || ohne === 'v2', `ohne Netz startet sie (${ohne}${page._fehler.length ? ': ' + page._fehler[page._fehler.length - 1].slice(0, 80) : ''})`);
  zurueck(); lage.wurzel = v2;
  await laden(page);
  const r = await warteAuf(page, 'v2', 25000);
  ok(r.ok, r.ok ? 'ist das Netz wieder da, kommt v2' : `v2 kommt nicht an (läuft: ${r.s})`);
  await ctx.close();
}

console.log('4. Andere Speicher unter derselben Adresse');
{
  const { ctx, page } = await neu();
  await page.evaluate(async () => { const c = await caches.open('ubongo-v3'); await c.put('/ubongo/x', new Response('1')); });
  lage.wurzel = v2;
  await laden(page);
  await warteAuf(page, 'v2', 25000);
  // Warten, bis der neue Stand wirklich übernommen und aufgeräumt hat –
  // erst dann ist zu sehen, was er dabei gelöscht hat.
  for (let i = 0; i < 80; i++) {
    const n = await page.evaluate(() => caches.keys()).catch(() => []);
    if (n.some((x) => x.includes(`v${nr2}`)) && !n.some((x) => x.includes(`v${nr1}`))) break;
    await pause(250);
  }
  await pause(500);
  const namen = await page.evaluate(() => caches.keys());
  ok(namen.includes('ubongo-v3'), `der fremde Speicher ist noch da (${namen.join(', ')})`);
  ok(namen.filter((n) => n.startsWith('carcassonne-')).length === 1, 'vom Spiel genau einer');
  await ctx.close();
}

console.log('5. Eine andere Seite im selben Ordner');
{
  const { ctx, page } = await neu();
  await page.goto(BASIS + 'debug/gallery.html').catch(() => {});
  await pause(1200);
  lage.offline = true;
  // Beide Adressen: der Ordner und index.html. Die installierte App
  // startet mit index.html (start_url im Manifest).
  for (const [adresse, name] of [[BASIS, 'der Ordner'], [BASIS + 'index.html', 'index.html']]) {
    await page.goto(adresse).catch(() => {});
    await pause(1500);
    const menue = await page.evaluate(() => !!document.getElementById('screen-menu')).catch(() => false);
    ok(menue && await stand(page) === 'v1', `ohne Netz startet danach das Spiel und nicht die Galerie (${name})`);
  }
  await ctx.close();
}

console.log('6. Mitten in einer Partie wird nicht neu geladen');
{
  const { ctx, page } = await neu();
  await page.click('#btnNew'); await pause(150);
  await page.click('#btnStart'); await pause(700);
  await page.evaluate(() => { window.__marke = 1; });
  lage.wurzel = v2;
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await pause(9000);
  const lebt = await page.evaluate(() => window.__marke === 1 && !!window.__carc.state).catch(() => false);
  ok(lebt, 'die Partie läuft weiter, obwohl der neue Stand da ist');
  await page.click('#btnGameMenu').catch(() => {}); await pause(100);
  await page.click('#btnQuit').catch(() => {});
  const r = await warteAuf(page, 'v2', 15000);
  ok(r.ok, r.ok ? 'zurück im Hauptmenü lädt die Seite den neuen Stand' : `im Hauptmenü bleibt ${r.s}`);
  await ctx.close();
}

await browser.close();
server.close();
rmSync(arbeit, { recursive: true, force: true });
console.log(`\n${gut} bestanden, ${schlecht} fehlgeschlagen`);
process.exit(schlecht ? 1 : 0);
