# CI (Forgejo Actions)

`ci.yml` is the server-side gate this repo did not have. Before it, the entire
safety model was 23 tests in `tools/test.mjs` that nothing obliged anyone to
run, plus a handful of content rules (no em dashes, no premature registered-mark
symbol, no forward-looking dates) that were checked only by a human running
grep. It runs on every **pull request** and every **push to `main`**:

```
node --test tools/test.mjs   # the existing test suite
node tools/build.mjs         # rebuild, then diff the working tree - fails if stale
git grep ...                 # em dash / registered-symbol / forward-date gates
```

- **Test suite** - the 23+ checks already in `tools/test.mjs`: Markdown parsing,
  the shared base-style region, computed WCAG contrast, page-list agreement,
  CSP hash pinning, nav active-state, orphan-page reachability, and (as of this
  workflow) the internal-annotation guard described below.
- **Build-drift gate** - the check this workflow exists for. `node
  tools/build.mjs` renders `content/*.md` through the templates and injects
  `styles/base.css`, then pins each page's inline `<style>` (and the logo
  poll's inline `<script>`) by SHA-256 into `web/_headers`'s
  Content-Security-Policy. Edit a page's CSS or a content file and forget to
  rebuild, and every test in `tools/test.mjs` still passes locally while the
  committed `web/*.html` no longer matches what the source produces - the CSP
  pins the OLD hash, and the browser refuses the page's entire inline style
  block. Nothing short of actually rebuilding and diffing catches this, so the
  job does exactly that: run the build, then fail loud (with the diff printed)
  if the working tree changed.
- **Content constraint gates** - three rules that used to depend on someone
  remembering to grep by hand:
  - No em dash anywhere in a tracked file, except `.gitattributes` (it carries
    one pre-existing em dash inside a comment that predates this gate).
  - No registered trademark symbol anywhere - neither the R-in-a-circle glyph
    nor its four-letter HTML entity. The USPTO application is pending; the
    correct form is the trade entity (`&trade;`), and a registered-mark claim
    right now would be false.
  - No forward-looking date or timeline in `content/*.md`. The site describes
    state and sequence ("Now / Next / Then" on the roadmap page), never a
    calendar. The check flags a four-digit year that is the current year or
    later, a bare month name (`May` excluded - it collides with the modal
    verb), and phrases like "this summer" or "coming soon". A year strictly
    in the past (a biographical fact like "since 2009") is allowed on purpose,
    and the footer copyright year is out of scope entirely - it lives in
    `templates/` and `web/`, not `content/`.

## Runner contract

The job is `runs-on: docker`, the homelab's Forgejo Docker autoscaler pool,
inside a plain public `node:22-slim` image - not a custom homelab-built one.
This repo needs nothing beyond a `node` binary: there is no `package.json`,
and every script under `tools/` imports only Node built-ins (`node:test`,
`node:assert`, `node:fs`, `node:crypto`, `node:path`, `node:url`). The first
step installs `git` with `apt-get`, since the slim image does not ship it and
both the checkout step and the tracked-file scans need it.

## Secrets

None. This job reads and writes nothing outside the checkout; there is no
DefectDojo upload, no signing, no deploy step here. Deployment is Cloudflare
Pages watching the repo directly, outside this workflow.

## Operational notes

- **The Forgejo remote must receive pushes for this to fire.** This workflow
  only runs on what is pushed to the Forgejo remote (`forgejo.internal.homelab.
  equipment`) - a commit sitting only in a local clone or an unpushed branch
  never triggers it, and a pull request only gates the branch it targets, not
  whatever else is in flight.
- The content gates run `git grep` against the checked-out tree, so they see
  exactly what is committed, not whatever happens to be sitting in a working
  directory during local testing.
- If a check needs a fourth case later (a new reviewer-annotation shape, a new
  forward-date phrasing), extend the relevant step's pattern rather than
  adding a new tool dependency - the whole point of this workflow is that it
  needs nothing beyond `node` and `git`.
