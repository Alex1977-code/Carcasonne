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

## Wie die Bögen entstehen: zwei Bilder, nicht nur Text

Die Bögen 01–06 wurden mit **zwei angehängten Bildern** erzeugt:

* **Bild 1, der Vorlagenbogen** — gibt Inhalt und Geometrie vor.
  *„Image 1 — the sheet. This defines the content and the geometry."*
* **Bild 2, die Referenzplatte** — gibt ausschließlich das Material vor.
  *„This is a MATERIAL SAMPLE ONLY."*

Das ist der Grund, warum dort die Wege in der Kantenmitte sitzen. Aus dem
Wort „mittig" macht ein Bildmodell 36 % oder 58 %; aus einem Bild nicht.
Die Bögen 07–14, die allein aus Text erzeugt wurden, sind genau daran
gescheitert: 24 von 40 Übergängen lagen daneben.

Vorlagenbogen erzeugt `tools/vorlagenbogen.mjs` aus der gezeichneten
Darstellung des Spiels — die hält den Randvertrag nicht nur ein, sie *ist*
er. Die Referenzplatte liegt als `grafik/vorlagen/referenzplatte.png`
(Motiv A aus Bogen 01).

Der Prompttext beschreibt dann nur noch Material, Farbbedeutung und die
Kantenzuweisung je Karte — nie die Geometrie.

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
