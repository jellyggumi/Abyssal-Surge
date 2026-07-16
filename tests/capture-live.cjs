const playwright = require("playwright");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const localUrl = "http://127.0.0.1:8080/index.html";

console.log("=== Starting Playwright Live Capture & Visual Audit ===");

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
  
  await page.setViewportSize({ width: 1280, height: 1200 });
  
  console.log("Navigating to:", localUrl);
  await page.goto(localUrl, { waitUntil: "domcontentloaded" });
  
  // 1. Clear state and reload to get a clean lobby screen
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  
  // Capture Lobby screen
  await page.evaluate(() => window.scrollTo(0, 0));
  const lobbyPath = path.resolve(root, "tests/playtest_lobby.png");
  await page.screenshot({ path: lobbyPath });
  console.log("Saved lobby screenshot to:", lobbyPath);
  
  // 2. Click Begin
  await page.click("#begin-button");
  await page.waitForSelector("#play-screen:not([hidden])");
  
  // 3. Toggle settings panel and capture it
  await page.click("#settings-toggle");
  await page.waitForSelector("#settings-panel:not([style*='display: none'])");
  await page.evaluate(() => window.scrollTo(0, 0));
  const settingsPath = path.resolve(root, "tests/playtest_settings.png");
  await page.screenshot({ path: settingsPath });
  console.log("Saved settings screenshot to:", settingsPath);
  
  // Close settings panel
  await page.click("#settings-toggle");
  await page.waitForSelector("#settings-panel", { state: "hidden", timeout: 2000 });
  
  // 4. Click Strike and capture walk animation sequence
  console.log("Clicking STRIKE...");
  await page.click('button[data-command="STRIKE"]');
  
  // Capture at 300ms (Start of walk)
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  const walkStartPath = path.resolve(root, "tests/playtest_walk_start.png");
  await page.screenshot({ path: walkStartPath });
  console.log("Saved walk-start screenshot to:", walkStartPath);
  
  // Capture at 1500ms (Midpoint of walk)
  await page.waitForTimeout(1200);
  
  // Capture Desktop Midpoint
  await page.evaluate(() => window.scrollTo(0, 0));
  const walkMidPath = path.resolve(root, "tests/playtest_walk_mid.png");
  await page.screenshot({ path: walkMidPath });
  console.log("Saved walk-mid (Desktop) screenshot to:", walkMidPath);
  
  // Capture Mobile Midpoint
  console.log("Resizing viewport to mobile (375x812)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200); // Wait for transition/reflow
  await page.evaluate(() => window.scrollTo(0, 0));
  const walkMidMobilePath = path.resolve(root, "tests/playtest_walk_mid_mobile.png");
  await page.screenshot({ path: walkMidMobilePath });
  console.log("Saved walk-mid (Mobile) screenshot to:", walkMidMobilePath);
  
  // Restore Viewport
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.waitForTimeout(200);
  // Capture at 2700ms (Near portal collision)
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  const walkEndPath = path.resolve(root, "tests/playtest_walk_end.png");
  await page.screenshot({ path: walkEndPath });
  console.log("Saved walk-end screenshot to:", walkEndPath);
  
  // Clean up — deterministic shutdown: destroy keep-alive sockets and await
  // server close so the success exit code reflects real completion.
  await page.close();
  await browser.close();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  console.log("=== Visual Capture Complete ===");
}

run().catch((err) => {
  console.error("Capture failed:", err);
  server.close();
  process.exit(1);
});
