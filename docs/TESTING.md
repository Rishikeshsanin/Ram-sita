# Testing · Ram–Sita Classic

The goal is to keep each friend's secret **secret**, every round fair, and the game usable on real phones.

## Local test commands

Requires Node.js 20+ and npm:

~~~bash
npm install
npm run check          # JavaScript syntax
npm test               # Node logic, privacy and WebSocket integration
npx playwright install chromium
npm run test:browser    # Real Chromium UI across separate browser contexts
~~~

Do not report a suite as passed without an actual successful run. GitHub Actions executes the same core checks automatically.

## Current automated coverage

| Suite | Coverage |
| --- | --- |
| [Unit and WebSocket integration](../test/) | Room settings, unique characters, role secrecy, access controls, scoring, timeouts, pause/resume, Rama rotation, reconnect, host transfer and 10-player/30-round simulations |
| [Chromium end-to-end](../browser/classic.spec.js) | Three independent browser contexts: create → join → ready → private deal → all-card confirmation → three complete rounds → final leaderboard → rematch |
| [Responsive Chromium](../browser/classic.spec.js) | 320px, 390px, 768px and 1200px page layout / horizontal overflow check |
| [Public smoke](../smoke/live-smoke.js) | Reaches real Render /health, connects three external WebSocket clients, checks privacy, ready stage, correct Rama guess and total points |

**Evidence:** [Node CI history](https://github.com/Rishikeshsanin/Ram-sita/actions/workflows/ci.yml) · [Public smoke history](https://github.com/Rishikeshsanin/Ram-sita/actions/workflows/public-smoke.yml).

Automated tests are not a guarantee that every physical device and network will be trouble-free.

## Manual playtest checklist

Use **at least three real phones** sitting together. Ideally test one iPhone Safari and one Android Chrome on separate networks as well.

- [ ] Create a new room; join with a code **and** an invite link.
- [ ] Try duplicate names, full rooms and incomplete ready states.
- [ ] Change settings before starting; ensure the host alone can start the game.
- [ ] Deal: check that everyone sees only their own character, while Rama's name is public.
- [ ] Deliberately leave one phone unconfirmed. Verify the guess countdown **does not** start.
- [ ] Confirm the final card. All players should begin the same timer phase.
- [ ] As a non-Rama player, verify you cannot make the final guess.
- [ ] As Rama, guess correctly in one round and incorrectly in another. Check points and reveal timing.
- [ ] Let one round time out; check its result and score.
- [ ] Pause/resume as host, especially close to the timer deadline.
- [ ] Reload a phone midgame and confirm it returns to **its own** seat and role.
- [ ] Open the same seat in a second tab; check that actions cannot be controlled simultaneously.
- [ ] Disconnect the host for long enough to test host handoff.
- [ ] Test the final standings and a fresh rematch with the same players.
- [ ] Test 3-player and 10-player lobbies; scroll around on 320px mobile width.
- [ ] On the free hosting plan, test first-load wake-up after an idle period.

## Live service checks

~~~bash
curl https://ram-sita-classic.onrender.com/health
~~~

Expected JSON includes status **ok** and app **ram-sita**. The current room count, if returned, is process-local and temporary.

The public smoke workflow creates its **own disposable room** and tests it from GitHub Actions. Do not hard-code live player tokens. The public smoke workflow is intentionally scoped to its own test script/workflow changes or manual dispatch; it does **not** run on every commit or continuously monitor uptime.

## Known limitations

- The free hosting instance may sleep; restart/redeploy destroys in-memory rooms.
- Automated scripts do not reproduce every slow mobile network, device layout or interrupted in-person discussion.
- The current score table is an **explicit house-rule variant**, not a guarantee of the rules used in every family.

If you find a bug, use the [bug report template](../.github/ISSUE_TEMPLATE/bug_report.yml), with reproduction steps but **no session tokens**.
