const assert = require('node:assert/strict');
const test = require('node:test');
const { loadCard } = require('./helpers/load-card.cjs');

const helpers = loadCard();
const pageUrl = 'https://www.schwerin.de/politik-verwaltung/stadtverwaltung/pressestelle/pressemitteilungen/';

test('parseHtmlNews extracts event-item-content articles with normalized public links', () => {
  const html = `
    <main>
      <section class="event-item">
        <div class="event-item-date">Verkehr 09.10.2026</div>
        <div class="event-item-content">
          <h2><a href="http://10.1.1.252/news/verkehrsmeldung-1/">Neue Verkehrsregelung am Markt</a></h2>
          <p>Diese Beschreibung darf nicht in die Kartendarstellung einfliessen.</p>
        </div>
      </section>
      <section class="event-item">
        <div class="event-item-date">Bildung 08.10.2026</div>
        <div class="event-item-content">
          <h3><a href="/news/schule-startet-projekt/">Schule startet neues Projekt</a></h3>
        </div>
      </section>
      <section class="event-item">
        <div class="event-item-date">07.10.2026</div>
        <div class="event-item-content">
          <h2><a href="https://example.org/news/fremd/">Externe Meldung wird ignoriert</a></h2>
        </div>
      </section>
    </main>
  `;

  const items = helpers.parseHtmlNews(html, pageUrl);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.title), [
    'Neue Verkehrsregelung am Markt',
    'Schule startet neues Projekt',
  ]);
  assert.equal(items[0].url, 'https://www.schwerin.de/news/verkehrsmeldung-1/');
  assert.equal(items[0].date, '2026-10-09');
  assert.equal(items[0].category, 'Verkehr');
  assert.equal(items[0].description, undefined);
});

test('parseHtmlNews deduplicates repeated article links', () => {
  const html = `
    <article>
      <div>Politik 10.10.2026</div>
      <div class="event-item-content">
        <h2><a href="/news/stadtvertretung-tagt/">Stadtvertretung tagt im Rathaus</a></h2>
        <h3><a href="/news/stadtvertretung-tagt/">Stadtvertretung tagt im Rathaus</a></h3>
      </div>
    </article>
  `;

  const items = helpers.parseHtmlNews(html, pageUrl);

  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.schwerin.de/news/stadtvertretung-tagt/');
});

test('findFeedUrl discovers secure feed links only', () => {
  const html = `
    <html>
      <head><link rel="alternate" type="application/rss+xml" href="/rss/pressemitteilungen.xml"></head>
      <body><a href="http://www.schwerin.de/rss">RSS unsicher</a></body>
    </html>
  `;

  assert.equal(
    helpers.findFeedUrl(html, pageUrl),
    'https://www.schwerin.de/rss/pressemitteilungen.xml',
  );
});

test('parseFeedNews reads RSS entries and ignores non-Schwerin links', () => {
  const xml = `
    <rss><channel>
      <item>
        <title>Kulturfestival beginnt</title>
        <link>https://www.schwerin.de/news/kulturfestival-beginnt/</link>
        <pubDate>Fri, 09 Oct 2026 09:00:00 GMT</pubDate>
        <category>Kultur</category>
        <description><![CDATA[<p>Kurztext</p>]]></description>
      </item>
      <item>
        <title>Fremde Meldung</title>
        <link>https://example.org/news/fremd/</link>
        <pubDate>Fri, 09 Oct 2026 09:00:00 GMT</pubDate>
      </item>
    </channel></rss>
  `;

  const items = helpers.parseFeedNews(xml, pageUrl);

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Kulturfestival beginnt');
  assert.equal(items[0].date, '2026-10-09');
  assert.equal(items[0].category, 'Kultur');
});
