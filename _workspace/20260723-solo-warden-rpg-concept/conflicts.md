# Conflicts Log

run-id: `20260723-solo-warden-rpg-concept`

## C1 — 외부 워크스트림이 캐논 위반 소지 자산을 동일 run-id 공간에 기록 (2026-07-23 23:26–23:47)

**발견 경로**: Stage1 gate review 준비 중 시스템 어드바이저가 지적 → 직접 조사.

**사실관계**:
- 별도 codex-cli 세션(sessionId `019f8f69-5cf2-7101-98fd-66bb13a3086d`, god-tibo-imagen 툴)이 이 디렉터가 소환하지 않은 워크플로로 다음을 생성:
  - `assets/images/battle/pilot/concept-{sungjinwoo,human-command,shadow-commander,monarch}-boss.png` + `.provenance.json` 4쌍 — **저장소 루트 자산 트리, 이번 run-id 워크스페이스 밖**
  - `_workspace/20260723-solo-warden-rpg-concept/production/{sungjinwoo-core,human-command,shadow-commander,monarch}.previs.json`, `boss_previs_workfile.blend`, `boss-motion-previs-*.json`, `motion-previs-and-blender-execution-plan.md` — **이번 run-id 워크스페이스 내부**
  - `_workspace/20260723-solo-warden-rpg-concept/design/boss-concept-prompt-pack.json` — **이번 run-id 워크스페이스 내부**
- 이 디렉터의 `production/task-manifest.md`에는 이 작업이 태스크로 등록된 적이 없다 — 15개 브레인스톰 레인과 무관한 제3자 프로세스.

**위반 판정**:
- **파일명/내부 ID 레벨**: `concept-sungjinwoo-boss.*`, `sungjinwoo-core.previs.json`(protagonist명 직접 음역), `concept-monarch-boss.*`, `monarch.previs.json`("Monarch"은 Solo Leveling 세계관의 핵심 서사 용어) — 이번 사이클 `main_constraint #4`("no copied names/art/UI/exact numeric tables") 및 **해당 워크스트림 자신의 `boss-concept-prompt-pack.json` §antiCopyrightConstraints**("use original titles instead of source-character transliterations")를 **동시에 위반**.
- **archetype/displayName 레벨**: `boss-concept-prompt-pack.json` §archetypes는 실제로 원화명(`sung-hum`→"Nightward Human Vanguard", `shadow-soldier`→"Graveshadow Battalion Unit" 등)과 프롬프트 자체에 "no copyrighted character likeness" negative 태그를 갖추고 있다 — **콘텐츠 설계 의도는 originalize를 시도**했으나, **파일명·내부 ID·previs sidecar 파일명에 그 originalize가 관철되지 않고 원본 음역이 새어나왔다.**

**배포 상태 확인**: `git status --short`로 전량 untracked, `.github/workflows/static.yml` allowlist에 `pilot` 경로 없음, gitignore 대상 아님 — **커밋도 배포도 되지 않은 로컬 워킹트리 상태.** 현재 이 리포의 유일한 배포 제품 계약(`docs/abyssal-command-defense-survivor-design.md`)이 실제로 위반된 상태는 아니다.

**디렉터 판정**: `production/decision-log.md` D8 참조.


## C2 — 공유 `main` 브랜치에서 이미 푸시된 커밋 2건이 소실됨 (force-push 추정, 2026-07-24 07:47 전후)

**발견 경로**: `git fetch origin main` 후 `git merge-base --is-ancestor origin/main HEAD`가 DIVERGED 판정 → 직접 조사.

**사실관계**:
- 이 디렉터가 `e7d5e8d`(스테일-베이스 allowlist 회귀 정정) 이후 `b1be9d5`(world-art-audit.png 재배치), `1030019`(task-manifest.md Stage1-3 상태 갱신) 2개 커밋을 `main`에 정상 푸시 완료(각 push 호출의 `ok` 응답 확인, CI 실행 `30048121233` 그린 확인 — 즉 이 커밋들이 `origin/main`에 실제로 존재했었다는 직접 증거).
- 별도 workstream("Cycle 2", `cycle2-stage-progression` 브랜치)이 이후 `origin/main`을 merge하여 병합 커밋 `92ec2b8`을 생성·푸시했는데, 그 병합 커밋의 부모 중 `main` 쪽 부모가 `e7d5e8d`이다 — `b1be9d5`/`1030019`를 전혀 포함하지 않음.
- `git merge-base HEAD origin/main` = `e7d5e8d`. `b1be9d5`/`1030019`는 `origin/main`에서 도달 불가능(`git merge-base --is-ancestor` NO).
- Cycle 2의 3개 커밋(`ac5ffef`/`bec93da`/`636ed99`) 자체는 `task-manifest.md`(공유 파일)를 전혀 건드리지 않았다 — 별도 파일 `task-manifest-cycle2.md` 신규 작성만 수행. 즉 `task-manifest.md`가 구버전으로 되돌아간 것은 **콘텐츠 충돌의 결과가 아니라, 병합 시점에 그 파일의 최신 버전이 애초에 존재하지 않았기 때문**(merge-base 자체가 `1030019`보다 이전인 `e7d5e8d`).

**원인 추정**: Cycle 2가 로컬에서 `origin/main`(당시 `e7d5e8d` 시점) 기준으로 브랜치를 만들거나 오래된 fetch 상태로 merge를 수행한 뒤, `main`을 그 병합 커밋으로 force-push(또는 동등한 non-fast-forward push)한 것으로 추정. 일반 `git push`는 non-fast-forward 시 거부되므로, 실제 이력 교체가 일어났다는 것은 강제 갱신 경로(`--force`/`--force-with-lease` 또는 브랜치 보호 예외)가 사용됐음을 시사한다[INFERENCE — 정확한 명령어는 관찰 불가, 결과 상태로만 추론].

**영향 범위**: `b1be9d5`(무해, 파일 재배치)와 `1030019`(task-manifest.md 상태 갱신 텍스트만)로 한정 — 두 커밋 모두 실행 코드나 테스트를 변경하지 않았으므로 **기능적 손실은 없음**, 순수 문서 상태 텍스트만 재작성 필요.

**복구 조치**: `git reset origin/main`을 사용하지 않음(로컬 워킹트리의 미커밋 `ops/*.md` 3종 + `stage3-review.md` 갱신이 `e7d5e8d` 기준 인덱스로 되돌아가며 손실 위험) — 대신 `b1be9d5`/`1030019`를 새 `origin/main` 위에 cherry-pick으로 재적용.

**교훈**: 공유 브랜치에서 push 성공 확인(`ok` 응답)이 그 커밋의 영구 존속을 보장하지 않는다 — 다른 workstream의 force-push로 사후에 소실될 수 있다. 재작업 전 항상 `git fetch` + `git merge-base --is-ancestor <내 커밋> origin/main`으로 도달 가능성을 재확인해야 한다.
