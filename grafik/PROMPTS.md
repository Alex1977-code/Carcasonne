# Kartenbögen 19 bis 26 — alles ab Bogen 07 neu

**29 der 49 Motive werden neu gemalt.** Die 20 Motive der Bögen 01 bis 05
bleiben, wie sie sind — sie sind gemessen in Ordnung und geben den Stil vor.
Alles, was danach kam, wird ersetzt.

## Warum überhaupt neu

Gemessen über alle bisher gemalten Karten, gruppiert nach Herkunftsbogen:

| Bogen | Wegbreite an der Kante | Rankendichte der Wiese | Wiesengrün (R,G,B) |
|---|---|---|---|
| 01–05 | 9,5–11,5 % | 38–76 % | 33–46 / 66–86 / 16–33 |
| 07 | **11,8–13,8 %** | **6,9–13,0 %** | 33 / 88–90 / 16–17 |
| 08, 10, 13 | 7,5–9,8 % | 7–28 % | 28–40 / 68–78 / 13–21 |

Die Bögen ab 07 wurden allein aus Text erzeugt, ohne Vorlagenbild. Daran sind
sie gescheitert: aus dem Wort „mittig" macht ein Bildmodell 36 % oder 58 %, und
aus „schmales Band" 13,8 % statt 11 %. Von den 40 Kantenübergängen der ersten
Lieferung lagen 24 daneben. Zusätzlich unterscheidet sich die Wiese so stark,
dass man auf dem Brett sofort sieht, welche Karte von welchem Bogen stammt.

Zwei Fehler stecken noch heute in den übernommenen Karten:

* **RV_CURVE** tritt an der Unterkante bei 46,5 % statt 50 % aus.
* **U, W und X** haben Wege von 11,8 bis 13,8 % statt 11 %.

Beide sind nie aufgefallen, weil das Prüfwerkzeug nur zu *schmale* Wege
beanstandet hat. Das ist behoben.

## Wie es diesmal läuft: zwei Bilder, nicht nur Text

Die funktionierenden Bögen 01 bis 05 sind mit **zwei angehängten Bildern**
entstanden. Genauso wird es hier gemacht:

* **Bild 1 — der Vorlagenbogen.** Gibt Inhalt und Geometrie vor. Für jeden
  Bogen liegt eine eigene Datei bei: `bogen19-vorlage.png` bis
  `bogen26-vorlage.png`. Sie sind vom Spiel selbst gezeichnet und halten den
  Randvertrag nicht nur ein — sie *sind* er. **Referenzstärke hoch.**
* **Bild 2 — die Referenzplatte,** `referenzplatte.png`. Gibt ausschließlich
  das Material vor: Farbe, Oberfläche, Rankendichte, Wegmaterial.
  **Referenzstärke niedrig.** Für alle acht Bögen dasselbe Bild — das ist der
  Grund, warum am Ende alles aus einem Guss aussieht.

Die Referenzplatte ist Motiv A aus Bogen 01, eine Klosterkarte. Ihre
Klostermauer läuft als Rahmen um die Karte herum. **Dieser Rahmen darf sich
nicht weiterverbreiten** — er macht aus dem zusammengelegten Spielfeld ein
Kachelgitter. Der Hinweis steht in jedem Prompt mit drin.

## Der Randvertrag

Karten werden in beliebiger Kombination aneinandergelegt. Tritt eine Straße auf
Karte A bei 48 % der Kantenlänge aus und auf Karte B bei 53 % ein, hat das
Spielfeld an jeder Naht einen Versatz.

| Element | Lage an der Kante | Breite |
|---|---|---|
| **Straße** | mittig bei 50 % | **10,5–11 %** Elfenbeinkern, **15–16 %** mit Goldfassung |
| **Fluss** | mittig bei 50 % | **18–19 %** |
| **Stadt** | füllt die Kante ganz | **0–100 %** |
| **Wiese** | alles Übrige | — |

Die Maße stehen in jedem Prompt noch einmal mit drin.

## Prüfen, bevor übernommen wird

    node tools/bogen-pruefen.mjs <bild.png> <Motiv1> <Motiv2> <Motiv3> <Motiv4>

Das Werkzeug meldet je Karte die tatsächliche Kantenfolge, ob sie zum genannten
Motiv passt, und für jeden Weg und Fluss Lage und Breite an der Kante — in
beide Richtungen, zu schmal wie zu breit. Erst wenn dort „Alles im Randvertrag"
steht, wird übernommen.

**Nie nach Augenschein entscheiden.** Ein Weg, der bei 44 % statt 50 %
austritt, sieht in der Vorschau tadellos aus. Von den 40 Übergängen der ersten
Lieferung lagen 24 daneben, und im Bild war keiner davon aufgefallen.

## Übersicht

| Bogen | Vorlage | Motive |
|---|---|---|
| **19** | `bogen19-vorlage.png` | U · V · W · X |
| **20** | `bogen20-vorlage.png` | RV_SPRING · RV_LAKE · RV_STRAIGHT · RV_CURVE |
| **21** | `bogen21-vorlage.png` | RV_BRIDGE · RV_ROADCURVE · RV_CITY · RV_CITY2 |
| **22** | `bogen22-vorlage.png` | EC_CATH · EC_CITY_FULL · EC_TRIPLE_CITY · EC_CITY_3SHIELD |
| **23** | `bogen23-vorlage.png` | EC_INN_STRAIGHT · EC_INN_CURVE · EC_INN_TJUNC · EC_DOUBLE_CURVE |
| **24** | `bogen24-vorlage.png` | EC_DOUBLE_CURVE2 · EC_INN_CITYCURVE · EC_INN_CITYSTRAIGHT · EC_CITY_GATE |
| **25** | `bogen25-vorlage.png` | EC_CITY_DIAG · EC_CITY_ROADPASS · EC_CROSS_CITY |
| **26** | `bogen26-vorlage.png` | RV_MON · EC_MON_ROAD2 |

Reihenfolge: Bogen 19 zuerst — er betrifft das Grundspiel, das ohne
Erweiterung gespielt wird. Danach 20 und 21 für den Fluss, dann 22 bis 26 für
Wirtshäuser und Kathedralen.

---

# Bogen 19 — Straßenkarten des Grundspiels

**Motive:** U · V · W · X

Die letzten vier Grundkarten. Zusammen 22 der 72 Karten des Grundspiels — kein Bogen wirkt stärker.

### Referenzbilder

* **Bild 1:** `bogen19-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Auf diesem Bogen kommt **keine einzige Stadt** vor. Malt der Generator trotzdem Städte, ist Image 2 zu stark eingestellt.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: Ein elfenbeinfarbenes, quer geripptes Wegband läuft senkrecht mittig von der Oberkante zur Unterkante durch die ganze Karte, mit schmaler Goldfassung. Links und rechts tiefgrüne Emailwiese mit dichten goldenen Ranken, Blüten, je zwei goldumrissenen Bäumen und je einem goldenen Acker mit geritzter Furche.

Oben rechts: Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Unterkante ein und schwingt in einem gleichmäßigen Viertelkreis nach links zur Mitte der linken Kante, mit schmaler Goldfassung. Der Bogen ist rund, kein enger Knick und keine flache Ausbuchtung. Die übrige Fläche ist Wiese mit dichten Ranken, Blüten, drei Bäumen und zwei goldenen Äckern in der oberen rechten Hälfte.

Unten links: Drei elfenbeinfarbene, quer gerippte Wegbänder treffen sich in der Kartenmitte: eines von der Mitte der rechten Kante, eines von der Mitte der Unterkante, eines von der Mitte der linken Kante, alle drei gleich breit mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit strahlenförmiger Rippung und blauem Emailauge als Wegmal. Die obere Kartenhälfte ist durchgehend Wiese mit zwei Bäumen und einem Acker; an der Oberkante tritt kein Weg aus.

Unten rechts: Vier elfenbeinfarbene, quer gerippte Wegbänder laufen von der Mitte jeder der vier Kanten zur Kartenmitte, alle vier gleich breit mit Goldfassung. Am Kreuzungspunkt eine runde Goldscheibe mit strahlenförmiger Rippung und blauem Emailauge. In den vier entstehenden grünen Vierteln je ein goldumrissener Baum oder ein goldener Acker.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen19_generiert.png U V W X
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen19_generiert.png": [
  { "id": "U", "dreh": 0 },
  { "id": "V", "dreh": 0 },
  { "id": "W", "dreh": 0 },
  { "id": "X", "dreh": 0 }
]
```

---

# Bogen 20 — Der Fluss — Grundformen

**Motive:** RV_SPRING · RV_LAKE · RV_STRAIGHT · RV_CURVE

Die vier Karten, mit denen jede Flusspartie anfängt und aufhört.

### Referenzbilder

* **Bild 1:** `bogen20-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Auf diesem Bogen kommt **keine Straße und keine Stadt** vor, nur Fluss und Wiese. Image 2 hat keinen Fluss — sein Aussehen steht vollständig in der Stilbeschreibung.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: In der oberen Kartenhälfte eine Quelle: ein runder, in Gold gefasster Quelltopf aus hellem Stein, aus dem Wasser tritt. Von dort läuft ein lapisblaues Emailband mit silberweißen Wellenlinien senkrecht nach unten und tritt mittig an der Unterkante aus, 18 % der Kantenlänge breit, mit schmaler Goldfassung. An keiner anderen Kante tritt Wasser aus. Die übrige Fläche ist Wiese mit dichten Ranken, Blüten, drei Bäumen und einem goldenen Acker.

Oben rechts: Ein lapisblaues Emailband mit silberweißen Wellenlinien tritt mittig an der Oberkante ein, 18 % der Kantenlänge breit, mit schmaler Goldfassung, läuft senkrecht nach unten und weitet sich in der unteren Kartenhälfte zu einem runden, in Gold gefassten See mit hellblauem Grund. An keiner anderen Kante tritt Wasser aus. Ringsum Wiese mit dichten Ranken, Blüten, zwei Bäumen und einem goldenen Acker.

Unten links: Ein lapisblaues Emailband mit silberweißen Wellenlinien läuft senkrecht von der Mitte der Oberkante zur Mitte der Unterkante durch die ganze Karte, an beiden Kanten 18 % der Kantenlänge breit, mit schmaler Goldfassung. In der Kartenmitte darf es leicht schwingen, an beiden Kanten sitzt es exakt mittig. Links und rechts Wiese mit dichten Ranken, Blüten, je zwei Bäumen und je einem goldenen Acker.

Unten rechts: Ein lapisblaues Emailband mit silberweißen Wellenlinien tritt mittig an der Unterkante ein und schwingt in einem gleichmäßigen Viertelkreis nach links zur Mitte der linken Kante, an beiden Kanten 18 % der Kantenlänge breit, mit schmaler Goldfassung. Beide Austritte sitzen genau bei 50 % ihrer Kante. Die übrige Fläche ist Wiese mit dichten Ranken, Blüten, drei Bäumen und zwei goldenen Äckern in der oberen rechten Hälfte.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen20_generiert.png RV_SPRING RV_LAKE RV_STRAIGHT RV_CURVE
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen20_generiert.png": [
  { "id": "RV_SPRING", "dreh": 0 },
  { "id": "RV_LAKE", "dreh": 0 },
  { "id": "RV_STRAIGHT", "dreh": 0 },
  { "id": "RV_CURVE", "dreh": 0 }
]
```

---

# Bogen 21 — Der Fluss — mit Weg und Stadt

**Motive:** RV_BRIDGE · RV_ROADCURVE · RV_CITY · RV_CITY2

Die vier Flusskarten, auf denen noch etwas anderes liegt.

### Referenzbilder

* **Bild 1:** `bogen21-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Achte darauf, dass Fluss und Straße unterschiedlich breit sind: der Fluss 18 %, die Straße 11 %. Auf Bogen 21 liegen beide nebeneinander, der Unterschied muss sichtbar sein.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: Ein lapisblaues Emailband mit silberweißen Wellenlinien läuft senkrecht von der Mitte der Oberkante zur Mitte der Unterkante, 18 % der Kantenlänge breit, mit schmaler Goldfassung. Quer darüber läuft ein elfenbeinfarbenes, quer geripptes Wegband waagerecht von der Mitte der linken zur Mitte der rechten Kante, 11 % breit, mit Goldfassung. Wo beide sich kreuzen, überquert der Weg das Wasser auf einer steinernen Brücke mit zwei goldenen Rundbögen. In den vier Vierteln Wiese mit Ranken, Blüten und je einem Baum oder Acker.

Oben rechts: Ein lapisblaues Emailband mit silberweißen Wellenlinien tritt mittig an der Unterkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante, 18 % breit, mit Goldfassung. Getrennt davon tritt ein elfenbeinfarbenes, quer geripptes Wegband mittig an der Oberkante ein und schwingt in einem Viertelkreis nach rechts zur Mitte der rechten Kante, 11 % breit, mit Goldfassung. Weg und Fluss berühren einander nirgends. Dazwischen und ringsum Wiese mit dichten Ranken, Blüten, zwei Bäumen und einem Acker.

Unten links: Ein lapisblaues Emailband mit silberweißen Wellenlinien läuft senkrecht von der Mitte der Oberkante zur Mitte der Unterkante, 18 % breit, mit Goldfassung. Rechts davon liegt eine Stadt, die die gesamte rechte Kante von Ecke zu Ecke füllt: Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Die Stadt reicht nicht an den Fluss heran, dazwischen liegt ein Wiesenstreifen. Links vom Fluss Wiese mit Ranken, Blüten, zwei Bäumen und einem Acker.

Unten rechts: Ein lapisblaues Emailband mit silberweißen Wellenlinien läuft senkrecht von der Mitte der Oberkante zur Mitte der Unterkante, 18 % breit, mit Goldfassung. Links davon liegt eine Stadt, die die gesamte linke Kante von Ecke zu Ecke füllt: Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Die Stadt reicht nicht an den Fluss heran, dazwischen liegt ein Wiesenstreifen. Rechts vom Fluss Wiese mit Ranken, Blüten, zwei Bäumen und einem Acker.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen21_generiert.png RV_BRIDGE RV_ROADCURVE RV_CITY RV_CITY2
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen21_generiert.png": [
  { "id": "RV_BRIDGE", "dreh": 0 },
  { "id": "RV_ROADCURVE", "dreh": 0 },
  { "id": "RV_CITY", "dreh": 0 },
  { "id": "RV_CITY2", "dreh": 0 }
]
```

---

# Bogen 22 — Geschlossene Städte

**Motive:** EC_CATH · EC_CITY_FULL · EC_TRIPLE_CITY · EC_CITY_3SHIELD

Die vier Karten, die ganz oder fast ganz aus Stadt bestehen.

### Referenzbilder

* **Bild 1:** `bogen22-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Der Unterschied zwischen den beiden unteren Karten ist der wichtigste auf diesem Bogen: unten links sind es **drei getrennte** Städte, unten rechts ist es **eine einzige zusammenhängende**. Wird das verwechselt, stimmt die Wertung im Spiel nicht mehr.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: Die gesamte Karte ist Stadt. Alle vier Kanten sind von Ecke zu Ecke Stadt, es gibt keine Wiese und keinen Weg. Goldgrund mit fein punziertem Korn, dicht besetzt mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen. In der Kartenmitte steht eine Kathedrale: ein großes weißes Kirchenschiff mit steilem lapisblauem Ziegeldach, zwei flankierenden Türmen mit goldenen Kreuzen und einem runden Fenster mit rot-blauem Maßwerk über dem Portal.

Oben rechts: Die gesamte Karte ist Stadt. Alle vier Kanten sind von Ecke zu Ecke Stadt, es gibt keine Wiese und keinen Weg. Goldgrund mit fein punziertem Korn, dicht besetzt mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen. Keine Kathedrale. In der oberen rechten Hälfte hängt ein einzelner Wappenschild: ein spitz zulaufender lapisblauer Schild mit goldenem Querbalken und Goldrand.

Unten links: Drei voneinander vollständig getrennte Städte. Die erste füllt die Oberkante von Ecke zu Ecke, die zweite die rechte Kante von Ecke zu Ecke, die dritte die linke Kante von Ecke zu Ecke. Jede ist Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Zwischen je zwei Städten liegt deutlich sichtbar ein Wiesenstreifen, sie berühren einander nirgends, auch nicht in den Ecken. Die Unterkante ist über ihre volle Länge Wiese, und die Wiese in der Kartenmitte hängt mit der Unterkante zusammen. Auf der Wiese zwei Bäume und ein goldener Acker. Kein Wappenschild.

Unten rechts: Eine einzige zusammenhängende Stadt in U-Form. Sie füllt die Oberkante, die rechte Kante und die linke Kante jeweils von Ecke zu Ecke und ist über die obere Kartenhälfte durchgehend miteinander verbunden — es gibt keine Wiese zwischen den drei Kanten. Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. In der Stadt hängen zwei Wappenschilde: spitz zulaufende lapisblaue Schilde mit goldenem Querbalken und Goldrand. Nur an der Unterkante liegt ein Wiesenstreifen über die volle Kantenlänge, mit Ranken, Blüten und einem Baum.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen22_generiert.png EC_CATH EC_CITY_FULL EC_TRIPLE_CITY EC_CITY_3SHIELD
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen22_generiert.png": [
  { "id": "EC_CATH", "dreh": 0 },
  { "id": "EC_CITY_FULL", "dreh": 0 },
  { "id": "EC_TRIPLE_CITY", "dreh": 0 },
  { "id": "EC_CITY_3SHIELD", "dreh": 0 }
]
```

---

# Bogen 23 — Wirtshäuser und Doppelkurven

**Motive:** EC_INN_STRAIGHT · EC_INN_CURVE · EC_INN_TJUNC · EC_DOUBLE_CURVE

Reine Wegkarten der Erweiterung, ohne jede Stadt.

### Referenzbilder

* **Bild 1:** `bogen23-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Ein Wirtshaus ist immer dasselbe: ein kleines weißes Gebäude mit blauem Ziegeldach und dunkelroter Tür, unmittelbar am Weg, mit einem goldenen Wirtshausschild an einem geschmiedeten Ausleger, der über den Weg ragt. Auf diesem Bogen kommt **keine Stadt** vor.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: Ein elfenbeinfarbenes, quer geripptes Wegband läuft senkrecht mittig von der Oberkante zur Unterkante durch die ganze Karte, mit schmaler Goldfassung. Auf halber Höhe steht rechts am Weg ein Wirtshaus: weißes Gebäude, blaues Ziegeldach, dunkelrote Tür, goldenes Schild an geschmiedetem Ausleger über dem Weg. Links und rechts Wiese mit dichten Ranken, Blüten, zwei Bäumen und einem Acker.

Oben rechts: Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Unterkante ein und schwingt in einem gleichmäßigen Viertelkreis nach links zur Mitte der linken Kante, mit schmaler Goldfassung. Im Inneren des Bogens steht ein Wirtshaus: weißes Gebäude, blaues Ziegeldach, dunkelrote Tür, goldenes Schild an geschmiedetem Ausleger über dem Weg. Die übrige Fläche ist Wiese mit dichten Ranken, Blüten, zwei Bäumen und einem Acker.

Unten links: Drei elfenbeinfarbene, quer gerippte Wegbänder treffen sich in der Kartenmitte: eines von der Mitte der rechten Kante, eines von der Mitte der Unterkante, eines von der Mitte der linken Kante, alle gleich breit mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit strahlenförmiger Rippung und blauem Emailauge. Am unteren Arm steht ein Wirtshaus: weißes Gebäude, blaues Ziegeldach, dunkelrote Tür, goldenes Schild an geschmiedetem Ausleger. Die obere Kartenhälfte ist durchgehend Wiese; an der Oberkante tritt kein Weg aus.

Unten rechts: Zwei getrennte elfenbeinfarbene, quer gerippte Wegbänder, die einander nicht berühren. Das erste tritt mittig an der Oberkante ein und schwingt in einem Viertelkreis nach rechts zur Mitte der rechten Kante. Das zweite tritt mittig an der Unterkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante. Beide gleich breit mit Goldfassung. Kein Wirtshaus und keine Wegscheibe. Zwischen den beiden Kurven verläuft ein breites diagonales Wiesenband von links oben nach rechts unten mit Ranken, Blüten und zwei Bäumen; in den beiden abgetrennten Ecken je ein goldener Acker.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen23_generiert.png EC_INN_STRAIGHT EC_INN_CURVE EC_INN_TJUNC EC_DOUBLE_CURVE
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen23_generiert.png": [
  { "id": "EC_INN_STRAIGHT", "dreh": 0 },
  { "id": "EC_INN_CURVE", "dreh": 0 },
  { "id": "EC_INN_TJUNC", "dreh": 0 },
  { "id": "EC_DOUBLE_CURVE", "dreh": 0 }
]
```

---

# Bogen 24 — Stadt mit Weg

**Motive:** EC_DOUBLE_CURVE2 · EC_INN_CITYCURVE · EC_INN_CITYSTRAIGHT · EC_CITY_GATE

Vier Karten, auf denen eine Stadt an der Oberkante liegt und darunter ein Weg verläuft.

### Referenzbilder

* **Bild 1:** `bogen24-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Auf drei dieser Karten füllt die Stadt die **Oberkante ganz**, von Ecke zu Ecke. Sie darf nicht vor der Ecke aufhören — sonst passt sie an keine andere Stadtkante.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit vier verschiedenen Spielkarten in einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Jede Karte ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die vier Karten:

Oben links: Zwei getrennte elfenbeinfarbene, quer gerippte Wegbänder, die einander nicht berühren. Das erste tritt mittig an der Oberkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante. Das zweite tritt mittig an der rechten Kante ein und schwingt in einem Viertelkreis nach unten zur Mitte der Unterkante. Beide gleich breit mit Goldfassung. Keine Stadt, kein Wirtshaus, keine Wegscheibe. Zwischen den beiden Kurven verläuft ein breites diagonales Wiesenband von rechts oben nach links unten mit Ranken, Blüten und drei Bäumen; in den beiden abgetrennten Ecken je ein goldener Acker.

Oben rechts: Die Oberkante ist über ihre volle Länge Stadt, von Ecke zu Ecke: Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Darunter tritt ein elfenbeinfarbenes, quer geripptes Wegband mittig an der rechten Kante ein und schwingt in einem Viertelkreis nach unten zur Mitte der Unterkante, mit Goldfassung. Im Inneren des Bogens steht ein Wirtshaus: weißes Gebäude, blaues Ziegeldach, dunkelrote Tür, goldenes Schild an geschmiedetem Ausleger. Die linke Kante ist über ihre volle Länge Wiese. Auf der Wiese Ranken, Blüten, zwei Bäume und ein Acker.

Unten links: Die Oberkante ist über ihre volle Länge Stadt, von Ecke zu Ecke: Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Darunter läuft ein elfenbeinfarbenes, quer geripptes Wegband waagerecht von der Mitte der linken zur Mitte der rechten Kante quer durch die Karte, mit Goldfassung. Auf halber Strecke steht unterhalb des Weges ein Wirtshaus: weißes Gebäude, blaues Ziegeldach, dunkelrote Tür, goldenes Schild an geschmiedetem Ausleger über dem Weg. Die Unterkante ist über ihre volle Länge Wiese, mit Ranken, Blüten, zwei Bäumen und einem Acker.

Unten rechts: Die Oberkante ist über ihre volle Länge Stadt, von Ecke zu Ecke: Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. In der Mauer sitzt mittig ein Stadttor mit goldenem Rundbogen und dunkelroten Torflügeln. Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Unterkante ein, läuft senkrecht nach oben und endet am Stadttor; an der Oberkante tritt es nicht aus. Linke und rechte Kante sind über ihre volle Länge Wiese, mit Ranken, Blüten, zwei Bäumen und einem Acker.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen24_generiert.png EC_DOUBLE_CURVE2 EC_INN_CITYCURVE EC_INN_CITYSTRAIGHT EC_CITY_GATE
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen24_generiert.png": [
  { "id": "EC_DOUBLE_CURVE2", "dreh": 0 },
  { "id": "EC_INN_CITYCURVE", "dreh": 0 },
  { "id": "EC_INN_CITYSTRAIGHT", "dreh": 0 },
  { "id": "EC_CITY_GATE", "dreh": 0 }
]
```

---

# Bogen 25 — Stadt und Weg gemischt — drei Karten

**Motive:** EC_CITY_DIAG · EC_CITY_ROADPASS · EC_CROSS_CITY

Die letzten drei Kartenmotive mit Stadt und Weg. Dieser Bogen trägt nur drei Karten.

### Referenzbilder

* **Bild 1:** `bogen25-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

Das Feld **unten rechts bleibt leer und neutralgrau**. Male dort nichts hinein, auch keine vierte Karte und keine Verzierung.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Nur drei der vier Felder tragen eine Spielkarte: oben links, oben rechts und unten links. Das Feld unten rechts bleibt vollständig leer und neutralgrau, ohne jede Malerei. Jede der drei Karten ist ein randvoll bemaltes Quadrat: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die drei Karten:

Oben links: Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Oberkante ein und schwingt in einem Viertelkreis nach links zur Mitte der linken Kante, mit Goldfassung. Außerdem zwei voneinander vollständig getrennte Städte: die erste füllt die rechte Kante von Ecke zu Ecke, die zweite die Unterkante von Ecke zu Ecke. Beide sind Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. In der unteren rechten Ecke liegt zwischen ihnen deutlich sichtbar ein Wiesenstreifen; sie berühren einander nirgends. Zwischen Wegkurve und Städten Wiese mit Ranken, Blüten, zwei Bäumen und einem Acker.

Oben rechts: Zwei voneinander vollständig getrennte Städte: die erste füllt die Oberkante von Ecke zu Ecke, die zweite die Unterkante von Ecke zu Ecke. Beide sind Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. Zwischen ihnen bleibt die mittlere Kartenhälfte frei. Dort läuft ein elfenbeinfarbenes, quer geripptes Wegband waagerecht von der Mitte der linken zur Mitte der rechten Kante quer durch, mit Goldfassung. Ober- und unterhalb des Weges je ein schmaler Wiesenstreifen mit Ranken, Blüten und je einem Baum.

Unten links: Die Oberkante ist über ihre volle Länge Stadt, von Ecke zu Ecke: Goldgrund mit weißen Häusern, blauen Dächern und roten Türen, zum Land hin von einer goldenen Mauer mit quadratischen Zinnenmarken begrenzt. In der Stadt hängt ein Wappenschild: ein spitz zulaufender lapisblauer Schild mit goldenem Querbalken und Goldrand. Darunter treffen sich drei elfenbeinfarbene, quer gerippte Wegbänder in der Kartenmitte: eines von der Mitte der rechten Kante, eines von der Mitte der Unterkante, eines von der Mitte der linken Kante, alle gleich breit mit Goldfassung. Am Treffpunkt eine runde Goldscheibe mit strahlenförmiger Rippung und blauem Emailauge. Zwischen Stadt und Wegen Wiese mit Ranken, Blüten und zwei Bäumen.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen25_generiert.png EC_CITY_DIAG EC_CITY_ROADPASS EC_CROSS_CITY
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen25_generiert.png": [
  { "id": "EC_CITY_DIAG", "dreh": 0 },
  { "id": "EC_CITY_ROADPASS", "dreh": 0 },
  { "id": "EC_CROSS_CITY", "dreh": 0 },
  null
]
```

---

# Bogen 26 — Die beiden Klosterkarten — zwei Karten

**Motive:** RV_MON · EC_MON_ROAD2

Die letzten beiden Motive. Dieser Bogen trägt nur zwei Karten.

### Referenzbilder

* **Bild 1:** `bogen26-vorlage.png` — Inhalt und Geometrie. Referenzstärke **hoch**.
* **Bild 2:** `referenzplatte.png` — nur Material. Referenzstärke **niedrig**.

**Die Klostermauer darf nicht um die Karte herumlaufen.** Sie umschließt einen kompakten Hof mitten auf der Karte und lässt an allen vier Kanten Wiese frei. Genau dieser Fehler steckt in Image 2 — dort läuft die Mauer als Rahmen bis fast an den Rand, und wenn sich das fortsetzt, sieht das zusammengelegte Spielfeld aus wie ein Kachelgitter. Die gesamte untere Hälfte des Bogens bleibt leer und neutralgrau.

### Prompt — vollständig, zum Einfügen

```
Image 1 ist die Vorlage. Sie definiert Inhalt und Geometrie: welche Karte an welcher Position liegt, wo jeder Weg, jeder Fluss und jede Stadt an welcher Kante austritt, wie breit sie sind und wie sie innerhalb der Karte verlaufen. Halte dich exakt daran, Punkt für Punkt. Erfinde keine eigenen Radien und keine eigenen Breiten.

Image 2 ist AUSSCHLIESSLICH eine Materialprobe. Übernimm daraus die Farbigkeit, die Oberfläche, die Dichte des Rankenwerks und das Aussehen der Bänder und Bauten. Übernimm daraus NICHTS an Aufbau. Insbesondere hat Image 2 eine Klostermauer, die als Rahmen um die Karte herumläuft — so etwas darf auf keiner der hier beschriebenen Karten vorkommen, es macht aus dem zusammengelegten Spielfeld ein Kachelgitter.

Ein einzelnes quadratisches Bild mit einem 2×2-Raster, dazwischen ein schmaler neutralgrauer Steg. Nur die beiden oberen Felder tragen eine Spielkarte, oben links und oben rechts. Die gesamte untere Hälfte bleibt vollständig leer und neutralgrau, ohne jede Malerei. Beide Karten sind randvoll bemalte Quadrate: kein Zierrahmen, keine abgerundeten Ecken, kein Schlagschatten, die Malerei läuft bis an alle vier Kanten.

Stil: illuminierte Handschrift des 13. Jahrhunderts als Champlevé-Emailtafel, Limoges-Arbeit. Blattgoldgrund mit fein punziertem, gehämmertem Korn. Wiesen als tiefgrünes Email mit dicht eingelegten goldenen Ranken, winzigen weiß-rot-blauen Blüten und Bäumen als goldumrissene Bögen mit Goldperlen und dunkelrotem Stamm. Städte als Goldgrund mit weißen Häusern, blauen Ziegeldächern und dunkelroten Türen; Stadtmauern als Goldband mit quadratischen Zinnenmarken. Wege als elfenbeinfarbene, quer gerippte Bänder mit schmaler Goldfassung. Flüsse als lapisblaue Emailbänder mit silberweißen Wellenlinien und schmaler Goldfassung. Äcker als goldene Rechtecke mit geritzter Furche. Aufsicht, streng senkrecht von oben, keine Perspektive, kein Schattenwurf. Blattgold, Smaragdgrün, Lapisblau, Elfenbein, Zinnoberrot.

Maße, die genau eingehalten werden müssen — sie sind aus den vorhandenen Bögen gemessen, nicht geschätzt:
– Jeder Weg tritt mittig an seiner Kante aus, Mitte bei 50 % der Kantenlänge, Abweichung höchstens 1 %.
– Der elfenbeinfarbene Kern eines Weges ist 10,5 bis 11 % der Kantenlänge breit, mit der Goldfassung zusammen 15 bis 16 %.
– Jeder Fluss tritt mittig an seiner Kante aus, Mitte bei 50 %, und ist 18 bis 19 % der Kantenlänge breit.
– Eine Stadt füllt ihre Kante über die volle Länge, von Ecke zu Ecke.
– Diese Werte gelten an jeder Kante jeder Karte gleich. Ein Weg, der bei 44 % statt 50 % austritt oder 13 % statt 11 % breit ist, macht die Karte unbrauchbar: sie passt dann an keine andere.
– Die Wiese ist gleichmäßig dicht mit Ranken belegt, so dicht wie in Image 2. Keine leeren Grünflächen.
– Auf jeder Karte, die Wiese hat, stehen zwei bis vier Bäume und ein bis zwei goldene Äcker, über die Wiesenfläche verteilt, nicht an den Kanten geballt.

Die beiden Karten:

Oben links: Ein lapisblaues Emailband mit silberweißen Wellenlinien tritt mittig an der Unterkante ein und schwingt in einem gleichmäßigen Viertelkreis nach links zur Mitte der linken Kante, an beiden Kanten 18 % der Kantenlänge breit, mit schmaler Goldfassung. In der oberen rechten Hälfte, mit deutlichem Abstand zu allen vier Kanten, steht ein Kloster: ein weißes Kirchengebäude mit lapisblauem Ziegeldach, einem Turm mit goldenem Kreuz und dunkelroter Tür, umgeben von einer niedrigen goldenen Hofmauer, die einen kompakten Hof umschließt und nirgends an den Kartenrand reicht. Keine Straße. Ringsum Wiese mit dichten Ranken, Blüten, zwei Bäumen und einem Acker.

Oben rechts: In der Kartenmitte, mit deutlichem Abstand zu allen vier Kanten, steht ein Kloster: ein weißes Kirchengebäude mit lapisblauem Ziegeldach, einem Turm mit goldenem Kreuz und dunkelroter Tür, umgeben von einer niedrigen goldenen Hofmauer, die einen kompakten Hof umschließt und nirgends an den Kartenrand reicht. Ein elfenbeinfarbenes, quer geripptes Wegband tritt mittig an der Oberkante ein, läuft senkrecht nach unten und endet am Klostertor. Ein zweites, gleich breites Wegband tritt mittig an der Unterkante ein, läuft senkrecht nach oben und endet ebenfalls am Kloster. Beide Wege sind durch das Kloster voneinander getrennt und gehen nicht ineinander über. Linke und rechte Kante sind über ihre volle Länge Wiese, mit Ranken, Blüten, zwei Bäumen und einem Acker.
```

### Prüfen

```
node tools/bogen-pruefen.mjs bogen26_generiert.png RV_MON EC_MON_ROAD2
```

### Danach in `grafik/bogen-belegung.json`

```json
"bogen26_generiert.png": [
  { "id": "RV_MON", "dreh": 0 },
  { "id": "EC_MON_ROAD2", "dreh": 0 },
  null,
  null
]
```

---

## Wenn alle acht Bögen da sind

1. Dateien nach `grafik/`
2. Einträge in `grafik/bogen-belegung.json` (`null` für leere Quadranten)
3. `node tools/kacheln-schneiden.mjs`
4. Motiv-Kürzel in `js/ui/render/paintings.js` (Liste `GEMALT`) **und** in `sw.js`
5. `node tests/regeln.test.mjs` und die übrigen Suiten

Danach sind alle 49 Motive gemalt, und `tools/stadt-zu-wiese.mjs` wird nicht
mehr gebraucht — die vier Karten, die es gebaut hat, sind dann durch gemalte
ersetzt.
