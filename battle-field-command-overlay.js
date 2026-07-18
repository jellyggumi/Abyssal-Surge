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
    <svg class="ashen-field-command__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="ashen-field-command__route-path" d="M 17 79 C 31 64, 50 60, 77 35" />
      <circle class="ashen-field-command__route-marker" cx="17" cy="79" r="1.8" />
      <path class="ashen-field-command__route-marker" d="M 75 30 L 83 34 L 77 41 Z" />
    </svg>
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
  let frame = 0;

  function projectNativeText(line, output, value) {
    line.hidden = !value;
    output.textContent = value;
  }

  function projectRelayedCommand() {
    if (!relayedCommand || !receipt || !receiptCommand) return;

    const copy = commandCopy(relayedCommand);
    receiptCommand.textContent = copy.name;
    receipt.hidden = !receiptCopy(copy);
  }

  function render() {
    frame = 0;
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
  }

  function prefersReducedMotion() {
    return view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  function requestRender() {
    if (prefersReducedMotion()) {
      render();
      return;
    }
    if (frame) return;
    const requestFrame = view?.requestAnimationFrame ?? globalThis.requestAnimationFrame;
    if (!requestFrame) {
      render();
      return;
    }
    frame = requestFrame.call(view ?? globalThis, render);
  }

  activation.addEventListener("click", () => {
    if (!activeCommand || activeCommand.disabled) return;

    const issuedCommand = activeCommand;
    issuedCommand.click();
    relayedCommand = issuedCommand;
    projectRelayedCommand();
  });

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
  ].forEach((selector) => {
    const target = dom.querySelector(selector);
    if (target) {
      observer?.observe(target, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  });

  container.append(overlay);
  applyLanguage(currentLang());
  render();
  return {
    overlay,
    destroy() {
      observer?.disconnect();
      if (frame) {
        const cancelFrame = view?.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
        cancelFrame?.call(view ?? globalThis, frame);
      }
      overlay.remove();
    },
  };
}

if (typeof document !== "undefined") {
  mountFieldCommandOverlay();
}
