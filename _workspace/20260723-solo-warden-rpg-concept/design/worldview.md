# Worldview — Abyssal Surge (G1 Source of Truth)

이 문서는 기존 캐논(`docs/abyssal-command-defense-survivor-design.md`, `README.md`, `defense-catalog.js`)을 **대체하지 않고 확장**한다. 아래 신규 절은 전부 추가절이며, 기존 문구는 1글자도 변경하지 않았다.

## 기존 캐논 (변경 없음)

- **Dusk Warden**(주인공, 직함) · **Echo Deep**(잔존 심층 영역) · **Moonless Court**(적대 진영, 명령망) · **Gate Zenith**(Stage 10, 캠페인 완료 지점) · **Cinder Span**(Stage 1)
- 캠페인: `cinder-span → veil-citadel → echo-throne → sunken-bastion → howling-sprawl → glass-necropolis → starless-canal → shattered-causeway → abyss-chancel → gate-zenith` (10스테이지 고정)
- 검증 동사 체인: **hunt → extract → materialize → capture → assault**
- 승리 대사(원문 그대로, 확장만): "Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다."

## 추가절: 명령망 절단 이후

Stage 10 Gate Zenith에서 Moonless Court의 명령망은 끊겼다. 열 번째 봉쇄선은 유지되었고, Echo Deep은 남았다. 명령망이 끊기기 전까지 그것은 모든 Warden에게 잔향을 배급하는 유일한 통로였다. 끊긴 지금도 Warden Corps는 남은 배급 체계(Ration Sigil)로 관습적인 성장을 이어간다. 다만 절단이 일어난 바로 그 자리에 서 있던 Dusk Warden만은 다른 경로를 얻었다 — Deepmark라 불리는 흔적을 통해, 이제는 그 누구도 거치지 않는 Echo Deep의 잔향을 직접, 영구적으로 흡수한다.

## 추가절: 진영 — Warden Corps

Warden Corps는 Dusk Warden이 속했던, 그러나 이제는 같은 방식으로 성장하지 않는 제도 조직이다. Court의 명령망이 끊기기 전 확립된 배급 체계(Ration Sigil) 위에서 여전히 관습적으로 승급한다 — 이는 세계 텍스처이며, 신규 동료 획득 경로가 아니다. 동료는 지금처럼 정예 처치 후 추출로만 얻는다.

## 추가절: 장소 — Farwatch Hold, Undertow

**Farwatch Hold**는 Echo Deep 경계 가까이 Dusk Warden이 세운 전초 거점이다. 캠페인 스테이지가 아니라, 런과 런 사이 플레이어가 키우는 영구 레이어다. 기능 영역: 잔향 처리 구역(extract→materialize), 배급 명부 구역(동료 로스터), Deepmark 성소 구역(Warden 전용 성장), 전초 감시 구역(다음 원정 편성), **저지선 구역**(hunt→assault, Undertow 압력 방어 — §추가절 참조).

**Undertow**는 Echo Deep 안쪽에서 계속 밀려오는 심층 잔향의 흐름이며, 열 번째 봉쇄선 이후에도 끝나지 않는 압력의 이름이다. 이번 사이클에서 **저지선 구역**의 결정론적 단일 정산 메커닉으로 기계화한다(아래 참조) — Kingshot의 "거점 방어" 구조 원칙을 오프라인 전투 시뮬레이션 없이 이식.

## 추가절: 저지선 구역 — Undertow 압력의 결정론적 정산 (Kingshot 방어 구조 이식)

**동기**: 이 프로젝트의 킹샷 이식 초안(`intake/shared-reference-bundle.md`)이 "거점 성장" 축만 기록하고 킹샷의 "거점 방어(Defend Against Invasions)" 축을 누락했다는 사용자 지적을 반영한다. 킹샷 원본은 오프라인 실시간 침공을 시뮬레이션하지만, 이는 이 프로젝트의 기존 경계(`.survey/abyssal-command-systems-expansion/` — 백그라운드 전투 시뮬레이션 금지, 정착지 복귀는 결정론적 단일 정산만)와 정면 충돌한다. 따라서 "침공"이 아니라 **압력 정산**으로 재해석한다 — 실시간 전투가 아니라 기존 `settleIdleReturn()`(`campaign-state.js`)과 동일한 단일 함수 호출 정산이다.

**메커니즘 (결정론, RNG 0, 신규 화폐 없음)**:

1. **저지선 등급(Ward Level)** — 신규 상태 없이 기존 캠페인 필드에서 파생: `wardLevel = resolvedIds.length + floor(companionCollection.length / 2)`. 스테이지를 깨고 동료를 모을수록 자동으로 올라간다 — 별도 투자 자원 불필요(예산 40/41/10 세트를 건드리지 않음).
2. **압력(Pressure)** — 오프라인 경과 시간에 비례해 누적, 기존 `IDLE_RETURN_INTERVAL_MS`(60초)·`IDLE_RETURN_MAX_ELAPSED_MS`(8시간 상한)를 그대로 재사용: `pressure = min(floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8)` — 즉 1시간당 1압력, 최대 8(오프라인 8시간 이상 방치해도 더 늘지 않음, 기존 클럭조작 방지 로직도 그대로 상속).
3. **정산 판정** — 복귀 시 단일 비교: `pressure <= wardLevel` → **HELD**(저지선 유지, 평소대로 idle 진행도 적립). `pressure > wardLevel` → **ENCROACHED**(저지선 밀림) — 이번 정산 구간(`elapsedMs` 창)의 idle 진행도(`idleReturn.totalProgress`)는 **몰수(forfeit)** — 기존 `settleIdleReturn()`의 `NO_COMPLETED_STAGES` 분기와 동일하게 `lastSettledAt`은 갱신되고 그 구간은 소비 처리된다(소급 지급 아님, 다음 구간부터 재적립). **동료·장비·영구 성장은 별도 상태이므로 손실 없음**(기존 "동료 완전 상실 없음" 원칙과 동일 선상).
4. **복구** — 다음 스테이지 승리 시 자동으로 HELD 복귀(기존 DOWNED 런종료 리셋과 동일한 "다음 성공으로 자동 해소" 패턴). 별도 수리 자원·행동 불필요.

**밸런스 함의**: 캠페인 초반(wardLevel≈0)엔 거의 즉시 ENCROACHED 상태가 되지만 이 시점엔 적립할 idle 진행도 자체가 없어 실질 손해가 0에 가깝다 — 오히려 "저지선이 존재한다"를 플레이어에게 조기 학습시키는 튜토리얼 역할. 캠페인 완주(10스테이지+6동료, wardLevel=13)에 가까워질수록 압력 상한(8)을 영구히 넘지 못해 사실상 무적화 — "완전히 자리잡은 거점은 함락되지 않는다"는 주제와 정합. [TARGET, Stage2 QA 실측 필요]

```yaml
system: undertow-encroachment
derived_ward_level: "resolvedIds.length + floor(companionCollection.length / 2)"
pressure_formula: "min(floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8)"
pressure_cap: 8
outcome: "pressure > wardLevel ? ENCROACHED : HELD"
encroached_effect: "idleReturn.totalProgress 이번 정산 구간(elapsedMs) 몰수(forfeit) — settleIdleReturn()의 NO_COMPLETED_STAGES 분기와 동일 관용구, lastSettledAt 갱신+그 구간 소비, 소급지급 아님, 다음 구간부터 재적립. 동료/장비/영구성장은 손실 없음(별도 상태)"
recovery: "다음 스테이지 승리 시 자동 HELD (DOWNED 런종료 리셋과 동일 패턴)"
reused_constants: [IDLE_RETURN_INTERVAL_MS, IDLE_RETURN_MAX_ELAPSED_MS]
new_currency_introduced: false
background_simulation: false
data_mirror: "campaign-state.js settleIdleReturn() 확장 제안 — 미구현, 이번 사이클 문서만"
label: TARGET
```

## 추가절: 플레이어 캐릭터 — Dusk Warden의 고유성

Dusk Warden은 이름이 아니라 직함이다 — Warden Corps 안에서 같은 직함을 쓰는 다른 이들이 존재한다는 뜻이다. 그러나 Gate Zenith의 절단면에서 얻은 Deepmark 때문에, Dusk Warden의 성장은 Warden Corps의 배급형 성장과 다른 경로를 따른다. 이 차이는 수치가 아니라 통로(mediated vs unmediated)의 차이다 — 실제 성장 수치는 `design/balance-sheet.md`에서 정의한다.

## 신규 고유명사 목록 (전부 ORIGINAL, 원문 대조 확인 완료)

| 고유명사 | 유형 | 정의 |
|---|---|---|
| Warden Corps | 진영 | Ration Sigil로 관습 성장하는 다수 Warden의 소속 조직 |
| Ration Sigil | 유물 | Court 배급 잔향의 양·등급을 정하는 인장 |
| Deepmark | 유물 | Dusk Warden 고유 성장의 유일한 인월드 장치 |
| Farwatch Hold | 장소 | 런 사이 성장하는 영구 거점 |
| Undertow | 현상 | Stage 10 이후에도 끝나지 않는 압력 (확장용) |

## 동사 체인 추적성 (G1 근거)

| 로어 비트 | 연결 동사 |
|---|---|
| Warden Corps 관습 성장 | hunt, extract |
| Ration Sigil | extract |
| Deepmark / Warden 고유 성장 | extract → materialize |
| Farwatch Hold 5구역 | extract→materialize / materialize / extract→materialize / capture→assault / **hunt→assault(저지선)** |
| Undertow | hunt, assault — **저지선 구역 정산 메커닉으로 기계화 완료** |

```yaml
g1_self_audit:
  canon_protagonist_renamed: false
  canon_stage_lines_modified: 0
  verb_chain_replaced: false
  campaign_stage_count_unchanged: 10
  new_original_nouns_count: 5
  borrowed_source_proper_nouns_used: 0
  lore_beats_untraced_to_verb_chain: 0
```

전체 근거: `design/lane-worldview.md`, 통합본: `design/UNIFIED-GDD.md` §1.
