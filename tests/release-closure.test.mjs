import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = new URL("../", import.meta.url);
const RULES_VERSION = "defense-survivor-v1";
const RUNTIME_PATHS = new Set([
  "index.html", "app.js", "defense-viewport.js", "defense-catalog.js", "defense-run-simulation.js",
  "campaign-state.js", "defense-storage.js", "battle-realtime-three.js", "battle-visualizer.js", "styles.css",
  "react-game-ui.css", "sw.js", "manifest.json", "icon.svg", "privacy.html",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png",
]);

async function project(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

function job(workflow, name) {
  const jobs = "resolve_revision|engine_contract|release_closure|browser_contract|package_pages|artifact_smoke|deploy_pages|deployed_smoke|release_receipt";
  const match = workflow.match(new RegExp(`^  ${name}:\\n(?<body>[\\s\\S]*?)(?=^  (?:${jobs}):|(?![\\s\\S]))`, "m"));
  assert.ok(match, `workflow must define ${name}`);
  return match.groups.body;
}

function runtimePaths(workflow) {
  const match = workflow.match(/PAGES_RUNTIME_PATHS: >-\n(?<paths>(?: {4,}[^\n]+\n)+)/);
  assert.ok(match, "workflow must declare the Pages runtime allowlist");
  return new Set(match.groups.paths.trim().split(/\s+/));
}

test("Pages workflow preserves the defense-survivor release DAG and closure", async () => {
  const workflow = await project(".github/workflows/static.yml");
  const order = [
    "resolve_revision", "engine_contract", "release_closure", "browser_contract", "package_pages",
    "artifact_smoke", "deploy_pages", "deployed_smoke", "release_receipt",
  ];
  for (const name of order) assert.ok(job(workflow, name), `workflow must include ${name}`);

  for (const name of ["engine_contract", "release_closure", "browser_contract"]) {
    assert.match(job(workflow, name), /needs: resolve_revision/);
  }
  assert.match(job(workflow, "package_pages"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract\]/);
  assert.match(job(workflow, "artifact_smoke"), /needs: \[resolve_revision, package_pages\]/);
  assert.match(job(workflow, "deploy_pages"), /needs: \[resolve_revision, artifact_smoke\]/);
  assert.match(job(workflow, "deployed_smoke"), /needs: \[resolve_revision, deploy_pages\]/);
  assert.match(job(workflow, "deployed_smoke"), /if: needs\.deploy_pages\.result == 'success'/);
  assert.match(job(workflow, "release_receipt"), /if: always\(\)/);
  assert.match(job(workflow, "release_receipt"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract, package_pages, artifact_smoke, deploy_pages, deployed_smoke\]/);

  assert.deepEqual(runtimePaths(workflow), RUNTIME_PATHS);
  assert.match(workflow, /"rules_version":"%s"/);
  assert.match(workflow, /node scripts\/validate-pages-version\.mjs --file "\$PAGES_ARTIFACT_DIR\/version\.json" --sha "\$RESOLVED_SHA"/);
  assert.match(workflow, /status=unsupported-no-deployed-defense-smoke/);
  assert.match(job(workflow, "release_receipt"), /for result in "\$ENGINE" "\$CLOSURE" "\$BROWSER" "\$PACKAGE" "\$ARTIFACT" "\$DEPLOY" "\$DEPLOYED"; do/);
  for (const name of ["engine_contract", "release_closure", "browser_contract", "package_pages", "artifact_smoke", "deployed_smoke"]) {
    assert.match(job(workflow, name), /actions\/setup-node@[0-9a-f]{40}/, `${name} must pin the Node runtime`);
    assert.match(job(workflow, name), /node-version: 22\.14\.0/, `${name} must use the supported Node version`);
  }
  assert.match(job(workflow, "deployed_smoke"), /npm ci/);
  assert.match(job(workflow, "deployed_smoke"), /playwright install --with-deps chromium/);
  assert.match(job(workflow, "deployed_smoke"), /--rules-version "\$RULES_VERSION"/);
  assert.match(job(workflow, "release_receipt"), /"all_gate_pass":%s/);
  assert.match(job(workflow, "release_receipt"), /test "\$all_gate_pass" = true/);
  assert.doesNotMatch(workflow.match(/PAGES_RUNTIME_PATHS: >-[\s\S]*?\n\n/)?.[0] ?? "", /react-game-ui\.js|react-shop|vendor\/react|tactical|minimap|battle-field|campaign-sync|assets\/(?:models|video)/i);

  for (const use of workflow.matchAll(/^\s+uses: [^\n]+$/gm)) {
    assert.match(use[0], /@[0-9a-f]{40}$/, `action must be SHA-pinned: ${use[0]}`);
  }
  for (const name of order) {
    assert.match(job(workflow, name), /if: always\(\)[\s\S]*?upload-artifact/, `${name} must upload results even after failure`);
  }
});

test("version scripts enforce the exact defense rules version", async () => {
  const reader = await project("scripts/read-defense-rules-version.mjs");
  assert.match(reader, new RegExp(`RULES_VERSION = "${RULES_VERSION}"`));
  assert.match(reader, /defense-catalog\.js must export RULES_VERSION/);

  const directory = await mkdtemp(join(tmpdir(), "pages-version-"));
  const versionFile = join(directory, "version.json");
  const sha = "a".repeat(40);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: RULES_VERSION }));
  await execFileAsync(process.execPath, ["scripts/validate-pages-version.mjs", "--file", versionFile, "--sha", sha]);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: "wrong" }));
  await assert.rejects(execFileAsync(process.execPath, ["scripts/validate-pages-version.mjs", "--file", versionFile, "--sha", sha]));
});
test("Pages artifact smoke follows side-effect local imports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pages-artifact-"));
  const required = [
    "index.html", "version.json", "app.js", "defense-viewport.js", "defense-catalog.js",
    "defense-run-simulation.js", "campaign-state.js", "defense-storage.js",
    "battle-realtime-three.js", "battle-visualizer.js", "styles.css", "react-game-ui.css",
    "sw.js", "manifest.json",
  ];
  for (const file of required) {
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file === "app.js" ? 'import "./bootstrap.js";\n' : "");
  }

  const command = new URL("tests/pages-artifact-smoke.cjs", ROOT).pathname;
  await assert.rejects(execFileAsync(process.execPath, [command, "--dir", directory]));
  await writeFile(join(directory, "bootstrap.js"), "export const boot = true;\n");
  await execFileAsync(process.execPath, [command, "--dir", directory]);
});
