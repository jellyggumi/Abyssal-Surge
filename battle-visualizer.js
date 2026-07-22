// Snapshot-only Canvas2D presentation adapter for the defense session.

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
});

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

function project(entity, width, height) {
  const point = pointOf(entity);
  const isNormalized = entity?.normalized === true || (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
  return isNormalized
    ? { x: (point.x + 1) * width / 2, y: (point.y + 1) * height / 2 }
    : point;
}

function drawUnit(context, entity, width, height, color, radius) {
  const point = project(entity, width, height);
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(2, number(entity?.radius, number(entity?.size, radius))), 0, Math.PI * 2);
  context.fill();
}

/** Canvas fallback adapter retaining the legacy primary export name. */
export class BattleVisualizer {
  constructor(options = {}) {
    this.options = options;
    this.canvas = null;
    this.context = null;
    this.viewport = null;
    this.lastFeedback = null;
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

  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.disposed || !this.canvas || !this.context) return;
    const { width, height } = canvasSize(this.canvas, this.viewport ?? frame?.viewport);
    const context = this.context;

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
    if (snapshot.commander ?? snapshot.player) drawUnit(context, snapshot.commander ?? snapshot.player, width, height, PALETTE.commander, 11);
  }

  onVisualFeedback(inputSeq) {
    this.lastFeedback = inputSeq;
  }

  dispose() {
    this.canvas = null;
    this.context = null;
    this.viewport = null;
    this.disposed = true;
  }

  debugMetrics() {
    return { geometries: 0, textures: 0, programs: 0 };
  }
}
