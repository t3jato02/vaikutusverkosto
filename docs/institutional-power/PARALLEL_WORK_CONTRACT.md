# Institutional Power — Parallel Work Contract

Rules for every assistant working on the **Vaikutusverkosto institutional-power**
expansion. Read `ARCHITECTURE.md` (same directory) for the schema and interfaces.

---

## 1. Integration base SHA (branch from here)

```
INTEGRATION_BASE_SHA = 91e64934344b88f62f202bfda2ae03bac1e7e456
FOUNDATION_READY_SHA  = 91e64934344b88f62f202bfda2ae03bac1e7e456
BRANCH                = institutional-power-foundation
```

The foundation code (schema, libs, agent interface, tests) is `FOUNDATION_READY_SHA` and
the integration base for parallel streams is `INTEGRATION_BASE_SHA` — both
**`91e6493`**, the foundation commit on `institutional-power-foundation` (later commits on
the branch are documentation-only corrections; branching from `91e6493` is stable and
complete).

All parallel streams **must branch from `INTEGRATION_BASE_SHA`** (the foundation commit).
Do not branch from `sprint-*` branches. The final integrator merges streams into the
production line and runs migrations.

## 2. Branching and handoff rules

- One branch per stream: `institutional-power/<stream>` (e.g. `institutional-power/energy`).
- Every stream must produce, in its final handoff message:
  1. **branch** — name + base SHA it was created from
  2. **commit(s)** — SHAs and one-line purpose each
  3. **tests** — exact commands run + pass/fail counts
  4. **data sources** — URLs, licence, cadence, adapter id
  5. **known limitations** — what is deliberately not covered
  6. **merge notes** — conflicts anticipated, migration order, schema-ownership touches

## 3. Schema ownership — non-negotiable

- **Do not independently redesign shared Prisma models.**
- The shared schema (migration `20260912000000_institutional_power_foundation`) is owned by
  the foundation. If a stream needs a *shared* schema change (a new column on a shared
  table, a new enum, a new shared table), **document it in the handoff** and, if assigned
  schema ownership, add it as a **new additive migration** — never edit an applied
  migration and never create a conflicting migration of the same objects.
- Stream-local scratch models are discouraged; prefer `Relationship`,
  `Position`, `FinancialFlow`, `ProcurementContract`, `LobbyingEngagement` or the
  foundation models. If a stream genuinely needs its own table, it must be additive and
  namespaced (`<stream>_<name>`), and declared in the handoff.
- Every migration must remain **idempotent-friendly on drifted dev databases** (guarded
  `CREATE TYPE ... IF NOT EXISTS`), because the shared local dev database carries
  sprint-branch migrations that are ahead of `origin/main`.

## 4. Mandatory invariants (foundation tests enforce these; keep them green)

1. No public claim without a source (`sourceId` / `evidenceUrl`).
2. No entity created by guessing: ambiguous refs park in
   `EntityResolutionCandidate` / the candidate lane.
3. Historical facts never present as current (`isCurrent`, `temporalState`,
   `endDate`).
4. Percentages are `REPORTED` or `CALCULATED`, never inferred; indirect only with a
   documented chain.
5. Criticality labels only with a `publicBasis`.
6. Procurement is labelled "Hankintasuhde"; lobbying is never corruption; board
   interlocks are structural facts; role transitions are neutral "Roolisiirtymä".
7. The institutional-influence score is decomposable and returns `null` with
   "Ei riittävästi dataa pisteytykseen." when coverage is insufficient.
8. New enums ship with Finnish (and English where sensible) labels in `constants.ts`
   and are covered by `tests/institutional-labels.test.ts`.

## 5. Shared interfaces you must consume

| Interface | Location |
| --- | --- |
| Entity resolution | `src/lib/agents/entityResolution.ts` (`resolveEntity`) |
| Evidence model | `Source` + `Evidence` (via `ensureSource`) |
| Publication services | `src/lib/agents/publish.ts` (relationship/flow + the five institutional kinds) |
| Agent contract | `src/lib/agents/types.ts` (`AgentFact`, `SourceAdapter`) |
| Pipeline | `src/lib/agents/pipeline.ts` (dispatch by `kind`) |
| Labels | `src/lib/constants.ts` + `src/lib/labels.ts` |
| Temporal semantics | `src/lib/temporal.ts` |

Never bypass `publish.ts` to write public facts.

## 6. Divergence and merge notes (read before you start)

- **`sprint-media-yle` carries uncommitted media-finance work** (public media finance:
  `BenefitEvent`, `FinancialStatementItem`, yle/award/gift agents). It is NOT on
  `origin/main`. Its migration `20260911145809_public_media_finance` and its new source
  files were moved, during the foundation session, to
  `%LOCALAPPDATA%\Temp\opencode\media-finance-untracked-backup\` so the foundation branch
  stays buildable. **Restore them** (move back into the working tree) before resuming
  `sprint-media-yle`; the tracked portion is in git stash `media-finance: tracked
  modifications`.
- **`EvidenceGrade` is defined by both the foundation and `sprint-media-yle`** with the
  same A–E meaning. The foundation migration creates it guarded; treat the two as
  convergent, not conflicting.
- **`origin/main` fast-forwarded during the session** (Sprint C5 via PR #13/#17). The
  foundation was rebased onto the current `origin/main` (`40ab60b`). Do not assume older
  SHAs.
- **Local dev database** is shared and may be ahead of the branch (it has the
  media-finance, identity-framing and vaikuta migrations applied). Use
  `prisma migrate deploy` + guarded migrations, never `migrate dev` on it (it will demand
  a reset).

## 7. Definition of done for the foundation

- [x] Shared schema (migration `20260912000000_institutional_power_foundation`) applied
- [x] Labels for every new enum
- [x] classification / ownership / influence / interlock / revolvingDoor libs
- [x] Agent contract extended (`AgentFact` union) + pipeline dispatch + five publish services
- [x] `docs/institutional-power/ARCHITECTURE.md` + this contract
- [x] Foundation tests green (unit + DB)
- [x] `npm run typecheck` and `npm run lint` green
- [x] `INTEGRATION_BASE_SHA` and `FOUNDATION_READY_SHA` recorded (top of this file) — `91e6493`
- [ ] **Do NOT deploy.** The final integrator deploys the expansion.