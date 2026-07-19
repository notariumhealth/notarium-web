// The published-page manifest. Single source of truth for two consumers:
//   - tools/build.mjs   renders each entry to its `out` path
//   - tools/sync-content.sh  copies exactly these `src` files from canonical
// A doc that lives in notarium/docs/website/ but has no entry here is internal
// and must never reach this repo, which is public.

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
