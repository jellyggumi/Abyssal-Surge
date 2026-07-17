# Audio Import Contract — Manual Chatbot-Generated Audio

- **Status:** prospective import contract; it does not assert that any new audio has been generated, imported, or approved.
- **Date:** 2026-07-16
- **Audience/action:** enables an operator and engineer to request, receive, validate, transcode, and trace a new audio cue without claiming that GodTiboImagen produces audio or exposing provider credentials in the static game.

## Non-negotiable provenance boundary

**[VERIFIED]** The browser currently references public, committed MP3 files under `assets/audio/` for action cues, narration, ambience, and BGM (`app.js:59-75, 691-738, 950-991`; `sw.js:48-63`). `assets/media-manifest.json` records current media hashes and some supplied provenance. Existing assets are not retroactively certified by this contract.

**[DECISION]** New audio is a **separately importable chatbot-generated source**. Its provenance must name the actual audio chatbot/provider and model/version, if supplied by that provider. It MUST NOT be labeled GodTiboImagen, PerfectPixel, FFmpeg, or “original” merely because it was converted or placed in the repository:

- **GodTiboImagen** is the required provenance lane for new game image assets, not audio.
- **PerfectPixel** informs concept-style animation validation only; it has no audio-provider role.
- **FFmpeg** is a local transform/validator, not an audio author.
- Existing ElevenLabs-related entries in the current manifest are **[VERIFIED historical manifest data]**, not approval for a new provider, voice, model, or license.

The contract creates no browser-to-provider API call, no provider selection, and no claim of live generation.

## Roles and manual handoff [PROPOSED]

1. **Requester** creates a validated `AudioGenerationRequestV1` record in a private production channel or approved request store.
2. **Audio operator** uses the chosen chatbot/provider manually from an approved account, outside the game browser. The operator records the actual provider/model/version, provider job/reference ID when available, and applicable rights/terms reference.
3. **Importer** receives the downloaded source file in a private staging directory, validates it, creates the response record, transcodes it if required, and updates repository artifacts in one reviewable change.
4. **QA** reviews the requested cue in the actual gameplay/fallback moment and verifies file measurements/provenance. A waveform or successful conversion alone is not a player-visible acceptance result.
5. **Reviewer** checks the manifest, service-worker/cache additions, and source mapping before merge.

No step authorizes voice cloning, impersonation, a recognizable performer, third-party music, trademarked sound identity, copyrighted recordings, or source audio with unclear reuse rights. Reject those requests before contacting a provider.

## Versioned request/response schema [PROPOSED]

The JSON shapes below are a handoff protocol. They are intentionally provider-neutral and can be validated by JSON Schema, Pydantic, or a future internal tool. Unknown required fields or unknown major schema versions are rejected.

```ts
type AssetRole = "sfx" | "narration" | "ambience" | "music";
type CueId =
  | "hunt" | "extract" | "materialize" | "capture" | "possess" | "domain" | "assault" | "reward"
  | "narr-intro" | "narr-stage1" | "narr-stage2" | "narr-stage3" | "narr-victory" | "narr-defeat"
  | "ambient" | "bgm-theme";

type AudioGenerationRequestV1 = {
  schema: "abyssal-surge.audio-generation-request";
  schemaVersion: "1.0";
  requestId: string;                     // UUID/ULID, immutable
  cueId: CueId;                          // must map to one approved runtime cue
  role: AssetRole;
  targetPath: `assets/audio/${string}.mp3`;
  playerMoment: string;                  // exact action/scene/fallback context
  prompt: string;                        // original-IP descriptive prompt; no secret/third-party request
  narrationText?: string;                // required only for role=narration
  language?: "ko-KR" | "en-US";        // required only for role=narration
  requestedDurationMs: number;           // bounded by role below
  channels: 1 | 2;
  sourceFormat: "wav" | "mp3";         // permitted handoff source only
  rightsAttestation: {
    originalOnly: true;
    noRecognizableVoiceOrRecording: true;
    operatorMayImport: true;
    termsReference: string;
  };
  requestedBy: string;                   // accountable role/name, not a secret
  createdAt: string;                     // RFC 3339 UTC
};

type AudioGenerationResponseV1 = {
  schema: "abyssal-surge.audio-generation-response";
  schemaVersion: "1.0";
  requestId: string;
  outcome: "accepted" | "rejected" | "imported" | "failed-validation";
  rejectionCode?:
    | "unsupported-input" | "invalid-cue" | "unsafe-rights" | "missing-provenance"
    | "provider-failure" | "format-failure" | "loudness-failure" | "hash-failure"
    | "manifest-failure" | "qa-failure";
  provider?: {
    name: string;                        // actual audio chatbot/provider, never GodTiboImagen for audio
    model: string;
    modelVersion?: string;
    jobReference?: string;
    generatedAt?: string;                // RFC 3339 UTC when supplied
  };
  receivedSource: {
    filename: string;
    mediaType: "audio/wav" | "audio/mpeg";
    bytes: number;
    sha256: string;                      // lower-case 64-character SHA-256
  };
  output?: {
    path: `assets/audio/${string}.mp3`;
    bytes: number;
    sha256: string;
    codec: "mp3";
    sampleRateHz: 44100;
    channels: 1 | 2;
    bitrateKbps: 96 | 128;
    durationMs: number;
    integratedLufs: number;
    truePeakDbtp: number;
  };
  validation: {
    ffprobePassed: boolean;
    loudnessPassed: boolean;
    contentReviewPassed: boolean;
    manifestUpdated: boolean;
    serviceWorkerUpdated: boolean;
    browserQaStatus: "pass" | "fail" | "not-run";
    notes: string;
  };
  importedBy?: string;
  completedAt: string;
};
```

### Request validation

The intake tool/operator MUST reject a request before generation when any rule below fails:

| Field/rule | Validation |
|---|---|
| Schema | Exact `schema` and `schemaVersion: "1.0"`; reject unknown fields in a typed implementation to prevent accidental provider parameters or secrets. |
| Cue mapping | `cueId` and basename of `targetPath` must match a declared runtime cue. New cue IDs require an explicit `app.js` mapping and must not overwrite another cue silently. |
| Path | Relative path only; exact prefix `assets/audio/`; no `..`, query, URL, whitespace-only name, or extension other than `.mp3` for the output. |
| Role | `narrationText` and `language` are required for narration and forbidden for SFX/ambience/music unless a later schema explicitly adds lyric support. |
| Text/prompt | Non-empty, bounded to 1,500 UTF-8 characters; original-IP only; no request to imitate named/identifiable performers, artists, commercial tracks, films, games, or sound libraries. |
| Source file | Handoff source must be a regular `.wav` PCM/IEEE float file or `.mp3` MPEG audio file. Reject archives, URLs, executable content, `m4a`, `aac`, `ogg`, `flac`, video containers, and a MIME/extension mismatch. |
| Duration | `sfx`: 500–3,000 ms; `narration`: 1,000–12,000 ms; `ambience`: 5,000–60,000 ms; `music`: 10,000–60,000 ms. A longer file requires a new policy revision. |
| Rights | All three boolean attestations must be `true` and `termsReference` must be non-empty. Attestation is a review input, not proof; unclear terms or ownership reject import. |
| Duplicate request | `requestId` is immutable. Reuse with changed prompt, file, or target is rejected; issue a new request. |

## Measurable output constraints [PROPOSED]

These limits apply to newly imported assets only. They make no claim that every current audio file meets them.

| Role | Delivery format | Channels | Target loudness | Peak | Duration and size ceiling |
|---|---|---:|---:|---:|---|
| SFX | MP3, 44,100 Hz, 128 kbps CBR | 1 | −18 to −14 LUFS-I | ≤ −1.0 dBTP | 0.5–3.0 s; ≤100 KiB |
| Narration | MP3, 44,100 Hz, 96 or 128 kbps CBR | 1 | −20 to −16 LUFS-I | ≤ −1.0 dBTP | 1.0–12.0 s; ≤250 KiB |
| Ambience | MP3, 44,100 Hz, 128 kbps CBR | 2 | −24 to −18 LUFS-I | ≤ −1.0 dBTP | 5–60 s; ≤1 MiB |
| Music | MP3, 44,100 Hz, 128 kbps CBR | 2 | −18 to −14 LUFS-I | ≤ −1.0 dBTP | 10–60 s; ≤1 MiB |

- `integratedLufs` is measured with EBU R128 / `ebur128`, and `truePeakDbtp` with a true-peak-capable meter. Use two-pass normalization where adjustment is needed; do not accept a raw peak measurement as loudness evidence.
- If input source format is WAV, retain its staging hash and generate the runtime MP3 from it. If input is MP3 but fails one required delivery measurement, regenerate/obtain an approved source rather than repeatedly transcoding a lossy file.
- `bytes` and SHA-256 must be measured on the final committed MP3, not an upload preview.
- Cue playback is optional media: failure to decode/load must retain the text/UI core loop. Existing `Audio` error handling and the optional-media cache behavior provide the baseline that any new mapping must preserve (`app.js:691-738, 950-991`; `sw.js:20-68`).

## Validation and import procedure [PROPOSED]

Run this procedure in a private trusted workstation/CI environment, not from browser JavaScript:

1. Validate `AudioGenerationRequestV1` and record outcome `accepted` or a specific rejection code before the manual provider handoff.
2. Receive the provider file into a non-public staging path. Calculate `shasum -a 256 <source>` and capture `ffprobe` container/stream metadata. Reject if the observed file differs from the request's allowed source format, duration, or declared hash.
3. Inspect for content/risk: correct player moment, no third-party or recognizable-voice/music request, intelligible narration in requested language, no unusable silence/clipping, and no secret-bearing metadata. Record the reviewer and result.
4. Convert or normalize into the specified MP3 delivery profile. Preserve the exact command/configuration in private build evidence; conversion does not replace provider provenance.
5. Measure the final file with `ffprobe` and EBU-R128/true-peak analysis. Reject it with `format-failure` or `loudness-failure` if any table limit fails.
6. Place only the final validated MP3 at `assets/audio/<cue>.mp3`. Create response `output` hash/measurements from that exact file.
7. In the same change, update `assets/media-manifest.json`, `sw.js` `OPTIONAL_MEDIA` when the path is new, and any `app.js` cue/narration mapping required by a new cue. Existing Pages artifact handling already includes `assets/`, but do not rely on that to omit cache/mapping review.
8. Run a browser scenario that triggers the cue and its fallback/error path. Set `browserQaStatus` to `pass`, `fail`, or `not-run` exactly as observed. A missing browser run blocks import approval rather than becoming an assumed pass.

### Required validation evidence

| Check | Evidence recorded in response/review packet |
|---|---|
| File identity | Source and output SHA-256, byte counts, request ID, target path. |
| Decodability | `ffprobe` command and observed codec/sample rate/channels/duration. |
| Loudness | Meter command/configuration, integrated LUFS, true peak, pass/fail against table. |
| Provenance | Actual provider, model/version/job reference when supplied, generated date, sanitized prompt, and terms reference. |
| Runtime integration | Manifest record, service-worker entry if new, cue mapping if new, and fallback/UI observation. |
| QA | Player moment, browser/runtime, result, reviewer, date, and any defect/recovery action. |

## `assets/media-manifest.json` update contract [PROPOSED]

Add or replace exactly one entry for the final runtime file. The entry must use the existing manifest shape and must not backdate or erase unrelated assets:

```json
{
  "filename": "assets/audio/<cue-id>.mp3",
  "media_type": "audio/mpeg",
  "bytes": 12345,
  "generated_by": "<actual chatbot audio provider> — <actual model/version>",
  "source_key_art": [],
  "source_assets": [],
  "derivation": "Chatbot-generated audio imported manually from request <request-id>; validated to this contract. Provider job reference: <reference-or-not-supplied>.",
  "sha256": "<64-lowercase-hex>"
}
```

- Do not put API keys, access tokens, account IDs, private download URLs, raw provider responses, or unredacted personal data in the manifest.
- Do not state that a provider/model is known if the operator cannot supply it; use `missing-provenance` and reject import instead.
- `source_key_art` and `source_assets` are empty for independently generated audio unless a separately licensed, reviewed source audio is explicitly approved in a future contract. A visual key-art path is not audio provenance.
- If an existing asset is being replaced, preserve a reviewed history record outside the public manifest with old/new hash, reason, and rollback source; never overwrite it under the same filename without that decision.

## Security and release boundary

- The static browser may request only same-origin committed media. It MUST NOT contain an audio-provider API key, OAuth client secret, bearer token, signed provider URL, or a direct generation/upload endpoint.
- Provider interaction happens through the manual operator workflow or a future server-side integration with secrets in an approved secret store. A public `VITE_*`, `NEXT_PUBLIC_*`, JavaScript constant, HTML data attribute, service-worker cache entry, or `assets/media-manifest.json` field is not an acceptable secret store.
- A future automated import service must authenticate operators server-side, validate this request schema before calling a provider, quarantine downloads, scan/measure before publication, and use a narrow server credential. It is out of scope for this static campaign.
- A failed provider call, unknown rights, malformed source, loudness/format failure, manifest mismatch, missing cache update, or failed browser fallback leaves the existing cue unchanged and records a rejected/failed response. No partial import is release-ready.

## Explicit unknowns and unavailable prerequisites

1. No selected chatbot-audio provider, model, account entitlement, API credential, or provider job ID has been supplied for this revision.
2. No current asset's provenance is upgraded by this document; each existing manifest claim stands only as recorded there.
3. No automated importer, Pydantic runtime, provider API integration, or browser upload/generation UI exists in this repository.
4. No new audio browser QA has been run under this contract. Its status is therefore **NOT-RUN**, not pass.

## References

- Local verified sources, read 2026-07-16: `app.js`, `sw.js`, and [`../../../assets/media-manifest.json`](../../../assets/media-manifest.json).
- Existing historical audio measurements/provenance record, read 2026-07-16: [`../../20260716-shadow-lord-rts-rpg/engineering/audio-manifest.md`](../../20260716-shadow-lord-rts-rpg/engineering/audio-manifest.md).
- External validation references, consulted 2026-07-16: [FFmpeg `ebur128` filter](https://ffmpeg.org/ffmpeg-filters.html#ebur128), [FFprobe documentation](https://ffmpeg.org/ffprobe.html), [EBU R 128 recommendation](https://tech.ebu.ch/publications/r128), [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Local importer implementation status — 2026-07-16

- `scripts/generate_game_audio.py validate --input <file> --role <role>` now performs local `ffprobe`-based extension/container, duration, and byte checks for a user-supplied MP3/WAV, and records codec, channel, and sample-rate facts in JSON with `"network": "not-used"`.
- `scripts/generate_game_audio.py import` requires a caller-supplied request ID, prompt, actual provider/model, and opaque source reference. It validates the copied/transcoded temporary MP3 before atomically placing only a reviewed `assets/audio/<name>.mp3`, and prints the caller-owned manifest-record JSON. It does **not** establish request-ID immutability; the external production record remains the enforcement point. It does **not** edit `assets/media-manifest.json`, `app.js`, or `sw.js`.
- WAV import uses local FFmpeg to create the delivery MP3; MP3 input must already meet the delivery profile. The operator still completes the manifest/cache/runtime QA steps in this contract as a separate reviewable change.
- No credential-backed provider generation was run for this implementation. The existing ElevenLabs/Gemini commands remain explicit `--generate` paths; default, `validate`, `import`, and `--dry-run` do not contact a provider.
