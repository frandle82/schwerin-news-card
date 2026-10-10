# Schwerin News Card v0.2.0

Eigenstaendige Home-Assistant-Dashboard-Karte fuer Pressemitteilungen der Landeshauptstadt Schwerin. Die Karte laeuft komplett im Browser: keine Backend-Integration, kein Python-Skript, keine Home-Assistant-Helfer und kein externer Proxy.

## Installation ueber HACS

1. Dieses Repository als HACS-Dashboard-Repository verwenden.
2. Release mit passendem Tag installieren, z. B. `v0.2.0`.
3. Sicherstellen, dass `/hacsfiles/schwerin-news-card/schwerin-news-card.js` als JavaScript-Modul eingebunden ist.
4. Dashboard neu laden und bei Bedarf den Browsercache leeren.

## Dashboard-Konfiguration

```yaml
type: custom:schwerin-news-card
title: Schwerin – Pressemitteilungen
max_items: 10
default_open: false
refresh_minutes: 30
```

Optionale Felder:

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `title` | `Schwerin – Pressemitteilungen` | Titel im Kartenkopf |
| `max_items` | `10` | Anzahl sichtbarer Meldungen, begrenzt auf 1 bis 50 |
| `default_open` | `false` | Karte beim Laden aufgeklappt anzeigen |
| `refresh_minutes` | `30` | Aktualisierungsintervall, mindestens 5 Minuten |
| `page_url` | offizielle Pressemitteilungsseite | HTML-Quelle fuer direkte Browserabfrage |
| `feed_url` | leer | Optionaler RSS-/Atom-Feed als bevorzugte Quelle |

## Verhalten

- Ruft die Schweriner Pressemitteilungen direkt per Browser Fetch API ab.
- Parst HTML-Meldungen aus `.event-item-content`.
- Normalisiert bekannte interne CMS-Links von `http://10.1.1.252/news/...` nach `https://www.schwerin.de/news/...`.
- Zeigt Datumswerte als `TT.MM.JJJJ`.
- Zeigt keine Artikelbeschreibungen in der Liste.
- Bietet Tageszaehler, Zeitraumfilter, quellengestützte Themenfilter und Stichwortsuche.
- Filteroptionen werden aus den tatsächlich gelieferten Kategorien gebildet; heuristische Themen erscheinen nur, wenn die Quelle keine Kategorien liefert.
- Die Liste markiert Meldungen vom aktuellen Tag und bietet eine gut erreichbare Suche-zurücksetzen-Schaltfläche.
- Nutzt Home-Assistant-Theme-Variablen fuer helle und dunkle Themes.
- Erfindet keine fehlenden Meldungen. Wenn die Quelle nicht lesbar ist oder die HTML-Struktur nicht passt, zeigt die Karte einen Fehlerzustand.

## Architektur

Die ausgelieferte HACS-Datei bleibt `schwerin-news-card.js`. Innerhalb dieser Datei sind die Verantwortlichkeiten getrennt:

- Fetching: `fetchText()` und `loadNews()`
- HTML-Erkennung: `parseHtmlNews()` und `findFeedUrl()`
- Feed-Erkennung: `parseFeedNews()`
- Link-Sicherheit: `normalizeArticleUrl()`
- Datumslogik: `parseDate()`, `dateKey()` und `formatDisplayDate()`
- Filterung: `filterNews()`, `categoryOptions()` und `itemCategory()`
- Darstellung: `SchwerinNewsCard` mit Shadow DOM und Home-Assistant-kompatiblen Methoden

Die Hilfsfunktionen werden unter `window.SchwerinNewsCardHelpers` bereitgestellt, damit sie automatisiert getestet werden koennen. Die Home-Assistant-Nutzung bleibt unveraendert ueber `custom:schwerin-news-card`.

## Entwicklung

```bash
npm install
npm run check:syntax
npm test
npm run validate:hacs
npm run ci
```

Die Tests verwenden realistische HTML-Fixtures und pruefen Parser, Datumsverarbeitung, Link-Normalisierung, Filterlogik und HACS-Dateistruktur. Fuer die Node-Tests gibt es eine kleine testlokale DOMParser-Implementierung; die ausgelieferte Karte hat keine Runtime-Abhaengigkeiten.

## CORS-Hinweis

Die Karte laedt die offizielle Website direkt im Browser. Das funktioniert nur, wenn der Browser die Quelle wegen CORS und Netzwerkerreichbarkeit abrufen darf. Es wird bewusst kein externer Proxy und keine Home-Assistant-Backend-Integration verwendet.

## Aenderungen v0.2.0

- Kompaktere, mobile Filterbedienung mit Touch-Zielen und Such-Reset.
- Dynamische Themenfilter ohne künstliche Kategorien bei vorhandenen Quelldaten.
- Meldungen des aktuellen Tages werden visuell hervorgehoben.
- Version und HACS-Dokumentation auf `0.2.0` aktualisiert.

## Aenderungen v0.1.1

- Nachrichtenabruf, HTML-Parsing, Feed-Parsing, Datumslogik, Filterung und Rendering klar getrennt.
- Parser- und Filterlogik automatisiert testbar gemacht.
- Tests mit realistischen HTML- und RSS-Testdaten ergaenzt.
- GitHub Actions fuer Syntaxpruefung, Tests und HACS-Validierung vorbereitet.
- Technische Dokumentation erweitert.

## Release-Hinweis

Dieses Repository ist fuer HACS-Releases vorbereitet, veroeffentlicht aber nichts automatisch. Tags, GitHub-Releases und produktive Aktualisierungen erfolgen nur manuell nach Freigabe.
