# Stage 1 QA test plan — Abyssal Surge revision

**Status:** `NOT-RUN`. This is an execution contract, not a pass result. **No player playtest has yet been measured.** Run all interactive scenarios only through a deliberately connected Playwriter browser session; do not substitute a headless runner, source-unit result, or an assumed asset load for browser evidence.

## Scope and gate rules

Campaign contract: **Cinder Span → Veil Citadel → Echo Throne**, preserving `hunt → extract → materialize → capture → assault`; Possession begins in Stage 2 and one-use Lord's Domain begins in Stage 3. The known live game target is `https://jellyggumi.github.io/Abyssal-Command/`. `https://jellyggumi.github.io/Abyssal-Surge/` currently redirects to a journal and is a deployment defect, not a valid test target.

| Gate | Required evidence this plan collects | Pass threshold | Current state |
|---|---|---|---|
| **G1 — narrative consistency** | Browser-visible names, objectives, reward text, narration, images, audio cues, and scene video are reconciled to the worldview and resource records. | **100% of the complete player-visible inventory** has an approved trace; **0** un-waived conflicts or third-party-IP references. | `NOT-RUN`; current revision resource/worldview records are proposed work, not evidence. |
| **G4 — immersion/readability** | Structured player scorecard, visible confirmation timings, keyboard/touch/reduced-motion observations, and severity log. | Median immersion/readability **≥4.0/5**, accepted-command visible confirmation **≤100 ms**, **0** unresolved S1/S2 readability defects. | `NOT-RUN`. |
| **G6 — operations/performance** | Playwriter snapshots, console/page-error log, persistence recovery, optional-media degradation, run metadata, and later stability/rollback evidence. | **0** uncaught page errors in a passing scenario; valid save round-trip preserves the recorded state; p95 frame interval **≤16.7 ms**, long frames **<0.5%**, input **≤100 ms**, and a **30-minute** stable session for final gate. | `NOT-RUN`; Stage 1 can only assemble the evidence path. |
| **G7 — core loop** | Ten voluntary repeat records with duration, action count, reward result, and repeat/stop choice. | Median loop duration **30–180 s** (75 s design target), **≥3** meaningful actions, **≥1** reward event, and voluntary repeat rate **≥70%**. | `NOT-RUN`; no player time or repeat decision has been captured. |

A documentation-only check does not promote any gate. G1 and G7 are Stage 1 evidence requirements; G4 and final G6 remain later measured gates, but this plan prevents their evidence from being lost.

## Participants and archetypes

Use at least one distinct participant/session per archetype; do not count a QA operator's scripted pass as a voluntary repeat decision.

| Archetype | Intent and coverage | Required observation |
|---|---|---|
| **A1 — First-contact Scout** | Begins without a save, follows only visible scenario guidance, and identifies the loop. | Reaches a Stage 1 reward after Hunt, Extract, Materialize, Capture, and Assault; rates comprehension and immersion. |
| **A2 — Momentum Rusher** | Tries the earliest legal assault path and observes blocked/defeat/retry feedback. | No silent loss, inaccessible state, or unexplained command rejection; retry returns to a playable stage. |
| **A3 — Legion Planner** | Repeats the extraction/materialization cadence, chooses one reward, and checks carried state. | Resource/legion feedback stays legible; selected reward carries into the next stage only. |
| **A4 — Tactical Breaker** | Exercises Stage 2 Possession and Stage 3 one-use Domain before assaulting. | Early/second use is clearly unavailable or rejected; legal use visibly changes only the intended state and assault gate remains intact. |
| **A5 — Continuity & Access Player** | Uses resume, export/import, reduced motion, keyboard-only, and touch-first interaction. | Equivalent semantic result across input modes; save recovery does not erase a valid campaign; optional presentation never blocks commands. |

### Cohort and scorecard rules

- **G7 cohort:** exactly 10 completed numeric-loop opportunities from **10 named pseudonyms representing distinct human participants**; each participant provides one voluntary repeat/stop decision after their first completed loop. A facilitator may explain controls before Start but must not recommend a reward, command sequence, or repeat choice. A blocked, abandoned, or failed first attempt is retained as a separate non-cohort defect record and that person cannot reattempt to enter this cohort; recruit a new participant rather than silently replacing a result.
- **G4 cohort:** the same 10 completed-loop participants each submit **all four required answers** immediately after their first loop: (1) “I knew the next legal action,” (2) “I could distinguish success, cooldown, and rejection,” (3) “Text/status was readable without relying on motion or sound,” and (4) “Presentation supported rather than obscured tactical decisions.” Anchors: **1** = strongly disagree/unusable, **2** = disagree, **3** = neutral/mixed, **4** = agree, **5** = strongly agree/clear. A participant composite is the arithmetic mean of all four answers; the G4 score is the median of the 10 composites. Missing answers, a reported blocker, or an unresolved S1/S2 defect make that cohort ineligible to pass and must be reported separately as `FAIL`/`BLOCKED`, never imputed or averaged away. Median **≥4.0** and the per-command timing threshold are also required.
- Preserve participant pseudonym, archetype, first-loop duration, action count, reward reached, repeat/stop choice, all four raw answers, composite, and facilitator name. A scripted QA operator cannot be a cohort participant.

## Playwriter session protocol and capture format

### Preconditions

1. The operator records run ID, UTC timestamp, full commit SHA/build tag (or `unavailable`), URL, browser/version, viewport, device class, locale, connection/media state, and archetype.
2. Connect the intended tab with Playwriter, create/select one session, and take the first accessible snapshot before any action. Re-snapshot after every navigation, command, reward, import, retry, media failure, or setting change; never reuse an old `aria-ref`.
3. Attach `pageerror` and `console.error` listeners before start. Store their final JSON and save the browser's URL at completion. An empty error list is scoped to that run only.
4. Store evidence under `qa/evidence/<UTC-run-id>/`: `metadata.json`, ordered `NN-snapshot.txt`, `console-errors.json`, screenshots only where visual timing/layout matters, exported save fixture(s), and `result.md`. Never replace a failing run's artifacts.

The operator may use Playwriter `page.evaluate` for timestamps, media state, `matchMedia`, and read-only DOM assertions, but must not call internal game objects or mutate campaign state. For a deliberate optional-media failure, use Playwriter request routing only for the named asset and remove the route after the scenario.

### Error and timing adjudication

- **Error rule:** each un-routed baseline scenario must end with **0** `pageerror` events and **0** `console.error` events. For PW-13/PW-14, the only allowable non-zero diagnostic is a `requestfailed`/routed-network record entered *before dispatch* with: scenario ID, exact asset URL or route pattern, injected failure mode/status, and observed request-failure signature. That record is expected fault-injection evidence, **not** an allowed application error. Every page error and every console error—including one coincident with the routed asset—fails G6. Retain the baseline and fault-injection raw lists separately with a per-entry `expected-route-match: true|false` decision.
- **Visible-confirmation observer:** before each legal command, install a temporary `MutationObserver` over `#campaign-status`, `#objective-checklist`, `#souls-value`, `#legion-value`, `#nodes-value`, `#integrity-value`, `#boss-value`, `#narration-sr`, and `#result-text`. Record `performance.now()` at the Playwriter input dispatch, record the first observer mutation that reflects the command result, then disconnect. Store selector, before/after text, input timestamp, mutation timestamp, and delta. A missing mutation after 100 ms is a failure; discard and repeat only if the browser reports `document.visibilityState !== "visible"` before dispatch.
- **Frame observer for PW-18:** after the battle is active and `document.visibilityState === "visible"`, collect consecutive `requestAnimationFrame` deltas for 30 uninterrupted foreground minutes. On a visibility change, record the interruption, stop that window, and restart a new 30-minute window; do not merge windows. Retain every delta in JSON. Sort `n` deltas ascending and select index `ceil(0.95 × n) - 1` for p95; count long frames as deltas `>50 ms` divided by `n`. Record `n`, p95, long-frame count/ratio, foreground start/end UTC, browser/device, and every interruption.

### Evidence record template

```text
run_id / session_id:
URL / revision / browser / viewport / locale:
archetype / media state / reduced-motion state:
scenario ID and start/end UTC:
snapshot files in order:
console/page errors (exact JSON path):
exported-save fixture + SHA-256 (if applicable):
measured value(s) / threshold / result:
defect IDs and severity:
G1 / G4 / G6 / G7 evidence contribution:
verdict: PASS | FAIL | BLOCKED | NOT-RUN
```

## Playwriter-only browser matrix

`Snapshot` means an accessibility snapshot after the state transition; `visual` means a screenshot as well. Each row is a separately reportable scenario. Expected outcomes are targets until captured, never recorded results.

| ID | Archetype | Setup and Playwriter actions | Observable expectation and threshold | Required capture | Gate evidence |
|---|---|---|---|---|---|
| **PW-00 Target identity** | A1 | Open local candidate and configured live URL in separate runs; record final URL after navigation. | Local candidate identifies itself/build; live campaign target is `…/Abyssal-Command/`; the requested `…/Abyssal-Surge/` must not be treated as a passing game target while it redirects. | First snapshot, URL, title, redirect chain if visible. | G1, G6 |
| **PW-01 First play / Stage 1 start** | A1 | Fresh browser storage or no existing envelope; snapshot lobby, activate Start, snapshot scenario and battle. | Cinder Span, Cinder Warden, objective, and active checklist are present; focus moves to the current stage heading/view. | Lobby and stage snapshots; focus target; errors. | G1, G4, G7 |
| **PW-02 Stage 1 core chain** | A1/A3 | Activate `H`, `E`, `M`, `C`, then legal `A` presses one at a time, waiting for each enabled state/cooldown. | Hunt → Extract → Materialize → Capture opens assault; no command silently succeeds or fails; Stage 1 uses one capture goal and boss HP 8. | Snapshot after every action; visible feedback timestamps; error log. | G1, G4, G6, G7 |
| **PW-03 Stage 1 gated commands and reward** | A2/A3 | Before/after required setup, attempt `P` and `D`; clear Stage 1, inspect all rewards, select exactly one, advance. | Possess and Domain are unavailable/rejected before their stages; reward set contains four choices and exactly one selection advances to Veil Citadel with carry text. | Disabled/rejection and reward snapshots; selected reward ID. | G1, G4, G7 |
| **PW-04 Stage 2 possession chain** | A4 | From a carried Stage 1 save or continued run, execute the core chain; capture both nodes, use `P`, then `A` until result. | Veil Citadel requires two captures, Possession is usable only after Stage 2 unlock conditions, and Veil Tactician has HP 10; exactly one Stage 2 reward carries onward. | Before/after Possess snapshots, two-node checklist, reward/result. | G1, G4, G6, G7 |
| **PW-05 Stage 3 Domain and completion** | A4 | Continue with two carried rewards; prepare legion, capture throne node, use `P`, invoke `D` once, then assault to terminal reward. Attempt a second `D` after first use. | Echo Throne requires one capture; Domain is usable once, second use is visibly blocked/rejected, Gate Sovereign HP is 17, and one terminal conclusion completes the campaign. | Domain before/after/second-attempt snapshots, completion snapshot, errors. | G1, G4, G6, G7 |
| **PW-06 Defeat and retry regression** | A2 | Pursue a legal low-preparation path until defeat, then activate Retry. | Defeat is announced in text/UI; retry restores a playable current stage without a blank screen, stale reward, or missing commands. | Defeat, retry, resumed-stage snapshots and errors. | G4, G6, G7 |
| **PW-07 Resume persistence** | A5 | Create an active Stage 1/2 state, reload/navigate back in the same browser profile, choose Resume. | Correct stage, checkpoint, integrity, carried rewards, and command availability match the pre-reload evidence; no duplicate reward or rewind. | Pre-reload, lobby/resume, post-resume snapshots; state comparison record. | G1, G6, G7 |
| **PW-08 Export / valid import round-trip** | A5 | Export a non-terminal campaign, retain its file and SHA-256, then create a new isolated Playwriter browser session/profile and import only through the visible file control. | Imported campaign returns to the exported stage/checkpoint/rewards with exactly the pre-export state; file must be JSON and ≤256 KiB. | Export download metadata/hash; pre-export and post-import snapshots; error log. | G1, G6, G7 |
| **PW-09 Invalid import recovery** | A5 | Use a deliberately malformed JSON, wrong schema/version, or >256 KiB fixture through the visible import control while a valid campaign is active. | A visible error/rejection occurs; the last valid campaign remains resumable and unchanged. No uncaught exception. | Fixture metadata, rejection snapshot, resume snapshot, errors. | G4, G6 |
| **PW-10 Keyboard parity** | A5 | Keyboard-only: Tab/Shift+Tab/Enter/Space and `H/E/M/C/P/D/A` at their legal stages; do not use pointer action controls. | Every public command is reachable, has a programmatic name/focus indicator, and yields the same semantic state as corresponding button evidence; no keyboard trap. | Focus-order snapshot sequence and command results. | G1, G4, G6, G7 |
| **PW-11 Touch parity / narrow layout** | A5 | In Playwriter emulate **320×640 CSS px, DPR 2, `hasTouch: true`**; use `page.touchscreen.tap` for Start, every legal `H/E/M/C/P/D/A` command across Stages 1–3, reward selection, and save controls; inspect horizontal overflow. | Core actions remain reachable with no horizontal page scroll; every tapped command has the same semantic result as PW-02–05; labels remain readable. | Device-emulation metadata, 320px visual + accessibility snapshots, `scrollWidth/clientWidth`, per-command outcomes, errors. | G1, G4, G6, G7 |
| **PW-12 Reduced motion** | A5 | Set `prefers-reduced-motion: reduce` before page load; run Stage 1 through a feedback-producing command and optional cinematic control. | Text/status remains the sole sufficient confirmation; narration text renders without typewriter delay, major animation/transition is suppressed, video remains hidden, and commands remain playable. | Media-query value, before/after snapshots, visual screenshot, timing record. | G1, G4, G6, G7 |
| **PW-13 Optional scene-video failure** | A5 | In normal-motion run, route only the selected stage-video request to fail, then enter/advance that stage. | Video failure hides/removes broken video; still key art or text/UI briefing remains usable; command chain and save continue; no uncaught error. | Routed URL, media element state, fallback snapshot, post-failure command snapshot, errors. | G1, G4, G6, G7 |
| **PW-14 Optional audio failure** | A5 | Route one action/narration audio request to fail, then trigger its matching command/narration. | Text/icon/status feedback remains; command state advances once; no autoplay/rejection error is surfaced as a blocking failure. | Routed URL, status/narration snapshot, command result, errors. | G1, G4, G6, G7 |
| **PW-15 Narrative trace audit** | A1/A4 | At each lobby/stage/result/completion snapshot, transcribe visible stage/boss/objective/reward/narration strings and authored visual identifiers; reconcile them against the candidate worldview inventory. | Every sampled item maps one-to-one to a world ID; 100% sampling of the complete player-visible inventory is required before G1 review, with 0 conflicts. | Inventory worksheet, snapshot anchors, unresolved-item list. | G1, G4 |
| **PW-16 Resource/provenance and degradation audit** | A5 | From the same stage snapshots and network/media states, reconcile each visible image, 16-fps concept animation, video, and sound cue to the candidate resource manifest; repeat PW-13/14 fallbacks. | Images state **GodTiboImagen** provenance; concept animations declare manual PerfectPixel-style identity/frame/alpha/manifest validation at **16 fps** (not a PerfectPixel provider claim); scene video starts from GodTiboImagen still key art and records FFmpeg renderer/validator plus a credential-verified motion provider; sound records separately importable chatbot source and validation. Missing record or unverifiable provider blocks G1/G6. | Manifest rows, asset IDs/URLs, still/video/audio snapshot anchors, validation outputs when available. | G1, G4, G6 |
| **PW-17 G7 voluntary repeat sample** | A1–A5 | On a stable candidate, collect ten independently chosen repeat/stop decisions after a complete numeric loop; do not coach the decision. | Per session: ≥3 actions and ≥1 reward; cohort median 30–180 s and at least 7/10 repeat decisions. | Ten run records with timing/action/reward/repeat fields. | G4, G6, G7 |
| **PW-18 Stability and reflection handoff** | A5 | Later final-gate run only: retain an active browser session for 30 minutes while recording frame/input probes and a browser refresh/resume checkpoint. | p95 ≤16.7 ms, long frames <0.5%, input ≤100 ms, no lost save, and no unresolved S1/S2. Then attach facts—not prose claims—to typed reflection review. | Raw timing CSV/JSON, snapshots, errors, final defect list, reflection validation output. | G4, G6, G7 |

## Narrative and resource acceptance worksheet

Before marking PW-15/PW-16 passed, build the inventory seed as the union of **every player-visible text/cue and every loaded or fallback asset URL** observed across PW-00–14: fresh lobby and resume lobby; legal and gated `H/E/M/C/P/D/A`; all three scenario/battle/result/reward states; defeat/retry/completion; export/import success and rejection; keyboard/touch; reduced motion; and video/audio failure fallbacks. Give each seed item a unique ID and snapshot or network anchor, then reconcile in both directions: **runtime → `_workspace/20260716-abyssal-surge-revision/design/worldview.md` / `engineering/resource-manifest.md`** and **each inventory row → captured runtime state**. If either file, a required provenance field, provider-credential evidence, runtime anchor, or reverse mapping is absent, PW-15/PW-16 are `BLOCKED`, G1/G6 cannot pass, and the missing row is logged rather than inferred.

| Item class | Required trace | QA rejection rule |
|---|---|---|
| Stage/boss/objective/reward/narration text | World ID, exact displayed value, stage, source snapshot, reviewer decision. | Missing trace, changed text, contradictory lore, or third-party reference = G1 failure. |
| Still image / UI image | World ID, resource ID, GodTiboImagen request/output provenance, file hash, displayed snapshot. | Missing provenance/hash/trace or a borrowed/copyable external asset = G1 failure. |
| Concept-style animation | Identity-lock reference, 16 fps frame count/duration, alpha-background decision, frame manifest, validation result, snapshot. | Claims PerfectPixel generated it, omitted 16-fps/identity validation, or does not preserve readable feedback = G1/G4 failure. |
| Scene video | GodTiboImagen still-key-art ID, FFmpeg render/validator record, codec/duration/file hash, verified motion-provider credential status, fallback snapshot. | Video begins from untraced art, renderer/validator absent, provider unverified, or failure blocks core play = G1/G6 failure. |
| Audio | Explicit separately importable chatbot source/provenance, license/ownership note, cue-to-action mapping, file hash, failure snapshot. | Calling audio GodTiboImagen output, missing provenance, inaccessible feedback without audio, or failed cue breaks command = G1/G4/G6 failure. |

## Severity, regression, and disposition

| Severity | Definition | Disposition |
|---|---|---|
| **S1 — blocker** | Cannot start, resume, import a valid save, issue a core legal command, advance a required stage, or a G1 IP/trace violation is found. | Fails affected gate; stop the run and preserve artifacts. |
| **S2 — major** | A stage rule, save field, input mode, required text cue, reduced-motion path, or optional-media fallback is materially wrong but an unsafe workaround exists. | Fails G4/G6 or blocks promotion until fixed and regression-run. |
| **S3 — moderate** | Incorrect/unclear presentation or focus/order issue with an intact alternate path; no data loss. | Fix before gate review; retest affected row plus its listed regressions. |
| **S4 — minor** | Cosmetic defect with no state, readability, accessibility, provenance, or performance-threshold effect. | Log and triage; verify only if changed surface overlaps a gate row. |

Mandatory regression bundles after a change:

1. **Rules/stage change:** PW-01–06, PW-10, PW-17; preserve stage/reward/assault constraints.
2. **Persistence/import change:** PW-07–09 plus one continued Stage 2 or Stage 3 run.
3. **Narrative/resource change:** PW-01, PW-03–05, PW-15–16, PW-12–14; re-audit every changed visible string and asset.
4. **Presentation/accessibility change:** PW-10–14 and affected stage run; reopen G4 for any S1/S2 readability issue.
5. **Release/ops change:** PW-00, PW-07–09, PW-13–14, PW-18; retain URL/rollback evidence separately before a final G6 claim.

## Typed reflection and review handoff

After a measured run, create a fact-only record containing run metadata, each gate's threshold/measured value/method/evidence/timestamp, open defect IDs, corrective action, and PASS/FAIL/NOT-RUN. The declared Pydantic v2 dependency is **not installed in this environment**, and PydanticAI is also unavailable; no automated LLM self-evolution has run or is implied.

Install the project-declared Pydantic prerequisite in the later review environment, then validate the final JSON with the existing validator:

```text
python -m pip install -r _workspace/20260716-shadow-lord-rts-rpg/retrospectives/requirements.txt
python _workspace/20260716-shadow-lord-rts-rpg/retrospectives/cycle_retrospective.py <final-reflection.json>
```

Schema validation proves record shape only. A director/reviewer must independently compare the retained Playwriter artifacts to the gate thresholds; a schema-valid reflection is not a gate pass.

## External sources consulted

Sources below informed the planned test method and were consulted **2026-07-16**; they are not gameplay measurements.

- Playwriter session/snapshot workflow: <https://github.com/remorses/playwriter>
- Reduced-motion media query: <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- IndexedDB persistence model: <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>
- Keyboard accessibility guidance: <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html>
- Pydantic installation and validation documentation: <https://docs.pydantic.dev/latest/>
- FFmpeg command/format reference for later renderer validation: <https://ffmpeg.org/ffmpeg.html>
