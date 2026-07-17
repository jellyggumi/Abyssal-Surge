# Abyssal Surge — worldview and G1 content inventory

**Authority:** `campaign-state.js` is authoritative for public mechanics, stage text, reward effects, and values. This document assigns durable story/presentation trace IDs; it neither changes source nor asserts that proposed narration/cues are shipped. Audit date: **2026-07-16**.

## Logline and rules

> 달의 균열에서 흘러나온 메아리를 결속하는 침묵의 지휘관이, 세 개의 봉쇄선을 지나 문을 지키던 군주와 맞선다.

| Rule | Statement | Trace |
|---|---|---|
| World | The Abyssal Surge is a lunar fracture releasing Echo Deep matter into abandoned coasts. | AS-WV-001 |
| Faction | The Moonless Court contains breaches; it does not authorize conquest. | AS-WV-002 |
| Protagonist | The player is the silent Dusk Warden, who binds unstable echoes rather than speaking dialogue. | AS-WV-003 |
| Loop fiction | An Ash Echo leaves a soul pool; **Arise / 일어나라** binds it into a legion unit. | AS-WV-004, AS-WV-009 |
| Guardian | A Rift Guardian is a breach-grown sentinel protecting a sealed route; Cinder Warden is the named Cinder Span encounter. | AS-WV-006, AS-WV-014–015 |
| Stage gates | Capture stabilizes a location; possession is Stage 2 only; one-use Lord's Domain is Stage 3 only; Assault is the boss gate. | AS-WV-005, AS-WV-007, AS-WV-008, AS-WV-010, AS-WV-074 |
| Antagonists | Cinder Warden, Veil Tactician, and Gate Sovereign are the named stage opponents, in that order. | AS-WV-014, AS-WV-027, AS-WV-038 |
| Series arc | Containment becomes a question of inheritance: each victory opens the next sealed approach, ending at the throne. This is narrative interpretation, not a new gameplay state. | AS-WV-070 |

## Runtime content inventory (exact current player-visible values)

| ID | Runtime entity / field | Exact current value |
|---|---|---|
| AS-WV-011 | `cinder-span` / name | Cinder Span |
| AS-WV-012 | `cinder-span` / region | The ember bridge above the drowned forge |
| AS-WV-013 | `cinder-span` / objective | Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, then break the Cinder Warden. |
| AS-WV-014 | `cinder-span` / boss name | Cinder Warden |
| AS-WV-015 | `cinder-span` / boss description | The forge bridge's ashbound sentinel breaks intruders against the drowned iron. |
| AS-WV-016–017 | `ember-cohort` / name, description | Ember Cohort — Materialize raises 2 additional shades (base 2) for the remaining campaign. |
| AS-WV-018–019 | `rift-lens` / name, description | Rift Lens — possession assaults deal +4 damage from Veil Citadel onward. |
| AS-WV-020–021 | `stillwater-hourglass` / name, description | Stillwater Hourglass — reduce command cooldowns by 20%; the second Hunt immediately extracts the soul cache. |
| AS-WV-022–023 | `shadebreaker-brand` / name, description | Bulwark Brand — reduce every boss counterblow by 2 (never below 1). |
| AS-WV-024 | `veil-citadel` / name | Veil Citadel |
| AS-WV-025 | `veil-citadel` / region | A fortress of listening stone |
| AS-WV-026 | `veil-citadel` / objective | Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil. |
| AS-WV-027–028 | `veil-citadel` / boss | Veil Tactician — A tactician of listening stone that turns every uncovered route into a killing field. |
| AS-WV-029–030 | `veil-vanguard` / name, description | Veil Vanguard — Start Echo Throne with four shades already raised; this skips setup but remains a thin legion. |
| AS-WV-031–032 | `anchor-shard` / name, description | Anchor Shard — restore 2 additional integrity when entering Echo Throne. |
| AS-WV-033–034 | `abyssal-banner` / name, description | Abyssal Banner — enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis. |
| AS-WV-035 | `echo-throne` / name | Echo Throne |
| AS-WV-036 | `echo-throne` / region | The gate above the last remembered sea |
| AS-WV-037 | `echo-throne` / objective | Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign. |
| AS-WV-038–039 | `echo-throne` / boss | Gate Sovereign — The final gate's remembered ruler, holding back the last abyssal tide. |
| AS-WV-040–041 | `throne-echo` / name, description | Throne Echo — records the legion's final oath in the campaign archive. |
| AS-WV-042–043 | `dawnless-crown` / name, description | Dawnless Crown — records a crown forged from the closed gate. |

## Canonical narrative lines — proposed presentation only

These lines are the single approved copy source for this revision. Each row is individually traceable; implementation must add a resource-manifest entry before exposing a proposed line.

| ID | Cue | Korean player-facing copy |
|---|---|---|
| AS-WV-044 | intro.1 | 심연의 문이 열렸다. |
| AS-WV-045 | intro.2 | 그림자 군주여, 일어나라. |
| AS-WV-046 | stage1.1 | 잿빛 교량, 신더 스팬. |
| AS-WV-047 | stage1.2 | 재의 메아리를 사냥하고 영혼을 거두어라. |
| AS-WV-048 | stage2.1 | 장막 성채, 베일 시타델. |
| AS-WV-049 | stage2.2 | 빙의의 힘이 깨어난다. |
| AS-WV-050 | stage2.3 | 두 거점을 동시에 장악하라. |
| AS-WV-051 | stage3.1 | 메아리 왕좌. |
| AS-WV-052 | stage3.2 | 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라. |
| AS-WV-053 | boss1.1 | 다리 끝, 재가 일어선다. |
| AS-WV-054 | boss1.2 | 「너도 결국 나처럼 묶인다.」 |
| AS-WV-055 | boss1.3 | 신더 워든이 방패를 세운다. |
| AS-WV-056 | boss2.1 | 거울이 명령을 삼킨다. |
| AS-WV-057 | boss2.2 | 「나는 문을 지키지 않는다.」 |
| AS-WV-058 | boss2.3 | 베일 택티션이 진형을 뒤집는다. |
| AS-WV-059 | boss3.1 | 왕좌가 그대를 부른다. |
| AS-WV-060 | boss3.2 | 「빈 왕좌는 없다. 오직 교대뿐.」 |
| AS-WV-061 | boss3.3 | 게이트 소버린이 문을 등지고 선다. |
| AS-WV-062 | victory.1 | 침묵한 문 앞에서, |
| AS-WV-063 | victory.2 | 그림자 군단이 왕좌에 오른다. |
| AS-WV-064 | victory.3 | 심연은 다음 군주를 기억한다. |
| AS-WV-065 | defeat.1 | 군단의 닻이 끊어졌다. |
| AS-WV-066 | defeat.2 | 다시, 일어나라. |

## Cinematic and scenario interpretation inventory

| ID | Item | Allowed use / boundary |
|---|---|---|
| AS-WV-067 | Cinder cue | Heatless spoor, drowned forge, ashbound sentinel, then a captured relay. Must depict hunt → extract → materialize → capture → assault; no new command. |
| AS-WV-068 | Veil cue | Listening-stone fortress and mirror-like command distortion; two held signal nodes precede one possession and assault. |
| AS-WV-069 | Echo cue | Gate above the remembered sea; throne node, one Lord's Domain flare, then the Gate Sovereign. |
| AS-WV-070 | Campaign interpretation | S1 reveals an echo is more than disposable residue; S2 reveals the citadel is a prison-like barrier; S3 frames victory as succession. These are optional narrative readings, not runtime facts or a fourth stage. |
| AS-WV-071 | S1 twist | The Warden hears the Cinder Warden call binding a shared fate. The twist must not contradict the Ash Echo mechanic. |
| AS-WV-072 | S2 twist | “I do not guard the door” reframes the Tactician as a keeper of containment. It does not alter the two-node/possession gate. |
| AS-WV-073 | S3 twist | “Only succession” frames the final victory while preserving the terminal `campaign-complete` state. |
| AS-WV-074 | Mechanical boundary | Only `hunt`, `extract`, `materialize`, `capture`, `possess`, `domain`, and `assault` are campaign commands. No story asset may require, conceal, or simulate another command. |

## G1 audit rules and unknowns

- A visible line, beat, still, video cue, audio cue, or reward framing without an `AS-WV-*` reference is a **G1 inventory defect**.
- Proposed narration/media in AS-WV-044–073 are **not shipped merely by being listed**. Their asset IDs, files, source provenance, and runtime references remain unverified until the resource/QA artifacts record them.
- Existing audio files are not asserted to be image-generated. Audio provenance and validation require a separately importable chatbot-generated source record; image provenance, if new art is produced, must be GodTiboImagen.
- Current production status: G1 **NOT-RUN**. This inventory is a trace contract, not pass evidence.
