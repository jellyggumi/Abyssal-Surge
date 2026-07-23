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
import { ARENA, COMPANIONS, REWARDS, RULES_VERSION, SKILLS, STAGE_BY_ID, STAGE_REWARD_IDS, TICK_RATE } from "./defense-catalog.js";
import { cutsceneEventKey, cutsceneFromEvent } from "./defense-cutscene.js";
import { DefenseAudio } from "./defense-audio.js";
import { DefenseViewport } from "./defense-viewport.js";
import { DefenseTelemetry } from "./defense-telemetry.js";

const root = document.querySelector("#defense-app");
const storage = new DefenseStorage();
const viewport = new DefenseViewport();
const telemetry = new DefenseTelemetry();
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
const SNAPSHOT_FEEDBACK_TYPES = new Set(["CRITICAL_HIT", "LORE_SURPRISE_RESOLVED"]);

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

function stageSpecFor(stageId) {
  return STAGE_BY_ID[stageId] ?? STAGE_BY_ID[STAGES[0].id];
}

function companionGlyph(prototype) {
  return {
    "ember-cohort": "✦",
    "rift-lens": "◈",
    "veil-vanguard": "◇",
    "anchor-shard": "⬡",
    "throne-echo": "◌",
    "dawnless-crown": "♜",
  }[prototype] ?? "·";
}

function stageObjective(stageId) {
  const objectives = {
    "cinder-span": "잿빛 교량의 봉쇄점을 지키고 첫 잔향을 회수",
    "veil-citadel": "장막 신호를 점유해 관문 압력을 낮춤",
    "echo-throne": "왕좌의 메아리를 끊고 중앙 전선을 유지",
  };
  return objectives[stageId] ?? "추출점을 점유하고 보스의 명령망을 봉쇄";
}

function nextRewardName(stageId) {
  const authored = STAGE_REWARD_IDS[stageId] ?? [];
  const rewardId = authored.find((id) => !(campaign?.rewardIds ?? []).includes(id)) ?? authored[0];
  return REWARDS[rewardId]?.name ?? "봉쇄 기록";
}



function companionLabel(prototype) {
  return COMPANIONS[prototype]?.name ?? prototype;
}

function growthUpgradePreview(skillId, snapshot) {
  const skill = SKILLS[skillId] ?? {};
  const currentValue = snapshot.commander.skillRanks[skillId] ?? 0;
  const upgradedValue = currentValue + 1;
  const details = [`등급 ${currentValue} → ${upgradedValue}`];
  if (skill.basicDamage) details.push(`기본 공격 ${snapshot.commander.basicDamage} → ${snapshot.commander.basicDamage + skill.basicDamage}`);
  if (skill.pickupRange) details.push(`회수 반경 ${snapshot.commander.pickupRange} → ${snapshot.commander.pickupRange + skill.pickupRange}`);
  if (skill.maxIntegrity) details.push(`최대 내구 ${snapshot.commander.maxIntegrity} → ${snapshot.commander.maxIntegrity + skill.maxIntegrity}`);
  if (skill.damage) details.push(`피해 ${currentValue ? skill.damage : 0} → ${skill.damage}`);
  if (skill.integrity) details.push(`회복 ${currentValue ? skill.integrity : 0} → ${skill.integrity}`);
  if (skill.cooldown) details.push(`재사용 ${(skill.cooldown / TICK_RATE).toFixed(1)}초`);
  return { skillId, currentValue, upgradedValue, label: details.join(" · ") };
}

function rewardUpgradePreview(rewardId, snapshot) {
  const reward = REWARDS[rewardId] ?? {};
  const owned = snapshot.rewardIds.includes(rewardId);
  const currentValue = owned ? 1 : 0;
  const upgradedValue = 1;
  let detail = `Archive 기록 ${currentValue} → ${upgradedValue}`;
  if (reward.cooldownReduction) {
    const current = Math.round((1 - snapshot.commander.cooldownScale) * 100);
    const upgraded = owned ? current : Math.min(60, current + Math.round(reward.cooldownReduction * 100));
    detail = `쿨다운 감소 ${current}% → ${upgraded}%`;
  } else if (reward.gateDamageReduction) {
    const upgraded = owned ? snapshot.gateDamageReduction : snapshot.gateDamageReduction + reward.gateDamageReduction;
    detail = `관문 피해 감소 ${snapshot.gateDamageReduction} → ${upgraded}`;
  } else if (reward.integrity) {
    const upgraded = owned ? snapshot.gate.maxIntegrity : snapshot.gate.maxIntegrity + reward.integrity;
    detail = `관문 최대 내구 ${snapshot.gate.maxIntegrity} → ${upgraded}`;
  } else if (reward.companionId) {
    const current = snapshot.companions.some((entry) => entry.companionId === reward.companionId) ? 1 : 0;
    detail = `추출 동료 ${current} → 1`;
  } else if (reward.damageBonus) {
    const current = owned ? reward.damageBonus : 0;
    detail = `동료 공격 보너스 ${current} → ${reward.damageBonus}`;
  }
  return { rewardId, currentValue, upgradedValue, label: `${detail}${owned ? " · 이미 기록됨" : ""}` };
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

/** Warden growth panel (stats/skills/traits/equipment/formation/wardline) — minimal Stage1 UI, `.claude/skills` task-manifest scope. */
function renderGrowthPanel() {
  const wp = campaign.wardenProgress;
  const echoEarned = echoCoreEarned(campaign);
  const echoSpent = echoCoreSpent(campaign);
  const fragEarned = boundFragmentEarned(campaign);
  const fragSpent = boundFragmentSpent(campaign);
  const level = wardLevel(campaign);
  const loadout = selectedLoadout();

  const statsHtml = Object.values(WARDEN_STATS).map((stat) => {
    const points = wp.statPoints[stat.id] ?? 0;
    const maxed = points >= stat.maxPoints;
    const nextCost = maxed ? null : wardenStatPointCost(points + 1);
    const affordable = nextCost !== null && echoSpent + nextCost <= echoEarned;
    return `<div class="growth-stat-row"><div><strong>${escapeHtml(stat.name)}</strong><small>${escapeHtml(stat.description)} · ${points}/${stat.maxPoints}</small></div><button data-warden-stat="${stat.id}" ${maxed || !affordable ? "disabled" : ""}>${maxed ? "만렙" : `+1 (${nextCost} EC)`}</button></div>`;
  }).join("");

  const skillHtml = Object.values(WARDEN_SKILL_TREE).map((node) => {
    const unlocked = wp.skillTreeIds.includes(node.id);
    const prereqMet = node.prereq.every((id) => wp.skillTreeIds.includes(id));
    const affordable = echoSpent + node.cost <= echoEarned;
    const canUnlock = !unlocked && prereqMet && affordable;
    return `<div class="growth-skill-node${unlocked ? " is-unlocked" : ""}"><div><strong>${escapeHtml(node.id)}</strong><small>${escapeHtml(node.description)} · 비용 ${node.cost} EC${node.prereq.length ? ` · 선행 ${node.prereq.join(", ")}` : ""}</small></div><button data-warden-skill="${node.id}" ${unlocked || !canUnlock ? "disabled" : ""}>${unlocked ? "해금됨" : "해금"}</button></div>`;
  }).join("");

  const nextTraitSlot = wp.traitIds.length;
  const nextTraitSequence = WARDEN_TRAIT_UNLOCK_SEQUENCES[nextTraitSlot];
  const traitOffers = nextTraitSequence !== undefined && campaign.resolvedIds.length >= nextTraitSequence
    ? wardenTraitOffersForSequence(nextTraitSequence, wp.traitIds) : [];
  const traitsHtml = `
    <p class="section-copy">선택됨: ${wp.traitIds.length ? wp.traitIds.map((id) => escapeHtml(WARDEN_TRAITS[id]?.name ?? id)).join(", ") : "없음"} (${wp.traitIds.length}/${WARDEN_TRAIT_UNLOCK_SEQUENCES.length})</p>
    ${traitOffers.length ? `<div class="growth-trait-offers">${traitOffers.map((id) => { const trait = WARDEN_TRAITS[id]; return `<button class="growth-trait-card" data-warden-trait="${id}"><strong>${escapeHtml(trait.name)}</strong><small>${escapeHtml(trait.description)}</small><em>${escapeHtml(trait.tradeoff)}</em></button>`; }).join("")}</div>`
      : nextTraitSequence !== undefined ? `<p class="section-copy">다음 특성은 ${nextTraitSequence}전선 완료 시 선택 가능합니다 (현재 ${campaign.resolvedIds.length}).</p>` : `<p class="section-copy">모든 특성 슬롯을 사용했습니다.</p>`}`;

  const equipOwners = [{ id: "warden", label: "Dusk Warden" }, ...loadout.map((id) => ({ id, label: companionLabel(id) }))];
  const equipHtml = equipOwners.map((owner) => `
    <div class="growth-equip-owner"><strong>${escapeHtml(owner.label)}</strong><div class="growth-equip-slots">${EQUIPMENT_SLOTS.map((slot) => {
      const tierIndex = equipmentTierIndexFor(campaign, owner.id, slot);
      const maxed = tierIndex >= EQUIPMENT_TIERS.length - 1;
      const currentTier = EQUIPMENT_TIERS[tierIndex];
      const cost = maxed ? null : equipmentTierUpgradeCost(tierIndex);
      const affordable = cost !== null && fragSpent + cost <= fragEarned;
      return `<div class="growth-equip-slot"><small>${slot}</small><span class="tier-icon" data-tier-vertices="${currentTier.vertexCount}" aria-hidden="true"></span><span>${escapeHtml(currentTier.name)} (${currentTier.id})</span><button data-warden-equip-owner="${owner.id}" data-warden-equip-slot="${slot}" ${maxed || !affordable ? "disabled" : ""}>${maxed ? "최대" : `강화 (${cost} BF)`}</button></div>`;
    }).join("")}</div></div>`).join("");

  const formationHtml = loadout.length ? `<div class="growth-formation-row">${loadout.map((id) => {
    const slot = campaign.companionFormation[id] || "BACK";
    return `<div class="growth-formation-slot"><strong>${escapeHtml(companionLabel(id))}</strong><span>${slot}</span><button data-warden-formation="${id}" data-warden-formation-target="${slot === "FRONT" ? "BACK" : "FRONT"}">${slot === "FRONT" ? "후열로" : "전열로"}</button></div>`;
  }).join("")}</div>` : `<p class="section-copy">편성된 동료가 없습니다.</p>`;

  return `
    <section class="growth-panel" aria-labelledby="growth-title">
      <div class="panel-heading"><div><p class="eyebrow">DUSK WARDEN · TRACK A/B</p><h2 id="growth-title">성장</h2></div><span class="panel-count">EC ${echoSpent}/${echoEarned} · BF ${fragSpent}/${fragEarned} · 저지 Lv${level}</span></div>
      <details open><summary>스탯 (Echo Core)</summary><div class="growth-stat-grid">${statsHtml}</div></details>
      <details><summary>스킬트리 (Echo Core, 스탯과 공용 예산)</summary><div class="growth-skill-grid">${skillHtml}</div></details>
      <details><summary>특성 (전선 클리어 시 3택1)</summary>${traitsHtml}</details>
      <details><summary>장비 (Bound Fragment)</summary><div class="growth-equip-grid">${equipHtml}</div></details>
      <details><summary>편성 (전열/후열, 최대 ${MAX_FRONT_SLOTS}전열)</summary>${formationHtml}</details>
    </section>`;
}

function renderLobby() {
  if (!campaign) return;
  const selected = stageFor(selectedStageId);
  const selectedSpec = stageSpecFor(selected.id);
  const loadout = selectedLoadout();
  const collection = campaign.companionCollection;
  const completed = campaign.resolvedIds?.length ?? 0;
  const unlocked = campaign.unlockedStageIndex + 1;
  const selectedObjective = stageObjective(selected.id);
  document.body.classList.remove("defense-playing");
  document.body.style.overflow = "";
  root.className = "defense-lobby";
  root.innerHTML = `
    <header class="command-header">
      <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">AC</span><div><p class="eyebrow">ABYSSAL COMMAND · DEEP REFUGE</p><h1>그림자군단 방어선</h1></div></div>
      <div class="command-status"><span class="signal-dot" aria-hidden="true"></span><span>기록실 연결됨</span><strong>${completed}/10 봉쇄선</strong></div>
    </header>
    <section class="command-hero" aria-labelledby="command-hero-title">
      <div class="hero-copy">
        <p class="eyebrow">COMMAND DECK · SECTOR ${String(selected.sequence).padStart(2, "0")}</p>
        <h2 id="command-hero-title">심연의 문을<br /><em>다시 닫아라.</em></h2>
        <p class="hero-lede">자동 사격으로 전선을 버티고, 잔향을 모아 런을 성장시키세요. 지금은 ${escapeHtml(selected.name)}의 관문이 압박받고 있습니다.</p>
        <div class="hero-facts"><span><small>현재 목표</small><b>관문 방어</b></span><span><small>다음 위협</small><b>${escapeHtml(selected.bossName)}</b></span><span><small>출전 편성</small><b>${loadout.length}/3 슬롯</b></span></div>
        <button id="start-defense" class="primary-action hero-cta"><span>작전 개시</span><small>${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)} 전선으로</small><b aria-hidden="true">↗</b></button>
      </div>
      <div class="tactical-map" aria-label="선택한 전선의 전술 지도">
        <div class="map-grid" aria-hidden="true"></div><div class="map-route route-a" aria-hidden="true"></div><div class="map-route route-b" aria-hidden="true"></div>
        <div class="map-node node-gate"><span>GATE</span><b>관문</b></div><div class="map-node node-seal"><span>SEAL</span><b>점유점</b></div><div class="map-node node-threat"><span>THREAT</span><b>보스</b></div>
        <div class="map-readout"><span>작전 구역</span><strong>${escapeHtml(selected.name)}</strong><small>방어선 ${selected.sequence} · 위험도 ${Math.min(99, Math.round(selectedSpec.scale / 2.4))}%</small></div>
      </div>
    </section>
    <div class="ops-grid">
      <section class="mission-panel" aria-labelledby="stage-title">
        <div class="panel-heading"><div><p class="eyebrow">CAMPAIGN MAP</p><h2 id="stage-title">전선 선택</h2></div><span class="panel-count">${completed} CLEAR · ${unlocked} UNLOCKED</span></div>
        <div class="stage-rail">
          ${STAGES.map((stage, index) => {
            const locked = index > campaign.unlockedStageIndex;
            const cleared = campaign.resolvedIds?.includes(stage.id);
            return `<button class="stage-card${stage.id === selected.id ? " is-selected" : ""}" data-stage="${stage.id}" aria-pressed="${stage.id === selected.id}" ${locked ? "disabled" : ""}><span class="stage-index">${String(stage.sequence).padStart(2, "0")}</span><span class="stage-info"><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.bossName)}</small></span><span class="stage-state">${locked ? "잠김" : cleared ? "CLEAR" : stage.id === selected.id ? "선택됨" : "출전 가능"}</span></button>`;
          }).join("")}
        </div>
      </section>
      <aside class="briefing-panel" aria-labelledby="briefing-title">
        <div class="panel-heading"><div><p class="eyebrow">TACTICAL BRIEFING</p><h2 id="briefing-title">작전 브리핑</h2></div><span class="briefing-code">AC-${String(selected.sequence).padStart(2, "0")}</span></div>
        <div class="briefing-target"><span class="target-sigil" aria-hidden="true">◉</span><div><small>최우선 위협</small><strong>${escapeHtml(selected.bossName)}</strong><span>${escapeHtml(selectedObjective)}</span></div></div>
        <dl class="briefing-stats"><div><dt>전선 난이도</dt><dd><span class="difficulty-bars" aria-label="난이도 ${Math.min(5, Math.ceil(selected.sequence / 2))}/5">${"▮".repeat(Math.min(5, Math.ceil(selected.sequence / 2)))}${"▯".repeat(5 - Math.min(5, Math.ceil(selected.sequence / 2)))}</span></dd></div><div><dt>다음 보상</dt><dd>${escapeHtml(nextRewardName(selected.id))}</dd></div><div><dt>작전 방식</dt><dd>이동 + 자동 사격</dd></div></dl>
        <p class="briefing-tip"><strong>군주여, 일어나라!</strong> 중앙 전장에서 손가락을 끌어 이동하세요. 적을 처치하고 <b>추출(Extract)</b>하여 그림자 군단으로 복속시킬 수 있습니다.</p>
      </aside>
      <section class="loadout-panel" aria-labelledby="companion-title">
        <div class="panel-heading"><div><p class="eyebrow">COMMAND BOND</p><h2 id="companion-title">동료 편성</h2></div><span class="panel-count">${loadout.length}/3 ACTIVE</span></div>
        <p class="section-copy">정예를 추출하면 영구 동료가 됩니다. 편성한 동료는 다음 출전부터 자동으로 함께합니다.</p>
        <div class="loadout-slots" aria-label="현재 동료 편성">${[0, 1, 2].map((index) => { const prototype = loadout[index]; return prototype ? `<div class="loadout-slot is-filled"><span class="companion-glyph">${companionGlyph(prototype)}</span><strong>${escapeHtml(companionLabel(prototype))}</strong><small>결속 ${index + 1}</small></div>` : `<div class="loadout-slot"><span class="slot-plus">+</span><small>빈 슬롯</small></div>`; }).join("")}</div>
        <div class="companion-grid">${collection.length ? collection.map((record) => `<button class="companion-card${loadout.includes(record.prototype) ? " is-selected" : ""}" data-companion="${record.prototype}" aria-pressed="${loadout.includes(record.prototype)}"><span class="companion-glyph">${companionGlyph(record.prototype)}</span><span><strong>${escapeHtml(companionLabel(record.prototype))}</strong><small>진화 ${record.evolution} · 추출 ${record.capturedEliteIds.length}</small></span><i>${loadout.includes(record.prototype) ? "편성됨" : "편성"}</i></button>`).join("") : `<div class="empty-companions"><span class="companion-glyph">?</span><div><strong>아직 결속한 동료가 없습니다.</strong><p>전투 중 빛나는 정예를 쓰러뜨린 뒤 <b>추출</b>하세요.</p></div></div>`}</div>
      </section>
      ${renderGrowthPanel()}
      <section class="archive-panel" aria-labelledby="reward-title">
        <div class="panel-heading"><div><p class="eyebrow">ARCHIVE</p><h2 id="reward-title">기록실</h2></div><span class="panel-count">${campaign.rewardIds?.length ?? 0} RELICS</span></div>
        <div class="archive-summary"><span class="archive-ring"><b>${completed}</b><small>전선<br />완료</small></span><div><strong>영구 진행</strong><p>보스 보상과 동료 결속은 기록실에 남아 다음 런에도 이어집니다.</p></div></div>
        <div class="reward-grid">${(campaign.rewardIds?.length ?? 0) ? campaign.rewardIds.map((id) => `<article class="reward-card"><span class="reward-mark">✦</span><strong>${escapeHtml(REWARDS[id]?.name ?? id)}</strong><span>${escapeHtml(REWARDS[id]?.description ?? "기록된 보상")}</span></article>`).join("") : `<p class="empty-archive">첫 보스를 봉쇄하면 영구 보상을 선택할 수 있습니다.</p>`}</div>
      </section>
    </div>
    <details class="archive-tools"><summary>기록 관리 <span>오프라인 저장 · ${escapeHtml(storage.backend ?? "확인 중")}</span></summary><div class="storage-row" aria-label="캠페인 제어"><button id="export-defense">기록 내보내기</button><label class="import-label">기록 가져오기<input id="import-defense" type="file" accept="application/json,text/plain" /></label><button id="export-telemetry">진단 내보내기</button><button id="reset-defense">새 기록</button><output aria-live="polite">${escapeHtml(statusText)}</output></div></details>`;

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
  root.querySelectorAll("[data-warden-stat]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = allocateWardenStatPoint(campaign, button.dataset.wardenStat);
        await persistCampaign("스탯 포인트를 배분했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderLobby();
    });
  });
  root.querySelectorAll("[data-warden-skill]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = unlockWardenSkillNode(campaign, button.dataset.wardenSkill);
        await persistCampaign("스킬 노드를 해금했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderLobby();
    });
  });
  root.querySelectorAll("[data-warden-trait]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = selectWardenTrait(campaign, button.dataset.wardenTrait);
        await persistCampaign("특성을 선택했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderLobby();
    });
  });
  root.querySelectorAll("[data-warden-equip-owner]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = purchaseEquipmentTier(campaign, button.dataset.wardenEquipOwner, button.dataset.wardenEquipSlot);
        await persistCampaign("장비를 강화했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderLobby();
    });
  });
  root.querySelectorAll("[data-warden-formation]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = setCompanionFormationSlot(campaign, button.dataset.wardenFormation, button.dataset.wardenFormationTarget);
        await persistCampaign("편성을 변경했습니다.");
      } catch (error) {
        statusText = error.message;
      }
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
  root.querySelector("#export-telemetry").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([telemetry.exportJson()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "abyssal-defense-telemetry.json";
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
          <div class="hud-panel hud-mission"><span class="hud-eyebrow">ABYSSAL COMMAND</span><strong id="battle-stage"></strong><span id="battle-status" aria-live="polite"></span></div>
          <div class="top-right-hud"><div class="objective-chip"><span class="objective-pulse" aria-hidden="true"></span><span><small>현재 명령</small><strong>관문을 지켜라</strong></span></div><div class="hud-actions" id="skill-actions" aria-label="활성 스킬"></div></div>
        </div>
        <output id="battle-event-feedback" class="battle-event-feedback" role="status" aria-live="polite" aria-atomic="true"></output>
        <div class="arena-callout" aria-hidden="true"><span>GATE CORE</span><i></i><span>전선을 유지하세요</span></div>
        <div class="defense-edge defense-bottom">
          <div class="hud-panel gate-panel"><div class="gate-panel-copy"><span class="hud-eyebrow">GATE INTEGRITY</span><strong id="battle-integrity"></strong><span id="battle-enemies"></span></div><div class="integrity-meter" aria-hidden="true"><i id="battle-integrity-fill"></i></div></div>
          <div class="one-thumb-controls" id="movement-actions" role="group" aria-label="한 손 이동 조작">
            <button type="button" data-move="N" aria-label="위로 이동">↑</button>
            <button type="button" data-move="W" aria-label="왼쪽으로 이동">←</button>
            <button type="button" data-move="IDLE" aria-label="이동 정지">●</button>
            <button type="button" data-move="E" aria-label="오른쪽으로 이동">→</button>
            <button type="button" data-move="S" aria-label="아래로 이동">↓</button>
          </div>
          <div class="hud-actions" id="battle-actions" aria-label="전투 행동"></div>
        </div>
      </div>
    </section>
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
    const seed = stableRunSeed(stageId);
    const equipTiers = (ownerId) => Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
    this.run = createDefenseRun({
      stageId,
      seed,
      companionLoadout: selectedLoadout(),
      rewardIds: campaign.rewardIds ?? [],
      wardenProgress: campaign.wardenProgress,
      wardenEquipment: equipTiers("warden"),
      companionEquipment: Object.fromEntries(selectedLoadout().map((id) => [id, equipTiers(id)])),
      formation: campaign.companionFormation,
    });
    this.motionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    telemetry.startRun({ stageId, seed, rulesVersion: RULES_VERSION, reducedMotion: this.motionQuery?.matches ?? false });
    this.renderer = null;
    this.audio = new DefenseAudio();
    this.audioTick = null;
    this.audioEventKeys = new Set();
    this.frame = 0;
    this.lastFrameAt = 0;
    this.accumulator = 0;
    this.inputSeq = 0;
    this.pointer = null;
    this.controlPointerId = null;
    this.feedbackTick = null;
    this.feedbackEventKeys = new Set();
    this.heldKeys = new Set();
    this.listenerCount = 0;
    this.recordedEliteIds = new Set();
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.userPaused = false;
    this.cutsceneEventKeys = new Set();
    this.cutsceneTimer = null;
    this.stopped = false;
    this.focusBeforeGrowth = null;
    this.onResize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onMoveControlDown = this.onMoveControlDown.bind(this);
    this.onMoveControlEnd = this.onMoveControlEnd.bind(this);
    this.onMoveControlClick = this.onMoveControlClick.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onReducedMotion = (event) => telemetry.recordReducedMotion(event.matches);
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
    this.movementControls = root.querySelector("#movement-actions");
    this.listen(this.movementControls, "pointerdown", this.onMoveControlDown);
    this.listen(this.movementControls, "pointerup", this.onMoveControlEnd);
    this.listen(this.movementControls, "pointercancel", this.onMoveControlEnd);
    this.listen(this.movementControls, "lostpointercapture", this.onMoveControlEnd);
    this.listen(this.movementControls, "click", this.onMoveControlClick);
    this.listen(window, "blur", this.onWindowBlur);
    this.listen(document, "visibilitychange", this.onVisibility);
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    this.listen(window, "resize", this.onResize);
    this.listen(window, "abyssal:defense-viewportchange", this.onResize);
    if (this.motionQuery) this.listen(this.motionQuery, "change", this.onReducedMotion);
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

  onMoveControlDown(event) {
    const button = event.target.closest?.("[data-move]");
    if (!button || this.controlPointerId !== null) return;
    event.preventDefault();
    this.controlPointerId = event.pointerId;
    button.setPointerCapture?.(event.pointerId);
    this.send("MOVE", button.dataset.move);
  }

  onMoveControlEnd(event) {
    if (event.pointerId !== this.controlPointerId) return;
    const button = event.target.closest?.("[data-move]");
    if (button?.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    this.controlPointerId = null;
    this.send("MOVE", "IDLE");
  }

  onMoveControlClick(event) {
    if (event.detail !== 0) return;
    const button = event.target.closest?.("[data-move]");
    if (button) this.send("MOVE", button.dataset.move);
  }

  onWindowBlur() {
    this.controlPointerId = null;
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
    const inputAt = performance.now();
    this.run = queueInput(this.run, type, payload);
    const inputSeq = ++this.inputSeq;
    this.surface.dataset.defenseInputSeq = String(inputSeq);
    if (type === "MOVE") this.surface.dataset.defenseMove = payload;
    if (type === "SKILL_CAST" || type === "SKILL_SELECTED" || type === "REWARD_SELECTED") {
      this.surface.dataset.defenseSkill = payload?.skillId ?? payload?.rewardId ?? payload ?? "";
    }
    this.renderer?.onVisualFeedback?.(inputSeq);
    const visibleAt = performance.now();
    telemetry.recordInputFeedback({ inputSeq, type, inputAtMs: inputAt, visibleAtMs: visibleAt, tick: this.run.tick });
    window.dispatchEvent(new CustomEvent("abyssal:defense-input-feedback", {
      detail: { inputSeq, type, admittedAt: inputAt, displayedAt: visibleAt, tick: this.run.tick },
    }));
  }

  loop(frameNow) {
    if (this.stopped) return;
    if (!this.lastFrameAt) this.lastFrameAt = frameNow;
    const frameDuration = Math.max(0, frameNow - this.lastFrameAt);
    const elapsed = Math.min(100, frameDuration);
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
    telemetry.recordFrameProbe({
      frameDurationMs: frameDuration,
      heapUsedBytes: globalThis.performance?.memory?.usedJSHeapSize,
      atMs: frameNow,
    });
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

  dismissCutscene() {
    if (this.cutsceneTimer !== null) {
      clearTimeout(this.cutsceneTimer);
      this.cutsceneTimer = null;
    }
    this.surface?.querySelector("#defense-cutscene-overlay")?.remove();
    if (this.surface) delete this.surface.dataset.defenseCutscene;
  }

  presentCutscene(event) {
    const cutscene = cutsceneFromEvent(event);
    const key = cutsceneEventKey(event);
    if (!cutscene || !key || this.cutsceneEventKeys.has(key)) return;
    this.cutsceneEventKeys.add(key);
    this.dismissCutscene();
    const overlay = document.createElement("section");
    overlay.id = "defense-cutscene-overlay";
    overlay.className = "defense-cutscene";
    overlay.dataset.cutsceneEvent = cutscene.eventType;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    const title = document.createElement("h2");
    title.textContent = cutscene.title;
    overlay.append(title);
    cutscene.lines.forEach((line) => {
      const copy = document.createElement("p");
      copy.textContent = line;
      overlay.append(copy);
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.dataset.cutsceneDismiss = "true";
    dismiss.textContent = "계속";
    dismiss.addEventListener("click", () => this.dismissCutscene());
    overlay.append(dismiss);
    this.surface.append(overlay);
    this.surface.dataset.defenseCutscene = cutscene.eventType;
    this.cutsceneTimer = setTimeout(() => this.dismissCutscene(), 8000);
  }

  consumeCutscenes(events) {
    events.forEach((event) => this.presentCutscene(event));
  }


  renderEventFeedback(snapshot) {
    if (this.feedbackTick !== snapshot.tick) {
      this.feedbackTick = snapshot.tick;
      this.feedbackEventKeys.clear();
    }
    const feedback = root.querySelector("#battle-event-feedback");
    const freshEvents = snapshot.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => SNAPSHOT_FEEDBACK_TYPES.has(event.type))
      .filter(({ event, index }) => {
        const key = event.eventId ?? event.id ?? `${snapshot.tick}:${index}:${event.type}:${event.enemyId ?? event.targetId ?? ""}`;
        if (this.feedbackEventKeys.has(key)) return false;
        this.feedbackEventKeys.add(key);
        return true;
      });
    if (!freshEvents.length || !feedback) return;
    const feedbackTypes = new Set(freshEvents.map(({ event }) => event.type));
    feedback.dataset.feedback = [...feedbackTypes].map((type) => type === "CRITICAL_HIT" ? "critical" : "lore").join(" ");
    feedback.textContent = freshEvents.map(({ event }) => event.type === "CRITICAL_HIT"
      ? "CRIT · 치명타 확정"
      : event.text ?? event.message ?? event.summary ?? event.lore ?? "심연의 비밀이 해소되었습니다.").join(" · ");
    this.surface.dataset.defenseFeedback = feedback.dataset.feedback;
  }
  render() {
    const snapshot = getRunSnapshot(this.run);
    telemetry.recordSnapshot(snapshot);
    telemetry.recordSimulationEvents(snapshot.events);
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
    this.consumeCutscenes(snapshot.events);
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
    root.querySelector("#battle-integrity-fill").style.width = `${Math.max(0, Math.min(100, snapshot.gate.integrity / snapshot.gate.maxIntegrity * 100))}%`;
    root.querySelector("#battle-enemies").textContent = `적 ${snapshot.enemies.length} · 처치 ${snapshot.progress.defeated} · 아이템 ${snapshot.progress.itemsCollected}`;
    this.renderControls(snapshot);
    if (snapshot.terminal && !this.terminalHandled) void this.resolveTerminal(snapshot);
    this.renderEventFeedback(snapshot);
  }

  renderControls(snapshot) {
    const skills = root.querySelector("#skill-actions");
    const activeSkills = snapshot.commander.skills.filter((id) => SKILLS[id]?.kind === "active");
    const markup = activeSkills.map((id) => {
      const cooldown = snapshot.commander.cooldowns[id] ?? 0;
      const skill = SKILLS[id] ?? {};
      const glyph = { "rift-bolt": "✦", "soul-lance": "╱", "grave-pulse": "◉", "void-aegis": "⬡", "shadow-step": "◇" }[id] ?? "✦";
      return `<button class="skill-action" data-cast="${id}" data-defense-skill="${id}" ${cooldown ? "disabled" : ""}><span class="skill-glyph" aria-hidden="true">${glyph}</span><span class="skill-copy"><strong>${escapeHtml(skill.name ?? id)}</strong><small>${cooldown ? `${(cooldown / TICK_RATE).toFixed(1)}s` : "준비됨"}</small></span></button>`;
    }).join("");
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
        const previews = snapshot.growthOffer.choices.map((id) => growthUpgradePreview(id, snapshot));
        telemetry.append("GROWTH_OFFER_VALUES", { tick: snapshot.tick, choices: previews });
        card.innerHTML = `<h2>성장 선택 · 전투 일시 정지</h2><div class="choices">${previews.map(({ skillId, label }) => `<button data-pick="${skillId}"><strong>${escapeHtml(SKILLS[skillId]?.name ?? skillId)}</strong><span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
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
      const rewardPreviews = choices.map((id) => rewardUpgradePreview(id, snapshot));
      telemetry.append("REWARD_OFFER_VALUES", { tick: snapshot.tick, choices: rewardPreviews });
      card.innerHTML = `<h2>보상 선택 · 영구 기록</h2><p>이번 승리의 보상 하나를 다음 출전에 적용합니다.</p><div class="choices">${rewardPreviews.map(({ rewardId, label }) => `<button data-reward="${rewardId}"><strong>${escapeHtml(REWARDS[rewardId]?.name ?? rewardId)}</strong><span>${escapeHtml(REWARDS[rewardId]?.description ?? "기록 보상")}</span><span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
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
    const complete = campaign.lastResolution.campaignComplete;
    telemetry.recordRunResult({ outcome, rewardId: this.selectedRewardId, campaignComplete: complete, stageId: this.stageId, tick: snapshot.tick });
    await persistCampaign(outcome === "defeat" ? "패배 기록을 저장했습니다." : "방어 기록과 보상을 저장했습니다.");
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
    this.unlisten(this.movementControls, "pointerdown", this.onMoveControlDown);
    this.unlisten(this.movementControls, "pointerup", this.onMoveControlEnd);
    this.unlisten(this.movementControls, "pointercancel", this.onMoveControlEnd);
    this.unlisten(this.movementControls, "lostpointercapture", this.onMoveControlEnd);
    this.unlisten(this.movementControls, "click", this.onMoveControlClick);
    this.unlisten(window, "blur", this.onWindowBlur);
    this.unlisten(document, "visibilitychange", this.onVisibility);
    this.unlisten(window, "keydown", this.onKey);
    this.unlisten(window, "keyup", this.onKey);
    this.unlisten(window, "resize", this.onResize);
    this.unlisten(window, "abyssal:defense-viewportchange", this.onResize);
    if (this.motionQuery) this.unlisten(this.motionQuery, "change", this.onReducedMotion);
    this.renderer?.dispose?.();
    this.audio.stop();
    this.dismissCutscene();
    globalThis.screen?.orientation?.unlock?.();
    session = null;
    if (shouldRenderLobby) renderLobby();
  }
}

async function initialize() {
  try {
    await storage.open();
    campaign = (await storage.load()) ?? createCampaign();
  } catch (err) {
    campaign = createCampaign();
  }
  selectedStageId = STAGES[campaign.unlockedStageIndex]?.id ?? STAGES[0].id;
  statusText = `저장소 ${storage.backend ?? "메모리"} 준비됨`;
  viewport.start();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => undefined);
  renderLobby();
}

void initialize();
