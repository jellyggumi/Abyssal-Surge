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