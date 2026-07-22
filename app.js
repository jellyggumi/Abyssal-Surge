import {
  STAGES,
  applyCampaignRunResult,
  captureElite,
  createCampaign,
  setCompanionLoadout,
  startRun,
} from "./campaign-state.js";
import { DefenseStorage } from "./defense-storage.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "./defense-run-simulation.js";
import { RealtimeBattle } from "./battle-realtime-three.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { ARENA, COMPANIONS, REWARDS, SKILLS, TICK_RATE } from "./defense-catalog.js";
import { DefenseAudio } from "./defense-audio.js";
import { DefenseViewport } from "./defense-viewport.js";

const root = document.querySelector("#defense-app");
const storage = new DefenseStorage();
const viewport = new DefenseViewport();
const STEP_MS = 1000 / TICK_RATE;
const MOVEMENT_DEAD_ZONE = 120;
const MOVEMENT_MAX_RADIUS = 640;
const DIRECTION_BY_VECTOR = Object.freeze({
  "0,-1": "N", "1,-1": "NE", "1,0": "E", "1,1": "SE",
  "0,1": "S", "-1,1": "SW", "-1,0": "W", "-1,-1": "NW", "0,0": "IDLE",
});
const KEY_DIRECTIONS = Object.freeze({
  w: "N", arrowup: "N", d: "E", arrowright: "E",
  s: "S", arrowdown: "S", a: "W", arrowleft: "W",
});

let campaign = null;
let selectedStageId = STAGES[0].id;
let statusText = "기록을 불러오는 중입니다.";
let campaignWrite = Promise.resolve();
let session = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function selectedLoadout() {
  return Array.isArray(campaign?.companionLoadout?.prototypeIds)
    ? campaign.companionLoadout.prototypeIds
    : [];
}

function stageFor(stageId) {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0];
}

function stageLabel(stage) {
  return `${stage.sequence}. ${stage.name} · ${stage.bossName}`;
}

function companionLabel(prototype) {
  return COMPANIONS[prototype]?.name ?? prototype;
}

function stableRunSeed(stageId) {
  const attempt = campaign.attemptsByStage[stageId] ?? 0;
  const source = `${campaign.campaignId}:${campaign.resetEpoch}:${stageId}:${attempt}`;
  let hash = 0x811c9dc5;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

async function persistCampaign(message = "기록을 저장했습니다.") {
  statusText = message;
  const write = campaignWrite.then(() => storage.save(campaign));
  campaignWrite = write.catch(() => {});
  try {
    await write;
  } catch {
    statusText = "저장소에 기록하지 못했습니다. 현재 세션은 계속됩니다.";
  }
}

function renderLobby() {
  if (!campaign) return;
  const selected = stageFor(selectedStageId);
  const loadout = selectedLoadout();
  const collection = campaign.companionCollection;
  document.body.classList.remove("defense-playing");
  document.body.style.overflow = "";
  root.className = "defense-lobby";
  root.innerHTML = `
    <header class="lobby-hero">
      <p class="eyebrow">ABYSSAL COMMAND · DEFENSE SURVIVOR</p>
      <h1>심연 방어선</h1>
      <p>관문을 지키며 성장 빌드를 완성하고, 쓰러진 정예의 잔향을 영구 동료로 추출하십시오.</p>
      <div class="story-strip" aria-label="심연 방어선 이야기">
        <span>각성</span><span>방어</span><span>성장</span><span>추출</span><span>종결</span>
      </div>
    </header>
    <section aria-labelledby="stage-title">
      <h2 id="stage-title">출전 구역</h2>
      <div class="defense-grid stage-grid">
        ${STAGES.map((stage, index) => `
          <button class="stage-card" data-stage="${stage.id}" aria-pressed="${stage.id === selectedStageId}" ${index > campaign.unlockedStageIndex ? "disabled" : ""}>
            <strong>${escapeHtml(stageLabel(stage))}</strong>
            <span>${index > campaign.unlockedStageIndex ? "잠김" : stage.id === selected.id ? "선택됨" : "출전 가능"}</span>
          </button>`).join("")}
      </div>
    </section>
    <section aria-labelledby="companion-title">
      <h2 id="companion-title">동료 편성 · ${loadout.length}/3</h2>
      <p class="section-copy">동료는 정예를 쓰러뜨린 뒤 추출하면 영구 기록됩니다. 전투 중에는 편성을 바꿀 수 없습니다.</p>
      <div class="defense-grid companion-grid">
        ${collection.length ? collection.map((record) => `
          <button class="companion-card" data-companion="${record.prototype}" aria-pressed="${loadout.includes(record.prototype)}">
            <strong>${escapeHtml(companionLabel(record.prototype))}</strong>
            <span>진화 ${record.evolution} · 추출 ${record.capturedEliteIds.length}</span>
          </button>`).join("") : "<p>정예 후보를 처치하고 추출하면 동료가 이곳에 기록됩니다.</p>"}
      </div>
    </section>
    <section aria-labelledby="reward-title">
      <h2 id="reward-title">영구 보상 · ${campaign.rewardIds?.length ?? 0}</h2>
      <div class="defense-grid reward-grid">
        ${(campaign.rewardIds?.length ?? 0) ? campaign.rewardIds.map((id) => `<article class="reward-card"><strong>${escapeHtml(REWARDS[id]?.name ?? id)}</strong><span>${escapeHtml(REWARDS[id]?.description ?? "기록된 보상")}</span></article>`).join("") : "<p>보스 승리 후 한 가지 보상을 기록합니다.</p>"}
      </div>
      <p class="section-copy">업적 ${campaign.achievementIds?.length ?? 0}개 · 추출 동료 ${collection.length}명 · 기록은 오프라인 저장됩니다.</p>
    </section>
    <section class="storage-row" aria-label="캠페인 제어">
      <button id="start-defense" class="primary-action">${escapeHtml(stageLabel(selected))} 출전</button>
      <button id="export-defense">기록 내보내기</button>
      <label class="import-label">기록 가져오기<input id="import-defense" type="file" accept="application/json,text/plain" /></label>
      <button id="reset-defense">새 기록</button>
      <output aria-live="polite">${escapeHtml(statusText)} · 저장소: ${escapeHtml(storage.backend ?? "확인 중")}</output>
    </section>`;

  root.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedStageId = button.dataset.stage;
      renderLobby();
    });
  });
  root.querySelectorAll("[data-companion]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prototype = button.dataset.companion;
      const current = selectedLoadout();
      const next = current.includes(prototype)
        ? current.filter((entry) => entry !== prototype)
        : [...current, prototype].slice(0, 3);
      campaign = setCompanionLoadout(campaign, next);
      await persistCampaign("동료 편성을 저장했습니다.");
      renderLobby();
    });
  });
  root.querySelector("#start-defense").addEventListener("click", () => beginSession(selectedStageId));
  root.querySelector("#export-defense").addEventListener("click", async () => {
    const text = await storage.exportText();
    if (!text) {
      statusText = "내보낼 유효한 기록이 없습니다.";
      renderLobby();
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "abyssal-defense-record.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  root.querySelector("#import-defense").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const text = file ? await file.text() : "";
    if (!text || !(await storage.importText(text))) {
      statusText = "기록 형식을 확인할 수 없습니다.";
      renderLobby();
      return;
    }
    campaign = (await storage.load()) ?? campaign;
    selectedStageId = STAGES[campaign.unlockedStageIndex].id;
    statusText = "기록을 가져왔습니다.";
    renderLobby();
  });
  root.querySelector("#reset-defense").addEventListener("click", async () => {
    await storage.clear();
    campaign = createCampaign({ resetEpoch: campaign.resetEpoch + 1 });
    selectedStageId = STAGES[0].id;
    await persistCampaign("새 기록을 시작했습니다.");
    renderLobby();
  });
}

function requestBattleImmersion() {
  const fullscreen = document.documentElement.requestFullscreen?.().catch(() => undefined);
  Promise.resolve(fullscreen).finally(() => {
    globalThis.screen?.orientation?.lock?.("landscape").catch(() => undefined);
  });
}

function beginSession(stageId) {
  session?.stop({ renderLobby: false });
  requestBattleImmersion();
  campaign = startRun(campaign, stageId);
  void persistCampaign("출전 기록을 저장했습니다.");
  document.body.classList.add("defense-playing");
  document.body.style.overflow = "hidden";
  root.className = "";
  root.innerHTML = `
    <section id="defense-battle-surface" data-defense-ready="true" data-defense-input-seq="0" data-defense-skill="" data-defense-move="IDLE" data-defense-state="active" aria-label="심연 방어 전장">
      <canvas id="defense-canvas" aria-label="방어 전장"></canvas>
      <div id="defense-edge-hud">
        <div class="defense-edge defense-top">
          <div class="hud-panel"><strong id="battle-stage"></strong><span id="battle-status" aria-live="polite"></span></div>
          <div class="hud-actions" id="skill-actions" aria-label="활성 스킬"></div>
        </div>
        <div class="defense-edge defense-bottom">
          <div class="hud-panel"><strong id="battle-integrity"></strong><span id="battle-enemies"></span></div>
          <div class="hud-actions" id="battle-actions" aria-label="전투 행동"></div>
        </div>
      </div>
    </section>`;
  session = new BattleSession(stageId);
  session.start();
}

export class BattleSession {
  constructor(stageId) {
    this.stageId = stageId;
    this.surface = root.querySelector("#defense-battle-surface");
    this.canvas = root.querySelector("#defense-canvas");
    this.statusNode = root.querySelector("#battle-status");
    this.run = createDefenseRun({
      stageId,
      seed: stableRunSeed(stageId),
      companionLoadout: selectedLoadout(),
      rewardIds: campaign.rewardIds ?? [],
    });
    this.renderer = null;
    this.audio = new DefenseAudio();
    this.audioTick = null;
    this.audioEventKeys = new Set();
    this.frame = 0;
    this.lastFrameAt = 0;
    this.accumulator = 0;
    this.inputSeq = 0;
    this.pointer = null;
    this.heldKeys = new Set();
    this.listenerCount = 0;
    this.recordedEliteIds = new Set();
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.userPaused = false;
    this.stopped = false;
    this.focusBeforeGrowth = null;
    this.onResize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    viewport.start();
    this.audio.start();
    this.resize();
    try {
      this.renderer = new RealtimeBattle().mount({ canvas: this.canvas, viewport: this.canvas });
    } catch {
      this.renderer = new BattleVisualizer().mount({ canvas: this.canvas, viewport: this.canvas });
    }
    this.listen(this.canvas, "pointerdown", this.onPointerDown);
    this.listen(this.canvas, "pointermove", this.onPointerMove);
    this.listen(this.canvas, "pointerup", this.onPointerEnd);
    this.listen(this.canvas, "pointercancel", this.onPointerEnd);
    this.listen(this.canvas, "lostpointercapture", this.onPointerEnd);
    this.listen(window, "blur", this.onWindowBlur);
    this.listen(document, "visibilitychange", this.onVisibility);
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    this.listen(window, "resize", this.onResize);
    this.listen(window, "abyssal:defense-viewportchange", this.onResize);
    this.render();
    this.frame = requestAnimationFrame(this.loop);
  }

  listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.listenerCount += 1;
  }

  unlisten(target, type, handler) {
    target.removeEventListener(type, handler);
    this.listenerCount = Math.max(0, this.listenerCount - 1);
  }

  resize() {
    const style = getComputedStyle(document.documentElement);
    const logicalWidth = parseFloat(style.getPropertyValue("--defense-logical-width"));
    const logicalHeight = parseFloat(style.getPropertyValue("--defense-logical-height"));
    const rect = this.canvas.getBoundingClientRect();
    const width = logicalWidth || rect.width;
    const height = logicalHeight || rect.height;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
  }

  logicalPoint(event) {
    return viewport.mapPhysicalToLogical({ clientX: event.clientX, clientY: event.clientY });
  }

  centralRegionContains(point) {
    const width = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--defense-logical-width")) || innerWidth;
    const height = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--defense-logical-height")) || innerHeight;
    return point.x >= width * 0.08 && point.x <= width * 0.92 && point.y >= height * 0.14 && point.y <= height * 0.86;
  }

  onPointerDown(event) {
    const point = this.logicalPoint(event);
    if (!event.isPrimary || this.pointer || !this.centralRegionContains(point)) return;
    event.preventDefault();
    this.pointer = { id: event.pointerId, origin: point };
    this.canvas.setPointerCapture?.(event.pointerId);
    this.updatePointer(event);
  }

  onPointerMove(event) {
    if (event.pointerId === this.pointer?.id) this.updatePointer(event);
  }

  updatePointer(event) {
    const point = this.logicalPoint(event);
    let dx = point.x - this.pointer.origin.x;
    let dy = point.y - this.pointer.origin.y;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude < MOVEMENT_DEAD_ZONE) {
      this.send("MOVE", "IDLE");
      return;
    }
    if (magnitude > MOVEMENT_MAX_RADIUS) {
      dx = dx / magnitude * MOVEMENT_MAX_RADIUS;
      dy = dy / magnitude * MOVEMENT_MAX_RADIUS;
    }
    const octants = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4) + 8) % 8;
    this.send("MOVE", octants[index]);
  }

  onPointerEnd(event) {
    if (event.pointerId !== this.pointer?.id) return;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.pointer = null;
    this.send("MOVE", "IDLE");
  }

  onWindowBlur() {
    this.heldKeys.clear();
    this.pointer = null;
    this.send("MOVE", "IDLE");
  }

  onVisibility() {
    if (!document.hidden) return;
    this.accumulator = 0;
    this.lastFrameAt = 0;
    this.onWindowBlur();
  }

  onKey(event) {
    const key = event.key.toLowerCase();
    if (!KEY_DIRECTIONS[key]) return;
    event.preventDefault();
    if (event.type === "keydown") this.heldKeys.add(key);
    else this.heldKeys.delete(key);
    const directions = [...this.heldKeys].map((entry) => KEY_DIRECTIONS[entry]);
    const vertical = directions.includes("N") ? -1 : directions.includes("S") ? 1 : 0;
    const horizontal = directions.includes("W") ? -1 : directions.includes("E") ? 1 : 0;
    this.send("MOVE", DIRECTION_BY_VECTOR[`${horizontal},${vertical}`]);
  }

  send(type, payload) {
    if (this.stopped || (isTerminalRun(this.run) && type !== "REWARD_SELECTED")) return;
    this.run = queueInput(this.run, type, payload);
    const inputSeq = ++this.inputSeq;
    this.surface.dataset.defenseInputSeq = String(inputSeq);
    if (type === "MOVE") this.surface.dataset.defenseMove = payload;
    if (type === "SKILL_CAST" || type === "SKILL_SELECTED" || type === "REWARD_SELECTED") {
      this.surface.dataset.defenseSkill = payload?.skillId ?? payload?.rewardId ?? payload ?? "";
    }
    const admittedAt = performance.now();
    window.dispatchEvent(new CustomEvent("abyssal:defense-input-feedback", {
      detail: { inputSeq, type, admittedAt, displayedAt: admittedAt, tick: this.run.tick },
    }));
    this.renderer?.onVisualFeedback?.(inputSeq);
  }

  loop(frameNow) {
    if (this.stopped) return;
    if (!this.lastFrameAt) this.lastFrameAt = frameNow;
    const elapsed = Math.min(100, frameNow - this.lastFrameAt);
    this.lastFrameAt = frameNow;
    if (!document.hidden && !this.userPaused && !isTerminalRun(this.run)) {
      this.accumulator += elapsed;
      while (this.accumulator >= STEP_MS) {
        this.run = advanceDefenseRun(this.run, 1);
        this.accumulator -= STEP_MS;
      }
    } else {
      this.accumulator = 0;
    }
    this.render();
    this.frame = requestAnimationFrame(this.loop);
  }

  projected(snapshot) {
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const presentationRadius = (actor) => {
      if (actor.id === "gate") return 30;
      if (actor.id === "commander") return 11;
      if (actor.class === "boss") return 25;
      if (actor.elite) return 14;
      if (actor.kind === "companion") return 9;
      if (actor.kind === "projectile") return 3;
      if (actor.kind === "pickup") return 5;
      return 8;
    };
    const project = (actor) => ({
      ...actor,
      x: actor.x / ARENA.width * 2 - 1,
      y: actor.y / ARENA.height * 2 - 1,
      radius: presentationRadius(actor) * pixelRatio,
      normalized: true,
    });
    return {
      ...snapshot,
      gate: project(snapshot.gate),
      commander: project(snapshot.commander),
      enemies: snapshot.enemies.map(project),
      projectiles: snapshot.projectiles.map(project),
      pickups: snapshot.pickups.map(project),
      companions: snapshot.companions.map(project),
    };
  }

  recordExtraction(snapshot) {
    for (const event of snapshot.events) {
      const eliteId = event.eliteId ?? event.enemyId;
      if (event.type !== "ELITE_EXTRACTED" || !eliteId || this.recordedEliteIds.has(eliteId)) continue;
      this.recordedEliteIds.add(eliteId);
      campaign = captureElite(campaign, eliteId, event.prototype);
      void persistCampaign(`${companionLabel(event.prototype)} 동료를 기록했습니다.`);
    }
  }

  render() {
    const snapshot = getRunSnapshot(this.run);
    if (this.audioTick !== snapshot.tick) {
      this.audioTick = snapshot.tick;
      this.audioEventKeys.clear();
    }
    const newAudioEvents = snapshot.events.filter((event) => {
      const key = `${event.type}:${event.enemyId ?? event.itemId ?? event.rewardId ?? ""}`;
      if (this.audioEventKeys.has(key)) return false;
      this.audioEventKeys.add(key);
      return true;
    });
    this.audio.consume(newAudioEvents);
    this.recordExtraction(snapshot);
    const projection = this.projected(snapshot);
    try {
      this.renderer?.renderSnapshot(projection, { viewport: this.canvas });
    } catch {
      this.renderer?.dispose?.();
      this.renderer = new BattleVisualizer().mount({ canvas: this.canvas, viewport: this.canvas });
      this.renderer.renderSnapshot(projection, { viewport: this.canvas });
    }
    const stage = stageFor(this.stageId);
    root.querySelector("#battle-stage").textContent = `${stage.sequence}. ${stage.name}`;
    this.statusNode.textContent = this.userPaused
      ? "사용자 일시 정지"
      : snapshot.growthOffer
        ? "성장 선택 중 · 전투 정지"
        : snapshot.rewardOffer
          ? "보상 선택 중 · 기록 대기"
          : snapshot.terminal
            ? "전투 종료"
            : `시간 ${Math.floor(snapshot.tick / TICK_RATE)}초 · Lv.${snapshot.commander.level}`;
    root.querySelector("#battle-integrity").textContent = `관문 내구 ${snapshot.gate.integrity}/${snapshot.gate.maxIntegrity}`;
    root.querySelector("#battle-enemies").textContent = `적 ${snapshot.enemies.length} · 처치 ${snapshot.progress.defeated} · 아이템 ${snapshot.progress.itemsCollected}`;
    this.renderControls(snapshot);
    if (snapshot.terminal && !this.terminalHandled) void this.resolveTerminal(snapshot);
  }

  renderControls(snapshot) {
    const skills = root.querySelector("#skill-actions");
    const activeSkills = snapshot.commander.skills.filter((id) => SKILLS[id]?.kind === "active");
    const markup = activeSkills.map((id) => `
      <button data-cast="${id}" data-defense-skill="${id}" ${snapshot.commander.cooldowns[id] ? "disabled" : ""}>${escapeHtml(id)}</button>`).join("");
    if (skills.dataset.skills !== markup) {
      skills.dataset.skills = markup;
      skills.innerHTML = markup;
      skills.querySelectorAll("[data-cast]").forEach((button) => {
        button.addEventListener("click", () => this.send("SKILL_CAST", { skillId: button.dataset.cast }));
      });
    }

    let card = root.querySelector(".edge-card:not(.defense-result)");
    if (snapshot.growthOffer) {
      const offerKey = snapshot.growthOffer.choices.join(",");
      if (!card) {
        card = document.createElement("section");
        card.className = "edge-card";
        card.id = "defense-growth-offer";
        root.querySelector("#defense-edge-hud").append(card);
        this.focusBeforeGrowth = document.activeElement;
      }
      if (card.dataset.offer !== offerKey) {
        card.dataset.offer = offerKey;
        card.innerHTML = `<h2>성장 선택 · 전투 일시 정지</h2><div class="choices">${snapshot.growthOffer.choices.map((id) => `<button data-pick="${id}">${escapeHtml(id)}</button>`).join("")}</div>`;
        card.querySelectorAll("[data-pick]").forEach((button) => {
          button.addEventListener("click", () => {
            this.send("SKILL_SELECTED", { skillId: button.dataset.pick });
            card.remove();
            this.focusBeforeGrowth?.focus?.();
          });
        });
        card.querySelector("button")?.focus();
      }
    } else if (card) {
      card.remove();
    }

    const actions = root.querySelector("#battle-actions");
    const candidate = snapshot.eliteCandidate;
    const actionMarkup = `<button id="toggle-pause" aria-pressed="${this.userPaused}">${this.userPaused ? "전투 계속" : "일시 정지"}</button>${
      candidate && !snapshot.extracted
        ? `<button id="extract-elite" data-defense-extract="${candidate.enemyId}">정예 추출 · ${escapeHtml(companionLabel(candidate.prototype))}</button>`
        : ""
    }`;
    if (actions.dataset.actions !== actionMarkup) {
      actions.dataset.actions = actionMarkup;
      actions.innerHTML = actionMarkup;
      actions.querySelector("#toggle-pause")?.addEventListener("click", () => {
        this.userPaused = !this.userPaused;
        this.surface.dataset.defenseState = this.userPaused ? "paused" : "active";
        this.accumulator = 0;
        this.render();
      });
      actions.querySelector("#extract-elite")?.addEventListener("click", () => {
        this.send("EXTRACT_ELITE", { enemyId: candidate.enemyId });
      });
    }
  }

  async resolveTerminal(snapshot) {
    if (this.terminalHandled) return;
    this.surface.dataset.defenseState = snapshot.terminal.toLowerCase();
    const outcome = snapshot.terminal === "FINAL_COMPLETION"
      ? "FINAL_COMPLETION"
      : snapshot.terminal === "DEFEAT" ? "defeat" : "victory";
    const choices = snapshot.rewardOffer?.choices ?? [];
    if (outcome !== "defeat" && choices.length && !this.selectedRewardId) {
      if (this.rewardPrompted) return;
      this.rewardPrompted = true;
      const card = document.createElement("section");
      card.className = "edge-card defense-result defense-reward";
      card.innerHTML = `<h2>보상 선택 · 영구 기록</h2><p>이번 승리의 보상 하나를 다음 출전에 적용합니다.</p><div class="choices">${choices.map((id) => `<button data-reward="${id}"><strong>${escapeHtml(REWARDS[id]?.name ?? id)}</strong><span>${escapeHtml(REWARDS[id]?.description ?? "기록 보상")}</span></button>`).join("")}</div>`;
      root.querySelector("#defense-edge-hud").append(card);
      card.querySelectorAll("[data-reward]").forEach((button) => {
        button.addEventListener("click", () => {
          this.selectedRewardId = button.dataset.reward;
          this.send("REWARD_SELECTED", { rewardId: this.selectedRewardId });
          this.run = advanceDefenseRun(this.run, 0);
          void this.resolveTerminal(getRunSnapshot(this.run));
        });
      });
      card.querySelector("button")?.focus();
      return;
    }
    this.terminalHandled = true;
    campaign = applyCampaignRunResult(campaign, { stageId: this.stageId, outcome, rewardId: this.selectedRewardId });
    await persistCampaign(outcome === "defeat" ? "패배 기록을 저장했습니다." : "방어 기록과 보상을 저장했습니다.");
    const complete = campaign.lastResolution.campaignComplete;
    root.querySelector(".defense-reward")?.remove();
    const card = document.createElement("section");
    card.className = "edge-card defense-result";
    card.innerHTML = `<h2>${outcome === "defeat" ? "방어선이 무너졌습니다" : complete ? "심연 방어선 완수" : "관문 방어 성공"}</h2>
      <div class="choices"><button id="result-action">${outcome === "defeat" ? "같은 구역 재도전" : complete ? "기록실로" : "다음 구역"}</button><button id="lobby-action">로비</button></div>`;
    root.querySelector("#defense-edge-hud").append(card);
    card.querySelector("#result-action").addEventListener("click", () => {
      if (outcome === "defeat") {
        this.stop({ renderLobby: false });
        beginSession(this.stageId);
      } else if (complete) {
        this.stop({ renderLobby: true });
      } else {
        selectedStageId = STAGES[campaign.unlockedStageIndex].id;
        this.stop({ renderLobby: false });
        beginSession(selectedStageId);
      }
    });
    card.querySelector("#lobby-action").addEventListener("click", () => this.stop({ renderLobby: true }));
    card.querySelector("button")?.focus();
  }

  debugMetrics() {
    return {
      domNodes: this.surface?.querySelectorAll("*").length ?? 0,
      liveRafLoops: this.stopped || !this.frame ? 0 : 1,
      registeredListeners: this.listenerCount,
      timers: 0,
      audioNodes: this.audio.debugMetrics().nodes,
      renderer: this.renderer?.debugMetrics?.() ?? { geometries: 0, textures: 0, programs: 0 },
      inputMarkerCount: this.inputSeq,
    };
  }

  stop({ renderLobby: shouldRenderLobby } = { renderLobby: true }) {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.unlisten(this.canvas, "pointerdown", this.onPointerDown);
    this.unlisten(this.canvas, "pointermove", this.onPointerMove);
    this.unlisten(this.canvas, "pointerup", this.onPointerEnd);
    this.unlisten(this.canvas, "pointercancel", this.onPointerEnd);
    this.unlisten(this.canvas, "lostpointercapture", this.onPointerEnd);
    this.unlisten(window, "blur", this.onWindowBlur);
    this.unlisten(document, "visibilitychange", this.onVisibility);
    this.unlisten(window, "keydown", this.onKey);
    this.unlisten(window, "keyup", this.onKey);
    this.unlisten(window, "resize", this.onResize);
    this.unlisten(window, "abyssal:defense-viewportchange", this.onResize);
    this.renderer?.dispose?.();
    this.audio.stop();
    globalThis.screen?.orientation?.unlock?.();
    session = null;
    if (shouldRenderLobby) renderLobby();
  }
}

async function initialize() {
  await storage.open();
  campaign = (await storage.load()) ?? createCampaign();
  selectedStageId = STAGES[campaign.unlockedStageIndex].id;
  statusText = `저장소 ${storage.backend} 준비됨`;
  viewport.start();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => undefined);
  renderLobby();
}

void initialize();
