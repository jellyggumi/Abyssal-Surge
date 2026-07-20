import { createStageNavigation } from "./stage-navigation.js";

export const RULES_VERSION = "abyssal-surge-rules-v7";
export const SAVE_SCHEMA = "abyssal-surge-campaign";
export const SAVE_SCHEMA_VERSION = 5;

// Campaign-wide limits only. Encounter, command, boss, and reward rules live
// with the stage that owns them.
export const BALANCE = Object.freeze({
  maxIntegrity: 10
});

const MIN_SLOTS = 10;
const MAX_SLOTS = 100;
const TERMINAL_STATUSES = new Set(["reward", "campaign-complete", "defeat"]);
const MAX_TRACE_EVENTS = 400;

const STANDARD_PROGRESSION = Object.freeze({
  huntGoal: 2,
  soulsPerExtract: 4,
  materializeCost: 2,
  materializeSummon: 2
});
const SUMMON_ESSENCE_PER_EXTRACT = 2;
const freezeRecipe = (recipe) => Object.freeze({
  ...recipe,
  maxLevel: recipe.essenceCosts.length,
  essenceCosts: Object.freeze([...recipe.essenceCosts]),
  benefits: Object.freeze(recipe.benefits.map((benefit) => Object.freeze({ ...benefit })))
});

// Summon recipes are campaign-wide and intentionally independent from stages.
// Each level consumes the corresponding essenceCosts entry and unlocks the
// matching benefits entry. The catalog is data-only so it can be replayed
// without browser or renderer dependencies.
export const SUMMON_RECIPES = Object.freeze([
  freezeRecipe({
    id: "ember-scion",
    name: "Ember Scion",
    description: "Harden a shade into a furnace-born vanguard.",
    essenceCosts: [4, 8, 12],
    benefits: [
      { materializeBonus: 1 },
      { materializeBonus: 2 },
      { materializeBonus: 3 }
    ]
  }),
  freezeRecipe({
    id: "rift-hound",
    name: "Rift Hound",
    description: "Teach a shade to follow a breach back to its source.",
    essenceCosts: [4, 8, 12],
    benefits: [
      { assaultDamageBonus: 1 },
      { assaultDamageBonus: 2 },
      { assaultDamageBonus: 3 }
    ]
  }),
  freezeRecipe({
    id: "ward-wisp",
    name: "Ward Wisp",
    description: "Bind a shade to blunt the next counterblow.",
    essenceCosts: [4, 8, 12],
    benefits: [
      { counterReduction: 1 },
      { counterReduction: 2 },
      { counterReduction: 3 }
    ]
  })
]);

export const SUMMON_RECIPES_BY_ID = Object.freeze(
  Object.fromEntries(SUMMON_RECIPES.map((recipe) => [recipe.id, recipe]))
);

const DEFAULT_SUMMON_PROGRESSION = Object.freeze({
  essence: 0,
  levels: Object.freeze({})
});

const STANDARD_COMMAND_COOLDOWNS = Object.freeze({
  hunt: 4,
  extract: 5,
  materialize: 5,
  capture: 6,
  assault: 3
});

export const STAGES = Object.freeze([
  Object.freeze({
    id: "cinder-span",
    number: 1,
    nextStageId: "veil-citadel",
    title: "Cinder Span",
    region: "The ember bridge above the drowned forge",
    objective: "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, clear three assault waves, then break the Cinder Warden.",
    nodeGoal: 1,
    bossName: "Cinder Warden",
    bossHealth: 8,
    // Independent boss threat: while the stage is active, the boss strikes
    // anyone who lingers inside triggerRange on its own cooldown, regardless
    // of exposure/possession — see applyEncounterEvent's "boss-strike" branch.
    bossPattern: Object.freeze({ type: "melee", triggerRange: 4.5, cooldownSeconds: 5, damage: 1 }),
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        counter: Object.freeze({ mode: "threshold", minimumLegion: 4, belowDamage: 2, readyDamage: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 4,
      preparationNodes: 1,
      waves: Object.freeze([
        Object.freeze({ id: "scout", spawnAtSeconds: 8, hostiles: 2, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "guard", spawnAtSeconds: 22, hostiles: 3, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "reinforcement", spawnAtSeconds: 36, hostiles: 3, hostileHealth: 2, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "ember-cohort", name: "Ember Cohort", description: "Legion doctrine: Materialize raises 2 additional shades (base 2) for the remaining campaign.", effects: Object.freeze({ materializeBonus: 2 }) }),
      Object.freeze({ id: "rift-lens", name: "Rift Lens", description: "Burst doctrine: possession assaults deal +4 damage from Veil Citadel onward.", effects: Object.freeze({ possessedAssaultBonus: 4 }) }),
      Object.freeze({ id: "stillwater-hourglass", name: "Stillwater Hourglass", description: "Tempo doctrine: reduce command cooldowns by 20%; the second Hunt immediately extracts the soul cache.", effects: Object.freeze({ cooldownMultiplier: 0.8, autoExtract: true }) }),
      Object.freeze({ id: "shadebreaker-brand", name: "Bulwark Brand", description: "Bulwark doctrine: reduce every boss counterblow by 2 (never below 1).", effects: Object.freeze({ counterReduction: 2 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-011", region: "AS-WV-012", description: "AS-WV-013" }),
      boss: Object.freeze({ name: "AS-WV-014", description: "AS-WV-015" }),
      rewards: Object.freeze({
        "ember-cohort": Object.freeze({ name: "AS-WV-016", description: "AS-WV-017" }),
        "rift-lens": Object.freeze({ name: "AS-WV-018", description: "AS-WV-019" }),
        "stillwater-hourglass": Object.freeze({ name: "AS-WV-020", description: "AS-WV-021" }),
        "shadebreaker-brand": Object.freeze({ name: "AS-WV-022", description: "AS-WV-023" })
      })
    })
  }),
  Object.freeze({
    id: "veil-citadel",
    number: 2,
    nextStageId: "echo-throne",
    title: "Veil Citadel",
    region: "A fortress of listening stone",
    objective: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil.",
    nodeGoal: 2,
    bossName: "Veil Tactician",
    bossHealth: 10,
    bossPattern: Object.freeze({ type: "ranged", triggerRange: 6, cooldownSeconds: 6, damage: 1 }),
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        possessedDamage: 1,
        requiresPossessed: true,
        counter: Object.freeze({ mode: "shielded", baseDamage: 2, shieldDivisor: 4, thinLegion: 4, thinPenalty: 1 })
      })
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "veil-vanguard", name: "Veil Vanguard", description: "Start Echo Throne with four shades already raised; this skips setup but remains a thin legion.", effects: Object.freeze({ stageEntry: Object.freeze({ "echo-throne": Object.freeze({ legion: 4 }) }) }) }),
      Object.freeze({ id: "anchor-shard", name: "Anchor Shard", description: "Recovery doctrine: restore 2 additional integrity when entering Echo Throne.", effects: Object.freeze({ stageEntry: Object.freeze({ "echo-throne": Object.freeze({ integrity: 2 }) }) }) }),
      Object.freeze({ id: "abyssal-banner", name: "Abyssal Banner", description: "Legion doctrine: enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis.", effects: Object.freeze({ entryAegis: 1, materializeBonus: 1 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-024", region: "AS-WV-025", description: "AS-WV-026" }),
      boss: Object.freeze({ name: "AS-WV-027", description: "AS-WV-028" }),
      rewards: Object.freeze({
        "veil-vanguard": Object.freeze({ name: "AS-WV-029", description: "AS-WV-030" }),
        "anchor-shard": Object.freeze({ name: "AS-WV-031", description: "AS-WV-032" }),
        "abyssal-banner": Object.freeze({ name: "AS-WV-033", description: "AS-WV-034" })
      })
    })
  }),
  Object.freeze({
    id: "echo-throne",
    number: 3,
    nextStageId: "sunken-bastion",
    title: "Echo Throne",
    region: "The gate above the last remembered sea",
    objective: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign.",
    nodeGoal: 1,
    bossName: "Gate Sovereign",
    bossHealth: 17,
    bossPattern: Object.freeze({ type: "aoe", triggerRange: 5, cooldownSeconds: 7, damage: 2 }),
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      domain: Object.freeze({ requiresNodes: 1, limit: 1, integrityRestore: 4, aegis: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 4,
        possessedDamage: 1,
        counter: Object.freeze({ mode: "shielded", baseDamage: 6, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 })
      })
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "throne-echo", name: "Throne Echo", description: "Records the legion's final oath in the campaign archive.", effects: Object.freeze({}) }),
      Object.freeze({ id: "dawnless-crown", name: "Dawnless Crown", description: "Records a crown forged from the closed gate.", effects: Object.freeze({}) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-035", region: "AS-WV-036", description: "AS-WV-037" }),
      boss: Object.freeze({ name: "AS-WV-038", description: "AS-WV-039" }),
      rewards: Object.freeze({
        "throne-echo": Object.freeze({ name: "AS-WV-040", description: "AS-WV-041" }),
        "dawnless-crown": Object.freeze({ name: "AS-WV-042", description: "AS-WV-043" })
      })
    })
  }),
  Object.freeze({
    id: "sunken-bastion",
    number: 4,
    nextStageId: "howling-sprawl",
    title: "Sunken Bastion",
    region: "A drowned breakwater fortress reclaimed by the tide",
    objective: "Raise the legion above the waterline, hold the flood node, weather four tide waves, and drown the Tide Warden's claim.",
    nodeGoal: 1,
    bossName: "Tide Warden",
    bossHealth: 12,
    bossPattern: Object.freeze({ type: "melee", triggerRange: 4.5, cooldownSeconds: 5, damage: 1 }),
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        counter: Object.freeze({ mode: "threshold", minimumLegion: 5, belowDamage: 2, readyDamage: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 2,
      waves: Object.freeze([
        Object.freeze({ id: "tide", spawnAtSeconds: 10, hostiles: 3, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "undertow", spawnAtSeconds: 24, hostiles: 3, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "riptide", spawnAtSeconds: 38, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "depthguard", spawnAtSeconds: 52, hostiles: 4, hostileHealth: 3, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "tidebreaker-sigil", name: "Tidebreaker Sigil", description: "Tempo doctrine: reduce command cooldowns by a further 10%.", effects: Object.freeze({ cooldownMultiplier: 0.9 }) }),
      Object.freeze({ id: "coral-aegis", name: "Coral Aegis", description: "Bulwark doctrine: enter every remaining stage with 1 additional aegis.", effects: Object.freeze({ entryAegis: 1 }) }),
      Object.freeze({ id: "depth-cohort", name: "Depth Cohort", description: "Legion doctrine: Materialize raises 1 additional shade.", effects: Object.freeze({ materializeBonus: 1 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-044", region: "AS-WV-045", description: "AS-WV-046" }),
      boss: Object.freeze({ name: "AS-WV-047", description: "AS-WV-048" }),
      rewards: Object.freeze({
        "tidebreaker-sigil": Object.freeze({ name: "AS-WV-049", description: "AS-WV-050" }),
        "coral-aegis": Object.freeze({ name: "AS-WV-051", description: "AS-WV-052" }),
        "depth-cohort": Object.freeze({ name: "AS-WV-053", description: "AS-WV-054" })
      })
    })
  }),
  Object.freeze({
    id: "howling-sprawl",
    number: 5,
    nextStageId: "glass-necropolis",
    title: "Howling Sprawl",
    region: "A moonlit ruin district ruled by the pack",
    objective: "Take the howl node, possess a pack sentinel, survive four hunting waves, and silence the Pack Herald.",
    nodeGoal: 1,
    bossName: "Pack Herald",
    bossHealth: 14,
    bossPattern: Object.freeze({ type: "ranged", triggerRange: 6.5, cooldownSeconds: 5.5, damage: 1 }),
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        possessedDamage: 1,
        counter: Object.freeze({ mode: "shielded", baseDamage: 3, shieldDivisor: 4, thinLegion: 4, thinPenalty: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 2,
      waves: Object.freeze([
        Object.freeze({ id: "howler", spawnAtSeconds: 10, hostiles: 3, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "packrunner", spawnAtSeconds: 24, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "alphaguard", spawnAtSeconds: 38, hostiles: 4, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "direpack", spawnAtSeconds: 52, hostiles: 5, hostileHealth: 3, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "pack-banner", name: "Pack Banner", description: "Legion doctrine: Materialize raises 1 additional shade and every stage entry grants 1 aegis.", effects: Object.freeze({ materializeBonus: 1, entryAegis: 1 }) }),
      Object.freeze({ id: "howl-lens", name: "Howl Lens", description: "Burst doctrine: possession assaults deal +2 additional damage.", effects: Object.freeze({ possessedAssaultBonus: 2 }) }),
      Object.freeze({ id: "sprawl-hourglass", name: "Sprawl Hourglass", description: "Tempo doctrine: reduce command cooldowns by a further 15%.", effects: Object.freeze({ cooldownMultiplier: 0.85 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-055", region: "AS-WV-056", description: "AS-WV-057" }),
      boss: Object.freeze({ name: "AS-WV-058", description: "AS-WV-059" }),
      rewards: Object.freeze({
        "pack-banner": Object.freeze({ name: "AS-WV-060", description: "AS-WV-061" }),
        "howl-lens": Object.freeze({ name: "AS-WV-062", description: "AS-WV-063" }),
        "sprawl-hourglass": Object.freeze({ name: "AS-WV-064", description: "AS-WV-065" })
      })
    })
  }),
  Object.freeze({
    id: "glass-necropolis",
    number: 6,
    nextStageId: "starless-canal",
    title: "Glass Necropolis",
    region: "A cathedral of grave-glass that sings back every march",
    objective: "Hold both glass nodes, possess a chorister sentinel, endure four requiem waves, and shatter the Requiem Choir.",
    nodeGoal: 2,
    bossName: "Requiem Choir",
    bossHealth: 16,
    bossPattern: Object.freeze({ type: "aoe", triggerRange: 5.5, cooldownSeconds: 6, damage: 2 }),
    rewardIntegrityRestore: 3,
    entryIntegrityFloor: 7,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 4,
        possessedDamage: 1,
        counter: Object.freeze({ mode: "shielded", baseDamage: 4, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 2,
      waves: Object.freeze([
        Object.freeze({ id: "requiem", spawnAtSeconds: 10, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "dirge", spawnAtSeconds: 26, hostiles: 4, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "lament", spawnAtSeconds: 42, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "threnody", spawnAtSeconds: 58, hostiles: 5, hostileHealth: 3, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "glass-chorus", name: "Glass Chorus", description: "Tempo doctrine: reduce command cooldowns by a further 10%.", effects: Object.freeze({ cooldownMultiplier: 0.9 }) }),
      Object.freeze({ id: "necropolis-plate", name: "Necropolis Plate", description: "Bulwark doctrine: reduce every boss counterblow by 1 more (never below 1).", effects: Object.freeze({ counterReduction: 1 }) }),
      Object.freeze({ id: "choir-shard", name: "Choir Shard", description: "Recovery doctrine: restore 2 additional integrity when entering Starless Canal.", effects: Object.freeze({ stageEntry: Object.freeze({ "starless-canal": Object.freeze({ integrity: 2 }) }) }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-066", region: "AS-WV-067", description: "AS-WV-068" }),
      boss: Object.freeze({ name: "AS-WV-069", description: "AS-WV-070" }),
      rewards: Object.freeze({
        "glass-chorus": Object.freeze({ name: "AS-WV-071", description: "AS-WV-072" }),
        "necropolis-plate": Object.freeze({ name: "AS-WV-073", description: "AS-WV-074" }),
        "choir-shard": Object.freeze({ name: "AS-WV-075", description: "AS-WV-076" })
      })
    })
  }),
  Object.freeze({
    id: "starless-canal",
    number: 7,
    nextStageId: "shattered-causeway",
    title: "Starless Canal",
    region: "A lightless waterway strung with tyrant lanterns",
    objective: "Seize both toll nodes, reopen Lord's Domain, outlast four lantern waves, and douse the Lantern Tyrant.",
    nodeGoal: 2,
    bossName: "Lantern Tyrant",
    bossHealth: 18,
    bossPattern: Object.freeze({ type: "ranged", triggerRange: 7, cooldownSeconds: 5.5, damage: 2 }),
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      domain: Object.freeze({ requiresNodes: 2, limit: 1, integrityRestore: 3, aegis: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 4,
        possessedDamage: 1,
        counter: Object.freeze({ mode: "shielded", baseDamage: 5, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 3,
      waves: Object.freeze([
        Object.freeze({ id: "lantern", spawnAtSeconds: 10, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "bargeguard", spawnAtSeconds: 26, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "tollkeeper", spawnAtSeconds: 42, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "tyrantwake", spawnAtSeconds: 58, hostiles: 6, hostileHealth: 3, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "canal-lantern", name: "Canal Lantern", description: "Bulwark doctrine: enter every remaining stage with 1 additional aegis.", effects: Object.freeze({ entryAegis: 1 }) }),
      Object.freeze({ id: "tyrant-chain", name: "Tyrant Chain", description: "Bulwark doctrine: reduce every boss counterblow by 1 more (never below 1).", effects: Object.freeze({ counterReduction: 1 }) }),
      Object.freeze({ id: "starless-cohort", name: "Starless Cohort", description: "Legion doctrine: Materialize raises 1 additional shade.", effects: Object.freeze({ materializeBonus: 1 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-077", region: "AS-WV-078", description: "AS-WV-079" }),
      boss: Object.freeze({ name: "AS-WV-080", description: "AS-WV-081" }),
      rewards: Object.freeze({
        "canal-lantern": Object.freeze({ name: "AS-WV-082", description: "AS-WV-083" }),
        "tyrant-chain": Object.freeze({ name: "AS-WV-084", description: "AS-WV-085" }),
        "starless-cohort": Object.freeze({ name: "AS-WV-086", description: "AS-WV-087" })
      })
    })
  }),
  Object.freeze({
    id: "shattered-causeway",
    number: 8,
    nextStageId: "abyss-chancel",
    title: "Shattered Causeway",
    region: "The broken land-bridge where a colossus still stands watch",
    objective: "Anchor both span nodes, invoke the Domain, break five siege waves, and topple the Bridge Colossus.",
    nodeGoal: 2,
    bossName: "Bridge Colossus",
    bossHealth: 20,
    bossPattern: Object.freeze({ type: "melee", triggerRange: 5, cooldownSeconds: 5, damage: 2 }),
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      domain: Object.freeze({ requiresNodes: 2, limit: 1, integrityRestore: 3, aegis: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 4,
        possessedDamage: 2,
        counter: Object.freeze({ mode: "shielded", baseDamage: 6, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 3,
      waves: Object.freeze([
        Object.freeze({ id: "rubble", spawnAtSeconds: 10, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "spanwarden", spawnAtSeconds: 26, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "keystone", spawnAtSeconds: 42, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "colossusguard", spawnAtSeconds: 58, hostiles: 6, hostileHealth: 4, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "causeway-core", name: "Causeway Core", description: "Legion doctrine: Materialize raises 2 additional shades.", effects: Object.freeze({ materializeBonus: 2 }) }),
      Object.freeze({ id: "colossus-plate", name: "Colossus Plate", description: "Bulwark doctrine: reduce every boss counterblow by 2 more (never below 1).", effects: Object.freeze({ counterReduction: 2 }) }),
      Object.freeze({ id: "span-sigil", name: "Span Sigil", description: "Vanguard doctrine: start Abyss Chancel with four shades already raised.", effects: Object.freeze({ stageEntry: Object.freeze({ "abyss-chancel": Object.freeze({ legion: 4 }) }) }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-088", region: "AS-WV-089", description: "AS-WV-090" }),
      boss: Object.freeze({ name: "AS-WV-091", description: "AS-WV-092" }),
      rewards: Object.freeze({
        "causeway-core": Object.freeze({ name: "AS-WV-093", description: "AS-WV-094" }),
        "colossus-plate": Object.freeze({ name: "AS-WV-095", description: "AS-WV-096" }),
        "span-sigil": Object.freeze({ name: "AS-WV-097", description: "AS-WV-098" })
      })
    })
  }),
  Object.freeze({
    id: "abyss-chancel",
    number: 9,
    nextStageId: "gate-zenith",
    title: "Abyss Chancel",
    region: "A floating chancel where the Concordat signs the abyss away",
    objective: "Claim all three rite nodes, possess a signatory, open the Domain, survive four oath waves, and unbind the Veiled Concordat.",
    nodeGoal: 3,
    bossName: "Veiled Concordat",
    bossHealth: 22,
    bossPattern: Object.freeze({ type: "aoe", triggerRange: 6, cooldownSeconds: 6, damage: 2 }),
    bossPhaseCount: 4,
    rewardIntegrityRestore: 3,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 2 }),
      domain: Object.freeze({ requiresNodes: 3, limit: 1, integrityRestore: 4, aegis: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 5,
        possessedDamage: 2,
        counter: Object.freeze({ mode: "shielded", baseDamage: 7, shieldDivisor: 4, thinLegion: 6, thinPenalty: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 3,
      waves: Object.freeze([
        Object.freeze({ id: "acolyte", spawnAtSeconds: 10, hostiles: 4, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "votary", spawnAtSeconds: 26, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "oathbound", spawnAtSeconds: 42, hostiles: 6, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "concord", spawnAtSeconds: 58, hostiles: 6, hostileHealth: 4, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "chancel-veil", name: "Chancel Veil", description: "Bulwark doctrine: enter the final gate with 2 additional aegis.", effects: Object.freeze({ entryAegis: 2 }) }),
      Object.freeze({ id: "concord-lens", name: "Concord Lens", description: "Burst doctrine: possession assaults deal +2 additional damage.", effects: Object.freeze({ possessedAssaultBonus: 2 }) }),
      Object.freeze({ id: "rite-hourglass", name: "Rite Hourglass", description: "Tempo doctrine: reduce command cooldowns by a further 15%.", effects: Object.freeze({ cooldownMultiplier: 0.85 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-099", region: "AS-WV-100", description: "AS-WV-101" }),
      boss: Object.freeze({ name: "AS-WV-102", description: "AS-WV-103" }),
      rewards: Object.freeze({
        "chancel-veil": Object.freeze({ name: "AS-WV-104", description: "AS-WV-105" }),
        "concord-lens": Object.freeze({ name: "AS-WV-106", description: "AS-WV-107" }),
        "rite-hourglass": Object.freeze({ name: "AS-WV-108", description: "AS-WV-109" })
      })
    })
  }),
  Object.freeze({
    id: "gate-zenith",
    number: 10,
    nextStageId: null,
    title: "Gate Zenith",
    region: "The stormcrowned summit above every drowned gate",
    objective: "Carry every boon, hold all three crown nodes, spend the Domain, outlast five zenith waves, and unmake the Abyss Regent.",
    nodeGoal: 3,
    bossName: "Abyss Regent",
    bossHealth: 26,
    bossPattern: Object.freeze({ type: "aoe", triggerRange: 6.5, cooldownSeconds: 5, damage: 3 }),
    bossPhaseCount: 4,
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 2 }),
      domain: Object.freeze({ requiresNodes: 3, limit: 1, integrityRestore: 4, aegis: 3 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 5,
        possessedDamage: 2,
        counter: Object.freeze({ mode: "shielded", baseDamage: 9, shieldDivisor: 4, thinLegion: 6, thinPenalty: 2 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 3,
      waves: Object.freeze([
        Object.freeze({ id: "zenithguard", spawnAtSeconds: 10, hostiles: 5, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "stormherald", spawnAtSeconds: 26, hostiles: 5, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "gatewrath", spawnAtSeconds: 42, hostiles: 6, hostileHealth: 3, breachDamage: 1 }),
        Object.freeze({ id: "regentsown", spawnAtSeconds: 58, hostiles: 6, hostileHealth: 4, breachDamage: 1 }),
        Object.freeze({ id: "lasttide", spawnAtSeconds: 74, hostiles: 7, hostileHealth: 4, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "zenith-crown", name: "Zenith Crown", description: "Records the crown taken above every drowned gate.", effects: Object.freeze({}) }),
      Object.freeze({ id: "abyssal-oath", name: "Abyssal Oath", description: "Records the oath that keeps the gates closed.", effects: Object.freeze({}) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-110", region: "AS-WV-111", description: "AS-WV-112" }),
      boss: Object.freeze({ name: "AS-WV-113", description: "AS-WV-114" }),
      rewards: Object.freeze({
        "zenith-crown": Object.freeze({ name: "AS-WV-115", description: "AS-WV-116" }),
        "abyssal-oath": Object.freeze({ name: "AS-WV-117", description: "AS-WV-118" })
      })
    })
  })
]);

export const STAGES_BY_ID = Object.freeze(Object.fromEntries(STAGES.map((stage) => [stage.id, stage])));

export const CONTENT_TRACE = Object.freeze({
  "AS-WV-011": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "name", value: "Cinder Span" }),
  "AS-WV-012": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "region", value: "The ember bridge above the drowned forge" }),
  "AS-WV-013": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "description", value: "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, clear three assault waves, then break the Cinder Warden." }),
  "AS-WV-014": Object.freeze({ stageId: "cinder-span", entity: "boss", field: "name", value: "Cinder Warden" }),
  "AS-WV-015": Object.freeze({ stageId: "cinder-span", entity: "boss", field: "description", value: "The forge bridge's ashbound sentinel breaks intruders against the drowned iron." }),
  "AS-WV-016": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "ember-cohort", field: "name", value: "Ember Cohort" }),
  "AS-WV-017": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "ember-cohort", field: "description", value: "Legion doctrine: Materialize raises 2 additional shades (base 2) for the remaining campaign." }),
  "AS-WV-018": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "rift-lens", field: "name", value: "Rift Lens" }),
  "AS-WV-019": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "rift-lens", field: "description", value: "Burst doctrine: possession assaults deal +4 damage from Veil Citadel onward." }),
  "AS-WV-020": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "stillwater-hourglass", field: "name", value: "Stillwater Hourglass" }),
  "AS-WV-021": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "stillwater-hourglass", field: "description", value: "Tempo doctrine: reduce command cooldowns by 20%; the second Hunt immediately extracts the soul cache." }),
  "AS-WV-022": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "shadebreaker-brand", field: "name", value: "Bulwark Brand" }),
  "AS-WV-023": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "shadebreaker-brand", field: "description", value: "Bulwark doctrine: reduce every boss counterblow by 2 (never below 1)." }),
  "AS-WV-024": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "name", value: "Veil Citadel" }),
  "AS-WV-025": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "region", value: "A fortress of listening stone" }),
  "AS-WV-026": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "description", value: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil." }),
  "AS-WV-027": Object.freeze({ stageId: "veil-citadel", entity: "boss", field: "name", value: "Veil Tactician" }),
  "AS-WV-028": Object.freeze({ stageId: "veil-citadel", entity: "boss", field: "description", value: "A tactician of listening stone that turns every uncovered route into a killing field." }),
  "AS-WV-029": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "veil-vanguard", field: "name", value: "Veil Vanguard" }),
  "AS-WV-030": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "veil-vanguard", field: "description", value: "Start Echo Throne with four shades already raised; this skips setup but remains a thin legion." }),
  "AS-WV-031": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "anchor-shard", field: "name", value: "Anchor Shard" }),
  "AS-WV-032": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "anchor-shard", field: "description", value: "Recovery doctrine: restore 2 additional integrity when entering Echo Throne." }),
  "AS-WV-033": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "abyssal-banner", field: "name", value: "Abyssal Banner" }),
  "AS-WV-034": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "abyssal-banner", field: "description", value: "Legion doctrine: enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis." }),
  "AS-WV-035": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "name", value: "Echo Throne" }),
  "AS-WV-036": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "region", value: "The gate above the last remembered sea" }),
  "AS-WV-037": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "description", value: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign." }),
  "AS-WV-038": Object.freeze({ stageId: "echo-throne", entity: "boss", field: "name", value: "Gate Sovereign" }),
  "AS-WV-039": Object.freeze({ stageId: "echo-throne", entity: "boss", field: "description", value: "The final gate's remembered ruler, holding back the last abyssal tide." }),
  "AS-WV-040": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "throne-echo", field: "name", value: "Throne Echo" }),
  "AS-WV-041": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "throne-echo", field: "description", value: "Records the legion's final oath in the campaign archive." }),
  "AS-WV-042": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "dawnless-crown", field: "name", value: "Dawnless Crown" }),
  "AS-WV-043": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "dawnless-crown", field: "description", value: "Records a crown forged from the closed gate." }),
  "AS-WV-044": Object.freeze({ stageId: "sunken-bastion", entity: "stage", field: "name", value: "Sunken Bastion" }),
  "AS-WV-045": Object.freeze({ stageId: "sunken-bastion", entity: "stage", field: "region", value: "A drowned breakwater fortress reclaimed by the tide" }),
  "AS-WV-046": Object.freeze({ stageId: "sunken-bastion", entity: "stage", field: "description", value: "Raise the legion above the waterline, hold the flood node, weather four tide waves, and drown the Tide Warden's claim." }),
  "AS-WV-047": Object.freeze({ stageId: "sunken-bastion", entity: "boss", field: "name", value: "Tide Warden" }),
  "AS-WV-048": Object.freeze({ stageId: "sunken-bastion", entity: "boss", field: "description", value: "A drowned warden whose coral-fused armor drags whole companies beneath the breakwater." }),
  "AS-WV-049": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "tidebreaker-sigil", field: "name", value: "Tidebreaker Sigil" }),
  "AS-WV-050": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "tidebreaker-sigil", field: "description", value: "Tempo doctrine: reduce command cooldowns by a further 10%." }),
  "AS-WV-051": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "coral-aegis", field: "name", value: "Coral Aegis" }),
  "AS-WV-052": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "coral-aegis", field: "description", value: "Bulwark doctrine: enter every remaining stage with 1 additional aegis." }),
  "AS-WV-053": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "depth-cohort", field: "name", value: "Depth Cohort" }),
  "AS-WV-054": Object.freeze({ stageId: "sunken-bastion", entity: "reward", rewardId: "depth-cohort", field: "description", value: "Legion doctrine: Materialize raises 1 additional shade." }),
  "AS-WV-055": Object.freeze({ stageId: "howling-sprawl", entity: "stage", field: "name", value: "Howling Sprawl" }),
  "AS-WV-056": Object.freeze({ stageId: "howling-sprawl", entity: "stage", field: "region", value: "A moonlit ruin district ruled by the pack" }),
  "AS-WV-057": Object.freeze({ stageId: "howling-sprawl", entity: "stage", field: "description", value: "Take the howl node, possess a pack sentinel, survive four hunting waves, and silence the Pack Herald." }),
  "AS-WV-058": Object.freeze({ stageId: "howling-sprawl", entity: "boss", field: "name", value: "Pack Herald" }),
  "AS-WV-059": Object.freeze({ stageId: "howling-sprawl", entity: "boss", field: "description", value: "The pack's crowned herald; every howl is a marching order for the ruin district." }),
  "AS-WV-060": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "pack-banner", field: "name", value: "Pack Banner" }),
  "AS-WV-061": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "pack-banner", field: "description", value: "Legion doctrine: Materialize raises 1 additional shade and every stage entry grants 1 aegis." }),
  "AS-WV-062": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "howl-lens", field: "name", value: "Howl Lens" }),
  "AS-WV-063": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "howl-lens", field: "description", value: "Burst doctrine: possession assaults deal +2 additional damage." }),
  "AS-WV-064": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "sprawl-hourglass", field: "name", value: "Sprawl Hourglass" }),
  "AS-WV-065": Object.freeze({ stageId: "howling-sprawl", entity: "reward", rewardId: "sprawl-hourglass", field: "description", value: "Tempo doctrine: reduce command cooldowns by a further 15%." }),
  "AS-WV-066": Object.freeze({ stageId: "glass-necropolis", entity: "stage", field: "name", value: "Glass Necropolis" }),
  "AS-WV-067": Object.freeze({ stageId: "glass-necropolis", entity: "stage", field: "region", value: "A cathedral of grave-glass that sings back every march" }),
  "AS-WV-068": Object.freeze({ stageId: "glass-necropolis", entity: "stage", field: "description", value: "Hold both glass nodes, possess a chorister sentinel, endure four requiem waves, and shatter the Requiem Choir." }),
  "AS-WV-069": Object.freeze({ stageId: "glass-necropolis", entity: "boss", field: "name", value: "Requiem Choir" }),
  "AS-WV-070": Object.freeze({ stageId: "glass-necropolis", entity: "boss", field: "description", value: "Three grave-choristers fused into one requiem that sings marching legions apart." }),
  "AS-WV-071": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "glass-chorus", field: "name", value: "Glass Chorus" }),
  "AS-WV-072": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "glass-chorus", field: "description", value: "Tempo doctrine: reduce command cooldowns by a further 10%." }),
  "AS-WV-073": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "necropolis-plate", field: "name", value: "Necropolis Plate" }),
  "AS-WV-074": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "necropolis-plate", field: "description", value: "Bulwark doctrine: reduce every boss counterblow by 1 more (never below 1)." }),
  "AS-WV-075": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "choir-shard", field: "name", value: "Choir Shard" }),
  "AS-WV-076": Object.freeze({ stageId: "glass-necropolis", entity: "reward", rewardId: "choir-shard", field: "description", value: "Recovery doctrine: restore 2 additional integrity when entering Starless Canal." }),
  "AS-WV-077": Object.freeze({ stageId: "starless-canal", entity: "stage", field: "name", value: "Starless Canal" }),
  "AS-WV-078": Object.freeze({ stageId: "starless-canal", entity: "stage", field: "region", value: "A lightless waterway strung with tyrant lanterns" }),
  "AS-WV-079": Object.freeze({ stageId: "starless-canal", entity: "stage", field: "description", value: "Seize both toll nodes, reopen Lord's Domain, outlast four lantern waves, and douse the Lantern Tyrant." }),
  "AS-WV-080": Object.freeze({ stageId: "starless-canal", entity: "boss", field: "name", value: "Lantern Tyrant" }),
  "AS-WV-081": Object.freeze({ stageId: "starless-canal", entity: "boss", field: "description", value: "A canal tyrant strung with tribute lanterns, each one a soul still paying the toll." }),
  "AS-WV-082": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "canal-lantern", field: "name", value: "Canal Lantern" }),
  "AS-WV-083": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "canal-lantern", field: "description", value: "Bulwark doctrine: enter every remaining stage with 1 additional aegis." }),
  "AS-WV-084": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "tyrant-chain", field: "name", value: "Tyrant Chain" }),
  "AS-WV-085": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "tyrant-chain", field: "description", value: "Bulwark doctrine: reduce every boss counterblow by 1 more (never below 1)." }),
  "AS-WV-086": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "starless-cohort", field: "name", value: "Starless Cohort" }),
  "AS-WV-087": Object.freeze({ stageId: "starless-canal", entity: "reward", rewardId: "starless-cohort", field: "description", value: "Legion doctrine: Materialize raises 1 additional shade." }),
  "AS-WV-088": Object.freeze({ stageId: "shattered-causeway", entity: "stage", field: "name", value: "Shattered Causeway" }),
  "AS-WV-089": Object.freeze({ stageId: "shattered-causeway", entity: "stage", field: "region", value: "The broken land-bridge where a colossus still stands watch" }),
  "AS-WV-090": Object.freeze({ stageId: "shattered-causeway", entity: "stage", field: "description", value: "Anchor both span nodes, invoke the Domain, break five siege waves, and topple the Bridge Colossus." }),
  "AS-WV-091": Object.freeze({ stageId: "shattered-causeway", entity: "boss", field: "name", value: "Bridge Colossus" }),
  "AS-WV-092": Object.freeze({ stageId: "shattered-causeway", entity: "boss", field: "description", value: "The last watch-colossus of the broken span, still holding a bridge that no longer exists." }),
  "AS-WV-093": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "causeway-core", field: "name", value: "Causeway Core" }),
  "AS-WV-094": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "causeway-core", field: "description", value: "Legion doctrine: Materialize raises 2 additional shades." }),
  "AS-WV-095": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "colossus-plate", field: "name", value: "Colossus Plate" }),
  "AS-WV-096": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "colossus-plate", field: "description", value: "Bulwark doctrine: reduce every boss counterblow by 2 more (never below 1)." }),
  "AS-WV-097": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "span-sigil", field: "name", value: "Span Sigil" }),
  "AS-WV-098": Object.freeze({ stageId: "shattered-causeway", entity: "reward", rewardId: "span-sigil", field: "description", value: "Vanguard doctrine: start Abyss Chancel with four shades already raised." }),
  "AS-WV-099": Object.freeze({ stageId: "abyss-chancel", entity: "stage", field: "name", value: "Abyss Chancel" }),
  "AS-WV-100": Object.freeze({ stageId: "abyss-chancel", entity: "stage", field: "region", value: "A floating chancel where the Concordat signs the abyss away" }),
  "AS-WV-101": Object.freeze({ stageId: "abyss-chancel", entity: "stage", field: "description", value: "Claim all three rite nodes, possess a signatory, open the Domain, survive four oath waves, and unbind the Veiled Concordat." }),
  "AS-WV-102": Object.freeze({ stageId: "abyss-chancel", entity: "boss", field: "name", value: "Veiled Concordat" }),
  "AS-WV-103": Object.freeze({ stageId: "abyss-chancel", entity: "boss", field: "description", value: "Three veiled signatories who countersign the abyss itself against every intruder." }),
  "AS-WV-104": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "chancel-veil", field: "name", value: "Chancel Veil" }),
  "AS-WV-105": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "chancel-veil", field: "description", value: "Bulwark doctrine: enter the final gate with 2 additional aegis." }),
  "AS-WV-106": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "concord-lens", field: "name", value: "Concord Lens" }),
  "AS-WV-107": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "concord-lens", field: "description", value: "Burst doctrine: possession assaults deal +2 additional damage." }),
  "AS-WV-108": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "rite-hourglass", field: "name", value: "Rite Hourglass" }),
  "AS-WV-109": Object.freeze({ stageId: "abyss-chancel", entity: "reward", rewardId: "rite-hourglass", field: "description", value: "Tempo doctrine: reduce command cooldowns by a further 15%." }),
  "AS-WV-110": Object.freeze({ stageId: "gate-zenith", entity: "stage", field: "name", value: "Gate Zenith" }),
  "AS-WV-111": Object.freeze({ stageId: "gate-zenith", entity: "stage", field: "region", value: "The stormcrowned summit above every drowned gate" }),
  "AS-WV-112": Object.freeze({ stageId: "gate-zenith", entity: "stage", field: "description", value: "Carry every boon, hold all three crown nodes, spend the Domain, outlast five zenith waves, and unmake the Abyss Regent." }),
  "AS-WV-113": Object.freeze({ stageId: "gate-zenith", entity: "boss", field: "name", value: "Abyss Regent" }),
  "AS-WV-114": Object.freeze({ stageId: "gate-zenith", entity: "boss", field: "description", value: "The regent above every drowned gate, wearing the storm as a crown and the tide as a writ." }),
  "AS-WV-115": Object.freeze({ stageId: "gate-zenith", entity: "reward", rewardId: "zenith-crown", field: "name", value: "Zenith Crown" }),
  "AS-WV-116": Object.freeze({ stageId: "gate-zenith", entity: "reward", rewardId: "zenith-crown", field: "description", value: "Records the crown taken above every drowned gate." }),
  "AS-WV-117": Object.freeze({ stageId: "gate-zenith", entity: "reward", rewardId: "abyssal-oath", field: "name", value: "Abyssal Oath" }),
  "AS-WV-118": Object.freeze({ stageId: "gate-zenith", entity: "reward", rewardId: "abyssal-oath", field: "description", value: "Records the oath that keeps the gates closed." })
});

const ACTIONS = Object.freeze(["hunt", "extract", "materialize", "capture", "possess", "domain", "assault"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function getSummonRecipe(recipeId) {
  return SUMMON_RECIPES_BY_ID[recipeId] ?? null;
}

export function getSummonRecipeBenefits(recipeId, level) {
  const recipe = getSummonRecipe(recipeId);
  if (!recipe || !Number.isInteger(level) || level < 1 || level > recipe.maxLevel) return null;
  return recipe.benefits[level - 1];
}

function summonEvolutionBenefits(summons = DEFAULT_SUMMON_PROGRESSION) {
  const totals = {
    materializeBonus: 0,
    assaultDamageBonus: 0,
    counterReduction: 0
  };
  const levels = summons?.levels ?? {};
  for (const recipe of SUMMON_RECIPES) {
    const level = levels[recipe.id] ?? 0;
    for (let index = 0; index < level; index += 1) {
      const benefit = recipe.benefits[index];
      totals.materializeBonus += benefit.materializeBonus ?? 0;
      totals.assaultDamageBonus += benefit.assaultDamageBonus ?? 0;
      totals.counterReduction += benefit.counterReduction ?? 0;
    }
  }
  return totals;
}

export function getSummonEvolutionBenefits(state) {
  assertStateShape(state);
  const summons = state.progression.summons ?? DEFAULT_SUMMON_PROGRESSION;
  const totals = summonEvolutionBenefits(summons);
  return Object.freeze({
    essence: summons.essence ?? 0,
    levels: Object.freeze({ ...(summons.levels ?? {}) }),
    materializeBonus: totals.materializeBonus,
    assaultDamageBonus: totals.assaultDamageBonus,
    counterReduction: totals.counterReduction
  });
}
function sanitizeSummonProgression(progression) {
  if (!progression.summons) {
    progression.summons = { essence: DEFAULT_SUMMON_PROGRESSION.essence, levels: {} };
    return progression.summons;
  }
  if (!progression.summons.levels) progression.summons.levels = {};
  return progression.summons;
}

function rewardDefinition(reward) {
  const stage = STAGES_BY_ID[reward.stageId];
  return stage?.rewards.find((item) => item.id === reward.rewardId) ?? null;
}

function rewardBenefits(rewards) {
  const benefits = {
    maxIntegrity: BALANCE.maxIntegrity,
    cooldownMultiplier: 1,
    possessedAssaultBonus: 0,
    counterReduction: 0,
    materializeBonus: 0,
    autoExtract: false,
    entryAegis: 0,
    stageEntries: {},
    activeItemNames: []
  };

  for (const reward of rewards) {
    const definition = rewardDefinition(reward);
    if (!definition) continue;
    const effects = definition.effects;
    benefits.cooldownMultiplier *= effects.cooldownMultiplier ?? 1;
    benefits.possessedAssaultBonus += effects.possessedAssaultBonus ?? 0;
    benefits.counterReduction += effects.counterReduction ?? 0;
    benefits.materializeBonus += effects.materializeBonus ?? 0;
    benefits.autoExtract ||= effects.autoExtract === true;
    benefits.entryAegis += effects.entryAegis ?? 0;
    benefits.activeItemNames.push(definition.name);
    for (const [stageId, entry] of Object.entries(effects.stageEntry ?? {})) {
      const target = benefits.stageEntries[stageId] ?? { legion: 0, integrity: 0 };
      target.legion += entry.legion ?? 0;
      target.integrity += entry.integrity ?? 0;
      benefits.stageEntries[stageId] = target;
    }
  }
  benefits.cooldownMultiplier = Math.max(0.60, benefits.cooldownMultiplier);
  benefits.possessedAssaultBonus = Math.min(4, benefits.possessedAssaultBonus);
  benefits.counterReduction = Math.min(3, benefits.counterReduction);
  benefits.materializeBonus = Math.min(4, benefits.materializeBonus);
  benefits.entryAegis = Math.min(2, benefits.entryAegis);
  return Object.freeze(benefits);
}

function entryBenefits(benefits, stage) {
  return benefits.stageEntries[stage.id] ?? { legion: 0, integrity: 0 };
}

export function getCampaignBenefits(state) {
  assertStateShape(state);
  const benefits = rewardBenefits(state.rewards);
  const echoThroneEntry = entryBenefits(benefits, STAGES_BY_ID["echo-throne"]);
  return Object.freeze({
    maxIntegrity: benefits.maxIntegrity,
    cooldownReduction: Number(clamp(1 - benefits.cooldownMultiplier, 0, 0.40).toFixed(12)),
    lensDamage: benefits.possessedAssaultBonus,
    vanguardLegion: echoThroneEntry.legion,
    anchorRestore: echoThroneEntry.integrity,
    extraAssaultDamage: 0,
    counterReduction: benefits.counterReduction,
    summonBonus: benefits.materializeBonus,
    autoExtract: benefits.autoExtract,
    initialAegis: benefits.entryAegis,
    activeItemNames: Object.freeze([...benefits.activeItemNames])
  });
}

function makeEncounterState(stage) {
  if (!stage.encounter) return undefined;
  return {
    waves: stage.encounter.waves.map((wave) => ({ id: wave.id, cleared: false, breaches: 0 })),
    activeWaveId: null,
    bossExposed: false,
    spawningStopped: false
  };
}

function encounterState(stageState, stage) {
  return stageState.encounter ?? makeEncounterState(stage);
}

function validateEncounterState(encounter, stage) {
  if (!stage.encounter) {
    assert(encounter === undefined, "This stage does not define an encounter.");
    return;
  }
  if (encounter === undefined) return;
  assert(encounter && typeof encounter === "object", "Stage encounter state is invalid.");
  assert(Array.isArray(encounter.waves) && encounter.waves.length === stage.encounter.waves.length, "Stage encounter waves are invalid.");
  assert(encounter.activeWaveId === null || typeof encounter.activeWaveId === "string", "Stage encounter active wave is invalid.");
  assert(typeof encounter.bossExposed === "boolean" && typeof encounter.spawningStopped === "boolean", "Stage encounter boss state is invalid.");

  let seenUncleared = false;
  for (let index = 0; index < encounter.waves.length; index += 1) {
    const progress = encounter.waves[index];
    const wave = stage.encounter.waves[index];
    assert(progress && progress.id === wave.id && typeof progress.cleared === "boolean", "Stage encounter wave state is invalid.");
    assert(Number.isInteger(progress.breaches) && progress.breaches >= 0, "Stage encounter breach count is invalid.");
    if (seenUncleared) assert(!progress.cleared, "Stage encounter waves must clear in order.");
    if (!progress.cleared) seenUncleared = true;
  }
  const activeIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  const allCleared = activeIndex === -1;
  assert(encounter.bossExposed === allCleared, "Stage encounter boss exposure is invalid.");
  assert(encounter.spawningStopped === allCleared, "Stage encounter spawn state is invalid.");
  assert(allCleared ? encounter.activeWaveId === null : encounter.activeWaveId === null || encounter.activeWaveId === stage.encounter.waves[activeIndex].id, "Stage encounter active wave does not match the declared schedule.");
}

function makeStageState(stage, rewards, entryIntegrity) {
  const benefits = rewardBenefits(rewards);
  const entry = entryBenefits(benefits, stage);
  const capacity = MIN_SLOTS;
  const integrity = clamp(entryIntegrity, 0, benefits.maxIntegrity);
  const state = {
    hunted: 0,
    extracted: false,
    souls: 0,
    legion: Math.min(entry.legion, capacity),
    capacity,
    nodes: 0,
    possessed: false,
    domainUses: 0,
    aegis: benefits.entryAegis,
    integrity,
    entryIntegrity: integrity,
    bossHealth: stage.bossHealth,
    deployments: []
  };
  if (stage.encounter) state.encounter = makeEncounterState(stage);
  return state;
}

function makeCampaign() {
  return {
    rulesVersion: RULES_VERSION,
    stageId: STAGES[0].id,
    stageIndex: 0,
    status: "briefing",
    rewards: [],
    stage: makeStageState(STAGES[0], [], BALANCE.maxIntegrity),
    trace: [],
    revision: 0,
    lastMessage: "The abyss answers when you are ready.",
    progression: {
      marks: 8,
      skills: {
        command: 1,
        fortification: 1,
        mobility: 1
      },
      summons: {
        essence: DEFAULT_SUMMON_PROGRESSION.essence,
        levels: {}
      }
    },
    commandQueue: []
  };
}

function stateStageId(state) {
  return typeof state.stageId === "string" ? state.stageId : STAGES[state.stageIndex]?.id;
}

function transition(state, mutate, event) {
  const next = clone(state);
  next.stageId = stateStageId(next);
  sanitizeSummonProgression(next.progression);
  if (next.stage && activeStage(next).encounter && !next.stage.encounter) next.stage.encounter = makeEncounterState(activeStage(next));
  mutate(next);
  if (event) next.trace.push(event);
  next.revision += 1;
  return next;
}

function accepted(state, message, effect) {
  return { accepted: true, state, message, effect };
}

function rejected(state, message) {
  return { accepted: false, state, message, effect: "none" };
}

function activeStage(state) {
  return STAGES_BY_ID[stateStageId(state)];
}

function assertStateShape(state) {
  assert(state && typeof state === "object", "Campaign state must be an object.");
  assert(state.rulesVersion === RULES_VERSION, "Campaign rules version is incompatible.");
  assert(Number.isInteger(state.stageIndex) && state.stageIndex >= 0 && state.stageIndex < STAGES.length, "Campaign stage index is invalid.");
  const stageId = stateStageId(state);
  assert(STAGES_BY_ID[stageId], "Campaign stage id is invalid.");
  assert(!state.stageId || STAGES[state.stageIndex].id === state.stageId, "Campaign stage id does not match its index.");
  assert(typeof state.status === "string", "Campaign status is invalid.");
  assert(Array.isArray(state.rewards) && Array.isArray(state.trace), "Campaign history is invalid.");
  assert(state.stage && typeof state.stage === "object", "Campaign stage state is invalid.");
  validateEncounterState(state.stage.encounter, activeStage(state));

  assert(state.progression && typeof state.progression === "object", "Campaign progression is invalid.");
  assert(Number.isInteger(state.progression.marks) && state.progression.marks >= 0, "Campaign progression marks is invalid.");
  assert(state.progression.skills && typeof state.progression.skills === "object", "Campaign progression skills is invalid.");
  assert(Number.isInteger(state.progression.skills.command) && state.progression.skills.command >= 1 && state.progression.skills.command <= 5, "Command skill level is invalid.");
  assert(Number.isInteger(state.progression.skills.fortification) && state.progression.skills.fortification >= 1 && state.progression.skills.fortification <= 5, "Fortification skill level is invalid.");
  assert(Number.isInteger(state.progression.skills.mobility) && state.progression.skills.mobility >= 1 && state.progression.skills.mobility <= 5, "Mobility skill level is invalid.");
  if (state.progression.summons !== undefined) {
    const summons = state.progression.summons;
    assert(summons && typeof summons === "object", "Summon progression is invalid.");
    assert(Number.isInteger(summons.essence) && summons.essence >= 0, "Summon essence is invalid.");
    assert(summons.levels && typeof summons.levels === "object" && !Array.isArray(summons.levels), "Summon levels are invalid.");
    for (const [recipeId, level] of Object.entries(summons.levels)) {
      const recipe = getSummonRecipe(recipeId);
      assert(recipe, "Summon recipe level references an unknown recipe.");
      assert(Number.isInteger(level) && level >= 0 && level <= recipe.maxLevel, "Summon recipe level is invalid.");
    }
  }

  assert(Array.isArray(state.commandQueue), "Command queue must be an array.");
  for (const item of state.commandQueue) {
    assert(item && typeof item === "object", "Command queue item must be an object.");
    assert(typeof item.id === "string", "Command queue item id must be a string.");
    assert(typeof item.action === "string", "Command queue item action must be a string.");
    assert(!item.reason || typeof item.reason === "string", "Command queue item reason must be a string.");
  }

  assert(Array.isArray(state.stage.deployments), "Stage deployments must be an array.");
  for (const dep of state.stage.deployments) {
    assert(dep && typeof dep === "object", "Deployment must be an object.");
    assert(typeof dep.id === "string", "Deployment id must be a string.");
    assert(dep.kind === "tower" || dep.kind === "barricade", "Deployment kind is invalid.");
    assert(dep.cell && typeof dep.cell === "object", "Deployment cell must be an object.");
    assert(Number.isInteger(dep.cell.x) && dep.cell.x >= 0 && dep.cell.x < 24, "Deployment cell x is out of grid.");
    assert(Number.isInteger(dep.cell.y) && dep.cell.y >= 0 && dep.cell.y < 12, "Deployment cell y is out of grid.");
  }
}

// --- State-check readability guide -----------------------------------------
// canAct           -> is the campaign even accepting commands right now?
// guardAction       -> is this action legal for the active stage at all?
// guardAssault      -> may THIS assault specifically resolve (boss exposed,
//                      nodes held, possession requirement met)? Position/
//                      range is intentionally NOT checked here — that is a
//                      presentation-layer precondition enforced before this
//                      reducer is ever called (renderer proximity gate +
//                      canvas-only dispatch; see battle-realtime-three.js
//                      getCommandReadiness/"out-of-range" and updateBossStrike).
// -----------------------------------------------------------------------------
function canAct(state) {
  return state.status === "active";
}

function stageComplete(next, stage) {
  next.status = "reward";
  next.lastMessage = `${stage.bossName} dissolves into ash. Choose one lasting boon.`;
}

function counterDamage(stageState, stage, benefits, progression) {
  const counter = stage.commands.assault.counter;
  const summonBenefits = summonEvolutionBenefits(progression?.summons);
  if (counter.mode === "threshold") {
    const base = stageState.legion >= counter.minimumLegion ? counter.readyDamage : counter.belowDamage;
    return Math.max(1, base - benefits.counterReduction - summonBenefits.counterReduction);
  }
  const shield = Math.floor(stageState.legion / counter.shieldDivisor);
  const thin = stageState.legion < counter.thinLegion ? counter.thinPenalty : 0;
  return Math.max(1, Math.max(1, counter.baseDamage - shield) + thin - benefits.counterReduction - summonBenefits.counterReduction);
}

function assaultDamage(stageState, stage, benefits, progression) {
  const assault = stage.commands.assault;
  const summonBenefits = summonEvolutionBenefits(progression?.summons);
  let damage = assault.damage + summonBenefits.assaultDamageBonus;
  if (stageState.possessed) damage += (assault.possessedDamage ?? 0) + benefits.possessedAssaultBonus;
  return damage;
}


function guardAction(state, action) {
  assertStateShape(state);
  if (!ACTIONS.includes(action) || !activeStage(state).commands[action]) return rejected(state, "That command has no place in this stage.");
  if (!canAct(state)) return rejected(state, "This stage is not accepting commands right now.");
  return null;
}

export function createCampaign() {
  return makeCampaign();
}

export function startCampaign(state = createCampaign()) {
  assertStateShape(state);
  if (state.status !== "briefing") return rejected(state, "The campaign is already underway.");
  const next = transition(state, (draft) => {
    draft.status = "active";
    draft.lastMessage = "Cinder Span opens. Follow the spoor before the bridge cools.";
  }, { kind: "start" });
  return accepted(next, next.lastMessage, "awaken");
}

/**
 * Gate for the player-initiated "assault" action only. This does NOT gate the
 * boss's own "boss-strike" auto-attack (see applyEncounterEvent) — a boss can
 * hit an unprepared player even while none of these conditions are met.
 */
function guardAssault(state, stage, current) {
  const assault = stage.commands.assault;
  const encounter = encounterState(current, stage);
  if (encounter && !encounter.bossExposed) {
    const waveNames = stage.encounter.waves.map((wave) => wave.id).join(", ");
    return rejected(state, `Clear every declared wave (${waveNames}) before assaulting the boss.`);
  }
  if (current.nodes < stage.nodeGoal) return rejected(state, "Hold every required node before the boss can be assaulted.");
  if (assault.requiresPossessed && !current.possessed) return rejected(state, `Possess a sentinel before confronting the ${stage.bossName}.`);
  return null;
}

function applyAssault(draft, stage) {
  const target = draft.stage;
  const benefits = rewardBenefits(draft.rewards);
  const damage = assaultDamage(target, stage, benefits, draft.progression);
  target.bossHealth = Math.max(0, target.bossHealth - damage);
  let counter = 0;
  if (target.aegis > 0) {
    target.aegis -= 1;
  } else {
    counter = counterDamage(target, stage, benefits, draft.progression);
    target.integrity = Math.max(0, target.integrity - counter);
  }
  if (target.bossHealth === 0) {
    stageComplete(draft, stage);
  } else if (target.integrity === 0) {
    draft.status = "defeat";
    draft.lastMessage = "The legion loses its anchor. Regroup and retry this stage.";
  } else {
    const aftermath = counter === 0 ? "The Domain turns the counterblow aside." : `The counterblow tears ${counter} integrity.`;
    draft.lastMessage = `${stage.bossName} recoils; ${target.bossHealth} ward strength remains. ${aftermath}`;
  }
}

function applyBreach(draft, damage) {
  const target = draft.stage;
  if (target.aegis > 0) {
    target.aegis -= 1;
    draft.lastMessage = "An abyssal breach strikes, but the aegis absorbs it.";
    return;
  }
  target.integrity = Math.max(0, target.integrity - damage);
  if (target.integrity === 0) {
    draft.status = "defeat";
    draft.lastMessage = "The breach shatters the legion's anchor. Regroup and retry this stage.";
    return;
  }
  draft.lastMessage = `An abyssal breach tears ${damage} integrity.`;
}

function normalizeRecipeId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.recipeId === "string") return value.recipeId;
  return null;
}

function applySummonEvolution(draft, recipeId) {
  const recipe = getSummonRecipe(recipeId);
  if (!recipe) return "That summon recipe does not exist.";
  const summons = sanitizeSummonProgression(draft.progression);
  const currentLevel = summons.levels[recipe.id] ?? 0;
  if (currentLevel >= recipe.maxLevel) return `${recipe.name} is already at maximum evolution.`;
  const essenceCost = recipe.essenceCosts[currentLevel];
  if (summons.essence < essenceCost) {
    return `Not enough summon essence. Need ${essenceCost} but have ${summons.essence}.`;
  }
  summons.essence -= essenceCost;
  summons.levels[recipe.id] = currentLevel + 1;
  draft.lastMessage = `${recipe.name} evolved to level ${currentLevel + 1}.`;
  return null;
}
function checkAndApplyActionMutations(draft, action) {
  const state = draft;
  const blocked = guardAction(state, action);
  if (blocked) return blocked.message;

  const stage = activeStage(state);
  const current = state.stage;
  const progression = stage.progression;
  const benefits = rewardBenefits(state.rewards);
  const summonProgression = sanitizeSummonProgression(state.progression);

  if (action === "hunt") {
    if (current.hunted >= progression.huntGoal) return "The spoor is fully mapped. Extract the gathered shade.";
    const message = current.hunted === 0 ? "You find a heatless footprint in the cinders." : "The second trace exposes the rift's pulse.";
    current.hunted += 1;
    if (current.hunted === progression.huntGoal && benefits.autoExtract) {
      current.extracted = true;
      current.hunted = 0;
      current.souls += progression.soulsPerExtract;
      summonProgression.essence += SUMMON_ESSENCE_PER_EXTRACT;
      draft.lastMessage = `The second spoor opens into a soul cache before the rift can close (+${SUMMON_ESSENCE_PER_EXTRACT} summon essence).`;
    } else {
      draft.lastMessage = message;
    }
  } else if (action === "extract") {
    if (current.hunted < progression.huntGoal) return "Two spoor marks are required before extraction.";
    current.extracted = true;
    current.hunted = 0;
    current.souls += progression.soulsPerExtract;
    summonProgression.essence += SUMMON_ESSENCE_PER_EXTRACT;
    draft.lastMessage = `Four volatile shades tear free from the rift (+${SUMMON_ESSENCE_PER_EXTRACT} summon essence).`;
  } else if (action === "materialize") {
    if (current.souls < progression.materializeCost || current.legion >= current.capacity) {
      return current.souls < progression.materializeCost ? "Extract enough shade before materializing a legion." : "Your legion slots are full.";
    }
    const summonBenefits = summonEvolutionBenefits(state.progression.summons);
    const summoned = Math.min(
      progression.materializeSummon + benefits.materializeBonus + summonBenefits.materializeBonus,
      current.capacity - current.legion
    );
    current.souls -= progression.materializeCost;
    current.legion += summoned;
    draft.lastMessage = `${summoned} shadow ${summoned === 1 ? "answers" : "answer"} your call.`;
  } else if (action === "capture") {
    if (current.legion < 2 || current.nodes >= stage.nodeGoal) {
      return current.legion < 2 ? "A legion of at least two shades must anchor the node." : "Every required node is already held.";
    }
    current.nodes += 1;
    draft.lastMessage = `The node bends beneath the legion's banner (${current.nodes}/${stage.nodeGoal}).`;
  } else if (action === "possess") {
    const command = stage.commands.possess;
    if (current.nodes < command.requiresNodes || current.possessed) {
      return current.possessed ? "A sentinel is already possessed." : "Hold a signal node before taking a sentinel.";
    }
    current.possessed = true;
    draft.lastMessage = "A sentinel's will is folded into your command; its fury rides your assaults.";
  } else if (action === "domain") {
    const command = stage.commands.domain;
    if (current.nodes < command.requiresNodes || current.domainUses >= command.limit) {
      return current.domainUses >= command.limit ? "Lord's Domain may answer only once." : "Secure the throne node before opening the Domain.";
    }
    current.domainUses = 1;
    current.integrity = clamp(current.integrity + command.integrityRestore, 0, benefits.maxIntegrity);
    current.aegis += command.aegis;
    draft.lastMessage = `Lord's Domain unfolds once: the abyss restores ${command.integrityRestore} integrity, and the next ${command.aegis} counterblows break against it.`;
  } else if (action === "assault") {
    const assaultBlocked = guardAssault(state, stage, current);
    if (assaultBlocked) return assaultBlocked.message;
    applyAssault(draft, stage);
  } else {
    return "Unsupported command.";
  }
  return null;
}

export function evolveSummon(state, recipeId) {
  assertStateShape(state);
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  const normalizedRecipeId = normalizeRecipeId(recipeId);
  if (!normalizedRecipeId) return rejected(state, "A summon recipe is required.");

  const testDraft = clone(state);
  sanitizeSummonProgression(testDraft.progression);
  const err = applySummonEvolution(testDraft, normalizedRecipeId);
  if (err) return rejected(state, err);
  const essenceBefore = state.progression.summons?.essence ?? 0;
  const next = transition(state, (draft) => {
    applySummonEvolution(draft, normalizedRecipeId);
  }, {
    kind: "action",
    action: "evolve-summon",
    recipeId: normalizedRecipeId,
    essenceBefore
  });
  return accepted(next, next.lastMessage, "evolve-summon");
}

export function applyAction(state, action, recipeId) {
  if (action === "evolve-summon") return evolveSummon(state, recipeId);
  const testDraft = clone(state);
  if (testDraft.stage && activeStage(testDraft).encounter && !testDraft.stage.encounter) {
    testDraft.stage.encounter = makeEncounterState(activeStage(testDraft));
  }
  const err = checkAndApplyActionMutations(testDraft, action);
  if (err) {
    return rejected(state, err);
  }

  const event = { kind: "action", action };
  const essenceBefore = state.progression.summons?.essence ?? 0;
  const essenceGained = testDraft.progression.summons.essence - essenceBefore;
  if (essenceGained > 0) event.essenceGained = essenceGained;
  const next = transition(state, (draft) => {
    checkAndApplyActionMutations(draft, action);
  }, event);
  return accepted(next, next.lastMessage, action);
}

export function applyEncounterEvent(state, event) {
  assertStateShape(state);
  if (!canAct(state)) return rejected(state, "This stage is not accepting encounter events right now.");
  if (!event || typeof event !== "object" || typeof event.type !== "string") return rejected(state, "Encounter event is invalid.");

  const stage = activeStage(state);
  if (event.stageId !== stage.id) return rejected(state, "Encounter event belongs to a different stage.");

  // Boss auto-attack: the boss threatens anyone inside its declared strike
  // range on its own initiative — independent of wave-clear, possession, or
  // exposure state, and valid even on stages with no wave encounter at all
  // (e.g. veil-citadel, echo-throne). The renderer decides *when* to raise
  // this event (proximity + cooldown, the same pattern wave-start timing
  // already uses); this reducer only decides whether the damage is valid.
  if (event.type === "boss-strike") {
    const pattern = stage.bossPattern;
    if (!pattern) return rejected(state, "This boss has no declared attack pattern.");
    if (state.stage.bossHealth <= 0) return rejected(state, "The boss is already broken.");
    const next = transition(state, (draft) => applyBreach(draft, pattern.damage), { kind: "encounter", event: clone(event) });
    return accepted(next, next.lastMessage, "boss-strike");
  }

  if (!stage.encounter) return rejected(state, "This stage has no declared encounter.");
  const encounter = encounterState(state.stage, stage);

  if (event.type === "boss-assault") {
    const assaultBlocked = guardAssault(state, stage, state.stage);
    if (assaultBlocked) return assaultBlocked;
    const next = transition(state, (draft) => applyAssault(draft, stage), { kind: "encounter", event: clone(event) });
    return accepted(next, next.lastMessage, "boss-assault");
  }

  if (event.type !== "start-wave" && event.type !== "wave-cleared" && event.type !== "breach") {
    return rejected(state, "Encounter event type is unsupported.");
  }
  const activeIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  if (activeIndex === -1) return rejected(state, "The encounter is complete; spawning has stopped.");
  const configuredWave = stage.encounter.waves[activeIndex];
  if (event.waveId !== configuredWave.id) return rejected(state, "Encounter events must target the next declared wave.");

  if (event.type === "start-wave") {
    if (encounter.activeWaveId !== null) return rejected(state, "The declared wave is already active.");
    const preparationLegion = stage.encounter.preparationLegion ?? 0;
    const preparationNodes = stage.encounter.preparationNodes ?? 0;
    if (activeIndex === 0 && (
      state.stage.legion < preparationLegion ||
      state.stage.nodes < preparationNodes
    )) {
      return rejected(state, "Prepare the declared legion and required nodes before starting the encounter.");
    }
    const next = transition(state, (draft) => {
      draft.stage.encounter.activeWaveId = configuredWave.id;
      draft.lastMessage = `${configuredWave.id} wave has reached the battlefield.`;
    }, { kind: "encounter", event: clone(event) });
    return accepted(next, next.lastMessage, "start-wave");
  }

  if (encounter.activeWaveId !== configuredWave.id) {
    return rejected(state, "Start the declared wave before resolving its encounter events.");
  }
  const next = transition(state, (draft) => {
    const targetEncounter = draft.stage.encounter;
    const targetWave = targetEncounter.waves[activeIndex];
    if (event.type === "breach") {
      targetWave.breaches += 1;
      applyBreach(draft, configuredWave.breachDamage);
      return;
    }
    targetWave.cleared = true;
    draft.progression.marks += 2;
    targetEncounter.activeWaveId = null;
    const allCleared = targetEncounter.waves.every((wave) => wave.cleared);
    targetEncounter.bossExposed = allCleared;
    targetEncounter.spawningStopped = allCleared;
    draft.lastMessage = allCleared
      ? `${stage.bossName} is exposed. Spawning has stopped.`
      : `${configuredWave.id} wave cleared. The next wave remains on approach.`;
  }, { kind: "encounter", event: clone(event) });
  return accepted(next, next.lastMessage, event.type);
}

export function chooseReward(state, rewardId) {
  assertStateShape(state);
  if (state.status !== "reward") return rejected(state, "A reward can only be chosen after a stage victory.");
  const stage = activeStage(state);
  const reward = stage.rewards.find((item) => item.id === rewardId);
  if (!reward) return rejected(state, "That reward was not offered by this stage.");

  const next = transition(state, (draft) => {
    draft.rewards.push({ stageId: stage.id, rewardId: reward.id, rewardName: reward.name });
    draft.progression.marks += 4;
    const nextStage = stage.nextStageId ? STAGES_BY_ID[stage.nextStageId] : null;
    if (!nextStage) {
      draft.status = "campaign-complete";
      draft.lastMessage = `${reward.name} is claimed. The ${stage.bossName} is gone, and Abyssal Command endures.`;
      return;
    }
    const benefits = rewardBenefits(draft.rewards);
    const entry = entryBenefits(benefits, nextStage);
    // The anchor re-forms between gates: a photo-finish victory (integrity
    // 0-1) must not open the next stage as an unwinnable retry treadmill.
    // 4 is the measured survival threshold for the declared-wave stages.
    const ENTRY_INTEGRITY_FLOOR = 4;
    const entryIntegrityFloor = nextStage.entryIntegrityFloor ?? ENTRY_INTEGRITY_FLOOR;
    const carried = clamp(
      Math.max(draft.stage.integrity + stage.rewardIntegrityRestore + entry.integrity, entryIntegrityFloor),
      0,
      benefits.maxIntegrity
    );
    draft.stageId = nextStage.id;
    draft.stageIndex = STAGES.indexOf(nextStage);
    draft.status = "active";
    draft.stage = makeStageState(nextStage, draft.rewards, carried);
    draft.lastMessage = `${reward.name} carries into ${nextStage.title}.`;
  }, { kind: "reward", rewardId });
  return accepted(next, next.lastMessage, "reward");
}

export function applyBattleBreach(state) {
  assertStateShape(state);
  if (!canAct(state)) return rejected(state, "The breach cannot reach a stage that is not active.");
  const stage = activeStage(state);
  if (stage.encounter) {
    const encounter = encounterState(state.stage, stage);
    const wave = encounter.waves.find((item) => !item.cleared);
    if (!wave) return rejected(state, "The encounter is complete; no wave can breach.");
    return applyEncounterEvent(state, { type: "breach", stageId: stage.id, waveId: wave.id });
  }
  const next = transition(state, (draft) => applyBreach(draft, 1), { kind: "battle-breach" });
  return accepted(next, next.lastMessage, "battle-breach");
}

function applyTraceEvent(state, event) {
  let result;
  if (event.kind === "start") {
    result = startCampaign(state);
  } else if (event.kind === "action") {
    if (event.action === "evolve-summon" && Number.isInteger(event.essenceBefore)) {
      const seeded = clone(state);
      sanitizeSummonProgression(seeded.progression);
      seeded.progression.summons.essence = event.essenceBefore;
      result = evolveSummon(seeded, event.recipeId);
    } else {
      result = applyAction(state, event.action, event.recipeId);
    }
  } else if (event.kind === "reward") {
    result = chooseReward(state, event.rewardId);
  } else if (event.kind === "retry") {
    result = retryStage(state);
  } else if (event.kind === "battle-breach") {
    result = applyBattleBreach(state);
  } else if (event.kind === "encounter") {
    result = applyEncounterEvent(state, event.event);
  } else if (event.kind === "reserve-command") {
    result = reserveCommand(state, event.action, event.id);
  } else if (event.kind === "reorder-reserved-command") {
    result = reorderReservedCommand(state, event.fromIndex, event.toIndex);
  } else if (event.kind === "cancel-reserved-command") {
    result = cancelReservedCommand(state, event.id);
  } else if (event.kind === "execute-reserved-command") {
    result = executeReservedCommand(state, event.id);
  } else if (event.kind === "upgrade-skill") {
    result = upgradeSkill(state, event.skill);
  } else if (event.kind === "deploy-tactical-object") {
    result = deployTacticalObject(state, event.deployKind, event.cell, event.id);
  } else {
    throw new Error("Save trace contains an unsupported event.");
  }
  assert(result.accepted, "Save trace contains an impossible transition.");
  return result.state;
}

function rebuildStateFromTrace(trace) {
  let state = createCampaign();
  for (const event of trace) {
    state = applyTraceEvent(state, event);
  }
  return state;
}

export function retryStage(state) {
  assertStateShape(state);
  if (state.status === "briefing" || state.status === "campaign-complete" || state.status === "reward") {
    return rejected(state, "There is no active stage to retry.");
  }
  const next = clone(state);
  next.stageId = stateStageId(next);
  let checkpoint = 0;
  for (let index = 0; index < next.trace.length; index += 1) {
    const event = next.trace[index];
    if (event.kind === "start" || event.kind === "reward") checkpoint = index;
  }
  next.trace.splice(checkpoint + 1);

  const replayed = rebuildStateFromTrace(next.trace);

  next.progression = replayed.progression;
  next.commandQueue = replayed.commandQueue;
  next.stage = makeStageState(activeStage(next), next.rewards, next.stage.entryIntegrity);
  next.status = "active";
  next.lastMessage = `${activeStage(next).title} reforms. Your earned boons remain.`;
  next.revision += 1;

  return accepted(next, next.lastMessage, "retry");
}

export function getStageChecklist(state) {
  assertStateShape(state);
  const stage = activeStage(state);
  const current = state.stage;
  const reqLegion = Math.max(2, stage.encounter?.preparationLegion ?? 2);
  const checklist = [
    { id: "hunt", label: `Hunt ${current.hunted}/${stage.progression.huntGoal} rift spoor`, complete: current.hunted >= stage.progression.huntGoal || current.extracted },
    { id: "extract", label: "Extract a soul cache", complete: current.extracted },
    { id: "materialize", label: `Materialize a shadow legion (${current.legion}/${reqLegion})`, complete: current.legion >= reqLegion },
    { id: "capture", label: `Hold ${stage.nodeGoal} tech ${stage.nodeGoal === 1 ? "node" : "nodes"}`, complete: current.nodes >= stage.nodeGoal }
  ];
  if (stage.commands.possess) {
    const isRequired = Boolean(stage.commands.assault?.requiresPossessed);
    checklist.push({
      id: "possess",
      label: "Possess a sentinel",
      complete: current.possessed,
      ...(isRequired ? {} : { optional: true })
    });
  }
  if (stage.commands.domain) {
    checklist.push({
      id: "domain",
      label: "Invoke Lord's Domain once",
      complete: current.domainUses === stage.commands.domain.limit,
      optional: true
    });
  }
  if (stage.encounter) {
    const encounter = encounterState(current, stage);
    for (const wave of encounter.waves) checklist.push({ id: `wave-${wave.id}`, label: `Clear ${wave.id} wave`, complete: wave.cleared });
  }
  checklist.push({ id: "assault", label: `Defeat the ${stage.bossName}`, complete: current.bossHealth === 0 });
  return checklist;
}

export function getAvailableActions(state) {
  return ACTIONS.filter((action) => applyAction(state, action).accepted);
}

export function createSaveEnvelope(state) {
  assertStateShape(state);
  return {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: clone(state.trace)
  };
}

export function restoreSaveEnvelope(envelope) {
  assert(envelope && typeof envelope === "object", "Save envelope must be an object.");
  assert(envelope.schema === SAVE_SCHEMA, "This file is not an Abyssal Command save.");
  assert(envelope.schemaVersion === SAVE_SCHEMA_VERSION, "This save schema is not supported by the Stage 1 encounter rules.");
  assert(envelope.rulesVersion === RULES_VERSION, "This save uses incompatible campaign rules.");
  assert(Array.isArray(envelope.trace), "Save trace is missing.");
  assert(envelope.trace.length <= MAX_TRACE_EVENTS, `Save trace exceeds ${MAX_TRACE_EVENTS} events.`);

  const restored = rebuildStateFromTrace(envelope.trace);
  // Old traces predate summon progression; normalize the missing branch while
  // preserving every replayed stage, reward, and action result.
  sanitizeSummonProgression(restored.progression);
  return restored;
}

export const TACTICAL_METADATA = Object.freeze({
  initialMarks: 8,
  towerCost: 4,
  barricadeCost: 2
});

export function getCommandCooldown(state, command) {
  assertStateShape(state);
  const stage = activeStage(state);
  const commandDef = stage.commands[command];
  if (!commandDef) return 0;
  let baseCooldown = commandDef.cooldown;
  if (baseCooldown === undefined) {
    const defaults = {
      hunt: 4,
      extract: 5,
      materialize: 5,
      capture: 6,
      possess: 10,
      domain: 15,
      assault: 3
    };
    baseCooldown = defaults[command] ?? 0;
  }
  const benefits = getCampaignBenefits(state);
  return baseCooldown * (1 - benefits.cooldownReduction);
}

export function getTacticalProgression(state) {
  assertStateShape(state);
  return {
    marks: state.progression.marks,
    skills: {
      command: state.progression.skills.command,
      fortification: state.progression.skills.fortification,
      mobility: state.progression.skills.mobility
    },
    commandQueue: clone(state.commandQueue),
    deployments: state.stage ? clone(state.stage.deployments) : []
  };
}

export function reserveCommand(state, action, id) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  const stage = activeStage(state);
  if (!stage.commands[action]) return rejected(state, "That command has no place in this stage.");

  const commandLevel = state.progression.skills.command;
  const queueLimit = Math.min(5, commandLevel + 1);
  if (state.commandQueue.length >= queueLimit) {
    return rejected(state, "Command reservation queue is full.");
  }

  const eventId = id || `res-${state.revision}-${state.commandQueue.length}`;
  if (state.commandQueue.some((item) => item.id === eventId)) {
    return rejected(state, "Command reservation ID is already in use.");
  }
  const next = transition(state, (draft) => {
    draft.commandQueue.push({ id: eventId, action });
    draft.lastMessage = `Reserved command: ${action}.`;
  }, { kind: "reserve-command", action, id: eventId });

  return accepted(next, next.lastMessage, "reserve");
}

export function reorderReservedCommand(state, fromIndex, toIndex) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= state.commandQueue.length) {
    return rejected(state, "Invalid fromIndex.");
  }
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= state.commandQueue.length) {
    return rejected(state, "Invalid toIndex.");
  }

  const next = transition(state, (draft) => {
    const [item] = draft.commandQueue.splice(fromIndex, 1);
    draft.commandQueue.splice(toIndex, 0, item);
    draft.lastMessage = "Reordered command queue.";
  }, { kind: "reorder-reserved-command", fromIndex, toIndex });

  return accepted(next, next.lastMessage, "reorder");
}

export function cancelReservedCommand(state, id) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  const index = state.commandQueue.findIndex((item) => item.id === id);
  if (index === -1) {
    return rejected(state, "Command not found in queue.");
  }

  const next = transition(state, (draft) => {
    const qIndex = draft.commandQueue.findIndex((item) => item.id === id);
    if (qIndex !== -1) {
      draft.commandQueue.splice(qIndex, 1);
    }
    draft.lastMessage = "Cancelled reserved command.";
  }, { kind: "cancel-reserved-command", id });

  return accepted(next, next.lastMessage, "cancel");
}

export function checkReservedCommandExecution(state, id) {
  if (!canAct(state)) return { ready: false, message: "This stage is not active." };
  const index = state.commandQueue.findIndex((item) => item.id === id);
  if (index === -1) {
    return { ready: false, message: "Command not found in queue." };
  }
  const action = state.commandQueue[index].action;

  const testDraft = clone(state);
  if (testDraft.stage && activeStage(testDraft).encounter && !testDraft.stage.encounter) {
    testDraft.stage.encounter = makeEncounterState(activeStage(testDraft));
  }
  const err = checkAndApplyActionMutations(testDraft, action);

  if (err) {
    return { ready: false, action, message: `Execution failed: ${err}` };
  }
  return { ready: true, action, message: "" };
}

export function executeReservedCommand(state, id) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  const index = state.commandQueue.findIndex((item) => item.id === id);
  if (index === -1) {
    return rejected(state, "Command not found in queue.");
  }
  const action = state.commandQueue[index].action;

  const testDraft = clone(state);
  if (testDraft.stage && activeStage(testDraft).encounter && !testDraft.stage.encounter) {
    testDraft.stage.encounter = makeEncounterState(activeStage(testDraft));
  }
  const err = checkAndApplyActionMutations(testDraft, action);

  if (err) {
    return rejected(state, `Execution failed: ${err}`);
  }

  const next = transition(state, (draft) => {
    checkAndApplyActionMutations(draft, action);
    const qIndex = draft.commandQueue.findIndex((q) => q.id === id);
    if (qIndex !== -1) {
      draft.commandQueue.splice(qIndex, 1);
    }
    draft.lastMessage = `Executed reserved command: ${action}. ` + draft.lastMessage;
  }, { kind: "execute-reserved-command", id, success: true });

  return accepted(next, next.lastMessage, action);
}

export function upgradeSkill(state, skill) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  if (skill !== "command" && skill !== "fortification" && skill !== "mobility") {
    return rejected(state, "Invalid skill type.");
  }
  const currentLevel = state.progression.skills[skill];
  if (currentLevel >= 5) {
    return rejected(state, `Skill ${skill} is already at maximum level.`);
  }
  const cost = currentLevel * 4;
  if (state.progression.marks < cost) {
    return rejected(state, `Not enough marks. Need ${cost} but have ${state.progression.marks}.`);
  }

  const next = transition(state, (draft) => {
    const currentLvl = draft.progression.skills[skill];
    const skillCost = currentLvl * 4;
    draft.progression.marks -= skillCost;
    draft.progression.skills[skill] += 1;
    draft.lastMessage = `Upgraded ${skill} skill to level ${currentLvl + 1}.`;
  }, { kind: "upgrade-skill", skill });

  return accepted(next, next.lastMessage, "upgrade-skill");
}

export function deployTacticalObject(state, kind, cell, id) {
  if (!canAct(state)) return rejected(state, "This stage is not active.");
  if (kind !== "tower" && kind !== "barricade") {
    return rejected(state, "Invalid deployment kind.");
  }
  if (!cell || typeof cell !== "object" || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
    return rejected(state, "Invalid cell coordinates.");
  }
  const { x, y } = cell;
  if (x < 0 || x >= 24 || y < 0 || y >= 12) {
    return rejected(state, "Placement is out of grid boundaries.");
  }

  const currentDeployments = state.stage.deployments || [];
  const depId = id || `dep-${state.revision}-${currentDeployments.length}`;
  if (currentDeployments.some((deployment) => deployment.id === depId)) {
    return rejected(state, "Deployment ID is already in use.");
  }
  const stageNumber = state.stageIndex + 1;
  const navigation = createStageNavigation(stageNumber);
  const validation = navigation.validateDeployment(cell.x, cell.y, state.stage.deployments, kind);
  if (!validation.valid) {
    return rejected(state, validation.reason);
  }

  const fortificationLevel = state.progression.skills.fortification;
  const currentCount = currentDeployments.filter((d) => d.kind === kind).length;
  const cap = kind === "tower" ? fortificationLevel : (fortificationLevel + 1);
  if (currentCount >= cap) {
    return rejected(state, `Cannot deploy more than ${cap} ${kind}s at fortification level ${fortificationLevel}.`);
  }

  const cost = kind === "tower" ? 4 : 2;
  if (state.progression.marks < cost) {
    return rejected(state, `Not enough marks. Need ${cost} but have ${state.progression.marks}.`);
  }

  const next = transition(state, (draft) => {
    draft.progression.marks -= cost;
    draft.stage.deployments.push({
      id: depId,
      kind,
      cell: { x, y }
    });
    draft.lastMessage = `Deployed ${kind} at (${x}, ${y}).`;
  }, { kind: "deploy-tactical-object", deployKind: kind, cell, id: depId });

  return accepted(next, next.lastMessage, `deploy-${kind}`);
}
