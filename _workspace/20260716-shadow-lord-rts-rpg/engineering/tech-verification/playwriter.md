# Playwriter current-browser verification packet

**Status:** `NOT-RUN`. No result becomes observed until a Playwriter bridge session captures and retains the evidence below. This packet uses a current, operator-selected browser tab; it is not a substitute for the isolated browser regression in [the three-stage test](../../../../tests/playtest-browser-3stage.cjs).

**Evidence:** [UI command path](../../../../app.js#L699-L720) · [three-stage expected outcomes](../../../../tests/playtest-browser-3stage.cjs#L409-L475) · [QA scenarios](../../qa/test-plan.md) · [G6 ledger](../../qa/gate-measurements.md#g6-stage-1-operations-draft)

## Preconditions

1. The operator selects the intended local, preview, or deployed campaign tab and connects the Playwriter extension. Record the URL, browser version, viewport/device class, build revision, and timestamp.
2. Create or select a session. Do not assume an existing browser, session, authentication state, or extension bridge is connected.
3. Set `TARGET_URL` to the selected campaign URL. Never run a campaign action before the first snapshot identifies the expected tab.

```bash
playwriter browser start
playwriter session new
playwriter session list
export SESSION=1                 # replace with the returned session id
export TARGET_URL='https://example.invalid/index.html'  # replace before use
playwriter -s "$SESSION" -e "await page.goto(\"$TARGET_URL\"); console.log(await snapshot({ page }))"
```

## Mandatory observe → act → observe loop

Use fresh references from each snapshot. After every navigation, view transition, command, reward selection, retry, or restart, snapshot again before the next action. Attach console listeners before the campaign begins:

```bash
playwriter -s "$SESSION" -e 'state.consoleErrors = []; page.on("pageerror", error => state.consoleErrors.push({ kind: "pageerror", message: error.message })); page.on("console", message => { if (message.type() === "error") state.consoleErrors.push({ kind: "console", text: message.text(), url: message.location().url }); }); console.log("console listeners attached")'
playwriter -s "$SESSION" -e 'console.log(await snapshot({ page }))'                 # observe lobby
playwriter -s "$SESSION" -e 'await page.locator("#start-campaign").click()'        # act once
playwriter -s "$SESSION" -e 'console.log(await snapshot({ page }))'                 # observe Stage 1
playwriter -s "$SESSION" -e 'await page.locator("#go-to-boss-spec").click()'       # act once
playwriter -s "$SESSION" -e 'console.log(await snapshot({ page }))'                 # observe boss spec
playwriter -s "$SESSION" -e 'await page.locator("#go-to-battle").click()'          # act once
playwriter -s "$SESSION" -e 'console.log(await snapshot({ page }))'                 # observe battle
```

For each enabled command, use either the visible control or its documented keyboard equivalent, then immediately snapshot. The expected chains below are copied from the checked-in browser scenario; they are expectations, not a recorded result.

| Stage | Act one command at a time, observing after each | Expected outcome if observed |
|---|---|---|
| 1 — Cinder Span | `hunt`, `hunt`, `extract`, `materialize`, `capture`, then three `assault`; choose `rift-lens` | Stage 1 displays `Cinder Span`; four exclusive rewards are offered; Stage 2 displays `Veil Citadel` and reports the Rift Lens carry. |
| 2 — Veil Citadel | `hunt`, `hunt`, `extract`, `materialize`, `capture`, `capture`, `possess`, then two `assault`; choose `veil-vanguard` | Three exclusive rewards are offered; Stage 3 displays `Echo Throne` and carries four Veil Vanguard shades. |
| 3 — Echo Throne | `hunt`, `hunt`, `extract`, `materialize`, `materialize`, `capture`, `possess`, `domain`, then three `assault`; choose `throne-echo` | Two terminal rewards are offered; the completion view appears and marks all three stages cleared. |

For a selector-based action, retain this four-command pattern rather than batching commands:

```bash
playwriter -s "$SESSION" -e 'await page.locator("#action-hunt").click()'
playwriter -s "$SESSION" -e 'console.log(await snapshot({ page }))'
```

## Error and result capture

Before ending the session, capture the exact URL, accessible snapshot, and all collected browser console/page errors. A non-empty error list is a failure observation; an empty list is only scoped to the captured session and scenario.

```bash
playwriter -s "$SESSION" -e 'console.log(JSON.stringify({ url: page.url(), consoleErrors: state.consoleErrors }, null, 2))'
playwriter session list
```

Retain the terminal output or session artifact alongside the revision/device record, including any manual login, permission, media, or bridge limitation. Record the result as:

```text
Playwriter current-browser verification: NOT-RUN
bridge/session id: <id>
revision: <full SHA or unavailable>
URL / browser / viewport: <captured values>
scenario checkpoints: <snapshot references>
console/page errors: <captured list>
result: PASS | FAIL | NOT-RUN
```

Until those fields are captured, the only valid result is `NOT-RUN`; do not convert the expected outcomes, an existing automated test, or a connected extension into a pass claim. Final G4/G6 requirements remain in [Stage 3 handoff](../../production/handoffs/stage-3.md) and [release readiness](../../ops/release-readiness.md).
