# Prompts für die fehlenden Kartenbögen

Stand: 20 von 49 Motiven sind gemalt (Bögen 01–05). Es fehlen **29 Motive**.
Diese Datei enthält für jedes fehlende Motiv einen fertigen Prompt.

Die Bögen 03 und 06 sind byte-identisch — Bogen 06 ist eine Dublette und
kann gelöscht werden.

---

## Das Wichtigste zuerst: der Randvertrag

Das ist der Teil, der über Erfolg oder Misserfolg entscheidet. Karten
werden in beliebiger Kombination aneinandergelegt. Wenn eine Straße auf
Karte A bei 48 % der Kantenlänge austritt und auf Karte B bei 53 %
eintritt, hat das Spielfeld an jeder Naht einen sichtbaren Versatz.

Aus den vorhandenen Bögen gemessen — **jeder neue Bogen muss sich daran
halten**:

| Element | Lage an der Kante | Breite |
|---|---|---|
| **Straße** | exakt mittig, Mitte bei 50 % | **11 %** der Kantenlänge (45 %–56 %) |
| **Fluss** | exakt mittig, Mitte bei 50 % | **18 %** der Kantenlänge (41 %–59 %) |
| **Stadt** | füllt die Kante **vollständig**, 0 %–100 % | ganze Kante |
| **Wiese** | alles Übrige | — |

Zwei Ausnahmen in den bestehenden Bögen, die **nicht** übernommen werden
sollen: auf Bogen 02 endet die Stadt 7–8 % vor der Ecke, auf Bogen 05
belegt sie nur 0–90 %. Beides erzeugt an der Naht einen Keil aus Wiese,
der gegen eine Stadtmauer läuft. Neue Karten bitte durchgehend 0–100 %.

Dazu drei Regeln, die genauso wichtig sind:

1. **Kein Rahmen um die Karte.** Die Malerei läuft bis an alle vier
   Kanten. Ein umlaufender Zierrahmen (wie bei den Klöstern auf Bogen 01)
   macht aus dem zusammengelegten Spielfeld ein Kachelgitter.
2. **Keine abgerundeten Ecken, kein Schlagschatten, kein grauer Grund um
   die Karte.** Die Karte ist ein randvoll bemaltes Quadrat.
3. **Nichts Wichtiges in den äußeren 3 %.** Dort wird beim Zuschneiden
   geschnitten.

---

## Der Stil (in jeden Prompt übernehmen)

> Illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel,
> Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn.
> Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen
> weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit
> Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern
> und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen
> Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit
> schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche.
> Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf.
> Kräftige, gesättigte Emailfarben: Blattgold, Smaragdgrün, Lapisblau,
> Elfenbein, Zinnoberrot.

Wappen, wo verlangt: **blauer Rundschild mit goldenem Sparren und zwei
goldenen Kugeln darunter**, wie auf den Bögen 01–05.

---

## Bogenformat

Wie bisher: **ein Bild, 2×2 Karten**, jede Karte ein randvoll bemaltes
Quadrat, zwischen den Karten ein schmaler neutralgrauer Steg. Kantenlänge
mindestens 1254 px pro Bogen (besser 2048 px — das Werkzeug rechnet auf
512 px pro Karte herunter, mehr Ausgangsmaterial gibt eine sauberere
Skalierung).

Reihenfolge im Bogen: **0 oben links, 1 oben rechts, 2 unten links,
3 unten rechts.** Genau diese Reihenfolge in `grafik/bogen-belegung.json`
eintragen.

---

# Bogen 07 — Straßenkarten

**Das ist der dringendste Bogen.** Diese vier Motive sind zusammen
**22 der 72 Grundkarten** (31 %). Solange sie fehlen, liegen auf jedem
Spielfeld gezeichnete Karten in hellem Grün zwischen den gemalten in Gold
— der Bruch ist auf jedem Bildschirmfoto sofort zu sehen.

### 07/0 — Motiv U: gerade Straße (8 Karten)
> Ein elfenbeinfarbenes, quer geripptes Wegband läuft senkrecht mittig von
> der Oberkante zur Unterkante durch die ganze Karte, 11 % der Kartenbreite,
> mit schmaler Goldfassung. Links und rechts davon tiefgrüne Emailwiese mit
> goldenen Ranken, Blüten und zwei bis drei goldumrissenen Bäumen; auf einer
> Seite ein goldener Acker mit geritzter Furche.

### 07/1 — Motiv V: Straßenkurve (9 Karten)
> Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der
> Unterkante ein und schwingt in einem weichen Viertelkreis nach links zur
> Mitte der linken Kante, 11 % der Kartenbreite, mit schmaler Goldfassung.
> Die übrige Fläche ist tiefgrüne Emailwiese mit goldenen Ranken, Blüten,
> drei goldumrissenen Bäumen und zwei goldenen Äckern in der oberen rechten
> Hälfte.

### 07/2 — Motiv W: Wegkreuz mit drei Armen (4 Karten)
> Drei elfenbeinfarbene, quer gerippte Wegbänder treffen sich in der
> Kartenmitte: eines von der Mitte der rechten Kante, eines von der Mitte
> der Unterkante, eines von der Mitte der linken Kante, je 11 % der
> Kartenbreite mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit
> blauem Emailauge als Wegmal. Die obere Kartenhälfte ist durchgehend
> tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen.

### 07/3 — Motiv X: Kreuzung (1 Karte)
> Vier elfenbeinfarbene, quer gerippte Wegbänder laufen von der Mitte
> jeder der vier Kanten zur Kartenmitte, je 11 % der Kartenbreite mit
> Goldfassung. Am Kreuzungspunkt eine runde Goldscheibe mit blauem
> Emailauge. In den vier entstehenden grünen Vierteln je ein
> goldumrissener Baum oder ein goldener Acker auf tiefgrüner Emailwiese.

---

# Bogen 08–10 — Der Fluss (9 Motive)

Der Fluss ist **lapisblaues Email mit hellblauen Glanzlinien und
goldener Uferfassung**, 18 % der Kantenlänge breit, mittig an der Kante.
Er läuft immer unter Wegen und Städten hindurch bzw. wird überbrückt.

### 08/0 — RV_SPRING: Quelle
> Nur an der **Unterkante** tritt mittig ein lapisblauer Fluss aus, 18 %
> der Kartenbreite, mit goldener Uferfassung. Er entspringt in der
> Kartenmitte einem gemauerten Rundbrunnen aus Gold mit blauem Emailwasser.
> Ringsum tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen. Die anderen
> drei Kanten sind reine Wiese.

### 08/1 — RV_LAKE: Mündung im See
> Nur an der **Oberkante** tritt mittig ein lapisblauer Fluss ein, 18 %
> der Kartenbreite, mit goldener Uferfassung, und weitet sich zur
> Kartenmitte hin zu einem ovalen See aus lapisblauem Email mit hellblauen
> Glanzlinien und goldenem Ufersaum. Ringsum tiefgrüne Emailwiese mit
> Schilf, Blüten und Bäumen. Die anderen drei Kanten sind reine Wiese.

### 08/2 — RV_STRAIGHT: gerader Fluss (2 Karten)
> Ein lapisblauer Fluss läuft senkrecht mittig von der Oberkante zur
> Unterkante durch die ganze Karte, 18 % der Kartenbreite, mit goldener
> Uferfassung und hellblauen Glanzlinien. Links und rechts tiefgrüne
> Emailwiese mit Ranken, Blüten und Bäumen.

### 08/3 — RV_CURVE: Flusskurve (3 Karten)
> Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in
> einem weichen Viertelkreis nach links zur Mitte der linken Kante, 18 %
> der Kartenbreite, mit goldener Uferfassung. Die übrige Fläche ist
> tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen.

### 09/0 — RV_BRIDGE: Brücke
> Ein lapisblauer Fluss läuft senkrecht mittig von oben nach unten durch
> die Karte (18 % breit, goldene Uferfassung). Waagerecht mittig kreuzt
> ihn ein elfenbeinfarbenes, quer geripptes Wegband von der linken zur
> rechten Kante (11 % breit, Goldfassung). Über dem Fluss trägt eine
> goldene Rundbogenbrücke mit Emailgeländer den Weg. Übrige Fläche
> tiefgrüne Emailwiese.

### 09/1 — RV_CITY: Fluss mit Stadt rechts
> Ein lapisblauer Fluss läuft senkrecht mittig von oben nach unten durch
> die Karte (18 % breit, goldene Uferfassung). Die **rechte Kante** ist
> über ihre **volle Länge** Stadt: Goldgrund mit weißen Häusern, blauen
> Ziegeldächern und einer Stadtmauer aus Goldband mit Zinnenmarken, die
> als Bogen zum Fluss hin abschließt. Zwischen Fluss und Stadtmauer
> schmaler grüner Uferstreifen. Links vom Fluss tiefgrüne Emailwiese.

### 09/2 — RV_MON: Flusskurve mit Kloster
> Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in
> einem Viertelkreis nach links zur Mitte der linken Kante (18 % breit,
> goldene Uferfassung). In der oberen rechten Hälfte steht ein Kloster:
> weiße Kirche mit blauem Satteldach, goldenem Glockenturm und ummauertem
> Hof mit Kräutergarten. Übrige Fläche tiefgrüne Emailwiese.
> **Kein Rahmen um die Karte** — die Klostermauer bleibt im Inneren.

### 09/3 — RV_ROADCURVE: Fluss- und Wegkurve
> Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in
> einem Viertelkreis nach links zur Mitte der linken Kante (18 % breit).
> Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der
> Oberkante ein und schwingt in einem Viertelkreis nach rechts zur Mitte
> der rechten Kante (11 % breit, Goldfassung). Fluss und Weg berühren
> einander nicht. Übrige Fläche tiefgrüne Emailwiese mit Bäumen.

### 10/0 — RV_CITY2: Fluss mit Stadt links
> Wie 09/1, aber die Stadt liegt an der **linken Kante** und füllt sie
> über ihre volle Länge; rechts vom Fluss tiefgrüne Emailwiese.

---

# Bogen 11–14 — Wirtshäuser & Kathedralen (16 Motive)

Das **Wirtshaus am See** ist ein weißes Haus mit blauem Dach, rotem
Wirtshausschild an goldenem Ausleger und einem kleinen blauen Teich
daneben; es steht immer direkt am Weg.
Die **Kathedrale** ist eine dreischiffige weiße Kirche mit drei blauen
Türmen, goldener Fensterrose und rotem Portal.

### 11/0 — EC_CATH: Kathedralstadt (2 Karten)
> Die ganze Karte ist Stadt: Goldgrund bis an alle vier Kanten, keine
> Wiese. In der Mitte eine große dreischiffige Kathedrale, weiß mit drei
> blauen Turmdächern, goldener Fensterrose und rotem Portal. Ringsum
> dicht gedrängte weiße Häuser mit blauen Ziegeldächern.

### 11/1 — EC_INN_STRAIGHT: gerade Straße mit Wirtshaus
> Wie Motiv U (senkrechtes Wegband mittig, 11 % breit), zusätzlich rechts
> am Weg ein Wirtshaus: weißes Haus mit blauem Dach, rotem Wirtshausschild
> an goldenem Ausleger, daneben ein kleiner ovaler blauer Teich mit
> goldenem Ufersaum. Übrige Fläche tiefgrüne Emailwiese.

### 11/2 — EC_INN_CURVE: Straßenkurve mit Wirtshaus (2 Karten)
> Wie Motiv V (Wegkurve von der Unterkante zur linken Kante, 11 % breit),
> zusätzlich in der Innenseite der Kurve ein Wirtshaus mit rotem
> Wirtshausschild und kleinem blauem Teich. Übrige Fläche tiefgrüne
> Emailwiese mit Bäumen.

### 11/3 — EC_INN_TJUNC: Wegkreuz mit Wirtshaus
> Wie Motiv W (drei Wegarme zur Mitte, runde Goldscheibe am Treffpunkt),
> zusätzlich am unteren Wegarm ein Wirtshaus mit rotem Wirtshausschild und
> kleinem blauem Teich. Obere Kartenhälfte tiefgrüne Emailwiese.

### 12/0 — EC_INN_CITYCURVE: Stadt oben, Wegkurve mit Wirtshaus
> Die **Oberkante** ist über ihre volle Länge Stadt: Goldgrund mit weißen
> Häusern und blauen Dächern, nach unten durch eine Stadtmauer aus
> Goldband mit Zinnenmarken als Bogen abgeschlossen. Darunter schwingt ein
> Wegband von der Mitte der rechten Kante zur Mitte der Unterkante (11 %
> breit); an der Kurve ein Wirtshaus mit rotem Schild und blauem Teich.
> Übrige Fläche tiefgrüne Emailwiese.

### 12/1 — EC_INN_CITYSTRAIGHT: Stadt oben, Querweg mit Wirtshaus
> Die **Oberkante** ist über ihre volle Länge Stadt mit abschließender
> Stadtmauer. Darunter läuft ein Wegband waagerecht mittig von der linken
> zur rechten Kante (11 % breit); daran ein Wirtshaus mit rotem Schild und
> blauem Teich. Untere Fläche tiefgrüne Emailwiese.

### 12/2 — EC_CITY_DIAG: zwei Städte über Eck, zwei Wege
> Die **rechte** und die **untere** Kante sind je über ihre volle Länge
> Stadt — zwei **getrennte** Stadtflächen, zwischen ihnen bleibt in der
> Ecke unten rechts ein grüner Keil. Ein Wegband läuft von der Mitte der
> Oberkante zur Mitte der linken Kante als Viertelkreis (11 % breit).
> Übrige Fläche tiefgrüne Emailwiese.

### 12/3 — EC_TRIPLE_CITY: Stadt auf drei Seiten
> **Ober-, rechte und linke Kante** sind über ihre volle Länge Stadt und
> bilden **eine zusammenhängende** Goldfläche, die sich hufeisenförmig um
> die untere Kartenmitte legt, dicht mit weißen Häusern und blauen Dächern
> besetzt, nach unten von einer Stadtmauer mit Zinnenmarken begrenzt. Am
> unteren Rand ein schmaler Streifen tiefgrüne Emailwiese mit Bäumen.
> Kein Wappen.

### 13/0 — EC_CITY_ROADPASS: Stadt oben und unten, Weg quer
> **Ober- und Unterkante** sind je über ihre volle Länge Stadt — zwei
> **getrennte** Stadtflächen mit weißen Häusern, blauen Dächern und
> Stadtmauern zur Mitte hin. Dazwischen läuft ein Wegband waagerecht
> mittig von der linken zur rechten Kante (11 % breit, Goldfassung) und
> tritt an beiden Seiten durch ein goldenes Stadttor mit rotem Torflügel.
> Beidseits des Wegs schmale grüne Streifen.

### 13/1 — EC_CITY_FULL: Stadt rundum mit Wappen
> Die ganze Karte ist Stadt: Goldgrund bis an alle vier Kanten, keine
> Wiese, dicht besetzt mit weißen Häusern, blauen Ziegeldächern und zwei
> Wehrtürmen mit roten Wimpeln. Rechts unten ein **blauer Rundschild mit
> goldenem Sparren und zwei goldenen Kugeln**.

### 13/2 — EC_DOUBLE_CURVE: zwei Wegkurven (Nordost und Südwest)
> Zwei getrennte Wegbänder (je 11 % breit, Goldfassung): das erste
> verbindet die Mitte der Oberkante mit der Mitte der rechten Kante in
> einem Viertelkreis, das zweite die Mitte der Unterkante mit der Mitte
> der linken Kante. Sie berühren einander nicht. Übrige Fläche tiefgrüne
> Emailwiese mit Bäumen und einem goldenen Acker.

### 13/3 — EC_DOUBLE_CURVE2: zwei Wegkurven (Nordwest und Südost)
> Wie 13/2, aber gespiegelt: das erste Wegband verbindet die Mitte der
> Oberkante mit der Mitte der linken Kante, das zweite die Mitte der
> Unterkante mit der Mitte der rechten Kante.

### 14/0 — EC_CROSS_CITY: Stadt oben mit Wappen, Wegkreuz unten
> Die **Oberkante** ist über ihre volle Länge Stadt mit Stadtmauer und
> einem **blauen Rundschild mit goldenem Sparren und zwei Kugeln**.
> Darunter treffen sich drei Wegbänder in der Kartenmitte: von der Mitte
> der rechten, der unteren und der linken Kante (je 11 % breit), am
> Treffpunkt eine runde Goldscheibe mit blauem Auge. Übrige Fläche
> tiefgrüne Emailwiese.

### 14/1 — EC_MON_ROAD2: Kloster mit durchgehender Straße
> Ein Wegband läuft senkrecht mittig von der Oberkante zur Unterkante
> durch die Karte (11 % breit). Rechts daneben steht ein Kloster: weiße
> Kirche mit blauem Satteldach, goldenem Glockenturm mit Kreuz, ummauertem
> Hof, Kräutergarten und blauem Zierteich. Übrige Fläche tiefgrüne
> Emailwiese. **Kein Rahmen um die Karte** — die Klostermauer bleibt im
> Inneren.

### 14/2 — EC_CITY_GATE: Stadt oben mit Tor, Weg nach unten
> Die **Oberkante** ist über ihre volle Länge Stadt mit weißen Häusern,
> blauen Dächern und einer Stadtmauer, die nach unten durch ein großes
> goldenes Stadttor mit rotem Torflügel und zwei Wehrtürmen unterbrochen
> ist. Aus dem Tor führt ein Wegband senkrecht mittig zur Unterkante
> (11 % breit). Beidseits tiefgrüne Emailwiese mit Bäumen.

### 14/3 — EC_CITY_3SHIELD: Stadt auf drei Seiten mit Doppelwappen
> Wie 12/3 (zusammenhängende Stadt über Ober-, rechte und linke Kante,
> Wiesenstreifen unten), zusätzlich **zwei** blaue Rundschilde mit
> goldenem Sparren und zwei Kugeln, nebeneinander im oberen Drittel der
> Stadtfläche.

---

# Tisch und Umgebung, fotorealistisch

Der Tisch wird bisher im Code gerechnet (Eiche mit Jahresringen, Poren,
Hobelspuren, drei Brettern und Wachsglanz). Fotorealistisch wird er erst
mit echtem Bildmaterial. Gebraucht werden **drei nahtlose Kacheln**, keine
fertigen Szenen — die Beleuchtung setzt das Spiel selbst darüber, damit
das Kerzenlicht flackern kann.

### T1 — Tischplatte (wird gebraucht)
> Fotorealistische Aufsicht senkrecht von oben auf eine massive, alte
> Eichentischplatte. Drei breite Bretter mit dunklen Fugen und
> angefasten Kanten, deutlich sichtbare Jahresringe und offene Poren,
> feine Hobelspuren quer zur Faser, Gebrauchsspuren: Kratzer, dunkle
> Flecken, matter Wachsglanz. Warmes Mittelbraun.
> **Nahtlos kachelbar in beide Richtungen**, gleichmäßig diffus
> ausgeleuchtet, **ohne Schlagschatten und ohne Lichtkegel**, 2048×2048 px.

Das „ohne Lichtkegel" ist entscheidend: eine Kachel mit eingebackenem
Licht lässt sich nicht kacheln und flackert nicht mit.

### T2 — Tischtuch (optional, für den Spielbereich)
> Fotorealistische Aufsicht senkrecht von oben auf grobes, ungebleichtes
> Leinen in Naturweiß mit sichtbarer Webstruktur, leichten Falten und
> unregelmäßiger Verfärbung. Nahtlos kachelbar, gleichmäßig diffus
> ausgeleuchtet, ohne Schatten, 2048×2048 px.

### T3 — Kartenrückseite (wird gebraucht, sobald ein Nachziehstapel sichtbar ist)
> Fotorealistische Aufsicht senkrecht von oben auf die Rückseite einer
> alten Spielkarte aus geprägtem Karton: dunkelrotbraune Grundfläche mit
> einem regelmäßigen goldenen Rautenmuster, abgegriffene helle Kanten,
> leichte Wölbung. Quadratisch, randvoll, ohne Schatten, 1024×1024 px.

---

# Wenn ein Bogen fertig ist

1. Datei nach `grafik/` legen.
2. In `grafik/bogen-belegung.json` eintragen (Motiv-Kürzel und Drehung
   je Quadrant).
3. `node tools/kacheln-schneiden.mjs` — schneidet, dreht, skaliert auf
   512 px und schreibt `grafik/karten/<Motiv>.webp`.
4. Das Kürzel in `js/ui/render/paintings.js` in die Liste `GEMALT`
   aufnehmen und in `sw.js` bei den Dateien ergänzen.
5. `node tests/tiles-schema.test.mjs` und die Galerie unter
   `debug/gallery.html` prüfen.
