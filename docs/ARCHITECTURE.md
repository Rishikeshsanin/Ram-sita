# Architecture · Ram–Sita Classic

## At a glance

Ram–Sita is a mobile browser client and a **single authoritative Node.js server**. Phones are individual secret-card viewers; human conversation happens in the room. No database or external real-time vendor is necessary for the current V1.

~~~text
Browser A ── WSS ─┐
Browser B ── WSS ─┼── Node HTTP + WebSocket server ── in-memory game rooms
Browser C ── WSS ─┘           │
                              ├─ src/server.js (transport + validation)
                              └─ src/game.js (roles, timer, points, phases)
~~~

The same HTTP server serves public/index.html, public/styles.css, public/app.js and public/favicon.svg. WebSocket clients connect to **/ws** and HTTP **/health** returns status.

## Round lifecycle

~~~mermaid
flowchart LR
  A[Lobby] --> B[Dealing]
  B -->|All players confirm role| C[Discussion]
  C -->|Rama locks guess or timer expires| D[Reveal]
  D -->|More rounds| B
  D -->|Last round| E[Finished]
  E -->|Host rematch| A
~~~

- **Lobby:** Players join using a room code, choose display names, ready up, and host controls the match settings.
- **Dealing:** Server securely shuffles unique characters. Every player privately checks their card. Rama is public. There is **no** active guess timer yet.
- **Discussion:** The server starts the timer only when everyone has confirmed their card and is connected. People bluff in person. Only Rama gets a final-guess action.
- **Reveal:** Everyone sees the real roles, choice and fixed score deltas. Host advances to a new deal or ends the match.
- **Finished:** Final cumulative leaderboard; host may reset scores and re-use the same room.

### Character and turn assignment

The roster in **src/game.js** is ordered: Rama, Sita, Ravana, Lakshmana, Hanuman, Bharata, Shatrughna, Sugriva, Vibhishana, Jatayu. Every match uses one unique character per participant, capped at 10.

For Rama, the server chooses randomly among the players with the **fewest Rama turns**, making the turn opportunity balanced over time. Remaining characters are securely shuffled among other participants.

## Messages and session model

The browser uses JSON messages over a persistent WSS connection:

| Direction | Message | Purpose |
| --- | --- | --- |
| Client → server | create, join, resume | Establish a room and a private seat |
| Client → server | ready, config, kick, start | Manage lobby (host-only controls enforced on the server) |
| Client → server | role_ready | Confirm the dealt role is seen; start when all have confirmed |
| Client → server | guess, pause, next, rematch, leave | Round and room actions, validated against role/phase/host |
| Server → client | session | Private seat token returned only to that browser |
| Server → client | snapshot | Per-player sanitized room view (no other hidden cards) |
| Server → client | error, kicked, left | Error and departure feedback |

Seat tokens are random and stored in localStorage in the user's browser. Reconnecting with a valid token reattaches the player's seat. Replaced WebSocket sessions cannot continue sending authorized actions.

## Safety, limits and durability

- Session and room state live **in memory**. One process / one replica only; deploys, restarts and free-host sleep may destroy rooms.
- The session's browser token is **not** included in opponents' snapshots.
- The server determines assignments and points; clients only submit valid actions.
- Approximate operational policies in the current implementation: **25-second WebSocket pings**, a **45-second** offline host handoff, and **4-hour** idle room expiry.
- The server has basic input validation and message throttling. It's intended for friend groups, not anonymous internet-scale adversarial use.
- No database, media capture, login or external art content is needed.

## Where to work

| Need | File |
| --- | --- |
| Scoring, fairness, phases, permission checks | src/game.js |
| WebSocket, health, static assets and session transport | src/server.js |
| Visuals, rooms and mobile responsive experience | public/app.js, public/styles.css |
| Logic and socket contract tests | test/ |
| Browser multi-user and viewport checks | browser/ |
| Real deployed-service probe | smoke/live-smoke.js |

Read [Testing](TESTING.md) before changing gameplay logic or public snapshots.
