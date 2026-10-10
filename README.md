# Schwerin News Card v0.1.0

Eigenständige Home-Assistant-Dashboard-Karte für Pressemitteilungen der Landeshauptstadt Schwerin. **Keine Backend-Integration, kein Python-Skript, keine Helfer.**

## Installation über HACS

1. Dateien im öffentlichen GitHub-Repository `schwerin-news-card` aktualisieren (im Repository-Stammverzeichnis).
2. GitHub-Release mit Tag `v0.1.0` erstellen.
3. Über HACS (Typ **Dashboard**) aktualisieren, Dashboard neu laden und ggf. Browsercache leeren.
4. Sicherstellen, dass `/hacsfiles/schwerin-news-card/schwerin-news-card.js` als JavaScript-Modul eingebunden ist.

## Dashboard

```yaml
type: custom:schwerin-news-card
title: Schwerin – Pressemitteilungen
max_items: 10
default_open: false
refresh_minutes: 30
```

## Umsetzung v0.1.0

- `page_url` muss nicht angegeben werden (bleibt als optionale Überschreibmöglichkeit).
- Leere Kurzbeschreibungen aus der Anzeige entfernt.
- Datum in `TT.MM.JJJJ` normalisiert.
- Liest verlinkte Überschriften gezielt aus `.event-item-content` aus.
- Wandelt die auf der Seite veröffentlichten CMS-Links `http://10.1.1.252/news/...` in `https://www.schwerin.de/news/...` um.
- Sucht das Veröffentlichungsdatum im umgebenden Nachrichtenblock.
- Zeigt Tageszähler, Zeitraumfilter, Themenfilter und Freitextsuche.
- Keine Kurzbeschreibungen: Die Liste enthält nur Titel, Datum und Thema.
- Veröffentlichungsdaten werden als `TT.MM.JJJJ` angezeigt.
- `page_url` ist optional und bereits mit der offiziellen Schweriner URL vorbelegt.

## Einschränkungen

Der HTML-Parser ist anhand der vom Nutzer in Safari ermittelten DOM-Klasse und Linkstruktur angepasst, aber noch nicht im Home-Assistant-Dashboard live getestet. Bei Änderungen der Website-Struktur können Nachbesserungen erforderlich werden. Zeitfilter gelten nur für die Meldungen, die auf der abgerufenen Seite vorhanden sind. Die öffentliche Zieladresse der normalisierten Artikel-Links sollte nach Installation durch einen Klick überprüft werden.
