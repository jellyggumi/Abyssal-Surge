import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, createSaveEnvelope, startCampaign } from "../campaign-state.js";
import { CampaignMirror } from "../campaign-sync.js";

const CHANNEL_NAME = "abyssal-surge-campaign-mirror-v1";
const PROTOCOL = "abyssal-surge-campaign-mirror/v1";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(label, predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail(`Timed out waiting for ${label} after ${timeoutMs}ms`);
}

function envelope() {
  return createSaveEnvelope(createCampaign());
}

function stateMessage({ originId, revision, stamp = { revision, originId }, targetId = null, campaign = envelope() }) {
  return {
    protocol: PROTOCOL,
    kind: "state",
    originId,
    targetId,
    revision,
    stamp,
    envelope: campaign,
  };
}
function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createChannelHarness() {
  const channels = new Set();
  const pending = [];

  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.closed = false;
      this.listeners = new Set();
      channels.add(this);
    }

    addEventListener(type, listener) {
      if (type === "message") this.listeners.add(listener);
    }

    postMessage(message) {
      if (this.closed) throw new Error("BroadcastChannel is closed");
      pending.push({ sender: this, message: structuredClone(message) });
    }

    close() {
      this.closed = true;
      channels.delete(this);
    }
  }

  function deliverNext(predicate = () => true) {
    const index = pending.findIndex(({ message }) => predicate(message));
    assert.notEqual(index, -1, "expected a matching queued BroadcastChannel message");
    const [delivery] = pending.splice(index, 1);

    for (const channel of channels) {
      if (!channel.closed && channel !== delivery.sender && channel.name === delivery.sender.name) {
        for (const listener of channel.listeners) listener({ data: structuredClone(delivery.message) });
      }
    }
    return delivery.message;
  }

  return {
    BroadcastChannel: FakeBroadcastChannel,
    clearPending() {
      pending.length = 0;
    },
    deliverNext,
  };
}

test("same-origin campaign mirrors deliver one state update without reflecting it back", async () => {
  const receivedByPublisher = [];
  const receivedByPeer = [];
  const publisher = new CampaignMirror({ onState: (campaign, metadata) => receivedByPublisher.push({ campaign, metadata }) });
  const peer = new CampaignMirror({ onState: (campaign, metadata) => receivedByPeer.push({ campaign, metadata }) });

  try {
    assert.deepEqual(publisher.start(), { available: true, reason: null });
    assert.deepEqual(peer.start(), { available: true, reason: null });

    const savedCampaign = envelope();
    assert.equal(publisher.publish(savedCampaign), true, "a started mirror must publish a valid saved campaign");
    await waitFor("the peer to receive the published campaign", () => receivedByPeer.length === 1);

    assert.deepEqual(receivedByPeer[0].campaign, savedCampaign);
    assert.equal(receivedByPeer[0].metadata.originId, publisher.originId);
    assert.equal(receivedByPeer[0].metadata.revision, 1);

    // The sender must not receive its own state back, and the receiver must not
    // relay a received state. A bounded quiet period exposes relay-loop regressions.
    await delay(75);
    assert.deepEqual(receivedByPublisher, [], "received campaigns must never be echoed back to their publisher");
    assert.equal(receivedByPeer.length, 1, "a peer must apply each remote revision once rather than relaying it");
  } finally {
    publisher.close();
    peer.close();
  }
});

test("campaign mirror rejects malformed, off-origin, misaddressed, and stale channel payloads", async () => {
  const received = [];
  const mirror = new CampaignMirror({ onState: (campaign, metadata) => received.push({ campaign, metadata }) });
  const injector = new BroadcastChannel(CHANNEL_NAME);
  const remoteOrigin = "tab-remote-campaign-mirror";

  try {
    assert.deepEqual(mirror.start(), { available: true, reason: null });

    injector.postMessage("not a campaign message");
    injector.postMessage({
      ...stateMessage({ originId: "https://outside.example", revision: 1 }),
      origin: "https://outside.example",
    });
    injector.postMessage(stateMessage({
      originId: remoteOrigin,
      revision: 3,
      targetId: "tab-another-campaign-mirror",
    }));
    injector.postMessage(stateMessage({ originId: remoteOrigin, revision: 8 }));

    await waitFor("the one valid remote revision", () => received.length === 1);
    assert.equal(received[0].metadata.originId, remoteOrigin);
    assert.equal(received[0].metadata.revision, 8);

    injector.postMessage(stateMessage({ originId: remoteOrigin, revision: 8 }));
    injector.postMessage(stateMessage({ originId: remoteOrigin, revision: 7 }));
    await delay(75);

    assert.equal(received.length, 1, "malformed, off-origin, misaddressed, duplicate, and stale payloads must not change campaign state");
  } finally {
    injector.close();
    mirror.close();
  }
});

test("campaign mirrors converge on the lexicographically greatest stamp at an equal revision", async () => {
  const lowerOrigin = "tab-convergence-alpha";
  const greaterOrigin = "tab-convergence-omega";
  const lowerEnvelope = envelope();
  const greaterEnvelope = createSaveEnvelope(startCampaign(createCampaign()).state);
  const lower = stateMessage({
    originId: lowerOrigin,
    revision: 4,
    stamp: { revision: 4, originId: lowerOrigin },
    campaign: lowerEnvelope,
  });
  const greater = stateMessage({
    originId: greaterOrigin,
    revision: 4,
    stamp: { revision: 4, originId: greaterOrigin },
    campaign: greaterEnvelope,
  });

  async function receiveInOrder(messages) {
    const harness = createChannelHarness();
    const received = [];
    const mirror = new CampaignMirror({
      BroadcastChannel: harness.BroadcastChannel,
      onState: (campaign, metadata) => received.push({ campaign, metadata }),
      storage: createMemoryStorage(),
    });
    const injector = new harness.BroadcastChannel(CHANNEL_NAME);

    try {
      mirror.start();
      harness.clearPending();
      for (const message of messages) {
        injector.postMessage(message);
        harness.deliverNext();
        await Promise.resolve();
      }
      return received;
    } finally {
      injector.close();
      mirror.close();
    }
  }

  const lowerThenGreater = await receiveInOrder([lower, greater]);
  const greaterThenLower = await receiveInOrder([greater, lower]);

  assert.deepEqual(lowerThenGreater.at(-1), {
    campaign: greaterEnvelope,
    metadata: { originId: greaterOrigin, revision: 4 },
  });
  assert.deepEqual(greaterThenLower, [{
    campaign: greaterEnvelope,
    metadata: { originId: greaterOrigin, revision: 4 },
  }], "a lower origin ID at the same revision must not replace the greater stamp");
});

test("a late joiner accepts a reloaded relay's state carrying the original author's stamp", async () => {
  const harness = createChannelHarness();
  const authorStorage = createMemoryStorage();
  const relayStorage = createMemoryStorage();
  const receivedByLateJoiner = [];
  const savedCampaign = createSaveEnvelope(startCampaign(createCampaign()).state);
  const author = new CampaignMirror({
    BroadcastChannel: harness.BroadcastChannel,
    storage: authorStorage,
  });
  const originalRelay = new CampaignMirror({
    BroadcastChannel: harness.BroadcastChannel,
    storage: relayStorage,
  });

  let reloadedRelay;
  let lateJoiner;
  try {
    author.start();
    originalRelay.start();
    harness.clearPending();
    assert.equal(author.publish(savedCampaign), true);
    const authoredState = harness.deliverNext();
    assert.equal(authoredState.originId, author.originId);
    await Promise.resolve();
    originalRelay.close();

    reloadedRelay = new CampaignMirror({
      BroadcastChannel: harness.BroadcastChannel,
      storage: relayStorage,
    });
    reloadedRelay.start(savedCampaign);
    harness.clearPending();

    lateJoiner = new CampaignMirror({
      BroadcastChannel: harness.BroadcastChannel,
      onState: (campaign, metadata) => receivedByLateJoiner.push({ campaign, metadata }),
      storage: createMemoryStorage(),
    });
    lateJoiner.start();
    harness.deliverNext((message) => message.kind === "request" && message.originId === lateJoiner.originId);
    const relayedState = harness.deliverNext((message) => message.kind === "state" && message.originId === reloadedRelay.originId);
    await Promise.resolve();

    assert.deepEqual(relayedState.stamp, { revision: 1, originId: author.originId });
    assert.notEqual(relayedState.originId, relayedState.stamp.originId);
    assert.deepEqual(receivedByLateJoiner, [{
      campaign: savedCampaign,
      metadata: { originId: reloadedRelay.originId, revision: 1 },
    }]);
  } finally {
    lateJoiner?.close();
    reloadedRelay?.close();
    originalRelay.close();
    author.close();
  }
});

test("campaign mirror degrades safely when BroadcastChannel is unavailable", () => {
  const mirror = new CampaignMirror({ BroadcastChannel: null, storage: null });

  assert.deepEqual(mirror.start(envelope()), { available: false, reason: "BroadcastChannel unavailable" });
  assert.equal(mirror.publish(envelope()), false, "unavailable cross-tab capability must not throw or claim a publish");
  assert.doesNotThrow(() => mirror.close());
});
