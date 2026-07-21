import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";
import { ObjectFeedbackLayer } from "../object-feedback-layer.js";
import { screenToWorldFlat } from "../iso-math.js";

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
    addEventListener() {},
    removeEventListener() {},
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
        preventDefault() {},
        ...event,
      });
    },
  };
}

function clickCanvasTarget(canvas, point) {
  canvas.dispatch("pointerdown", point);
  canvas.dispatch("pointerup", point);
}
test("BattleVisualizer selected allies use the stage ally palette with motion-safe circular pulse geometry", (t) => {
  const allyColor = "#21c7a8";
  const observeSelection = (reducedMotion, lastTime) => {
    const visualizer = makeVisualizer(t, {
      canvas: {},
      reducedMotion,
      presentation: {
        stageNumber: 6,
        palette: { ally: allyColor },
      },
    });
    const strokes = [];
    const ellipses = [];
    visualizer.ctx = {
      beginPath() {},
      ellipse(...args) {
        ellipses.push(args);
      },
      fill() {},
      stroke() {
        strokes.push({
          strokeStyle: this.strokeStyle,
          globalAlpha: this.globalAlpha,
          lineWidth: this.lineWidth,
        });
      },
      save() {},
      restore() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      arc() {},
    };
    visualizer.project = () => ({ x: 40, y: 30 });
    visualizer.elevationAt = () => 0;
    visualizer.drawBridgeAtlas = () => true;
    visualizer.lastTime = lastTime;
    const ally = { x: 1, y: 1, hp: 2, defeated: false, facing: 0 };
    visualizer.allies = [ally];
    visualizer.selection.add(ally);

    visualizer.drawUnit(ally, "ally");

    return {
      selectionStroke: strokes[0],
      selectionEllipse: ellipses[0],
      ellipseCount: ellipses.length,
      scale: visualizer.view.scale,
    };
  };

  const animated = observeSelection(false, 0);
  assert.deepEqual(
    animated.selectionStroke,
    { strokeStyle: allyColor, globalAlpha: 0.86, lineWidth: 2 },
    "the selected-unit pulse must remain legible in the active stage ally color",
  );
  assert.deepEqual(
    animated.selectionEllipse,
    [40, 30 + 2 * animated.scale, 16 * animated.scale, 8 * animated.scale, 0, 0, Math.PI * 2],
    "the animated selection affordance must render a visible full ellipse at the pulse midpoint",
  );
  assert.equal(
    animated.ellipseCount,
    2,
    "the unit shadow and selection indicator must both remain visible circular ellipses",
  );

  const reducedAtStart = observeSelection(true, 0);
  const reducedLater = observeSelection(true, 10_000);
  assert.deepEqual(
    reducedAtStart.selectionStroke,
    { strokeStyle: allyColor, globalAlpha: 0.76, lineWidth: 2 },
    "reduced motion must retain a legible stage-colored selection stroke at its fixed baseline",
  );
  assert.deepEqual(
    reducedAtStart.selectionEllipse,
    [40, 30 + 2 * reducedAtStart.scale, 15 * reducedAtStart.scale, 7.5 * reducedAtStart.scale, 0, 0, Math.PI * 2],
    "reduced motion must retain the full baseline selection ellipse rather than removing the affordance",
  );
  assert.deepEqual(
    reducedLater,
    reducedAtStart,
    "reduced-motion selection geometry and alpha must not change with animation time",
  );
});

test("BattleVisualizer draws the commander in a distinct identity color from ordinary shade allies", (t) => {
  const canvas = makePointerCanvas();
  const allyColor = "#70e5d0";
  const commanderColor = "#ab68ff";
  const visualizer = makeVisualizer(t, {
    canvas,
    presentation: {
      stageNumber: 6,
      palette: { ally: allyColor, commander: commanderColor },
    },
  });
  const fills = [];
  visualizer.ctx = {
    beginPath() {},
    ellipse() {},
    fill() {
      fills.push(this.fillStyle);
    },
    stroke() {},
    save() {},
    restore() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
  };
  visualizer.project = () => ({ x: 40, y: 30 });
  visualizer.elevationAt = () => 0;
  visualizer.drawBridgeAtlas = () => false;
  visualizer.unitAtlases = new Map();

  const commanderUnit = { x: 1, y: 1, hp: 10, defeated: false, facing: 0 };
  visualizer.drawUnit(commanderUnit, "commander");
  const allyUnit = { x: 1, y: 1, hp: 3, defeated: false, facing: 0 };
  visualizer.drawUnit(allyUnit, "ally");

  assert.equal(fills[0], "rgba(0,0,0,0.42)", "the commander's ground shadow must draw before its identity fill");
  assert.equal(fills[1], commanderColor, "the commander must fill with its own distinct identity color, not the ally color");
  assert.equal(fills[3], allyColor, "an ordinary shade ally must still fill with the stage ally color");
  assert.notEqual(fills[1], fills[3], "the commander and an ordinary shade ally must never render in the same color");
});

test("BattleVisualizer right-drag previews legal ally routes in the stage ally palette, commits them on release, and clears invalid previews", (t) => {
  const canvas = makePointerCanvas();
  const allyColor = "#5bd6c0";
  const visualizer = makeVisualizer(t, {
    canvas,
    presentation: {
      stageNumber: 6,
      palette: { ally: allyColor },
    },
  });
  const ally = { x: 1, y: 1, hp: 2, defeated: false, path: [] };
  visualizer.allies = [ally];
  visualizer.selection.add(ally);
  visualizer.commander = { x: 1, y: 1 };
  visualizer.unprojectToTile = (x) => (x >= 0 ? { x: 2, y: 1 } : { x: -1, y: -1 });
  visualizer.walkable = (x, y) => x >= 0 && y >= 0;
  visualizer.findPath = (start, goal) => (
    goal.x >= 0 ? [start, { x: goal.x, y: goal.y }] : null
  );
  visualizer.attachPointerHandlers();

  canvas.dispatch("pointerdown", { button: 2, x: 10, y: 10, pointerId: 4 });
  canvas.dispatch("pointermove", { button: 2, x: 30, y: 10, pointerId: 4 });
  assert.equal(visualizer.routePreviewActive, true, "a held right-drag over a legal tile must expose a live route preview");
  const legalPreview = JSON.stringify(visualizer.routePreview);
  assert.ok(legalPreview && legalPreview !== "null", "the legal preview must contain route geometry");

  const strokes = [];
  const operations = [];
  visualizer.ctx = {
    save() {},
    restore() {},
    setLineDash() {},
    beginPath() {},
    moveTo(...args) {
      operations.push({ type: "moveTo", args });
    },
    lineTo(...args) {
      operations.push({ type: "lineTo", args });
    },
    ellipse(...args) {
      operations.push({ type: "ellipse", args });
    },
    stroke() {
      strokes.push({
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
      });
    },
  };
  visualizer.project = (x, y) => ({ x: x * 10, y: y * 10 });
  visualizer.elevationAt = () => 0;
  visualizer.drawRoutePreview();
  const previewStroke = {
    strokeStyle: allyColor,
    globalAlpha: 0.95,
    lineWidth: Math.max(1.5, 2 * visualizer.view.scale),
  };
  assert.deepEqual(
    strokes,
    [previewStroke, previewStroke],
    "the route line and endpoint ring must both stay legible in the active stage ally color",
  );
  assert.deepEqual(
    operations,
    [
      { type: "moveTo", args: [15, 15] },
      { type: "lineTo", args: [25, 15] },
      {
        type: "ellipse",
        args: [25, 15, 10 * visualizer.view.scale, 5 * visualizer.view.scale, 0, 0, Math.PI * 2],
      },
    ],
    "the legal route preview must draw its full path and a visible elliptical endpoint",
  );
  canvas.dispatch("pointerup", { button: 2, x: 30, y: 10, pointerId: 4 });
  assert.equal(visualizer.routePreviewActive, false, "releasing a legal route must clear the transient preview");
  assert.equal(visualizer.routePreview, null, "committing a route must not leave stale Canvas preview geometry");
  assert.ok(ally.path.length > 0, "releasing over a legal tile must commit the selected ally route");

  const priorPath = ally.path;
  canvas.dispatch("pointerdown", { button: 2, x: 10, y: 10, pointerId: 5 });
  canvas.dispatch("pointermove", { button: 2, x: -20, y: 10, pointerId: 5 });
  assert.equal(visualizer.routePreviewActive, false, "an invalid tile must not advertise a legal route preview");
  canvas.dispatch("pointercancel", { button: 2, x: -20, y: 10, pointerId: 5 });
  assert.equal(visualizer.routePreview, null, "cancelling an invalid route must leave preview state empty");
  assert.strictEqual(ally.path, priorPath, "an invalid route must not replace the last legal committed route");
});


test("BattleVisualizer fallback canvas prioritizes available semantic targets over selected move orders and rejects unavailable bosses", (t) => {
  const canvas = makePointerCanvas();
  const requestedActions = [];
  let availableActions = ["materialize", "capture", "assault"];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      nodeGoal: 1,
      onActionRequest: (req) => requestedActions.push(typeof req === "string" ? req : req.action),
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
      onActionRequest: (req) => requestedActions.push(typeof req === "string" ? req : req.action),
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

test("BattleVisualizer tactical snapshot bounds all four inverse-projected canvas corners through pan, zoom, and resize", (t) => {
  const canvas = makePointerCanvas();
  canvas.clientWidth = 640;
  canvas.clientHeight = 360;
  const visualizer = makeVisualizer(t, { canvas });
  visualizer.ctx = { setTransform() {} };

  const expectedViewport = () => {
    const corners = [
      [0, 0],
      [visualizer.view.width, 0],
      [0, visualizer.view.height],
      [visualizer.view.width, visualizer.view.height],
    ].map(([canvasX, canvasY]) => {
      const flat = screenToWorldFlat(
        (canvasX - visualizer.view.offsetX) / visualizer.view.scale,
        (canvasY - visualizer.view.offsetY) / visualizer.view.scale,
      );
      return visualizer.navigation.gridToWorld(flat.x, flat.y);
    });
    const minX = Math.min(...corners.map(({ x }) => x));
    const maxX = Math.max(...corners.map(({ x }) => x));
    const minZ = Math.min(...corners.map(({ z }) => z));
    const maxZ = Math.max(...corners.map(({ z }) => z));
    return {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      width: maxX - minX,
      depth: maxZ - minZ,
    };
  };
  const assertViewport = (actual, expected, context) => {
    assert.ok(actual, `${context} must publish a viewport`);
    for (const field of ["x", "z", "width", "depth"]) {
      assert.ok(Number.isFinite(actual[field]), `${context} ${field} must be finite`);
      assert.ok(
        Math.abs(actual[field] - expected[field]) <= Math.max(1, Math.abs(expected[field])) * 1e-12,
        `${context} ${field}: expected ${expected[field]}, received ${actual[field]}`,
      );
    }
    assert.equal(actual.zoom, visualizer.view.scale, `${context} must preserve the existing minimap zoom field`);
    assert.ok(actual.width > 0 && actual.depth > 0, `${context} dimensions must remain positive`);
  };

  visualizer.computeView();
  const fitted = visualizer.getTacticalSnapshot().viewport;
  assertViewport(fitted, expectedViewport(), "the fitted canvas footprint");

  visualizer.attachPointerHandlers();
  canvas.dispatch("pointerdown", { button: 1, x: 100, y: 100, pointerId: 7 });
  canvas.dispatch("pointermove", { button: 1, x: 180, y: 140, pointerId: 7 });
  const panned = visualizer.getTacticalSnapshot().viewport;
  assertViewport(panned, expectedViewport(), "the middle-dragged canvas footprint");
  assert.notDeepEqual(
    { x: panned.x, z: panned.z },
    { x: fitted.x, z: fitted.z },
    "panning must move the minimap viewport center",
  );
  assert.ok(Math.abs(panned.width - fitted.width) < 1e-12, "panning must preserve viewport width");
  assert.ok(Math.abs(panned.depth - fitted.depth) < 1e-12, "panning must preserve viewport depth");
  canvas.dispatch("pointerup", { button: 1, x: 180, y: 140, pointerId: 7 });

  visualizer.manualZoom = 2;
  visualizer.computeView();
  const zoomed = visualizer.getTacticalSnapshot().viewport;
  assertViewport(zoomed, expectedViewport(), "the zoomed canvas footprint");
  assert.ok(zoomed.width < fitted.width && zoomed.depth < fitted.depth, "zooming in must shrink both visible world-space dimensions");

  canvas.clientWidth = 800;
  canvas.clientHeight = 500;
  visualizer.computeView();
  const resized = visualizer.getTacticalSnapshot().viewport;
  assertViewport(resized, expectedViewport(), "the resized canvas footprint");
  assert.ok(
    resized.width !== zoomed.width || resized.depth !== zoomed.depth,
    "resizing the canvas must update at least one visible world-space dimension",
  );
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
  assert.equal(canvas.listeners.size, 9, "the pointer seam must register its complete interaction listener set");
  assert.equal(documentListeners.has("visibilitychange"), true, "the renderer must observe document visibility while alive");

  visualizer.destroy();

  assert.equal(canvas.listeners.size, 0, "destroy must remove every canvas listener registered by the pointer seam");
  assert.equal(documentListeners.size, 0, "destroy must remove its document visibility listener");
});

test("BattleVisualizer mouse-wheel zoom adjusts view.scale while focused, clamps at its bounds, and is inert without canvas focus", (t) => {
  const canvas = makePointerCanvas();
  const priorDocument = globalThis.document;
  globalThis.document = { activeElement: canvas, addEventListener() {}, removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });

  const visualizer = makeVisualizer(t, { canvas });
  visualizer.view = { scale: 10, offsetX: 0, offsetY: 0, width: 320, height: 180 };
  let computeViewCalls = 0;
  // computeView()'s own geometry math is exercised by the projection tests
  // above; this test only needs to verify that onWheel drives manualZoom
  // through the same computeView -> buildStaticLayer -> renderStatic
  // pipeline resize() already uses, so scale is simulated proportionally.
  visualizer.computeView = () => {
    computeViewCalls += 1;
    visualizer.view.scale = 10 * visualizer.manualZoom;
  };
  let rebuilds = 0;
  visualizer.buildStaticLayer = () => { rebuilds += 1; };
  visualizer.attachPointerHandlers();

  const baseScale = visualizer.view.scale;
  assert.equal(visualizer.manualZoom, 1, "zoom starts at the auto-fit default");

  let prevented = 0;
  canvas.dispatch("wheel", { deltaY: -100, preventDefault: () => { prevented += 1; } });
  assert.ok(visualizer.manualZoom > 1, "scrolling up (negative deltaY) must zoom in");
  assert.ok(visualizer.view.scale > baseScale, "a larger manualZoom must raise the effective view scale");
  assert.equal(prevented, 1, "wheel zoom must prevent default page scroll");
  assert.equal(computeViewCalls, 1, "each zoom step must recompute the view");
  assert.equal(rebuilds, 1, "each zoom step must rebake static chunks at the new scale");

  for (let i = 0; i < 50; i += 1) canvas.dispatch("wheel", { deltaY: -1000 });
  assert.equal(visualizer.manualZoom, 2.4, "zooming in repeatedly must clamp at the maximum");

  for (let i = 0; i < 80; i += 1) canvas.dispatch("wheel", { deltaY: 1000 });
  assert.equal(visualizer.manualZoom, 0.6, "zooming out repeatedly must clamp at the minimum");

  const rebuildsBeforeUnfocused = rebuilds;
  globalThis.document.activeElement = null;
  canvas.dispatch("wheel", { deltaY: -100 });
  assert.equal(visualizer.manualZoom, 0.6, "wheel input must be ignored while the canvas is not focused");
  assert.equal(rebuilds, rebuildsBeforeUnfocused, "an ignored wheel event must not trigger a rebuild");
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

test("BattleVisualizer mirrors authoritative boss vitality across four-phase thresholds without mutating campaign snapshots", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 9 },
  });
  const campaign = {
    stageId: "abyss-chancel",
    stage: {
      bossHealth: 22,
      bossMaxHealth: 22,
      bossPhaseCount: 4,
      nodes: 0,
      deployments: [],
    },
  };
  const stage = {
    id: "abyss-chancel",
    bossHealth: 22,
    bossPhaseCount: 4,
  };
  const campaignBefore = structuredClone(campaign);
  const cases = [
    { health: 22, phaseIndex: 0 },
    { health: 16.5, phaseIndex: 1 },
    { health: 11, phaseIndex: 2 },
    { health: 5.5, phaseIndex: 3 },
  ];

  for (const { health, phaseIndex } of cases) {
    const state = {
      bossHealth: health,
      bossMaxHealth: 22,
      bossPhaseCount: 4,
      bossExposed: true,
      nodes: 0,
      deployments: [],
    };
    const stateBefore = structuredClone(state);

    visualizer.applyCampaignState({ campaign, stage, state });

    assert.equal(visualizer.bossHealth, health, `Canvas must mirror authoritative boss HP at ${health}/22`);
    assert.equal(visualizer.bossMaxHealth, 22, "Canvas must retain the authoritative boss maximum across phase changes");
    assert.equal(
      visualizer.bossPhase?.phaseIndex,
      phaseIndex,
      `Canvas must enter resolver phase ${phaseIndex} at ${health}/22 health`,
    );
    assert.equal(visualizer.bossPhase?.phaseCount, 4, "Canvas must honor the stage's four-phase boss contract");
    assert.deepEqual(state, stateBefore, "boss presentation sync must not mutate the supplied stage-state snapshot");
  }

  assert.deepEqual(campaign, campaignBefore, "boss presentation sync must not mutate the supplied campaign");
});

function makeCanvasBossPresentationHarness(t) {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 9 },
  });
  const clips = [];
  const canvasCalls = [];
  const spatialCalls = [];
  const burstCalls = [];
  visualizer.ctx = {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    beginPath() { canvasCalls.push(["beginPath"]); },
    closePath() { canvasCalls.push(["closePath"]); },
    moveTo(...args) { canvasCalls.push(["moveTo", ...args]); },
    lineTo(...args) { canvasCalls.push(["lineTo", ...args]); },
    ellipse(...args) { canvasCalls.push(["ellipse", ...args]); },
    arc(...args) { canvasCalls.push(["arc", ...args]); },
    fill() { canvasCalls.push(["fill", this.fillStyle, this.globalAlpha]); },
    stroke() { canvasCalls.push(["stroke", this.strokeStyle, this.globalAlpha, this.lineWidth]); },
    fillText(...args) { canvasCalls.push(["fillText", ...args]); },
    save() { canvasCalls.push(["save"]); },
    restore() { canvasCalls.push(["restore"]); },
    setLineDash(...args) { canvasCalls.push(["setLineDash", ...args]); },
  };
  visualizer.project = () => ({ x: 100, y: 100 });
  visualizer.elevationAt = () => 0;
  visualizer.drawBridgeAtlas = (_asset, clip) => {
    clips.push(clip);
    return false;
  };
  visualizer.playSpatial = (...args) => spatialCalls.push(args);
  visualizer.burst = (...args) => burstCalls.push(args);

  const stage = { id: "abyss-chancel", bossHealth: 22, bossPhaseCount: 4 };
  const campaign = {
    stageId: "abyss-chancel",
    stage: {
      bossHealth: 22,
      bossMaxHealth: 22,
      bossPhaseCount: 4,
      nodes: 0,
      deployments: [],
    },
  };
  const stateAt = (bossHealth, bossExposed = true) => ({
    bossHealth,
    bossMaxHealth: 22,
    bossPhaseCount: 4,
    bossExposed,
    nodes: 0,
    deployments: [],
  });
  const sync = (state) => visualizer.applyCampaignState({ campaign, stage, state });
  const drawFrame = () => {
    canvasCalls.length = 0;
    visualizer.drawBoss();
    return structuredClone(canvasCalls);
  };
  const assault = {
    action: "assault",
    source: "ally",
    target: "boss",
    actor: "commander",
    actorClip: "Strike",
    sourceAsset: "shade",
    clip: "Strike",
  };

  return {
    visualizer,
    clips,
    spatialCalls,
    burstCalls,
    campaign,
    stateAt,
    sync,
    drawFrame,
    assault,
  };
}

test("BattleVisualizer presents an accepted exposed Assault as boss Attack with an atlas-free cue", (t) => {
  const {
    visualizer,
    clips,
    campaign,
    stateAt,
    sync,
    drawFrame,
    assault,
  } = makeCanvasBossPresentationHarness(t);
  const campaignBefore = structuredClone(campaign);

  sync(stateAt(22));
  const liveFallback = drawFrame();
  const liveClip = clips.at(-1);

  visualizer.bossExposed = false;
  visualizer.playActionEffect(assault);
  visualizer.bossExposed = true;
  const hiddenAssaultFallback = drawFrame();
  assert.equal(clips.at(-1), liveClip, "an Assault received while the boss is hidden must not change boss playback");
  assert.deepEqual(hiddenAssaultFallback, liveFallback, "an atlas-free hidden-boss Assault must not change the live fallback frame");

  visualizer.playActionEffect(assault);
  const attackFallback = drawFrame();

  assert.equal(clips.at(-1), "Attack", "an accepted Assault against a live exposed boss must request its Attack presentation");
  assert.notDeepEqual(
    attackFallback,
    liveFallback,
    "when the boss atlas is unavailable, accepted Assault must still change the Canvas fallback presentation",
  );
  assert.deepEqual(campaign, campaignBefore, "Assault presentation must not mutate the supplied campaign");
});

test("BattleVisualizer presents authoritative zero boss HP as Defeat and rejects later Attack playback", (t) => {
  const {
    visualizer,
    clips,
    campaign,
    stateAt,
    sync,
    drawFrame,
    assault,
  } = makeCanvasBossPresentationHarness(t);
  const campaignBefore = structuredClone(campaign);
  const zeroState = stateAt(0);
  const zeroStateBefore = structuredClone(zeroState);

  sync(stateAt(22));
  const liveFallback = drawFrame();
  visualizer.playActionEffect(assault);
  sync(zeroState);
  const defeatFallback = drawFrame();

  assert.equal(clips.at(-1), "Defeat", "authoritative zero boss HP must replace live playback with persistent Defeat");
  assert.notDeepEqual(
    defeatFallback,
    liveFallback,
    "without an atlas, zero boss HP must remain visibly distinct from the live boss fallback",
  );

  visualizer.playActionEffect(assault);
  drawFrame();
  assert.equal(clips.at(-1), "Defeat", "a later Assault effect must never overwrite an already defeated boss presentation");
  assert.deepEqual(zeroState, zeroStateBefore, "defeat presentation must not mutate the supplied zero-health snapshot");
  assert.deepEqual(campaign, campaignBefore, "defeat presentation must not mutate the supplied campaign");
});

test("BattleVisualizer keeps repeated authoritative zero-health sync presentation-idempotent", (t) => {
  const {
    visualizer,
    clips,
    spatialCalls,
    burstCalls,
    campaign,
    stateAt,
    sync,
    drawFrame,
  } = makeCanvasBossPresentationHarness(t);
  const campaignBefore = structuredClone(campaign);
  const zeroState = stateAt(0);
  const zeroStateBefore = structuredClone(zeroState);

  sync(stateAt(22));
  const liveFallback = drawFrame();
  sync(zeroState);
  const firstDefeatPhase = visualizer.bossPhase;
  const defeatFallback = drawFrame();
  const effectsAfterFirstDefeat = {
    actionFx: visualizer.actionFx.length,
    spatial: spatialCalls.length,
    bursts: burstCalls.length,
  };
  assert.equal(clips.at(-1), "Defeat", "the first zero-health sync must establish Defeat before idempotence is evaluated");
  assert.notDeepEqual(defeatFallback, liveFallback, "the atlas-free Defeat frame must differ from the prior live frame");

  sync(zeroState);
  const repeatedDefeatFallback = drawFrame();

  assert.strictEqual(visualizer.bossPhase, firstDefeatPhase, "an identical zero-health sync must preserve the resolved phase instead of restarting it");
  assert.deepEqual(
    {
      actionFx: visualizer.actionFx.length,
      spatial: spatialCalls.length,
      bursts: burstCalls.length,
    },
    effectsAfterFirstDefeat,
    "an identical zero-health sync must not append or replay defeat feedback",
  );
  assert.deepEqual(repeatedDefeatFallback, defeatFallback, "repeated zero-health sync must preserve the same stable Defeat fallback frame");
  assert.deepEqual(zeroState, zeroStateBefore, "repeated defeat sync must not mutate the supplied zero-health snapshot");
  assert.deepEqual(campaign, campaignBefore, "repeated defeat sync must not mutate the supplied campaign");
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

test("reconcileEncounterWave spawns hostiles from the stage's recurringWave template once every authored wave id is exhausted", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};
  visualizer.ctx = {};

  const recurringWave = Object.freeze({
    hostiles: 2,
    hostileHealth: 3,
    breachDamage: 1,
    pattern: "flanker",
    intervalSeconds: 65,
  });
  visualizer.encounter = {
    stageId: "cinder-span",
    config: {
      waves: [{ id: "scout", hostiles: 2, hostileHealth: 1, cleared: true }],
      recurringWave,
    },
    state: { activeWaveId: "recurring-1" },
  };

  visualizer.reconcileEncounterWave("recurring-1");

  assert.equal(visualizer.currentWaveId, "recurring-1", "the recurring wave id (absent from the authored waves array) must still become the tracked active wave");
  assert.equal(visualizer.enemies.length, recurringWave.hostiles, "the renderer must spawn the recurring template's hostile count instead of silently spawning nothing");
  for (const enemy of visualizer.enemies) {
    assert.equal(enemy.hp, recurringWave.hostileHealth, "spawned hostiles must use the recurring template's health, not a default");
    assert.equal(enemy.waveId, "recurring-1", "spawned hostiles must be tagged with the recurring wave id for breach/clear tracking");
  }
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

test("BattleVisualizer emits both same-tick enemy breaches before one wave-clear proposal and never repeats them", (t) => {
  const events = [];
  const visualizer = makeVisualizer(t, {
    options: {
      onEncounterEvent: (event) => events.push(event),
    },
  });
  const encounterState = Object.freeze({ activeWaveId: "scout" });
  visualizer.currentWaveId = "scout";
  visualizer.encounter = {
    stageId: "cinder-span",
    state: encounterState,
  };
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};
  const portal = visualizer.navigation.anchors.portal;
  visualizer.enemies = [
    {
      id: "enemy-alpha",
      x: portal.x,
      y: portal.y,
      hp: 2,
      baseSpeed: 2.4,
      speed: 2.4,
      path: null,
      defeated: false,
      breachVisualized: false,
      radius: 0.42,
    },
    {
      id: "enemy-bravo",
      x: portal.x,
      y: portal.y,
      hp: 2,
      baseSpeed: 2.4,
      speed: 2.4,
      path: null,
      defeated: false,
      breachVisualized: false,
      radius: 0.42,
    },
  ];

  visualizer.updateUnits(0);
  visualizer.updateUnits(0);

  assert.deepEqual(
    events,
    [
      { type: "breach", stageId: "cinder-span", waveId: "scout", enemyId: "enemy-alpha" },
      { type: "breach", stageId: "cinder-span", waveId: "scout", enemyId: "enemy-bravo" },
      { type: "wave-cleared", stageId: "cinder-span", waveId: "scout" },
    ],
    "each enemy must retain array-order identity, both breach proposals must precede the clear, and the next frame must emit nothing",
  );
  assert.deepEqual(
    encounterState,
    { activeWaveId: "scout" },
    "renderer proposals must not mutate the supplied authoritative encounter state",
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

function measureCanvasMobilityTick(t, { mobilityLevel, terrainMultiplier = 1, movementMultiplier = 1 }) {
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
  visualizer.movementMultiplier = movementMultiplier;
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
  const haste = measureCanvasMobilityTick(t, { mobilityLevel: 1, movementMultiplier: 1.25 });

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

  await t.test("a 25% HASTE multiplier accelerates commander movement exactly once", () => {
    assert.equal(
      Number((haste.commander / baseline.commander).toFixed(12)),
      1.25,
      "the Canvas movement path must apply HASTE once rather than ignore or square the campaign multiplier",
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
      kind: "none",
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
      kind: "mixed",
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
      kind: "possessed",
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
      kind: "none",
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
      kind: "shade",
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
      kind: "shade",
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
      kind: "none",
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

function observeCanvasObjectFeedback(t) {
  const calls = { reconciles: [], speech: [], exchanges: [], renders: [], destroys: 0 };
  const originals = {
    reconcile: ObjectFeedbackLayer.prototype.reconcile,
    emitSpeech: ObjectFeedbackLayer.prototype.emitSpeech,
    emitExchange: ObjectFeedbackLayer.prototype.emitExchange,
    render: ObjectFeedbackLayer.prototype.render,
    destroy: ObjectFeedbackLayer.prototype.destroy,
  };
  ObjectFeedbackLayer.prototype.reconcile = function reconcile(objects, options) {
    calls.reconciles.push({
      objects: objects.map(({ id, kind, hp, maxHp }) => ({ id, kind, hp, maxHp })),
      options: { ...options },
    });
    return originals.reconcile.call(this, objects, options);
  };
  ObjectFeedbackLayer.prototype.emitSpeech = function emitSpeech(objectId, text, options) {
    calls.speech.push({ objectId, text });
    return originals.emitSpeech.call(this, objectId, text, options);
  };
  ObjectFeedbackLayer.prototype.emitExchange = function emitExchange(sourceId, targetId, value, type, options) {
    calls.exchanges.push({ sourceId, targetId, value, type });
    return originals.emitExchange.call(this, sourceId, targetId, value, type, options);
  };
  ObjectFeedbackLayer.prototype.render = function render(projector, now) {
    calls.renders.push({ projector: typeof projector, now });
  };
  ObjectFeedbackLayer.prototype.destroy = function destroy() {
    calls.destroys += 1;
    return originals.destroy.call(this);
  };
  t.after(() => {
    Object.assign(ObjectFeedbackLayer.prototype, originals);
  });
  return calls;
}

function makeSharedFeedbackCanvas() {
  const context = { clearRect() {} };
  return {
    clientWidth: 320,
    clientHeight: 180,
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 320, height: 180 }),
  };
}

test("BattleVisualizer object feedback mirrors authoritative actors, live deltas, frame projection, and lifecycle", (t) => {
  const calls = observeCanvasObjectFeedback(t);
  const feedbackCanvas = makeSharedFeedbackCanvas();
  const visualizer = makeVisualizer(t, { options: { feedbackCanvas } });
  visualizer.ctx = {
    clearRect() {},
    fillRect() {},
    fillStyle: "",
  };
  visualizer.view = { width: 320, height: 180, scale: 1, offsetX: 0, offsetY: 0 };
  visualizer.bridgeTerrainPlacement = () => null;
  visualizer.buildDynamicDrawRecords = () => [];
  visualizer.drawHoverAndPlacementIndicators = () => {};
  visualizer.reconcileAllies = () => {};
  visualizer.reconcileEncounterWave = () => {};
  visualizer.commander = {
    id: "commander",
    x: 2,
    y: 3,
    hp: 10,
    maxHealth: 10,
    defeated: false,
  };
  const ally = {
    id: "ally-live",
    x: 3,
    y: 4,
    hp: 2,
    maxHealth: 3,
    defeated: false,
  };
  const enemy = {
    id: "enemy-live",
    x: 7,
    y: 4,
    hp: 4,
    maxHealth: 4,
    defeated: false,
    breachVisualized: false,
  };
  visualizer.allies = [ally];
  visualizer.enemies = [enemy];
  visualizer.deployments = [{ id: "tower-live", kind: "tower", x: 5, y: 5, hp: 4, maxHp: 4 }];

  const campaign = Object.freeze({
    stageId: "feedback-stage",
    stage: Object.freeze({
      legion: 1,
      nodes: 0,
      bossHealth: 12,
      bossMaxHealth: 12,
      deployments: Object.freeze([
        Object.freeze({ id: "tower-live", kind: "tower", cell: Object.freeze({ x: 5, y: 5 }), hp: 4, maxHp: 4 }),
      ]),
    }),
  });
  const campaignBefore = structuredClone(campaign);

  visualizer.applyCampaignState({ campaign });
  visualizer.applyCampaignState({ campaign });
  visualizer.currentWaveId = "wave-live";
  visualizer.encounter = {
    stageId: "feedback-stage",
    state: { activeWaveId: "wave-live" },
  };
  visualizer.pendingEncounterEvent = null;
  visualizer.emitEncounterEvent("breach");

  enemy.hp = 2;
  ally.hp = 3;
  visualizer.render();
  visualizer.destroy();
  visualizer.destroy();

  const reconciledIds = calls.reconciles.at(-1)?.objects.map(({ id }) => id).sort() ?? [];
  const deltaValues = calls.exchanges
    .map(({ targetId, value, type }) => ({ targetId, value, type }))
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
  assert.deepEqual(
    {
      reconciledIds,
      silentReconciles: calls.reconciles.map(({ options }) => options?.silent === true),
      speech: calls.speech,
      deltaValues,
      renders: calls.renders.map(({ projector }) => projector),
      destroys: calls.destroys,
      campaign,
    },
    {
      reconciledIds: ["ally-live", "boss", "commander", "enemy-live", "tower-live"],
      silentReconciles: [true, true],
      speech: [{ objectId: "commander", text: "Breach detected" }],
      deltaValues: [
        { targetId: "ally-live", value: 1, type: "heal" },
        { targetId: "enemy-live", value: 2, type: "outgoing" },
      ],
      renders: ["function"],
      destroys: 1,
      campaign: campaignBefore,
    },
    "the Canvas renderer must use one presentation-only feedback layer without replaying identical campaign snapshots",
  );
});

test("BattleVisualizer updates the existing commander focus feedback record from its callback", (t) => {
  let focus = Object.freeze({ energy: 1, maxEnergy: 4, resourceKind: "focus" });
  const visualizer = makeVisualizer(t, {
    options: {
      feedbackCanvas: makeSharedFeedbackCanvas(),
      getCommanderReadiness: () => focus,
    },
  });
  visualizer.commander = {
    id: "commander",
    x: 2,
    y: 3,
    hp: 10,
    maxHealth: 10,
    defeated: false,
  };
  let reconciles = 0;
  const reconcile = visualizer.objectFeedback.reconcile.bind(visualizer.objectFeedback);
  visualizer.objectFeedback.reconcile = (objects, options) => {
    reconciles += 1;
    return reconcile(objects, options);
  };

  visualizer.syncObjectFeedback();
  const feedback = visualizer.objectFeedback.objects.get("commander");
  focus = Object.freeze({ energy: 4, maxEnergy: 4, resourceKind: "focus" });
  visualizer.ctx = { clearRect() {}, fillRect() {}, fillStyle: "" };
  visualizer.view = { width: 320, height: 180, scale: 1, offsetX: 0, offsetY: 0 };
  visualizer.bridgeTerrainPlacement = () => null;
  visualizer.buildDynamicDrawRecords = () => [];
  visualizer.drawActionRangeRing = () => {};
  visualizer.drawHoverAndPlacementIndicators = () => {};
  visualizer.objectFeedback.render = () => {};

  visualizer.render();

  assert.equal(reconciles, 1, "canvas focus updates must not trigger another structural reconcile");
  assert.strictEqual(
    visualizer.objectFeedback.objects.get("commander"),
    feedback,
    "canvas focus updates must retain the existing feedback object",
  );
  assert.deepEqual(
    {
      energy: feedback.energy,
      maxEnergy: feedback.maxEnergy,
      resourceKind: feedback.resourceKind,
    },
    { energy: 4, maxEnergy: 4, resourceKind: "focus" },
    "canvas fallback frames must publish the callback's latest commander focus resource",
  );
});

test("[PS-001] Mouse movement and proximity gate world actions until the commander reaches their anchor", (t) => {
  const visualizer = makeVisualizer(t, { presentation: { stageNumber: 1 } });

  const materializeAtSpawn = visualizer.getCommandReadiness({ action: "materialize" });
  assert.equal(
    materializeAtSpawn.ready,
    true,
    "materialize is anchored at the portal, where the commander spawns, so it starts in range",
  );

  const huntFromSpawn = visualizer.getCommandReadiness({ action: "hunt" });
  assert.equal(huntFromSpawn.ready, false, "hunt is anchored at the distant extractor and must reject an out-of-range commander");
  assert.equal(huntFromSpawn.reason, "out-of-range");
  assert.ok(huntFromSpawn.distance > huntFromSpawn.required, "the reported distance must exceed the interaction radius it was measured against");

  const extractorAnchor = visualizer.navigation.anchors.extractor;
  visualizer.commanderPosition.x = extractorAnchor.x;
  visualizer.commanderPosition.y = extractorAnchor.y;
  const huntAtExtractor = visualizer.getCommandReadiness({ action: "hunt" });
  assert.equal(huntAtExtractor.ready, true, "walking the commander to the extractor must bring Hunt into range");
});

test("BattleVisualizer drawActionRangeRing projects the same ACTION_INTERACTION_RADIUS as getCommandReadiness and brightens only when an action is actually in range", (t) => {
  const visualizer = makeVisualizer(t, { presentation: { stageNumber: 1 } });
  const strokeStyles = [];
  visualizer.ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokeStyles.push(this.strokeStyle);
    },
    set strokeStyle(value) {
      this._strokeStyle = value;
    },
    get strokeStyle() {
      return this._strokeStyle;
    },
  };
  visualizer.getAvailableActions = () => ["hunt"];

  visualizer.drawActionRangeRing();
  assert.equal(strokeStyles.length, 1, "the ring must be drawn once per call");
  const [dimStroke] = strokeStyles;

  const extractorAnchor = visualizer.navigation.anchors.extractor;
  visualizer.commanderPosition.x = extractorAnchor.x;
  visualizer.commanderPosition.y = extractorAnchor.y;
  visualizer.drawActionRangeRing();

  assert.notEqual(
    strokeStyles[1],
    dimStroke,
    "walking Hunt's anchor into range must change the ring's stroke from its dim out-of-range reading",
  );
});

test("BattleVisualizer emits exact chest events for mouse and touch and clears field presentation state on reconciliation and destroy", (t) => {
  const canvas = makePointerCanvas();
  const encounterEvents = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    presentation: { stageNumber: 1 },
    options: {
      onEncounterEvent(event) {
        encounterEvents.push(event);
      },
    },
  });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();

  const applyChest = (id, itemId, activeEffects) => {
    visualizer.applyCampaignState({
      campaign: {
        stageId: "cinder-span",
        stage: {
          pendingChest: { id, itemId },
          activeEffects,
        },
      },
      stage: { id: "cinder-span" },
    });
    return visualizer.project(visualizer.chestTile.x + 0.5, visualizer.chestTile.y + 0.5, 0);
  };

  const mouseTarget = applyChest("chest-scout", "void-blade", [{ type: "ATTACK", value: 2, charges: 2 }]);
  clickCanvasTarget(canvas, mouseTarget);
  clickCanvasTarget(canvas, mouseTarget);
  assert.deepEqual(encounterEvents, [{
    type: "open-chest",
    stageId: "cinder-span",
    chestId: "chest-scout",
  }], "a held campaign chest must emit once even if the mouse clicks it twice before state reconciliation");

  visualizer.applyCampaignState({
    campaign: { stageId: "cinder-span", stage: { pendingChest: null, activeEffects: [] } },
    stage: { id: "cinder-span" },
  });
  assert.equal(visualizer.pendingChest, null);
  assert.equal(visualizer.chestTile, null);
  assert.deepEqual(visualizer.activeEffects, []);

  const touchTarget = applyChest("chest-guard", "iron-resolve", [{ type: "DEFENSE", value: 1, charges: 3 }]);
  canvas.dispatch("pointerdown", { ...touchTarget, pointerId: 2, pointerType: "touch" });
  canvas.dispatch("pointerup", { ...touchTarget, pointerId: 2, pointerType: "touch" });
  assert.deepEqual(encounterEvents.at(-1), {
    type: "open-chest",
    stageId: "cinder-span",
    chestId: "chest-guard",
  });

  visualizer.destroy();
  assert.equal(canvas.listeners.size, 0, "destroy must detach every Canvas field interaction listener");
  assert.equal(visualizer.pendingChest, null);
  assert.deepEqual(visualizer.activeEffects, []);
});

test("BattleVisualizer setRenderingPaused(true) cancels the pending animation frame without needing document.hidden", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let nextFrameId = 900;
  const scheduled = [];
  const cancelled = [];
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrameId;
    scheduled.push(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
  });

  const visualizer = makeVisualizer(t, {});
  visualizer.animationFrameId = 501; // simulates an already-scheduled frame from init()'s animate()

  visualizer.setRenderingPaused(true);

  assert.deepEqual(cancelled, [501], "pausing while the tab is still visible must cancel the exact pending animation frame handle");
  assert.equal(visualizer.animationFrameId, null, "pausing must clear the stored animation frame handle to a falsy state");
  assert.equal(visualizer.externallyPaused, true, "pausing must record the external pause flag");
  assert.deepEqual(scheduled, [], "pausing must not schedule any new animation frame");
});

test("BattleVisualizer setRenderingPaused(false) after a prior pause restarts the animate loop while not destroyed", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let nextFrameId = 900;
  const scheduled = [];
  const cancelled = [];
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrameId;
    scheduled.push(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
  });

  const visualizer = makeVisualizer(t, {});
  visualizer.animationFrameId = 501;

  visualizer.setRenderingPaused(true);
  assert.equal(visualizer.animationFrameId, null, "the loop must already be stopped before the restart is exercised");

  visualizer.setRenderingPaused(false);

  assert.deepEqual(scheduled, [901], "unpausing a non-destroyed instance must schedule exactly one successor frame via animate()");
  assert.equal(visualizer.animationFrameId, 901, "unpausing must store the freshly scheduled animation frame handle");
  assert.equal(visualizer.externallyPaused, false, "unpausing must clear the external pause flag");
});

test("BattleVisualizer stays paused through a hidden/visible visibility round-trip while externally paused", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const documentListeners = new Map();
  globalThis.document = {
    hidden: false,
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (documentListeners.get(type) === listener) documentListeners.delete(type);
    },
  };
  let nextFrameId = 900;
  const scheduled = [];
  const cancelled = [];
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrameId;
    scheduled.push(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
  });

  const visualizer = makeVisualizer(t, {});
  assert.equal(documentListeners.has("visibilitychange"), true, "constructing the visualizer must register its own visibility handler");
  visualizer.animationFrameId = 501;

  visualizer.setRenderingPaused(true);
  assert.equal(visualizer.animationFrameId, null, "the mobile rotate-device overlay path must have stopped the loop before the tab visibility cycle begins");

  // The overlay stays up (still externally paused) while the player switches
  // tabs and comes back -- this is the exact regression the fix targets.
  globalThis.document.hidden = true;
  documentListeners.get("visibilitychange")();
  assert.equal(visualizer.animationFrameId, null, "going hidden while externally paused must leave the already-stopped loop alone");

  globalThis.document.hidden = false;
  documentListeners.get("visibilitychange")();

  assert.equal(visualizer.animationFrameId, null, "returning to a visible tab must NOT resume rendering while the external pause is still active");
  assert.deepEqual(scheduled, [], "the external pause must survive the visibility round-trip without a new animation frame ever being scheduled");
  assert.deepEqual(cancelled, [501], "no animation frame handle beyond the original pause-time cancellation should ever need cancelling");
  assert.equal(visualizer.externallyPaused, true, "the external pause flag itself must remain set across the visibility cycle");
});

test("BattleVisualizer setRenderingPaused(false) with no prior pause is a safe no-op that does not double-schedule a running loop", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let nextFrameId = 900;
  const scheduled = [];
  const cancelled = [];
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrameId;
    scheduled.push(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
  });

  const visualizer = makeVisualizer(t, {});
  visualizer.animationFrameId = 501; // already actively rendering, e.g. from init()'s animate()

  visualizer.setRenderingPaused(false);

  assert.equal(visualizer.animationFrameId, 501, "an already-running instance must keep its existing animation frame handle untouched");
  assert.deepEqual(scheduled, [], "unpausing an instance that was never externally paused must not schedule a second, competing frame");
  assert.deepEqual(cancelled, [], "unpausing an instance that was never paused must not cancel anything");
  assert.equal(visualizer.externallyPaused, false, "the external pause flag must remain false");
});

test("BattleVisualizer setRenderingPaused(true) then setRenderingPaused(false) resets timing state so the next animate() tick does not compute a huge elapsed-time jump", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const priorPerformance = globalThis.performance;
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let nowValue = 1000;
  globalThis.performance = { now: () => nowValue };
  let nextFrameId = 900;
  const scheduled = [];
  const cancelled = [];
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrameId;
    scheduled.push(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
    if (priorPerformance === undefined) delete globalThis.performance;
    else globalThis.performance = priorPerformance;
  });

  const visualizer = makeVisualizer(t, {});
  const updateUnitsCalls = [];
  const updateParticlesCalls = [];
  visualizer.updateUnits = (dt) => updateUnitsCalls.push(dt);
  visualizer.updateParticles = (dt) => updateParticlesCalls.push(dt);
  visualizer.animationFrameId = 501;
  visualizer.lastTime = nowValue;
  visualizer.timeAccumulator = 0.02; // a leftover fixed-step remainder from before the pause
  visualizer.droppedTime = 0;

  visualizer.setRenderingPaused(true);
  assert.equal(visualizer.animationFrameId, null, "rendering must actually be paused (raf cancelled) before the resume gap is simulated");

  // Simulate the portrait "rotate your device" overlay staying up for five
  // real seconds while the render loop is fully stopped.
  nowValue += 5000;

  visualizer.setRenderingPaused(false);

  assert.deepEqual(scheduled, [901], "resuming must schedule exactly one successor animate() frame");
  assert.equal(visualizer.lastTime, nowValue, "the resumed tick must resync lastTime to the resume timestamp instead of the stale pre-pause value");
  assert.equal(visualizer.timeAccumulator, 0, "the resumed tick must not carry the pre-pause fixed-step remainder into a post-pause elapsed-time computation");
  assert.equal(visualizer.droppedTime, 0, "the five-second pause gap must not be counted as dropped simulation time");
  assert.deepEqual(updateUnitsCalls, [], "the resumed tick must not run any catch-up unit simulation steps for time that only elapsed because rendering was paused");
  assert.deepEqual(updateParticlesCalls, [], "the resumed tick must not run any catch-up particle steps for time that only elapsed because rendering was paused");
});
