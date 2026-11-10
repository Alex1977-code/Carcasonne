/**
 * Den Stand in sw.js nachführen.
 *
 *   node tools/sw-stand.mjs            # setzen
 *   node tools/sw-stand.mjs --pruefen  # nur vergleichen, Rückgabewert 1 bei Abweichung
 *
 * Der Service Worker liefert das Spiel aus einem Speicher, der je Stand
 * einmal vollständig gefüllt wird. Dass es einen neuen Stand gibt, merkt
 * der Browser an genau einer Sache: sw.js hat sich geändert. Bleibt sie
 * gleich, während sich eine andere Datei ändert, kommt diese Änderung auf
 * keinem Gerät je an.
 *
 * Deshalb steht in sw.js eine Prüfsumme über alle ausgelieferten Dateien.
 * Dieses Werkzeug rechnet sie neu und erhöht die Nummer, wenn sie sich
 * geändert hat; tests/sw.test.mjs prüft in der CI, dass sie stimmt. Eine
 * vergessene Nummer fällt damit vor dem Merge auf und nicht am Telefon.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Die Liste ASSETS aus dem Quelltext von sw.js. */
export function assetsAus(quelle) {
  const a = quelle.indexOf('const ASSETS = [');
  const e = quelle.indexOf('];', a);
  if (a < 0 || e < 0) throw new Error('ASSETS in sw.js nicht gefunden');
  const block = quelle.slice(a, e).replace(/\/\/[^\n]*/g, '');
  return [...block.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
}

/** Prüfsumme über Namen und Inhalt aller Dateien der Liste. */
export function inhaltVon(assets, wurzel = ROOT) {
  const h = createHash('sha256');
  for (const pfad of [...new Set(assets)].sort()) {
    if (pfad === './') continue;                 // derselbe Inhalt wie ./index.html
    h.update(pfad).update('\0');
    h.update(createHash('sha256').update(readFileSync(join(wurzel, pfad))).digest());
  }
  return h.digest('hex').slice(0, 10);
}

/** Der in sw.js eingetragene Stand. */
export function standAus(quelle) {
  const m = /const STAND = \{ nr: (\d+), inhalt: '([0-9a-f]+)' \};/.exec(quelle);
  if (!m) throw new Error('STAND in sw.js nicht gefunden');
  return { nr: Number(m[1]), inhalt: m[2], text: m[0] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datei = join(ROOT, 'sw.js');
  const quelle = readFileSync(datei, 'utf8');
  const alt = standAus(quelle);
  const inhalt = inhaltVon(assetsAus(quelle));
  if (inhalt === alt.inhalt) {
    console.log(`Stand v${alt.nr} (${alt.inhalt}) stimmt.`);
    process.exit(0);
  }
  if (process.argv.includes('--pruefen')) {
    console.error(`sw.js nennt ${alt.inhalt}, die Dateien ergeben ${inhalt}. → node tools/sw-stand.mjs`);
    process.exit(1);
  }
  const nr = alt.nr + 1;
  writeFileSync(datei, quelle.replace(alt.text, `const STAND = { nr: ${nr}, inhalt: '${inhalt}' };`));
  console.log(`Stand v${alt.nr} (${alt.inhalt}) → v${nr} (${inhalt})`);
}
