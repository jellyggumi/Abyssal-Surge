import { RULES_VERSION, restoreCampaign, serializeCampaign } from "./campaign-state.js";

const DEFAULT_KEY = "abyssal-command-defense";
const DATABASE_NAME = "abyssal-command-defense";
const STORE_NAME = "campaign";
const RECORD_KEY = "active";

function fallbackHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isEnvelope(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 3
    && Object.prototype.hasOwnProperty.call(value, "version")
    && Object.prototype.hasOwnProperty.call(value, "hash")
    && Object.prototype.hasOwnProperty.call(value, "payload")
    && value.version === RULES_VERSION
    && typeof value.hash === "string";
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export class DefenseStorage {
  constructor({ key = DEFAULT_KEY, indexedDB = globalThis.indexedDB, localStorage = globalThis.localStorage, crypto = globalThis.crypto } = {}) {
    this.key = key;
    this.indexedDB = indexedDB;
    this.localStorage = localStorage;
    this.crypto = crypto;
    this.database = null;
    this.backend = null;
  }

  async open() {
    if (this.backend) return this;
    if (this.indexedDB?.open) {
      try {
        const request = this.indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
        };
        this.database = await requestResult(request);
        this.backend = "indexeddb";
        return this;
      } catch {
        this.database = null;
      }
    }
    if (this.localStorage) {
      try {
        const probeKey = `${this.key}:probe`;
        this.localStorage.setItem(probeKey, "1");
        this.localStorage.removeItem(probeKey);
        this.backend = "localstorage";
        return this;
      } catch {
        // Storage can be disabled in private or embedded browser contexts.
      }
    }
    this.backend = "memory";
    this.memory = null;
    return this;
  }

  async #hash(text) {
    if (this.crypto?.subtle?.digest) {
      const bytes = new TextEncoder().encode(text);
      return `sha256-${hex(await this.crypto.subtle.digest("SHA-256", bytes))}`;
    }
    return fallbackHash(text);
  }

  async #encode(campaign) {
    const payload = serializeCampaign(campaign);
    const text = JSON.stringify(payload);
    return JSON.stringify({ version: RULES_VERSION, hash: await this.#hash(text), payload });
  }

  async #decode(text) {
    if (typeof text !== "string") return null;
    let envelope;
    try {
      envelope = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isEnvelope(envelope)) return null;
    const payloadText = JSON.stringify(envelope.payload);
    let hash;
    try {
      hash = await this.#hash(payloadText);
    } catch {
      return null;
    }
    if (hash !== envelope.hash) return null;
    return restoreCampaign(envelope.payload);
  }

  async #readText() {
    await this.open();
    if (this.backend === "indexeddb") {
      const transaction = this.database.transaction(STORE_NAME, "readonly");
      return requestResult(transaction.objectStore(STORE_NAME).get(RECORD_KEY));
    }
    if (this.backend === "localstorage") return this.localStorage.getItem(this.key);
    return this.memory;
  }

  async #writeText(text) {
    await this.open();
    if (this.backend === "indexeddb") {
      const transaction = this.database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(text, RECORD_KEY);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
      });
      return;
    }
    if (this.backend === "localstorage") {
      this.localStorage.setItem(this.key, text);
      return;
    }
    this.memory = text;
  }

  async load() {
    try {
      return await this.#decode(await this.#readText());
    } catch {
      return null;
    }
  }

  async save(campaign) {
    const text = await this.#encode(campaign);
    await this.#writeText(text);
    return true;
  }

  async clear() {
    await this.open();
    if (this.backend === "indexeddb") {
      const transaction = this.database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
      });
    } else if (this.backend === "localstorage") {
      this.localStorage.removeItem(this.key);
    } else {
      this.memory = null;
    }
  }

  async exportText() {
    const text = await this.#readText();
    return (await this.#decode(text)) ? text : null;
  }

  async importText(text) {
    const campaign = await this.#decode(text);
    if (!campaign) return false;
    try {
      await this.#writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
