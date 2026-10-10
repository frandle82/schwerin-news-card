# Technische Architektur

## Ziel

Die Schwerin News Card ist eine reine Lovelace Custom Card. Sie holt Pressemitteilungen direkt im Browser, bereitet die Daten lokal auf und rendert eine kompakte Home-Assistant-Karte.

Nicht Bestandteil der Architektur:

- Home-Assistant-Backend-Integration
- Python-Skripte
- externe CORS-Proxies
- Home-Assistant-Helfer
- automatische Releases

## Datenfluss

1. `setConfig()` uebernimmt die bestehende Dashboard-Konfiguration und setzt Standardwerte.
2. `connectedCallback()` startet den wiederkehrenden Abruf.
3. `loadNews()` versucht zuerst einen konfigurierten Feed, danach die HTML-Seite und optional einen auf der Seite gefundenen Feed.
4. `parseHtmlNews()` liest Meldungen aus `.event-item-content`.
5. `normalizeArticleUrl()` akzeptiert nur sichere Schwerin-News-Links und normalisiert den bekannten internen CMS-Host.
6. `filterNews()` wendet Zeitraum, Thema und Stichwortsuche an.
7. `categoryOptions()` erstellt die Themenauswahl aus den gelieferten Kategorien; heuristische Zuordnung wird nur als Fallback bei vollständig fehlenden Kategorien verwendet.
8. `SchwerinNewsCard` rendert Kopf, Filter, Liste und Footer im Shadow DOM; die Liste erhält eine begrenzte Höhe und einen eigenen vertikalen Scrollbereich.

## Parser-Regeln

- Meldungen werden nur aus verlinkten Ueberschriften innerhalb `.event-item-content` erzeugt.
- Ein Datum muss im Meldungsblock oder in nahe stehenden vorangehenden Elementen vorhanden sein.
- Artikel-Links muessen auf `https://*.schwerin.de/news/...` zeigen.
- `http://10.1.1.252/news/...` wird als bekannte CMS-Ausnahme nach `https://www.schwerin.de/news/...` umgeschrieben.
- Beschreibungen werden nicht in der Kartenliste angezeigt.
- Doppelte Links werden nur einmal uebernommen.
- Fehlende Daten werden nicht erfunden.

## Teststrategie

Die Tests laufen mit Node.js und `node:test`. Da Node keinen nativen `DOMParser` bereitstellt, verwendet die Testsuite eine kleine testlokale DOMParser-Implementierung. Die ausgelieferte Karte bleibt dadurch frei von Runtime- und Entwicklungsabhaengigkeiten.

Abgedeckt sind:

- HTML-Parsing mit realistischer `.event-item-content`-Struktur
- RSS-/Atom-Grundverarbeitung
- Link-Normalisierung und Ablehnung unsicherer/fremder Links
- Datumsformatierung und ungueltige Datumswerte
- Zeitraum-, Themen- und Suchfilter
- Dynamische Kategorien und Fallback-Themen
- Mobile Filterdarstellung und Such-Reset
- HACS-Dateireferenz und Versionskonsistenz

## Wartungsnotizen

- Bei Website-Aenderungen zuerst Parser-Tests mit einem neuen HTML-Fixture ergaenzen.
- Konfigurationsnamen nur kompatibel erweitern, nicht entfernen oder umbenennen.
- Neue Runtime-Abhaengigkeiten vermeiden.
- Release-Versionen semantisch erhoehen und README, `package.json` und Dateikopf synchron halten.
