# Presentation and input specification

**Navigation:** [production contract](../production/production-contract.md) · [core loop](core-loop.md) · [Stage 3 handoff](../production/handoffs/stage-3.md)

## Decisions

- Visual language: original high-contrast charcoal, ember orange, and abyss teal; abstract smoke ribbons and geometric breach light; no borrowed silhouettes or signature effects.
- Every major state change produces one text, icon, motion, and optional sound cue. Effects must not be the only information channel.
- Target feedback latency: ≤100 ms from accepted action to visible confirmation. This is a G4/G6 measurement target, not a current result.

## Keyboard/touch parity

| Semantic action | Keyboard | Touch-first control | Accessible label |
|---|---|---|---|
| Move/order | click / WASD focus movement | tap destination | `Move legion` |
| Target | click target / focus + Enter | tap target | `Target Ash Echo` |
| Arise | `Q` | persistent action button | `Arise from active soul pool` |
| Deploy | `1`–`3` then click | role tray then tap zone | `Deploy {role}` |
| Capture focus | `C` | objective card | `Focus Sable Relay` |
| Possess (Stage 2) | `Tab` | action button | `Possess selected ally` |
| Lord’s Domain (Stage 3) | `R` | guarded action button | `Activate Lord's Domain` |
| Tactical view | `Space` | map-toggle button | `Toggle tactical view` |
| Retry/save/export | visible buttons | visible buttons | explicit action label |

## Readability exit criteria

- Zero unresolved S1/S2 readability defects.
- All actions above have programmatic names and keyboard focus order.
- 320 CSS-pixel width remains usable without horizontal-page scrolling for core actions.
- Stage 3 G4 only passes with median structured immersion ≥4.0/5 and measured feedback latency ≤100 ms.

## Deliberate deferrals

Possession and Lord’s Domain are specified only as future action surfaces. Their final effects, cooldowns, costs, and visual score require Stage 2/3 validation.

## Cinematic production workflow (image-based)

### Production rule for cinematic assets

For stage-gated validation, all promo and narrative clips are produced in a staged image-based pipeline:

1. **Scene storyboard lock (design state machine alignment)**
   - Bind each game scene (`scene_id`) to a 3~4 second visual beat and state-transition metadata (cause, effect, fail-branch).
2. **Rough assembly (FFmpeg + image sequence)**
   - Render sequence at 24/30fps with deterministic timestamps so QA can compare frame boundaries against state transitions.
3. **Interaction polish (manual finish)**
   - Remotion-based transition layer, color grading, and VO/subtitle pass; keep a single source of truth JSON for timing.

### Survey-based stack decision

- `Remotion + @remotion/transitions`: highest deterministic control for long-form, reused scenes, and revision-heavy edits.
- `FFmpeg xfade`: fastest for first-pass demo and internal milestone verification.
- `Shotstack template API`: best for marketing variant expansion (language/copy variation) once storyboard is frozen.

Recommendation: choose **hybrid manual-finish** for this project so that gameplay-state-based cuts are reproducible while emotional polish remains fast.

### Required cinematic deliverables (for QA sign-off)

- 90-second trailer: 10-cut structure aligned to major scenes (0:00~2:10).
- Cut-level checks:
  - transition duration ≤0.5s average,
  - critical-action audio/visual sync within ±150ms,
  - on-screen hero CTA/minimum brand presence ≥2.5s,
  - no unresolved caption/sfx naming conflicts.

## 씨네마틱 영상 작성 실행 가이드 (이미지 기반, 내부 배포용)

### 제작 4단 요약

1. **컷 결정**: `scene_id`와 핵심 연출 포인트(고조/역전/해결) 기준으로 컷 개수를 고정한다.
2. **비주얼 소스 준비**: 컷당 최소 2개 이미지 후보 생성 후, 톤·카메라 연속성으로 채택한다.
3. **임시 렌더**: FFmpeg로 24/30fps 기준 합성하여 길이/동기화/전환을 먼저 검수한다.
4. **최종 폴리싱**: Remotion/편집 툴에서 전환 정밀도, 색보정, 자막·SFX를 수동 마무리한다.

### 최소 산출 규격

- 컷 템플릿 키: `shot_id`, `scene_id`, `duration`, `transition`, `audio_in`, `audio_out`
- 이미지 파일명: `##_shot##_v##_emotion##_v01.png`
- 자막 파일: CSV 기반 (컬럼: `scene_id,start_sec,end_sec,kr,en`)
- 시퀀스 길이: 90~130초

### 승인 게이트(요약)

- 컷 전환 평균 지연 0.5초 이내
- 오디오-영상 동기화 오차 ±150ms
- 핵심 텍스트 노출 1.2초 이상
- CTA/브랜드 노출 2.5초 이상

### Concept art prompt pack reference

- The concept prompt pack for this phase is saved at:
  - `design/concept-image-prompts-gotibo.md`
- Use it to generate 5 additional stills with your chosen image engine, then map each shot to the existing 10-cut cinematic framework.