# Security Policy

Notarium is a private, local-first health tracker. Security and privacy are
the point of the project, and we take reports seriously. This policy covers the
**notarium-web** repository (the notarium.health website). For the app, see the
[notarium](https://github.com/notariumhealth/notarium) repository.

## Reporting a vulnerability

Please report security issues privately. **Do not open a public issue** for a
suspected vulnerability.

- Email **security@notarium.health**, ideally encrypted with our PGP key (below).
- Or use GitHub's **private vulnerability reporting**: this repository → the
  **Security** tab → **Report a vulnerability**.

## What to expect

- We acknowledge reports within **72 hours**.
- We aim for coordinated disclosure within **90 days** and will keep you posted
  on progress along the way.
- We are glad to credit you in the fix if you would like the acknowledgment.

## Scope

**In scope:** the code in this repository (the static notarium.health site) and
its deployment configuration (HTTP headers, Content-Security-Policy).

**Out of scope:** third-party dependencies (report those upstream), Cloudflare's
own infrastructure, and the Notarium app itself - report app issues in the
[notarium](https://github.com/notariumhealth/notarium) repository.

## PGP key

- Fingerprint: `C9F12610 33C96D4E 265F3B90 BD3D1ACE 0D4FBC63`
- Public key: https://notarium.health/.well-known/pgp-key.txt
- See also: https://notarium.health/.well-known/security.txt
