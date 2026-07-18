# WebGL Combat VFX/Audio Implementation

## Scope
Primary WebGL renderer (`battle-realtime-three.js`, class `RealtimeBattle`) previously had zero particle effects and zero spatial audio. This document records what was added.

## New subsystems

### `ParticleField` (pooled point-sprite emitter)
- Capacity: 360 particles, fixed pool, no per-frame allocation (`PARTICLE_CAPACITY = 360`).
- One `THREE.Points` instance per battle session; buffer geometry with position/color/size attributes updated in place.
- `emit(x, y, z, color, count, { speedMin, speedMax, life, gravity, upBias })` — spawns into free pool slots; silently drops if pool is exhausted (no error, no unbounded growth).
- `update(dt)` — advances position by velocity, applies gravity, fades size/opacity by remaining life fraction, recycles dead particles.

### `SpatialAudio` (Web Audio positional playback)
- Guards `typeof window === "undefined"` — safe to construct in Node test environment (fixed after initial `window is not defined` test-suite crash; see `qa/gate-measurements.md`).
- `AudioContext` + `listener` (virtual, tracks camera/ground focus, not the OS audio listener) + `master` gain node.
- `playTone(x, y, z, { freq, endFreq, duration, type, gain, upBias })` — synthesized oscillator tone (no audio asset dependency) with `PannerNode` HRTF-style distance/azimuth panning, exponential frequency sweep when `endFreq` given.
- `playSample(name, x, y, z, gain)` — decodes and plays an existing `assets/audio/*.mp3` file positionally (reuses the same 7 action-cue files already shipped for the flat 2D layer, now spatialized).
- Listener position/orientation updates once per frame from camera state so panning tracks the orbit camera.

## Wiring points (all null-guarded — `this.particles?.emit(...)`, `this.audio?.playTone(...)`, since tests construct `RealtimeBattle` without a canvas/init())

| Event | Particles | Audio | Camera |
|---|---|---|---|
| Player action (hunt/extract/materialize/capture/possess/domain/assault) | via `emitActionFeedback` (now the shared implementation with the concurrently-landed `actionFeedbackProfile`/`actionFeedbackPoint` refactor) | positional tone, source+target points | shake+hit-stop on `assault` |
| Melee clash (`clashEffect`) | spark burst + clang tone at exchange midpoint | percussive tone | — |
| Unit defeat (`defeat`) | dissolve particles, boss-weighted count | boss-specific defeat tone (lower/longer for boss) | — |
| Enemy breach (portal reached) | warning particles at portal | rising alarm tone | shake |
| Wave-cleared | celebration particles (ally-palette) | resolving tone | — |
| Movement (`moveCommander`) | footstep dust (throttled by shared timer), surge trail while sprinting | — | — |
| Ambient (`updateAmbience`, per-frame) | slow drifting motes in stage accent color | — | — |

## Camera feel
- `shakeCamera(magnitude, duration)` — additive positional jitter (wall-clock-driven `performance.now()`, intentionally unseeded/non-deterministic — cosmetic-only, unlike the Canvas 2D fallback's mulberry32 presentation RNG) decaying via a peak-hold-and-hold-until-weaker-pulse envelope over `duration`; composes with existing orbit/zoom camera math without replacing it. A new pulse only re-arms the decay envelope when its initial strength would exceed the currently-decaying strength, preventing a weaker/shorter pulse from causing an amplitude spike in an in-progress stronger shake.
- `triggerHitStop(duration)` — briefly clamps frame `dt` near zero on heavy impacts (boss defeat, boss-exposed assault) for a readable "impact frame" without pausing the render loop itself.

## Performance verification
Measured via prototype-patched `RealtimeBattle.prototype.update` timing over ~3s of live combat with particles/audio active vs. a WITHOUT-particles-and-audio comparison pass:
- Total `update()`: ~0.221ms/call average.
- Particle-system share: ~2.3% of that (~0.005ms).
- Audio-system share: ~14.2% of that (~0.031ms).
- Both negligible against the 16.7ms (60fps) frame budget; no `frame > 16.7ms` outliers attributable to particles/audio in the sampled window (baseline headless-renderer overhead — ANGLE/SwiftShader software path — dominates, not a regression from this work).

## Test coverage added
`tests/battle-realtime-three.test.mjs`: no-crash guarantee for every action/combat-event call site pre-`init()` is covered (this was the actual bug the Node test suite caught: `this.particles?.emit(...)` needed the optional-chaining guard because tests construct `RealtimeBattle(null, {...})` without ever calling `init()`). NOT covered by any test: direct `ParticleField`/`SpatialAudio` class construction, particle pool recycling under >360-particle load, or real `AudioContext`/WebGL2 buffer allocation — that surface is exercised only by manual/production use and the browser E2E playtest.
