import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import vm from "node:vm";
import { STAGES } from "../campaign-state.js";
import { translations } from "../i18n.js";

const execFileAsync = promisify(execFile);

const SOURCE_ROOT = new URL("../", import.meta.url);
const CANONICAL_PAGES_BASE = "https://jellyggumi.github.io/Abyssal-Surge";

async function readProjectFile(path) {
  return readFile(new URL(path, SOURCE_ROOT), "utf8");
}

async function ffprobeAudioDurationMs(assetPath) {
  const audioFsPath = fileURLToPath(new URL(assetPath, SOURCE_ROOT));
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "format=duration",
    "-of", "json",
    audioFsPath,
  ]);
  const duration = Number(JSON.parse(stdout).format?.duration);
  assert.ok(
    Number.isFinite(duration) && duration > 0,
    `ffprobe must report a positive duration for ${assetPath}`,
  );
  return duration * 1000;
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

function workflowGuardScript(workflow) {
  const declaration = workflow.match(
    /^ {6}- name: Guard committed static import closure\n(?<step>[\s\S]*?)(?=^ {6}- name: |(?![\s\S]))/m,
  );
  assert.ok(declaration, "static Pages workflow must retain the committed static import closure guard");

  const run = declaration.groups.step.match(/^ {8}run: \|\n(?<script>[\s\S]*)/m);
  assert.ok(run, "committed static import closure guard must define a shell script");
  return run.groups.script.replace(/^ {10}/gm, "");
}

function committedGuardPaths(workflow) {
  const declaration = workflowGuardScript(workflow).match(
    /for file in \\\n(?<paths>[\s\S]*?); do/,
  );
  assert.ok(declaration, "committed static import closure guard must enumerate its guarded paths");

  return new Set(
    declaration.groups.paths
      .replace(/\\\n/g, " ")
      .trim()
      .split(/\s+/)
      .map((path) => `./${path}`),
  );
}

function syntaxCheckedPaths(workflow) {
  return new Set(
    [...workflowGuardScript(workflow).matchAll(/^\s*node --check (?<path>\S+)\s*$/gm)]
      .map((match) => `./${match.groups.path}`),
  );
}

function indexLocalRuntimeEntrypoints(index) {
  const paths = [];

  for (const tag of index.matchAll(/<(link|script)\b(?<attributes>[^>]*)>/gi)) {
    const attributes = tag.groups.attributes;
    const localPath = attributes.match(/\b(?:href|src)=["'](?<path>[^"']+)["']/i)?.groups?.path;
    const isStylesheet = tag[1].toLowerCase() === "link" && /\brel=["']stylesheet["']/i.test(attributes);
    const isScript = tag[1].toLowerCase() === "script";

    if (!localPath || (!isStylesheet && !isScript) || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(localPath)) continue;
    paths.push(projectRelativePath(new URL(localPath, SOURCE_ROOT)));
  }

  return [...new Set(paths)].sort();
}

function indexScripts(index) {
  return [...index.matchAll(/<script\b(?<attributes>[^>]*)>/gi)]
    .map((tag) => {
      const source = tag.groups.attributes.match(/\bsrc=["'](?<path>[^"']+)["']/i)?.groups?.path;
      return source ? { source, attributes: tag.groups.attributes } : null;
    })
    .filter(Boolean);
}

function reactLiteralIds(source) {
  return new Set(
    [...source.matchAll(/\bid:\s*["'](?<id>[A-Za-z][\w-]*)["']/g)]
      .map((match) => match.groups.id),
  );
}

function appQueriedIds(source) {
  const ids = new Set(
    [...source.matchAll(/document\.querySelector(?:All)?\(\s*["']#(?<id>[A-Za-z][\w-]*)[^"']*["']\s*\)/g)]
      .map((match) => match.groups.id),
  );
  for (const match of source.matchAll(/document\.getElementById\(\s*["'](?<id>[A-Za-z][\w-]*)["']\s*\)/g)) {
    ids.add(match.groups.id);
  }
  return [...ids].sort();
}

function reactLiteralI18nKeys(source) {
  return new Set(
    [...source.matchAll(/["']data-i18n(?:-aria|-alt)?["']:\s*["'](?<key>[^"']+)["']\s*(?=[,}])/g)]
      .map((match) => match.groups.key),
  );
}

function cssBlock(source, header) {
  const normalized = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const headerIndex = normalized.indexOf(header);
  assert.notEqual(headerIndex, -1, `stylesheet must retain ${header}`);
  const openIndex = normalized.indexOf("{", headerIndex + header.length);
  assert.notEqual(openIndex, -1, `${header} must open a CSS block`);
  let depth = 1;
  for (let index = openIndex + 1; index < normalized.length; index += 1) {
    if (normalized[index] === "{") depth += 1;
    if (normalized[index] === "}") depth -= 1;
    if (depth === 0) return normalized.slice(openIndex + 1, index);
  }
  assert.fail(`${header} must close its CSS block`);
}

function cssRules(source) {
  const rules = [];
  let cursor = 0;
  while (cursor < source.length) {
    const openIndex = source.indexOf("{", cursor);
    if (openIndex === -1) break;
    const selector = source.slice(cursor, openIndex).trim();
    let depth = 1;
    let closeIndex = openIndex + 1;
    for (; closeIndex < source.length && depth > 0; closeIndex += 1) {
      if (source[closeIndex] === "{") depth += 1;
      if (source[closeIndex] === "}") depth -= 1;
    }
    assert.equal(depth, 0, `${selector} must close its CSS rule`);
    const body = source.slice(openIndex + 1, closeIndex - 1);
    if (selector.startsWith("@")) {
      rules.push(...cssRules(body));
    } else {
      rules.push({ selector, body });
    }
    cursor = closeIndex;
  }
  return rules;
}

function cssDeclaration(rule, property) {
  const declaration = rule.body
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${property}:`));
  return declaration?.slice(declaration.indexOf(":") + 1).trim();
}

function sourceFunctionBody(source, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(declaration, `app.js must declare ${name}()`);
  const openIndex = declaration.index + declaration[0].lastIndexOf("{");
  let depth = 1;
  for (let index = openIndex + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  assert.fail(`${name}() must close its function body`);
}

function absoluteCssPixels(value) {
  const length = /^(?<amount>\d*\.?\d+)(?<unit>px|rem)(?:\s*!important)?$/.exec(value ?? "");
  assert.ok(length, `expected an absolute px/rem CSS length, received ${value}`);
  return Number(length.groups.amount) * (length.groups.unit === "rem" ? 16 : 1);
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
  const props = source.match(/const props = \[(?<entries>[\s\S]*?)\];/);
  assert.ok(props, "battle-realtime-three.js must declare its prop model resources");

  const stageAssets = [...declaration.groups.entries.matchAll(/(?:terrain|boss): "(?<asset>[^"]+\.glb)"/g)]
    .map((match) => match.groups.asset);
  const directAssets = [...resources.groups.entries.matchAll(/["'](?<asset>[^"']+\.glb)["']/g)]
    .map((match) => match.groups.asset);
  const propAssets = [...props.groups.entries.matchAll(/["'](?<asset>[^"']+\.glb)["']/g)]
    .map((match) => match.groups.asset);

  return [...new Set([...stageAssets, ...directAssets, ...propAssets])]
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
    const rawOutputPath = outputPath.split(/[?#]/, 1)[0];
    assert.ok(
      outputPath.startsWith(`${bridgeRootWithoutDot}/`),
      `GLB bridge output ${outputPath} must stay under ${bridgeRoot}`,
    );
    assert.ok(
      outputPath.endsWith(".png") &&
        !/(?:^|[\\/])(?:\.|%2e){1,2}(?=[\\/]|$)|%2f|%5c|\\/i.test(rawOutputPath) &&
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

function coreRequestPaths(serviceWorker) {
  const declaration = serviceWorker.match(
    /function isCoreRequest\([^)]*\)\s*\{[\s\S]*?return[\s\S]*?\[(?<assets>[\s\S]*?)\]\.some\(/,
  );
  assert.ok(declaration, "service worker must classify its core request paths in isCoreRequest()");

  return new Set(
    [...declaration.groups.assets.matchAll(/["'](?<path>\/[^"']+)["']/g)]
      .map((match) => `.${match.groups.path}`),
  );
}

function runtimeAssetPath(path) {
  const declaration = path.match(/^(?:\.\/)?(?<asset>assets\/(?<subpath>[^?#]+))$/);
  assert.ok(declaration, `runtime media URL must be a literal relative assets path: ${path}`);
  const segments = declaration.groups.subpath.split("/");
  assert.ok(
    segments.every(
      (segment) =>
        segment !== "" &&
        segment !== "." &&
        segment !== ".." &&
        !/%2e|%2f|%5c/i.test(segment) &&
        !segment.includes("\\"),
    ),
    `runtime media URL must use a safe assets subpath: ${path}`,
  );
  return `./${declaration.groups.asset}`;
}

function runtimeMediaPaths(app, index) {
  const objectDeclarations = [
    "CUE_BY_EFFECT",
    "BOSS_BY_STAGE",
    "NARRATOR_ATLAS_BY_STAGE",
    "VIDEO_BY_STAGE",
    "IMAGE_BY_STAGE",
  ];
  const appPaths = objectDeclarations.flatMap((name) => {
    const declaration = app.match(
      new RegExp(`const ${name} = Object\\.freeze\\(\\{(?<entries>[\\s\\S]*?)\\}\\);`),
    );
    assert.ok(declaration, `app.js must declare ${name}`);
    return [...declaration.groups.entries.matchAll(
      /^\s*(?:"[^"]+"|\w+)\s*:\s*"(?<path>(?:\.\/)?assets\/[^"]+)"/gm,
    )].map((match) => match.groups.path);
  });
  const narration = app.match(/const NARRATION = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  assert.ok(narration, "app.js must declare NARRATION");
  appPaths.push(
    ...[...narration.groups.entries.matchAll(
      /^\s*audio:\s*"(?<path>(?:\.\/)?assets\/[^"]+)"/gm,
    )].map((match) => match.groups.path),
  );
  for (const expression of [
    /const TACTICAL_SURFACE = "(?<path>(?:\.\/)?assets\/[^"]+)";/,
    /new Audio\("(?<path>(?:\.\/)?assets\/[^"]+)"\)/,
    /\bvideo\.src = "(?<path>(?:\.\/)?assets\/[^"]+)";/,
  ]) {
    const match = app.match(expression);
    assert.ok(match, `app.js must retain runtime media declaration ${expression}`);
    appPaths.push(match.groups.path);
  }

  const indexPaths = [...index.matchAll(
    /<(?:audio|video|img|track)\b[^>]*\bsrc=["'](?<path>(?:\.\/)?assets\/[^"']+)["'][^>]*>/gi,
  )].map((match) => match.groups.path);

  return [...new Set([...appPaths, ...indexPaths].map(runtimeAssetPath))].sort();
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


test("every static local app module is shipped, guarded, syntax checked when required, and available offline", async () => {
  const [workflow, serviceWorker, dependencies] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
    localModuleClosure("app.js"),
  ]);

  assert.ok(dependencies.length > 0, "app.js must retain at least one static local ESM import");

  const pagesArtifact = archivePaths(workflow);
  const committedGuard = committedGuardPaths(workflow);
  const syntaxChecks = syntaxCheckedPaths(workflow);
  const serviceWorkerCore = coreAssetPaths(serviceWorker);
  const serviceWorkerClassifier = coreRequestPaths(serviceWorker);
  const tacticalMinimapDependencies = dependencies.filter(
    (dependency) => dependency === "./tactical-minimap.js",
  );
  const gaps = {
    pagesRuntimePaths: dependencies.filter((dependency) => !pagesArtifact.has(dependency)),
    committedFileGuard: dependencies.filter((dependency) => !committedGuard.has(dependency)),
    tacticalMinimapSyntaxCheck: tacticalMinimapDependencies.filter(
      (dependency) => !syntaxChecks.has(dependency),
    ),
    serviceWorkerCore: dependencies.filter((dependency) => !serviceWorkerCore.has(dependency)),
    serviceWorkerClassifier: dependencies.filter(
      (dependency) => !serviceWorkerClassifier.has(dependency),
    ),
  };

  assert.deepEqual(
    gaps,
    {
      pagesRuntimePaths: [],
      committedFileGuard: [],
      tacticalMinimapSyntaxCheck: [],
      serviceWorkerCore: [],
      serviceWorkerClassifier: [],
    },
    [
      "Static local app module release closure is incomplete:",
      `PAGES_RUNTIME_PATHS: ${gaps.pagesRuntimePaths.join(", ")}`,
      `committed file guard: ${gaps.committedFileGuard.join(", ")}`,
      `tactical minimap syntax check: ${gaps.tacticalMinimapSyntaxCheck.join(", ")}`,
      `service-worker CORE_ASSETS: ${gaps.serviceWorkerCore.join(", ")}`,
      `service-worker core classifier: ${gaps.serviceWorkerClassifier.join(", ")}`,
    ].join("\n"),
  );
});

test("index loads the complete React shell synchronously before the legacy app module", async () => {
  const [workflow, index, serviceWorker, reactUi, app] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("index.html"),
    readProjectFile("sw.js"),
    readProjectFile("react-game-ui.js"),
    readProjectFile("app.js"),
  ]);
  const scripts = indexScripts(index);
  const scriptOrder = scripts.map(({ source }) => source);
  const entrypoints = indexLocalRuntimeEntrypoints(index);
  const pagesArtifact = archivePaths(workflow);
  const serviceWorkerCore = coreAssetPaths(serviceWorker);
  const synchronousReactShell = [
    "vendor/react.production.min.js",
    "vendor/react-dom.production.min.js",
    "profile-store.js",
    "react-game-ui.js",
    "react-shop.js",
  ];

  assert.deepEqual(
    scriptOrder.slice(0, synchronousReactShell.length),
    synchronousReactShell,
    "React, the profile store, game shell, and cosmetic shop must execute synchronously in dependency order",
  );
  for (const source of synchronousReactShell) {
    const script = scripts.find((candidate) => candidate.source === source);
    assert.ok(script, `index.html must load ${source}`);
    assert.doesNotMatch(script.attributes, /\b(?:async|defer)\b|\btype=["']module["']/, `${source} must be a synchronous classic script`);
  }
  assert.ok(
    scriptOrder.indexOf("react-game-ui.js") < scriptOrder.indexOf("app.js"),
    "the React shell must mount every legacy DOM surface before app.js queries it",
  );
  assert.match(index, /<div\s+id=["']react-game-root["']><\/div>/, "index.html must expose the React mount root");
  assert.match(reactUi, /ReactDOM\.render\s*\(\s*e\(App\)\s*,\s*container\s*\)/, "react-game-ui.js must render the application shell");

  const queriedIds = appQueriedIds(app);
  const declaredIds = reactLiteralIds(reactUi);
  const missingIds = queriedIds.filter((id) => !declaredIds.has(id));
  assert.ok(queriedIds.length > 0, "app.js must retain DOM query contracts");
  assert.deepEqual(
    missingIds,
    [],
    `react-game-ui.js must declare every literal DOM ID queried by app.js: ${missingIds.join(", ")}`,
  );

  const missingFromArtifact = entrypoints.filter((entrypoint) => !pagesArtifact.has(entrypoint));
  const missingFromServiceWorker = entrypoints.filter((entrypoint) => !serviceWorkerCore.has(entrypoint));
  assert.deepEqual(missingFromArtifact, [], `Index runtime entry points missing from Pages git archive: ${missingFromArtifact.join(", ")}`);
  assert.deepEqual(missingFromServiceWorker, [], `Index runtime entry points missing from service-worker CORE_ASSETS: ${missingFromServiceWorker.join(", ")}`);
});

test("React shell exposes the authoritative ten-stage campaign and seven command actions", async () => {
  const reactUi = await readProjectFile("react-game-ui.js");
  const mapStages = [...reactUi.matchAll(/\{ id: (?<number>\d+), name: ['"](?<id>[\w-]+)['"], file: ['"][^'"]+['"], alt: ['"][^'"]+['"] \}/g)]
    .map((match) => ({ number: Number(match.groups.number), id: match.groups.id }));
  const selectorStages = [...reactUi.matchAll(/\{ num: (?<number>\d+), title: ['"]map\.node\d+Title['"], text: ['"][^'"]+['"] \}/g)]
    .map((match) => Number(match.groups.number));
  const actionKeys = [...reactUi.matchAll(/\{ id: ['"](?<id>[\w-]+)['"], key: ['"](?<key>[1-7])['"], name: ['"]command\.[\w-]+\.name['"]/g)]
    .map((match) => ({ id: match.groups.id, key: match.groups.key }));
  const expectedActions = ["hunt", "extract", "materialize", "capture", "possess", "domain", "assault"];
  const expectedActionKeys = expectedActions.map((id, index) => ({ id, key: String(index + 1) }));

  assert.equal(STAGES.length, 10, "the deterministic campaign must retain ten stages");
  assert.deepEqual(mapStages, STAGES.map(({ number, id }) => ({ number, id })), "the React campaign map must mirror all engine stages in order");
  assert.deepEqual(selectorStages, STAGES.map(({ number }) => number), "the cockpit selector must expose all ten engine stages");
  assert.deepEqual(actionKeys, expectedActionKeys, "the React command deck must map keys 1–7 to the complete ordered seven-action vocabulary");
  assert.match(reactUi, /id:\s*['"]action-['"]\s*\+\s*act\.id[\s\S]*?['"]data-action['"]:\s*act\.id/, "every command record must render a stable action ID and data-action hook");
  for (const stage of STAGES) {
    for (const key of [`map.stage${stage.number}Badge`, `map.node${stage.number}Title`, `map.node${stage.number}Desc`]) {
      assert.ok(translations.ko[key] && translations.en[key], `both locales must own ${key}`);
    }
  }
  for (const action of expectedActions) {
    for (const key of [`command.${action}.name`, `command.${action}.desc`]) {
      assert.ok(translations.ko[key] && translations.en[key], `both locales must own ${key}`);
    }
  }
});

test("every literal React shell localization hook is owned by both language dictionaries", async () => {
  const keys = reactLiteralI18nKeys(await readProjectFile("react-game-ui.js"));

  assert.ok(keys.size > 0, "react-game-ui.js must retain localized shell copy");
  for (const locale of ["ko", "en"]) {
    const missing = [...keys]
      .filter((key) => !Object.prototype.hasOwnProperty.call(translations[locale], key))
      .sort();
    assert.deepEqual(
      missing,
      [],
      `${locale} must own every literal React data-i18n, data-i18n-aria, and data-i18n-alt key: ${missing.join(", ")}`,
    );
  }
});

test("React cinematic fallback localizes fragments without replacing anchor-owning parents", async () => {
  const lobby = sourceFunctionBody(await readProjectFile("react-game-ui.js"), "CampaignLobby");
  const expectedKeys = [
    "lobby.cinematicUnavailable",
    "lobby.cinematicOpenMp4",
    "lobby.cinematicPlaybackUnavailable",
    "lobby.cinematicOpenRepresentativeMp4",
    "lobby.cinematicTranscriptAlternative",
  ];

  assert.match(lobby, /id:\s*['"]campaign-cinematic['"][\s\S]*?e\(['"]span['"],\s*\{\s*['"]data-i18n['"]:\s*['"]lobby\.cinematicUnavailable['"][\s\S]*?e\(['"]a['"],\s*\{[^}]*['"]data-i18n['"]:\s*['"]lobby\.cinematicOpenMp4['"]/, "the React video fallback must retain independently localized text and anchor children");
  assert.match(lobby, /id:\s*['"]cinematic-fallback['"][\s\S]*?lobby\.cinematicPlaybackUnavailable[\s\S]*?lobby\.cinematicOpenRepresentativeMp4[\s\S]*?lobby\.cinematicTranscriptAlternative/, "the playback fallback must retain independently localized text and anchor children");
  for (const key of expectedKeys) {
    for (const locale of ["ko", "en"]) {
      assert.equal(Object.prototype.hasOwnProperty.call(translations[locale], key), true, `${locale} must own cinematic fallback fragment ${key}`);
    }
  }
});

test("localized fullscreen control requests, exits, and synchronizes fullscreen state", async () => {
  const [reactUi, app] = await Promise.all([
    readProjectFile("react-game-ui.js"),
    readProjectFile("app.js"),
  ]);
  const control = reactUi.match(/e\(['"]button['"],\s*\{\s*id:\s*['"]toggle-fullscreen['"],(?<props>[\s\S]*?)\n\s*\},/);
  const retryControl = reactUi.match(/e\(['"]button['"],\s*\{\s*id:\s*['"]retry-stage['"],(?<props>[\s\S]*?)\n\s*\},/);

  assert.ok(control, "react-game-ui.js must expose #toggle-fullscreen as a button");
  assert.match(control.groups.props, /['"]data-i18n['"]:\s*['"]screen\.fullscreenEnter['"]/, "the fullscreen button must start with localized enter copy");
  assert.match(control.groups.props, /['"]aria-pressed['"]:\s*['"]false['"]/, "the fullscreen button must expose its initial inactive state");
  assert.ok(retryControl, "react-game-ui.js must expose #retry-stage as a button");
  assert.match(
    retryControl.groups.props,
    /['"]data-i18n-aria['"]:\s*['"]screen\.retryButton['"]/,
    "the retry control aria-label must follow the active locale instead of retaining its Korean shell copy",
  );
  for (const locale of ["ko", "en"]) {
    for (const key of [
      "screen.fullscreenEnter",
      "screen.fullscreenExit",
      "screen.fullscreenEnterTitle",
      "screen.fullscreenExitTitle",
      "screen.fullscreenEntered",
      "screen.fullscreenExited",
      "screen.fullscreenError",
    ]) {
      assert.ok(translations[locale][key], `${locale} must own localized fullscreen copy for ${key}`);
    }
  }

  const toggleBody = sourceFunctionBody(app, "toggleFullscreen");
  assert.match(
    toggleBody,
    /document\.fullscreenElement[\s\S]*?document\.exitFullscreen\s*\(\s*\)/,
    "toggleFullscreen() must exit when a fullscreen element is active",
  );
  assert.match(
    toggleBody,
    /elements\.screen\.requestFullscreen\s*\(\s*\{\s*navigationUI:\s*["']hide["']\s*\}\s*\)/,
    "toggleFullscreen() must request campaign fullscreen with hidden browser navigation",
  );
  assert.match(
    toggleBody,
    /fullscreenPending\)\s*return[\s\S]*fullscreenPending\s*=\s*true[\s\S]*syncFullscreenControl\s*\(\s*\)/,
    "toggleFullscreen() must reject overlapping transitions and disable the control before invoking the native API",
  );

  const syncBody = sourceFunctionBody(app, "syncFullscreenControl");
  assert.match(syncBody, /document\.fullscreenElement\s*===\s*elements\.screen/, "fullscreen sync must derive state from the campaign screen");
  assert.match(syncBody, /setAttribute\s*\(\s*["']aria-pressed["']\s*,\s*String\(active\)\s*\)/, "fullscreen sync must publish the pressed state");
  assert.match(syncBody, /screen\.fullscreenExit[\s\S]*?screen\.fullscreenEnter/, "fullscreen sync must swap localized enter and exit copy");

  const errorBody = sourceFunctionBody(app, "handleFullscreenError");
  assert.match(
    errorBody,
    /fullscreenPending\s*=\s*false[\s\S]*syncFullscreenControl\s*\(\s*\)[\s\S]*screen\.fullscreenError/,
    "fullscreen failures must release the pending guard, restore the control, and announce the localized error",
  );

  const wireBody = sourceFunctionBody(app, "wireControls");
  assert.match(wireBody, /elements\.toggleFullscreen\?\.addEventListener\s*\(\s*["']click["'][\s\S]*?toggleFullscreen\s*\(\s*\)/, "fullscreen button clicks must invoke toggleFullscreen()");
  assert.match(
    wireBody,
    /document\.addEventListener\s*\(\s*["']fullscreenchange["']\s*,\s*\(\)\s*=>\s*\{[\s\S]*?fullscreenPending\s*=\s*false[\s\S]*?syncFullscreenControl\s*\(\s*\)[\s\S]*?screen\.fullscreenEntered[\s\S]*?screen\.fullscreenExited/,
    "native fullscreen changes must release pending state, synchronize the control, and announce localized entry or exit",
  );
  assert.match(
    wireBody,
    /document\.addEventListener\s*\(\s*["']fullscreenerror["']\s*,\s*handleFullscreenError\s*\)/,
    "native fullscreen errors must use the shared recovery path",
  );
  assert.match(wireBody, /syncFullscreenControl\s*\(\s*\)/, "control wiring must synchronize fullscreen support and initial state");
});

test("returning to the lobby finishes campaign fullscreen exit before hiding the screen", async () => {
  const app = await readProjectFile("app.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const runReturnToLobby = new AsyncFunction(
    "campaign",
    "document",
    "elements",
    "stopBattle",
    "stageBriefingOpen",
    "entryGuidanceStageId",
    "storedCampaign",
    "resultOverlayOpen",
    "setResultModal",
    "setMissionBriefingModal",
    "persistCampaign",
    "syncBackgroundEffects",
    "updateResumeAffordance",
    "window",
    "syncFullscreenControl",
    sourceFunctionBody(app, "returnToLobby"),
  );
  const events = [];
  let campaignScreenHidden = false;
  let finishFullscreenExit;
  const screen = {
    get hidden() {
      return campaignScreenHidden;
    },
    set hidden(value) {
      campaignScreenHidden = value;
      events.push(`screen:hidden:${value}`);
    },
  };
  const lobby = {
    set hidden(value) {
      events.push(`lobby:hidden:${value}`);
    },
  };
  const document = {
    fullscreenElement: screen,
    exitFullscreen() {
      events.push("fullscreen:exit-start");
      return new Promise((resolve) => {
        finishFullscreenExit = () => {
          document.fullscreenElement = null;
          events.push("fullscreen:exit-finished");
          resolve();
        };
      });
    },
  };
  const elements = {
    screen,
    lobby,
    resume: { focus: () => events.push("resume:focus") },
  };

  const returning = runReturnToLobby(
    { status: "active" },
    document,
    elements,
    () => events.push("battle:stopped"),
    true,
    "stage-1",
    null,
    true,
    () => undefined,
    () => undefined,
    async () => undefined,
    () => undefined,
    () => undefined,
    { requestAnimationFrame: (callback) => callback() },
    () => undefined,
  );

  await Promise.resolve();
  assert.equal(
    campaignScreenHidden,
    false,
    "the campaign screen must remain visible while the native fullscreen exit is pending",
  );
  finishFullscreenExit();
  await returning;

  assert.equal(campaignScreenHidden, true, "the campaign screen must hide after fullscreen exits");
  assert.ok(
    events.indexOf("fullscreen:exit-finished") < events.indexOf("screen:hidden:true"),
    `fullscreen exit must finish before the campaign screen hides: ${events.join(" -> ")}`,
  );
});


test("desktop cockpit keeps battlefield, status rail, and command deck as stable React layout surfaces", async () => {
  const [reactUi, styles] = await Promise.all([
    readProjectFile("react-game-ui.js"),
    readProjectFile("styles.css"),
  ]);
  const declaredIds = reactLiteralIds(reactUi);

  for (const id of ["battle-field", "command-panel", "battle-mission-guide", "battle-mission-current", "battle-mission-why"]) {
    assert.equal(declaredIds.has(id), true, `the React cockpit must expose #${id}`);
  }
  for (const className of ["cockpit-main", "field-edge-hud"]) {
    assert.match(reactUi, new RegExp(`className:\\s*['"][^'"]*\\b${className}\\b`), `the React cockpit must expose .${className}`);
  }

  const desktopRules = cssRules(styles.replace(/\/\*[\s\S]*?\*\//g, ""));
  const cockpitRule = desktopRules.find(({ selector }) => selector === ".cockpit-main");
  const battlefieldRule = desktopRules.find(({ selector }) => selector === ".cockpit-main .battle-field-panel");
  const statusRailRule = desktopRules.find(({ selector }) => selector === ".cockpit-rail");
  const commandDeckRule = desktopRules.find(({ selector }) => selector === ".field-command-dock");
  assert.equal(cssDeclaration(cockpitRule, "display"), "grid", "desktop cockpit-main must own the layout grid");
  assert.match(cssDeclaration(cockpitRule, "grid-template-areas") ?? "", /"battle hud"[\s\S]*"commands commands"/, "desktop grid must reserve battlefield, HUD, and command-deck surfaces");
  assert.equal(cssDeclaration(battlefieldRule, "grid-area"), "battle", "battlefield must own the desktop battle area");
  assert.equal(cssDeclaration(statusRailRule, "grid-area"), "hud", "status rail must own the desktop HUD area");
  assert.equal(cssDeclaration(commandDeckRule, "grid-area"), "commands", "command deck must own the desktop commands area");

  for (const key of ["mission.kicker", "mission.loop", "mission.win", "mission.lose"]) {
    assert.match(reactUi, new RegExp(`['"]data-i18n['"]:\\s*['"]${key.replace(".", "\\.")}['"]`), `mission guide must expose ${key}`);
    assert.match(translations.ko[key], /\p{Script=Hangul}/u, `${key} must provide Korean mission guidance`);
    assert.match(translations.en[key], /[A-Za-z]/, `${key} must remain available after the English toggle`);
  }
});


test("React battle resource rows own their semantic meter updates and progress fills", async () => {
  const [reactUi, app, styles] = await Promise.all([
    readProjectFile("react-game-ui.js"),
    readProjectFile("app.js"),
    readProjectFile("styles.css"),
  ]);
  const expectedMeters = [
    ["souls", "souls-value"],
    ["legion", "legion-value"],
    ["nodes", "nodes-value"],
    ["integrity", "integrity-value"],
    ["boss", "boss-value"],
  ];

  for (const [resource, valueId] of expectedMeters) {
    assert.match(
      reactUi,
      new RegExp(`['"]data-resource['"]:\\s*['"]${resource}['"][\\s\\S]{0,320}?id:\\s*['"]${valueId}['"]`),
      `${resource} must retain a dedicated React resource row owning #${valueId}`,
    );
  }

  const meterBody = sourceFunctionBody(app, "setResourceMeter");
  assert.match(meterBody, /element\?\.closest\s*\(\s*["']\[data-resource\]["']\s*\)/, "meter updates must resolve the semantic resource-row owner");
  assert.match(meterBody, /meter\.style\.setProperty\s*\(\s*["']--resource-progress["']/, "meter updates must publish progress on the owning row");

  const rules = cssRules(styles.replace(/\/\*[\s\S]*?\*\//g, ""));
  const meterRule = rules.find(({ selector }) => selector === ".battle-resource-bar > div");
  const fillRule = rules.find(({ selector }) => selector === ".battle-resource-bar > div::after");
  assert.equal(cssDeclaration(meterRule, "--resource-progress"), "0%", "resource rows must default progress safely");
  assert.equal(cssDeclaration(fillRule, "width"), "var(--resource-progress)", "resource fills must consume their owner's progress");
});


test("the 360px lobby uses a shrinkable column and bounds its cinematic surface", async () => {
  const lobbyRules = cssRules(cssBlock(await readProjectFile("styles.css"), "@media (max-width: 62rem)"));
  const lobbyGridRule = lobbyRules.find(({ selector }) => selector === ".lobby-panel");
  const boundedSurfaceRule = lobbyRules.find(({ selector }) => {
    const selectors = selector.split(",").map((entry) => entry.trim());
    return [
      ".lobby-panel > *",
      ".lobby-panel > .cinematic-control",
      "#campaign-cinematic",
    ].every((expected) => selectors.includes(expected));
  });
  const cinematicControlRule = lobbyRules.find(
    ({ selector }) => selector === ".lobby-panel > .cinematic-control",
  );

  assert.equal(
    cssDeclaration(lobbyGridRule, "grid-template-columns"),
    "minmax(0, 1fr)",
    "the single lobby column must be allowed to shrink to a 360px viewport without intrinsic overflow",
  );
  assert.ok(boundedSurfaceRule, "the compact lobby must retain a shared cinematic width bound");
  assert.equal(
    cssDeclaration(boundedSurfaceRule, "min-width"),
    "0",
    "lobby children must be allowed to shrink below their intrinsic content width",
  );
  assert.equal(
    cssDeclaration(boundedSurfaceRule, "max-width"),
    "100%",
    "cinematic content must not grow wider than the compact lobby",
  );
  assert.equal(
    cssDeclaration(cinematicControlRule, "width"),
    "100%",
    "the cinematic control must consume only the available compact-column width",
  );
});
test("mobile active play keeps command targets touch-safe and hides secondary cockpit details", async () => {
  const [styles, reactStyles] = await Promise.all([
    readProjectFile("styles.css"),
    readProjectFile("react-game-ui.css"),
  ]);
  const mobileRules = cssRules(cssBlock(styles, "@media (max-width: 899px)"));
  const reactMobileRules = cssRules(cssBlock(reactStyles, "@media (max-width: 899px)"));
  const commandTargetRule = mobileRules.find(({ selector }) => selector.includes(".field-command-dock .command-grid button"));
  const activePlayRules = mobileRules.filter(({ selector }) => selector.includes("#stage-briefing[hidden]"));
  const cockpitDetailsRule = activePlayRules.find(({ selector }) => selector.includes(".cockpit-details"));
  const cockpitMainRule = reactMobileRules.find(({ selector }) => selector === ".cockpit-main");

  assert.ok(cockpitMainRule, "the <=899px cockpit must retain an explicit main-layout rule");
  assert.equal(
    cssDeclaration(cockpitMainRule, "flex")?.replace(/\s*!important$/, ""),
    "0 0 auto",
    "the mobile cockpit must keep its intrinsic height instead of shrinking commands beneath the save dock",
  );
  assert.equal(
    cssDeclaration(cockpitMainRule, "overflow")?.replace(/\s*!important$/, ""),
    "visible",
    "the intrinsic mobile cockpit flow must expose commands before the following save dock",
  );
  assert.ok(commandTargetRule, "the <=899px cockpit must retain a command-button target rule");
  assert.ok(
    absoluteCssPixels(cssDeclaration(commandTargetRule, "min-height")) >= 44,
    "mobile command targets must remain at least 44px tall",
  );
  assert.equal(
    activePlayRules.some(({ selector }) => selector.includes(".save-dock") || selector.includes("#save-dock")),
    false,
    "the <=899px active-play selector must not hide the save dock after the briefing closes",
  );
  assert.ok(cockpitDetailsRule, "the <=899px active-play selector must retain secondary cockpit-details hiding");
  assert.equal(
    cssDeclaration(cockpitDetailsRule, "display"),
    "none !important",
    "secondary cockpit details must remain hidden while compact active play owns the viewport",
  );
});

test("360px essential HUD copy stays at least 12.5px and utility and save targets stay 44px tall", async () => {
  const [styles, reactStyles] = await Promise.all([
    readProjectFile("styles.css"),
    readProjectFile("react-game-ui.css"),
  ]);
  const mobileRules = cssRules(cssBlock(styles, "@media (max-width: 899px)"));
  const readableRules = cssRules(cssBlock(reactStyles, "@media (max-width: 899px)"));
  const narrowRules = cssRules(cssBlock(styles, "@media (max-width: 640px)"));
  const ruleFor = (rules, expectedSelector) => rules.find(({ selector }) => (
    selector.split(",").map((entry) => entry.trim()).includes(expectedSelector)
  ));
  const essentialLabels = [
    ".cockpit-top .wave-badge",
    ".battle-resource-bar dt",
    ".battle-mission-guide strong",
    ".selection-dossier span",
    ".selection-dossier small",
    ".field-command-dock .status-message",
    ".field-command-dock .key",
    ".field-command-dock .command-grid strong",
    ".field-current-objective",
    ".field-edge-hud .battle-pressure",
  ];
  const readableMinimum = 12.5;

  for (const selector of essentialLabels) {
    const rule = ruleFor(readableRules, selector);
    assert.ok(rule, `the mobile HUD must retain an explicit essential-label rule for ${selector}`);
    assert.ok(
      absoluteCssPixels(cssDeclaration(rule, "font-size")) >= readableMinimum,
      `${selector} must remain at least 12.5px on a 360px viewport`,
    );
  }

  const touchTargets = [
    [mobileRules, ".site-header button"],
    [mobileRules, ".cockpit-top .campaign-heading-actions button"],
    [mobileRules, ".cockpit .save-dock button"],
    [mobileRules, ".cockpit .save-dock .file-button"],
    [narrowRules, ".result-panel .button-row button"],
  ];
  for (const [rules, selector] of touchTargets) {
    const rule = ruleFor(rules, selector);
    assert.ok(rule, `mobile utility controls must retain a minimum target size for ${selector}`);
    assert.ok(
      absoluteCssPixels(cssDeclaration(rule, "min-height")) >= 44,
      `${selector} must remain at least 44px tall on a 360px viewport`,
    );
  }
});

test("premium React CSS preserves themes, responsive bounds, touch targets, dialogs, and reduced motion", async () => {
  const styles = await readProjectFile("react-game-ui.css");
  const allRules = cssRules(styles.replace(/\/\*[\s\S]*?\*\//g, ""));
  const baseControls = allRules.find(({ selector }) => selector.split(",").map((part) => part.trim()).includes("button"));

  for (const theme of ["iron", "cinder", "veil", "sovereign"]) {
    const themeRule = allRules.find(({ selector }) => selector === `html[data-ui-theme="${theme}"]`);
    assert.ok(themeRule, `premium CSS must define the ${theme} profile theme`);
    for (const token of ["--bg", "--panel", "--ink", "--cinder", "--focus"]) {
      assert.ok(cssDeclaration(themeRule, token), `${theme} must provide ${token}`);
    }
  }
  assert.ok(absoluteCssPixels(cssDeclaration(baseControls, "min-height")) >= 44, "default controls must remain at least 44px tall");
  const headerControls = allRules.find(({ selector }) => selector === ".site-header.medieval-header .ghost-toggle");
  const shopControls = allRules.find(({ selector }) => selector === ".relic-shop-btn");
  assert.ok(absoluteCssPixels(cssDeclaration(headerControls, "min-height")) >= 44, "desktop header controls must not override the 44px target minimum");
  assert.ok(absoluteCssPixels(cssDeclaration(shopControls, "min-height")) >= 44, "desktop shop controls must not override the 44px target minimum");

  const desktopRules = cssRules(cssBlock(styles, "@media (min-width: 1400px)"));
  const desktopViewport = desktopRules.find(({ selector }) => selector === "html, body");
  const desktopRoot = desktopRules.find(({ selector }) => selector === "main#game-root");
  assert.equal(cssDeclaration(desktopViewport, "overflow"), "hidden", "1440px desktop must stay inside the viewport");
  assert.equal(cssDeclaration(desktopRoot, "max-width"), "1440px", "desktop game content must remain bounded");
  assert.equal(cssDeclaration(desktopRoot, "min-height"), "0", "desktop flex content must be allowed to shrink without overflow");

  const mobileRules = cssRules(cssBlock(styles, "@media (max-width: 720px)"));
  const mobileViewport = mobileRules.find(({ selector }) => selector === "html, body");
  const mobileRoot = mobileRules.find(({ selector }) => selector === "main#game-root");
  const dialogs = mobileRules.find(({ selector }) => selector === ".mission-briefing, .result-overlay");
  const dialogPanels = mobileRules.find(({ selector }) => selector === ".mission-briefing-panel, .result-panel");
  const mobileControls = mobileRules.find(({ selector }) => selector.includes(".relic-shop-btn") && selector.includes(".result-panel button"));
  assert.equal(cssDeclaration(mobileViewport, "overflow-x"), "hidden !important", "360px layout must prevent document overflow");
  assert.equal(cssDeclaration(mobileViewport, "max-width"), "100vw !important", "360px document must stay viewport-bounded");
  assert.equal(cssDeclaration(mobileRoot, "overflow-x"), "hidden !important", "the mobile game root must prevent horizontal overflow");
  assert.equal(cssDeclaration(dialogs, "position"), "fixed !important", "mobile briefing and result dialogs must remain viewport-fixed");
  assert.equal(cssDeclaration(dialogs, "inset"), "0 !important", "mobile dialogs must fill the viewport");
  assert.equal(cssDeclaration(dialogPanels, "overflow-y"), "auto !important", "mobile dialog content must scroll internally");
  assert.ok(absoluteCssPixels(cssDeclaration(mobileControls, "min-height")) >= 44, "mobile controls must remain at least 44px tall");

  const reducedRules = cssRules(cssBlock(styles, "@media (prefers-reduced-motion: reduce)"));
  const reducedAll = reducedRules.find(({ selector }) => selector === "*, ::before, ::after");
  const liquidEther = reducedRules.find(({ selector }) => selector === ".liquid-ether-container");
  const particles = reducedRules.find(({ selector }) => selector === "#particles-canvas");
  assert.equal(cssDeclaration(reducedAll, "transition-duration"), "0s !important", "reduced motion must disable transitions");
  assert.equal(cssDeclaration(reducedAll, "animation-iteration-count"), "1 !important", "reduced motion must stop looping animations");
  assert.equal(cssDeclaration(liquidEther, "display"), "none !important", "reduced motion must disable the liquid background");
  assert.equal(cssDeclaration(particles, "display"), "none !important", "reduced motion must disable background particles");
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
    /const checklist\s*=\s*getStageChecklist\s*\(\s*campaign\s*\);[\s\S]*?renderChecklist\s*\(\s*checklist\s*\);/,
    "campaign rendering must pass the engine-produced stage checklist to renderChecklist",
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
test("React cinematic captions and transcript release surfaces are explicitly published", async () => {
  const [workflow, reactUi] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("react-game-ui.js"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const lobby = sourceFunctionBody(reactUi, "CampaignLobby");
  const captions = lobby.match(
    /e\(['"]track['"],\s*\{(?<props>[\s\S]*?)\}\)/,
  );
  assert.ok(captions, "the React campaign cinematic must declare a captions track");
  assert.match(captions.groups.props, /\bkind:\s*['"]captions['"]/, "the cinematic track must be captions");
  assert.match(captions.groups.props, /\bsrcLang:\s*['"]ko['"]/, "the cinematic track must identify Korean captions");
  assert.match(captions.groups.props, /\blabel:\s*['"]한국어 자막['"]/, "the cinematic track must expose its Korean label");
  assert.match(captions.groups.props, /\bdefault:\s*true/, "Korean captions must be the default track");
  const captionsPath = captions.groups.props.match(/\bsrc:\s*['"](?<source>assets\/video\/[^'"]+\.vtt)['"]/)?.groups?.source;
  assert.equal(captionsPath, "assets/video/abyssal-surge-cinematic.ko.vtt", "the cinematic must reference its committed Korean captions");

  const transcriptToggle = lobby.match(/e\(['"]button['"],\s*\{\s*id:\s*['"]toggle-cinematic-transcript['"],(?<props>[\s\S]*?)\n\s*\},/);
  assert.ok(transcriptToggle, "the React lobby must provide a cinematic transcript toggle");
  assert.match(transcriptToggle.groups.props, /['"]aria-controls['"]:\s*['"]cinematic-transcript['"]/, "the transcript toggle must control the transcript");
  assert.match(transcriptToggle.groups.props, /['"]aria-expanded['"]:\s*['"]false['"]/, "the transcript toggle must begin collapsed");

  const transcript = lobby.match(/e\(['"]section['"],\s*\{\s*id:\s*['"]cinematic-transcript['"],(?<props>[\s\S]*?)\n\s*\},/);
  assert.ok(transcript, "the React lobby must include an accessible cinematic transcript");
  assert.match(transcript.groups.props, /\bhidden:\s*true/, "the transcript must begin hidden");
  assert.match(transcript.groups.props, /['"]aria-labelledby['"]:\s*['"]cinematic-transcript-heading['"]/, "the transcript must reference its heading");
  assert.match(lobby, /e\(['"]h3['"],\s*\{\s*id:\s*['"]cinematic-transcript-heading['"]/, "the transcript must render its referenced heading");

  await readProjectFile(captionsPath);
  assert.equal(pagesArtifact.has(`./${captionsPath}`), true, `Cinematic captions must be individually allowlisted by Pages: ${captionsPath}`);
  assert.equal(pagesArtifact.has("./react-game-ui.js"), true, "Pages artifact must include the React transcript document owner");
});
test("Pages artifact explicitly allowlists the complete runtime GLB surface", async () => {
  const [workflow, battleRuntime] = await Promise.all([
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("battle-realtime-three.js"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const runtimeGlbs = runtimeGlbUrls(battleRuntime);
  const publishedModels = [...pagesArtifact].filter((path) => path.startsWith("./assets/models/")).sort();

  assert.ok(runtimeGlbs.length > 0, "runtime battle resources must include declared GLB URLs");
  assert.deepEqual(
    runtimeGlbs.filter((path) => path.includes("/props/")),
    [
      "./assets/models/abyssal-command/props/command-obelisk.glb",
      "./assets/models/abyssal-command/props/rift-portal.glb",
      "./assets/models/abyssal-command/props/soul-extractor.glb",
    ],
    "runtime GLB surface must retain all three battle prop models",
  );
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
    "Pages artifact must individually allowlist exactly the complete runtime GLB set",
  );
});

test("Canvas fallback stage 4–10 terrain and boss art agree with declared stage resources", async () => {
  const [battleRuntime, battleVisualizer, app] = await Promise.all([
    readProjectFile("battle-realtime-three.js"),
    readProjectFile("battle-visualizer.js"),
    readProjectFile("app.js"),
  ]);
  const stageAssets = battleRuntime.match(/const STAGE_ASSETS = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  const bridgeTerrain = battleVisualizer.match(/const BRIDGE_STAGE_TERRAIN = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  const bossArt = battleVisualizer.match(/const BOSS_ART = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);
  const campaignBossArt = app.match(/const BOSS_BY_STAGE = Object\.freeze\(\{(?<entries>[\s\S]*?)\}\);/);

  assert.ok(stageAssets, "RealtimeBattle must declare per-stage terrain and boss resources.");
  assert.ok(bridgeTerrain, "Canvas fallback must declare per-stage bridge terrain.");
  assert.ok(bossArt, "Canvas fallback must declare per-stage boss art.");
  assert.ok(campaignBossArt, "Campaign presentation must declare boss art by stage.");

  const realtimeResources = new Map(
    [...stageAssets.groups.entries.matchAll(/^\s*(?<stage>\d+): Object\.freeze\(\{ terrain: "(?<terrain>[^"]+)", boss: "(?<boss>[^"]+)" \}\),?$/gm)]
      .map((match) => [Number(match.groups.stage), match.groups]),
  );
  const canvasTerrain = new Map(
    [...bridgeTerrain.groups.entries.matchAll(/(?<stage>\d+): "(?<terrain>[^"]+)"/g)]
      .map((match) => [Number(match.groups.stage), match.groups.terrain]),
  );
  const canvasBossArt = new Map(
    [...bossArt.groups.entries.matchAll(/(?<stage>\d+): "(?<path>assets\/images\/ui\/boss-[^"]+\.png)"/g)]
      .map((match) => [Number(match.groups.stage), match.groups.path]),
  );
  const campaignBossByStage = new Map(
    [...campaignBossArt.groups.entries.matchAll(/^\s*"(?<id>[^"]+)": "(?<path>assets\/images\/ui\/boss-[^"]+\.png)",?$/gm)]
      .map((match) => [match.groups.id, match.groups.path]),
  );

  for (const stage of STAGES.filter(({ number }) => number >= 4 && number <= 10)) {
    const resources = realtimeResources.get(stage.number);
    assert.ok(resources, `RealtimeBattle must retain declared resources for Stage ${stage.number}.`);
    assert.equal(
      canvasTerrain.get(stage.number),
      resources.terrain.replace(/^terrain\//, "").replace(/\.glb$/, ""),
      `Canvas fallback terrain for Stage ${stage.number} must match the RealtimeBattle terrain resource.`,
    );
    assert.equal(
      canvasBossArt.get(stage.number),
      campaignBossByStage.get(stage.id),
      `Canvas fallback boss art for Stage ${stage.number} must match its campaign boss resource.`,
    );
  }
});

test("service worker bypasses HTTP cache on every core asset fetch path", async () => {
  const serviceWorker = await readProjectFile("sw.js");

  assert.match(
    serviceWorker,
    /CORE_ASSETS\.map\(async \(asset\) => \{\s*const response = await fetch\(asset, \{ cache: "no-store" \}\);/s,
    "install-time precaching must fetch every core asset with cache: no-store.",
  );
  assert.match(
    serviceWorker,
    /if \(isCoreRequest\(request\)\) \{\s*event\.respondWith\(\s*fetch\(request, \{ cache: "no-store" \}\)/s,
    "runtime core requests must fetch with cache: no-store before falling back to the worker cache.",
  );
});

test("GLB bridge pre-cache refreshes every bridge asset instead of reusing stale atlas responses", async () => {
  const serviceWorker = await readProjectFile("sw.js");
  const bridgeCacheFunction = serviceWorker.match(
    /async function cacheGlbBattleBridge\(cache\) \{(?<body>[\s\S]*?)\n\}/,
  );

  assert.ok(bridgeCacheFunction, "sw.js must retain the GLB bridge pre-cache helper.");
  assert.doesNotMatch(
    bridgeCacheFunction.groups.body,
    /cache\.add\(/,
    "GLB bridge assets must not be precached through cache.add, which can reuse stale browser HTTP cache entries.",
  );
  assert.match(
    bridgeCacheFunction.groups.body,
    /Promise\.all\(bridgeAssets\.map\(async \(url\) => \{\s*const assetResponse = await fetch\(url, \{ cache: "no-store" \}\);\s*if \(!assetResponse\.ok\) \{\s*throw new Error\([^)]*\);\s*\}\s*await cache\.put\(url, assetResponse\);/s,
    "every GLB bridge asset must bypass HTTP cache, reject a failed fetch, and write the fresh response to the worker cache.",
  );
});

test("literal runtime media URLs are shipped by Pages and covered by the offline asset policy", async () => {
  const [app, index, workflow, serviceWorker, battleRuntime, battleVisualizer] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile("index.html"),
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
    readProjectFile("battle-realtime-three.js"),
    readProjectFile("battle-visualizer.js"),
  ]);
  const pagesArtifact = archivePaths(workflow);
  const serviceWorkerAssets = new Set([
    ...coreAssetPaths(serviceWorker),
    ...optionalMediaPaths(serviceWorker),
  ]);
  const sourceGlbs = new Set(runtimeGlbUrls(battleRuntime));
  const lazySourceBattlePaths = serviceWorker.match(
    /const LAZY_SOURCE_BATTLE_PATHS = Object\.freeze\(\[(?<paths>[\s\S]*?)\]\);/,
  );
  assert.ok(lazySourceBattlePaths, "service worker must declare LAZY_SOURCE_BATTLE_PATHS");
  const offlineGlbs = [...lazySourceBattlePaths.groups.paths.matchAll(/["'](?<path>\/assets\/models\/[^"']+\.glb)["']/g)]
    .map((match) => `.${match.groups.path}`)
    .sort();
  const bridgeManifestPath = glbBridgeManifestPath(serviceWorker, battleVisualizer);
  const bridgeRoot = bridgeManifestPath.replace(/\/manifest\.json$/, "");
  const bridgeOutputs = bridgeOutputPaths(
    JSON.parse(await readProjectFile(bridgeManifestPath.slice(2))),
    bridgeRoot,
  );
  const bridgeRoutes = new Set([bridgeManifestPath, ...bridgeOutputs]);
  const runtimeMedia = runtimeMediaPaths(app, index);
  const missingPagesPaths = runtimeMedia.filter(
    (path) =>
      !pagesArtifact.has(path) &&
      !(bridgeRoutes.has(path) && pagesArtifact.has(bridgeRoot)),
  );
  const unsupportedOfflinePaths = runtimeMedia.filter(
    (path) =>
      !serviceWorkerAssets.has(path) &&
      !sourceGlbs.has(path) &&
      !bridgeRoutes.has(path),
  );

  assert.ok(runtimeMedia.length > 0, "app.js and index.html must declare literal runtime media URLs");
  assert.deepEqual(
    offlineGlbs,
    [...sourceGlbs],
    "service-worker lazy GLB policy must exactly cover the complete runtime GLB set",
  );
  assert.equal(
    pagesArtifact.has(bridgeRoot),
    true,
    "Pages must publish the validated GLB bridge route when runtime media references it",
  );
  assert.deepEqual(
    missingPagesPaths,
    [],
    `literal runtime media URLs must be shipped by Pages: ${missingPagesPaths.join(", ")}`,
  );
  assert.deepEqual(
    unsupportedOfflinePaths,
    [],
    `literal runtime media URLs must be covered by service-worker, GLB source, or bridge policy: ${unsupportedOfflinePaths.join(", ")}`,
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
      holdMs: 2085,
    },
    "veil-citadel": {
      lines: ["장막 성채, 베일 시타델.", "빙의의 힘이 깨어난다.", "두 거점을 동시에 장악하라."],
      msPerChar: 45,
      holdMs: 2014,
    },
    "echo-throne": {
      lines: ["메아리 왕좌.", "군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."],
      msPerChar: 45,
      holdMs: 2000,
    },
    victory: {
      lines: ["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다."],
      msPerChar: 45,
      holdMs: 1452,
    },
    defeat: {
      lines: ["군단의 닻이 끊어졌다.", "다시, 일어나라."],
      msPerChar: 45,
      holdMs: 1473,
    },
  });
});

test("runtime narration presentation duration exceeds measured audio duration by a safety margin", async () => {
  const app = await readProjectFile("app.js");
  const narration = runtimeNarrationEntries(app);
  const audioCatalog = runtimeNarrationAudioCatalog(app);
  const audioIds = Object.keys(audioCatalog);

  assert.ok(audioIds.length > 0, "app.js must declare at least one NARRATION audio path to measure");

  const measurements = await Promise.all(
    audioIds.map(async (id) => {
      const audioPath = audioCatalog[id];
      const durationMs = await ffprobeAudioDurationMs(audioPath);
      const entry = narration[id];
      assert.ok(entry, `app.js must declare a runtime narration entry for ${id}`);
      const codeUnitCount = entry.lines.reduce((total, line) => total + line.length, 0);
      const presentationMs = codeUnitCount * entry.msPerChar + entry.lines.length * entry.holdMs;
      return { id, audioPath, durationMs, presentationMs };
    }),
  );

  for (const { id, audioPath, durationMs, presentationMs } of measurements) {
    assert.ok(
      presentationMs >= durationMs + 50,
      `runtime narration timing budget for ${id} (${audioPath}) must exceed measured audio duration by at least 50ms: ` +
        `presentation=${presentationMs}ms, audio=${durationMs.toFixed(3)}ms, margin=${(presentationMs - durationMs).toFixed(3)}ms`,
    );
  }
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

test("English narration covers every campaign state and language refresh updates visible and SR copy without replaying audio", async () => {
  const app = await readProjectFile("app.js");
  const narrationStart = app.indexOf("const NARRATION =");
  const stageArtStart = app.indexOf("// Stage art:", narrationStart);
  assert.ok(narrationStart >= 0 && stageArtStart > narrationStart, "app.js must expose the complete narration catalogs");
  const narrationDeclarations = app.slice(narrationStart, stageArtStart);
  const languageHandler = app.match(
    /window\.addEventListener\("abyssal:language-changed", \(\) => \{(?<body>[\s\S]*?)\n  \}\);/,
  );
  assert.ok(languageHandler, "the app must subscribe its narration refresh to the public language-change event");

  const elements = {
    narrationLine: {
      textContent: "이전 줄",
      classList: { remove() {} },
    },
    briefingNarration: { textContent: "이전 브리핑" },
    narrationSr: { textContent: "이전 스크린 리더 줄" },
  };
  const language = { value: "ko" };
  const audio = {
    currentTime: 17,
    src: "assets/audio/narr-stage1.mp3",
    playCalls: 0,
    pauseCalls: 0,
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
    },
  };
  const context = vm.createContext({
    audio,
    campaign: null,
    currentLang: () => language.value,
    elements,
    refreshSaveStatus() {},
    render() {},
    syncAmbienceButtonText() {},
    syncCinematicCopy() {},
    updateResumeAffordance() {},
    updateActionFocus() {},
    syncFullscreenControl() {},
  });
  vm.runInContext(`
    ${narrationDeclarations}
    let activeNarrationKey = "intro";
    let narrationRun = 4;
    let narrationPlayer = audio;
    function getNarrationLines(key) {${sourceFunctionBody(app, "getNarrationLines")}}
    function setTypedNarrationLine(line) {${sourceFunctionBody(app, "setTypedNarrationLine")}}
    function refreshNarrationLanguage() {${sourceFunctionBody(app, "refreshNarrationLanguage")}}
    function handleLanguageChange() {${languageHandler.groups.body}}
    globalThis.narrationContract = {
      korean: NARRATION,
      english: NARRATION_EN,
      refresh(key) {
        activeNarrationKey = key;
        handleLanguageChange();
        return { run: narrationRun };
      }
    };
  `, context, { filename: "app.js" });

  const requiredKeys = ["intro", ...STAGES.map((stage) => stage.id), "victory", "defeat"];
  assert.deepEqual(
    Object.keys(context.narrationContract.english).sort(),
    [...requiredKeys].sort(),
    "English narration must cover intro, all ten campaign stages, victory, and defeat",
  );
  for (const key of requiredKeys) {
    const koreanLines = Array.from(context.narrationContract.korean[key]?.lines ?? []);
    const englishLines = Array.from(context.narrationContract.english[key] ?? []);
    assert.ok(koreanLines.length > 0, `${key} must retain source narration`);
    assert.ok(englishLines.length > 0, `${key} must provide English narration`);
    assert.ok(englishLines.every((line) => /[A-Za-z]/.test(line)), `${key} English narration must contain readable spoken copy`);
  }

  language.value = "en";
  const activeKey = STAGES.at(-1).id;
  const expectedLines = Array.from(context.narrationContract.english[activeKey]);
  const audioBefore = {
    currentTime: audio.currentTime,
    src: audio.src,
    playCalls: audio.playCalls,
    pauseCalls: audio.pauseCalls,
  };
  const refreshed = context.narrationContract.refresh(activeKey);

  assert.equal(elements.narrationLine.textContent, expectedLines.at(-1), "language change must refresh displayed narration immediately");
  assert.equal(elements.briefingNarration.textContent, expectedLines.at(-1), "language change must refresh briefing narration immediately");
  assert.equal(elements.narrationSr.textContent, expectedLines.join(" "), "language change must refresh the complete screen-reader narration");
  assert.equal(refreshed.run, 5, "language refresh must cancel the superseded typing run");
  assert.deepEqual(
    {
      currentTime: audio.currentTime,
      src: audio.src,
      playCalls: audio.playCalls,
      pauseCalls: audio.pauseCalls,
    },
    audioBefore,
    "language refresh must not restart, seek, pause, or replace narration audio",
  );
});

test("a stale mirrored save cannot overwrite newer campaign state and rechecks mirror stamp currentness", async () => {
  const app = await readProjectFile("app.js");
  const declaration = /async function applyMirroredCampaign\s*\((?<parameters>[^)]*)\)/.exec(app);
  assert.ok(declaration, "app.js must declare applyMirroredCampaign()");

  const incomingStamp = Object.freeze({ originId: "tab-remote-aaaaaaaa", revision: 7 });
  const newerStamp = Object.freeze({ originId: "tab-local-bbbbbbbbb", revision: 8 });
  const staleCampaign = Object.freeze({ id: "stale-mirror" });
  const newerEnvelope = Object.freeze({ tag: "newer-local" });
  const newerCampaign = Object.freeze({ id: "newer-local", envelope: newerEnvelope });
  const staleEnvelope = Object.freeze({ tag: "stale-mirror", campaign: staleCampaign });
  const persistence = {
    current: Object.freeze({ tag: "initial-local" }),
    saves: [],
    stampChecks: 0,
    stopCalls: 0,
    renderCalls: 0,
    mirroredStatuses: 0,
  };
  let releaseStaleSave;
  let markStaleSaveStarted;
  const staleSaveGate = new Promise((resolve) => {
    releaseStaleSave = resolve;
  });
  const staleSaveStarted = new Promise((resolve) => {
    markStaleSaveStarted = resolve;
  });
  const storage = {
    async save(envelope) {
      persistence.saves.push(envelope.tag);
      if (envelope === staleEnvelope) {
        markStaleSaveStarted();
        await staleSaveGate;
      }
      persistence.current = envelope;
      return "IndexedDB";
    },
  };
  const context = vm.createContext({
    createSaveEnvelope: (campaign) => campaign.envelope,
    isCurrentMirrorStamp(left, right) {
      persistence.stampChecks += 1;
      return left?.originId === right?.originId && left?.revision === right?.revision;
    },
    persistence,
    restoreSaveEnvelope: (envelope) => envelope.campaign,
    setSaveStatus() {
      persistence.mirroredStatuses += 1;
    },
    stopBattle() {
      persistence.stopCalls += 1;
    },
    storage,
    translate: (key) => key,
    updateResumeAffordance() {},
    render() {
      persistence.renderCalls += 1;
    },
  });
  vm.runInContext(`
    let campaign = { id: "initial-local", envelope: persistence.current };
    let storedCampaign = campaign;
    let narratedStageId = "initial-stage";
    let narratedOutcome = "initial-outcome";
    let currentMirrorStamp = ${JSON.stringify(incomingStamp)};
    const campaignMirror = {
      get latestStamp() {
        persistence.stampChecks += 1;
        return currentMirrorStamp;
      },
      authorize(stamp) {
        persistence.stampChecks += 1;
        return stamp?.originId === currentMirrorStamp.originId && stamp?.revision === currentMirrorStamp.revision;
      }
    };
    async function applyMirroredCampaign(${declaration.groups.parameters}) {
      ${sourceFunctionBody(app, "applyMirroredCampaign")}
    }
    globalThis.mirrorContract = {
      apply: (envelope, stamp) => applyMirroredCampaign(envelope, stamp),
      installNewer(campaignValue, envelope, stamp) {
        campaign = campaignValue;
        storedCampaign = campaignValue;
        campaign.envelope = envelope;
        currentMirrorStamp = stamp;
        persistence.current = envelope;
      },
      snapshot() {
        return { campaignId: campaign.id, storedCampaignId: storedCampaign.id };
      }
    };
  `, context, { filename: "app.js" });

  const applyingStaleMirror = context.mirrorContract.apply(staleEnvelope, incomingStamp);
  await staleSaveStarted;
  context.mirrorContract.installNewer({ ...newerCampaign }, newerEnvelope, newerStamp);
  releaseStaleSave();
  await applyingStaleMirror;

  assert.deepEqual(
    { ...context.mirrorContract.snapshot() },
    { campaignId: "newer-local", storedCampaignId: "newer-local" },
    "a mirror apply that becomes stale while saving must not replace newer live or resumable state",
  );
  assert.equal(persistence.current, newerEnvelope, "stale mirrored persistence must restore or preserve the newer local envelope");
  assert.match(
    sourceFunctionBody(app, "applyMirroredCampaign"),
    /await\s+storage\.save\(envelope\)[\s\S]*campaignMirror\?\.authorize\(metadata\)/,
    "the async mirror apply must reauthorize the incoming stamp after persistence yields",
  );
  assert.equal(persistence.stopCalls, 0, "a stale mirror must not stop the newer active battle");
  assert.equal(persistence.renderCalls, 0, "a stale mirror must not rerender over the newer campaign");
  assert.equal(persistence.mirroredStatuses, 0, "a stale mirror must not announce that it was applied");
});
