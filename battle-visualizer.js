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
  worldToScreen, pickTile, depthKey, steer,
  rectContains, directionIndex, mulberry32
} from "./iso-math.js";
import {
  TILEMAP_RENDER_MODE, buildIndividualDrawQueue, chunkForTile,
  selectTilemapRenderMode, visibleIndividualItems,
} from "./tilemap-renderer.js";
import { DEFAULT_BATTLE_PRESENTATION } from "./battle-presentation.js";
import { ObjectFeedbackLayer } from "./object-feedback-layer.js";
import {
  createStageNavigation,
} from "./stage-navigation.js";
import { resolveEnemyPattern, resolveBossPhase, getCombatAlertCue } from "./combat-systems.js";

let rendererRequestSequence = 0;

// Backing-store resolution cap for the Canvas2D tilemap. Raised from the
// previous 2x cap so tile edges and unit silhouettes stay crisp while
// zoomed in (mouse wheel) on high-DPI displays instead of upscaling a
// lower-resolution bitmap. computeView() and buildStaticLayer() must agree
// on this value — the static chunk canvases are baked at this DPR and drawn
// back through a context transform set to the same DPR.
const CANVAS_DPR_CAP = 3;

// Keyed by navigation.zones[].kind (hazard/current/high-ground/cover/flank/
// objective/exposed) so the battlefield tint always identifies the actual
// gimmick, matching the hues tactical-minimap.js uses for the same kinds.
const GIMMICK_STYLES = Object.freeze({
  hazard: Object.freeze({ fill: "rgba(239, 68, 68, 0.16)", stroke: "#ef4444" }),
  current: Object.freeze({ fill: "rgba(6, 182, 212, 0.16)", stroke: "#06b6d4" }),
  "high-ground": Object.freeze({ fill: "rgba(234, 179, 8, 0.16)", stroke: "#eab308" }),
  cover: Object.freeze({ fill: "rgba(34, 197, 94, 0.16)", stroke: "#22c55e" }),
  flank: Object.freeze({ fill: "rgba(168, 85, 247, 0.16)", stroke: "#a855f7" }),
  objective: Object.freeze({ fill: "rgba(59, 130, 246, 0.16)", stroke: "#3b82f6" }),
  exposed: Object.freeze({ fill: "rgba(249, 115, 22, 0.16)", stroke: "#f97316" })
});

const CLASH_DIST = 0.5;
const CLASH_TICK_S = 0.55;     // seconds between swings in a sustained engagement

const CIRCLE_PROBES = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1]),
  Object.freeze([0.707, 0.707]), Object.freeze([0.707, -0.707]),
  Object.freeze([-0.707, 0.707]), Object.freeze([-0.707, -0.707]),
]);
const INTERCEPT_RANGE = 3;     // aggressor radius: defenders chase hostiles this close
const ACTION_INTERACTION_RADIUS = 3.0; // commander must stand this close to a gimmick anchor to execute its command
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
function inferEnemyPatternKey(wave, index = 0) {
  const explicit = String(wave?.pattern ?? wave?.enemyPattern ?? "").toLowerCase();
  if (["rusher", "flanker", "ranged", "guardian"].includes(explicit)) return explicit;
  const id = String(wave?.id ?? "").toLowerCase();
  if (id.includes("guard")) return "guardian";
  if (id.includes("flank") || id.includes("pack") || id.includes("runner")) return "flanker";
  if (id.includes("ranged") || id.includes("artillery") || id.includes("tide") || id.includes("undertow")) return "ranged";
  if (id.includes("scout") || id.includes("reinforce") || id.includes("rush")) return "rusher";
  let hash = Math.max(0, Number(index) || 0);
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ["rusher", "flanker", "ranged", "guardian"][hash % 4];
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
    this.onActionFocus = typeof options.onActionFocus === "function" ? options.onActionFocus : null;
    this.onSelectionChange = typeof options.onSelectionChange === "function" ? options.onSelectionChange : null;
    this.cachedSelectionSummary = null;
    this.resolveFeedbackSpeech = typeof options.resolveFeedbackSpeech === "function"
      ? options.resolveFeedbackSpeech
      : (cue) => cue?.label ?? "Breach detected";
    this.actionPreview = null;
    this.onEnemyBreach = null; // Legacy callback; encounter events take precedence.
    this.encounter = null;
    this.encounterSnapshot = null;
    this.currentWaveId = null;
    this.pendingEncounterEvent = null;
    this.encounterEventKeys = new Set();
    this.bossExposed = false;
    this.runtimeSignature = null;
    this.breachFlash = 0;
    this.hud = null;
    this.objectFeedback = options.feedbackCanvas
      ? new ObjectFeedbackLayer(options.feedbackCanvas, { reducedMotion: this.reducedMotion })
      : null;
    this.feedbackHpCache = new Map();
    this.bossHealth = null;
    this.bossMaxHealth = null;
    this.bossPhase = null;
    this.bossClip = "Idle";
    this.lastBossHealth = null;
    this.boss = { id: "boss", hp: 0, maxHealth: 0, defeated: false };

    this.onTacticalRequest = typeof options.onTacticalRequest === "function" ? options.onTacticalRequest : null;
    this.placementMode = null;
    this.focusCell = null;
    this.deployments = [];
    this.activeTowerShots = [];
    this.hoverTile = null;
    this.placementError = null;
    this.campaign = null;
    this.navigationSnapshot = null;
    this.nextUnitId = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.pressed = new Set();
    this.keydownHandler = null;
    this.keyupHandler = null;
    this.blurHandler = null;

    this.navigation = createStageNavigation(this.stageNumber);
    const portalAnchor = this.navigation.anchors.portal;
    this.commanderPosition = { x: portalAnchor.x, y: portalAnchor.y };
    this.commander = {
      id: "commander",
      x: portalAnchor.x,
      y: portalAnchor.y,
      speed: 1.5,
      hp: 10,
      facing: 0,
      path: null,
      defeated: false,
      radius: 0.42
    };
    this.nodeGoal = this.navigation.anchors.nodes.length;
    this.rng = mulberry32(0x5eed + this.stageNumber * 977);

    this.tileGimmickKind = new Map();
    this.navigation.zones.forEach((zone) => {
      for (const cell of zone.cells) {
        this.tileGimmickKind.set(`${cell.x},${cell.y}`, zone.kind);
      }
    });

    this.timeAccumulator = 0;
    this.droppedTime = 0;
    this.wasHidden = false;
    this.handleVisibilityChange = () => {
      if (globalThis.document?.hidden) {
        this.wasHidden = true;
      }
    };
    globalThis.document?.addEventListener?.("visibilitychange", this.handleVisibilityChange);
    this.view = { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 };
    // Multiplier on top of the auto-fit scale computed in computeView(),
    // driven by mouse-wheel zoom. 1 = auto-fit (unchanged default framing).
    this.manualZoom = 1;
    this.terrainMode = TILEMAP_RENDER_MODE.CHUNK;
    this.staticChunks = new Map();
    this.staticChunksList = [];
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
    this.activePointerButton = null;
    this.routePreview = null;
    this.routePreviewActive = false;
    this.activePointerId = null;
    this.activePointerType = null;
    this.focusedAction = null;
    this.pointerDownTime = 0;
    this.waveClearedProposed = false;
    this.pointerHandlers = null;
    this.resizeHandler = null;

    this.audio = null;        // { ctx, master }
  }

  // --- terrain helpers -------------------------------------------------

  heightAt(x, y) {
    return this.navigation.heightAt(x, y);
  }

  walkable(x, y) {
    if (this.isBarricadeAt(x, y)) return false;
    return this.navigation.walkable(x, y);
  }

  isBarricadeAt(x, y) {
    return this.deployments.some(d => {
      const bx = d.cell ? d.cell.x : d.x;
      const by = d.cell ? d.cell.y : d.y;
      return (d.kind === "barricade" || d.type === "barricade") && Math.floor(bx) === x && Math.floor(by) === y;
    });
  }

  // Delegates to the shared authoritative validator (stage-navigation.js) so
  // Canvas placement previews reject the same anchors/base-area/path-sealing
  // cases the campaign-state transition itself enforces server-side.
  isPlacementLegal(tile) {
    if (!tile) return false;
    return this.navigation.validateDeployment(tile.x, tile.y, this.deployments, this.placementMode).valid;
  }

  climbOk(x0, y0, x1, y1) {
    return this.navigation.climbOk(x0, y0, x1, y1);
  }

  findPath(start, goal, options = {}) {
    return this.navigation.findPath(start, goal, { barricades: this.deployments, ...options });
  }

  terrainClear(x, y, radius, previous) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    if (!this.walkable(cellX, cellY)) return false;
    if (previous) {
      const prevX = Math.floor(previous.x);
      const prevY = Math.floor(previous.y);
      if (prevX !== cellX || prevY !== cellY) {
        if (!this.navigation.climbOk(prevX, prevY, cellX, cellY)) return false;
      }
    }
    for (const [offsetX, offsetY] of CIRCLE_PROBES) {
      const px = x + offsetX * radius;
      const py = y + offsetY * radius;
      if (!this.walkable(Math.floor(px), Math.floor(py))) return false;
    }
    return true;
  }

  collidesWithActor(unit, x, y, radius, actor, live) {
    if (!actor || actor === unit || !live) return false;
    const dx = x - actor.x;
    const dy = y - actor.y;
    const limit = radius + (actor.radius ?? 0.42);
    return dx * dx + dy * dy < limit * limit;
  }

  collidesAt(unit, x, y, radius) {
    // Check barricades
    for (const dep of this.deployments) {
      if (dep.kind !== "barricade" && dep.type !== "barricade") continue;
      const bx = dep.cell ? dep.cell.x + 0.5 : dep.x + 0.5;
      const by = dep.cell ? dep.cell.y + 0.5 : dep.y + 0.5;
      const dx = x - bx;
      const dy = y - by;
      const limit = radius + 0.45; // barricade radius is 0.45
      if (dx * dx + dy * dy < limit * limit) return true;
    }

    // Check allies
    for (const ally of this.allies) {
      if (this.collidesWithActor(unit, x, y, radius, ally, this.liveAlly(ally))) return true;
    }

    // Check commander (if commander is live, not the unit itself, and unit is an enemy)
    if (this.commander && this.commander !== unit && !this.commander.defeated) {
      if (this.enemies.includes(unit)) {
        if (this.collidesWithActor(unit, x, y, radius, this.commander, true)) return true;
      }
    }

    // If unit is not an enemy, it also collides with enemies
    if (!this.enemies.includes(unit)) {
      for (const enemy of this.enemies) {
        if (this.collidesWithActor(unit, x, y, radius, enemy, this.liveEnemy(enemy))) return true;
      }
    }
    return false;
  }

  resolveMovement(unit, targetX, targetY) {
    const radius = unit.radius ?? 0.42;
    const start = { x: unit.x, y: unit.y };
    const distance = Math.hypot(targetX - start.x, targetY - start.y);
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    let resolved = start;
    let blocked = false;
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      let x = start.x + (targetX - start.x) * progress;
      let y = start.y + (targetY - start.y) * progress;
      if (!this.terrainClear(x, y, radius, resolved) || this.collidesAt(unit, x, y, radius)) {
        const xOnlyClear = this.terrainClear(x, resolved.y, radius, resolved) && !this.collidesAt(unit, x, resolved.y, radius);
        const yOnlyClear = this.terrainClear(resolved.x, y, radius, resolved) && !this.collidesAt(unit, resolved.x, y, radius);
        if (xOnlyClear && !yOnlyClear) {
          y = resolved.y;
        } else if (yOnlyClear && !xOnlyClear) {
          x = resolved.x;
        } else if (xOnlyClear && yOnlyClear) {
          const distX = Math.hypot(x - targetX, resolved.y - targetY);
          const distY = Math.hypot(resolved.x - targetX, y - targetY);
          if (distX < distY) {
            y = resolved.y;
          } else {
            x = resolved.x;
          }
        } else {
          const cellX = Math.floor(resolved.x) + 0.5;
          const cellY = Math.floor(resolved.y) + 0.5;
          const nudgeX = resolved.x + Math.sign(cellX - resolved.x) * 0.05;
          const nudgeY = resolved.y + Math.sign(cellY - resolved.y) * 0.05;
          const nudgeClear = this.terrainClear(nudgeX, nudgeY, radius, resolved) && !this.collidesAt(unit, nudgeX, nudgeY, radius);
          if (nudgeClear) {
            x = nudgeX;
            y = nudgeY;
          } else {
            blocked = true;
            break;
          }
        }
      }
      resolved = { x, y };
    }
    return {
      x: resolved.x,
      y: resolved.y,
      blocked,
    };
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

    // Attach key listeners on canvas
    this.canvas.tabIndex = this.canvas.tabIndex > -1 ? this.canvas.tabIndex : 0;
    this.keydownHandler = (event) => {
      const code = event.code;
      if (["KeyW", "ArrowUp", "KeyA", "ArrowLeft", "KeyS", "ArrowDown", "KeyD", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(code)) {
        this.pressed.add(code);
        if (code !== "ShiftLeft" && code !== "ShiftRight") {
          event.preventDefault();
        }
      }
    };
    this.keyupHandler = (event) => {
      const code = event.code;
      if (["KeyW", "ArrowUp", "KeyA", "ArrowLeft", "KeyS", "ArrowDown", "KeyD", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(code)) {
        this.pressed.delete(code);
        if (code !== "ShiftLeft" && code !== "ShiftRight") {
          event.preventDefault();
        }
      }
    };
    this.blurHandler = () => {
      this.pressed.clear();
    };
    this.canvas.addEventListener("keydown", this.keydownHandler);
    this.canvas.addEventListener("keyup", this.keyupHandler);
    this.canvas.addEventListener("blur", this.blurHandler);

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
    this.emitSelectionChange();
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
    const dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_CAP);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.view.width = cssW;
    this.view.height = cssH;

    // Grid bounding box in projection space.
    const corners = [
      worldToScreen(0, 0, 0), worldToScreen(this.navigation.width, 0, 0),
      worldToScreen(0, this.navigation.height, 0), worldToScreen(this.navigation.width, this.navigation.height, 0)
    ];
    const minX = Math.min(...corners.map(c => c.x)) - TILE_W / 2;
    const maxX = Math.max(...corners.map(c => c.x)) + TILE_W / 2;
    const minY = Math.min(...corners.map(c => c.y)) - ELEV_H * 3;
    const maxY = Math.max(...corners.map(c => c.y)) + TILE_H;
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    const defaultScale = Math.min(cssW / worldW, cssH / worldH);
    if (this.focusCell) {
      const zoomScale = defaultScale * 2.0 * this.manualZoom;
      this.view.scale = zoomScale;
      const cellCenter = worldToScreen(this.focusCell.x + 0.5, this.focusCell.y + 0.5, this.elevationAt(this.focusCell.x + 0.5, this.focusCell.y + 0.5));
      this.view.offsetX = cssW / 2 - cellCenter.x * zoomScale;
      this.view.offsetY = cssH / 2 - cellCenter.y * zoomScale;
    } else {
      const scale = defaultScale * this.manualZoom;
      this.view.scale = scale;
      // Keep the world point currently at screen-center fixed while zooming
      // (mouse-wheel zoom-to-center), instead of re-centering on the whole
      // map bounds every time manualZoom changes.
      const centerWorldX = minX + worldW / 2;
      const centerWorldY = minY + worldH / 2;
      this.view.offsetX = cssW / 2 - centerWorldX * scale;
      this.view.offsetY = cssH / 2 - centerWorldY * scale;
    }

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


  getTacticalTargetAnchors() {
    const captureNode = this.navigation.anchors.nodes[this.nodes.length] ?? null;
    return {
      materialize: this.project(this.navigation.anchors.alliedSpawn.x, this.navigation.anchors.alliedSpawn.y, 0),
      capture: captureNode ? this.project(captureNode.x, captureNode.y, 0) : null,
      assault: this.project(this.navigation.anchors.boss.x, this.navigation.anchors.boss.y, 0)
    };
  }

  tacticalActionAt(canvasPoint) {
    if (!this.getAvailableActions) return null;
    const available = new Set(this.getAvailableActions());
    const candidates = [
      { action: "materialize", point: this.actionPoint("portal") },
      { action: "domain", point: this.actionPoint("portal") },
      ...(this.nodes.length < this.nodeGoal ? [{ action: "capture", point: this.actionPoint("node") }] : []),
      { action: "possess", point: this.actionPoint("ally") },
      { action: "extract", point: this.actionPoint("extractor") },
      { action: "hunt", point: this.actionPoint("extractor") },
      ...(this.bossExposed ? [{ action: "assault", point: this.actionPoint("boss") }] : []),
    ];
    const radius = Math.max(24, this.view.scale * 0.9);
    let hit = null;
    let distance = radius * radius;
    for (const candidate of candidates) {
      if (!available.has(candidate.action)) continue;
      const point = candidate.point;
      if (!point) continue;
      const screen = this.project(point.x, point.y, this.elevationAt(point.x, point.y));
      const dx = canvasPoint.x - screen.x;
      const dy = canvasPoint.y - screen.y;
      const squared = dx * dx + dy * dy;
      if (squared < distance) {
        hit = candidate.action;
        distance = squared;
      }
    }
    return hit;
  }

  requestTacticalActionAt(canvasPoint) {
    if (!this.onActionRequest) return false;
    const action = this.tacticalActionAt(canvasPoint);
    if (!action) return false;
    rendererRequestSequence += 1;
    this.onActionRequest({
      type: "command-request",
      action,
      requestId: `renderer-request-${rendererRequestSequence}`,
      source: "renderer-pointer",
      rendererMode: "canvas-2d",
      occurredAt: Number.isFinite(performance.now()) ? performance.now() : Date.now()
    });
    return true;
  }
  detectActionAt(canvasPoint) {
    return this.tacticalActionAt(canvasPoint);
  }

  setActionFocus(action) {
    const nextAction = action || null;
    if (nextAction === this.focusedAction) return;
    this.focusedAction = nextAction;
    this.canvas.style.cursor = nextAction ? "pointer" : "default";
    this.onActionFocus?.(nextAction);
  }

  notifyTacticalLayout() {
    this.onTacticalLayout?.(this.getTacticalTargetAnchors());
  }

  // --- terrain cache and shared draw ordering ------------------------------

  buildStaticLayer() {
    const dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_CAP);
    this.terrainMode = selectTilemapRenderMode({
      width: this.navigation.width,
      height: this.navigation.height,
      backingPixels: this.canvas.width * this.canvas.height,
    });
    this.staticChunks.clear();
    this.staticChunksList = [];
    this.terrainTiles = [];
    this.occluderTiles = [];

    const floorChunks = new Map();
    for (let y = 0; y < this.navigation.height; y++) {
      for (let x = 0; x < this.navigation.width; x++) {
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
    // Cached array view of staticChunks.values(): the map is only rebuilt
    // here (or cleared at destroy), never mutated per-frame, so render()
    // can reuse this array instead of spreading the Map every frame.
    this.staticChunksList = [...this.staticChunks.values()];
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

    const gimmickKind = this.tileGimmickKind.get(`${x},${y}`);
    const zoneStyle = gimmickKind ? GIMMICK_STYLES[gimmickKind] : null;

    ctx.fillStyle = this.palette.tileTop[Math.min(z, this.palette.tileTop.length - 1)];
    ctx.strokeStyle = zoneStyle ? zoneStyle.stroke : this.palette.gridLine;
    ctx.lineWidth = zoneStyle ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - hh);
    ctx.lineTo(top.x + hw, top.y);
    ctx.lineTo(top.x, top.y + hh);
    ctx.lineTo(top.x - hw, top.y);
    ctx.closePath();
    ctx.fill();
    if (zoneStyle) {
      ctx.fillStyle = zoneStyle.fill;
      ctx.fill();
    }
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
      this.project(this.navigation.width, 0, 0),
      this.project(this.navigation.width, this.navigation.height, 0),
      this.project(0, this.navigation.height, 0),
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

  emitSelectionChange() {
    for (const ally of this.selection) {
      if (!this.liveAlly(ally)) this.selection.delete(ally);
    }

    let total = 0;
    let count = 0;
    let health = 0;
    let maxHealth = 0;
    let possessed = 0;
    let engaged = 0;
    let moving = 0;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally)) continue;
      total += 1;
      if (!this.selection.has(ally)) continue;
      count += 1;
      health += Math.max(0, Number(ally.hp) || 0);
      maxHealth += Math.max(0, Number(ally.maxHealth ?? ally.maxHp ?? 3) || 0);
      if (ally.isPossessed) possessed += 1;
      if (this.engagements.has(ally)) engaged += 1;
      if (ally.path?.length > 0) moving += 1;
    }

    let order = "none";
    if (count > 0) {
      if (engaged === count) order = "engaged";
      else if (moving === count) order = "moving";
      else if (engaged > 0 || moving > 0) order = "mixed";
      else order = "holding";
    }

    const cached = this.cachedSelectionSummary;
    if (
      cached &&
      cached.count === count &&
      cached.total === total &&
      cached.health === health &&
      cached.maxHealth === maxHealth &&
      cached.possessed === possessed &&
      cached.engaged === engaged &&
      cached.moving === moving &&
      cached.order === order
    ) return cached;

    const summary = {
      count,
      total,
      health,
      maxHealth,
      possessed,
      engaged,
      moving,
      order,
    };
    this.cachedSelectionSummary = summary;
    this.onSelectionChange?.(summary);
    return summary;
  }

  selectAlly(ally) {
    this.selection.clear();
    if (this.liveAlly(ally)) this.selection.add(ally);
    return this.emitSelectionChange();
  }

  clearRoutePreview() {
    this.routePreview = null;
    this.routePreviewActive = false;
  }

  updateAlliedRoutePreview(point) {
    if (!point || this.selection.size === 0) {
      this.clearRoutePreview();
      return false;
    }
    const tile = this.unprojectToTile(point.x, point.y);
    if (!tile || !this.walkable(tile.x, tile.y)) {
      this.clearRoutePreview();
      return false;
    }
    const ally = [...this.selection].find((candidate) => this.liveAlly(candidate));
    if (!ally) {
      this.clearRoutePreview();
      return false;
    }
    const start = { x: Math.floor(ally.x), y: Math.floor(ally.y) };
    const goal = { x: Math.floor(tile.x), y: Math.floor(tile.y) };
    const path = this.findPath(start, goal);
    if (!path || path.length < 2) {
      this.clearRoutePreview();
      return false;
    }
    this.routePreview = {
      path: path.map((node) => ({ x: node.x, y: node.y })),
      target: goal,
    };
    this.routePreviewActive = true;
    return true;
  }

  resolvePointerAlly(point) {
    if (!point) return null;
    const radius = Math.max(18, this.view.scale * 22);
    const radiusSquared = radius * radius;
    let nearest = null;
    let nearestDistance = radiusSquared;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally)) continue;
      const screen = this.project(ally.x, ally.y, this.elevationAt(ally.x, ally.y));
      const dx = point.x - screen.x;
      const dy = point.y - screen.y;
      const distance = dx * dx + dy * dy;
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearest = ally;
      }
    }
    return nearest;
  }

  attachPointerHandlers() {
    const canvasPoint = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const down = (event) => {
      if (this.activePointerId !== null) return;
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      if (event.button === 2) event.preventDefault();
      this.canvas.focus?.({ preventScroll: true });

      const p = canvasPoint(event);
      this.activePointerId = event.pointerId;
      this.activePointerType = event.pointerType;
      this.activePointerButton = event.button;
      this.pointerDown = p;
      this.pointerDownTime = performance.now();
      this.dragRect = null;

      this.isPanning = event.button === 1 || (event.button === 0 && event.altKey);
      this.panStartX = this.view.offsetX;
      this.panStartY = this.view.offsetY;
      if (event.button === 2) {
        this.clearRoutePreview();
      } else if (this.isPanning) {
        this.setActionFocus(null);
      } else {
        this.setActionFocus(this.detectActionAt(p));
      }

      this.canvas.setPointerCapture?.(event.pointerId);
      this.renderStatic();
    };

    const move = (event) => {
      const p = canvasPoint(event);
      this.hoverTile = this.unprojectToTile(p.x, p.y);

      if (this.activePointerId === null || event.pointerId !== this.activePointerId) {
        if (event.pointerType !== "touch") this.setActionFocus(this.detectActionAt(p));
        return;
      }
      if (!this.pointerDown) return;

      const dx = p.x - this.pointerDown.x;
      const dy = p.y - this.pointerDown.y;
      const dist = Math.hypot(dx, dy);
      const threshold = this.activePointerType === "touch" ? 12 : 6;

      if (this.activePointerButton === 2) {
        if (dist > threshold) this.updateAlliedRoutePreview(p);
        else this.clearRoutePreview();
        this.renderStatic();
        return;
      }

      if (this.isPanning) {
        this.view.offsetX = this.panStartX + dx;
        this.view.offsetY = this.panStartY + dy;
      } else if (dist > threshold) {
        if (this.activePointerType === "touch") {
          this.isPanning = true;
          this.setActionFocus(null);
          this.dragRect = null;
          this.view.offsetX = this.panStartX + dx;
          this.view.offsetY = this.panStartY + dy;
        } else {
          this.setActionFocus(null);
          this.dragRect = {
            x0: this.pointerDown.x,
            y0: this.pointerDown.y,
            x1: p.x,
            y1: p.y
          };
        }
      } else {
        this.dragRect = null;
      }
      this.renderStatic();
    };

    const up = (event) => {
      if (this.activePointerId === null || event.pointerId !== this.activePointerId) return;

      const p = canvasPoint(event);
      const dx = p.x - this.pointerDown.x;
      const dy = p.y - this.pointerDown.y;
      const dist = Math.hypot(dx, dy);
      const threshold = this.activePointerType === "touch" ? 12 : 6;
      const duration = performance.now() - this.pointerDownTime;
      const isTapEligible = duration <= 500;

      if (this.activePointerButton === 2) {
        const target = this.routePreviewActive
          ? this.routePreview?.target
          : this.unprojectToTile(p.x, p.y);
        if (target && this.selection.size > 0 && this.walkable(target.x, target.y)) {
          this.issueFormationMove(target);
          this.orderFlag = { x: target.x + 0.5, y: target.y + 0.5, life: 1.2 };
          this.playSpatial(target.x + 0.5, target.y + 0.5, { freq: 650, duration: 0.15, type: "sine", gain: 0.5 });
        }
        this.clearRoutePreview();
        this.activePointerId = null;
        this.activePointerType = null;
        this.activePointerButton = null;
        this.pointerDown = null;
        this.dragRect = null;
        this.renderStatic();
        return;
      }
      if (this.isPanning) {
        this.isPanning = false;
      } else {
        if (dist > threshold) {
          this.selection.clear();
          const dragBox = {
            x0: this.pointerDown.x,
            y0: this.pointerDown.y,
            x1: p.x,
            y1: p.y
          };
          for (const ally of this.allies) {
            const s = this.project(ally.x, ally.y, this.elevationAt(ally.x, ally.y));
            if (rectContains(dragBox, s.x, s.y)) this.selection.add(ally);
          }
          this.emitSelectionChange();
        } else if (isTapEligible) {
          if (this.placementMode) {
            const tile = this.unprojectToTile(p.x, p.y);
            if (this.isPlacementLegal(tile)) {
              this.onTacticalRequest?.({
                type: "deploy",
                kind: this.placementMode,
                cell: { x: tile.x, y: tile.y }
              });
              this.placementMode = null;
            } else if (tile) {
              this.playSpatial(tile.x + 0.5, tile.y + 0.5, { freq: 120, type: "sawtooth", duration: 0.25, gain: 0.7 });
              this.placementError = { x: tile.x, y: tile.y, life: 0.5 };
              if (this.reducedMotion) {
                const clear = window.clearTimeout ?? globalThis.clearTimeout;
                const set = window.setTimeout ?? globalThis.setTimeout;
                if (this.placementErrorTimer) clear(this.placementErrorTimer);
                this.placementErrorTimer = set(() => {
                  this.placementError = null;
                  this.placementErrorTimer = null;
                  this.renderStatic();
                }, 500);
              }
            }
          } else if (!this.requestTacticalActionAt(p)) {
            const ally = this.resolvePointerAlly(p);
            if (ally) {
              this.selectAlly(ally);
            } else {
              // Touch preserves its existing selected-formation move contract;
              // mouse/pen primary ground taps continue to drive the commander.
              const tile = this.unprojectToTile(p.x, p.y);
              if (tile && this.activePointerType === "touch" && this.selection.size > 0) {
                if (this.walkable(tile.x, tile.y)) {
                  this.issueFormationMove(tile);
                  this.orderFlag = { x: tile.x + 0.5, y: tile.y + 0.5, life: 1.2 };
                  this.playSpatial(tile.x + 0.5, tile.y + 0.5, { freq: 520, duration: 0.12, type: "sine", gain: 0.6 });
                }
              } else if (tile) {
                this.onTacticalRequest?.({ type: "focus", cell: { x: tile.x, y: tile.y } });
                if (this.walkable(tile.x, tile.y)) {
                  const start = { x: Math.floor(this.commander.x), y: Math.floor(this.commander.y) };
                  const path = this.findPath(start, tile);
                  if (path && path.length > 1) {
                    this.commander.path = path.slice(1).map(node => ({ x: node.x + 0.5, y: node.y + 0.5 }));
                    this.orderFlag = { x: tile.x + 0.5, y: tile.y + 0.5, life: 1.2 };
                    this.playSpatial(tile.x + 0.5, tile.y + 0.5, { freq: 600, duration: 0.1, type: "sine", gain: 0.3 });
                  }
                }
              }
            }
          }
        }
      }

      this.setActionFocus(this.activePointerType === "touch" ? null : this.detectActionAt(p));
      this.activePointerId = null;
      this.activePointerType = null;
      this.activePointerButton = null;
      this.pointerDown = null;
      this.dragRect = null;
      this.renderStatic();
    };

    const cancel = (event) => {
      if (this.activePointerId === null || (event && event.pointerId !== this.activePointerId)) return;

      this.activePointerId = null;
      this.activePointerType = null;
      this.activePointerButton = null;
      this.clearRoutePreview();
      this.pointerDown = null;
      this.dragRect = null;
      this.setActionFocus(null);
      this.isPanning = false;
      this.renderStatic();
    };

    const lostCapture = (event) => {
      if (this.activePointerId !== null && event.pointerId === this.activePointerId) {
        cancel(event);
      }
    };

    const leave = () => {
      this.setActionFocus(null);
      this.hoverTile = null;
    };

    const blur = () => {
      this.setActionFocus(null);
      this.hoverTile = null;
    };

    const contextmenu = (event) => {
      event.preventDefault();
    };

    // Mouse-wheel zoom, mirroring RealtimeBattle.onWheel: only active while
    // the canvas holds focus (set on pointerdown above), so page scroll
    // outside the battlefield is never hijacked.
    const wheel = (event) => {
      if (document.activeElement !== this.canvas) return;
      event.preventDefault();
      const MIN_ZOOM = 0.6;
      const MAX_ZOOM = 2.4;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.manualZoom - event.deltaY * 0.0014));
      if (next === this.manualZoom) return;
      this.manualZoom = next;
      this.computeView();
      this.buildStaticLayer();
      this.renderStatic();
    };

    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", cancel);
    this.canvas.addEventListener("lostpointercapture", lostCapture);
    this.canvas.addEventListener("pointerleave", leave);
    this.canvas.addEventListener("blur", blur);
    this.canvas.addEventListener("contextmenu", contextmenu);
    this.canvas.addEventListener("wheel", wheel, { passive: false });
    this.pointerHandlers = { down, move, up, cancel, lostCapture, leave, blur, contextmenu, wheel };
  }
  // Spreads selected allies across a small BFS-discovered footprint around
  // the target tile (superseding the old single-point issueMoveOrder) so a
  // multi-unit rally does not stack everyone on one cell.
  issueFormationMove(tile) {
    const selectedAllies = this.allies.filter(ally => this.selection.has(ally));
    if (selectedAllies.length === 0) return;

    const gridW = this.navigation.width || 24;
    const gridH = this.navigation.height || 12;
    const targets = [];
    const queue = [{ x: tile.x, y: tile.y }];
    const visited = new Set([`${tile.x},${tile.y}`]);
    let head = 0;

    const dirs = [
      [1, 0], [0, -1], [0, 1], [-1, 0],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    while (head < queue.length && targets.length < selectedAllies.length) {
      const curr = queue[head++];
      if (this.walkable(curr.x, curr.y)) {
        targets.push(curr);
      }
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        const nx = curr.x + d[0];
        const ny = curr.y + d[1];
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    while (targets.length < selectedAllies.length) {
      targets.push({ x: tile.x, y: tile.y });
    }

    selectedAllies.forEach((ally, i) => {
      const targetTile = targets[i] || tile;
      const start = { x: Math.floor(ally.x), y: Math.floor(ally.y) };
      const path = this.findPath(start, targetTile);
      if (path && path.length > 1) {
        ally.path = path.slice(1).map(node => ({ x: node.x + 0.5, y: node.y + 0.5 }));
        ally.holdUntil = performance.now() + 6000;
      } else {
        ally.path = [{ x: targetTile.x + 0.5, y: targetTile.y + 0.5 }];
        ally.holdUntil = performance.now() + 6000;
      }
    });
    this.emitSelectionChange();
  }

  // --- public trigger API (unchanged surface) -----------------------------

  actionPoint(point) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
    if (point === "portal") return this.navigation.anchors.portal;
    if (point === "ally") return this.allies[0] ?? this.navigation.anchors.alliedSpawn;
    if (point === "boss") return this.navigation.anchors.boss;
    if (point === "extractor") return this.navigation.anchors.extractor;
    if (point === "node") {
      const nextNode = this.navigation.anchors.nodes[this.nodes.length];
      return nextNode ?? this.navigation.anchors.boss;
    }
    return this.navigation.anchors.alliedSpawn;
  }

  previewAction(semantic) {
    if (!semantic) return;
    if (semantic.commandId === undefined && semantic.phase === undefined) {
      this.actionPreview = semantic;
    } else {
      this.actionPreview = {
        ...semantic,
        commandId: semantic.commandId,
        phase: semantic.phase
      };
    }
    this.renderStatic();
  }

  getCommandReadiness(payload) {
    if (this.destroyed) return { ready: false, reason: "destroyed" };
    const action = payload?.action;
    if (!action) return { ready: false, reason: "invalid-action" };
    
    let pointName = "portal";
    if (action === "hunt" || action === "extract") pointName = "extractor";
    else if (action === "materialize" || action === "domain") pointName = "portal";
    else if (action === "capture") pointName = "node";
    else if (action === "possess") pointName = "ally";
    else if (action === "assault") pointName = "boss";
    
    const targetPt = this.actionPoint(pointName);
    if (!targetPt) {
      return { ready: false, reason: "no-target" };
    }
    
    if (!this.navigation || !this.navigation.anchors) {
      return { ready: false, reason: "path-blocked" };
    }

    // Each action reads through a specific world gimmick/anchor; the
    // commander must physically stand near it before the campaign executes
    // the queued command (parity with the WebGL renderer).
    if (this.commanderPosition) {
      const dx = this.commanderPosition.x - targetPt.x;
      const dy = this.commanderPosition.y - targetPt.y;
      const distance = Math.hypot(dx, dy);
      if (distance > ACTION_INTERACTION_RADIUS) {
        return { ready: false, reason: "out-of-range", distance, required: ACTION_INTERACTION_RADIUS };
      }
    }

    return { ready: true, reason: "ready" };
  }

  clearActionPreview(action) {
    this.actionPreview = null;
    this.renderStatic();
  }
  setPlacementMode(kind) {
    this.placementMode = kind;
    this.renderStatic();
  }

  focusTacticalCell(cell) {
    if (cell && Number.isInteger(cell.x) && Number.isInteger(cell.y)) {
      this.focusCell = { x: cell.x, y: cell.y };
    } else {
      this.focusCell = null;
    }
    this.computeView();
    this.buildStaticLayer();
    this.renderStatic();
  }

  // Computed once and cached: this.navigation is immutable for the
  // renderer's lifetime, so there is no reason to rebuild the routes/zones/
  // anchors arrays on every snapshot pull (syncMinimap can call this often).
  buildNavigationSnapshot() {
    const nav = this.navigation;
    return {
      width: nav.width,
      height: nav.height,
      cells: nav.cells,
      routes: nav.routes.map((route) => ({
        id: route.id,
        lane: route.lane,
        cells: route.cells.map((c) => ({ x: c.x, y: c.y }))
      })),
      zones: nav.zones.map((zone) => ({
        kind: zone.kind,
        cells: zone.cells.map((c) => ({ x: c.x, y: c.y }))
      })),
      anchors: {
        portal: { x: nav.anchors.portal.x, y: nav.anchors.portal.y },
        boss: { x: nav.anchors.boss.x, y: nav.anchors.boss.y },
        extractor: { x: nav.anchors.extractor.x, y: nav.anchors.extractor.y },
        rally: { x: nav.anchors.rally.x, y: nav.anchors.rally.y },
        alliedSpawn: { x: nav.anchors.alliedSpawn.x, y: nav.anchors.alliedSpawn.y },
        nodes: nav.anchors.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
        hostileSpawns: nav.anchors.hostileSpawns.map((s) => ({ id: s.id, x: s.x, y: s.y, routeIndex: s.routeIndex }))
      }
    };
  }

  getTacticalSnapshot() {
    if (!this.navigationSnapshot) this.navigationSnapshot = this.buildNavigationSnapshot();
    const centerTile = this.unprojectToTile(this.view.width / 2, this.view.height / 2);
    const centerWorld = this.navigation.gridToWorld(
      centerTile ? centerTile.x + 0.5 : this.navigation.width / 2,
      centerTile ? centerTile.y + 0.5 : this.navigation.height / 2
    );
    return {
      stageNumber: this.stageNumber,
      navigation: this.navigationSnapshot,
      units: [
        ...(this.commander && !this.commander.defeated ? [{
          id: this.commander.id,
          team: 1,
          ...this.navigation.gridToWorld(this.commander.x, this.commander.y),
          hp: this.commander.hp
        }] : []),
        ...this.allies.filter((a) => this.liveAlly(a)).map((a) => ({
          id: a.id,
          team: 1,
          ...this.navigation.gridToWorld(a.x, a.y),
          hp: a.hp
        })),
        ...this.enemies.filter((e) => this.liveEnemy(e)).map((e) => ({
          id: e.id,
          team: 2,
          ...this.navigation.gridToWorld(e.x, e.y),
          hp: e.hp
        }))
      ],
      deployments: this.deployments.map((d) => ({
        id: d.id,
        kind: d.kind,
        x: d.x,
        y: d.y
      })),
      focus: this.focusCell ? { x: this.focusCell.x, y: this.focusCell.y } : null,
      selectionCount: this.selection.size,
      placementMode: this.placementMode,
      towerShots: this.activeTowerShots.map((s) => ({
        towerId: s.towerId,
        targetId: s.targetId,
        x: s.x,
        y: s.y
      })),
      viewport: { x: centerWorld.x, z: centerWorld.z, zoom: this.view.scale }
    };
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
    if (this.encounterSnapshot !== null && this.encounterSnapshot !== snapshot) {
      this.pendingEncounterEvent = null;
      this.encounterEventKeys.clear();
    }
    this.encounterSnapshot = snapshot;
    this.encounter = waves ? { stageId, config, state } : null;
    this.bossExposed = state?.bossExposed === true;
    this.reconcileEncounterWave(activeWaveId);
    this.publishRuntimeState();
    this.renderStatic();
  }

  syncObjectFeedback() {
    if (!this.objectFeedback) return;
    const objects = [];
    const addActor = (actor, id, kind, maxHp) => {
      if (!actor) return;
      objects.push({
        id,
        kind,
        label: actor.label ?? id,
        hp: Number(actor.hp) || 0,
        maxHp: Number(actor.maxHealth ?? actor.maxHp ?? maxHp) || maxHp,
        visible: actor.defeated !== true,
        selected: this.selection.has(actor),
      });
    };
    addActor(this.commander, this.commander?.id ?? "commander", "commander", 10);
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index];
      addActor(ally, ally.id ?? `ally-${index}`, ally.isPossessed ? "possessed" : "ally", 3);
    }
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      addActor(enemy, enemy.id ?? `enemy-${index}`, "enemy", 3);
    }
    addActor(this.boss, "boss", "boss", 1);
    for (const deployment of this.deployments) {
      objects.push({
        id: deployment.id,
        kind: deployment.kind ?? deployment.type ?? "deployment",
        label: deployment.label ?? deployment.id,
        hp: Number(deployment.hp) || 0,
        maxHp: Number(deployment.maxHp ?? deployment.maxHealth) || 1,
        visible: deployment.defeated !== true,
      });
    }
    this.objectFeedback.reconcile(objects, { silent: true });
    this.feedbackHpCache.clear();
    for (const object of objects) this.feedbackHpCache.set(object.id, object.hp);
  }

  projectFeedbackObject(object) {
    if (!object) return null;
    let actor = null;
    if (object.id === "commander") actor = this.commander;
    else if (object.id === "boss") actor = this.boss;
    else actor = this.allies.find((unit) => unit.id === object.id)
      ?? this.enemies.find((unit) => unit.id === object.id)
      ?? this.deployments.find((deployment) => deployment.id === object.id);
    if (!actor) return null;
    const x = Number(actor.x ?? actor.cell?.x ?? 0) + (object.id === "boss" ? 0.4 : 0);
    const y = Number(actor.y ?? actor.cell?.y ?? 0) + (object.id === "boss" ? 0.4 : 0);
    const point = this.project(x, y, this.elevationAt(x, y));
    return { x: point.x, y: point.y - 12, depth: y, visible: true };
  }

  applyCampaignState({ campaign, stage, encounter, state } = {}) {
    const config = encounter?.config ?? stage?.encounter ?? null;
    const encounterState = encounter?.state ?? state?.encounter ?? state ?? campaign?.stage?.encounter ?? encounter ?? null;
    const stageId = encounter?.stageId ?? stage?.id ?? campaign?.stageId ?? null;
    const legion = Number(state?.legion ?? campaign?.stage?.legion);
    if (Number.isInteger(legion) && legion >= 0) {
      this.authoritativeLegion = legion;
      this.reconcileAllies(legion);
      const isPossessed = state?.possessed === true || campaign?.stage?.possessed === true;
      for (let index = 0; index < this.allies.length; index += 1) {
        this.allies[index].isPossessed = isPossessed && index === 0;
      }
      this.emitSelectionChange();
    }
    if (stage && Number.isInteger(stage.nodeGoal)) {
      this.nodeGoal = stage.nodeGoal;
    } else {
      this.nodeGoal = this.navigation.anchors.nodes.length;
    }
    const nodeCount = Number(state?.nodes ?? campaign?.stage?.nodes ?? 0);
    this.nodes = this.navigation.anchors.nodes.slice(0, nodeCount);
    this.applyEncounter({ stageId, config, state: encounterState });

    // Tower/barricade reconciliation is authoritative-only: this renderer
    // never mutates campaign.stage.deployments, only mirrors it.
    this.campaign = campaign ?? this.campaign;
    const deployments = state?.stage?.deployments ?? campaign?.stage?.deployments ?? state?.deployments ?? [];
    this.reconcileDeployments(deployments);
    const bossHp = Number(state?.bossHealth ?? campaign?.stage?.bossHealth ?? stage?.bossHealth);
    const bossMaxHp = Number(
      state?.bossMaxHealth
      ?? campaign?.stage?.bossMaxHealth
      ?? campaign?.stage?.bossHealth
      ?? stage?.bossHealth
      ?? this.bossMaxHealth
      ?? bossHp,
    );
    if (Number.isFinite(bossMaxHp) && bossMaxHp > 0) {
      this.bossMaxHealth = bossMaxHp;
      this.boss.maxHealth = bossMaxHp;
    }
    if (Number.isFinite(bossHp)) {
      this.bossHealth = bossHp;
      this.boss.hp = bossHp;
      if (bossHp <= 0 && !this.boss.defeated) {
        this.boss.defeated = true;
        this.bossClip = "Defeat";
      }
      this.lastBossHealth = bossHp;
      try {
        this.bossPhase = resolveBossPhase({
          health: bossHp,
          maxHealth: this.bossMaxHealth,
          phaseCount: Number(state?.bossPhaseCount ?? stage?.bossPhaseCount ?? 3) || 3,
        });
      } catch {
        this.bossPhase = null;
      }
    }
    this.syncObjectFeedback();
  }

  // Idempotent: re-applying an identical deployments list updates matching
  // ids in place and adds/removes nothing, so no duplicate deployments are
  // ever created by a repeated/duplicate campaign-state push.
  reconcileDeployments(list) {
    if (!Array.isArray(list)) return;
    const keep = new Set();
    for (const entry of list) {
      if (!entry || typeof entry.id !== "string") continue;
      if (entry.kind !== "tower" && entry.kind !== "barricade") continue;
      const cellX = Number.isInteger(entry.cell?.x) ? entry.cell.x : Math.trunc(entry.x);
      const cellY = Number.isInteger(entry.cell?.y) ? entry.cell.y : Math.trunc(entry.y);
      if (!Number.isInteger(cellX) || !Number.isInteger(cellY)) continue;
      keep.add(entry.id);
      const existing = this.deployments.find((d) => d.id === entry.id);
      if (existing) {
        existing.kind = entry.kind;
        existing.x = cellX;
        existing.y = cellY;
      } else {
        this.deployments.push({ id: entry.id, kind: entry.kind, x: cellX, y: cellY, cooldown: 0 });
      }
    }
    if (this.deployments.length !== keep.size || this.deployments.some((d) => !keep.has(d.id))) {
      this.deployments = this.deployments.filter((d) => keep.has(d.id));
    }
  }

  reconcileEncounterWave(activeWaveId = this.encounter?.state?.activeWaveId ?? null) {
    const wave = this.encounter?.config?.waves?.find((candidate) => candidate?.id === activeWaveId);
    if (!wave || this.currentWaveId !== wave.id) {
      this.clearEncounterWave();
      if (!wave || !this.ctx) return;
      this.currentWaveId = wave.id;
      this.waveClearedProposed = false;
      this.spawnEncounterWave(wave);
    }
  }

  clearEncounterWave() {
    for (const enemy of this.enemies) this.clearEngagement(enemy);
    this.enemies = [];
    this.currentWaveId = null;
    this.waveClearedProposed = false;
  }

  spawnAlly(count = 1) {
    const additions = Math.max(0, Number(count) || 0);
    const alliedSpawn = this.navigation.anchors.alliedSpawn;
    for (let index = 0; index < additions; index += 1) {
      const baseSpeed = 1.2 + this.rng() * 0.25;
      const unit = {
        id: "ally-" + (++this.nextUnitId),
        x: alliedSpawn.x + (this.allies.length % 3) * 0.34,
        y: alliedSpawn.y + ((this.allies.length % 3) - 1) * 0.45,
        baseSpeed: baseSpeed,
        speed: baseSpeed,
        hp: 3,
        maxHealth: 3,
        facing: 0,
        path: null,
        holdUntil: 0,
        isPossessed: false,
        defeated: false,
        radius: 0.42
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
    this.emitSelectionChange();
  }

  spawnEncounterWave(wave) {
    const count = Math.max(0, Number(wave?.hostiles) || 0);
    let archetype = "scout";
    if (wave?.id === "scout") {
      archetype = "scout";
    } else if (wave?.id === "guard") {
      archetype = "guard";
    } else if (wave?.id === "reinforcement" || wave?.id === "reinforce") {
      archetype = "reinforce";
    } else {
      archetype = "scout";
    }
    const bossTile = this.navigation.anchors.boss;
    for (let index = 0; index < count; index += 1) {
      const routeIndex = index % this.navigation.routes.length;
      const pathCells = this.navigation.routePath(routeIndex, true);
      const path = pathCells ? pathCells.map(cell => ({ x: cell.x + 0.5, y: cell.y + 0.5 })) : [];
      const spawnX = path.length > 0 ? path[0].x : bossTile.x;
      const spawnY = path.length > 0 ? path[0].y : bossTile.y;

      let pattern;
      try {
        pattern = resolveEnemyPattern(
          inferEnemyPatternKey(wave, index),
          { ...wave, waveId: wave?.id ?? null, enemyIndex: index, routeIndex },
        );
      } catch {
        pattern = null;
      }
      if (!pattern || pattern.accepted === false) {
        pattern = Object.freeze({
          accepted: true,
          patternId: inferEnemyPatternKey(wave, index),
          movement: "advance",
          movementDirective: Object.freeze({ mode: "advance", speedMultiplier: 1 }),
        });
      }

      const unit = {
        id: "enemy-" + (++this.nextUnitId),
        x: spawnX,
        y: spawnY,
        baseSpeed: 2.4,
        speed: 2.4, // Keep 2.4 hostile speed
        hp: Math.max(1, Number(wave.hostileHealth) || 2),
        archetype,
        waveId: wave.id,
        routeIndex,
        path: path.length > 1 ? path.slice(1) : null,
        facing: 4,
        defeated: false,
        breachVisualized: false,
        radius: 0.42,
        pattern,
        patternId: pattern.patternId ?? pattern.id ?? wave?.id ?? "rusher",
        detourPreference: index % 2 === 0 ? 1 : -1,
      };
      this.enemies.push(unit);
      this.burst(unit.x, unit.y, 8, this.palette.enemy);
    }
    this.playSpatial(bossTile.x, bossTile.y, { freq: 180, type: "sawtooth", duration: 0.3, gain: 0.8 });
  }

  emitEncounterEvent(type, enemy = null) {
    const waveId = this.currentWaveId;
    const stageId = this.encounter?.stageId;
    if (
      (type !== "wave-cleared" && type !== "breach")
      || !waveId
      || typeof stageId !== "string"
      || this.encounter?.state?.activeWaveId !== waveId
    ) return;
    const eventKey = type === "breach"
      ? `breach:${enemy?.id ?? "anonymous"}`
      : "wave-cleared";
    if (this.encounterEventKeys.has(eventKey)) return;
    if (type === "wave-cleared" && this.pendingEncounterEvent) return;
    const event = {
      type,
      stageId,
      waveId,
      ...(type === "breach" && enemy?.id ? { enemyId: enemy.id } : {}),
    };
    this.encounterEventKeys.add(eventKey);
    if (type === "wave-cleared") this.pendingEncounterEvent = event;
    if (type === "breach") {
      const cue = getCombatAlertCue(type);
      this.objectFeedback?.emitSpeech("commander", this.resolveFeedbackSpeech(cue));
    }
    if (this.onEncounterEvent) this.onEncounterEvent(event);
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
    if (
      action === "assault"
      && semantic.target === "boss"
      && this.bossExposed
      && !this.boss.defeated
      && (this.bossHealth === null || this.bossHealth > 0)
    ) {
      this.bossClip = "Attack";
    }
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
      if (this.particles.length >= 360) {
        this.particles.shift();
      }
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
    return this.allies.includes(unit) && !unit?.defeated;
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

  hasSurge() {
    return this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight");
  }

  moveCommander(dt) {
    if (!this.commander || this.commander.defeated) return;

    if (this.commander.path) {
      const isBlocked = this.commander.path.some(node => this.isBarricadeAt(Math.floor(node.x), Math.floor(node.y)));
      if (isBlocked) {
        const start = { x: Math.floor(this.commander.x), y: Math.floor(this.commander.y) };
        const lastNode = this.commander.path[this.commander.path.length - 1];
        const goal = { x: Math.floor(lastNode.x), y: Math.floor(lastNode.y) };
        const newPath = this.findPath(start, goal);
        if (newPath && newPath.length > 1) {
          this.commander.path = newPath.slice(1).map(node => ({ x: node.x + 0.5, y: node.y + 0.5 }));
        } else {
          this.commander.path = null;
        }
      }
    }

    let x = 0;
    let y = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) y -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) y += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;

    if (x === 0 && y === 0) {
      if (this.commander.path?.length > 0) {
        const nextWaypoint = this.commander.path[0];
        const dx = nextWaypoint.x - this.commander.x;
        const dy = nextWaypoint.y - this.commander.y;
        if (Math.hypot(dx, dy) <= 0.08) {
          this.commander.path.shift();
          if (this.commander.path.length === 0) {
            this.commander.path = null;
          } else {
            const next = this.commander.path[0];
            x = next.x - this.commander.x;
            y = next.y - this.commander.y;
          }
        } else {
          x = dx;
          y = dy;
        }
      }
    } else {
      this.commander.path = null;
    }

    // Set baseSpeed and update commander.speed property
    const baseSpeed = this.hasSurge() ? 7.2 : 4.1;
    this.commander.speed = baseSpeed;

    const targetVel = { x: 0, y: 0 };
    const magnitude = Math.hypot(x, y);
    if (magnitude > 0.0001) {
      const mobilityLevel = this.campaign?.progression?.skills?.mobility ?? 1;
      const mobilityBonus = Math.max(0, mobilityLevel - 1);
      const gimmick = this.navigation.getGimmickAt(this.commander.x, this.commander.y);
      const speedMultiplier = (gimmick?.effects?.movementSpeedMultiplier ?? 1) * (1 + mobilityBonus * 0.15);
      const speed = baseSpeed * speedMultiplier;
      targetVel.x = (x / magnitude) * speed;
      targetVel.y = (y / magnitude) * speed;
    }

    if (!this.commanderVelocity) {
      this.commanderVelocity = { x: 0, y: 0 };
    }

    const targetSpeed = Math.hypot(targetVel.x, targetVel.y);
    const currentSpeed = Math.hypot(this.commanderVelocity.x, this.commanderVelocity.y);
    let rate = 28;
    if (targetSpeed === 0 || currentSpeed > targetSpeed) {
      rate = 36;
    }

    const diffX = targetVel.x - this.commanderVelocity.x;
    const diffY = targetVel.y - this.commanderVelocity.y;
    const diffLen = Math.hypot(diffX, diffY);
    const step = rate * dt;

    if (diffLen <= step) {
      this.commanderVelocity.x = targetVel.x;
      this.commanderVelocity.y = targetVel.y;
    } else {
      this.commanderVelocity.x += (diffX / diffLen) * step;
      this.commanderVelocity.y += (diffY / diffLen) * step;
    }

    const speed = Math.hypot(this.commanderVelocity.x, this.commanderVelocity.y);
    if (speed < 0.05) {
      this.commanderVelocity.x = 0;
      this.commanderVelocity.y = 0;
      return;
    }

    const vx = this.commanderVelocity.x;
    const vy = this.commanderVelocity.y;
    const nextX = this.commander.x + vx * dt;
    const nextY = Math.max(0.4, Math.min(this.navigation.height - 0.4, this.commander.y + vy * dt));

    const resolved = this.resolveMovement(this.commander, nextX, nextY);
    this.commander.x = resolved.x;
    this.commander.y = resolved.y;
    this.commanderPosition.x = resolved.x;
    this.commanderPosition.y = resolved.y;
    this.commander.facing = directionIndex(vx, vy);

    if (resolved.blocked) {
      this.commanderVelocity.x = 0;
      this.commanderVelocity.y = 0;
      this.commander.path = null;
    }
  }

  defeatUnit(unit) {
    if (!unit) return;
    unit.defeated = true;
    unit.bridgeClip = "Defeat";
    unit.bridgeClipUntil = Number.POSITIVE_INFINITY;
    this.clearEngagement(unit);
    this.selection.delete(unit);
    this.emitSelectionChange();
  }

  emitCombatAlert(enemy, event = "enemy-ranged-warning") {
    let cue = null;
    try {
      cue = getCombatAlertCue(event, { enemyId: enemy.id, patternId: enemy.patternId })
        ?? getCombatAlertCue("start-wave")
        ?? null;
    } catch {
      cue = null;
    }
    if (this.destroyed) return;
    const color = cue?.color ?? cue?.particleColor ?? this.palette.enemy ?? "#ff7f79";
    const count = Math.max(2, Number(cue?.count ?? cue?.particleCount ?? 8) || 8);
    this.burst(enemy.x, enemy.y, count, color);

    const frequency = Number(cue?.frequency ?? cue?.freq) || 560;
    const endFrequency = Number(cue?.endFrequency ?? cue?.endFreq) || Math.max(80, frequency * 0.7);
    this.playSpatial(enemy.x, enemy.y, {
      freq: frequency,
      endFreq: endFrequency,
      duration: Number(cue?.duration) || 0.18,
      type: cue?.type ?? "triangle",
      gain: Number(cue?.gain) || 0.38,
    });
    enemy.lastAlertCue = cue;
    enemy.alertCue = cue;
  }

  updateTowers(dt) {
    const fortLevel = this.campaign?.progression?.skills?.fortification ?? 1;
    const rangeMult = 1.0 + (fortLevel - 1) * 0.1;
    const dmgMult = 1.0 + (fortLevel - 1) * 0.2;

    for (const dep of this.deployments) {
      if (dep.kind !== "tower") continue;
      dep.cooldown = Math.max(0, (dep.cooldown ?? 0) - dt);
      if (dep.cooldown > 0) continue;

      const gimmick = this.navigation.getGimmickAt(dep.x, dep.y);
      const gimRangeMult = gimmick?.effects?.towerRangeMultiplier ?? 1.0;
      const range = 4.0 * rangeMult * gimRangeMult;

      // Find nearest enemy in range
      let target = null;
      let bestD = range * range;
      for (const enemy of this.enemies) {
        if (!this.liveEnemy(enemy)) continue;
        const dx = enemy.x - (dep.x + 0.5);
        const dy = enemy.y - (dep.y + 0.5);
        const d = dx * dx + dy * dy;
        if (d <= bestD) {
          bestD = d;
          target = enemy;
        }
      }

      if (target) {
        dep.cooldown = 1.0;
        this.activeTowerShots.push({
          towerId: dep.id,
          targetId: target.id,
          sourceX: dep.x + 0.5,
          sourceY: dep.y + 0.5,
          x: target.x,
          y: target.y,
          life: 0.15
        });

        const targetGimmick = this.navigation.getGimmickAt(target.x, target.y);
        const targetDmgMult = targetGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
        const damage = 1.0 * dmgMult * targetDmgMult;

        target.hp -= damage;
        this.playSpatial(dep.x + 0.5, dep.y + 0.5, { freq: 880, endFreq: 440, type: "sine", duration: 0.1, gain: 0.3 });
        this.burst(target.x, target.y, 4, this.palette.spark);

        if (target.hp <= 0) {
          this.defeatUnit(target);
        }
      }
    }
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
      
      const allyGimmick = this.navigation.getGimmickAt(ally.x, ally.y);
      const enemyGimmick = this.navigation.getGimmickAt(enemy.x, enemy.y);
      const allyDamageDealtMult = allyGimmick?.effects?.combatDamageDealtMultiplier ?? 1.0;
      const enemyDamageReceivedMult = enemyGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
      const allyDamageToEnemy = 1.0 * allyDamageDealtMult * enemyDamageReceivedMult;
      
      const enemyDamageDealtMult = enemyGimmick?.effects?.combatDamageDealtMultiplier ?? 1.0;
      const allyDamageReceivedMult = allyGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
      const enemyDamageToAlly = 1.0 * enemyDamageDealtMult * allyDamageReceivedMult;

      ally.hp -= enemyDamageToAlly;
      enemy.hp -= allyDamageToEnemy;
      ally.clashCd = CLASH_TICK_S;
      enemy.clashCd = CLASH_TICK_S;
      this.exchanges += 1;
      if (enemy.hp <= 0) {
        this.defeatUnit(enemy);
      }
      if (ally.hp <= 0) {
        this.defeatUnit(ally);
      }
    }
  }

  // --- simulation ---------------------------------------------------------

  updateUnits(dt) {
    this.reconcileEngagements();
    this.selectEngagements();
    this.updateEngagements(dt);
    this.reconcileEngagements();
    this.moveCommander(dt);
    this.updateTowers(dt);


    for (const ally of this.allies) {
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      
      const gimmick = this.navigation.getGimmickAt(ally.x, ally.y);
      const speedMult = gimmick?.effects?.movementSpeedMultiplier ?? 1.0;
      ally.speed = (ally.baseSpeed ?? 1.2) * speedMult;

      if (ally.path) {
        const isBlocked = ally.path.some(node => this.isBarricadeAt(Math.floor(node.x), Math.floor(node.y)));
        if (isBlocked) {
          const start = { x: Math.floor(ally.x), y: Math.floor(ally.y) };
          const lastNode = ally.path[ally.path.length - 1];
          const goal = { x: Math.floor(lastNode.x), y: Math.floor(lastNode.y) };
          const newPath = this.findPath(start, goal);
          if (newPath && newPath.length > 1) {
            ally.path = newPath.slice(1).map(node => ({ x: node.x + 0.5, y: node.y + 0.5 }));
          } else {
            ally.path = null;
          }
        }
      }

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
        else if (performance.now() >= ally.holdUntil && Math.abs(ally.x - this.navigation.anchors.rally.x) > 0.25) target = { x: this.navigation.anchors.rally.x, y: ally.y };
      }
      if (!target) continue;
      const magnitude = Math.hypot(target.x - ally.x, target.y - ally.y) || 1;
      const velocity = steer(ally, {
        x: ((target.x - ally.x) / magnitude) * ally.speed,
        y: ((target.y - ally.y) / magnitude) * ally.speed,
      }, this.allies.filter((candidate) => !candidate.defeated));
      const nextX = ally.x + velocity.x * dt;
      const nextY = Math.max(0.4, Math.min(this.navigation.height - 0.4, ally.y + velocity.y * dt));
      const blocked = this.clampMovementToContact(ally, nextX, nextY, true);
      if (!blocked) {
        const resolved = this.resolveMovement(ally, nextX, nextY);
        ally.x = resolved.x;
        ally.y = resolved.y;
      }
      ally.facing = directionIndex(velocity.x, velocity.y);
    }

    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      
      const gimmick = this.navigation.getGimmickAt(enemy.x, enemy.y);
      const gimmickSpeed = gimmick?.effects?.movementSpeedMultiplier ?? 1.0;

      const pattern = enemy.pattern ?? {};
      const movement = pattern.movementDirective && typeof pattern.movementDirective === "object"
        ? pattern.movementDirective
        : (pattern.movement && typeof pattern.movement === "object" ? pattern.movement : pattern);
      const patternId = String(pattern.patternId ?? enemy.patternId ?? enemy.archetype ?? "").toLowerCase();
      const movementKind = String(pattern.movement ?? movement.mode ?? movement.kind ?? movement.type ?? patternId).toLowerCase();

      const isRanged = patternId === "ranged" || movementKind === "ranged" || patternId.includes("ranged");
      if (isRanged) {
        enemy.alertTimer = Math.max(0, (enemy.alertTimer ?? (0.35 + (enemy.routeIndex ?? 0) * 0.18)) - dt);
        enemy.pauseTimer = Math.max(0, (enemy.pauseTimer ?? 0) - dt);
        if (enemy.pauseTimer > 0) {
          continue;
        }
        if (enemy.alertTimer <= 0) {
          this.emitCombatAlert(enemy, "enemy-ranged-warning");
          enemy.alertTimer = Math.max(0.9, Number(movement.pausePeriod ?? movement.alertPeriod) || 1.65);
          enemy.pauseTimer = Math.max(0.12, Number(movement.pauseDuration) || 0.38);
          continue;
        }
      }

      const configuredSpeed = Number(movement.speedMultiplier ?? movement.speedScale);
      let patternSpeed = Number.isFinite(configuredSpeed) && configuredSpeed > 0 ? configuredSpeed : 1;
      if (movementKind === "guardian") {
        const portalAnchor = this.navigation.anchors.portal;
        const portalDistance = Math.hypot(enemy.x - portalAnchor.x, enemy.y - portalAnchor.y);
        patternSpeed *= portalDistance < 4 ? 0.5 : 0.82;
      }
      enemy.speed = (enemy.baseSpeed ?? 2.4) * gimmickSpeed * patternSpeed;

      if (enemy.path) {
        const isBlocked = enemy.path.some(node => this.isBarricadeAt(Math.floor(node.x), Math.floor(node.y)));
        if (isBlocked) {
          const start = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
          const goal = { x: Math.floor(this.navigation.anchors.alliedSpawn.x), y: Math.floor(this.navigation.anchors.alliedSpawn.y) };
          const newPath = this.findPath(start, goal, { routeIndex: enemy.routeIndex });
          if (newPath && newPath.length > 1) {
            enemy.path = newPath.slice(1).map(node => ({ x: node.x + 0.5, y: node.y + 0.5 }));
          } else {
            enemy.path = null;
          }
        }
      }

      let target = null;
      if (enemy.path?.length) {
        target = enemy.path[0];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        if (dx * dx + dy * dy < 0.05) {
          enemy.path.shift();
          if (enemy.path.length === 0) enemy.path = null;
        }
      } else {
        // Find nearest opponent as target when in combat zone
        let bestTarget = null;
        let bestDist = Infinity;
        const candidates = [];
        if (this.commander && !this.commander.defeated) {
          candidates.push(this.commander);
        }
        for (const ally of this.allies) {
          if (this.liveAlly(ally)) {
            candidates.push(ally);
          }
        }
        for (const cand of candidates) {
          const dist = Math.hypot(cand.x - enemy.x, cand.y - enemy.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestTarget = cand;
          }
        }
        target = bestTarget || this.navigation.anchors.alliedSpawn;
      }
      if (!target) continue;

      const magnitude = Math.hypot(target.x - enemy.x, target.y - enemy.y) || 1;
      let targetDirX = (target.x - enemy.x) / magnitude;
      let targetDirY = (target.y - enemy.y) / magnitude;

      // Handle preferred distance behavior for ranged/kite or other patterns when in skirmish mode
      if (!enemy.path) {
        const dist = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        const prefDist = Number(movement.preferredDistance) || 0;
        if (movementKind === "kite") {
          const retreatDist = Number(movement.retreatDistance) || 3;
          if (dist < retreatDist) {
            targetDirX = -targetDirX;
            targetDirY = -targetDirY;
          } else if (dist <= prefDist) {
            targetDirX = 0;
            targetDirY = 0;
          }
        } else if (dist < prefDist) {
          targetDirX = 0;
          targetDirY = 0;
        }
      }

      const velocity = steer(enemy, {
        x: targetDirX * enemy.speed,
        y: targetDirY * enemy.speed,
      }, this.enemies.filter((candidate) => !candidate.defeated && !candidate.breachVisualized));

      const nextX = enemy.x + velocity.x * dt;
      const nextY = Math.max(0.4, Math.min(this.navigation.height - 0.4, enemy.y + velocity.y * dt));
      const blocked = this.clampMovementToContact(enemy, nextX, nextY, false);
      if (!blocked) {
        const resolved = this.resolveMovement(enemy, nextX, nextY);
        enemy.x = resolved.x;
        enemy.y = resolved.y;
        if (resolved.blocked) {
          const configuredDetour = Number(movement.detourBias ?? movement.detourMultiplier);
          const detourBias = Number.isFinite(configuredDetour) && configuredDetour !== 0
            ? configuredDetour
            : (movementKind === "flanker" || patternId.includes("flank") ? 1.45 : 1);
          const detourDistance = Math.min(0.24 * Math.abs(detourBias), dt * enemy.speed);
          const detourSide = Math.sign(enemy.detourPreference || 1) * Math.sign(detourBias || 1);
          const preferredDetour = this.resolveMovement(
            enemy,
            enemy.x - targetDirY * detourSide * detourDistance,
            enemy.y + targetDirX * detourSide * detourDistance,
          );
          enemy.x = preferredDetour.x;
          enemy.y = preferredDetour.y;
          if (preferredDetour.blocked) {
            const fallbackDetour = this.resolveMovement(
              enemy,
              enemy.x + targetDirY * detourSide * detourDistance,
              enemy.y - targetDirX * detourSide * detourDistance,
            );
            enemy.x = fallbackDetour.x;
            enemy.y = fallbackDetour.y;
          }
        }
      }
      enemy.facing = directionIndex(velocity.x, velocity.y);
      if (enemy.x <= this.navigation.anchors.portal.x) {
        enemy.breachVisualized = true;
        this.clearEngagement(enemy);
        this.burst(enemy.x, enemy.y, 10, this.palette.enemy);
        this.playSpatial(enemy.x, enemy.y, { freq: 110, type: "sawtooth", duration: 0.5, gain: 1.3 });
        this.breachFlash = 1;
        this.emitEncounterEvent("breach", enemy);
      }
    }

    if (this.currentWaveId && this.enemies.length > 0 && !this.waveClearedProposed && this.enemies.every((enemy) => enemy.defeated || enemy.breachVisualized)) {
      this.waveClearedProposed = true;
      this.emitEncounterEvent("wave-cleared");
    }
    this.emitSelectionChange();
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
    for (let i = this.activeTowerShots.length - 1; i >= 0; i--) {
      this.activeTowerShots[i].life -= dt;
      if (this.activeTowerShots[i].life <= 0) this.activeTowerShots.splice(i, 1);
    }

    if (this.placementError) {
      this.placementError.life -= dt;
      if (this.placementError.life <= 0) this.placementError = null;
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
      for (const chunk of visibleIndividualItems(this.staticChunksList, viewport)) {
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
    if (this.actionPreview) this.drawActionPreview();
    if (this.routePreviewActive) this.drawRoutePreview();
    if (this.orderFlag) this.drawOrderFlag();
    this.drawHoverAndPlacementIndicators();
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
    if (this.objectFeedback) {
      // Avoid rebuilding a combined [commander, boss, ...allies, ...enemies,
      // ...deployments] array via spread every frame; walk each source array
      // directly instead (same per-actor logic, zero extra allocation).
      const trackFeedback = (actor) => {
        if (!actor?.id) return;
        const currentHp = Number(actor.hp) || 0;
        const previousHp = this.feedbackHpCache.get(actor.id);
        if (previousHp !== undefined && currentHp !== previousHp) {
          const kind = actor.kind ?? (this.enemies.includes(actor) || actor === this.boss ? "enemy" : "ally");
          const type = currentHp > previousHp
            ? "heal"
            : (kind === "enemy" || kind === "boss" ? "outgoing" : "incoming");
          this.objectFeedback.emitExchange("commander", actor.id, Math.abs(currentHp - previousHp), type);
        }
        this.feedbackHpCache.set(actor.id, currentHp);
      };
      trackFeedback(this.commander);
      trackFeedback(this.boss);
      for (const ally of this.allies) trackFeedback(ally);
      for (const enemy of this.enemies) trackFeedback(enemy);
      for (const dep of this.deployments) trackFeedback(dep);
      this.objectFeedback.render((object) => this.projectFeedbackObject(object));
    }
  }

  buildDynamicDrawRecords() {
    const alliedSpawn = this.navigation.anchors.alliedSpawn;
    const bossTile = this.navigation.anchors.boss;
    const records = [
      {
        id: "ally-portal", x: alliedSpawn.x, y: alliedSpawn.y, z: 0,
        sortRoot: this.sortRootAt(alliedSpawn.x, alliedSpawn.y),
        layer: "prop", render: "portal", color: this.palette.ally,
      },
      {
        id: "boss-portal", x: bossTile.x, y: bossTile.y, z: 0,
        sortRoot: this.sortRootAt(bossTile.x, bossTile.y),
        layer: "prop", render: "portal", color: this.palette.enemy,
      },
      {
        id: "boss", x: bossTile.x + 0.4, y: bossTile.y + 0.4, z: 0,
        sortRoot: this.sortRootAt(bossTile.x + 0.4, bossTile.y + 0.4),
        layer: "actor", render: "boss",
      },
    ];

    if (this.commander && !this.commander.defeated) {
      records.push({
        id: "commander",
        x: this.commander.x,
        y: this.commander.y,
        z: this.elevationAt(this.commander.x, this.commander.y),
        sortRoot: this.sortRootAt(this.commander.x, this.commander.y),
        layer: "actor",
        render: "unit",
        unit: this.commander,
        kind: "commander"
      });
    }

    for (const dep of this.deployments) {
      records.push({
        id: dep.id,
        x: dep.x + 0.5,
        y: dep.y + 0.5,
        z: this.elevationAt(dep.x + 0.5, dep.y + 0.5),
        sortRoot: this.sortRootAt(dep.x + 0.5, dep.y + 0.5),
        layer: "prop",
        render: "deployment",
        deployment: dep
      });
    }

    this.navigation.anchors.nodes.forEach((node, index) => {
      records.push({
        id: node.id, x: node.x, y: node.y, z: 0,
        sortRoot: this.sortRootAt(node.x, node.y), layer: "prop",
        render: "node", node, captured: index < this.nodes.length,
      });
    });
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
    else if (item.render === "deployment") this.drawDeployment(item.deployment);
  }

  drawDeployment(dep) {
    const ctx = this.ctx;
    const s = this.view.scale;
    const z = this.elevationAt(dep.x + 0.5, dep.y + 0.5);
    const p = this.project(dep.x + 0.5, dep.y + 0.5, z);

    ctx.save();
    if (dep.kind === "tower") {
      ctx.fillStyle = "#4b5563";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 16 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(p.x - 12 * s, p.y);
      ctx.lineTo(p.x - 8 * s, p.y - 28 * s);
      ctx.lineTo(p.x + 8 * s, p.y - 28 * s);
      ctx.lineTo(p.x + 12 * s, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 28 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 34 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (dep.kind === "barricade") {
      ctx.fillStyle = "#78350f";
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.5 * s;

      ctx.fillRect(p.x - 14 * s, p.y - 12 * s, 4 * s, 12 * s);
      ctx.strokeRect(p.x - 14 * s, p.y - 12 * s, 4 * s, 12 * s);

      ctx.fillRect(p.x + 10 * s, p.y - 12 * s, 4 * s, 12 * s);
      ctx.strokeRect(p.x + 10 * s, p.y - 12 * s, 4 * s, 12 * s);

      ctx.fillStyle = "#b45309";
      ctx.fillRect(p.x - 12 * s, p.y - 10 * s, 24 * s, 3 * s);
      ctx.strokeRect(p.x - 12 * s, p.y - 10 * s, 24 * s, 3 * s);
      ctx.fillRect(p.x - 12 * s, p.y - 5 * s, 24 * s, 3 * s);
      ctx.strokeRect(p.x - 12 * s, p.y - 5 * s, 24 * s, 3 * s);
    }
    ctx.restore();
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
    const p = this.project(this.navigation.anchors.boss.x, this.navigation.anchors.boss.y, this.elevationAt(this.navigation.anchors.boss.x, this.navigation.anchors.boss.y));
    const s = this.view.scale;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4 * s, 30 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const bridgeDrawn = this.drawBridgeAtlas(
      BRIDGE_STAGE_BOSS[this.stageNumber],
      this.bossClip,
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
    const defeated = this.bossClip === "Defeat";
    const attacking = this.bossClip === "Attack";
    ctx.fillStyle = defeated ? "#64748b" : attacking ? "#ffd166" : this.palette.enemy;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - (defeated ? 36 : attacking ? 60 : 52) * s);
    ctx.lineTo(p.x + (defeated ? 26 : attacking ? 24 : 20) * s, p.y);
    ctx.lineTo(p.x - (defeated ? 26 : attacking ? 24 : 20) * s, p.y);
    ctx.closePath();
    ctx.fill();
  }

  drawRoutePreview() {
    const ctx = this.ctx;
    const path = this.routePreview?.path;
    if (!ctx || !this.routePreviewActive || !path?.length) return;
    const s = this.view.scale;
    ctx.save();
    ctx.strokeStyle = this.palette.ally;
    ctx.fillStyle = this.palette.ally;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.beginPath();
    path.forEach((node, index) => {
      const projected = this.project(node.x + 0.5, node.y + 0.5, this.elevationAt(node.x + 0.5, node.y + 0.5));
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const target = path[path.length - 1];
    const endpoint = this.project(target.x + 0.5, target.y + 0.5, this.elevationAt(target.x + 0.5, target.y + 0.5));
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath();
    ctx.ellipse(endpoint.x, endpoint.y, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawUnit(unit, kind) {
    const ctx = this.ctx;
    const z = this.elevationAt(unit.x, unit.y);
    const p = this.project(unit.x, unit.y, z);
    const s = this.view.scale;

    if (this.selection.has(unit)) {
      const pulse = this.reducedMotion ? 0 : (Math.sin(this.lastTime * 0.008) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = this.palette.ally;
      ctx.globalAlpha = 0.76 + pulse * 0.2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2 * s, (15 + pulse * 2) * s, (7.5 + pulse) * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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

  drawTileDiamond(ctx, x, y, strokeColor, fillColor, lineWidth = 2) {
    const z = this.elevationAt(x + 0.5, y + 0.5);
    const top = this.project(x + 0.5, y + 0.5, z);
    const s = this.view.scale;
    const hw = (TILE_W / 2) * s;
    const hh = (TILE_H / 2) * s;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - hh);
    ctx.lineTo(top.x + hw, top.y);
    ctx.lineTo(top.x, top.y + hh);
    ctx.lineTo(top.x - hw, top.y);
    ctx.closePath();

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth * s;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHoverAndPlacementIndicators() {
    const ctx = this.ctx;
    if (!ctx) return;

    if (this.placementError) {
      const alpha = this.reducedMotion ? 0.8 : Math.max(0, this.placementError.life / 0.5);
      if (alpha > 0) {
        this.drawTileDiamond(
          ctx,
          this.placementError.x,
          this.placementError.y,
          `rgba(255, 68, 68, ${alpha})`,
          `rgba(255, 68, 68, ${alpha * 0.4})`,
          3
        );
      }
    }

    if (this.hoverTile) {
      if (this.placementMode) {
        const legal = this.isPlacementLegal(this.hoverTile);
        const strokeColor = legal ? "rgba(112, 229, 208, 0.9)" : "rgba(255, 68, 68, 0.9)";
        const fillColor = legal ? "rgba(112, 229, 208, 0.4)" : "rgba(255, 68, 68, 0.4)";
        this.drawTileDiamond(ctx, this.hoverTile.x, this.hoverTile.y, strokeColor, fillColor, 2);
      } else {
        this.drawTileDiamond(ctx, this.hoverTile.x, this.hoverTile.y, "rgba(244, 247, 255, 0.6)", "rgba(244, 247, 255, 0.25)", 1.5);
      }
    }
  }

  // --- loop -----------------------------------------------------------------

  animate() {
    if (this.destroyed || this.reducedMotion) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const now = performance.now();

    if (document.hidden) {
      this.lastTime = now;
      this.timeAccumulator = 0;
      return;
    }
    if (this.wasHidden) {
      this.lastTime = now;
      this.timeAccumulator = 0;
      this.wasHidden = false;
    }

    let elapsed = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (elapsed < 0) elapsed = 0;

    // frame delta clamp .10s
    if (elapsed > 0.10) {
      this.droppedTime += (elapsed - 0.10);
      elapsed = 0.10;
    }

    this.timeAccumulator += elapsed;

    const FIXED_DT = 1 / 60;
    // max 6 catch-up steps
    let steps = Math.floor(this.timeAccumulator / FIXED_DT);
    if (steps > 6) {
      const droppedSteps = steps - 6;
      this.droppedTime += droppedSteps * FIXED_DT;
      this.timeAccumulator -= droppedSteps * FIXED_DT;
      steps = 6;
    }

    for (let step = 0; step < steps; step += 1) {
      this.aiAccumulator += FIXED_DT * 1000;
      if (this.aiAccumulator >= AI_TICK_MS) {
        this.aiAccumulator = 0;
        // AI tick slot (250ms): archetype decisions are cheap and framerate-independent.
      }

      this.updateUnits(FIXED_DT);
      this.updateParticles(FIXED_DT);
      if (this.breachFlash > 0) this.breachFlash = Math.max(0, this.breachFlash - FIXED_DT * 1.6);
      this.timeAccumulator -= FIXED_DT;
    }
    this.publishRuntimeState();
    this.render();
  }
  drawActionPreview() {
    const ctx = this.ctx;
    if (!ctx || !this.actionPreview) return;
    const srcPoint = this.actionPoint(this.actionPreview.source);
    const tgtPoint = this.actionPoint(this.actionPreview.target);
    if (!srcPoint || !tgtPoint) return;

    const srcScreen = this.project(srcPoint.x, srcPoint.y, this.elevationAt(srcPoint.x, srcPoint.y));
    const tgtScreen = this.project(tgtPoint.x, tgtPoint.y, this.elevationAt(tgtPoint.x, tgtPoint.y));
    
    ctx.save();
    const s = this.view.scale;
    
    ctx.strokeStyle = "rgba(112, 229, 208, 0.6)";
    ctx.lineWidth = 2 * s;
    ctx.setLineDash([4 * s, 4 * s]);
    if (!this.reducedMotion) {
      ctx.lineDashOffset = -Math.floor(performance.now() / 30) % 8;
    }
    ctx.beginPath();
    ctx.moveTo(srcScreen.x, srcScreen.y);
    ctx.lineTo(tgtScreen.x, tgtScreen.y);
    ctx.stroke();
    
    const radius = 24 * s;
    ctx.strokeStyle = "#70e5d0";
    ctx.lineWidth = 2 * s;
    ctx.setLineDash([]);
    ctx.beginPath();
    const pulse = this.reducedMotion ? 0.0 : Math.sin(performance.now() * 0.005) * 4 * s;
    ctx.arc(tgtScreen.x, tgtScreen.y, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = "rgba(112, 229, 208, 0.3)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(tgtScreen.x, tgtScreen.y, radius + 8 * s + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.objectFeedback?.destroy();
    this.objectFeedback = null;
    this.bridgeGeneration += 1;
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    if (this.pointerHandlers) {
      this.canvas?.removeEventListener("pointerdown", this.pointerHandlers.down);
      this.canvas?.removeEventListener("pointermove", this.pointerHandlers.move);
      this.canvas?.removeEventListener("pointerup", this.pointerHandlers.up);
      this.canvas?.removeEventListener("pointercancel", this.pointerHandlers.cancel);
      this.canvas?.removeEventListener("lostpointercapture", this.pointerHandlers.lostCapture);
      this.canvas?.removeEventListener("pointerleave", this.pointerHandlers.leave);
      this.canvas?.removeEventListener("blur", this.pointerHandlers.blur);
      this.canvas?.removeEventListener("contextmenu", this.pointerHandlers.contextmenu);
      this.canvas?.removeEventListener("wheel", this.pointerHandlers.wheel);
    }
    if (this.keydownHandler) {
      this.canvas?.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      this.canvas?.removeEventListener("keyup", this.keyupHandler);
      this.keyupHandler = null;
    }
    if (this.blurHandler) {
      this.canvas?.removeEventListener("blur", this.blurHandler);
      this.blurHandler = null;
    }
    this.pressed.clear();
    if (this.placementErrorTimer) {
      (window.clearTimeout ?? globalThis.clearTimeout)(this.placementErrorTimer);
      this.placementErrorTimer = null;
    }
    if (this.handleVisibilityChange) {
      globalThis.document?.removeEventListener?.("visibilitychange", this.handleVisibilityChange);
    }
    if (this.actionFeedbackTimer !== null) (window.clearTimeout ?? globalThis.clearTimeout)(this.actionFeedbackTimer);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.audio?.ctx?.close?.().catch?.(() => undefined);

    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.actionFx = [];
    this.nodes = [];
    this.clearRoutePreview();
    this.selection.clear();
    this.emitSelectionChange();
    this.unitAtlases.clear();
    this.staticChunks.clear();
    this.staticChunksList = [];
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
