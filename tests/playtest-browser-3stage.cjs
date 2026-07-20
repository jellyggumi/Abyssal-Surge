const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

const BRIDGE_CACHE_BOUNDARY_MODE = process.argv.includes("--bridge-cache-boundary");
const BRIDGE_ONLY_MODE = process.argv.includes("--bridge-only");
const REALTIME_ONLY_MODE = process.argv.includes("--realtime-only");
const SOURCE_CACHE_ADMISSION_MODE = process.argv.includes("--source-cache-admission");
const STAGE_ONE_ENCOUNTER_MODE = process.argv.includes("--stage-one-encounter");
const SHORT_VIEWPORT_MODE = process.argv.includes("--short-viewport");
const RENDERER_PARITY_MODE = process.argv.includes("--renderer-parity");
const STAGE_RAIL_SCROLL_MODE = process.argv.includes("--stage-rail-scroll");
const FALLBACK_TARGET_PARITY_MODE = process.argv.includes("--fallback-target-parity");
const COMPACT_CONTROL_JOURNEY_MODE = process.argv.includes("--compact-control-journey");
const COMPACT_FIELD_OVERLAY_MODE = process.argv.includes("--compact-field-overlay");
const STAGE_THREE_CHECKLIST_MODE = process.argv.includes("--stage-three-checklist");
const MOBILE_SAVE_CONTROLS_MODE = process.argv.includes("--mobile-save-controls");
const MEDIA_ERROR_CLASSIFICATION_MODE = process.argv.includes("--media-error-classification");
const DESKTOP_READABILITY_MODE = process.argv.includes("--desktop-readability");
const RESUME_RENDERING_MODE = process.argv.includes("--resume-rendering");
let playwright;
if (!BRIDGE_CACHE_BOUNDARY_MODE && !SOURCE_CACHE_ADMISSION_MODE && !MEDIA_ERROR_CLASSIFICATION_MODE) {
  try {
    playwright = require("playwright");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND" && /['\"]playwright['\"]/.test(error.message)) {
      console.error('PLAYWRIGHT_MISSING: require("playwright") could not resolve from tests/playtest-browser-3stage.cjs.');
      process.exitCode = 1;
    } else {
      console.error(`PLAYWRIGHT_LOAD_FAILED: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

const ROOT = path.resolve(__dirname, "..");
const CAMPAIGN_SOURCE_CONTRACT = import(pathToFileURL(path.join(ROOT, "campaign-state.js")).href)
  .then(({ RULES_VERSION, SAVE_SCHEMA_VERSION }) => Object.freeze({
    rulesVersion: RULES_VERSION,
    schemaVersion: SAVE_SCHEMA_VERSION,
  }));
const TRANSLATIONS_SOURCE_CONTRACT = import(pathToFileURL(path.join(ROOT, "i18n.js")).href)
  .then(({ translations }) => translations);
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
});

const STAGE_ONE_SOURCE_GLB_RESPONSES = Object.freeze([
  Object.freeze({ path: "/assets/models/abyssal-command/terrain/cinder-span.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/shade.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/scout.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/guard.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/reinforce.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/bosses/cinder-warden.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/props/soul-extractor.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/props/rift-portal.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/props/command-obelisk.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
]);

const STAGE_ONE_SOURCE_GLB_PATHS = new Set(STAGE_ONE_SOURCE_GLB_RESPONSES.map((response) => response.path));

const ALL_SOURCE_GLB_PATHS = new Set([
  "/assets/models/abyssal-command/terrain/cinder-span.glb",
  "/assets/models/abyssal-command/terrain/veil-citadel.glb",
  "/assets/models/abyssal-command/terrain/echo-throne-steps.glb",
  "/assets/models/abyssal-command/units/shade.glb",
  "/assets/models/abyssal-command/units/scout.glb",
  "/assets/models/abyssal-command/units/guard.glb",
  "/assets/models/abyssal-command/units/reinforce.glb",
  "/assets/models/abyssal-command/bosses/cinder-warden.glb",
  "/assets/models/abyssal-command/bosses/veil-tactician.glb",
  "/assets/models/abyssal-command/bosses/gate-sovereign.glb",
  "/assets/models/abyssal-command/props/soul-extractor.glb",
  "/assets/models/abyssal-command/props/rift-portal.glb",
  "/assets/models/abyssal-command/props/command-obelisk.glb",
]);


function createBridgeCacheBoundaryFixture({ manifest, jsonError } = {}) {
  const origin = "https://abyssal-surge.test";
  const manifestPath = "./assets/images/battle/glb/manifest.json";
  const cacheAdds = [];
  const cachePuts = [];
  const fetchRecords = [];
  const response = {
    ok: true,
    clone() {
      return { source: "bridge-manifest" };
    },
    async json() {
      if (jsonError) throw jsonError;
      return manifest;
    }
  };
  const cache = {
    async put(request, cachedResponse) {
      cachePuts.push({ request, cachedResponse });
    },
    async add(request) {
      cacheAdds.push(new URL(String(request), origin).href);
    }
  };
  const worker = {
    location: new URL(`${origin}/sw.js`),
    addEventListener() {},
    async skipWaiting() {},
    clients: { async claim() {} }
  };
  const context = vm.createContext({
    URL,
    Promise,
    self: worker,
    caches: {
      async open() {
        return cache;
      },
      async match() {
        return undefined;
      },
      async keys() {
        return [];
      },
      async delete() {
        return false;
      }
    },
    async fetch(request, options) {
      fetchRecords.push({ request, options });
      return response;
    }
  });
  const workerSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  vm.runInContext(`${workerSource}\nglobalThis.__cacheGlbBattleBridge = cacheGlbBattleBridge;\nglobalThis.__isGlbBridgeRequest = isGlbBridgeRequest;`, context, { filename: "sw.js" });

  return {
    cache,
    cacheAdds,
    cachePuts,
    fetchRecords,
    isBridgeRequest: (url, method = "GET") => context.__isGlbBridgeRequest({ method, url }),
    prewarm: () => context.__cacheGlbBattleBridge(cache)
  };
}

async function verifyBridgeCacheBoundary() {
  const origin = "https://abyssal-surge.test";
  const manifestPath = "./assets/images/battle/glb/manifest.json";
  const expectedBridgeAsset = `${origin}/assets/images/battle/glb/action-atlas.glb`;
  const fixture = createBridgeCacheBoundaryFixture({
    manifest: {
      records: [
        { output: { path: "/assets/images/battle/glb/action-atlas.glb" } },
        { output: { path: "/assets/images/battle/glb/../outside-bridge.glb" } },
        { output: { path: "/assets/images/battle/glb/%2e%2e/outside-encoded-dot.glb" } },
        { output: { path: "/assets/images/battle/glb/%2e%2e%2foutside-encoded-dot-separator.glb" } },
        { output: { path: "/assets/images/battle/glb/%2e%2e%5coutside-encoded-dot-backslash.glb" } },
        { output: { path: "/assets/images/battle/glb/%2f..%2foutside-encoded-separator-dot.glb" } },
        { output: { path: "https://untrusted.example/assets/images/battle/glb/foreign-bridge.glb" } },
        { output: { path: "https://[malformed-host" } },
        { output: { path: 42 } },
        { output: {} },
        { output: null },
        {},
        null
      ]
    }
  });

  await fixture.prewarm();

  assert.deepEqual(
    fixture.fetchRecords.map(({ request, options }) => ({ request: String(request), cache: options?.cache })),
    [
      { request: manifestPath, cache: "no-store" },
      { request: expectedBridgeAsset, cache: "no-store" },
    ],
    "Bridge prewarming must fetch the manifest and each admitted bridge asset with HTTP caching disabled.",
  );
  assert.deepEqual(
    fixture.cachePuts.map(({ request }) => String(request)),
    [manifestPath, expectedBridgeAsset],
    "Bridge prewarming must retain both the manifest and the admitted bridge asset with cache.put.",
  );
  assert.deepEqual(
    fixture.cacheAdds,
    [],
    "Bridge prewarming must not use cache.add, which cannot guarantee no-store fetches.",
  );
  assert.equal(
    fixture.isBridgeRequest(expectedBridgeAsset),
    true,
    "Fetch classification must retain the canonical bridge output."
  );
  for (const maliciousPath of [
    `${origin}/assets/images/battle/glb/../outside-bridge.glb`,
    `${origin}/assets/images/battle/glb/%2E%2E/outside-encoded-dot.glb`,
    `${origin}/assets/images/battle/glb/%2E%2E%2Foutside-encoded-dot-separator.glb`,
    `${origin}/assets/images/battle/glb/%2E%2E%5Coutside-encoded-dot-backslash.glb`,
    `${origin}/assets/images/battle/glb/%2F..%2Foutside-encoded-separator-dot.glb`,
    "https://[malformed-host"
  ]) {
    assert.equal(
      fixture.isBridgeRequest(maliciousPath),
      false,
      `Fetch classification must reject the unsafe bridge candidate: ${maliciousPath}`
    );
  }

  const malformedManifestFixture = createBridgeCacheBoundaryFixture({
    manifest: { records: { output: { path: "/assets/images/battle/glb/action-atlas.glb" } } }
  });
  await malformedManifestFixture.prewarm();
  assert.equal(malformedManifestFixture.cachePuts.length, 1, "A malformed manifest shape must still retain the fetched manifest.");
  assert.deepEqual(
    malformedManifestFixture.cacheAdds,
    [],
    "A malformed non-array manifest must not queue any bridge asset for cache.add."
  );

  const rejectedManifestFixture = createBridgeCacheBoundaryFixture({
    jsonError: new Error("bridge manifest JSON rejected")
  });
  await assert.rejects(
    rejectedManifestFixture.prewarm,
    /bridge manifest JSON rejected/,
    "JSON rejection must surface to the install handler, which preserves its existing catch-and-continue fallback."
  );
  assert.equal(rejectedManifestFixture.cachePuts.length, 1, "A JSON-rejected manifest must still be retained before the worker fallback runs.");
  assert.deepEqual(
    rejectedManifestFixture.cacheAdds,
    [],
    "A JSON-rejected manifest must not queue any bridge asset for cache.add."
  );
}


function createSourceCacheAdmissionFixture(response) {
  const origin = "https://abyssal-surge.test";
  const request = new Request(`${origin}/assets/models/abyssal-command/terrain/cinder-span.glb`);
  const cachePuts = [];
  const waitUntilPromises = [];
  const cache = {
    async put(cacheRequest, cachedResponse) {
      cachePuts.push({ request: cacheRequest, response: cachedResponse });
    }
  };
  const worker = {
    location: new URL(`${origin}/sw.js`),
    addEventListener() {},
    async skipWaiting() {},
    clients: { async claim() {} }
  };
  const context = vm.createContext({
    URL,
    Promise,
    Request,
    Response,
    self: worker,
    caches: {
      async open() {
        return cache;
      },
      async match() {
        return undefined;
      },
      async keys() {
        return [];
      },
      async delete() {
        return false;
      }
    },
    async fetch() {
      return response;
    }
  });
  const workerSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  vm.runInContext(
    `${workerSource}\nglobalThis.__isExpectedSourceGlbResponse = isExpectedSourceGlbResponse;\nglobalThis.__networkFirstLazySourceBattle = networkFirstLazySourceBattle;`,
    context,
    { filename: "sw.js" }
  );

  return {
    cachePuts,
    isExpected: () => context.__isExpectedSourceGlbResponse(response),
    async load() {
      const live = await context.__networkFirstLazySourceBattle(request, {
        waitUntil(promise) {
          waitUntilPromises.push(promise);
        }
      });
      await Promise.all(waitUntilPromises);
      return live;
    }
  };
}

async function verifySourceCacheAdmission() {
  for (const { label, response } of [
    {
      label: "200 text/html",
      response: new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } })
    },
    {
      label: "204 glTF media",
      response: new Response(null, { status: 204, headers: { "content-type": "model/gltf-binary" } })
    }
  ]) {
    const fixture = createSourceCacheAdmissionFixture(response);
    assert.equal(fixture.isExpected(), false, `${label} must not satisfy source GLB cache admission.`);
    assert.equal(await fixture.load(), response, `${label} must remain the live response when cache admission rejects it.`);
    assert.equal(fixture.cachePuts.length, 0, `${label} must produce zero source-GLB cache writes.`);
  }

  const bytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46]);
  const response = new Response(bytes, {
    status: 200,
    headers: { "content-type": "model/gltf-binary; charset=binary" }
  });
  const fixture = createSourceCacheAdmissionFixture(response);
  assert.equal(fixture.isExpected(), true, "A 200 glTF binary response with media parameters must satisfy source cache admission.");
  const live = await fixture.load();
  assert.notEqual(live, response, "An admitted source GLB must return an independent buffered live response.");
  assert.deepEqual([...new Uint8Array(await live.arrayBuffer())], [...bytes], "The admitted live response must retain its source GLB bytes.");
  assert.equal(fixture.cachePuts.length, 1, "An admitted source GLB must produce exactly one cache write.");
  assert.deepEqual(
    [...new Uint8Array(await fixture.cachePuts[0].response.arrayBuffer())],
    [...bytes],
    "The admitted source GLB cache entry must retain its source bytes."
  );
}
function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  } catch {
    return null;
  }

  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  return filePath.startsWith(`${ROOT}${path.sep}`) ? filePath : null;
}

function serveStatic(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": stats.size,
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
  });
}

async function startServer() {
  const server = http.createServer(serveStatic);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert(address && typeof address === "object", "Local browser-proof server did not bind an address.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server || !server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function isOptionalMediaUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/assets/audio/") || pathname.startsWith("/assets/video/");
  } catch {
    return false;
  }
}

function isExpectedBgmSceneHandoffAbort(url, errorText) {
  if (errorText !== "net::ERR_ABORTED") return false;
  try {
    const pathname = new URL(url).pathname;
    return pathname === "/assets/audio/battle-bgm.mp3" || pathname === "/assets/audio/bgm-theme.mp3";
  } catch {
    return false;
  }
}

function isTeardownAbortedBridgeAsset(url, errorText) {
  try {
    return new URL(url).pathname.startsWith("/assets/images/battle/glb/") && errorText === "net::ERR_ABORTED";
  } catch {
    return false;
  }
}
function collectClientErrors(page, { echoConsole = true } = {}) {
  const unexpectedErrors = [];
  const optionalMediaErrors = [];
  const expectedBgmAborts = [];
  page.on("pageerror", (error) => unexpectedErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (echoConsole) console.log(`PAGE LOG [${message.type()}]:`, message.text());
    if (message.type() !== "error") return;
    const sourceUrl = message.location().url || "";
    if (isOptionalMediaUrl(sourceUrl)) {
      optionalMediaErrors.push(`console: ${sourceUrl}`);
    } else {
      unexpectedErrors.push(`console: ${message.text()}${sourceUrl ? ` (${sourceUrl})` : ""}`);
    }
  });
  return { unexpectedErrors, optionalMediaErrors, expectedBgmAborts };
}

function assertNoClientErrors(errors, scenario) {
  const failures = [...errors.unexpectedErrors, ...errors.optionalMediaErrors];
  assert.deepEqual(failures, [], `${scenario} emitted client or network errors:\n${failures.join("\n")}`);
}

function verifyMediaErrorClassification() {
  const origin = "http://127.0.0.1:4173";
  for (const url of [
    `${origin}/assets/audio/battle-bgm.mp3`,
    `${origin}/assets/audio/bgm-theme.mp3?scene=briefing`,
  ]) {
    assert.equal(
      isExpectedBgmSceneHandoffAbort(url, "net::ERR_ABORTED"),
      true,
      `${url} must be recognized as an intentional BGM scene-handoff abort.`
    );
  }

  for (const { url, errorText } of [
    { url: `${origin}/assets/audio/battle-bgm.mp3`, errorText: "net::ERR_FAILED" },
    { url: `${origin}/assets/audio/bgm-theme.mp3`, errorText: "net::ERR_BLOCKED_BY_CLIENT" },
    { url: `${origin}/assets/audio/voiceover.mp3`, errorText: "net::ERR_ABORTED" },
    { url: `${origin}/assets/video/stage-intro.mp4`, errorText: "net::ERR_ABORTED" },
    { url: `${origin}/assets/audio/battle-bgm.mp3.backup`, errorText: "net::ERR_ABORTED" },
  ]) {
    assert.equal(
      isExpectedBgmSceneHandoffAbort(url, errorText),
      false,
      `${url} (${errorText}) must remain a client-error failure.`
    );
  }

  assert.throws(
    () => assertNoClientErrors(
      { unexpectedErrors: [], optionalMediaErrors: ["response 404: optional audio"], expectedBgmAborts: [] },
      "Media classification fixture"
    ),
    /response 404: optional audio/,
    "optional-media errors must fail the same client-error gate."
  );
}

function sourceModelGlbPath(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/assets/models/abyssal-command/") && pathname.endsWith(".glb") ? pathname : null;
  } catch {
    return null;
  }
}

function isTeardownAbortedRealtimeAsset(url, errorText) {
  try {
    const pathname = new URL(url).pathname;
    return (
      (pathname.startsWith("/assets/models/abyssal-command/") || pathname.startsWith("/assets/images/battle/glb/"))
      && errorText === "net::ERR_ABORTED"
    );
  } catch {
    return false;
  }
}

function requestOrigin(request) {
  return request.serviceWorker() ? "service-worker" : "page";
}

function collectPageSourceGlbResponses(page) {
  const records = [];
  page.on("response", (response) => {
    const request = response.request();
    const path = sourceModelGlbPath(response.url());
    if (
      !path
      || request.serviceWorker()
      || request.method() !== "GET"
      || response.status() !== 200
      || response.headers()["content-type"] !== "model/gltf-binary"
      || !response.fromServiceWorker()
    ) {
      return;
    }
    records.push({ path, status: response.status(), contentType: response.headers()["content-type"], fromServiceWorker: true });
  });
  return { records };
}

function collectCampaignModuleResponses(page, baseUrl) {
  const records = [];
  const expectedOrigin = new URL(baseUrl).origin;
  page.on("response", (response) => {
    let url;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }
    if (
      url.origin !== expectedOrigin
      || !["/app.js", "/campaign-state.js"].includes(url.pathname)
    ) {
      return;
    }
    const request = response.request();
    const headers = response.headers();
    records.push({
      path: url.pathname,
      status: response.status(),
      sourceOrigin: url.origin,
      requestOrigin: requestOrigin(request),
      fromServiceWorker: response.fromServiceWorker(),
      cacheControl: headers["cache-control"] ?? null,
      age: headers.age ?? null,
      etag: headers.etag ?? null,
    });
  });
  return { records };
}

async function installCampaignStartReadinessProbe(context) {
  await context.addInitScript(() => {
    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
      if (type === "click" && this instanceof HTMLElement && this.id === "start-campaign") {
        window.__campaignStartControlReady = true;
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };
  });
}

async function inspectCampaignModuleCoherence(page, baseUrl) {
  return page.evaluate(async () => {
    const moduleUrl = new URL("./campaign-state.js", document.baseURI).href;
    let moduleContract;
    let moduleError;
    try {
      const module = await import(moduleUrl);
      moduleContract = {
        rulesVersion: module.RULES_VERSION,
        schemaVersion: module.SAVE_SCHEMA_VERSION,
      };
    } catch (error) {
      moduleError = error instanceof Error ? error.stack || error.message : String(error);
    }
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => {
        const pathname = new URL(entry.name).pathname;
        return pathname === "/app.js" || pathname === "/campaign-state.js";
      })
      .map((entry) => ({
        path: new URL(entry.name).pathname,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
        initiatorType: entry.initiatorType,
      }));
    const startCampaign = document.querySelector("#start-campaign");
    const campaignScreen = document.querySelector("#campaign-screen");
    return {
      documentRulesVersion: document.documentElement.dataset.rulesVersion ?? null,
      moduleUrl,
      moduleContract,
      moduleError: moduleError ?? null,
      controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
      cacheNames: await caches.keys(),
      resources,
      campaignUi: {
        saveStatus: document.querySelector("#save-status")?.textContent?.trim() ?? null,
        startCampaignHidden: startCampaign?.hidden ?? null,
        startCampaignDisabled: startCampaign?.disabled ?? null,
        startControlReady: window.__campaignStartControlReady === true,
        campaignScreenHidden: campaignScreen?.hidden ?? null,
      },
    };
  });
}

async function assertCampaignModuleCoherence(page, baseUrl, responseTrace) {
  const sourceContract = await CAMPAIGN_SOURCE_CONTRACT;
  const observed = await inspectCampaignModuleCoherence(page, baseUrl);
  try {
    assert.equal(
      observed.documentRulesVersion,
      sourceContract.rulesVersion,
      "The ready application must publish the current source campaign rules version."
    );
    assert.equal(
      observed.moduleError,
      null,
      "The browser must import the campaign state module after application readiness."
    );
    assert.equal(
      observed.moduleUrl,
      `${baseUrl}/campaign-state.js`,
      "The browser campaign module must resolve on the current ephemeral source origin."
    );
    assert.deepEqual(
      observed.moduleContract,
      sourceContract,
      "The application and dynamically imported campaign module must expose the same current source save contract."
    );
  } catch (error) {
    error.message = `${error.message}\nApp/campaign module source/cache evidence: ${JSON.stringify({
      sourceContract,
      observed,
      responses: responseTrace.records,
    })}`;
    throw error;
  }
}

async function appendCampaignModuleEvidence(error, page, baseUrl, responseTrace) {
  let observed;
  try {
    observed = await inspectCampaignModuleCoherence(page, baseUrl);
  } catch (inspectionError) {
    observed = {
      inspectionError: inspectionError instanceof Error ? inspectionError.stack || inspectionError.message : String(inspectionError),
    };
  }
  const evidence = `App/campaign module source/cache evidence: ${JSON.stringify({
    sourceContract: await CAMPAIGN_SOURCE_CONTRACT,
    observed,
    responses: responseTrace.records,
  })}`;
  error.message = `${error.message}\n${evidence}`;
  if (error.stack) error.stack = `${error.stack}\n${evidence}`;
}

function assertObservedSourceGlbPaths(sourceGlbTrace, expectedPaths, scenario) {
  assert.deepEqual(
    [...new Set(sourceGlbTrace.records.map((response) => response.path))].sort(),
    [...expectedPaths].sort(),
    `${scenario} must observe each and only the ${expectedPaths.size} expected source GLB responses.`
  );
}


function collectStrictClientErrors(page, {
  allowExpectedBgmAborts = false,
  echoConsole = true,
} = {}) {
  const errors = collectClientErrors(page, { echoConsole });
  let teardownStarted = false;
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "failed";
    if (teardownStarted && isTeardownAbortedRealtimeAsset(request.url(), errorText)) return;
    if (allowExpectedBgmAborts && isExpectedBgmSceneHandoffAbort(request.url(), errorText)) {
      errors.expectedBgmAborts.push(`request (${requestOrigin(request)}): ${request.url()} (${errorText})`);
      return;
    }
    errors.unexpectedErrors.push(`request (${requestOrigin(request)}): ${request.url()} (${errorText})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.unexpectedErrors.push(`response ${response.status()}: ${response.url()}`);
  });
  return {
    ...errors,
    beginTeardown() {
      teardownStarted = true;
    }
  };
}

function assertNoStrictClientErrors(errors, scenario) {
  assert.deepEqual(
    [...errors.unexpectedErrors, ...errors.optionalMediaErrors],
    [],
    `${scenario} emitted client or network errors:\n${[...errors.unexpectedErrors, ...errors.optionalMediaErrors].join("\n")}`
  );
}


async function text(locator) {
  return (await locator.textContent() || "").trim();
}

async function campaignSurface(page) {
  return page.evaluate(() => [
    "#campaign-status",
    "#souls-value",
    "#legion-value",
    "#nodes-value",
    "#integrity-value",
    "#boss-value",
    "#objective-checklist",
  ].map((selector) => {
    const element = document.querySelector(selector);
    return [selector, selector === "#objective-checklist" ? element?.innerHTML : element?.textContent?.trim()];
  }));
}




async function assertStage(page, number, heading) {
  const availableStageCount = await page.locator("[id^='stage-select-']").count();
  const lang = await page.locator("html").getAttribute("lang");
  assert.ok(lang === "ko" || lang === "en", `Stage ${number} requires a supported document locale; received ${String(lang)}.`);
  const expectedStageNumber = lang === "ko"
    ? `${availableStageCount}단계 중 ${number}단계`
    : `Stage ${number} of ${availableStageCount}`;
  assert.equal(await text(page.locator("#stage-number")), expectedStageNumber, `Stage ${number} number must match the ${lang} contract.`);
  const expectedHeading = lang === "en"
    ? heading
    : await text(page.locator(`#stage-select-${number} span`).last());
  assert.equal(await text(page.locator("#stage-heading")), expectedHeading, `Stage ${number} heading must match its localized active-selector identity.`);
  assert.equal(await page.locator(`#stage-select-${number}`).getAttribute("aria-current"), "step", `Stage ${number} selector must identify the active stage.`);
}
async function assertBattleVisualizationStatus(page, number) {
  const fallback = page.locator("#battle-visual-fallback");
  if (!(await fallback.isVisible())) return;

  const language = await page.locator("html").getAttribute("lang");
  const fallbackPresentation = BATTLE_FALLBACK_PRESENTATIONS[language];
  assert.ok(fallbackPresentation, `Stage ${number} fallback status requires a supported document locale; received ${String(language)}.`);
  const acceptedStatuses = [fallbackPresentation.notice];
  if (number === 1) acceptedStatuses.push(STAGE_ONE_FIRST_ORDERS[language]);
  const status = await text(page.locator("#campaign-status"));
  assert.ok(
    acceptedStatuses.includes(status),
    `Stage ${number} ${language} fallback must retain an exact rendering notice or acknowledged first-order status; observed ${JSON.stringify(status)}.`
  );
}
const BATTLE_PRESENTATIONS = Object.freeze({
  1: Object.freeze({
    ko: Object.freeze({
      operation: "작전: 잿불 돌파",
      doctrine: "제련소 길을 열고 그림자를 일으켜 워든의 지배를 끊으십시오."
    }),
    en: Object.freeze({
      operation: "Operation: Ember Break",
      doctrine: "Open the forge lane, raise shades, then sever the Warden's hold."
    })
  }),
  2: Object.freeze({
    ko: Object.freeze({
      operation: "작전: 베일 돌파",
      doctrine: "전술가가 경청 수로를 차단하기 전에 두 신호 거점을 모두 점거하십시오."
    }),
    en: Object.freeze({
      operation: "Operation: Veil Breach",
      doctrine: "Hold both signal nodes before the Tactician closes the listening routes."
    })
  }),
  3: Object.freeze({
    ko: Object.freeze({
      operation: "작전: 왕좌 함락",
      doctrine: "왕좌 거점을 확보하고 군주의 영역을 발동하여 소버린의 관문을 부수십시오."
    }),
    en: Object.freeze({
      operation: "Operation: Thronefall",
      doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate."
    })
  })
});
const BATTLE_FALLBACK_PRESENTATIONS = Object.freeze({
  ko: Object.freeze({
    kicker: "정적 전술 브리핑",
    pressure: "정적 전술 모드: 렌더링이 불가하지만 명령 규칙은 활성 상태로 유지됩니다.",
    notice: "전투 시각화가 비활성화되었습니다. 명령 시스템은 준비 완료되었습니다.",
    waveIndicator: "정적 전술 브리핑 · 명령 스케줄 활성화됨",
  }),
  en: Object.freeze({
    kicker: "Static tactical briefing",
    pressure: "Static tactical fallback: rendering is unavailable, but command rules remain active.",
    notice: "Battle visualization is unavailable; command rules remain ready.",
    waveIndicator: "STATIC TACTICAL BRIEFING · COMMAND SCHEDULE ACTIVE",
  }),
});


async function assertBattlePresentation(page, number) {
  const stagePresentation = BATTLE_PRESENTATIONS[number];
  assert.ok(stagePresentation, `Stage ${number} must have a player-facing battle presentation.`);
  const language = await page.locator("html").getAttribute("lang");
  const presentation = stagePresentation[language];
  assert.ok(presentation, `Stage ${number} must have a player-facing battle presentation for html[lang=${language}].`);
  const fallbackPresentation = BATTLE_FALLBACK_PRESENTATIONS[language];
  assert.ok(fallbackPresentation, `Stage ${number} fallback requires a supported document locale; received ${String(language)}.`);

  const brief = page.locator("#battle-tactical-brief");
  await brief.waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#battle-operation")), presentation.operation, `Stage ${number} must expose its operation in the visible battle brief.`);
  assert.equal(await text(page.locator("#battle-doctrine")), presentation.doctrine, `Stage ${number} must expose its doctrine in the visible battle brief.`);

  const fallback = page.locator("#battle-visual-fallback");
  if (await fallback.isVisible()) {
    assert.equal(
      await text(fallback.locator(".battle-fallback-kicker")),
      fallbackPresentation.kicker,
      `Stage ${number} fallback must expose the exact ${language} static tactical briefing label, not a map.`
    );
    assert.equal(await text(page.locator("#battle-fallback-operation")), presentation.operation, `Stage ${number} fallback must retain the current operation.`);
    assert.equal(await text(page.locator("#battle-fallback-doctrine")), presentation.doctrine, `Stage ${number} fallback must retain the current doctrine.`);
    assert.equal(
      await text(page.locator("#battle-pressure")),
      fallbackPresentation.pressure,
      `Stage ${number} fallback must expose the exact ${language} static-rendering status while command rules remain active.`
    );
  }
}

async function assertDirectSourceGlbReadiness(page) {
  await page.waitForFunction(() => document.querySelector("#battle-asset-status")?.dataset.state === "loaded", undefined, { timeout: 30_000 });
  const status = await text(page.locator("#battle-asset-status"));
  assert.match(
    status,
    /^(?:Source GLB atlases 6\/6 · \d+ action clips active|GLB 소스 아틀라스 6\/6 · 동작 클립 \d+개 활성)$/,
    "The tactical brief must visibly report that all six direct-renderer source GLBs and their action clips are ready."
  );
  assert.doesNotMatch(
    status,
    /(?:fallback|대체)/iu,
    "Once the direct source GLBs load, tactical status must not report a rendering fallback."
  );
}


async function waitForActionEnabledAndReachable(page, selector) {
  await page.waitForFunction(
    (actionSelector) => {
      const action = document.querySelector(actionSelector);
      if (!(action instanceof HTMLButtonElement) || action.disabled) return false;
      const bounds = action.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return false;
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      return target === action || action.contains(target);
    },
    selector,
    { timeout: 30_000 }
  );
}

async function clickEnabledAction(page, selector, { assertCampaignSurface = true } = {}) {
  const action = page.locator(selector);
  await action.waitFor({ state: "visible" });
  await waitForActionEnabledAndReachable(page, selector);
  const beforeAction = assertCampaignSurface ? await campaignSurface(page) : undefined;
  await action.click({ timeout: 30_000, noWaitAfter: true });
  await page.waitForFunction(
    (actionSelector) => document.querySelector(actionSelector) instanceof HTMLButtonElement
      && document.querySelector(actionSelector).disabled,
    selector,
    { timeout: 30_000 }
  );
  if (assertCampaignSurface) {
    await page.waitForFunction(
      (before) => JSON.stringify([
        "#campaign-status",
        "#souls-value",
        "#legion-value",
        "#nodes-value",
        "#integrity-value",
        "#boss-value",
        "#objective-checklist",
      ].map((actionSelector) => {
        const element = document.querySelector(actionSelector);
        return [actionSelector, actionSelector === "#objective-checklist" ? element?.innerHTML : element?.textContent?.trim()];
      })) !== JSON.stringify(before),
      beforeAction,
      { timeout: 30_000 }
    );
    assert.notDeepEqual(
      await campaignSurface(page),
      beforeAction,
      `${selector} must visibly advance campaign state after its click.`,
    );
  }
}

async function runActions(page, selectors) {
  for (const selector of selectors) {
    await clickEnabledAction(page, selector);
  }
}
async function assertCurrentObjectiveCommand(page, expectedAction, context) {
  const markedCommands = await page.locator("#command-panel [data-action]").evaluateAll((buttons) => buttons
    .map((button) => ({
      action: button.dataset.action,
      currentObjective: button.classList.contains("current-objective"),
      ariaCurrent: button.getAttribute("aria-current")
    }))
    .filter((button) => button.currentObjective || button.ariaCurrent !== null)
  );
  const expectedMarkers = expectedAction
    ? [{ action: expectedAction, currentObjective: true, ariaCurrent: "step" }]
    : [];
  assert.deepEqual(
    markedCommands,
    expectedMarkers,
    `${context} must ${expectedAction ? `mark only the ${expectedAction} command as the current objective with static styling and aria-current="step"` : "not mark a command when the current objective is an encounter"}.`
  );
}



async function assertBattleCanvasBlankPassThrough(page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector("#battle-canvas-3d");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const step = Math.max(24, Math.floor(Math.min(rect.width, rect.height) / 6));
    for (let y = rect.top + 12; y < rect.bottom - 12; y += step) {
      for (let x = rect.left + 12; x < rect.right - 12; x += step) {
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    }
    return null;
  });
  assert.ok(point, "The live battlefield must expose a direct canvas hit-test point.");

  await page.evaluate(() => {
    const canvas = document.querySelector("#battle-canvas-3d");
    canvas.removeAttribute("data-playtest-pointerdown");
    canvas.addEventListener("pointerdown", (event) => {
      canvas.dataset.playtestPointerdown = JSON.stringify({ count: 1, targetId: event.target.id });
    }, { once: true });
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => Boolean(document.querySelector("#battle-canvas-3d")?.dataset.playtestPointerdown));
  const canvasPointerDown = await page.evaluate(() => {
    const canvas = document.querySelector("#battle-canvas-3d");
    const result = JSON.parse(canvas.dataset.playtestPointerdown);
    delete canvas.dataset.playtestPointerdown;
    return result;
  });
  assert.deepEqual(
    canvasPointerDown,
    { count: 1, targetId: "battle-canvas-3d" },
    "A physical click at a direct canvas hit-test point must deliver exactly one pointerdown to the canvas."
  );
}

async function fallbackCanvasWorldPoint(page, { x, y, z = 0 }) {
  return page.locator("#battle-canvas-fallback").evaluate((canvas, world) => {
    const TILE_W = 64;
    const TILE_H = 32;
    const ELEV_H = 16;
    const project = (worldX, worldY, worldZ = 0) => ({
      x: (worldX - worldY) * (TILE_W / 2),
      y: (worldX + worldY) * (TILE_H / 2) - worldZ * ELEV_H,
    });
    const rect = canvas.getBoundingClientRect();
    const corners = [project(0, 0), project(16, 0), project(0, 8), project(16, 8)];
    const minX = Math.min(...corners.map((point) => point.x)) - TILE_W / 2;
    const maxX = Math.max(...corners.map((point) => point.x)) + TILE_W / 2;
    const minY = Math.min(...corners.map((point) => point.y)) - ELEV_H * 3;
    const maxY = Math.max(...corners.map((point) => point.y)) + TILE_H;
    const scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY));
    const target = project(world.x, world.y, world.z);
    return {
      x: rect.left + (rect.width - (maxX - minX) * scale) / 2 - minX * scale + target.x * scale,
      y: rect.top + (rect.height - (maxY - minY) * scale) / 2 - minY * scale + target.y * scale,
    };
  }, { x, y, z });
}

async function fallbackCanvasActionPoint(page, action) {
  await page.evaluate(async () => {
    if (!window.__playtestFallbackAnchorAudit) {
      const { BattleVisualizer } = await import("/battle-visualizer.js");
      const originalNotify = BattleVisualizer.prototype.notifyTacticalLayout;
      BattleVisualizer.prototype.notifyTacticalLayout = function notifyTacticalLayout() {
        if (this.canvas?.id === "battle-canvas-fallback") {
          window.__playtestFallbackAnchorAudit = { anchors: this.getTacticalTargetAnchors() };
        }
        return originalNotify.call(this);
      };
      window.__playtestFallbackAnchorAudit = { anchors: null };
    }
    window.__playtestFallbackAnchorAudit.anchors = null;
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForFunction(() => Boolean(window.__playtestFallbackAnchorAudit?.anchors));
  return page.evaluate((expectedAction) => {
    const canvas = document.querySelector("#battle-canvas-fallback");
    const anchor = window.__playtestFallbackAnchorAudit.anchors?.[expectedAction];
    if (!canvas || !anchor) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + anchor.x, y: rect.top + anchor.y };
  }, action);
}

async function clickFallbackCanvasPoint(page, point, context) {
  assert.ok(point, `${context} must expose a rendered fallback target point.`);
  const ownsPoint = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y) === document.querySelector("#battle-canvas-fallback"), point);
  assert.equal(ownsPoint, true, `${context} must use a direct hit-test point on the rendered fallback canvas.`);
  await page.evaluate(() => {
    const canvas = document.querySelector("#battle-canvas-fallback");
    canvas.removeAttribute("data-playtest-pointerup");
    canvas.addEventListener("pointerup", (event) => {
      canvas.dataset.playtestPointerup = JSON.stringify({ count: 1, targetId: event.target.id });
    }, { once: true });
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => Boolean(document.querySelector("#battle-canvas-fallback")?.dataset.playtestPointerup));
}

async function clickFallbackCanvasWorldPoint(page, world, context) {
  await clickFallbackCanvasPoint(page, await fallbackCanvasWorldPoint(page, world), context);
}

async function clickFallbackSemanticAction(page, action, context) {
  const traceStart = (await campaignTrace(page)).length;
  await clickFallbackCanvasPoint(page, await fallbackCanvasActionPoint(page, action), context);
  const dispatchState = await page.evaluate((expectedAction) => {
    const canvas = document.querySelector("#battle-canvas-fallback");
    const actionButton = document.querySelector(`#action-${expectedAction}`);
    return {
      pointerup: canvas?.dataset.playtestPointerup,
      actionDisabled: actionButton instanceof HTMLButtonElement && actionButton.disabled,
    };
  }, action);
  assert.deepEqual(
    dispatchState,
    { pointerup: JSON.stringify({ count: 1, targetId: "battle-canvas-fallback" }), actionDisabled: true },
    `${context} must route its physical fallback-canvas click to the supplied ${action} callback.`,
  );
  const trace = (await campaignTrace(page)).slice(traceStart);
  const expectedTransition = action === "assault"
    ? [{ kind: "encounter", event: { type: "boss-assault", stageId: "cinder-span" } }]
    : [{ kind: "action", action }];
  assert.deepEqual(
    trace,
    expectedTransition,
    `${context} must append exactly one public ${action} campaign transition from the rendered fallback canvas.`,
  );
}

async function enterBattle(page, number, heading) {
  // Single-screen cockpit: the battlefield, intel rail, and command pad are
  // all live the moment the stage is active - no scenario/boss-spec clicks.
  await assertStage(page, number, heading);
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.locator("#command-panel").waitFor({ state: "visible" });
  await assertCockpitCommandDock(page, `Stage ${number} battle`);
  assert.equal(
    await page.locator("#view-result").isHidden(),
    true,
    `Stage ${number} result overlay must be closed while the stage battle runs.`
  );
  await assertBattleVisualizationStatus(page, number);
  await assertBattlePresentation(page, number);
  return text(page.locator("#integrity-value"));
}

const BATTLE_RESOLUTION_TIMEOUT_MS = 50_000;
const STAGE_ONE_ENGAGEMENT_TIMEOUT_MS = 20_000;
const COMMAND_COOLDOWN_TIMEOUT_MS = 7_000;

async function configureBattleParityContext(context, { failCanvas = false, auditAnimationFrames = false } = {}) {
  await context.addInitScript(({ failCanvas, auditAnimationFrames }) => {
    // Direct renderer failure is the only degradation injected into the campaign path.

    if (failCanvas) {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
        if (type === "webgl2") return null;
        return nativeGetContext.call(this, type, ...args);
      };
    }

    if (auditAnimationFrames) {
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      let captureActive = false;
      let capturedRequests = 0;
      window.requestAnimationFrame = (callback) => {
        if (captureActive) capturedRequests += 1;
        return nativeRequestAnimationFrame(callback);
      };
      Object.defineProperty(window, "__battleAnimationAudit", {
        configurable: true,
        value: {
          begin() {
            capturedRequests = 0;
            captureActive = true;
          },
          end() {
            captureActive = false;
            return capturedRequests;
          }
        }
      });
    }
  }, { failCanvas, auditAnimationFrames });
}

async function exportCampaignEnvelope(page) {
  const downloadReady = page.waitForEvent("download");
  await page.locator("#export-save").click();
  const download = await downloadReady;
  const downloadPath = await download.path();
  assert.ok(downloadPath, "The public save export must provide a readable download.");
  const envelope = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
  assert.equal(typeof envelope.schema, "string", "The public campaign save export must expose its schema.");
  assert.ok(Array.isArray(envelope.trace), "The public campaign save export must expose a versioned trace.");
  return envelope;
}

async function campaignTrace(page) {
  return (await exportCampaignEnvelope(page)).trace;
}

function trackMainFrameNavigations(page) {
  let count = 0;
  const onFrameNavigated = (frame) => {
    if (frame === page.mainFrame()) count += 1;
  };
  page.on("framenavigated", onFrameNavigated);
  return {
    count: () => count,
    reset: () => {
      count = 0;
    },
    dispose: () => page.off("framenavigated", onFrameNavigated)
  };
}

async function waitForCampaignBoot(page, {
  baseUrl = new URL(page.url()).origin,
  responseTrace = { records: [] },
  requireStartControlReady = false,
} = {}) {
  const sourceContract = await CAMPAIGN_SOURCE_CONTRACT;
  await page.waitForFunction(
    ({ rulesVersion, requireStartControlReady }) => (
      document.documentElement.dataset.rulesVersion === rulesVersion
      && document.querySelector("#save-status")?.textContent !== "Preparing local save…"
      && (!requireStartControlReady || window.__campaignStartControlReady === true)
    ),
    { rulesVersion: sourceContract.rulesVersion, requireStartControlReady }
  );
  await assertCampaignModuleCoherence(page, baseUrl, responseTrace);
}

async function importCampaignEnvelope(page, envelope, name) {
  await page.locator("#import-save").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope), "utf8")
  });
  await page.locator("#campaign-screen").waitFor({ state: "visible" });
  const language = await page.locator("html").getAttribute("lang");
  const importedCampaignSavedShapes = Object.freeze({
    ko: Object.freeze({
      prefix: "가져온 캠페인 저장 완료 (",
      suffix: "에 저장됨)",
    }),
    en: Object.freeze({
      prefix: "Imported campaign saved in ",
      suffix: ".",
    }),
  });
  const expectedStatusShape = importedCampaignSavedShapes[language];
  assert.ok(expectedStatusShape, `Imported campaign persistence requires a supported document locale; received html[lang=${String(language)}].`);
  await page.waitForFunction(
    ({ prefix, suffix }) => {
      const status = document.querySelector("#save-status")?.textContent ?? "";
      return status.startsWith(prefix)
        && status.endsWith(suffix)
        && status.length > prefix.length + suffix.length;
    },
    expectedStatusShape,
    { timeout: 10_000 }
  );
}

function acceptedCampaignTransition(result, label) {
  assert.equal(result.accepted, true, label ?? result.message);
  return result.state;
}

async function createCampaignFixtures() {
  const {
    STAGES,
    applyAction,
    applyEncounterEvent,
    chooseReward,
    createCampaign,
    createSaveEnvelope,
    restoreSaveEnvelope,
    startCampaign
  } = await import(pathToFileURL(path.join(ROOT, "campaign-state.js")).href);

  const commands = (state, actions) => actions.reduce(
    (next, action) => {
      const result = typeof action === "string"
        ? applyAction(next, action)
        : applyEncounterEvent(next, { ...action, stageId: next.stageId });
      return acceptedCampaignTransition(result, `Campaign fixture ${typeof action === "string" ? `action ${action}` : `${action.type} ${action.waveId}`} must be accepted.`);
    },
    state
  );
  const start = () => acceptedCampaignTransition(startCampaign(createCampaign()), "Campaign fixture must start from briefing.");
  const assertScoutStartRejected = (state, label) => {
    const stateBeforeStart = JSON.parse(JSON.stringify(state));
    const scoutStart = { type: "start-wave", stageId: state.stageId, waveId: "scout" };
    const direct = applyEncounterEvent(state, scoutStart);
    assert.equal(direct.accepted, false, `${label} direct Scout start must reject until Cinder Span has 4 Legion and 1 Node.`);
    assert.deepEqual(direct.state, stateBeforeStart, `${label} rejected direct Scout start must leave the full campaign state unchanged.`);
    assert.equal(
      direct.state.trace.filter((event) => event.kind === "encounter").length,
      0,
      `${label} rejected direct Scout start must preserve a zero encounter trace.`,
    );

    const replay = createSaveEnvelope(state);
    replay.trace.push({ kind: "encounter", event: scoutStart });
    assert.throws(
      () => restoreSaveEnvelope(replay),
      /impossible transition/,
      `${label} replayed Scout start must reject until Cinder Span has 4 Legion and 1 Node.`,
    );
  };
  const twoLegionForgeReady = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture"]);
  assert.equal(twoLegionForgeReady.stage.legion, 2, "The Cinder Span direct/replay Scout fixture must field only two Legion allies.");
  assert.equal(twoLegionForgeReady.stage.nodes, 1, "The Cinder Span direct/replay Scout fixture must claim its forge node.");
  assertScoutStartRejected(twoLegionForgeReady, "Two-Legion forge-ready");

  const fourLegionNoForge = commands(start(), ["hunt", "hunt", "extract", "materialize", "materialize"]);
  assert.equal(fourLegionNoForge.stage.legion, 4, "The Cinder Span direct/replay Scout fixture must field four Legion allies.");
  assert.equal(fourLegionNoForge.stage.nodes, 0, "The Cinder Span direct/replay Scout fixture must leave its forge node unclaimed.");
  assertScoutStartRejected(fourLegionNoForge, "Four-Legion forge-unclaimed");

  const stageOneEncounter = [
    { type: "start-wave", waveId: "scout" },
    { type: "wave-cleared", waveId: "scout" },
    { type: "start-wave", waveId: "guard" },
    { type: "wave-cleared", waveId: "guard" },
    { type: "start-wave", waveId: "reinforcement" },
    { type: "wave-cleared", waveId: "reinforcement" },
  ];
  const stageOneVictory = ["hunt", "hunt", "extract", "materialize", "materialize", "capture", ...stageOneEncounter, "assault", "assault", "assault"];
  const terminalRewardByStageId = new Map([
    ["cinder-span", "shadebreaker-brand"],
    ["veil-citadel", "abyssal-banner"],
    ["echo-throne", "dawnless-crown"],
    ["sunken-bastion", "coral-aegis"],
    ["howling-sprawl", "pack-banner"],
    ["glass-necropolis", "necropolis-plate"],
    ["starless-canal", "tyrant-chain"],
    ["shattered-causeway", "colossus-plate"],
    ["abyss-chancel", "chancel-veil"],
    ["gate-zenith", "zenith-crown"],
  ]);
  const completeStage = (state, stage) => {
    const actions = [
      "hunt",
      "hunt",
      "extract",
      "materialize",
      "materialize",
      ...Array.from({ length: stage.nodeGoal }, () => "capture"),
      ...(stage.commands.possess ? ["possess"] : []),
      ...(stage.commands.domain ? ["domain"] : []),
      ...(stage.encounter?.waves ?? []).flatMap((wave) => [
        { type: "start-wave", waveId: wave.id },
        { type: "wave-cleared", waveId: wave.id },
      ]),
    ];
    let victory = commands(state, actions);
    while (victory.status === "active") {
      victory = commands(victory, ["assault"]);
    }
    assert.equal(victory.status, "reward", `${stage.title} fixture must reach its reward state.`);
    return victory;
  };

  const briefing = createCampaign();
  const reward = commands(start(), stageOneVictory);
  const exposed = commands(start(), ["hunt", "hunt", "extract", "materialize", "materialize", "capture", ...stageOneEncounter]);
  const stageTwo = acceptedCampaignTransition(
    chooseReward(reward, "rift-lens"),
    "Focused Stage 3 fixture must carry Rift Lens into Veil Citadel.",
  );
  const stageTwoReward = completeStage(stageTwo, STAGES[1]);
  const stageThree = acceptedCampaignTransition(
    chooseReward(stageTwoReward, "veil-vanguard"),
    "Focused Stage 3 fixture must carry Veil Vanguard into Echo Throne.",
  );
  const stageThreePrepared = commands(
    stageThree,
    ["hunt", "hunt", "extract", "materialize", "materialize", "capture"],
  );
  assert.equal(stageThreePrepared.stageId, "echo-throne", "Focused Stage 3 fixture must remain in Echo Throne.");
  assert.equal(stageThreePrepared.status, "active", "Focused Stage 3 fixture must remain active before optional commands or Assault.");

  let defeat = commands(start(), ["hunt", "hunt", "extract", "materialize", "materialize", "capture", { type: "start-wave", waveId: "scout" }]);
  while (defeat.status === "active") {
    defeat = acceptedCampaignTransition(
      applyEncounterEvent(defeat, { type: "breach", stageId: defeat.stageId, waveId: defeat.stage.encounter.activeWaveId }),
      "Campaign fixture encounter breach must be accepted."
    );
  }

  let completed = start();
  for (const stage of STAGES) {
    completed = completeStage(completed, stage);
    completed = acceptedCampaignTransition(
      chooseReward(completed, terminalRewardByStageId.get(stage.id)),
      `${stage.title} fixture reward must be accepted.`,
    );
  }

  assert.equal(briefing.status, "briefing", "Briefing fixture must retain an empty trace.");
  assert.deepEqual(briefing.trace, [], "Briefing fixture must contain no campaign progress.");
  assert.equal(reward.status, "reward", "Reward fixture must await a reward selection.");
  assert.equal(defeat.status, "defeat", "Defeat fixture must end in defeat.");
  assert.equal(completed.status, "campaign-complete", "Completed fixture must end in campaign completion.");

  return Object.freeze({
    briefing: createSaveEnvelope(briefing),
    reward: createSaveEnvelope(reward),
    exposed: createSaveEnvelope(exposed),
    defeat: createSaveEnvelope(defeat),
    stageThreePrepared: createSaveEnvelope(stageThreePrepared),
    completed: createSaveEnvelope(completed)
  });
}

function isSerializedEncounterBreach(event) {
  return event?.kind === "encounter" && event.event?.type === "breach";
}
function isSerializedEncounterResolution(event) {
  return event?.kind === "encounter"
    && (event.event?.type === "breach" || event.event?.type === "wave-cleared");
}

function isSerializedScoutStart(event) {
  return event?.kind === "encounter"
    && event.event?.type === "start-wave"
    && event.event?.stageId === "cinder-span"
    && event.event?.waveId === "scout";
}


async function awaitTimedBattleResolution(page, entryIntegrity, resolvedCountBefore) {
  await page.waitForFunction(
    ({ initialIntegrity, initialResolvedCount }) => {
      const integrity = Number.parseInt(document.querySelector("#integrity-value")?.textContent || "", 10);
      const resolvedCount = document.querySelectorAll("#objective-checklist .complete").length;
      return integrity < initialIntegrity || resolvedCount > initialResolvedCount;
    },
    { initialIntegrity: entryIntegrity, initialResolvedCount: resolvedCountBefore },
    { polling: 20, timeout: BATTLE_RESOLUTION_TIMEOUT_MS }
  );
  await page.waitForTimeout(250);

  const trace = await campaignTrace(page);
  const resolutions = trace.filter(isSerializedEncounterResolution);
  const integrity = Number.parseInt(await text(page.locator("#integrity-value")), 10);
  const resolvedCount = await page.locator("#objective-checklist .complete").count();
  assert.ok(
    resolutions.length > 0,
    "The scheduled battle wave must serialize at least one exact breach or wave-cleared encounter resolution."
  );
  assert.ok(
    integrity < entryIntegrity || resolvedCount > resolvedCountBefore,
    "The public campaign surface must expose the serialized encounter resolution through integrity loss or a newly completed objective."
  );
  return Object.freeze({
    integrity,
    integrityDelta: entryIntegrity - integrity,
    outcome: resolutions[0].event.type,
    resolutionSequence: resolutions.map(({ event }) => ({
      type: event.type,
      stageId: event.stageId,
      waveId: event.waveId,
    })),
    trace: trace.map((event) => event.kind === "action" ? { kind: event.kind, action: event.action } : event.kind === "encounter" ? { kind: event.kind, event: event.event } : { kind: event.kind })
  });
}

async function materializeStageOneAllies(page, context, { remainingHunts = 2 } = {}) {
  await runActions(page, Array.from({ length: remainingHunts }, () => "#action-hunt"));
  await assertCurrentObjectiveCommand(page, "extract", `${context} after two Hunts`);
  await runActions(page, ["#action-extract", "#action-materialize"]);

  assert.equal(
    await text(page.locator("#legion-value")),
    "2 / 10",
    `${context} must legally materialize the first two public legion allies before the Scout wave arrives.`
  );
}

const STAGE_ONE_SCOUT_LABELS = Object.freeze({
  ko: "정찰 · 적 2명",
  en: "SCOUT · 2 HOSTILES",
});
const STAGE_ONE_ENCOUNTER_HUD = Object.freeze({
  ko: Object.freeze({
    preparation: Object.freeze({
      pressure: "준비 시간: 첫 번째 적 웨이브가 전장에 진입하기 전에 명령을 내리십시오.",
      waveIndicator: "전투 준비 · 웨이브 1/3 · 정찰",
    }),
    live: Object.freeze({
      pressure: "웨이브 진행 중: 적들이 전장을 가로지르는 동안 명령 패널을 활성화하십시오.",
      waveIndicator: "웨이브 진행 중 · 1/3 · 정찰",
    }),
  }),
  en: Object.freeze({
    preparation: Object.freeze({
      pressure: "Preparation window: issue commands before the first hostile wave enters the lane.",
      waveIndicator: "PREPARATION · WAVE 1/3 · SCOUT",
    }),
    live: Object.freeze({
      pressure: "Live-wave pressure: keep the command pad active while hostiles cross the lane.",
      waveIndicator: "LIVE WAVE · 1/3 · SCOUT",
    }),
  }),
});


async function awaitStageOneScoutEngagementBeforeBreach(page, context) {
  const traceBeforeScout = await campaignTrace(page);
  assert.equal(
    traceBeforeScout.some(isSerializedEncounterBreach),
    false,
    `${context} must not record a campaign breach before the inbound Stage 1 Scout wave reaches allied defenders.`
  );

  await page.waitForFunction(
    () => {
      const exchanges = Number(document.querySelector("#battle-field")?.dataset.exchanges);
      return Number.isInteger(exchanges) && exchanges > 0;
    },
    undefined,
    { polling: 20, timeout: STAGE_ONE_ENGAGEMENT_TIMEOUT_MS }
  );

  const counters = await page.locator("#battle-field").evaluate((field) => ({
    exchanges: Number(field.dataset.exchanges)
  }));
  assert.ok(
    counters.exchanges > 0,
    `${context} must observe cumulative opposing attack exchanges before a breach; reciprocal exchanges are emitted only by active opposing engagements and remain valid after a batched rAF update clears the map.`
  );

  const traceAfterExchange = await campaignTrace(page);
  assert.equal(
    traceAfterExchange.some(isSerializedScoutStart),
    true,
    `${context} must retain the exact Cinder Span Scout start in the public campaign trace even if the live hostile label has advanced.`
  );
  assert.equal(
    traceAfterExchange.some(isSerializedEncounterBreach),
    false,
    `${context} must record the Scout engagement and exchange before any campaign breach trace.`
  );
  return counters;
}

async function verifyCommandCooldown(page) {
  const hunt = page.locator("#action-hunt");
  assert.equal(await hunt.isEnabled(), true, "The Hunt command must remain enabled while battle presentation degrades.");
  const traceBeforeCooldownHunt = await campaignTrace(page);
  await clickEnabledAction(page, "#action-hunt", { assertCampaignSurface: false });
  const traceAfterCooldownHunt = await campaignTrace(page);
  assert.deepEqual(
    traceAfterCooldownHunt.slice(traceBeforeCooldownHunt.length),
    [{ kind: "action", action: "hunt" }],
    "The fallback cooldown Hunt must append exactly one final campaign action even when static battle pressure remains unchanged."
  );
  await hunt.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const command = document.querySelector("#action-hunt");
      return Boolean(command && !command.disabled);
    },
    undefined,
    { timeout: COMMAND_COOLDOWN_TIMEOUT_MS }
  );
}
const STAGE_ONE_BRIEFING_LOCALES = Object.freeze({
  ko: Object.freeze({
    htmlLang: "ko",
    languageToggle: Object.freeze({
      label: "EN",
      pressed: "false",
      ariaLabel: "English로 전환"
    }),
    role: "역할 · 황혼의 감시자로서 그림자 군단을 지휘하십시오.",
    playerJob: "그림자 군단을 지휘해 현재 목표를 완수하고, 관문 수호 내구도가 0에 이르지 않게 하며, 보스 신더 워든을 처치하십시오.",
    objective: "스테이지 1 목표 · 사냥 → 추출 → 실체화 → 점거로 제련소 거점을 장악하십시오.",
    nextOrder: "지금 1 또는 사냥을 눌러 첫 번째 균열 흔적을 찾으십시오.",
    operation: "작전: 잿불 돌파",
    doctrine: "제련소 길을 열고 그림자를 일으켜 워든의 지배를 끊으십시오.",
    boss: "신더 워든",
    commandLabels: Object.freeze(["사냥", "추출", "실체화", "점거"])
  }),
  en: Object.freeze({
    htmlLang: "en",
    languageToggle: Object.freeze({
      label: "한국어",
      pressed: "true",
      ariaLabel: "Switch to Korean"
    }),
    role: "Role · Command the Dusk Legion as the Twilight Watcher.",
    playerJob: "Command the Dusk Legion, complete the current objective, keep Gate ward integrity above zero, and defeat Cinder Warden.",
    objective: "Stage 1 objective · Hunt → Extract → Materialize → Capture the forge node.",
    nextOrder: "Now press 1 or Hunt to find the first rift spoor.",
    operation: "Operation: Ember Break",
    doctrine: "Open the forge lane, raise shades, then sever the Warden's hold.",
    boss: "Cinder Warden",
    commandLabels: Object.freeze(["Hunt", "Extract", "Materialize", "Capture"])
  })
});
const STAGE_ONE_FIRST_ORDERS = Object.freeze({
  ko: "첫 명령: 균열 흔적을 두 번 사냥하십시오.",
  en: "First order: Hunt two rift spoor.",
});
const REALTIME_SURFACE_LOCALES = Object.freeze({
  ko: Object.freeze({
    ariaLabel: "실시간 전술 전장",
    directHelp: "조작: WASD나 방향키로 이동, Shift로 돌진, 지면 클릭 또는 탭으로 소집, 드래그로 회전, 휠로 확대·축소합니다.",
  }),
  en: Object.freeze({
    ariaLabel: "Realtime tactical battlefield",
    directHelp: "Controls: move with WASD or arrows, dash with Shift, click or tap ground to rally, drag to rotate, and use the wheel to zoom.",
  }),
});
const STAGE_TRANSITION_BRIEFINGS = Object.freeze({
  2: Object.freeze({ number: 2, stageId: "veil-citadel" }),
  3: Object.freeze({ number: 3, stageId: "echo-throne" }),
  4: Object.freeze({ number: 4, stageId: "sunken-bastion" }),
});

async function assertCockpitCommandDock(page, context) {
  const structure = await page.locator("#command-panel").evaluate((panel) => {
    const battlefield = document.querySelector("#battle-field");
    const screen = document.querySelector("#campaign-screen");
    return {
      sharesCockpitScreen: Boolean(screen?.contains(battlefield) && screen.contains(panel)),
      nestedInsideBattlefield: battlefield?.contains(panel) ?? false,
    };
  });
  assert.equal(
    structure.sharesCockpitScreen,
    true,
    `${context} must retain both the tactical field and command panel in the active cockpit.`
  );
  assert.equal(
    structure.nestedInsideBattlefield,
    false,
    `${context} must keep the command panel outside the tactical field so its controls cannot be clipped by battlefield layering.`
  );
}

async function assertBriefingCommandGate(page, context) {
  await assertCockpitCommandDock(page, context);
  const gate = await page.locator("#command-panel").evaluate((panel) => {
    const commands = [...panel.querySelectorAll("[data-action]")];
    return {
      cockpitInert: Boolean(panel.closest("[inert]")),
      commandCount: commands.length,
      commandsDisabled: commands.every((command) => command instanceof HTMLButtonElement && command.disabled)
    };
  });
  assert.equal(gate.cockpitInert, true, `${context} must make the gameplay cockpit inert while the briefing is active.`);
  assert.ok(gate.commandCount > 0, `${context} must retain gameplay commands in the command dock.`);
  assert.equal(gate.commandsDisabled, true, `${context} must keep every gameplay command unavailable until combat is acknowledged.`);
}

async function assertStageTransitionBriefing(page, metadata, context) {
  const briefing = page.locator("#stage-briefing");
  await briefing.waitFor({ state: "visible" });

  const language = await page.locator("html").getAttribute("lang");
  const translations = await TRANSLATIONS_SOURCE_CONTRACT;
  const dictionary = translations[language];
  assert.ok(dictionary, `${context} requires a supported translation dictionary for html[lang=${String(language)}].`);
  const keys = Object.freeze({
    title: `stage.${metadata.stageId}.title`,
    region: `stage.${metadata.stageId}.region`,
    objective: `stage.${metadata.stageId}.objective`,
    boss: `stage.${metadata.stageId}.bossName`,
    operation: `presentation.${metadata.stageId}.operation`,
    doctrine: `presentation.${metadata.stageId}.doctrine`,
  });
  const copy = {};
  for (const [fact, key] of Object.entries(keys)) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(dictionary, key),
      true,
      `${context} ${language} dictionary must own the ${fact} key ${key}.`
    );
    assert.equal(
      typeof dictionary[key],
      "string",
      `${context} ${language} dictionary key ${key} must provide exact visible copy.`
    );
    copy[fact] = dictionary[key];
  }

  const expectedStage = `${language === "ko" ? "스테이지" : "Stage"} ${metadata.number} · ${copy.title}`;
  assert.equal(await text(page.locator("#briefing-stage")), expectedStage, `${context} must identify the localized next stage.`);
  assert.equal(await text(page.locator("#briefing-region")), copy.region, `${context} must state the localized next stage region.`);
  assert.equal(await text(page.locator("#briefing-objective")), copy.objective, `${context} must state the localized next stage objective.`);
  assert.equal(await text(page.locator("#briefing-operation")), copy.operation, `${context} must state the localized next stage operation.`);
  assert.equal(await text(page.locator("#briefing-doctrine")), copy.doctrine, `${context} must state the localized next stage doctrine.`);
  assert.equal(await text(page.locator("#briefing-boss")), copy.boss, `${context} must identify the localized next stage target.`);
  assert.equal(await page.locator("#start-combat").isEnabled(), true, `${context} must provide an enabled combat acknowledgement.`);
  await assertBriefingCommandGate(page, context);
}

async function acknowledgeStageBriefing(page, { stageNumber, firstOrder = null } = {}) {
  const activatedAt = Date.now();
  await page.locator("#start-combat").click();
  await page.locator("#stage-briefing").waitFor({ state: "hidden" });
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const hunt = document.querySelector("#action-hunt");
    const active = document.activeElement;
    return Boolean(
      hunt &&
      !hunt.disabled &&
      active instanceof HTMLElement &&
      active.matches("#command-panel [data-action]")
    );
  });
  assert.equal(await page.locator("#action-hunt").isEnabled(), true, `Acknowledging the Stage ${stageNumber} briefing must restore the standard command path.`);
  assert.equal(
    await page.locator("#command-panel").evaluate((panel) => {
      const active = document.activeElement;
      return active instanceof HTMLElement && panel.contains(active) && active.matches("[data-action]");
    }),
    true,
    `Acknowledging the Stage ${stageNumber} briefing must restore keyboard focus to a gameplay command.`
  );
  if (firstOrder) {
    assert.match(
      await text(page.locator("#campaign-status")),
      new RegExp(firstOrder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `Acknowledging the Stage ${stageNumber} briefing must expose the explicit first pending command.`
    );
  }
  return activatedAt;
}

async function assertStageOneBriefing(page, expectedLocale) {
  const briefing = page.locator("#stage-briefing");
  const locale = STAGE_ONE_BRIEFING_LOCALES[expectedLocale];
  const languageToggle = page.locator("#lang-toggle");
  const commandLabels = page.locator("#action-hunt strong, #action-extract strong, #action-materialize strong, #action-capture strong");
  assert.ok(locale, `Stage 1 briefing locale must be "ko" or "en"; received ${String(expectedLocale)}.`);
  await briefing.waitFor({ state: "visible" });

  assert.equal(await page.locator("html").getAttribute("lang"), locale.htmlLang, `The Stage 1 briefing must use the expected ${expectedLocale} locale.`);
  assert.equal(await text(languageToggle), locale.languageToggle.label, `The ${expectedLocale} Stage 1 briefing must expose the matching public language toggle.`);
  assert.equal(await languageToggle.getAttribute("aria-pressed"), locale.languageToggle.pressed, `The ${expectedLocale} Stage 1 briefing must expose the matching language-toggle state.`);
  assert.equal(await languageToggle.getAttribute("aria-label"), locale.languageToggle.ariaLabel, `The ${expectedLocale} Stage 1 briefing must expose the matching language-toggle label.`);
  assert.equal(
    await languageToggle.evaluate((toggle) => toggle.inert),
    true,
    `The ${expectedLocale} Stage 1 briefing must make the cockpit language toggle inert while the modal owns interaction.`
  );
  assert.equal(await text(briefing.locator(".commander-identity")), locale.role, `The ${expectedLocale} Stage 1 briefing must state the player's role.`);
  assert.equal(
    await text(page.locator("#briefing-player-job")),
    locale.playerJob,
    `The ${expectedLocale} Stage 1 briefing must tell the player to command the legion, finish the current objective, protect Gate ward integrity, and defeat the localized stage target.`,
  );
  assert.equal(await text(page.locator("#briefing-objective")), locale.objective, `The ${expectedLocale} Stage 1 briefing must state the four-command objective.`);
  assert.equal(await text(briefing.locator(".mission-briefing-next")), locale.nextOrder, `The ${expectedLocale} Stage 1 briefing must state the immediate first command.`);
  assert.equal(await text(page.locator("#briefing-operation")), locale.operation, `The ${expectedLocale} Stage 1 briefing must name the operation.`);
  assert.equal(await text(page.locator("#briefing-doctrine")), locale.doctrine, `The ${expectedLocale} Stage 1 briefing must state the doctrine.`);
  assert.deepEqual(await commandLabels.allTextContents(), locale.commandLabels, `The ${expectedLocale} Stage 1 briefing must retain the ordered Hunt, Extract, Materialize, and Capture command labels.`);
  assert.equal(await text(page.locator("#briefing-boss")), locale.boss, `The ${expectedLocale} Stage 1 briefing must identify the localized stage target.`);

  assert.equal(await page.locator("#start-combat").isEnabled(), true, "The Stage 1 briefing must provide an enabled combat acknowledgement.");
  await page.locator("#start-combat").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator("#start-combat").evaluate((button) => document.activeElement === button),
    true,
    "Tabbing from the briefing acknowledgement must remain trapped in the modal rather than reaching an inert cockpit control."
  );
  await assertBriefingCommandGate(page, `The ${expectedLocale} Stage 1 briefing`);
}
async function assertStageOneActiveCockpitLanguageTogglePreservesCampaignEnvelope(page) {
  const korean = STAGE_ONE_BRIEFING_LOCALES.ko;
  const english = STAGE_ONE_BRIEFING_LOCALES.en;
  const languageToggle = page.locator("#lang-toggle");
  const commandLabels = page.locator("#action-hunt strong, #action-extract strong, #action-materialize strong, #action-capture strong");
  const envelopeBeforeLocaleChange = await exportCampaignEnvelope(page);

  assert.equal(await page.locator("html").getAttribute("lang"), english.htmlLang, "Acknowledging the English Stage 1 briefing must return to an English active cockpit.");
  await languageToggle.click();
  await page.waitForFunction((lang) => document.documentElement.lang === lang, korean.htmlLang);
  await page.waitForFunction(
    (operation) => document.querySelector("#battle-operation")?.textContent?.trim() === operation,
    BATTLE_PRESENTATIONS[1].ko.operation
  );

  assert.equal(await text(page.locator("#battle-operation")), BATTLE_PRESENTATIONS[1].ko.operation, "The active Stage 1 cockpit language toggle must project the Korean battle operation.");
  assert.equal(await text(page.locator("#battle-doctrine")), BATTLE_PRESENTATIONS[1].ko.doctrine, "The active Stage 1 cockpit language toggle must project the Korean battle doctrine.");
  assert.deepEqual(await commandLabels.allTextContents(), korean.commandLabels, "The active Stage 1 cockpit language toggle must project the ordered Korean Hunt, Extract, Materialize, and Capture command labels.");
  assert.deepEqual(
    await exportCampaignEnvelope(page),
    envelopeBeforeLocaleChange,
    "The active-cockpit public language toggle must not mutate the parsed campaign save envelope."
  );
}


async function acknowledgeStageOneBriefing(page) {
  const lang = await page.locator("html").getAttribute("lang");
  assert.ok(
    Object.prototype.hasOwnProperty.call(STAGE_ONE_FIRST_ORDERS, lang),
    `Stage 1 briefing acknowledgement requires a supported document locale; received ${String(lang)}.`,
  );
  return acknowledgeStageBriefing(page, {
    stageNumber: 1,
    firstOrder: STAGE_ONE_FIRST_ORDERS[lang],
  });
}

async function startStageOneCampaign(page, { verifyBriefing = false, briefingLocale } = {}) {
  const acceptRestart = (dialog) => dialog.accept();
  page.once("dialog", acceptRestart);
  await page.waitForTimeout(50);
  await page.locator("#start-campaign").click();
  await page.locator("#campaign-screen").waitFor({ state: "visible" });
  if (verifyBriefing) await assertStageOneBriefing(page, briefingLocale);
  else await page.locator("#stage-briefing").waitFor({ state: "visible" });
  return acknowledgeStageOneBriefing(page);
}

async function verifyRealtimeThreeBattleOnly(browser, baseUrl) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let strictErrors;
  try {
    const page = await context.newPage();
    strictErrors = collectStrictClientErrors(page);
    const sourceGlbTrace = collectPageSourceGlbResponses(page);

    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");

    const canvas = page.locator("#battle-canvas-3d");
    await canvas.waitFor({ state: "visible" });
    await page.waitForFunction(
      () => document.querySelector("#battle-asset-status")?.dataset.state === "loaded",
      undefined,
      { timeout: 30_000 }
    );

    const lang = await page.locator("html").getAttribute("lang");
    const realtimeLocale = REALTIME_SURFACE_LOCALES[lang];
    assert.ok(realtimeLocale, `Realtime Stage 1 requires a supported document locale; received ${String(lang)}.`);
    const surface = await canvas.evaluate((element) => ({
      active: document.activeElement === element,
      ariaDescribedBy: element.getAttribute("aria-describedby"),
      ariaLabel: element.getAttribute("aria-label"),
      tabIndex: element.tabIndex,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      legacyTargetCount: document.querySelectorAll("#battle-pointer-controls, [data-battle-target]").length,
      fallbackVisible: document.querySelector("#battle-visual-fallback")?.checkVisibility(),
    }));
    assert.equal(surface.ariaLabel, realtimeLocale.ariaLabel, `Stage 1 must expose the ${lang} direct-control battlefield name.`);
    assert.equal(surface.ariaDescribedBy, "battle-direct-help", "Stage 1 must connect the battlefield to the public direct-control HUD.");
    assert.equal(surface.tabIndex, 0, "Stage 1 tactical battlefield must be keyboard-focusable.");
    assert.ok(surface.width > 0 && surface.height > 0, `Stage 1 direct-control canvas must have a visible surface; observed ${surface.width}×${surface.height}.`);
    assert.equal(surface.legacyTargetCount, 0, "The direct-control battlefield must replace legacy absolute battle-target buttons.");
    assert.notEqual(surface.fallbackVisible, true, "Stage 1 must keep the explicit fallback hidden while the WebGL renderer is ready.");
    assert.equal(
      await text(page.locator("#battle-direct-help")),
      realtimeLocale.directHelp,
      `Stage 1 must expose the exact ${lang} movement, camera, and rally instructions.`,
    );

    const assetStatus = await text(page.locator("#battle-asset-status"));
    assert.match(
      assetStatus,
      /^(?:Source GLB atlases 6\/6 · \d+ action clips active|GLB 소스 아틀라스 6\/6 · 동작 클립 \d+개 활성)$/,
      "The direct renderer must publicly report successful readiness for all six Stage 1 source GLBs."
    );
    assert.equal(await page.locator("#battle-asset-status").getAttribute("data-state"), "loaded", "The direct renderer must expose its loaded readiness state.");
    assert.deepEqual(
      sourceGlbTrace.records,
      STAGE_ONE_SOURCE_GLB_RESPONSES,
      "The local static HTTP server must serve each actual Stage 1 source GLB exactly once as a successful service-worker-backed glTF binary response."
    );

    const hotkeyTraceStart = (await campaignTrace(page)).length;
    await canvas.focus();
    assert.equal(
      await canvas.evaluate((element) => document.activeElement === element),
      true,
      "The tactical canvas must receive focus before direct keyboard control.",
    );
    await page.keyboard.press("Digit1");
    await page.waitForFunction(
      () => document.querySelector("#action-hunt") instanceof HTMLButtonElement
        && document.querySelector("#action-hunt").disabled,
      undefined,
      { timeout: 30_000 },
    );
    assert.deepEqual(
      (await campaignTrace(page)).slice(hotkeyTraceStart),
      [{ kind: "action", action: "hunt" }],
      "A focused direct tactical canvas must dispatch its unambiguous Hunt hotkey through the public campaign action flow.",
    );

    const actionCountBeforeMovement = (await campaignTrace(page)).length;
    await canvas.focus();
    const fieldBox = await canvas.boundingBox();
    assert.ok(fieldBox, "The direct tactical canvas must expose a pointer-operable bounding box.");
    const centerX = fieldBox.x + fieldBox.width / 2;
    const centerY = fieldBox.y + fieldBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + Math.min(80, fieldBox.width / 5), centerY + Math.min(50, fieldBox.height / 5), { steps: 8 });
    await page.mouse.up();
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(900);
    await page.keyboard.up("KeyD");
    assert.deepEqual(
      (await campaignTrace(page)).slice(actionCountBeforeMovement),
      [],
      "KeyD must retain direct commander-movement ownership instead of dispatching a Domain action from the focused canvas.",
    );

    const beforeAction = await campaignSurface(page);
    await materializeStageOneAllies(page, "Focused real-time Three Stage 1 battle", { remainingHunts: 1 });
    assert.notDeepEqual(
      await campaignSurface(page),
      beforeAction,
      "Semantic commands must remain operable after direct tactical canvas control changes the live presentation."
    );
    assert.equal(
      await page.locator("#battle-asset-status").getAttribute("data-state"),
      "loaded",
      "Semantic commands must preserve the direct renderer readiness state."
    );
    console.log(`PLAYTEST_BROWSER_REALTIME_GLB_RESPONSES ${JSON.stringify(sourceGlbTrace.records)}`);
    assertObservedSourceGlbPaths(sourceGlbTrace, STAGE_ONE_SOURCE_GLB_PATHS, "Focused real-time Three Stage 1 battle");
    assertNoStrictClientErrors(strictErrors, "Focused real-time Three Stage 1 battle");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}

async function verifyResumeRendering(browser, baseUrl) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
  });
  let strictErrors;
  try {
    await context.addInitScript(() => {
      window.__battleWebglDrawCalls = 0;
      for (const contextName of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const Context = window[contextName];
        if (!Context) continue;
        for (const methodName of ["drawArrays", "drawElements"]) {
          const nativeDraw = Context.prototype[methodName];
          if (typeof nativeDraw !== "function") continue;
          Context.prototype[methodName] = function auditedDraw(...args) {
            if (this.canvas?.id === "battle-canvas-3d") {
              window.__battleWebglDrawCalls += 1;
            }
            return nativeDraw.apply(this, args);
          };
        }
      }
    });

    const page = await context.newPage();
    strictErrors = collectStrictClientErrors(page, {
      allowExpectedBgmAborts: true,
      echoConsole: false,
    });
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");
    await assertDirectSourceGlbReadiness(page);
    await page.waitForFunction(() => window.__battleWebglDrawCalls > 0, undefined, { timeout: 30_000 });
    const preReloadDraws = await page.evaluate(() => window.__battleWebglDrawCalls);
    assert.ok(preReloadDraws > 0, `The initial Stage 1 WebGL renderer must submit draw calls; observed ${preReloadDraws}.`);

    await page.locator("#action-hunt").scrollIntoViewIfNeeded();
    await clickEnabledAction(page, "#action-hunt");
    const beforeReloadTrace = await campaignTrace(page);
    assert.equal(
      beforeReloadTrace.filter((event) => event?.kind === "action" && event.action === "hunt").length,
      1,
      "The pre-reload campaign must persist exactly one accepted Hunt action.",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await page.locator("#resume-campaign").waitFor({ state: "visible" });
    await page.locator("#resume-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#battle-field").waitFor({ state: "visible" });
    await page.locator("#battle-canvas-3d").waitFor({ state: "visible" });
    await assertDirectSourceGlbReadiness(page);
    await page.waitForFunction(() => window.__battleWebglDrawCalls > 0, undefined, { timeout: 30_000 });

    const postResumeDraws = await page.evaluate(() => window.__battleWebglDrawCalls);
    assert.ok(postResumeDraws > 0, `The resumed Stage 1 WebGL renderer must submit draw calls; observed ${postResumeDraws}.`);
    assert.equal(
      await page.locator("#battle-visual-fallback").isHidden(),
      true,
      "A successfully resumed direct renderer must keep the Canvas fallback hidden.",
    );
    assert.equal(
      await page.locator("#battle-asset-status").getAttribute("data-state"),
      "loaded",
      "A successfully resumed direct renderer must retain loaded asset status.",
    );
    const resumedTrace = await campaignTrace(page);
    assert.equal(
      resumedTrace.filter((event) => event?.kind === "action" && event.action === "hunt").length,
      1,
      "Reload and Resume must restore the persisted Hunt transition exactly once.",
    );
    assertNoStrictClientErrors(strictErrors, "390×844 reload and Resume rendering");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}

async function configureStageRailScrollAudit(context) {
  await context.addInitScript(() => {
    const calls = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(...args) {
      if (this instanceof HTMLElement && this.id.startsWith("stage-select-")) {
        calls.push({ id: this.id, ariaCurrent: this.getAttribute("aria-current") });
      }
      return originalScrollIntoView?.apply(this, args);
    };
    Object.defineProperty(window, "__stageRailScrollAudit", {
      configurable: false,
      value: {
        calls: () => calls.slice(),
        reset: () => { calls.length = 0; },
      },
    });
  });
}

async function assertStageRailScrollCalls(page, expected, context) {
  assert.deepEqual(
    await page.evaluate(() => window.__stageRailScrollAudit.calls()),
    expected,
    `${context} must scroll the active stage selector once while preserving its aria-current state.`,
  );
}

async function verifyTransitionDrivenStageRailScrolling(browser, baseUrl) {
  const fixtures = await createCampaignFixtures();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let strictErrors;
  try {
    await configureStageRailScrollAudit(context);
    const page = await context.newPage();
    strictErrors = collectStrictClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await page.evaluate(() => window.__stageRailScrollAudit.reset());

    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");
    await page.waitForTimeout(1_200);
    await assertStageRailScrollCalls(
      page,
      [{ id: "stage-select-1", ariaCurrent: "step" }],
      "Repeated Stage 1 cooldown renders",
    );

    await page.evaluate(() => window.__stageRailScrollAudit.reset());
    await importCampaignEnvelope(page, fixtures.reward, "abyssal-surge-stage-rail-reward.json");
    await page.locator("#reward-panel").waitFor({ state: "visible" });
    await chooseRewardAndAdvance(page, "rift-lens", 2, "Veil Citadel");
    await page.locator("#battle-canvas-3d").waitFor({ state: "visible" });
    await page.waitForTimeout(1_200);
    await assertStageRailScrollCalls(
      page,
      [{ id: "stage-select-2", ariaCurrent: "step" }],
      "The public Stage 1 reward-to-Stage 2 transition",
    );
    assertNoStrictClientErrors(strictErrors, "Transition-driven stage rail scrolling");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}

async function verifyFallbackCanvasTargetParity(browser, baseUrl) {
  const fixtures = await createCampaignFixtures();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let clientErrors;
  try {
    await configureBattleParityContext(context, { failCanvas: true });
    const page = await context.newPage();
    clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");
    await page.locator("#battle-canvas-fallback").waitFor({ state: "visible" });

    await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract"]);
    await waitForActionEnabledAndReachable(page, "#action-materialize");
    await clickFallbackSemanticAction(page, "materialize", "The legal Stage 1 portal target");
    assert.equal(await text(page.locator("#legion-value")), "2 / 10", "A legal fallback portal click must field the first public legion.");

    await waitForActionEnabledAndReachable(page, "#action-capture");
    await clickFallbackSemanticAction(page, "capture", "The legal Stage 1 node target");
    assert.equal(await text(page.locator("#nodes-value")), "1 / 1", "A legal fallback node click must claim the public node.");

    const traceBeforeHiddenBoss = await campaignTrace(page);
    await clickFallbackCanvasPoint(page, await fallbackCanvasActionPoint(page, "assault"), "The hidden Stage 1 boss target");
    await page.waitForTimeout(150);
    assert.deepEqual(
      await campaignTrace(page),
      traceBeforeHiddenBoss,
      "A fallback boss click before exposure must not append a false Assault action.",
    );

    const portal = await fallbackCanvasActionPoint(page, "materialize");
    await page.mouse.move(portal.x - 28, portal.y - 28);
    await page.mouse.down();
    await page.mouse.move(portal.x + 28, portal.y + 28, { steps: 4 });
    await page.mouse.up();
    const traceBeforeGroundMove = await campaignTrace(page);
    await clickFallbackCanvasWorldPoint(page, { x: 3, y: 2 }, "A selected ally's non-target fallback ground point");
    await page.waitForTimeout(150);
    assert.deepEqual(
      await campaignTrace(page),
      traceBeforeGroundMove,
      "A selected ally's non-target fallback ground click must preserve the presentation-only move path without a false campaign action.",
    );

    await importCampaignEnvelope(page, fixtures.exposed, "abyssal-surge-exposed-boss.json");
    await page.locator("#battle-canvas-fallback").waitFor({ state: "visible" });
    await waitForActionEnabledAndReachable(page, "#action-assault");
    await clickFallbackSemanticAction(page, "assault", "The exposed and available Stage 1 boss target");
    assert.equal(await text(page.locator("#boss-value")), "5 / 8", "The legal exposed fallback boss click must damage public boss health.");
    assertNoClientErrors(clientErrors, "Fallback semantic target parity");
  } finally {
    await context.close();
  }
}

async function verifyGlbCanvasBridgeOnly(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    });
    const page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await startStageOneCampaign(page);

    await enterBattle(page, 1, "Cinder Span");
    await assertDirectSourceGlbReadiness(page);

    await clickEnabledAction(page, "#action-hunt");
    assert.equal(
      await page.locator("#battle-asset-status").getAttribute("data-state"),
      "loaded",
      "The source-atlas status must remain ready after a public battle command."
    );
    assertNoClientErrors(clientErrors, "GLB Canvas bridge-only battle");
  } finally {
    await context.close();
  }
}

async function assertCompactStageOneBriefing(page) {
  const surface = await page.evaluate(() => {
    const playerJob = document.querySelector("#briefing-player-job");
    const startCombat = document.querySelector("#start-combat");
    const visibleAndInBounds = (element) => {
      const rect = element?.getBoundingClientRect();
      const style = element && getComputedStyle(element);
      return Boolean(
        rect
        && rect.width > 0
        && rect.height > 0
        && style?.display !== "none"
        && style?.visibility !== "hidden"
        && rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight,
      );
    };
    return {
      playerJob: {
        text: playerJob?.textContent?.trim() ?? "",
        visibleAndInBounds: visibleAndInBounds(playerJob),
      },
      startCombat: {
        text: startCombat?.textContent?.trim() ?? "",
        visibleAndInBounds: visibleAndInBounds(startCombat),
      },
      horizontalOverflow: {
        documentElement: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        viewport: window.innerWidth,
      },
    };
  });

  assert.ok(
    surface.horizontalOverflow.documentElement <= surface.horizontalOverflow.viewport
      && surface.horizontalOverflow.body <= surface.horizontalOverflow.viewport,
    `At 320×568, the Stage 1 briefing must not overflow horizontally; document=${surface.horizontalOverflow.documentElement}, body=${surface.horizontalOverflow.body}, viewport=${surface.horizontalOverflow.viewport}.`,
  );
  assert.notEqual(surface.playerJob.text, "", "At 320×568, the Stage 1 briefing must state the player's complete job before combat.");
  assert.equal(surface.playerJob.visibleAndInBounds, true, "At 320×568, the Stage 1 player-job sentence must remain visible and fully in bounds before combat.");
  assert.notEqual(surface.startCombat.text, "", "At 320×568, the Stage 1 briefing must retain a Start battle acknowledgement.");
  assert.equal(surface.startCombat.visibleAndInBounds, true, "At 320×568, the Start battle acknowledgement must remain visible and fully in bounds.");
}
async function verifyCompactLobbyCampaignMap(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    const surface = await page.evaluate(() => {
      const section = document.querySelector(".campaign-map-section");
      const heading = section?.querySelector("h3");
      const hint = section?.querySelector(".hint");
      const firstCard = section?.querySelector(".map-node");
      const rail = section?.querySelector(".campaign-map-grid");
      const describe = (element) => {
        const rect = element?.getBoundingClientRect();
        return {
          present: Boolean(rect && rect.width > 0 && rect.height > 0),
          rect: rect && {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          },
        };
      };
      const elements = {
        heading: describe(heading),
        hint: describe(hint),
        firstCard: describe(firstCard),
      };
      const intersections = [];
      const entries = Object.entries(elements);
      for (let index = 0; index < entries.length; index += 1) {
        const [name, first] = entries[index];
        for (const [otherName, second] of entries.slice(index + 1)) {
          if (
            first.rect
            && second.rect
            && first.rect.left < second.rect.right
            && first.rect.right > second.rect.left
            && first.rect.top < second.rect.bottom
            && first.rect.bottom > second.rect.top
          ) {
            intersections.push(`${name}/${otherName}`);
          }
        }
      }
      const railStyle = rail && getComputedStyle(rail);
      return {
        elements,
        intersections,
        railScrollable: Boolean(rail && rail.scrollWidth > rail.clientWidth),
        railOverflowX: railStyle?.overflowX ?? "",
        documentScrollable: document.documentElement.scrollHeight > window.innerHeight,
        horizontalOverflow: {
          documentElement: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          viewport: window.innerWidth,
        },
      };
    });

    for (const [name, element] of Object.entries(surface.elements)) {
      assert.equal(element.present, true, `At 390×844, the campaign map ${name} must remain normal rendered content.`);
    }
    assert.deepEqual(
      surface.intersections,
      [],
      `At 390×844, campaign map heading, hint, and first card must not overlap; intersections=${surface.intersections.join(",") || "none"}.`,
    );
    assert.equal(surface.documentScrollable, true, "At 390×844, the campaign lobby must remain normal vertically scrollable content.");
    assert.ok(
      ["auto", "scroll"].includes(surface.railOverflowX) && surface.railScrollable,
      `At 390×844, the campaign map rail must remain horizontally scrollable; overflow-x=${surface.railOverflowX}, scrollable=${surface.railScrollable}.`,
    );
    assert.ok(
      surface.horizontalOverflow.documentElement <= surface.horizontalOverflow.viewport
        && surface.horizontalOverflow.body <= surface.horizontalOverflow.viewport,
      `At 390×844, campaign-map content must not create document horizontal overflow; document=${surface.horizontalOverflow.documentElement}, body=${surface.horizontalOverflow.body}, viewport=${surface.horizontalOverflow.viewport}.`,
    );
  } finally {
    await context.close();
  }
}


async function verifyCompactControlJourney(browser, baseUrl) {
  await verifyCompactLobbyCampaignMap(browser, baseUrl);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 320, height: 568 } });
  let strictErrors;
  try {
    const page = await context.newPage();
    strictErrors = collectStrictClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    const acceptRestart = (dialog) => dialog.accept();
    page.once("dialog", acceptRestart);
    await page.waitForTimeout(50);
    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#stage-briefing").waitFor({ state: "visible" });
    await assertCompactStageOneBriefing(page);
    await acknowledgeStageOneBriefing(page);
    await enterBattle(page, 1, "Cinder Span");

    const canvas = page.locator("#battle-canvas-3d");
    await canvas.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#battle-asset-status")?.dataset.state === "loaded", undefined, { timeout: 30_000 });
    const stageSelector = page.locator("#stage-selector");
    await stageSelector.waitFor({ state: "hidden" });
    const initialCompactLayout = await page.evaluate(() => {
      const canvasElement = document.querySelector("#battle-canvas-3d");
      const selectorElement = document.querySelector("#stage-selector");
      const stageNumber = document.querySelector("#stage-number");
      const canvasRect = canvasElement?.getBoundingClientRect();
      const stageNumberRect = stageNumber?.getBoundingClientRect();
      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        canvasFitsViewport: Boolean(
          canvasRect
          && canvasRect.left >= 0
          && canvasRect.top >= 0
          && canvasRect.right <= window.innerWidth
          && canvasRect.bottom <= window.innerHeight,
        ),
        selectorHidden: selectorElement ? getComputedStyle(selectorElement).display === "none" : false,
        stageIdentity: stageNumber?.textContent?.trim() ?? "",
        stageIdentityRendered: Boolean(stageNumberRect && stageNumberRect.width > 0 && stageNumberRect.height > 0),
      };
    });
    assert.ok(
      initialCompactLayout.documentScrollWidth <= initialCompactLayout.viewportWidth
        && initialCompactLayout.bodyScrollWidth <= initialCompactLayout.viewportWidth,
      `At 320×568, the document and body must not overflow horizontally; observed document=${initialCompactLayout.documentScrollWidth}, body=${initialCompactLayout.bodyScrollWidth}, viewport=${initialCompactLayout.viewportWidth}.`,
    );
    assert.equal(
      initialCompactLayout.canvasFitsViewport,
      true,
      "At 320×568 before scrolling, the complete battlefield canvas must fit inside the viewport.",
    );
    assert.equal(
      initialCompactLayout.selectorHidden,
      true,
      "At 320×568, the ten-stage selector must be hidden so it cannot displace the realtime field.",
    );
    assert.notEqual(initialCompactLayout.stageIdentity, "", "Compact combat must retain the current stage identity without the selector rail.");
    assert.equal(initialCompactLayout.stageIdentityRendered, true, "Compact combat must visibly render the current stage identity.");
    const canvasCenterTarget = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.id ?? null;
    });
    assert.equal(
      canvasCenterTarget,
      "battle-canvas-3d",
      "At 320×568, the direct battlefield center must remain owned by its canvas rather than the command panel.",
    );

    const commandPanel = page.locator("#command-panel");
    await commandPanel.scrollIntoViewIfNeeded();
    const commandReachability = await commandPanel.evaluate((panel) => {
      const action = panel.querySelector("#action-hunt");
      const panelRect = panel.getBoundingClientRect();
      const actionRect = action?.getBoundingClientRect();
      const centerTarget = actionRect && document.elementFromPoint(actionRect.left + actionRect.width / 2, actionRect.top + actionRect.height / 2);
      return {
        panelVisible: panelRect.bottom > 0 && panelRect.top < window.innerHeight,
        huntVisible: Boolean(actionRect && actionRect.bottom > 0 && actionRect.top < window.innerHeight),
        huntOwnsCenter: Boolean(action && centerTarget && action.contains(centerTarget)),
      };
    });
    assert.deepEqual(
      commandReachability,
      { panelVisible: true, huntVisible: true, huntOwnsCenter: true },
      "At 320×568, scrolling must leave the command panel and its Hunt control visibly reachable.",
    );

    const returnToLobby = page.locator("#return-to-lobby");
    await returnToLobby.focus();
    assert.equal(
      await returnToLobby.evaluate((button) => document.activeElement === button),
      true,
      "The Return to Lobby button must receive focus before its single-key guard is exercised.",
    );
    const traceBeforeButtonHotkey = await campaignTrace(page);
    const surfaceBeforeButtonHotkey = await campaignSurface(page);
    const huntEnabledBeforeButtonHotkey = await page.locator("#action-hunt").isEnabled();
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(150);
    assert.deepEqual(await campaignTrace(page), traceBeforeButtonHotkey, "Focused Return to Lobby must block 1 from dispatching a campaign action.");
    assert.deepEqual(await campaignSurface(page), surfaceBeforeButtonHotkey, "Focused Return to Lobby must preserve public campaign status.");
    assert.equal(await page.locator("#action-hunt").isEnabled(), huntEnabledBeforeButtonHotkey, "Focused Return to Lobby must preserve command availability.");
    const languageToggle = page.locator("#lang-toggle");
    await languageToggle.waitFor({ state: "visible" });
    await languageToggle.focus();
    assert.equal(
      await languageToggle.evaluate((button) => document.activeElement === button),
      true,
      "The visible compact language toggle must receive focus before its single-key guard is exercised.",
    );
    const traceBeforeLanguageHotkey = await campaignTrace(page);
    const surfaceBeforeLanguageHotkey = await campaignSurface(page);
    const huntEnabledBeforeLanguageHotkey = await page.locator("#action-hunt").isEnabled();
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(150);
    assert.deepEqual(await campaignTrace(page), traceBeforeLanguageHotkey, "Focused compact language toggle must block 1 from dispatching a campaign action.");
    assert.deepEqual(await campaignSurface(page), surfaceBeforeLanguageHotkey, "Focused compact language toggle must preserve public campaign status.");
    assert.equal(await page.locator("#action-hunt").isEnabled(), huntEnabledBeforeLanguageHotkey, "Focused compact language toggle must preserve command availability.");

    const traceStart = (await campaignTrace(page)).length;
    await canvas.focus();
    assert.equal(
      await canvas.evaluate((element) => document.activeElement === element),
      true,
      "The direct battlefield must receive focus before its 1 action-hotkey is exercised.",
    );
    await page.keyboard.press("Digit1");
    await page.waitForFunction(() => document.querySelector("#action-hunt") instanceof HTMLButtonElement && document.querySelector("#action-hunt").disabled);
    assert.deepEqual(
      (await campaignTrace(page)).slice(traceStart),
      [{ kind: "action", action: "hunt" }],
      "Focused direct canvas must retain 1 campaign-action dispatch at 320×568.",
    );
    assertNoStrictClientErrors(strictErrors, "Compact control journey");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}

async function startP2StageOne(page) {
  const acceptRestart = (dialog) => dialog.accept();
  page.once("dialog", acceptRestart);
  await page.waitForTimeout(50);
  await page.locator("#start-campaign").click();
  await page.locator("#campaign-screen").waitFor({ state: "visible" });
  await page.locator("#stage-briefing").waitFor({ state: "visible" });
  await page.locator("#start-combat").click();
  await page.locator("#stage-briefing").waitFor({ state: "hidden" });
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.locator("#command-panel").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const current = document.querySelector('#command-panel [data-action][aria-current="step"]');
    return current instanceof HTMLButtonElement && !current.disabled;
  });
}

async function openFreshStageOneFieldOverlay(context, baseUrl, observePage = null) {
  const page = await context.newPage();
  observePage?.(page);
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await waitForCampaignBoot(page);
  await startP2StageOne(page);
  await page.locator(".ashen-field-command").waitFor({ state: "attached" });
  await page.locator("#battle-canvas-3d").waitFor({ state: "visible" });
  await page.waitForFunction(() => (
    document.querySelector(".ashen-field-command__tactical-status")?.textContent?.trim().length > 0
  ));
  return page;
}

async function inspectCompactFieldOverlay(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector(".ashen-field-command");
    const canvasCandidates = [
      document.querySelector("#battle-canvas-3d"),
      document.querySelector("#battle-canvas-fallback"),
    ];
    const fieldTacticalSelection = document.querySelector(".ashen-field-command__tactical-selection");
    const fieldTacticalStatus = document.querySelector(".ashen-field-command__tactical-status");
    const commandPanel = document.querySelector("#command-panel");
    const commandControls = [...document.querySelectorAll("#command-panel [data-action]")];
    const saveDock = document.querySelector("#save-dock");
    const saveControls = [
      document.querySelector("#export-save"),
      document.querySelector('label[for="import-save"]'),
    ].filter(Boolean);
    const isRendered = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    };
    const canvas = canvasCandidates.find(isRendered) ?? null;

    canvas?.scrollIntoView({ block: "center", inline: "nearest" });
    const canvasRect = canvas?.getBoundingClientRect();
    const samplePoints = canvasRect
      ? [
          [0.25, 0.25],
          [0.5, 0.25],
          [0.75, 0.25],
          [0.25, 0.5],
          [0.5, 0.5],
          [0.75, 0.5],
          [0.25, 0.75],
          [0.5, 0.75],
          [0.75, 0.75],
        ].map(([xRatio, yRatio]) => ({
          x: canvasRect.left + canvasRect.width * xRatio,
          y: canvasRect.top + canvasRect.height * yRatio,
        })).filter(({ x, y }) => x >= 0 && x < innerWidth && y >= 0 && y < innerHeight)
      : [];
    const sampledOwners = samplePoints.map(({ x, y }) => document.elementFromPoint(x, y));
    const overlayBounds = overlay?.getBoundingClientRect();
    const overlayStyle = overlay && getComputedStyle(overlay);

    const controls = commandControls.map((control) => {
      control.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = control.getBoundingClientRect();
      const owner = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        action: control.dataset.action ?? "",
        text: control.textContent?.trim() ?? "",
        rendered: isRendered(control),
        ownsCenter: control === owner || control.contains(owner),
      };
    });
    const saveTargets = saveControls.map((control) => {
      control.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = control.getBoundingClientRect();
      const owner = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        id: control.id || control.getAttribute("for") || "",
        text: control.textContent?.trim() ?? "",
        rendered: isRendered(control),
        width: rect.width,
        height: rect.height,
        ownsCenter: control === owner || control.contains(owner),
        centerOwnerSaveDock: owner?.closest("#save-dock") === saveDock,
        belongsToBattlefield: Boolean(control.closest("#battle-field")),
        belongsToCommandPanel: Boolean(control.closest("#command-panel")),
      };
    });

    return {
      overlayPresent: Boolean(overlay),
      overlayDisplay: overlayStyle?.display ?? null,
      overlayWidth: overlayBounds?.width ?? 0,
      overlayHeight: overlayBounds?.height ?? 0,
      overlayCanvasHitCount: sampledOwners.filter((owner) => overlay && (owner === overlay || overlay.contains(owner))).length,
      canvasId: canvas?.id ?? null,
      canvasRendered: isRendered(canvas),
      canvasSampleCount: sampledOwners.length,
      canvasOwnsEverySample: sampledOwners.every((owner) => owner === canvas),
      canvasWithinViewportWidth: Boolean(
        canvasRect
        && canvasRect.left >= 0
        && canvasRect.right <= innerWidth,
      ),
      fieldTacticalRendered: isRendered(document.querySelector(".ashen-field-command__tactical")),
      fieldTacticalSelectionText: fieldTacticalSelection?.textContent?.trim() ?? "",
      fieldTacticalStatusText: fieldTacticalStatus?.textContent?.trim() ?? "",
      commandPanelRendered: isRendered(commandPanel),
      controls,
      saveDockRendered: isRendered(saveDock),
      saveTargets,
      horizontalOverflow: {
        documentElement: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        viewport: innerWidth,
      },
    };
  });
}

function assertCompactSaveControls(surface, context) {
  assert.equal(surface.saveDockRendered, true, `${context} must keep the save dock rendered during active play.`);
  assert.deepEqual(
    surface.saveTargets.map(({ id }) => id),
    ["export-save", "import-save"],
    `${context} must expose both export and import hit targets.`,
  );
  for (const target of surface.saveTargets) {
    assert.notEqual(target.text, "", `${context} ${target.id} must retain visible control copy.`);
    assert.equal(target.rendered, true, `${context} ${target.id} must remain visibly rendered during active play.`);
    assert.ok(target.width > 0 && target.height > 0, `${context} ${target.id} must expose a non-zero hit target.`);
    assert.equal(target.ownsCenter, true, `${context} ${target.id} must own its center hit-test point.`);
    assert.equal(target.centerOwnerSaveDock, true, `${context} ${target.id} center hit must remain owned by the save dock.`);
    assert.equal(target.belongsToBattlefield, false, `${context} ${target.id} must remain outside tactical-canvas ownership.`);
    assert.equal(target.belongsToCommandPanel, false, `${context} ${target.id} must remain outside command-panel ownership.`);
  }
}

function assertCompactFieldOverlaySurface(surface, context, { expectedCanvasId = "battle-canvas-3d" } = {}) {
  assert.equal(surface.overlayPresent, true, `${context} must retain the overlay DOM for compatibility.`);
  assert.notEqual(surface.overlayDisplay, "none", `${context} must keep the field command overlay rendered at compact widths.`);
  assert.ok(
    surface.overlayWidth > 0 && surface.overlayHeight > 0,
    `${context} the rendered overlay must occupy visible area.`,
  );
  assert.equal(
    surface.overlayCanvasHitCount,
    0,
    `${context} the pointer-events:none overlay must not intercept any sampled active-canvas point.`,
  );
  assert.equal(surface.canvasId, expectedCanvasId, `${context} must activate the expected battle canvas.`);
  assert.equal(surface.canvasRendered, true, `${context} must render its active tactical canvas.`);
  assert.ok(surface.canvasSampleCount > 0, `${context} must expose viewport canvas points for hit-testing.`);
  assert.equal(
    surface.canvasOwnsEverySample,
    true,
    `${context} sampled tactical-canvas points must remain owned by #${surface.canvasId}.`,
  );
  assert.equal(
    surface.canvasWithinViewportWidth,
    true,
    `${context} active canvas must fit the 360px viewport width.`,
  );
  assert.equal(surface.fieldTacticalRendered, true, `${context} must keep the compact tactical readout rendered.`);
  assert.notEqual(surface.fieldTacticalStatusText, "", `${context} must expose the current battlefield status via the compact tactical readout.`);
  assert.equal(surface.commandPanelRendered, true, `${context} must keep the command panel rendered.`);
  assert.equal(surface.controls.length, 7, `${context} must retain all seven campaign command controls.`);
  for (const control of surface.controls) {
    assert.notEqual(control.action, "", `${context} each command must retain its action identity.`);
    assert.notEqual(control.text, "", `${context} ${control.action} must retain visible command copy.`);
    assert.equal(control.rendered, true, `${context} ${control.action} must remain rendered and reachable.`);
    assert.equal(control.ownsCenter, true, `${context} ${control.action} must own its center hit-test point.`);
  }
  assertCompactSaveControls(surface, context);
  assert.ok(
    surface.horizontalOverflow.documentElement <= surface.horizontalOverflow.viewport
      && surface.horizontalOverflow.body <= surface.horizontalOverflow.viewport,
    `${context} must not cause document horizontal overflow; documentElement=${surface.horizontalOverflow.documentElement}, body=${surface.horizontalOverflow.body}, viewport=${surface.horizontalOverflow.viewport}.`,
  );
}

async function verifyCompactFieldOverlay(browser, baseUrl) {
  const standardContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  let strictErrors;
  try {
    const page = await openFreshStageOneFieldOverlay(standardContext, baseUrl, (freshPage) => {
      strictErrors = collectStrictClientErrors(freshPage);
    });
    const surface = await inspectCompactFieldOverlay(page);
    assertCompactFieldOverlaySurface(surface, "Fresh 360px Stage 1 compact field overlay");
    assertNoStrictClientErrors(strictErrors, "Fresh 360px Stage 1 compact field overlay");
  } finally {
    strictErrors?.beginTeardown();
    await standardContext.close();
  }

  const reducedMotionContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 360, height: 800 },
  });
  let reducedStrictErrors;
  try {
    await configureBattleParityContext(reducedMotionContext, { auditAnimationFrames: true });
    const page = await reducedMotionContext.newPage();
    reducedStrictErrors = collectStrictClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await page.evaluate(() => window.__battleAnimationAudit.begin());
    await startP2StageOne(page);
    await page.locator(".ashen-field-command").waitFor({ state: "attached" });
    await page.locator("#battle-canvas-fallback").waitFor({ state: "visible" });
    await page.waitForTimeout(350);
    const animationRequests = await page.evaluate(() => window.__battleAnimationAudit.end());
    await page.waitForFunction(() => (
      document.querySelector(".ashen-field-command__tactical-status")?.textContent?.trim().length > 0
    ));
    const surface = await inspectCompactFieldOverlay(page);

    assertCompactFieldOverlaySurface(
      surface,
      "Reduced-motion fresh 360px Stage 1 compact field overlay",
      { expectedCanvasId: "battle-canvas-fallback" },
    );
    assert.ok(
      animationRequests <= 1,
      `Reduced-motion compact field overlay must not schedule a continuous animation-frame loop; observed ${animationRequests} request(s).`,
    );
    assertNoStrictClientErrors(reducedStrictErrors, "Reduced-motion compact field overlay");
  } finally {
    reducedStrictErrors?.beginTeardown();
    await reducedMotionContext.close();
  }
}

async function verifyMobileSaveControls(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  let strictErrors;
  try {
    const page = await openFreshStageOneFieldOverlay(context, baseUrl, (freshPage) => {
      strictErrors = collectStrictClientErrors(freshPage);
    });
    const surface = await inspectCompactFieldOverlay(page);
    assertCompactSaveControls(surface, "Focused 360px active-play save controls");
    assertNoStrictClientErrors(strictErrors, "Focused 360px active-play save controls");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}

async function verifyDesktopReadability(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    if (await page.locator("html").getAttribute("lang") !== "en") {
      await page.locator("#lang-toggle").click();
      await page.waitForFunction(() => document.documentElement.lang === "en");
    }
    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });

    const skipLink = page.locator(".skip-link");
    await skipLink.focus();
    const surface = await page.evaluate(() => {
      const describeText = (element) => ({
        text: element?.textContent?.trim() ?? "",
        rendered: Boolean(element && element.getClientRects().length > 0),
        clientWidth: element?.clientWidth ?? 0,
        clientHeight: element?.clientHeight ?? 0,
        scrollWidth: element?.scrollWidth ?? 0,
        scrollHeight: element?.scrollHeight ?? 0,
      });
      const panel = document.querySelector("#command-panel");
      const panelRect = panel?.getBoundingClientRect();
      const commands = [...(panel?.querySelectorAll("button[data-action]") ?? [])].map((button) => {
        const rect = button.getBoundingClientRect();
        const centerTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          id: button.id,
          insidePanel: Boolean(
            panelRect
            && rect.left >= panelRect.left - 0.5
            && rect.top >= panelRect.top - 0.5
            && rect.right <= panelRect.right + 0.5
            && rect.bottom <= panelRect.bottom + 0.5
          ),
          ownsCenter: Boolean(centerTarget && button.contains(centerTarget)),
        };
      });
      const skip = document.querySelector(".skip-link");
      const skipRect = skip?.getBoundingClientRect();
      return {
        objective: describeText(document.querySelector(".ashen-field-command__objective")),
        resources: [...document.querySelectorAll(".battle-resource-bar dt")].map(describeText),
        panel: {
          rendered: Boolean(panel && panel.getClientRects().length > 0),
          clientWidth: panel?.clientWidth ?? 0,
          clientHeight: panel?.clientHeight ?? 0,
          scrollWidth: panel?.scrollWidth ?? 0,
          scrollHeight: panel?.scrollHeight ?? 0,
          commands,
        },
        skipLink: {
          focused: document.activeElement === skip,
          width: skipRect?.width ?? 0,
          height: skipRect?.height ?? 0,
        },
      };
    });

    assert.notEqual(surface.objective.text, "", "At 1440×900, the current field objective must expose readable text.");
    assert.equal(surface.objective.rendered, true, "At 1440×900, the current field objective must remain rendered.");
    assert.ok(
      surface.objective.scrollWidth <= surface.objective.clientWidth
        && surface.objective.scrollHeight <= surface.objective.clientHeight,
      `At 1440×900, the current field objective must fit without clipping; observed ${JSON.stringify(surface.objective)}.`,
    );

    assert.equal(surface.resources.length, 5, "The desktop battle HUD must retain all five resource labels.");
    for (const resource of surface.resources) {
      assert.notEqual(resource.text, "", "Each desktop battle resource must retain a visible label.");
      assert.equal(resource.rendered, true, `The ${resource.text} resource label must remain rendered at 1440×900.`);
      assert.ok(
        resource.scrollWidth <= resource.clientWidth && resource.scrollHeight <= resource.clientHeight,
        `The ${resource.text} resource label must fit or wrap without clipping at 1440×900; observed ${JSON.stringify(resource)}.`,
      );
    }

    assert.equal(surface.panel.rendered, true, "At 1440×900, the command panel must remain rendered.");
    assert.equal(surface.panel.commands.length, 7, "The desktop command panel must retain all seven campaign actions.");
    assert.ok(
      surface.panel.scrollWidth - surface.panel.clientWidth <= 16,
      `At 1440×900, the command panel must not clip horizontally beyond a scrollbar's width; observed ${JSON.stringify(surface.panel)}.`,
    );
    assert.ok(
      surface.panel.clientHeight > 0,
      `At 1440×900, the command panel must render with a nonzero visible height; observed ${JSON.stringify(surface.panel)}.`,
    );
    for (const command of surface.panel.commands) {
      assert.equal(command.insidePanel, true, `${command.id} must remain inside the visible 1440×900 command panel.`);
      assert.equal(command.ownsCenter, true, `${command.id} must retain a reachable center hit target at 1440×900.`);
    }

    assert.equal(surface.skipLink.focused, true, "The skip link must become the active keyboard target when focused.");
    assert.ok(
      surface.skipLink.width >= 44 && surface.skipLink.height >= 44,
      `The focused skip link must provide at least a 44×44px target; observed ${surface.skipLink.width}×${surface.skipLink.height}.`,
    );
  } finally {
    await context.close();
  }
}

async function verifyStageOneEncounter(browser, baseUrl) {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const narrow = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await installCampaignStartReadinessProbe(desktop);
    await installCampaignStartReadinessProbe(narrow);
    const page = await desktop.newPage();
    const clientErrors = collectStrictClientErrors(page);
    const moduleResponses = collectCampaignModuleResponses(page, baseUrl);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    try {
      await waitForCampaignBoot(page, { baseUrl, responseTrace: moduleResponses, requireStartControlReady: true });
      await verifyWorker(page, baseUrl);
      await startStageOneCampaign(page);
    } catch (error) {
      await appendCampaignModuleEvidence(error, page, baseUrl, moduleResponses);
      throw error;
    }
    await enterBattle(page, 1, "Cinder Span");
    await assertCurrentObjectiveCommand(page, "hunt", "Initial Stage 1 tactical encounter focus");

    await assertDirectSourceGlbReadiness(page);
    await assertBattleCanvasBlankPassThrough(page);
    const lang = await page.locator("html").getAttribute("lang");
    const hudContract = STAGE_ONE_ENCOUNTER_HUD[lang];
    assert.ok(hudContract, `Stage 1 encounter requires a supported document locale; received ${String(lang)}.`);

    const desktopLayout = await page.evaluate(() => {
      const canvas = document.querySelector("#battle-canvas-3d");
      const field = document.querySelector("#battle-field");
      const hud = document.querySelector(".field-edge-hud");
      const pressure = document.querySelector("#battle-pressure");
      const waveIndicator = document.querySelector("#battle-wave-indicator");
      const controls = [...document.querySelectorAll("#command-panel [data-action]")];
      const stageControls = [...document.querySelectorAll("#stage-selector button")];
      const rect = (element) => element.getBoundingClientRect();
      return {
        canvas: canvas && { hidden: canvas.hidden, width: rect(canvas).width, height: rect(canvas).height },
        fieldContainsCanvas: Boolean(field?.contains(canvas)),
        hud: hud && { width: rect(hud).width, height: rect(hud).height },
        pressure: pressure?.textContent?.trim(),
        controls: controls.map((control) => {
          const box = rect(control);
          const x = box.left + box.width / 2;
          const y = box.top + box.height / 2;
          return { id: control.id, width: box.width, height: box.height, ownsCenter: control.contains(document.elementFromPoint(x, y)) };
        }),
        stageSelector: {
          rendered: getComputedStyle(document.querySelector("#stage-selector")).display !== "none",
          singleRow: stageControls.length === 10
            && stageControls.every((control) => Math.abs(rect(control).top - rect(stageControls[0]).top) < 1),
        },
        waveIndicator: waveIndicator?.textContent?.trim(),
        horizontalOverflow: document.scrollingElement.scrollWidth > window.innerWidth,
        campaignScroll: document.scrollingElement.scrollHeight > window.innerHeight,
      };
    });
    assert.equal(desktopLayout.fieldContainsCanvas, true, "Stage 1 must keep the direct tactical canvas inside its visible battlefield.");
    assert.equal(desktopLayout.canvas?.hidden, false, "Stage 1 must expose the direct tactical canvas rather than only a fallback.");
    assert.ok(desktopLayout.canvas?.width > 0 && desktopLayout.canvas?.height > 0, "Stage 1 direct tactical canvas must have a visible field-sized box.");
    assert.ok(desktopLayout.hud?.width > 0 && desktopLayout.hud?.height > 0, "Stage 1 must expose a visible tactical field HUD.");
    const sampledHudState = Object.values(hudContract).find(({ pressure, waveIndicator }) => (
      desktopLayout.pressure === pressure && desktopLayout.waveIndicator === waveIndicator
    ));
    assert.ok(
      sampledHudState,
      `Stage 1 tactical HUD must report a valid preparation or Scout live-wave state after direct-renderer readiness; observed ${JSON.stringify({
        pressure: desktopLayout.pressure,
        waveIndicator: desktopLayout.waveIndicator,
      })}.`
    );
    assert.ok(desktopLayout.controls.length > 0, "Stage 1 must expose command controls beside the tactical field.");
    assert.equal(desktopLayout.controls.every((control) => control.width > 0 && control.height > 0 && control.ownsCenter), true, "Every visible Stage 1 command must own a reachable center hit-test point rather than overlap the canvas.");
    assert.deepEqual(
      desktopLayout.stageSelector,
      { rendered: true, singleRow: true },
      "Desktop combat must retain all ten stage identities in one visible selector row.",
    );
    assert.equal(desktopLayout.horizontalOverflow, false, "Desktop Stage 1 must not create horizontal campaign overflow.");
    assert.equal(desktopLayout.campaignScroll, false, "Desktop Stage 1 must not create document-level campaign scrolling.");

    // The declared Scout wave clock arms only when the four-Legion force has
    // claimed the forge node. Keep the first incomplete checklist objective
    // at the encounter by satisfying both configured Cinder Span prerequisites.
    await materializeStageOneAllies(page, "Stage 1 tactical encounter");
    await clickEnabledAction(page, "#action-capture");
    await clickEnabledAction(page, "#action-materialize");
    assert.equal(await text(page.locator("#legion-value")), "4 / 10", "The focused Stage 1 path must field four Legion allies before awaiting Scout.");
    assert.equal(await text(page.locator("#nodes-value")), "1 / 1", "The focused Stage 1 path must claim the forge node before awaiting Scout.");
    const readinessAt = Date.now();

    await page.waitForFunction(
      (expected) => document.querySelector("#battle-hostile-label")?.textContent?.trim() === expected,
      STAGE_ONE_SCOUT_LABELS[lang],
      { timeout: 15_000 },
    );
    await assertCurrentObjectiveCommand(page, null, "Live Stage 1 Scout encounter");
    const elapsed = Date.now() - readinessAt;
    assert.ok(elapsed >= 7_000, `Stage 1 Scout wave must honor the declared 8-second preparation window after four Legion and one forge-node readiness; it appeared after ${elapsed}ms.`);
    assert.equal(
      await text(page.locator("#battle-pressure")),
      hudContract.live.pressure,
      `The scheduled Stage 1 Scout wave must publish the exact ${lang} live-pressure guidance.`
    );
    assert.equal(
      await text(page.locator("#battle-wave-indicator")),
      hudContract.live.waveIndicator,
      `The scheduled Stage 1 Scout wave must publish the exact ${lang} active wave badge.`
    );
    assertNoStrictClientErrors(clientErrors, "Stage 1 tactical encounter");

    const narrowPage = await narrow.newPage();
    const narrowModuleResponses = collectCampaignModuleResponses(narrowPage, baseUrl);
    await narrowPage.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    try {
      await waitForCampaignBoot(narrowPage, { baseUrl, responseTrace: narrowModuleResponses, requireStartControlReady: true });
      await verifyWorker(narrowPage, baseUrl);
      await startStageOneCampaign(narrowPage);
    } catch (error) {
      await appendCampaignModuleEvidence(error, narrowPage, baseUrl, narrowModuleResponses);
      throw error;
    }
    await enterBattle(narrowPage, 1, "Cinder Span");
    await assertDirectSourceGlbReadiness(narrowPage);
    const narrowLayout = await narrowPage.evaluate(() => {
      const canvas = document.querySelector("#battle-canvas-3d");
      const hud = document.querySelector(".field-edge-hud");
      const control = document.querySelector("#action-hunt");
      const rect = (element) => element.getBoundingClientRect();
      const box = rect(control);
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const centerTarget = document.elementFromPoint(x, y);
      return {
        canvasVisible: Boolean(canvas && !canvas.hidden && rect(canvas).width > 0 && rect(canvas).height > 0),
        hudVisible: Boolean(hud && rect(hud).width > 0 && rect(hud).height > 0),
        controlOwnsCenter: control.contains(centerTarget),
        controlCenterTarget: centerTarget?.id || centerTarget?.className || null,
        controlBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        horizontalOverflow: document.scrollingElement.scrollWidth > window.innerWidth,
        campaignScroll: document.scrollingElement.scrollHeight > window.innerHeight,
      };
    });
    assert.equal(narrowLayout.canvasVisible, true, "Narrow Stage 1 must retain a visible direct tactical canvas.");
    assert.equal(narrowLayout.hudVisible, true, "Narrow Stage 1 must retain a visible field HUD.");
    assert.equal(
      narrowLayout.controlOwnsCenter,
      true,
      `Narrow Stage 1 must retain a reachable command control outside the tactical canvas; center target=${narrowLayout.controlCenterTarget}; control=${JSON.stringify(narrowLayout.controlBox)}; viewport=${JSON.stringify(narrowLayout.viewport)}.`
    );
    assert.equal(narrowLayout.horizontalOverflow, false, "Narrow Stage 1 must not create horizontal campaign overflow.");
    assert.equal(narrowLayout.campaignScroll, false, "Narrow Stage 1 must not create document-level campaign scrolling.");
  } finally {
    await narrow.close();
    await desktop.close();
  }
}

async function assertStageBriefingClosed(page, context) {
  assert.equal(await page.locator("#stage-briefing").isHidden(), true, `${context} must not reopen the first-run Stage 1 briefing.`);
}


async function runBattleParityPath(browser, baseUrl, { failCanvas = false } = {}) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let page;
  try {
    await configureBattleParityContext(context, { failCanvas });
    page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    await startStageOneCampaign(page, { verifyBriefing: true, briefingLocale: "ko" });
    const entryIntegrity = Number.parseInt(await enterBattle(page, 1, "Cinder Span"), 10);

    if (failCanvas) {
      assert.equal(await page.locator("#battle-canvas-3d").isHidden(), true, "A failed WebGL2 direct renderer must reveal the static tactical fallback instead of a blank battlefield.");
      assert.equal(await page.locator("#battle-canvas-fallback").isVisible(), true, "A failed WebGL2 direct renderer must expose the 2D fallback canvas.");
      assert.equal(await page.locator("#battle-visual-fallback").isVisible(), true, "A failed WebGL2 direct renderer must expose the tactical fallback brief.");
      const language = await page.locator("html").getAttribute("lang");
      const fallbackPresentation = BATTLE_FALLBACK_PRESENTATIONS[language];
      assert.ok(fallbackPresentation, `Canvas fallback campaign status requires a supported document locale; received ${String(language)}.`);
      const fallbackStatuses = [fallbackPresentation.notice, STAGE_ONE_FIRST_ORDERS[language]];
      const campaignStatus = await text(page.locator("#campaign-status"));
      assert.ok(
        fallbackStatuses.includes(campaignStatus),
        `The ${language} fallback must retain an exact rendering notice or acknowledged first-order status; observed ${JSON.stringify(campaignStatus)}.`
      );
      assert.equal(await page.locator("#action-hunt").isEnabled(), true, "The fallback must keep the initial Hunt command available after the briefing acknowledgement.");
      assert.equal(await page.locator("[data-battle-target]").count(), 0, "The fallback must not resurrect removed absolute battle-target controls.");
    }
    if (!failCanvas) {
      assert.equal(
        await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        false,
        "The renderer-enabled parity path must run without reduced-motion preference before waiting for a durable encounter resolution."
      );
      assert.equal(await page.locator("#battle-visual-fallback").isHidden(), true, "A functioning WebGL2 direct renderer must keep the static tactical fallback card hidden.");
    }

    const parityContext = failCanvas ? "Canvas fallback battle path" : "Rendered battle path";
    await materializeStageOneAllies(page, parityContext);
    await clickEnabledAction(page, "#action-capture");
    await clickEnabledAction(page, "#action-materialize");
    assert.equal(
      await text(page.locator("#legion-value")),
      "4 / 10",
      `${parityContext} must satisfy the declared four-Legion preparation prerequisite before awaiting Scout.`
    );
    assert.equal(
      await text(page.locator("#nodes-value")),
      "1 / 1",
      `${parityContext} must satisfy the declared forge-node preparation prerequisite before awaiting Scout.`
    );
    const resolvedCountBeforeScout = await page.locator("#objective-checklist .complete").count();
    await awaitStageOneScoutEngagementBeforeBreach(page, parityContext);

    const resolution = await awaitTimedBattleResolution(page, entryIntegrity, resolvedCountBeforeScout);
    if (failCanvas) {
      const language = await page.locator("html").getAttribute("lang");
      const fallbackPresentation = BATTLE_FALLBACK_PRESENTATIONS[language];
      assert.ok(fallbackPresentation, `Canvas fallback resolution requires a supported document locale; received ${String(language)}.`);
      assert.equal(
        await text(page.locator("#battle-pressure")),
        fallbackPresentation.pressure,
        `The first scheduled fallback resolution must retain the exact ${language} static battle pressure.`
      );
      assert.equal(
        await text(page.locator("#battle-wave-indicator")),
        fallbackPresentation.waveIndicator,
        `The first scheduled fallback resolution must retain the exact ${language} static command-schedule label instead of a transient live-wave label.`
      );
    }
    if (failCanvas) await verifyCommandCooldown(page);
    assertNoClientErrors(clientErrors, failCanvas ? "Canvas fallback battle path" : "Rendered battle path");
    return resolution;
  } finally {
    await context.close();
  }
}

async function verifyRendererIndependentBattleResolution(browser, baseUrl) {
  const rendered = await runBattleParityPath(browser, baseUrl);
  const fallback = await runBattleParityPath(browser, baseUrl, { failCanvas: true });
  const renderedActions = rendered.trace.filter((event) => event.kind === "action");
  const fallbackActions = fallback.trace.filter((event) => event.kind === "action");

  assert.ok(rendered.resolutionSequence.length > 0, "The renderer-enabled battle path must record a durable encounter resolution.");
  assert.ok(fallback.resolutionSequence.length > 0, "The Canvas-fallback battle path must record a durable encounter resolution.");
  assert.deepEqual(
    fallback.resolutionSequence,
    rendered.resolutionSequence,
    "The renderer-enabled and Canvas-fallback paths must serialize the same normalized encounter resolution sequence."
  );
  assert.equal(
    fallback.outcome,
    rendered.outcome,
    "The renderer-enabled and Canvas-fallback paths must produce the same first durable encounter outcome."
  );
  assert.equal(
    fallback.integrityDelta,
    rendered.integrityDelta,
    "The renderer-enabled and Canvas-fallback paths must apply the same Gate integrity delta for their encounter resolution."
  );
  assert.deepEqual(
    fallbackActions,
    renderedActions,
    "The renderer-enabled and Canvas-fallback paths must preserve the same normalized player action sequence."
  );
  assert.deepEqual(rendered.trace[0], { kind: "start" }, "The renderer-enabled battle trace must begin with the campaign start transition.");
  assert.deepEqual(
    fallback.trace[0],
    rendered.trace[0],
    "The renderer-enabled and Canvas-fallback paths must share the same initial campaign start transition."
  );
}

async function verifyReducedMotionBattlePresentation(browser, baseUrl) {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  try {
    await configureBattleParityContext(context, { auditAnimationFrames: true });
    const page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    await startStageOneCampaign(page);
    await page.evaluate(() => window.__battleAnimationAudit.begin());
    await enterBattle(page, 1, "Cinder Span");
    await page.waitForTimeout(350);
    const animationRequests = await page.evaluate(() => window.__battleAnimationAudit.end());
    assert.ok(animationRequests <= 1, `Reduced-motion battle presentation must not start a continuous Canvas requestAnimationFrame loop; observed ${animationRequests} request(s).`);
    await verifyCommandCooldown(page);
    assertNoClientErrors(clientErrors, "Reduced-motion battle presentation");
  } finally {
    await context.close();
  }
}

async function verifyShortViewportSemanticCommandReachability(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    await startStageOneCampaign(page);
    await enterBattle(page, 1, "Cinder Span");
    await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract"]);
    await page.setViewportSize({ width: 1280, height: 280 });

    const main = page.locator("main");
    const command = page.locator("#action-materialize");
    await command.waitFor({ state: "visible" });
    assert.equal(await command.isEnabled(), true, "Stage 1 Materialize command must unlock before short-viewport reachability is tested.");
    const mainBox = await main.boundingBox();
    assert.ok(mainBox, "The gameplay main container must have a visible box for user-like wheel input.");

    const readCommandPoint = () => command.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const style = getComputedStyle(element);
      return {
        visible: !element.hidden
          && rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && x >= 0
          && x < window.innerWidth
          && y >= 0
          && y < window.innerHeight,
        x,
        y,
        receivesCenterClick: element.contains(document.elementFromPoint(x, y))
      };
    });
    const scrollRangeBeforeWheel = await main.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }));
    assert.ok(
      scrollRangeBeforeWheel.scrollHeight <= scrollRangeBeforeWheel.clientHeight,
      `Short viewport gameplay must fit in one non-scrolling page; observed scrollHeight=${scrollRangeBeforeWheel.scrollHeight}, clientHeight=${scrollRangeBeforeWheel.clientHeight}.`
    );
    assert.equal(scrollRangeBeforeWheel.scrollTop, 0, "Short viewport gameplay must begin at the fixed top position.");

    await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
    await page.mouse.wheel(0, 240);
    const scrollRangeAfterWheel = await main.evaluate((element) => element.scrollTop);
    assert.equal(scrollRangeAfterWheel, 0, "User-like wheel input must not vertically scroll one-page gameplay.");

    const commandPoint = await readCommandPoint();
    assert.equal(commandPoint.visible, true, "At the top of a short gameplay viewport, the Materialize command must already be within the viewport.");
    assert.equal(
      commandPoint.receivesCenterClick,
      true,
      "The initially visible Stage 1 Materialize command must own its center hit-test point before the physical mouse click."
    );
    const legionBeforeMaterialize = await text(page.locator("#legion-value"));
    await page.mouse.click(commandPoint.x, commandPoint.y);
    await page.waitForFunction(
      (previousLegion) => document.querySelector("#legion-value")?.textContent?.trim() !== previousLegion,
      legionBeforeMaterialize
    );
    assert.equal(
      await text(page.locator("#legion-value")),
      "2 / 10",
      "A physical click on the initially visible Stage 1 Materialize command must raise the public legion count."
    );
    assertNoClientErrors(clientErrors, "Short-viewport semantic command reachability");
  } finally {
    await context.close();
  }
}

async function assertPreparationIntegrity(page, number, entryIntegrity) {
  const actualIntegrity = Number.parseInt(await text(page.locator("#integrity-value")), 10);
  const entryIntegrityValue = Number.parseInt(entryIntegrity, 10);
  assert.ok(
    actualIntegrity >= entryIntegrityValue,
    `Stage ${number} command-preparation route must not lose integrity before intentional boss assaults.`
  );
}

async function advanceToNextScenario(page, number, heading, { campaignUrl, navigation, cockpit } = {}) {
  const briefingFacts = STAGE_TRANSITION_BRIEFINGS[number];
  assert.ok(briefingFacts, `Stage ${number} must define a non-terminal transition briefing contract.`);

  await page.locator("#view-result").waitFor({ state: "hidden" });
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.locator("#command-panel").waitFor({ state: "visible" });
  await assertStage(page, number, heading);
  await assertStageTransitionBriefing(page, briefingFacts, `Advancing to Stage ${number}`);

  assert.equal(page.url(), campaignUrl, `Selecting a Stage ${number} reward must retain the campaign document URL.`);
  assert.equal(navigation.count(), 0, `Selecting a Stage ${number} reward must not navigate the main frame.`);
  assert.equal(await cockpit.battleField.evaluate((field) => field.isConnected), true, `Selecting a Stage ${number} reward must preserve the mounted battlefield.`);
  assert.equal(await cockpit.commandPanel.evaluate((panel) => panel.isConnected), true, `Selecting a Stage ${number} reward must preserve the mounted command dock.`);

  await acknowledgeStageBriefing(page, { stageNumber: number });
  const trace = await campaignTrace(page);
  assert.equal(
    trace.some((event) => !["start", "action", "encounter", "reward"].includes(event.kind)),
    false,
    `Acknowledging the Stage ${number} briefing must not add presentation-only events to the campaign save trace.`
  );
}

async function chooseRewardAndAdvance(page, rewardId, number, heading) {
  const campaignUrl = page.url();
  const navigation = trackMainFrameNavigations(page);
  const cockpit = {
    battleField: await page.locator("#battle-field").elementHandle(),
    commandPanel: await page.locator("#command-panel").elementHandle()
  };
  assert.ok(cockpit.battleField, "Choosing a non-terminal reward requires the mounted battlefield.");
  assert.ok(cockpit.commandPanel, "Choosing a non-terminal reward requires the mounted command dock.");

  try {
    await page.locator(`[data-reward-id="${rewardId}"]`).click();
    await page.locator("#reward-panel").waitFor({ state: "hidden" });
    await advanceToNextScenario(page, number, heading, { campaignUrl, navigation, cockpit });
  } finally {
    navigation.dispose();
  }
}
const CARRY_STATUS_LOCALES = Object.freeze({
  "rift-lens": Object.freeze({
    ko: "균열의 렌즈의 효과가 베일 시타델(으)로 이어집니다.",
    en: "Rift Lens carries into Veil Citadel.",
  }),
  "veil-vanguard": Object.freeze({
    ko: "베일 선봉대의 효과가 메아리 왕좌(으)로 이어집니다.",
    en: "Veil Vanguard carries into Echo Throne.",
  }),
  "throne-echo": Object.freeze({
    ko: "왕좌의 메아리의 효과가 선큰 바스티온(으)로 이어집니다.",
    en: "Throne Echo carries into Sunken Bastion.",
  }),
});

async function assertLocalizedCarryStatus(page, rewardId, context) {
  const language = await page.locator("html").getAttribute("lang");
  const carryStatus = CARRY_STATUS_LOCALES[rewardId]?.[language];
  const firstOrder = STAGE_ONE_FIRST_ORDERS[language];
  assert.equal(
    typeof carryStatus,
    "string",
    `${context} requires a carry-status contract for reward=${rewardId} html[lang=${String(language)}].`
  );
  assert.equal(
    typeof firstOrder,
    "string",
    `${context} requires the shared Hunt-first-order contract for html[lang=${String(language)}].`
  );
  assert.equal(
    await text(page.locator("#campaign-status")),
    `${carryStatus} ${firstOrder}`,
    context
  );
}
const STAGE_THREE_POSSESS_FEEDBACK = Object.freeze({
  ko: "센티널의 의지가 아군 명령에 굴복했습니다. 그 분노가 총공격에 실려 발산됩니다.",
  en: "A sentinel's will is folded into your command; its fury rides your assaults.",
});
const STAGE_SELECTOR_IDS = Object.freeze({
  1: "cinder-span",
  2: "veil-citadel",
  3: "echo-throne",
  4: "sunken-bastion",
  5: "howling-sprawl",
});
const STAGE_SELECTOR_STATE_COPY = Object.freeze({
  ko: Object.freeze({ cleared: "완료됨", current: "현재 스테이지", locked: "잠김" }),
  en: Object.freeze({ cleared: "cleared", current: "current stage", locked: "locked" }),
});

async function assertLocalizedStageSelector(page, number, state, context) {
  const language = await page.locator("html").getAttribute("lang");
  const stageId = STAGE_SELECTOR_IDS[number];
  const stateCopy = STAGE_SELECTOR_STATE_COPY[language]?.[state];
  const dictionary = (await TRANSLATIONS_SOURCE_CONTRACT)[language];
  const titleKey = `stage.${stageId}.title`;
  assert.equal(typeof stageId, "string", `${context} requires Stage ${number} selector metadata.`);
  assert.equal(typeof stateCopy, "string", `${context} requires ${language} selector-state copy for ${state}.`);
  assert.equal(
    Object.prototype.hasOwnProperty.call(dictionary ?? {}, titleKey),
    true,
    `${context} requires the ${language} translation key ${titleKey}.`
  );
  assert.equal(
    await page.locator(`#stage-select-${number}`).getAttribute("aria-label"),
    `${dictionary[titleKey]}: ${stateCopy}`,
    context
  );
}




async function runStageOne(page) {
  const entryIntegrity = await enterBattle(page, 1, "Cinder Span");
  await assertCurrentObjectiveCommand(page, "hunt", "Initial Stage 1 checklist focus");

  await assertDirectSourceGlbReadiness(page);
  await assertBattleCanvasBlankPassThrough(page);
  for (const action of ["materialize", "capture", "assault"]) {
    assert.equal(
      await page.locator(`#action-${action}`).isEnabled(),
      false,
      `Stage 1 semantic ${action} must start disabled until its command prerequisites are met.`
    );
  }

  const fieldProxy = page.locator(".ashen-field-command__activate");
  const receipt = page.locator('[data-field-overlay="relay-receipt"]');
  const receiptCommand = receipt.locator('[data-field-overlay="relay-command"]');
  const relayedCommandName = await text(fieldProxy.locator(".ashen-field-command__activate-name"));
  const relayPrefix = await text(receipt.locator('[data-i18n="fieldOverlay.relayPrefix"]'));
  assert.notEqual(
    relayPrefix,
    "",
    "The mounted field overlay must render its localized relay prefix before issuing a command.",
  );
  assert.equal(
    await receipt.isHidden(),
    true,
    "Stage 1 must not show an Order Seal receipt before the field proxy relays an existing command.",
  );

  const traceBeforeOverlayHunt = await campaignTrace(page);
  await clickEnabledAction(page, ".ashen-field-command__activate");
  assert.deepEqual(
    (await campaignTrace(page)).slice(traceBeforeOverlayHunt.length),
    [{ kind: "action", action: "hunt" }],
    "Activating the current Stage 1 Hunt from the field overlay must append the public campaign Hunt transition.",
  );
  await receipt.waitFor({ state: "visible" });
  assert.equal(
    await text(receiptCommand),
    relayedCommandName,
    "The Order Seal receipt must name the existing command the field proxy relayed.",
  );
  assert.equal(
    await text(receipt),
    `${relayPrefix} ${relayedCommandName}`,
    "The visible Order Seal receipt must retain the mounted localized relay prefix and relayed native command name.",
  );
  assert.deepEqual(
    await receipt.evaluate((element) => ({
      role: element.getAttribute("role"),
      ariaLive: element.getAttribute("aria-live"),
      tabIndex: element.getAttribute("tabindex"),
      pointerEvents: getComputedStyle(element).pointerEvents,
      containsInteractiveDescendant: Boolean(element.querySelector('button, a[href], input, select, textarea, [role="button"], [tabindex]')),
    })),
    {
      role: "status",
      ariaLive: "polite",
      tabIndex: null,
      pointerEvents: "none",
      containsInteractiveDescendant: false,
    },
    "The visible Order Seal must be a passive polite status receipt rather than a second focusable command.",
  );
  assert.equal(
    await page.locator(".ashen-field-command button, .ashen-field-command [role=\"button\"]").count(),
    1,
    "The field overlay must retain exactly one semantic command: its native-command proxy.",
  );

  await clickEnabledAction(page, "#action-hunt");
  await assertCurrentObjectiveCommand(page, "extract", "Completing two Stage 1 Hunts");
  const extractCommand = page.locator("#action-extract");
  const extractCommandName = await text(extractCommand.locator("strong"));
  const extractCommandDetail = await text(extractCommand.locator("small"));
  const extractProxyAriaLabel = `${extractCommandName}: ${extractCommandDetail}`;
  await page.waitForFunction(({ name, ariaLabel }) => {
    const proxy = document.querySelector(".ashen-field-command__activate");
    const overlay = proxy?.closest(".ashen-field-command");
    return overlay?.dataset.action === "extract"
      && proxy?.querySelector(".ashen-field-command__activate-name")?.textContent?.trim() === name
      && proxy?.getAttribute("aria-label") === ariaLabel;
  }, { name: extractCommandName, ariaLabel: extractProxyAriaLabel });
  assert.deepEqual(
    await fieldProxy.evaluate((proxy) => ({
      action: proxy.closest(".ashen-field-command")?.dataset.action,
      name: proxy.querySelector(".ashen-field-command__activate-name")?.textContent?.trim(),
      ariaLabel: proxy.getAttribute("aria-label"),
    })),
    {
      action: "extract",
      name: extractCommandName,
      ariaLabel: extractProxyAriaLabel,
    },
    "After Hunt advances the engine objective, the same field proxy must follow Extract's action, name, and accessible label.",
  );
  await fieldProxy.focus();
  assert.equal(
    await page.evaluate(() => document.activeElement === document.querySelector(".ashen-field-command__activate")),
    true,
    "The existing field proxy must receive keyboard focus before Enter relays Extract.",
  );
  const traceBeforeOverlayExtract = await campaignTrace(page);
  await fieldProxy.press("Enter");
  await page.waitForFunction(() => document.querySelector("#action-extract") instanceof HTMLButtonElement && document.querySelector("#action-extract").disabled);
  assert.deepEqual(
    (await campaignTrace(page)).slice(traceBeforeOverlayExtract.length),
    [{ kind: "action", action: "extract" }],
    "Focused Enter on the field proxy must relay exactly one existing Extract command.",
  );

  assert.equal(await page.locator("#action-materialize").isEnabled(), true, "Stage 1 Materialize must unlock after Hunt twice and Extract.");
  assert.equal(await page.locator("#action-capture").isEnabled(), false, "Stage 1 Capture must remain disabled until a legion materializes.");
  assert.equal(await page.locator("#action-assault").isEnabled(), false, "Stage 1 Assault must remain disabled until the forge node is captured.");

  const legionBeforeMaterialize = await text(page.locator("#legion-value"));
  await clickEnabledAction(page, "#action-materialize");
  assert.equal(await text(page.locator("#legion-value")), "2 / 10", "Clicking the Stage 1 Materialize command must raise the public legion count.");
  assert.notEqual(await text(page.locator("#legion-value")), legionBeforeMaterialize, "The Stage 1 Materialize command must visibly update legion status.");

  assert.equal(await page.locator("#action-capture").isEnabled(), true, "Stage 1 Capture must unlock after Materialize.");
  assert.equal(await page.locator("#action-assault").isEnabled(), false, "Stage 1 Assault must remain disabled until the forge node is captured.");
  const nodesBeforeCapture = await text(page.locator("#nodes-value"));
  await clickEnabledAction(page, "#action-capture");
  assert.equal(await text(page.locator("#nodes-value")), "1 / 1", "Clicking the Stage 1 Capture command must claim the public node status.");
  assert.notEqual(await text(page.locator("#nodes-value")), nodesBeforeCapture, "The Stage 1 Capture command must visibly update node status.");

  assert.equal(await page.locator("#action-assault").isEnabled(), false, "Stage 1 Assault must remain blocked after Capture until all declared waves clear.");
  await clickEnabledAction(page, "#action-materialize");
  assert.equal(await text(page.locator("#legion-value")), "4 / 10", "A second Stage 1 Materialize command must field a four-shade wave-clearing legion.");
  await assertCurrentObjectiveCommand(page, null, "Stage 1 encounter objective");
  await assertPreparationIntegrity(page, 1, entryIntegrity);
  const preparationEncounterTrace = (await campaignTrace(page)).filter((event) => event.kind === "encounter");
  assert.equal(
    preparationEncounterTrace.length,
    0,
    "Stage 1 encounter waves must wait until the wave-clearing legion and forge node are ready.",
  );

  await page.waitForFunction(
    () => {
      const assault = document.querySelector("#action-assault");
      return assault instanceof HTMLButtonElement && !assault.disabled;
    },
    undefined,
    { timeout: 75_000 },
  );
  const encounterTrace = (await campaignTrace(page))
    .filter((event) => event.kind === "encounter")
    .map((event) => event.event);
  assert.deepEqual(
    encounterTrace,
    [
      { type: "start-wave", stageId: "cinder-span", waveId: "scout" },
      { type: "wave-cleared", stageId: "cinder-span", waveId: "scout" },
      { type: "start-wave", stageId: "cinder-span", waveId: "guard" },
      { type: "wave-cleared", stageId: "cinder-span", waveId: "guard" },
      { type: "start-wave", stageId: "cinder-span", waveId: "reinforcement" },
      { type: "wave-cleared", stageId: "cinder-span", waveId: "reinforcement" },
    ],
    "Stage 1 browser gameplay must serialize only the declared 8/22/36-second wave start and clear order before exposing the boss.",
  );
  assert.equal(await page.locator("#action-assault").isEnabled(), true, "Stage 1 Assault must unlock only after the third wave exposes the boss.");
  const bossBeforeAssault = await text(page.locator("#boss-value"));
  await clickEnabledAction(page, "#action-assault");
  assert.equal(await text(page.locator("#boss-value")), "5 / 8", "Clicking the Stage 1 Assault command must damage the exposed public boss health.");
  assert.notEqual(await text(page.locator("#boss-value")), bossBeforeAssault, "The exposed Stage 1 Assault command must visibly update boss health.");

  await runActions(page, ["#action-assault", "#action-assault"]);
  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  const rewardIds = await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId));
  assert.equal(
    await rewards.count(),
    4,
    `Stage 1 must offer exactly four mutually exclusive rewards; observed selector IDs: ${JSON.stringify(rewardIds)}.`
  );
  assert.deepEqual(
    rewardIds,
    ["ember-cohort", "rift-lens", "stillwater-hourglass", "shadebreaker-brand"],
    "Stage 1 reward choices must expose the current ordered reward IDs."
  );

  await chooseRewardAndAdvance(page, "rift-lens", 2, "Veil Citadel");
  assert.equal(await text(page.locator("#legion-value")), "0 / 10", "Rift Lens must leave Stage 2 at the base legion capacity.");
  await assertLocalizedCarryStatus(page, "rift-lens", "Stage 2 must visibly report the selected Stage 1 boon.");
}

async function runStageTwo(page) {
  const entryIntegrity = await enterBattle(page, 2, "Veil Citadel");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-capture", "#action-capture", "#action-possess"]);
  await assertPreparationIntegrity(page, 2, entryIntegrity);
  await runActions(page, ["#action-assault", "#action-assault"]);

  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  const rewardIds = await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId));
  assert.equal(await rewards.count(), 3, "Stage 2 must offer exactly three mutually exclusive rewards.");
  assert.deepEqual(
    rewardIds,
    ["veil-vanguard", "anchor-shard", "abyssal-banner"],
    "Stage 2 reward choices must expose the current ordered reward IDs."
  );
  await chooseRewardAndAdvance(page, "veil-vanguard", 3, "Echo Throne");
  assert.equal(await text(page.locator("#legion-value")), "4 / 10", "Veil Vanguard must carry four raised shades into Stage 3.");
  await assertLocalizedCarryStatus(page, "veil-vanguard", "Stage 3 must visibly report the selected Stage 2 boon.");
}

const STAGE_THREE_CHECKLIST_COPY = Object.freeze({
  ko: Object.freeze({
    possess: "센티널 빙의",
    domain: "군주의 영역 1회 발동",
    assault: "게이트 소버린 처치",
    optionalSuffix: " (선택)",
    optionalState: "선택 사항",
    completeState: "완료됨",
    currentState: "현재 목표",
  }),
  en: Object.freeze({
    possess: "Possess a sentinel",
    domain: "Invoke Lord's Domain once",
    assault: "Defeat the Gate Sovereign",
    optionalSuffix: " (Optional)",
    optionalState: "optional",
    completeState: "complete",
    currentState: "current objective",
  }),
});

async function assertStageThreeOptionalChecklist(page, expected, context) {
  const language = await page.locator("html").getAttribute("lang");
  const copy = STAGE_THREE_CHECKLIST_COPY[language];
  assert.ok(copy, `${context} requires Stage 3 checklist copy for html[lang=${String(language)}].`);
  const rows = await page.locator("#objective-checklist li").evaluateAll((items) => items.map((item) => ({
    text: item.textContent?.trim() ?? "",
    className: item.className,
    ariaLabel: item.getAttribute("aria-label"),
  })));

  for (const id of ["possess", "domain"]) {
    const state = expected[id];
    const row = rows.find(({ text: rowText }) => rowText.startsWith(copy[id]));
    const visibleText = `${copy[id]}${state === "optional" ? copy.optionalSuffix : ""}`;
    const ariaState = state === "optional" ? copy.optionalState : copy.completeState;
    assert.deepEqual(
      row,
      {
        text: visibleText,
        className: state,
        ariaLabel: `${visibleText}: ${ariaState}`,
      },
      `${context} must render Stage 3 ${id} as exact ${language} ${state} copy without making it current.`,
    );
  }

  assert.deepEqual(
    rows.filter(({ className }) => className === "current"),
    [{
      text: copy.assault,
      className: "current",
      ariaLabel: `${copy.assault}: ${copy.currentState}`,
    }],
    `${context} must keep Assault as the only required current checklist row.`,
  );
  await assertCurrentObjectiveCommand(page, "assault", context);
}

async function runStageThree(page) {
  const entryIntegrity = await enterBattle(page, 3, "Echo Throne");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-materialize", "#action-capture"]);
  await assertStageThreeOptionalChecklist(
    page,
    { possess: "optional", domain: "optional" },
    "Prepared Stage 3 before optional commands",
  );
  const traceBeforePossession = await campaignTrace(page);
  await clickEnabledAction(page, "#action-possess", { assertCampaignSurface: false });
  const traceAfterPossession = await campaignTrace(page);
  assert.equal(
    traceAfterPossession.length,
    traceBeforePossession.length + 1,
    "Possession must append exactly one campaign trace event."
  );
  assert.deepEqual(
    traceAfterPossession.at(-1),
    { kind: "action", action: "possess" },
    "Possession must append its semantic action event to the campaign trace."
  );
  await assertStageThreeOptionalChecklist(
    page,
    { possess: "complete", domain: "optional" },
    "Stage 3 after optional Possess",
  );
  const language = await page.locator("html").getAttribute("lang");
  const possessFeedback = STAGE_THREE_POSSESS_FEEDBACK[language];
  assert.equal(typeof possessFeedback, "string", `Stage 3 Possess requires an exact feedback contract for html[lang=${String(language)}].`);
  assert.equal(
    await text(page.locator("#campaign-status")),
    possessFeedback,
    "After Stage 3 Extract clears entry guidance, Possess must publish its sentinel command result instead of restoring the first-order prompt."
  );
  await runActions(page, ["#action-domain"]);
  await assertStageThreeOptionalChecklist(
    page,
    { possess: "complete", domain: "complete" },
    "Stage 3 after optional Domain",
  );
  await assertPreparationIntegrity(page, 3, entryIntegrity);
  assert.equal(await text(page.locator("#legion-value")), "8 / 10", "Two materializations must grow the Veil Vanguard from four to eight shades.");
  await runActions(page, ["#action-assault", "#action-assault"]);
  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  assert.deepEqual(
    await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId)),
    ["throne-echo", "dawnless-crown"],
    "Stage 3 must offer its current two reward choices."
  );
  await chooseRewardAndAdvance(page, "throne-echo", 4, "Sunken Bastion");
  await assertLocalizedCarryStatus(page, "throne-echo", "Claiming Throne Echo must progress the campaign into Stage 4.");
  for (const number of [1, 2, 3]) {
    await assertLocalizedStageSelector(page, number, "cleared", `Stage ${number} must be marked cleared after Stage 3 reward selection.`);
  }
  assert.equal(await page.locator("#stage-select-4").getAttribute("aria-current"), "step", "Stage 4 must be the active campaign selection after the Stage 3 reward.");
  await assertLocalizedStageSelector(page, 4, "current", "Stage 4 must be available as the current campaign selection.");
  await assertLocalizedStageSelector(page, 5, "locked", "Stage 5 must remain locked after the Stage 3 reward.");
}

async function verifyStageThreeChecklist(browser, baseUrl) {
  const fixtures = await createCampaignFixtures();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let strictErrors;
  try {
    const page = await context.newPage();
    strictErrors = collectStrictClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    await page.locator("#import-save").setInputFiles({
      name: "abyssal-surge-stage-three-prepared.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixtures.stageThreePrepared), "utf8"),
    });
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => document.querySelector("#save-status")?.textContent.startsWith("가져온 캠페인 저장 완료"),
      undefined,
      { timeout: 10_000 },
    );
    await enterBattle(page, 3, "메아리 왕좌");
    await assertStageThreeOptionalChecklist(
      page,
      { possess: "optional", domain: "optional" },
      "Focused Korean Stage 3 prepared checklist",
    );

    await page.locator("#lang-toggle").click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await assertStageThreeOptionalChecklist(
      page,
      { possess: "optional", domain: "optional" },
      "Focused English Stage 3 prepared checklist",
    );

    await clickEnabledAction(page, "#action-possess");
    await assertStageThreeOptionalChecklist(
      page,
      { possess: "complete", domain: "optional" },
      "Focused Stage 3 after optional Possess",
    );
    await clickEnabledAction(page, "#action-domain");
    await assertStageThreeOptionalChecklist(
      page,
      { possess: "complete", domain: "complete" },
      "Focused Stage 3 after optional Domain",
    );
    assertNoStrictClientErrors(strictErrors, "Focused Stage 3 optional checklist");
  } finally {
    strictErrors?.beginTeardown();
    await context.close();
  }
}


function cleanupError(label, error) {
  return `${label}: ${error instanceof Error ? error.message : String(error)}`;
}
const CURRENT_STATIC_CACHE = "abyssal-surge-static-v57";

function currentWorkerCacheName() {
  let serviceWorkerSource;
  try {
    serviceWorkerSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  } catch (error) {
    assert.fail(`Cannot read sw.js to derive CACHE_NAME for the browser cache assertion: ${error instanceof Error ? error.message : String(error)}`);
  }

  const declaration = serviceWorkerSource.match(/^\s*const\s+CACHE_NAME\s*=\s*(?:"([^"]+)"|'([^']+)')\s*;?\s*$/m);

  assert.ok(
    declaration,
    "sw.js must declare CACHE_NAME as a quoted string so the browser cache assertion can verify the current worker revision."
  );

  const cacheName = declaration[1] || declaration[2];
  assert.equal(
    cacheName,
    CURRENT_STATIC_CACHE,
    "sw.js must retain the current static cache revision required by the browser cache assertion.",
  );
  return cacheName;
}


async function verifyWorker(page, baseUrl) {
  const expectedCacheName = currentWorkerCacheName();
  const worker = await page.evaluate(async ({ timeoutMs, cacheName }) => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const registration = await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Service worker did not become ready within ${timeoutMs} ms.`)), timeoutMs);
      navigator.serviceWorker.ready.then(
        (readyRegistration) => {
          window.clearTimeout(timeout);
          resolve(readyRegistration);
        },
        (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      );
    });
    const active = registration.active || registration.waiting || registration.installing;
    const cacheNames = await caches.keys();
    const cache = await caches.open(cacheName);
    const cachedCoreModules = (await Promise.all(
      ["/app.js", "/campaign-state.js", "/stage-navigation.js"].map(async (pathname) => (
        await cache.match(new URL(pathname, location.origin).href) ? pathname : null
      ))
    )).filter(Boolean);
    return {
      supported: true,
      cacheNames,
      cachedCoreModules,
      scope: registration.scope,
      scriptUrl: active ? active.scriptURL : null
    };
  }, { timeoutMs: 10_000, cacheName: expectedCacheName });

  assert.equal(worker.supported, true, "The browser must expose service workers for the static campaign.");
  assert.equal(worker.scope, `${baseUrl}/`, "The service worker must be scoped to this ephemeral loopback origin.");
  assert.equal(worker.scriptUrl, `${baseUrl}/sw.js`, "The active worker must come from the current sw.js source.");
  const campaignCaches = worker.cacheNames.filter((name) => name.startsWith("abyssal-surge-static-"));
  assert.deepEqual(campaignCaches, [expectedCacheName], "Only the current static worker cache must be observable after activation.");
  assert.deepEqual(
    worker.cachedCoreModules,
    ["/app.js", "/campaign-state.js", "/stage-navigation.js"],
    "The current worker cache must atomically precache the application entry, campaign-state, and stage-navigation modules."
  );

  return { ...worker, cacheName: campaignCaches[0] };
}

async function verifyLobbyCampaignRoundTrip(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let navigation;
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    navigation = trackMainFrameNavigations(page);
    assert.equal(
      await page.locator("#campaign-resume-summary").isHidden(),
      true,
      "A clean lobby must hide the active-run summary before starting a campaign."
    );

    const acceptStartConfirmation = (dialog) => dialog.accept();
    page.once("dialog", acceptStartConfirmation);
    await page.locator("#start-campaign").click();
    page.off("dialog", acceptStartConfirmation);

    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#stage-briefing").waitFor({ state: "visible" });
    await acknowledgeStageOneBriefing(page);
    await enterBattle(page, 1, "Cinder Span");
    const beforeReturnEnvelope = await exportCampaignEnvelope(page);
    const campaignUrl = page.url();

    await page.locator("#return-to-lobby").click();
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#campaign-screen").waitFor({ state: "hidden" });
    await page.locator("#campaign-resume-summary").waitFor({ state: "visible" });
    await page.locator("#resume-campaign").waitFor({ state: "visible" });
    assert.equal(page.url(), campaignUrl, "Returning to the lobby must retain the campaign document URL.");
    assert.equal(navigation.count(), 0, "Returning from an active battle must not navigate the main frame.");
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#campaign-screen").isHidden(), true, "The campaign screen must remain hidden while the returned lobby idles.");
    assert.equal(navigation.count(), 0, "The returned lobby must remain in the same main-frame document while idle.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    assert.equal(navigation.count(), 1, "The intentional post-return reload must be the only observed main-frame navigation.");
    navigation.reset();

    await page.locator("#resume-campaign").waitFor({ state: "visible" });
    await page.locator("#resume-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#battle-field").waitFor({ state: "visible" });
    await assertStage(page, 1, "Cinder Span");
    await assertStageBriefingClosed(page, "Resuming an active campaign");
    assert.equal(page.url(), campaignUrl, "Resuming the campaign must retain the campaign document URL.");
    assert.equal(navigation.count(), 0, "Resuming an active battle return must not navigate the main frame.");
    const afterResumeEnvelope = await exportCampaignEnvelope(page);
    assert.deepEqual(
      afterResumeEnvelope,
      beforeReturnEnvelope,
      "The public exported replay envelope and trace must survive Return, reload, and Resume unchanged."
    );
    await page.locator("#retry-stage").click();
    await assertStage(page, 1, "Cinder Span");
    await assertStageBriefingClosed(page, "Retrying Stage 1");
    await page.waitForFunction(() => {
      const hunt = document.querySelector("#action-hunt");
      return Boolean(hunt && !hunt.disabled);
    });
    assert.equal(await page.locator("#action-hunt").isEnabled(), true, "Retrying Stage 1 must return directly to its command path.");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#retry-stage").scrollIntoViewIfNeeded();
    const mobileNavigation = await page.evaluate(() => {
      const stageSelector = document.querySelector("#stage-selector");
      const stageNumber = document.querySelector("#stage-number");
      const retry = document.querySelector("#retry-stage");
      const retryRect = retry?.getBoundingClientRect();
      const retryOwner = retryRect && document.elementFromPoint(
        retryRect.left + retryRect.width / 2,
        retryRect.top + retryRect.height / 2,
      );
      return {
        selectorHidden: stageSelector ? getComputedStyle(stageSelector).display === "none" : false,
        stageIdentity: stageNumber?.textContent?.trim() ?? "",
        retryRendered: Boolean(
          retryRect
          && retryRect.width > 0
          && retryRect.height > 0
          && getComputedStyle(retry).display !== "none",
        ),
        retryOwnsCenter: Boolean(retry && retryOwner && retry.contains(retryOwner)),
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: innerWidth,
      };
    });
    assert.equal(mobileNavigation.selectorHidden, true, "At 390×844, the stage selector must stay hidden to prioritize the tactical field.");
    assert.notEqual(mobileNavigation.stageIdentity, "", "At 390×844, the current stage identity must remain available without the selector.");
    assert.equal(mobileNavigation.retryRendered, true, "At 390×844, the current-stage retry path must remain rendered.");
    assert.equal(mobileNavigation.retryOwnsCenter, true, "At 390×844, the current-stage retry control must remain reachable.");
    assert.ok(
      mobileNavigation.documentScrollWidth <= mobileNavigation.viewportWidth
        && mobileNavigation.bodyScrollWidth <= mobileNavigation.viewportWidth,
      `At 390×844, mobile combat must not overflow horizontally; document=${mobileNavigation.documentScrollWidth}, body=${mobileNavigation.bodyScrollWidth}, viewport=${mobileNavigation.viewportWidth}.`,
    );
  } finally {
    navigation?.dispose();
    await context.close();
  }
}

async function assertResultModalIsolation(page, context) {
  const isolation = await page.evaluate(() => {
    const result = document.querySelector("#view-result");
    const screen = document.querySelector("#campaign-screen");
    return {
      siblings: [...screen.children].map((child) => ({
        id: child.id,
        isResult: child === result,
        inert: child.inert,
      })),
      languageToggleInert: document.querySelector("#lang-toggle")?.inert ?? false,
    };
  });
  assert.ok(isolation.siblings.length > 1, `${context} must have campaign siblings to isolate.`);
  assert.equal(
    isolation.siblings.every(({ isResult, inert }) => (isResult ? !inert : inert)),
    true,
    `${context} must make every #campaign-screen child except #view-result inert.`,
  );
  assert.equal(isolation.languageToggleInert, true, `${context} must isolate the page-level language toggle.`);

  const focusableSelector = "button:not([hidden]):not(:disabled), input:not([type='hidden']):not(:disabled), [href], [tabindex]:not([tabindex='-1'])";
  const focusableCount = await page.locator("#view-result").evaluate((overlay, selector) => {
    const focusable = [...overlay.querySelectorAll(selector)]
      .filter((element) => !element.hidden && !element.inert && element.getClientRects().length > 0);
    focusable.at(-1)?.focus();
    return focusable.length;
  }, focusableSelector);
  assert.ok(focusableCount > 0, `${context} must expose at least one result-modal control.`);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator("#view-result").evaluate((overlay, selector) => {
      const focusable = [...overlay.querySelectorAll(selector)]
        .filter((element) => !element.hidden && !element.inert && element.getClientRects().length > 0);
      return document.activeElement === focusable[0];
    }, focusableSelector),
    true,
    `${context} Tab from the final control must wrap to the first result-modal control.`,
  );
  await page.locator("#view-result").evaluate((overlay, selector) => {
    const focusable = [...overlay.querySelectorAll(selector)]
      .filter((element) => !element.hidden && !element.inert && element.getClientRects().length > 0);
    focusable[0]?.focus();
  }, focusableSelector);
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.locator("#view-result").evaluate((overlay, selector) => {
      const focusable = [...overlay.querySelectorAll(selector)]
        .filter((element) => !element.hidden && !element.inert && element.getClientRects().length > 0);
      return document.activeElement === focusable.at(-1);
    }, focusableSelector),
    true,
    `${context} Shift+Tab from the first control must wrap to the final result-modal control.`,
  );
}

async function assertResultModalIsolationRestored(page, context) {
  const restored = await page.evaluate(() => ({
    campaignChildrenInteractive: [...document.querySelector("#campaign-screen").children]
      .every((child) => !child.inert),
    languageToggleInteractive: !document.querySelector("#lang-toggle")?.inert,
  }));
  assert.deepEqual(
    restored,
    { campaignChildrenInteractive: true, languageToggleInteractive: true },
    `${context} must restore interaction to every surface isolated by the result modal.`,
  );
}

async function verifyTerminalImportRoundTrip(browser, baseUrl, { fixtureName, envelope, assertResult }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let navigation;
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    navigation = trackMainFrameNavigations(page);

    await importCampaignEnvelope(page, envelope, `abyssal-surge-${fixtureName}.json`);
    await page.locator("#view-result").waitFor({ state: "visible" });
    await assertResultModalIsolation(page, `Public ${fixtureName} result modal`);
    assert.equal(navigation.count(), 0, `Public ${fixtureName} import must not navigate the main frame.`);

    const campaignUrl = page.url();
    await page.locator("#return-to-lobby-from-result").click();
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#campaign-screen").waitFor({ state: "hidden" });
    await assertResultModalIsolationRestored(page, `Closing public ${fixtureName} result modal`);
    assert.equal(page.url(), campaignUrl, `Returning ${fixtureName} to the lobby must retain the campaign document URL.`);
    assert.equal(navigation.count(), 0, `Returning ${fixtureName} to the lobby must not navigate the main frame.`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    assert.equal(navigation.count(), 1, `The explicit ${fixtureName} reload must be the only main-frame navigation.`);
    navigation.reset();

    await page.locator("#resume-campaign").waitFor({ state: "visible" });
    await page.locator("#resume-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#view-result").waitFor({ state: "visible" });
    assert.equal(page.url(), campaignUrl, `Resuming ${fixtureName} must retain the campaign document URL.`);
    assert.equal(navigation.count(), 0, `Resuming ${fixtureName} must not navigate the main frame.`);
    await assertResult(page);
    await page.locator("#return-to-lobby-from-result").focus();
    await page.keyboard.press("Escape");
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#view-result").waitFor({ state: "hidden" });
    await assertResultModalIsolationRestored(page, `Escaping resumed ${fixtureName} result modal`);
    assert.equal(page.url(), campaignUrl, `Escaping resumed ${fixtureName} must retain the campaign document URL.`);
    assert.equal(navigation.count(), 0, `Escaping resumed ${fixtureName} must not navigate the main frame.`);
  } finally {
    navigation?.dispose();
    await context.close();
  }
}

async function verifyBriefingImportResume(browser, baseUrl, envelope) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let navigation;
  let page;
  let noStartConfirmation;
  try {
    page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    navigation = trackMainFrameNavigations(page);

    const assertNormalizedStageOne = async (source) => {
      await page.locator("#campaign-screen").waitFor({ state: "visible" });
      await page.locator("#battle-field").waitFor({ state: "visible" });
      await assertStage(page, 1, "Cinder Span");
      await assertStageBriefingClosed(page, source);
      await page.waitForFunction(() => {
        const hunt = document.querySelector("#action-hunt");
        return Boolean(hunt && !hunt.disabled);
      });
      assert.equal(await page.locator("#action-hunt").isEnabled(), true, `${source} must expose the initial Stage 1 Hunt command.`);
      assert.equal(await page.locator("#view-result").isHidden(), true, `${source} must not falsely show a result overlay.`);
    };

    await importCampaignEnvelope(page, envelope, "abyssal-surge-briefing.json");
    await assertNormalizedStageOne("Importing an empty-trace briefing");
    assert.equal(navigation.count(), 0, "Importing an empty-trace briefing must not navigate the main frame.");
    const campaignUrl = page.url();

    await page.locator("#return-to-lobby").click();
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#campaign-screen").waitFor({ state: "hidden" });
    await page.locator("#campaign-resume-summary").waitFor({ state: "visible" });
    assert.equal(page.url(), campaignUrl, "Returning an imported briefing to the lobby must retain the campaign document URL.");
    assert.equal(navigation.count(), 0, "Returning an imported briefing to the lobby must not navigate the main frame.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    assert.equal(navigation.count(), 1, "The explicit imported-briefing reload must be the only main-frame navigation.");
    navigation.reset();

    let startConfirmationCount = 0;
    noStartConfirmation = (dialog) => {
      startConfirmationCount += 1;
      dialog.dismiss();
    };
    page.on("dialog", noStartConfirmation);
    await page.locator("#resume-campaign").click();
    await assertNormalizedStageOne("Resuming an imported empty-trace briefing");
    page.off("dialog", noStartConfirmation);
    noStartConfirmation = undefined;

    assert.equal(startConfirmationCount, 0, "Resuming an empty-trace briefing must not request a new-campaign confirmation.");
    assert.equal(page.url(), campaignUrl, "Resuming an imported briefing must retain the campaign document URL.");
    assert.equal(navigation.count(), 0, "Resuming an imported briefing must not navigate the main frame.");
    assert.deepEqual(
      (await exportCampaignEnvelope(page)).trace,
      [{ kind: "start" }],
      "Resuming an imported briefing must publicly export the normalized fresh Stage 1 start transition."
    );
  } finally {
    if (page && noStartConfirmation) page.off("dialog", noStartConfirmation);
    navigation?.dispose();
    await context.close();
  }
}

async function run() {
  let server;
  let browser;
  let context;
  let page;
  let clientErrors;

  try {
    const hosting = await startServer();
    server = hosting.server;
    browser = await playwright.chromium.launch({ headless: true });
    if (BRIDGE_ONLY_MODE) {
      await verifyGlbCanvasBridgeOnly(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_BRIDGE_PASS manifest=45 action-atlases=42 terrain-plates=3 status=loaded action=hunt");
      return;
    }
    if (STAGE_RAIL_SCROLL_MODE) {
      await verifyTransitionDrivenStageRailScrolling(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_STAGE_RAIL_SCROLL_PASS stages=1,2 calls=1-per-active-stage aria-current=step");
      return;
    }
    if (FALLBACK_TARGET_PARITY_MODE) {
      await verifyFallbackCanvasTargetParity(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_FALLBACK_TARGET_PARITY_PASS portal=materialize node=capture hidden-boss=rejected exposed-boss=assault ground=move-no-action");
      return;
    }
    if (COMPACT_CONTROL_JOURNEY_MODE) {
      await verifyCompactControlJourney(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_COMPACT_CONTROL_JOURNEY_PASS viewport=320x568 canvas=direct command=reachable button-hotkey=blocked canvas-hotkey=dispatched");
      return;
    }
    if (MOBILE_SAVE_CONTROLS_MODE) {
      await verifyMobileSaveControls(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_MOBILE_SAVE_CONTROLS_PASS viewport=360x800 controls=export,import ownership=save-dock");
      return;
    }
    if (COMPACT_FIELD_OVERLAY_MODE) {
      await verifyCompactFieldOverlay(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_COMPACT_FIELD_OVERLAY_PASS viewport=360x800 contexts=standard,reduced overlay=visible tactical-readout=visible controls=reachable canvas=unobstructed");
      return;
    }
    if (STAGE_THREE_CHECKLIST_MODE) {
      await verifyStageThreeChecklist(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_STAGE_THREE_CHECKLIST_PASS locales=ko,en optional=possess,domain current=assault");
      return;
    }
    if (DESKTOP_READABILITY_MODE) {
      await verifyDesktopReadability(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_DESKTOP_READABILITY_PASS viewport=1440x900 objective=readable resources=5 commands=7 skip-link=44x44");
      return;
    }
    if (RESUME_RENDERING_MODE) {
      await verifyResumeRendering(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_RESUME_RENDERING_PASS viewport=390x844 pre-reload-draws=positive post-resume-draws=positive fallback=hidden asset-status=loaded errors=0");
      return;
    }
    if (REALTIME_ONLY_MODE) {
      await verifyRealtimeThreeBattleOnly(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_REALTIME_PASS stage=Cinder Span renderer=webgl2 glb=terrain/cinder-span.glb readiness=loaded direct-control=changed action=hunt");
      return;
    }
    if (STAGE_ONE_ENCOUNTER_MODE) {
      await verifyStageOneEncounter(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_STAGE_ONE_ENCOUNTER_PASS schedule=8s-scout canvas=direct hud=visible controls=reachable");
      return;
    }
    if (SHORT_VIEWPORT_MODE) {
      await verifyShortViewportSemanticCommandReachability(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_SHORT_VIEWPORT_PASS viewport=1280x280 command=materialize scroll=disabled");
      return;
    }
    if (RENDERER_PARITY_MODE) {
      await verifyRendererIndependentBattleResolution(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_RENDERER_PARITY_PASS outcome=matched resolutions=normalized integrity-delta=matched actions=normalized start=shared");
      return;
    }
    const campaignFixtures = await createCampaignFixtures();
    await verifyRendererIndependentBattleResolution(browser, hosting.baseUrl);
    await verifyReducedMotionBattlePresentation(browser, hosting.baseUrl);
    await verifyShortViewportSemanticCommandReachability(browser, hosting.baseUrl);
    await verifyLobbyCampaignRoundTrip(browser, hosting.baseUrl);
    await verifyBriefingImportResume(browser, hosting.baseUrl, campaignFixtures.briefing);
    await verifyTerminalImportRoundTrip(browser, hosting.baseUrl, {
      fixtureName: "reward-pending",
      envelope: campaignFixtures.reward,
      assertResult: async (fixturePage) => {
        await fixturePage.locator("#reward-panel").waitFor({ state: "visible" });
        assert.ok(
          await fixturePage.locator("#reward-options button").count() > 0,
          "A resumed reward-pending campaign must expose one or more reward options."
        );
      }
    });
    await verifyTerminalImportRoundTrip(browser, hosting.baseUrl, {
      fixtureName: "defeat",
      envelope: campaignFixtures.defeat,
      assertResult: async (fixturePage) => {
        await fixturePage.locator("#retry-from-result").waitFor({ state: "visible" });
      }
    });
    await verifyTerminalImportRoundTrip(browser, hosting.baseUrl, {
      fixtureName: "campaign-complete",
      envelope: campaignFixtures.completed,
      assertResult: async (fixturePage) => {
        await fixturePage.locator("#campaign-complete").waitFor({ state: "visible" });
      }
    });

    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    clientErrors = collectClientErrors(page);
    const sourceGlbTrace = collectPageSourceGlbResponses(page);
    const moduleResponses = collectCampaignModuleResponses(page, hosting.baseUrl);
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText || "failed";
      const requestUrl = request.url();
      if (isTeardownAbortedBridgeAsset(requestUrl, errorText)) return;
      if (isExpectedBgmSceneHandoffAbort(requestUrl, errorText)) {
        clientErrors.expectedBgmAborts.push(`request (${requestOrigin(request)}): ${requestUrl} (${errorText})`);
      } else if (isOptionalMediaUrl(requestUrl)) {
        clientErrors.optionalMediaErrors.push(`request (${requestOrigin(request)}): ${requestUrl} (${errorText})`);
      } else {
        clientErrors.unexpectedErrors.push(`request (${requestOrigin(request)}): ${requestUrl} (${errorText})`);
      }
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      if (isOptionalMediaUrl(response.url())) {
        clientErrors.optionalMediaErrors.push(`response ${response.status()}: ${response.url()}`);
      } else {
        clientErrors.unexpectedErrors.push(`response ${response.status()}: ${response.url()}`);
      }
    });

    await page.goto(`${hosting.baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page, { baseUrl: hosting.baseUrl, responseTrace: moduleResponses });
    const worker = await verifyWorker(page, hosting.baseUrl);

    await page.locator("#lang-toggle").click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await startStageOneCampaign(page, { verifyBriefing: true, briefingLocale: "en" });
    await assertStageOneActiveCockpitLanguageTogglePreservesCampaignEnvelope(page);
    await runStageOne(page);
    await runStageTwo(page);
    await runStageThree(page);

    assertObservedSourceGlbPaths(sourceGlbTrace, ALL_SOURCE_GLB_PATHS, "Full campaign path");
    assertNoClientErrors(clientErrors, "Full campaign path");
    console.log(`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=${new URL(worker.scriptUrl).pathname} cache=${worker.cacheName} expected-bgm-aborts=${clientErrors.expectedBgmAborts.length} optional-media-errors=${clientErrors.optionalMediaErrors.length}`);
  } catch (error) {
    let screenshotPath = "";
    if (page) {
      try {
        screenshotPath = path.join(os.tmpdir(), "abyssal-surge-playtest-browser-failure.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        screenshotPath = "";
      }
    }
    console.error(`PLAYTEST_BROWSER_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    if (page) {
      try {
        const screenHtml = await page.evaluate(() => document.querySelector("#campaign-screen")?.outerHTML);
        console.error("Campaign screen HTML:", screenHtml);
      } catch (e) {
        console.error("Failed to get campaign screen HTML:", e.message);
      }
    }
    if (clientErrors && clientErrors.unexpectedErrors.length > 0) {
      console.error("Unexpected client errors:", clientErrors.unexpectedErrors.join("\n"));
    }
    if (screenshotPath) console.error(`Failure screenshot: ${screenshotPath}`);
    process.exitCode = 1;
  } finally {
    const cleanupFailures = [];
    if (context) {
      try {
        await context.close();
      } catch (error) {
        cleanupFailures.push(cleanupError("context close", error));
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        cleanupFailures.push(cleanupError("browser close", error));
      }
    }
    if (server) {
      try {
        await closeServer(server);
      } catch (error) {
        cleanupFailures.push(cleanupError("server close", error));
      }
    }
    if (cleanupFailures.length) {
      console.error(`PLAYTEST_BROWSER_CLEANUP_FAIL: ${cleanupFailures.join("; ")}`);
      process.exitCode = 1;
    }
  }
}

if (BRIDGE_CACHE_BOUNDARY_MODE) {
  verifyBridgeCacheBoundary()
    .then(() => console.log("PLAYTEST_BRIDGE_CACHE_BOUNDARY_PASS cached=manifest,asset rejected=traversal,cross-origin"))
    .catch((error) => {
      console.error(`PLAYTEST_BRIDGE_CACHE_BOUNDARY_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      process.exitCode = 1;
    });
} else if (SOURCE_CACHE_ADMISSION_MODE) {
  verifySourceCacheAdmission()
    .then(() => console.log("PLAYTEST_SOURCE_CACHE_ADMISSION_PASS rejected=200-text-html,204-gltf admitted=200-gltf-charset"))
    .catch((error) => {
      console.error(`PLAYTEST_SOURCE_CACHE_ADMISSION_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      process.exitCode = 1;
    });
} else if (MEDIA_ERROR_CLASSIFICATION_MODE) {
  try {
    verifyMediaErrorClassification();
    console.log("PLAYTEST_MEDIA_ERROR_CLASSIFICATION_PASS expected=bgm-scene-handoff-aborts rejected=wrong-error,other-audio,video,lookalike optional-media-gate=strict");
  } catch (error) {
    console.error(`PLAYTEST_MEDIA_ERROR_CLASSIFICATION_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exitCode = 1;
  }
} else if (playwright) {
  run();
}
