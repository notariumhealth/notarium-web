#!/usr/bin/env node
// Static page generator for notarium-web.
//
// Source of truth for prose is Markdown under content/ (vendored from the
// canonical repo: notarium/docs/website/*.md - see tools/sync-content.sh).
// This renders that Markdown into a styled template and writes the served
// HTML under web/. The committed web/*.html is what Cloudflare Pages serves;
// there is no build step at deploy time.
//
// Run: node tools/build.mjs
//
// Markdown -> page mapping (conventions, not a general Markdown engine):
//   # H1                -> hero eyebrow (heroTitle below is the display title)
//   first paragraph     -> hero lead
//   paragraphs before    \
//     the first ## H2    -> opening prose section (no heading)
//   ## H2 + paragraphs  -> a .section with .section-title + .prose
//   ### H3              -> a subsection heading within a section
//   - a / - b (multi-line, or any doc with more than one dash-led block)
//                       -> <ul> list
//   sole trailing "- x" -> .signature (rendered in its section)
// The parsing rules live in tools/render.mjs (see its header comment for the
// full signature-vs-list discriminator); this file just maps the result onto
// the page template. The CTA row is web-only chrome; it is injected into the
// section that holds the signature. Inline Markdown supported:
// [text](url) and **bold**.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, HAND_MAINTAINED, STYLE_PAGES, SCRIPT_PAGES } from './pages.mjs';
import { render } from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Nav active state --------------------------------------------------------
// Templates carry their own nav markup, and a page's route decides which nav
// link (if any) is "current" - this must not be hardcoded per template, since
// every page rendered from the same template shares the file. Drive it from
// the page's own `canonical` URL instead: whichever nav-link href equals the
// page's route gets aria-current="page"; every other nav-link on the page
// (including one a template might have hardcoded) does not. A route that has
// no matching nav-link (e.g. /roadmap, which is not in the primary nav) ends
// up with aria-current on nothing, which is the correct programmatic state,
// not a fallback to whatever the template happened to mark.
function setActiveNav(html, page) {
  const route = new URL(page.canonical).pathname;
  return html.replace(
    /<a class="nav-link" href="([^"]+)"((?:\s[^>]*)?)>/g,
    (_all, href, attrs) => {
      const stripped = attrs.replace(/\s*aria-current="page"/, '');
      const current = href === route ? ' aria-current="page"' : '';
      return `<a class="nav-link" href="${href}"${stripped}${current}>`;
    },
  );
}

// --- Shared base style ------------------------------------------------------
// Every served page carries one <style> block whose first region is the shared
// base, delimited by markers, followed by that page's own rules. Injecting
// rather than linking keeps the CSP inline-hash model intact (no new style-src
// origin) and keeps the palette in exactly one file.
//
// This must run BEFORE the CSP hash pinning block at the bottom of this file.
// Pinning first would hash pre-injection content, and the browser would then
// refuse every style block on the site.
const BASE_CSS = readFileSync(join(ROOT, 'styles/base.css'), 'utf8').trim();

function injectBaseStyles(html) {
  const re = /(\/\* BEGIN base \*\/)[\s\S]*?(\/\* END base \*\/)/;
  if (!re.test(html)) throw new Error('page has no base-style region to inject into');
  // Replacement FUNCTION, not a string: a string replacement expands $&, $1,
  // $` and friends, so a dollar sign in styles/base.css (a `content` value, an
  // at-rule) would be rewritten instead of emitted. The function form emits
  // BASE_CSS verbatim.
  return html.replace(re, (_all, begin, end) => `${begin}\n${BASE_CSS}\n    ${end}`);
}

// `--list-sources` prints the content basenames this repo publishes, one per
// line. tools/sync-content.sh consumes it so the copy is an allowlist rather
// than a glob: an internal doc in canonical's docs/website/ cannot reach this
// public repo just by existing.
if (process.argv.includes('--list-sources')) {
  for (const page of PAGES) console.log(page.src.replace(/^content\//, ''));
  process.exit(0);
}

let built = 0;
for (const page of PAGES) {
  const md = readFileSync(join(ROOT, page.src), 'utf8');
  const template = readFileSync(join(ROOT, page.template), 'utf8');
  const body = render(page, md);
  const html = template
    .replaceAll('{{SRC}}', page.src.replace(/^content\//, ''))
    .replaceAll('{{TITLE}}', page.title)
    .replaceAll('{{DESCRIPTION}}', page.description)
    .replaceAll('{{CANONICAL}}', page.canonical)
    .replace('{{BODY}}', body);
  writeFileSync(join(ROOT, page.out), injectBaseStyles(setActiveNav(html, page)));
  console.log(`built ${page.out}  <-  ${page.src}`);
  built++;
}

// Hand-maintained pages (not in PAGES) still take the shared base. Runs before
// the CSP pinning below so the hashes describe post-injection content.
// The list itself lives in tools/pages.mjs, alongside STYLE_PAGES, so
// tools/test.mjs can assert the two agree.
for (const rel of HAND_MAINTAINED) {
  const p = join(ROOT, rel);
  const before = readFileSync(p, 'utf8');
  const after = injectBaseStyles(before);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`restyled ${rel}`);
  }
}

// --- CSP inline-hash pinning -----------------------------------------------
// Served pages ship inline <style> (every page) and, on the logo poll, one
// inline <script> (the dropdown dedup). Rather than weaken the CSP with
// 'unsafe-inline', each block is pinned by its SHA-256 hash: style-src for the
// styles, script-src for the script. Edit a block, re-run this script, and the
// hashes refresh. A forgotten rebuild fails loud - the browser refuses the
// block (unstyled page or inert script), never silently open.
// STYLE_PAGES / SCRIPT_PAGES live in tools/pages.mjs so tools/test.mjs can
// assert they agree with the other page lists.

function blockHash(relPath, tag) {
  const html = readFileSync(join(ROOT, relPath), 'utf8');
  // Tolerate attributes on the opening tag, and match globally: only one block
  // per tag may exist. Pinning the first of several would leave the rest
  // unhashed, and the browser would refuse them - a page half-styled or with
  // an inert script. Fail loudly here instead.
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const all = [...html.matchAll(re)];
  if (all.length === 0) throw new Error(`no inline <${tag}> found in ${relPath}`);
  if (all.length > 1) {
    throw new Error(
      `${relPath} has ${all.length} inline <${tag}> blocks; the CSP pins exactly one. ` +
      'Merge them into a single block.',
    );
  }
  return `'sha256-${createHash('sha256').update(all[0][1], 'utf8').digest('base64')}'`;
}

const styleHashes = [...new Set(STYLE_PAGES.map((p) => blockHash(p, 'style')))].sort();
const scriptHashes = [...new Set(SCRIPT_PAGES.map((p) => blockHash(p, 'script')))].sort();
const styleSrc = `style-src 'self' ${styleHashes.join(' ')} https://fonts.bunny.net;`;
const scriptSrc = `script-src ${scriptHashes.join(' ')};`;

// Operate only on the Content-Security-Policy line itself. Matching directive
// names anywhere in the file would collide with the header comment (which names
// style-src/script-src in prose); isolating the line keeps [^;]* from spanning
// newlines into that comment.
const headersPath = join(ROOT, 'web/_headers');
const headers = readFileSync(headersPath, 'utf8');
const cspRe = /^(\s*Content-Security-Policy:\s*)(.*)$/m;
const cspMatch = headers.match(cspRe);
if (!cspMatch) {
  throw new Error('web/_headers: no Content-Security-Policy line found');
}
let csp = cspMatch[2];
if (!/\bstyle-src [^;]*;/.test(csp)) {
  throw new Error('web/_headers: CSP has no style-src directive to update');
}
csp = csp.replace(/\bstyle-src [^;]*;/, styleSrc);
if (/\bscript-src [^;]*;/.test(csp)) {
  csp = csp.replace(/\bscript-src [^;]*;/, scriptSrc);
} else if (/\bdefault-src [^;]*;/.test(csp)) {
  csp = csp.replace(/\bdefault-src [^;]*;/, (d) => `${d} ${scriptSrc}`);
} else {
  throw new Error('web/_headers: no default-src directive to anchor script-src after');
}
const updated = headers.replace(cspRe, (all, prefix) => prefix + csp);
if (updated !== headers) {
  writeFileSync(headersPath, updated);
  console.log(`updated web/_headers CSP (${styleHashes.length} style, ${scriptHashes.length} script)`);
} else {
  console.log('web/_headers CSP already current');
}

console.log(`done: ${built} page(s)`);
