# Abyssal Surge — 오프라인 RTS-RPG의 저장·멀티플레이 진화 조사

## 범위와 결론

이 문서는 web-first **Abyssal Surge**를 정적·오프라인 첫 출시에서 계정 저장과 협동/경쟁 멀티플레이로 확장하는 경로만 다룬다. 첫 GitHub Pages 릴리스의 명시적 비목표는 다음과 같다.

> **비목표 (initial GitHub Pages release):** 계정, 클라우드 저장, 원격 API, 분석 수집, 매치메이킹, WebSocket, 협동/경쟁 플레이, 리더보드, 서버 기반 치트 판정은 구현하거나 요구하지 않는다. 저장은 브라우저 로컬의 비경쟁 캠페인 편의 기능일 뿐이며, 신뢰 경계가 아니다.

**권고:** 첫 릴리스는 버전이 명시된 `SaveEnvelope`를 IndexedDB에만 저장하고 export/import를 제공한다. 클라우드 프로필 요구가 검증되면 **Supabase Auth + Postgres/RLS**를 저장 API로 추가한다. 실제 동시 협동 또는 경쟁 결과가 가치화되는 시점에는 저장 백엔드와 실시간 전투 권한을 분리하고, **Nakama authoritative match**를 기본 경쟁/협동 해법으로 선택한다. Cloudflare Durable Objects는 작은 초대형 협동 방의 단일 룸 조정 대안이지만, 전투 시뮬레이션·재접속·감사 로그까지 직접 설계할 수 있을 때만 채택한다.

이 순서는 정적 배포의 무운영비를 보존하며, `SaveEnvelope`와 명령 프로토콜을 유지한 채 서버 권한을 추가한다. 클라이언트 상태를 서버의 진실로 승격시키지 않는다.

## 출처 — 공식 문서 (2026-07-16 확인)

1. Supabase, **Realtime Authorization** — <https://supabase.com/docs/guides/realtime/authorization>
2. Firebase, **Access data offline (Cloud Firestore)** — <https://firebase.google.com/docs/firestore/manage-data/enable-offline>
3. Firebase, **Transactions and batched writes (Cloud Firestore)** — <https://firebase.google.com/docs/firestore/manage-data/transactions>
4. Cloudflare, **Use WebSockets with Durable Objects** — <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>
5. Heroic Labs, **Nakama Authoritative Multiplayer** — <https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/>

### 출처에서 확인한 사실

- Supabase Realtime은 `realtime.messages`의 RLS와 Auth JWT, 채널 topic을 사용하여 private Broadcast/Presence 접근을 판정한다. private 채널은 public access를 끄고 클라이언트에서 `private: true`로 열어야 한다. 이 검사는 연결/채널 join 때 수행되며, 복잡한 RLS는 join latency와 join rate를 악화시킬 수 있다. Broadcast 메시지는 해당 테이블에 영속 저장되지 않는다. [1]
- Firestore 웹의 offline persistence는 기본 비활성이고, 활성화 시 수신 문서가 브라우저 캐시에 남을 수 있으므로 민감 정보에서는 trusted device 확인이 필요하다. 온라인 복귀 시 로컬 변경을 동기화하며 같은 문서의 다중 변경은 last-write-wins다. [2]
- Firestore transaction은 read 뒤 write를 원자적으로 적용하고 동시 수정 시 재시도되지만, **클라이언트가 offline이면 실패**한다. 따라서 게임 결과 판정 또는 재화 부여를 클라이언트 transaction으로 설계할 수 없다. [3]
- Cloudflare Durable Object는 한 인스턴스가 여러 WebSocket 클라이언트를 조정할 수 있다. hibernation API는 연결을 유지한 채 유휴 객체를 메모리에서 내리고, 깨어날 때 constructor를 다시 실행한다. 따라서 연결별 attachment와 룸 상태의 영속/복구가 필요하다. 작은 메시지 다수는 단일 객체를 과부하할 수 있어 batch envelope가 권장된다. [4]
- Nakama authoritative multiplayer에서는 서버가 gameplay data를 검증하고 상태 변경을 broadcast한다. match handler는 join attempt, join/leave, loop, terminate 등을 정의하며, 클라이언트가 직접 호출할 수 없다. match loop가 빈 방에서도 실행되므로 empty-room 종료 정책을 명시해야 한다. 낮은 tick rate부터 시작해 responsiveness가 필요할 때만 올리라는 지침이 있다. [5]

## 결정 매트릭스

| 프로파일 | 영속 저장 / 최소 API | 실시간·룸 lifecycle | 권한과 치트 경계 | 운영·비용 trade-off | 판정 |
|---|---|---|---|---|---|
| **P0: Static local** | IndexedDB의 로컬 `SaveEnvelope`; `list/load/put/delete/export/import`는 브라우저 내부 API | 없음 | 클라이언트가 전부 소유; 수정은 허용되는 single-player mod/cheat | GitHub Pages만 사용, 서버·계정·비용 0; 기기 분실/브라우저 데이터 삭제에 취약 | **첫 출시 채택** |
| **P1: Cloud profile sync — Supabase** | Auth 사용자당 Postgres `campaign_saves`; server endpoint/RPC가 owner·revision·schema를 확인 | Realtime은 lobby/presence 또는 비권위적 초대 신호만; private topic + RLS | RLS는 데이터 소유권 보호에는 적합하나 Broadcast 자체는 전투 판정 서버가 아님 | SQL backup/migration, Auth, RLS 정책과 연결 성능을 운영; RLS 복잡도는 join latency 위험 [1] | **클라우드 저장·친구 초대에 권장** |
| **P1 대안: Firestore** | user-scoped document에 envelope; 문서 단위 sync | listener 기반 동기화는 가능하지만 전투 tick transport로는 부적합 | offline cache와 LWW 때문에 경쟁 결과/재화의 canonical write에 부적합; transaction도 offline 실패 [2][3] | 빠른 managed 시작 대신 문서 읽기/쓰기 비용과 오프라인 충돌 UX를 관리 | **저장-only라면 가능, 기본 선택 아님** |
| **P2: 초대형 co-op — Durable Object room** | 영속 profile은 별도 DB; 방은 room-id → one Durable Object, 명령 로그/스냅샷은 별도 durable store | join auth → room attach → snapshot → ordered commands → disconnect grace → empty TTL → terminate; hibernation 후 state 복구 필수 [4] | Worker/DO가 명령 범위·순서·rate를 검증; client snapshot은 표시용 | 항상 켜진 방보다 유휴 hibernation 비용 이점이 있으나, reconnect, persistence, scaling, abuse 방어를 팀이 직접 보유 | **소규모 초대 협동에 조건부** |
| **P3: 경쟁 또는 공정 co-op — Nakama authoritative** | profile/entitlement와 match result를 server DB에 기록; 결과는 match 종료 시 한 번 commit | match handler가 join attempt, join/leave, fixed-tick loop, empty-room 종료와 결과를 소유 [5] | 서버가 입력 검증·RNG·전투·보상·승패를 결정; client는 command sender/rendering only | runtime code, deployment, observability, DDoS/abuse 대응, capacity/tick tuning이 필요 | **경쟁 및 공유 진행의 기본 선택** |

### 선택 근거와 배제

- **Supabase**는 낮은 빈도의 계정 저장과 lobby metadata에 맞는다. RLS/JWT가 소유권을 판정하므로 `user_id`를 클라이언트 요청 본문에서 신뢰하지 않아도 된다. 그러나 RLS-보호 Broadcast는 메시지 영속/판정 엔진이 아니므로 RTS 전투 권한으로 격상하지 않는다. [1]
- **Firestore**의 local-first 장점은 P0/P1 저장 UX에는 유용하지만, LWW 동기화와 offline transaction 실패가 경쟁 캠페인의 canonical result와 충돌한다. [2][3]
- **Durable Objects**는 room-id 단위 단일 조정자로 자연스럽지만 hibernation이 메모리 상태를 지우므로, 스냅샷/명령 sequence/연결 attachment를 재구성하는 설계가 전제다. [4]
- **Nakama**는 중앙 상태, 높은 공정성, 클라이언트를 신뢰하지 않는 규칙에 적합한 authoritative lifecycle을 제공한다. 대신 일반적인 RTS 규칙은 제공하지 않으므로 전투 시뮬레이션·join-in-progress·결과 규칙을 팀이 runtime code로 정의해야 한다. [5]

## 최소 버전 데이터 모델과 저장 API

P0부터 동일한 envelope를 유지한다. `schemaVersion`은 저장 데이터의 계약이고, `gameBuild`는 콘텐츠 호환성 식별자다. 새 콘텐츠는 unknown field를 보존하지 않는 구형 클라이언트가 쓰지 않도록 `minReaderVersion`을 올린다.

```ts
type SaveEnvelopeV1 = {
  schemaVersion: 1;
  minReaderVersion: 1;
  slotId: string;              // UUID; 서버가 만든 ID를 P1부터 사용
  campaignId: string;          // 공개된 campaign definition ID
  gameBuild: string;           // content manifest/hash or semver
  revision: number;            // local monotonic revision; server concurrency token at P1+
  savedAt: string;             // ISO-8601; client display metadata, not trust signal
  checksum: string;            // corruption detection only; not anti-cheat
  state: {
    chapterId: string;
    difficulty: "normal" | "hard";
    unlocked: string[];
    roster: Array<{ unitId: string; level: number; xp: number; loadout: string[] }>;
    inventory: Record<string, number>;
    map: { seed: string; completedNodeIds: string[]; currentNodeId?: string };
    settings?: { audio?: number; reducedMotion?: boolean };
  };
};

type SaveIndexEntry = Pick<SaveEnvelopeV1,
  "slotId" | "campaignId" | "gameBuild" | "revision" | "savedAt">;
```

**P0 browser API:**

```ts
interface LocalSaveStore {
  list(): Promise<SaveIndexEntry[]>;
  load(slotId: string): Promise<SaveEnvelopeV1 | null>;
  put(save: SaveEnvelopeV1): Promise<void>;
  delete(slotId: string): Promise<void>;
  export(slotId: string): Promise<Blob>;
  import(file: Blob): Promise<{ slotId: string; migration: "none" | "applied" }>;
}
```

**P1 server contract:** keep `SaveEnvelope` payload-compatible, but never expose generic table writes as the game API.

| Endpoint | Request | Server invariant / response |
|---|---|---|
| `GET /v1/saves` | authenticated identity | returns only caller-owned `SaveIndexEntry[]` |
| `GET /v1/saves/{slotId}` | authenticated identity | owner check; returns latest validated envelope and opaque `etag` |
| `PUT /v1/saves/{slotId}` | envelope + `If-Match: etag` | owner check, size/schema/content validation, optimistic revision update; `409` returns latest index/etag rather than silently overwriting |
| `POST /v1/saves/import` | envelope file | validates/migrates to current schema, creates a server slot; does not award remote economy |
| `DELETE /v1/saves/{slotId}` | authenticated identity | owner check, soft-delete retention policy, idempotent response |

**DB shape at P1:** `profiles(user_id PK, created_at, display_name)`, `campaign_saves(slot_id PK, user_id FK, schema_version, game_build, revision, payload_json, payload_checksum, created_at, updated_at, deleted_at)`, and append-only `save_migrations(slot_id, from_version, to_version, migrator_id, occurred_at)`. Enforce `(user_id, slot_id)` ownership with RLS; put only `payload_json` behind the validated endpoint/RPC, not a broad client `UPDATE` policy. `revision`/ETag prevents last-writer wins from silently replacing a different device's campaign state.

### Schema migration policy

1. A reader accepts only its supported version range; it refuses unknown future versions and offers export, never destructive downgrade.
2. `migrate(vN → vN+1)` is deterministic, pure, idempotent for a given input, and writes a *new* envelope only after validation. Keep the original local export and, online, the prior revision for rollback.
3. Migration changes are additive first; field removal is deferred until no supported reader needs it. Version game-content definitions independently from save schema, preserving old `campaignId`/content manifest availability for existing saves.
4. P1 migration runs server-side for canonical cloud saves and locally only for P0 copies. Competitive P3 match state is not migrated in place mid-match: pin each room to a ruleset/content hash, finish or terminate it, then migrate profile data before the next queue.

## Client/server authority boundaries

| Concern | P0 offline | P1 profile sync | P2/P3 multiplayer |
|---|---|---|---|
| UI, rendering, local input buffering | Client | Client | Client; prediction only if it can be reconciled |
| Campaign save contents | Client-owned | Client proposes; server validates ownership/schema/revision | Server-owned if shared/economic; client local cache is noncanonical |
| Lobby membership / invite | N/A | Server decides membership; Realtime only signals allowed members | Room/match server validates admission and reconnect token |
| Unit movement, targeting, cooldown, fog, RNG | Client | Do not claim authority | Server consumes commands and simulates/validates; broadcast snapshots/deltas |
| Loot, XP, unlocks, achievements, match result | Client | Server accepts only validated single-player save progression policy | Server calculates and commits once; client display is advisory |
| Disconnect/reconnect | N/A | save retry with ETag | Server retains session identity, grace deadline, last acknowledged command/tick; resyncs snapshot after reconnect |

**Command boundary:** a multiplayer client sends an intent, never a state replacement:

```ts
type Command = {
  protocolVersion: 1;
  matchId: string;
  clientSeq: number;
  expectedServerTick: number;
  kind: "move" | "attack" | "cast" | "ready";
  payload: unknown;            // strictly schema-validated per `kind`
};
```

The server authenticates the session and match membership; deduplicates `(playerId, clientSeq)`; applies per-command size/rate limits; verifies ownership, visibility/range, resources, cooldown and ruleset; advances authoritative RNG and state; emits `serverTick`, state delta/snapshot and acknowledged sequence. A client may render prediction but must discard/rewind it on authoritative correction. The checksum in P0 data only detects accidental corruption; it cannot prevent editing because browser code and storage are user-controlled.

## 보안·치트 방어 경계

- **GitHub Pages cannot keep a secret.** API keys with elevated privilege, private signing keys, admin endpoints, economy rules, or anti-cheat trust material must never ship in JavaScript, source maps, static JSON, or GitHub Actions artifacts. A public browser key can identify a project but does not authorize privileged server work.
- Authenticate before profile/room access; authorize on every row and every room command. In Supabase, restrict both Broadcast receive/send and Presence receive/send through private channel RLS policies; do not rely on an unguessable room name. [1]
- Server-enforce payload schema/maximum bytes, command and join rate limits, allowed origins/CORS, token expiry/rotation, room capacity, invitation expiry, and replay/deduplication. Record rejection reason class and abuse counters without storing raw sensitive payloads by default.
- Keep authoritative rules, hidden information, secure RNG seed and reward calculation on P3 server. TLS protects transit but does not make a client trustworthy. Never accept a client-reported gold total, damage result, fog visibility, timer, or victory flag.
- Use least-privilege database roles, encrypted backups, retained migration audit records, deletion/export paths, dependency patching and incident revocation. Treat P1 cloud saves as personal data: publish retention/deletion behavior before account launch.
- For Durable Objects, restore only validated serialized attachment/session data after hibernation; reauthenticate on resume instead of treating a resurrected WebSocket as proof of identity. [4]

## 단계별 migration gate와 hard trigger

| Stage | Enter only when measurable trigger is true | Deliverable / exit gate |
|---|---|---|
| **0 — Static offline (launch)** | Always; first release | IndexedDB `SaveEnvelopeV1`, 3 local slots minimum, export/import, corrupt/future-save rejection, no outbound network requests required for a completed campaign |
| **1 — Optional cloud profile** | At least **20% of consented playtesters** request or attempt cross-device continuation **and** the team can staff account recovery, deletion, backup restore and monthly spend alerts | Supabase-backed profile save pilot; 95% successful valid save/load API operations in a representative soak; conflict UX for stale ETag; RLS tests prove account A cannot enumerate/read/write account B |
| **2 — Invite-only co-op** | A playtest cohort completes **30 planned co-op sessions** and the product requires shared live decisions (not merely sharing exported save files); P1 identity is already stable | bounded 2–4 player rooms, authenticated invite lifecycle, reconnect snapshot, room TTL/empty termination, command-rate and payload enforcement; reconnect within chosen grace window must converge to identical authoritative snapshot |
| **3 — Competitive/co-op authority** | Any of: ranked result, shared scarce reward, public leaderboard, cross-player trading, paid entitlement, or abuse report where a modified client could affect another player | Nakama authoritative prototype at chosen low tick rate; server replay/verifier produces same result from command log; invalid/replayed/out-of-order commands cannot alter result; server alone commits rewards/results |
| **4 — Scale/operations** | Sustained concurrency or regional latency breaches the SLO set during P2/P3, or projected hosting + egress + observability spend exceeds the approved monthly guardrail for two consecutive weeks | capacity model per room/tick, load test at 2× release CCU, region/failover decision, budget alerts, dashboards for joins, tick duration, reconnects, reject rate, save conflict rate, and incident/rollback runbook |

**Hard stop:** do not expose P2/P3 publicly if a client can submit state instead of commands, a room accepts unauthenticated or unauthorized joins, a server cannot reconstruct or audibly explain a final result, or backup/restore and revocation have not been rehearsed. Do not replace P0 static delivery merely to add analytics or speculative multiplayer.

## 미해결 위험과 pre-commit decisions

1. **Game determinism:** decide whether server is a full fixed-tick simulator (recommended for competitive RTS) or validates coarse commands. This determines snapshot bandwidth, replay fidelity and compute cost.
2. **Progression boundary:** choose whether co-op rewards are cosmetic, account-local, shared campaign state, or ranked. Shared/valuable progression immediately triggers P3 authority; a direct `PUT` of a campaign envelope is insufficient.
3. **Identity and privacy:** decide anonymous guest upgrade, child/privacy jurisdictions, account deletion SLA, data residency and support ownership before Stage 1—not after storing player saves.
4. **Economics:** set numeric SLOs and budget caps before selecting a managed tier. Realtime cost depends on connection duration, messages, DB reads/writes and egress; Cloudflare notes that excessive small frames can overload one room instance. [4]
5. **Content compatibility:** define content manifest retention and a sunset policy before shipping balance/data updates; otherwise an old save or match replay can become unreadable.

## Production-harness acceptance evidence

The harness can measure these future gates without treating this research file as code:

| Requirement | Evidence artifact / assertion |
|---|---|
| Static initial release has no online requirement | browser network capture for new game, save, load and finish-campaign path contains no backend/auth/WebSocket request; deployment is a GitHub Pages static bundle |
| Minimal local saves are compatible | fixtures for V1 valid save, corrupt checksum, unknown future version, and V1→V2 migrator; round-trip preserves semantic state and migration keeps original export |
| Cloud save has ownership and conflict integrity | integration tests with two authenticated principals show cross-account GET/PUT/DELETE denied; stale `If-Match` receives `409`; validated payload increments revision exactly once |
| Room lifecycle is bounded | lifecycle trace proves unauthorized join denial, invite expiry, capacity rejection, empty-room termination and reconnect snapshot convergence; no room survives its TTL without policy justification |
| Multiplayer authority is real | replay a recorded ordered command log twice and assert identical result hash; inject modified state snapshot, invalid target, duplicate sequence and out-of-order sequence and assert no canonical state/reward change |
| Operations are consciously gated | release checklist includes approved SLO/budget, 2× CCU load result, backup restore result, secret scan, dependency scan, abuse-rate dashboard and rollback owner |

## Recommendation recap

Ship P0 exactly as a static, offline RTS-RPG with local versioned saves. Keep `SaveEnvelope` stable and command-shaped game actions in the domain model now, but do not insert server abstractions into the initial release. Gate cloud saves on demonstrated cross-device demand; gate any shared live gameplay on authenticated rooms; gate competitive or valuable co-op on a server-authoritative match runtime. This avoids making a GitHub Pages campaign pretend to be secure multiplayer while retaining a concrete migration seam when evidence justifies the operational burden.
