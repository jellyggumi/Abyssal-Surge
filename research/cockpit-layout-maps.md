# Abyssal Surge Battle Cockpit — Layout Maps & Wireframes

## DESKTOP (1920×1080) DETAILED LAYOUT

### **Full-Screen Wireframe**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  ZONE 1: COMMAND STATUS BAR (60px height)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ▌███████▌ INT 8/10  │ CAP 6/10 │ SOULS 42 │ NODES: ▌2/3           ││
│  │ 14px bold │ 18px mono │ 18px mono  │ 18px mono │ 14px label        ││
│  │ Dark bg + 2px cyan border (top-left aligned, left: 8px)             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ZONE 2: BATTLEFIELD CANVAS (1360×680px, centered)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                       ││
│  │  2.5D Isometric Battlefield                                          ││
│  │  [Dusk Portal - Left]  ←→ [Units clash] ←→ [Dread Portal - Right] ││
│  │                                                                       ││
│  │  Depth-sorted painter queue:                                         ││
│  │  Ground < Raised terrain < Units < Particles < Alerts               ││
│  │                                                                       ││
│  │  Minimap overlay (top-right, semi-transparent): 80×80px             ││
│  │  Camera pan: WASD or drag                                           ││
│  │  Zoom: Mouse wheel (1.0× default)                                   ││
│  │                                                                       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌────────────────────────┬───────────────────────────────────────────┐ │
│  │ ZONE 3: MINIMAP         │ ZONE 5: SELECTION PANEL (300×200px)      │ │
│  │ (170×170px)             │ ┌─────────────────────────────────────┐ │ │
│  │ ┌─────────────────────┐ │ │ [UNIT PORTRAIT 80×80px]             │ │ │
│  │ │                     │ │ │ Shade — Class: Defender             │ │ │
│  │ │  [Fog of War]       │ │ │ HP: ███████░ 7/8                     │ │ │
│  │ │                     │ │ │ ─────────────────────────────────────│ │ │
│  │ │  ● Allies (Teal)    │ │ │ ABILITIES:                          │ │ │
│  │ │  ✦ Enemies (Red)    │ │ │ ☆ Evade (cooldown: 2.3s)           │ │ │
│  │ │  ■ Nodes (Gold)     │ │ │ ☆ Guard (cooldown: ready)          │ │ │
│  │ │                     │ │ │ [More abilities...]                 │ │ │
│  │ └─────────────────────┘ │ └─────────────────────────────────────┘ │ │
│  │ Y-Click: Jump camera    │                                           │ │
│  │ Breach warning: Red border flash                                    │ │
│  └────────────────────────┴───────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ZONE 4: COMMAND CARD GRIMOIRE (276×188px, bottom-right)             │ │
│  │ ┌──────────────────────────────────────────────────────────────┐   │ │
│  │ │  [H]          [E]          [M]          [C]                 │   │ │
│  │ │ HUNT        EXTRACT     INCARNATE    DOMINATE              │   │ │
│  │ │ 4.0s                                                        │   │ │
│  │ │  ◯ ─────────  (radial CD progress)                         │   │ │
│  │ │                                                              │   │ │
│  │ │  [P]          [D]          [A]          [▼]                │   │ │
│  │ │ ENSHADOW    REIGN      ANNIHILATE    MORE                  │   │ │
│  │ │ 10.0s       15.0s       3.0s                               │   │ │
│  │ │  ●────      ●──────────  ◯                                 │   │ │
│  │ │                                                              │   │ │
│  │ └──────────────────────────────────────────────────────────────┘   │ │
│  │                                                                       │ │
│  │  [Cooldown legend]: ◯ Ready | ●── Cooling | ─── Ready             │ │
│  │  Keyboard: H E M C P D A (remappable in settings)                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

KEY PIXEL MEASUREMENTS:
═════════════════════════════════════════════════════════════════════════
Zone 1 (Command Status):
  - Height: 60px
  - Integrity bar width: 120px
  - Font: 18px bold monospace (numbers), 14px sans-serif (labels)
  - Padding: 8px horizontal, 6px vertical

Zone 2 (Battlefield):
  - Width × Height: 1360×680px
  - Margin top: 10px, bottom: 10px
  - Left offset: (1920 - 1360) / 2 = 280px

Zone 3 (Minimap):
  - Width × Height: 170×170px
  - X-position: 10px
  - Y-position: 1080 - 170 - 10 = 900px
  - Border: 2px #00cccc

Zone 4 (Command Card):
  - Grid: 2 rows × 3 buttons (visible) + [More] toggle
  - Button size: 60×60px
  - Gutter: 8px
  - Total width: (60 × 3) + (8 × 2) = 196px
  - X-position (right-aligned): 1920 - 196 - 10 = 1714px
  - Y-position: 900px

Zone 5 (Selection Panel):
  - Width × Height: 300×200px (flexible)
  - X-position: 1920 - 300 - 10 = 1610px
  - Y-position: 680px
  - Scrollable if content exceeds 200px
```

---

## MOBILE (360×800 LANDSCAPE) DETAILED LAYOUT

### **Full-Screen Wireframe**

```
┌──────────────────────────────────────────┐
│                                          │
│ ZONE 1: RESOURCE BAR (40px height)      │
│ ┌──────────────────────────────────────┐│
│ │ ▌██░ 8/10 │ 6/10 │ 42 │ ▌2/3         ││
│ │ INT  CAP  SOULS NODES (ultra-compact)││
│ │ 12px monospace, 1px border            ││
│ └──────────────────────────────────────┘│
│                                          │
│ ZONE 2: BATTLEFIELD CANVAS (360×440px)  │
│ ┌──────────────────────────────────────┐│
│ │                                      ││
│ │  Isometric Battlefield               ││
│ │  [Allies ←→ Combat ←→ Boss]         ││
│ │  Pinch-zoom: 1.0× – 2.0×            ││
│ │  Pan on drag (if zoomed)            ││
│ │                                      ││
│ │  [Floating Minimap 80×80 (top-r)]  ││
│ │  [Alerts panel (right edge, icon)]  ││
│ │                                      ││
│ └──────────────────────────────────────┘│
│                                          │
│ ZONE 3B: FLOATING MINIMAP (80×80px)     │
│ ┌────────────────┐                      │
│ │ [Fog of War]   │ (Top-right, Z: 100) │
│ │ ● Teal ✦ Red   │ (Fixed position)     │
│ │ Click: Jump    │                      │
│ └────────────────┘                      │
│                                          │
│ ZONE 3C: ALERTS (Right edge, 60px wide) │
│ │ 🔴 Breach!     │ (Tap to dismiss)     │
│ │ 🟡 Low Souls   │                      │
│ │                                       │
│                                          │
│ ZONE 4: COMMAND PAD (320×120px, bottom) │
│ ┌──────────────────────────────────────┐│
│ │ [H]  [E]  [M]  [C]  [P]  [D]  [A]   ││
│ │ 50×50px buttons, 4px gutter          ││
│ │ [HUNT][EXTRACT][INCARNATE]           ││
│ │ 4.2s  ready    5.0s  ◀ ▶ [MORE...]  ││
│ │                                       ││
│ │ [DOMINATE][ENSHADOW][REIGN][MORE]   ││
│ │ 8.0s      10.0s     15.0s            ││
│ │                                       ││
│ │ [ANNIHILATE]                         ││
│ │ 3.0s ready                           ││
│ └──────────────────────────────────────┘│
│                                          │
│ CONTROLS:                                │
│ Tap: Select/Action                      │
│ Double-tap: Center camera               │
│ Pinch: Zoom (1.0× – 2.0×)              │
│ Swipe H: Reveal more actions            │
│                                          │
└──────────────────────────────────────────┘

KEY PIXEL MEASUREMENTS:
═════════════════════════════════════════════════════════════════════════
Zone 1 (Resource Bar):
  - Height: 40px
  - Font: 12px monospace
  - Padding: 4px horizontal, 3px vertical

Zone 2 (Battlefield):
  - Width × Height: 360×440px
  - Y-position: 45px
  - Pinch zoom: 1.0× – 2.0× (clamped)

Zone 3B (Floating Minimap):
  - Width × Height: 80×80px
  - Position: Fixed top-right, 10px margin
  - Z-index: 100 (above canvas)

Zone 3C (Alerts):
  - Width: 60px
  - Position: Fixed right edge, 50% of canvas height
  - Z-index: 100
  - Icon size: 32×32px

Zone 4 (Command Pad):
  - Grid: 2 rows visible (3 buttons each) + swipeable 2nd row
  - Button size: 50×50px
  - Gutter: 4px (inter-button)
  - Total width: (50 × 3) + (4 × 2) = 158px
  - Height per row: 50 + 10 (label) + 4 (gutter) = 64px
  - Y-position: 800 - 120 = 680px

Safe Area Insets (iPhone 14+ notch):
  - env(safe-area-inset-top): Apply to Zone 1
  - env(safe-area-inset-right): Apply to Alerts
  - No bottom notch issues (landscape)
  - CSS padding: `padding-top: max(8px, env(safe-area-inset-top))`
```

---

## COMMAND CARD BUTTON LAYOUT

### **Desktop: 3×4 Grid (196×188px)**

```
┌────────┬────────┬────────┬────────┐
│ [H]    │ [E]    │ [M]    │ [C]    │
│ HUNT   │ EXTRACT│ INCAR. │ DOMIN. │
│ 4.0s   │ ready  │ 5.0s   │ 8.0s   │
├────────┼────────┼────────┼────────┤
│ [P]    │ [D]    │ [A]    │ [▼]    │
│ ENSHADOW│ REIGN │ ANNIHILATE│MORE  │
│ 10.0s  │ 15.0s  │ 3.0s   │ expand │
└────────┴────────┴────────┴────────┘

Button spec:
- 60×60px each
- 8px gutter
- Rounded corners: 4px
- Border: 2px #00cccc (ready), 1px #333 (cooling)
- Background: rgba(10, 13, 24, 0.95)
- Font: 12px sans-serif (action name), 10px monospace (cooldown)
- Radial cooldown indicator: Center, 50px radius, 2px arc width
```

### **Mobile: 2×3 Grid (158×120px) with Swipe-Reveal**

```
Primary Grid (visible on load):
┌──────┬──────┬──────┐
│ [H]  │ [E]  │ [M]  │ → Swipe ▶
│ HUNT │ EXTR │ INCAR│
│ 4.2s │ RDY  │ 5.0s │
├──────┼──────┼──────┤
│ [C]  │ [P]  │ [D]  │
│ DOMIN│ ENSHA│ REIGN│
│ 8.0s │ 10.0s│ 15.0s│
└──────┴──────┴──────┘

Secondary Grid (after ▶ swipe):
┌──────┬──────┬──────┐
│ [A]  │ [MORE]  [...] │ ← Swipe ◀
│ANNIHIL│SETTINGS│    │
│ 3.0s │      │    │
├──────┼──────┼──────┤
│      │      │      │
│   (Empty for spacing)  │
└──────┴──────┴──────┘

Button spec:
- 50×50px each
- 4px gutter
- Rounded corners: 3px
- Border: 2px #00cccc (ready), 1px #333 (cooling)
- Font: 10px sans-serif (truncated action name), 8px monospace (cooldown)
- Cooldown display: Text overlay (e.g., "4.2s") instead of radial
```

---

## ALERT STATES & VISUAL FEEDBACK

### **Breach Alert (Priority 1)**

```
VISUAL:
  Screen edges: Red vignette (8px inset), pulse effect (0.5s fade in/out)
  Minimap: Border flash red 2px (4 cycles, 200ms each)
  Integrity bar: Color shift to #ff3333 (red)
  
AUDIO:
  Cue: 800Hz alarm tone (200ms duration)
  Volume: ≥80dB equivalent
  
TIMING:
  From engine breach event → vignette render: ≤100ms
  
RECOVERY:
  Manual: Click screen to dismiss (or proceed)
  Auto: Fade out 500ms after breach event
```

### **Cooldown Ready (Priority 2)**

```
VISUAL:
  Button border: Glow effect (#00cccc, 0.2s pulse)
  Text: Becomes white/bright (was dim gray during cooldown)
  Icon: Brightness increase
  
AUDIO:
  Cue: Soft chime (200Hz, 150ms duration)
  Volume: ≤60dB equivalent
  
TIMING:
  From cooldown expiry → visual change: <50ms
```

### **Low Resources (Priority 3)**

```
VISUAL (Souls < 5):
  Resource number: Yellow text (#ffff00)
  Bar background: Subtle orange flash (200ms)
  
AUDIO:
  Cue: Warning beep (600Hz, 100ms duration)
  Volume: ≤70dB equivalent
  
VISUAL (Integrity < 3):
  Integrity bar: Red (#ff3333)
  HUD numbers: Red flash (100ms cycle)
  
AUDIO:
  Cue: Urgent alarm (900Hz, 150ms duration)
  Volume: ≥75dB equivalent
```

---

## RESPONSIVE BREAKPOINTS & MEDIA QUERIES

### **Breakpoint 1: 360px (Mobile Portrait/Landscape)**
```css
@media (max-width: 600px) {
  /* All zones reflow to single column or overlay */
  
  /* Zone 1: Compressed to 1-line resource row */
  #command-status { height: 40px; }
  
  /* Zone 2: Full width, height: calc(100vh - 120px) */
  #battlefield-canvas { width: 100%; height: calc(100vh - 120px); }
  
  /* Zone 4: Bottom sheet, swipeable command grid */
  #command-pad { position: absolute; bottom: 0; width: 100%; }
  
  /* Minimap: Floating, not docked */
  #minimap { position: fixed; top: 50px; right: 10px; width: 80px; height: 80px; }
  
  /* Selection panel: Slide-in drawer (not persistent) */
  #selection-panel { position: fixed; right: -300px; transition: right 0.3s; }
  
  /* Safe area support */
  padding-top: max(8px, env(safe-area-inset-top));
  padding-right: max(8px, env(safe-area-inset-right));
}
```

### **Breakpoint 2: 768px (Tablet Landscape)**
```css
@media (min-width: 601px) and (max-width: 1200px) {
  /* Dual-pane layout: Battlefield left, command panel right */
  
  /* Zone 2: 60% width */
  #battlefield-canvas { width: 60%; }
  
  /* Zone 4 + Zone 5: 40% right sidebar */
  #sidebar { width: 40%; }
  #selection-panel { display: block; }
  #command-pad { display: block; }
  
  /* Minimap: Docked to sidebar, not floating */
  #minimap { position: relative; width: 100px; height: 100px; }
  
  /* Command grid: 2×3 expanded to fit sidebar */
  #command-pad { grid-template-columns: repeat(3, 1fr); }
}
```

### **Breakpoint 3: 1920px (Desktop)**
```css
@media (min-width: 1201px) {
  /* Full traditional layout with all zones docked */
  
  /* Zone 1: Top bar spanning full width */
  #command-status { width: 100%; height: 60px; }
  
  /* Zone 2: Centered battlefield */
  #battlefield-canvas { width: 1360px; height: 680px; margin: 10px auto; }
  
  /* Zone 3 + Zone 5: Bottom row layout */
  #bottom-layout { display: flex; gap: 10px; }
  #minimap { width: 170px; height: 170px; }
  #selection-panel { width: 300px; max-height: 200px; overflow-y: auto; }
  
  /* Zone 4: Right-aligned command card */
  #command-pad { position: absolute; bottom: 10px; right: 10px; }
}
```

---

## EXAMPLE: ACTION FLOW (Desktop → Mobile)

### **Scenario: Player executes "Hunt" action**

**Desktop Flow:**
```
1. Click [H] button (60×60px, bottom-right) OR Press H key
   └─ Visual: Button outline flashes cyan, label brightens
   └─ Audio: Soft "click" sound

2. Engine processes Hunt action
   └─ Internal state updates (souls +2)

3. Cooldown starts: 4.0s
   └─ Visual: Radial progress arc appears, text "4.0s" → "3.9s" → ...
   └─ Button border dims to #555

4. After 4.0s:
   └─ Visual: Radial arc completes, border brightens to #00cccc
   └─ Audio: Soft chime (200Hz, 150ms)
   └─ Button ready for re-activation
```

**Mobile Flow:**
```
1. Tap [H] button (50×50px, primary grid) OR Press H key
   └─ Visual: Button background pulse (200ms), border glow
   └─ Audio: Soft "tap" sound (haptic feedback if available)

2. Engine processes Hunt action
   └─ Internal state updates (souls +2)

3. Cooldown starts: 4.0s
   └─ Visual: Text overlay "4.0s" → "3.9s" → ...
   └─ Button border dims to #555 (no radial arc due to space)

4. After 4.0s:
   └─ Visual: Text turns white, border brightens to #00cccc
   └─ Audio: Soft chime
   └─ Button ready for re-activation
```

---

## COLOR PALETTE REFERENCE

**Primary Colors**
- Dark background: #0a0d18 (near-black, RGB 10, 13, 24)
- Neon cyan (ready): #00cccc (RGB 0, 204, 204)
- Crimsoon (alert): #ff3333 (RGB 255, 51, 51)
- Gold (nodes): #ffcc00 (RGB 255, 204, 0)

**Text Colors**
- Primary: #ffffff (white)
- Secondary: #cccccc (light gray)
- Muted: #666666 (dark gray, for disabled/cooling)
- Alert: #ff7f79 (coral red, for low resources)

**Background Overlays**
- Command panel bg: rgba(10, 13, 24, 0.95) (mostly opaque)
- Tooltip bg: rgba(10, 13, 24, 0.85) (translucent)
- Breach vignette: rgba(255, 51, 51, 0.3) (red pulse)
- Minimap fog: rgba(0, 0, 0, 0.6) (dark semi-transparent)

---

**Layout maps complete. Ready for CSS/React implementation.**
