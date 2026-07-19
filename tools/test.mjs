// Run: node --test tools/test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from './render.mjs';
import { PAGES, HAND_MAINTAINED, STYLE_PAGES, SCRIPT_PAGES } from './pages.mjs';

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

test('an HTML comment is stripped, not rendered as a paragraph', () => {
  const md = '# T\n\n<!-- editor note\n   spanning lines -->\n\nlead\n\n## S\n\nbody';
  const { intro, sections } = parse(md);
  assert.deepEqual(intro, [{ kind: 'p', text: 'lead' }]);
  assert.equal(sections[0].blocks[0].text, 'body');
  // The comment must not have leaked into any parsed block.
  assert.ok(!JSON.stringify({ intro, sections }).includes('editor note'));
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
  'web/index.html', 'web/about.html', 'web/roadmap/index.html', 'web/404.html',
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

// --- Contrast, computed rather than pinned by string ------------------------
// Asserting the literal hex only proves the hex did not change; swapping in a
// different failing grey would still pass. These helpers implement WCAG 2.1
// relative luminance and contrast ratio directly (no dependencies), so the
// assertion is about the property that was broken, not the string that fixed
// it once.

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function tokens(css) {
  const out = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[name] = value;
  }
  return out;
}

// The token a form control's resting border resolves to, read out of the page
// rather than assumed. Finding F-3 recurred because the base rule was correct
// while every page-local rule that actually applied was not.
function controlBorderTokens(path) {
  const html = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const style = html.match(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/);
  assert.ok(style, `${path} has no inline style block`);
  const found = [];
  // Every rule whose selector list mentions a form control type, a control
  // class, or an attribute selector on input, in its resting state (no
  // :hover / :focus / ::placeholder).
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selector, body] of style[1].matchAll(ruleRe)) {
    const sel = selector.trim();
    if (/:hover|:focus|::/.test(sel)) continue;
    const isControl = /(^|[\s,>+~])(input|select|textarea)([\s,.:[]|$)/.test(sel)
      || /\.waitlist-input(?![\w-])/.test(sel);
    if (!isControl) continue;
    const border = body.match(/\bborder(?:-color)?:\s*(?:[\dpx.]+\s+\w+\s+)?var\((--[\w-]+)\)/);
    if (border) found.push({ sel: sel.replace(/\s+/g, ' '), token: border[1] });
  }
  return found;
}

test('base palette tokens meet WCAG contrast floors, computed not pinned', () => {
  const t = tokens(baseRegion('web/index.html'));
  for (const name of ['--bg', '--surface', '--border', '--muted']) {
    assert.ok(t[name], `missing token ${name}`);
  }
  // Muted is used for normal-size body text on both backgrounds: 4.5:1 floor.
  const onBg = contrast(t['--muted'], t['--bg']);
  const onSurface = contrast(t['--muted'], t['--surface']);
  assert.ok(onBg >= 4.5, `--muted on --bg is ${onBg.toFixed(2)}:1, needs 4.5:1`);
  assert.ok(
    onSurface >= 4.5,
    `--muted on --surface is ${onSurface.toFixed(2)}:1, needs 4.5:1`,
  );
  // --border is a decorative card edge, not a control boundary. It is recorded
  // here as failing on purpose, so that if it ever creeps back onto a control
  // the test below has something concrete to reject.
  assert.ok(
    contrast(t['--border'], t['--bg']) < 3,
    '--border unexpectedly passes 3:1; the control-border test needs revisiting',
  );
});

test('every form control resting border resolves to a token passing 3:1', () => {
  const t = tokens(baseRegion('web/index.html'));
  let checked = 0;
  for (const path of SERVED) {
    for (const { sel, token } of controlBorderTokens(path)) {
      const value = t[token];
      assert.ok(value, `${path}: ${sel} uses unknown token ${token}`);
      // Non-text UI boundaries need 3:1 against the adjacent background. Both
      // --bg and --surface are used behind controls on this site, so require
      // the token to clear the floor against each.
      for (const bgName of ['--bg', '--surface']) {
        const ratio = contrast(value, t[bgName]);
        assert.ok(
          ratio >= 3,
          `${path}: "${sel}" border ${token} (${value}) is ${ratio.toFixed(2)}:1 `
          + `on ${bgName} (${t[bgName]}), needs 3:1`,
        );
      }
      checked++;
    }
  }
  // Guard the guard: if the selector scan stops matching, the loop above
  // would vacuously pass.
  assert.ok(checked >= 3, `expected to check several control borders, saw ${checked}`);
});

// --- Page-list agreement ----------------------------------------------------
// Four lists used to be maintained by hand with nothing tying them together.
// The dangerous direction is silent: a page in STYLE_PAGES but in neither
// PAGES nor HAND_MAINTAINED gets a correct hash pinned over its UNINJECTED
// style block, satisfying the CSP while the page ships unstyled.

test('SERVED, STYLE_PAGES, and PAGES + HAND_MAINTAINED describe the same pages', () => {
  const sorted = (xs) => [...new Set(xs)].sort();
  const injected = sorted([...HAND_MAINTAINED, ...PAGES.map((p) => p.out)]);
  assert.deepEqual(sorted(STYLE_PAGES), injected, 'STYLE_PAGES vs pages that get injected');
  assert.deepEqual(sorted(SERVED), injected, 'test SERVED vs pages that get injected');
  assert.equal(
    HAND_MAINTAINED.length + PAGES.length,
    injected.length,
    'a page is both rendered from Markdown and hand-maintained',
  );
});

test('script-pinned pages are served pages', () => {
  for (const p of SCRIPT_PAGES) assert.ok(SERVED.includes(p), `${p} is not a served page`);
});
