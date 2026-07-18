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
import {
  STAGE_GRID_WIDTH as GRID_W,
  STAGE_GRID_HEIGHT as GRID_H,
  createStageNavigation,
} from "./stage-navigation.js";
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
  3: "assets/images/battle/sovereign-atlas.png",
  // Stages 4-10: dedicated field atlases are unbudgeted this cycle, so the
  // fallback renderer uses each stage's own shipped boss portrait instead of
  // a reused Stage 1-3 field piece, keeping boss identity G1-consistent.
  4: "assets/images/ui/boss-tide-warden.png",
  5: "assets/images/ui/boss-pack-herald.png",
  6: "assets/images/ui/boss-requiem-choir.png",
  7: "assets/images/ui/boss-lantern-tyrant.png",
  8: "assets/images/ui/boss-bridge-colossus.png",
  9: "assets/images/ui/boss-veiled-concordat.png",
  10: "assets/images/ui/boss-abyss-regent.png"
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

// Blender output is raster-only at runtime: no GLB parser, WebGL context, or
// external dependency enters the Canvas renderer. The manifest is the sole
// contract between the generator and this bridge.
const GLB_BRIDGE_MANIFEST = "assets/images/battle/glb/manifest.json";
// Stages 4-10 reuse a Stage 1-3 terrain plate (matches STAGE_ASSETS terrain
// reuse in battle-realtime-three.js so both renderers agree on ground art;
// terrain reuse carries no boss-identity claim). See BOSS_ART above for the
// per-stage boss art that keeps identity distinct.
const BRIDGE_STAGE_TERRAIN = Object.freeze({
  1: "cinder-span", 2: "veil-citadel", 3: "echo-throne-steps",
  4: "veil-citadel", 5: "cinder-span", 6: "veil-citadel",
  7: "cinder-span", 8: "echo-throne-steps", 9: "veil-citadel", 10: "echo-throne-steps"
});
const BRIDGE_STAGE_BOSS = Object.freeze({ 1: "cinder-warden", 2: "veil-tactician", 3: "gate-sovereign" });
const BRIDGE_ACTION_AUDIO = Object.freeze({
  hunt: { type: "triangle", source: 320, target: 760, duration: 0.18, gain: 0.48 },
  extract: { type: "sine", source: 760, target: 260, duration: 0.28, gain: 0.58 },
  materialize: { type: "sine", source: 150, target: 560, duration: 0.34, gain: 0.72 },
  capture: { type: "square", source: 240, target: 420, duration: 0.3, gain: 0.5 },
  possess: { type: "sine", source: 300, target: 880, duration: 0.32, gain: 0.58 },
  domain: { type: "triangle", source: 110, target: 340, duration: 0.5, gain: 0.72 },
  assault: { type: "sawtooth", source: 210, target: 84, duration: 0.42, gain: 0.68 },
});

function bridgeKey(assetId, clip) {
  return `${assetId}::${clip}`;
}

function isBridgeRecord(record) {
  return Boolean(
    record &&
    typeof record.assetId === "string" &&
    typeof record.category === "string" &&
    typeof record.kind === "string" &&
    typeof record.output?.path === "string" &&
    record.output.path.startsWith("assets/images/battle/glb/") &&
    Number.isFinite(record.output.width) &&
    Number.isFinite(record.output.height) &&
    record.output.width > 0 &&
    record.output.height > 0,
  );
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
    this.engagements = new Map();
    this.exchanges = 0;
    this.authoritativeLegion = null;
    this.particles = [];
    this.nodes = [];        // {x, y}
    this.nodeGoal = Math.max(1, Number.isInteger(options.nodeGoal) ? options.nodeGoal : 1);
    this.onTacticalLayout = typeof options.onTacticalLayout === "function" ? options.onTacticalLayout : null;
    this.onActionRequest = typeof options.onActionRequest === "function" ? options.onActionRequest : null;
    this.getAvailableActions = typeof options.getAvailableActions === "function" ? options.getAvailableActions : null;
    this.orderFlag = null;  // {x, y, life}
    this.waveCounter = 0;
    this.onEncounterEvent = typeof options.onEncounterEvent === "function" ? options.onEncounterEvent : null;
    this.onRuntimeState = typeof options.onRuntimeState === "function" ? options.onRuntimeState : null;
    this.onEnemyBreach = null; // Legacy callback; encounter events take precedence.
    this.encounter = null;
    this.encounterSnapshot = null;
    this.currentWaveId = null;
    this.pendingEncounterEvent = null;
    this.bossExposed = false;
    this.runtimeSignature = null;
    this.breachFlash = 0;
    this.hud = null;


    this.navigation = createStageNavigation(this.stageNumber);
    this.rng = mulberry32(0x5eed + this.stageNumber * 977);

    this.view = { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 };
    this.terrainMode = TILEMAP_RENDER_MODE.CHUNK;
    this.staticChunks = new Map();
    this.terrainTiles = [];
    this.occluderTiles = [];
    this.unitAtlases = new Map();
    this.bossImage = null;
    this.bridge = {
      state: "pending",
      records: new Map(),
      images: new Map(),
      total: 0,
      loaded: 0,
    };
    this.bridgeGeneration = 0;
    this.onAssetStatus = typeof options.onAssetStatus === "function" ? options.onAssetStatus : null;
    this.actionFx = [];
    this.actionFeedbackTimer = null;

    this.selection = new Set();
    this.dragRect = null;     // {x0,y0,x1,y1} in canvas px
    this.pointerDown = null;
    this.pointerHandlers = null;
    this.resizeHandler = null;

    this.audio = null;        // { ctx, master }
  }

  // --- terrain helpers -------------------------------------------------

  heightAt(x, y) {
    return this.navigation.heightAt(x, y);
  }

  walkable(x, y) {
    return this.navigation.walkable(x, y);
  }

  climbOk(x0, y0, x1, y1) {
    return this.navigation.climbOk(x0, y0, x1, y1);
  }

  elevationAt(fx, fy) {
    return this.navigation.elevationAt(fx, fy);
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
    if (Number.isInteger(this.authoritativeLegion)) this.reconcileAllies(this.authoritativeLegion);
    this.computeView();
    this.buildStaticLayer();
    this.loadBossArt();
    this.loadUnitAtlas();
    void this.loadBridgeAssets();
    this.attachPointerHandlers();

    this.resizeHandler = () => {
      if (this.destroyed) return;
      this.computeView();
      this.buildStaticLayer();
      this.renderStatic();
    };
    window.addEventListener("resize", this.resizeHandler);

    this.lastTime = performance.now();
    this.reconcileEncounterWave();
    this.publishRuntimeState();
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

  tacticalActionAt(canvasPoint) {
    if (!this.onActionRequest || !this.getAvailableActions) return null;
    const available = new Set(this.getAvailableActions());
    const candidates = [
      { action: "materialize", point: this.actionPoint("portal") },
      ...(this.nodes.length < this.nodeGoal ? [{ action: "capture", point: this.actionPoint("node") }] : []),
      ...(this.bossExposed ? [{ action: "assault", point: this.actionPoint("boss") }] : []),
    ];
    const radius = Math.max(16, this.view.scale * 0.6);
    let hit = null;
    let distance = radius * radius;
    for (const candidate of candidates) {
      if (!available.has(candidate.action)) continue;
      const point = candidate.point;
      const screen = this.project(point.x, point.y, this.elevationAt(point.x, point.y));
      const dx = canvasPoint.x - screen.x;
      const dy = canvasPoint.y - screen.y;
      const squared = dx * dx + dy * dy;
      if (squared <= distance) {
        hit = candidate.action;
        distance = squared;
      }
    }
    return hit;
  }

  requestTacticalActionAt(canvasPoint) {
    const action = this.tacticalActionAt(canvasPoint);
    if (!action) return false;
    this.onActionRequest(action);
    return true;
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
        const z = this.heightAt(x, y);
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

  isBridgeLoadCurrent(generation) {
    return !this.destroyed && generation === this.bridgeGeneration;
  }

  reportAssetStatus(generation = this.bridgeGeneration) {
    if (!this.isBridgeLoadCurrent(generation)) return;
    this.onAssetStatus?.({
      state: this.bridge.state,
      loaded: this.bridge.loaded,
      total: this.bridge.total,
      clips: [...this.bridge.records.values()].filter((record) => record.kind === "actionAtlas").length,
    });
  }

  async loadBridgeAssets() {
    const generation = ++this.bridgeGeneration;
    this.bridge.state = "loading";
    this.bridge.records.clear();
    this.bridge.images.clear();
    this.bridge.total = 0;
    this.bridge.loaded = 0;
    this.reportAssetStatus(generation);
    try {
      const response = await fetch(GLB_BRIDGE_MANIFEST, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const manifest = await response.json();
      if (!this.isBridgeLoadCurrent(generation)) return;
      if (
        manifest?.generationVersion !== "glb-raster-pack-v1" ||
        !Array.isArray(manifest.records) ||
        manifest?.atlasLayout?.actionColumns !== 8 ||
        manifest?.atlasLayout?.actionRows !== 4
      ) throw new Error("unexpected manifest");

      const records = manifest.records.filter(isBridgeRecord);
      if (records.length === 0) throw new Error("no bridge records");
      this.bridge.records = new Map(records.map((record) => [
        bridgeKey(record.assetId, record.clip ?? "plate"),
        record,
      ]));
      this.bridge.total = records.length;
      this.reportAssetStatus(generation);
      await Promise.all(records.map((record) => this.loadBridgeImage(record, generation)));
      if (!this.isBridgeLoadCurrent(generation)) return;
      this.bridge.state = this.bridge.loaded === records.length ? "loaded" : this.bridge.loaded ? "partial" : "unavailable";
    } catch {
      if (!this.isBridgeLoadCurrent(generation)) return;
      this.bridge.state = "unavailable";
    }
    if (!this.isBridgeLoadCurrent(generation)) return;
    this.reportAssetStatus(generation);
    this.render();
  }

  loadBridgeImage(record, generation) {
    const path = record.output.path;
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.includes("/assets/images/battle/glb/")) return Promise.resolve(false);
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (!this.isBridgeLoadCurrent(generation)) {
          resolve(false);
          return;
        }
        this.bridge.images.set(bridgeKey(record.assetId, record.clip ?? "plate"), image);
        this.bridge.loaded += 1;
        this.reportAssetStatus(generation);
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = url.href;
    });
  }

  bridgeAtlas(assetId, clip) {
    const key = bridgeKey(assetId, clip);
    const record = this.bridge.records.get(key);
    const image = this.bridge.images.get(key);
    return record && image ? { record, image } : null;
  }

  hasBridgeAtlas(assetId, clip) {
    return Boolean(this.bridgeAtlas(assetId, clip));
  }

  drawBridgeAtlas(assetId, clip, facing, p, size) {
    const atlas = this.bridgeAtlas(assetId, clip);
    if (!atlas) return false;
    const { record, image } = atlas;
    const columns = record.layout?.columns ?? 8;
    const rows = record.layout?.rows ?? 4;
    const cellWidth = record.layout?.cellWidth ?? image.naturalWidth / columns;
    const cellHeight = record.layout?.cellHeight ?? image.naturalHeight / rows;
    if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || columns < 1 || rows < 1) return false;
    const direction = this.atlasFacing(facing) % columns;
    const phase = this.reducedMotion ? 0 : Math.floor(this.lastTime / 125) % rows;
    this.ctx.drawImage(
      image,
      direction * cellWidth,
      phase * cellHeight,
      cellWidth,
      cellHeight,
      p.x - size / 2,
      p.y - size * 0.9,
      size,
      size,
    );
    return true;
  }

  bridgeTerrainPlacement() {
    const atlas = this.bridgeAtlas(BRIDGE_STAGE_TERRAIN[this.stageNumber], "plate");
    if (!atlas?.image.complete || atlas.image.naturalWidth < 1 || atlas.image.naturalHeight < 1) return null;
    const corners = [
      this.project(0, 0, 0),
      this.project(GRID_W, 0, 0),
      this.project(GRID_W, GRID_H, 0),
      this.project(0, GRID_H, 0),
    ];
    const left = Math.min(...corners.map((corner) => corner.x));
    const right = Math.max(...corners.map((corner) => corner.x));
    const top = Math.min(...corners.map((corner) => corner.y));
    const bottom = Math.max(...corners.map((corner) => corner.y));
    const size = Math.max(right - left, bottom - top);
    if (!Number.isFinite(size) || size <= 0) return null;
    return { image: atlas.image, corners, left, right, top, bottom, size };
  }

  drawBridgeTerrain(terrain = this.bridgeTerrainPlacement()) {
    if (!terrain) return;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(terrain.corners[0].x, terrain.corners[0].y);
    for (let index = 1; index < terrain.corners.length; index += 1) {
      this.ctx.lineTo(terrain.corners[index].x, terrain.corners[index].y);
    }
    this.ctx.closePath();
    this.ctx.clip();
    this.ctx.globalAlpha = 0.32;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.drawImage(
      terrain.image,
      (terrain.left + terrain.right - terrain.size) / 2,
      (terrain.top + terrain.bottom - terrain.size) / 2,
      terrain.size,
      terrain.size,
    );
    this.ctx.restore();
  }

  drawBridgeTerrainTile(tile, terrain) {
    if (!terrain || tile.z < 0) return;
    const s = this.view.scale;
    const hw = (TILE_W / 2) * s;
    const hh = (TILE_H / 2) * s;
    const top = this.project(tile.x + 0.5, tile.y + 0.5, tile.z);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(top.x, top.y - hh);
    this.ctx.lineTo(top.x + hw, top.y);
    this.ctx.lineTo(top.x, top.y + hh);
    this.ctx.lineTo(top.x - hw, top.y);
    this.ctx.closePath();
    this.ctx.clip();
    this.ctx.globalAlpha = 0.32;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.drawImage(
      terrain.image,
      (terrain.left + terrain.right - terrain.size) / 2,
      (terrain.top + terrain.bottom - terrain.size) / 2,
      terrain.size,
      terrain.size,
    );
    this.ctx.restore();
  }


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

  // One manifest-proven conceptual 4×4 atlas, loaded once for every battle.
  // The red hostile source stays original; ally and possessed variants are
  // rasterized once onto transparent canvases, never recolored per frame.
  loadUnitAtlas() {
    const img = new Image();
    img.onload = () => {
      if (this.destroyed) return;
      this.unitAtlases.set("enemy", img);
      this.unitAtlases.set("ally", this.tintUnitAtlas(img, this.palette.ally));
      this.unitAtlases.set("possessed", this.tintUnitAtlas(img, this.palette.allyPossessed));
      this.render();
    };
    img.onerror = () => undefined;
    img.src = UNIT_ATLAS.src;
  }

  tintUnitAtlas(image, tint) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }


  // World-facing sector (directionIndex: 0 = +x world = screen SE, CCW) ->
  // conceptual atlas facing. The rings differ by a quarter-plus-eighth turn.
  atlasFacing(facing) {
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
  playSpatial(fx, fy, { freq = 320, endFreq = freq, duration = 0.18, delay = 0, type = "triangle", gain = 1 } = {}) {
    const audio = this.ensureAudio();
    if (!audio || audio.ctx.state === "closed") return;
    const play = () => {
      if (this.destroyed || this.audio !== audio || audio.ctx.state !== "running") return;
      const p = this.project(fx, fy, this.elevationAt(fx, fy));
      const cx = this.view.width / 2;
      const focusY = this.view.height * 0.42; // biased above center per the report
      const pan = Math.max(-1, Math.min(1, (p.x - cx) / (this.view.width / 2)));
      const vertical = (p.y - focusY) / this.view.height; // <0 above focus, >0 below
      const proximity = Math.max(0.25, Math.min(1.2, 1 + vertical * 0.9));
      const t = audio.ctx.currentTime + delay;
      const osc = audio.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration * 0.78);
      const env = audio.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.28 * gain * proximity, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      const panner = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
      let tail = env;
      if (vertical < -0.05) {
        // Above focus: distant — low-pass filter (psychoacoustic damping).
        const lowPass = audio.ctx.createBiquadFilter();
        lowPass.type = "lowpass";
        lowPass.frequency.value = 900 + 2200 * Math.max(0, 1 + vertical);
        env.connect(lowPass);
        tail = lowPass;
      }
      if (panner) {
        panner.pan.value = pan;
        tail.connect(panner);
        panner.connect(audio.master);
      } else {
        tail.connect(audio.master);
      }
      osc.connect(env);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    };
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume().then(play).catch(() => undefined);
      return;
    }
    play();
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
      } else if (!this.requestTacticalActionAt(p) && this.selection.size > 0) {
        // A target command takes priority over selected-unit move orders.
        const tile = this.unprojectToTile(p.x, p.y);
        if (tile && this.walkable(tile.x, tile.y)) {
          this.issueMoveOrder(tile);
          this.orderFlag = { x: tile.x + 0.5, y: tile.y + 0.5, life: 1.2 };
          this.playSpatial(tile.x + 0.5, tile.y + 0.5, { freq: 520, duration: 0.12, type: "sine", gain: 0.6 });
        }
      } else if (this.selection.size === 0) {
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

  actionPoint(point) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
    if (point === "portal") return ALLY_SPAWN;
    if (point === "ally") return this.allies[0] ?? ALLY_SPAWN;
    if (point === "boss") return BOSS_TILE;
    if (point === "extractor") return { x: 6, y: 3.5 };
    if (point === "node") return this.nodePosition(Math.min(this.nodeGoal, this.nodes.length + 1));
    return ALLY_SPAWN;
  }

  setBridgeClip(assetId, clip, duration = 780) {
    const until = performance.now() + duration;
    for (const unit of this.allies) {
      const unitAsset = unit.isPossessed ? "possessed" : "shade";
      if (unitAsset === assetId) {
        unit.bridgeClip = clip;
        unit.bridgeClipUntil = until;
      }
    }
    for (const unit of this.enemies) {
      if (unit.archetype === assetId) {
        unit.bridgeClip = clip;
        unit.bridgeClipUntil = until;
      }
    }
  }

  playActionGesture(action, source, target) {
    const profile = BRIDGE_ACTION_AUDIO[action];
    if (!profile) return;
    this.playSpatial(source.x, source.y, {
      freq: profile.source,
      endFreq: profile.target,
      duration: profile.duration,
      type: profile.type,
      gain: profile.gain,
    });
    if (source.x !== target.x || source.y !== target.y) {
      this.playSpatial(target.x, target.y, {
        freq: Math.max(60, profile.target * 0.72),
        endFreq: Math.max(60, profile.source * 0.7),
        duration: profile.duration * 0.7,
        delay: 0.075,
        type: profile.type,
        gain: profile.gain * 0.62,
      });
    }
  }

  applyEncounter({ stageId, config, state } = {}) {
    const waves = Array.isArray(config?.waves) ? config.waves : null;
    const activeWaveId = typeof state?.activeWaveId === "string" ? state.activeWaveId : null;
    const snapshot = JSON.stringify({
      stageId: typeof stageId === "string" ? stageId : null,
      activeWaveId,
      bossExposed: state?.bossExposed === true,
      waves: Array.isArray(state?.waves)
        ? state.waves.map((wave) => ({ id: wave?.id, cleared: wave?.cleared === true, breaches: Number(wave?.breaches) || 0 }))
        : [],
    });
    if (this.encounterSnapshot !== null && this.encounterSnapshot !== snapshot) this.pendingEncounterEvent = null;
    this.encounterSnapshot = snapshot;
    this.encounter = waves ? { stageId, config, state } : null;
    this.bossExposed = state?.bossExposed === true;
    this.reconcileEncounterWave(activeWaveId);
    this.publishRuntimeState();
    this.renderStatic();
  }

  applyCampaignState({ campaign, stage, encounter, state } = {}) {
    const config = encounter?.config ?? stage?.encounter ?? null;
    const encounterState = encounter?.state ?? state?.encounter ?? state ?? campaign?.stage?.encounter ?? encounter ?? null;
    const stageId = encounter?.stageId ?? stage?.id ?? campaign?.stageId ?? null;
    const legion = Number(state?.legion ?? campaign?.stage?.legion);
    if (Number.isInteger(legion) && legion >= 0) {
      this.authoritativeLegion = legion;
      this.reconcileAllies(legion);
    }
    this.applyEncounter({ stageId, config, state: encounterState });
  }

  reconcileEncounterWave(activeWaveId = this.encounter?.state?.activeWaveId ?? null) {
    const wave = this.encounter?.config?.waves?.find((candidate) => candidate?.id === activeWaveId);
    if (!wave || this.currentWaveId !== wave.id) {
      this.clearEncounterWave();
      if (!wave || !this.ctx) return;
      this.currentWaveId = wave.id;
      this.spawnEncounterWave(wave);
    }
  }

  clearEncounterWave() {
    for (const enemy of this.enemies) this.clearEngagement(enemy);
    this.enemies = [];
    this.currentWaveId = null;
  }

  spawnAlly(count = 1) {
    const additions = Math.max(0, Number(count) || 0);
    for (let index = 0; index < additions; index += 1) {
      const unit = {
        x: ALLY_SPAWN.x + (this.allies.length % 3) * 0.34,
        y: ALLY_SPAWN.y + ((this.allies.length % 3) - 1) * 0.45,
        speed: 1.2 + this.rng() * 0.25,
        hp: 3,
        facing: 0,
        path: null,
        holdUntil: 0,
        isPossessed: false,
        defeated: false,
      };
      this.allies.push(unit);
      this.burst(unit.x, unit.y, 8, this.palette.ally);
    }
  }

  reconcileAllies(count) {
    if (!this.ctx) return;
    const target = Math.max(0, count);
    const survivors = [];
    for (const ally of this.allies) {
      if (ally.defeated) {
        this.clearEngagement(ally);
        this.selection.delete(ally);
      } else {
        survivors.push(ally);
      }
    }
    this.allies = survivors;
    while (this.allies.length > target) {
      const ally = this.allies.pop();
      this.clearEngagement(ally);
      this.selection.delete(ally);
    }
    this.spawnAlly(target - this.allies.length);
  }

  spawnEncounterWave(wave) {
    const count = Math.max(0, Number(wave?.hostiles) || 0);
    const archetype = wave.id === "reinforcement" ? "reinforce" : wave.id;
    for (let index = 0; index < count; index += 1) {
      const unit = {
        x: BOSS_TILE.x - 0.5 - this.rng() * 0.5,
        y: BOSS_TILE.y + (this.rng() - 0.5) * 2.4,
        speed: archetype === "scout" ? 1.5 + this.rng() * 0.4 : 0.9 + this.rng() * 0.4,
        hp: Math.max(1, Number(wave.hostileHealth) || 2),
        archetype,
        waveId: wave.id,
        laneY: archetype === "scout" ? (this.rng() > 0.5 ? 1.6 : GRID_H - 2.6) : BOSS_TILE.y + (this.rng() - 0.5) * 1.6,
        facing: 4,
        defeated: false,
        breachVisualized: false,
      };
      this.enemies.push(unit);
      this.burst(unit.x, unit.y, 8, this.palette.enemy);
    }
    this.playSpatial(BOSS_TILE.x, BOSS_TILE.y, { freq: 180, type: "sawtooth", duration: 0.3, gain: 0.8 });
  }

  emitEncounterEvent(type) {
    const waveId = this.currentWaveId;
    const stageId = this.encounter?.stageId;
    if (
      this.pendingEncounterEvent ||
      (type !== "wave-cleared" && type !== "breach") ||
      !waveId ||
      typeof stageId !== "string" ||
      this.encounter?.state?.activeWaveId !== waveId
    ) return;
    this.pendingEncounterEvent = { type, stageId, waveId };
    if (this.onEncounterEvent) this.onEncounterEvent(this.pendingEncounterEvent);
    else if (type === "breach") this.onEnemyBreach?.();
  }

  activeEngagements() {
    let count = 0;
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (enemy && this.engagements.get(enemy) === ally && this.liveAlly(ally) && this.liveEnemy(enemy)) count += 1;
    }
    return count;
  }

  getRuntimeState() {
    const total = this.encounter?.config?.waves?.length ?? 0;
    const resolved = this.encounter?.state?.waves?.filter((wave) => wave?.cleared === true).length ?? 0;
    return {
      mode: "canvas-2d",
      enemiesActive: this.enemies.length,
      alliesVisible: this.allies.filter((ally) => !ally.defeated).length,
      engagements: this.activeEngagements(),
      exchanges: this.exchanges,
      activeWaveId: this.encounter?.state?.activeWaveId ?? null,
      resolved,
      total,
      bossExposed: this.bossExposed,
    };
  }

  publishRuntimeState() {
    const runtime = this.getRuntimeState();
    const signature = JSON.stringify(runtime);
    if (signature === this.runtimeSignature) return;
    this.runtimeSignature = signature;
    this.onRuntimeState?.(runtime);
  }

  playActionEffect(semantic = {}) {
    const action = semantic?.action;
    if (!action || this.destroyed) return;
    const source = this.actionPoint(semantic.source);
    const target = this.actionPoint(semantic.target);
    const sourceAvailable = this.hasBridgeAtlas(semantic.sourceAsset, semantic.clip);
    this.playActionGesture(action, source, target);
    const effect = { action, source, target, sourceAsset: semantic.sourceAsset, clip: semantic.clip, life: 0.8, duration: 0.8 };
    if (this.reducedMotion) {
      this.actionFx = [effect];
      const clear = window.clearTimeout ?? globalThis.clearTimeout;
      if (this.actionFeedbackTimer !== null) clear(this.actionFeedbackTimer);
      const schedule = window.setTimeout ?? globalThis.setTimeout;
      this.actionFeedbackTimer = schedule(() => {
        if (this.destroyed) return;
        this.actionFx = [];
        this.actionFeedbackTimer = null;
        this.render();
      }, 700);
    } else {
      this.actionFx.push(effect);
    }
    if (sourceAvailable) this.setBridgeClip(semantic.sourceAsset, semantic.clip);
    this.publishRuntimeState();
    this.renderStatic();
    if (this.reducedMotion) this.render();
  }

  triggerAction(semantic) {
    this.playActionEffect(semantic);
  }

  // Compatibility wrapper: visual effects must not establish encounter units.
  spawnEnemy() {
    this.playActionEffect({ action: "hunt", source: "portal", target: "extractor" });
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

  liveAlly(unit) {
    return !unit.defeated;
  }

  liveEnemy(unit) {
    return !unit.defeated && !unit.breachVisualized;
  }

  clearEngagement(unit) {
    const mate = this.engagements.get(unit);
    if (!mate) return;
    this.engagements.delete(unit);
    if (this.engagements.get(mate) === unit) this.engagements.delete(mate);
  }

  bindEngagement(ally, enemy) {
    if (!this.liveAlly(ally) || !this.liveEnemy(enemy)) return false;
    const allyMate = this.engagements.get(ally);
    const enemyMate = this.engagements.get(enemy);
    if (allyMate === enemy && enemyMate === ally) return true;
    if (allyMate || enemyMate) return false;
    this.engagements.set(ally, enemy);
    this.engagements.set(enemy, ally);
    return true;
  }

  reconcileEngagements() {
    for (const [unit, mate] of this.engagements) {
      const unitIsAlly = this.allies.includes(unit);
      const mateIsAlly = this.allies.includes(mate);
      if (
        this.engagements.get(mate) !== unit ||
        (unitIsAlly ? !this.liveAlly(unit) : !this.liveEnemy(unit)) ||
        (mateIsAlly ? !this.liveAlly(mate) : !this.liveEnemy(mate))
      ) this.clearEngagement(unit);
    }
  }

  selectEngagements() {
    const contactSquared = CLASH_DIST * CLASH_DIST;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      let nearest = null;
      let closest = contactSquared;
      for (const enemy of this.enemies) {
        if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
        const dx = enemy.x - ally.x;
        const dy = enemy.y - ally.y;
        const distance = dx * dx + dy * dy;
        if (distance <= closest) {
          closest = distance;
          nearest = enemy;
        }
      }
      if (nearest) this.bindEngagement(ally, nearest);
    }
  }

  clampMovementToContact(unit, x, y, allySide) {
    const startX = unit.x;
    const startY = unit.y;
    const dx = x - startX;
    const dy = y - startY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= 0.000001) return false;
    const opponents = allySide ? this.enemies : this.allies;
    let firstContact = 1;
    let mate = null;
    for (const opponent of opponents) {
      if (allySide ? !this.liveEnemy(opponent) : !this.liveAlly(opponent)) continue;
      const fromX = startX - opponent.x;
      const fromY = startY - opponent.y;
      const contact = fromX * fromX + fromY * fromY - CLASH_DIST * CLASH_DIST;
      if (contact <= 0) {
        firstContact = 0;
        mate = opponent;
        break;
      }
      const projection = 2 * (fromX * dx + fromY * dy);
      const discriminant = projection * projection - 4 * distanceSquared * contact;
      if (discriminant < 0) continue;
      const at = (-projection - Math.sqrt(discriminant)) / (2 * distanceSquared);
      if (at >= 0 && at <= firstContact) {
        firstContact = at;
        mate = opponent;
      }
    }
    if (!mate) return false;
    const stop = Math.max(0, firstContact - 0.0001);
    unit.x = startX + dx * stop;
    unit.y = startY + dy * stop;
    if (allySide) this.bindEngagement(unit, mate);
    else this.bindEngagement(mate, unit);
    return true;
  }

  nearestEnemy(unit, range) {
    let best = null;
    let bestD = range * range;
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      const dx = enemy.x - unit.x;
      const dy = enemy.y - unit.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    return best;
  }

  updateEngagements(dt) {
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (!enemy || this.engagements.get(enemy) !== ally || !this.liveAlly(ally) || !this.liveEnemy(enemy)) continue;
      ally.clashCd = Math.max(0, (ally.clashCd ?? 0) - dt);
      enemy.clashCd = Math.max(0, (enemy.clashCd ?? 0) - dt);
      if (ally.clashCd !== 0 || enemy.clashCd !== 0) continue;
      this.burst(ally.x, ally.y, 4, this.palette.spark);
      this.playSpatial(ally.x, ally.y, { freq: 480, type: "triangle", duration: 0.1, gain: 0.5 });
      ally.hp -= 1;
      enemy.hp -= 1;
      ally.clashCd = CLASH_TICK_S;
      enemy.clashCd = CLASH_TICK_S;
      this.exchanges += 1;
      if (enemy.hp <= 0) {
        enemy.defeated = true;
        this.clearEngagement(enemy);
      }
      if (ally.hp <= 0) {
        ally.defeated = true;
        this.selection.delete(ally);
        this.clearEngagement(ally);
      }
    }
  }

  // --- simulation ---------------------------------------------------------

  updateUnits(dt) {
    this.reconcileEngagements();
    this.selectEngagements();
    this.updateEngagements(dt);
    this.reconcileEngagements();

    for (const ally of this.allies) {
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      let target = null;
      if (ally.path?.length) {
        target = ally.path[0];
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        if (dx * dx + dy * dy < 0.05) {
          ally.path.shift();
          if (ally.path.length === 0) ally.path = null;
        }
      } else {
        const prey = this.nearestEnemy(ally, INTERCEPT_RANGE);
        if (prey) target = { x: prey.x, y: prey.y };
        else if (performance.now() >= ally.holdUntil && Math.abs(ally.x - PICKET_X) > 0.25) target = { x: PICKET_X, y: ally.y };
      }
      if (!target) continue;
      const magnitude = Math.hypot(target.x - ally.x, target.y - ally.y) || 1;
      const velocity = steer(ally, {
        x: ((target.x - ally.x) / magnitude) * ally.speed,
        y: ((target.y - ally.y) / magnitude) * ally.speed,
      }, this.allies.filter((candidate) => !candidate.defeated));
      const nextX = ally.x + velocity.x * dt;
      const nextY = Math.max(0.4, Math.min(GRID_H - 0.4, ally.y + velocity.y * dt));
      const blocked = this.clampMovementToContact(ally, nextX, nextY, true);
      if (!blocked) {
        ally.x = nextX;
        ally.y = nextY;
      }
      ally.facing = directionIndex(velocity.x, velocity.y);
    }

    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      const preferred = { x: -enemy.speed, y: 0 };
      if (enemy.archetype === "scout" && enemy.x > 5) preferred.y = (enemy.laneY - enemy.y) * 1.2;
      else if (enemy.x <= 5) preferred.y = (BOSS_TILE.y - enemy.y) * 0.6;
      const velocity = steer(enemy, preferred, this.enemies.filter((candidate) => !candidate.defeated && !candidate.breachVisualized));
      const nextX = enemy.x + velocity.x * dt;
      const nextY = Math.max(0.4, Math.min(GRID_H - 0.4, enemy.y + velocity.y * dt));
      const blocked = this.clampMovementToContact(enemy, nextX, nextY, false);
      if (!blocked) {
        enemy.x = nextX;
        enemy.y = nextY;
      }
      enemy.facing = directionIndex(velocity.x, velocity.y);
      if (enemy.x <= BREACH_X) {
        enemy.breachVisualized = true;
        this.clearEngagement(enemy);
        this.burst(enemy.x, enemy.y, 10, this.palette.enemy);
        this.playSpatial(enemy.x, enemy.y, { freq: 110, type: "sawtooth", duration: 0.5, gain: 1.3 });
        this.breachFlash = 1;
        this.emitEncounterEvent("breach");
      }
    }

    if (this.currentWaveId && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.defeated)) {
      this.emitEncounterEvent("wave-cleared");
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
    for (let i = this.actionFx.length - 1; i >= 0; i--) {
      this.actionFx[i].life -= dt;
      if (this.actionFx[i].life <= 0) this.actionFx.splice(i, 1);
    }
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
    const bridgeTerrain = this.bridgeTerrainPlacement();
    if (this.terrainMode === TILEMAP_RENDER_MODE.CHUNK) {
      const viewport = { left: 0, top: 0, right: this.view.width, bottom: this.view.height };
      for (const chunk of visibleIndividualItems([...this.staticChunks.values()], viewport)) {
        ctx.drawImage(chunk.canvas, chunk.bounds.left, chunk.bounds.top, chunk.width, chunk.height);
      }
      // Source terrain is composited on top of opaque floor but below dynamic
      // queue items; individual tiles composite it immediately after each tile.
      this.drawBridgeTerrain(bridgeTerrain);
    }

    const terrain = this.terrainMode === TILEMAP_RENDER_MODE.INDIVIDUAL
      ? this.terrainTiles
      : this.occluderTiles;
    const queue = buildIndividualDrawQueue(terrain, this.buildDynamicDrawRecords());
    for (const item of queue) this.drawQueuedItem(item, bridgeTerrain);

    for (const effect of this.actionFx) this.drawActionFx(effect);
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

  drawQueuedItem(item, bridgeTerrain) {
    if (item.source === "tile") {
      this.drawTile(this.ctx, item.x, item.y, item.z);
      this.drawBridgeTerrainTile(item, bridgeTerrain);
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

  drawActionFx(effect) {
    const ctx = this.ctx;
    const source = this.project(effect.source.x, effect.source.y, this.elevationAt(effect.source.x, effect.source.y));
    const target = this.project(effect.target.x, effect.target.y, this.elevationAt(effect.target.x, effect.target.y));
    const life = Math.max(0, effect.life / effect.duration);
    const color = effect.action === "assault" ? this.palette.enemy
      : effect.action === "domain" ? this.palette.domain
        : effect.action === "possess" ? this.palette.allyPossessed
          : this.palette.spark;
    // The effect is source-backed: its active atlas frame is only enqueued
    // when the manifest declared and the loader decoded that exact clip.
    this.drawBridgeAtlas(effect.sourceAsset, effect.clip, 0, source, 52 * this.view.scale);
    ctx.save();
    ctx.globalAlpha = life * 0.9;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (effect.action === "materialize" || effect.action === "domain") {
      const radius = (1 - life) * 28 * this.view.scale + 10 * this.view.scale;
      ctx.beginPath();
      ctx.ellipse(target.x, target.y, radius, radius * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.action === "possess") {
      ctx.beginPath();
      ctx.arc(target.x, target.y - 15 * this.view.scale, (1 - life) * 16 * this.view.scale + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.setLineDash(effect.action === "hunt" ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y - 8 * this.view.scale);
      ctx.lineTo(target.x, target.y - 8 * this.view.scale);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(target.x, target.y - 8 * this.view.scale, 3 + (1 - life) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBoss() {
    if (!this.bossExposed) return;
    const ctx = this.ctx;
    const p = this.project(BOSS_TILE.x, BOSS_TILE.y, this.elevationAt(BOSS_TILE.x, BOSS_TILE.y));
    const s = this.view.scale;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4 * s, 30 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const bridgeDrawn = this.drawBridgeAtlas(
      BRIDGE_STAGE_BOSS[this.stageNumber],
      "Idle",
      4,
      p,
      82 * s,
    );
    if (bridgeDrawn) return;
    if (this.bossImage) {
      const w = 72 * s;
      const h = w * (this.bossImage.height / this.bossImage.width);
      ctx.drawImage(this.bossImage, p.x - w / 2, p.y - h + 6 * s, w, h);
      return;
    }
    ctx.fillStyle = this.palette.enemy;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 52 * s);
    ctx.lineTo(p.x + 20 * s, p.y);
    ctx.lineTo(p.x - 20 * s, p.y);
    ctx.closePath();
    ctx.fill();
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

    const tint = kind === "possessed" ? this.palette.allyPossessed : kind === "enemy" ? this.palette.enemy : this.palette.ally;
    const size = 64 * s * (kind === "enemy" && unit.archetype === "reinforce" ? 1.18 : 1);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3 * s, size * 0.2, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();


    const bridgeAsset = kind === "enemy" ? unit.archetype : kind === "possessed" ? "possessed" : "shade";
    const clip = unit.bridgeClipUntil > performance.now()
      ? unit.bridgeClip
      : this.engagements.has(unit)
        ? "Strike"
        : unit.path?.length
          ? "Move"
          : "Idle";
    const bridgeDrawn = this.drawBridgeAtlas(bridgeAsset, clip, unit.facing, p, size);
    if (!bridgeDrawn) {
      // Existing conceptual atlas and simple shapes remain the resilient
      // fallback while a generated image is unavailable or malformed.
      const atlas = this.unitAtlases.get(kind);
      if (atlas) {
        const phase = this.reducedMotion ? 0 : Math.floor(this.lastTime / (1000 / UNIT_ATLAS.fps)) % 2;
        const frame = this.atlasFacing(unit.facing) * 2 + phase;
        const sourceX = UNIT_ATLAS.padding + (frame % 4) * UNIT_ATLAS.stride;
        const sourceY = UNIT_ATLAS.padding + Math.floor(frame / 4) * UNIT_ATLAS.stride;
        ctx.drawImage(atlas, sourceX, sourceY, UNIT_ATLAS.framePx, UNIT_ATLAS.framePx, p.x - size / 2, p.y - size * 0.86, size, size);
      } else {
        ctx.save();
        ctx.fillStyle = tint;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        if (kind === "enemy") {
          ctx.moveTo(p.x, p.y - size * 0.68);
          ctx.lineTo(p.x + size * 0.24, p.y - size * 0.1);
          ctx.lineTo(p.x, p.y + size * 0.08);
          ctx.lineTo(p.x - size * 0.24, p.y - size * 0.1);
        } else {
          ctx.arc(p.x, p.y - size * 0.34, size * 0.24, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

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
    this.publishRuntimeState();
    this.render();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.bridgeGeneration += 1;
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    if (this.pointerHandlers) {
      this.canvas?.removeEventListener("pointerdown", this.pointerHandlers.down);
      this.canvas?.removeEventListener("pointermove", this.pointerHandlers.move);
      this.canvas?.removeEventListener("pointerup", this.pointerHandlers.up);
      this.canvas?.removeEventListener("pointercancel", this.pointerHandlers.cancel);
    }
    if (this.actionFeedbackTimer !== null) (window.clearTimeout ?? globalThis.clearTimeout)(this.actionFeedbackTimer);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.audio?.ctx?.close?.().catch?.(() => undefined);

    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.actionFx = [];
    this.nodes = [];
    this.selection.clear();
    this.unitAtlases.clear();
    this.staticChunks.clear();
    this.terrainTiles = [];
    this.occluderTiles = [];
    this.bossImage = null;
    this.bridge.records.clear();
    this.bridge.images.clear();
    this.pointerHandlers = null;
    this.resizeHandler = null;
    this.actionFeedbackTimer = null;
    this.animationFrameId = null;
    this.audio = null;
    this.ctx = null;
    this.canvas = null;
  }
}
