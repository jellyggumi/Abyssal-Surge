---
run_id: 20260716-stage5-rts-detail-cycle-006-v1
owner: game-production-director
created_at: 2026-07-16T07:08:00Z
artifact_version: v1
immutable: true
append_only: true
status: ready
decision_ids: [C006-D-001]
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260716-stage5-rts-detail-cycle-006-v1/intake/design-audit.md
---
# Task manifest v1 — Cycle 006 design-alignment directives

C006-D-001 issues the following directives resolving audit findings 1-3.
`game-core.js` reducer semantics remain FROZEN; all changes live in the
presentation layer (`app.js`, `index.html`, `styles.css`) and assets/tests/docs.

## DET6-TITLE — World-bible encounter naming (Finding 1)

1. Replace `STAGE_TITLES_LOCALIZED` entries with world-bible beat names:
   - en: "The Bell Beneath Blackwater" / "The Quiet Standard" / "The Shore That Remembers" / "Names Under the Foam" / "The First Surge"
   - ko: "블랙워터 아래의 종" / "침묵의 군기" / "기억하는 해안" / "물거품 속의 이름들" / "첫 번째 서지"
2. Keep the `N / 5 —` prefix from `dom.campaign` rendering; localization toggle must swap titles live (existing translateUI path).
3. Terminal narration and lobby copy stay unchanged this cycle.

## DET6-FOE — Hostile lane presence (Finding 2)

1. When a Foe attack resolves in the real-time loop (foeCharge wrap), spawn N hostile "Void Spawn" units at lane right edge marching LEFT: N = 1 (stages 1-2), 2 (stages 3-4), 3 (stage 5).
2. Hostile units: sprite `assets/images/unit_voidspawn.png` (gti-generated, abyssal violet-red creature, left-facing), SVG fallback (existing void-tentacle motif), speed = stage preset unitSpeed * 1.1, despawn at left edge (x <= 0). Purely cosmetic — damage already resolved by the deterministic pipeline; no gameplay state mutation.
3. Tactical monitor lists hostile signals with a distinct hostile row style (red border, "VOID SPAWN" label, ko "심연 스폰") and counts them in a separate "hostile" tally next to active signals.

## DET6-UNIT — Full command↔lane representation (Finding 3)

1. DISRUPT spawns a violet "Arcane Disruptor" unit (sprite `assets/images/unit_disrupt.png`, gti-generated, left-to-right, speed preset*1.15, monitor name en "Arcane Disruptor" / ko "비전 교란자").
2. RECOVER triggers a base heal pulse: knight avatar gains a transient emerald aura (CSS class `recover-pulse`, ~800ms, removed on animationend/timeout); no lane unit.
3. UNIT_SPRITE_SOURCES/UNIT_SVG_FALLBACKS extended for DISRUPT + hostile VOIDSPAWN; monitor in-place update path handles all four kinds without churn regression.

## DET6-QA — Verification gate (stop-ship veto)

1. `node tests/stage1-vertical-slice.test.mjs`, `node tests/playtest-5-stages.test.mjs` PASS (fake-DOM null-guards intact).
2. Browser E2E extended: (a) DISRUPT during SURGE spawns exactly one disruptor unit with sprite src, (b) after a foe attack resolves, at least one hostile unit exists and later despawns, (c) stage title assert now expects "The Bell Beneath Blackwater" on encounter 1.
3. Full `NODE_PATH=$(npm root -g) node tests/playtest-browser.cjs` exits 0 unfiltered; capture-live exits 0; refreshed desktop+mobile PNGs visually inspected.
4. Retrospective `retrospectives/cycle-006-p3-design-alignment-v1.json` validates against a cycle-006 pydantic v2 validator.

## DET6-DOC — Knowledge ops

1. Append Cycle 006 section to `docs/game-production-coordination-brief.md`.
2. llm-wiki report `wiki/reports/2026-07-16-abyssal-surge-cycle-006-design-alignment.md` + index line.

## Ownership

- game-engineering-lead: DET6-TITLE, DET6-FOE(wiring), DET6-UNIT
- resource-pipeline-lead: DET6-FOE/UNIT sprite generation
- adversarial-qa-lead: DET6-QA (stop-ship veto)
- knowledge-ops-lead: DET6-DOC
