// Run: node --test tools/test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse, inline, fillTemplate } from './render.mjs';
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
  'web/index.html', 'web/about.html', 'web/roadmap/index.html',
  'web/board/index.html',
  'web/board/legal-governance/index.html',
  'web/board/finance-treasurer/index.html',
  'web/board/patient-community/index.html',
  'web/board/technical-security/index.html',
  'web/board/fundraising-development/index.html',
  'web/board/at-large/index.html',
  'web/code-of-conduct/index.html', 'web/account-conduct/index.html',
  'web/credits/index.html', 'web/404.html',
  'web/security/index.html', 'web/logo-poll/index.html',
  'web/thanks-for-voting/index.html', 'web/license/index.html',
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

// --- CSP hashes match the committed inline blocks ---------------------------
// This is the site's most catastrophic silent failure. tools/build.mjs pins a
// SHA-256 of each page's inline <style> (and the logo poll's inline <script>)
// into web/_headers. Edit a page's CSS and commit without re-running the
// build, and every check above still passes while the browser refuses that
// page's entire style block under the Content-Security-Policy: the page ships
// unstyled, and nothing in CI notices. Recompute each hash here exactly the
// way blockHash does and require it to be present in the CSP line, so a
// forgotten rebuild fails in the test run rather than in a visitor's browser.

function readServed(relPath) {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');
}

// Mirrors blockHash in tools/build.mjs: same tag regex, same single-block
// requirement, same base64 SHA-256 of the block's inner text. If that function
// changes, this must change with it or the assertion becomes meaningless.
function blockHash(relPath, tag) {
  const html = readServed(relPath);
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const all = [...html.matchAll(re)];
  assert.equal(all.length, 1, `${relPath} should have exactly one inline <${tag}>, saw ${all.length}`);
  return `'sha256-${createHash('sha256').update(all[0][1], 'utf8').digest('base64')}'`;
}

function cspLine() {
  const headers = readServed('web/_headers');
  const m = headers.match(/^(?:\s*)Content-Security-Policy:\s*(.*)$/m);
  assert.ok(m, 'web/_headers has no Content-Security-Policy line');
  return m[1];
}

test('every style page\'s committed inline style block is pinned in the CSP', () => {
  const csp = cspLine();
  assert.ok(STYLE_PAGES.length > 0, 'STYLE_PAGES is empty; this test would vacuously pass');
  for (const page of STYLE_PAGES) {
    const hash = blockHash(page, 'style');
    assert.ok(
      csp.includes(hash),
      `${page}: its inline <style> hashes to ${hash}, which is absent from the CSP style-src. `
      + 'Re-run `node tools/build.mjs` after editing page CSS or styles/base.css.',
    );
  }
});

test('every script page\'s committed inline script block is pinned in the CSP', () => {
  const csp = cspLine();
  assert.ok(SCRIPT_PAGES.length > 0, 'SCRIPT_PAGES is empty; this test would vacuously pass');
  for (const page of SCRIPT_PAGES) {
    const hash = blockHash(page, 'script');
    assert.ok(
      csp.includes(hash),
      `${page}: its inline <script> hashes to ${hash}, which is absent from the CSP script-src. `
      + 'Re-run `node tools/build.mjs` after editing the inline script.',
    );
  }
});

// The converse direction: a hash left in the CSP that no committed block
// produces is dead weight, and it means a rebuild was skipped in the other
// direction (a page's block changed, the stale hash was never dropped). It
// also widens what the CSP would accept, so assert the pinned set is exactly
// the set the pages produce.
test('the CSP pins no hash that no committed block produces', () => {
  const csp = cspLine();
  const pinned = new Set((csp.match(/'sha256-[A-Za-z0-9+/=]+'/g) || []));
  const produced = new Set([
    ...STYLE_PAGES.map((p) => blockHash(p, 'style')),
    ...SCRIPT_PAGES.map((p) => blockHash(p, 'script')),
  ]);
  const orphans = [...pinned].filter((h) => !produced.has(h));
  assert.deepEqual(orphans, [], `CSP pins hashes no served page produces: ${orphans.join(' ')}`);
});

// --- Nav active state, driven by page not hardcoded -------------------------
// templates/about.html (and any future template sharing its nav markup) must
// not hardcode which nav link is "current" - that was correct for /about only
// and wrong on every other page rendered from the same template (e.g.
// /roadmap, which inherited aria-current="page" on the About link). The
// active state has to be computed per page from its own route, so a page
// whose route is not in the nav at all ends up with aria-current on nothing,
// not a fallback to whichever link happened to be marked in the template.

function navLinks(html) {
  return [...html.matchAll(/<a class="nav-link" href="([^"]+)"([^>]*)>/g)]
    .map(([, href, rest]) => ({ href, current: /\baria-current="page"/.test(rest) }));
}

test('every generated page has at most one aria-current nav link', () => {
  for (const page of PAGES) {
    const html = readFileSync(new URL(`../${page.out}`, import.meta.url), 'utf8');
    const links = navLinks(html);
    assert.ok(links.length > 0, `${page.out} has no nav links to check`);
    const current = links.filter((l) => l.current);
    assert.ok(
      current.length <= 1,
      `${page.out} has ${current.length} aria-current nav links: ${JSON.stringify(current)}`,
    );
  }
});

test('a page\'s own route in its nav carries aria-current, and no other link does', () => {
  for (const page of PAGES) {
    const html = readFileSync(new URL(`../${page.out}`, import.meta.url), 'utf8');
    const route = new URL(page.canonical).pathname;
    const links = navLinks(html);
    const own = links.find((l) => l.href === route);
    if (own) {
      assert.ok(own.current, `${page.out}: nav link for its own route ${route} lacks aria-current`);
      const others = links.filter((l) => l.href !== route && l.current);
      assert.deepEqual(
        others, [],
        `${page.out}: aria-current on a link other than its own route ${route}: ${JSON.stringify(others)}`,
      );
    } else {
      // The page's route isn't in the nav at all (e.g. /roadmap, which has no
      // nav entry). Nothing should claim to be current in that case.
      const anyCurrent = links.filter((l) => l.current);
      assert.deepEqual(
        anyCurrent, [],
        `${page.out}: route ${route} is not in the nav, but a link still has aria-current`,
      );
    }
  }
});

// --- Block markers must not survive into the HTML ---------------------------
// Before the renderer understood H3 and lists, a source file using either one
// fell through to the paragraph branch and shipped its own Markdown to the
// browser: a visible "### Pain Tracker" and visible "- " bullets. That is the
// failure this page's structure would have hit hardest, so assert the absence
// of the markers in the OUTPUT rather than trusting the parser tests alone.

test('no generated page leaks a literal Markdown block marker', () => {
  for (const page of PAGES) {
    const html = readFileSync(new URL(`../${page.out}`, import.meta.url), 'utf8');
    const lines = html.split('\n');
    lines.forEach((line, i) => {
      assert.ok(
        !line.includes('###'),
        `${page.out}:${i + 1} leaks a literal H3 marker: ${line.trim()}`,
      );
      // A rendered bullet is "<li>...", never a line that begins with a dash.
      // The about.md signature ("- Sophia") is inline inside <p class="signature">,
      // so it does not begin a line and is correctly not caught here.
      assert.ok(
        !/^\s*-\s/.test(line),
        `${page.out}:${i + 1} leaks a literal list marker: ${line.trim()}`,
      );
    });
  }
});

// --- No internal repo paths in public output --------------------------------
// content/ is vendored from a private repo whose internal docs (competitive
// analyses, data model, importer specs) must not be advertised by name. The
// credits page in particular is condensed from a source file thick with them.

test('no generated page names an internal repo path', () => {
  const forbidden = /docs\/|\.titan|feature-matrix|competitive-|importer-specifications|02-data-model|gradle\//;
  for (const page of PAGES) {
    const html = readFileSync(new URL(`../${page.out}`, import.meta.url), 'utf8');
    const hit = html.split('\n').find((l) => forbidden.test(l));
    assert.equal(hit, undefined, `${page.out} names an internal path: ${hit && hit.trim()}`);
  }
});

// --- Icon attribution (site audit L-3) --------------------------------------
// The home page draws four line icons in the Feather/Lucide idiom. The audit
// asks for attribution naming both projects and both licenses. Pin it so a
// future rewrite of the credits copy cannot quietly drop the finding's fix.

test('the credits page attributes the home-page icons with both licenses', () => {
  const html = readFileSync(new URL('../web/credits/index.html', import.meta.url), 'utf8');
  for (const needle of ['Feather', 'Cole Bemis', 'MIT licensed', 'Lucide', 'ISC licensed']) {
    assert.ok(html.includes(needle), `credits page is missing the icon attribution: ${needle}`);
  }
});

// --- Orphan-page reachability -----------------------------------------------
// A page with no inbound link from anywhere else on the site is reachable
// only by typing the URL. /roadmap must be linked from at least one other
// served page (the footer nav where it exists), and this must hold for any
// later PAGES entry too - the check is generic over the manifest, not
// hardcoded to /roadmap specifically.

test('every PAGES entry is linked from at least one other served page', () => {
  const outs = new Set([...HAND_MAINTAINED, ...PAGES.map((p) => p.out)]);
  for (const page of PAGES) {
    const route = new URL(page.canonical).pathname;
    const linkedFrom = [...outs].filter((out) => {
      if (out === page.out) return false;
      const html = readFileSync(new URL(`../${out}`, import.meta.url), 'utf8');
      return html.includes(`href="${route}"`);
    });
    assert.ok(
      linkedFrom.length > 0,
      `${page.out} (route ${route}) is not linked from any other served page - it is orphaned`,
    );
  }
});

// --- No internal reviewer annotations in public output ----------------------
// A separate unmerged branch (legal-pages) drafts terms/privacy copy with
// internal review notes written directly in the Markdown, in the form
// "[ATTORNEY: note]" and "[CONFIRM: note]"; on that branch they render as
// visible highlighted callouts on the public page. Nothing today stops one of
// these from surviving a rebase onto main. The pattern below matches the
// general SHAPE - an opening bracket, two or more uppercase letters, a colon,
// then anything up to the closing bracket - not the two literal words, so the
// next reviewer inventing a third tag (say "[LEGAL: ...]") is still caught.
//
// Checked by hand against every SERVED page's rendered HTML and every file
// under content/ as of writing: it matches nothing. The only bracket usage on
// the site is Markdown link syntax "[text](url)" (link text here is always a
// lowercase domain, never a run of uppercase letters followed by a colon) and
// CSS attribute selectors such as [aria-current="page"], [hidden],
// [type="text"] (an attribute name, never uppercase, and no colon before the
// closing bracket).
const REVIEWER_TAG = /\[[A-Z]{2,}:[^\]]*\]/;

test('no served page contains a bracketed reviewer annotation', () => {
  for (const path of SERVED) {
    const html = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const m = html.match(REVIEWER_TAG);
    assert.equal(m, null, `${path} contains a reviewer annotation: ${m && m[0]}`);
  }
});

test('no content/ file contains a bracketed reviewer annotation', () => {
  const dir = new URL('../content/', import.meta.url);
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const md = readFileSync(new URL(name, dir), 'utf8');
    const m = md.match(REVIEWER_TAG);
    assert.equal(m, null, `content/${name} contains a reviewer annotation: ${m && m[0]}`);
  }
});

// --- Heading order, WCAG 2.1 SC 1.3.1 ---------------------------------------
// The home page opened h1 and then went straight to three h3 "why" cards, so a
// screen-reader user navigating by heading level landed on an orphaned h3 with
// no parent section - on the site's primary page, for a project that names
// accessibility as a founding commitment. Assert the property (no level is
// skipped on the way down) rather than the specific tag that was wrong once,
// and assert it across every served page including the hand-maintained ones,
// which is where this class of error lives.

function headingLevels(html) {
  return [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
}

test('no served page skips a heading level on the way down', () => {
  let checked = 0;
  for (const path of SERVED) {
    const levels = headingLevels(readServed(path));
    assert.ok(levels.length > 0, `${path} has no headings at all`);
    assert.equal(levels[0], 1, `${path} opens on h${levels[0]}, not h1`);
    let prev = levels[0];
    for (const level of levels) {
      assert.ok(
        level <= prev + 1,
        `${path}: h${prev} is followed by h${level}, skipping h${prev + 1} `
        + '(WCAG 2.1 SC 1.3.1). Demote the deeper heading or add the missing level.',
      );
      prev = level;
      checked++;
    }
  }
  assert.ok(checked > 20, `expected headings across the whole site, saw ${checked}`);
});

// --- Waitlist input carries an autofill hint --------------------------------
// WCAG 2.1 SC 1.3.5 (Identify Input Purpose). It is also the one field on the
// site a visitor has to type, and the app's own design constraint is that a
// user with a tremor should have to type as little as possible.

test('the waitlist email input declares its autocomplete purpose', () => {
  const html = readServed('web/index.html');
  const input = html.match(/<input[^>]*type="email"[^>]*>/);
  assert.ok(input, 'web/index.html has no email input');
  assert.match(
    input[0],
    /\bautocomplete="email"/,
    `the waitlist email input has no autocomplete="email": ${input[0]}`,
  );
});

// --- Template substitution must not expand dollar patterns ------------------
// String.prototype.replace / replaceAll expand $&, $`, $' and $$ in a STRING
// replacement regardless of whether the pattern is a string or a regex. Five
// of build.mjs's six substitutions passed strings, so a single $' in a page
// title, description or body would splice part of the template back into the
// served page - silently, and passing every check but the build-drift diff.
// Assert on the dollar patterns themselves, since a test using ordinary prose
// would pass against the broken version too.

test('fillTemplate emits dollar patterns literally instead of expanding them', () => {
  const template = 'A<title>{{TITLE}}</title>B{{DESCRIPTION}}C{{CANONICAL}}D{{SRC}}E{{BODY}}F';
  const page = {
    src: "content/$'.md",
    title: "$'",
    description: '$&',
    canonical: '$`',
    body: '$$',
  };
  const out = fillTemplate(template, page, '$$');
  assert.equal(out, "A<title>$'</title>B$&C$`D$'.mdE$$F");
});

test('fillTemplate fills every placeholder the templates declare', () => {
  for (const rel of ['templates/about.html', 'templates/legal.html']) {
    const template = readServed(rel);
    const out = fillTemplate(
      template,
      { src: 'content/x.md', title: 't', description: 'd', canonical: 'https://example.test/x' },
      'body',
    );
    const left = out.match(/\{\{[A-Z_]+\}\}/g);
    assert.equal(left, null, `${rel} has unfilled placeholders: ${left && left.join(' ')}`);
  }
});

// --- Link hrefs are attribute-escaped and scheme-checked --------------------
// escapeHtml covers & < > , which is the right set for body text and the wrong
// set for an attribute value: a source containing [x](" onmouseover=... x=")
// closed the href early and landed its own attribute on the anchor, and
// [x](javascript:...) emitted a javascript: URL. content/ is vendored from a
// repo we control and the CSP blocks the handler either way, which is why the
// audit rated this Low - but the sync is scripted rather than read, and this
// is the one parse path in the renderer that was not defensive.

test('a quote in a link href cannot break out of the attribute', () => {
  const out = inline('[x](/a" onmouseover=alert(1) x=")');
  // The property is that the anchor's opening tag carries href and nothing
  // else: the injected quote is escaped, so it cannot terminate the value and
  // start a second attribute. Everything after the markdown link's closing
  // paren stays inert body text.
  const openTag = out.match(/<a\b[^>]*>/);
  assert.ok(openTag, `no anchor rendered: ${out}`);
  assert.match(openTag[0], /^<a href="[^"]*">$/, `href broke out: ${openTag[0]}`);
  assert.ok(!/onmouseover=/.test(openTag[0].replace(/&quot;.*/s, '')), openTag[0]);
});

test('an apostrophe in a link href is escaped too', () => {
  assert.match(inline("[x](/a'b)"), /href="\/a&#39;b"/);
});

test('the renderer refuses a link scheme outside the allowlist', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'JavaScript:x']) {
    assert.throws(
      () => inline(`[x](${href})`),
      /scheme this renderer does not allow/,
      `${href} was not rejected`,
    );
  }
});

test('the allowed schemes still render', () => {
  for (const href of [
    'https://notarium.health', 'http://example.test', 'mailto:conduct@notarium.health',
    '/board/at-large', '#waitlist',
  ]) {
    assert.match(inline(`[x](${href})`), new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
});

test('every href in content/ passes the renderer allowlist', () => {
  const dir = new URL('../content/', import.meta.url);
  let checked = 0;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const md = readFileSync(new URL(name, dir), 'utf8');
    for (const [, , href] of md.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      assert.doesNotThrow(
        () => inline(`[t](${href})`),
        `content/${name} has an href the renderer will refuse: ${href}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 20, `expected the content links to be scanned, saw ${checked}`);
});
