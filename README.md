# Schwerin News Card

Eine aufklappbare Home-Assistant-Dashboard-Karte für Pressemitteilungen der Landeshauptstadt Schwerin.

## Funktionen

- Eingeklappte Übersicht mit Anzahl der heute veröffentlichten Meldungen
- Ausklappbare Liste mit Überschrift, Datum und Kurzbeschreibung
- Filter nach Zeitraum, Stichwort und automatisch erkannten Themen
- Keine Home-Assistant-Helfer notwendig

> **Wichtig:** Diese Erweiterung ist ausschließlich eine Dashboard-Karte. Sie ruft keine Pressemitteilungen selbst ab. Voraussetzung ist ein vorhandener Sensor mit einem Attribut `items`, das ein Array von Meldungen enthält. Die bislang entwickelte RSS-Datenquelle ist separat zu installieren und muss vor dem produktiven Einsatz überprüft werden.

## Installation über HACS

1. In HACS über das Drei-Punkte-Menü **Benutzerdefinierte Repositories** öffnen.
2. Die URL dieses öffentlichen GitHub-Repositories hinzufügen und Typ **Dashboard** auswählen.
3. **Schwerin News Card** über HACS herunterladen.
4. Kontrollieren, ob die Dashboard-Ressource `/hacsfiles/schwerin-news-card/schwerin-news-card.js` als JavaScript-Modul registriert wurde; falls nicht, unter **Einstellungen → Dashboards → Ressourcen** manuell hinzufügen.
5. Dashboard neu laden (gegebenenfalls Cache aktualisieren).

## Lovelace-Konfiguration

```yaml
type: custom:schwerin-news-card
entity: sensor.schwerin_pressemitteilungen
title: Schwerin – Pressemitteilungen
max_items: 10
default_open: false
```

## Datenformat des Sensors

Beispielattribute von `sensor.schwerin_pressemitteilungen`:

```yaml
items:
  - title: Beispielmeldung
    date: '10.10.2026'
    description: Eine kurze Beschreibung
    url: https://www.schwerin.de/
```

`items` ist eine Liste, `date` kann `TT.MM.JJJJ` oder `JJJJ-MM-TT` sein. Das Beispiel ist **keine** echte Meldung.

## Hinweise

- Die Themensortierung erfolgt über Schlagwörter und ist keine offizielle Kategorisierung.
- Die Karte filtert ausschließlich die vom Sensor bereits gelieferten Einträge.
- Die Zahl im Kopf zählt veröffentlichte Meldungen von heute, nicht ungelesene Meldungen.
- JavaScript-Lovelace-Custom-Cards sind nicht Teil des Home-Assistant-Cores.

## Lizenz

MIT – siehe `LICENSE`.
