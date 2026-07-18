import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import {
  STAGE_GRID_HEIGHT,
  STAGE_GRID_WIDTH,
  STAGE_TACTICAL_ANCHORS,
  createStageNavigation,
} from "./stage-navigation.js";

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
const MOVE_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const SURGE_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const WORLD_GRID_X_OFFSET = STAGE_GRID_WIDTH / 2;
const WORLD_GRID_Z_OFFSET = STAGE_GRID_HEIGHT / 2;
const TERRAIN_ELEVATION_SCALE = 0.42;
const PORTAL_X = STAGE_TACTICAL_ANCHORS.portal.x - WORLD_GRID_X_OFFSET;
const ENEMY_SPAWN_X = STAGE_TACTICAL_ANCHORS.boss.x - WORLD_GRID_X_OFFSET - 0.55;
const ENEMY_ADVANCE_SPEED = 2.4;
const ENEMY_SPAWN_LANES = Object.freeze([3, 4, 5]);
const ATTACK_RANGE = 1.9;
const SHADE_INTERCEPT_RADIUS = 5;
const EPSILON = 0.0001;
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
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
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
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
  }

  async loadSample(name) {
    if (!this.ctx) return null;
    if (this.buffers.has(name)) return this.buffers.get(name);
    const promise = fetch(`${AUDIO_ROOT}${name}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? this.ctx.decodeAudioData(data) : null))
      .catch(() => null);
    this.buffers.set(name, promise);
    return promise;
  }

  updateListener(camera) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const p = camera.position;
    if (listener.positionX) {
      listener.positionX.value = p.x;
      listener.positionY.value = p.y;
      listener.positionZ.value = p.z;
    } else if (listener.setPosition) {
      listener.setPosition(p.x, p.y, p.z);
    }
    const forward = new THREE.Vector3();
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

  makePanner(x, y, z) {
    const panner = this.ctx.createPanner();
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
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
    const buffer = await this.loadSample(name);
    if (!buffer || this.ctx.state === "closed") return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = gain;
    const panner = this.makePanner(x, y, z);
    source.connect(gainNode).connect(panner).connect(this.master);
    source.start();
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
  }

  dispose() {
    if (this.ctx && this.ctx.state !== "closed") this.ctx.close().catch(() => undefined);
  }
}

export class RealtimeBattle {
  constructor(canvas, presentation, options = {}) {
    this.canvas = canvas;
    this.presentation = presentation;
    this.stageNumber = Math.max(1, Math.min(10, Number(presentation?.stageNumber) || 1));
    this.nodeGoal = Math.max(1, Number(options.nodeGoal) || 1);
    this.requestAction = typeof options.onActionRequest === "function" ? options.onActionRequest : null;
    this.onAssetStatus = typeof options.onAssetStatus === "function" ? options.onAssetStatus : null;
    this.onRendererFailure = typeof options.onRendererFailure === "function" ? options.onRendererFailure : null;
    this.onEncounterEvent = typeof options.onEncounterEvent === "function" ? options.onEncounterEvent : null;
    this.onRuntimeState = typeof options.onRuntimeState === "function" ? options.onRuntimeState : null;
    this.onEnemyBreach = null; // Legacy callback; encounter events take precedence.
    this.encounter = null;
    this.encounterSnapshot = null;
    this.currentWaveId = null;
    this.pendingEncounterEvent = null;
    this.bossExposed = false;
    this.lastBossHealth = null;
    this.runtimeSignature = null;
    this.allies = [];
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
    this.running = false;
    this.lastTime = 0;
    this.raf = 0;
    this.hud = null;
    this.navigation = createStageNavigation(this.stageNumber);
    this.staticBlockers = [];
    this.rally = new THREE.Vector3(PORTAL_X + 1.25, 0, STAGE_TACTICAL_ANCHORS.portal.y - WORLD_GRID_Z_OFFSET);
    this.commanderPosition = new THREE.Vector3(PORTAL_X, 0, STAGE_TACTICAL_ANCHORS.portal.y - WORLD_GRID_Z_OFFSET);
    this.commanderOrder = null;
    this.cameraTarget = new THREE.Vector3(-5, 0, 0);
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
    this.orbitAzimuth = -0.9;
    this.orbitElevation = 0.55;
    this.zoom = 18;
    this.enemySerial = 0;
    this.actionClips = 0;
    this.particles = null;
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
      visibility: () => this.onVisibility(),
      clearPressedInput: () => this.clearPressedInput(),
      contextLost: (event) => this.onContextLost(event),
      keydown: (event) => this.onKey(event, true),
      keyup: (event) => this.onKey(event, false),
      pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event),
      pointerup: (event) => this.onPointerUp(event),
      contextmenu: (event) => event.preventDefault(),
      pointercancel: (event) => this.onPointerCancel(event),
      wheel: (event) => this.onWheel(event),
    };
  }

  async init() {
    if (this.destroyed) throw new Error("Realtime battle was destroyed before initialization");
    if (!this.canvas.getContext("webgl2")) {
      throw new Error("WebGL 2 is unavailable");
    }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(this.presentation?.palette?.background ?? "#060913", 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0x91b9d0, 0x090b14, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffe5c2, 2.6);
    keyLight.position.set(7, 12, 8);
    this.scene.add(keyLight);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 22),
      new THREE.MeshStandardMaterial({ color: 0x10182a, transparent: true, opacity: 0.08, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.userData.ground = true;
    this.scene.add(this.ground);
    this.particles = new ParticleField(this.scene);
    this.attachEvents();
    this.resize();
    await this.loadStageAssets();
    if (this.destroyed) throw new Error("WebGL context was lost while loading stage resources");
    this.createBattleObjects();
    if (Number.isInteger(this.authoritativeLegion)) this.reconcileAllies(this.authoritativeLegion);
    this.reconcileEncounterWave();
    this.syncBossExposure();
    this.publishRuntimeState();
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame((time) => this.frame(time));
    return this;
  }

  attachEvents() {
    this.canvas.addEventListener("webglcontextlost", this.bound.contextLost, false);
    this.canvas.addEventListener("keydown", this.bound.keydown);
    this.canvas.addEventListener("keyup", this.bound.keyup);
    this.canvas.addEventListener("blur", this.bound.clearPressedInput);
    this.canvas.addEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.addEventListener("pointermove", this.bound.pointermove);
    this.canvas.addEventListener("pointerup", this.bound.pointerup);
    this.canvas.addEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.addEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.addEventListener("wheel", this.bound.wheel, { passive: false });
    globalThis.window?.addEventListener("blur", this.bound.clearPressedInput);
    document.addEventListener("visibilitychange", this.bound.visibility);
    this.resizeObserver = new ResizeObserver(this.bound.resize);
    this.resizeObserver.observe(this.canvas);
  }

  async loadStageAssets() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const resources = [stage.terrain, "units/shade.glb", "units/scout.glb", stage.boss];
    let loaded = 0;
    this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: 0 });
    for (const resource of resources) {
      const gltf = await this.loadModel(resource);
      if (this.destroyed) throw new Error("Realtime battle was destroyed while loading stage resources");
      this.templates.set(resource, gltf);
      loaded += 1;
      this.actionClips += gltf.animations.length;
      this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: this.actionClips });
    }
    this.onAssetStatus?.({ state: "loaded", loaded, total: resources.length, clips: this.actionClips });
  }

  async loadModel(resource) {
    const url = `${MODEL_ROOT}${resource}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load ${resource}`);
      const data = await response.arrayBuffer();
      const resourceBase = url.slice(0, url.lastIndexOf("/") + 1);
      return await new Promise((resolve, reject) => {
        new GLTFLoader().parse(
          data,
          resourceBase,
          resolve,
          (error) => reject(error instanceof Error ? error : new Error(`Unable to load ${resource}`)),
        );
      });
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

    const portalPosition = this.gridToWorld(STAGE_TACTICAL_ANCHORS.portal.x, STAGE_TACTICAL_ANCHORS.portal.y);
    this.portal = this.makeMarker(0x87e8df, portalPosition.x, portalPosition.z, "materialize");
    this.portal.scale.set(0.7, 1.3, 0.7);
    this.registerStaticBlocker(this.portal, 0.65, false);
    this.scene.add(this.portal);

    const nodePosition = this.gridToWorld(STAGE_TACTICAL_ANCHORS.node.x, STAGE_TACTICAL_ANCHORS.node.y);
    this.node = this.makeMarker(0xffbc69, nodePosition.x, nodePosition.z, "capture");
    this.registerStaticBlocker(this.node, 0.62, false);
    this.scene.add(this.node);

    const boss = this.cloneTemplate(stage.boss, 2.7);
    const bossPosition = this.gridToWorld(STAGE_TACTICAL_ANCHORS.boss.x, STAGE_TACTICAL_ANCHORS.boss.y);
    this.setGroundedPosition(boss, bossPosition.x, bossPosition.z);
    boss.root.userData.pickRoot = boss.root;
    this.applyBossIdentityTint(boss.root);
    this.scene.add(boss.root);
    this.boss = boss;
    this.registerStaticBlocker(boss.root, 1.18, true, () => boss.root.visible);
    this.interactives.push(boss.root);
    this.syncBossExposure();
    this.play(boss, "Idle");

    const commander = this.cloneTemplate("units/shade.glb", 1.25);
    commander.radius = 0.42;
    this.setGroundedPosition(commander, this.commanderPosition.x, this.commanderPosition.z);
    this.commanderPosition.copy(commander.root.position);
    this.scene.add(commander.root);
    this.commander = commander;
    this.play(commander, "Idle");
  }

  // Stages 4-10 reuse a Stage 1-3 boss mesh (see STAGE_ASSETS comment). Tint
  // the reused materials with this stage's own hostile palette color so two
  // narratively distinct bosses never render as visually identical; stages
  // 1-3 keep their authored material untouched.
  applyBossIdentityTint(root) {
    if (this.stageNumber <= 3) return;
    const hex = this.presentation?.palette?.hostile;
    if (!hex) return;
    const tint = new THREE.Color(hex);
    root.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const tinted = materials.map((material) => {
        if (!material) return material;
        const clone = material.clone();
        clone.userData.isBossIdentityTint = true;
        if (clone.color) clone.color.lerp(tint, 0.55);
        if ("emissive" in clone) {
          clone.emissive = tint.clone();
          clone.emissiveIntensity = 0.35;
        }
        return clone;
      });
      node.material = tinted.length === 1 ? tinted[0] : tinted;
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
    this.interactives.push(marker);
    return marker;
  }

  gridToWorld(x, z) {
    return { x: x - WORLD_GRID_X_OFFSET, z: z - WORLD_GRID_Z_OFFSET };
  }

  navigationAt(x, z) {
    const gridX = x + WORLD_GRID_X_OFFSET;
    const gridZ = z + WORLD_GRID_Z_OFFSET;
    const cellX = Math.floor(gridX);
    const cellZ = Math.floor(gridZ);
    const height = this.navigation.heightAt(cellX, cellZ);
    return {
      x: gridX,
      y: gridZ,
      elevation: Math.max(0, height),
      walkable: height >= 0,
    };
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
    const root = template.scene.clone(true);
    this.normalizeGroundCenter(root, targetSize);
    const instance = { root, mixer: new THREE.AnimationMixer(root), clips: template.animations, actions: new Map(), active: null, cooldown: 0 };
    this.mixers.push(instance.mixer);
    return instance;
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
    const elapsed = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    let dt = elapsed;
    if (this.hitStopTime > 0) {
      // Brief near-freeze on heavy impacts (boss hits, breaches): real time
      // still elapses for the countdown, simulated time nearly stalls for
      // a punchy single-frame "hit stop" beat.
      this.hitStopTime = Math.max(0, this.hitStopTime - elapsed);
      dt = elapsed * 0.06;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((nextTime) => this.frame(nextTime));
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
    for (const mixer of this.mixers) mixer.update(dt);
    this.portal.rotation.y += dt * 0.8;
    this.node.rotation.y -= dt * 0.5;
    this.updateMarkerPulses(dt);
    this.updateAmbience(dt);
    this.particles?.update(dt);
    this.audio.updateListener(this.camera);
    this.updateCamera(dt);
    this.publishRuntimeState();
  }

  // Node/portal emissive spikes on capture/hunt/extract, then eases back to
  // its resting glow instead of staying pinned at the flash value forever.
  updateMarkerPulses(dt) {
    this.nodePulse = Math.max(0.8, this.nodePulse - dt * 3.2);
    this.node.material.emissiveIntensity = this.nodePulse;
    this.portalPulse = Math.max(0.8, this.portalPulse - dt * 3.2);
    this.portal.material.emissiveIntensity = this.portalPulse;
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
    if (previous && !this.navigation.climbOk(
      Math.floor(previous.x + WORLD_GRID_X_OFFSET),
      Math.floor(previous.z + WORLD_GRID_Z_OFFSET),
      Math.floor(destination.x),
      Math.floor(destination.y),
    )) return false;
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
      ally.cooldown = 0.55;
      enemy.hp -= 1;
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
    this.play(enemy, "Strike");
    target.hp -= damage;
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
    let x = 0;
    let z = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) z -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) z += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;
    const root = this.commander.root;
    if (x !== 0 || z !== 0) this.commanderOrder = null;
    if (x === 0 && z === 0 && this.commanderOrder) {
      x = this.commanderOrder.x - root.position.x;
      z = this.commanderOrder.z - root.position.z;
      if (Math.hypot(x, z) <= 0.08) {
        this.commanderOrder = null;
        this.play(this.commander, "Idle");
        return;
      }
    }
    if (x === 0 && z === 0) {
      this.play(this.commander, "Idle");
      return;
    }
    const length = Math.hypot(x, z);
    const speed = this.hasSurge() ? 7.2 : 4.1;
    const resolved = this.applyResolvedMovement(
      this.commander,
      root.position.x + (x / length) * speed * dt,
      root.position.z + (z / length) * speed * dt,
    );
    this.commanderPosition.copy(this.commander.root.position);
    this.commander.root.rotation.y = Math.atan2(x, z);
    this.emitFootstepTrail(dt, root.position, this.hasSurge());
    this.play(this.commander, "Move");
    if (resolved.blocked && this.commanderOrder) this.commanderOrder = null;
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
      const angle = index * 2.4;
      const desiredX = intercept?.root.position.x ?? this.rally.x + Math.cos(angle) * 1.25;
      const desiredZ = intercept?.root.position.z ?? this.rally.z + Math.sin(angle) * 1.25;
      const root = ally.root;
      this.applyResolvedMovement(
        ally,
        root.position.x + (desiredX - root.position.x) * Math.min(1, dt * 3),
        root.position.z + (desiredZ - root.position.z) * Math.min(1, dt * 3),
      );
      this.play(ally, "Move");
    }
  }

  updateEnemies(dt) {
    const portalZ = STAGE_TACTICAL_ANCHORS.portal.y - WORLD_GRID_Z_OFFSET;
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      this.direction.set(PORTAL_X - enemy.root.position.x, 0, portalZ - enemy.root.position.z);
      const distance = this.direction.length();
      if (distance > EPSILON) {
        this.direction.multiplyScalar(1 / distance);
        const resolved = this.applyResolvedMovement(
          enemy,
          enemy.root.position.x + this.direction.x * dt * ENEMY_ADVANCE_SPEED,
          enemy.root.position.z + this.direction.z * dt * ENEMY_ADVANCE_SPEED,
        );
        if (resolved.blocked) {
          const detourDistance = Math.min(0.24, dt * ENEMY_ADVANCE_SPEED);
          const preferredDetour = this.applyResolvedMovement(
            enemy,
            enemy.root.position.x - this.direction.z * enemy.detourPreference * detourDistance,
            enemy.root.position.z + this.direction.x * enemy.detourPreference * detourDistance,
          );
          if (preferredDetour.blocked) {
            this.applyResolvedMovement(
              enemy,
              enemy.root.position.x + this.direction.z * enemy.detourPreference * detourDistance,
              enemy.root.position.z - this.direction.x * enemy.detourPreference * detourDistance,
            );
          }
        }
        enemy.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
      }
      this.play(enemy, "Move");
      if (enemy.root.position.x <= PORTAL_X) {
        enemy.breachVisualized = true;
        this.clearEngagement(enemy);
        this.particles?.emit(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, "#ff3b3b", 16, {
          speedMin: 1.5, speedMax: 3.4, life: 0.5, gravity: 3,
        });
        this.audio.playTone(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, {
          freq: 140, endFreq: 60, duration: 0.35, type: "square", gain: 0.75,
        });
        this.shakeCamera(0.14, 0.22);
        this.emitEncounterEvent("breach");
      }
    }

    if (this.currentWaveId && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.defeated)) {
      const p = this.gridToWorld(STAGE_TACTICAL_ANCHORS.node.x, STAGE_TACTICAL_ANCHORS.node.y);
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
  }

  updateCamera(dt = 0) {
    this.cameraTarget.lerp(this.commanderPosition, 0.12);
    const horizontal = Math.cos(this.orbitElevation) * this.zoom;
    this.cameraOffset.set(
      Math.cos(this.orbitAzimuth) * horizontal,
      Math.sin(this.orbitElevation) * this.zoom,
      Math.sin(this.orbitAzimuth) * horizontal,
    );
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    if (this.shakeTime > 0) {
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
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
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

  onPointerDown(event) {
    this.canvas.focus({ preventScroll: true });
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, button: event.button };
    this.canvas.setPointerCapture(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.pointer.moved = true;
    if (!this.pointer.moved) return;
    this.orbitAzimuth -= dx * 0.008;
    this.orbitElevation = clamp(this.orbitElevation - dy * 0.006, 0.2, 1.25);
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  onPointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const pointer = this.pointer;
    this.pointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (pointer.moved) return;
    this.pick(event, pointer.button === 2 ? "allies" : "personal");
  }

  onPointerCancel(event) {
    if (this.pointer?.id === event.pointerId) this.pointer = null;
  }

  onWheel(event) {
    if (document.activeElement !== this.canvas) return;
    event.preventDefault();
    this.zoom = clamp(this.zoom + event.deltaY * 0.012, 9, 30);
  }

  pick(event, rallyKind) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    if (rallyKind === "personal") {
      const hits = this.raycaster.intersectObjects(this.interactives, true);
      if (hits.length) {
        let object = hits[0].object;
        while (object && !object.userData.semantic) object = object.parent;
        const semantic = object?.userData.semantic;
        if (semantic) {
          this.requestAction?.(semantic);
          return;
        }
      }
    }
    const ground = this.raycaster.intersectObject(this.ground, false)[0];
    if (!ground || !this.commander) return;
    const resolved = this.resolveMovement(this.commander, ground.point.x, ground.point.z);
    // A click never teleports the commander or snaps a rally through terrain.
    if (resolved.blocked) return;
    if (rallyKind === "allies") this.rally.set(resolved.x, resolved.y, resolved.z);
    else this.commanderOrder = new THREE.Vector3(resolved.x, resolved.y, resolved.z);
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

  applyCampaignState({ campaign, stage, encounter, state } = {}) {
    const config = encounter?.config ?? stage?.encounter ?? null;
    const encounterState = encounter?.state ?? state?.encounter ?? state ?? campaign?.stage?.encounter ?? encounter ?? null;
    const stageId = encounter?.stageId ?? stage?.id ?? campaign?.stageId ?? null;
    const legion = Number(state?.legion ?? campaign?.stage?.legion);
    if (Number.isInteger(legion) && legion >= 0) {
      this.authoritativeLegion = legion;
      this.reconcileAllies(legion);
    }
    const bossHealth = Number(state?.bossHealth ?? campaign?.stage?.bossHealth);
    if (Number.isFinite(bossHealth)) {
      if (bossHealth === 0 && this.lastBossHealth > 0) this.defeat(this.boss);
      this.lastBossHealth = bossHealth;
    }
    this.applyEncounter({ stageId, config, state: encounterState });
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
        if (material?.userData?.isBossIdentityTint) disposeUnique(material, disposed);
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

  createAlly() {
    const ally = this.cloneTemplate("units/shade.glb", 1.15);
    ally.radius = 0.4;
    ally.hp = 3;
    ally.defeated = false;
    const formation = this.allies.length % 3 - 1;
    if (!this.resolveSpawn(ally, this.commanderPosition.x - 0.3, this.commanderPosition.z + formation * 1.1)) {
      this.retire(ally);
      return;
    }
    this.scene.add(ally.root);
    this.allies.push(ally);
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
      } else {
        survivors.push(ally);
      }
    }
    this.allies = survivors;
    while (this.allies.length > target) {
      const ally = this.allies.pop();
      this.clearEngagement(ally);
      this.retire(ally);
    }
    while (this.allies.length < target) {
      const before = this.allies.length;
      this.createAlly();
      if (this.allies.length === before) break;
    }
  }

  spawnEncounterWave(wave) {
    const count = Math.max(0, Number(wave?.hostiles) || 0);
    for (let index = 0; index < count; index += 1) {
      const enemy = this.cloneTemplate("units/scout.glb", 1.2);
      enemy.radius = 0.42;
      const lane = ENEMY_SPAWN_LANES[this.enemySerial % ENEMY_SPAWN_LANES.length];
      enemy.detourPreference = this.enemySerial % 2 === 0 ? 1 : -1;
      const spawned = this.resolveSpawn(
        enemy,
        ENEMY_SPAWN_X - (this.enemySerial % 2) * 0.85,
        lane - WORLD_GRID_Z_OFFSET,
      );
      enemy.root.rotation.y = -Math.PI / 2;
      this.enemySerial += 1;
      if (!spawned) {
        this.retire(enemy);
        continue;
      }
      enemy.hp = Math.max(1, Number(wave.hostileHealth) || 2);
      enemy.archetype = wave.id;
      
      enemy.defeated = false;
      enemy.breachVisualized = false;
      this.scene.add(enemy.root);
      this.enemies.push(enemy);
      this.play(enemy, "Move");
    }
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

  getRuntimeState() {
    const total = this.encounter?.config?.waves?.length ?? 0;
    const resolved = this.encounter?.state?.waves?.filter((wave) => wave?.cleared === true).length ?? 0;
    return {
      mode: "realtime-3d",
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
      const position = this.gridToWorld(6, 3.5);
      return { x: position.x, y: this.navigationAt(position.x, position.z).elevation * TERRAIN_ELEVATION_SCALE, z: position.z };
    }
    if (point === "node") return this.node?.position ?? this.commanderPosition;
    if (point === "ally") return this.allies.find((candidate) => this.liveAlly(candidate))?.root?.position ?? this.commanderPosition;
    if (point === "boss") return this.boss?.root?.position ?? this.commanderPosition;
    return this.commander?.root?.position ?? this.commanderPosition;
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
  }

  triggerAction(semantic) {
    this.playActionEffect(semantic);
  }

  setHud(hud) {
    this.hud = hud;
  }

  onVisibility() {
    if (document.hidden) {
      this.clearPressedInput();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.running && !this.raf) {
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame((time) => this.frame(time));
    }
  }

  onContextLost(event) {
    event.preventDefault();
    this.destroy();
    this.onAssetStatus?.({ state: "unavailable" });
    this.onRendererFailure?.();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.bound.visibility);
    globalThis.window?.removeEventListener("blur", this.bound.clearPressedInput);
    this.canvas.removeEventListener("webglcontextlost", this.bound.contextLost);
    this.canvas.removeEventListener("keydown", this.bound.keydown);
    this.canvas.removeEventListener("keyup", this.bound.keyup);
    this.canvas.removeEventListener("blur", this.bound.clearPressedInput);
    this.canvas.removeEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.removeEventListener("pointermove", this.bound.pointermove);
    this.canvas.removeEventListener("pointerup", this.bound.pointerup);
    this.canvas.removeEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.removeEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.removeEventListener("wheel", this.bound.wheel);
    this.clearEncounterWave();
    for (const ally of this.allies) this.retire(ally);
    this.allies.length = 0;
    this.retire(this.commander);
    this.retire(this.boss);
    for (const mixer of this.mixers) mixer.stopAllAction();
    this.mixers.length = 0;
    this.staticBlockers.length = 0;
    this.particles?.dispose();
    const roots = [
      ...[...this.templates.values()].map((template) => template?.scene),
      this.scene,
      this.terrain,
      this.ground,
      this.portal,
      this.node,
    ];
    for (const root of roots) disposeObjectResources(root, this.disposedResources);
    this.renderer?.dispose();
    this.audio?.dispose();
    this.templates.clear();
  }
}
