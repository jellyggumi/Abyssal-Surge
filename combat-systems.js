// Pure, deterministic combat contracts shared by renderers and state code.
// This module intentionally has no browser, renderer, or time dependencies.

function freezeDeep(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}

const EMPTY_LIST = Object.freeze([]);

function finiteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function normalizedKey(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (value && typeof value === "object") {
    return normalizedKey(value.id ?? value.type ?? value.pattern ?? value.event ?? value.kind);
  }
  return "";
}

/**
 * Enemy movement and targeting patterns. Every entry is immutable and can be
 * passed directly to resolveEnemyPattern, or referenced by its catalog key.
 */
export const ENEMY_AI_PATTERNS = freezeDeep({
  rusher: {
    id: "rusher",
    role: "pressure",
    movement: {
      mode: "advance",
      vector: "direct",
      speedMultiplier: 1.25,
      preferredDistance: 0
    },
    targeting: {
      mode: "nearest",
      priority: ["commander", "nearest"],
      tieBreak: "distance-then-id"
    }
  },
  flanker: {
    id: "flanker",
    role: "disruption",
    movement: {
      mode: "orbit",
      vector: "lateral",
      speedMultiplier: 1.05,
      preferredDistance: 2.5
    },
    targeting: {
      mode: "isolated",
      priority: ["isolated", "weakest"],
      tieBreak: "isolation-then-distance-then-id"
    }
  },
  ranged: {
    id: "ranged",
    role: "attrition",
    movement: {
      mode: "kite",
      vector: "away",
      speedMultiplier: 0.85,
      preferredDistance: 6,
      retreatDistance: 3
    },
    targeting: {
      mode: "priority",
      priority: ["commander", "lowest-health"],
      tieBreak: "health-then-distance-then-id"
    }
  },
  guardian: {
    id: "guardian",
    role: "defense",
    movement: {
      mode: "guard",
      vector: "objective",
      speedMultiplier: 0.75,
      preferredDistance: 2
    },
    targeting: {
      mode: "protect",
      priority: ["objective", "commander", "nearest"],
      tieBreak: "objective-then-distance-then-id"
    }
  }
});

// Short alias for callers that do not need the AI qualifier.
export const ENEMY_PATTERNS = ENEMY_AI_PATTERNS;

const INVALID_ENEMY_PATTERN = freezeDeep({
  accepted: false,
  patternId: null,
  movement: {
    mode: "hold",
    vector: "none",
    speedMultiplier: 0,
    preferredDistance: 0
  },
  targeting: {
    mode: "none",
    priority: EMPTY_LIST,
    tieBreak: "none"
  },
  targetId: null,
  targetCount: 0,
  reason: "invalid-pattern"
});

function targetRecord(value, index) {
  if (!value || typeof value !== "object") return null;
  const rawId = value.id ?? value.targetId ?? value.name;
  if (typeof rawId !== "string" && typeof rawId !== "number") return null;
  const id = String(rawId);
  const distance = Math.max(0, finiteNumber(value.distance, Number.POSITIVE_INFINITY));
  const health = Math.max(0, finiteNumber(value.health, Number.POSITIVE_INFINITY));
  return {
    id,
    distance,
    health,
    commander: value.isCommander === true || value.role === "commander" || value.type === "commander",
    isolated: value.isIsolated === true || value.isolated === true,
    objective: value.isObjective === true || value.objective === true || value.role === "objective" || value.type === "objective",
    protected: value.isProtected === true || value.protected === true,
    sourceIndex: index
  };
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCandidates(patternId, a, b) {
  let rankA = 1;
  let rankB = 1;
  if (patternId === "rusher") {
    rankA = a.commander ? 0 : 1;
    rankB = b.commander ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    if (a.distance !== b.distance) return a.distance - b.distance;
  } else if (patternId === "flanker") {
    rankA = a.isolated ? 0 : 1;
    rankB = b.isolated ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    if (a.health !== b.health) return a.health - b.health;
    if (a.distance !== b.distance) return a.distance - b.distance;
  } else if (patternId === "ranged") {
    rankA = a.commander ? 0 : 1;
    rankB = b.commander ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    if (a.health !== b.health) return a.health - b.health;
    if (a.distance !== b.distance) return a.distance - b.distance;
  } else {
    rankA = a.objective ? 0 : a.protected ? 1 : 2;
    rankB = b.objective ? 0 : b.protected ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;
    if (a.distance !== b.distance) return a.distance - b.distance;
  }
  const idOrder = compareText(a.id, b.id);
  return idOrder || a.sourceIndex - b.sourceIndex;
}

function selectTarget(patternId, context) { // ponytail: O(N) linear scan to avoid map-filter-sort allocations
  const source = context && Array.isArray(context.targets) ? context.targets : EMPTY_LIST;
  let best = null;
  let count = 0;
  for (let i = 0; i < source.length; i += 1) {
    const raw = source[i];
    const candidate = targetRecord(raw, i);
    if (!candidate) continue;
    count += 1;
    if (best === null) {
      best = candidate;
    } else if (compareCandidates(patternId, candidate, best) < 0) {
      best = candidate;
    }
  }
  return { target: best, count };
}

/**
 * Resolve a catalog pattern into renderer/state-friendly directives.
 * `context.targets` is optional; target records are read-only and selected by
 * a stable comparator (priority, health/distance, then lexical id).
 */
export function resolveEnemyPattern(pattern, context = {}) {
  const id = normalizedKey(pattern);
  const definition = ENEMY_AI_PATTERNS[id];
  if (!definition) return INVALID_ENEMY_PATTERN;

  const safeContext = context && typeof context === "object" ? context : {};
  const selected = selectTarget(id, safeContext);
  let flankSide = "left";
  if (safeContext.side === "right" || safeContext.lane === "right") flankSide = "right";
  const movementDirective = Object.freeze({
    ...definition.movement,
    ...(id === "flanker" ? { side: flankSide } : {})
  });
  const targetingDirective = Object.freeze({
    ...definition.targeting,
    candidateCount: selected.count
  });
  const contextTargetId = safeContext.targetId;
  const targetId = selected.target
    ? selected.target.id
    : (typeof contextTargetId === "string" || typeof contextTargetId === "number" ? String(contextTargetId) : null);

  return Object.freeze({
    accepted: true,
    patternId: id,
    // String directives are intentionally stable for simple consumers.
    movement: definition.movement.mode,
    targeting: definition.targeting.mode,
    movementDirective,
    targetingDirective,
    targetId,
    targetCount: selected.count,
    reason: "resolved"
  });
}

/**
 * Boss phase tiers. Health is interpreted as a normalized remaining fraction;
 * phase zero is the full-health tier and the final tier owns zero health.
 */
export const BOSS_PHASES = freezeDeep({
  3: [
    { phaseIndex: 0, minNormalizedHealth: 2 / 3, cue: "boss-phase-stable" },
    { phaseIndex: 1, minNormalizedHealth: 1 / 3, cue: "boss-phase-pressured" },
    { phaseIndex: 2, minNormalizedHealth: 0, cue: "boss-phase-enraged" }
  ],
  4: [
    { phaseIndex: 0, minNormalizedHealth: 3 / 4, cue: "boss-phase-stable" },
    { phaseIndex: 1, minNormalizedHealth: 1 / 2, cue: "boss-phase-pressured" },
    { phaseIndex: 2, minNormalizedHealth: 1 / 4, cue: "boss-phase-critical" },
    { phaseIndex: 3, minNormalizedHealth: 0, cue: "boss-phase-enraged" }
  ]
});

/**
 * Boss attack-pattern shapes. Every stage boss declares one of these types in
 * its `bossPattern.type` (see campaign-state.js STAGES). The catalog is pure
 * presentation/UX metadata — reach, wind-up feel, and a HUD icon key — so a
 * renderer can tell melee/ranged/aoe bosses apart at a glance without any
 * per-boss special-casing. Damage numbers and cooldowns stay stage data;
 * this catalog never carries a number that changes an outcome.
 */
export const BOSS_ATTACK_PATTERNS = freezeDeep({
  melee: {
    id: "melee",
    label: "Melee cleave",
    telegraph: "short wind-up, close reach",
    iconKey: "boss-pattern-melee"
  },
  ranged: {
    id: "ranged",
    label: "Ranged bolt",
    telegraph: "longer wind-up, long reach",
    iconKey: "boss-pattern-ranged"
  },
  aoe: {
    id: "aoe",
    label: "Area pulse",
    telegraph: "slow wind-up, radial burst",
    iconKey: "boss-pattern-aoe"
  }
});

/** Return the frozen pattern catalog entry for a boss pattern type, or null. */
export function resolveBossAttackPattern(type) {
  const id = normalizedKey(type);
  return id ? BOSS_ATTACK_PATTERNS[id] ?? null : null;
}

const DEFAULT_PHASE_COUNT = 3;
const INVALID_BOSS_PHASE = freezeDeep({
  accepted: false,
  phaseIndex: null,
  normalizedHealth: 0,
  phaseCue: null,
  phaseCount: null,
  reason: "invalid-phase-input"
});
const BOSS_PHASE_CACHE = new Map();


/** Resolve deterministic phase index, normalized health, and cue id. */
export function resolveBossPhase(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return INVALID_BOSS_PHASE;
  const { health, maxHealth, phaseCount } = input;
  if (
    !Number.isFinite(health)
    || !Number.isFinite(maxHealth)
    || maxHealth <= 0
    || (phaseCount !== 3 && phaseCount !== 4)
  ) return INVALID_BOSS_PHASE;
  const normalizedHealth = Math.min(1, Math.max(0, health / maxHealth));
  const phaseIndex = normalizedHealth >= 1
    ? 0
    : Math.min(phaseCount - 1, Math.floor((1 - normalizedHealth) * phaseCount));
  const cacheKey = `${health}|${maxHealth}|${phaseCount}`;
  const cached = BOSS_PHASE_CACHE.get(cacheKey);
  if (cached) return cached;
  const phase = BOSS_PHASES[phaseCount][phaseIndex];
  const result = freezeDeep({
    accepted: true,
    phaseIndex,
    normalizedHealth,
    phaseCue: phase.cue,
    phaseCount
  });
  BOSS_PHASE_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Deterministic summon evolution recipes. `owned` is the current ownership
 * flag for the recipe; resolving never mutates the supplied input.
 */
export const SUMMON_EVOLUTION_RECIPES = freezeDeep({
  "ember-cohort": {
    id: "ember-cohort",
    recipeId: "ember-cohort",
    name: "Ember Cohort",
    from: "shade",
    to: "ember-cohort",
    cost: 3,
    essenceCost: 3,
    requires: "shade",
    grants: { power: 1, resilience: 0 }
  },
  "veil-ascension": {
    id: "veil-ascension",
    recipeId: "veil-ascension",
    name: "Veil Ascension",
    from: "ember-cohort",
    to: "veil-ascension",
    cost: 5,
    essenceCost: 5,
    requires: "ember-cohort",
    grants: { power: 2, resilience: 1 }
  },
  "throne-awakening": {
    id: "throne-awakening",
    recipeId: "throne-awakening",
    name: "Throne Awakening",
    from: "veil-ascension",
    to: "throne-awakening",
    cost: 8,
    essenceCost: 8,
    requires: "veil-ascension",
    grants: { power: 3, resilience: 2 }
  }
});

// Common singular/plural names used by state and UI callers.
export const SUMMON_RECIPES = SUMMON_EVOLUTION_RECIPES;
export const SUMMON_EVOLUTION_RECIPE_CATALOG = SUMMON_EVOLUTION_RECIPES;

function invalidSummonResult(recipeId, essence, owned, reason = "invalid-input") {
  const safeOwned = typeof owned === "boolean" ? owned : false;
  return freezeDeep({
    accepted: false,
    status: "rejected",
    reason,
    recipeId: recipeId || null,
    essence,
    essenceRemaining: essence,
    remainingEssence: essence,
    cost: 0,
    owned: safeOwned,
    nextOwned: safeOwned,
    evolution: null
  });
}

/** Resolve one evolution without randomness, mutation, or resource ambiguity. */
export function resolveSummonEvolution(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalidSummonResult(null, 0, false);
  const { essence, recipeId, owned } = input;
  const id = normalizedKey(recipeId);
  const recipe = SUMMON_EVOLUTION_RECIPES[id];
  if (!Number.isInteger(essence) || essence < 0 || typeof owned !== "boolean" || !recipe) {
    const reason = recipe ? (typeof owned !== "boolean" ? "invalid-owned" : "invalid-essence") : "invalid-recipe";
    return invalidSummonResult(id || null, Number.isInteger(essence) && essence >= 0 ? essence : 0, owned, reason);
  }
  if (owned) {
    return freezeDeep({
      accepted: false,
      status: "rejected",
      reason: "already-owned",
      recipeId: id,
      essence,
      essenceRemaining: essence,
      remainingEssence: essence,
      cost: recipe.cost,
      owned: true,
      nextOwned: true,
      evolution: null
    });
  }
  if (essence < recipe.cost) {
    return freezeDeep({
      accepted: false,
      status: "insufficient-resources",
      reason: "insufficient-essence",
      recipeId: id,
      essence,
      essenceRemaining: essence,
      remainingEssence: essence,
      cost: recipe.cost,
      owned: false,
      nextOwned: false,
      evolution: null
    });
  }
  return freezeDeep({
    accepted: true,
    status: "accepted",
    reason: "accepted",
    recipeId: id,
    essence,
    essenceRemaining: essence - recipe.cost,
    remainingEssence: essence - recipe.cost,
    cost: recipe.cost,
    owned: false,
    nextOwned: true,
    evolution: {
      from: recipe.from,
      to: recipe.to,
      recipeId: id,
      name: recipe.name,
      requires: recipe.requires,
      grants: recipe.grants
    }
  });
}

/** Combat alerts are data-only so renderers can map them to audio/visual UI. */
export const COMBAT_ALERT_CUES = freezeDeep({
  breach: { id: "breach-alert", event: "breach", severity: "critical", channel: "audio-visual", label: "Breach detected" },
  "start-wave": { id: "wave-spawn", event: "start-wave", severity: "warning", channel: "audio-visual", label: "Hostile wave incoming" },
  "wave-spawn": { id: "wave-spawn", event: "wave-spawn", severity: "warning", channel: "audio-visual", label: "Hostile wave incoming" },
  "boss-phase": { id: "boss-phase-change", event: "boss-phase", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
  "phase-change": { id: "boss-phase-change", event: "phase-change", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
  "boss-phase-shift": { id: "boss-phase-change", event: "boss-phase-shift", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
  "boss-low-health": { id: "boss-low-health", event: "boss-low-health", severity: "critical", channel: "audio-visual", label: "Boss integrity critical" },
  "low-health": { id: "boss-low-health", event: "low-health", severity: "critical", channel: "audio-visual", label: "Boss integrity critical" },
  "guardian-shield": { id: "guardian-shield", event: "guardian-shield", severity: "warning", channel: "audio-visual", label: "Guardian shield active" },
  "guardian-guard": { id: "guardian-shield", event: "guardian-guard", severity: "warning", channel: "audio-visual", label: "Guardian shield active" },
  "enemy-ranged-warning": { id: "enemy-ranged-warning", event: "enemy-ranged-warning", severity: "warning", channel: "audio-visual", label: "Ranged threat acquiring target" },
  "summon-evolution": { id: "summon-evolved", event: "summon-evolution", severity: "info", channel: "audio-visual", label: "Summon evolution accepted" },
  "summon-evolved": { id: "summon-evolved", event: "summon-evolved", severity: "info", channel: "audio-visual", label: "Summon evolution accepted" },
  "boss-strike": { id: "breach-alert", event: "boss-strike", severity: "critical", channel: "audio-visual", label: "Boss strikes at range" }
});

export const ALERT_CUES = COMBAT_ALERT_CUES;

/** Return a frozen cue for a string event or event object; unknown input is null. */
export function getCombatAlertCue(event) {
  const id = normalizedKey(event);
  return id ? COMBAT_ALERT_CUES[id] ?? null : null;
}
