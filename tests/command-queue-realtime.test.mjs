import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { BattleVisualizer } from "../battle-visualizer.js";
import { RealtimeBattle } from "../battle-realtime-three.js";
import {
  createCampaign,
  executeReservedCommand as executeReservedCommandReducer,
  reserveCommand as reserveCommandReducer,
  startCampaign,
} from "../campaign-state.js";

function campaignAtStageOne() {
  const result = startCampaign(createCampaign());
  assert.equal(result.accepted, true, result.message);
  return result.state;
}

function scanFunction(source, start) {
  const bodyHeader = source.slice(start).match(/\)\s*\{/);
  assert.ok(bodyHeader, "function declaration must have a body");
  const open = start + bodyHeader.index + bodyHeader[0].lastIndexOf("{");
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail("function declaration must close its body");
}

function topLevelFunctions(source) {
  const definitions = new Map();
  const declaration = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  for (const match of source.matchAll(declaration)) {
    definitions.set(match[1], scanFunction(source, match.index));
  }
  return definitions;
}

function executableClosure(definitions, entries, externalNames) {
  const selected = new Set();
  const visit = (name) => {
    if (selected.has(name) || externalNames.has(name)) return;
    const definition = definitions.get(name);
    assert.ok(definition, `app runtime must expose ${name}`);
    assert.doesNotThrow(
      () => new vm.Script(definition, { filename: `app.js#${name}` }),
      `source extraction must recover a complete ${name} declaration`,
    );
    selected.add(name);
    for (const call of definition.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (definitions.has(call[1])) visit(call[1]);
    }
  };
  entries.forEach(visit);
  return [...selected].map((name) => definitions.get(name)).join("\n\n");
}

function makeTimers() {
  let nextId = 1;
  const tasks = [];
  return {
    tasks,
    setTimeout(callback, delay = 0) {
      const task = { id: nextId++, callback, delay, cancelled: false, ran: false };
      tasks.push(task);
      return task.id;
    },
    get now() {
      return tasks.reduce((elapsed, task) => task.ran && !task.cancelled ? elapsed + task.delay : elapsed, 5000);
    },
    clearTimeout(id) {
      const task = tasks.find((candidate) => candidate.id === id);
      if (task) task.cancelled = true;
    },
    async runUntil(predicate) {
      for (let cursor = 0; cursor < tasks.length && cursor < 32 && !predicate(); cursor += 1) {
        const task = tasks[cursor];
        if (task.cancelled || task.ran) continue;
        task.ran = true;
        await task.callback();
        await Promise.resolve();
      }
      assert.equal(predicate(), true, "scheduled command work must reach the expected observable state");
    },
    async runAll() {
      for (let cursor = 0; cursor < tasks.length && cursor < 32; cursor += 1) {
        const task = tasks[cursor];
        if (task.cancelled || task.ran) continue;
        task.ran = true;
        await task.callback();
        await Promise.resolve();
      }
    },
  };
}

async function loadAppQueueRuntime({ campaign = campaignAtStageOne(), includeFallback = false } = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const definitions = topLevelFunctions(source);
  const timers = makeTimers();
  const timeline = [];
  const events = [];
  const renderers = [];
  let requestSequence = 0;

  class FakeBattleVisualizer {
    constructor(_canvas, _presentation, options) {
      this.options = options;
      this.destroyed = false;
      this.previewed = [];
      this.effects = [];
      renderers.push(this);
    }
    init() {}
    destroy() { this.destroyed = true; }
    setPlacementMode() {}
    applyCampaignState() {}
    applyEncounter() {}
    previewAction(semantic) {
      this.previewed.push(semantic);
      timeline.push(["preview", semantic.action]);
    }
    clearActionPreview() {}
    playActionEffect(semantic) { this.effects.push(semantic); }
  }

  const context = vm.createContext({
    BATTLE_ACTION_SEMANTICS: Object.freeze({
      hunt: Object.freeze({ action: "hunt", source: "portal", target: "extractor" }),
      extract: Object.freeze({ action: "extract", source: "extractor", target: "portal" }),
    }),
    BattleVisualizer: FakeBattleVisualizer,
    EMPTY_RENDERER_SELECTION: Object.freeze({ count: 0, total: 0, health: 0, maxHealth: 0, possessed: 0, engaged: 0, moving: 0, order: "none" }),
    activeCommandFocusAction: null,
    activeCommandHoverAction: null,
    activeFieldFocusedAction: null,
    activePlacementMode: null,
    applyAction() {
      assert.fail("real-time handleAction must not bypass the reservation queue through applyAction");
    },
    applyEncounterEvent() {
      assert.fail("real-time handleAction must not bypass the reservation queue through encounter mutation");
    },
    armEncounterWhenPrepared: () => timeline.push(["arm"]),
    battleSessionId: 21,
    battleStartedAt: 0,
    battleStarting: false,
    battleUiActive: () => true,
    battleVisualFallback: false,
    campaign,
    checkReservedCommandExecution: () => ({ ready: true, message: "" }),
    clearEncounterStartTimer: () => {},
    commandExecutionTimer: 0,
    commandQueueTimer: 0,
    commandRequestSequence: 0,
    commandRequestIds: new Set(),
    completedCommandRequestIds: new Set(),
    cooldownTimer: 1,
    cooldowns: new Map(),
    createCommandRequestId: () => `app-request-${++requestSequence}`,
    crypto: { randomUUID: () => `uuid-${++requestSequence}` },
    currentLang: () => "en",
    currentEncounter: () => null,
    currentStage: () => ({ id: "cinder-span", commands: { hunt: {}, extract: {} }, encounter: null, bossHealth: 10 }),
    elements: { battleFallbackCanvas: {} },
    encounterEventQueue: Promise.resolve(),
    executeReservedCommand(state, id) {
      const queued = state.commandQueue.find((item) => item.id === id);
      timeline.push(["execute", id, queued?.action]);
      return executeReservedCommandReducer(state, id);
    },
    getAvailableActions: () => ["hunt", "extract"],
    getCampaignBenefits: () => ({ maxIntegrity: 10 }),
    getInteractiveBattleActions: () => ["hunt", "extract"],
    getTacticalProgression: (state) => ({ commandQueue: state.commandQueue }),
    handleActionFocus: () => {},
    handleRendererRuntime: () => {},
    handleRendererSelection: () => {},
    handleTacticalRequest: () => {},
    lastScrolledStageId: null,
    lastCheckedSignature: "",
    minimapFailed: false,
    pendingBattleRenderer: null,
    COMMAND_ACK_MIN_MS: 250,
    COMMAND_DUPLICATE_WINDOW_MS: 250,
    COMMAND_QUEUE_TICK_MS: 100,
    COMMAND_RENDERER_ACK_TIMEOUT_MS: 750,
    pendingCommandFocus: false,
    performance: { now: () => timers.now },
    persistCampaign: async () => timeline.push(["persist"]),
    playCue: () => {},
    projectActionFocus: () => {},
    remainingCooldown: () => 0,
    render: () => timeline.push(["render"]),
    renderBattleAssetStatus: () => {},
    renderBattlePresentation: () => ({}),
    rendererRuntime: null,
    rendererSelectionSummary: {},
    reserveCommand(state, action, id) {
      timeline.push(["reserve", action, id]);
      return reserveCommandReducer(state, action, id);
    },
    resultOverlayOpen: false,
    showTacticalFeedback: () => {},
    startActionCooldown: (action) => timeline.push(["cooldown", action]),
    stopBattleAudio: () => {},
    syncBgmScene: () => {},
    syncMinimap: () => {},
    synchronizeBattleRenderer: undefined,
    tacticalFeedbackMessage: "",
    queuedCommandRuntime: new Map(),
    seenCommandRequests: new Map(),
    tacticalFeedbackTimer: 0,
    translate: (key) => key,
    translateRejectionReason: (message) => message,
    translateStatusMessage: (message) => message,
    triggerBattleVisual: (action) => timeline.push(["effect", action]),
    visualizer: null,
    window: {
      CustomEvent: class {
        constructor(type, options) {
          this.type = type;
          this.detail = options.detail;
        }
      },
      clearInterval: () => {},
      clearTimeout: (id) => timers.clearTimeout(id),
      dispatchEvent: (event) => events.push(event),
      setTimeout: (callback, delay) => timers.setTimeout(callback, delay),
    },
  });

  const externalNames = new Set(Object.keys(context));
  externalNames.delete("synchronizeBattleRenderer");
  const entries = [
    "normalizeCommandRequest",
    "handleAction",
    "enqueueCommandRequest",
    "handleRendererCommandRequest",
    "syncCommandRuntimeFromCampaign",
    "syncQueuedCommandPreview",
    "scheduleCommandQueueDrain",
    "drainCommandQueue",
    "evaluateQueuedCommandReadiness",
    "executeQueuedCommandIfReady",
    "setQueuedCommandPhase",
    "dropQueuedCommandRuntime",
    "clearCommandQueueRuntime",
    "synchronizeBattleRenderer",
  ];
  if (includeFallback) entries.push("activateBattleFallback", "stopBattle");
  const executable = executableClosure(definitions, entries, externalNames);
  vm.runInContext(
    `${executable}\nglobalThis.queueRuntime = { normalizeCommandRequest, handleAction, enqueueCommandRequest, handleRendererCommandRequest, syncCommandRuntimeFromCampaign, syncQueuedCommandPreview, scheduleCommandQueueDrain, drainCommandQueue, evaluateQueuedCommandReadiness, executeQueuedCommandIfReady, setQueuedCommandPhase, dropQueuedCommandRuntime, clearCommandQueueRuntime, synchronizeBattleRenderer, ${includeFallback ? "activateBattleFallback, stopBattle," : ""} };`,
    context,
    { filename: "app.js" },
  );

  return { context, events, renderers, timeline, timers };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function commandEvents(events) {
  return events.filter((event) => event.type === "abyssal:command-resolved");
}

test("handleAction reserves before scheduled execution and starts cooldown only for the accepted execution", async () => {
  const fixture = await loadAppQueueRuntime();

  await fixture.context.queueRuntime.handleAction("hunt");

  assert.equal(fixture.timeline[0][0], "reserve", "the primary command path must make reservation its first authoritative mutation");
  assert.equal(fixture.timeline.some(([event]) => event === "execute"), false, "reservation must remain observable before scheduled execution runs");
  assert.equal(fixture.timeline.some(([event]) => event === "cooldown"), false, "reservation alone must not consume the command cooldown");
  assert.equal(fixture.context.campaign.commandQueue.length, 1, "the reducer-owned queue must retain the request until execution");

  await fixture.timers.runUntil(() => fixture.timeline.some(([event]) => event === "execute"));
  const reservation = fixture.timeline.find(([event]) => event === "reserve");
  const execution = fixture.timeline.find(([event]) => event === "execute");
  assert.equal(execution[1], fixture.context.campaign.trace.find((entry) => entry.kind === "execute-reserved-command")?.id, "scheduled execution must consume the reducer-authorized reservation ID");
  assert.equal(reservation[1], "hunt");
  assert.deepEqual(
    fixture.timeline.filter(([event]) => event === "cooldown"),
    [["cooldown", "hunt"]],
    "an accepted reserved execution must begin exactly its own cooldown",
  );
});
test("the scheduler executes the reducer queue head and previews it without treating presentation as execution", async () => {
  const first = reserveCommandReducer(campaignAtStageOne(), "hunt", "authoritative-head");
  assert.equal(first.accepted, true, first.message);
  const fixture = await loadAppQueueRuntime({ campaign: first.state });
  const renderer = new (class {
    constructor() { this.previewed = []; }
    applyCampaignState() {}
    applyEncounter() {}
    previewAction(semantic) {
      this.previewed.push(semantic);
      fixture.timeline.push(["preview", semantic.action]);
    }
  })();
  fixture.context.visualizer = renderer;

  await fixture.context.queueRuntime.handleAction("extract");
  await fixture.timers.runUntil(() => renderer.previewed.length > 0);

  assert.equal(fixture.timeline.some(([event]) => event === "execute"), false, "projecting a queued command must not mutate campaign state");
  assert.deepEqual(
    {
      commandId: renderer.previewed.at(-1)?.commandId,
      action: renderer.previewed.at(-1)?.action,
      phase: renderer.previewed.at(-1)?.phase,
      queueIndex: renderer.previewed.at(-1)?.queueIndex,
      source: renderer.previewed.at(-1)?.source,
      target: renderer.previewed.at(-1)?.target,
      queuedAt: renderer.previewed.at(-1)?.queuedAt,
    },
    {
      commandId: "authoritative-head",
      action: "hunt",
      phase: fixture.context.queuedCommandRuntime.get("authoritative-head").phase,
      queueIndex: 0,
      source: "portal",
      target: "extractor",
      queuedAt: fixture.context.queuedCommandRuntime.get("authoritative-head").queuedAt,
    },
    "the presentation-only preview must identify the reducer-authoritative queue head and preserve its combat semantic",
  );
  assert.deepEqual(fixture.context.campaign.commandQueue.map(({ id, action }) => ({ id, action })), [
    { id: "authoritative-head", action: "hunt" },
    { id: fixture.context.campaign.commandQueue[1].id, action: "extract" },
  ]);

  await fixture.timers.runUntil(() => fixture.timeline.some(([event]) => event === "execute"));
  const execution = fixture.timeline.find(([event]) => event === "execute");
  assert.deepEqual(execution.slice(1), ["authoritative-head", "hunt"], "scheduled execution must consume the queue head by its reducer-owned ID and action");
});

test("rejected reserved execution leaves cooldown untouched and resolves the legacy event as rejected", async () => {
  const fixture = await loadAppQueueRuntime();
  fixture.context.executeReservedCommand = (state, id) => {
    fixture.timeline.push(["execute", id, "hunt"]);
    return { accepted: false, state, effect: "none", message: "Execution failed: blocked." };
  };

  await fixture.context.queueRuntime.handleAction("hunt");
  await fixture.timers.runUntil(() => commandEvents(fixture.events).length === 1);

  assert.equal(fixture.timeline.some(([event]) => event === "cooldown"), false, "a rejected execution must not begin cooldown");
  const resolved = commandEvents(fixture.events);
  assert.equal(resolved.length, 1, "one request must publish one legacy resolution");
  assert.deepEqual(
    {
      id: resolved[0].detail.id,
      action: resolved[0].detail.action,
      accepted: resolved[0].detail.accepted,
      phase: resolved[0].detail.phase,
      message: resolved[0].detail.message,
      revision: resolved[0].detail.revision,
    },
    {
      id: fixture.context.campaign.commandQueue[0].id,
      action: "hunt",
      accepted: false,
      phase: "rejected",
      message: "Execution failed: blocked.",
      revision: fixture.context.campaign.revision,
    },
    "rejected execution must preserve legacy fields and identify the queue resolution",
  );
});

test("accepted reserved execution retains legacy command-resolved action and accepted fields", async () => {
  const fixture = await loadAppQueueRuntime();

  await fixture.context.queueRuntime.handleAction("hunt");
  await fixture.timers.runUntil(() => commandEvents(fixture.events).length === 1);

  const resolved = commandEvents(fixture.events);
  assert.equal(resolved.length, 1, "one accepted request must publish one resolution");
  const executedTrace = fixture.context.campaign.trace.find((entry) => entry.kind === "execute-reserved-command");
  assert.deepEqual(
    {
      id: resolved[0].detail.id,
      action: resolved[0].detail.action,
      accepted: resolved[0].detail.accepted,
      phase: resolved[0].detail.phase,
      message: resolved[0].detail.message,
      revision: resolved[0].detail.revision,
    },
    {
      id: executedTrace.id,
      action: "hunt",
      accepted: true,
      phase: "executed",
      message: fixture.context.campaign.lastMessage,
      revision: fixture.context.campaign.revision,
    },
    "accepted execution must preserve legacy fields and identify the reducer transition",
  );
});

test("both renderers emit normalized command-request payloads with their mode and unique IDs", (t) => {
  const threeRequests = [];
  const canvas = {
    hasPointerCapture: () => false,
    releasePointerCapture() {},
    style: {},
  };
  const three = new RealtimeBattle(canvas, { stageNumber: 1 }, { onActionRequest: (request) => threeRequests.push(request) });
  three.updateMarqueeVisual = () => {};
  three.resolvePointerAction = () => "hunt";
  three.setHoveredAction = () => {};
  const originalArgv = [...process.argv];
  process.argv.splice(0, process.argv.length, "node", "game-runtime");
  try {
    for (const pointerId of [1, 2]) {
      three.pointer = { id: pointerId, moved: false, mode: "select", downTime: 0, type: "mouse" };
      three.onPointerUp({ pointerId, pointerType: "mouse", clientX: 33, clientY: 44, timeStamp: 10 });
    }
  } finally {
    process.argv.splice(0, process.argv.length, ...originalArgv);
  }

  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const fallbackRequests = [];
  const fallback = new BattleVisualizer({}, {}, { onActionRequest: (request) => fallbackRequests.push(request) });
  fallback.tacticalActionAt = () => "extract";
  fallback.requestTacticalActionAt({ x: 1, y: 1 });
  fallback.requestTacticalActionAt({ x: 1, y: 1 });

  for (const [name, requests, action, rendererMode] of [
    ["WebGL", threeRequests, "hunt", "realtime-3d"],
    ["fallback", fallbackRequests, "extract", "canvas-2d"],
  ]) {
    assert.deepEqual(requests.map(({ type, action: requestedAction, source, rendererMode: mode }) => ({
      type,
      action: requestedAction,
      source,
      rendererMode: mode,
    })), [
      { type: "command-request", action, source: "renderer-pointer", rendererMode },
      { type: "command-request", action, source: "renderer-pointer", rendererMode },
    ], `${name} callbacks must normalize the command and identify their presentation source`);
    assert.equal(new Set(requests.map((request) => request.requestId)).size, 2, `${name} callbacks must assign a unique ID to each user request`);
    assert.equal(requests.every((request) => Number.isFinite(request.occurredAt)), true, `${name} callbacks must timestamp each normalized request`);
  }
});

test("app renderer callbacks reject stale sessions, wrong sources, and duplicate request IDs", async () => {
  const fixture = await loadAppQueueRuntime({ includeFallback: true });
  const stage = fixture.context.currentStage();
  const valid = fixture.context.queueRuntime.activateBattleFallback(stage, 21);
  fixture.context.visualizer = valid;
  const duplicate = { type: "command-request", action: "hunt", requestId: "renderer-request-7", source: "renderer-pointer", rendererMode: "canvas-2d", occurredAt: 5000 };

  valid.options.onActionRequest(duplicate);
  await settle();
  valid.options.onActionRequest(duplicate);
  await settle();

  const validReservations = fixture.timeline.filter(([event]) => event === "reserve");
  assert.equal(validReservations.length, 1, "a renderer request ID may reserve at most once");

  const staleSession = fixture.context.queueRuntime.activateBattleFallback(stage, 20);
  staleSession.options.onActionRequest({ type: "command-request", action: "hunt", requestId: "stale-session", source: "renderer-pointer", rendererMode: "canvas-2d", occurredAt: 5000 });
  const wrongSource = fixture.context.queueRuntime.activateBattleFallback(stage, 21);
  wrongSource.options.onActionRequest({ type: "command-request", action: "hunt", requestId: "wrong-source", source: "renderer-pointer", rendererMode: "canvas-2d", occurredAt: 5000 });
  await settle();

  assert.equal(fixture.timeline.filter(([event]) => event === "reserve").length, 1, "stale-session and non-active renderer callbacks must not reserve commands");
});

test("battle destroy invalidates queued renderer work before a stale timer can execute it", async () => {
  const fixture = await loadAppQueueRuntime({ includeFallback: true });
  const renderer = fixture.context.queueRuntime.activateBattleFallback(fixture.context.currentStage(), 21);
  fixture.context.visualizer = renderer;

  renderer.options.onActionRequest({ type: "command-request", action: "hunt", requestId: "destroy-before-execute", source: "renderer-pointer", rendererMode: "canvas-2d", occurredAt: 5000 });
  await settle();
  assert.equal(fixture.timeline.filter(([event]) => event === "reserve").length, 1, "the live callback must reserve before teardown");
  assert.equal(fixture.timeline.some(([event]) => event === "execute"), false, "execution must still be pending at teardown");

  fixture.context.queueRuntime.stopBattle();
  await fixture.timers.runAll();
  renderer.options.onActionRequest({ type: "command-request", action: "hunt", requestId: "destroyed-callback", source: "renderer-pointer", rendererMode: "canvas-2d", occurredAt: 5000 });
  await settle();

  assert.equal(fixture.timeline.some(([event]) => event === "execute"), false, "destroy must cancel scheduled execution from the retired renderer session");
  assert.equal(fixture.timeline.filter(([event]) => event === "reserve").length, 1, "a destroyed renderer callback must not reserve new work");
});

test("a command whose renderer target is out of range waits indefinitely, surfaces one tactical hint, and executes once the commander is in range", async () => {
  const fixture = await loadAppQueueRuntime();
  const feedback = [];
  fixture.context.showTacticalFeedback = (msg) => feedback.push(msg);

  let readiness = { ready: false, reason: "out-of-range" };
  fixture.context.visualizer = {
    getCommandReadiness: () => readiness,
    applyCampaignState() {},
    applyEncounter() {},
    previewAction() {},
    clearActionPreview() {},
    playActionEffect() {},
  };

  await fixture.context.queueRuntime.handleAction("hunt");
  await fixture.timers.runUntil(() => fixture.timers.now >= 6000);

  assert.equal(
    fixture.timeline.some(([event]) => event === "execute"),
    false,
    "an out-of-range command must never be bypassed by the renderer-ack timeout",
  );
  assert.deepEqual(
    feedback.filter((msg) => msg === "tactical.rejection.outOfRange"),
    ["tactical.rejection.outOfRange"],
    "the out-of-range hint must surface exactly once, not on every poll tick",
  );

  readiness = { ready: true, reason: "ready" };
  await fixture.timers.runUntil(() => fixture.timeline.some(([event]) => event === "execute"));

  assert.deepEqual(
    feedback.filter((msg) => msg === "tactical.rejection.outOfRange"),
    ["tactical.rejection.outOfRange"],
    "returning to range must not repeat the hint",
  );
});
