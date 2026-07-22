// Snapshot-only presentation adapter for the defense session.
// It deliberately owns neither time nor game input; the session supplies snapshots.

const COLORS = Object.freeze({
  backgroundTop: "#07131f",
  backgroundBottom: "#02050c",
  gate: "#4cc9d8",
  commander: "#f6d365",
  enemy: "#d96078",
  boss: "#b56cff",
  projectile: "#d9f6ff",
  pickup: "#78e08f",
  companion: "#8fb7ff",
});

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function list(snapshot, ...names) {
  for (const name of names) {
    if (Array.isArray(snapshot?.[name])) return snapshot[name];
  }
  return [];
}

function position(entity) {
  const source = entity?.position ?? entity ?? {};
  return {
    x: finite(source.x, finite(entity?.x, 0)),
    y: finite(source.y, finite(entity?.y, 0)),
  };
}

function bounds(canvas, viewport) {
  const width = Math.max(1, finite(viewport?.width, finite(canvas?.width, 1)));
  const height = Math.max(1, finite(viewport?.height, finite(canvas?.height, 1)));
  return { width, height };
}

function screenPoint(entity, width, height) {
  const point = position(entity);
  const normalized = entity?.normalized === true || (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
  return {
    x: normalized ? (point.x + 1) * width / 2 : point.x,
    y: normalized ? (point.y + 1) * height / 2 : point.y,
  };
}

function circle(context, entity, width, height, color, defaultRadius) {
  const point = screenPoint(entity, width, height);
  const radius = Math.max(2, finite(entity?.radius, finite(entity?.size, defaultRadius)));
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
}

/**
 * A renderer-neutral projection retaining the legacy primary export name.
 * This implementation intentionally uses Canvas2D even when mounted in the
 * former enhanced renderer slot, so every environment has the same fallback.
 */
export class RealtimeBattle {
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
    if (this.disposed || !this.context || !this.canvas) return;
    const { width, height } = bounds(this.canvas, this.viewport ?? frame?.viewport);
    const context = this.context;

    context.clearRect(0, 0, width, height);
    const background = context.createLinearGradient?.(0, 0, 0, height);
    if (background) {
      background.addColorStop(0, COLORS.backgroundTop);
      background.addColorStop(1, COLORS.backgroundBottom);
      context.fillStyle = background;
    } else {
      context.fillStyle = COLORS.backgroundBottom;
    }
    context.fillRect(0, 0, width, height);

    const gate = snapshot.gate ?? snapshot.base ?? { x: width / 2, y: height * 0.84 };
    const gatePoint = screenPoint(gate, width, height);
    context.strokeStyle = COLORS.gate;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(gatePoint.x, gatePoint.y, Math.max(18, finite(gate.radius, 28)), Math.PI, 0);
    context.stroke();

    for (const pickup of list(snapshot, "pickups", "drops")) circle(context, pickup, width, height, COLORS.pickup, 5);
    for (const projectile of list(snapshot, "projectiles", "shots")) circle(context, projectile, width, height, COLORS.projectile, 3);
    for (const companion of list(snapshot, "companions", "allies")) circle(context, companion, width, height, COLORS.companion, 8);
    for (const enemy of list(snapshot, "enemies", "hostiles")) circle(context, enemy, width, height, COLORS.enemy, 9);
    for (const boss of list(snapshot, "bosses")) circle(context, boss, width, height, COLORS.boss, 22);
    if (snapshot.boss && !Array.isArray(snapshot.boss)) circle(context, snapshot.boss, width, height, COLORS.boss, 22);
    if (snapshot.commander ?? snapshot.player) circle(context, snapshot.commander ?? snapshot.player, width, height, COLORS.commander, 11);
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
