# Finance, Capital & Board Networks — parallel stream handoff

Vaikutusverkosto expansion: the **people and organisations controlling
substantial financial resources or important financial-market infrastructure**
in Finland — banks, credit institutions, investment firms, asset managers,
insurers, pension insurers, public pension institutions, payment / stock
exchange infrastructure, and the public investment organisations (Solidium,
Finnvera, Tesi, Kuntarahoitus, Business Finland).

This is the handoff document for the `institutional-power/finance` branch.
Read `ARCHITECTURE.md` and `PARALLEL_WORK_CONTRACT.md` (same directory) first —
this stream consumes the foundation's interfaces and adds a small, additive
layer on top (see `CONTRACT_CHANGE_REQUEST_FINANCE.md`).

---

## 1. Scope

| Covered by this stream | Owned elsewhere |
| --- | --- |
| Banks & credit institutions (incl. savings/cooperative banks) | Corporate ownership & boards (Stream B) |
| Insurers (life / non-life) | Critical infrastructure (Stream A) |
| Pension insurers (Ilmarinen, Varma, Elo, Veritas) | Public institutions (Stream C-public) |
| Public pension institutions (Keva, VER, ETK) | UI / institutional explorer (Stream D) |
| Asset managers & fund managers | Media / journalism / Yle |
| Payment & exchange infrastructure (BoF, FIN-FSA, Euroclear, Nasdaq Helsinki) | Institutional-power foundation |
| Solidium, Finnvera, Tesi, Kuntarahoitus, Business Finland | |
| Board interlocks between finance and the wider graph (with role sources) | |
| GLEIF identity resolution (LEI/BIC/aliases/parent-child) — supporting evidence | |
| Year-bound institutional scale figures (AUM, balance sheet, revenue) | |

**Cross-stream rule:** if an organisation is a company, Stream B owns the
canonical Entity and ownership chains. This stream resolves companies by
Y-tunnus (`ytj`) or by a stable `fi-finance:<slug>` / `gleif-lei` external id,
reusing canonical entities. Roles are transcribed from official governance
pages; GLEIF is **supporting evidence** only (identity, aliases, BIC, recorded
parent-child consolidation) and never replaces the organisation's own
governance sources for roles or ownership.

---

## 2. Schema addition (additive migration)

`20260912020000_institutional_power_finance`:

- `FinanceInstitutionProfile` — source-bound finance classification
  (`@@unique([entityId, institutionType])`); LEI/BIC mirrored as
  `ExternalIdentifier` (`gleif-lei` / `swift-bic`).
- `InstitutionScaleStatement` — year-bound institutional scale figure
  (`@@unique([entityId, metricType, year])`, `dedupeKey` unique). Institutional
  figures stay institutional — **never** used to estimate personal wealth.

Fully additive; guarded enums; no edits to applied migrations.

---

## 3. Agents

| Agent | Adapter id | Schedule | What it ingests |
| --- | --- | --- | --- |
| **FinanceInstitutionAgent** | `finance-institutions-agent` | weekly | banks, insurers, asset managers, public investment orgs, exchange/payment infrastructure, listed issuers — profiles, sectors, roles, scale statements, FIN-FSA supervision edges, PART_OF parents, `nasdaq-issuer` markers |
| **PensionGovernanceAgent** | `pension-governance-agent` | weekly | pension insurers + public pension institutions — profiles, sectors, roles (incl. documented CIO / sijoitusjohtaja), scale statements |
| **GLEIFResolutionAgent** | `gleif-resolution-agent` | weekly | LEI/BIC/alias mapping + GLEIF-recorded parent-child (PART_OF); manifest-driven, optional `GLEIF_LIVE=1` API overlay |

**BoardInterlockAgent** is implemented as the read-side query layer
(`src/lib/institutionalPower/financeInterlocks.ts`) + public API
(`GET /api/institutional/finance/interlocks`). It runs the four documented
interlock queries; every result row carries the underlying role sources
(Position → Source). An interlock is a structural fact — never a collusion or
corruption label.

All ingestion agents are **deterministic, manifest-driven** (no LLM), bounded
(one document per section), and idempotent (verified: re-run proposes 0 new
facts). Manifest: `src/lib/agents/data/finance/` + `data/gleif/gleifIndex.ts`.

---

## 4. Sources

| Source | Cadence | Evidence policy |
| --- | --- | --- |
| FIN-FSA (register of supervised entities + FIN-FSA org) | monthly | official register → SOURCE_CONFIRMED |
| Bank/company/pension governance pages (`op.fi`, `nordea.com`, `varma.fi`, `keva.fi`, …) | monthly | official primary → SOURCE_CONFIRMED |
| Company annual reports / results pages (`tulostiedot`) | yearly | self-disclosed → stored, routed to review lane (AUTO_DETECTED) |
| Nasdaq Helsinki issuer disclosures | monthly | official register (`nasdaq-issuer` external id) |
| GLEIF (api.gleif.org / search.gleif.org) | monthly | official register → SOURCE_CONFIRMED; supporting identity evidence |
| PRH/YTJ (via Y-tunnus on manifest orgs) | — | deterministic resolution, reuses canonical entities |

All 30 LEIs in the GLEIF index were verified against the GLEIF API
(2026-09-12). Every leadership fact was read from an official page; a separate
research pass verified the largest holdings' leadership (Ilmarinen CEO Mikko
Mursula, Keva CEO Jaakko Kiander, FIN-FSA Director General Tero Kurenmaa,
Solidium CEO Matts Rosenberg, …).

---

## 5. Board interlock queries

| Query | Definition |
| --- | --- |
| `bankBoardAndListedCompanyInterlocks` | person on a current board of a bank (BANK/CREDIT_INSTITUTION/SAVINGS_BANK/COOPERATIVE_BANK) **and** a current board of a `nasdaq-issuer`-marked company |
| `pensionBoardAndStateCompanyInterlocks` | person on a current board of a pension institution (PENSION_INSURER/PUBLIC_PENSION_INSTITUTION) **and** a current board of a state(-owned) company (entityCategory STATE_OWNED_COMPANY/GOVERNMENT/GOVERNMENT_AGENCY) |
| `formerPoliticianFinanceRoles` | person with a **historical** MP/MINISTER role **and** a current finance-institution role |
| `publicOfficialSupervisoryRoles` | person with a current public post (public entity type) **and** a current board/supervisory role in a finance institution |

Only `SOURCE_CONFIRMED` / `HUMAN_VERIFIED` positions are shown. Live results
(2026-09-12, shared dev DB):

- **former politician**: Jan Vapaavuori — Minister of Housing (2007–2011) and
  Minister of Economic Affairs (2012–2015) → Chair, Finnvera board.
- **public official**: Markus Lohi — Member of Parliament → Keva board member.
- bank×listed and pension×state currently return no rows: the curated snapshot
  documents no such overlap yet (e.g. Sampo is a FINANCIAL_GROUP, not a bank;
  the current finance boards share no members with state-company boards). The
  queries are exercised by unit tests with synthetic data.

---

## 6. Known limitations

- Person roles reflect the sources at transcription time (September 2026). A
  re-ingest after a change (or a human update of the manifest) corrects
  currentness.
- GLEIF records parent-child relationships only where the legal entities
  report them; many Finnish groups (Nordea, Mandatum, Euroclear, LähiTapiola)
  have no GLEIF parent record, so those edges are deliberately absent rather
  than guessed.
- Scale figures from results pages (H1/2026, Q1/2026) are stored with the year
  they describe and routed to the review lane — they are self-disclosed, not
  independently verified.
- Companies may pre-exist under multiple identities from earlier adapters;
  this stream resolves by Y-tunnus / strong external id, but legacy duplicate
  entities are a pre-existing integration concern.
- Automatia (Otto network) and Nasdaq Helsinki country management could not be
  verified for this pass (no person roles ingested for them).
- The `valtioneuvosto` entity used for former-minister roles is a minimal
  GOVERNMENT_BODY; the public-institutions stream owns the canonical ministry
  entities.

---

## 7. Definition of done (this stream)

- [x] Meaningful finance coverage: 46 finance organisations, 48 profiles,
      165 finance positions, 11 scale statements, 15 listed-issuer markers,
      29 LEIs, 14 BICs, 25 FIN-FSA supervision edges, 2 GLEIF parent edges
- [x] Bank, insurer, pension, asset-management, public-investment and
      infrastructure segments represented
- [x] Historical/current roles correct (temporal semantics enforced)
- [x] Canonical persons reused (name resolution; no duplication of MPs etc.)
- [x] Evidence provenance works (per-fact evidence URL + evidence grade)
- [x] Review path works (annual-report scale figures → AUTO_DETECTED lane)
- [x] GLEIF adapter: LEI/BIC/alias mapping + parent-child + optional live API
- [x] Board interlock queries + API with underlying role sources
- [x] Ingestion idempotent (verified: rerun proposes 0 new facts)
- [x] Tests PASS (19 unit + 6 DB), typecheck PASS, lint PASS (0 errors)
- [x] No other agent's work modified

## 8. Numbers (ingested into the shared dev DB, 2026-09-12)

| Measure | Count |
| --- | --- |
| Finance organisations (FinanceInstitutionProfile) | 46 (48 profiles) |
| Documented finance positions | 165 |
| Institutional scale statements (year + source) | 11 |
| Nasdaq-listed issuers marked (`nasdaq-issuer`) | 15 |
| GLEIF LEIs mapped (`gleif-lei`) | 29 |
| SWIFT/BIC mapped (`swift-bic`) | 14 |
| FIN-FSA supervision edges | 25 |
| GLEIF parent-child edges (PART_OF) | 2 |
| Interlock results (live) | 2 (Vapaavuori, Lohi) |