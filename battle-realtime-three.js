import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import {
  createStageNavigation,
  TACTICAL_GIMMICKS,
} from "./stage-navigation.js";
import {
  resolveEnemyPattern,
  resolveBossPhase,
  getCombatAlertCue,
} from "./combat-systems.js";
import { ObjectFeedbackLayer } from "./object-feedback-layer.js";

// Stages 4-10 reuse the three shipped GLB terrain/boss sets (resource-budget
// compromise; dedicated models are a future upgrade). To keep each boss
// visually distinct despite the shared mesh, createBattleObjects() applies a
// per-stage emissive/base-color tint from presentation.palette.hostile on
// top of the reused materials. Terrain reuse carries no identity claim.
const STAGE_ASSETS = Object.freeze({
  1: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/cinder-warden.glb" }),
  2: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/veil-tactician.glb" }),
  3: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/gate-sovereign.glb" }),
  4: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/cinder-warden.glb" }),
  5: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/veil-tactician.glb" }),
  6: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/veil-tactician.glb" }),
  7: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/gate-sovereign.glb" }),
  8: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/cinder-warden.glb" }),
  9: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/gate-sovereign.glb" }),
  10: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/gate-sovereign.glb" }),
});
const MODEL_ROOT = "./assets/models/abyssal-command/";
const BATTLE_ACTION_SEMANTICS = Object.freeze({
  hunt: Object.freeze({ source: "portal", target: "extractor", actor: "commander", actorClip: "Special", sourceAsset: "shade", clip: "Special" }),
  extract: Object.freeze({ source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" }),
  materialize: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" }),
  capture: Object.freeze({ source: "commander", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  possess: Object.freeze({ source: "commander", target: "commander", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  domain: Object.freeze({ source: "commander", target: "commander", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  assault: Object.freeze({ source: "commander", target: "boss", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
});
const MOVE_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const SURGE_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const TERRAIN_ELEVATION_SCALE = 0.42;
const ENEMY_ADVANCE_SPEED = 2.4;
const ATTACK_RANGE = 1.9;
const ALLY_STRIKE_COOLDOWN = 0.55;
const TOWER_FIRE_COOLDOWN = 1.0;
const SHADE_INTERCEPT_RADIUS = 5;
const ACTION_INTERACTION_RADIUS = 3.0;
const EPSILON = 0.0001;
let rendererRequestSequence = 0;


// Presentation / Graphics Pass Configuration
const SHADOW_MAP_SIZE = 1024;
const SHADOW_CAMERA_SIZE = 18;
const SHADOW_CAMERA_NEAR = 0.5;
const SHADOW_CAMERA_FAR = 40;
const SHADOW_BIAS = -0.0008;
const FOG_DENSITY = 0.008;
const TONE_MAPPING_EXPOSURE = 1.05;
const FILL_LIGHT_INTENSITY = 0.65;
const RIM_LIGHT_INTENSITY = 0.85;
const RING_OPACITY = 0.4;
const CIRCLE_PROBES = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1]),
  Object.freeze([0.707, 0.707]), Object.freeze([0.707, -0.707]),
  Object.freeze([-0.707, 0.707]), Object.freeze([-0.707, -0.707]),
]);

function clipFor(clips, name) {
  const needle = name.toLowerCase();
  return clips.find((clip) => clip.name.toLowerCase() === needle || clip.name.toLowerCase().endsWith(`__${needle}`)) ?? null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function cappedPixelRatio(width, devicePixelRatio) {
  const pixelRatioCap = width <= 480 ? 1.25 : width <= 900 ? 1.5 : 2;
  return Math.min(devicePixelRatio || 1, pixelRatioCap);
}

function disposeUnique(resource, disposed) {
  if (!resource || disposed.has(resource)) return;
  disposed.add(resource);
  resource.dispose?.();
}

function disposeTextures(value, disposed, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  if (value.isTexture) {
    disposeUnique(value, disposed);
    return;
  }
  for (const nested of Object.values(value)) disposeTextures(nested, disposed, visited);
}

function disposeMaterialResources(material, disposed) {
  if (!material || disposed.has(material)) return;
  disposeTextures(material, disposed);
  disposeUnique(material, disposed);
}

function disposeObjectResources(root, disposed) {
  root?.traverse?.((node) => {
    if (!node.isMesh && !node.isPoints && !node.isLine) return;
    disposeUnique(node.geometry, disposed);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) disposeMaterialResources(material, disposed);
  });
}

const PARTICLE_CAPACITY = 360;
const AUDIO_ROOT = "./assets/audio/";

// Pooled point-sprite particle field for combat VFX (strike sparks, defeat
// ash, boss impacts, action bursts). One field per battle instance; all
// emitters share the same fixed-capacity buffer (additive-blended points),
// so cost is a single draw call regardless of how many effects are live.
export class ParticleField {
  constructor(scene) {
    this.capacity = PARTICLE_CAPACITY;
    this.cursor = 0;
    this.alive = new Uint8Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.maxLife = new Float32Array(this.capacity);
    this.velocity = new Float32Array(this.capacity * 3);
    this.gravity = new Float32Array(this.capacity);
    this.baseColor = new Float32Array(this.capacity * 3);
    this.disposed = false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // Emits `count` particles from (x, y, z) with the given color, spreading
  // outward at speeds in [speedMin, speedMax], living `life` seconds, pulled
  // down by `gravity` (world units/s^2; 0 = no fall, for rising wisps use a
  // negative value).
  emit(x, y, z, color, count, { speedMin = 0.8, speedMax = 2.4, life = 0.6, gravity = 2.2, upBias = 0.6 } = {}) {
    if (this.disposed) return false;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const position = this.points.geometry.attributes.position;
    const colors = this.points.geometry.attributes.color;
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.alive[i] = 1;
      const lifeSpan = life * (0.7 + Math.random() * 0.6);
      this.life[i] = lifeSpan;
      this.maxLife[i] = lifeSpan;
      this.gravity[i] = gravity;
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const spread = Math.random();
      this.velocity[i * 3] = Math.cos(angle) * speed * spread;
      this.velocity[i * 3 + 1] = speed * upBias + Math.random() * speed * 0.5;
      this.velocity[i * 3 + 2] = Math.sin(angle) * speed * spread;
      this.baseColor[i * 3] = c.r;
      this.baseColor[i * 3 + 1] = c.g;
      this.baseColor[i * 3 + 2] = c.b;
      position.setXYZ(i, x, y, z);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    position.needsUpdate = true;
    colors.needsUpdate = true;
  }

  update(dt) {
    if (this.disposed) return false;
    const position = this.points.geometry.attributes.position;
    const color = this.points.geometry.attributes.color;
    let anyAlive = false;
    for (let i = 0; i < this.capacity; i += 1) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        color.setXYZ(i, 0, 0, 0);
        continue;
      }
      anyAlive = true;
      this.velocity[i * 3 + 1] -= this.gravity[i] * dt;
      const px = position.getX(i) + this.velocity[i * 3] * dt;
      const py = Math.max(0, position.getY(i) + this.velocity[i * 3 + 1] * dt);
      const pz = position.getZ(i) + this.velocity[i * 3 + 2] * dt;
      position.setXYZ(i, px, py, pz);
      const fade = Math.max(0, this.life[i] / this.maxLife[i]);
      color.setXYZ(i, this.baseColor[i * 3] * fade, this.baseColor[i * 3 + 1] * fade, this.baseColor[i * 3 + 2] * fade);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    return anyAlive;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points = null;
  }
}

// Real 3D positional audio for combat events: shipped action-cue mp3s panned
// by PannerNode for materialize/capture/possess/domain/hunt/extract/assault,
// plus short procedural oscillator hits (no new audio assets needed) for
// continuous per-frame combat events that have no authored cue: strike
// clash, boss impact, defeat, breach, wave-cleared. Listener follows the
// camera every frame so panning/distance stays correct as the player orbits.
export class SpatialAudio {
  constructor() {
    const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
    this.ctx = AudioCtx ? new AudioCtx() : null;
    this.buffers = new Map();
    this.master = null;
    this.listenerForward = new THREE.Vector3();
    this.disposed = false;
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
  }

  async loadSample(name) {
    if (this.disposed) return null;
    const context = this.ctx;
    if (!context) return null;
    if (this.buffers.has(name)) return this.buffers.get(name);
    const promise = fetch(`${AUDIO_ROOT}${name}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? context.decodeAudioData(data) : null))
      .catch(() => null);
    this.buffers.set(name, promise);
    return promise;
  }

  updateListener(camera) {
    if (this.disposed || !this.ctx || !camera?.position) return;
    const listener = this.ctx.listener;
    const p = camera.position;
    if (listener.positionX) {
      listener.positionX.value = p.x;
      listener.positionY.value = p.y;
      listener.positionZ.value = p.z;
    } else if (listener.setPosition) {
      listener.setPosition(p.x, p.y, p.z);
    }
    if (typeof camera.getWorldDirection !== "function") return;
    const forward = this.listenerForward;
    camera.getWorldDirection(forward);
    if (listener.forwardX) {
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else if (listener.setOrientation) {
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  makePanner(x, y, z, context = this.ctx) {
    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 4;
    panner.maxDistance = 40;
    panner.rolloffFactor = 1.1;
    panner.positionX ? panner.positionX.value = x : panner.setPosition(x, y, z);
    if (panner.positionX) { panner.positionY.value = y; panner.positionZ.value = z; }
    return panner;
  }

  // Plays a shipped mp3 (hunt/extract/materialize/capture/possess/domain/assault)
  // positioned at world (x, y, z).
  async playSample(name, x, y, z, gain = 0.8) {
    const context = this.ctx;
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => undefined);
    const buffer = await this.loadSample(name);
    if (!buffer) return;
    if (this.ctx !== context || context.state === "closed" || !this.master) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gainNode = context.createGain();
    gainNode.gain.value = gain;
    const panner = this.makePanner(x, y, z, context);
    source.connect(gainNode).connect(panner).connect(this.master);
    source.start();
    source.addEventListener("ended", () => {
      source.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    }, { once: true });
  }

  // Short procedural blip (no audio file) for high-frequency combat events:
  // strike clash, boss impact, defeat, breach. Same technique already
  // proven in the Canvas 2D fallback's playSpatial(); ported to real 3D
  // panning here instead of virtual-listener 2D math.
  playTone(x, y, z, { freq = 320, endFreq = freq, duration = 0.18, type = "triangle", gain = 0.7 } = {}) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
    if (this.ctx.state === "closed") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const panner = this.makePanner(x, y, z);
    osc.connect(gainNode).connect(panner).connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
    osc.addEventListener("ended", () => {
      osc.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    }, { once: true });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.buffers.clear();
    this.master?.disconnect();
    this.master = null;
    const context = this.ctx;
    this.ctx = null;
    if (context && context.state !== "closed") context.close().catch(() => undefined);
  }
}

export class RealtimeBattle {
  constructor(canvas, presentation, options = {}) {
    this.canvas = canvas;
    this.presentation = presentation;
    this.stageNumber = Math.max(1, Math.min(10, Number(presentation?.stageNumber) || 1));
    this.nodeGoal = Math.max(1, Number(options.nodeGoal) || 1);
    this.requestAction = typeof options.onActionRequest === "function" ? options.onActionRequest : null;
    this.getAvailableActions = typeof options.getAvailableActions === "function" ? options.getAvailableActions : null;
    this.onAssetStatus = typeof options.onAssetStatus === "function" ? options.onAssetStatus : null;
    this.onRendererFailure = typeof options.onRendererFailure === "function" ? options.onRendererFailure : null;
    this.onEncounterEvent = typeof options.onEncounterEvent === "function" ? options.onEncounterEvent : null;
    this.onRuntimeState = typeof options.onRuntimeState === "function" ? options.onRuntimeState : null;
    this.onActionFocus = typeof options.onActionFocus === "function" ? options.onActionFocus : null;
    this.onTacticalRequest = typeof options.onTacticalRequest === "function" ? options.onTacticalRequest : null;
    this.onSelectionChange = typeof options.onSelectionChange === "function" ? options.onSelectionChange : null;
    this.resolveFeedbackSpeech = typeof options.resolveFeedbackSpeech === "function"
      ? options.resolveFeedbackSpeech
      : (cue) => cue?.label ?? "Breach detected";
    this.cachedSelectionSummary = null;
    this.placementMode = null;
    this.deploymentsMap = new Map();
    this.selection = new Set();
    this.isMarqueeSelecting = false;
    this.marqueeRect = null;
    this.marqueeDiv = null;
    this.focusedCell = null;
    this.focusHighlightMesh = null;
    this.commanderPathLine = null;
    this.routePreview = null;
    this.routePreviewActive = false;
    this.tracers = [];
    this.frameShots = [];
    this.cachedNavigationSnapshot = null;
    this.fortificationLevel = 0;
    this.mobilityLevel = 0;
    this.commandLevel = 0;
    this.lastHoveredAction = null;
    this.previewActionSemantic = null;
    this.onEnemyBreach = null; // Legacy callback; encounter events take precedence.
    this.encounter = null;
    this.encounterSnapshot = null;
    this.currentWaveId = null;
    this.pendingEncounterEvent = null;
    this.encounterEventKeys = new Set();
    this.bossExposed = false;
    // Boss auto-attack ("boss-strike"): declarative per-stage pattern data
    // (see campaign-state.js STAGES[*].bossPattern), a countdown owned by
    // this renderer (mirrors how wave-start timing is renderer-owned), and
    // whether the commander is currently standing inside triggerRange — the
    // last flag drives the danger-ring HUD read in updateBossStrike().
    this.bossPattern = null;
    this.bossStrikeCooldownRemaining = 0;
    this.bossStrikeArmed = false;
    this.bossThreatRing = null;
    this.feedbackCanvas = options.feedbackCanvas ?? null;
    this.objectFeedback = this.feedbackCanvas
      ? new ObjectFeedbackLayer(this.feedbackCanvas, { reducedMotion: this.presentation?.reducedMotion ?? false })
      : null;
    this.feedbackCache = new Map();
    this.authoritativePossessed = false;
    this.echoThroneProp = null;
    this.rafCallback = null;
    this.lastBossHealth = null;
    this.bossMaxHealth = null;
    this.bossPhase = null;
    this.summonLevels = null;
    this.runtimeSignature = null;
    this.allies = [];
    this.allyPickRoots = [];
    this.nextActorId = 1;
    this.enemies = [];
    this.engagements = new Map();
    this.exchanges = 0;
    this.authoritativeLegion = null;
    this.templates = new Map();
    this.mixers = [];
    this.disposedResources = new Set();
    this.interactives = [];
    this.pressed = new Set();
    this.destroyed = false;
    this.droppedTime = 0;
    this.running = false;
    this.lastTime = 0;
    this.raf = 0;
    this.hud = null;
    this.navigation = createStageNavigation(this.stageNumber);
    this.staticBlockers = [];
    this.nodes = [];
    this.capturedCount = 0;
    this.accumulator = 0;
    this.commanderVelocity = new THREE.Vector2(0, 0);
    this.commanderPath = null;
    this.routeLines = [];
    const portalAnchor = this.navigation.anchors.portal;
    const portalWorld = this.navigation.gridToWorld(portalAnchor.x, portalAnchor.y);
    this.rally = new THREE.Vector3(portalWorld.x + 1.25, 0, portalWorld.z);
    this.commanderPosition = new THREE.Vector3(portalWorld.x, 0, portalWorld.z);
    this.commanderOrder = null;
    // Persistent "you are walking here" marker for the commander's own
    // click/right-click move order (distinct from routePreview, which only
    // exists transiently while a formation drag is in progress and always
    // clears on release). Built lazily in updateCommanderPathPreview().
    this.commanderDestinationMarker = null;
    // Same idea as commanderDestinationMarker, for a rallied ally group's
    // shared destination (this.rally). Built lazily in updateRallyMarker().
    this.allyRallyMarker = null;
    // Constant "how close do I need to be" affordance ring at the
    // commander's feet, sized to ACTION_INTERACTION_RADIUS. Built lazily in
    // updateActionRangeRing().
    this.actionRangeRing = null;
    const bounds = this.navigation.bounds;
    this.boundsCenter = new THREE.Vector3((bounds.left + bounds.right) * 0.5, 0, (bounds.near + bounds.far) * 0.5);
    this.cameraTarget = this.boundsCenter.clone();
    this.cameraOffset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.size = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0;
    this.raycaster.far = 80;
    this.pointerNdc = new THREE.Vector2();
    this.pointer = null;
    this.orbitAzimuth = 2.3;
    this.orbitElevation = 0.9;
    this.zoom = 16;
    this.safeNdcLimit = 0.84;
    this.minFitZoom = 16;
    this.hasManualZoomed = false;
    this._fitSamplePoints = null;
    this._fitCamera = null;
    this._fitProjectionScratch = null;
    this.enemySerial = 0;
    this.actionClips = 0;
    this.particles = null;
    this.contactGeometry = null;
    this.contactMaterial = null;
    this.audio = new SpatialAudio();
    this.shakeTime = 0;
    this.shakeMagnitude = 0;
    this.shakeDuration = 0;
    this.shakeSeed = Math.random() * 1000;
    this.hitStopTime = 0;
    this.footstepTimer = 0;
    this.ambientEmitTimer = 0;
    this.nodePulse = 0;
    this.portalPulse = 0;
    this.bound = {
      resize: () => this.resize(),
      frame: (time) => this.frame(time),
      visibility: () => this.onVisibility(),
      clearPressedInput: () => this.clearPressedInput(),
      blur: () => {
        this.clearPressedInput();
        this.clearHover();
      },
      contextLost: (event) => this.onContextLost(event),
      keydown: (event) => this.onKey(event, true),
      keyup: (event) => this.onKey(event, false),
      pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event),
      pointerup: (event) => this.onPointerUp(event),
      contextmenu: (event) => event.preventDefault(),
      pointercancel: (event) => this.onPointerCancel(event),
      wheel: (event) => this.onWheel(event),
      lostpointercapture: (event) => this.onLostPointerCapture(event),
      pointerleave: (event) => this.onPointerLeave(event),
    };
  }

  async init() {
    if (this.destroyed) throw new Error("Realtime battle was destroyed before initialization");
    this.navigation ??= createStageNavigation(this.stageNumber ?? 1);
    const gl = this.canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) {
      throw new Error("WebGL 2 is unavailable");
    }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: gl, antialias: true, alpha: false });
    const viewportWidth = Number(window.innerWidth) || 1440;
    this.renderer.setPixelRatio(cappedPixelRatio(viewportWidth, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(this.presentation?.palette?.background ?? "#060913", 1);

    // ACES filmic tone mapping with conservative exposure
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

    // Enable PCF soft shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Stage-aware concept-art backdrop
    const isTest = typeof process !== "undefined";
    if (!isTest && THREE.TextureLoader) {
      const loader = (this.textureLoader ??= new THREE.TextureLoader());
      const stageIdMap = {
        1: "cinder-span",
        2: "veil-citadel",
        3: "echo-throne",
        4: "sunken-bastion",
        5: "howling-sprawl",
        6: "glass-necropolis",
        7: "starless-canal",
        8: "shattered-causeway",
        9: "abyss-chancel",
        10: "gate-zenith",
      };
      const stageId = stageIdMap[this.stageNumber] || "cinder-span";
      const bgUrl = `./assets/images/${stageId}.png`;
      this.backgroundTexture = loader.load(bgUrl, (texture) => {
        if (this.destroyed || this.backgroundTexture !== texture) {
          if (texture && typeof texture.dispose === "function") {
            if (!this.disposedResources.has(texture)) {
              this.disposedResources.add(texture);
              texture.dispose();
            }
          }
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.scene.background = texture;
        this.resizeBackground();
      });
    }

    // Battlefield deck surface (documented material semantics in
    // presentation-spec.md: void-obsidian carries "mass"). Every walkable
    // tile in every stage reuses this one shared texture pair, so this is
    // the highest-impact fix for "flat, textureless resources" — the ground
    // under every unit's feet on every stage, not just one prop.
    this.groundAlbedoTexture = null;
    this.groundNormalTexture = null;
    if (!isTest && THREE.TextureLoader) {
      const pbrLoader = (this.textureLoader ??= new THREE.TextureLoader());
      const albedo = pbrLoader.load("./assets/models/abyssal-command/textures/void-obsidian-albedo.png");
      albedo.colorSpace = THREE.SRGBColorSpace;
      albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
      const normalMap = pbrLoader.load("./assets/models/abyssal-command/textures/void-obsidian-normal.png");
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      this.groundAlbedoTexture = albedo;
      this.groundNormalTexture = normalMap;
    }

    // Stage-palette fog/atmospheric depth
    const fogColor = this.presentation?.palette?.background ?? "#060913";
    this.scene.fog = new THREE.FogExp2(fogColor, FOG_DENSITY);

    const bounds = this.navigation.bounds;
    const mapWidth = bounds.right - bounds.left;
    const mapHeight = bounds.far - bounds.near;
    const maxDim = Math.max(mapWidth, mapHeight);
    this.zoom = 16 * Math.max(1, maxDim / 24);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, Math.max(120, this.zoom * 4));
    this.raycaster.far = Math.max(100, this.zoom * 3);

    // Hemisphere light with slightly lifted stage-colored ground to prevent crushed shadows
    const groundColor = (THREE.Color && this.presentation?.palette?.background)
      ? new THREE.Color(this.presentation.palette.background).lerp(new THREE.Color(0x3a4868), 0.35)
      : 0x1c2333;
    const hemiLight = new THREE.HemisphereLight(0x91b9d0, groundColor, 2.2);
    this.scene.add(hemiLight);

    // Ambient light with color matched to the stage's background/atmosphere palette
    if (THREE.AmbientLight) {
      const ambientColor = (THREE.Color && this.presentation?.palette?.background)
        ? new THREE.Color(this.presentation.palette.background).lerp(new THREE.Color(0xffffff), 0.3)
        : 0x505a70;
      const ambientLight = new THREE.AmbientLight(ambientColor, 0.95);
      this.scene.add(ambientLight);
      this.ambientLight = ambientLight;
    }

    // Configured directional shadow camera on key light
    const keyLight = new THREE.DirectionalLight(0xffe5c2, 2.6);
    keyLight.position.set(7, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
    keyLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
    keyLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
    const shadowCameraSize = maxDim * 0.75;
    keyLight.shadow.camera.left = -shadowCameraSize;
    keyLight.shadow.camera.right = shadowCameraSize;
    keyLight.shadow.camera.top = shadowCameraSize;
    keyLight.shadow.camera.bottom = -shadowCameraSize;
    keyLight.shadow.camera.far = maxDim * 2.0;
    keyLight.shadow.bias = SHADOW_BIAS;
    this.scene.add(keyLight);
    this.keyLight = keyLight;

    // Subtle stage-colored fill light
    const fillLightColor = this.presentation?.palette?.ally ?? 0x70e5d0;
    const fillLight = new THREE.DirectionalLight(fillLightColor, FILL_LIGHT_INTENSITY);
    fillLight.position.set(-8, 6, -6);
    this.scene.add(fillLight);
    this.fillLight = fillLight;

    // Subtle stage-colored rim light
    const rimLightColor = this.presentation?.palette?.accent ?? 0xffb85c;
    const rimLight = new THREE.DirectionalLight(rimLightColor, RIM_LIGHT_INTENSITY);
    rimLight.position.set(-2, 10, -12);
    this.scene.add(rimLight);
    this.rimLight = rimLight;

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth + 4, mapHeight + 4),
      new THREE.MeshStandardMaterial({ color: 0x10182a, transparent: true, opacity: 0.08, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.userData.ground = true;
    this.ground.receiveShadow = true; // Receive shadows on ground
    this.scene.add(this.ground);
    this.ringGeometry = new THREE.RingGeometry(0.8, 1.1, 16);
    this.contactGeometry = new THREE.RingGeometry(0, 0.45, 16);
    const contactColor = THREE.Color && this.presentation?.palette?.background
      ? new THREE.Color(this.presentation.palette.background).lerp(new THREE.Color(0x000000), 0.4)
      : 0x030611;
    this.contactMaterial = THREE.MeshBasicMaterial
      ? new THREE.MeshBasicMaterial({
        color: contactColor,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
      : null;
    this.particles = new ParticleField(this.scene);
    this.attachEvents();
    this.resize();
    this.updateCamera(0);
    await this.loadStageAssets();
    if (this.destroyed) throw new Error("WebGL context was lost while loading stage resources");
    this.createBattleObjects();
    if (Number.isInteger(this.authoritativeLegion)) this.reconcileAllies(this.authoritativeLegion);
    this.reconcileEncounterWave();
    this.syncBossExposure();
    if (this.navigation && this.navigation.routes && this.navigation.zones && this.navigation.cells) {
      const navigationRoutes = Array.isArray(this.navigation.routes) ? this.navigation.routes.map((route) => ({
        id: route.id,
        lane: route.lane,
        cells: Array.isArray(route.cells) ? route.cells.map((c) => ({ x: c.x, y: c.y })) : []
      })) : [];
      const navigationZones = Array.isArray(this.navigation.zones) ? this.navigation.zones.map((zone) => ({
        kind: zone.kind,
        cells: Array.isArray(zone.cells) ? zone.cells.map((c) => ({ x: c.x, y: c.y })) : []
      })) : [];
      const navigationAnchors = {
        portal: this.navigation.anchors?.portal ? { x: this.navigation.anchors.portal.x, y: this.navigation.anchors.portal.y } : null,
        boss: this.navigation.anchors?.boss ? { x: this.navigation.anchors.boss.x, y: this.navigation.anchors.boss.y } : null,
        extractor: this.navigation.anchors?.extractor ? { x: this.navigation.anchors.extractor.x, y: this.navigation.anchors.extractor.y } : null,
        rally: this.navigation.anchors?.rally ? { x: this.navigation.anchors.rally.x, y: this.navigation.anchors.rally.y } : null,
        alliedSpawn: this.navigation.anchors?.alliedSpawn ? { x: this.navigation.anchors.alliedSpawn.x, y: this.navigation.anchors.alliedSpawn.y } : null,
        nodes: Array.isArray(this.navigation.anchors?.nodes) ? this.navigation.anchors.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })) : [],
        hostileSpawns: Array.isArray(this.navigation.anchors?.hostileSpawns) ? this.navigation.anchors.hostileSpawns.map((s) => ({ id: s.id, x: s.x, y: s.y, routeIndex: s.routeIndex })) : []
      };
      this.cachedNavigationSnapshot = {
        width: this.navigation.width,
        height: this.navigation.height,
        cells: this.navigation.cells,
        routes: navigationRoutes,
        zones: navigationZones,
        anchors: navigationAnchors
      };
    }
    this.publishRuntimeState();
    this.rafCallback = this.bound?.frame ?? ((time) => this.frame(time));
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.rafCallback);
    return this;
  }

  attachEvents() {
    this.canvas.addEventListener("webglcontextlost", this.bound.contextLost, false);
    this.canvas.addEventListener("keydown", this.bound.keydown);
    this.canvas.addEventListener("keyup", this.bound.keyup);
    this.canvas.addEventListener("blur", this.bound.blur);
    this.canvas.addEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.addEventListener("pointermove", this.bound.pointermove);
    this.canvas.addEventListener("pointerup", this.bound.pointerup);
    this.canvas.addEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.addEventListener("lostpointercapture", this.bound.lostpointercapture);
    this.canvas.addEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.addEventListener("wheel", this.bound.wheel, { passive: false });
    this.canvas.addEventListener("pointerleave", this.bound.pointerleave);
    globalThis.window?.addEventListener("blur", this.bound.blur);
    document.addEventListener("visibilitychange", this.bound.visibility);
    this.resizeObserver = new ResizeObserver(this.bound.resize);
    this.resizeObserver.observe(this.canvas);
  }

  async loadStageAssets() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const resources = [stage.terrain, "units/shade.glb", "units/scout.glb", "units/guard.glb", "units/reinforce.glb", stage.boss];
    let loaded = 0;
    this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: 0 });
    // Required resources load concurrently rather than one-await-at-a-time:
    // each is an independent fetch+parse, so serializing them only adds up
    // network/parse latency for no benefit. Progress callbacks still fire as
    // each resource resolves, in whatever order that happens to be.
    await Promise.all(resources.map(async (resource) => {
      const gltf = await this.loadModel(resource);
      if (this.destroyed) {
        disposeObjectResources(gltf.scene, this.disposedResources);
        throw new Error("Realtime battle was destroyed while loading stage resources");
      }
      this.templates.set(resource, gltf);
      loaded += 1;
      this.actionClips += gltf.animations.length;
      this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: this.actionClips });
    }));
    this.onAssetStatus?.({ state: "loaded", loaded, total: resources.length, clips: this.actionClips });

    // Load the prop models in the background (awaited so they are available in createBattleObjects)
    const isTest = typeof process !== "undefined";
    if (!isTest) {
      const props = ["props/soul-extractor.glb", "props/rift-portal.glb", "props/command-obelisk.glb", "props/echo-throne.glb", "units/possessed.glb"];
      await Promise.all(props.map(async (prop) => {
        try {
          const gltf = await this.loadModel(prop);
          if (this.destroyed) {
            disposeObjectResources(gltf.scene, this.disposedResources);
            throw new Error("Realtime battle was destroyed while loading stage resources");
          }
          this.templates.set(prop, gltf);
        } catch (error) {
          if (this.destroyed) throw error;
        }
      }));
    }
  }

  async loadModel(resource) {
    const url = `${MODEL_ROOT}${resource}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load ${resource}`);
      const data = await response.arrayBuffer();
      const resourceBase = url.slice(0, url.lastIndexOf("/") + 1);
      const gltf = await new Promise((resolve, reject) => {
        (this.gltfLoader ??= new GLTFLoader()).parse(
          data,
          resourceBase,
          resolve,
          (error) => reject(error instanceof Error ? error : new Error(`Unable to load ${resource}`)),
        );
      });
      if (this.destroyed) {
        disposeObjectResources(gltf.scene, this.disposedResources);
        throw new Error(`Realtime battle was destroyed while loading ${resource}`);
      }
      return gltf;
    } catch (error) {
      throw error instanceof Error && error.message.includes(resource)
        ? error
        : new Error(`Unable to load ${resource}`);
    }
  }

  createBattleObjects() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const terrain = this.cloneTemplate(stage.terrain, 22);
    terrain.root.position.y -= 0.03;
    this.scene.add(terrain.root);
    this.terrain = terrain.root;

    // Construction of the instanced tactical deck for walkable cells
    const cells = this.navigation.cells;
    const gridWidth = this.navigation.width || 24;
    const gridHeight = this.navigation.height || 12;

    // Cache route cells by creating membership sets for lookup
    const routeKeySets = this.navigation.routes.map((route) => {
      const set = new Set();
      if (route && Array.isArray(route.cells)) {
        for (const cell of route.cells) {
          set.add(`${cell.x},${cell.y}`);
        }
      }
      return set;
    });

    const walkableCells = [];
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const elevation = cells[r] ? cells[r][c] : -1;
        if (elevation >= 0) {
          walkableCells.push({ c, r, elevation });
        }
      }
    }

    const deckCount = walkableCells.length;
    if (deckCount > 0) {
      // 0.92 x 0.08 x 0.92 box dimensions to leave elegant 0.08 gaps
      const deckGeometry = new THREE.BoxGeometry(0.92, 0.08, 0.92);
      const deckMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.groundAlbedoTexture ?? null,
        normalMap: this.groundNormalTexture ?? null,
        emissive: THREE.Color && this.presentation?.palette?.background
          ? new THREE.Color(this.presentation.palette.background).multiplyScalar(0.4)
          : new THREE.Color(0x060913),
        emissiveIntensity: 0.5,
        roughness: 0.72,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
      });

      const deckMesh = new THREE.InstancedMesh(deckGeometry, deckMaterial, deckCount);
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;

      this.deckGeometry = deckGeometry;
      this.deckMaterial = deckMaterial;
      this.deckMesh = deckMesh;

      const dummy = new THREE.Object3D();
      const muteColor = new THREE.Color(0x3b4252);
      const colorNeutral = muteColor.clone();
      const colorJunction = new THREE.Color(0x4c566a);
      
      const routeColors = [
        new THREE.Color(this.presentation?.palette?.ally ?? 0x70e5d0).lerp(muteColor, 0.55),
        new THREE.Color(this.presentation?.palette?.accent ?? 0xffb85c).lerp(muteColor, 0.55),
        new THREE.Color(this.presentation?.palette?.hostile ?? 0xff7f79).lerp(muteColor, 0.55),
      ];

      for (let i = 0; i < deckCount; i++) {
        const { c, r, elevation } = walkableCells[i];
        const world = this.navigation.gridToWorld(c + 0.5, r + 0.5);
        // Keep the deck clearly above the transparent picking plane.
        const yPos = elevation * TERRAIN_ELEVATION_SCALE + 0.02;

        dummy.position.set(world.x, yPos, world.z);
        dummy.updateMatrix();
        deckMesh.setMatrixAt(i, dummy.matrix);

        // Determine route membership
        const key = `${c},${r}`;
        const memberOf = [];
        for (let ri = 0; ri < routeKeySets.length; ri++) {
          if (routeKeySets[ri].has(key)) {
            memberOf.push(ri);
          }
        }

        let tileColor;
        if (memberOf.length === 0) {
          tileColor = colorNeutral.clone();
        } else if (memberOf.length === 1) {
          const rIndex = memberOf[0];
          tileColor = routeColors[rIndex].clone();
        } else {
          // Junction of multiple routes
          tileColor = colorJunction.clone();
        }
        const gimmick = this.getGimmickAt(c, r);
        if (gimmick) {
          const gimmickColors = {
            hazard: new THREE.Color(0xef4444),
            current: new THREE.Color(0x3b82f6),
            "high-ground": new THREE.Color(0xf59e0b),
            cover: new THREE.Color(0x10b981),
            flank: new THREE.Color(0x8b5cf6),
            objective: new THREE.Color(0x06b6d4),
            exposed: new THREE.Color(0xec4899)
          };
          const gColor = gimmickColors[gimmick.kind];
          if (gColor) {
            const mutedGColor = gColor.clone().lerp(muteColor, 0.5);
            tileColor.lerp(mutedGColor, 0.45);
          }
        }
        deckMesh.setColorAt(i, tileColor);
      }

      deckMesh.instanceMatrix.needsUpdate = true;
      deckMesh.instanceColor.needsUpdate = true;
      this.scene.add(deckMesh);
    }

    // Create route lines
    this.routeLines = [];
    const routeColors = [
      this.presentation?.palette?.ally ?? "#70e5d0",
      this.presentation?.palette?.accent ?? "#ffb85c",
      this.presentation?.palette?.hostile ?? "#ff7f79",
    ];
    for (let i = 0; i < this.navigation.routes.length; i++) {
      const route = this.navigation.routes[i];
      const points = [];
      for (const cell of route.cells) {
        const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
        const nav = this.navigationAt(world.x, world.z);
        // Keep route lines above the raised deck surface.
        const y = nav.elevation * TERRAIN_ELEVATION_SCALE + 0.10;
        points.push(new THREE.Vector3(world.x, y, world.z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: routeColors[i % routeColors.length],
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: true,
      });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.routeLines.push(line);
    }

    const isTest = typeof process !== "undefined";

    const portalAnchor = this.navigation.anchors.portal;
    const portalPosition = this.gridToWorld(portalAnchor.x, portalAnchor.y);
    this.portal = this.makeMarker(0x87e8df, portalPosition.x, portalPosition.z, "materialize");
    this.portal.userData.semanticGroup = ["materialize", "domain"];
    this.portal.scale.set(0.7, 1.3, 0.7);
    this.registerStaticBlocker(this.portal, 0.65, false);
    this.scene.add(this.portal);

    const portalResource = "props/rift-portal.glb";
    if (!isTest && this.templates.has(portalResource)) {
      if (this.portal && this.portal.material) {
        this.portal.material.visible = false;
      }
      const portalModel = this.cloneTemplate(portalResource, 1.8);
      portalModel.root.position.copy(portalPosition);
      portalModel.root.position.y = this.navigationAt(portalPosition.x, portalPosition.z).elevation * TERRAIN_ELEVATION_SCALE;
      this.scene.add(portalModel.root);
      this.portalProp = portalModel;
      this.play(portalModel, "Idle");
    }

    // Create multiple nodes from anchors.nodes
    this.nodes = [];
    this.nodeProps = [];
    const nodeAnchors = this.navigation.anchors.nodes;
    for (let i = 0; i < nodeAnchors.length; i++) {
      const nodeAnchor = nodeAnchors[i];
      const nodePos = this.gridToWorld(nodeAnchor.x, nodeAnchor.y);
      const nodeMesh = this.makeMarker(0xffbc69, nodePos.x, nodePos.z, "capture");
      this.registerStaticBlocker(nodeMesh, 0.62, false);
      this.scene.add(nodeMesh);
      this.nodes.push(nodeMesh);

      const obeliskResource = "props/command-obelisk.glb";
      if (!isTest && this.templates.has(obeliskResource)) {
        if (nodeMesh.material) {
          nodeMesh.material.visible = false;
        }
        const obelisk = this.cloneTemplate(obeliskResource, 1.8);
        obelisk.root.position.copy(nodePos);
        obelisk.root.position.y = this.navigationAt(nodePos.x, nodePos.z).elevation * TERRAIN_ELEVATION_SCALE;
        this.scene.add(obelisk.root);
        this.nodeProps.push(obelisk);
        this.play(obelisk, "Idle");
      }
    }
    this.node = this.nodes[0] || null;
    this.updateNodeVisuals();

    // Create extractor prop at navigation.anchors.extractor
    const extractorResource = "props/soul-extractor.glb";
    if (this.navigation.anchors.extractor) {
      const extAnchor = this.navigation.anchors.extractor;
      const extPos = this.gridToWorld(extAnchor.x, extAnchor.y);
      this.extractor = this.makeMarker(0xeab308, extPos.x, extPos.z, "extract");
      this.extractor.userData.semanticGroup = ["hunt", "extract"];
      this.registerStaticBlocker(this.extractor, 0.7, false);
      this.scene.add(this.extractor);

      if (!isTest && this.templates.has(extractorResource)) {
        if (this.extractor && this.extractor.material) {
          this.extractor.material.visible = false;
        }
        const extractor = this.cloneTemplate(extractorResource, 1.8);
        this.setGroundedPosition(extractor, extPos.x, extPos.z);
        this.scene.add(extractor.root);
        this.extractorProp = extractor;
      }
    }

    const boss = this.cloneTemplate(stage.boss, 2.7);
    const bossAnchor = this.navigation.anchors.boss;
    const bossPosition = this.gridToWorld(bossAnchor.x, bossAnchor.y);
    this.setGroundedPosition(boss, bossPosition.x, bossPosition.z);
    boss.root.userData.pickRoot = boss.root;
    this.applyBossIdentityTint(boss.root);
    this.scene.add(boss.root);
    this.boss = boss;
    boss.id = "boss";
    boss.maxHealth = this.bossMaxHealth ?? this.lastBossHealth ?? null;
    if (this.bossPhase) this.applyBossPhaseVisual(this.bossPhase);
    this.registerStaticBlocker(boss.root, 1.18, true, () => boss.root.visible);
    this.interactives.push(boss.root);
    this.syncBossExposure();
    this.play(boss, "Idle");
    // Threat-range ring: a flat ground ring at bossPattern.triggerRange so
    // the player can *see* the boss's auto-attack range before ever taking
    // damage from it. updateBossStrike() brightens this ring as the boss's
    // cooldown counts down, so "about to hit you" is a visible read, not a
    // guess.
    if (stage.bossPattern && THREE.RingGeometry && THREE.MeshBasicMaterial) {
      const range = Math.max(0.5, Number(stage.bossPattern.triggerRange) || 4.5);
      const threatColor = this.presentation?.palette?.hostile ?? "#ff7f79";
      const ringGeom = new THREE.RingGeometry(range - 0.12, range, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: threatColor,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const threatRing = new THREE.Mesh(ringGeom, ringMat);
      threatRing.rotation.x = -Math.PI / 2;
      threatRing.position.set(bossPosition.x, 0.03, bossPosition.z);
      threatRing.raycast = () => {};
      this.scene.add(threatRing);
      this.bossThreatRing = threatRing;
    }

    const commander = this.cloneTemplate("units/shade.glb", 1.25);
    commander.radius = 0.42;
    this.setGroundedPosition(commander, this.commanderPosition.x, this.commanderPosition.z);
    this.commanderPosition.copy(commander.root.position);
    this.applyCommanderIdentityTint(commander.root);
    this.scene.add(commander.root);
    this.commander = commander;
    commander.id = "commander";
    this.play(commander, "Idle");
  }

  // The commander clones the shared units/shade.glb -- the same resource
  // every regular ally uses -- so without this it's visually indistinguishable
  // from its own legion. Tint it with a distinct violet identity color
  // (falls back to the Gate Sovereign rim hex used by the Blender build
  // pipeline for the same narrative "commander/sovereign" role) so the
  // player character always reads as one specific unit on the field.
  applyCommanderIdentityTint(root) {
    const hex = this.presentation?.palette?.commander ?? "#ab68ff";
    this.ownRuntimeMaterials(root);
    const tint = new THREE.Color(hex);
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (this.contactGeometry && node.geometry === this.contactGeometry) return;
      const wasArray = Array.isArray(node.material);
      const materials = wasArray ? node.material : [node.material];
      if (materials.includes(this.contactMaterial)) return;
      const tinted = materials.map((material) => {
        if (!material || material === this.contactMaterial) return material;
        material.userData = material.userData || {};
        material.userData.isCommanderIdentityTint = true;
        if (material.color) material.color.lerp(tint, 0.5);
        if ("emissive" in material) {
          if (material.emissive?.copy) material.emissive.copy(tint);
          else material.emissive = tint.clone();
          material.emissiveIntensity = 0.5;
          material.userData.runtimeEmissiveIntensityBase = 0.5;
        }
        return material;
      });
      node.material = wasArray ? tinted : tinted[0];
    });
  }

  // Stages 4-10 reuse a Stage 1-3 boss mesh (see STAGE_ASSETS comment). Tint
  // the reused materials with this stage's own hostile palette color so two
  // narratively distinct bosses never render as visually identical; stages
  // 1-3 keep their authored material untouched.
  applyBossIdentityTint(root) {
    if (this.stageNumber <= 3) return;
    const hex = this.presentation?.palette?.hostile;
    if (!hex) return;
    this.ownRuntimeMaterials(root);
    const tint = new THREE.Color(hex);
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (this.contactGeometry && node.geometry === this.contactGeometry) return;
      const wasArray = Array.isArray(node.material);
      const materials = wasArray ? node.material : [node.material];
      if (materials.includes(this.contactMaterial)) return;
      const tinted = materials.map((material) => {
        if (!material || material === this.contactMaterial) return material;
        material.userData = material.userData || {};
        material.userData.isBossIdentityTint = true;
        if (material.color) material.color.lerp(tint, 0.55);
        if ("emissive" in material) {
          if (material.emissive?.copy) material.emissive.copy(tint);
          else material.emissive = tint.clone();
          material.emissiveIntensity = 0.55;
          material.userData.runtimeEmissiveIntensityBase = 0.55;
        }
        return material;
      });
      node.material = wasArray ? tinted : tinted[0];
    });
  }

  makeMarker(color, x, z, semantic) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.75, 0.16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.55 }),
    );
    marker.position.set(x, this.navigationAt(x, z).elevation * TERRAIN_ELEVATION_SCALE + 0.08, z);
    marker.userData.semantic = semantic;
    marker.userData.pickRoot = marker;
    marker.castShadow = true;
    marker.receiveShadow = true;
    this.interactives.push(marker);

    // Create a low-cost ground ring / light halo to improve readability
    if (this.ringGeometry) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: RING_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(this.ringGeometry, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.07;
      marker.add(ring);
    }

    return marker;
  }

  gridToWorld(x, z) {
    const res = this.navigation.gridToWorld(x, z);
    return { x: res.x, z: res.z };
  }

  worldToGrid(x, z) {
    const res = this.navigation.worldToGrid(x, z);
    return { x: res.x, y: res.y };
  }

  navigationAt(x, z) {
    const grid = this.worldToGrid(x, z);
    const cellX = Math.floor(grid.x);
    const cellZ = Math.floor(grid.y);
    const height = this.navigation.heightAt(cellX, cellZ);
    return {
      x: grid.x,
      y: grid.y,
      elevation: Math.max(0, height),
      walkable: height >= 0,
    };
  }

  setNodeState(nodeMesh, status) {
    if (!nodeMesh) return;
    let colorHex;
    let opacity;
    let emissiveIntensity;
    let semantic;
    if (status === "captured") {
      colorHex = this.presentation?.palette?.node ?? 0xffbc69;
      opacity = 0.9;
      emissiveIntensity = 0.5;
      semantic = null;
    } else if (status === "next") {
      colorHex = this.presentation?.palette?.node ?? 0xffbc69;
      opacity = 1.0;
      emissiveIntensity = this.nodePulse;
      semantic = "capture";
    } else { // "future"
      colorHex = 0x71829b;
      opacity = 0.46;
      emissiveIntensity = 0.2;
      semantic = null;
    }

    const color = new THREE.Color(colorHex);

    if (nodeMesh.material) {
      if (nodeMesh.material.color && typeof nodeMesh.material.color.copy === "function") {
        nodeMesh.material.color.copy(color);
      } else {
        nodeMesh.material.color = color;
      }
      if (nodeMesh.material.emissive && typeof nodeMesh.material.emissive.copy === "function") {
        nodeMesh.material.emissive.copy(color);
      } else {
        nodeMesh.material.emissive = color;
      }
      nodeMesh.material.emissiveIntensity = emissiveIntensity;
      nodeMesh.material.transparent = true;
      nodeMesh.material.opacity = opacity;
    }

    nodeMesh.userData = nodeMesh.userData || {};
    nodeMesh.userData.semantic = semantic;

    if (typeof nodeMesh.traverse === "function") {
      nodeMesh.traverse((child) => {
        if (child !== nodeMesh && child.isMesh && child.material) {
          if (child.material.color && typeof child.material.color.copy === "function") {
            child.material.color.copy(color);
          } else {
            child.material.color = color;
          }
          child.material.transparent = true;
          child.material.opacity = opacity * RING_OPACITY;
        }
      });
    }
  }

  updateNodeVisuals() {
    if (!this.nodes || !this.nodes.length) return;
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeMesh = this.nodes[i];
      if (!nodeMesh) continue;
      let status = "future";
      if (i < this.capturedCount) {
        status = "captured";
      } else if (i === this.capturedCount) {
        status = "next";
      }
      this.setNodeState(nodeMesh, status);
    }
    const activeIndex = Math.min(this.nodes.length - 1, this.capturedCount);
    if (this.nodes[activeIndex]) {
      this.node = this.nodes[activeIndex];
    }
  }


  setGroundedPosition(instance, x, z) {
    const navigation = this.navigationAt(x, z);
    instance.root.position.set(x, navigation.elevation * TERRAIN_ELEVATION_SCALE, z);
  }

  registerStaticBlocker(root, radius, blocksMovement, active = () => true) {
    const collider = Object.freeze({ type: "circle", radius, blocksMovement });
    root.userData.collider = collider;
    this.staticBlockers.push({ root, radius, blocksMovement, active });
  }

  cloneTemplate(resource, targetSize) {
    const template = this.templates.get(resource);
    if (!template) throw new Error(`Missing stage template ${resource}`);
    const localRoot = template.scene.clone(true);
    const ownsHighlightMaterials = resource === "props/rift-portal.glb"
      || resource === "props/soul-extractor.glb"
      || resource === "props/command-obelisk.glb"
      || resource.startsWith("bosses/");
    if (ownsHighlightMaterials) this.ownRuntimeMaterials(localRoot);
    this.normalizeGroundCenter(localRoot, targetSize);

    // Transform boundary: localRoot holds the normalized GLTF model (scale & offset)
    // while root is the world-positioned container.
    const root = new THREE.Group();
    root.add(localRoot);

    const isTerrain = resource.startsWith("terrain/");
    if (isTerrain) {
      // Apply Y-axis compression to avoid burying units (0.65 height / 5.2 width = 0.125 ratio)
      const TERRAIN_Y_COMPRESSION = 0.125;
      localRoot.scale.y *= TERRAIN_Y_COMPRESSION;
      localRoot.position.y *= TERRAIN_Y_COMPRESSION;

      // Set terrain metadata for inspection
      root.userData.isTerrain = true;
      root.userData.terrainScaleY = localRoot.scale.y;
    }

    localRoot.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        // Material readability tuning
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const mat of materials) {
            if (mat.isMeshStandardMaterial) {
              const metalnessCap = isTerrain ? 0.55 : 0.7;
              const roughnessCap = isTerrain ? 0.72 : 0.8;
              if (mat.metalness > metalnessCap) mat.metalness = metalnessCap; // Tame excessive metallic blackness
              if (mat.roughness > roughnessCap) mat.roughness = roughnessCap;
              // Lift authored near-black terrain just enough for silhouette and relief readability.
              if (isTerrain && mat.color && (mat.color.r + mat.color.g + mat.color.b) < 0.48) {
                mat.color.multiplyScalar(1.35);
              }
              // Very subtle emissive color to prevent complete shadow blackness.
              const originallyZero = !mat.emissive || (mat.emissive.r === 0 && mat.emissive.g === 0 && mat.emissive.b === 0);
              if (originallyZero) {
                if (THREE.Color) {
                  mat.emissive = new THREE.Color(isTerrain ? 0x263454 : 0x1a1a1a);
                } else {
                  mat.emissive = isTerrain ? 0x263454 : 0x1a1a1a;
                }
                mat.emissiveIntensity = isTerrain ? 0.26 : 0.15;
              } else if (isTerrain) {
                mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.2);
              }
              // Restrained unit emissive lift for silhouette readability against the dark concept backdrop.
              if (resource.startsWith("units/")) {
                const isEnemy = resource.includes("scout") || resource.includes("guard") || resource.includes("reinforce");
                const unitColor = isEnemy
                  ? (this.presentation?.palette?.hostile ?? 0xff7f79)
                  : (this.presentation?.palette?.ally ?? 0x70e5d0);
                if (originallyZero) {
                  if (mat.emissive && typeof mat.emissive.set === "function") {
                    mat.emissive.set(unitColor);
                  } else {
                    mat.emissive = THREE.Color ? new THREE.Color(unitColor) : unitColor;
                  }
                  mat.emissiveIntensity = 0.45;
                } else {
                  mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.45);
                }
              } else if (!isTerrain) {
                // Non-terrain props / boss emissive lift
                if (originallyZero) {
                  const defaultColor = 0x1a1a1a;
                  if (mat.emissive && typeof mat.emissive.set === "function") {
                    mat.emissive.set(defaultColor);
                  } else {
                    mat.emissive = THREE.Color ? new THREE.Color(defaultColor) : defaultColor;
                  }
                  mat.emissiveIntensity = 0.15;
                } else {
                  mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.15);
                }
              }
            }
            if (mat?.userData?.isRuntimeOwnedMaterial) {
              mat.userData.runtimeEmissiveIntensityBase = Number(mat.emissiveIntensity) || 0;
            }
          }
        }
      }
    });

    // Add a contact shadow ring for model units and props, excluding terrain.
    // Geometry and material are renderer-owned because every clone shares them.
    if (!isTerrain && this.contactGeometry && this.contactMaterial) {
      const contactShadow = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.015; // Slightly elevated to prevent z-fighting
      contactShadow.raycast = () => {}; // Completely disable raycasting on the shadow mesh
      root.add(contactShadow);
    }

    const instance = { root, mixer: new THREE.AnimationMixer(root), clips: template.animations, actions: new Map(), active: null, cooldown: 0 };
    this.mixers.push(instance.mixer);
    return instance;
  }

  ownRuntimeMaterials(root) {
    const ownedBySource = new Map();
    root?.traverse?.((node) => {
      if (!node.isMesh || !node.material) return;
      const wasArray = Array.isArray(node.material);
      const sourceMaterials = wasArray ? node.material : [node.material];
      if (node.geometry === this.contactGeometry || sourceMaterials.includes(this.contactMaterial)) return;
      const ownedMaterials = sourceMaterials.map((material) => {
        if (!material || material === this.contactMaterial || material.userData?.isRuntimeOwnedMaterial) return material;
        let owned = ownedBySource.get(material);
        if (!owned) {
          owned = material.clone();
          owned.userData = owned.userData || {};
          owned.userData.isRuntimeOwnedMaterial = true;
          ownedBySource.set(material, owned);
        }
        return owned;
      });
      node.material = wasArray ? ownedMaterials : ownedMaterials[0];
    });
    if (root?.userData) delete root.userData.interactiveHighlightMaterials;
    return root;
  }

  normalizeGroundCenter(root, targetSize) {
    root.updateMatrixWorld(true);
    this.box.setFromObject(root);
    this.box.getSize(this.size);
    this.box.getCenter(this.center);
    const span = Math.max(this.size.x, this.size.z, EPSILON);
    const scale = targetSize / span;
    root.scale.setScalar(scale);
    root.position.set(-this.center.x * scale, -this.box.min.y * scale, -this.center.z * scale);
    root.updateMatrixWorld(true);
  }

  play(instance, name, once = false) {
    if (!instance?.clips) return;
    const clip = clipFor(instance.clips, name);
    if (!clip) return;
    let action = instance.actions.get(clip.name);
    if (!action) {
      action = instance.mixer.clipAction(clip);
      instance.actions.set(clip.name, action);
    }
    if (instance.active === action && action.isRunning()) return;
    if (instance.active && instance.active !== action) instance.active.fadeOut(0.1);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(0.1).play();
    instance.active = action;
  }

  frame(time) {
    if (!this.running || this.destroyed || document.hidden) {
      this.raf = 0;
      return;
    }
    this.frameShots = [];
    const rawDelta = (time - this.lastTime) / 1000;
    if (rawDelta > 0.10) {
      this.droppedTime += (rawDelta - 0.10);
    }
    let frameDelta = Math.max(0, rawDelta);
    this.lastTime = time;
    frameDelta = Math.min(0.10, frameDelta);

    let simDelta = frameDelta;
    if (this.hitStopTime > 0) {
      this.hitStopTime = Math.max(0, this.hitStopTime - frameDelta);
      simDelta = frameDelta * 0.06;
    }

    const SIM_TICK = 1 / 60;
    this.accumulator = (this.accumulator || 0) + simDelta;
    const maxAccumulator = 6 * SIM_TICK;
    if (this.accumulator > maxAccumulator) {
      this.droppedTime += (this.accumulator - maxAccumulator);
      this.accumulator = maxAccumulator;
    }

    while (this.accumulator >= SIM_TICK) {
      this.update(SIM_TICK);
      this.accumulator -= SIM_TICK;
    }
    this.updatePlacementPreview?.();
    this.updateFocusHighlight?.();
    this.updateSelectionVisuals?.();
    this.updateMarqueeVisual?.();
    this.updateCommanderPathPreview?.();
    this.updateRallyMarker?.();
    this.updateActionRangeRing?.();

    this.updateObjectFeedbackDeltas();
    this.renderObjectFeedback();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.rafCallback);
  }

  triggerHitStop(duration = 0.09) {
    this.hitStopTime = Math.max(this.hitStopTime, duration);
  }

  shakeCamera(magnitude, duration = 0.25) {
    const currentStrength = this.shakeMagnitude * (this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0);
    if (magnitude < currentStrength) return; // weaker pulse is already masked by the still-decaying stronger one
    this.shakeMagnitude = magnitude;
    this.shakeTime = duration;
    this.shakeDuration = duration;
  }

  update(dt) {
    this.reconcileEngagements();
    this.selectEngagements();
    this.updateEngagements(dt);
    this.reconcileEngagements();
    this.moveCommander(dt);
    this.updateAllies(dt);
    this.updateEnemies(dt);
    this.updateBossStrike(dt);
    this.updateTracers?.(dt);
    this.updateTowers?.(dt);
    this.updateZoneAmbience?.(dt);
    for (const mixer of this.mixers) mixer.update(dt);
    this.portal.rotation.y += dt * 0.8;
    for (const node of this.nodes) {
      if (node) node.rotation.y -= dt * 0.5;
    }
    if (this.node && !this.nodes.includes(this.node)) {
      this.node.rotation.y -= dt * 0.5;
    }
    this.updateMarkerPulses(dt);
    this.updateAmbience(dt);
    this.updatePreviewEmphasis(dt);
    this.particles?.update(dt);
    this.updateCamera(dt);
    this.audio.updateListener(this.camera);
    this.publishRuntimeState();
    this.emitSelectionChange();
  }

  // Boss auto-attack: fires independently of any player command whenever the
  // commander has been standing inside bossPattern.triggerRange for a full
  // cooldown window. campaign-state.js's applyEncounterEvent "boss-strike"
  // branch is the authoritative damage application; this method only decides
  // *when* to ask for it and how the wind-up reads on screen.
  updateBossStrike(dt) {
    const pattern = this.bossPattern;
    const boss = this.boss;
    if (!pattern || !boss || boss.defeated || !(boss.hp > 0) || !this.commanderPosition) {
      this.bossStrikeArmed = false;
      return;
    }
    const bossPos = boss.root?.position;
    if (!bossPos) return;
    const dx = this.commanderPosition.x - bossPos.x;
    const dz = this.commanderPosition.z - bossPos.z;
    const distance = Math.hypot(dx, dz);
    const triggerRange = Number(pattern.triggerRange) || 4.5;
    const cooldownSeconds = Math.max(0.5, Number(pattern.cooldownSeconds) || 5);
    const inThreatRange = distance <= triggerRange;
    this.bossStrikeArmed = inThreatRange;

    if (this.bossThreatRing?.material) {
      // Wind-up read: the ring brightens as the cooldown empties, so a
      // player watching the ground (not just a health bar) can tell a hit
      // is imminent and still has time to step back out of triggerRange.
      const readiness = inThreatRange ? 1 - clamp(this.bossStrikeCooldownRemaining / cooldownSeconds, 0, 1) : 0;
      this.bossThreatRing.material.opacity = 0.14 + readiness * 0.5;
    }

    if (!inThreatRange) {
      // Stepping out lets the wind-up relax instead of firing the instant
      // the player steps back in, rewarding a deliberate approach.
      this.bossStrikeCooldownRemaining = Math.max(this.bossStrikeCooldownRemaining, cooldownSeconds * 0.5);
      return;
    }
    this.bossStrikeCooldownRemaining -= dt;
    if (this.bossStrikeCooldownRemaining > 0) return;

    this.bossStrikeCooldownRemaining = cooldownSeconds;
    this.playBossStrikeEffect(pattern);
    this.onEncounterEvent?.({ type: "boss-strike", stageId: this.stageId });
  }

  playBossStrikeEffect(pattern) {
    if (!this.boss?.root) return;
    const p = this.boss.root.position;
    const hostileColor = this.presentation?.palette?.hostile ?? "#ff7f79";
    this.play(this.boss, "Attack", true);
    this.particles?.emit(p.x, 0.9, p.z, hostileColor, pattern.type === "aoe" ? 30 : 18, {
      speedMin: 1.2,
      speedMax: pattern.type === "ranged" ? 5.2 : 3.4,
      life: 0.5,
      gravity: 2,
      upBias: 0.7
    });
    this.audio?.playTone?.(p.x, 0.8, p.z, {
      freq: pattern.type === "aoe" ? 120 : 260,
      endFreq: pattern.type === "aoe" ? 60 : 130,
      duration: 0.22,
      type: "sawtooth",
      gain: 0.5
    });
    this.shakeCamera?.(pattern.type === "aoe" ? 0.16 : 0.08, 0.14);
  }

  // Node/portal emissive spikes on capture/hunt/extract, then eases back to
  // its resting glow instead of staying pinned at the flash value forever.
  updateMarkerPulses(dt) {
    this.nodePulse = Math.max(0.8, this.nodePulse - dt * 3.2);
    this.portalPulse = Math.max(0.8, this.portalPulse - dt * 3.2);

    this.updateNodeVisuals();

    const available = this.getAvailableActions ? this.getAvailableActions() : null;
    const hasAction = (sem) => {
      if (!sem || !available) return false;
      return typeof available.has === "function" ? available.has(sem) : available.includes(sem);
    };
    // "Ready to act" now means both campaign-legal AND within
    // ACTION_INTERACTION_RADIUS -- the alarm/highlight on a gimmick must
    // agree with getCommandReadiness(), or a marker can glow actionable
    // while the commander is still out of range to actually trigger it.
    const isReady = (sem) => hasAction(sem) && Boolean(this.getCommandReadiness?.({ action: sem })?.ready);
    // Markers whose anchor covers more than one candidate action (portal:
    // materialize/domain, extractor: hunt/extract) highlight and hover-match
    // against whichever candidate is currently available, falling back to
    // the group's primary action when none is.
    const resolveMarkerSemantic = (group, fallback) => {
      if (!Array.isArray(group)) return fallback;
      return group.find((candidate) => hasAction(candidate)) ?? fallback;
    };

    // 1. Portal
    if (this.portal) {
      const sem = resolveMarkerSemantic(this.portal.userData.semanticGroup, "materialize");
      const isHovered = this.lastHoveredAction === sem;
      const isAct = isReady(sem);
      this.applyInteractiveHighlight(this.portal, sem, isHovered, isAct, this.portalPulse, dt);
      if (this.portalProp) {
        this.applyInteractiveHighlight(this.portalProp.root, sem, isHovered, isAct, this.portalPulse, dt);
      }
    }

    // 2. Extractor
    if (this.extractor) {
      const sem = resolveMarkerSemantic(this.extractor.userData.semanticGroup, "extract");
      const isHovered = this.lastHoveredAction === sem;
      const isAct = isReady(sem);
      this.applyInteractiveHighlight(this.extractor, sem, isHovered, isAct, 0.8, dt);
      if (this.extractorProp) {
        this.applyInteractiveHighlight(this.extractorProp.root, sem, isHovered, isAct, 0.8, dt);
      }
    }

    // 3. Nodes
    if (this.nodes) {
      for (let i = 0; i < this.nodes.length; i++) {
        const nodeMesh = this.nodes[i];
        if (!nodeMesh) continue;
        const sem = nodeMesh.userData.semantic;
        const isHovered = sem && this.lastHoveredAction === sem;
        const isAct = sem && isReady(sem);
        let baseInt = 0.2;
        if (i < this.capturedCount) baseInt = 0.5;
        else if (i === this.capturedCount) baseInt = this.nodePulse;
        this.applyInteractiveHighlight(nodeMesh, sem, isHovered, isAct, baseInt, dt);
        if (this.nodeProps && this.nodeProps[i]) {
          this.applyInteractiveHighlight(this.nodeProps[i].root, sem, isHovered, isAct, baseInt, dt);
        }
      }
    }

    // 4. Boss
    if (this.boss && this.boss.root && !this.previewActionSemantic) {
      const sem = this.boss.root.userData.semantic || "assault";
      const isHovered = this.lastHoveredAction === sem;
      const isAct = this.bossExposed && isReady(sem);
      this.applyInteractiveHighlight(this.boss.root, sem, isHovered, isAct, 0.55, dt);
    }
  }

  // Slow drifting embers/motes in the stage's accent color — cheap
  // atmospheric depth that reads as "the battlefield is alive" without new
  // terrain geometry per elevation tier.
  updateAmbience(dt) {
    this.ambientEmitTimer -= dt;
    if (this.ambientEmitTimer > 0) return;
    this.ambientEmitTimer = 0.35;
    const accent = this.presentation?.palette?.accent ?? "#ffb85c";
    const x = (Math.random() - 0.5) * 16;
    const z = (Math.random() - 0.5) * 10;
    const y = 0.2 + Math.random() * 0.3;
    this.particles?.emit(x, y, z, accent, 1, {
      speedMin: 0.05, speedMax: 0.25, life: 3.5, gravity: -0.15, upBias: 0.4,
    });
  }

  liveAlly(unit) {
    return this.allies.includes(unit) && !unit.defeated;
  }

  liveEnemy(unit) {
    return !unit.defeated && !unit.breachVisualized;
  }

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
      if (ally.customPath?.length > 0 || (ally.customOrder && !ally.customOrderReached)) moving += 1;
    }

    let order = "none";
    if (count > 0) {
      if (engaged === count) order = "engaged";
      else if (moving === count) order = "moving";
      else if (engaged > 0 || moving > 0) order = "mixed";
      else order = "holding";
    }

    // Selection "kind" — same-type selections resolve to that type's own
    // identity (used to project the correct portrait); a selection spanning
    // both a possessed ally and ordinary shade allies resolves to "mixed" so
    // the UI does not falsely claim a single uniform type.
    let kind = "none";
    if (count > 0) {
      if (possessed === count) kind = "possessed";
      else if (possessed === 0) kind = "shade";
      else kind = "mixed";
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
      kind,
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

  clearEngagement(unit) {
    const mate = this.engagements.get(unit);
    if (!mate) return;
    this.engagements.delete(unit);
    if (this.engagements.get(mate) === unit) this.engagements.delete(mate);
  }

  bindEngagement(ally, enemy) {
    if (!this.allies.includes(ally) || !this.liveAlly(ally) || !this.liveEnemy(enemy)) return false;
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
        unitIsAlly === mateIsAlly ||
        (unitIsAlly ? !this.liveAlly(unit) : !this.liveEnemy(unit)) ||
        (mateIsAlly ? !this.liveAlly(mate) : !this.liveEnemy(mate))
      ) this.clearEngagement(unit);
    }
  }

  selectEngagements() {
    const rangeSquared = ATTACK_RANGE * ATTACK_RANGE;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      let nearest = null;
      let closest = rangeSquared;
      for (const enemy of this.enemies) {
        if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
        const dx = enemy.root.position.x - ally.root.position.x;
        const dz = enemy.root.position.z - ally.root.position.z;
        const distance = dx * dx + dz * dz;
        if (distance <= closest) {
          closest = distance;
          nearest = enemy;
        }
      }
      if (nearest) this.bindEngagement(ally, nearest);
    }
  }

  nearestUnengagedEnemy(ally) {
    if (!this.liveAlly(ally) || this.engagements.has(ally)) return null;
    const rangeSquared = SHADE_INTERCEPT_RADIUS * SHADE_INTERCEPT_RADIUS;
    let nearest = null;
    let closest = rangeSquared;
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      const dx = enemy.root.position.x - ally.root.position.x;
      const dz = enemy.root.position.z - ally.root.position.z;
      const distance = dx * dx + dz * dz;
      if (distance <= closest) {
        closest = distance;
        nearest = enemy;
      }
    }
    return nearest;
  }

  terrainClear(x, z, radius, previous) {
    const destination = this.navigationAt(x, z);
    if (!destination.walkable) return false;
    if (previous) {
      const prevGrid = this.worldToGrid(previous.x, previous.z);
      if (!this.navigation.climbOk(
        Math.floor(prevGrid.x),
        Math.floor(prevGrid.y),
        Math.floor(destination.x),
        Math.floor(destination.y),
      )) return false;
    }
    for (const [offsetX, offsetZ] of CIRCLE_PROBES) {
      if (!this.navigationAt(x + offsetX * radius, z + offsetZ * radius).walkable) return false;
    }
    return true;
  }

  collidesWithActor(unit, x, z, radius, actor, live) {
    if (!actor || actor === unit || !actor.root || !live) return false;
    const dx = x - actor.root.position.x;
    const dz = z - actor.root.position.z;
    const limit = radius + (actor.radius ?? 0.42);
    return dx * dx + dz * dz < limit * limit;
  }

  collidesAt(unit, x, z, radius) {
    for (const blocker of this.staticBlockers) {
      if (blocker.blocksMovement === false || blocker.active?.() === false) continue;
      const position = blocker.root?.position ?? blocker;
      const dx = x - position.x;
      const dz = z - position.z;
      const limit = radius + blocker.radius;
      if (dx * dx + dz * dz < limit * limit) return true;
    }
    for (const ally of this.allies) {
      if (this.collidesWithActor(unit, x, z, radius, ally, this.liveAlly(ally))) return true;
    }
    if (!this.enemies.includes(unit)) {
      for (const enemy of this.enemies) {
        if (this.collidesWithActor(unit, x, z, radius, enemy, this.liveEnemy(enemy))) return true;
      }
    }
    return false;
  }

  resolveMovement(unit, targetX, targetZ) {
    const root = unit?.root;
    if (!root) return { x: targetX, y: 0, z: targetZ, blocked: true };
    const radius = unit.radius ?? 0.42;
    const start = { x: root.position.x, z: root.position.z };
    const distance = Math.hypot(targetX - start.x, targetZ - start.z);
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    let resolved = start;
    let blocked = false;
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      const x = start.x + (targetX - start.x) * progress;
      const z = start.z + (targetZ - start.z) * progress;
      if (!this.terrainClear(x, z, radius, resolved) || this.collidesAt(unit, x, z, radius)) {
        blocked = true;
        break;
      }
      resolved = { x, z };
    }
    const navigation = this.navigationAt(resolved.x, resolved.z);
    return {
      x: resolved.x,
      y: navigation.elevation * TERRAIN_ELEVATION_SCALE,
      z: resolved.z,
      blocked,
    };
  }

  applyResolvedMovement(unit, targetX, targetZ) {
    const resolved = this.resolveMovement(unit, targetX, targetZ);
    unit.root.position.set(resolved.x, resolved.y, resolved.z);
    return resolved;
  }

  updateEngagements(dt) {
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (!enemy || this.engagements.get(enemy) !== ally || !this.liveAlly(ally) || !this.liveEnemy(enemy)) continue;
      ally.cooldown = Math.max(0, ally.cooldown - dt);
      this.play(ally, "Strike");
      if (ally.cooldown !== 0) continue;
      ally.cooldown = ALLY_STRIKE_COOLDOWN;
      const allyGrid = this.navigation.worldToGrid(ally.root.position.x, ally.root.position.z);
      const allyGimmick = this.getGimmickAt(allyGrid.x, allyGrid.y);
      const allyDamageDealtMult = allyGimmick?.effects?.combatDamageDealtMultiplier ?? 1.0;
      
      const enemyGrid = this.navigation.worldToGrid(enemy.root.position.x, enemy.root.position.z);
      const enemyGimmick = this.getGimmickAt(enemyGrid.x, enemyGrid.y);
      const enemyDamageReceivedMult = enemyGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
      
      const damage = 1 * allyDamageDealtMult * enemyDamageReceivedMult;
      enemy.hp -= damage;
      this.clashEffect(ally.root.position, enemy.root.position);
      this.enemyStrike(enemy, ally);
      this.exchanges += 1;
      if (enemy.hp <= 0) this.defeat(enemy);
    }
  }

  // Spark burst + clang tone at the midpoint of an ally/enemy melee
  // exchange — the one combat beat that repeats most often, so it must read
  // clearly without becoming visual noise (small particle count, short
  // percussive tone).
  clashEffect(allyPos, enemyPos) {
    const mx = (allyPos.x + enemyPos.x) / 2;
    const mz = (allyPos.z + enemyPos.z) / 2;
    const my = Math.max(allyPos.y, enemyPos.y) + 0.9;
    const spark = this.presentation?.palette?.accent ?? "#ffb85c";
    this.particles?.emit(mx, my, mz, spark, 6, { speedMin: 1.2, speedMax: 2.8, life: 0.28, gravity: 4, upBias: 0.4 });
    this.audio.playTone(mx, my, mz, { freq: 900, endFreq: 320, duration: 0.09, type: "triangle", gain: 0.35 });
  }

  enemyStrike(enemy, target, damage = 1) {
    if (!enemy || !target || target.defeated) return;
    
    const enemyGrid = this.navigation.worldToGrid(enemy.root.position.x, enemy.root.position.z);
    const enemyGimmick = this.getGimmickAt(enemyGrid.x, enemyGrid.y);
    const enemyDamageDealtMult = enemyGimmick?.effects?.combatDamageDealtMultiplier ?? 1.0;
    
    const targetGrid = this.navigation.worldToGrid(target.root.position.x, target.root.position.z);
    const targetGimmick = this.getGimmickAt(targetGrid.x, targetGrid.y);
    const targetDamageReceivedMult = targetGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
    
    const finalDamage = damage * enemyDamageDealtMult * targetDamageReceivedMult;
    
    this.play(enemy, "Strike");
    target.hp -= finalDamage;
    target.hit = (target.hit ?? 0) + 1;
    const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
    this.particles?.emit(target.root.position.x, target.root.position.y + 0.8, target.root.position.z, hostile, 8, {
      speedMin: 1.4, speedMax: 3.2, life: 0.32, gravity: 5,
    });
    this.audio.playTone(target.root.position.x, target.root.position.y + 0.8, target.root.position.z, {
      freq: 220, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.45,
    });
    if (target.hp <= 0 || target.hit >= 3) this.defeat(target);
  }

  moveCommander(dt) {
    if (!this.commander || !this.commander.root) return;
    let x = 0;
    let z = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) z -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) z += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;
    const root = this.commander.root;
    
    // Keyboard input cancels any active clicked path/movement order
    if (x !== 0 || z !== 0) {
      this.commanderOrder = null;
      this.commanderPath = null;
    }
    
    if (x === 0 && z === 0) {
      if (this.commanderPath && this.commanderPath.length > 0) {
        let nextWaypoint = this.commanderPath[0];
        let targetWorld = this.navigation.gridToWorld(nextWaypoint.x + 0.5, nextWaypoint.y + 0.5);
        x = targetWorld.x - root.position.x;
        z = targetWorld.z - root.position.z;
        if (Math.hypot(x, z) <= 0.08) {
          this.commanderPath.shift();
          if (this.commanderPath.length === 0) {
            this.commanderPath = null;
            this.commanderOrder = null;
            x = 0;
            z = 0;
          } else {
            nextWaypoint = this.commanderPath[0];
            targetWorld = this.navigation.gridToWorld(nextWaypoint.x + 0.5, nextWaypoint.y + 0.5);
            x = targetWorld.x - root.position.x;
            z = targetWorld.z - root.position.z;
          }
        }
      } else if (this.commanderOrder) {
        x = this.commanderOrder.x - root.position.x;
        z = this.commanderOrder.z - root.position.z;
        if (Math.hypot(x, z) <= 0.08) {
          this.commanderOrder = null;
          x = 0;
          z = 0;
        }
      }
    }
    
    const targetVel = new THREE.Vector2(0, 0);
    const length = Math.hypot(x, z);
    if (length > EPSILON) {
      const baseSpeed = this.hasSurge() ? 7.2 : 4.1;
      const grid = this.navigation.worldToGrid(root.position.x, root.position.z);
      const gimmick = this.getGimmickAt(grid.x, grid.y);
      const speedMult = gimmick?.effects?.movementSpeedMultiplier ?? 1.0;
      const mobilityBonus = Math.max(0, (this.mobilityLevel || 1) - 1);
      const speed = baseSpeed * speedMult * (1.0 + 0.15 * mobilityBonus);
      targetVel.set((x / length) * speed, (z / length) * speed);
    }
    
    if (!this.commanderVelocity) {
      this.commanderVelocity = new THREE.Vector2(0, 0);
    }
    
    const targetSpeed = targetVel.length();
    const currentSpeed = this.commanderVelocity.length();
    let rate = 28;
    if (targetSpeed === 0 || currentSpeed > targetSpeed) {
      rate = 36;
    }
    
    const diff = new THREE.Vector2().subVectors(targetVel, this.commanderVelocity);
    const diffLen = diff.length();
    const step = rate * dt;
    
    if (diffLen <= step) {
      this.commanderVelocity.copy(targetVel);
    } else {
      this.commanderVelocity.addScaledVector(diff.normalize(), step);
    }
    
    const speed = this.commanderVelocity.length();
    if (speed < 0.05) {
      this.commanderVelocity.set(0, 0);
      this.play(this.commander, "Idle");
      return;
    }
    
    const dx = this.commanderVelocity.x * dt;
    const dz = this.commanderVelocity.y * dt;
    const resolved = this.applyResolvedMovement(
      this.commander,
      root.position.x + dx,
      root.position.z + dz,
    );
    this.commanderPosition.copy(root.position);
    this.commander.root.rotation.y = Math.atan2(this.commanderVelocity.x, this.commanderVelocity.y);
    this.emitFootstepTrail(dt, root.position, this.hasSurge());
    this.play(this.commander, "Move");
    if (resolved.blocked) {
      this.commanderVelocity.set(0, 0);
      this.commanderOrder = null;
      this.commanderPath = null;
    }
  }

  // Ground dust while walking; a brighter, more frequent accent-color trail
  // while surging (Shift). Throttled by a shared timer so this never spams
  // the particle pool during sustained movement.
  emitFootstepTrail(dt, position, surging) {
    this.footstepTimer -= dt;
    if (this.footstepTimer > 0) return;
    if (surging) {
      this.footstepTimer = 0.05;
      const accent = this.presentation?.palette?.accent ?? "#ffb85c";
      this.particles?.emit(position.x, position.y + 0.15, position.z, accent, 2, {
        speedMin: 0.2, speedMax: 0.6, life: 0.3, gravity: 0.5, upBias: 0.2,
      });
    } else {
      this.footstepTimer = 0.22;
      this.particles?.emit(position.x, position.y + 0.05, position.z, "#8a8578", 3, {
        speedMin: 0.15, speedMax: 0.45, life: 0.4, gravity: 1.8, upBias: 0.15,
      });
    }
  }

  updateAllies(dt) {
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index];
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      const intercept = this.nearestUnengagedEnemy(ally);
      
      let desiredX, desiredZ;
      if (intercept) {
        desiredX = intercept.root.position.x;
        desiredZ = intercept.root.position.z;
      } else if (ally.customPath?.length > 0 && !ally.customOrderReached) {
        let waypoint = ally.customPath[0];
        if (Math.hypot(waypoint.x - ally.root.position.x, waypoint.z - ally.root.position.z) <= 0.08) {
          ally.customPath.shift();
          waypoint = ally.customPath[0] ?? ally.customOrder;
          if (ally.customPath.length === 0 && Math.hypot(waypoint.x - ally.root.position.x, waypoint.z - ally.root.position.z) <= 0.08) {
            ally.customOrderReached = true;
          }
        }
        desiredX = waypoint.x;
        desiredZ = waypoint.z;
      } else if (ally.customOrder && !ally.customOrderReached) {
        desiredX = ally.customOrder.x;
        desiredZ = ally.customOrder.z;
        if (Math.hypot(desiredX - ally.root.position.x, desiredZ - ally.root.position.z) <= 0.08) {
          ally.customOrderReached = true;
        }
      } else {
        const angle = index * 2.4;
        desiredX = this.rally.x + Math.cos(angle) * 1.25;
        desiredZ = this.rally.z + Math.sin(angle) * 1.25;
      }
      
      const root = ally.root;
      const grid = this.navigation.worldToGrid(root.position.x, root.position.z);
      const gimmick = this.getGimmickAt(grid.x, grid.y);
      const speedMult = gimmick?.effects?.movementSpeedMultiplier ?? 1.0;
      const lerpFactor = Math.min(1, dt * 3 * speedMult);
      
      this.applyResolvedMovement(
        ally,
        root.position.x + (desiredX - root.position.x) * lerpFactor,
        root.position.z + (desiredZ - root.position.z) * lerpFactor,
      );
      this.play(ally, "Move");
    }
  }

  emitCombatAlert(enemy, event = "enemy-ranged-warning") {
    if (!enemy?.root) return;
    let cue = null;
    try {
      cue = getCombatAlertCue(event, { enemyId: enemy.id, patternId: enemy.patternId })
        ?? getCombatAlertCue("start-wave")
        ?? null;
    } catch {
      cue = null;
    }
    const position = enemy.root.position;
    if (this.destroyed) return;
    const color = cue?.color ?? cue?.particleColor ?? this.presentation?.palette?.hostile ?? "#ff7f79";
    const count = Math.max(2, Number(cue?.count ?? cue?.particleCount ?? 8) || 8);
    const particleOptions = {
      speedMin: Number(cue?.speedMin) || 0.6,
      speedMax: Number(cue?.speedMax) || 1.8,
      life: Number(cue?.life) || 0.45,
      gravity: Number.isFinite(Number(cue?.gravity)) ? Number(cue.gravity) : 1.4,
      upBias: Number(cue?.upBias) || 0.5,
    };
    this.particles?.emit(position.x, position.y + 0.8, position.z, color, count, particleOptions);
    const frequency = Number(cue?.frequency ?? cue?.freq) || 560;
    const endFrequency = Number(cue?.endFrequency ?? cue?.endFreq) || Math.max(80, frequency * 0.7);
    this.audio.playTone(position.x, position.y + 0.8, position.z, {
      freq: frequency,
      endFreq: endFrequency,
      duration: Number(cue?.duration) || 0.18,
      type: cue?.type ?? "triangle",
      gain: Number(cue?.gain) || 0.38,
    });
    enemy.lastAlertCue = cue;
    enemy.alertCue = cue;
  }

  updateEnemies(dt) {
    const portalAnchor = this.navigation.anchors.portal;
    const portalWorld = this.navigation.gridToWorld(portalAnchor.x, portalAnchor.y);
    
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;

      // enemy.pattern is fixed at spawn and never reassigned afterwards, so
      // this classification is invariant for the enemy's whole lifetime.
      // Cache it on first computation instead of re-deriving (string coercion
      // + toLowerCase + includes) on every 60Hz simulation tick per enemy.
      let movement = enemy._movementDirective;
      let patternId = enemy._patternIdLower;
      let movementKind = enemy._movementKind;
      let isRanged = enemy._isRangedPattern;
      if (movement === undefined) {
        const pattern = enemy.pattern ?? {};
        movement = pattern.movementDirective && typeof pattern.movementDirective === "object"
          ? pattern.movementDirective
          : (pattern.movement && typeof pattern.movement === "object" ? pattern.movement : pattern);
        patternId = String(pattern.patternId ?? enemy.patternId ?? enemy.archetype ?? "").toLowerCase();
        movementKind = String(pattern.movement ?? movement.mode ?? movement.kind ?? movement.type ?? patternId).toLowerCase();
        isRanged = patternId === "ranged" || movementKind === "ranged" || patternId.includes("ranged");
        enemy._movementDirective = movement;
        enemy._patternIdLower = patternId;
        enemy._movementKind = movementKind;
        enemy._isRangedPattern = isRanged;
      }
      if (isRanged) {
        enemy.alertTimer = Math.max(0, (enemy.alertTimer ?? (0.35 + (enemy.routeIndex ?? 0) * 0.18)) - dt);
        enemy.pauseTimer = Math.max(0, (enemy.pauseTimer ?? 0) - dt);
        if (enemy.pauseTimer > 0) {
          this.play(enemy, "Idle");
          continue;
        }
        if (enemy.alertTimer <= 0) {
          this.emitCombatAlert(enemy, "enemy-ranged-warning");
          enemy.alertTimer = Math.max(0.9, Number(movement.pausePeriod ?? movement.alertPeriod) || 1.65);
          enemy.pauseTimer = Math.max(0.12, Number(movement.pauseDuration) || 0.38);
          this.play(enemy, "Special", true);
          continue;
        }
      }
      
      if (!enemy.waypoints) {
        const routeIndex = enemy.routeIndex ?? 0;
        const routeCells = this.navigation.routePath(routeIndex, true);
        if (routeCells) {
          enemy.waypoints = routeCells.map((cell) => {
            const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
            return new THREE.Vector3(world.x, 0, world.z);
          });
          for (const wp of enemy.waypoints) {
            const nav = this.navigationAt(wp.x, wp.z);
            wp.y = nav.elevation * TERRAIN_ELEVATION_SCALE;
          }
        }
        enemy.waypointIndex = 0;
      }
      
      if (enemy.waypoints && enemy.waypointIndex < enemy.waypoints.length) {
        let targetWP = enemy.waypoints[enemy.waypointIndex];
        let dx = targetWP.x - enemy.root.position.x;
        let dz = targetWP.z - enemy.root.position.z;
        while (Math.hypot(dx, dz) <= 0.08 && enemy.waypointIndex < enemy.waypoints.length - 1) {
          enemy.waypointIndex += 1;
          targetWP = enemy.waypoints[enemy.waypointIndex];
          dx = targetWP.x - enemy.root.position.x;
          dz = targetWP.z - enemy.root.position.z;
        }
        this.direction.set(dx, 0, dz);
      } else {
        this.direction.set(portalWorld.x - enemy.root.position.x, 0, portalWorld.z - enemy.root.position.z);
      }
      
      const distance = this.direction.length();
      if (distance > EPSILON) {
        this.direction.multiplyScalar(1 / distance);
        const grid = this.navigation.worldToGrid(enemy.root.position.x, enemy.root.position.z);
        const gimmick = this.getGimmickAt(grid.x, grid.y);
        const gimmickSpeed = gimmick?.effects?.movementSpeedMultiplier ?? 1.0;
        const configuredSpeed = Number(movement.speedMultiplier ?? movement.speedScale);
        let patternSpeed = Number.isFinite(configuredSpeed) && configuredSpeed > 0 ? configuredSpeed : 1;
        if (movementKind === "guardian") {
          const portalDistance = Math.hypot(enemy.root.position.x - portalWorld.x, enemy.root.position.z - portalWorld.z);
          patternSpeed *= portalDistance < 4 ? 0.5 : 0.82;
        }
        const enemySpeed = ENEMY_ADVANCE_SPEED * gimmickSpeed * patternSpeed;
        
        const resolved = this.applyResolvedMovement(
          enemy,
          enemy.root.position.x + this.direction.x * dt * enemySpeed,
          enemy.root.position.z + this.direction.z * dt * enemySpeed,
        );
        if (resolved.blocked) {
          const configuredDetour = Number(movement.detourBias ?? movement.detourMultiplier);
          const detourBias = Number.isFinite(configuredDetour) && configuredDetour !== 0
            ? configuredDetour
            : (movementKind === "flanker" || patternId.includes("flank") ? 1.45 : 1);
          const detourDistance = Math.min(0.24 * Math.abs(detourBias), dt * enemySpeed);
          const detourSide = Math.sign(enemy.detourPreference || 1) * Math.sign(detourBias || 1);
          const preferredDetour = this.applyResolvedMovement(
            enemy,
            enemy.root.position.x - this.direction.z * detourSide * detourDistance,
            enemy.root.position.z + this.direction.x * detourSide * detourDistance,
          );
          if (preferredDetour.blocked) {
            this.applyResolvedMovement(
              enemy,
              enemy.root.position.x + this.direction.z * detourSide * detourDistance,
              enemy.root.position.z - this.direction.x * detourSide * detourDistance,
            );
          }
        }
        enemy.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
      }
      this.play(enemy, "Move");
      if (enemy.root.position.x <= portalWorld.x) {
        enemy.breachVisualized = true;
        this.clearEngagement(enemy);
        this.particles?.emit(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, "#ff3b3b", 16, {
          speedMin: 1.5, speedMax: 3.4, life: 0.5, gravity: 3,
        });
        this.audio.playTone(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, {
          freq: 140, endFreq: 60, duration: 0.35, type: "square", gain: 0.75,
        });
        this.shakeCamera(0.14, 0.22);
        this.emitEncounterEvent("breach", enemy);
      }
    }

    if (this.currentWaveId && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.defeated || enemy.breachVisualized)) {
      const p = this.node?.position ?? this.commanderPosition;
      const ally = this.presentation?.palette?.ally ?? "#70e5d0";
      this.particles?.emit(p.x, 0.5, p.z, ally, 20, { speedMin: 1.6, speedMax: 3.4, life: 0.9, gravity: 1.4, upBias: 1 });
      this.audio.playTone(p.x, 0.5, p.z, { freq: 440, endFreq: 880, duration: 0.4, type: "sine", gain: 0.6 });
      this.emitEncounterEvent("wave-cleared");
    }
  }

  defeat(unit) {
    if (!unit || unit.defeated) return;
    unit.defeated = true;
    this.clearEngagement(unit);
    if (this.allies.includes(unit)) this.selection.delete(unit);
    this.play(unit, "Defeat", true);
    const isAlly = this.allies.includes(unit);
    const isBoss = unit === this.boss;
    const color = isBoss || !isAlly
      ? (this.presentation?.palette?.hostile ?? "#ff7f79")
      : (this.presentation?.palette?.ally ?? "#70e5d0");
    const pos = unit.root.position;
    const count = isBoss ? 48 : 14;
    this.particles?.emit(pos.x, pos.y + 1, pos.z, color, count, {
      speedMin: isBoss ? 2.2 : 1, speedMax: isBoss ? 5 : 2.6, life: isBoss ? 1.1 : 0.65, gravity: 1.6, upBias: 0.8,
    });
    if (isBoss) {
      this.audio.playTone(pos.x, pos.y + 1, pos.z, { freq: 160, endFreq: 40, duration: 0.9, type: "sawtooth", gain: 0.9 });
      this.shakeCamera(0.35, 0.5);
      this.triggerHitStop(0.12);
    } else {
      this.audio.playTone(pos.x, pos.y + 1, pos.z, { freq: 260, endFreq: 70, duration: 0.4, type: "sine", gain: 0.5 });
    }
    this.emitSelectionChange();
  }

  updateCamera(dt = 0) {
    const reducedMotion = globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const alpha = reducedMotion ? 1.0 : Math.min(1, Math.max(0, 1 - Math.exp(-dt / 0.1304)));
    this.lookTarget.copy(this.commanderPosition);
    
    if (this.focusedCell) {
      const world = this.navigation.gridToWorld(this.focusedCell.x + 0.5, this.focusedCell.y + 0.5);
      const elevation = this.navigation.elevationAt(this.focusedCell.x + 0.5, this.focusedCell.y + 0.5);
      this.lookTarget.set(world.x, elevation * TERRAIN_ELEVATION_SCALE, world.z);
    } else if (this.previewActionSemantic) {
      const sourcePoint = this.actionFeedbackPoint(this.previewActionSemantic.source);
      const targetPoint = this.actionFeedbackPoint(this.previewActionSemantic.target);
      let biasTarget = targetPoint;
      if (this.previewActionSemantic.target === "commander" && this.previewActionSemantic.source !== "commander") {
        biasTarget = sourcePoint;
      }
      if (biasTarget) {
        const biasVec = new THREE.Vector3(biasTarget.x, biasTarget.y, biasTarget.z);
        this.lookTarget.lerp(biasVec, 0.35);
      }
    } else {
      const activeCombat = this.currentWaveId || this.enemies.length > 0 || this.bossExposed;
      if (activeCombat && this.boss?.root?.position) {
        this.lookTarget.lerp(this.boss.root.position, 0.22);
      }
    }
    
    // 1. Original cameraTarget tracking logic: lerp and clamp directly to lookTarget
    if (reducedMotion) {
      this.cameraTarget.copy(this.lookTarget);
    } else {
      this.cameraTarget.lerp(this.lookTarget, alpha);
    }
    const bounds = this.navigation.bounds;
    const maxTargetOffsetFactor = 0.4;
    this.cameraTarget.x = clamp(this.cameraTarget.x, bounds.left * maxTargetOffsetFactor, bounds.right * maxTargetOffsetFactor);
    this.cameraTarget.z = clamp(this.cameraTarget.z, bounds.near * maxTargetOffsetFactor, bounds.far * maxTargetOffsetFactor);

    // 2. Compute visualTarget (bounds-centered overview with dead-zone / bias towards cameraTarget)
    const displacement = new THREE.Vector3().subVectors(this.cameraTarget, this.boundsCenter);
    displacement.y = 0;
    const distance = displacement.length();
    const deadZone = 3.5;
    const maxBias = 2.5;
    let biasFactor = 0;
    if (distance > deadZone) {
      biasFactor = Math.min(maxBias, (distance - deadZone) * 0.55);
    }
    const visualTarget = this.boundsCenter.clone();
    if (distance > 0.001 && biasFactor > 0) {
      visualTarget.add(displacement.normalize().multiplyScalar(biasFactor));
    }
    visualTarget.y = this.cameraTarget.y;

    // 3. Dynamic projection-aware fit zoom calculation based on visualTarget and cameraTarget
    this.minFitZoom = this.computeMinFitZoom(
      visualTarget,
      this.cameraTarget,
      this.orbitElevation,
      this.orbitAzimuth,
      this.camera.aspect
    );
    if (!this.hasManualZoomed) {
      this.zoom = this.minFitZoom;
    } else {
      this.zoom = Math.max(this.zoom, this.minFitZoom);
    }
    this.syncCameraRange();

    const horizontal = Math.cos(this.orbitElevation) * this.zoom;
    this.cameraOffset.set(
      Math.cos(this.orbitAzimuth) * horizontal,
      Math.sin(this.orbitElevation) * this.zoom,
      Math.sin(this.orbitAzimuth) * horizontal,
    );
    // Position camera using visualTarget
    this.camera.position.copy(visualTarget).add(this.cameraOffset);
    if (this.shakeTime > 0 && !reducedMotion) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const strength = this.shakeMagnitude * (this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0);
      const t = performance.now() * 0.001;
      this.camera.position.x += Math.sin((t + this.shakeSeed) * 47) * strength;
      this.camera.position.y += Math.sin((t + this.shakeSeed) * 61) * strength * 0.6;
      this.camera.position.z += Math.cos((t + this.shakeSeed) * 53) * strength;
      if (this.shakeTime === 0) this.shakeMagnitude = 0;
    }
    this.lookTarget.copy(this.cameraTarget);
    this.camera.lookAt(this.lookTarget);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const viewportWidth = Number(window.innerWidth) || rect.width;
    this.renderer.setPixelRatio(cappedPixelRatio(viewportWidth, window.devicePixelRatio));
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    
    this.minFitZoom = this.computeMinFitZoom(
      this.cameraTarget || this.boundsCenter,
      this.cameraTarget || this.boundsCenter,
      this.orbitElevation,
      this.orbitAzimuth,
      this.camera.aspect
    );
    if (!this.hasManualZoomed) {
      this.zoom = this.minFitZoom;
    } else {
      this.zoom = Math.max(this.zoom, this.minFitZoom);
    }
    this.syncCameraRange();

    this.resizeBackground();
  }

  fitSamplePoints() {
    if (this._fitSamplePoints) return this._fitSamplePoints;

    const bounds = this.navigation.bounds;
    const points = [];
    const addPoint = (x, z) => {
      const elevation = typeof this.navigationAt === "function"
        ? this.navigationAt(x, z).elevation * TERRAIN_ELEVATION_SCALE
        : 0;
      points.push(new THREE.Vector3(x, elevation, z));
    };
    addPoint(bounds.left, bounds.near);
    addPoint(bounds.left, bounds.far);
    addPoint(bounds.right, bounds.near);
    addPoint(bounds.right, bounds.far);

    const anchors = this.navigation.anchors;
    const addAnchor = (anchor) => {
      if (!anchor) return;
      const point = this.gridToWorld(anchor.x, anchor.y);
      addPoint(point.x, point.z);
    };
    addAnchor(anchors?.portal);
    for (const node of anchors?.nodes ?? []) addAnchor(node);
    addAnchor(anchors?.extractor);
    addAnchor(anchors?.boss);

    this._fitSamplePoints = Object.freeze(points);
    return this._fitSamplePoints;
  }

  syncCameraRange() {
    if (!Number.isFinite(this.zoom) || this.zoom <= 0) return;
    const cameraFar = Math.max(120, this.zoom * 4);
    if (this.camera && Number.isFinite(this.camera.far) && this.camera.far < cameraFar) {
      this.camera.far = cameraFar;
      this.camera.updateProjectionMatrix();
    }
    if (this.raycaster) {
      this.raycaster.far = Math.max(100, this.zoom * 3);
    }
  }

  computeMinFitZoom(target, lookTarget, elevation, azimuth, aspect) {
    const fitTarget = lookTarget || target;
    const fitAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const inputs = [
      target?.x, target?.y, target?.z,
      fitTarget?.x, fitTarget?.y, fitTarget?.z,
      elevation, azimuth,
    ];
    if (!inputs.every(Number.isFinite)) {
      throw new RangeError("Camera fit requires finite targets and orbit angles");
    }

    const points = this.fitSamplePoints();
    const tempCam = this._fitCamera || (this._fitCamera = new THREE.PerspectiveCamera(48, fitAspect, 0.1, 1e9));
    const projected = this._fitProjectionScratch || (this._fitProjectionScratch = new THREE.Vector3());
    if (tempCam.aspect !== fitAspect) {
      tempCam.aspect = fitAspect;
      tempCam.updateProjectionMatrix();
    }

    const limit = this.safeNdcLimit = 0.84;
    const checkZoom = (zoom) => {
      if (!Number.isFinite(zoom) || zoom <= 0) return false;
      const horizontal = Math.cos(elevation) * zoom;
      tempCam.position.set(
        target.x + Math.cos(azimuth) * horizontal,
        target.y + Math.sin(elevation) * zoom,
        target.z + Math.sin(azimuth) * horizontal,
      );
      tempCam.lookAt(fitTarget);
      tempCam.updateMatrixWorld(true);

      for (const point of points) {
        projected.copy(point).project(tempCam);
        if (
          !Number.isFinite(projected.x)
          || !Number.isFinite(projected.y)
          || !Number.isFinite(projected.z)
          || projected.z < -1
          || projected.z > 1
          || Math.abs(projected.x) > limit
          || Math.abs(projected.y) > limit
        ) {
          return false;
        }
      }
      return true;
    };

    let low = 9;
    if (checkZoom(low)) return low;

    let high = low * 2;
    let highFits = checkZoom(high);
    for (let expansion = 0; !highFits && expansion < 32; expansion += 1) {
      low = high;
      high *= 2;
      if (!Number.isFinite(high)) break;
      highFits = checkZoom(high);
    }
    if (!highFits) {
      throw new RangeError("Unable to establish a finite projection-safe camera fit");
    }

    for (let iteration = 0; iteration < 24; iteration += 1) {
      const mid = (low + high) * 0.5;
      if (checkZoom(mid)) high = mid;
      else low = mid;
    }
    if (!checkZoom(high)) {
      throw new RangeError("Camera fit search lost its verified upper bound");
    }
    return high;
  }


  applyInteractiveHighlight(root, semantic, isHovered, isActionable, baseIntensity, dt) {
    if (!root) return;

    const reducedMotion = this.presentation?.reducedMotion ?? false;
    const time = performance.now() * 0.001;

    let emissiveIntensityMul = 1.0;
    let scaleMul = 1.0;

    if (isHovered) {
      emissiveIntensityMul = reducedMotion ? 1.8 : 1.8 + Math.sin(time * 16.0) * 0.35;
      scaleMul = reducedMotion ? 1.08 : 1.08 + Math.sin(time * 12.0) * 0.04;
    } else if (isActionable) {
      emissiveIntensityMul = reducedMotion ? 1.3 : 1.3 + Math.sin(time * 8.0) * 0.2;
      scaleMul = reducedMotion ? 1.02 : 1.02 + Math.sin(time * 6.0) * 0.02;
    }

    root.userData = root.userData || {};
    let materials = root.userData.interactiveHighlightMaterials;
    if (!materials) {
      materials = [];
      root.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (Array.isArray(child.material)) {
          for (const material of child.material) {
            if ((material?.isMeshStandardMaterial || material?.isMeshBasicMaterial) && "emissiveIntensity" in material) {
              materials.push(material);
            }
          }
        } else if (
          (child.material.isMeshStandardMaterial || child.material.isMeshBasicMaterial)
          && "emissiveIntensity" in child.material
        ) {
          materials.push(child.material);
        }
      });
      root.userData.interactiveHighlightMaterials = materials;
    }

    const bossPhaseScale = Number(root.userData.bossPhaseScale);
    const composesBossPhase = root === this.boss?.root && Number.isFinite(bossPhaseScale) && bossPhaseScale > 0;
    for (const material of materials) {
      const authoritativeIntensity = composesBossPhase
        ? Number(material.userData?.bossPhaseEmissiveIntensity)
        : Number.NaN;
      const intensityBase = Number.isFinite(authoritativeIntensity) ? authoritativeIntensity : baseIntensity;
      material.emissiveIntensity = intensityBase * emissiveIntensityMul;
    }

    if (composesBossPhase) {
      root.scale.setScalar(bossPhaseScale * scaleMul);
    } else {
      if (!Object.prototype.hasOwnProperty.call(root.userData, "originalScale")) {
        root.userData.originalScale = root.scale.clone ? root.scale.clone() : new THREE.Vector3(1, 1, 1);
      }
      if (!isHovered && !isActionable) {
        root.scale.copy(root.userData.originalScale);
      } else {
        root.scale.copy(root.userData.originalScale).multiplyScalar(scaleMul);
      }
    }
  }

  clearPressedInput() {
    this.pressed.clear();
  }

  onKey(event, down) {
    if (document.activeElement !== this.canvas) return;
    const { code } = event;
    if (!MOVE_CODES.has(code) && !SURGE_CODES.has(code)) return;
    if (down) this.pressed.add(code);
    else this.pressed.delete(code);
    if (MOVE_CODES.has(code)) event.preventDefault();
  }

  hasSurge() {
    return this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight");
  }

  setPointerRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return true;
  }

  resolvePointerAction(event) {
    if (!this.setPointerRay(event)) return null;
    const hit = this.raycaster.intersectObjects(this.interactives, true)[0];
    let object = hit?.object ?? null;
    while (object && !object.userData.semantic && !object.userData.semanticGroup) object = object.parent;
    if (!object) return null;

    const allows = (candidate) => {
      if (!this.getAvailableActions) return true;
      const available = this.getAvailableActions();
      return typeof available?.has === "function"
        ? available.has(candidate)
        : available?.includes?.(candidate);
    };

    // A marker may cover multiple candidate actions that share one world
    // anchor (e.g. the extractor serves both Hunt and Extract). Resolve to
    // the first candidate the campaign currently allows; a group with no
    // allowed candidate is not clickable, matching single-semantic markers.
    if (object.userData.semanticGroup) {
      return object.userData.semanticGroup.find((candidate) => allows(candidate)) ?? null;
    }

    const action = object.userData.semantic || null;
    if (!action) return null;
    return allows(action) === false ? null : action;
  }

  resolvePointerAlly(event) {
    if (!this.setPointerRay(event)) return null;
    const hits = this.raycaster.intersectObjects(this.allyPickRoots, true);
    for (const hit of hits) {
      let object = hit?.object ?? null;
      while (object && !object.userData?.ally) object = object.parent;
      const ally = object?.userData?.ally ?? null;
      if (this.liveAlly(ally)) return ally;
    }
    return null;
  }

  setHoveredAction(action) {
    const nextAction = action || null;
    this.canvas.style.cursor = nextAction ? "pointer" : "";
    if (nextAction === this.lastHoveredAction) return;
    this.lastHoveredAction = nextAction;
    this.onActionFocus?.(nextAction);
  }
  clearRoutePreview() {
    const preview = this.routePreview;
    if (preview?.group && this.scene) this.scene.remove(preview.group);
    if (preview?.line?.geometry) disposeUnique(preview.line.geometry, this.disposedResources);
    if (preview?.line?.material) disposeUnique(preview.line.material, this.disposedResources);
    if (preview?.endpoint?.geometry) disposeUnique(preview.endpoint.geometry, this.disposedResources);
    if (preview?.endpoint?.material) disposeUnique(preview.endpoint.material, this.disposedResources);
    this.routePreview = null;
    this.routePreviewActive = false;
  }

  updateAlliedRoutePreview(event) {
    if (!this.selection?.size || !this.ground || !this.setPointerRay(event)) {
      this.clearRoutePreview();
      return false;
    }
    const groundHit = this.raycaster.intersectObject(this.ground, false)[0];
    if (!groundHit) {
      this.clearRoutePreview();
      return false;
    }
    const P = groundHit.point;
    const goalGrid = this.navigation.worldToGrid(P.x, P.z);
    const selected = [...this.selection].filter((ally) => this.liveAlly(ally));
    if (selected.length === 0) {
      this.clearRoutePreview();
      return false;
    }
    const ally = selected[0];
    const startGrid = this.navigation.worldToGrid(ally.root.position.x, ally.root.position.z);
    let path = this.findTacticalPath(startGrid, goalGrid);
    if (!path) {
      this.clearRoutePreview();
      return false;
    }
    const points = path.map((cell) => {
      const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
      return new THREE.Vector3(
        world.x,
        this.navigation.elevationAt(cell.x + 0.5, cell.y + 0.5) * TERRAIN_ELEVATION_SCALE + 0.09,
        world.z
      );
    });
    let preview = this.routePreview;
    if (!preview) {
      const group = new THREE.Group();
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineDashedMaterial({
          color: 0x35e06f,
          dashSize: 0.22,
          gapSize: 0.12,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          // Route lines and their endpoint trace across multiple grid cells;
          // stage heightfields vary enough that depth-testing against terrain
          // clips them under any higher ground along the path. These are
          // movement-guidance overlays, not physical objects -- always draw
          // on top (see updateActionRangeRing for the same reasoning/fix).
          depthTest: false,
        })
      );
      line.renderOrder = 14;
      const endpoint = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.3, 20),
        new THREE.MeshBasicMaterial({
          color: 0x35e06f,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
        })
      );
      endpoint.renderOrder = 14;
      endpoint.rotation.x = -Math.PI / 2;
      group.add(line, endpoint);
      this.scene.add(group);
      preview = this.routePreview = { group, line, endpoint, path: null, target: null };
    } else if (!preview.group.parent) {
      this.scene.add(preview.group);
    }
    preview.line.geometry?.dispose?.();
    preview.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    preview.line.computeLineDistances();
    preview.line.visible = true;
    const last = points[points.length - 1];
    preview.endpoint.position.copy(last);

    const reducedMotion = this.presentation?.reducedMotion ?? false;
    const time = performance.now() * 0.001;
    const endpointPulse = reducedMotion ? 1.0 : 1.0 + Math.sin(time * 12.0) * 0.15;
    preview.endpoint.scale.setScalar(endpointPulse);

    preview.endpoint.visible = true;
    preview.path = path;
    preview.target = { x: Math.floor(goalGrid.x), y: Math.floor(goalGrid.y) };
    this.routePreviewActive = true;
    return true;
  }


  onPointerDown(event) {
    this.canvas.focus({ preventScroll: true });
    if (this.pointer) return;
    
    let mode = "select";
    if (this.placementMode) {
      mode = "placement";
    } else if (event.pointerType === "touch" || event.button === 1 || (event.button === 0 && event.altKey)) {
      mode = "orbit";
    } else if (event.button === 2) {
      mode = "right-click";
    }
    
    this.pointer = {
      id: event.pointerId,
      type: event.pointerType,
      downTime: event.timeStamp || Date.now(),
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      button: event.button,
      mode: mode
    };
    this.canvas.setPointerCapture(event.pointerId);
    if (mode === "right-click") this.clearRoutePreview();
    
    if (mode === "select" && !this.placementMode) {
      this.isMarqueeSelecting = true;
      this.marqueeRect = {
        x0: event.clientX,
        y0: event.clientY,
        x1: event.clientX,
        y1: event.clientY
      };
    }
    
    this.setHoveredAction(this.resolvePointerAction(event));
  }

  onPointerMove(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) {
      this.setHoveredAction(this.resolvePointerAction(event));
      return;
    }

    if (!this.pointer.moved) {
      const dxStart = event.clientX - this.pointer.startX;
      const dyStart = event.clientY - this.pointer.startY;
      const distance = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
      const threshold = this.pointer.type === "touch" ? 12 : 6;
      if (distance > threshold) {
        this.pointer.moved = true;
        this.clearHover();
      }
    }
    
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    
    if (this.pointer.mode === "right-click") {
      if (this.pointer.moved) this.updateAlliedRoutePreview(event);
      else this.clearRoutePreview();
    }
    if (this.pointer.moved) {
      if (this.pointer.mode === "orbit") {
        const dx = event.clientX - this.pointer.lastX;
        const dy = event.clientY - this.pointer.lastY;
        this.orbitAzimuth -= dx * 0.008;
        this.orbitElevation = clamp(this.orbitElevation - dy * 0.006, 0.2, 1.25);
      } else if (this.pointer.mode === "select" && !this.placementMode) {
        this.isMarqueeSelecting = true;
        this.marqueeRect.x1 = event.clientX;
        this.marqueeRect.y1 = event.clientY;
        this.updateMarqueeSelection();
      }
    }
    
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
  }

  onPointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const pointer = this.pointer;
    this.pointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    
    this.setHoveredAction(this.resolvePointerAction(event));
    
    if (this.placementMode) {
      if (!pointer.moved) {
        if (this.setPointerRay(event)) {
          const groundHit = this.raycaster.intersectObject(this.ground, false)[0];
          if (groundHit) {
            const grid = this.navigation.worldToGrid(groundHit.point.x, groundHit.point.z);
            const x = Math.floor(grid.x);
            const y = Math.floor(grid.y);
            const legal = this.isPlacementLegal(x, y);
            if (legal) {
              this.onTacticalRequest?.({ type: 'deploy', kind: this.placementMode, cell: { x, y } });
              this.setPlacementMode(null);
            } else {
              const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
              this.particles?.emit(groundHit.point.x, groundHit.point.y + 0.1, groundHit.point.z, hostile, 8, {
                speedMin: 0.5, speedMax: 1.5, life: 0.4, gravity: 3, upBias: 0.2
              });
              this.audio.playTone(groundHit.point.x, groundHit.point.y + 0.1, groundHit.point.z, {
                freq: 150, endFreq: 100, duration: 0.2, type: "sawtooth", gain: 0.4
              });
            }
          }
        }
      }
      return;
    }
    
    if (pointer.mode === "select") {
      this.isMarqueeSelecting = false;
      this.updateMarqueeVisual();
      
      if (!pointer.moved) {
        const upTime = event.timeStamp || Date.now();
        if (upTime - pointer.downTime <= 500) {
          const action = this.resolvePointerAction(event);
          if (action) {
            this.dispatchActionRequest(action, event);
          } else {
            const ally = this.resolvePointerAlly(event);
            if (ally) {
              this.selectAlly(ally);
            } else {
              this.pick(event, "personal");
            }
          }
          this.setHoveredAction(pointer.type === "touch" ? null : this.resolvePointerAction(event));
        }
      }
    } else if (pointer.mode === "right-click") {
      if (this.selection?.size > 0) {
        if ((pointer.moved && this.routePreviewActive) || !pointer.moved) {
          this.pick(event, "allies");
        }
      } else {
        // No allies selected: right-click orders the commander directly,
        // matching the standard RTS "right-click = move/act" convention.
        // Previously this branch only ever called pick(event, "allies"),
        // which is a no-op with an empty selection -- right-click silently
        // did nothing for the commander's own movement.
        this.pick(event, "personal");
      }
      this.clearRoutePreview();
    } else if (pointer.mode === "orbit") {
      if (pointer.type === "touch" && !pointer.moved) {
        const upTime = event.timeStamp || Date.now();
        if (upTime - pointer.downTime <= 500) {
          const action = this.resolvePointerAction(event);
          if (action) {
            this.dispatchActionRequest(action, event);
          } else {
            const ally = this.resolvePointerAlly(event);
            if (ally) {
              this.selectAlly(ally);
            } else if (this.selection && this.selection.size > 0) {
              this.pick(event, "allies");
            } else {
              this.pick(event, "personal");
            }
          }
          this.setHoveredAction(null);
        }
      }
    }
  }

  onPointerCancel(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.pointer = null;
    this.isMarqueeSelecting = false;
    this.updateMarqueeVisual();
    this.clearHover();
    this.clearRoutePreview();
  }

  onLostPointerCapture(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.pointer = null;
    this.isMarqueeSelecting = false;
    this.updateMarqueeVisual();
    this.clearHover();
    this.clearRoutePreview();
  }
  onPointerLeave(event) {
    this.clearHover();
  }

  onWheel(event) {
    if (document.activeElement !== this.canvas) return;
    event.preventDefault();
    const minZ = this.minFitZoom || 9;
    const maxZ = Math.max(30, minZ + 10);
    this.zoom = clamp(this.zoom + event.deltaY * 0.012, minZ, maxZ);
    this.hasManualZoomed = true;
  }

  pick(event, rallyKind) {
    if (rallyKind === "personal") {
      const action = this.resolvePointerAction(event);
      if (action) {
        this.dispatchActionRequest(action, event);
        return;
      }
    } else if (!this.setPointerRay(event)) {
      return;
    }
    const ground = this.raycaster.intersectObject(this.ground, false)[0];
    if (!ground || !this.commander) return;
    
    if (rallyKind === "allies") {
      const P = ground.point;
      const goalGrid = this.navigation.worldToGrid(P.x, P.z);
      const selectedArray = this.selection?.size > 0 ? [...this.selection] : [];
      const plannedOrders = [];

      if (selectedArray.length > 0) {
        for (let i = 0; i < selectedArray.length; i += 1) {
          const ally = selectedArray[i];
          const angle = i * (Math.PI * 2 / Math.max(1, selectedArray.length));
          const dist = selectedArray.length > 1 ? 0.8 : 0;
          const targetX = P.x + Math.cos(angle) * dist;
          const targetZ = P.z + Math.sin(angle) * dist;
          const targetGrid = this.navigation.worldToGrid(targetX, targetZ);
          const startGrid = this.navigation.worldToGrid(ally.root.position.x, ally.root.position.z);
          let path = this.findTacticalPath(startGrid, targetGrid);
          if (!path) path = this.findTacticalPath(startGrid, goalGrid);
          if (path?.length) plannedOrders.push({ ally, path });
        }
      } else {
        const startGrid = this.navigation.worldToGrid(this.commander.root.position.x, this.commander.root.position.z);
        if (!this.findTacticalPath(startGrid, goalGrid)) {
          plannedOrders.length = 0;
        } else {
          plannedOrders.push({ ally: null, path: null });
        }
      }

      if (plannedOrders.length === 0) {
        const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
        this.particles?.emit(P.x, P.y + 0.1, P.z, hostile, 8, {
          speedMin: 0.5, speedMax: 1.5, life: 0.4, gravity: 3, upBias: 0.2
        });
        this.audio.playTone(P.x, P.y + 0.1, P.z, {
          freq: 150, endFreq: 100, duration: 0.2, type: "sawtooth", gain: 0.4
        });
        return;
      }

      const accent = this.presentation?.palette?.accent ?? "#ffb85c";
      this.particles?.emit(P.x, P.y + 0.1, P.z, accent, 5, {
        speedMin: 0.5, speedMax: 1.5, life: 0.3, gravity: 2, upBias: 0.5
      });
      this.audio.playTone(P.x, P.y + 0.1, P.z, {
        freq: 500, endFreq: 700, duration: 0.12, type: "sine", gain: 0.3
      });

      if (selectedArray.length > 0) {
        for (const { ally, path } of plannedOrders) {
          const worldPath = path.map((cell) => {
            const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
            return new THREE.Vector3(
              world.x,
              this.navigation.elevationAt(cell.x + 0.5, cell.y + 0.5) * TERRAIN_ELEVATION_SCALE,
              world.z
            );
          });
          ally.customPath = worldPath.slice(1);
          ally.customOrder = worldPath[worldPath.length - 1];
          ally.customOrderReached = ally.customPath.length === 0;
        }
        this.rally.copy(P);
      } else {
        this.rally.set(P.x, P.y, P.z);
        for (const ally of this.allies) {
          ally.customPath = [];
          ally.customOrder = null;
        }
      }
      this.emitSelectionChange();
    } else {
      const startGrid = this.navigation.worldToGrid(this.commander.root.position.x, this.commander.root.position.z);
      const goalGrid = this.navigation.worldToGrid(ground.point.x, ground.point.z);
      
      // Request focus
      const cellX = Math.floor(goalGrid.x);
      const cellY = Math.floor(goalGrid.y);
      this.focusTacticalCell({ x: cellX, y: cellY });
      this.onTacticalRequest?.({ type: 'focus', cell: { x: cellX, y: cellY } });
      
      const path = this.findTacticalPath(startGrid, goalGrid);
      if (!path || path.length === 0) {
        const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
        this.particles?.emit(ground.point.x, ground.point.y + 0.1, ground.point.z, hostile, 8, {
          speedMin: 0.5, speedMax: 1.5, life: 0.4, gravity: 3, upBias: 0.2
        });
        this.audio.playTone(ground.point.x, ground.point.y + 0.1, ground.point.z, {
          freq: 150, endFreq: 100, duration: 0.2, type: "sawtooth", gain: 0.4
        });
        return;
      }
      
      this.commanderPath = path;
      const finalCell = path[path.length - 1];
      const finalWorld = this.navigation.gridToWorld(finalCell.x + 0.5, finalCell.y + 0.5);
      const elevation = this.navigation.elevationAt(finalCell.x + 0.5, finalCell.y + 0.5);
      const targetY = elevation * TERRAIN_ELEVATION_SCALE;
      this.commanderOrder = new THREE.Vector3(finalWorld.x, targetY, finalWorld.z);
      
      const accent = this.presentation?.palette?.accent ?? "#ffb85c";
      this.particles?.emit(this.commanderOrder.x, this.commanderOrder.y + 0.1, this.commanderOrder.z, accent, 5, {
        speedMin: 0.5, speedMax: 1.5, life: 0.3, gravity: 2, upBias: 0.5
      });
      this.audio.playTone(this.commanderOrder.x, this.commanderOrder.y + 0.1, this.commanderOrder.z, {
        freq: 600, endFreq: 800, duration: 0.1, type: "sine", gain: 0.3
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
    this.syncBossExposure();
    this.publishRuntimeState();
  }

  applyBossPhaseVisual(phase) {
    if (this.destroyed) return;
    if (!phase) return;
    const phaseIndex = Math.max(0, Number(phase.phaseIndex) || 0);
    const normalizedHealth = clamp(Number(phase.normalizedHealth) || 0, 0, 1);
    const previousPhase = this.bossPhase?.phaseIndex;
    this.bossPhase = phase;
    if (!this.boss?.root) return;
    const root = this.boss.root;
    root.userData = root.userData || {};
    this.ownRuntimeMaterials(root);
    this.boss.phase = phase;
    this.boss.phaseIndex = phaseIndex;
    this.boss.phaseCue = phase.phaseCue ?? null;
    root.userData.bossPhase = phase;
    const baseScale = Number(root.userData.bossPhaseBaseScale) || root.scale?.x || 1;
    root.userData.bossPhaseBaseScale = baseScale;
    const phaseScale = 1 + Math.min(0.12, phaseIndex * 0.035);
    const bossPhaseScale = baseScale * phaseScale;
    root.userData.bossPhaseScale = bossPhaseScale;
    root.scale?.setScalar?.(bossPhaseScale);

    const hostileColor = new THREE.Color(this.presentation?.palette?.hostile ?? "#ff7f79");
    const tintAmount = Math.min(0.24, phaseIndex * 0.07 + (1 - normalizedHealth) * 0.1);
    root.traverse?.((node) => {
      if (!node.isMesh) return;
      if (node.geometry === this.contactGeometry) return;
      const wasArray = Array.isArray(node.material);
      const materials = wasArray ? node.material : [node.material];
      if (materials.includes(this.contactMaterial)) return;
      const ownedMaterials = materials.map((material) => {
        if (!material || material === this.contactMaterial) return material;
        material.userData = material.userData || {};
        material.userData.isBossPhaseTint = true;
        if (!material.userData.bossPhaseBaseColor && material.color?.clone) material.userData.bossPhaseBaseColor = material.color.clone();
        if (!material.userData.bossPhaseBaseEmissive && material.emissive?.clone) material.userData.bossPhaseBaseEmissive = material.emissive.clone();
        if (!Object.prototype.hasOwnProperty.call(material.userData, "bossPhaseBaseEmissiveIntensity")) {
          const runtimeBase = Number(material.userData.runtimeEmissiveIntensityBase);
          material.userData.bossPhaseBaseEmissiveIntensity = Number.isFinite(runtimeBase)
            ? runtimeBase
            : Number(material.emissiveIntensity) || 0;
        }
        if (material.color?.copy && material.userData.bossPhaseBaseColor) {
          material.color.copy(material.userData.bossPhaseBaseColor).lerp(hostileColor, tintAmount);
        }
        if (material.emissive?.copy && material.userData.bossPhaseBaseEmissive) {
          material.emissive.copy(material.userData.bossPhaseBaseEmissive).lerp(hostileColor, Math.min(0.45, tintAmount * 1.8));
        }
        if ("emissiveIntensity" in material) {
          const phaseIntensity = material.userData.bossPhaseBaseEmissiveIntensity
            + phaseIndex * 0.08
            + (1 - normalizedHealth) * 0.12;
          material.userData.bossPhaseEmissiveIntensity = phaseIntensity;
          material.emissiveIntensity = phaseIntensity;
        }
        return material;
      });
      node.material = wasArray ? ownedMaterials : ownedMaterials[0];
    });

    const cue = String(phase.phaseCue?.clip ?? phase.phaseCue ?? "").toLowerCase();
    if (previousPhase !== undefined && previousPhase !== phaseIndex && this.bossExposed && !this.boss.defeated) {
      if (cue === "special") this.play(this.boss, "Special", true);
      else if (cue === "attack") this.play(this.boss, "Attack", true);
      let alertCue = null;
      try {
        alertCue = getCombatAlertCue("boss-phase-shift", { phaseIndex, bossId: this.boss.id })
          ?? getCombatAlertCue("phase-change")
          ?? null;
      } catch {
        alertCue = null;
      }
      const position = root.position;
      const alertColor = alertCue?.color ?? alertCue?.particleColor ?? this.presentation?.palette?.hostile ?? "#ff7f79";
      this.particles?.emit(position.x, position.y + 1, position.z, alertColor, Math.max(4, Number(alertCue?.count ?? alertCue?.particleCount) || 12), {
        speedMin: Number(alertCue?.speedMin) || 1,
        speedMax: Number(alertCue?.speedMax) || 2.5,
        life: Number(alertCue?.life) || 0.65,
        gravity: Number.isFinite(Number(alertCue?.gravity)) ? Number(alertCue.gravity) : 1.2,
        upBias: Number(alertCue?.upBias) || 0.8,
      });
      this.audio.playTone(position.x, position.y + 1, position.z, {
        freq: Number(alertCue?.frequency ?? alertCue?.freq) || 240,
        endFreq: Number(alertCue?.endFrequency ?? alertCue?.endFreq) || 620,
        duration: Number(alertCue?.duration) || 0.28,
        type: alertCue?.type ?? "sawtooth",
        gain: Number(alertCue?.gain) || 0.5,
      });
    }
  }
  applySummonEvolutionVisuals(summons) {
    const levels = summons?.levels;
    if (!levels || typeof levels !== "object") return;
    const nextLevels = new Map(
      Object.entries(levels).map(([recipeId, level]) => [recipeId, Math.max(0, Number(level) || 0)]),
    );
    const previousLevels = this.summonLevels;
    this.summonLevels = nextLevels;
    if (!previousLevels || this.destroyed) return;

    const position = this.portal?.position ?? this.commander?.root?.position ?? this.commanderPosition;
    for (const [recipeId, level] of nextLevels) {
      if (level <= (previousLevels.get(recipeId) ?? 0)) continue;
      let cue = null;
      try {
        cue = getCombatAlertCue("summon-evolution") ?? getCombatAlertCue("summon-evolved") ?? null;
      } catch {
        cue = null;
      }
      const color = cue?.color ?? cue?.particleColor ?? this.presentation?.palette?.ally ?? "#70e5d0";
      this.particles?.emit(position.x, position.y + 0.8, position.z, color, Math.min(24, 12 + level * 4), {
        speedMin: Number(cue?.speedMin) || 0.9,
        speedMax: Number(cue?.speedMax) || 2.8,
        life: Number(cue?.life) || 0.8,
        gravity: Number.isFinite(Number(cue?.gravity)) ? Number(cue.gravity) : -0.25,
        upBias: Number(cue?.upBias) || 0.9,
      });
      this.audio.playTone(position.x, position.y + 0.8, position.z, {
        freq: Number(cue?.frequency ?? cue?.freq) || 420,
        endFreq: Number(cue?.endFrequency ?? cue?.endFreq) || 760,
        duration: Number(cue?.duration) || 0.32,
        type: cue?.type ?? "triangle",
        gain: Number(cue?.gain) || 0.48,
      });
      if (this.portalProp) this.play(this.portalProp, "Activate", true);
      this.lastSummonEvolution = { recipeId, level, cue };
    }
  }

  applyCampaignState({ campaign, stage, encounter, state } = {}) {
    if (this.destroyed) return;
    // bossPattern is stage config (campaign-state.js), not runtime state, so
    // it only needs to be re-latched when a stage changes, not every frame.
    this.bossPattern = stage?.bossPattern ?? null;
    this.stageId = stage?.id ?? this.stageId ?? null;
    const config = encounter?.config ?? stage?.encounter ?? null;
    const encounterState = encounter?.state ?? state?.encounter ?? state ?? campaign?.stage?.encounter ?? encounter ?? null;
    const stageId = encounter?.stageId ?? stage?.id ?? campaign?.stageId ?? null;
    this.capturedCount = Number(state?.stage?.nodes ?? state?.nodes ?? campaign?.stage?.nodes ?? this.capturedCount ?? 0);
    const isPossessed = state?.possessed === true || campaign?.stage?.possessed === true;
    this.authoritativePossessed = isPossessed;
    const legion = Number(state?.legion ?? campaign?.stage?.legion);
    if (Number.isInteger(legion) && legion >= 0) {
      this.authoritativeLegion = legion;
      this.reconcileAllies(legion);
      for (let index = 0; index < this.allies.length; index += 1) {
        this.allies[index].isPossessed = isPossessed && index === 0;
      }
      this.emitSelectionChange();
    }
    const bossHealth = Number(state?.bossHealth ?? campaign?.stage?.bossHealth);
    const bossMaxHealth = Number(
      state?.bossMaxHealth
      ?? campaign?.stage?.bossMaxHealth
      ?? campaign?.stage?.bossHealth
      ?? stage?.bossHealth
      ?? this.bossMaxHealth
      ?? bossHealth,
    );
    if (Number.isFinite(bossMaxHealth) && bossMaxHealth > 0) this.bossMaxHealth = bossMaxHealth;
    if (Number.isFinite(bossHealth)) {
      if (this.boss) {
        this.boss.hp = bossHealth;
        this.boss.maxHealth = this.bossMaxHealth;
      }
      if (bossHealth <= 0 && this.boss && !this.boss.defeated) {
        if (this.lastBossHealth > 0) {
          this.defeat(this.boss);
        } else {
          this.boss.defeated = true;
          this.clearEngagement(this.boss);
          this.play(this.boss, "Defeat", true);
        }
      }
      this.lastBossHealth = bossHealth;
    }
    this.applyEncounter({ stageId, config, state: encounterState });
    if (Number.isFinite(bossHealth) && this.bossMaxHealth > 0) {
      let phase;
      try {
        phase = resolveBossPhase({
          health: bossHealth,
          maxHealth: this.bossMaxHealth,
          phaseCount: Number(state?.bossPhaseCount ?? stage?.bossPhaseCount ?? 3) || 3,
        });
      } catch {
        phase = null;
      }
      if (phase) this.applyBossPhaseVisual(phase);
    }
    const skills = state?.progression?.skills ?? campaign?.state?.progression?.skills ?? campaign?.progression?.skills;
    if (skills) {
      this.fortificationLevel = Number(skills.fortification) || 0;
      this.mobilityLevel = Number(skills.mobility) || 0;
      this.commandLevel = Number(skills.command) || 0;
    }
    const summons = state?.progression?.summons ?? campaign?.state?.progression?.summons ?? campaign?.progression?.summons;
    if (summons) this.applySummonEvolutionVisuals(summons);
    const deployments = state?.stage?.deployments ?? campaign?.stage?.deployments ?? state?.deployments ?? [];
    this.reconcileDeployments(deployments);
    this.updateNodeVisuals();
    this.syncObjectFeedback({ silent: true });
  }

  reconcileEncounterWave(activeWaveId = this.encounter?.state?.activeWaveId ?? null) {
    const wave = this.encounter?.config?.waves?.find((candidate) => candidate?.id === activeWaveId);
    if (!wave || this.currentWaveId !== wave.id) {
      this.clearEncounterWave();
      if (!wave || !this.scene || !this.templates.has("units/scout.glb")) return;
      this.currentWaveId = wave.id;
      this.spawnEncounterWave(wave);
    }
  }

  retire(instance) {
    const disposed = this.disposedResources;
    instance?.root?.traverse?.((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material?.userData?.isRuntimeAssetClone) {
          disposeUnique(node.geometry, disposed);
          disposeMaterialResources(material, disposed);
        } else if (
          material?.userData?.isRuntimeOwnedMaterial
          || material?.userData?.isBossIdentityTint
          || material?.userData?.isBossPhaseTint
        ) {
          disposeUnique(material, disposed);
        }
      }
    });
    if (!instance?.mixer) return;
    instance.mixer.stopAllAction();
    instance.mixer.uncacheRoot(instance.root);
    const index = this.mixers.indexOf(instance.mixer);
    if (index >= 0) this.mixers.splice(index, 1);
    instance.actions?.clear();
    instance.active = null;
    instance.root?.removeFromParent();
  }

  resolveSpawn(unit, x, z) {
    const candidates = [{ x, z }];
    for (let distance = 0.3; distance <= 2; distance += 0.3) {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        candidates.push({ x: x + Math.cos(angle) * distance, z: z + Math.sin(angle) * distance });
      }
    }
    for (const candidate of candidates) {
      this.setGroundedPosition(unit, candidate.x, candidate.z);
      const resolved = this.resolveMovement(unit, candidate.x, candidate.z);
      if (!resolved.blocked) {
        unit.root.position.set(resolved.x, resolved.y, resolved.z);
        return true;
      }
    }
    return false;
  }

  clearEncounterWave() {
    for (const enemy of this.enemies) {
      this.clearEngagement(enemy);
      this.retire(enemy);
    }
    this.enemies.length = 0;
    this.currentWaveId = null;
  }
  createEchoThrone() {
    if (this.echoThroneProp || !this.scene || !this.templates.has("props/echo-throne.glb")) return this.echoThroneProp;
    const prop = this.cloneTemplate("props/echo-throne.glb", 2.2);
    const anchor = this.navigation.anchors.boss;
    const position = this.gridToWorld(anchor.x, anchor.y);
    this.setGroundedPosition(prop, position.x, position.z);
    this.scene.add(prop.root);
    this.echoThroneProp = prop;
    return prop;
  }
  createAlly() {
    const identityResource = this.authoritativePossessed && this.allies.length === 0 && this.templates.has("units/possessed.glb")
      ? "units/possessed.glb"
      : "units/shade.glb";
    const ally = this.cloneTemplate(identityResource, 1.15);
    ally.radius = 0.4;
    ally.hp = 3;
    ally.maxHealth = 3;
    ally.isPossessed = identityResource === "units/possessed.glb";
    ally.defeated = false;
    ally.id = `ally-${this.nextActorId++}`;
    ally.root.userData.ally = ally;
    const formation = this.allies.length % 3 - 1;
    if (!this.resolveSpawn(ally, this.commanderPosition.x - 0.3, this.commanderPosition.z + formation * 1.1)) {
      this.retire(ally);
      return;
    }
    this.scene.add(ally.root);
    this.allies.push(ally);
    this.allyPickRoots.push(ally.root);
    this.play(ally, "Special", true);
  }

  reconcileAllies(count) {
    if (!this.scene || !this.templates.has("units/shade.glb")) return;
    const target = Math.max(0, count);
    const survivors = [];
    for (const ally of this.allies) {
      if (ally.defeated) {
        this.clearEngagement(ally);
        this.retire(ally);
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
      this.retire(ally);
    }
    while (this.allies.length < target) {
      const before = this.allies.length;
      this.createAlly();
      if (this.allies.length === before) break;
    }
    this.allyPickRoots.length = 0;
    for (const ally of this.allies) {
      if (this.liveAlly(ally)) this.allyPickRoots.push(ally.root);
    }
    this.emitSelectionChange();
  }

  spawnEncounterWave(wave) {
    if (this.destroyed) return;
    const count = Math.max(0, Number(wave?.hostiles) || 0);
    const alertedPatterns = new Set();
    let model = "units/scout.glb";
    if (wave?.id === "guard") model = "units/guard.glb";
    else if (wave?.id === "reinforcement" || wave?.id === "reinforce") model = "units/reinforce.glb";
    if (!this.templates.has(model)) {
      model = "units/scout.glb";
    }
    for (let index = 0; index < count; index += 1) {
      const enemy = this.cloneTemplate(model, 1.2);
      enemy.radius = 0.42;
      enemy.id = `enemy-${wave.id || "wave"}-${this.enemySerial}`;
      const routeIndex = index % 3;
      const routeCells = this.navigation.routePath(routeIndex, true);
      const spawnWorld = this.navigation.gridToWorld(routeCells[0].x + 0.5, routeCells[0].y + 0.5);
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
      enemy.pattern = pattern;
      enemy.patternId = pattern.patternId ?? pattern.id ?? wave?.id ?? "rusher";
      
      enemy.detourPreference = this.enemySerial % 2 === 0 ? 1 : -1;
      
      const spawned = this.resolveSpawn(
        enemy,
        spawnWorld.x,
        spawnWorld.z,
      );
      
      enemy.root.rotation.y = -Math.PI / 2;
      this.enemySerial += 1;
      
      if (!spawned) {
        this.retire(enemy);
        continue;
      }
      
      enemy.routeIndex = routeIndex;
      enemy.waypoints = routeCells.map((cell) => {
        const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
        return new THREE.Vector3(world.x, 0, world.z);
      });
      for (const wp of enemy.waypoints) {
        const nav = this.navigationAt(wp.x, wp.z);
        wp.y = nav.elevation * TERRAIN_ELEVATION_SCALE;
      }
      enemy.waypointIndex = 0;
      
      enemy.hp = Math.max(1, Number(wave.hostileHealth) || 2);
      enemy.archetype = wave.id;
      enemy.alertTimer = Number(pattern?.movement?.alertOffset) || (0.35 + routeIndex * 0.18);
      enemy.pauseTimer = 0;
      
      enemy.defeated = false;
      enemy.breachVisualized = false;
      this.scene.add(enemy.root);
      this.enemies.push(enemy);
      this.play(enemy, "Move");
      const alertEvent = enemy.patternId === "guardian"
        ? "guardian-shield"
        : (enemy.patternId === "ranged" ? "enemy-ranged-warning" : "start-wave");
      if (!alertedPatterns.has(enemy.patternId)) {
        alertedPatterns.add(enemy.patternId);
        this.emitCombatAlert(enemy, alertEvent);
      }
    }
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
      : `wave-cleared:${waveId}`;
    if (this.encounterEventKeys.has(eventKey)) return;
    this.encounterEventKeys.add(eventKey);
    const event = { type, stageId, waveId, ...(type === "breach" && enemy?.id ? { enemyId: enemy.id } : {}) };
    if (type === "wave-cleared") this.pendingEncounterEvent = event;
    if (type === "breach") {
      const cue = getCombatAlertCue(type);
      this.objectFeedback?.emitSpeech("commander", this.resolveFeedbackSpeech(cue));
    }
    if (this.onEncounterEvent) this.onEncounterEvent(event);
    else if (type === "breach") this.onEnemyBreach?.();
  }

  syncBossExposure() {
    if (!this.boss?.root) return;
    this.boss.root.visible = this.bossExposed;
    this.boss.root.userData.semantic = this.bossExposed ? "assault" : null;
  }

  activeEngagements() {
    let count = 0;
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (enemy && this.engagements.get(enemy) === ally && this.liveAlly(ally) && this.liveEnemy(enemy)) count += 1;
    }
    return count;
  }

  resolvedWaveCount() {
    let resolved = 0;
    for (const wave of this.encounter?.state?.waves ?? []) {
      if (wave?.cleared === true) resolved += 1;
    }
    return resolved;
  }

  visibleAllyCount() {
    let visible = 0;
    for (const ally of this.allies) {
      if (!ally.defeated) visible += 1;
    }
    return visible;
  }

  getRuntimeState() {
    return {
      mode: "realtime-3d",
      enemiesActive: this.enemies.length,
      alliesVisible: this.visibleAllyCount(),
      engagements: this.activeEngagements(),
      exchanges: this.exchanges,
      activeWaveId: this.encounter?.state?.activeWaveId ?? null,
      resolved: this.resolvedWaveCount(),
      total: this.encounter?.config?.waves?.length ?? 0,
      bossExposed: this.bossExposed,
    };
  }

  feedbackObjects() {
    const objects = [];
    const add = (actor, kind, label, priority = 0) => {
      if (!actor?.id) return;
      const record = {
        id: actor.id,
        kind,
        label,
        hp: Number(actor.hp ?? 0),
        maxHp: Number(actor.maxHealth ?? actor.maxHp ?? 1),
        selected: this.selection?.has(actor) ?? false,
        visible: actor.defeated !== true,
        priority,
      };
      // Surface attack-readiness as a secondary "stamina" bar for units whose
      // next action is gated by a cooldown timer (allies and towers only).
      if (kind === "ally" && typeof actor.cooldown === "number") {
        record.maxEnergy = ALLY_STRIKE_COOLDOWN;
        record.energy = Math.max(0, ALLY_STRIKE_COOLDOWN - actor.cooldown);
      } else if (kind === "tower" && typeof actor.cooldown === "number") {
        record.maxEnergy = TOWER_FIRE_COOLDOWN;
        record.energy = Math.max(0, TOWER_FIRE_COOLDOWN - actor.cooldown);
      }
      objects.push(record);
    };
    add(this.commander, "commander", "Commander", 5);
    add(this.boss, "boss", "Boss", 4);
    for (const ally of this.allies) add(ally, "ally", "Ally", 3);
    for (const enemy of this.enemies) add(enemy, "enemy", "Enemy", 2);
    for (const deployment of this.deploymentsMap.values()) add(deployment, deployment.kind ?? "deployment", deployment.kind ?? "Deployment", 1);
    return objects;
  }

  syncObjectFeedback({ silent = true } = {}) {
    if (!this.objectFeedback) return;
    const objects = this.feedbackObjects();
    this.objectFeedback.reconcile(objects, { silent });
    for (const object of objects) {
      if (!this.feedbackCache.has(object.id)) this.feedbackCache.set(object.id, { hp: object.hp, maxHp: object.maxHp });
    }
  }

  updateObjectFeedbackDeltas() {
    if (!this.objectFeedback) return;
    for (const object of this.feedbackObjects()) {
      const previous = this.feedbackCache.get(object.id);
      if (!previous) {
        this.feedbackCache.set(object.id, { hp: object.hp, maxHp: object.maxHp });
        continue;
      }
      const delta = object.hp - previous.hp;
      if (delta !== 0) {
        this.objectFeedback.emitExchange(
          object.id,
          object.id,
          Math.abs(delta),
          delta > 0 ? "heal" : "outgoing",
        );
        previous.hp = object.hp;
      }
      previous.maxHp = object.maxHp;
    }
  }

  renderObjectFeedback() {
    if (!this.objectFeedback) return;
    this.objectFeedback.render((object) => {
      const actor = object.id === "commander"
        ? this.commander
        : object.id === "boss"
          ? this.boss
          : [...this.allies, ...this.enemies].find((candidate) => candidate?.id === object.id)
            ?? this.deploymentsMap.get(object.id);
      const position = actor?.root?.position;
      if (!position || !this.camera?.project) return { x: 0, y: 0, depth: 0, visible: true };
      const projected = position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z);
      projected.project(this.camera);
      return {
        x: (projected.x * 0.5 + 0.5) * this.feedbackCanvas.width,
        y: (-projected.y * 0.5 + 0.5) * this.feedbackCanvas.height,
        depth: projected.z,
        visible: projected.z >= -1 && projected.z <= 1,
      };
    });
  }

  publishRuntimeState() {
    const enemiesActive = this.enemies.length;
    const alliesVisible = this.visibleAllyCount();
    const engagements = this.activeEngagements();
    const activeWaveId = this.encounter?.state?.activeWaveId ?? null;
    const resolved = this.resolvedWaveCount();
    const total = this.encounter?.config?.waves?.length ?? 0;
    const signature = `${enemiesActive}|${alliesVisible}|${engagements}|${this.exchanges}|${activeWaveId ?? ""}|${resolved}|${total}|${this.bossExposed ? 1 : 0}`;
    if (signature === this.runtimeSignature) return;
    this.runtimeSignature = signature;
    this.onRuntimeState?.({
      mode: "realtime-3d",
      enemiesActive,
      alliesVisible,
      engagements,
      exchanges: this.exchanges,
      activeWaveId,
      resolved,
      total,
      bossExposed: this.bossExposed,
    });
  }

  // Compatibility wrapper: visual effects must not establish or remove encounter units.
  spawnEnemy() {
    this.playActionEffect({ action: "hunt", source: "portal", target: "extractor" });
  }

  // Action feedback is renderer-local: it communicates a command that
  // campaign-state.js has already accepted, but never establishes units,
  // encounters, rewards, damage, or player orders.
  actionFeedbackPoint(point) {
    if (point === "portal") return this.portal?.position ?? this.commanderPosition;
    if (point === "extractor") {
      const extractor = this.navigation.anchors.extractor;
      const position = this.navigation.gridToWorld(extractor.x, extractor.y);
      return { x: position.x, y: this.navigationAt(position.x, position.z).elevation * TERRAIN_ELEVATION_SCALE, z: position.z };
    }
    if (point === "node") return this.node?.position ?? this.commanderPosition;
    if (point === "ally") return this.allies.find((candidate) => this.liveAlly(candidate))?.root?.position ?? this.commanderPosition;
    if (point === "boss") return this.boss?.root?.position ?? this.commanderPosition;
    return this.commander?.root?.position ?? this.commanderPosition;
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

    const targetPt = this.actionFeedbackPoint(pointName);
    if (!targetPt) {
      return { ready: false, reason: "no-target" };
    }

    if (!this.navigation || !this.navigation.anchors) {
      return { ready: false, reason: "path-blocked" };
    }

    // Each action reads through a specific world gimmick/anchor; the
    // commander must physically stand near it before the campaign executes
    // the queued command.
    if (this.commanderPosition) {
      const dx = this.commanderPosition.x - targetPt.x;
      const dz = this.commanderPosition.z - (targetPt.z ?? targetPt.y ?? 0);
      const distance = Math.hypot(dx, dz);
      if (distance > ACTION_INTERACTION_RADIUS) {
        return { ready: false, reason: "out-of-range", distance, required: ACTION_INTERACTION_RADIUS };
      }
    }

    return { ready: true, reason: "ready" };
  }
  actionFeedbackActor(actor) {
    if (actor === "ally") return this.allies.find((candidate) => this.liveAlly(candidate)) ?? this.commander;
    if (actor === "boss") return this.boss;
    return this.commander;
  }

  pulseActionMarker(point) {
    if (point === "portal") this.portalPulse = Math.max(this.portalPulse, 2.15);
    if (point === "node") this.nodePulse = Math.max(this.nodePulse, 2.15);
  }

  actionFeedbackProfile(action) {
    const palette = this.presentation?.palette ?? {};
    const ally = palette.ally ?? "#70e5d0";
    const accent = palette.accent ?? "#ffb85c";
    const hostile = palette.hostile ?? "#ff7f79";
    const profile = {
      hunt: { color: accent, count: 12, gain: 0.52 },
      extract: { color: ally, count: 14, gain: 0.58 },
      materialize: { color: ally, count: 20, gain: 0.7 },
      capture: { color: accent, count: 18, gain: 0.66 },
      possess: { color: accent, count: 16, gain: 0.62 },
      domain: { color: accent, count: 24, gain: 0.74 },
      assault: { color: hostile, count: 28, gain: 0.78 },
    }[action];
    return profile ? { action, ...profile } : null;
  }

  emitActionFeedback(semantic = {}) {
    const profile = this.actionFeedbackProfile(semantic.action);
    if (!profile) return null;
    const source = this.actionFeedbackPoint(semantic.source);
    const target = this.actionFeedbackPoint(semantic.target);
    const { action, color, count, gain } = profile;
    this.pulseActionMarker(semantic.source);
    this.pulseActionMarker(semantic.target);
    const sourceCount = Math.max(4, Math.floor(count * 0.42));
    const emit = (position, amount) => this.particles?.emit(position.x, position.y + 0.72, position.z, color, amount, {
      speedMin: 0.8,
      speedMax: action === "assault" ? 4.4 : 2.9,
      life: action === "domain" ? 0.9 : 0.58,
      gravity: action === "domain" ? -0.45 : 2.4,
      upBias: action === "assault" ? 0.45 : 0.9,
    });
    emit(source, sourceCount);
    if (source.x !== target.x || source.y !== target.y || source.z !== target.z) emit(target, count);
    else emit(target, count - sourceCount);
    this.audio.playSample(action, source.x, source.y + 0.72, source.z, gain);
    if (source.x !== target.x || source.y !== target.y || source.z !== target.z) {
      this.audio.playTone(target.x, target.y + 0.72, target.z, {
        freq: action === "assault" ? 170 : 420,
        endFreq: action === "assault" ? 90 : 760,
        duration: 0.16,
        type: action === "assault" ? "sawtooth" : "sine",
        gain: gain * 0.4,
      });
    }
    if (action === "assault") {
      this.shakeCamera(0.12, 0.18);
      this.triggerHitStop(0.06);
    }
    return { action, source, target };
  }

  playActionEffect(semantic = {}) {
    const action = semantic?.action;
    if (!action || this.destroyed) return;
    this.emitActionFeedback(semantic);
    const actor = this.actionFeedbackActor(semantic.actor);
    if (actor) this.play(actor, semantic.actorClip ?? semantic.clip ?? "Special", true);
    if (action === "assault" && this.bossExposed && this.boss && !this.boss.defeated) this.play(this.boss, "Attack", true);
    if (action === "possess" || action === "domain") this.rally.copy(this.commanderPosition);
    if (action === "domain") {
      const echoThrone = this.createEchoThrone();
      if (echoThrone) this.play(echoThrone, "Activate", true);
    }
    if (action === "materialize" && this.portalProp) {
      this.play(this.portalProp, "Activate", true);
    }
    if (action === "extract" && this.extractorProp) {
      this.play(this.extractorProp, "Activate", true);
    }
    if (action === "capture" && this.nodeProps) {
      const targetPos = this.node?.position;
      if (targetPos) {
        const obelisk = this.nodeProps.find(op => op.root.position.distanceTo(targetPos) < 0.1);
        if (obelisk) {
          this.play(obelisk, "Activate", true);
        }
      }
    }
  }

  triggerAction(semantic) {
    this.playActionEffect(semantic);
  }

  clearHover() {
    if (this.canvas && this.canvas.style) {
      this.canvas.style.cursor = "";
    }
    if (this.lastHoveredAction !== null) {
      this.lastHoveredAction = null;
      this.onActionFocus?.(null);
    }
  }

  resetPreviewEmphasis() {
    const root = this.boss?.root;
    if (!root?.userData || !Object.prototype.hasOwnProperty.call(root.userData, "originalScaleScalar")) return;
    root.scale.setScalar(root.userData.originalScaleScalar);
    delete root.userData.originalScaleScalar;
    root.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!Object.prototype.hasOwnProperty.call(material?.userData ?? {}, "previewOriginalEmissiveIntensity")) continue;
        material.emissiveIntensity = material.userData.previewOriginalEmissiveIntensity;
        delete material.userData.previewOriginalEmissiveIntensity;
      }
    });
  }

  dispatchActionRequest(action, event) {
    if (!this.requestAction) return;
    rendererRequestSequence += 1;
    this.requestAction({
      type: "command-request",
      action,
      requestId: `renderer-request-${rendererRequestSequence}`,
      source: "renderer-pointer",
      rendererMode: "realtime-3d",
      occurredAt: Number.isFinite(event?.timeStamp) ? event.timeStamp : Date.now()
    });
  }

  previewAction(semantic) {
    if (!semantic?.action) {
      this.clearActionPreview();
      return;
    }
    if (this.previewActionSemantic?.action !== semantic.action) this.resetPreviewEmphasis();
    if (semantic.commandId === undefined && semantic.phase === undefined) {
      this.previewActionSemantic = semantic;
    } else {
      const copy = { ...semantic };
      if (semantic.commandId !== undefined) {
        copy.commandId = semantic.commandId;
      } else {
        delete copy.commandId;
      }
      if (semantic.phase !== undefined) {
        copy.phase = semantic.phase;
      } else {
        delete copy.phase;
      }
      this.previewActionSemantic = copy;
    }
  }

  clearActionPreview(action = null) {
    if (action && this.previewActionSemantic?.action !== action) return;
    this.previewActionSemantic = null;
    this.resetPreviewEmphasis();
  }

  updatePreviewEmphasis() {
    const semantic = this.previewActionSemantic;
    if (!semantic) {
      this.resetPreviewEmphasis();
      return;
    }

    const targets = [semantic.source, semantic.target];
    if (!targets.includes("boss")) this.resetPreviewEmphasis();
    const time = performance.now() * 0.005;
    const pulseFactor = 1.0 + Math.sin(time * 12.0) * 0.12;

    if (targets.includes("portal") && this.portal) {
      this.portalPulse = Math.max(this.portalPulse, 2.5 + Math.sin(time * 12.0) * 0.5);
    }
    if (targets.includes("node") && this.node) {
      this.nodePulse = Math.max(this.nodePulse, 2.5 + Math.sin(time * 12.0) * 0.5);
    }
    if (targets.includes("boss") && this.boss && this.boss.root) {
      if (!this.boss.root.userData.originalScaleScalar) {
        this.boss.root.userData.originalScaleScalar = this.boss.root.scale.x;
      }
      this.boss.root.scale.setScalar(this.boss.root.userData.originalScaleScalar * pulseFactor);
      
      this.boss.root.traverse((node) => {
        if (node.isMesh) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (!material?.userData?.isBossIdentityTint) continue;
            if (!Object.prototype.hasOwnProperty.call(material.userData, "previewOriginalEmissiveIntensity")) {
              material.userData.previewOriginalEmissiveIntensity = material.emissiveIntensity;
            }
            material.emissiveIntensity = 1.2 + Math.sin(time * 12.0) * 0.4;
          }
        }
      });
    }
  }

  setHud(hud) {
    this.hud = hud;
  }

  onVisibility() {
    if (document.hidden) {
      this.clearPressedInput();
      this.clearHover();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.running && !this.raf) {
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.rafCallback);
    }
  }

  onContextLost(event) {
    event.preventDefault();
    this.destroy();
    this.onAssetStatus?.({ state: "unavailable" });
    this.onRendererFailure?.();
  }
  setPlacementMode(kind) {
    this.placementMode = kind || null;
    if (!this.placementMode) {
      if (this.placementPreview) {
        this.scene.remove(this.placementPreview);
        this.placementPreview.traverse((node) => {
          if (node.isMesh) {
            node.geometry?.dispose();
            node.material?.dispose();
          }
        });
        this.placementPreview = null;
      }
    } else {
      if (!this.placementPreview) {
        const geom = new THREE.BoxGeometry(0.92, 0.15, 0.92);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x70e5d0,
          transparent: true,
          opacity: 0.5
        });
        this.placementPreview = new THREE.Mesh(geom, mat);
        this.scene.add(this.placementPreview);
      }
      this.placementPreview.visible = false;
    }
  }

  isPlacementLegal(gridX, gridY) {
    const x = Math.floor(gridX);
    const y = Math.floor(gridY);
    const w = this.navigation?.width ?? 24;
    const h = this.navigation?.height ?? 12;
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    
    const deployments = [];
    for (const dep of this.deploymentsMap.values()) {
      deployments.push({
        id: dep.id,
        kind: dep.kind,
        x: dep.gridX,
        y: dep.gridY
      });
    }
    
    return !!this.navigation?.validateDeployment?.(x, y, deployments, this.placementMode)?.valid;
  }

  updatePlacementPreview() {
    if (!this.placementMode || !this.placementPreview) return;
    if (this.pointer) {
      if (this.setPointerRay({ clientX: this.pointer.x, clientY: this.pointer.y })) {
        const groundHit = this.raycaster.intersectObject(this.ground, false)[0];
        if (groundHit) {
          const grid = this.navigation.worldToGrid(groundHit.point.x, groundHit.point.z);
          const x = Math.floor(grid.x);
          const y = Math.floor(grid.y);
          if (x >= 0 && x < 24 && y >= 0 && y < 12) {
            const world = this.navigation.gridToWorld(x + 0.5, y + 0.5);
            const elevation = this.navigation.elevationAt(x + 0.5, y + 0.5);
            const yPos = elevation * TERRAIN_ELEVATION_SCALE;
            this.placementPreview.position.set(world.x, yPos + 0.1, world.z);
            this.placementPreview.visible = true;
            const legal = this.isPlacementLegal(x, y);
            const color = legal
              ? (this.presentation?.palette?.ally ?? "#70e5d0")
              : (this.presentation?.palette?.hostile ?? "#ff7f79");
            this.placementPreview.material.color.set(color);
            return;
          }
        }
      }
    }
    this.placementPreview.visible = false;
  }

  focusTacticalCell(cell) {
    this.focusedCell = cell || null;
    this.updateFocusHighlight();
  }

  getTacticalSnapshot() {
    const units = [];
    if (this.commander && !this.commander.defeated) {
      units.push({
        id: this.commander.id || "commander",
        team: 1,
        x: this.commander.root.position.x,
        z: this.commander.root.position.z,
        hp: 3
      });
    }
    for (let i = 0; i < this.allies.length; i++) {
      const ally = this.allies[i];
      if (this.liveAlly(ally)) {
        units.push({
          id: ally.id || `ally-${i}`,
          team: 1,
          x: ally.root.position.x,
          z: ally.root.position.z,
          hp: ally.hp
        });
      }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (this.liveEnemy(enemy)) {
        units.push({
          id: enemy.id || `enemy-${i}`,
          team: 2,
          x: enemy.root.position.x,
          z: enemy.root.position.z,
          hp: enemy.hp
        });
      }
    }
    if (this.bossExposed && this.boss && !this.boss.defeated) {
      units.push({
        id: this.boss.id || "boss",
        team: 2,
        x: this.boss.root.position.x,
        z: this.boss.root.position.z,
        hp: this.boss.hp !== undefined ? this.boss.hp : (this.lastBossHealth !== null ? this.lastBossHealth : 20)
      });
    }
    const deployments = [];
    for (const [id, dep] of this.deploymentsMap.entries()) {
      deployments.push({
        id: dep.id,
        kind: dep.kind,
        x: dep.gridX,
        y: dep.gridY
      });
    }
    const focus = this.focusedCell ? { x: this.focusedCell.x, y: this.focusedCell.y } : null;
    return {
      stageNumber: this.stageNumber,
      navigation: this.cachedNavigationSnapshot || {},
      units,
      deployments,
      focus,
      selectionCount: this.selection ? this.selection.size : 0,
      placementMode: this.placementMode,
      towerShots: this.frameShots || [],
      viewport: this.camera ? { x: this.camera.position.x, z: this.camera.position.z, zoom: this.zoom } : null
    };
  }

  updateTracers(dt) {
    if (!this.tracers) return;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.age += dt;
      if (tracer.age >= tracer.maxAge) {
        this.scene.remove(tracer.line);
        tracer.line.geometry?.dispose();
        tracer.material?.dispose();
        this.tracers.splice(i, 1);
      } else {
        tracer.material.opacity = 1.0 - (tracer.age / tracer.maxAge);
      }
    }
  }

  updateFocusHighlight() {
    if (this.focusedCell) {
      if (!this.focusHighlightMesh) {
        const geom = new THREE.RingGeometry(0.5, 0.6, 16);
        const mat = new THREE.MeshBasicMaterial({
          color: this.presentation?.palette?.accent ?? 0xffb85c,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        this.focusHighlightMesh = new THREE.Mesh(geom, mat);
        this.focusHighlightMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.focusHighlightMesh);
      }
      const world = this.navigation.gridToWorld(this.focusedCell.x + 0.5, this.focusedCell.y + 0.5);
      const elevation = this.navigation.elevationAt(this.focusedCell.x + 0.5, this.focusedCell.y + 0.5);
      this.focusHighlightMesh.position.set(world.x, elevation * TERRAIN_ELEVATION_SCALE + 0.05, world.z);
      this.focusHighlightMesh.visible = true;
    } else {
      if (this.focusHighlightMesh) {
        this.focusHighlightMesh.visible = false;
      }
    }
  }

  updateSelectionVisuals() {
    if (!this.ringGeometry) return;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally)) continue;
      const isSelected = this.selection.has(ally);
      if (isSelected) {
        if (!ally.selectionRing) {
          const ringMat = new THREE.MeshBasicMaterial({
            color: this.presentation?.palette?.ally ?? 0x70e5d0,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          const ring = new THREE.Mesh(this.ringGeometry, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.1;
          ring.renderOrder = 12;
          ally.root.add(ring);
          ally.selectionRing = ring;
        }
        const reducedMotion = this.presentation?.reducedMotion ?? false;
        const pulse = reducedMotion ? 0 : (Math.sin(performance.now() * 0.008) + 1) * 0.5;
        ally.selectionRing.scale.setScalar(0.78 + pulse * 0.12);
        ally.selectionRing.material.opacity = 0.76 + pulse * 0.2;
        ally.selectionRing.visible = true;
      } else {
        if (ally.selectionRing) {
          ally.selectionRing.visible = false;
        }
      }
    }

    // Update active route preview endpoint pulse continuously
    if (this.routePreviewActive && this.routePreview?.endpoint) {
      const reducedMotion = this.presentation?.reducedMotion ?? false;
      const time = performance.now() * 0.001;
      const endpointPulse = reducedMotion ? 1.0 : 1.0 + Math.sin(time * 12.0) * 0.15;
      this.routePreview.endpoint.scale.setScalar(endpointPulse);

      // Flow the dashed route line toward the destination so the travel
      // direction reads at a glance; static under reduced motion.
      if (this.routePreview.line?.material) {
        this.routePreview.line.material.dashOffset = reducedMotion ? 0 : -((time * 0.6) % 0.34);
      }
    }
  }

  updateMarqueeVisual() {
    if (this.isMarqueeSelecting && this.marqueeRect && this.canvas.parentElement) {
      if (!this.marqueeDiv) {
        this.marqueeDiv = document.createElement("div");
        this.marqueeDiv.style.position = "absolute";
        this.marqueeDiv.style.border = "1.5px dashed #70e5d0";
        this.marqueeDiv.style.backgroundColor = "rgba(112, 229, 208, 0.15)";
        this.marqueeDiv.style.pointerEvents = "none";
        this.marqueeDiv.style.zIndex = "999";
        this.canvas.parentElement.appendChild(this.marqueeDiv);
      }
      const x0 = Math.min(this.marqueeRect.x0, this.marqueeRect.x1);
      const x1 = Math.max(this.marqueeRect.x0, this.marqueeRect.x1);
      const y0 = Math.min(this.marqueeRect.y0, this.marqueeRect.y1);
      const y1 = Math.max(this.marqueeRect.y0, this.marqueeRect.y1);
      const parentRect = this.canvas.parentElement.getBoundingClientRect();
      this.marqueeDiv.style.left = `${x0 - parentRect.left}px`;
      this.marqueeDiv.style.top = `${y0 - parentRect.top}px`;
      this.marqueeDiv.style.width = `${x1 - x0}px`;
      this.marqueeDiv.style.height = `${y1 - y0}px`;
      this.marqueeDiv.style.display = "block";
    } else {
      if (this.marqueeDiv) {
        this.marqueeDiv.style.display = "none";
      }
    }
  }

  updateMarqueeSelection() {
    if (!this.isMarqueeSelecting || !this.marqueeRect) return;
    const x0 = Math.min(this.marqueeRect.x0, this.marqueeRect.x1);
    const x1 = Math.max(this.marqueeRect.x0, this.marqueeRect.x1);
    const y0 = Math.min(this.marqueeRect.y0, this.marqueeRect.y1);
    const y1 = Math.max(this.marqueeRect.y0, this.marqueeRect.y1);
    this.selection.clear();
    for (const ally of this.allies) {
      if (!this.liveAlly(ally)) continue;
      const screenPos = this.projectToScreen(ally.root.position);
      if (screenPos.x >= x0 && screenPos.x <= x1 && screenPos.y >= y0 && screenPos.y <= y1) {
        this.selection.add(ally);
      }
    }
    this.emitSelectionChange();
  }

  projectToScreen(position) {
    const tempV = position.clone();
    tempV.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (tempV.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-tempV.y * 0.5 + 0.5) * rect.height + rect.top
    };
  }

  getGimmickAt(gridX, gridY) {
    const x = Math.floor(gridX);
    const y = Math.floor(gridY);
    if (!this.navigation?.zones) return null;
    const zone = this.navigation.zones.find((z) =>
      z.cells.some((c) => c.x === x && c.y === y)
    );
    if (!zone) return null;
    return TACTICAL_GIMMICKS[zone.kind] || null;
  }

  updateCommanderPathPreview() {
    if (this.commanderPath && this.commanderPath.length > 0) {
      const points = [];
      points.push(this.commander.root.position.clone());
      for (const cell of this.commanderPath) {
        const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
        const nav = this.navigationAt(world.x, world.z);
        points.push(new THREE.Vector3(world.x, nav.elevation * TERRAIN_ELEVATION_SCALE + 0.08, world.z));
      }
      if (!this.commanderPathLine) {
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineDashedMaterial({
          color: this.presentation?.palette?.accent ?? 0xffb85c,
          dashSize: 0.2,
          gapSize: 0.1,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          depthTest: false
        });
        this.commanderPathLine = new THREE.Line(geom, mat);
        this.commanderPathLine.renderOrder = 14;
        this.scene.add(this.commanderPathLine);
      } else {
        this.commanderPathLine.geometry.dispose();
        this.commanderPathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }
      this.commanderPathLine.computeLineDistances();
      this.commanderPathLine.visible = true;

      // Destination marker: a bright pulsing ring at the final waypoint, so
      // "where am I walking to" reads at a glance instead of only via the
      // thin dashed line (see the ally route-preview endpoint for the same
      // visual language, reused here for the commander's own order).
      const destination = points[points.length - 1];
      if (!this.commanderDestinationMarker) {
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(0.2, 0.34, 24),
          new THREE.MeshBasicMaterial({
            color: this.presentation?.palette?.accent ?? 0xffb85c,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false
          })
        );
        marker.renderOrder = 14;
        marker.rotation.x = -Math.PI / 2;
        marker.raycast = () => {};
        this.scene.add(marker);
        this.commanderDestinationMarker = marker;
      }
      this.commanderDestinationMarker.position.copy(destination);
      this.commanderDestinationMarker.visible = true;
      const reducedMotion = this.presentation?.reducedMotion ?? false;
      const pulse = reducedMotion ? 1.0 : 1.0 + Math.sin(performance.now() * 0.001 * 10.0) * 0.18;
      this.commanderDestinationMarker.scale.setScalar(pulse);
    } else {
      if (this.commanderPathLine) {
        this.commanderPathLine.visible = false;
      }
      if (this.commanderDestinationMarker) {
        this.commanderDestinationMarker.visible = false;
      }
    }
  }

  // Rally destination marker: mirrors updateCommanderPathPreview's marker but
  // for a selected-ally rally order, so "where is my squad headed" is just
  // as visible on canvas as the commander's own move order. Any ally still
  // actively walking a customPath/customOrder keeps this marker up; once the
  // whole group arrives it hides, same lifecycle as the commander's marker.
  updateRallyMarker() {
    const anyAllyMoving = this.allies?.some((ally) =>
      ally.customPath?.length > 0 || (ally.customOrder && !ally.customOrderReached)
    );
    if (!anyAllyMoving) {
      if (this.allyRallyMarker) this.allyRallyMarker.visible = false;
      return;
    }
    if (!this.allyRallyMarker) {
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.34, 24),
        new THREE.MeshBasicMaterial({
          color: 0x35e06f,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false
        })
      );
      marker.renderOrder = 14;
      marker.rotation.x = -Math.PI / 2;
      marker.raycast = () => {};
      this.scene.add(marker);
      this.allyRallyMarker = marker;
    }
    const elevation = this.navigationAt(this.rally.x, this.rally.z)?.elevation ?? 0;
    this.allyRallyMarker.position.set(this.rally.x, elevation * TERRAIN_ELEVATION_SCALE + 0.09, this.rally.z);
    this.allyRallyMarker.visible = true;
    const reducedMotion = this.presentation?.reducedMotion ?? false;
    const pulse = reducedMotion ? 1.0 : 1.0 + Math.sin(performance.now() * 0.001 * 10.0) * 0.18;
    this.allyRallyMarker.scale.setScalar(pulse);
  }

  // Action-interaction-range ring: a thin circle at the commander's feet
  // sized to ACTION_INTERACTION_RADIUS, so "how close do I need to walk to
  // act on something" is a visible, constant affordance instead of only
  // discoverable by trial and error via getCommandReadiness()'s out-of-range
  // rejection. Brightens when a currently-available action's world anchor
  // sits inside the ring right now (i.e. the commander could act immediately).
  updateActionRangeRing() {
    if (!this.commanderPosition) return;
    if (!this.scene || typeof this.scene.add !== "function") return;
    if (!this.actionRangeRing) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(ACTION_INTERACTION_RADIUS - 0.05, ACTION_INTERACTION_RADIUS, 48),
        new THREE.MeshBasicMaterial({
          color: 0x8fa3b0,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
          // The ring spans up to ACTION_INTERACTION_RADIUS in every direction,
          // wide enough to cross onto a differently-elevated terrain cell than
          // the single cell it's anchored to (stage heightfields vary --
          // bridges, plateaus, stairs). With depth testing on, any span over
          // higher ground than the commander's own cell rendered as clipped
          // under the map. This is a UI-affordance ring, not a physical
          // object terrain should occlude, so it always draws on top.
          depthTest: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 15;
      ring.raycast = () => {};
      this.scene.add(ring);
      this.actionRangeRing = ring;
    }

    const elevation = this.navigationAt?.(this.commanderPosition.x, this.commanderPosition.z)?.elevation ?? 0;
    this.actionRangeRing.position.set(
      this.commanderPosition.x,
      elevation * TERRAIN_ELEVATION_SCALE + 0.05,
      this.commanderPosition.z
    );

    let anchorInRange = false;
    if (this.getAvailableActions) {
      const available = this.getAvailableActions();
      const actions = typeof available?.values === "function" ? [...available.values()] : available ?? [];
      for (const action of actions) {
        const readiness = this.getCommandReadiness({ action });
        if (readiness.ready) {
          anchorInRange = true;
          break;
        }
      }
    }
    this.actionRangeRing.material.color.set(anchorInRange ? 0x71d8c6 : 0x8fa3b0);
    this.actionRangeRing.material.opacity = anchorInRange ? 0.65 : 0.32;
  }

  updateZoneAmbience(dt) {
    if (!this.navigation?.zones || !this.particles) return;
    this.zoneAmbienceTimer = (this.zoneAmbienceTimer || 0) - dt;
    if (this.zoneAmbienceTimer > 0) return;
    this.zoneAmbienceTimer = 0.15;
    for (const zone of this.navigation.zones) {
      if (!zone.cells || zone.cells.length === 0) continue;
      const cell = zone.cells[Math.floor(Math.random() * zone.cells.length)];
      const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
      const elevation = this.navigation.elevationAt(cell.x + 0.5, cell.y + 0.5);
      const y = elevation * TERRAIN_ELEVATION_SCALE + 0.05;
      let color;
      let count = 1;
      let grav = -0.1;
      let life = 1.2;
      switch (zone.kind) {
        case "hazard":
          color = "#ef4444";
          grav = 0.5;
          break;
        case "current":
          color = "#3b82f6";
          grav = -0.4;
          break;
        case "high-ground":
          color = "#f59e0b";
          break;
        case "cover":
          color = "#10b981";
          break;
        case "flank":
          color = "#8b5cf6";
          break;
        case "objective":
          color = "#06b6d4";
          break;
        case "exposed":
          color = "#ec4899";
          break;
        default:
          continue;
      }
      this.particles.emit(
        world.x + (Math.random() - 0.5) * 0.6,
        y + Math.random() * 0.2,
        world.z + (Math.random() - 0.5) * 0.6,
        color,
        count,
        { speedMin: 0.1, speedMax: 0.3, life, gravity: grav, upBias: 0.3 }
      );
    }
  }

  findTacticalPath(start, goal) {
    const cells = this.navigation.cells.map(row => [...row]);
    const width = this.navigation?.width ?? 24;
    const height = this.navigation?.height ?? 12;
    for (const dep of this.deploymentsMap.values()) {
      if (dep.kind !== "barricade") continue;
      const x = dep.gridX;
      const y = dep.gridY;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        cells[y][x] = -1;
      }
    }
    const sx = Math.max(0, Math.min(width - 1, Math.floor(start.x)));
    const sy = Math.max(0, Math.min(height - 1, Math.floor(start.y)));
    const gx = Math.max(0, Math.min(width - 1, Math.floor(goal.x)));
    const gy = Math.max(0, Math.min(height - 1, Math.floor(goal.y)));
    const startIndex = sy * width + sx;
    const goalIndex = gy * width + gx;
    const permitted = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height || cells[y][x] < 0) return false;
      return true;
    };
    if (!permitted(sx, sy) || !permitted(gx, gy)) return null;
    const parent = new Int16Array(width * height);
    parent.fill(-1);
    const queue = new Int16Array(width * height);
    let read = 0;
    let write = 0;
    parent[startIndex] = startIndex;
    queue[write++] = startIndex;
    const directions = [[1, 0], [0, -1], [0, 1], [-1, 0]];
    while (read < write) {
      const current = queue[read++];
      if (current === goalIndex) break;
      const x = current % width;
      const y = Math.floor(current / width);
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (!permitted(nx, ny)) continue;
        const next = ny * width + nx;
        if (parent[next] !== -1) continue;
        if (Math.abs(cells[ny][nx] - cells[y][x]) > 1) continue;
        parent[next] = current;
        queue[write++] = next;
      }
    }
    if (parent[goalIndex] === -1) return null;
    const path = [];
    for (let current = goalIndex; ; current = parent[current]) {
      path.push({ x: current % width, y: Math.floor(current / width) });
      if (current === startIndex) break;
    }
    return path.reverse();
  }

  drawTracer(from, to) {
    const points = [
      from.clone().add(new THREE.Vector3(0, 1.2, 0)),
      to.clone().add(new THREE.Vector3(0, 0.5, 0))
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const allyColor = this.presentation?.palette?.ally ?? "#70e5d0";
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(allyColor),
      transparent: true,
      opacity: 1.0,
      linewidth: 2
    });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);
    this.tracers.push({
      line,
      material: mat,
      age: 0,
      maxAge: 0.15
    });
  }

  reconcileDeployments(deploymentsList) {
    const currentIds = new Set();
    for (const dep of deploymentsList) {
      const id = dep.id;
      if (!id) continue;
      currentIds.add(id);
      const kind = dep.kind;
      const gridX = dep.cell ? dep.cell.x : (dep.x !== undefined ? dep.x : 0);
      const gridY = dep.cell ? dep.cell.y : (dep.y !== undefined ? dep.y : 0);
      if (!this.deploymentsMap.has(id)) {
        const world = this.navigation.gridToWorld(gridX + 0.5, gridY + 0.5);
        const elevation = this.navigation.elevationAt(gridX + 0.5, gridY + 0.5);
        const y = elevation * TERRAIN_ELEVATION_SCALE;
        const group = new THREE.Group();
        group.position.set(world.x, y, world.z);
        let radius = 0.4;
        if (kind === "tower") {
          const baseGeom = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8);
          const capGeom = new THREE.ConeGeometry(0.3, 0.4, 8);
          capGeom.translate(0, 0.8, 0);
          const allyColor = this.presentation?.palette?.ally ?? "#70e5d0";
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(allyColor),
            roughness: 0.6,
            metalness: 0.2
          });
          const baseMesh = new THREE.Mesh(baseGeom, material);
          baseMesh.position.y = 0.6;
          baseMesh.castShadow = true;
          baseMesh.receiveShadow = true;
          const capMesh = new THREE.Mesh(capGeom, material);
          capMesh.castShadow = true;
          capMesh.receiveShadow = true;
          group.add(baseMesh);
          group.add(capMesh);
          radius = 0.45;
        } else {
          const geom = new THREE.BoxGeometry(0.8, 0.6, 0.8);
          const accentColor = this.presentation?.palette?.accent ?? "#ffb85c";
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(accentColor),
            roughness: 0.8,
            metalness: 0.4
          });
          const visualMesh = new THREE.Mesh(geom, material);
          visualMesh.position.y = 0.3;
          visualMesh.castShadow = true;
          visualMesh.receiveShadow = true;
          group.add(visualMesh);
          const health = dep.hp !== undefined ? dep.hp : 5;
          const maxHp = dep.maxHp !== undefined ? dep.maxHp : 5;
          const healthRatio = maxHp > 0 ? health / maxHp : 1.0;
          visualMesh.scale.y = 0.2 + 0.8 * healthRatio;
          radius = 0.45;
        }
        this.scene.add(group);
        const deploymentObj = {
          id,
          kind,
          gridX,
          gridY,
          root: group,
          radius,
          hp: kind === "barricade" ? 5 : 0,
          maxHp: kind === "barricade" ? 5 : 0,
          cooldown: 0,
          target: null,
          shots: []
        };
        this.deploymentsMap.set(id, deploymentObj);
        if (kind === "barricade") {
          this.registerStaticBlocker(group, radius, true, () => {
            return !deploymentObj.defeated;
          });
        }
      } else {
        const depObj = this.deploymentsMap.get(id);
        const world = this.navigation.gridToWorld(gridX + 0.5, gridY + 0.5);
        const elevation = this.navigation.elevationAt(gridX + 0.5, gridY + 0.5);
        const y = elevation * TERRAIN_ELEVATION_SCALE;
        depObj.root.position.set(world.x, y, world.z);
        depObj.gridX = gridX;
        depObj.gridY = gridY;
        if (kind !== "tower" && depObj.root.children[0]) {
          const visualMesh = depObj.root.children[0];
          const health = dep.hp !== undefined ? dep.hp : 5;
          const maxHp = dep.maxHp !== undefined ? dep.maxHp : 5;
          const healthRatio = maxHp > 0 ? health / maxHp : 1.0;
          visualMesh.scale.y = 0.2 + 0.8 * healthRatio;
        }
      }
    }
    for (const [id, depObj] of this.deploymentsMap.entries()) {
      if (!currentIds.has(id)) {
        depObj.root.removeFromParent();
        depObj.root.traverse((node) => {
          if (node.isMesh) {
            node.geometry?.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((mat) => mat.dispose());
            } else {
              node.material?.dispose();
            }
          }
        });
        this.staticBlockers = this.staticBlockers.filter(
          (blocker) => blocker.root !== depObj.root
        );
        this.deploymentsMap.delete(id);
      }
    }
  }

  updateTowers(dt) {
    const targets = [];
    for (const enemy of this.enemies) {
      if (this.liveEnemy(enemy)) {
        targets.push(enemy);
      }
    }
    if (this.bossExposed && this.boss && !this.boss.defeated) {
      targets.push(this.boss);
    }
    for (const dep of this.deploymentsMap.values()) {
      if (dep.kind !== "tower") continue;
      dep.cooldown = Math.max(0, dep.cooldown - dt);
      const gridX = Math.floor(dep.gridX);
      const gridY = Math.floor(dep.gridY);
      const gimmick = this.getGimmickAt(gridX, gridY);
      const rangeMult = gimmick?.effects?.towerRangeMultiplier ?? 1.0;
      const fortificationBonus = Math.max(0, (this.fortificationLevel || 1) - 1);
      const fortMultRange = 1.0 + 0.1 * fortificationBonus;
      const range = 4.0 * rangeMult * fortMultRange;
      let bestTarget = null;
      let closestDist = range;
      const towerPos = dep.root.position;
      for (const target of targets) {
        const dist = towerPos.distanceTo(target.root.position);
        if (dist <= closestDist) {
          closestDist = dist;
          bestTarget = target;
        }
      }
      if (bestTarget && dep.cooldown <= 0) {
        dep.cooldown = TOWER_FIRE_COOLDOWN;
        const targetGrid = this.navigation.worldToGrid(bestTarget.root.position.x, bestTarget.root.position.z);
        const targetGimmick = this.getGimmickAt(targetGrid.x, targetGrid.y);
        const targetDamageReceivedMult = targetGimmick?.effects?.combatDamageReceivedMultiplier ?? 1.0;
        const fortMultDamage = 1.0 + 0.2 * fortificationBonus;
        const finalDamage = 1 * targetDamageReceivedMult * fortMultDamage;
        bestTarget.hp -= finalDamage;
        bestTarget.hit = (bestTarget.hit ?? 0) + 1;
        this.drawTracer(towerPos, bestTarget.root.position);
        const targetPos = bestTarget.root.position;
        const color = this.presentation?.palette?.ally ?? "#70e5d0";
        this.particles?.emit(targetPos.x, targetPos.y + 0.5, targetPos.z, color, 6, {
          speedMin: 0.8, speedMax: 2.0, life: 0.35, gravity: 1.5, upBias: 0.3
        });
        this.audio.playTone(targetPos.x, targetPos.y + 0.5, targetPos.z, {
          freq: 700, endFreq: 400, duration: 0.15, type: "sine", gain: 0.3
        });
        const targetId = bestTarget === this.boss ? "boss" : bestTarget.id;
        this.frameShots.push({
          towerId: dep.id,
          targetId: targetId,
          x: targetPos.x,
          y: targetPos.z
        });
        if (bestTarget.hp <= 0 || (bestTarget !== this.boss && bestTarget.hit >= 3)) {
          this.defeat(bestTarget);
        }
      }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.clearHover();
    this.clearActionPreview();
    this.destroyed = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.bound.visibility);
    globalThis.window?.removeEventListener("blur", this.bound.blur);
    this.canvas.removeEventListener("webglcontextlost", this.bound.contextLost);
    this.canvas.removeEventListener("keydown", this.bound.keydown);
    this.canvas.removeEventListener("keyup", this.bound.keyup);
    this.canvas.removeEventListener("blur", this.bound.blur);
    this.canvas.removeEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.removeEventListener("pointermove", this.bound.pointermove);
    this.canvas.removeEventListener("pointerup", this.bound.pointerup);
    this.canvas.removeEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.removeEventListener("lostpointercapture", this.bound.lostpointercapture);
    this.canvas.removeEventListener("pointerleave", this.bound.pointerleave);
    this.canvas.removeEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.removeEventListener("wheel", this.bound.wheel);
    if (this.marqueeDiv) {
      this.marqueeDiv.remove();
      this.marqueeDiv = null;
    }
    if (this.placementPreview) {
      this.scene.remove(this.placementPreview);
      this.placementPreview.traverse((node) => {
        if (node.isMesh) {
          node.geometry?.dispose();
          node.material?.dispose();
        }
      });
      this.placementPreview = null;
    }
    if (this.focusHighlightMesh) {
      this.scene.remove(this.focusHighlightMesh);
      this.focusHighlightMesh.geometry?.dispose();
      this.focusHighlightMesh.material?.dispose();
      this.focusHighlightMesh = null;
    }
    if (this.commanderPathLine) {
      this.scene.remove(this.commanderPathLine);
      this.commanderPathLine.geometry?.dispose();
      this.commanderPathLine.material?.dispose();
      this.commanderPathLine = null;
    }
    if (this.commanderDestinationMarker) {
      this.scene.remove(this.commanderDestinationMarker);
      this.commanderDestinationMarker.geometry?.dispose();
      this.commanderDestinationMarker.material?.dispose();
      this.commanderDestinationMarker = null;
    }
    if (this.allyRallyMarker) {
      this.scene.remove(this.allyRallyMarker);
      this.allyRallyMarker.geometry?.dispose();
      this.allyRallyMarker.material?.dispose();
      this.allyRallyMarker = null;
    }
    if (this.actionRangeRing) {
      this.scene.remove(this.actionRangeRing);
      this.actionRangeRing.geometry?.dispose();
      this.actionRangeRing.material?.dispose();
      this.actionRangeRing = null;
    }
    if (this.tracers) {
      for (const tracer of this.tracers) {
        this.scene.remove(tracer.line);
        tracer.line.geometry?.dispose();
        tracer.material?.dispose();
      }
      this.tracers = [];
    }
    if (this.deploymentsMap) {
      for (const dep of this.deploymentsMap.values()) {
        dep.root.removeFromParent();
        dep.root.traverse((node) => {
          if (node.isMesh) {
            node.geometry?.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((mat) => mat.dispose());
            } else {
              node.material?.dispose();
            }
          }
        });
      }
      this.deploymentsMap.clear();
    }
    this.clearEncounterWave();
    for (const ally of this.allies) this.retire(ally);
    this.allies.length = 0;
    this.selection.clear();
    this.allyPickRoots.length = 0;
    this.emitSelectionChange();
    this.retire(this.commander);
    this.retire(this.boss);
    for (const mixer of this.mixers) mixer.stopAllAction();
    this.mixers.length = 0;
    this.staticBlockers.length = 0;
    this.particles?.dispose();
    if (this.keyLight) {
      this.keyLight.shadow?.dispose?.();
      this.keyLight = null;
    }
    this.fillLight = null;
    this.rimLight = null;
    if (this.ringGeometry) {
      disposeUnique(this.ringGeometry, this.disposedResources);
      this.ringGeometry = null;
    }
    if (this.routeLines) {
      for (const line of this.routeLines) {
        disposeObjectResources(line, this.disposedResources);
      }
      this.routeLines = null;
    }
    if (this.deckGeometry) {
      disposeUnique(this.deckGeometry, this.disposedResources);
      this.deckGeometry = null;
    }
    if (this.deckMaterial) {
      disposeMaterialResources(this.deckMaterial, this.disposedResources);
      this.deckMaterial = null;
    }
    if (this.deckMesh) {
      disposeObjectResources(this.deckMesh, this.disposedResources);
      this.deckMesh = null;
    }
    // groundAlbedoTexture/groundNormalTexture are disposed directly (not only
    // via deckMaterial) because they are requested during init() and must not
    // leak if destroy() runs before createBattleObjects() ever assigns them
    // to a material — the same reasoning backgroundTexture uses below.
    if (this.groundAlbedoTexture) {
      disposeUnique(this.groundAlbedoTexture, this.disposedResources);
      this.groundAlbedoTexture = null;
    }
    if (this.groundNormalTexture) {
      disposeUnique(this.groundNormalTexture, this.disposedResources);
      this.groundNormalTexture = null;
    }
    if (this.backgroundTexture) {
      disposeUnique(this.backgroundTexture, this.disposedResources);
      this.backgroundTexture = null;
    }
    if (this.scene) {
      this.scene.background = null;
    }
    this.ambientLight = null;
    if (this.contactGeometry) {
      disposeUnique(this.contactGeometry, this.disposedResources);
      this.contactGeometry = null;
    }
    if (this.contactMaterial) {
      disposeMaterialResources(this.contactMaterial, this.disposedResources);
      this.contactMaterial = null;
    }
    if (this.extractorProp) {
      this.retire(this.extractorProp);
      this.extractorProp = null;
    }
    this.extractor = null;
    if (this.portalProp) {
      this.retire(this.portalProp);
      this.portalProp = null;
    }
    if (this.echoThroneProp) {
      this.retire(this.echoThroneProp);
      this.echoThroneProp = null;
    }
    if (this.nodeProps) {
      for (const obelisk of this.nodeProps) {
        this.retire(obelisk);
      }
      this.nodeProps = null;
    }
    const roots = [
      ...[...this.templates.values()].map((template) => template?.scene),
      this.scene,
      this.terrain,
      this.ground,
      this.portal,
      this.extractor,
      ...this.nodes,
    ].filter(Boolean);
    if (this.node && !this.nodes.includes(this.node)) {
      roots.push(this.node);
    }
    for (const root of roots) disposeObjectResources(root, this.disposedResources);
    this.objectFeedback?.destroy();
    this.objectFeedback = null;
    this.feedbackCache?.clear?.();
    this.renderer?.dispose();
    this.audio?.dispose();
    this.templates.clear();
  }

  resizeBackground() {
    if (!this.backgroundTexture || !this.backgroundTexture.image) return;
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const imageWidth = this.backgroundTexture.image.width;
    const imageHeight = this.backgroundTexture.image.height;
    if (!imageWidth || !imageHeight || !canvasWidth || !canvasHeight) return;

    const canvasAspect = canvasWidth / canvasHeight;
    const imageAspect = imageWidth / imageHeight;

    if (canvasAspect > imageAspect) {
      this.backgroundTexture.repeat.set(1, imageAspect / canvasAspect);
      this.backgroundTexture.offset.set(0, (1 - imageAspect / canvasAspect) / 2);
    } else {
      this.backgroundTexture.repeat.set(canvasAspect / imageAspect, 1);
      this.backgroundTexture.offset.set((1 - canvasAspect / imageAspect) / 2, 0);
    }
  }
}
