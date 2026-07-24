// Real-time WebGL/three.js presentation adapter for the defense session.
// It deliberately owns neither time nor game input; the session supplies snapshots.
// When a genuine WebGL2 context is unavailable (older browsers, headless test
// environments), this composes an internal BattleVisualizer instance and
// delegates every call to it — the public contract is identical either way.
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "./vendor/utils/SkeletonUtils.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { ARENA } from "./defense-catalog.js";

const MODEL_URL = "./assets/models/abyssal-command/abyssal-command-resource-pack.glb";

// Per-stage terrain/boss root names and measured walkable half-extents (world
// units, derived from the GLB's own accessor bounds — see the terrain's
// bridge/spine/dais meshes, excluding purely decorative edge geometry).
const STAGE_WORLD = Object.freeze({
  "cinder-span": { terrain: "cinder-span-root", boss: "cinder-warden-root", halfX: 0.85, halfZ: 0.47 },
  "veil-citadel": { terrain: "veil-citadel-root", boss: "veil-tactician-root", halfX: 2.2, halfZ: 1.7 },
  "echo-throne": { terrain: "echo-throne-steps-root", boss: "gate-sovereign-root", halfX: 11, halfZ: 4 },
});
const DEFAULT_STAGE_WORLD = STAGE_WORLD["cinder-span"];

const COMMANDER_MESH = "shade-root";
const ENEMY_MESH = Object.freeze({
  rusher: "possessed-root",
  flanker: "reinforce-root",
  guardian: "guard-root",
  ranged: "scout-root",
});
const DEFAULT_ENEMY_MESH = "possessed-root";
// Companions are captured elites; each stage's eliteKind fixes which enemy
// mesh they carry over as an ally (ember-cohort/rift-lens/throne-echo are the
// three currently reachable stages' elite companions).
const COMPANION_MESH = Object.freeze({
  "ember-cohort": ENEMY_MESH.rusher,
  "rift-lens": ENEMY_MESH.flanker,
  "throne-echo": ENEMY_MESH.ranged,
});

// One-shot combat clips, triggered when this tick's snapshot carries an event
// naming this entity as the actor (`entityId`) — mirrors battle-visualizer.js's
// FEEDBACK_EFFECTS event-type vocabulary (CRITICAL_HIT/COMMANDER_DAMAGED/
// SKILL_CAST field shapes; see defense-run-simulation.js emit() call sites),
// not the generic ANIMATION_CLIPS catalog names.
const ACTOR_EVENT_CLIP = Object.freeze({
  CRITICAL_HIT: "Strike",
  COMMANDER_DAMAGED: "Strike",
  SKILL_CAST: "Special",
});

const CAMERA_PITCH_MIN = 30 * (Math.PI / 180);
const CAMERA_PITCH_MAX = 85 * (Math.PI / 180);
const CAMERA_PITCH_DEFAULT = 65 * (Math.PI / 180);
const CAMERA_FOLLOW_EASING = 0.18;
const CAMERA_ZOOM_MIN_FACTOR = 1.4;
const CAMERA_ZOOM_MAX_FACTOR = 5;
const CAMERA_ZOOM_DEFAULT_FACTOR = 2.4;
const MAX_FRAME_DELTA_SECONDS = 0.1;
// On a software rasterizer (no GPU — e.g. SwiftShader/llvmpipe on headless CI or a
// low-end device) per-pixel fragment cost dominates the frame. Cap the absolute drawn
// backbuffer to this many pixels so frame time stays bounded regardless of the CSS
// canvas size; the smaller buffer is stretched to fill the rect. No-op on real GPUs.
// ~0.18 MP keeps the software path well under a 100 ms rAF-mean budget.
const SOFTWARE_MAX_BACKBUFFER_PX = 180000;

// Detect a software WebGL2 rasterizer via the debug-renderer extension, probed on a
// throwaway canvas: the real session context is created only once, and a second
// getContext on the same canvas ignores new attributes, so the antialias decision must
// be made BEFORE the real context exists. GPU/software status is process-wide, so the
// probe reliably predicts the real context. Defaults to false (full quality) when the
// extension is unavailable — real GPUs never need the downgrade.
function detectSoftwareWebGL() {
  try {
    const probe = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const gl = probe?.getContext?.("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext?.();
    return /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
  } catch {
    return false;
  }
}

function hasRealWebGL2(canvas, softwareRenderer = false) {
  try {
    const gl = canvas?.getContext?.("webgl2", { antialias: !softwareRenderer, failIfMajorPerformanceCaveat: false });
    return typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext ? gl : null;
  } catch {
    return null;
  }
}

function number(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function entityWorldPoint(entity, halfX, halfZ) {
  return { x: number(entity?.x, 0) * halfX, z: number(entity?.y, 0) * halfZ };
}

/** Ported verbatim from battle-visualizer.js's healthRatio()/healthColor() so both
 * renderers show identical health feedback semantics — null when the entity has no
 * recognizable HP fields (e.g. pickups/projectiles), else clamped [0,1]. */
function healthRatio(entity) {
  const current = number(entity?.integrity, number(entity?.hp, number(entity?.health, NaN)));
  const maximum = number(entity?.maxIntegrity, number(entity?.maxHp, number(entity?.maxHealth, NaN)));
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return null;
  return Math.max(0, Math.min(1, current / maximum));
}
function healthColor(ratio) {
  // Same hue ramp as battle-visualizer.js's healthColor(): red (low) -> green (high).
  const color = new THREE.Color();
  color.setHSL((6 + ratio * 138) / 360, 0.82, 0.64);
  return color;
}

function meshNameFor(entity) {
  if (entity?.id === "commander") return COMMANDER_MESH;
  if (entity?.class === "boss") return null; // resolved from stage boss root, not this map
  if (entity?.kind === "companion") return COMPANION_MESH[entity.companionId] ?? DEFAULT_ENEMY_MESH;
  return ENEMY_MESH[entity?.kind] ?? DEFAULT_ENEMY_MESH;
}

/** First matching one-shot clip suffix for events naming this entity as actor this tick, else null. */
function actorClipFor(entityId, events) {
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.entityId !== entityId) continue;
    const clip = ACTOR_EVENT_CLIP[event?.type];
    if (clip) return clip;
  }
  return null;
}

/** Real-time three.js adapter, composing a Canvas2D fallback when WebGL2 is unavailable. */
export class RealtimeBattle {
  constructor(options = {}) {
    this.options = options;
    this.disposed = true;
    this.usingFallback = false;
    this.fallback = null;
    this.canvas = null;
    this.viewport = null;
    this.lastFeedback = null;
    this.templates = new Map(); // meshRootName -> Object3D subtree (source, never rendered directly)
    this.footprintRadii = new Map(); // meshRootName -> measured "ring around the feet" radius (world units, see loadModel())
    this.clipsByRoot = new Map(); // meshRootName -> Map<suffix, AnimationClip>
    this.instances = new Map(); // entityId -> { object, mixer, action, clipName, lastX, lastZ }
    this.modelPromise = null;
    this.modelReady = false;
    this.terrainKey = null;
    this.terrainObject = null;
    this.bossSlotObject = null;
    this.gateMarker = null;
    // Pure-shape world-space HUD billboards (Cycle 3 Track 3, ui/lane-hud-layout.md
    // §1 rows 10/12/13/14 — rotation-symmetric shapes kept as 3D geometry per the
    // doc's Option B guidance, unlike rows 11/15/16 which are DOM overlays).
    this.selfMarker = null; // row 10: player ground marker + sight ring (static geometry, repositioned per frame)
    this.healthRings = new Map(); // row 12: entityId -> Mesh, one ring per live enemy/boss (rebuilt on hp change)
    this.dangerTelegraph = null; // row 13: boss attack-windup ground disc (single instance, toggled visible)
    this.extractionRing = null; // row 14: extraction-hold progress gauge (single instance, toggled visible)
    this.camera = { yaw: 0, pitch: CAMERA_PITCH_DEFAULT, distance: 1, zoomFactor: CAMERA_ZOOM_DEFAULT_FACTOR };
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.lastFrameAt = 0;
    this.stageWorld = DEFAULT_STAGE_WORLD;
    this.renderer = null;
    this.scene = null;
    this.perspectiveCamera = null;
    this.softwareRenderer = false;
  }

  mount({ canvas, handoff, viewport } = {}) {
    void handoff;
    this.dispose();
    this.canvas = canvas ?? null;
    this.viewport = viewport ?? null;
    this.disposed = false;
    const software = this.canvas ? detectSoftwareWebGL() : false;
    const gl = this.canvas ? hasRealWebGL2(this.canvas, software) : null;
    if (!gl) {
      this.usingFallback = true;
      this.fallback = new BattleVisualizer(this.options).mount({ canvas, handoff, viewport });
      return this;
    }
    this.usingFallback = false;
    this.softwareRenderer = software;
    this.initScene(gl);
    this.loadModel();
    return this;
  }

  initScene(gl) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: gl, antialias: true, alpha: false });
    this.renderer.setClearColor(0x030711, 1);
    this.scene = new THREE.Scene();
    this.perspectiveCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    this.scene.add(new THREE.HemisphereLight(0xfff2d6, 0x140a06, 0.9));
    const sun = new THREE.DirectionalLight(0xffd9a8, 1.4);
    sun.position.set(3, 6, 2);
    this.scene.add(sun);
  }

  loadModel() {
    if (this.modelPromise) return this.modelPromise;
    const loader = new GLTFLoader();
    this.modelPromise = new Promise((resolve, reject) => {
      loader.load(MODEL_URL, resolve, undefined, reject);
    }).then((gltf) => {
      for (const node of gltf.scene.children) this.templates.set(node.name, node);
      // Real per-mesh "personal space" footprint radius, measured from the GLB's
      // own bounding box (max horizontal half-extent + a small clearance margin) —
      // NOT derived from the simulation's ARENA-unit entity.radius field, which is
      // calibrated for whole-map position scaling (24000x12000 units) and produces
      // near-invisible values when misapplied to a local "ring around the feet"
      // extent (verified: commander ARENA radius=360 -> ~0.03 world units via the
      // position scale, vs. the commander mesh's own ~1.1 unit width). Mirrors
      // app.js's presentationRadius() pattern (decoupled per-role visual size) but
      // sourced from real geometry instead of hand-picked constants.
      this.footprintRadii = new Map();
      const footprintBox = new THREE.Box3();
      const footprintSize = new THREE.Vector3();
      for (const node of gltf.scene.children) {
        footprintBox.setFromObject(node);
        footprintBox.getSize(footprintSize);
        this.footprintRadii.set(node.name, Math.max(footprintSize.x, footprintSize.z) / 2 + 0.12);
      }
      const byRoot = new Map();
      for (const clip of gltf.animations) {
        const [root, suffix] = clip.name.split("__");
        if (!byRoot.has(root)) byRoot.set(root, new Map());
        byRoot.get(root).set(suffix, clip);
      }
      this.clipsByRoot = byRoot;
      this.modelReady = true;
    }).catch(() => {
      // Model failed to load: renderSnapshot keeps rendering camera/lights only,
      // matching the same "degrade, never throw mid-render" posture as the
      // Canvas2D fallback's own texture-load failure handling.
      this.modelReady = false;
    });
    return this.modelPromise;
  }

  ensureStageWorld(stageId) {
    const world = STAGE_WORLD[stageId] ?? DEFAULT_STAGE_WORLD;
    if (this.terrainKey === stageId) return world;
    this.terrainKey = stageId;
    this.stageWorld = world;
    if (this.terrainObject) { this.scene.remove(this.terrainObject); this.terrainObject = null; }
    if (this.bossSlotObject) { this.scene.remove(this.bossSlotObject); this.bossSlotObject = null; }
    const terrainSource = this.templates.get(world.terrain);
    if (terrainSource) {
      this.terrainObject = terrainSource.clone(true);
      this.scene.add(this.terrainObject);
    }
    if (!this.gateMarker) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.02, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x3de1d0, emissive: 0x1c6d64, emissiveIntensity: 1.2 }),
      );
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
      this.gateMarker = ring;
    }
    return world;
  }

  instanceFor(entityId, meshRootName) {
    let entry = this.instances.get(entityId);
    if (entry && entry.meshRootName === meshRootName) return entry;
    if (entry) { this.scene.remove(entry.object); entry.mixer.stopAllAction(); }
    const source = this.templates.get(meshRootName);
    if (!source) return null;
    const object = cloneSkeleton(source);
    this.scene.add(object);
    const mixer = new THREE.AnimationMixer(object);
    entry = { object, mixer, action: null, clipName: null, meshRootName, lastX: null, lastZ: null };
    this.instances.set(entityId, entry);
    return entry;
  }

  playClip(entry, meshRootName, suffix) {
    if (entry.clipName === suffix) return;
    const clip = this.clipsByRoot.get(meshRootName)?.get(suffix);
    if (!clip) return;
    const next = entry.mixer.clipAction(clip);
    if (entry.action && entry.action !== next) entry.action.fadeOut(0.15);
    next.reset().fadeIn(entry.action ? 0.15 : 0).play();
    entry.action = next;
    entry.clipName = suffix;
  }

  updateEntity(entity, meshRootName, halfX, halfZ, deltaSeconds, events) {
    const entry = this.instanceFor(entity.id, meshRootName);
    if (!entry) return;
    const point = entityWorldPoint(entity, halfX, halfZ);
    const moved = entry.lastX !== null && Math.hypot(point.x - entry.lastX, point.z - entry.lastZ) > 0.001;
    entry.object.position.set(point.x, 0, point.z);
    if (entry.lastX !== null) {
      const dx = point.x - entry.lastX;
      const dz = point.z - entry.lastZ;
      if (moved) entry.object.rotation.y = Math.atan2(dx, dz);
    }
    entry.lastX = point.x;
    entry.lastZ = point.z;
    const actorClip = actorClipFor(entity.id, events);
    this.playClip(entry, meshRootName, actorClip ?? (moved ? "Move" : "Idle"));
    entry.mixer.update(deltaSeconds);
    return entry;
  }

  pruneStale(seenIds) {
    for (const [id, entry] of this.instances) {
      if (seenIds.has(id)) continue;
      this.scene.remove(entry.object);
      entry.mixer.stopAllAction();
      this.instances.delete(id);
    }
  }

  /**
   * Projects a THREE world-space point to normalized device coordinates
   * ([-1,1] both axes, +y up, THREE convention) via the camera's current
   * view-projection matrix. Safe to call any time after renderSnapshot() has
   * run at least once this session (WebGLRenderer.render() updates the
   * camera's matrixWorldInverse/projectionMatrix internally before use).
   *
   * Returns null ONLY for points behind the camera (unrecoverable — no
   * meaningful screen position exists, verified: for this camera's
   * 0 < near < far, ndc.z > 1 always and only holds for view-space z >= 0,
   * i.e. behind or exactly at the camera plane) or when the renderer is
   * unmounted/using the Canvas2D fallback (no 3D camera at all).
   *
   * Otherwise ALWAYS returns { x, y, visible }: x/y are the raw (unclamped)
   * NDC coordinates, visible=true only when both are within [-1,1]. This
   * lets callers either hide on visible===false (nameplates, capture
   * prompt) or clamp x/y to the viewport edge for an offscreen-direction
   * indicator (e.g. a future waypoint arrow) — both are legitimate uses of
   * an in-front-but-outside-frustum point, so the raw values are preserved
   * rather than discarded.
   */
  worldToNDC(worldPoint) {
    if (this.usingFallback || !this.perspectiveCamera) return null;
    const ndc = worldPoint.clone().project(this.perspectiveCamera);
    if (ndc.z > 1 || ndc.z < -1) return null; // behind camera (or, in principle, beyond an inverted far plane — not reachable with this camera's near/far)
    const visible = ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1;
    return { x: ndc.x, y: ndc.y, visible };
  }

  /**
   * NDC projection of a tracked entity's current world ANCHOR position (feet/base
   * — every mesh sits at y=0 on the ground plane per updateEntity()). Callers that
   * want a label to float "above" the entity (nameplate, damage number) apply that
   * offset in CSS screen-space pixels AFTER this projection, not here — this scene's
   * world-space half-extent is stage-dependent and can be under 1 unit (see
   * STAGE_WORLD), so a world-unit height offset is not a stable "above the head"
   * distance across stages/zoom and can trivially overshoot the view frustum,
   * incorrectly reporting visible:false for an on-screen entity. Screen-space
   * pixel offsets are zoom-varying by design (matches how nameplates/floating
   * text behave in practice) but never break visibility.
   */
  projectEntityToScreen(entityId) {
    const entry = this.instances.get(entityId);
    if (!entry) return null;
    return this.worldToNDC(entry.object.position.clone());
  }

  /** NDC projection of the current stage's fixed extraction-zone GROUND position (STAGE_TACTICS[stageId].extraction, pre-normalized by the caller to [-1,1] sim space). See projectEntityToScreen() for why there is no world-unit height offset here. */
  projectStaticPoint(normalizedX, normalizedY) {
    if (!this.stageWorld) return null;
    const point = new THREE.Vector3(normalizedX * this.stageWorld.halfX, 0, normalizedY * this.stageWorld.halfZ);
    return this.worldToNDC(point);
  }

  applyCamera(commanderPoint, reducedMotion) {
    const target = new THREE.Vector3(commanderPoint.x, 0.9, commanderPoint.z);
    if (reducedMotion) this.cameraTarget.copy(target);
    else this.cameraTarget.lerp(target, CAMERA_FOLLOW_EASING);
    const distance = this.camera.zoomFactor * Math.max(this.stageWorld.halfX, this.stageWorld.halfZ, 0.5);
    const cosP = Math.cos(this.camera.pitch);
    this.perspectiveCamera.position.set(
      this.cameraTarget.x + distance * cosP * Math.sin(this.camera.yaw),
      this.cameraTarget.y + distance * Math.sin(this.camera.pitch),
      this.cameraTarget.z + distance * cosP * Math.cos(this.camera.yaw),
    );
    this.perspectiveCamera.lookAt(this.cameraTarget);
  }

  /**
   * Row 10 (ui/lane-hud-layout.md §1) — player ground marker + sight ring, kept as
   * 3D geometry per the doc's Option B guidance for rotation-symmetric shapes (no
   * DOM promotion needed: no text, no hit-testing). Sized from the commander mesh's
   * real measured footprint (see loadModel()'s footprintRadii), not the simulation's
   * ARENA-unit entity.radius (unrelated unit system, see loadModel() doc comment).
   */
  updateSelfMarker(commanderPoint) {
    if (!this.selfMarker) {
      const footprint = this.footprintRadii.get(COMMANDER_MESH) ?? 0.5;
      const group = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(footprint * 0.22, 16),
        new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.85 }),
      );
      dot.rotation.x = -Math.PI / 2;
      const sight = new THREE.Mesh(
        new THREE.RingGeometry(footprint * 1.6, footprint * 1.68, 32),
        new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
      );
      sight.rotation.x = -Math.PI / 2;
      group.add(dot, sight);
      this.scene.add(group);
      this.selfMarker = group;
    }
    this.selfMarker.position.set(commanderPoint.x, 0.02, commanderPoint.z);
  }

  /**
   * Row 12 — per-entity health ring (enemies + boss; companions already have a DOM
   * nameplate health bar via app.js renderWorldHud(), commander/gate already have a
   * screen-space HUD bar, see ui/lane-hud-layout.md rows 1-2 — this only covers
   * hostile entities, which have no other HP feedback in the WebGL path today).
   * Track+arc visual contract ported verbatim from battle-visualizer.js's
   * drawHealthRing()/healthColor() (see this file's healthRatio()/healthColor()).
   * Ring radius from the entity's real measured mesh footprint, matching
   * updateSelfMarker()'s reasoning.
   */
  updateHealthRing(entity, meshRootName, point) {
    const ratio = healthRatio(entity);
    if (ratio === null) { this.healthRings.get(entity.id)?.group && (this.healthRings.get(entity.id).group.visible = false); return; }
    const footprint = this.footprintRadii.get(meshRootName) ?? 0.5;
    const innerRadius = footprint * 1.15;
    const outerRadius = innerRadius + footprint * 0.08;
    let entry = this.healthRings.get(entity.id);
    if (!entry) {
      const group = new THREE.Group();
      const track = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, outerRadius, 32),
        new THREE.MeshBasicMaterial({ color: 0x2b2338, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      track.rotation.x = -Math.PI / 2;
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, outerRadius, 32, 1, 0, Math.PI * 2),
        new THREE.MeshBasicMaterial({ color: 0x70d3ae, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
      );
      arc.rotation.x = -Math.PI / 2;
      group.add(track, arc);
      this.scene.add(group);
      entry = { group, track, arc, lastQuantizedRatio: -1 };
      this.healthRings.set(entity.id, entry);
    }
    entry.group.visible = true;
    entry.group.position.set(point.x, 0.02, point.z);
    // Quantize to avoid a geometry rebuild every single frame for a slowly-ticking
    // HP value (24-tap dps ticks are common) — 50 steps is visually seamless.
    const quantized = Math.round(ratio * 50);
    if (quantized !== entry.lastQuantizedRatio) {
      entry.lastQuantizedRatio = quantized;
      entry.arc.geometry.dispose();
      entry.arc.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32, 1, -Math.PI / 2, Math.PI * 2 * ratio);
      entry.arc.material.color.copy(healthColor(ratio));
      entry.arc.visible = ratio > 0;
    }
  }

  /** Removes health rings for entities no longer present this frame (mirrors pruneStale()'s seenIds contract). */
  pruneHealthRings(seenIds) {
    for (const [id, entry] of this.healthRings) {
      if (seenIds.has(id)) continue;
      this.scene.remove(entry.group);
      entry.track.geometry.dispose();
      entry.track.material.dispose();
      entry.arc.geometry.dispose();
      entry.arc.material.dispose();
      this.healthRings.delete(id);
    }
  }

  /**
   * Row 13 — boss attack-windup ground telegraph. Driven by the simulation's own
   * `attackWindup` boolean (set true during the pre-melee-attack wind-up window,
   * see defense-run-simulation.js's BOSS_ATTACK_TELEGRAPHED emit site) — not a
   * cosmetic invention. Sized from the boss's real measured footprint, matching
   * the boss's own melee contact reach (contactRange = enemy.radius +
   * target.radius in ARENA units — see this method's doc note on why that ARENA
   * value itself isn't used directly: it's a different, incompatible unit system,
   * same reasoning as updateSelfMarker()). A single reused instance (never more
   * than one boss on-screen at a time in this game), toggled visible.
   */
  updateDangerTelegraph(boss, bossMeshRoot, point, reducedMotion) {
    const active = Boolean(boss?.class === "boss" && boss.attackWindup);
    if (!active) { if (this.dangerTelegraph) this.dangerTelegraph.visible = false; return; }
    if (!this.dangerTelegraph) {
      // Unit-radius geometry (inner 0.3, outer 1.9, i.e. reach = footprint*1.9 at
      // scale=footprint) built ONCE; per-frame updates only set position/scale/
      // opacity — never dispose/rebuild geometry in the hot render-loop path.
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 1.9, 40),
        new THREE.MeshBasicMaterial({ color: 0xe2545c, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      disc.rotation.x = -Math.PI / 2;
      this.scene.add(disc);
      this.dangerTelegraph = disc;
    }
    const footprint = this.footprintRadii.get(bossMeshRoot) ?? 0.9;
    this.dangerTelegraph.scale.setScalar(footprint); // melee contact reach, proportional to the boss's own measured size
    this.dangerTelegraph.position.set(point.x, 0.015, point.z);
    this.dangerTelegraph.visible = true;
    // Pulse opacity for urgency, matching battle-visualizer.js's reduced-motion
    // posture (march-ants dash animation off, shape/warning itself stays) —
    // reducedMotion holds a fixed mid-pulse opacity instead of animating it.
    this.dangerTelegraph.material.opacity = reducedMotion ? 0.5 : 0.32 + 0.28 * Math.abs(Math.sin(performance.now() / 220));
  }

  /**
   * Row 14 — extraction-hold progress gauge, at the stage's fixed extraction zone
   * (STAGE_TACTICS[stageId].extraction — same anchor app.js's renderWorldHud() uses
   * for the DOM capture-prompt text; this is the world-space visual companion to
   * that screen-space text, per ui/lane-hud-layout.md row 9's explicit "role
   * separation" note). Visible only while an extraction is actually open/holding —
   * matches defense-run-simulation.js's extractionOpen condition (availableAt set,
   * not completed, not past expiresAt).
   */
  updateExtractionRing(snapshot, halfX, halfZ) {
    const extraction = snapshot.tactics?.extraction;
    const progress = snapshot.extractionProgress;
    const extractionOpen = Boolean(extraction && progress?.availableAt !== null && progress?.availableAt !== undefined
      && !progress.completed && !progress.failed && snapshot.tick <= progress.expiresAt);
    if (!extractionOpen) { if (this.extractionRing) this.extractionRing.visible = false; return; }
    if (!this.extractionRing) {
      const group = new THREE.Group();
      const track = new THREE.Mesh(
        new THREE.RingGeometry(0.16, 0.19, 32),
        new THREE.MeshBasicMaterial({ color: 0x2f1f45, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      );
      track.rotation.x = -Math.PI / 2;
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(0.16, 0.19, 32, 1, -Math.PI / 2, 0),
        new THREE.MeshBasicMaterial({ color: 0xb992ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
      );
      arc.rotation.x = -Math.PI / 2;
      group.add(track, arc);
      group.userData.arc = arc;
      group.userData.lastQuantizedRatio = -1;
      this.scene.add(group);
      this.extractionRing = group;
    }
    // Normalize the extraction point's raw ARENA-unit coordinates the same way
    // app.js's projected()/project() does for every other entity (this field is
    // NOT included in that pass — see renderSnapshot()'s doc note — so it arrives
    // here in raw ARENA units, not the [-1,1] range entityWorldPoint() expects).
    const normalizedX = extraction.x / ARENA.width * 2 - 1;
    const normalizedY = extraction.y / ARENA.height * 2 - 1;
    this.extractionRing.position.set(normalizedX * halfX, 0.025, normalizedY * halfZ);
    this.extractionRing.visible = true;
    const ratio = Math.max(0, Math.min(1, (progress.holdTicks ?? 0) / Math.max(1, progress.maxHoldTicks ?? 1)));
    // Quantized the same way updateHealthRing() is, to avoid a geometry
    // dispose+rebuild every single frame in the render hot path (holdTicks only
    // advances by whole ticks anyway, so this loses no real precision).
    const quantized = Math.round(ratio * 50);
    if (quantized !== this.extractionRing.userData.lastQuantizedRatio) {
      this.extractionRing.userData.lastQuantizedRatio = quantized;
      const arc = this.extractionRing.userData.arc;
      arc.geometry.dispose();
      arc.geometry = new THREE.RingGeometry(0.16, 0.19, 32, 1, -Math.PI / 2, Math.PI * 2 * ratio);
      arc.visible = ratio > 0;
    }
  }

  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.usingFallback) return this.fallback?.renderSnapshot(snapshot, frame);
    if (this.disposed || !this.canvas || !this.renderer) return;
    const gl = this.renderer.getContext();
    if (gl.isContextLost()) throw new Error("WebGL context lost");
    const width = Math.max(1, number(this.viewport?.width, number(this.canvas.width, 1)));
    const height = Math.max(1, number(this.viewport?.height, number(this.canvas.height, 1)));
    // Software path: bound the drawn pixel count (see SOFTWARE_MAX_BACKBUFFER_PX). The
    // scale preserves aspect ratio, so camera aspect stays width/height (undistorted)
    // and setSize(...,false) leaves the CSS rect untouched — the smaller buffer is just
    // stretched to fill it. No-op on GPUs (bufferScale === 1).
    const bufferScale = this.softwareRenderer
      ? Math.min(1, Math.sqrt(SOFTWARE_MAX_BACKBUFFER_PX / (width * height)))
      : 1;
    const bufferWidth = Math.max(1, Math.round(width * bufferScale));
    const bufferHeight = Math.max(1, Math.round(height * bufferScale));
    // Guard on the raw canvas backing-store size too, not only three's cached
    // getSize(): app.js's resize() writes this.canvas.width/height directly to full
    // resolution on every resize/orientation change (viewport === the canvas). On the
    // software-clamp path a same-aspect resize leaves the recomputed target equal to
    // three's cached size, so setSize would be skipped while the backing store is now
    // full-res and the GL viewport stays clamped — GL would draw into a clamped
    // sub-rect (rest black). Comparing the canvas attrs re-clamps in one frame. No-op
    // on the GPU path, where bufferWidth === canvas.width by construction.
    const currentSize = this.renderer.getSize(new THREE.Vector2());
    if (
      currentSize.x !== bufferWidth ||
      currentSize.y !== bufferHeight ||
      this.canvas.width !== bufferWidth ||
      this.canvas.height !== bufferHeight
    ) {
      this.renderer.setSize(bufferWidth, bufferHeight, false);
      this.perspectiveCamera.aspect = width / height;
      this.perspectiveCamera.updateProjectionMatrix();
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const deltaSeconds = this.lastFrameAt ? Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, (now - this.lastFrameAt) / 1000)) : 0;
    this.lastFrameAt = now;

    if (!this.modelReady) {
      this.renderer.render(this.scene, this.perspectiveCamera);
      return;
    }
    const stageId = snapshot?.presentation?.stageId;
    const world = this.ensureStageWorld(stageId);
    const { halfX, halfZ } = world;
    const seen = new Set();
    const reducedMotion = frame?.reducedMotion === true;
    const events = snapshot.events;

    const commander = snapshot.commander;
    let commanderPoint = { x: 0, z: 0 };
    if (commander) {
      const commanderId = commander.id ?? "commander";
      seen.add(commanderId);
      const entry = this.updateEntity({ ...commander, id: commanderId }, COMMANDER_MESH, halfX, halfZ, deltaSeconds, events);
      if (entry) commanderPoint = { x: entry.object.position.x, z: entry.object.position.z };
    }
    const healthRingSeen = new Set();
    let bossEntityPoint = null;
    let bossEntity = null;
    // BUGFIX (found while implementing Track 3 health rings, pre-existing and
    // unrelated to this cycle's own changes): getRunSnapshot() (defense-run-
    // simulation.js) has NO top-level "boss" field — the boss is just another
    // entry in snapshot.enemies with class==="boss" (verified: grepped the full
    // getRunSnapshot() return object). The "if (snapshot.boss...)" branch this
    // replaces was therefore permanently unreachable dead code, and
    // meshNameFor() deliberately returns null for class==="boss" entities
    // (comment: "resolved from stage boss root, not this map") expecting a
    // caller to substitute world.boss — no caller ever did. Net effect: the
    // boss rendered with ZERO mesh in real WebGL for the entire life of this
    // renderer (verified empirically: fed a real live-boss snapshot to the
    // renderer, resulting instances Map had no entry for the boss's id).
    // Canvas2D's battle-visualizer.js is unaffected (it draws snapshot.enemies
    // generically by class, needing no separate mesh-name resolution).
    for (const enemy of Array.isArray(snapshot.enemies) ? snapshot.enemies : []) {
      seen.add(enemy.id);
      const isBoss = enemy.class === "boss";
      const meshRootName = isBoss ? world.boss : meshNameFor(enemy);
      const entry = this.updateEntity(enemy, meshRootName, halfX, halfZ, deltaSeconds, events);
      if (entry) {
        healthRingSeen.add(enemy.id);
        this.updateHealthRing(enemy, meshRootName, { x: entry.object.position.x, z: entry.object.position.z });
        if (isBoss) { bossEntityPoint = { x: entry.object.position.x, z: entry.object.position.z }; bossEntity = enemy; }
      }
    }
    for (const companion of Array.isArray(snapshot.companions) ? snapshot.companions : []) {
      seen.add(companion.id);
      this.updateEntity(companion, meshNameFor(companion), halfX, halfZ, deltaSeconds, events);
    }
    this.pruneStale(seen);
    this.pruneHealthRings(healthRingSeen);
    this.updateSelfMarker(commanderPoint);
    this.updateDangerTelegraph(bossEntity, world.boss, bossEntityPoint, reducedMotion);
    this.updateExtractionRing(snapshot, halfX, halfZ);

    if (this.gateMarker && snapshot.gate) {
      const point = entityWorldPoint(snapshot.gate, halfX, halfZ);
      this.gateMarker.position.set(point.x, 0.05, point.z);
    }

    this.applyCamera(commanderPoint, reducedMotion);
    this.renderer.render(this.scene, this.perspectiveCamera);
  }

  /** Called from app.js pointer-drag handling: one-finger drag orbits the camera. */
  orbit(deltaYaw, deltaPitch) {
    if (this.usingFallback) return;
    this.camera.yaw += deltaYaw;
    this.camera.pitch = Math.min(CAMERA_PITCH_MAX, Math.max(CAMERA_PITCH_MIN, this.camera.pitch + deltaPitch));
  }

  /** Called from app.js pinch handling: two-finger pinch zooms the camera. */
  zoom(deltaFactor) {
    if (this.usingFallback) return;
    this.camera.zoomFactor = Math.min(CAMERA_ZOOM_MAX_FACTOR, Math.max(CAMERA_ZOOM_MIN_FACTOR, this.camera.zoomFactor + deltaFactor));
  }

  onVisualFeedback(inputSeq) {
    if (this.usingFallback) return this.fallback?.onVisualFeedback(inputSeq);
    this.lastFeedback = inputSeq;
  }

  dispose() {
    if (this.fallback) { this.fallback.dispose(); this.fallback = null; }
    this.usingFallback = false;
    for (const entry of this.instances.values()) entry.mixer.stopAllAction();
    this.instances.clear();
    this.templates.clear();
    this.footprintRadii.clear();
    this.clipsByRoot.clear();
    this.modelPromise = null;
    this.modelReady = false;
    this.terrainKey = null;
    this.terrainObject = null;
    this.bossSlotObject = null;
    this.gateMarker = null;
    this.selfMarker = null;
    this.healthRings.clear();
    this.dangerTelegraph = null;
    this.extractionRing = null;
    if (this.scene) {
      this.scene.traverse((node) => {
        node.geometry?.dispose?.();
        const materials = Array.isArray(node.material) ? node.material : [node.material].filter(Boolean);
        for (const material of materials) {
          for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) {
            material[key]?.dispose?.();
          }
          material.dispose?.();
        }
      });
      this.scene.clear();
    }
    this.scene = null;
    this.perspectiveCamera = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas = null;
    this.viewport = null;
    this.lastFrameAt = 0;
    this.disposed = true;
  }

  debugMetrics() {
    if (this.usingFallback) return this.fallback?.debugMetrics() ?? { geometries: 0, textures: 0, programs: 0 };
    if (!this.renderer) return { geometries: 0, textures: 0, programs: 0 };
    const info = this.renderer.info;
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
  }
}
