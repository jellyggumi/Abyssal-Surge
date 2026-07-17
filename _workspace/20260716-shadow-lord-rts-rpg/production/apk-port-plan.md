# Future Android TWA/APK delivery plan

**Status:** future packaging packet; **not executed for this release.**

**Audience/action:** Android release owner turns the static web client into a Trusted Web Activity (TWA) only after the prerequisites and release gates below have recorded evidence. This packet does **not** assert a built APK/AAB, a Play Console app or listing, an approved package entitlement, Digital Asset Links publication, or a passing Android-device test.

## Observed web boundary

The current delivery surface is a browser-local static app, not an Android application:

- [Pages workflow](../../../.github/workflows/static.yml) deploys an allowlisted static artifact, including `index.html`, `app.js`, `campaign-state.js`, `sw.js`, `manifest.json`, and `assets/`.
- [HTML entry point](../../../index.html) links the [web manifest](../../../manifest.json); [app bootstrap](../../../app.js) registers the [service worker](../../../sw.js). The worker uses versioned `abyssal-surge-*` caches, precaches the shell, caches optional media best-effort, and falls back to a cached shell after a failed navigation request.
- [Campaign state](../../../campaign-state.js) owns the deterministic three-stage rules and save-envelope validation. The browser persistence boundary is documented in the [architecture contract](../engineering/architecture-contract.md): IndexedDB is canonical local state; service-worker/Cache storage is versioned shell and asset data only.

This is source-verified web-delivery evidence, not a claim that a remote Pages endpoint, an Android package, or any G1–G8 release gate has passed. In particular, the [gate ledger](../qa/gate-measurements.md#g1) records the current G1 content-trace result as **FAIL**: the public source lacks required `AS-WV-*` / `inventory_id` metadata. Android packaging must not convert that failure into an implicit approval.

## Scope and content prerequisite

The package wraps the same static origin; it must not add cloud save, multiplayer, accounts, server authority, or a second rules engine. The future package must preserve browser-local state and route all stage mechanics through `campaign-state.js`.

Before a release candidate is frozen, attach every player-visible packaged string, effect, scenario, image, audio cue, and packaged web asset to the original-only inventory format in the [worldview](../design/worldview.md#content-trace-format) and [resource manifest](../engineering/resource-manifest.md). A missing `AS-WV-*` trace, an unwaived G1 violation, or any third-party IP reference is a stop condition. The [production contract](production-contract.md#public-ip-boundary) remains authoritative: a target, document, or package build is not gate evidence.

## TWA configuration and HTTPS association

The existing [`apk/` kit](../../../apk/BUILD.md) is a **template boundary**, not a generated Android project or release artifact. Use it as input only after reconciling its values with the deployed PWA:

1. Choose one canonical HTTPS origin, package ID, display name, `start_url`, web-manifest URL, and icon URLs. Record the final tuple in the Android release record.
2. Reconcile [TWA manifest inputs](../../../apk/twa-manifest.json) with [web manifest inputs](../../../manifest.json) and the deployed Pages path. The checked-in kit currently contains different `Abyssal-Command` and `Abyssal-Surge` paths/names, so its current values are not release-approved.
3. Generate the Android wrapper from the reconciled manifest with the toolchain stated in [the kit instructions](../../../apk/BUILD.md). Capture the exact Bubblewrap, Node, JDK, Android SDK, Gradle, package ID, version code, and source revision in the release record.
4. Publish a completed statement based on [the Digital Asset Links template](../../../apk/assetlinks-template.json) at `https://<canonical-host>/.well-known/assetlinks.json`. It must return HTTPS HTTP 200 and valid JSON, and its `package_name` plus SHA-256 certificate fingerprint must match the installed release exactly.

Digital Asset Links are origin-scoped. The current host-root path cannot be supplied by this project Pages artifact: the [Pages allowlist](../../../.github/workflows/static.yml) archives only listed runtime files and `assets/`, while the existing kit notes that `/.well-known/assetlinks.json` belongs at the host root rather than the project subpath. Select and document one real host-root owner before building: a user-site repository for the canonical host or a custom domain whose root is controlled. Do not treat a file under this repository's project path as a successful association. If association verification fails, stop release; Custom Tabs fallback is not an accepted TWA release result.

## Signing and secret boundary

- Generate or obtain the release keystore only in an approved secret store. The [`signingKey` example](../../../apk/twa-manifest.json) is configuration input, not a committed secret; the kit explicitly requires private keystore material.
- Before generating a keystore, add its path and all generated Android signing files to the release environment's ignore/secret policy. The present [`.gitignore`](../../../.gitignore) does not list `android.keystore`; do not rely on omission as protection.
- Record the release certificate SHA-256 separately from private key material. Use that exact fingerprint in the host-root asset-links statement and validate against the signed install.
- If Play App Signing is selected later, obtain the **app-signing** certificate fingerprint from the store record and update/reverify the statement before distributing that track. An upload-key fingerprint is not a substitute.

## Offline and device release gates

A device candidate may be considered only after the original-only trace prerequisite and the following manual evidence are complete. Retain device model/OS, Chrome/WebView version, package/version code, signed certificate fingerprint, canonical origin, source revision, timestamp, screenshots or screen recording, and observed result for every row.

| Gate | Manual procedure | Required result |
|---|---|---|
| HTTPS/TWA association | Install the signed candidate from a known source while online; launch from the launcher; inspect the rendered origin and Chrome TWA verification diagnostics. | Exact canonical origin; no browser URL bar; package/certificate matches the published host-root statement. |
| First-run and cache | Complete one online launch and wait for service-worker installation; then terminate the app, disable network, and relaunch. | Cached shell starts without network after warm-up; no stale-shell error; no promise of first-ever offline launch. |
| Three-stage parity | On-device, run the Cinder Span, Veil Citadel, and Echo Throne flows; save, terminate, relaunch offline, restore, and complete the same deterministic action/reward sequence. | Stage and reward carry are preserved; resumed save is accepted; outcomes match the web rules for the recorded action trace. |
| Offline media and recovery | Exercise cached core UI, essential controls, and the required media route after warm-up; repeat after a deliberately observed service-worker cache-version update. | Essential play remains usable offline; unavailable optional media degrades without corrupting state; new cache activation does not remove valid campaign state. |
| Device interaction | Test launcher start, touch controls, back/resume, orientation used by the release, background/foreground, and a low-connectivity transition on the target handset matrix. | No blocker, crash, lost save, or unbounded UI state; failures are logged and resolved or release is stopped. |

The worker is network-first for core requests with cached fallback and best-effort optional-media precache. Therefore offline approval is a warm-cache device observation, not an assumption derived from the presence of `sw.js`. The kit's reference to cache `abyssal-surge-static-v4` is stale relative to the checked-in worker's `abyssal-surge-static-v8`; reconcile that documentation/configuration before candidate generation.

## Rollback and stop policy

**Stop before distribution** if any prerequisite above is missing, the canonical URL tuple differs across the wrapper/web manifest/asset-links statement, HTTPS or certificate verification fails, the host-root file is unreachable or invalid, offline warm-cache relaunch fails, device parity fails, a save is lost/corrupted, or G1 trace/IP requirements remain failed or unmeasured.

**Web rollback:** use the existing [Pages recovery workflow](../../../.github/workflows/static.yml) only with its required committed 40-character revision and retain the before/after origin and service-worker cache evidence. Do not roll back a web revision without retesting the installed wrapper against that revision.

**Android rollback:** do not claim that a web rollback changes an installed APK. Halt promotion before public release; after any store-track release, remove/stop the affected track according to the store operator's approved procedure and ship a higher-version corrected, newly signed candidate only after this packet's gates are rerun. Preserve the failed candidate's package/version, fingerprint, source revision, logs, and device evidence for investigation.

## Out of scope for this release

This release remains static web delivery only. Android project generation, keystore creation, APK/AAB build, sideloading, Play Console setup/listing, host-root entitlement publication, store signing enrollment, distribution, and Android acceptance evidence are future work. This follows the [production decision log](decision-log.md) and [Stage 3 handoff](handoffs/stage-3.md#echo-throne-continuation), both of which keep APK delivery outside the current campaign exit.
