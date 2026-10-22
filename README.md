# Ram–Sita · Classic Party Game

**The childhood paper-chit game, on everyone's phone.** Built for friends sitting together in the same physical room. No accounts and no camera or microphone.

## Play

1. The host creates a private room and chooses **3–10 players**, **3–30 rounds**, and a **20–90-second** guessing timer.
2. Friends join with the six-character code or invite link, type a name, and tap **Ready**.
3. The host starts the match. Everyone receives one **secret character** and sees a sealed card. **Rama's name** is publicly announced; other identities stay private.
4. Everyone taps **Reveal my card** privately, reads their character, then taps **I have seen my card — Ready!**. There is **no countdown during this stage**.
5. When **all connected players** have confirmed their cards, the host's selected timer begins automatically. Everyone talks and bluffs aloud. Only Rama can make **one final guess** of who has Sita.
6. If Rama guesses or the timer expires, everyone's roles are revealed and the server awards the round points. The host taps **Next round**; each new round also has a private-card confirmation stage.
7. When the chosen rounds are over, highest cumulative score wins (ties share first place). Host may start a **rematch** in the same lobby; everyone readies up again.

The first release is **Classic only**. No mystery symbols, missions, or experimental mechanics. We can consider them as an optional separate mode later.

## Score rules (initial house rules)

Regional Ram–Sita paper-chit rules differ. This launch uses one transparent default:

| Character | If Rama finds Sita | If Rama misses or time expires |
| --- | ---: | ---: |
| Rama | +1,000 | +0 |
| Sita | +200 | +800 |
| Ravana | +100 | +500 |
| All other characters | +200 | +200 |

Players receive one unique role per round. Rama rotates so each player gets the seeker role fairly over the match. Highest total wins; equal totals are shared winners.

## Run locally

Requires Node.js >=20:

```bash
npm install
npm run check
npm test
npm start
```

Open http://localhost:3000. To connect phones on the same Wi-Fi, start the app on a host reachable via its LAN IP and open `http://HOST_IP:3000` from every phone. Sharing across the Internet requires public HTTPS and working WebSocket support.

## Deploy

**Play the deployed game:** https://ram-sita-classic.onrender.com . The app requires a **single persistent WebSocket-capable Node.js host** and includes a `Dockerfile`, `render.yaml` and `/health` endpoint.

### Render fallback (prepared)

Railway may temporarily block new deployments. We included a dedicated [Render Blueprint](render.yaml) for this exact repository. To deploy it:

1. Open [Render Dashboard](https://dashboard.render.com/) and connect GitHub.
2. Choose **New → Blueprint**, select `Rishikeshsanin/Ram-sita` on branch `main`, and approve only the new **ram-sita-classic** web service. Do **not** import any existing services or databases.
3. Let the Docker build and HTTP `/health` checks finish, then open the **actual** `.onrender.com` address shown in your dashboard. Never guess a live URL from the service name.
4. Verify the public homepage, `/health`, and a 3-person round from separate phones.
5. After verification, add that exact HTTPS URL to [Minglecade](https://github.com/Rishikeshsanin/Minglecade) in `src/data/games.ts`.

The Blueprint targets a **single Singapore-region Free web service** with no database. Free services can spin down after 15 minutes without inbound HTTP or WebSocket messages, and sleeping, restarting or redeploying will erase the in-memory rooms. For a more dependable always-on game, consider a paid instance only after explicitly agreeing to the cost. A free instance is appropriate for testing and casual rounds, not production uptime.

Minglecade is a **directory**, not a game server: its Play link opens the standalone game in another tab. Do not publish a placeholder or speculative game URL.

### Important operational limitations

- Rooms currently live in this Node process's memory. **Restart/redeploy clears active games**, so avoid redeploying during a match.
- Use one instance/replica. A database or durable room store can be evaluated later.
- Session tokens stay in each player's own browser; the server assigns characters, accepts only Rama's final guess, and computes the score.
- WebSocket connections may briefly drop on bad networks; reloading reconnects a seat using its saved local session.
- This is designed for social play among friends who share the code; room codes are not user authentication. Keep card screens private.
- Only Ram–Sita and the Minglecade directory are in the scope of this release.

## Tests

GitHub Actions runs JavaScript syntax checks, unit tests, a real three-client WebSocket match, and Chromium browser end-to-end tests after each push:

```bash
npm run check && npm test
# For local Chromium browser tests (install browser once):
npx playwright install chromium
npm run test:browser
```

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the scope and deferred ideas.
