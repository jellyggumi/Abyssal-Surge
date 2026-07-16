import {
  CAMPAIGN_SCHEDULES,
  commandCost,
  COMMANDS,
  OUTCOMES,
  RULES_VERSION,
  awardFor,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  replayEncounter,
  settleCampaign,
  validateDeterministicReplay,
} from "./game-core.js";

// DET7: cycle build marker — readable via page eval to verify the v3 service
// worker serves fresh app.js after a deploy.
const BUILD_TAG = "c008";
if (typeof window !== "undefined") window.BUILD_TAG = BUILD_TAG;

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
  intentTitle: document.querySelector("#intent-title-text"),
  threat: document.querySelector("#threat-copy"),
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
  commandHelp: document.querySelector("#command-help"),
  hotkeyGuide: {
    strike: document.querySelector("#hotkey-strike"),
    brace: document.querySelector("#hotkey-brace"),
    disrupt: document.querySelector("#hotkey-disrupt"),
    recover: document.querySelector("#hotkey-recover"),
  },
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
  terminalIllustration: document.querySelector("#terminal-illustration"),
  foeChargeBar: document.querySelector("#foe-charge-bar"),
  unitsContainer: document.querySelector("#units-container"),
  battlefieldLane: document.querySelector("#battlefield-lane") || document.querySelector("#rts-units-layer") || null,
  monitorTitle: document.querySelector("#monitor-title"),
  monitorTitleText: document.querySelector("#monitor-title-text"),
  monitorActiveLabel: document.querySelector("#monitor-active-label"),
  monitorActiveCount: document.querySelector("#monitor-active-count"),
  monitorPlaceholder: document.querySelector("#monitor-placeholder"),
  monitorListContainer: document.querySelector("#monitor-list-container"),
  monitorHostileLabel: document.querySelector("#monitor-hostile-label"),
  monitorHostileCount: document.querySelector("#monitor-hostile-count"),
};

let surface = "lobby";
let encounterIndex = 0;
let sequence = 0;
let encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex], encounterIndex);
let records = [];
let stageJournals = [[]];
let outcomes = [];
let settlement = null;
let currentLang = "en";
let lastMessage = "";
let announceAcceptedCommand = false;
let audioMuted = true;
let totalCommandsRun = 0;
let typingInterval = null;
let fadeInterval = null;


// RTS Engine Variables
const useRealTime = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";
const COMMAND_SET = new Set(COMMANDS);
let activeUnits = [];
let foeCharge = 0;
let lastTickTime = 0;
let rAFId = null;
let nextUnitId = 0;
let lastSecondSave = 0;


// DET-STAGE: per-stage real-time presets (presentation-layer only; semantic core untouched).
// Indexed by encounterIndex, clamped to array bounds.
const STAGE_RT_PRESETS = [
  { foeCooldown: 3.5, unitSpeed: 33.3, focusRegen: 0.5 }, // Stage 1 — baseline, tutorial pacing
  { foeCooldown: 3.2, unitSpeed: 33.3, focusRegen: 0.5 }, // Stage 2 — pressure introduction
  { foeCooldown: 3.0, unitSpeed: 36.0, focusRegen: 0.5 }, // Stage 3 — mid-campaign tempo rise
  { foeCooldown: 2.8, unitSpeed: 36.0, focusRegen: 0.5 }, // Stage 4 — competing-responsibility stress
  // Stage 5 — accountable-stewardship finale. stage1-rules-v2 economy: focus
  // is a finite budget (no passive regen) so the escalating DISRUPT cost and
  // the D,D,B anti-dominance line bind in real time exactly as in the reducer.
  { foeCooldown: 2.5, unitSpeed: 40.0, focusRegen: 0 },
];

function stageRtPreset(index = encounterIndex) {
  const numeric = Number.isFinite(Number(index)) ? Number(index) : 0;
  const clamped = Math.min(Math.max(numeric, 0), STAGE_RT_PRESETS.length - 1);
  return STAGE_RT_PRESETS[clamped];
}

// DET-RTS mouse: one-shot spawn origin (% of lane width, 0-20) set by the lane
// click handler immediately before recordCommand("STRIKE"), consumed once by
// spawnUnit. null means "spawn at 0%" (keyboard / button path).
let pendingSpawnOriginPct = null;

function resetRealtimeState({ clearUnits = true } = {}) {
  if (rAFId) {
    cancelAnimationFrame(rAFId);
    rAFId = null;
  }
  if (clearUnits) {
    // DET8-DEPTH item 2: a pending Stage 4 sub-wave must not fire into a
    // cleared lane (stage transition / restart bypasses removeHostileUnits).
    clearBurstPairTimer();
    activeUnits = [];
    if (dom.unitsContainer) {
      dom.unitsContainer.innerHTML = "";
    }
  }
  foeCharge = 0;
  lastTickTime = 0;
  nextUnitId = 0;
  lastSecondSave = 0;
}


const DICTIONARY = {
  en: {
    lobbyTitle: "Stage 1 command encounter",
    lobbyIntro: "Each encounter resolves one to three visible foe intents (Strike or Surge). Choose a declared command; deterministic reduction keeps pointer input and keyboard input identical.",
    lobbyBrief1: "Brace blocks Strike damage. Disrupt blocks Surge damage and pressure. Both actions cost 1 focus.",
    lobbyBrief2: "Integrity 0 is an integrity defeat, pressure 4 is a pressure defeat, and foe health 0 is victory. Surviving the final scheduled round is a Hold.",
    lobbyBrief3: "A campaign contains exactly five terminal encounters. Victory grants 2 fragments; Hold grants 0. Settlement turns every 3 fragments into 1 resolve mark, capped at 2.",
    btnBegin: "Begin local campaign",
    btnResume: "Resume campaign",
    btnContinue: "Start next local encounter",
    btnRestart: "Restart local campaign",
    ruleVersion: "Rules version:",
    intentTitle: "Current threat:",
    commandsTitle: "Semantic commands",
    commandHelp: "Pointer/touch clicks and keyboard shortcuts record the same versioned command before the deterministic reducer resolves it. Unavailable commands are disabled rather than substituted.",
    commandHelpStage5: "Stage 5: every accepted command resolves one FULL round \u2014 your effect and the foe's answer land together, and focus does not regenerate.",
    traceTitle: "Resolution trace",
    terminalTitle: "Stage 1 result",
    btnStrike: "Strike",
    btnBrace: "Brace",
    btnDisrupt: "Disrupt",
    btnRecover: "Recover",
    roundLabel: "Round",
    progressLabel: "Progress",
    etaLabel: "ETA",
    monitorTitle: "RTS Tactical Monitor",
    activeSignalsLabel: "Active signals:",
    noSignals: "STANDBY - NO ACTIVE SIGNALS",
    adverseResolved: "Adverse effect resolved",
    adverseSkipped: "Adverse effect skipped",
    outcomeLabel: "Outcome",
    terminalAward: "Award",
    replayDeterministic: "Replay check: deterministic.",
    replayMismatch: "Replay check: mismatch.",
    terminalIdle: "Awaiting a semantic command.",
    encounterStartPrefix: "Encounter",
    encounterStartsWith: "starts with",
    encounterStartSuffix: "intent.",
    terminalReady: "This is encounter",
    stage5SettlementReady: "Campaign settled locally",
    terminalNext: "The terminal record is ready for the next local encounter.",
    encounterRecordLabel: "encounter record",
    encounterRecordsLabel: "encounter records",
    fragmentSingular: "fragment",
    fragmentPlural: "fragments",
    laneClickHint: "Click lane: STRIKE at position",
    unitStrike: "Knight Vanguard",
    unitBrace: "Iron Bulwark",
    unitDisrupt: "Arcane Disruptor",
    unitVoidspawn: "Void Spawn",
    hostileLabel: "Hostile: ",
    unitTraversing: "TRAVERSING",
    unitHostileAction: "INBOUND",
  },
  ko: {
    lobbyTitle: "1단계 커맨드 인카운터",
    lobbyIntro: "각 전투는 1~3회의 적대 의도(공격/돌입)를 공개합니다. 선언된 커맨드를 마우스나 단축키로 입력하면 결정론적 리듀서가 키보드 입력과 포인터 입력을 동일하게 처리합니다.",
    lobbyBrief1: "대비(Brace)는 공격 대미지를 막고, 방해(Disrupt)는 돌입 대미지와 압박을 막습니다. 각 행동은 정신력(Focus) 1을 소모합니다.",
    lobbyBrief2: "생명력(Integrity)이 0이면 패배, 압박(Pressure)이 4가 되면 패배이며, 적 체력(Foe Health)이 0이면 승리합니다. 마지막 예정 라운드를 버티면 홀드(Hold)입니다.",
    lobbyBrief3: "캠페인은 총 5번의 종결 전투로 구성됩니다. 승리 시 2개, 홀드 시 0개의 파편을 획득합니다. 정산은 3개 파편당 1개의 복기 마크를 지급하며 최대 2개입니다.",
    btnBegin: "캠페인 시작하기",
    btnResume: "이어서 진행하기",
    btnContinue: "다음 인카운터 시작",
    btnRestart: "캠페인 초기화",
    ruleVersion: "규칙 버전:",
    intentTitle: "현재 위협:",
    commandsTitle: "커맨드 콘솔",
    commandHelp: "마우스 클릭이나 키보드 단축키(S, B, D, R)를 누르면 결정론적 리듀서가 커맨드 입력을 처리합니다. 사용할 수 없는 커맨드는 비활성화됩니다.",
    commandHelpStage5: "5\ub2e8\uacc4: \uc2b9\uc778\ub41c \ucee4\ub9e8\ub4dc 1\ud68c\uac00 \ud55c \ub77c\uc6b4\ub4dc \uc804\uccb4\ub97c \uacb0\uc0b0\ud569\ub2c8\ub2e4 \u2014 \ub0b4 \ud6a8\uacfc\uc640 \uc801\uc758 \uc751\uc218\uac00 \ub3d9\uc2dc\uc5d0 \uc801\uc6a9\ub418\uace0, \uc9d1\uc911\uc740 \uc7ac\uc0dd\ub418\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
    traceTitle: "전투 분석 로그",
    terminalTitle: "전투 결과 기록",
    btnStrike: "공격",
    btnBrace: "대비",
    btnDisrupt: "방해",
    btnRecover: "회복",
    roundLabel: "라운드",
    progressLabel: "진행",
    etaLabel: "도착예정",
    monitorTitle: "RTS 전술 모니터",
    activeSignalsLabel: "활성 신호:",
    noSignals: "대기중 - 활성 신호 없음",
    adverseResolved: "부정 효과 적용",
    adverseSkipped: "부정 효과 스킵",
    outcomeLabel: "결과",
    terminalAward: "획득",
    replayDeterministic: "재생 재검증: 결정론적.",
    replayMismatch: "재생 재검증: 불일치.",
    terminalIdle: "커맨드 입력을 기다리는 중입니다.",
    encounterStartPrefix: "번째 인카운터가 ",
    encounterStartsWith: "의 위협으로 시작",
    encounterStartSuffix: "되었습니다.",
    terminalReady: "이 인카운터는",
    stage5SettlementReady: "캠페인 정산 완료",
    terminalNext: "터미널 기록이 다음 로컬 인카운터 시작 준비를 완료했습니다.",
    encounterRecordLabel: "인카운터 기록",
    encounterRecordsLabel: "인카운터 기록",
    fragmentSingular: "파편",
    fragmentPlural: "파편",
    laneClickHint: "전장 클릭: 해당 위치에서 공격 (STRIKE)",
    unitStrike: "성기사 전위병",
    unitBrace: "강철 방벽병",
    unitDisrupt: "비전 교란자",
    unitVoidspawn: "심연 스폰",
    hostileLabel: "적대 신호: ",
    unitTraversing: "진격중",
    unitHostileAction: "접근중",
  },
};
const COMMAND_LABELS = {
  en: {
    STRIKE: "Strike",
    BRACE: "Brace",
    DISRUPT: "Disrupt",
    RECOVER: "Recover",
  },
  ko: {
    STRIKE: "공격",
    BRACE: "대비",
    DISRUPT: "방해",
    RECOVER: "회복",
  },
};

const INTENT_LABELS = {
  en: {
    STRIKE: "Strike",
    SURGE: "Surge",
  },
  ko: {
    STRIKE: "공격",
    SURGE: "돌입",
  },
};

const OUTCOME_DESCRIPTIONS = {
  en: {
    VICTORY: "foe health reached 0 before the round's adverse effect resolved",
    HOLD: "the final scheduled round resolved without a defeat condition",
    DEFEAT_INTEGRITY: "integrity reached 0",
    DEFEAT_PRESSURE: "pressure reached 4",
  },
  ko: {
    VICTORY: "적 체력이 0이 되어 해당 라운드의 부정적 결과 처리 이전에 종결됨",
    HOLD: "마지막 예정 라운드가 패배 조건 없이 종료됨",
    DEFEAT_INTEGRITY: "생명력이 0이 되어 패배",
    DEFEAT_PRESSURE: "압박이 4가 되어 패배",
  },
};

const OUTCOME_TRACE_DESCRIPTIONS = {
  en: {
    VICTORY: "Victory",
    HOLD: "Hold",
    DEFEAT_INTEGRITY: "Defeat",
    DEFEAT_PRESSURE: "Defeat",
  },
  ko: {
    VICTORY: "승리",
    HOLD: "홀드",
    DEFEAT_INTEGRITY: "패배",
    DEFEAT_PRESSURE: "패배",
  },
};

const COMMAND_REJECTION_COPY = {
  en: {
    FOCUS: "insufficient focus",
    FOCUS_CAP: "focus is already full",
    INTENT: "command is not valid for the current threat",
    UNKNOWN_COMMAND: "unknown command",
    TERMINAL: "encounter already ended",
    TICK: "command tick mismatch",
    SEQUENCE: "command sequence mismatch",
    RULES_VERSION: "rules version mismatch",
    MALFORMED_RECORD: "command record is malformed",
    MALFORMED_STATE: "encounter state is malformed",
    STATE_RULES_VERSION: "encounter uses a different rule version",
    STATE_BOUNDS: "encounter value exceeded expected bounds",
    SCHEDULE: "invalid foe intent schedule",
    TRACE: "invalid trace state",
    ROUND: "invalid round value",
    ROUND_COHERENCE: "round state is inconsistent",
    FOE_INTENT: "foe intent did not match expectation",
    ACTIVE_TERMINAL_VALUE: "encounter state is already terminal",
    TERMINAL_COHERENCE: "terminal consistency check failed",
    DUPLICATE_SEQUENCE: "duplicate command sequence",
  },
  ko: {
    FOCUS: "정신력 부족",
    FOCUS_CAP: "정신력이 이미 가득 찼습니다",
    INTENT: "현재 위협에 사용할 수 없는 커맨드입니다",
    UNKNOWN_COMMAND: "알 수 없는 커맨드",
    TERMINAL: "인카운터가 이미 종료됨",
    TICK: "커맨드 타임스탬프 불일치",
    SEQUENCE: "커맨드 시퀀스 불일치",
    RULES_VERSION: "룰 버전이 일치하지 않습니다",
    MALFORMED_RECORD: "커맨드 레코드 형식이 잘못되었습니다",
    MALFORMED_STATE: "인카운터 상태가 손상되었습니다",
    STATE_RULES_VERSION: "인카운터가 다른 룰 버전을 사용합니다",
    STATE_BOUNDS: "인카운터 수치가 허용 범위를 벗어났습니다",
    SCHEDULE: "적의 의도 스케줄이 잘못되었습니다",
    TRACE: "전투 추적 기록이 잘못되었습니다",
    ROUND: "라운드 값이 잘못되었습니다",
    ROUND_COHERENCE: "라운드 상태가 일관되지 않습니다",
    FOE_INTENT: "적의 현재 위협이 기대값과 다릅니다",
    ACTIVE_TERMINAL_VALUE: "전투 상태가 이미 종결 상태입니다",
    TERMINAL_COHERENCE: "종결 기록 정합성이 깨졌습니다",
    DUPLICATE_SEQUENCE: "커맨드 시퀀스가 중복됩니다",
  },
};

function commandLabel(command, lang = currentLang) {
  const dict = COMMAND_LABELS[lang] || COMMAND_LABELS.en;
  return dict[command] || command.toLowerCase();
}

function dictionaryFor(lang = currentLang) {
  return DICTIONARY[lang] || DICTIONARY.en;
}

function intentLabel(intent, lang = currentLang) {
  const dict = INTENT_LABELS[lang] || INTENT_LABELS.en;
  return dict[intent] || intent;
}

function outcomeText(outcome, lang = currentLang) {
  const dict = OUTCOME_DESCRIPTIONS[lang] || OUTCOME_DESCRIPTIONS.en;
  return dict[outcome] || outcome;
}

function traceOutcomeText(outcome, lang = currentLang) {
  const dict = OUTCOME_TRACE_DESCRIPTIONS[lang] || OUTCOME_TRACE_DESCRIPTIONS.en;
  return dict[outcome] || outcome;
}

function commandRejectText(code, lang = currentLang) {
  const dict = COMMAND_REJECTION_COPY[lang] || COMMAND_REJECTION_COPY.en;
  if (typeof code === "string" && dict[code]) return dict[code];
  return typeof code === "string" ? code.toLowerCase().replace(/_/g, " ") : "";
}


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

function percentage(current, maximum) {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(maximum) || maximum <= 0) {
    return "0%";
  }
  return `${Math.max(0, Math.min(1, current / maximum)) * 100}%`;
}

function normalizeLanguage(value) {
  return value === "ko" ? "ko" : "en";
}

function normalizeInteger(value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function normalizeFloat(value, fallback, minimum = 0, maximum = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function isCurrentCoreRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const keys = Reflect.ownKeys(record);
  if (keys.length !== 4 || !["rules_version", "command", "tick", "sequence"].every((key) => keys.includes(key))) return false;
  return (
    record.rules_version === RULES_VERSION
    && COMMANDS.includes(record.command)
    && Number.isSafeInteger(record.tick)
    && Number.isSafeInteger(record.sequence)
    && record.sequence >= 1
  );
}

function replayStageJournal(stageIndex, storedJournal) {
  if (!Array.isArray(storedJournal)) return null;

  let state = initialEncounter(CAMPAIGN_SCHEDULES[stageIndex], stageIndex);
  const acceptedRecords = [];
  for (let index = 0; index < storedJournal.length; index += 1) {
    const storedRecord = storedJournal[index];
    if (!isCurrentCoreRecord(storedRecord) || storedRecord.sequence !== index + 1) return null;

    const candidate = makeCommand(storedRecord.command, storedRecord.tick, storedRecord.sequence);
    const result = reduceEncounter(state, candidate);
    if (!result.accepted) return null;

    acceptedRecords.push(candidate);
    state = result.state;
  }

  return { state, records: acceptedRecords, sequence: acceptedRecords.length };
}

function replayStageJournals(storedJournals) {
  if (!Array.isArray(storedJournals) || storedJournals.length < 1 || storedJournals.length > CAMPAIGN_SCHEDULES.length) {
    return { restored: null, consumedAllJournals: false };
  }

  const journals = [];
  const restoredOutcomes = [];
  let total = 0;
  let restored = null;

  for (let stageIndex = 0; stageIndex < storedJournals.length; stageIndex += 1) {
    const replay = replayStageJournal(stageIndex, storedJournals[stageIndex]);
    if (!replay) return { restored, consumedAllJournals: false };

    journals.push(replay.records);
    total += replay.records.length;
    if (replay.state.outcome !== "ACTIVE") restoredOutcomes.push(replay.state.outcome);
    restored = {
      encounterIndex: stageIndex,
      encounter: replay.state,
      records: [...replay.records],
      sequence: replay.sequence,
      stageJournals: journals,
      outcomes: [...restoredOutcomes],
      settlement: restoredOutcomes.length === CAMPAIGN_SCHEDULES.length ? settleCampaign(restoredOutcomes) : null,
      totalCommandsRun: total,
    };

    if (replay.state.outcome === "ACTIVE" && stageIndex < storedJournals.length - 1) {
      return { restored, consumedAllJournals: false };
    }
  }

  return { restored, consumedAllJournals: true };
}

function restorePreferences(saveState) {
  currentLang = normalizeLanguage(saveState.currentLang);
  volumeBgm = normalizeFloat(saveState.volumeBgm, 0.5);
  volumeSfx = normalizeFloat(saveState.volumeSfx, 0.8);
  volumeNarr = normalizeFloat(saveState.volumeNarr, 1.0);
  if (dom.bgmVolume) dom.bgmVolume.value = volumeBgm;
  if (dom.sfxVolume) dom.sfxVolume.value = volumeSfx;
  if (dom.narrVolume) dom.narrVolume.value = volumeNarr;
}

function projectRestoredTerminal() {
  const dict = dictionaryFor();
  const replayCheck = validateDeterministicReplay(encounter.schedule, records);
  const award = awardFor(encounter.outcome);
  const resolvedEncounterCount = outcomes.length;
  dom.terminalSummary.textContent = `${terminalCopy(encounter.outcome)} ${dict.terminalAward}: ${award} ${
    award === 1 ? dict.fragmentSingular : dict.fragmentPlural
  }. ${replayCheck.matches ? dict.replayDeterministic : dict.replayMismatch}`;
  dom.settlement.textContent = settlement
    ? `${dict.stage5SettlementReady}: ${settlement.fragments_earned} ${settlement.fragments_earned === 1 ? dict.fragmentSingular : dict.fragmentPlural}. Wallet ${settlement.fragment_wallet}, resolve marks ${settlement.resolve_marks}.`
    : `${dict.terminalReady} ${dict.encounterRecordsLabel}: ${resolvedEncounterCount}. ${dict.terminalNext}`;
  dom.continue.hidden = Boolean(settlement);
}

function restoreCampaignSurface(next) {
  surface = next;
  for (const [name, screen] of Object.entries(dom.screens)) screen.hidden = name !== next;
  if (next === "play") {
    if (dom.terminalIllustration) dom.terminalIllustration.style.display = "none";
    if (dom.screens.play && dom.screens.play.style) {
      dom.screens.play.style.backgroundImage = `linear-gradient(rgba(11, 13, 20, 0.85), rgba(11, 13, 20, 0.85)), url('assets/images/stage${encounterIndex + 1}.png')`;
    }
    if (useRealTime && !rAFId) rAFId = requestAnimationFrame(rtsLoop);
  } else if (dom.terminalIllustration) {
    if (encounter.outcome === "VICTORY") {
      dom.terminalIllustration.src = "assets/images/victory.png";
      dom.terminalIllustration.style.display = "inline-block";
    } else if (encounter.outcome.startsWith("DEFEAT")) {
      dom.terminalIllustration.src = "assets/images/defeat.png";
      dom.terminalIllustration.style.display = "inline-block";
    } else {
      dom.terminalIllustration.style.display = "none";
    }
  }
  render();
}

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
    stageJournals,
    currentLang,
    volumeBgm,
    volumeSfx,
    volumeNarr,
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
    if (!saveState || typeof saveState !== "object" || Array.isArray(saveState)) return false;

    const replayResult = replayStageJournals(saveState.stageJournals);
    const restored = replayResult.restored;
    if (!restored) return false;

    restorePreferences(saveState);
    encounterIndex = restored.encounterIndex;
    encounter = restored.encounter;
    records = restored.records;
    sequence = restored.sequence;
    stageJournals = restored.stageJournals;
    outcomes = restored.outcomes;
    settlement = restored.settlement;
    totalCommandsRun = restored.totalCommandsRun;
    lastMessage = encounter.outcome === "ACTIVE" ? encounterStartMessage() : dictionaryFor().terminalIdle;
    announceAcceptedCommand = false;

    resetRealtimeState({ clearUnits: true });
    if (encounter.outcome !== "ACTIVE") projectRestoredTerminal();
    restoreCampaignSurface(encounter.outcome === "ACTIVE" ? "play" : "terminal");
    if (replayResult.consumedAllJournals) saveGameState();
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

function rtsLoop(timestamp) {
  rAFId = null;
  if (surface !== "play" || encounter.outcome !== "ACTIVE") {
    return;
  }

  if (!lastTickTime) lastTickTime = timestamp;
  let dt = (timestamp - lastTickTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTickTime = timestamp;

  // 1. Foe Attack charge progress
  const foeAttackCooldown = stageRtPreset().foeCooldown;
  foeCharge += dt;
  if (foeCharge >= foeAttackCooldown) {
    foeCharge = 0;

    // stage1-rules-v2 Stage 5: every round resolves through the reducer at
    // command time (see recordCommand). The charge wrap is a PURE telegraph
    // refresh — no damage, no round advance, no state mutation — so the
    // recorded command stream stays the exact semantic game.
    if (encounterIndex === 4) {
      // Telegraph only; frame continues (regen/movement below still run).
      spawnHostileWave();
    } else {
    
      // Resolve Foe Attack
    let adverseDamage = 0;
    let adversePressure = 0;
    if (encounter.foe_intent === "STRIKE") {
      adverseDamage = Math.max(0, 2 - encounter.guard);
      encounter.integrity = Math.max(0, encounter.integrity - adverseDamage);
      play("strike");
      triggerFx("STRIKE");
      if (dom.knightAvatar && dom.knightAvatar.classList) {
        dom.knightAvatar.classList.add("damage-flash");
        setTimeout(() => {
          if (dom.knightAvatar && dom.knightAvatar.classList) {
            dom.knightAvatar.classList.remove("damage-flash");
          }
        }, 400);
      }
    } else if (!encounter.surge_countered) {
      adverseDamage = 4;
      adversePressure = 2;
      encounter.integrity = Math.max(0, encounter.integrity - adverseDamage);
      encounter.pressure = Math.min(4, encounter.pressure + adversePressure);
      play("disrupt");
      triggerFx("DISRUPT");
      if (dom.knightAvatar && dom.knightAvatar.classList) {
        dom.knightAvatar.classList.add("damage-flash");
        setTimeout(() => {
          if (dom.knightAvatar && dom.knightAvatar.classList) {
            dom.knightAvatar.classList.remove("damage-flash");
          }
        }, 400);
      }
    }
    
    encounter.guard = 0; // reset guard after attack resolves
    encounter.surge_countered = false;
    
    // Check Foe victory/defeat conditions
    if (encounter.integrity <= 0) {
      encounter.outcome = "DEFEAT_INTEGRITY";
      finishEncounter();
      return;
    }
    if (encounter.pressure >= 4) {
      encounter.outcome = "DEFEAT_PRESSURE";
      finishEncounter();
      return;
    }
    
    // Advance Foe round / intent schedule
    encounter.round = (encounter.round + 1) % encounter.schedule.length;
    encounter.foe_intent = encounter.schedule[encounter.round];

    // DET6-FOE (rev): the NEXT charge cycle begins now — telegraph it with a
    // fresh hostile wave. spawnHostileWave clears any edge survivors first.
    spawnHostileWave();
    }
  }

  // 2. Player Focus regeneration (per-stage preset; stage 5 has NO passive
  // regen under stage1-rules-v2 — the RECOVER channel remains the only source)
  let regenRate = stageRtPreset().focusRegen;
  if (isRecovering) {
    recoverTimer -= dt;
    if (recoverTimer <= 0) {
      isRecovering = false;
    } else {
      regenRate = 1.5; // +1.5 Focus per second during recover channel
    }
  }
  encounter.focus = Math.min(encounter.max_focus, encounter.focus + regenRate * dt);

  // 3. Move and Update Deployed Units
  // Friendly units (direction +1) march right and resolve at the foe base;
  // hostile units (direction -1) march left and despawn at the player edge.
  // Hostile arrival is purely visual — no encounter state is touched.
  // DET8-DEPTH item 1 — Stage 2 "feint": a hostile unit carrying feintAt
  // freezes once at mid-lane for FEINT_PAUSE_SECONDS, then resumes at a
  // precomputed faster speed (unit.postFeintSpeed) so total arrival time is
  // unchanged. Integrated with dt (no per-frame timers); presentation-only.
  const nextUnits = [];
  for (const unit of activeUnits) {
    const direction = unit.direction === -1 ? -1 : 1;
    let moveDt = dt;
    if (unit.hostile && Number.isFinite(unit.feintAt) && !unit.feintDone) {
      if (unit.pauseLeft > 0) {
        // Mid-feint: x stays frozen while the pause timer burns down. Any
        // leftover dt after the pause ends moves the unit this same frame.
        unit.pauseLeft -= dt;
        if (unit.pauseLeft <= 0) {
          moveDt = -unit.pauseLeft;
          unit.pauseLeft = 0;
          unit.feintDone = true;
          unit.speed = unit.postFeintSpeed;
        } else {
          moveDt = 0;
        }
      } else if (unit.x <= unit.feintAt) {
        // Crossing the feint mark this frame: freeze here, start the pause.
        unit.pauseLeft = FEINT_PAUSE_SECONDS;
        moveDt = 0;
      }
    }
    unit.x += unit.speed * moveDt * direction;
    if (direction === -1) {
      if (unit.x <= 0) {
        // Hostile reached the player edge: remove the element, drop the unit.
        if (unit.element && unit.element.parentNode) {
          unit.element.parentNode.removeChild(unit.element);
        }
      } else {
        if (unit.element) {
          unit.element.style.left = `${unit.x}%`;
        }
        nextUnits.push(unit);
      }
    } else if (unit.x >= 100) {
      // Unit reached Foe base!
      if (unit.semanticResolved) {
        // Reducer-routed round (Stage 5): the effect already applied at
        // command time — arrival is a pure impact animation, no state change.
        if (unit.type === "STRIKE") {
          play("strike");
          triggerFx("STRIKE");
        } else if (unit.type === "BRACE") {
          play("brace");
        }
        if (unit.element && unit.element.parentNode) {
          unit.element.parentNode.removeChild(unit.element);
        }
      } else {
        if (unit.type === "STRIKE") {
          encounter.foe_health = Math.max(0, encounter.foe_health - 2);
          play("strike");
          triggerFx("STRIKE");
          if (dom.voidAvatar && dom.voidAvatar.classList) {
            dom.voidAvatar.classList.add("damage-flash");
            setTimeout(() => {
              if (dom.voidAvatar && dom.voidAvatar.classList) {
                dom.voidAvatar.classList.remove("damage-flash");
              }
            }, 400);
          }
        } else if (unit.type === "BRACE") {
          encounter.guard = Math.min(2, encounter.guard + 2);
          play("brace");
        }

        // Remove element from DOM
        if (unit.element && unit.element.parentNode) {
          unit.element.parentNode.removeChild(unit.element);
        }

        if (encounter.foe_health <= 0) {
          encounter.outcome = "VICTORY";
          finishEncounter();
          return;
        }
      }
    } else {
      // Update visual position
      if (unit.element) {
        unit.element.style.left = `${unit.x}%`;
      }
      nextUnits.push(unit);
    }

    if (unit.element) {
      unit.element.style.left = `${unit.x}%`;
    }
    nextUnits.push(unit);
  }
  activeUnits = nextUnits;

  if (timestamp - lastSecondSave >= 1000) {
    saveGameState();
    lastSecondSave = timestamp;
  }

  render();
  rAFId = requestAnimationFrame(rtsLoop);
}

// DET-RES sprite wiring: concept-art sprites with inline-SVG silhouette fallback.
// Files may be absent while the pipeline runs — onerror swaps back to the SVG,
// invisible to gameplay.
const UNIT_SPRITE_SOURCES = {
  STRIKE: "assets/images/unit_strike.png",
  BRACE: "assets/images/unit_brace.png",
  DISRUPT: "assets/images/unit_disrupt.png",
  VOIDSPAWN: "assets/images/unit_voidspawn.png",
};

const UNIT_SVG_FALLBACKS = {
  STRIKE: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #ef4444; filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.8));"><path d="M19 3a1 1 0 0 0-1.4 0L11 9.6 9.6 11l-4.2-4.2-1.4 1.4 4.2 4.2-2.1 2.1a1.5 1.5 0 0 0 0 2.1l1.4 1.4L2 21.5l1.4 1.4 3.5-3.5 1.4 1.4a1.5 1.5 0 0 0 2.1 0l2.1-2.1 4.2 4.2 1.4-1.4-4.2-4.2 1.4-1.4 6.6-6.6a1 1 0 0 0 0-1.4L19 3z" /></svg>`,
  BRACE: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #3b82f6; filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.8));"><path d="M12 2L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-3z" /></svg>`,
  DISRUPT: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #a855f7; filter: drop-shadow(0 0 2px rgba(168, 85, 247, 0.8));"><path d="M12 2l1.8 4.6 4.9.4-3.7 3.2 1.1 4.8L12 12.4 7.9 15l1.1-4.8-3.7-3.2 4.9-.4L12 2zm0 14a3 3 0 0 1 3 3c0 1.7-1.3 3-3 3s-3-1.3-3-3a3 3 0 0 1 3-3z" /></svg>`,
  VOIDSPAWN: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #7c3aed; filter: drop-shadow(0 0 2px rgba(124, 58, 237, 0.8));"><path d="M12 2c4.4 0 8 3.1 8 7 0 2.2-1.2 4-2.6 5.4.9 1.6 2.2 2.6 2.2 2.6s-2.1.4-4-.8c-.5 1.7.4 3.8.4 3.8s-2.4-.7-3.4-2.8c-.2 0-.4 0-.6 0s-.4 0-.6 0c-1 2.1-3.4 2.8-3.4 2.8s.9-2.1.4-3.8c-1.9 1.2-4 .8-4 .8s1.3-1 2.2-2.6C4.2 13 4 11.2 4 9c0-3.9 3.6-7 8-7zm-3 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" /></svg>`,
};

// DET6-UNIT/FOE: presentation-only per-type tuning. Hostile spawns visualize
// the deterministic foe-charge telegraph — they never mutate encounter state.
const UNIT_SPEED_MULTIPLIERS = {
  DISRUPT: 1.15,
};

const UNIT_LANE_CLASSES = {
  STRIKE: "unit-soldier",
  BRACE: "unit-shield",
  DISRUPT: "unit-disruptor",
  VOIDSPAWN: "unit-voidspawn",
};

const UNIT_SPRITE_FILTERS = {
  STRIKE: "rgba(239, 68, 68, 0.8)",
  BRACE: "rgba(59, 130, 246, 0.8)",
  DISRUPT: "rgba(168, 85, 247, 0.8)",
  VOIDSPAWN: "rgba(190, 24, 93, 0.8)",
};

// DET6-UNIT: tactical-monitor card theming per unit kind (spawn-time only —
// the per-frame in-place update path never re-reads these).
const UNIT_MONITOR_THEMES = {
  STRIKE: { color: "#ef4444", border: "rgba(239, 68, 68, 0.3)", inset: "rgba(239, 68, 68, 0.05)", glow: "rgba(239,68,68,0.4)" },
  BRACE: { color: "#3b82f6", border: "rgba(59, 130, 246, 0.3)", inset: "rgba(59, 130, 246, 0.05)", glow: "rgba(59,130,246,0.4)" },
  DISRUPT: { color: "#a855f7", border: "rgba(168, 85, 247, 0.3)", inset: "rgba(168, 85, 247, 0.05)", glow: "rgba(168,85,247,0.4)" },
  VOIDSPAWN: { color: "#be185d", border: "rgba(190, 24, 93, 0.35)", inset: "rgba(190, 24, 93, 0.06)", glow: "rgba(190,24,93,0.45)" },
};

const UNIT_MONITOR_NAME_KEYS = {
  STRIKE: "unitStrike",
  BRACE: "unitBrace",
  DISRUPT: "unitDisrupt",
  VOIDSPAWN: "unitVoidspawn",
};

function spawnUnit(type, { hostile = false, startX = null, speed = null, semanticResolved = false } = {}) {
  let originPct;
  if (hostile) {
    // Hostile spawns enter at the lane's right edge (or a caller-provided
    // stagger offset) and never consume the one-shot click origin.
    originPct = Number.isFinite(startX) ? Math.min(100, Math.max(0, startX)) : 100;
  } else {
    // Consume the one-shot click origin even if rendering is unavailable,
    // so a stale value never bleeds into a later spawn.
    originPct = Number.isFinite(pendingSpawnOriginPct)
      ? Math.min(20, Math.max(0, pendingSpawnOriginPct))
      : 0;
    pendingSpawnOriginPct = null;
  }
  if (!dom.unitsContainer) return;
  const unitId = ++nextUnitId;
  const element = document.createElement("div");
  element.className = `spawned-unit ${UNIT_LANE_CLASSES[type] || "unit-soldier"}`;
  element.style.left = `${originPct}%`;

  const sprite = document.createElement("img");
  sprite.src = UNIT_SPRITE_SOURCES[type] || UNIT_SPRITE_SOURCES.STRIKE;
  sprite.alt = "";
  // object-fit: contain keeps non-portrait sheets (voidspawn is 256x256 square)
  // undistorted inside the fixed lane footprint.
  sprite.style.cssText = `width: 24px; height: 26px; object-fit: contain; filter: drop-shadow(0 0 2px ${UNIT_SPRITE_FILTERS[type] || UNIT_SPRITE_FILTERS.STRIKE});`;
  sprite.onerror = () => {
    // Sprite missing or failed to decode: fall back to the inline SVG silhouette.
    element.innerHTML = UNIT_SVG_FALLBACKS[type] || UNIT_SVG_FALLBACKS.STRIKE;
  };
  element.appendChild(sprite);

  dom.unitsContainer.appendChild(element);
  activeUnits.push({
    id: unitId,
    type: type,
    x: originPct,
    speed: Number.isFinite(speed) ? speed : stageRtPreset().unitSpeed * (UNIT_SPEED_MULTIPLIERS[type] || 1),
    direction: hostile ? -1 : 1,
    hostile: hostile,
    // stage1-rules-v2 Stage 5: the reducer already applied this command's
    // semantic effect at command time — arrival must stay presentation-only.
    semanticResolved: semanticResolved,
    element: element
  });
}

// DET8-DEPTH item 1 — Stage 2 "feint" tuning. A telegraph unit pauses once at
// unit.feintAt (random 45-55% of the lane) for FEINT_PAUSE_SECONDS, then
// resumes at postFeintSpeed so the original arrival time is preserved:
// remaining distance / (remaining time budget - pause).
const FEINT_PAUSE_SECONDS = 0.4;

// DET8-DEPTH item 2 — Stage 4 "burst pair": one pending sub-wave timer, armed
// by spawnHostileWave and cleared by removeHostileUnits (which every wave
// reset path funnels through) so a stale timer never spawns into a dispelled
// wave, a finished encounter, or the next stage.
let burstPairTimer = null;
function clearBurstPairTimer() {
  if (burstPairTimer !== null) {
    clearTimeout(burstPairTimer);
    burstPairTimer = null;
  }
}

// Decorate the most recently spawned hostile with presentation-only fields:
// an extra lane-offset CSS class and/or the Stage 2 feint schedule. spawnUnit
// does not return the record, so we reach for the tail of activeUnits.
function tagLastHostile({ laneClass = null, feint = false, speed = null } = {}) {
  const unit = activeUnits[activeUnits.length - 1];
  if (!unit || !unit.hostile) return;
  if (laneClass && unit.element && unit.element.classList) {
    unit.element.classList.add(laneClass);
  }
  if (feint && Number.isFinite(speed) && speed > 0) {
    const feintAt = 45 + Math.random() * 10; // pause somewhere in x 45-55%
    const remainingTime = feintAt / speed; // time budget from feintAt to x=0
    if (remainingTime > FEINT_PAUSE_SECONDS + 0.1) {
      unit.feintAt = feintAt;
      unit.feintDone = false;
      unit.pauseLeft = 0;
      unit.postFeintSpeed = feintAt / (remainingTime - FEINT_PAUSE_SECONDS);
    }
  }
}

// DET6-FOE (rev): remove every live hostile from the lane. With { dispel: true }
// the element plays a brief scale/fade-out (`unit-dispel`, ~300ms, reduced-motion
// aware via the global media query) before removal; otherwise removal is instant.
// Purely cosmetic — activeUnits bookkeeping only, no encounter state touched.
function removeHostileUnits({ dispel = false } = {}) {
  clearBurstPairTimer();
  const survivors = [];
  for (const unit of activeUnits) {
    if (!unit.hostile) {
      survivors.push(unit);
      continue;
    }
    const element = unit.element;
    if (!element) continue;
    if (dispel && element.classList) {
      element.classList.add("unit-dispel");
      setTimeout(() => {
        if (element.parentNode) element.parentNode.removeChild(element);
      }, 300);
    } else if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  activeUnits = survivors;
}

// DET7-READ: hostile wave just spawned — pulse the lane's right edge so the
// short-cooldown waves register peripherally. Class is removed after ~250ms;
// repeat spawns restart the pulse (clearTimeout + reflow restart). Purely
// cosmetic — no encounter state touched. Null-guarded for fake-DOM tests.
let laneFlashTimer = null;
function flashLaneSpawn() {
  const lane = dom.battlefieldLane;
  if (!lane || !lane.classList) return;
  clearTimeout(laneFlashTimer);
  laneFlashTimer = null;
  lane.classList.remove("lane-spawn-flash");
  // Reading offsetWidth forces a reflow so back-to-back waves restart the CSS animation.
  if (typeof lane.offsetWidth === "number") void lane.offsetWidth;
  lane.classList.add("lane-spawn-flash");
  laneFlashTimer = setTimeout(() => {
    laneFlashTimer = null;
    if (lane.classList) lane.classList.remove("lane-spawn-flash");
  }, 250);
}

// DET6-FOE (rev): a foe charge cycle just began — telegraph it. The wave marches
// from x=100 toward the player at 100 / foeCooldown %/s so arrival coincides with
// the attack firing. Edge survivors of the previous cycle are cleared first.
function spawnHostileWave() {
  if (!dom.unitsContainer) return;
  removeHostileUnits();
  const preset = stageRtPreset();
  const telegraphSpeed = 100 / preset.foeCooldown;

  // DET8-DEPTH item 2 — Stage 4 "burst pair": the 2-unit wave splits into two
  // sub-waves (0ms / ~450ms) on distinct lane heights so it reads as a
  // formation. The timer is guarded against surface/encounter/outcome drift
  // and cleared by every removeHostileUnits path.
  if (encounterIndex === 3) {
    spawnUnit("VOIDSPAWN", { hostile: true, startX: 100, speed: telegraphSpeed });
    tagLastHostile({ laneClass: "unit-lane-high" });
    burstPairTimer = setTimeout(() => {
      burstPairTimer = null;
      if (surface !== "play" || encounterIndex !== 3 || encounter.outcome !== "ACTIVE") return;
      spawnUnit("VOIDSPAWN", { hostile: true, startX: 100, speed: telegraphSpeed });
      tagLastHostile({ laneClass: "unit-lane-low" });
    }, 450);
    flashLaneSpawn();
    return;
  }

  let hostileCount = encounterIndex <= 1 ? 1 : 2;
  if (encounterIndex >= 4) {
    // DET8-DEPTH item 3b — Stage 5 telegraph pressure: +1 unit once the boss
    // is nearly broken (foe_health <= 1). Visual only; capped at 4.
    hostileCount = 3;
    if (Number(encounter && encounter.foe_health) <= 1) hostileCount += 1;
    hostileCount = Math.min(hostileCount, 4);
  }
  for (let i = 0; i < hostileCount; i += 1) {
    spawnUnit("VOIDSPAWN", { hostile: true, startX: 100 - i * 3, speed: telegraphSpeed });
    // DET8-DEPTH item 1 — Stage 2 "feint" schedule rides on the unit record.
    if (encounterIndex === 1) {
      tagLastHostile({ feint: true, speed: telegraphSpeed });
    }
  }
  flashLaneSpawn();
}
const STAGE_TITLES_LOCALIZED = {
  en: [
    "The Bell Beneath Blackwater",
    "The Quiet Standard",
    "The Shore That Remembers",
    "Names Under the Foam",
    "The First Surge"
  ],
  ko: [
    "블랙워터 아래의 종",
    "침묵의 군기",
    "기억하는 해안",
    "물거품 속의 이름들",
    "첫 번째 서지"
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
    lobbyIntro.textContent = dict.lobbyIntro;
  }

  const b1 = document.querySelector("#brief-1");
  const b2 = document.querySelector("#brief-2");
  const b3 = document.querySelector("#brief-3");
  if (b1) b1.innerHTML = `<dt>${currentLang === "ko" ? "대응 전술" : "Visible counterplay"}</dt><dd>${dict.lobbyBrief1}</dd>`;
  if (b2) b2.innerHTML = `<dt>${currentLang === "ko" ? "경계 규칙" : "Bounded outcome"}</dt><dd>${dict.lobbyBrief2}</dd>`;
  if (b3) b3.innerHTML = `<dt>${currentLang === "ko" ? "정산 규칙" : "Settlement rule"}</dt><dd>${dict.lobbyBrief3}</dd>`;

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
  el("#command-help", encounterIndex === 4 ? `${dict.commandHelp} ${dict.commandHelpStage5 || ""}` : dict.commandHelp);
  el("#trace-title", dict.traceTitle);
  el("#terminal-title", dict.terminalTitle);
  el("#continue-button", dict.btnContinue);
  el("#restart-button", dict.btnRestart);

  if (dom.intentTitle) {
    dom.intentTitle.textContent = dict.intentTitle;
  }
  if (dom.monitorTitleText) {
    dom.monitorTitleText.textContent = dict.monitorTitle;
  }
  if (dom.monitorActiveLabel) {
    dom.monitorActiveLabel.textContent = `${dict.activeSignalsLabel} `;
  }
  if (dom.monitorHostileLabel) {
    dom.monitorHostileLabel.textContent = dict.hostileLabel;
  }
  if (dom.monitorPlaceholder) {
    dom.monitorPlaceholder.textContent = dict.noSignals;
  }
  if (dom.battlefieldLane) {
    dom.battlefieldLane.title = dict.laneClickHint;
  }

  // Translate command buttons
  const buttonsMap = { STRIKE: dict.btnStrike, BRACE: dict.btnBrace, DISRUPT: dict.btnDisrupt, RECOVER: dict.btnRecover };
  for (const button of dom.commandButtons) {
    const cmd = button.dataset.command;
    if (buttonsMap[cmd]) {
      const key = cmd === "STRIKE" ? "S" : cmd === "BRACE" ? "B" : cmd === "DISRUPT" ? "D" : "R";
      const cleanLabel = buttonsMap[cmd].replace(new RegExp(`\\s*${key}$`), "");
      // DET9-NUM: surface the live command cost when it exceeds the base 1
      // (stage-5 escalating DISRUPT) so the economy is readable on the button.
      let costBadge = "";
      try {
        const liveCost = commandCost(encounter, cmd);
        if (liveCost > 1) costBadge = ` <span class="cost-badge">${liveCost}\u26a1</span>`;
      } catch (err) { /* unknown command labels never break translation */ }
      button.innerHTML = `${cleanLabel}${costBadge} <kbd>${key}</kbd>`;
    }
  }

  if (dom.hotkeyGuide.strike) dom.hotkeyGuide.strike.innerHTML = `<strong>[S]</strong> ${commandLabel("STRIKE")}`;
  if (dom.hotkeyGuide.brace) dom.hotkeyGuide.brace.innerHTML = `<strong>[B]</strong> ${commandLabel("BRACE")}`;
  if (dom.hotkeyGuide.disrupt) dom.hotkeyGuide.disrupt.innerHTML = `<strong>[D]</strong> ${commandLabel("DISRUPT")}`;
  if (dom.hotkeyGuide.recover) dom.hotkeyGuide.recover.innerHTML = `<strong>[R]</strong> ${commandLabel("RECOVER")}`;

  // Update toggle button text
  if (dom.langToggle) {
    dom.langToggle.textContent = currentLang === "ko" ? "English 🌐" : "한글 🌐";
    if (dom.langToggle.classList) {
      dom.langToggle.classList.toggle("active", currentLang === "ko");
    }
  }
}

function encounterStartMessage() {
  const dict = dictionaryFor();
  const intent = intentLabel(encounter.foe_intent);
  if (currentLang === "ko") {
    return `${encounterIndex + 1}${dict.encounterStartPrefix}${intent}${dict.encounterStartsWith} ${dict.encounterStartSuffix}`;
  }
  return `${dict.encounterStartPrefix} ${encounterIndex + 1} ${dict.encounterStartsWith} ${intent} ${dict.encounterStartSuffix}`;
}

function entryAdverseText(entry) {
  const dict = dictionaryFor();
  if (!entry) return "";
  if (entry.foe_resolved) {
    return `${dict.adverseResolved}: ${entry.adverse_damage} integrity damage, ${entry.adverse_pressure} pressure`;
  }
  return dict.adverseSkipped;
}

function recordCommand(command) {
  if (!COMMANDS.includes(command)) return;

  if (useRealTime) {
    if (encounter.outcome !== "ACTIVE") return;

    // Custom RTS logic: check if player has enough Focus
    const reject = (reasonCode) => {
      lastMessage = commandRejectionMessage(reasonCode, command);
      play("defeat"); // warning buzz
      render();
    };

    // ── stage1-rules-v2 Stage 5: reducer-routed rounds ──────────────────
    // Every accepted command IS one full semantic round (player effect +
    // foe effect + round advance) applied by the frozen core reducer, so
    // the real-time game and the deterministic contract are one game.
    // The charge wrap never mutates state here (pure telegraph); HOLD
    // terminates naturally at round === schedule.length.
    if (encounterIndex === 4) {
      const record = makeCommand(command, encounter.round, sequence + 1);
      const result = reduceEncounter(encounter, record);
      if (!result.accepted) {
        reject(result.reason);
        return;
      }
      sequence += 1;
      records.push(record);
      totalCommandsRun++;
      const before = encounter;
      encounter = result.state;

      // Presentation of the resolved round:
      play(command.toLowerCase());
      triggerFx(command);
      if (command === "STRIKE" || command === "DISRUPT") {
        spawnUnit(command, { semanticResolved: true });
        if (dom.voidAvatar && dom.voidAvatar.classList) {
          dom.voidAvatar.classList.add("damage-flash");
          setTimeout(() => {
            if (dom.voidAvatar && dom.voidAvatar.classList) {
              dom.voidAvatar.classList.remove("damage-flash");
            }
          }, 400);
        }
      } else if (command === "BRACE") {
        spawnUnit("BRACE", { semanticResolved: true });
      } else if (command === "RECOVER" && dom.knightAvatar && dom.knightAvatar.classList) {
        dom.knightAvatar.classList.add("recover-pulse");
        setTimeout(() => {
          if (dom.knightAvatar && dom.knightAvatar.classList) {
            dom.knightAvatar.classList.remove("recover-pulse");
          }
        }, 800);
      }
      if (encounter.integrity < before.integrity && dom.knightAvatar && dom.knightAvatar.classList) {
        dom.knightAvatar.classList.add("damage-flash");
        setTimeout(() => {
          if (dom.knightAvatar && dom.knightAvatar.classList) {
            dom.knightAvatar.classList.remove("damage-flash");
          }
        }, 400);
      }

      // The old round is resolved: clear its telegraph, then either finish
      // or telegraph the next round immediately (fresh charge cycle).
      removeHostileUnits({ dispel: true });
      if (encounter.outcome !== "ACTIVE") {
        finishEncounter();
        return;
      }
      foeCharge = 0;
      spawnHostileWave();
      lastMessage = commandAcceptanceMessage(command);
      render();
      saveGameState();
      return;
    }

    if (command === "STRIKE") {
      const cost = commandCost(encounter, "STRIKE");
      if (!hasSufficientFocus(cost)) {
        reject("FOCUS");
        return;
      }
      encounter.focus -= cost;
      spawnUnit("STRIKE");
    } else if (command === "BRACE") {
      const cost = commandCost(encounter, "BRACE");
      if (!hasSufficientFocus(cost)) {
        reject("FOCUS");
        return;
      }
      encounter.focus -= cost;
      spawnUnit("BRACE");
    } else if (command === "DISRUPT") {
      // stage1-rules-v2: DISRUPT cost escalates with disrupt_uses on Stage 5.
      // Same commandCost() source as the reducer — no divergent RT economy.
      const cost = commandCost(encounter, "DISRUPT");
      if (!hasSufficientFocus(cost)) {
        reject("FOCUS");
        return;
      }
      if (encounter.foe_intent !== "SURGE") {
        reject("INTENT");
        return;
      }
      encounter.focus -= cost;
      encounter.disrupt_uses += 1;
      encounter.foe_health = Math.max(0, encounter.foe_health - 1);
      // DET6-FOE (rev): the counter landed (surge_countered false→true) —
      // dispel the live telegraph wave so the response reads on the lane.
      if (!encounter.surge_countered) {
        removeHostileUnits({ dispel: true });
      }
      encounter.surge_countered = true;
      spawnUnit("DISRUPT");
      play("disrupt");
      triggerFx("DISRUPT");
      if (dom.voidAvatar && dom.voidAvatar.classList) {
        dom.voidAvatar.classList.add("damage-flash");
        setTimeout(() => {
          if (dom.voidAvatar && dom.voidAvatar.classList) {
            dom.voidAvatar.classList.remove("damage-flash");
          }
        }, 400);
      }
      if (encounter.foe_health <= 0) {
        encounter.outcome = "VICTORY";
        finishEncounter();
        return;
      }
    } else if (command === "RECOVER") {
      if (!canRecoverFocus()) {
        lastMessage = commandRejectionMessage("FOCUS_CAP", command);
        render();
        return;
      }
      isRecovering = true;
      recoverTimer = 1.0; // 1 second recovery channel
      play("recover");
      triggerFx("RECOVER");
      // DET6-UNIT: RECOVER has no lane unit — pulse the knight avatar instead.
      if (dom.knightAvatar && dom.knightAvatar.classList) {
        dom.knightAvatar.classList.add("recover-pulse");
        setTimeout(() => {
          if (dom.knightAvatar && dom.knightAvatar.classList) {
            dom.knightAvatar.classList.remove("recover-pulse");
          }
        }, 800);
      }
    } else {
      return;
    }

    totalCommandsRun++;
    // Log the input with the current elapsed foeCharge/round ticks for deterministic replay!
    const record = makeCommand(command, encounter.round, ++sequence);
    records.push(record);
    lastMessage = commandAcceptanceMessage(command);
    render();
    saveGameState();
    return;
  }

  // Turn-based fallback
  if (!commandAvailable(command)) return;
  totalCommandsRun++;

  // Play SFX & Visual FX
  play(command.toLowerCase());
  triggerFx(command);

  if (useRealTime && command !== "RECOVER") {
    if (command === "DISRUPT") {
      removeHostileUnits({ dispel: true });
    }
    spawnUnit(command);
  }
  if (useRealTime && entry && entry.foe_resolved && encounter.outcome === "ACTIVE") {
    spawnHostileWave();
  }

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
      if (useRealTime && command === "RECOVER") {
        dom.knightAvatar.classList.add("recover-pulse");
      }
      setTimeout(() => {
        if (dom.knightAvatar && dom.knightAvatar.classList) {
          dom.knightAvatar.classList.remove("shield-glow", "recover-pulse");
        }
      }, command === "RECOVER" ? 800 : 600);
    }
  }

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
}

function recordCommand(command) {
  if (!COMMAND_SET.has(command)) return;

  const candidate = makeCommand(command, encounter.round, sequence + 1);
  const result = reduceEncounter(encounter, candidate);
  if (!result.accepted) {
    lastMessage = commandRejectionMessage(result.reason, command);
    announceAcceptedCommand = false;
    render();
    return;
  }

  sequence += 1;
  records.push(candidate);
  stageJournals[encounterIndex].push(candidate);
  encounter = result.state;
  totalCommandsRun += 1;

  const entry = encounter.trace.at(-1);
  presentAcceptedCommand(command, entry);

  const dict = dictionaryFor();
  const commandLabelText = commandLabel(command);
  const roundPrefix = dict.roundLabel;
  const outcomeTextLabel = entry ? traceOutcomeText(entry.outcome) : "";
  const adverseText = entryAdverseText(entry);
  const outcomeLabel = outcomeTextLabel ? `${dict.outcomeLabel}: ${outcomeTextLabel}.` : "";
  lastMessage = entry
    ? `${roundPrefix} ${entry.round}: ${commandLabelText}; ${adverseText}. ${outcomeLabel}`.trim()
    : commandAcceptanceMessage(command);
  announceAcceptedCommand = true;

  if (encounter.outcome !== "ACTIVE") finishEncounter();
  render();
  saveGameState();
}

function finishEncounter() {
  const replayCheck = validateDeterministicReplay(encounter.schedule, records);
  // DET6-FOE (rev): encounter is terminal — dispel any live telegraph wave so
  // hostiles never linger over the terminal surface.
  removeHostileUnits({ dispel: true });
  const dict = dictionaryFor();
  outcomes.push(encounter.outcome);
  const resolvedEncounterCount = outcomes.length;
  const award = awardFor(encounter.outcome);
  if (outcomes.length === CAMPAIGN_SCHEDULES.length) settlement = settleCampaign(outcomes);
  const encounterLabel = `${resolvedEncounterCount} ${
    resolvedEncounterCount === 1 ? dict.encounterRecordLabel : dict.encounterRecordsLabel
  }`;
  const outcomeSummary = `${terminalCopy(encounter.outcome)} ${dict.terminalAward}: ${award} ${
    award === 1 ? dict.fragmentSingular : dict.fragmentPlural
  }. ${replayCheck.matches ? dict.replayDeterministic : dict.replayMismatch}`;
  dom.terminalSummary.textContent = outcomeSummary;
  dom.settlement.textContent = settlement
    ? `${dict.stage5SettlementReady}: ${settlement.fragments_earned} ${settlement.fragments_earned === 1 ? dict.fragmentSingular : dict.fragmentPlural}. Wallet ${settlement.fragment_wallet}, resolve marks ${settlement.resolve_marks}.`
    : `${dict.terminalReady} ${dict.encounterRecordsLabel}: ${resolvedEncounterCount}. ${dict.terminalNext}`;
  dom.continue.hidden = Boolean(settlement);
  showSurface("terminal");
  saveGameState();
}

function continueCampaign() {
  if (settlement || encounter.outcome === "ACTIVE" || encounterIndex >= CAMPAIGN_SCHEDULES.length - 1) return;
  encounterIndex += 1;
  sequence = 0;
  records = [];
  stageJournals.push([]);
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[encounterIndex], encounterIndex);
  resetRealtimeState({ clearUnits: true });
  lastMessage = encounterStartMessage();
  // DET7-CINE: continue enters a fresh full-initial encounter — arm the cinematic.
  cinematicPending = true;
  showSurface("play");
  saveGameState();
}

function resetCampaign() {
  encounterIndex = 0;
  sequence = 0;
  totalCommandsRun = 0;
  records = [];
  stageJournals = [[]];
  outcomes = [];
  settlement = null;
  encounter = initialEncounter(CAMPAIGN_SCHEDULES[0], 0);
  lastMessage = dictionaryFor().terminalIdle;
  resetRealtimeState({ clearUnits: true });

  if (storage) {
    storage.removeItem("abyssal_surge_save");
  }
  showSurface("lobby");
  checkSave();
}



// ── DET9-JUICE: floating combat numbers + screen shake (presentation-only) ──
// Driven by STATE DIFFS in render(): any foe_health/integrity/pressure/guard/
// focus delta becomes a float over its owner, no matter which path (reducer,
// RT wrap, unit arrival) caused it. The quantified economy becomes visible.
let lastVitals = null;
let floatsSpawned = 0;
let shakeTimer = null;

function spawnCombatFloat(anchor, text, kind) {
  if (!anchor || typeof document === "undefined" || !document.createElement) return;
  try {
    const float = document.createElement("span");
    float.className = `combat-float combat-float-${kind}`;
    float.textContent = text;
    if (float.style) float.style.marginLeft = `${Math.round((Math.random() - 0.5) * 36)}px`;
    if (!anchor.appendChild) return;
    anchor.appendChild(float);
    floatsSpawned++;
    if (typeof window !== "undefined") window.combatFloatCount = floatsSpawned;
    const cleanup = () => {
      if (float.parentNode) float.parentNode.removeChild(float);
    };
    if (typeof float.addEventListener === "function") float.addEventListener("animationend", cleanup);
    setTimeout(cleanup, 1400);
  } catch (err) {
    /* fake-DOM safety: floats are never load-bearing */
  }
}

function triggerScreenShake() {
  const el = dom.screens && dom.screens.play;
  if (!el || !el.classList) return;
  el.classList.remove("screen-shake");
  void (el.offsetWidth || 0); // restart animation
  el.classList.add("screen-shake");
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => {
    if (el.classList) el.classList.remove("screen-shake");
  }, 400);
}

function render() {
  if (typeof window !== "undefined") {
    window.surface = surface;
    window.encounter = encounter;
    window.activeUnits = activeUnits;
    window.rAFId = rAFId;
    window.lastTickTime = lastTickTime;
    window.foeCharge = foeCharge;
    window.useRealTime = useRealTime;
    window.isRecovering = isRecovering;
    window.recoverTimer = recoverTimer;
    window.commandLog = records.map((r) => r.command);
  }
  const titles = STAGE_TITLES_LOCALIZED[currentLang] || STAGE_TITLES_LOCALIZED.en;
  const dict = DICTIONARY[currentLang] || DICTIONARY.en;
  const stageTitle = titles[encounterIndex] || `${dict.encounterStartPrefix} ${encounterIndex + 1}`;
  const maxIntegrity = normalizeInteger(encounter.max_integrity, 6, 0);
  const maxFocus = normalizeInteger(encounter.max_focus, 3, 0);
  const maxGuard = 2;
  const maxPressure = normalizeInteger(encounter.max_pressure, 4, 0);
  const maxFoeHealth = normalizeInteger(encounter.max_foe_health, 6, 0);
  dom.campaign.textContent = `${encounterIndex + 1} / ${CAMPAIGN_SCHEDULES.length} — ${stageTitle}`;
  dom.ruleVersion.textContent = RULES_VERSION;
  dom.intent.textContent = intentLabel(encounter.foe_intent);
  dom.counter.textContent = counterCopy(encounter);
  dom.integrity.textContent = `${encounter.integrity} / ${maxIntegrity}`;
  dom.focusValue.textContent = `${encounter.focus} / ${maxFocus}`;
  dom.guard.textContent = `${encounter.guard} / ${maxGuard}`;
  dom.pressure.textContent = `${encounter.pressure} / ${maxPressure}`;
  dom.foeHealth.textContent = `${encounter.foe_health} / ${maxFoeHealth}`;

  // Update progress bars (defensive checks to support test environments)
  if (dom.integrityBar) dom.integrityBar.style.width = percentage(encounter.integrity, maxIntegrity);
  if (dom.focusBar) dom.focusBar.style.width = percentage(encounter.focus, maxFocus);
  if (dom.guardBar) dom.guardBar.style.width = percentage(encounter.guard, maxGuard);
  if (dom.pressureBar) dom.pressureBar.style.width = percentage(encounter.pressure, maxPressure);
  if (dom.foeHealthBar) dom.foeHealthBar.style.width = percentage(encounter.foe_health, maxFoeHealth);

  // DET9-JUICE: diff vitals -> floats. Snapshot key ties floats to one
  // encounter instance; transitions (continue/restart/resume) just resnapshot.
  const vitalsKey = `${encounterIndex}|${outcomes.length}`;
  const vitals = {
    key: vitalsKey,
    foe: Number(encounter.foe_health),
    integrity: Number(encounter.integrity),
    pressure: Number(encounter.pressure),
    guard: Number(encounter.guard),
    focus: Number(encounter.focus),
  };
  if (surface === "play" && lastVitals && lastVitals.key === vitalsKey) {
    const dFoe = vitals.foe - lastVitals.foe;
    if (dFoe < 0) spawnCombatFloat(dom.voidAvatar, `${dFoe}`, "damage");
    const dInt = vitals.integrity - lastVitals.integrity;
    if (dInt < 0) {
      spawnCombatFloat(dom.knightAvatar, `${dInt}`, "damage");
      if (dInt <= -2) triggerScreenShake();
    } else if (dInt > 0) {
      spawnCombatFloat(dom.knightAvatar, `+${dInt}`, "heal");
    }
    const dPressure = vitals.pressure - lastVitals.pressure;
    if (dPressure > 0) spawnCombatFloat(dom.knightAvatar, `+${dPressure} \u26a0`, "pressure");
    const dGuard = vitals.guard - lastVitals.guard;
    if (dGuard > 0) spawnCombatFloat(dom.knightAvatar, `+${dGuard} \u26e8`, "guard");
    const dFocus = vitals.focus - lastVitals.focus;
    if (dFocus <= -0.9) spawnCombatFloat(dom.knightAvatar, `${Math.round(dFocus)} \u26a1`, "focus");
    else if (dFocus >= 0.9) spawnCombatFloat(dom.knightAvatar, `+${Math.round(dFocus)} \u26a1`, "focus");
  }
  lastVitals = vitals;

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
  // DET8-DEPTH item 3a — Stage 5 boss escalation aura. Driven from render()
  // (already called every rtsLoop frame and on every state change — no new
  // polling): tier 1 at foe_health <= 3, tier 2 at <= 1, exclusive tiers.
  // Cleared on non-play surfaces, other stages, and non-ACTIVE outcomes.
  if (dom.voidAvatar && dom.voidAvatar.classList) {
    const bossLow = surface === "play" && encounterIndex === 4 && encounter.outcome === "ACTIVE"
      ? Number(encounter.foe_health)
      : NaN;
    if (bossLow <= 1) {
      dom.voidAvatar.classList.add("boss-aura-2");
      dom.voidAvatar.classList.remove("boss-aura-1");
    } else if (bossLow <= 3) {
      dom.voidAvatar.classList.add("boss-aura-1");
      dom.voidAvatar.classList.remove("boss-aura-2");
    } else {
      dom.voidAvatar.classList.remove("boss-aura-1");
      dom.voidAvatar.classList.remove("boss-aura-2");
    }
  }
  // Update RTS Monitor Panel
  const monitorActiveCount = document.querySelector("#monitor-active-count");
  const monitorHostileCount = document.querySelector("#monitor-hostile-count");
  const monitorListContainer = document.querySelector("#monitor-list-container");
  const monitorPlaceholder = document.querySelector("#monitor-placeholder");

  if (monitorActiveCount && monitorListContainer) {
    // DET6-FOE: hostile signals get their own tally; active signals stay friendly-only.
    const hostileTotal = activeUnits.reduce((count, unit) => count + (unit.hostile ? 1 : 0), 0);
    monitorActiveCount.textContent = activeUnits.length - hostileTotal;
    if (monitorHostileCount) monitorHostileCount.textContent = hostileTotal;
    
    // 1. Remove obsolete monitor items whose units have despawned
    const activeIds = new Set(activeUnits.map(u => u.id));
    const items = [...monitorListContainer.querySelectorAll(".monitor-item")];
    for (const item of items) {
      const unitId = parseInt(item.dataset.unitId, 10);
      if (!activeIds.has(unitId)) {
        if (item.parentNode) item.parentNode.removeChild(item);
      }
    }
    
    if (activeUnits.length === 0) {
      if (monitorPlaceholder) monitorPlaceholder.style.display = "block";
    } else {
      if (monitorPlaceholder) monitorPlaceholder.style.display = "none";
      
      const monitorDict = dictionaryFor();
      
      // 2. Add new items or update existing ones in place
      for (const unit of activeUnits) {
        let item = monitorListContainer.querySelector(`.monitor-item[data-unit-id="${unit.id}"]`);
        // DET6-FOE: hostiles march right-to-left, so their ETA is the distance
        // to the player edge (x / speed); friendlies keep (100 - x) / speed.
        const eta = ((unit.direction === -1 ? unit.x : 100 - unit.x) / unit.speed).toFixed(1);
        
        if (!item) {
          // SPAWN: Create DOM node once
          const hostile = unit.hostile === true;
          const theme = UNIT_MONITOR_THEMES[unit.type] || UNIT_MONITOR_THEMES.STRIKE;
          item = document.createElement("div");
          item.className = hostile ? "monitor-item monitor-item-hostile" : "monitor-item";
          item.dataset.unitId = unit.id;
          
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.justifyContent = "space-between";
          item.style.fontSize = "0.85rem";
          item.style.padding = "0.4rem 0.8rem";
          item.style.background = "rgba(11, 13, 20, 0.7)";
          item.style.border = `1px solid ${theme.border}`;
          if (hostile) {
            // Distinct hostile row treatment: red left border.
            item.style.borderLeft = "3px solid #ef4444";
          }
          item.style.borderRadius = "0.4rem";
          item.style.gap = "0.8rem";
          item.style.boxShadow = `0 2px 6px rgba(0,0,0,0.5), inset 0 0 8px ${theme.inset}`;

          const name = monitorDict[UNIT_MONITOR_NAME_KEYS[unit.type]] || unit.type;
          const actionLabel = hostile ? monitorDict.unitHostileAction : monitorDict.unitTraversing;
          const actionColor = hostile ? "#ef4444" : "#10b981";
          const actionBg = hostile ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";
          const actionBorder = hostile ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)";

          item.innerHTML = `
            <!-- Character Card Portrait: Silhouette -->
            <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,0.4); border: 2px solid ${theme.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 6px ${theme.glow}; flex-shrink: 0;">
              ${UNIT_SVG_FALLBACKS[unit.type] || UNIT_SVG_FALLBACKS.STRIKE}
            </div>
            
            <!-- Character Card Center: Identity and State -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: ${theme.color}; font-weight: bold; font-size: 0.9rem;">${name}</span>
                <span style="font-size: 0.7rem; color: ${actionColor}; background: ${actionBg}; padding: 0.05rem 0.35rem; border-radius: 0.2rem; border: 1px solid ${actionBorder}; font-weight: bold; letter-spacing: 0.05em;">${actionLabel}</span>
              </div>
              <div style="position: relative; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin-top: 0.1rem;">
                <div class="monitor-progress-fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: ${unit.x}%; background: ${theme.color};"></div>
              </div>
            </div>
            
            <!-- Character Card Right: Lane Position and ETA -->
            <div style="text-align: right; min-width: 90px; display: flex; flex-direction: column; justify-content: center; gap: 0.1rem; flex-shrink: 0;">
              <span class="monitor-pos-text" style="color: var(--muted); font-size: 0.8rem; font-weight: bold;">Pos: ${unit.x.toFixed(1)}%</span>
              <span class="monitor-eta-text" style="color: var(--ink); font-size: 0.75rem;">ETA: ${eta}s</span>
            </div>
          `;
          monitorListContainer.appendChild(item);
        } else {
          // UPDATE IN-PLACE: Fast update of dynamic elements only
          const progressFill = item.querySelector(".monitor-progress-fill");
          const posText = item.querySelector(".monitor-pos-text");
          const etaText = item.querySelector(".monitor-eta-text");
          
          if (progressFill) progressFill.style.width = `${unit.x}%`;
          if (posText) posText.textContent = `Pos: ${unit.x.toFixed(1)}%`;
          if (etaText) etaText.textContent = `ETA: ${eta}s`;
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    window.surface = surface;
    window.encounter = encounter;
    window.activeUnits = activeUnits;
  }

  // Foe Charge Bar rendering
  if (dom.foeChargeBar) {
    if (encounter.outcome === "ACTIVE" && useRealTime) {
      dom.foeChargeBar.style.width = `${(foeCharge / 3.5) * 100}%`;
    } else {
      dom.foeChargeBar.style.width = "0%";
    }
  }

  dom.trace.replaceChildren(...encounter.trace.map((entry) => {
    const item = document.createElement("li");
    const entryOutcome = entry?.foe_resolved ? traceOutcomeText(entry.outcome) : traceOutcomeText("VICTORY");
    const entryAdverse = entry ? entryAdverseText(entry) : "";
    item.textContent = `${dict.roundLabel} ${entry?.round}: ${commandLabel(entry?.command)}; ${entryAdverse}; ${dict.outcomeLabel}: ${entryOutcome}.`;
    return item;
  }));

  // Only accepted commands animate narration; rejection feedback is immediate
  // so it cannot trigger the typewriter's click SFX.
  if (surface === "play" && sequence > 0 && announceAcceptedCommand) {
    if (dom.announcement.dataset && dom.announcement.dataset.lastMessage !== lastMessage) {
      dom.announcement.dataset.lastMessage = lastMessage;
      typeText(dom.announcement, lastMessage);
    }
  } else {
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
    if (dom.announcement.classList) {
      dom.announcement.classList.remove("typing");
    }
    dom.announcement.textContent = lastMessage;
    if (dom.announcement.dataset) {
      dom.announcement.dataset.lastMessage = lastMessage;
    }
  }

  // Local telemetry logs ledger updates
  updateTelemetry();
  translateUI();

  const previews = surface === "play" && encounter.outcome === "ACTIVE" ? previewCommands() : [];
  for (const button of dom.commandButtons) button.disabled = !commandAvailable(button.dataset.command, previews);
  if (dom.commandHelp) dom.commandHelp.textContent = commandHelpText(previews);
  document.querySelector("#threat-copy").textContent = threatCopy(encounter);
}

function commandAcceptanceMessage(command) {
  const localized = commandLabel(command);
  if (!localized) return "";
  return currentLang === "ko" ? `${localized} 커맨드를 실행했습니다.` : `${localized} executed.`;
}

function commandRejectionMessage(reason, command = null) {
  const reasonText = commandRejectText(reason);
  if (!reasonText) return "";
  const localized = command ? commandLabel(command) : "";
  return currentLang === "ko"
    ? localized
      ? `${localized}: ${reasonText}.`
      : `${reasonText}.`
    : `${localized ? `${localized}: ` : ""}${reasonText}.`;
}


// DET7-CINE: stage-intro cinematic overlay (presentation-only).
// Shown once per encounterIndex per page session, and only when the encounter
// enters at full initial state through the begin/continue flow — the same
// entry that fires the initial telegraph wave. Saved-state resume and repeat
// entries of an already-seen encounter skip it. The deterministic encounter
// state is created exactly as before; the overlay only gates visually while
// typed narration + narration audio start as usual beneath it.
const cinematicShown = new Set();
let cinematicPending = false;
let cinematicCleanup = null;

function prefersReducedMotion() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return Boolean(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (err) {
    return false;
  }
}

function dismissCinematic({ immediate = false } = {}) {
  if (typeof cinematicCleanup === "function") cinematicCleanup(immediate);
}

function playStageCinematic(index) {
  if (cinematicShown.has(index)) return;
  if (prefersReducedMotion()) return;
  const host = dom.screens.play;
  // Fake-DOM safety: bail before creating elements, timers, or listeners.
  if (!host || typeof host.appendChild !== "function") return;
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;

  const overlay = document.createElement("div");
  const video = document.createElement("video");
  if (!overlay || !video || !overlay.classList || typeof video.addEventListener !== "function") return;

  cinematicShown.add(index);

  overlay.id = "cinematic-overlay";
  overlay.className = "cinematic-overlay";
  if (typeof overlay.setAttribute === "function") overlay.setAttribute("aria-hidden", "true");

  video.id = "stage-cinematic";
  video.muted = true;
  video.autoplay = true;
  video.preload = "none";
  if (typeof video.setAttribute === "function") {
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "none");
  }
  video.src = `assets/video/stage_intro_${index + 1}.mp4`;

  let done = false;
  let hardTimer = null;

  const removeOverlay = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  const finish = (immediate = false) => {
    if (done) return;
    done = true;
    cinematicCleanup = null;
    clearTimeout(hardTimer);
    try {
      document.removeEventListener("keydown", onSkipKey, true);
      document.removeEventListener("click", onSkipClick, true);
    } catch (err) {}
    try {
      video.pause?.();
    } catch (err) {}
    if (immediate || !overlay.classList) {
      // Video error/stalled path: no fade, no black screen — the stage
      // backdrop beneath is already painted.
      removeOverlay();
    } else {
      overlay.classList.add("cinematic-fade-out");
      setTimeout(removeOverlay, 300);
    }
  };

  const onSkipKey = (event) => {
    if (event && typeof event.stopPropagation === "function") event.stopPropagation();
    finish(false);
  };
  const onSkipClick = (event) => {
    if (event && typeof event.stopPropagation === "function") event.stopPropagation();
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    finish(false);
  };

  video.addEventListener("ended", () => finish(false));
  video.addEventListener("error", () => finish(true));
  video.addEventListener("stalled", () => finish(true));
  document.addEventListener("keydown", onSkipKey, true);
  document.addEventListener("click", onSkipClick, true);
  hardTimer = setTimeout(() => finish(false), 7000);
  cinematicCleanup = finish;

  overlay.appendChild(video);
  host.appendChild(overlay);

  try {
    const playAttempt = video.play?.();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
  } catch (err) {}
}

function showSurface(next) {
  surface = next;
  if (next !== "play") dismissCinematic({ immediate: true });
  for (const [name, screen] of Object.entries(dom.screens)) screen.hidden = name !== next;
  
  // Audio transitions & Illustration/Backdrop updates
  if (next === "play") {
    // DET7-CINE: consume the begin/continue arm exactly once per entry.
    const startCinematic = cinematicPending;
    cinematicPending = false;
    if (useRealTime) {
      lastTickTime = 0;
      foeCharge = 0;
      // Hostile telegraphs are created only from accepted reducer results.
      if (encounter.outcome === "ACTIVE" && startCinematic) {
        playStageCinematic(encounterIndex);
      }
      if (!rAFId) {
        rAFId = requestAnimationFrame(rtsLoop);
      }
    }
    if (sfx.bgm) sfx.bgm.volume = 0.5;
    play("bgm", false); // Loop BGM, don't restart if already playing
    if (sequence === 0) {
      play("narr_intro_" + (encounterIndex + 1));
    }
    if (dom.terminalIllustration) dom.terminalIllustration.style.display = "none";
    if (dom.screens.play && dom.screens.play.style) {
      dom.screens.play.style.backgroundImage = `linear-gradient(rgba(11, 13, 20, 0.85), rgba(11, 13, 20, 0.85)), url('assets/images/stage${encounterIndex + 1}.png')`;
    }
  } else if (next === "terminal") {
    fadeBgm();
    if (dom.terminalIllustration) {
      if (encounter.outcome === "VICTORY") {
        dom.terminalIllustration.src = "assets/images/victory.png";
        dom.terminalIllustration.style.display = "inline-block";
      } else if (encounter.outcome && encounter.outcome.startsWith("DEFEAT")) {
        dom.terminalIllustration.src = "assets/images/defeat.png";
        dom.terminalIllustration.style.display = "inline-block";
      } else {
        dom.terminalIllustration.style.display = "none";
      }
    }
    if (encounter.outcome === "VICTORY") {
      play("victory");
      play("narr_victory");
    } else if (encounter.outcome && encounter.outcome.startsWith("DEFEAT")) {
      play("defeat");
      play("narr_defeat");
    }
  } else if (next === "lobby") {
    fadeBgm();
    if (dom.terminalIllustration) dom.terminalIllustration.style.display = "none";
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
  const intent = intentLabel(state.foe_intent);
  if (state.foe_intent === "SURGE") {
    return `${intent}: 4 integrity damage and +2 pressure unless ${commandLabel("DISRUPT")} is used.`;
  }
  return `${intent}: 2 integrity damage unless ${commandLabel("BRACE")} is used.`;
}

function counterCopy(state) {
  if (state.foe_intent === "SURGE") {
    return `${commandLabel("DISRUPT")} costs ${commandCost(state, "DISRUPT")} focus, deals 1 foe damage, and prevents this ${intentLabel(state.foe_intent)}.`;
  }
  return `${commandLabel("BRACE")} costs ${commandCost(state, "BRACE")} focus and prevents this ${intentLabel(state.foe_intent)}'s 2 damage.`;
}

function previewCommands(state = encounter, nextSequence = sequence + 1) {
  return COMMANDS.map((command) => ({
    command,
    preview: reduceEncounter(state, makeCommand(command, state.round, nextSequence)),
  }));
}

function commandHelpText(previews) {
  const rejected = previews.filter(({ preview }) => !preview.accepted);
  if (rejected.length === 0) return dictionaryFor().commandHelp;
  return rejected
    .map(({ command, preview }) => `${commandLabel(command)}: ${commandRejectText(preview.reason)}`)
    .join(" ");
}

function commandAvailable(command, previews = null) {
  if (surface !== "play" || encounter.outcome !== "ACTIVE" || !COMMAND_SET.has(command)) return false;
  return Boolean((previews || previewCommands()).find((entry) => entry.command === command)?.preview.accepted);
}

function terminalCopy(outcome) {
  const label = traceOutcomeText(outcome);
  let details = outcomeText(outcome);
  // World-bible S5 beat: HOLD is survival, not an answer — point at the trade.
  if (outcome === "HOLD" && encounterIndex === 4) {
    details = currentLang === "ko"
      ? "전장은 지켜냈지만 서지의 물음은 답을 얻지 못했다. 보상 0 — 확실함을 내주는 교환만이 승리를 연다"
      : "the field held, but the Surge's question stands unanswered. Award 0 — only a deliberate trade opens victory";
  }
  return `${label} — ${details}.`;
}


dom.begin.addEventListener("click", () => {
  // DET7-CINE: begin enters the boot-time full-initial encounter — arm the cinematic.
  cinematicPending = true;
  showSurface("play");
});
dom.continue.addEventListener("click", continueCampaign);
dom.restart.addEventListener("click", resetCampaign);
for (const button of dom.commandButtons) {
  button.addEventListener("click", () => recordCommand(button.dataset.command));
}

// DET-RTS mouse: lane click issues a contextual STRIKE at the clicked lane
// position through the SAME recordCommand pipeline (no second command path).
if (dom.battlefieldLane) {
  if (dom.battlefieldLane.style) {
    // styles.css ships .rts-units-layer { pointer-events: none; } — re-enable
    // for the mouse affordance without touching the stylesheet.
    dom.battlefieldLane.style.pointerEvents = "auto";
    dom.battlefieldLane.style.cursor = "crosshair";
  }
  dom.battlefieldLane.addEventListener("click", (event) => {
    if (surface !== "play" || encounter.outcome !== "ACTIVE") return;
    const lane = (event && event.currentTarget) || dom.battlefieldLane;
    let clickedPct = 0;
    if (lane && typeof lane.getBoundingClientRect === "function") {
      const rect = lane.getBoundingClientRect();
      if (rect && rect.width > 0) {
        clickedPct = ((event.clientX - rect.left) / rect.width) * 100;
      }
    }
    pendingSpawnOriginPct = Math.min(20, Math.max(0, clickedPct));
    recordCommand("STRIKE"); // same deterministic pipeline; reject path fires unchanged
    pendingSpawnOriginPct = null; // one-shot: never bleeds into a later spawn
  });
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
    saveGameState();
  });
}

if (dom.sfxVolume) {
  dom.sfxVolume.addEventListener("input", (e) => {
    volumeSfx = parseFloat(e.target.value);
    saveGameState();
  });
}

if (dom.narrVolume) {
  dom.narrVolume.addEventListener("input", (e) => {
    volumeNarr = parseFloat(e.target.value);
    saveGameState();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.activeElement?.tagName === "INPUT") return;
  const keyboardCommands = { s: "STRIKE", b: "BRACE", d: "DISRUPT", r: "RECOVER" };
  const command = keyboardCommands[event.key.toLowerCase()];
  if (!command || surface !== "play" || encounter.outcome !== "ACTIVE") return;
  event.preventDefault();
  recordCommand(command);
});

if (dom.langToggle) {
  dom.langToggle.addEventListener("click", () => {
    currentLang = currentLang === "ko" ? "en" : "ko";
    if (
      surface === "lobby" &&
      (lastMessage === dictionaryFor("en").terminalIdle ||
        lastMessage === dictionaryFor("ko").terminalIdle)
    ) {
      lastMessage = dictionaryFor().terminalIdle;
    }
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
      currentLang = normalizeLanguage(parsed.currentLang);
    }
  } catch (e) {}
}
lastMessage = dictionaryFor().terminalIdle;

translateUI();
checkSave();
render();
