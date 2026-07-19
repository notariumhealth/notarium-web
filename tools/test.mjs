// Run: node --test tools/test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from './render.mjs';

test('trailing single-line dash block is the signature', () => {
  const { sections } = parse('# T\n\nlead\n\n## S\n\nbody\n\n- Sophia');
  assert.equal(sections[0].signature, '- Sophia');
  assert.equal(sections[0].blocks.length, 1);
});

test('multi-line dash block is a list, not a signature', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n- three';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.deepEqual(sections[0].blocks, [
    { kind: 'ul', items: ['one', 'two', 'three'] },
  ]);
});

test('a list followed by more prose is still a list', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n\nafter';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.equal(sections[0].blocks[0].kind, 'ul');
  assert.deepEqual(sections[0].blocks[1], { kind: 'p', text: 'after' });
});

test('h3 becomes a subsection block, not literal text', () => {
  const { sections } = parse('# T\n\nlead\n\n## S\n\n### Sub\n\nbody');
  assert.deepEqual(sections[0].blocks[0], { kind: 'h3', text: 'Sub' });
  assert.deepEqual(sections[0].blocks[1], { kind: 'p', text: 'body' });
});

test('board.md renders its reasons as a list with no signature', () => {
  const md = [
    '# Board', '', 'lead', '', '## Why a board, and why now', '',
    'Notarium shipped its first public alpha.', '',
    '- Opens grant channels the LLC could not access.',
    '- Locks the mission.',
    '- Supports long-term sustainability.', '',
    'A working board is the anchor for all three.',
  ].join('\n');
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.equal(sections[0].blocks[1].kind, 'ul');
  assert.equal(sections[0].blocks[1].items.length, 3);
});

test('a list interrupted by a stray blank line keeps every item, no signature', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n\n- three';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.deepEqual(sections[0].blocks, [
    { kind: 'ul', items: ['one', 'two', 'three'] },
  ]);
});

test('a document ending on a single bullet with another list elsewhere has no signature', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n\nmiddle\n\n- three';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.deepEqual(sections[0].blocks, [
    { kind: 'ul', items: ['one', 'two'] },
    { kind: 'p', text: 'middle' },
    { kind: 'ul', items: ['three'] },
  ]);
});

test('a single trailing bullet with no other list in the document is still a signature', () => {
  const md = '# T\n\nlead\n\n## S\n\nfirst paragraph\n\nsecond paragraph\n\n- Sophia';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, '- Sophia');
  assert.deepEqual(sections[0].blocks, [
    { kind: 'p', text: 'first paragraph' },
    { kind: 'p', text: 'second paragraph' },
  ]);
});

// --- Shared base-style region ----------------------------------------------
// The palette used to be copy-pasted per page, so a token that failed contrast
// failed in every copy independently. It now lives in styles/base.css and is
// injected by tools/build.mjs between markers. These tests are the invariant:
// if a page loses its markers, or a page's region drifts from the others, the
// injection silently stopped covering that page.

const SERVED = [
  'web/index.html', 'web/about.html', 'web/404.html',
  'web/security/index.html', 'web/logo-poll/index.html',
  'web/thanks-for-voting/index.html',
];

function baseRegion(path) {
  const html = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const m = html.match(/\/\* BEGIN base \*\/([\s\S]*?)\/\* END base \*\//);
  assert.ok(m, `${path} has no base-style region`);
  return m[1];
}

test('every served page carries a byte-identical base style region', () => {
  const regions = SERVED.map(baseRegion);
  for (let i = 1; i < regions.length; i++) {
    assert.equal(regions[i], regions[0], `${SERVED[i]} diverged from ${SERVED[0]}`);
  }
});

test('the base palette meets the contrast floors it was fixed for', () => {
  const css = baseRegion('web/index.html');
  assert.match(css, /--muted:\s*#82869A/i, 'muted must be the AA-passing value');
  assert.doesNotMatch(css, /#7A7E8D/i, 'the failing muted value must be gone');
});
