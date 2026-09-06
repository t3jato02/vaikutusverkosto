# Ownership data source audit (Sprint C3, Phase 25)

Goal: identify **official, legally usable** sources for ownership edges
(`OWNS`, `SHAREHOLDER_OF`, `BENEFICIAL_OWNER_OF`) — Finnish company ownership,
foreign parent companies, state ownership, subsidiaries. **No ownership data is
invented or inferred.**

## Findings

| Source | Content | Access | Usable now? |
|---|---|---|---|
| **PRH / YTJ open data** (`avoindata.prh.fi`) | Company master data: Y-tunnus, names, form, domicile, status, business line | Open, CC BY 4.0 | **No ownership** — already integrated for identity (`prh-agent`) |
| **PRH beneficial-owner register** (*tosiasialliset edunsaajat*) | Beneficial owners of Finnish entities | **Restricted.** After CJEU C-37/20 & C-601/20 (Nov 2022) public access to EU BO registers was curtailed; PRH requires a registered account + stated legitimate interest + fee, no open bulk export | **No** — not openly/bulk available. Do **not** scrape or infer. |
| **Valtioneuvoston kanslia — state ownership steering** (`vnk.fi`, *omistajaohjaus*) | The Finnish state's direct holdings: ~60 companies, ownership %, mandate class | Public (annual government report + web listing) | **Yes, planned.** Structured enough for a deterministic adapter → `Government of Finland → OWNS → company` with `percentage`, `validFrom`, evidence = the official listing. |
| **Nasdaq Helsinki major-shareholder / flagging notifications** | Crossings of 5/10/… % thresholds in listed companies | Public per-issuer disclosures (not a single dataset) | Partial — no clean bulk source; candidate lane only, later |
| **EU Transparency Register** | Lobby orgs, their clients & funding | Public JSON/Excel export | Separate track (Phase 7–10) — not ownership |
| **OpenСorporateS / GLEIF LEI** | Cross-border corporate identity, some parent links (LEI "ultimate parent") | GLEIF Level-2 data is open (CC0); coverage is partial | Possible future enrichment for **foreign parent chains**, deterministic where an `ultimate parent LEI` is published |

## Decision

1. **State ownership first** — register `vnk-state-ownership` in the Source
   Registry (DISABLED, with plan). A future adapter emits temporal `OWNS`
   edges from the official state-holdings listing. This is the "at least one
   documented ownership source" path and it is genuinely open.
2. **Beneficial ownership** — **not integrated.** Legally restricted, no open
   bulk source. The `BENEFICIAL_OWNER_OF` relationship type and temporal
   `OWNS` model stay ready; no data until a lawful open source exists.
3. **Foreign parent chains** — model supports edge-by-edge chains
   (`A OWNS B`, `B OWNS C`, never flattened to `A OWNS C`). Candidate source:
   GLEIF Level-2 "ultimate parent" where the issuer has published an LEI.
   Deferred.

## Model readiness (already in place)

- `Relationship` with `relationshipType OWNS | SHAREHOLDER_OF | BENEFICIAL_OWNER_OF`,
  `percentage Decimal(6,2)`, `startDate`/`endDate` (validFrom/validTo),
  `temporalState`, `observedAt`, `lastConfirmedAt`, evidence.
- `EntityCategory.STATE_OWNED_COMPANY`; `Entity.countryCode` for foreign parents.
- Release gate: ownership `percentage` must be within `[0, 100]`; temporal
  invariants apply (no historical ownership shown as current; `validTo >=
  validFrom`).
- Graph renders chains step-by-step; never synthesises a direct `A → C` edge.
