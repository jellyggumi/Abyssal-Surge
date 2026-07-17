# Revenue map — non-monetized release boundary

**Owner:** game-pm
**Stage:** Stage 1 preproduction
**Commercial status:** **OUT OF SCOPE — no commercial projection, pricing, conversion target, shop, entitlement, paid flow, or forecast is approved for this release.**

## Scope decision

The shipped campaign is a browser-local, deterministic single-player game. It has no account, payment, checkout, store, price, or paid entitlement surface. A source scan on 2026-07-16 found no such surface in the active client; the reward UI is an earned post-victory choice (`index.html:369-371`) and the only supported selection path is `chooseReward` after a stage victory (`campaign-state.js:408-432`).

The browser-local save is not an authority suitable for entitlements. `CampaignStorage` uses IndexedDB and then localStorage/memory fallback (`app.js:122-187`); the campaign save envelope is replayed through only legal transitions (`campaign-state.js:496-528`). The campaign state records selected rewards and all live balance values in client-controlled state (`campaign-state.js:8-30`, `408-432`). Therefore **no feature that changes score, inventory, saved rewards, integrity, souls, legion, nodes, cooldowns, damage, capacity, aegis, possession, Lord's Domain, or assault-gate eligibility may be sold or trusted as a browser-only entitlement.**

**Evidence date:** 2026-07-16. This document uses local source and production evidence only; it makes no externally sourced market or revenue claim.

## Active release map

| Core-loop moment | Player-visible current content | Current reward/progression function | Commercial state | Balance numbers/state touched | Decision |
|---|---|---|---|---|---|
| Cinder Span victory | Choose one doctrine after defeating Cinder Warden | Earned tactical branch carried into Veil Citadel/Echo Throne | No shop or paid path | `rewardRestore +1`; chosen doctrine may alter summon, possession damage, cooldown, or counterblows | Retain as non-commercial progression |
| Veil Citadel victory | Choose one doctrine after defeating Veil Tactician | Earned Echo Throne preparation/recovery branch | No shop or paid path | `rewardRestore +1`; may alter entry legion, integrity, aegis, or Materialize | Retain as non-commercial progression |
| Echo Throne victory | Choose archive oath/crown record after defeating Gate Sovereign | Earned commemorative campaign ending; no combat carryover | No shop or paid path | Persistent selected reward record only; no combat modifier defined | Retain as non-commercial conclusion |
| Hunt → Extract → Materialize → Capture | Souls and legion are created through actions, not purchases | Core-loop resource economy | No shop or paid path | `soulsPerExtract 4`; `materializeCost 2`; `materializeSummon 2`; legion/capacity/nodes | Never monetize |
| Veil Citadel possession | Sentinel is possessed after holding a node | Mandatory Stage 2 mastery gate | No shop or paid path | possession flag; `possessDamage +1`; Rift Lens conditional `+4` | Never monetize |
| Echo Throne Lord's Domain | One earned, node-gated comeback activation | Mandatory Stage 3 recovery tool | No shop or paid path | one use; `domainRestore +4`; `domainAegis 2`; integrity/aegis | Never monetize |
| Assault gate and boss defeat | Nodes/possession gates unlock assault | Skill/progression completion condition | No shop or paid path | stage node goal, possession requirement, boss health, integrity | Never monetize |

## Existing reward inventory — gameplay balance, not commerce

All listed rewards are selected only from the completed stage's in-game offer. The source permits one selection per stage victory, appends its ID to the local campaign reward list, and moves forward (`campaign-state.js:408-432`). These are **non-commercial campaign progression**, not inventory products.

| Stage | Reward | Player-visible function and world role | Verified balance effect | Commercial classification |
|---|---|---|---|---|
| Cinder Span | Ember Cohort | Legion doctrine: reinforces the army materialized from the drowned forge's rift | `cohortSummonBonus +2` beyond base Materialize summon 2 | Earned gameplay choice; never paid |
| Cinder Span | Rift Lens | Burst doctrine: focuses the possessed sentinel's Veil Citadel assault | possession strike `lensDamage +4`, available Stage 2 onward | Earned gameplay choice; never paid |
| Cinder Span | Stillwater Hourglass | Tempo doctrine: makes the second spoor hunt disclose the soul cache | cooldown reduction `20%`; second Hunt auto-extracts 4 souls | Earned gameplay choice; never paid |
| Cinder Span | Bulwark Brand | Bulwark doctrine: protects the legion against the wardens' counterblows | counterblow reduction `2`, floor 1 | Earned gameplay choice; never paid |
| Veil Citadel | Veil Vanguard | Vanguard doctrine: enters the final gate with a prepared but thin legion | Echo Throne entry legion `4` | Earned gameplay choice; never paid |
| Veil Citadel | Anchor Shard | Recovery doctrine: steadies the legion on entry to the last remembered sea | Echo Throne entry integrity `+2` | Earned gameplay choice; never paid |
| Veil Citadel | Abyssal Banner | Legion doctrine: carries a banner into the throne and reinforces each Materialize | entry aegis `1`; Materialize `+1`; Domain adds its normal 2 aegis | Earned gameplay choice; never paid |
| Echo Throne | Throne Echo | Final oath recorded after the Gate Sovereign falls | No combat modifier; archive record | Earned commemorative conclusion; never paid |
| Echo Throne | Dawnless Crown | Closed-gate crown recorded after the Gate Sovereign falls | No combat modifier; archive record | Earned commemorative conclusion; never paid |

Source of reward IDs, text, and stage attachment: `campaign-state.js:37-109`. The source of the displayed gameplay constants is `campaign-state.js:8-30`; no tuning result is claimed here.

## Future-only cosmetic boundary

This is a constraint for a separately approved future release, **not a roadmap, implementation request, or commercial projection**:

1. A future paid item may change only a presentation asset chosen after all deterministic gameplay resolution: e.g., palette, portrait frame, banner ornament, purely visual action effect, or non-gameplay archive display treatment.
2. It must not change, unlock, skip, accelerate, restore, grant, reroll, reveal, protect, or otherwise influence any gameplay state or outcome. This includes rewards, score, inventory, save progression, integrity, souls, legion, capacity, nodes, cooldowns, damage, aegis, possession, Lord's Domain, boss health, assault access, retry state, or action availability.
3. A cosmetic must remain equivalent to the free/default presentation in readable labels, controls, timing, combat visibility, and accessibility. It cannot hide information or make input easier.
4. It must not be implemented as a browser-only flag that the gameplay reducer consumes. If any future entitlement exists, a server-side ownership decision and an entitlement-threat model must be approved before implementation; this is an external prerequisite, not work in this release.
5. Current release default: all cosmetics are absent; all players use the same presentation and gameplay rules.

## Pre-commercialization designer questions

No commercialization proposal may advance until the game designer answers these in a new signed negotiation entry and QA supplies independent evidence:

1. Which exact cosmetic asset changes, and how is its gameplay-equivalence tested against the free/default asset (including readability and input timing)?
2. Which `campaign-state.js` fields are proven untouched by the cosmetic selection and by every import/export/replay path?
3. Does the cosmetic interact with a reward screen, action button, possession indicator, Domain indicator, boss telegraph, or assault gate? If yes, how is informational parity measured?
4. What free/default variant remains permanently available without grinding, payment, randomized acquisition, or time pressure?
5. What authority owns entitlement verification? Until a server-side answer and threat model exist, why should the proposal remain rejected rather than client-gated?
6. Which G5 measurement design can compare otherwise identical paid/default cosmetic cohorts without inventing a gameplay difference?
7. Has the designer revalidated the three-stage narrative promise—Cinder Span hunt/extract/materialize/capture, Veil Citadel possession, and Echo Throne's one-use Lord's Domain plus assault gate—without a commercial interruption?

## Gate handoff

`G5` is **NOT-RUN** for this release: there is no paid cohort, paid item, paid/free matchup, or commercial progression path to simulate. The default G5 limits are preserved in `reward-bands.md` as future guardrails only. A future proposal needs a signed `negotiation-record.md` entry, a revised source-of-truth balance sheet, and QA measurement evidence before G5 can be evaluated; it may not be declared PASS from this document.
