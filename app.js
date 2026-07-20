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
  startCampaign,
  getCommandCooldown,
  getTacticalProgression,
  reserveCommand,
  reorderReservedCommand,
  cancelReservedCommand,
  executeReservedCommand,
  checkReservedCommandExecution,
  upgradeSkill,
  deployTacticalObject,
  evolveSummon,
  SUMMON_RECIPES,
  TACTICAL_METADATA
} from "./campaign-state.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { RealtimeBattle } from "./battle-realtime-three.js";
import { getBattlePresentation } from "./battle-presentation.js";
import { CampaignMirror } from "./campaign-sync.js";
import { TacticalMinimap } from "./tactical-minimap.js";
import { currentLang, translate, translations } from "./i18n.js";
import { getCombatAlertCue, resolveBossPhase } from "./combat-systems.js";

const BUILD_TAG = "abyssal-surge-static-v56";
const DB_NAME = "abyssal-surge-campaign";
const DB_VERSION = 1;
const STORE_NAME = "campaigns";
const PRIMARY_KEY = "primary";
const FALLBACK_KEY = "abyssal-surge-campaign-fallback-v1";
const MAX_IMPORT_BYTES = 256 * 1024;
const REWARD_ART_IDS = new Set(["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"]);
const ACTION_KEYS = Object.freeze({ h: "hunt", e: "extract", m: "materialize", c: "capture", p: "possess", d: "domain", a: "assault" });
const DIGIT_ACTION_KEYS = Object.freeze({
  "1": "hunt", "2": "extract", "3": "materialize", "4": "capture", "5": "possess", "6": "domain", "7": "assault",
  "digit1": "hunt", "digit2": "extract", "digit3": "materialize", "digit4": "capture", "digit5": "possess", "digit6": "domain", "digit7": "assault"
});
const BATTLE_ACTION_SEMANTICS = Object.freeze({
  hunt: Object.freeze({ source: "portal", target: "extractor", actor: "commander", actorClip: "Special", sourceAsset: "shade", clip: "Special" }),
  extract: Object.freeze({ source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" }),
  materialize: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" }),
  capture: Object.freeze({ source: "portal", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "command-obelisk", clip: "Activate" }),
  possess: Object.freeze({ source: "portal", target: "ally", actor: "commander", actorClip: "Special", sourceAsset: "possessed", clip: "Special" }),
  domain: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "echo-throne", clip: "Activate" }),
  assault: Object.freeze({ source: "ally", target: "boss", actor: "commander", actorClip: "Strike", sourceAsset: "shade", clip: "Strike" }),
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
  reward: "assets/audio/reward.mp3",
  "breach-alert": "assets/audio/breach-alert.mp3",
  "wave-spawn": "assets/audio/wave-spawn.mp3",
  "boss-phase-change": "assets/audio/boss-phase-change.mp3"
});
const ENCOUNTER_CUE_BY_EVENT = Object.freeze({
  breach: "breach-alert",
  "start-wave": "wave-spawn",
  "boss-strike": "breach-alert",
  "enemy-ranged-warning": "enemy-ranged-warning",
  "boss-phase-shift": "boss-phase-change",
  "summon-evolved": "summon-evolved",
  "summon-evolution": "summon-evolved",
  "boss-phase": "boss-phase-change",
  "phase-change": "boss-phase-change",
  "boss-low-health": "boss-low-health",
  "guardian-shield": "guardian-shield",
  "low-health": "boss-low-health",
  "guardian-guard": "guardian-shield"
});
const COMBAT_ALERT_FEEDBACK_KEYS = Object.freeze({
  "breach-alert": "combat.alert.breach",
  "enemy-ranged-warning": "combat.alert.enemy-ranged-warning",
  "boss-phase-change": "combat.alert.boss-phase-change",
  "summon-evolved": "combat.alert.summon-evolved",
  "boss-low-health": "combat.alert.boss-low-health",
  "guardian-shield": "combat.alert.guardian-shield",
  "wave-spawn": "combat.alert.wave-spawn"
});
const MUSIC_BY_SCENE = Object.freeze({
  lobby: "assets/audio/bgm-theme.mp3",
  battle: "assets/audio/battle-bgm.mp3"
});
const MUSIC_BY_STAGE = Object.freeze({
  "sunken-bastion": "assets/audio/battle-bgm-band-ii.mp3",
  "howling-sprawl": "assets/audio/battle-bgm-band-ii.mp3",
  "glass-necropolis": "assets/audio/battle-bgm-band-ii.mp3",
  "starless-canal": "assets/audio/battle-bgm-band-iii.mp3",
  "shattered-causeway": "assets/audio/battle-bgm-band-iii.mp3",
  "abyss-chancel": "assets/audio/battle-bgm-band-iv.mp3",
  "gate-zenith": "assets/audio/battle-bgm-band-iv.mp3"
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
  "sunken-bastion": Object.freeze({
    audio: "assets/audio/narr-stage4.mp3",
    lines: Object.freeze(["가라앉은 보루, 선큰 바스티온.", "조수의 감시자를 방파제 아래로 가라앉혀라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "howling-sprawl": Object.freeze({
    audio: "assets/audio/narr-stage5.mp3",
    lines: Object.freeze(["울부짖는 폐허, 하울링 스프롤.", "무리의 감시자를 빙의해 전령의 목을 조여라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "glass-necropolis": Object.freeze({
    audio: "assets/audio/narr-stage6.mp3",
    lines: Object.freeze(["유리 묘역, 글래스 네크로폴리스.", "두 유리 단상을 점거하고 진혼의 합창을 끊어라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "starless-canal": Object.freeze({
    audio: "assets/audio/narr-stage7.mp3",
    lines: Object.freeze(["별 없는 운하, 스타리스 커낼.", "군주의 영역을 다시 열어 폭군의 등불을 모두 꺼라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "shattered-causeway": Object.freeze({
    audio: "assets/audio/narr-stage8.mp3",
    lines: Object.freeze(["부서진 둑길, 섀터드 코즈웨이.", "다리를 지키는 거상을 육교 아래로 무너뜨려라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "abyss-chancel": Object.freeze({
    audio: "assets/audio/narr-stage9.mp3",
    lines: Object.freeze(["심연 예배당, 어비스 챈슬.", "세 의식 단상을 모두 점거하고 봉인 계약을 깨뜨려라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  "gate-zenith": Object.freeze({
    audio: "assets/audio/narr-stage10.mp3",
    lines: Object.freeze(["게이트 제니스, 마지막 정점.", "모든 가호를 걸고 심연의 섭정을 지워라.", "오늘, 문을 닫는다."]),
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

const NARRATION_EN = Object.freeze({
  intro: Object.freeze(["The abyssal gate has opened.", "Arise, Shadow Lord."]),
  "cinder-span": Object.freeze(["The Ashen Bridge, Cinder Span.", "Hunt Ashen Echoes and harvest their souls."]),
  "veil-citadel": Object.freeze(["The Shrouded Fortress, Veil Citadel.", "The power of possession awakens.", "Seize both nodes simultaneously."]),
  "echo-throne": Object.freeze(["The Echo Throne.", "Channel the Lord's Domain and bring down the Gate Sovereign."]),
  "sunken-bastion": Object.freeze(["The Drowned Bulwark, Sunken Bastion.", "Sink the Tidal Warden beneath the breakwater."]),
  "howling-sprawl": Object.freeze(["The Howling Sprawl.", "Possess the Flock Watcher and choke the Herald's advance."]),
  "glass-necropolis": Object.freeze(["The Glass Necropolis.", "Seize both glass platforms and silence the Requiem Choir."]),
  "starless-canal": Object.freeze(["The Starless Canal.", "Reopen the Lord's Domain and extinguish every tyrant lantern."]),
  "shattered-causeway": Object.freeze(["The Shattered Causeway.", "Collapse the colossus beneath the bridge it guards."]),
  "abyss-chancel": Object.freeze(["The Abyss Chancel.", "Seize all three ritual platforms and break the binding contract."]),
  "gate-zenith": Object.freeze(["Gate Zenith, the final ascent.", "Stake every grace to unmake the Abyssal Regent.", "Close the gate today."]),
  victory: Object.freeze(["Before the silenced gate,", "the Shadow Legion ascends the throne."]),
  defeat: Object.freeze(["The legion's anchor has shattered.", "Rise, once more."])
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
    paused: "시네마틱이 일시 정지되었습니다. 기본 컨트롤이나 재생 버튼으로 계속할 수 있습니다.",
    ended: "시네마틱 재생이 끝났습니다. 재생 버튼을 누르면 처음부터 다시 볼 수 있습니다.",
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
    paused: "Cinematic paused. Continue with the native controls or the play button.",
    ended: "Cinematic ended. Press the play button to watch again from the beginning.",
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
  toggleFullscreen: document.querySelector("#toggle-fullscreen"),
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
  battleObjectFeedbackCanvas: document.querySelector("#battle-object-feedback-canvas"),
  battleField: document.querySelector("#battle-field"),
  battleBrief: document.querySelector("#battle-tactical-brief"),
  battleOperation: document.querySelector("#battle-operation"),
  battleDoctrine: document.querySelector("#battle-doctrine"),
  battleAllyLabel: document.querySelector("#battle-ally-label"),
  battleHostileLabel: document.querySelector("#battle-hostile-label"),
  battlePressure: document.querySelector("#battle-pressure"),
  battleScreenObjective: document.querySelector('[data-battle-screen="objective"]'),
  battleScreenPressure: document.querySelector('[data-battle-screen="pressure"]'),
  battleScreenFeedback: document.querySelector('[data-battle-screen="feedback"]'),
  battleScreenWave: document.querySelector('[data-battle-screen="wave"]'),
  battleScreenSouls: document.querySelector('[data-battle-screen="souls"]'),
  battleScreenLegion: document.querySelector('[data-battle-screen="legion"]'),
  battleScreenNodes: document.querySelector('[data-battle-screen="nodes"]'),
  battleScreenIntegrity: document.querySelector('[data-battle-screen="integrity"]'),
  battleScreenBoss: document.querySelector('[data-battle-screen="boss"]'),
  battleScreenForecast: document.querySelector('[data-battle-screen="forecast"]'),
  battleScreenAdvance: document.querySelector('[data-battle-screen="advance"]'),
  battleScreenBossPhase: document.querySelector('[data-battle-screen="boss-phase"]'),
  battleScreenEnemyGrowth: document.querySelector('[data-battle-screen="enemy-growth"]'),
  battleScreenSelectionImage: document.querySelector('[data-battle-screen="selection-image"]'),
  battleScreenSelectionLabel: document.querySelector('[data-battle-screen="selection-label"]'),
  battleScreenSelectionName: document.querySelector('[data-battle-screen="selection-name"]'),
  battleScreenSelectionRole: document.querySelector('[data-battle-screen="selection-role"]'),
  battleScreenSelectionCount: document.querySelector('[data-battle-screen="selection-count"]'),
  battleScreenSelectionHealth: document.querySelector('[data-battle-screen="selection-health"]'),
  battleScreenSelectionOrder: document.querySelector('[data-battle-screen="selection-order"]'),
  battleScreenSelectionStatus: document.querySelector('[data-battle-screen="selection-status"]'),
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
  summonEssence: document.querySelector("#summon-essence-value"),
  summonEvolutionButtons: [...document.querySelectorAll("[data-summon-recipe]")],
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
  cinematicFallback: document.querySelector("#cinematic-fallback"),
  cinematicTranscriptToggle: document.querySelector("#toggle-cinematic-transcript"),
  cinematicTranscript: document.querySelector("#cinematic-transcript"),
  cinematicTranscriptHeading: document.querySelector("#cinematic-transcript-heading"),
  cinematicTranscriptIntro: document.querySelector("#cinematic-transcript-intro"),
  cinematicTranscriptBrief: document.querySelector("#cinematic-transcript-brief"),
  cinematicStatus: document.querySelector("#cinematic-status"),
  narrationLine: document.querySelector("#narration-line"),
  narrationSr: document.querySelector("#narration-sr"),
  commandButtons: [...document.querySelectorAll("button[data-action]")].filter((btn) => typeof btn.closest !== "function" || btn.closest("#command-pad") !== null),
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
let lastCueEffect = "";
let lastCueStartedAt = 0;
let bgmEnabled = false;
let bgmSceneRun = 0;
let cinematicStatusKey = "optional";
let liquidEtherBackground = null;
let liquidEtherLoad = null;
let particleBackground = null;
let narratedStageId = null;
let narratedOutcome = null;
let activeNarrationKey = null;
let stageBriefingOpen = false;
let entryGuidanceStageId = null;
let pendingCommandFocus = false;
let commandRequestSequence = 0;
// Single-screen cockpit: the battlefield, intel rail, and command pad are
// always visible while a campaign runs. `battleUiActive()` (a live battle
// session exists) replaces the old activeView === "battle" checks; the
// result overlay is derived from campaign.status in render().
let visualizer = null;
let activeFieldFocusedAction = null;
let activeCommandHoverAction = null;
let activeCommandFocusAction = null;
const EMPTY_RENDERER_SELECTION = Object.freeze({
  count: 0,
  total: 0,
  health: 0,
  maxHealth: 0,
  possessed: 0,
  engaged: 0,
  moving: 0,
  order: "none",
});
let rendererSelectionSummary = EMPTY_RENDERER_SELECTION;
let minimapInstance = null;
let minimapFailed = false;
let activePlacementMode = null;
let tacticalFeedbackMessage = "";
let tacticalFeedbackTimer = 0;

function translateRejectionReason(msg, lang) {
  if (lang === undefined) lang = currentLang();
  if (!msg) return "";

  const fallbackTranslations = {
    ko: {
      "tactical.rejection.inactiveStage": "현재 스테이지에서는 이 전술 행동을 사용할 수 없습니다.",
      "tactical.rejection.invalidCommand": "이 스테이지에서 사용할 수 없는 명령입니다.",
      "tactical.rejection.invalidCoordinates": "배치 좌표가 올바르지 않습니다.",
      "tactical.rejection.invalidSkill": "올바르지 않은 전술 스킬입니다.",
      "tactical.rejection.commandMissing": "대기열에서 명령을 찾을 수 없습니다.",
      "tactical.rejection.maxSkill": "스킬이 이미 최대 레벨입니다.",
      "tactical.rejection.queueFull": "예약 대기열이 가득 찼습니다.",
      "tactical.rejection.insufficientMarks": "전술 휘장이 부족합니다.",
      "tactical.rejection.deploymentCap": "배치 한도에 도달했습니다.",
      "tactical.rejection.occupied": "해당 칸에는 이미 배치물이 있습니다.",
      "tactical.rejection.outOfBounds": "배치 가능한 범위를 벗어났습니다.",
      "tactical.rejection.extractRequiresSpoor": "추출하려면 포자 흔적 2개가 필요합니다.",
      "tactical.rejection.extractionsExhausted": "이 스테이지의 포자가 고갈되었습니다. 거점을 점령하거나, 웨이브를 처치하거나, 보스를 노출시키면 새 광맥이 열립니다.",
      "tactical.rejection.protectedArea": "보호 구역에는 배치할 수 없습니다.",
      "tactical.rejection.protectedAnchor": "핵심 전장 지점에는 배치할 수 없습니다.",
      "tactical.rejection.protectedBase": "보호된 기지 또는 생성 구역에는 배치할 수 없습니다.",
      "tactical.rejection.routeBlocked": "배치하면 차원문에서 보스까지의 모든 경로가 막힙니다.",
      "tactical.rejection.duplicateReservation": "이미 대기열에 예약된 명령 ID입니다.",
      "tactical.rejection.duplicateDeployment": "이미 배치에 사용된 ID입니다.",
      "tactical.rejection.duplicateId": "이미 사용 중인 ID입니다.",
      "tactical.rejection.executionFailed": "명령 예약 실행에 실패했습니다: {error}"
    },
    en: {
      "tactical.rejection.inactiveStage": "This tactical action is unavailable outside an active stage.",
      "tactical.rejection.invalidCommand": "That command is unavailable in this stage.",
      "tactical.rejection.invalidCoordinates": "The deployment coordinates are invalid.",
      "tactical.rejection.invalidSkill": "The tactical skill is invalid.",
      "tactical.rejection.commandMissing": "The command is no longer in the queue.",
      "tactical.rejection.maxSkill": "That skill is already at maximum level.",
      "tactical.rejection.queueFull": "The command reservation queue is full.",
      "tactical.rejection.insufficientMarks": "Not enough Tactical Marks.",
      "tactical.rejection.deploymentCap": "Deployment cap reached.",
      "tactical.rejection.occupied": "That cell is already occupied.",
      "tactical.rejection.outOfBounds": "That cell is outside the deployment area.",
      "tactical.rejection.extractRequiresSpoor": "Two spoor marks are required before extraction.",
      "tactical.rejection.extractionsExhausted": "This spoor is exhausted. Capture ground, clear a wave, or expose the boss to open a fresh vein.",
      "tactical.rejection.protectedArea": "That cell is in a protected area.",
      "tactical.rejection.protectedAnchor": "Critical battlefield anchors cannot receive deployments.",
      "tactical.rejection.protectedBase": "Protected base and spawn areas cannot receive deployments.",
      "tactical.rejection.routeBlocked": "That deployment would block every route from the portal to the boss.",
      "tactical.rejection.duplicateReservation": "Command reservation ID is already in use.",
      "tactical.rejection.duplicateDeployment": "Deployment ID is already in use.",
      "tactical.rejection.duplicateId": "ID is already in use.",
      "tactical.rejection.executionFailed": "Execution failed: {error}"
    }
  };

  const t = (key) => {
    if (typeof translations !== "undefined" && translations && translations[lang]) {
      return translations[lang][key] || key;
    }
    if (fallbackTranslations[lang] && fallbackTranslations[lang][key]) {
      return fallbackTranslations[lang][key];
    }
    return translate(key, lang) || key;
  };

  if (
    msg === "This stage is not active." ||
    msg === "This stage is not accepting commands right now." ||
    msg === "The breach cannot reach a stage that is not active." ||
    msg === "This stage is not accepting encounter events right now."
  ) {
    return t("tactical.rejection.inactiveStage");
  }

  if (msg === "That command has no place in this stage.") {
    return t("tactical.rejection.invalidCommand");
  }

  if (msg === "Invalid cell coordinates.") {
    return t("tactical.rejection.invalidCoordinates");
  }

  if (msg === "Invalid skill type." || msg === "Invalid deployment kind.") {
    return t("tactical.rejection.invalidSkill");
  }

  if (msg === "Command not found in queue.") {
    return t("tactical.rejection.commandMissing");
  }

  const maxSkillMatch = msg.match(/^Skill\s+(.+)\s+is already at maximum level\.$/);
  if (maxSkillMatch) {
    return t("tactical.rejection.maxSkill").replace("{skill}", maxSkillMatch[1]);
  }

  if (msg === "Command reservation queue is full.") {
    return t("tactical.rejection.queueFull");
  }

  const marksMatch = msg.match(/^Not enough marks\.\s*Need\s+(\d+)\s+but have\s+(\d+)\.$/);
  if (marksMatch) {
    return t("tactical.rejection.insufficientMarks")
      .replace("{need}", marksMatch[1])
      .replace("{have}", marksMatch[2]);
  }

  const capMatch = msg.match(/^Cannot deploy more than\s+(\d+)\s+(.+?)s at fortification level\s+(\d+)\.$/);
  if (capMatch) {
    return t("tactical.rejection.deploymentCap")
      .replace("{cap}", capMatch[1])
      .replace("{kind}", capMatch[2])
      .replace("{level}", capMatch[3]);
  }

  if (msg === "Cell is occupied by an existing deployment." || msg.includes("already occupied")) {
    return t("tactical.rejection.occupied");
  }

  if (msg === "Cell is not walkable or out of bounds." || msg === "Placement is out of grid boundaries.") {
    return t("tactical.rejection.outOfBounds");
  }

  if (msg === "Cell is in a protected area.") {
    return t("tactical.rejection.protectedArea");
  }

  if (msg === "Cell contains a critical game anchor.") {
    return t("tactical.rejection.protectedAnchor");
  }

  if (msg === "Cell is in a protected base or spawn area.") {
    return t("tactical.rejection.protectedBase");
  }

  if (msg === "Deployment would completely block all paths from portal to boss.") {
    return t("tactical.rejection.routeBlocked");
  }

  if (msg === "Command reservation ID is already in use.") {
    return t("tactical.rejection.duplicateReservation");
  }

  if (msg === "Deployment ID is already in use.") {
    return t("tactical.rejection.duplicateDeployment");
  }

  if (msg === "Two spoor marks are required before extraction.") {
    return t("tactical.rejection.extractRequiresSpoor");
  }
  if (msg === "This spoor is exhausted. Capture ground, clear a wave, or expose the boss to open a fresh vein.") {
    return t("tactical.rejection.extractionsExhausted");
  }

  if (msg === "A summon recipe is required." || msg === "That summon recipe does not exist.") {
    return t("summon.rejection.invalidRecipe");
  }

  const evolutionMaxMatch = msg.match(/^(.+) is already at maximum evolution\.$/);
  if (evolutionMaxMatch) {
    return t("summon.rejection.maxLevel").replace("{name}", evolutionMaxMatch[1]);
  }

  const evolutionEssenceMatch = msg.match(/^Not enough summon essence\. Need (\d+) but have (\d+)\.$/);
  if (evolutionEssenceMatch) {
    return t("summon.rejection.essence")
      .replace("{cost}", evolutionEssenceMatch[1])
      .replace("{essence}", evolutionEssenceMatch[2]);
  }

  const execMatch = msg.match(/^Execution failed:\s*(.+)$/);
  if (execMatch) {
    const innerReason = translateRejectionReason(execMatch[1], lang);
    return t("tactical.rejection.executionFailed").replace("{error}", innerReason);
  }

  return msg;
}

function showTacticalFeedback(msg) {
  tacticalFeedbackMessage = msg;
  if (tacticalFeedbackTimer) {
    window.clearTimeout(tacticalFeedbackTimer);
  }
  render();
  tacticalFeedbackTimer = window.setTimeout(() => {
    tacticalFeedbackMessage = "";
    tacticalFeedbackTimer = 0;
    render();
  }, 3000);
}

function handleTacticalRequest(request) {
  if (!campaign || campaign.status !== "active") return;
  if (request.type === "deploy") {
    void handleDeployRequest(request.kind, request.cell);
  } else if (request.type === "focus") {
    if (visualizer && typeof visualizer.focusTacticalCell === "function") {
      visualizer.focusTacticalCell(request.cell);
    }
  }
}

async function handleDeployRequest(kind, cell) {
  const result = deployTacticalObject(campaign, kind, cell);
  if (result.accepted) {
    campaign = result.state;
    activePlacementMode = null;
    if (visualizer && typeof visualizer.setPlacementMode === "function") {
      visualizer.setPlacementMode(null);
    }
    synchronizeBattleRenderer();
    render();
    await persistCampaign("persist.campaignSaved");
  } else {
    activePlacementMode = null;
    if (visualizer && typeof visualizer.setPlacementMode === "function") {
      visualizer.setPlacementMode(null);
    }
    render();
    showTacticalFeedback(translateRejectionReason(result.message));
  }
}

async function handleExecuteReserved(id) {
  if (!campaign || campaign.status !== "active") return;
  if (typeof armQueuedCommand === "function") {
    armQueuedCommand(id, { source: "queue-exec-button", forceCheck: true });
  } else {
    const result = executeReservedCommand(campaign, id);
    campaign = result.state;
    render();
    if (!result.accepted) {
      showTacticalFeedback(translateRejectionReason(result.message));
      return;
    }
    startActionCooldown(result.action);
    render();
    await persistCampaign("persist.campaignSaved");
  }
}

async function handleCancelReserved(id) {
  if (!campaign || campaign.status !== "active") return;
  const queue = campaign.commandQueue || campaign.progression?.commandQueue || [];
  const isHead = queue.length > 0 && queue[0].id === id;
  const result = cancelReservedCommand(campaign, id);
  if (result.accepted) {
    campaign = result.state;
    if (typeof dropQueuedCommandRuntime === "function") {
      dropQueuedCommandRuntime(id, "cancelled");
    }
    if (isHead && visualizer && typeof visualizer.clearActionPreview === "function") {
      visualizer.clearActionPreview();
    }
    render();
    await persistCampaign("persist.campaignSaved");
  }
}

async function handleReorderReserved(fromIndex, toIndex) {
  if (!campaign || campaign.status !== "active") return;
  const result = reorderReservedCommand(campaign, fromIndex, toIndex);
  if (result.accepted) {
    campaign = result.state;
    if (typeof syncQueuedCommandPreview === "function") {
      syncQueuedCommandPreview();
    }
    render();
    await persistCampaign("persist.campaignSaved");
  }
}

async function handleReserveAction(action) {
  if (typeof enqueueCommandRequest === "function") {
    return enqueueCommandRequest(action, { source: "reserve-ui" });
  }
  if (!campaign || campaign.status !== "active") return;
  const result = reserveCommand(campaign, action);
  if (result.accepted) {
    campaign = result.state;
    showTacticalFeedback(translateStatusMessage(campaign.lastMessage, currentLang()));
    await persistCampaign("persist.campaignSaved");
  } else {
    showTacticalFeedback(translateRejectionReason(result.message));
  }
}

function handleDeploymentSelect(kind) {
  if (!campaign || campaign.status !== "active") return;
  if (activePlacementMode === kind) {
    activePlacementMode = null;
  } else {
    activePlacementMode = kind;
  }
  if (visualizer && typeof visualizer.setPlacementMode === "function") {
    visualizer.setPlacementMode(activePlacementMode);
  }
  render();
}

async function handleSkillUpgrade(skill) {
  if (!campaign || campaign.status !== "active") return;
  const result = upgradeSkill(campaign, skill);
  if (result.accepted) {
    campaign = result.state;
    render();
    await persistCampaign("persist.campaignSaved");
  } else {
    showTacticalFeedback(translateRejectionReason(result.message));
  }
}
async function handleSummonEvolution(recipeId) {
  if (!campaign || campaign.status !== "active") return;
  const result = evolveSummon(campaign, recipeId);
  if (!result.accepted) {
    showTacticalFeedback(translateRejectionReason(result.message));
    return;
  }

  campaign = result.state;
  synchronizeBattleRenderer();
  const recipe = SUMMON_RECIPES.find((candidate) => candidate.id === recipeId);
  const level = campaign.progression.summons?.levels?.[recipeId] ?? 0;
  const recipeName = translate(`summon.recipe.${recipeId}.name`) || recipe?.name || recipeId;
  const feedback = translate("summon.evolution.accepted")
    .replace("{name}", recipeName)
    .replace("{level}", String(level));
  showTacticalFeedback(feedback);
  playCombatAlertCue(getCombatAlertCue("summon-evolved"));
  await persistCampaign("persist.campaignSaved");
}


function cancelPlacementMode() {
  activePlacementMode = null;
  if (visualizer && typeof visualizer.setPlacementMode === "function") {
    visualizer.setPlacementMode(null);
  }
  render();
}

function normalizeMinimapSnapshot(snapshot) {
  if (!snapshot || !snapshot.navigation) return snapshot;
  const nav = snapshot.navigation;
  
  let normalizedRoutes = [];
  if (Array.isArray(nav.routes)) {
    normalizedRoutes = nav.routes.map((route, idx) => {
      if (Array.isArray(route)) {
        return { cells: route, lane: idx };
      }
      if (route && Array.isArray(route.cells)) {
        return {
          cells: route.cells,
          lane: typeof route.lane === 'number' ? route.lane : idx
        };
      }
      return { cells: [], lane: idx };
    });
  }

  let normalizedZones = [];
  if (Array.isArray(nav.zones)) {
    normalizedZones = nav.zones.map((zone, idx) => {
      if (zone && Array.isArray(zone.cells)) {
        return {
          kind: zone.kind || "cover",
          cells: zone.cells
        };
      }
      return { kind: "cover", cells: [] };
    });
  }

  let normalizedAnchors = {
    portal: null,
    boss: null,
    extractor: null,
    nodes: [],
    hostileSpawns: []
  };
  if (nav.anchors) {
    if (Array.isArray(nav.anchors)) {
      nav.anchors.forEach(anchor => {
        if (!anchor) return;
        if (anchor.id === "portal") {
          normalizedAnchors.portal = { x: anchor.x, y: anchor.y };
        } else if (anchor.id === "boss") {
          normalizedAnchors.boss = { x: anchor.x, y: anchor.y };
        } else if (anchor.id === "extractor") {
          normalizedAnchors.extractor = { x: anchor.x, y: anchor.y };
        } else if (anchor.id === "node" || anchor.id?.startsWith("node")) {
          normalizedAnchors.nodes.push({ x: anchor.x, y: anchor.y, id: anchor.id });
        } else if (anchor.id === "hostile-spawn" || anchor.id?.startsWith("hostile-spawn")) {
          normalizedAnchors.hostileSpawns.push({ x: anchor.x, y: anchor.y, id: anchor.id, routeIndex: anchor.routeIndex });
        }
      });
    } else if (typeof nav.anchors === "object") {
      normalizedAnchors.portal = nav.anchors.portal ? { x: nav.anchors.portal.x, y: nav.anchors.portal.y } : null;
      normalizedAnchors.boss = nav.anchors.boss ? { x: nav.anchors.boss.x, y: nav.anchors.boss.y } : null;
      normalizedAnchors.extractor = nav.anchors.extractor ? { x: nav.anchors.extractor.x, y: nav.anchors.extractor.y } : null;
      normalizedAnchors.nodes = Array.isArray(nav.anchors.nodes) ? nav.anchors.nodes.map(n => ({ x: n.x, y: n.y, id: n.id })) : [];
      normalizedAnchors.hostileSpawns = Array.isArray(nav.anchors.hostileSpawns) ? nav.anchors.hostileSpawns.map(s => ({ x: s.x, y: s.y, id: s.id, routeIndex: s.routeIndex })) : [];
    }
  }

  return {
    ...snapshot,
    navigation: {
      ...nav,
      cells: Array.isArray(nav.cells) ? nav.cells : [],
      routes: normalizedRoutes,
      zones: normalizedZones,
      anchors: normalizedAnchors
    }
  };
}

function syncMinimap() {
  const canvas = document.querySelector("#battle-minimap");
  if (!battleUiActive() || !canvas) {
    if (minimapInstance) {
      try {
        minimapInstance.destroy();
      } catch (err) {
        console.error("Failed to destroy minimap:", err);
      }
      minimapInstance = null;
    }
    return;
  }
  if (minimapFailed) return;
  if (minimapInstance && minimapInstance.canvas !== canvas) {
    try {
      minimapInstance.destroy();
    } catch (err) {
      console.error("Failed to destroy minimap on canvas change:", err);
    }
    minimapInstance = null;
  }
  if (!minimapInstance) {
    try {
      const reducedMotion = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
      minimapInstance = new TacticalMinimap(canvas, {
        reducedMotion,
        onFocusRequest: (cell) => {
          if (visualizer && typeof visualizer.focusTacticalCell === "function") {
            visualizer.focusTacticalCell(cell);
          }
        }
      });
    } catch (err) {
      console.error("Failed to initialize TacticalMinimap:", err);
      minimapInstance = null;
      minimapFailed = true;
      return;
    }
  }
  if (minimapInstance && visualizer && typeof visualizer.getTacticalSnapshot === "function") {
    try {
      const snapshot = visualizer.getTacticalSnapshot();
      if (snapshot) {
        const normalized = normalizeMinimapSnapshot(snapshot);
        minimapInstance.update(normalized);
      }
    } catch (err) {
      console.error("Failed to update minimap snapshot:", err);
      minimapFailed = true;
      if (minimapInstance) {
        try {
          minimapInstance.destroy();
        } catch (e) {
          console.warn("Failed to destroy minimapInstance on snapshot update failure:", e);
        }
        minimapInstance = null;
      }
    }
  }
}


function handleRendererSelection(summary, sessionId = battleSessionId) {
  if (sessionId !== battleSessionId || campaign?.status !== "active") return;
  const countValue = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const order = ["none", "holding", "moving", "engaged", "mixed"].includes(summary?.order)
    ? summary.order
    : "none";
  rendererSelectionSummary = {
    count: countValue(summary?.count),
    total: countValue(summary?.total),
    health: countValue(summary?.health),
    maxHealth: countValue(summary?.maxHealth),
    possessed: countValue(summary?.possessed),
    engaged: countValue(summary?.engaged),
    moving: countValue(summary?.moving),
    order,
  };
  projectActionFocus(currentActionFocus());
}

function renderSelectionDossier() {
  const summary = rendererSelectionSummary ?? EMPTY_RENDERER_SELECTION;
  const labelEl = document.getElementById("dossier-label");
  const nameEl = document.getElementById("dossier-name");
  const roleEl = document.getElementById("dossier-role");
  const imgEl = document.getElementById("dossier-image");
  const countEl = document.getElementById("dossier-count");
  const healthEl = document.getElementById("dossier-health");
  const orderEl = document.getElementById("dossier-order");
  const statusEl = document.getElementById("dossier-status");
  const healthValue = Number.isInteger(summary.health) ? summary.health : summary.health.toFixed(1);
  const maxHealthValue = Number.isInteger(summary.maxHealth) ? summary.maxHealth : summary.maxHealth.toFixed(1);
  const nameKey = summary.count > 0 ? "command.selectionName" : "command.selectionNone";
  const roleKey = summary.possessed > 0 ? "command.selectionPossessedRole" : "command.selectionRole";

  if (labelEl) {
    labelEl.setAttribute("data-i18n", "command.selectionLabel");
    labelEl.textContent = translate("command.selectionLabel");
  }
  if (nameEl) {
    nameEl.setAttribute("data-i18n", nameKey);
    nameEl.textContent = translate(nameKey);
  }
  if (roleEl) {
    roleEl.setAttribute("data-i18n", roleKey);
    roleEl.textContent = translate(roleKey);
  }
  const orderKey = `command.selection.order.${summary.order}`;
  const statusText = summary.count > 0
    ? `${summary.count} ${translate("command.selectionStatus.selected")} · ${translate(orderKey)}`
    : translate("command.selectionStatus.none");
  if (imgEl) imgEl.src = "assets/images/ui/action-possess.png";
  if (countEl) countEl.textContent = `${summary.count} / ${summary.total}`;
  if (healthEl) healthEl.textContent = `${healthValue} / ${maxHealthValue}`;
  if (orderEl) {
    orderEl.setAttribute("data-i18n", orderKey);
    orderEl.textContent = translate(orderKey);
  }
  if (statusEl) statusEl.textContent = statusText;

  if (elements.battleScreenSelectionImage) elements.battleScreenSelectionImage.src = "assets/images/ui/action-possess.png";
  if (elements.battleScreenSelectionLabel) {
    elements.battleScreenSelectionLabel.setAttribute("data-i18n", "command.selectionLabel");
    elements.battleScreenSelectionLabel.textContent = translate("command.selectionLabel");
  }
  if (elements.battleScreenSelectionName) {
    elements.battleScreenSelectionName.setAttribute("data-i18n", nameKey);
    elements.battleScreenSelectionName.textContent = translate(nameKey);
  }
  if (elements.battleScreenSelectionRole) {
    elements.battleScreenSelectionRole.setAttribute("data-i18n", roleKey);
    elements.battleScreenSelectionRole.textContent = translate(roleKey);
  }
  if (elements.battleScreenSelectionCount) elements.battleScreenSelectionCount.textContent = `${summary.count} / ${summary.total}`;
  if (elements.battleScreenSelectionHealth) elements.battleScreenSelectionHealth.textContent = `${healthValue} / ${maxHealthValue}`;
  if (elements.battleScreenSelectionOrder) {
    elements.battleScreenSelectionOrder.setAttribute("data-i18n", orderKey);
    elements.battleScreenSelectionOrder.textContent = translate(orderKey);
  }
  if (elements.battleScreenSelectionStatus) elements.battleScreenSelectionStatus.textContent = statusText;
}

function currentActionFocus() {
  return activeCommandHoverAction || activeFieldFocusedAction || activeCommandFocusAction;
}

function updateActionFocus() {
  const action = currentActionFocus();
  projectActionFocus(action);
  if (!visualizer) return;
  const semantic = action ? BATTLE_ACTION_SEMANTICS[action] : null;
  if (semantic && typeof visualizer.previewAction === "function") {
    visualizer.previewAction({ ...semantic, action });
  } else if (typeof visualizer.clearActionPreview === "function") {
    visualizer.clearActionPreview();
  }
}

function handleActionFocus(action) {
  activeFieldFocusedAction = action;
  updateActionFocus();
}

function projectActionFocus(action) {
  const buttons = document.querySelectorAll(".command-grid button[data-action]");
  buttons.forEach((btn) => {
    const actId = btn.getAttribute("data-action");
    if (actId === action) btn.setAttribute("data-focused", "true");
    else btn.removeAttribute("data-focused");
  });

  const dossier = document.querySelector(".selection-dossier");
  const labelEl = document.getElementById("dossier-label");
  const nameEl = document.getElementById("dossier-name");
  const roleEl = document.getElementById("dossier-role");
  const imgEl = document.getElementById("dossier-image");
  const statusEl = document.getElementById("dossier-status");
  renderSelectionDossier();

  if (action) {
    dossier?.setAttribute("data-focused", "true");
    const lang = currentLang();
    const isKo = lang === "ko";
    const semantic = BATTLE_ACTION_SEMANTICS[action];
    const pointLabels = isKo
      ? { portal: "차원문", extractor: "추출기", commander: "사령관", node: "거점", ally: "군단", boss: "보스" }
      : { portal: "Portal", extractor: "Extractor", commander: "Commander", node: "Node", ally: "Legion", boss: "Boss" };
    labelEl?.removeAttribute("data-i18n");
    nameEl?.removeAttribute("data-i18n");
    roleEl?.removeAttribute("data-i18n");
    if (labelEl) labelEl.textContent = isKo ? "명령 대상" : "Command Target";
    if (nameEl) nameEl.textContent = translate(`command.${action}.name`);
    if (roleEl) roleEl.textContent = translate(`command.${action}.desc`);
    if (imgEl) imgEl.src = `assets/images/ui/action-${action}.png`;
    if (statusEl && semantic) {
      const source = pointLabels[semantic.source] ?? semantic.source;
      const target = pointLabels[semantic.target] ?? semantic.target;
      statusEl.textContent = isKo ? `경로: ${source} → ${target}` : `Route: ${source} → ${target}`;
    }
  } else {
    dossier?.removeAttribute("data-focused");
    renderSelectionDossier();
  }

  if (typeof window.CustomEvent === "function") {
    const event = new window.CustomEvent("abyssal:spatial-focus", {
      detail: { action }
    });
    window.dispatchEvent(event);
  }
}
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

const COMMAND_QUEUE_TICK_MS = 100;
const COMMAND_ACK_MIN_MS = 250;
const COMMAND_RENDERER_ACK_TIMEOUT_MS = 750;
const COMMAND_DUPLICATE_WINDOW_MS = 250;
const queuedCommandRuntime = new Map();
const seenCommandRequests = new Map();
let commandExecutionTimer = 0;
let lastCheckedSignature = "";
let resultOverlayOpen = false;
let campaignMirror = null;

function evaluateQueuedCommandReadiness(head, runtime) {
  const now = performance.now();
  const elapsed = now - runtime.queuedAt;
  
  const reducerCheck = checkReservedCommandExecution(campaign, head.id);
  if (!reducerCheck.ready) {
    return { ready: false, phase: "blocked", reason: reducerCheck.message };
  }
  
  if (remainingCooldown(head.action) > 0) {
    return { ready: false, phase: "waiting-scene", reason: "cooldown" };
  }
  
  if (elapsed < COMMAND_ACK_MIN_MS) {
    return { ready: false, phase: "acknowledging", reason: "acknowledging" };
  }
  
  let rendererReady = true;
  let rendererReason = "";
  
  const rendererReadyResult = (visualizer && typeof visualizer.getCommandReadiness === "function")
    ? visualizer.getCommandReadiness({ commandId: head.id, action: head.action, target: runtime.target })
    : null;
  
  if (rendererReadyResult) {
    rendererReady = rendererReadyResult.ready;
    rendererReason = rendererReadyResult.reason || "";
  }
  
  const stage = currentStage();
  const state = campaign.stage;
  const encounter = currentEncounter(stage, state);
  if (head.action === "assault" && encounter) {
    const bossExposedApp = encounter.bossExposed === true;
    let bossExposedRenderer = true;
    let enemiesActiveRenderer = 0;
    if (rendererRuntime) {
      bossExposedRenderer = rendererRuntime.bossExposed === true;
      enemiesActiveRenderer = rendererRuntime.enemiesActive || 0;
    }
    if (!bossExposedApp || !bossExposedRenderer || enemiesActiveRenderer > 0) {
      rendererReady = false;
      rendererReason = "boss-not-exposed";
    }
  }
  
  if (!rendererReady) {
    if (rendererReason !== "out-of-range" && elapsed >= COMMAND_RENDERER_ACK_TIMEOUT_MS) {
      rendererReady = true;
      rendererReason = "timeout-fallback";
    } else {
      return { ready: false, phase: "waiting-scene", reason: rendererReason || "waiting-renderer" };
    }
  }
  
  return { ready: true, phase: "ready", reason: "" };
}

function setQueuedCommandPhase(id, phase, reason = "") {
  const runtime = queuedCommandRuntime.get(id);
  const item = campaign?.commandQueue?.find(q => q.id === id);
  const action = item ? item.action : "";
  
  if (runtime) {
    if (runtime.phase === phase && runtime.reason === reason) return;
    runtime.phase = phase;
    runtime.reason = reason;
  }
  
  if (typeof window.CustomEvent === "function") {
    const queueIndex = campaign?.commandQueue ? campaign.commandQueue.findIndex(q => q.id === id) : -1;
    let remainingMs = 0;
    if (action) {
      remainingMs = Math.max(0, remainingCooldown(action));
    }
    const event = new window.CustomEvent("abyssal:command-phase", {
      detail: {
        id,
        action,
        phase,
        reason: reason || undefined,
        remainingMs: remainingMs || undefined,
        queueIndex: queueIndex !== -1 ? queueIndex : undefined
      }
    });
    window.dispatchEvent(event);
  }
}

function dropQueuedCommandRuntime(id, finalPhase) {
  if (finalPhase) {
    setQueuedCommandPhase(id, finalPhase);
  }
  queuedCommandRuntime.delete(id);
}

function armQueuedCommand(id, options) {
  const opts = options || {};
  const runtime = queuedCommandRuntime.get(id);
  if (runtime) {
    if (opts.source) {
      runtime.source = opts.source;
    }
    if (opts.forceCheck) {
      runtime.forceCheck = true;
      runtime.lastCheckedRevision = -1;
      runtime.lastCheckedSignature = "";
    }
    if (runtime.phase === "blocked") {
      setQueuedCommandPhase(id, "queued");
    }
  } else {
    const queuedItem = campaign.commandQueue.find(item => item.id === id);
    if (queuedItem) {
      queuedCommandRuntime.set(id, {
        phase: "queued",
        queuedAt: performance.now(),
        source: opts.source || "queue-exec-button",
        forceCheck: true,
        lastCheckedRevision: -1,
        lastCheckedSignature: ""
      });
      setQueuedCommandPhase(id, "queued");
    }
  }
  scheduleQueueCheck();
  render();
}

async function enqueueCommandRequest(action, options) {
  const opts = options || {};
  if (!campaign || campaign.status !== "active" || resultOverlayOpen) return;
  
  const nextId = opts.requestId || `cmd-${campaign.revision}-${campaign.commandQueue.length}`;
  const result = reserveCommand(campaign, action, nextId);
  if (!result.accepted) {
    showTacticalFeedback(translateRejectionReason(result.message));
    return;
  }
  campaign = result.state;
  
  const now = performance.now();
  queuedCommandRuntime.set(nextId, {
    phase: "queued",
    queuedAt: now,
    source: opts.source || "primary-control",
    target: opts.target,
    lastCheckedRevision: -1,
    lastCheckedSignature: ""
  });
  
  if (typeof window.CustomEvent === "function") {
    const queueIndex = campaign.commandQueue.findIndex(item => item.id === nextId);
    const event = new window.CustomEvent("abyssal:command-queued", {
      detail: { id: nextId, action, queueIndex, source: opts.source || "primary-control" }
    });
    window.dispatchEvent(event);
  }
  
  setQueuedCommandPhase(nextId, "queued");
  
  showTacticalFeedback(translateStatusMessage(campaign.lastMessage, currentLang()));
  scheduleQueueCheck();
  render();
  await persistCampaign("persist.campaignSaved");
}

function handleRendererCommandRequest(request, sessionId, renderer) {
  if (!campaign || campaign.status !== "active") return;
  if (sessionId !== battleSessionId) return;
  if (renderer !== visualizer && renderer !== pendingBattleRenderer) return;

  const payload = normalizeCommandRequest(request);
  if (!payload.action || payload.type !== "command-request") return;

  const reqId = payload.requestId;
  if (seenCommandRequests.has(reqId)) return;
  seenCommandRequests.set(reqId, performance.now());

  void enqueueCommandRequest(payload.action, {
    source: payload.source,
    requestId: reqId,
    target: payload.target
  });
}

function syncCommandRuntimeFromCampaign() {
  if (!campaign) {
    queuedCommandRuntime.clear();
    return;
  }
  
  const idsInQueue = new Set(campaign.commandQueue.map(item => item.id));
  for (const id of queuedCommandRuntime.keys()) {
    if (!idsInQueue.has(id)) {
      queuedCommandRuntime.delete(id);
    }
  }
  
  campaign.commandQueue.forEach((item) => {
    if (!queuedCommandRuntime.has(item.id)) {
      queuedCommandRuntime.set(item.id, {
        phase: "queued",
        queuedAt: performance.now(),
        source: "restored",
        lastCheckedRevision: -1,
        lastCheckedSignature: ""
      });
      setQueuedCommandPhase(item.id, "queued");
    }
  });
  
  syncQueuedCommandPreview();
}

function syncQueuedCommandPreview(renderer = visualizer) {
  if (!renderer) return;
  if (!campaign || campaign.commandQueue.length === 0) {
    if (typeof renderer.clearActionPreview === "function") {
      renderer.clearActionPreview();
    }
    return;
  }
  const head = campaign.commandQueue[0];
  const semantics = BATTLE_ACTION_SEMANTICS[head.action];
  if (!semantics) return;
  let runtime = queuedCommandRuntime.get(head.id);
  if (!runtime) {
    runtime = {
      phase: "queued",
      queuedAt: performance.now(),
      source: semantics.source || "restored",
      target: semantics.target,
      lastCheckedRevision: -1,
      lastCheckedSignature: ""
    };
    queuedCommandRuntime.set(head.id, runtime);
  }
  const queueIndex = campaign.commandQueue.findIndex((item) => item.id === head.id);
  if (typeof renderer.previewAction === "function") {
    renderer.previewAction({
      ...semantics,
      action: head.action,
      commandId: head.id,
      phase: runtime.phase || "queued",
      queueIndex,
      source: semantics.source ?? runtime.source,
      target: semantics.target ?? runtime.target,
      queuedAt: runtime.queuedAt
    });
  }
}

async function executeQueuedCommandIfReady(id) {
  if (!campaign || campaign.status !== "active") return;
  const head = campaign.commandQueue[0];
  if (!head || head.id !== id) return;
  
  const runtime = queuedCommandRuntime.get(id);
  if (!runtime || runtime.phase === "executing") return;
  
  setQueuedCommandPhase(id, "executing");
  
  const action = head.action;
  const stage = currentStage();
  const priorCampaign = campaign;
  
  const reducerCheck = checkReservedCommandExecution(campaign, id);
  if (!reducerCheck.ready) {
    setQueuedCommandPhase(id, "blocked", reducerCheck.message);
    showTacticalFeedback(translateRejectionReason(reducerCheck.message));
    render();
    return;
  }
  
  let accepted = false;
  let result;
  try {
    result = executeReservedCommand(campaign, id);
    campaign = result.state;
    
    if (!result.accepted) {
      setQueuedCommandPhase(id, "blocked", result.message);
      showTacticalFeedback(translateRejectionReason(result.message));
      render();
      return;
    }
    
    accepted = true;
    startActionCooldown(action);
    dropQueuedCommandRuntime(id, "executed");
    
    synchronizeBattleRenderer();
    armEncounterWhenPrepared();
    
    const materializeCount = action === "materialize"
      ? campaign.stage.legion - priorCampaign.stage.legion
      : 0;
    const triggerVisual = triggerBattleVisual;
    triggerVisual(action, action === "materialize" ? { count: materializeCount } : {});
    
    render();
    await persistCampaign("persist.campaignSaved");
    
  } finally {
    if (typeof window.CustomEvent === "function") {
      window.setTimeout(() => {
        const event = new window.CustomEvent("abyssal:command-resolved", {
          detail: {
            id,
            action,
            accepted,
            phase: accepted ? "executed" : "rejected",
            message: result?.message || "",
            queueIndexBefore: 0,
            revision: campaign.revision
          }
        });
        window.dispatchEvent(event);
      }, 0);
    }
  }
}

function normalizeCommandRequest(request) {
  const raw = typeof request === "string" ? { action: request } : (request || {});
  const occurredAt = Number.isFinite(raw.occurredAt)
    ? raw.occurredAt
    : performance.now();
  const requestId = raw.requestId || `cmd-req-${++commandRequestSequence}`;
  return {
    type: "command-request",
    action: raw.action,
    requestId,
    source: raw.source || (typeof request === "string" ? "app-ui" : "renderer-pointer"),
    rendererMode: raw.rendererMode || "none",
    occurredAt
  };
}

function scheduleCommandQueueDrain() {
  scheduleQueueCheck();
}

function clearCommandQueueRuntime() {
  seenCommandRequests.clear();
  queuedCommandRuntime.clear();
}

async function drainCommandQueue() {
  if (!campaign || campaign.status !== "active") return;
  if (campaign.commandQueue.length === 0) {
    syncQueuedCommandPreview();
    return;
  }
  
  const head = campaign.commandQueue[0];
  let runtime = queuedCommandRuntime.get(head.id);
  if (!runtime) {
    runtime = {
      phase: "queued",
      queuedAt: performance.now(),
      source: "scheduler",
      lastCheckedRevision: -1,
      lastCheckedSignature: ""
    };
    queuedCommandRuntime.set(head.id, runtime);
  }
  
  const rendererRuntimeSignature = rendererRuntime ? JSON.stringify({
    bossExposed: rendererRuntime.bossExposed,
    enemiesActive: rendererRuntime.enemiesActive
  }) : "";
  const cooldownDeadline = cooldowns.get(head.action) || 0;
  const currentSignature = `${campaign.revision}:${rendererRuntimeSignature}:${cooldownDeadline}:${runtime.forceCheck ? "force" : ""}`;
  
  
  const check = evaluateQueuedCommandReadiness(head, runtime);
  runtime.lastCheckedSignature = currentSignature;
  delete runtime.forceCheck;
  
  const previousReason = runtime.reason;
  setQueuedCommandPhase(head.id, check.phase, check.reason);
  
  if (check.phase === "blocked") {
    showTacticalFeedback(translateRejectionReason(check.reason));
    render();
  } else if (check.ready) {
    await executeQueuedCommandIfReady(head.id);
  } else {
    if (check.reason === "out-of-range" && previousReason !== "out-of-range") {
      showTacticalFeedback(translate("tactical.rejection.outOfRange"));
    }
    syncQueuedCommandPreview();
    render();
  }
}

function scheduleQueueCheck() {
  if (!campaign || campaign.status !== "active" || campaign.commandQueue.length === 0) {
    if (commandExecutionTimer) {
      window.clearTimeout(commandExecutionTimer);
      commandExecutionTimer = 0;
    }
    return;
  }
  if (commandExecutionTimer) return;
  commandExecutionTimer = window.setTimeout(async () => {
    commandExecutionTimer = 0;
    await drainCommandQueue();
    scheduleQueueCheck();
  }, COMMAND_QUEUE_TICK_MS);
}

function stopCommandQueueTimer() {
  if (commandExecutionTimer) {
    window.clearTimeout(commandExecutionTimer);
    commandExecutionTimer = 0;
  }
  queuedCommandRuntime.clear();
  seenCommandRequests.clear();
}

function currentStage() {
  return STAGES[campaign.stageIndex];
}

let mirrorActive = false;
let fullscreenPending = false;
let lastSaveStatusType = "";
let lastSaveStatusKey = "";
let lastSaveStatusExtra = "";

function setSaveStatus(message, type = "plain", key = "", extra = "") {
  elements.saveStatus.textContent = message;
  if (key) {
    lastSaveStatusType = type;
    lastSaveStatusKey = key;
    lastSaveStatusExtra = extra;
  }
}

function refreshSaveStatus() {
  if (!lastSaveStatusKey) return;
  const lang = currentLang();
  let msg = translate(lastSaveStatusKey) || lastSaveStatusKey;
  if (lastSaveStatusType === "compatible") {
    msg = msg.replace("{source}", lastSaveStatusExtra);
  } else if (lastSaveStatusType === "rejected") {
    msg = msg.replace("{error}", lastSaveStatusExtra);
  } else if (lastSaveStatusType === "savedTo") {
    msg = lang === "ko"
      ? `${msg} (${lastSaveStatusExtra}에 저장됨)`
      : `${msg} in ${lastSaveStatusExtra}.`;
  }
  elements.saveStatus.textContent = msg;
}

function getNarrationLines(key) {
  const lang = currentLang();
  if (lang === "en" && NARRATION_EN[key]) {
    return NARRATION_EN[key];
  }
  return NARRATION[key]?.lines || [];
}

function syncAmbienceButtonText() {
  if (!elements.ambience) return;
  const lang = currentLang();
  if (!ambiencePlayer || ambiencePlayer.paused) {
    elements.ambience.textContent = lang === "ko" ? "환경음 재생" : "Play ambient sound";
  } else {
    elements.ambience.textContent = lang === "ko" ? "환경음 끄기" : "Pause ambient sound";
  }
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
  if (!msg) return "";
  const executedMatch = msg.match(/^Executed reserved command:\s*([^.]+)\.(?:\s*(.+))?$/);
  if (executedMatch) {
    if (lang !== "ko") return msg;
    const action = executedMatch[1].trim();
    const detail = executedMatch[2] ? executedMatch[2].trim() : "";
    const commandName = translate(`command.${action}.name`, lang) || action;
    const translatedDetail = detail ? translateStatusMessage(detail, lang) : "";
    return translatedDetail
      ? `예약된 ${commandName} 명령 실행: ${translatedDetail}`
      : `예약된 ${commandName} 명령 실행.`;
  }
  const reservedMatch = msg.match(/^Reserved command:\s*(.+)\.$/);
  if (reservedMatch) {
    const commandName = translate(`command.${reservedMatch[1]}.name`, lang) || reservedMatch[1];
    return translate("queue.reservedReceipt", lang).replace("{command}", commandName);
  }
  if (lang !== "ko") return msg;
  const summonEssenceMatch = msg.match(/\(\+(\d+) summon essence\)\.?$/);
  const localizedSummonEssence = summonEssenceMatch ? ` (+${summonEssenceMatch[1]} 소환 정수)` : "";


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
  if (msg.startsWith("The second spoor opens into a soul cache before the rift can close")) {
    return `균열이 닫히기 전에 두 번째 흔적이 그림자 은닉처로 열렸습니다.${localizedSummonEssence}`;
  }
  if (msg.startsWith("Four volatile shades tear free from the rift")) {
    return `네 명의 불안정한 그림자가 균열에서 흘러나왔습니다.${localizedSummonEssence}`;
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

function getInteractiveBattleActions() {
  if (!campaign || !battleUiActive() || resultOverlayOpen) return [];
  return getAvailableActions(campaign).filter((action) => remainingCooldown(action) <= 0);
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
  syncBattleScreenHud();
}

function renderBattleAssetStatus(options) {
  const opts = options || {};
  const state = opts.state;
  const loaded = opts.loaded || 0;
  const total = opts.total || 0;
  const clips = opts.clips || 0;
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

function formatLiveBattleHud(key, values, lang) {
  let text = translations[lang]?.[key] ?? key;
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function deriveLiveBattleHud(stage, state, runtime, lang) {
  const encounter = stage?.encounter && state?.encounter ? state.encounter : null;
  const waves = stage?.encounter?.waves ?? [];
  const progress = encounter?.waves ?? [];
  const total = waves.length;
  const activeIndex = encounter?.activeWaveId
    ? waves.findIndex((wave) => wave.id === encounter.activeWaveId)
    : -1;
  const nextIndex = progress.findIndex((wave) => wave?.cleared !== true);
  const threatIndex = activeIndex >= 0 ? activeIndex : nextIndex;
  const threat = threatIndex >= 0 ? waves[threatIndex] : null;
  const enemiesActive = Number.isFinite(runtime?.enemiesActive)
    ? Math.max(0, Math.trunc(runtime.enemiesActive))
    : 0;
  const engagements = Number.isFinite(runtime?.engagements)
    ? Math.max(0, Math.trunc(runtime.engagements))
    : 0;

  let forecastKey = "battle.live.forecast.none";
  let forecastState = "none";
  if (encounter?.bossExposed) {
    forecastKey = "battle.live.forecast.boss";
    forecastState = "boss";
  } else if (threat) {
    forecastKey = "battle.live.forecast.wave";
    forecastState = activeIndex >= 0 ? "live" : "pending";
  }
  const waveName = threat
    ? (lang === "ko" ? translations.ko[`wave.${threat.id}`] || threat.id : threat.id)
    : "";
  const forecast = formatLiveBattleHud(forecastKey, {
    current: threatIndex + 1,
    total,
    name: waveName,
    hostiles: threat?.hostiles ?? 0,
    seconds: threat?.spawnAtSeconds ?? 0,
  }, lang);

  let advanceKey = "battle.live.advance.waiting";
  let advanceState = "waiting";
  if (encounter?.spawningStopped || encounter?.bossExposed) {
    advanceKey = "battle.live.advance.stopped";
    advanceState = "stopped";
  } else if (activeIndex >= 0 && engagements > 0) {
    advanceKey = "battle.live.advance.engaged";
    advanceState = "engaged";
  } else if (activeIndex >= 0 && enemiesActive > 0) {
    advanceKey = "battle.live.advance.spawned";
    advanceState = "spawned";
  } else if (activeIndex >= 0) {
    advanceKey = "battle.live.advance.dispatched";
    advanceState = "dispatched";
  }
  const advance = formatLiveBattleHud(advanceKey, {
    active: enemiesActive,
    engagements,
  }, lang);

  const phaseCount = stage?.bossPhaseCount === 4 ? 4 : 3;
  const phase = resolveBossPhase({
    health: state?.bossHealth,
    maxHealth: stage?.bossHealth,
    phaseCount,
  });
  const bossPhaseState = encounter?.bossExposed ? "active" : "locked";
  const bossPhase = formatLiveBattleHud(
    encounter?.bossExposed ? "battle.live.bossPhase.active" : "battle.live.bossPhase.locked",
    {
      current: phase.accepted ? phase.phaseIndex + 1 : "—",
      total: phase.accepted ? phase.phaseCount : "—",
      health: state?.bossHealth ?? "—",
      maximum: stage?.bossHealth ?? "—",
    },
    lang,
  );

  const growthStage = total > 0
    ? Math.min(total, Math.max(1, threatIndex >= 0 ? threatIndex + 1 : total))
    : 0;
  const enemyGrowth = formatLiveBattleHud(
    total > 0 ? "battle.live.enemyGrowth.active" : "battle.live.enemyGrowth.none",
    { current: growthStage, total, active: enemiesActive },
    lang,
  );

  return {
    forecast: { text: forecast, state: forecastState },
    advance: { text: advance, state: advanceState },
    bossPhase: { text: bossPhase, state: bossPhaseState },
    enemyGrowth: { text: enemyGrowth, state: encounter?.bossExposed ? "boss" : (activeIndex >= 0 ? "live" : "pending") },
  };
}

function renderLiveBattleHud(stage, state, runtime, lang) {
  const projection = deriveLiveBattleHud(stage, state, runtime, lang);
  for (const [element, field] of [
    [elements.battleScreenForecast, projection.forecast],
    [elements.battleScreenAdvance, projection.advance],
    [elements.battleScreenBossPhase, projection.bossPhase],
    [elements.battleScreenEnemyGrowth, projection.enemyGrowth],
  ]) {
    if (!element) continue;
    element.textContent = field.text;
    element.dataset.state = field.state;
  }
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
  renderLiveBattleHud(stage, state, rendererRuntime, lang);

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
  syncQueuedCommandPreview(renderer);
  syncMinimap();
  scheduleQueueCheck();
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
    render();
    const encounterCue = ENCOUNTER_CUE_BY_EVENT[event.type];
    const hasAuthoredCue = encounterCue && (
      encounterCue === "breach-alert" ||
      encounterCue === "wave-spawn" ||
      (typeof CUE_BY_EFFECT !== "undefined" && CUE_BY_EFFECT[encounterCue])
    );
    if (hasAuthoredCue) {
      playCue(encounterCue);
    } else {
      const combatAlertCue = typeof getCombatAlertCue === "function"
        ? (getCombatAlertCue(event) || (encounterCue ? getCombatAlertCue(encounterCue) : null))
        : null;
      if (combatAlertCue) {
        const feedback = typeof getCombatAlertFeedback === "function"
          ? getCombatAlertFeedback(combatAlertCue)
          : (combatAlertCue.text || combatAlertCue.message || "");
        if (feedback && typeof showTacticalFeedback === "function") {
          showTacticalFeedback(feedback);
        }
        if (typeof playCombatAlertCue === "function") {
          playCombatAlertCue(combatAlertCue);
        }
      }
    }
    const encounter = currentEncounter();
    if (campaign.status !== "active" || encounter?.bossExposed || encounter?.spawningStopped) {
      clearEncounterStartTimer();
    }
    await persistCampaign(`persist.encounter.${event.type}`);
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
  stopBattleAudio();
  if (typeof stopCommandQueueTimer === "function") {
    stopCommandQueueTimer();
  }
  syncBgmScene("lobby");
  window.clearInterval(cooldownTimer);
  battleStartedAt = 0;
  rendererRuntime = null;
  rendererSelectionSummary = EMPTY_RENDERER_SELECTION;
  encounterEventQueue = Promise.resolve();
  cooldownTimer = 0;
  battleVisualFallback = false;
  cooldowns.clear();
  pendingCommandFocus = false;
  pendingBattleRenderer?.destroy();
  pendingBattleRenderer = null;
  battleStarting = false;
  if (visualizer && typeof visualizer.setPlacementMode === "function") {
    try {
      visualizer.setPlacementMode(null);
    } catch (err) {
      console.error("Failed to clear placement mode on visualizer destroy:", err);
    }
  }
  visualizer?.destroy();
  visualizer = null;
  activePlacementMode = null;
  if (tacticalFeedbackTimer) {
    window.clearTimeout(tacticalFeedbackTimer);
    tacticalFeedbackTimer = 0;
  }
  tacticalFeedbackMessage = "";
  minimapFailed = false;
  activeFieldFocusedAction = null;
  activeCommandHoverAction = null;
  activeCommandFocusAction = null;
  projectActionFocus(null);
  if (typeof syncMinimap === "function") syncMinimap();
}

function activateBattleFallback(stage, sessionId) {
  battleVisualFallback = true;
  renderBattleAssetStatus({ state: "unavailable" });
  const presentation = renderBattlePresentation(stage);
  let fallback = null;
  fallback = new BattleVisualizer(elements.battleFallbackCanvas, presentation, {
    nodeGoal: stage.nodeGoal,
    feedbackCanvas: elements.battleObjectFeedbackCanvas,
    resolveFeedbackSpeech: typeof getCombatAlertFeedback === "function" ? getCombatAlertFeedback : undefined,
    getAvailableActions: getInteractiveBattleActions,
    onAssetStatus: renderBattleAssetStatus,
    onActionRequest: (request) => void handleRendererCommandRequest(request, sessionId, fallback),
    onEncounterEvent: (event) => void handleEncounterEvent(event, sessionId, fallback),
    onRuntimeState: (runtime) => handleRendererRuntime(runtime, sessionId, fallback),
    onActionFocus: (action) => handleActionFocus(action),
    onSelectionChange: (summary) => handleRendererSelection(summary, sessionId),
    onTacticalRequest: (request) => handleTacticalRequest(request)
  });
  try {
    fallback.init();
    if (fallback && typeof fallback.setPlacementMode === "function") {
      fallback.setPlacementMode(activePlacementMode);
    }
    return fallback;
  } catch (err) {
    console.error("Failed to initialize battle fallback visualizer:", err);
    if (fallback) {
      try {
        fallback.destroy();
      } catch (destroyErr) {
        console.warn("Failed to destroy fallback visualizer after initialization failure:", destroyErr);
      }
    }
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
  rendererSelectionSummary = EMPTY_RENDERER_SELECTION;
  projectActionFocus(currentActionFocus());
  cooldownTimer = window.setInterval(render, 100);
  let battleRenderer = null;
  const stage = currentStage();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    visualizer = activateBattleFallback(stage, sessionId);
    if (visualizer && typeof visualizer.setPlacementMode === "function") {
      visualizer.setPlacementMode(activePlacementMode);
    }
    battleStarting = false;
  } else {
    try {
      const presentation = renderBattlePresentation(stage);
      battleRenderer = new RealtimeBattle(elements.battleCanvas3d, presentation, {
        nodeGoal: stage.nodeGoal,
        feedbackCanvas: elements.battleObjectFeedbackCanvas,
        resolveFeedbackSpeech: typeof getCombatAlertFeedback === "function" ? getCombatAlertFeedback : undefined,
        getAvailableActions: getInteractiveBattleActions,
        onAssetStatus: renderBattleAssetStatus,
        onActionRequest: (request) => void handleRendererCommandRequest(request, sessionId, battleRenderer),
        onEncounterEvent: (event) => void handleEncounterEvent(event, sessionId, battleRenderer),
        onRuntimeState: (runtime) => handleRendererRuntime(runtime, sessionId, battleRenderer),
        onActionFocus: (action) => handleActionFocus(action),
        onSelectionChange: (summary) => handleRendererSelection(summary, sessionId),
        onRendererFailure: () => {
          if (visualizer !== battleRenderer || sessionId !== battleSessionId || campaign?.status !== "active") return;
          visualizer = activateBattleFallback(currentStage(), sessionId);
          if (visualizer && typeof visualizer.setPlacementMode === "function") {
            visualizer.setPlacementMode(activePlacementMode);
          }
          synchronizeBattleRenderer();
          projectBattleRuntime();
          syncQueuedCommandPreview();
          void drainCommandQueue();
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
      if (visualizer && typeof visualizer.setPlacementMode === "function") {
        visualizer.setPlacementMode(activePlacementMode);
      }
    } finally {
      if (pendingBattleRenderer === battleRenderer) pendingBattleRenderer = null;
      if (!pendingBattleRenderer) battleStarting = false;
    }
  }
  if (sessionId !== battleSessionId || campaign?.status !== "active" || !visualizer) return;
  syncBgmScene("battle");
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
  return { cooling, enabled };
}

function setResourceMeter(element, value, maximum) {
  const meter = element?.closest("[data-resource]");
  if (!meter) return;
  const max = Math.max(1, Number(maximum) || 1);
  const progress = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  meter.style.setProperty("--resource-progress", `${Math.round(progress * 100)}%`);
}
function syncBattleScreenHud() {
  const mirrors = [
    [elements.battleScreenObjective, elements.stageObjective?.textContent],
    [elements.battleScreenPressure, elements.battlePressure?.textContent],
    [elements.battleScreenFeedback, elements.status?.textContent],
    [elements.battleScreenWave, elements.waveIndicator?.textContent],
    [elements.battleScreenSouls, elements.souls?.textContent],
    [elements.battleScreenLegion, elements.legion?.textContent],
    [elements.battleScreenNodes, elements.nodes?.textContent],
    [elements.battleScreenIntegrity, elements.integrity?.textContent],
    [elements.battleScreenBoss, `${elements.bossLabel?.textContent ?? ""} ${elements.boss?.textContent ?? ""}`.trim()],
  ];
  for (const [target, value] of mirrors) {
    if (target && value) target.textContent = value;
  }
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
  try {
    window.AbyssalProfile?.syncCampaign(campaign);
  } catch (e) {
    console.error("Profile sync failed:", e);
  }
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
  if (tacticalFeedbackMessage) {
    statusText = tacticalFeedbackMessage;
  }
  elements.status.textContent = statusText;

  elements.souls.textContent = String(state.souls);
  elements.legion.textContent = `${state.legion} / ${state.capacity}`;
  elements.nodes.textContent = `${state.nodes} / ${stage.nodeGoal}`;
  elements.integrity.textContent = `${state.integrity} / ${benefits.maxIntegrity}`;
  setResourceMeter(elements.souls, state.souls, stage.progression?.materializeCost ?? Math.max(1, state.souls));
  setResourceMeter(elements.legion, state.legion, state.capacity);
  setResourceMeter(elements.nodes, state.nodes, stage.nodeGoal);
  setResourceMeter(elements.integrity, state.integrity, benefits.maxIntegrity);
  const bossNameKo = translate(`stage.${stage.id}.bossName`) || stage.bossName;
  elements.bossLabel.textContent = lang === "ko"
    ? `${bossNameKo} 보호벽`
    : `${stage.bossName} ward`;
    
  elements.boss.textContent = `${state.bossHealth} / ${stage.bossHealth}`;
  setResourceMeter(elements.boss, state.bossHealth, stage.bossHealth);
  renderSelectionDossier();
  syncBattleScreenHud();
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
    const { cooling, enabled } = renderCooldown(button, action, isAvailable);
    button.classList.toggle("current-objective", isCurrentObjective);
    button.dataset.commandState = cooling
      ? "cooling"
      : isCurrentObjective && enabled
        ? "objective"
        : enabled
          ? "ready"
          : "locked";
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

  // 1. Render Marks Value
  const marksEl = document.querySelector("#tactical-marks-value");
  if (marksEl) {
    const progression = getTacticalProgression(campaign);
    marksEl.textContent = String(progression.marks);
  }

  // 2. Render Command Queue Buttons (Availability / Fullness)
  const reserveContainer = document.querySelector("#reserve-command");
  if (reserveContainer) {
    const progression = getTacticalProgression(campaign);
    const queue = progression.commandQueue || [];
    const queueLimit = Math.min(5, progression.skills.command + 1);
    const queueFull = queue.length >= queueLimit;
    
    const buttons = reserveContainer.querySelectorAll("button[data-reserve-action]");
    buttons.forEach((button) => {
      const action = button.dataset.reserveAction;
      const stage = currentStage();
      const hasAction = stage.commands[action] !== undefined;
      button.disabled = !hasAction || queueFull;
      
      const nameText = translate(`command.${action}.name`) || action;
      let labelText = lang === "ko" ? `${nameText} 예약` : `Reserve ${nameText}`;
      let titleText = labelText;
      
      if (!hasAction) {
        const reason = translate("queue.disabled.locked");
        labelText = `${nameText} (${reason})`;
        titleText = labelText;
      } else if (queueFull) {
        const reason = translate("queue.disabled.limit");
        labelText = `${nameText} (${reason})`;
        titleText = labelText;
      }
      
      button.textContent = lang === "ko" ? `${nameText} 예약` : `Reserve ${nameText}`;
      button.setAttribute("aria-label", labelText);
      button.setAttribute("title", titleText);
    });
  }

  // 3. Render Command Reservation Queue List
  const queueContainer = document.querySelector("#command-reservation-queue");
  if (queueContainer) {
    const activeEl = document.activeElement;
    let savedFocus = null;
    if (activeEl && queueContainer.contains(activeEl)) {
      const queueItem = activeEl.closest(".queue-item");
      if (queueItem) {
        savedFocus = {
          id: queueItem.dataset.id,
          index: parseInt(queueItem.dataset.index, 10),
          className: activeEl.className
        };
      }
    }
    queueContainer.innerHTML = "";
    const progression = getTacticalProgression(campaign);
    const queue = progression.commandQueue || [];
    
    if (queue.length === 0) {
      const li = document.createElement("li");
      li.className = "queue-empty";
      li.textContent = translate("queue.empty");
      queueContainer.appendChild(li);
    } else {
      queue.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "queue-item";
        li.dataset.index = index;
        li.dataset.id = item.id;
        
        const name = document.createElement("span");
        name.className = "queue-item-name";
        const commandName = translate(`command.${item.action}.name`) || item.action;
        name.textContent = commandName;
        
        if (item.reason) {
          const reasonSpan = document.createElement("span");
          reasonSpan.className = "queue-item-reason";
          reasonSpan.textContent = ` (${translateRejectionReason(item.reason, lang)})`;
          name.appendChild(reasonSpan);
        }
        
        li.appendChild(name);
        
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "queue-item-actions";
        
        const position = index + 1;
        let execLabel, upLabel, downLabel, cancelLabel;
        if (lang === "ko") {
          execLabel = `예약된 ${commandName} ${translate("queue.execute")} (위치 ${position})`;
          upLabel = `예약된 ${commandName} ${translate("queue.moveUp")}로 이동 (위치 ${position})`;
          downLabel = `예약된 ${commandName} ${translate("queue.moveDown")}로 이동 (위치 ${position})`;
          cancelLabel = `예약된 ${commandName} ${translate("queue.cancel")} (위치 ${position})`;
        } else {
          execLabel = `${translate("queue.execute")} reserved ${commandName} (position ${position})`;
          upLabel = `Move reserved ${commandName} ${translate("queue.moveUp").toLowerCase()} (position ${position})`;
          downLabel = `Move reserved ${commandName} ${translate("queue.moveDown").toLowerCase()} (position ${position})`;
          cancelLabel = `${translate("queue.cancel")} reserved ${commandName} (position ${position})`;
        }

        const execBtn = document.createElement("button");
        execBtn.type = "button";
        execBtn.className = "execute-reserved-btn";
        execBtn.textContent = lang === "ko" ? "실행" : "Exec";
        execBtn.dataset.id = item.id;
        execBtn.dataset.index = index;
        execBtn.setAttribute("aria-label", execLabel);
        execBtn.setAttribute("title", execLabel);
        execBtn.addEventListener("click", () => void handleExecuteReserved(item.id));
        actionsDiv.appendChild(execBtn);
        
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "reorder-up-btn";
        upBtn.textContent = "▲";
        upBtn.dataset.id = item.id;
        upBtn.dataset.index = index;
        upBtn.disabled = index === 0;
        upBtn.setAttribute("aria-label", upLabel);
        upBtn.setAttribute("title", upLabel);
        upBtn.addEventListener("click", () => void handleReorderReserved(index, index - 1));
        actionsDiv.appendChild(upBtn);
        
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "reorder-down-btn";
        downBtn.textContent = "▼";
        downBtn.dataset.id = item.id;
        downBtn.dataset.index = index;
        downBtn.disabled = index === queue.length - 1;
        downBtn.setAttribute("aria-label", downLabel);
        downBtn.setAttribute("title", downLabel);
        downBtn.addEventListener("click", () => void handleReorderReserved(index, index + 1));
        actionsDiv.appendChild(downBtn);
        
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "cancel-reserved-btn";
        cancelBtn.textContent = lang === "ko" ? "취소" : "Cancel";
        cancelBtn.dataset.id = item.id;
        cancelBtn.dataset.index = index;
        cancelBtn.setAttribute("aria-label", cancelLabel);
        cancelBtn.setAttribute("title", cancelLabel);
        cancelBtn.addEventListener("click", () => void handleCancelReserved(item.id));
        actionsDiv.appendChild(cancelBtn);
        
        li.appendChild(actionsDiv);
        queueContainer.appendChild(li);
      });
    }

    if (savedFocus) {
      const newItems = Array.from(queueContainer.querySelectorAll(".queue-item"));
      if (newItems.length > 0) {
        let targetItem = newItems.find(item => item.dataset.id === savedFocus.id);
        if (!targetItem) {
          const targetIndex = Math.max(0, Math.min(savedFocus.index, newItems.length - 1));
          targetItem = newItems[targetIndex];
        }
        if (targetItem) {
          const selector = savedFocus.className.split(" ").map(c => `.${c}`).join("");
          const targetBtn = targetItem.querySelector(selector) || targetItem.querySelector("button");
          if (targetBtn) {
            targetBtn.focus();
          }
        }
      } else {
        const fallback = document.querySelector("#tactical-deployment-controls button:not([disabled])") ||
                         document.querySelector("#tactical-skill-controls button:not([disabled])") ||
                         document.querySelector(".command-btn:not([disabled])") ||
                         document.querySelector("button:not([disabled])");
        if (fallback) {
          fallback.focus();
        }
      }
    }
  }

  // 4. Render Deployment Controls
  const deploymentContainer = document.querySelector("#tactical-deployment-controls");
  if (deploymentContainer) {
    const progression = getTacticalProgression(campaign);
    const fortificationLevel = progression.skills.fortification;
    const currentDeployments = progression.deployments || [];
    
    const buttons = deploymentContainer.querySelectorAll("button[data-kind]");
    buttons.forEach((button) => {
      const kind = button.dataset.kind;
      const cost = kind === "tower" ? 4 : 2;
      
      const currentCount = currentDeployments.filter((d) => d.kind === kind).length;
      const cap = kind === "tower" ? fortificationLevel : (fortificationLevel + 1);
      
      const hasMarks = progression.marks >= cost;
      const limitReached = currentCount >= cap;
      
      button.disabled = !hasMarks || limitReached;
      button.classList.toggle("active", activePlacementMode === kind);
      button.setAttribute("aria-pressed", activePlacementMode === kind ? "true" : "false");

      let labelText = "";
      const actionName = translate(`placement.${kind}`) || kind;
      if (lang === "ko") {
        const statusText = activePlacementMode === kind 
          ? "배치 모드 활성화됨" 
          : button.disabled 
            ? (limitReached ? "배치 불가 (배치 한도에 도달했습니다.)" : "배치 불가 (전술 휘장이 부족합니다.)")
            : "배치 가능";
        labelText = `${actionName} (비용: ${cost} 휘장, ${currentCount}/${cap}대 배치됨) - ${statusText}`;
      } else {
        const statusText = activePlacementMode === kind 
          ? "active placement mode" 
          : button.disabled 
            ? (limitReached ? "unavailable (Deployment cap reached.)" : "unavailable (Not enough Tactical Marks.)")
            : "available to deploy";
        labelText = `${actionName} (Cost: ${cost} Marks, ${currentCount}/${cap} deployed) - ${statusText}`;
      }
      button.setAttribute("aria-label", labelText);
      button.setAttribute("title", labelText);
      
      const strongEl = button.querySelector("strong");
      if (strongEl) {
        strongEl.textContent = translate(`placement.${kind}`) || kind;
      }
      const smallEl = button.querySelector("small");
      if (smallEl) {
        smallEl.textContent = translate(`placement.${kind}Desc`) || "";
      }
      const costBadgeEl = button.querySelector(".cost-badge");
      if (costBadgeEl) {
        costBadgeEl.textContent = lang === "ko" ? `${cost}점` : `${cost} M`;
      }
      let countEl = button.querySelector(".count-badge");
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "count-badge";
        const smallElRef = button.querySelector("small");
        if (smallElRef) {
          button.insertBefore(countEl, smallElRef);
        } else {
          button.appendChild(countEl);
        }
      }
      countEl.textContent = `[${currentCount}/${cap}]`;
    });
  }

  // 5. Render Skill Upgrades
  const skillContainer = document.querySelector("#tactical-skill-controls");
  if (skillContainer) {
    const progression = getTacticalProgression(campaign);
    const marks = progression.marks;
    
    const buttons = skillContainer.querySelectorAll("button[data-skill]");
    buttons.forEach((button) => {
      const skill = button.dataset.skill;
      const currentLevel = progression.skills[skill] ?? 1;
      const cost = currentLevel * 4;
      const maxed = currentLevel >= 5;
      
      button.disabled = maxed || marks < cost;
      
      const levelEl = document.getElementById("skill-level-" + skill);
      if (levelEl) {
        levelEl.textContent = maxed
          ? `${currentLevel} (${translate("tactical.max")})`
          : currentLevel;
      }
      
      const costEl = document.getElementById("skill-cost-" + skill);
      if (costEl) {
        costEl.textContent = maxed ? "-" : cost;
      }

      const skillLabel = translate(`tactical.skill.${skill}`) || skill;
      
      let labelText = "";
      if (lang === "ko") {
        const levelText = `레벨: ${currentLevel}/5`;
        const costText = maxed ? "" : ` (비용: ${cost} 휘장)`;
        const statusText = maxed 
          ? `잠김 (${translate("tactical.maxLevel")})` 
          : (marks < cost ? "업그레이드 불가 (전술 휘장이 부족합니다.)" : "업그레이드 가능");
        labelText = `${skillLabel} (${levelText}${costText}) - ${statusText}`;
      } else {
        const levelText = `Level: ${currentLevel}/5`;
        const costText = maxed ? "" : ` (Cost: ${cost} Marks)`;
        const statusText = maxed 
          ? `locked (${translate("tactical.maxLevel")})` 
          : (marks < cost ? "unavailable (Not enough Tactical Marks.)" : "available to upgrade");
        labelText = `${skillLabel} (${levelText}${costText}) - ${statusText}`;
      }
      button.setAttribute("aria-label", labelText);
      button.setAttribute("title", labelText);
    });
  }

  // 6. Render campaign-owned summon evolution controls.
  const summons = campaign.progression?.summons ?? { essence: 0, levels: {} };
  if (elements.summonEssence) elements.summonEssence.textContent = String(summons.essence);
  for (const button of elements.summonEvolutionButtons ?? []) {
    const recipeId = button.dataset.summonRecipe;
    const recipe = SUMMON_RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) {
      button.disabled = true;
      continue;
    }
    const level = summons.levels?.[recipeId] ?? 0;
    const maxed = level >= recipe.maxLevel;
    const cost = maxed ? null : recipe.essenceCosts[level];
    const affordable = cost !== null && summons.essence >= cost;
    button.disabled = campaign.status !== "active" || maxed || !affordable;
    button.dataset.evolutionState = maxed ? "max" : affordable ? "ready" : "essence";

    const levelElement = button.querySelector("[data-summon-level]");
    if (levelElement) {
      levelElement.textContent = formatLiveBattleHud(
        maxed ? "summon.level.max" : "summon.level.current",
        { level, maximum: recipe.maxLevel },
        lang,
      );
    }
    const costElement = button.querySelector("[data-summon-cost]");
    if (costElement) {
      costElement.textContent = maxed
        ? translate("summon.cost.max")
        : formatLiveBattleHud("summon.cost.next", { cost }, lang);
    }
    const name = translate(`summon.recipe.${recipeId}.name`) || recipe.name;
    button.setAttribute("aria-label", formatLiveBattleHud(
      maxed
        ? "summon.control.max"
        : affordable
          ? "summon.control.ready"
          : "summon.control.essence",
      { name, level, maximum: recipe.maxLevel, cost, essence: summons.essence },
      lang,
    ));
  }

  // 6. Update Minimap Snapshot
  syncMinimap();


  renderChecklist(checklist);
  if (campaign.status === "reward") renderRewards(stage);
  renderStageMedia(stage);
  syncNarration();
  focusPendingCommand();
  if (typeof window.CustomEvent === "function") {
    window.dispatchEvent(new window.CustomEvent("abyssal:campaign-rendered"));
  }
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
  const now = performance.now();
  if (effect === lastCueEffect && now - lastCueStartedAt < 150) return;
  lastCueEffect = effect;
  lastCueStartedAt = now;
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

function getCombatAlertFeedback(cue) {
  if (!cue) return "";
  const cueId = typeof cue.id === "string" ? cue.id : "";
  const key = COMBAT_ALERT_FEEDBACK_KEYS[cueId] || (cueId ? `combat.alert.${cueId}` : "");
  const lang = typeof currentLang === "function" ? currentLang() : "en";
  if (key && typeof translate === "function") {
    const localized = translate(key, lang);
    if (localized && localized !== key) return localized;
  }
  const text = typeof cue.text === "string"
    ? cue.text
    : (typeof cue.message === "string" ? cue.message : cue.label);
  return typeof text === "string" && text.trim()
    ? text.trim()
    : (cueId ? `Combat alert: ${cueId}` : "Combat alert");
}

function playProceduralCombatAlert(cue) {
  if (!cue || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  let context;
  try {
    context = new AudioCtx();
    if (!context || !context.createOscillator || !context.createGain) return;
    if (context.state === "suspended") context.resume().catch(() => undefined);
    if (context.state === "closed") return;
    const critical = cue.severity === "critical";
    const positive = cue.severity === "positive";
    const startFrequency = critical ? 660 : positive ? 520 : 420;
    const endFrequency = critical ? 300 : positive ? 780 : 220;
    const duration = Math.max(0.12, Math.min(0.8, Number(cue.durationMs) / 1000 || 0.24));
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = critical ? "square" : positive ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + Math.min(0.04, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.addEventListener?.("ended", () => context.close?.(), { once: true });
  } catch {
    context?.close?.();
  }
}

function playCombatAlertCue(cue) {
  if (!cue) return;
  const candidateCue = ENCOUNTER_CUE_BY_EVENT[cue.event] || ENCOUNTER_CUE_BY_EVENT[cue.id];
  const authoredCue = candidateCue && (
    candidateCue === "breach-alert" ||
    candidateCue === "wave-spawn" ||
    (typeof CUE_BY_EFFECT !== "undefined" && CUE_BY_EFFECT[candidateCue])
  );
  if (authoredCue) {
    playCue(authoredCue);
    return;
  }
  const effect = typeof cue.id === "string" ? cue.id : "";
  if (effect && CUE_BY_EFFECT[effect]) {
    playCue(effect);
    return;
  }
  const now = performance.now();
  if (effect && effect === lastCueEffect && now - lastCueStartedAt < 150) return;
  lastCueEffect = effect;
  lastCueStartedAt = now;
  playProceduralCombatAlert(cue);
}

function setBgmTogglePlaying(playing) {
  elements.bgmToggle?.classList.toggle("is-playing", playing);
  elements.bgmToggle?.setAttribute("aria-pressed", String(playing));
}

function playSelectedBgm(run) {
  const player = elements.bgmPlayer;
  if (!player) return;
  player.volume = 0.55;
  player.play().then(() => {
    if (run === bgmSceneRun && bgmEnabled) setBgmTogglePlaying(true);
  }).catch(() => {
    if (run !== bgmSceneRun) return;
    bgmEnabled = false;
    setBgmTogglePlaying(false);
  });
}

function musicSourceForScene(scene) {
  if (scene === "battle") {
    const stageId = typeof campaign !== "undefined" && campaign ? currentStage()?.id : "";
    return (typeof MUSIC_BY_STAGE !== "undefined" && MUSIC_BY_STAGE[stageId]) || MUSIC_BY_SCENE.battle;
  }
  return MUSIC_BY_SCENE[scene];
}

function syncBgmScene(scene) {
  const player = elements.bgmPlayer;
  const source = musicSourceForScene(scene);
  if (!player || !source) return;
  if (player.getAttribute("src") === source) {
    player.dataset.audioScene = scene;
    if (bgmEnabled && player.paused) playSelectedBgm(bgmSceneRun);
    return;
  }
  const run = ++bgmSceneRun;
  player.pause();
  player.src = source;
  player.dataset.audioScene = scene;
  if (bgmEnabled) {
    player.load();
    playSelectedBgm(run);
  }
}

function stopBattleAudio() {
  lastCueEffect = "";
  lastCueStartedAt = 0;
  if (cuePlayer) {
    cuePlayer.pause();
    cuePlayer.currentTime = 0;
    cuePlayer.removeAttribute("src");
    cuePlayer.load();
  }
  if (ambiencePlayer) {
    ambiencePlayer.pause();
    ambiencePlayer.currentTime = 0;
    ambiencePlayer.removeAttribute("src");
    ambiencePlayer.load();
    ambiencePlayer = null;
  }
  elements.ambience.textContent = translate("battle.toggleAmbience") || "Play ambience";
  elements.ambience.setAttribute("aria-pressed", "false");
}

function waitForNarration(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setTypedNarrationLine(line) {
  elements.narrationLine.textContent = line;
  elements.briefingNarration.textContent = line;
}

async function typeNarration(key, run) {
  const entry = NARRATION[key];
  if (!entry) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lines = getNarrationLines(key);
  for (const line of lines) {
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
  activeNarrationKey = key;
  const run = ++narrationRun;
  const lines = getNarrationLines(key);
  elements.narrationSr.textContent = lines.join(" ");
  void typeNarration(key, run);
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

function refreshNarrationLanguage() {
  if (!activeNarrationKey) return;
  const lines = getNarrationLines(activeNarrationKey);
  if (!lines.length) return;
  narrationRun += 1;
  elements.narrationLine.classList.remove("is-typing");
  elements.narrationSr.textContent = lines.join(" ");
  setTypedNarrationLine(lines[lines.length - 1]);
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
  const activeCampaign = campaign;
  const envelope = createSaveEnvelope(campaign);
  storedCampaign = campaign;
  updateResumeAffordance();
  const savedTo = await storage.save(envelope);
  if (campaign === activeCampaign) {
    campaignMirror?.publish(envelope);
  }
  const lang = currentLang();
  const localizedContext = translate(contextKey) || contextKey;
  const statusMsg = lang === "ko"
    ? `${localizedContext} (${savedTo}에 저장됨)`
    : `${localizedContext} in ${savedTo}.`;
  setSaveStatus(statusMsg, "savedTo", contextKey, savedTo);
}

async function applyMirroredCampaign(envelope, metadata) {
  try {
    const mirroredCampaign = restoreSaveEnvelope(envelope);
    const activeCampaign = campaign;
    await storage.save(envelope);
    const isStale = campaign !== activeCampaign || (campaignMirror && !campaignMirror?.authorize(metadata));
    if (isStale) {
      const restoreCampaign = campaign || storedCampaign;
      if (restoreCampaign) {
        await storage.save(createSaveEnvelope(restoreCampaign));
      }
      return;
    }
    storedCampaign = mirroredCampaign;
    updateResumeAffordance();
    if (campaign) {
      stopBattle();
      campaign = mirroredCampaign;
      if (typeof syncCommandRuntimeFromCampaign === "function") {
        syncCommandRuntimeFromCampaign();
      }
      narratedStageId = null;
      narratedOutcome = null;
      render();
    }
    setSaveStatus(translate("saveStatus.mirroredApplied"), "plain", "saveStatus.mirroredApplied");
  } catch {
    // The mirror validates structure; replay validation keeps incompatible saves local.
  }
}

function triggerBattleVisual(action, details = {}) {
  const opts = details || {};
  if (!campaign) return;
  const semantic = BATTLE_ACTION_SEMANTICS[action];
  if (!semantic) return;
  if (visualizer) {
    visualizer.playActionEffect({ ...semantic, action, ...opts });
    return;
  }
  flashEffect(action);
  playCue(action);
}

function startActionCooldown(action) {
  const duration = getCommandCooldown(campaign, action);
  cooldowns.set(action, performance.now() + duration * 1000);
}

async function handleAction(action) {
  return enqueueCommandRequest(action, { source: "primary-control" });
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
  if (document.fullscreenElement === elements.screen && typeof document.exitFullscreen === "function") {
    fullscreenPending = true;
    syncFullscreenControl();
    try {
      await document.exitFullscreen();
    } catch {
      fullscreenPending = false;
      syncFullscreenControl();
      return;
    }
    if (document.fullscreenElement === elements.screen) return;
  }
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
  syncCommandRuntimeFromCampaign();
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
  setSaveStatus(translate("saveStatus.exported"), "plain", "saveStatus.exported");
}

async function importSave(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSaveStatus(translate("importTooLarge"), "plain", "importTooLarge");
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
    setSaveStatus(translate("importRejected").replace("{error}", errorMsg), "rejected", "importRejected", errorMsg);
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
      const lang = currentLang();
      elements.ambience.textContent = lang === "ko" ? "환경음을 사용할 수 없음" : "Ambient sound unavailable";
      elements.ambience.setAttribute("aria-pressed", "false");
    });
  }
  const lang = currentLang();
  if (ambiencePlayer.paused) {
    ambiencePlayer.play().then(() => {
      elements.ambience.textContent = lang === "ko" ? "환경음 끄기" : "Pause ambient sound";
      elements.ambience.setAttribute("aria-pressed", "true");
    }).catch(() => {
      elements.ambience.textContent = lang === "ko" ? "환경음을 사용할 수 없음" : "Ambient sound unavailable";
    });
  } else {
    ambiencePlayer.pause();
    elements.ambience.textContent = lang === "ko" ? "환경음 재생" : "Play ambient sound";
    elements.ambience.setAttribute("aria-pressed", "false");
  }
}
function toggleBgm() {
  const player = elements.bgmPlayer;
  if (!player || !elements.bgmToggle) return;
  if (bgmEnabled) {
    bgmEnabled = false;
    bgmSceneRun += 1;
    player.pause();
    setBgmTogglePlaying(false);
    return;
  }
  bgmEnabled = true;
  playSelectedBgm(++bgmSceneRun);
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

function syncFullscreenControl() {
  if (!elements.toggleFullscreen) return;
  const supported = typeof elements.screen?.requestFullscreen === "function"
    && typeof document.exitFullscreen === "function"
    && document.fullscreenEnabled !== false;
  elements.toggleFullscreen.hidden = !supported;
  if (!supported) return;

  const active = document.fullscreenElement === elements.screen;
  elements.toggleFullscreen.setAttribute("aria-pressed", String(active));
  elements.toggleFullscreen.disabled = fullscreenPending;
  elements.toggleFullscreen.setAttribute("aria-keyshortcuts", "Shift+F");

  const key = active ? "screen.fullscreenExit" : "screen.fullscreenEnter";
  elements.toggleFullscreen.dataset.i18n = key;
  elements.toggleFullscreen.textContent = translate(key);

  const titleKey = active ? "screen.fullscreenExitTitle" : "screen.fullscreenEnterTitle";
  elements.toggleFullscreen.setAttribute("title", translate(titleKey));
}

function announceFullscreen(statusKey) {
  const statusEl = document.querySelector("#fullscreen-status");
  if (statusEl) {
    statusEl.textContent = translate(statusKey);
  }
}

function handleFullscreenError() {
  const wasPending = fullscreenPending;
  fullscreenPending = false;
  syncFullscreenControl();
  if (wasPending) {
    announceFullscreen("screen.fullscreenError");
  }
}

async function toggleFullscreen() {
  if (!elements.toggleFullscreen || elements.toggleFullscreen.hidden || fullscreenPending) return;
  const supported = typeof elements.screen?.requestFullscreen === "function"
    && typeof document.exitFullscreen === "function"
    && document.fullscreenEnabled !== false;
  if (!supported) return;

  fullscreenPending = true;
  syncFullscreenControl();

  try {
    if (document.fullscreenElement === elements.screen) {
      await document.exitFullscreen();
    } else {
      await elements.screen.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (err) {
    handleFullscreenError();
  }
}

function playCinematic() {
  const video = elements.cinematic;
  video.hidden = false;
  elements.cinematicFallback.hidden = true;
  video.muted = true;

  if (video.getAttribute("src")) {
    if (video.ended) video.currentTime = 0;
    elements.cinematicButton.disabled = true;
    video.play().catch(() => {
      elements.cinematicButton.disabled = false;
      setCinematicStatus("ready");
    });
    return;
  }

  elements.cinematicButton.disabled = true;
  setCinematicStatus("loading");
  video.onplaying = () => {
    elements.cinematicButton.disabled = true;
    setCinematicStatus("playing");
  };
  video.onpause = () => {
    if (video.ended || cinematicStatusKey === "unavailable" || video.readyState === 0) return;
    elements.cinematicButton.disabled = false;
    setCinematicStatus("paused");
  };
  video.onended = () => {
    elements.cinematicButton.disabled = false;
    setCinematicStatus("ended");
  };
  video.onloadeddata = () => {
    video.play().catch(() => {
      elements.cinematicButton.disabled = false;
      setCinematicStatus("ready");
    });
  };
  video.onerror = () => {
    setCinematicStatus("unavailable");
    video.pause();
    video.hidden = true;
    elements.cinematicFallback.hidden = false;
    video.removeAttribute("src");
    video.load();
    elements.cinematicButton.disabled = false;
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
  elements.toggleFullscreen?.addEventListener("click", () => void toggleFullscreen());
  document.addEventListener("fullscreenchange", () => {
    const wasActive = elements.toggleFullscreen?.getAttribute("aria-pressed") === "true";
    const active = document.fullscreenElement === elements.screen;
    fullscreenPending = false;
    syncFullscreenControl();
    if (active) announceFullscreen("screen.fullscreenEntered");
    else if (wasActive) announceFullscreen("screen.fullscreenExited");
  });
  document.addEventListener("fullscreenerror", handleFullscreenError);
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
  elements.commandButtons.forEach((button) => {
    const action = button.dataset.action;
    button.addEventListener("click", () => handleAction(action));
    
    button.addEventListener("pointerenter", () => {
      activeCommandHoverAction = action;
      updateActionFocus();
    });

    button.addEventListener("pointerleave", () => {
      if (activeCommandHoverAction !== action) return;
      activeCommandHoverAction = null;
      updateActionFocus();
    });

    button.addEventListener("focus", () => {
      activeCommandFocusAction = action;
      updateActionFocus();
    });

    button.addEventListener("blur", () => {
      if (activeCommandFocusAction !== action) return;
      activeCommandFocusAction = null;
      updateActionFocus();
    });
  });
  // Delegated UI listeners for tactical command controls
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;

    // 1. Reserve action buttons
    const reserveButton = target.closest("#reserve-command button[data-reserve-action]");
    if (reserveButton) {
      const action = reserveButton.dataset.reserveAction;
      void handleReserveAction(action);
      return;
    }

    // 2. Deployment buttons
    const deployButton = target.closest("#tactical-deployment-controls button[data-kind]");
    if (deployButton) {
      const kind = deployButton.dataset.kind;
      void handleDeploymentSelect(kind);
      return;
    }

    // 3. Skill upgrade buttons
    const skillButton = target.closest("#tactical-skill-controls button[data-skill]");
    if (skillButton) {
      const skill = skillButton.dataset.skill;
      void handleSkillUpgrade(skill);
      return;
    }
    // 4. Summon evolution buttons
    const summonButton = target.closest("#summon-evolution-controls button[data-summon-recipe]");
    if (summonButton) {
      void handleSummonEvolution(summonButton.dataset.summonRecipe);
      return;
    }

  });

  elements.exportSave.addEventListener("click", exportSave);
  elements.importSave.addEventListener("change", () => importSave(elements.importSave.files?.[0]));
  elements.ambience.addEventListener("click", toggleAmbience);
  elements.bgmToggle?.addEventListener("click", toggleBgm);
  elements.cinematicButton.addEventListener("click", playCinematic);
  elements.cinematicTranscriptToggle.addEventListener("click", toggleCinematicTranscript);
  elements.cinematicTranscript.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleCinematicTranscript();
  });
  window.addEventListener("abyssal:language-changed", () => {
    updateResumeAffordance();
    syncCinematicCopy();
    syncAmbienceButtonText();
    refreshSaveStatus();
    if (campaign) render();
    updateActionFocus();
    refreshNarrationLanguage();
    syncFullscreenControl();
  });
  window.addEventListener("keydown", (event) => {
    if ((event.key === "F" || event.key === "f") && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
      const focusOwner = document.activeElement;
      const isEditable = focusOwner && (
        focusOwner.tagName === "INPUT" ||
        focusOwner.tagName === "TEXTAREA" ||
        focusOwner.tagName === "SELECT" ||
        focusOwner.isContentEditable
      );
      const supported = typeof elements.screen?.requestFullscreen === "function"
        && typeof document.exitFullscreen === "function"
        && document.fullscreenEnabled !== false;

      if (!isEditable && elements.screen && !elements.screen.hidden && supported && campaign) {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
    }
    if (event.key === "Escape" && typeof activePlacementMode !== "undefined" && activePlacementMode) {
      event.preventDefault();
      if (typeof cancelPlacementMode === "function") {
        cancelPlacementMode();
      }
      return;
    }


    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    
    const focusOwner = document.activeElement;
    const isCanvasFocused = focusOwner === elements.battleCanvas3d || focusOwner === elements.battleFallbackCanvas;
    const isBodyFocused = focusOwner === document.body || focusOwner === document.documentElement;
    const isCommandFocused = elements.commandButtons.includes(focusOwner);

    if (!isCanvasFocused && !isBodyFocused && !isCommandFocused) return;

    let action = null;
    const keyLower = event.key.toLowerCase();
    const codeLower = event.code ? event.code.toLowerCase() : "";

    if (DIGIT_ACTION_KEYS[keyLower]) {
      action = DIGIT_ACTION_KEYS[keyLower];
    } else if (DIGIT_ACTION_KEYS[codeLower]) {
      action = DIGIT_ACTION_KEYS[codeLower];
    } else if (ACTION_KEYS[keyLower]) {
      action = ACTION_KEYS[keyLower];
      if (isCanvasFocused && (action === "domain" || action === "assault")) action = null;
    }

    if (action && battleUiActive() && !resultOverlayOpen && campaign && getAvailableActions(campaign).includes(action)) {
      event.preventDefault();
      void handleAction(action);
    }
  });
  syncFullscreenControl();
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

  return particleLoop;
}

async function initialize() {
  document.documentElement.dataset.rulesVersion = RULES_VERSION;
  document.documentElement.dataset.buildTag = BUILD_TAG;
  if (window.AbyssalProfile) {
    try {
      const snapshot = window.AbyssalProfile.getSnapshot();
      if (snapshot?.equippedTheme) {
        document.documentElement.dataset.uiTheme = snapshot.equippedTheme;
      }
    } catch (e) {
      console.error("AbyssalProfile initialization failed:", e);
    }
  }
  syncCinematicCopy();
  await storage.open();
  const loaded = await storage.load();
  if (loaded.envelope) {
    try {
      storedCampaign = restoreSaveEnvelope(loaded.envelope);
      updateResumeAffordance();
      setSaveStatus(translate("saveStatus.compatibleCampaign").replace("{source}", loaded.source), "compatible", "saveStatus.compatibleCampaign", loaded.source);
    } catch {
      setSaveStatus(translate("saveStatus.incompatibleCampaign"), "plain", "saveStatus.incompatibleCampaign");
    }
  } else {
    const key = storage.mode === "indexeddb" ? "saveStatus.noCampaignIndexedDb" : "saveStatus.indexedDbUnavailable";
    setSaveStatus(translate(key), "plain", key);
  }
  campaignMirror = new CampaignMirror({ onState: (envelope, metadata) => applyMirroredCampaign(envelope, metadata) });
  const mirrorAvailability = campaignMirror.start(storedCampaign ? createSaveEnvelope(storedCampaign) : null);
  mirrorActive = mirrorAvailability.available;
  elements.mirrorStatus.textContent = mirrorActive
    ? translate("save.mirrorActive")
    : translate("save.mirrorInactive");
  window.addEventListener("pagehide", () => campaignMirror?.close(), { once: true });
  wireControls();
  particleBackground = initReactBitsEffects();
  syncBackgroundEffects();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

initialize();
