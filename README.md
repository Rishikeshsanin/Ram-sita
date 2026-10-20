# RAM–SITA · A face-to-face party game

A mobile-first, real-time Ram–Sita paper-chit game for friends **physically together**. Everyone joins a private room on their own phone; the app handles private roles, honest scoring and reveal animations while the conversation happens in the room.

## Features

- **Classic mode:** Rama must find Sita among the other hidden roles.
- **Court of Whispers (Mystery mode):** Rama, Sita and Ravana privately know the same royal sigil. Everyone except Rama can publicly claim *any* sigil; Ravana can impersonate Sita. Players debate face-to-face before Rama chooses. There is no automatic truth indicator.
- 3–10 players, no signup, room code and shareable invitation URL.
- Host chooses room size, 3–30 rounds, 20–90-second discussion timer and mode. Host can pause/resume, remove players before starting, and replay.
- Private role views, server-authoritative shuffles, guesses, scores, timer and reveals; reconnect on reload using local session credentials.
- Fair Rama rotation: prioritizes players who have been Rama least often. Remaining roles are securely shuffled.
- Dark royal mobile design, animated character cards, live standings and final winners.

## Quick start

Requires Node.js 20 or later.

```bash
npm install
npm start
```

Visit **http://localhost:3000**. For testing across phones on the same Wi-Fi, run the server on a reachable LAN host and use its IP (for example, `http://192.168.1.5:3000`). For remote friends or HTTPS, deploy this *single Node service* to Railway, Render, or another host that supports persistent WebSockets. **Vercel static-only/serverless deployment is not sufficient for this WebSocket version.**

```bash
npm test
npm run check
```

## Rules and scoring

Each round everyone gets exactly one role. Rama tries to identify Sita. The game supports regional house-rule variations; V1 uses this explicit house scoring:

| Role | Rama finds Sita | Rama misses / timer expires |
| --- | ---: | ---: |
| Rama | +1,000 | +0 |
| Sita | +200 | +800 |
| Ravana | +100 | +500 |
| All other roles | +200 | +200 |

Mystery mode uses the **same scoring** so clever conversation, not extra game currency, determines the winner. The highest cumulative score after the configured rounds wins; ties share placement.

## How a game works

1. One person creates a room, chooses settings and shares the room code/URL.
2. Each friend joins with a display name, taps Ready, and stays in the real room.
3. The host starts. Everybody receives a privately rendered role. Rama is identified publicly; in Mystery mode players submit one public sigil claim.
4. Rama listens, questions friends, then submits a final guess before time runs out.
5. The server reveals the roles, awards points, and shows the leaderboard. Host starts the next round.
6. At the end, everyone sees the final standings and can play again.

## Security and operation

- Room secrets, roles, guesses and points are **never trusted from clients**. Session tokens live in each player's browser and are never included in another player's view.
- Room snapshots contain only the sender's private role/sigil before reveal. **Avoid sharing your screen.**
- Basic per-socket message and room-creation limits, strict input validation, static file allowlist, origin checks and expiry cleanup.
- For this initial release, rooms are stored in the server's memory; process restarts clear active rooms. Use **one server instance**, no autoscaling. No external database or other projects are touched.
- No phone calls, camera, microphone, paid services or Supabase needed.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for feature decisions and expansion plan.
