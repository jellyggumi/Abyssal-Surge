# Design–PM negotiation record — non-commercial reward boundary

**Run:** `20260716-abyssal-surge-revision`
**Stage:** Stage 1 preproduction
**Commercial status:** **OUT OF SCOPE.** These entries establish constraints for the existing offline campaign; they do not approve a store, paid flow, pricing, projection, forecast, or implementation.

## Signing semantics

The `signed` arrays below are the responsible **role approvals** required by the Game Studio artifact contract, not customer consent, payment-provider approval, or evidence that a commercial feature exists. The game-designer role confirmed this boundary through the `ScenarioDesign` coordination response on 2026-07-16; the PM role authored this record. A signed boundary means both roles agree that the described action is prohibited unless a later, separately approved record replaces it with QA evidence. It does not make G5 PASS; G5 is `NOT-RUN` until QA produces a real measurement.

## Signed entries

```yaml
entry: 1
revenue_point: "No active revenue surface — session start, defeat, reward selection, progression, and ending"
balance_number: "none touched; current campaign values remain gameplay-only"
designer_bound: "No commercial interruption may appear in Cinder Span's hunt → extract → materialize → capture loop, Veil Citadel possession gate, or Echo Throne's one-use Lord's Domain and assault gate."
pm_bound: "No shop, price, paid flow, conversion target, forecast, currency, entitlement, or paid reward is proposed for this release. All commercial projection is out of scope."
agreed: "Current release is deliberately non-monetized; all identified moments are non-revenue gameplay or story progression."
signed: [game-designer, game-pm]
status: accepted-policy
scope: current-release
```

```yaml
entry: 2
revenue_point: "Stage-victory reward selection"
balance_number: "rewardRestore=1; maxIntegrity=10; cohortSummonBonus=2; lensDamage=4; hourglassCooldownReduction=0.2; brandCounterReduction=2; vanguardLegion=4; anchorRestore=2; bannerSummonBonus=1; bannerInitialAegis=1"
designer_bound: "Cinder Span and Veil Citadel each offer exactly one earned doctrine choice after victory; Echo Throne offers one commemorative archive choice after victory. Selected rewards may preserve tactical variety but cannot be bought, rerolled, duplicated, skipped, or converted into inventory products."
pm_bound: "Every current reward is non-commercial progression. No reward is a price/reward pair, and no paid alternative, premium currency, paid revive, booster, or reward reroll is permitted."
agreed: "Keep the existing reward table as earned campaign progression only; gameplay balance is governed by the named constants and must not be monetized."
signed: [game-designer, game-pm]
status: accepted-policy
scope: current-release
source: "campaign-state.js:8-30, 37-109, 408-432"
```

```yaml
entry: 3
revenue_point: "Echo Throne comeback — Lord's Domain"
balance_number: "domainUses<=1; domainRestore=4; domainAegis=2; reversal_probability_max=0.30"
designer_bound: "Lord's Domain remains a single earned Stage 3 action, unlocked only after the throne node is secured. Its recovery and aegis cannot be sold, refreshed, multiplied, offered on defeat, or made cosmetic-dependent."
pm_bound: "A paid comeback is rejected. The general G5 reversal threshold is retained only as a future QA guardrail; no purchase path is created to meet it."
agreed: "One earned activation per Echo Throne run; no paid revive or extra Domain use. Current G5 measurement is NOT-RUN because no paid cohort exists."
signed: [game-designer, game-pm]
status: accepted-policy
scope: current-release
```

```yaml
entry: 4
revenue_point: "Future cosmetic-only presentation boundary (not a current proposal)"
balance_number: "paid_free_winrate_delta_max_pp=5; required_paid_gameplay_delta=0; parity_sessions_band=[10,20]"
designer_bound: "A cosmetic must not alter any gameplay state, timing, visibility, readable information, controls, score, inventory, save progression, rewards, integrity, souls, legion, capacity, nodes, cooldowns, damage, aegis, possession, Domain, boss health, or assault access. Free/default presentation remains functionally equivalent."
pm_bound: "Any future paid content is cosmetic presentation only and requires a separate approved entitlement authority; browser-only state cannot govern score/inventory or gameplay entitlements. Paid gameplay power is prohibited, rather than permitted up to a 5pp win-rate delta."
agreed: "Boundary recorded for future rejection review only. No cosmetic, entitlement, server, price, projection, or implementation is approved or scheduled in this release."
signed: [game-designer, game-pm]
status: accepted-policy
scope: future-boundary-only
```

## Evidence and consequence table

| Entry | Evidence basis | Current consequence | Required before any later change |
|---|---|---|---|
| 1 | `intake/production-brief.md:3-5, 12-18`; `pm/revenue-map.md` | No revenue surface is added | Separate product approval; this release stays non-monetized |
| 2 | Reward definitions/effects: `campaign-state.js:8-30, 37-109`; selection guard: `408-432` | Existing rewards stay earned and balance-facing | Designer retune in balance source plus QA scenario evidence; no commercial coupling |
| 3 | Domain guards/effect: `campaign-state.js:333-334, 378-383` | One earned Domain activation remains | QA must measure reversal probability before any non-cosmetic change; a paid proposal is rejected |
| 4 | Browser-local persistence: `app.js:122-187`; deterministic save replay: `campaign-state.js:496-528`; G5 defaults: `pm/reward-bands.md` | No entitlement or cosmetic feature exists | Authority/threat model, gameplay-equivalence test, independent QA G5 evidence, and a replacement signed entry |

## Designer questions that block commercialization

The game designer must answer every question in a **new** entry before any commercialization discussion can leave out-of-scope status. An unanswered question is a rejection, not a deferred implementation detail.

1. What exact asset is cosmetic, and what free/default asset remains permanently available? Name the player-visible scene or UI element.
2. Which action/reward/state fields were inspected to prove the selection cannot influence the hunt/extract/materialize/capture loop, possession, Lord's Domain, or assault gate?
3. How does the default-versus-cosmetic test prove equal labels, target visibility, input timing, telegraph readability, accessibility, and deterministic campaign trace?
4. Can a cosmetic appear on a reward screen, action control, boss telegraph, or Domain feedback without implying gameplay status or hiding information? If so, provide the accessibility acceptance criteria.
5. Why is the cosmetic not represented as an inventory grant in browser-local state? What external authority and failure/rollback behavior would own a future entitlement?
6. What exact QA sample, equal-skill method, and command/session reference would measure the default G5 limits without claiming an unrun result?
7. Does the proposal leave every existing earned reward available through campaign play alone, with no price, currency, grind acceleration, randomized acquisition, or time pressure? If not, it is rejected.

## Escalation rule

No unsigned or superseded commercial decision may enter the implementation backlog. Any dispute about the zero-power boundary, reward availability, or G5 interpretation escalates to the production director through `production/decision-log.md`. In the absence of an explicit, evidence-backed replacement entry, the current non-monetized boundary controls.
