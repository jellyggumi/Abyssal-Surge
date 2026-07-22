/**
 * Deterministic, renderer-neutral 60 Hz defense-survivor simulation.
 * Every state-changing API returns a new frozen run; callers may retain old runs.
 */
import { ARENA, BOSSES, COMMANDER, COMPANIONS, ENEMIES, GATE, OCTANT_VECTORS, SKILLS, STAGE_BY_ID, TARGET_PRIORITY, TICK_RATE, XP_GROWTH } from "./defense-catalog.js";

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

function addCompanion(run, companionId) {
  const data = COMPANIONS[companionId];
  if (!data || run.companions.some((entry) => entry.companionId === companionId)) return;
  run.companions.push(actor(nextId(run, "companion"), "companion", run.commander.x, run.commander.y, 1, 1, {
    companionId, cooldown: 0, damage: data.damage, fireTicks: data.fireTicks, range: data.range,
  }));
}
function spawnEnemy(run, type, elite = false) {
  const data = ENEMIES[type];
  const hp = scaled(data.hp, run.stage.scale);
  run.enemies.push(actor(nextId(run, elite ? "elite" : "enemy"), type, elite ? 15000 : 12000, 1000 + (run.nextId * 791) % 10000, elite ? hp * 4 : hp, elite ? hp * 4 : hp, {
    class: elite ? "elite" : type, speed: elite ? 0 : data.speed, damage: data.damage, xp: elite ? data.xp * 4 : data.xp, elite,
    stageEliteId: elite ? run.stage.eliteId : null, rangedCooldown: data.projectileTicks ?? 0, projectileRange: data.projectileRange ?? 0,
  }));
}
function spawnBoss(run) {
  const data = BOSSES[run.stage.boss];
  const hp = scaled(data.hp, run.stage.scale);
  run.enemies.push(actor(nextId(run, "boss"), "boss", 11000, ARENA.gateY, hp, hp, { class: "boss", speed: data.speed, damage: data.damage, xp: data.xp, bossId: data.id }));
  run.bossSpawned = true;
  run.events.push({ tick: run.tick, type: "BOSS_SPAWNED", bossId: data.id });
}
function orderedTargets(run, origin, range) {
  const maxDistance = range * range;
  return run.enemies.filter((entry) => entry.hp > 0 && distanceSquared(entry, origin) <= maxDistance).sort((a, b) => {
    const priority = TARGET_PRIORITY[a.class] - TARGET_PRIORITY[b.class];
    if (priority) return priority;
    const distance = distanceSquared(a, origin) - distanceSquared(b, origin);
    if (distance) return distance;
    if (a.hp !== b.hp) return a.hp - b.hp;
    return a.id.localeCompare(b.id);
  });
}
function fire(run, source, target, damage, owner, ttl = 5) {
  run.projectiles.push(actor(nextId(run, "projectile"), "projectile", source.x, source.y, 1, 1, { targetId: target.id, damage, owner, ttl }));
}
function collectPickups(run) {
  let gained = 0;
  const radius = run.commander.pickupRange;
  run.pickups = run.pickups.filter((pickup) => {
    if (distanceSquared(pickup, run.commander) > radius * radius) return true;
    gained += pickup.xp;
    return false;
  });
  run.commander.xp += gained;
}
function makeOffer(run) {
  let seed = run.rng;
  const available = Object.keys(SKILLS).filter((id) => !run.commander.skills.includes(id)).sort();
  const choices = [];
  while (available.length && choices.length < 3) {
    seed = rngNext(seed);
    choices.push(available.splice(seed % available.length, 1)[0]);
  }
  run.rng = seed;
  run.growthOffer = { level: run.commander.level + 1, choices };
  run.events.push({ tick: run.tick, type: "GROWTH_OFFER", choices: [...choices] });
}
function applySkill(run, skillId) {
  if (!run.growthOffer || !run.growthOffer.choices.includes(skillId)) return;
  const skill = SKILLS[skillId];
  run.commander.skills.push(skillId);
  run.commander.skills.sort();
  run.commander.skillRanks[skillId] = 1;
  run.commander.level = run.growthOffer.level;
  if (skill.kind === "passive") {
    run.commander.basicDamage += skill.basicDamage || 0;
    if (skill.maxIntegrity) {
      run.commander.maxIntegrity += skill.maxIntegrity;
      run.commander.integrity += skill.maxIntegrity;
    }
    run.commander.pickupRange += skill.pickupRange || 0;
  } else run.commander.cooldowns[skillId] = 0;
  run.commander.xp -= XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1);
  run.growthOffer = null;
  run.events.push({ tick: run.tick, type: "SKILL_SELECTED", skillId });
}
function castSkill(run, skillId) {
  const skill = SKILLS[skillId];
  if (!skill || skill.kind !== "active" || !run.commander.skills.includes(skillId) || run.commander.cooldowns[skillId] > 0) return;
  const targets = orderedTargets(run, run.commander, skill.radius || COMMANDER.basicRange);
  if (skill.integrity) run.commander.integrity = clamp(run.commander.integrity + skill.integrity, 0, run.commander.maxIntegrity);
  if (skill.radius) targets.forEach((entry) => { entry.hp -= skill.damage; });
  else if (targets[0]) targets[0].hp -= skill.damage;
  run.commander.cooldowns[skillId] = skill.cooldown;
  run.events.push({ tick: run.tick, type: "SKILL_CAST", skillId });
}
function processInput(run, input) {
  if (input.type === "MOVE") {
    const direction = typeof input.payload === "string" ? input.payload : input.payload?.octant;
    if (OCTANT_VECTORS[direction]) run.commander.move = direction;
  } else if (input.type === "SKILL_SELECTED") applySkill(run, input.payload?.skillId || input.payload);
  else if (input.type === "SKILL_CAST") castSkill(run, input.payload?.skillId || input.payload);
  else if (input.type === "EXTRACT_ELITE" && !run.extracted) {
    const candidate = run.eliteCandidate;
    const enemyId = input.payload?.enemyId || input.payload;
    if (candidate && candidate.enemyId === enemyId && run.tick <= candidate.expiresAt) {
      run.extracted = true;
      addCompanion(run, candidate.prototype);
      run.events.push({
        tick: run.tick,
        type: "ELITE_EXTRACTED",
        eliteId: candidate.eliteId,
        entityId: enemyId,
        prototype: candidate.prototype,
        companionId: candidate.prototype,
      });
    }
  }
}
function resolveDeaths(run) {
  const dead = run.enemies.filter((entry) => entry.hp <= 0);
  if (!dead.length) return;
  run.enemies = run.enemies.filter((entry) => entry.hp > 0);
  dead.forEach((entry) => {
    run.pickups.push(actor(nextId(run, "pickup"), "pickup", entry.x, entry.y, 1, 1, { xp: entry.xp }));
    run.events.push({ tick: run.tick, type: "ENEMY_DEFEATED", enemyId: entry.id });
    if (entry.elite) {
      run.eliteCandidate = {
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        defeatedAt: run.tick,
        expiresAt: run.tick + 600,
      };
      run.events.push({
        tick: run.tick,
        type: "ELITE_CANDIDATE_AVAILABLE",
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        expiresAt: run.eliteCandidate.expiresAt,
      });
    }
  });
}
function moveEnemies(run) {
  const breaches = [];
  run.enemies.forEach((enemy) => {
    if (enemy.class === "boss") {
      const step = Math.max(1, Math.trunc(enemy.speed / TICK_RATE));
      const dx = run.commander.x - enemy.x;
      const dy = run.commander.y - enemy.y;
      if (Math.abs(dx) >= Math.abs(dy)) enemy.x = clamp(enemy.x + clamp(dx, -step, step), 0, ARENA.width);
      else enemy.y = clamp(enemy.y + clamp(dy, -step, step), 0, ARENA.height);
      return;
    }
    const gateDistance = ARENA.gateX - enemy.x;
    if (enemy.class === "ranged" && gateDistance > enemy.radius && gateDistance <= enemy.projectileRange) {
      enemy.rangedCooldown -= 1;
      if (enemy.rangedCooldown <= 0) {
        fire(run, enemy, { id: "gate" }, enemy.damage, enemy.id, 1);
        enemy.rangedCooldown = ENEMIES.ranged.projectileTicks;
      }
    }
    enemy.x += Math.min(Math.trunc(enemy.speed / TICK_RATE), Math.max(0, gateDistance));
    if (enemy.x >= ARENA.gateX - enemy.radius) breaches.push(enemy);
  });
  if (breaches.length) {
    const breachedIds = new Set(breaches.map((enemy) => enemy.id));
    breaches.forEach((enemy) => run.events.push({ tick: run.tick, type: "GATE_BREACHED", enemyId: enemy.id, damage: enemy.damage }));
    run.gate.integrity = clamp(run.gate.integrity - breaches.reduce((total, enemy) => total + enemy.damage, 0), 0, run.gate.maxIntegrity);
    run.enemies = run.enemies.filter((enemy) => !breachedIds.has(enemy.id));
  }
}
function tick(run) {
  run.tick += 1;
  run.events = [];
  while (run.inputs.length && run.inputs[0].at <= run.tick) processInput(run, run.inputs.shift());
  if (run.growthOffer) return;
  const vector = OCTANT_VECTORS[run.commander.move];
  run.commander.x = clamp(run.commander.x + Math.trunc(vector.x * run.commander.moveSpeed / 1000 / TICK_RATE), 0, ARENA.width);
  run.commander.y = clamp(run.commander.y + Math.trunc(vector.y * run.commander.moveSpeed / 1000 / TICK_RATE), 0, ARENA.height);
  Object.keys(run.commander.cooldowns).forEach((id) => { if (run.commander.cooldowns[id] > 0) run.commander.cooldowns[id] -= 1; });
  if (!run.eliteSpawned && run.tick >= Math.trunc(run.stage.gateTicks / 2)) { spawnEnemy(run, run.stage.eliteKind, true); run.eliteSpawned = true; }
  run.stage.waves.forEach(([at, type, count]) => { if (at === run.tick - 1) for (let index = 0; index < count; index += 1) spawnEnemy(run, type); });
  if (!run.bossSpawned && run.tick >= run.stage.gateTicks && !run.enemies.some((enemy) => !enemy.elite)) spawnBoss(run);
  run.projectiles.forEach((projectile) => { projectile.ttl -= 1; });
  const impacts = run.projectiles.filter((projectile) => projectile.ttl <= 0);
  run.projectiles = run.projectiles.filter((projectile) => projectile.ttl > 0);
  impacts.forEach((projectile) => {
    if (projectile.targetId === "gate") run.gate.integrity = clamp(run.gate.integrity - projectile.damage, 0, run.gate.maxIntegrity);
    else {
      const target = run.enemies.find((entry) => entry.id === projectile.targetId);
      if (target) target.hp -= projectile.damage;
    }
  });
  run.commander.basicCooldown -= 1;
  if (run.commander.basicCooldown <= 0) {
    const target = orderedTargets(run, run.commander, COMMANDER.basicRange)[0];
    if (target) fire(run, run.commander, target, run.commander.basicDamage, "commander");
    run.commander.basicCooldown = COMMANDER.basicCooldown;
  }
  run.companions.forEach((companion) => {
    companion.x = run.commander.x;
    companion.y = run.commander.y;
    companion.cooldown -= 1;
    if (companion.cooldown <= 0) {
      const target = orderedTargets(run, companion, companion.range)[0];
      if (target) fire(run, companion, target, companion.damage, companion.companionId);
      companion.cooldown = companion.fireTicks;
    }
  });
  moveEnemies(run);
  resolveDeaths(run);
  collectPickups(run);
  if (!run.growthOffer && run.commander.xp >= (XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1))) makeOffer(run);
  if (run.gate.integrity <= 0) {
    run.terminal = "DEFEAT";
    run.events.push({ tick: run.tick, type: "TERMINAL", outcome: "DEFEAT" });
  } else if (run.bossSpawned && !run.enemies.some((entry) => entry.class === "boss")) {
    run.terminal = run.stage.id === "gate-zenith" ? "FINAL_COMPLETION" : "VICTORY";
    run.events.push({ tick: run.tick, type: "TERMINAL", outcome: run.terminal });
  }
}
/** Creates a new run. `seed` is coerced to an unsigned xorshift32 state (zero becomes one). */
export function createDefenseRun({ stageId, seed = 1, companionLoadout = [] } = {}) {
  const stage = stageFor(stageId);
  const state = {
    version: 1, tick: 0, rng: (seed >>> 0) || 1, nextId: 0, stage, inputs: [], events: [], enemies: [], projectiles: [], pickups: [], companions: [],
    gate: { id: "gate", x: ARENA.gateX, y: ARENA.gateY, integrity: GATE.maxIntegrity, maxIntegrity: GATE.maxIntegrity, radius: GATE.radius },
    eliteSpawned: false, eliteCandidate: null, extracted: false, bossSpawned: false, growthOffer: null, terminal: null,
    commander: { id: "commander", x: 19000, y: ARENA.gateY, radius: COMMANDER.radius, integrity: GATE.maxIntegrity, maxIntegrity: GATE.maxIntegrity, xp: 0, level: 1, move: "IDLE", moveSpeed: COMMANDER.speed, basicDamage: COMMANDER.basicDamage, basicTicks: COMMANDER.basicCooldown, basicCooldown: 0, pickupRange: 12000, skills: [], skillRanks: {}, cooldowns: {} },
  };
  validLoadout(companionLoadout).forEach((id) => addCompanion(state, id));
  return freeze(state);
}
/** Queues one input for the next simulation tick and returns a new run. */
export function queueInput(run, type, payload = null) {
  if (!run || !["MOVE", "SKILL_CAST", "SKILL_SELECTED", "EXTRACT_ELITE"].includes(type)) return run;
  const next = clone(run);
  next.inputs.push({ at: next.tick + 1, type, payload: clone(payload) });
  return freeze(next);
}
/** Advances exactly `steps` 60 Hz ticks, stopping early for growth selection or a terminal outcome. */
export function advanceDefenseRun(run, steps = 1) {
  if (!run || !Number.isInteger(steps) || steps < 0) throw new RangeError("steps must be a non-negative integer");
  const next = clone(run);
  for (let index = 0; index < steps && !next.terminal; index += 1) {
    if (next.growthOffer) {
      const selections = next.inputs.filter((input) => input.type === "SKILL_SELECTED");
      if (!selections.length) break;
      next.inputs = next.inputs.filter((input) => input.type !== "SKILL_SELECTED");
      selections.forEach((input) => processInput(next, input));
      if (next.growthOffer) break;
    }
    tick(next);
    if (next.growthOffer) break;
  }
  return freeze(next);
}
/** Returns a detached, frozen renderer-friendly snapshot with every live actor. */
export function getRunSnapshot(run) {
  return freeze(clone({ tick: run.tick, stageId: run.stage.id, stageName: run.stage.name, bossName: run.stage.bossName, terminal: run.terminal, gate: run.gate, commander: run.commander, growthOffer: run.growthOffer, eliteCandidate: run.eliteCandidate, extracted: run.extracted, bossSpawned: run.bossSpawned, events: run.events, enemies: sortedActors(run.enemies), projectiles: sortedActors(run.projectiles), pickups: sortedActors(run.pickups), companions: sortedActors(run.companions) }));
}
/** Returns a stable JSON digest suitable for equal-run and replay comparisons. */
export function getRunDigest(run) { return JSON.stringify(getRunSnapshot(run)); }
/** True only after integrity failure or boss-stage completion. */
export function isTerminalRun(run) { return Boolean(run?.terminal); }
export { TICK_RATE };
