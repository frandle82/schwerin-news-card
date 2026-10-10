const path = require('node:path');

class TestNode {
  constructor(tagName = '#document', attrs = {}) {
    this.tagName = tagName;
    this.localName = tagName.toLowerCase();
    this.attrs = attrs;
    this.children = [];
    this.parentElement = null;
    this._text = '';
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  get textContent() {
    return `${this._text}${this.children.map((child) => child.textContent).join('')}`;
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    return index > 0 ? siblings[index - 1] : null;
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSimpleSelector(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return selectAll(this, selector);
  }
}

class TestDocument extends TestNode {
  constructor(root) {
    super('#document');
    if (root) this.appendChild(root);
    this.body = findFirst(this, 'body') || root || this;
  }
}

class TestDOMParser {
  parseFromString(markup) {
    return parseMarkup(markup);
  }
}

function parseAttrs(value) {
  const attrs = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  let match;
  while ((match = pattern.exec(value))) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function decodeText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function parseMarkup(markup) {
  const root = new TestNode('document');
  const stack = [root];
  const pattern = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\/([:\w-]+)\s*>|<([:\w-]+)([^>]*)>|([^<]+)/g;
  let match;

  while ((match = pattern.exec(markup))) {
    if (match[1] !== undefined) {
      stack[stack.length - 1]._text += match[1];
      continue;
    }
    if (match[2]) {
      const closing = match[2].toLowerCase();
      while (stack.length > 1 && stack[stack.length - 1].localName !== closing) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (match[3]) {
      const rawAttrs = match[4] || '';
      const node = new TestNode(match[3], parseAttrs(rawAttrs));
      stack[stack.length - 1].appendChild(node);
      const htmlVoidLink = node.localName === 'link' && rawAttrs.trim();
      if (!/\/\s*$/.test(rawAttrs) && !['br', 'hr', 'img', 'input', 'meta'].includes(node.localName) && !htmlVoidLink) {
        stack.push(node);
      }
      continue;
    }
    if (match[5]) {
      stack[stack.length - 1]._text += decodeText(match[5]);
    }
  }

  return new TestDocument(root);
}

function findFirst(node, tagName) {
  if (node.localName === tagName) return node;
  for (const child of node.children) {
    const found = findFirst(child, tagName);
    if (found) return found;
  }
  return null;
}

function descendants(node) {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

function matchesSimpleSelector(node, selector) {
  const attrMatch = selector.match(/\[([:\w-]+)\]$/);
  const attrName = attrMatch?.[1];
  const clean = selector.replace(/\[[:\w-]+\]$/, '');

  if (attrName && node.getAttribute(attrName) === null) return false;
  if (clean.startsWith('.')) {
    return String(node.getAttribute('class') || '').split(/\s+/).includes(clean.slice(1));
  }
  return !clean || node.localName === clean.toLowerCase();
}

function matchesChain(node, parts) {
  let current = node;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (!current || !matchesSimpleSelector(current, parts[index])) return false;
    if (index === 0) return true;

    current = current.parentElement;
    while (current && !matchesSimpleSelector(current, parts[index - 1])) current = current.parentElement;
  }
  return true;
}

function selectAll(node, selector) {
  const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);
  const found = [];
  const all = descendants(node);

  for (const candidate of all) {
    if (selectors.some((part) => matchesChain(candidate, part.split(/\s+/)))) {
      found.push(candidate);
    }
  }

  return found;
}

function loadCard() {
  const cardPath = path.resolve(__dirname, '../../schwerin-news-card.js');
  delete require.cache[cardPath];

  global.DOMParser = TestDOMParser;
  global.HTMLElement = class {
    attachShadow() {
      return { replaceChildren() {}, append() {} };
    }
  };
  global.customElements = {
    get() {
      return undefined;
    },
    define() {},
  };
  global.customCards = [];

  require(cardPath);
  return global.SchwerinNewsCardHelpers;
}

module.exports = { loadCard };
