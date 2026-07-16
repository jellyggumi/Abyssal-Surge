import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(resolve(root, "app.js"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const coreUrl = pathToFileURL(resolve(root, "game-core.js")).href;
const core = await import(coreUrl);
let moduleNonce = 0;

const HOTKEY_GUIDES = Object.freeze([
  Object.freeze({ id: "hotkey-strike", command: "STRIKE", key: "S" }),
  Object.freeze({ id: "hotkey-brace", command: "BRACE", key: "B" }),
  Object.freeze({ id: "hotkey-disrupt", command: "DISRUPT", key: "D" }),
  Object.freeze({ id: "hotkey-recover", command: "RECOVER", key: "R" }),
]);


class FakeElement {
  constructor(document, { id = "", dataset = {}, hidden = false, tagName = "div" } = {}) {
    this.document = document;
    this.id = id;
    this.dataset = dataset;
    this.hidden = hidden;
    this.tagName = tagName.toUpperCase();
    this.textContent = "";
    this.disabled = false;
    this.innerHTML = "";
    this.children = [];
    this.listeners = new Map();
    this.style = {};
    this.parentNode = null;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      contains: (name) => classes.has(name),
    };
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")?.({ currentTarget: this, target: this });
  }

  focus() {
    this.document.activeElement = this;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
    for (const child of children) child.parentNode = this;
  }
}

class FakeStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed));
    this.getCalls = 0;
    this.setCalls = 0;
    this.removeCalls = 0;
  }

  getItem(key) {
    this.getCalls += 1;
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.setCalls += 1;
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.removeCalls += 1;
    this.values.delete(key);
  }
}

function createAudioSpy() {
  const tracks = new Map();
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.volume = 1;
      this.loop = false;
      this.playCalls = 0;
      this.pauseCalls = 0;
      tracks.set(src, this);
    }

    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
    }
  }
  return { Audio: FakeAudio, tracks };
}

function createBrowser({ withWindow = false, storage, includePresentation = false } = {}) {
  const elements = new Map();
  const commandButtons = [];
  const documentListeners = new Map();
  const animationFrames = new Map();
  let nextAnimationFrameId = 1;
  const requestAnimationFrame = (callback) => {
    assert.equal(typeof callback, "function", "Animation frames must queue a callback.");
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  };
  const cancelAnimationFrame = (id) => animationFrames.delete(id);
  const fakeWindow = withWindow
    ? { requestAnimationFrame, cancelAnimationFrame, localStorage: storage }
    : undefined;
  const document = {
    activeElement: { tagName: "BODY" },
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    createElement(tagName) {
      return new FakeElement(document, { tagName });
    },
    querySelector(selector) {
      assert.ok(selector.startsWith("#"), `Unexpected selector: ${selector}`);
      return elements.get(selector.slice(1));
    },
    querySelectorAll(selector) {
      assert.equal(selector, "[data-command]", `Unexpected selector: ${selector}`);
      return commandButtons;
    },
  };
  document.body = new FakeElement(document, { tagName: "body" });
  const add = (id, options) => {
    const element = new FakeElement(document, { id, ...options });
    elements.set(id, element);
    return element;
  };

  add("lobby-screen");
  add("play-screen", { hidden: true });
  add("terminal-screen", { hidden: true });
  add("lobby-title");
  add("play-title");
  add("terminal-title");
  for (const id of [
    "campaign-value",
    "rules-version",
    "intent-value",
    "counter-value",
    "integrity-value",
    "focus-value",
    "guard-value",
    "pressure-value",
    "foe-health-value",
    "trace-log",
    "announcement",
    "terminal-summary",
    "settlement-summary",
    "telemetry-log",
    "terminal-telemetry-log",
    "threat-copy",
    "begin-button",
    "continue-button",
    "restart-button",
    "resume-button",
  ]) add(id, { tagName: id.endsWith("button") ? "button" : "div" });
  add("command-help");
  add("lang-toggle", { tagName: "button" });
  for (const { id } of HOTKEY_GUIDES) add(id);
  if (includePresentation) {
    for (const id of ["audio-toggle", "fx-overlay", "knight-avatar", "void-avatar", "units-container"]) {
      add(id, { tagName: id === "audio-toggle" ? "button" : "div" });
    }
  }
  for (const command of ["STRIKE", "BRACE", "DISRUPT", "RECOVER"]) {
    commandButtons.push(new FakeElement(document, { dataset: { command }, tagName: "button" }));
  }

  const flushAnimationFrames = (timestamps) => {
    for (const timestamp of timestamps) {
      const next = animationFrames.entries().next().value;
      assert.ok(next, "Expected a queued animation frame.");
      const [id, callback] = next;
      animationFrames.delete(id);
      callback(timestamp);
    }
  };

  return {
    window: fakeWindow,
    requestAnimationFrame,
    cancelAnimationFrame,
    flushAnimationFrames,
    pendingAnimationFrames() {
      return animationFrames.size;
    },
    document,
    element(id) {
      const element = elements.get(id);
      assert.ok(element, `Missing #${id} in fake browser.`);
      return element;
    },
    command(command) {
      const button = commandButtons.find((candidate) => candidate.dataset.command === command);
      assert.ok(button, `Missing ${command} control in fake browser.`);
      return button;
    },
    key(key, overrides = {}) {
      const event = {
        key,
        defaultPrevented: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...overrides,
      };
      documentListeners.get("keydown")?.(event);
      return event;
    },
  };
}

function dataModule(source) {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

async function loadApp({ replayOverride, useRealTime = false, storage, includePresentation = false, withAudio = false } = {}) {
  const browser = createBrowser({
    withWindow: useRealTime || Boolean(storage),
    storage,
    includePresentation,
  });
  const replayCalls = [];
  const audio = withAudio ? createAudioSpy() : null;
  const priorDocument = globalThis.document;
  const hadDocument = Object.hasOwn(globalThis, "document");
  const priorRaf = globalThis.requestAnimationFrame;
  const hadRaf = Object.hasOwn(globalThis, "requestAnimationFrame");
  const priorReplaySpy = globalThis.__stage1ReplaySpy;
  const priorCancelRaf = globalThis.cancelAnimationFrame;
  const hadCancelRaf = Object.hasOwn(globalThis, "cancelAnimationFrame");
  const priorWindow = globalThis.window;
  const hadWindow = Object.hasOwn(globalThis, "window");
  const hadReplaySpy = Object.hasOwn(globalThis, "__stage1ReplaySpy");
  const priorReplayOverride = globalThis.__stage1ReplayOverride;
  const hadReplayOverride = Object.hasOwn(globalThis, "__stage1ReplayOverride");
  const priorAudio = globalThis.Audio;
  const hadAudio = Object.hasOwn(globalThis, "Audio");

  globalThis.document = browser.document;
  globalThis.requestAnimationFrame = browser.requestAnimationFrame;
  globalThis.__stage1ReplaySpy = (schedule, inputRecords) => replayCalls.push({ schedule, records: inputRecords });
  globalThis.__stage1ReplayOverride = replayOverride;
  globalThis.cancelAnimationFrame = browser.cancelAnimationFrame;
  if (withAudio) globalThis.Audio = audio.Audio;
  else delete globalThis.Audio;
  if (useRealTime || storage) globalThis.window = browser.window;
  else delete globalThis.window;

  const proxySource = `
    import * as core from ${JSON.stringify(coreUrl)};
    export const CAMPAIGN_SCHEDULES = core.CAMPAIGN_SCHEDULES;
    export const COMMANDS = core.COMMANDS;
    export const RULES_VERSION = core.RULES_VERSION;
    export const awardFor = core.awardFor;
    export const commandCost = core.commandCost;
    export const OUTCOMES = core.OUTCOMES;
    export const initialEncounter = core.initialEncounter;
    export const reduceEncounter = core.reduceEncounter;
    export const replayEncounter = core.replayEncounter;
    export const settleCampaign = core.settleCampaign;
    export const makeCommand = core.makeCommand;
    export const validateDeterministicReplay = (...args) => {
      globalThis.__stage1ReplaySpy?.(...args);
      return globalThis.__stage1ReplayOverride
        ? globalThis.__stage1ReplayOverride(...args)
        : core.validateDeterministicReplay(...args);
    };
  `;
  const rewritten = appSource.replace(
    'from "./game-core.js";',
    `from ${JSON.stringify(dataModule(`${proxySource}\n// proxy ${++moduleNonce}`))};`,
  );
  assert.notEqual(rewritten, appSource, "The browser harness must execute the current app.js body.");

  let restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    if (hadDocument) globalThis.document = priorDocument;
    else delete globalThis.document;
    if (hadRaf) globalThis.requestAnimationFrame = priorRaf;
    else delete globalThis.requestAnimationFrame;
    if (hadCancelRaf) globalThis.cancelAnimationFrame = priorCancelRaf;
    else delete globalThis.cancelAnimationFrame;
    if (hadWindow) globalThis.window = priorWindow;
    else delete globalThis.window;
    if (hadReplaySpy) globalThis.__stage1ReplaySpy = priorReplaySpy;
    else delete globalThis.__stage1ReplaySpy;
    if (hadReplayOverride) globalThis.__stage1ReplayOverride = priorReplayOverride;
    else delete globalThis.__stage1ReplayOverride;
    if (hadAudio) globalThis.Audio = priorAudio;
    else delete globalThis.Audio;
  }

  let app;
  try {
    app = await import(dataModule(`${rewritten}
export const __stage1TestApi = {
  previewCommands,
  commandLabel,
  commandRejectText,
  dictionaryFor,
  render,
  setFixture({
    nextEncounter,
    nextSurface = "play",
    nextSequence = 0,
    nextRecords = [],
    nextStageJournals = [nextRecords],
    nextEncounterIndex = 0,
    nextOutcomes = [],
    nextSettlement = null,
    nextTotalCommandsRun = nextRecords.length,
  }) {
    encounter = nextEncounter;
    surface = nextSurface;
    sequence = nextSequence;
    records = nextRecords;
    stageJournals = nextStageJournals;
    encounterIndex = nextEncounterIndex;
    outcomes = nextOutcomes;
    settlement = nextSettlement;
    totalCommandsRun = nextTotalCommandsRun;
  },
  canonicalSnapshot() {
    return JSON.parse(JSON.stringify({
      encounter,
      sequence,
      records,
      stageJournals,
      outcomes,
      settlement,
      totalCommandsRun,
    }));
  },
  currentLang() {
    return currentLang;
  },
}
// app harness ${++moduleNonce}`));
  } catch (error) {
    restore();
    throw error;
  }

  return { browser, replayCalls, storage, audio, app, restore };
}

function terminalSnapshot(browser) {
  return {
    screens: ["lobby-screen", "play-screen", "terminal-screen"].map((id) => [id, browser.element(id).hidden]),
    metrics: ["integrity-value", "focus-value", "guard-value", "pressure-value", "foe-health-value"].map((id) => [id, browser.element(id).textContent]),
    trace: browser.element("trace-log").children.map((entry) => entry.textContent),
    announcement: browser.element("announcement").textContent,
    settlement: browser.element("settlement-summary").textContent,
    terminalSummary: browser.element("terminal-summary").textContent,
  };
}
function visibleCanonicalSnapshot(browser) {
  return {
    metrics: ["integrity-value", "focus-value", "guard-value", "pressure-value", "foe-health-value"]
      .map((id) => [id, browser.element(id).textContent]),
    trace: browser.element("trace-log").children.map((entry) => entry.textContent),
  };
}

function nonAnnouncementProjection(browser, { includePresentation = false } = {}) {
  const projection = {
    screens: ["lobby-screen", "play-screen", "terminal-screen"].map((id) => [id, browser.element(id).hidden]),
    text: [
      "lobby-title",
      "play-title",
      "terminal-title",
      "campaign-value",
      "rules-version",
      "intent-value",
      "counter-value",
      "integrity-value",
      "focus-value",
      "guard-value",
      "pressure-value",
      "foe-health-value",
      "command-help",
      "settlement-summary",
      "terminal-summary",
      "telemetry-log",
      "terminal-telemetry-log",
      "threat-copy",
    ].map((id) => [id, browser.element(id).textContent]),
    trace: browser.element("trace-log").children.map((entry) => entry.textContent),
    disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
  };
  if (includePresentation) {
    projection.presentation = {
      fxClass: browser.element("fx-overlay").className,
      knightDamaged: browser.element("knight-avatar").classList.contains("damage-flash"),
      voidDamaged: browser.element("void-avatar").classList.contains("damage-flash"),
      unitCount: browser.element("units-container").children.length,
    };
  }
  return projection;
}

function keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls }) {
  return {
    announcement: browser.element("announcement").textContent,
    canonical: api.canonicalSnapshot(),
    persisted: storage.values.get("abyssal_surge_save") ?? null,
    replayCalls: JSON.parse(JSON.stringify(replayCalls)),
    c03Projection: JSON.parse(JSON.stringify(api.previewCommands())),
    nonAnnouncement: nonAnnouncementProjection(browser, { includePresentation: true }),
    audio: [...audio.tracks.entries()].map(([src, track]) => [src, track.playCalls, track.pauseCalls, track.currentTime]),
    timerCalls,
    pendingAnimationFrames: browser.pendingAnimationFrames(),
  };
}

function guideMarkup(browser) {
  return HOTKEY_GUIDES.map(({ id }) => [id, browser.element(id).innerHTML]);
}

function assertHotkeyGuideProjection({ browser, api, lang }) {
  assert.deepEqual(
    guideMarkup(browser),
    HOTKEY_GUIDES.map(({ id, command, key }) => [id, `<strong>[${key}]</strong> ${api.commandLabel(command, lang)}`]),
    `Each guide entry must retain its fixed strong key glyph and project the existing ${lang} command label.`,
  );
  assert.deepEqual(
    HOTKEY_GUIDES.map(({ command }) => [command, browser.command(command).innerHTML]),
    HOTKEY_GUIDES.map(({ command, key }) => [command, `${api.commandLabel(command, lang)} <kbd>${key}</kbd>`]),
    `Each existing command control must retain its established ${lang} label/key projection.`,
  );
}

function acceptedPresentationSnapshot(browser, audio) {
  return {
    audio: [...audio.tracks.entries()].map(([src, track]) => [src, track.playCalls, track.pauseCalls, track.currentTime]),
    fxClass: browser.element("fx-overlay").className,
    knightDamaged: browser.element("knight-avatar").classList.contains("damage-flash"),
    voidDamaged: browser.element("void-avatar").classList.contains("damage-flash"),
    unitCount: browser.element("units-container").children.length,
    pendingAnimationFrames: browser.pendingAnimationFrames(),
  };
}

function visibleCoreReplay(state) {
  const commandLabels = {
    STRIKE: "Strike",
    BRACE: "Brace",
    DISRUPT: "Disrupt",
    RECOVER: "Recover",
  };
  const outcomeLabels = {
    ACTIVE: "ACTIVE",
    VICTORY: "Victory",
    HOLD: "Hold",
    DEFEAT_INTEGRITY: "Defeat",
    DEFEAT_PRESSURE: "Defeat",
  };
  return {
    metrics: [
      ["integrity-value", `${state.integrity} / ${state.max_integrity}`],
      ["focus-value", `${state.focus} / ${state.max_focus}`],
      ["guard-value", `${state.guard} / 2`],
      ["pressure-value", `${state.pressure} / ${state.max_pressure}`],
      ["foe-health-value", `${state.foe_health} / ${state.max_foe_health}`],
    ],
    trace: state.trace.map((entry) => {
      const adverse = entry.foe_resolved
        ? `Adverse effect resolved: ${entry.adverse_damage} integrity damage, ${entry.adverse_pressure} pressure`
        : "Adverse effect skipped";
      const outcome = entry.foe_resolved ? entry.outcome : "VICTORY";
      return `Round ${entry.round}: ${commandLabels[entry.command]}; ${adverse}; Outcome: ${outcomeLabels[outcome]}.`;
    }),
  };
}

function coreAcceptedRun(commands) {
  const schedule = core.CAMPAIGN_SCHEDULES[0];
  let state = core.initialEncounter(schedule, 0);
  let sequence = 0;
  const records = commands.map((command) => {
    const candidate = core.makeCommand(command, state.round, sequence + 1);
    const result = core.reduceEncounter(state, candidate);
    assert.equal(result.accepted, true, `${command} must be accepted by the public core.`);
    sequence += 1;
    state = result.state;
    return candidate;
  });
  const replay = core.replayEncounter(schedule, records);
  assert.deepEqual(replay.state, state, "The public replay must reproduce the accepted core run.");
  return { schedule, records, replay };
}

function coreRun(stageIndex, commands) {
  const schedule = core.CAMPAIGN_SCHEDULES[stageIndex];
  let state = core.initialEncounter(schedule, stageIndex);
  const records = [];
  for (const command of commands) {
    const record = core.makeCommand(command, state.round, records.length + 1);
    const result = core.reduceEncounter(state, record);
    assert.equal(result.accepted, true, `${command} must be accepted by stage ${stageIndex + 1} through the public core.`);
    records.push(record);
    state = result.state;
  }
  const replay = core.replayEncounter(schedule, records);
  assert.deepEqual(replay.state, state, `Stage ${stageIndex + 1} replay must reproduce its public reducer run.`);
  return { schedule, records, replay };
}

function directCommandPreviews(state, sequence) {
  return core.COMMANDS.map((command) => ({
    command,
    preview: core.reduceEncounter(state, core.makeCommand(command, state.round, sequence + 1)),
  }));
}

function assertActiveCommandProjection({ browser, api, state, sequence }) {
  const expected = directCommandPreviews(state, sequence);
  const previews = api.previewCommands(state, sequence + 1);
  assert.deepEqual(previews, expected, "The local preview helper must mirror one direct public-core preview per command.");

  for (const { command, preview } of expected) {
    assert.equal(
      browser.command(command).disabled,
      !preview.accepted,
      `${command} native disabled state must equal its direct current-core preview.`,
    );
  }

  const rejected = expected.filter(({ preview }) => !preview.accepted);
  assert.ok(rejected.length > 0, "This active fixture must exercise at least one unavailable command.");
  const expectedHelp = rejected
    .map(({ command, preview }) => `${api.commandLabel(command)}: ${api.commandRejectText(preview.reason)}`)
    .join(" ");
  assert.equal(
    browser.element("command-help").textContent,
    expectedHelp,
    "Command help must equal the complete current localized direct-core rejected set without stale or extra fragments.",
  );
  return expected;
}

function terminalCoreRun(stageIndex) {
  const schedule = core.CAMPAIGN_SCHEDULES[stageIndex];
  const queue = [{ state: core.initialEncounter(schedule, stageIndex), records: [] }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.state.outcome !== "ACTIVE") {
      const replay = core.replayEncounter(schedule, current.records);
      assert.deepEqual(replay.state, current.state, `Stage ${stageIndex + 1} terminal journal must replay through the public core.`);
      return { schedule, records: current.records, replay };
    }
    for (const command of core.COMMANDS) {
      const record = core.makeCommand(command, current.state.round, current.records.length + 1);
      const result = core.reduceEncounter(current.state, record);
      if (result.accepted) queue.push({ state: result.state, records: [...current.records, record] });
    }
  }
  throw new Error(`Expected a terminal Stage 1 journal for stage ${stageIndex + 1}.`);
}

function terminalCampaignRuns() {
  return core.CAMPAIGN_SCHEDULES.map((_, stageIndex) => terminalCoreRun(stageIndex));
}
function expectedTerminalCampaign(stageJournals) {
  const stages = stageJournals.map((records, stageIndex) => {
    const replay = core.replayEncounter(core.CAMPAIGN_SCHEDULES[stageIndex], records);
    assert.ok(
      replay.results.every((result) => result.accepted),
      `The public core must accept every supplied Stage ${stageIndex + 1} record.`,
    );
    assert.notEqual(replay.state.outcome, "ACTIVE", `The expected Stage ${stageIndex + 1} state must be terminal.`);
    return { records, state: replay.state };
  });
  const outcomes = stages.map(({ state }) => state.outcome);
  const current = stages.at(-1);
  return {
    outcomes,
    currentState: current.state,
    currentRecords: current.records,
    stageIndex: stages.length - 1,
    stageProgress: stages.length,
    currentSequence: current.records.length,
    totalAcceptedCommands: stages.reduce((total, { records }) => total + records.length, 0),
    settlement: stages.length === core.CAMPAIGN_SCHEDULES.length ? core.settleCampaign(outcomes) : null,
  };
}

function visibleAcceptedCommandTotal(browser) {
  const match = browser.element("terminal-telemetry-log").innerHTML.match(/\((\d+) commands run,/);
  assert.ok(match, "The public terminal telemetry must show the accepted command total.");
  return Number(match[1]);
}


function savedOwnKeys(storage) {
  return Object.keys(JSON.parse(storage.getItem("abyssal_surge_save"))).sort();
}

function campaignStage(browser) {
  const match = browser.element("campaign-value").textContent.match(/^(\d+) \/ 5\b/);
  assert.ok(match, "The public campaign heading must identify a Stage 1 position.");
  return Number(match[1]);
}


function resolveVictory(browser, activateCommand, beforeTerminal) {
  browser.element("begin-button").click();
  assert.equal(browser.element("lobby-screen").hidden, true);
  assert.equal(browser.element("play-screen").hidden, false);
  for (let round = 0; round < 3; round += 1) {
    activateCommand();
    if (round === 1) beforeTerminal();
  }
  assert.equal(browser.element("terminal-screen").hidden, false);
}

function replayNeutralSummary(summary) {
  return summary.replace(/Replay check: (?:deterministic|mismatch)\.$/, "Replay check: <status>.");
}

test("current v1 browser slice keeps semantic local controls, records pointer/key input identically, and presents replay status without mutation", async () => {
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(html, /<section id="play-screen"[^>]*aria-labelledby="play-title" hidden>/);
  assert.match(html, /<h2 id="commands-title">Semantic commands<\/h2>/);
  assert.match(html, /Pointer\/touch clicks and keyboard shortcuts record the same versioned command before the deterministic reducer resolves it\./);
  assert.match(html, /<ol id="trace-log" class="event-log" aria-live="off"><\/ol>/);
  assert.match(html, /<section id="terminal-screen"[^>]*aria-labelledby="terminal-title" hidden>/);
  assert.match(html, /<p id="terminal-summary" class="terminal-summary" role="status"><\/p>/);
  for (const [command, key] of [["STRIKE", "S"], ["BRACE", "B"], ["DISRUPT", "D"], ["RECOVER", "R"]]) {
    assert.match(html, new RegExp(`<button type="button" data-command="${command}">[^<]+ <kbd>${key}<\\/kbd><\\/button>`));
  }
  const hotkeyGuideHtml = html.match(/<div class="hotkey-guide"[^>]*>[\s\S]*?<\/div>/)?.[0];
  assert.ok(hotkeyGuideHtml, "The command panel must retain its hotkey guide.");
  assert.equal([...hotkeyGuideHtml.matchAll(/<span\b/g)].length, 4, "The hotkey guide must contain exactly four existing entries.");
  assert.deepEqual(
    [...hotkeyGuideHtml.matchAll(/<span id="(hotkey-[^"]+)"><strong>\[([A-Z])\]<\/strong> ([^<]+)<\/span>/g)]
      .map(([, id, key, label]) => [id, key, label]),
    HOTKEY_GUIDES.map(({ id, command, key }) => [id, key, `${command[0]}${command.slice(1).toLowerCase()}`]),
    "The guide must retain exactly the ordered STRIKE, BRACE, DISRUPT, RECOVER strong key glyph pairs.",
  );

  for (const forbiddenRuntimeApi of [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bnavigator\.sendBeacon\b/,
    /\bindexedDB\b/i,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/,
    /\bcaches\b/,
    /\bserviceWorker\b/,
    /\bhttps?:\/\//i,
  ]) {
    assert.doesNotMatch(appSource, forbiddenRuntimeApi, `app.js must not use ${forbiddenRuntimeApi}.`);
  }
  assert.match(appSource, /from "\.\/game-core\.js";/, "The browser surface must use the local reducer module.");

  const pointer = await loadApp();
  let pointerSnapshot;
  try {
    resolveVictory(
      pointer.browser,
      () => pointer.browser.command("STRIKE").click(),
      () => assert.equal(pointer.replayCalls.length, 0, "Replay validation must not run before terminality."),
    );
    pointerSnapshot = terminalSnapshot(pointer.browser);
  } finally {
    pointer.restore();
  }

  const keyboard = await loadApp();
  let keyboardSnapshot;
  let keyEvent;
  try {
    resolveVictory(
      keyboard.browser,
      () => {
        keyEvent = keyboard.browser.key("s");
        assert.equal(keyEvent.defaultPrevented, true, "A recognized keyboard command must consume its browser event.");
      },
      () => assert.equal(keyboard.replayCalls.length, 0, "Replay validation must not run before terminality."),
    );
    keyboardSnapshot = terminalSnapshot(keyboard.browser);
  } finally {
    keyboard.restore();
  }

  const { RULES_VERSION: liveRulesVersion } = await import(coreUrl);
  const expectedRecords = [
    { rules_version: liveRulesVersion, command: "STRIKE", tick: 0, sequence: 1 },
    { rules_version: liveRulesVersion, command: "STRIKE", tick: 1, sequence: 2 },
    { rules_version: liveRulesVersion, command: "STRIKE", tick: 2, sequence: 3 },
  ];
  assert.equal(pointer.replayCalls.length, 1, "A terminal result must validate one accumulated local replay.");
  assert.equal(keyboard.replayCalls.length, 1, "Keyboard input must validate one accumulated local replay at terminality.");
  assert.deepEqual(pointer.replayCalls[0].schedule, ["STRIKE", "STRIKE", "STRIKE"]);
  assert.deepEqual(keyboard.replayCalls[0].schedule, ["STRIKE", "STRIKE", "STRIKE"]);
  assert.deepEqual(pointer.replayCalls[0].records, expectedRecords, "Pointer input must validate the app's accumulated versioned record stream.");
  assert.deepEqual(keyboard.replayCalls[0].records, expectedRecords, "Keyboard input must validate the app's accumulated versioned record stream.");
  assert.deepEqual(pointer.replayCalls[0].records, keyboard.replayCalls[0].records, "Pointer and keyboard must pass the same terminal record stream to replay validation.");
  assert.equal(pointerSnapshot.screens[2][1], false, "A terminal outcome must be presented only on the terminal surface.");
  assert.match(pointerSnapshot.terminalSummary, /^Victory — foe health reached 0 before the round's adverse effect resolved\. Award: 2 fragments\. Replay check: deterministic\.$/);
  assert.equal(pointerSnapshot.trace.length, 3, "The terminal presentation must retain its deterministic local resolution trace.");

  const mismatch = await loadApp({ replayOverride: () => Object.freeze({ matches: false }) });
  let mismatchSnapshot;
  try {
    resolveVictory(
      mismatch.browser,
      () => mismatch.browser.command("STRIKE").click(),
      () => assert.equal(mismatch.replayCalls.length, 0, "Injected replay status must remain terminal-only."),
    );
    mismatchSnapshot = terminalSnapshot(mismatch.browser);
  } finally {
    mismatch.restore();
  }

  assert.equal(mismatch.replayCalls.length, 1, "The mismatch branch must validate one accumulated local replay.");
  assert.deepEqual(mismatch.replayCalls[0].schedule, ["STRIKE", "STRIKE", "STRIKE"]);
  assert.deepEqual(mismatch.replayCalls[0].records, expectedRecords, "The mismatch branch must validate the same accumulated versioned record stream.");
  assert.match(mismatchSnapshot.terminalSummary, /Replay check: mismatch\.$/);
  assert.equal(replayNeutralSummary(mismatchSnapshot.terminalSummary), replayNeutralSummary(pointerSnapshot.terminalSummary));
  assert.deepEqual(
    { ...mismatchSnapshot, terminalSummary: undefined },
    { ...pointerSnapshot, terminalSummary: undefined },
    "Injected replay evidence may change only its terminal status text, not the resolved encounter presentation.",
  );
});

test("real-time UI commands commit the public core record stream and terminal replay state", async () => {
  const commandRun = coreAcceptedRun(["STRIKE", "STRIKE", "STRIKE"]);
  const realtime = await loadApp({ useRealTime: true });
  try {
    realtime.browser.element("begin-button").click();
    assert.ok(realtime.browser.pendingAnimationFrames() > 0, "Real-time presentation must queue a frame.");

    for (const command of ["STRIKE", "STRIKE", "STRIKE"]) {
      realtime.browser.command(command).click();
    }

    assert.equal(realtime.browser.element("terminal-screen").hidden, false, "The accepted UI sequence must reach its core terminal state.");
    assert.equal(realtime.replayCalls.length, 1, "Terminality must replay the accepted real-time journal once.");
    assert.deepEqual(realtime.replayCalls[0].schedule, commandRun.schedule);
    assert.deepEqual(
      realtime.replayCalls[0].records,
      commandRun.records,
      "Real-time UI input must preserve the core-valid candidate order, ticks, and sequences.",
    );
    assert.deepEqual(
      visibleCanonicalSnapshot(realtime.browser),
      visibleCoreReplay(commandRun.replay.state),
      "Terminal metrics and trace must present the public core replay state.",
    );
  } finally {
    realtime.restore();
  }
});

test("real-time rejected DISRUPT preserves the accepted journal and canonical presentation", async () => {
  const commandRun = coreAcceptedRun(["STRIKE", "STRIKE", "STRIKE"]);
  const initialState = core.initialEncounter(commandRun.schedule, 0);
  const rejected = core.reduceEncounter(initialState, core.makeCommand("DISRUPT", initialState.round, 1));
  assert.equal(rejected.accepted, false, "DISRUPT must be rejected against the initial STRIKE threat.");
  assert.equal(rejected.reason, "INTENT");

  const realtime = await loadApp({ useRealTime: true });
  try {
    realtime.browser.element("begin-button").click();
    assert.equal(realtime.browser.command("DISRUPT").disabled, true, "The real-time UI must preview the core rejection.");
    const canonicalBeforeRejection = visibleCanonicalSnapshot(realtime.browser);

    realtime.browser.command("DISRUPT").click();
    assert.deepEqual(
      visibleCanonicalSnapshot(realtime.browser),
      canonicalBeforeRejection,
      "A rejected real-time command must not change user-visible canonical metrics or trace.",
    );
    assert.match(realtime.browser.element("announcement").textContent, /Disrupt: command is not valid for the current threat\./);
    assert.equal(realtime.replayCalls.length, 0, "A rejected command must not produce an accepted replay journal.");

    for (const command of ["STRIKE", "STRIKE", "STRIKE"]) {
      realtime.browser.command(command).click();
    }

    assert.equal(realtime.replayCalls.length, 1, "The later legal sequence must resolve normally.");
    assert.deepEqual(
      realtime.replayCalls[0].records,
      commandRun.records,
      "The terminal journal must exclude the rejected DISRUPT and retain only accepted records.",
    );
    assert.deepEqual(visibleCanonicalSnapshot(realtime.browser), visibleCoreReplay(commandRun.replay.state));
  } finally {
    realtime.restore();
  }
});

test("real-time animation frames cannot alter canonical presentation or later replay", async () => {
  const commandRun = coreAcceptedRun(["STRIKE", "STRIKE", "STRIKE"]);
  const realtime = await loadApp({ useRealTime: true });
  try {
    realtime.browser.element("begin-button").click();
    const canonicalBeforeFrames = visibleCanonicalSnapshot(realtime.browser);
    assert.ok(realtime.browser.pendingAnimationFrames() > 0, "The real-time entry must enqueue a presentation frame.");

    realtime.browser.flushAnimationFrames([0, 4_000, 8_000]);

    assert.deepEqual(
      visibleCanonicalSnapshot(realtime.browser),
      canonicalBeforeFrames,
      "Queued frames without semantic input must not change user-visible canonical metrics or trace.",
    );
    assert.equal(realtime.replayCalls.length, 0, "Queued frames must not append an accepted record or trigger replay.");
    assert.ok(realtime.browser.pendingAnimationFrames() > 0, "Presentation frames may continue scheduling without creating semantics.");

    for (const command of ["STRIKE", "STRIKE", "STRIKE"]) {
      realtime.browser.command(command).click();
    }

    assert.equal(realtime.replayCalls.length, 1, "The post-frame legal sequence must still terminally replay once.");
    assert.deepEqual(
      realtime.replayCalls[0].records,
      commandRun.records,
      "Animation frames must not alter the later accepted journal.",
    );
    assert.deepEqual(
      visibleCanonicalSnapshot(realtime.browser),
      visibleCoreReplay(commandRun.replay.state),
      "Animation frames must not alter the later public core replay result.",
    );
  } finally {
    realtime.restore();
  }
});

test("real-time frames do not create presentation effects without an accepted command", async () => {
  const realtime = await loadApp({ useRealTime: true, includePresentation: true, withAudio: true });
  try {
    realtime.browser.element("begin-button").click();
    const audioPlayCounts = () => [...realtime.audio.tracks.entries()].map(([src, track]) => [src, track.playCalls]);
    const effectsBeforeFrames = {
      audio: audioPlayCounts(),
      fxClass: realtime.browser.element("fx-overlay").className,
      knightDamaged: realtime.browser.element("knight-avatar").classList.contains("damage-flash"),
      voidDamaged: realtime.browser.element("void-avatar").classList.contains("damage-flash"),
      unitCount: realtime.browser.element("units-container").children.length,
    };
    assert.ok(realtime.browser.pendingAnimationFrames() > 0, "Entering the real-time surface must queue a presentation frame.");

    realtime.browser.flushAnimationFrames([0, 4_000, 8_000, 12_000]);

    assert.deepEqual(
      {
        audio: audioPlayCounts(),
        fxClass: realtime.browser.element("fx-overlay").className,
        knightDamaged: realtime.browser.element("knight-avatar").classList.contains("damage-flash"),
        voidDamaged: realtime.browser.element("void-avatar").classList.contains("damage-flash"),
        unitCount: realtime.browser.element("units-container").children.length,
      },
      effectsBeforeFrames,
      "Queued frames without a semantic command must not create SFX, VFX, avatar, or unit effects.",
    );
  } finally {
    realtime.restore();
  }
});

test("resume replays five terminal stage journals into the derived final terminal projection", async () => {
  const terminalRuns = terminalCampaignRuns();
  const stageJournals = terminalRuns.map((run) => run.records);
  const expected = expectedTerminalCampaign(stageJournals);
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals,
      currentLang: "en",
      volumeBgm: 0.4,
      volumeSfx: 0.6,
      volumeNarr: 0.8,
      encounterIndex: 0,
      sequence: 99_999,
      totalCommandsRun: 99_999,
      outcomes: ["VICTORY", "VICTORY", "VICTORY", "VICTORY", "VICTORY"],
      settlement: { fragments_earned: 999, fragment_wallet: 999, resolve_marks: 999 },
      records: [core.makeCommand("DISRUPT", 0, 1)],
      encounter: { outcome: "VICTORY", trace: [] },
      surface: "play",
      lastMessage: "forged terminal projection",
      terminal: false,
      state: { outcome: "ACTIVE" },
    }),
  });
  const restored = await loadApp({ storage });
  try {
    restored.browser.element("resume-button").click();
    const canonicalSave = JSON.parse(storage.getItem("abyssal_surge_save"));

    assert.deepEqual(
      expected.outcomes,
      terminalRuns.map((run) => run.replay.state.outcome),
      "The expected ordered outcomes must derive independently from the five public-core replays.",
    );
    assert.equal(restored.browser.element("play-screen").hidden, true, "Five replayed terminal journals must not reopen an active encounter.");
    assert.equal(restored.browser.element("terminal-screen").hidden, false, "Five replayed terminal journals must restore the terminal surface.");
    assert.equal(restored.browser.element("continue-button").hidden, true, "A replay-derived five-stage settlement must not offer a sixth stage.");
    assert.equal(campaignStage(restored.browser), expected.stageProgress, "The terminal projection must derive Stage 5 from journal order, not forged progress.");
    assert.equal(expected.stageIndex, core.CAMPAIGN_SCHEDULES.length - 1, "The public core must derive the terminal stage index.");
    assert.deepEqual(visibleCanonicalSnapshot(restored.browser), visibleCoreReplay(expected.currentState));
    assert.equal(
      restored.replayCalls.at(-1).records.at(-1).sequence,
      expected.currentSequence,
      "The public replay validation seam must receive the current core-derived sequence.",
    );
    assert.deepEqual(
      restored.replayCalls.at(-1).records,
      expected.currentRecords,
      "The public replay validation seam must receive only the derived current-stage journal.",
    );
    assert.equal(
      visibleAcceptedCommandTotal(restored.browser),
      expected.totalAcceptedCommands,
      "The public terminal telemetry must derive the five-stage accepted command total, not the forged total.",
    );
    assert.match(
      restored.browser.element("settlement-summary").textContent,
      new RegExp(`Campaign settled locally: ${expected.settlement.fragments_earned} fragments\\. Wallet ${expected.settlement.fragment_wallet}, resolve marks ${expected.settlement.resolve_marks}\\.`),
      "Settlement must derive from the five replayed terminal outcomes, not the forged settlement.",
    );
    assert.deepEqual(canonicalSave.stageJournals, stageJournals, "The persisted order must retain exactly the accepted journals used for replay.");
    assert.deepEqual(
      savedOwnKeys(storage),
      ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"],
      "A fully valid replay must contract forged legacy projection fields on Resume.",
    );
  } finally {
    restored.restore();
  }
});

test("resume projects each core-derived terminal campaign prefix in order", async () => {
  const stageJournals = terminalCampaignRuns().map((run) => run.records);
  const expectedCampaign = expectedTerminalCampaign(stageJournals);
  const observedTerminalSnapshots = [];

  for (let stageCount = 1; stageCount <= stageJournals.length; stageCount += 1) {
    const expected = expectedTerminalCampaign(stageJournals.slice(0, stageCount));
    const storage = new FakeStorage({
      abyssal_surge_save: JSON.stringify({
        stageJournals: stageJournals.slice(0, stageCount),
        currentLang: "en",
        volumeBgm: 0.5,
        volumeSfx: 0.8,
        volumeNarr: 1,
      }),
    });
    const restored = await loadApp({ storage });
    try {
      restored.browser.element("resume-button").click();
      const snapshot = visibleCanonicalSnapshot(restored.browser);
      const currentTrace = snapshot.trace.at(-1);
      const expectedTrace = visibleCoreReplay(expected.currentState).trace.at(-1);
      const outcomeLabel = expectedTrace.match(/Outcome: ([^.]+)\./)?.[1];

      observedTerminalSnapshots.push(snapshot);
      assert.equal(campaignStage(restored.browser), expected.stageProgress, `Prefix ${stageCount} must expose its core-derived campaign progress.`);
      assert.equal(restored.browser.element("play-screen").hidden, true, `Prefix ${stageCount} must project its current terminal stage.`);
      assert.equal(restored.browser.element("terminal-screen").hidden, false, `Prefix ${stageCount} must project its terminal surface.`);
      assert.deepEqual(snapshot, visibleCoreReplay(expected.currentState), `Prefix ${stageCount} must expose the current terminal state derived by the public core.`);
      assert.equal(currentTrace, expectedTrace, `Prefix ${stageCount} must expose its ordered terminal outcome through the current trace.`);
      assert.match(restored.browser.element("terminal-summary").textContent, new RegExp(`^${outcomeLabel} —`));
      assert.equal(
        restored.replayCalls.at(-1).records.at(-1).sequence,
        expected.currentSequence,
        `Prefix ${stageCount} must send the core-derived current sequence through the public replay validation seam.`,
      );
      assert.equal(
        visibleAcceptedCommandTotal(restored.browser),
        expected.totalAcceptedCommands,
        `Prefix ${stageCount} must expose the core-derived cumulative accepted command total.`,
      );
      assert.equal(
        restored.browser.element("settlement-summary").textContent.includes("Campaign settled locally"),
        expected.settlement !== null,
        `Prefix ${stageCount} must expose settlement only after all five core-derived outcomes.`,
      );
    } finally {
      restored.restore();
    }
  }

  assert.deepEqual(
    expectedCampaign.outcomes,
    stageJournals.map((records, stageIndex) => core.replayEncounter(core.CAMPAIGN_SCHEDULES[stageIndex], records).state.outcome),
    "The expected campaign outcome order must be independently derived from the public core.",
  );
  assert.equal(observedTerminalSnapshots.length, core.CAMPAIGN_SCHEDULES.length);
});

test("resume restores an active later-stage journal and continues with core-identical tick and sequence", async () => {
  const terminalRuns = terminalCampaignRuns();
  const activeRun = coreRun(3, ["BRACE"]);
  const continuedRun = coreRun(3, ["BRACE", "DISRUPT"]);
  const stageJournals = [
    ...terminalRuns.slice(0, 3).map((run) => run.records),
    activeRun.records,
  ];
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals,
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
      encounterIndex: 0,
      sequence: 999,
      outcomes: ["VICTORY"],
      settlement: { fragments_earned: 999 },
      encounter: { outcome: "VICTORY" },
    }),
  });
  const restored = await loadApp({ storage });
  try {
    restored.browser.element("resume-button").click();
    assert.equal(restored.browser.element("play-screen").hidden, false, "A replayed active journal must restore the play surface.");
    assert.equal(restored.browser.element("terminal-screen").hidden, true);
    assert.equal(campaignStage(restored.browser), 4, "Three terminal journals must derive the fourth stage as active.");
    assert.deepEqual(visibleCanonicalSnapshot(restored.browser), visibleCoreReplay(activeRun.replay.state));

    restored.browser.command("DISRUPT").click();
    const canonicalSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(
      canonicalSave.stageJournals,
      [...terminalRuns.slice(0, 3).map((run) => run.records), continuedRun.records],
      "The next legal command must extend only the active later-stage journal with the core-valid envelope.",
    );
    assert.deepEqual(visibleCanonicalSnapshot(restored.browser), visibleCoreReplay(continuedRun.replay.state));
    assert.deepEqual(
      savedOwnKeys(storage),
      ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"],
      "Saving the resumed command must persist only journals and the four allowed preferences.",
    );
  } finally {
    restored.restore();
  }
});

test("resume quarantines malformed or noncontiguous later journals before they can restore later progress", async () => {
  const terminalRuns = terminalCampaignRuns();
  const validPrefix = terminalRuns[0];
  const terminalTail = terminalRuns.slice(2).map((run) => run.records);
  const stageOneRecords = terminalRuns[1].records;
  const incompleteStageZero = coreRun(0, ["STRIKE"]).records;
  const cases = [
    { name: "malformed", journals: [validPrefix.records, [null], ...terminalTail] },
    { name: "duplicate", journals: [validPrefix.records, [stageOneRecords[0], { ...stageOneRecords[0] }, ...stageOneRecords.slice(1)], ...terminalTail] },
    { name: "nonconsecutive", journals: [validPrefix.records, [{ ...stageOneRecords[0], sequence: 2 }, ...stageOneRecords.slice(1)], ...terminalTail] },
    { name: "rejected", journals: [validPrefix.records, [core.makeCommand("RECOVER", 0, 1)], ...terminalTail] },
    { name: "out-of-order", journals: [validPrefix.records, [...stageOneRecords].reverse(), ...terminalTail] },
    { name: "incomplete prior", journals: [incompleteStageZero, stageOneRecords, ...terminalTail], invalidStage: 0 },
  ];

  for (const { name, journals, invalidStage = 1 } of cases) {
    const rawSave = JSON.stringify({
      stageJournals: journals,
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
      outcomes: ["VICTORY", "VICTORY", "VICTORY", "VICTORY", "VICTORY"],
      settlement: { fragments_earned: 999, fragment_wallet: 999, resolve_marks: 999 },
      encounterIndex: 4,
      sequence: 999,
      surface: "terminal",
    });
    const storage = new FakeStorage({ abyssal_surge_save: rawSave });
    const original = storage.getItem("abyssal_surge_save");
    const restored = await loadApp({ storage });
    try {
      restored.browser.element("resume-button").click();
      assert.equal(
        storage.getItem("abyssal_surge_save"),
        original,
        `${name} suffix data must remain byte-for-byte stored when strict replay stops before consuming it.`,
      );
      assert.equal(
        campaignStage(restored.browser),
        1,
        `${name} journals must stop before an invalid second-stage journal instead of restoring any later journal.`,
      );
      assert.equal(
        restored.browser.element("terminal-screen").hidden,
        invalidStage === 0,
        `${name} journals may restore only the terminal prefix before the first invalid stage.`,
      );
      assert.equal(
        restored.browser.element("settlement-summary").textContent.includes("Campaign settled locally"),
        false,
        `${name} journals must not derive a later settlement.`,
      );
      if (invalidStage === 1) {
        assert.deepEqual(
          visibleCanonicalSnapshot(restored.browser),
          visibleCoreReplay(validPrefix.replay.state),
          `${name} journals must preserve only the valid terminal prefix state.`,
        );
      }
    } finally {
      restored.restore();
    }
  }
});

test("resume persistence writes only journals and preferences; rejected input and frames add no command", async () => {
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [[]],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const restored = await loadApp({ storage, useRealTime: true });
  try {
    restored.browser.element("resume-button").click();
    restored.browser.command("DISRUPT").click();
    assert.deepEqual(
      JSON.parse(storage.getItem("abyssal_surge_save")).stageJournals,
      [[]],
      "A rejected restored control must not append a journal record.",
    );

    const accepted = coreRun(0, ["STRIKE"]);
    restored.browser.command("STRIKE").click();
    assert.deepEqual(savedOwnKeys(storage), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual(
      JSON.parse(storage.getItem("abyssal_surge_save")).stageJournals,
      [accepted.records],
      "The first accepted command must persist only its current four-field core record.",
    );
  } finally {
    restored.restore();
  }

  const frameStorage = new FakeStorage();
  const realtime = await loadApp({ storage: frameStorage, useRealTime: true });
  try {
    realtime.browser.element("begin-button").click();
    assert.ok(realtime.browser.pendingAnimationFrames() > 0, "The active presentation surface must retain its frame loop.");
    realtime.browser.flushAnimationFrames([0, 1_001]);
    assert.deepEqual(savedOwnKeys(frameStorage), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual(
      JSON.parse(frameStorage.getItem("abyssal_surge_save")).stageJournals,
      [[]],
      "Presentation-only frames must not append a journal record or raw state.",
    );
  } finally {
    realtime.restore();
  }
});

test("accepted commands alone invoke presentation, while a later rejected control preserves it and reports rejection", async () => {
  const presentation = await loadApp({ useRealTime: true, includePresentation: true, withAudio: true });
  try {
    presentation.browser.element("audio-toggle").click();
    presentation.browser.element("begin-button").click();
    const strikeAudio = presentation.audio.tracks.get("assets/audio/strike.mp3");
    const audioPlayCounts = () => [...presentation.audio.tracks.entries()].map(([src, track]) => [src, track.playCalls]);
    assert.ok(strikeAudio, "The existing STRIKE SFX surface must be present.");
    const effectsBeforeAcceptedCommand = {
      strikePlays: strikeAudio.playCalls,
      unitCount: presentation.browser.element("units-container").children.length,
    };

    presentation.browser.command("STRIKE").click();
    assert.equal(strikeAudio.playCalls, effectsBeforeAcceptedCommand.strikePlays + 1, "An accepted command must invoke its existing SFX.");
    assert.equal(presentation.browser.element("fx-overlay").className, "fx-overlay fx-strike", "An accepted command must invoke the existing VFX surface.");
    assert.equal(presentation.browser.element("void-avatar").classList.contains("damage-flash"), true, "An accepted command must invoke the existing avatar effect.");
    assert.ok(presentation.browser.element("units-container").children.length > effectsBeforeAcceptedCommand.unitCount, "An accepted command must invoke the existing unit presentation.");

    const effectsBeforeRejectedCommand = {
      audio: audioPlayCounts(),
      fxClass: presentation.browser.element("fx-overlay").className,
      knightDamaged: presentation.browser.element("knight-avatar").classList.contains("damage-flash"),
      voidDamaged: presentation.browser.element("void-avatar").classList.contains("damage-flash"),
      unitCount: presentation.browser.element("units-container").children.length,
    };
    presentation.browser.command("DISRUPT").click();

    assert.deepEqual(
      {
        audio: audioPlayCounts(),
        fxClass: presentation.browser.element("fx-overlay").className,
        knightDamaged: presentation.browser.element("knight-avatar").classList.contains("damage-flash"),
        voidDamaged: presentation.browser.element("void-avatar").classList.contains("damage-flash"),
        unitCount: presentation.browser.element("units-container").children.length,
      },
      effectsBeforeRejectedCommand,
      "A reducer-rejected control must not invoke or alter command presentation effects.",
    );
    assert.match(
      presentation.browser.element("announcement").textContent,
      /Disrupt: command is not valid for the current threat\./,
      "A reducer-rejected control must still present its visible rejection feedback.",
    );
  } finally {
    presentation.restore();
  }
});

test("active command help and native disabled state project every direct current-core rejection", async () => {
  const active = await loadApp();
  try {
    active.browser.element("begin-button").click();
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    const expected = assertActiveCommandProjection({
      browser: active.browser,
      api: active.app.__stage1TestApi,
      state: initial,
      sequence: 0,
    });

    assert.deepEqual(
      expected
        .filter(({ preview }) => !preview.accepted)
        .map(({ command, preview }) => [command, preview.reason]),
      [
        ["DISRUPT", "INTENT"],
        ["RECOVER", "FOCUS_CAP"],
      ],
      "Initial Stage 1 STRIKE must expose the complete direct-core DISRUPT/INTENT and RECOVER/FOCUS_CAP rejected set.",
    );
    active.browser.element("lang-toggle").click();
    const koreanInitial = assertActiveCommandProjection({
      browser: active.browser,
      api: active.app.__stage1TestApi,
      state: initial,
      sequence: 0,
    });
    assert.deepEqual(koreanInitial, expected, "Changing the existing language toggle must not change the direct-core preview set.");
    for (const { command, preview } of koreanInitial.filter(({ preview }) => !preview.accepted)) {
      assert.ok(
        active.browser.element("command-help").textContent.includes(
          `${active.app.__stage1TestApi.commandLabel(command, "ko")}: ${active.app.__stage1TestApi.commandRejectText(preview.reason, "ko")}`,
        ),
        `${command} must retain its exact Korean command/reason fragment in command help.`,
      );
    }
    active.browser.element("lang-toggle").click();

    const firstStrike = core.reduceEncounter(initial, core.makeCommand("STRIKE", initial.round, 1));
    assert.equal(firstStrike.accepted, true);
    active.browser.command("STRIKE").click();
    const afterStrike = assertActiveCommandProjection({
      browser: active.browser,
      api: active.app.__stage1TestApi,
      state: firstStrike.state,
      sequence: 1,
    });
    assert.equal(
      active.browser.element("command-help").textContent.includes(
        `${active.app.__stage1TestApi.commandLabel("RECOVER")}: ${active.app.__stage1TestApi.commandRejectText("FOCUS_CAP")}`,
      ),
      false,
      "A newly accepted command must recompute help from the complete current preview set without stale initial rejections.",
    );
    assert.deepEqual(
      afterStrike.filter(({ preview }) => !preview.accepted).map(({ command, preview }) => [command, preview.reason]),
      [["DISRUPT", "INTENT"]],
      "The recomputed active rejected set must remain direct-core-derived.",
    );
  } finally {
    active.restore();
  }
});

test("C05 localizes fixed hotkey guide glyphs without changing active C02/C03/C04 behavior", async () => {
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [[]],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const active = await loadApp({ storage, includePresentation: true, withAudio: true });
  try {
    const { browser, app, replayCalls, audio } = active;
    const api = app.__stage1TestApi;
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    api.setFixture({ nextEncounter: initial, nextSurface: "play", nextStageJournals: [[]] });
    api.render();

    assert.equal(api.currentLang(), "en");
    assertHotkeyGuideProjection({ browser, api, lang: "en" });
    const englishC03 = assertActiveCommandProjection({ browser, api, state: initial, sequence: 0 });
    const beforeToggle = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      previews: JSON.parse(JSON.stringify(api.previewCommands())),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
      persisted: JSON.parse(storage.getItem("abyssal_surge_save")),
    };

    browser.element("lang-toggle").click();

    assert.equal(api.currentLang(), "ko");
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(api.canonicalSnapshot(), beforeToggle.canonical, "Localization must not change replay-derived encounter, journals, outcomes, settlement, or accepted-command total.");
    assert.deepEqual(replayCalls, beforeToggle.replayCalls, "Localization must not invoke replay.");
    assert.deepEqual(api.previewCommands(), beforeToggle.previews, "Localization must retain the direct-core C03 preview set.");
    assert.deepEqual(
      core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      beforeToggle.disabled,
      "Localization must retain the C03 core-consistent disabled projection.",
    );
    assert.deepEqual(
      acceptedPresentationSnapshot(browser, audio),
      beforeToggle.effects,
      "Localization must not invoke or change accepted-command audio, VFX, unit, or animation effects.",
    );
    assert.deepEqual(
      assertActiveCommandProjection({ browser, api, state: initial, sequence: 0 }),
      englishC03,
      "Localization must retain C03's complete rejected-command help projection while translating it through the established Korean path.",
    );
    const koreanSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(Object.keys(koreanSave).sort(), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual(
      { ...koreanSave, currentLang: "en" },
      beforeToggle.persisted,
      "Localization may persist only currentLang; C02 journals and audio preferences must remain byte-for-value unchanged.",
    );
    assert.equal(koreanSave.currentLang, "ko");

    const rejected = core.reduceEncounter(initial, core.makeCommand("DISRUPT", initial.round, 1));
    assert.equal(rejected.accepted, false, "The active Korean fixture must retain C04's direct-core DISRUPT rejection.");
    const guideBeforeRejectedKey = guideMarkup(browser);
    const beforeRejectedKey = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls: 0 });
    const rejectedEvent = browser.key("d");
    const afterRejectedKey = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls: 0 });
    assert.equal(rejectedEvent.defaultPrevented, true, "The existing active C04 key route must remain consumed.");
    assert.deepEqual(guideMarkup(browser), guideBeforeRejectedKey, "A rejected C04 key must not alter any localized guide glyph or label.");
    const { announcement: beforeAnnouncement, ...beforeRejectedProjection } = beforeRejectedKey;
    const { announcement: afterAnnouncement, ...afterRejectedProjection } = afterRejectedKey;
    assert.deepEqual(
      afterRejectedProjection,
      beforeRejectedProjection,
      "A rejected C04 key must retain canonical state, journals, replay, C03 projection, persistence, and accepted effects.",
    );
    assert.notEqual(afterAnnouncement, beforeAnnouncement, "The C04 rejection must continue to announce feedback.");
    assert.equal(
      afterAnnouncement,
      `${api.commandLabel("DISRUPT", "ko")}: ${api.commandRejectText(rejected.reason, "ko")}.`,
      "The C04 rejection announcement must retain its existing Korean direct-core label and reason.",
    );

    const canonicalBeforeRestore = api.canonicalSnapshot();
    browser.element("lang-toggle").click();
    assert.equal(api.currentLang(), "en");
    assertHotkeyGuideProjection({ browser, api, lang: "en" });
    assert.deepEqual(api.canonicalSnapshot(), canonicalBeforeRestore, "Korean-to-English restoration must remain projection-only.");
    const englishSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(
      { ...englishSave, currentLang: "ko" },
      koreanSave,
      "Korean-to-English restoration may persist only the existing currentLang preference.",
    );
    assert.equal(englishSave.currentLang, "en");
  } finally {
    active.restore();
  }
});

test("C05 applies a saved Korean preference to fixed hotkey guide labels without creating state", async () => {
  const persisted = {
    stageJournals: [[]],
    currentLang: "ko",
    volumeBgm: 0.4,
    volumeSfx: 0.6,
    volumeNarr: 0.8,
  };
  const rawPersisted = JSON.stringify(persisted);
  const storage = new FakeStorage({ abyssal_surge_save: rawPersisted });
  const savedKorean = await loadApp({ storage });
  try {
    const api = savedKorean.app.__stage1TestApi;
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    assert.equal(api.currentLang(), "ko");
    assertHotkeyGuideProjection({ browser: savedKorean.browser, api, lang: "ko" });
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: initial,
        sequence: 0,
        records: [],
        stageJournals: [[]],
        outcomes: [],
        settlement: null,
        totalCommandsRun: 0,
      },
      "Loading only currentLang must not resume, create a journal, or mutate canonical encounter state.",
    );
    assert.equal(storage.setCalls, 0, "Applying a saved language preference must not write persistence.");
    assert.equal(storage.getItem("abyssal_surge_save"), rawPersisted, "Applying a saved language preference must not alter the stored C02 payload.");
  } finally {
    savedKorean.restore();
  }
});
test("C02 Stage 2 resume projects current rejections and preserves canonical snapshots on rejected visible input", async () => {
  const terminalStageOne = terminalCoreRun(0);
  const stageTwoInitial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[1], 1);
  const legalDisrupt = core.makeCommand("DISRUPT", stageTwoInitial.round, 1);
  const afterDisrupt = core.reduceEncounter(stageTwoInitial, legalDisrupt);
  assert.equal(afterDisrupt.accepted, true, "The Stage 2 resumed fixture must have one legal DISRUPT action.");

  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [terminalStageOne.records, []],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const restored = await loadApp({ storage });
  try {
    restored.browser.element("resume-button").click();
    const api = restored.app.__stage1TestApi;
    assert.equal(campaignStage(restored.browser), 2, "C02 resume must restore the second active stage after one terminal journal.");
    assert.deepEqual(visibleCanonicalSnapshot(restored.browser), visibleCoreReplay(stageTwoInitial));
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: stageTwoInitial,
        sequence: 0,
        records: [],
        stageJournals: [terminalStageOne.records, []],
        outcomes: [terminalStageOne.replay.state.outcome],
        settlement: null,
        totalCommandsRun: terminalStageOne.records.length,
      },
      "C02 resume must restore the active Stage 2 journal, sequence, and aggregate counters from the stored journals.",
    );

    const beforeLegalAction = assertActiveCommandProjection({
      browser: restored.browser,
      api,
      state: stageTwoInitial,
      sequence: 0,
    });
    assert.deepEqual(
      beforeLegalAction.filter(({ preview }) => !preview.accepted).map(({ command, preview }) => [command, preview.reason]),
      [["RECOVER", "FOCUS_CAP"]],
      "The resumed Stage 2 SURGE fixture must project its complete current rejected set.",
    );

    const serializedProjection = () => JSON.parse(JSON.stringify(api.previewCommands()));
    const rejectedInputSnapshot = {
      canonical: visibleCanonicalSnapshot(restored.browser),
      serializedJournal: storage.getItem("abyssal_surge_save"),
      projection: serializedProjection(),
    };
    restored.browser.command("RECOVER").click();
    assert.deepEqual(
      {
        canonical: visibleCanonicalSnapshot(restored.browser),
        serializedJournal: storage.getItem("abyssal_surge_save"),
        projection: serializedProjection(),
      },
      rejectedInputSnapshot,
      "A rejected visible command must not mutate canonical metrics/trace, the raw serialized journal, or the complete helper projection.",
    );
    assert.deepEqual(
      assertActiveCommandProjection({
        browser: restored.browser,
        api,
        state: stageTwoInitial,
        sequence: 0,
      }),
      beforeLegalAction,
      "A rejected visible command must retain every direct-core rejection fragment and disabled state.",
    );

    restored.browser.command("DISRUPT").click();
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: afterDisrupt.state,
        sequence: 1,
        records: [legalDisrupt],
        stageJournals: [terminalStageOne.records, [legalDisrupt]],
        outcomes: [terminalStageOne.replay.state.outcome],
        settlement: null,
        totalCommandsRun: terminalStageOne.records.length + 1,
      },
      "The legal resumed command must extend only the active Stage 2 journal with its core-valid record and sequence.",
    );
    assert.deepEqual(
      JSON.parse(storage.getItem("abyssal_surge_save")).stageJournals,
      [terminalStageOne.records, [legalDisrupt]],
      "The raw saved journal must contain the exact resumed Stage 2 legal record and no rejected input.",
    );
    const afterLegalAction = assertActiveCommandProjection({
      browser: restored.browser,
      api,
      state: afterDisrupt.state,
      sequence: 1,
    });
    const currentFragments = new Set(
      afterLegalAction
        .filter(({ preview }) => !preview.accepted)
        .map(({ command, preview }) => `${api.commandLabel(command)}: ${api.commandRejectText(preview.reason)}`),
    );
    const staleFragments = beforeLegalAction
      .filter(({ preview }) => !preview.accepted)
      .map(({ command, preview }) => `${api.commandLabel(command)}: ${api.commandRejectText(preview.reason)}`)
      .filter((fragment) => !currentFragments.has(fragment));
    assert.ok(staleFragments.length > 0, "The legal Stage 2 action must replace at least one prior rejected fragment.");
    for (const fragment of staleFragments) {
      assert.equal(
        restored.browser.element("command-help").textContent.includes(fragment),
        false,
        "A legal command must remove stale prior rejection fragments from command help.",
      );
    }
    assert.deepEqual(
      afterLegalAction.filter(({ preview }) => !preview.accepted).map(({ command, preview }) => [command, preview.reason]),
      [["DISRUPT", "INTENT"]],
      "The post-action Stage 2 rejected set must remain direct-core-derived.",
    );
  } finally {
    restored.restore();
  }
});

test("C05 localizes a C02-resumed Stage 2 guide before the existing legal keyboard continuation", async () => {
  const terminalStageOne = terminalCoreRun(0);
  const stageTwoInitial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[1], 1);
  const legalDisrupt = core.makeCommand("DISRUPT", stageTwoInitial.round, 1);
  const afterDisrupt = core.reduceEncounter(stageTwoInitial, legalDisrupt);
  assert.equal(afterDisrupt.accepted, true, "The resumed C05 fixture requires its established legal Stage 2 DISRUPT.");
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [terminalStageOne.records, []],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const resumed = await loadApp({ storage, includePresentation: true, withAudio: true });
  try {
    const { browser, app, replayCalls, audio } = resumed;
    browser.element("resume-button").click();
    const api = app.__stage1TestApi;
    assert.equal(campaignStage(browser), 2);
    assertHotkeyGuideProjection({ browser, api, lang: "en" });
    const englishC03 = assertActiveCommandProjection({ browser, api, state: stageTwoInitial, sequence: 0 });
    const beforeLocalization = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      previews: JSON.parse(JSON.stringify(api.previewCommands())),
      effects: acceptedPresentationSnapshot(browser, audio),
      persisted: JSON.parse(storage.getItem("abyssal_surge_save")),
    };

    browser.element("lang-toggle").click();

    assert.equal(api.currentLang(), "ko");
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(api.canonicalSnapshot(), beforeLocalization.canonical, "Guide localization must not alter C02's replay-derived Stage 2 canonical snapshot.");
    assert.deepEqual(replayCalls, beforeLocalization.replayCalls, "Guide localization must not introduce a replay call.");
    assert.deepEqual(api.previewCommands(), beforeLocalization.previews, "Guide localization must retain the resumed C03 direct-core preview set.");
    assert.deepEqual(
      assertActiveCommandProjection({ browser, api, state: stageTwoInitial, sequence: 0 }),
      englishC03,
      "Guide localization must retain the resumed C03 disabled/help projection.",
    );
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), beforeLocalization.effects, "Guide localization must not invoke accepted-command presentation effects.");
    const koreanSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(
      { ...koreanSave, currentLang: "en" },
      beforeLocalization.persisted,
      "Guide localization must leave the C02 resumed journals and volume preferences unchanged.",
    );

    const guideBeforeLegalKey = guideMarkup(browser);
    const event = browser.key("d");
    assert.equal(event.defaultPrevented, true, "The existing legal Stage 2 keyboard DISRUPT must remain consumed.");
    assert.deepEqual(guideMarkup(browser), guideBeforeLegalKey, "The legal command route must not rewrite the already-localized guide.");
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: afterDisrupt.state,
        sequence: 1,
        records: [legalDisrupt],
        stageJournals: [terminalStageOne.records, [legalDisrupt]],
        outcomes: [terminalStageOne.replay.state.outcome],
        settlement: null,
        totalCommandsRun: terminalStageOne.records.length + 1,
      },
      "The post-localization legal command must retain C02/C04's exact core-valid continuation.",
    );
    assert.deepEqual(
      JSON.parse(storage.getItem("abyssal_surge_save")).stageJournals,
      [terminalStageOne.records, [legalDisrupt]],
      "The legal continuation must append only its established core-valid record after localization.",
    );
  } finally {
    resumed.restore();
  }
});
test("C04 active keyboard rejections announce direct-core reasons while preserving all non-announcement projections", async () => {
  const storage = new FakeStorage();
  const fixture = await loadApp({ storage, includePresentation: true, withAudio: true });
  const originalSetTimeout = globalThis.setTimeout;
  let timerCalls = 0;
  try {
    const { browser, app, replayCalls, audio } = fixture;
    const api = app.__stage1TestApi;
    api.setFixture({ nextEncounter: core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0), nextSurface: "play" });
    api.render();
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    assertActiveCommandProjection({ browser, api, state: initial, sequence: 0 });
    globalThis.setTimeout = () => {
      timerCalls += 1;
      return 1;
    };

    const assertRejectedActiveKey = (key, command, language = "en") => {
      const direct = core.reduceEncounter(initial, core.makeCommand(command, initial.round, 1));
      assert.equal(direct.accepted, false, `${command} must be direct-core rejected in the active initial fixture.`);
      const before = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls });
      const event = browser.key(key);
      const after = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls });
      assert.equal(event.defaultPrevented, true, `Active recognized ${key} must be consumed before the existing command route.`);
      const { announcement: beforeAnnouncement, ...beforeNonAnnouncement } = before;
      const { announcement: afterAnnouncement, ...afterNonAnnouncement } = after;
      assert.deepEqual(
        afterNonAnnouncement,
        beforeNonAnnouncement,
        `Rejected ${command} must retain canonical state, persistence, replay, C03 preview/help/disabled state, and accepted presentation effects.`,
      );
      assert.equal(
        afterAnnouncement,
        `${api.commandLabel(command, language)}: ${api.commandRejectText(direct.reason, language)}.`,
        `Rejected ${command} must announce its exact current-language public-core reason.`,
      );
      assert.notEqual(afterAnnouncement, beforeAnnouncement, `Rejected ${command} must reveal feedback instead of silently doing nothing.`);
    };

    assertRejectedActiveKey("d", "DISRUPT");
    assertRejectedActiveKey("r", "RECOVER");

    browser.element("lang-toggle").click();
    assertRejectedActiveKey("r", "RECOVER", "ko");
    browser.element("lang-toggle").click();

    const assertKeyboardNoop = (label, key, overrides = {}) => {
      const before = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls });
      const event = browser.key(key, overrides);
      assert.deepEqual(
        keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls }),
        before,
        `${label} must leave announcement, canonical state, persistence, replay, C03 projection, and accepted effects unchanged.`,
      );
      return event;
    };

    assert.equal(assertKeyboardNoop("Already-prevented recognized key", "d", { defaultPrevented: true }).defaultPrevented, true);
    for (const [label, modifier] of [["Alt", "altKey"], ["Ctrl", "ctrlKey"], ["Meta", "metaKey"]]) {
      assert.equal(assertKeyboardNoop(`${label}-modified recognized key`, "d", { [modifier]: true }).defaultPrevented, false);
    }
    const input = new FakeElement(browser.document, { tagName: "input" });
    input.focus();
    assert.equal(assertKeyboardNoop("Focused INPUT recognized key", "d").defaultPrevented, false);
    browser.document.activeElement = browser.document.body;
    assert.equal(assertKeyboardNoop("Unrecognized active key", "x").defaultPrevented, false);

    api.setFixture({ nextEncounter: initial, nextSurface: "lobby" });
    api.render();
    assert.equal(assertKeyboardNoop("Lobby recognized key", "d").defaultPrevented, false);

    const terminal = terminalCoreRun(0);
    api.setFixture({
      nextEncounter: terminal.replay.state,
      nextSurface: "terminal",
      nextSequence: terminal.records.length,
      nextRecords: terminal.records,
      nextStageJournals: [terminal.records],
      nextOutcomes: [terminal.replay.state.outcome],
      nextTotalCommandsRun: terminal.records.length,
    });
    api.render();
    assert.equal(assertKeyboardNoop("Terminal-surface recognized key", "d").defaultPrevented, false);

    api.setFixture({
      nextEncounter: terminal.replay.state,
      nextSurface: "play",
      nextSequence: terminal.records.length,
      nextRecords: terminal.records,
      nextStageJournals: [terminal.records],
      nextOutcomes: [terminal.replay.state.outcome],
      nextTotalCommandsRun: terminal.records.length,
    });
    api.render();
    assert.equal(assertKeyboardNoop("Play-surface terminal-state recognized key", "d").defaultPrevented, false);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    fixture.restore();
  }
});

test("C04 accepted STRIKE keyboard path exactly matches pointer and public-core records", async () => {
  const pointerStorage = new FakeStorage();
  const keyboardStorage = new FakeStorage();
  const pointer = await loadApp({ storage: pointerStorage, includePresentation: true, withAudio: true });
  const keyboard = await loadApp({ storage: keyboardStorage, includePresentation: true, withAudio: true });
  try {
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    const record = core.makeCommand("STRIKE", initial.round, 1);
    const result = core.reduceEncounter(initial, record);
    assert.equal(result.accepted, true, "Initial Stage 1 STRIKE must remain public-core accepted.");

    const pointerApi = pointer.app.__stage1TestApi;
    const keyboardApi = keyboard.app.__stage1TestApi;
    pointerApi.setFixture({ nextEncounter: core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0), nextSurface: "play", nextStageJournals: [[]] });
    pointerApi.render();
    keyboardApi.setFixture({ nextEncounter: core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0), nextSurface: "play", nextStageJournals: [[]] });
    keyboardApi.render();
    pointer.browser.command("STRIKE").click();
    const event = keyboard.browser.key("s");
    assert.equal(event.defaultPrevented, true, "Active recognized STRIKE must be consumed.");
    const expected = {
      encounter: result.state,
      sequence: 1,
      records: [record],
      stageJournals: [[record]],
      outcomes: [],
      settlement: null,
      totalCommandsRun: 1,
    };
    assert.deepEqual(pointerApi.canonicalSnapshot(), expected, "The established pointer path must commit the exact public-core STRIKE record and result.");
    assert.deepEqual(keyboardApi.canonicalSnapshot(), expected, "The keyboard path must commit no keyboard-only record or state shape.");
    assert.deepEqual(keyboardApi.canonicalSnapshot(), pointerApi.canonicalSnapshot(), "Keyboard and pointer STRIKE must have identical canonical state, trace, journals, and sequence.");
    assert.equal(
      keyboardStorage.values.get("abyssal_surge_save"),
      pointerStorage.values.get("abyssal_surge_save"),
      "Keyboard and pointer STRIKE must persist identical C02 journal bytes.",
    );
    assert.deepEqual(
      nonAnnouncementProjection(keyboard.browser, { includePresentation: true }),
      nonAnnouncementProjection(pointer.browser, { includePresentation: true }),
      "Keyboard and pointer STRIKE must retain the same accepted visible and presentation projection.",
    );
  } finally {
    pointer.restore();
    keyboard.restore();
  }
});

test("C04 resumed Stage 2 keyboard RECOVER rejection preserves replay state before legal DISRUPT continues", async () => {
  const terminalStageOne = terminalCoreRun(0);
  const stageTwoInitial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[1], 1);
  const legalDisrupt = core.makeCommand("DISRUPT", stageTwoInitial.round, 1);
  const afterDisrupt = core.reduceEncounter(stageTwoInitial, legalDisrupt);
  assert.equal(afterDisrupt.accepted, true, "The resumed Stage 2 fixture must retain a legal DISRUPT continuation.");
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [terminalStageOne.records, []],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const restored = await loadApp({ storage, includePresentation: true, withAudio: true });
  try {
    const { browser, app, replayCalls, audio } = restored;
    browser.element("resume-button").click();
    const api = app.__stage1TestApi;
    assert.equal(campaignStage(browser), 2, "C02 must resume into Stage 2 before keyboard continuity is tested.");
    assertActiveCommandProjection({ browser, api, state: stageTwoInitial, sequence: 0 });
    const rejected = core.reduceEncounter(stageTwoInitial, core.makeCommand("RECOVER", stageTwoInitial.round, 1));
    assert.equal(rejected.accepted, false);
    const before = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls: 0 });
    const rejectedEvent = browser.key("r");
    const after = keyboardAttemptSnapshot({ browser, api, storage, replayCalls, audio, timerCalls: 0 });
    assert.equal(rejectedEvent.defaultPrevented, true, "An active resumed recognized RECOVER must be consumed.");
    const { announcement: beforeAnnouncement, ...beforeNonAnnouncement } = before;
    const { announcement: afterAnnouncement, ...afterNonAnnouncement } = after;
    assert.deepEqual(
      afterNonAnnouncement,
      beforeNonAnnouncement,
      "The resumed rejected key must preserve replay-derived canonical state, saved journals, replay, C03 projection, and accepted effects.",
    );
    assert.notEqual(afterAnnouncement, beforeAnnouncement, "The resumed rejected key must not remain silent.");
    assert.equal(
      afterAnnouncement,
      `${api.commandLabel("RECOVER")}: ${api.commandRejectText(rejected.reason)}.`,
      "The resumed rejected key must announce the direct public-core FOCUS_CAP reason.",
    );

    const acceptedEvent = browser.key("d");
    assert.equal(acceptedEvent.defaultPrevented, true, "The later legal resumed DISRUPT must still be consumed.");
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: afterDisrupt.state,
        sequence: 1,
        records: [legalDisrupt],
        stageJournals: [terminalStageOne.records, [legalDisrupt]],
        outcomes: [terminalStageOne.replay.state.outcome],
        settlement: null,
        totalCommandsRun: terminalStageOne.records.length + 1,
      },
      "The later legal keyboard DISRUPT must continue the exact next public-core record and sequence after rejection.",
    );
    assert.deepEqual(
      JSON.parse(storage.values.get("abyssal_surge_save")).stageJournals,
      [terminalStageOne.records, [legalDisrupt]],
      "The resumed persisted journal must exclude rejected RECOVER and include only the later legal DISRUPT.",
    );
  } finally {
    restored.restore();
  }
});


test("Stage 4 all-accepted and terminal/non-play command-help branches retain the localized baseline", async () => {
  const fixture = await loadApp();
  try {
    const api = fixture.app.__stage1TestApi;
    const stageFourInitial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[3], 3);
    const brace = core.makeCommand("BRACE", stageFourInitial.round, 1);
    const afterBrace = core.reduceEncounter(stageFourInitial, brace);
    assert.equal(afterBrace.accepted, true, "The authorized Stage 4 fixture must begin with an accepted BRACE.");
    assert.equal(afterBrace.state.foe_intent, "SURGE");
    assert.equal(afterBrace.state.focus, 2);

    const allAccepted = directCommandPreviews(afterBrace.state, 1);
    assert.ok(allAccepted.every(({ preview }) => preview.accepted), "Stage 4 BRACE -> SURGE/focus=2 must accept all current commands.");
    api.setFixture({
      nextEncounter: afterBrace.state,
      nextSurface: "play",
      nextSequence: 1,
      nextRecords: [brace],
      nextStageJournals: [[], [], [], [brace]],
      nextEncounterIndex: 3,
      nextTotalCommandsRun: 1,
    });
    api.render();
    for (const { command } of allAccepted) assert.equal(fixture.browser.command(command).disabled, false);
    assert.equal(fixture.browser.element("command-help").textContent, api.dictionaryFor().commandHelp);

    const terminal = coreAcceptedRun(["STRIKE", "STRIKE", "STRIKE"]);
    api.setFixture({
      nextEncounter: terminal.replay.state,
      nextSurface: "terminal",
      nextSequence: terminal.records.length,
      nextRecords: terminal.records,
      nextStageJournals: [terminal.records],
      nextTotalCommandsRun: terminal.records.length,
    });
    api.render();
    assert.equal(fixture.browser.element("command-help").textContent, api.dictionaryFor().commandHelp);
    assert.equal(
      fixture.browser.element("command-help").textContent.includes(api.commandRejectText("ACTIVE_TERMINAL_VALUE")),
      false,
      "Terminal presentation must not substitute a terminal rejection reason for command help.",
    );

    api.setFixture({ nextEncounter: afterBrace.state, nextSurface: "lobby", nextEncounterIndex: 3 });
    api.render();
    assert.equal(fixture.browser.element("command-help").textContent, api.dictionaryFor().commandHelp);
    api.setFixture({
      nextEncounter: afterBrace.state,
      nextSurface: "play",
      nextSequence: 1,
      nextRecords: [brace],
      nextStageJournals: [[], [], [], [brace]],
      nextEncounterIndex: 3,
      nextTotalCommandsRun: 1,
    });
    api.render();
    fixture.browser.element("lang-toggle").click();
    assert.equal(
      fixture.browser.element("command-help").textContent,
      api.dictionaryFor("ko").commandHelp,
      "The authorized all-accepted Stage 4 fixture must retain its exact Korean baseline.",
    );

    api.setFixture({
      nextEncounter: terminal.replay.state,
      nextSurface: "terminal",
      nextSequence: terminal.records.length,
      nextRecords: terminal.records,
      nextStageJournals: [terminal.records],
      nextTotalCommandsRun: terminal.records.length,
    });
    api.render();
    assert.equal(
      fixture.browser.element("command-help").textContent,
      api.dictionaryFor("ko").commandHelp,
      "The terminal branch must retain its exact Korean baseline.",
    );

    api.setFixture({ nextEncounter: afterBrace.state, nextSurface: "lobby", nextEncounterIndex: 3 });
    api.render();
    assert.equal(
      fixture.browser.element("command-help").textContent,
      api.dictionaryFor("ko").commandHelp,
      "The lobby branch must retain its exact Korean baseline.",
    );
  } finally {
    fixture.restore();
  }
});

test("isolated availability previews recalculate status without canonical, persistence, or presentation effects", async () => {
  const storage = new FakeStorage();
  const isolated = await loadApp({ storage, includePresentation: true, withAudio: true });
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  let timerCalls = 0;
  try {
    const api = isolated.app.__stage1TestApi;
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    api.setFixture({ nextEncounter: initial, nextSurface: "play" });
    const canonicalBefore = api.canonicalSnapshot();
    const storageBefore = [storage.getCalls, storage.setCalls, storage.removeCalls];
    const presentationBefore = {
      commandHelp: isolated.browser.element("command-help").textContent,
      disabled: core.COMMANDS.map((command) => [command, isolated.browser.command(command).disabled]),
      audio: [...isolated.audio.tracks.entries()].map(([src, track]) => [src, track.playCalls, track.pauseCalls]),
      fxClass: isolated.browser.element("fx-overlay").className,
      knightDamage: isolated.browser.element("knight-avatar").classList.contains("damage-flash"),
      voidDamage: isolated.browser.element("void-avatar").classList.contains("damage-flash"),
      units: isolated.browser.element("units-container").children.length,
    };
    globalThis.setTimeout = () => {
      timerCalls += 1;
      return 1;
    };
    globalThis.setInterval = () => {
      timerCalls += 1;
      return 1;
    };

    assert.deepEqual(api.previewCommands(), directCommandPreviews(initial, 0));
    assert.deepEqual(api.canonicalSnapshot(), canonicalBefore, "Previewing must not mutate encounter, sequence, records, journals, outcomes, settlement, or accepted-command total.");
    assert.deepEqual([storage.getCalls, storage.setCalls, storage.removeCalls], storageBefore, "Previewing must not read, write, or remove persisted state.");
    assert.equal(isolated.replayCalls.length, 0, "Previewing must not dispatch or replay a command.");
    assert.equal(timerCalls, 0, "Previewing must not schedule timers.");
    assert.deepEqual(
      {
        commandHelp: isolated.browser.element("command-help").textContent,
        disabled: core.COMMANDS.map((command) => [command, isolated.browser.command(command).disabled]),
        audio: [...isolated.audio.tracks.entries()].map(([src, track]) => [src, track.playCalls, track.pauseCalls]),
        fxClass: isolated.browser.element("fx-overlay").className,
        knightDamage: isolated.browser.element("knight-avatar").classList.contains("damage-flash"),
        voidDamage: isolated.browser.element("void-avatar").classList.contains("damage-flash"),
        units: isolated.browser.element("units-container").children.length,
      },
      presentationBefore,
      "Previewing must not create DOM, audio, VFX, avatar, or unit presentation effects.",
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    isolated.restore();
  }
});

test("C06 initializes only the existing idle announcement for fresh English and saved Korean lobby startup", async () => {
  const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
  const assertIdleStartup = ({ fixture, lang, rawPersisted = null }) => {
    const { browser, replayCalls, storage, audio, app } = fixture;
    const api = app.__stage1TestApi;
    assert.equal(browser.element("announcement").textContent, api.dictionaryFor(lang).terminalIdle);
    assert.deepEqual(
      api.canonicalSnapshot(),
      {
        encounter: initial,
        sequence: 0,
        records: [],
        stageJournals: [[]],
        outcomes: [],
        settlement: null,
        totalCommandsRun: 0,
      },
      "Idle startup must retain the untouched initial C02 canonical state.",
    );
    assert.deepEqual(api.previewCommands(), directCommandPreviews(initial, 0), "Idle startup must retain C03's direct-core projection.");
    assertHotkeyGuideProjection({ browser, api, lang });
    assert.equal(replayCalls.length, 0, "Idle startup must not replay or dispatch a command.");
    assert.equal(storage.setCalls, 0, "Idle startup must not write persistence.");
    assert.equal(storage.getItem("abyssal_surge_save"), rawPersisted, "Idle startup must retain the raw C02 save bytes.");
    assert.equal(browser.element("fx-overlay").classList.contains("accepted"), false);
    assert.equal(browser.element("knight-avatar").classList.contains("damage-flash"), false);
    assert.equal(browser.element("void-avatar").classList.contains("damage-flash"), false);
    assert.equal(browser.element("units-container").children.length, 0);
    assert.equal(browser.pendingAnimationFrames(), 0);
    assert.ok(
      [...audio.tracks.values()].every((track) => track.playCalls === 0),
      "Idle startup must not play accepted-command audio.",
    );
  };

  const freshStorage = new FakeStorage();
  const fresh = await loadApp({ storage: freshStorage, includePresentation: true, withAudio: true });
  try {
    assertIdleStartup({ fixture: fresh, lang: "en" });
  } finally {
    fresh.restore();
  }

  const savedPayload = {
    stageJournals: [[]],
    currentLang: "ko",
    volumeBgm: 0.5,
    volumeSfx: 0.8,
    volumeNarr: 1,
  };
  const rawSavedPayload = JSON.stringify(savedPayload);
  const savedStorage = new FakeStorage({ abyssal_surge_save: rawSavedPayload });
  const saved = await loadApp({ storage: savedStorage, includePresentation: true, withAudio: true });
  try {
    assertIdleStartup({ fixture: saved, lang: "ko", rawPersisted: rawSavedPayload });
    assert.deepEqual(savedOwnKeys(savedStorage), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
  } finally {
    saved.restore();
  }
});

test("C06 reprojects only lobby idle text across English and Korean while retaining C02-C05 state", async () => {
  const persisted = {
    stageJournals: [[]],
    currentLang: "en",
    volumeBgm: 0.5,
    volumeSfx: 0.8,
    volumeNarr: 1,
  };
  const storage = new FakeStorage({ abyssal_surge_save: JSON.stringify(persisted) });
  const fixture = await loadApp({ storage, includePresentation: true, withAudio: true });
  try {
    const { browser, replayCalls, audio, app } = fixture;
    const api = app.__stage1TestApi;
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    const baseline = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      c03: JSON.parse(JSON.stringify(api.previewCommands())),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
    };
    assert.equal(browser.element("announcement").textContent, api.dictionaryFor("en").terminalIdle);
    assertHotkeyGuideProjection({ browser, api, lang: "en" });

    browser.element("lang-toggle").click();

    assert.equal(api.currentLang(), "ko");
    assert.equal(browser.element("announcement").textContent, api.dictionaryFor("ko").terminalIdle);
    assert.deepEqual(api.canonicalSnapshot(), baseline.canonical);
    assert.deepEqual(replayCalls, baseline.replayCalls, "Lobby idle localization must not replay.");
    assert.deepEqual(api.previewCommands(), baseline.c03, "Lobby idle localization must retain C03 previews.");
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), baseline.disabled);
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), baseline.effects, "Lobby idle localization must not create accepted effects.");
    const koreanSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(Object.keys(koreanSave).sort(), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual({ ...koreanSave, currentLang: "en" }, persisted, "The existing toggle may change only C02 currentLang.");

    browser.element("lang-toggle").click();

    assert.equal(api.currentLang(), "en");
    assert.equal(browser.element("announcement").textContent, api.dictionaryFor("en").terminalIdle);
    assert.deepEqual(api.canonicalSnapshot(), baseline.canonical);
    assert.deepEqual(replayCalls, baseline.replayCalls);
    assert.deepEqual(api.previewCommands(), baseline.c03);
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), baseline.disabled);
    assertHotkeyGuideProjection({ browser, api, lang: "en" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), baseline.effects);
    assert.deepEqual(JSON.parse(storage.getItem("abyssal_surge_save")), persisted);
  } finally {
    fixture.restore();
  }
});

test("C06 preserves C02 active and terminal-resume announcements byte-for-byte across language toggles", async () => {
  const terminalStageOne = terminalCoreRun(0);
  const activeStorage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [terminalStageOne.records, []],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const active = await loadApp({ storage: activeStorage, includePresentation: true, withAudio: true });
  try {
    const { browser, replayCalls, audio, app } = active;
    const api = app.__stage1TestApi;
    const stageTwoInitial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[1], 1);
    browser.element("resume-button").click();
    const activeAnnouncement = browser.element("announcement").textContent;
    assert.notEqual(activeAnnouncement, api.dictionaryFor("en").terminalIdle, "C02 active resume must retain its established encounter-start message.");
    const baseline = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      c03: assertActiveCommandProjection({ browser, api, state: stageTwoInitial, sequence: 0 }),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
      persisted: JSON.parse(activeStorage.getItem("abyssal_surge_save")),
    };

    browser.element("lang-toggle").click();

    assert.equal(browser.element("announcement").textContent, activeAnnouncement, "C02 active resume text must not be historically retranslated.");
    assert.deepEqual(api.canonicalSnapshot(), baseline.canonical);
    assert.deepEqual(replayCalls, baseline.replayCalls);
    assert.deepEqual(api.previewCommands(), baseline.c03);
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), baseline.disabled);
    assertActiveCommandProjection({ browser, api, state: stageTwoInitial, sequence: 0 });
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), baseline.effects);
    const koreanSave = JSON.parse(activeStorage.getItem("abyssal_surge_save"));
    assert.deepEqual(Object.keys(koreanSave).sort(), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual({ ...koreanSave, currentLang: "en" }, baseline.persisted);
  } finally {
    active.restore();
  }

  const terminalStorage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [terminalStageOne.records],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const terminal = await loadApp({ storage: terminalStorage, includePresentation: true, withAudio: true });
  try {
    const { browser, replayCalls, audio, app } = terminal;
    const api = app.__stage1TestApi;
    browser.element("resume-button").click();
    const terminalAnnouncement = browser.element("announcement").textContent;
    assert.equal(browser.element("terminal-screen").hidden, false);
    assert.equal(terminalAnnouncement, api.dictionaryFor("en").terminalIdle, "The C02 terminal fixture must exercise the idle-string collision.");
    const baseline = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      c03: JSON.parse(JSON.stringify(api.previewCommands())),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
      persisted: JSON.parse(terminalStorage.getItem("abyssal_surge_save")),
    };

    browser.element("lang-toggle").click();

    assert.equal(browser.element("announcement").textContent, terminalAnnouncement, "C02 terminal resume must remain excluded even when its text equals terminalIdle.");
    assert.deepEqual(api.canonicalSnapshot(), baseline.canonical);
    assert.deepEqual(replayCalls, baseline.replayCalls);
    assert.deepEqual(api.previewCommands(), baseline.c03);
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), baseline.disabled);
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), baseline.effects);
    const koreanSave = JSON.parse(terminalStorage.getItem("abyssal_surge_save"));
    assert.deepEqual(Object.keys(koreanSave).sort(), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual({ ...koreanSave, currentLang: "en" }, baseline.persisted);
  } finally {
    terminal.restore();
  }
});

test("C06 retains C04 rejected and accepted command messages across language toggles", async () => {
  const storage = new FakeStorage({
    abyssal_surge_save: JSON.stringify({
      stageJournals: [[]],
      currentLang: "en",
      volumeBgm: 0.5,
      volumeSfx: 0.8,
      volumeNarr: 1,
    }),
  });
  const fixture = await loadApp({ storage, includePresentation: true, withAudio: true });
  try {
    const { browser, replayCalls, audio, app } = fixture;
    const api = app.__stage1TestApi;
    const initial = core.initialEncounter(core.CAMPAIGN_SCHEDULES[0], 0);
    browser.element("begin-button").click();
    const rejected = core.reduceEncounter(initial, core.makeCommand("DISRUPT", initial.round, 1));
    assert.equal(rejected.accepted, false);
    browser.key("d");
    const rejectedAnnouncement = browser.element("announcement").textContent;
    const rejectedBaseline = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      c03: assertActiveCommandProjection({ browser, api, state: initial, sequence: 0 }),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
    };

    browser.element("lang-toggle").click();

    assert.equal(browser.element("announcement").textContent, rejectedAnnouncement, "C04 rejection feedback must not be retranslated.");
    assert.deepEqual(api.canonicalSnapshot(), rejectedBaseline.canonical);
    assert.deepEqual(replayCalls, rejectedBaseline.replayCalls);
    assert.deepEqual(api.previewCommands(), rejectedBaseline.c03);
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), rejectedBaseline.disabled);
    assertActiveCommandProjection({ browser, api, state: initial, sequence: 0 });
    assertHotkeyGuideProjection({ browser, api, lang: "ko" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), rejectedBaseline.effects);

    const strike = core.makeCommand("STRIKE", initial.round, 1);
    const accepted = core.reduceEncounter(initial, strike);
    assert.equal(accepted.accepted, true);
    browser.key("s");
    const acceptedAnnouncement = browser.element("announcement").textContent;
    const acceptedBaseline = {
      canonical: api.canonicalSnapshot(),
      replayCalls: JSON.parse(JSON.stringify(replayCalls)),
      c03: JSON.parse(JSON.stringify(api.previewCommands())),
      disabled: core.COMMANDS.map((command) => [command, browser.command(command).disabled]),
      effects: acceptedPresentationSnapshot(browser, audio),
      persisted: JSON.parse(storage.getItem("abyssal_surge_save")),
    };

    browser.element("lang-toggle").click();

    assert.equal(browser.element("announcement").textContent, acceptedAnnouncement, "Accepted C04 feedback must not be retranslated.");
    assert.deepEqual(api.canonicalSnapshot(), acceptedBaseline.canonical);
    assert.deepEqual(replayCalls, acceptedBaseline.replayCalls);
    assert.deepEqual(api.previewCommands(), acceptedBaseline.c03);
    assert.deepEqual(core.COMMANDS.map((command) => [command, browser.command(command).disabled]), acceptedBaseline.disabled);
    assertHotkeyGuideProjection({ browser, api, lang: "en" });
    assert.deepEqual(acceptedPresentationSnapshot(browser, audio), acceptedBaseline.effects, "Toggling must not duplicate accepted-command effects.");
    const englishSave = JSON.parse(storage.getItem("abyssal_surge_save"));
    assert.deepEqual(Object.keys(englishSave).sort(), ["currentLang", "stageJournals", "volumeBgm", "volumeNarr", "volumeSfx"]);
    assert.deepEqual({ ...englishSave, currentLang: "ko" }, acceptedBaseline.persisted);
  } finally {
    fixture.restore();
  }
});

test("Pages publishes the disclosure page with the static runtime closure", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/static.yml"), "utf8");
  const staticRuntimeFiles = [
    "index.html",
    "app.js",
    "game-core.js",
    "styles.css",
    "privacy.html",
    "sw.js",
    "manifest.json",
    "icon.svg",
  ];
  const archiveClosure = [...staticRuntimeFiles, "assets"];
  const guardFiles = workflow.match(/for\s+file\s+in\s+([\s\S]*?)\s*;\s*do/)?.[1].trim().split(/\s+/);
  const archiveFiles = workflow.match(/\bgit\s+archive\b[\s\S]*?\s--\s+([\s\S]*?)\s*\|\s*tar\b/)?.[1].trim().split(/\s+/);
  const inventorySource = workflow.match(/^\s*expected="\$\(git ls-tree -r --name-only "\$PAGES_REVISION" -- ([^|]*?)\s*\|\s*sort\)"/m)?.[1].trim().split(/\s+/);

  assert.ok(guardFiles, "Pages must guard every committed static runtime file before archiving.");
  assert.ok(archiveFiles, "Pages must explicitly archive the static runtime closure.");
  assert.ok(inventorySource, "Pages must derive the artifact inventory from the same committed allowlist.");

  assert.deepEqual([...guardFiles].sort(), [...staticRuntimeFiles].sort(), "The Pages guard must cover every root static runtime file (incl. PWA closure).");
  assert.deepEqual([...archiveFiles].sort(), [...archiveClosure].sort(), "The Pages archive must ship the static runtime closure plus the assets tree.");
  assert.deepEqual([...inventorySource].sort(), [...archiveClosure].sort(), "The Pages inventory check must compare against the exact same allowlist.");
  assert.match(workflow, /node --check sw\.js/, "The Pages guard must syntax-check the service worker before shipping it.");
});

test("stage1-rules-v2 migration guard: v2 is pinned and stale v1 records are rejected", async () => {
  const core = await import(coreUrl);
  assert.equal(core.RULES_VERSION, "stage1-rules-v2", "Balance handoff pins the economy to stage1-rules-v2.");

  const encounter = core.initialEncounter(core.CAMPAIGN_SCHEDULES[4], 4);
  const staleV1Record = Object.freeze({
    rules_version: "stage1-rules-v1",
    command: "DISRUPT",
    tick: 0,
    sequence: 1,
  });
  const result = core.reduceEncounter(encounter, staleV1Record);
  assert.equal(result.accepted, false, "A stale stage1-rules-v1 record must be rejected, not reinterpreted under the v2 economy.");
  assert.equal(result.reason, "RULES_VERSION", "Rejection must name the rules-version mismatch.");

  const freshRecord = core.makeCommand("DISRUPT", 0, 1);
  const ok = core.reduceEncounter(encounter, freshRecord);
  assert.equal(ok.accepted, true, "The same command under the live rules version must remain accepted.");
});
