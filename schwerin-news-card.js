/* Schwerin News Card v0.3.0 - direct website loading (CORS required) */
(function initSchwerinNewsCard(global) {
  'use strict';

  const DEFAULT_PAGE_URL = 'https://www.schwerin.de/politik-verwaltung/stadtverwaltung/pressestelle/pressemitteilungen/';
  const ALL_TOPICS = 'Alle Themen';
  const DEFAULT_CONFIG = {
    title: 'Schwerin – Pressemitteilungen',
    max_items: 10,
    default_open: false,
    refresh_minutes: 30,
    list_max_height: 400,
    show_filters: true,
    highlight_today: true,
    show_today_count: true,
    default_period: 'Alle',
    default_category: ALL_TOPICS,
    feed_url: '',
    page_url: DEFAULT_PAGE_URL,
  };
  const FALLBACK_TOPIC = 'Weitere Meldungen';
  const TOPICS = [ALL_TOPICS, 'Verkehr', 'Bildung', 'Politik & Verwaltung', 'Kultur & Veranstaltungen', 'Bauen & Stadtentwicklung', FALLBACK_TOPIC];
  const PERIODS = ['Alle', 'Heute', 'Letzte 7 Tage', 'Letzte 30 Tage'];
  const DATE_PATTERN = /\b(\d{2})\.(\d{2})\.(20\d{2})\b/;
  const PUBLIC_HOST_PATTERN = /(^|\.)schwerin\.de$/i;

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  // Keep the configurable scroll area within practical CSS pixel bounds.
  function clampListMaxHeight(value) {
    return Math.max(120, Math.min(1200, Number(value) || DEFAULT_CONFIG.list_max_height));
  }

  function parseDocument(markup, type) {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser ist nicht verfügbar.');
    }
    return new DOMParser().parseFromString(markup, type);
  }

  function normalizeArticleUrl(href, base) {
    // Normalize internal article URLs to public HTTPS links.
    let url;
    try {
      url = new URL(href, base);
    } catch {
      return '';
    }

    if (url.hostname === '10.1.1.252' && url.protocol === 'http:') {
      url.protocol = 'https:';
      url.hostname = 'www.schwerin.de';
      url.port = '';
    }

    if (url.protocol !== 'https:' || !PUBLIC_HOST_PATTERN.test(url.hostname)) return '';
    if (!url.pathname.startsWith('/news/')) return '';
    return url.href;
  }

  function parseDate(raw) {
    // Parse source dates without fabricating a fallback date.
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    let year;
    let month;
    let day;
    let match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);

    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
      if (!match) return null;
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDisplayDate(raw) {
    const date = parseDate(raw);
    if (!date) return 'Ohne Datum';
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  }

  function isoDateFromGermanMatch(match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  function isoDateFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function extractCategory(metadata, dateText, title) {
    let category = (metadata.split(dateText)[0] || '').trim();
    category = category.replace(/^(?:Pressemitteilungen|News|Aktuelles)\s*/i, '').slice(-100).trim();
    if (category.length > 80 || category.includes(title.slice(0, 18))) return '';
    return category;
  }

  function findDateMetadata(content) {
    let block = content;
    for (let depth = 0; depth < 4 && block; depth += 1, block = block.parentElement) {
      const candidates = [];
      let preceding = block.previousElementSibling;
      for (let index = 0; preceding && index < 4; index += 1, preceding = preceding.previousElementSibling) {
        candidates.push(normalizeWhitespace(preceding.textContent).slice(0, 350));
      }
      candidates.push(normalizeWhitespace(block.textContent).slice(0, 250));

      const metadata = candidates.find((text) => DATE_PATTERN.test(text));
      if (metadata) {
        return { metadata, match: metadata.match(DATE_PATTERN) };
      }
    }
    return null;
  }

  function parseHtmlNews(html, base) {
    // Extract linked articles from the supported event-item-content markup.
    const doc = parseDocument(html, 'text/html');
    const items = new Map();
    const selectors = [
      '.event-item-content h2 a[href]',
      '.event-item-content h3 a[href]',
      '.event-item-content h4 a[href]',
    ].join(', ');

    for (const anchor of doc.querySelectorAll(selectors)) {
      const title = normalizeWhitespace(anchor.textContent);
      if (title.length < 8) continue;

      const url = normalizeArticleUrl(anchor.getAttribute('href'), base);
      if (!url) continue;

      const content = anchor.closest('.event-item-content');
      if (!content) continue;

      const dateMetadata = findDateMetadata(content);
      if (!dateMetadata?.match) continue;

      const date = isoDateFromGermanMatch(dateMetadata.match);
      const category = extractCategory(dateMetadata.metadata, dateMetadata.match[0], title);

      if (!items.has(url)) {
        items.set(url, { title, url, date, category });
      }
    }

    return [...items.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120);
  }

  function getXmlChildText(node, tag) {
    const normalizedTag = tag.toLocaleLowerCase('en');
    const child = Array.from(node.children).find((element) => element.localName.toLocaleLowerCase('en') === normalizedTag);
    return child?.textContent?.trim() || '';
  }

  function textFromHtml(value) {
    const fragment = parseDocument(value || '', 'text/html');
    return normalizeWhitespace(fragment.body.textContent).slice(0, 260);
  }

  function parseFeedNews(xml, base) {
    // Parse RSS and Atom entries into the same article shape as HTML data.
    const doc = parseDocument(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Ungültiger RSS-/Atom-Feed.');

    return Array.from(doc.querySelectorAll('item, entry'))
      .map((entry) => {
        const title = getXmlChildText(entry, 'title');
        const linkTag = Array.from(entry.children).find((element) => {
          return element.localName === 'link' && (!element.getAttribute('rel') || element.getAttribute('rel') === 'alternate');
        });
        const link = linkTag?.getAttribute('href') || getXmlChildText(entry, 'link');
        const dateRaw = getXmlChildText(entry, 'pubDate') ||
          getXmlChildText(entry, 'published') ||
          getXmlChildText(entry, 'updated') ||
          getXmlChildText(entry, 'date');
        const parsed = new Date(dateRaw);
        const date = Number.isNaN(parsed.valueOf()) ? '' : isoDateFromDate(parsed);
        let url = '';

        try {
          const candidate = new URL(link, base);
          if (candidate.protocol === 'https:' && PUBLIC_HOST_PATTERN.test(candidate.hostname)) {
            url = candidate.href;
          }
        } catch {
          url = '';
        }

        return {
          title,
          url,
          date,
          category: getXmlChildText(entry, 'category'),
          description: textFromHtml(
            getXmlChildText(entry, 'description') ||
            getXmlChildText(entry, 'summary') ||
            getXmlChildText(entry, 'encoded') ||
            getXmlChildText(entry, 'content'),
          ),
        };
      })
      .filter((item) => item.title && item.url)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);
  }

  function findFeedUrl(html, base) {
    const doc = parseDocument(html, 'text/html');
    const feedLink = Array.from(doc.querySelectorAll('a[href],link[href]')).find((element) => {
      return /rss|pressemitteilungen abonnieren/i.test([
        element.getAttribute('href'),
        element.getAttribute('type'),
        element.textContent,
      ].join(' '));
    });
    if (!feedLink) return '';

    try {
      const url = new URL(feedLink.getAttribute('href'), base);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  async function fetchText(url, base) {
    // Fetch source content directly with a bounded request lifetime.
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'https:') throw new Error('Nur HTTPS-Quellen sind erlaubt.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(parsed.href, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${parsed.hostname}`);
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadNews(config) {
    // Try the configured feed, page HTML, and discovered feed in that order.
    const failures = [];
    const pageUrl = config.page_url || DEFAULT_PAGE_URL;

    if (config.feed_url) {
      const feedUrl = new URL(config.feed_url, pageUrl).href;
      try {
        const news = parseFeedNews(await fetchText(feedUrl, pageUrl), feedUrl);
        if (news.length) return { news, source: 'RSS' };
      } catch (error) {
        failures.push(`RSS: ${error.message}`);
      }
    }

    let html = '';
    try {
      html = await fetchText(pageUrl, pageUrl);
    } catch (error) {
      failures.push(`Webseite: ${error.message}`);
    }

    if (html) {
      try {
        const news = parseHtmlNews(html, pageUrl);
        if (news.length) return { news, source: 'Webseite' };
      } catch (error) {
        failures.push(`HTML: ${error.message}`);
      }

      if (!config.feed_url) {
        const feedUrl = findFeedUrl(html, pageUrl);
        if (feedUrl) {
          try {
            const news = parseFeedNews(await fetchText(feedUrl, pageUrl), feedUrl);
            if (news.length) return { news, source: 'RSS' };
          } catch (error) {
            failures.push(`RSS-Erkennung: ${error.message}`);
          }
        }
      }
    }

    throw new Error(failures.join(' | ') || 'Keine Pressemitteilungen auf der Quellseite erkannt.');
  }

  function topicForItem(item) {
    // Prefer source categories and use title heuristics only as a fallback.
    const category = normalizeWhitespace(item.category);
    if (category) return category;

    const official = category.toLocaleLowerCase('de');
    if (/verkehr|ordnung|sicherheit/.test(official)) return 'Verkehr';
    if (/bildung|schule|jugend|familie/.test(official)) return 'Bildung';
    if (/politik|verwaltung/.test(official)) return 'Politik & Verwaltung';
    if (/kultur|veranstaltung/.test(official)) return 'Kultur & Veranstaltungen';
    if (/bau|stadtentwicklung|wohnen/.test(official)) return 'Bauen & Stadtentwicklung';

    const title = String(item.title || '').toLocaleLowerCase('de');
    const groups = [
      ['Verkehr', /verkehr|baustell|straßen|strassen|sperrung|bus|bahn|parkpl[aä]tz|radweg|br[uü]ck/],
      ['Bildung', /schul|bildung|kita|kindergarten|jugend|unterricht|bibliothek/],
      ['Politik & Verwaltung', /stadtvertret|ausschuss|verwaltung|b[uü]rgermeister|haushalt|satzung|politik/],
      ['Kultur & Veranstaltungen', /veranstaltung|konzert|kultur|museum|theater|festival|fest|ausstellung/],
      ['Bauen & Stadtentwicklung', /wohn|bauprojekt|stadtentwicklung|sanierung|quartier|bebauungsplan/],
    ];
    return (groups.find(([, pattern]) => pattern.test(title)) || [FALLBACK_TOPIC])[0];
  }

  function categoryOptions(items) {
    const explicit = items.map((item) => normalizeWhitespace(item.category)).filter(Boolean);
    if (!explicit.length) {
      return [ALL_TOPICS, ...new Set(items.map(topicForItem))];
    }

    const categories = [...new Set(explicit)];
    if (items.some((item) => !normalizeWhitespace(item.category))) categories.push('Ohne Kategorie');
    return [ALL_TOPICS, ...categories.sort((a, b) => a.localeCompare(b, 'de'))];
  }

  function itemCategory(item, useFallback) {
    const category = normalizeWhitespace(item.category);
    if (category) return category;
    return useFallback ? topicForItem(item) : 'Ohne Kategorie';
  }

  function filterNews(items, filters, now = new Date()) {
    // Apply date, category, and keyword filters.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filters.period === 'Letzte 7 Tage') start.setDate(start.getDate() - 6);
    if (filters.period === 'Letzte 30 Tage') start.setDate(start.getDate() - 29);

    const today = dateKey(now);
    const needle = String(filters.search || '').trim().toLocaleLowerCase('de');
    const useFallback = !items.some((item) => normalizeWhitespace(item.category));

    return items
      .filter((item) => {
        const date = parseDate(item.date);
        if (filters.period === 'Heute' && (!date || dateKey(date) !== today)) return false;
        if (filters.period !== 'Alle' && filters.period !== 'Heute' && (!date || date < start || date > now)) return false;
        if (filters.category !== ALL_TOPICS && itemCategory(item, useFallback) !== filters.category) return false;
        return String(item.title || '').toLocaleLowerCase('de').includes(needle);
      })
      .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }

  function clampMaxItems(value) {
    return Math.max(1, Math.min(50, Number(value) || DEFAULT_CONFIG.max_items));
  }

  function normalizeConfig(config = {}) {
    // Normalize editor and YAML values while preserving unknown compatible keys.
    return {
      ...DEFAULT_CONFIG,
      ...config,
      max_items: clampMaxItems(config.max_items ?? DEFAULT_CONFIG.max_items),
      refresh_minutes: Math.max(5, Math.min(1440, Number(config.refresh_minutes) || DEFAULT_CONFIG.refresh_minutes)),
      list_max_height: clampListMaxHeight(config.list_max_height ?? DEFAULT_CONFIG.list_max_height),
      default_open: Boolean(config.default_open ?? DEFAULT_CONFIG.default_open),
      show_filters: Boolean(config.show_filters ?? DEFAULT_CONFIG.show_filters),
      highlight_today: Boolean(config.highlight_today ?? DEFAULT_CONFIG.highlight_today),
      show_today_count: Boolean(config.show_today_count ?? DEFAULT_CONFIG.show_today_count),
      default_period: PERIODS.includes(config.default_period) ? config.default_period : DEFAULT_CONFIG.default_period,
      default_category: normalizeWhitespace(config.default_category) || ALL_TOPICS,
    };
  }

  function getConfigForm() {
    // Describe the native Home Assistant visual configuration form.
    return {
      schema: [
        { name: 'title', selector: { text: {} } },
        { name: 'max_items', selector: { number: { min: 1, max: 50, mode: 'box' } } },
        { name: 'refresh_minutes', selector: { number: { min: 5, max: 1440, mode: 'box' } } },
        { name: 'default_open', selector: { boolean: {} } },
        { name: 'list_max_height', selector: { number: { min: 120, max: 1200, mode: 'box' } } },
        { name: 'show_filters', selector: { boolean: {} } },
        { name: 'highlight_today', selector: { boolean: {} } },
        { name: 'show_today_count', selector: { boolean: {} } },
        { name: 'default_period', selector: { select: { options: PERIODS } } },
        { name: 'default_category', selector: { text: {} } },
        { name: 'page_url', selector: { text: {} } },
        { name: 'feed_url', selector: { text: {} } },
      ],
      computeLabel: (schema) => ({
        title: 'Kartentitel', max_items: 'Maximale Meldungen', refresh_minutes: 'Aktualisierung (Minuten)',
        default_open: 'Standardmäßig geöffnet', list_max_height: 'Maximale Listenhöhe (Pixel)',
        show_filters: 'Filter und Suche anzeigen', highlight_today: 'Heutige Meldungen hervorheben',
        show_today_count: 'Tageszähler anzeigen', default_period: 'Standardzeitraum',
        default_category: 'Standardthema', page_url: 'Nachrichtenquelle', feed_url: 'RSS-/Atom-Quelle',
      }[schema.name]),
      assertConfig: (config) => {
        if (config.max_items !== undefined && (Number(config.max_items) < 1 || Number(config.max_items) > 50)) {
          throw new Error('Maximale Meldungen müssen zwischen 1 und 50 liegen.');
        }
        if (config.list_max_height !== undefined && (Number(config.list_max_height) < 120 || Number(config.list_max_height) > 1200)) {
          throw new Error('Die Listenhöhe muss zwischen 120 und 1200 Pixeln liegen.');
        }
      },
    };
  }

  function createElement(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  }

  const styles = `
    :host { display:block; color:var(--primary-text-color); }
    ha-card { display:block; overflow:hidden; }
    .header {width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:transparent;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit;box-sizing:border-box;}
    .heading {font-size:16px;font-weight:650;line-height:1.35;}
    .sub {font-size:12px;color:var(--secondary-text-color);margin-top:4px;}
    .arrow {font-size:18px;color:var(--secondary-text-color);flex-shrink:0;}
    .body {padding:0 18px 12px;}
    .filters {display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 10px;}
    select,input {width:100%;box-sizing:border-box;min-width:0;background:var(--card-background-color, var(--ha-card-background, #fff));color:var(--primary-text-color);border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:9px;font:inherit;font-size:13px;}
    input {grid-column:1 / -1;}
    .search-row {display:flex;gap:6px;grid-column:1 / -1;}
    .search-row input {flex:1;}
    .clear-search {min-width:40px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:transparent;color:var(--secondary-text-color);font:inherit;font-size:18px;cursor:pointer;}
    .entry {padding:12px 0;border-top:1px solid var(--divider-color,#ddd);}
    .entry.today {border-left:3px solid var(--primary-color);padding-left:10px;}
    .entry a {color:var(--primary-text-color);font-size:14px;font-weight:600;text-decoration:none;line-height:1.4;}
    .entry a:hover {color:var(--primary-color);text-decoration:underline;}
    .meta {color:var(--secondary-text-color);font-size:11px;margin:5px 0 4px;}
    .notice {font-size:13px;color:var(--secondary-text-color);padding:12px 0;}
    .footer {font-size:11px;color:var(--secondary-text-color);padding:10px 0 0;border-top:1px solid var(--divider-color,#ddd);}
    .news-list {max-height:var(--news-list-max-height,400px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;}
    button:focus-visible,input:focus-visible,select:focus-visible {outline:2px solid var(--primary-color);outline-offset:2px;}
    @media(max-width:420px){ .filters {grid-template-columns:1fr;} }
  `;

  class SchwerinNewsCard extends HTMLElement {
    static getConfigForm() {
      return getConfigForm();
    }

    static getStubConfig() {
      // Supply a complete, usable configuration to the card picker.
      return { ...DEFAULT_CONFIG };
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._expanded = false;
      this._period = 'Alle';
      this._category = ALL_TOPICS;
      this._search = '';
      this._news = [];
      this._status = 'loading';
      this._error = '';
      this._timer = null;
      this._requestId = 0;
      this._source = '';
    }

    setConfig(config) {
      // Apply compatible defaults before the first render.
      this._config = normalizeConfig(config);
      this._expanded = this._config.default_open;
      this._period = this._config.default_period;
      this._category = this._config.default_category;
      this._news = [];
      this._status = 'loading';
      this._error = '';
      this._render();
      if (this.isConnected) this._start();
    }

    set hass(value) {
      this._hass = value;
    }

    connectedCallback() {
      if (this._config) this._start();
    }

    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
      this._requestId += 1;
    }

    getCardSize() {
      return this._expanded ? 7 : 2;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 4, rows: this._expanded ? 7 : 2, min_rows: 2 };
    }

    _start() {
      // Refresh only while the card is connected to the dashboard.
      if (this._timer) clearInterval(this._timer);
      this._load();
      const minutes = Math.max(5, Number(this._config.refresh_minutes) || DEFAULT_CONFIG.refresh_minutes);
      this._timer = setInterval(() => this._load(), minutes * 60000);
    }

    async _load() {
      // Ignore responses from requests superseded by a newer refresh.
      const id = ++this._requestId;
      try {
        const result = await loadNews(this._config);
        if (id !== this._requestId || !this.isConnected) return;
        this._news = result.news;
        this._source = result.source;
        this._status = 'ok';
        this._error = '';
      } catch (error) {
        if (id !== this._requestId || !this.isConnected) return;
        this._status = this._news.length ? 'stale' : 'error';
        this._error = `${String(error?.message || error)} — Wenn der Browserabruf HTTP 200 liefert, bitte die HTML-Struktur prüfen.`;
      }
      this._render();
    }

    _render() {
      // Rebuild the shadow DOM from current state after every interaction.
      if (!this._config) return;

      const root = this.shadowRoot;
      root.replaceChildren();
      root.append(createElement('style', '', styles));

      const card = createElement('ha-card');
      card.style.setProperty('--news-list-max-height', `${clampListMaxHeight(this._config.list_max_height)}px`);
      root.append(card);
      const todayCount = this._news.filter((item) => {
        const date = parseDate(item.date);
        return date && dateKey(date) === dateKey(new Date());
      }).length;

      card.append(this._renderHeader(todayCount));
      if (!this._expanded) return;
      card.append(this._renderBody());
    }

    _renderHeader(todayCount) {
      const header = createElement('button', 'header');
      header.type = 'button';
      header.setAttribute('aria-expanded', String(this._expanded));

      const headingBox = createElement('div');
      headingBox.append(createElement('div', 'heading', this._config.title));

      let subtitle;
      if (this._status === 'loading') subtitle = 'Lade Nachrichten ...';
      else if (this._status === 'error') subtitle = 'Nachrichtenquelle nicht erreichbar';
      else {
        const label = todayCount === 1 ? 'Meldung' : 'Meldungen';
        subtitle = `${this._config.show_today_count ? `${todayCount} ${label} heute · ` : ''}${this._news.length} geladen${this._status === 'stale' ? ' · Daten möglicherweise veraltet' : ''}`;
      }

      headingBox.append(createElement('div', 'sub', subtitle));
      header.append(headingBox, createElement('span', 'arrow', this._expanded ? '▴' : '▾'));
      header.addEventListener('click', () => {
        // Toggle the compact header without changing the dashboard config.
        this._expanded = !this._expanded;
        this._render();
      });
      return header;
    }

    _renderBody() {
      const body = createElement('div', 'body');

      if (this._status === 'error' || this._status === 'loading') {
        body.append(createElement('div', 'notice', this._status === 'loading' ? 'Pressemitteilungen werden geladen ...' : this._error));
        return body;
      }

      if (this._status === 'stale') body.append(createElement('div', 'notice', this._error));

      if (!this._config.show_filters) {
        const list = createElement('div', 'news-list');
        const footer = createElement('div', 'footer');
        body.append(list, footer);
        this._renderEntries(list, footer);
        return body;
      }

      const filters = createElement('div', 'filters');
      body.append(filters);

      filters.append(this._renderSelect('Zeitraum', PERIODS, this._period, (value) => {
        this._period = value;
        this._render();
      }));
      const categories = categoryOptions(this._news);
      if (!categories.includes(this._category)) this._category = ALL_TOPICS;
      filters.append(this._renderSelect('Thema', categories, this._category, (value) => {
        this._category = value;
        this._render();
      }));
      filters.append(this._renderSearchInput());

      const list = createElement('div', 'news-list');
      const footer = createElement('div', 'footer');
      body.append(list, footer);
      this._renderEntries(list, footer);
      return body;
    }

    _renderSelect(label, options, value, onChange) {
      const select = createElement('select');
      select.setAttribute('aria-label', label);
      for (const text of options) {
        const option = createElement('option', '', text);
        option.value = text;
        select.append(option);
      }
      select.value = value;
      select.addEventListener('change', (event) => onChange(event.target.value));
      return select;
    }

    _renderSearchInput() {
      const row = createElement('div', 'search-row');
      const search = createElement('input');
      search.type = 'search';
      search.placeholder = 'Stichwort suchen ...';
      search.setAttribute('aria-label', 'Stichwort suchen');
      search.value = this._search;
      search.addEventListener('input', (event) => {
        this._search = event.target.value;
        this._render();
      });
      row.append(search);
      if (this._search) {
        const clear = createElement('button', 'clear-search', '×');
        clear.type = 'button';
        clear.setAttribute('aria-label', 'Stichwortsuche zurücksetzen');
        clear.addEventListener('click', () => {
          this._search = '';
          this._render();
        });
        row.append(clear);
      }
      return row;
    }

    _renderEntries(list, footer) {
      // Limit the visible list height and enable vertical scrolling.
      list.replaceChildren();
      const max = clampMaxItems(this._config.max_items);
      const filtered = filterNews(this._news, {
        period: this._period,
        category: this._category,
        search: this._search,
      });

      if (!filtered.length) list.append(createElement('div', 'notice', 'Keine passenden Meldungen gefunden.'));

      for (const item of filtered.slice(0, max)) {
        list.append(this._renderEntry(item));
      }

      footer.textContent = `${Math.min(filtered.length, max)} von ${filtered.length} passenden Meldungen angezeigt · ${this._news.length} aus ${this._source || 'Quelle'} geladen`;
    }

    _renderEntry(item) {
      const today = this._config.highlight_today && dateKey(new Date()) === item.date;
      const entry = createElement('article', `entry${today ? ' today' : ''}`);
      const title = createElement('a', '', item.title || 'Pressemitteilung');
      let url;
      try {
        url = new URL(item.url, 'https://www.schwerin.de');
      } catch {
        url = null;
      }

      if (url && url.protocol === 'https:' && PUBLIC_HOST_PATTERN.test(url.hostname)) {
        title.href = url.href;
        title.target = '_blank';
        title.rel = 'noopener noreferrer';
      }

      entry.append(title);
      entry.append(createElement('div', 'meta', `${formatDisplayDate(item.date)} · ${itemCategory(item, !this._news.some((news) => normalizeWhitespace(news.category)))}`));
      return entry;
    }
  }

  const api = {
    DEFAULT_CONFIG,
    ALL_TOPICS,
    categoryOptions,
    clampListMaxHeight,
    getConfigForm,
    normalizeConfig,
    PERIODS,
    TOPICS,
    clampMaxItems,
    dateKey,
    filterNews,
    findFeedUrl,
    formatDisplayDate,
    loadNews,
    normalizeArticleUrl,
    normalizeWhitespace,
    parseDate,
    parseFeedNews,
    parseHtmlNews,
    topicForItem,
  };

  global.SchwerinNewsCardHelpers = api;

  if (global.customElements && !global.customElements.get('schwerin-news-card')) {
    global.customElements.define('schwerin-news-card', SchwerinNewsCard);
  }

  global.customCards = global.customCards || [];
  if (!global.customCards.some((card) => card.type === 'schwerin-news-card')) {
    global.customCards.push({
      type: 'schwerin-news-card',
      name: 'Schwerin News Card',
      description: 'Aktuelle Pressemitteilungen der Landeshauptstadt Schwerin mit Filter- und Suchfunktion.',
      preview: false,
      documentationURL: 'https://github.com/frandle82/schwerin-news-card',
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
