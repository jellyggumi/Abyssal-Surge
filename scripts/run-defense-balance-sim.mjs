#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { RULES_VERSION, STAGES } from "../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const outputIndex = args.indexOf("--output");
const output = outputIndex === -1 ? null : args[outputIndex + 1];
if (outputIndex !== -1 && !output) throw new Error("--output requires a path");
const SEEDS = Object.freeze([1, 17, 991]);
const MOVE_IDLE = "IDLE";
const MAX_TICKS = 18_000;

function play(stageId, seed) {
  let run = createDefenseRun({ stageId, seed });
  const offers = [];
  const extractions = [];
  const failures = [];
  let lastTick = -1;
  try {
    for (let turns = 0; turns < MAX_TICKS && !isTerminalRun(run); turns += 1) {
      let snapshot = getRunSnapshot(run);
      if (snapshot.growthOffer) {
        const skillId = snapshot.growthOffer.choices[0];
        if (!skillId) throw new Error("growth offer had no eligible choice");
        offers.push({ tick: snapshot.tick, level: snapshot.growthOffer.level, skillId });
        run = queueInput(run, "SKILL_SELECTED", { skillId });
      } else {
        run = queueInput(run, "MOVE", MOVE_IDLE);
        for (const skillId of snapshot.commander.skills) run = queueInput(run, "SKILL_CAST", { skillId });
        if (snapshot.eliteCandidate && !snapshot.extracted) {
          extractions.push({ tick: snapshot.tick, enemyId: snapshot.eliteCandidate.enemyId, prototype: snapshot.eliteCandidate.prototype });
          run = queueInput(run, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
        }
      }
      run = advanceDefenseRun(run, 1);
      snapshot = getRunSnapshot(run);
      if (snapshot.tick <= lastTick && !snapshot.growthOffer) throw new Error("simulation could not progress");
      lastTick = snapshot.tick;
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  const snapshot = getRunSnapshot(run);
  if (!isTerminalRun(run) && !failures.length) failures.push(`simulation did not reach a terminal outcome within ${MAX_TICKS} ticks`);
  return { seed, stageId, outcome: snapshot.terminal, tick: snapshot.tick, offers, extractions, digest: getRunDigest(run), failures };
}

const runs = [];
for (const stage of STAGES) for (const seed of SEEDS) {
  const first = play(stage.id, seed);
  const repeat = play(stage.id, seed);
  if (first.digest !== repeat.digest) first.failures.push("repeat run produced a different deterministic digest");
  runs.push(first);
}
const failures = runs.flatMap((run) => run.failures.map((message) => ({ stageId: run.stageId, seed: run.seed, message })));
const report = {
  simulator: "run-defense-balance-sim.mjs",
  rulesVersion: RULES_VERSION,
  catalogVersion: RULES_VERSION,
  seeds: SEEDS,
  stages: runs,
  failures,
  pass: failures.length === 0,
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json, "utf8");
}
process.stdout.write(json);
if (strict && !report.pass) process.exitCode = 1;
