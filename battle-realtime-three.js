import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";

const STAGE_ASSETS = Object.freeze({
  1: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/cinder-warden.glb" }),
  2: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/veil-tactician.glb" }),
  3: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/gate-sovereign.glb" }),
});
const MODEL_ROOT = "./assets/models/abyssal-command/";
const MOVE_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const SURGE_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const PORTAL_X = -10;
const ENEMY_SPAWN_X = 10;
const ENEMY_ADVANCE_SPEED = 2.4;
const ATTACK_RANGE = 1.9;
const EPSILON = 0.0001;

function clipFor(clips, name) {
  const needle = name.toLowerCase();
  return clips.find((clip) => clip.name.toLowerCase() === needle || clip.name.toLowerCase().endsWith(`__${needle}`)) ?? null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class RealtimeBattle {
  constructor(canvas, presentation, options = {}) {
    this.canvas = canvas;
    this.presentation = presentation;
    this.stageNumber = Math.max(1, Math.min(3, Number(presentation?.stageNumber) || 1));
    this.nodeGoal = Math.max(1, Number(options.nodeGoal) || 1);
    this.requestAction = typeof options.onActionRequest === "function" ? options.onActionRequest : null;
    this.onAssetStatus = typeof options.onAssetStatus === "function" ? options.onAssetStatus : null;
    this.onRendererFailure = typeof options.onRendererFailure === "function" ? options.onRendererFailure : null;
    this.onEnemyBreach = null;
    this.allies = [];
    this.enemies = [];
    this.templates = new Map();
    this.mixers = [];
    this.interactives = [];
    this.pressed = new Set();
    this.destroyed = false;
    this.running = false;
    this.lastTime = 0;
    this.raf = 0;
    this.hud = null;
    this.rally = new THREE.Vector3(-4, 0, 0);
    this.commanderPosition = new THREE.Vector3(-6, 0, 0);
    this.cameraTarget = new THREE.Vector3(-5, 0, 0);
    this.cameraOffset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.groundPoint = new THREE.Vector3();
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
    this.bound = {
      resize: () => this.resize(),
      visibility: () => this.onVisibility(),
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
    this.attachEvents();
    this.resize();
    await this.loadStageAssets();
    if (this.destroyed) throw new Error("WebGL context was lost while loading stage resources");
    this.createBattleObjects();
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame((time) => this.frame(time));
    return this;
  }

  attachEvents() {
    this.canvas.addEventListener("webglcontextlost", this.bound.contextLost, false);
    this.canvas.addEventListener("keydown", this.bound.keydown);
    this.canvas.addEventListener("keyup", this.bound.keyup);
    this.canvas.addEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.addEventListener("pointermove", this.bound.pointermove);
    this.canvas.addEventListener("pointerup", this.bound.pointerup);
    this.canvas.addEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.addEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.addEventListener("wheel", this.bound.wheel, { passive: false });
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

  loadModel(resource) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        `${MODEL_ROOT}${resource}`,
        resolve,
        undefined,
        (error) => reject(error instanceof Error ? error : new Error(`Unable to load ${resource}`)),
      );
    });
  }

  createBattleObjects() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const terrain = this.cloneTemplate(stage.terrain, 22);
    terrain.root.position.y -= 0.03;
    this.scene.add(terrain.root);
    this.terrain = terrain.root;

    this.portal = this.makeMarker(0x87e8df, PORTAL_X, 0, "materialize");
    this.portal.scale.set(0.7, 1.3, 0.7);
    this.scene.add(this.portal);
    this.node = this.makeMarker(0xffbc69, -0.5, 0, "capture");
    this.scene.add(this.node);

    const boss = this.cloneTemplate(stage.boss, 2.7);
    boss.root.position.set(8.4, 0, 0);
    boss.root.userData.semantic = "assault";
    boss.root.userData.pickRoot = boss.root;
    this.scene.add(boss.root);
    this.boss = boss;
    this.interactives.push(boss.root);
    this.play(boss, "Idle");

    const commander = this.cloneTemplate("units/shade.glb", 1.25);
    commander.root.position.copy(this.commanderPosition);
    this.scene.add(commander.root);
    this.commander = commander;
    this.play(commander, "Idle");
  }

  makeMarker(color, x, z, semantic) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.75, 0.16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.55 }),
    );
    marker.position.set(x, 0.08, z);
    marker.userData.semantic = semantic;
    marker.userData.pickRoot = marker;
    this.interactives.push(marker);
    return marker;
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
    this.update(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  update(dt) {
    this.moveCommander(dt);
    this.updateAllies(dt);
    this.updateEnemies(dt);
    for (const mixer of this.mixers) mixer.update(dt);
    this.portal.rotation.y += dt * 0.8;
    this.node.rotation.y -= dt * 0.5;
    this.updateCamera();
  }

  moveCommander(dt) {
    let x = 0;
    let z = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) z -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) z += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;
    if (x === 0 && z === 0) {
      this.play(this.commander, "Idle");
      return;
    }
    const length = Math.hypot(x, z);
    const speed = this.hasSurge() ? 7.2 : 4.1;
    this.commanderPosition.x = clamp(this.commanderPosition.x + (x / length) * speed * dt, PORTAL_X + 0.7, 9);
    this.commanderPosition.z = clamp(this.commanderPosition.z + (z / length) * speed * dt, -8, 8);
    this.commander.root.position.copy(this.commanderPosition);
    this.commander.root.rotation.y = Math.atan2(x, z);
    this.play(this.commander, "Move");
  }

  updateAllies(dt) {
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index];
      const angle = index * 2.4;
      const desiredX = this.rally.x + Math.cos(angle) * 1.25;
      const desiredZ = this.rally.z + Math.sin(angle) * 1.25;
      const root = ally.root;
      root.position.x += (desiredX - root.position.x) * Math.min(1, dt * 3);
      root.position.z += (desiredZ - root.position.z) * Math.min(1, dt * 3);
      const enemy = this.nearestEnemy(root.position, 3.2);
      if (enemy) this.strike(ally, enemy, dt);
      else this.play(ally, "Move");
    }
  }

  updateEnemies(dt) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      const target = (enemy.swings ?? 0) < 2 ? this.nearestDefender(enemy.root.position, ATTACK_RANGE) : null;
      if (target) {
        this.play(enemy, "Attack");
        enemy.cooldown = Math.max(0, enemy.cooldown - dt);
        if (enemy.cooldown === 0) {
          enemy.cooldown = 1.15;
          enemy.swings = (enemy.swings ?? 0) + 1;
          target.hit = (target.hit ?? 0) + 1;
          if (target !== this.commander && target.hit >= 3) this.removeAlly(target);
        }
        continue;
      }
      this.direction.set(PORTAL_X - enemy.root.position.x, 0, -enemy.root.position.z);
      const distance = this.direction.length();
      if (distance > EPSILON) {
        this.direction.multiplyScalar(1 / distance);
        enemy.root.position.addScaledVector(this.direction, dt * ENEMY_ADVANCE_SPEED);
        enemy.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
      }
      this.play(enemy, "Move");
      if (enemy.root.position.x <= PORTAL_X && !enemy.breached) {
        enemy.breached = true;
        this.removeEnemy(enemy);
        this.onEnemyBreach?.();
      }
    }
  }

  strike(ally, enemy, dt) {
    ally.cooldown = Math.max(0, ally.cooldown - dt);
    this.play(ally, "Strike");
    if (ally.cooldown !== 0) return;
    ally.cooldown = 0.55;
    enemy.hp -= 1;
    if (enemy.hp <= 0) this.removeEnemy(enemy);
  }

  nearestEnemy(position, range) {
    let nearest = null;
    let closest = range * range;
    for (const enemy of this.enemies) {
      const dx = enemy.root.position.x - position.x;
      const dz = enemy.root.position.z - position.z;
      const distance = dx * dx + dz * dz;
      if (distance < closest) {
        closest = distance;
        nearest = enemy;
      }
    }
    return nearest;
  }

  nearestDefender(position, range) {
    let nearest = this.commander;
    let closest = range * range;
    const commanderDx = this.commander.root.position.x - position.x;
    const commanderDz = this.commander.root.position.z - position.z;
    const commanderDistance = commanderDx * commanderDx + commanderDz * commanderDz;
    if (commanderDistance > closest) nearest = null;
    else closest = commanderDistance;
    for (const ally of this.allies) {
      const dx = ally.root.position.x - position.x;
      const dz = ally.root.position.z - position.z;
      const distance = dx * dx + dz * dz;
      if (distance < closest) {
        closest = distance;
        nearest = ally;
      }
    }
    return nearest;
  }

  removeEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) this.enemies.splice(index, 1);
    enemy.root.removeFromParent();
  }

  removeAlly(ally) {
    const index = this.allies.indexOf(ally);
    if (index !== -1) this.allies.splice(index, 1);
    ally.root.removeFromParent();
  }

  updateCamera() {
    this.cameraTarget.lerp(this.commanderPosition, 0.12);
    const horizontal = Math.cos(this.orbitElevation) * this.zoom;
    this.cameraOffset.set(
      Math.cos(this.orbitAzimuth) * horizontal,
      Math.sin(this.orbitElevation) * this.zoom,
      Math.sin(this.orbitAzimuth) * horizontal,
    );
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
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
    if (!ground) return;
    this.groundPoint.copy(ground.point);
    this.groundPoint.x = clamp(this.groundPoint.x, PORTAL_X + 0.5, 10);
    this.groundPoint.z = clamp(this.groundPoint.z, -8, 8);
    if (rallyKind === "allies") this.rally.copy(this.groundPoint);
    else this.commanderPosition.copy(this.groundPoint);
  }

  spawnEnemy(count) {
    if (!this.running) return;
    for (let index = 0; index < count; index += 1) {
      const enemy = this.cloneTemplate("units/scout.glb", 1.2);
      enemy.root.position.set(ENEMY_SPAWN_X + (this.enemySerial % 2) * 0.8, 0, ((this.enemySerial % 5) - 2) * 1.25);
      enemy.root.rotation.y = -Math.PI / 2;
      this.enemySerial += 1;
      enemy.hp = 2;
      enemy.swings = 0;
      enemy.breached = false;
      this.scene.add(enemy.root);
      this.enemies.push(enemy);
      this.play(enemy, "Move");
    }
  }

  triggerMaterialize(count) {
    if (!this.running) return;
    const additions = Math.max(0, Number(count) || 0);
    for (let index = 0; index < additions; index += 1) {
      const ally = this.cloneTemplate("units/shade.glb", 1.15);
      ally.root.position.copy(this.commanderPosition);
      ally.root.position.z += (this.allies.length % 3 - 1) * 0.6;
      this.scene.add(ally.root);
      this.allies.push(ally);
      this.play(ally, "Special", true);
    }
  }

  triggerAction(semantic) {
    const action = semantic?.action;
    if (!action) return;
    if (action === "materialize") {
      this.triggerMaterialize(semantic.count);
      return;
    }
    if (action === "assault") {
      this.play(this.commander, "Strike", true);
      for (const enemy of [...this.enemies]) this.removeEnemy(enemy);
      this.play(this.boss, "Attack", true);
      return;
    }
    if (action === "capture") {
      this.node.material.emissiveIntensity = 2;
      return;
    }
    if (action === "possess" || action === "domain") this.rally.copy(this.commanderPosition);
    this.play(this.commander, semantic.clip ?? "Special", true);
  }

  setHud(hud) {
    this.hud = hud;
  }

  onVisibility() {
    if (document.hidden) {
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
    this.canvas.removeEventListener("webglcontextlost", this.bound.contextLost);
    this.canvas.removeEventListener("keydown", this.bound.keydown);
    this.canvas.removeEventListener("keyup", this.bound.keyup);
    this.canvas.removeEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.removeEventListener("pointermove", this.bound.pointermove);
    this.canvas.removeEventListener("pointerup", this.bound.pointerup);
    this.canvas.removeEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.removeEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.removeEventListener("wheel", this.bound.wheel);
    for (const mixer of this.mixers) mixer.stopAllAction();
    this.renderer?.dispose();
    this.templates.clear();
    this.enemies.length = 0;
    this.allies.length = 0;
  }
}
