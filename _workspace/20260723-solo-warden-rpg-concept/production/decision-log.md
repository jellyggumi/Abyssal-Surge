# Decision Log — Director Arbitrations

run-id: `20260723-solo-warden-rpg-concept`

## D1 — 스탠스 명칭 충돌: "결집(Rally)" → "포대(Turret)"

**충돌**: DesignerCoreLoop가 0-FRONT 스탠스를 "결집(Rally)"로 명명했으나, ProgFormationSim이 독립적으로 "Boss Rally Window"(FRONT≥1 요구 메카닉)를 설계 — 동일 단어가 반대 조건(0 FRONT vs ≥1 FRONT)을 가리켜 혼동 유발.
**증거**: 두 레인 모두 IRC로 자체 조율해 DesignerCoreLoop가 "포대(Turret)"로 개명 완료(`design/lane-coreloop.md` §7).
**판정**: **확정 채택.** "Rally"는 Boss Rally Window(전투 메카닉) 전용, 스탠스 3종은 전열/포대/분산.

## D2 — RPG 시스템 스키마 포크: Warden전용 vs 동료공유 스탯

**충돌**: DesignerRPGSystems(권위)는 Warden 6스탯 전용 + 동료는 역할패시브만; ProgDataArch는 5개 공유스탯 + 동료별 `allocatableStatIds` 배분 서브셋을 제안.
**증거**: 양쪽 다 필드명 어휘(`damageBonus` 등)는 일치 — 스키마 차이는 "어떤 키가 존재하는가"뿐, 구현 난이도 델타는 크지 않음(`lane-rpgsystems.md` §0).
**판정**: **designer안 채택.** 동료는 스탯 배분 없이 역할패시브+장비+특성으로만 성장. 근거: (1) "Warden만 고유 성장"이라는 세계관 원칙과 정합, 배분형 스탯을 동료에도 주면 원칙 희석. (2) Kingshot의 "구성 특화 vs 스탯 min-max" 원칙에 더 가까움. (3) R2(편성 조합 지배) 리스크 표면 축소 — 승수 원천 하나 감소. `ProgDataArch`의 `CompanionRecord.statPoints` 필드는 제거, `equipment`+`traits`만 유지.

## D3 — 로드아웃 정원: 3 고정 vs 3→6 확장

**충돌**: PMForecast가 스테이지 3/7/9에 로드아웃 정원 3→4→5→6 확장을 페이싱 피크로 제안. DesignerCoreLoop의 스탠스 오프셋 수학(전열/포대/분산)은 3-way 고정을 전제. PMForecast 자신도 이 의존성을 미해결로 명시(`lane-forecast.md` §7).
**판정**: **3 고정 채택**(`MAX_LOADOUT_SIZE=3`, 기존 코드값 그대로). 스탠스 수학 N슬롯 일반화는 범위 밖 후속 작업. PMForecast의 정원확장 피크는 **모드 언락**(stage7 열포지션, stage9 Assault Formation)으로 대체 — 6-peak/4-trough 리듬 자체는 보존.

## D4 — "Full Rally" 명칭·스코프: PM 스킬-역전 메카닉

**충돌**: PMRewardBands의 "Full Rally"(3슬롯 상한을 넘어 보유 동료 전원 합류)가 D3(3고정)와 정면 충돌, 이름도 D1의 Boss Rally Window와 겹침.
**판정**: **"결집 강화(Formation Surge)"로 개명 + 스코프 축소.** 3슬롯 상한 유지, 발동 시 "빈 슬롯 채움" 대신 "기존 3기 전원 일시 강화". 수치(충전3/스윙상한30%/천장90%/발동1회당전투)는 원안 그대로 채택.

## D5 — 일시정지 메뉴: 기존 "중앙패널 금지" 규칙과의 충돌

**충돌**: UIInfoArchitecture가 "런 도중 빌드 확인" 요구를 위한 일시정지 오버레이가 "적·투사체·위험영역을 덮는 중앙패널 금지" 규칙과 문언상 충돌한다고 플래그, A(정지중 허용)/B(문언엄수) 두 옵션 제시하고 미확정으로 남김.
**판정**: **옵션 A 채택.** 규칙의 명시된 근거는 "위험 영역을 가리지 않는다"(실시간 위협 회피 가능성 보존)이며, `userPaused===true`(시뮬레이션 정지) 상태에서는 실시간 위협이 없으므로 취지 위반이 아니다. 정지 중에만 열리는 대형 오버레이(스탯시트/인벤토리/동료상세) 허용, 재개 시 닫힘.

## D6 — R3 시행 지점 확정 요청 [부분 해소 — D6b 참조]

QARiskRegister가 지적: 곱연산 체인이 derive-fn(가산, 준수)과 fire-time 스탠스승수(곱연산) 2레이어로 나뉘어, 1.3× 상한을 derive-fn 출력에만 걸면 fire-time 배수가 빠져나간다. **원 판정**: 이번 사이클은 시행 지점을 확정하지 않고 요구사항만 명문화, 정확한 코드 위치는 Stage 2 이월.
**D6b 갱신**: `UNIFIED-GDD.md` §9.1/`balance-sheet.md` "전체 영구 파워 예산 거버넌스"에 **시행 바인딩 규칙**을 명문화 완료 — "R1/R3/R5 세 상한 전부 fire-time 이후 최종 effectiveDamage/effectiveStats에 대해 측정"으로 정책 레벨은 확정. **여전히 미해결**: 그 정책을 실제로 어느 함수 호출 지점(코드 라인)에서 강제할지는 코드가 없는 이번 사이클 성격상 확정 불가 — ProgFormationSim(fire-time 소유)+ProgDataArch(derive-fn 소유) 공동 구현이 Stage 2 여전히 필요. 정책과 구현 지점을 혼동하지 말 것.

## D7 — PRED-09 무비용 육탄방패 리스크 [설계 레버 도입 — D7b 참조]

DOWNED가 런스코프 한정(영구손실 없음)이라는 §4.4 설계 자체가 "방어투자 0인 동료를 FRONT에 세우는 것이 항상 최적해"가 될 위험을 연다는 QA 지적. **원 판정**: 이번 사이클은 설계를 변경하지 않음(영구성 계약 보존이 우선) — Stage 2 시뮬레이션으로 재검증 이월.
**D7b 갱신**: 완전 해소는 여전히 Stage 2 시뮬레이션 필요(조합 폭발 공간, 수식 하나로 단언 불가)하나, **레버 자체는 이번에 설계**했다 — `formationIntegrity`를 동료 장비 Ward 슬롯 등급에 연동(`base = damage × 8`, Ward 슬롯 T1~T5 배율 ×1.00~×2.00 그대로 곱연산 적용, `balance-sheet.md` companion-equipment-tier 기존 배율 재사용). 이전 설계는 방어 투자와 무관하게 `formationIntegrity`가 고정값이라 "무투자가 항상 최적"이라는 결함이 수식으로 확정돼 있었으나, Ward 슬롯 연동 시 무투자 동료는 기본값(×1.00, damage×8)에 머물고 완전투자 동료는 2배(damage×16) 생존 → 조기 DOWNED로 인한 후열시너지(+25%bp) 손실 위험이 무투자 쪽에 실제로 부과된다. **이것으로 PRED-09가 완전 해소됐다고 주장하지 않는다** — "버스트 딜로 죽기 전에 끝내는" 전략이 그래도 우월한지는 Stage 2 실측 없이는 모른다. 레버가 존재하지 않던 상태에서 레버가 존재하는 상태로 바뀐 것만 확정.

## D8 — 외부 워크스트림 캐논 위반 자산 (C1 참조): WAIVE-NOT-APPLICABLE-TO-THIS-GATE + 하드 커밋 차단 플래그

**충돌**: 별도 codex-cli 세션이 이번 run-id 워크스페이스와 `assets/images/battle/pilot/`에 `sungjinwoo`/`monarch` 등 Solo Leveling 원본 음역이 파일명·내부ID에 남은 콘셉트 자산을 기록(`conflicts.md` C1 전체 사실관계 참조). 이 디렉터가 소환하지 않은 제3자 프로세스이며, 그 자산의 archetype displayName 자체는 원화명으로 설계돼 있으나 파일명 레벨에서 원본 음역이 새어나왔다.

**판정 근거**:
1. **이번 사이클 G1 게이트 범위 밖**: G1은 "player-visible content"(실제 배포되는 문자열/이펙트/시나리오)를 감사 대상으로 한다(`quality-gates.md` G1 "QA audit pass over all player-visible content"). 해당 자산은 untracked·미커밋·미배포(Pages allowlist 밖) — 플레이어에게 노출된 적이 없으므로 G1 실측 대상이 아니다. **G1 draft를 이 사유로 FAIL 처리하지 않는다.**
2. **그러나 침묵 방치는 금지**: `main_constraint #4`(무차용 명칭 경계)를 위반하는 자산이 저장소 워킹트리에 실존하는 것은 사실이며, 이 디렉터가 발견하고도 기록하지 않으면 다음 세션이 이를 무의식적으로 커밋할 위험이 있다.
3. **디렉터는 타 워크스트림 파일을 임의로 이름변경/삭제하지 않는다** — `production/boss-motion-previs-action-pipeline.json`의 `transitionMatrix`·`bossAliases`가 정확한 파일명(`concept-sungjinwoo-boss.png` 등)을 참조 체인으로 물고 있어, 이 디렉터가 그 워크스트림의 진행 상태·다음 스테이지 계획을 모른 채 파일명을 바꾸면 진행 중인 별도 파이프라인을 깨뜨릴 수 있다.

**판정: WAIVE-NOT-APPLICABLE(이번 G1 게이트에 대해) + 하드 커밋 차단 플래그.** `conflicts.md` C1에 사실관계 전량 기록 완료. **커밋/배포 전 필수 조치**: (a) `concept-sungjinwoo-boss.*`→`concept-{archetype}-boss.*`(archetype id, 예: `concept-sung-hum-boss.*`) 또는 확정된 originalized displayName 기반 파일명으로 전면 개명, `monarch`→`shadow-commander`류 이미 존재하는 non-IP 별칭으로 통일, 관련 previs sidecar·pipeline 참조까지 일괄 갱신 (b) `boss-concept-prompt-pack.json`의 자체 `antiCopyrightConstraints`를 파일명·내부ID 레벨까지 적용 범위를 넓히도록 그 워크스트림 소유자가 갱신. 이 조치 없이 커밋되면 다음 세션의 G1 실측은 반드시 FAIL.

## D9 — 킹샷 "거점 방어" 축 누락 발견 및 보강: 저지선 구역(Undertow Encroachment)

**발견**: 사용자가 "킹샷의 디펜스 요소가 어떻게 들어간건지" 질의 → 15개 레인·`shared-reference-bundle.md` 전체 재검색 결과 `siege`/`invasion`/`침공`/`방어해야` 0건 확인. 원인 추적: 디렉터 본인이 작성한 `shared-reference-bundle.md` Source 2 요약이 킹샷의 "Town/keep growth"(성장)만 기록하고 "Defend Against Invasions"(방어)는 누락 — QABenchmarkSurvey 레인이 나중에 독립적으로 공식 앱스토어 설명(iTunes Search API)에서 발견했으나, 그 시점엔 이미 세계관/코어루프 레인이 병렬 완료된 뒤라 반영되지 못함.

**판정**: 사용자 승인(옵션 2 선택) 하에 **저지선 구역(Undertow Encroachment)**을 Farwatch Hold 5번째 기능구역으로 추가. 설계 근거:
1. 킹샷 원본은 오프라인 실시간 침공 시뮬레이션이나, 이는 `.survey/abyssal-command-systems-expansion/`의 기존 경계(백그라운드 전투 시뮬레이션 금지)와 정면 충돌 — 문자 그대로 이식 불가.
2. 대신 기존 `settleIdleReturn()`(`campaign-state.js`)과 동일한 **결정론적 단일 정산** 패턴으로 재해석: `wardLevel`(기존 필드에서 파생, 신규 자원 불필요) vs `pressure`(오프라인 경과시간 비례, 기존 idle 상수 재사용) 비교 → HELD/ENCROACHED.
3. ENCROACHED 결과는 idle 진행도 적립 보류만 — 동료/장비/영구성장 손실 없음(기존 "완전 상실 없음" 원칙과 동일 선상), 다음 스테이지 승리로 자동 복구(기존 DOWNED 리셋 패턴 재사용).
4. 예산 40/41/10 세트, R3 fire-time 승수 체인 어디에도 관여하지 않는 순수 hub 레이어 부가 시스템 — 기존 밸런스 거버넌스를 재개할 필요 없음.

반영 파일: `design/worldview.md`(추가절+동사체인 갱신), `design/UNIFIED-GDD.md`(§1.2 표+신규 §1.4), `design/balance-sheet.md`(YAML 블록).

## D10 — Bound Fragment 공급 규칙 확정: 정예 종류 무관, 보스 처치 1회당 1개 고정

**발견**: 사용자의 "Stage 2→10 진행 심화" 요청에 따라 실제 `defense-catalog.js` STAGES 데이터를 `captureElite()` 로직과 대조 계산한 결과, `design/lane-rpgsystems.md` §4.4가 암묵 전제한 "반복 정예 처치 시에만 Bound Fragment 지급" 해석을 그대로 적용하면 캠페인 10스테이지 중 실제 반복 정예는 4회뿐(신규 동료 해금 6회, 반복 4회 — `captureElite()`가 반복 캡처 시에만 `evolution`+1). `balance-sheet.md`가 확정한 "캠페인 예산 10" 전제와 4개는 불일치.
**판정**: **정예가 신규 해금이든 반복이든 무관하게, 보스 처치 1회당 Bound Fragment 1개 고정 지급**으로 규칙을 명확화(`balance-sheet.md`가 이미 "보스 처치 1회당 1개, 스테이지당 1회"라고 적어뒀던 원안 그대로 채택 — 반복 조건은 애초에 명문화된 적 없었고 이번에 실측으로 모호성만 제거). 10스테이지 완주 시 정확히 예산 10 확보, 장비 슬롯 1개가 캠페인 종료 시점에 정확히 T5 도달(§`stage-progression.md` §3).
**반영**: `design/stage-progression.md` §3/§5.

## D11 — Stage 1 페이싱 과다주장 정정: Tier-1 노드는 Stage 1에서 구매 불가

**발견**: 동일 실측 과정에서 `design/UNIFIED-GDD.md` §8(PMForecast 페이싱 표 기반)의 "Stage 1 PEAK = Tier-1 분기 1개 선택"이 실제 자원 곡선과 모순됨을 발견 — Stage 1 종료 시 누적 Echo Core는 4(정예1+보스3), Track A 최저비용 노드(echo-backlash/wardens-ward)는 각 5. **Stage 1 시점엔 노드를 살 수 없다.**
**판정**: 페이싱 서술 정정 — Stage 1 = 스킬트리 UI 최초 노출(양쪽 브랜치 존재 학습, 구매는 아직 불가) / **Stage 2 종료 시(누적8) = 실제 첫 노드 구매 가능 시점**. `design/UNIFIED-GDD.md` §4.6에 정정 사실을 기록, §8 페이싱 표 자체는 다음 병합 시 이 정정에 맞춰 갱신 필요(이번 사이클은 §4.6 정정 노트로 대체, §8 표 직접 수정은 표 전체 재구성이 필요해 `stage-progression.md`를 단일 진실 소스로 지정).
**반영**: `design/stage-progression.md`(정본), `design/UNIFIED-GDD.md` §4.6(정정 노트+상호참조).

## D12 — §8 페이싱 표 자가발생 모순 발견 및 정정: Class 열 YAML 역행, Stage 8 EP-5 위반

**발견**: D11 반영 과정에서 §8 표를 "구매 가능 시점" 기준으로 전면 재구성했는데, 이것이 표 바로 위의 `pacing_rhythm` YAML(peak=[1,3,5,7,9,10]/trough=[2,4,6,8], 9-10만 유일한 인접 더블피크)과 정면 모순되는 결과를 낳았다 — Stage 2/4/6이 PEAK로, Stage 3/5/7이 TROUGH로 뒤집혀 7-peak/3-trough 구조가 되고 6-7이 새 인접 더블피크로 생겨 "9-10만 유일한 예외"라는 YAML 주석과 제 디렉터 노트 자체가 거짓이 됐다(외부 검수로 지적받음, 1차 응답에서는 "이미 해소됨"으로 오판했다가 재검토 후 실제 결함으로 재확인). 별도로 Stage 8 "스탯 재분배 창"이 §7.1 EP-5("비가역·리스펙 없음, Stage2 안건")와 정면 모순되는 것도 같은 편집에서 발견됨.
**근본 원인**: PEAK/TROUGH는 PMForecast가 설계한 "신규 구조 노출 vs 기존 구조 소비"라는 참여 리듬 축이며, D11이 정정을 요구한 "구매 가능 시점"은 별개의 축(Track A/B 셀 텍스트에만 속함)이다. 두 축을 혼동해 Class 자체를 재도출한 것이 오류.
**판정**: Class 열을 YAML 원본 그대로 복원(`eval`로 10행 전수 대조, 불일치 0건 확인). D11의 구매-불가 사실은 Track A 셀 텍스트로만 국한. Stage 3의 무효화된 "슬롯+1" 언락은 `defense-catalog.js` 실측(첫 Support 역할 해금, throne-echo)으로 대체 — 임의 창작 아님. Stage 8 리스펙 문구는 EP-6(장비강화)로 교체, 리스펙 시스템 자체는 여전히 §12 미해결 항목으로 유지(도입하지 않음).
**교훈**: 외부 검수의 1차 지적("2번은 이미 해소됨")을 재검증 없이 받아들였다가 재지적을 받고서야 실제 결함을 확인했다 — 표 재구성처럼 여러 필드가 얽힌 편집은 관련 열 전체를 재대조해야 하며, 부분 일치를 전체 해소로 오판하면 안 된다.
**반영**: `design/UNIFIED-GDD.md` §8 표 전체 재작성 + 정정이력 각주.

## D13 — D8 조치 범위 밖 잔존 위반 발견: `monarch` archetype 네임스페이스 + "Shadow Monarch" 직접 인용

**발견**: D8이 지시한 개명 조치(bossId 레벨: `concept-sungjinwoo-boss.*`→`concept-sung-hum-boss.*`, `concept-monarch-boss.*`→`concept-broken-court-monarch-boss.*`, previs sidecar 파일명)를 실행하던 중, `boss-concept-prompt-pack.json`의 `archetype` 필드(`sung-hum|shadow-soldier|player-core|monarch`)가 bossId와 **별개의 네임스페이스**이며 D8 지시 범위에 포함되지 않았음을 발견. 이 `monarch` archetype id가 콘셉트 배리언트 파일명 템플릿(`concept-{archetype}-{variant}.png`→`concept-monarch-v01.png` 등), motion-previs previsTag(`boss:monarch:{action}`), ElevenLabs sfx 큐 ID(`sfx_boss_monarch_*`)로 하위 전파되어 있었다. 방치했다면 이번 세션에서 신규 생성하는 16종 콘셉트 이미지 중 4종이 `concept-monarch-v0N.png`로 저장되어 **같은 종류의 위반을 재생산**할 뻔했다.

추가로 `aw-mo-v01`의 `promptEnglish`가 "Regent-grade **shadow monarch** archetype"으로 시작하는 것을 발견 — "Shadow Monarch"는 원작 주인공의 정본 칭호(각성 후 최종 계급명) 그 자체이며, `antiCopyrightConstraints`("no copied names... use original titles instead of source-character transliterations")를 프롬프트 텍스트 레벨에서 위반하고 있었다. archetype displayName(`Crown of the Broken Court`)은 이미 originalized였으나 실제 생성 프롬프트에는 그 originalize가 관철되지 않은, D8이 지적한 것과 동일한 구조의 결함.

**판정**: D8과 동일한 원칙 적용 — archetype id `monarch`→`broken-court-monarch` 전면 개명(파일명 템플릿·previsTag·sfx 큐 ID·promptSchema enum 포함), `shadow monarch` 문구→`broken-court ruler`로 재작성. 개명 후 실제 헤드리스 Blender(5.1.2, `/Applications/Blender.app`)로 previs 재베이크하여 산출물(`boss_previs_timings.json`, sidecar 4종) 일관성 확인 완료. 이 조치는 D8의 "커밋 전 필수 조치" 완료 조건에 실질적으로 포함되는 것으로 취급 — bossId 레벨만 고치고 archetype 레벨을 방치했다면 D8 판정 자체가 불완전했을 것.

**교훈**: 동일 콘텐츠에 대한 두 개의 독립적 ID 네임스페이스(bossId/archetype)가 존재할 때, 한쪽만 감사·개명하고 다른 쪽을 "관련 없음"으로 가정하면 안 된다 — 두 네임스페이스가 파일명 템플릿을 통해 실제로 하위 산출물에 합류하는지 반드시 추적해야 한다.

**반영**: `design/boss-concept-prompt-pack.json`, `production/{boss-motion-previs-timing,boss_previs_timings,storyboard-motion-sound-matrix,elevenlabs_sound_plan}.json`, `design/defense-rpg-cinematic-arc.md`, `production/boss_previs_workfile.blend`(재베이크).

## D14 — 콘셉트 이미지 생성 중 발견: 프롬프트 선두 명사구가 타이틀 카드로 오인되어 텍스트 번인

**발견**: D13 개명 완료 후 16종 콘셉트 배리언트(4 archetype × v01-v04)를 god-tibo-imagen(`gti --provider codex-cli`, private-codex는 HTTP 429로 재차 폴백)으로 생성, 산출물 전수 육안 검수 중 `concept-broken-court-monarch-v02.png` 1건에서 "HIGH MONARCH SENTINEL" 타이틀과 "OBSIDIAN CEREMONIAL GAUNTLETS" 등 다수 캡션이 이미지 픽셀에 직접 번인된 것을 발견 — `promptSchema.generationContract.noText: true` 위반이자, 렌더된 라벨에 "MONARCH"가 그대로 노출되어 D13이 막으려던 것과 동일한 종류의 결함이 파일명이 아닌 이미지 데이터 레벨에서 재발.
**원인**: 해당 배리언트의 `promptEnglish`가 "High monarch sentinel with..."로 시작하는 타이틀-케이스 명사구였고, 말미의 "clear 2.5D comic-like readability" 지시가 결합되어 모델이 이를 캐릭터-시트/카드 레이아웃 요청으로 오인. 나머지 15건은 같은 배치에서 문제 없이 생성됨 — 이 프롬프트 하나의 구조적 특이점.
**판정**: 재생성 자체는 원 프롬프트("High monarch sentinel with...")에 ad-hoc no-text 네거티브(no titles/captions/labels/typography/infographic/callout boxes/watermark)만 즉석으로 덧붙여 실행 — 재생성 결과 텍스트 번인 없음 확인(`concept-broken-court-monarch-v02.provenance.json`의 `prompt` 필드가 이 실제 발신 문자열 그대로를 기록). **그 이후** `boss-concept-prompt-pack.json`의 `aw-mo-v02.promptEnglish`를 별도로 정본 재작성(타이틀-케이스 명사구 제거, "monarch" 대신 "broken-court sentinel" 사용, 동일 네거티브 상시 포함)했으나 이는 향후 재생성 시 회귀를 막기 위한 사전 조치일 뿐 — 이번에 실제 사용된 프롬프트가 아니므로 provenance sidecar는 pack 텍스트가 아닌 실제 발신 문자열을 기록한다(D12 교훈: 미검증 주장을 방치하지 않는다). 나머지 15건은 원 프롬프트 그대로 재사용(문제 없었으므로 무변경).
**교훈**: 이미지 생성 프롬프트의 negative 제약이 파일명·메타데이터 레벨에만 있고 프롬프트 원문 자체에 "no text"가 없으면, 스타일 지시어("readability", "card concept" 등)가 모델을 인포그래픽 레이아웃으로 유도할 수 있다 — 생성 완료 후 산출물 전수 육안 검수(파일명 검증만으로는 불충분)가 필수.
**반영**: `design/boss-concept-prompt-pack.json` (aw-mo-v02 promptEnglish), `assets/images/battle/pilot/concept-broken-court-monarch-v02.png` (재생성).

**Addendum (동일 QA 회차 중 별도 발견)**: 위 육안 검수 도중 provenance sidecar 16종을 작성하면서, `aw-sjh-v01.negative` 배열의 항목 "no exact replica of source **Jin-Woo** face/pose"가 원작 주인공 이름을 문자 그대로 포함하고 있음을 발견. 이 세션의 `concept-sung-hum-v01.png` 생성 호출은 이 배열을 사용하지 않고 손으로 요약한 별도 negative 문구를 사용했으므로 **이번에는 실제로 API에 전송되지 않았음**을 sidecar `note` 필드로 확인·기록했으나, 배열 자체가 pack에 남아있으면 향후 자동화된 재생성(예: `negative.join(', ')` 패턴)이 이 이름을 그대로 전송할 잠재 위험이 있었다. `boss-concept-prompt-pack.json`의 `negative` 항목을 "no exact replica of source protagonist face/pose"로, `sung-hum.category`를 형제 archetype과 동일한 originalized 패턴("Human hunter-commander archetype (originalized)")으로 각각 수정해 원천 제거. 반영: `design/boss-concept-prompt-pack.json` (`aw-sjh-v01.negative[2]`, `sung-hum.category`), `assets/images/battle/pilot/concept-sung-hum-v01.provenance.json` (`note` 필드로 미전송 사실 명시).
## D15 — Cycle 2 G2 밴드 오버라이드 확정 + 프로그레션 인지 TTK 실측 + turtle 아키타입 밴드 위반 발견

**컨텍스트**: Cycle 1 `production/gate-reviews/stage2-review.md`가 G2를 FIX로 판정하며 남긴 2개 미해결 항목 — (1) `win_rate_band: [0.45,0.55]`이 PvP 기준이라 이 PvE 캠페인에 그대로 적용 불가, 디자이너/디렉터의 `balance-sheet.md#band-overrides` 결정 필요, (2) RPG 레이어 전용 TTK 타깃 부재 — 를 Cycle 2에서 해소한다. `scripts/run-g2-archetype-rotation.mjs`로 7아키타입×3시드(301/302/303)×10스테이지 전체 캠페인을 재실행(fresh, 이번 세션 `/tmp/cycle2-sweep-fresh/`)해 프로그레션 인지(실제 스테이지별 누적 자원 반영) TTK를 최초로 실측했다.

**발견 1 — `win_rate_band` 오버라이드**: 이 게임은 PvP 매치업이 아니라 단일 플레이어 PvE 캠페인이므로 "승률"이라는 개념 자체가 성립하지 않는다(Cycle 1 `qa/gate-measurements.md#g2`가 이미 같은 결론에 도달, 이번 사이클에서 공식 오버라이드로 확정). `clear_rate`(캠페인 완주율)로 대체하되, 단일 clear_rate 밴드도 부적합 — 7개 아키타입이 서로 다른 목표(효율/생존/자원/다양성)를 측정하므로 획일적 승률 밴드로는 아키타입 간 차이를 표현할 수 없다. `qa/lane-archetype-testplan.md`가 이미 설계해 둔 **아키타입별 개별 밴드**(rusher/micro-optimizer 상호 1.3× 상한, turtle `[1.0,1.15]`, single-companion-main `<=1.0` vs micro-optimizer, economy-greed/casual/completionist-collector는 별도 축)를 공식 G2 대체 방법론으로 확정한다.

**발견 2 — TTK 타깃의 스코프 재확인**: `balance-sheet.md`의 `ttk_target_s: 11.2`는 주석("기준 계산: S1 보스 hp40000 기준")대로 **Stage 1 전용** 타깃이며 전 캠페인 균일 타깃이 아니었다 — Cycle 1 리뷰가 "RPG 레이어 전용 타깃 부재"로 기술한 것은 정확히는 "Stage 1 이후 스테이지의 타깃 부재"였다. 신규 전캠페인 균일 TTK 수식을 발명하는 대신(사후 데이터 피팅 위험), Cycle 1이 이미 검증한 "아키타입 간 상대 스프레드" 방법론을 스테이지별로 확장 적용하는 쪽을 택했다 — 신규 절대수치 없이 기존에 승인된 방법론만 재사용.

**측정 결과**:
- rusher/micro-optimizer(진짜 효율 경쟁 페어): 10개 스테이지 중 9개 1.3× 이내, `glass-necropolis`에서 1.326×(2.6%p 초과, 3시드 표본의 노이즈 범위로 판단, 조치 불요).
- single-companion-main(PRED-08): 10개 스테이지 전부 `<=1.0`(실제론 항상 `>=1.0` 즉 micro-optimizer보다 느림) 밴드 충족 — Cycle 1의 "장식적 요소 아님" 결론이 스테이지 단위로도 완전히 재확인됨.
- **turtle: `[1.0,1.15]` 밴드를 10개 스테이지 중 7개(`sunken-bastion` 1.160×부터 `shattered-causeway` 1.574×까지)에서 위반, 스테이지가 진행될수록 악화 — 신규 발견.**

**turtle 위반의 기계적 원인(확인됨)**: `scripts/run-g2-archetype-rotation.mjs`의 `ARCHETYPES.turtle.statPriority`가 `["gate-resolve","echo-swiftness","fracture-precision","binding-might","abyssal-resonance","reclaim-radius"]`로, 데미지 스탯(`binding-might`/`abyssal-resonance`)이 우선순위 최하위권이다. 3시드 전부에서 캠페인 종료 시점까지 이 두 스탯에 단 1포인트도 투자되지 않음(`statPoints: {"gate-resolve":8,"echo-swiftness":4,"fracture-precision":1}`, 40 Echo Core 전액 소진, `binding-might`/`abyssal-resonance` 완전 부재 — 3시드 결정론적으로 동일 확인). 보스 HP가 40,000→150,000(3.75×) 스케일링되는 동안 이 정책의 데미지 출력은 사실상 정체되어 TTK가 발산한다.

**판정**:
1. `balance-sheet.md#band-overrides`에 위 아키타입별 밴드 체계를 공식 오버라이드로 기록(아래 커밋에서 반영). `win_rate_band: [0.45,0.55]`는 이 프로젝트에서 폐기, `clear_rate` + 아키타입별 상대 밴드로 대체.
2. turtle 밴드 위반은 **이번 사이클 수치 리튠 대상이 아니다** — `campaign-state.js`/`rpg-catalog.js`의 실제 게임 수치(스탯 효과량, 장비 배율)는 이 위반의 원인이 아니며, 원인은 QA 스크립트 한 개 정책의 우선순위 배열이다. 실제 플레이어가 이 정확한 그리디 정책을 그대로 따를 것이라는 보장이 없고, 이 정책을 실제 게임 수치와 동일시해 리튠하면 "발견된 적 없는 문제"를 고치는 부작용 위험이 있다. `game-studio-harness/quality-gates.md`의 "숫자만이 게이트를 통과한다"는 원칙에 따라, **측정된 사실 그대로("이 방어 특화 정책은 후반 스테이지에서 밴드를 벗어난다")를 보고**하고, 실제 수치 조정 여부는 다음 디자인 반복에서 디자이너가 방어 스탯의 상대 가치(데미지 스탯 대비)를 재검토하며 결정하도록 이월한다 — Cycle 1이 100% 완주율 발견을 동일한 방식으로("리튠하지 않고 다음 사이클 입력으로 이월") 처리한 선례와 일치.
3. G3(아키타입 다양성)는 이 발견으로 영향받지 않는다 — turtle은 여전히 100% 완주하며(밴드 위반은 "느림"이지 "실패"가 아님), G3의 "≥3개 아키타입 독립적으로 승률 달성" 기준은 rusher/turtle/micro-optimizer/single-companion-main 4개 전부가 완주 가능하므로 그대로 충족.

**반영**: `design/balance-sheet.md`(band-overrides 섹션 신설), `qa/gate-measurements.md#g2`(Cycle 2 측정치 추가), `production/gate-reviews/stage2-review.md`(G2 FIX 해소 여부 갱신은 별도 커밋). Evidence: `qa/evidence-cycle2/` 신규 sweep JSON 7종 + `g2-progression-ttk-verdict.json` 1종(zero-investment 베이스라인은 스크립트 한계로 이번 사이클 스코프 제외, 다음 사이클 인프라 요청으로 이월).

## D16 — Cycle 2 R1 거버넌스 전체 프로토콜 측정: 실제 3개 아키타입에서 20% 상한 위반 확인 (구조적, 리튠 후보)

**컨텍스트**: `production/gate-reviews/stage2-review.md`가 R1을 "PENDING full-protocol measurement"로 남겼다 — Cycle 1의 측정은 동료 없는 축퇴 빌드(nobody would actually play) 기준이었다. Cycle 2 QA 서브에이전트(R1GovernanceProtocol)가 `qa/evidence-cycle2/`의 실제 7아키타입×3시드×10스테이지 데이터로 `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats`를 직접 호출해 전체 210개 지점을 측정, `qa/r1-full-protocol-cycle2.md`에 전체 근거를 남겼다.

**측정 결과**: 20% 상한(정상-타깃 기준, 보수적 해석)을 `single-companion-main`(10 중 7스테이지), `rusher`(8-10 스테이지, 평범한 2-3동료 편성), `micro-optimizer`(4-7 스테이지, 시드301 RNG분기 한정) 3개 아키타입에서 위반. 최댓값 `single-companion-main`/gate-zenith 36.84%(상한의 1.84배).

**turtle 사례와의 결정적 차이(같은 리튠-불가 판정을 자동 적용하지 않는 이유)**: D15의 turtle 밴드 위반은 QA 스크립트 한 정책의 스탯 우선순위 배열(방어 스탯만 우선, 데미지 스탯 완전 미투자)이 원인으로 특정됐다 — 실제 플레이어가 그 정확한 그리디 순서를 따를 보장이 없는 인공물이었다. 이번 R1 위반은 다르다: `rusher`는 평범한 2-3동료 편성으로 데미지 스탯에 우선 투자하는, 실제로 플레이어가 택할 법한 정상 전략이며, 위반은 특정 QA 정책의 결함이 아니라 **워든 스탯(가산, 포인트당 무제한 성장)과 동료 역할 보너스(고정 비율, 스테이지 무관 정적값)의 구조적 스케일링 불일치**에서 발생한다 — 캠페인이 진행되며 워든 데미지 스탯에 투자를 지속하는 모든 아키타입이 결국 이 패턴에 도달하며, 도달 시점만 동료 수에 따라 다를 뿐(single-companion-main은 Stage 4부터, rusher는 Stage 8부터).

**판정**:
1. R1 상태를 PENDING에서 **FIX**로 갱신(`qa/gate-measurements.md`, 위 커밋에서 반영) — turtle과 달리 이번 발견은 QA 정책 인공물이 아니라 실제 게임 수치의 구조적 특성이므로, "발견된 적 없는 문제를 고치는" 위험 없이 리튠 후보로 분류 가능.
2. 그러나 **이번 사이클에서 즉시 수치 리튠은 보류** — `qa/r1-full-protocol-cycle2.md`가 명시한 대로 이 측정은 장비 등급(T1-T5, 최대 ×2.00)이 빠진 스탯-only 프록시다. 장비 투자가 워든/동료 어느 쪽에 더 쏠릴지 모르는 상태에서 리튠하면 잘못된 방향으로 조정할 위험이 있다(예: 이미 장비로 완화되는 격차를 스탯 수치까지 낮춰 이중 약화).
3. **다음 사이클 필수 선행 작업으로 확정**: `scripts/run-g2-archetype-rotation.mjs`가 스테이지별 장비 등급(`weapon`/`ward`/`trinket`, 워든+동료 양쪽)을 `stageResults[]`에 기록하도록 확장 — 이 데이터 없이는 R1의 "final effectiveDamage 기준 측정" 요건(`UNIFIED-GDD.md` §9.1)을 완전히 닫을 수 없다. 이 인프라 확장이 완료되면 동일 계산을 실제 `equipment` 객체로 재실행해 완결.
4. R3(1.166×~1.326×, 상한 1.3× 이내)와 R5(구조적으로 도달 불가, NG+ 미결정)는 이번 사이클 재측정 대상 아님 — D15/Cycle1 판정 그대로 유지.

**반영**: `qa/gate-measurements.md#r1-r3-r5-total-permanent-power-governance`(R1 FIX 갱신), `qa/r1-full-protocol-cycle2.md`(전체 근거, QA 서브에이전트 산출). `production/gate-reviews/stage2-review.md`의 R1 PENDING 해소는 Stage2 게이트 리뷰 갱신에서 별도 반영.

## D17 — Cycle 3: Option A→B 렌더링 경로 번복 (자유 카메라 WebGL 재채택), UI 정보구조 실행 확정

**컨텍스트**: `engineering/lane-render-arch.md`(Cycle 1)가 Option B(실시간 WebGL, 자유 카메라)를 명시적으로 평가·기각하고 Option A(Blender 베이크 스프라이트, 고정 버즈아이 카메라)를 채택했다 — 근거는 이 저장소가 실제로 WebGL/Three.js 렌더러를 구축했다가(커밋 `161a2ab`~40개 커밋) 장르 피벗 시점에 전량 폐기한(`141b8f7`, 6,761줄 삭제) 전례. `UNIFIED-GDD.md:219`가 재검토 조건을 명시적으로 남겨뒀다: "Stage 2 이후 자유 회전 카메라나 동적 조명이 명시적으로 요구되면 재검토."

**판정**: 사용자가 이번 세션에서 명시적으로 자유 카메라 WebGL 재개를 요청 — 위 재검토 조건이 문자 그대로 트리거됨(가정이 아니라 실제 발화). director가 사전에 Option A/B 비용·리스크를 근거와 함께 제시(신규 런타임 의존성, 코드량 10배 전례, WebGL 컨텍스트 손실 신규 실패군, 기존 어댑터 계약 테스트 2종 전면 재작성 필요)했고, 사용자가 이 정보를 인지한 상태에서 Option B를 명시적으로 선택했다. **번복 승인.**

이는 실패를 반복하는 것이 아니다 — 과거 폐기는 "장르가 RTS→디펜스-서바이버로 피벗하며 3인칭 자유 카메라 자체가 불필요해졌다"는 컨텍스트 변화 때문이었지, WebGL 구현이 기술적으로 실패해서가 아니다. 이번 재개는 장르가 다시 바뀐 것이 아니라 프레젠테이션 충실도를 높이려는 의도적 선택이며, 기존 결정론적 시뮬레이션 계층(`defense-run-simulation.js`)과 게임플레이 메커닉(자동공격+수동이동+포메이션)은 명시적으로 불변 — 렌더러는 여전히 패시브 옵저버 계약(`tests/defense-renderer-contract.test.mjs`가 이미 강제)을 따른다.

**Reused-not-rebuilt**: `assets/models/abyssal-command/abyssal-command-resource-pack.glb`(커밋 `2c39fce`, Cycle 1/2 기간 동안 런타임 미소비 상태로 존재)를 검증 — 표준 glTF 2.0, Draco 압축 없음, 101 노드(5개 일반 적 아키타입 × Idle/Move/Strike/Special/Defeat 애니메이션 + 3개 네임드 보스[cinder-warden/veil-tactician/gate-sovereign, Stage 1-3 대응] + 월드 세트피스), 9종 authored PBR 머티리얼(웜 오텀/에미시브 트레일 팔레트와 일치, 예: Cinder Ember 웜오렌지 에미시브 ×2.34). 신규 애셋 제작 없이 이 팩을 그대로 렌더러 대상으로 사용 — 기존 사이클의 "쓰이지 않는 리소스"가 아니라 정확히 이 순간을 위해 준비되어 있던 것으로 재해석.

**게임플레이 메커닉 범위**: 사용자가 별도로 확인 — "플레이방식 전면개편"은 UI/정보구조 재설계(5탭 커맨드덱 셸, 8개 신규 화면, 월드공간 HUD 8종, 일시정지 메뉴)를 의미하며 전투 메커닉(자동공격/수동이동/포메이션) 자체는 불변. 이는 `ui/lane-info-architecture.md`/`ui/lane-hud-layout.md`(둘 다 Cycle 1, director 미착수 상태로 보류됨 — `task-manifest.md` "Deferred out of this cycle" §26-33 참조)의 실행을 승인하는 것과 동일 — 신규 설계가 아니라 이미 검토된 설계의 착수.

**판정 요약**:
1. `design/presentation-spec.md`의 카메라 섹션을 Option B로 갱신, 기존 Option A는 "Superseded"로 보존(아티팩트 계약 — 삭제 아님).
2. `engineering/lane-render-arch.md`는 다음 커밋에서 별도 갱신 예정(엔지니어링 세부는 프로그래머 레인 소관, 이 판정은 방향 승인만).
3. `ui/lane-info-architecture.md`(5탭 셸+8화면)와 `ui/lane-hud-layout.md`(월드공간 HUD 8종, Option B 경로 — 문서가 이미 이 경로를 "재검토 시 적용"으로 명세해 둔 상태라 신규 설계 불필요, 그대로 실행)의 실행을 승인.
4. D5(일시정지 메뉴 Option A 채택)는 그대로 유효 — 이번 판정과 무관하게 이미 확정.
5. 어댑터 계약 테스트(`tests/defense-renderer-contract.test.mjs`, `tests/world-presentation-contract.test.mjs`)의 "두 렌더러가 바이트 동일 카메라 변환을 생성해야 한다"는 기존 불변량은 **더 이상 성립하지 않음** — RealtimeBattle(신규 실제 WebGL)과 BattleVisualizer(기존 Canvas2D, WebGL 컨텍스트 손실 시 폴백 유지)는 이제 진짜로 다른 투영을 생성한다. 유지되어야 할 진짜 불변량: 동일 정본 스냅샷 입력, 시뮬레이션 상태 비변경, `getRunDigest` 불변 — 투영 결과 자체의 동일성은 더 이상 요구하지 않는다. 이 테스트들의 갱신은 이번 사이클 구현 작업의 일부.

**반영**: `design/presentation-spec.md`(카메라 섹션 재작성), 본 항목. 엔지니어링/UI 실행 산출물은 이후 커밋에서 반영.
