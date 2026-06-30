# notarium-web

Marketing site for [Notarium](https://notarium.health), a privacy-first,
local-first health tracker for Android.

This repo holds the public landing page only. The app lives in a separate
repo.

## Layout

```
web/
  index.html   The full landing page (self-contained: inline CSS, no build step)
```

The page is a single static HTML file. Styles are inline and fonts load from
a CDN, so there is nothing to compile.

## Local preview

Open the file directly, or serve the folder:

```bash
python3 -m http.server -d web 8080
# then visit http://localhost:8080
```

## Deploy

Cloudflare Pages builds from the GitHub `main` branch and publishes to
notarium.health. Pushing to `main` triggers a new deploy. There is no build
command; Pages serves the `web/` directory as-is.

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
