# Medieval Battle Presentation — Cycle 2 Retrospective

- **Date:** 2026-07-18
- **Run ID:** `20260718-medieval-battle-presentation`
- **Scope:** Stage 3 presentation-layer follow-on: P1 Order Seal and P2 Compact Consequence.
- **Decision enabled:** Close the two scoped presentation slices without representing their subset evidence as a full-game release gate.

## Outcome

- **P1 — Order Seal:** **PASS** for the scoped G1/G4/G6 subset.
- **P2 — Compact Consequence:** **PASS** for the scoped G1/G4/G6 subset.
- **Independent final review:** **APPROVE** after two test-only repairs.
- **Production change decision for P2:** No production style or module change was needed. The existing `.ashen-field-command__activate-note` already presents the native command detail as one line.

## Evidence retained

### P1 — Order Seal

- `node --test tests/battle-field-command-overlay.test.mjs` → **14 passed, 0 failed**.
- `node tests/playtest-browser-3stage.cjs --reduced-motion` →
  **`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v28 optional-media-errors=0`**;
  wall **277.09s**. Only WebGL driver/deprecation warnings were reported.
- The P1 evidence remains independent proof for the native-proxy receipt and successor-command behavior; P2 did not alter P1 production behavior or broaden that evidence.

### P2 — Compact Consequence

- `node tests/playtest-browser-3stage.cjs --compact-field-overlay` →
  **`PLAYTEST_BROWSER_COMPACT_FIELD_OVERLAY_PASS viewport=360x800 contexts=standard,reduced consequence=one-line proxy=48px canvas=pass-through`**;
  wall **7.30s**. Only WebGL GPU-stall warnings were reported.
- The focused browser check is dynamic and locale-neutral: it validates `<small>` source equality, one-line presentation, the 48px proxy floor, center hit-test ownership, no horizontal overflow, sole proxy control, standard-context canvas ownership, and reduced-motion copy/rAF/error conditions.

## What the cycle established

- P1's passive receipt remains on the existing native command route rather than creating another input path.
- At 360px, P2 preserves the current command's existing consequence text while retaining the proxy's hit target and blank-canvas reachability.
- The only completed repairs were test-only; the final independent review approved the resulting evidence.

## Unresolved gates and risks

The following are **NOT SCORED**, not passed or waived:

- **Full G1:** No whole-game player-visible worldview trace audit exists.
- **Full G4:** No human immersion/readability scorecards or feedback-latency evidence exists.
- **Full G6:** No telemetry contract, tested rollback drill, release-readiness checklist, or performance soak exists.
- The compact proof is deliberately localized to the field-command overlay at `360×800`; it does not prove whole-game responsive behavior, long-run performance, release operations, or player perception.

## Next-entry decision

**Do not reopen P1 or P2 and do not claim a full G1/G4/G6 pass.** The next entry, if the team seeks
full-cycle or release readiness, must be a separately scoped whole-game gate effort that first
collects a worldview trace, human immersion and latency evidence, telemetry/rollback proof, and a
performance soak. Otherwise, this two-slice Stage 3 presentation cycle remains closed as scoped
subset PASS evidence only.

## Post-P2 default browser regression

- `node tests/playtest-browser-3stage.cjs` →
  **`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v29 optional-media-errors=0`**;
  wall **241.74s**. Only WebGL GPU-stall/deprecation warnings were reported.

This proves the P2 test additions are compatible with the default existing three-stage browser
flow. It is scoped post-P2 regression evidence only and does not score or imply a full G1, G4,
or G6 PASS.
