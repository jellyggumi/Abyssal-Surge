import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREPARE_WORKSPACE = join(REPOSITORY_ROOT, "scripts", "prepare_vox_workspace.py");
const CANONICAL_BEAT_MAP = join(
  REPOSITORY_ROOT,
  "_workspace/20260716-abyssal-surge-revision/production/abyssal-surge-concept-video-beats.json",
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const REQUIRED_PROJECT_FIELDS = Object.freeze([
  "project",
  "topic",
  "language",
  "aspect",
  "style",
  "provider",
  "video_model",
  "motion_style",
  "constraints",
  "theme",
  "visual_production_path",
  "generation_gate",
  "visual_direction",
  "beats",
]);
const REQUIRED_BEAT_FIELDS = Object.freeze(["id", "title_cn", "title_en", "bg", "feel", "narration", "shots"]);
const REQUIRED_SHOT_FIELDS = Object.freeze([
  "id",
  "dur",
  "title",
  "camera_move",
  "element_motion",
  "scene",
  "keyframe_path",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function atlasFreeEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/(atlas|credential)/i.test(name)),
  );
}

function runWorkspacePreparation(beatMap, outputDirectory) {
  return new Promise((resolveRun, reject) => {
    const process = spawn("python3", [PREPARE_WORKSPACE, beatMap, outputDirectory], {
      cwd: REPOSITORY_ROOT,
      env: atlasFreeEnvironment(),
    });
    let stdout = "";
    let stderr = "";

    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    process.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    process.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    process.on("error", reject);
    process.on("close", (code) => resolveRun({ code, stdout, stderr }));
  });
}

function tesseractAvailable() {
  return new Promise((resolveAvailable) => {
    const process = spawn("tesseract", ["--version"]);
    process.on("error", () => resolveAvailable(false));
    process.on("close", (code) => resolveAvailable(code === 0));
  });
}

function extractPosterWords(posterPath) {
  return new Promise((resolveExtraction, reject) => {
    const process = spawn("tesseract", [posterPath, "stdout", "--psm", "11", "tsv"]);
    let stdout = "";
    let stderr = "";

    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    process.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    process.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    process.on("error", reject);
    process.on("close", (code) => {
      const words = stdout
        .split("\n")
        .slice(1)
        .map((row) => row.split("\t"))
        .filter((fields) => fields[0] === "5")
        .map((fields) => ({ confidence: Number(fields[10]), text: fields[11]?.trim() ?? "" }))
        .filter(({ confidence, text }) => confidence >= 80 && /[\p{L}\p{N}]{2,}/u.test(text));
      resolveExtraction({ code, stderr, words });
    });
  });
}

function inspectPng(bytes, filename) {
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, `${filename} must be a PNG`);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${filename} must start with an IHDR chunk`);

  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, `${filename} must have complete PNG chunk headers`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const nextOffset = offset + 12 + length;
    assert.ok(nextOffset <= bytes.length, `${filename} must have complete ${type} chunk data`);
    chunks.push(type);
    offset = nextOffset;
    if (type === "IEND") {
      break;
    }
  }

  assert.equal(chunks.at(-1), "IEND", `${filename} must have an IEND chunk`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    chunks,
  };
}

function assertRequiredFields(record, fields, label) {
  for (const field of fields) {
    assert.ok(Object.hasOwn(record, field), `${label} must retain required Vox Clips field ${field}`);
  }
}

test("prepare_vox_workspace builds a credential-free source-backed Vox workspace and rejects absent source plates", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "abyssal-surge-vox-workspace-"));

  try {
    const outputDirectory = join(temporaryDirectory, "prepared");
    await mkdir(outputDirectory);
    const successfulRun = await runWorkspacePreparation(CANONICAL_BEAT_MAP, outputDirectory);
    assert.equal(successfulRun.code, 0, successfulRun.stderr || successfulRun.stdout);

    const [canonicalBytes, outputBytes, manifestBytes] = await Promise.all([
      readFile(CANONICAL_BEAT_MAP),
      readFile(join(outputDirectory, "beats.json")),
      readFile(join(outputDirectory, "manifest.json")),
    ]);
    const canonical = JSON.parse(canonicalBytes.toString("utf8"));
    const output = JSON.parse(outputBytes.toString("utf8"));
    const manifest = JSON.parse(manifestBytes.toString("utf8"));

    assert.equal(output.style, "collage", "Vox workspace must declare the collage renderer");
    assert.match(
      output.visual_production_path,
      /^no-Atlas-text-to-image:/i,
      "Vox workspace must prohibit the Atlas text-to-image path",
    );
    assertRequiredFields(output, REQUIRED_PROJECT_FIELDS, "workspace output");
    assert.equal(output.beats.length, canonical.beats.length, "all canonical beats must reach Vox output");

    const canonicalShotCount = canonical.beats.reduce((total, beat) => total + beat.shots.length, 0);
    const outputShots = output.beats.flatMap((beat) => beat.shots);
    assert.equal(canonicalShotCount, 12, "canonical fixture must contain the twelve approved shots");
    assert.equal(outputShots.length, 12, "Vox output must preserve all twelve approved shots");

    for (const [index, beat] of output.beats.entries()) {
      assertRequiredFields(beat, REQUIRED_BEAT_FIELDS, `beat ${beat.id}`);
      assert.equal(beat.id, canonical.beats[index].id, "Vox beat order and identity must remain canonical");
      assert.equal(beat.title_cn, canonical.beats[index].headline_ko, "Vox beat heading must retain canonical text");
      for (const shot of beat.shots) {
        assertRequiredFields(shot, REQUIRED_SHOT_FIELDS, `shot ${beat.id}/${shot.id}`);
      }
    }

    assert.equal(manifest.upstream_vox_revision, "0f66dc444fc18ac26f6dddd30ee5505d31b45de6");
    assert.equal(manifest.canonical_input.sha256, sha256(canonicalBytes), "manifest must hash the input bytes it consumed");
    assert.equal(
      manifest.canonical_input.path,
      relative(REPOSITORY_ROOT, CANONICAL_BEAT_MAP),
      "manifest must name the canonical input path",
    );

    const expectedSourcePaths = [...new Set(canonical.beats.flatMap((beat) => beat.source_key_art))].sort();
    assert.deepEqual(
      manifest.source_files.map((source) => source.path).sort(),
      expectedSourcePaths,
      "manifest must retain every and only canonical source plate",
    );
    for (const source of manifest.source_files) {
      const sourceBytes = await readFile(resolve(REPOSITORY_ROOT, source.path));
      assert.equal(source.sha256, sha256(sourceBytes), `${source.path} source hash must match its bytes`);
    }

    assert.equal(manifest.posters.length, 12, "manifest must record every generated poster");
    const posterPaths = new Set(manifest.posters.map((poster) => poster.path));
    assert.equal(posterPaths.size, 12, "every shot must receive its own poster path");
    assert.deepEqual(
      [...posterPaths].sort(),
      outputShots.map((shot) => shot.keyframe_path).sort(),
      "every Vox shot must point to a manifest-backed poster",
    );

    for (const poster of manifest.posters) {
      assert.deepEqual(
        Object.keys(poster).sort(),
        ["height", "path", "sha256", "width"],
        `${poster.path} manifest record must contain no caption, title, or output-text metadata`,
      );
      const posterBytes = await readFile(resolve(REPOSITORY_ROOT, poster.path));
      const png = inspectPng(posterBytes, poster.path);
      assert.deepEqual(
        { width: png.width, height: png.height },
        { width: 960, height: 540 },
        `${poster.path} must be a 960×540 keyframe`,
      );
      assert.deepEqual(
        png.chunks.filter((chunk) => ["tEXt", "zTXt", "iTXt"].includes(chunk)),
        [],
        `${poster.path} must not embed caption or title text metadata`,
      );
      assert.equal(poster.sha256, sha256(posterBytes), `${poster.path} poster hash must match its bytes`);
    }

    const localTesseract = await tesseractAvailable();
    await t.test(
      "generated posters contain no OCR-detectable text",
      { skip: localTesseract ? false : "local tesseract is unavailable" },
      async () => {
        for (const poster of manifest.posters) {
          const extraction = await extractPosterWords(resolve(REPOSITORY_ROOT, poster.path));
          assert.equal(extraction.code, 0, extraction.stderr || `tesseract failed for ${poster.path}`);
          assert.deepEqual(extraction.words, [], `${poster.path} must not contain visible poster text`);
        }
      },
    );

    assert.equal(manifest.output_beats_json.sha256, sha256(outputBytes), "manifest must hash beats.json bytes");
    assert.deepEqual(
      await readFile(resolve(REPOSITORY_ROOT, manifest.output_beats_json.path)),
      outputBytes,
      "manifest must point to the generated beats.json bytes",
    );

    const repeatedRun = await runWorkspacePreparation(CANONICAL_BEAT_MAP, outputDirectory);
    assert.equal(
      repeatedRun.code,
      0,
      repeatedRun.stderr || "a generated workspace containing only expected artifacts must be reusable",
    );

    const missingSourceFixture = join(temporaryDirectory, "missing-source-beats.json");
    const invalidBeatMap = structuredClone(canonical);
    invalidBeatMap.beats[0].source_key_art = ["assets/images/__test_missing_vox_source_plate__.png"];
    await writeFile(missingSourceFixture, `${JSON.stringify(invalidBeatMap)}\n`);

    const rejectedOutputDirectory = join(temporaryDirectory, "missing-source-output");
    const rejectedRun = await runWorkspacePreparation(missingSourceFixture, rejectedOutputDirectory);
    assert.notEqual(rejectedRun.code, 0, "a canonical beat map with a missing source plate must fail");
    assert.match(
      rejectedRun.stderr,
      /Error: Source plate missing at .*__test_missing_vox_source_plate__\.png.*Beat 1\./,
      "missing source failure must identify the absent plate and beat",
    );
    assert.equal(
      existsSync(join(rejectedOutputDirectory, "manifest.json")),
      false,
      "a rejected source fixture must not create a partial successful manifest",
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("prepare_vox_workspace rejects source paths that escape approved assets/images", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "abyssal-surge-vox-source-policy-"));

  try {
    const canonical = JSON.parse((await readFile(CANONICAL_BEAT_MAP, "utf8")));
    const rejectedFixtures = [
      {
        name: "traversal",
        sourcePath: "assets/images/../../tests/playtest_lobby.png",
      },
      {
        name: "absolute",
        sourcePath: resolve(REPOSITORY_ROOT, "tests/playtest_lobby.png"),
      },
    ];

    for (const { name, sourcePath } of rejectedFixtures) {
      const invalidBeatMap = structuredClone(canonical);
      invalidBeatMap.beats[0].source_key_art = [sourcePath];
      const fixturePath = join(temporaryDirectory, `${name}-source-beats.json`);
      const outputDirectory = join(temporaryDirectory, `${name}-output`);
      await writeFile(fixturePath, `${JSON.stringify(invalidBeatMap)}\n`);

      const rejectedRun = await runWorkspacePreparation(fixturePath, outputDirectory);
      assert.notEqual(
        rejectedRun.code,
        0,
        `${name} source path outside assets/images must be rejected before poster generation`,
      );
      assert.match(
        rejectedRun.stderr,
        /Error: Source plate .*approved assets\/images/i,
        `${name} source rejection must identify the approved-source boundary`,
      );
      assert.equal(
        existsSync(join(outputDirectory, "manifest.json")),
        false,
        `${name} escaped source path must not create a successful manifest`,
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("prepare_vox_workspace preserves non-generated content in an existing output directory", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "abyssal-surge-vox-output-policy-"));

  try {
    const outputDirectory = join(temporaryDirectory, "existing-output");
    const sentinelPath = join(outputDirectory, "must-not-be-deleted.txt");
    await mkdir(outputDirectory);
    await writeFile(sentinelPath, "preserve this directory");

    const rejectedRun = await runWorkspacePreparation(CANONICAL_BEAT_MAP, outputDirectory);
    assert.notEqual(
      rejectedRun.code,
      0,
      "a non-empty output directory containing user content must be refused",
    );
    assert.match(
      rejectedRun.stderr,
      /Error:.*non-empty.*output/i,
      "output refusal must identify the non-empty output safety boundary",
    );
    assert.equal(
      await readFile(sentinelPath, "utf8"),
      "preserve this directory",
      "refusing an output directory must not delete its existing contents",
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
