import assert from "node:assert/strict";
import test from "node:test";

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
