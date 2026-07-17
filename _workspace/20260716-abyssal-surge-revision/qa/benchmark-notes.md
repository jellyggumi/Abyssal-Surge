# Stage 1 benchmark notes — Abyssal Surge revision

**Status:** `NOT-RUN`. **No player playtest has yet been measured.** These notes preserve the available live/local snapshot baseline and define the measurements that an independent Playwriter QA run must collect. They do not report gameplay performance, completion rate, readability score, frame time, retention, or balance as observed facts.

## Baseline provenance and target identity

The production brief records a source packet captured on **2026-07-16** from a local tab at `http://127.0.0.1:4174/` and the configured live page at `https://jellyggumi.github.io/Abyssal-Command/`. This QA task did **not** operate a browser, replay a campaign, or create a new snapshot; it uses that recorded baseline plus a static source inspection only.

| Surface | Recorded baseline fact | What it does **not** prove | QA consequence |
|---|---|---|---|
| **Configured live campaign** — `https://jellyggumi.github.io/Abyssal-Command/` | The production brief records it as the active playable Pages endpoint and says its live release title is **Abyssal Command**. | It does not prove a particular build SHA, current asset set, stage completion, save behavior, media behavior, or performance. | Use it only as the current live comparison target; capture a fresh Playwriter URL/title/snapshot before using any result. |
| **Requested branded URL** — `https://jellyggumi.github.io/Abyssal-Surge/` | The decision log records a redirect to `https://jellyggumi.github.io/journal/`. | It is not a deployed game endpoint and cannot supply gameplay evidence. | Record as an S1 release-target defect until repository/Pages configuration is corrected; do not silently redirect the test plan to a journal page. |
| **Local source-packet tab** — `http://127.0.0.1:4174/` | The production brief records it as the local snapshot origin selected for the 2026-07-16 source packet. Static inspection confirms the local app exposes Start/Resume, seven action controls, export/import, media hooks, and reduced-motion branches. | The brief does not retain a session ID, snapshot artifact, device/browser metadata, action history, media network results, or timing data in this revision workspace. Static inspection is not a playtest. | A new independent session must capture all metadata and cannot call this row a behavioral pass. |

### Current implementation facts relevant to the next run

These are source/brief facts, not browser-measured outcomes:

- The intended campaign is deterministic and browser-local; its public chain is Cinder Span → Veil Citadel → Echo Throne. The visible control surface names `Hunt`, `Extract`, `Materialize`, `Capture`, `Possess`, `Domain`, and `Assault`.
- Stage 1 is modeled with one capture goal and Cinder Warden HP 8; Stage 2 has two capture goals, Possession, and Veil Tactician HP 10; Stage 3 has one capture goal, one-use Domain, and Gate Sovereign HP 17.
- IndexedDB is the primary save path with localStorage fallback and visible JSON export/import. A current source constant caps imports at 256 KiB. This establishes a test input boundary, not evidence that recovery works.
- The application has optional stage image/video and audio code paths. Video error handling removes/hides failed video, and audio errors are intentionally non-throwing. This is implementation intent only; PW-13/PW-14 must verify the player-visible fallback.
- `prefers-reduced-motion: reduce` suppresses video/typewriter and visual effects in the inspected source. It is not an accessibility result until a Playwriter session captures the rendered state and command path.

## Honest benchmark ledger

| Metric | Gate | Baseline value | Evidence quality | Why it is not a result | Required independent measurement |
|---|---|---:|---|---|---|
| Campaign target URL | G6 | Configured live target recorded; branded URL redirects to journal | Recorded production brief/decision log | No fresh capture in this task. | Playwriter URL/title/snapshot for local, configured live, and branded URL. |
| First-play completion | G7 | `not measured` | None | No run or user completed Stage 1 in this task. | A1 session from fresh storage to first reward; record start/end and action count. |
| Stage 2/3 completion | G7 | `not measured` | None | No Playwriter action chain has been captured. | PW-04/PW-05 with state checkpoints and rewards. |
| Loop duration | G7 | 75 s is a design target, **not a baseline** | Design-only | No human/browser duration exists. | Ten voluntary loops; median must be 30–180 s. |
| Voluntary repeat rate | G7 | `not measured` | None | Scripted QA intent cannot stand in for player choice. | Exactly 10 named pseudonyms representing distinct humans each make one uncoached repeat/stop decision after their first completed loop. Blocked/abandoned/failed first attempts remain non-cohort records and cannot be retried into the cohort; at least 7 repeats. |
| Readability/immersion | G4 | `not measured` | None | No player scorecards exist. | The same 10 completed-loop humans submit all four anchored 1–5 answers in `test-plan.md`; no missing/imputed answer or unresolved S1/S2 defect; median participant composite ≥4.0/5. |
| Action feedback latency | G4/G6 | `not measured` | None | No DOM/action timestamp capture exists. | Playwriter temporary observer over the named HUD/status selectors in `test-plan.md`; accepted input → first matching mutation ≤100 ms. |
| Frame pacing / long frames | G6 | `not measured` | None | No browser frame sample or device run exists. | One uninterrupted visible 30-minute `requestAnimationFrame` window using the retained-sample/percentile procedure in `test-plan.md`; p95 ≤16.7 ms and long frames <0.5%. |
| Persistence / export-import fidelity | G6 | `not measured` | Source supports it; no round trip captured | No save fixture or restored state comparison exists. | Valid export/import and invalid-import recovery with file hash and before/after snapshots. |
| Optional video/audio failure resilience | G4/G6 | `not measured` | Source fallback intent only | Failed network/media paths have not been exercised. | Route one media request at a time in Playwriter. Retain the predeclared exact route/failure signature as `requestfailed`; every page/console error still fails G6. Prove text/UI/core commands continue. |
| Narrative/resource trace coverage | G1 | `not measured` | Current runtime stage trace fields exist; candidate resource inventory is not yet attached | A code trace field does not prove every rendered string/asset/provenance is approved. | Seed inventory from the union of all PW-00–14 visible/fallback text, cues, and asset URLs; assign anchors and reconcile runtime→inventory plus inventory→runtime with 100% mapping and zero un-waived conflicts. |

## Measurement methods for the independent QA run

### Playwriter-only run discipline

1. Select the intended tab, connect Playwriter, create a session, and save the first accessibility snapshot before action.
2. Capture one action at a time: snapshot → act → fresh snapshot. Attach page-error and console-error listeners before Start.
3. Make any direct browser measurement read-only: accessible tree/DOM text, `performance.now()` timestamps, `matchMedia`, `video` state, resource URL, viewport overflow, and error log are allowed. Do not set game internals, forge persistence, or call implementation functions to skip a state.
4. Archive raw artifacts under `qa/evidence/<UTC-run-id>/` without overwriting a failed attempt. Every benchmark row needs URL, revision, browser, viewport, session ID, UTC time, artifact paths, threshold, observed value, and verdict.

### Timing calculations

| Measure | Calculation | Acceptance threshold | Notes |
|---|---|---|---|
| Accepted-command feedback | `visible-confirmation-time - accepted-input-time`, where confirmation is an observable status/checklist/HUD state change. | ≤100 ms | Record per accepted action; a rejected/disabled command is measured separately for clarity, not counted as accepted feedback. |
| Loop duration | Reward view arrival − first legal Hunt of a voluntarily attempted loop. | Cohort median 30–180 s | Record action count and reward ID; the 75 s value remains a design target. |
| Repeat proxy | voluntary `repeat` decisions ÷ 10 completed numeric-loop opportunities. | ≥70% | “Continue because QA instructed it” is invalid. |
| Frame p95 | 95th percentile of retained `requestAnimationFrame` intervals in the 30-minute run. | ≤16.7 ms | Keep raw intervals/summary; do not infer handset performance from a desktop tab. |
| Long-frame ratio | intervals >50 ms ÷ all retained intervals. | <0.5% | Report denominator, pause/background periods, and device/browser. |
| Import fidelity | Exact compare of stage, checkpoint/checklist, integrity, legion, resources, selected rewards, status, and available command state before export vs after import. | 100% equality for valid fixture | A valid state must survive; malformed/wrong-schema/oversize input must leave prior valid state unchanged. |

## Known gaps and blockers

| Gap | Effect | Required closure |
|---|---|---|
| No retained snapshot artifacts/session IDs for the brief's local/live source packet | Baseline cannot establish exact DOM, build, browser, device, or behavior. | Fresh Playwriter captures in PW-00 onward. |
| `Abyssal-Surge` Pages URL redirects to a journal | Branded deployment cannot be called playable or release-ready. | Repository/Pages configuration decision plus fresh branded-target smoke capture. |
| No player scorecards, voluntary repeats, timing data, or action telemetry | G4/G7 cannot be passed; no fairness/feel claim is defensible. | Independent participant sessions and raw evidence per test plan. |
| No 30-minute browser stability evidence, rollback exercise, or full release record | Final G6 is blocked. | PW-18 plus release/rollback evidence in the correct delivery workflow. |
| Candidate narrative/resource records are not yet supplied in this revision workspace | G1 cannot be audited, particularly provenance of new scenes, visual assets, audio, and video. | Create `_workspace/20260716-abyssal-surge-revision/design/worldview.md` and `engineering/resource-manifest.md`; seed them from the complete PW-00–14 runtime/fallback union, assign item IDs/anchors, and require bidirectional reconciliation. Absent row/provenance/credential/anchor/reverse mapping keeps PW-15/PW-16 `BLOCKED`. |
| Motion-video provider credential status is unknown | Scene-video production cannot be claimed or tested as provider-backed. | Verify credentials before selecting provider; preserve the validation record. |
| Audio cannot be GodTiboImagen output | A false image-generator provenance claim would invalidate the resource review. | Declare separate chatbot-generated/importable source, ownership/provenance, file hash, cue map, and failure-path evidence. |
| Pydantic/PydanticAI is not installed in this environment | Typed reflection has no validated run artifact; no automated LLM self-evolution occurred. | In the review environment install the project-declared Pydantic v2 requirements, run the existing validator on a fact-only run record, then have an independent reviewer assess evidence. |

## Fairness and regression observations to preserve

No fairness conclusion is measured. The following are test hypotheses, not results: low-preparation assault should communicate risk rather than silently fail; a defeat must retain a recoverable retry path; Possession and Domain must be introduced only at their intended stages; no input modality, reduced-motion state, missing optional sound, or missing optional video may make the deterministic core loop inaccessible. An S1/S2 defect in any of those paths invalidates the affected G4/G6 evidence and triggers the regression bundle in `test-plan.md`.

## Research sources and dates

The following external references were consulted on **2026-07-16** to define methods and thresholds. They are method references, not evidence about this game.

| Topic | URL | Use in this plan |
|---|---|---|
| Playwriter snapshots and stateful browser sessions | <https://github.com/remorses/playwriter> | Required interactive runtime, snapshot/act/resnapshot discipline. |
| Reduced-motion preference | <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion> | Media-query test setup and non-motion fallback expectation. |
| IndexedDB API | <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API> | Local persistence test boundary. |
| WCAG 2.2 keyboard guidance | <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html> | Keyboard reachability and no-trap observation. |
| Pydantic validation | <https://docs.pydantic.dev/latest/> | Truthful prerequisite for typed reflection review. |
| FFmpeg reference | <https://ffmpeg.org/ffmpeg.html> | Later scene-video renderer/validator evidence requirement. |
