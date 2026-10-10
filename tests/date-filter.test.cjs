const assert = require('node:assert/strict');
const test = require('node:test');
const { loadCard } = require('./helpers/load-card.cjs');

const helpers = loadCard();

const news = [
  {
    title: 'Neue Verkehrsregelung am Markt',
    url: 'https://www.schwerin.de/news/verkehr/',
    date: '2026-10-10',
    category: 'Verkehr',
  },
  {
    title: 'Schule startet neues Projekt',
    url: 'https://www.schwerin.de/news/schule/',
    date: '2026-10-04',
    category: 'Bildung',
  },
  {
    title: 'Theater zeigt Premiere',
    url: 'https://www.schwerin.de/news/theater/',
    date: '2026-09-15',
    category: 'Kultur',
  },
];

test('parseDate accepts German and ISO dates and rejects impossible values', () => {
  assert.equal(helpers.formatDisplayDate('2026-10-10'), '10.10.2026');
  assert.equal(helpers.formatDisplayDate('10.10.2026'), '10.10.2026');
  assert.equal(helpers.parseDate('31.02.2026'), null);
  assert.equal(helpers.formatDisplayDate(''), 'Ohne Datum');
});

test('normalizeArticleUrl allows only Schwerin news URLs and rewrites known CMS host', () => {
  assert.equal(
    helpers.normalizeArticleUrl('http://10.1.1.252/news/interner-link/', 'https://www.schwerin.de/'),
    'https://www.schwerin.de/news/interner-link/',
  );
  assert.equal(
    helpers.normalizeArticleUrl('/news/oeffentlich/', 'https://www.schwerin.de/presse/'),
    'https://www.schwerin.de/news/oeffentlich/',
  );
  assert.equal(helpers.normalizeArticleUrl('http://www.schwerin.de/news/unsicher/', 'https://www.schwerin.de/'), '');
  assert.equal(helpers.normalizeArticleUrl('https://example.org/news/fremd/', 'https://www.schwerin.de/'), '');
  assert.equal(helpers.normalizeArticleUrl('https://www.schwerin.de/presse/', 'https://www.schwerin.de/'), '');
});

test('filterNews applies period, topic and keyword filters', () => {
  const now = new Date(2026, 9, 10, 12, 0, 0);

  assert.deepEqual(
    helpers.filterNews(news, { period: 'Heute', category: 'Alle Themen', search: '' }, now)
      .map((item) => item.title),
    ['Neue Verkehrsregelung am Markt'],
  );
  assert.deepEqual(
    helpers.filterNews(news, { period: 'Letzte 7 Tage', category: 'Alle Themen', search: '' }, now)
      .map((item) => item.title),
    ['Neue Verkehrsregelung am Markt', 'Schule startet neues Projekt'],
  );
  assert.deepEqual(
    helpers.filterNews(news, { period: 'Alle', category: 'Bildung', search: 'projekt' }, now)
      .map((item) => item.title),
    ['Schule startet neues Projekt'],
  );
  assert.deepEqual(
    helpers.filterNews(news, { period: 'Alle', category: 'Kultur', search: '' }, now)
      .map((item) => item.title),
    ['Theater zeigt Premiere'],
  );
});

test('categoryOptions uses source categories and only falls back when none exist', () => {
  assert.deepEqual(helpers.categoryOptions(news), ['Alle Themen', 'Bildung', 'Kultur', 'Verkehr']);
  assert.deepEqual(
    helpers.categoryOptions(news.map(({ category, ...item }) => item)),
    ['Alle Themen', 'Verkehr', 'Bildung', 'Kultur & Veranstaltungen'],
  );
});

test('clampMaxItems keeps dashboard limits bounded', () => {
  assert.equal(helpers.clampMaxItems(0), 10);
  assert.equal(helpers.clampMaxItems(3), 3);
  assert.equal(helpers.clampMaxItems(100), 50);
});

test('clampListMaxHeight keeps the scroll area configurable and bounded', () => {
  assert.equal(helpers.clampListMaxHeight(), 400);
  assert.equal(helpers.clampListMaxHeight(240), 240);
  assert.equal(helpers.clampListMaxHeight(20), 120);
  assert.equal(helpers.clampListMaxHeight(2000), 1200);
});

test('visual editor exposes defaults, labels, and numeric validation', () => {
  const form = helpers.getConfigForm();
  assert.ok(form.schema.some((field) => field.name === 'list_max_height'));
  assert.equal(helpers.normalizeConfig({}).list_max_height, 400);
  assert.equal(helpers.normalizeConfig({ default_period: 'Heute' }).default_period, 'Heute');
  assert.throws(() => form.assertConfig({ max_items: 0 }), /zwischen 1 und 50/);
  assert.throws(() => form.assertConfig({ list_max_height: 2000 }), /zwischen 120 und 1200/);
});
