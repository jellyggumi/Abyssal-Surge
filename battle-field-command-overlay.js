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

function queryText(selector, fallback = "") {
  return textOf(dom?.querySelector(selector), fallback);
}

function commandCopy(command) {
  return {
    action: command?.dataset?.action || "command",
    name: textOf(command?.querySelector?.("strong"), textOf(command, "Command")),
    detail: textOf(command?.querySelector?.("small"), "Use the marked command to advance the field objective."),
    disabled: Boolean(command?.disabled),
  };
}

function createOverlay() {
  const overlay = dom.createElement("section");
  overlay.className = "ashen-field-command";
  overlay.setAttribute("aria-label", "Current field command");
  overlay.innerHTML = `
    <svg class="ashen-field-command__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="ashen-field-command__route-path" d="M 17 79 C 31 64, 50 60, 77 35" />
      <circle class="ashen-field-command__route-marker" cx="17" cy="79" r="1.8" />
      <path class="ashen-field-command__route-marker" d="M 75 30 L 83 34 L 77 41 Z" />
    </svg>
    <div class="ashen-field-command__standard">
      <span class="ashen-field-command__eyebrow">Ashen Marches order</span>
      <p class="ashen-field-command__objective"></p>
    </div>
    <div class="ashen-field-command__watch">
      <span class="ashen-field-command__label">Hostile ingress</span>
      <span class="ashen-field-command__hostile"></span>
      <span class="ashen-field-command__pressure"></span>
    </div>
    <button class="ashen-field-command__activate" type="button">
      <span class="ashen-field-command__activate-name"></span>
      <span class="ashen-field-command__activate-note"></span>
    </button>
    <p class="ashen-field-command__ward"><span>Gate ward</span> <strong></strong></p>
    <div class="ashen-field-command__consequence">
      <span class="ashen-field-command__label">Order consequence</span>
      <span class="ashen-field-command__consequence-copy"></span>
    </div>
  `;
  return overlay;
}

export function mountFieldCommandOverlay({ root = field, container = canvasContainer, commands = commandPanel } = {}) {
  if (!root || !container || !commands || container.querySelector(".ashen-field-command")) return null;

  const overlay = createOverlay();
  const objective = overlay.querySelector(".ashen-field-command__objective");
  const hostile = overlay.querySelector(".ashen-field-command__hostile");
  const pressure = overlay.querySelector(".ashen-field-command__pressure");
  const activation = overlay.querySelector(".ashen-field-command__activate");
  const activationName = overlay.querySelector(".ashen-field-command__activate-name");
  const activationNote = overlay.querySelector(".ashen-field-command__activate-note");
  const ward = overlay.querySelector(".ashen-field-command__ward strong");
  const consequence = overlay.querySelector(".ashen-field-command__consequence-copy");
  let activeCommand = null;
  let frame = 0;

  function render() {
    frame = 0;
    activeCommand = selectCurrentCommand(commands.querySelectorAll("[data-action]"));
    const copy = commandCopy(activeCommand);
    const stageObjective = queryText("#stage-objective", copy.detail);

    overlay.dataset.action = copy.action;
    objective.textContent = stageObjective;
    hostile.textContent = queryText("#battle-hostile-label", "Hostile ward");
    pressure.textContent = queryText("#battle-pressure", "Watch the breach lane and answer the marked order.");
    ward.textContent = queryText("#integrity-value", "—");
    activationName.textContent = copy.name;
    activationNote.textContent = copy.detail;
    consequence.textContent = copy.detail;
    activation.disabled = copy.disabled;
    activation.setAttribute("aria-label", `${copy.name}: ${copy.detail}`);
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
    frame = requestAnimationFrame(render);
  }

  activation.addEventListener("click", () => {
    if (!activeCommand?.disabled) activeCommand?.click();
  });

  const observer = new MutationObserver(requestRender);
  observer.observe(commands, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "aria-current", "disabled"],
  });
  ["#stage-objective", "#battle-hostile-label", "#battle-pressure", "#integrity-value"].forEach((selector) => {
    const target = dom.querySelector(selector);
    if (target) observer.observe(target, { subtree: true, childList: true, characterData: true });
  });

  container.append(overlay);
  render();
  return {
    overlay,
    destroy() {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      overlay.remove();
    },
  };
}

if (typeof document !== "undefined") {
  mountFieldCommandOverlay();
}
