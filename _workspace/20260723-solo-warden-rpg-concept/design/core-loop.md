# Core Loop — Bird's-Eye RPG Layer (G7 Numeric Model)

## 결정: 조감 카메라 전환에도 기본전투 100% 자동 해상 유지

플레이어 행위 주체성은 조준/락온이 아니라 **포메이션 스탠스**(전열/포대/분산)로 이전. 근거: `main_constraint#2` 4항목(결정론/edge-HUD/reduced-motion/오프라인저장) 중 3개가 수동 조준에 불리 — 자동 해상 유지가 유일하게 전 항목 통과.

## 포메이션 3슬롯 (정원 고정, §디렉터 결정 — 로드아웃 확장 이월)

| 스탠스 | 오프셋 | 주 효과 | 파생 FRONT |
|---|---|---|---|
| 전열(Vanguard) | 전방 좌우분산 1,400유닛 | 조기 교전 | 2 |
| 포대(Turret) | 후방 300유닛 밀집 | 지속 화력 최대 | 0 |
| 분산(Split) | 좌우 2,000+후방 300 | 측면 커버리지 | 1 |

전환 쿨다운 4초[TARGET]. FRONT(최대2/3)는 피격+DOWNED 가능(런스코프 리셋), BACK은 피격 불가.

## 수치 루프 모델

```yaml
core_loop_candidates:
  - id: vanguard-circuit
    role: primary
    period_s: 60
    period_band: [45, 90]
    actions_per_loop: 4        # 이동/스탠스전환/자동전투소모/보상확인
    reward_events_per_loop: 2  # XP임계값 스킬제안 + 포메이션유지보너스
    repeat_rate_proxy_target: 0.70
    label: TARGET
  - id: formation-assault
    role: nested-secondary
    period_s: 100
    period_band: [70, 160]
    actions_per_loop: 4        # 스카우트/포메이션커밋/자동전투해상/결과확인
    frequency_per_stage: "정예 1-2회 + 보스 1회"
    label: TARGET
```

## 변경/유지

**유지**: 10스테이지 순서·이름·`XP_GROWTH` 8단계·오브젝티브 페이즈 순서(gate-defense→echo-recovery→growth→occupation→extraction→boss-kill)·런/영구 상태 분리(포메이션 스탠스도 런 스코프).

**변경**: 고정 전장 전체 투영 → 조감 카메라 팔로우(시뮬 좌표계 불변, 렌더 어댑터만 교체). 동료 커맨더 스냅 → 3슬롯 포메이션. 신규 보상 이벤트(포메이션 유지 보너스, 기존 동료 일괄 수정자 패턴 재사용). 정예/보스 앞 스카우트+커밋 비트 내포(오브젝티브 순서 자체는 불변).

전체 근거: `design/lane-coreloop.md`, `engineering/lane-formation-sim.md`. 통합본: `design/UNIFIED-GDD.md` §2, §4.
