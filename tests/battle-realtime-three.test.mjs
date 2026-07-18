import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { RealtimeBattle } from "../battle-realtime-three.js";

function makeRoot(x = 0, z = 0) {
  return {
    removed: false,
    position: {
      x,
      y: 0,
      z,
      set(nextX, nextY, nextZ) {
        this.x = nextX;
        this.y = nextY;
        this.z = nextZ;
        return this;
      },
    },
    userData: {},
    removeFromParent() {
      this.removed = true;
    },
  };
}

function makeUnit({ x = 0, z = 0, hp = 2, hit = 0 } = {}) {
  return { root: makeRoot(x, z), hp, hit, cooldown: 0, defeated: false };
}

function makeRetirableMixer() {
  return {
    stopped: 0,
    uncachedRoots: [],
    stopAllAction() {
      this.stopped += 1;
    },
    uncacheRoot(root) {
      this.uncachedRoots.push(root);
    },
    uncacheAction() {},
  };
}
async function initializeRendererPresentation() {
  const source = await readFile(new URL("../battle-realtime-three.js", import.meta.url), "utf8");
  const definition = source.match(/  async init\(\) \{[\s\S]*?\n  \}(?=\n\n  attachEvents\(\))/);
  assert.ok(definition, "renderer module must expose its initialization behavior");

  class Vector3 {
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }
  class WebGLRenderer {
    constructor(options) {
      this.options = options;
      this.shadowMap = {};
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    setClearColor(color, alpha) { this.clearColor = { color, alpha }; }
  }
  class Scene {
    constructor() { this.children = []; }
    add(...children) { this.children.push(...children); }
  }
  class FogExp2 {
    constructor(color, density) {
      this.color = color;
      this.density = density;
    }
  }
  class PerspectiveCamera {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class HemisphereLight {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class DirectionalLight {
    constructor(...parameters) {
      this.parameters = parameters;
      this.position = new Vector3();
      this.shadow = { mapSize: {}, camera: {} };
    }
  }
  class PlaneGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class MeshStandardMaterial {
    constructor(parameters) { this.parameters = parameters; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.rotation = {};
      this.userData = {};
    }
  }
  class RingGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class ParticleField {}

  const THREE = {
    ACESFilmicToneMapping: Symbol("ACESFilmicToneMapping"),
    PCFSoftShadowMap: Symbol("PCFSoftShadowMap"),
    SRGBColorSpace: Symbol("SRGBColorSpace"),
    WebGLRenderer,
    Scene,
    FogExp2,
    PerspectiveCamera,
    HemisphereLight,
    DirectionalLight,
    PlaneGeometry,
    MeshStandardMaterial,
    Mesh,
    RingGeometry,
  };
  const context = vm.createContext({
    THREE,
    ParticleField,
    FILL_LIGHT_INTENSITY: 0.65,
    FOG_DENSITY: 0.015,
    RIM_LIGHT_INTENSITY: 0.85,
    SHADOW_BIAS: -0.0008,
    SHADOW_CAMERA_FAR: 40,
    SHADOW_CAMERA_NEAR: 0.5,
    SHADOW_CAMERA_SIZE: 18,
    SHADOW_MAP_SIZE: 1024,
    TONE_MAPPING_EXPOSURE: 1.05,
    Number,
    performance: { now: () => 100 },
    requestAnimationFrame: () => 1,
    window: { devicePixelRatio: 2 },
  });
  const executable = definition[0].replace(/^  async init\(\)/, "async function init()");
  vm.runInContext(`${executable}\nglobalThis.initialize = init;`, context, { filename: "battle-realtime-three.js" });

  const battle = {
    canvas: { getContext: (kind) => (kind === "webgl2" ? {} : null) },
    presentation: {
      palette: { accent: "#f0a040", ally: "#70e5d0", background: "#101827" },
    },
    destroyed: false,
    authoritativeLegion: null,
    attachEvents() {},
    resize() {},
    async loadStageAssets() {},
    createBattleObjects() {},
    reconcileEncounterWave() {},
    syncBossExposure() {},
    publishRuntimeState() {},
    frame() {},
  };
  await context.initialize.call(battle);
  return { battle, THREE, types: { FogExp2, RingGeometry } };
}

test("RealtimeBattle initialization applies atmospheric rendering and configured tactical markers", async () => {
  const { battle, THREE, types } = await initializeRendererPresentation();

  assert.equal(battle.renderer.toneMapping, THREE.ACESFilmicToneMapping, "realtime rendering must use ACES filmic tone mapping");
  assert.deepEqual(
    { enabled: battle.renderer.shadowMap.enabled, type: battle.renderer.shadowMap.type },
    { enabled: true, type: THREE.PCFSoftShadowMap },
    "realtime rendering must enable PCF soft shadows",
  );
  assert.equal(battle.scene.fog instanceof types.FogExp2, true, "realtime rendering must use exponential atmospheric fog");
  assert.equal(battle.scene.fog.color, "#101827", "fog must use the active stage background palette");
  assert.equal(battle.ground.receiveShadow, true, "the tactical ground must receive unit and marker shadows");

  const shadowCamera = battle.keyLight.shadow.camera;
  assert.ok(shadowCamera.near > 0 && shadowCamera.far > shadowCamera.near, "shadow camera must define a positive near/far depth range");
  assert.equal(shadowCamera.left, -shadowCamera.right, "shadow camera must cover equal left and right tactical extents");
  assert.equal(shadowCamera.bottom, -shadowCamera.top, "shadow camera must cover equal top and bottom tactical extents");
  assert.ok(
    battle.keyLight.shadow.mapSize.width > 0
      && battle.keyLight.shadow.mapSize.width === battle.keyLight.shadow.mapSize.height,
    "directional shadows must use a nonzero square map",
  );
  assert.equal(battle.ringGeometry instanceof types.RingGeometry, true, "tactical markers must use ring geometry");
  assert.deepEqual(
    battle.ringGeometry.parameters,
    [0.8, 1.1, 16],
    "marker rings must retain a visible annulus with enough segments to read as circular",
  );
});


test("RealtimeBattle safely ignores playback requests from clip-less runtime bindings", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  assert.doesNotThrow(
    () => battle.play({}),
    "a runtime binding that has not exposed animation clips must not break the command feedback path",
  );
});

test("RealtimeBattle clears held keyboard movement on canvas, window, and hidden-document focus loss without cancelling click-to-move", () => {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const listeners = (target) => ({
    addEventListener(type, handler) {
      target.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (target.get(type) === handler) target.delete(type);
    },
  });
  const canvas = listeners(canvasListeners);
  const document = { ...listeners(documentListeners), activeElement: canvas, hidden: false };
  const window = listeners(windowListeners);
  const descriptors = new Map(
    ["document", "window", "ResizeObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.assign(globalThis, {
    document,
    window,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  const commanderOrder = { x: 4, y: 0, z: -2 };
  const pressMovement = () => {
    document.activeElement = canvas;
    canvasListeners.get("keydown")({ code: "KeyW", preventDefault() {} });
    assert.deepEqual([...battle.pressed], ["KeyW"], "the movement key must be held before focus is lost");
  };
  const assertClearedWithoutCancellingOrder = (source, loseFocus) => {
    battle.commanderOrder = commanderOrder;
    pressMovement();
    loseFocus();
    assert.deepEqual([...battle.pressed], [], `${source} focus loss must clear held keyboard movement`);
    assert.strictEqual(
      battle.commanderOrder,
      commanderOrder,
      `${source} focus loss must preserve the active click-to-move commander order`,
    );
  };

  try {
    battle.attachEvents();
    assert.equal(typeof canvasListeners.get("blur"), "function", "the canvas must clear input when it loses focus");
    assert.equal(typeof windowListeners.get("blur"), "function", "the browser window must clear input when it loses focus");

    assertClearedWithoutCancellingOrder("canvas", () => {
      document.activeElement = null;
      canvasListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("window", () => {
      document.activeElement = null;
      windowListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("hidden document", () => {
      document.hidden = true;
      documentListeners.get("visibilitychange")();
      document.hidden = false;
    });
  } finally {
    battle.destroy();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});




test("RealtimeBattle uses the unit Strike vocabulary for scout attacks", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const scout = makeUnit({ x: 2 });
  const target = makeUnit();
  const played = [];
  battle.play = (unit, clip, once) => played.push({ unit, clip, once });

  battle.enemyStrike(scout, target, 2);

  assert.equal(
    played.find(({ unit }) => unit === scout)?.clip,
    "Strike",
    "a scout uses the unit's exported Strike clip rather than a boss-only Attack clip",
  );
});

test("RealtimeBattle starts one-shot Defeat playback once when non-commander actors become defeated", () => {
  const enemyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const enemyCommander = makeUnit();
  const ally = makeUnit();
  const enemy = makeUnit({ hp: 1 });
  const enemyPlays = [];
  enemyBattle.commander = enemyCommander;
  enemyBattle.allies = [ally];
  enemyBattle.enemies = [enemy];
  enemyBattle.engagements.set(ally, enemy);
  enemyBattle.engagements.set(enemy, ally);
  enemyBattle.play = (unit, clip, once) => enemyPlays.push({ unit, clip, once });

  enemyBattle.updateEngagements(1);
  enemyBattle.updateEngagements(1);

  const allyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const allyCommander = makeUnit();
  const scout = makeUnit({ x: 2 });
  const defeatedAlly = makeUnit({ hit: 2 });
  const allyPlays = [];
  allyBattle.commander = allyCommander;
  allyBattle.allies = [defeatedAlly];
  allyBattle.enemies = [scout];
  allyBattle.engagements.set(defeatedAlly, scout);
  allyBattle.engagements.set(scout, defeatedAlly);
  allyBattle.play = (unit, clip, once) => allyPlays.push({ unit, clip, once });

  allyBattle.updateEngagements(2);
  allyBattle.updateEngagements(2);

  assert.equal(enemy.defeated, true, "lethal allied damage marks the enemy defeated");
  assert.equal(defeatedAlly.defeated, true, "the third scout hit marks a non-commander ally defeated");
  assert.deepEqual(
    enemyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: enemy, clip: "Defeat", once: true }],
    "a defeated enemy must start one finite Defeat clip and never restart it on later updates",
  );
  assert.deepEqual(
    allyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: defeatedAlly, clip: "Defeat", once: true }],
    "a defeated non-commander ally must start one finite Defeat clip and never restart it on later updates",
  );
});

test("RealtimeBattle keeps Defeat on a lethally assaulted exposed boss while live exposed bosses still Attack", () => {
  const lethalBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const lethalBoss = makeUnit({ hp: 16 });
  const lethalPlays = [];
  lethalBattle.boss = lethalBoss;
  lethalBattle.play = (unit, clip, once) => lethalPlays.push({ unit, clip, once });

  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 16, bossExposed: true } });
  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 0, bossExposed: true } });
  lethalBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.equal(lethalBoss.defeated, true, "the final assault's campaign sync must defeat the boss");
  assert.deepEqual(
    lethalPlays,
    [{ unit: lethalBoss, clip: "Defeat", once: true }],
    "a lethal exposed-boss assault must leave the boss's one-shot Defeat playback intact",
  );

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveBoss = makeUnit({ hp: 16 });
  const livePlays = [];
  liveBattle.boss = liveBoss;
  liveBattle.bossExposed = true;
  liveBattle.play = (unit, clip, once) => livePlays.push({ unit, clip, once });

  liveBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.deepEqual(
    livePlays,
    [{ unit: liveBoss, clip: "Attack", once: true }],
    "a nonlethal exposed-boss assault must retain its boss Attack playback",
  );
});

test("RealtimeBattle clears a wave once every enemy is defeated or breach-retired while live enemies block completion", () => {
  const makeWaveBattle = () => {
    const events = [];
    const battle = new RealtimeBattle(
      null,
      { stageNumber: 1 },
      { onEncounterEvent: (event) => events.push(event) },
    );
    battle.currentWaveId = "scout";
    battle.encounter = {
      stageId: "cinder-span",
      state: { activeWaveId: "scout" },
    };
    return { battle, events };
  };

  const resolvedWave = makeWaveBattle();
  const defeated = makeUnit();
  const breached = makeUnit();
  defeated.defeated = true;
  breached.breachVisualized = true;
  resolvedWave.battle.enemies = [defeated, breached];

  resolvedWave.battle.updateEnemies(0);
  resolvedWave.battle.updateEnemies(0);

  assert.deepEqual(
    resolvedWave.events,
    [{ type: "wave-cleared", stageId: "cinder-span", waveId: "scout" }],
    "a mixed defeated-and-breached wave must clear once without repeating while its resolution is pending",
  );

  const blockedWave = makeWaveBattle();
  const live = makeUnit();
  live.breachVisualized = false;
  blockedWave.battle.enemies = [defeated, breached, live];
  blockedWave.battle.engagements.set(live, defeated);

  blockedWave.battle.updateEnemies(0);

  assert.deepEqual(
    blockedWave.events,
    [],
    "one live unresolved enemy must block wave completion even when every peer is defeated or breached",
  );
});


test("RealtimeBattle retires enemy animation mixers when an encounter wave is cleared", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const enemy = { root: makeRoot(), mixer };
  battle.enemies = [enemy];
  battle.mixers = [mixer];

  battle.clearEncounterWave();

  assert.equal(enemy.root.removed, true, "cleared enemy root must leave the scene");
  assert.equal(mixer.stopped, 1, "cleared enemy mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [enemy.root], "cleared enemy mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "cleared enemy mixer must not remain in the per-frame update list");
});

test("RealtimeBattle retires removed ally animation mixers during authoritative reconciliation", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const ally = { root: makeRoot(), mixer, defeated: false };
  battle.scene = {};
  battle.templates.set("units/shade.glb", {});
  battle.allies = [ally];
  battle.mixers = [mixer];

  battle.reconcileAllies(0);

  assert.equal(ally.root.removed, true, "ally removed by authoritative count must leave the scene");
  assert.equal(mixer.stopped, 1, "removed ally mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [ally.root], "removed ally mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "removed ally mixer must not remain in the per-frame update list");
});

test("RealtimeBattle exposes the shared 16×8 terrain walkability and elevation for 3D navigation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const echoThrone = new RealtimeBattle(null, { stageNumber: 3 });

  const bridgeVoid = cinderSpan.navigationAt(-3, -3);
  assert.equal(bridgeVoid.x, 5, "Stage 1 navigation must map the bridge void to the shared grid column");
  assert.equal(bridgeVoid.y, 1, "Stage 1 navigation must map the bridge void to the shared grid row");
  assert.equal(
    bridgeVoid.walkable,
    false,
    "the Stage 1 bridge void must be unwalkable to 3D navigation just as it is on the 2D heightfield",
  );
  assert.deepEqual(
    veilCitadel.navigationAt(-3, -2),
    { x: 5, y: 2, elevation: 1, walkable: true },
    "the Stage 2 raised citadel must report the shared heightfield elevation",
  );
  assert.deepEqual(
    echoThrone.navigationAt(5, -2),
    { x: 13, y: 2, elevation: 2, walkable: true },
    "the Stage 3 throne ascent must report the shared two-level elevation",
  );
});

test("RealtimeBattle movement resolution rejects shared chasms and adopts shared terrain elevation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const bridgeUnit = makeUnit({ x: -4, z: -3 });
  const citadelUnit = makeUnit({ x: -4, z: -2 });

  assert.deepEqual(
    cinderSpan.resolveMovement(bridgeUnit, -3, -3),
    { x: -4, y: 0, z: -3, blocked: true },
    "a 3D unit must stop at its prior legal position rather than enter the Stage 1 bridge void",
  );
  assert.deepEqual(
    veilCitadel.resolveMovement(citadelUnit, -3, -2),
    { x: -3, y: 0.42, z: -2, blocked: false },
    "a legal 3D move onto the Stage 2 plateau must take the same elevation as the 2D heightfield",
  );
});

test("RealtimeBattle ignores rally clicks that land on the shared Stage 1 chasm", () => {
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.commander = makeUnit({ x: -4, z: -3 });
  battle.camera = {};
  battle.ground = {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => [],
    intersectObject: () => [{ point: { x: -3, y: 0, z: -3 } }],
  };
  const priorRally = battle.rally.clone();
  const resolveMovement = battle.resolveMovement.bind(battle);
  const resolutionCalls = [];
  battle.resolveMovement = (...args) => {
    resolutionCalls.push(args);
    return resolveMovement(...args);
  };

  battle.pick({ clientX: 50, clientY: 50 }, "allies");
  assert.equal(resolutionCalls.length, 1, "rally click must validate its target through movement resolution");
  assert.equal(resolutionCalls[0][0], battle.commander, "rally resolution must start from the commander position");
  assert.deepEqual(resolutionCalls[0].slice(1), [-3, -3], "rally resolution must receive the clicked chasm coordinates");

  assert.deepEqual(
    battle.rally.toArray(),
    priorRally.toArray(),
    "rally input on the Stage 1 void must preserve the last legal rally point instead of ordering allies into the chasm",
  );
});

test("RealtimeBattle movement resolution stops before static and live colliders", () => {
  const staticBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const staticMover = makeUnit({ x: -3, z: -0.5 });
  staticMover.radius = 0.42;
  staticBattle.commander = staticMover;
  staticBattle.staticBlockers = [{
    root: makeRoot(-0.5, -0.5),
    radius: 0.62,
    blocksMovement: true,
    active: () => true,
  }];

  const staticResult = staticBattle.resolveMovement(staticMover, 0, -0.5);

  assert.equal(staticResult.blocked, true, "the command node collider must block a commander before overlap");
  assert.ok(
    staticResult.x >= -1.56 && staticResult.x < -1.53,
    `the command node collider must stop at the combined-radius contact point (got x=${staticResult.x})`,
  );
  assert.equal(staticResult.z, -0.5, "static collision resolution must not introduce lateral drift");

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveMover = makeUnit({ x: -3, z: -0.5 });
  const liveBlocker = makeUnit({ x: -1, z: -0.5 });
  liveMover.radius = 0.42;
  liveBlocker.radius = 0.42;
  liveBattle.commander = liveMover;
  liveBattle.allies = [liveBlocker];

  const liveResult = liveBattle.resolveMovement(liveMover, 0, -0.5);

  assert.equal(liveResult.blocked, true, "a live ally must block a commander before overlap");
  assert.ok(
    liveResult.x >= -1.92 && liveResult.x < -1.8,
    `a live ally must stop at the first sampled position before combined-radius overlap (got x=${liveResult.x})`,
  );
  assert.equal(liveResult.z, -0.5, "live collision resolution must not introduce lateral drift");
});

test("RealtimeBattle emits bounded directional feedback for every supported action without mutating authoritative combat state", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  const commander = makeUnit({ x: 1, z: 2 });
  const boss = makeUnit({ x: -2, z: 3 });
  const ally = makeUnit({ x: 4, z: -1 });
  const enemy = makeUnit({ x: -4, z: 1 });
  const portal = makeRoot(8, -2);
  const node = makeRoot(-5, 4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const toneCalls = [];
  const shakeCalls = [];
  commander.root.position.y = 0.4;
  boss.root.position.y = 1;
  ally.root.position.y = 0.2;
  portal.position.y = 0.6;
  node.position.y = 0.8;
  battle.commander = commander;
  battle.boss = boss;
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.node = { position: node.position, material: { emissiveIntensity: 0 } };
  battle.encounter = campaign;
  battle.authoritativeLegion = 2;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = {
    playSample: (...args) => sampleCalls.push(args),
    playTone: (...args) => toneCalls.push(args),
  };
  battle.shakeCamera = (...args) => shakeCalls.push(args);
  const hitStopCalls = [];
  battle.triggerHitStop = (duration) => hitStopCalls.push(duration);


  const extractor = { x: -2, y: 0, z: -0.5 };
  const semantics = [
    { action: "hunt", source: "portal", target: "extractor" },
    { action: "extract", source: "extractor", target: "portal" },
    { action: "materialize", source: "portal", target: "portal" },
    { action: "capture", source: "portal", target: "node" },
    { action: "possess", source: "portal", target: "ally" },
    { action: "domain", source: "portal", target: "portal" },
    { action: "assault", source: "ally", target: "boss" },
  ];
  const feedback = semantics.map((semantic) => battle.emitActionFeedback(semantic));

  assert.deepEqual(
    battle.actionFeedbackPoint("extractor"),
    extractor,
    "extract feedback must use the 2D-parity extractor grid coordinate rather than the portal",
  );
  assert.deepEqual(
    feedback,
    [
      { action: "hunt", source: portal.position, target: extractor },
      { action: "extract", source: extractor, target: portal.position },
      { action: "materialize", source: portal.position, target: portal.position },
      { action: "capture", source: portal.position, target: node.position },
      { action: "possess", source: portal.position, target: ally.root.position },
      { action: "domain", source: portal.position, target: portal.position },
      { action: "assault", source: ally.root.position, target: boss.root.position },
    ],
    "each player action must preserve its semantic source and tactical target",
  );
  assert.deepEqual(
    particleCalls.map(([x, y, z, color, count]) => [x, Number(y.toFixed(2)), z, color, count]),
    [
      [8, 1.32, -2, "#accent", 5], [-2, 0.72, -0.5, "#accent", 12],
      [-2, 0.72, -0.5, "#ally", 5], [8, 1.32, -2, "#ally", 14],
      [8, 1.32, -2, "#ally", 8], [8, 1.32, -2, "#ally", 12],
      [8, 1.32, -2, "#accent", 7], [-5, 1.52, 4, "#accent", 18],
      [8, 1.32, -2, "#accent", 6], [4, 0.92, -1, "#accent", 16],
      [8, 1.32, -2, "#accent", 10], [8, 1.32, -2, "#accent", 14],
      [4, 0.92, -1, "#hostile", 11], [-2, 1.72, 3, "#hostile", 28],
    ],
    "each action must emit bounded source and target particle bursts in its semantic direction",
  );
  assert.deepEqual(
    sampleCalls.map(([action, x, y, z, gain]) => [action, x, Number(y.toFixed(2)), z, gain]),
    [
      ["hunt", 8, 1.32, -2, 0.52],
      ["extract", -2, 0.72, -0.5, 0.58],
      ["materialize", 8, 1.32, -2, 0.7],
      ["capture", 8, 1.32, -2, 0.66],
      ["possess", 8, 1.32, -2, 0.62],
      ["domain", 8, 1.32, -2, 0.74],
      ["assault", 4, 0.92, -1, 0.78],
    ],
    "every feedback path must request its authored sample at the semantic source",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => [x, Number(y.toFixed(2)), z, Number(options.gain.toFixed(3))]),
    [
      [-2, 0.72, -0.5, 0.208],
      [8, 1.32, -2, 0.232],
      [-5, 1.52, 4, 0.264],
      [4, 0.92, -1, 0.248],
      [-2, 1.72, 3, 0.312],
    ],
    "distinct endpoints must add a directionally aligned target tone",
  );
  assert.ok(
    particleCalls.every(([, , , , count]) => count <= 28),
    "action feedback particles must stay within the bounded maximum burst size",
  );
  assert.equal(battle.portalPulse, 2.15, "portal-origin actions must leave a non-animated portal marker pulse");
  assert.equal(battle.nodePulse, 2.15, "capture must leave a non-animated command-node marker pulse");
  assert.deepEqual(shakeCalls, [[0.12, 0.18]], "only assault feedback may request camera shake");
  assert.deepEqual(
    hitStopCalls,
    [0.06],
    "assault feedback must request one bounded 0.06-second hit stop without extending command authority",
  );
  assert.equal(battle.encounter, campaign, "feedback must leave authoritative encounter configuration and state untouched");
  assert.equal(battle.authoritativeLegion, 2, "feedback must not change the campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "feedback must not create or remove allied encounter units");
  assert.deepEqual(battle.enemies, [enemy], "feedback must not create or remove enemy encounter units");
  assert.equal(ally.root.removed, false, "feedback must not retire existing allies");
  assert.equal(enemy.root.removed, false, "feedback must not retire existing enemies");
});

test("RealtimeBattle resolves every verified action actor to the commander with supported clips", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = makeUnit();
  const ally = makeUnit({ x: 2 });
  const boss = makeUnit({ x: -2 });
  const played = [];
  battle.commander = commander;
  battle.allies = [ally];
  battle.boss = boss;
  battle.portal = makeRoot(4, 1);
  battle.node = { position: makeRoot(-4, 1).position, material: { emissiveIntensity: 0 } };
  battle.bossExposed = false;
  battle.particles = null;
  battle.audio = { playSample() {}, playTone() {} };
  battle.play = (actor, clip, once) => played.push({ actor, clip, once });

  const semantics = [
    { action: "hunt", source: "portal", target: "extractor", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "extract", source: "extractor", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "materialize", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "capture", source: "portal", target: "node", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "possess", source: "portal", target: "ally", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "domain", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "assault", source: "ally", target: "boss", actor: "commander", actorClip: "Strike", clip: "Strike" },
  ];
  for (const semantic of semantics) battle.triggerAction(semantic);

  assert.deepEqual(
    played,
    semantics.map(({ actorClip }) => ({ actor: commander, clip: actorClip, once: true })),
    "all verified actions must route one-shot playback through the commander using actorClip rather than a source-atlas clip",
  );
  assert.ok(
    played.every(({ clip }) => clip === "Special" || clip === "Strike"),
    "commander playback must use only the model-proven Special or Strike clip vocabulary",
  );
});

test("RealtimeBattle materialize feedback stays renderer-local on the public action path", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const ally = makeUnit();
  const enemy = makeUnit({ x: 3 });
  const portal = makeRoot(6, -4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const createCalls = [];
  const reconcileCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.encounter = campaign;
  battle.authoritativeLegion = null;
  battle.running = true;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playSample: (...args) => sampleCalls.push(args) };
  battle.createAlly = (...args) => createCalls.push(args);
  battle.reconcileAllies = (...args) => reconcileCalls.push(args);
  battle.play = () => {};

  battle.triggerAction({ action: "materialize", source: "portal", target: "portal", count: 3 });

  assert.equal(particleCalls.length, 2, "materialize must emit bounded source and target renderer-local bursts");
  assert.deepEqual(sampleCalls, [["materialize", 6, 0.72, -4, 0.7]], "materialize must request its authored audio cue");
  assert.deepEqual(createCalls, [], "materialize feedback must not create units, even while the battle is running");
  assert.deepEqual(reconcileCalls, [], "materialize feedback must not reconcile units outside applyCampaignState");
  assert.equal(battle.encounter, campaign, "materialize feedback must not mutate encounter state");
  assert.equal(battle.authoritativeLegion, null, "materialize feedback must not mutate campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "materialize feedback must not create or remove allies");
  assert.deepEqual(battle.enemies, [enemy], "materialize feedback must not create or remove enemies");
});

test("RealtimeBattle makes a melee exchange legible through midpoint and target-directed feedback", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { accent: "#gold", hostile: "#red" },
  });
  const ally = makeUnit({ x: -1, z: 2 });
  const enemy = makeUnit({ x: 3, z: -2 });
  const particleCalls = [];
  const toneCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.engagements.set(ally, enemy);
  battle.engagements.set(enemy, ally);
  battle.play = () => {};
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playTone: (...args) => toneCalls.push(args) };

  battle.updateEngagements(1);

  assert.deepEqual(
    particleCalls,
    [
      [1, 0.9, 0, "#gold", 6, { speedMin: 1.2, speedMax: 2.8, life: 0.28, gravity: 4, upBias: 0.4 }],
      [ally.root.position.x, 0.8, ally.root.position.z, "#red", 8, { speedMin: 1.4, speedMax: 3.2, life: 0.32, gravity: 5 }],
    ],
    "each exchange must show a shared clash at the contact midpoint and a hostile impact on the struck ally",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => ({ x, y, z, options })),
    [
      { x: 1, y: 0.9, z: 0, options: { freq: 900, endFreq: 320, duration: 0.09, type: "triangle", gain: 0.35 } },
      { x: -1, y: 0.8, z: 2, options: { freq: 220, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.45 } },
    ],
    "each visual combat direction must have an aligned spatial sound cue",
  );
  assert.equal(ally.hit, 1, "the target receives exactly one combat hit for the exchange");
  assert.equal(enemy.hp, 1, "the attacker resolves exactly one combat hit against its paired enemy");
  assert.deepEqual(battle.allies, [ally], "combat feedback must not create or remove allied units");
  assert.deepEqual(battle.enemies, [enemy], "combat feedback must not create or remove enemy units");
});

test("RealtimeBattle preserves stages 4–10 and loads each stage's declared terrain and boss resources", async () => {
  const expectedStageResources = new Map([
    [4, ["terrain/veil-citadel.glb", "bosses/cinder-warden.glb"]],
    [5, ["terrain/cinder-span.glb", "bosses/veil-tactician.glb"]],
    [6, ["terrain/veil-citadel.glb", "bosses/veil-tactician.glb"]],
    [7, ["terrain/cinder-span.glb", "bosses/gate-sovereign.glb"]],
    [8, ["terrain/echo-throne-steps.glb", "bosses/cinder-warden.glb"]],
    [9, ["terrain/veil-citadel.glb", "bosses/gate-sovereign.glb"]],
    [10, ["terrain/echo-throne-steps.glb", "bosses/gate-sovereign.glb"]],
  ]);
  const stageNavigationMarkers = new Map([
    [4, { x: 0, y: 0, elevation: -1 }],
    [5, { x: 4, y: 2, elevation: -1 }],
    [6, { x: 5, y: 1, elevation: 1 }],
    [7, { x: 3, y: 3, elevation: -1 }],
    [8, { x: 5, y: 2, elevation: -1 }],
    [9, { x: 4, y: 1, elevation: 1 }],
    [10, { x: 8, y: 2, elevation: 1 }],
  ]);

  for (const [stageNumber, [terrain, boss]] of expectedStageResources) {
    const battle = new RealtimeBattle(null, { stageNumber });
    const loaded = [];
    battle.loadModel = async (resource) => {
      loaded.push(resource);
      return { animations: [] };
    };

    await battle.loadStageAssets();

    assert.equal(battle.stageNumber, stageNumber, `Stage ${stageNumber} must not be clamped to Stage 3.`);
    assert.equal(
      battle.navigation.cells[stageNavigationMarkers.get(stageNumber).y][stageNavigationMarkers.get(stageNumber).x],
      stageNavigationMarkers.get(stageNumber).elevation,
      `Stage ${stageNumber} must retain its own tactical navigation rather than using Stage 3's terrain.`,
    );
    assert.deepEqual(
      loaded,
      [terrain, "units/shade.glb", "units/scout.glb", boss],
      `Stage ${stageNumber} must request its declared terrain and boss resources.`,
    );
  }
});

test("ParticleField recycles the fixed-capacity pool instead of growing unbounded", async () => {
  const { ParticleField } = await import("../battle-realtime-three.js");
  const added = [];
  const scene = { add: (object) => added.push(object) };
  const field = new ParticleField(scene);

  assert.equal(field.capacity, 360, "particle pool capacity must match the documented budget");
  assert.equal(added.length, 1, "constructing a ParticleField must add exactly one Points object to the scene");

  field.emit(0, 0, 0, "#ffffff", 400, {});
  const aliveCount = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveCount, 360, "emitting more particles than capacity must recycle oldest slots, never exceed capacity");
  assert.equal(field.cursor, 40, "cursor must wrap modulo capacity after overflowing (400 % 360 = 40)");

  field.update(10);
  const aliveAfterLongDt = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveAfterLongDt, 0, "a long enough dt must expire every particle back to the dead pool");

  field.dispose();
});

test("SpatialAudio constructs safely with a null AudioContext outside a browser environment", async () => {
  const { SpatialAudio } = await import("../battle-realtime-three.js");
  const audio = new SpatialAudio();

  assert.equal(audio.ctx, null, "non-browser SpatialAudio must not construct a real AudioContext");
  assert.equal(audio.master, null, "non-browser SpatialAudio must not construct a master gain node");
  assert.doesNotThrow(() => audio.playTone(0, 0, 0, { freq: 440 }), "playTone must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.playSample("hunt", 0, 0, 0, 1), "playSample must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.updateListener({ position: { x: 0, y: 0, z: 0 } }), "updateListener must tolerate a null AudioContext");
});

test("RealtimeBattle triggers boss defeat feedback exactly once when applyCampaignState reports bossHealth reaching zero", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;
  const defeatCalls = [];
  const originalDefeat = battle.defeat.bind(battle);
  battle.defeat = (unit) => {
    defeatCalls.push(unit);
    return originalDefeat(unit);
  };

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  assert.deepEqual(defeatCalls, [], "the first sync at full boss health must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 3 } });
  assert.deepEqual(defeatCalls, [], "a partial-damage sync must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "bossHealth transitioning to zero must call defeat(this.boss) exactly once");
  assert.equal(boss.defeated, true, "the boss instance itself must be marked defeated");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "a repeated zero-health sync must not re-trigger defeat (defeat() is itself idempotent via unit.defeated)");
});

test("RealtimeBattle applyCampaignState does not defeat the boss on a fresh stage entry at full health after a prior defeat", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.equal(boss.defeated, true, "boss must be defeated once its health reaches zero");

  const nextBoss = makeUnit({ x: -1, z: 2 });
  battle.boss = nextBoss;
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 12 } });
  assert.equal(nextBoss.defeated, false, "a fresh boss instance on stage retry/advance must not start pre-defeated");
});

test("RealtimeBattle shakeCamera lets a weaker overlapping pulse decay smoothly instead of spiking the envelope", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  battle.shakeCamera(0.35, 0.5);
  assert.equal(battle.shakeMagnitude, 0.35);
  assert.equal(battle.shakeDuration, 0.5);

  // Simulate 0.45s of decay (0.05s of the 0.5s duration remaining): residual strength = 0.35 * 0.05/0.5 = 0.035.
  battle.shakeTime = 0.05;
  const strengthBeforeWeakerPulse = battle.shakeMagnitude * (battle.shakeDuration > 0 ? battle.shakeTime / battle.shakeDuration : 0);
  assert.ok(Math.abs(strengthBeforeWeakerPulse - 0.035) < 1e-9, "sanity: the shake must have decayed to the expected residual strength");

  // A pulse weaker than the current residual strength (e.g. a footstep-dust-scale event) must not spike the envelope back up.
  battle.shakeCamera(0.02, 0.22);
  assert.equal(battle.shakeMagnitude, 0.35, "a pulse weaker than the still-decaying residual strength must not overwrite the peak magnitude");
  assert.equal(battle.shakeDuration, 0.5, "a weaker pulse must not reset the decay envelope's duration denominator");
  assert.equal(battle.shakeTime, 0.05, "a weaker pulse must not extend the remaining shake time");

  // A pulse stronger than the current residual strength (but weaker than the original peak) correctly takes over as the new envelope.
  battle.shakeCamera(0.14, 0.22);
  assert.equal(battle.shakeMagnitude, 0.14, "a pulse stronger than the current residual strength must take over as the new envelope, even if weaker than the original peak");
  assert.equal(battle.shakeDuration, 0.22);
  assert.equal(battle.shakeTime, 0.22);

  battle.shakeCamera(0.5, 0.3);
  assert.equal(battle.shakeMagnitude, 0.5, "a pulse stronger than the current envelope must take over");
  assert.equal(battle.shakeDuration, 0.3);
  assert.equal(battle.shakeTime, 0.3);
});

test("RealtimeBattle restores rally-to-commander grouping on possess and domain actions", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  battle.commanderPosition.set(4, 0, -2);
  battle.play = () => {};

  battle.playActionEffect({ action: "possess", source: "portal", target: "ally", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "possess must rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "domain", source: "portal", target: "portal", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "domain must also rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "hunt", source: "portal", target: "extractor", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 99, y: 0, z: 99 },
    "actions other than possess/domain must not touch the rally point",
  );
});

test("RealtimeBattle retire() disposes boss-identity-tint material clones without touching template-shared materials", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  let disposedCount = 0;
  const tintedMaterial = { userData: { isBossIdentityTint: true }, dispose: () => { disposedCount += 1; } };
  const sharedMaterial = { userData: {}, dispose: () => { disposedCount += 1; } };
  const boss = {
    root: {
      traverse(visit) {
        visit({ isMesh: true, material: tintedMaterial });
        visit({ isMesh: true, material: sharedMaterial });
        visit({ isMesh: false, material: sharedMaterial });
      },
      removeFromParent() {},
    },
    mixer: null,
  };

  battle.retire(boss);
  assert.equal(disposedCount, 1, "retire() must dispose exactly the boss-identity-tint clone, not the template-shared material");
});

test("RealtimeBattle destroy disposes shared WebGL resources once and remains idempotent", (t) => {
  const priorDocument = globalThis.document;
  globalThis.document = { removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });

  const disposals = { geometry: 0, material: 0, texture: 0, ring: 0, shadow: 0, renderer: 0, particles: 0, audio: 0 };
  const texture = { isTexture: true, dispose: () => { disposals.texture += 1; } };
  const material = { map: texture, dispose: () => { disposals.material += 1; } };
  const geometry = { dispose: () => { disposals.geometry += 1; } };
  const ringGeometry = { dispose: () => { disposals.ring += 1; } };
  const sharedMesh = { isMesh: true, geometry, material };
  const canvas = { removeEventListener() {} };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.scene = {
    traverse(visit) {
      visit(sharedMesh);
      visit({ isMesh: true, geometry, material });
    },
  };
  battle.templates.set("units/shade.glb", {
    scene: {
      traverse(visit) {
        visit({ isMesh: true, geometry, material });
      },
    },
  });
  battle.renderer = { dispose: () => { disposals.renderer += 1; } };
  battle.particles = { dispose: () => { disposals.particles += 1; } };
  battle.audio = { dispose: () => { disposals.audio += 1; } };
  battle.ringGeometry = ringGeometry;
  battle.keyLight = { shadow: { dispose: () => { disposals.shadow += 1; } } };

  battle.destroy();
  battle.destroy();

  assert.deepEqual(
    disposals,
    { geometry: 1, material: 1, texture: 1, ring: 1, shadow: 1, renderer: 1, particles: 1, audio: 1 },
    "destroy must release each shared GPU resource once even when the scene exposes it through multiple meshes and destroy is repeated",
  );
});
