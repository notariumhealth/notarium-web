# notarium-web

Marketing site for [Notarium](https://notarium.health), a privacy-first,
local-first health tracker for Android.

This repo holds the public landing page only. The app lives in a separate
repo.

## Layout

```
web/
  index.html    Landing page — hand-authored, self-contained (inline CSS)
  about.html    GENERATED from content/about.md — do not edit by hand
content/
  about.md      Prose source for /about (vendored from the canonical repo)
templates/
  about.html    Styled shell (CSS, nav, footer) with placeholders
tools/
  build.mjs        Renders content/*.md into web/*.html (zero dependencies)
  sync-content.sh  Pulls the canonical docs into content/, then rebuilds
```

`web/index.html` is a single static HTML file with inline styles. `web/about.html`
is generated, so edit the Markdown source, not the HTML.

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
`##` a section, and a trailing `— …` line the signature. Page title, hero
headline, and the waitlist CTA are web-only chrome defined in `build.mjs`.
Commit the regenerated `web/*.html` along with the content change.

## Local preview

Open the file directly, or serve the folder:

```bash
python3 -m http.server -d web 8080
# then visit http://localhost:8080  (about page at /about.html locally)
```

## Deploy

Cloudflare Pages builds from the GitHub `main` branch and publishes to
notarium.health. Pushing to `main` triggers a new deploy. There is no build
command at deploy time; Pages serves the committed `web/` directory as-is, so
regenerate locally and commit the HTML. (`/about` resolves to `about.html` via
Pages' clean-URL handling.)

## Remotes

- `github`  github.com/notariumhealth/notarium-web  (publishes to Cloudflare Pages)
- `origin`  Forgejo on the homelab (private working copy)

Keep both in sync. The GitHub copy is the one that ships, so a change is not
live until it lands on `github/main`.

## Writing copy

Plain language, accurate claims, no inflated marketing voice. The privacy
statements have to match what the app actually does: data stays encrypted on
the device, no accounts, no automatic sync, no analytics. Say "device" rather
than "phone" so the copy reads right for tablets too.
