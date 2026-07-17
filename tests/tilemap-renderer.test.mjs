import assert from "node:assert/strict";
import test from "node:test";

import {
  TILEMAP_RENDER_MODE,
  selectTilemapRenderMode,
  chunkForTile,
  visibleChunkIds,
  buildIndividualDrawQueue,
  visibleIndividualItems,
  validateSpriteAtlasManifest,
} from "../tilemap-renderer.js";

const SMALL_STATIC_MAP = Object.freeze({
  width: 16,
  height: 16,
  backingPixels: 256 * 256,
  cameraPannable: false,
  forceChunk: false,
  forceIndividual: false,
});

function frame(x, y, width = 32, height = 32, pivotX = 16, pivotY = 24) {
  return { x, y, width, height, pivotX, pivotY };
}

function validManifest() {
  return {
    version: 1,
    page: { width: 64, height: 64, url: "/assets/terrain-atlas.png" },
    frames: { floor: frame(0, 0) },
  };
}

test("selectTilemapRenderMode chunks static non-occluding floor by default and for explicit or panning/large maps", () => {
  assert.equal(
    selectTilemapRenderMode(SMALL_STATIC_MAP),
    TILEMAP_RENDER_MODE.CHUNK,
    "a small fixed-camera map must batch static non-occluding floor into chunks",
  );
  assert.equal(
    selectTilemapRenderMode({ ...SMALL_STATIC_MAP, forceChunk: true }),
    TILEMAP_RENDER_MODE.CHUNK,
    "forceChunk must enable static-floor chunk rendering",
  );
  assert.equal(
    selectTilemapRenderMode({ ...SMALL_STATIC_MAP, cameraPannable: true }),
    TILEMAP_RENDER_MODE.CHUNK,
    "a pannable camera must select chunked static-floor rendering",
  );
  assert.equal(
    selectTilemapRenderMode({
      ...SMALL_STATIC_MAP,
      width: 512,
      height: 512,
      backingPixels: 16_777_216,
    }),
    TILEMAP_RENDER_MODE.CHUNK,
    "a large map must select chunked static-floor rendering even with a fixed camera",
  );
});

test("selectTilemapRenderMode gives forceIndividual precedence over every chunk trigger", () => {
  assert.equal(
    selectTilemapRenderMode({
      ...SMALL_STATIC_MAP,
      forceChunk: true,
      forceIndividual: true,
      cameraPannable: true,
      width: 512,
      height: 512,
      backingPixels: 16_777_216,
    }),
    TILEMAP_RENDER_MODE.INDIVIDUAL,
    "forceIndividual must preserve precise shared sorting regardless of other chunk triggers",
  );
});

test("chunkForTile maps every 16×16 boundary and map edge to the expected stable chunk identity", () => {
  assert.deepEqual(chunkForTile(0, 0), { x: 0, y: 0, id: "0,0" });
  assert.deepEqual(chunkForTile(15, 15), { x: 0, y: 0, id: "0,0" });
  assert.deepEqual(chunkForTile(16, 0), { x: 1, y: 0, id: "1,0" });
  assert.deepEqual(chunkForTile(31, 31), { x: 1, y: 1, id: "1,1" });
  assert.deepEqual(chunkForTile(32, 32), { x: 2, y: 2, id: "2,2" });
});

test("visibleChunkIds returns each 16×16 chunk crossed by a tile-space view exactly once", () => {
  const visible = visibleChunkIds(
    { left: 31, top: 31, right: 40, bottom: 40 },
    16,
  );

  assert.deepEqual(
    new Set(visible),
    new Set(["1,1", "2,1", "1,2", "2,2"]),
    "a view crossing a chunk corner must retain all four intersecting chunks",
  );
  assert.equal(visible.length, 4, "visible chunk ids must not contain duplicates");
});

test("buildIndividualDrawQueue interleaves occluder tiles with actors instead of grouping tiles and dynamics", () => {
  const queue = buildIndividualDrawQueue(
    [
      { id: "barrier-north", x: 1, y: 1, z: 0, kind: "occluder" },
      { id: "barrier-south", x: 2, y: 2, z: 1, kind: "occluder" },
    ],
    [
      { id: "scout", x: 2, y: 1, z: 0, layer: "actor" },
      { id: "captain", x: 3, y: 2, z: 0, layer: "actor" },
    ],
  );

  assert.deepEqual(
    queue.map(({ source, id }) => `${source}:${id}`),
    ["tile:barrier-north", "dynamic:scout", "tile:barrier-south", "dynamic:captain"],
    "barrier tiles must share the painter order with actors so a chunked floor cannot defeat actor/barrier occlusion",
  );
});

test("buildIndividualDrawQueue sorts a wall from its center sortRoot between northwest and southeast units", () => {
  const queue = buildIndividualDrawQueue(
    [{
      id: "wall",
      x: 5,
      y: 5,
      z: 1,
      kind: "occluder",
      sortRoot: { x: 5.5, y: 5.5, z: 1 },
    }],
    [
      { id: "northwest-unit", x: 5.5, y: 4.5, z: 1, layer: "actor" },
      { id: "southeast-unit", x: 5.5, y: 6.5, z: 1, layer: "actor" },
    ],
  );

  assert.deepEqual(
    queue.map(({ id }) => id),
    ["northwest-unit", "wall", "southeast-unit"],
    "a wall's center sortRoot must let it occlude the northwest unit but remain behind the southeast unit",
  );
});

test("buildIndividualDrawQueue keeps a unit above a walkable raised tile at the same center and elevation", () => {
  const queue = buildIndividualDrawQueue(
    [{
      id: "raised-tile",
      x: 5,
      y: 5,
      z: 1,
      layer: "prop",
      sortRoot: { x: 5.5, y: 5.5, z: 1 },
    }],
    [{
      id: "unit-on-top",
      x: 5.5,
      y: 5.5,
      z: 1,
      layer: "actor",
      sortRoot: { x: 5.5, y: 5.5, z: 1 },
    }],
  );

  assert.deepEqual(
    queue.map(({ id }) => id),
    ["raised-tile", "unit-on-top"],
    "layer bias must keep a unit in front of walkable raised geometry at the same depth root",
  );
});

test("buildIndividualDrawQueue uses orderInLayer only after geometric depth and makes higher ties frontmost", () => {
  const queue = buildIndividualDrawQueue([], [
    { id: "far-order-but-behind", x: 1, y: 0, z: 0, layer: "actor", orderInLayer: 99 },
    { id: "same-depth-back", x: 1, y: 1, z: 0, layer: "actor", orderInLayer: 1 },
    { id: "same-depth-front", x: 1, y: 1, z: 0, layer: "actor", orderInLayer: 2 },
    { id: "near-order-but-front", x: 2, y: 1, z: 0, layer: "actor", orderInLayer: -99 },
  ]);

  assert.deepEqual(
    queue.map(({ id }) => id),
    ["far-order-but-behind", "same-depth-back", "same-depth-front", "near-order-but-front"],
    "geometric depth must remain primary, with orderInLayer breaking only equal geometric keys",
  );
});

test("buildIndividualDrawQueue uses a particle sortRoot instead of its local simulation coordinates", () => {
  const queue = buildIndividualDrawQueue([], [
    {
      id: "north-root",
      x: 100,
      y: 100,
      z: 0,
      layer: "fx",
      sortRoot: { x: 1, y: 1, z: 0 },
    },
    {
      id: "south-root",
      x: -100,
      y: -100,
      z: 0,
      layer: "fx",
      sortRoot: { x: 3, y: 1, z: 0 },
    },
  ]);

  assert.deepEqual(
    queue.map(({ id }) => id),
    ["north-root", "south-root"],
    "particle order must follow each root's world depth even when local particle coordinates imply the reverse",
  );
});

test("buildIndividualDrawQueue draws additive particles after ordinary world records while preserving root-depth order among them", () => {
  const queue = buildIndividualDrawQueue([], [
    { id: "world-alpha", x: 9, y: 9, z: 0, layer: "actor", blend: "alpha" },
    {
      id: "additive-north-back",
      x: 100,
      y: 100,
      z: 0,
      layer: "fx",
      blend: "additive",
      orderInLayer: 1,
      sortRoot: { x: 1, y: 1, z: 0 },
    },
    {
      id: "additive-north-front",
      x: -100,
      y: -100,
      z: 0,
      layer: "fx",
      blend: "additive",
      orderInLayer: 2,
      sortRoot: { x: 1, y: 1, z: 0 },
    },
    {
      id: "additive-south",
      x: -100,
      y: -100,
      z: 0,
      layer: "fx",
      blend: "additive",
      sortRoot: { x: 3, y: 1, z: 0 },
    },
  ]);

  assert.deepEqual(
    queue.map(({ id }) => id),
    ["world-alpha", "additive-north-back", "additive-north-front", "additive-south"],
    "additive particles must render after alpha/world content, retain root-depth order, and use orderInLayer for equal-root ties",
  );
});

test("visibleIndividualItems culls by inclusive projected bounds and expands edge artwork by artBleed", () => {
  const items = [
    { id: "inside", bounds: { left: 20, top: 20, right: 40, bottom: 40 } },
    { id: "near-edge-art", bounds: { left: 101, top: 10, right: 105, bottom: 30 } },
    { id: "distant", bounds: { left: 180, top: 180, right: 200, bottom: 200 } },
  ];
  const viewBounds = { left: 0, top: 0, right: 100, bottom: 100 };

  assert.deepEqual(
    visibleIndividualItems(items, viewBounds).map(({ id }) => id),
    ["inside"],
    "an item outside an inclusive view must be culled without art bleed",
  );
  assert.deepEqual(
    visibleIndividualItems(items, viewBounds, 1).map(({ id }) => id),
    ["inside", "near-edge-art"],
    "art bleed must retain an item whose expanded projected bounds touch the view edge, while distant items stay culled",
  );
});

test("validateSpriteAtlasManifest accepts a single in-page frame and rejects duplicate, out-of-bounds, or invalid-pivot frames", () => {
  assert.equal(
    validateSpriteAtlasManifest(validManifest()),
    true,
    "a manifest with one page and one fully contained frame must validate",
  );

  const duplicateRectangles = validManifest();
  duplicateRectangles.frames.water = frame(0, 0);
  assert.throws(
    () => validateSpriteAtlasManifest(duplicateRectangles),
    /duplicate/i,
    "two frame identifiers must not claim the same atlas rectangle",
  );

  const outOfBounds = validManifest();
  outOfBounds.frames.floor = frame(48, 0);
  assert.throws(
    () => validateSpriteAtlasManifest(outOfBounds),
    /bounds|page|contain/i,
    "a frame extending outside its sole atlas page must be rejected",
  );

  const negativePivot = validManifest();
  negativePivot.frames.floor = frame(0, 0, 32, 32, -1, 24);
  assert.throws(
    () => validateSpriteAtlasManifest(negativePivot),
    /pivot/i,
    "a negative pivot coordinate must be rejected",
  );

  const oversizedPivot = validManifest();
  oversizedPivot.frames.floor = frame(0, 0, 32, 32, 16, 33);
  assert.throws(
    () => validateSpriteAtlasManifest(oversizedPivot),
    /pivot/i,
    "a pivot coordinate beyond its frame bounds must be rejected",
  );
});

test("validateSpriteAtlasManifest rejects partially overlapping atlas frame rectangles", () => {
  const overlappingFrames = validManifest();
  overlappingFrames.frames.water = frame(16, 0);

  assert.throws(
    () => validateSpriteAtlasManifest(overlappingFrames),
    "frames that overlap by any area must not share atlas texels",
  );
});

test("validateSpriteAtlasManifest requires a one-pixel gutter between atlas frame edges", () => {
  const edgeSharingFrames = validManifest();
  edgeSharingFrames.frames.water = frame(32, 0);

  assert.throws(
    () => validateSpriteAtlasManifest(edgeSharingFrames),
    "frames that share an edge must leave at least one pixel of gutter",
  );
});
