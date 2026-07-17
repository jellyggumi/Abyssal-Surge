# Abyssal Surge — core-loop contract

## G7 numeric contract

A qualifying loop is **30–180 seconds**, contains **at least 3 player actions**, and ends in **at least 1 reward event**. The following are design targets derived from the current deterministic action gates; they are **not measured session timings**. G7 remains **NOT-RUN** until voluntary play evidence exists.

| Stage | Target / permitted band | Minimum legal route (semantic actions) | Count | Reward event | Narrative purpose |
|---|---:|---|---:|---|---|
| Cinder Span | 75 s / 30–180 s | Hunt → Hunt → Extract → Materialize → Capture → Assault×3 → choose reward | 9 | exactly one S1 boon | Bind residue, then face its guardian. |
| Veil Citadel | 100 s / 30–180 s | Hunt → Hunt → Extract → Materialize → Capture×2 → Possess → Assault×3 → choose reward | 11 | exactly one S2 boon | Reclaim a distorted command network. |
| Echo Throne | 120 s / 30–180 s | Hunt → Hunt → Extract → Materialize → Capture → Domain (optional, once) → Assault×5 → choose reward | 11–12 | exactly one S3 record | Survive the gate and conclude the campaign. |

All rows exceed G7’s ≥3-action threshold and include a stage reward. The listed Assault counts are the unmodified base-damage route at full boss health; reward choices and Domain can alter a legal route. Numeric authority is `campaign-state.js` / `BALANCE`, mirrored in [balance-sheet.md](balance-sheet.md).

## Deterministic state route

```text
START
  → HUNTED_1 → HUNTED_2 → EXTRACTED → MATERIALIZED → REQUIRED_NODE_HELD
  → [S2: POSSESSED] → [S3: DOMAIN_AVAILABLE / DOMAIN_USED]
  → BOSS_ASSAULTED → REWARD_CHOICE → NEXT_STAGE or CAMPAIGN_COMPLETE
```

| Boundary | Runtime condition | Story / G1 trace |
|---|---|---|
| Hunt | A stage permits two Hunt marks before Extract. | Ash Echo and rift spoor: AS-WV-004, AS-WV-013/026/037 |
| Extract | Two marks are required; normal Extract grants four souls. | Soul binding fiction: AS-WV-004, AS-WV-009 |
| Materialize | Requires two souls and free capacity; base result is two shades. | **일어나라** / Arise: AS-WV-009 |
| Capture | Requires legion ≥2; Stage 1/3 require one node, Stage 2 requires two. | Relay/fortress/throne: AS-WV-005, AS-WV-007, AS-WV-008 |
| Possess | Stage 2 only, needs ≥1 node, and can occur once. | Veil scene and turn: AS-WV-027, AS-WV-068, AS-WV-072 |
| Domain | Stage 3 only, needs throne node, and can occur once. | Lord's Domain: AS-WV-010, AS-WV-069 |
| Assault | Requires all stage nodes; Stage 2 also requires possession. | Stage antagonists: AS-WV-014, AS-WV-027, AS-WV-038 |
| Reward | A defeated boss presents that stage’s exact reward set; exactly one selection advances or completes the campaign. | AS-WV-016–043 |

## Stage-story handoff

| Handoff | Player-visible consequence | Narrative beat/cue trace |
|---|---|---|
| S1 reward → S2 | The selected boon carries into Veil Citadel; the next gate asks for possession after two nodes. | AS-WV-048–050, AS-WV-056–058, AS-WV-068, AS-WV-072 |
| S2 reward → S3 | The selected boon carries into Echo Throne; the one-use Domain becomes available after the throne node. | AS-WV-051–052, AS-WV-059–061, AS-WV-069, AS-WV-073 |
| S3 reward → complete | A record reward is chosen; no next stage is implied. | AS-WV-062–064, AS-WV-040–043 |
| Defeat → retry | The same stage can be retried; prior reward selections are not a narrative excuse to bypass a gate. | AS-WV-065–066, AS-WV-074 |

## G7 evidence plan

Record **10 voluntary repeats** on a stable browser build. For each: stage, start/finish timestamps, ordered command trace, reward reached, and the player’s repeat/stop choice. Pass only if the measured median loop lies in 30–180 seconds, every sampled loop has ≥3 commands and ≥1 reward event, and the voluntary-repeat proxy is ≥70%. Current evidence: **NOT-RUN**; target times above are not a substitute for this measurement.
