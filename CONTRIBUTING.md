# Contributing to Ram–Sita 👑

Thanks for helping make the childhood game smoother, more fun and more reliable.

## Before you start

**Classic gameplay comes first.** The game is intentionally simple: one hidden character per person, one public Rama, one final guess, reveal and scores. Please don't silently change scoring, character ordering, fairness, or add symbol-based mechanics. Propose new modes separately for discussion.

For bug reports, include the room size, game round, device/browser, reproducible steps, expected behavior and what actually happened. **Never include session tokens, private room codes from active matches, or personal data.**

## Local development

Requires Node.js 20+.

~~~bash
git clone https://github.com/Rishikeshsanin/Ram-sita.git
cd Ram-sita
npm install
npm run check
npm test
npm start
~~~

To run browser tests:

~~~bash
npx playwright install chromium
npm run test:browser
~~~

More detail: [Testing](docs/TESTING.md) · [Architecture](docs/ARCHITECTURE.md).

## Making a pull request

1. Open an issue for larger changes so we can agree on a small, isolated scope.
2. Branch from the latest main. Keep changes focused and leave other repositories untouched.
3. Add or update tests for game mechanics, role privacy, WebSocket actions and changed UI.
4. Run **npm run check**, **npm test** and, for UI changes, **npm run test:browser**.
5. Open a PR explaining what changed, why, and how it was verified. Include actual screenshots for UI changes if available; don't pass off mockups as screenshots.
6. Wait for checks to pass before merging. Do not expose secrets or production session tokens.

## Architecture guardrails

- The **server** decides role assignments, timing, score calculations and whether a guess is authorized.
- Before the reveal, clients may see their **own role**, but never another player's secret role.
- The ready-to-view stage occurs **before** the guessing timer begins.
- Keep UI usable at **320px** minimum; retain keyboard focus and reduced-motion support.
- Preserve reconnection and rematches.
- Don't add a database, another hosting service, paid resources or external art dependencies without an explicit design decision.

## Community

Be constructive, specific and respectful when reviewing code or reporting bugs. Security issues should be sent privately; see [SECURITY.md](SECURITY.md).

All contributions submitted under this repository's license are offered under the [MIT License](LICENSE).
