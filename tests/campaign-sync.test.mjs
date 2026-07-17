import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, createSaveEnvelope } from "../campaign-state.js";
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

function stateMessage({ originId, revision, targetId = null, campaign = envelope() }) {
  return {
    protocol: PROTOCOL,
    kind: "state",
    originId,
    targetId,
    revision,
    envelope: campaign,
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

test("campaign mirror degrades safely when BroadcastChannel is unavailable", () => {
  const mirror = new CampaignMirror({ BroadcastChannel: null, storage: null });

  assert.deepEqual(mirror.start(envelope()), { available: false, reason: "BroadcastChannel unavailable" });
  assert.equal(mirror.publish(envelope()), false, "unavailable cross-tab capability must not throw or claim a publish");
  assert.doesNotThrow(() => mirror.close());
});
