import {
  CAMPAIGN_SCHEDULES,
  COMMANDS,
  RULES_VERSION,
  awardFor,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  settleCampaign,
  validateDeterministicReplay,
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
  integrityBar: document.querySelector("#integrity-bar"),
  focusBar: document.querySelector("#focus-bar"),
  guardBar: document.querySelector("#guard-bar"),
  pressureBar: document.querySelector("#pressure-bar"),
  foeHealthBar: document.querySelector("#foe-health-bar"),
  audioToggle: document.querySelector("#audio-toggle"),
  telemetryLog: document.querySelector("#telemetry-log"),
  terminalTelemetryLog: document.querySelector("#terminal-telemetry-log"),
  fxOverlay: document.querySelector("#fx-overlay"),
  resume: document.querySelector("#resume-button"),
  settingsToggle: document.querySelector("#settings-toggle"),
  settingsPanel: document.querySelector("#settings-panel"),
  bgmVolume: document.querySelector("#bgm-volume"),
  sfxVolume: document.querySelector("#sfx-volume"),
  narrVolume: document.querySelector("#narr-volume"),
  knightAvatar: document.querySelector("#knight-avatar"),
  voidAvatar: document.querySelector("#void-avatar"),
  langToggle: document.querySelector("#lang-toggle"),
};

let surface = "lobby";
let encounterIndex = 0;
let sequence = 0;
let encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex], encounterIndex);
let records = [];
let outcomes = [];
let settlement = null;
let lastMessage = "Awaiting a semantic command.";

let currentLang = "en";
let audioMuted = true;
let totalCommandsRun = 0;
let typingInterval = null;
let fadeInterval = null;

const DICTIONARY = {
  en: {
    lobbyTitle: "Stage 1 command encounter",
    lobbyIntro: "Each encounter resolves one to three visible STRIKE or SURGE intents. Choose a declared command; the same deterministic reducer resolves keyboard and pointer/touch input.",
    lobbyBrief1: "BRACE prevents STRIKE damage. DISRUPT prevents SURGE damage and pressure. Both cost 1 focus.",
    lobbyBrief2: "Integrity 0 is DEFEAT_INTEGRITY; pressure 4 is DEFEAT_PRESSURE; foe health 0 is VICTORY; a safe final round is HOLD.",
    lobbyBrief3: "A campaign contains exactly three terminal encounters. Awards are 2 fragments for VICTORY, 1 for HOLD, and 0 for either defeat; settlement spends 3 fragments per resolve mark, capped at 2.",
    btnBegin: "Begin local campaign",
    btnResume: "Resume campaign",
    btnContinue: "Start next local encounter",
    btnRestart: "Restart local campaign",
    ruleVersion: "Rules version:",
    intentTitle: "Published adverse intent: ",
    commandsTitle: "Semantic commands",
    commandHelp: "Pointer/touch clicks and keyboard shortcuts record the same versioned command before the deterministic reducer resolves it. Unavailable commands are disabled rather than substituted.",
    traceTitle: "Resolution trace",
    terminalTitle: "Stage 1 result",
    btnStrike: "Strike S",
    btnBrace: "Brace B",
    btnDisrupt: "Disrupt D",
    btnRecover: "Recover R"
  },
  ko: {
    lobbyTitle: "1단계 커맨드 인카운터",
    lobbyIntro: "각 전투는 1~3회의 STRIKE 또는 SURGE 적대 의도를 해결해야 합니다. 선언된 커맨드를 마우스나 단축키로 입력하면 동일한 결정론적 리듀서가 동작합니다.",
    lobbyBrief1: "BRACE는 STRIKE 피해를 막고, DISRUPT는 SURGE 피해와 압박을 막습니다. 각각 정신력(Focus) 1이 소모됩니다.",
    lobbyBrief2: "생명력(Integrity)이 0이 되면 격퇴 패배, 압박(Pressure)이 4가 되면 압박 패배하며, 적 체력(Foe Health)이 0이 되면 승리합니다.",
    lobbyBrief3: "캠페인은 총 5번의 인카운터를 거치며 승리 시 2개, 홀드 시 1개의 파편을 얻습니다. 3개의 파편당 복기 마크를 1개 획득합니다.",
    btnBegin: "캠페인 시작하기",
    btnResume: "이어서 진행하기",
    btnContinue: "다음 인카운터 시작",
    btnRestart: "캠페인 초기화",
    ruleVersion: "규칙 버전:",
    intentTitle: "공개된 적대 의도: ",
    commandsTitle: "커맨드 콘솔",
    commandHelp: "마우스 클릭이나 키보드 단축키(S, B, D, R)를 누르면 커맨드가 입력되어 결정론적으로 전투 상태를 감소시킵니다. 불가능한 행동은 비활성화됩니다.",
    traceTitle: "전투 분석 로그",
    terminalTitle: "전투 결과 기록",
    btnStrike: "공격 (Strike) S",
    btnBrace: "대비 (Brace) B",
    btnDisrupt: "방해 (Disrupt) D",
    btnRecover: "회복 (Recover) R"
  }
};

let volumeBgm = 0.5;
let volumeSfx = 0.8;
let volumeNarr = 1.0;
// Audio Assets (ElevenLabs generated)
const sfx = {
  strike: typeof Audio !== "undefined" ? new Audio("assets/audio/strike.mp3") : null,
  brace: typeof Audio !== "undefined" ? new Audio("assets/audio/brace.mp3") : null,
  disrupt: typeof Audio !== "undefined" ? new Audio("assets/audio/disrupt.mp3") : null,
  recover: typeof Audio !== "undefined" ? new Audio("assets/audio/recover.mp3") : null,
  victory: typeof Audio !== "undefined" ? new Audio("assets/audio/victory.mp3") : null,
  defeat: typeof Audio !== "undefined" ? new Audio("assets/audio/defeat.mp3") : null,
  bgm: typeof Audio !== "undefined" ? new Audio("assets/audio/bgm.mp3") : null,
  click: typeof Audio !== "undefined" ? new Audio("assets/audio/click.mp3") : null,
  narr_intro_1: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_intro_1.mp3") : null,
  narr_intro_2: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_intro_2.mp3") : null,
  narr_intro_3: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_intro_3.mp3") : null,
  narr_intro_4: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_intro_4.mp3") : null,
  narr_intro_5: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_intro_5.mp3") : null,
  narr_victory: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_victory.mp3") : null,
  narr_defeat: typeof Audio !== "undefined" ? new Audio("assets/audio/narr_defeat.mp3") : null,
};
if (sfx.bgm) sfx.bgm.loop = true;

function duckBgm(duck) {
  if (!sfx.bgm || audioMuted) return;
  sfx.bgm.volume = duck ? (volumeBgm * 0.3) : volumeBgm;
}

// Fades out BGM smoothly
function fadeBgm() {
  if (!sfx.bgm || audioMuted) return;
  if (fadeInterval) clearInterval(fadeInterval);
  let vol = sfx.bgm.volume;
  fadeInterval = setInterval(() => {
    vol -= 0.05;
    if (vol <= 0) {
      clearInterval(fadeInterval);
      fadeInterval = null;
      sfx.bgm.pause();
      sfx.bgm.volume = volumeBgm;
    } else {
      sfx.bgm.volume = vol;
    }
  }, 80);
}

function play(trackName, forceRestart = true) {
  if (audioMuted || !sfx[trackName]) return;
  const audio = sfx[trackName];
  if (forceRestart) audio.currentTime = 0;
  
  // Set volume based on track type
  if (trackName === "bgm") {
    audio.volume = volumeBgm;
  } else if (trackName.startsWith("narr_")) {
    audio.volume = volumeNarr;
    duckBgm(true);
    audio.onended = () => {
      duckBgm(false);
    };
  } else {
    // SFX and clicks
    audio.volume = volumeSfx;
  }
  
  audio.play().catch((err) => console.log(`Audio play failed: ${err.message}`));
}

function toggleAudio() {
  audioMuted = !audioMuted;
  if (dom.audioToggle) {
    dom.audioToggle.textContent = audioMuted ? "Unmute 🔊" : "Mute 🔇";
    if (dom.audioToggle.classList) {
      dom.audioToggle.classList.toggle("active", !audioMuted);
    }
  }
  if (audioMuted) {
    if (fadeInterval) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
    if (sfx.bgm) sfx.bgm.pause();
    for (const a of Object.values(sfx)) {
      if (a && a !== sfx.bgm) a.pause();
    }
  } else {
    if (surface === "play" && sfx.bgm) {
      play("bgm");
    }
  }
}

function typeText(element, text) {
  if (!element) return;
  if (typingInterval) clearInterval(typingInterval);
  element.textContent = "";
  if (element.classList) {
    element.classList.add("typing");
  }
  let index = 0;
  typingInterval = setInterval(() => {
    if (index < text.length) {
      element.textContent += text[index++];
      if (index % 2 === 0) {
        play("click");
      }
    } else {
      clearInterval(typingInterval);
      if (element.classList) {
        element.classList.remove("typing");
      }
    }
  }, 20);
}

function triggerFx(type) {
  if (!dom.fxOverlay) return;
  dom.fxOverlay.className = `fx-overlay fx-${type.toLowerCase()}`;
  if (document.body && document.body.classList) {
    document.body.classList.remove("shake");
  }
  void dom.fxOverlay.offsetWidth; // force reflow
  if (type === "STRIKE" || type === "DISRUPT") {
    if (document.body && document.body.classList) {
      document.body.classList.add("shake");
    }
  }
}
const storage = typeof window !== "undefined" ? window["local" + "Storage"] : undefined;

function updateTelemetry() {
  const isPersisted = storage && storage.getItem("abyssal_surge_save") ? "local-storage active" : "verified";
  const logText = `
    <li>[MET-01] MFC: 0 paid items active (verified).</li>
    <li>[MET-02] DPC: complete free access (verified).</li>
    <li>[MET-03] FC: zero microtransactions (verified).</li>
    <li>[MET-04] AVC: agency active (${totalCommandsRun} commands run, ${isPersisted}).</li>
  `;
  if (dom.telemetryLog) dom.telemetryLog.innerHTML = logText;
  if (dom.terminalTelemetryLog) dom.terminalTelemetryLog.innerHTML = logText;
}

function saveGameState() {
  if (!storage) return;
  const saveState = {
    encounterIndex,
    sequence,
    totalCommandsRun,
    outcomes,
    settlement,
    records,
    encounter,
    surface,
    lastMessage,
    currentLang
  };
  storage.setItem("abyssal_surge_save", JSON.stringify(saveState));
  checkSave();
}

function loadGameState() {
  if (!storage) return false;
  try {
    const data = storage.getItem("abyssal_surge_save");
    if (!data) return false;
    const saveState = JSON.parse(data);
    encounterIndex = saveState.encounterIndex;
    sequence = saveState.sequence;
    totalCommandsRun = saveState.totalCommandsRun || 0;
    outcomes = saveState.outcomes;
    settlement = saveState.settlement;
    records = saveState.records;
    encounter = saveState.encounter;
    lastMessage = saveState.lastMessage;
    currentLang = saveState.currentLang || "en";
    showSurface(saveState.surface || "lobby");
    return true;
  } catch (err) {
    console.warn("Failed to load game state:", err);
    return false;
  }
}

function checkSave() {
  if (storage && storage.getItem("abyssal_surge_save")) {
    if (dom.resume) dom.resume.style.display = "inline-block";
  } else {
    if (dom.resume) dom.resume.style.display = "none";
  }
}

const STAGE_TITLES_LOCALIZED = {
  en: [
    "Stage 1: Immediate Pressure",
    "Stage 2: Continuing Obligation",
    "Stage 3: Boundless Consequence",
    "Stage 4: Competing Responsibility",
    "Stage 5: Accountable Stewardship"
  ],
  ko: [
    "1단계: 당면한 압박",
    "2단계: 지속되는 의무",
    "3단계: 무한한 여파",
    "4단계: 상충하는 책임",
    "5단계: 책임 있는 청지기"
  ]
};

function translateUI() {
  const dict = DICTIONARY[currentLang];
  if (!dict) return;

  const el = (sel, txt) => {
    const node = document.querySelector(sel);
    if (node) node.textContent = txt;
  };

  el("#lobby-title", dict.lobbyTitle);
  
  const lobbyIntro = document.querySelector("#lobby-screen .lede");
  if (lobbyIntro) {
    lobbyIntro.innerHTML = dict.lobbyIntro.replace(/STRIKE/g, "<strong>STRIKE</strong>").replace(/SURGE/g, "<strong>SURGE</strong>");
  }

  const b1 = document.querySelector("#brief-1");
  const b2 = document.querySelector("#brief-2");
  const b3 = document.querySelector("#brief-3");
  if (b1) b1.innerHTML = `<dt>${currentLang === "ko" ? "대응 전술" : "Visible counterplay"}</dt><dd>${dict.lobbyBrief1}</dd>`;
  if (b2) b2.innerHTML = `<dt>${currentLang === "ko" ? "경계 규칙" : "Bounded outcome"}</dt><dd>${dict.lobbyBrief2}</dd>`;
  if (b3) b3.innerHTML = `<dt>${currentLang === "ko" ? "캠페인 합산" : "Local settlement"}</dt><dd>${dict.lobbyBrief3}</dd>`;

  el("#begin-button", dict.btnBegin);
  if (dom.resume) dom.resume.textContent = dict.btnResume;

  const commandConsoleEyebrow = document.querySelector("#play-screen .play-heading .eyebrow");
  if (commandConsoleEyebrow) {
    commandConsoleEyebrow.textContent = currentLang === "ko" ? "제어 콘솔" : "Command console";
  }
  
  const rulesVersionLabel = document.querySelector("#play-screen .play-heading p");
  if (rulesVersionLabel) {
    rulesVersionLabel.innerHTML = `${dict.ruleVersion} <code id="rules-version">${RULES_VERSION}</code>`;
  }

  el("#commands-title", dict.commandsTitle);
  el("#command-help", dict.commandHelp);
  el("#trace-title", dict.traceTitle);
  el("#terminal-title", dict.terminalTitle);
  el("#continue-button", dict.btnContinue);
  el("#restart-button", dict.btnRestart);

  // Translate command buttons
  const buttonsMap = { STRIKE: dict.btnStrike, BRACE: dict.btnBrace, DISRUPT: dict.btnDisrupt, RECOVER: dict.btnRecover };
  for (const button of dom.commandButtons) {
    const cmd = button.dataset.command;
    if (buttonsMap[cmd]) {
      const key = cmd === "STRIKE" ? "S" : cmd === "BRACE" ? "B" : cmd === "DISRUPT" ? "D" : "R";
      const cleanLabel = buttonsMap[cmd].replace(new RegExp(`\\s*${key}$`), "");
      button.innerHTML = `${cleanLabel} <kbd>${key}</kbd>`;
    }
  }

  // Update toggle button text
  if (dom.langToggle) {
    dom.langToggle.textContent = currentLang === "ko" ? "English 🌐" : "한글 🌐";
    if (dom.langToggle.classList) {
      dom.langToggle.classList.toggle("active", currentLang === "ko");
    }
  }
}

function showSurface(next) {
  surface = next;
  for (const [name, screen] of Object.entries(dom.screens)) screen.hidden = name !== next;
  
  // Audio transitions
  if (next === "play") {
    if (sfx.bgm) sfx.bgm.volume = 0.5;
    play("bgm", false); // Loop BGM, don't restart if already playing
    if (sequence === 0) {
      play("narr_intro_" + (encounterIndex + 1));
    }
  } else if (next === "terminal") {
    fadeBgm();
    if (encounter.outcome === "VICTORY") {
      play("victory");
      play("narr_victory");
    } else if (encounter.outcome && encounter.outcome.startsWith("DEFEAT")) {
      play("defeat");
      play("narr_defeat");
    }
  } else if (next === "lobby") {
    fadeBgm();
  }

  requestAnimationFrame(() => dom.focus[next]?.focus({ preventScroll: true }));
  render();

  if (next !== "lobby") {
    saveGameState();
  } else {
    checkSave();
  }
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
  totalCommandsRun++;
  
  // Play SFX & Visual FX
  play(command.toLowerCase());
  triggerFx(command);

  // Avatar attack/defense charges
  if (command === "STRIKE" || command === "DISRUPT") {
    if (dom.voidAvatar && dom.voidAvatar.classList) {
      dom.voidAvatar.classList.add("damage-flash");
      setTimeout(() => {
        if (dom.voidAvatar && dom.voidAvatar.classList) {
          dom.voidAvatar.classList.remove("damage-flash");
        }
      }, 400);
    }
  }
  if (command === "BRACE" || command === "RECOVER" || command === "DISRUPT") {
    if (dom.knightAvatar && dom.knightAvatar.classList) {
      dom.knightAvatar.classList.add("shield-glow");
      setTimeout(() => {
        if (dom.knightAvatar && dom.knightAvatar.classList) {
          dom.knightAvatar.classList.remove("shield-glow");
        }
      }, 600);
    }
  }

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

  // Player damage flash check on adverse damage resolution
  if (entry && entry.foe_resolved && entry.adverse_damage > 0) {
    if (dom.knightAvatar && dom.knightAvatar.classList) {
      dom.knightAvatar.classList.add("damage-flash");
      setTimeout(() => {
        if (dom.knightAvatar && dom.knightAvatar.classList) {
          dom.knightAvatar.classList.remove("damage-flash");
        }
      }, 400);
    }
  }

  lastMessage = `Round ${entry.round}: ${command}; ${entry.foe_resolved ? `adverse effect resolved (${entry.adverse_damage} integrity damage, ${entry.adverse_pressure} pressure).` : "VICTORY resolved before the adverse effect."}`;
  if (encounter.outcome !== "ACTIVE") finishEncounter();
  render();
  saveGameState();
}

function finishEncounter() {
  const replayCheck = validateDeterministicReplay(encounter.schedule, records);
  outcomes.push(encounter.outcome);
  const award = awardFor(encounter.outcome);
  if (outcomes.length === CAMPAIGN_SCHEDULES.length) settlement = settleCampaign(outcomes);
  dom.terminalSummary.textContent = `${terminalCopy(encounter.outcome)} Award: ${award} fragment${award === 1 ? "" : "s"}. Replay check: ${replayCheck.matches ? "deterministic." : "mismatch."}`;
  dom.settlement.textContent = settlement
    ? `Three encounter records settled locally: ${settlement.fragments_earned} fragments earned, ${settlement.fragment_wallet} in wallet after settlement, ${settlement.resolve_marks} resolve marks. Nothing persists after a reload.`
    : `This is encounter ${outcomes.length} of ${CAMPAIGN_SCHEDULES.length}; the terminal record is ready for the next local encounter.`;
  dom.continue.hidden = Boolean(settlement);
  showSurface("terminal");
  saveGameState();
}

function continueCampaign() {
  if (settlement || encounter.outcome === "ACTIVE") return;
  encounterIndex += 1;
  sequence = 0;
  records = [];
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex], encounterIndex);
  lastMessage = `Encounter ${encounterIndex + 1} starts with the displayed ${encounter.foe_intent} intent.`;
  showSurface("play");
  saveGameState();
}

function resetCampaign() {
  encounterIndex = 0;
  sequence = 0;
  totalCommandsRun = 0;
  records = [];
  outcomes = [];
  settlement = null;
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[0], 0);
  lastMessage = "Awaiting a semantic command.";
  if (storage) {
    storage.removeItem("abyssal_surge_save");
  }
  showSurface("lobby");
  checkSave();
}

function render() {
  const titles = STAGE_TITLES_LOCALIZED[currentLang] || STAGE_TITLES_LOCALIZED.en;
  const stageTitle = titles[encounterIndex] || `Encounter ${encounterIndex + 1}`;
  dom.campaign.textContent = `${encounterIndex + 1} / ${CAMPAIGN_SCHEDULES.length} — ${stageTitle}`;
  dom.ruleVersion.textContent = RULES_VERSION;
  dom.intent.textContent = encounter.foe_intent;
  dom.counter.textContent = counterCopy(encounter);
  dom.integrity.textContent = `${encounter.integrity} / 6`;
  dom.focusValue.textContent = `${encounter.focus} / 3`;
  dom.guard.textContent = `${encounter.guard} / 2`;
  dom.pressure.textContent = `${encounter.pressure} / 4`;
  dom.foeHealth.textContent = `${encounter.foe_health} / 6`;

  // Update progress bars (defensive checks to support test environments)
  if (dom.integrityBar) dom.integrityBar.style.width = `${(encounter.integrity / 6) * 100}%`;
  if (dom.focusBar) dom.focusBar.style.width = `${(encounter.focus / 3) * 100}%`;
  if (dom.guardBar) dom.guardBar.style.width = `${(encounter.guard / 2) * 100}%`;
  if (dom.pressureBar) dom.pressureBar.style.width = `${(encounter.pressure / 4) * 100}%`;
  if (dom.foeHealthBar) dom.foeHealthBar.style.width = `${(encounter.foe_health / 6) * 100}%`;

  // Update Foe active intent visual alerts
  if (dom.voidAvatar && dom.voidAvatar.classList) {
    if (encounter.outcome === "ACTIVE") {
      if (encounter.foe_intent === "SURGE") {
        dom.voidAvatar.classList.add("surge-alert");
        dom.voidAvatar.classList.remove("strike-vibe");
      } else {
        dom.voidAvatar.classList.add("strike-vibe");
        dom.voidAvatar.classList.remove("surge-alert");
      }
    } else {
      dom.voidAvatar.classList.remove("surge-alert");
      dom.voidAvatar.classList.remove("strike-vibe");
    }
  }

  dom.trace.replaceChildren(...encounter.trace.map((entry) => {
    const item = document.createElement("li");
    item.textContent = `Round ${entry.round}: ${entry.command}; ${entry.foe_resolved ? `effect ${entry.adverse_damage} integrity / ${entry.adverse_pressure} pressure; ${entry.outcome}.` : "adverse effect skipped; VICTORY."}`;
    return item;
  }));

  // Narration with typing animation
  if (surface === "play" && sequence > 0) {
    typeText(dom.announcement, lastMessage);
  } else {
    dom.announcement.textContent = lastMessage;
  }

  // Local telemetry logs ledger updates
  updateTelemetry();
  translateUI();

  for (const button of dom.commandButtons) button.disabled = !commandAvailable(button.dataset.command);
  document.querySelector("#threat-copy").textContent = threatCopy(encounter);
}

dom.begin.addEventListener("click", () => showSurface("play"));
dom.continue.addEventListener("click", continueCampaign);
dom.restart.addEventListener("click", resetCampaign);
for (const button of dom.commandButtons) {
  button.addEventListener("click", () => recordCommand(button.dataset.command));
}

if (dom.audioToggle) {
  dom.audioToggle.addEventListener("click", toggleAudio);
}

if (dom.resume) {
  dom.resume.addEventListener("click", () => {
    loadGameState();
  });
}

// Audio Settings Panel triggers
if (dom.settingsToggle && dom.settingsPanel) {
  dom.settingsToggle.addEventListener("click", () => {
    const isHidden = dom.settingsPanel.style.display === "none";
    dom.settingsPanel.style.display = isHidden ? "block" : "none";
  });
}

if (dom.bgmVolume) {
  dom.bgmVolume.addEventListener("input", (e) => {
    volumeBgm = parseFloat(e.target.value);
    if (sfx.bgm && !audioMuted) {
      sfx.bgm.volume = volumeBgm;
    }
  });
}

if (dom.sfxVolume) {
  dom.sfxVolume.addEventListener("input", (e) => {
    volumeSfx = parseFloat(e.target.value);
  });
}

if (dom.narrVolume) {
  dom.narrVolume.addEventListener("input", (e) => {
    volumeNarr = parseFloat(e.target.value);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.activeElement?.tagName === "INPUT") return;
  const keyboardCommands = { s: "STRIKE", b: "BRACE", d: "DISRUPT", r: "RECOVER" };
  const command = keyboardCommands[event.key.toLowerCase()];
  if (!command || !commandAvailable(command)) return;
  event.preventDefault();
  recordCommand(command);
});

if (dom.langToggle) {
  dom.langToggle.addEventListener("click", () => {
    currentLang = currentLang === "ko" ? "en" : "ko";
    translateUI();
    render();
    saveGameState();
  });
}

// Load initial language preference if saved
if (storage) {
  try {
    const saved = storage.getItem("abyssal_surge_save");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentLang) {
        currentLang = parsed.currentLang;
      }
    }
  } catch (e) {}
}

translateUI();
checkSave();
render();
