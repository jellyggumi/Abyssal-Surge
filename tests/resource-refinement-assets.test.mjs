import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MEDIA_MANIFEST_PATH = "assets/media-manifest.json";
const MODEL_PACK_ROOT = "assets/models/abyssal-command";
const BRIDGE_MANIFEST_PATH = "assets/images/battle/glb/manifest.json";
const PREVIS_ROOT = "_workspace/20260718-resource-refinement/engineering/previs-bundle";
const PERFECT_PIXEL_ROOT = "assets/images/resource-refinement/perfectpixel";
const GTI_ROOT = "assets/images/resource-refinement/gti";
const VOX_ROOT = "_workspace/20260718-resource-refinement/design/vox-resource-film";
const CANONICAL_VIDEO = "assets/video/abyssal-surge-cinematic.mp4";
const CANONICAL_VIDEO_SHA256 = "b84ccfa905e2be365f6def1df3a5f4553e6d74468c413c1a7c8edbab9ed8b95a";

function projectPath(relativePath, label = relativePath) {
  assert.equal(typeof relativePath, "string", `${label} must be a string path`);
  assert.ok(relativePath.length > 0, `${label} must not be empty`);
  assert.ok(!relativePath.includes("\\"), `${label} must use POSIX separators`);
  const fullPath = resolve(PROJECT_ROOT, relativePath);
  const relation = relative(PROJECT_ROOT, fullPath);
  assert.ok(
    relation !== "" && relation !== ".." && !relation.startsWith(`..${sep}`),
    `${label} must resolve inside the project`,
  );
  return fullPath;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(projectPath(relativePath), "utf8"));
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function assertFileIdentity(relativePath, expected, label = relativePath) {
  const filePath = projectPath(relativePath, label);
  const file = await stat(filePath);
  assert.ok(file.isFile(), `${label} must resolve to a regular file`);
  assert.equal(file.size, expected.bytes, `${label} byte count must match its manifest record`);
  assert.equal(await sha256File(filePath), expected.sha256, `${label} SHA-256 must match its manifest record`);
}

async function assertFileSha256(relativePath, expectedSha256, label = relativePath) {
  const filePath = projectPath(relativePath, label);
  assert.ok((await stat(filePath)).isFile(), `${label} must resolve to a regular file`);
  assert.equal(await sha256File(filePath), expectedSha256, `${label} SHA-256 must match its manifest record`);
}

async function ffprobe(relativePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_name,codec_type,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels,bit_rate",
    "-of", "json",
    projectPath(relativePath),
  ]);
  return JSON.parse(stdout);
}
async function assertAudibleMp3(relativePath, label = relativePath) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    projectPath(relativePath),
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  const meanVolume = /mean_volume:\s*(?<value>[-+0-9.]+|[-+]?(?:inf|infinity))\s+dB/iu.exec(stderr);
  assert.ok(meanVolume, `${label} must expose a decoded mean volume`);
  assert.ok(Number.isFinite(Number(meanVolume.groups.value)), `${label} must contain a non-silent decoded signal`);
}

function videoAndAudioStreams(probe, label) {
  const video = probe.streams.find(({ codec_type: type }) => type === "video");
  const audio = probe.streams.find(({ codec_type: type }) => type === "audio");
  assert.ok(video, `${label} must contain a video stream`);
  assert.ok(audio, `${label} must contain an audio stream`);
  return { audio, video };
}

function mp4AtomOffsets(bytes, label) {
  const atoms = new Map();
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      assert.ok(offset + 16 <= bytes.length, `${label} extended atom ${type} must have a complete header`);
      size = Number(bytes.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    assert.ok(Number.isSafeInteger(size) && size >= headerSize, `${label} atom ${type} must have a valid size`);
    assert.ok(offset + size <= bytes.length, `${label} atom ${type} must remain inside the file`);
    if (!atoms.has(type)) atoms.set(type, offset);
    offset += size;
  }
  assert.equal(offset, bytes.length, `${label} must end at an MP4 atom boundary`);
  return atoms;
}

function parseVttTimestamp(value) {
  const match = /^(?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2})\.(?<millis>\d{3})$/.exec(value);
  assert.ok(match, `invalid WebVTT timestamp ${value}`);
  return Number(match.groups.hours) * 3600 + Number(match.groups.minutes) * 60 + Number(match.groups.seconds) + Number(match.groups.millis) / 1000;
}

async function walkRelativeFiles(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else output.push(relative(root, path).split(sep).join("/"));
    }
  }
  await walk(root);
  return output.sort();
}

test("shared media inventory closes all 239 records against exact file bytes and SHA-256", async () => {
  const manifest = await readJson(MEDIA_MANIFEST_PATH);
  assert.equal(manifest.schema_version, 2, "the shared media inventory must use schema v2");
  assert.equal(manifest.assets.length, 239, "the release inventory must retain the 188 baseline records plus seven stage narrations, one authored boss-phase combat cue, three stage-band music records, and the 40 new IdleAlert/Dash/StrikeHeavy-or-AttackHeavy/Counter/Cast raster atlases");

  const filenames = manifest.assets.map(({ filename }) => filename);
  assert.equal(new Set(filenames).size, manifest.assets.length, "each supplied media file must have exactly one inventory record");

  for (const record of manifest.assets) {
    assert.match(record.sha256, /^[0-9a-f]{64}$/u, `${record.filename} must declare a SHA-256 digest`);
    assert.ok(Number.isInteger(record.bytes) && record.bytes > 0, `${record.filename} must declare a positive byte count`);
    await assertFileIdentity(record.filename, record);
  }
});

test("model v2 and the 45-record raster bridge form a hash-closed 15-asset runtime projection", async () => {
  const [modelManifest, bridgeManifest, mediaManifest] = await Promise.all([
    readJson(`${MODEL_PACK_ROOT}/manifest.json`),
    readJson(BRIDGE_MANIFEST_PATH),
    readJson(MEDIA_MANIFEST_PATH),
  ]);
  assert.equal(modelManifest.version, 2, "the source model pack must retain manifest v2");
  assert.equal(modelManifest.assets.length, 15, "the source model pack must retain fifteen assets");
  await assertFileSha256(
    `${MODEL_PACK_ROOT}/${modelManifest.source}`,
    modelManifest.sourceSha256,
    "model-pack Blender source",
  );

  const sourceByPath = new Map();
  const expectedBridgeKeys = [];
  for (const asset of modelManifest.assets) {
    const sourcePath = `${MODEL_PACK_ROOT}/${asset.path}`;
    assert.ok(!sourceByPath.has(sourcePath), `${sourcePath} must identify one source model`);
    sourceByPath.set(sourcePath, asset);
    await assertFileSha256(sourcePath, asset.sha256, `${asset.id} source GLB`);
    assert.equal(asset.pivot, "ground-center", `${asset.id} must retain its ground-center pivot contract`);
    assert.ok(Math.abs(asset.measurements.boundsMin[2]) <= 1e-6, `${asset.id} authored lower bound must remain on ground Z=0`);

    if (asset.category === "unit") {
      assert.deepEqual(
        asset.rig,
        {
          type: "rigid-control",
          controls: [`${asset.id}-body-control`, `${asset.id}-equipment-control`],
          animation: "root plus secondary body/equipment transforms",
        },
        `${asset.id} must retain independently animated body and equipment controls`,
      );
    } else {
      assert.deepEqual(
        asset.rig,
        { type: "root-transform", controls: [], animation: "root transform" },
        `${asset.id} must retain its authored root-animation contract`,
      );
    }
    if (asset.category === "terrain") {
      expectedBridgeKeys.push(`${sourcePath}|terrainPlate|`);
    } else {
      for (const action of asset.actions) expectedBridgeKeys.push(`${sourcePath}|actionAtlas|${action}`);
    }
  }

  assert.equal(bridgeManifest.generationVersion, "glb-raster-pack-v1");
  assert.equal(bridgeManifest.sourceManifest, `${MODEL_PACK_ROOT}/manifest.json`);
  assert.deepEqual(bridgeManifest.atlasLayout.yawColumnsDegrees, [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(bridgeManifest.atlasLayout.frameSamples, [1, 10, 20, 30]);
  assert.equal(bridgeManifest.records.length, 85, "the bridge must retain 82 action atlases and three terrain plates");

  const mediaByFilename = new Map(mediaManifest.assets.map((record) => [record.filename, record]));
  const actualBridgeKeys = [];
  const outputPaths = new Set();
  let actionAtlases = 0;
  let terrainPlates = 0;

  for (const record of bridgeManifest.records) {
    const sourceAsset = sourceByPath.get(record.source.path);
    assert.ok(sourceAsset, `${record.source.path} must join to a model-manifest asset`);
    assert.equal(record.source.sha256, sourceAsset.sha256, `${record.source.path} bridge hash must match the source manifest`);
    assert.ok(!outputPaths.has(record.output.path), `${record.output.path} must be emitted once`);
    outputPaths.add(record.output.path);
    actualBridgeKeys.push(`${record.source.path}|${record.kind}|${record.action ?? ""}`);

    const mediaRecord = mediaByFilename.get(record.output.path);
    assert.ok(mediaRecord, `${record.output.path} must join to the shared media inventory`);
    assert.equal(mediaRecord.bytes, record.output.bytes, `${record.output.path} byte count must agree across manifests`);
    assert.equal(mediaRecord.sha256, record.output.sha256, `${record.output.path} hash must agree across manifests`);
    assert.deepEqual(mediaRecord.source_assets, [record.source.path], `${record.output.path} must retain its exact source GLB`);

    assert.ok(record.visualValidation.minimumEdgePaddingPx >= 12, `${record.output.path} must retain at least 12px transparent padding`);
    if (record.kind === "actionAtlas") {
      actionAtlases += 1;
      assert.deepEqual(
        [record.output.width, record.output.height, record.layout.columns, record.layout.rows, record.layout.cellWidth, record.layout.cellHeight],
        [2048, 1024, 8, 4, 256, 256],
        `${record.output.path} must retain its 8-direction 4-frame atlas geometry`,
      );
      assert.deepEqual(record.frameSamples, [1, 10, 20, 30], `${record.output.path} must retain its source frame samples`);
      assert.deepEqual(record.camera.yawColumnsDegrees, [0, 45, 90, 135, 180, 225, 270, 315]);
      assert.equal(record.visualValidation.nonEmptyCells, 32, `${record.output.path} must contain every direction/frame cell`);
      assert.equal(record.visualValidation.distinctDirectionColumns, 8, `${record.output.path} must retain eight distinct directions`);
      assert.equal(record.visualValidation.animatedDirectionColumns, 8, `${record.output.path} must animate every direction`);
    } else {
      terrainPlates += 1;
      assert.equal(record.kind, "terrainPlate");
      assert.deepEqual(
        [record.output.width, record.output.height, record.layout.columns, record.layout.rows],
        [256, 256, 1, 1],
        `${record.output.path} must retain its single terrain plate`,
      );
    }
  }

  assert.deepEqual(actualBridgeKeys.sort(), expectedBridgeKeys.sort(), "every declared model action and terrain asset must join to exactly one bridge output");
  assert.equal(actionAtlases, 82);
  assert.equal(terrainPlates, 3);
});

test("procedural encounter cues, canonical combat cues, and battle music retain valid MP3 delivery and provenance", async () => {
  const manifest = await readJson(MEDIA_MANIFEST_PATH);
  const records = new Map(manifest.assets.map((record) => [record.filename, record]));
  const contracts = [
    { filename: "assets/audio/breach-alert.mp3", cueId: "breach-alert", role: "sfx", channels: 1, durationMs: 2429 },
    { filename: "assets/audio/wave-spawn.mp3", cueId: "wave-spawn", role: "sfx", channels: 1, durationMs: 1541 },
    { filename: "assets/audio/battle-bgm.mp3", cueId: "battle-bgm", role: "music", channels: 2, durationMs: 24033 },
    { filename: "assets/audio/boss-phase-change.mp3", cueId: "boss-phase-change", role: "sfx", channels: 1 },
    { filename: "assets/audio/battle-bgm-band-ii.mp3", cueId: "battle-bgm-band-ii", role: "music", channels: 2 },
    { filename: "assets/audio/battle-bgm-band-iii.mp3", cueId: "battle-bgm-band-iii", role: "music", channels: 2 },
    { filename: "assets/audio/battle-bgm-band-iv.mp3", cueId: "battle-bgm-band-iv", role: "music", channels: 2 },
  ];

  for (const expected of contracts) {
    const record = records.get(expected.filename);
    assert.ok(record, `${expected.filename} must remain in the shared inventory`);
    assert.equal(record.media_type, "audio/mpeg", `${expected.filename} must be declared as MPEG audio`);
    assert.equal(record.generated_by, `Local deterministic procedural synthesis via scripts/generate_game_audio.py (cue_id=${expected.cueId})`);
    assert.equal(record.role, expected.role);
    assert.equal(record.sample_rate_hz, 44100);
    assert.equal(record.bitrate_kbps, 128);
    assert.equal(record.channels, expected.channels);
    assert.ok(Number.isInteger(record.duration_ms) && record.duration_ms > 0, `${expected.filename} must declare a positive integer duration`);
    if (expected.durationMs !== undefined) {
      assert.equal(record.duration_ms, expected.durationMs);
    } else {
      const minimumDurationMs = expected.role === "music" ? 10_000 : 500;
      const maximumDurationMs = expected.role === "music" ? 60_000 : 3_000;
      assert.ok(
        record.duration_ms >= minimumDurationMs && record.duration_ms <= maximumDurationMs,
        `${expected.filename} must retain its ${expected.role} duration contract`,
      );
    }
    assert.match(record.derivation, /Procedure:/u, `${expected.filename} must retain its reproducible synthesis procedure`);
    await assertFileIdentity(expected.filename, record);

    const probe = await ffprobe(expected.filename);
    const stream = probe.streams.find(({ codec_type: type }) => type === "audio");
    assert.ok(stream, `${expected.filename} must contain an audio stream`);
    assert.equal(stream.codec_name, "mp3");
    assert.equal(Number(stream.sample_rate), 44100);
    assert.equal(stream.channels, expected.channels);
    assert.ok(Number(probe.format.duration) > 0, `${expected.filename} must retain a positive decoded duration`);
    assert.ok(
      Math.abs(Number(probe.format.duration) * 1000 - record.duration_ms) <= 2,
      `${expected.filename} duration must match its manifest record`,
    );
    assert.equal(Number(stream.bit_rate), 128000, `${expected.filename} must remain a 128 kbps encoded stream`);
    await assertAudibleMp3(expected.filename);
  }
});

test("canonical cinematic and captions retain the 960x540 24fps faststart fallback profile", async () => {
  const [probe, bytes, vtt, manifest] = await Promise.all([
    ffprobe(CANONICAL_VIDEO),
    readFile(projectPath(CANONICAL_VIDEO)),
    readFile(projectPath("assets/video/abyssal-surge-cinematic.ko.vtt"), "utf8"),
    readJson(MEDIA_MANIFEST_PATH),
  ]);
  const { audio, video } = videoAndAudioStreams(probe, CANONICAL_VIDEO);
  assert.deepEqual(
    { codec: video.codec_name, profile: video.profile, width: video.width, height: video.height, pixelFormat: video.pix_fmt, rate: video.r_frame_rate },
    { codec: "h264", profile: "High", width: 960, height: 540, pixelFormat: "yuv420p", rate: "24/1" },
    "the representative cinematic must remain broadly decodable at its canonical video profile",
  );
  assert.deepEqual(
    { codec: audio.codec_name, sampleRate: audio.sample_rate, channels: audio.channels },
    { codec: "aac", sampleRate: "22050", channels: 2 },
    "the representative cinematic must retain its stereo AAC soundtrack",
  );
  assert.ok(Math.abs(Number(probe.format.duration) - 19.02) <= 0.001, "the representative montage must retain its 19.02s timeline");
  const atoms = mp4AtomOffsets(bytes, CANONICAL_VIDEO);
  assert.ok(atoms.get("moov") < atoms.get("mdat"), "the representative MP4 must keep moov before mdat for faststart playback");

  const cues = [...vtt.matchAll(/(?<start>\d{2}:\d{2}:\d{2}\.\d{3}) --> (?<end>\d{2}:\d{2}:\d{2}\.\d{3})\n(?<text>[^\n]+)/gu)]
    .map(({ groups }) => ({ start: parseVttTimestamp(groups.start), end: parseVttTimestamp(groups.end), text: groups.text }));
  assert.deepEqual(cues.map(({ start, end }) => [start, end]), [[0, 6.5], [6.5, 12.5], [12.5, 19.02]]);
  assert.ok(cues.every(({ text }) => text.trim().length > 0), "every canonical caption cue must carry spoken text");

  const records = new Map(manifest.assets.map((record) => [record.filename, record]));
  assert.equal(records.get(CANONICAL_VIDEO)?.sha256, CANONICAL_VIDEO_SHA256);
  assert.deepEqual(records.get("assets/video/abyssal-surge-cinematic.ko.vtt")?.source_assets, [CANONICAL_VIDEO]);
});

test("GTI delivery binds the decoded PNG to its sanitized completed request without overstating requested dimensions", async () => {
  const imagePath = `${GTI_ROOT}/abyssal-surge-resource-forging-hero-frame.png`;
  const promptPath = `${GTI_ROOT}/abyssal-surge-resource-forging-hero-frame.prompt.txt`;
  const [image, prompt, request, response] = await Promise.all([
    readFile(projectPath(imagePath)),
    readFile(projectPath(promptPath), "utf8"),
    readJson(`${GTI_ROOT}/debug/request.json`),
    readJson(`${GTI_ROOT}/debug/response.json`),
  ]);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "GTI output must retain a PNG signature");
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  assert.deepEqual([width, height], [1672, 941], "the contract must record the provider-delivered dimensions, not the requested dimensions");
  assert.ok(Math.abs(width / height - 16 / 9) < 0.002, "the delivered hero frame must remain effectively 16:9 landscape");
  assert.equal(createHash("sha256").update(image).digest("hex"), "df5d800274253512d474d0e45180c4991cc69857b87e435b0cb356d17cff65d2");
  await execFileAsync("ffmpeg", ["-v", "error", "-xerror", "-i", projectPath(imagePath), "-f", "null", "-"]);

  const userContent = request.body.input[0].content;
  assert.equal(userContent.find(({ type }) => type === "input_text")?.text, prompt, "sanitized request text must equal the committed canonical prompt bytes");
  assert.deepEqual(request.body.tools, [{ type: "image_generation", output_format: "png", size: "2048x1152" }]);
  assert.equal(request.body.model, "gpt-5.4");
  assert.equal(request.headers.Authorization, "Bearer [REDACTED]");
  assert.equal(request.headers["ChatGPT-Account-ID"], "[REDACTED_ACCOUNT_ID]");
  assert.equal(request.headers.session_id, "[REDACTED_SESSION_ID]");
  assert.equal(userContent.find(({ type }) => type === "input_image")?.image_url, "[REDACTED_IMAGE_DATA]");
  assert.equal(response.status, 200);
  assert.equal(response.body.eventCounts["response.completed"], 1);
  assert.equal(response.body.items.find(({ type }) => type === "image_generation_call")?.hasResult, true);
});

test("PerfectPixel records an unsupported-provider blocker without fabricating a sprite bundle", async () => {
  const root = projectPath(PERFECT_PIXEL_ROOT);
  const [capabilities, result, stderr, files] = await Promise.all([
    readJson(`${PERFECT_PIXEL_ROOT}/ppgen-capabilities.json`),
    readFile(projectPath(`${PERFECT_PIXEL_ROOT}/idle-pilot-result.json`)),
    readFile(projectPath(`${PERFECT_PIXEL_ROOT}/idle-pilot-stderr.log`), "utf8"),
    walkRelativeFiles(root),
  ]);
  assert.deepEqual(capabilities.providers, ["gemini", "openai", "openrouter", "fal", "byteplus"]);
  assert.equal(capabilities.providers.includes("god-tibo-imagen"), false, "the requested provider must not be presented as supported");
  assert.equal(result.byteLength, 0, "a preflight provider failure must preserve the real empty stdout rather than forge JSON success");
  assert.equal(stderr.trim(), "ppgen 실패: 지원하지 않는 프로바이더입니다: god-tibo-imagen");
  assert.deepEqual(
    files,
    ["idle-pilot-result.json", "idle-pilot-stderr.log", "ppgen-capabilities.json"],
    "a blocked pilot must not leave frames, atlases, manifests, or a fake output directory",
  );
});

test("Vox candidate keeps eight non-monotone beats and a canonical local media profile", async () => {
  const beats = await readJson(`${VOX_ROOT}/beats.json`);
  assert.deepEqual(
    {
      project: beats.project,
      topic: beats.topic,
      titles: [beats.title_en, beats.title_ko],
      aspect: beats.aspect,
      arc: beats.arc,
      roles: beats.beats.map(({ role }) => role),
    },
    {
      project: "abyssal-forge-vox",
      topic: "How Abyssal Surge turns 3D source assets into a playable dark-fantasy battlefield",
      titles: ["FROM ASSET TO ABYSS", "에셋에서 심연으로"],
      aspect: "16:9",
      arc: "hook_payoff",
      roles: ["hook", "context", "build", "payoff"],
    },
  );
  const shots = beats.beats.flatMap(({ shots: beatShots }) => beatShots);
  assert.equal(shots.length, 8);
  assert.deepEqual(shots.map(({ dur }) => dur), Array(8).fill(3));
  assert.deepEqual(shots.map(({ camera_move: move }) => move), ["push_in", "pan", "parallax", "tilt", "pull_out", "element", "push_in", "static"]);
  assert.ok(shots.every(({ scene, element_motion: motion }) => scene.length > 0 && motion.length > 0), "every beat must specify visible content and element motion");
  assert.deepEqual(beats.beats.map(({ shots: [titleShot, detailShot] }) => [titleShot.title, detailShot.title]), Array(4).fill([true, false]));

  const videoPath = "assets/video/resource-refinement/abyssal-forge-vox.mp4";
  const [probe, bytes, samples] = await Promise.all([
    ffprobe(videoPath),
    readFile(projectPath(videoPath)),
    readdir(projectPath(`${VOX_ROOT}/frame-samples`)),
  ]);
  const { audio, video } = videoAndAudioStreams(probe, videoPath);
  assert.deepEqual(
    { codec: video.codec_name, width: video.width, height: video.height, pixelFormat: video.pix_fmt, rate: video.r_frame_rate },
    { codec: "h264", width: 960, height: 540, pixelFormat: "yuv420p", rate: "24/1" },
  );
  assert.deepEqual({ codec: audio.codec_name, sampleRate: audio.sample_rate }, { codec: "aac", sampleRate: "48000" });
  assert.ok(Math.abs(Number(probe.format.duration) - 22.625) <= 0.001, "Vox delivery must retain its measured local duration");
  const atoms = mp4AtomOffsets(bytes, videoPath);
  assert.ok(atoms.get("moov") < atoms.get("mdat"), "Vox delivery must retain faststart atom order");
  assert.deepEqual(samples.sort(), ["sample-01-01.5s.jpg", "sample-02-07.0s.jpg", "sample-03-12.5s.jpg", "sample-04-20.5s.jpg"]);
});

test("Motion Previs bundle checksums measured 2D motion and leaves unsupported pose and depth layers absent", async () => {
  const bundleRoot = projectPath(PREVIS_ROOT);
  const [manifest, camera, scenes, unsupported, checksumSource] = await Promise.all([
    readJson(`${PREVIS_ROOT}/bundle_manifest.json`),
    readJson(`${PREVIS_ROOT}/camera_motion.json`),
    readJson(`${PREVIS_ROOT}/scene_measurements.json`),
    readJson(`${PREVIS_ROOT}/unsupported_layers.json`),
    readFile(projectPath(`${PREVIS_ROOT}/checksums.sha256`), "utf8"),
  ]);
  const sourcePath = projectPath(manifest.source.path);
  assert.equal(manifest.source.sha256, CANONICAL_VIDEO_SHA256);
  assert.equal(await sha256File(sourcePath), CANONICAL_VIDEO_SHA256);
  assert.equal((await stat(sourcePath)).size, manifest.source.bytes);
  assert.equal(manifest.integrity.algorithm, "SHA-256");
  assert.equal(manifest.integrity.artifact_count, 29);
  assert.equal(manifest.artifacts.length, 29);

  const checksumEntries = checksumSource.trim().split("\n").map((line) => {
    const match = /^(?<sha256>[0-9a-f]{64})  (?<path>.+)$/u.exec(line);
    assert.ok(match, `invalid checksum line: ${line}`);
    return [match.groups.path, match.groups.sha256];
  });
  const checksumByPath = new Map(checksumEntries);
  assert.equal(checksumByPath.size, checksumEntries.length, "checksum paths must be unique");
  const sourceRelativePath = relative(bundleRoot, sourcePath).split(sep).join("/");
  const expectedChecksumPaths = [sourceRelativePath, "bundle_manifest.json", ...manifest.artifacts.map(({ path }) => path)].sort();
  assert.deepEqual([...checksumByPath.keys()].sort(), expectedChecksumPaths, "checksums must cover source, manifest, and every declared artifact, but not themselves");

  assert.equal(checksumByPath.get(sourceRelativePath), CANONICAL_VIDEO_SHA256);
  assert.equal(checksumByPath.get("bundle_manifest.json"), await sha256File(resolve(bundleRoot, "bundle_manifest.json")));
  for (const artifact of manifest.artifacts) {
    const artifactPath = resolve(bundleRoot, artifact.path);
    const relation = relative(bundleRoot, artifactPath);
    assert.ok(relation !== ".." && !relation.startsWith(`..${sep}`), `${artifact.path} must remain inside the bundle`);
    assert.equal((await stat(artifactPath)).size, artifact.bytes, `${artifact.path} byte count must match the bundle manifest`);
    assert.equal(await sha256File(artifactPath), artifact.sha256, `${artifact.path} hash must match the bundle manifest`);
    assert.equal(checksumByPath.get(artifact.path), artifact.sha256, `${artifact.path} hash must match checksums.sha256`);
    assert.equal(artifact.derived_from_source_sha256, CANONICAL_VIDEO_SHA256);
  }

  assert.equal(camera.source.sha256, CANONICAL_VIDEO_SHA256);
  assert.equal(camera.source.frames, 456);
  assert.equal(camera.solver.subject_mask, false);
  assert.equal(camera.solver.physical_camera_calibration, false);
  assert.equal(camera.frames.length, 456);
  assert.ok(camera.frames.every(({ rotation_degrees: rotation, zoom_scale: zoom }) => rotation === null && zoom === null), "unsolved rotation and zoom must remain null rather than fabricated");

  assert.equal(scenes.source.sha256, CANONICAL_VIDEO_SHA256);
  assert.equal(scenes.source.frames, 456);
  assert.equal(scenes.method.hard_cut_threshold, 8);
  assert.equal(scenes.frames.length, 456);
  assert.equal(scenes.result.hard_cut_count, 0);
  assert.deepEqual(scenes.result.hard_cuts, []);
  assert.equal(Math.max(...scenes.frames.map(({ scene_score: score }) => score)), scenes.result.maximum_scene_score);

  assert.match(unsupported.policy, /no placeholder media, keypoints, depth maps, or inferred values were generated/u);
  const forbiddenOutputs = unsupported.layers.flatMap(({ expected_files_not_created: paths = [] }) => paths);
  assert.ok(forbiddenOutputs.length > 0, "unsupported pose and depth analyzers must declare the outputs they did not create");
  for (const path of forbiddenOutputs) {
    await assert.rejects(access(resolve(bundleRoot, path)), { code: "ENOENT" }, `${path} must not be fabricated`);
  }
});
