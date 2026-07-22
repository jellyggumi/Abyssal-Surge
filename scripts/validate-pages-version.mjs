#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES_VERSION } from "./read-defense-rules-version.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function validatePagesVersion({ file, sha }) {
  assert.match(sha, /^[0-9a-f]{40}$/, "candidate SHA must be a full lowercase 40-character SHA");
  const version = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(version, { candidate_sha: sha, rules_version: RULES_VERSION });
  return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = option("--file");
  const sha = option("--sha");
  if (!file || !sha) throw new Error("Usage: validate-pages-version.mjs --file <version.json> --sha <sha>");
  await validatePagesVersion({ file: resolve(file), sha });
}
