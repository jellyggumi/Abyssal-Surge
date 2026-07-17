# Decision Log

## 2026-07-16 — Delivery identity mismatch

- **Evidence:** `https://jellyggumi.github.io/Abyssal-Surge/` redirected to `https://jellyggumi.github.io/journal/` in the user browser. The checked-out remote is `https://github.com/jellyggumi/Abyssal-Command.git`; `https://jellyggumi.github.io/Abyssal-Command/` serves the game.
- **Decision:** Treat the static repository and configured GitHub Pages workflow as the current release source of truth. Do not claim the requested Abyssal-Surge URL is deployed.
- **Required external delivery action:** Rename/reconfigure the GitHub repository and/or Pages target, or explicitly approve retaining the current `Abyssal-Command` Pages URL.
- **Owner decision:** Rename the public repository and Pages identity to `Abyssal-Surge`; the corrected release URL is `https://jellyggumi.github.io/Abyssal-Surge/`.

## 2026-07-16 — Multiplayer scope

- **Evidence:** Current game is static, browser-local and persists only a versioned IndexedDB campaign envelope.
- **Decision:** Keep the core loop offline-deterministic. Add a typed, capability-gated integration boundary only after the realtime/persistence research has chosen a service and documented authentication and authority constraints.
- **Reason:** A GitHub Pages static client cannot safely contain server credentials or act as an authoritative multiplayer host.
