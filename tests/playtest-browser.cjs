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
  
  // Cycle 006 cross-stage evidence flags
  let sawHostileTelegraph = false;
  let disruptCounterVerified = false;

  // Helper to play through a stage using active RTS choices
  async function playStage(stageNum) {
    console.log(`\n=== PLAYING STAGE ${stageNum} ===`);
    await page.waitForSelector("#play-screen:not([hidden])", { timeout: 2000 });

    // DET7-CINE: stage-intro cinematic overlay must appear once per new encounter,
    // then be skippable; skip input must NOT leak into gameplay.
    const cine = await page.evaluate(() => {
      const overlay = document.querySelector(".cinematic-overlay");
      const video = overlay ? overlay.querySelector("video") : null;
      return {
        present: !!overlay,
        src: video ? video.getAttribute("src") : null
      };
    });
    console.log(`[Stage ${stageNum}] Cinematic overlay:`, JSON.stringify(cine));
    if (stageNum === 1) {
      assert.equal(cine.present, true, "First entry into a new encounter must show the stage cinematic overlay");
      assert.equal(cine.src, `assets/video/stage_intro_${stageNum}.mp4`, "Cinematic must load the per-stage intro video");
    }
    if (cine.present) {
      const focusBefore = await page.evaluate(() => (window.encounter ? window.encounter.focus : -1));
      await page.keyboard.press("s"); // consumed as skip by the capture-phase listener
      await page.waitForFunction(() => !document.querySelector(".cinematic-overlay"), { timeout: 3000 });
      const focusAfter = await page.evaluate(() => (window.encounter ? window.encounter.focus : -1));
      assert.ok(focusAfter >= focusBefore, "Cinematic skip keypress must not leak into gameplay (no focus spend)");
      console.log(`[Stage ${stageNum}] Cinematic skipped cleanly (focus ${focusBefore} -> ${focusAfter})`);
    }

    // DET6-TITLE: world-bible encounter naming (Stage 1 only)
    if (stageNum === 1) {
      const campaignTitle = await page.locator("#campaign-value").textContent();
      console.log("[Stage 1] Campaign title:", campaignTitle);
      assert.ok(
        campaignTitle.includes("The Bell Beneath Blackwater"),
        `Encounter 1 must surface the world-bible beat name (got "${campaignTitle}")`
      );
    }
    // Verify avatar images loaded successfully
    const avatarsLoaded = await page.evaluate(() => {
      const knightImg = document.querySelector("#knight-avatar img");
      const voidImg = document.querySelector("#void-avatar img");
      const isLoaded = (img) => img && img.complete && typeof img.naturalWidth !== "undefined" && img.naturalWidth > 0;
      return {
        knight: isLoaded(knightImg),
        void: isLoaded(voidImg)
      };
    });
    console.log(`[Stage ${stageNum}] Avatars loaded status: Knight: ${avatarsLoaded.knight}, Void: ${avatarsLoaded.void}`);
    assert.equal(avatarsLoaded.knight, true, "Knight avatar image must be loaded successfully");
    assert.equal(avatarsLoaded.void, true, "Void avatar image must be loaded successfully");

    // DET-RTS: Mouse lane-click spawn assertion (Stage 1 only, once)
    if (stageNum === 1) {
      console.log("[Stage 1] Testing mouse lane-click STRIKE spawn...");
      const laneClickResult = await page.evaluate(() => {
        const lane = document.querySelector("#rts-units-layer");
        if (!lane) return { error: "lane element missing" };
        const rect = lane.getBoundingClientRect();
        const before = {
          units: window.activeUnits ? window.activeUnits.length : -1,
          focus: window.encounter ? window.encounter.focus : -1
        };
        const evt = new MouseEvent("click", {
          bubbles: true,
          clientX: rect.left + rect.width * 0.15,
          clientY: rect.top + rect.height / 2
        });
        lane.dispatchEvent(evt);
        const spawned = window.activeUnits && window.activeUnits.length > before.units
          ? window.activeUnits[window.activeUnits.length - 1]
          : null;
        return {
          before,
          after: {
            units: window.activeUnits ? window.activeUnits.length : -1,
            focus: window.encounter ? window.encounter.focus : -1
          },
          spawnedX: spawned ? spawned.x : null,
          spawnedImg: spawned && spawned.element
            ? (spawned.element.querySelector("img")?.getAttribute("src") || "no-img")
            : null
        };
      });
      console.log("[Stage 1] Lane click result:", JSON.stringify(laneClickResult));
      assert.ok(!laneClickResult.error, "Battlefield lane element must exist");
      assert.equal(laneClickResult.after.units, laneClickResult.before.units + 1, "Lane click must spawn exactly one unit");
      assert.ok(laneClickResult.spawnedX >= 10 && laneClickResult.spawnedX <= 20, `Spawn origin must reflect click position ~15% (got ${laneClickResult.spawnedX})`);
      assert.ok(String(laneClickResult.spawnedImg).includes("unit_strike"), `Spawned unit must render sprite image (got ${laneClickResult.spawnedImg})`);
      assert.ok(laneClickResult.after.focus < laneClickResult.before.focus, "Lane click STRIKE must consume focus via recordCommand");
    }
    
    while (true) {
      const status = await page.evaluate(() => {
        const foeHealthText = document.querySelector("#foe-health-value")?.textContent || "0";
        const healthVal = parseInt(foeHealthText.split("/")[0]) || 0;
        const focusVal = window.encounter ? window.encounter.focus : 0;
        const outcomeVal = window.encounter ? window.encounter.outcome : "UNKNOWN";
        const intentVal = window.encounter ? window.encounter.foe_intent : "UNKNOWN";
        const integrityVal = window.encounter ? window.encounter.integrity : 0;
        const surgeCounteredVal = window.encounter ? window.encounter.surge_countered : false;
        const units = window.activeUnits || [];
        const hostileCount = units.filter((u) => u.hostile).length;
        const disruptCount = units.filter((u) => u.type === "DISRUPT").length;
        
        const rAFIdVal = window.rAFId;
        const lastTickTimeVal = window.lastTickTime;
        const foeChargeVal = window.foeCharge;
        const useRealTimeVal = window.useRealTime;
        
        return { healthVal, focusVal, outcomeVal, intentVal, integrityVal, surgeCounteredVal, rAFIdVal, lastTickTimeVal, foeChargeVal, useRealTimeVal, hostileCount, disruptCount };
      });
      
      console.log(`[Stage ${stageNum} Tick] Health: ${status.healthVal}, Focus: ${status.focusVal.toFixed(1)}, Intent: ${status.intentVal}, Countered: ${status.surgeCounteredVal}, rAFId: ${status.rAFIdVal}, lastTick: ${status.lastTickTimeVal?.toFixed(1)}, foeCharge: ${status.foeChargeVal?.toFixed(1)}, realTime: ${status.useRealTimeVal}`);

      // DET6-FOE: hostile telegraph must be visible DURING an active charge cycle
      if (status.outcomeVal === "ACTIVE" && status.hostileCount > 0) {
        if (!sawHostileTelegraph) {
          console.log(`[Stage ${stageNum}] Hostile telegraph observed: ${status.hostileCount} void spawn(s) inbound during charge (foeCharge=${status.foeChargeVal?.toFixed(1)})`);
        }
        sawHostileTelegraph = true;
      }
      
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
            // DET6-UNIT/FOE: verify counter response once, early in a charge cycle
            // (avoids racing the next telegraph wave spawned at charge wrap)
            if (!disruptCounterVerified && typeof status.foeChargeVal === "number" && status.foeChargeVal < 2) {
              await page.waitForTimeout(400);
              const counter = await page.evaluate(() => {
                const units = window.activeUnits || [];
                return {
                  countered: window.encounter ? window.encounter.surge_countered : false,
                  hostiles: units.filter((u) => u.hostile).length,
                  disruptors: units.filter((u) => u.type === "DISRUPT").length
                };
              });
              console.log(`[Stage ${stageNum}] DISRUPT counter response:`, JSON.stringify(counter));
              if (counter.countered) {
                assert.equal(counter.hostiles, 0, "Successful DISRUPT counter must dispel the hostile telegraph wave");
                assert.ok(counter.disruptors >= 1, "DISRUPT must field an Arcane Disruptor lane unit");
                disruptCounterVerified = true;
              }
            }
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

  // Cycle 006 campaign-level evidence
  assert.equal(sawHostileTelegraph, true, "Hostile void-spawn telegraph must be observed during at least one active charge cycle");
  assert.equal(disruptCounterVerified, true, "At least one DISRUPT counter must dispel the telegraph wave and field an Arcane Disruptor");
  console.log("Cycle 006 evidence: hostile telegraph observed and DISRUPT counter dispel verified.");
  
  // Verify final campaign settlement details are rendered
  console.log("\n=== VERIFYING CAMPAIGN SETTLEMENT ===");
  const settlementText = await page.locator("#settlement-summary").textContent();
  console.log("Settlement Summary:", settlementText);
  assert.ok(settlementText.includes("settled"), "Settlement summary must indicate campaign is settled");

  // DET7-SW: real service-worker integration check (v3 controls the page, fresh core via network-first)
  console.log("\n=== VERIFYING SERVICE WORKER v3 ===");
  await page.reload({ waitUntil: "networkidle" });

  // Plant an unrelated-origin-neighbor probe cache and a stale app-owned
  // sentinel, then register sw.js under a cache-busting query so the browser
  // treats it as a NEW worker and must run install+activate over both planted
  // caches (same-URL re-register just resurrects the old registration).
  const swState = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { error: "no serviceWorker API" };
    await caches.open("other-project-cache-probe");
    await caches.open("abyssal-surge-v1-sentinel");
    const reg = await navigator.serviceWorker.register(`sw.js?activation-probe=${Date.now()}`);
    // Activation proof: the new worker's activate handler deletes stale
    // app-owned caches; wait (bounded) for the sentinel to disappear.
    let keys = [];
    for (let i = 0; i < 80; i++) {
      keys = await caches.keys();
      if (!keys.includes("abyssal-surge-v1-sentinel")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const appKeys = keys.filter((k) => k.startsWith("abyssal-surge-"));
    const probeSurvived = keys.includes("other-project-cache-probe");
    await caches.delete("other-project-cache-probe");
    const activeURL = (reg.active || reg.waiting || reg.installing || {}).scriptURL || null;
    // Restore the canonical registration for the reload checks below; the new
    // worker activates asynchronously, so wait for its scriptURL to win.
    await reg.unregister();
    const canonical = await navigator.serviceWorker.register("sw.js");
    let canonicalURL = null;
    for (let i = 0; i < 80; i++) {
      const active = canonical.active;
      if (active && active.scriptURL.endsWith("/sw.js") && !active.scriptURL.includes("?")) {
        canonicalURL = active.scriptURL;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      scriptURL: activeURL,
      canonicalURL,
      appKeys,
      probeSurvived,
      buildTag: window.BUILD_TAG || null
    };
  });
  console.log("SW state:", JSON.stringify(swState));
  assert.ok(!swState.error, "Service worker API must be available");
  assert.ok(swState.scriptURL && swState.scriptURL.includes("sw.js?activation-probe="), "The activation-probe worker must have installed");
  assert.ok(swState.canonicalURL && swState.canonicalURL.endsWith("/sw.js"), "The canonical sw.js registration must be restored");
  assert.deepEqual(swState.appKeys, ["abyssal-surge-v3"], "Activate must purge stale app-owned caches, keeping exactly abyssal-surge-v3");
  assert.equal(swState.probeSurvived, true, "Activate cleanup must NOT delete unrelated same-origin caches (origin-wide Cache Storage)");
  assert.equal(swState.buildTag, "c007", "Reload under SW control must serve the fresh c007 app.js (network-first core)");

  // Reload under the claimed worker: page must be controlled and still fresh
  await page.reload({ waitUntil: "networkidle" });
  const controlledTag = await page.evaluate(async () => {
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      controlled: !!navigator.serviceWorker.controller,
      buildTag: window.BUILD_TAG || null
    };
  });
  console.log("SW-controlled reload:", JSON.stringify(controlledTag));
  assert.equal(controlledTag.controlled, true, "Page must remain SW-controlled across reloads");
  assert.equal(controlledTag.buildTag, "c007", "SW-controlled reload must still serve fresh core (network-first, cache fallback)");
  console.log("Service worker v3 integration verified.");
  
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
