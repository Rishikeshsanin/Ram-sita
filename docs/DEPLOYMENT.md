# Deployment & operations · Ram–Sita Classic

**Live game:** https://ram-sita-classic.onrender.com

Ram–Sita uses one persistent Node.js HTTP + WebSocket process. A static-only Vercel deployment will **not** run the existing WebSocket server. Vercel could host the frontend only after an explicit redesign to use an external real-time backend.

## Existing hosting

The current project is deployed as a **separate Render web service** from the public repository's **main** branch, using Docker:

| Setting | Value |
| --- | --- |
| Source | github.com/Rishikeshsanin/Ram-sita |
| Region | Singapore |
| Runtime | Docker, Node 22 |
| Plan | Free |
| Replicas | 1 |
| Start | Dockerfile default command: node src/server.js |
| HTTP health | GET /health |
| WebSocket | WSS /ws |
| Automatic deploys | **Disabled** (new Git commits alone do not update the service) |

The existing Render service can be managed from its dashboard. **Do not create a duplicate service or database to update this game.** The [render.yaml](../render.yaml) Blueprint is an option for someone hosting their *own* independent copy.

## Verify a release

1. Run **npm run check**, **npm test** and **npm run test:browser**; keep GitHub CI green.
2. Merge reviewed changes to main.
3. For runtime changes only, deploy the main branch to the **existing** Render service. Avoid doing this while friends are playing: the process restart clears all active rooms.
4. Check the Render deployment's reported commit matches the GitHub commit you intended.
5. Verify the homepage, **/health**, and that multiple browsers can create/join/complete a round over WSS.
6. If anything fails, inspect the Render deployment and application logs. Revert/redeploy a known good commit when appropriate; this also clears active rooms.

README/artwork-only updates do **not** need a Render redeploy.

## Run a personal copy

With Node.js 20+ installed:

~~~bash
npm install
npm start
~~~

Open http://localhost:3000. On a LAN, use a reachable host IP. Make sure your firewall allows port 3000. Publicly reachable play should use HTTPS and WSS.

To deploy your own Render instance, connect a fork/new GitHub repository, create one Docker web service or use [render.yaml](../render.yaml), use one replica and configure the provider's exposed PORT. No database is needed.

## Reliability and limits

> [!IMPORTANT]
> The game stores rooms **in memory**, not in a database. Restarts, rollouts, crashes or host sleep **erase current matches and codes**. Run one replica. A distributed multi-instance setup would require a shared store and an explicit architectural change.

- Free instance wake-up can slow the first visit.
- Browser session tokens allow reconnection **while the same server process still holds the room**.
- A host who disconnects for an extended period may transfer hosting privileges to another connected player.
- This design targets small casual gatherings, **3–10 players per room**. It is not tested or rated for internet-scale concurrency.
- Preserve WebSocket Origin validation, server-authoritative roles/points, and hidden-card sanitization.

## Scope boundary

This repository deploys **only Ram–Sita**. Do not make deployment changes to Minglecade, other game repos, other Render services, Supabase, or shared infrastructure as part of a Ram–Sita update.
