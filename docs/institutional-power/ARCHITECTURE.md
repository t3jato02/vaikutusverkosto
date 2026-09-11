# Institutional Power — Architecture

Vaikutusverkosto maps **documented institutional power** in Finland: the people and
organisations that hold authority over companies, state-owned companies, municipal
companies, critical infrastructure, public services, markets and finance — with a
public source behind every claim.

This document is the shared architecture contract for the expansion. It sits in
`docs/institutional-power/` and is the canonical reference for every parallel stream.
Read `PARALLEL_WORK_CONTRACT.md` for the collaboration rules.

---

## 1. Reality check (proved from the repo, 2026-09-11)

| Item | Value |
| --- | --- |
| Authoritative repo | `https://github.com/t3jato02/vaikutusverkosto.git` |
| Repo root | `C:\dev\ArcticPearl Technologies\political_influence` |
| Deployment provider | **Vercel** (`prj_fGWoZtexFb64TZ8F0mP5VFBxZerx`, `team_nq7eYJ1FqTxpgLapbzDKJkGJ`, project `vaikutusverkosto`) |
| DB technology | PostgreSQL 16 (Docker local `:5434`; pooled Postgres / Supabase in production) |
| Schema/migrations | Prisma; migrations under `prisma/migrations/` (23 applied in the local dev DB) |
| Production base | `origin/main` — **`40ab60bc059bf229daadda308daf400eea2b3c56`** (fast-forwarded during the session; `FOUNDATION_READY_SHA` is recorded in `PARALLEL_WORK_CONTRACT.md`) |
| CICD | `vercel.json`: `prisma migrate deploy` on production builds; cron `0 4 * * *` → `/api/cron/ingest` |

> The Vercel `/api/version` reports `sha: "unknown"` because the live build was deployed
> without `BUILD_SHA`. The repository remains the authoritative source of truth.

### Graph model (pre-existing, reused)
- **Entity** — universal node (`Person` / `Organization` extension records; `EntityAlias`,
  `ExternalIdentifier`, `EntityCategory`).
- **Relationship** — directed, typed, dated edge (`RelationshipType`, `startDate`/`endDate`,
  `temporalState`, `percentage`, `verificationStatus`, `Evidence[]`).
- **FinancialFlow** — first-class money movement (payer → recipient, amount, currency,
  `FlowType`, period, project, country codes).
- **Position** — person ↔ organisation role (extended by this foundation, see §3).
- **Evidence/Source** — `Source` (per-document), `Evidence` (fact → source links),
  `IngestionSource` registry, `SourceDocument` collector snapshots.
- **Candidate lane** — `RelationshipCandidate` (unresolved/rule/llm facts park here, never
  guessed), `EntityResolutionCandidate`, `SourceConflict`.
- **Ops** — `AgentRun`/`AgentFinding`, `VerificationQueue`, `ChangeLog`, `ReviewAction`,
  `Correction`, `RightOfReply`, `MethodologyVersion`, `NetworkAnalytics`.

### Agent stack (pre-existing, reused)
`src/lib/agents/registry.ts` registers 10 adapters (eduskunta, procurement, prh,
sidonnaisuudet, euFts, euTransparency, vnkOwnership, yle, award, giftBenefit). All run
through `pipeline.ts` (discover → fetch → change-detect → parse → publish) with run-locks,
resumable ticks and source health. The scheduler (`scheduler.ts`) is cadence-driven.

---

## 2. Core design principle

The system maps **documented** institutional power. It does not make allegations.

Never equate:
- board membership = corruption
- procurement = influence
- ownership = political support
- employment = ideological affiliation
- lobbying contact = improper influence
- shared organisation = friendship

Every displayed claim resolves to:

```
ENTITY → ROLE / RELATIONSHIP / TRANSACTION / EVENT → EVIDENCE → SOURCE
```

A fact with no source is not displayed. A fact whose source is weak is stored but marked
`AUTO_DETECTED` and never shown as confirmed (see §7).

---

## 3. Schema additions (migration `20260912000000_institutional_power_foundation`)

One additive migration. Enum `CREATE TYPE` statements are guarded
(`IF NOT EXISTS`) so the migration is safe both on a clean production baseline and on a
dev database that already carries a newer sprint migration.

### 3.1 Person classifications (section 2)
There is **no** mutually-exclusive person category table. Classifications are **derived
deterministically** from source-backed facts by `src/lib/institutionalPower/classification.ts`:

- `Position.roleType` → classification (e.g. `CEO`, `BOARD_CHAIR`, `MINISTER`).
- Documented board relationships → `BOARD_MEMBER` / `BOARD_CHAIR`.
- Documented employment sector → `BANKER` / `INVESTOR` (`employmentClassification`).

A person may simultaneously be *former minister + company board chair + foundation
trustee*; a historical fact never presents as current.

### 3.2 RoleAssignment — the extended `Position` model (section 3)
`Position` **is** the generic temporal `RoleAssignment`. New columns:

`roleType RoleType?`, `department String?`, `appointmentMethod String?`,
`appointedByEntityId UUID?`, `evidenceGrade EvidenceGrade?`, `verificationStatus`,
`lastVerifiedAt`.

Conceptual mapping: `role` = roleTitle, `startDate` = validFrom, `endDate` = validTo,
`isCurrent` = current. `RoleType` covers the full suggested list (MP … LOBBYIST, OTHER).

### 3.3 Ownership graph (section 4)
Ownership stays on the `OWNS`-family `Relationship` edges with new fields:
`shareClass`, `votingRightsPct`, `isIndirect`, `ownershipCalculationStatus`
(`REPORTED | CALCULATED | UNKNOWN`), `externalRecordId` (unique, per-source dedup).

Chains (State → Patria → subsidiary; foreign state → foreign company → Finnish company)
are traversed by `src/lib/institutionalPower/ownership.ts`. **A percentage is never
inferred**: only `REPORTED` or `CALCULATED` values count; beneficial ownership is never
assumed without evidence.

### 3.4 Sector taxonomy (section 5)
`enum Sector` (~50 values from the specification) + **`OrganizationSector`** join model
(multiple sectors per organisation, `@@unique([entityId, sector])`, source-bound,
evidence-graded, valid-window).

### 3.5 Criticality without secret data (section 6)
`enum CriticalFunction` (13 values) + **`CriticalFunctionAssignment`** model carrying
`classificationSource`, `publicBasis` (required), `confidence`, `evidenceGrade`,
`sourceId`. A criticality label exists **only** when a public source documents it. The
system never reconstructs classified infrastructure, HVK lists, emergency plans or
hidden dependencies.

### 3.6 Procurement (section 10)
**`ProcurementContract`** model: contracting authority → supplier, `value`+`currency`,
`cpv`, `procedure` (`enum ProcurementProcedure`), `publicationUrl`, `awardDate`,
`noticeId`, source-bound, `dedupeKey`. Public label is **"Hankintasuhde"**, never
"Vaikuttaa".

### 3.7 Lobbying (section 11)
**`LobbyingEngagement`** model: organization → target, `subject`, `communicationMethod`,
`periodStart`/`periodEnd`, `reportedFinancialResources`+`currency`, source-bound.
Never transformed into corruption or political alignment.

### 3.8 Grants / funding (section 12)
No new tables. Reuses `FinancialFlow` + `FundingType` + `Project` (government, EU,
municipality, foundation, company, organisation funding are all expressible).

---

## 4. Institutional influence metric (section 7)

`institutionalInfluence()` in `src/lib/metrics.ts` returns a decomposable 0–100 score:

| Component | Basis |
| --- | --- |
| `role_authority` (cap 40) | documented current role types (CEO 24, BOARD_CHAIR 20, MINISTER 30, …) |
| `organisation_scale` (cap 15) | documented headcount / revenue of current employers |
| `public_resource_control` (cap 15) | current roles in public / state-owned organisations |
| `appointment_authority` (cap 12) | documented appointments the person makes |
| `ownership_control` (cap 10) | REPORTED/CALCULATED direct ownership stakes only |
| `board_centrality` (cap 12) | concurrent current board roles |
| `cross_sector_reach` (cap 10) | distinct documented sectors |

Guarantees:
- **Never** an ideology score; no race/ethnicity/religion/nationality inputs; no political
  or media sentiment; no unsupported social relationships.
- **Decomposable** — the UI renders the exact breakdown per component.
- **Coverage-gated** — with no current documented role or no sources the score is `null`
  and the UI must show **"Ei riittävästi dataa pisteytykseen."**

---

## 5. Board interlock engine (section 8)

`src/lib/institutionalPower/interlock.ts` operates on documented role assignments:
- `boardInterlocks(roles)` — group board roles per person.
- `mostConnectedBoardMembers(roles, limit)` — most current board roles.
- `crossSectorInterlocks(roles)` — current board roles across ≥ 2 sectors.
- `publicPrivateBoardOverlap(roles)` — board roles in both public and private organisations.

Historical roles count toward `historicalBoardCount` only; they never inflate a current
interlock. An interlock is a structural fact, never a collusion label.

---

## 6. Revolving-door timeline (section 9)

`src/lib/institutionalPower/revolvingDoor.ts`:
- `sphereOf(role)` — `public | corporate | ngo | media | academia | other` from documented
  role type + organisation type (explicit override allowed).
- `detectTransitions(roles)` — sorts roles chronologically and emits **"Roolisiirtymä"**
  transitions between consecutive roles **only when** the FROM role demonstrably ended
  before (or at) the TO role began. Overlapping or open-ended roles are simultaneous
  dual roles, never transitions.
- `transitionDirectionLabel(direction)` — neutral Finnish/English phrasing
  (`public_to_corporate`, `corporate_to_public`, …). Never "problematic".

---

## 7. Agent interface (shared contract)

`src/lib/agents/types.ts` defines `AgentFact` as the union of:

- `NormalizedFact` (relationship | flow) — pre-existing
- **`RoleAssignmentFact`** (`kind: "role"`) — person/org/role/roleType/dates/appointedBy
- **`OrganizationSectorFact`** (`kind: "sector"`)
- **`CriticalFunctionFact`** (`kind: "critical-function"`) — requires `publicBasis`
- **`ProcurementFact`** (`kind: "procurement"`)
- **`LobbyingFact`** (`kind: "lobbying"`)

`SourceAdapter.parse` returns `Promise<AgentFact[]>`. `pipeline.ts` dispatches new kinds to
their own publication services in `publish.ts`:

`publishRoleAssignment` · `publishOrganizationSector` · `publishCriticalFunction` ·
`publishProcurement` · `publishLobbying`

**Publication policy (every new kind):**
- Evidence URL required; LOW confidence rejected; entities resolved through
  `resolveEntity` (never merged on name alone; ambiguous → parked).
- `deterministic-parser` + official/strong source + VERIFIED/HIGH → `SOURCE_CONFIRMED`.
- Everything else → stored with `verificationStatus = AUTO_DETECTED` (never shown as a
  confirmed connection) and counted as a candidate for the review lane.
- Idempotent upsert (`dedupeKey` or natural key). Positions dedupe on
  (person, org, role, roleType, startDate).

**Entity-resolution interface:** unchanged, pre-existing `resolveEntity` (strong external
id → business id → exact name; multiple candidates → `EntityResolutionCandidate`).

**Evidence model:** `Source` + `Evidence` reused unchanged; new rows carry `sourceId`,
`evidenceGrade` (A–E, added by the foundation, convergent with the definition on
`sprint-media-yle`) and `verificationStatus`.

---

## 8. Testing (section 15)

New foundation tests (`tests/institutional-*.test.ts`):

| File | Invariants |
| --- | --- |
| `institutional-labels.test.ts` | every new enum value has a Finnish label |
| `institutional-classification.test.ts` | multiple simultaneous roles; historical never current; relationship- and employment-derived classifications |
| `institutional-ownership.test.ts` | percentage bounds; chain product rule; no inference on missing data; historical edges excluded; cycle cut; OWNS-family recognition |
| `institutional-influence.test.ts` | coverage gate; decomposition; cap 100; not-an-ideology; REPORTED/CALCULATED only |
| `institutional-interlock.test.ts` | ranking; cross-sector; public/private overlap; historical exclusion |
| `institutional-revolving-door.test.ts` | direction detection; gap days; overlap/open-ended never a transition; neutral labels; sources |
| `institutional-publish.test.ts` (DB) | source requirement; entity resolution parks; evidence grade; multiple simultaneous roles; historical role marking; dedup; sector/procurement/critical-function/lobbying publication |

Run: `npm test` · `npm run typecheck` · `npm run lint` · `npm run release:gate`.