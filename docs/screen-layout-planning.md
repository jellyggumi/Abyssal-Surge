# Abyssal Surge — 2.5D Battle & SPA Screen Flow Design Spec

This document details the screen layouts, transitions, core combat loop, and reward systems for the original Abyssal Surge RTS-RPG campaign.

---

## 1. Single Page Screen Flow (SPA)
All transitions happen on a single page by managing `hidden` attributes or container classes.

```mermaid
graph TD
  Lobby[Lobby Screen] -->|Start / Resume| Scenario[Scenario/Narration Screen]
  Scenario -->|Confront Boss / 보스 정보 확인| BossSpec[Boss Spec Screen]
  BossSpec -->|Start Combat / 전투 진입| Battle[2.5D Battle Screen]
  Battle -->|Action Triggered / Cooldowns| Battle
  Battle -->|Victory / Defeat| Result[Result Screen]
  Result -->|If Defeat: Retry| Battle
  Result -->|If Victory: Choose Reward & Next Stage| Scenario
  Result -->|If Final Stage Cleared| Complete[Campaign Complete Screen]
```

### 1.1 Screen Definitions & Elements
1. **Lobby Screen (`#campaign-lobby`)**:
   - The main entry point. Shows campaign title, lede, map progression, and storyboard.
   - Options to Start Campaign or Resume Campaign.

2. **Scenario View (`#view-scenario`)**:
   - Displays the story narration with a typewriter animation.
   - Shows the stage objectives and region lore.
   - Button: `Confront Boss (보스 스펙 확인)` -> transitions to Boss Spec.

3. **Boss Spec View (`#view-boss-spec`)**:
   - Displays the Stage Boss's stats: Portrait, Name, HP (Ward strength), base damage.
   - Displays the Player's current stats (Integrity, Legion Capacity, Cooldown Reduction rate).
   - Button: `Enter Combat (전투 진입)` -> transitions to Battle Screen.

4. **Battle View (`#view-battle`)**:
   - Top area: A Canvas 2D dimetric (2:1) battlefield showing the dungeon.
     - Left: Ally base camp (Dusk Portal, active summons represented as glowing purple/cyan particles).
     - Right: Boss base camp (Dread Portal, boss presence, and spawned waves of minions).
     - Automated clash: Spawned minions and ally shades move toward each other, collide, and display combat visual effects such as impact particles and neon flashes.
   - Middle area: Health bars & Status indicators.
     - Ally Integrity (10 base).
     - Boss Ward HP (e.g. 8 / 10 / 17).
     - Active Wave (e.g. Wave 1/3, Wave 2/3, Boss Wave).
     - Souls count, Node Capture Progress bar.
   - Bottom area: Control Pad / Command Grid.
     - Buttons for Hunt, Extract, Materialize, Capture, Possess, Domain, Assault.
     - Keyboard shortcuts displayed (H, E, M, C, P, D, A).
     - Cooldown overlays: Radial/bar visual progress. While cooling down, actions are disabled.

5. **Result & Reward View (`#view-result`)**:
   - Big animated banner: "VICTORY" (neon aqua) or "DEFEAT" (faded crimson).
   - Defeat option: `Retry Stage (스테이지 재시도)` resets the active stage and returns to its Scenario view.
   - Victory option: select one exclusive reward from the current stage's offered stats/items. Stage 1 exposes capacity, possession damage, cooldown reduction, or Assault damage; Stage 2 exposes vanguard, integrity restoration, or an aegis/summon item.
   - Button: `Next Scenario (다음 시나리오)` saves progression and moves to the next stage's Scenario view.

---

## 2. Core Combat & Cooldown Loop
Instead of immediate button-mashing, actions are restricted by real-time cooldowns.

### 2.1 Default Cooldowns
- **Hunt (사냥 - H)**: 4.0s
- **Extract (추출 - E)**: 6.0s
- **Materialize (실체화 - M)**: 5.0s
- **Capture (점거 - C)**: 8.0s
- **Possess (빙의 - P)**: 10.0s
- **Domain (영역 - D)**: 15.0s
- **Assault (총공격 - A)**: 3.0s

### 2.2 Cooldown & Stat Modifications (Rewards & Items)
The campaign state persists reward-driven benefits:
- `cooldownReduction`: 20% from the Stillwater Hourglass; clamped to 50% by the state API.
- `extraAssaultDamage`: +1 from Shadebreaker Brand.
- `summonBonus` and `initialAegis`: +1 from Abyssal Banner.
- Existing capacity, possession damage, starting-vanguard, and entry-integrity rewards remain available.

### 2.3 Wave Management Rules
- Each battle begins with a 25-second command-preparation interval before the initial Scout wave spawns. Commands are intended counterplay during this pre-wave window.
- After preparation, enemies spawn from the Dread Portal every 6 seconds in a repeating three-wave cycle: Scout, Guard, and Boss Reinforcement.
- Enemy counts scale by stage: 2 scouts, then `3 + stage number` guards, then `5 + stage number` reinforcements.
- Spawned minions march toward the Ally portal. A breach consumes aegis when available; otherwise it deals 1 integrity damage and can cause defeat.
- Materialized shades march toward the boss camp, collide with minion waves, and create combat impact VFX.

---

## 3. Canvas 2D Dimetric (2:1) Combat Visualization
The top section of the battle screen uses a Canvas 2D dimetric (2:1) battlefield rather than a WebGL or Three.js scene:
- **Battlefield**: A dark, futuristic grid presentation with the Ally camp on the left and the Boss camp on the right.
- **Stage briefing**: The battle presentation supplies per-stage operation, doctrine, and force labels and the corresponding palette.
- **VFX**:
  - Spawn particles: Rising smoke/sparks when shades are materialized.
  - Conflict impact: Sparks when units collide and fight.
  - Boss shield: Glowing red forcefield that fades when nodes are captured.
  - Lord's Domain: A large dome shield covering the Ally camp when activated.
- **Canvas initialization fallback**: If Canvas initialization fails, the app displays a static tactical briefing while the command pad and logical timed-wave rules remain active.
- **Reduced motion**: The Canvas updates as static, event-driven state changes rather than through continuous animation.
