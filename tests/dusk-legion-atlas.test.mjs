import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const ATLAS_PATH = "assets/images/characters/dusk-legion-atlas.png";
const ATLAS_MANIFEST_PATH = "assets/images/characters/dusk-legion-atlas.json";
const SOURCE_PORTRAIT = "assets/images/ui/boss-cinder-warden.png";
const FRAME_SIZE = 256;
const FRAME_PADDING = 2;
const GRID_SIZE = 4;
const SLOT_SIZE = FRAME_SIZE + FRAME_PADDING * 2;

const EXPECTED_FRAMES = Object.freeze(
  Array.from({ length: 16 }, (_, frame) => {
    const facing = Math.floor(frame / 2);
    const phase = frame % 2;
    return [
      `f${facing}-p${phase}`,
      {
        x: FRAME_PADDING + (frame % GRID_SIZE) * SLOT_SIZE,
        y: FRAME_PADDING + Math.floor(frame / GRID_SIZE) * SLOT_SIZE,
        width: FRAME_SIZE,
        height: FRAME_SIZE,
        pivotX: 128,
        pivotY: 224,
        facing,
        phase,
      },
    ];
  }),
);

async function projectFile(path) {
  return readFile(new URL(path, ROOT));
}

function pngDimensions(bytes) {
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "Dusk Legion atlas must be a PNG file",
  );
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", "Dusk Legion PNG must begin with an IHDR chunk");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("Dusk Legion conceptual atlas artifact, frame manifest, and provenance stay synchronized", async () => {
  const [atlasBytes, atlasManifestBytes, mediaManifestBytes] = await Promise.all([
    projectFile(ATLAS_PATH),
    projectFile(ATLAS_MANIFEST_PATH),
    projectFile("assets/media-manifest.json"),
  ]);
  const atlasManifest = JSON.parse(atlasManifestBytes.toString("utf8"));
  const mediaManifest = JSON.parse(mediaManifestBytes.toString("utf8"));
  const records = new Map(mediaManifest.assets.map((asset) => [asset.filename, asset]));
  const record = records.get(ATLAS_PATH);
  const sourceRecord = records.get(SOURCE_PORTRAIT);

  assert.deepEqual(pngDimensions(atlasBytes), { width: 1040, height: 1040 });
  assert.deepEqual(atlasManifest.page, {
    url: ATLAS_PATH,
    width: 1040,
    height: 1040,
  });
  assert.equal(atlasManifest.fps, 16);
  assert.equal(atlasManifest.frameWidth, FRAME_SIZE);
  assert.equal(atlasManifest.frameHeight, FRAME_SIZE);
  assert.equal(atlasManifest.gutter, FRAME_PADDING * 2, "adjacent 2px frame padding rails form the 4px inner gutter");
  assert.deepEqual(Object.entries(atlasManifest.frames), EXPECTED_FRAMES, "the manifest must retain all sixteen ordered 4×4 frame descriptors");

  assert.ok(record, `${ATLAS_PATH} must have a media manifest record`);
  assert.ok(sourceRecord, `${SOURCE_PORTRAIT} must remain a manifest-proven source portrait`);
  assert.equal(record.media_type, "image/png");
  assert.equal(record.bytes, atlasBytes.byteLength, "media manifest byte count must match the atlas artifact");
  assert.equal(record.sha256, createHash("sha256").update(atlasBytes).digest("hex"), "media manifest hash must match the atlas artifact");
  assert.match(record.generated_by, /scripts\/build_concept_assets\.py/i);
  assert.deepEqual(record.source_key_art, [SOURCE_PORTRAIT]);
  assert.deepEqual(record.source_assets, [SOURCE_PORTRAIT]);
  assert.match(`${record.generated_by}\n${record.derivation}`, /no new GTI invocation/i, "provenance must state that the derivative required no new GTI invocation");
  assert.match(sourceRecord.generated_by, /\bgti\b/i, "the source portrait must remain an established GTI record");
});

test("Canvas battle renderer preloads and draws the conceptual atlas without per-frame filters", async () => {
  const renderer = (await projectFile("battle-visualizer.js")).toString("utf8");

  assert.match(
    renderer,
    /const UNIT_ATLAS = Object\.freeze\(\{\s*src: "assets\/images\/characters\/dusk-legion-atlas\.png",\s*framePx: 256,\s*padding: 2,\s*stride: 260,\s*fps: 16\s*\}\);/,
    "the renderer must use the manifest-proven PNG as its unit atlas",
  );
  assert.match(renderer, /loadUnitAtlas\(\)\s*\{[\s\S]*?img\.src = UNIT_ATLAS\.src;/, "the renderer must preload the atlas PNG");
  assert.match(
    renderer,
    /const atlas = this\.unitAtlases\.get\(kind\);[\s\S]*?const frame = this\.atlasFacing\(unit\.facing\) \* 2 \+ phase;[\s\S]*?ctx\.drawImage\(atlas, sourceX, sourceY, UNIT_ATLAS\.framePx, UNIT_ATLAS\.framePx,/,
    "unit drawing must select and draw a manifest-aligned atlas frame",
  );
  assert.doesNotMatch(renderer, /\b(?:UNIT_ATLASES|loadUnitStrips|ATLAS_FRAME_PX)\b/, "legacy Blender strip loading and priority identifiers must not remain in the conceptual atlas renderer");
  assert.doesNotMatch(renderer, /(?:this\.)?ctx\.filter\s*=/, "unit frames must not rely on a live canvas filter");
});
