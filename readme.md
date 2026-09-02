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
API_RATE_LIMIT_PER_MINUTE=120
AUTH_SECRET="<random, e.g. openssl rand -base64 32>"
ADMIN_PASSWORD="<admin login password>"
CRON_SECRET="<bearer token for /api/cron/ingest>"
PUBLIC_BASE_URL="https://your-production-domain.fi"
```

Production fails fast at startup if `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD` or
`CRON_SECRET` is missing (see `src/lib/env.ts`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + DB invariants) |
| `npm run e2e` | Playwright release gate (needs `npm run build` + `npm start`) |
| `npm run ingest:parliament` | Parliament Agent — MPs, parties, committees (real Eduskunta data) |
| `npm run ingest:seed` | Clearly-marked demo flows (fictional entities) |
| `npm run db:up` / `db:down` | Start / stop Docker DB |
| `npm run db:studio` | Prisma Studio |

## Routes

`/` · `/search` · `/person/[slug]` · `/organization/[slug]` · `/company/[slug]` ·
`/institution/[slug]` · `/explore` · `/money` · `/decisions` · `/map` · `/changes` ·
`/compare` · `/investigate` · `/methodology` · `/sources` · `/about` · `/corrections` ·
`/admin` (+ `/admin/agents`, `/admin/review`) · `/api` (docs) · public API under `/api/*`

## Data model (summary)

- **Entity** — universal node (Person, Organization, Company, PoliticalParty, …) with
  aliases, external identifiers, jurisdiction, confidence, verification metadata.
- **Relationship** — directed, dated, typed edge with role, amount, confidence and
  **evidence**.
- **FinancialFlow** — first-class money flows (payer → recipient → amount → purpose → source).
- **Decision / Vote** — decision-impact graph.
- **Source / Evidence** — source-first; every published relationship has ≥ 1 evidence record.
- **Position, Event** — roles and timeline events.
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
