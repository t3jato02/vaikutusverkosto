# Vaikutusverkosto — Finland Influence Intelligence

Public evidence graph of Finnish influence, power, money flows, institutional relationships,
decision-making and public accountability.

> **Kuka vallitsee — minkä kautta — ja millä todisteilla?**
>
> Who has power, through what position or relationship, over what institution, issue, money,
> decision, or other person — and what public evidence supports that relationship?

The platform is **source-first** and **not an accusation engine**. The graph is never the
verdict; the sources are the evidence.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS** — Nordic, minimal, high-information UI
- **PostgreSQL 16** (Docker) — authoritative source of truth
- **Prisma ORM** — schema, migrations, typed client
- **Cytoscape.js** — interactive network visualization

## Quick start

```bash
npm install
docker compose up -d db        # PostgreSQL on localhost:5434
npm run db:migrate              # apply migrations (prisma migrate dev)
npm run db:generate

# Ingest real, source-backed data from Eduskunta's official open-data API
npm run ingest:parliament

# (Optional) clearly-marked demo data for the money-flow feature
npm run ingest:seed

npm run dev                     # http://localhost:3000
```

Production build + start:

```bash
npm run build
npm start
```

## Environment

Copy `.env.example` to `.env` and adjust:

```env
DATABASE_URL="postgresql://vaikutus:vaikutus@localhost:5434/vaikutusverkosto?schema=public"
DIRECT_URL=""                                        # session-mode/direct URL for migrations
API_RATE_LIMIT_PER_MINUTE=120
AUTH_SECRET="<random, e.g. openssl rand -base64 32>"
ADMIN_PASSWORD="<admin login password>"
CRON_SECRET="<bearer token for /api/cron/ingest>"
PUBLIC_BASE_URL="https://your-production-domain.fi"
```

Production fails fast at startup if `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`,
`CRON_SECRET` or `PUBLIC_BASE_URL` is missing (see `src/lib/env.ts`). All public
canonical / OpenGraph / sitemap / robots URLs resolve through a single
`PUBLIC_BASE_URL` source (`src/lib/site.ts`) — no placeholder domain in production.

## Rate limiting

All routes call one abstraction — `rateLimit(req, purpose)` in
`src/lib/rateLimit.ts` — with a purpose bucket: `public_read` (search, entities,
money, changes, graph), `corrections`, `auth`, `expensive` (agent runs).

- **Backend**: Upstash Redis sliding-window when `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN` are set (shared across all serverless instances);
  otherwise an in-memory per-instance fallback (dev/test, and controlled
  degradation).
- **Backend-failure policy**: `public_read` fails **open** (an outage must not
  take the site down); `corrections` / `auth` / `expensive` fail **closed**.
- **Provision for production (one step)**: Vercel dashboard → *Storage* →
  *Upstash Redis* → *Create*. Vercel injects both env vars automatically; redeploy.
  Until then production runs the in-memory fallback (logged as a warning at boot).

## Source Registry (Sprint B)

`IngestionSource` is the central registry of ingestion sources — one row per
adapter (`src/lib/agents/*`), seeded/refreshed from code by
`src/lib/agents/sourceRegistry.ts`. Distinct from `Source` (a per-document
evidence record). It carries operational state: `enabled`, `reliabilityTier`,
`format`, `updateCadence`, `termsUrl`, `notes`, `lastCheckedAt`,
`lastSuccessAt`, `lastError`, `consecutiveFailures`.

- `npm run registry:sync` — seed/refresh from adapters (idempotent; preserves
  `enabled` + health).
- The cron orchestrator syncs the registry before each run; `runAgent` records
  success/failure health and honours a `disabled` source (returns `SKIPPED`).
- Admin: **/admin/agents → LÄHDEREKISTERI** lists sources, health, and an
  enable/disable toggle.

## Content-Security-Policy

`script-src` in production is `'self' 'unsafe-inline'` — `'unsafe-eval'` is
dev-only (Fast Refresh/HMR) and is **not** sent in production.

**Known follow-up (Sprint A.3):** drop `'unsafe-inline'` for scripts by moving
to nonce-based CSP. That needs a `middleware.ts` that stamps a per-response
nonce and threads it through the document — a rendering-architecture change, not
a config tweak. Not gating further work: no user-supplied HTML is rendered and
all output is React-escaped, so there is no current injection sink.

## Release gate

```bash
npm run release:gate                 # lint, typecheck, tests, build, migrations status,
                                     # critical env, + data invariants (evidence /
                                     # verification status / confidence range) → GO / NO-GO
node scripts/release-gate.mjs --full # + Playwright e2e — start the server under test with
                                     # RATE_LIMIT_DISABLED=1 (avoids the shared per-IP window
                                     # being poisoned across viewport projects; burst test self-skips)
node scripts/release-gate.mjs --smoke https://vaikutusverkosto.vercel.app \
     --expect-sha $(git rev-parse HEAD)          # + production URL/API smoke + SHA match
# SMOKE_EXPECT_UPSTASH=1 also asserts /api/version reports rateLimitBackend=upstash
```

`GET /api/version` reports `{ sha, builtAt, env, rateLimitBackend }` (no secrets).
Bake the SHA on CLI deploys: `vercel deploy --prod --build-env BUILD_SHA=$(git rev-parse HEAD)`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + DB invariants) |
| `npm run e2e` | Playwright release gate (needs `npm run build` + `npm start`) |
| `npm run ingest:parliament` | Parliament Agent — MPs, parties, committees (real Eduskunta data) |
| `npm run ingest:yle` | Yle Agent — Yleisradio Oy rahoitus, johto, hallinto (real yle.fi data) |
| `npm run ingest:awards` | Award Agent — dokumentoidut Suuren journalistipalkinnon voittajat |
| `npm run ingest:gifts` | Gift & Benefit Agent — lahja-/etutapahtumien kanava (lähdeperustainen manifesti) |
| `npm run reconcile:yle` | Yle-duplikaattien yhdistäminen (data-laatu, auditoitu) |
| `npm run ingest:seed` | Clearly-marked demo flows (fictional entities) |
| `npm run ingest:media` | Media & journalism pilot (real RSS/author data) |
| `npm run ingest:identity` | Identity-framing QA pilot (documented public bio facts + classifier) |
| `npm run db:up` / `db:down` | Start / stop Docker DB |
| `npm run db:studio` | Prisma Studio |

## Routes

`/` · `/search` · `/person/[slug]` · `/organization/[slug]` · `/company/[slug]` ·
`/institution/[slug]` · `/media` · `/media/[slug]` · `/media/identity-framing` · `/toimittajat` · `/toimittajat/[slug]` · `/explore` ·
`/money` · `/decisions` · `/map` · `/changes` · `/compare` · `/investigate` · `/methodology` ·
`/sources` · `/about` · `/corrections` · `/admin` (+ `/admin/agents`, `/admin/review`, `/admin/benefits`) ·
`/api` (docs) · public API under `/api/*`

## Data model (summary)

- **Entity** — universal node (Person, Organization, Company, PoliticalParty, …) with
  aliases, external identifiers, jurisdiction, confidence, verification metadata.
- **Relationship** — directed, dated, typed edge with role, amount, confidence and
  **evidence**.
- **FinancialFlow** — first-class money flows (payer → recipient → amount → purpose → source).
- **Decision / Vote** — decision-impact graph.
- **Source / Evidence** — source-first; every published relationship has ≥ 1 evidence record.
- **Position, Event** — roles and timeline events.
- **Media & journalism** — `MediaOutlet` (editorial affiliation only from documented sources, never
  transferred to journalists), `Article`/`ArticleAuthor`/`ArticleMention` (metadata-first publication
  corpus), `ContentAnalysis` (versioned, recomputable coverage), `PoliticalAffiliation` (strict
  A/B/C model, human-review-gated), `PersonalFact` (never-inferred biographic fields with source +
  evidence grade).
- **Public media finance** — `FinancialStatementItem` (year-by-year audited income/expenditure line
  items; grand totals flagged so categories and totals are never double-counted),
  `BenefitEvent` (first-class gifts / awards / honours / portraits / hospitality with exact-vs-reported
  value precision and an admin review queue at `/admin/benefits`). Yleisradio Oy is the first fully
  populated public-media profile: funding 2020–2025, expenditure breakdown, CEOs, board, management
  group, administrative council and documented awards, all source-backed (`yle.fi` annual reports,
  board/management pages, Suuri journalistipalkinto winners list).
- **Identity framing (Syntymämaa & media-identiteetti)** — a fact layer that keeps separate:
  `BirthOriginFact` (muuttumaton syntymämaa/-paikka), `CitizenshipFact` (juridinen status, useita sallittu),
  `ResidenceFact` (asuinmaa/-historia), `SelfIdentificationFact` (henkilön oma julkinen identiteetti,
  sanatarkka), `MediaIdentityMention` (median käyttämä ilmaus sanatarkasti + konteksti + versioidut
  luokittelumetatiedot), plus `IdentityFramingAnalysis` / `IdentityFramingAggregate` / `IdentityComparison`
  (versioidut, uudelleenlaskettavat analyysit ja käänteistapausvertailu). Public UI shows only
  `PUBLISHED` facts; uncertainty goes to the admin review queue. Järjestelmä ei päättele syntymämaata,
  syntyperää, etnisyyttä, uskontoa tai kansalaisuutta nimestä, kielestä tai ulkonäöstä — puuttuva tieto on
  “Ei vahvistettua tietoa”.
- **AgentRun / AgentFinding / VerificationQueue / ChangeLog / Correction / RightOfReply /
  MethodologyVersion** — operations, verification, change feed, corrections, methodology.

## Principles

- No relationship without entities.
- No public relationship without evidence.
- No amount without currency.
- No inferred private addresses / no private-location inference.
- No silent entity merge; no destructive historical overwrite.
- No unsupported causal wording; no automated guilt-by-association.
- Facts, derived metrics, inferences, allegations and disputed claims are visually separated.

See `/methodology` (in-app) and `docs/architecture.md` for details.

## Testing

`npm test` runs unit tests (formatting, metrics, label coverage) plus live database
invariant checks:

- every published relationship has evidence
- every financial flow has amount + currency
- no duplicate canonical names (excluding demo)
- every position references an existing person

## Status

Phase A (production foundation) is implemented with real Eduskunta data. Phases B/C
(municipalities, wellbeing-services counties, universities, courts, foundations, media,
procurement) are modeled and documented — see `docs/architecture.md` and the final report.
