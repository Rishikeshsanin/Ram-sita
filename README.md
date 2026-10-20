# Ram–Sita · Classic Party Game

**The childhood paper-chit game, on everyone's phone.** Built for friends sitting together in the same physical room. No accounts and no camera or microphone.

## Play

1. The host creates a private room and chooses **3–10 players**, **3–30 rounds**, and a **20–90-second** guessing timer.
2. Friends join with the six-character code or invite link, type a name, and tap **Ready**.
3. Each player privately flips their secret character card. **Rama** is announced publicly.
4. Everyone talks face-to-face and can bluff. Rama selects the person they think is **Sita** before the timer ends.
5. All characters are revealed together. Everyone earns points, then the host starts the next round.
6. After the configured number of rounds, the leaderboard crowns the winner. Rematches reuse the same room.

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

Run the **single, persistent Node.js service** (with WebSocket support) on Railway or a compatible host, with one replica. The repository includes a `Dockerfile` and a `/health` endpoint.

Minglecade is a **directory**, not a game server: add the **live public game URL** to Minglecade's `src/data/games.ts`, then the hub shows a Ram–Sita card pointing to the independent deployed app.

### Important operational limitations

- Rooms currently live in this Node process's memory. **Restart/redeploy clears active games**, so avoid redeploying during a match.
- Use one instance/replica. A database or durable room store can be evaluated later.
- Session tokens stay in each player's own browser; the server assigns characters, accepts only Rama's final guess, and computes the score.
- WebSocket connections may briefly drop on bad networks; reloading reconnects a seat using its saved local session.
- This is designed for social play among friends who share the code; room codes are not user authentication. Keep card screens private.
- Only Ram–Sita and the Minglecade directory are in the scope of this release.

## Tests

GitHub Actions runs JavaScript syntax checks, unit tests and a real three-client WebSocket match after each push:

```bash
npm run check && npm test
```

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the scope and deferred ideas.
