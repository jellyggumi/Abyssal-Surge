# Abyssal Command — Canvas-Native Boss Threat & Resource Completion — Production Brief

```yaml
game_type: "deterministic single-player browser RTS/tactical campaign (dark-fantasy abyssal RTS-RPG hybrid)"
engine: "ES modules + deterministic campaign reducer (campaign-state.js) + Three.js WebGL2 primary renderer + Canvas2D fallback"
current_stage: "Stage 1 — core-build increment, shipped and tested in this packet"
next_public_beat: "Every boss now threatens the player on its own initiative inside a visible danger ring, independent of the player's own commands; the shared battlefield deck now carries a real PBR rock texture instead of a flat tint."
operating_mode: "gameplay core-interaction cycle: boss threat/engagement readability + resource/texture completeness. Not a monetization, narrative, or full 10-stage balance-rebalance cycle."
```

## 1. Intake (원문 요약)

요청자가 지적한 6가지: (1) 오브젝트 이동·상태체크 가독성, (2) 리소스 텍스처 완성도(갓티보 이미젠), (3) 스테이지당 ~5분 볼륨 + 전략/보상/스킬, (4) 무제한 사냥 대신 탈취/처치/지형변화 기반 채집, (5) 보스 근접 필요 + 특정 범위 자동공격 + 보스별 공격타입/패턴, 사용자 커맨드가 직접 타격 불가, (6) 캔버스 내 조작으로만 직접 동작.

## 2. Observed baseline (편입 전 사실, 소스 인용)

| 항목 | 관찰 | 근거 |
|---|---|---|
| 커맨드 파리티 | 모든 명령(`hunt/extract/materialize/capture/possess/domain/assault`)이 터치·키보드에서 동일한 `applyAction` 상태 전이를 호출하도록 README가 명시. | `README.md:15-16` |
| 이미 존재하던 근접 게이트 | `battle-realtime-three.js`의 `getCommandReadiness`가 모든 액션(assault 포함)에 대해 `ACTION_INTERACTION_RADIUS`(3.0) 밖이면 `{ready:false, reason:"out-of-range"}`를 반환하고, `app.js`의 `evaluateQueuedCommandReadiness`가 이 사유만은 750ms 타임아웃 폴백을 적용하지 않는다 — 즉 UI 버튼을 눌러도 커맨드는 큐에만 들어가고, 캔버스에서 실제로 사거리 안으로 들어와야 실행된다. | `battle-realtime-three.js:3631-3662`(getCommandReadiness), `app.js:1244-1268`(out-of-range은 타임아웃 폴백 제외) |
| 존재했지만 미사용 | `applyEncounterEvent`에 `"boss-assault"` 이벤트 분기가 있었으나 어떤 호출부도 이 타입을 디스패치하지 않음(죽은 코드) — 보스 자체의 능동 공격은 전혀 없었다. | `campaign-state.js`(구 버전) `applyEncounterEvent` |
| 텍스처 자산은 이미 생성됨, 미적용 | `assets/models/abyssal-command/textures/`에 7종 PBR albedo/normal 쌍이 존재하고 `presentation-spec.md`가 재질의 진영/역할 의미(mass=void-obsidian/ash-cloth, role=cold-steel/old-bone/gate-gold, energy=violet-rift/cinder-ember)를 문서화했지만, 실제 씬의 바닥/데크 InstancedMesh는 `color:0xffffff` 단색 `MeshStandardMaterial`만 사용했다(맵 없음). GLB 유닛/보스/지형은 임베디드 텍스처를 이미 갖고 있어 실제 문제는 손수 만든 프리미티브(바닥 데크)에 국한됨. | `_workspace/20260718-resource-refinement/design/presentation-spec.md:69`, `battle-realtime-three.js`(구 852행 부근 deckMaterial) |
| 보스 자동공격 부재 | `counterDamage`는 플레이어가 assault를 성공시켰을 때만 발동하는 반격이며, 플레이어가 접근만 하고 공격을 안 하면 보스는 아무 것도 하지 않았다. 보스별 "공격타입/패턴" 데이터도 없었다(`BOSS_PHASES`는 체력 구간 연출용일 뿐 공격 타입이 아님). | `campaign-state.js` `counterDamage`/`guardAssault`, `combat-systems.js` `BOSS_PHASES` |
| 파밍 상한 | Hunt는 스테이지당 `huntGoal`(보통 2회) 이후 Extract가 필요한 소프트 캡은 있었지만, 처치/점령/지형변화에 소스가 묶인 채집 요소는 없었다(순수 카운터 반복). | `campaign-state.js` `checkAndApplyActionMutations` hunt 분기 |

## 3. What this packet ships (실제 코드 변경, Stage 1 core-build)

1. **보스 자동공격 — "boss-strike"**: 10개 스테이지 전부에 `bossPattern`(`type: melee|ranged|aoe`, `triggerRange`, `cooldownSeconds`, `damage`) 데이터를 추가. `applyEncounterEvent`에 새 `"boss-strike"` 분기를 추가해 플레이어의 `assault`와 완전히 독립적으로(노출/점령/빙의 여부 무관, 웨이브 없는 스테이지(veil-citadel, echo-throne)에서도) 보스가 사거리 내 침입자에게 데미지를 준다. 렌더러(`battle-realtime-three.js`)가 커맨더-보스 거리를 매 프레임 계산해 쿨다운을 관리하고, 쿨다운이 끝나면 이 이벤트를 발행한다. `combat-systems.js`에 `BOSS_ATTACK_PATTERNS` 카탈로그(melee/ranged/aoe의 텔레그래프·아이콘 키)를 추가해 보스별 패턴을 데이터로 구분한다.
2. **위협 범위 가독성**: 보스 주위에 `triggerRange` 크기의 반투명 링 메시를 배치하고, 쿨다운이 다 찰수록 밝아지도록 해 "곧 맞는다"를 텍스트가 아니라 바닥에서 읽을 수 있게 했다. 이는 (1) 상태체크 가독성 요청에 대한 플레이어向 응답이다.
3. **텍스처 완성도**: `void-obsidian` PBR 알베도/노멀 맵을 배틀필드 데크(모든 스테이지의 모든 걸을 수 있는 타일)에 실제로 로드·적용했다. 이전에는 단색이었던, 게임에서 가장 넓고 상시 노출되는 표면이 이제 실제 암석 텍스처를 갖는다.
4. **가독성 주석**: `guardAssault`/`canAct`/`guardAction`에 상태-체크 흐름을 설명하는 JSDoc/가이드 주석을 추가(동작 변경 없음, 순수 문서화).

## 4. Explicitly deferred (다음 사이클로 이월, 침묵 처리하지 않음)

- **무제한 사냥 하드 캡(탈취/처치/지형변화 기반 채집)**: `souls`/`hunted` 수치를 직접 바꾸는 변경은 `campaign-state.test.mjs`의 정확한 수치 단언(예: `hunt,hunt,extract` 후 `souls===4`) 및 `run-campaign-balance-sim.mjs`가 가정하는 10단계 밸런스 전체에 영향을 준다. 한 세션에서 밸런스 시뮬레이션 없이 되돌리기 어려운 수치 변경을 강행하는 것은 하네스의 "no adjective ever passes a gate" 원칙과 QA exploit-hunt 선행 원칙에 위배된다. Stage 2(밸런스)에서 QA 시뮬 우선 진행 필요.
- **스테이지당 ~5분 볼륨 + 전체 스킬 트리**: 현재 웨이브 스케줄은 스테이지별 최대 58–74초 + 준비시간으로 5분에 크게 못 미친다. 10단계 전체의 파형 재설계는 `design/core-loop.md` 갱신 + `pm/reward-bands.md` 재협상이 선행되어야 하는 별도 Stage 1→2 사이클 분량이다.
- **보스 10종 개별 스킬 시퀀스(다중 공격 콤보)**: 이번 패킷은 보스당 "1개 자동공격 패턴"만 부여했다(요청의 "특정 범위 자동공격" 최소 요건 충족). "보스별 스킬 시퀀스/페이즈별 다른 패턴"까지 확장하려면 `BOSS_PHASES`와 `bossPattern`을 페이즈별로 교차하는 설계가 필요하며 다음 사이클 항목으로 기록한다.

## 5. Non-goals / guardrails preserved

- 캠페인 결정론(같은 이벤트 시퀀스 → 같은 결과)과 세이브 리플레이는 변경하지 않았다 — `boss-strike`는 새 이벤트 타입일 뿐 기존 트레이스 포맷을 바꾸지 않는다.
- 키보드/리듀스드모션 폴백 접근성 경로는 유지된다 — 렌더러가 없거나 초기화 실패 시에도 스테이지 진행은 계속 가능하다는 기존 계약을 깨지 않았다.
- `campaign-state.js`는 여전히 유일한 규칙 권위이며, 위치 정보(좌표)를 규칙 코어로 들여오지 않았다 — 사거리 판정은 렌더러가 "언제 이벤트를 보낼지"만 결정하고, 그 이벤트가 유효한지는 리듀서가 결정한다(`start-wave`/`breach`가 이미 쓰던 패턴과 동일).
