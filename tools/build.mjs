#!/usr/bin/env node
// Static page generator for notarium-web.
//
// Source of truth for prose is Markdown under content/ (vendored from the
// canonical repo: notarium/docs/website/*.md — see tools/sync-content.sh).
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
//   final "— ..." line  -> .signature (rendered in its section)
// The CTA row is web-only chrome; it is injected into the section that holds
// the signature. Inline Markdown supported: [text](url) and **bold**.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  {
    src: 'content/about.md',
    out: 'web/about.html',
    template: 'templates/about.html',
    title: 'About — Notarium',
    description:
      'Why Sophia Daw built Notarium: a private, local-first health tracker for people documenting chronic illness and the workplace accommodation process that comes with it.',
    canonical: 'https://notarium.health/about',
    heroTitle: 'Why I built<br>Notarium.',
    cta:
      '<div class="cta-row">\n' +
      '          <a class="btn-primary" href="/#waitlist">Get early access</a>\n' +
      '          <span class="cta-meta">Android &middot; Free</span>\n' +
      '        </div>',
  },
];

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
  return /^(—|—|&mdash;)/.test(text.trim());
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

// --- CSP style-src hashes ---------------------------------------------------
// Each served page ships exactly one inline <style> block (index hand-authored,
// about generated above). Rather than weaken the CSP with 'unsafe-inline', we
// pin each block by its SHA-256 hash in web/_headers' style-src. This step
// keeps the two in lockstep: edit index.html's styles or change the about
// template, re-run this script, and the hashes refresh. If a page's inline
// <style> ever fails to hash, the browser will refuse to apply it — so a
// forgotten rebuild fails loud (unstyled page), never silently open.
const STYLE_PAGES = ['web/index.html', 'web/about.html'];

function styleHash(relPath) {
  const html = readFileSync(join(ROOT, relPath), 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error(`no inline <style> found in ${relPath}`);
  return `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
}

const hashes = [...new Set(STYLE_PAGES.map(styleHash))].sort();
const styleSrc = `style-src 'self' ${hashes.join(' ')} https://fonts.bunny.net;`;
const headersPath = join(ROOT, 'web/_headers');
const headers = readFileSync(headersPath, 'utf8');
if (!/^\s*Content-Security-Policy:.*\bstyle-src [^;]*;/m.test(headers)) {
  throw new Error('web/_headers: could not find a CSP style-src directive to update');
}
const updated = headers.replace(/\bstyle-src [^;]*;/, styleSrc);
if (updated !== headers) {
  writeFileSync(headersPath, updated);
  console.log(`updated web/_headers style-src (${hashes.length} hash(es))`);
} else {
  console.log('web/_headers style-src already current');
}

console.log(`done: ${built} page(s)`);
