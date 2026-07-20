import { applyLanguage, currentLang, translate } from "./i18n.js";
const dom = typeof document === "undefined" ? null : document;
const view = typeof window === "undefined" ? null : window;
const field = dom?.querySelector("#battle-field");
const canvasContainer = dom?.querySelector("#canvas-container-3d");
const commandPanel = dom?.querySelector("#command-panel");

export function selectCurrentCommand(commands) {
  const entries = Array.from(commands ?? []);
  return (
    entries.find((button) => button.getAttribute?.("aria-current") === "step") ??
    entries.find((button) => button.classList?.contains("current-objective")) ??
    entries.find((button) => !button.disabled) ??
    entries[0] ??
    null
  );
}

export function textOf(element, fallback = "") {
  return element?.textContent?.replace(/\s+/g, " ").trim() || fallback;
}

export function receiptCopy(issuedCommand) {
  const name = textOf({ textContent: issuedCommand?.name });
  const prefix = translate("fieldOverlay.relayPrefix");
  return name && prefix ? `${prefix} ${name}` : "";
}

function queryText(selector, fallback = "") {
  return textOf(dom?.querySelector(selector), fallback);
}

function queryRawText(selector) {
  const value = dom?.querySelector(selector)?.textContent;
  return value?.trim() ? value : "";
}


function commandCopy(command) {
  return {
    action: command?.dataset?.action || "command",
    name: textOf(command?.querySelector?.("strong"), textOf(command, "Command")),
    detail: textOf(command?.querySelector?.("small"), "Use the marked command to advance the field objective."),
    disabled: Boolean(command?.disabled),
  };
}

function currentRenderedObjective() {
  return queryText("#objective-checklist .current") || queryText("#stage-objective");
}

function createOverlay() {
  const overlay = dom.createElement("section");
  overlay.className = "ashen-field-command";
  overlay.setAttribute("data-i18n-aria", "fieldOverlay.aria");
  overlay.innerHTML = `
    <div class="ashen-field-command__standard">
      <span class="ashen-field-command__eyebrow" data-i18n="fieldOverlay.order"></span>
      <p class="ashen-field-command__objective" data-field-overlay="objective"></p>
    </div>
    <div class="ashen-field-command__watch">
      <span class="ashen-field-command__label" data-i18n="fieldOverlay.ingress"></span>
      <span class="ashen-field-command__hostile"></span>
      <span class="ashen-field-command__pressure"></span>
    </div>
    <button class="ashen-field-command__activate" type="button">
      <span class="ashen-field-command__activate-name"></span>
      <span class="ashen-field-command__activate-note"></span>
    </button>
    <output class="ashen-field-command__receipt" data-field-overlay="relay-receipt" role="status" aria-live="polite" hidden><span data-i18n="fieldOverlay.relayPrefix"></span> <span data-field-overlay="relay-command"></span></output>
    <p class="ashen-field-command__ward"><span data-i18n="fieldOverlay.ward"></span> <strong></strong></p>
    <div class="ashen-field-command__result" data-field-overlay="confirmed-result" hidden>
      <span class="ashen-field-command__label" data-i18n="fieldOverlay.status"></span>
      <span class="ashen-field-command__result-copy"></span>
    </div>
  `;

  const tactical = dom.createElement("div");
  tactical.className = "ashen-field-command__tactical";
  tactical.setAttribute("data-field-overlay", "tactical-readout");
  tactical.setAttribute("role", "status");
  tactical.setAttribute("aria-live", "polite");

  const selectionSpan = dom.createElement("span");
  selectionSpan.className = "ashen-field-command__tactical-selection";
  selectionSpan.setAttribute("data-field-overlay", "tactical-selection");

  const separatorSpan = dom.createElement("span");
  separatorSpan.className = "ashen-field-command__tactical-separator";
  separatorSpan.textContent = " | ";

  const statusSpan = dom.createElement("span");
  statusSpan.className = "ashen-field-command__tactical-status";
  statusSpan.setAttribute("data-field-overlay", "tactical-status");

  tactical.append(selectionSpan, separatorSpan, statusSpan);
  overlay.append(tactical);

  return overlay;
}

export function mountFieldCommandOverlay({ root = field, container = canvasContainer, commands = commandPanel } = {}) {
  if (!root || !container || !commands || container.querySelector(".ashen-field-command")) return null;

  const overlay = createOverlay();
  const objectiveLine = overlay.querySelector(".ashen-field-command__standard");
  const objective = overlay.querySelector(".ashen-field-command__objective");
  const hostile = overlay.querySelector(".ashen-field-command__hostile");
  const pressure = overlay.querySelector(".ashen-field-command__pressure");
  const activation = overlay.querySelector(".ashen-field-command__activate");
  const activationName = overlay.querySelector(".ashen-field-command__activate-name");
  const activationNote = overlay.querySelector(".ashen-field-command__activate-note");
  const ward = overlay.querySelector(".ashen-field-command__ward strong");
  const resultLine = overlay.querySelector(".ashen-field-command__result");
  const result = overlay.querySelector(".ashen-field-command__result-copy");
  const receipt = overlay.querySelector('[data-field-overlay="relay-receipt"]');
  const receiptCommand = overlay.querySelector('[data-field-overlay="relay-command"]');
  let activeCommand = null;
  let relayedCommand = null;
  let pendingCommand = null;

  function projectNativeText(line, output, value) {
    line.hidden = !value;
    output.textContent = value;
  }

  function projectRelayedCommand() {
    if (!receipt || !receiptCommand) return;
    if (!relayedCommand) {
      receipt.hidden = true;
      receiptCommand.textContent = "";
      return;
    }

    const copy = commandCopy(relayedCommand);
    receiptCommand.textContent = copy.name;
    receipt.hidden = !receiptCopy(copy);
  }

  function render() {
    activeCommand = selectCurrentCommand(commands.querySelectorAll("[data-action]"));
    const copy = commandCopy(activeCommand);
    const objectiveText = currentRenderedObjective();
    const fieldStatus = queryRawText("#campaign-status");

    overlay.dataset.action = copy.action;
    projectNativeText(objectiveLine, objective, objectiveText);
    projectNativeText(resultLine, result, fieldStatus);
    hostile.textContent = queryText("#battle-hostile-label", "Hostile ward");
    pressure.textContent = queryText("#battle-pressure", "Watch the breach lane and answer the marked order.");
    ward.textContent = queryText("#integrity-value", "—");
    activationName.textContent = copy.name;
    activationNote.textContent = copy.detail;
    activation.disabled = copy.disabled;
    activation.setAttribute("aria-label", `${copy.name}: ${copy.detail}`);
    projectRelayedCommand();

    const tacticalSelection = overlay.querySelector('[data-field-overlay="tactical-selection"]');
    const tacticalStatus = overlay.querySelector('[data-field-overlay="tactical-status"]');
    const tacticalSeparator = overlay.querySelector(".ashen-field-command__tactical-separator");

    const selectionName = queryText("#dossier-name") || queryText('[data-battle-screen="selection-name"]');
    const selectionCount = queryText("#dossier-count") || queryText('[data-battle-screen="selection-count"]');
    const selectionOrder = queryText("#dossier-order") || queryText('[data-battle-screen="selection-order"]');

    const waveText = queryText("#battle-wave-indicator") || queryText('[data-battle-screen="wave"]');
    const hostileText = queryText("#battle-hostile-label") || queryText('[data-battle-screen="enemy-growth"]');
    const bossPhaseText = queryText('[data-battle-screen="boss-phase"]');

    let selectionStr = "";
    if (selectionName) {
      selectionStr += selectionName;
      if (selectionCount && selectionCount !== "—") {
        selectionStr += ` (${selectionCount})`;
      }
      if (selectionOrder && selectionOrder !== "—") {
        selectionStr += ` — ${selectionOrder}`;
      }
    }

    if (tacticalSelection) {
      tacticalSelection.textContent = selectionStr;
      tacticalSelection.hidden = !selectionStr;
    }

    let statusParts = [];
    if (waveText && waveText !== "—") statusParts.push(waveText);
    if (hostileText && hostileText !== "—") statusParts.push(hostileText);
    if (bossPhaseText && bossPhaseText !== "—" && !bossPhaseText.includes("locked") && !bossPhaseText.includes("잠김")) {
      statusParts.push(bossPhaseText);
    }
    const statusStr = statusParts.filter(Boolean).join(" | ");

    if (tacticalStatus) {
      tacticalStatus.textContent = statusStr;
      tacticalStatus.hidden = !statusStr;
    }

    if (tacticalSeparator) {
      tacticalSeparator.hidden = !selectionStr || !statusStr;
    }
  }

  function requestRender() {
    render();
  }

  activation.addEventListener("click", () => {
    if (!activeCommand || activeCommand.disabled) return;

    const issuedCommand = activeCommand;
    pendingCommand = issuedCommand;
    issuedCommand.click();
  });

  function handleLanguageChange() {
    const queue = view?.queueMicrotask ?? globalThis.queueMicrotask;
    if (queue) {
      queue.call(view ?? globalThis, render);
      return;
    }
    Promise.resolve().then(render);
  }

  function handleCommandResolved(event) {
    if (!event || !event.detail) return;
    const { action, accepted } = event.detail;
    if (pendingCommand && pendingCommand.dataset && pendingCommand.dataset.action === action) {
      if (accepted) {
        relayedCommand = pendingCommand;
      } else {
        relayedCommand = null;
      }
      projectRelayedCommand();
      pendingCommand = null;
    }
  }

  function handleViewClick(event) {
    const button = event?.target?.closest?.("button[data-action]");
    if (button) {
      pendingCommand = button;
    }
  }

  function handleSpatialFocus(event) {
    if (!event || !event.detail) return;
    const { action } = event.detail;
    if (action) overlay.setAttribute("data-spatial-focused", action);
    else overlay.removeAttribute("data-spatial-focused");
    if (action && action === activeCommand?.dataset?.action) activation.setAttribute("data-focused", "true");
    else activation.removeAttribute("data-focused");
  }
  view?.addEventListener?.("abyssal:language-changed", handleLanguageChange);
  view?.addEventListener?.("abyssal:campaign-rendered", handleLanguageChange);
  view?.addEventListener?.("abyssal:command-resolved", handleCommandResolved);
  view?.addEventListener?.("abyssal:spatial-focus", handleSpatialFocus);
  view?.addEventListener?.("click", handleViewClick);

  const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
  const observer = Observer ? new Observer(requestRender) : null;
  observer?.observe(commands, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "aria-current", "disabled"],
  });
  [
    "#objective-checklist",
    "#stage-objective",
    "#campaign-status",
    "#battle-hostile-label",
    "#battle-pressure",
    "#integrity-value",
    "#battle-wave-indicator",
    ".selection-dossier",
    "#dossier-count",
    "#dossier-order",
    "#dossier-name",
    "[data-battle-screen='wave']",
    "[data-battle-screen='boss-phase']",
    "[data-battle-screen='enemy-growth']",
    "[data-battle-screen='selection-name']",
    "[data-battle-screen='selection-count']",
    "[data-battle-screen='selection-order']"
  ].forEach((selector) => {
    const target = dom.querySelector(selector);
    if (target) {
      observer?.observe(target, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "data-state"],
      });
    }
  });

  container.append(overlay);
  applyLanguage(currentLang());
  render();
  return {
    overlay,
    destroy() {
      view?.removeEventListener?.("abyssal:language-changed", handleLanguageChange);
      view?.removeEventListener?.("abyssal:campaign-rendered", handleLanguageChange);
      view?.removeEventListener?.("abyssal:command-resolved", handleCommandResolved);
      view?.removeEventListener?.("abyssal:spatial-focus", handleSpatialFocus);
      view?.removeEventListener?.("click", handleViewClick);
      observer?.disconnect();
      overlay.remove();
    },
  };
}

if (typeof document !== "undefined") {
  mountFieldCommandOverlay();
}
