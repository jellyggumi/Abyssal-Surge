const playwright = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const localUrl = "http://127.0.0.1:8080/index.html";

console.log("=== Starting Playwright 5-Stage Campaign Browser Playtest ===");

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
  
  // Helper to play through a stage using active RTS choices
  async function playStage(stageNum) {
    console.log(`\n=== PLAYING STAGE ${stageNum} ===`);
    await page.waitForSelector("#play-screen:not([hidden])", { timeout: 2000 });
    
    while (true) {
      const status = await page.evaluate(() => {
        const foeHealthText = document.querySelector("#foe-health-value")?.textContent || "0";
        const healthVal = parseInt(foeHealthText.split("/")[0]) || 0;
        const focusVal = window.encounter ? window.encounter.focus : 0;
        const outcomeVal = window.encounter ? window.encounter.outcome : "UNKNOWN";
        const intentVal = window.encounter ? window.encounter.foe_intent : "UNKNOWN";
        const integrityVal = window.encounter ? window.encounter.integrity : 0;
        const surgeCounteredVal = window.encounter ? window.encounter.surge_countered : false;
        
        const rAFIdVal = window.rAFId;
        const lastTickTimeVal = window.lastTickTime;
        const foeChargeVal = window.foeCharge;
        const useRealTimeVal = window.useRealTime;
        
        return { healthVal, focusVal, outcomeVal, intentVal, integrityVal, surgeCounteredVal, rAFIdVal, lastTickTimeVal, foeChargeVal, useRealTimeVal };
      });
      
      console.log(`[Stage ${stageNum} Tick] Health: ${status.healthVal}, Focus: ${status.focusVal.toFixed(1)}, Intent: ${status.intentVal}, Countered: ${status.surgeCounteredVal}, rAFId: ${status.rAFIdVal}, lastTick: ${status.lastTickTimeVal?.toFixed(1)}, foeCharge: ${status.foeChargeVal?.toFixed(1)}, realTime: ${status.useRealTimeVal}`);
      
      if (status.outcomeVal !== "ACTIVE" || status.integrityVal <= 0) {
        console.log(`Stage ${stageNum} finished. Outcome: ${status.outcomeVal}, Foe Health remaining: ${status.healthVal}`);
        break;
      }
      
      // Reactive RTS plays
      if (status.focusVal >= 1) {
        if (status.intentVal === "SURGE") {
          if (!status.surgeCounteredVal) {
            console.log(`[Stage ${stageNum}] Disrupting Foe's SURGE! Focus: ${status.focusVal.toFixed(1)}`);
            await page.keyboard.press("d");
          } else {
            // Already countered, wait for focus/intent to recycle
            await page.waitForTimeout(100);
          }
        } else {
          console.log(`[Stage ${stageNum}] Striking! Focus: ${status.focusVal.toFixed(1)}`);
          await page.keyboard.press("s");
        }
      }
      
      await page.waitForTimeout(500);
    }
    
    // Transition to terminal screen
    await page.waitForSelector("#terminal-screen:not([hidden])", { timeout: 2000 });
    console.log(`Stage ${stageNum} Terminal screen is visible.`);
    
    // Save a screenshot for visual evidence at Stage 1 and Stage 5
    if (stageNum === 1 || stageNum === 5) {
      const screenshotPath = path.resolve(root, `tests/playtest_stage${stageNum}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot for Stage ${stageNum} to:`, screenshotPath);
    }
    
    if (stageNum < 5) {
      console.log(`Transitioning to Stage ${stageNum + 1}...`);
      await page.click("#continue-button");
    }
  }
  
  // Play through all 5 stages
  for (let i = 1; i <= 5; i++) {
    await playStage(i);
  }
  
  // Verify final campaign settlement details are rendered
  console.log("\n=== VERIFYING CAMPAIGN SETTLEMENT ===");
  const settlementText = await page.locator("#settlement-summary").textContent();
  console.log("Settlement Summary:", settlementText);
  assert.ok(settlementText.includes("settled"), "Settlement summary must indicate campaign is settled");
  
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
