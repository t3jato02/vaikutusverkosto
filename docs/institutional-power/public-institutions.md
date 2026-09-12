# Public Institutions — parallel stream C

Vaikutusverkosto expansion: **public institutions, state/municipal power and
major organisations** — the wider Finnish institutional power system around the
elected politicians already mapped by the foundation.

This is the handoff document for the `institutional-power-public-institutions`
branch. Read `ARCHITECTURE.md` and `PARALLEL_WORK_CONTRACT.md` in the same
directory first — this stream consumes the foundation's interfaces and adds a
small, additive layer on top.

---

## 1. Scope

| Covered by this stream | Owned elsewhere |
| --- | --- |
| Ministries & Prime Minister's Office | Critical infrastructure (Stream A) |
| State agencies / authorities | Corporate ownership & boards (Stream B) |
| State enterprises & state-owned companies (public/governance role) | Media / journalism / Yle |
| Municipal power (mayors, city managers, council chairs) | UI / institutional explorer (Stream D) |
| Wellbeing services counties | Institutional Power foundation redesign |
| Major NGOs, foundations, funds | |
| Labour-market organisations (central orgs, unions, employer orgs) | |
| Industry associations & chambers of commerce | |
| Government supervision relationships | |
| Public appointments (neutral) | |
| Revolving-door transitions (neutral "Roolisiirtymä") | |
| State grants / public funding relationships | |
| Procurement relationships (reuse) | |

**Cross-stream rule:** if an organisation is a company, Stream B owns the
canonical Entity and ownership chains. This stream reuses the same canonical
Entity — company entities are resolved deterministically by their **Y-tunnus**
(`ytj` provider), so Stream B's PRH entities are reused, never duplicated. This
stream owns the *public/government role* of those entities (supervising
ministry, governance appointments, institutional mandate).

---

## 2. Entity categories

The foundation has `EntityCategory` (broad) and `Sector`. For search and the
query layer we needed a structural, descriptive **institutional category**
(`InstitutionalCategory`, see §7 — additive schema change). It is a fact about
what an organisation *is*, never an influence or ideology signal.

Categories: `MINISTRY`, `PRIME_MINISTERS_OFFICE`, `AGENCY`, `AUTHORITY`,
`STATE_ENTERPRISE`, `STATE_OWNED_COMPANY`, `STATE_SPECIAL_ASSIGNMENT_COMPANY`,
`STATE_INVESTMENT_COMPANY`, `PUBLIC_FINANCING_INSTITUTION`, `STATE_FUND`,
`MUNICIPALITY`, `WELLBEING_SERVICES_COUNTY`, `MUNICIPAL_OWNED_COMPANY`,
`REGIONAL_COUNCIL`, `NGO`, `FOUNDATION`, `ASSOCIATION`, `EMPLOYER_ORGANIZATION`,
`TRADE_UNION`, `PROFESSIONAL_ORGANIZATION`,
`LABOUR_MARKET_CENTRAL_ORGANIZATION`, `INDUSTRY_ASSOCIATION`,
`CHAMBER_OF_COMMERCE`, `WORKING_GROUP`, `ADVISORY_BODY`, `COMMISSION`,
`COUNCIL`, `OTHER`.

---

## 3. Role semantics

Roles reuse the foundation `Position` model (`RoleAssignment`). A person holds
many simultaneous roles; no role is mutually exclusive. Semantics:

- `role` — free-text Finnish title as documented.
- `roleType` — machine classification (`MINISTER`, `DIRECTOR_GENERAL`, `CEO`,
  `BOARD_CHAIR`, `MUNICIPAL_POLITICIAN`, `UNION_LEADER`, `NGO_LEADER`, ...).
- `startDate` = validFrom, `endDate` = validTo.
- `appointmentMethod` — `NOMINATION | ELECTION | APPOINTMENT | OWNER_DECISION | SECONDMENT | OTHER`.
- `appointedByEntityId` — the documented appointing body (e.g. ministers are
  appointed by the President of the Republic; agency heads by their ministry).
  Never labelled "political patronage" — a government appointment is a neutral
  documented fact.

---

## 4. Sources

Evidence is per-fact (every row carries its own `evidenceUrl`):

- `valtioneuvosto.fi/ministerit`, `vnk.fi`, ministry sites
- agency official pages (`kela.fi`, `vero.fi`, `traficom.fi`, `thl.fi`, ...)
- municipal sites (`hel.fi`, `espoo.fi`, ...)
- wellbeing services county sites
- organisation governance pages (foundations, NGOs, unions, associations)
- company annual reports / governance pages
- public funding registers and government budget documents

Secondary sources (e.g. Wikipedia leadership lists) are allowed only for
discovery and route to the review lane (`AUTO_DETECTED`).

---

## 5. Ingestion system

`public-institutions-agent` (`src/lib/agents/publicInstitutions.ts`) is a
**deterministic, manifest-driven** adapter (no LLM). The curated manifest in
`src/lib/agents/data/institutions/` holds facts transcribed from official pages;
every fact carries its evidence URL. Sections:

- `government.ts` — ministries, agencies/authorities, state enterprises/companies
- `municipalities.ts` — 13 major municipalities + 21 wellbeing services counties
- `civilSociety.ts` — foundations/funds, NGOs, labour-market and industry orgs, advisory bodies

Pipeline behaviour (reuses the shared pipeline):

- `discover()` → one bounded document per section (3 documents total).
- collector change-detection: re-runs are no-ops until the manifest changes
  (idempotent; verified: rerun proposes 0 facts).
- `parse()` emits `institutional-category`, `role` and `SUPERVISES` facts.
- All facts use `extractionMethod: "deterministic-parser"` + official sources,
  so they publish as `SOURCE_CONFIRMED` through the shared publication service.
- Organisations resolve by `fi-institution:<slug>` (public bodies) or by
  Y-tunnus (companies → Stream B/PRH convergence). Persons resolve by exact
  canonical name, reusing existing politicians (e.g. "Petteri Orpo" → the
  existing Eduskunta person).

**Adding an institution/source:** add a `ManifestOrg` (and roles) to the
relevant section file with an evidence URL, then run
`npm run agent -- public-institutions-agent`. The category/roles publish
idempotently. To add a whole new source: create a new adapter following the
`SourceAdapter` contract and register it in `src/lib/agents/registry.ts`.

---

## 6. Temporal rules

- Roles with a documented past `endDate` are `isCurrent=false` (HISTORICAL)
  and never presented as current.
- Open-ended roles asserted current by the source are CURRENT.
- Unknown end dates follow the foundation's temporal semantics
  (`src/lib/temporal.ts`); no end date is invented.
- Historical facts are preserved (never deleted when a role ends).

---

## 7. Identity resolution

- Organisations: strong external identity (`fi-institution:<slug>` for public
  bodies; Y-tunnus for companies; `fi-agency:traficom` reuses the existing
  Traficom entity). Never merged on name alone.
- Persons: exact canonical-name match reuses existing persons; ambiguous
  same-name people park in `EntityResolutionCandidate` (never auto-merged).
- Ambiguous refs → review queue, never guessed.

---

## 8. Public-funding semantics

State grants / public funding reuse the shared `FinancialFlow` model (payer =
state/ministry → recipient = organisation). A grant is a **documented financial
relationship**, never an influence edge. No duplicate flows: stable
`externalRecordId` + `(payer, recipient, type, year)` dedupe.

---

## 9. Query layer

`src/lib/institutionalPower/institutionQueries.ts` provides the reusable read
side for the Product/UI stream (see "Queries for the UI stream" in the PR):

- `organizationsByCategory(category, {current})`
- `personsByInstitutionalRole({roleType, current})`
- `organizationLeadership(orgId)`, `organizationGovernance(orgId)`
- `publicAppointments(personId)`
- `governmentSupervision()`
- `municipalRoles`, `wellbeingCountyRoles`, `ngoFoundationRoles`,
  `labourMarketRoles`, `formalBodyRoles`
- `revolvingDoorTransitions(personId)` (neutral "Roolisiirtymä")
- `publicFundingRelationships(orgId)`, `procurementRelationships(orgId)`
- `evidenceDrilldown(entityId)`
- `institutionalProfile(entityId)` (batched, no N+1)

Search (`src/lib/queries.ts`) now labels institutional organisations with their
category ("Ministeriö", "Kunta", "Hyvinvointialue", ...) in results.

---

## 10. Known limitations

- Person roles reflect the sources at transcription time; the government and
  leadership facts were transcribed for the 2023–2027 government and
  2023–2025 leadership. A re-ingest after a change (or a human update of the
  manifest) corrects currentness. Historical roles with known end dates are
  already marked historical.
- Companies may pre-exist under multiple identities from earlier adapters
  (e.g. a transparency-register entity and a PRH entity). This stream resolves
  companies by Y-tunnus to the PRH/Stream-B entity; legacy duplicate entities
  are a pre-existing condition for the integration/merge task.
- Wellbeing services counties: all 21 are modelled as organisations; person
  roles are included only where the holder is documented with confidence.
- Working-group/advisory-body membership is modelled structurally
  (category + positions); broad membership ingestion is a later milestone.
- No network sources are fetched at runtime — the manifest is the data. This is
  deliberate: deterministic, idempotent, bounded, Vercel-runtime compatible.

---

## 11. Definition of done (this stream)

- [x] Meaningful state-administration coverage (ministries + agencies + enterprises)
- [x] Major agencies represented
- [x] Municipal governance supported (13 major cities)
- [x] Wellbeing services counties supported (21)
- [x] Major NGOs/foundations supported
- [x] Labour-market organisations supported
- [x] Historical/current roles correct (temporal semantics enforced)
- [x] Canonical persons reused (name resolution, no duplication)
- [x] Evidence provenance works (per-fact evidence URL + evidence grade)
- [x] Review path works (AUTO_DETECTED lane + admin review API)
- [x] Public funding integration (FinancialFlow reuse, idempotent)
- [x] Revolving-door transitions supported (neutral)
- [x] Queries ready for UI stream
- [x] Ingestion idempotent (verified rerun: 0 new facts)
- [x] Tests PASS, typecheck PASS, lint PASS, build PASS
- [x] Feature branch pushed, PR opened
- [x] No other agent's work modified

---

## 12. Numbers (ingested into the shared dev DB, 2026-09-12)

| Measure | Count |
| --- | --- |
| Organisations with an institutional category | 129 |
| Persons with documented institutional roles | 306 |
| Positions (roles) | 324 (319 current / 5 historical) |
| Government supervision edges (ministry SUPERVISES x) | 22 |
| Sources created by this stream | ~3 (one per section) |

The full cohort spans ministries (13), agencies/authorities (~21), state
enterprises and state-owned companies (~17), municipalities (13), wellbeing
services counties (21), foundations/funds (10), NGOs (12), labour-market and
industry organisations (~23) and formal advisory bodies (3).