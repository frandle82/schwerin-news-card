const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('hacs.json references the distributed JavaScript file', () => {
  const hacs = JSON.parse(fs.readFileSync(path.join(root, 'hacs.json'), 'utf8'));

  assert.equal(hacs.name, 'Schwerin News Card');
  assert.equal(hacs.filename, 'schwerin-news-card.js');
  assert.equal(hacs.render_readme, true);
  assert.equal(fs.existsSync(path.join(root, hacs.filename)), true);
});

test('package and card header use the same semantic version', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const card = fs.readFileSync(path.join(root, 'schwerin-news-card.js'), 'utf8');

  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(card, new RegExp(`Schwerin News Card v${packageJson.version.replaceAll('.', '\\.')}`));
});

test('readme documents the current release version', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  assert.match(readme, new RegExp(`v${packageJson.version.replaceAll('.', '\\.')}`));
});
