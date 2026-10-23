# Authentic Ram–Sita gameplay screenshots

Every PNG in this folder is a **real Chromium screenshot from the running Classic game**, not an illustrative mockup, AI rendering or fabricated UI.

The screenshots were generated from a **disposable three-player local match** using the same public HTML/CSS/JavaScript and real-time WebSocket server as the deployed application.

| File | What it captures | Viewport |
| --- | --- | --- |
| [01-home-desktop.png](01-home-desktop.png) | Royal home screen and setup form | 1366 px desktop |
| [02-home-mobile.png](02-home-mobile.png) | Phone-sized Create/Join landing screen | 390 px phone |
| [03-lobby-mobile.png](03-lobby-mobile.png) | Host lobby after guests join and ready up | 390 px phone |
| [04-private-card-mobile.png](04-private-card-mobile.png) | Sita character shown on the owner's own screen | 390 px phone |
| [05-rama-guess-mobile.png](05-rama-guess-mobile.png) | Rama's timed final-selection UI | 390 px phone |
| [06-role-reveal-mobile.png](06-role-reveal-mobile.png) | All roles revealed after a correct guess | 390 px phone |
| [07-leaderboard-mobile.png](07-leaderboard-mobile.png) | Final leaderboard after three rounds | 390 px phone |

## Reproduce these captures

Requires Node.js 20+, npm and Playwright Chromium.

~~~bash
npm install
npx playwright install chromium
CAPTURE_SHOWCASE=1 npx playwright test browser/showcase.spec.js
~~~

Windows PowerShell:

~~~powershell
$env:CAPTURE_SHOWCASE = '1'
npx playwright test browser/showcase.spec.js
Remove-Item Env:CAPTURE_SHOWCASE
~~~

The test starts a local server, opens **three separate browser contexts** and plays through the full flow. It confirms the role assignments, captures both private and public stages, and checks PNG headers and nontrivial file sizes. A GitHub Actions manual capture workflow can reproduce the screenshots as a commit.

### Privacy and accuracy

- Display names such as Host, Asha and Charan are invented test participants.
- Room codes are temporary and belong only to a local test process.
- Screens show the **actual product UI**, but do **not** imply physical-phone tests, internet-hosted session evidence, or all-network reliability.
- Some screenshots show private roles, intentionally captured from that role owner's perspective **before reveal**. In real matches, other players cannot see that information until the reveal.
