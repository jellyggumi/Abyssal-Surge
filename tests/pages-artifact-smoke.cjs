#!/usr/bin/env node
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve, dirname, relative } = require("node:path");

const REQUIRED_FILES = [
  "index.html",
  "version.json",
  "app.js",
  "defense-viewport.js",
  "defense-catalog.js",
  "defense-run-simulation.js",
  "campaign-state.js",
  "defense-storage.js",
  "battle-realtime-three.js",
  "battle-visualizer.js",
  "styles.css",
  "react-game-ui.css",
  "sw.js",
  "manifest.json",
];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function localModuleSpecifiers(source) {
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1].split(/[?#]/, 1)[0]);
}

function assertWithin(root, path) {
  assert.ok(relative(root, path) && !relative(root, path).startsWith(".."), `module import escapes artifact: ${path}`);
}

function verifyModuleClosure(root, modulePath, visited = new Set()) {
  if (visited.has(modulePath)) return;
  visited.add(modulePath);
  const source = readFileSync(modulePath, "utf8");
  for (const specifier of localModuleSpecifiers(source)) {
    const imported = resolve(dirname(modulePath), specifier);
    assertWithin(root, imported);
    assert.ok(existsSync(imported), `missing local module import ${specifier} from ${relative(root, modulePath)}`);
    verifyModuleClosure(root, imported, visited);
  }
}

function main() {
  const directory = argument("--dir");
  if (!directory) throw new Error("Usage: pages-artifact-smoke.cjs --dir <Pages artifact directory>");
  const root = resolve(directory);
  for (const file of REQUIRED_FILES) assert.ok(existsSync(resolve(root, file)), `missing Pages artifact file: ${file}`);
  for (const module of REQUIRED_FILES.filter((file) => file.endsWith(".js"))) {
    verifyModuleClosure(root, resolve(root, module));
  }
}

main();
