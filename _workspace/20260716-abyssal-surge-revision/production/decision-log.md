# Decision Log

## 2026-07-16 — Delivery identity mismatch

- **Evidence:** On 2026-07-16, `https://jellyggumi.github.io/Abyssal-Surge/` redirected to `https://jellyggumi.github.io/journal/` in the user browser. The checked-out remote was `https://github.com/jellyggumi/Abyssal-Command.git`; `https://jellyggumi.github.io/Abyssal-Command/` served the game.
- **Decision:** For the 2026-07-16 source baseline, treat the static repository and configured GitHub Pages workflow as the release source of truth. This observation does not establish the current release target after the later rename.
- **Required external delivery action:** On 2026-07-16, rename/reconfigure the GitHub repository and/or Pages target, or explicitly approve retaining the then-current `Abyssal-Command` Pages URL.
- **Owner decision:** On 2026-07-16, the project owner selected the public repository and Pages identity rename to `Abyssal-Surge`.

## 2026-07-16 — Multiplayer scope

- **Evidence:** Current game is static, browser-local and persists only a versioned IndexedDB campaign envelope.
- **Decision:** Keep the core loop offline-deterministic. Add a typed, capability-gated integration boundary only after the realtime/persistence research has chosen a service and documented authentication and authority constraints.
- **Reason:** A GitHub Pages static client cannot safely contain server credentials or act as an authoritative multiplayer host.

## 2026-07-17 — Pages release endpoint confirmed

- **Confirmation:** The repository was renamed to `jellyggumi/Abyssal-Surge`; the release reflection records successful Pages deployment and public campaign content at the current Playwriter/release target, `https://jellyggumi.github.io/Abyssal-Surge/` (`qa/release-reflection-result.json:42-61`).
