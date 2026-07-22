const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const allowMissing = process.argv.includes("--allow-missing-browser");
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const baseUrl = option("--url");
const sha = option("--sha");
const rulesVersion = option("--rules-version");

if (!baseUrl || !sha || !rulesVersion) {
  throw new Error("Usage: node tests/deployed-defense-smoke.cjs --url <deployment-url> --sha <candidate-sha> --rules-version <rules-version>");
}

let playwright;
try {
  playwright = require("playwright");
} catch {
  if (!allowMissing) throw new Error("require(\"playwright\") failed; install the lock-backed browser dependency.");
  console.log("DEPLOYED_DEFENSE_SMOKE_SKIPPED missing Playwright");
}

const cacheBust = () => `cb=${encodeURIComponent(`${sha}-${Date.now()}`)}`;
const absolute = (pathname) => new URL(`${pathname}?${cacheBust()}`, baseUrl).href;

async function run() {
  const results = {
    url: baseUrl,
    sha,
    rulesVersion,
    startedAt: new Date().toISOString(),
    sessions: [],
    errors: [],
    pass: false,
  };
  let browser;
  try {
    const versionResponse = await fetch(absolute("version.json"), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    assert.equal(versionResponse.ok, true, `version.json response must succeed; received ${versionResponse.status}`);
    const version = await versionResponse.json();
    assert.equal(version.candidate_sha, sha, "version.json candidate_sha must match --sha");
    assert.equal(version.rules_version, rulesVersion, "version.json rules_version must match --rules-version");
    results.version = version;

    browser = await playwright.chromium.launch({ headless: true });
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });

      const response = await page.goto(absolute("index.html"), { waitUntil: "networkidle" });
      assert(response?.ok(), `${width}x${height} app response must succeed`);
      await page.locator("#start-defense").click();
      const surface = page.locator('[data-defense-ready="true"]');
      await surface.waitFor({ state: "visible", timeout: 15_000 });
      const before = await surface.getAttribute("data-defense-input-seq");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, before);
      const invariant = await page.evaluate(() => ({
        surface: Boolean(document.querySelector("#defense-battle-surface")),
        canvas: Boolean(document.querySelector("#defense-canvas")),
        overflow: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        state: document.querySelector("#defense-battle-surface")?.dataset.defenseState,
      }));
      assert.equal(invariant.surface, true, "battle surface must exist");
      assert.equal(invariant.canvas, true, "battle canvas must exist");
      assert.equal(invariant.overflow, true, "battle must not overflow viewport");
      assert.deepEqual(errors, [], "deployed browser emitted errors");
      results.sessions.push({ viewport: `${width}x${height}`, ...invariant });
      await context.close();
    }
    results.pass = true;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    results.finishedAt = new Date().toISOString();
    await fs.mkdir(path.resolve("results"), { recursive: true });
    await fs.writeFile(path.resolve("results/deployed-smoke.json"), `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify(results, null, 2));
  }
}

if (playwright) {
  run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
