import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";

const execFileAsync = promisify(execFile);
const ROOT = new URL("../", import.meta.url);
const RULES_VERSION = "defense-survivor-v1";
const GAMEPLAY_VIDEO = "assets/video/abyssal-surge-defense-survivor-smoke.mp4";
const CINDER_SPAN_WORLD_ASSETS = [
  "assets/images/battle/world/cinder-span-topdown-plate.webp",
  "assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
];
const RUNTIME_PATHS = new Set([
  "index.html", "app.js", "rpg-catalog.js", "defense-viewport.js", "defense-catalog.js", "defense-run-simulation.js",
  "campaign-state.js", "defense-storage.js", "defense-cutscene.js", "defense-telemetry.js", "defense-audio.js",
  "battle-canvas-text.js", "battle-realtime-three.js", "battle-visualizer.js", "styles.css", "react-game-ui.css", "sw.js", "manifest.json", "icon.svg", "privacy.html",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  "vendor/three.module.min.js", "vendor/three.core.min.js", "vendor/loaders/GLTFLoader.js", "vendor/utils/SkeletonUtils.js", "vendor/utils/BufferGeometryUtils.js",
  "assets/models/abyssal-command/abyssal-command-resource-pack.glb",
  GAMEPLAY_VIDEO,
  "assets/images/battle/dusk-warden-frame-00.png", "assets/images/battle/dusk-warden-frame-01.png",
  "assets/images/battle/dusk-warden-frame-02.png", "assets/images/battle/dusk-warden-frame-03.png",
  "assets/images/battle/echo-rusher-frame-00.png", "assets/images/battle/echo-rusher-frame-01.png",
  "assets/images/battle/echo-rusher-frame-02.png", "assets/images/battle/echo-rusher-frame-03.png",
  ...CINDER_SPAN_WORLD_ASSETS,
]);

async function project(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

function job(workflow, name) {
  const jobs = "resolve_revision|engine_contract|release_closure|browser_contract|package_pages|artifact_smoke|deploy_pages|deployed_smoke|release_receipt";
  const match = workflow.match(new RegExp(`^  ${name}:\\n(?<body>[\\s\\S]*?)(?=^  (?:${jobs}):|(?![\\s\\S]))`, "m"));
  assert.ok(match, `workflow must define ${name}`);
  return match.groups.body;
}

function runtimePaths(workflow) {
  const match = workflow.match(/PAGES_RUNTIME_PATHS: >-\n(?<paths>(?: {4,}[^\n]+\n)+)/);
  assert.ok(match, "workflow must declare the Pages runtime allowlist");
  return new Set(match.groups.paths.trim().split(/\s+/));
}

test("Pages workflow preserves the defense-survivor release DAG and closure", async () => {
  const [workflow, readme] = await Promise.all([
    project(".github/workflows/static.yml"),
    project("README.md"),
  ]);
  const order = [
    "resolve_revision", "engine_contract", "release_closure", "browser_contract", "package_pages",
    "artifact_smoke", "deploy_pages", "deployed_smoke", "release_receipt",
  ];
  for (const name of order) assert.ok(job(workflow, name), `workflow must include ${name}`);

  for (const name of ["engine_contract", "release_closure", "browser_contract"]) {
    assert.match(job(workflow, name), /needs: resolve_revision/);
  }
  assert.match(job(workflow, "package_pages"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract\]/);
  assert.match(job(workflow, "artifact_smoke"), /needs: \[resolve_revision, package_pages\]/);
  assert.match(job(workflow, "deploy_pages"), /needs: \[resolve_revision, artifact_smoke\]/);
  assert.match(job(workflow, "deployed_smoke"), /needs: \[resolve_revision, deploy_pages\]/);
  assert.match(job(workflow, "deployed_smoke"), /if: needs\.deploy_pages\.result == 'success'/);
  assert.match(job(workflow, "release_receipt"), /if: always\(\)/);
  assert.match(job(workflow, "release_receipt"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract, package_pages, artifact_smoke, deploy_pages, deployed_smoke\]/);

  assert.deepEqual(runtimePaths(workflow), RUNTIME_PATHS);
  assert.match(job(workflow, "package_pages"), /read -r -a paths <<< "\$PAGES_RUNTIME_PATHS"/);
  assert.match(job(workflow, "package_pages"), /git archive --format=tar "\$RESOLVED_SHA" -- "\$\{paths\[@\]\}"/);
  assert.match(readme, new RegExp(`\\]\\(${GAMEPLAY_VIDEO.replaceAll(".", "\\.")}\\)`), `README must link ${GAMEPLAY_VIDEO}`);
  assert.match(workflow, /"rules_version":"%s"/);
  assert.match(workflow, /node scripts\/validate-pages-version\.mjs --file "\$PAGES_ARTIFACT_DIR\/version\.json" --sha "\$RESOLVED_SHA"/);
  assert.match(workflow, /status=unsupported-no-deployed-defense-smoke/);
  assert.match(job(workflow, "release_receipt"), /for result in "\$ENGINE" "\$CLOSURE" "\$BROWSER" "\$PACKAGE" "\$ARTIFACT" "\$DEPLOY" "\$DEPLOYED"; do/);
  for (const name of ["engine_contract", "release_closure", "browser_contract", "package_pages", "artifact_smoke", "deployed_smoke"]) {
    assert.match(job(workflow, name), /actions\/setup-node@[0-9a-f]{40}/, `${name} must pin the Node runtime`);
    assert.match(job(workflow, name), /node-version: 22\.14\.0/, `${name} must use the supported Node version`);
  }
  assert.match(job(workflow, "deployed_smoke"), /npm ci/);
  assert.match(job(workflow, "deployed_smoke"), /playwright install --with-deps chromium/);
  assert.match(job(workflow, "deployed_smoke"), /--rules-version "\$RULES_VERSION"/);
  assert.match(job(workflow, "package_pages"), /include-hidden-files: true/);
  assert.match(job(workflow, "package_pages"), /name: pages-bundle[\s\S]*?if-no-files-found: error/);
  assert.match(job(workflow, "release_receipt"), /"all_gate_pass":%s/);
  assert.match(job(workflow, "release_receipt"), /test "\$all_gate_pass" = true/);
  assert.doesNotMatch(workflow.match(/PAGES_RUNTIME_PATHS: >-[\s\S]*?\n\n/)?.[0] ?? "", /react-game-ui\.js|react-shop|vendor\/react|minimap|battle-field|campaign-sync|\.blend/i);

  for (const use of workflow.matchAll(/^\s+uses: [^\n]+$/gm)) {
    assert.match(use[0], /@[0-9a-f]{40}$/, `action must be SHA-pinned: ${use[0]}`);
  }
  for (const name of order) {
    assert.match(job(workflow, name), /if: always\(\)[\s\S]*?upload-artifact/, `${name} must upload results even after failure`);
  }
});

test("version scripts enforce the exact defense rules version", async () => {
  const reader = await project("scripts/read-defense-rules-version.mjs");
  assert.match(reader, new RegExp(`RULES_VERSION = "${RULES_VERSION}"`));
  assert.match(reader, /defense-catalog\.js must export RULES_VERSION/);

  const directory = await mkdtemp(join(tmpdir(), "pages-version-"));
  const versionFile = join(directory, "version.json");
  const sha = "a".repeat(40);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: RULES_VERSION }));
  await execFileAsync(process.execPath, ["scripts/validate-pages-version.mjs", "--file", versionFile, "--sha", sha]);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: "wrong" }));
  const required = [
    "index.html", "version.json", "app.js", "defense-viewport.js", "defense-catalog.js",
    "defense-run-simulation.js", "campaign-state.js", "defense-storage.js", "defense-cutscene.js",
    "defense-telemetry.js", "defense-audio.js", "battle-canvas-text.js", "battle-realtime-three.js", "battle-visualizer.js",
    "styles.css", "react-game-ui.css", "sw.js", "manifest.json",
    "assets/images/battle/dusk-warden-frame-00.png", "assets/images/battle/dusk-warden-frame-01.png",
    "assets/images/battle/dusk-warden-frame-02.png", "assets/images/battle/dusk-warden-frame-03.png",
    "assets/images/battle/echo-rusher-frame-00.png", "assets/images/battle/echo-rusher-frame-01.png",
    "assets/images/battle/echo-rusher-frame-02.png", "assets/images/battle/echo-rusher-frame-03.png",
    ...CINDER_SPAN_WORLD_ASSETS,
  ];
  for (const file of required) {
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file === "app.js" ? 'import "./bootstrap.js";\n' : "");
  }

  const command = new URL("tests/pages-artifact-smoke.cjs", ROOT).pathname;
  await assert.rejects(execFileAsync(process.execPath, [command, "--dir", directory]));
  await writeFile(join(directory, "bootstrap.js"), "export const boot = true;\n");
  await execFileAsync(process.execPath, [command, "--dir", directory]);
});

test("the candidate-stamped service worker precaches every runtime observer, refreshes the app shell, and preserves binary cache-first behavior", async () => {
  const candidateSha = "b".repeat(40);
  const listeners = new Map();
  const opened = [];
  const deleted = [];
  const cached = new Map();
  let precached = [];
  let installPromise;
  let activatePromise;
  let fetchHandler = async () => { throw new Error("unexpected network request"); };
  const currentCache = `abyssal-command-defense-survivor-${candidateSha}`;
  const staleCache = `abyssal-command-defense-survivor-${"a".repeat(40)}`;
  const unrelatedCache = "another-application-cache";
  const requestKey = (request) => typeof request === "string"
    ? new URL(request, self.location.href).href
    : request.url;
  const cache = {
    addAll: async (assets) => { precached = [...assets]; },
    put: async (request, response) => { cached.set(requestKey(request), response); },
  };
  const caches = {
    open: async (name) => {
      opened.push(name);
      return cache;
    },
    keys: async () => [currentCache, staleCache, unrelatedCache],
    delete: async (name) => { deleted.push(name); return true; },
    match: async (request) => cached.get(requestKey(request)) ?? null,
  };
  const self = {
    location: {
      origin: "https://example.test",
      href: "https://example.test/Abyssal-Surge/sw.js",
    },
    registration: { scope: "https://example.test/Abyssal-Surge/" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  const artifactSource = (await project("sw.js")).replaceAll("__CANDIDATE_SHA__", candidateSha);
  runInNewContext(artifactSource, {
    URL,
    Promise,
    Request,
    Response,
    caches,
    fetch: (...args) => fetchHandler(...args),
    self,
  });

  listeners.get("install")({
    waitUntil(promise) { installPromise = promise; },
  });
  await installPromise;
  assert.deepEqual(opened, [currentCache]);
  assert.ok(precached.includes("./battle-canvas-text.js"), "the renderer text helper must be candidate-stamped with the app shell");
  for (const path of CINDER_SPAN_WORLD_ASSETS) {
    assert.ok(precached.includes(`./${path}`), `${path} must be precached for offline Cinder Span presentation`);
  }
  assert.equal(
    precached.some((path) => /assets\/images\/battle\/world\/cinder-span-(?:topdown|tactical-paper)-plate\.png$/.test(path)),
    false,
    "the service worker must not precache duplicate Cinder Span PNG plates",
  );
  assert.ok(precached.includes("./defense-cutscene.js"));
  assert.ok(precached.includes("./defense-telemetry.js"));

  listeners.get("activate")({
    waitUntil(promise) { activatePromise = promise; },
  });
  await activatePromise;
  assert.deepEqual(deleted, [staleCache]);

  const dispatchFetch = async (request) => {
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith(promise) { responsePromise = Promise.resolve(promise); },
    });
    assert.ok(responsePromise, `service worker must respond to ${request.url}`);
    return responsePromise;
  };
  const stylesheetRequest = new Request("https://example.test/Abyssal-Surge/styles.css");
  cached.set(requestKey(stylesheetRequest), new Response("/* stale stylesheet */", { status: 200 }));
  const fetchCalls = [];
  fetchHandler = async (request, init) => {
    fetchCalls.push({ request, init });
    return new Response("/* deployed stylesheet */", { status: 200 });
  };

  const onlineStylesheet = await dispatchFetch(stylesheetRequest);
  assert.equal(await onlineStylesheet.text(), "/* deployed stylesheet */");
  assert.equal(fetchCalls.length, 1, "a cached stylesheet must still check the network");
  assert.equal(fetchCalls[0].request.url, stylesheetRequest.url);
  assert.equal(fetchCalls[0].init.cache, "no-store");
  assert.equal(await cached.get(requestKey(stylesheetRequest)).text(), "/* deployed stylesheet */");

  cached.set(requestKey(stylesheetRequest), new Response("/* offline cached stylesheet */", { status: 200 }));
  fetchHandler = async () => { throw new Error("offline"); };
  const offlineStylesheet = await dispatchFetch(stylesheetRequest);
  assert.equal(await offlineStylesheet.text(), "/* offline cached stylesheet */");

  const canvasTextRequest = new Request("https://example.test/Abyssal-Surge/battle-canvas-text.js");
  cached.set(requestKey(canvasTextRequest), new Response("/* stale text helper */", { status: 200 }));
  fetchHandler = async (request, init) => {
    fetchCalls.push({ request, init });
    return new Response("export const drawCanvasText = () => {};", { status: 200 });
  };
  const onlineCanvasText = await dispatchFetch(canvasTextRequest);
  assert.equal(await onlineCanvasText.text(), "export const drawCanvasText = () => {};");
  assert.equal(fetchCalls.length, 2, "a cached shell helper must still check the network");
  assert.equal(fetchCalls.at(-1).request.url, canvasTextRequest.url);
  assert.equal(fetchCalls.at(-1).init.cache, "no-store");
  assert.equal(await cached.get(requestKey(canvasTextRequest)).text(), "export const drawCanvasText = () => {};");

  cached.set(requestKey(canvasTextRequest), new Response("/* offline text helper */", { status: 200 }));
  fetchHandler = async () => { throw new Error("offline"); };
  const offlineCanvasText = await dispatchFetch(canvasTextRequest);
  assert.equal(await offlineCanvasText.text(), "/* offline text helper */");

  const spriteRequest = new Request(
    "https://example.test/Abyssal-Surge/assets/images/battle/dusk-warden-frame-00.png",
  );
  cached.set(requestKey(spriteRequest), new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const fetchesBeforeSprite = fetchCalls.length;
  const sprite = await dispatchFetch(spriteRequest);
  assert.deepEqual([...new Uint8Array(await sprite.arrayBuffer())], [1, 2, 3]);
  assert.equal(fetchCalls.length, fetchesBeforeSprite, "cached sprites must not require the network");
});
