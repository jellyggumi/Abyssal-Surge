const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try { playwright = require("playwright"); } catch {
  if (!allowMissing) throw new Error("require('playwright') failed; install the lock-backed browser dependency.");
  console.log("DEFENSE_SURVIVOR_BROWSER_SKIPPED missing Playwright");
}
const ROOT = path.resolve(__dirname, "..");

function startServer() {
  const host = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      const mimeTypes = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".mp4": "video/mp4" };
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", reject));
}

async function run() {
  const hosting = await startServer();
  let browser;
  const report = { events: [], errors: [] };
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push({ kind: "page", message: error.message }));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    assert.equal(await page.locator("#start-defense").isVisible(), true, "lobby must expose a live departure action");
    report.events.push("lobby-visible");
    await page.locator("#start-defense").click();
    const surface = page.locator('[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    report.events.push("battle-visible");
    const accessibility = await page.locator("#defense-battle-surface").evaluate((surface) => ({
      label: surface.getAttribute("aria-label"),
      canvasLabel: surface.querySelector("#defense-canvas")?.getAttribute("aria-label"),
      statusLive: surface.querySelector("#battle-status")?.getAttribute("aria-live"),
      movement: {
        role: surface.querySelector("#movement-actions")?.getAttribute("role"),
        label: surface.querySelector("#movement-actions")?.getAttribute("aria-label"),
        buttons: [...surface.querySelectorAll("#movement-actions [data-move]")].map((button) => ({
          move: button.dataset.move,
          label: button.getAttribute("aria-label"),
        })),
      },
    }));
    assert.match(accessibility.label ?? "", /\S/, "battle surface must expose an accessible name");
    assert.match(accessibility.canvasLabel ?? "", /\S/, "battle canvas must expose an accessible name");
    assert.equal(accessibility.statusLive, "polite", "battle status must announce snapshot changes");
    assert.deepEqual(accessibility.movement, {
      role: "group",
      label: "한 손 이동 조작",
      buttons: [
        { move: "N", label: "위로 이동" },
        { move: "W", label: "왼쪽으로 이동" },
        { move: "IDLE", label: "이동 정지" },
        { move: "E", label: "오른쪽으로 이동" },
        { move: "S", label: "아래로 이동" },
      ],
    }, "one-thumb directions must expose stable, labeled public controls");
    await page.locator('[data-move="E"]').focus();
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.move),
      "E",
      "a one-thumb direction must remain keyboard focusable",
    );
    await page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseFeedback === "lore");
    assert.equal(await page.locator("#battle-event-feedback").getAttribute("data-feedback"), "lore");
    assert.match(
      await page.locator("#battle-event-feedback").textContent() ?? "",
      /\S/,
      "lore feedback must render safe snapshot-derived text through the live status region",
    );
    const cutscene = page.locator("#defense-cutscene-overlay");
    await cutscene.waitFor({ state: "visible" });
    assert.ok(
      ["STAGE_STARTED", "LORE_SURPRISE_RESOLVED"].includes(await surface.getAttribute("data-defense-cutscene")),
      "stage entry must present authored stage or resolved-lore snapshot copy",
    );
    const duringCutscene = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, duringCutscene);
    report.events.push("keyboard-movement-during-cutscene");
    assert.equal(await surface.getAttribute("data-defense-move"), "IDLE", "keyboard release must leave the public movement state idle");
    await cutscene.locator("[data-cutscene-dismiss]").focus();
    await page.keyboard.press("Enter");
    await cutscene.waitFor({ state: "hidden" });
    assert.equal(await surface.getAttribute("data-defense-cutscene"), null, "cutscene dismissal must not leave stale presentation state");
    const beforeControlKeyboard = await surface.getAttribute("data-defense-input-seq");
    await page.locator('[data-move="E"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, beforeControlKeyboard);
    assert.equal(await surface.getAttribute("data-defense-move"), "E", "keyboard activation must queue the public east movement command");
    report.events.push("stage-cutscene-dismissed");
    const before = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, before);
    report.events.push("keyboard-movement-after-cutscene");
    // Cycle 3 / D17: canvas touch/drag now orbits the free camera, never
    // movement — a tap (zero-distance touchstart/touchend, no intermediate
    // move) produces no orbit delta and must NOT queue any movement input or
    // advance data-defense-input-seq. Movement stays exclusively D-pad/keyboard.
    const box = await page.locator("#defense-canvas").boundingBox();
    assert(box, "canvas must have bounds");
    const beforeTouch = Number(await surface.getAttribute("data-defense-input-seq"));
    const moveBeforeTouch = await surface.getAttribute("data-defense-move");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.waitForTimeout(100);
    assert.equal(Number(await surface.getAttribute("data-defense-input-seq")), beforeTouch, "canvas taps must not queue movement input (orbit/movement decoupled, D17)");
    assert.equal(await surface.getAttribute("data-defense-move"), moveBeforeTouch, "canvas taps must leave the public movement state unaffected");
    report.events.push("touch-canvas-no-movement");
    const growthOffer = page.locator("#defense-growth-offer");
    const selectedGrowthSkills = new Set();
    const maxImmediateGrowthSelections = 8;
    let growthOfferClosed = false;
    await growthOffer.waitFor({ state: "visible", timeout: 30000 });
    for (let selection = 0; selection < maxImmediateGrowthSelections; selection += 1) {
      const choices = await growthOffer.locator("button[data-pick]").evaluateAll((buttons) => buttons.map((button) => button.dataset.pick ?? ""));
      assert.ok(choices.length > 0, "a visible growth offer must contain a selectable real skill");
      assert.equal(new Set(choices).size, choices.length, "a growth offer must not repeat a selectable skill");
      choices.forEach((skill) => assert.match(skill, /\S/, "each growth choice must identify a real skill"));
      const skill = choices[0];
      assert.equal(selectedGrowthSkills.has(skill), false, "a selected growth skill must not be offered again");
      const offerKey = choices.join(",");
      await growthOffer.locator(`button[data-pick="${skill}"]`).click();
      selectedGrowthSkills.add(skill);
      report.events.push({ event: "growth-selected", skill });
      await page.waitForFunction(({ offerKey, skill }) => {
        const status = document.querySelector("#battle-status")?.textContent ?? "";
        if (!status.includes("성장 선택 중")) return true;
        const nextOffer = document.querySelector("#defense-growth-offer");
        const nextChoices = [...nextOffer?.querySelectorAll("button[data-pick]") ?? []]
          .map((button) => button.dataset.pick ?? "");
        return Boolean(nextOffer) && (
          nextChoices.length === 0
          || (nextChoices.join(",") !== offerKey && !nextChoices.includes(skill))
        );
      }, { offerKey, skill });
      if (await growthOffer.isHidden()) {
        growthOfferClosed = true;
        break;
      }
      const nextChoices = await growthOffer.locator("button[data-pick]").count();
      if (nextChoices === 0) {
        assert.equal(selectedGrowthSkills.size, maxImmediateGrowthSelections, "an empty growth offer is valid only after every skill is owned");
        await growthOffer.waitFor({ state: "hidden" });
        growthOfferClosed = true;
        break;
      }
    }
    assert.equal(growthOfferClosed, true, "growth selections must settle without leaving an unresolved offer");
    // This test (unlike the portrait/landscape .cjs tests, which deliberately
    // force the Canvas2D fallback to test that path) does NOT stub WebGL2 —
    // by this point in the playthrough many real frames have rendered.
    // app.js's render() try/catch means a WebGL renderer that throws on ANY
    // frame silently swaps to BattleVisualizer with no visible test failure;
    // this is the one automated check that the real three.js WebGL path
    // actually rendered a live playthrough without crashing, not just that
    // getContext("webgl2") succeeded at mount time.
    assert.equal(await surface.getAttribute("data-defense-renderer"), "webgl", "the real WebGL renderer must survive a full playthrough without silently failing over to the Canvas2D fallback");
    report.events.push("webgl-renderer-confirmed-active");
    assert.deepEqual(report.errors, [], "visible journey emitted unexpected page or console errors");
    console.log(JSON.stringify({ pass: true, ...report }, null, 2));
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}
if (playwright) run().catch((error) => { console.error(error.stack || String(error)); process.exitCode = 1; });
