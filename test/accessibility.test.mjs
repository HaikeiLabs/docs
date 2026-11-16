import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('Escape closes the open menu and returns focus to its toggle', async () => {
  const source = await readFile('assets/site.js', 'utf8');
  const handlers = {}; let open = false; let focused = false; let expanded = 'false';
  const nav = { addEventListener(type, fn) { handlers.nav = fn; }, setAttribute(name, value) { expanded = value; }, focus() { focused = true; } };
  const toggle = { addEventListener() {} };
  const document = { documentElement: { dataset: {} }, body: { classList: { toggle() { return open = !open; }, contains() { return open; }, remove() { open = false; } } }, querySelector(s) { return s === '.nav-toggle' ? nav : s === '.theme-toggle' ? toggle : null; }, querySelectorAll() { return []; }, addEventListener(type, fn) { handlers[type] = fn; } };
  const window = { document };
  vm.runInNewContext(source, { window, document, location: {}, navigator: {}, setTimeout, URL });
  handlers.nav(); assert.equal(expanded, 'true');
  handlers.keydown({ key: 'Escape' });
  assert.equal(open, false); assert.equal(expanded, 'false'); assert.equal(focused, true);
});

test('small text on ground uses muted rather than faint', async () => {
  const css = await readFile('assets/site.css', 'utf8');
  for (const selector of ['validated', 'footer', 'pager-label', 'home-card span']) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*color:\\s*var\\(--color-muted\\)`));
  }
});
