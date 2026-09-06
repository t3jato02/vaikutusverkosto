# Decision ↔ funding join — investigation & plan (Sprint C5, Phase 25–26)

## Why there is no decision/funding overlap today

| finding | detail |
|---|---|
| **No `Decision` rows** | The local DB has **0** `Decision` rows. No current adapter (parliament, procurement, prh, sidonnaisuudet, eu-fts, eu-transparency, vnk) writes to the `Decision` model. `parliament-agent` produces `Vote`/`Relationship` edges but not `Decision` records. |
| **No structural join key on `Decision`** | The `Decision` model has `institutionEntityId`, `decisionDate`, `financialValue`, `affectedSectors/Regions`, `legalBasis`, `votes` — but **no `projectId`, no procurement/contract id, no grant id**. |
| **Procurement flows are aggregates** | Procurement `FinancialFlow` rows are yearly totals per supplier ("Julkisten hankintojen kokonaisarvo toimittajalle vuosi X") with `externalRecordId = null`, `projectId = null`. There is no per-contract identity to hang a decision off. |
| **EU FTS projects have no decision reference** | `Project.sourceIdentifier` = `eu:<callId>`; EU FTS records carry a *Legal Commitment* reference but not a distinct political/administrative decision id. |

So the gap is **missing data**, not a missing model. Modelling `Decision → Project`
now would require inventing the link — which the neutrality rules forbid.

## Deterministic join keys that DO exist in Finnish public data

Ordered by strength of the deterministic key and how clearly the decision is
distinct from the money flow:

1. **HILMA — public procurement award notices** (`hankintailmoitukset.fi`).
   Each award notice has a national notice id and names the contracting
   authority, the supplier, the value, and (often) the underlying decision
   reference. Join: notice id ↔ a `FinancialFlow` (contract value); the award
   itself is a genuine `Decision` (`decisionType = "hankintapäätös"`) distinct
   from the payment. **Strongest candidate — recommended first source.**
2. **Municipal decision minutes APIs** (Helsinki OpenAhjo / `paatokset.hel.fi`,
   Espoo, Tampere, Turku, Oulu…). Decisions carry a *diaarinumero*; procurement
   and grant decisions there name a supplier/recipient and a sum. Join:
   diaarinumero ↔ decision; recipient name → entity resolution → flow.
3. **Valtionavustuspäätökset** (state grant decisions, e.g. via
   `valtionavustukset.fi` / hankeikkuna). Each decision has a decision number,
   a recipient, and an amount; some EU co-funded projects reference the national
   decision number.

## Plan (not built this sprint)

A `hilma-agent` adapter on the existing collector framework:

- **discover** — HILMA award-notice feed (OCDS/JSON where available), one
  `SourceDocument` per notice id.
- **parse** — emit a `Decision` (award), a `Relationship`
  contracting-authority `DECIDED` decision, and a `FinancialFlow`
  authority → supplier tagged with the notice id as `externalRecordId`.
- Entity resolution for the contracting authority + supplier via Y-tunnus.
- Fully evidenced; deterministic structured parse → `SOURCE_CONFIRMED`.

Then the fact path becomes available **without any synthesis**:

```
Person ──VOTED_FOR/DECIDED──▶ Decision ──(notice id)──▶ FinancialFlow ──▶ recipient
   (municipal minutes)          (HILMA award)              (contract value)
```

Every edge is independently sourced. The UI presents it as
**"Päätös- ja rahoitusyhteys"** (a documented decision and a documented flow that
share a notice id) — never as *"rahoittaja vaikutti henkilöön"* and never
`Funder → Person`.

## Status for the sprint report

- Join source: **none ingested yet** (`Decision` table empty).
- Real join key available: **yes** — HILMA notice id / municipal diaarinumero.
- First real link implemented: **no** — a HILMA adapter is a separate ingestion
  workstream; documented here as the next step.
- Blocked items: `/analytics` decision scope stays structurally correct but
  empty; no decision-overlap fact path is shown (correct — there is no data).
