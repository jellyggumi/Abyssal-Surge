/** Immutable authored data for the renderer-neutral Abyssal Command defense run. */
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

export const RULES_VERSION = "defense-survivor-v1";
export const TICK_RATE = 60;
export const ARENA = freeze({ width: 24000, height: 12000, gateX: 22000, gateY: 6000 });
export const OCTANT_VECTORS = freeze({
  IDLE: freeze({ x: 0, y: 0 }),
  N: freeze({ x: 0, y: -1000 }), NE: freeze({ x: 707, y: -707 }), E: freeze({ x: 1000, y: 0 }),
  SE: freeze({ x: 707, y: 707 }), S: freeze({ x: 0, y: 1000 }), SW: freeze({ x: -707, y: 707 }),
  W: freeze({ x: -1000, y: 0 }), NW: freeze({ x: -707, y: -707 }),
});
export const COMMANDER = freeze({ radius: 360, speed: 4100, basicCooldown: 24, basicDamage: 900, basicRange: 6000 });
export const GATE = freeze({ maxIntegrity: 1000, radius: 900 });
export const TARGET_PRIORITY = freeze({ boss: 0, elite: 1, ranged: 2, guardian: 3, flanker: 4, rusher: 5, interactable: 6 });
export const XP_GROWTH = freeze([30, 55, 85, 120, 160, 205, 255, 310]);
export const ITEMS = freeze({
  "ashen-sigil": { id: "ashen-sigil", name: "Ashen Sigil", description: "기본 공격 피해 +180", damageBonus: 180 },
  "ward-splinter": { id: "ward-splinter", name: "Ward Splinter", description: "관문 최대 내구 +80, 즉시 +80", maxIntegrity: 80, integrity: 80 },
  "echo-compass": { id: "echo-compass", name: "Echo Compass", description: "XP 흡수 반경 +2500", pickupRange: 2500 },
  "hourglass-fragment": { id: "hourglass-fragment", name: "Hourglass Fragment", description: "스킬 쿨다운 10% 감소", cooldownReduction: 0.1 },
  "dawnless-crown-shard": { id: "dawnless-crown-shard", name: "Dawnless Crown Shard", description: "기본 공격 피해 +240, 관문 최대 내구 +120", damageBonus: 240, maxIntegrity: 120, integrity: 120 },
});
export const REWARDS = freeze({
  "ember-cohort-legacy": { id: "ember-cohort-legacy", name: "Ember Cohort Legacy", description: "다음 런의 동료 슬롯에 Ember Cohort 기록", kind: "companion", companionId: "ember-cohort" },
  "rift-lens-archive": { id: "rift-lens-archive", name: "Rift Lens Archive", description: "빙의 보너스를 기록실에 보존", kind: "archive" },
  "stillwater-hourglass": { id: "stillwater-hourglass", name: "Stillwater Hourglass", description: "런 시작 시 스킬 쿨다운 20% 감소", kind: "modifier", cooldownReduction: 0.2 },
  "bulwark-brand": { id: "bulwark-brand", name: "Bulwark Brand", description: "보스 반격 피해 2 감소", kind: "modifier", gateDamageReduction: 2 },
  "veil-vanguard-legacy": { id: "veil-vanguard-legacy", name: "Veil Vanguard Legacy", description: "다음 런 시작 시 그림자 1기 추가", kind: "companion", companionId: "veil-vanguard" },
  "anchor-shard-archive": { id: "anchor-shard-archive", name: "Anchor Shard Archive", description: "다음 스테이지 진입 시 관문 내구 +40", kind: "modifier", integrity: 40 },
  "abyssal-banner": { id: "abyssal-banner", name: "Abyssal Banner", description: "런 시작 및 이후 추출 동료 공격력 +60", kind: "modifier", damageBonus: 60 },
  "throne-echo-record": { id: "throne-echo-record", name: "Throne Echo Record", description: "왕좌의 마지막 서약을 기록", kind: "archive" },
  "dawnless-crown": { id: "dawnless-crown", name: "Dawnless Crown", description: "최종 관문 승리의 왕관을 기록", kind: "archive" },
});
export const AUDIO_CUES = freeze({
  stageStart: { id: "stage-start", waveform: "sine", frequency: 220, duration: 0.18 },
  enemyDefeated: { id: "enemy-defeated", waveform: "triangle", frequency: 160, duration: 0.08 },
  eliteExtracted: { id: "elite-extracted", waveform: "sine", frequency: 420, duration: 0.32 },
  itemCollected: { id: "item-collected", waveform: "sine", frequency: 560, duration: 0.2 },
  growthOffer: { id: "growth-offer", waveform: "triangle", frequency: 320, duration: 0.24 },
  skillCast: { id: "skill-cast", waveform: "sawtooth", frequency: 260, duration: 0.14 },
  bossSpawned: { id: "boss-spawned", waveform: "sawtooth", frequency: 90, duration: 0.5 },
  terminal: { id: "terminal", waveform: "sine", frequency: 120, duration: 0.5 },
});
export const CUTSCENES = freeze({
  "cinder-span": {
    intro: ["심연의 문이 열렸다.", "잿빛 교량에서 재의 메아리를 묶어라."],
    elite: "열기가 없는 불씨가 영혼 웅덩이를 남긴다.",
    victory: "다리 끝의 재가 다음 봉쇄선을 가리킨다.",
    defeat: "군단의 닻이 끊어졌다. 다시 일어나라.",
  },
  "veil-citadel": {
    intro: ["장막 성채가 신호를 삼킨다.", "두 거점을 붙들고 빙의의 힘을 깨워라."],
    elite: "감시석의 빈 투구가 새로운 의지를 기다린다.",
    victory: "거울의 명령이 끊기고 왕좌의 방향이 열린다.",
    defeat: "장막이 다시 닫혔다. 신호를 되찾아라.",
  },
  "echo-throne": {
    intro: ["메아리 왕좌가 마지막 바다 위에 떠 있다.", "한 번뿐인 군주의 영역으로 관문을 버텨라."],
    elite: "왕좌의 잔향이 군단의 맹세를 기억한다.",
    victory: "침묵한 문 앞에서 그림자 군단이 왕좌에 오른다.",
    defeat: "빈 왕좌는 없다. 다시 일어나라.",
  },
  default: {
    intro: ["새 봉쇄선이 신호를 삼킨다.", "관문을 지키고 메아리를 추출하라."],
    elite: "잔향이 다음 전선을 가리킨다.",
    victory: "봉쇄선이 유지되고 다음 관문이 열린다.",
    defeat: "관문이 무너졌다. 다시 일어나라.",
  },
});
export const ANIMATION_CLIPS = freeze({
  commander: Object.freeze(["idle", "walk", "strike", "cast"]),
  enemy: Object.freeze(["idle", "advance", "strike", "defeat"]),
  effects: Object.freeze(["extract", "item", "skill", "reward"]),
});

export const ENEMIES = freeze({
  rusher: { id: "rusher", hp: 3000, speed: 3000, damage: 10, xp: 8, radius: 260 },
  flanker: { id: "flanker", hp: 3600, speed: 3300, damage: 12, xp: 10, radius: 340 },
  guardian: { id: "guardian", hp: 9000, speed: 1700, damage: 20, xp: 18, radius: 540 },
  ranged: { id: "ranged", hp: 2800, speed: 2000, damage: 20, xp: 12, radius: 320, projectileRange: 6000, projectileTicks: 120 },
});
export const COMPANIONS = freeze({
  "ember-cohort": { id: "ember-cohort", name: "Ember Cohort", damage: 420, fireTicks: 36, range: 4600 },
  "rift-lens": { id: "rift-lens", name: "Rift Lens", damage: 540, fireTicks: 48, range: 5200 },
  "veil-vanguard": { id: "veil-vanguard", name: "Veil Vanguard", damage: 360, fireTicks: 28, range: 4000 },
  "anchor-shard": { id: "anchor-shard", name: "Anchor Shard", damage: 720, fireTicks: 70, range: 5600 },
  "throne-echo": { id: "throne-echo", name: "Throne Echo", damage: 480, fireTicks: 38, range: 4800 },
  "dawnless-crown": { id: "dawnless-crown", name: "Dawnless Crown", damage: 600, fireTicks: 52, range: 6000 },
});
export const SKILLS = freeze({
  "rift-bolt": { id: "rift-bolt", role: "active", kind: "active", damage: 1800, cooldown: 180, radius: 0 },
  "soul-lance": { id: "soul-lance", role: "active", kind: "active", damage: 1200, cooldown: 150, radius: 0 },
  "grave-pulse": { id: "grave-pulse", role: "active", kind: "active", damage: 650, cooldown: 240, radius: 3000 },
  "void-aegis": { id: "void-aegis", role: "active", kind: "active", damage: 0, cooldown: 300, radius: 0, integrity: 70 },
  "shadow-step": { id: "shadow-step", role: "active", kind: "active", damage: 900, cooldown: 210, radius: 4500 },
  "eclipse-edge": { id: "eclipse-edge", role: "passive", kind: "passive", basicDamage: 180 },
  "soul-magnet": { id: "soul-magnet", role: "passive", kind: "passive", pickupRange: 1500 },
  "ward-binder": { id: "ward-binder", role: "passive", kind: "passive", maxIntegrity: 120 },
});
export const BOSSES = freeze({
  "s1-cinder-warden": { id: "s1-cinder-warden", hp: 40000, speed: 1800, damage: 200, xp: 100, radius: 900 },
  "s2-veil-tactician": { id: "s2-veil-tactician", hp: 48000, speed: 1650, damage: 200, xp: 110, radius: 900 },
  "s3-gate-sovereign": { id: "s3-gate-sovereign", hp: 60000, speed: 1500, damage: 300, xp: 120, radius: 980 },
  "s4-tide-warden": { id: "s4-tide-warden", hp: 68000, speed: 1500, damage: 200, xp: 130, radius: 980 },
  "s5-pack-herald": { id: "s5-pack-herald", hp: 76000, speed: 2100, damage: 200, xp: 140, radius: 900 },
  "s6-requiem-choir": { id: "s6-requiem-choir", hp: 84000, speed: 1350, damage: 200, xp: 150, radius: 980 },
  "s7-lantern-tyrant": { id: "s7-lantern-tyrant", hp: 92000, speed: 1650, damage: 200, xp: 160, radius: 980 },
  "s8-bridge-colossus": { id: "s8-bridge-colossus", hp: 100000, speed: 1200, damage: 300, xp: 170, radius: 1100 },
  "s9-veiled-concordat": { id: "s9-veiled-concordat", hp: 110000, speed: 1500, damage: 200, xp: 180, radius: 1040 },
  "s10-abyss-regent": { id: "s10-abyss-regent", hp: 150000, speed: 1800, damage: 300, xp: 200, radius: 1100 },
});

const stage = (id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, gateTicks, waves) => freeze({
  id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, gateTicks, waves,
});
export const STAGES = freeze([
  stage("cinder-span", "Cinder Span", "Cinder Warden", 100, "s1-ember-hunter", "rusher", "ember-cohort", "s1-cinder-warden", 720, [[0, "rusher", 4], [180, "flanker", 3], [390, "ranged", 2]]),
  stage("veil-citadel", "Veil Citadel", "Veil Tactician", 115, "s2-veil-sentinel", "flanker", "rift-lens", "s2-veil-tactician", 780, [[0, "rusher", 5], [180, "flanker", 4], [420, "ranged", 3]]),
  stage("echo-throne", "Echo Throne", "Gate Sovereign", 130, "s3-throne-wraith", "ranged", "throne-echo", "s3-gate-sovereign", 840, [[0, "flanker", 5], [210, "ranged", 3], [480, "guardian", 2]]),
  stage("sunken-bastion", "Sunken Bastion", "Tide Warden", 145, "s4-anchor-diver", "guardian", "anchor-shard", "s4-tide-warden", 900, [[0, "rusher", 6], [220, "ranged", 4], [510, "guardian", 2]]),
  stage("howling-sprawl", "Howling Sprawl", "Pack Herald", 160, "s5-pack-sentinel", "guardian", "veil-vanguard", "s5-pack-herald", 960, [[0, "flanker", 6], [240, "ranged", 4], [540, "guardian", 3]]),
  stage("glass-necropolis", "Glass Necropolis", "Requiem Choir", 175, "s6-choir-adept", "ranged", "throne-echo", "s6-requiem-choir", 1020, [[0, "rusher", 7], [260, "ranged", 5], [570, "guardian", 3]]),
  stage("starless-canal", "Starless Canal", "Lantern Tyrant", 190, "s7-toll-keeper", "ranged", "anchor-shard", "s7-lantern-tyrant", 1080, [[0, "flanker", 7], [270, "ranged", 5], [600, "guardian", 4]]),
  stage("shattered-causeway", "Shattered Causeway", "Bridge Colossus", 205, "s8-keystone-warden", "guardian", "ember-cohort", "s8-bridge-colossus", 1140, [[0, "rusher", 8], [280, "ranged", 6], [630, "guardian", 4]]),
  stage("abyss-chancel", "Abyss Chancel", "Veiled Concordat", 220, "s9-oathbound-signatory", "guardian", "dawnless-crown", "s9-veiled-concordat", 1200, [[0, "flanker", 8], [300, "ranged", 6], [660, "guardian", 5]]),
  stage("gate-zenith", "Gate Zenith", "Abyss Regent", 240, "s10-regent-herald", "flanker", "dawnless-crown", "s10-abyss-regent", 1260, [[0, "rusher", 9], [300, "ranged", 7], [690, "guardian", 5]]),
]);
export const STAGE_ITEM_IDS = freeze({
  "cinder-span": "ashen-sigil",
  "veil-citadel": "ward-splinter",
  "echo-throne": "echo-compass",
  "sunken-bastion": "hourglass-fragment",
  "howling-sprawl": "ashen-sigil",
  "glass-necropolis": "ward-splinter",
  "starless-canal": "echo-compass",
  "shattered-causeway": "hourglass-fragment",
  "abyss-chancel": "ashen-sigil",
  "gate-zenith": "dawnless-crown-shard",
});
export const STAGE_REWARD_IDS = freeze({
  "cinder-span": Object.freeze(["ember-cohort-legacy", "stillwater-hourglass", "bulwark-brand"]),
  "veil-citadel": Object.freeze(["rift-lens-archive", "anchor-shard-archive", "abyssal-banner"]),
  "echo-throne": Object.freeze(["throne-echo-record", "veil-vanguard-legacy", "stillwater-hourglass"]),
  "sunken-bastion": Object.freeze(["anchor-shard-archive", "bulwark-brand", "abyssal-banner"]),
  "howling-sprawl": Object.freeze(["veil-vanguard-legacy", "ember-cohort-legacy", "rift-lens-archive"]),
  "glass-necropolis": Object.freeze(["rift-lens-archive", "stillwater-hourglass", "anchor-shard-archive"]),
  "starless-canal": Object.freeze(["abyssal-banner", "bulwark-brand", "throne-echo-record"]),
  "shattered-causeway": Object.freeze(["ember-cohort-legacy", "veil-vanguard-legacy", "abyssal-banner"]),
  "abyss-chancel": Object.freeze(["dawnless-crown", "throne-echo-record", "bulwark-brand"]),
  "gate-zenith": Object.freeze(["dawnless-crown", "throne-echo-record", "rift-lens-archive"]),
});
export const STAGE_BY_ID = freeze(Object.fromEntries(STAGES.map((entry) => [entry.id, entry])));
