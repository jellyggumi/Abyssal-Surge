import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/defense-asset-manifest.json');
const retainedPaths = new Set([
  'assets/defense-asset-manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
]);

function trackedAssetPaths() {
  const result = spawnSync('git', ['ls-files', '-z', 'assets'], {
    cwd: root,
    encoding: 'buffer',
  });
  assert.equal(result.status, 0, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right));
}

test('defense asset manifest has literal, complete dispositions when generated', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.generatedBy, 'scripts/build-defense-asset-manifest.mjs');
  assert.equal(
    manifest.regeneration,
    'Run node scripts/build-defense-asset-manifest.mjs --write before the destructive deletion commit.',
  );
  assert.equal(typeof manifest.pendingGeneration, 'boolean');
  assert.ok(Array.isArray(manifest.rows));
  assert.ok(Array.isArray(manifest.historicalDeletionRows));

  if (manifest.pendingGeneration) {
    assert.deepEqual(manifest.rows, []);
    return;
  }

  const currentPaths = trackedAssetPaths();
  const paths = manifest.rows.map((row) => row.currentPath);
  assert.deepEqual(paths, [...paths].sort((left, right) => left.localeCompare(right)));
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths, currentPaths);

  for (const row of manifest.rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      'currentPath',
      'disposition',
      'extension',
      'generator',
      'replacementPath',
      'runtimeReference',
      'testDisposition',
    ]);
    assert.ok(row.currentPath.startsWith('assets/'));
    assert.equal(row.currentPath.includes('*'), false);
    assert.equal(row.currentPath.endsWith('/'), false);
    assert.equal(row.extension, extname(row.currentPath));
    assert.equal(row.generator, 'scripts/build-defense-asset-manifest.mjs');
    assert.ok(['retain', 'delete'].includes(row.disposition));
    assert.equal(row.testDisposition, row.disposition);

    const retained = retainedPaths.has(row.currentPath);
    assert.equal(row.disposition, retained ? 'retain' : 'delete');
    assert.equal(row.runtimeReference, retained);
    assert.equal(row.replacementPath, retained ? row.currentPath : null);

    assert.equal(/^assets\/video\//.test(row.currentPath) && retained, false);
    assert.equal(/^assets\/models\//.test(row.currentPath) && retained, false);
    assert.equal(/\/action-[^/]+$/.test(row.currentPath) && retained, false);
    assert.equal(/^assets\/images\/resource-refinement\//.test(row.currentPath) && retained, false);
  }

  const historicalPaths = manifest.historicalDeletionRows.map((row) => row.currentPath);
  assert.deepEqual(historicalPaths, [...historicalPaths].sort((left, right) => left.localeCompare(right)));
  assert.equal(new Set(historicalPaths).size, historicalPaths.length);
  for (const row of manifest.historicalDeletionRows) {
    assert.equal(row.disposition, 'delete');
    assert.equal(row.testDisposition, 'delete');
    assert.equal(row.runtimeReference, false);
    assert.equal(row.replacementPath, null);
    assert.equal(row.extension, extname(row.currentPath));
    assert.equal(row.generator, 'scripts/build-defense-asset-manifest.mjs');
    assert.equal(currentPaths.includes(row.currentPath), false);
  }
});
