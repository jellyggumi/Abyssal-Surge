#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const RULES_VERSION = "defense-survivor-v1";

export async function readDefenseRulesVersion(catalogPath = new URL("../defense-catalog.js", import.meta.url)) {
  const source = await readFile(catalogPath, "utf8");
  const match = source.match(/export\s+const\s+RULES_VERSION\s*=\s*["']([^"']+)["']\s*;/);
  if (!match) throw new Error("defense-catalog.js must export RULES_VERSION");
  return match[1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = await readDefenseRulesVersion(process.argv[2]);
  if (version !== RULES_VERSION) {
    throw new Error(`Expected ${RULES_VERSION}, received ${version}`);
  }
  process.stdout.write(`${version}\n`);
}
