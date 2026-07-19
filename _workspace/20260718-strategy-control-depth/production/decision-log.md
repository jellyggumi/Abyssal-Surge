# Strategy & Control Depth — Production Decision Log

## Decision schema

Every entry records `status`, `decision`, `evidence/rationale`, `consequence`, and `revisit trigger`. `accepted` means the production contract is frozen; it does not mean a gate passed or a change shipped.

```yaml
run_id: "20260718-strategy-control-depth"
decision_owner: game-production-director
mode: "Stage 2 balance-cycle entering Stage 3 only after numeric exit gates"
production_code_changed_by_this_log: false
tests_executed_by_director: false
```

## SD-001 — One operating mode and stage entry

- **status:** accepted, 2026-07-19; implementation-entry detail superseded by SD-018/SD-020/SD-021
- **decision:** remain in Stage 2 for balance, tactical-map, core-loop, novelty, parity, and control implementation. Stage 2 exit and Stage 3 evidence execution remain blocked until the director records full canonical `PASS` verdicts for G2/G3/G5/G7/G8, each backed by measured values, methods, durable evidence paths, and zero open S1 defects.
- **evidence/rationale:** the harness maps G2/G3/G5/G7/G8 to Stage 2 and G6 final to Stage 3. The v6 pre-change policies expose risk—rusher 0%, comeback 0%, casual 40%—but cannot score the current v7 candidate (`/tmp/abyssal-balance-v6.json:18-23,297-302,390-410`; SD-021).
- **consequence:** SD-018/SD-020/SD-021 authorize the bounded integrated implementation and measurement foundations; no gate passes until durable current-version evidence exists.
- **revisit trigger:** only a director gate review with measured values, methods, durable evidence paths, and zero open S1 defects may advance the cycle.

## SD-002 — Public beat is a rules-v7 strategy/control candidate

- **status:** accepted; version updated by SD-021 without reducing public scope
- **decision:** the next public beat is a ten-stage rules-v7 candidate with exactly three material routes per stage, at least three viable strategies among five tested archetypes, command feedback p95 `≤100 ms`, frame-independent movement/camera, renderer/input authoritative parity, and deterministic trace saves.
- **evidence/rationale:** the source contains ten stages and is now rules v7 (`campaign-state.js#05B1:1,31-514`), while the retained browser packet covered only Stage 1 renderer selection and a separate three-stage flow (`_workspace/20260718-resource-refinement/qa/gate-measurements.md:139-151`).
- **consequence:** a three-stage, one-renderer, one-input, source-only, or v6 result may be a smoke/baseline but cannot satisfy the public beat.
- **revisit trigger:** a deliberate public-scope reduction approved by the user; ordinary schedule pressure does not silently lower the numerator.

## SD-003 — Campaign authority and save semantics are immutable

- **status:** accepted, non-negotiable
- **decision:** `campaign-state.js` remains the single reducer/authority. `createSaveEnvelope` remains rules/schema-pinned and trace-based; `restoreSaveEnvelope` replays through the same public transitions and rejects incompatible, unsupported, or impossible events.
- **evidence/rationale:** current v7 source writes `{schema, schemaVersion, rulesVersion, trace}` and restores `start`, `action`, `reward`, `retry`, `battle-breach`, and `encounter` events through the reducer; mismatched rules versions are rejected (`campaign-state.js#05B1:1179-1211`).
- **consequence:** map, renderer, input, storage, and presentation code may request or display outcomes but may not own rules, write trusted snapshots, or reinterpret a trace. A second tactical reducer is an S1 defect.
- **revisit trigger:** none within this beat. Multiplayer/server authority would require a separate approved architecture cycle and must reuse, not fork, the rules package.

## SD-004 — Larger-map threshold is 24×12 minimum across all ten stages

- **status:** accepted as candidate acceptance threshold; not implemented
- **decision:** expand the shared tactical navigation from the observed 16×8/128-cell baseline to at least 24×12/288 gross cells, a minimum 2.25× area increase, for 10/10 stages.
- **evidence/rationale:** `stage-navigation.js:3-4` defines 16×8 and `normalizeStageNumber`/`buildStageHeightfield` cover stages 1–10 (`stage-navigation.js:12-108`). A 24×12 floor increases both axes by 50% rather than creating a long but tactically narrow corridor.
- **consequence:** the later proposal changes `STAGE_GRID_WIDTH`, `STAGE_GRID_HEIGHT`, `STAGE_TACTICAL_ANCHORS`, `buildStageHeightfield`, and derived renderer offsets/anchors. QA must prove every anchor/path/cell is in bounds and both renderers hash to identical navigation cells.
- **revisit trigger:** designer survey plus engineer route-cost analysis may propose a larger size. A smaller size requires numeric evidence that it still creates ≥3 qualifying lanes/zones on all ten stages and explicit director approval; visual spaciousness alone is insufficient.

## SD-005 — “Three lanes” means three material tactical choices

- **status:** accepted definition, numeric details superseded and finalized by SD-020
- **decision:** each stage needs exactly three qualifying routes. Each must (1) connect staging to pressure/objective, (2) keep at least 50% nonshared cells between shared junctions, (3) provide at least one distinct affordance and differ in at least two of elevation, obstacle/void topology, objective access order, travel cost, hazard/exposure, or frontage, (4) preserve at least four cells of intended combat frontage, and (5) remain independently connected if another route is blocked outside shared entry/exit. Each stage has two reconnect junctions; longest default route is at most `1.35×` shortest; measured lane success is `15–70%`; successful-stage static camp is at most `60%`.
- **evidence/rationale:** current heightfields describe varied terrain but the source does not measure three viable choices per stage (`stage-navigation.js:16-108`). The final designer topology matrix in `design/trend-survey/solutions.md` prevents palette, prop, or name changes from being counted as strategy.
- **consequence:** G2 topology tables have a 10-stage numerator plus graph, cost, nonshared-cell, affordance, frontage, connectivity, outcome-share, and stationary-time calculations. Palette swaps, boss tints, decorative islands, or identical navigation paths count as zero additional routes.
- **revisit trigger:** a zone-based alternative requires the same graph/outcome proof and a new director decision; labels or visual spaciousness are insufficient.

## SD-006 — G2/G3 strategy thresholds use harness bands without a genre override

- **status:** accepted
- **decision:** G2 requires 100% live-mechanic coverage, matchup win rates 45–55%, TTK within ±15% of a declared target, and maximum combo EV ≤1.30× median. G3 requires at least five tested archetypes, at least three independently viable with distinct strategies, and no archetype above 50% optimal-play dominance.
- **evidence/rationale:** these are the harness defaults (`skill://game-studio-harness/references/quality-gates.md`). The parent-provided v6 baseline measured complete coverage for 12 early reward pairs at 1.1684529828× median, but deterministic rusher/comeback were 0%, greedy/optimal were 100%, and casual was 40% over 200 (`/tmp/abyssal-balance-v6.json:18-23,111-116,204-209,297-302,390-410,413-427,1102-1105`).
- **consequence:** the combo subcheck is inside its cap for the measured 12-pair scope only. G2/G3 remain `FIX/INCOMPLETE`; deterministic policies are not matchup or human fairness evidence.
- **revisit trigger:** a genre override proposed in `design/balance-sheet.md#band-overrides` with survey/player evidence and a separate director decision.

## SD-007 — Core-loop and novelty thresholds remain numeric

- **status:** accepted
- **decision:** G7 requires at least one 30–180 second loop with ≥3 actions, ≥1 reward event, and ≥70% voluntary re-entry. G8 requires ≥5 comparable RTS titles, a candidate striking element found in no more than 2, and QA impression ≥4.0/5.
- **evidence/rationale:** harness G7/G8 defaults require player-time/re-entry and survey/impression evidence. The v6 simulator’s G7 proxy records 9–12 commands and one reward per stage but explicitly does not measure player time or fairness (`/tmp/abyssal-balance-v6.json:1369-1432`).
- **consequence:** command-count arithmetic is a useful model subcheck, not a G7 pass. No title may enter the G8 denominator without a citation and comparable feature definition.
- **revisit trigger:** only the harness override process; absence of playtesters or survey access leaves the gate `NOT RUN`.

## SD-008 — Command responsiveness threshold is p95 ≤100 ms

- **status:** accepted; measurement not run
- **decision:** for accepted and rejected authoritative actions, event timestamp to first visible or accessibility-announced feedback must be p95 ≤100 ms and p99 ≤150 ms. Pointer, keyboard, and touch each need at least 100 samples; duplicate or missing authoritative actions must equal zero.
- **evidence/rationale:** harness G6 input budget is ≤100 ms. Current command-button click and keyboard paths converge on `handleAction` (`app.js:2118-2157,2470-2501`), but no current latency or touch-equivalence measurement exists.
- **consequence:** cosmetic animation completion is not the start marker. The first truthful state/feedback update is measured. Each modality must produce the same accepted/rejected action meaning and one action at most.
- **revisit trigger:** a stronger threshold may be accepted after instrumentation. A weaker threshold requires user approval and external/platform evidence; implementation difficulty alone is insufficient.

## SD-009 — Movement and camera must be frame-rate independent

- **status:** accepted; later implementation proposal defined
- **decision:** verify the same 10-second scripted movement at 30/60/120 Hz with travel divergence ≤1% and endpoint divergence ≤0.10 world units. Camera target after one second must differ by ≤0.05 world units and time-to-90% by ≤35 ms.
- **evidence/rationale:** commander (`4.1`, Shift `7.2`) and enemy (`2.4`) movement already multiply by `dt` (`battle-realtime-three.js:35,1005-1039,1079-1105`). Camera follow ignores `dt` and applies fixed `lerp(...,0.12)` per frame (`battle-realtime-three.js:1157-1177`).
- **consequence:** later implementation should replace the fixed camera coefficient with `alpha(dt)=1-exp(-dt/0.130)`. The 0.130-second time constant approximately preserves the present 60 Hz feel. Risk: unbounded suspension `dt` can snap/overshoot, so pause/resume is in the focused matrix.
- **revisit trigger:** measured feel testing may tune the time constant, but any value must keep the frozen 30/60/120 parity bands and name the new number, risk, and focused evidence.

## SD-010 — Current movement speeds are baselines, not automatic buffs

- **status:** accepted
- **decision:** commander 4.1/s, surge 7.2/s, enemy 2.4/s, and collision subdivision 0.12 remain observed baselines until route-length and encounter-timing analysis supports a change.
- **evidence/rationale:** these numbers are in `battle-realtime-three.js:35,927-945,1005-1039,1079-1105`. Increasing map area does not by itself establish the correct traversal or pressure time.
- **consequence:** any later speed proposal must name file/symbol/current/new value, expected route travel time, impact on wave/breach timing and control precision, and 30/60/120 Hz evidence. “The map felt slow” without measurement is not approval.
- **revisit trigger:** E1 route-cost/travel-time model plus Q2/Q3 play evidence.

## SD-011 — Renderer parity is semantic, not pixel identity

- **status:** accepted; measurement not run
- **decision:** Three.js WebGL2 and forced Canvas2D must agree 100% on navigation cells, authoritative accepted/rejected action order/count, encounter semantic-event order/count, final campaign state, trace, and canonical save bytes. The minimum matrix is 10 stages ×3 input modalities ×2 renderer modes =60 cases; differences and uncaught errors must be zero.
- **evidence/rationale:** both renderers import `stage-navigation.js`; Canvas has its own pointer/path presentation and Three.js its own input/movement presentation (`battle-visualizer.js:808-881`; `battle-realtime-three.js:400-415,505-519`). The newest retained browser evidence proved selection—4 GLBs/13 clips versus 45 bridge PNG requests—not direct state/save parity (`_workspace/20260718-resource-refinement/qa/gate-measurements.md:139-151`).
- **consequence:** visual composition, sprite/model animation, and camera may differ. Gameplay semantics, feedback availability/timing, trace, and save may not.
- **revisit trigger:** none for semantic parity. Pixel matching remains explicitly out of scope.

## SD-012 — Deterministic save acceptance is stronger than one round trip

- **status:** accepted; scoped baseline observed
- **decision:** final G6 requires all 10 stage checkpoints, 100% live reward branches, at least 1,000 seeded sequences ×150 operations, zero restored-state mismatch, zero recreated canonical-envelope byte mismatch, and zero acceptance of incompatible schema/rules or impossible traces.
- **evidence/rationale:** source replay validation is explicit (`campaign-state.js:1179-1211`). The parent-provided v6 baseline reports 150,000 fuzz operations, 6,051 save/restore round trips, oversized/legacy rejection, zero findings, and identical double run (`/tmp/abyssal-balance-v6.json:1321-1434`).
- **consequence:** the fuzz/double-run result is a positive scoped baseline. It does not yet prove all stage/reward checkpoint coverage, renderer/input parity, or canonical recreated-envelope byte equality. QA must preserve the output durably with command, timestamp, build/revision, and checksum before using it in a verdict.
- **revisit trigger:** after any rules, map-semantic-event, action, reward, save, input dispatch, or renderer event-bridge change, rerun the full final-candidate matrix; prior output becomes baseline only.

## SD-013 — G6 operations thresholds are frozen before Stage 3

- **status:** accepted operations principle; numeric frame bands superseded and finalized by SD-018/SD-020; measurement not run
- **decision:** Stage 3 G6 requires mean/p95/p99 frame interval `≤16.7/20/25 ms`, no over-budget streak longer than three frames, command feedback p50/p95/hard max `≤50/100/200 ms`, 30-minute soak with `≤5%` post-warmup memory growth, path-build median/p95 `≤8/12 ms`, telemetry/release-readiness checklist `100%`, and one tested rollback, in addition to the frame/input/renderer/save thresholds below.
- **evidence/rationale:** SD-018 reconciles QA/engineering source packets; SD-020 freezes the stricter final candidate bands. The `≤5%` memory-growth bound and explicit frame distribution make “stable” mechanically testable for this run.
- **consequence:** a simulator, syntax check, one renderer screenshot, or short smoke test cannot pass G6. Missing raw data remains `NOT RUN`.
- **revisit trigger:** device-tier segmentation may add stricter/slower named profiles, but no tier may omit renderer/input/save determinism, command p95 `≤100 ms`, or open-S1=0.

## SD-014 — Prior evidence is split into carry-forward baselines and stale results

- **status:** accepted
- **decision:** carry the 2026-07-18 15-asset/45-bridge/188-manifest structural results only when referenced files/hashes are unchanged; carry the Three.js/Canvas browser packet only as renderer-selection baseline; carry prior architecture only as a principle refreshed by current source. Treat all v2/v3 balance/determinism and unpinned results as stale; v6 is now a pre-change comparator only for v7 numeric verdicts.
- **evidence/rationale:** the resource QA ledger explicitly says direct failure equivalence, compact/reduced-motion, and full G6 were unscored and Stage 1 exit was `FIX` (`_workspace/20260718-resource-refinement/qa/gate-measurements.md:13-27,139-151`). Older evidence pins v2/v3; `/tmp/abyssal-balance-v6.json` pins v6; current source is v7 (`campaign-state.js#05B1:1`).
- **consequence:** old artifacts may supply methods, fixtures, baseline resource inventory, and explicitly labeled before/after comparisons. Their pass counts, win rates, exploit counts, stage numerator, save claims, or gate verdicts may not be copied into v7 gate reviews.
- **revisit trigger:** a retained artifact that pins v7, exact command/session, timestamp, build/revision, and unchanged subject may be admitted by a new decision-log entry.

## SD-015 — The parent-provided v6 simulation is observed, incomplete evidence

- **status:** accepted as pre-change v6 baseline; invalid for v7 gate verdicts
- **decision:** record `/tmp/abyssal-balance-v6.json` truthfully and preserve it under this run as a before-change comparator; never use it to pass current gates.
- **evidence/rationale:** the file pins `abyssal-surge-rules-v6`, stages 1–10, 12-pair early reward coverage, 200 casual trials, 1,000×150 fuzz, and deterministic double-run identity. It lacks durable run-local provenance and predates the v7 Echo/cap semantics (`/tmp/abyssal-balance-v6.json:1-16,390-427,1102-1105,1321-1434`; SD-021).
- **consequence:** all v7 G2/G3/G6/G7 balance/save values remain `NOT RUN` or `FIX`; v6 numbers may explain the selected direction but cannot satisfy a threshold. No human fairness inference is allowed.
- **revisit trigger:** QA preserves the v6 comparator and separately produces a fully pinned v7 run; the two outputs must never be merged into one gate sample.

## SD-016 — No-commercial and no-multiplayer boundaries remain closed

- **status:** accepted
- **decision:** no paid power, store, entitlement, randomized purchase, reward-access change, account, cloud save, network authority, co-op, matchmaking, ranked, or anti-cheat work enters this beat.
- **evidence/rationale:** prior production decisions deferred multiplayer and kept the live game non-commercial (`_workspace/20260716-shadow-lord-rts-rpg/production/decision-log.md:7-12`). The current ask is tactical depth and responsiveness, not backend or monetization.
- **consequence:** the no-commercial/no-paid-power boundary is implementation context only; it does not satisfy G5. Canonical paid/free delta, instant-reversal probability, free-path parity, and signed revenue-point evidence remain required before Stage 2 exit. Any commercial/reward-access proposal also requires a separate approved scope decision. Any multiplayer proposal becomes a separate architecture/intake cycle and cannot justify a duplicate reducer here.
- **revisit trigger:** explicit user request and a separate approved cycle.

## SD-017 — Discovery batch changes documents only

- **status:** accepted
- **decision:** this batch creates only `intake/production-brief.md`, `production/task-manifest.md`, and `production/decision-log.md`. It does not edit code, tests, workflow, caches, assets, or existing `_workspace` runs, and the director executes no tests.
- **evidence/rationale:** assignment scope is research/design artifacts before production work.
- **consequence:** every implementation/verification row in `task-manifest.md` is `assigned`, `planned`, or `blocked`; no code completion or gate pass is implied.
- **revisit trigger:** a later explicit implementation assignment after the artifact packet is accepted.

## Explicit non-goals confirmed by decision

- Pixel-identical Three.js and Canvas output; semantic and feedback parity is required instead.
- A new pathfinder that embeds campaign rules; pathfinding remains presentation/navigation support.
- Automatic movement/enemy speed changes because grid area grows.
- Full G4 art/immersion work, resource refinement, cinematic, audio, video, or asset provenance work.
- Full project tests or broad release commands in this discovery packet.
- Any claim that deterministic agents or branch fractions equal human strategy diversity, fairness, fun, or voluntary replay.

## SD-018 — QA/engineering control and runtime specification is approved for implementation

- **status:** `PASS-FOR-IMPLEMENTATION` for the control/runtime specification; this is not a Stage 2 or G6 gate pass
- **decision:** approve the following exact implementation values and order from the landed QA/engineering packet:
  1. fix the Canvas all-breached-wave predicate and authoritative input conflicts before map scaling;
  2. keep the tactical runtime ephemeral and reducer-subordinate; it may own spatial positions/paths/contact clocks and propose encounter events, but only `campaign-state.js` accepts them;
  3. use a deterministic fixed step of `1/60 s`, `MAX_FRAME_DELTA_SECONDS=0.10`, and `MAX_CATCH_UP_STEPS=6`;
  4. preserve commander walk `4.1`, Shift surge `7.2`, enemy advance `2.4`, and collision subdivision `0.12` for the parity cutover; add commander acceleration `28 units/s²` and deceleration `36 units/s²`;
  5. use camera follow `tau=0.1304 s`, zoom `tau=0.090 s`, wheel sensitivity `0.012 world-units/pixel`, and fit padding `1.10`;
  6. normalize drag/tap classification at `6 CSS px` Euclidean for mouse/pen, `12 CSS px` Euclidean for touch, and `500 ms` maximum tap duration; campaign actions use non-conflicting bindings rather than `A`/`D` while the battlefield owns WASD;
  7. require legal path completion ≥99%, unwalkable/collider penetration `0`, unexplained stall ≤500 ms, and path duration ≤`1.25×` ideal +250 ms;
  8. require equal-wall-time final-position difference ≤`0.02` grid units and camera target difference ≤`0.001` world units at 30/60/120 Hz, with exact ordered breach/wave transcript equality;
  9. require command acknowledgement p50 ≤50 ms, p95 ≤100 ms, p99 ≤150 ms, max ≤200 ms, and modality p95 spread ≤16.7 ms, with ≥500 samples per renderer/input/device profile;
  10. require frame interval mean/p95/p99 ≤16.7/20/25 ms, no over-budget streak longer than three frames, zero >100 ms input-adjacent frames, a 30-minute post-warmup memory-growth check ≤5%, and the QA 60-minute stress check ≤10%.
- **evidence/rationale:** `engineering/architecture-contract.md:49-71,210-230`, `engineering/movement-optimization.md:41-65,67-155,205-250`, `engineering/perf-budget.md:72-140`, and `qa/test-plan.md:43-129` converge on the same one-runtime/parity direction and expose S1 risks in duplicated wave/event/input behavior. These values are stricter where packets differed: the director keeps the engineering `0.02/0.001` frame tolerances, the intake p99 `150 ms`, the QA hard max `200 ms`, and both the 30- and 60-minute memory checks.
- **consequence:** the implementation owner may build the parity/control/runtime slices with these numbers without waiting for map/reward tuning. The owner may not claim G6 until QA measures every required profile. The shared tactical runtime is not permission to duplicate campaign rules or persist spatial snapshots as campaign authority.
- **revisit trigger:** a focused implementation probe fails because a threshold is physically inconsistent with the specified device profile; any counterproposal must include raw samples, exact replacement number, affected source symbol, and risk.

## SD-019 — Stage 2 content/balance specification remains FIX pending designer packet

- **status:** `FIX-BLOCKED`, interim
- **decision:** map topology, archetype targets, reward-family retunes, core-loop timing, and novelty implementation are not approved until the designer’s `balance-sheet.md`, `core-loop.md`, `novelty-scorecard.md`, and cited survey artifacts land and the PM negotiation record is signed or explicitly arbitrated.
- **evidence/rationale:** QA and engineering provide measurement/architecture contracts, while PM entries 3–7 remain `pending-designer` (`pm/negotiation-record.md:56-197`). Current v6 results split deterministic strategies at 0%/100% and casual at 40%, so preserving all numbers without a design decision is not a neutral pass.
- **consequence:** implementation may fix reducer-external parity/control correctness under SD-018, but may not retune campaign rewards, action damage/cooldowns, map lane content, or novelty mechanics yet.
- **revisit trigger:** designer artifact handoff; the director will then replace this interim FIX with exact accepted/countered values and implementation order.

## SD-020 — Final Stage 2 numeric adjudication and integrated implementation order

- **status:** `accepted-for-integrated-implementation`, 2026-07-19; supersedes SD-019's interim `FIX-PENDING-DESIGN` disposition. It does **not** turn any gate into PASS.
- **public beat served:** one rules-v7 ten-stage candidate with larger readable tactical space, three real route choices per stage, deterministic renderer/input/save parity, and a measurable Stage 3 responsiveness path.
- **accepted designer packet:** `design/trend-survey/{triage,context,solutions}.md`, `design/balance-sheet.md`, `design/core-loop.md`, and `design/novelty-scorecard.md`.
- **map/topology freeze:** all ten final stages use `24×12`; `40×24` is stress-fixture-only. Each stage has exactly three authored routes, two reconnect junctions, at least four cells of intended combat frontage, at least 50% nonshared cells per route between shared junctions, at least one distinct affordance per route, longest default route at most `1.35×` shortest, measured lane success share `15–70%`, and successful-stage static-camp time at most `60%`. Portal is `(1,5.5)`, boss `(22,5.5)`; stage-specific route names, anchors, path lengths `28,30,32,32,34,34,36,36,38,40`, waves, and loop targets are frozen in `design/trend-survey/solutions.md`.
- **control freeze:** fixed step `1/60 s`, frame delta clamp `.10 s`, maximum six catch-up steps; preserve commander walk `4.1`, Shift surge `7.2`, and enemy advance `2.4` units/s; commander acceleration/deceleration `28/36 units/s²`; exponential camera follow `τ=.1304 s`, zoom default `18`, clamp `9–30`; cumulative Euclidean drag threshold `6 CSS px` for mouse/pen and `12 CSS px` for touch with tap duration at most `500 ms`; no more than five visible and four enabled primary actions.
- **measurement freeze:** command-to-first-visible/announced-feedback p50/p95/hard-max `≤50/100/200 ms` over at least 500 samples per device-input-renderer profile; identical semantic input receipt and authoritative state across pointer, keyboard, and touch; 30/60/120 Hz plus a 250 ms stall; ten-second movement endpoint difference `≤.02 world units`; camera target difference `≤.001 world units` and time-to-90%-convergence difference `≤35 ms`; mean frame `≤16.7 ms`, p95 `≤20 ms`, p99 `≤25 ms`, no sustained over-budget streak longer than three frames, draw-call/memory/path-build/soak limits remain those in SD-018.
- **renderer/persistence freeze:** `campaign-state.js` stays the single reducer and save/replay authority. `stage-navigation.js` plus one reducer-external deterministic tactical snapshot feeds both renderers. WebGL2 and forced Canvas must agree 100% on navigation cells, semantic receipts, reducer trace order/count, final state, canonical save bytes, restore/replay, retry, suspension, and fallback cutover. Presentation need not be pixel-identical.
- **reward/fairness freeze:** the zero-paid-power policy and the designer-accepted reward-family bounds in `design/balance-sheet.md#reward-family-decisions-designer-acceptance-of-pm-bounds` are approved as guardrails. No broad reward retune is approved: reward source values stay unchanged until topology/control measurement and a signed reward-by-reward proposal exist.
- **one-family balance candidate:** retain `campaign-state.js` stage `echo-throne` `commands.assault.counter.baseDamage` at `6` instead of v6’s `8` as part of rules v7. It may exist in source while topology/control authoring continues, but it must not be measured, presented, or released standalone: only the completed `24×12` ten-stage integrated v7 candidate is gate-eligible. Do not combine it with boss HP/damage, cooldown, movement-speed, or unapproved reward source-value movement.
- **candidate rationale, not gate evidence:** Main reported an isolated `/tmp` copied-module probe, with no repository edit and no durable run-local command artifact, in which Echo counter `8→6` moved seeded-casual wins from `40.0%` to `51.0%` over 200, reduced Echo Throne defeats `78→49`, preserved optimal at `100%` in `102` actions and fuzz at `150,000` operations with zero findings. Rusher still failed at Echo Throne, greedy remained `100%`, and comeback still failed at Howling Sprawl. Therefore this is approved only as the next **integrated G2 candidate**, never as a standalone release retune or evidence that G3 is healthy.
- **novelty candidate:** Undertow Reversal may be implemented only after the base S7/S9 topology and the one-family balance candidate are independently measured. It is limited to S7 Barge Deck and S9 Rite Bridge, reverses one marked current for `6 s`, has `30 s` cooldown and maximum one active instance, never changes walkability/damage/node reachability, and must survive save/restore/retry/suspension without duplication or extension. The bounded official/upstream survey frequency is `0/6`; the canonical G8 QA impression score is still not run.
- **dependency order:** shared tactical snapshot and renderer/input parity foundation (SD-018) → 24×12 ten-stage base topology → graph/reachability/renderer checks → freeze integrated rules-v7 Echo/cap scope (SD-021) → v7 simulator/archetype/loop/save measurement → Undertow prototype only if the base remains in band → full Stage 2 gate review → Stage 3 responsiveness/frame/path/soak execution. Broad reward source-value retuning remains outside this chain.
- **gate adjudication now:** **G2 `FIX`** (current-v7 mechanics/casual/combo subcriteria pass; matchup/TTK absent); **G3 `FIX`** (optimal and greedy remain 100% dominant and only casual is viable in band); **G5 `FIX/NOT RUN`** (all four fairness and signed-record measurements absent); **G6 `FIX/NOT RUN`** (source/fuzz implementation evidence exists but canonical telemetry/rollback/readiness/frame/soak/input measurements are absent); **G7 `FIX`** (numeric model accepted; timing/re-entry human evidence absent); **G8 `FIX`** (0/6 frequency subcriterion passes; QA impression absent). Stage 2 implementation may continue; Stage 2 has not exited and Stage 3 has not passed.
- **focused verification:** current-v7 source/mechanic audit; pinned v7 ≥200 seeded casual runs with CI/defeat histogram/identical double-run; ≥5 archetypes with ≥3 viable at 45–55%; route graph metrics every stage; v7 all-stage reward/build matrix; exact pointer/keyboard/touch × WebGL2/Canvas traces; v7 canonical save replay plus zero accepted v6 envelopes; ≥500 feedback samples/profile; 30/60/120 Hz and stall traces; 30-minute soak; human G7/G8 sessions.
- **revisit triggers:** any route outside its structural/outcome bands, casual outside 45–55%, persistent polarized archetypes, renderer/input/save divergence, feedback or frame/path/soak miss, Undertow impression below 4/5, any failed G5 fairness threshold, or any proposed reward source-value movement.

## SD-021 — Rules v7 cutover is required and scope-locked

- **status:** `accepted-and-retained`, 2026-07-19; no gate PASS implied
- **decision:** keep `RULES_VERSION = \"abyssal-surge-rules-v7\"`. Authoritative rule semantics changed, so retaining v6 would permit incompatible v6 trace envelopes to be considered current. Save schema remains version `5`; rules-version mismatch remains a hard rejection, not a silent migration.
- **exact authorized rule delta at source snapshot `[campaign-state.js#05B1]`:**
  1. Echo Throne `commands.assault.counter.baseDamage = 6` (`:142-146`), changed from the v6 value `8`;
  2. aggregated earned-reward benefit floors/caps are cooldown multiplier `≥0.60`, possessed assault bonus `≤4`, counter reduction `≤3`, materialize bonus `≤4`, and entry aegis `≤2` (`:679-683`);
  3. reward **source values stay at their restored pre-cutover values**: Rift Lens `possessedAssaultBonus=4`, Stillwater Hourglass `cooldownMultiplier=.8` plus `autoExtract=true`, Shadebreaker Brand `counterReduction=2` (`:65-69`), and Colossus Plate `counterReduction=2` (`:398-401`); all other reward source values and trace copy remain unchanged.
- **explicitly unauthorized:** no reward description/effect source-value retune, boss HP/damage change, cooldown source change, movement-speed change, second counter-family change, compatibility shim accepting v6 as v7, or save-schema bump.
- **evidence/rationale:** `[campaign-state.js#05B1]` directly shows v7, Echo `6`, restored reward source values, and caps. `createSaveEnvelope` records `rulesVersion`; `restoreSaveEnvelope` rejects a mismatch. That is the correct deterministic boundary when replayed actions can produce different integrity/damage/benefit outcomes.
- **measurement consequence:** all integrated balance, archetype, combo, save/replay, and fuzz evidence must pin `abyssal-surge-rules-v7`, save schema `5`, exact command, timestamp, build/revision, seed set, and retained raw artifact. Explicit v6-envelope rejection count must be zero accepted. `/tmp/abyssal-balance-v6.json` and the isolated Echo probe are pre-change rationale only.
- **gate consequence:** G2/G3/G6/G7 remain `FIX/NOT RUN` for v7; G8 retains only its 0/6 survey-frequency subcriterion. The rules cutover does not cure polarized archetypes or prove deterministic replay.
- **revisit trigger:** any further authoritative rule or reward source-value change requires a new rules version, a new director scope decision, and fresh full-version measurements; a presentation-only change does not.
