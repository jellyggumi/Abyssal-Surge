# 갓티보이미젠 컨셉시안 추가 5컷 (씬 0~7 확장)

**목적:** 기존 5종 기본안에 덧붙여, 씬 전환을 촘촘하게 지지하는 5개의 보조 컷을 제공한다. 각각 16:9 비율 기준.

## 공통 스타일

- **기본 키워드(필수):** `hyper-detailed concept art`, `cinematic lighting`, `cyberpunk dark fantasy`, `blue-violet spectral fire`, `dark liquid shadow aura`, `ultra contrast`
- **해상도 기본값:** `1024x576`(또는 16:9 변형)
- **부정 프롬프트 공통:** `cartoon, blurry, jpeg artifacts, logo, text, watermark, overexposed, underexposed, anatomical deformity`
- **샘플링 권장:** 컷당 3장, seed 다양화(`seed 101~106` 권장)
- **후처리 규칙:** `color split blue-violet / ember-red`, `grain + subtle motion grain`

## 6) 씬 0 브릿지 확장 컷 — 3단 게이트 경보
**EN Prompt**
`A cinematic still of a neon-lit coastal anti-air defense tower on edge of a collapsed city, distant sky rips open with a pulsing scar, hundreds of violet electrical sigils bloom across the cracked skyline, emergency markers flare over streets, wind lifts blue shadow smoke in spirals, ultra-detailed, photoreal cinematic composition, dramatic 16:9`

**Negative:** `cartoon, low detail, blurry, duplicated structures, soft focus`

**구도/의도:** 게이트 개방 이전의 선제 경보. 씬0-1 전환 시점의 긴장을 쌓는 장면.

## 7) 씬 0-1 전이 컷 — 잔류영혼이 수면으로 번짐
**EN Prompt**
`An isometric to cinematic hybrid view of a defeated shadow beast dissolving into a liquid-black residue pool on fractured asphalt, blue electric ripples spreading across the wet street in concentric rings, blue chains of light rising under the surface, one lone knight silhouette at far ridge watching in first-person anticipation, high contrast, volumetric fog, game trailer concept`

**Negative:** `bad hands, extra anatomy, logo, subtitle clutter`

**구도/의도:** `일어나라` 직전 대기감. 게이트 사태가 대전환으로 넘어가기 직전의 긴장.

## 8) 씬 1-2 전환 컷 — 거점 전선 분기
**EN Prompt**
`Top-down tactical frame of a fractured urban sector divided into control zones by glowing territorial lines, small shadow legion squads contesting an energy core node with pulsing runes, one path glowing blue for expansion and another bleeding red for retreat, cinematic map-like composition, dark fantasy / urban war-game aesthetic, extremely clear readable geometry`

**Negative:** `overly cluttered UI, random objects, washed-out colors, modern anime look`

**구도/의도:** 마력 거점 점령 상태를 게임UI 없이도 한눈에 이해하게 하는 상태 전이컷.

## 9) 씬 3 고강도 액션 컷 — 역습 라인 폭발
**EN Prompt**
`High-motion 16:9 cinematic battle split composition: shadow legion infantry surges from the center, a possessed knight performs quarter-view overhead slash with blue spectral wind trails, armored shadows crack open into smoky fragments then rebind, enemy fire and particle sparks suspended in slow shutter, dramatic perspective, dynamic composition`

**Negative:** `flat lighting, stiff pose, childlike appearance, blurry limbs`

**구도/의도:** 빙의 플레이 체험을 1차 전술 컷으로 확대. 플레이 유도성(조작 쾌감) 강화.

## 10) 씬 6 정점 컷 — 본영 접근과 역전 제스처
**EN Prompt**
`Wide wideshot of a colossal gate-spire fortress from low angle, shadow lord at center casting a huge inversion wave that flips colors for a brief instant, enemy formation stalls in shock, spectral chains and violet glass-like shock rings radiate outward, final boss arena atmosphere, heroic but ominous composition, 4k cinematic render`

**Negative:** `washed out palette, tiny hero, low contrast, extra characters`

**구도/의도:** 한타 전환점에서 역전 트리거가 가시화되는 피날레 장면, 씬4~6 경계.

---

### 실행 메모
- 추가 5컷은 `씬 0~7` 중간 전이에서 즉시 삽입 가능.
- 실제 런에서는 기본 5컷 + 확장 5컷 합쳐서 10컷을 후보군으로 두고, 장르 톤 유지도와 연출 밀도를 기준으로 2차 투표 후 최종 5컷 확정.
