# Die fehlenden Kartenbögen

**20 von 49 Motiven sind gemalt. Es fehlen 29.**

Hier steht für jeden fehlenden Bogen **ein vollständiger Prompt** — Stil,
Format, Maße und alle vier Karten in einem Block, direkt zum Einfügen. Dazu
für jeden Bogen, welches vorhandene Bild als Referenz taugt und welches nicht.

Bogen 03 und 06 sind byte-identisch; Bogen 06 ist eine Dublette.

---

## Reihenfolge

| Bogen | Motive | Wirkung |
|---|---|---|
| **07** | U · V · W · X | **Zuerst.** 22 der 72 Grundkarten. |
| 08–10 | Fluss, 9 Motive | nur mit Flusserweiterung |
| 10–14 | Wirtshäuser & Kathedralen, 16 Motive | nur mit dieser Erweiterung |

Wer nur Bogen 07 macht, hat das Grundspiel vollständig gemalt.

---

## Referenzbilder — die Regeln

Ein Referenzbild hält den Stil zusammen. Es kann aber auch Fehler
weitertragen, deshalb drei Regeln:

1. **Als Stilreferenz anhängen, nicht als Bauplan.** Wenn das Werkzeug einen
   Regler für die Stärke hat: niedrig bis mittel. Steht er zu hoch, übernimmt
   der Generator den Aufbau der Vorlage statt dem, was im Text steht — und du
   bekommst vier Karten, die aussehen wie die Vorlage.

2. **Bogen 01 nie als allgemeine Referenz.** Seine beiden Klosterkarten haben
   einen umlaufenden Zierrahmen. Genau der darf sich nicht weiterverbreiten —
   er macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

3. **Bogen 02 und 05 nie als Referenz dafür, wie eine Stadt an die Kante
   stößt.** Auf Bogen 02 endet die Stadt 7–8 % vor der Ecke, auf Bogen 05
   belegt sie nur 0–90 % der Kante. Beides erzeugt an der Naht einen
   Wiesenkeil gegen eine Stadtmauer. Für Farbe und Häuser sind beide gut, für
   den Kantenanschluss gilt der Text.

**Für den Fluss gibt es keine Referenz.** Auf keinem der fünf vorhandenen
Bögen kommt Wasser vor. Das Aussehen des Flusses entsteht allein aus der
Beschreibung — dort sind mehrere Versuche einzuplanen.

---

## Der Randvertrag

Karten werden in beliebiger Kombination aneinandergelegt. Tritt eine Straße
auf Karte A bei 48 % der Kantenlänge aus und auf Karte B bei 53 % ein, hat das
Spielfeld an jeder Naht einen Versatz. Aus den vorhandenen Bögen gemessen:

| Element | Lage an der Kante | Breite |
|---|---|---|
| **Straße** | mittig bei 50 % | **11 %** (45–56 %) |
| **Fluss** | mittig bei 50 % | **18 %** (41–59 %) |
| **Stadt** | füllt die Kante ganz | **0–100 %** |
| **Wiese** | alles Übrige | — |

Die Maße stehen in jedem Prompt mit drin.

---

# Bogen 07 — Straßenkarten

**Der dringendste Bogen.** Diese vier Motive sind zusammen 22 der 72 Grundkarten. Solange sie fehlen, liegen auf jedem Spielfeld hellgrüne gezeichnete Karten zwischen den goldenen.

### Referenzbild

**`bogen03_generiert.png`** — dort liegen die drei Straßenkarten J, K und L mit genau den elfenbeinfarbenen Wegbändern und der goldenen Wegscheibe, die hier gebraucht werden.

Achtung: auf Bogen 03 hat **jede** Karte oben eine Stadt. Auf Bogen 07 kommt keine einzige Stadt vor. Wenn der Generator trotzdem Städte malt, ist die Referenzstärke zu hoch — herunterdrehen oder ganz weglassen.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Wege treten immer mittig an einer Kante aus und sind 11 % der Kantenlänge breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Ein elfenbeinfarbenes, quer geripptes Wegband läuft senkrecht mittig von der Oberkante zur Unterkante durch die ganze Karte, 11 % der Kartenbreite, mit schmaler Goldfassung. Links und rechts tiefgrüne Emailwiese mit goldenen Ranken, Blüten und zwei bis drei goldumrissenen Bäumen; auf einer Seite ein goldener Acker mit geritzter Furche.

Oben rechts: Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Unterkante ein und schwingt in einem weichen Viertelkreis nach links zur Mitte der linken Kante, 11 % breit mit schmaler Goldfassung. Die übrige Fläche ist tiefgrüne Emailwiese mit Ranken, Blüten, drei goldumrissenen Bäumen und zwei goldenen Äckern in der oberen rechten Hälfte.

Unten links: Drei elfenbeinfarbene, quer gerippte Wegbänder treffen sich in der Kartenmitte: eines von der Mitte der rechten Kante, eines von der Mitte der Unterkante, eines von der Mitte der linken Kante, je 11 % breit mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit blauem Emailauge als Wegmal. Die obere Kartenhälfte ist durchgehend Wiese, dort tritt kein Weg aus.

Unten rechts: Vier elfenbeinfarbene, quer gerippte Wegbänder laufen von der Mitte jeder der vier Kanten zur Kartenmitte, je 11 % breit mit Goldfassung. Am Kreuzungspunkt eine runde Goldscheibe mit blauem Emailauge. In den vier entstehenden grünen Vierteln je ein goldumrissener Baum oder ein goldener Acker.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen07_generiert.png": [
  { "id": "U", "dreh": 0 },
  { "id": "V", "dreh": 0 },
  { "id": "W", "dreh": 0 },
  { "id": "X", "dreh": 0 }
]
```

---

# Bogen 08 — Fluss I

### Referenzbild

**Keine Referenz für das Wasser** — auf keinem der fünf vorhandenen Bögen kommt ein Fluss vor.

Für Wiese, Ranken und Bäume **`bogen03_generiert.png`** anhängen, aber mit niedriger Stärke, sonst malt der Generator die Städte von Bogen 03 mit. Wie der Fluss aussieht, entscheidet allein der Text: lapisblaues Email, hellblaue Glanzlinien, goldene Uferfassung. Hier sind mehrere Versuche einzuplanen.

Sobald ein Flussbogen gelungen ist, wird **er** die Referenz für die nächsten beiden.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Flüsse treten immer mittig an einer Kante aus und sind 18 % der Kantenlänge breit, Wege ebenso mittig und 11 % breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Nur an der Unterkante tritt mittig ein lapisblauer Fluss aus, 18 % der Kartenbreite, mit goldener Uferfassung. Er entspringt in der Kartenmitte einem gemauerten Rundbrunnen aus Gold mit blauem Emailwasser. Ringsum tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen. Die anderen drei Kanten sind reine Wiese.

Oben rechts: Nur an der Oberkante tritt mittig ein lapisblauer Fluss ein, 18 % breit mit goldener Uferfassung, und weitet sich zur Kartenmitte hin zu einem ovalen See mit hellblauen Glanzlinien und goldenem Ufersaum. Ringsum tiefgrüne Emailwiese mit Schilf, Blüten und Bäumen. Die anderen drei Kanten sind reine Wiese.

Unten links: Ein lapisblauer Fluss läuft senkrecht mittig von der Oberkante zur Unterkante durch die ganze Karte, 18 % breit, mit goldener Uferfassung und hellblauen Glanzlinien. Links und rechts tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen.

Unten rechts: Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in einem weichen Viertelkreis nach links zur Mitte der linken Kante, 18 % breit mit goldener Uferfassung. Die übrige Fläche ist tiefgrüne Emailwiese mit Ranken, Blüten und Bäumen.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen08_generiert.png": [
  { "id": "RV_SPRING", "dreh": 0 },
  { "id": "RV_LAKE", "dreh": 0 },
  { "id": "RV_STRAIGHT", "dreh": 0 },
  { "id": "RV_CURVE", "dreh": 0 }
]
```

---

# Bogen 09 — Fluss II

### Referenzbild

**`bogen08_generiert.png`**, sobald Bogen 08 fertig ist — der eigene Fluss ist die beste Referenz für den nächsten.

Für die Stadt auf der zweiten Karte zusätzlich **`bogen04_generiert.png`** (dort stoßen Städte sauber an die Kante). **Nicht** Bogen 02 oder 05 dafür nehmen — deren Städte enden vor der Ecke.

Für die Klosterkarte die Kirche von **`bogen01_generiert.png`** als Vorbild beschreiben, das Bild aber **nicht anhängen**: Bogen 01 trägt den umlaufenden Zierrahmen, der hier auf keinen Fall mitkommen darf.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Flüsse treten immer mittig an einer Kante aus und sind 18 % der Kantenlänge breit, Wege ebenso mittig und 11 % breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Ein lapisblauer Fluss läuft senkrecht mittig von oben nach unten durch die Karte, 18 % breit mit goldener Uferfassung. Waagerecht mittig kreuzt ihn ein elfenbeinfarbenes, quer geripptes Wegband von der linken zur rechten Kante, 11 % breit mit Goldfassung. Über dem Fluss trägt eine goldene Rundbogenbrücke mit Emailgeländer den Weg. Übrige Fläche tiefgrüne Emailwiese.

Oben rechts: Ein lapisblauer Fluss läuft senkrecht mittig von oben nach unten durch die Karte, 18 % breit. Die rechte Kante ist über ihre volle Länge Stadt: Goldgrund mit weißen Häusern, blauen Ziegeldächern und einer Stadtmauer aus Goldband mit Zinnenmarken, die als Bogen zum Fluss hin abschließt. Zwischen Fluss und Mauer ein schmaler grüner Uferstreifen. Links vom Fluss tiefgrüne Emailwiese.

Unten links: Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante, 18 % breit. In der oberen rechten Hälfte steht ein Kloster: weiße Kirche mit blauem Satteldach, goldenem Glockenturm und ummauertem Hof mit Kräutergarten. Übrige Fläche tiefgrüne Emailwiese. Die Klostermauer bleibt im Inneren der Karte, sie umrahmt die Karte nicht.

Unten rechts: Ein lapisblauer Fluss tritt mittig an der Unterkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante, 18 % breit. Ein elfenbeinfarbenes Wegband tritt mittig an der Oberkante ein und schwingt in einem Viertelkreis nach rechts zur Mitte der rechten Kante, 11 % breit mit Goldfassung. Fluss und Weg berühren einander nicht. Übrige Fläche tiefgrüne Emailwiese mit Bäumen.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen09_generiert.png": [
  { "id": "RV_BRIDGE", "dreh": 0 },
  { "id": "RV_CITY", "dreh": 0 },
  { "id": "RV_MON", "dreh": 0 },
  { "id": "RV_ROADCURVE", "dreh": 0 }
]
```

---

# Bogen 10 — Fluss III und erste Wirtshäuser

### Referenzbild

**`bogen08_generiert.png`** für den Fluss (erste Karte) und **`bogen05_generiert.png`** für die dichte Stadtbebauung der Kathedralkarte — dort sind die Städte am dichtesten mit Häusern besetzt.

Für die beiden Wirtshauskarten **`bogen03_generiert.png`** wegen der Wegbänder. Das Wirtshaus selbst gibt es nirgends als Vorlage; es entsteht aus dem Text.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Flüsse treten immer mittig an einer Kante aus und sind 18 % der Kantenlänge breit, Wege ebenso mittig und 11 % breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Ein lapisblauer Fluss läuft senkrecht mittig von oben nach unten durch die Karte, 18 % breit mit goldener Uferfassung. Die linke Kante ist über ihre volle Länge Stadt: Goldgrund mit weißen Häusern, blauen Ziegeldächern und einer Stadtmauer aus Goldband mit Zinnenmarken, die als Bogen zum Fluss hin abschließt. Zwischen Fluss und Mauer ein schmaler grüner Uferstreifen. Rechts vom Fluss tiefgrüne Emailwiese.

Oben rechts: Die ganze Karte ist Stadt: Goldgrund bis an alle vier Kanten, keine Wiese. In der Mitte eine große dreischiffige Kathedrale, weiß mit drei blauen Turmdächern, goldener Fensterrose und rotem Portal. Ringsum dicht gedrängte weiße Häuser mit blauen Ziegeldächern. Kein Wappen.

Unten links: Ein elfenbeinfarbenes, quer geripptes Wegband läuft senkrecht mittig von der Oberkante zur Unterkante durch die ganze Karte, 11 % breit mit Goldfassung. Rechts am Weg ein Wirtshaus: weißes Haus mit blauem Dach, rotem Wirtshausschild an goldenem Ausleger, daneben ein kleiner ovaler blauer Teich mit goldenem Ufersaum. Übrige Fläche tiefgrüne Emailwiese.

Unten rechts: Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Unterkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante, 11 % breit mit Goldfassung. In der Innenseite der Kurve ein Wirtshaus mit rotem Wirtshausschild an goldenem Ausleger und kleinem blauem Teich. Übrige Fläche tiefgrüne Emailwiese mit Bäumen.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen10_generiert.png": [
  { "id": "RV_CITY2", "dreh": 0 },
  { "id": "EC_CATH", "dreh": 0 },
  { "id": "EC_INN_STRAIGHT", "dreh": 0 },
  { "id": "EC_INN_CURVE", "dreh": 0 }
]
```

---

# Bogen 11 — Wirtshäuser an Städten

### Referenzbild

**`bogen04_generiert.png`** — dort sind Städte und Wege auf derselben Karte kombiniert, genau wie hier, und die Städte stoßen sauber an die Kante.

Wenn Bogen 10 fertig ist, zusätzlich **`bogen10_generiert.png`** anhängen, damit das Wirtshaus gleich aussieht wie dort. Zwei verschiedene Wirtshäuser im selben Spiel fallen sofort auf.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Wege treten immer mittig an einer Kante aus und sind 11 % der Kantenlänge breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Drei elfenbeinfarbene, quer gerippte Wegbänder treffen sich in der Kartenmitte: von der Mitte der rechten Kante, der Unterkante und der linken Kante, je 11 % breit mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit blauem Emailauge. Am unteren Wegarm ein Wirtshaus mit rotem Wirtshausschild und kleinem blauem Teich. Die obere Kartenhälfte ist durchgehend tiefgrüne Emailwiese, dort tritt kein Weg aus.

Oben rechts: Die Oberkante ist über ihre volle Länge Stadt: Goldgrund mit weißen Häusern und blauen Dächern, nach unten durch eine Stadtmauer aus Goldband mit Zinnenmarken als Bogen abgeschlossen. Darunter schwingt ein elfenbeinfarbenes Wegband von der Mitte der rechten Kante zur Mitte der Unterkante, 11 % breit; an der Kurve ein Wirtshaus mit rotem Schild und blauem Teich. Übrige Fläche tiefgrüne Emailwiese.

Unten links: Die Oberkante ist über ihre volle Länge Stadt mit abschließender Stadtmauer. Darunter läuft ein elfenbeinfarbenes Wegband waagerecht mittig von der linken zur rechten Kante, 11 % breit; daran ein Wirtshaus mit rotem Schild und blauem Teich. Untere Fläche tiefgrüne Emailwiese.

Unten rechts: Die rechte und die untere Kante sind je über ihre volle Länge Stadt, aber als zwei getrennte Stadtflächen mit je eigener Stadtmauer: in der Ecke unten rechts bleibt zwischen ihnen ein grüner Keil, sie berühren einander nicht. Ein elfenbeinfarbenes Wegband läuft als Viertelkreis von der Mitte der Oberkante zur Mitte der linken Kante, 11 % breit. Übrige Fläche tiefgrüne Emailwiese.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen11_generiert.png": [
  { "id": "EC_INN_TJUNC", "dreh": 0 },
  { "id": "EC_INN_CITYCURVE", "dreh": 0 },
  { "id": "EC_INN_CITYSTRAIGHT", "dreh": 0 },
  { "id": "EC_CITY_DIAG", "dreh": 0 }
]
```

---

# Bogen 12 — Städte

**Zwei Karten, die leicht verwechselt werden.** `EC_TRIPLE_CITY` (hier, oben links) hat **drei getrennte** Städte. `EC_CITY_3SHIELD` (Bogen 14) sieht ähnlich aus, ist aber **eine zusammenhängende** Stadt mit zwei Wappen. Im Spiel zählen sie völlig verschieden.

### Referenzbild

**`bogen04_generiert.png`** für den Kantenanschluss der Städte und **`bogen05_generiert.png`** für die dichte Bebauung der Vollstadt und das Wappen.

Bei Bogen 05 den Regler niedrig halten: dessen Städte belegen nur 0–90 % der Kante. Wie weit die Stadt an die Ecke reicht, steht im Text und darf nicht aus dem Bild kommen.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Wege treten immer mittig an einer Kante aus und sind 11 % der Kantenlänge breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Ober-, rechte und linke Kante sind je über ihre volle Länge Stadt, aber als drei voneinander getrennte Stadtflächen mit je eigener Stadtmauer aus Goldband mit Zinnenmarken. Sie berühren einander nicht: zwischen ihnen läuft die Wiese in beiden oberen Ecken bis an den Rand durch. Unten ein breiter Streifen tiefgrüne Emailwiese mit Bäumen und goldenen Äckern. Kein Wappen.

Oben rechts: Ober- und Unterkante sind je über ihre volle Länge Stadt, als zwei getrennte Stadtflächen mit weißen Häusern, blauen Dächern und Stadtmauern zur Mitte hin. Dazwischen läuft ein elfenbeinfarbenes Wegband waagerecht mittig von der linken zur rechten Kante, 11 % breit, und tritt an beiden Seiten durch ein goldenes Stadttor mit rotem Torflügel. Beidseits des Wegs schmale grüne Streifen.

Unten links: Die ganze Karte ist Stadt: Goldgrund bis an alle vier Kanten, keine Wiese, dicht besetzt mit weißen Häusern, blauen Ziegeldächern und zwei Wehrtürmen mit roten Wimpeln. Rechts unten ein blauer Rundschild mit goldenem Sparren und zwei goldenen Kugeln darunter.

Unten rechts: Zwei getrennte elfenbeinfarbene Wegbänder, je 11 % breit mit Goldfassung: das erste verbindet als Viertelkreis die Mitte der Oberkante mit der Mitte der rechten Kante, das zweite die Mitte der Unterkante mit der Mitte der linken Kante. Sie berühren einander nicht. Übrige Fläche tiefgrüne Emailwiese mit Bäumen und einem goldenen Acker.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen12_generiert.png": [
  { "id": "EC_TRIPLE_CITY", "dreh": 0 },
  { "id": "EC_CITY_ROADPASS", "dreh": 0 },
  { "id": "EC_CITY_FULL", "dreh": 0 },
  { "id": "EC_DOUBLE_CURVE", "dreh": 0 }
]
```

---

# Bogen 13 — Wege und Tore

### Referenzbild

**`bogen07_generiert.png`**, sobald Bogen 07 fertig ist — dort stehen die reinen Wegkarten und die goldene Wegscheibe. Sonst **`bogen03_generiert.png`**.

Die Klosterkarte ist der heikle Fall: die Kirche auf **Bogen 01** ist das richtige Vorbild, aber das Bild **nicht anhängen**. Bogen 01 trägt den umlaufenden Zierrahmen, und genau der würde hier mitkommen. Die Kirche im Text beschreiben und den Rahmen ausdrücklich ausschließen.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Wege treten immer mittig an einer Kante aus und sind 11 % der Kantenlänge breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Die vier Karten:

Oben links: Zwei getrennte elfenbeinfarbene Wegbänder, je 11 % breit mit Goldfassung: das erste verbindet als Viertelkreis die Mitte der Oberkante mit der Mitte der linken Kante, das zweite die Mitte der Unterkante mit der Mitte der rechten Kante. Sie berühren einander nicht. Übrige Fläche tiefgrüne Emailwiese mit Bäumen und einem goldenen Acker.

Oben rechts: Die Oberkante ist über ihre volle Länge Stadt mit weißen Häusern, blauen Dächern und einer Stadtmauer aus Goldband mit Zinnenmarken, darin ein blauer Rundschild mit goldenem Sparren und zwei Kugeln. Darunter treffen sich drei elfenbeinfarbene Wegbänder in der Kartenmitte: von der Mitte der rechten Kante, der Unterkante und der linken Kante, je 11 % breit. Am Treffpunkt eine runde Goldscheibe mit blauem Emailauge. Übrige Fläche tiefgrüne Emailwiese.

Unten links: In der Kartenmitte steht ein Kloster: weiße Kirche mit blauem Satteldach, goldenem Glockenturm mit Kreuz, ummauertem Hof und Kräutergarten. Von der Mitte der Oberkante führt ein elfenbeinfarbenes Wegband bis an die Klostermauer und endet dort am Tor; von der Mitte der Unterkante führt ein zweites Wegband ebenso bis an die Mauer. Die beiden Wege sind durch das Kloster getrennt und laufen nicht durch. Je 11 % breit mit Goldfassung. Übrige Fläche tiefgrüne Emailwiese. Die Klostermauer bleibt im Inneren der Karte, sie umrahmt die Karte nicht.

Unten rechts: Die Oberkante ist über ihre volle Länge Stadt mit weißen Häusern, blauen Dächern und einer Stadtmauer, die nach unten durch ein großes goldenes Stadttor mit rotem Torflügel und zwei Wehrtürmen unterbrochen ist. Aus dem Tor führt ein elfenbeinfarbenes Wegband senkrecht mittig zur Unterkante, 11 % breit. Nach oben tritt kein Weg aus. Beidseits tiefgrüne Emailwiese mit Bäumen.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen13_generiert.png": [
  { "id": "EC_DOUBLE_CURVE2", "dreh": 0 },
  { "id": "EC_CROSS_CITY", "dreh": 0 },
  { "id": "EC_MON_ROAD2", "dreh": 0 },
  { "id": "EC_CITY_GATE", "dreh": 0 }
]
```

---

# Bogen 14 — Die letzte Karte

Nur ein Motiv. Entweder als einzelnes quadratisches Bild oder als 2×2-Bogen mit der Karte oben links und drei leeren grauen Feldern — das Werkzeug liest nur, was in der Belegung steht.

### Referenzbild

**`bogen05_generiert.png`** — dessen Karte Q ist genau diese Form: Stadt auf drei Seiten mit Wappen. Näher kommt keine vorhandene Karte.

Den Regler trotzdem niedrig halten, weil Bogen 05 die Stadt nur bis 0–90 % der Kante führt. Hier muss sie bis in die Ecken.

### Prompt — vollständig, zum Einfügen

```
Ein einzelnes quadratisches Bild mit einer einzelnen Spielkarte. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Kreise mit Goldperlen. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen: Wege treten immer mittig an einer Kante aus und sind 11 % der Kantenlänge breit. Städte füllen ihre Kante über die volle Länge, von Ecke zu Ecke.

Ober-, rechte und linke Kante sind über ihre volle Länge Stadt und bilden eine einzige zusammenhängende Goldfläche, die sich hufeisenförmig um die untere Kartenmitte legt: die drei Seiten hängen zusammen. Dicht besetzt mit weißen Häusern und blauen Ziegeldächern, nach unten von einer Stadtmauer mit Zinnenmarken begrenzt. Im oberen Drittel zwei blaue Rundschilde mit goldenem Sparren und zwei Kugeln, nebeneinander. Unten ein schmaler Streifen tiefgrüne Emailwiese.
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen14_generiert.png": [
  { "id": "EC_CITY_3SHIELD", "dreh": 0 }
]
```

---

# Tisch und Umgebung, fotorealistisch

Der Tisch wird bisher im Code gerechnet. Fotorealistisch wird er erst mit
echtem Bildmaterial. Gebraucht werden **nahtlose Kacheln**, keine fertigen
Szenen: die Beleuchtung setzt das Spiel selbst darüber, damit das Kerzenlicht
flackern kann.

**Referenzbild: keins.** Diese drei Kacheln haben mit dem Kartenstil nichts zu
tun — im Gegenteil, ein angehängter Kartenbogen würde die Fotorealistik
zerstören. Ohne Referenz generieren.

### T1 — Tischplatte *(wird gebraucht)*

```
Fotorealistische Aufsicht senkrecht von oben auf eine massive, alte
Eichentischplatte. Drei breite Bretter mit dunklen Fugen und angefasten
Kanten, deutlich sichtbare Jahresringe und offene Poren, feine Hobelspuren
quer zur Faser, Gebrauchsspuren: Kratzer, dunkle Flecken, matter Wachsglanz.
Warmes Mittelbraun. Nahtlos kachelbar in beide Richtungen, gleichmäßig diffus
ausgeleuchtet, ohne Schlagschatten und ohne Lichtkegel. 2048x2048 px.
```

Das „ohne Lichtkegel" ist der entscheidende Teil: eine Kachel mit
eingebackenem Licht lässt sich nicht kacheln und flackert nicht mit.

### T2 — Tischtuch *(optional)*

```
Fotorealistische Aufsicht senkrecht von oben auf grobes, ungebleichtes Leinen
in Naturweiß mit sichtbarer Webstruktur, leichten Falten und unregelmäßiger
Verfärbung. Nahtlos kachelbar, gleichmäßig diffus ausgeleuchtet, ohne Schatten.
2048x2048 px.
```

### T3 — Kartenrückseite *(sobald ein Nachziehstapel sichtbar ist)*

```
Fotorealistische Aufsicht senkrecht von oben auf die Rückseite einer alten
Spielkarte aus geprägtem Karton: dunkelrotbraune Grundfläche mit regelmäßigem
goldenem Rautenmuster, abgegriffene helle Kanten, leichte Wölbung.
Quadratisch, randvoll, ohne Schatten. 1024x1024 px.
```

---

# Was mit einem fertigen Bogen zu tun ist

1. **Datei ablegen** unter `grafik/`, benannt wie im JSON-Block.

2. **Belegung eintragen:** den JSON-Block in `grafik/bogen-belegung.json`
   einfügen, vor der schließenden Klammer, mit Komma an der Zeile davor.

3. **Schneiden:**
   ```
   node tools/kacheln-schneiden.mjs
   ```
   Schneidet, dreht, skaliert auf 512 px und schreibt
   `grafik/karten/<Motiv>.webp`.

4. **Freischalten:** das Motiv-Kürzel in `js/ui/render/paintings.js` in die
   Liste `GEMALT` aufnehmen und in `sw.js` bei den Dateien ergänzen.
   **Ohne diesen Schritt bleibt es bei der gezeichneten Karte** — das ist die
   Stelle, die am ehesten vergessen wird.

5. **Prüfen:**
   ```
   node tests/tiles-schema.test.mjs
   node tests/regeln.test.mjs
   ```
   Dazu `debug/gallery.html` öffnen: alle fünf Abnahmelichter müssen grün
   bleiben, besonders „Kantenanschluss".

6. **Ansehen:** eine Partie starten und prüfen, ob an den Nähten Straßen und
   Stadtmauern durchlaufen. Ein Versatz heißt: der Randvertrag wurde nicht
   eingehalten, der Bogen muss neu.

**Wenn eine Karte verdreht im Spiel liegt** — nicht das Bild ändern, sondern
`"dreh"` in der Belegung auf 1, 2 oder 3 setzen (Vierteldrehungen im
Uhrzeigersinn) und Schritt 3 wiederholen.
