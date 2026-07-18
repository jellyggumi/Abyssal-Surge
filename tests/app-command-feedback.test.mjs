import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadBattleVisualTrigger({ hasRenderer = false } = {}) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const definition = source.match(
    /function triggerBattleVisual\(action, details = \{\}\) \{[\s\S]*?\n\}(?=\n\nfunction startActionCooldown)/,
  );
  assert.ok(definition, "app runtime must expose the command-to-battle-feedback dispatcher");

  const rendererCalls = [];
  const effectCalls = [];
  const cueCalls = [];
  const context = vm.createContext({
    campaign: Object.freeze({ status: "active" }),
    visualizer: hasRenderer
      ? { playActionEffect: (semantic) => rendererCalls.push(semantic) }
      : null,
    BATTLE_ACTION_SEMANTICS: Object.freeze({
      materialize: Object.freeze({ source: "portal", target: "portal", clip: "Activate" }),
    }),
    flashEffect: (action) => effectCalls.push(action),
    playCue: (action) => cueCalls.push(action),
  });
  vm.runInContext(`${definition[0]}\nglobalThis.triggerBattleVisual = triggerBattleVisual;`, context, { filename: "app.js" });

  return {
    trigger: (action, details) => context.triggerBattleVisual(action, details),
    rendererCalls,
    effectCalls,
    cueCalls,
  };
}

test("accepted commands retain a local feedback cue when battle rendering is unavailable", async () => {
  const fallback = await loadBattleVisualTrigger();

  fallback.trigger("materialize", { count: 3 });

  assert.deepEqual(fallback.effectCalls, ["materialize"], "the no-renderer command path must retain its immediate visual acknowledgement");
  assert.deepEqual(fallback.cueCalls, ["materialize"], "the no-renderer command path must retain its authored audio acknowledgement");
  assert.deepEqual(fallback.rendererCalls, [], "the no-renderer path must not attempt renderer-only feedback");
});

test("healthy battle rendering owns command feedback without duplicate local cues", async () => {
  const rendered = await loadBattleVisualTrigger({ hasRenderer: true });

  rendered.trigger("materialize", { count: 3 });

  assert.equal(rendered.rendererCalls.length, 1, "the renderer must receive the accepted command's semantic feedback exactly once");
  assert.equal(rendered.rendererCalls[0].action, "materialize", "the renderer feedback must identify the accepted command");
  assert.equal(rendered.rendererCalls[0].source, "portal", "the renderer feedback must retain the semantic source");
  assert.equal(rendered.rendererCalls[0].target, "portal", "the renderer feedback must retain the semantic target");
  assert.equal(rendered.rendererCalls[0].clip, "Activate", "the renderer feedback must retain the authored action clip");
  assert.equal(rendered.rendererCalls[0].count, 3, "the renderer feedback must retain accepted command details");
  assert.deepEqual(rendered.effectCalls, [], "renderer-backed feedback must not duplicate the local visual acknowledgement");
  assert.deepEqual(rendered.cueCalls, [], "renderer-backed feedback must not duplicate the local audio acknowledgement");
});
