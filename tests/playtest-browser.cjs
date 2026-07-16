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
  // Cycle 008/009 inline trade-line probes (filled during campaign 2 stage 5)
  let tradeProbe = null;
  let tradeCostBadge = null;

  // Helper to play through a stage using active RTS choices
  async function playStage(stageNum, { strategy = "reactive", deepChecks = true } = {}) {
    let stageOutcome = null;
    let stageFoeHealth = null;
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
    if (stageNum === 1 && deepChecks) {
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
    if (stageNum === 1 && deepChecks) {
      console.log("[Stage 1] Testing mouse lane-click STRIKE spawn...");
      const laneClickResult = await page.evaluate(() => {
        const lane = document.querySelector("#rts-units-layer");
        if (!lane) return { error: "lane element missing" };
        const rect = lane.getBoundingClientRect();
        const friendly = () => (window.activeUnits || []).filter((u) => !u.hostile);
        const before = {
          friendly: friendly().length,
          focus: window.encounter ? window.encounter.focus : -1
        };
        const evt = new MouseEvent("click", {
          bubbles: true,
          clientX: rect.left + rect.width * 0.15,
          clientY: rect.top + rect.height / 2
        });
        lane.dispatchEvent(evt);
        const friendsAfter = friendly();
        const spawned = friendsAfter.length > before.friendly ? friendsAfter[friendsAfter.length - 1] : null;
        return {
          before,
          after: {
            friendly: friendsAfter.length,
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
      // Universal model: the click resolves one full round — exactly one NEW
      // friendly unit (the next telegraph wave may also spawn; hostiles excluded).
      assert.equal(laneClickResult.after.friendly, laneClickResult.before.friendly + 1, "Lane click must field exactly one friendly unit");
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
        
        const roundVal = window.encounter ? window.encounter.round : -1;
        return { healthVal, focusVal, outcomeVal, intentVal, integrityVal, surgeCounteredVal, rAFIdVal, lastTickTimeVal, foeChargeVal, useRealTimeVal, hostileCount, disruptCount, roundVal };
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
        stageOutcome = status.outcomeVal;
        stageFoeHealth = status.healthVal;
        break;
      }
      
      // Driver plays
      if (strategy === "trade" && stageNum === 5) {
        // DET8-E2E deliberate-trade line: STRIKE -> DISRUPT-on-SURGE -> STRIKE,
        // with inline DET8/DET9 probes against the REAL campaign state.
        if (status.focusVal >= 2) {
          if (status.roundVal === 0) {
            console.log(`[Stage 5/trade] Round 0 STRIKE (accepting the uncovered SURGE trade). Focus: ${status.focusVal.toFixed(1)}`);
            const probe0 = await page.evaluate(() => {
              const floatsBefore = window.combatFloatCount || 0;
              const foeBefore = window.encounter.foe_health;
              document.querySelector('[data-command="STRIKE"]').click();
              return { floatsBefore, foeBefore, foeAfterCommand: window.encounter.foe_health };
            });
            await page.waitForTimeout(150);
            const floatCheck = await page.evaluate(() => ({
              damageFloatSeen: Boolean(document.querySelector(".combat-float-damage")),
              floats: window.combatFloatCount || 0
            }));
            // DET8 single-application: wait past a full lane traversal
            // (100%/40%/s = 2.5s) — arrival must not re-apply the effect.
            await page.waitForTimeout(3300);
            const foeAfterTraversal = await page.evaluate(() => window.encounter.foe_health);
            tradeProbe = {
              strikeApplied: probe0.foeBefore - probe0.foeAfterCommand,
              foeAfterCommand: probe0.foeAfterCommand,
              foeAfterTraversal,
              damageFloatSeen: floatCheck.damageFloatSeen,
              floatsDelta: floatCheck.floats - probe0.floatsBefore
            };
            console.log("[Stage 5/trade] Inline single-application probe:", JSON.stringify(tradeProbe));
          } else if (status.roundVal === 1 && status.intentVal === "SURGE") {
            console.log(`[Stage 5/trade] Round 1 DISRUPT on SURGE. Focus: ${status.focusVal.toFixed(1)}`);
            await page.evaluate(() => document.querySelector('[data-command="DISRUPT"]').click());
            await page.waitForTimeout(150);
            tradeCostBadge = await page.evaluate(() => {
              const btn = document.querySelector('[data-command="DISRUPT"]');
              return btn ? (btn.querySelector(".cost-badge")?.textContent || null) : null;
            });
            console.log("[Stage 5/trade] DISRUPT cost badge after escalation:", JSON.stringify(tradeCostBadge));
          } else if (status.roundVal === 2) {
            console.log(`[Stage 5/trade] Round 2 finishing STRIKE. Focus: ${status.focusVal.toFixed(1)}`);
            await page.keyboard.press("s");
          }
        }
        await page.waitForTimeout(400);
        continue;
      } else if (strategy === "reactive" && stageNum === 5 && status.roundVal === 2 && status.focusVal >= 1) {
        // DET8-E2E pinned anti-dominance sequence: DISRUPT, DISRUPT, BRACE.
        // Round 2 deliberately BRACEs (not STRIKEs): reactive counterplay alone
        // must end in HOLD with the foe alive at 3 — never a victory.
        console.log(`[Stage 5/reactive] Round 2 BRACE (pinned D,D,B anti-dominance line). Focus: ${status.focusVal.toFixed(1)}`);
        await page.keyboard.press("b");
        await page.waitForTimeout(400);
        continue;
      } else if (status.focusVal >= 1) {
        if (status.intentVal === "SURGE") {
          if (!status.surgeCounteredVal) {
            console.log(`[Stage ${stageNum}] Disrupting Foe's SURGE! Focus: ${status.focusVal.toFixed(1)}`);
            await page.keyboard.press("d");
            // DET6/DET8 (universal model): an accepted DISRUPT resolves the
            // whole round — verify once that it fielded a disruptor and the
            // round advanced (surge_countered is transient and already reset).
            if (!disruptCounterVerified) {
              const roundBefore = status.roundVal;
              await page.waitForTimeout(400);
              const counter = await page.evaluate(() => {
                const units = window.activeUnits || [];
                return {
                  round: window.encounter ? window.encounter.round : -1,
                  outcome: window.encounter ? window.encounter.outcome : "UNKNOWN",
                  disruptors: units.filter((u) => u.type === "DISRUPT").length
                };
              });
              console.log(`[Stage ${stageNum}] DISRUPT round response:`, JSON.stringify({ roundBefore, ...counter }));
              if (counter.round > roundBefore || counter.outcome !== "ACTIVE") {
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
    const commandLog = await page.evaluate(() => window.commandLog || []);
    console.log(`Stage ${stageNum} command log:`, JSON.stringify(commandLog));
    
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
    return { outcome: stageOutcome, foeHealth: stageFoeHealth, commandLog };
  }
  
  // === CAMPAIGN 1 (reactive baseline) — DET8-E2E anti-dominance evidence ===
  const campaign1 = [];
  for (let i = 1; i <= 5; i++) {
    campaign1.push(await playStage(i));
  }
  // Universal reducer routing (stage1-rules-v2): stage 1 must stay winnable.
  // Stages 2-4 currently have ZERO victory plans in the 64-plan sweep — an
  // OPEN stop-ship balance finding owned by P2 systems (peer); the enforcing
  // gate is `node scripts/balance-numbers.mjs --gate` (fails today). E2E stays
  // balance-agnostic here: any non-defeat outcome passes, so a peer rebalance
  // lands without editing this file, and the defect is NOT codified as spec.
  assert.equal(campaign1[0].outcome, "VICTORY", "Stage 1 must remain winnable by reactive play");
  for (let i = 1; i < 4; i++) {
    assert.ok(["VICTORY", "HOLD"].includes(campaign1[i].outcome), `Stage ${i + 1} must not be lost by competent reactive play (got ${campaign1[i].outcome})`);
  }
  assert.equal(campaign1[4].outcome, "HOLD", "ANTI-DOMINANCE: the pinned reactive D,D,B line on Stage 5 must end in HOLD, never VICTORY");
  assert.equal(campaign1[4].foeHealth, 3, "ANTI-DOMINANCE: reactive counterplay must leave the Stage 5 foe alive at 3 health");
  assert.deepEqual(campaign1[4].commandLog, ["DISRUPT", "DISRUPT", "BRACE"], "ANTI-DOMINANCE: the accepted Stage 5 command stream must be exactly D,D,B");

  // Cycle 006 campaign-level evidence
  assert.equal(sawHostileTelegraph, true, "Hostile void-spawn telegraph must be observed during at least one active charge cycle");
  assert.equal(disruptCounterVerified, true, "At least one DISRUPT counter must dispel the telegraph wave and field an Arcane Disruptor");
  console.log("Cycle 006 evidence: hostile telegraph observed and DISRUPT counter dispel verified.");
  
  // Campaign-1 settlement: stages 1-4 VICTORY x2 fragments + Stage 5 HOLD x0 = 8
  console.log("\n=== VERIFYING CAMPAIGN 1 SETTLEMENT (reactive) ===");
  const settlementText = await page.locator("#settlement-summary").textContent();
  console.log("Settlement Summary:", settlementText);
  assert.ok(settlementText.includes("settled"), "Settlement summary must indicate campaign is settled");
  const c1Victories = campaign1.filter((s) => s.outcome === "VICTORY").length;
  assert.ok(settlementText.includes(`${c1Victories * 2} fragments`), `Settlement must equal 2 x observed victories (${c1Victories}) — HOLD awards zero (got "${settlementText}")`);

  // === CAMPAIGN 2 (deliberate trade) — DET8-E2E victory-line evidence ===
  console.log("\n=== CAMPAIGN 2: DELIBERATE-TRADE STAGE 5 WIN ===");
  await page.click("#restart-button");
  await page.waitForSelector("#lobby-screen:not([hidden])", { timeout: 3000 });
  await page.click("#begin-button");
  const campaign2 = [];
  for (let i = 1; i <= 5; i++) {
    campaign2.push(await playStage(i, { strategy: i === 5 ? "trade" : "reactive", deepChecks: false }));
  }
  assert.equal(campaign2[4].outcome, "VICTORY", "TRADE LINE: STRIKE -> DISRUPT-on-SURGE -> STRIKE must win Stage 5 in the live browser");
  assert.equal(campaign2[4].foeHealth, 0, "TRADE LINE: the Stage 5 foe must reach 0 health");
  assert.deepEqual(campaign2[4].commandLog, ["STRIKE", "DISRUPT", "STRIKE"], "TRADE LINE: the accepted Stage 5 command stream must be exactly S,D,S");
  const settlement2 = await page.locator("#settlement-summary").textContent();
  console.log("Campaign 2 Settlement:", settlement2);
  const c2Victories = campaign2.filter((s) => s.outcome === "VICTORY").length;
  assert.ok(settlement2.includes(`${c2Victories * 2} fragments`), `Trade-campaign settlement must equal 2 x observed victories (${c2Victories}) (got "${settlement2}")`);

  // DET8/DET9 inline probes (captured during the real Stage 5 trade line)
  assert.ok(tradeProbe, "Trade line must capture the inline single-application probe");
  assert.equal(tradeProbe.strikeApplied, 2, "Reducer must apply the STRIKE effect exactly once at command time");
  assert.equal(tradeProbe.foeAfterTraversal, tradeProbe.foeAfterCommand, "Unit arrival must NOT re-apply the STRIKE effect (foe health unchanged across traversal)");
  assert.equal(tradeProbe.damageFloatSeen, true, "DET9-JUICE: foe damage must render a floating combat number");
  assert.ok(tradeProbe.floatsDelta >= 2, `DET9-JUICE: the resolved round must spawn multiple vitals floats (got ${tradeProbe.floatsDelta})`);
  assert.equal(tradeCostBadge, "2⚡", `DET9-NUM: after one DISRUPT the button must surface the escalated cost 2⚡ (got ${tradeCostBadge})`);

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
    for (let i = 0; i < 200; i++) {
      const worker = canonical.active || canonical.waiting || canonical.installing;
      if (worker && worker.scriptURL.endsWith("/sw.js") && !worker.scriptURL.includes("?")
          && (canonical.active || worker.state === "activated")) {
        canonicalURL = worker.scriptURL;
        break;
      }
      if (canonical.active && canonical.active.scriptURL.endsWith("/sw.js") && !canonical.active.scriptURL.includes("?")) {
        canonicalURL = canonical.active.scriptURL;
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
  assert.equal(swState.buildTag, "c009", "Reload under SW control must serve the fresh c009 app.js (network-first core)");

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
  assert.equal(controlledTag.buildTag, "c009", "SW-controlled reload must still serve fresh core (network-first, cache fallback)");
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
