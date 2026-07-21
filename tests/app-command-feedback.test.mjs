import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  FIELD_ITEM_CATALOG,
  STAGES,
  SUMMON_RECIPES,
  applyAction,
  applyEncounterEvent,
  createCampaign,
  getStageChecklist,
  reserveCommand,
  startCampaign,
} from "../campaign-state.js";
import { resolveBossPhase } from "../combat-systems.js";
import { translate, translations } from "../i18n.js";

async function loadBattleVisualTrigger({ hasRenderer = false } = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const definition = source.match(
    /function triggerBattleVisual\(action, details = \{\}\) \{[\s\S]*?\n\}(?=\n\nfunction startActionCooldown)/,
  );
  assert.ok(definition, "app runtime must expose the command-to-battle-feedback dispatcher");

  const rendererCalls = [];
  const effectCalls = [];
  const cueCalls = [];
  const context = vm.createContext({
    campaign: Object.freeze({ status: "active" }),
    visualizer: hasRenderer
      ? { playActionEffect: (semantic) => rendererCalls.push(semantic) }
      : null,
    BATTLE_ACTION_SEMANTICS: Object.freeze({
      materialize: Object.freeze({ source: "portal", target: "portal", clip: "Activate" }),
    }),
    flashEffect: (action) => effectCalls.push(action),
    playCue: (action) => cueCalls.push(action),
  });
  vm.runInContext(`${definition[0]}\nglobalThis.triggerBattleVisual = triggerBattleVisual;`, context, { filename: "app.js" });

  return {
    trigger: (action, details) => context.triggerBattleVisual(action, details),
    rendererCalls,
    effectCalls,
    cueCalls,
  };
}
function appFunction(source, name, nextName) {
  const definition = source.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}(?=\\s*(?:async\\s+)?function ${nextName}\\()`),
  );
  assert.ok(definition, `app runtime must expose ${name}`);
  return definition[0];
}

function terminalAppFunction(source, name, invocation) {
  const definition = source.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}(?=\\s*${invocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`),
  );
  assert.ok(definition, `app runtime must expose terminal function ${name}`);
  return definition[0];
}

async function loadKoreanCommandCopy() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const stage = {
    progression: {
      huntGoal: 2,
      soulsPerExtract: 4,
      materializeCost: 4,
      materializeSummon: 2,
    },
    commands: {
      domain: { integrityRestore: 3, aegis: 2 },
      assault: {
        damage: 3,
        counter: { mode: "threshold", minimumLegion: 4, readyDamage: 1, belowDamage: 3 },
      },
    },
  };
  const campaign = {
    stage: { hunted: 1, souls: 4, legion: 1, capacity: 8, possessed: false },
  };
  const benefits = { materializeBonus: 1, possessedAssaultBonus: 0, counterReduction: 0 };
  const context = vm.createContext({
    campaign,
    currentStage: () => stage,
    getCampaignBenefits: () => benefits,
  });
  const definitions = [
    appFunction(source, "calculateAssaultDamage", "calculateCounterDamage"),
    appFunction(source, "calculateCounterDamage", "getCommandDescription"),
    appFunction(source, "getCommandDescription", "getCommandLockReason"),
  ];
  vm.runInContext(`${definitions.join("\n\n")}\nglobalThis.describeCommand = getCommandDescription;`, context, { filename: "app.js" });
  return (action) => context.describeCommand(action, true, "ko");
}

async function loadStatusTranslator() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const context = vm.createContext({ STAGES, translate });
  const definition = appFunction(source, "translateStatusMessage", "updateResumeAffordance");
  vm.runInContext(`${definition}\nglobalThis.translateStatus = translateStatusMessage;`, context, { filename: "app.js" });
  return (message, lang = "ko") => context.translateStatus(message, lang);
}

async function loadReleaseLocalization(locale) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const elements = {
    saveStatus: { textContent: "" },
    importSave: { value: "" },
    waveIndicator: { dataset: {}, textContent: "" },
    battlePressure: { textContent: "" },
    stageObjective: { textContent: "Capture the Cinder Span node" },
    souls: { textContent: "4 / 8" },
    legion: { textContent: "2 / 6" },
    nodes: { textContent: "1 / 1" },
    integrity: { textContent: "8 / 10" },
    bossLabel: { textContent: "Warden" },
    boss: { textContent: "6 / 8" },
    battleScreenObjective: { textContent: "" },
    battleScreenPressure: { textContent: "" },
    battleScreenWave: { textContent: "" },
    battleScreenSouls: { textContent: "" },
    battleScreenLegion: { textContent: "" },
    battleScreenNodes: { textContent: "" },
    battleScreenIntegrity: { textContent: "" },
    battleScreenBoss: { textContent: "" },
  };
  const confirmations = [];
  const createdAnchors = [];
  const context = vm.createContext({
    Blob,
    URL: {
      createObjectURL: () => "blob:campaign-save",
      revokeObjectURL: () => {},
    },
    MAX_IMPORT_BYTES: 256 * 1024,
    battleVisualFallback: false,
    campaign: { status: "active", trace: [{ kind: "start" }] },
    campaignMirror: { authorize: () => true, publish: () => {} },
    createCampaign: () => ({ status: "briefing", trace: [] }),
    createSaveEnvelope: () => ({ schema: "test-save" }),
    currentLang: () => locale,
    document: {
      createElement: () => {
        const anchor = { click: () => {} };
        createdAnchors.push(anchor);
        return anchor;
      },
    },
    elements,
    flashEffect: () => {},
    openCurrentStageBriefing: () => {},
    restoreSaveEnvelope: () => ({ status: "active", trace: [{ kind: "start" }] }),
    revealCampaign: () => {},
    render: () => {},
    startCampaign: (state) => ({ state }),
    stopBattle: () => {},
    storage: { save: async () => "IndexedDB" },
    translate: (key) => translations[locale][key] ?? key,
    updateResumeAffordance: () => {},
    window: {
      confirm: (message) => {
        confirmations.push(message);
        return false;
      },
      requestAnimationFrame: (callback) => callback(),
      setTimeout: (callback) => callback(),
    },
  });
  const definitions = [
    appFunction(source, "syncBattleScreenHud", "focusPendingCommand"),
    appFunction(source, "setSaveStatus", "translatedResumeText"),
    appFunction(source, "setBattlePressure", "renderBattleAssetStatus"),
    appFunction(source, "persistCampaign", "applyMirroredCampaign"),
    appFunction(source, "applyMirroredCampaign", "triggerBattleVisual"),
    appFunction(source, "beginNewCampaign", "returnToLobby"),
    appFunction(source, "exportSave", "importSave"),
    appFunction(source, "importSave", "toggleAmbience"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}\nglobalThis.releaseUi = { applyMirroredCampaign, beginNewCampaign, exportSave, importSave, persistCampaign, setBattlePressure };`,
    context,
    { filename: "app.js" },
  );
  return { api: context.releaseUi, confirmations, elements, createdAnchors };
}

async function loadStartupStatus(locale, {
  envelope = null,
  source = "IndexedDB",
  storageMode = "indexeddb",
  incompatible = false,
} = {}) {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const elements = {
    mirrorStatus: { textContent: "" },
    saveStatus: { textContent: "" },
  };
  const context = vm.createContext({
    BUILD_TAG: "test-build",
    CampaignMirror: class CampaignMirror {
      start() {
        return { available: true };
      }
      close() {}
    },
    RULES_VERSION: "test-rules",
    applyMirroredCampaign: () => {},
    campaignMirror: null,
    createSaveEnvelope: () => ({ schema: "test-save" }),
    document: { documentElement: { dataset: {} } },
    elements,
    initReactBitsEffects: () => null,
    navigator: {},
    particleBackground: null,
    restoreSaveEnvelope: () => {
      if (incompatible) throw new Error("incompatible fixture");
      return { status: "active", trace: [{ kind: "start" }] };
    },
    storedCampaign: null,
    storage: {
      mode: storageMode,
      open: async () => {},
      load: async () => ({ envelope, source }),
    },
    syncBackgroundEffects: () => {},
    syncCinematicCopy: () => {},
    translate: (key) => translations[locale][key] ?? key,
    updateResumeAffordance: () => {},
    window: { addEventListener: () => {} },
    wireControls: () => {},
  });
  const definitions = [
    appFunction(appSource, "setSaveStatus", "translatedResumeText"),
    terminalAppFunction(appSource, "initialize", "initialize();"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}\nglobalThis.initializeRelease = initialize;`,
    context,
    { filename: "app.js" },
  );
  await context.initializeRelease();
  return elements.saveStatus.textContent;
}

async function loadCommandFocusHotkey() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const commandButtonsDefinition = source.match(
    /commandButtons:\s*(?<expression>\[\.\.\.document\.querySelectorAll\([^)\n]+\)\])/,
  );
  assert.ok(commandButtonsDefinition, "app runtime must collect its command controls");

  const listeners = new Map();
  const createControl = (dataset = {}) => {
    const controlListeners = new Map();
    const control = {
      dataset,
      disabled: false,
      addEventListener: (type, listener) => controlListeners.set(type, listener),
      dispatch: (type, event = {}) => controlListeners.get(type)?.(event),
      focus: () => {
        document.activeElement = control;
      },
    };
    return control;
  };
  const hunt = createControl({ action: "hunt" });
  const assault = createControl({ action: "assault" });
  const fieldFeedback = { dataset: { action: "hunt" } };
  const editable = createControl();
  const body = createControl();
  const documentElement = createControl();
  const document = {
    activeElement: null,
    body,
    documentElement,
    addEventListener: () => {},
    querySelectorAll: (selector) => (
      selector === "button[data-action]" ? [hunt, assault] : [fieldFeedback, hunt, assault]
    ),
  };
  const collectionContext = vm.createContext({ document });
  vm.runInContext(
    `globalThis.commandButtons = ${commandButtonsDefinition.groups.expression};`,
    collectionContext,
    { filename: "app.js" },
  );

  const inertControl = () => createControl();
  const battleCanvas3d = createControl();
  const battleFallbackCanvas = createControl();
  const elements = {
    ambience: inertControl(),
    battleCanvas3d,
    battleFallbackCanvas,
    bgmToggle: null,
    briefing: inertControl(),
    cinematicButton: inertControl(),
    cinematicTranscript: inertControl(),
    cinematicTranscriptToggle: inertControl(),
    commandButtons: collectionContext.commandButtons,
    exportSave: inertControl(),
    importSave: editable,
    restart: inertControl(),
    resultOverlay: { ...inertControl(), querySelectorAll: () => [] },
    resume: inertControl(),
    retry: inertControl(),
    retryFromResult: inertControl(),
    returnToLobby: inertControl(),
    returnToLobbyFromResult: inertControl(),
    start: inertControl(),
    startCombat: inertControl(),
    toggleFullscreen: null,
  };
  const actions = [];
  const previewActions = [];
  const projectedActions = [];
  const context = vm.createContext({
    ACTION_KEYS: Object.freeze({ a: "assault" }),
    BATTLE_ACTION_SEMANTICS: Object.freeze({
      hunt: Object.freeze({ source: "portal", target: "extractor" }),
      assault: Object.freeze({ source: "ally", target: "boss" }),
    }),
    DIGIT_ACTION_KEYS: Object.freeze({ "1": "hunt", digit1: "hunt" }),
    battleUiActive: () => true,
    beginNewCampaign: () => {},
    campaign: { status: "active" },
    currentStage: () => ({ id: "cinder-span" }),
    document,
    elements,
    entryGuidanceStageId: null,
    exportSave: () => {},
    getAvailableActions: () => ["hunt", "assault"],
    handleAction: (action) => actions.push(action),
    handleRetry: () => {},
    handleFullscreenError: () => {},
    importSave: () => {},
    pendingCommandFocus: false,
    projectActionFocus: (action) => projectedActions.push(action),
    playCinematic: () => {},
    refreshNarrationLanguage: () => {},
    refreshSaveStatus: () => {},
    resultOverlayOpen: false,
    resumeCampaign: () => Promise.resolve(),
    returnToLobby: () => Promise.resolve(),
    stageBriefingOpen: true,
    syncAmbienceButtonText: () => {},
    syncCinematicCopy: () => {},
    syncFullscreenControl: () => {},
    toggleAmbience: () => {},
    toggleBgm: () => {},
    toggleCinematicTranscript: () => {},
    toggleFullscreen: () => Promise.resolve(),
    updateResumeAffordance: () => {},
    visualizer: {
      previewAction: (semantic) => previewActions.push(semantic.action),
      clearActionPreview: () => previewActions.push(null),
    },
    window: {
      addEventListener: (type, listener) => listeners.set(type, listener),
    },
  });
  context.render = () => context.focusPendingCommand();
  const definitions = [
    appFunction(source, "currentActionFocus", "updateActionFocus"),
    appFunction(source, "updateActionFocus", "handleActionFocus"),
    appFunction(source, "handleActionFocus", "projectActionFocus"),
    appFunction(source, "focusPendingCommand", "render"),
    appFunction(source, "beginStageCombat", "exportSave"),
    appFunction(source, "wireControls", "startLiquidEtherBackground"),
  ];
  vm.runInContext(
    `let activeFieldFocusedAction = null;\nlet activeCommandHoverAction = null;\nlet activeCommandFocusAction = null;\n${definitions.join("\n\n")}\nglobalThis.focusPendingCommand = focusPendingCommand; globalThis.handleActionFocus = handleActionFocus; wireControls();`,
    context,
    { filename: "app.js" },
  );

  const pressKey = (key, code) => {
    let prevented = false;
    listeners.get("keydown")({
      altKey: false,
      code,
      ctrlKey: false,
      key,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      repeat: false,
    });
    return prevented;
  };
  return {
    actions,
    assault,
    battleCanvas3d,
    battleFallbackCanvas,
    body,
    editable,
    hunt,
    previewActions,
    projectedActions,
    activeElement: () => document.activeElement,
    acknowledgeBriefing: () => elements.startCombat.dispatch("click"),
    focusFieldAction: (action) => context.handleActionFocus(action),
    focusPendingCommand: () => context.focusPendingCommand(),
    setPendingCommandFocus: (value) => { context.pendingCommandFocus = value; },
    setStageBriefingOpen: (value) => { context.stageBriefingOpen = value; },
    pressAssault: () => pressKey("a", "KeyA"),
    pressDigitOne: () => pressKey("1", "Digit1"),
  };
}

async function loadInteractiveBattleActions() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const cooldowns = new Map();
  const context = vm.createContext({
    battleUiActive: () => true,
    campaign: Object.freeze({ status: "active" }),
    getAvailableActions: () => ["hunt"],
    remainingCooldown: (action) => cooldowns.get(action) ?? 0,
    resultOverlayOpen: false,
  });
  const definition = appFunction(source, "getInteractiveBattleActions", "setBattlePressure");
  vm.runInContext(
    `${definition}\nglobalThis.getInteractiveBattleActions = getInteractiveBattleActions;`,
    context,
    { filename: "app.js" },
  );

  return {
    getActions: () => Array.from(context.getInteractiveBattleActions()),
    setCooldown: (action, remaining) => cooldowns.set(action, remaining),
    setResultOverlayOpen: (open) => {
      context.resultOverlayOpen = open;
    },
  };
}


async function loadReactReserveButtonContract() {
  const source = await readFile(new URL("../react-game-ui.js", import.meta.url), "utf8");
  let renderedTree = null;
  const root = { style: {} };
  const React = {
    createElement(type, props, ...children) {
      return {
        type,
        props: {
          ...(props || {}),
          children: children.length <= 1 ? children[0] : children,
        },
        children,
      };
    },
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {},
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => id === "react-game-root" ? root : null,
    },
    window: {
      React,
      ReactDOM: {
        render(tree) {
          renderedTree = tree;
        },
      },
      dispatchEvent: () => {},
    },
  });
  vm.runInContext(source, context, { filename: "react-game-ui.js" });
  assert.ok(renderedTree, "React shell must mount its actual element tree");

  const elements = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (typeof node.type === "function") {
      visit(node.type(node.props || {}));
      return;
    }
    elements.push(node);
    visit(node.children);
  };
  visit(renderedTree);

  const container = elements.find((element) => element.props?.id === "reserve-command");
  const buttons = elements.filter((element) => (
    element.type === "button" &&
    typeof element.props?.["data-reserve-action"] === "string"
  ));
  assert.ok(container, "React shell must instantiate the reserve-command container");
  assert.equal(buttons.length, 7, "React shell must instantiate all seven reserve actions");
  return { container, buttons };
}

async function loadTacticalHudProjection({
  locale = "en",
  progression = {
    marks: 8,
    skills: { command: 1, fortification: 1, mobility: 1 },
    commandQueue: [
      { id: "reserved-hunt", action: "hunt" },
      { id: "reserved-extract", action: "extract" },
    ],
    deployments: [],
  },
  activePlacementMode = null,
  includeReserveControls = false,
  executeReserved = null,
  campaignState = null,
  entryGuidanceStageId = null,
  reserveCommandImpl = null,
} = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const reserveContract = includeReserveControls
    ? await loadReactReserveButtonContract()
    : null;
  const delegatedClickWiring = includeReserveControls
    ? source.match(
      /document\.addEventListener\("click", \(event\) => \{[\s\S]*?\n  \}\);(?=\n\n  elements\.exportSave)/,
    )
    : [""];
  if (includeReserveControls) {
    assert.ok(delegatedClickWiring, "app runtime must expose delegated tactical command wiring");
  }
  const documentListeners = new Map();
  const tacticalProjection = source.match(
    /\/\/ 1\. Render Marks Value[\s\S]*?(?=\n  \/\/ 6\. Update Minimap Snapshot)/,
  );
  assert.ok(tacticalProjection, "app runtime must expose the tactical HUD projection");
  const statusProjection = campaignState
    ? source.match(
      /  const hasRewardCarryMessage = campaign\.lastMessage\.endsWith[\s\S]*?elements\.status\.textContent = statusText;/,
    )
    : [""];
  if (campaignState) {
    assert.ok(statusProjection, "app runtime must expose the campaign status projection");
  }

  let document;
  const selectorAttribute = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
  const attributeValue = (node, name) => {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      return node.dataset[key];
    }
    return node.getAttribute(name);
  };
  const matchesSimpleSelector = (node, selector) => {
    const attributes = [...selector.matchAll(selectorAttribute)];
    let remainder = selector.replace(selectorAttribute, "");
    for (const [, name, value] of attributes) {
      const actual = attributeValue(node, name);
      if (actual === undefined || actual === null || (value !== undefined && String(actual) !== value)) return false;
    }
    const id = remainder.match(/#([\w-]+)/)?.[1];
    if (id && node.id !== id) return false;
    remainder = remainder.replace(/#[\w-]+/, "");
    const classes = [...remainder.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
    const nodeClasses = new Set(String(node.className || "").split(/\s+/).filter(Boolean));
    if (classes.some((className) => !nodeClasses.has(className))) return false;
    const tagName = remainder.replace(/\.[\w-]+/g, "").trim();
    return !tagName || node.tagName === tagName.toUpperCase();
  };
  const descendants = (root) => root.children.flatMap((child) => [child, ...descendants(child)]);
  const matchesSelector = (node, selector, root) => {
    const parts = selector.trim().split(/\s+/);
    if (!matchesSimpleSelector(node, parts.at(-1))) return false;
    let ancestor = node.parentNode;
    for (let index = parts.length - 2; index >= 0; index -= 1) {
      while (ancestor && ancestor !== root.parentNode && !matchesSimpleSelector(ancestor, parts[index])) {
        ancestor = ancestor.parentNode;
      }
      if (!ancestor || ancestor === root.parentNode) return false;
      ancestor = ancestor.parentNode;
    }
    return true;
  };
  const createNode = (tagName = "div") => {
    const attributes = new Map();
    const listeners = new Map();
    let innerHtml = "";
    const node = {
      tagName: tagName.toUpperCase(),
      id: "",
      className: "",
      dataset: {},
      disabled: false,
      children: [],
      parentNode: null,
      textContent: "",
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, reference) {
        child.parentNode = this;
        const index = this.children.indexOf(reference);
        if (index === -1) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
      },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      dispatch(type, event = {}) {
        return listeners.get(type)?.(event);
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name.startsWith("data-")) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
          this.dataset[key] = String(value);
        }
      },
      getAttribute(name) {
        return attributes.get(name) ?? null;
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      querySelectorAll(selector) {
        return descendants(this).filter((candidate) => matchesSelector(candidate, selector, this));
      },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
      },
      contains(candidate) {
        return candidate === this || descendants(this).includes(candidate);
      },
      closest(selector) {
        let candidate = this;
        while (candidate) {
          if (matchesSelector(candidate, selector, body)) return candidate;
          candidate = candidate.parentNode;
        }
        return null;
      },
      focus() {
        document.activeElement = this;
      },
    };
    node.classList = {
      toggle(className, force) {
        const classes = new Set(String(node.className || "").split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !classes.has(className) : Boolean(force);
        if (enabled) classes.add(className);
        else classes.delete(className);
        node.className = [...classes].join(" ");
        return enabled;
      },
      contains(className) {
        return String(node.className || "").split(/\s+/).includes(className);
      },
    };
    Object.defineProperty(node, "innerHTML", {
      get: () => innerHtml,
      set(value) {
        innerHtml = String(value);
        if (value === "") {
          if (node.children.some((child) => child.contains(document.activeElement))) {
            document.activeElement = document.body;
          }
          node.children.forEach((child) => {
            child.parentNode = null;
          });
          node.children = [];
        }
      },
    });
    return node;
  };

  const body = createNode("body");
  document = {
    body,
    activeElement: body,
    createElement: createNode,
    querySelector: (selector) => selector === "body" ? body : body.querySelector(selector),
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    getElementById: (id) => body.querySelector(`#${id}`),
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
    dispatchEvent(event) {
      for (const listener of documentListeners.get(event.type) ?? []) listener(event);
    },
  };
  const append = (parent, tagName, properties = {}) => {
    const node = createNode(tagName);
    Object.assign(node, properties);
    parent.appendChild(node);
    return node;
  };

  const instantiateReactElement = (parent, element) => {
    const node = append(parent, element.type);
    for (const [name, value] of Object.entries(element.props || {})) {
      if (value === undefined || value === null || name === "children" || name === "key") continue;
      if (name === "className") node.className = String(value);
      else if (name === "type") node.type = String(value);
      else if (name === "id") node.id = String(value);
      else if (name.startsWith("data-") || name.startsWith("aria-")) node.setAttribute(name, value);
    }
    node.textContent = element.children
      .flat(Infinity)
      .filter((child) => typeof child === "string" || typeof child === "number")
      .join("");
    return node;
  };

  const reserveButtons = {};
  if (reserveContract) {
    const reserveContainer = instantiateReactElement(body, reserveContract.container);
    for (const buttonContract of reserveContract.buttons) {
      const button = instantiateReactElement(reserveContainer, buttonContract);
      reserveButtons[button.dataset.reserveAction] = button;
    }
  }
  const campaignStatus = append(body, "p", { id: "campaign-status" });
  append(body, "strong", { id: "tactical-marks-value" });
  const queueContainer = append(body, "ol", { id: "command-reservation-queue" });
  const deploymentContainer = append(body, "div", { id: "tactical-deployment-controls" });
  const deploymentButtons = {};
  for (const kind of ["tower", "barricade"]) {
    const button = append(deploymentContainer, "button", { id: `deploy-${kind}`, className: "deployment-btn" });
    button.dataset.kind = kind;
    append(button, "strong");
    append(button, "span", { className: "count-badge" });
    append(button, "small");
    append(button, "span", { className: "cost-badge" });
    deploymentButtons[kind] = button;
  }
  const skillContainer = append(body, "div", { id: "tactical-skill-controls" });
  const skillButtons = {};
  for (const skill of ["command", "fortification", "mobility"]) {
    append(skillContainer, "span", { id: `skill-level-${skill}` });
    append(skillContainer, "span", { id: `skill-cost-${skill}` });
    const button = append(skillContainer, "button", { className: "skill-upgrade-btn" });
    button.dataset.skill = skill;
    skillButtons[skill] = button;
  }

  let campaign = campaignState ?? {
    status: "active",
    progression: {
      marks: progression.marks,
      skills: { ...progression.skills },
      commandQueue: progression.commandQueue.map((item) => ({ ...item })),
      deployments: progression.deployments.map((item) => ({ ...item })),
    },
  };
  const stateWithQueue = (commandQueue) => ({
    ...campaign,
    progression: {
      ...campaign.progression,
      commandQueue,
    },
  });
  const reserveCalls = [];
  const executeCalls = [];
  const feedbackMessages = [];
  const context = vm.createContext({
    STAGES,
    activePlacementMode,
    campaign,
    battleVisualFallback: false,
    currentLang: () => locale,
    entryGuidanceStageId,
    currentStage: () => campaignState ? STAGES[0] : { commands: { hunt: {}, extract: {} } },
    document,
    elements: { status: campaignStatus },
    getTacticalProgression: (state) => state.progression,
    persistCampaign: async () => {},
    showTacticalFeedback: (message) => {
      feedbackMessages.push(message);
      context.tacticalFeedbackMessage = message;
      context.render();
    },
    tacticalFeedbackMessage: null,
    startActionCooldown: () => {},
    synchronizeBattleRenderer: () => {},
    translate: (key) => translations[locale][key] ?? "",
    translations,
    triggerBattleVisual: () => {},
    reserveCommand: (state, action) => {
      reserveCalls.push(action);
      if (reserveCommandImpl) return reserveCommandImpl(state, action);
      return {
        accepted: true,
        state: {
          ...state,
          progression: {
            ...state.progression,
            commandQueue: [
              ...state.progression.commandQueue,
              { id: `reserved-${action}`, action },
            ],
          },
        },
      };
    },
    executeReservedCommand: (state, id) => {
      executeCalls.push(id);
      if (executeReserved) return executeReserved(state, id);
      return { accepted: false, state, message: "Command not found in queue." };
    },
    cancelReservedCommand: (state, id) => {
      const commandQueue = state.progression.commandQueue.filter((item) => item.id !== id);
      return { accepted: commandQueue.length !== state.progression.commandQueue.length, state: stateWithQueue(commandQueue) };
    },
    reorderReservedCommand: (state, fromIndex, toIndex) => {
      const commandQueue = state.progression.commandQueue.map((item) => ({ ...item }));
      const [item] = commandQueue.splice(fromIndex, 1);
      commandQueue.splice(toIndex, 0, item);
      return { accepted: true, state: stateWithQueue(commandQueue) };
    },
  });
  const definitions = [
    appFunction(source, "translateStatusMessage", "updateResumeAffordance"),
    appFunction(source, "translateRejectionReason", "showTacticalFeedback"),
    appFunction(source, "handleExecuteReserved", "handleCancelReserved"),
    appFunction(source, "handleCancelReserved", "handleReorderReserved"),
    appFunction(source, "handleReorderReserved", "handleReserveAction"),
    appFunction(source, "handleReserveAction", "handleDeploymentSelect"),
  ];
  const renderProjection = campaignState
    ? `function projectTacticalHud() {
  const stage = currentStage();
  const state = campaign.stage;
  const lang = currentLang();
${statusProjection[0]}
}`
    : `function projectTacticalHud() {
  const lang = currentLang();
  ${tacticalProjection[0]}
}`;
  vm.runInContext(
    `${definitions.join("\n\n")}\n${delegatedClickWiring[0]}\n${renderProjection}\nglobalThis.render = projectTacticalHud; globalThis.tacticalHud = { cancel: handleCancelReserved, execute: handleExecuteReserved, reorder: handleReorderReserved, reserve: handleReserveAction, translateReason: translateRejectionReason };`,
    context,
    { filename: "app.js" },
  );
  context.render();

  return {
    body,
    campaignStatus,
    deploymentButtons,
    document,
    queueContainer,
    reserveButtons,
    reserveCalls,
    executeCalls,
    feedbackMessages,
    skillButtons,
    cancel: (id) => context.tacticalHud.cancel(id),
    click: (button) => document.dispatchEvent({ type: "click", target: button }),
    execute: (id) => context.tacticalHud.execute(id),
    reorder: (fromIndex, toIndex) => context.tacticalHud.reorder(fromIndex, toIndex),
    reserve: (action) => context.tacticalHud.reserve(action),
    render: () => context.render(),
    setProgression(next) {
      campaign.progression = {
        ...campaign.progression,
        ...next,
        skills: { ...campaign.progression.skills, ...next.skills },
        commandQueue: (next.commandQueue ?? campaign.progression.commandQueue).map((item) => ({ ...item })),
        deployments: (next.deployments ?? campaign.progression.deployments).map((item) => ({ ...item })),
      };
      context.campaign = campaign;
    },
    translateReason: (message, lang = locale) => context.tacticalHud.translateReason(message, lang),
  };
}

test("queue operations keep focus on the surviving operation or nearest surviving row", async (t) => {
  const focusedQueueControl = (fixture) => {
    const focused = fixture.document.activeElement;
    if (focused === fixture.body) return "body";
    return `${focused.closest(".queue-item")?.dataset.id ?? "no-row"}:${focused.className}`;
  };

  await t.test("reorder", async () => {
    const fixture = await loadTacticalHudProjection();
    fixture.queueContainer.querySelector(
      '.queue-item[data-id="reserved-hunt"] .cancel-reserved-btn',
    ).focus();
    await fixture.reorder(0, 1);
    assert.equal(
      focusedQueueControl(fixture),
      "reserved-hunt:cancel-reserved-btn",
      "reordering must restore focus to the same operation on the moved reservation",
    );
  });

  await t.test("cancel", async () => {
    const fixture = await loadTacticalHudProjection();
    fixture.queueContainer.querySelector(
      '.queue-item[data-id="reserved-extract"] .cancel-reserved-btn',
    ).focus();
    await fixture.cancel("reserved-extract");
    assert.equal(
      focusedQueueControl(fixture),
      "reserved-hunt:cancel-reserved-btn",
      "removing the focused reservation must focus the equivalent operation on the nearest surviving row",
    );
  });
});

test("React reserve controls share one render and delegated-click attribute contract", async () => {
  const fixture = await loadTacticalHudProjection({
    locale: "en",
    includeReserveControls: true,
    progression: {
      marks: 8,
      skills: { command: 1, fortification: 1, mobility: 1 },
      commandQueue: [],
      deployments: [],
    },
  });
  const hunt = fixture.reserveButtons.hunt;
  const materialize = fixture.reserveButtons.materialize;
  fixture.click(hunt);

  assert.deepEqual(
    {
      hunt: {
        disabled: hunt.disabled,
        text: hunt.textContent,
        ariaLabel: hunt.getAttribute("aria-label"),
        title: hunt.getAttribute("title"),
      },
      materialize: {
        disabled: materialize.disabled,
        text: materialize.textContent,
        ariaLabel: materialize.getAttribute("aria-label"),
        title: materialize.getAttribute("title"),
      },
      reservedActions: [...fixture.reserveCalls],
    },
    {
      hunt: {
        disabled: false,
        text: "Reserve Hunt",
        ariaLabel: "Reserve Hunt",
        title: "Reserve Hunt",
      },
      materialize: {
        disabled: true,
        text: "Reserve Materialize",
        ariaLabel: "Materialize (Locked)",
        title: "Materialize (Locked)",
      },
      reservedActions: ["hunt"],
    },
    "the React reserve attribute must be the one app render and delegated wiring consume",
  );
});

test("reserved execution rejection displays the returned message instead of stale campaign feedback", async () => {
  const fixture = await loadTacticalHudProjection({
    executeReserved: (state) => ({
      accepted: false,
      state: {
        ...state,
        lastMessage: "Stale campaign feedback.",
      },
      message: "Returned reservation rejection.",
    }),
  });

  await fixture.execute("reserved-hunt");
  assert.deepEqual(
    {
      executedIds: [...fixture.executeCalls],
      feedback: [...fixture.feedbackMessages],
    },
    {
      executedIds: ["reserved-hunt"],
      feedback: ["Returned reservation rejection."],
    },
    "a rejected reserved execution must surface its own result message",
  );
});

test("deployment controls expose pressed state and localized insufficient-Marks or cap reasons", async (t) => {
  const copy = {
    ko: {
      insufficient: "전술 휘장이 부족합니다.",
      cap: "배치 한도에 도달했습니다.",
    },
    en: {
      insufficient: "Not enough Tactical Marks.",
      cap: "Deployment cap reached.",
    },
  };
  for (const locale of ["ko", "en"]) {
    await t.test(`${locale} selected state`, async () => {
      const fixture = await loadTacticalHudProjection({ locale, activePlacementMode: "tower" });
      assert.deepEqual(
        {
          disabled: fixture.deploymentButtons.tower.disabled,
          pressed: fixture.deploymentButtons.tower.getAttribute("aria-pressed"),
        },
        { disabled: false, pressed: "true" },
        `${locale} selected deployment must expose its active toggle state`,
      );
    });

    await t.test(`${locale} insufficient Marks`, async () => {
      const fixture = await loadTacticalHudProjection({
        locale,
        progression: {
          marks: 3,
          skills: { command: 1, fortification: 1, mobility: 1 },
          commandQueue: [],
          deployments: [],
        },
      });
      const accessibleCopy = [
        fixture.deploymentButtons.tower.getAttribute("aria-label"),
        fixture.deploymentButtons.tower.getAttribute("title"),
      ].join(" ");
      assert.deepEqual(
        {
          disabled: fixture.deploymentButtons.tower.disabled,
          pressed: fixture.deploymentButtons.tower.getAttribute("aria-pressed"),
          exposesReason: accessibleCopy.includes(copy[locale].insufficient),
        },
        { disabled: true, pressed: "false", exposesReason: true },
        `${locale} unaffordable deployment must expose its localized disabled reason`,
      );
    });

    await t.test(`${locale} deployment cap`, async () => {
      const fixture = await loadTacticalHudProjection({
        locale,
        progression: {
          marks: 8,
          skills: { command: 1, fortification: 1, mobility: 1 },
          commandQueue: [],
          deployments: [{ id: "tower-1", kind: "tower", cell: { x: 8, y: 5 } }],
        },
      });
      const accessibleCopy = [
        fixture.deploymentButtons.tower.getAttribute("aria-label"),
        fixture.deploymentButtons.tower.getAttribute("title"),
      ].join(" ");
      assert.deepEqual(
        {
          disabled: fixture.deploymentButtons.tower.disabled,
          pressed: fixture.deploymentButtons.tower.getAttribute("aria-pressed"),
          exposesReason: accessibleCopy.includes(copy[locale].cap),
        },
        { disabled: true, pressed: "false", exposesReason: true },
        `${locale} capped deployment must expose its localized disabled reason`,
      );
    });
  }
});

test("skill controls expose localized insufficient-Marks and maximum-level reasons", async (t) => {
  const insufficientCopy = {
    ko: "전술 휘장이 부족합니다.",
    en: "Not enough Tactical Marks.",
  };
  for (const locale of ["ko", "en"]) {
    await t.test(`${locale} insufficient Marks`, async () => {
      const fixture = await loadTacticalHudProjection({
        locale,
        progression: {
          marks: 3,
          skills: { command: 1, fortification: 1, mobility: 1 },
          commandQueue: [],
          deployments: [],
        },
      });
      const accessibleCopy = [
        fixture.skillButtons.command.getAttribute("aria-label"),
        fixture.skillButtons.command.getAttribute("title"),
      ].join(" ");
      assert.deepEqual(
        {
          disabled: fixture.skillButtons.command.disabled,
          exposesReason: accessibleCopy.includes(insufficientCopy[locale]),
        },
        { disabled: true, exposesReason: true },
        `${locale} unaffordable skill upgrade must expose its localized disabled reason`,
      );
    });

    await t.test(`${locale} maximum level`, async () => {
      const fixture = await loadTacticalHudProjection({
        locale,
        progression: {
          marks: 20,
          skills: { command: 5, fortification: 1, mobility: 1 },
          commandQueue: [],
          deployments: [],
        },
      });
      const accessibleCopy = [
        fixture.skillButtons.command.getAttribute("aria-label"),
        fixture.skillButtons.command.getAttribute("title"),
      ].join(" ");
      assert.deepEqual(
        {
          disabled: fixture.skillButtons.command.disabled,
          exposesReason: accessibleCopy.includes(translations[locale]["tactical.maxLevel"]),
        },
        { disabled: true, exposesReason: true },
        `${locale} maximum skill must expose its localized disabled reason`,
      );
    });
  }
});

test("every tactical rejection family resolves through Korean and English i18n copy", async (t) => {
  const cases = [
    {
      name: "inactive stage",
      message: "This stage is not active.",
      key: "tactical.rejection.inactiveStage",
      ko: "현재 스테이지에서는 이 전술 행동을 사용할 수 없습니다.",
      en: "This tactical action is unavailable outside an active stage.",
    },
    {
      name: "invalid command",
      message: "That command has no place in this stage.",
      key: "tactical.rejection.invalidCommand",
      ko: "이 스테이지에서 사용할 수 없는 명령입니다.",
      en: "That command is unavailable in this stage.",
    },
    {
      name: "invalid coordinates",
      message: "Invalid cell coordinates.",
      key: "tactical.rejection.invalidCoordinates",
      ko: "배치 좌표가 올바르지 않습니다.",
      en: "The deployment coordinates are invalid.",
    },
    {
      name: "invalid skill",
      message: "Invalid skill type.",
      key: "tactical.rejection.invalidSkill",
      ko: "올바르지 않은 전술 스킬입니다.",
      en: "The tactical skill is invalid.",
    },
    {
      name: "command missing",
      message: "Command not found in queue.",
      key: "tactical.rejection.commandMissing",
      ko: "대기열에서 명령을 찾을 수 없습니다.",
      en: "The command is no longer in the queue.",
    },
    {
      name: "maximum skill",
      message: "Skill command is already at maximum level.",
      key: "tactical.rejection.maxSkill",
      ko: "스킬이 이미 최대 레벨입니다.",
      en: "That skill is already at maximum level.",
    },
    {
      name: "queue full",
      message: "Command reservation queue is full.",
      key: "tactical.rejection.queueFull",
      ko: "예약 대기열이 가득 찼습니다.",
      en: "The command reservation queue is full.",
    },
    {
      name: "insufficient marks",
      message: "Not enough marks. Need 4 but have 3.",
      key: "tactical.rejection.insufficientMarks",
      ko: "전술 휘장이 부족합니다.",
      en: "Not enough Tactical Marks.",
    },
    {
      name: "deployment cap",
      message: "Cannot deploy more than 1 towers at fortification level 1.",
      key: "tactical.rejection.deploymentCap",
      ko: "배치 한도에 도달했습니다.",
      en: "Deployment cap reached.",
    },
    {
      name: "occupied cell",
      message: "Cell is occupied by an existing deployment.",
      key: "tactical.rejection.occupied",
      ko: "해당 칸에는 이미 배치물이 있습니다.",
      en: "That cell is already occupied.",
    },
    {
      name: "out of bounds",
      message: "Cell is not walkable or out of bounds.",
      key: "tactical.rejection.outOfBounds",
      ko: "배치 가능한 범위를 벗어났습니다.",
      en: "That cell is outside the deployment area.",
    },
    {
      name: "route blocked",
      message: "Deployment would completely block all paths from portal to boss.",
      key: "tactical.rejection.routeBlocked",
      ko: "배치하면 차원문에서 보스까지의 모든 경로가 막힙니다.",
      en: "That deployment would block every route from the portal to the boss.",
    },
  ];
  const fixture = await loadTacticalHudProjection();
  for (const contract of cases) {
    await t.test(contract.name, () => {
      const actual = {};
      const expected = {};
      for (const locale of ["ko", "en"]) {
        const rendered = fixture.translateReason(contract.message, locale);
        actual[locale] = {
          catalog: translations[locale][contract.key],
          rendered,
          leaksRawEnglish: locale === "ko" && rendered.includes(contract.message),
        };
        expected[locale] = {
          catalog: contract[locale],
          rendered: contract[locale],
          leaksRawEnglish: false,
        };
      }
      assert.deepEqual(
        actual,
        expected,
        `${contract.name} rejection must use localized Korean and English tactical copy`,
      );
    });
  }
});
test("protected navigation cells use catalog-backed Korean and English rejection copy", async (t) => {
  const fixture = await loadTacticalHudProjection();
  const variants = [
    "Cell contains a critical game anchor.",
    "Cell is in a protected base or spawn area.",
  ];

  for (const message of variants) {
    await t.test(message, () => {
      const actual = {};
      for (const locale of ["ko", "en"]) {
        const rendered = fixture.translateReason(message, locale);
        const catalogCopy = new Set(
          Object.values(translations[locale]).filter((copy) => typeof copy === "string" && copy.trim().length > 0),
        );
        actual[locale] = {
          nonempty: typeof rendered === "string" && rendered.trim().length > 0,
          catalogBacked: catalogCopy.has(rendered),
          ...(locale === "ko" ? { leaksRawEnglish: rendered.includes(message) } : {}),
        };
      }
      assert.deepEqual(
        actual,
        {
          ko: {
            nonempty: true,
            catalogBacked: true,
            leaksRawEnglish: false,
          },
          en: {
            nonempty: true,
            catalogBacked: true,
          },
        },
        "each protected-cell validator rejection must resolve to public locale catalog copy",
      );
    });
  }
});

async function loadFullscreenRuntime({ locale = "en", fullscreenEnabled = true } = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const documentListeners = new Map();
  const windowListeners = new Map();
  const requestRuns = [];
  const exitRuns = [];
  const statusWrites = [];
  let statusText = "";

  const createDeferredOperation = () => {
    let resolve;
    let reject;
    const promise = new Promise((settle, fail) => {
      resolve = settle;
      reject = fail;
    });
    return { promise, reject, resolve };
  };
  const createControl = ({ tagName = "BUTTON", isContentEditable = false } = {}) => {
    const attributes = new Map();
    const listeners = new Map();
    return {
      attributes,
      dataset: {},
      disabled: false,
      hidden: false,
      isContentEditable,
      tagName,
      addEventListener: (type, listener) => listeners.set(type, listener),
      dispatch: (type, event = {}) => listeners.get(type)?.(event),
      focus() {
        document.activeElement = this;
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      getClientRects: () => [{}],
      querySelectorAll: () => [],
      setAttribute: (name, value) => attributes.set(name, String(value)),
    };
  };

  const body = createControl({ tagName: "BODY" });
  const documentElement = createControl({ tagName: "HTML" });
  const input = createControl({ tagName: "INPUT" });
  const contentEditable = createControl({ tagName: "DIV", isContentEditable: true });
  const screen = createControl({ tagName: "SECTION" });
  const toggle = createControl();
  const fullscreenStatus = {
    get textContent() {
      return statusText;
    },
    set textContent(value) {
      statusText = value;
      statusWrites.push(value);
    },
  };
  const document = {
    activeElement: body,
    body,
    documentElement,
    fullscreenElement: null,
    fullscreenEnabled,
    addEventListener: (type, listener) => documentListeners.set(type, listener),
    exitFullscreen() {
      const run = createDeferredOperation();
      exitRuns.push(run);
      return run.promise;
    },
    querySelector: (selector) => selector === "#fullscreen-status" ? fullscreenStatus : null,
  };
  screen.requestFullscreen = (options) => {
    const run = createDeferredOperation();
    run.options = options;
    requestRuns.push(run);
    return run.promise;
  };

  const inertControl = () => createControl();
  const elements = {
    ambience: inertControl(),
    battleCanvas3d: inertControl(),
    battleFallbackCanvas: inertControl(),
    bgmToggle: null,
    briefing: inertControl(),
    cinematicButton: inertControl(),
    cinematicTranscript: inertControl(),
    cinematicTranscriptToggle: inertControl(),
    commandButtons: [],
    exportSave: inertControl(),
    importSave: inertControl(),
    restart: inertControl(),
    resultOverlay: inertControl(),
    resume: inertControl(),
    retry: inertControl(),
    retryFromResult: inertControl(),
    returnToLobby: inertControl(),
    returnToLobbyFromResult: inertControl(),
    screen,
    start: inertControl(),
    startCombat: inertControl(),
    toggleFullscreen: toggle,
  };
  const context = vm.createContext({
    ACTION_KEYS: Object.freeze({}),
    DIGIT_ACTION_KEYS: Object.freeze({}),
    battleUiActive: () => false,
    beginNewCampaign: () => {},
    beginStageCombat: () => {},
    campaign: { status: "active" },
    document,
    elements,
    exportSave: () => {},
    fullscreenPending: false,
    getAvailableActions: () => [],
    handleAction: () => {},
    handleRetry: () => {},
    importSave: () => {},
    playCinematic: () => {},
    refreshNarrationLanguage: () => {},
    refreshSaveStatus: () => {},
    render: () => {},
    resultOverlayOpen: false,
    resumeCampaign: () => Promise.resolve(),
    returnToLobby: () => Promise.resolve(),
    syncAmbienceButtonText: () => {},
    syncCinematicCopy: () => {},
    toggleAmbience: () => {},
    toggleBgm: () => {},
    toggleCinematicTranscript: () => {},
    translate: (key) => translations[locale][key] ?? key,
    updateResumeAffordance: () => {},
    window: {
      addEventListener: (type, listener) => windowListeners.set(type, listener),
    },
  });
  const definitions = [
    appFunction(source, "syncFullscreenControl", "announceFullscreen"),
    appFunction(source, "announceFullscreen", "handleFullscreenError"),
    appFunction(source, "handleFullscreenError", "toggleFullscreen"),
    appFunction(source, "toggleFullscreen", "playCinematic"),
    appFunction(source, "wireControls", "startLiquidEtherBackground"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}\nglobalThis.fullscreenApi = { sync: syncFullscreenControl, toggle: toggleFullscreen }; wireControls();`,
    context,
    { filename: "app.js" },
  );

  const pressKey = (key, { shiftKey = false } = {}) => {
    let prevented = false;
    windowListeners.get("keydown")({
      altKey: false,
      code: key === "F" || key === "f" ? "KeyF" : key,
      ctrlKey: false,
      key,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      repeat: false,
      shiftKey,
    });
    return prevented;
  };
  return {
    body,
    contentEditable,
    document,
    exitRuns,
    fullscreenStatus,
    input,
    requestRuns,
    screen,
    statusWrites,
    toggle,
    dispatchDocument: (type) => documentListeners.get(type)?.(),
    pressKey,
    sync: () => context.fullscreenApi.sync(),
    toggleFullscreen: () => context.fullscreenApi.toggle(),
  };
}

test("fullscreen support honors fullscreenEnabled and publishes the operable control state", async () => {
  const supported = await loadFullscreenRuntime();
  assert.equal(supported.toggle.hidden, false, "an enabled Fullscreen API must expose the campaign control");
  assert.equal(supported.toggle.disabled, false, "an idle Fullscreen API control must remain operable");
  assert.equal(supported.toggle.getAttribute("aria-pressed"), "false", "the control must report that the campaign screen is not fullscreen");
  assert.equal(supported.toggle.getAttribute("aria-keyshortcuts"), "Shift+F", "the control must expose its keyboard shortcut");
  assert.equal(supported.toggle.textContent, translations.en["screen.fullscreenEnter"], "the idle control must use the active locale's enter action");
  assert.equal(supported.toggle.getAttribute("title"), translations.en["screen.fullscreenEnterTitle"], "the idle control title must describe the localized shortcut");

  const policyBlocked = await loadFullscreenRuntime({ fullscreenEnabled: false });
  assert.equal(policyBlocked.toggle.hidden, true, "a browser policy that disables fullscreen must hide the unusable control even when methods exist");
});

test("fullscreen requests hide browser navigation and suppress overlapping transitions", async () => {
  const fixture = await loadFullscreenRuntime();

  fixture.toggle.dispatch("click");
  fixture.toggle.dispatch("click");
  assert.equal(fixture.requestRuns.length, 1, "a pending fullscreen request must suppress a second button transition");
  assert.deepEqual(
    { ...fixture.requestRuns[0].options },
    { navigationUI: "hide" },
    "campaign fullscreen must request the distraction-free navigation UI mode",
  );
  assert.equal(fixture.toggle.disabled, true, "the fullscreen control must be disabled while the native transition is pending");

  fixture.requestRuns[0].resolve();
  await Promise.resolve();
  assert.equal(fixture.toggle.disabled, true, "resolving requestFullscreen before fullscreenchange must not reopen the overlap window");

  fixture.document.fullscreenElement = fixture.screen;
  fixture.dispatchDocument("fullscreenchange");
  assert.equal(fixture.toggle.disabled, false, "the native fullscreenchange event must release the transition guard");

  fixture.toggle.dispatch("click");
  fixture.toggle.dispatch("click");
  assert.equal(fixture.exitRuns.length, 1, "a pending native exit must suppress a second exit request");
  fixture.exitRuns[0].resolve();
  await Promise.resolve();
});

test("fullscreenchange synchronizes the control and announces localized entry and exit", async () => {
  for (const locale of ["ko", "en"]) {
    const fixture = await loadFullscreenRuntime({ locale });

    fixture.document.fullscreenElement = fixture.screen;
    fixture.dispatchDocument("fullscreenchange");
    assert.equal(fixture.toggle.getAttribute("aria-pressed"), "true", `${locale} entry must expose the active pressed state`);
    assert.equal(fixture.toggle.textContent, translations[locale]["screen.fullscreenExit"], `${locale} entry must swap the control to the exit action`);
    assert.equal(fixture.toggle.getAttribute("title"), translations[locale]["screen.fullscreenExitTitle"], `${locale} entry must localize the shortcut title`);
    assert.equal(fixture.fullscreenStatus.textContent, translations[locale]["screen.fullscreenEntered"], `${locale} entry must announce the completed transition`);

    fixture.document.fullscreenElement = null;
    fixture.dispatchDocument("fullscreenchange");
    assert.equal(fixture.toggle.getAttribute("aria-pressed"), "false", `${locale} exit must clear the pressed state`);
    assert.equal(fixture.toggle.textContent, translations[locale]["screen.fullscreenEnter"], `${locale} exit must restore the enter action`);
    assert.equal(fixture.fullscreenStatus.textContent, translations[locale]["screen.fullscreenExited"], `${locale} exit must announce the completed transition`);

    const externalOwner = await loadFullscreenRuntime({ locale });
    externalOwner.document.fullscreenElement = {};
    externalOwner.dispatchDocument("fullscreenchange");
    assert.deepEqual(
      externalOwner.statusWrites,
      [],
      `${locale} fullscreenchange for a different document element must not announce that the campaign exited`,
    );
  }
});

test("fullscreen rejection and fullscreenerror restore the control with one localized error announcement", async () => {
  for (const failure of ["rejection", "fullscreenerror"]) {
    const fixture = await loadFullscreenRuntime({ locale: "ko" });
    const transition = fixture.toggleFullscreen();
    assert.equal(fixture.toggle.disabled, true, `${failure} setup must begin with a guarded transition`);

    if (failure === "rejection") {
      fixture.requestRuns[0].reject(new Error("fullscreen denied"));
      await transition;
    } else {
      fixture.dispatchDocument("fullscreenerror");
      fixture.requestRuns[0].resolve();
      await transition;
    }

    assert.equal(fixture.toggle.disabled, false, `${failure} must restore the fullscreen control`);
    assert.equal(fixture.toggle.getAttribute("aria-pressed"), "false", `${failure} must retain the actual inactive state`);
    assert.equal(fixture.fullscreenStatus.textContent, translations.ko["screen.fullscreenError"], `${failure} must publish the localized failure`);
    assert.deepEqual(fixture.statusWrites, [translations.ko["screen.fullscreenError"]], `${failure} must announce the failure exactly once`);
  }
});

test("Shift+F toggles only outside editable controls while Escape remains browser-owned", async () => {
  const active = await loadFullscreenRuntime();
  active.body.focus();
  assert.equal(active.pressKey("F", { shiftKey: true }), true, "Shift+F on the active campaign surface must be consumed");
  assert.equal(active.requestRuns.length, 1, "Shift+F must dispatch exactly one fullscreen request");
  active.requestRuns[0].resolve();
  await Promise.resolve();

  for (const [owner, property] of [
    ["input", "input"],
    ["contenteditable region", "contentEditable"],
  ]) {
    const fixture = await loadFullscreenRuntime();
    const editable = fixture[property];
    editable.focus();
    assert.equal(fixture.pressKey("F", { shiftKey: true }), false, `Shift+F in an ${owner} must remain available to editing`);
    assert.equal(fixture.requestRuns.length, 0, `an ${owner} must not dispatch fullscreen`);
  }

  const escape = await loadFullscreenRuntime();
  escape.body.focus();
  assert.equal(escape.pressKey("Escape"), false, "Escape on the campaign surface must remain native fullscreen behavior");
  assert.equal(escape.requestRuns.length, 0, "Escape must not invoke the custom fullscreen toggle");
});

test("spatial actions exclude cooling commands and all result-overlay input", async () => {
  const fixture = await loadInteractiveBattleActions();

  assert.deepEqual(
    fixture.getActions(),
    ["hunt"],
    "an engine-available action with no remaining cooldown must be interactive",
  );

  fixture.setCooldown("hunt", 1);
  assert.deepEqual(
    fixture.getActions(),
    [],
    "an engine-available action must not remain interactive while its cooldown is active",
  );

  fixture.setCooldown("hunt", 0);
  fixture.setResultOverlayOpen(true);
  assert.deepEqual(
    fixture.getActions(),
    [],
    "the result overlay must suppress spatial actions even after their cooldown expires",
  );
});

test("briefing acknowledgement focuses Hunt and Digit1 dispatches only from command focus", async () => {
  const fixture = await loadCommandFocusHotkey();

  fixture.acknowledgeBriefing();
  assert.equal(fixture.activeElement(), fixture.hunt, "acknowledging the briefing must focus the Hunt command button, not a non-focusable field-feedback surface");
  assert.equal(fixture.pressDigitOne(), true, "Digit1 from the post-briefing Hunt focus must be consumed as a campaign command");
  assert.deepEqual(fixture.actions, ["hunt"], "Digit1 from the focused Hunt command must dispatch exactly one Hunt");

  fixture.editable.focus();
  assert.equal(fixture.pressDigitOne(), false, "Digit1 from an editable control must remain available to the control");
  assert.deepEqual(fixture.actions, ["hunt"], "editable focus must block numeric campaign command dispatch");
});

test("focusPendingCommand does not steal focus from an already-engaged battle canvas", async () => {
  const fixture = await loadCommandFocusHotkey();

  // Mirrors the real timing bug: beginStageCombat() sets the pending flag
  // and clears stageBriefingOpen well before the async battle scene finishes
  // loading; a player can click into the canvas during that window, and the
  // eventual render() -> focusPendingCommand() call must not yank focus back
  // to a command button once it belatedly runs.
  fixture.setStageBriefingOpen(false);
  fixture.setPendingCommandFocus(true);
  fixture.battleCanvas3d.focus();
  assert.equal(fixture.activeElement(), fixture.battleCanvas3d, "the canvas must already be focused before the pending check runs");

  fixture.focusPendingCommand();

  assert.equal(
    fixture.activeElement(),
    fixture.battleCanvas3d,
    "focusPendingCommand must not steal focus from an already-engaged canvas",
  );
});

test("focusPendingCommand does not steal focus from an already-engaged Canvas2D fallback either", async () => {
  const fixture = await loadCommandFocusHotkey();

  fixture.setStageBriefingOpen(false);
  fixture.setPendingCommandFocus(true);
  fixture.battleFallbackCanvas.focus();

  fixture.focusPendingCommand();

  assert.equal(
    fixture.activeElement(),
    fixture.battleFallbackCanvas,
    "focusPendingCommand must not steal focus from the Canvas2D fallback either",
  );
});

test("focusPendingCommand still focuses the first command when nothing has claimed focus yet", async () => {
  const fixture = await loadCommandFocusHotkey();

  fixture.setStageBriefingOpen(false);
  fixture.setPendingCommandFocus(true);
  fixture.focusPendingCommand();

  assert.equal(
    fixture.activeElement(),
    fixture.hunt,
    "with no prior canvas engagement, the pending focus must still land on the first command (the original accessibility affordance)",
  );
});

async function loadBriefingTabHandler() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const definition = source.match(
    /elements\.briefing\.addEventListener\("keydown", \(event\) => \{[\s\S]*?\n {2}\}\);/,
  );
  assert.ok(definition, "app runtime must wire a keydown listener onto the briefing panel");

  let listener = null;
  const startCombat = { focused: false, focus: () => { startCombat.focused = true; } };
  const briefing = { addEventListener: (type, fn) => { if (type === "keydown") listener = fn; } };
  const context = vm.createContext({ elements: { briefing, startCombat } });
  vm.runInContext(definition[0], context, { filename: "app.js" });

  return {
    dispatch: (event) => listener(event),
  };
}

test("the briefing panel's Tab shortcut never traps Shift+Tab, only forward Tab", async () => {
  const fixture = await loadBriefingTabHandler();

  let prevented = false;
  fixture.dispatch({ key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, "forward Tab must jump to the Start Combat CTA");

  let shiftTabPrevented = false;
  fixture.dispatch({ key: "Tab", shiftKey: true, preventDefault: () => { shiftTabPrevented = true; } });
  assert.equal(
    shiftTabPrevented,
    false,
    "Shift+Tab must never be trapped, or a player backing out of the briefing toward earlier UI gets stuck with no way to navigate backward",
  );
});

test("spatial field hover overrides and then restores a keyboard-focused command preview", async () => {
  const fixture = await loadCommandFocusHotkey();

  fixture.hunt.focus();
  fixture.hunt.dispatch("focus");
  fixture.focusFieldAction("assault");
  assert.equal(
    fixture.activeElement(),
    fixture.hunt,
    "spatial pointer hover must not steal keyboard focus from the command button",
  );
  fixture.focusFieldAction(null);

  assert.deepEqual(
    fixture.previewActions,
    ["hunt", "assault", "hunt"],
    "field hover must override the lingering keyboard preview, and clearing the field hover must restore that focused command",
  );
  assert.deepEqual(
    fixture.projectedActions,
    ["hunt", "assault", "hunt"],
    "command and dossier projection must follow the same field-over-keyboard precedence as the renderer preview",
  );
});

test("Assault remains a command outside the tactical canvas and movement owns A on either canvas", async () => {
  const fixture = await loadCommandFocusHotkey();

  for (const [owner, control] of [
    ["document body", fixture.body],
    ["command button", fixture.hunt],
  ]) {
    control.focus();
    assert.equal(fixture.pressAssault(), true, `${owner} focus must consume A as the available Assault command`);
  }
  assert.deepEqual(fixture.actions, ["assault", "assault"], "body and command focus must each dispatch exactly one Assault");

  for (const [owner, canvas] of [
    ["direct renderer", fixture.battleCanvas3d],
    ["fallback renderer", fixture.battleFallbackCanvas],
  ]) {
    canvas.focus();
    assert.equal(fixture.pressAssault(), false, `${owner} focus must leave A available for tactical movement`);
  }
  assert.deepEqual(fixture.actions, ["assault", "assault"], "focused tactical canvases must not dispatch Assault from movement input");
});
test("the briefing's pending-checklist item genuinely changes as a stage progresses, proving a frozen \"hunt the first rift trace\" hint would mislead a player who has already moved past hunting", () => {
  const fresh = startCampaign(createCampaign()).state;
  const freshChecklist = getStageChecklist(fresh);
  const freshPending = freshChecklist.find((item) => !item.complete && !item.optional);
  assert.equal(freshPending?.id, "hunt", "a fresh stage 1 campaign's next step really is hunt, matching the old static hint");

  const progressed = structuredClone(fresh);
  progressed.stage.hunted = 2;
  const progressedChecklist = getStageChecklist(progressed);
  const progressedPending = progressedChecklist.find((item) => !item.complete && !item.optional);
  assert.notEqual(
    progressedPending?.id,
    "hunt",
    "once hunting is done, the next step must no longer be hunt -- a briefing hint frozen on \"press Hunt\" would now be actively wrong",
  );
});


test("new campaign, save transfer, and briefing status copy follows the active Korean or English locale", async () => {
  const contracts = {
    ko: {
      confirm: "새로운 캠페인을 시작하시겠습니까? 현재 진행 중인 로컬 세이브가 대체됩니다.",
      exported: "버전 지정된 캠페인 저장을 내보냈습니다.",
      saved: "캠페인 저장 완료 (IndexedDB에 저장됨)",
      imported: "가져온 캠페인 저장 완료 (IndexedDB에 저장됨)",
      tooLarge: "가져오기 거부됨: 저장 데이터 크기가 256 KiB 제한을 초과합니다.",
      briefing: "작전 브리핑 · 명령 대기 중",
      mirrored: "다른 탭의 로컬 캠페인을 반영했습니다.",
    },
    en: {
      confirm: "Start a new campaign? Your current local run will be replaced.",
      exported: "Versioned campaign save exported.",
      saved: "Campaign saved in IndexedDB.",
      imported: "Imported campaign saved in IndexedDB.",
      tooLarge: "Import rejected: save exceeds the 256 KiB limit.",
      briefing: "MISSION BRIEFING · COMMAND PENDING",
      mirrored: "Mirrored campaign applied from another tab.",
    },
  };

  for (const locale of ["ko", "en"]) {
    const { api, confirmations, elements, createdAnchors } = await loadReleaseLocalization(locale);
    await api.beginNewCampaign();
    assert.deepEqual(confirmations, [contracts[locale].confirm], `${locale} must show the exact localized new-campaign replacement warning`);

    api.exportSave();
    assert.equal(elements.saveStatus.textContent, contracts[locale].exported, `${locale} export must publish its exact localized visible status`);
    assert.equal(
      createdAnchors.at(-1)?.download,
      "abyssal-command-campaign-save.json",
      `${locale} export must name the downloaded file after the current Abyssal Command branding`,
    );

    await api.persistCampaign();
    assert.equal(elements.saveStatus.textContent, contracts[locale].saved, `${locale} persistence must publish its exact localized visible status`);

    await api.importSave({ size: 256 * 1024 + 1 });
    assert.equal(elements.saveStatus.textContent, contracts[locale].tooLarge, `${locale} oversized import must publish its exact localized rejection`);

    await api.importSave({ size: 2, text: async () => "{}" });
    assert.equal(elements.saveStatus.textContent, contracts[locale].imported, `${locale} successful import must publish its exact localized saved status`);

    await api.applyMirroredCampaign(
      { schema: "test-save" },
      { originId: "tab-remote-localization", revision: 1 },
    );
    assert.equal(elements.saveStatus.textContent, contracts[locale].mirrored, `${locale} cross-tab application must publish its exact localized visible status`);

    api.setBattlePressure("briefing", "unlocalized fallback");
    assert.equal(elements.waveIndicator.textContent, contracts[locale].briefing, `${locale} briefing must publish its exact localized wave badge`);
    for (const [mirror, source] of [
      ["battleScreenObjective", "stageObjective"],
      ["battleScreenPressure", "battlePressure"],
      ["battleScreenWave", "waveIndicator"],
      ["battleScreenSouls", "souls"],
      ["battleScreenLegion", "legion"],
      ["battleScreenNodes", "nodes"],
      ["battleScreenIntegrity", "integrity"],
    ]) {
      assert.equal(
        elements[mirror].textContent,
        elements[source].textContent,
        `${locale} battle-screen ${mirror} must mirror the ${source} source text`,
      );
    }
    assert.equal(elements.battleScreenBoss.textContent, "Warden 6 / 8", `${locale} battle-screen boss must mirror label and health`);
  }
});

test("startup save discovery reports exact localized compatibility and storage availability", async () => {
  const contracts = {
    ko: {
      compatible: "IndexedDB에서 호환되는 캠페인을 사용할 수 있습니다.",
      incompatible: "로컬 저장 데이터가 있지만 호환되지 않습니다. 새 캠페인을 시작하거나 유효한 저장 파일을 가져오십시오.",
      empty: "진행 중인 로컬 캠페인이 없습니다. IndexedDB가 준비되었습니다.",
      fallback: "IndexedDB를 사용할 수 없습니다. 이 세션은 로컬 안전 폴백을 사용합니다.",
    },
    en: {
      compatible: "A compatible campaign is available from IndexedDB.",
      incompatible: "A local save was found but is incompatible. Start a new campaign or import a valid save.",
      empty: "No local campaign yet. IndexedDB is ready.",
      fallback: "IndexedDB is unavailable; this session will use the safe local fallback.",
    },
  };

  for (const locale of ["ko", "en"]) {
    assert.equal(
      await loadStartupStatus(locale, { envelope: { schema: "test-save" } }),
      contracts[locale].compatible,
      `${locale} startup must identify a compatible campaign and its source`,
    );
    assert.equal(
      await loadStartupStatus(locale, { envelope: { schema: "old-save" }, incompatible: true }),
      contracts[locale].incompatible,
      `${locale} startup must explain that the discovered campaign is incompatible`,
    );
    assert.equal(
      await loadStartupStatus(locale),
      contracts[locale].empty,
      `${locale} startup must report that IndexedDB is ready without a campaign`,
    );
    assert.equal(
      await loadStartupStatus(locale, { storageMode: "memory" }),
      contracts[locale].fallback,
      `${locale} startup must report the safe fallback when IndexedDB is unavailable`,
    );
  }
});

test("Korean command guidance states each action's concrete progress, economy, prerequisite, and combat result", async () => {
  const describe = await loadKoreanCommandCopy();
  const contracts = [
    ["hunt", "균열 흔적 탐색 (진행도: 1/2)"],
    ["extract", "은닉처에서 영혼 +4 획득"],
    ["materialize", "비용: 영혼 4 | 군단 +3 실체화"],
    ["capture", "기술 거점 점거 (그림자 2명 필요 | 거점 +1)"],
    ["domain", "군주 내구도 +3 회복 및 차단막 +2 획득"],
    ["assault", "보스에게 3 피해 | 예상 반격: 3"],
  ];

  for (const [action, expected] of contracts) {
    assert.equal(describe(action), expected, `${action} must tell Korean players its concrete tactical consequence`);
  }
});

test("accepted first and second Hunt results are fully localized in Korean mode", async () => {
  const translateStatus = await loadStatusTranslator();
  const cases = [
    {
      raw: "You find a heatless footprint in the cinders.",
      localized: "잿더미에서 열기 없는 흔적 하나를 발견했습니다. 균열을 특정하려면 한 번 더 사냥하십시오.",
    },
    {
      raw: "The second trace exposes the rift's pulse.",
      localized: "두 번째 흔적이 균열의 맥동을 드러냈습니다. 이제 영혼을 추출할 수 있습니다.",
    },
  ];

  for (const { raw, localized } of cases) {
    const result = translateStatus(raw);
    assert.equal(result, localized, "accepted Hunt feedback must provide the next actionable Korean instruction");
    assert.equal(result.includes(raw), false, "Korean Hunt feedback must not leak the campaign engine's raw English message");
  }
});

test("composite executed reserved-command receipts localize commands, results, and extraction economy without leaking engine copy", async () => {
  const translateStatus = await loadStatusTranslator();
  const cases = [
    {
      action: "hunt",
      detail: "You find a heatless footprint in the cinders.",
      localizedDetail: "잿더미에서 열기 없는 흔적 하나를 발견했습니다. 균열을 특정하려면 한 번 더 사냥하십시오.",
      actionableInstruction: "한 번 더 사냥하십시오.",
      economyReceipt: false,
    },
    {
      action: "hunt",
      detail: "The second spoor opens into a soul cache before the rift can close (+1 summon essence).",
      localizedDetail: "균열이 닫히기 전에 두 번째 흔적이 그림자 은닉처로 열렸습니다.",
      economyReceipt: true,
    },
    {
      action: "extract",
      detail: "Four volatile shades tear free from the rift (+1 summon essence).",
      localizedDetail: "네 명의 불안정한 그림자가 균열에서 흘러나왔습니다.",
      economyReceipt: true,
    },
  ];

  for (const { action, detail, localizedDetail, actionableInstruction, economyReceipt } of cases) {
    const raw = `Executed reserved command: ${action}. ${detail}`;
    const localizedCommand = translations.ko[`command.${action}.name`];
    const rendered = translateStatus(raw, "ko");
    const localizedPrefix = `예약된 ${localizedCommand} 명령 실행: ${localizedDetail}`;

    if (economyReceipt) {
      assert.equal(
        rendered.startsWith(localizedPrefix),
        true,
        `${action} extraction feedback must compose its localized command name and result`,
      );
      assert.equal(
        rendered.includes("+1 소환 정수"),
        true,
        `${action} extraction feedback must retain the earned summon-essence amount in Korean`,
      );
      assert.doesNotMatch(
        rendered,
        /[A-Za-z]/,
        `${action} extraction feedback must contain no raw English engine sentence or economy label`,
      );
      assert.doesNotMatch(
        rendered,
        /summon essence/i,
        `${action} extraction feedback must not leak the English summon-essence label`,
      );
    } else {
      assert.equal(
        rendered,
        localizedPrefix,
        `${action} execution feedback must compose its localized command name and result`,
      );
    }
    if (actionableInstruction) {
      assert.equal(
        rendered.includes(actionableInstruction),
        true,
        `${action} execution feedback must retain the localized next action`,
      );
    }
    assert.equal(rendered.includes("Executed reserved command"), false, "Korean execution feedback must not leak the English receipt");
    assert.equal(rendered.includes(detail), false, `${action} execution feedback must not leak the raw English engine result`);
    assert.equal(rendered.includes(action), false, `${action} execution feedback must not leak the raw command identifier`);
    assert.equal(translateStatus(raw, "en"), raw, "English execution feedback must preserve the original composite receipt");
  }
});

test("reserved command receipts use locale catalog command names without raw engine copy", async () => {
  const translateStatus = await loadStatusTranslator();
  const raw = "Reserved command: extract.";

  for (const locale of ["ko", "en"]) {
    const expected = translations[locale]["queue.reservedReceipt"].replace(
      "{command}",
      translations[locale]["command.extract.name"],
    );
    const rendered = translateStatus(raw, locale);
    assert.equal(rendered, expected, `${locale} reservation feedback must compose its command name and receipt from the locale catalog`);
    if (locale === "ko") {
      assert.equal(rendered.includes(raw), false, "Korean reservation feedback must not leak the raw English engine receipt");
      assert.equal(rendered.includes("extract"), false, "Korean reservation feedback must not leak the raw English command identifier");
    }
  }
});

test("accepted reservations replace fresh Stage 1 guidance with the localized receipt", async () => {
  const started = startCampaign(createCampaign());
  if (!started.accepted) throw new Error(`Unable to start reservation status fixture: ${started.message}`);
  const contracts = [
    {
      locale: "ko",
      guidance: "첫 명령: 균열 흔적을 두 번 사냥하십시오.",
      receipt: "추출 명령이 예약되었습니다.",
    },
    {
      locale: "en",
      guidance: "First order: Hunt two rift spoor.",
      receipt: "Extract reserved.",
    },
  ];

  for (const { locale, guidance, receipt } of contracts) {
    const fixture = await loadTacticalHudProjection({
      locale,
      campaignState: { ...started.state, lastMessage: "Campaign started." },
      entryGuidanceStageId: STAGES[0].id,
      reserveCommandImpl: reserveCommand,
    });
    assert.equal(fixture.campaignStatus.textContent, guidance, `${locale} fresh Stage 1 must show its entry guidance before a command`);

    await fixture.reserve("extract");

    assert.equal(
      fixture.campaignStatus.textContent,
      receipt,
      `${locale} accepted Extract reservation must replace Stage 1 guidance with its receipt`,
    );
  }
});

test("reserved execution prerequisite feedback localizes its wrapper and actionable inner reason", async () => {
  const fixture = await loadTacticalHudProjection();
  const rawInnerReason = "Two spoor marks are required before extraction.";
  const raw = `Execution failed: ${rawInnerReason}`;

  for (const locale of ["ko", "en"]) {
    const expected = translations[locale]["tactical.rejection.executionFailed"].replace(
      "{error}",
      translations[locale]["tactical.rejection.extractRequiresSpoor"],
    );
    const rendered = fixture.translateReason(raw, locale);
    assert.equal(rendered, expected, `${locale} execution rejection must compose its wrapper and prerequisite from the locale catalog`);
    if (locale === "ko") {
      assert.equal(rendered.includes(rawInnerReason), false, "Korean execution rejection must not leak the raw English prerequisite");
      assert.equal(rendered.includes("Execution failed"), false, "Korean execution rejection must not leak the raw English wrapper");
    }
  }
});


test("accepted commands retain a local feedback cue when battle rendering is unavailable", async () => {
  const fallback = await loadBattleVisualTrigger();

  fallback.trigger("materialize", { count: 3 });

  assert.deepEqual(fallback.effectCalls, ["materialize"], "the no-renderer command path must retain its immediate visual acknowledgement");
  assert.deepEqual(fallback.cueCalls, ["materialize"], "the no-renderer command path must retain its authored audio acknowledgement");
  assert.deepEqual(fallback.rendererCalls, [], "the no-renderer path must not attempt renderer-only feedback");
});

test("healthy battle rendering owns command feedback without duplicate local cues", async () => {
  const rendered = await loadBattleVisualTrigger({ hasRenderer: true });

  rendered.trigger("materialize", { count: 3 });

  assert.equal(rendered.rendererCalls.length, 1, "the renderer must receive the accepted command's semantic feedback exactly once");
  assert.equal(rendered.rendererCalls[0].action, "materialize", "the renderer feedback must identify the accepted command");
  assert.equal(rendered.rendererCalls[0].source, "portal", "the renderer feedback must retain the semantic source");
  assert.equal(rendered.rendererCalls[0].target, "portal", "the renderer feedback must retain the semantic target");
  assert.equal(rendered.rendererCalls[0].clip, "Activate", "the renderer feedback must retain the authored action clip");
  assert.equal(rendered.rendererCalls[0].count, 3, "the renderer feedback must retain accepted command details");
  assert.deepEqual(rendered.effectCalls, [], "renderer-backed feedback must not duplicate the local visual acknowledgement");
  assert.deepEqual(rendered.cueCalls, [], "renderer-backed feedback must not duplicate the local audio acknowledgement");
});

async function loadEncounterCueDispatcher({ campaignState = null } = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const cueMap = source.match(/const ENCOUNTER_CUE_BY_EVENT = Object\.freeze\(\{[\s\S]*?\}\);/);
  assert.ok(cueMap, "app runtime must expose its encounter-event cue map");
  const cueCalls = [];
  const feedbackCalls = [];
  const context = vm.createContext({
    battleSessionId: 7,
    campaign: campaignState ?? { status: "active" },
    clearEncounterStartTimer: () => {},
    currentEncounter: () => context.campaign.stage?.encounter ?? { bossExposed: true, spawningStopped: false },
    currentLang: () => "en",
    encounterEventQueue: Promise.resolve(),
    FIELD_ITEM_CATALOG,
    persistCampaign: async () => {},
    playCue: (cue) => cueCalls.push(cue),
    render: () => {},
    scheduleEncounterWaveStart: () => {},
    showTacticalFeedback: (message) => feedbackCalls.push(message),
    synchronizeBattleRenderer: () => {},
    translate: (key) => translations.en[key] ?? key,
    visualizer: {},
    applyEncounterEvent(state, event) {
      if (campaignState) return applyEncounterEvent(state, event);
      return event.accepted === false
        ? { accepted: false, state }
        : { accepted: true, state: { status: "active" } };
    },
  });
  const definition = appFunction(source, "handleEncounterEvent", "stopBattle");
  vm.runInContext(
    `${cueMap[0]}\n${definition}\nglobalThis.dispatchEncounter = handleEncounterEvent;`,
    context,
    { filename: "app.js" },
  );
  return {
    cueCalls,
    feedbackCalls,
    dispatch: (event) => context.dispatchEncounter(event, 7, null),
    getCampaign: () => context.campaign,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function loadAudioSceneLifecycle() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const musicMap = source.match(/const MUSIC_BY_SCENE = Object\.freeze\(\{[\s\S]*?\}\);/);
  assert.ok(musicMap, "app runtime must expose its scene music map");

  const playerAttributes = new Map();
  const playerCalls = [];
  const playRuns = [];
  const player = {
    dataset: {},
    paused: true,
    getAttribute(name) {
      return playerAttributes.get(name) ?? null;
    },
    set src(value) {
      playerAttributes.set("src", value);
    },
    get src() {
      return playerAttributes.get("src") ?? "";
    },
    pause() {
      this.paused = true;
      playerCalls.push("pause");
    },
    load() {
      playerCalls.push("load");
    },
    play() {
      const run = deferred();
      playRuns.push(run);
      playerCalls.push(`play:${this.src}`);
      return run.promise;
    },
  };
  const toggleCalls = [];
  const cueCalls = [];
  const ambienceCalls = [];
  const cuePlayer = {
    currentTime: 9,
    pause: () => cueCalls.push("pause"),
    removeAttribute: (name) => cueCalls.push(`remove:${name}`),
    load: () => cueCalls.push("load"),
  };
  const ambiencePlayer = {
    currentTime: 8,
    pause: () => ambienceCalls.push("pause"),
    removeAttribute: (name) => ambienceCalls.push(`remove:${name}`),
    load: () => ambienceCalls.push("load"),
  };
  const context = vm.createContext({
    MUSIC_BY_SCENE: undefined,
    EMPTY_RENDERER_SELECTION: Object.freeze({
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
    }),
    rendererSelectionSummary: {},
    ambiencePlayer,
    battleSessionId: 4,
    battleStartedAt: 123,
    battleStarting: true,
    battleVisualFallback: true,
    bgmEnabled: true,
    bgmSceneRun: 0,
    clearEncounterStartTimer: () => {},
    stopCommandTutorialAlarm: () => {},
    cooldownTimer: 99,
    cooldowns: new Map([["hunt", 1]]),
    tacticalFeedbackMessage: "Barricade route is sealed.",
    tacticalFeedbackTimer: 77,
    cuePlayer,
    elements: {
      ambience: {
        textContent: "",
        setAttribute: (name, value) => ambienceCalls.push(`${name}:${value}`),
      },
      bgmPlayer: player,
      bgmToggle: {
        classList: {
          toggle: (name, value) => toggleCalls.push(`${name}:${value}`),
        },
        setAttribute: (name, value) => toggleCalls.push(`${name}:${value}`),
      },
    },
    encounterEventQueue: Promise.resolve(),
    lastCueEffect: "breach-alert",
    lastCueStartedAt: 100,
    pendingBattleRenderer: { destroy() {} },
    pendingCommandFocus: true,
    projectActionFocus: () => {},
    rendererRuntime: {},
    translate: () => "Play ambience",
    visualizer: { destroy() {} },
    window: {
      clearInterval: (id) => playerCalls.push(`clearInterval:${id}`),
      clearTimeout: (id) => playerCalls.push(`clearTimeout:${id}`),
    },
  });
  const definitions = [
    appFunction(source, "stopBattle", "activateBattleFallback"),
    appFunction(source, "setBgmTogglePlaying", "playSelectedBgm"),
    appFunction(source, "playSelectedBgm", "syncBgmScene"),
    appFunction(source, "syncBgmScene", "stopBattleAudio"),
    appFunction(source, "stopBattleAudio", "waitForNarration"),
  ];
  vm.runInContext(
    `${musicMap[0]}\n${definitions.join("\n\n")}\nglobalThis.audioSceneApi = {
      syncBgmScene,
      stopBattle,
      state: () => ({ ambiencePlayer, lastCueEffect, lastCueStartedAt }),
    };`,
    context,
    { filename: "app.js" },
  );
  return {
    ambienceCalls,
    api: context.audioSceneApi,
    cueCalls,
    player,
    playerCalls,
    playRuns,
    toggleCalls,
  };
}

async function loadCinematicLifecycle() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const attributes = new Map();
  const calls = [];
  const statuses = [];
  const video = {
    currentTime: 5,
    ended: false,
    hidden: true,
    muted: false,
    readyState: 4,
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      attributes.delete(name);
      calls.push(`remove:${name}`);
    },
    set src(value) {
      attributes.set("src", value);
    },
    get src() {
      return attributes.get("src") ?? "";
    },
    load() {
      calls.push("load");
    },
    pause() {
      calls.push("pause");
    },
    play() {
      calls.push("play");
      return Promise.resolve();
    },
  };
  const elements = {
    cinematic: video,
    cinematicButton: { disabled: false },
    cinematicFallback: { hidden: true },
  };
  const context = vm.createContext({
    cinematicStatusKey: "optional",
    elements,
    setCinematicStatus: (status) => statuses.push(status),
  });
  const definition = appFunction(source, "playCinematic", "wireControls");
  vm.runInContext(`${definition}\nglobalThis.playCanonicalCinematic = playCinematic;`, context, { filename: "app.js" });
  return { calls, elements, play: () => context.playCanonicalCinematic(), statuses, video };
}

test("accepted encounter wave and breach transitions emit their authored cues while rejected duplicates stay silent", async () => {
  const fixture = await loadEncounterCueDispatcher();

  await fixture.dispatch({ type: "start-wave" });
  await fixture.dispatch({ type: "start-wave", accepted: false });
  await fixture.dispatch({ type: "breach" });

  assert.deepEqual(
    fixture.cueCalls,
    ["wave-spawn", "breach-alert"],
    "only reducer-accepted encounter transitions may emit the wave and breach audio contracts",
  );
});
test("only the boss-exposing final wave announces the automatic field event selected by the reducer", async () => {
  let prepared = startCampaign(createCampaign());
  assert.equal(prepared.accepted, true, "the public campaign fixture must start");
  let state = prepared.state;
  for (const action of ["hunt", "hunt", "extract", "materialize", "materialize", "capture"]) {
    const result = applyAction(state, action);
    assert.equal(result.accepted, true, `Stage 1 preparation must legally accept ${action}: ${result.message}`);
    state = result.state;
  }

  const fixture = await loadEncounterCueDispatcher({ campaignState: state });
  const waves = STAGES[0].encounter.waves;
  for (const [waveIndex, wave] of waves.entries()) {
    await fixture.dispatch({ type: "start-wave", stageId: STAGES[0].id, waveId: wave.id });
    await fixture.dispatch({ type: "wave-cleared", stageId: STAGES[0].id, waveId: wave.id });

    const fieldFeedback = fixture.feedbackCalls.filter((message) => message.startsWith("Field Event:"));
    if (waveIndex < waves.length - 1) {
      assert.deepEqual(
        fieldFeedback,
        [],
        `clearing non-final wave ${wave.id} must not announce an automatic field event`,
      );
    }
  }

  const [effect] = fixture.getCampaign().stage.activeEffects;
  assert.ok(effect, "the final wave must leave the reducer-selected automatic field effect active");
  assert.deepEqual(
    fixture.feedbackCalls.filter((message) => message.startsWith("Field Event:")),
    [`Field Event: ${translations.en[`effect.${effect.type}`]} (${effect.charges} charges)`],
    "the app must announce exactly the effect and charge count produced by the boss-exposing final clear",
  );
});


test("stopping battle clears one-shot audio and stale BGM completions before returning enabled music to the lobby", async () => {
  const fixture = await loadAudioSceneLifecycle();

  fixture.api.syncBgmScene("battle");
  fixture.api.stopBattle();

  assert.equal(fixture.player.src, "assets/audio/bgm-theme.mp3", "battle teardown must restore the lobby music source");
  assert.equal(fixture.player.dataset.audioScene, "lobby", "battle teardown must publish the restored lobby scene");
  assert.deepEqual(
    fixture.playerCalls.filter((call) => call.startsWith("play:")),
    ["play:assets/audio/battle-bgm.mp3", "play:assets/audio/bgm-theme.mp3"],
    "the enabled player must cross from battle music back to lobby music exactly once",
  );
  assert.equal(
    fixture.playerCalls.includes("clearInterval:99"),
    true,
    "battle teardown must clear its active render interval",
  );
  assert.equal(
    fixture.playerCalls.includes("clearTimeout:77"),
    true,
    "battle teardown must cancel its pending tactical feedback reset before leaving the battle",
  );
  assert.deepEqual(fixture.cueCalls, ["pause", "remove:src", "load"], "the active one-shot cue must be paused, unloaded, and reset");
  assert.deepEqual(
    fixture.ambienceCalls,
    ["pause", "remove:src", "load", "aria-pressed:false"],
    "stage ambience must be paused, unloaded, and reset to its inactive control state",
  );
  const stopped = fixture.api.state();
  assert.equal(stopped.ambiencePlayer, null, "stage ambience must release its player after unloading");
  assert.equal(stopped.lastCueEffect, "", "battle teardown must clear cue deduplication state for the next battle");
  assert.equal(stopped.lastCueStartedAt, 0, "battle teardown must clear the prior cue timestamp");

  fixture.playRuns[0].resolve();
  await Promise.resolve();
  assert.deepEqual(fixture.toggleCalls, [], "a stale battle-music play completion must not reassert the BGM toggle");
  fixture.playRuns[1].resolve();
  await Promise.resolve();
  assert.deepEqual(
    fixture.toggleCalls,
    ["is-playing:true", "aria-pressed:true"],
    "only the current lobby-music completion may confirm enabled playback",
  );
});

test("cinematic media failure preserves the fallback and the next play request reloads the canonical MP4", async () => {
  const fixture = await loadCinematicLifecycle();

  fixture.play();
  assert.equal(fixture.video.src, "assets/video/abyssal-surge-cinematic.mp4");
  assert.deepEqual(fixture.statuses, ["loading"]);
  assert.equal(fixture.elements.cinematicButton.disabled, true);

  fixture.video.onerror();
  assert.deepEqual(fixture.statuses, ["loading", "unavailable"]);
  assert.equal(fixture.video.hidden, true, "failed video must leave the optional media surface");
  assert.equal(fixture.elements.cinematicFallback.hidden, false, "failed video must reveal the transcript/direct-link fallback");
  assert.equal(fixture.video.getAttribute("src"), null, "failed media source must be unloaded before recovery");
  assert.equal(fixture.elements.cinematicButton.disabled, false, "failed media must leave retry available");

  fixture.play();
  assert.equal(fixture.video.src, "assets/video/abyssal-surge-cinematic.mp4", "retry must reattach the canonical representative");
  assert.equal(fixture.video.hidden, false);
  assert.equal(fixture.elements.cinematicFallback.hidden, true);
  assert.deepEqual(fixture.statuses, ["loading", "unavailable", "loading"]);
  assert.deepEqual(fixture.calls, ["load", "pause", "remove:src", "load", "load"]);
});

async function renderReactGameUiContract() {
  const source = await readFile(new URL("../react-game-ui.js", import.meta.url), "utf8");
  let root = null;
  const container = { style: {} };
  const createElement = (type, props, ...children) => {
    if (typeof type === "function") return type(props ?? {});
    return { type, props: props ?? {}, children: children.flat(Infinity) };
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {},
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => (id === "react-game-root" ? container : null),
    },
    window: {
      React: { createElement },
      ReactDOM: {
        render(value) {
          root = value;
        },
      },
      dispatchEvent() {},
    },
  });
  vm.runInContext(source, context, { filename: "react-game-ui.js" });
  assert.ok(root, "the React shell must render its public element tree");
  return root;
}

function findReactElement(root, id) {
  if (!root || typeof root !== "object") return null;
  if (root.props?.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findReactElement(child, id);
    if (found) return found;
  }
  return null;
}

test("battle cockpit renders stable selection HUD IDs beside the tactical canvas", async () => {
  const root = await renderReactGameUiContract();
  const requiredIds = [
    "dossier-count",
    "dossier-health",
    "dossier-order",
    "dossier-selection-hint",
  ];

  for (const id of requiredIds) {
    const element = findReactElement(root, id);
    assert.ok(element, `the rendered React cockpit must expose #${id}`);
    assert.notEqual(element.props.hidden, true, `#${id} must remain visible with the tactical canvas`);
  }
  assert.equal(
    findReactElement(root, "dossier-order").props["data-i18n"],
    "command.selection.order.none",
    "the initial order value must be localized",
  );
  assert.equal(
    findReactElement(root, "dossier-selection-hint").props["data-i18n"],
    "command.selectionHint",
    "the visible selection guidance must be localized",
  );
  assert.ok(findReactElement(root, "battle-canvas-3d"), "the selection HUD contract must coexist with the direct renderer canvas");
  assert.ok(findReactElement(root, "battle-canvas-fallback"), "the selection HUD contract must coexist with the fallback canvas");
});

function findReactElementsByProp(root, prop, value, matches = []) {
  if (!root || typeof root !== "object") return matches;
  if (root.props?.[prop] === value) matches.push(root);
  for (const child of root.children ?? []) findReactElementsByProp(child, prop, value, matches);
  return matches;
}

test("battlefield HUD exposes stable objective, resource, and selection mirror targets", async () => {
  const root = await renderReactGameUiContract();
  assert.ok(findReactElement(root, "battle-screen-ui"), "the battlefield HUD mirror must have a stable root");

  const requiredTargets = [
    "objective",
    "pressure",
    "wave",
    "souls",
    "legion",
    "nodes",
    "integrity",
    "boss",
    "forecast",
    "advance",
    "boss-phase",
    "enemy-growth",
    "selection-image",
    "selection-label",
    "selection-name",
    "selection-role",
    "selection-count",
    "selection-health",
    "selection-order",
    "selection-status",
  ];
  for (const target of requiredTargets) {
    assert.equal(
      findReactElementsByProp(root, "data-battle-screen", target).length,
      1,
      `the battlefield HUD must expose exactly one data-battle-screen="${target}" target`,
    );
  }
});
test("the minimap exposes a sighted-visible caption explaining the click-to-focus-camera interaction, distinct from its sr-only accessible hint", async () => {
  const root = await renderReactGameUiContract();
  const [caption] = findReactElementsByProp(root, "data-i18n", "battle.minimapCaption");
  assert.ok(caption, "the minimap panel must render a visible caption explaining what clicking it does");
  assert.notEqual(caption.props.className, "sr-only", "the minimap caption must not be visually hidden");

  const [srHint] = findReactElementsByProp(root, "data-i18n", "battle.minimapHint");
  assert.equal(srHint.props.className, "sr-only", "the keyboard-focus announcer must remain screen-reader-only, distinct from the sighted caption");

  for (const lang of ["ko", "en"]) {
    assert.ok(
      translations[lang]["battle.minimapCaption"],
      `battle.minimapCaption must be localized for ${lang}`,
    );
  }
});

test("the command hint explains the commander autonomously carries out commands regardless of squad selection", async () => {
  const root = await renderReactGameUiContract();
  const [hint] = findReactElementsByProp(root, "data-i18n", "command.hint");
  assert.ok(hint, "the command panel must render its usage hint");

  for (const lang of ["ko", "en"]) {
    const copy = translations[lang]["command.hint"];
    assert.ok(copy, `command.hint must be localized for ${lang}`);
    assert.notEqual(
      copy,
      lang === "ko"
        ? "버튼을 사용하거나, 다른 컨트롤에 포커스가 없을 때 표시된 키를 누르세요."
        : "Use buttons, or press the shown key while a control is not focused.",
      `command.hint (${lang}) must clarify the commander/selection relationship, not just restate button usage`,
    );
  }
});

test("summon evolution controls cover every exported recipe exactly once", async () => {
  const root = await renderReactGameUiContract();
  const expectedRecipeIds = ["ember-scion", "rift-hound", "ward-wisp"];
  assert.deepEqual(
    SUMMON_RECIPES.map((recipe) => recipe.id),
    expectedRecipeIds,
    "the exported summon recipe contract must retain the three player-facing evolution paths",
  );
  for (const recipeId of expectedRecipeIds) {
    assert.equal(
      findReactElementsByProp(root, "data-summon-recipe", recipeId).length,
      1,
      `the rendered controls must expose exactly one evolution action for ${recipeId}`,
    );
  }
});


test("selection HUD copy is complete and language-specific in Korean and English", () => {
  const keys = [
    "command.selectionCount",
    "command.selectionHealth",
    "command.selectionOrder",
    "command.selectionHint",
    "command.selectionNone",
    "command.selectionStatus.selected",
    "command.selectionStatus.none",
    "command.selectionPossessedRole",
    "command.selection.order.none",
    "command.selection.order.holding",
    "command.selection.order.moving",
    "command.selection.order.engaged",
    "command.selection.order.mixed",
    "battle.live.forecastLabel",
    "battle.live.advanceLabel",
    "battle.live.bossPhaseLabel",
    "battle.live.enemyGrowthLabel",
    "battle.live.forecast.none",
    "battle.live.forecast.wave",
    "battle.live.forecast.boss",
    "battle.live.advance.waiting",
    "battle.live.advance.stopped",
    "battle.live.advance.bossExposed",
    "battle.live.advance.dispatched",
    "battle.live.advance.spawned",
    "battle.live.advance.engaged",
    "battle.live.bossPhase.locked",
    "battle.live.bossPhase.active",
    "battle.live.enemyGrowth.none",
    "battle.live.enemyGrowth.active",
  ];

  for (const key of keys) {
    assert.match(translations.ko[key] ?? "", /\p{Script=Hangul}/u, `${key} must have Korean HUD copy`);
    assert.match(translations.en[key] ?? "", /[A-Za-z]/, `${key} must have English HUD copy`);
    assert.notEqual(translations.ko[key], translations.en[key], `${key} must not reuse one locale's string for both languages`);
  }
});

async function loadLiveFrontlineProjection(locale = "en") {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const node = () => ({ textContent: "", dataset: {} });
  const fields = {
    forecast: node(),
    advance: node(),
    bossPhase: node(),
    enemyGrowth: node(),
  };
  const elements = {
    battleScreenForecast: fields.forecast,
    battleScreenAdvance: fields.advance,
    battleScreenBossPhase: fields.bossPhase,
    battleScreenEnemyGrowth: fields.enemyGrowth,
  };
  const context = vm.createContext({
    elements,
    resolveBossPhase,
    translations,
  });
  const definitions = [
    appFunction(source, "formatLiveBattleHud", "deriveLiveBattleHud"),
    appFunction(source, "deriveLiveBattleHud", "renderLiveBattleHud"),
    appFunction(source, "renderLiveBattleHud", "projectBattleRuntime"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}
    globalThis.liveFrontlineApi = {
      derive: deriveLiveBattleHud,
      render: renderLiveBattleHud
    };`,
    context,
    { filename: "app.js" },
  );
  return {
    derive: (stage, state, runtime) => context.liveFrontlineApi.derive(stage, state, runtime, locale),
    project(stage, state, runtime) {
      context.liveFrontlineApi.render(stage, state, runtime, locale);
      return Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [
          name,
          { text: field.textContent, state: field.dataset.state },
        ]),
      );
    },
  };
}
function frontlineStageStates() {
  const started = startCampaign(createCampaign());
  if (!started.accepted) throw new Error(`Unable to start frontline HUD fixture: ${started.message}`);
  const pending = structuredClone(started.state.stage);
  const live = structuredClone(pending);
  live.encounter.activeWaveId = STAGES[0].encounter.waves[0].id;
  const boss = structuredClone(pending);
  for (const wave of boss.encounter.waves) wave.cleared = true;
  boss.encounter.activeWaveId = null;
  boss.encounter.bossExposed = true;
  boss.encounter.spawningStopped = true;
  boss.bossHealth = 4;
  return { pending, live, boss };
}
test("live frontline HUD projects Korean and English pending, live, and boss states", async (t) => {
  const contracts = {
    en: {
      pending: {
        forecast: { text: "Forecast: 1/3 scout · 2 hostiles · 15s", state: "pending" },
        advance: { text: "Spawn pending · awaiting the next approach", state: "waiting" },
        bossPhase: { text: "Boss phase locked · clear the waves first", state: "locked" },
        enemyGrowth: { text: "Enemy growth 1/3 · 0 active", state: "pending" },
      },
      live: {
        forecast: { text: "Forecast: 1/3 scout · 2 hostiles · 15s", state: "live" },
        advance: { text: "2 enemies advancing · 1 engagements", state: "engaged" },
        bossPhase: { text: "Boss phase locked · clear the waves first", state: "locked" },
        enemyGrowth: { text: "Enemy growth 1/3 · 2 active", state: "live" },
      },
      boss: {
        forecast: { text: "Forecast: all waves cleared · boss engagement", state: "boss" },
        advance: { text: "Spawning stopped · boss lane open", state: "stopped" },
        bossPhase: { text: "Boss phase 2/3 · 4/8 HP", state: "active" },
        enemyGrowth: { text: "Enemy growth 3/3 · 0 active", state: "boss" },
      },
    },
    ko: {
      pending: {
        forecast: { text: "예측: 1/3 정찰 · 적 2명 · 15초", state: "pending" },
        advance: { text: "생성 대기 · 다음 웨이브 접근 전", state: "waiting" },
        bossPhase: { text: "보스 단계 잠김 · 웨이브를 먼저 돌파", state: "locked" },
        enemyGrowth: { text: "적 성장 1/3 · 활성 0명", state: "pending" },
      },
      live: {
        forecast: { text: "예측: 1/3 정찰 · 적 2명 · 15초", state: "live" },
        advance: { text: "적 2명 진입 · 1곳 교전", state: "engaged" },
        bossPhase: { text: "보스 단계 잠김 · 웨이브를 먼저 돌파", state: "locked" },
        enemyGrowth: { text: "적 성장 1/3 · 활성 2명", state: "live" },
      },
      boss: {
        forecast: { text: "예측: 모든 웨이브 돌파 · 보스전", state: "boss" },
        advance: { text: "생성 중단 · 보스 진입로 개방", state: "stopped" },
        bossPhase: { text: "보스 단계 2/3 · 체력 4/8", state: "active" },
        enemyGrowth: { text: "적 성장 3/3 · 활성 0명", state: "boss" },
      },
    },
  };
  for (const locale of ["ko", "en"]) {
    const fixture = await loadLiveFrontlineProjection(locale);
    for (const stateName of ["pending", "live", "boss"]) {
      await t.test(`${locale} ${stateName}`, () => {
        const states = frontlineStageStates();
        const runtime = stateName === "live"
          ? { enemiesActive: 2, engagements: 1 }
          : { enemiesActive: 0, engagements: 0 };
        assert.deepEqual(
          fixture.project(STAGES[0], states[stateName], runtime),
          contracts[locale][stateName],
          `${locale} ${stateName} must expose exact frontline copy and semantic data-state values`,
        );
      });
    }
  }
});
test("renderer telemetry moves a live wave from dispatch through spawn to engagement", async (t) => {
  const fixture = await loadLiveFrontlineProjection("en");
  const cases = [
    {
      name: "dispatched",
      runtime: {},
      advance: { text: "Wave dispatched · renderer synchronizing", state: "dispatched" },
      growth: "Enemy growth 1/3 · 0 active",
    },
    {
      name: "spawned",
      runtime: { enemiesActive: 2, engagements: 0 },
      advance: { text: "2 enemies spawned · advancing", state: "spawned" },
      growth: "Enemy growth 1/3 · 2 active",
    },
    {
      name: "engaged",
      runtime: { enemiesActive: 2, engagements: 1 },
      advance: { text: "2 enemies advancing · 1 engagements", state: "engaged" },
      growth: "Enemy growth 1/3 · 2 active",
    },
  ];
  for (const contract of cases) {
    await t.test(contract.name, () => {
      const { live } = frontlineStageStates();
      const projected = fixture.project(STAGES[0], live, contract.runtime);
      assert.deepEqual(projected.advance, contract.advance);
      assert.equal(projected.enemyGrowth.text, contract.growth);
      assert.equal(projected.forecast.state, "live", "renderer counts must not override the campaign encounter's active-wave identity");
    });
  }
});
test("live frontline projection leaves stage, encounter, and renderer telemetry inputs unchanged", async () => {
  const fixture = await loadLiveFrontlineProjection("en");
  const stage = structuredClone(STAGES[0]);
  const { live: state } = frontlineStageStates();
  const runtime = {
    mode: "realtime",
    enemiesActive: 2,
    engagements: 1,
    nestedTelemetry: { exchanges: [1, 2] },
  };
  const before = {
    stage: structuredClone(stage),
    state: structuredClone(state),
    runtime: structuredClone(runtime),
  };
  fixture.derive(stage, state, runtime);
  assert.deepEqual(stage, before.stage, "projection must not mutate stage configuration");
  assert.deepEqual(state, before.state, "projection must not mutate authoritative campaign encounter state");
  assert.deepEqual(runtime, before.runtime, "projection must not normalize renderer telemetry in place");
});
function freezeSummonFixture(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeSummonFixture(child);
  return Object.freeze(value);
}
async function loadSummonEvolutionWiring(recipeId = "ember-scion") {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const delegatedClickWiring = source.match(
    /document\.addEventListener\("click", \(event\) => \{[\s\S]*?\n  \}\);(?=\n\n  elements\.exportSave)/,
  );
  assert.ok(delegatedClickWiring, "app runtime must expose delegated tactical command wiring");
  const initialCampaign = freezeSummonFixture({
    status: "active",
    progression: {
      summons: {
        essence: 9,
        levels: {},
      },
    },
  });
  const evolvedCampaign = freezeSummonFixture({
    status: "active",
    progression: {
      summons: {
        essence: 5,
        levels: { [recipeId]: 1 },
      },
    },
    domainResult: "evolveSummon",
  });
  const events = [];
  let clickListener = null;
  let resolvePersistence;
  const persisted = new Promise((resolve) => {
    resolvePersistence = resolve;
  });
  let context;
  context = vm.createContext({
    campaign: initialCampaign,
    SUMMON_RECIPES,
    evolveSummon: (state, selectedRecipeId) => {
      events.push({ type: "evolve", state, recipeId: selectedRecipeId });
      return { accepted: true, state: evolvedCampaign };
    },
    synchronizeBattleRenderer: () => {
      events.push({ type: "sync", state: context.campaign });
    },
    translate: (key) => translations.en[key] ?? "",
    translateRejectionReason: (message) => message,
    showTacticalFeedback: (message) => {
      events.push({ type: "feedback", message });
      context.render();
    },
    render: () => {
      events.push({ type: "render", state: context.campaign });
    },
    getCombatAlertCue: (semantic) => `cue:${semantic}`,
    playCombatAlertCue: (cue) => {
      events.push({ type: "cue", cue });
    },
    persistCampaign: async (key) => {
      const receipt = { type: "persist", key, state: context.campaign };
      events.push(receipt);
      resolvePersistence(receipt);
    },
    document: {
      addEventListener(type, listener) {
        if (type === "click") clickListener = listener;
      },
    },
  });
  const handler = appFunction(source, "handleSummonEvolution", "cancelPlacementMode");
  vm.runInContext(
    `"use strict";
    ${handler}
    ${delegatedClickWiring[0]}
    globalThis.summonEvolutionApi = {
      getCampaign: () => campaign
    };`,
    context,
    { filename: "app.js" },
  );
  assert.equal(typeof clickListener, "function", "the delegated command listener must be installed");
  return {
    click() {
      const button = {
        dataset: { summonRecipe: recipeId },
        closest(selector) {
          return selector === "#summon-evolution-controls button[data-summon-recipe]" ? this : null;
        },
      };
      clickListener({ target: button });
      return persisted;
    },
    events,
    evolvedCampaign,
    getCampaign: () => context.summonEvolutionApi.getCampaign(),
    initialCampaign,
  };
}
test("summon control delegates evolution and projects the returned campaign through render and persistence", async () => {
  const fixture = await loadSummonEvolutionWiring();
  const initialSnapshot = structuredClone(fixture.initialCampaign);
  const persistence = await fixture.click();
  const evolution = fixture.events.find((event) => event.type === "evolve");
  assert.ok(evolution, "the summon control must delegate progression to evolveSummon");
  assert.strictEqual(evolution.state, fixture.initialCampaign, "evolveSummon must receive the authoritative campaign state");
  assert.equal(evolution.recipeId, "ember-scion", "the clicked recipe must select the matching domain evolution");
  assert.deepEqual(fixture.initialCampaign, initialSnapshot, "the command handler must not mutate progression directly");
  assert.strictEqual(fixture.getCampaign(), fixture.evolvedCampaign, "the reducer result must become the authoritative campaign");
  const synchronization = fixture.events.find((event) => event.type === "sync");
  const render = fixture.events.find((event) => event.type === "render");
  const feedback = fixture.events.find((event) => event.type === "feedback");
  const cue = fixture.events.find((event) => event.type === "cue");
  assert.strictEqual(synchronization?.state, fixture.evolvedCampaign, "the renderer must synchronize the evolved campaign");
  assert.strictEqual(render?.state, fixture.evolvedCampaign, "visible feedback must render from the evolved campaign");
  assert.equal(feedback?.message, "Ember Scion evolved to level 1.", "the control must announce the accepted evolution");
  assert.equal(cue?.cue, "cue:summon-evolved", "accepted evolution must emit its authored combat cue");
  assert.equal(persistence.key, "persist.campaignSaved", "accepted evolution must use campaign persistence");
  assert.strictEqual(persistence.state, fixture.evolvedCampaign, "persistence must store the reducer-returned campaign");
});

async function loadSelectionDossierRuntime(locale = "en") {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const element = () => {
    const attributes = new Map();
    return {
      attributes,
      src: "",
      textContent: "",
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: (name) => attributes.delete(name),
      getAttribute: (name) => attributes.get(name) ?? null,
    };
  };
  const ids = Object.fromEntries([
    "dossier-label",
    "dossier-name",
    "dossier-role",
    "dossier-image",
    "dossier-count",
    "dossier-health",
    "dossier-order",
    "dossier-status",
    "battle-selection-image",
    "battle-selection-label",
    "battle-selection-name",
    "battle-selection-role",
    "battle-selection-count",
    "battle-selection-health",
    "battle-selection-order",
    "battle-selection-status",
  ].map((id) => [id, element()]));
  const elements = {
    battleScreenSelectionImage: ids["battle-selection-image"],
    battleScreenSelectionLabel: ids["battle-selection-label"],
    battleScreenSelectionName: ids["battle-selection-name"],
    battleScreenSelectionRole: ids["battle-selection-role"],
    battleScreenSelectionCount: ids["battle-selection-count"],
    battleScreenSelectionHealth: ids["battle-selection-health"],
    battleScreenSelectionOrder: ids["battle-selection-order"],
    battleScreenSelectionStatus: ids["battle-selection-status"],
  };
  const dossier = element();
  const context = vm.createContext({
    BATTLE_ACTION_SEMANTICS: Object.freeze({
      assault: Object.freeze({ source: "ally", target: "boss" }),
    }),
    campaign: Object.freeze({ status: "active" }),
    currentLang: () => locale,
    elements,
    document: {
      getElementById: (id) => ids[id] ?? null,
      querySelector: (selector) => (selector === ".selection-dossier" ? dossier : null),
      querySelectorAll: () => [],
    },
    translate: (key) => translations[locale][key] ?? key,
    visualizer: null,
    window: {
      CustomEvent: class CustomEvent {
        constructor(type, init) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
      dispatchEvent() {},
    },
  });
  const definitions = [
    appFunction(source, "selectionPortraitFor", "renderSelectionDossier"),
    appFunction(source, "handleRendererSelection", "renderSelectionDossier"),
    appFunction(source, "renderSelectionDossier", "currentActionFocus"),
    appFunction(source, "currentActionFocus", "updateActionFocus"),
    appFunction(source, "updateActionFocus", "handleActionFocus"),
    appFunction(source, "handleActionFocus", "projectActionFocus"),
    terminalAppFunction(source, "projectActionFocus", "let battleSessionId"),
  ];
  vm.runInContext(
    `const EMPTY_RENDERER_SELECTION = Object.freeze({
      count: 0, total: 0, health: 0, maxHealth: 0,
      possessed: 0, engaged: 0, moving: 0, order: "none", kind: "none"
    });
    let rendererSelectionSummary = EMPTY_RENDERER_SELECTION;
    let activeFieldFocusedAction = null;
    let activeCommandHoverAction = null;
    let activeCommandFocusAction = null;
    let battleSessionId = 3;
    ${definitions.join("\n\n")}
    globalThis.selectionDossierApi = {
      select: handleRendererSelection,
      focus: handleActionFocus
    };`,
    context,
    { filename: "app.js" },
  );
  return { api: context.selectionDossierApi, dossier, ids };
}

test("renderer selection survives temporary action-focus dossier previews", async () => {
  const { api, dossier, ids } = await loadSelectionDossierRuntime("en");
  api.select({
    count: 2,
    total: 3,
    health: 4,
    maxHealth: 6,
    possessed: 1,
    engaged: 1,
    moving: 1,
    order: "mixed",
  }, 3);

  assert.equal(ids["dossier-count"].textContent, "2 / 3", "the dossier must project actual selected and live totals");
  assert.equal(ids["dossier-health"].textContent, "4 / 6", "the dossier must project combined selected health");
  assert.equal(
    ids["dossier-order"].textContent,
    translations.en["command.selection.order.mixed"],
    "the dossier must project the renderer's current order",
  );

  api.focus("assault");
  assert.equal(dossier.getAttribute("data-focused"), "true", "action focus must temporarily mark the dossier as a preview");
  assert.equal(ids["dossier-name"].textContent, translations.en["command.assault.name"], "action focus must show its command preview");

  api.focus(null);
  assert.equal(dossier.getAttribute("data-focused"), null, "clearing action focus must leave preview mode");
  assert.equal(ids["dossier-count"].textContent, "2 / 3", "clearing the preview must restore the actual selected count");
  assert.equal(ids["dossier-health"].textContent, "4 / 6", "clearing the preview must restore actual combined health");
  assert.equal(ids["dossier-name"].textContent, translations.en["command.selectionName"], "clearing the preview must restore the selected-force identity");
  assert.equal(
    ids["dossier-order"].textContent,
    translations.en["command.selection.order.mixed"],
    "clearing the preview must restore the renderer's current order",
  );
});

test("renderer selection mirrors order and status into the battlefield HUD", async () => {
  const { api, ids } = await loadSelectionDossierRuntime("en");
  api.select({
    count: 2,
    total: 3,
    health: 4,
    maxHealth: 6,
    possessed: 0,
    engaged: 0,
    moving: 2,
    order: "moving",
  }, 3);

  assert.equal(
    ids["battle-selection-order"].textContent,
    translations.en["command.selection.order.moving"],
    "the battlefield HUD must mirror the renderer's current selection order",
  );
  assert.equal(
    ids["battle-selection-status"].textContent,
    `2 ${translations.en["command.selectionStatus.selected"]} · ${translations.en["command.selection.order.moving"]}`,
    "the battlefield HUD must mirror selected count and order in its live status",
  );

  api.select(null, 3);
  assert.equal(
    ids["battle-selection-order"].textContent,
    translations.en["command.selection.order.none"],
    "clearing the active renderer selection must reset the battlefield order mirror",
  );
  assert.equal(
    ids["battle-selection-status"].textContent,
    translations.en["command.selectionStatus.none"],
    "clearing the active renderer selection must reset the battlefield status mirror",
  );
});

test("selection portrait reflects the renderer's reported selection kind instead of a fixed image regardless of what is selected", async () => {
  const { api, ids } = await loadSelectionDossierRuntime("en");

  api.select({
    count: 0, total: 0, health: 0, maxHealth: 0,
    possessed: 0, engaged: 0, moving: 0, order: "none", kind: "none",
  }, 3);
  assert.equal(
    ids["dossier-image"].src,
    "assets/images/ui/action-materialize.png",
    "no selection must show the generic legion portrait, not the possess icon",
  );
  assert.equal(ids["battle-selection-image"].src, "assets/images/ui/action-materialize.png");

  api.select({
    count: 1, total: 1, health: 3, maxHealth: 3,
    possessed: 0, engaged: 0, moving: 0, order: "holding", kind: "shade",
  }, 3);
  assert.equal(
    ids["dossier-image"].src,
    "assets/images/ui/action-materialize.png",
    "a plain shade ally selection must show the generic legion portrait",
  );

  api.select({
    count: 1, total: 1, health: 3, maxHealth: 3,
    possessed: 1, engaged: 0, moving: 0, order: "holding", kind: "possessed",
  }, 3);
  assert.equal(
    ids["dossier-image"].src,
    "assets/images/ui/action-possess.png",
    "the possessed ally alone must show the possess portrait, distinct from a plain shade ally",
  );
  assert.equal(ids["battle-selection-image"].src, "assets/images/ui/action-possess.png");

  api.select({
    count: 2, total: 2, health: 6, maxHealth: 6,
    possessed: 1, engaged: 0, moving: 0, order: "holding", kind: "mixed",
  }, 3);
  assert.equal(
    ids["dossier-image"].src,
    "assets/images/ui/action-materialize.png",
    "a mixed possessed+shade selection must fall back to the generic legion portrait, not falsely claim possessed",
  );
});

test("app passes session-scoped selection callbacks to both battle renderers", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const rendererOptions = [];
  const selectionCalls = [];
  const makeRenderer = (kind) => class Renderer {
    constructor(_canvas, _presentation, options) {
      this.kind = kind;
      this.options = options;
      rendererOptions.push(this);
    }
    async init() {}
    setPlacementMode() {}
    destroy() {}
  };
  const stage = { id: "cinder-span", nodeGoal: 1 };
  const context = vm.createContext({
    BattleVisualizer: makeRenderer("fallback"),
    RealtimeBattle: makeRenderer("realtime"),
    EMPTY_RENDERER_SELECTION: Object.freeze({
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
    }),
    activateBattleFallback: undefined,
    activePlacementMode: null,
    armEncounterWhenPrepared() {},
    battleSessionId: 0,
    BATTLE_RENDERER_INIT_TIMEOUT_MS: 25000,
    battleStarting: false,
    battleVisualFallback: false,
    campaign: { status: "active" },
    cooldownTimer: 0,
    currentActionFocus: () => null,
    currentStage: () => stage,
    elements: { battleCanvas3d: {}, battleFallbackCanvas: {} },
    getAvailableActions: () => [],
    getBattlePresentation: () => ({ stageNumber: 1 }),
    getInteractiveBattleActions: () => [],
    handleAction() {},
    handleActionFocus() {},
    handleEncounterEvent() {},
    handleRendererRuntime() {},
    handleRendererSelection: (summary, sessionId) => selectionCalls.push({ summary, sessionId }),
    handleTacticalRequest() {},
    lastScrolledStageId: "old-stage",
    pendingBattleRenderer: null,
    projectActionFocus() {},
    projectBattleRuntime() {},
    render() {},
    renderBattleAssetStatus() {},
    renderBattlePresentation: () => ({ stageNumber: 1 }),
    rendererRuntime: {},
    rendererSelectionSummary: {},
    syncBgmScene() {},
    synchronizeBattleRenderer() {},
    visualizer: null,
    window: {
      matchMedia: () => ({ matches: false }),
      setInterval: () => 1,
      setTimeout: () => 0,
    },
  });
  const definitions = [
    appFunction(source, "activateBattleFallback", "startBattle"),
    appFunction(source, "startBattle", "battleUiActive"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}
    globalThis.startBattleForSelectionTest = startBattle;
    globalThis.activateFallbackForSelectionTest = activateBattleFallback;`,
    context,
    { filename: "app.js" },
  );

  await context.startBattleForSelectionTest();
  const realtime = rendererOptions.find((renderer) => renderer.kind === "realtime");
  assert.equal(typeof realtime?.options.onSelectionChange, "function", "RealtimeBattle must receive the app selection callback");
  const realtimeSummary = Object.freeze({ count: 1 });
  realtime.options.onSelectionChange(realtimeSummary);

  context.activateFallbackForSelectionTest(stage, 8);
  const fallback = rendererOptions.find((renderer) => renderer.kind === "fallback");
  assert.equal(typeof fallback?.options.onSelectionChange, "function", "BattleVisualizer must receive the app selection callback");
  const fallbackSummary = Object.freeze({ count: 2 });
  fallback.options.onSelectionChange(fallbackSummary);

  assert.deepEqual(
    selectionCalls,
    [
      { summary: realtimeSummary, sessionId: 1 },
      { summary: fallbackSummary, sessionId: 8 },
    ],
    "both callbacks must preserve their renderer session so stale battle events can be rejected",
  );
});

test("startBattle falls back to the Canvas2D renderer instead of leaving every command permanently disabled when RealtimeBattle.init() never settles", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const rendererKinds = [];
  const RealtimeBattleNeverResolves = class {
    constructor() { rendererKinds.push("realtime-constructed"); }
    // Simulates a genuinely stuck load (huge GLBs on a slow connection):
    // this promise is intentionally never resolved or rejected.
    init() { return new Promise(() => {}); }
    setPlacementMode() {}
    destroy() { rendererKinds.push("realtime-destroyed"); }
  };
  const BattleVisualizerFallback = class {
    constructor() { rendererKinds.push("fallback-constructed"); }
    init() {}
    setPlacementMode() {}
    destroy() {}
  };
  const stage = { id: "cinder-span", nodeGoal: 1 };
  const context = vm.createContext({
    BattleVisualizer: BattleVisualizerFallback,
    RealtimeBattle: RealtimeBattleNeverResolves,
    EMPTY_RENDERER_SELECTION: Object.freeze({ count: 0 }),
    activateBattleFallback: undefined,
    activePlacementMode: null,
    armEncounterWhenPrepared() {},
    battleSessionId: 0,
    // Keep the fixture fast: prove the fallback fires once init() has
    // genuinely not settled, without a real multi-second wait.
    BATTLE_RENDERER_INIT_TIMEOUT_MS: 20,
    battleStarting: false,
    battleVisualFallback: false,
    campaign: { status: "active" },
    cooldownTimer: 0,
    currentActionFocus: () => null,
    currentStage: () => stage,
    elements: { battleCanvas3d: {}, battleFallbackCanvas: {} },
    getAvailableActions: () => [],
    getBattlePresentation: () => ({ stageNumber: 1 }),
    getInteractiveBattleActions: () => [],
    handleAction() {},
    handleActionFocus() {},
    handleEncounterEvent() {},
    handleRendererRuntime() {},
    handleRendererSelection() {},
    handleTacticalRequest() {},
    lastScrolledStageId: "old-stage",
    pendingBattleRenderer: null,
    projectActionFocus() {},
    projectBattleRuntime() {},
    render() {},
    renderBattleAssetStatus() {},
    renderBattlePresentation: () => ({ stageNumber: 1 }),
    rendererRuntime: {},
    rendererSelectionSummary: {},
    syncBgmScene() {},
    synchronizeBattleRenderer() {},
    visualizer: null,
    window: {
      matchMedia: () => ({ matches: false }),
      setInterval: () => 1,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    },
  });
  const definitions = [
    appFunction(source, "activateBattleFallback", "startBattle"),
    appFunction(source, "startBattle", "battleUiActive"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}
    globalThis.startBattleForTimeoutTest = startBattle;`,
    context,
    { filename: "app.js" },
  );

  await context.startBattleForTimeoutTest();

  assert.deepEqual(
    rendererKinds,
    ["realtime-constructed", "realtime-destroyed", "fallback-constructed"],
    "a RealtimeBattle whose init() never settles must be destroyed and replaced by the Canvas2D fallback instead of leaving visualizer null (and every command button disabled) forever",
  );
  assert.equal(context.visualizer instanceof BattleVisualizerFallback, true, "the fallback renderer must become the active visualizer");
  assert.equal(context.battleStarting, false, "battleStarting must clear so battleUiActive() -- and every command button -- can become true again");
});

test("selection dossier ignores stale renderer clears and projects the active renderer clear", async () => {
  const { api, dossier, ids } = await loadSelectionDossierRuntime("en");
  api.select({
    count: 1,
    total: 2,
    health: 2.5,
    maxHealth: 5,
    possessed: 1,
    engaged: 0,
    moving: 0,
    order: "holding",
  }, 3);

  api.select(null, 2);
  assert.equal(ids["dossier-count"].textContent, "1 / 2", "a prior renderer session must not clear the active selection");
  assert.equal(ids["dossier-health"].textContent, "2.5 / 5", "a stale clear must preserve the active renderer health projection");

  api.select(null, 3);
  assert.equal(dossier.getAttribute("data-focused"), null, "an active renderer clear must leave the dossier in selection mode");
  assert.equal(ids["dossier-count"].textContent, "0 / 0", "an active renderer clear must reset selected and live counts");
  assert.equal(ids["dossier-health"].textContent, "0 / 0", "an active renderer clear must reset aggregate health");
  assert.equal(ids["dossier-name"].textContent, translations.en["command.selectionNone"], "an active renderer clear must restore the empty-selection identity");
  assert.equal(ids["dossier-order"].textContent, translations.en["command.selection.order.none"], "an active renderer clear must reset the order projection");
  assert.equal(ids["dossier-status"].textContent, translations.en["command.selectionStatus.none"], "an active renderer clear must publish the empty-selection status");
});

function responsiveCssBlock(source, header) {
  const normalized = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [];
  let searchIndex = 0;
  while (searchIndex < normalized.length) {
    const headerIndex = normalized.indexOf(header, searchIndex);
    if (headerIndex === -1) break;
    const openIndex = normalized.indexOf("{", headerIndex + header.length);
    assert.notEqual(openIndex, -1, `${header} must open a CSS block`);
    let depth = 1;
    for (let index = openIndex + 1; index < normalized.length; index += 1) {
      if (normalized[index] === "{") depth += 1;
      if (normalized[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(normalized.slice(openIndex + 1, index));
        searchIndex = index + 1;
        break;
      }
    }
    assert.equal(depth, 0, `${header} must close its CSS block`);
  }
  assert.ok(blocks.length > 0, `stylesheet must retain ${header}`);
  return blocks.join("\n");
}

function responsiveCssRules(source) {
  const rules = [];
  let cursor = 0;
  while (cursor < source.length) {
    const openIndex = source.indexOf("{", cursor);
    if (openIndex === -1) break;
    const selector = source.slice(cursor, openIndex).trim();
    let depth = 1;
    let closeIndex = openIndex + 1;
    for (; closeIndex < source.length && depth > 0; closeIndex += 1) {
      if (source[closeIndex] === "{") depth += 1;
      if (source[closeIndex] === "}") depth -= 1;
    }
    assert.equal(depth, 0, `${selector} must close its CSS rule`);
    rules.push({
      selector,
      body: source.slice(openIndex + 1, closeIndex - 1),
    });
    cursor = closeIndex;
  }
  return rules;
}

function responsiveCssDeclaration(rule, property) {
  const declaration = rule?.body
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${property}:`));
  return declaration?.slice(declaration.indexOf(":") + 1).trim();
}

test("short-landscape stylesheet retains explicit canvas, dossier, and command flow rules", async () => {
  const styles = await readFile(new URL("../react-game-ui.css", import.meta.url), "utf8");
  const compactRules = responsiveCssRules(
    responsiveCssBlock(styles, "@media (min-width: 900px) and (max-height: 760px)"),
  );
  const ruleFor = (rules, selector) => rules.find((rule) => rule.selector === selector);
  const cockpit = ruleFor(compactRules, ".cockpit-main");
  const battlefield = compactRules.find(({ selector }) => (
    selector.split(",").map((entry) => entry.trim()).includes(".cockpit-main .battle-field-panel")
  ));
  const commands = ruleFor(compactRules, "#command-panel.field-command-dock");
  const dossier = ruleFor(compactRules, ".field-command-dock .selection-dossier");

  assert.equal(
    responsiveCssDeclaration(cockpit, "grid-template-rows"),
    "minmax(0, 1fr) 14rem !important",
    "landscapes through 760px tall must let the field shrink while reserving a 14rem command row",
  );
  assert.equal(
    responsiveCssDeclaration(battlefield, "min-height"),
    "0 !important",
    "the field and canvas must be allowed to shrink instead of forcing the dossier and commands over them",
  );
  assert.equal(
    responsiveCssDeclaration(battlefield, "aspect-ratio"),
    "auto !important",
    "short landscapes must release the canvas aspect floor that previously collapsed the available rows",
  );
  assert.equal(
    responsiveCssDeclaration(commands, "grid-template-areas"),
    "none !important",
    "the compact command dock must release its desktop grid areas for the flex-column cutover",
  );
  assert.equal(
    responsiveCssDeclaration(commands, "height"),
    "100% !important",
    "the compact command dock must fill the reserved 14rem row without covering the canvas",
  );
  assert.equal(
    responsiveCssDeclaration(dossier, "display"),
    "grid !important",
    "the selected-unit dossier must remain reachable in short landscape",
  );
});
