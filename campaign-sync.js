const CHANNEL_NAME = "abyssal-surge-campaign-mirror-v1";
const PROTOCOL = "abyssal-surge-campaign-mirror/v1";
const REVISION_KEY = "abyssal-surge-campaign-mirror-revision-v1";
const STAMP_KEY = "abyssal-surge-campaign-mirror-stamp-v1";
const MAX_ENVELOPE_BYTES = 256 * 1024;
const ORIGIN_ID = /^[a-z0-9-]{16,96}$/;

function usableSessionStorage() {
  try {
    const storage = globalThis.sessionStorage;
    const probe = "__abyssal_surge_mirror_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function randomOriginId() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return `tab-${crypto.randomUUID().toLowerCase()}`;
  if (typeof crypto?.getRandomValues === "function") {
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    return `tab-${Array.from(bytes, (value) => value.toString(36)).join("-")}`;
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}


function readRevision(storage) {
  if (!storage) return 0;
  try {
    const revision = Number(storage.getItem(REVISION_KEY));
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
  } catch {
    return 0;
  }
}

function writeValue(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function validStamp(stamp) {
  return (
    stamp &&
    Object.getPrototypeOf(stamp) === Object.prototype &&
    Number.isSafeInteger(stamp.revision) &&
    stamp.revision >= 0 &&
    ORIGIN_ID.test(stamp.originId)
  );
}

function readStamp(storage) {
  if (!storage) return null;
  try {
    const stamp = JSON.parse(storage.getItem(STAMP_KEY) || "null");
    return validStamp(stamp) ? Object.freeze({ revision: stamp.revision, originId: stamp.originId }) : null;
  } catch {
    return null;
  }
}

function writeStamp(storage, stamp) {
  return writeValue(storage, STAMP_KEY, JSON.stringify(stamp));
}

function compareStamps(left, right) {
  if (left.revision !== right.revision) return left.revision - right.revision;
  if (left.originId === right.originId) return 0;
  return left.originId < right.originId ? -1 : 1;
}

function createStamp(revision, originId) {
  return Object.freeze({ revision, originId });
}

function jsonValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (depth >= 12 || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.length <= 4096 && value.every((item) => jsonValue(item, depth + 1, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const entries = Object.entries(value);
  return entries.length <= 64 && entries.every(([key, item]) => key.length <= 128 && jsonValue(item, depth + 1, seen));
}

function validEnvelope(envelope) {
  if (!envelope || Object.getPrototypeOf(envelope) !== Object.prototype) return false;
  if (typeof envelope.schema !== "string" || !Number.isSafeInteger(envelope.schemaVersion) || typeof envelope.rulesVersion !== "string" || !Array.isArray(envelope.trace)) return false;
  if (!jsonValue(envelope)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(envelope)).byteLength <= MAX_ENVELOPE_BYTES;
  } catch {
    return false;
  }
}

function validMessage(raw) {
  if (!raw || Object.getPrototypeOf(raw) !== Object.prototype || raw.protocol !== PROTOCOL || !ORIGIN_ID.test(raw.originId)) return null;
  if (raw.kind === "request") {
    return Object.keys(raw).length === 4 && (raw.targetId === null || ORIGIN_ID.test(raw.targetId)) ? raw : null;
  }
  if (raw.kind !== "state") return null;
  const hasStamp = Object.hasOwn(raw, "stamp");
  if (Object.keys(raw).length !== (hasStamp ? 7 : 6)) return null;
  // Pre-stamp v1 state frames remain deterministically orderable during tab upgrades.
  const stamp = hasStamp ? raw.stamp : createStamp(raw.revision, raw.originId);
  if (
    !validStamp(stamp) ||
    raw.revision !== stamp.revision ||
    (raw.targetId !== null && !ORIGIN_ID.test(raw.targetId)) ||
    !validEnvelope(raw.envelope)
  ) {
    return null;
  }
  return stamp === raw.stamp ? raw : { ...raw, stamp };
}

/**
 * Same-origin, same-browser campaign mirror. BroadcastChannel never leaves this
 * browser origin; it is intentionally not authoritative multiplayer or hosting.
 */
export class CampaignMirror {
  constructor({ onState, storage = usableSessionStorage(), BroadcastChannel = globalThis.BroadcastChannel } = {}) {
    this.onState = typeof onState === "function" ? onState : () => undefined;
    this.storage = storage;
    this.BroadcastChannel = BroadcastChannel;
    this.originId = randomOriginId();
    this.latestStamp = readStamp(storage);
    this.revision = Math.max(readRevision(storage), this.latestStamp?.revision ?? 0);
    this.storageMode = writeValue(storage, REVISION_KEY, String(this.revision)) ? "sessionStorage" : "memory";
    this.channel = null;
    this.latestEnvelope = null;
    this.availability = Object.freeze({ available: false, reason: "BroadcastChannel unavailable" });
  }

  start(initialEnvelope = null) {
    if (validEnvelope(initialEnvelope)) {
      this.latestEnvelope = initialEnvelope;
      this.latestStamp ??= createStamp(this.revision, this.originId);
      writeStamp(this.storage, this.latestStamp);
    }
    if (this.channel) return this.availability;
    if (typeof this.BroadcastChannel !== "function") return this.availability;
    try {
      this.channel = new this.BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener("message", (event) => this.#receive(event.data));
      this.availability = Object.freeze({ available: true, reason: null });
      this.#post({ protocol: PROTOCOL, kind: "request", originId: this.originId, targetId: null });
    } catch {
      this.channel = null;
      this.availability = Object.freeze({ available: false, reason: "BroadcastChannel blocked" });
    }
    return this.availability;
  }

  publish(envelope) {
    if (!validEnvelope(envelope) || !this.channel) return false;
    this.revision = Math.max(this.revision, this.latestStamp?.revision ?? 0) + 1;
    this.latestEnvelope = envelope;
    this.latestStamp = createStamp(this.revision, this.originId);
    writeValue(this.storage, REVISION_KEY, String(this.revision));
    writeStamp(this.storage, this.latestStamp);
    return this.#post({
      protocol: PROTOCOL,
      kind: "state",
      originId: this.originId,
      targetId: null,
      revision: this.revision,
      stamp: this.latestStamp,
      envelope
    });
  }

  close() {
    this.channel?.close();
    this.channel = null;
  }

  #post(message) {
    try {
      this.channel.postMessage(message);
      return true;
    } catch {
      return false;
    }
  }

  #receive(raw) {
    const message = validMessage(raw);
    if (!message || message.originId === this.originId) return;
    if (message.kind === "request") {
      if (!this.latestEnvelope || !this.latestStamp || (message.targetId && message.targetId !== this.originId)) return;
      this.#post({
        protocol: PROTOCOL,
        kind: "state",
        originId: this.originId,
        targetId: message.originId,
        revision: this.latestStamp.revision,
        stamp: this.latestStamp,
        envelope: this.latestEnvelope
      });
      return;
    }
    if (
      (message.targetId && message.targetId !== this.originId) ||
      (this.latestStamp && compareStamps(message.stamp, this.latestStamp) <= 0)
    ) {
      return;
    }
    this.revision = Math.max(this.revision, message.stamp.revision);
    this.latestEnvelope = message.envelope;
    this.latestStamp = createStamp(message.stamp.revision, message.stamp.originId);
    writeValue(this.storage, REVISION_KEY, String(this.revision));
    writeStamp(this.storage, this.latestStamp);
    Promise.resolve()
      .then(() => this.onState(message.envelope, Object.freeze({ originId: message.originId, revision: message.stamp.revision })))
      .catch(() => undefined);
  }
}
