# Arbeitsweise in diesem Projekt

## Prompts immer vollständig in die Antwort

Wenn es um Bildprompts geht: **den kompletten Prompt in die Antwort schreiben**,
nicht auf eine Datei im Repo oder eine veröffentlichte Seite verweisen. Der
Prompt wird am Handy in einen Bildgenerator eingefügt; ein Link dorthin ist
kein Prompt.

Vollständig heißt: Format, Stil, Maße und alle vier Kartenbeschreibungen in
**einem** Block, der für sich allein funktioniert. Keine Bausteine, die erst
zusammengesetzt werden müssen. Dazu die Angabe, welches Referenzbild
verwendet wird und welches nicht.

Ein Prompt pro **Bogen**, nicht pro Karte — ein Bogen ist ein Bild mit vier
Karten im 2×2-Raster.

## Herkunft der Bögen 01–06

Diese Bögen wurden ohne Beteiligung dieses Projekts erzeugt; die Prompts
dazu liegen nicht vor. Stil und Maße in `grafik/PROMPTS.md` sind aus den
Bildern **gemessen**, nicht aus den Originalprompts übernommen. Wenn die
Originalprompts auftauchen, sind sie die bessere Grundlage — sie haben
nachweislich Karten erzeugt, die den Randvertrag einhalten.

## Der Randvertrag ist die harte Bedingung

Aus den Bögen 01–05 gemessen, mit demselben Messcode für alt und neu:

| Element | Lage an der Kante | Breite |
|---|---|---|
| Straße | Mitte bei 50 % | 10,3–11 % |
| Fluss | Mitte bei 50 % | 18 % |
| Stadt | volle Kante | 0–100 % |

Eine Karte, deren Weg nicht in der Kantenmitte austritt, passt an keine
andere und ist unbrauchbar — unabhängig davon, wie gut sie gemalt ist.
Deshalb wird jeder neue Bogen vor der Übernahme **gemessen**, nicht
angesehen: `tools/kacheln-schneiden.mjs` schneidet, die Messung sitzt in der
Prüfroutine daneben.

## Neue Bögen einbauen

1. Datei nach `grafik/`
2. Eintrag in `grafik/bogen-belegung.json` (`null` für Quadranten, die nicht
   übernommen werden)
3. `node tools/kacheln-schneiden.mjs`
4. Motiv-Kürzel in `js/ui/render/paintings.js` (Liste `GEMALT`) **und** in
   `sw.js` — ohne beides bleibt es bei der gezeichneten Karte
5. `node tests/regeln.test.mjs` und die übrigen Suiten
