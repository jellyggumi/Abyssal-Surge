import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STAGES } from "../campaign-state.js";

const SOURCE_ROOT = new URL("../", import.meta.url);
const CANONICAL_PAGES_BASE = "https://jellyggumi.github.io/Abyssal-Command";

async function readProjectFile(path) {
  return readFile(new URL(path, SOURCE_ROOT), "utf8");
}

function eagerRelativeImports(source) {
  const imports = new Set();
  const statement = /^import\s+(?:[\s\S]*?\sfrom\s+)?["'](?<specifier>\.[^"']+)["']\s*;?/gm;

  for (const match of source.matchAll(statement)) {
    imports.add(match.groups.specifier);
  }

  return [...imports].sort();
}

function archivePaths(workflow) {
  const archive = workflow.match(/git archive --format=tar "\$\{?PAGES_REVISION\}?" -- (?<paths>[^\n|]+) \| tar -x/);
  assert.ok(archive, "static Pages workflow must define its git archive artifact list");

  return new Set(archive.groups.paths.trim().split(/\s+/).map((path) => `./${path}`));
}

function coreAssetPaths(serviceWorker) {
  const declaration = serviceWorker.match(/const CORE_ASSETS = \[(?<assets>[\s\S]*?)\];/);
  assert.ok(declaration, "service worker must declare CORE_ASSETS");

  return new Set([...declaration.groups.assets.matchAll(/["'](?<path>\.[^"']+)["']/g)].map((match) => match.groups.path));
}

function rewardArtIds(app) {
  const declaration = app.match(/const REWARD_ART_IDS = new Set\(\[(?<ids>[\s\S]*?)\]\);/);
  assert.ok(declaration, "app.js must declare REWARD_ART_IDS");

  return [...declaration.groups.ids.matchAll(/["'](?<id>[^"']+)["']/g)].map((match) => match.groups.id);
}

function narrationAudioPaths(app) {
  const declaration = app.match(/const NARRATION = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(declaration, "app.js must declare NARRATION");

  return [...declaration.groups.entries.matchAll(/audio:\s*["'](?<path>assets\/audio\/[^"']+)["']/g)]
    .map((match) => match.groups.path);
}

function runtimeNarrationAudioCatalog(app) {
  const declaration = app.match(/const NARRATION = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(declaration, "app.js must declare NARRATION");

  const entry = /(?<key>"[^"]+"|\w+):\s*Object\.freeze\(\{\s*audio:\s*"(?<path>assets\/audio\/[^"]+)"/g;
  return Object.fromEntries(
    [...declaration.groups.entries.matchAll(entry)]
      .map((match) => [match.groups.key.replaceAll('"', ""), match.groups.path]),
  );
}

function runtimeNarrationEntries(app) {
  const declaration = app.match(/const NARRATION = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(declaration, "app.js must declare NARRATION");

  const entry = /(?<key>"[^"]+"|\w+):\s*Object\.freeze\(\{\s*audio:\s*(?:null|"[^"]+"),\s*lines:\s*Object\.freeze\(\[(?<lines>[\s\S]*?)\]\),\s*msPerChar:\s*(?<msPerChar>\d+),\s*holdMs:\s*(?<holdMs>\d+)\s*\}\)/g;

  return Object.fromEntries(
    [...declaration.groups.entries.matchAll(entry)].map((match) => [
      match.groups.key.replaceAll('"', ""),
      {
        lines: JSON.parse(`[${match.groups.lines}]`),
        msPerChar: Number(match.groups.msPerChar),
        holdMs: Number(match.groups.holdMs),
      },
    ]),
  );
}

function lockedNarrationText(catalog, id) {
  const prompt = catalog.match(new RegExp(`"${id}": NarrationPrompt\\("(?<text>[^"]+)"\\),`));
  assert.ok(prompt, `scripts/generate_game_audio.py must lock narration text for ${id}`);
  return prompt.groups.text;
}

function elevenLabsNarrationCatalog(source) {
  const declaration = source.match(/const NARR = \[(?<entries>[\s\S]*?)\];/);
  assert.ok(declaration, "tmp/generate-audio.mjs must declare the ElevenLabs NARR catalog");

  return Object.fromEntries(
    [...declaration.groups.entries.matchAll(/\{\s*file:\s*'(?<file>[^']+)',\s*text:\s*'(?<text>[^']+)'\s*\}/g)]
      .map((match) => [match.groups.file, match.groups.text]),
  );
}

test("every eager app module is shipped in the Pages artifact and precached offline", async () => {
  const [app, workflow, serviceWorker] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
  ]);
  const dependencies = eagerRelativeImports(app);

  assert.ok(dependencies.length > 0, "app.js must retain at least one eager relative ESM import");

  const pagesArtifact = archivePaths(workflow);
  const serviceWorkerCore = coreAssetPaths(serviceWorker);
  const missingFromArtifact = dependencies.filter((dependency) => !pagesArtifact.has(dependency));
  const missingFromServiceWorker = dependencies.filter((dependency) => !serviceWorkerCore.has(dependency));

  assert.deepEqual(
    missingFromArtifact,
    [],
    `Eager app modules missing from Pages git archive: ${missingFromArtifact.join(", ")}`,
  );
  assert.deepEqual(
    missingFromServiceWorker,
    [],
    `Eager app modules missing from service-worker CORE_ASSETS: ${missingFromServiceWorker.join(", ")}`,
  );
});

test("requested reward art belongs to a stage reward and exists in the release assets", async () => {
  const app = await readProjectFile("app.js");
  const artIds = rewardArtIds(app);
  const stageRewardIds = new Set(STAGES.flatMap((stage) => stage.rewards.map((reward) => reward.id)));

  const unknownStageRewardIds = artIds.filter((id) => !stageRewardIds.has(id));
  assert.ok(artIds.length > 0, "REWARD_ART_IDS must include at least one literal reward ID");
  assert.deepEqual(
    unknownStageRewardIds,
    [],
    `Reward art requested for IDs not offered by any stage: ${unknownStageRewardIds.join(", ")}`,
  );

  const missingArt = [];
  for (const id of artIds) {
    try {
      await readProjectFile(`assets/images/ui/reward-${id}.png`);
    } catch {
      missingArt.push(`assets/images/ui/reward-${id}.png`);
    }
  }

  assert.deepEqual(missingArt, [], `Reward art files missing from the release: ${missingArt.join(", ")}`);
});

test("TWA launch URLs target the canonical GitHub Pages application base", async () => {
  const twaManifest = JSON.parse(await readProjectFile("apk/twa-manifest.json"));

  assert.deepEqual(
    {
      startUrl: twaManifest.startUrl,
      iconUrl: twaManifest.iconUrl,
      webManifestUrl: twaManifest.webManifestUrl,
    },
    {
      startUrl: `${new URL(CANONICAL_PAGES_BASE).pathname}/`,
      iconUrl: `${CANONICAL_PAGES_BASE}/assets/icons/icon-512.png`,
      webManifestUrl: `${CANONICAL_PAGES_BASE}/manifest.json`,
    },
  );
});

test("every narration audio asset requested by app.js is declared in the media manifest", async () => {
  const [app, manifestSource] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile("assets/media-manifest.json"),
  ]);
  const narrationPaths = narrationAudioPaths(app);
  const declaredAssets = new Set(JSON.parse(manifestSource).assets.map((asset) => asset.filename));
  const undeclaredNarration = narrationPaths.filter((path) => !declaredAssets.has(path));

  assert.ok(narrationPaths.length > 0, "NARRATION must include at least one literal audio asset path");
  assert.deepEqual(
    undeclaredNarration,
    [],
    `Narration audio assets missing from assets/media-manifest.json: ${undeclaredNarration.join(", ")}`,
  );
});

test("runtime narration preserves the locked spoken lines and timing", async () => {
  const app = await readProjectFile("app.js");

  assert.doesNotMatch(app, /심연은 다음 군주를 기억한다\./);

  assert.deepEqual(runtimeNarrationEntries(app), {
    intro: {
      lines: ["심연의 문이 열렸다.", "그림자 군주여, 일어나라."],
      msPerChar: 45,
      holdMs: 1400,
    },
    "cinder-span": {
      lines: ["잿빛 교량, 신더 스팬.", "재의 메아리를 사냥하고 영혼을 거두어라."],
      msPerChar: 45,
      holdMs: 2000,
    },
    "veil-citadel": {
      lines: ["장막 성채, 베일 시타델.", "빙의의 힘이 깨어난다.", "두 거점을 동시에 장악하라."],
      msPerChar: 45,
      holdMs: 1700,
    },
    "echo-throne": {
      lines: ["메아리 왕좌.", "군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."],
      msPerChar: 45,
      holdMs: 2000,
    },
    victory: {
      lines: ["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."],
      msPerChar: 45,
      holdMs: 1400,
    },
    defeat: {
      lines: ["군단의 닻이 끊어졌다.", "다시, 일어나라."],
      msPerChar: 45,
      holdMs: 1400,
    },
  });
});

test("changed narration stays synchronized across runtime and generator catalogs", async () => {
  const [app, lockedCatalog, elevenLabsSource, manifestSource] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile("scripts/generate_game_audio.py"),
    readProjectFile("tmp/generate-audio.mjs"),
    readProjectFile("assets/media-manifest.json"),
  ]);
  const runtimeNarration = runtimeNarrationEntries(app);
  const runtimeAudioPaths = runtimeNarrationAudioCatalog(app);
  const elevenLabsNarration = elevenLabsNarrationCatalog(elevenLabsSource);
  const declaredAssets = new Set(JSON.parse(manifestSource).assets.map((asset) => asset.filename));
  const canonicalNarration = {
    intro: {
      lines: ["심연의 문이 열렸다.", "그림자 군주여, 일어나라."],
      audio: "assets/audio/narr-intro.mp3",
      elevenLabsFile: "narr-intro.mp3",
    },
    victory: {
      lines: ["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."],
      audio: "assets/audio/narr-victory.mp3",
      elevenLabsFile: "narr-victory.mp3",
    },
    defeat: {
      lines: ["군단의 닻이 끊어졌다.", "다시, 일어나라."],
      audio: "assets/audio/narr-defeat.mp3",
      elevenLabsFile: "narr-defeat.mp3",
    },
  };

  for (const [id, expected] of Object.entries(canonicalNarration)) {
    assert.ok(runtimeNarration[id], `app.js must declare narration for ${id}`);
    assert.deepEqual(runtimeNarration[id].lines, expected.lines, `app.js narration drifted for ${id}`);
    assert.equal(
      lockedNarrationText(lockedCatalog, id),
      expected.lines.join(" "),
      `scripts/generate_game_audio.py narration drifted for ${id}`,
    );
    assert.equal(
      elevenLabsNarration[expected.elevenLabsFile],
      expected.lines.join(" "),
      `tmp/generate-audio.mjs narration drifted for ${id}`,
    );
    assert.equal(
      runtimeAudioPaths[id],
      expected.audio,
      `app.js narration audio path drifted for ${id}`,
    );
    assert.equal(
      `assets/audio/${expected.elevenLabsFile}`,
      expected.audio,
      `tmp/generate-audio.mjs audio path drifted for ${id}`,
    );
    assert.ok(
      declaredAssets.has(expected.audio),
      `Narration audio asset missing from assets/media-manifest.json: ${expected.audio}`,
    );
  }
});

test("regenerated narration audio matches its manifest identity and locked source text", async () => {
  const [lockedCatalog, manifestSource] = await Promise.all([
    readProjectFile("scripts/generate_game_audio.py"),
    readProjectFile("assets/media-manifest.json"),
  ]);
  const narrationFiles = {
    intro: "assets/audio/narr-intro.mp3",
    "cinder-span": "assets/audio/narr-stage1.mp3",
    "veil-citadel": "assets/audio/narr-stage2.mp3",
    "echo-throne": "assets/audio/narr-stage3.mp3",
    victory: "assets/audio/narr-victory.mp3",
    defeat: "assets/audio/narr-defeat.mp3",
  };
  const manifestAssets = JSON.parse(manifestSource).assets;

  await Promise.all(Object.entries(narrationFiles).map(async ([id, filename]) => {
    const [audio, manifestRecord] = await Promise.all([
      readFile(new URL(filename, SOURCE_ROOT)),
      Promise.resolve(manifestAssets.find((asset) => asset.filename === filename)),
    ]);
    assert.ok(manifestRecord, `Narration audio asset missing from assets/media-manifest.json: ${filename}`);

    assert.equal(
      audio.byteLength,
      manifestRecord.bytes,
      `Narration byte length drifted from its media manifest record: ${filename}`,
    );
    assert.equal(
      createHash("sha256").update(audio).digest("hex"),
      manifestRecord.sha256,
      `Narration SHA-256 drifted from its media manifest record: ${filename}`,
    );
    assert.ok(
      manifestRecord.derivation.includes(lockedNarrationText(lockedCatalog, id)),
      `Narration derivation must retain its locked source sentence: ${id}`,
    );
  }));
});
