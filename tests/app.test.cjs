const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Run the shipped scripts with a controlled clock and browser boundary. Tests
// exercise the same event handlers and timer code that the static page loads.
function app({ storage = {}, locale = 'en-US', failWrites = false } = {}) {
  let now = 0;
  const elements = new Map();
  const events = {};
  const values = new Map(Object.entries(storage));
  function element() {
    const attrs = {};
    return {
      textContent: '', style: {}, children: [], open: false, tagName: 'DIV',
      classList: { toggle() {} }, setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, handler) { (this.events ??= {})[name] = handler; },
      click() { this.onclick?.(); }, showModal() { this.open = true; },
      close() { this.open = false; }, focus() {},
      set innerHTML(value) { this.textContent = value.replace(/<[^>]*>/g, ''); },
    };
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const document = {
    body: element(), documentElement: element(), hidden: false,
    getElementById: get, createElement: element,
    querySelectorAll: () => [], querySelector: () => get('manifest'),
    createTreeWalker: () => ({ nextNode: () => false }),
    addEventListener: (name, handler) => { events[name] = handler; },
  };
  const context = vm.createContext({
    document, navigator: { languages: [locale] }, NodeFilter: { SHOW_TEXT: 4 },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { if (failWrites) throw Error('quota'); values.set(key, value); },
    },
    performance: { now: () => now },
    window: { addEventListener() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    fetch: async () => ({ ok: true, json: async () => ({ version: '0.1.0' }) }),
  });
  for (const file of ['i18n.js', 'app.js']) {
    vm.runInContext(readFileSync(path.join(__dirname, '../dist', file), 'utf8'), context);
  }
  // Mute at the browser boundary; audio is verified by browser/manual testing.
  vm.runInContext('muted=true', context);
  return {
    get, values, events, run: source => vm.runInContext(source, context),
    advance(ms) { now += ms; vm.runInContext('tick()', context); },
    state: () => JSON.parse(vm.runInContext('JSON.stringify({mode,work,rest,minutes,running,phase,cycle,remaining,finished,presets})', context)),
  };
}

test('format rounds remaining seconds up and clamps expired time', () => {
  const a = app();
  for (const [seconds, expected] of [[0, '00:00'], [-2, '00:00'], [.01, '00:01'], [59.1, '01:00'], [3599, '59:59']]) {
    assert.equal(a.run(`fmt(${seconds})`), expected);
  }
});

test('interval timer catches up across multiple work/rest boundaries', () => {
  const a = app();
  a.get('start').click();
  a.advance(40000);
  assert.equal(a.state().phase, 'rest');
  assert.equal(a.state().remaining, 20000);
  a.advance(85000);
  assert.deepEqual([a.state().phase, a.state().cycle, a.state().remaining], ['work', 3, 35000]);
});

test('pause preserves elapsed time and resume ignores time spent paused', () => {
  const a = app();
  a.get('start').click();
  a.advance(12500);
  a.get('start').click();
  a.advance(100000);
  assert.equal(a.state().remaining, 27500);
  assert.equal(a.state().running, false);
  a.get('start').click();
  a.advance(500);
  assert.equal(a.state().remaining, 27000);
  a.get('reset').click();
  assert.deepEqual([a.state().running, a.state().cycle, a.state().phase, a.state().remaining], [false, 1, 'work', 40000]);
});

test('EMoM stops at configured minute count and can restart', () => {
  const a = app();
  a.get('mmom').click();
  a.run("change('minutes',2)");
  a.get('start').click();
  a.advance(60000);
  assert.equal(a.state().cycle, 2);
  a.advance(60000);
  assert.deepEqual([a.state().running, a.state().finished, a.state().remaining], [false, true, 0]);
  a.get('start').click();
  assert.deepEqual([a.state().running, a.state().finished, a.state().cycle, a.state().remaining], [true, false, 1, 60000]);
});

test('settings validate bounds, persist, and ignore edits during a workout', () => {
  const a = app();
  a.run("change('work',99999);change('rest',0);change('minutes',3.6)");
  assert.deepEqual([a.state().work, a.state().rest, a.state().minutes], [3599, 20, 4]);
  assert.equal(JSON.parse(a.values.get('tempo-settings')).work, 3599);
  a.get('start').click();
  a.run("change('work',10)");
  assert.equal(a.state().work, 3599);
});

test('invalid stored settings cannot prevent startup', () => {
  for (const value of ['null', '[]', 'false', '"oops"', '{broken']) {
    const a = app({ storage: { 'tempo-settings': value } });
    assert.deepEqual([a.state().work, a.state().rest, a.state().minutes], [40, 20, 10]);
  }
});

test('stored presets discard invalid entries and enforce the 16-item limit', () => {
  const entries = [null, { work: 0, rest: 20 }, { work: 1, rest: 3600 }, ...Array.from({ length: 20 }, (_, i) => ({ work: i + 1, rest: 20 }))];
  const a = app({ storage: { 'tempo-presets': JSON.stringify(entries) } });
  assert.equal(a.state().presets.length, 16);
  assert.deepEqual(a.state().presets[0], { work: 1, rest: 20 });
});

test('preset save deduplicates; loading restores settings; delete persists', () => {
  const a = app();
  a.get('save').click();
  a.get('save').click();
  assert.equal(a.state().presets.length, 1);
  a.run("change('work',12)");
  a.get('presetList').children[0].children[0].click();
  assert.equal(a.state().work, 40);
  a.get('presetList').children[0].children[1].click();
  assert.deepEqual(JSON.parse(a.values.get('tempo-presets')), []);
});

test('storage failure rolls back preset save and deletion', () => {
  const a = app({ failWrites: true });
  a.get('save').click();
  assert.equal(a.state().presets.length, 0);
  const b = app({ failWrites: true, storage: { 'tempo-presets': '[{"work":10,"rest":20}]' } });
  b.get('presetList').children[0].children[1].click();
  assert.equal(b.state().presets.length, 1);
});

test('locale selects Polish or English with untranslated fallback', () => {
  const pl = app({ locale: 'pl-PL' });
  const en = app({ locale: 'fr-FR' });
  assert.equal(pl.run("t('PRACA')"), 'PRACA');
  assert.equal(en.run("t('PRACA')"), 'WORK');
  assert.equal(en.run("t('reset')"), 'reset');
  assert.equal(en.run("t('unknown')"), 'unknown');
});

test('keyboard shortcuts control timer but do not fire inside controls or dialogs', () => {
  const a = app();
  const space = tagName => ({ target: { tagName }, code: 'Space', key: ' ', preventDefault() {} });
  a.events.keydown(space('BODY'));
  assert.equal(a.state().running, true);
  a.events.keydown(space('INPUT'));
  assert.equal(a.state().running, true);
  for (const dialog of ['settingsDialog', 'installHelp', 'aboutDialog']) {
    a.get(dialog).open = true;
    a.events.keydown(space('BODY'));
    assert.equal(a.state().running, true);
    a.get(dialog).open = false;
  }
  a.events.keydown({ target: { tagName: 'BODY' }, key: 'R' });
  assert.equal(a.state().running, false);
});

test('About dialog opens and closes and displays the release JSON version', async () => {
  const a = app();
  a.get('aboutOpen').click();
  assert.equal(a.get('aboutDialog').open, true);
  a.get('aboutClose').click();
  assert.equal(a.get('aboutDialog').open, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.get('appVersion').textContent, '0.1.0');
});
