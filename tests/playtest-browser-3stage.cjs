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
const STATIC_CACHE_NAME = "abyssal-surge-static-v25";
let playwright;
if (!BRIDGE_CACHE_BOUNDARY_MODE && !SOURCE_CACHE_ADMISSION_MODE) {
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
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
});

const STAGE_ONE_SOURCE_GLB_RESPONSES = Object.freeze([
  Object.freeze({ path: "/assets/models/abyssal-command/terrain/cinder-span.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/shade.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/units/scout.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
  Object.freeze({ path: "/assets/models/abyssal-command/bosses/cinder-warden.glb", status: 200, contentType: "model/gltf-binary", fromServiceWorker: true }),
]);

const STAGE_ONE_SOURCE_GLB_PATHS = new Set(STAGE_ONE_SOURCE_GLB_RESPONSES.map((response) => response.path));

const ALL_SOURCE_GLB_PATHS = new Set([
  "/assets/models/abyssal-command/terrain/cinder-span.glb",
  "/assets/models/abyssal-command/terrain/veil-citadel.glb",
  "/assets/models/abyssal-command/terrain/echo-throne-steps.glb",
  "/assets/models/abyssal-command/units/shade.glb",
  "/assets/models/abyssal-command/units/scout.glb",
  "/assets/models/abyssal-command/bosses/cinder-warden.glb",
  "/assets/models/abyssal-command/bosses/veil-tactician.glb",
  "/assets/models/abyssal-command/bosses/gate-sovereign.glb",
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

  assert.equal(fixture.fetchRecords.length, 1, "Bridge cache prewarming must fetch exactly one manifest.");
  assert.equal(fixture.fetchRecords[0].request, manifestPath, "Bridge cache prewarming must fetch the bridge manifest.");
  assert.equal(fixture.fetchRecords[0].options?.cache, "no-store", "Bridge manifest prewarming must bypass the HTTP cache.");
  assert.equal(fixture.cachePuts.length, 1, "Bridge manifest must be retained in the cache.");
  assert.equal(fixture.cachePuts[0].request, manifestPath, "Only the bridge manifest request may be stored directly.");
  assert.deepEqual(
    fixture.cacheAdds,
    [expectedBridgeAsset],
    "Bridge cache prewarming must admit the canonical bridge output and reject every malicious or malformed manifest candidate."
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

function isTeardownAbortedBridgeAsset(url, errorText) {
  try {
    return new URL(url).pathname.startsWith("/assets/images/battle/glb/") && errorText === "net::ERR_ABORTED";
  } catch {
    return false;
  }
}
function collectClientErrors(page) {
  const unexpectedErrors = [];
  const optionalMediaErrors = [];
  page.on("pageerror", (error) => unexpectedErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    console.log(`PAGE LOG [${message.type()}]:`, message.text());
    if (message.type() !== "error") return;
    const sourceUrl = message.location().url || "";
    if (isOptionalMediaUrl(sourceUrl)) {
      optionalMediaErrors.push(`console: ${sourceUrl}`);
    } else {
      unexpectedErrors.push(`console: ${message.text()}${sourceUrl ? ` (${sourceUrl})` : ""}`);
    }
  });
  return { unexpectedErrors, optionalMediaErrors };
}

function assertNoClientErrors(errors, scenario) {
  assert.deepEqual(errors.unexpectedErrors, [], `${scenario} emitted unexpected client errors:\n${errors.unexpectedErrors.join("\n")}`);
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


function collectStrictClientErrors(page) {
  const errors = collectClientErrors(page);
  let teardownStarted = false;
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "failed";
    if (teardownStarted && isTeardownAbortedRealtimeAsset(request.url(), errorText)) return;
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
  assert.equal(await text(page.locator("#stage-number")), `Stage ${number} of 3`, `Stage ${number} number must be visible.`);
  assert.equal(await text(page.locator("#stage-heading")), heading, `Stage ${number} heading must be visible.`);
  assert.equal(await page.locator(`#stage-select-${number}`).getAttribute("aria-current"), "step", `Stage ${number} selector must identify the active stage.`);
}
async function assertBattleVisualizationStatus(page, number) {
  const status = await text(page.locator("#campaign-status"));
  if (status.includes("Battle visualization is unavailable")) {
    assert.equal(
      status,
      "Battle visualization is unavailable; command rules remain ready.",
      `Stage ${number} must expose the explicit visualizer fallback while retaining command controls.`
    );
  }
}
const BATTLE_PRESENTATIONS = Object.freeze({
  1: Object.freeze({
    operation: "Operation: Ember Break",
    doctrine: "Open the forge lane, raise shades, then sever the Warden's hold."
  }),
  2: Object.freeze({
    operation: "Operation: Veil Breach",
    doctrine: "Hold both signal nodes before the Tactician closes the listening routes."
  }),
  3: Object.freeze({
    operation: "Operation: Thronefall",
    doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate."
  })
});

async function assertBattlePresentation(page, number) {
  const presentation = BATTLE_PRESENTATIONS[number];
  assert.ok(presentation, `Stage ${number} must have a player-facing battle presentation.`);

  const brief = page.locator("#battle-tactical-brief");
  await brief.waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#battle-operation")), presentation.operation, `Stage ${number} must expose its operation in the visible battle brief.`);
  assert.equal(await text(page.locator("#battle-doctrine")), presentation.doctrine, `Stage ${number} must expose its doctrine in the visible battle brief.`);

  const fallback = page.locator("#battle-visual-fallback");
  if (await fallback.isVisible()) {
    assert.equal(
      await text(fallback.locator(".battle-fallback-kicker")),
      "Static tactical briefing",
      `Stage ${number} fallback must describe a static tactical briefing, not a map.`
    );
    assert.equal(await text(page.locator("#battle-fallback-operation")), presentation.operation, `Stage ${number} fallback must retain the current operation.`);
    assert.equal(await text(page.locator("#battle-fallback-doctrine")), presentation.doctrine, `Stage ${number} fallback must retain the current doctrine.`);
    assert.equal(
      await text(page.locator("#battle-pressure")),
      "Static tactical fallback: rendering is unavailable, but command rules remain active.",
      `Stage ${number} fallback must truthfully report static rendering rather than active visual animation.`
    );
  }
}

async function assertDirectSourceGlbReadiness(page) {
  await page.waitForFunction(() => document.querySelector("#battle-asset-status")?.dataset.state === "loaded", undefined, { timeout: 30_000 });
  const status = await text(page.locator("#battle-asset-status"));
  assert.match(
    status,
    /^(?:Source GLB atlases 4\/4 · \d+ action clips active|GLB 소스 아틀라스 4\/4 · 동작 클립 \d+개 활성)$/,
    "The tactical brief must visibly report that all four direct-renderer source GLBs and their action clips are ready."
  );
  assert.doesNotMatch(
    status,
    /(?:fallback|대체)/iu,
    "Once the direct source GLBs load, tactical status must not report a rendering fallback."
  );
}


async function clickEnabledAction(page, selector, { assertCampaignSurface = true } = {}) {
  const action = page.locator(selector);
  const timeoutAt = Date.now() + 30_000;
  await action.waitFor({ state: "visible" });
  while (Date.now() < timeoutAt) {
    if (!(await action.isEnabled())) {
      await page.waitForTimeout(100);
      continue;
    }
    const beforeAction = assertCampaignSurface ? await campaignSurface(page) : undefined;
    await action.click({ timeout: 5_000, noWaitAfter: true });
    const disabledAt = Date.now() + 5_000;
    while (await action.isEnabled()) {
      if (Date.now() >= disabledAt) {
        assert.fail(`${selector} did not enter its visible cooldown after being clicked.`);
      }
      await page.waitForTimeout(25);
    }
    if (assertCampaignSurface) {
      assert.notDeepEqual(
        await campaignSurface(page),
        beforeAction,
        `${selector} must visibly advance campaign state after its click.`,
      );
    }
    return;
  }
  assert.fail(`${selector} did not become stably enabled before its visible cooldown expired.`);
}

async function runActions(page, selectors) {
  for (const selector of selectors) {
    await clickEnabledAction(page, selector);
  }
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

const BATTLE_BREACH_TIMEOUT_MS = 50_000;
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
  await page.waitForFunction(
    () => document.querySelector("#save-status")?.textContent.startsWith("Imported campaign saved in "),
    undefined,
    { timeout: 10_000 }
  );
}

function acceptedCampaignTransition(result, label) {
  assert.equal(result.accepted, true, label ?? result.message);
  return result.state;
}

async function createCampaignFixtures() {
  const {
    applyAction,
    applyEncounterEvent,
    chooseReward,
    createCampaign,
    createSaveEnvelope,
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
  const stageOneEncounter = [
    { type: "start-wave", waveId: "scout" },
    { type: "wave-cleared", waveId: "scout" },
    { type: "start-wave", waveId: "guard" },
    { type: "wave-cleared", waveId: "guard" },
    { type: "start-wave", waveId: "reinforcement" },
    { type: "wave-cleared", waveId: "reinforcement" },
  ];
  const stageOneVictory = ["hunt", "hunt", "extract", "materialize", "materialize", "capture", ...stageOneEncounter, "assault", "assault", "assault"];
  const stageTwoVictory = ["hunt", "hunt", "extract", "materialize", "materialize", "capture", "capture", "possess", "assault", "assault"];
  const stageThreeVictory = ["capture", "domain", "possess", "assault", "assault"];

  const briefing = createCampaign();
  const reward = commands(start(), stageOneVictory);

  let defeat = commands(start(), [{ type: "start-wave", waveId: "scout" }]);
  while (defeat.status === "active") {
    defeat = acceptedCampaignTransition(
      applyEncounterEvent(defeat, { type: "breach", stageId: defeat.stageId, waveId: defeat.stage.encounter.activeWaveId }),
      "Campaign fixture encounter breach must be accepted."
    );
  }

  let completed = acceptedCampaignTransition(chooseReward(reward, "rift-lens"), "Stage 1 fixture reward must be accepted.");
  completed = acceptedCampaignTransition(
    chooseReward(commands(completed, stageTwoVictory), "veil-vanguard"),
    "Stage 2 fixture reward must be accepted."
  );
  completed = acceptedCampaignTransition(
    chooseReward(commands(completed, stageThreeVictory), "throne-echo"),
    "Stage 3 fixture reward must be accepted."
  );

  assert.equal(briefing.status, "briefing", "Briefing fixture must retain an empty trace.");
  assert.deepEqual(briefing.trace, [], "Briefing fixture must contain no campaign progress.");
  assert.equal(reward.status, "reward", "Reward fixture must await a reward selection.");
  assert.equal(defeat.status, "defeat", "Defeat fixture must end in defeat.");
  assert.equal(completed.status, "campaign-complete", "Completed fixture must end in campaign completion.");

  return Object.freeze({
    briefing: createSaveEnvelope(briefing),
    reward: createSaveEnvelope(reward),
    defeat: createSaveEnvelope(defeat),
    completed: createSaveEnvelope(completed)
  });
}

function isSerializedEncounterBreach(event) {
  return event?.kind === "encounter" && event.event?.type === "breach";
}

async function awaitTimedBattleBreachBatch(page, entryIntegrity) {
  await page.waitForFunction(
    (initialIntegrity) => Number.parseInt(document.querySelector("#integrity-value")?.textContent || "", 10) < initialIntegrity,
    entryIntegrity,
    { polling: 20, timeout: BATTLE_BREACH_TIMEOUT_MS }
  );
  await page.waitForTimeout(250);

  const trace = await campaignTrace(page);
  const breaches = trace.filter(isSerializedEncounterBreach);
  const integrity = Number.parseInt(await text(page.locator("#integrity-value")), 10);
  assert.ok(breaches.length > 0, "The scheduled battle wave must serialize at least one encounter breach event.");
  assert.ok(integrity < entryIntegrity, "The rendered battle integrity must drop after a scheduled breach.");
  return Object.freeze({
    integrity,
    trace: trace.map((event) => event.kind === "action" ? { kind: event.kind, action: event.action } : event.kind === "encounter" ? { kind: event.kind, event: event.event } : { kind: event.kind })
  });
}

async function materializeStageOneAllies(page, context) {
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize"]);
  assert.equal(
    await text(page.locator("#legion-value")),
    "2 / 10",
    `${context} must legally materialize the first two public legion allies before the Scout wave arrives.`
  );
}

async function awaitStageOneScoutEngagementBeforeBreach(page, context) {
  const traceBeforeScout = await campaignTrace(page);
  assert.equal(
    traceBeforeScout.some(isSerializedEncounterBreach),
    false,
    `${context} must not record a campaign breach before the inbound Stage 1 Scout wave reaches allied defenders.`
  );

  await page.waitForFunction(
    () => /SCOUT · 2 HOSTILES/.test(document.querySelector("#battle-hostile-label")?.textContent || ""),
    undefined,
    { timeout: STAGE_ONE_ENGAGEMENT_TIMEOUT_MS }
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
const STAGE_ONE_OBJECTIVE = "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, clear three assault waves, then break the Cinder Warden.";
const STAGE_ONE_OPERATION = "Operation: Ember Break";
const STAGE_ONE_DOCTRINE = "Open the forge lane, raise shades, then sever the Warden's hold.";
const STAGE_ONE_FIRST_ORDER = "First order: Hunt two rift spoor.";
const STAGE_TRANSITION_BRIEFINGS = Object.freeze({
  2: Object.freeze({
    stage: "Stage 2 · Veil Citadel",
    region: "A fortress of listening stone",
    objective: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil.",
    operation: "Operation: Veil Breach",
    doctrine: "Hold both signal nodes before the Tactician closes the listening routes.",
    boss: "Veil Tactician"
  }),
  3: Object.freeze({
    stage: "Stage 3 · Echo Throne",
    region: "The gate above the last remembered sea",
    objective: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign.",
    operation: "Operation: Thronefall",
    doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate.",
    boss: "Gate Sovereign"
  })
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

async function assertStageTransitionBriefing(page, facts, context) {
  const briefing = page.locator("#stage-briefing");
  await briefing.waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#briefing-stage")), facts.stage, `${context} must identify the next stage.`);
  assert.equal(await text(page.locator("#briefing-region")), facts.region, `${context} must state the next stage region.`);
  assert.equal(await text(page.locator("#briefing-objective")), facts.objective, `${context} must state the next stage objective.`);
  assert.equal(await text(page.locator("#briefing-operation")), facts.operation, `${context} must state the next stage operation.`);
  assert.equal(await text(page.locator("#briefing-doctrine")), facts.doctrine, `${context} must state the next stage doctrine.`);
  assert.equal(await text(page.locator("#briefing-boss")), facts.boss, `${context} must identify the next stage target.`);
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

async function assertStageOneBriefing(page) {
  const briefing = page.locator("#stage-briefing");
  await briefing.waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#briefing-objective")), STAGE_ONE_OBJECTIVE, "The first-run briefing must state the full Stage 1 objective.");
  assert.equal(await text(page.locator("#briefing-operation")), STAGE_ONE_OPERATION, "The first-run briefing must name Operation: Ember Break.");
  assert.equal(await text(page.locator("#briefing-doctrine")), STAGE_ONE_DOCTRINE, "The first-run briefing must state the Stage 1 doctrine.");
  assert.equal(await text(page.locator("#briefing-boss")), "Cinder Warden", "The first-run briefing must identify the Cinder Warden as the target.");
  assert.match(
    await text(briefing),
    /(?:황혼의 감시자|Twilight Watcher)/,
    "The first-run briefing must show the player's commander identity."
  );
  assert.equal(await page.locator("#start-combat").isEnabled(), true, "The first-run briefing must provide an enabled combat acknowledgement.");
  await page.locator("#start-combat").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator("#start-combat").evaluate((button) => document.activeElement === button),
    true,
    "Tabbing from the briefing acknowledgement must remain trapped in the modal rather than reaching an inert cockpit control."
  );
  await assertBriefingCommandGate(page, "The first-run briefing");
}

async function acknowledgeStageOneBriefing(page) {
  return acknowledgeStageBriefing(page, {
    stageNumber: 1,
    firstOrder: STAGE_ONE_FIRST_ORDER
  });
}

async function startStageOneCampaign(page, { verifyBriefing = false } = {}) {
  const acceptRestart = (dialog) => dialog.accept();
  page.once("dialog", acceptRestart);
  await page.waitForTimeout(50);
  await page.locator("#start-campaign").click();
  await page.locator("#campaign-screen").waitFor({ state: "visible" });
  if (verifyBriefing) await assertStageOneBriefing(page);
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
    assert.equal(surface.ariaLabel, "Direct tactical battlefield", "Stage 1 must expose the primary direct-control battlefield by its accessible name.");
    assert.equal(surface.ariaDescribedBy, "battle-direct-help", "Stage 1 must connect the battlefield to the public direct-control HUD.");
    assert.equal(surface.tabIndex, 0, "Stage 1 tactical battlefield must be keyboard-focusable.");
    assert.ok(surface.width > 0 && surface.height > 0, `Stage 1 direct-control canvas must have a visible surface; observed ${surface.width}×${surface.height}.`);
    assert.equal(surface.legacyTargetCount, 0, "The direct-control battlefield must replace legacy absolute battle-target buttons.");
    assert.notEqual(surface.fallbackVisible, true, "Stage 1 must keep the explicit fallback hidden while the WebGL renderer is ready.");
    const directHelp = await text(page.locator("#battle-direct-help"));
    assert.match(
      directHelp,
      /Focus the field.*hold WASD.*Drag to orbit.*click ground/,
      "Stage 1 must expose direct movement, camera, and rally controls in its tactical HUD."
    );

    const assetStatus = await text(page.locator("#battle-asset-status"));
    assert.match(
      assetStatus,
      /^(?:Source GLB atlases 4\/4 · \d+ action clips active|GLB 소스 아틀라스 4\/4 · 동작 클립 \d+개 활성)$/,
      "The direct renderer must publicly report successful readiness for all four Stage 1 source GLBs."
    );
    assert.equal(await page.locator("#battle-asset-status").getAttribute("data-state"), "loaded", "The direct renderer must expose its loaded readiness state.");
    assert.deepEqual(
      sourceGlbTrace.records,
      STAGE_ONE_SOURCE_GLB_RESPONSES,
      "The local static HTTP server must serve each actual Stage 1 source GLB exactly once as a successful service-worker-backed glTF binary response."
    );

    await canvas.focus();
    assert.equal(
      await canvas.evaluate((element) => document.activeElement === element),
      true,
      "The tactical canvas must receive focus before direct keyboard control."
    );
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

    const beforeAction = await campaignSurface(page);
    await materializeStageOneAllies(page, "Focused real-time Three Stage 1 battle");
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
    await awaitStageOneScoutEngagementBeforeBreach(page, "Focused real-time Three Stage 1 battle");
    console.log(`PLAYTEST_BROWSER_REALTIME_GLB_RESPONSES ${JSON.stringify(sourceGlbTrace.records)}`);
    assertObservedSourceGlbPaths(sourceGlbTrace, STAGE_ONE_SOURCE_GLB_PATHS, "Focused real-time Three Stage 1 battle");
    assertNoStrictClientErrors(strictErrors, "Focused real-time Three Stage 1 battle");
  } finally {
    strictErrors?.beginTeardown();
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
    let activatedAt;
    try {
      await waitForCampaignBoot(page, { baseUrl, responseTrace: moduleResponses, requireStartControlReady: true });
      await verifyWorker(page, baseUrl);
      activatedAt = await startStageOneCampaign(page);
    } catch (error) {
      await appendCampaignModuleEvidence(error, page, baseUrl, moduleResponses);
      throw error;
    }
    await enterBattle(page, 1, "Cinder Span");
    await assertDirectSourceGlbReadiness(page);
    await assertBattleCanvasBlankPassThrough(page);

    const desktopLayout = await page.evaluate(() => {
      const canvas = document.querySelector("#battle-canvas-3d");
      const field = document.querySelector("#battle-field");
      const hud = document.querySelector(".field-edge-hud");
      const pressure = document.querySelector("#battle-pressure");
      const waveIndicator = document.querySelector("#battle-wave-indicator");
      const controls = [...document.querySelectorAll("#command-panel [data-action]")];
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
        waveIndicator: waveIndicator?.textContent?.trim(),
        horizontalOverflow: document.scrollingElement.scrollWidth > window.innerWidth,
        campaignScroll: document.scrollingElement.scrollHeight > window.innerHeight,
      };
    });
    assert.equal(desktopLayout.fieldContainsCanvas, true, "Stage 1 must keep the direct tactical canvas inside its visible battlefield.");
    assert.equal(desktopLayout.canvas?.hidden, false, "Stage 1 must expose the direct tactical canvas rather than only a fallback.");
    assert.ok(desktopLayout.canvas?.width > 0 && desktopLayout.canvas?.height > 0, "Stage 1 direct tactical canvas must have a visible field-sized box.");
    assert.ok(desktopLayout.hud?.width > 0 && desktopLayout.hud?.height > 0, "Stage 1 must expose a visible tactical field HUD.");
    const sampledHudState = [
      {
        pressure: "Preparation window: issue commands before the first hostile wave enters the lane.",
        waveIndicator: /PREPARATION · WAVE 1\/3 · SCOUT/,
      },
      {
        pressure: "Live-wave pressure: keep the command pad active while hostiles cross the lane.",
        waveIndicator: /LIVE WAVE · 1\/3 · SCOUT/,
      },
    ].find(({ pressure, waveIndicator }) => (
      desktopLayout.pressure === pressure && waveIndicator.test(desktopLayout.waveIndicator ?? "")
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
    assert.equal(desktopLayout.horizontalOverflow, false, "Desktop Stage 1 must not create horizontal campaign overflow.");
    assert.equal(desktopLayout.campaignScroll, false, "Desktop Stage 1 must not create document-level campaign scrolling.");

    await page.waitForFunction(
      () => /SCOUT · 2 HOSTILES/.test(document.querySelector("#battle-hostile-label")?.textContent || ""),
      undefined,
      { timeout: 15_000 },
    );
    const elapsed = Date.now() - activatedAt;
    assert.ok(elapsed >= 7_000, `Stage 1 Scout wave must honor the declared 8-second preparation window; it appeared after ${elapsed}ms.`);
    assert.equal(
      await text(page.locator("#battle-pressure")),
      "Live-wave pressure: keep the command pad active while hostiles cross the lane.",
      "The scheduled Stage 1 Scout wave must update the field HUD from preparation to live-wave pressure."
    );
    assert.match(
      await text(page.locator("#battle-wave-indicator")),
      /LIVE WAVE · 1\/3 · SCOUT/,
      "The scheduled Stage 1 Scout wave must publish its active runtime status through the tactical wave badge."
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
    await startStageOneCampaign(page);
    const entryIntegrity = Number.parseInt(await enterBattle(page, 1, "Cinder Span"), 10);

    if (failCanvas) {
      assert.equal(await page.locator("#battle-canvas-3d").isHidden(), true, "A failed WebGL2 direct renderer must reveal the static tactical fallback instead of a blank battlefield.");
      assert.equal(await page.locator("#battle-canvas-fallback").isVisible(), true, "A failed WebGL2 direct renderer must expose the 2D fallback canvas.");
      assert.equal(await page.locator("#battle-visual-fallback").isVisible(), true, "A failed WebGL2 direct renderer must expose the tactical fallback brief.");
      assert.match(
        await text(page.locator("#campaign-status")),
        /^(?:Battle visualization is unavailable; command rules remain ready\.|First order: Hunt two rift spoor\.)$/,
        "The fallback must retain either its truthful rendering notice or the acknowledged first-order guidance."
      );
      assert.equal(await page.locator("#action-hunt").isEnabled(), true, "The fallback must keep the initial Hunt command available after the briefing acknowledgement.");
      assert.equal(await page.locator("[data-battle-target]").count(), 0, "The fallback must not resurrect removed absolute battle-target controls.");
    }
    if (!failCanvas) {
      assert.equal(
        await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        false,
        "The renderer-enabled parity path must run without reduced-motion preference before waiting for live-wave breaches."
      );
      assert.equal(await page.locator("#battle-visual-fallback").isHidden(), true, "A functioning WebGL2 direct renderer must keep the static tactical fallback card hidden.");
    }

    await materializeStageOneAllies(page, failCanvas ? "Canvas fallback battle path" : "Rendered battle path");
    await awaitStageOneScoutEngagementBeforeBreach(page, failCanvas ? "Canvas fallback battle path" : "Rendered battle path");

    const breach = await awaitTimedBattleBreachBatch(page, entryIntegrity);
    if (failCanvas) {
      assert.equal(
        await text(page.locator("#battle-pressure")),
        "Static tactical fallback: rendering is unavailable, but command rules remain active.",
        "The first scheduled fallback breach must not overwrite the truthful static battle pressure."
      );
      assert.equal(
        await text(page.locator("#battle-wave-indicator")),
        "STATIC TACTICAL BRIEFING · COMMAND SCHEDULE ACTIVE",
        "The first scheduled fallback breach must retain the static tactical briefing command schedule instead of a live-wave label."
      );
    }
    if (failCanvas) await verifyCommandCooldown(page);
    assertNoClientErrors(clientErrors, failCanvas ? "Canvas fallback battle path" : "Rendered battle path");
    return breach;
  } finally {
    await context.close();
  }
}

async function verifyRendererIndependentBattleBreach(browser, baseUrl) {
  const rendered = await runBattleParityPath(browser, baseUrl);
  const fallback = await runBattleParityPath(browser, baseUrl, { failCanvas: true });
  const renderedBreaches = rendered.trace.filter(isSerializedEncounterBreach);
  const fallbackBreaches = fallback.trace.filter(isSerializedEncounterBreach);
  const renderedActions = rendered.trace.filter((event) => event.kind === "action");
  const fallbackActions = fallback.trace.filter((event) => event.kind === "action");

  assert.ok(renderedBreaches.length > 0, "The renderer-enabled battle path must record one or more serialized encounter breach events.");
  assert.ok(fallbackBreaches.length > 0, "The Canvas-fallback battle path must record one or more serialized encounter breach events.");
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


async function runStageOne(page) {
  const entryIntegrity = await enterBattle(page, 1, "Cinder Span");
  await assertDirectSourceGlbReadiness(page);
  await assertBattleCanvasBlankPassThrough(page);
  for (const action of ["materialize", "capture", "assault"]) {
    assert.equal(
      await page.locator(`#action-${action}`).isEnabled(),
      false,
      `Stage 1 semantic ${action} must start disabled until its command prerequisites are met.`
    );
  }

  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract"]);
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
  await assertPreparationIntegrity(page, 1, entryIntegrity);
  const preparationEncounterTrace = (await campaignTrace(page)).filter((event) => event.kind === "encounter");
  assert.equal(
    preparationEncounterTrace.length,
    0,
    "Stage 1 encounter waves must wait until the wave-clearing legion and forge node are ready.",
  );

  await page.waitForFunction(
    () => /Cinder Warden · 8\/8 HP/.test(document.querySelector("#battle-hostile-label")?.textContent || ""),
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
  assert.match(await text(page.locator("#campaign-status")), /Rift Lens carries into Veil Citadel\./, "Stage 2 must visibly report the selected Stage 1 boon.");
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
  assert.match(await text(page.locator("#campaign-status")), /Veil Vanguard carries into Echo Throne\./, "Stage 3 must visibly report the selected Stage 2 boon.");
}

async function runStageThree(page) {
  const entryIntegrity = await enterBattle(page, 3, "Echo Throne");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-materialize", "#action-capture"]);
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
  assert.equal(
    await text(page.locator("#campaign-status")),
    "A sentinel's will is folded into your command; its fury rides your assaults.",
    "After Stage 3 Extract clears entry guidance, Possess must publish its sentinel command result instead of restoring the first-order prompt."
  );
  await runActions(page, ["#action-domain"]);
  await assertPreparationIntegrity(page, 3, entryIntegrity);
  assert.equal(await text(page.locator("#legion-value")), "8 / 10", "Two materializations must grow the Veil Vanguard from four to eight shades.");
  await runActions(page, ["#action-assault", "#action-assault"]);
  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  assert.deepEqual(
    await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId)),
    ["throne-echo", "dawnless-crown"],
    "Stage 3 must offer its current two terminal reward choices."
  );
  await page.locator('[data-reward-id="throne-echo"]').click();
  await page.locator("#campaign-complete").waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#completion-heading")), "가라앉은 문이 침묵하다", "Terminal completion heading must be visible.");
  assert.match(await text(page.locator("#completion-summary")), /Throne Echo is claimed\. The Gate Sovereign is gone, and Abyssal Command endures\./, "Terminal completion summary must confirm the final reward and victory.");
  assert.equal(await page.locator("#reward-panel").isHidden(), true, "No reward chooser may remain after the terminal selection.");
  for (const number of [1, 2, 3]) {
    const label = await page.locator(`#stage-select-${number}`).getAttribute("aria-label") || "";
    assert.match(label, /cleared/, `Stage ${number} must be marked cleared at completion.`);
  }
}

function cleanupError(label, error) {
  return `${label}: ${error instanceof Error ? error.message : String(error)}`;
}
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
    STATIC_CACHE_NAME,
    "sw.js must declare the v25 static cache revision that atomically precaches the current campaign modules."
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
    "The v25 worker cache must atomically precache the application entry, campaign-state, and stage-navigation modules."
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
    const stageSelector = page.locator("#stage-selector");
    await stageSelector.waitFor({ state: "visible" });
    const { clientWidth, scrollWidth } = await stageSelector.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }));
    assert.ok(
      scrollWidth <= clientWidth,
      `The 390px stage selector must not overflow horizontally; observed scrollWidth=${scrollWidth}, clientWidth=${clientWidth}.`
    );
  } finally {
    navigation?.dispose();
    await context.close();
  }
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
    assert.equal(navigation.count(), 0, `Public ${fixtureName} import must not navigate the main frame.`);

    const campaignUrl = page.url();
    await page.locator("#return-to-lobby-from-result").click();
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#campaign-screen").waitFor({ state: "hidden" });
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
      await verifyRendererIndependentBattleBreach(browser, hosting.baseUrl);
      console.log("PLAYTEST_BROWSER_RENDERER_PARITY_PASS direct=breach fallback=breach actions=normalized start=shared");
      return;
    }
    const campaignFixtures = await createCampaignFixtures();
    await verifyRendererIndependentBattleBreach(browser, hosting.baseUrl);
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
      if (isTeardownAbortedBridgeAsset(request.url(), errorText)) return;
      if (isOptionalMediaUrl(request.url())) {
        clientErrors.optionalMediaErrors.push(`request (${requestOrigin(request)}): ${request.url()}`);
      } else {
        clientErrors.unexpectedErrors.push(`request (${requestOrigin(request)}): ${request.url()} (${errorText})`);
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

    await startStageOneCampaign(page, { verifyBriefing: true });
    await runStageOne(page);
    await runStageTwo(page);
    await runStageThree(page);

    assertObservedSourceGlbPaths(sourceGlbTrace, ALL_SOURCE_GLB_PATHS, "Full campaign path");
    assertNoClientErrors(clientErrors, "Full campaign path");
    console.log(`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=${new URL(worker.scriptUrl).pathname} cache=${worker.cacheName} optional-media-errors=${clientErrors.optionalMediaErrors.length}`);
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
    .then(() => console.log("PLAYTEST_BRIDGE_CACHE_BOUNDARY_PASS cached=1 rejected=traversal,cross-origin"))
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
} else if (playwright) {
  run();
}
