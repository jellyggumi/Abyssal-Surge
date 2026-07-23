# Lane: Worldview — Dusk Warden 고유 성장의 세계관 통합

- run-id: `20260723-solo-warden-rpg-concept`
- lane: `designer` × 3 중 하나. 담당: **세계관/서사 통합** (Solo Leveling 구조 원칙의 캐논 이식, Kingshot 거점 픽션 접합, 신규 고유명사)
- 페르소나: `.claude/agents/game-designer.md` (Worldview and narrative consistency — `design/worldview.md`, G1 소스 오브 트루스)
- 대상 산출물: `design/worldview.md`로 director가 병합할 초안. 이 문서 자체가 최종본은 아니다.
- 형제 lane (중복 금지, 경계만 1줄로 교차 참조): `DesignerCoreLoop`(전투/코어루프 메커니즘, `design/lane-coreloop.md`), `DesignerRPGSystems`(스탯/스킬/인벤토리 수치 설계, `design/lane-rpgsystems.md`).
- 소스 경계: Solo Leveling·Kingshot·RPG 장르 용어는 **구조 원칙만** 참고. 고유명사·캐릭터·플롯·수치·UI는 일절 차용하지 않는다 (`docs/abyssal-command-defense-survivor-design.md`가 이미 확립한 동일 경계를 이 사이클에도 그대로 적용). [OBSERVED] `_workspace/20260723-solo-warden-rpg-concept/intake/production-brief.md:29-32`.

---

## 0. 기존 캐논 확인 (변경 없음, 근거 인용)

| 요소 | 현재 상태 | 근거 |
|---|---|---|
| 주인공 | **Dusk Warden** — 이름이 아니라 **직함**으로 읽히는 구조(성/이름이 아닌 "Warden"이 role 접미어) | [OBSERVED] `README.md:6`, `defense-catalog.js:231-234` |
| 적대 진영 지휘부 | **Moonless Court** — "명령망(command network)"을 통해 각 스테이지에 명령을 전파, Stage 3 `echo-throne`에 왕좌, Stage 10 `gate-zenith`에서 명령망이 끊김 | [OBSERVED] `defense-catalog.js:188-192, 230-234` |
| 잔존 영역 | **Echo Deep** — Stage 10 승리 후에도 "남는다(remains)"고 명시된 미정복 심층 영역 | [OBSERVED] `defense-catalog.js:231, 233` — "Gate Zenith에서 Moonless Court의 명령망이 Echo Deep과 맞닿는다" / "Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다." |
| 캠페인 구조 | 고정 10스테이지 (`cinder-span → veil-citadel → echo-throne → sunken-bastion → howling-sprawl → glass-necropolis → starless-canal → shattered-causeway → abyss-chancel → gate-zenith`), Stage 10 보스 승리 = 캠페인 완료 | [OBSERVED] `defense-catalog.js:175-236`, `docs/abyssal-command-defense-survivor-design.md:14-20` |
| 성장/동료 메커닉 | 정예 처치 → 추출 → 영구 동료("잔향" 기반 companion). 런 전용 스킬/레벨은 런 종료 시 초기화, 동료 해금만 영구 | [OBSERVED] `docs/abyssal-command-defense-survivor-design.md:17-22` |
| 핵심 동사 체인 | **hunt → extract → materialize → capture → assault** (bmad-gds worldview 백본, 대체 불가) | [OBSERVED] `intake/shared-reference-bundle.md:14-15` |
| 확장 경계 | `.survey/abyssal-command-systems-expansion/` — 백그라운드 전투 시뮬레이션 금지, 확률/가챠 보상 금지, 정착지 복귀는 결정론적 단일 정산만 | [OBSERVED] `intake/shared-reference-bundle.md:29-33` |
| 무과금 경계 | 실화폐 결제/광고/프리미엄 재화/계정/가챠 전면 금지 — 이 lane은 그런 콘텐츠를 만들지 않는다(대상 밖이지만 재확인) | [OBSERVED] `intake/production-brief.md:23-28` |

이 문서에서 새로 쓰는 모든 문장은 위 표의 캐논을 **바꾸지 않고 확장**한다. 이름 변경·세계관 교체·동사 체인 대체는 없다.

---

## 1. Solo Leveling 구조 원칙의 이식: "왜 Dusk Warden만 다르게 성장하는가"

### 1.1 설계 결정 (opinionated, 단일안)

Solo Leveling의 구조는 "차원 게이트 → 등급별 던전 → 관습적으로 성장하는 다수의 헌터 중 단 한 명만 비밀 시스템으로 고유 성장"이다. Abyssal 캐논에는 이미 이 구조의 절반이 존재한다: "관문(gate)"이 스테이지 단위 콘텐츠 경계로 이미 쓰이고 있고, "Dusk Warden"이라는 호칭 자체가 **직함**이라 "다른 Warden들이 존재한다"는 전제를 이미 깔고 있다(고유명사가 아니므로). 남은 갭은 딱 하나: **"다른 Warden들은 어떻게 성장하는가"**와 **"왜 Dusk Warden만 다른가"**에 대한 인월드 설명이 없다는 것. 이 갭만 원작 고유명사 없이 채운다.

**제안하는 인과관계 (1줄 요약):** Stage 10 `gate-zenith`에서 Moonless Court의 명령망이 끊긴 지점이 하필 Dusk Warden이 서 있던 자리였고, 그 절단면에서 Dusk Warden만 Echo Deep의 잔향을 **여과 없이** 직접 받아들이는 흔적을 얻었다. 다른 모든 Warden은 지금도 (끊어지기 전까지 유지되던) Court의 배급 체계를 통해 여과된 잔향만 배급받아 관습적으로 성장한다.

이 설명은 기존 승리 대사("Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다")를 **재해석이 아니라 후속 서사로 확장**한다 — 끊긴 것은 그대로 끊긴 채로 두고, "끊긴 순간 그 자리에 있던 사람에게 무슨 일이 있었는가"만 추가한다.

### 1.2 새로 필요한 최소 개념 2개 (본 절에서만 사용, 3장에서 정식 고유명사로 등록)

| 개념 | 역할 | 다른 Warden | Dusk Warden |
|---|---|---|---|
| 배급형 결속 (Ration Sigil이 매개) | 관습적 성장 경로 | Court의 명령망을 통해 등급별로 배급된 잔향만 흡수 → 계급 승급·장비 강화·수비대 지원 같은 **관습적 RPG 성장**(수치는 DesignerRPGSystems 소관) | 접근 불가 — Court 체계 밖에 있음 |
| 무매개 결속 (Deepmark가 매개) | 고유 성장 경로 | 접근 불가 | Gate Zenith 절단면에서 얻은 Deepmark를 통해 Echo Deep의 잔향을 여과 없이, **영구적으로** 직접 흡수 |

이 두 경로는 "Solo Leveling의 관습적 헌터 vs 고유 성장 헌터" 대비를 **원작 명칭 없이** 그대로 구현한다. 등급 문자(E~S 등)나 스킬트리 수치는 이 lane이 정하지 않는다 — DesignerRPGSystems 경계선(§6) 참조.

### 1.3 명확화: 다른 Warden은 동료(companion)가 아니다

다른 Warden(Warden Corps 소속)은 **NPC/세계 텍스처**이며, 기존 추출→영구 동료 메커닉의 신규 소스가 아니다. 동료는 지금처럼 정예 처치 후 추출된 "잔향"에서만 발생한다(`docs/abyssal-command-defense-survivor-design.md:18`). 다른 Warden을 동료화 가능한 리크루트 로스터로 오해하면 캠페인 계약을 깨므로, director 병합 시 이 구분을 반드시 유지해야 한다.

### 1.4 무엇이 새롭고 무엇이 보존되는가

| 항목 | 상태 | 비고 |
|---|---|---|
| Dusk Warden 이름/정체성 | **보존** | 이름 변경 없음 |
| Echo Deep, Moonless Court, Gate Zenith, 10스테이지 승리/패배 대사 | **보존** | 문구 자체는 1글자도 바꾸지 않음. 서사만 후속 확장 |
| "Warden"이 다수 존재한다는 전제 | **확장** (기존 직함 명사에서 필연적으로 도출, 신규 고유명사는 Warden Corps 하나뿐) | 원래도 암시돼 있던 것을 명문화 |
| 잔향(echo)이 두 갈래 경로(배급형/무매개)로 나뉜다는 설정 | **신규** | 원작 개념 아님, Abyssal의 "잔향/결속" 기존 어휘로만 구성 |
| Dusk Warden의 고유 성장 메커니즘(수치) | **신규, 이 lane은 손대지 않음** | DesignerRPGSystems 소관 |
| 원작(Solo Leveling) 고유명사/등급문자 체계/시스템 UI | **미차용** | 구조 원칙만 반영, 이름 없음 |

---

## 2. Kingshot 구조 원칙의 이식: Farwatch Hold — 런 사이에서 자라는 거점

### 2.1 설계 결정 (opinionated, 단일안)

Kingshot의 구조는 "거점 레벨이 병렬 건물 성장을 게이팅 → 영웅 로스터가 역할/스킬/장비로 성장 → 부대 등급 → 편성 기반 전투(탐사/원정/집결)"다. Abyssal 캠페인은 **고정 10스테이지**이므로 Kingshot의 "거점이 계속 자란다"는 축을 캠페인 자체에 심으면 스테이지 순서·수·승패 계약이 깨진다. 따라서 거점은 **캠페인과 별도 레이어**로 붙인다: 캠페인은 지금처럼 선형 10스테이지로 남고, 그 옆에 런과 런 사이에서 플레이어가 키우는 영구 거점 **Farwatch Hold**를 추가한다.

**위치 관계 (1줄 요약):** Farwatch Hold는 스테이지가 아니다 — 로비/캠프 화면에 해당하는 영구 레이어이며, 10스테이지 순서·승리 조건·Stage 10 캠페인 완료 정의를 전혀 바꾸지 않는다.

### 2.2 Farwatch Hold가 하는 일 (기능 영역, 고유명사 아님 — 설명용 소문자 라벨)

아래 기능 영역은 **이름을 확정하는 것이 아니라 존재 이유와 동사 체인 연결만 규정**한다. 정확한 건물명·업그레이드 트리·수치는 DesignerRPGSystems/DesignerCoreLoop 소관이다.

| 기능 영역(설명용, 고유명사 아님) | 동사 체인 연결 | 존재 이유 |
|---|---|---|
| 잔향 처리 구역 | extract → materialize | 추출된 정예 잔향을 영구 동료로 구현화하는 기존 메커닉의 "장소"를 부여 — 메커닉 자체는 변경 없음 |
| 배급 명부 구역 | materialize | 동료 로스터 열람/편성 — Kingshot의 "영웅 로스터" 구조 원칙을 companion 로스터에 대응시킴 (역할/스킬은 RPGSystems 소관) |
| Deepmark 성소 구역 | extract → materialize (Dusk Warden 전용) | Dusk Warden 고유 성장(§1.2)을 위한 전용 공간 — 동료 성장과 분리된 별도 성장 채널임을 공간적으로도 분리 |
| 전초 감시 구역 | capture → assault | 다음 원정지 선택/편성 확정 — Kingshot "원정" 구조 원칙의 PvE 단일 플레이어 대응(멀티플레이 아님) |

### 2.3 확장 경계 준수 (명시적 자가 점검)

- 백그라운드 전투 시뮬레이션 없음: Farwatch Hold의 어떤 구역도 오프라인/방치 중 자동 전투를 해석하지 않는다. 성장은 정착지 복귀 시 **결정론적 단일 정산**으로만 반영한다. [준수] `.survey/abyssal-command-systems-expansion/` 경계 재확인, 근거: `intake/shared-reference-bundle.md:29-33`.
- 확률/가챠 보상 없음: 잔향 처리 구역의 산출은 추출 성공이라는 확정 이벤트에서만 발생, 확률 상자·랜덤 뽑기를 도입하지 않는다.
- 실화폐 없음: Farwatch Hold의 모든 자원은 플레이 활동(사냥/추출/점유/돌격)에서만 발생 — PM lane의 "engagement point" 재해석과 합치.

### 2.4 무엇이 새롭고 무엇이 보존되는가

| 항목 | 상태 | 비고 |
|---|---|---|
| 10스테이지 순서/수/승패 정의 | **보존** | 손대지 않음 |
| "정착지 복귀 = 결정론적 단일 정산" 경계 | **보존** | 확장 서베이 경계 재확인 |
| 런과 런 사이 영구 거점이라는 레이어 자체 | **신규** | Kingshot 구조 원칙 이식, 이름은 Farwatch Hold(§3) |
| 거점 내부 기능 영역 4곳 | **신규, 기능만 규정 — 정식 명칭/수치 미확정** | RPGSystems/CoreLoop이 구체화 |
| 거점의 전투 해석 방식 | **보존 원칙 재확인** | 백그라운드 시뮬레이션·가챠 금지 |

---

## 3. 신규 고유명사 (전부 ORIGINAL — Solo Leveling·Kingshot·기타 서베이 대상에서 차용 없음)

| 고유명사 | 유형 | 한 줄 인월드 정의 | 원본 여부 |
|---|---|---|---|
| **Warden Corps** | 진영/기관 | "Warden"이라는 직함이 속한 제도 조직. Court의 명령망이 끊기기 전부터 잔향을 배급받아 등급을 승급시키던 다수의 관습적 Warden들의 소속처. | **ORIGINAL** — Solo Leveling·Kingshot 어디에도 없는 명칭, Abyssal의 "Warden" 호칭 갭을 메우기 위한 최소 신규 |
| **Ration Sigil** | 유물/상징물 | Warden Corps 소속원이 지니는, Court의 명령망을 통해 배급되는 잔향의 양과 등급을 정하는 인장. Dusk Warden은 더 이상 이 인장에 의존하지 않는다. | **ORIGINAL** |
| **Deepmark** | 유물/흔적 | Gate Zenith에서 명령망이 끊긴 절단면에 Dusk Warden 홀로 새겨진 흔적. 이 흔적을 통해 Echo Deep의 잔향을 여과 없이 영구적으로 흡수한다 — Dusk Warden의 고유 성장을 설명하는 유일한 인월드 장치. | **ORIGINAL** |
| **Farwatch Hold** | 장소 | Echo Deep 경계에 가까운 곳에 Dusk Warden이 세운 전초 거점. 런과 런 사이 플레이어가 성장시키는 영구 레이어의 인월드 명칭. | **ORIGINAL** |
| **Undertow** | 장소/현상 | Echo Deep 내부에서 Gate Zenith 쪽으로 계속 밀려오는 심층 잔향의 흐름. "Echo Deep은 남는다"는 기존 대사가 예고한, Stage 10 이후에도 끝나지 않는 압력의 이름. | **ORIGINAL** |

이 다섯 개 외에 이 문서는 어떤 새 고유명사도 도입하지 않는다. 위 표의 다섯 항목 모두 Solo Leveling·Kingshot·롤플레잉 게임 문서(`namu.wiki`, `wikipedia`) 어디에도 등장하지 않는 순수 신규 명칭임을 확인했다 — 본 lane 담당자가 3개 소스 원문을 직접 검색한 결과 동일 문자열 일치 없음. [OBSERVED, 자가 검증]

---

## 4. `design/worldview.md` 병합용 초안 (그대로 붙여넣기 가능한 절 단위)

> 아래는 director가 `design/worldview.md`에 절 단위로 병합할 수 있도록 완성 문장으로 작성한 초안이다. 기존 절을 대체하지 않고 추가하는 절로 설계했다.

### 세계 개요 (추가절: "명령망 절단 이후")

Stage 10 Gate Zenith에서 Moonless Court의 명령망은 끊겼다. 열 번째 봉쇄선은 유지되었고, Echo Deep은 남았다. 명령망이 끊기기 전까지 그것은 모든 Warden에게 잔향을 배급하는 유일한 통로였다. 끊긴 지금도 Warden Corps는 남은 배급 체계(Ration Sigil)로 관습적인 성장을 이어간다. 다만 절단이 일어난 바로 그 자리에 서 있던 Dusk Warden만은 다른 경로를 얻었다 — Deepmark라 불리는 흔적을 통해, 이제는 그 누구도 거치지 않는 Echo Deep의 잔향을 직접, 영구적으로 흡수한다.

### 진영 (추가절: Warden Corps)

Warden Corps는 Dusk Warden이 속했던, 그러나 이제는 같은 방식으로 성장하지 않는 제도 조직이다. Court의 명령망이 끊기기 전 확립된 배급 체계 위에서 여전히 관습적으로 승급한다 — 이는 세계 텍스처이며, 신규 동료 획득 경로가 아니다. 동료는 지금처럼 정예 처치 후 추출로만 얻는다.

### 장소 (추가절: Farwatch Hold, Undertow)

Farwatch Hold는 Echo Deep 경계 가까이 Dusk Warden이 세운 전초 거점이다. 캠페인 스테이지가 아니라, 런과 런 사이 플레이어가 키우는 영구 레이어다. Undertow는 Echo Deep 안쪽에서 계속 밀려오는 심층 잔향의 흐름이며, 열 번째 봉쇄선 이후에도 끝나지 않는 압력의 이름이다.

### 플레이어 캐릭터 (추가절: Dusk Warden의 고유성)

Dusk Warden은 이름이 아니라 직함이다 — Warden Corps 안에서 같은 직함을 쓰는 다른 이들이 존재한다는 뜻이다. 그러나 Gate Zenith의 절단면에서 얻은 Deepmark 때문에, Dusk Warden의 성장은 Warden Corps의 배급형 성장과 다른 경로를 따른다. 이 차이는 수치가 아니라 통로(mediated vs unmediated)의 차이다 — 실제 성장 수치는 `design/balance-sheet.md`(RPGSystems lane 기여분)에서 정의한다.

### 동사 체인 추적성 (추가절)

이 문서가 도입한 모든 신규/확장 로어 비트는 §5의 추적 표를 근거로 hunt → extract → materialize → capture → assault 다섯 동사 중 최소 하나에 명시적으로 연결된다. 경쟁하는 별도 세계관 축은 도입하지 않았다.

---

## 5. 동사 체인 추적성 감사표 (G1 근거)

| 신규/확장 로어 비트 | 연결되는 동사 | 근거 |
|---|---|---|
| Warden Corps의 관습적 성장(배급형 결속) | **hunt**(관습적 Warden도 사냥은 동일하게 수행), **extract**(배급형 잔향도 결국 사냥터에서 발생한 잔향의 파생) | §1.2 |
| Ration Sigil | **extract**(배급 체계가 매개하는 것도 결국 추출된 잔향의 배분) | §1.2, §3 |
| Deepmark / Dusk Warden 고유 성장 | **extract → materialize**(무매개 흡수도 결국 추출된 잔향이 재료; 그 잔향이 Dusk Warden 안에서 영구 능력으로 구현화됨) | §1.1–1.2 |
| Farwatch Hold — 잔향 처리 구역 | **extract → materialize** | §2.2 |
| Farwatch Hold — 배급 명부 구역 | **materialize** | §2.2 |
| Farwatch Hold — Deepmark 성소 구역 | **extract → materialize** | §2.2 |
| Farwatch Hold — 전초 감시 구역 | **capture → assault**(다음 원정의 점유·돌격 준비) | §2.2 |
| Undertow | **hunt**(Undertow가 압력을 밀어내는 대상 자체가 향후 사냥 콘텐츠의 근원), **assault**(Stage 10 이후 확장 시 최종 돌격 대상이 될 잠재적 축) — [TARGET], 이번 사이클 필수 구현 대상 아님, 캐논상 여지만 확보 | §3 |

100%의 신규 로어 비트가 다섯 동사 중 최소 하나에 연결됨을 확인했다. 경쟁하는 별도 동사 체인 또는 경쟁하는 세계관 축은 도입하지 않았다.

---

## 6. 자가 점검 (G1 gate-checkable, YAML)

```yaml
lane: worldview
target_artifact: design/worldview.md
g1_self_audit:
  canon_protagonist_renamed: false
  canon_nouns_preserved: [Dusk Warden, Echo Deep, Moonless Court, Gate Zenith, Cinder Span]
  canon_stage_lines_modified: 0
  verb_chain_replaced: false
  campaign_stage_count_unchanged: 10
  new_original_nouns_count: 5
  new_original_nouns_unmarked: 0
  borrowed_source_proper_nouns_used: 0
  companion_source_mechanic_changed: false
  monetization_content_introduced: false
  background_combat_simulation_introduced: false
  gacha_or_probabilistic_reward_introduced: false
  lore_beats_untraced_to_verb_chain: 0
  lore_violations_found: 0
```

---

## 7. 형제 lane 경계 (1줄씩, 중복 없이)

- **DesignerCoreLoop 경계**: 이 lane은 Farwatch Hold의 존재 이유·기능 영역·동사 체인 연결까지만 규정한다 — 순간 전투 해석, 이동/조준/스킬 발동 같은 코어루프 수치·타이밍은 전혀 다루지 않았으니 그쪽에서 정의.
- **DesignerRPGSystems 경계**: 이 lane은 "배급형 vs 무매개"라는 성장 **통로**의 서사적 차이만 규정한다 — 스탯/스킬트리/인벤토리/등급문자(E~S 등) 실제 수치와 밸런스 밴드는 전혀 다루지 않았으니 그쪽에서 정의.

---

## 디렉터 핸드오프 노트

가장 중요한 결정은 §1.1의 인과관계다 — "Dusk Warden만 고유하게 성장하는 이유"를 새 세계관 축이나 새 신비한 힘으로 만들지 않고, **기존 승리 대사가 이미 명시한 사건(Gate Zenith에서 명령망이 끊기고 Echo Deep이 남았다)의 연장선**으로만 설명했다. 즉 이 lane은 새 이야기를 쓴 게 아니라 이미 배포된 대사 한 줄("Echo Deep은 남는다")이 예고해 둔 여백을 채운 것이다. 병합 시 이 인과관계(절단 지점 = Deepmark 발생 지점)를 다른 lane이 다른 방식으로 재설명하지 않도록 고정해 달라 — 특히 Farwatch Hold를 "왜 지금 지을 수 있는가"의 서사적 정당성이 전부 여기(Deepmark로 인한 Echo Deep 직접 접근권)에 걸려 있다.
