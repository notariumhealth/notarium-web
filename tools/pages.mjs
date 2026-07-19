// The published-page manifest. Single source of truth for two consumers:
//   - tools/build.mjs   renders each entry to its `out` path
//   - tools/sync-content.sh  copies exactly these `src` files from canonical
// A doc that lives in notarium/docs/website/ but has no entry here is internal
// and must never reach this repo, which is public.
//
// The page lists below live here rather than in build.mjs so tools/test.mjs
// can import them without executing the build. They must all describe the same
// set of served pages; tools/test.mjs asserts that. The failure they guard
// against is silent: a page in STYLE_PAGES but absent from both PAGES and
// HAND_MAINTAINED gets a correct hash pinned over its UNINJECTED style block,
// so the CSP is satisfied and the page ships unstyled with no browser
// complaint. The reverse mistake is loud (the browser refuses the block).

export const PAGES = [
  {
    src: 'content/about.md',
    out: 'web/about.html',
    template: 'templates/about.html',
    title: 'About - Notarium',
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

// Hand-maintained served pages: not rendered from Markdown, but they still
// take the injected base style. Disjoint from the `out` paths in PAGES.
export const HAND_MAINTAINED = [
  'web/index.html', 'web/404.html', 'web/security/index.html',
  'web/logo-poll/index.html', 'web/thanks-for-voting/index.html',
];

// Every served page carries exactly one inline <style> block that gets pinned
// by SHA-256 in the CSP. This is the union of HAND_MAINTAINED and PAGES `out`.
export const STYLE_PAGES = [
  'web/index.html',
  'web/about.html',
  'web/logo-poll/index.html',
  'web/thanks-for-voting/index.html',
  'web/security/index.html',
  'web/404.html',
];

// Pages carrying an inline <script> pinned in script-src. Only the logo poll.
export const SCRIPT_PAGES = ['web/logo-poll/index.html'];
