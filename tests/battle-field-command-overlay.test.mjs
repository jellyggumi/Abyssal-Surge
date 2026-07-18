import assert from "node:assert/strict";
import test from "node:test";

import { receiptCopy, selectCurrentCommand, textOf } from "../battle-field-command-overlay.js";

function command({ ariaCurrent = null, currentObjective = false, disabled = false } = {}) {
  return {
    disabled,
    getAttribute(name) {
      return name === "aria-current" ? ariaCurrent : null;
    },
    classList: {
      contains(name) {
        return name === "current-objective" && currentObjective;
      },
    },
  };
}

class StaticElement {
  constructor(tagName = "div", text = "") {
    this.tagName = tagName.toUpperCase();
    this._text = text;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.parentElement = null;
    this.clickCount = 0;
    this._classes = new Set();
    this._listeners = new Map();
    this._queries = new Map();
    this.classList = {
      contains: (name) => this._classes.has(name),
      add: (...names) => names.forEach((name) => this._classes.add(name)),
      remove: (...names) => names.forEach((name) => this._classes.delete(name)),
    };
  }

  get textContent() {
    return `${this._text}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value) {
    this._text = String(value ?? "");
    this.children = [];
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  set innerHTML(markup) {
    if (this.tagName !== "SECTION") return;
    const localize = (element, key) => {
      if (String(markup).includes(`data-i18n="${key}"`)) element.setAttribute("data-i18n", key);
    };

    const objectiveLine = new StaticElement("div");
    objectiveLine.className = "ashen-field-command__standard";
    const eyebrow = new StaticElement("span", "Current order");
    eyebrow.className = "ashen-field-command__eyebrow";
    localize(eyebrow, "fieldOverlay.order");
    const objective = new StaticElement("p");
    objective.className = "ashen-field-command__objective";
    objective.setAttribute("data-field-overlay", "objective");
    objectiveLine.append(eyebrow, objective);

    const watch = new StaticElement("div");
    watch.className = "ashen-field-command__watch";
    const hostileLabel = new StaticElement("span", "Hostile ingress");
    hostileLabel.className = "ashen-field-command__label";
    localize(hostileLabel, "fieldOverlay.ingress");
    const hostile = new StaticElement("span");
    hostile.className = "ashen-field-command__hostile";
    const pressure = new StaticElement("span");
    pressure.className = "ashen-field-command__pressure";
    watch.append(hostileLabel, hostile, pressure);

    const activation = new StaticElement("button");
    activation.className = "ashen-field-command__activate";
    const activationName = new StaticElement("span");
    activationName.className = "ashen-field-command__activate-name";
    const activationNote = new StaticElement("span");
    activationNote.className = "ashen-field-command__activate-note";
    activation.append(activationName, activationNote);

    const receipt = new StaticElement("output");
    receipt.className = "ashen-field-command__receipt";
    receipt.setAttribute("data-field-overlay", "relay-receipt");
    receipt.setAttribute("role", "status");
    receipt.setAttribute("aria-live", "polite");
    receipt.hidden = true;
    const receiptPrefix = new StaticElement("span");
    receiptPrefix.className = "ashen-field-command__receipt-prefix";
    localize(receiptPrefix, "fieldOverlay.relayPrefix");
    const receiptGap = new StaticElement("span", " ");
    const receiptCommand = new StaticElement("span");
    receiptCommand.className = "ashen-field-command__receipt-command";
    receiptCommand.setAttribute("data-field-overlay", "relay-command");
    receipt.append(receiptPrefix, receiptGap, receiptCommand);

    const ward = new StaticElement("p");
    ward.className = "ashen-field-command__ward";
    const wardLabel = new StaticElement("span", "Gate ward — loss point");
    localize(wardLabel, "fieldOverlay.ward");
    const wardValue = new StaticElement("strong");
    ward.append(wardLabel, wardValue);

    const resultLine = new StaticElement("div");
    resultLine.className = "ashen-field-command__result";
    resultLine.setAttribute("data-field-overlay", "confirmed-result");
    const resultLabel = new StaticElement("span", "Field status");
    resultLabel.className = "ashen-field-command__label";
    localize(resultLabel, "fieldOverlay.status");
    const result = new StaticElement("span");
    result.className = "ashen-field-command__result-copy";
    resultLine.append(resultLabel, result);
    resultLine._queries.set(".ashen-field-command__label", resultLabel);
    resultLine._queries.set(".ashen-field-command__result-copy", result);

    this.append(objectiveLine, watch, activation, receipt, ward, resultLine);
    this._queries = new Map([
      [".ashen-field-command__standard", objectiveLine],
      [".ashen-field-command__eyebrow", eyebrow],
      [".ashen-field-command__objective", objective],
      [".ashen-field-command__watch .ashen-field-command__label", hostileLabel],
      [".ashen-field-command__result", resultLine],
      [".ashen-field-command__result-copy", result],
      [".ashen-field-command__label", resultLabel],
      [".ashen-field-command__result .ashen-field-command__label", resultLabel],
      [".ashen-field-command__hostile", hostile],
      [".ashen-field-command__pressure", pressure],
      [".ashen-field-command__activate", activation],
      [".ashen-field-command__activate-name", activationName],
      [".ashen-field-command__activate-note", activationNote],
      [".ashen-field-command__receipt", receipt],
      [".ashen-field-command__receipt-prefix", receiptPrefix],
      [".ashen-field-command__receipt-command", receiptCommand],
      [".ashen-field-command__ward span", wardLabel],
      [".ashen-field-command__ward strong", wardValue],
      ['[data-field-overlay="objective"]', objective],
      ['[data-field-overlay="confirmed-result"]', resultLine],
      ['[data-field-overlay="relay-receipt"]', receipt],
      ['[data-field-overlay="relay-command"]', receiptCommand],
    ]);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }

  querySelector(selector) {
    if (this._queries.has(selector)) return this._queries.get(selector);
    const attributeSelector = /^\[([^=\]]+)="([^"]+)"\]$/.exec(selector);
    if (attributeSelector && this.getAttribute(attributeSelector[1]) === attributeSelector[2]) return this;
    if (selector === "button" && this.tagName === "BUTTON") return this;
    if (selector === ".current") {
      for (const child of this.children) {
        if (child.classList.contains("current")) return child;
        const match = child.querySelector(selector);
        if (match) return match;
      }
      return null;
    }
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }

  querySelectorAll(selector) {
    return this._queries.get(selector) ?? [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) {
      const datasetKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[datasetKey] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(name, listener) {
    const listeners = this._listeners.get(name) ?? [];
    listeners.push(listener);
    this._listeners.set(name, listeners);
  }

  click() {
    this.clickCount += 1;
    for (const listener of this._listeners.get("click") ?? []) listener({ currentTarget: this });
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
}

function staticCommand({ action, name, detail, current = false, disabled = false, nameI18nKey = null }) {
  const button = new StaticElement("button");
  button.dataset.action = action;
  button.disabled = disabled;
  if (current) button.setAttribute("aria-current", "step");
  const commandName = new StaticElement("strong", name);
  if (nameI18nKey) commandName.setAttribute("data-i18n", nameI18nKey);
  const commandDetail = new StaticElement("small", detail);
  button.append(commandName, commandDetail);
  button._queries.set("strong", commandName);
  button._queries.set("small", commandDetail);
  return button;
}

function createStaticOverlayFixture({
  locale = "ko",
  checklistObjective = "Secure the breach marker",
  checklistObjectives = checklistObjective ? [checklistObjective] : [],
  stageObjective = "Fallback stage objective",
  campaignStatus = "Accepted outcome",
  commands = [
    staticCommand({
      action: "hunt",
      name: "Hunt",
      detail: "Trace the breach.",
      current: true,
    }),
  ],
} = {}) {
  const field = new StaticElement("section");
  const container = new StaticElement("div");
  const commandPanel = new StaticElement("section");
  commandPanel.querySelectorAll = (selector) => (selector === "[data-action]" ? commands : []);
  commandPanel.append(...commands);

  const checklist = new StaticElement("ol");
  const checklistItems = checklistObjectives.map((objective) => new StaticElement("li", objective));
  const currentObjective = checklistItems[0] ?? null;
  if (currentObjective) currentObjective.classList.add("current");
  checklist.append(...checklistItems);

  const status = campaignStatus === null ? null : new StaticElement("output", campaignStatus);
  const sources = new Map([
    ["#battle-field", field],
    ["#canvas-container-3d", container],
    ["#command-panel", commandPanel],
    ["#objective-checklist", checklist],
    ["#stage-objective", new StaticElement("span", stageObjective)],
    ["#campaign-status", status],
    ["#battle-hostile-label", new StaticElement("span", "Hostile fixture")],
    ["#battle-pressure", new StaticElement("span", "Pressure fixture")],
    ["#integrity-value", new StaticElement("span", "10 / 10")],
  ]);
  const observers = [];
  const observations = [];
  const documentElement = new StaticElement("html");
  const storage = new Map(locale ? [["abyssal-command-lang", locale]] : []);
  const matchingElements = (selector) => {
    const matches = [];
    const visited = new Set();
    const visit = (element) => {
      if (!element || visited.has(element)) return;
      visited.add(element);
      if (
        (selector === "[data-i18n]" && element.getAttribute("data-i18n") !== null) ||
        (selector === "[data-i18n-aria]" && element.getAttribute("data-i18n-aria") !== null)
      ) {
        matches.push(element);
      }
      element.children.forEach(visit);
    };

    visit(documentElement);
    sources.forEach(visit);
    return matches;
  };

  return {
    document: {
      documentElement,
      createElement: (tagName) => new StaticElement(tagName),
      querySelector: (selector) => (
        selector === "#objective-checklist .current"
          ? checklist.querySelector(".current")
          : sources.get(selector) ?? null
      ),
      querySelectorAll: matchingElements,
    },
    window: {
      matchMedia: () => ({ matches: true }),
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        this.observations = [];
        observers.push(this);
      }

      observe(target, options) {
        this.targets.push(target);
        const observation = { target, options };
        this.observations.push(observation);
        observations.push(observation);
      }

      disconnect() {
        this.targets = [];
      }
    },
    container,
    commandPanel,
    checklist,
    checklistItems,
    status,
    observations,
    notify(target) {
      for (const observer of observers) {
        if (observer.targets.includes(target)) observer.callback([], observer);
      }
    },
  };
}

let fixtureImportNumber = 0;

async function withMountedOverlay(fixture, verify) {
  const globals = ["document", "window", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame"];
  const prior = new Map(globals.map((name) => [name, {
    exists: Object.prototype.hasOwnProperty.call(globalThis, name),
    value: globalThis[name],
  }]));

  Object.assign(globalThis, {
    document: fixture.document,
    window: fixture.window,
    MutationObserver: fixture.MutationObserver,
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
    cancelAnimationFrame: () => {},
  });

  try {
    const i18nUrl = new URL("../i18n.js", import.meta.url);
    i18nUrl.searchParams.set("static-fixture", String(++fixtureImportNumber));
    const i18n = await import(i18nUrl.href);
    const moduleUrl = new URL("../battle-field-command-overlay.js", import.meta.url);
    moduleUrl.searchParams.set("static-fixture", String(++fixtureImportNumber));
    await import(moduleUrl.href);
    const overlay = fixture.container.children[0];
    assert.ok(overlay, "the module must mount the field overlay into the existing battlefield container");
    return await verify(overlay, i18n);
  } finally {
    for (const [name, { exists, value }] of prior) {
      if (exists) globalThis[name] = value;
      else delete globalThis[name];
    }
  }
}
const KOREAN_OVERLAY_COPY = {
  aria: "현재 전장 명령",
  order: "현재 명령",
  ingress: "적 침입",
  ward: "관문 수호 — 패배 지점",
  status: "전장 상태",
};

const ENGLISH_OVERLAY_COPY = {
  aria: "Current field command",
  order: "Current order",
  ingress: "Hostile ingress",
  ward: "Gate ward — loss point",
  status: "Field status",
};

function assertLocalizedOverlayChrome(overlay, copy) {
  assert.equal(overlay.getAttribute("aria-label"), copy.aria, "the overlay accessible name must use the selected locale");
  assert.equal(overlay.querySelector(".ashen-field-command__eyebrow").textContent, copy.order, "the current-order label must be localized");
  assert.equal(
    overlay.querySelector(".ashen-field-command__watch .ashen-field-command__label").textContent,
    copy.ingress,
    "the hostile-ingress label must be localized",
  );
  assert.equal(overlay.querySelector(".ashen-field-command__ward span").textContent, copy.ward, "the ward label must be localized");
  assert.equal(
    overlay.querySelector(".ashen-field-command__result .ashen-field-command__label").textContent,
    copy.status,
    "the field-status label must be localized",
  );
}

function localizedReceiptPrefix(i18n, locale) {
  return i18n.translations[locale]["fieldOverlay.relayPrefix"];
}

test("selectCurrentCommand resolves marked and enabled commands in priority order", () => {
  const enabled = command();
  const objective = command({ currentObjective: true, disabled: true });
  const currentStep = command({ ariaCurrent: "step", disabled: true });

  const cases = [
    {
      name: "aria-current step wins over current-objective and enabled commands",
      commands: [enabled, objective, currentStep],
      expected: currentStep,
    },
    {
      name: "current-objective wins over an earlier enabled command when no step is marked",
      commands: [enabled, objective],
      expected: objective,
    },
    {
      name: "the first enabled command is selected when no command is marked",
      commands: [command({ disabled: true }), enabled, command()],
      expected: enabled,
    },
  ];

  for (const { name, commands, expected } of cases) {
    assert.equal(selectCurrentCommand(commands), expected, name);
  }
});

test("selectCurrentCommand retains the first command when every command is disabled", () => {
  const firstDisabled = command({ disabled: true });
  const secondDisabled = command({ disabled: true });

  assert.equal(
    selectCurrentCommand([firstDisabled, secondDisabled]),
    firstDisabled,
    "an all-disabled command panel must retain a stable command target instead of returning nothing",
  );
});

test("textOf normalizes meaningful text and uses the supplied fallback for blank or missing elements", () => {
  const cases = [
    {
      name: "collapses internal whitespace and trims surrounding whitespace",
      element: { textContent: "\n  Rally\tthrough   the breach  \n" },
      fallback: "No command",
      expected: "Rally through the breach",
    },
    {
      name: "uses the supplied fallback for blank text",
      element: { textContent: " \n\t " },
      fallback: "No command",
      expected: "No command",
    },
    {
      name: "uses the supplied fallback when no element exists",
      element: null,
      fallback: "No command",
      expected: "No command",
    },
  ];

  for (const { name, element, fallback, expected } of cases) {
    assert.equal(textOf(element, fallback), expected, name);
  }
});

test("receiptCopy reports only the command the field proxy relayed", async () => {
  const { translations } = await import("../i18n.js");
  assert.equal(
    receiptCopy(null),
    "",
    "a field receipt must remain absent before the proxy relays a native command",
  );
  assert.equal(
    receiptCopy({ name: "Hunt" }),
    `${translations.ko["fieldOverlay.relayPrefix"]} Hunt`,
    "a field receipt must name the existing command the proxy relayed",
  );
});

test("mounted overlay localizes Korean chrome and preserves the relayed native command", { concurrency: false }, async () => {
  const nativeCommand = staticCommand({
    action: "hunt",
    name: "Hunt the native spoor",
    detail: "Trace the existing breach.",
    current: true,
  });
  const fixture = createStaticOverlayFixture({ commands: [nativeCommand] });

  await withMountedOverlay(fixture, async (overlay, i18n) => {
    const activation = overlay.querySelector("button");
    const receipt = overlay.querySelector('[data-field-overlay="relay-receipt"]');
    const prefix = overlay.querySelector('[data-i18n="fieldOverlay.relayPrefix"]');
    const relayedCommand = overlay.querySelector('[data-field-overlay="relay-command"]');

    assert.equal(fixture.document.documentElement.lang, "ko", "Korean must be the default document locale");
    assertLocalizedOverlayChrome(overlay, KOREAN_OVERLAY_COPY);
    activation.click();
    assert.equal(prefix.textContent, localizedReceiptPrefix(i18n, "ko"), "the receipt prefix must default to Korean");
    assert.equal(relayedCommand.textContent, nativeCommand.querySelector("strong").textContent, "the receipt must copy the native command name");
    assert.equal(receipt.hidden, false, "the localized receipt must appear after native delegation");
  });
});

test("mounted overlay applies a persisted English locale on first mount", { concurrency: false }, async () => {
  const nativeCommand = staticCommand({
    action: "extract",
    name: "Extract the native cache",
    detail: "Secure the existing reserve.",
    current: true,
  });
  const fixture = createStaticOverlayFixture({ locale: "en", commands: [nativeCommand] });

  await withMountedOverlay(fixture, async (overlay, i18n) => {
    const activation = overlay.querySelector("button");
    const prefix = overlay.querySelector('[data-i18n="fieldOverlay.relayPrefix"]');
    const relayedCommand = overlay.querySelector('[data-field-overlay="relay-command"]');

    assert.equal(fixture.document.documentElement.lang, "en", "a persisted English preference must apply before the overlay is mounted");
    assertLocalizedOverlayChrome(overlay, ENGLISH_OVERLAY_COPY);
    activation.click();
    assert.equal(prefix.textContent, localizedReceiptPrefix(i18n, "en"), "the persisted locale must select the English receipt prefix");
    assert.equal(relayedCommand.textContent, nativeCommand.querySelector("strong").textContent, "localization must not replace the native command name");
  });
});

test("mounted overlay updates static chrome and a visible receipt through the public language switch", { concurrency: false }, async () => {
  const rawCampaignStatus = "  Hunt accepted:\n  the rift spoor is  secured  \n";
  const nativeCommand = staticCommand({
    action: "hunt",
    name: "Hunt the native spoor",
    detail: "Trace the existing breach.",
    current: true,
  });
  const fixture = createStaticOverlayFixture({ campaignStatus: rawCampaignStatus, commands: [nativeCommand] });

  await withMountedOverlay(fixture, async (overlay, i18n) => {
    const activation = overlay.querySelector("button");
    const receipt = overlay.querySelector('[data-field-overlay="relay-receipt"]');
    const prefix = overlay.querySelector('[data-i18n="fieldOverlay.relayPrefix"]');
    const relayedCommand = overlay.querySelector('[data-field-overlay="relay-command"]');
    const statusCopy = overlay.querySelector(".ashen-field-command__result-copy");

    activation.click();
    i18n.setLanguage("en");

    assert.equal(fixture.document.documentElement.lang, "en", "the public language switch must update the document locale");
    assertLocalizedOverlayChrome(overlay, ENGLISH_OVERLAY_COPY);
    assert.equal(receipt.hidden, false, "switching language must retain an already visible receipt");
    assert.equal(prefix.textContent, localizedReceiptPrefix(i18n, "en"), "switching language must update the visible receipt prefix");
    assert.equal(relayedCommand.textContent, nativeCommand.querySelector("strong").textContent, "switching language must retain the native relayed command name");
    assert.equal(statusCopy.textContent, rawCampaignStatus, "switching chrome language must not alter authored campaign-status copy");
  });
});

test("mounted overlay reprojects the relayed native command after campaign progression and a public language switch", { concurrency: false }, async () => {
  const huntCommand = staticCommand({
    action: "hunt",
    name: "Hunt",
    detail: "Trace the existing breach.",
    current: true,
    nameI18nKey: "command.hunt.name",
  });
  const extractCommand = staticCommand({
    action: "extract",
    name: "Extract",
    detail: "Secure the exposed reserve.",
    nameI18nKey: "command.extract.name",
  });
  const fixture = createStaticOverlayFixture({ commands: [huntCommand, extractCommand] });

  await withMountedOverlay(fixture, async (overlay, i18n) => {
    const activation = overlay.querySelector("button");
    const receipt = overlay.querySelector('[data-field-overlay="relay-receipt"]');
    const prefix = overlay.querySelector('[data-i18n="fieldOverlay.relayPrefix"]');
    const relayedCommand = overlay.querySelector('[data-field-overlay="relay-command"]');

    activation.click();
    assert.equal(huntCommand.clickCount, 1, "the Korean Hunt order must delegate to its native command before campaign progression");
    assert.equal(
      receipt.textContent,
      `${localizedReceiptPrefix(i18n, "ko")} ${i18n.translations.ko["command.hunt.name"]}`,
      "the initial receipt must use the Korean native Hunt label",
    );

    huntCommand.removeAttribute("aria-current");
    extractCommand.setAttribute("aria-current", "step");
    fixture.notify(fixture.commandPanel);

    assert.equal(
      relayedCommand.textContent,
      i18n.translations.ko["command.hunt.name"],
      "campaign progression must retain the original native command source rather than follow Extract",
    );

    i18n.setLanguage("en");
    fixture.notify(fixture.commandPanel);

    assert.equal(fixture.document.documentElement.lang, "en", "the public language switch must update the document locale");
    assertLocalizedOverlayChrome(overlay, ENGLISH_OVERLAY_COPY);
    assert.equal(prefix.textContent, localizedReceiptPrefix(i18n, "en"), "the visible receipt prefix must update to English");
    assert.equal(relayedCommand.textContent, i18n.translations.en["command.hunt.name"], "the receipt must reproject the original Hunt source label in English");
    assert.equal(
      receipt.textContent,
      `${localizedReceiptPrefix(i18n, "en")} ${i18n.translations.en["command.hunt.name"]}`,
      "the English receipt must retain Hunt rather than following the next Extract command",
    );
  });
});



test("mounted overlay copies the native current checklist objective before the stage fallback", { concurrency: false }, async () => {
  const currentObjective = "Secure the relay before the ward closes";
  const fixture = createStaticOverlayFixture({
    checklistObjective: currentObjective,
    stageObjective: "Fallback stage order that is not current",
  });

  await withMountedOverlay(fixture, async (overlay) => {
    const objective = overlay.querySelector('[data-field-overlay="objective"]');
    assert.equal(
      objective.textContent,
      currentObjective,
      "the field overlay must project the rendered current checklist item rather than synthesize or prefer a stale stage summary",
    );
  });
});

test("mounted overlay follows an in-place switch between rendered current checklist items", { concurrency: false }, async () => {
  const firstObjective = "Secure the relay before the ward closes";
  const secondObjective = "Contain the breach after the relay is secure";
  const fixture = createStaticOverlayFixture({
    checklistObjectives: [firstObjective, secondObjective],
    stageObjective: "Fallback stage order that is not current",
  });

  await withMountedOverlay(fixture, async (overlay) => {
    const objective = overlay.querySelector('[data-field-overlay="objective"]');
    assert.equal(objective.textContent, firstObjective, "the initial native current item must be projected");
    const checklistObservation = fixture.observations.find(({ target }) => target === fixture.checklist);
    assert.ok(checklistObservation, "the overlay must observe the native objective checklist");
    assert.equal(checklistObservation.options.subtree, true, "the checklist watcher must observe in-place item changes");
    assert.equal(checklistObservation.options.attributes, true, "the checklist watcher must observe current-class changes");
    assert.ok(
      checklistObservation.options.attributeFilter.includes("class"),
      "the checklist watcher must retain class changes in its attribute filter",
    );


    fixture.checklistItems[0].classList.remove("current");
    fixture.checklistItems[1].classList.add("current");
    fixture.notify(fixture.checklist);

    assert.equal(
      objective.textContent,
      secondObjective,
      "a mutation from an in-place native current-class switch must project the newly current checklist item",
    );
  });
});

test("mounted overlay falls back to the rendered stage objective when no checklist item is current", { concurrency: false }, async () => {
  const stageObjective = "Open the final breach lane";
  const fixture = createStaticOverlayFixture({
    checklistObjective: "",
    stageObjective,
  });

  await withMountedOverlay(fixture, async (overlay) => {
    assert.equal(
      overlay.querySelector('[data-field-overlay="objective"]').textContent,
      stageObjective,
      "the existing rendered stage objective remains the objective source when the checklist has no current item",
    );
  });
});

test("mounted overlay copies an accepted native status under a neutral label and leaves blank status absent", { concurrency: false }, async () => {
  const acceptedOutcome = "  Hunt  accepted:\n  the rift spoor is  secured  \n";
  const fixture = createStaticOverlayFixture({ campaignStatus: acceptedOutcome });

  await withMountedOverlay(fixture, async (overlay) => {
    const status = overlay.querySelector('[data-field-overlay="confirmed-result"]');
    const label = overlay.querySelector(".ashen-field-command__result .ashen-field-command__label");
    const copy = status.querySelector(".ashen-field-command__result-copy");
    assert.equal(label.textContent, KOREAN_OVERLAY_COPY.status, "the localized visible label must not classify every native status as confirmed");
    assert.equal(copy.textContent, acceptedOutcome, "the field overlay must copy the accepted native status verbatim");
    assert.equal(status.hidden, false, "a present native status must remain visible");

    fixture.status.textContent = "";
    fixture.notify(fixture.status);

    assert.equal(copy.textContent, "", "a blank native status must not be replaced with invented result copy");
    assert.equal(status.hidden, true, "the status surface must be absent when its source has no text");

    fixture.status.textContent = "\n  \t  ";
    fixture.notify(fixture.status);

    assert.equal(copy.textContent, "", "a whitespace-only native status must not surface result copy");
    assert.equal(status.hidden, true, "the status surface must remain absent for a whitespace-only source");
  });
});

test("mounted overlay copies a non-outcome native status under the same neutral label", { concurrency: false }, async () => {
  const rendererNotice = "Fallback renderer active: tactical projection is unavailable";
  const fixture = createStaticOverlayFixture({ campaignStatus: rendererNotice });

  await withMountedOverlay(fixture, async (overlay) => {
    const status = overlay.querySelector('[data-field-overlay="confirmed-result"]');
    const label = overlay.querySelector(".ashen-field-command__result .ashen-field-command__label");
    const copy = status.querySelector(".ashen-field-command__result-copy");

    assert.equal(label.textContent, KOREAN_OVERLAY_COPY.status, "a non-outcome status must use the same localized neutral visible label");
    assert.equal(copy.textContent, rendererNotice, "the field overlay must copy non-outcome native status text verbatim");
    assert.equal(status.hidden, false, "a nonblank non-outcome status must remain visible");
  });
});

test("mounted overlay does not invent a confirmed result when campaign status is absent", { concurrency: false }, async () => {
  const fixture = createStaticOverlayFixture({ campaignStatus: null });

  await withMountedOverlay(fixture, async (overlay) => {
    const status = overlay.querySelector('[data-field-overlay="confirmed-result"]');
    const copy = status.querySelector(".ashen-field-command__result-copy");
    assert.equal(copy.textContent, "", "an absent status source must leave no result text to project");
    assert.equal(status.hidden, true, "an absent status source must not surface a fabricated confirmed result");
  });
});

test("mounted overlay copies the selected native command and delegates activation back to it", { concurrency: false }, async () => {
  const markedCommand = staticCommand({
    action: "extract",
    name: "Extract the cache",
    detail: "Secure the exposed reserve.",
    current: true,
  });
  const earlierCommand = staticCommand({
    action: "hunt",
    name: "Hunt the spoor",
    detail: "Locate the next breach.",
  });
  const fixture = createStaticOverlayFixture({ commands: [earlierCommand, markedCommand] });

  await withMountedOverlay(fixture, async (overlay, i18n) => {
    const activation = overlay.querySelector("button");
    const receipt = overlay.querySelector('[data-field-overlay="relay-receipt"]');
    assert.equal(receipt.hidden, true, "the relay receipt must remain hidden before the native command is issued");
    assert.equal(receipt.getAttribute("role"), "status", "the relay receipt must expose a status role");
    assert.equal(receipt.getAttribute("aria-live"), "polite", "the relay receipt must announce without interrupting");
    assert.ok(
      activation.textContent.includes("Extract the cache") && activation.textContent.includes("Secure the exposed reserve."),
      "the activation affordance must reuse the selected native command name and detail",
    );

    activation.click();
    assert.equal(
      receipt.textContent,
      `${localizedReceiptPrefix(i18n, "ko")} Extract the cache`,
      "the relay receipt must reuse the native command name",
    );
    assert.equal(receipt.hidden, false, "the relay receipt must appear after native command delegation");

    assert.equal(markedCommand.clickCount, 1, "activation must delegate to the marked native command");
    assert.equal(earlierCommand.clickCount, 0, "activation must not invoke an earlier non-current command");
  });
});