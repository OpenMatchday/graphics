# Lineup geometry fixtures

Snapshots of sports package JSON used only for graphics unit tests (OM-029). Runtime app loads live sports packages; this repo does not depend on the sports package at build time (REPOS.md).

Copied from OpenMatchday/sports at the SHAs used when OM-029 landed:

- basketball `field.json` / `formations.json` / `animations.json` — FIBA Art. 2 court geometry cited in `sports/packages/basketball/docs/SOURCES.md`
- futsal `field.json` / `formations.json` / `roster.json` — FIFA Futsal Laws of the Game 2025-26 Law 1 / Law 3 cited in `sports/packages/futsal/docs/SOURCES.md`

Refresh these copies when sports package field or formation contracts change.
