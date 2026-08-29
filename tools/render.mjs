// Render layer for notarium-web: Markdown-ish parsing + HTML rendering.
//
// Block-level conventions, not a general Markdown engine:
//   # H1     -> hero eyebrow          ## H2  -> section
//   ### H3   -> subsection heading    - a/- b (multi-line) -> <ul>
//   sole trailing single-line "- x"   -> signature (e.g. "- Sophia")
// The signature rule is deliberately narrow: a block is a signature only if
// it is the single dash-led block in the whole document, is one line long,
// and is the final block. Any document with a second dash-led block anywhere
// treats every dash-led block as a list, including a final single bullet -
// that shape is a list of one item, not a signature. Adjacent dash-led
// blocks separated only by a blank line are merged before classification, so
// a stray blank line inside a list cannot split it and strand the tail as a
// false signature.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Schemes a link in content/ may use. content/ is vendored from a repo we
// control, but the copy is scripted (tools/sync-content.sh) rather than read,
// and every other parse path in this renderer is defensive, so the href gets
// the same treatment. Site-relative paths and fragments cover the internal
// links; https/http and mailto cover the external ones. Anything else -
// javascript:, data:, vbscript: - is an authoring error, not a link.
const ALLOWED_HREF = /^(?:https?:\/\/|mailto:|\/|#)/;

// Escape a value being emitted INSIDE a double-quoted HTML attribute. Body
// text does not need this (a bare quote or apostrophe in prose is harmless and
// escaping it would only churn the diff), but an attribute value does: without
// it a source containing [x](" onmouseover=... x=") closes the href early and
// lands an attribute of its own on the anchor. The CSP blocks the handler that
// would result, which is why the audit rated this Low, but the CSP is the
// second line, not the first.
function escapeAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Inline Markdown -> HTML. Escapes first, so [](), ** survive (their chars
// aren't escaped) and any literal <, >, & in the prose are made safe. The href
// is then scheme-checked and attribute-escaped on top of that: escapeHtml
// covers & < > , which is right for text, and leaves the quote characters that
// matter only inside an attribute.
export function inline(s) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (all, text, href) => {
      if (!ALLOWED_HREF.test(href)) {
        // Fail the build rather than emit the link. Dropping it silently would
        // hide a typo'd URL just as effectively as it hides a hostile one.
        throw new Error(
          `link href "${href}" uses a scheme this renderer does not allow. `
          + 'Use https://, http://, mailto:, a site-relative /path, or a #fragment.',
        );
      }
      return `<a href="${escapeAttr(href)}">${text}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Fill a page template's {{PLACEHOLDER}} slots.
//
// Every replacement is a FUNCTION, never a string. String.prototype.replace
// and replaceAll expand $&, $`, $' and $$ inside a STRING replacement whether
// the pattern is a string or a regex, so a lone $' anywhere in a page title,
// description or rendered body would splice a chunk of the template back into
// the output. Nothing in the tree triggers it today (the only dollar sign is a
// figure in content/board-fundraising-development.md), and it would pass every
// check except the build-drift diff, failing quietly rather than loudly.
// tools/build.mjs already defends injectBaseStyles this exact way; this
// carries the same defence across the remaining five substitutions.
// The footer copyright year is generated rather than typed, so the twelve
// template-rendered pages correct themselves on the next build instead of
// going stale on January 1. `year` is injectable so a test can pin the output
// without depending on when it runs. The six hand-maintained pages have no
// template to render from and are covered by the CI copyright gate instead.
export function fillTemplate(template, page, body, year = new Date().getFullYear()) {
  return template
    .replaceAll('{{YEAR}}', () => String(year))
    .replaceAll('{{SRC}}', () => page.src.replace(/^content\//, ''))
    .replaceAll('{{TITLE}}', () => page.title)
    .replaceAll('{{DESCRIPTION}}', () => page.description)
    .replaceAll('{{CANONICAL}}', () => page.canonical)
    .replace('{{BODY}}', () => body);
}

function isDashLedBlock(text) {
  const lines = text.trim().split('\n');
  return lines.every((l) => /^-\s/.test(l.trim()));
}

// Split into blank-line-separated blocks; classify each.
export function parse(md) {
  // HTML comments are editor-facing notes in the canonical source (e.g. a
  // warning about the signature discriminator in about.md) and must not
  // reach the page. Strip them before block-splitting rather than relying on
  // the browser: this renderer emits everything it parses as visible text.
  const rawBlocks = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Merge runs of adjacent dash-led blocks (they were only ever split apart
  // by a blank line) so a stray blank line inside a list cannot fracture it
  // into two blocks.
  const blocks = [];
  for (const b of rawBlocks) {
    const prev = blocks[blocks.length - 1];
    if (prev !== undefined && isDashLedBlock(prev) && isDashLedBlock(b)) {
      blocks[blocks.length - 1] = `${prev}\n${b}`;
    } else {
      blocks.push(b);
    }
  }

  const dashBlockCount = blocks.filter(isDashLedBlock).length;

  let h1 = '';
  const intro = []; // blocks before the first H2
  const sections = []; // { title, blocks:[], signature? }
  let cur = null;

  blocks.forEach((b, i) => {
    const isFinal = i === blocks.length - 1;
    if (b.startsWith('## ')) {
      cur = { title: b.slice(3).trim(), blocks: [], signature: null };
      sections.push(cur);
    } else if (b.startsWith('# ')) {
      h1 = b.slice(2).trim();
    } else if (isDashLedBlock(b)) {
      const lines = b.split('\n').map((l) => l.trim());
      if (isFinal && lines.length === 1 && dashBlockCount === 1) {
        // The sole dash-led block in the document, on the final line:
        // the author-signature shape (about.md's "- Sophia"). Any other
        // dash-led block anywhere in the doc means this is a list instead,
        // even a final single bullet - a list of one item, not a signature.
        if (cur) cur.signature = b.trim();
        else intro.push({ kind: 'p', text: b }); // no section yet: keep as prose
      } else {
        const items = lines.map((l) => l.replace(/^-\s+/, ''));
        const block = { kind: 'ul', items };
        cur ? cur.blocks.push(block) : intro.push(block);
      }
    } else if (b.startsWith('### ')) {
      const block = { kind: 'h3', text: b.slice(4).trim() };
      cur ? cur.blocks.push(block) : intro.push(block);
    } else {
      const block = { kind: 'p', text: b };
      cur ? cur.blocks.push(block) : intro.push(block);
    }
  });

  return { h1, intro, sections };
}

function blocksHtml(blocks) {
  return blocks
    .map((b) => {
      if (b.kind === 'h3') return `          <h3 class="sub-title">${inline(b.text)}</h3>`;
      if (b.kind === 'ul') {
        const items = b.items.map((it) => `            <li>${inline(it)}</li>`).join('\n');
        return `          <ul class="prose-list">\n${items}\n          </ul>`;
      }
      return `          <p>${inline(b.text)}</p>`;
    })
    .join('\n');
}

export function render(page, md) {
  const { h1, intro, sections } = parse(md);

  // Hero: eyebrow from H1, fixed display title, lead = first intro block's text.
  const leadBlock = intro.shift();
  const lead = leadBlock ? leadBlock.text : '';
  const parts = [];
  parts.push(
    '      <section class="wrap hero">\n' +
      `        <p class="hero-eyebrow">${inline(h1)}</p>\n` +
      `        <h1 class="about-title">${page.heroTitle}</h1>\n` +
      `        <p class="lead">${inline(lead)}</p>\n` +
      '      </section>'
  );

  // Opening prose section (remaining intro blocks, no heading).
  if (intro.length) {
    parts.push(
      '      <section class="wrap section">\n' +
        '        <div class="prose">\n' +
        blocksHtml(intro) +
        '\n        </div>\n' +
        '      </section>'
    );
  }

  for (const s of sections) {
    let body =
      `        <h2 class="section-title">${inline(s.title)}</h2>\n` +
      '        <div class="prose">\n' +
      blocksHtml(s.blocks) +
      '\n        </div>';
    if (s.signature) {
      if (page.cta) body += `\n        ${page.cta}`;
      body += `\n        <p class="signature">${inline(s.signature)}</p>`;
    }
    parts.push(`      <section class="wrap section">\n${body}\n      </section>`);
  }

  return parts.join('\n\n');
}
