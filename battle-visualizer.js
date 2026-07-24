// Snapshot-only Canvas2D presentation adapter for the defense session.
import { ANIMATION_CLIPS, AUDIO_CUES, TICK_RATE } from "./defense-catalog.js";
import { drawWorldText } from "./battle-canvas-text.js";

const MAX_VISUAL_EFFECTS = 24;
const MAX_VISUAL_EVENT_KEYS = 128;
const PALETTE = Object.freeze({
  abyss: "#030711",
  mist: "#10233a",
  gate: "#3de1d0",
  commander: "#ffe08a",
  enemy: "#e65b75",
  boss: "#bc75ff",
  projectile: "#ecfbff",
  pickup: "#8eea8d",
  companion: "#7fb7ff",
  critical: "#fff3a1",
  danger: "#ff627a",
  healthTrack: "#432234",
});

const WORLD_TEXTURES = Object.freeze({
  cinderSpanBackground: "./assets/images/battle/world/cinder-span-topdown-plate.webp",
  cinderSpanMap: "./assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
});
let textureCache = new Map();
let textureCacheOwner = null;
const CATALOG_EFFECTS = new Set([...ANIMATION_CLIPS.commander, ...ANIMATION_CLIPS.effects]);
const FEEDBACK_CUES = Object.freeze({
  CRITICAL_HIT: AUDIO_CUES.criticalHit,
  COMMANDER_DAMAGED: AUDIO_CUES.impactHit,
  GATE_BREACHED: AUDIO_CUES.impactHit,
  HAZARD_DAMAGE: AUDIO_CUES.impactHit,
  OBJECTIVE_FAILED: AUDIO_CUES.impactHit,
  ITEM_COLLECTED: AUDIO_CUES.itemCollected,
  TERRAIN_RECOVERY: AUDIO_CUES.itemCollected,
  GROWTH_OFFER: AUDIO_CUES.growthOffer,
  SKILL_SELECTED: AUDIO_CUES.growthOffer,
  SKILL_CAST: AUDIO_CUES.skillCast,
  REWARD_SELECTED: AUDIO_CUES.terminal,
  TERMINAL: AUDIO_CUES.terminal,
  ELITE_EXTRACTED: AUDIO_CUES.eliteExtracted,
  BOSS_SPAWNED: AUDIO_CUES.bossSpawned,
});
const FEEDBACK_EFFECTS = Object.freeze({
  CRITICAL_HIT: "skill",
  COMMANDER_DAMAGED: "damage",
  GATE_BREACHED: "damage",
  HAZARD_DAMAGE: "damage",
  OBJECTIVE_FAILED: "damage",
  ITEM_COLLECTED: "item",
  TERRAIN_RECOVERY: "echo-recovery",
  GROWTH_OFFER: "skill",
  SKILL_SELECTED: "skill",
  SKILL_CAST: "skill",
  REWARD_SELECTED: "reward",
  TERMINAL: "reward",
  ELITE_EXTRACTED: "extract",
  BOSS_SPAWNED: "extraction-ready",
});

function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

function number(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function entities(snapshot, names) {
  for (const name of names) {
    if (Array.isArray(snapshot?.[name])) return snapshot[name];
  }
  return [];
}

function pointOf(entity) {
  const point = entity?.position ?? entity ?? {};
  return {
    x: number(point.x, number(entity?.x, 0)),
    y: number(point.y, number(entity?.y, 0)),
  };
}

function canvasSize(canvas, viewport) {
  return {
    width: Math.max(1, number(viewport?.width, number(canvas?.width, 1))),
    height: Math.max(1, number(viewport?.height, number(canvas?.height, 1))),
  };
}

function cameraOffset(frame, width, height) {
  const camera = frame?.camera ?? {};
  return {
    x: Math.max(-width, Math.min(width, number(camera.x, 0))),
    y: Math.max(-height, Math.min(height, number(camera.y, 0))),
  };
}

function project(entity, width, height) {
  const point = pointOf(entity);
  const isNormalized = entity?.normalized === true || (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
  return isNormalized
    ? { x: (point.x + 1) * width / 2, y: (point.y + 1) * height / 2 }
    : point;
}

function radiusOf(entity, fallback) {
  return Math.max(2, number(entity?.radius, number(entity?.size, fallback)));
}

const WORLD_WIDTH = 24000;
const WORLD_HEIGHT = 12000;

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function worldColor(seed, lightness, alpha = 1) {
  let hash = 0;
  for (const character of text(seed, "neutral-terrain")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return `hsla(${Math.abs(hash) % 360} 58% ${lightness}% / ${alpha})`;
}

function terrainPoint(value, terrain, width, height) {
  const point = value?.position ?? value ?? {};
  const x = number(point.x, 0);
  const y = number(point.y, 0);
  if (point.normalized === true || (Math.abs(x) <= 1 && Math.abs(y) <= 1)) {
    return { x: (x + 1) * width / 2, y: (y + 1) * height / 2 };
  }
  const bounds = terrain?.bounds ?? terrain?.worldBounds ?? {};
  const minX = number(bounds.minX, 0);
  const minY = number(bounds.minY, 0);
  const maxX = number(bounds.maxX, number(bounds.width, WORLD_WIDTH));
  const maxY = number(bounds.maxY, number(bounds.height, WORLD_HEIGHT));
  return {
    x: (x - minX) * width / Math.max(1, maxX - minX),
    y: (y - minY) * height / Math.max(1, maxY - minY),
  };
}

function terrainRadius(value, terrain, width, height, fallback) {
  const radius = number(value?.radius, fallback);
  const point = value?.position ?? value ?? {};
  if (point.normalized === true || (Math.abs(number(point.x, 2)) <= 1 && Math.abs(number(point.y, 2)) <= 1)) {
    return Math.max(8, radius * width / 2);
  }
  const bounds = terrain?.bounds ?? terrain?.worldBounds ?? {};
  const worldWidth = Math.max(1, number(bounds.maxX, number(bounds.width, WORLD_WIDTH)) - number(bounds.minX, 0));
  const worldHeight = Math.max(1, number(bounds.maxY, number(bounds.height, WORLD_HEIGHT)) - number(bounds.minY, 0));
  return Math.max(8, radius * Math.min(width / worldWidth, height / worldHeight));
}

function canDraw(context, ...methods) {
  return methods.every((method) => typeof context?.[method] === "function");
}

function drawMapLabel(context, label, point, color, portrait) {
  if (!label || !context.fillText) return;
  context.save?.();
  context.fillStyle = color;
  context.font = "600 11px system-ui, sans-serif";
  context.textAlign = "center";
  drawWorldText(context, label, point.x, Math.max(18, point.y - 10), portrait);
  context.restore?.();
}

function drawChevron(context, from, to, color) {
  if (!canDraw(context, "beginPath", "moveTo", "lineTo", "stroke")) return;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 10;
  context.save?.();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - Math.cos(angle - 0.55) * size, to.y - Math.sin(angle - 0.55) * size);
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - Math.cos(angle + 0.55) * size, to.y - Math.sin(angle + 0.55) * size);
  context.stroke();
  context.restore?.();
}


function loadTexture(source) {
  if (!source || typeof globalThis.Image !== "function") return null;
  // A test harness (or any caller) can swap globalThis.Image between mock
  // classes at runtime; cached instances from a prior Image constructor are
  // not valid results for the current one, so the cache is scoped to
  // "images created by the currently-installed Image class" rather than
  // living forever at module scope. Production never swaps globalThis.Image,
  // so this is a no-op invalidation there.
  if (textureCacheOwner !== globalThis.Image) {
    textureCache = new Map();
    textureCacheOwner = globalThis.Image;
  }
  if (textureCache.has(source)) return textureCache.get(source);
  try {
    const image = new globalThis.Image();
    image.decoding = "async";
    image.src = source;
    textureCache.set(source, image);
    return image;
  } catch {
    return null;
  }
}

function drawOptionalWorldImage(context, source, x, y, width, height, alpha) {
  if (!canDraw(context, "drawImage")) return;
  const image = loadTexture(source);
  if (!image?.complete || !image.naturalWidth) return;
  try {
    context.save?.();
    context.globalAlpha = alpha;
    context.drawImage(image, x, y, width, height);
  } catch {
    // Canvas and Image shims are presentation-only; the procedural world remains visible.
  } finally {
    context.restore?.();
  }
}

function drawCinderSpanArtwork(context, projection, width, height) {
  if (projection?.stageId !== "cinder-span") return;
  drawOptionalWorldImage(context, WORLD_TEXTURES.cinderSpanBackground, -width, -height, width * 3, height * 3, 0.2);
  const inset = Math.min(width, height) * 0.07;
  drawOptionalWorldImage(context, WORLD_TEXTURES.cinderSpanMap, inset, inset, width - inset * 2, height - inset * 2, 0.12);
}
function drawStageWorld(context, snapshot, width, height, tick, reducedMotion, portrait) {
  const projection = snapshot?.presentation ?? {};
  const profile = projection.stagePresentation ?? {};
  const terrain = projection.terrain ?? {};
  const labels = profile.mapLabels ?? terrain.mapLabels ?? {};
  const paletteSeed = text(profile.palette?.surface, text(profile.terrain?.patternId, projection.stageId));
  const contour = worldColor(text(profile.palette?.contour, paletteSeed), 58, 0.28);
  const terrainColor = worldColor(paletteSeed, 30, 0.32);
  const accent = worldColor(text(profile.palette?.objective, paletteSeed), 72, 0.78);
  const hazardColor = worldColor(text(profile.palette?.hazard, "hazard"), 68, 0.82);
  const tactics = terrain.tactics ?? terrain;
  const chokepath = tactics.chokepath;
  const flank = tactics.flank;
  const elevation = tactics.elevation;
  const hazard = tactics.hazard;
  const occupation = tactics.occupation;
  const extraction = tactics.extraction;

  context.save?.();
  context.fillStyle = terrainColor;
  context.fillRect(-width, -height, width * 3, height * 3);
  drawCinderSpanArtwork(context, projection, width, height);
  if (canDraw(context, "beginPath", "moveTo", "lineTo", "stroke")) {
    context.strokeStyle = contour;
    context.lineWidth = 1;
    for (let index = -height; index < width + height; index += 44) {
      context.beginPath();
      context.moveTo(index, 0);
      context.lineTo(index + height, height);
      context.stroke();
    }
  }

  if (chokepath) {
    const center = terrainPoint(chokepath, terrain, width, height);
    const halfWidth = terrainRadius({ ...chokepath, radius: number(chokepath.halfWidth, 900) }, terrain, width, height, 900);
    context.fillStyle = worldColor(paletteSeed, 44, 0.18);
    context.fillRect(center.x - halfWidth, 0, halfWidth * 2, height);
    if (canDraw(context, "beginPath", "moveTo", "lineTo", "stroke")) {
      context.strokeStyle = accent;
      context.lineWidth = 2;
      context.setLineDash?.([8, 6]);
      for (const offset of [-halfWidth, halfWidth]) {
        context.beginPath();
        context.moveTo(center.x + offset, 0);
        context.lineTo(center.x + offset, height);
        context.stroke();
      }
      context.setLineDash?.([]);
    }
    drawMapLabel(context, text(labels.chokepath, text(chokepath.id)), { x: center.x, y: height * 0.16 }, accent, portrait);
  }

  if (flank && chokepath) {
    const entry = terrainPoint(flank, terrain, width, height);
    const route = terrainPoint(chokepath, terrain, width, height);
    drawChevron(context, entry, route, accent);
    drawMapLabel(context, text(labels.flank, text(flank.id)), entry, accent, portrait);
  }

  const spawnDirections = Array.isArray(tactics.spawnDirections) ? tactics.spawnDirections.slice(0, 3) : [];
  const spawnPoints = { W: { x: 10, y: height / 2 }, NW: { x: width * 0.12, y: 10 }, SW: { x: width * 0.12, y: height - 10 } };
  for (const direction of spawnDirections) {
    const entry = spawnPoints[direction];
    if (entry) drawChevron(context, entry, { x: entry.x + width * 0.06, y: entry.y + (height / 2 - entry.y) * 0.08 }, contour);
  }

  if (elevation) {
    const point = terrainPoint(elevation, terrain, width, height);
    context.strokeStyle = contour;
    context.lineWidth = 2;
    if (canDraw(context, "beginPath", "arc", "stroke")) {
      for (let step = 0; step < 3; step += 1) {
        const radius = 13 + step * 8;
        context.beginPath();
        context.arc(point.x, point.y, radius, Math.PI * 1.1, Math.PI * 1.9);
        context.stroke();
      }
    }
    if (canDraw(context, "beginPath", "moveTo", "lineTo", "fill")) {
      context.fillStyle = accent;
      context.beginPath();
      context.moveTo(point.x, point.y - 18);
      context.lineTo(point.x - 10, point.y + 12);
      context.lineTo(point.x + 10, point.y + 12);
      context.closePath?.();
      context.fill();
    }
    drawMapLabel(context, text(labels.elevation, text(elevation.id)), point, accent, portrait);
  }

  if (hazard) {
    const point = terrainPoint(hazard, terrain, width, height);
    const radius = terrainRadius(hazard, terrain, width, height, 900);
    if (canDraw(context, "beginPath", "arc", "stroke")) {
      context.strokeStyle = hazardColor;
      context.lineWidth = 3;
      context.setLineDash?.(reducedMotion ? [3, 5] : [5, 4]);
      context.lineDashOffset = reducedMotion ? 0 : -(tick % 12);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash?.([]);
      context.lineDashOffset = 0;
    }
    drawMapLabel(context, text(labels.hazard, text(hazard.id)), { x: point.x, y: point.y - radius }, hazardColor, portrait);
  }

  if (occupation) {
    const point = terrainPoint(occupation, terrain, width, height);
    const radius = terrainRadius(occupation, terrain, width, height, 760);
    context.strokeStyle = accent;
    context.lineWidth = 3;
    if (canDraw(context, "beginPath", "arc", "stroke")) {
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
    }
    if (canDraw(context, "beginPath", "moveTo", "lineTo", "stroke")) {
      for (let segment = 0; segment < 4; segment += 1) {
        const angle = segment * Math.PI / 2;
        context.beginPath();
        context.moveTo(point.x + Math.cos(angle) * (radius - 6), point.y + Math.sin(angle) * (radius - 6));
        context.lineTo(point.x + Math.cos(angle) * (radius + 6), point.y + Math.sin(angle) * (radius + 6));
        context.stroke();
      }
    }
    drawMapLabel(context, text(labels.occupation, text(occupation.id)), point, accent, portrait);

    if (extraction) {
      const extractionPoint = terrainPoint(extraction, terrain, width, height);
      if (canDraw(context, "beginPath", "moveTo", "lineTo", "stroke")) {
        context.setLineDash?.([5, 6]);
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(extractionPoint.x, extractionPoint.y);
        context.stroke();
        context.setLineDash?.([]);
        context.beginPath();
        context.moveTo(extractionPoint.x - 7, extractionPoint.y);
        context.lineTo(extractionPoint.x + 7, extractionPoint.y);
        context.moveTo(extractionPoint.x, extractionPoint.y - 7);
        context.lineTo(extractionPoint.x, extractionPoint.y + 7);
        context.stroke();
      }
      drawMapLabel(context, text(labels.extraction, text(extraction.id)), extractionPoint, accent, portrait);
    }
  }

  const landmark = Array.isArray(profile.landmarks) ? profile.landmarks[0] : null;
  if (landmark && elevation) drawMapLabel(context, text(landmark.label, text(landmark.id)), terrainPoint(elevation, terrain, width, height), accent, portrait);
  const atmosphere = text(profile.atmosphere?.motif, text(profile.terrain?.label));
  if (atmosphere && context.fillText) {
    context.fillStyle = worldColor(paletteSeed, 82, 0.66);
    context.font = "600 10px system-ui, sans-serif";
    context.textAlign = "left";
    drawWorldText(context, atmosphere, 16, height - 16, portrait);
  }
  context.restore?.();
}

function drawUnit(context, entity, width, height, color, radius) {
  const point = project(entity, width, height);
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, radiusOf(entity, radius), 0, Math.PI * 2);
  context.fill();
}

function healthRatio(entity) {
  const current = number(entity?.integrity, number(entity?.hp, number(entity?.health, NaN)));
  const maximum = number(entity?.maxIntegrity, number(entity?.maxHp, number(entity?.maxHealth, NaN)));
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return null;
  return Math.max(0, Math.min(1, current / maximum));
}

function healthColor(ratio) {
  return `hsl(${Math.round(6 + ratio * 138)} 82% 64%)`;
}

function drawHealthRing(context, entity, width, height, fallbackRadius) {
  const ratio = healthRatio(entity);
  if (ratio === null) return;
  const point = project(entity, width, height);
  const radius = radiusOf(entity, fallbackRadius) + 5;
  context.save?.();
  context.lineWidth = 2;
  context.strokeStyle = PALETTE.healthTrack;
  context.beginPath();
  context.arc(point.x, point.y, radius, -Math.PI / 2, Math.PI * 1.5);
  context.stroke();
  context.strokeStyle = healthColor(ratio);
  context.beginPath();
  context.arc(point.x, point.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  context.stroke();
  context.restore?.();
}

function feedbackKey(event) {
  if (event?.eventId) return String(event.eventId);
  return [
    event?.version ?? "",
    event?.tick ?? "",
    event?.eventSequence ?? "",
    event?.type ?? "",
    event?.entityId ?? event?.enemyId ?? "",
    event?.targetId ?? "",
    event?.itemId ?? event?.rewardId ?? "",
  ].join(":");
}

function effectAnchor(snapshot, event) {
  const targetId = event?.targetId ?? event?.entityId ?? event?.enemyId ?? "";
  if (targetId === "gate" || event?.type === "GATE_BREACHED") return snapshot?.gate ?? snapshot?.base;
  if (targetId === "commander" || event?.type === "COMMANDER_DAMAGED") return snapshot?.commander ?? snapshot?.player;
  for (const entity of [
    ...entities(snapshot, ["enemies", "hostiles"]),
    ...entities(snapshot, ["bosses"]),
    snapshot?.boss,
  ]) {
    if (entity?.id === targetId) return entity;
  }
  return snapshot?.commander ?? snapshot?.player ?? snapshot?.gate ?? snapshot?.base;
}

function effectColor(cue) {
  if (cue?.id === AUDIO_CUES.criticalHit.id) return PALETTE.critical;
  if (cue?.id === AUDIO_CUES.itemCollected.id) return PALETTE.pickup;
  if (cue?.id === AUDIO_CUES.growthOffer.id || cue?.id === AUDIO_CUES.terminal.id) return PALETTE.boss;
  if (cue?.id === AUDIO_CUES.impactHit.id) return PALETTE.danger;
  return PALETTE.gate;
}

function drawEffect(context, effect, tick, width, height, reducedMotion) {
  const span = Math.max(1, effect.untilTick - effect.startTick);
  const progress = reducedMotion ? 0 : Math.max(0, Math.min(1, (tick - effect.startTick) / span));
  const point = project(effect.anchor, width, height);
  const radius = radiusOf(effect.anchor, 10) * (1 + progress * 1.6);
  context.save?.();
  context.globalAlpha = reducedMotion ? 1 : Math.max(0.18, 1 - progress);
  context.strokeStyle = effectColor(effect.cue);
  context.lineWidth = effect.cue.id === AUDIO_CUES.criticalHit.id ? 3 : 2;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();
  if (effect.cue.id === AUDIO_CUES.criticalHit.id) {
    context.beginPath();
    context.moveTo(point.x - radius, point.y);
    context.lineTo(point.x + radius, point.y);
    context.moveTo(point.x, point.y - radius);
    context.lineTo(point.x, point.y + radius);
    context.stroke();
  }
  context.restore?.();
}

/** Canvas fallback adapter retaining the legacy primary export name. */
export class BattleVisualizer {
  constructor(options = {}) {
    this.options = options;
    this.canvas = null;
    this.context = null;
    this.viewport = null;
    this.lastFeedback = null;
    this.pendingInputFeedback = null;
    this.visualEffects = [];
    this.visualEventKeys = new Set();
    this.reducedMotion = options.reducedMotion ?? prefersReducedMotion();
    this.disposed = false;
  }

  mount({ canvas, handoff, viewport } = {}) {
    void handoff;
    this.dispose();
    this.canvas = canvas ?? null;
    this.viewport = viewport ?? null;
    this.context = this.canvas?.getContext?.("2d") ?? null;
    this.disposed = false;
    return this;
  }

  rememberVisualEvent(key) {
    if (this.visualEventKeys.has(key)) return false;
    this.visualEventKeys.add(key);
    if (this.visualEventKeys.size > MAX_VISUAL_EVENT_KEYS) {
      this.visualEventKeys.delete(this.visualEventKeys.values().next().value);
    }
    return true;
  }

  addEffect(snapshot, event, cue, animation, tick) {
    if (!cue || !CATALOG_EFFECTS.has(animation)) return;
    const anchor = effectAnchor(snapshot, event);
    if (!anchor) return;
    const startTick = number(event?.tick, tick);
    this.visualEffects.push({
      anchor: { ...pointOf(anchor), normalized: anchor.normalized === true, radius: radiusOf(anchor, 10) },
      cue,
      startTick,
      untilTick: startTick + Math.max(1, Math.ceil(cue.duration * TICK_RATE)),
    });
    if (this.visualEffects.length > MAX_VISUAL_EFFECTS) this.visualEffects.shift();
  }

  collectFeedback(snapshot) {
    const tick = number(snapshot?.tick, 0);
    this.visualEffects = this.visualEffects.filter((effect) => effect.untilTick > tick);
    for (const event of Array.isArray(snapshot?.events) ? snapshot.events : []) {
      const cue = FEEDBACK_CUES[event?.type];
      const animation = FEEDBACK_EFFECTS[event?.type];
      const key = feedbackKey(event);
      if (cue && animation && this.rememberVisualEvent(key)) this.addEffect(snapshot, event, cue, animation, tick);
    }
    if (this.pendingInputFeedback !== null) {
      this.addEffect(snapshot, { tick, type: "INPUT_ACK" }, AUDIO_CUES.stageStart, ANIMATION_CLIPS.commander[0], tick);
      this.pendingInputFeedback = null;
    }
  }

  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.disposed || !this.canvas || !this.context) return;
    const { width, height } = canvasSize(this.canvas, this.viewport ?? frame?.viewport);
    const context = this.context;
    const tick = number(snapshot.tick, 0);
    this.collectFeedback(snapshot);

    context.clearRect(0, 0, width, height);
    const mist = context.createRadialGradient?.(width / 2, height * 0.5, 0, width / 2, height * 0.5, Math.max(width, height));
    if (mist) {
      mist.addColorStop(0, PALETTE.mist);
      mist.addColorStop(1, PALETTE.abyss);
      context.fillStyle = mist;
    } else {
      context.fillStyle = PALETTE.abyss;
    }
    context.fillRect(0, 0, width, height);
    const camera = cameraOffset(frame, width, height);
    context.save?.();
    context.translate?.(camera.x, camera.y);
    drawStageWorld(context, snapshot, width, height, tick, this.reducedMotion, frame?.portrait === true);

    const gate = snapshot.gate ?? snapshot.base ?? { x: width / 2, y: height * 0.84 };
    const gatePoint = project(gate, width, height);
    context.strokeStyle = PALETTE.gate;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(gatePoint.x, gatePoint.y, Math.max(18, number(gate.radius, 28)), Math.PI, 0);
    context.stroke();

    for (const pickup of entities(snapshot, ["pickups", "drops"])) drawUnit(context, pickup, width, height, PALETTE.pickup, 5);
    for (const projectile of entities(snapshot, ["projectiles", "shots"])) drawUnit(context, projectile, width, height, PALETTE.projectile, 3);
    for (const companion of entities(snapshot, ["companions", "allies"])) drawUnit(context, companion, width, height, PALETTE.companion, 8);
    for (const enemy of entities(snapshot, ["enemies", "hostiles"])) drawUnit(context, enemy, width, height, PALETTE.enemy, 9);
    for (const boss of entities(snapshot, ["bosses"])) drawUnit(context, boss, width, height, PALETTE.boss, 22);
    if (snapshot.boss && !Array.isArray(snapshot.boss)) drawUnit(context, snapshot.boss, width, height, PALETTE.boss, 22);
    const commander = snapshot.commander ?? snapshot.player;
    if (commander) drawUnit(context, commander, width, height, PALETTE.commander, 11);
    drawHealthRing(context, gate, width, height, 28);
    if (commander) drawHealthRing(context, commander, width, height, 11);
    this.visualEffects.forEach((effect) => drawEffect(context, effect, tick, width, height, this.reducedMotion));
    context.restore?.();
  }

  onVisualFeedback(inputSeq) {
    this.lastFeedback = inputSeq;
    this.pendingInputFeedback = inputSeq;
  }

  dispose() {
    this.canvas = null;
    this.context = null;
    this.viewport = null;
    this.pendingInputFeedback = null;
    this.visualEffects.length = 0;
    this.visualEventKeys.clear();
    this.disposed = true;
  }

  debugMetrics() {
    return { geometries: 0, textures: 0, programs: 0 };
  }
}
