const playwright = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const localUrl = "http://127.0.0.1:8080/index.html";

console.log("=== Starting Playwright Browser Playtest ===");

// 1. Spin up a lightweight local server to bypass file:// CORS blocks
const server = http.createServer((req, res) => {
  let reqUrl = req.url.split("?")[0];
  let filePath = path.join(root, reqUrl === "/" ? "index.html" : reqUrl);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".mp3": "audio/mpeg"
    }[ext] || "text/plain";
    
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function run() {
  // Start server
  await new Promise((resolve) => {
    server.listen(8080, "127.0.0.1", () => {
      console.log("Local HTTP server listening on http://127.0.0.1:8080");
      resolve();
    });
  });

  const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();
  
  // Set viewport for high visibility
  await page.setViewportSize({ width: 1280, height: 800 });
  
  // Enable console and error forwarding
  page.on("console", (msg) => console.log(`PAGE LOG [${msg.type()}]:`, msg.text()));
  page.on("pageerror", (err) => console.error("PAGE ERROR:", err.message));
  page.on("requestfailed", (request) => {
    console.error(`PAGE REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText || "Unknown error"}`);
  });
  
  console.log("Navigating to:", localUrl);
  await page.goto(localUrl, { waitUntil: "domcontentloaded" });
  
  // Clear localStorage to ensure fresh campaign state and test isolation
  console.log("Clearing localStorage to prevent state pollution...");
  await page.evaluate(() => localStorage.clear());
  
  // Unregister any active Service Workers to bypass caching issues
  console.log("Checking and clearing service worker registrations...");
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log("Unregistered service worker:", registration.scope);
      }
    }
  });
  
  // Reload the page to ensure we use the fresh code served by our HTTP server
  console.log("Reloading page to apply fresh code...");
  await page.reload({ waitUntil: "networkidle" });
  // Verify audio asset fetch status
  const audioFetchStatus = await page.evaluate(async () => {
    try {
      const res = await fetch("/assets/audio/click.mp3");
      return res.status;
    } catch (e) {
      return e.message;
    }
  });
  console.log("Audio asset fetch status (click.mp3):", audioFetchStatus);
  assert.equal(audioFetchStatus, 200, "Audio assets must be served with HTTP 200 status");
  
  // 1. Verify Lobby screen is visible
  const lobbyVisible = await page.isVisible("#lobby-screen");
  console.log("Lobby visible:", lobbyVisible);
  assert.equal(lobbyVisible, true, "Lobby screen must be visible on startup");
  
  // 2. Click Begin campaign
  console.log("Clicking Begin button...");
  await page.click("#begin-button");
  
  // 3. Verify Play screen becomes visible (wait for selector)
  await page.waitForSelector("#play-screen:not([hidden])", { timeout: 2000 });
  console.log("Play screen is now visible!");
  
  // 4. Toggle Settings Panel
  console.log("Toggling settings panel...");
  await page.click("#settings-toggle");
  await page.waitForSelector("#settings-panel:not([style*='display: none'])", { timeout: 2000 });
  console.log("Settings panel is now visible!");
  
  // 5. Adjust BGM volume slider
  console.log("Adjusting volume sliders...");
  await page.fill("#bgm-volume", "0.2");
  await page.fill("#sfx-volume", "0.9");
  
  // 6. Spawn a Soldier unit
  console.log("Clicking Strike command to spawn a unit...");
  await page.click('button[data-command="STRIKE"]');
  
  // 7. Verify unit is spawned in the battlefield container
  await page.waitForSelector("#units-container .spawned-unit", { timeout: 2000 });
  const unitCount = await page.locator("#units-container .spawned-unit").count();
  console.log("Spawned units count:", unitCount);
  assert.equal(unitCount, 1, "There must be exactly 1 spawned unit in the battlefield container");
  
  // Inspect State 1 (right after spawn)
  const state1 = await page.evaluate(() => ({
    surface: window.surface,
    outcome: window.encounter ? window.encounter.outcome : null,
    activeUnitsCount: window.activeUnits ? window.activeUnits.length : 0,
    activeUnits: window.activeUnits ? window.activeUnits.map(u => ({ id: u.id, x: u.x, speed: u.speed })) : []
  }));
  console.log("State 1 (spawn):", JSON.stringify(state1, null, 2));
  
  // Wait 1 second
  await page.waitForTimeout(1000);
  
  // Inspect State 2 (1 second later)
  const state2 = await page.evaluate(() => ({
    surface: window.surface,
    outcome: window.encounter ? window.encounter.outcome : null,
    activeUnitsCount: window.activeUnits ? window.activeUnits.length : 0,
    activeUnits: window.activeUnits ? window.activeUnits.map(u => ({ id: u.id, x: u.x, speed: u.speed })) : []
  }));
  console.log("State 2 (1s later):", JSON.stringify(state2, null, 2));
  
  // 8. Capture screenshot of the gameplay
  const screenshotPath = path.resolve(root, "tests/playtest_stage1.png");
  await page.screenshot({ path: screenshotPath });
  console.log("Saved playtest screenshot to:", screenshotPath);
  
  // 9. Wait for unit to traverse and deal damage
  console.log("Waiting for Foe Health to decrease to 4 / 6...");
  await page.waitForFunction(() => {
    const text = document.querySelector("#foe-health-value")?.textContent;
    return text && text.includes("4");
  }, { timeout: 10000 });
  
  const foeHealth = await page.locator("#foe-health-value").textContent();
  console.log("Foe Health after strike:", foeHealth);
  // 9b. Test Keyboard Shortcut (press 's' to spawn a Strike unit)
  console.log("Pressing 's' key to spawn a unit via shortcut...");
  await page.keyboard.press("s");
  
  // Verify second unit is spawned
  await page.waitForSelector("#units-container .spawned-unit", { timeout: 2000 });
  console.log("Second unit spawned via keyboard shortcut!");
  
  console.log("Waiting for Foe Health to decrease to 2 / 6...");
  await page.waitForFunction(() => {
    const text = document.querySelector("#foe-health-value")?.textContent;
    return text && text.includes("2");
  }, { timeout: 10000 });
  
  const foeHealth2 = await page.locator("#foe-health-value").textContent();
  console.log("Foe Health after keyboard strike:", foeHealth2);
  assert.ok(foeHealth2.includes("2"), "Foe Health must be 2 / 6 after second strike");
  // 10. Clean up
  await page.close();
  await browser.close();
  server.close();
  console.log("=== Playtest Complete: Success! ===");
}

run().catch((err) => {
  console.error("Playtest failed:", err);
  server.close();
  process.exit(1);
});
