# GLB Raster Bridge Refinement Report

- Run: `20260718-resource-refinement`
- Stage: Stage 1 resource/presentation refinement
- Runtime contract: `glb-raster-pack-v1`
- Source manifest: `assets/models/abyssal-command/manifest.json`
- Runtime manifest: `assets/images/battle/glb/manifest.json`
- Generator: `scripts/render-8dir-atlas.py`
- Blender: 5.1.2, EEVEE Next, 16 render samples

## Result

MeshRigger의 최종 15개 GLB를 소비해 런타임용 PNG 45개를 재생성했다. 결과는 action atlas 42개와 terrain plate 3개이며 누락 action은 0개다. action atlas는 1024×512 RGBA PNG로, 128×128 cell을 8열×4행으로 배치한다. terrain plate는 128×128 RGBA PNG다. 전체 PNG 용량은 12,289,554 bytes다.

`assets/media-manifest.json`은 오디오·비디오 lane 충돌 방지를 위해 변경하지 않았다. 대신 bridge manifest가 각 입력 GLB와 출력 PNG의 경로, SHA-256, bytes, dimensions, action, frame samples, direction index, camera/framing, alpha 검증 결과를 machine-readable inventory로 보유한다.

## Render recipe and framing

- 투명 film과 RGBA PNG를 사용하며 런타임에는 GLB parser를 추가하지 않는다.
- clip frame은 1, 10, 20, 30을 샘플링한다.
- 방향 column은 `0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°` 순서이며 manifest의 `directionIndex`가 column과 yaw를 명시한다.
- 카메라는 30° elevation orthographic projection이다.
- 각 clip의 4개 frame과 8개 yaw에서 evaluated mesh silhouette을 합쳐 bounds를 계산하고, 10% transparent moat에 맞춰 scale과 고정 target height를 산출한다. 이 방식은 action 중 root translation을 추적하면서 frame별 camera bobbing과 기존 과도한 여백을 제거한다.
- 각 cell은 alpha가 비어 있거나 경계를 닿으면 생성 단계에서 실패한다. 최종 pack의 최소 edge padding은 12px이며 모든 action atlas가 8개 direction column과 8개 animated direction column을 기록했다.
- EEVEE render sample을 16으로 고정하고 asset 단위 chunk record를 즉시 기록해 headless 재생성의 결정성과 재시작 안전성을 높였다.

## Inventory

| Category | Asset | Clips |
|---|---|---|
| boss | `cinder-warden` | Attack, Defeat, Idle |
| boss | `gate-sovereign` | Attack, Defeat, Idle |
| boss | `veil-tactician` | Attack, Defeat, Idle |
| prop | `command-obelisk` | Activate, Idle |
| prop | `echo-throne` | Activate, Idle |
| prop | `rift-portal` | Activate, Idle |
| prop | `soul-extractor` | Activate, Idle |
| terrain | `cinder-span` | plate |
| terrain | `echo-throne-steps` | plate |
| terrain | `veil-citadel` | plate |
| unit | `guard` | Defeat, Idle, Move, Special, Strike |
| unit | `possessed` | Defeat, Idle, Move, Special, Strike |
| unit | `reinforce` | Defeat, Idle, Move, Special, Strike |
| unit | `scout` | Defeat, Idle, Move, Special, Strike |
| unit | `shade` | Defeat, Idle, Move, Special, Strike |

## Runtime selection and fallback

`battle-visualizer.js`는 계속 `assets/images/battle/glb/manifest.json`만 fetch한다. unit의 world-facing sector는 기존 `atlasFacing(facing) = (7 - facing) % 8` 변환을 거쳐 manifest column을 선택하고, movement/engagement 상태에서 Idle/Move/Strike를 선택하며 action gesture 동안 Special을 선택한다. 이번 pass에서 defeat 발생 시 `Defeat` clip을 무기한 latch하도록 selection을 보완해, engagement 해제 뒤 Idle로 되돌아가던 문제를 제거했다.

Bridge record/image가 없거나 malformed이면 기존 conceptual unit atlas, boss image, procedural shape 순서의 fallback이 유지된다. 이 표시 계층은 `campaign-state.js`의 규칙·결과·세이브·리플레이를 수정하지 않는다.

## Visual review

대표 표본 `shade__Strike`, `shade__Special`, `shade__Defeat`, `cinder-warden__Attack`, `rift-portal__Activate`를 atlas 전체 크기로 점검했다. 8개 yaw가 column 순서대로 유지되고, Strike/Special/Defeat의 silhouette 변화가 64px runtime draw size에서도 구분되며, boss/prop은 82px/52px draw size에서 cell crop 없이 읽힌다. 투명 moat와 고정 target height로 unit 발밑/prop base가 안정되고 defeat pose의 횡방향 확장이 cell 안에 남는다.

## Provenance and hashes

- Generator SHA-256: `d129c703ed143f30c3bee2d0a951ccba4c423170ed45544f110033f7eec2915f`
- Source manifest SHA-256: `5541199d690047a2edc1fe2dcaea216a312ddcaa0419274a47b8538ab7687919`
- Bridge manifest SHA-256: `d3609a878549974218871fd9867be25b482a7d5030d782a810efa9330af7a82c`
- Per-GLB input SHA-256 and per-PNG output SHA-256: `assets/images/battle/glb/manifest.json`의 45개 `records[].source.sha256` 및 `records[].output.sha256`

## Local verification

Publish command:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render-8dir-atlas.py -- --pack --project-root . --size 128 --publish --skip-media-manifest
```

Observed:

```text
GLB_RASTER_PACK assets=15 action_atlases=42 terrain_plates=3 outputs=45 manifest=.../assets/images/battle/glb/manifest.json media_manifest=skipped
```

Contract verification command:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render-8dir-atlas.py -- --verify --project-root .
```

Observed:

```text
GLB_RASTER_VERIFY records=45 action_atlases=42 terrain_plates=3 missing_actions=0 minimum_edge_padding_px=12 minimum_animated_direction_columns=8 manifest_sha256=d3609a878549974218871fd9867be25b482a7d5030d782a810efa9330af7a82c
```

Independent alpha-bound probe used ImageMagick crop geometry over all 45 PNGs and confirmed every 128×128 cell is non-empty with at least 12px transparent edge padding. A focused JS method harness drove both combatants from 1 HP through `updateEngagements(0.1)` and observed:

```json
{"defeated":2,"clips":["Defeat","Defeat"],"latched":true,"engagements":0}
```

No project-wide test, formatter, or linter was run.
