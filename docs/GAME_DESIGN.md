# Game design and phased plan

## Product concept
A game built to **bring people in the same real room closer together**. A phone is a private identity card and scoreboard, not a substitute for conversation. 3–10 friends; no video or microphone needed.

## The two launch modes
**Classic:** Rama knows their own identity and must find Sita. Everyone may bluff aloud. The round ends with one locked guess or time expiry. Roles reveal and the server scores everyone.

**Court of Whispers:** Rama, Sita and Ravana are all privately shown one randomly selected **royal sigil**. Other players do not know which sigil is correct. Each player except Rama can choose/change one *public sigil claim* (from six). Each round also displays one of 20 lighthearted **Court Challenges** as a conversation starter for everyone. Everyone debates in person. Two people may truthfully know the sigil, but one of them is Ravana, so a matching claim proves nothing. Sita can lie; Ravana can impersonate; other players can bluff. Rama locks one guess. Same scoring as Classic.

Why the twist works: an explicit information asymmetry creates a unique moment every round, while roles are still private and no player's device sends proof of their identity to another player. Avoid claiming this gameplay is unprecedented without market research.

## Product stages
- **V1 (implemented):** Server-authoritative real-time room state, customizable host settings, private identity, Classic and Court of Whispers, timer/pause, standings, rematch, mobile interface, reconnection, no signup.
- **V1.1 (proposed):** Sound and haptic reveal options; invite QR; optional Telugu labels; native share cards; accessibility/keyboard improvements after physical-play testing.
- **V2 (proposed):** Alternate house-rule scoring presets, friend-custom character packs, offline party mode or durable session recovery, replay highlights, richer animations and guided first-time tutorial.
- **V3 (explore):** “Royal Trials” with event cards for larger courts (each trial needs role secrecy/fairness testing), local-room tournaments and team variants.

## Technical notes
Frontend: HTML, CSS, plain JavaScript. Server: Node HTTP + \`ws\`. A **single process** owns all room state; clients never choose points or role assignments. No SQL, Supabase, login or other game repository is needed.

WebSocket transport allows players on separate phones to share live state. Deploy one reachable HTTPS + WebSocket Node endpoint (e.g., Railway) and share its link. Because state is in memory, restarts/redeploys clear rooms; multi-instance scaling is not supported. A durable Redis/PostgreSQL-backed room lifecycle would be a later upgrade. Do not claim production durability.

Security assumptions: arbitrary players may join if they know a six-character code; codes are not authentication, but session tokens are bound to seats. No personal/financial data is required. Limit public room creation and keep the session token private. Never expose pre-reveal roles/sigil to another player's snapshot. Avoid sharing the card screen.

## Verification checklist
- Room creation and join at 3 and 10 seats; capacity and duplicate-name rejection.
- Exact count of hidden roles and no Sita leaks before reveal.
- Rama cannot submit multiple guesses; non-Rama cannot guess.
- Server timer fires even if clients disconnect.
- Paused timer stays frozen; resume uses remaining time.
- Mystery mode: true sigil goes only to Rama/Sita/Ravana and public claims are choices, not cryptographic proof.
- Player reconnect returns to the same private seat; host transfer if disconnected.
- Repeated matches, revealed scores, and no role persistence after rematch.
- 320px mobile width, keyboard focus, slow networks and refreshes.
