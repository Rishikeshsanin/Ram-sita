# Ram–Sita — Classic V1 product and release plan

## What this is
A fast, phone-based version of the childhood Ram–Sita paper-chit game. **Everybody must be sitting in the same physical room** and talking to each other; devices provide private roles, guesses, scores and synchronized reveals.

## V1 — Classic only
1. Host creates a room for 3–10 friends and chooses 3–30 rounds plus a 20–90-second guessing timer.
2. Friends use a private room code or invitation link, choose names and ready up.
3. The server shuffles one distinct character per player and enters **dealing** (private-card confirmation). Everyone sees a sealed card; Rama's identity is public.
4. Each player privately reveals their own card, then taps Ready. **The timer is not running yet**. Only when every connected player has confirmed does the server enter **discussion** and begin the host-selected countdown.
5. Players bluff face-to-face; only Rama may lock a single Sita guess. If time expires first, the round resolves as a missed guess.
6. The server reveals roles and awards points using the documented house scoring. The host advances to a new deal. At the final round, scores determine the winner(s); rematch returns everyone to the lobby.

**No symbols, hidden missions, wagering, or experimental characters** in Classic V1.

## Scope and architecture
- **Frontend:** plain HTML/CSS/JS, responsive from small phone widths.
- **Backend:** single Node.js HTTP and WebSocket process. Server assigns roles, validates actions and calculates scores.
- **Hosting:** standalone WebSocket-capable service, separate from Minglecade. Dockerfile and Render Blueprint included. Minglecade will link to the verified HTTPS game URL once deployment and public testing pass.
- **Storage:** in-memory rooms, no database, no Supabase or other project integrations. A restart loses active rooms; run exactly one replica.
- **Identity:** random local session token, not a login system. All player roles except the requester's are hidden until reveal.

## Known limitations / launch criteria
- A deployment or free-host sleep/restart clears the current rooms. A paid always-on instance or durable storage can be considered later if necessary.
- A stable public URL cannot be added to Minglecade before the game deploys and passes an end-to-end public join test.
- Automated checks include unit tests, WebSocket integration tests, and a real Chromium three-browser happy-path test (3 rounds, rematch, 320/390/768/1200px layouts). These tests do **not** replace a physical multi-phone test on unstable mobile data. Re-check timeouts, pause/resume, disconnections, host transfer, and free-host wake-up before declaring this production-stable.
- Regional paper-chit scoring differs. Our first release uses the clearly published house rules in README.
- Avoid claiming physical-phone testing, production uptime, or Minglecade publication until verified.

## Later ideas — not implemented in Classic
If real players enjoy V1, **separate optional** game modes could be explored: social-deduction objectives, friend-custom character packs, alternate house-rule scoring, Telugu names, motion/sounds and tournament results. Existing Classic behavior must remain simple and untouched.
