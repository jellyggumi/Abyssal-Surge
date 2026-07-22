import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RealtimeBattle } from "../battle-realtime-three.js";
import { BattleVisualizer } from "../battle-visualizer.js";

const ADAPTERS = [RealtimeBattle, BattleVisualizer];
const SOURCES = ["battle-realtime-three.js", "battle-visualizer.js"];

function mockCanvas() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(["stop", ...args]); } };
  const context = {
    beginPath() { calls.push(["begin"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    clearRect(...args) { calls.push(["clear", ...args]); },
    fill() { calls.push(["fill"]); },
    fillRect(...args) { calls.push(["rect", ...args]); },
    stroke() { calls.push(["stroke"]); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set strokeStyle(value) { calls.push(["strokeStyle", value]); },
    set lineWidth(value) { calls.push(["lineWidth", value]); },
  };
  return { width: 640, height: 360, calls, getContext: () => context };
}

const snapshot = {
  gate: { x: 320, y: 300, radius: 32 },
  commander: { x: 300, y: 260 },
  enemies: [{ x: 120, y: 80 }],
  boss: { x: 500, y: 120 },
  projectiles: [{ x: 220, y: 140 }],
  pickups: [{ x: 250, y: 220 }],
  companions: [{ x: 350, y: 230 }],
};

test("defense renderer adapters expose the passive snapshot surface", () => {
  for (const Adapter of ADAPTERS) {
    const adapter = new Adapter();
    for (const method of ["mount", "renderSnapshot", "dispose", "onVisualFeedback", "debugMetrics"]) {
      assert.equal(typeof adapter[method], "function", `${Adapter.name}.${method}`);
    }
    assert.deepEqual(Object.keys(adapter.debugMetrics()).sort(), ["geometries", "programs", "textures"]);
    for (const value of Object.values(adapter.debugMetrics())) assert.equal(typeof value, "number");
  }
});

test("defense renderer adapters project a supplied snapshot to a mocked Canvas2D context", () => {
  for (const Adapter of ADAPTERS) {
    const canvas = mockCanvas();
    const adapter = new Adapter();
    assert.equal(adapter.mount({ canvas, handoff: { ignored: true }, viewport: { width: 640, height: 360 } }), adapter);
    assert.doesNotThrow(() => adapter.renderSnapshot(snapshot, { index: 4 }));
    assert.ok(canvas.calls.some(([name]) => name === "rect"), `${Adapter.name} paints its background`);
    assert.ok(canvas.calls.filter(([name]) => name === "arc").length >= 7, `${Adapter.name} paints game entities`);
    adapter.onVisualFeedback(17);
    assert.doesNotThrow(() => adapter.dispose());
    assert.doesNotThrow(() => adapter.dispose());
    assert.doesNotThrow(() => adapter.renderSnapshot(snapshot));
  }
});

test("defense renderer modules contain no loop, input, campaign, or outcome ownership", async () => {
  for (const source of SOURCES) {
    const code = await readFile(new URL(`../${source}`, import.meta.url), "utf8");
    assert.doesNotMatch(code, /requestAnimationFrame/);
    assert.doesNotMatch(code, /addEventListener/);
    assert.doesNotMatch(code, /campaign-state/);
    assert.doesNotMatch(code, /\b(?:onBattleEnd|onOutcome|onVictory|onDefeat|resolveOutcome|emitOutcome)\b/);
  }
});
