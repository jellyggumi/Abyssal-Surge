const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

let playwright;
try {
  playwright = require("playwright");
} catch (error) {
  if (error?.code === "MODULE_NOT_FOUND") {
    console.error('BATTLE_HUD_RESPONSIVE_BROWSER_FAIL: require("playwright") could not resolve.');
    process.exitCode = 1;
  } else {
    throw error;
  }
}

const ROOT = path.resolve(__dirname, "..");
const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1024, height: 720, entry: "start" }),
  Object.freeze({ width: 1024, height: 500, entry: "resume" }),
]);
const EXPECTED_ACTIONS = Object.freeze([
  "hunt",
  "extract",
  "materialize",
  "capture",
  "possess",
  "domain",
  "assault",
]);
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
  ".svg": "image/svg+xml",
  ".vtt": "text/vtt; charset=utf-8",
  ".webp": "image/webp",
});

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

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": stats.size,
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
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
  assert(address && typeof address === "object", "The local browser server must bind an address.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function waitForCampaignBoot(page) {
  await page.locator("#campaign-lobby").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const start = document.querySelector("#start-campaign");
    return start instanceof HTMLButtonElement && !start.disabled;
  });
}

async function waitForLiveCampaign(page) {
  await page.locator("#campaign-screen").waitFor({ state: "visible" });
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.locator("#command-panel").waitFor({ state: "visible" });
  await page.locator("#battle-canvas-3d").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#battle-asset-status")?.dataset.state === "loaded",
    undefined,
    { timeout: 30_000 },
  );
}

async function startCampaign(page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#start-campaign").click();
  await page.locator("#stage-briefing").waitFor({ state: "visible" });
  await page.locator("#start-combat").click();
  await page.locator("#stage-briefing").waitFor({ state: "hidden" });
  await waitForLiveCampaign(page);
}

async function resumeCampaign(page, envelope) {
  await page.locator("#import-save").setInputFiles({
    name: "battle-hud-responsive-resume.json",
    mimeType: "application/json",
    buffer: envelope,
  });
  await waitForLiveCampaign(page);
}

function overlapArea(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function inspectLiveLayout(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.evaluate(() => {
    const required = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing rendered surface: ${selector}`);
      return element;
    };
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const rendered = (element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return bounds.width > 0
        && bounds.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    };
    const ownsCenter = (element) => {
      const bounds = element.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return false;
      const owner = document.elementFromPoint(x, y);
      return owner === element || Boolean(owner && element.contains(owner));
    };

    const canvas = required("#battle-canvas-3d");
    const dossier = required(".selection-dossier");
    const commandPanel = required("#command-panel");
    const commandPad = required("#command-pad");
    const saveDock = required("#save-dock");
    const commands = [...commandPanel.querySelectorAll("button[data-action]")];

    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      canvas: { rect: rect(canvas), rendered: rendered(canvas) },
      dossier: { rect: rect(dossier), rendered: rendered(dossier) },
      commandPanel: { rect: rect(commandPanel), rendered: rendered(commandPanel) },
      commandPad: { rect: rect(commandPad), rendered: rendered(commandPad) },
      saveDock: { rect: rect(saveDock), rendered: rendered(saveDock) },
      commands: commands.map((button) => ({
        action: button.dataset.action || "",
        rect: rect(button),
        rendered: rendered(button),
        ownsCenter: ownsCenter(button),
        pointerEvents: getComputedStyle(button).pointerEvents,
      })),
    };
  });
}

function assertInsideViewportX(surface, viewport, context) {
  assert.ok(
    surface.rect.left >= -0.5 && surface.rect.right <= viewport.width + 0.5,
    `${context} must stay inside the ${viewport.width}px viewport width; observed ${JSON.stringify(surface.rect)}.`,
  );
}

function assertLiveLayout(layout, viewport) {
  const context = `${viewport.width}x${viewport.height}`;
  assert.deepEqual(layout.viewport, viewport, `${context} must use the requested browser viewport.`);
  assert.equal(layout.canvas.rendered, true, `${context} must render the WebGL battle canvas.`);
  assert.ok(
    layout.canvas.rect.width > 0 && layout.canvas.rect.height > 0,
    `${context} must give the WebGL battle canvas nonzero bounds; observed ${layout.canvas.rect.width}x${layout.canvas.rect.height}.`,
  );
  assert.equal(layout.dossier.rendered, true, `${context} must render the selected-unit dossier.`);
  assert.equal(layout.commandPanel.rendered, true, `${context} must render the command panel.`);
  assert.equal(layout.commandPad.rendered, true, `${context} must render the command pad.`);

  assert.deepEqual(
    layout.commands.map(({ action }) => action),
    EXPECTED_ACTIONS,
    `${context} must render exactly the seven public battle commands in semantic order.`,
  );
  for (const command of layout.commands) {
    assert.equal(command.rendered, true, `${context} command ${command.action} must have visible nonzero bounds.`);
    assert.equal(command.pointerEvents, "auto", `${context} command ${command.action} must accept pointer hit testing.`);
    assert.equal(command.ownsCenter, true, `${context} command ${command.action} must own its rendered center hit-test point.`);
  }

  assert.equal(overlapArea(layout.canvas.rect, layout.dossier.rect), 0, `${context} canvas must not overlap the selected-unit dossier.`);
  assert.equal(overlapArea(layout.canvas.rect, layout.commandPanel.rect), 0, `${context} canvas must not overlap the command panel.`);
  assert.equal(overlapArea(layout.dossier.rect, layout.commandPad.rect), 0, `${context} dossier must not overlap the seven-command pad.`);
  assert.equal(overlapArea(layout.saveDock.rect, layout.commandPanel.rect), 0, `${context} save dock must not overlap the command panel.`);

  for (const [name, surface] of Object.entries({
    canvas: layout.canvas,
    dossier: layout.dossier,
    commandPanel: layout.commandPanel,
    commandPad: layout.commandPad,
    saveDock: layout.saveDock,
  })) {
    assertInsideViewportX(surface, viewport, `${context} ${name}`);
  }
  assert.ok(layout.documentWidth <= viewport.width, `${context} document must not overflow horizontally; observed ${layout.documentWidth}px.`);
  assert.ok(layout.bodyWidth <= viewport.width, `${context} body must not overflow horizontally; observed ${layout.bodyWidth}px.`);
}

async function assertSaveControlsAndExport(page, viewport) {
  const exportButton = page.locator("#export-save");
  const importLabel = page.locator('label[for="import-save"]');
  const importInput = page.locator("#import-save");
  const context = `${viewport.width}x${viewport.height}`;

  const controls = await page.evaluate(() => {
    const exportButton = document.querySelector("#export-save");
    const importLabel = document.querySelector('label[for="import-save"]');
    const importInput = document.querySelector("#import-save");
    const inspectTarget = (element) => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const owner = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        rendered: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
        ownsCenter: owner === element || Boolean(owner && element.contains(owner)),
        pointerEvents: style.pointerEvents,
      };
    };
    return {
      exportButton: inspectTarget(exportButton),
      importLabel: inspectTarget(importLabel),
      inputLinked: importLabel instanceof HTMLLabelElement && importLabel.control === importInput,
      inputEnabled: importInput instanceof HTMLInputElement && importInput.type === "file" && !importInput.disabled,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      scrollX,
      scrollY,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });

  assert.equal(controls.scrollX, 0, `${context} save controls must be measured before any horizontal scroll.`);
  assert.equal(controls.scrollY, 0, `${context} save controls must be measured before any vertical scroll.`);
  assert.deepEqual(
    { width: controls.viewportWidth, height: controls.viewportHeight },
    { width: viewport.width, height: viewport.height },
    `${context} save-control measurements must use the requested initial viewport.`,
  );
  for (const [name, target] of Object.entries({ exportButton: controls.exportButton, importLabel: controls.importLabel })) {
    assert.ok(target, `${context} must expose ${name}.`);
    assert.equal(target.rendered, true, `${context} ${name} must remain visibly rendered.`);
    assert.ok(
      target.width >= 44 && target.height >= 44,
      `${context} ${name} must expose at least a 44x44 CSS-pixel target; observed ${target.width}x${target.height}.`,
    );
    assert.notEqual(target.pointerEvents, "none", `${context} ${name} must accept pointer hit testing.`);
    assert.equal(target.ownsCenter, true, `${context} ${name} must own its initial rendered center hit-test point.`);
    assert.ok(
      target.left >= -0.5
        && target.right <= viewport.width + 0.5
        && target.top >= -0.5
        && target.bottom <= viewport.height + 0.5,
      `${context} ${name} must be fully viewport-contained before scrolling; observed ${JSON.stringify(target)}.`,
    );
  }
  assert.equal(controls.inputLinked, true, `${context} import label must activate the campaign file input.`);
  assert.equal(controls.inputEnabled, true, `${context} campaign file input must remain enabled and accept file selection.`);
  assert.ok(controls.documentWidth <= viewport.width, `${context} save controls must not create document x-overflow.`);
  assert.ok(controls.bodyWidth <= viewport.width, `${context} save controls must not create body x-overflow.`);

  const downloadReady = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadReady;
  const downloadPath = await download.path();
  assert.ok(downloadPath, `${context} reachable export button must produce a readable campaign file.`);
  const envelope = fs.readFileSync(downloadPath);
  const parsed = JSON.parse(envelope.toString("utf8"));
  assert.equal(typeof parsed.schema, "string", `${context} exported campaign must expose a schema.`);
  assert.ok(Array.isArray(parsed.trace), `${context} exported campaign must expose its public trace.`);
  return envelope;
}

async function runViewport(browser, baseUrl, viewport, envelope) {
  const context = await browser.newContext({ acceptDownloads: true, viewport });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await waitForCampaignBoot(page);
    if (viewport.entry === "start") await startCampaign(page);
    else await resumeCampaign(page, envelope);

    const layout = await inspectLiveLayout(page);
    assertLiveLayout(layout, { width: viewport.width, height: viewport.height });
    const exportedEnvelope = await assertSaveControlsAndExport(page, viewport);
    return { layout, exportedEnvelope };
  } finally {
    await context.close();
  }
}

async function run() {
  let browser;
  let server;
  try {
    const hosting = await startServer();
    server = hosting.server;
    browser = await playwright.chromium.launch({ headless: true });

    const started = await runViewport(browser, hosting.baseUrl, VIEWPORTS[0]);
    const resumed = await runViewport(browser, hosting.baseUrl, VIEWPORTS[1], started.exportedEnvelope);
    const dimensions = [started, resumed].map(({ layout }) => (
      `${layout.viewport.width}x${layout.viewport.height}:canvas=${layout.canvas.rect.width.toFixed(2)}x${layout.canvas.rect.height.toFixed(2)}`
    )).join(" ");
    console.log(`BATTLE_HUD_RESPONSIVE_BROWSER_PASS ${dimensions} commands=7 export=2 import-resume=1 overflowX=0`);
  } finally {
    if (browser) await browser.close();
    if (server) await closeServer(server);
  }
}

if (playwright) {
  run().catch((error) => {
    console.error(`BATTLE_HUD_RESPONSIVE_BROWSER_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exitCode = 1;
  });
}
