# Pull Request: Wartbare Grundlage fuer Schwerin News Card

## Ziel

Diese Aenderung stellt die bestehende Home-Assistant-Custom-Card technisch auf eine langfristig wartbare Grundlage, ohne die bestehende Dashboard-Konfiguration oder das HACS-Auslieferungsmodell zu brechen.

## Aenderungen

- `schwerin-news-card.js` intern in klar getrennte Verantwortlichkeiten gegliedert:
  - Nachrichtenabruf
  - HTML-Parsing
  - Feed-Parsing
  - Link-Normalisierung
  - Datumsverarbeitung
  - Filterlogik
  - Rendering
- Bestehende Konfigurationsoptionen beibehalten:
  - `title`
  - `max_items`
  - `default_open`
  - `refresh_minutes`
  - `feed_url`
  - `page_url`
- Parser fuer `.event-item-content` beibehalten und testbar gemacht.
- Bekannte interne CMS-Links werden weiterhin nach `https://www.schwerin.de/news/...` normalisiert.
- Unsichere oder fremde Artikel-Links werden verworfen.
- Keine Artikelbeschreibungen in der Kartenliste.
- Tests mit realistischen HTML- und RSS-Testdaten ergaenzt.
- GitHub Actions fuer Syntaxpruefung, Tests und Repository-Validierung ergaenzt.
- README und technische Architektur-Dokumentation aktualisiert.
- Version auf `1.4.0` vorbereitet.

## Tests

Lokal ausgefuehrt:

```bash
npm run ci
```

Ergebnis:

- Syntaxcheck erfolgreich
- 11 Node-Tests erfolgreich
- HACS-/Repository-Validierung erfolgreich

## Hinweise

- Keine neue Home-Assistant-Integration.
- Kein Python.
- Kein externer Proxy.
- Keine Runtime-Abhaengigkeiten.
- Kein automatischer Release.
- Kein Tag und keine produktive Veroeffentlichung ohne ausdrueckliche Freigabe.
