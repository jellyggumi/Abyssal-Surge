import assert from "node:assert/strict";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PACK_DIRECTORY = resolve(PROJECT_ROOT, "assets/models/abyssal-command");
const MANIFEST_PATH = resolve(PACK_DIRECTORY, "manifest.json");
const EXPECTED_CATEGORY_COUNTS = Object.freeze({ unit: 5, boss: 3, prop: 4, terrain: 3 });
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;

function packFilePath(relativePath, label) {
  assert.equal(typeof relativePath, "string", `${label} must be a string path`);
  assert.ok(relativePath.length > 0, `${label} must not be empty`);
  assert.ok(!isAbsolute(relativePath), `${label} must be pack-relative`);
  assert.ok(!relativePath.includes("\\"), `${label} must use pack-relative POSIX separators`);

  const segments = relativePath.split("/");
  assert.ok(
    segments.every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    `${label} must not contain empty, current-directory, or parent-directory segments`,
  );

  const filePath = resolve(PACK_DIRECTORY, relativePath);
  const relation = relative(PACK_DIRECTORY, filePath);
  assert.ok(
    relation !== "" && relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation),
    `${label} must resolve inside the pack`,
  );
  return filePath;
}

async function assertPresentPackFile(relativePath, label, canonicalPackDirectory) {
  const filePath = packFilePath(relativePath, label);
  const [file, canonicalFilePath] = await Promise.all([stat(filePath), realpath(filePath)]);
  assert.ok(file.isFile(), `${label} must resolve to a file`);
  assert.ok(file.size > 0, `${label} must not be empty`);

  const canonicalRelation = relative(canonicalPackDirectory, canonicalFilePath);
  assert.ok(
    canonicalRelation !== "" &&
      canonicalRelation !== ".." &&
      !canonicalRelation.startsWith(`..${sep}`) &&
      !isAbsolute(canonicalRelation),
    `${label} must not resolve through a symlink outside the pack`,
  );
  return filePath;
}

function parseGlb(bytes, label) {
  assert.ok(bytes.byteLength >= 20, `${label} must contain a GLB header and JSON chunk`);
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${label} must start with the GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label} must use the glTF 2.0 binary container`);
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength, `${label} header length must match the file length`);

  let offset = 12;
  let jsonChunk;
  let binaryChunk;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    assert.ok(offset + 8 <= bytes.byteLength, `${label} must not contain a truncated GLB chunk header`);
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    assert.equal(chunkLength % 4, 0, `${label} GLB chunks must be 4-byte aligned`);
    assert.ok(chunkEnd <= bytes.byteLength, `${label} must not contain a truncated GLB chunk`);

    if (chunkIndex === 0) {
      assert.equal(chunkType, JSON_CHUNK_TYPE, `${label} must place its JSON chunk first`);
      jsonChunk = bytes.subarray(chunkStart, chunkEnd);
    } else {
      assert.equal(chunkType, 0x004e4942, `${label} may contain only a BIN chunk after its JSON chunk`);
      assert.equal(binaryChunk, undefined, `${label} must contain at most one BIN chunk`);
      binaryChunk = bytes.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  assert.equal(offset, bytes.byteLength, `${label} must end at a GLB chunk boundary`);
  assert.ok(jsonChunk, `${label} must contain a JSON chunk`);
  assert.ok(binaryChunk, `${label} must contain a BIN chunk for embedded images`);
  return {
    binaryChunk,
    gltf: JSON.parse(jsonChunk.toString("utf8").replace(/\0+$/u, "").trimEnd()),
  };
}

function assertEmbeddedImages(gltf, binaryChunk, label) {
  assert.ok(Array.isArray(gltf.buffers) && gltf.buffers.length === 1, `${label} must declare one GLB buffer`);
  const [buffer] = gltf.buffers;
  assert.equal(typeof buffer, "object", `${label} buffer must be metadata`);
  assert.equal(Object.hasOwn(buffer, "uri"), false, `${label} buffer must be stored in the BIN chunk`);
  assert.ok(
    Number.isInteger(buffer.byteLength) && buffer.byteLength > 0 && buffer.byteLength <= binaryChunk.byteLength,
    `${label} buffer length must fit inside its BIN chunk`,
  );

  assert.ok(Array.isArray(gltf.bufferViews), `${label} must declare buffer views for embedded images`);
  for (const [index, bufferView] of gltf.bufferViews.entries()) {
    assert.equal(typeof bufferView, "object", `${label} buffer view ${index} must be metadata`);
    assert.equal(bufferView.buffer, 0, `${label} buffer view ${index} must use the GLB buffer`);
    const byteOffset = bufferView.byteOffset ?? 0;
    assert.ok(
      Number.isInteger(byteOffset) &&
        byteOffset >= 0 &&
        Number.isInteger(bufferView.byteLength) &&
        bufferView.byteLength > 0 &&
        byteOffset + bufferView.byteLength <= buffer.byteLength,
      `${label} buffer view ${index} must stay within the GLB buffer`,
    );
  }

  assert.ok(Array.isArray(gltf.images) && gltf.images.length > 0, `${label} must declare embedded images`);
  for (const [index, image] of gltf.images.entries()) {
    assert.equal(typeof image, "object", `${label} image ${index} must be metadata`);
    assert.equal(Object.hasOwn(image, "uri"), false, `${label} image ${index} must not use an external URI`);
    assert.ok(
      Number.isInteger(image.bufferView) && image.bufferView >= 0 && image.bufferView < gltf.bufferViews.length,
      `${label} image ${index} must reference an in-container buffer view`,
    );
    assert.equal(image.mimeType, "image/png", `${label} image ${index} must identify its embedded PNG payload`);
  }
}

function accessorValues(gltf, binaryChunk, accessorIndex, label) {
  assert.ok(Number.isInteger(accessorIndex), `${label} must reference an accessor`);
  const accessor = gltf.accessors?.[accessorIndex];
  assert.ok(accessor && typeof accessor === "object", `${label} must reference declared accessor ${accessorIndex}`);
  assert.equal(accessor.componentType, 5126, `${label} must use float components`);
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.ok(components, `${label} must use a supported accessor shape`);
  assert.ok(Number.isInteger(accessor.count) && accessor.count > 0, `${label} must have samples`);
  assert.ok(Number.isInteger(accessor.bufferView), `${label} must use an in-buffer view`);
  const bufferView = gltf.bufferViews?.[accessor.bufferView];
  assert.ok(bufferView && typeof bufferView === "object", `${label} must reference a declared buffer view`);
  const elementBytes = components * Float32Array.BYTES_PER_ELEMENT;
  const byteStride = bufferView.byteStride ?? elementBytes;
  assert.ok(
    Number.isInteger(byteStride) && byteStride >= elementBytes,
    `${label} must use a byte stride large enough for each ${accessor.type} sample`,
  );
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const lastSampleEnd = byteOffset + (accessor.count - 1) * byteStride + elementBytes;
  assert.ok(lastSampleEnd <= binaryChunk.byteLength, `${label} samples must remain inside the GLB BIN chunk`);

  return Array.from({ length: accessor.count }, (_, sample) =>
    Array.from(
      { length: components },
      (_, component) => binaryChunk.readFloatLE(byteOffset + sample * byteStride + component * Float32Array.BYTES_PER_ELEMENT),
    ),
  );
}

function assertNormalMappedPrimitivesHaveTangents(gltf, binaryChunk, label) {
  const normalMappedMaterials = new Set();
  for (const [index, material] of (gltf.materials ?? []).entries()) {
    if (!material?.normalTexture) continue;
    const textureIndex = material.normalTexture.index;
    assert.ok(
      Number.isInteger(textureIndex) && textureIndex >= 0 && textureIndex < gltf.textures.length,
      `${label} material ${index} normal texture must reference a declared texture`,
    );
    const texture = gltf.textures[textureIndex];
    assert.ok(
      Number.isInteger(texture.source) && texture.source >= 0 && texture.source < gltf.images.length,
      `${label} material ${index} normal texture must resolve to an embedded image`,
    );
    normalMappedMaterials.add(index);
  }
  assert.ok(normalMappedMaterials.size > 0, `${label} must use tangent-space normal mapped materials`);

  let normalMappedPrimitiveCount = 0;
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      if (!normalMappedMaterials.has(primitive.material)) continue;
      normalMappedPrimitiveCount += 1;
      const attributes = primitive.attributes;
      assert.ok(attributes && typeof attributes === "object", `${label} mesh ${meshIndex} primitive ${primitiveIndex} must have attributes`);
      const primitiveAccessors = {};
      for (const semantic of ["POSITION", "TEXCOORD_0", "TANGENT"]) {
        const accessorIndex = attributes[semantic];
        assert.ok(
          Number.isInteger(accessorIndex),
          `${label} mesh ${meshIndex} primitive ${primitiveIndex} using a normal map must export ${semantic}`,
        );
        const accessor = gltf.accessors?.[accessorIndex];
        assert.ok(
          accessor && typeof accessor === "object" && Number.isInteger(accessor.count) && accessor.count > 0,
          `${label} mesh ${meshIndex} primitive ${primitiveIndex} ${semantic} must reference readable accessor metadata`,
        );
        assert.ok(
          Number.isInteger(accessor.bufferView) &&
            accessor.bufferView >= 0 &&
            accessor.bufferView < gltf.bufferViews.length,
          `${label} mesh ${meshIndex} primitive ${primitiveIndex} ${semantic} must reference an in-BIN buffer view`,
        );
        primitiveAccessors[semantic] = accessor;
      }
      const position = primitiveAccessors.POSITION;
      const texcoord = primitiveAccessors.TEXCOORD_0;
      const tangent = primitiveAccessors.TANGENT;
      assert.equal(position.type, "VEC3", `${label} mesh ${meshIndex} primitive ${primitiveIndex} positions must be VEC3`);
      assert.equal(texcoord.type, "VEC2", `${label} mesh ${meshIndex} primitive ${primitiveIndex} UVs must be VEC2`);
      assert.equal(tangent.type, "VEC4", `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangents must be VEC4`);
      assert.equal(tangent.componentType, 5126, `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangents must be float vectors`);
      const tangentSamples = accessorValues(
        gltf,
        binaryChunk,
        attributes.TANGENT,
        `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangent payload`,
      );
      assert.equal(
        tangentSamples.length,
        tangent.count,
        `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangent payload must contain every declared vector`,
      );
      for (const [sampleIndex, vector] of tangentSamples.entries()) {
        assert.ok(
          vector.every(Number.isFinite),
          `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangent sample ${sampleIndex} must be finite`,
        );
      }
      assert.equal(
        tangent.count,
        position.count,
        `${label} mesh ${meshIndex} primitive ${primitiveIndex} tangent count must match position count`,
      );
    }
  }
  assert.ok(normalMappedPrimitiveCount > 0, `${label} must apply its normal mapped materials to geometry`);
}

test("Abyssal Command source model pack remains a complete embedded-texture artifact", async () => {
  const canonicalPackDirectory = await realpath(PACK_DIRECTORY);
  const manifest = JSON.parse((await readFile(MANIFEST_PATH, "utf8")));

  assert.equal(manifest.assets.length, 15, "the pack must declare exactly fifteen assets");
  const categoryCounts = Object.fromEntries(
    Object.keys(EXPECTED_CATEGORY_COUNTS).map((category) => [category, 0]),
  );
  for (const asset of manifest.assets) {
    assert.ok(Object.hasOwn(categoryCounts, asset.category), `${asset.id} must use a documented asset category`);
    categoryCounts[asset.category] += 1;
  }
  assert.deepEqual(categoryCounts, EXPECTED_CATEGORY_COUNTS, "asset categories must retain the documented shape");

  assert.ok(manifest.source.endsWith(".blend"), "the pack source must be a Blender file");
  await assertPresentPackFile(manifest.source, "manifest source", canonicalPackDirectory);

  assert.equal(manifest.textures.embeddedInGlb, true, "the pack must declare embedded GLB textures");
  assert.ok(Array.isArray(manifest.textures.resources), "the pack must declare texture resources");
  assert.equal(manifest.textures.resources.length, 7, "the pack must declare seven texture families");
  const textureFamilies = new Set();
  for (const texture of manifest.textures.resources) {
    assert.equal(typeof texture.family, "string", "each texture resource must name its family");
    assert.ok(!textureFamilies.has(texture.family), `texture family ${texture.family} must be unique`);
    textureFamilies.add(texture.family);
    await Promise.all([
      assertPresentPackFile(texture.albedo, `${texture.family} albedo`, canonicalPackDirectory),
      assertPresentPackFile(texture.normal, `${texture.family} normal`, canonicalPackDirectory),
    ]);
  }

  const assetIds = new Set();
  const assetPaths = new Set();
  for (const asset of manifest.assets) {
    assert.equal(typeof asset.id, "string", "each asset must have an identifier");
    assert.ok(!assetIds.has(asset.id), `asset identifier ${asset.id} must be unique`);
    assetIds.add(asset.id);

    assert.ok(asset.path.endsWith(".glb"), `${asset.id} must declare a GLB resource`);
    assert.ok(!assetPaths.has(asset.path), `GLB path ${asset.path} must be unique`);
    assetPaths.add(asset.path);
    const glbPath = await assertPresentPackFile(asset.path, `${asset.id} GLB`, canonicalPackDirectory);
    const { binaryChunk, gltf } = parseGlb(await readFile(glbPath), `${asset.id} GLB`);
    assertEmbeddedImages(gltf, binaryChunk, `${asset.id} GLB`);
    const animations = Object.hasOwn(gltf, "animations") ? gltf.animations : [];
    if (Object.hasOwn(gltf, "animations")) {
      assert.ok(Array.isArray(animations), `${asset.id} GLB animations must be an array when declared`);
    }
    assert.deepEqual(
      animations.map((animation, index) => {
        assert.equal(typeof animation, "object", `${asset.id} animation ${index} must be metadata`);
        assert.equal(typeof animation.name, "string", `${asset.id} animation ${index} must have a name`);
        return animation.name;
      }),
      asset.actions,
      `${asset.id} exported animation names must match its declared actions in order`,
    );

    assert.ok(Array.isArray(asset.textureFamilies), `${asset.id} must declare texture families`);
    for (const family of asset.textureFamilies) {
      assert.ok(textureFamilies.has(family), `${asset.id} must use a declared texture family`);
    }

    assert.ok(Array.isArray(asset.actions), `${asset.id} actions must be an array`);
    assert.ok(Array.isArray(asset.actionClips), `${asset.id} action clips must be an array`);
    assert.equal(asset.actions.length, asset.actionClips.length, `${asset.id} actions and clips must align`);
    assert.equal(new Set(asset.actions).size, asset.actions.length, `${asset.id} actions must be unique`);
    assert.equal(new Set(asset.actionClips).size, asset.actionClips.length, `${asset.id} action clips must be unique`);

    for (const [index, action] of asset.actions.entries()) {
      const clip = asset.actionClips[index];
      assert.equal(typeof action, "string", `${asset.id} action ${index} must be a string`);
      assert.equal(typeof clip, "string", `${asset.id} action clip ${index} must be a string`);
      const separator = action.lastIndexOf("__");
      assert.ok(separator > 0, `${asset.id} action ${action} must identify its clip`);
      assert.equal(action.slice(separator + 2), clip, `${asset.id} action ${action} must align with clip ${clip}`);
    }
  }
});

test("Abyssal Command units use the runtime clip vocabulary and keep Move at the scene origin", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const expectedUnitClips = ["Idle", "Move", "Strike", "Special", "Defeat"];

  for (const asset of manifest.assets.filter(({ category }) => category === "unit")) {
    assert.deepEqual(
      asset.actionClips,
      expectedUnitClips,
      `${asset.id} must export the shared unit vocabulary; Attack is reserved for bosses`,
    );

    const { binaryChunk, gltf } = parseGlb(await readFile(packFilePath(asset.path, `${asset.id} GLB`)), `${asset.id} GLB`);
    const move = gltf.animations?.find(({ name }) => name === `${asset.id}__Move`);
    assert.ok(move, `${asset.id} must export its declared Move clip`);
    const sceneRoots = new Set((gltf.scenes ?? []).flatMap((scene) => scene.nodes ?? []));
    const rootTranslationChannels = move.channels.filter(
      ({ target }) => target?.path === "translation" && sceneRoots.has(target.node),
    );

    for (const { sampler, target } of rootTranslationChannels) {
      const samples = accessorValues(
        gltf,
        binaryChunk,
        move.samplers[sampler].output,
        `${asset.id} Move root node ${target.node} translation`,
      );
      for (const [sampleIndex, [x, , z]] of samples.entries()) {
        assert.ok(
          Math.abs(x) <= 1e-5 && Math.abs(z) <= 1e-5,
          `${asset.id} Move sample ${sampleIndex} must not displace its scene root (got x=${x}, z=${z})`,
        );
      }
    }
  }
});

test("Abyssal Command GLBs preserve normal-map texture bindings and tangent attributes", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));

  for (const asset of manifest.assets) {
    const { binaryChunk, gltf } = parseGlb(await readFile(packFilePath(asset.path, `${asset.id} GLB`)), `${asset.id} GLB`);
    assertEmbeddedImages(gltf, binaryChunk, `${asset.id} GLB`);
    assertNormalMappedPrimitivesHaveTangents(gltf, binaryChunk, `${asset.id} GLB`);
  }
});

test("Echo Throne terrain GLB keeps its navigation tiers thin and aligned along runtime X", async () => {
  const label = "Echo Throne terrain GLB";
  const { binaryChunk, gltf } = parseGlb(
    await readFile(packFilePath("terrain/echo-throne-steps.glb", label)),
    label,
  );
  const terrainNodes = (gltf.nodes ?? []).filter(({ mesh }) => Number.isInteger(mesh));
  assert.equal(terrainNodes.length, 3, `${label} must expose exactly three terrain mesh surfaces`);
  assert.equal(
    new Set(terrainNodes.map(({ mesh }) => mesh)).size,
    3,
    `${label} terrain surfaces must use distinct meshes`,
  );

  const surfaces = terrainNodes.map(({ mesh, translation = [0, 0, 0] }, nodeIndex) => {
    assert.ok(Array.isArray(translation) && translation.length === 3, `${label} terrain node ${nodeIndex} must translate in 3D`);
    assert.ok(translation.every(Number.isFinite), `${label} terrain node ${nodeIndex} translation must be finite`);
    const primitives = gltf.meshes?.[mesh]?.primitives;
    assert.ok(Array.isArray(primitives) && primitives.length > 0, `${label} terrain mesh ${mesh} must contain geometry`);
    const positions = primitives.flatMap(({ attributes }, primitiveIndex) =>
      accessorValues(gltf, binaryChunk, attributes?.POSITION, `${label} terrain mesh ${mesh} primitive ${primitiveIndex} positions`),
    );
    assert.ok(positions.length > 0, `${label} terrain mesh ${mesh} must contain position samples`);
    const worldPositions = positions.map(([x, y, z]) => [x + translation[0], y + translation[1], z + translation[2]]);
    return {
      minX: Math.min(...worldPositions.map(([x]) => x)),
      maxX: Math.max(...worldPositions.map(([x]) => x)),
      minY: Math.min(...worldPositions.map(([, y]) => y)),
      maxY: Math.max(...worldPositions.map(([, y]) => y)),
    };
  }).sort((left, right) => left.minX - right.minX);

  const [lowFloor, firstPlatform, dais] = surfaces;
  const approximately = (actual, expected, description) =>
    assert.ok(Math.abs(actual - expected) <= 0.01, `${description} must be approximately ${expected} (got ${actual})`);

  approximately(lowFloor.minX, -11, "Echo Throne low floor minimum runtime X");
  approximately(lowFloor.maxX, 11, "Echo Throne low floor maximum runtime X");
  approximately(firstPlatform.minX, 3, "Echo Throne first platform minimum runtime X");
  approximately(firstPlatform.maxX, 5, "Echo Throne first platform maximum runtime X");
  approximately(dais.minX, 5, "Echo Throne dais minimum runtime X");
  approximately(dais.maxX, 8, "Echo Throne dais maximum runtime X");
  assert.ok(
    lowFloor.minX < firstPlatform.minX && firstPlatform.minX < dais.minX,
    `${label} terrain surfaces must progress low floor -> first platform -> dais along runtime X`,
  );

  approximately(lowFloor.maxY, 0, "Echo Throne low floor top");
  approximately(firstPlatform.maxY, 0.42, "Echo Throne first platform top");
  approximately(dais.maxY, 0.84, "Echo Throne dais top");
  assert.ok(
    lowFloor.maxY - lowFloor.minY <= 0.01,
    `${label} low floor must remain thin rather than becoming a vertical slab`,
  );
});
