import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const TEXT_EXTENSIONS = new Set([".cjs", ".css", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".txt", ".yml", ".yaml"]);
const EXCLUDED_PREFIXES = [
  ".gjc/",
  ".omc/",
  "_workspace/20260716-",
];
const EXCLUDED_PATHS = new Set([
  "assets/defense-asset-manifest.json",
  "tests/no-rts-closure.test.mjs",
  "tests/release-closure.test.mjs",
]);
const retiredPaths = [
  "battle-field-command-overlay.js",
  "battle-field-command-overlay.css",
  "tactical-minimap.js",
  "game-core.js",
  "react-game-ui.js",
  "react-shop.js",
  "stage-navigation.js",
];
const forbiddenText = [
  /\brts-rpg\b/i,
  /battle-field-command-overlay/i,
  /tacticalminimap/i,
  /data-action="(?:hunt|materialize|capture|possess|domain|assault)"/i,
  /\baction-(?:hunt|materialize|capture|possess|domain|assault)\b/i,
  /\b(?:ACTION_KEYS|DIGIT_ACTION_KEYS)\b/,
  /\bcommand-grid\b/i,
];

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort();
}

function isLiveText(path) {
  if (EXCLUDED_PATHS.has(path) || EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  return TEXT_EXTENSIONS.has(extname(path)) || /^README(?:\.|$)/i.test(path);
}

test("live product closure contains no retired RTS surfaces or terminology", () => {
  const files = trackedFiles();
  for (const retired of retiredPaths) assert.equal(files.includes(retired), false, `retired path remains tracked: ${retired}`);

  const violations = [];
  for (const path of files.filter(isLiveText)) {
    const source = readFileSync(resolve(ROOT, path), "utf8")
      .replace("wiki/reports/shadow-lord-rts-rpg-hybrid-design.md", "external-wiki-unmounted");
    for (const pattern of forbiddenText) {
      if (pattern.test(source)) violations.push(`${path}: ${pattern}`);
    }
  }
  assert.deepEqual(violations, []);
});
