# Architecture — Vaikutusverkosto

## 1. System overview

Vaikutusverkosto is a **public evidence graph** of Finnish institutional influence.
The architecture is deliberately production-simple:

- **PostgreSQL** is the authoritative source of truth (relational, not Neo4j).
- **Next.js (App Router) server components** render public pages; Cytoscape.js renders the
  graph client-side.
- **Script-based agents** ingest from legitimate public sources; every run is observable
  (`agent_runs`).
- **Evidence is mandatory** for any published relationship.

```
                    ┌─────────────────────────────────────────────┐
   Public sources   │  Ingestion agents (scripts/ingest/*)        │
   (Eduskunta API,  │  → validate → normalize → resolve → insert   │
    registers, ...) │  → evidence + change_log + agent_run         │
                    └───────────────────┬─────────────────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │   PostgreSQL (Prisma schema)   │
                        │   entities / relationships /   │
                        │   financial_flows / decisions /│
                        │   sources / evidence / agents /│
                        │   change_log / corrections     │
                        └───────────────┬───────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   Next.js server components       Public REST API                Admin/investigator UI
   (profiles, search, explore,    (/api/search, /api/entities,    (/admin* — observability)
    money, changes, map, ...)     /api/entities/:id/graph, ...)
        │
   Client: SearchBox (autocomplete), GraphView (Cytoscape, zoom/pan/
   filters/time slider/fullscreen), badges (FACT/JOHDETTU/...)
```

## 2. Database schema (core tables)

All keys are UUIDs (`@db.Uuid`). Enums are stored as Postgres enums.

| Table | Purpose |
| --- | --- |
| `Entity` | Universal node + `Person`, `Organization` extensions |
| `EntityAlias`, `ExternalIdentifier` | Name variants; provider/id (eduskunta-heteka, …) |
| `Relationship` | Directed, typed, dated edges with role, amount, confidence, evidence |
| `FinancialFlow` | Money flows: payer → recipient, amount, currency, purpose, source |
| `Position` | Person roles in organizations (current/former, dated) |
| `Decision`, `Vote` | Decisions and votes |
| `Event` | Timeline events |
| `Source`, `Evidence` | Source-first model; evidence links facts to sources |
| `AgentRun`, `AgentFinding` | Agent observability (scanned/proposed/accepted/rejected/errors) |
| `VerificationQueue` | Pending human/stronger verification |
| `ChangeLog` | Public change feed (RELATIONSHIP_ADDED, NEW_APPOINTMENT, …) |
| `Correction`, `RightOfReply` | Corrections workflow and right of reply |
| `MethodologyVersion` | Versioned methodology documents |

## 3. Implemented entity types

`PERSON`, `ORGANIZATION` (incl. `parliament_committee`), `COMPANY`, `POLITICAL_PARTY`,
`GOVERNMENT_BODY`, plus schema support for `ASSOCIATION`, `FOUNDATION`, `UNION`,
`MEDIA_ORGANIZATION`, `EDUCATIONAL_INSTITUTION`, `COURT`, `PUBLIC_AUTHORITY`,
`PENSION_INSTITUTION`, `PROJECT`, `CAMPAIGN`, `ASSET`, `CONTRACT`, `DECISION`, `EVENT`,
`OTHER`.

## 4. Relationship model

`source_entity_id → target_entity_id` with `relationship_type`, `role`, `start_date`,
`end_date`, `amount`, `currency`, `percentage`, `confidence`, `verification_state`,
`evidence` (1..n), `change_log`.

## 5. Money flow engine

Financial flows are first-class. Aggregation is by type / recipient / payer / year and is
methodologically explicit; different flow categories are never summed without an open
methodology (see `/methodology#money`).

## 6. Verification pipeline

`DISCOVERED → EXTRACTED → NORMALIZED → ENTITY MATCHED → SOURCE VALIDATED →
RELATIONSHIP PROPOSED → CONFIDENCE CALCULATED → RISK CHECK → PUBLISH`

Sensitive claims require stronger validation or human review (VerificationQueue). The public
UI defaults to VERIFIED/HIGH.

## 7. Metrics and tiers

Separate, transparent metrics (never a single opaque "power score"):
institutional power, network centrality (degree), board reach, appointment reach,
financial network (confidence-weighted), data confidence. Descriptive tiers 1–5 are
algorithmic and explainable. Each metric returns `{ value, methodologyVersion, inputs,
interpretation }`.

## 8. Security & privacy posture

- API rate limiting (per-IP fixed window).
- No inferred private addresses; only public roles/districts/municipalities.
- No unsupported criminal/corruption allegations; neutrality across the political spectrum.
- Prompt-injection surface: scraped HTML / API text is treated as untrusted *content*,
  never as instructions.
- Placeholders for production: RLS + admin roles, CSRF for authenticated mutations,
  secret isolation, dependency scanning are documented as Phase D in the final report.

## 9. Phases

- **A (now):** MPs, parties, government, parliament committees (real Eduskunta data),
  money-flow model, decisions model, full core UI, search, graph, changes, compare,
  investigate, map, methodology, sources, admin observability.
- **B (next):** municipalities, wellbeing-services counties, universities, courts,
  foundations, media, procurement, EU funds, more agents.
- **C:** broader local officials, municipal companies, regional institutions, historical data.


## 10. Public media finance (Yleisradio Oy & generic public media)

### Models (migration 20260911145809_public_media_finance)
- **FinancialStatementItem** — year-by-year audited income/expenditure line items for an
  organisation (entity, fiscalYear, kind INCOME|EXPENDITURE, category, amount, valueType,
  isTotal, reportUrl). isTotal marks the audited grand total; the summation helper
  (src/lib/financial.ts sumStatementItems) never double-counts parent and child
  categories (section 43). Statement line items are category totals — entity-level money
  movements stay in FinancialFlow (e.g. state appropriation → Yle).
- **BenefitEvent** — first-class gifts / awards / honours / portraits / hospitality. Parties
  (recipient, giver, payer, beneficiary, subject, artist) are optional entity refs; value
  precision (EXACT/REPORTED/CALCULATED/ESTIMATED/UNKNOWN) is mandatory so an estimate is
  never shown as an exact price. Review status gates public visibility; auto-publish only
  for exact official-register records (see publish.ts publishBenefitEvent).

### Agents (registered in src/lib/agents/registry.ts)
- yle-agent — deterministic manifest ingestion of Yle's official finances, leadership and
  governance; src/lib/agents/data/yle.ts holds the source-backed manifest. Weekly cadence.
- ward-agent — documented Suuri journalistipalkinto winners; every award lands in the
  review queue (secondary source), winner/selection/jury kept as separate facts.
- gift-benefit-agent — ingestion channel for documented gift/benefit events; the manifest
  is empty until a credible public source exists (section 30).

### Yle profile
The /media/[slug] profile gains data-driven sections: Rahoitus, Rahankäyttö, Johto,
Hallinto (incl. hallintoneuvosto members maintained by the parliament agent), Palkinnot,
Lahjat & edut and Aikajana. Person/journalist profiles gain Palkinnot and Lahjat & edut.
Admin review for benefits lives at /admin/benefits (audited via ReviewAction).

### Data quality
scripts/reconcile-yle-entities.ts merges duplicate Yle entities into the canonical
MEDIA_ORGANIZATION row (re-pointing FKs, merging aliases/external ids, ChangeLog
IDENTITY_MERGED audit, no data loss). Run 
pm run reconcile:yle.
