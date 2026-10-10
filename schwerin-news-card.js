/* Schwerin News Card v1.3.0 — direct RSS loading (CORS required) */
class SchwerinNewsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._expanded = false;
    this._period = 'Alle';
    this._category = 'Alle Themen';
    this._search = '';
    this._lastSignature = null;
    this._news = [];
    this._status = "loading";
    this._error = "";
    this._timer = null;
    this._requestId = 0;
  }

  setConfig(config) {
    this._config = {
      title: 'Schwerin – Pressemitteilungen',
      max_items: 10,
      default_open: false,
      refresh_minutes: 30,
      feed_url: '',
      page_url: 'https://www.schwerin.de/politik-verwaltung/stadtverwaltung/pressestelle/pressemitteilungen/',
      ...config,
    };
    this._expanded = Boolean(this._config.default_open);
    this._news = [];
    this._status = 'loading';
    this._error = '';
    this._render();
    if (this.isConnected) this._start();
  }

  set hass(value) { this._hass = value; }
  connectedCallback() { if (this._config) this._start(); }
  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._requestId++;
  }
  _start() {
    if (this._timer) clearInterval(this._timer);
    this._load();
    const mins = Math.max(5, Number(this._config.refresh_minutes) || 30);
    this._timer = setInterval(() => this._load(), mins * 60000);
  }

  async _load() {
    const id = ++this._requestId;
    const failures = [];
    let news = [];
    let source = '';
    const pageUrl = this._config.page_url;
    try {
      // Explicit RSS URL avoids fetching the HTML index first.
      if (this._config.feed_url) {
        const url = new URL(this._config.feed_url, pageUrl).href;
        try { news = this._parseFeed(await this._fetchText(url), url); source = 'RSS'; }
        catch (e) { failures.push(`RSS: ${e.message}`); }
      }
      if (!news.length) {
        let html = '';
        try { html = await this._fetchText(pageUrl); }
        catch (e) { failures.push(`Webseite: ${e.message}`); }
        if (html) {
          try { news = this._parseHtml(html, pageUrl); source = 'Webseite'; }
          catch (e) { failures.push(`HTML: ${e.message}`); }
          if (!news.length && !this._config.feed_url) {
            const dom = new DOMParser().parseFromString(html, 'text/html');
            const feedLink = Array.from(dom.querySelectorAll('a[href],link[href]')).find(el =>
              /rss|pressemitteilungen abonnieren/i.test(
                [el.getAttribute('href'), el.getAttribute('type'), el.textContent].join(' '))
            );
            if (feedLink) {
              try {
                const url = new URL(feedLink.getAttribute('href'), pageUrl).href;
                news = this._parseFeed(await this._fetchText(url), url); source = 'RSS';
              } catch (e) { failures.push(`RSS-Erkennung: ${e.message}`); }
            }
          }
        }
      }
      if (!news.length) throw new Error(failures.join(' | ') || 'Keine Pressemitteilungen auf der Quellseite erkannt.');
      if (id !== this._requestId || !this.isConnected) return;
      this._news = news;
      this._source = source;
      this._status = 'ok';
      this._error = '';
    } catch (err) {
      if (id !== this._requestId || !this.isConnected) return;
      this._status = this._news.length ? 'stale' : 'error';
      this._error = String(err?.message || err) +
        ' — Wenn der Browserabruf HTTP 200 liefert, bitte die HTML-Struktur prüfen.';
    }
    this._render();
  }

  // The Schwerin CMS currently publishes internal http://10.1.1.252/news/...
  // links in its HTML. Convert only this known origin to the public website.
  _publicArticleUrl(href, base) {
    let url;
    try { url = new URL(href, base); } catch { return ''; }
    if (url.hostname === '10.1.1.252' && url.protocol === 'http:') {
      url.protocol = 'https:';
      url.hostname = 'www.schwerin.de';
      url.port = '';
    }
    if (url.protocol !== 'https:' || !/(^|\.)schwerin\.de$/i.test(url.hostname)) return '';
    if (!url.pathname.startsWith('/news/')) return '';
    return url.href;
  }

  _parseHtml(html, base) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pattern = /\b(\d{2})\.(\d{2})\.(20\d{2})\b/;
    const items = new Map();
    // Confirmed on the live page: headlines are inside .event-item-content.
    const headlines = doc.querySelectorAll('.event-item-content h2 a[href], .event-item-content h3 a[href], .event-item-content h4 a[href]');
    for (const anchor of headlines) {
      const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      if (title.length < 8) continue;
      const url = this._publicArticleUrl(anchor.getAttribute('href'), base);
      if (!url) continue;

      const content = anchor.closest('.event-item-content');
      if (!content) continue;
      // The date/category may precede .event-item-content in its enclosing item.
      let block = content;
      let dateMatch = null;
      let metadata = '';
      for (let depth = 0; depth < 4 && block; depth++, block = block.parentElement) {
        const candidates = [];
        let preceding = block.previousElementSibling;
        for (let n = 0; preceding && n < 4; n++, preceding = preceding.previousElementSibling) {
          candidates.push((preceding.textContent || '').replace(/\s+/g, ' ').trim().slice(0,350));
        }
        const own = (block.textContent || '').replace(/\s+/g, ' ').trim();
        candidates.push(own.slice(0,250));
        const found = candidates.find(text => pattern.test(text));
        if (found) {
          metadata = found;
          dateMatch = found.match(pattern);
          break;
        }
      }
      if (!dateMatch) continue;
      const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      // Only take text immediately before a date for a possible official category.
      let category = (metadata.split(dateMatch[0])[0] || '').trim();
      category = category.replace(/^(?:Pressemitteilungen|News|Aktuelles)\s*/i, '').slice(-100);
      if (category.length > 80 || category.includes(title.slice(0,18))) category = '';
      const summary = content.querySelector('p');
      const description = (summary?.textContent || '').replace(/\s+/g,' ').trim().slice(0,260);
      if (!items.has(url)) items.set(url, {title, url, date, category, description});
    }
    return [...items.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,120);
  }

  async _fetchText(url) {
    const parsed = new URL(url, this._config.page_url);
    if (parsed.protocol !== 'https:') throw new Error('Nur HTTPS-Quellen sind erlaubt.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(parsed.href, {signal:controller.signal, credentials:'omit'});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${parsed.hostname}`);
      return await response.text();
    } finally { clearTimeout(timeout); }
  }

  _parseFeed(xml, base) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Ungültiger RSS-/Atom-Feed.');
    const entries = Array.from(doc.querySelectorAll('item, entry'));
    const get = (node, tag) => {
      const child = Array.from(node.children).find(el => el.localName === tag);
      return child?.textContent?.trim() || '';
    };
    const clean = value => {
      const fragment = new DOMParser().parseFromString(value || '', 'text/html');
      return (fragment.body.textContent || '').replace(/\s+/g,' ').trim().slice(0,260);
    };
    const items = entries.map(el => {
      const title = get(el,'title');
      const linkTag = Array.from(el.children).find(x => x.localName === 'link' && (!x.getAttribute('rel') || x.getAttribute('rel') === 'alternate'));
      const link = linkTag?.getAttribute('href') || get(el,'link');
      const dateRaw = get(el,'pubDate') || get(el,'published') || get(el,'updated') || get(el,'date');
      const parsed = new Date(dateRaw);
      const date = Number.isNaN(parsed.valueOf()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`;
      let url = '';
      try { const u = new URL(link, base); if (u.protocol === 'https:') url = u.href; } catch {}
      const description = clean(get(el,'description') || get(el,'summary') || get(el,'encoded') || get(el,'content'));
      return {title, url, date, description, category:get(el,'category')};
    }).filter(x => x.title && x.url);
    return items.sort((a,b) => b.date.localeCompare(a.date)).slice(0,100);
  }

  getCardSize() { return this._expanded ? 7 : 2; }
  getGridOptions() { return {columns: 12, min_columns: 4, rows: this._expanded ? 7 : 2, min_rows: 2}; }

  _dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  _parseDate(raw) {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    let y, m, d;
    let match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (match) { d=+match[1]; m=+match[2]; y=+match[3]; }
    else {
      match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
      if (!match) return null;
      y=+match[1]; m=+match[2]; d=+match[3];
    }
    const date = new Date(y, m-1, d);
    return (date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d) ? date : null;
  }

  _topic(item) {
    const official = String(item.category || '').toLocaleLowerCase('de');
    if (/verkehr|ordnung|sicherheit/.test(official)) return 'Verkehr';
    if (/bildung|schule|jugend|familie/.test(official)) return 'Bildung';
    if (/politik|verwaltung/.test(official)) return 'Politik & Verwaltung';
    if (/kultur|veranstaltung/.test(official)) return 'Kultur & Veranstaltungen';
    if (/bau|stadtentwicklung|wohnen/.test(official)) return 'Bauen & Stadtentwicklung';
    const text = `${item.title || ''} ${item.description || ''}`.toLocaleLowerCase('de');
    const groups = [
      ['Verkehr', /verkehr|baustell|straßen|strassen|sperrung|bus|bahn|parkpl[aä]tz|radweg|br[uü]ck/],
      ['Bildung', /schul|bildung|kita|kindergarten|jugend|unterricht|bibliothek/],
      ['Politik & Verwaltung', /stadtvertret|ausschuss|verwaltung|b[uü]rgermeister|haushalt|satzung|politik/],
      ['Kultur & Veranstaltungen', /veranstaltung|konzert|kultur|museum|theater|festival|fest|ausstellung/],
      ['Bauen & Stadtentwicklung', /wohn|bauprojekt|stadtentwicklung|sanierung|quartier|bebauungsplan/],
    ];
    return (groups.find(([, re]) => re.test(text)) || ['Sonstiges'])[0];
  }

  _el(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined && value !== null) el.textContent = String(value);
    return el;
  }

  _items() {
    const entity = this._hass?.states?.[this._config?.entity];
    return this._news;
  }

  _render() {
    if (!this._config) return;
    const root = this.shadowRoot;
    root.replaceChildren();
    const style = this._el('style');
    style.textContent = `
      :host { display:block; color:var(--primary-text-color); }
      ha-card { display:block; overflow:hidden; }
      .header {width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:transparent;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit;box-sizing:border-box;}
      .heading {font-size:16px;font-weight:650;line-height:1.35;}
      .sub {font-size:12px;color:var(--secondary-text-color);margin-top:4px;}
      .arrow {font-size:18px;color:var(--secondary-text-color);flex-shrink:0;}
      .body {padding:0 18px 12px;}
      .filters {display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 10px;}
      select,input {width:100%;box-sizing:border-box;min-width:0;background:var(--card-background-color, var(--ha-card-background, #fff));color:var(--primary-text-color);border:1px solid var(--divider-color,#ddd);border-radius:9px;padding:9px;font:inherit;font-size:13px;}
      input {grid-column:1 / -1;}
      .entry {padding:12px 0;border-top:1px solid var(--divider-color,#ddd);}
      .entry a {color:var(--primary-text-color);font-size:14px;font-weight:600;text-decoration:none;line-height:1.4;}
      .entry a:hover {color:var(--primary-color);text-decoration:underline;}
      .meta {color:var(--secondary-text-color);font-size:11px;margin:5px 0 4px;}
      .desc {font-size:12px;line-height:1.5;color:var(--secondary-text-color);white-space:normal;}
      .notice {font-size:13px;color:var(--secondary-text-color);padding:12px 0;}
      .footer {font-size:11px;color:var(--secondary-text-color);padding:10px 0 0;border-top:1px solid var(--divider-color,#ddd);}
      button:focus-visible,input:focus-visible,select:focus-visible {outline:2px solid var(--primary-color);outline-offset:2px;}
      @media(max-width:350px){ .filters {grid-template-columns:1fr;} }
    `;
    root.append(style);
    const card = this._el('ha-card');
    root.append(card);
    const items = this._items();
    const today = this._dateKey(new Date());
    const todayCount = items.filter(item => {const date=this._parseDate(item.date);return date && this._dateKey(date)===today;}).length;
    const header = this._el('button', 'header');
    header.type = 'button';
    header.setAttribute('aria-expanded', String(this._expanded));
    const headingBox = this._el('div');
    headingBox.append(this._el('div', 'heading', this._config.title));
    let sub;
    if (this._status === 'loading') sub = 'Lade Nachrichten …';
    else if (this._status === 'error') sub = 'Nachrichtenquelle nicht erreichbar';
    else sub = `${todayCount} ${todayCount === 1 ? 'Meldung' : 'Meldungen'} heute · ${items.length} geladen${this._status === 'stale' ? ' · Daten möglicherweise veraltet' : ''}`;
    headingBox.append(this._el('div','sub',sub));
    header.append(headingBox, this._el('span','arrow', this._expanded ? '▴' : '▾'));
    header.addEventListener('click', () => { this._expanded = !this._expanded; this._render(); });
    card.append(header);
    if (!this._expanded) return;
    const body = this._el('div','body');
    card.append(body);
    if (this._status === 'error' || this._status === 'loading') {
      body.append(this._el('div','notice',this._status === 'loading' ? 'Pressemitteilungen werden geladen …' : this._error));
      return;
    }
    if (this._status === 'stale') body.append(this._el('div','notice',this._error));
    const filters = this._el('div','filters');
    body.append(filters);
    const period = this._el('select');
    period.setAttribute('aria-label','Zeitraum');
    for (const text of ['Alle','Heute','Letzte 7 Tage','Letzte 30 Tage']) {
      const option=this._el('option', '', text);option.value=text;period.append(option);
    }
    period.value=this._period;
    period.addEventListener('change',e=>{this._period=e.target.value;this._render();});
    filters.append(period);
    const category = this._el('select');
    category.setAttribute('aria-label','Thema');
    const categories=['Alle Themen','Verkehr','Bildung','Politik & Verwaltung','Kultur & Veranstaltungen','Bauen & Stadtentwicklung','Sonstiges'];
    for (const text of categories){const option=this._el('option','',text);option.value=text;category.append(option);}
    category.value=this._category;
    category.addEventListener('change',e=>{this._category=e.target.value;this._render();});
    filters.append(category);
    const search=this._el('input');search.type='search';search.placeholder='Stichwort suchen …';search.setAttribute('aria-label','Stichwort suchen');search.value=this._search;
    search.addEventListener('input',e=>{this._search=e.target.value;this._renderEntries(list,footer);});
    filters.append(search);
    const list=this._el('div');body.append(list);
    const footer=this._el('div','footer');body.append(footer);
    this._renderEntries(list,footer);
  }

  _renderEntries(list,footer) {
    list.replaceChildren();
    const now = new Date();
    const start = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if (this._period==='Letzte 7 Tage') start.setDate(start.getDate()-6);
    if (this._period==='Letzte 30 Tage') start.setDate(start.getDate()-29);
    const today = this._dateKey(now);
    const needle=this._search.trim().toLocaleLowerCase('de');
    const filtered=this._items().filter(item=>{
      const date=this._parseDate(item.date);
      if (this._period==='Heute' && (!date || this._dateKey(date)!==today)) return false;
      if (this._period!=='Alle' && this._period!=='Heute' && (!date || date < start || date > now)) return false;
      if (this._category!=='Alle Themen' && this._topic(item)!==this._category) return false;
      return `${item.title||''} ${item.description||''}`.toLocaleLowerCase('de').includes(needle);
    }).sort((a,b)=>(this._parseDate(b.date)?.getTime()||0)-(this._parseDate(a.date)?.getTime()||0));
    const max=Math.max(1,Math.min(50,Number(this._config.max_items)||10));
    if (!filtered.length) list.append(this._el('div','notice','Keine passenden Meldungen gefunden.'));
    for (const item of filtered.slice(0,max)) {
      const entry=this._el('article','entry');
      const title=this._el('a','',item.title || 'Pressemitteilung');
      let url;
      try {url=new URL(item.url, 'https://www.schwerin.de');} catch {url=null;}
      if (url && ['https:', 'http:'].includes(url.protocol)) {
        title.href=url.href;title.target='_blank';title.rel='noopener noreferrer';
      } else { title.removeAttribute('href'); }
      entry.append(title);
      entry.append(this._el('div','meta',`${item.date || 'Ohne Datum'} · ${this._topic(item)}`));
      entry.append(this._el('div','desc',item.description || 'Keine Kurzbeschreibung verfügbar.'));
      list.append(entry);
    }
    footer.textContent=`${Math.min(filtered.length,max)} von ${filtered.length} passenden Meldungen angezeigt · ${this._items().length} aus ${this._source || "Quelle"} geladen`;
  }
}
if (!customElements.get('schwerin-news-card')) customElements.define('schwerin-news-card', SchwerinNewsCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c=>c.type==='schwerin-news-card')) window.customCards.push({type:'schwerin-news-card',name:'Schwerin Pressemitteilungen',description:'Klappbare Nachrichtenkarte mit Tageszähler, Themen- und Textfilter',preview:false});
