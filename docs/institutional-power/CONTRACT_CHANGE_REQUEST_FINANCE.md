# Contract Change Request — Finance, Capital & Board Networks stream

**Request:** `FinanceInstitutionProfile` + `InstitutionScaleStatement` + two
enums (`FinanceInstitutionType`, `ScaleMetricType`) — additive schema objects
needed to classify the finance institutions of Finland and to store their
year-bound, source-bound institutional scale figures.

**Author stream:** C — finance, capital & board networks
(`institutional-power/finance`)

---

## 1. Exact problem

The foundation's `EntityCategory` and `Sector` cannot express what a finance
institution *is* at the granularity the mission requires:

- a pension insurer (Ilmarinen) vs a public pension institution (Keva) vs a
  bank (Nordea) vs an asset manager (Evli) vs a payment/exchange infrastructure
  operator (Euroclear, Nasdaq Helsinki);
- and the year-bound institutional scale figures (assets under management,
  balance-sheet total, investment assets, revenue) that the mission explicitly
  requires to be stored **with a year and a source** — none of the shared
  models can hold "AUM 2025 = €22.6 bn" with a per-year source.

## 2. Current model limitation

- `Entity.entityCategory` is a single coarse value (COMPANY /
  GOVERNMENT_AGENCY / …) and is not a finance classification.
- `Sector` describes what the organisation does (BANKING, INSURANCE, PENSION,
  PAYMENTS, INVESTMENT) — not its institutional kind.
- `Organization.revenueEur` is a single un-dated value with no source; AUM /
  balance-sheet / investment-asset figures have no home at all.

## 3. Proposed additive solution

- New enum `FinanceInstitutionType` (27 values: BANK, CREDIT_INSTITUTION,
  SAVINGS_BANK, COOPERATIVE_BANK, INVESTMENT_FIRM, INVESTMENT_BANK,
  ASSET_MANAGER, FUND_MANAGER, LIFE_INSURANCE_COMPANY,
  NON_LIFE_INSURANCE_COMPANY, PENSION_INSURER, PUBLIC_PENSION_INSTITUTION,
  PAYMENT_INSTITUTION, E_MONEY_INSTITUTION, CENTRAL_SECURITIES_DEPOSITORY,
  STOCK_EXCHANGE, CENTRAL_COUNTERPARTY, CENTRAL_BANK,
  FINANCIAL_SUPERVISORY_AUTHORITY, INSTITUTIONAL_INVESTOR,
  SOVEREIGN_INVESTMENT_INSTITUTION, PUBLIC_FINANCING_INSTITUTION,
  DEVELOPMENT_FINANCE_INSTITUTION, EXPORT_CREDIT_AGENCY,
  STATE_INVESTMENT_COMPANY, FINANCIAL_GROUP, OTHER).
- New model `FinanceInstitutionProfile`:
  `(entityId, institutionType, finFsaRegistrationId?, lei?, bic?, officialUrl?,
  sourceId?, evidenceGrade, validFrom?, validTo?, createdBy, lastVerifiedAt)`
  with `@@unique([entityId, institutionType])`.
  LEI and BIC are mirrored as `ExternalIdentifier` rows (providers
  `gleif-lei` / `swift-bic`) so cross-stream resolution stays deterministic.
- New enum `ScaleMetricType` (ASSETS_UNDER_MANAGEMENT, BALANCE_SHEET_TOTAL,
  INVESTMENT_ASSETS, EQUITY_CAPITAL, REVENUE, PREMIUM_INCOME, PENSION_ASSETS,
  OTHER) and new model `InstitutionScaleStatement`:
  `(entityId, metricType, value, currency, year, sourceId?, evidenceGrade,
  verificationStatus, dedupeKey?, createdBy, lastVerifiedAt)` with
  `@@unique([entityId, metricType, year])`. **Institutional figures are never
  used to estimate personal wealth.**
- Back-relations added on `Entity` and `Source` (additive).
- New agent fact kinds `finance-institution`, `scale-statement` and
  `external-identifier` + publication services `publishFinanceInstitution`,
  `publishScaleStatement`, `publishExternalIdentifier` (same evidence /
  verification policy as the foundation's five institutional kinds).
- New labels in `constants.ts` + label accessors + label-coverage tests.

## 4. Migration effect

- One new guarded migration:
  `20260912020000_institutional_power_finance`
  (`CREATE TYPE ... IF NOT EXISTS`, `CREATE TABLE`, indexes, FKs).
- Safe on a clean production baseline and on drifted dev databases.

## 5. Backwards compatibility

- Fully additive: no column changed, no enum value removed, no existing
  function altered. `EntityCategory` and `Sector` remain untouched.
- The new fact kinds are added to the `AgentFact` union; the pipeline
  dispatches them before the existing kinds, so existing adapters are
  unaffected.
- `publishExternalIdentifier` parks a collision (same provider+identifier
  pointing at two entities) into `EntityResolutionCandidate` — it never
  guesses.

## 6. Impacted streams

- **Foundation:** schema-ownership note — new additive objects only, no edits
  to applied migrations.
- **B (corporate) / C-public (public institutions):** none for ownership or
  institutional categories; company entities are still resolved by Y-tunnus or
  `fi-*` external ids to the same canonical Entity.
- **D (UI):** benefits — finance institutions can be filtered and labelled by
  kind; the interlock API (`/api/institutional/finance/interlocks`) exposes
  documented board overlaps with their role sources.
- **Media finance (sprint-media-yle):** `EvidenceGrade` remains shared and
  convergent; this stream only *reads* it.

## 7. Tests

- `tests/institutional-finance-labels.test.ts` — every enum value has a
  Finnish/English label.
- `tests/institutional-finance-adapters.test.ts` — bounded discover(),
  deterministic parse(), evidence URLs on every fact, stable dedupe keys,
  GLEIF index integrity (unique 20-char LEIs, parentLei references resolve).
- `tests/institutional-finance-publish.test.ts` (DB) — source requirement,
  SOURCE_CONFIRMED profile publication with LEI/BIC/alias mapping, idempotent
  upsert, scale-statement year+source storage with annual-report review-lane
  routing, negative-value rejection, deterministic external-identifier mapping.
- `tests/institutional-finance-interlocks.test.ts` — the four documented
  board-interlock queries with role sources on every result.