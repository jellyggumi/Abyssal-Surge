# Abyssal Surge — cycle 1 production brief

- **Run:** `20260716-shadow-lord-rts-rpg`
- **Status:** Stage 1 intake locked; no implementation or gate result is asserted by this brief.
- **Audience:** game designer, PM, QA, engineer, operations owner, and production director.
- **Next public beat:** an offline GitHub Pages Stage 1 playable showing Cinder Span’s hunt → extract → materialize → capture → guardian sequence.
- **Navigation:** [production contract](../production/production-contract.md) · [task manifest](../production/task-manifest.md)

## Observed facts

1. The local baseline is a static GitHub Pages game shell; its application code and assets are intentionally outside this cycle packet.
2. GitHub Pages serves static client files. It cannot itself provide authenticated cloud state or authoritative real-time multiplayer. Source: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
3. IndexedDB is asynchronous, transactional structured browser storage appropriate for a campaign snapshot; browser storage can still be cleared or evicted. Source: [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) and [storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
4. The prior design draft mentions third-party names and lore. It is evidence of desired *mechanic categories only*, not an approved content source.

## Decisions

- **Public IP boundary:** Abyssal Surge uses only original names, characters, plot, copy, sound, art, and effects. Do not import, recreate, or market against third-party characters, terms, visual signatures, or story beats.
- **Stage 1 scope:** one Lord, three readable original unit roles, one capture node, one Rift Guardian, and two exclusive rewards. No account, payment, cloud save, real-time co-op, ranked play, or APK packaging.
- **Persistence now:** versioned campaign snapshots and recent run/reward records live in IndexedDB; settings and a recovery pointer may use localStorage; Cache/Service Worker stores only versioned assets; export/import is the recovery path.
- **Continuations:** Stage 2 may add opt-in cloud continuity only after a reviewed RLS/auth design. Stage 3 may evaluate invite-only co-op only with an authoritative external room; GitHub Pages remains client delivery.

## Stage 1 measurable entry and exit

| Check | Entry value | Stage 1 exit value | Evidence |
|---|---:|---:|---|
| Original-IP audit | 0 shipped assets/strings approved; 0 imported IP permitted | 0 un-waived external-IP references in player-visible content | `design/worldview.md`, G1 review |
| Campaign chain | 0 implemented stages assumed | Cinder Span has 5 ordered objectives and one deterministic completion transition | `design/core-loop.md`, G7 review |
| Loop period | target not measured | designed target 75 s; valid measurement band 30–180 s | `design/core-loop.md`, G7 review |
| Semantic actions | target not measured | ≥5 named actions: move, target, arise, deploy, capture, plus retry/save | `design/core-loop.md`, `ops/telemetry-contract.md` |
| Slots | no runtime value asserted | every calculated cap clamped to integer 10–100 | `design/balance-sheet.md`, G2 handoff |
| Save safety | no implementation asserted | planned atomic last-known-good snapshot, export/import, visible quota failure | `engineering/architecture-contract.md`, G6 review |
| Mobile input | no input surface asserted | touch and keyboard parity specified for all core actions | `design/presentation-spec.md` |

## Stage transitions

- **Stage 1 — Cinder Span:** hunt three Ash Echoes → extract a 10-second soul pool → materialize a shadow legion → capture the Sable Relay → defeat the Rift Guardian. Select exactly one of two rewards; carry it forward.
- **Stage 2 — Veil Citadel:** carry Stage 1 reward → unlock possession → hold two nodes → defeat the Citadel Tactician. Select exactly one of two rewards; carry it forward.
- **Stage 3 — Echo Throne:** carry Stage 2 reward → use bounded Lord’s Domain comeback → defeat the Gate Sovereign.

## Entry blockers and escalation

- A third-party-IP reference, missing evidence path, open S1 defect, or silent persistence failure blocks the named gate.
- A missing target handset/browser or build session makes final G4/G6 **not-run**, not passed.
- Record a scope or gate decision in [decision log](../production/decision-log.md); route unresolved cross-role conflict through [negotiation record](../pm/negotiation-record.md).