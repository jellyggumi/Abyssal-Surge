import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { STAGES } from "../campaign-state.js";
import { translate, translations } from "../i18n.js";

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
function appFunction(source, name, nextName) {
  const definition = source.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}(?=\\s*(?:async\\s+)?function ${nextName}\\()`),
  );
  assert.ok(definition, `app runtime must expose ${name}`);
  return definition[0];
}

function terminalAppFunction(source, name, invocation) {
  const definition = source.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}(?=\\s*${invocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`),
  );
  assert.ok(definition, `app runtime must expose terminal function ${name}`);
  return definition[0];
}

async function loadKoreanCommandCopy() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const stage = {
    progression: {
      huntGoal: 2,
      soulsPerExtract: 4,
      materializeCost: 4,
      materializeSummon: 2,
    },
    commands: {
      domain: { integrityRestore: 3, aegis: 2 },
      assault: {
        damage: 3,
        counter: { mode: "threshold", minimumLegion: 4, readyDamage: 1, belowDamage: 3 },
      },
    },
  };
  const campaign = {
    stage: { hunted: 1, souls: 4, legion: 1, capacity: 8, possessed: false },
  };
  const benefits = { materializeBonus: 1, possessedAssaultBonus: 0, counterReduction: 0 };
  const context = vm.createContext({
    campaign,
    currentStage: () => stage,
    getCampaignBenefits: () => benefits,
  });
  const definitions = [
    appFunction(source, "calculateAssaultDamage", "calculateCounterDamage"),
    appFunction(source, "calculateCounterDamage", "getCommandDescription"),
    appFunction(source, "getCommandDescription", "getCommandLockReason"),
  ];
  vm.runInContext(`${definitions.join("\n\n")}\nglobalThis.describeCommand = getCommandDescription;`, context, { filename: "app.js" });
  return (action) => context.describeCommand(action, true, "ko");
}

async function loadStatusTranslator() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const context = vm.createContext({ STAGES, translate });
  const definition = appFunction(source, "translateStatusMessage", "updateResumeAffordance");
  vm.runInContext(`${definition}\nglobalThis.translateStatus = translateStatusMessage;`, context, { filename: "app.js" });
  return (message, lang = "ko") => context.translateStatus(message, lang);
}

async function loadReleaseLocalization(locale) {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const elements = {
    saveStatus: { textContent: "" },
    importSave: { value: "" },
    waveIndicator: { dataset: {}, textContent: "" },
    battlePressure: { textContent: "" },
  };
  const confirmations = [];
  const context = vm.createContext({
    Blob,
    URL: {
      createObjectURL: () => "blob:campaign-save",
      revokeObjectURL: () => {},
    },
    MAX_IMPORT_BYTES: 256 * 1024,
    battleVisualFallback: false,
    campaign: { status: "active", trace: [{ kind: "start" }] },
    campaignMirror: { publish: () => {} },
    createCampaign: () => ({ status: "briefing", trace: [] }),
    createSaveEnvelope: () => ({ schema: "test-save" }),
    currentLang: () => locale,
    document: {
      createElement: () => ({ click: () => {} }),
    },
    elements,
    flashEffect: () => {},
    openCurrentStageBriefing: () => {},
    restoreSaveEnvelope: () => ({ status: "active", trace: [{ kind: "start" }] }),
    revealCampaign: () => {},
    render: () => {},
    startCampaign: (state) => ({ state }),
    stopBattle: () => {},
    storage: { save: async () => "IndexedDB" },
    translate: (key) => translations[locale][key] ?? key,
    updateResumeAffordance: () => {},
    window: {
      confirm: (message) => {
        confirmations.push(message);
        return false;
      },
      requestAnimationFrame: (callback) => callback(),
      setTimeout: (callback) => callback(),
    },
  });
  const definitions = [
    appFunction(source, "setSaveStatus", "translatedResumeText"),
    appFunction(source, "setBattlePressure", "renderBattleAssetStatus"),
    appFunction(source, "persistCampaign", "applyMirroredCampaign"),
    appFunction(source, "applyMirroredCampaign", "triggerBattleVisual"),
    appFunction(source, "beginNewCampaign", "returnToLobby"),
    appFunction(source, "exportSave", "importSave"),
    appFunction(source, "importSave", "toggleAmbience"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}\nglobalThis.releaseUi = { applyMirroredCampaign, beginNewCampaign, exportSave, importSave, persistCampaign, setBattlePressure };`,
    context,
    { filename: "app.js" },
  );
  return { api: context.releaseUi, confirmations, elements };
}

async function loadStartupStatus(locale, {
  envelope = null,
  source = "IndexedDB",
  storageMode = "indexeddb",
  incompatible = false,
} = {}) {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const elements = {
    mirrorStatus: { textContent: "" },
    saveStatus: { textContent: "" },
  };
  const context = vm.createContext({
    BUILD_TAG: "test-build",
    CampaignMirror: class CampaignMirror {
      start() {
        return { available: true };
      }
      close() {}
    },
    RULES_VERSION: "test-rules",
    applyMirroredCampaign: () => {},
    campaignMirror: null,
    createSaveEnvelope: () => ({ schema: "test-save" }),
    document: { documentElement: { dataset: {} } },
    elements,
    initReactBitsEffects: () => null,
    navigator: {},
    particleBackground: null,
    restoreSaveEnvelope: () => {
      if (incompatible) throw new Error("incompatible fixture");
      return { status: "active", trace: [{ kind: "start" }] };
    },
    storedCampaign: null,
    storage: {
      mode: storageMode,
      open: async () => {},
      load: async () => ({ envelope, source }),
    },
    syncBackgroundEffects: () => {},
    syncCinematicCopy: () => {},
    translate: (key) => translations[locale][key] ?? key,
    updateResumeAffordance: () => {},
    window: { addEventListener: () => {} },
    wireControls: () => {},
  });
  const definitions = [
    appFunction(appSource, "setSaveStatus", "translatedResumeText"),
    terminalAppFunction(appSource, "initialize", "initialize();"),
  ];
  vm.runInContext(
    `${definitions.join("\n\n")}\nglobalThis.initializeRelease = initialize;`,
    context,
    { filename: "app.js" },
  );
  await context.initializeRelease();
  return elements.saveStatus.textContent;
}

test("new campaign, save transfer, and briefing status copy follows the active Korean or English locale", async () => {
  const contracts = {
    ko: {
      confirm: "새로운 캠페인을 시작하시겠습니까? 현재 진행 중인 로컬 세이브가 대체됩니다.",
      exported: "버전 지정된 캠페인 저장을 내보냈습니다.",
      saved: "캠페인 저장 완료 (IndexedDB에 저장됨)",
      imported: "가져온 캠페인 저장 완료 (IndexedDB에 저장됨)",
      tooLarge: "가져오기 거부됨: 저장 데이터 크기가 256 KiB 제한을 초과합니다.",
      briefing: "작전 브리핑 · 명령 대기 중",
      mirrored: "다른 탭의 로컬 캠페인을 반영했습니다.",
    },
    en: {
      confirm: "Start a new campaign? Your current local run will be replaced.",
      exported: "Versioned campaign save exported.",
      saved: "Campaign saved in IndexedDB.",
      imported: "Imported campaign saved in IndexedDB.",
      tooLarge: "Import rejected: save exceeds the 256 KiB limit.",
      briefing: "MISSION BRIEFING · COMMAND PENDING",
      mirrored: "Mirrored campaign applied from another tab.",
    },
  };

  for (const locale of ["ko", "en"]) {
    const { api, confirmations, elements } = await loadReleaseLocalization(locale);
    await api.beginNewCampaign();
    assert.deepEqual(confirmations, [contracts[locale].confirm], `${locale} must show the exact localized new-campaign replacement warning`);

    api.exportSave();
    assert.equal(elements.saveStatus.textContent, contracts[locale].exported, `${locale} export must publish its exact localized visible status`);

    await api.persistCampaign();
    assert.equal(elements.saveStatus.textContent, contracts[locale].saved, `${locale} persistence must publish its exact localized visible status`);

    await api.importSave({ size: 256 * 1024 + 1 });
    assert.equal(elements.saveStatus.textContent, contracts[locale].tooLarge, `${locale} oversized import must publish its exact localized rejection`);

    await api.importSave({ size: 2, text: async () => "{}" });
    assert.equal(elements.saveStatus.textContent, contracts[locale].imported, `${locale} successful import must publish its exact localized saved status`);

    await api.applyMirroredCampaign({ schema: "test-save" });
    assert.equal(elements.saveStatus.textContent, contracts[locale].mirrored, `${locale} cross-tab application must publish its exact localized visible status`);

    api.setBattlePressure("briefing", "unlocalized fallback");
    assert.equal(elements.waveIndicator.textContent, contracts[locale].briefing, `${locale} briefing must publish its exact localized wave badge`);
  }
});

test("startup save discovery reports exact localized compatibility and storage availability", async () => {
  const contracts = {
    ko: {
      compatible: "IndexedDB에서 호환되는 캠페인을 사용할 수 있습니다.",
      incompatible: "로컬 저장 데이터가 있지만 호환되지 않습니다. 새 캠페인을 시작하거나 유효한 저장 파일을 가져오십시오.",
      empty: "진행 중인 로컬 캠페인이 없습니다. IndexedDB가 준비되었습니다.",
      fallback: "IndexedDB를 사용할 수 없습니다. 이 세션은 로컬 안전 폴백을 사용합니다.",
    },
    en: {
      compatible: "A compatible campaign is available from IndexedDB.",
      incompatible: "A local save was found but is incompatible. Start a new campaign or import a valid save.",
      empty: "No local campaign yet. IndexedDB is ready.",
      fallback: "IndexedDB is unavailable; this session will use the safe local fallback.",
    },
  };

  for (const locale of ["ko", "en"]) {
    assert.equal(
      await loadStartupStatus(locale, { envelope: { schema: "test-save" } }),
      contracts[locale].compatible,
      `${locale} startup must identify a compatible campaign and its source`,
    );
    assert.equal(
      await loadStartupStatus(locale, { envelope: { schema: "old-save" }, incompatible: true }),
      contracts[locale].incompatible,
      `${locale} startup must explain that the discovered campaign is incompatible`,
    );
    assert.equal(
      await loadStartupStatus(locale),
      contracts[locale].empty,
      `${locale} startup must report that IndexedDB is ready without a campaign`,
    );
    assert.equal(
      await loadStartupStatus(locale, { storageMode: "memory" }),
      contracts[locale].fallback,
      `${locale} startup must report the safe fallback when IndexedDB is unavailable`,
    );
  }
});

test("Korean command guidance states each action's concrete progress, economy, prerequisite, and combat result", async () => {
  const describe = await loadKoreanCommandCopy();
  const contracts = [
    ["hunt", "균열 흔적 탐색 (진행도: 1/2)"],
    ["extract", "은닉처에서 영혼 +4 획득"],
    ["materialize", "비용: 영혼 4 | 군단 +3 실체화"],
    ["capture", "기술 거점 점거 (그림자 2명 필요 | 거점 +1)"],
    ["domain", "군주 내구도 +3 회복 및 차단막 +2 획득"],
    ["assault", "보스에게 3 피해 | 예상 반격: 3"],
  ];

  for (const [action, expected] of contracts) {
    assert.equal(describe(action), expected, `${action} must tell Korean players its concrete tactical consequence`);
  }
});

test("accepted first and second Hunt results are fully localized in Korean mode", async () => {
  const translateStatus = await loadStatusTranslator();
  const cases = [
    {
      raw: "You find a heatless footprint in the cinders.",
      localized: "잿더미에서 열기 없는 흔적 하나를 발견했습니다. 균열을 특정하려면 한 번 더 사냥하십시오.",
    },
    {
      raw: "The second trace exposes the rift's pulse.",
      localized: "두 번째 흔적이 균열의 맥동을 드러냈습니다. 이제 영혼을 추출할 수 있습니다.",
    },
  ];

  for (const { raw, localized } of cases) {
    const result = translateStatus(raw);
    assert.equal(result, localized, "accepted Hunt feedback must provide the next actionable Korean instruction");
    assert.equal(result.includes(raw), false, "Korean Hunt feedback must not leak the campaign engine's raw English message");
  }
});


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
