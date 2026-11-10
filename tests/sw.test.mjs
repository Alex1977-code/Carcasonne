// Service Worker: node tests/sw.test.mjs
//
// Zwei Dinge, die sich ohne Browser prüfen lassen.
//
// Erstens die Liste. Der Service Worker liefert das Spiel aus einem
// Speicher, der je Stand einmal gefüllt wird. Was nicht in der Liste steht,
// fehlt ohne Netz; und ändert sich eine Datei, ohne dass sw.js sich ändert,
// kommt die Änderung auf keinem Gerät an. Beides fällt hier auf.
//
// Zweitens das Verhalten, gegen eine nachgebaute Umgebung: Einrichtung ganz
// oder gar nicht, Aufräumen nur der eigenen Speicher, und nur das Spiel
// selbst gilt als „die Seite". Jede dieser drei Stellen war ein Fehler.
// Im echten Browser prüft dasselbe tools/sw-pruefen.mjs mit zwei Fassungen.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import { assetsAus, inhaltVon, standAus } from '../tools/sw-stand.mjs';
import { GEMALT } from '../js/ui/render/paintings.js';
import { PLAYER_PALETTE } from '../js/ui/render/meeple-colors.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FEHLT:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${b}, war ${a})`); }

const quelle = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const assets = assetsAus(quelle);
const liste = new Set(assets);

console.log('=== 1. Die Liste ===');
{
  eq(liste.size, assets.length, 'keine Datei steht doppelt in der Liste');
  const fehlt = assets.filter((a) => a !== './' && !existsSync(join(ROOT, a)));
  eq(fehlt.length, 0, `jede Datei der Liste gibt es${fehlt.length ? ' – fehlt: ' + fehlt.join(', ') : ''}`);
  ok(liste.has('./') && liste.has('./index.html'), 'das Spiel selbst steht drin');

  // Alles, was index.html lädt, und alles, was davon importiert wird
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const ausHtml = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|webmanifest|svg|png))"/g)].map((m) => m[1]);
  const offen = ausHtml.filter((p) => p.endsWith('.js')).map((p) => resolve(ROOT, p));
  const module = new Set();
  while (offen.length) {
    const datei = offen.pop();
    if (module.has(datei) || !existsSync(datei)) continue;
    module.add(datei);
    const text = readFileSync(datei, 'utf8');
    for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
      offen.push(resolve(dirname(datei), m[1] || m[2]));
    }
  }
  const rel = (abs) => './' + abs.slice(ROOT.length + 1);
  const ohne = [...module].map(rel).filter((p) => !liste.has(p));
  eq(ohne.length, 0, `jedes geladene Modul steht in der Liste${ohne.length ? ' – fehlt: ' + ohne.join(', ') : ''}`);
  ok(module.size >= 20, `Module gefunden (waren ${module.size})`);
  const ohneHtml = ausHtml.map((p) => './' + p.replace(/^\.\//, '')).filter((p) => !liste.has(p));
  eq(ohneHtml.length, 0, `alles, was index.html lädt, steht in der Liste${ohneHtml.length ? ' – fehlt: ' + ohneHtml.join(', ') : ''}`);

  // Bilder: gemalte Karten, Figuren, Tischplatte
  const karten = GEMALT.map((id) => `./grafik/karten/${id}.webp`).filter((p) => !liste.has(p));
  eq(karten.length, 0, `jede gemalte Karte steht in der Liste${karten.length ? ' – fehlt: ' + karten.join(', ') : ''}`);
  const figuren = PLAYER_PALETTE.map((e) => `./grafik/figuren/${e.datei}.webp`).filter((p) => !liste.has(p));
  eq(figuren.length, 0, `jede Figur steht in der Liste${figuren.length ? ' – fehlt: ' + figuren.join(', ') : ''}`);
  ok(liste.has('./grafik/tischplatte.webp'), 'die Tischplatte steht in der Liste');
  // Und umgekehrt: keine Karte in der Liste, die das Spiel gar nicht lädt
  const zuviel = assets.filter((a) => a.startsWith('./grafik/karten/'))
    .map((a) => a.slice('./grafik/karten/'.length, -'.webp'.length)).filter((id) => !GEMALT.includes(id));
  eq(zuviel.length, 0, `keine Karte in der Liste, die nicht geladen wird${zuviel.length ? ' – ' + zuviel.join(', ') : ''}`);
}

console.log('=== 2. Der Stand ===');
{
  const stand = standAus(quelle);
  const ist = inhaltVon(assets);
  ok(stand.inhalt === ist,
    `sw.js nennt die Prüfsumme der ausgelieferten Dateien (sw.js: ${stand.inhalt}, Dateien: ${ist}) – node tools/sw-stand.mjs`);
  ok(stand.nr >= 29, `die Nummer läuft weiter (ist ${stand.nr})`);
}

// ---------------------------------------------------------------------------
// Eine nachgebaute Umgebung, gerade so viel, wie sw.js benutzt.
function umgebung({ netz }) {
  const ORT = 'https://beispiel.test/Carcasonne/sw.js';
  const lager = new Map();                // Name → Map(Adresse → Antwort)
  const horcher = {};
  const protokoll = { geholt: [], skipWaiting: 0, claim: 0 };
  class Anfrage {
    constructor(u, init = {}) {
      this.url = new URL(typeof u === 'string' ? u : u.url, ORT).href;
      this.method = init.method || 'GET';
      this.cache = init.cache || 'default';
      this.mode = init.mode || 'cors';
    }
  }
  const ohneAnhang = (u) => u.split(/[?#]/)[0];
  const speicher = (name) => {
    if (!lager.has(name)) lager.set(name, new Map());
    const m = lager.get(name);
    return {
      // Wie im Browser: erst alles holen, dann – nur wenn alles gelang – eintragen.
      async addAll(anfragen) {
        const antworten = await Promise.all(anfragen.map((a) => self.fetch(a)));
        if (antworten.some((r) => !r.ok)) throw new TypeError('addAll: eine Anfrage scheiterte');
        anfragen.forEach((a, i) => m.set(a.url, antworten[i]));
      },
      async match(a, opt = {}) {
        const u = new URL(typeof a === 'string' ? a : a.url, ORT).href;
        if (m.has(u)) return m.get(u);
        return opt.ignoreSearch ? m.get(ohneAnhang(u)) : undefined;
      },
      async put(a, r) { m.set(new URL(typeof a === 'string' ? a : a.url, ORT).href, r); },
    };
  };
  const self = {
    location: { href: ORT, origin: new URL(ORT).origin },
    addEventListener: (art, f) => { horcher[art] = f; },
    skipWaiting: async () => { protokoll.skipWaiting++; },
    clients: { claim: async () => { protokoll.claim++; } },
    fetch: async (a) => {
      const anfrage = a instanceof Anfrage ? a : new Anfrage(a);
      protokoll.geholt.push({ url: anfrage.url, cache: anfrage.cache });
      return netz(anfrage);
    },
  };
  const kontext = vm.createContext({
    self, URL, Promise, console, Response,
    Request: Anfrage,
    fetch: (a) => self.fetch(a),
    caches: {
      open: async (name) => speicher(name),
      keys: async () => [...lager.keys()],
      delete: async (name) => lager.delete(name),
    },
  });
  vm.runInContext(quelle, kontext, { filename: 'sw.js' });
  /** Ein Ereignis auslösen und abwarten, was der Worker daraus macht. */
  const loese = async (art, ereignis = {}) => {
    let warten = null, antwort;
    await horcher[art]({
      ...ereignis,
      waitUntil: (p) => { warten = p; },
      respondWith: (p) => { antwort = p; },
    });
    if (warten) await warten;
    return antwort === undefined ? undefined : await antwort;
  };
  return { lager, protokoll, loese, Anfrage, BASIS: 'https://beispiel.test/Carcasonne/' };
}
const antwort = (text, status = 200) => new Response(text, { status });

console.log('=== 3. Einrichtung: ganz oder gar nicht ===');
{
  const u = umgebung({ netz: async (a) => antwort('inhalt von ' + a.url) });
  await u.loese('install');
  const namen = [...u.lager.keys()];
  eq(namen.length, 1, 'ein Speicher für den Stand');
  ok(/^carcassonne-v\d+-[0-9a-f]{10}$/.test(namen[0]), `der Speicher trägt Nummer und Prüfsumme (${namen[0]})`);
  eq(u.lager.get(namen[0]).size, assets.length, 'jede Datei der Liste ist eingetragen');
  ok(u.protokoll.geholt.every((g) => g.cache === 'no-cache'), 'jede Datei am HTTP-Zwischenspeicher vorbei geholt');
  eq(u.protokoll.skipWaiting, 1, 'danach übernimmt der neue Stand');

  // Eine einzige Datei scheitert
  for (const [was, netz] of [
    ['mit 500', async (a) => (a.url.endsWith('/js/ui/render.js') ? antwort('', 500) : antwort('x'))],
    ['ohne Antwort', async (a) => { if (a.url.endsWith('/js/ui/render.js')) throw new TypeError('offline'); return antwort('x'); }],
  ]) {
    const v = umgebung({ netz });
    let gescheitert = false;
    try { await v.loese('install'); } catch { gescheitert = true; }
    ok(gescheitert, `scheitert eine Datei ${was}, scheitert die Einrichtung`);
    eq(v.protokoll.skipWaiting, 0, `… und der neue Stand übernimmt nicht (${was})`);
    const eintraege = [...v.lager.values()].reduce((n, m) => n + m.size, 0);
    eq(eintraege, 0, `… und nichts Halbes liegt im Speicher (${was})`);
  }
}

console.log('=== 4. Aufräumen: nur die eigenen Speicher ===');
{
  const u = umgebung({ netz: async () => antwort('x') });
  for (const n of ['carcassonne-v5', 'carcassonne-v28', 'ubongo-v3', 'workbox-precache']) u.lager.set(n, new Map([['x', 1]]));
  await u.loese('install');
  await u.loese('activate');
  const namen = [...u.lager.keys()];
  ok(!namen.includes('carcassonne-v5') && !namen.includes('carcassonne-v28'), 'alte eigene Stände sind weg');
  ok(namen.includes('ubongo-v3') && namen.includes('workbox-precache'), `fremde Speicher bleiben (übrig: ${namen.join(', ')})`);
  eq(namen.filter((n) => n.startsWith('carcassonne-')).length, 1, 'genau ein eigener Stand bleibt');
  eq(u.protokoll.claim, 1, 'offene Seiten werden übernommen');
}

console.log('=== 5. Antworten: aus dem Stand, und nur das Spiel ist „die Seite" ===');
{
  let offline = false;
  const u = umgebung({ netz: async (a) => { if (offline) throw new TypeError('offline'); return antwort('netz:' + a.url); } });
  await u.loese('install');
  await u.loese('activate');
  const hole = async (pfad, init) => {
    const r = await u.loese('fetch', { request: new u.Anfrage(pfad.startsWith('http') ? pfad : u.BASIS + pfad, init) });
    return r === undefined ? undefined : { status: r.status, text: await r.clone().text() };
  };
  const spiel = `netz:${u.BASIS}index.html`;
  u.protokoll.geholt.length = 0;
  for (const pfad of ['', 'index.html', '?quelle=pwa', 'index.html?x=1', '#raum=ABCD']) {
    const r = await hole(pfad, { mode: 'navigate' });
    eq(r && r.text, spiel, `„${pfad || './'}" liefert das Spiel aus dem Stand`);
  }
  eq((await hole('js/ui/main.js?v=3')).text, `netz:${u.BASIS}js/ui/main.js`, 'ein Anhang an der Adresse stört nicht');
  eq(u.protokoll.geholt.length, 0, 'für nichts davon wurde das Netz gefragt');

  // Eine andere Seite im selben Ordner
  const galerie = await hole('debug/gallery.html', { mode: 'navigate' });
  eq(galerie.text, `netz:${u.BASIS}debug/gallery.html`, 'die Galerie kommt aus dem Netz');
  eq((await hole('', { mode: 'navigate' })).text, spiel, '… und überschreibt das Spiel nicht');
  offline = true;
  eq((await hole('', { mode: 'navigate' })).text, spiel, 'ohne Netz startet das Spiel');
  eq((await hole('js/engine/game.js')).text, `netz:${u.BASIS}js/engine/game.js`, 'ohne Netz kommen die Module aus dem Stand');
  eq((await hole('debug/gallery.html', { mode: 'navigate' })).status, 504, 'die Galerie ohne Netz: 504, nichts Falsches');

  // Nicht zuständig
  eq(await hole('https://anderswo.test/x.js'), undefined, 'fremde Adressen fasst der Worker nicht an');
  eq(await hole('js/ui/main.js', { method: 'POST' }), undefined, 'und nichts außer GET');
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
