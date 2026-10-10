# Schwerin News Card v0.2.0

Eigenständige Home-Assistant-Dashboard-Karte für Pressemitteilungen der Landeshauptstadt Schwerin. Die Karte läuft komplett im Browser: keine Backend-Integration, kein Python-Skript, keine Home-Assistant-Helfer und kein externer Proxy.

## Einrichtung über den visuellen Editor

1. Karte über HACS installieren.
2. Dashboard bearbeiten und eine Karte hinzufügen.
3. `Schwerin News Card` auswählen.
4. Einstellungen im visuellen Editor konfigurieren und speichern.

Die Karte kann ohne Entitätsauswahl hinzugefügt werden. Der visuelle Editor verwendet die native Home-Assistant-Formularschnittstelle. Die manuelle YAML-Konfiguration bleibt als Alternative verfügbar.

## Installation über HACS

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
| `list_max_height` | `400` | Maximale Höhe der Nachrichtenliste in CSS-Pixeln; bei längeren Listen wird innerhalb der Karte gescrollt |
| `page_url` | offizielle Pressemitteilungsseite | HTML-Quelle für direkte Browserabfrage |
| `feed_url` | leer | Optionaler RSS-/Atom-Feed als bevorzugte Quelle |
| `show_filters` | `true` | Filter und Stichwortsuche anzeigen |
| `highlight_today` | `true` | Meldungen des aktuellen Tages hervorheben |
| `show_today_count` | `true` | Tageszähler im Kartenkopf anzeigen |
| `default_period` | `Alle` | Vorausgewählter Zeitraum |
| `default_category` | `Alle Themen` | Vorausgewähltes Thema, falls verfügbar |

## Verhalten

- Ruft die Schweriner Pressemitteilungen direkt per Browser Fetch API ab.
- Parst HTML-Meldungen aus `.event-item-content`.
- Normalisiert bekannte interne CMS-Links von `http://10.1.1.252/news/...` nach `https://www.schwerin.de/news/...`.
- Zeigt Datumswerte als `TT.MM.JJJJ`.
- Zeigt keine Artikelbeschreibungen in der Liste.
- Bietet Tageszähler, Zeitraumfilter, quellengestützte Themenfilter und Stichwortsuche.
- Filteroptionen werden aus den tatsächlich gelieferten Kategorien gebildet; heuristische Themen erscheinen nur, wenn die Quelle keine Kategorien liefert.
- Die Liste markiert Meldungen vom aktuellen Tag und bietet eine gut erreichbare Suche-zurücksetzen-Schaltfläche.
- Mit `list_max_height` lässt sich die maximale Listenhöhe anpassen; der interne Scrollbereich funktioniert auch auf Touch-Geräten.
- Nutzt Home-Assistant-Theme-Variablen für helle und dunkle Themes.
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

Die Hilfsfunktionen werden unter `window.SchwerinNewsCardHelpers` bereitgestellt, damit sie automatisiert getestet werden können. Die Home-Assistant-Nutzung bleibt unverändert über `custom:schwerin-news-card`.

## Entwicklung

```bash
npm install
npm run check:syntax
npm test
npm run validate:hacs
npm run ci
```

Die Tests verwenden realistische HTML-Fixtures und prüfen Parser, Datumsverarbeitung, Link-Normalisierung, Filterlogik und HACS-Dateistruktur. Für die Node-Tests gibt es eine kleine testlokale DOMParser-Implementierung; die ausgelieferte Karte hat keine Runtime-Abhängigkeiten.

## CORS-Hinweis

Die Karte lädt die offizielle Website direkt im Browser. Das funktioniert nur, wenn der Browser die Quelle wegen CORS und Netzwerkerreichbarkeit abrufen darf. Es wird bewusst kein externer Proxy und keine Home-Assistant-Backend-Integration verwendet.

## Änderungen v0.2.0

- Kompaktere, mobile Filterbedienung mit Touch-Zielen und Such-Reset.
- Dynamische Themenfilter ohne künstliche Kategorien bei vorhandenen Quelldaten.
- Meldungen des aktuellen Tages werden visuell hervorgehoben.
- Version und HACS-Dokumentation auf `0.2.0` aktualisiert.

## Änderungen v0.1.1

- Nachrichtenabruf, HTML-Parsing, Feed-Parsing, Datumslogik, Filterung und Rendering klar getrennt.
- Parser- und Filterlogik automatisiert testbar gemacht.
- Tests mit realistischen HTML- und RSS-Testdaten ergänzt.
- GitHub Actions für Syntaxprüfung, Tests und HACS-Validierung vorbereitet.
- Technische Dokumentation erweitert.

## Release-Hinweis

Dieses Repository ist für HACS-Releases vorbereitet, veröffentlicht aber nichts automatisch. Tags, GitHub-Releases und produktive Aktualisierungen erfolgen nur manuell nach Freigabe.
