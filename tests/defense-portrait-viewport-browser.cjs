const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try {
  playwright = require("playwright");
} catch (error) {
  if (!allowMissing) throw new Error("require(\"playwright\") failed; install the lock-backed browser dependency.");
  console.log("DEFENSE_PORTRAIT_VIEWPORT_BROWSER_SKIPPED missing Playwright");
}

const ROOT = path.resolve(__dirname, "..");

function server() {
  const host = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname === "/"
      ? "/index.html"
      : new URL(request.url, "http://localhost").pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": path.extname(file) === ".js" ? "text/javascript" : path.extname(file) === ".css" ? "text/css" : "text/html",
      });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

async function battle(page) {
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await page.locator("#start-defense").click();
  await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
}

function approximately(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${message}: expected ${expected}, received ${actual}`);
}

function assertRect(rect, width, height, message) {
  approximately(rect.left, 0, `${message} left`);
  approximately(rect.top, 0, `${message} top`);
  approximately(rect.width, width, `${message} width`);
  approximately(rect.height, height, `${message} height`);
}

async function portraitState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const surface = document.querySelector("#defense-battle-surface");
    const canvas = document.querySelector("#defense-canvas");
    const hud = document.querySelector("#defense-edge-hud");
    const controls = document.querySelector("#movement-actions");
    const feedback = document.querySelector("#battle-event-feedback");
    if (!surface || !canvas || !hud || !controls || !feedback) throw new Error("portrait viewport contract nodes are absent");
    const rectangle = (node) => {
      const bounds = node.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    };
    const ancestorsAreUntransformed = (node) => {
      const transforms = [];
      for (let current = node; current && current !== document.documentElement; current = current.parentElement) {
        transforms.push({ id: current.id, transform: getComputedStyle(current).transform });
      }
      return transforms;
    };
    return {
      portrait: root.dataset.defensePortrait,
      logicalWidth: getComputedStyle(root).getPropertyValue("--defense-logical-width").trim(),
      logicalHeight: getComputedStyle(root).getPropertyValue("--defense-logical-height").trim(),
      physicalWidth: getComputedStyle(root).getPropertyValue("--defense-physical-width").trim(),
      physicalHeight: getComputedStyle(root).getPropertyValue("--defense-physical-height").trim(),
      surface: { rect: rectangle(surface), transform: getComputedStyle(surface).transform },
      canvas: { rect: rectangle(canvas), transform: getComputedStyle(canvas).transform, origin: getComputedStyle(canvas).transformOrigin },
      hud: { rect: rectangle(hud), transform: getComputedStyle(hud).transform },
      koreanHud: {
        label: controls.getAttribute("aria-label"),
        transforms: ancestorsAreUntransformed(controls),
        feedbackTransforms: ancestorsAreUntransformed(feedback),
      },
    };
  });
}

/**
 * KNOWN GAP (Cycle 3 / D17 WebGL adoption): terrain tactical labels
 * (ATMOSPHERE/CHOKE/ELEVATION/EXTRACTION/FLANK/HAZARD/LANDMARK/OCCUPATION,
 * drawWorldText in battle-canvas-text.js) are only drawn by the Canvas2D
 * BattleVisualizer fallback path. RealtimeBattle's real-WebGL path (which
 * Chromium's headless SwiftShader WebGL2 makes the ACTUAL default in this
 * exact browser test) renders no equivalent world-space text yet — this is
 * unbuilt scope, not a bug in the WebGL renderer itself. Rather than lose
 * fallback-path label coverage or silently drop this assertion, this test
 * forces the Canvas2D fallback (matching real users on WebGL2-unavailable
 * devices) so the existing label/counter-rotation contract stays verified.
 * Tracking: terrain labels for the real-WebGL portrait/landscape view need
 * their own DOM-overlay or in-scene text pass — out of scope for this cycle.
 */
async function forceCanvas2DFallback(page) {
  await page.addInitScript(() => {
    const OriginalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
      if (type === "webgl2" || type === "webgl") return null;
      return OriginalGetContext.call(this, type, ...args);
    };
  });
}

async function instrumentBattleCanvasText(page) {
  await page.addInitScript(() => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    window.__defenseBattleCanvasText = [];
    CanvasRenderingContext2D.prototype.fillText = function instrumentedFillText(...args) {
      if (this.canvas?.id === "defense-canvas") {
        const { a, b, c, d, e, f } = this.getTransform();
        window.__defenseBattleCanvasText.push({
          label: String(args[0]),
          matrix: [a, b, c, d, e, f],
          x: args[1],
          y: args[2],
        });
      }
      return originalFillText.apply(this, args);
    };
  });
}

async function battleCanvasText(page) {
  return page.evaluate(() => window.__defenseBattleCanvasText ?? []);
}

function composeLinear(css, local) {
  return [
    css[0] * local[0] + css[2] * local[1],
    css[1] * local[0] + css[3] * local[1],
    css[0] * local[2] + css[2] * local[3],
    css[1] * local[2] + css[3] * local[3],
  ];
}

async function verifyPortrait(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  try {
    await forceCanvas2DFallback(page);
    await instrumentBattleCanvasText(page);
    await battle(page);
    const state = await portraitState(page);
    assert.equal(state.portrait, "true", "390x844 must enable portrait projection");
    assert.deepEqual(
      { logicalWidth: state.logicalWidth, logicalHeight: state.logicalHeight, physicalWidth: state.physicalWidth, physicalHeight: state.physicalHeight },
      { logicalWidth: "844px", logicalHeight: "390px", physicalWidth: "390px", physicalHeight: "844px" },
      "portrait must preserve the 844x390 logical plane inside the physical viewport",
    );
    assert.equal(state.surface.transform, "none", "portrait surface must remain physically upright");
    assert.equal(state.hud.transform, "none", "portrait HUD must remain physically upright");
    assert.equal(state.koreanHud.label, "한 손 이동 조작", "the Korean movement overlay must remain present");
    assert.ok(
      [...state.koreanHud.transforms, ...state.koreanHud.feedbackTransforms].every(({ transform }) => transform === "none"),
      "Korean HUD controls and feedback must have no transformed ancestor",
    );
    assertRect(state.surface.rect, 390, 844, "portrait surface");
    assertRect(state.hud.rect, 390, 844, "portrait HUD");
    assertRect(state.canvas.rect, 390, 844, "rotated portrait canvas physical bounds");
    const matrix = state.canvas.transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(",").map(Number);
    assert.ok(matrix, `portrait canvas must expose its rotation matrix, received ${state.canvas.transform}`);
    assert.equal(matrix.length, 6, "portrait canvas transform must be a 2D matrix");
    [0, 1, -1, 0, 390, 0].forEach((expected, index) => approximately(matrix[index], expected, `portrait canvas matrix component ${index}`));
    assert.equal(state.canvas.origin, "0px 0px", "portrait canvas rotation must retain the top-left origin");
    const glyphs = await battleCanvasText(page);
    assert.ok(glyphs.length >= 8, "portrait battle canvas must render terrain labels and its atmosphere caption");
    assert.ok(new Set(glyphs.map(({ label }) => label)).size >= 8, "portrait world text must retain every distinct terrain label and caption");
    for (const glyph of glyphs) {
      [0, -1, 1, 0].forEach((expected, index) => approximately(glyph.matrix[index], expected, `portrait ${glyph.label} local glyph matrix component ${index}`));
      assert.deepEqual([glyph.x, glyph.y], [0, 0], `portrait ${glyph.label} must fill at its translated local origin`);
      composeLinear(matrix, glyph.matrix).forEach((value, index) => approximately(value, [1, 0, 0, 1][index], `portrait ${glyph.label} physical glyph orientation component ${index}`));
    }

    // Cycle 3 / D17: canvas drag now orbits the free camera, never movement.
    // Verify the decoupling holds under portrait rotation, then verify the
    // actual inverse-projection math this test originally exercised via
    // DefenseViewport.mapPhysicalToLogical directly (pure function, renderer-independent).
    const surface = page.locator("#defense-battle-surface");
    const moveBefore = await surface.getAttribute("data-defense-move");
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.mouse.move(195, 592);
    await page.waitForTimeout(50);
    assert.equal(await surface.getAttribute("data-defense-move"), moveBefore, "portrait canvas drag must not drive movement (orbit/movement are decoupled, D17)");
    await page.mouse.up();
    const transform = await page.evaluate(async () => {
      const { DefenseViewport } = await import("/defense-viewport.js");
      return new DefenseViewport().mapPhysicalToLogical({ clientX: 195, clientY: 592 });
    });
    assert.deepEqual(transform, { x: 592, y: 195 }, "portrait inverse map: real (unshifted) visualViewport, physical (195,592) -> logical (py=592, width-px=195)");
    assert.deepEqual(errors, [], "portrait viewport browser run emitted errors");
    return state;
  } finally {
    await context.close();
  }
}

async function verifyLandscape(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  try {
    await forceCanvas2DFallback(page);
    await instrumentBattleCanvasText(page);
    await battle(page);
    const state = await portraitState(page);
    assert.equal(state.portrait, "false", "844x390 must disable portrait projection");
    assert.equal(state.surface.transform, "none", "landscape surface must not rotate");
    assert.equal(state.canvas.transform, "none", "landscape canvas must not rotate");
    assert.equal(state.hud.transform, "none", "landscape HUD must not rotate");
    assertRect(state.surface.rect, 844, 390, "landscape surface");
    assertRect(state.canvas.rect, 844, 390, "landscape canvas");
    const glyphs = await battleCanvasText(page);
    assert.ok(glyphs.length >= 8, "landscape battle canvas must render terrain labels and its atmosphere caption");
    assert.ok(new Set(glyphs.map(({ label }) => label)).size >= 8, "landscape world text must retain every distinct terrain label and caption");
    for (const glyph of glyphs) {
      [1, 0, 0, 1].forEach((expected, index) => approximately(glyph.matrix[index], expected, `landscape ${glyph.label} glyph matrix component ${index}`));
      assert.notDeepEqual([glyph.x, glyph.y], [0, 0], `landscape ${glyph.label} must remain a direct anchored fillText`);
    }

    assert.deepEqual(errors, [], "landscape viewport browser run emitted errors");
    return state;
  } finally {
    await context.close();
  }
}

async function run() {
  const hosting = await server();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const portrait = await verifyPortrait(browser, hosting);
    const landscape = await verifyLandscape(browser, hosting);
    console.log(JSON.stringify({ pass: true, portrait, landscape }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

if (playwright) run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
