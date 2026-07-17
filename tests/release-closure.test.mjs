import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STAGES } from "../campaign-state.js";

const SOURCE_ROOT = new URL("../", import.meta.url);
const CANONICAL_PAGES_BASE = "https://jellyggumi.github.io/Abyssal-Surge";

async function readProjectFile(path) {
  return readFile(new URL(path, SOURCE_ROOT), "utf8");
}

function staticRelativeImports(source) {
  const imports = new Set();
  const statement = /^\s*import\s+(?:[\s\S]*?\sfrom\s+)?["'](?<specifier>\.\/[^"']+)["']\s*;?/gm;

  for (const match of source.matchAll(statement)) {
    imports.add(match.groups.specifier);
  }

  return imports;
}

function projectRelativePath(moduleUrl) {
  assert.ok(
    moduleUrl.href.startsWith(SOURCE_ROOT.href),
    `local ESM imports must remain within the repository: ${moduleUrl.href}`,
  );

  return `./${decodeURIComponent(moduleUrl.pathname.slice(SOURCE_ROOT.pathname.length))}`;
}

async function localModuleClosure(entryPath) {
  const visited = new Set();
  const entryUrl = new URL(entryPath, SOURCE_ROOT);
  const entryModule = projectRelativePath(entryUrl);

  async function visit(moduleUrl) {
    const modulePath = projectRelativePath(moduleUrl);
    if (visited.has(modulePath)) {
      return;
    }

    visited.add(modulePath);
    const source = await readFile(moduleUrl, "utf8");
    await Promise.all(
      [...staticRelativeImports(source)].map((specifier) => visit(new URL(specifier, moduleUrl))),
    );
  }

  await visit(entryUrl);
  visited.delete(entryModule);
  return [...visited].sort();
}

function archivePaths(workflow) {
  const declaration = workflow.match(
    /^ {6}PAGES_RUNTIME_PATHS: >-\n(?<paths>(?: {8}[^\n]*(?:\n|$))+)/m,
  );
  assert.ok(declaration, "static Pages workflow must define PAGES_RUNTIME_PATHS as a folded scalar");

  return new Set(declaration.groups.paths.trim().split(/\s+/).map((path) => `./${path}`));
}


function optionalMediaPaths(serviceWorker) {
  const declaration = serviceWorker.match(/const OPTIONAL_MEDIA = \[(?<assets>[\s\S]*?)\];/);
  assert.ok(declaration, "service worker must declare OPTIONAL_MEDIA");

  return [...declaration.groups.assets.matchAll(/["'](?<path>\.[^"']+)["']/g)]
    .map((match) => match.groups.path);
}
function runtimeGlbUrls(source) {
  const declaration = source.match(/const STAGE_ASSETS = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(declaration, "battle-realtime-three.js must declare STAGE_ASSETS");

  const modelRoot = source.match(/const MODEL_ROOT = "(?<root>\.\/assets\/models\/[^"]+\/)";/);
  assert.ok(modelRoot, "battle-realtime-three.js must declare MODEL_ROOT");

  const resources = source.match(/const resources = \[(?<entries>[\s\S]*?)\];/);
  assert.ok(resources, "battle-realtime-three.js must declare its direct model resources");

  const stageAssets = [...declaration.groups.entries.matchAll(/(?:terrain|boss): "(?<asset>[^"]+\.glb)"/g)]
    .map((match) => match.groups.asset);
  const directAssets = [...resources.groups.entries.matchAll(/["'](?<asset>[^"']+\.glb)["']/g)]
    .map((match) => match.groups.asset);

  return [...new Set([...stageAssets, ...directAssets])]
    .map((asset) => `${modelRoot.groups.root}${asset}`)
    .sort();
}
function glbBridgeManifestPath(serviceWorker, battleVisualizer) {
  const serviceWorkerDeclaration = serviceWorker.match(
    /const GLB_BRIDGE_MANIFEST = "(?<path>\.\/assets\/images\/battle\/glb\/manifest\.json)";/,
  );
  assert.ok(serviceWorkerDeclaration, "sw.js must declare the GLB bridge manifest");

  const visualizerDeclaration = battleVisualizer.match(
    /const GLB_BRIDGE_MANIFEST = "(?<path>assets\/images\/battle\/glb\/manifest\.json)";/,
  );
  assert.ok(visualizerDeclaration, "battle-visualizer.js must declare the GLB bridge manifest");
  assert.equal(
    serviceWorkerDeclaration.groups.path,
    `./${visualizerDeclaration.groups.path}`,
    "sw.js and battle-visualizer.js must resolve the same GLB bridge manifest",
  );
  return serviceWorkerDeclaration.groups.path;
}

function directVisualizerImagePaths(battleVisualizer) {
  const bossArt = battleVisualizer.match(/const BOSS_ART = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(bossArt, "battle-visualizer.js must declare BOSS_ART");
  const unitAtlas = battleVisualizer.match(
    /const UNIT_ATLAS = Object\.freeze\(\{\s*src: "(?<path>assets\/images\/[^"]+)"/,
  );
  assert.ok(unitAtlas, "battle-visualizer.js must declare UNIT_ATLAS.src");

  const bossImages = [...bossArt.groups.entries.matchAll(/:\s*"(?<path>assets\/images\/[^"]+)"/g)]
    .map((match) => `./${match.groups.path}`);
  return [...new Set([...bossImages, `./${unitAtlas.groups.path}`])].sort();
}

function bridgeOutputPaths(bridgeManifest, bridgeRoot) {
  assert.ok(Array.isArray(bridgeManifest.records), "GLB bridge manifest must declare records");
  assert.ok(bridgeManifest.records.length > 0, "GLB bridge manifest must not be empty");
  const bridgeRootWithoutDot = bridgeRoot.slice(2);
  const outputs = new Set();

  return bridgeManifest.records.map((record, index) => {
    assert.ok(record && typeof record === "object", `GLB bridge record ${index} must be metadata`);
    const output = record.output;
    assert.ok(output && typeof output === "object", `GLB bridge record ${index} must declare output metadata`);
    const outputPath = output.path;
    assert.equal(typeof outputPath, "string", `GLB bridge record ${index} must declare an output path`);
    assert.ok(
      outputPath.startsWith(`${bridgeRootWithoutDot}/`),
      `GLB bridge output ${outputPath} must stay under ${bridgeRoot}`,
    );
    assert.ok(
      outputPath.endsWith(".png") &&
        !outputPath.includes("\\") &&
        outputPath.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
      `GLB bridge output ${outputPath} must use a safe in-root PNG path`,
    );
    assert.ok(!outputs.has(outputPath), `GLB bridge output ${outputPath} must be unique`);
    outputs.add(outputPath);
    assert.equal(output.mimeType, "image/png", `GLB bridge output ${outputPath} must be a PNG`);
    assert.ok(
      Number.isInteger(output.width) &&
        output.width > 0 &&
        Number.isInteger(output.height) &&
        output.height > 0,
      `GLB bridge output ${outputPath} must have positive dimensions`,
    );
    return `./${outputPath}`;
  });
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


test("every static local app module is shipped in the Pages artifact and precached offline", async () => {
  const [workflow, serviceWorker, dependencies] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
    localModuleClosure("app.js"),
  ]);

  assert.ok(dependencies.length > 0, "app.js must retain at least one static local ESM import");

  const pagesArtifact = archivePaths(workflow);
  const serviceWorkerCore = coreAssetPaths(serviceWorker);
  const missingFromArtifact = dependencies.filter((dependency) => !pagesArtifact.has(dependency));
  const missingFromServiceWorker = dependencies.filter((dependency) => !serviceWorkerCore.has(dependency));

  assert.deepEqual(
    missingFromArtifact,
    [],
    `Static local app module closure missing from Pages git archive: ${missingFromArtifact.join(", ")}`,
  );
  assert.deepEqual(
    missingFromServiceWorker,
    [],
    `Static local app module closure missing from service-worker CORE_ASSETS: ${missingFromServiceWorker.join(", ")}`,
  );
});

test("campaign rendering supplies the engine stage checklist to the checklist view", async () => {
  const app = await readProjectFile("app.js");

  assert.match(
    app,
    /import\s*\{[\s\S]*?\bgetStageChecklist\b[\s\S]*?\}\s*from\s*["']\.\/campaign-state\.js["'];/,
    "app.js must import getStageChecklist from the campaign engine",
  );
  assert.match(
    app,
    /renderChecklist\s*\(\s*getStageChecklist\s*\(\s*campaign\s*\)\s*\)/,
    "campaign rendering must pass the engine stage checklist to renderChecklist",
  );
  assert.doesNotMatch(
    app,
    /\bbuildChecklist\s*\(/,
    "campaign rendering must not invoke the undefined buildChecklist producer",
  );
});

test("Pages artifact ships all optional media without publishing inventory or unused videos", async () => {
  const [workflow, serviceWorker, battleVisualizer] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
    readProjectFile("battle-visualizer.js"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const optionalMedia = optionalMediaPaths(serviceWorker);
  const missingOptionalMediaFiles = (await Promise.all(optionalMedia.map(async (path) => {
    try {
      await readProjectFile(path.slice(2));
      return null;
    } catch {
      return path;
    }
  }))).filter(Boolean);
  const missingOptionalMediaAllowlist = optionalMedia.filter((path) => !pagesArtifact.has(path));
  const optionalImages = optionalMedia.filter((path) => path.startsWith("./assets/images/")).sort();
  const bridgeManifestPath = glbBridgeManifestPath(serviceWorker, battleVisualizer);
  const bridgeRoot = bridgeManifestPath.replace(/\/manifest\.json$/, "");
  const directVisualizerImages = directVisualizerImagePaths(battleVisualizer);
  const individualRuntimeImageTokens = [...pagesArtifact]
    .filter((path) => path.startsWith("./assets/images/") && path !== bridgeRoot)
    .sort();
  const bridgeManifest = JSON.parse(await readProjectFile(bridgeManifestPath.slice(2)));
  const bridgeOutputs = bridgeOutputPaths(bridgeManifest, bridgeRoot);
  const missingBridgeOutputFiles = (await Promise.all(bridgeOutputs.map(async (path) => {
    try {
      await readProjectFile(path.slice(2));
      return null;
    } catch {
      return path;
    }
  }))).filter(Boolean);
  const bridgeDeclarations = [...pagesArtifact]
    .filter((path) => path === bridgeRoot || path.startsWith(`${bridgeRoot}/`))
    .sort();
  const runtimeVideos = [...pagesArtifact]
    .filter((path) => path.startsWith("./assets/video/") && path.endsWith(".mp4"))
    .sort();

  assert.ok(optionalMedia.length > 0, "service worker must retain optional media for offline caching");
  assert.deepEqual(
    missingOptionalMediaFiles,
    [],
    `OPTIONAL_MEDIA files missing from the repository: ${missingOptionalMediaFiles.join(", ")}`,
  );
  assert.ok(directVisualizerImages.length > 0, "battle visualizer must retain direct runtime image paths");
  assert.deepEqual(
    missingOptionalMediaAllowlist,
    [],
    `OPTIONAL_MEDIA paths must be individually allowlisted by Pages: ${missingOptionalMediaAllowlist.join(", ")}`,
  );
  assert.equal(
    pagesArtifact.has("./assets"),
    false,
    "Pages artifact must not include the broad assets directory",
  );
  assert.equal(
    pagesArtifact.has("./assets/media-manifest.json"),
    false,
    "Pages artifact must not publish the media inventory manifest",
  );
  assert.equal(
    pagesArtifact.has("./assets/images"),
    false,
    "Pages artifact must not include the broad assets/images directory",
  );
  assert.equal(
    pagesArtifact.has("./assets/images/battle"),
    false,
    "Pages artifact must not include the broad assets/images/battle directory",
  );
  assert.deepEqual(
    individualRuntimeImageTokens,
    [...new Set([...optionalImages, ...directVisualizerImages])].sort(),
    "Pages artifact must individually declare only optional and direct visualizer images",
  );
  assert.deepEqual(
    bridgeDeclarations,
    [bridgeRoot],
    "Pages artifact must declare exactly the narrow GLB bridge root",
  );
  assert.deepEqual(
    missingBridgeOutputFiles,
    [],
    `GLB bridge output files missing from the repository: ${missingBridgeOutputFiles.join(", ")}`,
  );
  assert.deepEqual(
    runtimeVideos,
    [
      "./assets/video/abyssal-surge-cinematic.mp4",
      "./assets/video/cinder-span.mp4",
      "./assets/video/echo-throne.mp4",
      "./assets/video/veil-citadel.mp4",
    ],
    "Pages artifact must allowlist exactly the supported runtime videos",
  );
});
test("cinematic captions and transcript release surfaces are explicitly published", async () => {
  const [workflow, index] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("index.html"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const cinematic = index.match(/<video id="campaign-cinematic"(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/video>/);
  assert.ok(cinematic, "index.html must declare the campaign cinematic video element");

  const captions = cinematic.groups.content.match(
    /<track\b(?=[^>]*\bkind="captions")(?=[^>]*\bsrclang="ko")(?=[^>]*\blabel="한국어 자막")(?=[^>]*\bsrc="(?<source>assets\/video\/[^"]+\.vtt)")(?=[^>]*\bdefault\b)[^>]*>/,
  );
  assert.ok(captions, "campaign cinematic must declare default Korean captions");
  assert.equal(
    captions.groups.source,
    "assets/video/abyssal-surge-cinematic.ko.vtt",
    "campaign cinematic must declare its committed Korean captions asset",
  );

  const transcriptToggle = index.match(/<button id="toggle-cinematic-transcript"(?<attributes>[^>]*)>/);
  assert.ok(transcriptToggle, "index.html must provide a cinematic transcript toggle");
  assert.match(
    transcriptToggle.groups.attributes,
    /\baria-controls="cinematic-transcript"/,
    "cinematic transcript toggle must control the transcript surface",
  );
  assert.match(
    transcriptToggle.groups.attributes,
    /\baria-expanded="false"/,
    "cinematic transcript toggle must expose its initial collapsed state",
  );

  const transcript = index.match(
    /<section id="cinematic-transcript"(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/section>/,
  );
  assert.ok(transcript, "index.html must include an accessible cinematic transcript surface");
  assert.match(
    transcript.groups.attributes,
    /\bhidden\b/,
    "cinematic transcript must begin hidden until the toggle requests it",
  );
  const transcriptLabel = transcript.groups.attributes.match(/\baria-labelledby="(?<id>[^"]+)"/);
  assert.ok(transcriptLabel, "cinematic transcript must have an accessible label");
  assert.match(
    transcript.groups.content,
    new RegExp(`<h[1-6]\\s+id="${transcriptLabel.groups.id}"`),
    "cinematic transcript must include its referenced heading",
  );

  const captionsPath = `./${captions.groups.source}`;
  await readProjectFile(captions.groups.source);
  assert.equal(
    pagesArtifact.has(captionsPath),
    true,
    `Cinematic captions must be individually allowlisted by Pages: ${captionsPath}`,
  );
  assert.equal(
    pagesArtifact.has("./index.html"),
    true,
    "Pages artifact must include the cinematic transcript document",
  );
});
test("Pages artifact explicitly allowlists the complete runtime GLB surface", async () => {
  const [workflow, battleRuntime] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("battle-realtime-three.js"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const runtimeGlbs = runtimeGlbUrls(battleRuntime);
  const publishedModels = [...pagesArtifact].filter((path) => path.startsWith("./assets/models/")).sort();

  assert.ok(runtimeGlbs.length > 0, "runtime battle resources must include direct GLB URLs");
  assert.equal(
    pagesArtifact.has("./assets/models"),
    false,
    "Pages artifact must not include the broad assets/models directory",
  );
  assert.equal(
    pagesArtifact.has("./assets/models/abyssal-command"),
    false,
    "Pages artifact must not include the broad Abyssal Command model directory",
  );
  assert.deepEqual(
    publishedModels,
    runtimeGlbs,
    "Pages artifact must individually allowlist exactly the complete direct runtime GLB set",
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

test("public launch documentation uses the canonical Pages application base", async () => {
  const documents = await Promise.all(
    ["README.md", "apk/BUILD.md"].map(async (path) => [path, await readProjectFile(path)]),
  );

  for (const [path, source] of documents) {
    assert.doesNotMatch(source, /Abyssal-Command/, `${path} must not reference the former public app URL`);
    assert.ok(source.includes(CANONICAL_PAGES_BASE), `${path} must link to the canonical Pages application`);
  }
  const buildGuide = documents.find(([path]) => path === "apk/BUILD.md")?.[1];
  const hostRootAssetLinks = "https://jellyggumi.github.io/.well-known/assetlinks.json";
  const projectPathAssetLinks = `${CANONICAL_PAGES_BASE}/.well-known/assetlinks.json`;

  assert.ok(buildGuide, "apk/BUILD.md must be included in public launch documentation checks");
  assert.ok(
    buildGuide.includes(hostRootAssetLinks),
    "apk/BUILD.md must document the host-root Digital Asset Links endpoint",
  );
  assert.equal(
    buildGuide.includes(projectPathAssetLinks),
    false,
    "apk/BUILD.md must not use the project-path Digital Asset Links endpoint",
  );
});
test("TWA build guidance verifies the service worker cache used by the app", async () => {
  const [serviceWorker, buildGuide] = await Promise.all([
    readProjectFile("sw.js"),
    readProjectFile("apk/BUILD.md"),
  ]);
  const cacheName = /const CACHE_NAME = ["'](?<cacheName>[^"']+)["'];/.exec(serviceWorker)?.groups?.cacheName;

  assert.ok(cacheName, "sw.js must define CACHE_NAME");
  assert.ok(buildGuide.includes(cacheName), `apk/BUILD.md must verify the ${cacheName} offline cache`);
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

test("changed narration stays synchronized across runtime, committed generator, and manifest", async () => {
  const [app, lockedCatalog, manifestSource] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile("scripts/generate_game_audio.py"),
    readProjectFile("assets/media-manifest.json"),
  ]);
  const runtimeNarration = runtimeNarrationEntries(app);
  const runtimeAudioPaths = runtimeNarrationAudioCatalog(app);
  const declaredAssets = new Set(JSON.parse(manifestSource).assets.map((asset) => asset.filename));
  const canonicalNarration = {
    intro: {
      lines: ["심연의 문이 열렸다.", "그림자 군주여, 일어나라."],
      audio: "assets/audio/narr-intro.mp3",
    },
    victory: {
      lines: ["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."],
      audio: "assets/audio/narr-victory.mp3",
    },
    defeat: {
      lines: ["군단의 닻이 끊어졌다.", "다시, 일어나라."],
      audio: "assets/audio/narr-defeat.mp3",
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
      runtimeAudioPaths[id],
      expected.audio,
      `app.js narration audio path drifted for ${id}`,
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
