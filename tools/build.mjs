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
//   final "- ..." line  -> .signature (rendered in its section)
// The CTA row is web-only chrome; it is injected into the section that holds
// the signature. Inline Markdown supported: [text](url) and **bold**.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// `--list-sources` prints the content basenames this repo publishes, one per
// line. tools/sync-content.sh consumes it so the copy is an allowlist rather
// than a glob: an internal doc in canonical's docs/website/ cannot reach this
// public repo just by existing.
if (process.argv.includes('--list-sources')) {
  for (const page of PAGES) console.log(page.src.replace(/^content\//, ''));
  process.exit(0);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Inline Markdown -> HTML. Escapes first, so [](), ** survive (their chars
// aren't escaped) and any literal <, >, & in the prose are made safe.
function inline(s) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function isSignature(text) {
  // A signature block leads with a hyphen + space, e.g. "- Sophia".
  return /^-\s/.test(text.trim());
}

// Split into blank-line-separated blocks; classify each.
function parse(md) {
  const blocks = md
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  let h1 = '';
  const intro = []; // paragraphs before the first H2
  const sections = []; // { title, paras:[], signature? }
  let cur = null;

  for (const b of blocks) {
    if (b.startsWith('## ')) {
      cur = { title: b.slice(3).trim(), paras: [], signature: null };
      sections.push(cur);
    } else if (b.startsWith('# ')) {
      h1 = b.slice(2).trim();
    } else if (isSignature(b)) {
      // Signature belongs to the current (last) section.
      if (cur) cur.signature = b.trim();
      else intro.push(b); // no section yet: keep as prose
    } else if (cur) {
      cur.paras.push(b);
    } else {
      intro.push(b);
    }
  }
  return { h1, intro, sections };
}

function proseHtml(paras) {
  return paras.map((p) => `          <p>${inline(p)}</p>`).join('\n');
}

function render(page, md) {
  const { h1, intro, sections } = parse(md);

  // Hero: eyebrow from H1, fixed display title, lead = first intro paragraph.
  const lead = intro.shift() || '';
  const parts = [];
  parts.push(
    '      <section class="wrap hero">\n' +
      `        <p class="hero-eyebrow">${inline(h1)}</p>\n` +
      `        <h1 class="about-title">${page.heroTitle}</h1>\n` +
      `        <p class="lead">${inline(lead)}</p>\n` +
      '      </section>'
  );

  // Opening prose section (remaining intro paragraphs, no heading).
  if (intro.length) {
    parts.push(
      '      <section class="wrap section">\n' +
        '        <div class="prose">\n' +
        proseHtml(intro) +
        '\n        </div>\n' +
        '      </section>'
    );
  }

  for (const s of sections) {
    let body =
      `        <h2 class="section-title">${inline(s.title)}</h2>\n` +
      '        <div class="prose">\n' +
      proseHtml(s.paras) +
      '\n        </div>';
    if (s.signature) {
      if (page.cta) body += `\n        ${page.cta}`;
      body += `\n        <p class="signature">${inline(s.signature)}</p>`;
    }
    parts.push(`      <section class="wrap section">\n${body}\n      </section>`);
  }

  return parts.join('\n\n');
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
  writeFileSync(join(ROOT, page.out), html);
  console.log(`built ${page.out}  <-  ${page.src}`);
  built++;
}

// --- CSP inline-hash pinning -----------------------------------------------
// Served pages ship inline <style> (every page) and, on the logo poll, one
// inline <script> (the dropdown dedup). Rather than weaken the CSP with
// 'unsafe-inline', each block is pinned by its SHA-256 hash: style-src for the
// styles, script-src for the script. Edit a block, re-run this script, and the
// hashes refresh. A forgotten rebuild fails loud - the browser refuses the
// block (unstyled page or inert script), never silently open.
const STYLE_PAGES = [
  'web/index.html',
  'web/about.html',
  'web/logo-poll/index.html',
  'web/thanks-for-voting/index.html',
  'web/security/index.html',
  'web/404.html',
];
const SCRIPT_PAGES = ['web/logo-poll/index.html'];

function blockHash(relPath, tag) {
  const html = readFileSync(join(ROOT, relPath), 'utf8');
  const m = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) throw new Error(`no inline <${tag}> found in ${relPath}`);
  return `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
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
