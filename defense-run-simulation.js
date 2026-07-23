/**
 * Deterministic, renderer-neutral 60 Hz defense-survivor simulation.
 * Every state-changing API returns a new frozen run; callers may retain old runs.
 */
import * as Catalog from "./defense-catalog.js";
import {
  ARENA, AUDIO_CUES, BOSSES, COMMANDER, COMPANIONS, CUTSCENES, ENEMIES,
  GATE, ITEMS, MEASUREMENT_PROFILES, OCTANT_VECTORS, REWARDS, SKILLS, STAGE_BY_ID, STAGE_ITEM_IDS,
  STAGE_REWARD_IDS, TARGET_PRIORITY, TICK_RATE, XP_GROWTH
} from "./defense-catalog.js";
import {
  MAX_FRONT_SLOTS, BACK_ROW_SYNERGY_DAMAGE_BONUS, BOSS_RALLY_COOLDOWN_REDUCTION, COMPANION_ROLES,
  deriveWardenRuntimeStats, deriveCompanionRuntimeStats, companionFormationIntegrity,
} from "./rpg-catalog.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const clamp = (value, low, high) => value < low ? low : value > high ? high : value;
const distanceSquared = (a, b) => { const x = a.x - b.x; const y = a.y - b.y; return x * x + y * y; };
const scaled = (value, scale) => Math.trunc(value * scale / 100);
const rngNext = (seed) => { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
const stageFor = (stageId) => {
  const stage = STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown defense stage: ${stageId}`);
  return stage;
};
const validLoadout = (loadout) => [...new Set((Array.isArray(loadout) ? loadout : []).filter((id) => COMPANIONS[id]))].sort().slice(0, 3);
const nextId = (run, prefix) => `${prefix}-${++run.nextId}`;
const actor = (id, kind, x, y, hp, maxHp, extra = {}) => ({ id, kind, x, y, hp, maxHp, ...extra });
const sortedActors = (entries) => [...entries].sort((left, right) => left.id.localeCompare(right.id));
const stageCutscene = (stage) => CUTSCENES[stage.id] || CUTSCENES.default;
const eventCue = (name) => AUDIO_CUES[name]?.id || null;
const SNAPSHOT_VERSION = 6;
const EVENT_VERSION = 3;
const emit = (run, type, payload = {}) => {
  const eventSequence = ++run.eventSequence;
  const identity = run.planCommitment?.identity || `uncommitted:${run.seed ?? 0}`;
  const event = {
    version: EVENT_VERSION,
    tick: run.tick,
    type,
    ...payload,
    eventSequence,
    eventId: `${identity}:event:${eventSequence}`,
  };
  run.events.push(event);
  return event;
};
const OBJECTIVE_PRESSURE_GRACE_TICKS = 3600;
const OBJECTIVE_PRESSURE_INTERVAL_TICKS = 600;
const OBJECTIVE_PRESSURE_DAMAGE = 100;
const OBJECTIVE_PRESSURE_DEADLINE_OFFSET = 9000;
const BOSS_PRESSURE_GRACE_TICKS = 1800;
const ECHO_RECOVERY_PRESSURE_GRACE_TICKS = 150;
const GATE_PRESSURE_RELEASE_LEAD = freeze({
  "player-pursuit": 360,
  "resource-denial": 240,
  "low-hp-focus": 240,
  flank: 120,
});

const ENEMY_POLICIES = Catalog.ENEMY_POLICIES || freeze({
  "gate-pressure": { id: "gate-pressure", name: "Gate Pressure" },
  "player-pursuit": { id: "player-pursuit", name: "Player Pursuit" },
  "flank": { id: "flank", name: "Flank" },
  "resource-denial": { id: "resource-denial", name: "Resource Denial" },
  "elite-escort": { id: "elite-escort", name: "Elite Escort" },
  "low-hp-focus": { id: "low-hp-focus", name: "Low HP Focus" },
});


function stagePlanFor(stage) {
  const descriptor = Catalog.STAGE_PLAN_DESCRIPTORS?.[stage.id];
  if (!descriptor) throw new RangeError(`Missing immutable plan descriptor for defense stage: ${stage.id}`);
  return descriptor;
}

function buildWaveSchedule(stage, seed, tactics, wavePlan) {
  let rng = seed;
  const variation = tactics.seededVariation || { timingJitterTicks: 30, densityDelta: 1, laneJitter: 400 };
  const directions = tactics.spawnDirections?.length ? tactics.spawnDirections : ["W", "NW", "SW"];
  const policyChoices = {
    rusher: ["gate-pressure", "player-pursuit", "low-hp-focus"],
    flanker: ["flank", "low-hp-focus"],
    guardian: ["elite-escort", "gate-pressure"],
    ranged: ["resource-denial", "player-pursuit"],
  };
  const authoredPlan = wavePlan.authoredAlternatives ? wavePlan.waves : null;
  const waveSources = wavePlan.waves;
  const schedule = waveSources.map((source, waveIndex) => {
    const alternatives = source.alternatives?.length ? source.alternatives : [{
      id: `${stage.id}-wave-${waveIndex}-primary`,
      composition: [source.primary],
    }];
    let selected;
    let timingJitter;
    if (authoredPlan) {
      rng = rngNext(rng);
      selected = alternatives[Math.floor(rng / 0x100000) % alternatives.length];
      timingJitter = 0;
    } else {
      rng = rngNext(rng);
      selected = alternatives[0];
      timingJitter = (rng % (2 * variation.timingJitterTicks + 1)) - variation.timingJitterTicks;
    }
    const composition = selected.composition.map(({ enemy, count }) => ({ enemy, count }));
    const primary = composition[0];
    rng = rngNext(rng);
    const densityDelta = authoredPlan ? 0 : (rng % (2 * variation.densityDelta + 1)) - variation.densityDelta;
    rng = rngNext(rng);
    const direction = directions[rng % directions.length];
    rng = rngNext(rng);
    const laneOffset = (rng % (2 * variation.laneJitter + 1)) - variation.laneJitter;
    rng = rngNext(rng);
    const policies = policyChoices[primary.enemy] || [ENEMIES[primary.enemy]?.policyId || "gate-pressure"];
    const policyId = policies[rng % policies.length];
    const adjustedComposition = composition.map((entry, index) => ({
      enemy: entry.enemy,
      count: Math.max(1, entry.count + (index === 0 ? densityDelta : 0)),
    }));
    return {
      waveIndex,
      slot: source.slot ?? waveIndex,
      alternativeId: selected.id,
      pattern: stage.wavePattern?.[waveIndex] || primary.enemy,
      baseAt: source.tick,
      at: Math.max(0, source.tick + timingJitter),
      type: primary.enemy,
      baseCount: primary.count,
      count: adjustedComposition.reduce((total, entry) => total + entry.count, 0),
      composition: adjustedComposition,
      selectionId: selected.id,
      direction,
      laneOffset,
      policyId,
    };
  });
  schedule.sort((a, b) => a.at - b.at || a.waveIndex - b.waveIndex);
  const variantId = schedule.map(({ at, composition, direction, laneOffset, policyId, selectionId }) =>
    `${at}:${selectionId}:${composition.map(({ enemy, count }) => `${enemy}x${count}`).join("+")}:${direction}:${laneOffset}:${policyId}`).join("|");
  return { schedule, nextRng: rng, variantId };
}

function spawnPoint(direction, laneOffset) {
  if (direction === "NW") return { x: 1000, y: clamp(1000 + Math.abs(laneOffset), 500, 4000) };
  if (direction === "SW") return { x: 1000, y: clamp(ARENA.height - 1000 - Math.abs(laneOffset), 8000, ARENA.height - 500) };
  if (direction === "N") return { x: clamp(6000 + laneOffset, 2000, 18000), y: 500 };
  if (direction === "S") return { x: clamp(6000 + laneOffset, 2000, 18000), y: ARENA.height - 500 };
  return { x: 500, y: clamp(ARENA.gateY + laneOffset, 1000, ARENA.height - 1000) };
}

function laneRoute(tactics, policyId, laneOffset) {
  if (policyId === "flank" && tactics.flank) {
    return [{ id: tactics.flank.id, x: tactics.flank.entryX, y: tactics.flank.entryY, zone: "flank" }];
  }
  if (policyId === "gate-pressure" && tactics.chokepath) {
    const halfLane = Math.max(0, Math.trunc(tactics.chokepath.halfWidth / 2));
    return [{
      id: tactics.chokepath.id,
      x: tactics.chokepath.x,
      y: clamp(ARENA.gateY + clamp(laneOffset, -halfLane, halfLane), 0, ARENA.height),
      zone: "chokepath",
    }];
  }
  return [];
}

/** Formation targeting (UNIFIED-GDD.md §4.2/§4.3): FRONT companions still ACTIVE (not DOWNED) with formationIntegrity remaining. */
function livingFrontCompanions(run) {
  return run.companions.filter((entry) => entry.slot === "FRONT" && entry.status === "ACTIVE" && entry.hp > 0);
}
function nearestActor(origin, candidates) {
  return candidates.slice().sort((a, b) => {
    const delta = distanceSquared(origin, a) - distanceSquared(origin, b);
    return delta || a.id.localeCompare(b.id);
  })[0];
}
/**
 * Enemies that would otherwise pick the commander now pick from {commander, living FRONT companions}.
 * Companions are position-pinned to the commander every tick (no distinct stance-offset positions
 * this cycle — deferred, see task-manifest.md), so distance is always tied; ties resolve in favor
 * of the nearest FRONT companion (vanguard-screen intent: front row is engaged before the commander)
 * rather than `nearestActor`'s generic id-lexical tiebreak, which would otherwise always pick
 * "commander" over "companion-N" and leave FRONT targeting permanently inert.
 */
function playerSideTarget(run, enemy) {
  const fronts = livingFrontCompanions(run);
  if (!fronts.length) return run.commander;
  const nearestFront = nearestActor(enemy, fronts);
  if (distanceSquared(enemy, nearestFront) <= distanceSquared(enemy, run.commander)) return nearestFront;
  return run.commander;
}
/** Resolves loadout + optional formation map into a deterministic companionId -> "FRONT"|"BACK" Map. Legacy (no formation) = all BACK. */
function resolveFormation(companionLoadout, formation) {
  const result = new Map(validLoadout(companionLoadout).map((id) => [id, "BACK"]));
  let frontCount = 0;
  Object.entries(formation || {}).forEach(([id, slot]) => {
    if (!result.has(id) || slot !== "FRONT" || frontCount >= MAX_FRONT_SLOTS) return;
    result.set(id, "FRONT");
    frontCount += 1;
  });
  return result;
}

/**
 * `options.slot`: "FRONT" | "BACK" (default BACK). `options.equipment`: {weapon,ward,trinket}
 * 0-based tier indices (default all T1/index 0). Role passives (damageBonus/eliteDamageBonus/
 * selfIntegrityMultiplier) only apply when `run.rpgActive` is true — an untouched campaign
 * (no Warden stat/skill/trait investment, no equipment purchased) produces byte-identical
 * companion damage/range/targeting-inertness to the pre-RPG baseline; role identity is real
 * but its numeric effect only activates once the player has entered the RPG layer at all
 * (UNIFIED-GDD.md §3.3 frames role passive as fixed-per-companion, but shipping it unconditionally
 * would silently rebalance every existing campaign with zero player action — see decision-log).
 * Damage/range order of operations (balance-sheet.md enforcement_scope): catalog base + additive
 * role/stat bonus, then x equipment tier (still derive-fn step_1), then x companions-wardpact
 * trait multiplier (also step_1, Warden-sourced). Fire-time stance synergy (step_2) is applied
 * per-tick in the fire loop, not baked in here.
 */
function addCompanion(run, companionId, { slot = "BACK", equipment = {} } = {}) {
  if (run.measurementProfile) return;
  const data = COMPANIONS[companionId];
  if (!data || run.companions.some((entry) => entry.companionId === companionId)) return;
  const runtime = deriveCompanionRuntimeStats(companionId, { equipment });
  const rpgActive = Boolean(run.rpgActive);
  const wardenRuntime = run.wardenState?.runtime;
  const wardpactDamageMultiplier = rpgActive ? (wardenRuntime?.companionDamageMultiplier ?? 1) : 1;
  const wardpactRangeMultiplier = rpgActive ? (wardenRuntime?.companionRangeMultiplier ?? 1) : 1;
  const roleDamageBonus = rpgActive ? runtime.damageBonus : 0;
  const selfIntegrityMultiplier = rpgActive ? runtime.selfIntegrityMultiplier : 1;
  const baseDamage = data.damage + (run.rewardIds.includes("abyssal-banner") ? REWARDS["abyssal-banner"].damageBonus : 0);
  const damage = Math.round(baseDamage * (1 + roleDamageBonus) * runtime.weaponTierMultiplier * wardpactDamageMultiplier);
  const range = Math.round(data.range * runtime.trinketTierMultiplier * wardpactRangeMultiplier);
  const maxFormationIntegrity = Math.round(companionFormationIntegrity(data.damage, runtime.wardTierIndex) * selfIntegrityMultiplier);
  run.companions.push(actor(nextId(run, "companion"), "companion", run.commander.x, run.commander.y, maxFormationIntegrity, maxFormationIntegrity, {
    companionId, cooldown: 0, damage, fireTicks: data.fireTicks, range, radius: 300,
    slot, status: "ACTIVE", role: runtime.role, eliteDamageBonus: rpgActive ? runtime.eliteDamageBonus : 0,
  }));
}

function applyOwnedRewards(run, rewardIds) {
  if (run.measurementProfile) return;
  const owned = [...new Set((Array.isArray(rewardIds) ? rewardIds : []).filter((id) => REWARDS[id]))].sort();
  owned.forEach((rewardId) => {
    const reward = REWARDS[rewardId];
    if (reward.companionId) addCompanion(run, reward.companionId);
    if (reward.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - reward.cooldownReduction, 0.4, 1);
    if (reward.gateDamageReduction) run.gateDamageReduction += reward.gateDamageReduction;
    if (reward.integrity) {
      run.gate.maxIntegrity += reward.integrity;
      run.gate.integrity += reward.integrity;
    }
  });
  run.rewardIds = owned;
  if (owned.includes("abyssal-banner")) run.companions.forEach((companion) => { companion.damage += REWARDS["abyssal-banner"].damageBonus; });
}

function spawnEnemy(run, type, elite = false, spawnOpt = {}) {
  const data = ENEMIES[type] || ENEMIES.rusher;
  const hp = scaled(data.hp, run.stage.scale);
  const fallbackPolicy = elite ? "low-hp-focus" : (
    type === "flanker" ? "flank" :
    type === "guardian" ? "elite-escort" :
    type === "ranged" ? "resource-denial" : "gate-pressure"
  );
  const policyId = spawnOpt.policyId || data.policyId || fallbackPolicy;
  const policy = ENEMY_POLICIES[policyId] || ENEMY_POLICIES["gate-pressure"];
  const direction = spawnOpt.direction || "W";
  const laneOffset = spawnOpt.laneOffset || 0;
  const point = elite ? { x: 14000, y: ARENA.gateY } : spawnPoint(direction, laneOffset);
  const enemy = actor(nextId(run, elite ? "elite" : "enemy"), type, point.x, point.y, elite ? hp * 4 : hp, elite ? hp * 4 : hp, {
    class: elite ? "elite" : type,
    speed: elite ? Math.trunc(data.speed * 0.8) : data.speed,
    damage: data.damage,
    xp: elite ? data.xp * 4 : data.xp,
    elite,
    radius: data.radius,
    stageEliteId: elite ? run.stage.eliteId : null,
    rangedCooldown: 0,
    projectileTicks: data.projectileTicks ?? 120,
    projectileRange: data.projectileRange ?? 0,
    attackCooldown: 0,
    attackTicks: data.attackTicks ?? (type === "guardian" ? 90 : type === "ranged" ? 120 : 60),
    policyId,
    policyIntent: policy?.intent || null,
    policyTarget: policy?.target || null,
    spawnDirection: direction,
    route: laneRoute(run.tactics, policyId, laneOffset),
    waypointIndex: 0,
  });
  run.enemies.push(enemy);
  const spawnEvent = emit(run, "ENEMY_SPAWNED", {
    entityId: enemy.id,
    enemyType: type,
    elite,
    spawnDirection: direction,
    route: clone(enemy.route),
  });
  spawnEvent.spawnEventId = spawnEvent.eventId;
  enemy.spawnEventId = spawnEvent.eventId;
  emit(run, "ENEMY_POLICY_SELECTED", {
    entityId: enemy.id,
    spawnEventId: enemy.spawnEventId,
    policyId,
    intent: enemy.policyIntent,
    target: enemy.policyTarget,
    spawnDirection: direction,
  });
}

function spawnBoss(run) {
  const data = BOSSES[run.stage.boss];
  const hp = data.hp;
  const policyId = data.policyId || "low-hp-focus";
  const policy = ENEMY_POLICIES[policyId] || ENEMY_POLICIES["low-hp-focus"];
  const boss = actor(nextId(run, "boss"), "boss", 11000, ARENA.gateY, hp, hp, {
    class: "boss",
    speed: data.speed,
    damage: data.damage,
    xp: data.xp,
    bossId: data.id,
    radius: data.radius,
    attackCooldown: 0,
    attackWindup: false,
    attackTicks: data.attackTicks ?? 90,
    rangedCooldown: 0,
    projectileTicks: data.projectileTicks ?? 120,
    projectileRange: data.projectileRange ?? 0,
    policyId,
    policyIntent: policy?.intent || null,
    policyTarget: policy?.target || null,
    spawnDirection: "W",
    route: laneRoute(run.tactics, policyId, 0),
    waypointIndex: 0,
  });
  run.enemies.push(boss);
  run.bossSpawned = true;
  run.bossSpawnedAt = run.tick;
  if (livingFrontCompanions(run).length) {
    run.rallyTargetId = boss.id;
    run.companions.forEach((companion) => {
      if (companion.status === "ACTIVE") companion.cooldown = Math.trunc(companion.cooldown * (1 - BOSS_RALLY_COOLDOWN_REDUCTION));
    });
    emit(run, "BOSS_RALLY_WINDOW", { bossId: boss.id, entityId: boss.id, cooldownReductionBp: Math.round(BOSS_RALLY_COOLDOWN_REDUCTION * 10000) });
  }
  const spawnEvent = emit(run, "BOSS_SPAWNED", {
    bossId: data.id,
    entityId: boss.id,
    policyId,
    intent: boss.policyIntent,
    spawnDirection: "W",
    cue: eventCue("bossSpawned"),
  });
  spawnEvent.spawnEventId = spawnEvent.eventId;
  boss.spawnEventId = spawnEvent.eventId;
  const arrivalDamage = Math.max(1, Math.trunc(data.damage / 20) - run.gateDamageReduction);
  run.gate.integrity = clamp(run.gate.integrity - arrivalDamage, 0, run.gate.maxIntegrity);
  emit(run, "ENEMY_ATTACK", {
    entityId: boss.id,
    targetId: run.gate.id,
    damage: arrivalDamage,
    policyId: boss.policyId,
    intent: boss.policyIntent,
    objectiveId: "boss-kill",
    arrival: true,
  });
  emit(run, "GATE_BREACHED", {
    enemyId: boss.id,
    damage: arrivalDamage,
    policyId: boss.policyId,
    objectiveId: "boss-kill",
    arrival: true,
  });
}

function getEffectiveRange(run, baseRange) {
  let multiplier = 1.0;
  const tactics = run.tactics;
  if (tactics?.elevation && distanceSquared(run.commander, tactics.elevation) <= 2000 * 2000) {
    multiplier *= (tactics.elevation.rangeMultiplier || 1.25);
  }
  if (run.occupationProgress?.captured || (tactics?.occupation && distanceSquared(run.commander, tactics.occupation) <= tactics.occupation.radius * tactics.occupation.radius)) {
    multiplier *= (tactics?.occupation?.effects?.rangeMultiplier || 1.2);
  }
  return Math.trunc(baseRange * multiplier);
}

function getCommanderSpeed(run) {
  let mult = 1.0;
  const tactics = run.tactics;
  if (run.occupationProgress?.captured || (tactics?.occupation && distanceSquared(run.commander, tactics.occupation) <= tactics.occupation.radius * tactics.occupation.radius)) {
    mult *= (tactics?.occupation?.effects?.moveMultiplier || 1.15);
  }
  return Math.trunc(COMMANDER.speed * mult);
}

/**
 * Composes Warden trait/skill conditional damage multipliers for one hit against `target`
 * (basic attack or skill cast). Static stat/equipment contributions are already baked into
 * `run.commander.basicDamage` at run creation — this only layers the fire-time conditionals
 * that need live run state (integrity ratio, target class, kill-stacks, first-attack flag).
 */
function commanderDamageMultiplier(run, target, { skill = false, firstStrikeFactor = null } = {}) {
  const runtime = run.wardenState?.runtime;
  if (!runtime) return 1;
  let mult = runtime.damageMultiplier;
  if (skill) mult *= runtime.skillDamageMultiplier;
  if (runtime.desperateEcho && run.commander.integrity / run.commander.maxIntegrity <= runtime.desperateEcho.thresholdIntegrityFraction) {
    mult *= runtime.desperateEcho.damageMultiplier;
  }
  if (runtime.eliteHunter && target) {
    const isElite = target.elite || target.class === "boss";
    mult *= isElite ? runtime.eliteHunter.eliteDamageMultiplier : runtime.eliteHunter.normalDamageMultiplier;
  }
  if (runtime.chainReaction && run.wardenState.chainReactionStacks > 0) {
    mult *= 1 + runtime.chainReaction.perKillDamageBonus * run.wardenState.chainReactionStacks;
  }
  if (firstStrikeFactor !== null) mult *= firstStrikeFactor;
  else if (runtime.firstStrikeMultiplier && !run.wardenState.firstStrikeConsumed) {
    mult *= runtime.firstStrikeMultiplier;
    run.wardenState.firstStrikeConsumed = true;
  }
  return mult;
}
/** Consumes the once-per-run first-strike flag exactly once per player action (not once per AoE target) and returns the multiplier factor (1 if unavailable/already consumed). */
function consumeFirstStrikeFactor(run) {
  const runtime = run.wardenState?.runtime;
  if (!runtime?.firstStrikeMultiplier || run.wardenState.firstStrikeConsumed) return 1;
  run.wardenState.firstStrikeConsumed = true;
  return runtime.firstStrikeMultiplier;
}
/** echo-backlash/echo-cascade: chance-based extra hit off raw basicDamage (balance-sheet.md: "추가타 basicDamage*0.5"), independently crit-resolved. */
function maybeFireExtraHit(run, target) {
  const extraHit = run.wardenState?.runtime?.extraHit;
  if (!extraHit) return;
  run.combatRng = rngNext(run.combatRng);
  if (run.combatRng % 10000 >= extraHit.extraHitChance * 10000) return;
  const hit = resolveCritical(run, "basic", Math.round(run.commander.basicDamage * extraHit.extraHitDamageMultiplier));
  fire(run, run.commander, target, hit.damage, "commander", 5, hit);
}
/** wardens-ward (once/run shield-as-heal at <=30% integrity) + echo-warden-awakening (once/run full cooldown reset at <=15% integrity). Called after any commander integrity loss. */
function applyWardenDamageResponse(run) {
  const runtime = run.wardenState?.runtime;
  if (!runtime) return;
  const ratio = run.commander.integrity / run.commander.maxIntegrity;
  if (runtime.wardensWard && !run.wardenState.wardensWardConsumed && ratio <= runtime.wardensWard.thresholdIntegrityFraction) {
    run.wardenState.wardensWardConsumed = true;
    const shield = Math.round(run.commander.maxIntegrity * runtime.wardensWard.shieldFraction);
    run.commander.integrity = clamp(run.commander.integrity + shield, 0, run.commander.maxIntegrity);
    emit(run, "WARDENS_WARD_TRIGGERED", { entityId: run.commander.id, shield, hp: run.commander.integrity });
  }
  if (runtime.awakeningReset && !run.wardenState.awakeningResetConsumed && ratio <= runtime.awakeningReset.thresholdIntegrityFraction) {
    run.wardenState.awakeningResetConsumed = true;
    run.commander.basicCooldown = 0;
    Object.keys(run.commander.cooldowns).forEach((id) => { run.commander.cooldowns[id] = 0; });
    run.companions.forEach((companion) => { companion.cooldown = 0; });
    emit(run, "ECHO_WARDEN_AWAKENING_TRIGGERED", { entityId: run.commander.id });
  }
}
/** wardens-vigil: 0.5%-of-max-integrity/sec regen below 50% integrity. Milli-integrity accumulator (same fractional-carry pattern as `terrainRecovery`) avoids truncating to 0 every tick at 60Hz. */
function applyWardenVigilRegen(run) {
  const vigil = run.wardenState?.runtime?.wardensVigil;
  if (!vigil) return;
  if (run.commander.integrity / run.commander.maxIntegrity > vigil.thresholdIntegrityFraction) return;
  if (run.commander.integrity <= 0) return;
  run.wardenState.vigilRegenRemainderMilli += run.commander.maxIntegrity * vigil.regenPerSecondFraction * 1000 / TICK_RATE;
  const wholeRegen = Math.trunc(run.wardenState.vigilRegenRemainderMilli / 1000);
  if (wholeRegen > 0) {
    run.wardenState.vigilRegenRemainderMilli -= wholeRegen * 1000;
    run.commander.integrity = clamp(run.commander.integrity + wholeRegen, 0, run.commander.maxIntegrity);
  }
}

function orderedTargets(run, origin, range) {
  const maxDistance = getEffectiveRange(run, range) ** 2;
  return run.enemies.filter((entry) => entry.hp > 0 && distanceSquared(entry, origin) <= maxDistance).sort((a, b) => {
    const priority = (TARGET_PRIORITY[a.class] ?? 99) - (TARGET_PRIORITY[b.class] ?? 99);
    if (priority) return priority;
    const distance = distanceSquared(a, origin) - distanceSquared(b, origin);
    if (distance) return distance;
    if (a.hp !== b.hp) return a.hp - b.hp;
    return a.id.localeCompare(b.id);
  });
}

function resolveCritical(run, source, baseDamage) {
  if (baseDamage <= 0) return { source, baseDamage, damage: baseDamage, critical: false };
  const profile = run?.commander?.critProfile || COMMANDER.critProfile;
  if (!profile?.sources?.includes(source)) return { source, baseDamage, damage: baseDamage, critical: false };
  run.combatRng = rngNext(run.combatRng);
  const critical = run.combatRng % 10000 < profile.chanceBp;
  return {
    source,
    baseDamage,
    damage: critical ? Math.trunc(baseDamage * profile.multiplierBp / 10000) : baseDamage,
    critical,
    chanceBp: profile.chanceBp,
    multiplierBp: profile.multiplierBp,
  };
}

function fire(run, source, target, damage, owner, ttl = 5, combat = null) {
  const hit = combat || { source: null, baseDamage: damage, damage, critical: false };
  const projectile = actor(nextId(run, "projectile"), "projectile", source.x, source.y, 1, 1, {
    sourceId: source.id,
    targetId: target.id,
    damage: hit.damage,
    owner,
    ttl,
    combat: hit,
  });
  run.projectiles.push(projectile);
  const firedEvent = emit(run, "WEAPON_FIRED", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    projectileId: projectile.id,
    targetId: target.id,
    targetSpawnEventId: target.spawnEventId || null,
    owner,
    damage: hit.damage,
    baseDamage: hit.baseDamage,
    combatSource: hit.source,
    critical: hit.critical,
    cue: eventCue("weaponFire"),
  });
  firedEvent.spawnEventId = firedEvent.eventId;
  projectile.spawnEventId = firedEvent.eventId;
  projectile.causalRootId = firedEvent.eventId;
  if (hit.critical) emit(run, "CRITICAL_HIT", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    targetId: target.id,
    targetSpawnEventId: target.spawnEventId || null,
    projectileId: projectile.id,
    causalRootId: projectile.causalRootId,
    source: hit.source,
    baseDamage: hit.baseDamage,
    damage: hit.damage,
    chanceBp: hit.chanceBp,
    multiplierBp: hit.multiplierBp,
    cue: eventCue("criticalHit"),
  });
}

function applyItem(run, itemId) {
  if (run.measurementProfile) return;
  const item = ITEMS[itemId];
  if (item.damageBonus) run.commander.basicDamage += item.damageBonus;
  if (item.maxIntegrity) {
    run.gate.maxIntegrity += item.maxIntegrity;
    run.gate.integrity = clamp(run.gate.integrity + item.integrity, 0, run.gate.maxIntegrity);
  }
  if (item.pickupRange) run.commander.pickupRange += item.pickupRange;
  if (item.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - item.cooldownReduction, 0.5, 1);
}

function collectPickups(run) {
  let gained = 0;
  const radius = run.commander.pickupRange;
  run.pickups = run.pickups.filter((pickup) => {
    if (distanceSquared(pickup, run.commander) > radius * radius) return true;
    if (pickup.kind === "echo") {
      const denier = sortedActors(run.enemies).find((enemy) => enemy.policyId === "resource-denial"
        && distanceSquared(enemy, pickup) <= Math.max(enemy.radius + 150, enemy.projectileRange || 0) ** 2);
      if (denier && (pickup.deniedUntil || -1) < run.tick) {
        pickup.deniedUntil = run.tick + 60;
        pickup.deniedBy = denier.id;
        run.progress.echoDenied += pickup.xp;
        const denial = {
          entityId: denier.id,
          enemyId: denier.id,
          pickupId: pickup.id,
          deniedXp: pickup.xp,
          policyId: denier.policyId,
          objectiveId: "echo-recovery",
          deniedUntil: pickup.deniedUntil,
        };
        emit(run, "PICKUP_DENIED", denial);
        emit(run, "ECHO_DENIED", denial);
      }
    }
    if (pickup.kind === "echo" && pickup.deniedUntil >= run.tick) return true;
    if (pickup.kind === "item") {
      applyItem(run, pickup.itemId);
      run.itemIds.push(pickup.itemId);
      run.progress.itemsCollected += 1;
      emit(run, "ITEM_COLLECTED", { itemId: pickup.itemId, cue: eventCue("itemCollected") });
    } else gained += pickup.xp;
    return false;
  });
  run.commander.xp += gained;
}

function makeOffer(run) {
  if (run.measurementProfile) return;
  let seed = run.rng;
  const available = Object.keys(SKILLS).filter((id) => !run.commander.skills.includes(id)).sort();
  const choices = [];
  while (available.length && choices.length < 3) {
    seed = rngNext(seed);
    choices.push(available.splice(seed % available.length, 1)[0]);
  }
  run.rng = seed;
  run.growthOffer = { level: run.commander.level + 1, choices };
  emit(run, "GROWTH_OFFER", { choices: [...choices], objectiveId: "growth", cue: eventCue("growthOffer") });
}

function applySkill(run, skillId) {
  if (run.measurementProfile) return false;
  const skill = SKILLS[skillId];
  if (!skill || !run.growthOffer || !run.growthOffer.choices.includes(skillId)) return false;
  const completedLevelCost = XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1);
  run.commander.skills.push(skillId);
  run.commander.skills.sort();
  run.commander.skillRanks[skillId] = 1;
  run.commander.level = run.growthOffer.level;
  run.progress.skillsLearned += 1;
  if (skill.kind === "passive") {
    run.commander.basicDamage += skill.basicDamage || 0;
    if (skill.maxIntegrity) {
      run.commander.maxIntegrity += skill.maxIntegrity;
      run.commander.integrity += skill.maxIntegrity;
    }
    run.commander.pickupRange += skill.pickupRange || 0;
  } else run.commander.cooldowns[skillId] = 0;
  run.commander.xp -= completedLevelCost;
  run.growthOffer = null;
  emit(run, "SKILL_SELECTED", { skillId, objectiveId: "growth", cue: eventCue("growthOffer") });
  return true;
}

function castSkill(run, skillId) {
  const skill = SKILLS[skillId];
  if (!skill || skill.kind !== "active" || !run.commander.skills.includes(skillId) || run.commander.cooldowns[skillId] > 0) return false;
  const targets = orderedTargets(run, run.commander, skill.radius || COMMANDER.basicRange);
  const castSequence = ++run.castSequence;
  const castInstanceId = `${run.planCommitment.identity}:cast:${castSequence}`;
  const causalRootId = `${run.planCommitment.identity}:causal:${castSequence}`;
  if (skill.integrity) run.commander.integrity = clamp(run.commander.integrity + skill.integrity, 0, run.commander.maxIntegrity);
  if (skill.radius) {
    const firstStrikeFactor = targets.length ? consumeFirstStrikeFactor(run) : 1;
    targets.forEach((entry) => {
      const healthBefore = entry.hp;
      const hit = resolveCritical(run, "skill", Math.round(skill.damage * commanderDamageMultiplier(run, entry, { skill: true, firstStrikeFactor })));
      entry.hp -= hit.damage;
      const healthAfter = entry.hp;
      entry.lastCastInstanceId = castInstanceId;
      entry.lastCausalRootId = causalRootId;
      emit(run, "SKILL_RESOLVED_DAMAGE", {
        sourceId: run.commander.id,
        targetId: entry.id,
        skillId,
        castInstanceId,
        causalRootId,
        targetSpawnEventId: entry.spawnEventId || null,
        baseDamage: hit.baseDamage,
        finalDamage: hit.damage,
        damage: hit.damage,
        critical: hit.critical,
        ...(hit.chanceBp !== undefined ? { chanceBp: hit.chanceBp, multiplierBp: hit.multiplierBp } : {}),
        healthBefore,
        healthAfter,
        simTick: run.tick,
        hit: true,
      });
      if (hit.critical) emit(run, "CRITICAL_HIT", {
        entityId: run.commander.id,
        targetId: entry.id,
        source: hit.source,
        castInstanceId,
        causalRootId,
        targetSpawnEventId: entry.spawnEventId || null,
        baseDamage: hit.baseDamage,
        damage: hit.damage,
        chanceBp: hit.chanceBp,
        multiplierBp: hit.multiplierBp,
        cue: eventCue("criticalHit"),
      });
    });
  } else if (targets[0]) {
    const entry = targets[0];
    const healthBefore = entry.hp;
    const hit = resolveCritical(run, "skill", Math.round(skill.damage * commanderDamageMultiplier(run, entry, { skill: true })));
    entry.hp -= hit.damage;
    const healthAfter = entry.hp;
    entry.lastCastInstanceId = castInstanceId;
    entry.lastCausalRootId = causalRootId;
    emit(run, "SKILL_RESOLVED_DAMAGE", {
      sourceId: run.commander.id,
      targetId: entry.id,
      skillId,
      castInstanceId,
      causalRootId,
      targetSpawnEventId: entry.spawnEventId || null,
      baseDamage: hit.baseDamage,
      finalDamage: hit.damage,
      damage: hit.damage,
      critical: hit.critical,
      ...(hit.chanceBp !== undefined ? { chanceBp: hit.chanceBp, multiplierBp: hit.multiplierBp } : {}),
      healthBefore,
      healthAfter,
      simTick: run.tick,
      hit: true,
    });
    if (hit.critical) emit(run, "CRITICAL_HIT", {
      entityId: run.commander.id,
      targetId: entry.id,
      source: hit.source,
      baseDamage: hit.baseDamage,
      damage: hit.damage,
      castInstanceId,
      causalRootId,
      targetSpawnEventId: entry.spawnEventId || null,
      chanceBp: hit.chanceBp,
      multiplierBp: hit.multiplierBp,
      cue: eventCue("criticalHit"),
    });
  }

  const baseCooldownTicks = run.measurementProfile?.fixtureActiveCooldownTicks ?? skill.cooldown;
  const effectiveCooldownTicks = Math.max(1, Math.trunc(baseCooldownTicks * run.commander.cooldownScale));
  run.commander.cooldowns[skillId] = effectiveCooldownTicks;

  const readyTick = run.tick + effectiveCooldownTicks - 1;

  emit(run, "SKILL_CAST", { skillId, castInstanceId, causalRootId, cue: eventCue("skillCast") });
  emit(run, "SKILL_COOLDOWN_SET", {
    castInstanceId,
    causalRootId,
    skillId,
    baseCooldownTicks,
    effectiveCooldownTicks,
    setTick: run.tick,
    readyTick,
    targetCount: skill.radius ? targets.length : (targets[0] ? 1 : 0),
    simTick: run.tick,
  });
  return true;
}

function applyReward(run, rewardId) {
  if (run.measurementProfile) return;
  if (!run.rewardOffer || !run.rewardOffer.choices.includes(rewardId) || !REWARDS[rewardId]) return;
  const alreadyOwned = run.rewardIds.includes(rewardId);
  if (!alreadyOwned) run.rewardIds.push(rewardId);
  run.rewardOffer = null;
  emit(run, "REWARD_SELECTED", { rewardId, alreadyOwned, cue: eventCue("terminal") });
}


function activeM4Card(run) {
  return run.planCommitment.m4Plan.cards[run.m4.cursor] || null;
}

function processM4Decision(run, payload) {
  const card = activeM4Card(run);
  const cardId = payload?.cardId || payload;
  const decision = payload?.decision;
  if (!card || run.m4.status !== "AVAILABLE" || card.id !== cardId || !["SELECT", "DECLINE"].includes(decision)) {
    emit(run, "M4_CARD_REJECTED", {
      cardId: cardId || null,
      reason: !card ? "M4_CARD_INVENTORY_EXHAUSTED" : "M4_CARD_DECISION_INVALID",
      m4PlanId: run.planCommitment.m4Plan.id,
    });
    return false;
  }
  run.m4.decisions.push({ cardId: card.id, decision, tick: run.tick });
  if (decision === "SELECT") {
    run.m4.selectedCardId = card.id;
    run.m4.status = "RECOVERY_PENDING";
    emit(run, "M4_CARD_SELECTED", {
      cardId: card.id,
      cardCheckpointObjectiveId: card.checkpointObjectiveId,
      m4PlanId: run.planCommitment.m4Plan.id,
      recoveryId: run.planCommitment.m4Plan.recovery.id,
      safeLaneId: run.planCommitment.m4Plan.recovery.safeLaneId,
    });
    return true;
  }
  run.m4.cursor += 1;
  const nextCard = activeM4Card(run);
  if (nextCard) {
    emit(run, "M4_CARD_DECLINED", {
      cardId: card.id,
      nextCardId: nextCard.id,
      m4PlanId: run.planCommitment.m4Plan.id,
    });
    emit(run, "M4_CARD_AVAILABLE", {
      cardId: nextCard.id,
      m4PlanId: run.planCommitment.m4Plan.id,
      inventory: run.m4.inventory.slice(run.m4.cursor),
    });
    return true;
  }
  run.m4.status = "FALLBACK";
  run.m4.fallbackReason = run.planCommitment.m4Plan.fallback.reason;
  emit(run, "M4_FALLBACK", {
    m4PlanId: run.planCommitment.m4Plan.id,
    fallbackId: run.planCommitment.m4Plan.fallback.id,
    reason: run.m4.fallbackReason,
    safeLaneId: run.planCommitment.m4Plan.fallback.safeLaneId,
    objectiveId: run.planCommitment.m4Plan.fallback.objectiveId,
  });
  return true;
}

function updateM4Recovery(run) {
  if (run.m4.status !== "RECOVERY_PENDING"
      || run.objectives.phase !== run.planCommitment.m4Plan.recovery.checkpointObjectiveId) return;
  run.m4.status = "RECOVERED";
  run.m4.recoveredAt = run.tick;
  emit(run, "M4_RECOVERY_CHECKPOINT", {
    cardId: run.m4.selectedCardId,
    m4PlanId: run.planCommitment.m4Plan.id,
    recoveryId: run.planCommitment.m4Plan.recovery.id,
    safeLaneId: run.planCommitment.m4Plan.recovery.safeLaneId,
    objectiveId: run.planCommitment.m4Plan.recovery.checkpointObjectiveId,
  });
}

function processInput(run, input) {
  let accepted = false;
  let rejectionReason = "INPUT_NOT_ACCEPTED";
  if (["MOVE", "SKILL_CAST", "SKILL_SELECTED", "GROWTH_OFFER_SELECTED", "EXTRACT_ELITE"].includes(input.type)) run.commander.engaged = true;
  if (input.type === "MOVE") {
    const direction = typeof input.payload === "string" ? input.payload : input.payload?.octant;
    if (OCTANT_VECTORS[direction]) {
      run.commander.move = direction;
      accepted = true;
    } else rejectionReason = "INVALID_DIRECTION";
  } else if (input.type === "SKILL_SELECTED" || input.type === "GROWTH_OFFER_SELECTED") {
    accepted = applySkill(run, input.payload?.skillId || input.payload);
    rejectionReason = "GROWTH_OFFER_SELECTION_UNAVAILABLE";
  } else if (input.type === "SKILL_CAST") {
    accepted = castSkill(run, input.payload?.skillId || input.payload);
    rejectionReason = "SKILL_NOT_READY_OR_UNAVAILABLE";
  } else if (input.type === "REWARD_SELECTED") {
    const rewardId = input.payload?.rewardId || input.payload;
    if (!run.measurementProfile && run.rewardOffer?.choices.includes(rewardId) && REWARDS[rewardId]) {
      applyReward(run, rewardId);
      accepted = true;
    } else rejectionReason = "REWARD_SELECTION_UNAVAILABLE";
  } else if (input.type === "M4_CARD_DECISION") {
    accepted = processM4Decision(run, input.payload);
    rejectionReason = "M4_CARD_DECISION_INVALID";
  } else if (input.type === "M3_TARGET_PROBE") {
    const phase = input.payload?.phase;
    const target = orderedTargets(run, run.commander, COMMANDER.basicRange)[0] || null;
    if (phase === "LOSS" || phase === "REACQUIRE") {
      emit(run, phase === "LOSS" ? "M3_TARGET_LOSS" : "M3_TARGET_REACQUIRED", {
        probeId: input.payload?.probeId ?? null,
        targetId: target?.id ?? null,
        targetSpawnEventId: target?.spawnEventId ?? null,
        targetAvailable: Boolean(target),
        simTick: run.tick,
      });
      accepted = true;
    } else rejectionReason = "M3_TARGET_PROBE_INVALID";
  } else if (input.type === "EXTRACT_ELITE" && !run.extracted) {
    const candidate = run.eliteCandidate;
    const enemyId = input.payload?.enemyId || input.payload;
    if (candidate && candidate.enemyId === enemyId && (candidate.expiresAt === null || run.tick <= candidate.expiresAt) && run.extractionProgress.completed) {
      run.extracted = true;
      run.progress.extracted += 1;
      addCompanion(run, candidate.prototype);
      emit(run, "ELITE_EXTRACTED", {
        eliteId: candidate.eliteId,
        entityId: enemyId,
        prototype: candidate.prototype,
        companionId: candidate.prototype,
        objectiveId: "echo-recovery",
        extractionPointId: run.extractionProgress.id,
        cue: eventCue("eliteExtracted"),
      });
      accepted = true;
    } else {
      const routeStarted = Boolean(candidate && candidate.enemyId === enemyId && (candidate.expiresAt === null || run.tick <= candidate.expiresAt) && !run.extractionProgress.completed);
      if (routeStarted) run.commander.objectiveRoute = true;
      rejectionReason = !candidate ? "NO_ECHO_CANDIDATE" : !run.extractionProgress.completed ? "EXTRACTION_HOLD_INCOMPLETE" : "WINDOW_EXPIRED";
      emit(run, "EXTRACTION_REJECTED", {
        entityId: enemyId || null,
        objectiveId: "extraction",
        extractionPointId: run.extractionProgress.id,
        reason: rejectionReason,
        routeStarted,
      });
    }
  } else rejectionReason = "INPUT_TYPE_UNSUPPORTED";
  emit(run, accepted ? "INPUT_ACCEPTED" : "INPUT_REJECTED", {
    inputId: input.inputId ?? null,
    inputType: input.type,
    atTick: run.tick,
    reason: accepted ? null : rejectionReason,
  });
  return accepted;
}

function resolveDeaths(run) {
  const dead = run.enemies.filter((entry) => entry.hp <= 0).sort((a, b) => a.id.localeCompare(b.id));
  if (!dead.length) return;
  run.enemies = run.enemies.filter((entry) => entry.hp > 0);
  run.progress.defeated += dead.length;
  dead.forEach((entry) => {
    run.pickups.push(actor(nextId(run, "pickup"), "pickup", entry.x, entry.y, 1, 1, { kind: "echo", xp: entry.xp }));
    const killEvent = emit(run, "ENEMY_DEFEATED", {
      enemyId: entry.id,
      spawnEventId: entry.spawnEventId || null,
      castInstanceId: entry.lastCastInstanceId || null,
      causalRootId: entry.lastCausalRootId || null,
      cue: eventCue("enemyDefeated"),
    });
    killEvent.killEventId = killEvent.eventId;
    entry.killEventId = killEvent.eventId;
    if (entry.elite) {
      const itemId = run.measurementProfile ? null : (STAGE_ITEM_IDS[run.stage.id] || null);
      if (!run.measurementProfile) {
        run.pickups.push(actor(nextId(run, "item"), "item", entry.x + 240, entry.y, 1, 1, { kind: "item", itemId, xp: 0 }));
      }
      run.eliteCandidate = {
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        defeatedAt: run.tick,
        expiresAt: null,
      };
      run.extractionProgress.availableAt = run.tick;
      run.extractionProgress.expiresAt = null;
      run.objectives.echoRecovery.completed = true;
      run.objectives.echoRecovery.completedAt = run.tick;
      emit(run, "ELITE_CANDIDATE_AVAILABLE", {
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        itemId,
        expiresAt: run.eliteCandidate.expiresAt,
        objectiveId: "echo-recovery",
        cutscene: stageCutscene(run.stage).elite,
      });
      const escorts = run.enemies.filter((enemy) => enemy.policyId === "elite-escort" && enemy.escortLeaderId === entry.id);
      if (escorts.length) {
        const escortIds = new Set(escorts.map((enemy) => enemy.id));
        run.enemies = run.enemies.filter((enemy) => !escortIds.has(enemy.id));
        escorts.forEach((enemy) => emit(run, "ESCORT_RETREATED", {
          entityId: enemy.id,
          leaderId: entry.id,
          policyId: enemy.policyId,
          objectiveId: "echo-recovery",
        }));
      }
      emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "echo-recovery" });
    }
  });
  if (run.wardenState?.runtime?.chainReaction) {
    run.wardenState.chainReactionStacks = Math.min(run.wardenState.runtime.chainReaction.maxStacks, run.wardenState.chainReactionStacks + dead.length);
  }
}

function getTargetPosition(run, enemy) {
  while (enemy.waypointIndex < enemy.route.length) {
    const waypoint = enemy.route[enemy.waypointIndex];
    if (distanceSquared(enemy, waypoint) > 400 * 400) return waypoint;
    enemy.waypointIndex += 1;
  }

  if (enemy.policyId === "player-pursuit") return playerSideTarget(run, enemy);
  if (enemy.policyId === "resource-denial") {
    const echoes = run.pickups.filter((pickup) => pickup.kind === "echo").sort((a, b) => {
      const delta = distanceSquared(enemy, a) - distanceSquared(enemy, b);
      return delta || a.id.localeCompare(b.id);
    });
    return echoes[0] || run.commander;
  }
  if (enemy.policyId === "elite-escort") {
    const leader = sortedActors(run.enemies).find((entry) => entry.hp > 0 && entry.id !== enemy.id && (entry.elite || entry.class === "boss"));
    if (leader) {
      if (enemy.escortLeaderId !== leader.id) {
        enemy.escortLeaderId = leader.id;
        emit(run, "ESCORT_LEADER_ACQUIRED", {
          entityId: enemy.id,
          leaderId: leader.id,
          policyId: enemy.policyId,
          objectiveId: run.objectives.phase,
        });
      }
      return { x: Math.max(0, leader.x - 500), y: leader.y };
    }
    enemy.escortLeaderId = null;
    return run.gate;
  }
  if (enemy.policyId === "low-hp-focus") {
    const gateRatio = run.gate.integrity / run.gate.maxIntegrity;
    const commanderRatio = run.commander.integrity / run.commander.maxIntegrity;
    return commanderRatio < gateRatio ? playerSideTarget(run, enemy) : run.gate;
  }
  if (enemy.policyId === "flank") {
    return distanceSquared(enemy, run.commander) < distanceSquared(enemy, run.gate) ? playerSideTarget(run, enemy) : run.gate;
  }
  return run.gate;
}

function pressureTarget(run, enemy) {
  if (enemy.policyId === "player-pursuit" || enemy.policyId === "resource-denial") return playerSideTarget(run, enemy);
  if (enemy.policyId === "low-hp-focus" || enemy.policyId === "flank") {
    return distanceSquared(enemy, run.commander) < distanceSquared(enemy, run.gate) ? playerSideTarget(run, enemy) : run.gate;
  }
  return run.gate;
}

function moveEnemies(run) {
  const breachedIds = new Set();
  const chokepath = run.tactics?.chokepath;

  run.enemies.forEach((enemy) => {
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= 1;
    if (enemy.rangedCooldown > 0) enemy.rangedCooldown -= 1;

    let speed = enemy.class === "boss" && enemy.attackWindup ? 0 : enemy.speed;
    if (chokepath && Math.abs(enemy.x - chokepath.x) <= chokepath.halfWidth) speed = Math.trunc(speed * 0.85);

    const targetPosition = getTargetPosition(run, enemy);
    const from = { x: enemy.x, y: enemy.y };
    const dx = targetPosition.x - enemy.x;
    const dy = targetPosition.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && speed > 0) {
      const movement = Math.min(Math.max(1, Math.trunc(speed / TICK_RATE)), distance);
      enemy.x = clamp(Math.round(enemy.x + dx / distance * movement), 0, ARENA.width);
      enemy.y = clamp(Math.round(enemy.y + dy / distance * movement), 0, ARENA.height);
    }
    if (enemy.x !== from.x || enemy.y !== from.y) {
      emit(run, "MOVE", {
        entityId: enemy.id,
        from,
        to: { x: enemy.x, y: enemy.y },
        policyId: enemy.policyId,
        intent: enemy.policyIntent,
        waypointId: enemy.route[enemy.waypointIndex]?.id || null,
      });
    }

    if (enemy.policyId === "resource-denial") {
      const denialRange = Math.max(enemy.radius + 150, enemy.projectileRange || 0);
      const denied = run.pickups.find((pickup) => pickup.kind === "echo"
        && distanceSquared(enemy, pickup) <= denialRange ** 2);
      if (denied && (denied.deniedUntil || -1) < run.tick) {
        denied.deniedUntil = run.tick + 60;
        denied.deniedBy = enemy.id;
        run.progress.echoDenied += denied.xp;
        const denial = {
          entityId: enemy.id,
          enemyId: enemy.id,
          pickupId: denied.id,
          deniedXp: denied.xp,
          policyId: enemy.policyId,
          objectiveId: "echo-recovery",
          deniedUntil: denied.deniedUntil,
        };
        emit(run, "PICKUP_DENIED", denial);
        emit(run, "ECHO_DENIED", denial);
      }
    }

    if (enemy.policyId === "elite-escort" && enemy.escortLeaderId) return;
    const target = pressureTarget(run, enemy);
    const targetDistance = Math.sqrt(distanceSquared(enemy, target));
    const pressureReleaseTick = run.objectives.phase === "echo-recovery"
      ? run.objectives.gateDefense.completedAt + ECHO_RECOVERY_PRESSURE_GRACE_TICKS
      : run.stage.gateTicks - (GATE_PRESSURE_RELEASE_LEAD[enemy.policyId] || 0);
    const commanderPressureDelayed = run.commander.engaged
      && target.id === "commander"
      && (run.objectives.phase === "gate-defense" || run.objectives.phase === "echo-recovery")
      && run.tick < pressureReleaseTick;
    if (commanderPressureDelayed) {
      const rangedReady = enemy.projectileRange > 0
        && targetDistance <= enemy.projectileRange
        && enemy.rangedCooldown <= 0;
      const contactReady = targetDistance <= enemy.radius + (target.radius || 0)
        && enemy.attackCooldown <= 0;
      if (rangedReady || contactReady) {
        if (rangedReady) enemy.rangedCooldown = enemy.projectileTicks;
        else enemy.attackCooldown = enemy.attackTicks;
        emit(run, "ENEMY_PRESSURE_DELAYED", {
          entityId: enemy.id,
          targetId: target.id,
          policyId: enemy.policyId,
          objectiveId: run.objectives.phase,
          releaseTick: pressureReleaseTick,
        });
      }
      return;
    }
    if (enemy.class === "boss" && run.tick < run.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS) return;
    if (enemy.projectileRange > 0 && targetDistance <= enemy.projectileRange && enemy.rangedCooldown <= 0) {
      const damage = target.id === "gate" ? Math.max(1, enemy.damage - Math.trunc(run.gateDamageReduction / 2)) : (target.id === "commander" ? Math.round(enemy.damage * run.commander.incomingDamageMultiplier) : enemy.damage);
      fire(run, enemy, target, damage, enemy.id, Math.max(1, Math.trunc(enemy.projectileTicks / 12)));
      enemy.rangedCooldown = enemy.projectileTicks;
      return;
    }

    const contactRange = enemy.radius + (target.radius || 0);
    if (enemy.class === "boss") {
      if (enemy.attackWindup) {
        if (enemy.attackCooldown > 0) return;
        if (targetDistance > contactRange) {
          enemy.attackWindup = false;
          emit(run, "BOSS_ATTACK_CANCELLED", { entityId: enemy.id, targetId: target.id, policyId: enemy.policyId });
          return;
        }
      } else {
        if (targetDistance > contactRange) return;
        enemy.attackWindup = true;
        enemy.attackCooldown = enemy.attackTicks;
        emit(run, "BOSS_ATTACK_TELEGRAPHED", {
          entityId: enemy.id,
          targetId: target.id,
          policyId: enemy.policyId,
          windupTicks: enemy.attackTicks,
        });
        return;
      }
    } else if (targetDistance > contactRange || enemy.attackCooldown > 0) return;
    let commanderDamage = 0;
    let gateDamage = 0;
    let companionDamage = 0;
    if (target.id === "gate") {
      gateDamage = Math.max(0, enemy.damage - run.gateDamageReduction);
    } else if (target.kind === "companion") {
      companionDamage = enemy.damage;
    } else {
      commanderDamage = enemy.damage;
      const guardingGate = (run.objectives.phase === "gate-defense" || run.extracted)
        && distanceSquared(run.commander, run.gate) <= (run.gate.radius + COMMANDER.basicRange) ** 2;
      if (guardingGate) {
        const commanderRatio = run.commander.integrity / run.commander.maxIntegrity;
        const gateRatio = run.gate.integrity / run.gate.maxIntegrity;
        if (gateRatio > commanderRatio) {
          gateDamage = Math.max(0, commanderDamage - run.gateDamageReduction);
          commanderDamage = 0;
        }
      }
    }
    const damage = target.id === "gate" ? gateDamage : (target.kind === "companion" ? companionDamage : Math.round(commanderDamage * run.commander.incomingDamageMultiplier));
    if (enemy.class === "boss") enemy.attackWindup = false;
    else enemy.attackCooldown = enemy.attackTicks;
    emit(run, "ENEMY_ATTACK", {
      entityId: enemy.id,
      targetId: target.id,
      damage,
      policyId: enemy.policyId,
      intent: enemy.policyIntent,
    });
    if (target.id === "gate") {
      run.gate.integrity = clamp(run.gate.integrity - damage, 0, run.gate.maxIntegrity);
      emit(run, "GATE_BREACHED", { enemyId: enemy.id, damage, policyId: enemy.policyId });
      if (enemy.class !== "boss" && !enemy.elite) breachedIds.add(enemy.id);
    } else if (target.kind === "companion") {
      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      emit(run, "COMPANION_DAMAGED", { enemyId: enemy.id, entityId: target.id, companionId: target.companionId, damage, hp: target.hp, maxHp: target.maxHp, policyId: enemy.policyId });
      if (target.hp <= 0 && target.status === "ACTIVE") {
        target.status = "DOWNED";
        emit(run, "COMPANION_DOWNED", { entityId: target.id, companionId: target.companionId, policyId: enemy.policyId });
      }
    } else {
      run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      emit(run, "COMMANDER_DAMAGED", {
        enemyId: enemy.id,
        damage,
        hp: run.commander.integrity,
        maxHp: run.commander.maxIntegrity,
        policyId: enemy.policyId,
      });
      applyWardenDamageResponse(run);
      if (gateDamage > 0) {
        run.gate.integrity = clamp(run.gate.integrity - gateDamage, 0, run.gate.maxIntegrity);
        emit(run, "GATE_BREACHED", {
          enemyId: enemy.id,
          damage: gateDamage,
          policyId: enemy.policyId,
          objectiveId: "gate-defense",
          interceptedFor: "commander",
        });
      }
    }
  });

  if (breachedIds.size) run.enemies = run.enemies.filter((enemy) => !breachedIds.has(enemy.id));
}

function updateObjectivePhase(run) {
  const objectives = run.objectives;
  if (!objectives.gateDefense.completed
      && run.tick >= run.stage.gateTicks
      && run.waveIndex >= run.waveSchedule.length
      && !run.enemies.some((enemy) => !enemy.elite && enemy.class !== "boss")) {
    objectives.gateDefense.completed = true;
    objectives.gateDefense.completedAt = run.tick;
    emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "gate-defense" });
  }
  if (!objectives.growth.completed && run.progress.skillsLearned > 0) {
    objectives.growth.completed = true;
    objectives.growth.completedAt = run.tick;
    emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "growth" });
  }
  objectives.occupation.completed = run.occupationProgress.captured;
  objectives.extraction.completed = run.extractionProgress.completed;
  const ordered = [
    ["gate-defense", objectives.gateDefense],
    ["echo-recovery", objectives.echoRecovery],
    ["growth", objectives.growth],
    ["occupation", objectives.occupation],
    ["extraction", objectives.extraction],
    ["boss-kill", objectives.bossKill],
  ];
  const nextPhase = ordered.find(([, objective]) => !objective.completed)?.[0] || "complete";
  if (nextPhase !== objectives.phase) {
    const previousPhase = objectives.phase;
    objectives.phase = nextPhase;
    emit(run, "OBJECTIVE_PHASE_CHANGED", { objectiveId: nextPhase, previousObjectiveId: previousPhase });
    run.objectivePressure.phase = nextPhase;
    run.objectivePressure.phaseStartedAt = run.tick;
  }
  updateM4Recovery(run);
}

function applyFixedRate(run, key, ratePerSecond) {
  run.terrainRemainders[key] = (run.terrainRemainders[key] || 0) + Math.max(0, ratePerSecond || 0);
  const value = Math.trunc(run.terrainRemainders[key] / TICK_RATE);
  run.terrainRemainders[key] %= TICK_RATE;
  return value;
}
function processObjectivePressure(run) {
  const pressure = run.objectivePressure;
  if (!pressure || run.objectives.phase === "complete") return;
  const elapsed = run.tick - pressure.phaseStartedAt;
  if (elapsed >= OBJECTIVE_PRESSURE_GRACE_TICKS
      && (elapsed - OBJECTIVE_PRESSURE_GRACE_TICKS) % OBJECTIVE_PRESSURE_INTERVAL_TICKS === 0) {
    pressure.pulses += 1;
    const damage = Math.min(OBJECTIVE_PRESSURE_DAMAGE, run.gate.integrity);
    run.gate.integrity -= damage;
    emit(run, "OBJECTIVE_PRESSURE_PULSE", {
      objectiveId: run.objectives.phase,
      pulse: pressure.pulses,
      targetId: "gate",
      damage,
      deadlineTick: pressure.deadlineTick,
    });
  }
  if (run.tick >= pressure.deadlineTick && run.gate.integrity > 0) {
    pressure.pulses += 1;
    const damage = run.gate.integrity;
    run.gate.integrity = 0;
    emit(run, "OBJECTIVE_PRESSURE_DEADLINE", {
      objectiveId: run.objectives.phase,
      pulse: pressure.pulses,
      targetId: "gate",
      damage,
      deadlineTick: pressure.deadlineTick,
    });
  }
}
function processTerrainEffects(run) {
  const tactics = run.tactics;
  if (!tactics) return;
  updateObjectivePhase(run);

  if (tactics.hazard) {
    const hazard = tactics.hazard;
    const exposed = [run.commander, ...run.enemies].filter((entity) => distanceSquared(entity, hazard) <= hazard.radius ** 2);
    exposed.forEach((entity) => {
      const damage = applyFixedRate(run, `hazard:${entity.id}`, hazard.damagePerSecond);
      if (!damage) return;
      if (entity.id === "commander") {
        run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      } else entity.hp -= damage;
      emit(run, "HAZARD_DAMAGE", {
        entityId: entity.id,
        hazardId: hazard.id,
        damage,
        hp: entity.id === "commander" ? run.commander.integrity : entity.hp,
        maxHp: entity.id === "commander" ? run.commander.maxIntegrity : entity.maxHp,
      });
    });
  }

  const occupation = tactics.occupation;
  if (occupation && run.objectives.growth.completed) {
    const inZone = distanceSquared(run.commander, occupation) <= occupation.radius ** 2;
    const contested = run.enemies.some((enemy) => distanceSquared(enemy, occupation) <= occupation.radius ** 2);
    if (!run.occupationProgress.captured && inZone && !contested) {
      run.occupationProgress.holdTicks = Math.min(run.occupationProgress.maxHoldTicks, run.occupationProgress.holdTicks + 1);
      if (run.occupationProgress.holdTicks % 60 === 0 && run.occupationProgress.holdTicks < run.occupationProgress.maxHoldTicks) {
        emit(run, "OCCUPATION_PROGRESS", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          holdTicks: run.occupationProgress.holdTicks,
          maxHoldTicks: run.occupationProgress.maxHoldTicks,
          contested: false,
        });
      }
      if (run.occupationProgress.holdTicks >= run.occupationProgress.maxHoldTicks) {
        run.occupationProgress.captured = true;
        run.occupationProgress.capturedAt = run.tick;
        if (run.eliteCandidate && run.extractionProgress.expiresAt === null) {
          const windowTicks = tactics.extraction?.windowTicks || 600;
          run.extractionProgress.expiresAt = run.tick + windowTicks;
          run.eliteCandidate.expiresAt = run.extractionProgress.expiresAt;
          emit(run, "EXTRACTION_WINDOW_OPENED", {
            objectiveId: "extraction",
            extractionPointId: tactics.extraction?.id || null,
            expiresAt: run.extractionProgress.expiresAt,
            windowTicks,
          });
        }
        emit(run, "OCCUPATION_CAPTURED", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          effects: clone(occupation.effects || {}),
          cue: eventCue("occupationCaptured"),
        });
      }
    } else if (!run.occupationProgress.captured && run.occupationProgress.holdTicks > 0) {
      run.occupationProgress.holdTicks = 0;
      emit(run, "OCCUPATION_INTERRUPTED", {
        objectiveId: "occupation",
        occupationPointId: occupation.id,
        contested,
      });
    }

    if (inZone) {
      const recovery = applyFixedRate(run, "occupation-recovery", occupation.effects?.recoveryPerSecond || 0);
      if (recovery) {
        const previousCommander = run.commander.integrity;
        const previousGate = run.gate.integrity;
        const commanderBudget = Math.max(0, Math.trunc(run.commander.maxIntegrity / 4) - run.terrainRecovery.commander);
        const gateBudget = Math.max(0, Math.trunc(run.gate.maxIntegrity / 4) - run.terrainRecovery.gate);
        run.commander.integrity = clamp(run.commander.integrity + Math.min(recovery, commanderBudget), 0, run.commander.maxIntegrity);
        run.gate.integrity = clamp(run.gate.integrity + Math.min(recovery, gateBudget), 0, run.gate.maxIntegrity);
        const commanderRecovery = run.commander.integrity - previousCommander;
        const gateRecovery = run.gate.integrity - previousGate;
        run.terrainRecovery.commander += commanderRecovery;
        run.terrainRecovery.gate += gateRecovery;
        emit(run, "TERRAIN_RECOVERY", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          recovery,
          commanderRecovery,
          gateRecovery,
          commanderTotal: run.terrainRecovery.commander,
          gateTotal: run.terrainRecovery.gate,
          capRatio: run.terrainRecovery.capRatio,
        });
      }
    }
  }

  const extraction = tactics.extraction;
  const extractionOpen = extraction
    && run.objectives.occupation.completed
    && run.extractionProgress.availableAt !== null
    && run.tick <= run.extractionProgress.expiresAt;
  if (extractionOpen && !run.extractionProgress.completed) {
    const inZone = distanceSquared(run.commander, extraction) <= extraction.radius ** 2;
    const contested = run.enemies.some((enemy) => distanceSquared(enemy, extraction) <= extraction.radius ** 2);
    if (inZone && !contested) {
      run.extractionProgress.holdTicks = Math.min(run.extractionProgress.maxHoldTicks, run.extractionProgress.holdTicks + 1);
      if (run.extractionProgress.holdTicks % 30 === 0 && run.extractionProgress.holdTicks < run.extractionProgress.maxHoldTicks) {
        emit(run, "EXTRACTION_PROGRESS", {
          objectiveId: "extraction",
          extractionPointId: extraction.id,
          holdTicks: run.extractionProgress.holdTicks,
          maxHoldTicks: run.extractionProgress.maxHoldTicks,
        });
      }
      if (run.extractionProgress.holdTicks >= run.extractionProgress.maxHoldTicks) {
        run.extractionProgress.completed = true;
        run.extractionProgress.completedAt = run.tick;
        run.extracted = true;
        run.commander.objectiveRoute = false;
        run.progress.extracted += 1;
        addCompanion(run, run.eliteCandidate.prototype);
        emit(run, "EXTRACTION_COMPLETED", {
          objectiveId: "extraction",
          extractionPointId: extraction.id,
          cue: eventCue("extractionReady"),
        });
        emit(run, "ELITE_EXTRACTED", {
          eliteId: run.eliteCandidate.eliteId,
          entityId: run.eliteCandidate.enemyId,
          prototype: run.eliteCandidate.prototype,
          companionId: run.eliteCandidate.prototype,
          objectiveId: "echo-recovery",
          extractionPointId: extraction.id,
          cue: eventCue("eliteExtracted"),
        });
      }
    } else if (run.extractionProgress.holdTicks > 0) {
      run.extractionProgress.holdTicks = 0;
      emit(run, "EXTRACTION_INTERRUPTED", {
        objectiveId: "extraction",
        extractionPointId: extraction.id,
        contested,
      });
    }
  } else if (extraction && run.extractionProgress.availableAt !== null
      && run.extractionProgress.expiresAt !== null
      && run.tick > run.extractionProgress.expiresAt
      && !run.extractionProgress.completed
      && !run.extractionProgress.failed) {
    run.extractionProgress.failed = true;
    run.commander.objectiveRoute = false;
    emit(run, "OBJECTIVE_FAILED", { objectiveId: "extraction", extractionPointId: extraction.id });
  }
  updateObjectivePhase(run);
}

function tick(run) {
  run.tick += 1;
  run.events = [];
  while (run.inputs.length && run.inputs[0].at <= run.tick) processInput(run, run.inputs.shift());
  if (run.growthOffer) return;

  const commanderFrom = { x: run.commander.x, y: run.commander.y };
  const commanderSpeed = getCommanderSpeed(run);
  let moveDirection = run.commander.move;
  let routeTarget = null;
  if (run.commander.objectiveRoute && run.objectives.phase === "occupation") routeTarget = run.tactics.occupation;
  else if (run.commander.objectiveRoute && run.objectives.phase === "extraction") routeTarget = run.tactics.extraction;
  else if (run.extracted || run.extractionProgress.failed) run.commander.objectiveRoute = false;

  if (routeTarget) {
    const dx = routeTarget.x - run.commander.x;
    const dy = routeTarget.y - run.commander.y;
    const distance = Math.hypot(dx, dy);
    const holdRadius = Math.max(0, routeTarget.radius - 100);
    if (distance > holdRadius) {
      const movement = Math.min(Math.max(1, Math.trunc(commanderSpeed / TICK_RATE)), distance - holdRadius);
      run.commander.x = clamp(Math.round(run.commander.x + dx / distance * movement), 0, ARENA.width);
      run.commander.y = clamp(Math.round(run.commander.y + dy / distance * movement), 0, ARENA.height);
      moveDirection = "OBJECTIVE_ROUTE";
    }
  } else {
    const vector = OCTANT_VECTORS[run.commander.move];
    run.commander.x = clamp(run.commander.x + Math.trunc(vector.x * commanderSpeed / 1000 / TICK_RATE), 0, ARENA.width);
    run.commander.y = clamp(run.commander.y + Math.trunc(vector.y * commanderSpeed / 1000 / TICK_RATE), 0, ARENA.height);
  }
  if (run.commander.x !== commanderFrom.x || run.commander.y !== commanderFrom.y) {
    emit(run, "MOVE", {
      entityId: run.commander.id,
      from: commanderFrom,
      to: { x: run.commander.x, y: run.commander.y },
      direction: moveDirection,
      speed: commanderSpeed,
      objectiveId: routeTarget ? run.objectives.phase : null,
      cue: run.tick % 12 === 0 ? eventCue("movementStep") : null,
    });
  }

  Object.keys(run.commander.cooldowns).forEach((id) => {
    if (run.commander.cooldowns[id] > 0) {
      run.commander.cooldowns[id] -= 1;
      if (run.commander.cooldowns[id] === 0) {
        emit(run, "SKILL_COOLDOWN_READY", {
          skillId: id,
          readyTick: run.tick,
          simTick: run.tick,
        });
      }
    }
  });
  applyWardenVigilRegen(run);


  while (run.waveIndex < run.waveSchedule.length && run.waveSchedule[run.waveIndex].at <= run.tick) {
    const wave = run.waveSchedule[run.waveIndex];
    emit(run, "WAVE_VARIANT_STARTED", {
      waveIndex: wave.waveIndex,
      pattern: wave.pattern,
      slot: wave.slot,
      alternativeId: wave.alternativeId,
      count: wave.count,
      composition: clone(wave.composition),
      selectionId: wave.selectionId,
      policyId: wave.policyId,
      spawnDirection: wave.direction,
      variantId: run.waveVariant.id,
    });
    let spawnIndex = 0;
    wave.composition.forEach(({ enemy, count }) => {
      const policyId = enemy === wave.type ? wave.policyId : (ENEMIES[enemy]?.policyId || wave.policyId);
      for (let index = 0; index < count; index += 1) {
        spawnEnemy(run, enemy, false, {
          direction: wave.direction,
          laneOffset: wave.laneOffset + spawnIndex * 200,
          policyId,
        });
        spawnIndex += 1;
      }
    });
    run.waveIndex += 1;
  }

  processTerrainEffects(run);
  if (!run.eliteSpawned && run.objectives.gateDefense.completed) {
    spawnEnemy(run, run.stage.eliteKind, true, { policyId: "low-hp-focus", direction: "W" });
    spawnEnemy(run, "guardian", false, { policyId: "elite-escort", direction: "W", laneOffset: 500 });
    run.eliteSpawned = true;
  }

  run.projectiles.forEach((projectile) => { projectile.ttl -= 1; });
  const impacts = run.projectiles.filter((projectile) => projectile.ttl <= 0).sort((a, b) => a.id.localeCompare(b.id));
  run.projectiles = run.projectiles.filter((projectile) => projectile.ttl > 0);
  impacts.forEach((projectile) => {
    let damage = projectile.damage;
    let hit = true;
    let guardedBy = null;
    let targetSpawnEventId = null;
    if (projectile.targetId === "gate") {
      run.gate.integrity = clamp(run.gate.integrity - damage, 0, run.gate.maxIntegrity);
    } else if (projectile.targetId === "commander") {
      run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      applyWardenDamageResponse(run);
    } else if (run.companions.some((entry) => entry.id === projectile.targetId)) {
      const target = run.companions.find((entry) => entry.id === projectile.targetId);
      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      emit(run, "COMPANION_DAMAGED", { entityId: target.id, companionId: target.companionId, damage, hp: target.hp, maxHp: target.maxHp, owner: projectile.owner });
      if (target.hp <= 0 && target.status === "ACTIVE") {
        target.status = "DOWNED";
        emit(run, "COMPANION_DOWNED", { entityId: target.id, companionId: target.companionId, owner: projectile.owner });
      }
    } else {
      const target = run.enemies.find((entry) => entry.id === projectile.targetId);
      if (!target) hit = false;
      else {
        const escort = sortedActors(run.enemies).find((entry) => entry.policyId === "elite-escort"
          && entry.escortLeaderId === target.id
          && distanceSquared(entry, target) <= 1600 ** 2);
        if (escort) {
          guardedBy = escort.id;
          damage = Math.max(1, Math.trunc(damage * 3 / 4));
        }
        target.hp -= damage;
        targetSpawnEventId = target.spawnEventId || null;
        target.lastCausalRootId = projectile.causalRootId;
      }
    }
    emit(run, "PROJECTILE_IMPACT", {
      projectileId: projectile.id,
      sourceId: projectile.sourceId,
      causalRootId: projectile.causalRootId,
      projectileSpawnEventId: projectile.spawnEventId,
      targetId: projectile.targetId,
      owner: projectile.owner,
      targetSpawnEventId,
      damage: hit ? damage : 0,
      hit,
      guardedBy,
      cue: hit ? eventCue("impactHit") : null,
    });
  });

  run.commander.basicCooldown -= 1;
  if (run.commander.basicCooldown <= 0) {
    const target = orderedTargets(run, run.commander, COMMANDER.basicRange)[0];
    if (target) {
      const mult = commanderDamageMultiplier(run, target, { skill: false });
      const hit = resolveCritical(run, "basic", Math.round(run.commander.basicDamage * mult));
      fire(run, run.commander, target, hit.damage, "commander", 5, hit);
      maybeFireExtraHit(run, target);
    }
    run.commander.basicCooldown = run.commander.basicTicks || COMMANDER.basicCooldown;
  }

  run.companions.forEach((companion) => {
    companion.x = run.commander.x;
    companion.y = run.commander.y;
    if (companion.status !== "ACTIVE") return;
    companion.cooldown -= 1;
    if (companion.cooldown <= 0) {
      let target = null;
      if (run.rallyTargetId) {
        const boss = run.enemies.find((entry) => entry.id === run.rallyTargetId && entry.hp > 0);
        if (boss && distanceSquared(companion, boss) <= getEffectiveRange(run, companion.range) ** 2) target = boss;
      }
      if (!target) target = orderedTargets(run, companion, companion.range)[0];
      if (target) {
        const isElite = target.elite || target.class === "boss";
        const synergyActive = companion.slot === "BACK" && livingFrontCompanions(run).length > 0;
        const mult = (isElite ? 1 + (companion.eliteDamageBonus || 0) : 1) * (synergyActive ? 1 + BACK_ROW_SYNERGY_DAMAGE_BONUS : 1);
        fire(run, companion, target, Math.round(companion.damage * mult), companion.companionId);
      }
      companion.cooldown = companion.fireTicks;
    }
  });

  moveEnemies(run);
  resolveDeaths(run);
  collectPickups(run);
  updateObjectivePhase(run);
  processObjectivePressure(run);

  if (!run.bossSpawned
      && run.objectives.extraction.completed
      && run.tick >= run.stage.gateTicks
      && !run.enemies.some((enemy) => enemy.class !== "boss")) {
    spawnBoss(run);
  }

  if (run.gate.integrity <= 0 || run.commander.integrity <= 0 || run.extractionProgress.failed) {
    run.terminal = "DEFEAT";
    emit(run, "TERMINAL", {
      outcome: "DEFEAT",
      planIdentity: run.planCommitment.identity,
      objectiveId: run.extractionProgress.failed ? "extraction" : "survival",
      cutscene: stageCutscene(run.stage).defeat,
      cue: eventCue("terminal"),
    });
  } else if (run.bossSpawned && !run.enemies.some((entry) => entry.class === "boss")) {
    run.objectives.bossKill.completed = true;
    run.objectives.bossKill.completedAt = run.tick;
    run.objectives.phase = "complete";
    run.terminal = run.stage.id === "gate-zenith" ? "FINAL_COMPLETION" : "VICTORY";
    run.progress.achievements.push(`stage-clear:${run.stage.id}`);
    run.rewardOffer = { choices: [...(STAGE_REWARD_IDS[run.stage.id] || [])] };
    emit(run, "OBJECTIVE_COMPLETED", {
      objectiveId: "boss-kill",
      bossTtkTicks: run.bossSpawnedAt === null ? null : run.tick - run.bossSpawnedAt,
    });
    emit(run, "TERMINAL", {
      outcome: run.terminal,
      planIdentity: run.planCommitment.identity,
      objectiveId: "boss-kill",
      bossTtkTicks: run.bossSpawnedAt === null ? null : run.tick - run.bossSpawnedAt,
      rewardChoices: [...run.rewardOffer.choices],
      cutscene: stageCutscene(run.stage).victory,
      cue: eventCue("terminal"),
    });
  }

  const itemCollected = run.events.some((event) => event.type === "ITEM_COLLECTED");
  if (!run.terminal && !run.growthOffer && !itemCollected
      && run.objectives.gateDefense.completed
      && run.objectives.echoRecovery.completed
      && run.commander.integrity * 10 > run.commander.maxIntegrity
      && run.commander.xp >= (XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1))) {
    makeOffer(run);
  }
}

/** Creates a new run. `seed` is coerced to an unsigned xorshift32 state (zero becomes one). */
export function createDefenseRun({ stageId, seed = 1, companionLoadout = [], rewardIds = [], measurementProfileId = null, wardenProgress = null, wardenEquipment = {}, companionEquipment = {}, formation = {} } = {}) {
  const stage = stageFor(stageId);
  const stagePlan = stagePlanFor(stage);
  const unsignedSeed = (seed >>> 0) || 1;
  const tactics = stagePlan.mapPlan.tactics;
  const { schedule, nextRng, variantId } = buildWaveSchedule(stage, unsignedSeed, tactics, stagePlan.wavePlan);
  const planIdentity = `${stagePlan.mapPlan.id}:${stagePlan.wavePlan.id}:seed:${unsignedSeed}`;
  const surpriseTable = tactics.surpriseTable;
  const surpriseRng = rngNext(unsignedSeed ^ 0x6d2b79f5);
  const rawSurprise = surpriseTable ? {
    tableId: surpriseTable.id,
    rollBp: surpriseRng % 10000,
    outcome: surpriseRng % 10000 < surpriseTable.chanceBp
      ? surpriseTable.outcomes[rngNext(surpriseRng) % surpriseTable.outcomes.length]
      : null,
  } : null;
  const loreSurprise = rawSurprise && {
    tableId: rawSurprise.tableId,
    rollBp: rawSurprise.rollBp,
    outcomeId: rawSurprise.outcome?.id || null,
    text: rawSurprise.outcome?.text || null,
  };

  const profileKey = typeof measurementProfileId === "string" ? measurementProfileId.toLowerCase() : null;
  const measurementProfile = profileKey === Catalog.QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID
    ? Catalog.QA_MULTI_SKILL_MEASUREMENT_FIXTURE
    : profileKey ? MEASUREMENT_PROFILES[profileKey] : null;

  const maxIntegrity = measurementProfile ? measurementProfile.maxIntegrity : GATE.maxIntegrity;
  const basicTicks = measurementProfile ? measurementProfile.basicCooldownTicks : COMMANDER.basicCooldown;
  const critProfile = measurementProfile ? clone(measurementProfile.critProfile) : clone(COMMANDER.critProfile);
  const initialSkills = measurementProfile
    ? [...(measurementProfile.activeSkillIds || [measurementProfile.activeSkillId])]
    : [];
  const initialSkillRanks = Object.fromEntries(initialSkills.map((skillId) => [skillId, 1]));
  const initialCooldowns = Object.fromEntries(initialSkills.map((skillId) => [skillId, 0]));

  const state = {
    version: SNAPSHOT_VERSION,
    tick: 0,
    seed: unsignedSeed,
    rng: nextRng,
    combatRng: rngNext(unsignedSeed ^ 0x9e3779b9),
    nextId: 0,
    eventSequence: 0,
    castSequence: 0,
    stage,
    tactics,
    planCommitment: {
      version: 1,
      identity: planIdentity,
      mapPlan: stagePlan.mapPlan,
      wavePlan: stagePlan.wavePlan,
      m4Plan: stagePlan.m4Plan,
      waveVariantId: variantId,
    },
    ...(measurementProfile ? { measurementProfileId: measurementProfile.id, measurementProfile } : {}),
    waveSchedule: schedule,
    waveVariant: {
      version: 1,
      id: variantId,
      planId: stagePlan.wavePlan.id,
      seed: unsignedSeed,
      schedule: clone(schedule),
    },
    waveIndex: 0,
    inputs: [],
    inputSequence: 0,
    events: [],
    enemies: [],
    projectiles: [],
    pickups: [],
    companions: [],
    itemIds: [],
    rewardIds: [],
    rewardOffer: null,
    loreSurprise: null,
    m4: {
      planId: stagePlan.m4Plan.id,
      inventory: stagePlan.m4Plan.cards.map((card) => card.id),
      cursor: 0,
      status: "AVAILABLE",
      selectedCardId: null,
      recoveredAt: null,
      fallbackReason: null,
      decisions: [],
    },
    progress: { defeated: 0, extracted: 0, echoDenied: 0, itemsCollected: 0, skillsLearned: 0, achievements: [] },
    gateDamageReduction: 0,
    terrainRecovery: { commander: 0, gate: 0, capRatio: 0.25 },
    rallyTargetId: null,
    wardenState: null,
    gate: { id: "gate", x: ARENA.gateX, y: ARENA.gateY, integrity: GATE.maxIntegrity, maxIntegrity: GATE.maxIntegrity, radius: GATE.radius },
    commander: {
      id: "commander",
      x: 19000,
      y: ARENA.gateY,
      radius: COMMANDER.radius,
      integrity: maxIntegrity,
      maxIntegrity,
      xp: 0,
      level: 1,
      move: "IDLE",
      moveSpeed: COMMANDER.speed,
      basicDamage: measurementProfile ? measurementProfile.basicDamage : COMMANDER.basicDamage,
      basicTicks,
      basicCooldown: 0,
      objectiveRoute: false,
      engaged: false,
      pickupRange: 12000,
      incomingDamageMultiplier: 1,
      cooldownScale: 1,
      critProfile,
      skills: initialSkills,
      skillRanks: initialSkillRanks,
      cooldowns: initialCooldowns,
    },
    occupationProgress: {
      id: tactics.occupation?.id || "occ-1",
      holdTicks: 0,
      maxHoldTicks: tactics.occupation?.holdTicks || 180,
      captured: false,
      capturedAt: null,
    },
    extractionProgress: {
      id: tactics.extraction?.id || "ext-1",
      holdTicks: 0,
      maxHoldTicks: 120,
      completed: false,
      completedAt: null,
      failed: false,
      availableAt: null,
      expiresAt: null,
      windowTicks: tactics.extraction?.windowTicks || 720,
    },
    objectives: {
      version: 1,
      phase: "gate-defense",
      gateDefense: { completed: false, completedAt: null, requiredTick: stage.gateTicks },
      echoRecovery: { completed: false, completedAt: null },
      growth: { completed: false, completedAt: null },
      occupation: { completed: false, pointId: tactics.occupation?.id || null },
      extraction: { completed: false, pointId: tactics.extraction?.id || null },
      bossKill: { completed: false, completedAt: null },
    },
    objectivePressure: {
      phase: "gate-defense",
      phaseStartedAt: 0,
      deadlineTick: stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET,
      pulses: 0,
    },
    terrainRemainders: {},
    eliteSpawned: false,
    eliteCandidate: null,
    extracted: false,
    bossSpawned: false,
    bossSpawnedAt: null,
    growthOffer: null,
    terminal: null,
  };
  if (!measurementProfile) {
    const hasWardenInvestment = wardenProgress && (Object.keys(wardenProgress.statPoints || {}).length || (wardenProgress.skillTreeIds || []).length || (wardenProgress.traitIds || []).length);
    const hasEquipmentInvestment = Object.values(wardenEquipment).some((tier) => tier > 0) || Object.values(companionEquipment).some((eq) => Object.values(eq || {}).some((tier) => tier > 0));
    const rpgActive = Boolean(hasWardenInvestment || hasEquipmentInvestment);
    state.rpgActive = rpgActive;
    if (wardenProgress) {
      const runtime = deriveWardenRuntimeStats({ ...wardenProgress, equipment: wardenEquipment });
      state.wardenState = {
        runtime, firstStrikeConsumed: false, wardensWardConsumed: false, awakeningResetConsumed: false,
        chainReactionStacks: 0, vigilRegenRemainderMilli: 0,
      };
      state.commander.basicDamage = Math.round((state.commander.basicDamage + runtime.basicDamageBonus) * runtime.weaponTierMultiplier);
      state.commander.maxIntegrity = Math.round((state.commander.maxIntegrity + runtime.maxIntegrityBonus) * runtime.maxIntegrityMultiplier * runtime.wardTierMultiplier);
      state.commander.integrity = state.commander.maxIntegrity;
      state.commander.pickupRange = Math.round((state.commander.pickupRange + runtime.pickupRangeBonus) * runtime.pickupRangeMultiplier * runtime.trinketTierMultiplier);
      state.commander.cooldownScale = clamp(state.commander.cooldownScale - runtime.cooldownReduction, 0.4, 1);
      state.commander.critProfile.chanceBp = clamp(state.commander.critProfile.chanceBp + runtime.critChanceBonusBp, 0, 10000);
    }
    const formationMap = resolveFormation(companionLoadout, formation);
    formationMap.forEach((slot, id) => addCompanion(state, id, { slot, equipment: companionEquipment[id] || {} }));
    applyOwnedRewards(state, rewardIds);
    if (rpgActive) {
      let incomingMultiplier = state.commander.incomingDamageMultiplier;
      if (state.wardenState?.runtime?.incomingDamageMultiplier) incomingMultiplier *= state.wardenState.runtime.incomingDamageMultiplier;
      state.companions.forEach((companion) => {
        if (companion.status !== "ACTIVE") return;
        if (companion.role === "vanguard") incomingMultiplier *= COMPANION_ROLES.vanguard.commanderIncomingDamageMultiplier;
        if (companion.role === "support") {
          state.commander.pickupRange = Math.round(state.commander.pickupRange * COMPANION_ROLES.support.commanderPickupRangeMultiplier);
          state.commander.cooldownScale = clamp(state.commander.cooldownScale - COMPANION_ROLES.support.commanderCooldownReduction, 0.4, 1);
        }
      });
      state.commander.incomingDamageMultiplier = incomingMultiplier;
    }
  }
  emit(state, "STAGE_STARTED", {
    stageId,
    planIdentity,
    mapPlanId: stagePlan.mapPlan.id,
    wavePlanId: stagePlan.wavePlan.id,
    m4PlanId: stagePlan.m4Plan.id,
    cutscene: stageCutscene(stage).intro,
    cue: eventCue("stageStart"),
  });
  if (loreSurprise) state.loreSurprise = emit(state, "LORE_SURPRISE_RESOLVED", loreSurprise);
  emit(state, "M4_CARD_AVAILABLE", {
    cardId: state.m4.inventory[0],
    m4PlanId: stagePlan.m4Plan.id,
    inventory: [...state.m4.inventory],
  });
  return freeze(state);
}

/** Queues one input for the next simulation tick and returns a new run. */
export function queueInput(run, type, payload = null) {
  if (!run || !["MOVE", "SKILL_CAST", "SKILL_SELECTED", "GROWTH_OFFER_SELECTED", "REWARD_SELECTED", "EXTRACT_ELITE", "M4_CARD_DECISION", "M3_TARGET_PROBE"].includes(type)) return run;
  const next = clone(run);
  next.inputSequence = (next.inputSequence || 0) + 1;
  next.inputs.push({ at: next.tick + 1, inputId: `${next.planCommitment.identity}:input:${next.inputSequence}`, type, payload: clone(payload) });
  return freeze(next);
}

/** Advances exactly `steps` 60 Hz ticks, stopping early for growth selection or a terminal outcome. */
export function advanceDefenseRun(run, steps = 1) {
  if (!run || !Number.isInteger(steps) || steps < 0) throw new RangeError("steps must be a non-negative integer");
  const next = clone(run);
  if (!next.terrainRecovery) next.terrainRecovery = { commander: 0, gate: 0, capRatio: 0.25 };
  if (next.commander && typeof next.commander.objectiveRoute !== "boolean") next.commander.objectiveRoute = false;
  if (next.commander && typeof next.commander.engaged !== "boolean") next.commander.engaged = false;
  if (!Number.isInteger(next.combatRng)) next.combatRng = rngNext(next.seed ^ 0x9e3779b9);
  if (!next.objectivePressure) {
    next.objectivePressure = {
      phase: next.objectives?.phase || "gate-defense",
      phaseStartedAt: next.tick,
      deadlineTick: next.stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET,
      pulses: 0,
    };
  }
  next.enemies?.forEach((enemy) => {
    if (enemy.class === "boss" && typeof enemy.attackWindup !== "boolean") enemy.attackWindup = false;
  });
  for (let index = 0; index < steps && !next.terminal; index += 1) {
    if (next.growthOffer) {
      const selections = next.inputs.filter((input) => input.type === "GROWTH_OFFER_SELECTED" || input.type === "SKILL_SELECTED");
      if (!selections.length) break;
      next.inputs = next.inputs.filter((input) => input.type !== "GROWTH_OFFER_SELECTED" && input.type !== "SKILL_SELECTED");
      selections.forEach((input) => processInput(next, input));
      if (next.growthOffer) break;
    }
    tick(next);
    if (next.growthOffer) break;
  }
  if (next.terminal && next.rewardOffer) {
    const selections = next.inputs.filter((input) => input.type === "REWARD_SELECTED");
    next.inputs = next.inputs.filter((input) => input.type !== "REWARD_SELECTED");
    selections.forEach((input) => processInput(next, input));
  }
  return freeze(next);
}

/** Returns a detached, frozen renderer-friendly snapshot with every live actor. */
export function getRunSnapshot(run) {
  return freeze(clone({
    version: SNAPSHOT_VERSION,
    eventVersion: EVENT_VERSION,
    tick: run.tick,
    stageId: run.stage.id,
    stageName: run.stage.name,
    bossName: run.stage.bossName,
    terminal: run.terminal,
    plan: {
      identity: run.planCommitment.identity,
      mapPlanId: run.planCommitment.mapPlan.id,
      wavePlanId: run.planCommitment.wavePlan.id,
      m4PlanId: run.planCommitment.m4Plan.id,
      waveVariantId: run.planCommitment.waveVariantId,
    },
    ...(run.measurementProfileId ? { measurementProfileId: run.measurementProfileId } : {}),
    gate: run.gate,
    gateDamageReduction: run.gateDamageReduction,
    terrainRecovery: run.terrainRecovery,
    commander: run.commander,
    rallyTargetId: run.rallyTargetId,
    wardenState: run.wardenState ? { chainReactionStacks: run.wardenState.chainReactionStacks, firstStrikeConsumed: run.wardenState.firstStrikeConsumed, wardensWardConsumed: run.wardenState.wardensWardConsumed, awakeningResetConsumed: run.wardenState.awakeningResetConsumed } : null,
    growthOffer: run.growthOffer,
    rewardOffer: run.rewardOffer,
    itemIds: run.itemIds,
    rewardIds: run.rewardIds,
    progress: run.progress,
    loreSurprise: run.loreSurprise,
    m4: run.m4,
    eliteCandidate: run.eliteCandidate,
    extracted: run.extracted,
    bossSpawned: run.bossSpawned,
    cutscene: stageCutscene(run.stage),
    events: run.events.map((event) => ({ version: EVENT_VERSION, ...event })),
    enemies: sortedActors(run.enemies),
    projectiles: sortedActors(run.projectiles),
    pickups: sortedActors(run.pickups),
    companions: sortedActors(run.companions),
    occupationProgress: run.occupationProgress,
    extractionProgress: run.extractionProgress,
    tactics: run.tactics,
    stageLayout: {
      chokepath: run.tactics.chokepath,
      flank: run.tactics.flank,
      elevation: run.tactics.elevation,
      hazard: run.tactics.hazard,
      occupationPoint: run.tactics.occupation,
      extractionPoint: run.tactics.extraction,
    },
    waveVariant: run.waveVariant,
    objectives: run.objectives,
    objectivePressure: run.objectivePressure,
    objectiveProgress: {
      phase: run.objectives.phase,
      occupation: run.occupationProgress,
      extraction: run.extractionProgress,
    },
  }));
}

/** Returns a stable JSON digest suitable for equal-run and replay comparisons. */
export function getRunDigest(run) { return JSON.stringify(getRunSnapshot(run)); }

/** True only after integrity failure or boss-stage completion. */
export function isTerminalRun(run) { return Boolean(run?.terminal); }

export { TICK_RATE };
