# Security & fair play

Ram–Sita is a casual party game, not a platform for sensitive data. It uses temporary room codes and browser-stored seat tokens. No account, payment, microphone or camera is required.

## Report a vulnerability

Please **do not** open a public issue containing a working exploit, a stolen session token, a live private room code or another person's data.

Use GitHub's **Report a vulnerability / private security advisory** option for this repository when available, or contact the repository owner privately through an existing channel. Include the affected version, an impact summary and minimal reproduction steps without posting secrets. If private reporting is unavailable, a public issue may ask for a private contact route **without disclosing the vulnerability details**.

## Security boundaries

| Area | Current implementation |
| --- | --- |
| Hidden cards | Server sends each connected player only that player's role until round reveal |
| Guess authorization | Only the player who has Rama may submit the final guess |
| Score integrity | Server assigns scores; client-supplied card scores aren't trusted |
| Room admission | A six-character shareable room code allows entry **before the match starts** |
| Seat restoration | A random per-player session token stored in the browser is required |
| Transport | HTTPS / WSS on the deployed website |
| Abuse mitigation | Input validation, basic rate limits, same-origin WebSocket handshake checks |

**Limitations:** Room codes are not passwords. Tokens are browser-local but can be compromised if someone accesses your device. This is not a general authentication system or a persistent multiplayer backend. In-memory rooms disappear after a service restart; the game should run as one server instance.

## Supported version

Security fixes are applied to the latest version of the **main** branch. The Render demo has auto-deploy disabled, so a new Git commit does not automatically mean the public site is running that commit. Check deployment state before claiming a live fix.
