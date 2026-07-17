import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const ATLAS_DIRECTORY = "assets/images/ui/narration-atlases/";
const EXPECTED_ATLASES = Object.freeze([
  {
    filename: "assets/images/ui/narration-atlases/boss-cinder-warden-atlas.png",
    source: "assets/images/ui/boss-cinder-warden.png",
  },
  {
    filename: "assets/images/ui/narration-atlases/boss-veil-tactician-atlas.png",
    source: "assets/images/ui/boss-veil-tactician.png",
  },
  {
    filename: "assets/images/ui/narration-atlases/boss-gate-sovereign-atlas.png",
    source: "assets/images/ui/boss-gate-sovereign.png",
  },
]);

async function projectFile(path) {
  return readFile(new URL(path, ROOT));
}

function pngDimensions(bytes) {
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "atlas must be a PNG file",
  );
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", "atlas PNG must begin with an IHDR chunk");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("narrator atlas artifacts, provenance, and hashes match their manifest records", async () => {
  const manifest = JSON.parse((await projectFile("assets/media-manifest.json")).toString("utf8"));
  const records = new Map(manifest.assets.map((asset) => [asset.filename, asset]));
  const declaredAtlasPaths = manifest.assets
    .map((asset) => asset.filename)
    .filter((filename) => filename.startsWith(ATLAS_DIRECTORY))
    .sort();
  const expectedAtlasPaths = EXPECTED_ATLASES.map(({ filename }) => filename).sort();

  assert.deepEqual(declaredAtlasPaths, expectedAtlasPaths, "the media manifest must declare exactly the three generated narrator atlases");

  for (const { filename, source } of EXPECTED_ATLASES) {
    const [bytes, record, sourceRecord] = await Promise.all([
      projectFile(filename),
      Promise.resolve(records.get(filename)),
      Promise.resolve(records.get(source)),
    ]);

    assert.ok(record, `${filename} must have a media manifest record`);
    assert.ok(sourceRecord, `${filename} must retain its source portrait record`);
    assert.deepEqual(pngDimensions(bytes), { width: 1024, height: 1024 }, `${filename} must be a 4×4 grid of 256px tiles`);
    assert.equal(record.media_type, "image/png");
    assert.equal(record.bytes, bytes.byteLength, `${filename} manifest byte count must match the artifact`);
    assert.equal(record.sha256, createHash("sha256").update(bytes).digest("hex"), `${filename} manifest hash must match the artifact`);
    assert.match(record.generated_by, /scripts\/build_narration_sprites\.py/i);
    assert.match(record.generated_by, /no GTI invocation/i);
    assert.deepEqual(record.source_key_art, [source], `${filename} must name only its manifest-proven portrait`);
    assert.deepEqual(record.source_assets, [source], `${filename} must name only its manifest-proven portrait`);
    assert.match(record.derivation, /4x4/i);
    assert.match(record.derivation, /sixteen ordered 256px frames/i);
    assert.match(record.derivation, /16 fps/i);
    assert.match(sourceRecord.generated_by, /\bgti\b/i, `${source} must remain an established GTI portrait record`);
  }
});

test("narrator atlas runtime, cache, and reduced-motion contracts retain every generated path", async () => {
  const [app, serviceWorker, styles] = await Promise.all([
    projectFile("app.js").then((source) => source.toString("utf8")),
    projectFile("sw.js").then((source) => source.toString("utf8")),
    projectFile("styles.css").then((source) => source.toString("utf8")),
  ]);

  for (const { filename } of EXPECTED_ATLASES) {
    assert.ok(app.includes(`"${filename}"`), `app.js must select ${filename} for stage narration`);
    assert.ok(serviceWorker.includes(`"./${filename}"`), `sw.js must pre-cache ${filename}`);
  }

  assert.match(styles, /\.narrator-atlas\s*\{[\s\S]*?background-size:\s*cover,\s*400%\s+400%;[\s\S]*?animation:\s*narrator-atlas\s+1s\s+steps\(1,\s*end\)\s+infinite;/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.narrator-atlas\s*\{\s*animation:\s*none;\s*background-position:\s*center,\s*0\s+0;/);
});
