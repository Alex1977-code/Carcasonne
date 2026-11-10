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

## Der Randvertrag regelt die Naht, nicht das Aussehen

Gemeldet als „wege sehen unterschiedlich aus", und der Einwand stimmt. Der
Vertrag sagt, wo ein Weg austritt und wie breit das Band ist. Was *im* Band
gemalt ist, sagt er nicht — und genau daran laufen die Lieferungen
auseinander.

    node tools/wege-vergleichen.mjs

Der ununterbrochene helle Streifen macht zwischen **71 %** (K, ein glatter
Elfenbeinstreifen mit dünnem Goldrand) und **21 %** (EC_CITY_ROADPASS, ein
schmaler Cremestreifen in dichtem Goldgitter) des Bandes aus. Stufenlos
dazwischen alles andere. Die Sättigung läuft von 17 % (EC_INN_STRAIGHT,
fast weiß) bis 34 % (RV_BRIDGE, warmes Creme). Jede dieser Karten hält den
Vertrag; nebeneinandergelegt sehen sie nach zwei Spielen aus.

Zwei Werkzeuge, zwei Absichten — die Zahlen widersprechen sich nicht,
sie messen Verschiedenes:

* `karten-pruefen.mjs` überbrückt beim Messen Lücken bis 2 %, weil sonst
  Goldornament im Weg die Karte zu Unrecht als zu schmal meldet. Für die
  Naht ist das richtig.
* `wege-vergleichen.mjs` überbrückt nichts. Der Unterschied zwischen beiden
  Zahlen **ist** die Ornamentdichte.

Beide messen nur bis 5 % Tiefe. Tiefer geht es nicht: die Messung läuft
senkrecht zur Kante, und ein gekrümmter Weg verlässt diese Senkrechte nach
wenigen Prozent. Ein Entwurf, der bis 22 % maß, meldete für P einen Schwund
von −768 %. Was ein Weg in der Kartenmitte tut, zeigt nur der Kontaktbogen.

Die Breite des hellen Kerns ist seit diesem Befund eine **Beanstandung**,
keine Anmerkung mehr. Vorher stand im Code, ein schmaler Kern sei
„Geschmackssache" — das war falsch.

## Jeden neuen Bogen erst messen

    node tools/bogen-pruefen.mjs <bild.png> U V W X

Meldet je Karte die tatsächliche Kantenfolge, ob sie zum genannten Motiv
passt (notfalls gedreht), und für jeden Weg und Fluss die Lage und Breite
an der Kante. Beanstandungen gehen mit Rückgabewert 1 raus.

**Nie nach Augenschein entscheiden.** Ein Weg, der bei 44 % statt 50 %
austritt, sieht in der Vorschau tadellos aus. Von den 40 Übergängen der
ersten Lieferung 07–14 lagen 24 daneben, und im Bild war keiner davon
aufgefallen.

## Einzelkarten statt Bögen

Kommt die Lieferung als **eine Datei je Motiv** statt als 2×2-Bogen, gilt
derselbe Ablauf mit anderen Werkzeugen:

    node tools/karten-pruefen.mjs grafik/*.png      # messen
    node tools/karten-einbauen.mjs grafik/*.png     # zuschneiden, 512 px, WebP
    node tools/karten-fluchten.mjs --probe          # Versatz rechnen
    node tools/karten-einbauen.mjs grafik/*.png     # versetzt neu zuschneiden
    node tools/karten-fluchten.mjs                  # Karten ohne Original
    node tools/karten-pruefen.mjs grafik/karten/*.webp   # danach noch einmal
    node tools/karten-wiesen-pruefen.mjs                 # das Innere gegen die Daten

Das Motiv kommt aus dem Dateinamen: `EC_CATH.png` ergibt EC_CATH,
`U_strasse-gerade.png` ergibt U. Nach dem Einbau noch einmal messen — der
Zuschnitt verschiebt die Maße geringfügig.

Drei Dinge, die dabei aufgefallen sind und wiederkommen werden:

* **Verzogene Karten.** Manche Lieferungen sind keine flachen Quadrate,
  sondern gewölbte Objekte mit grauem Hintergrund in den Ecken. Am
  Kontaktbogen sofort zu sehen, in der Einzelansicht leicht zu übersehen.
  Die gehören neu gemalt, nicht beschnitten.
* **Abgerundete Ecken.** Ein grauer Zwickel in jeder Ecke, den die
  zeilenweise Randsuche nicht findet, weil sie nur die mittleren achtzig
  Prozent jeder Kante abtastet. `karten-einbauen.mjs` tastet deshalb
  zusätzlich diagonal von den Ecken, gedeckelt bei 2 %.
* **Goldene Wege.** Wo der Weg statt Elfenbein ein warmes Creme ist, kippt
  er im Klassifikator stellenweise nach Stadt, und dann meldet das
  Werkzeug „kein Weg an der Kante". Widerspricht eine einzelne Kante dem
  Bild, ist es meistens das. Die Schwelle steht in `karten-pruefen.mjs`
  bei einer Sättigung von 0,45.

## Die Kantenfolge sagt nichts über das Innere

G (eine Stadt, die von Nord nach Süd durchgeht) und H (zwei getrennte
Stadtkappen) haben dieselbe Kantenfolge, nur um neunzig Grad versetzt.
Die beiden Bilder waren vertauscht. `karten-pruefen.mjs` vergleicht die
Kanten „notfalls gedreht" und meldete beide als richtig.

Im Spiel hieß das: H, dreimal im Stapel, zeigte ein durchgehendes
Stadtband, während die Regeln zwei Kappen sahen. Wer eine Kappe schloss,
bekam Punkte, und die gemalte Stadt lief sichtbar weiter. Das wurde
zweimal gemeldet, und zweimal habe ich in den Regeln gesucht – 93 000
Wertungen nachgerechnet, alle richtig – statt im Bild. Einmal habe ich
sogar eine Erklärung geliefert, die nicht stimmte (Motiv N trage zwei
Städte; es trägt eine).

Die Lehre: **meldet jemand, dass Bild und Wertung auseinanderlaufen, erst
das Bild gegen die Daten prüfen**, dann die Regeln.

    node tools/karten-wiesen-pruefen.mjs
    node tools/karten-wiesen-pruefen.mjs -v A B    # jeden Setzpunkt zeigen

Das Werkzeug flutet das Grün und vergleicht, welche Halbkanten im Bild
zur selben Wiese gehören, mit `field.h` aus den Motivdaten. Eine Stadt,
die im Bild durchgeht und in den Daten nicht, teilt die Wiesen anders und
fällt auf. Dazu prüft es, was unter jedem Setzpunkt liegt: auf O und P
stand der Wegelagerer zu 0 % auf der Straße.

Was es nicht kann: ein dünnes Goldband von einer Ornamentranke
unterscheiden. Die Klostermauer auf EC_MON_ROAD2 überbrückt es deshalb,
und die Karte steht mit Begründung in der Liste `BEKANNT`.

## Fluchten: die halbe Handbreit, die man sieht

Der Randvertrag verlangt 50 %, geliefert wird 49 bis 53,6 %. Jede einzelne
Karte besteht die Prüfung, und trotzdem springt die Straße an jeder Naht –
gemessen bis zu 4,6 % der Kantenlänge, auf einem Telefon rund zehn Punkte.
Das fällt beim Spielen sofort auf und in der Einzelansicht überhaupt nicht.

Neu malen muss man dafür nichts. Sitzt ein Weg an der Nordkante bei 51,5 %,
ist die ganze Karte um 1,5 % zu weit rechts, und ein Versatz bringt ihn in
die Mitte. `tools/karten-fluchten.mjs` rechnet das aus; angewendet wird es
beim Zuschneiden, damit am Rand kein Streifen frei wird.

Drei Dinge, über die ich dabei gestolpert bin:

* **Der Versatz muss sich aufsummieren.** `grafik/versatz.json` hält den
  Gesamtwert, nicht den Rest der letzten Messung – `karten-einbauen.mjs`
  schneidet immer aus dem unversehrten Original.
* **Erst den Mittelpunkt, dann die Größe.** Nimmt man das größte Quadrat und
  verschiebt es danach, liegt es schon am Rand an und kann sich nicht mehr
  bewegen.
* **Eckabzug je Ecke.** Der größte Wert für alle vier Seiten frisst bei einer
  einzigen grauen Ecke die Stadt am gegenüberliegenden Rand weg.

Flüsse werden gemessen, aber nicht verschoben: ihre breiten steinernen Ufer
lassen die Messung um mehr als einen Punkt springen, und ein Versatz daraus
macht die Karte schlechter statt besser.

## Figuren und Tischplatte: dieselbe Regel, andere Werkzeuge

Für die fotografierten Spielfiguren und die Tischplatte gilt der Ablauf der
Karten unverändert — erst messen, dann einbauen, danach noch einmal messen:

    node tools/tisch-pruefen.mjs   grafik/tischplatte.png
    node tools/tisch-einbauen.mjs  grafik/tischplatte.png
    node tools/figuren-pruefen.mjs grafik/figuren.png --kontakt
    node tools/figuren-einbauen.mjs grafik/figuren.png
    node tools/figuren-pruefen.mjs grafik/figuren/*.webp

Vier Dinge aus der ersten Lieferung, die wiederkommen werden:

* **Das Schachbrett ist gemalt.** „Durchsichtiger Hintergrund" kam als
  RGB-Datei ohne Alphakanal, mit dem Karomuster als Pixel darin (Periode
  32 px, gemessen). Es ist streng regelmäßig und lässt sich aus dem
  Bildrand lernen und abziehen; ein fester Weißwert verschluckt die graue
  Figur.
* **Der Schatten sperrt die Flutfüllung.** Unter den Figuren liegt ein
  schwacher Schatten. Wer die Flut schon bei einer Spur Deckung anhalten
  lässt, bekommt eine Sperre quer durchs Bild, und alles darüber gilt als
  Loch in der Figur — die Ausschnitte liefen bis zur Bildunterkante. Erst
  ab halber Deckung sperren.
* **Die Naht ist die harte Bedingung, nicht das Aussehen.** Die Tischplatte
  wird gekachelt; aus einer Naht wird ein Linienraster über den ganzen
  Bildschirm. Gemessen wird nicht absolut, sondern gegen das Grundrauschen
  der Textur selbst: die Lieferung sprang oben/unten um das 2,5-fache,
  nach dem Überblenden um das 1,1-fache.
* **Die gelieferten Farben ersetzen die Palette nicht.** Grün wich um
  ΔE 40 ab, Violett um 18, und untereinander hielten sie den Abstand
  nicht mehr: Rot/Grün ΔE 16,7 bei einer Grenze von 25, Grün auf der
  Wiese 9,2. Übernommen wird deshalb nur das Relief; die Farbe kommt aus
  PLAYER_PALETTE, und der Mittelwert wird nachgeregelt, bis er sitzt.
  Danach ist das schwächste Paar Grün/Schwarz mit ΔE 30.

Der Kasten ist eine Verabredung zwischen Werkzeug und Renderer:
`FOTO_KASTEN` 140 Einheiten, der Umriss (0…100) sitzt darin bei 20…120.
Der Rand von 20 ist gemessen — die Scheibe ragt um gut ein Achtel der
Figurenhöhe über die Vorderfläche hinaus, und mit dem Rand 10 der
gezeichneten Figur wurden die Füße abgeschnitten.

### Durchsicht: die Grenze liegt nicht bei der Deckung

„Durchsichtig wie buntes Glas" scheitert an einer Zahl, wenn man es als
eine Zahl behandelt. Gemessen über jeden Untergrund, für Normalsicht,
Deuteranopie und Protanopie:

| Modell | Grenze |
|---|---|
| gleichmäßige Deckung | 78 % |
| über die eigene Helligkeit verteilt | 70 % |
| Untergrundhelligkeit durchlassen, Farbe behalten | 90 % |

Das letzte klingt am physikalischsten und ist das schlechteste — Grün und
Schwarz unterscheiden sich gerade über die Helligkeit. Und 22 bis 30 %
Durchsicht sieht man kaum.

Die Grenze kommt immer vom selben Paar, Grün/Rot auf der Wiese. Sie ist
keine Eigenschaft der Durchsicht, sondern der Frage, **woran man die Figur
erkennt**. Solange das die Füllfläche ist, deckelt der Farbabstand die
Durchsicht — beliebig, in jedem Modell.

Deshalb verlagert: Körper auf 45 % in den dunklen Flächen (ΔE 19,7, unter
der Grenze — gewollt), und ein deckender Saum in der reinen Spielerfarbe
trägt die Erkennbarkeit. Dessen Paare sind die Paare der Palette selbst.
Bleiverglasung arbeitet genauso: die Scheibe ist durchsichtig, die Fassung
trägt die Zeichnung.

Verteilt wird die Deckung über die eigene Helligkeit der Figur — Glanzlicht
ist Licht von der Oberfläche und dort undurchsichtig, in den dunklen
Flächen sieht man ins Material. Normiert je Figur an ihren eigenen
Perzentilen, sonst gilt die schwarze Figur durchweg als dunkel und
verschwindet.

Was das Werkzeug **nicht** kann: aus einem Bild Dicke und Blickwinkel
trennen. Die sichtbare Seitenwand misst 12,2 % der Höhe; das ist entweder
eine dünnere Scheibe oder ein flacherer Blick. Und die Überdeckung mit
`MEEPLE_PATH` (80 %) mischt echte Formabweichung mit der Seitenwand, die
ein flacher Umriss nie abdeckt. Beides steht deshalb als Anmerkung da,
nicht als Beanstandung.

## Bedienung und Layout: nachstellen, nicht ansehen

Die Suiten unter `tests/` prüfen die Regeln, und die hielten: 2 560
Partien, 93 358 Wertungen, keine falsch. Die Fehler saßen dort, wo der
Browser mitspielt, und dafür gibt es zwei Werkzeuge:

    node tools/bedienung-pruefen.mjs     # 40 Prüfungen, Telefon mit Berührung
    node tools/layout-pruefen.mjs        # hoch, quer, klein – je sechs Spieler
    node tools/layout-pruefen.mjs --bilder=/tmp/lay

Beide laufen nicht in der CI (kein Browser). Vor einer Änderung an
`js/ui/main.js`, `js/ui/render.js` oder `css/style.css` von Hand.

Fünf Dinge, die dabei herausgekommen sind und wiederkommen werden:

* **„Welcher Bildschirm" ist nicht „welche Partie".** Verspätete Schritte
  (die Pause vor einem KI-Zug, die Fanfare vor der Abrechnung) fragten, ob
  gerade das Spiel zu sehen ist. Wer während eines KI-Zugs in die Optionen
  ging, hielt die Partie für immer an. Gefragt wird jetzt nach der
  Partie-Nummer (`partie`, `spaeter()`).
* **`getBoundingClientRect()` misst mit Transformation.** Der
  Spielbildschirm blendet mit `scale(1.015)` ein, und genau dann wurde die
  Zeichenfläche vermessen: 798 × 1730 statt 786 × 1704, für die ganze
  Partie. 19 von 72 Gefolgsleuten landeten auf dem falschen Gebiet.
  Größen kommen aus `clientWidth`/`clientHeight` (`BoardView.groesse()`).
* **Ein Tipp trifft, was *danach* unter dem Finger liegt.** Auf einem
  Berührbildschirm wird der Klick erst nach dem Loslassen zugestellt. Ein
  Knopf, der durch denselben Tipp erscheint, bekommt ihn ab. Deshalb
  `zeige()`: 350 ms nach dem Erscheinen nimmt ein Knopf nichts an.
* **Ein Spielstand ist eine Zugfolge.** Beim Laden wird nachgespielt.
  Jede Regel, die strenger wird, macht alte Spielstände unladbar – so
  geschehen mit der Flussregel, einen Merge lang. Deshalb trägt jede
  Partie ihren `regelstand` und behält ihn. **Wer eine Regel ändert,
  erhöht `REGELSTAND` und lässt die alte unter der alten Nummer gelten.**
* **Der Speicher gehört nicht uns allein.** Was in `localStorage` steht,
  hat irgendeine frühere Fassung geschrieben. Jeder Eintrag wird beim
  Lesen geprüft (`ladeSetup`, `ladeScores`, `istObjekt`); ein Eintrag der
  falschen Art hat vorher den Start der App abgebrochen.

Eine Beobachtung, die **nicht** behoben ist, weil sie sich nur in der
Prüfumgebung messen lässt: wird ein Kachel-Bitmap auf die Hälfte oder
weniger verkleinert gezeichnet, kostet jede Karte dort 0,85 ms statt
0,002 – bei Maßstab 130 sind das 28 ms je Bild, bei 131 nichts. Die
Prüfumgebung rechnet ohne Grafikkarte; ob ein Telefon dasselbe tut, weiß
ich nicht. Ruckelt das Brett am Gerät bei mittlerem Zoom, ist das der
erste Verdacht (`lodFor(s * dpr)` wählt bei dpr 2 ein doppelt so großes
Bitmap wie nötig).

## Neue Bögen einbauen

1. Datei nach `grafik/`
2. Eintrag in `grafik/bogen-belegung.json` (`null` für Quadranten, die nicht
   übernommen werden)
3. `node tools/kacheln-schneiden.mjs`
4. Motiv-Kürzel in `js/ui/render/paintings.js` (Liste `GEMALT`) **und** in
   `sw.js` — ohne beides bleibt es bei der gezeichneten Karte
5. `node tools/karten-wiesen-pruefen.mjs`
6. `node tools/sw-stand.mjs` — sonst kommt die Änderung auf keinem Gerät an
7. `node tests/regeln.test.mjs` und die übrigen Suiten

## Jede Änderung an ausgelieferten Dateien: `sw-stand`

    node tools/sw-stand.mjs       # als letzter Schritt vor dem Commit
    node tools/sw-pruefen.mjs     # nach Änderungen an sw.js selbst

Der Service Worker liefert das Spiel aus einem Speicher, der je Stand
einmal vollständig gefüllt wird. Dass es einen neuen Stand gibt, merkt der
Browser an genau einer Sache: `sw.js` hat sich geändert. In ihr steht
deshalb eine Prüfsumme über alle ausgelieferten Dateien; `sw-stand.mjs`
rechnet sie neu und erhöht die Nummer, `tests/sw.test.mjs` prüft sie in
der CI. Vergessen fällt damit vor dem Merge auf – am Telefon hieße es,
dass die Korrektur nie ankommt.

Warum nicht mehr „Netz zuerst": das hielt das Spiel aktuell, mischte aber.
Kam nach einer neuen Fassung eine einzige Datei nicht binnen drei
Sekunden, lief die neue `main.js` gegen die alte `render.js`; fehlte dort
ein importierter Name, startete die App nicht – und weil die neuen Dateien
einzeln in den Speicher geschrieben wurden, auch ohne Netz nicht.
`sw-pruefen.mjs` stellt das mit zwei Fassungen und einem Server nach, der
hängen, scheitern und ausfallen kann.

Aktuell bleibt das Spiel trotzdem: beim Öffnen wird der neue Stand im
Hintergrund vollständig geholt, übernimmt, und die Seite lädt sich neu,
sobald sie im Hauptmenü steht. Gemessen 3,1 s nach dem Öffnen. Mitten in
einer Partie wird nicht neu geladen.

Zwei Dinge, die dabei falsch waren und nicht wiederkommen dürfen:

* **Aufräumen nur mit Vorsilbe.** Beim Aktivieren wurde jeder Speicher
  gelöscht, der nicht der eigene war – unter derselben Adresse liegen
  aber auch andere Spiele.
* **Nur das Spiel ist „die Seite".** Jede Seitennavigation im Ordner
  wurde als `index.html` gespeichert; wer `debug/gallery.html` öffnete,
  bekam ohne Netz danach die Galerie statt des Spiels.
