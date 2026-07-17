// 2:1 dimetric (2.5D isometric) battle renderer — Canvas 2D, no WebGL dependency.
//
// Implements the 2.5D RTS architecture report:
// - 2:1 dimetric projection with pixel-snappable tiles (iso-math.js)
// - per-stage heightfield terrain with slope-aware column-scan picking
// - painter depth sorting keyed on floor height, split static/dynamic queues
//   (static terrain pre-sorted once; only units/fx sort per frame)
// - screen-space drag selection (non-physics Rect.contains filter loop)
// - A* global pathing + separation steering for local avoidance
// - virtual audio listener at the screen ground focus with asymmetric
//   top/bottom attenuation and a low-pass on "far" (upper) sources
// - seeded presentation RNG so a replayed battle shows the same choreography
//
// This renderer owns no engine-facing transitions; it is presentation only.

import {
  TILE_W, TILE_H, ELEV_H, LAYER,
  worldToScreen, pickTile, depthKey, findPath, steer,
  rectContains, directionIndex, mulberry32
} from "./iso-math.js";
import {
  TILEMAP_RENDER_MODE, buildIndividualDrawQueue, chunkForTile,
  selectTilemapRenderMode, visibleIndividualItems,
} from "./tilemap-renderer.js";
import { DEFAULT_BATTLE_PRESENTATION } from "./battle-presentation.js";

const GRID_W = 16;
const GRID_H = 8;
const ALLY_SPAWN = Object.freeze({ x: 1, y: 3.5 });
const BOSS_TILE = Object.freeze({ x: 14, y: 3.5 });
const BREACH_X = 1.2;          // enemy reaching this x = breach
const GOAL_X = 13.8;           // ally reaching this x = strike delivered
const CLASH_DIST = 0.5;
const CLASH_TICK_S = 0.55;     // seconds between swings in a sustained engagement
const PICKET_X = 5.5;          // default ally holding line (in front of the nodes)
const INTERCEPT_RANGE = 3;     // aggressor radius: defenders chase hostiles this close
const AI_TICK_MS = 250;        // report: transition priority refresh cadence

const BASE_PALETTE = Object.freeze({
  ally: "#70e5d0",
  allyPossessed: "#fff0a4",
  enemy: "#ff7f79",
  node: "#70e5d0",
  domain: "#ab68ff",
  spark: "#ffb85c",
  gridLine: "rgba(59, 76, 104, 0.55)",
  tileTop: ["#141b30", "#182238", "#1d2a42", "#22314d"],   // by elevation
  tileLeft: "#0c1122",
  tileRight: "#101731",
  chasm: "#05070f",
  background: "#060913"
});

function paletteFromPresentation(presentation) {
  const p = presentation?.palette;
  if (!p) return BASE_PALETTE;
  return Object.freeze({
    ...BASE_PALETTE,
    ally: p.ally ?? BASE_PALETTE.ally,
    enemy: p.hostile ?? BASE_PALETTE.enemy,
    node: p.ally ?? BASE_PALETTE.node,
    domain: p.domain ?? BASE_PALETTE.domain,
    spark: p.accent ?? BASE_PALETTE.spark,
    gridLine: p.grid ?? BASE_PALETTE.gridLine,
    tileTop: p.gridSecondary
      ? [p.gridSecondary, p.grid ?? p.gridSecondary, p.gridSecondary, p.grid ?? p.gridSecondary]
      : BASE_PALETTE.tileTop,
    background: p.background ?? BASE_PALETTE.background
  });
}

const BOSS_ART = Object.freeze({
  1: "assets/images/ui/boss-cinder-warden.png",
  2: "assets/images/ui/boss-veil-tactician.png",
  // Stage 3: Blender-rendered throned Gate Sovereign statue (256x256) -
  // a field piece reads better in the dimetric world than a flat portrait.
  3: "assets/images/battle/sovereign-atlas.png"
});

// Conceptual 2D character atlas: 8 facing directions × 2 idle-light phases.
// Coordinates mirror assets/images/characters/dusk-legion-atlas.json.
const UNIT_ATLAS = Object.freeze({
  src: "assets/images/characters/dusk-legion-atlas.png",
  framePx: 256,
  padding: 2,
  stride: 260,
  fps: 16
});

// Per-stage heightfields (16×8, integers; -1 = chasm/unwalkable).
// Stage 1 Cinder Span: a bridge over the drowned forge — void edges.
// Stage 2 Veil Citadel: twin raised plateaus (the two signal nodes) + ramps.
// Stage 3 Echo Throne: stepped ascent toward the throne.
function buildHeightfield(stageNumber) {
  const h = [];
  for (let y = 0; y < GRID_H; y++) {
    h.push(new Array(GRID_W).fill(0));
  }
  if (stageNumber === 1) {
    for (let x = 0; x < GRID_W; x++) {
      h[0][x] = -1;
      h[GRID_H - 1][x] = -1;
      if (x >= 5 && x <= 10) { h[1][x] = -1; h[GRID_H - 2][x] = -1; } // narrow span
    }
  } else if (stageNumber === 2) {
    for (let y = 2; y <= 5; y++) {
      for (let x = 5; x <= 6; x++) h[y][x] = 1;
      for (let x = 9; x <= 10; x++) h[y][x] = 1;
    }
  } else {
    for (let y = 2; y <= 5; y++) {
      for (let x = 11; x <= 12; x++) h[y][x] = 1;
      for (let x = 13; x <= 15; x++) h[y][x] = 2;
    }
  }
  return h;
}

export class BattleVisualizer {
  constructor(canvas, presentation = DEFAULT_BATTLE_PRESENTATION, options = {}) {
    this.canvas = canvas;
    this.presentation = presentation;
    this.stageNumber = presentation.stageNumber;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.palette = paletteFromPresentation(presentation);
    this.ctx = null;
    this.animationFrameId = null;
    this.destroyed = false;
    this.lastTime = 0;
    this.aiAccumulator = 0;

    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.nodes = [];        // {x, y}
    this.nodeGoal = Math.max(1, Number.isInteger(options.nodeGoal) ? options.nodeGoal : 1);
    this.onTacticalLayout = typeof options.onTacticalLayout === "function" ? options.onTacticalLayout : null;
    this.orderFlag = null;  // {x, y, life}
    this.domainLife = 0;
    this.waveCounter = 0;
    this.isAssaulting = false;
    this.assaultTimer = 0;

    // Engine-facing event: fired when a hostile visually crosses the Dusk
    // Portal line in the LIVE simulation. app.js records it as a
    // battle-breach transition (save/replay applies the recorded event, so
    // the deterministic contract is preserved). Under reduced-motion or
    // renderer fallback there is no live sim — app.js uses timers instead.
    this.onEnemyBreach = null;
    this.breachFlash = 0;

    // Canvas HUD mirror of engine numbers (app.js pushes via setHud()).
    this.hud = null;


    this.height = buildHeightfield(this.stageNumber);
    this.rng = mulberry32(0x5eed + this.stageNumber * 977);

    this.view = { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 };
    this.terrainMode = TILEMAP_RENDER_MODE.CHUNK;
    this.staticChunks = new Map();
    this.terrainTiles = [];
    this.occluderTiles = [];
    this.unitAtlas = null;
    this.bossImage = null;

    this.selection = new Set();
    this.dragRect = null;     // {x0,y0,x1,y1} in canvas px
    this.pointerDown = null;
    this.pointerHandlers = null;
    this.resizeHandler = null;

    this.audio = null;        // { ctx, master }
  }

  // --- terrain helpers -------------------------------------------------

  heightAt(x, y) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return -1;
    return this.height[y][x];
  }

  walkable(x, y) {
    return this.heightAt(x, y) >= 0;
  }

  climbOk(x0, y0, x1, y1) {
    return Math.abs(this.heightAt(x1, y1) - this.heightAt(x0, y0)) <= 1;
  }

  elevationAt(fx, fy) {
    const h = this.heightAt(Math.floor(fx), Math.floor(fy));
    return h < 0 ? 0 : h;
  }

  sortRootAt(fx, fy) {
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    return { x: x + 0.5, y: y + 0.5, z: this.elevationAt(fx, fy) };
  }

  // --- lifecycle -------------------------------------------------------

  init() {
    if (this.destroyed || this.ctx) return this;
    this.ctx = this.canvas.getContext("2d");
    this.computeView();
    this.buildStaticLayer();
    this.loadBossArt();
    this.loadUnitAtlas();
    this.attachPointerHandlers();

    this.resizeHandler = () => {
      if (this.destroyed) return;
      this.computeView();
      this.buildStaticLayer();
      this.renderStatic();
    };
    window.addEventListener("resize", this.resizeHandler);

    this.lastTime = performance.now();
    if (this.reducedMotion) this.render();
    else this.animate();
    return this;
  }

  renderStatic() {
    if (this.reducedMotion && !this.destroyed) this.render();
  }

  computeView() {
    const cssW = Math.max(this.canvas.clientWidth, 1);
    const cssH = Math.max(this.canvas.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.view.width = cssW;
    this.view.height = cssH;

    // Grid bounding box in projection space.
    const corners = [
      worldToScreen(0, 0, 0), worldToScreen(GRID_W, 0, 0),
      worldToScreen(0, GRID_H, 0), worldToScreen(GRID_W, GRID_H, 0)
    ];
    const minX = Math.min(...corners.map(c => c.x)) - TILE_W / 2;
    const maxX = Math.max(...corners.map(c => c.x)) + TILE_W / 2;
    const minY = Math.min(...corners.map(c => c.y)) - ELEV_H * 3;
    const maxY = Math.max(...corners.map(c => c.y)) + TILE_H;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(cssW / worldW, cssH / worldH);
    this.view.scale = scale;
    this.view.offsetX = (cssW - worldW * scale) / 2 - minX * scale;
    this.view.offsetY = (cssH - worldH * scale) / 2 - minY * scale;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.notifyTacticalLayout();
  }

  project(fx, fy, fz = 0) {
    const s = worldToScreen(fx, fy, fz);
    return {
      x: s.x * this.view.scale + this.view.offsetX,
      y: s.y * this.view.scale + this.view.offsetY
    };
  }

  unprojectToTile(canvasX, canvasY) {
    const sx = (canvasX - this.view.offsetX) / this.view.scale;
    const sy = (canvasY - this.view.offsetY) / this.view.scale;
    // Column-scan picking against the real heightfield (slope-aware).
    return pickTile(sx, sy, (x, y) => this.heightAt(x, y), 4);
  }

  nodePosition(index) {
    const spacing = 8 / (this.nodeGoal + 1);
    return { x: 3.5 + index * spacing, y: GRID_H / 2 - 0.5 };
  }

  getTacticalTargetAnchors() {
    const captureIndex = this.nodes.length + 1;
    const captureNode = captureIndex <= this.nodeGoal ? this.nodePosition(captureIndex) : null;
    return {
      materialize: this.project(ALLY_SPAWN.x, ALLY_SPAWN.y, 0),
      capture: captureNode ? this.project(captureNode.x, captureNode.y, 0) : null,
      assault: this.project(BOSS_TILE.x, BOSS_TILE.y, 0)
    };
  }

  notifyTacticalLayout() {
    this.onTacticalLayout?.(this.getTacticalTargetAnchors());
  }

  // --- terrain cache and shared draw ordering ------------------------------

  buildStaticLayer() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.terrainMode = selectTilemapRenderMode({
      width: GRID_W,
      height: GRID_H,
      backingPixels: this.canvas.width * this.canvas.height,
    });
    this.staticChunks.clear();
    this.terrainTiles = [];
    this.occluderTiles = [];

    const floorChunks = new Map();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const z = this.height[y][x];
        const tile = {
          id: `terrain-${x}-${y}`,
          x,
          y,
          z,
          sortRoot: { x: x + 0.5, y: y + 0.5, z },
          layer: z > 0 ? "prop" : "ground",
          kind: z > 0 ? "occluder" : "floor",
        };
        this.terrainTiles.push(tile);
        if (z > 0) {
          // Raised collision/occlusion geometry must share the per-item painter
          // queue with units; never flatten it into a floor chunk.
          this.occluderTiles.push(tile);
          continue;
        }
        const chunk = chunkForTile(x, y);
        const tiles = floorChunks.get(chunk.id) ?? [];
        tiles.push(tile);
        floorChunks.set(chunk.id, tiles);
      }
    }

    if (this.terrainMode === TILEMAP_RENDER_MODE.INDIVIDUAL) return;
    for (const [id, tiles] of floorChunks) {
      this.staticChunks.set(id, this.buildTerrainChunk(id, tiles, dpr));
    }
  }

  buildTerrainChunk(id, tiles, dpr) {
    const s = this.view.scale;
    const hw = (TILE_W / 2) * s;
    const hh = (TILE_H / 2) * s;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const tile of tiles) {
      const z = Math.max(tile.z, 0);
      const center = this.project(tile.x + 0.5, tile.y + 0.5, z);
      left = Math.min(left, center.x - hw);
      right = Math.max(right, center.x + hw);
      top = Math.min(top, center.y - hh);
      bottom = Math.max(bottom, center.y + hh + z * ELEV_H * s);
    }

    left = Math.floor(left) - 1;
    top = Math.floor(top) - 1;
    right = Math.ceil(right) + 1;
    bottom = Math.ceil(bottom) + 1;
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    const orderedTiles = [...tiles].sort(
      (a, b) => depthKey(a.x, a.y, Math.max(a.z, 0), LAYER.ground)
        - depthKey(b.x, b.y, Math.max(b.z, 0), LAYER.ground),
    );
    for (const tile of orderedTiles) this.drawTile(ctx, tile.x, tile.y, tile.z);
    return { id, canvas, bounds: { left, top, right, bottom }, width, height };
  }

  drawTile(ctx, x, y, z) {
    const s = this.view.scale;
    const hw = (TILE_W / 2) * s;
    const hh = (TILE_H / 2) * s;

    if (z < 0) {
      // chasm: dark diamond, no walls
      const c = this.project(x + 0.5, y + 0.5, 0);
      ctx.fillStyle = this.palette.chasm;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - hh);
      ctx.lineTo(c.x + hw, c.y);
      ctx.lineTo(c.x, c.y + hh);
      ctx.lineTo(c.x - hw, c.y);
      ctx.closePath();
      ctx.fill();
      return;
    }

    const top = this.project(x + 0.5, y + 0.5, z);
    // side faces for elevated tiles (drawn first, behind the top)
    if (z > 0) {
      const drop = z * ELEV_H * s;
      ctx.fillStyle = this.palette.tileLeft;
      ctx.beginPath();
      ctx.moveTo(top.x - hw, top.y);
      ctx.lineTo(top.x, top.y + hh);
      ctx.lineTo(top.x, top.y + hh + drop);
      ctx.lineTo(top.x - hw, top.y + drop);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.palette.tileRight;
      ctx.beginPath();
      ctx.moveTo(top.x + hw, top.y);
      ctx.lineTo(top.x, top.y + hh);
      ctx.lineTo(top.x, top.y + hh + drop);
      ctx.lineTo(top.x + hw, top.y + drop);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = this.palette.tileTop[Math.min(z, this.palette.tileTop.length - 1)];
    ctx.strokeStyle = this.palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - hh);
    ctx.lineTo(top.x + hw, top.y);
    ctx.lineTo(top.x, top.y + hh);
    ctx.lineTo(top.x - hw, top.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // --- sprites (pre-rendered offscreen, per archetype) --------------------


  loadBossArt() {
    const src = BOSS_ART[this.stageNumber];
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      if (this.destroyed) return;
      this.bossImage = img;
      this.renderStatic();
    };
    img.onerror = () => undefined;
    img.src = src;
  }

  // 8-direction unit atlases (Blender-rendered dimetric sprites). Each strip
  // is 8x 128px frames, dir0 = facing the camera (screen S), CCW yaw steps.
  // Fallback: the procedural orb sprites remain if a file never loads.
  loadUnitAtlas() {
    const img = new Image();
    img.onload = () => {
      if (this.destroyed) return;
      this.unitAtlas = img;
      this.render();
    };
    img.onerror = () => undefined;
    img.src = UNIT_ATLAS.src;
  }

  // World-facing sector (directionIndex: 0 = +x world = screen SE, CCW) ->
  // conceptual atlas facing. The rings differ by a quarter-plus-eighth turn.
  atlasFacing(facing) {
    return (7 - (facing ?? 0)) % 8;
  }

  // World-facing sector (directionIndex: 0 = +x world = screen SE, CCW) ->
  // atlas frame (0 = screen S, CCW). Both rings are CCW; they differ by a
  // constant quarter-plus-eighth turn: frame = 7 - facing.
  atlasFrame(facing) {
    return (7 - (facing ?? 0)) % 8;
  }

  // --- audio (virtual listener at screen ground focus) --------------------

  ensureAudio() {
    if (this.audio || this.destroyed) return this.audio;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      this.audio = { ctx, master };
    } catch {
      this.audio = null;
    }
    return this.audio;
  }

  // Report: listener sits at the viewport ground focus, biased slightly
  // toward the screen top; bottom sources play "closer" (louder), top
  // sources are softened and low-passed (atmospheric distance).
  playSpatial(fx, fy, { freq = 320, duration = 0.18, type = "triangle", gain = 1 } = {}) {
    const audio = this.ensureAudio();
    if (!audio || audio.ctx.state === "suspended") return;
    const p = this.project(fx, fy, this.elevationAt(fx, fy));
    const cx = this.view.width / 2;
    const focusY = this.view.height * 0.42; // biased above center per the report
    const pan = Math.max(-1, Math.min(1, (p.x - cx) / (this.view.width / 2)));
    const vertical = (p.y - focusY) / this.view.height; // <0 above focus, >0 below
    const proximity = Math.max(0.25, Math.min(1.2, 1 + vertical * 0.9));

    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = audio.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.28 * gain * proximity, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const panner = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
    let tail = env;
    if (vertical < -0.05) {
      // above focus: distant — low-pass filter (psychoacoustic damping)
      const lp = audio.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900 + 2200 * Math.max(0, 1 + vertical);
      env.connect(lp);
      tail = lp;
    }
    if (panner) {
      panner.pan.value = pan;
      tail.connect(panner);
      panner.connect(this.audio.master);
    } else {
      tail.connect(this.audio.master);
    }
    osc.connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // --- selection & orders (screen-space filter loop) ----------------------

  attachPointerHandlers() {
    const canvasPoint = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event) => {
      if (event.button !== 0) return;
      const p = canvasPoint(event);
      this.pointerDown = p;
      this.dragRect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      this.canvas.setPointerCapture?.(event.pointerId);
      this.renderStatic();
    };
    const move = (event) => {
      if (!this.pointerDown || !this.dragRect) return;
      const p = canvasPoint(event);
      this.dragRect.x1 = p.x;
      this.dragRect.y1 = p.y;
      this.renderStatic();
    };
    const up = (event) => {
      if (!this.pointerDown) return;
      const p = canvasPoint(event);
      const dx = Math.abs(p.x - this.pointerDown.x);
      const dy = Math.abs(p.y - this.pointerDown.y);
      if (dx > 6 || dy > 6) {
        // Drag select: project each ally to screen, Rect.contains filter.
        this.selection.clear();
        for (const ally of this.allies) {
          const s = this.project(ally.x, ally.y, this.elevationAt(ally.x, ally.y));
          if (rectContains(this.dragRect, s.x, s.y)) this.selection.add(ally);
        }
      } else if (this.selection.size > 0) {
        // Click with an active selection: move order via slope-aware picking.
        const tile = this.unprojectToTile(p.x, p.y);
        if (tile && this.walkable(tile.x, tile.y)) {
          this.issueMoveOrder(tile);
          this.orderFlag = { x: tile.x + 0.5, y: tile.y + 0.5, life: 1.2 };
          this.playSpatial(tile.x + 0.5, tile.y + 0.5, { freq: 520, duration: 0.12, type: "sine", gain: 0.6 });
        }
      } else {
        this.selection.clear();
      }
      this.pointerDown = null;
      this.dragRect = null;
      this.renderStatic();
    };
    const cancel = () => {
      this.pointerDown = null;
      this.dragRect = null;
      this.renderStatic();
    };
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", cancel);
    this.pointerHandlers = { down, move, up, cancel };
  }

  issueMoveOrder(tile) {
    for (const ally of this.allies) {
      if (!this.selection.has(ally)) continue;
      const start = { x: Math.round(ally.x), y: Math.round(ally.y) };
      const path = findPath(start, { x: tile.x, y: tile.y }, {
        walkable: (x, y) => this.walkable(x, y),
        climbOk: (x0, y0, x1, y1) => this.climbOk(x0, y0, x1, y1),
        width: GRID_W,
        height: GRID_H
      });
      if (path && path.length > 1) {
        ally.path = path.slice(1).map(node => ({ x: node.x + 0.5 - 0.5, y: node.y + (this.rng() - 0.5) * 0.4 }));
        ally.holdUntil = performance.now() + 6000; // hold position window after arriving
      }
    }
  }

  // --- public trigger API (unchanged surface) -----------------------------

  spawnAlly(count = 2, isPossessed = false) {
    if (this.destroyed) return;
    for (let i = 0; i < count; i++) {
      const unit = {
        x: ALLY_SPAWN.x + this.rng() * 0.6,
        y: ALLY_SPAWN.y + (this.rng() - 0.5) * 2.4,
        speed: 1.4 + this.rng() * 0.5,
        hp: isPossessed ? 4 : 2,
        isPossessed,
        path: null,
        holdUntil: 0,
        facing: 0
      };
      this.allies.push(unit);
      this.burst(unit.x, unit.y, 10, this.palette.ally);
    }
    this.playSpatial(ALLY_SPAWN.x, ALLY_SPAWN.y, { freq: 240, type: "sine", duration: 0.22 });
    this.renderStatic();
  }

  spawnEnemy(count = 3) {
    if (this.destroyed) return;
    const archetypes = ["scout", "guard", "reinforce"];
    const archetype = archetypes[this.waveCounter % archetypes.length];
    this.waveCounter += 1;
    for (let i = 0; i < count; i++) {
      const unit = {
        x: BOSS_TILE.x - 0.5 - this.rng() * 0.5,
        y: BOSS_TILE.y + (this.rng() - 0.5) * 2.4,
        speed: archetype === "scout" ? 1.5 + this.rng() * 0.4 : 0.9 + this.rng() * 0.4,
        hp: archetype === "reinforce" ? 2 : 1,
        archetype,
        laneY: archetype === "scout" ? (this.rng() > 0.5 ? 1.6 : GRID_H - 2.6) : BOSS_TILE.y + (this.rng() - 0.5) * 1.6,
        facing: 4
      };
      this.enemies.push(unit);
      this.burst(unit.x, unit.y, 8, this.palette.enemy);
    }
    this.playSpatial(BOSS_TILE.x, BOSS_TILE.y, { freq: 180, type: "sawtooth", duration: 0.3, gain: 0.8 });
    this.renderStatic();
  }

  triggerHunt() {
    const fx = 3 + this.rng() * 8;
    const fy = 1.5 + this.rng() * 4.5;
    if (this.reducedMotion) {
      this.orderFlag = { x: fx, y: fy, life: 1 };
      this.renderStatic();
      return;
    }
    this.burst(fx, fy, 20, this.palette.spark);
    this.playSpatial(fx, fy, { freq: 400, type: "sine", duration: 0.25, gain: 0.7 });
  }

  triggerMaterialize(count = 2) {
    this.spawnAlly(count);
  }

  triggerPossess() {
    const ally = this.allies[0];
    if (ally) {
      ally.isPossessed = true;
      ally.hp = Math.max(ally.hp, 3);
      this.burst(ally.x, ally.y, 18, this.palette.allyPossessed);
      this.playSpatial(ally.x, ally.y, { freq: 640, type: "sine", duration: 0.3 });
    }
    this.renderStatic();
  }

  triggerExtract() {
    if (this.reducedMotion) {
      this.orderFlag = { x: 6, y: 3.5, life: 1 };
      this.renderStatic();
      return;
    }
    for (let i = 0; i < 14; i++) {
      const fx = 4 + this.rng() * 6;
      const fy = 1.5 + this.rng() * 4.5;
      this.particles.push({
        x: fx, y: fy, z: 0.2,
        sortRoot: { x: 6, y: 3.5, z: 0 },
        vx: -3.2 - this.rng() * 1.6, vy: (this.rng() - 0.5) * 0.6, vz: 0.6 + this.rng(),
        color: this.palette.ally, life: 1.1, decay: 0.9
      });
    }
    this.playSpatial(6, 3.5, { freq: 300, type: "sine", duration: 0.3, gain: 0.7 });
  }

  triggerCapture(nodeIndex, maxNodes) {
    this.nodeGoal = Math.max(1, maxNodes);
    this.nodes = [];
    for (let i = 1; i <= nodeIndex; i++) {
      const node = this.nodePosition(i);
      this.nodes.push(node);
      this.burst(node.x, node.y, 14, this.palette.node);
    }
    const capturedNode = this.nodePosition(nodeIndex);
    this.playSpatial(capturedNode.x, capturedNode.y, { freq: 210, type: "square", duration: 0.35, gain: 0.9 });
    this.notifyTacticalLayout();
    this.renderStatic();
  }

  triggerDomain() {
    this.domainLife = 4.0;
    this.burst(ALLY_SPAWN.x + 1, ALLY_SPAWN.y, 26, this.palette.domain);
    this.playSpatial(ALLY_SPAWN.x, ALLY_SPAWN.y, { freq: 140, type: "sine", duration: 0.6, gain: 1.1 });
    this.renderStatic();
  }

  triggerAssault() {
    this.isAssaulting = true;
    for (const ally of this.allies) {
      ally.speed = 5.2;
      ally.path = null; // assault overrides move orders
    }
    if (this.reducedMotion) {
      this.orderFlag = { x: BOSS_TILE.x, y: BOSS_TILE.y, life: 1 };
      this.isAssaulting = false;
      this.renderStatic();
      return;
    }
    window.clearTimeout(this.assaultTimer);
    this.assaultTimer = window.setTimeout(() => {
      if (!this.destroyed) {
        this.burst(BOSS_TILE.x, BOSS_TILE.y, 40, this.palette.enemy);
        this.playSpatial(BOSS_TILE.x, BOSS_TILE.y, { freq: 90, type: "sawtooth", duration: 0.5, gain: 1.2 });
      }
      this.isAssaulting = false;
    }, 1200);
  }

  burst(fx, fy, count, color) {
    if (this.destroyed || this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 0.5 + this.rng() * 1.8;
      this.particles.push({
        x: fx, y: fy, z: 0.15,
        sortRoot: { x: fx, y: fy, z: 0 },
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 1.2 + this.rng() * 2,
        color, life: 1, decay: 1.4 + this.rng() * 1.4
      });
    }
  }

  // Engine numbers mirrored onto the canvas (integrity pips, boss bar).
  // app.js pushes fresh values every render tick; null hides the HUD.
  setHud(hud) {
    this.hud = hud;
    if (this.reducedMotion) this.render();
  }

  nearestEnemy(unit, range) {
    let best = null;
    let bestD = range * range;
    for (const enemy of this.enemies) {
      const dx = enemy.x - unit.x;
      const dy = enemy.y - unit.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = enemy; }
    }
    return best;
  }

  // --- simulation ---------------------------------------------------------

  updateUnits(dt) {
    // Allies: explicit move order > intercept nearby hostile > hold picket.
    // Shades are DEFENDERS by default - they advance to the picket line in
    // front of the signal nodes and engage what comes, instead of marching
    // into the portal and despawning. Only an Assault order sends them in.
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const ally = this.allies[i];
      if ((ally.engagedT ?? 0) > 0) { ally.engagedT -= dt; continue; } // locked in melee
      let target;
      if (ally.path && ally.path.length > 0) {
        target = ally.path[0];
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        if (dx * dx + dy * dy < 0.05) {
          ally.path.shift();
          if (ally.path.length === 0) ally.path = null;
        }
      } else if (this.isAssaulting) {
        target = { x: GOAL_X, y: ally.y };
      } else {
        const prey = this.nearestEnemy(ally, INTERCEPT_RANGE);
        if (prey) {
          target = { x: prey.x, y: prey.y };
        } else if (performance.now() < ally.holdUntil) {
          target = null; // hold position (defender behavior after a move order)
        } else if (Math.abs(ally.x - PICKET_X) > 0.25) {
          target = { x: PICKET_X, y: ally.y };
        } else {
          target = null; // standing watch on the picket line
        }
      }
      if (target) {
        const mag = Math.hypot(target.x - ally.x, target.y - ally.y) || 1;
        const preferred = {
          x: ((target.x - ally.x) / mag) * ally.speed,
          y: ((target.y - ally.y) / mag) * ally.speed
        };
        const v = steer(ally, preferred, this.allies);
        ally.x += v.x * dt;
        ally.y = Math.max(0.4, Math.min(GRID_H - 0.4, ally.y + v.y * dt));
        ally.facing = directionIndex(v.x, v.y);
      }
      if (this.isAssaulting && ally.x >= GOAL_X) {
        this.burst(ally.x, ally.y, 6, this.palette.ally);
        this.allies.splice(i, 1);
        this.selection.delete(ally);
      }
    }

    // Enemies: scouts flank via laneY then cut in; others straight lane.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if ((enemy.clashCd ?? 0) > 0) enemy.clashCd -= dt;
      if ((enemy.engagedT ?? 0) > 0) { enemy.engagedT -= dt; continue; } // locked in melee
      const preferred = { x: -enemy.speed, y: 0 };
      if (enemy.archetype === "scout" && enemy.x > 5) {
        preferred.y = (enemy.laneY - enemy.y) * 1.2;
      } else if (enemy.x <= 5) {
        preferred.y = (BOSS_TILE.y - enemy.y) * 0.6; // converge on the portal
      }
      const v = steer(enemy, preferred, this.enemies);
      enemy.x += v.x * dt;
      enemy.y = Math.max(0.4, Math.min(GRID_H - 0.4, enemy.y + v.y * dt));
      enemy.facing = directionIndex(v.x, v.y);
      if (enemy.x <= BREACH_X) {
        this.burst(enemy.x, enemy.y, 10, this.palette.enemy);
        this.playSpatial(enemy.x, enemy.y, { freq: 110, type: "sawtooth", duration: 0.5, gain: 1.3 });
        this.enemies.splice(i, 1);
        this.breachFlash = 1;
        if (typeof this.onEnemyBreach === "function") this.onEnemyBreach();
      }
    }

    // Clash: engagement ticks, not per-frame melts. Each unit swings at most
    // once per CLASH_TICK_S, so a 2HP shade visibly holds the line against
    // two 1HP scouts instead of evaporating in two frames.
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const ally = this.allies[i];
      if ((ally.clashCd ?? 0) > 0) ally.clashCd -= dt;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if ((enemy.clashCd ?? 0) > 0) continue;
        if ((ally.clashCd ?? 0) > 0) break;
        const dx = ally.x - enemy.x;
        const dy = ally.y - enemy.y;
        if (dx * dx + dy * dy < CLASH_DIST * CLASH_DIST) {
          this.burst(ally.x, ally.y, 4, this.palette.spark);
          this.playSpatial(ally.x, ally.y, { freq: 480, type: "triangle", duration: 0.1, gain: 0.5 });
          ally.hp -= 1;
          enemy.hp -= 1;
          ally.clashCd = CLASH_TICK_S;
          enemy.clashCd = CLASH_TICK_S;
          ally.engagedT = CLASH_TICK_S;
          enemy.engagedT = CLASH_TICK_S;
          if (enemy.hp <= 0) this.enemies.splice(j, 1);
          if (ally.hp <= 0) {
            this.allies.splice(i, 1);
            this.selection.delete(ally);
            break;
          }
        }
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * p.decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 6.5 * dt;
      if (p.z < 0.02) { p.z = 0.02; p.vz = -p.vz * 0.3; }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.domainLife > 0) this.domainLife -= dt;
    if (this.orderFlag) {
      this.orderFlag.life -= dt;
      if (this.orderFlag.life <= 0) this.orderFlag = null;
    }
  }

  // --- render (dynamic painter queue) --------------------------------------

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    ctx.fillStyle = this.palette.background;
    ctx.fillRect(0, 0, this.view.width, this.view.height);

    // Chunk Mode owns only opaque, non-occluding floor. The chunk's bounds are
    // culled before its bitmap blit; barriers remain below in the shared queue.
    if (this.terrainMode === TILEMAP_RENDER_MODE.CHUNK) {
      const viewport = { left: 0, top: 0, right: this.view.width, bottom: this.view.height };
      for (const chunk of visibleIndividualItems([...this.staticChunks.values()], viewport)) {
        ctx.drawImage(chunk.canvas, chunk.bounds.left, chunk.bounds.top, chunk.width, chunk.height);
      }
    }

    const terrain = this.terrainMode === TILEMAP_RENDER_MODE.INDIVIDUAL
      ? this.terrainTiles
      : this.occluderTiles;
    const queue = buildIndividualDrawQueue(terrain, this.buildDynamicDrawRecords());
    for (const item of queue) this.drawQueuedItem(item);

    if (this.domainLife > 0) this.drawDomain();
    if (this.orderFlag) this.drawOrderFlag();
    if (this.dragRect) this.drawDragRect();
    if (this.hud) this.drawHud();
    if (this.breachFlash > 0.01) {
      // Red vignette pulse: a breach must be FELT, not just logged.
      const ctx2 = this.ctx;
      const g = ctx2.createRadialGradient(
        this.view.width / 2, this.view.height / 2, Math.min(this.view.width, this.view.height) * 0.35,
        this.view.width / 2, this.view.height / 2, Math.max(this.view.width, this.view.height) * 0.72
      );
      g.addColorStop(0, "rgba(255, 60, 50, 0)");
      g.addColorStop(1, `rgba(255, 60, 50, ${0.42 * this.breachFlash})`);
      ctx2.fillStyle = g;
      ctx2.fillRect(0, 0, this.view.width, this.view.height);
    }
  }

  buildDynamicDrawRecords() {
    const records = [
      {
        id: "ally-portal", x: ALLY_SPAWN.x, y: ALLY_SPAWN.y, z: 0,
        sortRoot: this.sortRootAt(ALLY_SPAWN.x, ALLY_SPAWN.y),
        layer: "prop", render: "portal", color: this.palette.ally,
      },
      {
        id: "boss-portal", x: BOSS_TILE.x, y: BOSS_TILE.y, z: 0,
        sortRoot: this.sortRootAt(BOSS_TILE.x, BOSS_TILE.y),
        layer: "prop", render: "portal", color: this.palette.enemy,
      },
      {
        id: "boss", x: BOSS_TILE.x + 0.4, y: BOSS_TILE.y + 0.4, z: 0,
        sortRoot: this.sortRootAt(BOSS_TILE.x + 0.4, BOSS_TILE.y + 0.4),
        layer: "actor", render: "boss",
      },
    ];
    for (let index = 1; index <= this.nodeGoal; index++) {
      const node = this.nodePosition(index);
      records.push({
        id: `node-${index}`, x: node.x, y: node.y, z: 0,
        sortRoot: this.sortRootAt(node.x, node.y), layer: "prop",
        render: "node", node, captured: index <= this.nodes.length,
      });
    }
    for (let index = 0; index < this.allies.length; index++) {
      const unit = this.allies[index];
      records.push({
        id: `ally-${index}`, x: unit.x, y: unit.y, z: this.elevationAt(unit.x, unit.y),
        sortRoot: this.sortRootAt(unit.x, unit.y), layer: "actor", render: "unit", unit,
        kind: unit.isPossessed ? "possessed" : "ally",
      });
    }
    for (let index = 0; index < this.enemies.length; index++) {
      const unit = this.enemies[index];
      records.push({
        id: `enemy-${index}`, x: unit.x, y: unit.y, z: this.elevationAt(unit.x, unit.y),
        sortRoot: this.sortRootAt(unit.x, unit.y), layer: "actor", render: "unit", unit, kind: "enemy",
      });
    }
    for (let index = 0; index < this.particles.length; index++) {
      const particle = this.particles[index];
      records.push({
        id: `particle-${index}`, x: particle.x, y: particle.y, z: 0,
        sortRoot: particle.sortRoot, layer: "fx", blend: "additive",
        render: "particle", particle,
      });
    }
    return records;
  }

  drawQueuedItem(item) {
    if (item.source === "tile") {
      this.drawTile(this.ctx, item.x, item.y, item.z);
      return;
    }
    if (item.render === "portal") this.drawPortal(item.x, item.y, item.color);
    else if (item.render === "node") this.drawNode(item.node, item.captured);
    else if (item.render === "boss") this.drawBoss();
    else if (item.render === "unit") this.drawUnit(item.unit, item.kind);
    else if (item.render === "particle") this.drawParticle(item.particle, item.blend);
  }

  drawHud() {
    const ctx = this.ctx;
    const s = Math.max(0.75, this.view.scale);
    const pad = 10 * s;
    ctx.save();
    ctx.font = `${Math.round(11 * s)}px ui-monospace, monospace`;
    ctx.textBaseline = "middle";

    // Integrity pips (top-left): filled = remaining, hollow = lost.
    const max = Math.max(1, this.hud.maxIntegrity ?? 10);
    const cur = Math.max(0, this.hud.integrity ?? max);
    const pip = 7 * s;
    const gap = 4 * s;
    ctx.fillStyle = this.palette.ally;
    ctx.globalAlpha = 0.9;
    ctx.fillText("\u26E8", pad, pad + pip / 2);
    const pipX0 = pad + 16 * s;
    for (let i = 0; i < max; i++) {
      const x = pipX0 + i * (pip + gap);
      if (i < cur) {
        ctx.fillStyle = cur <= 3 ? "#ff7f79" : this.palette.ally;
        ctx.fillRect(x, pad, pip, pip);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, pad, pip, pip);
      }
    }
    if ((this.hud.aegis ?? 0) > 0) {
      ctx.fillStyle = "#ffe18a";
      ctx.fillText(`AEGIS x${this.hud.aegis}`, pipX0 + max * (pip + gap) + 6 * s, pad + pip / 2);
    }

    // Boss bar (top-right).
    if (this.hud.bossMax) {
      const w = 120 * s;
      const h = 8 * s;
      const x = this.view.width - pad - w;
      const ratio = Math.max(0, Math.min(1, (this.hud.bossHealth ?? 0) / this.hud.bossMax));
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = this.palette.enemy;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, pad, w, h);
      ctx.fillStyle = this.palette.enemy;
      ctx.fillRect(x, pad, w * ratio, h);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "right";
      ctx.fillText(`BOSS ${this.hud.bossHealth ?? 0}/${this.hud.bossMax}`, x + w, pad + h + 9 * s);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  drawPortal(fx, fy, color) {
    const ctx = this.ctx;
    const p = this.project(fx, fy, this.elevationAt(fx, fy));
    const s = this.view.scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE_W * 0.55 * s, TILE_H * 0.55 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE_W * 0.38 * s, TILE_H * 0.38 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawNode(node, captured) {
    const ctx = this.ctx;
    const base = this.project(node.x, node.y, this.elevationAt(node.x, node.y));
    const s = this.view.scale;
    const h = 26 * s;
    const color = captured ? this.palette.node : "#71829b";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = captured ? 0.9 : 0.46;
    if (captured) ctx.fillRect(base.x - 4 * s, base.y - h, 8 * s, h);
    else ctx.strokeRect(base.x - 4 * s, base.y - h, 8 * s, h);
    ctx.globalAlpha = captured ? 0.35 : 0.15;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 16 * s, 8 * s, 0, 0, Math.PI * 2);
    captured ? ctx.fill() : ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawBoss() {
    const ctx = this.ctx;
    const p = this.project(BOSS_TILE.x, BOSS_TILE.y, this.elevationAt(BOSS_TILE.x, BOSS_TILE.y));
    const s = this.view.scale;
    if (this.bossImage) {
      const w = 72 * s;
      const h = w * (this.bossImage.height / this.bossImage.width);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4 * s, 30 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(this.bossImage, p.x - w / 2, p.y - h + 6 * s, w, h);
    } else {
      ctx.fillStyle = this.palette.enemy;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 52 * s);
      ctx.lineTo(p.x + 20 * s, p.y);
      ctx.lineTo(p.x - 20 * s, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawUnit(unit, kind) {
    const ctx = this.ctx;
    const z = this.elevationAt(unit.x, unit.y);
    const p = this.project(unit.x, unit.y, z);
    const s = this.view.scale;

    if (this.selection.has(unit)) {
      ctx.strokeStyle = "#f4f7ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2 * s, 15 * s, 7.5 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const atlas = this.unitAtlas;
    if (!atlas) return;

    const size = 64 * s * (kind === "enemy" && unit.archetype === "reinforce" ? 1.18 : 1);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3 * s, size * 0.2, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    const phase = this.reducedMotion ? 0 : Math.floor(this.lastTime / (1000 / UNIT_ATLAS.fps)) % 2;
    const frame = this.atlasFacing(unit.facing) * 2 + phase;
    const sourceX = UNIT_ATLAS.padding + (frame % 4) * UNIT_ATLAS.stride;
    const sourceY = UNIT_ATLAS.padding + Math.floor(frame / 4) * UNIT_ATLAS.stride;
    const left = p.x - size / 2;
    const top = p.y - size * 0.86;
    ctx.drawImage(atlas, sourceX, sourceY, UNIT_ATLAS.framePx, UNIT_ATLAS.framePx, left, top, size, size);

    const tint = kind === "possessed" ? this.palette.allyPossessed : kind === "enemy" ? this.palette.enemy : this.palette.ally;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = tint;
    ctx.fillRect(left, top, size, size);
    ctx.restore();

    const angle = -unit.facing * (Math.PI / 4);
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 14 * s);
    ctx.lineTo(p.x + Math.cos(angle) * 8 * s, p.y - 14 * s + Math.sin(angle) * 4 * s);
    ctx.stroke();
  }

  drawParticle(p, blend) {
    const ctx = this.ctx;
    const pos = this.project(p.x, p.y, 0);
    const s = this.view.scale;
    ctx.save();
    ctx.globalCompositeOperation = blend === "additive" ? "lighter" : "source-over";
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.fillRect(pos.x - 2 * s, pos.y - p.z * ELEV_H * s - 2 * s, 4 * s, 4 * s);
    ctx.restore();
  }

  drawDomain() {
    const ctx = this.ctx;
    const p = this.project(ALLY_SPAWN.x + 1, ALLY_SPAWN.y, 0);
    const s = this.view.scale;
    const r = (this.reducedMotion ? 1.2 : 1.2 + Math.sin(performance.now() / 300) * 0.08) * TILE_W * s;
    ctx.strokeStyle = this.palette.domain;
    ctx.globalAlpha = Math.min(0.7, this.domainLife / 2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ELEV_H * s, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawOrderFlag() {
    const ctx = this.ctx;
    const p = this.project(this.orderFlag.x, this.orderFlag.y, this.elevationAt(this.orderFlag.x, this.orderFlag.y));
    const s = this.view.scale;
    ctx.globalAlpha = Math.min(1, this.orderFlag.life);
    ctx.strokeStyle = "#f4f7ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 18 * s);
    ctx.lineTo(p.x + 10 * s, p.y - 14 * s);
    ctx.lineTo(p.x, p.y - 10 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawDragRect() {
    const ctx = this.ctx;
    const r = this.dragRect;
    ctx.strokeStyle = "rgba(112, 229, 208, 0.9)";
    ctx.fillStyle = "rgba(112, 229, 208, 0.12)";
    ctx.lineWidth = 1;
    const x = Math.min(r.x0, r.x1);
    const y = Math.min(r.y0, r.y1);
    const w = Math.abs(r.x1 - r.x0);
    const h = Math.abs(r.y1 - r.y0);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  // --- loop -----------------------------------------------------------------

  animate() {
    if (this.destroyed || this.reducedMotion) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const now = performance.now();
    // Preserve real-time enemy travel through a slow frame without allowing one
    // large physics step to tunnel through a clash or breach line.
    const elapsed = Math.min((now - this.lastTime) / 1000, 1);
    this.lastTime = now;
    const substeps = Math.max(1, Math.ceil(elapsed / 0.05));
    const dt = elapsed / substeps;

    for (let step = 0; step < substeps; step += 1) {
      this.aiAccumulator += dt * 1000;
      if (this.aiAccumulator >= AI_TICK_MS) {
        this.aiAccumulator = 0;
        // AI tick slot (250ms): archetype decisions are cheap and framerate-independent.
      }

      this.updateUnits(dt);
      this.updateParticles(dt);
      if (this.breachFlash > 0) this.breachFlash = Math.max(0, this.breachFlash - dt * 1.6);
    }
    this.render();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    if (this.pointerHandlers) {
      this.canvas?.removeEventListener("pointerdown", this.pointerHandlers.down);
      this.canvas?.removeEventListener("pointermove", this.pointerHandlers.move);
      this.canvas?.removeEventListener("pointerup", this.pointerHandlers.up);
      this.canvas?.removeEventListener("pointercancel", this.pointerHandlers.cancel);
    }
    window.clearTimeout(this.assaultTimer);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.audio?.ctx?.close?.().catch?.(() => undefined);

    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.nodes = [];
    this.selection.clear();
    this.unitAtlas = null;
    this.staticChunks.clear();
    this.terrainTiles = [];
    this.occluderTiles = [];
    this.bossImage = null;
    this.pointerHandlers = null;
    this.resizeHandler = null;
    this.assaultTimer = 0;
    this.animationFrameId = null;
    this.audio = null;
    this.ctx = null;
    this.canvas = null;
  }
}
