# Nachtrag zum Art-Direction-Prompt – Abschnitt 10 bis 14

Dieser Nachtrag ersetzt bzw. präzisiert einzelne Regeln des Hauptdokuments.
Bei Widerspruch gilt der Nachtrag.

---

## 10. Determinismus, Varianten und Cache (ersetzt §1.1 und §1.4)

### 10.1 Variantenpool statt Instanz-Seed

Der Instanz-Seed aus §1.1 und der Cache-Key aus §1.4 schließen sich gegenseitig aus.
Auflösung: **jedes Kachelmotiv hat genau `VARIANT_COUNT = 6` visuelle Varianten.**

```
variante   = hash(tileInstanceId) % 6
seed       = hash(tileTypeId + "#" + variante)
cacheKey   = tileTypeId | variante | rotation | lod
```

- Zwei gleiche Motive nebeneinander zeigen mit p = 5/6 unterschiedliche Dekoration.
  Das genügt für Abnahmekriterium 2.
- Der Cache bleibt endlich: 49 × 6 × 4 × 3 = 3.528 mögliche Einträge, davon im
  Spiel typisch < 400 belegt.
- Determinismus über Sitzungen und Mitspieler bleibt unangetastet, weil
  `tileInstanceId` aus dem Spielzustand kommt, nicht aus der Renderreihenfolge.

### 10.2 Substreams pro Layer (neu)

Jeder Layer zieht aus einem **eigenen, aus dem Kachel-Seed abgeleiteten Strom**:

```
rngFor(layer) = mulberry32(hash(seed + ":" + layerName))
```

Grund: ohne Substreams verschiebt jede spätere Änderung an einem Layer alle
folgenden Zufallszahlen. Ein zusätzlicher Busch in Layer „Props" würde sonst das
komplette Dorf umbauen. Mit Substreams bleiben bereits abgenommene Layer stabil,
während an späteren weitergearbeitet wird.

### 10.3 Cache-Budget

- **LRU** mit harter Obergrenze (Default 512 Einträge), Verdrängung nach letzter Nutzung.
- Pro Frame maximal **2 Kachel-Renderings**. Der Rest wartet; solange wird die
  nächstkleinere bereits vorhandene LOD-Stufe hochskaliert angezeigt.
- Während einer aktiven Pinch-/Zoom-Geste wird **nichts** neu gerendert.
- Beim Spielstart nur LOD `small` vorwärmen.

### 10.4 Rotation wird gerendert, nicht transformiert

Die vier Rotationen dürfen **nicht** per `ctx.rotate()` aus einem Bitmap geblittet
werden. Das Licht kommt fest aus 315° (§2); ein gedrehtes Bitmap dreht Schlagschatten,
Lichtkanten und Rim-Light mit und verletzt Abnahmekriterium „alle Schatten zeigen in
dieselbe Richtung". Rotiert wird die **Geometrie vor dem Zeichnen**, das Licht bleibt
im Kachel-Koordinatensystem konstant.

---

## 11. Kantenvertrag, präzisiert (ersetzt §1.2)

### 11.1 Sperrzone ist kantentyp- und objektklassenabhängig

Die Sperrzone ist eine **Halbscheibe mit Radius 0,22 um die Kantenmitte**, gemessen
in normierten Kachelkoordinaten. Was sie sperrt, hängt vom Kantentyp ab:

| Kantentyp | Gebäude | Wahrzeichen | Props (Bäume, Zäune, Karren) | Ackerparzellen |
|---|---|---|---|---|
| Straße | gesperrt | gesperrt | gesperrt | gesperrt |
| Fluss | gesperrt | gesperrt | gesperrt | gesperrt |
| Stadt | **erlaubt bis 0,02 an die Kante** | gesperrt | gesperrt | gesperrt |
| Wiese | erlaubt | erlaubt | erlaubt | gesperrt bis 0,05 ab Rand |

Damit lösen sich §1.2 und §3 A2 („Randreihe bis 0,02") auf: an Stadtkanten ist die
Stadtfläche selbst der Anschluss, Häuser dürfen darauf bis dicht an die Kante stehen.
Gesperrt bleiben dort nur Objekte, die die Silhouette über die Kante hinaus brechen
würden – Bäume, Zäune, Fahnenmasten.

### 11.2 Randstreifen der Wiese

Ackerparzellen enden generell 0,05 vor dem Kachelrand (§4: „ein Wiesenstreifen bleibt
außen stehen"), zusätzlich 0,04 Abstand zur Straßenkante.

### 11.3 Versetzte Details werden zur Kante hin ausgeblendet

Ein Schlagschatten mit festem Versatz wandert an der Kachelkante über die Naht.
Der Nachbar versetzt seinen Schatten in dieselbe Richtung – also fehlt der Schatten
auf der einen Seite der Naht und liegt auf der anderen doppelt. An durchgehenden
Straßen ergibt das einen sichtbaren Versatz.

Deshalb: **jeder Versatz wird mit einem Faktor multipliziert, der von 1 in der
Kachelmitte auf 0 am Rand läuft** (Übergangsbreite 0,20). Die Lichtrichtung bleibt
eindeutig, weil sie dort voll wirkt, wo man sie sieht.

Dasselbe gilt für Details mit eigener Phase – Spurrillen, Wellenlinien, Schilf:
sie enden 0,17 vor der Kante. Ihre Wellenphase kann der Nachbar nicht treffen.

### 11.4 Randrelief bricht an Anschlüssen ab

Das Kachelrand-Relief aus §7/16 darf nicht über einen Anschluss laufen. Sonst zieht
sich durch jede zusammengesetzte Stadt und über jede durchgehende Straße eine helle
oder dunkle Linie – genau das Gitter, das §7/16 ausschließt.

- Stadtkante: kein Relief
- Straßen-/Flusskante: Relief mit Lücke über der Anschlussbreite
- Wiesenkante: Relief durchgehend

### 11.5 Nahtfreiheit

Kacheln werden mit **1 Gerätepixel Bleed** gerendert und auf ganze Gerätepixel
gerundet positioniert. Ohne das entstehen bei nicht-ganzzahligen Kachelgrößen
Haarrisse zwischen den Kacheln, die kein Kantenvertrag verhindern kann.

---

## 12. Maßeinheiten: normiert vs. Gerätepixel (präzisiert §1.3)

§1.3 verbietet feste Pixelwerte, §6 und §7/16 verlangen 1-px-Konturen und
0,6-px-Furchen. Beides ist richtig, betrifft aber zwei verschiedene Klassen:

- **Flächen und Positionen:** immer normiert 0…1. Nie Pixel.
- **Haarlinien** (Meeple-Kontur, Kachelrand-Relief, Furchen, Fenstersprossen):
  in **Gerätepixeln**, umgerechnet über den aktuellen Transform:

  ```js
  hairline(ctx, devicePx) → devicePx / scaleOf(ctx.getTransform())
  ```

  Sonst ist die Meeple-Kontur bei 48 px Kachelgröße dreieinhalb Mal so fett wie bei 160 px.

---

## 13. LOD-Stufen (präzisiert §1.5)

| Stufe | aktiv ab | zurück unter | Renderauflösung |
|---|---|---|---|
| `small` | – | 54 px | 60 px |
| `normal` | 60 px | 117 px | 130 px |
| `large` | 130 px | – | 260 px (Deckel) |

- **Hysterese** von 10 %: ohne sie flackert die Stufe beim Pinch-Zoom im Grenzbereich.
- Jede Stufe wird an ihrer **Obergrenze** gecacht, sodass im Betrieb nur
  herunterskaliert wird. Hochskalieren weicht Kanten auf, Herunterskalieren nicht.

---

## 14. Was pro Kachel entschieden wird – und was nicht

### 14.1 Stadtweite Regeln entfallen

„max. 1 Markthalle pro Großstadt" und „max. 1 Kirchturm pro Stadt" (§3 A1) sind in
einem per-Kachel deterministischen Renderer nicht durchsetzbar: die Stadt entsteht
erst beim Anlegen, die Kachel wird isoliert gerendert und gecacht. Ersetzt durch
Wahrscheinlichkeiten pro Kachel:

- Markthalle / Bürgerhaus: p = 0,10, nur auf Kacheln mit ≥ 3 Stadtkanten
- Kirchturm: p = 0,15, nur auf Kacheln mit ≥ 2 Stadtkanten
- Wehrturm: nur auf Kacheln mit Wappen oder Torkante (unverändert)

Optisch ergibt das dasselbe Bild, ohne Re-Render bei Stadtvereinigung.

### 14.2 Statische und dynamische Ebene sind getrennt

Der Kachel-Cache enthält **ausschließlich** die Layer aus §1.6.
Alles Zustandsabhängige wird jeden Frame frisch darüber gezeichnet:

- Meeples und große Meeples
- Ablage-Vorschau, Legalitäts-Glow, pulsierender Rand
- aufsteigende Punktezahlen
- Kachelschatten und Hover-Lichtkegel

Das ist der Grund, warum der Cache klein bleiben darf: er kennt keinen Spielzustand.

### 14.3 Abstandsmaß bei der Hausplatzierung (präzisiert §3 A2)

Der Poisson-Mindestabstand 0,06 ist als Bounding-Box-Abstand zu lesen, nicht als
Mittelpunktsabstand – bei 0,12–0,20 breiten Häusern würden Mittelpunkte im Abstand
0,06 zu 60 % überlappen statt zu 10 %:

```
minDist(a, b) = 0.90 × (radius(a) + radius(b))
```

Der Faktor 0,90 erzeugt genau die gewünschte Überlappung bis 10 %. Er gilt **nur**
entlang einer Gassenachse (Reihenbebauung); quer dazu gilt Faktor 1,15, damit
Häuserzeilen nicht ineinanderlaufen.

---

## 15. Spielerfarben (fehlten im Hauptdokument)

Nicht nach Augenmaß gewählt, sondern optimiert: maximiert wurde der kleinste
paarweise CIELAB-Abstand über die drei Sichtweisen normal / Deuteranopie /
Protanopie, bei festgehaltenen Farbtonbereichen, damit Rot noch nach Rot aussieht.

| Spieler | Hex |
|---|---|
| Rot | `#D6321A` |
| Gelb | `#F5D739` |
| Grün | `#296345` |
| Blau | `#196CCD` |
| Grau | `#A3ABB7` |
| Schwarz | `#16191B` |
| Violett (Ersatz) | `#4A356E` |

Gemessen: kleinster paarweiser Abstand ΔE 29,5 (Grün/Schwarz unter Deuteranopie),
kleinster Abstand zu einem Untergrund ΔE 21,1. Grenzwerte 25 bzw. 20 sind damit
eingehalten. Violett hält die Grenzwerte auch **zusätzlich** zu allen sechs – ein
Siebener-Satz wäre möglich.

### 15.1 Trennring statt verbogener Füllfarbe

Grün auf Wiese und Gelb auf Getreidefeld sind mit reiner Füllfarbe nie sauber zu
lösen; man müsste eine der beiden Farben ruinieren. §6 sieht dafür bereits Kontur
und Halo vor. Verallgemeinert:

> Der Meeple bekommt einen Trennring, dessen Farbe pro Untergrund gewählt wird –
> dunkel (Füllfarbe 55 % Richtung `#101014`) oder hell (65 % Richtung Weiß),
> je nachdem, was gegen diesen Untergrund den größeren Abstand hat.

Gemessen liegt der schwächste Trennring bei ΔE 32. Die Füllfarbe bleibt dabei
unangetastet, sie trägt weiterhin die Unterscheidung **zwischen** den Spielern.

## 16. Ergänzung der Abnahmekriterien (§8)

- [ ] Cache-Obergrenze wird unter Spielbedingungen nicht überschritten (Anzeige in der Galerie).
- [ ] Beim Zoomen springt keine Kachel zwischen zwei LOD-Stufen hin und her.
- [ ] Zwischen zwei benachbarten Kacheln ist bei keinem Zoomfaktor eine Naht sichtbar.
- [ ] Alle Spielerfarben bestehen die maschinelle Farbprüfung inklusive beider Simulationen.
- [ ] Ein Layer lässt sich einzeln abschalten, ohne dass sich die anderen verändern
      (Substream-Test).
- [ ] Kein **Dekorationsobjekt** wird vom Kachelrand beschnitten. Grundflächen dürfen
      und sollen über den Rand laufen – dafür ist der Clip da. Geprüft wird deshalb
      nur mit den Layern `buildings`, `landmarks`, `props`, `coatOfArms`.
