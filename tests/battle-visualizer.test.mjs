import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";

function makeVisualizer(t, {
  reducedMotion = false,
  setTimeout,
  clearTimeout,
  canvas = {},
  options = {},
  presentation,
} = {}) {
  const priorWindow = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: reducedMotion }),
    ...(setTimeout ? { setTimeout } : {}),
    ...(clearTimeout ? { clearTimeout } : {}),
  };
  t.after(() => {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  });

  const visualizer = new BattleVisualizer(canvas, presentation, options);
  visualizer.renderStatic = () => {};
  visualizer.publishRuntimeState = () => {};
  visualizer.hasBridgeAtlas = () => false;
  return visualizer;
}

function makePointerCanvas() {
  const listeners = new Map();
  const focusCalls = [];
  return {
    style: {},
    focusCalls,
    listeners,
    focus(options) {
      focusCalls.push(options);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1600, height: 900 };
    },
    setPointerCapture() {},
    dispatch(type, { x = 0, y = 0, ...event } = {}) {
      listeners.get(type)?.({
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x,
        clientY: y,
        ...event,
      });
    },
  };
}

function clickCanvasTarget(canvas, point) {
  canvas.dispatch("pointerdown", point);
  canvas.dispatch("pointerup", point);
}

test("BattleVisualizer fallback canvas prioritizes available semantic targets over selected move orders and rejects unavailable bosses", (t) => {
  const canvas = makePointerCanvas();
  const requestedActions = [];
  let availableActions = ["materialize", "capture", "assault"];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      nodeGoal: 1,
      onActionRequest: (action) => requestedActions.push(action),
      getAvailableActions: () => availableActions,
    },
  });
  const moveOrders = [];
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.walkable = () => true;
  visualizer.unprojectToTile = () => ({ x: 2, y: 2 });
  visualizer.issueMoveOrder = (tile) => moveOrders.push(tile);
  visualizer.selection.add({ x: 1, y: 1 });
  visualizer.attachPointerHandlers();

  const screenPoint = (point) => visualizer.project(point.x, point.y);
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("portal")));
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("node")));

  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "clicking available portal and node targets must dispatch their supplied campaign action callback",
  );
  assert.deepEqual(
    moveOrders,
    [],
    "an available semantic target must consume the click before a selected ally can receive a movement order",
  );

  visualizer.selection.clear();
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "a hidden boss target must not dispatch Assault even when that action is otherwise available",
  );

  visualizer.bossExposed = true;
  availableActions = ["materialize", "capture"];
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "an exposed boss must still reject Assault while the supplied available-action contract withholds it",
  );

  availableActions = ["materialize", "capture", "assault"];
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture", "assault"],
    "an exposed boss must dispatch Assault only after the supplied available-action contract admits it",
  );
});

test("BattleVisualizer keeps portal pointer focus and activation on the same highest-priority available action", (t) => {
  const canvas = makePointerCanvas();
  const focusedActions = [];
  const requestedActions = [];
  let availableActions = ["materialize", "domain"];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => availableActions,
      onActionFocus: (action) => focusedActions.push(action),
      onActionRequest: (action) => requestedActions.push(action),
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");
  const target = visualizer.project(portal.x, portal.y);

  canvas.dispatch("pointermove", target);
  clickCanvasTarget(canvas, target);

  availableActions = ["domain"];
  canvas.dispatch("pointermove", target);
  clickCanvasTarget(canvas, target);

  assert.deepEqual(
    focusedActions,
    ["materialize", "domain"],
    "portal focus must prefer Materialize while both commands are available and expose Domain only after Materialize is unavailable",
  );
  assert.deepEqual(
    requestedActions,
    ["materialize", "domain"],
    "pointerup activation must resolve the same portal action previously projected through pointer focus",
  );
});

test("BattleVisualizer focuses the fallback canvas before reporting pointerdown spatial focus", (t) => {
  const canvas = makePointerCanvas();
  const reportedFocus = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => ["materialize"],
      onActionFocus: (action) => {
        reportedFocus.push({ action, focusCallCount: canvas.focusCalls.length });
      },
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");

  canvas.dispatch("pointerdown", {
    ...visualizer.project(portal.x, portal.y),
    pointerType: "touch",
  });

  assert.deepEqual(
    canvas.focusCalls,
    [{ preventScroll: true }],
    "pointerdown must move keyboard ownership to the fallback canvas without scrolling the command UI",
  );
  assert.deepEqual(
    reportedFocus,
    [{ action: "materialize", focusCallCount: 1 }],
    "the canvas must already be focused before pointer/touch spatial focus is projected to the DOM",
  );
});

test("BattleVisualizer projects pointer focus and clears it on hover exit, cancellation, and canvas blur", (t) => {
  const runFocusSequence = (exit) => {
    const canvas = makePointerCanvas();
    const focusedActions = [];
    const visualizer = makeVisualizer(t, {
      canvas,
      options: {
        getAvailableActions: () => ["materialize"],
        onActionFocus: (action) => focusedActions.push(action),
      },
    });
    visualizer.view.scale = 100;
    visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
    visualizer.elevationAt = () => 0;
    visualizer.attachPointerHandlers();
    const portal = visualizer.actionPoint("portal");
    const target = visualizer.project(portal.x, portal.y);

    if (exit === "pointercancel") {
      canvas.dispatch("pointerdown", target);
    } else {
      canvas.dispatch("pointermove", target);
    }
    canvas.dispatch(exit, exit === "pointercancel" ? { pointerId: 1 } : {});
    return focusedActions;
  };

  const canvas = makePointerCanvas();
  const passiveFocus = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => ["materialize"],
      onActionFocus: (action) => passiveFocus.push(action),
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");
  canvas.dispatch("pointermove", visualizer.project(portal.x, portal.y));
  canvas.dispatch("pointermove", { x: 1500, y: 850 });

  assert.deepEqual(
    {
      passiveHover: passiveFocus,
      pointerleave: runFocusSequence("pointerleave"),
      pointercancel: runFocusSequence("pointercancel"),
      blur: runFocusSequence("blur"),
    },
    {
      passiveHover: ["materialize", null],
      pointerleave: ["materialize", null],
      pointercancel: ["materialize", null],
      blur: ["materialize", null],
    },
    "every canvas focus exit must clear the command/dossier projection after exposing the matching available action",
  );
});

test("BattleVisualizer placement validation preserves the active deployment kind", (t) => {
  const visualizer = makeVisualizer(t);
  const receivedKinds = [];
  visualizer.navigation = {
    validateDeployment(_x, _y, _deployments, kind) {
      receivedKinds.push(kind);
      return { valid: kind === "tower" };
    },
  };

  visualizer.placementMode = "tower";
  assert.equal(visualizer.isPlacementLegal({ x: 8, y: 2 }), true, "tower preview must use tower route-blocking semantics");
  visualizer.placementMode = "barricade";
  assert.equal(visualizer.isPlacementLegal({ x: 8, y: 2 }), false, "barricade preview must use barricade route-blocking semantics");
  assert.deepEqual(receivedKinds, ["tower", "barricade"], "each preview must pass its current kind to the shared validator");
});

test("BattleVisualizer touch orders follow the shared Stage 1 route around void", (t) => {
  const canvas = makePointerCanvas();
  const tacticalRequests = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: { onTacticalRequest: (request) => tacticalRequests.push(request) },
  });
  const startCell = {
    x: Math.floor(visualizer.navigation.anchors.alliedSpawn.x),
    y: Math.floor(visualizer.navigation.anchors.alliedSpawn.y),
  };
  const targetCell = { x: 12, y: 2 };
  const authoredPath = visualizer.findPath(startCell, targetCell);
  const directCrossesVoid = Array.from({ length: 101 }, (_, step) => {
    const progress = step / 100;
    const x = startCell.x + 0.5 + (targetCell.x - startCell.x) * progress;
    const y = startCell.y + 0.5 + (targetCell.y - startCell.y) * progress;
    return !visualizer.navigation.walkable(x, y);
  }).some(Boolean);
  assert.ok(authoredPath && authoredPath.length > 2, "the Stage 1 fixture must expose a nontrivial shared route");
  assert.equal(directCrossesVoid, true, "the Stage 1 fixture's direct start-to-target segment must cross void");

  const ally = {
    x: visualizer.navigation.anchors.alliedSpawn.x,
    y: visualizer.navigation.anchors.alliedSpawn.y,
    defeated: false,
  };
  visualizer.allies = [ally];
  visualizer.selection.add(ally);
  visualizer.detectActionAt = () => null;
  visualizer.requestTacticalActionAt = () => false;
  visualizer.unprojectToTile = () => targetCell;
  visualizer.playSpatial = () => {};
  visualizer.attachPointerHandlers();

  canvas.dispatch("pointerdown", { pointerType: "touch" });
  canvas.dispatch("pointerup", { pointerType: "touch" });

  assert.deepEqual(tacticalRequests, [], "selected-unit movement must remain renderer-local");

  const visitedCells = new Set();
  let reachedTarget = false;
  for (let step = 0; step < 1200; step += 1) {
    visualizer.updateUnits(1 / 30);
    visitedCells.add(`${Math.floor(ally.x)},${Math.floor(ally.y)}`);
    if (Math.hypot(ally.x - (targetCell.x + 0.5), ally.y - (targetCell.y + 0.5)) <= Math.sqrt(0.05)) {
      reachedTarget = true;
      break;
    }
  }

  assert.equal(reachedTarget, true, "the selected ally must reach the authored target instead of stopping at the void");
  assert.ok(visitedCells.size > 2, "the accepted order must traverse a nontrivial multi-cell route");
});

test("BattleVisualizer focus projection updates its minimap snapshot without callback recursion", (t) => {
  const tacticalRequests = [];
  const visualizer = makeVisualizer(t, {
    options: { onTacticalRequest: (request) => tacticalRequests.push(request) },
  });
  visualizer.computeView = () => {};
  visualizer.buildStaticLayer = () => {};
  visualizer.unprojectToTile = () => ({ x: 12, y: 5 });

  visualizer.focusTacticalCell({ x: 8, y: 5 });

  assert.deepEqual(visualizer.getTacticalSnapshot().focus, { x: 8, y: 5 }, "external minimap focus must be visible in the next renderer snapshot");
  assert.deepEqual(tacticalRequests, [], "applying external focus must not re-enter the tactical request callback");
});

test("BattleVisualizer destroy removes every pointer and visibility listener it registered", (t) => {
  const canvas = makePointerCanvas();
  const documentListeners = new Map();
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener(type, listener) {
        documentListeners.set(type, listener);
      },
      removeEventListener(type, listener) {
        if (documentListeners.get(type) === listener) documentListeners.delete(type);
      },
    },
  });
  t.after(() => {
    if (priorDocument) Object.defineProperty(globalThis, "document", priorDocument);
    else delete globalThis.document;
  });
  const visualizer = makeVisualizer(t, { canvas });
  visualizer.attachPointerHandlers();
  assert.equal(canvas.listeners.size, 8, "the pointer seam must register its complete interaction listener set");
  assert.equal(documentListeners.has("visibilitychange"), true, "the renderer must observe document visibility while alive");

  visualizer.destroy();

  assert.equal(canvas.listeners.size, 0, "destroy must remove every canvas listener registered by the pointer seam");
  assert.equal(documentListeners.size, 0, "destroy must remove its document visibility listener");
});

test("BattleVisualizer previewAction and clearActionPreview expose a controlled DOM preview seam", (t) => {
  const visualizer = makeVisualizer(t);
  const semantic = Object.freeze({ action: "hunt", source: "portal", target: "extractor", actor: "commander", clip: "Special" });
  let renders = 0;
  visualizer.renderStatic = () => {
    renders += 1;
  };

  visualizer.previewAction(semantic);
  assert.strictEqual(visualizer.actionPreview, semantic, "DOM hover or keyboard focus must project the exact action-enriched semantic supplied by the app bridge");
  assert.equal(renders, 1, "starting a DOM preview must redraw the fallback battlefield");

  visualizer.clearActionPreview();
  assert.equal(visualizer.actionPreview, null, "DOM pointerout or blur must clear the projected renderer preview");
  assert.equal(renders, 2, "clearing a DOM preview must redraw the fallback battlefield");
});

test("BattleVisualizer action feedback remains presentation-only while preserving semantic source-to-target gestures", (t) => {
  const visualizer = makeVisualizer(t);
  const ally = { x: 3, y: 2, isPossessed: false };
  const enemy = { x: 11, y: 5, archetype: "scout" };
  const nodes = [{ x: 5, y: 4 }];
  const encounter = Object.freeze({ config: Object.freeze({ waves: [] }), state: Object.freeze({ activeWaveId: null }) });
  const spatialCalls = [];
  const reconcileCalls = [];
  const spawnAllyCalls = [];
  const spawnEnemyCalls = [];
  visualizer.allies = [ally];
  visualizer.enemies = [enemy];
  visualizer.nodes = nodes;
  visualizer.encounter = encounter;
  visualizer.authoritativeLegion = 1;
  visualizer.bossExposed = false;
  visualizer.reconcileAllies = (...args) => reconcileCalls.push(args);
  visualizer.spawnAlly = (...args) => spawnAllyCalls.push(args);
  visualizer.spawnEnemy = (...args) => spawnEnemyCalls.push(args);
  visualizer.playSpatial = (...args) => spatialCalls.push(args);

  const portal = visualizer.actionPoint("portal");
  const extractor = visualizer.actionPoint("extractor");
  visualizer.triggerAction({
    action: "materialize",
    source: "portal",
    target: "portal",
    sourceAsset: "rift-portal",
    clip: "Activate",
  });
  visualizer.triggerAction({
    action: "extract",
    source: "extractor",
    target: "portal",
    sourceAsset: "soul-extractor",
    clip: "Activate",
  });

  assert.deepEqual(
    visualizer.actionFx.map(({ action, source, target }) => ({ action, source, target })),
    [
      { action: "materialize", source: portal, target: portal },
      { action: "extract", source: extractor, target: portal },
    ],
    "motion-enabled fallback feedback must retain each command's semantic source and target overlay",
  );
  assert.deepEqual(
    spatialCalls.map(([x, y, options]) => ({ x, y, delay: options.delay ?? 0 })),
    [
      { x: portal.x, y: portal.y, delay: 0 },
      { x: extractor.x, y: extractor.y, delay: 0 },
      { x: portal.x, y: portal.y, delay: 0.075 },
    ],
    "a same-endpoint materialize gesture must play once, while Extract must confirm its distinct target after the source cue",
  );
  assert.deepEqual(reconcileCalls, [], "renderer-local actions must not reconcile campaign-authoritative allies");
  assert.deepEqual(spawnAllyCalls, [], "renderer-local actions must not spawn allies");
  assert.deepEqual(spawnEnemyCalls, [], "renderer-local actions must not spawn or remove enemies");
  assert.deepEqual(visualizer.allies, [ally], "renderer-local actions must preserve ally topology");
  assert.deepEqual(visualizer.enemies, [enemy], "renderer-local actions must preserve enemy topology");
  assert.equal(visualizer.nodes, nodes, "renderer-local actions must preserve node topology/configuration");
  assert.equal(visualizer.encounter, encounter, "renderer-local actions must preserve the authoritative encounter");
  assert.equal(visualizer.authoritativeLegion, 1, "renderer-local actions must not change the authoritative legion");
  assert.equal(visualizer.bossExposed, false, "renderer-local actions must not change domain or assault state");
  assert.equal(ally.isPossessed, false, "renderer-local actions must not mutate possession state");
});

test("BattleVisualizer preserves Activate source-atlas clips for non-unit action assets", (t) => {
  const visualizer = makeVisualizer(t);
  const atlasCalls = [];
  const bridgeClipCalls = [];
  visualizer.nodes = [{ x: 5, y: 4 }];
  visualizer.playSpatial = () => {};
  visualizer.hasBridgeAtlas = (asset, clip) => {
    atlasCalls.push({ asset, clip });
    return true;
  };
  visualizer.setBridgeClip = (asset, clip) => bridgeClipCalls.push({ asset, clip });

  const semantics = [
    { action: "extract", source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" },
    { action: "materialize", source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" },
    { action: "capture", source: "portal", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "command-obelisk", clip: "Activate" },
    { action: "domain", source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "echo-throne", clip: "Activate" },
  ];
  for (const semantic of semantics) visualizer.triggerAction(semantic);

  const expected = semantics.map(({ sourceAsset, clip }) => ({ asset: sourceAsset, clip }));
  assert.deepEqual(
    atlasCalls,
    expected,
    "source-atlas availability must retain each non-unit asset's exported Activate clip rather than substituting the commander's Special clip",
  );
  assert.deepEqual(
    bridgeClipCalls,
    expected,
    "available source atlases must receive the same Activate clip that was validated for the source asset",
  );
});

test("BattleVisualizer reduced-motion feedback keeps one static semantic overlay until its controlled clear", (t) => {
  const timers = [];
  const visualizer = makeVisualizer(t, {
    reducedMotion: true,
    setTimeout(callback, duration) {
      timers.push({ callback, duration });
      return "action-feedback-timer";
    },
    clearTimeout() {},
  });
  const ally = { x: 3, y: 2, isPossessed: false };
  const enemy = { x: 11, y: 5, archetype: "scout" };
  const nodes = [{ x: 5, y: 4 }];
  const encounter = Object.freeze({ config: Object.freeze({ waves: [] }), state: Object.freeze({ activeWaveId: null }) });
  let renders = 0;
  visualizer.allies = [ally];
  visualizer.enemies = [enemy];
  visualizer.nodes = nodes;
  visualizer.encounter = encounter;
  visualizer.authoritativeLegion = 1;
  visualizer.bossExposed = false;
  visualizer.playSpatial = () => {};
  visualizer.render = () => { renders += 1; };

  const portal = visualizer.actionPoint("portal");
  const extractor = visualizer.actionPoint("extractor");
  visualizer.triggerAction({
    action: "extract",
    source: "extractor",
    target: "portal",
    sourceAsset: "soul-extractor",
    clip: "Special",
  });

  assert.deepEqual(
    visualizer.actionFx.map(({ action, source, target }) => ({ action, source, target })),
    [{ action: "extract", source: extractor, target: portal }],
    "reduced motion must retain one static source-to-target feedback overlay instead of suppressing the command signal",
  );
  assert.deepEqual(timers.map(({ duration }) => duration), [700], "reduced-motion feedback must schedule one bounded clear");
  assert.equal(visualizer.actionFeedbackTimer, "action-feedback-timer", "the pending static-overlay timer must be retained for safe cancellation");
  assert.equal(renders, 1, "reduced-motion feedback must render its static overlay immediately");
  assert.equal(visualizer.encounter, encounter, "reduced-motion feedback must preserve the authoritative encounter");
  assert.equal(visualizer.authoritativeLegion, 1, "reduced-motion feedback must preserve the authoritative legion");
  assert.deepEqual(visualizer.allies, [ally], "reduced-motion feedback must preserve allies and possession state");
  assert.deepEqual(visualizer.enemies, [enemy], "reduced-motion feedback must preserve enemies");
  assert.equal(visualizer.nodes, nodes, "reduced-motion feedback must preserve node topology");
  assert.equal(visualizer.bossExposed, false, "reduced-motion feedback must preserve domain and assault state");

  timers[0].callback();

  assert.deepEqual(visualizer.actionFx, [], "the controlled timer must clear the static overlay safely");
  assert.equal(visualizer.actionFeedbackTimer, null, "the controlled timer must clear its own handle");
  assert.equal(renders, 2, "clearing the static overlay must render the cleared state once");
});

function fakeRunningAudioContext() {
  const calls = { resume: 0, oscillators: 0, starts: 0 };
  const context = {
    state: "suspended",
    currentTime: 0,
    resume() {
      calls.resume += 1;
      this.state = "running";
      return Promise.resolve();
    },
    createOscillator() {
      calls.oscillators += 1;
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { calls.starts += 1; },
        stop() {},
      };
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
  };
  return { context, calls };
}

test("BattleVisualizer resumes suspended spatial audio before allocating an oscillator", async (t) => {
  const visualizer = makeVisualizer(t);
  const { context, calls } = fakeRunningAudioContext();
  const audio = { ctx: context, master: {} };
  visualizer.audio = audio;
  visualizer.ensureAudio = () => audio;
  visualizer.project = () => ({ x: 50, y: 50 });
  visualizer.elevationAt = () => 0;
  visualizer.view = { width: 100, height: 100 };

  visualizer.playSpatial(3, 2);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.resume, 1, "suspended spatial audio must request one context resume");
  assert.equal(calls.oscillators, 1, "a successfully resumed context must allocate one oscillator");
  assert.equal(calls.starts, 1, "a successfully resumed context must start the oscillator");
});

test("BattleVisualizer ignores rejected suspended-audio resumes without allocating an oscillator", async (t) => {
  const visualizer = makeVisualizer(t);
  const { context, calls } = fakeRunningAudioContext();
  context.resume = () => {
    calls.resume += 1;
    return Promise.reject(new Error("resume denied"));
  };
  const audio = { ctx: context, master: {} };
  visualizer.audio = audio;
  visualizer.ensureAudio = () => audio;
  visualizer.project = () => ({ x: 50, y: 50 });
  visualizer.elevationAt = () => 0;
  visualizer.view = { width: 100, height: 100 };

  visualizer.playSpatial(3, 2);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.resume, 1, "a rejected resume must still be attempted exactly once");
  assert.equal(calls.oscillators, 0, "a rejected resume must not allocate an oscillator");
  assert.equal(calls.starts, 0, "a rejected resume must not start an oscillator");
});

test("BattleVisualizer spawns hostile waves from the 24×12 route frontage without legacy 16×8 coordinates", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 10 },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};

  visualizer.spawnEncounterWave({ id: "zenith-wave", hostiles: 3, hostileHealth: 4 });

  assert.equal(visualizer.enemies.length, 3, "the fallback renderer must materialize every hostile in the supplied wave");
  visualizer.enemies.forEach((enemy, routeIndex) => {
    assert.equal(enemy.routeIndex, routeIndex, `hostile ${routeIndex + 1} must use its authored route`);
    assert.equal(enemy.x, 22.5, `route ${routeIndex + 1} must spawn beyond the legacy 16-column boundary`);
    assert.equal(enemy.y, 5.5, `route ${routeIndex + 1} must spawn on the far-side deployment frontage`);
    assert.equal(
      enemy.path.length,
      visualizer.navigation.routes[routeIndex].cells.length - 1,
      `route ${routeIndex + 1} must retain every waypoint after its spawn cell`,
    );
    assert.deepEqual(
      enemy.path.at(-1),
      { x: 1.5, y: 5.5 },
      `route ${routeIndex + 1} must terminate at the portal frontage`,
    );
  });
});

test("BattleVisualizer maps Stage 1 waves to their authored models and later archetypes to the scout fallback", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};
  const archetypeByWave = {};

  for (const waveId of ["scout", "guard", "reinforcement", "depthguard"]) {
    visualizer.enemies = [];
    visualizer.spawnEncounterWave({ id: waveId, hostiles: 1, hostileHealth: 2 });
    archetypeByWave[waveId] = visualizer.enemies[0]?.archetype;
  }

  assert.deepEqual(
    archetypeByWave,
    {
      scout: "scout",
      guard: "guard",
      reinforcement: "reinforce",
      depthguard: "scout",
    },
    "only the three declared Stage 1 waves may select dedicated hostile art; later archetypes must retain the scout fallback",
  );
});

function makeCanvasTowerScenario(t, { fortificationLevel = 1, distance = 1 } = {}) {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
  });
  const enemy = {
    id: "enemy-1",
    x: -0.5 + distance,
    y: -0.5,
    hp: 10,
    defeated: false,
    breachVisualized: false,
  };

  visualizer.campaign = {
    progression: {
      skills: { fortification: fortificationLevel },
    },
  };
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};
  visualizer.enemies = [enemy];
  visualizer.deployments = [{
    id: "tower-1",
    kind: "tower",
    x: -1,
    y: -1,
    cooldown: 0,
  }];

  return {
    visualizer,
    enemy,
    shotCount: () => visualizer.getTacticalSnapshot().towerShots.length,
  };
}

test("BattleVisualizer tower auto-fire applies fortification bonuses above the level-1 baseline", async (t) => {
  const cases = [
    { name: "level 1 deals baseline damage", fortificationLevel: 1, expectedDamage: 1 },
    { name: "level 2 adds twenty percent damage", fortificationLevel: 2, expectedDamage: 1.2 },
  ];

  for (const { name, fortificationLevel, expectedDamage } of cases) {
    await t.test(name, () => {
      const { visualizer, enemy, shotCount } = makeCanvasTowerScenario(t, { fortificationLevel });

      visualizer.updateTowers(0);

      assert.deepEqual(
        {
          damage: Number((10 - enemy.hp).toFixed(6)),
          shots: shotCount(),
        },
        { damage: expectedDamage, shots: 1 },
        "one live enemy inside tower range must take the level-scaled damage from exactly one emitted shot",
      );
    });
  }
});

test("BattleVisualizer tower auto-fire includes the shared base-range boundary and excludes enemies beyond it", async (t) => {
  const cases = [
    { name: "enemy exactly four units away is in range", distance: 4, expectedShots: 1 },
    { name: "enemy just beyond four units is out of range", distance: 4.001, expectedShots: 0 },
  ];

  for (const { name, distance, expectedShots } of cases) {
    await t.test(name, () => {
      const { visualizer, shotCount } = makeCanvasTowerScenario(t, { distance });

      visualizer.updateTowers(0);

      assert.equal(
        shotCount(),
        expectedShots,
        "the Canvas tower must use the same inclusive four-unit base range as the WebGL tower",
      );
    });
  }
});

test("BattleVisualizer tower auto-fire emits only one shot during the shared one-second cooldown", (t) => {
  const { visualizer, shotCount } = makeCanvasTowerScenario(t);
  const shotsByElapsedTime = [];

  for (const elapsed of [0, 0.8, 0.2]) {
    visualizer.updateTowers(elapsed);
    shotsByElapsedTime.push(shotCount());
  }

  assert.deepEqual(
    shotsByElapsedTime,
    [1, 1, 2],
    "the tower must fire immediately, remain blocked at 0.8 seconds, and fire again after one full second",
  );
});

function measureCanvasMobilityTick(t, { mobilityLevel, terrainMultiplier = 1 }) {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
  });
  const start = { x: 5, y: 5 };
  const ally = {
    x: start.x,
    y: start.y + 1,
    baseSpeed: 1.2,
    speed: 1.2,
    hp: 3,
    defeated: false,
    path: [{ x: start.x + 2, y: start.y + 1 }],
  };

  visualizer.campaign = {
    progression: {
      skills: { mobility: mobilityLevel },
    },
  };
  visualizer.commander.x = start.x;
  visualizer.commander.y = start.y;
  visualizer.commanderPosition = { ...start };
  visualizer.allies = [ally];
  visualizer.pressed.add("KeyD");
  const navigation = Object.create(visualizer.navigation);
  Object.defineProperty(navigation, "getGimmickAt", {
    value: () => ({
      effects: { movementSpeedMultiplier: terrainMultiplier },
    }),
  });
  visualizer.navigation = navigation;
  visualizer.walkable = () => true;
  visualizer.clampMovementToContact = () => false;

  visualizer.updateUnits(0.25);

  return {
    commander: Math.hypot(
      visualizer.commander.x - start.x,
      visualizer.commander.y - start.y,
    ),
    ally: Math.hypot(ally.x - start.x, ally.y - (start.y + 1)),
  };
}

test("BattleVisualizer Mobility accelerates only the commander and composes with terrain movement", async (t) => {
  const baseline = measureCanvasMobilityTick(t, { mobilityLevel: 1 });
  const upgraded = measureCanvasMobilityTick(t, { mobilityLevel: 2 });
  const terrainMultiplier = 0.5;
  const terrainAffected = measureCanvasMobilityTick(t, { mobilityLevel: 2, terrainMultiplier });

  await t.test("level 2 moves the commander exactly fifteen percent farther than level 1", () => {
    assert.equal(
      Number((upgraded.commander / baseline.commander).toFixed(12)),
      1.15,
      "Mobility level 1 must be the commander baseline and level 2 must add exactly fifteen percent",
    );
  });

  await t.test("level 2 leaves allied-unit movement at the level-1 distance", () => {
    assert.equal(
      Number((upgraded.ally / baseline.ally).toFixed(12)),
      1,
      "Mobility must not change allied-unit speed",
    );
  });

  await t.test("terrain movement effects multiply the upgraded commander distance", () => {
    assert.equal(
      Number((terrainAffected.commander / upgraded.commander).toFixed(12)),
      terrainMultiplier,
      "terrain movement effects must remain multiplicative with commander Mobility",
    );
  });
});

test("BattleVisualizer publishes stable aggregate selection summaries and selected defeat", (t) => {
  const summaries = [];
  const onSelectionChange = (summary) => summaries.push(summary);
  const visualizer = makeVisualizer(t, {
    options: { onSelectionChange },
  });

  assert.equal(
    visualizer.onSelectionChange,
    onSelectionChange,
    "the fallback constructor must retain the same cockpit callback contract as WebGL",
  );
  assert.deepEqual(
    visualizer.emitSelectionChange(),
    {
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
    },
    "the initial fallback summary must be serializable plain data",
  );

  const moving = {
    x: 2,
    y: 3,
    hp: 3,
    defeated: false,
    isPossessed: true,
    path: [{ x: 4, y: 3 }],
  };
  const engaged = { x: 3, y: 3, hp: 1, defeated: false, isPossessed: false, path: null };
  const enemy = { x: 4, y: 3, hp: 2, defeated: false };
  visualizer.allies = [moving, engaged];
  visualizer.selection.add(moving);
  visualizer.selection.add(engaged);
  visualizer.engagements.set(engaged, enemy);
  visualizer.engagements.set(enemy, engaged);

  assert.deepEqual(
    visualizer.emitSelectionChange(),
    {
      count: 2,
      total: 2,
      health: 4,
      maxHealth: 6,
      possessed: 1,
      engaged: 1,
      moving: 1,
      order: "mixed",
    },
    "fallback selection data must use the same health and order semantics as WebGL",
  );
  visualizer.emitSelectionChange();
  assert.equal(summaries.length, 2, "unchanged fallback selection must not duplicate the callback");

  visualizer.defeatUnit(engaged);
  assert.deepEqual(
    summaries.at(-1),
    {
      count: 1,
      total: 1,
      health: 3,
      maxHealth: 3,
      possessed: 1,
      engaged: 0,
      moving: 1,
      order: "moving",
    },
    "fallback defeat must immediately remove and republish a selected actor",
  );
  assert.equal(visualizer.selection.has(engaged), false, "defeated fallback actors must not remain selected");

  visualizer.ctx = {};
  visualizer.reconcileAllies(0);
  assert.deepEqual(
    summaries.at(-1),
    {
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
    },
    "fallback authoritative removal must clear and republish the selected set",
  );
  assert.equal(visualizer.selection.size, 0, "removed fallback allies must not remain selected");
});

test("BattleVisualizer direct ally click selects one ally without issuing a ground order", (t) => {
  const canvas = makePointerCanvas();
  const summaries = [];
  const tacticalRequests = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      onSelectionChange: (summary) => summaries.push(summary),
      onTacticalRequest: (request) => tacticalRequests.push(request),
    },
  });
  const prior = { x: 1, y: 1, hp: 1, defeated: false };
  const clicked = { x: 4, y: 4, hp: 2, defeated: false };
  visualizer.allies = [prior, clicked];
  visualizer.selection.add(prior);
  visualizer.resolvePointerAlly = () => clicked;
  visualizer.detectActionAt = () => null;
  visualizer.requestTacticalActionAt = () => false;
  visualizer.unprojectToTile = () => ({ x: 8, y: 3 });
  visualizer.attachPointerHandlers();

  clickCanvasTarget(canvas, { x: 40, y: 40 });

  assert.deepEqual([...visualizer.selection], [clicked], "a fallback ally click must replace the prior selection");
  assert.deepEqual(tacticalRequests, [], "an ally click must not fall through to commander focus or movement");
  assert.equal(summaries.at(-1).count, 1, "the direct fallback selection must publish one selected actor");
  assert.equal(summaries.at(-1).health, 2, "the direct fallback selection must publish the actor's current health");
});

test("BattleVisualizer marquee emits one summary for the resulting actor set", (t) => {
  const canvas = makePointerCanvas();
  const summaries = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: { onSelectionChange: (summary) => summaries.push(summary) },
  });
  const inside = { x: 2, y: 2, hp: 2, defeated: false };
  const outside = { x: 8, y: 8, hp: 3, defeated: false };
  visualizer.allies = [inside, outside];
  visualizer.project = (x) => (x === inside.x ? { x: 25, y: 25 } : { x: 85, y: 85 });
  visualizer.detectActionAt = () => null;
  visualizer.attachPointerHandlers();

  canvas.dispatch("pointerdown", { x: 5, y: 5, pointerId: 9 });
  canvas.dispatch("pointermove", { x: 55, y: 55, pointerId: 9 });
  canvas.dispatch("pointerup", { x: 55, y: 55, pointerId: 9 });

  assert.deepEqual([...visualizer.selection], [inside], "fallback marquee must select only allies inside its screen rectangle");
  assert.deepEqual(
    summaries,
    [{
      count: 1,
      total: 2,
      health: 2,
      maxHealth: 3,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "holding",
    }],
    "the completed marquee must publish one holding summary for its selected set",
  );
});

test("BattleVisualizer selectAlly publishes only semantic selection changes and clears invalid targets", (t) => {
  const summaries = [];
  const visualizer = makeVisualizer(t, {
    options: { onSelectionChange: (summary) => summaries.push(summary) },
  });
  const prior = { x: 1, y: 1, hp: 1, defeated: false };
  const selected = { x: 2, y: 2, hp: 2, maxHealth: 5, defeated: false };
  const defeated = { x: 3, y: 3, hp: 3, defeated: true };
  visualizer.allies = [prior, selected, defeated];
  visualizer.selection.add(prior);

  const selectedSummary = visualizer.selectAlly(selected);
  assert.deepEqual([...visualizer.selection], [selected], "the public fallback API must replace the prior set with the requested live ally");
  assert.deepEqual(
    selectedSummary,
    {
      count: 1,
      total: 2,
      health: 2,
      maxHealth: 5,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "holding",
    },
    "direct fallback selection must publish current and maximum health without counting defeated allies",
  );

  assert.strictEqual(
    visualizer.selectAlly(selected),
    selectedSummary,
    "reselecting the same fallback ally must reuse the stable summary",
  );
  assert.equal(summaries.length, 1, "reselecting the same fallback ally must not duplicate the cockpit callback");

  const clearedSummary = visualizer.selectAlly(defeated);
  assert.equal(visualizer.selection.size, 0, "a defeated fallback ally must clear rather than enter the selected set");
  assert.deepEqual(
    clearedSummary,
    {
      count: 0,
      total: 2,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
    },
    "rejecting an invalid fallback target must publish the cleared selection while preserving the live-force total",
  );
  assert.strictEqual(
    visualizer.selectAlly({ x: 4, y: 4, hp: 1, defeated: false }),
    clearedSummary,
    "repeated invalid fallback targets must preserve the stable cleared summary",
  );
  assert.equal(summaries.length, 2, "only the fallback selected and cleared semantic states must reach the cockpit");
});
