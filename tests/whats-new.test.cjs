const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../newtab.js'), 'utf8').split('// Initialize the Homepage')[0];

function setup(feed, stored = { whatsNewPendingFrom: '1.0.0', lastSeenVersion: '1.0.0' }) {
  const result = { dismissed: false, rendered: null, writes: [], fetched: false };
  const modal = { style: {} };
  const context = {
    chrome: {
      runtime: { getManifest: () => ({ version: '1.0.1' }) },
      storage: { local: { get: async () => stored, set: async value => result.writes.push(value) } }
    },
    fetch: async () => { result.fetched = true; return { ok: true, json: async () => feed }; },
    document: { getElementById: () => modal }
  };
  vm.runInNewContext(source + '\nthis.Homepage = Homepage;', context);
  const homepage = Object.create(context.Homepage.prototype);
  homepage.dismissWhatsNew = async () => { result.dismissed = true; };
  homepage.renderWhatsNewEntries = entries => { result.rendered = entries; };
  return { homepage, result, modal };
}

test('a delayed or empty feed preserves pending release notes for retry', async () => {
  for (const feed of [{ latestVersion: '1.0.0', entries: [] }, { latestVersion: null, entries: [] }]) {
    const { homepage, result } = setup(feed);
    await homepage.checkWhatsNew();
    assert.equal(result.dismissed, false);
    assert.equal(result.rendered, null);
    assert.equal(result.writes.length, 0);
  }
});

test('a ready feed shows only newly installed release notes', async () => {
  const { homepage, result, modal } = setup({ latestVersion: '1.0.2', entries: [{ version: '1.0.2' }, { version: '1.0.1' }, { version: '1.0.0' }] });
  await homepage.checkWhatsNew();
  assert.equal(result.rendered.length, 1);
  assert.equal(result.rendered[0].version, '1.0.1');
  assert.equal(modal.style.display, 'flex');
  assert.equal(result.dismissed, false);
});

test('first install records a baseline without showing release notes', async () => {
  const { homepage, result } = setup({}, {});
  await homepage.checkWhatsNew();
  assert.equal(result.fetched, false);
  assert.equal(result.writes[0].lastSeenVersion, '1.0.1');
});
