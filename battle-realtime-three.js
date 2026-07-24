// Real-time WebGL/three.js presentation adapter for the defense session.
// It deliberately owns neither time nor game input; the session supplies snapshots.
// When a genuine WebGL2 context is unavailable (older browsers, headless test
// environments), this composes an internal BattleVisualizer instance and
// delegates every call to it — the public contract is identical either way.
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "./vendor/utils/SkeletonUtils.js";
import { BattleVisualizer } from "./battle-visualizer.js";

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

function hasRealWebGL2(canvas) {
  try {
    const gl = canvas?.getContext?.("webgl2", { failIfMajorPerformanceCaveat: false });
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
    this.clipsByRoot = new Map(); // meshRootName -> Map<suffix, AnimationClip>
    this.instances = new Map(); // entityId -> { object, mixer, action, clipName, lastX, lastZ }
    this.modelPromise = null;
    this.modelReady = false;
    this.terrainKey = null;
    this.terrainObject = null;
    this.bossSlotObject = null;
    this.gateMarker = null;
    this.camera = { yaw: 0, pitch: CAMERA_PITCH_DEFAULT, distance: 1, zoomFactor: CAMERA_ZOOM_DEFAULT_FACTOR };
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.lastFrameAt = 0;
    this.stageWorld = DEFAULT_STAGE_WORLD;
    this.renderer = null;
    this.scene = null;
    this.perspectiveCamera = null;
  }

  mount({ canvas, handoff, viewport } = {}) {
    void handoff;
    this.dispose();
    this.canvas = canvas ?? null;
    this.viewport = viewport ?? null;
    this.disposed = false;
    const gl = this.canvas ? hasRealWebGL2(this.canvas) : null;
    if (!gl) {
      this.usingFallback = true;
      this.fallback = new BattleVisualizer(this.options).mount({ canvas, handoff, viewport });
      return this;
    }
    this.usingFallback = false;
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

  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.usingFallback) return this.fallback?.renderSnapshot(snapshot, frame);
    if (this.disposed || !this.canvas || !this.renderer) return;
    const gl = this.renderer.getContext();
    if (gl.isContextLost()) throw new Error("WebGL context lost");
    const width = Math.max(1, number(this.viewport?.width, number(this.canvas.width, 1)));
    const height = Math.max(1, number(this.viewport?.height, number(this.canvas.height, 1)));
    const currentSize = this.renderer.getSize(new THREE.Vector2());
    if (currentSize.x !== width || currentSize.y !== height) {
      this.renderer.setSize(width, height, false);
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
    for (const enemy of Array.isArray(snapshot.enemies) ? snapshot.enemies : []) {
      seen.add(enemy.id);
      this.updateEntity(enemy, meshNameFor(enemy), halfX, halfZ, deltaSeconds, events);
    }
    for (const companion of Array.isArray(snapshot.companions) ? snapshot.companions : []) {
      seen.add(companion.id);
      this.updateEntity(companion, meshNameFor(companion), halfX, halfZ, deltaSeconds, events);
    }
    if (snapshot.boss && !Array.isArray(snapshot.boss)) {
      const bossId = snapshot.boss.id ?? "boss";
      seen.add(bossId);
      this.updateEntity({ ...snapshot.boss, id: bossId }, world.boss, halfX, halfZ, deltaSeconds, events);
    }
    this.pruneStale(seen);

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
    this.clipsByRoot.clear();
    this.modelPromise = null;
    this.modelReady = false;
    this.terrainKey = null;
    this.terrainObject = null;
    this.bossSlotObject = null;
    this.gateMarker = null;
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
