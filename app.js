import {
  RULES_VERSION,
  STAGES,
  applyAction,
  applyEncounterEvent,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  getAvailableActions,
  getCampaignBenefits,
  getStageChecklist,
  restoreSaveEnvelope,
  retryStage,
  startCampaign
} from "./campaign-state.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { RealtimeBattle } from "./battle-realtime-three.js";
import { getBattlePresentation } from "./battle-presentation.js";
import { CampaignMirror } from "./campaign-sync.js";
import { currentLang, translate, translations } from "./i18n.js";

const BUILD_TAG = "abyssal-surge-static-v37";
const DB_NAME = "abyssal-surge-campaign";
const DB_VERSION = 1;
const STORE_NAME = "campaigns";
const PRIMARY_KEY = "primary";
const FALLBACK_KEY = "abyssal-surge-campaign-fallback-v1";
const MAX_IMPORT_BYTES = 256 * 1024;
const REWARD_ART_IDS = new Set(["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"]);
const ACTION_KEYS = Object.freeze({ h: "hunt", e: "extract", m: "materialize", c: "capture", p: "possess", d: "domain", a: "assault" });
const BATTLE_ACTION_SEMANTICS = Object.freeze({
  hunt: Object.freeze({ source: "portal", target: "extractor", actor: "commander", actorClip: "Special", sourceAsset: "shade", clip: "Special" }),
  extract: Object.freeze({ source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" }),
  materialize: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" }),
  capture: Object.freeze({ source: "portal", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "command-obelisk", clip: "Activate" }),
  possess: Object.freeze({ source: "portal", target: "ally", actor: "commander", actorClip: "Special", sourceAsset: "possessed", clip: "Special" }),
  domain: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "echo-throne", clip: "Activate" }),
  assault: Object.freeze({ source: "ally", target: "boss", actor: "commander", actorClip: "Strike", sourceAsset: "shade", clip: "Strike" }),
});
const COOLDOWN_SECONDS = Object.freeze({
  hunt: 4,
  extract: 6,
  materialize: 5,
  capture: 8,
  possess: 10,
  domain: 15,
  assault: 3
});
const RESUME_STATUS_KEYS = Object.freeze({
  briefing: "lobby.resumeStatus.briefing",
  active: "lobby.resumeStatus.active",
  reward: "lobby.resumeStatus.reward",
  defeat: "lobby.resumeStatus.defeat",
  "campaign-complete": "lobby.resumeStatus.campaignComplete"
});
const BOSS_SPEC = Object.freeze([
  Object.freeze({ threat: "Class A", counter: 1, lore: "The forge bridge's ashbound sentinel breaks intruders against the drowned iron." }),
  Object.freeze({ threat: "Class S", counter: 2, lore: "A tactician of listening stone that turns every uncovered route into a killing field." }),
  Object.freeze({ threat: "Class Sovereign", counter: 8, lore: "The final gate's remembered ruler, holding back the last abyssal tide." }),
  Object.freeze({ threat: "Class A+", counter: 2, lore: "A drowned warden whose coral-fused armor drags whole companies beneath the breakwater." }),
  Object.freeze({ threat: "Class S", counter: 3, lore: "The pack's crowned herald; every howl is a marching order for the ruin district." }),
  Object.freeze({ threat: "Class S+", counter: 4, lore: "Three grave-choristers fused into one requiem that sings marching legions apart." }),
  Object.freeze({ threat: "Class SS", counter: 5, lore: "A canal tyrant strung with tribute lanterns, each one a soul still paying the toll." }),
  Object.freeze({ threat: "Class SS", counter: 6, lore: "The last watch-colossus of the broken span, still holding a bridge that no longer exists." }),
  Object.freeze({ threat: "Class SSS", counter: 7, lore: "Three veiled signatories who countersign the abyss itself against every intruder." }),
  Object.freeze({ threat: "Class Zenith", counter: 9, lore: "The regent above every drowned gate, wearing the storm as a crown and the tide as a writ." })
]);
const CUE_BY_EFFECT = Object.freeze({
  hunt: "assets/audio/hunt.mp3",
  extract: "assets/audio/extract.mp3",
  materialize: "assets/audio/materialize.mp3",
  capture: "assets/audio/capture.mp3",
  possess: "assets/audio/possess.mp3",
  domain: "assets/audio/domain.mp3",
  assault: "assets/audio/assault.mp3",
  reward: "assets/audio/reward.mp3"
});
const NARRATION = Object.freeze({
  intro: Object.freeze({
    audio: "assets/audio/narr-intro.mp3",
    lines: Object.freeze(["심연의 문이 열렸다.", "그림자 군주여, 일어나라."]),
    msPerChar: 45,
    holdMs: 1400
  }),
  "cinder-span": Object.freeze({
    audio: "assets/audio/narr-stage1.mp3",
    lines: Object.freeze(["잿빛 교량, 신더 스팬.", "재의 메아리를 사냥하고 영혼을 거두어라."]),
    msPerChar: 45,
    holdMs: 2085
  }),
  "veil-citadel": Object.freeze({
    audio: "assets/audio/narr-stage2.mp3",
    lines: Object.freeze(["장막 성채, 베일 시타델.", "빙의의 힘이 깨어난다.", "두 거점을 동시에 장악하라."]),
    msPerChar: 45,
    holdMs: 2014
  }),
  "echo-throne": Object.freeze({
    audio: "assets/audio/narr-stage3.mp3",
    lines: Object.freeze(["메아리 왕좌.", "군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  // Stages 4-10: text narration ships now; audio lines land with the next
  // recording batch (playNarration skips audio when the field is absent).
  "sunken-bastion": Object.freeze({
    lines: Object.freeze(["가라앉은 보루, 선큰 바스티온.", "방파제 위에서 조수의 감시자를 수장시켜라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "howling-sprawl": Object.freeze({
    lines: Object.freeze(["울부짖는 폐허, 하울링 스프롤.", "무리의 파수꾼을 빙의해 전령의 목을 조여라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "glass-necropolis": Object.freeze({
    lines: Object.freeze(["유리 묘역, 글래스 네크로폴리스.", "두 유리 단상을 장악하고 진혼곡을 침묵시켜라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "starless-canal": Object.freeze({
    lines: Object.freeze(["별 없는 운하, 스타리스 커낼.", "군주의 영역이 돌아온다. 폭군의 등불을 모두 꺼라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "shattered-causeway": Object.freeze({
    lines: Object.freeze(["부서진 둑길, 섀터드 코즈웨이.", "다리를 지키는 거상을 그 다리 아래로 무너뜨려라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "abyss-chancel": Object.freeze({
    lines: Object.freeze(["심연 예배당, 어비스 챈슬.", "세 의식 단상을 모두 점거하고 계약을 파기하라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "gate-zenith": Object.freeze({
    lines: Object.freeze(["게이트 제니스, 마지막 정점.", "모든 은총을 걸고 심연의 섭정을 unmake하라.", "문은 오늘 닫힌다."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  victory: Object.freeze({
    audio: "assets/audio/narr-victory.mp3",
    lines: Object.freeze(["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."]),
    msPerChar: 45,
    holdMs: 1452
  }),
  defeat: Object.freeze({
    audio: "assets/audio/narr-defeat.mp3",
    lines: Object.freeze(["군단의 닻이 끊어졌다.", "다시, 일어나라."]),
    msPerChar: 45,
    holdMs: 1473
  })
});
// Stage art: stages 4-10 portraits/backdrops are generated in this release;
// resolveStageArt falls back to the flagship trio until a file exists.
const BOSS_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/ui/boss-cinder-warden.png",
  "veil-citadel": "assets/images/ui/boss-veil-tactician.png",
  "echo-throne": "assets/images/ui/boss-gate-sovereign.png",
  "sunken-bastion": "assets/images/ui/boss-tide-warden.png",
  "howling-sprawl": "assets/images/ui/boss-pack-herald.png",
  "glass-necropolis": "assets/images/ui/boss-requiem-choir.png",
  "starless-canal": "assets/images/ui/boss-lantern-tyrant.png",
  "shattered-causeway": "assets/images/ui/boss-bridge-colossus.png",
  "abyss-chancel": "assets/images/ui/boss-veiled-concordat.png",
  "gate-zenith": "assets/images/ui/boss-abyss-regent.png"
});
const BOSS_FALLBACK_BY_STAGE = Object.freeze({
  "sunken-bastion": "assets/images/ui/boss-cinder-warden.png",
  "howling-sprawl": "assets/images/ui/boss-veil-tactician.png",
  "glass-necropolis": "assets/images/ui/boss-veil-tactician.png",
  "starless-canal": "assets/images/ui/boss-gate-sovereign.png",
  "shattered-causeway": "assets/images/ui/boss-cinder-warden.png",
  "abyss-chancel": "assets/images/ui/boss-gate-sovereign.png",
  "gate-zenith": "assets/images/ui/boss-gate-sovereign.png"
});
const NARRATOR_ATLAS_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/ui/narration-atlases/boss-cinder-warden-atlas.png",
  "veil-citadel": "assets/images/ui/narration-atlases/boss-veil-tactician-atlas.png",
  "echo-throne": "assets/images/ui/narration-atlases/boss-gate-sovereign-atlas.png"
});
const VIDEO_BY_STAGE = Object.freeze({
  "cinder-span": "assets/video/cinder-span.mp4",
  "veil-citadel": "assets/video/veil-citadel.mp4",
  "echo-throne": "assets/video/echo-throne.mp4"
});
const IMAGE_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/cinder-span.png",
  "veil-citadel": "assets/images/veil-citadel.png",
  "echo-throne": "assets/images/echo-throne.png",
  "sunken-bastion": "assets/images/sunken-bastion.png",
  "howling-sprawl": "assets/images/howling-sprawl.png",
  "glass-necropolis": "assets/images/glass-necropolis.png",
  "starless-canal": "assets/images/starless-canal.png",
  "shattered-causeway": "assets/images/shattered-causeway.png",
  "abyss-chancel": "assets/images/abyss-chancel.png",
  "gate-zenith": "assets/images/gate-zenith.png"
});
const TACTICAL_SURFACE = "assets/images/ui/concept-tactical-surface.webp";
const CINEMATIC_COPY = Object.freeze({
  ko: Object.freeze({
    transcriptShow: "시네마틱 시각 설명문 보기",
    transcriptHide: "시네마틱 시각 설명문 닫기",
    transcriptHeading: "시네마틱 시각 설명문",
    transcriptIntro: "시네마틱은 선택 사항입니다. 아래 설명문은 영상과 소리 없이도 캠페인 브리핑을 전달합니다.",
    transcriptBrief: "캠페인 명령: 신더 스팬의 사냥으로 시작해 메아리 왕좌를 넘어서면, 가라앉은 보루·울부짖는 폐허·유리 묘역·별 없는 운하·부서진 둑길·심연 예배당을 거쳐 게이트 제니스의 심연 섭정과 최후의 결전을 치릅니다. 총 10개 전장입니다.",
    optional: "시네마틱은 선택 사항이며 처음에는 음소거됩니다.",
    loading: "선택형 시네마틱을 불러오는 중입니다…",
    playing: "시네마틱이 음소거 상태로 재생 중입니다. 소리는 기본 컨트롤에서 켤 수 있습니다.",
    ready: "시네마틱을 재생할 준비가 되었습니다. 기본 컨트롤에서 재생을 누르세요.",
    unavailable: "시네마틱을 사용할 수 없습니다. 텍스트 캠페인 브리핑과 시각 설명문은 계속 사용할 수 있습니다."
  }),
  en: Object.freeze({
    transcriptShow: "Show cinematic visual transcript",
    transcriptHide: "Hide cinematic visual transcript",
    transcriptHeading: "Cinematic visual transcript",
    transcriptIntro: "The cinematic is optional. This transcript conveys the campaign briefing without video or sound.",
    transcriptBrief: "Campaign orders: begin with the hunt at Cinder Span, break the first three wards, then push through Sunken Bastion, Howling Sprawl, Glass Necropolis, Starless Canal, Shattered Causeway, and Abyss Chancel before facing the Abyss Regent at Gate Zenith. Ten battlefields in all.",
    optional: "The cinematic is optional and starts muted.",
    loading: "Loading optional cinematic…",
    playing: "Cinematic is playing muted. Use native controls to enable sound.",
    ready: "Cinematic is ready. Press play in its native controls.",
    unavailable: "Cinematic unavailable. The text campaign briefing and visual transcript remain available."
  })
});


class CampaignStorage {
  constructor() {
    this.db = null;
    this.mode = "memory";
    this.memory = null;
  }

  async open() {
    if (!("indexedDB" in window)) {
      this.mode = "fallback";
      return this.mode;
    }
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        // A pending deleteDatabase (e.g. another tab holding a connection)
        // queues this open indefinitely with NO event - the game would sit
        // at "Preparing local save..." forever. Fall back instead of hanging.
        const guard = window.setTimeout(() => reject(new Error("IndexedDB open timed out.")), 2500);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => { window.clearTimeout(guard); resolve(request.result); };
        request.onerror = () => { window.clearTimeout(guard); reject(request.error); };
        request.onblocked = () => { window.clearTimeout(guard); reject(new Error("IndexedDB is blocked by another tab.")); };
      });
      this.mode = "indexeddb";
    } catch {
      this.db = null;
      this.mode = "fallback";
    }
    return this.mode;
  }

  readFallback() {
    if (this.memory) return this.memory;
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  writeFallback(envelope) {
    this.memory = envelope;
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(envelope));
      return "localStorage";
    } catch {
      return "memory";
    }
  }

  async load() {
    if (this.db) {
      try {
        const record = await new Promise((resolve, reject) => {
          const request = this.db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(PRIMARY_KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (record?.envelope) return { envelope: record.envelope, source: "IndexedDB" };
      } catch {
        this.mode = "fallback";
      }
    }
    const envelope = this.readFallback();
    return { envelope, source: envelope ? "local fallback" : null };
  }

  async save(envelope) {
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction(STORE_NAME, "readwrite");
          transaction.objectStore(STORE_NAME).put({ id: PRIMARY_KEY, envelope });
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
        this.mode = "indexeddb";
        return "IndexedDB";
      } catch {
        this.mode = "fallback";
      }
    }
    return this.writeFallback(envelope);
  }
}

const elements = Object.freeze({
  lobby: document.querySelector("#campaign-lobby"),
  screen: document.querySelector("#campaign-screen"),
  start: document.querySelector("#start-campaign"),
  resume: document.querySelector("#resume-campaign"),
  resumeSummary: document.querySelector("#campaign-resume-summary"),
  resumeStage: document.querySelector("#campaign-resume-stage"),
  resumeStatus: document.querySelector("#campaign-resume-status"),
  restart: document.querySelector("#restart-campaign"),
  retry: document.querySelector("#retry-stage"),
  returnToLobby: document.querySelector("#return-to-lobby"),
  resultOverlay: document.querySelector("#view-result"),
  briefing: document.querySelector("#stage-briefing"),
  briefingPlayerJob: document.querySelector("#briefing-player-job"),
  briefingStage: document.querySelector("#briefing-stage"),
  briefingRegion: document.querySelector("#briefing-region"),
  briefingObjective: document.querySelector("#briefing-objective"),
  briefingOperation: document.querySelector("#briefing-operation"),
  briefingDoctrine: document.querySelector("#briefing-doctrine"),
  briefingBoss: document.querySelector("#briefing-boss"),
  briefingNarration: document.querySelector("#briefing-narration"),
  startCombat: document.querySelector("#start-combat"),
  saveDock: document.querySelector("#save-dock"),
  retryFromResult: document.querySelector("#retry-from-result"),
  returnToLobbyFromResult: document.querySelector("#return-to-lobby-from-result"),
  resultTitle: document.querySelector("#result-title"),
  resultText: document.querySelector("#result-text"),
  bossSpecPortrait: document.querySelector("#boss-portrait-spec"),
  bossSpecName: document.querySelector("#boss-spec-name"),
  bossSpecLore: document.querySelector("#boss-spec-lore"),
  bossSpecThreat: document.querySelector("#boss-spec-threat"),
  bossSpecHp: document.querySelector("#boss-spec-hp"),
  bossSpecCounter: document.querySelector("#boss-spec-counter"),
  bossSpecNodes: document.querySelector("#boss-spec-nodes"),
  statMaxIntegrity: document.querySelector("#stat-max-integrity"),
  statCooldownReduction: document.querySelector("#stat-cooldown-reduction"),
  statExtraDamage: document.querySelector("#stat-extra-damage"),
  statActiveItems: document.querySelector("#stat-active-items"),
  waveIndicator: document.querySelector("#battle-wave-indicator"),
  battleCanvas3d: document.querySelector("#battle-canvas-3d"),
  battleFallbackCanvas: document.querySelector("#battle-canvas-fallback"),
  battleField: document.querySelector("#battle-field"),
  battleBrief: document.querySelector("#battle-tactical-brief"),
  battleOperation: document.querySelector("#battle-operation"),
  battleDoctrine: document.querySelector("#battle-doctrine"),
  battleAllyLabel: document.querySelector("#battle-ally-label"),
  battleHostileLabel: document.querySelector("#battle-hostile-label"),
  battlePressure: document.querySelector("#battle-pressure"),
  battleAssetStatus: document.querySelector("#battle-asset-status"),
  battleFallback: document.querySelector("#battle-visual-fallback"),
  battleFallbackOperation: document.querySelector("#battle-fallback-operation"),
  battleFallbackDoctrine: document.querySelector("#battle-fallback-doctrine"),
  battleFallbackAllyLabel: document.querySelector("#battle-fallback-ally-label"),
  battleFallbackHostileLabel: document.querySelector("#battle-fallback-hostile-label"),
  stageNumber: document.querySelector("#stage-number"),
  stageHeading: document.querySelector("#stage-heading"),
  stageRegion: document.querySelector("#stage-region"),
  stageObjective: document.querySelector("#stage-objective"),
  status: document.querySelector("#campaign-status"),
  souls: document.querySelector("#souls-value"),
  legion: document.querySelector("#legion-value"),
  nodes: document.querySelector("#nodes-value"),
  integrity: document.querySelector("#integrity-value"),
  bossLabel: document.querySelector("#boss-label"),
  boss: document.querySelector("#boss-value"),
  checklist: document.querySelector("#objective-checklist"),
  rewardPanel: document.querySelector("#reward-panel"),
  rewardOptions: document.querySelector("#reward-options"),
  complete: document.querySelector("#campaign-complete"),
  completionSummary: document.querySelector("#completion-summary"),
  saveStatus: document.querySelector("#save-status"),
  mirrorStatus: document.querySelector("#campaign-mirror-status"),
  exportSave: document.querySelector("#export-save"),
  importSave: document.querySelector("#import-save"),
  effect: document.querySelector("#visual-effect"),
  ambience: document.querySelector("#toggle-stage-ambience"),
  transition: document.querySelector("#stage-transition"),
  video: document.querySelector("#stage-transition-video"),
  narratorAtlas: document.querySelector("#narrator-atlas"),
  cinematic: document.querySelector("#campaign-cinematic"),
  cinematicButton: document.querySelector("#play-cinematic"),
  cinematicTranscriptToggle: document.querySelector("#toggle-cinematic-transcript"),
  cinematicTranscript: document.querySelector("#cinematic-transcript"),
  cinematicTranscriptHeading: document.querySelector("#cinematic-transcript-heading"),
  cinematicTranscriptIntro: document.querySelector("#cinematic-transcript-intro"),
  cinematicTranscriptBrief: document.querySelector("#cinematic-transcript-brief"),
  cinematicStatus: document.querySelector("#cinematic-status"),
  narrationLine: document.querySelector("#narration-line"),
  narrationSr: document.querySelector("#narration-sr"),
  commandButtons: [...document.querySelectorAll("[data-action]")],
  stageButtons: [...document.querySelectorAll("#stage-selector [data-stage-number]")],
  bgmToggle: document.querySelector("#bgm-toggle"),
  bgmPlayer: document.querySelector("#bgm-player"),
  languageToggle: document.querySelector("#lang-toggle"),
  battleMissionCurrent: document.querySelector("#battle-mission-current"),
  battleMissionWhy: document.querySelector("#battle-mission-why")
});

let campaign = null;
let storedCampaign = null;
let storage = new CampaignStorage();
let cuePlayer = null;
let ambiencePlayer = null;
let narrationPlayer = null;
let narrationRun = 0;
let cinematicStatusKey = "optional";
let liquidEtherBackground = null;
let liquidEtherLoad = null;
let particleBackground = null;
let narratedStageId = null;
let narratedOutcome = null;
let stageBriefingOpen = false;
let entryGuidanceStageId = null;
let pendingCommandFocus = false;
// Single-screen cockpit: the battlefield, intel rail, and command pad are
// always visible while a campaign runs. `battleUiActive()` (a live battle
// session exists) replaces the old activeView === "battle" checks; the
// result overlay is derived from campaign.status in render().
let visualizer = null;
let battleSessionId = 0;
let encounterStartTimer = 0;
let battleStartedAt = 0;
let rendererRuntime = null;
let encounterEventQueue = Promise.resolve();
let cooldownTimer = 0;
let battleVisualFallback = false;
let battleStarting = false;
let pendingBattleRenderer = null;
let lastScrolledStageId = null;
const cooldowns = new Map();
let resultOverlayOpen = false;
let campaignMirror = null;

function currentStage() {
  return STAGES[campaign.stageIndex];
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function translatedResumeText(key, fallback) {
  return translations[currentLang()]?.[key] ?? fallback;
}

function resolvePresentationCopy(key, fallback, stageId, type) {
  if (key) {
    const res = translate(key);
    if (res) return res;
  }
  if (stageId && type) {
    const res = translate(`presentation.${stageId}.${type}`);
    if (res) return res;
  }
  return fallback;
}

function calculateAssaultDamage(state, stage, benefits) {
  const assault = stage.commands.assault;
  if (!assault) return 0;
  let damage = assault.damage;
  if (state.possessed) {
    damage += (assault.possessedDamage ?? 0) + (benefits.possessedAssaultBonus ?? 0);
  }
  return damage;
}

function calculateCounterDamage(state, stage, benefits) {
  const assault = stage.commands.assault;
  if (!assault || !assault.counter) return 0;
  const counter = assault.counter;
  if (counter.mode === "threshold") {
    const base = state.legion >= counter.minimumLegion ? counter.readyDamage : counter.belowDamage;
    return Math.max(1, base - (benefits.counterReduction ?? 0));
  }
  const shield = Math.floor(state.legion / counter.shieldDivisor);
  const thin = state.legion < counter.thinLegion ? counter.thinPenalty : 0;
  return Math.max(1, Math.max(1, counter.baseDamage - shield) + thin - (benefits.counterReduction ?? 0));
}

function getCommandDescription(action, available, lang) {
  const stage = currentStage();
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const progression = stage.progression;
  
  if (action === "hunt") {
    return lang === "ko"
      ? `균열 흔적 탐색 (진행도: ${state.hunted}/${progression.huntGoal})`
      : `Search for spoor (progress: ${state.hunted}/${progression.huntGoal})`;
  }
  if (action === "extract") {
    return lang === "ko"
      ? `은닉처에서 영혼 +${progression.soulsPerExtract} 획득`
      : `Gain +${progression.soulsPerExtract} souls from cache`;
  }
  if (action === "materialize") {
    const extra = benefits.materializeBonus ?? 0;
    const summon = Math.min(progression.materializeSummon + extra, state.capacity - state.legion);
    return lang === "ko"
      ? `비용: 영혼 ${progression.materializeCost} | 군단 +${summon} 실체화`
      : `Cost: ${progression.materializeCost} souls | Gain +${summon} legion`;
  }
  if (action === "capture") {
    return lang === "ko"
      ? `기술 거점 점거 (그림자 2명 필요 | 거점 +1)`
      : `Capture tech node (needs 2 legion | results in +1 node)`;
  }
  if (action === "possess") {
    const command = stage.commands.possess;
    const possessedDamage = stage.commands.assault?.possessedDamage ?? 0;
    const extraDamage = benefits.possessedAssaultBonus ?? 0;
    const totalBonus = possessedDamage + extraDamage;
    return lang === "ko"
      ? `총공격 피해 +${totalBonus} 부여`
      : `Grants +${totalBonus} assault damage`;
  }
  if (action === "domain") {
    const command = stage.commands.domain;
    const restore = command?.integrityRestore ?? 0;
    const aegis = command?.aegis ?? 0;
    return lang === "ko"
      ? `군주 내구도 +${restore} 회복 및 차단막 +${aegis} 획득`
      : `Restores +${restore} integrity & grants +${aegis} aegis`;
  }
  if (action === "assault") {
    const dmg = calculateAssaultDamage(state, stage, benefits);
    const counter = calculateCounterDamage(state, stage, benefits);
    return lang === "ko"
      ? `보스에게 ${dmg} 피해 | 예상 반격: ${counter}`
      : `Deal ${dmg} damage | Expected counterblow: ${counter}`;
  }
  return "";
}

function getCommandLockReason(action, lang) {
  const stage = currentStage();
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const progression = stage.progression;
  
  if (action === "hunt") {
    if (state.hunted >= progression.huntGoal || state.extracted) {
      return lang === "ko"
        ? "균열 흔적이 모두 발견되었습니다. 그림자 은닉처를 추출하십시오."
        : "The spoor is fully mapped. Extract the gathered shade.";
    }
    return lang === "ko"
      ? "현재 스테이지에서 명령을 내릴 수 없습니다."
      : "This stage is not accepting commands right now.";
  }
  if (action === "extract") {
    if (state.hunted < progression.huntGoal) {
      return lang === "ko"
        ? "추출 전에 두 개의 흔적을 발견해야 합니다."
        : "Two spoor marks are required before extraction.";
    }
    if (state.extracted) {
      return lang === "ko"
        ? "그림자 은닉처가 이미 추출되었습니다."
        : "The shade cache has already been extracted.";
    }
  }
  if (action === "materialize") {
    if (state.souls < progression.materializeCost) {
      return lang === "ko"
        ? `실체화에 필요한 영혼이 부족합니다 (${state.souls}/${progression.materializeCost} 보유).`
        : `Extract enough shade before materializing (have ${state.souls}/${progression.materializeCost}).`;
    }
    if (state.legion >= state.capacity) {
      return lang === "ko"
        ? "군단 슬롯이 가득 찼습니다."
        : "Your legion slots are full.";
    }
  }
  if (action === "capture") {
    if (state.legion < 2) {
      return lang === "ko"
        ? `거점을 점거하려면 최소 2명의 그림자가 필요합니다 (현재 ${state.legion}명).`
        : `Need at least 2 shades to anchor the node (have ${state.legion}).`;
    }
    if (state.nodes >= stage.nodeGoal) {
      return lang === "ko"
        ? "필요한 모든 거점을 이미 점거했습니다."
        : "Every required node is already held.";
    }
  }
  if (action === "possess") {
    const command = stage.commands.possess;
    if (!command) {
      return lang === "ko"
        ? "이 스테이지에서는 빙의를 사용할 수 없습니다."
        : "Possession is not available in this stage.";
    }
    if (state.nodes < command.requiresNodes) {
      return lang === "ko"
        ? `센티널을 빙의하려면 신호 거점을 ${command.requiresNodes}곳 점거해야 합니다 (현재 ${state.nodes}곳 보유).`
        : `Hold ${command.requiresNodes} signal nodes to possess (have ${state.nodes}).`;
    }
    if (state.possessed) {
      return lang === "ko"
        ? "이미 센티널을 빙의 중입니다."
        : "A sentinel is already possessed.";
    }
  }
  if (action === "domain") {
    const command = stage.commands.domain;
    if (!command) {
      return lang === "ko"
        ? "이 스테이지에서는 군주의 영역을 사용할 수 없습니다."
        : "Lord's Domain is not available in this stage.";
    }
    if (state.nodes < command.requiresNodes) {
      return lang === "ko"
        ? `영역을 발동하려면 신호 거점을 ${command.requiresNodes}곳 점거해야 합니다 (현재 ${state.nodes}곳 보유).`
        : `Hold ${command.requiresNodes} signal nodes to open the Domain (have ${state.nodes}).`;
    }
    if (state.domainUses >= command.limit) {
      return lang === "ko"
        ? "군주의 영역이 이미 발동되었습니다."
        : "Lord's Domain has already been invoked.";
    }
  }
  if (action === "assault") {
    const encounter = currentEncounter(stage, state);
    if (encounter && !encounter.bossExposed) {
      return lang === "ko"
        ? "보스를 공격하기 전에 모든 적 웨이브를 물리쳐야 합니다."
        : "Clear every declared wave before assaulting the boss.";
    }
    if (state.nodes < stage.nodeGoal) {
      return lang === "ko"
        ? `보스를 공격하려면 모든 거점 ${stage.nodeGoal}곳을 점거해야 합니다 (현재 ${state.nodes}곳 보유).`
        : `Hold every required node before the boss can be assaulted (have ${state.nodes}/${stage.nodeGoal}).`;
    }
    const assault = stage.commands.assault;
    if (assault && assault.requiresPossessed && !state.possessed) {
      return lang === "ko"
        ? "보스를 대면하기 전에 센티널에 빙의하십시오."
        : `Possess a sentinel before confronting the ${stage.bossName}.`;
    }
  }
  return "";
}

function getChecklistLabel(item, lang) {
  if (lang !== "ko") return item.label;
  const stage = currentStage();
  if (item.id === "hunt") {
    const match = item.label.match(/(\d+)\/(\d+)/);
    if (match) {
      const [_, current, total] = match;
      return `균열 흔적 ${current}/${total} 사냥`;
    }
    return "균열 흔적 사냥";
  }
  if (item.id === "extract") {
    return "그림자 은닉처 추출";
  }
  if (item.id === "materialize") {
    const match = item.label.match(/(\d+)\/(\d+)/);
    if (match) {
      const [_, current, total] = match;
      return `그림자 군단 ${current}/${total} 실체화`;
    }
    return "그림자 군단 실체화";
  }
  if (item.id === "capture") {
    const match = item.label.match(/Hold (\d+)/);
    if (match) {
      const [_, total] = match;
      return `기술 거점 ${total}곳 점거`;
    }
    return "기술 거점 점거";
  }
  if (item.id === "possess") {
    return "센티널 빙의";
  }
  if (item.id === "domain") {
    return "군주의 영역 1회 발동";
  }
  if (item.id.startsWith("wave-")) {
    const waveId = item.id.substring(5);
    const waveNameKo = translate(`wave.${waveId}`) || waveId;
    return `${waveNameKo} 웨이브 처치`;
  }
  if (item.id === "assault") {
    const bossNameKo = translate(`stage.${stage.id}.bossName`) || stage.bossName;
    return `${bossNameKo} 처치`;
  }
  return item.label;
}

function translateStatusMessage(msg, lang) {
  if (lang !== "ko") return msg;
  if (!msg) return "";
  
  if (msg.includes("The abyss answers when you are ready.")) {
    return "준비가 되면 심연이 답할 것입니다.";
  }
  if (msg.includes("No campaign started.")) {
    return "시작된 캠페인이 없습니다.";
  }
  if (msg === "You find a heatless footprint in the cinders.") {
    return "잿더미에서 열기 없는 흔적 하나를 발견했습니다. 균열을 특정하려면 한 번 더 사냥하십시오.";
  }
  if (msg === "The second trace exposes the rift's pulse.") {
    return "두 번째 흔적이 균열의 맥동을 드러냈습니다. 이제 영혼을 추출할 수 있습니다.";
  }
  if (msg.endsWith("reforms. Your earned boons remain.")) {
    const stageTitle = msg.replace("reforms. Your earned boons remain.", "").trim();
    const stageObj = STAGES.find(s => s.title === stageTitle);
    const stageTitleKo = stageObj ? translate(`stage.${stageObj.id}.title`) : stageTitle;
    return `${stageTitleKo}이(가) 재구성되었습니다. 획득한 가호는 유지됩니다.`;
  }
  if (msg.includes("opens. Follow the spoor before the bridge cools.")) {
    const stageTitle = msg.replace("opens. Follow the spoor before the bridge cools.", "").trim();
    const stageObj = STAGES.find(s => s.title === stageTitle);
    const stageTitleKo = stageObj ? translate(`stage.${stageObj.id}.title`) : stageTitle;
    return `${stageTitleKo}이(가) 개방되었습니다. 다리가 식기 전에 흔적을 쫓으십시오.`;
  }
  if (msg.endsWith("dissolves into ash. Choose one lasting boon.")) {
    const bossName = msg.replace("dissolves into ash. Choose one lasting boon.", "").trim();
    const stageObj = STAGES.find(s => s.bossName === bossName);
    const bossNameKo = stageObj ? translate(`stage.${stageObj.id}.bossName`) : bossName;
    return `${bossNameKo}이(가) 재로 분해되었습니다. 지속되는 가호 하나를 선택하십시오.`;
  }
  if (msg.includes("The legion loses its anchor. Regroup and retry this stage.")) {
    return "군단이 닻을 잃었습니다. 부대를 재정비하고 스테이지를 재시도하십시오.";
  }
  if (msg.includes("The breach shatters the legion's anchor. Regroup and retry this stage.")) {
    return "균열로 인해 군단의 닻이 파괴되었습니다. 부대를 재정비하고 스테이지를 재시도하십시오.";
  }
  if (msg.includes("An abyssal breach strikes, but the aegis absorbs it.")) {
    return "심연의 균열 습격이 발생했으나, 이지스가 이를 흡수했습니다.";
  }
  if (msg.startsWith("An abyssal breach tears ") && msg.endsWith(" integrity.")) {
    const dmg = msg.replace("An abyssal breach tears ", "").replace(" integrity.", "").trim();
    return `심연의 균열이 발생하여 군주 내구도가 ${dmg}만큼 감소했습니다.`;
  }
  if (msg.includes("The second spoor opens into a soul cache before the rift can close.")) {
    return "균열이 닫히기 전에 두 번째 흔적이 그림자 은닉처로 열렸습니다.";
  }
  if (msg.includes("Four volatile shades tear free from the rift.")) {
    return "네 명의 불안정한 그림자가 균열에서 흘러나왔습니다.";
  }
  if (msg.includes("shadow answer your call.") || msg.includes("shadow answers your call.")) {
    const num = msg.split(" ")[0];
    return `${num}명의 그림자가 부름에 응답했습니다.`;
  }
  if (msg.startsWith("The node bends beneath the legion's banner (")) {
    const progress = msg.substring(msg.indexOf("(") + 1, msg.indexOf(")"));
    return `거점이 군단의 깃발 아래 굴복했습니다 (${progress}).`;
  }
  if (msg.includes("A sentinel's will is folded into your command; its fury rides your assaults.")) {
    return "센티널의 의지가 아군 명령에 굴복했습니다. 그 분노가 총공격에 실려 발산됩니다.";
  }
  if (msg.startsWith("Lord's Domain unfolds once:")) {
    const restoreMatch = msg.match(/restores (\d+) integrity/);
    const aegisMatch = msg.match(/next (\d+) counterblows/);
    const restore = restoreMatch ? restoreMatch[1] : "0";
    const aegis = aegisMatch ? aegisMatch[1] : "0";
    return `군주의 영역이 펼쳐졌습니다: 심연이 군주 내구도를 ${restore} 회복시켰고, 다음 ${aegis}회의 반격이 차단됩니다.`;
  }
  if (msg.endsWith("wave has reached the battlefield.")) {
    const waveId = msg.replace("wave has reached the battlefield.", "").trim();
    const waveNameKo = translate(`wave.${waveId}`) || waveId;
    return `${waveNameKo} 웨이브가 전장에 도달했습니다.`;
  }
  if (msg.endsWith("is exposed. Spawning has stopped.")) {
    const bossName = msg.replace("is exposed. Spawning has stopped.", "").trim();
    const stageObj = STAGES.find(s => s.bossName === bossName);
    const bossNameKo = stageObj ? translate(`stage.${stageObj.id}.bossName`) : bossName;
    return `${bossNameKo}이(가) 노출되었습니다. 적의 생성이 중단되었습니다.`;
  }
  if (msg.endsWith("wave cleared. The next wave remains on approach.")) {
    const waveId = msg.replace("wave cleared. The next wave remains on approach.", "").trim();
    const waveNameKo = translate(`wave.${waveId}`) || waveId;
    return `${waveNameKo} 웨이브를 물리쳤습니다. 다음 웨이브가 다가오고 있습니다.`;
  }
  if (msg.includes("is claimed. The ") && msg.includes(" is gone, and Abyssal Command endures.")) {
    const part1 = msg.split(" is claimed. The ");
    const rewardName = part1[0];
    const bossName = part1[1].replace(" is gone, and Abyssal Command endures.", "");
    const stageObj = STAGES.find(s => s.bossName === bossName);
    const bossNameKo = stageObj ? translate(`stage.${stageObj.id}.bossName`) : bossName;
    
    let rewardId = "";
    for (const s of STAGES) {
      const r = s.rewards.find(reward => reward.name === rewardName);
      if (r) { rewardId = r.id; break; }
    }
    const rewardNameKo = rewardId ? translate(`reward.${rewardId}.name`) : rewardName;
    return `${rewardNameKo}을(를) 획득했습니다. ${bossNameKo}은(는) 소멸했으며, 심연의 명령(Abyssal Command)이 유지됩니다.`;
  }
  if (msg.includes(" carries into ")) {
    const parts = msg.split(" carries into ");
    const rewardName = parts[0];
    const nextStageTitle = parts[1].replace(".", "").trim();
    const nextStageObj = STAGES.find(s => s.title === nextStageTitle);
    const nextStageTitleKo = nextStageObj ? translate(`stage.${nextStageObj.id}.title`) : nextStageTitle;
    
    let rewardId = "";
    for (const s of STAGES) {
      const r = s.rewards.find(reward => reward.name === rewardName);
      if (r) { rewardId = r.id; break; }
    }
    const rewardNameKo = rewardId ? translate(`reward.${rewardId}.name`) : rewardName;
    return `${rewardNameKo}의 효과가 ${nextStageTitleKo}(으)로 이어집니다.`;
  }
  if (msg.includes("recoils; ") && msg.includes("ward strength remains.")) {
    const parts = msg.split("recoils; ");
    const bossName = parts[0].trim();
    const rest = parts[1];
    const wardMatch = rest.match(/^(\d+) ward strength remains\.\s*(.*)$/);
    if (wardMatch) {
      const ward = wardMatch[1];
      const aftermath = wardMatch[2];
      
      const stageObj = STAGES.find(s => s.bossName === bossName);
      const bossNameKo = stageObj ? translate(`stage.${stageObj.id}.bossName`) : bossName;
      
      let aftermathKo = aftermath;
      if (aftermath.includes("The Domain turns the counterblow aside.")) {
        aftermathKo = "군주의 영역이 반격을 차단했습니다.";
      } else if (aftermath.startsWith("The counterblow tears ") && aftermath.endsWith(" integrity.")) {
        const integrity = aftermath.replace("The counterblow tears ", "").replace(" integrity.", "").trim();
        aftermathKo = `반격으로 인해 군주 내구도가 ${integrity}만큼 감소했습니다.`;
      }
      return `${bossNameKo}이(가) 주춤합니다. 보스 보호벽 체력 ${ward} 남음. ${aftermathKo}`;
    }
  }

  return msg;
}


function updateResumeAffordance() {
  const resumableCampaign = storedCampaign;
  const hasResumableCampaign = Boolean(resumableCampaign);
  elements.resume.hidden = !hasResumableCampaign;
  elements.resume.classList.toggle("primary", hasResumableCampaign);
  elements.start.classList.toggle("primary", !hasResumableCampaign);
  elements.resumeSummary.hidden = !hasResumableCampaign;
  if (!hasResumableCampaign) return;

  const stage = STAGES[resumableCampaign.stageIndex];
  const stageTitle = currentLang() === "ko" ? translate(`stage.${stage.id}.title`) || stage.title : stage.title;
  elements.resumeStage.textContent = currentLang() === "ko"
    ? `${STAGES.length}단계 중 ${stage.number}단계 · ${stageTitle}`
    : `${stage.number} / ${STAGES.length} · ${stage.title}`;
  const statusKey = RESUME_STATUS_KEYS[resumableCampaign.status];
  elements.resumeStatus.textContent = translatedResumeText(statusKey, resumableCampaign.status);
}


function renderChecklist(checklist) {
  elements.checklist.replaceChildren();
  const nextPendingId = checklist.find((item) => !item.complete && !item.optional)?.id;
  const lang = currentLang();
  for (const item of checklist) {
    const row = document.createElement("li");
    let statusClass = "pending";
    let ariaState = "";
    if (item.complete) {
      statusClass = "complete";
      ariaState = lang === "ko" ? "완료됨" : "complete";
    } else if (item.optional) {
      statusClass = "optional";
      ariaState = lang === "ko" ? "선택 사항" : "optional";
    } else if (item.id === nextPendingId) {
      statusClass = "current";
      ariaState = lang === "ko" ? "현재 목표" : "current objective";
    } else {
      statusClass = "pending";
      ariaState = lang === "ko" ? "대기 중" : "pending";
    }
    row.className = statusClass;
    let localizedLabel = getChecklistLabel(item, lang);
    if (item.optional && !item.complete) {
      localizedLabel += lang === "ko" ? " (선택)" : " (Optional)";
    }
    row.textContent = localizedLabel;
    row.setAttribute("aria-label", `${localizedLabel}: ${ariaState}`);
    elements.checklist.append(row);
  }
}

function renderRewards(stage) {
  elements.rewardOptions.replaceChildren();
  const lang = currentLang();
  for (const reward of stage.rewards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reward-option";
    button.dataset.rewardId = reward.id;
    if (REWARD_ART_IDS.has(reward.id)) {
      const art = document.createElement("img");
      art.className = "reward-art";
      art.alt = "";
      art.src = `assets/images/ui/reward-${reward.id}.png`;
      art.addEventListener("error", () => art.remove(), { once: true });
      button.append(art);
    }
    const name = document.createElement("strong");
    name.textContent = lang === "ko" ? translate(`reward.${reward.id}.name`) || reward.name : reward.name;
    const description = document.createElement("span");
    description.textContent = lang === "ko" ? translate(`reward.${reward.id}.description`) || reward.description : reward.description;
    button.append(name, description);
    button.addEventListener("click", () => handleReward(reward.id));
    elements.rewardOptions.append(button);
  }
}

function renderStageMedia(stage) {
  const videoSource = VIDEO_BY_STAGE[stage.id];
  const imageSource = IMAGE_BY_STAGE[stage.id];
  if (elements.video.dataset.stage === stage.id) return;

  elements.video.dataset.stage = stage.id;
  const atlasSource = NARRATOR_ATLAS_BY_STAGE[stage.id];
  if (elements.narratorAtlas.dataset.stage !== stage.id) {
    elements.narratorAtlas.dataset.stage = stage.id;
    if (atlasSource) elements.narratorAtlas.style.setProperty("--narrator-atlas-image", `url("${atlasSource}")`);
    else elements.narratorAtlas.style.removeProperty("--narrator-atlas-image");
  }
  elements.transition.style.removeProperty("background-image");
  if (imageSource) {
    const image = new Image();
    image.onload = () => {
      if (elements.video.dataset.stage === stage.id) {
        elements.transition.style.backgroundImage = `linear-gradient(115deg, rgb(14 18 36 / 84%), rgb(17 27 44 / 55%)), url("${TACTICAL_SURFACE}"), url("${imageSource}")`;
      }
    };
    image.onerror = () => elements.transition.style.removeProperty("background-image");
    image.src = imageSource;
  }

  const portrait = document.querySelector("#boss-portrait");
  if (portrait) {
    const bossArt = BOSS_BY_STAGE[stage.id];
    if (bossArt) {
      applyStageArt(portrait, bossArt, BOSS_FALLBACK_BY_STAGE[stage.id]);
      portrait.alt = "";
      portrait.hidden = false;
    } else {
      portrait.hidden = true;
    }
  }

  elements.video.hidden = true;
  elements.video.removeAttribute("src");
  elements.video.load();
  if (!videoSource || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.video.src = videoSource;
  elements.video.onloadeddata = () => {
    elements.video.hidden = false;
    elements.video.play().catch(() => undefined);
  };
  elements.video.onerror = () => {
    elements.video.hidden = true;
    elements.video.removeAttribute("src");
  };
  elements.video.load();
}

function remainingCooldown(action, now = performance.now()) {
  return Math.max(0, (cooldowns.get(action) ?? 0) - now);
}

function setBattlePressure(phase, label) {
  const staticFallback = battleVisualFallback;
  const lang = currentLang();
  elements.waveIndicator.dataset.phase = staticFallback ? "fallback" : phase;
  
  let displayLabel = label;
  if (phase === "briefing") {
    displayLabel = lang === "ko" ? "작전 브리핑 · 명령 대기 중" : "MISSION BRIEFING · COMMAND PENDING";
  }
  
  if (lang === "ko") {
    elements.waveIndicator.textContent = staticFallback ? "정적 전술 브리핑 · 명령 스케줄 활성화됨" : displayLabel;
    elements.battlePressure.textContent = staticFallback
      ? "정적 전술 모드: 렌더링이 불가하지만 명령 규칙은 활성 상태로 유지됩니다."
      : phase === "briefing"
        ? "작전 브리핑: 명령을 검토한 후 군단을 투입하십시오."
        : phase === "preparation"
          ? "준비 시간: 첫 번째 적 웨이브가 전장에 진입하기 전에 명령을 내리십시오."
          : "웨이브 진행 중: 적들이 전장을 가로지르는 동안 명령 패널을 활성화하십시오.";
  } else {
    elements.waveIndicator.textContent = staticFallback ? "STATIC TACTICAL BRIEFING · COMMAND SCHEDULE ACTIVE" : displayLabel;
    elements.battlePressure.textContent = staticFallback
      ? "Static tactical fallback: rendering is unavailable, but command rules remain active."
      : phase === "briefing"
        ? "Mission briefing: review the order, then commit the legion."
        : phase === "preparation"
          ? "Preparation window: issue commands before the first hostile wave enters the lane."
          : "Live-wave pressure: keep the command pad active while hostiles cross the lane.";
  }
}

function renderBattleAssetStatus({ state, loaded = 0, total = 0, clips = 0 } = {}) {
  if (!elements.battleAssetStatus) return;
  const korean = currentLang() !== "en";
  const count = total ? `${loaded}/${total}` : "";
  const copy = {
    loading: korean ? `GLB 소스 전장 자산 불러오는 중 ${count}` : `Loading source GLB battle assets ${count}`,
    loaded: korean ? `GLB 소스 아틀라스 ${count} · 동작 클립 ${clips}개 활성` : `Source GLB atlases ${count} · ${clips} action clips active`,
    partial: korean ? `GLB 소스 아틀라스 일부 사용 가능 ${count} · 캔버스 대체 표시 유지` : `Partial source GLB atlases ${count} · Canvas fallback retained`,
    unavailable: korean ? "GLB 소스 아틀라스를 사용할 수 없음 · 캔버스 대체 표시" : "Source GLB atlases unavailable · Canvas fallback active",
  };
  elements.battleAssetStatus.textContent = copy[state] ?? copy.loading;
  elements.battleAssetStatus.dataset.state = state ?? "loading";
}

function renderBattlePresentation(stage) {
  const presentation = getBattlePresentation(stage.id);
  if (elements.battleField.dataset.stage !== stage.id) {
    const { palette } = presentation;
    elements.battleField.dataset.stage = stage.id;
    elements.battleField.style.setProperty("--battle-background", palette.background);
    elements.battleField.style.setProperty("--battle-ally", palette.ally);
    elements.battleField.style.setProperty("--battle-hostile", palette.hostile);
    elements.battleField.style.setProperty("--battle-accent", palette.accent);
  }

  const operation = resolvePresentationCopy(presentation.operationKey, presentation.operation, stage.id, "operation");
  const doctrine = resolvePresentationCopy(presentation.doctrineKey, presentation.doctrine, stage.id, "doctrine");
  const allyLabel = resolvePresentationCopy(null, presentation.allyLabel, stage.id, "allyLabel");
  const hostileLabel = resolvePresentationCopy(null, presentation.hostileLabel, stage.id, "hostileLabel");
  elements.battleOperation.textContent = operation;
  elements.battleDoctrine.textContent = doctrine;
  elements.battleAllyLabel.textContent = allyLabel;
  elements.battleHostileLabel.textContent = hostileLabel;
  elements.battleFallbackOperation.textContent = operation;
  elements.battleFallbackDoctrine.textContent = doctrine;
  elements.battleFallbackAllyLabel.textContent = allyLabel;
  elements.battleFallbackHostileLabel.textContent = hostileLabel;

  const showFallback = battleVisualFallback && !elements.screen.hidden;
  elements.battleCanvas3d.hidden = showFallback;
  elements.battleFallbackCanvas.hidden = !showFallback;
  elements.battleFallback.hidden = !showFallback;
  elements.battleBrief.dataset.presentation = stage.id;
  return presentation;
}

function syncModalIsolation() {
  const activeModal = resultOverlayOpen
    ? elements.resultOverlay
    : stageBriefingOpen
      ? elements.briefing
      : null;
  for (const child of elements.screen.children) {
    child.inert = Boolean(activeModal && child !== activeModal);
  }
  if (elements.languageToggle) elements.languageToggle.inert = Boolean(activeModal);
}

function setMissionBriefingModal(active) {
  elements.briefing.hidden = !active;
  syncModalIsolation();
}

function setResultModal(active) {
  elements.resultOverlay.hidden = !active;
  syncModalIsolation();
}

function setBriefingStageArt(stage) {
  const imageSource = IMAGE_BY_STAGE[stage.id];
  if (imageSource) {
    elements.briefing.style.setProperty("--briefing-stage-art", `url("${imageSource}")`);
  } else {
    elements.briefing.style.removeProperty("--briefing-stage-art");
  }
}

function renderMissionBriefing(stage) {
  setBriefingStageArt(stage);
  setMissionBriefingModal(stageBriefingOpen);
  if (!stageBriefingOpen) return;
  const lang = currentLang();
  const presentation = getBattlePresentation(stage.id);
  
  const bossName = lang === "ko" ? translate(`stage.${stage.id}.bossName`) || stage.bossName : stage.bossName;
  const stageTitle = lang === "ko" ? translate(`stage.${stage.id}.title`) || stage.title : stage.title;
  const region = lang === "ko" ? translate(`stage.${stage.id}.region`) || stage.region : stage.region;
  
  elements.briefingPlayerJob.textContent = translate("briefing.playerJob").replace("{bossName}", bossName);
  elements.briefingStage.textContent = lang === "ko"
    ? `스테이지 ${stage.number} · ${stageTitle}`
    : `Stage ${stage.number} · ${stage.title}`;
  elements.briefingRegion.textContent = region;
  elements.briefingObjective.textContent = presentation.objectiveKey
    ? resolvePresentationCopy(presentation.objectiveKey, stage.objective, stage.id, "objective")
    : translations[lang]?.[`stage.${stage.id}.objective`] ?? stage.objective;
  elements.briefingOperation.textContent = resolvePresentationCopy(presentation.operationKey, presentation.operation, stage.id, "operation");
  elements.briefingDoctrine.textContent = resolvePresentationCopy(presentation.doctrineKey, presentation.doctrine, stage.id, "doctrine");
  elements.briefingBoss.textContent = bossName;
}

function clearEncounterStartTimer() {
  window.clearTimeout(encounterStartTimer);
  encounterStartTimer = 0;
}

function currentEncounter(stage = currentStage(), state = campaign?.stage) {
  if (!stage?.encounter) return null;
  return state?.encounter ?? null;
}

function armEncounterWhenPrepared(sessionId = battleSessionId) {
  if (battleStartedAt || !campaign || campaign.status !== "active") return;
  const stage = currentStage();
  const encounter = currentEncounter(stage);
  if (!stage.encounter || !encounter || encounter.bossExposed || encounter.spawningStopped) return;

  const preparationLegion = stage.encounter.preparationLegion ?? 0;
  const preparationNodes = stage.encounter.preparationNodes ?? 0;
  const readyForInitialWave = encounter.activeWaveId !== null || (
    campaign.stage.legion >= preparationLegion &&
    campaign.stage.nodes >= preparationNodes
  );
  if (!readyForInitialWave) return;

  battleStartedAt = performance.now();
  scheduleEncounterWaveStart(sessionId);
}

function currentEncounterWave(stage = currentStage(), encounter = currentEncounter(stage)) {
  if (!stage?.encounter || !encounter?.activeWaveId) return null;
  return stage.encounter.waves.find((wave) => wave.id === encounter.activeWaveId) ?? null;
}

function projectBattleRuntime() {
  if (!campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const encounter = currentEncounter(stage, state);
  const activeWave = currentEncounterWave(stage, encounter);
  const rendererMode = typeof rendererRuntime?.mode === "string" ? rendererRuntime.mode : "";
  const runtimeCount = (value) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const engagements = runtimeCount(rendererRuntime?.engagements);
  const exchanges = runtimeCount(rendererRuntime?.exchanges);

  const lang = currentLang();
  const presentation = getBattlePresentation(stage.id);
  const allyName = resolvePresentationCopy(null, presentation.allyLabel, stage.id, "allyLabel");
  const bossName = lang === "ko" ? translate(`stage.${stage.id}.bossName`) || stage.bossName : stage.bossName;

  elements.battleAllyLabel.textContent = lang === "ko"
    ? `${allyName} · ${state.legion}/${state.capacity} 실체화됨`
    : `${allyName} · ${state.legion}/${state.capacity} fielded`;
  elements.battleFallbackAllyLabel.textContent = elements.battleAllyLabel.textContent;
  elements.battleField.dataset.runtimeMode = rendererMode;
  elements.battleField.dataset.engagements = String(engagements);
  elements.battleField.dataset.exchanges = String(exchanges);

  if (!encounter) {
    const bossLabel = lang === "ko"
      ? `${bossName} · 체력 ${state.bossHealth}/${stage.bossHealth}`
      : `${stage.bossName} · ${state.bossHealth}/${stage.bossHealth} HP`;
    elements.battleHostileLabel.textContent = bossLabel;
    elements.battleFallbackHostileLabel.textContent = bossLabel;
    if (!stageBriefingOpen) {
      const pressureText = lang === "ko"
        ? `보스 명령 · ${bossName}`
        : `BOSS COMMAND · ${stage.bossName.toUpperCase()}`;
      setBattlePressure("preparation", pressureText);
    }
    return;
  }

  if (activeWave) {
    const waveIndex = stage.encounter.waves.findIndex((wave) => wave.id === activeWave.id) + 1;
    const waveName = lang === "ko" ? translate(`wave.${activeWave.id}`) || activeWave.id : activeWave.id;
    const waveLabel = lang === "ko"
      ? `${waveName.toUpperCase()} · 적 ${activeWave.hostiles}명`
      : `${activeWave.id.toUpperCase()} · ${activeWave.hostiles} HOSTILES`;
    elements.battleHostileLabel.textContent = waveLabel;
    elements.battleFallbackHostileLabel.textContent = waveLabel;
    if (!stageBriefingOpen) {
      const pressureText = lang === "ko"
        ? `웨이브 진행 중 · ${waveIndex}/${stage.encounter.waves.length} · ${waveName.toUpperCase()}`
        : `LIVE WAVE · ${waveIndex}/${stage.encounter.waves.length} · ${activeWave.id.toUpperCase()}`;
      setBattlePressure("live", pressureText);
    }
    return;
  }

  if (encounter.bossExposed) {
    const bossLabel = lang === "ko"
      ? `${bossName} · 체력 ${state.bossHealth}/${stage.bossHealth}`
      : `${stage.bossName} · ${state.bossHealth}/${stage.bossHealth} HP`;
    elements.battleHostileLabel.textContent = bossLabel;
    elements.battleFallbackHostileLabel.textContent = bossLabel;
    if (!stageBriefingOpen) {
      const pressureText = lang === "ko"
        ? `보스 노출됨 · ${bossName}`
        : `BOSS EXPOSED · ${stage.bossName.toUpperCase()}`;
      setBattlePressure("live", pressureText);
    }
    return;
  }

  const nextWaveIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  const nextWave = stage.encounter.waves[nextWaveIndex];
  
  let nextLabel, pressureText;
  if (lang === "ko") {
    if (nextWave) {
      const waveName = translate(`wave.${nextWave.id}`) || nextWave.id;
      nextLabel = `${waveName.toUpperCase()} 진입 대기 중 · 적 ${nextWave.hostiles}명`;
      pressureText = `전투 준비 · 웨이브 ${nextWaveIndex + 1}/${stage.encounter.waves.length} · ${waveName.toUpperCase()}`;
    } else {
      nextLabel = "전투 대기 중";
      pressureText = "전투 준비 · 대기 중";
    }
  } else {
    if (nextWave) {
      nextLabel = `${nextWave.id.toUpperCase()} INBOUND · ${nextWave.hostiles} HOSTILES`;
      pressureText = `PREPARATION · WAVE ${nextWaveIndex + 1}/${stage.encounter.waves.length} · ${nextWave.id.toUpperCase()}`;
    } else {
      nextLabel = "ENCOUNTER STANDING BY";
      pressureText = "PREPARATION · STANDING BY";
    }
  }
  
  elements.battleHostileLabel.textContent = nextLabel;
  elements.battleFallbackHostileLabel.textContent = nextLabel;
  if (!stageBriefingOpen) {
    setBattlePressure("preparation", pressureText);
  }
}

function synchronizeBattleRenderer(renderer = visualizer) {
  if (!renderer || !campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const encounter = currentEncounter(stage, state);
  renderer.applyCampaignState({
    campaign,
    stage,
    state,
    integrity: state.integrity,
    maxIntegrity: getCampaignBenefits(campaign).maxIntegrity,
    bossHealth: state.bossHealth,
    bossMax: stage.bossHealth,
    aegis: state.aegis ?? 0
  });
  renderer.applyEncounter({
    stageId: stage.id,
    config: stage.encounter ?? null,
    state: encounter ?? { waves: [], activeWaveId: null, bossExposed: true, spawningStopped: true }
  });
}

function handleRendererRuntime(runtime, sessionId, source) {
  if (source !== visualizer || sessionId !== battleSessionId || campaign?.status !== "active") return;
  rendererRuntime = runtime ?? null;
  projectBattleRuntime();
}

function scheduleEncounterWaveStart(sessionId = battleSessionId) {
  clearEncounterStartTimer();
  if (campaign?.status !== "active" || sessionId !== battleSessionId) return;
  const stage = currentStage();
  const encounter = currentEncounter(stage);
  if (!stage.encounter || !encounter || encounter.activeWaveId || encounter.bossExposed || encounter.spawningStopped) return;

  const waveIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  const wave = stage.encounter.waves[waveIndex];
  if (!wave) return;
  const scheduledAtSeconds = waveIndex === 0
    ? Math.max(wave.spawnAtSeconds, stage.encounter.preparationSeconds)
    : wave.spawnAtSeconds;
  const elapsed = performance.now() - battleStartedAt;
  const delay = Math.max(0, scheduledAtSeconds * 1000 - elapsed);
  encounterStartTimer = window.setTimeout(() => {
    encounterStartTimer = 0;
    void handleEncounterEvent({ type: "start-wave", stageId: stage.id, waveId: wave.id }, sessionId);
  }, delay);
}

function handleEncounterEvent(event, sessionId = battleSessionId, source = null) {
  const transition = async () => {
    if (
      campaign?.status !== "active" ||
      sessionId !== battleSessionId ||
      (source !== null && source !== visualizer)
    ) return;

    const result = applyEncounterEvent(campaign, event);
    if (!result.accepted) {
      synchronizeBattleRenderer();
      return;
    }

    campaign = result.state;
    const encounter = currentEncounter();
    if (campaign.status !== "active" || encounter?.bossExposed || encounter?.spawningStopped) {
      clearEncounterStartTimer();
    }
    await persistCampaign(`persist.encounter.${event.type}`);
    render();
    synchronizeBattleRenderer();

    if (
      event.type === "wave-cleared" &&
      campaign.status === "active" &&
      !currentEncounter()?.bossExposed &&
      !currentEncounter()?.spawningStopped
    ) {
      scheduleEncounterWaveStart(sessionId);
    }
  };
  encounterEventQueue = encounterEventQueue.then(transition, transition);
  return encounterEventQueue;
}

function stopBattle() {
  battleSessionId += 1;
  clearEncounterStartTimer();
  window.clearInterval(cooldownTimer);
  battleStartedAt = 0;
  rendererRuntime = null;
  encounterEventQueue = Promise.resolve();
  cooldownTimer = 0;
  battleVisualFallback = false;
  cooldowns.clear();
  pendingCommandFocus = false;
  pendingBattleRenderer?.destroy();
  pendingBattleRenderer = null;
  battleStarting = false;
  visualizer?.destroy();
  visualizer = null;
}

function activateBattleFallback(stage, sessionId) {
  battleVisualFallback = true;
  renderBattleAssetStatus({ state: "unavailable" });
  renderBattlePresentation(stage);
  let fallback = null;
  fallback = new BattleVisualizer(elements.battleFallbackCanvas, getBattlePresentation(stage.id), {
    nodeGoal: stage.nodeGoal,
    getAvailableActions: () => campaign ? getAvailableActions(campaign) : [],
    onAssetStatus: renderBattleAssetStatus,
    onActionRequest: (action) => void handleAction(action),
    onEncounterEvent: (event) => void handleEncounterEvent(event, sessionId, fallback),
    onRuntimeState: (runtime) => handleRendererRuntime(runtime, sessionId, fallback)
  });
  try {
    fallback.init();
    return fallback;
  } catch {
    fallback.destroy();
    return null;
  }
}

async function startBattle() {
  if (!campaign || campaign.status !== "active" || visualizer || cooldownTimer || battleStarting) return;
  battleStarting = true;
  lastScrolledStageId = null;
  const sessionId = ++battleSessionId;
  rendererRuntime = null;
  battleVisualFallback = false;
  cooldownTimer = window.setInterval(render, 100);
  let battleRenderer = null;
  const stage = currentStage();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    visualizer = activateBattleFallback(stage, sessionId);
    battleStarting = false;
  } else {
    try {
      const presentation = renderBattlePresentation(stage);
      battleRenderer = new RealtimeBattle(elements.battleCanvas3d, presentation, {
        nodeGoal: stage.nodeGoal,
        onAssetStatus: renderBattleAssetStatus,
        onActionRequest: (action) => void handleAction(action),
        onEncounterEvent: (event) => void handleEncounterEvent(event, sessionId, battleRenderer),
        onRuntimeState: (runtime) => handleRendererRuntime(runtime, sessionId, battleRenderer),
        onRendererFailure: () => {
          if (visualizer !== battleRenderer || sessionId !== battleSessionId || campaign?.status !== "active") return;
          visualizer = activateBattleFallback(currentStage(), sessionId);
          synchronizeBattleRenderer();
          projectBattleRuntime();
        },
      });
      pendingBattleRenderer = battleRenderer;
      await battleRenderer.init();
      if (sessionId !== battleSessionId || campaign?.status !== "active") {
        battleRenderer.destroy();
        return;
      }
      visualizer = battleRenderer;
      if (pendingBattleRenderer === battleRenderer) pendingBattleRenderer = null;
    } catch {
      battleRenderer?.destroy();
      if (sessionId !== battleSessionId || campaign?.status !== "active") return;
      visualizer = activateBattleFallback(currentStage(), sessionId);
    } finally {
      if (pendingBattleRenderer === battleRenderer) pendingBattleRenderer = null;
      if (!pendingBattleRenderer) battleStarting = false;
    }
  }
  if (sessionId !== battleSessionId || campaign?.status !== "active" || !visualizer) return;
  synchronizeBattleRenderer();
  projectBattleRuntime();
  render();
  armEncounterWhenPrepared(sessionId);
}


function battleUiActive() {
  return cooldownTimer !== 0 && !battleStarting && visualizer !== null;
}

// The cockpit has ONE screen. The result overlay opens whenever the engine
// leaves "active" (reward / defeat / campaign-complete); the battle session
// starts and stops as a side effect of the same status sync.
function syncCockpit() {
  if (!campaign || elements.screen.hidden) return;
  if (campaign.status !== "active") stageBriefingOpen = false;
  const briefingShould = campaign.status === "active" && stageBriefingOpen;
  setMissionBriefingModal(briefingShould);
  elements.saveDock.hidden = briefingShould;
  if (briefingShould) setBattlePressure("briefing", "MISSION BRIEFING · COMMAND PENDING");

  const overlayShould = campaign.status !== "active";
  const overlayChanged = overlayShould !== resultOverlayOpen;
  resultOverlayOpen = overlayShould;
  setResultModal(overlayShould);
  if (overlayChanged && overlayShould) {
    stopBattle();
    window.requestAnimationFrame(() => {
      (campaign.status === "reward"
        ? elements.rewardOptions.querySelector("button")
        : campaign.status === "campaign-complete"
          ? document.querySelector("#completion-heading")
          : campaign.status === "defeat"
            ? elements.retryFromResult
            : elements.returnToLobbyFromResult)?.focus();
    });
  }
  if (campaign.status === "active" && !stageBriefingOpen && !visualizer && !cooldownTimer) startBattle();
}

// Sets an <img> to `source`, swapping to `fallback` once if the file is not
// shipped yet (stages 4-10 art lands asset-by-asset).
function applyStageArt(img, source, fallback) {
  if (img.dataset.artSource === source) return;
  img.dataset.artSource = source;
  img.onerror = fallback && fallback !== source
    ? () => { img.onerror = null; img.src = fallback; }
    : null;
  img.src = source;
}

function renderBossSpec(stage, state, benefits) {
  const spec = BOSS_SPEC[stage.number - 1];
  applyStageArt(elements.bossSpecPortrait, BOSS_BY_STAGE[stage.id], BOSS_FALLBACK_BY_STAGE[stage.id]);
  
  const lang = currentLang();
  const bossName = lang === "ko" ? translate(`stage.${stage.id}.bossName`) || stage.bossName : stage.bossName;
  const lore = lang === "ko" ? translate(`boss.${stage.id}.lore`) || spec.lore : spec.lore;
  const threat = lang === "ko" ? translate(`boss.${stage.id}.threat`) || spec.threat : spec.threat;
  const nodeGoalText = lang === "ko"
    ? `장악 거점 ${stage.nodeGoal}개`
    : `${stage.nodeGoal} Node${stage.nodeGoal === 1 ? "" : "s"}`;
  
  elements.bossSpecPortrait.alt = lang === "ko" ? `${bossName} 초상화` : `${stage.bossName} portrait`;
  elements.bossSpecName.textContent = bossName;
  elements.bossSpecLore.textContent = lore;
  elements.bossSpecThreat.textContent = threat;
  elements.bossSpecHp.textContent = lang === "ko"
    ? `체력 ${state.bossHealth} / ${stage.bossHealth}`
    : `${state.bossHealth} / ${stage.bossHealth} HP`;
  elements.bossSpecCounter.textContent = String(spec.counter);
  elements.bossSpecNodes.textContent = nodeGoalText;
  
  elements.statMaxIntegrity.textContent = String(benefits.maxIntegrity);
  elements.statCooldownReduction.textContent = `${Math.round(benefits.cooldownReduction * 100)}%`;
  
  let combatModifiers = [];
  if (lang === "ko") {
    if (benefits.extraAssaultDamage > 0) combatModifiers.push(`총공격 +${benefits.extraAssaultDamage}`);
    if (benefits.lensDamage > 0) combatModifiers.push(`빙의 +${benefits.lensDamage}`);
    if (benefits.counterReduction > 0) combatModifiers.push(`반격 감소 −${benefits.counterReduction}`);
  } else {
    if (benefits.extraAssaultDamage > 0) combatModifiers.push(`Assault +${benefits.extraAssaultDamage}`);
    if (benefits.lensDamage > 0) combatModifiers.push(`Possession +${benefits.lensDamage}`);
    if (benefits.counterReduction > 0) combatModifiers.push(`Counter −${benefits.counterReduction}`);
  }
  elements.statExtraDamage.textContent = combatModifiers.join(" · ") || (lang === "ko" ? "없음" : "None");
  
  const activeItemNames = benefits.activeItemNames.map(name => {
    let rewardId = "";
    for (const s of STAGES) {
      const r = s.rewards.find(reward => reward.name === name);
      if (r) { rewardId = r.id; break; }
    }
    return (lang === "ko" && rewardId) ? translate(`reward.${rewardId}.name`) : name;
  });
  elements.statActiveItems.textContent = activeItemNames.length ? activeItemNames.join(", ") : (lang === "ko" ? "없음" : "None");
}

function renderResult(isComplete) {
  const isDefeat = campaign.status === "defeat";
  const awaitingReward = campaign.status === "reward";
  const lang = currentLang();
  
  if (lang === "ko") {
    elements.resultTitle.textContent = isDefeat ? "닻을 잃음" : isComplete ? "캠페인 완료" : "보호벽 돌파";
    elements.resultText.textContent = isDefeat ? "패배" : "승리";
  } else {
    elements.resultTitle.textContent = isDefeat ? "Anchor Lost" : isComplete ? "Campaign Complete" : "Ward Broken";
    elements.resultText.textContent = isDefeat ? "DEFEAT" : "VICTORY";
  }
  
  elements.resultText.className = `result-text ${isDefeat ? "defeat" : "victory"}`;
  elements.rewardPanel.hidden = !awaitingReward;
  elements.retryFromResult.hidden = !isDefeat;
}

function renderCooldown(button, action, available) {
  const remaining = remainingCooldown(action);
  const cooling = remaining > 0;
  const enabled = battleUiActive() && available && !cooling;
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
  const overlay = button.querySelector(".cooldown-overlay");
  const timer = button.querySelector(".cooldown-timer");
  if (overlay) overlay.hidden = !cooling;
  if (timer) timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
}



function focusPendingCommand() {
  if (!pendingCommandFocus || stageBriefingOpen || !battleUiActive()) return;
  const command = elements.commandButtons[0];
  if (!command || command.disabled) return;
  pendingCommandFocus = false;
  command.focus({ preventScroll: true });
}

function render() {
  if (!campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const available = new Set(getAvailableActions(campaign));
  const isComplete = campaign.status === "campaign-complete";
  renderBattlePresentation(stage);
  renderMissionBriefing(stage);

  const lang = currentLang();
  const checklist = getStageChecklist(campaign);
  const pendingChecklistItem = checklist.find((item) => !item.complete && !item.optional);
  
  elements.stageNumber.textContent = lang === "ko"
    ? `10단계 중 ${stage.number}단계`
    : `Stage ${stage.number} of ${STAGES.length}`;
  
  elements.stageHeading.textContent = lang === "ko" ? translate(`stage.${stage.id}.title`) || stage.title : stage.title;
  elements.stageRegion.textContent = lang === "ko" ? translate(`stage.${stage.id}.region`) || stage.region : stage.region;
  
  elements.stageObjective.textContent = pendingChecklistItem
    ? getChecklistLabel(pendingChecklistItem, lang)
    : (lang === "ko" ? translate(`stage.${stage.id}.objective`) || stage.objective : stage.objective);
    
  const hasRewardCarryMessage = campaign.lastMessage.endsWith(` carries into ${stage.title}.`);
  const stageEntryOrder = entryGuidanceStageId === stage.id && campaign.status === "active" && state.hunted === 0 && !state.extracted;
  
  const translatedLastMessage = translateStatusMessage(campaign.lastMessage, lang);
  let statusText = "";
  if (hasRewardCarryMessage && stageEntryOrder) {
    statusText = lang === "ko"
      ? `${translatedLastMessage} 첫 명령: 균열 흔적을 두 번 사냥하십시오.`
      : `${campaign.lastMessage} First order: Hunt two rift spoor.`;
  } else if (hasRewardCarryMessage) {
    statusText = translatedLastMessage;
  } else if (stageEntryOrder) {
    statusText = lang === "ko"
      ? "첫 명령: 균열 흔적을 두 번 사냥하십시오."
      : "First order: Hunt two rift spoor.";
  } else if (battleVisualFallback && battleUiActive()) {
    statusText = lang === "ko"
      ? "전투 시각화가 비활성화되었습니다. 명령 시스템은 준비 완료되었습니다."
      : "Battle visualization is unavailable; command rules remain ready.";
  } else {
    statusText = translatedLastMessage;
  }
  elements.status.textContent = statusText;

  elements.souls.textContent = String(state.souls);
  elements.legion.textContent = `${state.legion} / ${state.capacity}`;
  elements.nodes.textContent = `${state.nodes} / ${stage.nodeGoal}`;
  elements.integrity.textContent = `${state.integrity} / ${benefits.maxIntegrity}`;
  
  const bossNameKo = translate(`stage.${stage.id}.bossName`) || stage.bossName;
  elements.bossLabel.textContent = lang === "ko"
    ? `${bossNameKo} 보호벽`
    : `${stage.bossName} ward`;
    
  elements.boss.textContent = `${state.bossHealth} / ${stage.bossHealth}`;
  elements.retry.disabled = campaign.status === "reward" || isComplete;
  elements.complete.hidden = !isComplete;
  
  elements.completionSummary.textContent = isComplete ? translatedLastMessage : "";
  
  renderBossSpec(stage, state, benefits);
  renderResult(isComplete);
  syncCockpit();

  if (pendingChecklistItem) {
    let guideId = pendingChecklistItem.id;
    if (guideId.startsWith("wave-")) {
      guideId = "wave";
    }
    const currentText = translate(`guide.${guideId}.current`);
    const whyText = translate(`guide.${guideId}.why`);
    const loopText = translate(`guide.${guideId}.loop`);
    const fantasyText = translate("mission.fantasy");
    const winText = translate("mission.winCondition");
    const lossText = translate("mission.lossCondition");
    
    if (elements.battleMissionCurrent) {
      elements.battleMissionCurrent.textContent = currentText;
    }
    if (elements.battleMissionWhy) {
      elements.battleMissionWhy.textContent = `${whyText} [${loopText}] \n(${fantasyText} | ${winText} | ${lossText})`;
    }
  } else {
    if (elements.battleMissionCurrent) {
      elements.battleMissionCurrent.textContent = "";
    }
    if (elements.battleMissionWhy) {
      elements.battleMissionWhy.textContent = "";
    }
  }

  const nextObjectiveAction = pendingChecklistItem?.id;
  projectBattleRuntime();
  
  for (const button of elements.commandButtons) {
    const action = button.dataset.action;
    const isCurrentObjective = action === nextObjectiveAction;
    const isAvailable = available.has(action);
    renderCooldown(button, action, isAvailable);
    button.classList.toggle("current-objective", isCurrentObjective);
    if (isCurrentObjective) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    
    const small = button.querySelector("small");
    if (small) {
      small.textContent = getCommandDescription(action, isAvailable, lang);
    }
    
    const nameText = button.querySelector("strong")?.textContent || action;
    const descText = small ? small.textContent : "";
    if (!isAvailable) {
      const reason = getCommandLockReason(action, lang);
      button.setAttribute("title", reason);
      button.setAttribute("aria-label", lang === "ko" ? `${nameText} (${descText}) - 잠김: ${reason}` : `${nameText} (${descText}) - locked: ${reason}`);
    } else {
      button.removeAttribute("title");
      button.setAttribute("aria-label", `${nameText} (${descText})`);
    }
  }
  
  for (const button of elements.stageButtons) {
    const stageNumber = Number(button.dataset.stageNumber);
    const definition = STAGES[stageNumber - 1];
    if (!definition) { button.hidden = true; continue; }
    const active = stageNumber === stage.number && !isComplete;
    const cleared = stageNumber < stage.number || isComplete;
    button.disabled = true;
    button.classList.toggle("active", active);
    button.classList.toggle("cleared", cleared);
    button.classList.toggle("locked", !active && !cleared);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    
    const definitionTitle = lang === "ko" ? translate(`stage.${definition.id}.title`) || definition.title : definition.title;
    const activeText = lang === "ko" ? "현재 스테이지" : "current stage";
    const clearedText = lang === "ko" ? "완료됨" : "cleared";
    const lockedText = lang === "ko" ? "잠김" : "locked";
    
    button.setAttribute("aria-label", `${definitionTitle}: ${active ? activeText : cleared ? clearedText : lockedText}`);
    if (active && battleUiActive() && lastScrolledStageId !== stage.id) {
      lastScrolledStageId = stage.id;
      button.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }

  renderChecklist(checklist);
  if (campaign.status === "reward") renderRewards(stage);
  renderStageMedia(stage);
  syncNarration();
  focusPendingCommand();
}

async function resumeCampaign() {
  const resumableCampaign = campaign ?? storedCampaign;
  if (!resumableCampaign) return;
  stopBattle();
  stageBriefingOpen = false;
  entryGuidanceStageId = null;
  campaign = resumableCampaign.status === "briefing"
    ? startCampaign(createCampaign()).state
    : resumableCampaign;
  storedCampaign = campaign;
  updateResumeAffordance();
  revealCampaign();
  if (resumableCampaign.status === "briefing") await persistCampaign("persist.importedBriefingStarted");
}

function revealCampaign() {
  elements.lobby.hidden = true;
  elements.screen.hidden = false;
  updateResumeAffordance();
  syncBackgroundEffects();
  render();
  if (campaign.status === "active") {
    window.requestAnimationFrame(() => (stageBriefingOpen ? elements.startCombat : elements.stageHeading).focus());
  }
}

function playCue(effect) {
  const source = CUE_BY_EFFECT[effect];
  if (!source) return;
  if (!cuePlayer) {
    cuePlayer = new Audio();
    cuePlayer.preload = "none";
    cuePlayer.addEventListener("error", () => undefined);
  }
  cuePlayer.pause();
  cuePlayer.currentTime = 0;
  cuePlayer.src = source;
  cuePlayer.play().catch(() => undefined);
}

function waitForNarration(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setTypedNarrationLine(line) {
  elements.narrationLine.textContent = line;
  elements.briefingNarration.textContent = line;
}

async function typeNarration(entry, run) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const line of entry.lines) {
    if (run !== narrationRun) return;
    setTypedNarrationLine("");
    elements.narrationLine.classList.toggle("is-typing", !reduceMotion);
    if (reduceMotion) {
      setTypedNarrationLine(line);
    } else {
      for (let index = 1; index <= line.length; index += 1) {
        if (run !== narrationRun) return;
        setTypedNarrationLine(line.slice(0, index));
        await waitForNarration(entry.msPerChar);
      }
    }
    await waitForNarration(entry.holdMs);
  }
  if (run === narrationRun) elements.narrationLine.classList.remove("is-typing");
}

function playNarration(key) {
  const entry = NARRATION[key];
  if (!entry) return false;
  const run = ++narrationRun;
  elements.narrationSr.textContent = entry.lines.join(" ");
  void typeNarration(entry, run);
  if (!narrationPlayer) {
    narrationPlayer = new Audio();
    narrationPlayer.preload = "none";
    narrationPlayer.addEventListener("error", () => undefined);
  }
  narrationPlayer.pause();
  narrationPlayer.currentTime = 0;
  if (entry.audio) {
    narrationPlayer.src = entry.audio;
    narrationPlayer.play().catch(() => undefined);
  } else {
    narrationPlayer.removeAttribute("src");
  }
  return true;
}

function openCurrentStageBriefing(narrationKey = currentStage().id) {
  if (!campaign || campaign.status !== "active") return;
  stageBriefingOpen = true;
  narratedOutcome = null;
  narratedStageId = currentStage().id;
  playNarration(narrationKey);
  pendingCommandFocus = false;
}

function syncNarration() {
  if (!campaign) return;
  const stage = currentStage();
  if (campaign.status === "campaign-complete") {
    if (narratedOutcome !== "victory") {
      narratedOutcome = "victory";
      playNarration("victory");
    }
    return;
  }
  if (campaign.status === "defeat") {
    if (narratedOutcome !== "defeat") {
      narratedOutcome = "defeat";
      playNarration("defeat");
    }
    return;
  }
  narratedOutcome = null;
  if (stageBriefingOpen) return;
  if (narratedStageId !== stage.id) {
    narratedStageId = stage.id;
    playNarration(stage.id);
  }
}

function flashEffect(effect) {
  const run = () => {
    elements.effect.className = "visual-effect";
    void elements.effect.offsetWidth;
    elements.effect.classList.add("is-active", `effect-${effect}`);
    elements.effect.addEventListener("animationend", () => {
      elements.effect.className = "visual-effect";
    }, { once: true });
  };
  if (["materialize", "domain", "assault"].includes(effect)) {
    elements.effect.className = "visual-effect effect-inversion is-active";
    setTimeout(run, 150);
  } else {
    run();
  }
}

async function persistCampaign(contextKey = "persist.campaignSaved") {
  if (!campaign) return;
  const envelope = createSaveEnvelope(campaign);
  storedCampaign = campaign;
  updateResumeAffordance();
  const savedTo = await storage.save(envelope);
  campaignMirror?.publish(envelope);
  const lang = currentLang();
  const localizedContext = translate(contextKey) || contextKey;
  const statusMsg = lang === "ko"
    ? `${localizedContext} (${savedTo}에 저장됨)`
    : `${localizedContext} in ${savedTo}.`;
  setSaveStatus(statusMsg);
}

async function applyMirroredCampaign(envelope) {
  try {
    const mirroredCampaign = restoreSaveEnvelope(envelope);
    storedCampaign = mirroredCampaign;
    updateResumeAffordance();
    await storage.save(envelope);
    if (campaign) {
      stopBattle();
      campaign = mirroredCampaign;
      narratedStageId = null;
      narratedOutcome = null;
      render();
    }
    setSaveStatus(translate("saveStatus.mirroredApplied"));
  } catch {
    // The mirror validates structure; replay validation keeps incompatible saves local.
  }
}

function triggerBattleVisual(action, details = {}) {
  if (!campaign) return;
  const semantic = BATTLE_ACTION_SEMANTICS[action];
  if (!semantic) return;
  if (visualizer) {
    visualizer.playActionEffect({ ...semantic, action, ...details });
    return;
  }
  flashEffect(action);
  playCue(action);
}

function startActionCooldown(action) {
  const benefits = getCampaignBenefits(campaign);
  const duration = COOLDOWN_SECONDS[action] * (1 - benefits.cooldownReduction);
  cooldowns.set(action, performance.now() + duration * 1000);
}

async function handleAction(action) {
  if (!campaign || !battleUiActive() || resultOverlayOpen || remainingCooldown(action) > 0) return;
  if (!getAvailableActions(campaign).includes(action)) return;

  const stage = currentStage();
  const priorCampaign = campaign;
  const result = action === "assault" && stage.encounter
    ? applyEncounterEvent(campaign, { type: "boss-assault", stageId: stage.id })
    : applyAction(campaign, action);
  const materializeCount = action === "materialize" && result.accepted
    ? result.state.stage.legion - priorCampaign.stage.legion
    : 0;
  campaign = result.state;
  if (campaign.status !== "active" || currentEncounter()?.bossExposed || currentEncounter()?.spawningStopped) {
    clearEncounterStartTimer();
  }
  if (!result.accepted) {
    render();
    return;
  }

  startActionCooldown(action);
  synchronizeBattleRenderer();
  armEncounterWhenPrepared();
  triggerBattleVisual(action, action === "materialize" ? { count: materializeCount } : {});
  render();
  await persistCampaign("persist.campaignSaved");
}

async function handleReward(rewardId) {
  if (!campaign || !resultOverlayOpen) return;
  const result = chooseReward(campaign, rewardId);
  campaign = result.state;
  if (!result.accepted) {
    render();
    return;
  }
  flashEffect("reward");
  playCue("reward");
  await persistCampaign("persist.rewardAndCampaignSaved");
  if (campaign.status === "campaign-complete") {
    render();
    document.querySelector("#completion-heading")?.focus();
    return;
  }
  openCurrentStageBriefing(currentStage().id);
  render();
  window.requestAnimationFrame(() => elements.startCombat.focus());
}

async function beginNewCampaign() {
  if (campaign && campaign.trace.length > 0 && !window.confirm(translate("confirm.newCampaign"))) return;
  stopBattle();
  entryGuidanceStageId = null;
  const result = startCampaign(createCampaign());
  campaign = result.state;
  storedCampaign = campaign;
  updateResumeAffordance();
  openCurrentStageBriefing("intro");
  revealCampaign();
  flashEffect("awaken");
  await persistCampaign("persist.newCampaignSaved");
}

async function returnToLobby() {
  if (!campaign) return;
  stopBattle();
  stageBriefingOpen = false;
  entryGuidanceStageId = null;
  storedCampaign = campaign;
  resultOverlayOpen = false;
  setResultModal(false);
  setMissionBriefingModal(false);
  await persistCampaign("persist.campaignReturnedToCommandLobby");
  elements.screen.hidden = true;
  elements.lobby.hidden = false;
  syncBackgroundEffects();
  updateResumeAffordance();
  window.requestAnimationFrame(() => elements.resume.focus());
}

async function handleRetry() {
  if (!campaign) return;
  const result = retryStage(campaign);
  campaign = result.state;
  if (!result.accepted) {
    render();
    return;
  }
  flashEffect("retry");
  entryGuidanceStageId = null;
  await persistCampaign("persist.stageRetrySaved");
  // Engine is back to "active": render() closes the overlay and restarts
  // the battle session on the same cockpit screen.
  render();
  window.requestAnimationFrame(() => elements.stageHeading.focus());
}

function beginStageCombat() {
  if (!campaign || campaign.status !== "active" || !stageBriefingOpen) return;
  stageBriefingOpen = false;
  entryGuidanceStageId = currentStage().id;
  pendingCommandFocus = true;
  render();
}

function exportSave() {
  if (!campaign) return;
  const blob = new Blob([JSON.stringify(createSaveEnvelope(campaign), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "abyssal-surge-campaign-save.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSaveStatus(translate("saveStatus.exported"));
}

async function importSave(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSaveStatus(translate("importTooLarge"));
    elements.importSave.value = "";
    return;
  }
  try {
    const envelope = JSON.parse(await file.text());
    const importedCampaign = restoreSaveEnvelope(envelope);
    stopBattle();
    campaign = importedCampaign.status === "briefing"
      ? startCampaign(createCampaign()).state
      : importedCampaign;
    stageBriefingOpen = false;
    entryGuidanceStageId = null;
    storedCampaign = campaign;
    updateResumeAffordance();
    revealCampaign();
    await persistCampaign("persist.importedCampaignSaved");
    flashEffect("reward");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "invalid save file";
    setSaveStatus(translate("importRejected").replace("{error}", errorMsg));
  } finally {
    elements.importSave.value = "";
  }
}

function toggleAmbience() {
  if (!ambiencePlayer) {
    ambiencePlayer = new Audio("assets/audio/ambient.mp3");
    ambiencePlayer.loop = true;
    ambiencePlayer.preload = "none";
    ambiencePlayer.addEventListener("error", () => {
      ambiencePlayer.pause();
      elements.ambience.textContent = "Ambient sound unavailable";
      elements.ambience.setAttribute("aria-pressed", "false");
    });
  }
  if (ambiencePlayer.paused) {
    ambiencePlayer.play().then(() => {
      elements.ambience.textContent = "Pause ambient sound";
      elements.ambience.setAttribute("aria-pressed", "true");
    }).catch(() => {
      elements.ambience.textContent = "Ambient sound unavailable";
    });
  } else {
    ambiencePlayer.pause();
    elements.ambience.textContent = "Play ambient sound";
    elements.ambience.setAttribute("aria-pressed", "false");
  }
}
function toggleBgm() {
  const player = elements.bgmPlayer;
  const toggle = elements.bgmToggle;
  if (!player || !toggle) return;
  if (player.paused) {
    player.volume = 0.55;
    player.play().then(() => {
      toggle.classList.add("is-playing");
      toggle.setAttribute("aria-pressed", "true");
    }).catch(() => {
      toggle.classList.remove("is-playing");
      toggle.setAttribute("aria-pressed", "false");
    });
  } else {
    player.pause();
    toggle.classList.remove("is-playing");
    toggle.setAttribute("aria-pressed", "false");
  }
}


function cinematicCopy(key) {
  return CINEMATIC_COPY[currentLang()]?.[key] ?? CINEMATIC_COPY.ko[key];
}

function setCinematicStatus(key) {
  cinematicStatusKey = key;
  elements.cinematicStatus.textContent = cinematicCopy(key);
}

function syncCinematicCopy() {
  const transcriptOpen = !elements.cinematicTranscript.hidden;
  const transcriptToggleLabel = cinematicCopy(transcriptOpen ? "transcriptHide" : "transcriptShow");
  elements.cinematicTranscriptToggle.textContent = transcriptToggleLabel;
  elements.cinematicTranscriptToggle.setAttribute("aria-label", transcriptToggleLabel);
  elements.cinematicTranscriptHeading.textContent = cinematicCopy("transcriptHeading");
  elements.cinematicTranscriptIntro.textContent = cinematicCopy("transcriptIntro");
  elements.cinematicTranscriptBrief.textContent = cinematicCopy("transcriptBrief");
  elements.cinematicStatus.textContent = cinematicCopy(cinematicStatusKey);
}

function toggleCinematicTranscript() {
  const open = elements.cinematicTranscript.hidden;
  elements.cinematicTranscript.hidden = !open;
  elements.cinematicTranscriptToggle.setAttribute("aria-expanded", String(open));
  syncCinematicCopy();
  (open ? elements.cinematicTranscript : elements.cinematicTranscriptToggle).focus();
}

function playCinematic() {
  const video = elements.cinematic;
  video.hidden = false;
  video.muted = true;
  elements.cinematicButton.disabled = true;
  setCinematicStatus("loading");
  video.onloadeddata = () => {
    elements.cinematicButton.disabled = false;
    setCinematicStatus("playing");
    video.play().catch(() => {
      setCinematicStatus("ready");
    });
  };
  video.onerror = () => {
    video.pause();
    video.hidden = true;
    video.removeAttribute("src");
    video.load();
    elements.cinematicButton.disabled = false;
    setCinematicStatus("unavailable");
  };
  video.src = "assets/video/abyssal-surge-cinematic.mp4";
  video.load();
}

function wireControls() {
  elements.start.addEventListener("click", beginNewCampaign);
  elements.restart.addEventListener("click", beginNewCampaign);
  elements.resume.addEventListener("click", () => void resumeCampaign().catch(() => undefined));
  elements.returnToLobby.addEventListener("click", () => void returnToLobby());
  elements.returnToLobbyFromResult.addEventListener("click", () => void returnToLobby());
  elements.retry.addEventListener("click", handleRetry);
  elements.retryFromResult.addEventListener("click", handleRetry);
  elements.startCombat.addEventListener("click", beginStageCombat);
  elements.briefing.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    elements.startCombat.focus();
  });
  elements.resultOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void returnToLobby();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...elements.resultOverlay.querySelectorAll(
      "button:not([hidden]):not(:disabled), input:not([type='hidden']):not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
    )].filter((element) => !element.hidden && !element.inert && element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  elements.commandButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  elements.exportSave.addEventListener("click", exportSave);
  elements.importSave.addEventListener("change", () => importSave(elements.importSave.files?.[0]));
  elements.ambience.addEventListener("click", toggleAmbience);
  elements.bgmToggle?.addEventListener("click", toggleBgm);
  elements.cinematicButton.addEventListener("click", playCinematic);
  elements.cinematicTranscriptToggle.addEventListener("click", toggleCinematicTranscript);
  elements.cinematicTranscript.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleCinematicTranscript();
  });
  elements.languageToggle?.addEventListener("click", () => window.requestAnimationFrame(() => {
    updateResumeAffordance();
    syncCinematicCopy();
    if (campaign) render();
  }));
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const action = ACTION_KEYS[event.key.toLowerCase()];
    const focusOwner = document.activeElement;
    if (focusOwner === elements.battleCanvas3d) {
      if (action === "domain") return;
    } else if (focusOwner !== document.body && focusOwner !== document.documentElement) {
      return;
    }
    if (action && battleUiActive() && !resultOverlayOpen && campaign && getAvailableActions(campaign).includes(action)) {
      event.preventDefault();
      void handleAction(action);
    }
  });
}

function startLiquidEtherBackground() {
  if (!elements.screen.hidden || liquidEtherBackground || liquidEtherLoad) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const container = document.querySelector("#liquid-ether-bg");
  if (!container) return;
  liquidEtherLoad = import("./liquid-ether.js")
    .then(({ createLiquidEther }) => {
      if (!elements.screen.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      liquidEtherBackground = createLiquidEther(container, {
        colors: ["#6F2969", "#B32B2B", "#395781"],
        mouseForce: 20,
        cursorSize: 100,
        isViscous: false,
        viscous: 30,
        iterationsViscous: 32,
        iterationsPoisson: 32,
        resolution: 0.5,
        isBounce: false,
        autoDemo: true,
        autoSpeed: 0.5,
        autoIntensity: 2.2,
        takeoverDuration: 0.25,
        autoResumeDelay: 3000,
        autoRampDuration: 0.6
      });
      liquidEtherBackground?.start();
    })
    .catch(() => {
      // WebGL unavailable or blocked; leave the static CSS gradient background in place.
    })
    .finally(() => {
      liquidEtherLoad = null;
    });
}

function syncBackgroundEffects() {
  const liquidContainer = document.querySelector("#liquid-ether-bg");
  if (!elements.screen.hidden) {
    if (liquidContainer) liquidContainer.hidden = true;
    liquidEtherBackground?.pause();
    particleBackground?.pause();
    return;
  }
  if (liquidContainer) liquidContainer.hidden = false;
  particleBackground?.resume();
  if (liquidEtherBackground) {
    liquidEtherBackground.start();
    return;
  }
  startLiquidEtherBackground();
}

function initReactBitsEffects() {
  let particleLoop = null;
  // 1. Interactive Particles Background (Fluid Shadow Smoke Particles)
  const canvas = document.querySelector("#particles-canvas");
  const ctx = canvas?.getContext("2d");
  if (canvas && ctx) {
    let particles = [];
    const maxParticles = 50;
    let mouse = { x: -1000, y: -1000 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("mouseleave", () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // Spawn extra particles on click
    window.addEventListener("click", (e) => {
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(e.clientX, e.clientY, true));
      }
      if (particles.length > maxParticles + 20) {
        particles.splice(0, particles.length - (maxParticles + 20));
      }
    });

    class Particle {
      constructor(x, y, isSpawned = false) {
        this.isSpawned = isSpawned;
        if (isSpawned) {
          this.x = x + (Math.random() - 0.5) * 20;
          this.y = y + (Math.random() - 0.5) * 20;
          this.size = Math.random() * 4 + 2;
          this.speedY = (Math.random() - 0.5) * 1.5;
          this.speedX = (Math.random() - 0.5) * 1.5;
          this.alpha = 0.8;
        } else {
          this.reset();
          this.y = Math.random() * canvas.height;
        }
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 3 + 1;
        this.speedY = -(Math.random() * 0.8 + 0.2);
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.5 + 0.1;
        const palette = ["112, 229, 208", "171, 104, 255", "255, 122, 122", "111, 149, 235"];
        this.color = palette[Math.floor(Math.random() * palette.length)]; // aqua, purple, ember red, gate blue
      }
      update() {
        // Interaction with mouse
        if (mouse.x !== -1000) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            // Repel slightly
            const force = (120 - dist) / 120;
            this.x -= (dx / dist) * force * 1.5;
            this.y -= (dy / dist) * force * 1.5;
          }
        }

        this.y += this.speedY;
        this.x += this.speedX;

        if (this.isSpawned) {
          this.alpha -= 0.015;
          if (this.alpha <= 0) {
            const idx = particles.indexOf(this);
            if (idx > -1) particles.splice(idx, 1);
          }
        } else {
          if (this.y < -20 || this.x < -20 || this.x > canvas.width + 20) {
            this.reset();
          }
        }
      }
      draw() {
        ctx.fillStyle = `rgba(${this.color || "112, 229, 208"}, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    let particleFrame = 0;
    let particlesRunning = false;

    function drawParticles(update) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        if (!particle) continue;
        if (update) particle.update();
        particle.draw();
      }
    }

    function animateParticles() {
      if (!particlesRunning) return;
      drawParticles(true);
      particleFrame = window.requestAnimationFrame(animateParticles);
    }

    function pauseParticles() {
      particlesRunning = false;
      if (particleFrame) {
        window.cancelAnimationFrame(particleFrame);
        particleFrame = 0;
      }
    }

    function resumeParticles() {
      if (reduceMotion) {
        drawParticles(false);
        return;
      }
      if (particlesRunning) return;
      particlesRunning = true;
      animateParticles();
    }

    particleLoop = Object.freeze({ pause: pauseParticles, resume: resumeParticles });
    if (reduceMotion) {
      drawParticles(false);
      window.addEventListener("mousemove", () => drawParticles(false));
    } else {
      resumeParticles();
    }
  }

  // 2. Spotlight & Tilt Effects (only on devices with hover capability)
  if (window.matchMedia("(hover: hover)").matches) {
    const panels = document.querySelectorAll(".panel, .map-node, .storyboard-card");
    panels.forEach((panel) => {
      panel.addEventListener("mousemove", (e) => {
        const rect = panel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        panel.style.setProperty("--mouse-x", `${x}px`);
        panel.style.setProperty("--mouse-y", `${y}px`);

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6; // max 6 degrees tilt
        const rotateY = ((x - centerX) / centerX) * 6;
        panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      panel.addEventListener("mouseleave", () => {
        panel.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      });
    });

    // 3. Magnetic Buttons Effect
    const buttons = document.querySelectorAll("button:not(.battle-pointer-target), .file-button");
    buttons.forEach((btn) => {
      btn.classList.add("magnetic-button");
      window.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const btnX = rect.left + rect.width / 2;
        const btnY = rect.top + rect.height / 2;
        const dx = e.clientX - btnX;
        const dy = e.clientY - btnY;
        const dist = Math.hypot(dx, dy);

        if (dist < 70) {
          // Pull button towards cursor
          const pullX = dx * 0.25;
          const pullY = dy * 0.25;
          btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
        } else {
          btn.style.transform = "";
        }
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }
  return particleLoop;
}

async function initialize() {
  document.documentElement.dataset.rulesVersion = RULES_VERSION;
  document.documentElement.dataset.buildTag = BUILD_TAG;
  syncCinematicCopy();
  await storage.open();
  const loaded = await storage.load();
  if (loaded.envelope) {
    try {
      storedCampaign = restoreSaveEnvelope(loaded.envelope);
      updateResumeAffordance();
      setSaveStatus(translate("saveStatus.compatibleCampaign").replace("{source}", loaded.source));
    } catch {
      setSaveStatus(translate("saveStatus.incompatibleCampaign"));
    }
  } else {
    setSaveStatus(storage.mode === "indexeddb" ? translate("saveStatus.noCampaignIndexedDb") : translate("saveStatus.indexedDbUnavailable"));
  }
  campaignMirror = new CampaignMirror({ onState: applyMirroredCampaign });
  const mirrorAvailability = campaignMirror.start(storedCampaign ? createSaveEnvelope(storedCampaign) : null);
  elements.mirrorStatus.textContent = mirrorAvailability.available
    ? "다른 탭과 이 브라우저에서만 로컬 동기화 중입니다. 인터넷 멀티플레이는 아닙니다."
    : "탭 간 로컬 동기화를 사용할 수 없습니다. 이 기기 저장은 계속됩니다.";
  window.addEventListener("pagehide", () => campaignMirror?.close(), { once: true });
  wireControls();
  particleBackground = initReactBitsEffects();
  syncBackgroundEffects();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

initialize();
