#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/defense-asset-manifest.json');
const retainedPaths = new Set([
  'assets/defense-asset-manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
]);

function parseArguments(argumentsList) {
  let write = false;
  let baselinePath = manifestPath;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--write') {
      write = true;
    } else if (argument === '--baseline') {
      const suppliedPath = argumentsList[index + 1];
      if (!suppliedPath || suppliedPath.startsWith('--')) {
        throw new Error('--baseline requires a path');
      }
      baselinePath = resolve(root, suppliedPath);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { baselinePath, write };
}

function readBaseline(baselinePath) {
  if (!existsSync(baselinePath)) {
    return { rows: [], historicalDeletionRows: [] };
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  return {
    rows: Array.isArray(baseline.rows) ? baseline.rows : [],
    historicalDeletionRows: Array.isArray(baseline.historicalDeletionRows) ? baseline.historicalDeletionRows : [],
  };
}

function trackedAssetPaths() {
  const result = spawnSync('git', ['ls-files', '-z', 'assets'], {
    cwd: root,
    encoding: 'buffer',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.toString('utf8').trim() || 'git ls-files failed');
  }

  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function rowFor(currentPath) {
  const disposition = retainedPaths.has(currentPath) ? 'retain' : 'delete';
  return {
    disposition,
    currentPath,
    replacementPath: disposition === 'retain' ? currentPath : null,
    extension: extname(currentPath),
    generator: 'scripts/build-defense-asset-manifest.mjs',
    runtimeReference: disposition === 'retain',
    testDisposition: disposition,
  };
}

function deletedRow(currentPath) {
  return {
    disposition: 'delete',
    currentPath,
    replacementPath: null,
    extension: extname(currentPath),
    generator: 'scripts/build-defense-asset-manifest.mjs',
    runtimeReference: false,
    testDisposition: 'delete',
  };
}

function buildManifest(baseline, currentPaths) {
  const currentSet = new Set(currentPaths);
  const historicalPaths = new Set(
    [...baseline.rows, ...baseline.historicalDeletionRows]
      .map((row) => row?.currentPath)
      .filter((currentPath) => typeof currentPath === 'string' && currentPath.startsWith('assets/') && !currentSet.has(currentPath)),
  );
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/build-defense-asset-manifest.mjs',
    regeneration: 'Run node scripts/build-defense-asset-manifest.mjs --write before the destructive deletion commit.',
    pendingGeneration: false,
    rows: currentPaths.map(rowFor),
    historicalDeletionRows: [...historicalPaths].sort((left, right) => left.localeCompare(right)).map(deletedRow),
  };
}

const { baselinePath, write } = parseArguments(process.argv.slice(2));
const manifest = buildManifest(readBaseline(baselinePath), trackedAssetPaths());
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (write) {
  writeFileSync(manifestPath, serialized);
} else {
  process.stdout.write(serialized);
}
