# Cycle 2 Retrospective — Solo Warden RPG Concept

run-id: `20260723-solo-warden-rpg-concept` · director: game-production-director (acting all specialist roles this cycle, per user's tripled-role request routed to a director-executes + parallel-subagent-lanes pattern)

## Gate table (measured values, this cycle)

| Gate | Stage | Cycle 1 verdict | Cycle 2 verdict | Key measured value |
|---|---|---|---|---|
| G2 | 2 | FIX | **CLOSED** | `win_rate_band` deprecated → per-archetype bands (`balance-sheet.md#band-overrides`); Stage 1 TTK 9.67s median in `[9.52,12.88]`s band |
| G3 | 2 | PASS (w/ finding) | unchanged | not re-measured against its own threshold this cycle |
| G5 | 2 | N/A | unchanged | no monetization, structurally out of scope |
| G7 final | 2 | FIX | unchanged | repeat-rate proxy still needs human/scripted playtest |
| G8 | 2 | PENDING | unchanged | novelty-scorecard work untouched |
| R1 (supplementary) | 2 | PENDING | **FIX (real finding)** | 34/210 points exceed 20% ceiling, 3 archetypes, most extreme 36.84% |
| R3 (supplementary) | 2 | PASS | PASS (re-confirmed) | 1.166×-1.326×, within 1.3× cap |
| R5 (supplementary) | 2 | unreachable-by-construction | unchanged | NG+ scope still undecided |
| G4 | 3 | PARTIAL | PARTIAL (accessibility scope widened) | 0/108 undersized elements across 5 real milestones |
| G6 | 3 | PARTIAL | PARTIAL (perf scope widened) | 427 DOM nodes, 8.332ms rAF, +2.36% heap growth at true endpoint |
| G1 final | 3 | PASS | PASS (unchanged) | zero new narrative content this cycle |

## What this cycle actually closed

The core deliverable — progression-aware TTK validation across the real 10-stage resource curve, which `stage-progression.md` §6 explicitly deferred from Stage 1 concept work — is done. Not by inventing a new formula (rejected early: fitting a curve to post-hoc data would have been circular), but by extending Cycle 1's own already-validated cross-archetype-spread methodology to per-stage granularity, using each archetype's own testplan-defined band. This surfaced a real finding (turtle's TTK ceiling violation, mechanically traced to a QA-policy stat-priority artifact, not retuned) and closed the literal Stage-1 authored-target check the Cycle 1 PENDING note actually asked for.

R1's full-protocol measurement (the other major PENDING item) is now a precise, evidenced FIX rather than a vague flag — and unlike turtle's finding, this one traces to a structural mechanism in the shipped numbers (flat-scaling Warden stats vs static-fraction companion bonuses) that shows up in normal-strategy archetypes, not just an edge-case QA policy. Correctly NOT retuned this cycle pending equipment-tier data capture — retuning against an incomplete stat-only proxy risks fixing the wrong axis.

## Unresolved risks (carried forward, not silently dropped)

1. **R1 equipment-tier data gap** — `scripts/run-g2-archetype-rotation.mjs` needs extension to record per-stage equipment purchases before R1 can close fully against `UNIFIED-GDD.md` §9.1's literal "final effectiveDamage" binding. Concrete next-cycle infrastructure task, not a design decision.
2. **G4/G7 immersion and repeat-rate scoring** — genuinely requires human playtest or a defensible scripted proxy; not fabricable from simulation tooling across two consecutive cycles now. If Stage 3 keeps recurring without this, it should be flagged as a structural gap in this project's verification capability, not repeatedly re-stated as PENDING.
3. **G8 novelty scoring** — untouched for 2 cycles; designer-owned, blocked on nothing technical, just not yet scheduled.
4. **NG+ scope decision** (`UNIFIED-GDD.md` §12 item 6) — now blocks 2 independent things (R5's session-15 ceiling, PM's completionist-collector session band). Worth prioritizing next cycle since it's unblocking two open items at once, not one.
5. **Stage 6 Undertow-stable badge** — a genuine, newly-discovered content/presentation gap (design doc describes it, no UI implements it). Small, bounded, not urgent.

## Process note: the collision-avoidance strategy was tested for real, not just planned

Cycle 1's retrospective (implicit in this cycle's `decision-log.md#D15`/`D16` references to it) identified shared-working-tree contamination as the root cause of 2 production-breaking pushes. This cycle opened by setting up an isolated git worktree specifically because of that lesson — and then a substantial concurrent push actually landed on `main` mid-cycle, hitting 2 of the exact files this cycle also modified. This was the real test of whether the isolation strategy actually works, not just a precaution taken and never exercised.

It held. The worktree didn't prevent the collision (concurrent work on `main` will always be possible) but it made the collision *visible and inspectable* rather than silently overwritten — the merge required reading actual conflict content, and in both overlapping cases the concurrent branch's independent fix was verified (not assumed) to be a strict superset of this cycle's own fix before taking it wholesale. Zero regressions crossed the merge boundary; the full suite went from this cycle's clean 148/4 baseline to a merged 164/0 with the concurrent branch's own commit incidentally closing 4 additional pre-existing failures neither branch was individually scoped to fix.

## Next-cycle entry decision

**Stage 2 retune entry** (not Stage 1 concept shift) — the concept and core-loop design are stable and validated across two cycles now; what remains is infrastructure (equipment-tier capture for R1), scheduling (G8 novelty, NG+ scope decision), and a resource-intensive but well-understood gap (human playtest for G4/G7). None of these require revisiting the game's concept or worldview.

**Next public beat**: a build where R1's equipment-tier question is actually closed (not just stat-only), and either a real playtest round or an honest scripted repeat-rate proxy exists — that combination would let Stage 3 close as a full PASS instead of a recurring PARTIAL.
