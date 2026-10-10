/* Schwerin News Card v1.0 — Home Assistant custom card, no dependencies */
class SchwerinNewsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._expanded = false;
    this._period = 'Alle';
    this._category = 'Alle Themen';
    this._search = '';
    this._lastSignature = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('Bitte entity festlegen, z. B. sensor.schwerin_pressemitteilungen');
    this._config = {
      title: 'Schwerin – Pressemitteilungen',
      max_items: 10,
      default_open: false,
      ...config,
    };
    this._expanded = Boolean(this._config.default_open);
    this._lastSignature = null;
    this._render();
  }

  set hass(value) {
    this._hass = value;
    const entity = value?.states?.[this._config?.entity];
    const signature = JSON.stringify({state: entity?.state, items: entity?.attributes?.items, today: this._dateKey(new Date())});
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this._render();
    }
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
    const data = entity?.attributes?.items;
    return Array.isArray(data) ? data.filter(x => x && typeof x === 'object') : [];
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
    const entity = this._hass?.states?.[this._config.entity];
    const today = this._dateKey(new Date());
    const todayCount = items.filter(item => {const date=this._parseDate(item.date);return date && this._dateKey(date)===today;}).length;
    const header = this._el('button', 'header');
    header.type = 'button';
    header.setAttribute('aria-expanded', String(this._expanded));
    const headingBox = this._el('div');
    headingBox.append(this._el('div', 'heading', this._config.title));
    let sub;
    if (!entity) sub = 'Sensor nicht gefunden';
    else if (entity.state !== 'ok') sub = 'Nachrichtenquelle derzeit nicht verfügbar';
    else sub = `${todayCount} ${todayCount === 1 ? 'Meldung' : 'Meldungen'} heute · ${items.length} geladen`;
    headingBox.append(this._el('div','sub',sub));
    header.append(headingBox, this._el('span','arrow', this._expanded ? '▴' : '▾'));
    header.addEventListener('click', () => { this._expanded = !this._expanded; this._render(); });
    card.append(header);
    if (!this._expanded) return;
    const body = this._el('div','body');
    card.append(body);
    if (!entity || entity.state !== 'ok') {
      body.append(this._el('div','notice',entity?.attributes?.error || 'Bitte Sensorstatus und RSS-Abruf kontrollieren.'));
      return;
    }
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
    footer.textContent=`${Math.min(filtered.length,max)} von ${filtered.length} passenden Meldungen angezeigt · ${this._items().length} im Sensor geladen`;
  }
}
if (!customElements.get('schwerin-news-card')) customElements.define('schwerin-news-card', SchwerinNewsCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c=>c.type==='schwerin-news-card')) window.customCards.push({type:'schwerin-news-card',name:'Schwerin Pressemitteilungen',description:'Klappbare Nachrichtenkarte mit Tageszähler, Themen- und Textfilter',preview:false});
