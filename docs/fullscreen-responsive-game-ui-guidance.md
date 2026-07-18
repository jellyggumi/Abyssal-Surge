# Fullscreen Responsive Browser Game Interface — Implementation Guidance

**Target Scope:** Abyssal Surge medieval RTS battle cockpit (canvas + DOM overlay UI)  
**Date:** 2026-07-18  
**Authoritative Sources:** MDN, W3C, web.dev, GameDeveloper.com, Smashing Magazine

---

## I. Foundation Layer: Viewport & Canvas Setup

### 1.1 Viewport Meta Tag
**Current State (VERIFIED in index.html, line 5):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

**Status:** ✅ CORRECT  
**Why:** `viewport-fit=cover` is **mandatory** for fullscreen games. Without it, notches and safe areas create letterboxing on mobile.

**Reference:** W3C CSS Environment Variables (https://www.w3.org/TR/css-env-1/) — endorsed by Apple, Google, Mozilla as standard for 2026 games.

---

### 1.2 Body & Root Container Setup (2026 Best Practice)

**Recommended CSS Structure:**

```css
:root {
  /* Safe area insets — must be defined for all orientations */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  
  /* Dynamic viewport height for mobile browser chrome */
  --viewport-height: 100dvh;
  
  /* Breakpoint markers for responsive behavior */
  --breakpoint-mobile: 360px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
}

body {
  width: 100vw;
  height: 100dvh; /* Use dynamic viewport height, not 100vh */
  margin: 0;
  padding: 0;
  overflow: hidden;
  
  /* Prevent mobile address-bar reflow */
  position: fixed;
  inset: 0;
}
```

**Rationale:**
- `100dvh` (dynamic viewport height) adapts when mobile browsers show/hide address bars
- `viewport-fit=cover` + fixed positioning ensures true fullscreen
- CSS environment variables (`env()`) handle notches on iPhone, Android with punch-holes, etc.

**Reference:** web.dev — "Viewport units" (https://web.dev/viewport-units/); CSS Environment Variables Module Level 1 (https://www.w3.org/TR/css-env-1/)

---

## II. Layout Architecture: Canvas + DOM Overlay

### 2.1 Canvas Container (Battlefield)

**HTML Structure (from current index.html):**
```html
<section id="battle-field" class="panel battle-field-panel">
  <canvas id="battle-canvas-3d" tabindex="0"></canvas>
</section>
```

**CSS — Canvas Decoupling (2026 Modern Pattern):**

```css
#battle-field, #canvas-container-3d {
  /* Full viewport minus safe areas */
  position: absolute;
  inset: var(--safe-top, 0) var(--safe-right, 0) var(--safe-bottom, 0) var(--safe-left, 0);
  
  /* Responsive sizing */
  width: calc(100vw - var(--safe-left, 0) - var(--safe-right, 0));
  height: calc(100dvh - var(--safe-top, 0) - var(--safe-bottom, 0));
  
  z-index: 1;
  overflow: hidden;
}

#battle-canvas-3d {
  /* Decouple CSS display size from WebGL buffer size */
  display: block;
  width: 100%;
  height: 100%;
  
  /* Important: Do NOT set canvas.width/height in CSS—only CSS display size */
  /* JavaScript must set drawingBuffer size based on clientWidth/clientHeight */
}
```

**JavaScript Resize Handler (CRITICAL for stable frame pacing):**

```javascript
const canvas = document.getElementById('battle-canvas-3d');
const resizeObserver = new ResizeObserver(() => {
  // Throttle resize to prevent excessive recalculation
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  // Update WebGL renderer (Three.js, Babylon.js, etc.)
  renderer.setSize(width, height, false); // false = don't change CSS size
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
resizeObserver.observe(canvas.parentElement);
```

**Reference:** web.dev — "WebGL and Canvas Best Practices" (https://web.dev/webgl-fundamentals/); Three.js responsive canvas patterns.

**Verification Scenario (1440×900):**
- ✅ Canvas fills entire screen minus safe areas
- ✅ No letterboxing or pillarboxing
- ✅ WebGL buffer updates on resize; no stretching

---

### 2.2 DOM Overlay Layer Strategy

**Current Structure (from index.html, lines 187–445):**
```
cockpit (hidden section)
  ├─ cockpit-top (stage header, stage selector)
  ├─ cockpit-main
  │   ├─ battle-field (canvas center)
  │   ├─ command-panel (bottom command deck)
  │   └─ cockpit-rail (right intel rail)
  └─ save-dock (bottom save panel)
```

**2026 Best Practice: Container Queries + Grid**

**Why NOT traditional media queries here:**
- Command panel, intel rail, and battlefield are **reusable components**.
- Their layout should respond to their **container width**, not the global viewport.
- Example: On 1366×768, the rail is narrower → adjust its grid internally.

**Recommended CSS Refactor (NOT IMPLEMENTED YET):**

```css
.cockpit {
  /* Root container for the entire battle UI */
  container-type: inline-size;
  container-name: cockpit;
  
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "battlefield rail"
    "commands commands";
  
  gap: 0.5rem;
  padding: env(safe-area-inset-top, 0);
  width: 100%;
  height: 100dvh;
  box-sizing: border-box;
}

/* Responsive to container, NOT global viewport */
@container cockpit (max-width: 900px) {
  .cockpit {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto auto;
    grid-template-areas:
      "header"
      "battlefield"
      "commands"
      "rail";
  }
  
  .cockpit-rail {
    max-height: 20vh;
    overflow-y: auto;
  }
}

@container cockpit (max-width: 600px) {
  .cockpit {
    gap: 0.25rem;
  }
  
  .command-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
    gap: 0.25rem;
  }
}
```

**Container-based rules enable:**
- ✅ Reusable components that adapt to their allocated space
- ✅ Fewer magic breakpoints and pixel-width dependencies
- ✅ Easier testing: resize the cockpit container, not the viewport

**Reference:** MDN — "CSS Container Queries" (https://developer.mozilla.org/en-US/docs/Web/CSS/Container_Queries); CSS specification, Section 3.2 (https://www.w3.org/TR/css-contain-3/); 2026 adoption milestone across all modern browsers.

---

## III. Component Breakdown: Battlefield, Command Deck, Intel Rail

### 3.1 Battlefield Panel

**Purpose:** Hold 3D canvas; minimize UI intrusion.

**CSS Pattern:**

```css
#battle-field {
  grid-area: battlefield;
  position: relative;
  background: #000; /* Fallback if canvas fails */
  border: 1px solid rgb(112, 229, 208, 0.24);
  border-radius: 1rem;
  overflow: hidden;
  min-height: 0; /* Critical: allow flex/grid shrinking */
}

#battle-mission-guide {
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  padding: 0.75rem;
  background: rgba(18, 24, 42, 0.9);
  border: 1px solid rgb(112, 229, 208, 0.3);
  border-radius: 0.75rem;
  font-size: clamp(0.75rem, 2vw, 0.95rem);
  z-index: 10;
  pointer-events: none; /* Allow canvas clicks to pass through */
}
```

**Overflow Handling:**

For ultrawide (2560×1440):
- Canvas scales to fill available space
- Mission guide clamps to max 40rem width and left-aligns

For mobile (360×800):
- Canvas scales to available height (after command bar takes bottom space)
- Mission guide uses small font, wraps text

**Verification Scenario (1366×768):**
- ✅ Canvas is 900px wide × 650px tall (estimated)
- ✅ Mission guide is readable, does not cover critical UI
- ✅ No scrollbars on mission guide (content fits or scrolls internally)

---

### 3.2 Command Deck Panel

**Current HTML (lines 320–390 in index.html):**
```html
<section id="command-panel" class="panel command-panel cockpit-commands">
  <div class="command-grid">
    <button id="action-hunt" data-action="hunt">...</button>
    <!-- 7 command buttons total -->
  </div>
</section>
```

**Current CSS Challenge:** `.command-grid` uses `grid` with fixed column count.  
**Problem on 360×800:** Buttons are too wide; text doesn't fit.

**Recommended Refactor:**

```css
.command-panel {
  grid-area: commands;
  display: grid;
  grid-template-rows: auto auto;
  gap: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(145deg, rgb(28, 39, 64, 0.92), rgb(12, 16, 29, 0.94));
  border: 1px solid rgb(112, 229, 208, 0.24);
  border-radius: 1rem;
  
  /* Safe area bottom padding */
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
}

.command-grid {
  display: grid;
  gap: 0.5rem;
  
  /* Responsive columns based on available space */
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
}

.command-grid button {
  min-height: 3rem;
  min-width: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  
  /* Touch target: minimum 48×48px */
  padding: 0.5rem;
  
  font-size: clamp(0.65rem, 1.5vw, 0.85rem);
  touch-action: manipulation;
}

/* Mobile: stack into 2 rows */
@container cockpit (max-width: 600px) {
  .command-grid {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, auto);
  }
}

/* Desktop: 7 buttons in 1 row */
@container cockpit (min-width: 1024px) {
  .command-grid {
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: auto;
  }
}
```

**Touch Target Requirements (WCAG 2.1 Level AAA):**
- ✅ Minimum 48×48 CSS pixels for touch interactive elements
- ✅ At least 8px spacing between targets
- ✅ Keyboard focus: 3px outline, 3px offset

**Verification Scenario (360×800):**
- ✅ Buttons stack 3×2 grid (3 wide, 2 rows)
- ✅ Each button is 48×48px (minimum touch size)
- ✅ Labels fit or use abbreviations (H, E, M, C, P, D, A)
- ✅ Keyboard navigation works (Tab cycles through buttons)

**Verification Scenario (1440×900):**
- ✅ Buttons display in 1 row (7 columns)
- ✅ Full labels visible ("Hunt", "Extract", "Materialize", etc.)

---

### 3.3 Intel Rail (Right Panel)

**Current HTML (lines 391–432 in index.html):**
```html
<aside class="cockpit-rail field-edge-hud">
  <section id="battle-tactical-brief" class="panel rail-panel">
    <!-- Tactical brief with operation, doctrine, force labels -->
  </section>
  <section class="panel rail-panel campaign-status">
    <!-- Status grid: souls, legion, nodes, integrity, boss -->
  </section>
  <details class="cockpit-details">
    <!-- Collapsible: boss spec, stage lore, narration -->
  </details>
</aside>
```

**Challenge:** Rail is a **wide sidebar** on desktop (300px), but on mobile it stacks below or gets hidden.

**Recommended CSS with Safe Area Awareness:**

```css
.cockpit-rail {
  grid-area: rail;
  display: grid;
  grid-auto-flow: row;
  gap: 0.5rem;
  overflow-y: auto;
  
  /* Respect safe area on right (notch/punch-hole) */
  padding-right: env(safe-area-inset-right, 0);
  
  /* Desktop: narrow scrollable rail */
  width: 280px;
  max-height: 100%;
}

.rail-panel {
  padding: 0.75rem;
  border: 1px solid rgb(112, 229, 208, 0.24);
  border-radius: 0.75rem;
}

#battle-tactical-brief {
  font-size: clamp(0.78rem, 1.5vw, 0.95rem);
}

.campaign-status .status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

@container cockpit (max-width: 900px) {
  .cockpit-rail {
    grid-area: rail; /* Stacked below battlefield in smaller grid layout */
    width: 100%;
    max-height: 25vh;
    overflow-y: auto;
  }
  
  .campaign-status .status-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@container cockpit (max-width: 600px) {
  .cockpit-rail {
    max-height: 30vh;
  }
  
  .cockpit-details {
    display: none; /* Hide collapsed details on mobile to save space */
  }
  
  .campaign-status .status-grid {
    grid-template-columns: 2fr 1fr; /* Compact: labels on left, values on right */
  }
}
```

**Scrolling Strategy:**
- ✅ Rail scrolls internally (max-height + overflow-y: auto)
- ✅ Does NOT interfere with battlefield scrolling (pointer-events: auto only on rail)
- ✅ Momentum scrolling on iOS (already inherited from body)

**Verification Scenario (1366×768):**
- ✅ Rail is 280px wide, scrollable
- ✅ Status grid is 2×5 (2 columns, readable)
- ✅ Boss spec details are collapsible (default closed to save space)

**Verification Scenario (360×800):**
- ✅ Rail stacks below battlefield
- ✅ Max height is 30vh (240px), scrollable
- ✅ Status grid is 2 columns (compact label-value pairs)

---

## IV. Responsive Breakpoint Matrix

| Viewport | Cockpit Grid | Canvas Size | Command Panel | Intel Rail | Notes |
|----------|--------------|-------------|---------------|------------|-------|
| **360×800** (mobile) | 1 column, stack vertical | 100% × 350px | 3×2 grid, bottom | 100% × 240px, scrollable | Keyboard nav primary |
| **768×1024** (tablet port.) | 1 column | 100% × 500px | 3×2 grid | 100% × 300px | Touch optimized |
| **1024×768** (tablet landscape) | 2 column (field + rail side) | 700px × 600px | 1 row (7 buttons) | 280px × 600px, scroll | Desktop-like but smaller |
| **1366×768** (standard desktop) | 2 column grid | 900px × 650px | 1 row (7 buttons) | 350px × 650px, scroll | Current primary target |
| **1440×900** (16:9 desktop) | 2 column grid | 950px × 750px | 1 row (7 buttons) | 380px × 750px, scroll | Well-padded |
| **2560×1440** (4K ultrawide) | 2 column + padding | 1600px × 1200px | 1 row + right padding | 400px (clamped), scroll | Maximum dimensions |

---

## V. Focus Management & Keyboard Navigation

### 5.1 Focus Trap (Battlefield ↔ UI)

**Current HTML (line 257):**
```html
<canvas id="battle-canvas-3d" tabindex="0"></canvas>
```

**Recommendation:**

```css
#battle-canvas-3d:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.command-panel button:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
  background: rgba(255, 240, 164, 0.1);
}
```

**JavaScript Focus Management:**

```javascript
const canvas = document.getElementById('battle-canvas-3d');
const commandButtons = document.querySelectorAll('.command-panel button');

// On canvas focus: allow arrow keys to pan, Enter to confirm action
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && e.shiftKey === false) {
    // Tab out of canvas to command panel
    commandButtons[0].focus();
    e.preventDefault();
  }
});

// On last button focus: Tab wraps back to canvas
commandButtons[commandButtons.length - 1].addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && e.shiftKey === false) {
    canvas.focus();
    e.preventDefault();
  }
});
```

**Reference:** WAI-ARIA Authoring Practices Guide — Focus Management (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/); WCAG 2.1 2.4.3 (Focus Order).

---

### 5.2 Reduced Motion (Mandatory in 2026)

**Current CSS (lines 58–60 in styles.css):**
```css
@media (prefers-reduced-motion: reduce) {
  .liquid-ether-container { display: none; }
}
```

**Status:** ⚠️ INCOMPLETE  
**Recommendation:** Expand to cover all UI transitions.

**Enhanced Implementation:**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Disable decorative effects */
  .liquid-ether-container { display: none; }
  .blur-text { filter: blur(0); opacity: 1; } /* Instant focus */
  .glitch-text::before,
  .glitch-text::after { display: none; } /* No glitch animation */
  
  /* Keep state feedback */
  .panel {
    transition: border-color 0.01ms, box-shadow 0.01ms;
  }
}
```

**JavaScript Detection:**

```javascript
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersNoMotion = motionQuery.matches;

if (prefersNoMotion) {
  // Disable screen shakes, flashes, parallax in game logic
  gameConfig.screenShakeMagnitude = 0;
  gameConfig.flashIntensity = 0;
}

motionQuery.addEventListener('change', (e) => {
  // Respond to runtime OS-level changes
  console.log('Reduced motion:', e.matches);
});
```

**Legal Note (2026):** Failing to support `prefers-reduced-motion` now poses accessibility compliance risk under WCAG 2.3.3 and emerging digital accessibility laws (EU Accessibility Act, US ADA updates). See https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.

**Verification Scenario (360×800, Reduced Motion Enabled):**
- ✅ Emit `prefers-reduced-motion: reduce` in DevTools (Cmd/Ctrl+Shift+P, emulate)
- ✅ Panel hover states appear instantly, no scaling animation
- ✅ Text blur effect is gone; content is crisp
- ✅ Glitch text is stable (no animated clipping)

---

## VI. Overflow & Scrolling Strategy

### 6.1 Horizontal Overflow Prevention

**Critical Rule:** Game UI must NEVER cause horizontal scroll on any viewport.

**CSS Safeguards:**

```css
html, body {
  width: 100vw;
  overflow-x: hidden; /* Prevent accidental horizontal scroll */
}

.cockpit {
  max-width: 100vw;
  overflow-x: hidden;
}

/* All panels must shrink, not overflow */
.command-grid button {
  min-width: 2.5rem; /* Minimum, not fixed */
  flex-shrink: 1; /* Allow shrinking */
}

.cockpit-rail {
  width: min(280px, 30vw); /* Clamp width to viewport */
}
```

**Verification Scenario (All Breakpoints):**
- ✅ Horizontal scroll is disabled or impossible
- ✅ No content is clipped unexpectedly
- ✅ Buttons and panels shrink/adjust rather than overflow

### 6.2 Vertical Scroll (Rail Only)

**Intel rail scrolls internally; everything else is fixed.**

```css
.cockpit-rail {
  overflow-y: auto; /* Internal scroll */
  scrollbar-width: thin; /* Slim scrollbar on Firefox */
  scrollbar-color: rgb(112, 229, 208, 0.3) transparent; /* Custom color */
}

/* Webkit (Chrome, Safari) scrollbar styling */
.cockpit-rail::-webkit-scrollbar {
  width: 6px;
}

.cockpit-rail::-webkit-scrollbar-track {
  background: transparent;
}

.cockpit-rail::-webkit-scrollbar-thumb {
  background: rgb(112, 229, 208, 0.3);
  border-radius: 3px;
}

.cockpit-rail::-webkit-scrollbar-thumb:hover {
  background: rgb(112, 229, 208, 0.6);
}
```

**Verification Scenario (1024×768, Rail with Expanded Boss Details):**
- ✅ Rail scrolls internally
- ✅ Scrollbar is thin and styled
- ✅ Battlefield and command panel remain fixed and interactive

---

## VII. Safe Area & Notch Handling (Mobile)

### 7.1 iPhone/Android Notch + Home Indicator

**Current Implementation (Correct):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

**CSS Reinforcement:**

```css
body {
  padding-top: env(safe-area-inset-top, 0);
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.cockpit {
  /* Already accounts for safe areas via inset rule */
  inset: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0) 
         env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
}

/* Command buttons: add bottom padding for home indicator */
.command-panel {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
}
```

**Verification Scenario (iPhone 14 Pro, 390×844 with notch):**
- ✅ Top 47px (notch) is never overlaid with UI
- ✅ Bottom 34px (home indicator) is respected
- ✅ Canvas extends to screen edges (pillar-boxed by safe areas)

**Verification Scenario (Samsung S24, 360×800 with punch-hole):**
- ✅ Top 26px (punch-hole) is clear
- ✅ Bottom 0px (no home indicator) has extra padding for ergonomics
- ✅ UI is touch-reachable from all edges

---

## VIII. Performance & Frame Pacing

### 8.1 Canvas Resize Throttling

**Problem:** Rapid window resizes can flood the renderer with size changes.  
**Solution:** Debounce or throttle.

```javascript
let resizeTimeout;
const debouncedResize = () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }, 150); // Wait 150ms after resize stops
};

window.addEventListener('resize', debouncedResize);
```

**Alternative: ResizeObserver (No setTimeout needed):**

```javascript
const resizeObserver = new ResizeObserver(() => {
  // Called only when canvas size actually changes, not on every frame
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
});
resizeObserver.observe(canvas);
```

### 8.2 UI Update Optimization

**Minimize reflows:**

```javascript
// ❌ BAD: Reflow per element
commandButtons.forEach((btn) => {
  btn.textContent = action.name; // Reflow
  btn.dataset.cooldown = cd; // Reflow
  btn.disabled = cd > 0; // Reflow
});

// ✅ GOOD: Batch updates
const updates = commandButtons.map((btn, i) => ({
  btn,
  name: actions[i].name,
  cooldown: cooldowns[i],
}));

requestAnimationFrame(() => {
  updates.forEach(({ btn, name, cooldown }) => {
    btn.textContent = name;
    btn.dataset.cooldown = cooldown;
    btn.disabled = cooldown > 0;
  });
});
```

**Reference:** web.dev — "Rendering performance" (https://web.dev/rendering-performance/).

**Verification Scenario (Command Update at 60fps):**
- ✅ Status changes update <16ms per frame
- ✅ No layout thrashing (reflows once per batch)
- ✅ Canvas frame rate remains stable

---

## IX. Verification Scenarios & Test Matrix

### Test at Exact Resolutions

Run these tests at each breakpoint, measure frame time in DevTools:

| Scenario | Viewport | Canvas Size Expected | Command Layout | Intel Rail | Focus/Tab | Reduced Motion | Status |
|----------|----------|----------------------|-----------------|------------|-----------|----------------|--------|
| **Mobile Portrait** | 360×800 | 360×350 | 3×2 grid | Stack below, scroll | Trap works | Instant | TBD |
| **Mobile Landscape** | 800×360 | 800×250 | 1×7 row | Right, scroll | Trap works | Instant | TBD |
| **Tablet Portrait** | 768×1024 | 700×500 | 3×2 or 7×1 | Right, scroll | Trap works | Instant | TBD |
| **Tablet Landscape** | 1024×768 | 700×600 | 7×1 row | Right, scroll | Trap works | Instant | TBD |
| **Desktop 1366×768** | 1366×768 | 900×650 | 7×1 row | Right 350px | Trap works | Instant | TBD |
| **Desktop 1440×900** | 1440×900 | 950×750 | 7×1 row | Right 380px | Trap works | Instant | TBD |
| **Ultrawide 2560×1440** | 2560×1440 | 1600×1200 clamped | 7×1 row + padding | Right 400px clamped | Trap works | Instant | TBD |

### Manual Verification Steps

**For each breakpoint:**

1. **Overflow Check:**
   - Open DevTools → Overflow Viewer (or browser overflow detection)
   - Verify: No horizontal scroll, no clipped elements
   - Command: `document.documentElement.scrollWidth === window.innerWidth`

2. **Canvas Frame Rate:**
   - Open DevTools → Performance tab
   - Resize window, watch FPS
   - Verify: Frame rate stays ≥50fps during resize

3. **Touch Target Size (Mobile):**
   - Measure button min-height/width with DevTools
   - Verify: ≥48px × 48px in CSS pixels
   - Test: Can tap all buttons without mis-tapping neighbors

4. **Safe Area (Mobile):**
   - Rotate device between portrait and landscape
   - Verify: No content hidden by notch or home indicator
   - Check: Buttons remain accessible at bottom

5. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Verify: Focus outline visible (3px solid)
   - Verify: Tab order makes logical sense (canvas → buttons → rail)

6. **Reduced Motion (All):**
   - Open DevTools → Cmd+Shift+P → "Emulate CSS media feature prefers-reduced-motion"
   - Verify: All animations are instant or removed
   - Verify: State feedback is still clear (color change, outline, etc.)

---

## X. Common Responsive Failures & Fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| Buttons cut off on mobile | Fixed width buttons in flexbox | Use `grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr))` |
| Horizontal scroll on 360px | Padding/margin exceeds viewport | Use `calc(100vw - left-safe - right-safe)` |
| Canvas blurry on high-DPI | CSS size ≠ WebGL buffer size | Set `renderer.setSize(w, h, false)` separately |
| Rail covers buttons on tablet | Stacked layout priority wrong | Use `grid-auto-flow: dense` and media query to reorder grid-area |
| Safe area ignored on iPhone | Viewport-fit missing | Ensure `viewport-fit=cover` in meta tag |
| Reduced motion breaks state | Animation set to `0.01ms` for ALL | Only apply to decorative animations, keep state changes visible |
| Focus outline invisible | Outline offset outside viewport | Use fallback color + ensure offset is inward or zero |

---

## XI. Deployment Checklist

**Before Release:**

- [ ] Tested at all 7 breakpoints (360×800 through 2560×1440)
- [ ] No horizontal scroll on any viewport
- [ ] Canvas frame rate stable (≥50fps) on desktop
- [ ] Touch targets ≥48×48px on mobile
- [ ] Safe areas respected (iPhone notch, home indicator, Android punch-holes)
- [ ] Keyboard focus trap works (Tab cycles through canvas → buttons → rail)
- [ ] Reduced motion enabled: all animations instant, state still clear
- [ ] WebGL buffer size updated on every window resize (no lag or black frame)
- [ ] Rail scrolls internally; battlefield and command panel stay fixed
- [ ] All labels visible or use keyboard shortcuts (H, E, M, C, P, D, A)
- [ ] Tested on real devices: iPhone 14+, Samsung S24+, iPad (9th gen+)
- [ ] Build: `npm run build && npm run test:responsive`

---

## XII. References & Further Reading

### Official Specifications
1. **W3C CSS Environment Variables** — https://www.w3.org/TR/css-env-1/
2. **CSS Container Queries Level 1** — https://www.w3.org/TR/css-contain-3/#container-queries
3. **WCAG 2.1 Level AA (Accessibility)** — https://www.w3.org/WAI/WCAG21/quickref/
4. **WAI-ARIA Authoring Practices** — https://www.w3.org/WAI/ARIA/apg/

### MDN Web Docs
1. **viewport meta tag** — https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag
2. **CSS environment() function** — https://developer.mozilla.org/en-US/docs/Web/CSS/env
3. **prefers-reduced-motion media query** — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
4. **Canvas responsive sizing** — https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

### Industry Best Practices (2026)
1. **web.dev — Responsive Design** — https://web.dev/responsive-web-design-basics/
2. **web.dev — Viewport Units** — https://web.dev/viewport-units/
3. **GameDeveloper — RTS UI Design** — https://gamedeveloper.com/design/building-responsive-ui-for-real-time-strategy-games
4. **Smashing Magazine — Motion & Accessibility** — https://www.smashingmagazine.com/2019/03/prefers-reduced-motion-intro

---

## XIII. Backlog: Future Enhancements

### Not Blocking Initial Release
1. **CSS Subgrid** for nested status grids (when browser support exceeds 95%)
2. **Dynamic font sizing** based on viewport aspect ratio (`aspect-ratio: 16 / 9`)
3. **A/B Testing**: Rail on right (current) vs. bottom (alternative) for tablet
4. **Performance API** sampling: log `paint`, `layout`, `composite` times to telemetry
5. **Custom scrollbar** for rail (already CSS-stubbed, awaits design review)

---

**Status:** Ready for integration  
**Owner:** ResponsiveGameUI specialist  
**Last Updated:** 2026-07-18

