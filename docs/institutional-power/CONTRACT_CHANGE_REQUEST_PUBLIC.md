# Contract Change Request — Public Institutions stream

**Request:** `InstitutionalCategory` + `OrganizationInstitutionalCategory`
(additive) — needed so the product can distinguish a ministry from a
municipality from a wellbeing services county from a labour-market organisation
in search and in institutional queries.

**Author stream:** C (`institutional-power-public-institutions`)

---

## 1. Exact problem

The foundation's `EntityCategory` (GOVERNMENT, GOVERNMENT_AGENCY,
STATE_OWNED_COMPANY, COMPANY, FOUNDATION, NGO, ...) and `Sector` cannot express
the institutional types the product requires:

- a ministry vs a municipality vs a wellbeing services county (all would be
  `GOVERNMENT_AGENCY` under the current name-rule classifier);
- a labour-market central organisation vs a trade union vs an employer
  organisation vs an industry association;
- a state fund (Sitra) vs a foundation;
- a working group / advisory body / commission / council.

## 2. Current model limitation

- `Entity.entityCategory` is a single, coarse value on the shared Entity row
  and is not source-bound.
- `Sector` describes *what the organisation does* (energy, transport, ...), not
  *what it institutionally is* (ministry, municipality, ...).

## 3. Proposed additive solution

- New enum `InstitutionalCategory` (28 values, see
  `public-institutions.md` §2).
- New model `OrganizationInstitutionalCategory`:
  `(entityId, category, sourceId?, evidenceGrade, validFrom, validTo, createdBy)`
  with `@@unique([entityId, category])` — one or more source-bound categories
  per organisation.
- Back-relations added on `Entity` and `Source` (additive).
- New agent fact kind `institutional-category` + publication service
  `publishInstitutionalCategory` (mirrors the foundation's five institutional
  kinds: same evidence/verification policy).
- New labels in `constants.ts` + label accessor + label-coverage test.

## 4. Migration effect

- One new guarded migration:
  `20260912010100_institutional_power_public_institutions`
  (`CREATE TYPE ... IF NOT EXISTS`, `CREATE TABLE`, indexes, FKs).
- Safe on a clean production baseline and on drifted dev databases.

## 5. Backwards compatibility

- Fully additive: no column changed, no enum value removed, no existing
  function altered. Existing `EntityCategory` and `Sector` are untouched and
  remain the primary classification; the institutional category is a
  complementary, source-bound layer.
- The new fact kind is added to the `AgentFact` union; the pipeline dispatches
  it before the existing kinds, so existing adapters are unaffected.

## 6. Impacted streams

- **B (corporate):** none for ownership; the category model is complementary.
  Company entities are still resolved by Y-tunnus to the same canonical Entity.
- **D (UI):** benefits — search results can now label institutional types.
- **Foundation:** schema-ownership note — new additive objects only, no edits to
  applied migrations.

## 7. Tests

- `tests/institutional-labels.test.ts` — every category has a Finnish/English
  label.
- `tests/institutional-public-org.test.ts` — category publication, dedupe,
  supervision edge, review-lane behaviour.
- `tests/institutional-public-entity-resolution.test.ts` — duplicate
  organisation/category prevention.
- `tests/institutional-public-queries.test.ts` — `organizationsByCategory`
  returns the documented category with source.