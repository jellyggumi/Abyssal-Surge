import { depthKey, LAYER } from "./iso-math.js";

export const TILEMAP_RENDER_MODE = Object.freeze({
  CHUNK: "chunk",
  INDIVIDUAL: "individual",
});

export const TILE_CHUNK_SIZE = 16;
export const INDIVIDUAL_TILE_LIMIT = 256;
export const STATIC_BACKING_PIXEL_LIMIT = 2_097_152;

function isFiniteNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

function assertBounds(bounds, name) {
  if (!bounds || typeof bounds !== "object") {
    throw new TypeError(`${name} must be a bounds object`);
  }
  for (const edge of ["left", "top", "right", "bottom"]) {
    if (!Number.isFinite(bounds[edge])) {
      throw new TypeError(`${name}.${edge} must be finite`);
    }
  }
  if (bounds.left > bounds.right || bounds.top > bounds.bottom) {
    throw new RangeError(`${name} must have ordered edges`);
  }
}

/**
 * Selects the terrain-base strategy only. Chunk Mode batches opaque,
 * non-occluding floor tiles; barriers and every other occluder still enter the
 * individual painter queue alongside actors. The mode therefore never makes a
 * character disappear behind a baked wall plane.
 */
export function selectTilemapRenderMode({
  width,
  height,
  backingPixels,
  forceChunk = false,
  forceIndividual = false,
  cameraPannable = false,
} = {}) {
  isFiniteNonNegativeInteger(width, "width");
  isFiniteNonNegativeInteger(height, "height");
  isFiniteNonNegativeInteger(backingPixels, "backingPixels");

  if (forceIndividual) return TILEMAP_RENDER_MODE.INDIVIDUAL;
  // Floors never need actor/occluder interleaving. They stay chunked even
  // when the map fits on screen; only the explicit diagnostic/full-detail
  // override routes every tile through the shared painter queue.
  return TILEMAP_RENDER_MODE.CHUNK;
}

export function chunkForTile(x, y, chunkSize = TILE_CHUNK_SIZE) {
  isFiniteNonNegativeInteger(x, "x");
  isFiniteNonNegativeInteger(y, "y");
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError("chunkSize must be a positive integer");
  }
  const chunkX = Math.floor(x / chunkSize);
  const chunkY = Math.floor(y / chunkSize);
  return { x: chunkX, y: chunkY, id: `${chunkX},${chunkY}` };
}

/**
 * Returns tile-space chunks intersecting an inclusive tile-space rectangle.
 * This is deliberately independent of draw code so the camera culling policy
 * can be tested without a DOM canvas.
 */
export function visibleChunkIds(bounds, chunkSize = TILE_CHUNK_SIZE) {
  assertBounds(bounds, "bounds");
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError("chunkSize must be a positive integer");
  }

  const left = Math.floor(bounds.left / chunkSize);
  const top = Math.floor(bounds.top / chunkSize);
  const right = Math.floor(bounds.right / chunkSize);
  const bottom = Math.floor(bounds.bottom / chunkSize);
  const ids = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) ids.push(`${x},${y}`);
  }
  return ids;
}

function resolveTileLayer(tile) {
  if (tile.layer === "ground") return LAYER.ground;
  if (tile.layer === "fx") return LAYER.fx;
  return LAYER.prop;
}

function resolveDynamicLayer(dynamic) {
  if (dynamic.layer === "fx") return LAYER.fx;
  if (dynamic.layer === "prop") return LAYER.prop;
  return LAYER.unit;
}

function normalizeDrawRecord(record, source, layer) {
  if (!record || typeof record !== "object") {
    throw new TypeError(`${source} record must be an object`);
  }
  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new TypeError(`${source}.id must be a non-empty string`);
  }
  for (const coordinate of ["x", "y", "z"]) {
    if (!Number.isFinite(record[coordinate] ?? 0)) {
      throw new TypeError(`${source}.${coordinate} must be finite`);
    }
  }
  if (record.sortRoot !== undefined) {
    if (!record.sortRoot || typeof record.sortRoot !== "object") {
      throw new TypeError(`${source}.sortRoot must be a coordinate object`);
    }
    for (const coordinate of ["x", "y", "z"]) {
      if (!Number.isFinite(record.sortRoot[coordinate] ?? 0)) {
        throw new TypeError(`${source}.sortRoot.${coordinate} must be finite`);
      }
    }
  }
  if (!Number.isInteger(record.orderInLayer ?? 0)) {
    throw new TypeError(`${source}.orderInLayer must be an integer`);
  }
  if (record.blend !== undefined && record.blend !== "alpha" && record.blend !== "additive") {
    throw new TypeError(`${source}.blend must be "alpha" or "additive"`);
  }
  const sortOrigin = record.sortRoot ?? record;
  return {
    ...record,
    blend: record.blend ?? "alpha",
    orderInLayer: record.orderInLayer ?? 0,
    source,
    sortKey: depthKey(sortOrigin.x ?? 0, sortOrigin.y ?? 0, sortOrigin.z ?? 0, layer),
  };
}

/**
 * Builds the shared painter queue for per-tile occluders and dynamic objects.
 * Chunked floors are intentionally absent: they draw below this queue. A wall
 * tile is never flattened into a floor chunk, so actors can pass behind or in
 * front of it at their real world coordinates.
 */
export function buildIndividualDrawQueue(tiles = [], dynamics = []) {
  if (!Array.isArray(tiles) || !Array.isArray(dynamics)) {
    throw new TypeError("tiles and dynamics must be arrays");
  }
  const queue = [
    ...tiles.map((tile) => normalizeDrawRecord(tile, "tile", resolveTileLayer(tile))),
    ...dynamics.map((dynamic) => normalizeDrawRecord(dynamic, "dynamic", resolveDynamicLayer(dynamic))),
  ];
  queue.sort(
    (a, b) =>
      (a.blend === "additive") - (b.blend === "additive") ||
      a.sortKey - b.sortKey ||
      a.orderInLayer - b.orderInLayer ||
      a.id.localeCompare(b.id),
  );
  return queue;
}

/**
 * Performs per-item screen-bounds culling for Individual Mode. It intentionally
 * does not reuse chunk bounds: sprite, barrier, and particle bleed is preserved
 * before any draw record reaches the painter queue.
 */
export function visibleIndividualItems(items, viewBounds, artBleed = 0) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  assertBounds(viewBounds, "viewBounds");
  if (!Number.isFinite(artBleed) || artBleed < 0) {
    throw new RangeError("artBleed must be a non-negative finite number");
  }
  return items.filter((item) => {
    assertBounds(item?.bounds, "item.bounds");
    const bounds = item.bounds;
    return !(
      bounds.right - artBleed < viewBounds.left ||
      bounds.left - artBleed > viewBounds.right ||
      bounds.bottom - artBleed < viewBounds.top ||
      bounds.top - artBleed > viewBounds.bottom
    );
  });
}

function assertAtlasNumber(value, name, { allowZero = true } = {}) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError(`${name} must be an integer ${allowZero ? "at least 0" : "above 0"}`);
  }
}

const ATLAS_GUTTER_PX = 1;

function atlasRectsConflict(a, b) {
  return (
    a.x - ATLAS_GUTTER_PX < b.x + b.width &&
    a.x + a.width + ATLAS_GUTTER_PX > b.x &&
    a.y - ATLAS_GUTTER_PX < b.y + b.height &&
    a.y + a.height + ATLAS_GUTTER_PX > b.y
  );
}

/**
 * Validates a single-page atlas package. Frames require a one-pixel isolation
 * gutter so scaled Canvas sampling cannot bleed a neighbour's texels.
 */
export function validateSpriteAtlasManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new TypeError("atlas manifest must be an object");
  }
  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    throw new TypeError("atlas manifest version must be a positive integer");
  }
  const page = manifest.page;
  if (!page || typeof page !== "object" || typeof page.url !== "string" || page.url.length === 0) {
    throw new TypeError("atlas page must define a url");
  }
  assertAtlasNumber(page.width, "atlas page width", { allowZero: false });
  assertAtlasNumber(page.height, "atlas page height", { allowZero: false });
  if (!manifest.frames || typeof manifest.frames !== "object" || Array.isArray(manifest.frames)) {
    throw new TypeError("atlas frames must be an object keyed by frame id");
  }

  const usedRectKeys = new Set();
  const usedRects = [];
  for (const [id, frame] of Object.entries(manifest.frames)) {
    if (!id) throw new TypeError("atlas frame id must be non-empty");
    if (!frame || typeof frame !== "object") throw new TypeError(`atlas frame ${id} must be an object`);
    assertAtlasNumber(frame.x, `atlas frame ${id}.x`);
    assertAtlasNumber(frame.y, `atlas frame ${id}.y`);
    assertAtlasNumber(frame.width, `atlas frame ${id}.width`, { allowZero: false });
    assertAtlasNumber(frame.height, `atlas frame ${id}.height`, { allowZero: false });
    assertAtlasNumber(frame.pivotX, `atlas frame ${id}.pivotX`);
    assertAtlasNumber(frame.pivotY, `atlas frame ${id}.pivotY`);
    if (frame.x + frame.width > page.width || frame.y + frame.height > page.height) {
      throw new RangeError(`atlas frame ${id} must remain within page bounds`);
    }
    if (frame.pivotX > frame.width || frame.pivotY > frame.height) {
      throw new RangeError(`atlas frame ${id} pivot must remain within frame bounds`);
    }
    const rectKey = `${frame.x},${frame.y},${frame.width},${frame.height}`;
    if (usedRectKeys.has(rectKey)) throw new RangeError(`duplicate atlas rectangle claimed by ${id}`);
    for (const used of usedRects) {
      if (atlasRectsConflict(frame, used.frame)) {
        throw new RangeError(`atlas frame ${id} lacks a ${ATLAS_GUTTER_PX}px isolation gutter from ${used.id}`);
      }
    }
    usedRects.push({ id, frame });
    usedRectKeys.add(rectKey);
  }
  return true;
}
