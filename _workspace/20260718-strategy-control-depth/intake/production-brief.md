# Strategy & Control Depth — Production Brief

```yaml
game_type: "deterministic single-player browser RTS / tactical campaign"
team_shape:
  director: game-production-director
  specialists: [game-designer, game-pm, game-programmer, game-qa]
engine: "ES modules + deterministic campaign reducer + Three.js WebGL2 primary renderer + Canvas2D fallback"
current_stage: "Stage 2 integrated implementation authorized under SD-018/SD-020/SD-021; Stage 3 evidence execution and gate passage blocked"
next_public_beat: "A rules-v7 ten-stage tactical-depth build in which every stage presents exactly three materially distinct routes, at least three of five tested strategies remain viable, command feedback p95 is at most 100 ms, movement/camera outcomes are frame-rate independent, and Three.js/Canvas plus pointer/keyboard/touch produce identical authoritative traces and deterministic saves."
source_packet:
  - "campaign-state.js:1-14,31-514,1175-1211"
  - "stage-navigation.js:1-130"
  - "battle-realtime-three.js:29-35,369-415,505-519,927-959,1005-1039,1079-1130,1157-1177"
  - "battle-visualizer.js:26-30,808-881"
  - "app.js:2118-2157,2160-2178,2430-2501"
  - "scripts/run-campaign-balance-sim.mjs:1-30"
  - "/tmp/abyssal-balance-v6.json:1-25,111-116,204-209,297-302,390-410,413-427,1102-1105,1321-1434 (parent-provided v6 simulation output; not yet a durable run artifact)"
  - "_workspace/20260718-resource-refinement/qa/gate-measurements.md:1-38,121-151"
  - "_workspace/20260718-resource-refinement/qa/benchmark-notes.md:9-35,71-83"
  - "_workspace/20260716-shadow-lord-rts-rpg/qa/gate-measurements.md:21-28"
  - "skill://game-studio-harness/references/{artifact-contract,quality-gates,stage-cycle}.md"
main_constraint: "Increase tactical space and strategic choice without creating a second rules authority, accepting rules-v6 envelopes under changed rules-v7 semantics, or allowing renderer/input presentation paths to define campaign outcomes."
main_question: "What map, balance, control, parity, and persistence thresholds must be proven before the Stage 2 balance cycle can hand a build to Stage 3 responsiveness and operations hardening?"
operating_mode: "Stage 2 integrated balance/core-loop implementation, with a conditional Stage 3 responsiveness/performance handoff"
truth_status: "director research/design lane changed no production code and ran no tests; Main retained an authorized rules-v7 cutover (Echo 8→6 plus reward aggregation caps), while the parent-provided v6 simulator output remains a pre-change scoped baseline only"
```

## 1. Public beat and entry decision

The next public beat is the **rules-v7 strategy-and-control-depth candidate**, not this document packet. The original intake inspected rules v6; SD-021 records the intentional version cutover required by authoritative rule changes.

**Entry decision:** enter **Stage 2 integrated implementation** in the exact order frozen by SD-020/SD-021. Parity/control and measurement foundations may proceed during Stage 2 under SD-018. Stage 3 evidence execution and gate passage remain **blocked** until G2, G3, G5, G7, and G8 each record a full canonical `PASS` with measured values, methods, durable evidence paths, and zero open S1 defects.

This is not a gate verdict. No rules-v7 balance simulation, control-latency session, frame-rate comparison, renderer trace diff, or save fuzz run was executed by the director.

## 2. Observed current facts

| ID | Observed fact | Source | What it does **not** prove |
|---|---|---|---|
| O-01 | `RULES_VERSION` is now `abyssal-surge-rules-v7`; save schema version remains `5`; the save event cap remains `400`. The cutover changes Echo Throne counter base damage `8→6` and caps aggregated earned-reward benefits without changing reward source values. | `campaign-state.js:1-14,65-69,142-147,651-684`; SD-021 | It does not prove any v7 balance or persistence gate passes; all v6 envelopes/results are pre-change baselines. |
| O-02 | `STAGES` contains numbered stages 1 through 10. | `campaign-state.js:31-514` | It does not prove ten maps are tactically distinct. |
| O-03 | Shared tactical navigation is 16×8 (128 gross cells), with one portal, boss, and node anchor family. Both renderers import the same navigation module. | `stage-navigation.js:1-10,26-130`; `battle-realtime-three.js:3-7`; `battle-visualizer.js:26-30` | Shared data does not prove equal interaction or semantic-event behavior. |
| O-04 | Realtime commander movement uses `4.1` world units/s normally and `7.2` with Shift surge; enemy advance uses `2.4` world units/s. Movement integrates `speed * dt`. | `battle-realtime-three.js:35,1005-1039,1079-1105` | These values are baselines, not recommended larger-map tuning and not measured travel-time quality. |
| O-05 | Camera follow uses a fixed per-frame `lerp(..., 0.12)` even though `updateCamera` receives `dt`. | `battle-realtime-three.js:1157-1177` | It is not frame-rate independent. No observed device delta is claimed. |
| O-06 | Campaign command buttons and keyboard shortcuts converge on `handleAction`; accepted campaign transitions call `applyAction` or `applyEncounterEvent`, then synchronize presentation and persist. | `app.js:2118-2157,2470-2501` | Touch/pointer/keyboard equality and latency have not been measured. |
| O-07 | Canvas uses pointer events for selection/orders and shared `createStageNavigation`; Three.js has keyboard, pointer, wheel, blur, and visibility handlers. | `battle-visualizer.js:808-881`; `battle-realtime-three.js:400-415,505-519` | The input surfaces are not yet a proved authoritative-action parity matrix. |
| O-08 | Saves contain schema, schema version, rules version, and a cloned trace. Restore replays each supported event through the same exported transitions and rejects unsupported/impossible transitions. | `campaign-state.js:1179-1211` | Source structure is not a v7 round-trip/fuzz result. |
| O-09 | The deterministic simulator imports live `RULES_VERSION`, `STAGES`, public transitions, and save/restore functions; it declares 200 casual trials and 1,000 fuzz sequences ×150 operations. Its header still says “rules v5.” | `scripts/run-campaign-balance-sim.mjs:1-30` | v6 output cannot pass the v7 candidate; the stale comment must not be used as provenance. |
| O-10 | The newest retained browser evidence proves renderer **selection** only: Stage 1 Three.js loaded 4 GLBs/13 clips, and forced WebGL2 unavailability selected Canvas and requested 45 bridge PNGs. Direct trace/save equivalence remained unscored. | `_workspace/20260718-resource-refinement/qa/gate-measurements.md:139-151` | It does not prove renderer parity, input parity, ten-stage map scale, or v7 determinism. |
| O-11 | A parent-provided v6 simulator output reports: rusher 0% and defeat at Echo Throne after 20 actions; comeback 0% and defeat at Howling Sprawl after 47; greedy economy 100%/116 actions; optimal 100%/103; seeded casual 40% over 200 trials with 120 defeats (Echo Throne 78, Sunken Bastion 19, Howling Sprawl 17, six across later stages); all 12 Stage-1×Stage-2 reward pairs covered with max/median completion-per-action 1.1685×; 1,000×150 fuzz operations, 6,051 save/restore round trips, zero findings; branch fractions 0.6923–0.8537; deterministic double-run identical. | `/tmp/abyssal-balance-v6.json:1-25,111-116,204-209,297-302,390-410,413-427,1102-1105,1321-1434`; received from parent agent, not executed in this intake | This is deterministic policy/proxy evidence, not human fairness, live TTK, map-lane viability, control latency, renderer/input parity, voluntary loop re-entry, or a full gate pass. The `/tmp` location is not durable gate evidence until copied by QA with command, timestamp, and build/revision. |

## 3. Immutable constraints

1. **One authority:** `campaign-state.js` remains the only authority for campaign rules, accepted actions, encounter events, rewards, retries, trace, save, and replay. Presentation may request or display a transition; it may not define one.
2. **No duplicate reducer:** do not fork stage rules into Three.js, Canvas, input adapters, map code, storage, or a second “tactical” campaign reducer. All authoritative actions converge on the public campaign transition surface.
3. **Renderer/fallback parity:** Three.js and Canvas consume the same stage navigation semantics. Renderer success, failure, reduced-motion selection, or fallback may not change accepted action count/order, encounter event meaning, state, reward, trace, or save.
4. **Deterministic local save:** v7 envelopes remain trace-based, rules/schema-pinned, replay-validated, and reject incompatible v6 or impossible events. Storage remains transport/cache, not a second authority.
5. **Input convergence:** pointer, keyboard, and touch may have different affordances but must call the same authoritative action path and produce one intended action at most.
6. **Frame-rate independence:** movement and camera behavior use elapsed time or an equivalent fixed-step contract; frame count must not change gameplay-visible displacement or follow behavior.
7. **Ten-stage completeness:** map-scale work covers all 10 live stages. A three-stage sample may be a smoke test, never the acceptance numerator.
8. **No commercial rebalance:** the public beat adds no paid power, store, entitlement, randomized purchase, or comeback monetization. Any such proposal reopens G5 and requires a separate signed PM/designer decision.
9. **No speculative multiplayer:** no account, server authority, matchmaking, co-op, WebSocket, ranked, anti-cheat, or cloud-save implementation belongs in this beat.
10. **Evidence honesty:** old results may be methods or baselines only where explicitly allowed below. Missing v7 measurement is `NOT RUN`, never inferred `PASS`; v6 output is pre-change comparison only.

## 4. Frozen acceptance thresholds

```yaml
map_scale:
  source_baseline: {width_cells: 16, height_cells: 8, gross_cells: 128}
  candidate_minimum: {width_cells: 24, height_cells: 12, gross_cells: 288}
  gross_area_multiplier_min: 2.25
  live_stages_covered: 10
  materially_distinct_lanes_or_zones_per_stage_min: 3
  viable_route_cost_vs_shortest_max: 1.35
  route_choice_junctions_per_stage_min: 2
  route_nonshared_cell_fraction_min: 0.50
  combat_frontage_cells_min: 4
  lane_success_share_band: [0.15, 0.70]
  static_camp_successful_stage_time_fraction_max: 0.60
  renderer_navigation_cell_agreement: 1.0
strategy_diversity:
  mechanics_in_balance_sheet_coverage: 1.0
  tested_archetypes_min: 5
  independently_viable_archetypes_min: 3
  viable_matchup_win_rate_band: [0.45, 0.55]
  dominant_archetype_optimal_play_share_max: 0.50
  ttk_target_tolerance_fraction: 0.15
  combo_ev_vs_median_max: 1.30
  core_loop_period_seconds: [30, 180]
  actions_per_loop_min: 3
  reward_events_per_loop_min: 1
  voluntary_loop_reentry_rate_min: 0.70
control_responsiveness:
  command_to_first_visible_or_announced_feedback_p50_ms_max: 50
  command_to_first_visible_or_announced_feedback_p95_ms_max: 100
  command_to_first_visible_or_announced_feedback_p99_ms_max: 150
  command_to_first_visible_or_announced_feedback_hard_max_ms: 200
  accepted_or_rejected_action_samples_per_profile_min: 500
  duplicate_or_missing_authoritative_actions_max: 0
  fixed_step_seconds: 0.016666666667
  max_frame_delta_seconds: 0.10
  max_catch_up_steps: 6
  mouse_pen_drag_threshold_css_px: 6
  touch_drag_threshold_css_px: 12
  max_tap_duration_ms: 500
  frame_rates_tested_hz: [30, 60, 120]
  scripted_motion_duration_seconds: 10
  endpoint_position_divergence_world_units_max: 0.02
  camera_target_divergence_world_units_max: 0.001
  camera_time_to_90_percent_divergence_ms_max: 35
renderer_parity:
  renderer_modes: [three_webgl2, canvas2d_forced_fallback]
  authoritative_trace_order_and_count_agreement: 1.0
  final_campaign_state_agreement: 1.0
  canonical_save_byte_agreement: 1.0
  stage_input_renderer_matrix_cases_min: 60
  uncaught_errors_max: 0
  semantic_event_differences_max: 0
deterministic_saves:
  required_rules_version: "abyssal-surge-rules-v7"
  required_save_schema_version: 5
  live_stage_checkpoints_covered: 10
  live_reward_branches_covered: 1.0
  seeded_fuzz_sequences_min: 1000
  fuzz_operations_per_sequence_min: 150
  restored_state_mismatches_max: 0
  recreated_envelope_byte_mismatches_max: 0
  incompatible_or_impossible_envelope_acceptances_max: 0
operations:
  frame_time_p95_ms_max: 16.7
  long_frame_fraction_max: 0.005
  soak_duration_minutes_min: 30
  post_warmup_memory_growth_fraction_max: 0.05
  open_s1_defects_max: 0
novelty:
  comparable_rts_titles_min: 5
  titles_containing_candidate_element_max: 2
  qa_impression_score_min: 4.0
  qa_impression_scale_max: 5.0
```

### What counts as a materially distinct lane or zone

A stage qualifies only when at least three navigable routes or tactical zones each satisfy all of the following:

- connect a player staging region to an objective/pressure region or create a defensible objective subspace;
- have at least 50% route cells outside shared entry/exit junctions not shared with either other route;
- provide at least one distinct tactical affordance and differ from another route in at least two of elevation, obstacle/void topology, objective access order, travel cost, hazard/exposure, or defensible frontage;
- preserve at least four cells of intended combat frontage, two reconnect junctions per stage, and a longest default path no more than 1.35× the shortest;
- produce a measured successful-route share of 15–70% per lane and allow no static camp to occupy more than 60% of successful-stage time;
- remain independently connected if either other route is blocked outside the shared entry/exit;
- be represented identically by `createStageNavigation` in both renderers.

A palette swap, boss tint, decorative prop cluster, or two visually named paths over the same navigation cells does not count.

## 5. Gate ownership and exit contract

| Gate | Owner(s) | Required numeric proof for this beat | Entry/exit consequence |
|---|---|---|---|
| G1 | game-qa audits; game-designer signs narrative closure | 0 unwaived lore violations; 100% of shipped strings, effects, and scenarios trace to `design/worldview.md` | Any missing trace or open violation is `FIX`; Stage 3 cannot exit. |
| G2 | game-designer authors numbers; game-qa measures; game-programmer exposes data without a second rules path | 100% mechanic coverage; all eligible matchup rates 45–55%; measured TTK within ±15% of declared target; max combo EV ≤1.30× median; all 10 maps meet the scale/lane contract | Any missing matrix cell or out-of-band result is `FIX`; no Stage 3 handoff. |
| G3 | game-qa owns archetype rotation; game-designer owns corrective design | ≥5 archetypes tested; ≥3 independently viable with distinct strategies and 45–55% band; no archetype >50% optimal-play dominance | Missing viability or excess dominance is `FIX`; the third failed FIX loop requires director `REDO`/scope arbitration. |
| G4 | game-qa scores scenes and verifies readability | median immersion ≥4.0/5; effect-feedback latency ≤100 ms in spot checks; 0 unresolved S1/S2 readability complaints | Any missing score/probe/audit or failed threshold is `FIX`; Stage 3 cannot exit. |
| G5 | game-qa runs fairness simulations; game-pm and game-designer sign the revenue-point audit | paid/free win-rate delta ≤5%p; instant-reversal probability ≤30% per activation with cap/cooldown; free-path parity within 10–20 sessions; every revenue point signed | The no-paid-power boundary is implementation context only; all four measurements must pass before Stage 2 exit. |
| G6 | game-programmer measures; game-qa independently verifies; director adjudicates | telemetry contract fields emitting; rollback runbook tested once; readiness checklist 100%; p95 frame ≤16.7 ms; long frames <0.5%; memory stable over a 30-minute soak; input ≤100 ms | Stage 3 cannot pass on a source audit, unit test, fuzz result, or extra diagnostic threshold alone. |
| G7 | game-designer models; game-qa confirms | at least one 30–180 s loop, ≥3 actions, ≥1 reward event, and ≥70% voluntary re-entry | Model-only result remains `FIX` until observed playtest evidence exists. |
| G8 | game-designer surveys; game-qa scores | ≥5 comparable RTS titles; candidate element appears in ≤2; QA impression ≥4.0/5 | Uncited title claims or no QA score is `FIX`. |


## 6. Proposed numeric changes and code seams

These values are authorized for the integrated implementation under SD-018/SD-020/SD-021; the director made no production edit and claims no measured result.

| Proposal | Source file / symbol | Authorized number | Risk | Focused verification required before gate |
|---|---|---:|---|---|
| Expand the shared tactical grid | `stage-navigation.js` — `STAGE_GRID_WIDTH`, `STAGE_GRID_HEIGHT`, `STAGE_TACTICAL_ANCHORS`, `buildStageHeightfield`, `createStageNavigation` | exactly 24×12 final content, 288 gross cells, all 10 stages, exactly 3 qualifying routes; 40×24 stress-only | hard-coded anchors/offsets can put portal, boss, nodes, camera, enemies, or orders outside the grid; larger area can dilute combat and lengthen waves | 10-stage graph/bounds/topology audit; both-renderer cell equality; nonshared/affordance/frontage/connectivity/ratio table; lane share 15–70%; static camp≤60%; representative browser orders |
| Replace frame-count camera easing | `battle-realtime-three.js` — `updateCamera` fixed `0.12` lerp | `alpha(dt)=1-exp(-dt/.1304)`; fixed step 1/60 s, delta clamp .10 s, six catch-up steps | wrong units or unclamped stall can snap, lag, overshoot, or diverge by refresh rate | 30/60/120 Hz + 250 ms stall; camera target delta≤.001 world units; t90 spread≤35 ms; suspension/resume |

The following observed numbers are explicitly preserved for the integrated cutover: commander `4.1`, Shift surge `7.2`, enemy advance `2.4`, collision subdivision `0.12`. Any later change must name its new value, route-length/travel-time rationale, encounter-timing risk, new rules-version impact if authoritative, and 30/60/120 Hz verification.

Additional seams that must be preserved or measured rather than duplicated:

- `battle-realtime-three.js`: world/grid offsets, input handlers, `resolveMovement`, `moveCommander`, `updateEnemies`, encounter-event emission, `updateCamera`.
- `battle-visualizer.js`: shared grid imports, pointer handlers, pathfinding, `issueMoveOrder`, public trigger API.
- `app.js`: `handleAction`, `handleReward`, `synchronizeBattleRenderer`, command-button click wiring, global action-key wiring, persistence.
- `campaign-state.js`: `STAGES`, `applyAction`, `applyEncounterEvent`, `chooseReward`, `createSaveEnvelope`, `restoreSaveEnvelope`.
- `scripts/run-campaign-balance-sim.mjs`: v7-derived balance/fuzz evidence; its stale “rules v5” header is not evidence and must be reconciled in the implementation/cleanup lane.

## 7. Evidence carry-forward ledger — v6 intake to v7 integrated candidate

| Previous evidence | Carry-forward status | Allowed use now | Stale / prohibited use under rules v7 |
|---|---|---|---|
| Resource refinement 15-asset/45-bridge structural checks and 188/188 shared manifest file/hash inventory | **Carry as presentation asset baseline if referenced assets/hashes are unchanged** | renderer resource inventory and fallback setup | cannot score G2/G3/G6/G7/G8, map scale, input latency, or save parity |
| 2026-07-18 fresh browser Three.js and forced-Canvas selection packet | **Carry as renderer-selection baseline only** | proves both renderer entry paths existed in the recorded build | cannot be relabeled renderer semantic parity; direct GLB/PNG failure, reduced-motion trace/save equivalence, and full G6 were explicitly unscored |
| 2026-07-18 three-stage browser flow | **Method/sample may carry; result is insufficient** | smoke-test shape for a future 10-stage run | only three stages; no current v7 rules pin; no 60-case modality/renderer matrix |
| Architecture invariant that presentation is not rules authority | **Carry as a design principle, refreshed by current source inspection** | constrains implementation | the old statement that the campaign had three stages is stale; current source has ten |
| v2/v3 balance simulator, exploit, playtest, and deterministic results | **STALE** | test-case ideas and report schema only | no numeric result, win rate, combo ratio, exploit count, pass count, save claim, or gate verdict carries to v7 |
| Parent-provided `/tmp/abyssal-balance-v6.json` | **Pre-change v6 scoped baseline; not v7 gate evidence** | comparator for the authorized Echo/cap changes; records deterministic policies, 200 casual trials, 12-pair coverage, 150,000 fuzz operations/6,051 save round trips/0 findings, and double-run identity | cannot establish any v7 G2/G3/G6/G7/G8 value or v7 save compatibility; the 0% rusher/comeback and 40% casual remain risk signals only |
| Main’s isolated `/tmp` Echo `8→6` copied-module probe | **Candidate rationale only** | shows one-family direction worth measuring: casual 51.0%/200, Echo defeats 49, fuzz 150,000/0 | no durable command/build artifact; omitted integrated caps/topology/control and retained polarized strategies, so it cannot pass G2/G3 or v7 determinism |

**Current evidence verdict:** every G1–G8 gate remains `FIX`. Durable v7 evidence now records mechanics coverage, one 51% casual-archetype sample, combo EV 1.1559×, five archetype outcomes (0/100/100/0/51), deterministic 1000×150 fuzz, a modeled G7 loop, and the 0/6 G8 frequency subcriterion. G2 still lacks the full matchup/TTK matrix; G3 fails dominance and three-viable-archetype thresholds; all G5 fairness/signed-record measurements are NOT RUN; G7 timing/re-entry and G8 QA impression are NOT RUN. G1 and G4 are NOT RUN. G6 source/fuzz evidence is supportive only; telemetry emission, rollback drill, readiness checklist, frame/long-frame capture, 30-minute soak, and input-latency evidence are NOT RUN. GitHub Pages v51 is separate Release evidence and does not pass any gate.

## 8. Explicit non-goals

- No production code, test, workflow, cache, asset, or prior `_workspace` run changes in this discovery packet.
- No test execution, browser session, simulation, profiler run, or gate `PASS` claim.
- No duplicate reducer, parallel tactical rules engine, renderer-owned campaign state, or snapshot-owned save format.
- No multiplayer, co-op, matchmaking, ranked ladder, server authority, account, cloud save, anti-cheat, or network transport.
- No monetization, paid power, store, entitlement, loot box, premium reward path, or G5 retune.
- No art/resource refinement, cinematic work, narrative rewrite, audio/video generation, or asset-manifest reconciliation.
- No speculative speed buff solely because the map is larger; movement/enemy values change only from measured route and encounter evidence.
- No declaration that Three.js and Canvas must look pixel-identical; parity applies to navigation semantics, authoritative outcomes, feedback availability/timing, trace, and save.

## 9. Evidence rule

Every later gate measurement must record: exact command or session, observed value, numerator/denominator, rules version, save schema version, build/revision, timestamp, and evidence path. A recommendation or source inspection is not a measurement. A missing field keeps the row `NOT RUN` or `FIX`.