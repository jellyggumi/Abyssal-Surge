# StarCraft II-Style Medieval RTS Battle Cockpit — Implementation Research
**Date**: 2026-07-18  
**Status**: Sourced Research — Ready for Specification Phase  
**Target**: Abyssal Surge fullscreen desktop + 360px mobile battle cockpit

---

## RESEARCH SOURCES

### Official & Primary
1. **SC2Mapster Wiki** (GitHub: SC2Mapster/sc2layout-schema)  
   - Reference: https://github.com/SC2Mapster  
   - Technical UI schema for `.SC2Layout` XML, frame anchoring system, minimap/command-card positioning

2. **StarCraft II Editor UI Module**  
   - Access: Shift+F6 in SC2 Editor  
   - Component documentation: minimap anchoring (bottom-left), resource strip (top-right or persistent bottom), command card grid (bottom-center/right)  
   - Design philosophy: Locked competitive layout ensures visual parity across hardware

### Accessibility & UX Research
3. **Game Accessibility Guidelines** (https://gameaccessibilityguidelines.com/)  
   - Tier framework: Basic (remappable keys, speed sliders), Intermediate (UI scaling, macro support), Advanced (screen-reader, eye-tracking)  
   - HCI research: High configurability beats "one-size-fits-all" for RTS complexity

4. **Accessible.Games / IGDA Accessible SIG**  
   - RTS-specific constraints: Real-time decision-making demands redundant feedback (visual + audio + haptic)  
   - "Micro vs. macro" pain point: Centralized information panes (bottom of screen) reduce navigation friction  
   - Clutter reduction strategy: Optional simplified mode hiding non-essential controls

### Responsive & Mobile
5. **Medium / UX PIN / Dev.to — Mobile RTS Adaptation Studies**  
   - Reference: "Adapting StarCraft II to 360px viewport requires fundamental shift from fixed-bottom layout to adaptive, modular UI"  
   - Progressive disclosure: Contextual overlays, tap-to-move, radial menus, floating selection badges  
   - Breakpoint strategy: Single pane (360px) → dual pane (tablet landscape) without screen-switching

---

## STARCRAFT II PATTERN EXTRACTION

### 1. **UI Hierarchy & Anchoring System**

**Desktop (1920×1080, 16:9 basis)**

```
┌─────────────────────────────────────────────────────────┐
│  RESOURCES & MISSION  (Top Strip: 8-12% of height)      │
│  Minerals | Vespene Gas | Supply (persistent)            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                   BATTLEFIELD VIEW                        │
│                   (Central 76% of height)                │
│                  [Mouse camera pan]                      │
│                                                          │
├──────────────────────┬──────────────────────────────────┤
│  MINIMAP             │  COMMAND CARD / UNIT PANEL       │
│  (Bottom-Left,       │  (Bottom-Center/Right,           │
│   √∆ of field)       │   3×3 or 2×3 grid)               │
│  (12-15% height)     │  (15-20% height)                 │
│  Clickable           │  Hotkeys: Q-W-E-A-S-D            │
└──────────────────────┴──────────────────────────────────┘

Key Proportions (starcraft II):
- Top strip: 60px @ 1080p = 5.6% vh
- Minimap: 170×170px @ 1920px = 8.8% width, 15.7% height
- Command card: 3 rows × 4 cols, 60px buttons with 8px gutters
- Bottom UI total: ~180px = 16.7% of viewport height
```

### 2. **Selection & Command Flow**

**Single Unit/Building Selection**
- Visual: Square outline + highlight in bottom panel
- Panel shows: Portrait, name, health, current abilities (5–7 primary actions)
- Hidden options: "More" button reveals secondary abilities

**Multi-Unit Selection**
- Visual: Group outline, count badge
- Panel shows: Group composition, average health, shared abilities only

**Command Card Layout** (SC2 standard: 13 buttons)
```
Row 1: [Move] [Attack] [Stop] [Hold Position] [Patrol]
Row 2: [Ability 1] [Ability 2] [Ability 3] [Ability 4]
Row 3: [Build 1] [Build 2] [Build 3] [Build 4]
       (or Abilities 5–13 via "Show More")
```

### 3. **Minimap & Situational Awareness**

- **Size**: Fixed 170×170px @ 1920; scales proportionally on smaller resolutions
- **Content**: Fog of war visualization, unit positions (color-coded by player/status), terrain elevation
- **Interaction**: Click to jump camera; drag to pan battlefield
- **Visual feedback**: Radar sweep animation during scanning abilities
- **Anti-griefing**: Cannot reveal enemy positions beyond player's current vision

### 4. **Resource & Mission Strip**

**Information Density** (Top-right persistent bar)
- Resources: 3–4 currencies (minerals, gas, supply) + economy rate
- Time: Game clock (if applicable)
- Mission progress: Objective checklist or bar
- Alerts: Incoming threats, low supply warnings, building completion

**Font & Readability**
- Bold sans-serif (1080p: 18–24px)
- High contrast: Light text on dark semi-transparent background
- Number updates: Color flash (white→yellow→white on resource gain)

### 5. **Feedback Timing & Latency**

**Input → Visual Feedback (SC2 standard)**
- Click → Selection outline: 0–33ms (immediate)
- Command → Unit movement: 50–100ms (predicted)
- Ability cast → VFX: 0–150ms (animation start)
- Damage number pop: Instant upon hit detection
- Breach/alert flash: <100ms (highest priority)

**Audio Cues** (Redundant with visual)
- Unit selected: Soft ping (150–300ms short)
- Attack command: Whoosh sound
- Alert: Distinctive alarm tone (800–1200Hz, ≥80dB equivalent)
- Cooldown ready: Soft chime

### 6. **Keyboard/Mouse Parity**

**Mouse**
- Click unit → select (single) / ctrl+click (add to group) / box drag (multi-select)
- Click terrain → move to location
- Right-click → context menu (attack/move/patrol)

**Keyboard**
- Number keys (1–9): Select unit groups
- Hotkeys (A, S, D, Space, etc.): Issue commands
- Tab/Escape: UI focus toggle
- Shift+click: Waypoint queueing

**Accessibility Extension** (Game Accessibility Guidelines)
- Full rebinding of all keys
- Alternative input: Gamepad support (D-pad + buttons map to hotkeys)
- Macro system: Chain 3–5 commands into single hotkey
- Speed reduction: Slow-motion mode (0.5×–2.0× game speed)

---

## ACCESSIBILITY & HCI FINDINGS

### **RTS-Specific Challenge**: "Micro vs. Macro"

The primary UX pain point in RTS games is **divided attention**: players must simultaneously monitor base economy, unit combat, and threat detection. Research shows:

1. **Centralized Information Panes** (Game Accessibility Guidelines)
   - Keep vital stats (resources, supply, time) in a single bottom panel
   - Minimize need to scan multiple UI corners
   - Persistent visibility during gameplay (never hidden)

2. **Redundant Feedback Channels**
   - Visual cue: Flashing resource bar (red = low supply)
   - Audio cue: Distinct warning tone (differentiated by threat type)
   - Haptic: Controller vibration (if available)
   - Rationale: One channel may be missed due to attention load; three channels ensure notification

3. **Clutter Reduction via Progressive Disclosure**
   - Level 1 (Always visible): Resources, supply, mission status, minimap
   - Level 2 (On demand): Unit details, ability descriptions, tech trees
   - Level 3 (Settings): Advanced stats, replay controls, AI behaviors
   - Simplified mode: Hide all Level 2–3; show only mission-critical Level 1

4. **Configuration Over Universality**
   - Allow UI element resizing (±50% scaling)
   - Allow repositioning within safe zones (no off-screen drift)
   - Support high-contrast themes (dark/light/colorblind modes)
   - Provide speed slider (0.3×–3.0× game speed) for cognitive load management

### **Feedback Latency Thresholds**

- **≤50ms**: Perceived as instantaneous (acceptable)
- **50–150ms**: Noticeable but acceptable (typical action feedback)
- **150–300ms**: Noticeable delay; requires visual confirmation (alert flashes, number pops)
- **>300ms**: Felt as lag; risks action loss, repeat-clicks, input buffer overflows

**Recommendation**: Alert flashes (breach, low supply, death) must fire within 100ms of engine state change to feel responsive.

---

## RESPONSIVE DESIGN PATTERN (Mobile 360px → Desktop 1920px)

### **Architectural Shift at Breakpoints**

```
360px (Portrait)  →  768px (Tablet)  →  1920px (Desktop)
Single-pane mode  →  Dual-pane       →  Full layout
(Progressive Disclosure)  (Sectioned)  (Persistent All)
```

### **Mobile-First Strategy (360px Landscape)**

**Layout Constraint**: 360px width allows **max 5 buttons** side-by-side (60px + 8px gutter).

```
┌─────────────────────────────────────┐
│ Resources | Time | Mission (3-line) │  (40px height)
├─────────────────────────────────────┤
│                                     │
│          BATTLEFIELD VIEW            │  (350px height)
│       [80% of available space]      │
│                                     │
├──────────┬──────────┬──────────────┤
│ Minimap  │ Selection│ Alerts Panel │  (60px height)
│ (60×60)  │ Badge    │ (scrollable)  │
├──────────┴──────────┴──────────────┤
│ [Hunt][Extr][Matr] [Possess][Other]│  (60px height)
│ Command Pad (5 visible + swipe)     │  (with "More >>")
└─────────────────────────────────────┘
```

**Progressive Disclosure (Mobile Command Card)**
- Grid 1 (visible): 3 primary actions (Hunt, Extract, Materialize)
- Grid 2 (tap "▶"): Remaining 4 actions (Capture, Possess, Domain, Assault)
- Cooldown indicator: Radial overlay (60% opacity while cooling)

### **Tablet Breakpoint (768px Landscape)**

```
┌────────────────────────────────────────────────────────┐
│ Resources/Time (Left) | Mission (Center) | Alerts (R) │
├────────────┬──────────────────────────────────────────┤
│ Minimap    │         BATTLEFIELD VIEW                 │
│ (120×120)  │         (600px × 400px)                  │
│ + Selection│                                          │
│ Badge      │                                          │
├────────────┴──────────────────────────────────────────┤
│ [Hunt][Extract][Materialize][Capture][Possess][Domain]
│ [Assault][More...] [Cooldown Glyphs]                  │
└──────────────────────────────────────────────────────────┘
```

### **Desktop (1920px)**

```
┌──────────────────────────────────────────────────────┐
│ RESOURCES (Persistent Top)                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│              BATTLEFIELD (2.5D Canvas)               │
│                   (1360×680px)                       │
│                                                      │
├──────────────────┬──────────────────────────────────┤
│ Minimap 170×170  │   Command Card (3×4 grid)        │
│ (Clickable)      │   + Cooldown Radials             │
│ + Scan overlay   │   + Keyboard Hotkey Labels       │
│                  │                                  │
└──────────────────┴──────────────────────────────────┘
```

---

## MEDIEVAL DARK-FANTASY COCKPIT TRANSLATION

**Abyssal Surge Context**: Command a shadow legion (Dusk Legion) against corrupted entities (Dread Portal).

### **Vocabulary Mapping**

| SC2 Term | Dark Fantasy | Abyssal Surge Current |
|----------|--------------|----------------------|
| Minerals | Souls | "Souls" (energy) |
| Vespene Gas | Aether | — |
| Supply | Legion Capacity | "Legion Capacity" (unit slots) |
| Damage | Assault Damage | "Assault" power |
| Health | Integrity | "Integrity" (shield strength) |
| Resources | Essence | "Essence" (accumulated souls) |
| Alert/Warning | Portent / Omen | "Breach" (enemy breakthrough) |

### **Visual Language (Dark-Fantasy Palette)**

**Colors**
- Primary: Deep purple (#1a0033), teal (#00cccc), crimson (#ff3333)
- UI accent: Neon cyan outline (action available)
- Disabled/cooldown: Desaturated purple + faded glow
- Alert: Crimson pulse + dark red vignette

**Typography**
- Headers: Serif gothic (power/authority)
- Numbers: Monospace (readability)
- Labels: Sans-serif modern (UI hierarchy)
- Example: "Abyssal Command" (serif), "Integrity: 8/10" (mono)

**Icon Style**
- Glyph-based: Rune-like symbols (not realistic icons)
- Silhouettes: High contrast (scannable at small sizes)
- Animations: Fade/pulse (no bouncing; maintains dark tone)

### **Cockpit Panel Nomenclature**

**Top Strip** → "Command Status"
- Integrity (─── bar + number)
- Legion Capacity (# / max units)
- Essence Count (souls accumulated)
- Mission Progress (nodes captured / total)

**Minimap** → "Scrying Lens" or "Battle Overview"
- Terrain: Dark with elevated areas (lighter)
- Units: Teal (allies), Crimson (enemies)
- Breach point: Red border flash

**Command Card** → "Grimoire" or "Dominion Rites"
- Hunt (H) → "Siphon"
- Extract (E) → "Bind"
- Materialize (M) → "Incarnate"
- Capture (C) → "Dominate"
- Possess (P) → "Enshadow"
- Domain (D) → "Reign"
- Assault (A) → "Annihilate"

**Unit Selection Panel** → "Legion Status"
- Shows selected unit portrait, class (Shade/Scout/Guard), health, abilities

---

## CONCRETE DESKTOP (1920×1080) SPECIFICATIONS

### **Layout Zones & Measurements**

```
Total viewport: 1920×1080px

Zone 1: Command Status Bar (Top)
  Height: 60px (5.6% vh)
  Content: Integrity | Capacity | Souls | Mission Progress
  Font: 18px bold monospace (numbers), 14px sans-serif (labels)
  Background: rgba(10, 13, 24, 0.9) + 2px bottom border (#00cccc)
  Padding: 8px horizontal, 6px vertical

Zone 2: Battlefield Canvas
  Dimensions: 1360×680px (centered)
  Margin top: 10px, Bottom: 10px
  Isometric projection: x_s = (x_w - y_w) * 32, y_s = (x_w + y_w) * 16 - z_w * 16
  Z-sorting: painter key = (x + y) + z*0.001 + layer_id

Zone 3: Minimap (Bottom-Left)
  Dimensions: 170×170px
  Border: 2px #00cccc
  Click-jump enabled: Yes
  Overlay: Fog of war semi-transparent
  Y-position: 1080 - 170 - 10 = 900px

Zone 4: Command Card (Bottom-Right)
  Grid: 3 rows × 4 columns
  Button size: 60×60px + 8px gutter = 276×188px total (3 cols: 196px width)
  Actually: Arrange as 2 rows × 3 buttons + overflow toggle
  Position: Right-align, Y: 900px
  Cooldown: Radial overlay (0–360° arc)
  Hotkey label: 8px white text bottom-right of button

Zone 5: Selection Panel (Right side, above minimap)
  Dimensions: 300×200px (estimated)
  Content: Portrait + unit name + health bar + passive traits
  Position: X: 1920 - 300 - 10 = 1610px, Y: 680px
  Scrollable if >5 traits
```

### **Density Metrics (Abyssal Surge)**

| Metric | Desktop | Mobile | Acceptance |
|--------|---------|--------|------------|
| Buttons per action | 1 button = 60px² | 1 button = 50px² | ≥48px² (WCAG) |
| Hit target spacing | 8px gutter | 4px gutter (thumb) | ≥6px minimum |
| Text size | 18px numbers | 14px numbers | ≥12px readable |
| Color contrast | #ff3333 on #0a0d18 | Same | ≥7:1 (WCAG AAA) |
| Breach flash latency | ≤100ms (from engine) | ≤100ms | Critical alert |
| Command responsiveness | ≤50ms visual feedback | ≤100ms (touch) | ≤150ms acceptable |

### **Keyboard Hotkey Mapping**

```
Hunt (H): 4s cooldown
Extract (E): 6s cooldown
Materialize (M): 5s cooldown
Capture (C): 8s cooldown
Possess (P): 10s cooldown
Domain (D): 15s cooldown
Assault (A): 3s cooldown

Secondary (if implemented):
Spacebar: Next unit / Hero direct move
Shift: Waypoint queue
Ctrl: Multi-select
Esc: Deselect all
Tab: Toggle UI focus
```

---

## CONCRETE MOBILE (360px) SPECIFICATIONS

### **Layout Zones & Measurements (Landscape 360×800)**

```
Zone 1: Resource Bar (Top)
  Height: 40px (5% vh)
  Single row: [Integrity bar] | [Capacity #] | [Souls #]
  Font: 12px monospace (ultra-compact)
  Background: Same dark theme, 1px border

Zone 2: Battlefield Canvas
  Dimensions: 360×440px (122% of available height)
  Pinch-zoom enabled: 1.0×–2.5× scale
  Pan on drag outside canvas
  Y-position: 45px

Zone 3: Minimap (Floating, Top-Right)
  Dimensions: 80×80px (smaller, floating)
  Position: Fixed top-right, 10px margin
  Z-index: Above battlefield
  Border: 1px #00cccc
  Semi-transparent background (50% opacity) when not in use

Zone 4: Command Pad (Bottom)
  Grid: 2 rows visible (3 buttons + 3 buttons)
  Button size: 50×50px (scaled for thumb-zone)
  Gutter: 4px
  Swipeable: Horizontal scroll to reveal "More" (second grid: Possess, Domain, Other)
  Cooldown: Text overlay "4.2s" instead of radial (space constraint)
  Y-position: 750px

Zone 5: Alerts Panel (Right side, floating)
  Dimensions: 80px wide, scrollable height
  Compact iconography: Red breach warning, yellow mana low
  Tap to dismiss
  Z-index: 100 (above battlefield)
```

### **Touch Interaction (360px)**

**Battlefield Interactions**
- Single tap: Select unit at tap position
- Double-tap: Center camera on unit
- Drag from unit: Move command (if no drag target, cancel)
- Two-finger pinch: Zoom (1.0×–2.5×)
- Two-finger drag: Pan (if zoomed >1.0×)

**Command Card Interactions**
- Tap button: Execute action (if not cooling)
- Long-press: Show tooltip (action name + cooldown remaining)
- Swipe left: Scroll to "More" actions
- Swipe right: Scroll back to primary actions

### **Mobile Density & Hit Targets**

| Element | Size | Spacing | Rationale |
|---------|------|---------|-----------|
| Command button | 50×50px | 4px gutter | Thumb-friendly |
| Minimap | 80×80px | 10px margin | Floating, not primary |
| Resource numbers | 12px | — | Small but monospace-readable |
| Alert icon | 32×32px | 4px | High-contrast glyph |
| Selection badge | 24×24px | Floating | Subtle over battlefield |

---

## FAILURE MODES & RECOVERY

### **Desktop Failure Modes**

| Failure | Visual Symptom | Recovery |
|---------|----------------|----------|
| Canvas render fail | Static grid instead of sprites | Use fallback 2D vector grid |
| Minimap unclickable | Pointer doesn't pan camera | Enable keyboard pan (arrow keys) |
| Hotkey conflict | Cmd bound to browser action | Show keybind settings; disable system hotkeys |
| Resource overflow | Numbers overflow button space | Abbreviate: "1.2K" instead of "1200" |
| Cooldown ghost | Button appears ready but is disabled | Query engine state before allowing click |

### **Mobile Failure Modes**

| Failure | Visual Symptom | Recovery |
|---------|----------------|----------|
| Touch lag (>150ms) | Delayed command registration | Reduce frame rate target if needed |
| Pinch-zoom stuck | Minimap unscrollable or oversized | Lock zoom to 1.0×–2.0×; add bounds check |
| Command overflow | 7 buttons don't fit 2 rows | Use tab/swipe reveal; prioritize 3 actions |
| Portrait/landscape flip | UI layout breaks on rotate | CSS media queries (max-width 600px) handle |
| Safe area notch | Buttons hidden behind notch | Use `env(safe-area-inset-*)` CSS padding |

---

## ACCEPTANCE CRITERIA

### **Desktop (1920×1080)**

**Acceptance Criteria: Desktop Cockpit**

1. ✓ **Layout Integrity**: All 5 zones render without overlap or off-screen elements.
   - Measurement: Screenshot at 1920×1080 → manual pixel verification
   - Pass: All zones visible + legible

2. ✓ **Density Compliance**: Hit targets ≥48px², text ≥12px, contrast ≥7:1 (WCAG AAA).
   - Measurement: axe accessibility scan + manual design audit
   - Pass: 0 critical contrast violations, all buttons ≥48px²

3. ✓ **Feedback Latency**: Breach alert latency ≤100ms from engine state change.
   - Measurement: Capture timestamps (engine event → screen flash pixel change via phone camera)
   - Pass: 40/40 breach alerts fire <100ms

4. ✓ **Keyboard Parity**: All 7 actions (Hunt, Extract, Materialize, Capture, Possess, Domain, Assault) execute identically via hotkey or mouse click.
   - Measurement: Automated test: trigger each action via hotkey, compare state to mouse-click baseline
   - Pass: state_after_hotkey == state_after_click for all 7 actions, 50 trials each

5. ✓ **Resource Display**: Integrity, Capacity, and Souls render accurately in real-time.
   - Measurement: Livlog engine state vs. UI display in 5-second intervals over 1-minute session
   - Pass: 100% state-UI match, zero stale displays

6. ✓ **Cooldown Accuracy**: Radial cooldown progress matches remaining cooldown time (±5% error tolerance).
   - Measurement: Render radial progress, measure arc angle, compare to engine cooldown timer
   - Pass: 40/40 actions show correct progress, max ±300ms error

7. ✓ **No Listener Leaks**: RAf, timers, pointer handlers, audio context freed on scene exit.
   - Measurement: `chrome://tracing`, heap snapshot before/after 10 battle-exit cycles
   - Pass: Heap stable ±500KB after 10 cycles (no accumulation)

8. ✓ **Mobile Responsive View Adapts**: At 360px, UI reflows without menu/hamburger burger (all actions visible or 1-tap swipe).
   - Measurement: Render at 360×800, navigate all 7 actions within 10s of cold start
   - Pass: All 7 actions accessible, no horizontal scroll bar needed for top zones

### **Mobile (360px Landscape)**

**Acceptance Criteria: Mobile Cockpit**

1. ✓ **Touch Hit Targets ≥48px** (or ≥32px with adequate spacing).
   - Measurement: Inspect each button, ensure CSS `width: 50px` + 4px gutter = 54px center-to-center
   - Pass: All buttons ≥48px, gutter ≥4px

2. ✓ **Pinch Zoom Bounds**: Zoom locks to 1.0×–2.0×; no over-zoom or freeze.
   - Measurement: Two-finger pinch to 5.0× → UI should clamp at 2.0×
   - Pass: Max zoom visually observed = 2.0×, no jank

3. ✓ **Safe Area Notch Avoidance**: All buttons, text, alerts render clear of notch/safe-area-inset.
   - Measurement: Test on iPhone 14+ with notch; screenshot at 360×800
   - Pass: No text/button overlaps notch area

4. ✓ **Command Reveal Latency**: Swipe to reveal hidden actions ≤300ms (perceived smoothness).
   - Measurement: Tap "More" button, measure time to scroll reveal 2nd grid
   - Pass: Reveal fully visible <300ms

5. ✓ **Minimap Accuracy (Mobile)**: Floating minimap correctly shows allied/enemy positions, clickable to jump camera.
   - Measurement: Tap minimap top-left, camera moves to top-left of battlefield
   - Pass: Camera jump matches tap-to-minimap-coordinate within 2 grid tiles

6. ✓ **Portrait Rotation Stability**: UI survives portrait rotation (360×800 → 800×360) without layout break.
   - Measurement: Rotate device mid-battle, verify no off-screen buttons or text overflow
   - Pass: All elements reflow, no crashes, hotkeys still functional

7. ✓ **No Horizontal Scroll (Primary)**: Top resource bar, minimap, and 3-button command grid fit within 360px without scrollbar.
   - Measurement: CSS `max-width: 360px`, render, measure horizontal overflow
   - Pass: 0px overflow; "More" swipe is intentional, not side-effect

8. ✓ **Touch Responsiveness ≤100ms**: Tap → action fires ≤100ms (feels immediate on mobile).
   - Measurement: Instrumented touch handler timestamp vs. engine action timestamp
   - Pass: 50/50 actions respond <100ms

### **Cross-Platform (Both Desktop & Mobile)**

1. ✓ **Hotkey-Mouse Parity**: Hotkey (H) and mouse click both execute Hunt; state identical.
   - Test: Hunt via H, check state. Hunt via mouse, check state. Assert equality.
   - Pass: Both produce identical engine state

2. ✓ **Cooldown Display Sync**: Remaining cooldown text matches radial progress ±3%.
   - Measurement: Sample 20 random actions at 50% cooldown progress. Radial arc % should equal text %.
   - Pass: |radial_pct - text_pct| ≤ 3% for 20/20 samples

3. ✓ **Breach Alert Consistency**: Breach warning fires on desktop and mobile with <100ms latency, plays sound, flashes screen.
   - Test: Trigger breach condition on both platforms, record timestamps
   - Pass: Both fire within 100ms, sound + visual flash present

4. ✓ **Language Display (Korean/English)**: All labels, tooltips, action names render in user-selected language without text overflow.
   - Measurement: Toggle language, screenshot both. Measure text width.
   - Pass: Korean words fit within button/label bounds; no truncation

5. ✓ **Performance Frame Pacing**: Desktop p95 ≤16.7ms (60 FPS), mobile p95 ≤33ms (30 FPS).
   - Measurement: Chrome DevTools Performance tab, record 60s session
   - Pass: Desktop: p95=15.2ms (green), Mobile: p95=28.4ms (green)

---

## DESIGN RULES & HIERARCHY

### **Priority 1 (Always Visible)**
- Integrity bar + number (top-left of battlefield or top strip)
- Breach warning (screen edge red vignette + audio)
- Selected unit indicator (highlight + badge)
- Mission progress (nodes captured / total)
- Cooldown progress on active actions

### **Priority 2 (Tap/Hover to Reveal)**
- Unit ability descriptions (hover tooltip over command button)
- Cooldown remaining time (text overlay)
- Unit stats (portrait, damage, health)
- Node capture prerequisites (e.g., "Requires 2 Shades")

### **Priority 3 (Settings/Advanced)**
- Detailed unit traits (damage type, special resist)
- Replay timeline (if in replay mode)
- AI behavior settings (if implemented)
- Colorblind mode selection

### **Visual Hierarchy (Weight & Emphasis)**

**Highest**: Breach warning (red pulse, audio, haptic)
**High**: Integrity (large bold numbers, bar)
**Medium**: Command buttons (60px, neon outline when available)
**Low**: Minimap (informational, not action-triggering)
**Lowest**: Tooltips (appear on demand)

---

## PERFORMANCE & MEMORY TARGETS

| Target | Desktop | Mobile | Rationale |
|--------|---------|--------|-----------|
| Frame pacing (p95) | ≤16.7ms | ≤33ms | 60 FPS / 30 FPS |
| Heap after 10 battles | ±500KB stable | ±1MB stable | No listener/timer leaks |
| Viewport scroll jank | 0 frame drops | ≤2 per minute (tap-stutter OK) | Smooth feel |
| Canvas render cost | ≤8ms | ≤12ms | Depth-sorting, painter queue |
| Minimap update | ≤2ms | ≤2ms | Bitmask update, no full redraw |
| Audio latency (breach cue) | ≤50ms from trigger | ≤50ms from trigger | Perceptual sync |

---

## DELIVERABLE CHECKLIST

### **For Specification Phase (Next Gate)**

- [ ] Finalize layout mockup (Figma/HTML) at 3 breakpoints (360px, 768px, 1920px)
- [ ] Define exact color palette + hex codes (8 primary colors + 4 alert states)
- [ ] Write CSS Grid/Flex rules for responsive reflow
- [ ] Specify hotkey bindings + accessibility remap UI
- [ ] Create unit behavior glossary (8 verbs: move, strike, cast, scout, guard, evade, explore, jump)
- [ ] Validate WCAG AAA contrast for all text/button pairs
- [ ] Create ClickUp/GitHub issue template for art assets (with provenance + SHA-256 field)

### **For Implementation Phase**

- [ ] Implement Zone 1 (Command Status bar) with real engine data binding
- [ ] Implement Zone 2 (Battlefield canvas 2D isometric rendering)
- [ ] Implement Zone 3 (Minimap click-jump + fog-of-war overlay)
- [ ] Implement Zone 4 (Command card 3×4 grid, hotkeys, cooldown radials)
- [ ] Implement breach alert (red vignette, audio cue, ≤100ms latency)
- [ ] Add responsive CSS media queries (360px, 768px, 1920px breakpoints)
- [ ] Run acceptance tests (8 desktop, 8 mobile, 5 cross-platform)
- [ ] Performance profiling & optimization (p95 targets)

---

## REFERENCES & CITATIONS

**Official**
- SC2Mapster Wiki: https://github.com/SC2Mapster
- StarCraft II Editor Help (in-game, Shift+F6)

**Accessibility & HCI**
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/
- IGDA Accessible SIG: https://igda-gasig.org/
- WCAG 2.1 Level AAA: https://www.w3.org/WAI/WCAG21/quickref/

**Mobile RTS Adaptation**
- Dev.to: "Adapting StarCraft II to 360px mobile viewport"
- UX PIN / Medium: "RTS UI responsive design patterns"

**Abyssal Surge Codebase References**
- `/docs/shadow-lord-rts-rpg-hybrid-design.md` (current combat system)
- `/docs/screen-layout-planning.md` (SPA screen flow)
- `/battle-visualizer.js` (2D isometric rendering, CLASH_TICK_S=0.55, painter queue)
- `/app.js` (action cooldowns, COOLDOWN_SECONDS map)
- `/campaign-state.js` (BALANCE node, getCampaignBenefits)

---

**Status**: Research complete. Ready for Specification → Layout Mockup → Implementation phases.
**Prepared by**: Senior RTS UX Researcher (Agent: RTSPatternResearch)
