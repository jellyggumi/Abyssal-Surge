---
run_id: 20260716-design-cadence-cycle-009-v1
owner: game-production-director
created_at: 2026-07-16T22:30:00Z
generator: node scripts/balance-numbers.mjs
immutable: true
---
# Quantified balance — stage envelopes (frozen reducer sweep)

| Stage | Schedule | INT/FOC/FOE | DISRUPT curve | RT cd/speed/regen | Decision budget | 64-plan V/H/Di/Dp/A/inv | Victory plans |
|---|---|---|---|---|---|---|---|
| 1 | STRIKE/STRIKE/STRIKE | 6/3/6 | 1→1→1 | 3.5s/33.3%/0.5 | 10.5s | 1/13/2/0/0/48 | STRIKE,STRIKE,STRIKE |
| 2 | SURGE/STRIKE/STRIKE | 6/3/8 | 1→1→1 | 3.2s/33.3%/0.5 | 9.600000000000001s | 0/10/20/0/0/34 | — |
| 3 | STRIKE/SURGE/STRIKE | 8/4/10 | 1→1→1 | 3s/36%/0.5 | 9s | 0/14/4/0/0/46 | — |
| 4 | STRIKE/SURGE/SURGE | 6/3/12 | 1→1→1 | 2.8s/36%/0.5 | 8.399999999999999s | 0/8/23/0/0/33 | — |
| 5 | SURGE/SURGE/STRIKE | 6/4/5 | 1→2→3 | 2.5s/40%/0 | 7.5s | 2/7/22/0/0/33 | STRIKE,DISRUPT,STRIKE · DISRUPT,STRIKE,STRIKE |

Awards: VICTORY=2 fragments, HOLD=0 (stage1-rules-v2).

⛔ STOP-SHIP BALANCE FINDING: stage(s) 2, 3, 4 lack an intentional victory plan and/or a reachable defeat — semantic economy decision owned by P2 systems (peer). Run with --gate to enforce as CI failure.
