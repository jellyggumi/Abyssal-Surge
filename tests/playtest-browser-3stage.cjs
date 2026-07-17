const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let playwright;
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

const ROOT = path.resolve(__dirname, "..");
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
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


async function text(locator) {
  return (await locator.textContent() || "").trim();
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


async function clickEnabledAction(page, selector) {
  const action = page.locator(selector);
  const timeoutAt = Date.now() + 30_000;
  let lastError;
  await action.waitFor({ state: "visible" });
  while (Date.now() < timeoutAt) {
    if (!(await action.isEnabled())) {
      await page.waitForTimeout(100);
      continue;
    }
    if (selector.includes("[data-battle-target")) {
      await action.scrollIntoViewIfNeeded();
      const targetPoint = await action.evaluate((target) => {
        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const style = getComputedStyle(target);
        const centerElement = document.elementFromPoint(x, y);
        return {
          visible: !target.hidden && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden",
          x,
          y,
          receivesCenterClick: target.contains(centerElement)
        };
      });
      assert.equal(targetPoint.visible, true, `${selector} must remain visibly targetable for its physical mouse click.`);
      assert.equal(targetPoint.receivesCenterClick, true, `${selector} must own its center hit-test point before the physical mouse click.`);
      await page.mouse.click(targetPoint.x, targetPoint.y);
    } else {
      try {
        await action.click({ timeout: 1_000 });
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(100);
        continue;
      }
    }
    const disabledAt = Date.now() + 5_000;
    while (await action.isEnabled()) {
      if (Date.now() >= disabledAt) {
        assert.fail(`${selector} did not enter its visible cooldown after being clicked.`);
      }
      await page.waitForTimeout(25);
    }
    return;
  }
  assert.fail(`${selector} did not become stably enabled before its visible cooldown expired.${lastError ? ` Last click error: ${lastError.message}` : ""}`);
}

async function runActions(page, selectors) {
  for (const selector of selectors) {
    await clickEnabledAction(page, selector);
  }
}

function battleTargetSelector(action) {
  return `#battle-pointer-controls [data-battle-target="${action}"]`;
}

async function assertBattleTargetEnabled(page, action, expected, description) {
  const target = page.locator(battleTargetSelector(action));
  await target.waitFor({ state: "visible" });
  assert.equal(await target.isEnabled(), expected, description);
  assert.equal(
    await target.getAttribute("aria-disabled"),
    String(!expected),
    `${description} The public target aria-disabled state must match its native disabled state.`
  );
  return target;
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
  assert.ok(point, "The live battlefield must expose a blank canvas point outside the mouse target overlay.");

  const canvasPointerDown = page.evaluate(() => new Promise((resolve, reject) => {
    const canvas = document.querySelector("#battle-canvas-3d");
    const timeout = window.setTimeout(() => reject(new Error("Timed out waiting for the blank battlefield click to reach the canvas.")), 5_000);
    let count = 0;
    canvas.addEventListener("pointerdown", (event) => {
      count += 1;
      window.requestAnimationFrame(() => {
        window.clearTimeout(timeout);
        resolve({ count, targetId: event.target.id });
      });
    }, { once: true });
  }));
  await page.mouse.click(point.x, point.y);
  assert.deepEqual(
    await canvasPointerDown,
    { count: 1, targetId: "battle-canvas-3d" },
    "A physical click through a blank overlay point must deliver exactly one pointerdown to the canvas."
  );
}

async function enterBattle(page, number, heading) {
  // Single-screen cockpit: the battlefield, intel rail, and command pad are
  // all live the moment the stage is active - no scenario/boss-spec clicks.
  await assertStage(page, number, heading);
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await page.locator("#command-panel").waitFor({ state: "visible" });
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
const COMMAND_COOLDOWN_TIMEOUT_MS = 7_000;

async function configureBattleParityContext(context, { failCanvas = false, auditAnimationFrames = false } = {}) {
  await context.addInitScript(({ failCanvas, auditAnimationFrames }) => {
    // Canvas failure is the only degradation injected into the campaign path.

    if (failCanvas) {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
        if (type === "2d") return null;
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

async function waitForCampaignBoot(page) {
  await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
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
    applyBattleBreach,
    chooseReward,
    createCampaign,
    createSaveEnvelope,
    startCampaign
  } = await import(pathToFileURL(path.join(ROOT, "campaign-state.js")).href);

  const commands = (state, actions) => actions.reduce(
    (next, action) => acceptedCampaignTransition(applyAction(next, action), `Campaign fixture action ${action} must be accepted.`),
    state
  );
  const start = () => acceptedCampaignTransition(startCampaign(createCampaign()), "Campaign fixture must start from briefing.");
  const stageOneVictory = ["hunt", "hunt", "extract", "materialize", "materialize", "capture", "assault", "assault", "assault"];
  const stageTwoVictory = ["hunt", "hunt", "extract", "materialize", "materialize", "capture", "capture", "possess", "assault", "assault"];
  const stageThreeVictory = ["capture", "domain", "possess", "assault", "assault"];

  const briefing = createCampaign();
  const reward = commands(start(), stageOneVictory);

  let defeat = start();
  while (defeat.status === "active") {
    defeat = acceptedCampaignTransition(applyBattleBreach(defeat), "Campaign fixture battle breach must be accepted.");
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

async function awaitTimedBattleBreachBatch(page, entryIntegrity) {
  await page.waitForFunction(
    (initialIntegrity) => Number.parseInt(document.querySelector("#integrity-value")?.textContent || "", 10) < initialIntegrity,
    entryIntegrity,
    { polling: 20, timeout: BATTLE_BREACH_TIMEOUT_MS }
  );
  await page.waitForTimeout(250);

  const trace = await campaignTrace(page);
  const breaches = trace.filter((event) => event.kind === "battle-breach");
  const integrity = Number.parseInt(await text(page.locator("#integrity-value")), 10);
  assert.ok(breaches.length > 0, "The scheduled battle wave must serialize at least one battle-breach transition.");
  assert.ok(integrity < entryIntegrity, "The rendered battle integrity must drop after a scheduled breach.");
  return Object.freeze({
    integrity,
    trace: trace.map((event) => event.kind === "action" ? { kind: event.kind, action: event.action } : { kind: event.kind })
  });
}

async function verifyCommandCooldown(page) {
  const hunt = page.locator("#action-hunt");
  assert.equal(await hunt.isEnabled(), true, "The Hunt command must remain enabled while battle presentation degrades.");
  await clickEnabledAction(page, "#action-hunt");
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

async function runBattleParityPath(browser, baseUrl, { failCanvas = false } = {}) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let page;
  try {
    await configureBattleParityContext(context, { failCanvas });
    page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    const entryIntegrity = Number.parseInt(await enterBattle(page, 1, "Cinder Span"), 10);

    if (failCanvas) {
      assert.equal(await page.locator("#battle-canvas-3d").isHidden(), true, "A failed Canvas 2D context must reveal the static tactical brief instead of a blank renderer.");
      assert.equal(await page.locator("#battle-visual-fallback").isVisible(), true, "A failed Canvas 2D context must expose the tactical fallback card.");
      assert.equal(await text(page.locator("#campaign-status")), "Battle visualization is unavailable; command rules remain ready.", "Canvas fallback status must preserve the command-ready guarantee.");
      assert.equal(
        await page.locator("#battle-pointer-controls").isHidden(),
        true,
        "A failed Canvas 2D context must hide the renderer-only mouse target overlay."
      );
      for (const action of ["materialize", "capture", "assault"]) {
        assert.equal(
          await page.locator(battleTargetSelector(action)).isHidden(),
          true,
          `Canvas fallback must keep the ${action} mouse target inaccessible while command-pad controls remain available.`
        );
      }
    }
    if (!failCanvas) {
      assert.equal(
        await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        false,
        "The renderer-enabled parity path must run without reduced-motion preference before waiting for live-wave breaches."
      );
      assert.equal(await page.locator("#battle-visual-fallback").isHidden(), true, "A functioning Canvas 2D renderer must keep the static tactical fallback card hidden.");
    }

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
  const renderedBreaches = rendered.trace.filter((event) => event.kind === "battle-breach");
  const fallbackBreaches = fallback.trace.filter((event) => event.kind === "battle-breach");
  const renderedActions = rendered.trace.filter((event) => event.kind === "action");
  const fallbackActions = fallback.trace.filter((event) => event.kind === "action");

  assert.ok(renderedBreaches.length > 0, "The renderer-enabled battle path must record one or more scheduled battle-breach transitions.");
  assert.ok(fallbackBreaches.length > 0, "The Canvas-fallback battle path must record one or more scheduled battle-breach transitions.");
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
    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
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

async function verifyShortViewportBattleTargetReachability(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    const clientErrors = collectClientErrors(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await enterBattle(page, 1, "Cinder Span");
    await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract"]);
    await page.setViewportSize({ width: 1280, height: 280 });

    const main = page.locator("main");
    const target = await assertBattleTargetEnabled(
      page,
      "materialize",
      true,
      "Stage 1 Materialize mouse target must unlock before short-viewport reachability is tested."
    );
    const mainBox = await main.boundingBox();
    assert.ok(mainBox, "The gameplay main container must have a visible box for user-like wheel scrolling.");

    await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
    await page.mouse.wheel(0, -10_000);
    await page.waitForFunction(() => document.querySelector("main")?.scrollTop === 0);
    const scrollRange = await main.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }));
    assert.ok(
      scrollRange.scrollHeight > scrollRange.clientHeight,
      `Short viewport gameplay must keep main vertically user-scrollable; observed scrollHeight=${scrollRange.scrollHeight}, clientHeight=${scrollRange.clientHeight}.`
    );

    const readTargetPoint = () => target.evaluate((element) => {
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
    let targetPoint = await readTargetPoint();
    assert.equal(
      targetPoint.visible,
      false,
      "At the top of a short gameplay viewport, the Materialize target must require scrolling instead of being clipped by main."
    );

    for (let attempt = 0; attempt < 12 && (!targetPoint.visible || !targetPoint.receivesCenterClick); attempt += 1) {
      const beforeScrollTop = await main.evaluate((element) => element.scrollTop);
      await page.mouse.wheel(0, 120);
      await page.waitForFunction(
        (previousScrollTop) => document.querySelector("main")?.scrollTop > previousScrollTop,
        beforeScrollTop,
        { timeout: 1_000 }
      );
      targetPoint = await readTargetPoint();
    }

    assert.equal(targetPoint.visible, true, "User-like wheel scrolling of main must reveal the Stage 1 Materialize target.");
    assert.equal(
      targetPoint.receivesCenterClick,
      true,
      "The revealed Stage 1 Materialize target must own its center hit-test point before the physical mouse click."
    );
    const legionBeforeMaterialize = await text(page.locator("#legion-value"));
    await page.mouse.click(targetPoint.x, targetPoint.y);
    await page.waitForFunction(
      (previousLegion) => document.querySelector("#legion-value")?.textContent?.trim() !== previousLegion,
      legionBeforeMaterialize
    );
    assert.equal(
      await text(page.locator("#legion-value")),
      "2 / 10",
      "A physical click on the wheel-revealed Stage 1 Materialize target must raise the public legion count."
    );
    assertNoClientErrors(clientErrors, "Short-viewport battle target reachability");
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

async function advanceToNextScenario(page, number, heading) {
  // Choosing a reward returns the engine to "active": the overlay closes
  // itself and the next stage battle relaunches on the same cockpit screen.
  await page.locator("#view-result").waitFor({ state: "hidden" });
  await page.locator("#battle-field").waitFor({ state: "visible" });
  await assertStage(page, number, heading);
}

async function chooseRewardAndAdvance(page, rewardId, number, heading) {
  await page.locator(`[data-reward-id="${rewardId}"]`).click();
  await page.locator("#reward-panel").waitFor({ state: "hidden" });
  await advanceToNextScenario(page, number, heading);
}


async function runStageOne(page) {
  const entryIntegrity = await enterBattle(page, 1, "Cinder Span");
  await assertBattleCanvasBlankPassThrough(page);
  for (const action of ["materialize", "capture", "assault"]) {
    await assertBattleTargetEnabled(
      page,
      action,
      false,
      `Stage 1 ${action} mouse target must start disabled until its public command prerequisites are met.`
    );
  }

  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract"]);
  await assertBattleTargetEnabled(page, "materialize", true, "Stage 1 Materialize mouse target must unlock after Hunt twice and Extract.");
  await assertBattleTargetEnabled(page, "capture", false, "Stage 1 Capture mouse target must remain disabled until a legion materializes.");
  await assertBattleTargetEnabled(page, "assault", false, "Stage 1 Assault mouse target must remain disabled until the forge node is captured.");

  const legionBeforeMaterialize = await text(page.locator("#legion-value"));
  await clickEnabledAction(page, battleTargetSelector("materialize"));
  assert.equal(await text(page.locator("#legion-value")), "2 / 10", "Clicking the Stage 1 Materialize mouse target must raise the public legion count.");
  assert.notEqual(await text(page.locator("#legion-value")), legionBeforeMaterialize, "The Stage 1 Materialize mouse target must visibly update legion status.");

  await assertBattleTargetEnabled(page, "capture", true, "Stage 1 Capture mouse target must unlock after Materialize.");
  await assertBattleTargetEnabled(page, "assault", false, "Stage 1 Assault mouse target must remain disabled until the forge node is captured.");
  const nodesBeforeCapture = await text(page.locator("#nodes-value"));
  await clickEnabledAction(page, battleTargetSelector("capture"));
  assert.equal(await text(page.locator("#nodes-value")), "1 / 1", "Clicking the Stage 1 Capture mouse target must claim the public node status.");
  assert.notEqual(await text(page.locator("#nodes-value")), nodesBeforeCapture, "The Stage 1 Capture mouse target must visibly update node status.");

  await assertBattleTargetEnabled(page, "assault", true, "Stage 1 Assault mouse target must unlock after Capture.");
  const bossBeforeAssault = await text(page.locator("#boss-value"));
  await assertPreparationIntegrity(page, 1, entryIntegrity);
  await clickEnabledAction(page, battleTargetSelector("assault"));
  assert.equal(await text(page.locator("#boss-value")), "5 / 8", "Clicking the Stage 1 Assault mouse target must damage the public boss health.");
  assert.notEqual(await text(page.locator("#boss-value")), bossBeforeAssault, "The Stage 1 Assault mouse target must visibly update boss health.");

  await runActions(page, [battleTargetSelector("assault"), battleTargetSelector("assault")]);

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
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-materialize", "#action-capture", "#action-possess", "#action-domain"]);
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

  return declaration[1] || declaration[2];
}


async function verifyWorker(page, baseUrl) {
  const expectedCacheName = currentWorkerCacheName();
  const worker = await page.evaluate(async ({ timeoutMs }) => {
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
    return {
      supported: true,
      cacheNames,
      scope: registration.scope,
      scriptUrl: active ? active.scriptURL : null
    };
  }, { timeoutMs: 10_000 });

  assert.equal(worker.supported, true, "The browser must expose service workers for the static campaign.");
  assert.equal(worker.scope, `${baseUrl}/`, "The service worker must be scoped to this ephemeral loopback origin.");
  assert.equal(worker.scriptUrl, `${baseUrl}/sw.js`, "The active worker must come from the current sw.js source.");
  const campaignCaches = worker.cacheNames.filter((name) => name.startsWith("abyssal-surge-static-"));
  assert.deepEqual(campaignCaches, [expectedCacheName], "Only the current static worker cache must be observable after activation.");

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
    await page.locator("#battle-field").waitFor({ state: "visible" });
    await assertStage(page, 1, "Cinder Span");
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
    assert.equal(page.url(), campaignUrl, "Resuming the campaign must retain the campaign document URL.");
    assert.equal(navigation.count(), 0, "Resuming an active battle return must not navigate the main frame.");
    const afterResumeEnvelope = await exportCampaignEnvelope(page);
    assert.deepEqual(
      afterResumeEnvelope,
      beforeReturnEnvelope,
      "The public exported replay envelope and trace must survive Return, reload, and Resume unchanged."
    );

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
    await page.locator("#return-to-lobby").click();
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

    await importCampaignEnvelope(page, envelope, "abyssal-surge-briefing.json");
    await page.locator("#return-to-lobby").click();
    await page.locator("#campaign-lobby").waitFor({ state: "visible" });
    await page.locator("#campaign-resume-summary").waitFor({ state: "visible" });
    assert.equal(await text(page.locator("#campaign-resume-status")), "작전 브리핑", "A Korean lobby must localize the empty-trace briefing resume summary.");
    assert.equal(navigation.count(), 0, "Returning an imported briefing to the lobby must not navigate the main frame.");

    let startConfirmationCount = 0;
    noStartConfirmation = (dialog) => {
      startConfirmationCount += 1;
      dialog.dismiss();
    };
    page.on("dialog", noStartConfirmation);
    await page.locator("#resume-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await page.locator("#battle-field").waitFor({ state: "visible" });
    page.off("dialog", noStartConfirmation);
    noStartConfirmation = undefined;

    assert.equal(startConfirmationCount, 0, "Resuming an empty-trace briefing must begin a fresh run without confirmation.");
    await assertStage(page, 1, "Cinder Span");
    assert.equal(navigation.count(), 0, "Resuming an imported briefing must not navigate the main frame.");
    assert.deepEqual(
      (await exportCampaignEnvelope(page)).trace,
      [{ kind: "start" }],
      "Resuming an imported briefing must publicly export the fresh Stage 1 start transition."
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
    const campaignFixtures = await createCampaignFixtures();
    await verifyRendererIndependentBattleBreach(browser, hosting.baseUrl);
    await verifyReducedMotionBattlePresentation(browser, hosting.baseUrl);
    await verifyShortViewportBattleTargetReachability(browser, hosting.baseUrl);
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
    page.on("requestfailed", (request) => {
      if (isOptionalMediaUrl(request.url())) {
        clientErrors.optionalMediaErrors.push(`request: ${request.url()}`);
      } else {
        clientErrors.unexpectedErrors.push(`request: ${request.url()} (${request.failure()?.errorText || "failed"})`);
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
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    const worker = await verifyWorker(page, hosting.baseUrl);

    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await runStageOne(page);
    await runStageTwo(page);
    await runStageThree(page);

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

if (playwright) run();
