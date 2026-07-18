# Resource Budget and Release Map

**Run:** `20260718-resource-refinement`  
**Owner:** Game PM  
**Operating mode:** Stage 1 — resource/presentation refinement  
**Public beat:** existing static single-player Web/PWA release candidate with refined presentation resources  
**Authority:** `campaign-state.js` remains the sole authority for rules, save data, and replay behavior. This document changes no production code or binary asset.

## 1. Release boundary and fairness declaration

This beat preserves the current local, deterministic single-player contract. Media may explain or reinforce an existing event, but it may not create, suppress, delay, accelerate, or reinterpret a state transition. The text/UI path must remain sufficient when image, GLB, sprite, audio, or video delivery fails.

```yaml
release_contract:
  product_mode: static-single-player-pwa
  authoritative_rules: campaign-state.js
  new_payment_surface_count: 0
  new_monetization_surface_count: 0
  new_account_or_multiplayer_surface_count: 0
  allowed_rule_or_save_schema_changes: 0
  allowed_media_owned_state_transitions: 0
  allowed_media_required_inputs: 0
  fairness_target:
    reward_value_delta: 0
    resource_cost_delta: 0
    damage_or_hp_delta: 0
    rng_or_encounter_delta: 0
    save_or_replay_delta: 0
```

**Fairness verdict:** neutral by construction. This resource pass adds no payment, purchase prompt, premium path, new reward, economy input, matchmaking, or progression accelerator. A cue may play late, fail, or be skipped without changing the result produced by `campaign-state.js`. Any non-zero value in the block above is outside this release and blocks approval.

## 2. Measured baseline and accounting rules

Baseline was measured from the local working tree on **2026-07-18** with a read-only `pathlib` byte-count script. Values are packaging measurements, not runtime-quality claims. `MiB = bytes / 1,048,576`; `KiB = bytes / 1,024`.

| Surface | Measured files | Measured bytes | Measured MiB | Accounting note |
|---|---:|---:|---:|---|
| Core shell files named by `sw.js` `CORE_ASSETS` (excluding the `./` navigation alias) | 22 | 1,464,063 | 1.40 | Mandatory install tier; the root navigation response is the same shell class and must not create a second budget allowance. |
| `sw.js` `OPTIONAL_MEDIA` files | 67 | 26,361,094 | 25.14 | Current install attempts each file with `Promise.allSettled`; a failure may not fail installation. |
| GLB raster bridge outputs named by `assets/images/battle/glb/manifest.json` | 45 | 10,888,058 | 10.38 | Installed through the bridge manifest; manifest itself is 55,832 bytes. |
| Total install-cache attempt | — | 38,769,047 | 36.97 | Core + optional media + bridge outputs + bridge manifest. |
| Active lazy source GLBs named by `LAZY_SOURCE_BATTLE_PATHS` | 8 | 110,076,512 | 104.98 | Network-first, cached after a valid `model/gltf-binary` response. |
| Complete `assets/models/abyssal-command/**/*.glb` source pack | 15 | 192,803,364 | 183.87 | Repository/source-pack budget; only the active lazy subset is a runtime cache liability. |
| Complete GLB raster bridge PNG set on disk | 60 | 10,944,341 | 10.44 | Fifteen files are not currently named by the bridge manifest; they are not charged to install cache until referenced. |
| Complete `assets/audio/*.mp3` set | 17 | 920,282 | 0.88 | One current file is outside `OPTIONAL_MEDIA`; only runtime-referenced files are release-active. |
| Complete `assets/video/*.mp4` set | 51 | 101,507,224 | 96.80 | Most files are production/candidate cuts, not active cache entries. Directly published inactive cuts remain a repository/delivery risk. |
| Video caption files | 1 | 1,847 | <0.01 | Text track; counted with its approved cinematic. |
| Other `assets/images/**` files outside the GLB bridge | 54 | 24,627,215 | 23.49 | Includes stage, UI, storyboard, character, and concept imagery. |

A release report must recalculate these values from the exact candidate revision. The measured baseline does not grant headroom by itself: **soft cap** means the owner must optimize or remove an inactive duplicate before approval; **hard cap** means rollback or removal is mandatory.

## 3. File-family budgets

### 3.1 Public delivery and repository budgets

| Family / exact scope | Per-file hard cap | Family soft cap | Family hard cap | Delivery priority | Required fallback | Approval owner |
|---|---:|---:|---:|---|---|---|
| Core shell: HTML, JS, CSS, local vendor JS, manifest/icon | 768 KiB | 1.75 MiB | **2.00 MiB** | P0, mandatory install | cached `index.html` navigation shell; no media dependency | Engineering + QA |
| Stage/key/UI/storyboard stills under `assets/images/` excluding GLB bridge | 3.0 MiB master; 1.5 MiB runtime image | 28 MiB | **32 MiB** | P1 only when visible in the first three stages; otherwise P2 | semantic title/objective/action/reward text and meaningful alt where visual meaning is not already adjacent | Art + QA |
| GLB raster bridge PNG, terrain plate | 128 KiB | — | included in bridge family cap | P1 install | Canvas primitive/text state | 2D Technical Art + QA |
| GLB raster bridge PNG, action atlas | 384 KiB | 11 MiB | **12 MiB** including bridge manifest | P1 install | existing static sprite/Canvas primitive; no runtime GLB parser | 2D Technical Art + QA |
| Active source GLB | **17 MiB** | 108 MiB | **112 MiB** for the active lazy set | P2, fetch only on actual 3D battle use | GLB raster bridge/Canvas renderer | 3D Technical Art + Engineering + QA |
| Complete GLB source pack in repository | 17 MiB | 192 MiB | **200 MiB** | Build/source inventory; inactive files are never pre-cached | bridge assets for runtime-active identities | 3D Technical Art |
| SFX MP3 | **100 KiB** | 0.75 MiB | **1.00 MiB** | P1 optional | visible action label, status, disabled reason, and result text | Audio + QA |
| Narration MP3 | **250 KiB** | 1.25 MiB | **1.50 MiB** | P1 optional after text | synchronized Korean on-screen narration; no input lock | Audio + Narrative + QA |
| Ambience or music MP3 | **1 MiB** | 1.50 MiB | **2.00 MiB** | P2 optional | silence; game remains fully operable | Audio + QA |
| All runtime-active audio | role cap above | 3.0 MiB | **4.0 MiB** | P1/P2 by role | text/UI/silence | Audio + QA |
| Stage transition MP4 | **512 KiB** each | 1.25 MiB | **1.50 MiB** for three active clips | P2 optional, after key art | matching stage still + title/objective; suppressed for reduced motion | Video + QA |
| Optional cinematic MP4 | **8 MiB** | 6 MiB | **8 MiB** | P3, explicit player action or non-blocking optional surface | storyboard/key art + captions + descriptive transcript | Video + Narrative + QA |
| All runtime-active MP4/VTT | role cap above | 10 MiB | **12 MiB** | P2/P3 | still/text/caption/transcript path | Video + QA |
| Published but runtime-unreferenced candidate MP4 pool | 16 MiB each | 112 MiB | **128 MiB** | P4; never service-worker cached | not applicable; these are production evidence, not player requirements | Production Director |

### 3.2 Cache budgets

```yaml
cache_budget:
  units: binary-bytes
  mandatory_core_install:
    soft_mib: 1.75
    hard_mib: 2.00
    failure_policy: install-fails
  optional_media_install:
    soft_mib: 30
    hard_mib: 32
    failure_policy: per-file-failure-tolerated
  glb_bridge_install_including_manifest:
    soft_mib: 11
    hard_mib: 12
    failure_policy: bridge-precache-failure-tolerated
  total_install_attempt:
    soft_mib: 44
    hard_mib: 48
  lazy_active_source_glb:
    soft_mib: 108
    hard_mib: 112
  worst_case_persistent_cache:
    soft_mib: 152
    hard_mib: 160
  inactive_candidate_media_precache_count: 0
  old_abyssal_surge_cache_names_after_activate: 0
```

The 36.97 MiB measured install attempt is below the 48 MiB hard cap. The measured 104.98 MiB active lazy GLB set is below its 112 MiB hard cap. Their 141.95 MiB combined worst-case is below the 160 MiB hard cap. These are capacity checks only; they do not prove that a browser granted storage or that offline playback passed.

## 4. Cache policy and web delivery order

| Tier | Assets | Fetch/cache rule | Failure behavior | Promotion rule |
|---|---|---|---|---|
| P0 | `CORE_ASSETS` | Fetch with `cache: "no-store"` during install and on core requests; cache successful response; activate deletes older `abyssal-surge-*` caches. | A mandatory core install failure blocks the new worker. Existing installed release remains the rollback surface. | Only files needed to boot, load save, render text/UI, and accept input. Media never enters P0. |
| P1 | GLB raster bridge; compact, immediately visible still/audio | Pre-cache as optional data. Bridge outputs are enumerated only through `assets/images/battle/glb/manifest.json`; optional files settle independently. | Missing file must preserve Canvas/text play. Bridge manifest/output failure may not block shell install. | Promote only with an observed first-session use and family/cache headroom. |
| P2 | Active source GLB, stage transition video, ambience/music | Lazy fetch on actual use. Valid source GLB responses use network-first and cache-on-success; ordinary optional media remains cache-first after first retrieval. | GLB falls back to raster bridge/Canvas; video to still/text; audio to silence/text. | Runtime reference, manifest record, fallback, and candidate-byte report must all exist. |
| P3 | Optional cinematic | Never required for campaign start or stage completion. Load after interactive shell and only from an optional player-facing surface. | Hide/disable the media surface and retain storyboard/caption/transcript content. | Human approval plus codec, caption, reduced-motion, and native-control evidence. |
| P4 | Raw renders, superseded cuts, generation intermediates, contact sheets not used at runtime | **Never** add to `CORE_ASSETS`, `OPTIONAL_MEDIA`, or bridge runtime manifest. | No player impact. | Promote a single approved derivative; do not promote variants as a family. |

Rules:

1. Every cache-list addition must name the family, before/after bytes, tier, fallback, and cache-name change in the release report.
2. `OPTIONAL_MEDIA` growth above 30 MiB requires removal/compression evidence; above 32 MiB blocks release.
3. Runtime-unreferenced cuts do not consume install cache, but the public candidate pool may not exceed 128 MiB. A beat may add at most **one** approved cinematic and **three** approved stage clips; superseded cuts remain production evidence only and should not be promoted to a public artifact.
4. Do not add a GLB parser to the Canvas path. The bridge manifest is the 3D-to-2D handoff contract.
5. Range-request behavior is not assumed. Each approved MP4 must remain within its single-file cap and be usable after a normal full-file response.
6. Service-worker activation must leave exactly one `abyssal-surge-*` cache name. A meaningful runtime/cache-list change requires a new cache name; rollback restores the previous approved file set under a newly bumped name rather than reusing a poisoned cache key.

## 5. Media format and fallback gates

### 5.1 3D GLB and raster bridge

An approved GLB must satisfy all of the following:

- binary `.glb`, MIME `model/gltf-binary`, per-file byte cap met;
- root/pivot at ground center, with measured ground contact tolerance of **±0.01 m** on the exported asset;
- all declared images embedded; **0** external texture/image URLs;
- declared clip set matches `assets/models/abyssal-command/manifest.json` exactly; **0** missing clips and **0** undeclared runtime clip references;
- source SHA-256 in the bridge manifest equals the committed GLB SHA-256;
- bridge output SHA-256 and byte count equal the committed PNG; atlas contract is **8 yaw columns × 4 source-frame rows**, `128×128` cells for action atlases, unless the existing manifest explicitly declares a terrain plate;
- Canvas fallback loads no GLB parser and reaches the same text-visible battle outcome.

Any pivot drift, external image, missing clip, hash mismatch, or absent raster fallback rejects the GLB/bridge pair.

### 5.2 2D images and sprites

- Runtime extension/MIME/dimensions/bytes/hash must match the manifest.
- A new or replaced image follows the approved image-provider/procedural lane and records the exact prompt or recipe. Existing legacy art is not retroactively relabeled.
- Action/reward art is decorative reinforcement: **0** costs, cooldowns, unit counts, damage values, availability gates, or win/fail states may exist only in pixels.
- Meaningful imagery has equivalent alt or adjacent text. Decorative duplicated imagery uses empty alt.
- Animated contact sheets have exact declared frame count; alpha edge review is performed against both `#0e1218` and white; bright flash frequency is **≤3 Hz**.

### 5.3 Audio

| Role | Runtime format | Channels | Duration | Loudness | Peak | Per-file size | Mandatory fallback |
|---|---|---:|---:|---:|---:|---:|---|
| SFX | MP3, 44.1 kHz, 128 kbps CBR | 1 | 0.5–3.0 s | −18 to −14 LUFS-I | ≤−1.0 dBTP | ≤100 KiB | visible action/result state |
| Narration | MP3, 44.1 kHz, 96 or 128 kbps CBR | 1 | 1–12 s | −20 to −16 LUFS-I | ≤−1.0 dBTP | ≤250 KiB | synchronized on-screen Korean line; no input lock |
| Ambience | MP3, 44.1 kHz, 128 kbps CBR | 2 | 5–60 s | −24 to −18 LUFS-I | ≤−1.0 dBTP | ≤1 MiB | silence |
| Music | MP3, 44.1 kHz, 128 kbps CBR | 2 | 10–60 s | −18 to −14 LUFS-I | ≤−1.0 dBTP | ≤1 MiB | silence |

Approval requires a decodable final MP3, EBU R128/true-peak measurements, correct cue mapping, and a human listen in the actual gameplay moment. A generated waveform, successful transcode, or manifest entry alone is not approval. Voice cloning, identifiable-performer imitation, third-party recordings/music, unclear reuse terms, clipping, missing text fallback, or a provider secret in public metadata causes rejection.

### 5.4 Video

All release-active MP4s target:

```yaml
video_delivery:
  container: mp4
  video_codec: h264
  pixel_format: yuv420p
  width: 960
  height: 540
  fps: 24
  faststart: true
  audio_codec_when_present: aac
  stage_transition_duration_seconds: 5.00
  stage_transition_duration_tolerance_seconds: 0.10
  stage_transition_max_kib: 512
  cinematic_max_duration_seconds: 60
  cinematic_max_mib: 8
```

Approval requires machine evidence for codec, pixel format, exact dimensions, frame rate, duration, byte count, and `moov` before `mdat`; a human reviews normal-speed and frame-step playback for identity drift, misleading tactical content, loop/cut discontinuity, and bright flashes. Stage clips are withheld for `prefers-reduced-motion`. Cinematics use player controls. Speech or meaningful audio requires synchronized VTT captions; narrative visual information requires a descriptive transcript. Decode failure must select still/text, never block a command or stage transition.

## 6. Rights, source, and provenance contract

Every **new or updated** asset has one complete record in `assets/media-manifest.json` or the run engineering resource manifest. A record is complete only when the following fields are present and truthful.

| Field | Requirement |
|---|---|
| Identity | `resource_id`, exact `runtime_filename`, `media_type`, `bytes`, lowercase 64-character `sha256`, status (`candidate`, `approved`, `rejected`, `rolled-back`) |
| Source | `source_kind` (`generated`, `procedural`, `recorded`, `licensed`, `legacy-unrecorded`), creator/operator, provider/tool, model/tool version, generation/job ID when available, creation date |
| Recipe | Exact prompt plus prompt ID **or** deterministic procedural recipe/script path, arguments/config, and tool versions; conversion tools are transforms, not authors |
| Inputs | Every source file/key art/GLB/audio file and its SHA-256; identity-sheet/canon reference where applicable |
| Derivation | Ordered transforms from source to runtime file, including rasterization/transcode/crop/normalization; output measurements |
| Rights | rights holder, terms/license URL or internal terms reference with consulted date, permitted runtime use, permitted public redistribution, commercial-use status, AI-output ownership/retention note where relevant |
| Restricted-content attestations | Original Abyssal Surge IP only; no named artist/style imitation; no recognizable voice/performer; no third-party recording, character, trademarked sound identity, or unlicensed source |
| Runtime | runtime references, cache tier, fallback path/copy, accessibility asset/copy, public beat |
| Review | reviewer name/role, review date, format verdict, rights verdict, visual/listen/playback verdict, final approval status |

Rules for unknown provenance:

- Unchanged legacy assets may remain explicitly `legacy-unrecorded`; do not invent a provider, prompt, author, or license.
- A **new or changed** asset with unknown provider, recipe, input hash, terms reference, redistribution status, or approver is **not public-beat eligible**.
- FFmpeg, Blender, a renderer, or a conversion script may be named as a transform but not as the creative rights source unless it actually generated the work procedurally and the full recipe is recorded.
- Public metadata contains no API key, token, private prompt containing secrets, local absolute path, account identifier, or provider credential.
- SHA-256 and byte count are measured from the exact committed runtime output after all transforms.

## 7. Proposed `engineering/resource-manifest.md` format

The engineering file may remain a human-reviewable index while `assets/media-manifest.json` remains the machine inventory. The recommended format is one release summary plus one block per changed resource:

```yaml
schema: abyssal-surge-resource-release/v1
run_id: 20260718-resource-refinement
public_beat: static-single-player-resource-refinement
rules_authority: campaign-state.js
rules_or_save_change_count: 0
cache:
  cache_name: <candidate cache name>
  core_bytes: <integer>
  optional_media_bytes: <integer>
  bridge_bytes_including_manifest: <integer>
  lazy_active_glb_bytes: <integer>
  worst_case_bytes: <integer>
  hard_cap_bytes: 167772160
resources:
  - resource_id: <stable id>
    runtime_filename: <relative path>
    media_type: <mime>
    bytes: <integer>
    sha256: <64 lowercase hex>
    family: <core|image|sprite-bridge|glb|audio-sfx|audio-narration|audio-music|video-stage|video-cinematic|caption>
    status: <candidate|approved|rejected|rolled-back>
    source:
      source_kind: <generated|procedural|recorded|licensed|legacy-unrecorded>
      provider_or_tool: <truthful name>
      model_or_version: <value or not-supplied>
      job_id: <value or not-supplied>
      created_at: <ISO-8601>
      operator: <role/name>
      prompt_id: <id or null>
      exact_prompt_or_recipe: <text/script+args>
      terms_reference: <URL/ref + consulted date>
      rights_holder: <name>
      public_redistribution: <allowed|not-allowed|unknown>
      commercial_use: <allowed|not-allowed|unknown>
    inputs:
      - filename: <relative path>
        sha256: <64 lowercase hex>
    delivery:
      cache_tier: <P0|P1|P2|P3|P4>
      runtime_references: [<source seam>]
      fallback: <exact text/still/silence/renderer path>
      accessibility: <alt/caption/transcript/reduced-motion rule>
    validation:
      commands: [<exact local command>]
      measured: {<codec/dimensions/fps/duration/loudness/pivot/clips>}
      format_verdict: <pass|fail>
      rights_verdict: <pass|fail>
      runtime_fallback_verdict: <pass|fail|not-run>
      reviewer: <role/name>
      reviewed_at: <ISO-8601>
rollback:
  previous_approved_revision: <revision id>
  previous_asset_hashes: [<filename=sha256>]
  trigger_ids: [<RB id>]
```

The release index should also contain a compact table:

`| resource_id | filename | family | bytes | cache tier | rights | format | fallback | approval | rollback hash |`

No row marked `unknown`, `fail`, or `not-run` in rights, required format, or required fallback may be promoted from `candidate` to `approved`.

## 8. Public-beat approval criteria

The Production Director may mark this resource beat ready only when all applicable gates are evidenced from the exact candidate revision:

1. **Scope/fairness:** `campaign-state.js` rule/save/replay behavior delta is **0**; payment/monetization/account/multiplayer additions are **0**; media-owned state transitions are **0**.
2. **Inventory:** **100%** of new/updated binary assets have exact path, bytes, SHA-256, source/recipe, rights fields, runtime seam, cache tier, fallback, reviewer, and decision. Hash or byte mismatches are **0**.
3. **Budgets:** every per-file, family, install-cache, lazy-GLB, and 160 MiB worst-case hard cap passes. P4 assets in service-worker cache lists are **0**.
4. **3D/bridge:** approved GLBs have ground-center tolerance within ±0.01 m, external image URL count **0**, missing declared clips **0**, and source/output hash mismatches **0**. Every active GLB identity has a working raster/Canvas fallback.
5. **Image/sprite:** hidden-rule count **0**, missing required alt/adjacent equivalent count **0**, and unsafe >3 Hz bright-flash findings **0**.
6. **Audio:** **100%** of changed active MP3s pass role format, duration, loudness, peak, byte, cue-map, human listen, and fallback checks; unclear rights/voice imitation/third-party recording findings are **0**.
7. **Video:** **100%** of changed active MP4s are H.264/yuv420p/960×540/24 fps/faststart and pass size/duration/playback/fallback review; missing required VTT/transcript or reduced-motion handling findings are **0**.
8. **Static/PWA delivery:** clean install boots the shell; failed optional media leaves a playable campaign; a second offline launch can reach the text/UI path; old cache names after activation are **0**.
9. **Human approvals:** one named content/rights approver and one named runtime/QA approver sign every promoted asset. Self-generation without independent review is insufficient.
10. **Public endpoint:** candidate revision, canonical static URL response, service-worker cache name, and rollback revision are recorded. A local-only file check does not approve the public beat.

## 9. Rollback criteria and release response

| ID | Quantitative trigger | Required response |
|---|---|---|
| RB-01 | Any new/updated asset has missing rights/source/recipe/approver field; redistribution or commercial-use status is `unknown`/`not-allowed`. | Remove the asset and all runtime/cache references; restore the last approved fallback. |
| RB-02 | Any committed file byte count or SHA-256 differs from its approved record. | Roll back the file/manifest pair; do not patch metadata to bless an unexplained file. |
| RB-03 | Core >2 MiB, optional install media >32 MiB, bridge >12 MiB, total install attempt >48 MiB, active lazy GLB >112 MiB, or worst-case persistent cache >160 MiB. | Remove/compress the newest additions or restore the previous approved asset set before release. |
| RB-04 | A GLB has >0 external image URLs, >0 missing clips, pivot outside ±0.01 m, wrong MIME, or no valid bridge/Canvas fallback. | Restore the previous GLB and bridge outputs as one unit. |
| RB-05 | Any changed audio/video fails required format, byte, loudness/peak, codec, fps, faststart, caption/transcript, or actual-playback check. | Remove runtime/cache mapping and fall back to text/still/silence; restore prior approved media if available. |
| RB-06 | Optional-media failure blocks install, campaign start, command input, stage completion, save/load, or replay. Allowed blocker count: **0**. | Roll back runtime/cache integration immediately; media remains out until failure injection passes. |
| RB-07 | Any non-zero rule, reward, cost, damage, RNG, timer gate, save, replay, payment, or monetization delta is attributable to this pass. | Reject the beat and restore the previous rules/runtime revision; resource work cannot authorize a balance/economy change. |
| RB-08 | Old `abyssal-surge-*` caches remaining after activation >0, or stale mixed-version asset observed once in a clean update scenario. | Restore prior asset references, issue a new cache-name bump, and repeat clean install/update/offline evidence. Never reuse the failed cache name. |
| RB-09 | Missing text/still/silence/Canvas fallback, missing reduced-motion suppression, or >3 Hz bright flash finding count >0. | Disable/remove the presentation asset and ship the existing fallback only. |
| RB-10 | Public candidate contains more than 1 promoted cinematic, 3 promoted stage clips, or 128 MiB of runtime-unreferenced candidate MP4 files. | Exclude superseded/non-runtime cuts from the release artifact; retain only production evidence outside the player delivery surface. |

Rollback is atomic by resource pair: binary output, source/bridge manifest entry, runtime reference, service-worker list, accessibility companion, and cache-name change move together. The previous approved revision/hash set is retained in the engineering manifest. The rollback target is the last known playable static single-player release; no degraded paid, online, or account-dependent mode is introduced.

## 10. Release evidence packet

The final handoff for this beat should contain only evidence, not optimistic status prose:

- candidate revision and canonical public URL;
- before/after byte table for every changed file and all cache tiers;
- SHA-256 check results for **100%** of new/updated assets;
- provenance/rights record and independent approval for every promoted asset;
- GLB pivot/embed/clip report and bridge source/output hash report;
- image/atlas dimension, alpha, hidden-rule, alt, and flash review;
- audio codec/sample-rate/channel/duration/LUFS-I/dBTP/size and in-context listen result;
- video codec/pixel-format/dimension/fps/duration/faststart/size, captions/transcript, reduced-motion, controls, and fallback result;
- clean install, optional-failure, update/old-cache deletion, offline second-launch, and fallback observations;
- the exact previous approved revision and hashes used by RB-01–RB-10.

Until those measurements exist, this document is the numeric release contract, not a claim that the resource-refinement public beat has passed.