# Changelog

A concise history of the **Ram–Sita Classic** project. This file records completed work; it does **not** imply that a GitHub Release or version tag has been published.

## Classic V1 — playable release (October 2026)

**Play:** https://ram-sita-classic.onrender.com

### Multiplayer gameplay
- Added private six-character rooms for **3–10 players**, configurable rounds and guessing timer.
- Implemented unique secret character assignment, public Rama identity, one server-authorized final Sita guess and synchronized reveals.
- Added automatic house-rule scoring, live standings, fair Rama rotation and rematches.
- Added a pre-round **private-card confirmation** stage so no one loses guessing time while reading their role.
- Implemented session recovery while the room remains alive, host handoff and room/connection protections.

### Release checks
- Unit and integration test suite with real multi-client WebSocket coverage.
- Chromium end-to-end tests with three browser contexts, three complete rounds and a rematch.
- Responsive layout checks at 320, 390, 768 and 1200 pixels.
- Public Render smoke test covering HTTP health and real remote three-client WebSocket gameplay.
- Successful GitHub Actions checks after the Classic round-flow fixes.

### Repository showcase
- Original royal-themed README hero and gameplay-flow illustration.
- Added quick-play links, badges, characters, rules, clear score table and local setup.
- Added MIT license, contribution guidelines, security guidance, architecture, testing and deployment docs.
- Added bug/feature issue templates and a pull request template.

## Operational notes

- This remains the **Classic childhood-game experience**. Experimental symbol mechanics and other variations are not part of the playable V1.
- The Render free service can sleep, and server restarts clear in-memory rooms.
- GitHub code/documentation commits do **not** automatically deploy runtime changes; the existing Render service has auto-deploy disabled.
- Passing automated tests is not a guarantee against every real-device or network problem.

For the exact rule set, see [Game design](docs/GAME_DESIGN.md). For verification procedures, see [Testing](docs/TESTING.md).
