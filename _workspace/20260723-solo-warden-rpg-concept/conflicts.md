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
