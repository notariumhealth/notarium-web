// Render layer for notarium-web: Markdown-ish parsing + HTML rendering.
//
// Block-level conventions, not a general Markdown engine:
//   # H1     -> hero eyebrow          ## H2  -> section
//   ### H3   -> subsection heading    - a/- b (multi-line) -> <ul>
//   final single-line "- x"           -> signature (e.g. "- Sophia")
// The signature rule is deliberately narrow: it was the original meaning of a
// leading hyphen here, and widening lists without narrowing it would silently
// swallow every bullet list into a <p class="signature">.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Inline Markdown -> HTML. Escapes first, so [](), ** survive (their chars
// aren't escaped) and any literal <, >, & in the prose are made safe.
export function inline(s) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function isListBlock(text) {
  const lines = text.trim().split('\n');
  return lines.length > 1 && lines.every((l) => /^-\s/.test(l.trim()));
}

function isSignatureBlock(text, isFinalBlock) {
  const lines = text.trim().split('\n');
  return isFinalBlock && lines.length === 1 && /^-\s/.test(lines[0].trim());
}

// Split into blank-line-separated blocks; classify each.
export function parse(md) {
  const blocks = md
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

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
    } else if (isSignatureBlock(b, isFinal)) {
      // Signature belongs to the current (last) section.
      if (cur) cur.signature = b.trim();
      else intro.push({ kind: 'p', text: b }); // no section yet: keep as prose
    } else if (b.startsWith('### ')) {
      const block = { kind: 'h3', text: b.slice(4).trim() };
      cur ? cur.blocks.push(block) : intro.push(block);
    } else if (isListBlock(b)) {
      const items = b.split('\n').map((l) => l.trim().replace(/^-\s+/, ''));
      const block = { kind: 'ul', items };
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
