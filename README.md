# Carcassonne – Mobile Edition 🧩

Das beliebte Legespiel als moderne **Web-App fürs Handy** – offline spielbar,
auf den Homescreen installierbar (PWA), komplett ohne Server.

## 📱 Direkt spielen

**➡️ https://alex1977-code.github.io/Carcasonne/**

Link am Handy öffnen → Browser-Menü → **„Zum Startbildschirm hinzufügen“**.
Danach startet das Spiel wie eine App im Vollbild. Jeder Push auf `main`
veröffentlicht automatisch die neueste Version (GitHub Actions → Pages);
installierte Geräte aktualisieren sich beim nächsten Öffnen von selbst.

> Privates Fan-Projekt. Alle Grafiken werden prozedural im Code gezeichnet,
> es werden keine Original-Assets verwendet. „Carcassonne“ ist ein Spiel von
> Klaus-Jürgen Wrede (Hans im Glück Verlag).

## ✨ Funktionen

- **Komplettes Basisspiel** – alle 72 Karten mit originalgetreuer Verteilung,
  Straßen-, Stadt-, Kloster- und Wiesenwertung
- **Erweiterungen** (einzeln zuschaltbar):
  - 🌊 **Der Fluss** – 12 Flusskarten als Spielstart (mit U-Turn-Regel)
  - 🏨 **Wirtshäuser & Kathedralen** – 18 Zusatzkarten, Wirtshäuser (Straßen
    zählen doppelt), Kathedralen (Städte ×3), **großer Meeple**
  - 👑 **König & Räuber** – Bonuspunkte für die größte Stadt und die längste Straße
- **Viel mehr Karten**: Kartensatz wählbar – Standard (72), Groß (144),
  **Riesig (288)** Basiskarten; aktive Erweiterungen zählen mehrfach mit
  (Riesig mit allem: über 400 Karten)
- **Mehrspieler**:
  - 2–6 Spieler am selben Gerät (Hotseat)
  - 🌐 **Online auf mehreren Geräten**: Raum erstellen, Code teilen,
    Mitspieler treten auf ihren Handys bei (WebRTC über PeerJS, kein eigener
    Server nötig; Codes mit „T“ verbinden zwei Tabs im selben Browser).
    Bricht ein Gast ab, übernimmt die KI seinen Platz.
  - freie Mischung aus Menschen und Computergegnern
- **Drei Computergegner-Stärken**: Bauer (leicht), Ritter (mittel),
  Baumeister (schwer, blockt und plant Wiesen)
- **Spielernamen-Eingabe**, Farbwahl je Spieler
- **Highscore-Liste** (lokal gespeichert, mit Datum und Spielmodus)
- **Optionen**: Soundeffekte an/aus, Musik an/aus, Platzierungs-Hinweise,
  Animationen
- **Sound & Musik** komplett im Code erzeugt (WebAudio) – jederzeit abschaltbar
- **Moderne Grafik**: prozedural gezeichnete Karten, Animationen, Punkte-Effekte
- **Autospeichern**: laufende Partie jederzeit unterbrechen und fortsetzen
- **Touch-Steuerung**: Ziehen = verschieben, Kneifen = zoomen, Tippen = legen

## 🚀 Lokal starten

Die App ist reines HTML/CSS/JavaScript ohne Build-Schritt:

```bash
# Beliebigen statischen Server im Projektordner starten, z. B.:
python3 -m http.server 8080
# dann http://localhost:8080 im Browser öffnen
```

## 🕹️ Kurzanleitung

1. Karte ziehen und an ein leuchtendes Feld legen (⟳ dreht die Karte,
   erneutes Tippen auf das Feld dreht ebenfalls).
2. Optional einen Meeple auf die neue Karte setzen (weiße Punkte antippen)
   oder „Ohne Meeple“ wählen. ↩ nimmt die Platzierung zurück.
3. Fertige Straßen, Städte und Klöster werden sofort gewertet,
   Wiesen erst am Spielende (3 Punkte je fertige Nachbarstadt).

## 🧪 Entwicklung

```bash
node tests/engine.test.mjs         # Regel-Engine (~1670 Prüfungen)
node tests/tiles-schema.test.mjs   # Kachelschema für den Renderer
```

Struktur:

| Pfad | Inhalt |
| --- | --- |
| `js/engine/tiles.js` | Kartendefinitionen (Basis, Fluss, W&K) und Deckaufbau |
| `js/engine/game.js` | Spielregeln: Legen, Verschmelzen (Union-Find), Wertung |
| `js/engine/ai.js` | Computergegner (3 Stärken, heuristische Bewertung) |
| `js/ui/render.js` | Prozedurale Kartengrafik und Board-Renderer (Canvas) |
| `js/ui/sound.js` | Soundeffekte und generative Musik (WebAudio) |
| `js/ui/net.js` | Online-Mehrspieler (PeerJS/WebRTC + BroadcastChannel) |
| `js/ui/main.js` | Bildschirme, Touch-Steuerung, Spielablauf, Speicher |
| `js/lib/peerjs.min.js` | PeerJS-Bibliothek (MIT-Lizenz, eingebettet) |
| `js/ui/render/` | Renderer-Fundament: Zufall, Kantenvertrag, Palette, Layer, Cache |
| `js/ui/render/fields.js` | Ackerparzellen – von beiden Renderern genutzt |
| `js/ui/render/adapt-tiles.js` | Adapter Engine-Motive → Renderer-Schema |
| `debug/gallery.html` | Prüfstand für die Kachelgrafik |
| `tests/` | Tests (Node, ohne Abhängigkeiten) |

Die Engine ist frei von DOM-Zugriffen und läuft auch in Node – dadurch sind
Regeln und KI automatisiert testbar.

## 🎨 Renderer-Prüfstand

Unter `debug/gallery.html` liegt ein Prüfstand für die Kachelgrafik: alle 49
Motive in drei Größen, vier Rotationen und sechs Varianten, mit Layer-Schaltern
und Überlagerungen für Kantenvertrag und Naht. Oben laufen die Abnahmekriterien
als Ampel mit (Kacheldaten, Determinismus, Farbprüfung, Kantenanschluss,
Kachelrand).

```bash
python3 -m http.server 8080    # dann http://localhost:8080/debug/gallery.html
```

Die Kacheldaten kommen dabei nicht aus einer zweiten Liste, sondern über
`js/ui/render/adapt-tiles.js` direkt aus der Engine (`js/engine/tiles.js`) –
`node tests/tiles-schema.test.mjs` prüft die Übersetzung und lässt
`validateTiles()` darüber laufen. `docs/SPEC-NACHTRAG.md` beschreibt die
Regeln, die dabei gelten.

Der Layer `fields` (Ackerparzellen) liegt in `js/ui/render/fields.js` und wird
von beiden Renderern genutzt: der Prüfstand registriert ihn als Layer, der
Spiel-Renderer ruft dieselbe Zeichenfunktion auf. Die Parzellen halten den
Kantenvertrag ein – 0,05 Wiesenstreifen zum Kachelrand, Sperrzonen an
Straßen-, Fluss- und Stadtkanten – und meiden im Spiel zusätzlich die exakte
Stadtfläche und die Wahrzeichen.
