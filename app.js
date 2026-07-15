import {
  CAMPAIGN_SCHEDULES,
  COMMANDS,
  RULES_VERSION,
  awardFor,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  settleCampaign,
} from "./game-core.js";

const dom = {
  screens: {
    lobby: document.querySelector("#lobby-screen"),
    play: document.querySelector("#play-screen"),
    terminal: document.querySelector("#terminal-screen"),
  },
  focus: {
    lobby: document.querySelector("#lobby-title"),
    play: document.querySelector("#play-title"),
    terminal: document.querySelector("#terminal-title"),
  },
  campaign: document.querySelector("#campaign-value"),
  ruleVersion: document.querySelector("#rules-version"),
  intent: document.querySelector("#intent-value"),
  counter: document.querySelector("#counter-value"),
  integrity: document.querySelector("#integrity-value"),
  focusValue: document.querySelector("#focus-value"),
  guard: document.querySelector("#guard-value"),
  pressure: document.querySelector("#pressure-value"),
  foeHealth: document.querySelector("#foe-health-value"),
  trace: document.querySelector("#trace-log"),
  announcement: document.querySelector("#announcement"),
  terminalSummary: document.querySelector("#terminal-summary"),
  settlement: document.querySelector("#settlement-summary"),
  commandButtons: [...document.querySelectorAll("[data-command]")],
  begin: document.querySelector("#begin-button"),
  continue: document.querySelector("#continue-button"),
  restart: document.querySelector("#restart-button"),
};

let surface = "lobby";
let encounterIndex = 0;
let sequence = 0;
let encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex]);
let records = [];
let outcomes = [];
let settlement = null;
let lastMessage = "Awaiting a semantic command.";

function showSurface(next) {
  surface = next;
  for (const [name, screen] of Object.entries(dom.screens)) screen.hidden = name !== next;
  requestAnimationFrame(() => dom.focus[next]?.focus({ preventScroll: true }));
  render();
}

function threatCopy(state) {
  return state.foe_intent === "SURGE"
    ? "SURGE: 4 integrity damage and +2 pressure unless DISRUPT is used."
    : "STRIKE: 2 integrity damage unless BRACE is used.";
}

function counterCopy(state) {
  return state.foe_intent === "SURGE"
    ? "DISRUPT costs 1 focus, deals 1 foe damage, and prevents this SURGE."
    : "BRACE costs 1 focus and prevents this STRIKE's 2 damage.";
}

function commandAvailable(command) {
  if (surface !== "play" || encounter.outcome !== "ACTIVE") return false;
  const preview = reduceEncounter(encounter, makeCommand(command, encounter.round, sequence + 1));
  return preview.accepted;
}

function terminalCopy(outcome) {
  return {
    VICTORY: "VICTORY — foe health reached 0 before the round's adverse effect resolved.",
    HOLD: "HOLD — the final scheduled round resolved without a defeat condition.",
    DEFEAT_INTEGRITY: "DEFEAT_INTEGRITY — integrity reached 0; this priority is evaluated before pressure.",
    DEFEAT_PRESSURE: "DEFEAT_PRESSURE — pressure reached 4 while integrity remained above 0.",
  }[outcome];
}

function recordCommand(command) {
  if (!COMMANDS.includes(command) || !commandAvailable(command)) return;
  const record = makeCommand(command, encounter.round, ++sequence);
  records.push(record);
  const result = reduceEncounter(encounter, record);
  if (!result.accepted) {
    lastMessage = `Command rejected: ${result.reason}.`;
    render();
    return;
  }
  encounter = result.state;
  const entry = encounter.trace.at(-1);
  lastMessage = `Round ${entry.round}: ${command}; ${entry.foe_resolved ? `adverse effect resolved (${entry.adverse_damage} integrity damage, ${entry.adverse_pressure} pressure).` : "VICTORY resolved before the adverse effect."}`;
  if (encounter.outcome !== "ACTIVE") finishEncounter();
  render();
}

function finishEncounter() {
  outcomes.push(encounter.outcome);
  const award = awardFor(encounter.outcome);
  if (outcomes.length === CAMPAIGN_SCHEDULES.length) settlement = settleCampaign(outcomes);
  dom.terminalSummary.textContent = `${terminalCopy(encounter.outcome)} Award: ${award} fragment${award === 1 ? "" : "s"}.`;
  dom.settlement.textContent = settlement
    ? `Three encounter records settled locally: ${settlement.fragments_earned} fragments earned, ${settlement.fragment_wallet} in wallet after settlement, ${settlement.resolve_marks} resolve marks. Nothing persists after a reload.`
    : `This is encounter ${outcomes.length} of ${CAMPAIGN_SCHEDULES.length}; the terminal record is ready for the next local encounter.`;
  dom.continue.hidden = Boolean(settlement);
  showSurface("terminal");
}

function continueCampaign() {
  if (settlement || encounter.outcome === "ACTIVE") return;
  encounterIndex += 1;
  sequence = 0;
  records = [];
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex]);
  lastMessage = `Encounter ${encounterIndex + 1} starts with the displayed ${encounter.foe_intent} intent.`;
  showSurface("play");
}

function resetCampaign() {
  encounterIndex = 0;
  sequence = 0;
  records = [];
  outcomes = [];
  settlement = null;
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[0]);
  lastMessage = "Awaiting a semantic command.";
  showSurface("lobby");
}

function render() {
  dom.campaign.textContent = `${encounterIndex + 1} / ${CAMPAIGN_SCHEDULES.length}`;
  dom.ruleVersion.textContent = RULES_VERSION;
  dom.intent.textContent = encounter.foe_intent;
  dom.counter.textContent = counterCopy(encounter);
  dom.integrity.textContent = `${encounter.integrity} / 6`;
  dom.focusValue.textContent = `${encounter.focus} / 3`;
  dom.guard.textContent = `${encounter.guard} / 2`;
  dom.pressure.textContent = `${encounter.pressure} / 4`;
  dom.foeHealth.textContent = `${encounter.foe_health} / 6`;
  dom.trace.replaceChildren(...encounter.trace.map((entry) => {
    const item = document.createElement("li");
    item.textContent = `Round ${entry.round}: ${entry.command}; ${entry.foe_resolved ? `effect ${entry.adverse_damage} integrity / ${entry.adverse_pressure} pressure; ${entry.outcome}.` : "adverse effect skipped; VICTORY."}`;
    return item;
  }));
  dom.announcement.textContent = lastMessage;
  for (const button of dom.commandButtons) button.disabled = !commandAvailable(button.dataset.command);
  document.querySelector("#threat-copy").textContent = threatCopy(encounter);
}

dom.begin.addEventListener("click", () => showSurface("play"));
dom.continue.addEventListener("click", continueCampaign);
dom.restart.addEventListener("click", resetCampaign);
for (const button of dom.commandButtons) {
  button.addEventListener("click", () => recordCommand(button.dataset.command));
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.activeElement?.tagName === "INPUT") return;
  const keyboardCommands = { s: "STRIKE", b: "BRACE", d: "DISRUPT", r: "RECOVER" };
  const command = keyboardCommands[event.key.toLowerCase()];
  if (!command || !commandAvailable(command)) return;
  event.preventDefault();
  recordCommand(command);
});

render();
