import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(resolve(root, "app.js"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const coreUrl = pathToFileURL(resolve(root, "game-core.js")).href;
let moduleNonce = 0;

class FakeElement {
  constructor(document, { id = "", dataset = {}, hidden = false, tagName = "div" } = {}) {
    this.document = document;
    this.id = id;
    this.dataset = dataset;
    this.hidden = hidden;
    this.tagName = tagName.toUpperCase();
    this.textContent = "";
    this.disabled = false;
    this.children = [];
    this.listeners = new Map();
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

  replaceChildren(...children) {
    this.children = children;
  }
}

function createBrowser() {
  const elements = new Map();
  const commandButtons = [];
  const documentListeners = new Map();
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
    "threat-copy",
    "begin-button",
    "continue-button",
    "restart-button",
  ]) add(id, { tagName: id.endsWith("button") ? "button" : "div" });
  for (const command of ["STRIKE", "BRACE", "DISRUPT", "RECOVER"]) {
    commandButtons.push(new FakeElement(document, { dataset: { command }, tagName: "button" }));
  }

  return {
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

async function loadApp({ replayOverride } = {}) {
  const browser = createBrowser();
  const replayCalls = [];
  const priorDocument = globalThis.document;
  const hadDocument = Object.hasOwn(globalThis, "document");
  const priorRaf = globalThis.requestAnimationFrame;
  const hadRaf = Object.hasOwn(globalThis, "requestAnimationFrame");
  const priorReplaySpy = globalThis.__stage1ReplaySpy;
  const hadReplaySpy = Object.hasOwn(globalThis, "__stage1ReplaySpy");
  const priorReplayOverride = globalThis.__stage1ReplayOverride;
  const hadReplayOverride = Object.hasOwn(globalThis, "__stage1ReplayOverride");

  globalThis.document = browser.document;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.__stage1ReplaySpy = (schedule, inputRecords) => replayCalls.push({ schedule, records: inputRecords });
  globalThis.__stage1ReplayOverride = replayOverride;

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

  try {
    await import(dataModule(`${rewritten}\n// app harness ${++moduleNonce}`));
  } catch (error) {
    restore();
    throw error;
  }

  function restore() {
    if (hadDocument) globalThis.document = priorDocument;
    else delete globalThis.document;
    if (hadRaf) globalThis.requestAnimationFrame = priorRaf;
    else delete globalThis.requestAnimationFrame;
    if (hadReplaySpy) globalThis.__stage1ReplaySpy = priorReplaySpy;
    else delete globalThis.__stage1ReplaySpy;
    if (hadReplayOverride) globalThis.__stage1ReplayOverride = priorReplayOverride;
    else delete globalThis.__stage1ReplayOverride;
  }

  return { browser, replayCalls, restore };
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

  const expectedRecords = [
    { rules_version: "stage1-rules-v1", command: "STRIKE", tick: 0, sequence: 1 },
    { rules_version: "stage1-rules-v1", command: "STRIKE", tick: 1, sequence: 2 },
    { rules_version: "stage1-rules-v1", command: "STRIKE", tick: 2, sequence: 3 },
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
