# notarium-web

Marketing site for [Notarium](https://notarium.health), a privacy-first,
local-first health tracker for Android.

This repo holds the public landing page only. The app lives in a separate
repo.

## Layout

```
web/         The served site. Every route is a directory index
             (web/<route>/index.html), so the file layout and the URL
             layout are the same thing and nothing depends on host
             rewriting. web/index.html is the landing page.
content/     Markdown prose for the generated pages, vendored from the
             canonical repo. Do not edit the generated HTML.
templates/   Styled shells (CSS, nav, footer) with {{PLACEHOLDER}} slots
styles/      base.css, injected into every page's inline <style>
tools/
  pages.mjs        THE PAGE MANIFEST. Which pages exist, what generates
                   them, and which lists they belong to. Read this rather
                   than a tree in a README, which is what went stale.
  build.mjs        Renders content/*.md into web/, injects the base style,
                   pins the CSP hashes (zero dependencies)
  render.mjs       The Markdown-ish parse and render layer
  test.mjs         The test suite (node --test tools/test.mjs)
  sync-content.sh  Pulls the canonical docs into content/, then rebuilds
```

`web/index.html` is hand-authored with inline styles. The pages listed in
`PAGES` in `tools/pages.mjs` are generated, so edit the Markdown source, not
the HTML; the ones in `HAND_MAINTAINED` are edited directly.

## Content source of truth

The prose for generated pages lives in the canonical app repo, not here:

```
notarium/docs/website/*.md   <-- edit here (the source of truth)
```

`content/*.md` is a vendored copy so this repo stays self-contained. To pull the
latest canonical prose and rebuild the HTML:

```bash
tools/sync-content.sh                       # default canonical path ~/projects/notarium
NOTARIUM_REPO=/path/to/notarium tools/sync-content.sh   # if it lives elsewhere
```

To rebuild from the already-vendored content without syncing:

```bash
node tools/build.mjs
```

The generator is convention-based, not a general Markdown engine. For a page:
the `#` H1 becomes the hero eyebrow, the first paragraph the hero lead, each
`##` a section, and a trailing `- …` line the signature. Page title, hero
headline, and the waitlist CTA are web-only chrome defined in `build.mjs`.
Commit the regenerated `web/*.html` along with the content change.

`build.mjs` also pins the CSP: each served page has one inline `<style>` block,
and the generator writes a `'sha256-…'` for each into the `style-src` of
`web/_headers` (so the CSP needs no `'unsafe-inline'`). This means **any edit to
an inline `<style>` block - including hand-authored `web/index.html` - requires
re-running `node tools/build.mjs`** so the hash matches, then commit the updated
`web/_headers`. A stale hash makes the browser refuse that page's styles (fails
loud, never silently open).

## Local preview

Open the file directly, or serve the folder:

```bash
python3 -m http.server -d web 8080
# then visit http://localhost:8080  (every route resolves locally too)
```

## Deploy

Cloudflare Pages builds from the GitHub `main` branch and publishes to
notarium.health. Pushing to `main` triggers a new deploy. There is no build
command at deploy time; Pages serves the committed `web/` directory as-is, so
regenerate locally and commit the HTML. Every route is a directory index, so
resolution depends on the file layout rather than on host-specific clean-URL
handling, and local preview matches production.

## Checks

The same five gates run on both remotes, from `.forgejo/workflows/ci.yml` and
`.github/workflows/ci.yml`, on every pull request and every push to `main`:

1. `node --test tools/test.mjs`
2. **Build drift** - rebuild and fail if any tracked file changed, which means
   content or a template was committed without rerunning the build. This is the
   important one: a stale CSP hash ships a page unstyled and nothing else
   notices.
3. No em dashes in tracked files
4. No registered-mark symbol (the trademark application is pending)
5. No forward-looking dates or timelines

The two workflow files are a hand-maintained mirror of each other, differing
only in the runner. `tools/test.mjs` asserts they run the same named steps with
the same commands, so a gate added or weakened on one side fails the build
until it is mirrored on the other. They used to exist on the Forgejo side only,
which meant a push straight to `github/main` - the branch Cloudflare Pages
actually deploys - was verified by nothing.

## Remotes

- `github`  github.com/notariumhealth/notarium-web  (publishes to Cloudflare Pages)
- `origin`  Forgejo on the homelab (private working copy)

Keep both in sync. The GitHub copy is the one that ships, so a change is not
live until it lands on `github/main`. Both now run the checks above, so neither
remote is the unguarded one.

## Forms, and what happens when they break

Two pages POST to Formspree: the home-page waitlist (`f/xykqjzeg`) and the
logo poll (`f/xojorywl`, now closed). Both are plain HTML form posts with no
client-side handling, which is deliberate - they work with JavaScript off -
but it means there is **no failure signal**. If the endpoint is retired, hits
a plan limit, or starts rejecting, the visitor sees a Formspree error page and
nothing here reports it. The waitlist is the site's only conversion, so the
failure mode is silent loss of the thing the site exists to collect.

This is accepted rather than fixed: adding client-side error handling would
mean giving the one page that has to work without JavaScript a JavaScript
dependency. The check is manual instead.

**Monthly, and before sharing the waitlist anywhere new:** submit a real
address through the form at <https://notarium.health/#waitlist>, confirm the
redirect lands, and confirm the notification arrives. If it does not:

1. Check the Formspree dashboard for the form's status and the plan's
   submission quota.
2. Confirm `form-action 'self' https://formspree.io` is still in the CSP in
   `web/_headers` - a CSP edit that drops it blocks the POST in the browser
   with no server-side trace at all.
3. Confirm the `action` URL on the page still matches the form ID in the
   dashboard.

## Writing copy

Plain language, accurate claims, no inflated marketing voice. The privacy
statements have to match what the app actually does: data stays encrypted on
the device, no accounts, no automatic sync, no analytics. Say "device" rather
than "phone" so the copy reads right for tablets too.

## Logo poll

`web/logo-poll/` is a hand-authored survey (Formspree `f/xojorywl`, redirects to
`/thanks-for-voting`). It is `noindex` and unlinked from site nav, shared by
direct link only. Only the #1 rank is required; #2-5 are optional. It carries
the site's one inline `<script>` (rank-menu dedup, a click-to-zoom lightbox for
the logos, and a reveal-on-check "Other" text field), pinned in the CSP
`script-src` by `build.mjs`. Every behavior is progressive enhancement: with JS
off the form still submits, thumbnails open the image directly, and the "Other"
box stays visible.

The poll started at 15 concepts. An initial voting round dropped concepts 7, 8,
9, 10, 14, and 15 - each eliminated for a mark conflict or because the mark was
misinterpreted - leaving nine, which were **renumbered 1-9** for a clean
sequential ballot. Map poll responses back to the original design concepts with
this crosswalk:

| Poll shows | Original concept |
|------------|------------------|
| Logo 1-6   | 1-6 (unchanged)  |
| Logo 7     | 11               |
| Logo 8     | 12               |
| Logo 9     | 13               |

Dropped: original 7, 8, 9, 10, 14, 15.
