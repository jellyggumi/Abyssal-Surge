# Mesh / Rig Refinement Report

- Cycle: `20260718-resource-refinement`
- Stage: Stage 1 — resource / presentation refinement
- Generator: `scripts/build_abyssal_command_assets.py`
- Blender: 5.1.2 headless (`/Applications/Blender.app/Contents/MacOS/Blender`)
- Output contract: 15 GLB (unit 5, boss 3, prop 4, terrain 3), embedded PNG, UV0 + tangent-space normal map + tangent attribute, ground-center pivot

## 변경 요약

기존 팩은 유닛 파트가 모두 단일 root 아래에 고정되어 있었고, clip별 변형도 root의 location / rotation / scale 2–3 channel에 집중되어 있었다. 갱신 팩은 선언 clip 어휘와 runtime root 소유권을 유지하면서 각 유닛에 `body-control`, `equipment-control` 두 개의 rigid-control Empty를 추가했다. 메시를 skinning하지 않고 파트를 두 control에 강체 parent하여 GLB 크기·런타임 복잡도를 제한했다.

- `Idle`: root 호흡에 body의 미세 lift/scale, 장비 sway를 합성한다.
- `Move`: root translation channel을 만들지 않아 X/Z 원점 고정 계약을 유지한다. body의 2-step bob/lean과 장비 counter-sway만 추가한다.
- `Strike`: root lunge에 body anticipation/follow-through와 장비 swing을 추가한다.
- `Special`: root 회전/scale에 body pulse와 장비 rotation/scale을 추가한다.
- `Defeat`: root fall에 body/장비의 서로 다른 secondary rotation을 추가한다.
- 결과적으로 unit clip의 GLB channel 수는 `Idle 6 / Move 5 / Strike 5 / Special 6 / Defeat 4`이며, 기존 clip 이름은 그대로 `Idle / Move / Strike / Special / Defeat`이다.

## 8방향 실루엣 정밀화

- **shade**: 좁은 후드/분할된 후방 cloak tail/좌우 sickle blade/어깨 spike를 X형 외곽선으로 구성했다. 정면 cyan visor와 후방 tail이 front/back 판독을 보조한다.
- **possessed**: 세로 halo를 주 외곽선으로 유지하고 좌우 크기·높이가 다른 crystal growth, 비대칭 chain, 세로 face-rift로 caster와 방향을 식별한다.
- **scout**: 팩에서 가장 낮고 좁은 체형으로 만들고, 한쪽 장창과 반대쪽 rear quiver/swept scarf를 배치해 빠른 lateral 판독성을 확보했다.
- **guard**: 넓은 사각 흉갑, 전면 octagonal tower shield/rim/boss, 반대쪽 장신 halberd, 양쪽 pauldron으로 안정적인 H형 실루엣을 만들었다.
- **reinforce**: 팩 최대 높이·footprint, horn crown, 큰 shoulder spike, planted feet, 과장된 lateral maul로 heavy archetype을 구분했다.

GLB를 재import한 뒤 asset root 바깥 preview pivot을 45도씩 회전하여 5 × 8 contact sheet를 국소 렌더했다. 정면/대각/측면/후면 모두에서 위 signature가 남고, 다섯 유닛 간 실루엣 중복이 관찰되지 않았다. 이 preview는 검사용 `/tmp/abyssal-unit-8dir/contact-sheet.png`이며 배포 자산에는 포함하지 않았다.

## 측정치

모든 치수는 build 시점의 rest-pose world AABB이며 단위는 Blender meter다. `min Z`는 15개 asset 모두 `0.0000`(표시상 `-0.0` 포함)이다.

| Unit | W | D | H | Mesh pieces | Vertices | Triangles | Ground offset applied | GLB bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| shade | 1.4626 | 0.9131 | 2.2615 | 11 | 109 | 174 | -0.008482 | 16,016,084 |
| possessed | 1.3683 | 0.9600 | 2.1250 | 10 | 183 | 330 | -0.130000 | 11,486,888 |
| scout | 1.2362 | 0.8648 | 2.0048 | 10 | 112 | 184 | -0.006341 | 17,164,312 |
| guard | 1.8734 | 0.6436 | 2.0350 | 11 | 144 | 248 | -0.240000 | 15,512,672 |
| reinforce | 2.0385 | 1.1800 | 2.6924 | 14 | 136 | 216 | -0.040000 | 20,235,260 |

Scale hierarchy is explicit: scout is the lowest/narrowest, shade/possessed occupy the light/medium band, guard is broad through shield/halberd, and reinforce is both tallest and widest.

### 15-asset pivot 오차 — authoring Z-up / runtime Y-up

오차 정의는 root 원점과 **전체 rest-pose mesh AABB**를 비교한다. Blender authoring 측정은 `|boundsMin.Z - root.Z|`를 ground 오차로, `|boundsCenter.X/Y - root.X/Y|`를 수평 오차로 사용한다. Runtime 측정은 GLB의 BIN chunk에서 모든 `POSITION` accessor를 decode하고 rest node world matrix를 적용한 뒤, glTF Y-up 기준 `|boundsMin.Y - root.Y|`, `|boundsCenter.X/Z - root.X/Z|`를 계산했다. Blender exporter의 축 변환은 `runtime (X,Y,Z) = Blender (X,Z,-Y)`다. 모든 GLB root translation은 정확히 `(0,0,0)`이다.

| Asset | Blender ground Z | Blender center X | Blender center Y | Runtime ground Y | Runtime center X | Runtime center Z | Runtime horizontal radial |
|---|---:|---:|---:|---:|---:|---:|---:|
| shade | 0.000000 | 0.000000 | 0.076550 | 0.000000 | 0.000000 | 0.076531 | 0.076531 |
| possessed | 0.000000 | 0.026350 | 0.050000 | 0.000000 | 0.000000 | 0.050000 | 0.050000 |
| scout | 0.000000 | 0.235000 | 0.132400 | 0.000000 | 0.237795 | 0.132397 | 0.272168 |
| guard | 0.000000 | 0.033300 | 0.051800 | 0.000000 | 0.033314 | 0.051785 | 0.061576 |
| reinforce | 0.000000 | 0.131050 | 0.050000 | 0.000000 | 0.144280 | 0.050000 | 0.152698 |
| cinder-warden | 0.000000 | 0.175300 | 0.000000 | 0.000000 | 0.175285 | 0.000000 | 0.175285 |
| veil-tactician | 0.000000 | 0.263000 | 0.000000 | 0.000000 | 0.262998 | 0.000000 | 0.262998 |
| gate-sovereign | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| rift-portal | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| command-obelisk | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| soul-extractor | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| echo-throne | 0.000000 | 0.000000 | 0.015000 | 0.000000 | 0.000000 | 0.015000 | 0.015000 |
| cinder-span | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| veil-citadel | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |
| echo-throne-steps | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0.000000 |

Ground 결과는 authoring 15/15와 runtime 15/15 모두 표시 정밀도 6자리에서 `0.000000`이며, raw runtime 최대치는 floating-point noise `3.2e-8 m`다. 전체 AABB 수평 중심의 최대 오차는 authoring `0.263000 m`, runtime radial `0.272168 m`다. 이 수평 편차는 root 또는 축 변환 드리프트가 아니라 scout의 한쪽 spear/quiver, reinforce의 maul, boss의 한쪽 장비처럼 8방향 판독을 위해 의도한 비대칭 장비가 전체 AABB를 끌어간 값이다. 즉 이 팩의 `ground-center`는 **ground plane 위 authored body/plinth center** 계약이며, full-equipment AABB centroid 계약은 아니다.

Authoring 수치는 회전된 각 object의 bound-box corner를 합친 보수적 envelope이고, runtime 수치는 실제 export vertex를 decode한 exact envelope라서 일부 수평 값에 작은 차이가 있다. Ground 결과는 두 방식이 일치한다.


## Provenance / hashes

`assets/models/abyssal-command/manifest.json` schema version 2 records the procedural recipe, Blender fps, generator path, per-GLB SHA-256, source `.blend` SHA-256, texture source paths, and albedo/normal SHA-256 values. The build does not modify `scripts/prepare_abyssal_command_textures.py`; existing texture sources and generated PBR maps are reused and embedded.

Source blend SHA-256: `0e7f6b051eaf6fb6d92d416bb53b934078d642266cde74864d23bc31b9e781b4`

| Unit GLB | SHA-256 |
|---|---|
| `units/shade.glb` | `af5253687c0e143ce2cb6046efcac10a758e012922f5a32578120edd9a29e231` |
| `units/possessed.glb` | `4e0ff1eca26f12be1e083cf65f02daaa6f3060f7efd511b92a59ba6c5b6d66ce` |
| `units/scout.glb` | `9e858b5cb0c2d5017c4498888412f11886b4514ee95f566f9545cd7fd3cc10ce` |
| `units/guard.glb` | `f823ff603fe2c71e2b5f7bb6fda6616c945326c185a235035a8f9a0ddc6e9819` |
| `units/reinforce.glb` | `0bcc891b237ac77fb061e726f51cd8811052ee82e30ad4235ff529203f9335bb` |

나머지 boss/prop/terrain GLB 10개의 SHA-256도 동일 manifest의 각 asset record에 기록되어 있다.

## 국소 검증

### Headless rebuild

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_abyssal_command_assets.py
```

Result: exit 0, `ABYSSAL_COMMAND_RESOURCE_PACK_READY assets=15`, source blend 저장 성공.

### Source blend load

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/models/abyssal-command/abyssal-command-resource-pack.blend --python-expr "import bpy; print('SOURCE_BLEND_CHECK', len(bpy.data.objects), len(bpy.data.actions), bpy.context.scene.get('version'))"
```

Result: exit 0, `SOURCE_BLEND_CHECK 137 92 2`.

### Asset contract test only

```sh
node --test tests/abyssal-command-assets.test.mjs
```

Result: 4/4 PASS. 검증 범위는 15-asset inventory/GLB 구조/embedded PNG, unit clip vocabulary 및 Move origin, normal-map binding + tangent attributes, Echo Throne terrain orientation이다.

### Direct GLB + manifest inspection

국소 Python GLB chunk inspector 결과:

- 15/15 GLB header/version/length 정상.
- manifest category count `unit 5 / boss 3 / prop 4 / terrain 3`.
- 15/15 manifest SHA-256가 실제 파일과 일치; source blend SHA-256 일치.
- 15/15 선언 action name이 GLB animation name과 정확히 일치.
- unit 5/5에 `body-control`, `equipment-control` node와 해당 secondary animation channel 존재.
- 모든 image가 `mimeType: image/png` + internal `bufferView`이며 외부 URI 없음.
- 모든 mesh primitive에 `TANGENT` attribute 존재.
- 모든 asset rest bounds `min Z = 0.0000`.

프로젝트 전체 테스트/린트/포매터는 실행하지 않았다.
