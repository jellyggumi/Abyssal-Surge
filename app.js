import {
  RULES_VERSION,
  STAGES,
  applyAction,
  applyBattleBreach,
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
import { currentLang, translations } from "./i18n.js";

const BUILD_TAG = "abyssal-surge-static-v1";
const DB_NAME = "abyssal-surge-campaign";
const DB_VERSION = 1;
const STORE_NAME = "campaigns";
const PRIMARY_KEY = "primary";
const FALLBACK_KEY = "abyssal-surge-campaign-fallback-v1";
const MAX_IMPORT_BYTES = 256 * 1024;
const REWARD_ART_IDS = new Set(["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"]);
const ACTION_KEYS = Object.freeze({ h: "hunt", e: "extract", m: "materialize", c: "capture", p: "possess", d: "domain", a: "assault" });
const BATTLE_ACTION_SEMANTICS = Object.freeze({
  hunt: Object.freeze({ source: "portal", target: "extractor", sourceAsset: "shade", clip: "Special" }),
  extract: Object.freeze({ source: "extractor", target: "portal", sourceAsset: "soul-extractor", clip: "Activate" }),
  materialize: Object.freeze({ source: "portal", target: "portal", sourceAsset: "rift-portal", clip: "Activate" }),
  capture: Object.freeze({ source: "portal", target: "node", sourceAsset: "command-obelisk", clip: "Activate" }),
  possess: Object.freeze({ source: "portal", target: "ally", sourceAsset: "possessed", clip: "Special" }),
  domain: Object.freeze({ source: "portal", target: "portal", sourceAsset: "echo-throne", clip: "Activate" }),
  assault: Object.freeze({ source: "ally", target: "boss", sourceAsset: "shade", clip: "Strike" }),
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
const BATTLE_PREPARATION_MS = 25_000;
// Simulated-mode breach pacing (reduced-motion / renderer fallback ONLY).
// In the live sim a breach fires when a hostile VISUALLY reaches the Dusk
// Portal (BattleVisualizer.onEnemyBreach) - defenders can prevent it.
// Timers can't be defended against, so the simulated schedule must be
// forgiving: longer fuse, and only ~half of each wave converts to a breach.
const BATTLE_BREACH_DELAY_MS = 20_000;
const SIMULATED_BREACH_RATIO = 0.5;
// Wave cycle: 3 waves 8s apart, then a lull to hunt/extract/materialize.
const WAVE_GAP_MS = 9_000;
const WAVE_LULL_MS = 14_000;
const BOSS_SPEC = Object.freeze([
  Object.freeze({ threat: "Class A", counter: 1, lore: "The forge bridge's ashbound sentinel breaks intruders against the drowned iron." }),
  Object.freeze({ threat: "Class S", counter: 2, lore: "A tactician of listening stone that turns every uncovered route into a killing field." }),
  Object.freeze({ threat: "Class Sovereign", counter: 8, lore: "The final gate's remembered ruler, holding back the last abyssal tide." })
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
    holdMs: 2000
  }),
  "veil-citadel": Object.freeze({
    audio: "assets/audio/narr-stage2.mp3",
    lines: Object.freeze(["장막 성채, 베일 시타델.", "빙의의 힘이 깨어난다.", "두 거점을 동시에 장악하라."]),
    msPerChar: 45,
    holdMs: 1700
  }),
  "echo-throne": Object.freeze({
    audio: "assets/audio/narr-stage3.mp3",
    lines: Object.freeze(["메아리 왕좌.", "군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."]),
    msPerChar: 45,
    holdMs: 2000
  }),
  victory: Object.freeze({
    audio: "assets/audio/narr-victory.mp3",
    lines: Object.freeze(["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."]),
    msPerChar: 45,
    holdMs: 1400
  }),
  defeat: Object.freeze({
    audio: "assets/audio/narr-defeat.mp3",
    lines: Object.freeze(["군단의 닻이 끊어졌다.", "다시, 일어나라."]),
    msPerChar: 45,
    holdMs: 1400
  })
});
const BOSS_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/ui/boss-cinder-warden.png",
  "veil-citadel": "assets/images/ui/boss-veil-tactician.png",
  "echo-throne": "assets/images/ui/boss-gate-sovereign.png"
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
  "echo-throne": "assets/images/echo-throne.png"
});
const TACTICAL_SURFACE = "assets/images/ui/concept-tactical-surface.webp";
const CINEMATIC_COPY = Object.freeze({
  ko: Object.freeze({
    transcriptShow: "시네마틱 시각 설명문 보기",
    transcriptHide: "시네마틱 시각 설명문 닫기",
    transcriptHeading: "시네마틱 시각 설명문",
    transcriptIntro: "시네마틱은 선택 사항입니다. 아래 설명문은 영상과 소리 없이도 캠페인 브리핑을 전달합니다.",
    transcriptBrief: "캠페인 명령: 신더 스팬에서 사냥과 추출을 시작하고, 베일 시타델에서 두 거점을 장악한 뒤, 메아리 왕좌에서 군주의 영역으로 게이트 소버린에 맞섭니다.",
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
    transcriptBrief: "Campaign orders: begin with hunting and extraction at Cinder Span, hold two nodes at Veil Citadel, then face the Gate Sovereign at Echo Throne with the Lord's Domain.",
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
  briefingStage: document.querySelector("#briefing-stage"),
  briefingRegion: document.querySelector("#briefing-region"),
  briefingObjective: document.querySelector("#briefing-objective"),
  briefingOperation: document.querySelector("#briefing-operation"),
  briefingDoctrine: document.querySelector("#briefing-doctrine"),
  briefingBoss: document.querySelector("#briefing-boss"),
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
  stageButtons: [1, 2, 3].map((number) => document.querySelector(`#stage-select-${number}`)),
  bgmToggle: document.querySelector("#bgm-toggle"),
  bgmPlayer: document.querySelector("#bgm-player"),
  languageToggle: document.querySelector("#lang-toggle")
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
// Single-screen cockpit: the battlefield, intel rail, and command pad are
// always visible while a campaign runs. `battleUiActive()` (a live battle
// session exists) replaces the old activeView === "battle" checks; the
// result overlay is derived from campaign.status in render().
let visualizer = null;
let waveTimer = 0;
let wavePreparationTimer = 0;
const battleBreachTimers = new Set();
let battleSessionId = 0;
let cooldownTimer = 0;
let battleVisualFallback = false;
let battleStarting = false;
let pendingBattleRenderer = null;
let waveIndex = 0;
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

function updateResumeAffordance() {
  const resumableCampaign = storedCampaign;
  const hasResumableCampaign = Boolean(resumableCampaign);
  elements.resume.hidden = !hasResumableCampaign;
  elements.resume.classList.toggle("primary", hasResumableCampaign);
  elements.start.classList.toggle("primary", !hasResumableCampaign);
  elements.resumeSummary.hidden = !hasResumableCampaign;
  if (!hasResumableCampaign) return;

  const stage = STAGES[resumableCampaign.stageIndex];
  elements.resumeStage.textContent = `${stage.number} / ${STAGES.length} · ${stage.title}`;
  const statusKey = RESUME_STATUS_KEYS[resumableCampaign.status];
  elements.resumeStatus.textContent = translatedResumeText(statusKey, resumableCampaign.status);
}


function renderChecklist(checklist) {
  elements.checklist.replaceChildren();
  const nextPendingId = checklist.find((item) => !item.complete)?.id;
  for (const item of checklist) {
    const row = document.createElement("li");
    row.className = item.complete ? "complete" : item.id === nextPendingId ? "current" : "pending";
    row.textContent = item.label;
    row.setAttribute("aria-label", `${item.label}: ${item.complete ? "complete" : item.id === nextPendingId ? "current objective" : "pending"}`);
    elements.checklist.append(row);
  }
}

function renderRewards(stage) {
  elements.rewardOptions.replaceChildren();
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
    name.textContent = reward.name;
    const description = document.createElement("span");
    description.textContent = reward.description;
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
    elements.narratorAtlas.style.setProperty("--narrator-atlas-image", `url("${atlasSource}")`);
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
      portrait.src = bossArt;
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
  elements.waveIndicator.dataset.phase = staticFallback ? "fallback" : phase;
  elements.waveIndicator.textContent = staticFallback ? "STATIC TACTICAL BRIEFING · COMMAND SCHEDULE ACTIVE" : label;
  elements.battlePressure.textContent = staticFallback
    ? "Static tactical fallback: rendering is unavailable, but command rules remain active."
    : phase === "briefing"
      ? "Mission briefing: review the order, then commit the legion."
      : phase === "preparation"
        ? "Preparation window: issue commands before the first hostile wave enters the lane."
        : "Live-wave pressure: keep the command pad active while hostiles cross the lane.";
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
    elements.battleOperation.textContent = presentation.operation;
    elements.battleDoctrine.textContent = presentation.doctrine;
    elements.battleAllyLabel.textContent = presentation.allyLabel;
    elements.battleHostileLabel.textContent = presentation.hostileLabel;
    elements.battleFallbackOperation.textContent = presentation.operation;
    elements.battleFallbackDoctrine.textContent = presentation.doctrine;
    elements.battleFallbackAllyLabel.textContent = presentation.allyLabel;
    elements.battleFallbackHostileLabel.textContent = presentation.hostileLabel;
  }

  const showFallback = battleVisualFallback && !elements.screen.hidden;
  elements.battleCanvas3d.hidden = showFallback;
  elements.battleFallbackCanvas.hidden = !showFallback;
  elements.battleFallback.hidden = !showFallback;
  elements.battleBrief.dataset.presentation = stage.id;
  return presentation;
}

function setMissionBriefingModal(active) {
  elements.briefing.hidden = !active;
  for (const child of elements.screen.children) {
    if (child !== elements.briefing) child.inert = active;
  }
}

function renderMissionBriefing(stage) {
  setMissionBriefingModal(stageBriefingOpen);
  if (!stageBriefingOpen) return;
  const presentation = getBattlePresentation(stage.id);
  elements.briefingStage.textContent = `Stage ${stage.number} · ${stage.title}`;
  elements.briefingRegion.textContent = stage.region;
  elements.briefingObjective.textContent = stage.objective;
  elements.briefingOperation.textContent = presentation.operation;
  elements.briefingDoctrine.textContent = presentation.doctrine;
  elements.briefingBoss.textContent = stage.bossName;
}

function stopBattle() {
  battleSessionId += 1;
  window.clearInterval(waveTimer);
  window.clearTimeout(wavePreparationTimer);
  for (const timer of battleBreachTimers) window.clearTimeout(timer);
  battleBreachTimers.clear();
  window.clearInterval(cooldownTimer);
  waveTimer = 0;
  wavePreparationTimer = 0;
  cooldownTimer = 0;
  battleVisualFallback = false;
  cooldowns.clear();
  pendingBattleRenderer?.destroy();
  pendingBattleRenderer = null;
  battleStarting = false;
  visualizer?.destroy();
  visualizer = null;
}

function battleSimulated() {
  // No live unit sim = breaches can't come from the canvas. Timer schedule
  // (defense-blind, so deliberately forgiving) covers these two paths.
  return battleVisualFallback || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scheduleBattleBreaches(enemyCount, sessionId) {
  const breaches = Math.ceil(enemyCount * SIMULATED_BREACH_RATIO);
  for (let enemyIndex = 0; enemyIndex < breaches; enemyIndex += 1) {
    const timer = window.setTimeout(() => {
      battleBreachTimers.delete(timer);
      if (campaign?.status !== "active" || sessionId !== battleSessionId) return;
      void handleBattleBreach();
    }, BATTLE_BREACH_DELAY_MS);
    battleBreachTimers.add(timer);
  }
}

function spawnBattleWave(sessionId = battleSessionId) {
  if (campaign?.status !== "active" || sessionId !== battleSessionId) return;
  const stage = currentStage();
  const waveNames = ["SCOUT", "GUARD", "BOSS REINFORCEMENT"];
  // Sized against the defense economy: one hunt->extract->materialize loop
  // fields ~4 shades (8 swings) per ~11s. Stage 1 cycle = 2+3+4 hostiles
  // (13 swings incl. 2HP reinforcements) - holdable with sustained play,
  // lethal if the economy stalls.
  const enemyCounts = [2, 2 + stage.number, 3 + stage.number];
  const enemyCount = enemyCounts[waveIndex];
  setBattlePressure("live", `LIVE WAVE · ${waveIndex + 1}/3 · ${waveNames[waveIndex]}`);
  visualizer?.spawnEnemy(enemyCount);
  if (battleSimulated()) scheduleBattleBreaches(enemyCount, sessionId);
  const lastWaveOfCycle = waveIndex === waveNames.length - 1;
  waveIndex = (waveIndex + 1) % waveNames.length;
  // Cycle rhythm: waves 8s apart, then a lull - the window where the
  // hunt -> extract -> materialize economy loop actually gets played.
  if (lastWaveOfCycle) {
    const lullLabel = window.setTimeout(() => {
      battleBreachTimers.delete(lullLabel);
      if (campaign?.status !== "active" || sessionId !== battleSessionId) return;
      setBattlePressure("preparation", "LULL · REINFORCE THE PICKET LINE");
    }, WAVE_GAP_MS);
    battleBreachTimers.add(lullLabel);
  }
  waveTimer = window.setTimeout(() => spawnBattleWave(sessionId), lastWaveOfCycle ? WAVE_LULL_MS : WAVE_GAP_MS);
}

function activateBattleFallback(stage) {
  battleVisualFallback = true;
  renderBattleAssetStatus({ state: "unavailable" });
  renderBattlePresentation(stage);
  const fallback = new BattleVisualizer(elements.battleFallbackCanvas, getBattlePresentation(stage.id), {
    nodeGoal: stage.nodeGoal,
    onAssetStatus: renderBattleAssetStatus,
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
  const sessionId = ++battleSessionId;
  waveIndex = 0;
  battleVisualFallback = false;
  let battleRenderer = null;
  const stage = currentStage();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    visualizer = activateBattleFallback(stage);
    battleStarting = false;
  } else {
    try {
      const presentation = renderBattlePresentation(stage);
      battleRenderer = new RealtimeBattle(elements.battleCanvas3d, presentation, {
        nodeGoal: stage.nodeGoal,
        onAssetStatus: renderBattleAssetStatus,
        onActionRequest: (action) => void handleAction(action),
        onRendererFailure: () => {
          if (visualizer !== battleRenderer || sessionId !== battleSessionId || campaign?.status !== "active") return;
          visualizer = activateBattleFallback(currentStage());
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
      battleRenderer.onEnemyBreach = () => {
        if (visualizer !== battleRenderer || sessionId !== battleSessionId || campaign?.status !== "active") return;
        void handleBattleBreach();
      };
    } catch {
      battleRenderer?.destroy();
      if (sessionId !== battleSessionId || campaign?.status !== "active") return;
      visualizer = activateBattleFallback(currentStage());
    } finally {
      if (pendingBattleRenderer === battleRenderer) pendingBattleRenderer = null;
      if (!pendingBattleRenderer) battleStarting = false;
    }
  }
  if (sessionId !== battleSessionId || campaign?.status !== "active") return;
  setBattlePressure(
    battleVisualFallback ? "fallback" : "preparation",
    battleVisualFallback
      ? "Static tactical fallback: rendering is unavailable, but command rules remain active."
      : "PREPARATION · WAVE 1/3 · SCOUT INBOUND"
  );
  wavePreparationTimer = window.setTimeout(() => {
    if (campaign?.status !== "active" || sessionId !== battleSessionId) return;
    wavePreparationTimer = 0;
    spawnBattleWave(sessionId);
  }, BATTLE_PREPARATION_MS);
  cooldownTimer = window.setInterval(render, 100);
}


function battleUiActive() {
  return cooldownTimer !== 0;
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
  if (overlayShould !== resultOverlayOpen) {
    resultOverlayOpen = overlayShould;
    elements.resultOverlay.hidden = !overlayShould;
    if (overlayShould) {
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
  }
  if (campaign.status === "active" && !stageBriefingOpen && !visualizer && !cooldownTimer) startBattle();
}

function renderBossSpec(stage, state, benefits) {
  const spec = BOSS_SPEC[stage.number - 1];
  elements.bossSpecPortrait.src = BOSS_BY_STAGE[stage.id];
  elements.bossSpecPortrait.alt = `${stage.bossName} portrait`;
  elements.bossSpecName.textContent = stage.bossName;
  elements.bossSpecLore.textContent = spec.lore;
  elements.bossSpecThreat.textContent = spec.threat;
  elements.bossSpecHp.textContent = `${state.bossHealth} / ${stage.bossHealth} HP`;
  elements.bossSpecCounter.textContent = String(spec.counter);
  elements.bossSpecNodes.textContent = `${stage.nodeGoal} Node${stage.nodeGoal === 1 ? "" : "s"}`;
  elements.statMaxIntegrity.textContent = String(benefits.maxIntegrity);
  elements.statCooldownReduction.textContent = `${Math.round(benefits.cooldownReduction * 100)}%`;
  const combatModifiers = [
    benefits.extraAssaultDamage > 0 ? `Assault +${benefits.extraAssaultDamage}` : null,
    benefits.lensDamage > 0 ? `Possession +${benefits.lensDamage}` : null,
    benefits.counterReduction > 0 ? `Counter −${benefits.counterReduction}` : null
  ].filter(Boolean);
  elements.statExtraDamage.textContent = combatModifiers.join(" · ") || "None";
  elements.statActiveItems.textContent = benefits.activeItemNames.length ? benefits.activeItemNames.join(", ") : "None";
}

function renderResult(isComplete) {
  const isDefeat = campaign.status === "defeat";
  const awaitingReward = campaign.status === "reward";
  elements.resultTitle.textContent = isDefeat ? "Anchor Lost" : isComplete ? "Campaign Complete" : "Ward Broken";
  elements.resultText.textContent = isDefeat ? "DEFEAT" : "VICTORY";
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



function render() {
  if (!campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const available = new Set(getAvailableActions(campaign));
  const isComplete = campaign.status === "campaign-complete";
  renderBattlePresentation(stage);
  renderMissionBriefing(stage);

  elements.stageNumber.textContent = `Stage ${stage.number} of ${STAGES.length}`;
  elements.stageHeading.textContent = stage.title;
  elements.stageRegion.textContent = stage.region;
  elements.stageObjective.textContent = stage.objective;
  elements.status.textContent = entryGuidanceStageId === stage.id && campaign.status === "active" && state.hunted === 0
    ? "First order: Hunt two rift spoor."
    : battleVisualFallback && battleUiActive()
      ? "Battle visualization is unavailable; command rules remain ready."
      : campaign.lastMessage;
  elements.souls.textContent = String(state.souls);
  elements.legion.textContent = `${state.legion} / ${state.capacity}`;
  elements.nodes.textContent = `${state.nodes} / ${stage.nodeGoal}`;
  elements.integrity.textContent = `${state.integrity} / ${benefits.maxIntegrity}`;
  elements.bossLabel.textContent = `${stage.bossName} ward`;
  elements.boss.textContent = `${state.bossHealth} / ${stage.bossHealth}`;
  elements.retry.disabled = campaign.status === "reward" || isComplete;
  elements.complete.hidden = !isComplete;
  elements.completionSummary.textContent = isComplete ? campaign.lastMessage : "";
  renderBossSpec(stage, state, benefits);
  renderResult(isComplete);
  syncCockpit();

  // Mirror engine numbers onto the battle canvas HUD - the battlefield must
  // be readable without glancing at the side panel.
  visualizer?.setHud?.({
    integrity: state.integrity,
    maxIntegrity: benefits.maxIntegrity,
    bossHealth: state.bossHealth,
    bossMax: stage.bossHealth,
    aegis: state.aegis ?? 0
  });

  const canRedeploy =
    campaign.status === "active" &&
    !!visualizer &&
    state.legion > 0 &&
    visualizer.allies.length < state.legion;
  for (const button of elements.commandButtons) {
    const action = button.dataset.action;
    const usable = available.has(action) || (action === "materialize" && canRedeploy);
    renderCooldown(button, action, usable);
  }
  for (const [index, button] of elements.stageButtons.entries()) {
    const stageNumber = index + 1;
    const active = stageNumber === stage.number && !isComplete;
    const cleared = stageNumber < stage.number || isComplete;
    button.disabled = true;
    button.classList.toggle("active", active);
    button.classList.toggle("cleared", cleared);
    button.classList.toggle("locked", !active && !cleared);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.setAttribute("aria-label", `${STAGES[index].title}: ${active ? "current stage" : cleared ? "cleared" : "locked"}`);
  }

  renderChecklist(getStageChecklist(campaign));
  if (campaign.status === "reward") renderRewards(stage);
  renderStageMedia(stage);
  syncNarration();
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
  if (resumableCampaign.status === "briefing") await persistCampaign("Imported briefing started");
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

async function typeNarration(entry, run) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const line of entry.lines) {
    if (run !== narrationRun) return;
    elements.narrationLine.textContent = "";
    elements.narrationLine.classList.toggle("is-typing", !reduceMotion);
    if (reduceMotion) {
      elements.narrationLine.textContent = line;
    } else {
      for (let index = 1; index <= line.length; index += 1) {
        if (run !== narrationRun) return;
        elements.narrationLine.textContent = line.slice(0, index);
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
  narrationPlayer.src = entry.audio;
  narrationPlayer.play().catch(() => undefined);
  return true;
}

function openCurrentStageBriefing(narrationKey = currentStage().id) {
  if (!campaign || campaign.status !== "active") return;
  stageBriefingOpen = true;
  narratedOutcome = null;
  narratedStageId = currentStage().id;
  playNarration(narrationKey);
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

async function persistCampaign(context = "Campaign saved") {
  if (!campaign) return;
  const envelope = createSaveEnvelope(campaign);
  storedCampaign = campaign;
  updateResumeAffordance();
  const savedTo = await storage.save(envelope);
  campaignMirror?.publish(envelope);
  setSaveStatus(`${context} in ${savedTo}.`);
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
    setSaveStatus("다른 탭의 로컬 캠페인을 반영했습니다.");
  } catch {
    // The mirror validates structure; replay validation keeps incompatible saves local.
  }
}

function triggerBattleVisual(action) {
  if (!visualizer || !campaign) return;
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const semantic = BATTLE_ACTION_SEMANTICS[action];
  if (!semantic) return;
  visualizer.triggerAction({
    ...semantic,
    action,
    count: action === "materialize" ? Math.max(1, 2 + benefits.summonBonus) : undefined,
    nodes: action === "capture" ? state.nodes : undefined,
    nodeGoal: action === "capture" ? currentStage().nodeGoal : undefined,
  });
}

function startActionCooldown(action) {
  const benefits = getCampaignBenefits(campaign);
  const duration = COOLDOWN_SECONDS[action] * (1 - benefits.cooldownReduction);
  cooldowns.set(action, performance.now() + duration * 1000);
}

async function handleAction(action) {
  if (!campaign || !battleUiActive() || resultOverlayOpen || remainingCooldown(action) > 0) return;
  if (!getAvailableActions(campaign).includes(action)) {
    // Presentation-only redeploy: the engine refuses materialize at full
    // legion capacity, but the VISUAL field may have lost its shades to
    // melee. Reserves stepping back onto the field is pure presentation -
    // no engine transition, no save event, replay unaffected.
    if (
      action === "materialize" &&
      visualizer &&
      campaign.status === "active" &&
      campaign.stage.legion > 0 &&
      visualizer.allies.length < campaign.stage.legion
    ) {
      const benefits = getCampaignBenefits(campaign);
      const count = Math.min(
        Math.max(1, 2 + benefits.summonBonus),
        campaign.stage.legion - visualizer.allies.length
      );
      visualizer.triggerMaterialize(count);
      startActionCooldown(action);
      flashEffect("materialize");
      playCue("materialize");
      render();
    }
    return;
  }
  const result = applyAction(campaign, action);
  campaign = result.state;
  if (!result.accepted) {
    render();
    return;
  }
  startActionCooldown(action);
  triggerBattleVisual(action);
  flashEffect(result.effect);
  playCue(result.effect);
  render();
  await persistCampaign("Campaign saved");
}

async function handleBattleBreach() {
  if (!campaign || !battleUiActive()) return;
  const result = applyBattleBreach(campaign);
  campaign = result.state;
  if (!result.accepted) return;
  flashEffect("assault");
  await persistCampaign("Battle breach saved");
  render();
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
  await persistCampaign("Reward and campaign saved");
  if (campaign.status === "campaign-complete") {
    render();
    document.querySelector("#completion-heading")?.focus();
    return;
  }
  render();
  window.requestAnimationFrame(() => elements.stageHeading.focus());
}

async function beginNewCampaign() {
  if (campaign && campaign.trace.length > 0 && !window.confirm("Start a new campaign? Your current local run will be replaced.")) return;
  stopBattle();
  entryGuidanceStageId = null;
  const result = startCampaign(createCampaign());
  campaign = result.state;
  storedCampaign = campaign;
  updateResumeAffordance();
  openCurrentStageBriefing("intro");
  revealCampaign();
  flashEffect("awaken");
  await persistCampaign("New campaign saved");
}

async function returnToLobby() {
  if (!campaign) return;
  stopBattle();
  stageBriefingOpen = false;
  entryGuidanceStageId = null;
  storedCampaign = campaign;
  resultOverlayOpen = false;
  elements.resultOverlay.hidden = true;
  setMissionBriefingModal(false);
  await persistCampaign("Campaign returned to command lobby");
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
  await persistCampaign("Stage retry saved");
  // Engine is back to "active": render() closes the overlay and restarts
  // the battle session on the same cockpit screen.
  render();
  window.requestAnimationFrame(() => elements.stageHeading.focus());
}

function beginStageCombat() {
  if (!campaign || campaign.status !== "active" || !stageBriefingOpen) return;
  stageBriefingOpen = false;
  entryGuidanceStageId = currentStage().id;
  render();
  window.requestAnimationFrame(() => elements.commandButtons[0]?.focus());
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
  setSaveStatus("Versioned campaign save exported.");
}

async function importSave(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSaveStatus("Import rejected: save exceeds the 256 KiB limit.");
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
    await persistCampaign("Imported campaign saved");
    flashEffect("reward");
  } catch (error) {
    setSaveStatus(`Import rejected: ${error instanceof Error ? error.message : "invalid save file"}`);
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
  }));
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target === elements.battleCanvas3d) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    const action = ACTION_KEYS[event.key.toLowerCase()];
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
      setSaveStatus(`A compatible campaign is available from ${loaded.source}.`);
    } catch {
      setSaveStatus("A local save was found but is incompatible. Start a new campaign or import a valid save.");
    }
  } else {
    setSaveStatus(storage.mode === "indexeddb" ? "No local campaign yet. IndexedDB is ready." : "IndexedDB is unavailable; this session will use the safe local fallback.");
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
