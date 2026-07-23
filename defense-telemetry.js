const FORMAT = "abyssal-defense-telemetry";
export const TELEMETRY_SCHEMA_VERSION = 2;
const DEFAULT_MAX_RECORDS = 4096;
const MAX_RECORDS_LIMIT = 16384;
const DEFAULT_SNAPSHOT_INTERVAL_TICKS = 60;
const DEFAULT_FRAME_SAMPLE_INTERVAL = 60;
const SIMULATION_FIELDS = Object.freeze([
  "tick", "stageId", "enemyId", "eliteId", "entityId", "prototype", "companionId",
  "projectileId", "sourceId", "targetId", "from", "to", "hit", "guardedBy",
  "itemId", "skillId", "rewardId", "alreadyOwned", "damage", "expiresAt", "outcome",
  "choices", "rewardChoices", "objectiveId", "occupationPointId", "hazardId", "policyId",
  "spawnDirection", "recovery", "hp", "maxHp", "bossTtkTicks", "currentValue", "upgradedValue",
  "baseDamage", "finalDamage", "critical", "chanceBp", "multiplierBp",
  "healthBefore", "healthAfter", "simTick", "baseCooldownTicks", "effectiveCooldownTicks",
  "setTick", "readyTick", "targetCount",
  "bossId", "cooldownReductionBp", "owner", "shield",
]);

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function boundedInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

function cloneValue(value) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return String(value);
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function eventIdentity(event) {
  return SIMULATION_FIELDS.map((field) => JSON.stringify(cloneValue(event[field]))).join("|");
}

/**
 * Bounded, session-memory telemetry observer. It only accepts detached values supplied by callers;
 * it never changes simulation/campaign state and never performs storage or network I/O.
 */
export class DefenseTelemetry {
  constructor({
    maxRecords = DEFAULT_MAX_RECORDS,
    snapshotIntervalTicks = DEFAULT_SNAPSHOT_INTERVAL_TICKS,
    frameSampleInterval = DEFAULT_FRAME_SAMPLE_INTERVAL,
    now = defaultNow,
  } = {}) {
    this.maxRecords = boundedInteger(maxRecords, DEFAULT_MAX_RECORDS, MAX_RECORDS_LIMIT);
    this.snapshotIntervalTicks = boundedInteger(snapshotIntervalTicks, DEFAULT_SNAPSHOT_INTERVAL_TICKS);
    this.frameSampleInterval = boundedInteger(frameSampleInterval, DEFAULT_FRAME_SAMPLE_INTERVAL);
    this.now = typeof now === "function" ? now : defaultNow;
    this.records = [];
    this.sequence = 0;
    this.runSequence = 0;
    this.runId = null;
    this.droppedRecords = 0;
    this.frameCount = 0;
    this.frameDurations = [];
    this.lastSnapshot = null;
    this.simulationTick = null;
    this.simulationEventKeys = new Set();
    this.reducedMotion = null;
  }

  append(type, payload = {}, atMs = this.now()) {
    const record = Object.freeze({
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      sequence: ++this.sequence,
      runId: this.runId,
      type,
      atMs: Math.round(finiteNumber(atMs) * 1000) / 1000,
      payload: Object.freeze(cloneValue(payload)),
    });
    if (this.records.length >= this.maxRecords) {
      this.records.shift();
      this.droppedRecords += 1;
    }
    this.records.push(record);
    return record;
  }

  startRun({ stageId, seed, rulesVersion, reducedMotion = false } = {}) {
    this.runId = `run-${++this.runSequence}`;
    this.frameCount = 0;
    this.frameDurations.length = 0;
    this.lastSnapshot = null;
    this.simulationTick = null;
    this.simulationEventKeys.clear();
    this.reducedMotion = Boolean(reducedMotion);
    return this.append("RUN_STARTED", {
      stageId: stageId ?? null,
      seed: Number.isInteger(seed) ? seed >>> 0 : null,
      rulesVersion: rulesVersion ?? null,
      tickRate: 60,
      reducedMotion: this.reducedMotion,
    });
  }

  recordSnapshot(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.tick)) return null;
    const next = {
      tick: snapshot.tick,
      defeatedCount: finiteNumber(snapshot.progress?.defeated),
      gateIntegrity: finiteNumber(snapshot.gate?.integrity),
      gateMaxIntegrity: finiteNumber(snapshot.gate?.maxIntegrity),
      activeEnemies: Array.isArray(snapshot.enemies) ? snapshot.enemies.length : 0,
      terminal: snapshot.terminal ?? null,
    };
    const previous = this.lastSnapshot;
    const shouldRecord = !previous
      || next.tick - previous.tick >= this.snapshotIntervalTicks
      || next.defeatedCount !== previous.defeatedCount
      || next.gateIntegrity !== previous.gateIntegrity
      || next.terminal !== previous.terminal;
    if (!shouldRecord) return null;
    this.lastSnapshot = next;
    return this.append("RUN_SNAPSHOT", next);
  }

  recordSimulationEvents(events) {
    if (!Array.isArray(events)) return [];
    const appended = [];
    for (const event of events) {
      if (!event || typeof event.type !== "string") continue;
      if (event.tick !== this.simulationTick) {
        this.simulationTick = event.tick;
        this.simulationEventKeys.clear();
      }
      const identity = `${event.type}|${eventIdentity(event)}`;
      if (this.simulationEventKeys.has(identity)) continue;
      this.simulationEventKeys.add(identity);
      const payload = {};
      for (const field of SIMULATION_FIELDS) {
        if (event[field] !== undefined) payload[field] = cloneValue(event[field]);
      }
      appended.push(this.append(event.type, payload));
    }
    return appended;
  }

  recordInputFeedback({ inputSeq, type, inputAtMs, visibleAtMs, tick } = {}) {
    const admitted = finiteNumber(inputAtMs, this.now());
    const visible = finiteNumber(visibleAtMs, admitted);
    return this.append("INPUT_VISIBLE", {
      inputSeq: Number.isInteger(inputSeq) ? inputSeq : null,
      inputType: type ?? null,
      inputAtMs: admitted,
      visibleAtMs: visible,
      latencyMs: Math.max(0, visible - admitted),
      tick: Number.isFinite(tick) ? tick : null,
    }, visible);
  }

  recordFrameProbe({ frameDurationMs, heapUsedBytes, atMs } = {}) {
    const duration = finiteNumber(frameDurationMs, -1);
    if (duration < 0) return null;
    this.frameCount += 1;
    this.frameDurations.push(duration);
    if (this.frameDurations.length < this.frameSampleInterval) return null;
    const durations = this.frameDurations.splice(0);
    const ordered = [...durations].sort((left, right) => left - right);
    const total = durations.reduce((sum, value) => sum + value, 0);
    const p95Index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
    return this.append("FRAME_PROBE", {
      sampleCount: durations.length,
      meanFrameMs: total / durations.length,
      p95FrameMs: ordered[p95Index],
      maxFrameMs: ordered.at(-1),
      longFrameCount: durations.filter((value) => value > 16.7).length,
      heapUsedBytes: Number.isFinite(heapUsedBytes) ? Math.max(0, Math.trunc(heapUsedBytes)) : null,
    }, atMs);
  }

  recordReducedMotion(enabled, source = "media-query") {
    const next = Boolean(enabled);
    if (next === this.reducedMotion) return null;
    this.reducedMotion = next;
    return this.append("REDUCED_MOTION_CHANGED", { enabled: next, source });
  }

  recordRunResult({ outcome, rewardId = null, campaignComplete = false, stageId = null, tick = null } = {}) {
    return this.append("RUN_RESULT", {
      outcome: outcome ?? null,
      rewardId,
      campaignComplete: Boolean(campaignComplete),
      stageId,
      tick: Number.isFinite(tick) ? tick : null,
    });
  }

  exportObject() {
    return {
      format: FORMAT,
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      generatedAtMs: Math.round(finiteNumber(this.now()) * 1000) / 1000,
      scope: "offline-local-debug",
      privacy: {
        playerIdentifiers: false,
        networkTransport: false,
        persistentStorage: false,
      },
      bounds: {
        maxRecords: this.maxRecords,
        retainedRecords: this.records.length,
        droppedRecords: this.droppedRecords,
      },
      records: this.records.map((record) => cloneValue(record)),
    };
  }

  exportJson(space = 2) {
    return JSON.stringify(this.exportObject(), null, space);
  }

  clear() {
    this.records.length = 0;
    this.droppedRecords = 0;
    this.frameDurations.length = 0;
    this.lastSnapshot = null;
    this.simulationTick = null;
    this.simulationEventKeys.clear();
  }
}
