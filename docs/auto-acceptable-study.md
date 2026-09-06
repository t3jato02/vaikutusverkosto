# AUTO_ACCEPTABLE precision study (Sprint C5, Phase 8)

**Question:** can a very-high-confidence subset of `RelationshipCandidate` rows be
auto-confirmed (published without human review) at effectively 100 % precision,
with a safe failure mode?

## Safety criteria for an auto-acceptable candidate

A candidate may only be considered for auto-publish if **all** hold:

1. `extractionMethod = "deterministic-parser"` — a structured-field parse, not a
   `rule` / `llm` / `manual` extraction.
2. Both endpoints deterministically resolved (`resolvedSourceEntityId` and
   `resolvedTargetEntityId` set — a strong external identifier or an unambiguous
   single canonical-name match, never a fuzzy guess).
3. Exact `relationshipType` from an allow-list of unambiguous semantics
   (registry membership, direct ownership, board chair from an official list).
4. Exact `role` string from the source (no inference).
5. No ambiguity flag on the evidence; single official structured record.

## Population measured

Local dev DB, 2026-09-06 — `scripts/*` inventory:

| dimension | value |
|---|---|
| total candidates | 85 |
| status | 85 `PENDING`, 0 `AUTO_ACCEPTABLE` |
| `extractionMethod` | **85 `rule`, 0 `deterministic-parser`** |
| by type | 36 `REPRESENTS_INTERESTS_OF` (EU transparency register clients), 49 `CHAIRS` (Eduskunta sidonnaisuudet) |
| strict subset (criterion 1 + 2) | **0** |
| strict subset with confidence ≥ 0.9 | **0** |

Production candidate counts are not yet available (the production ingestion cron
has not run — see the C4.5 report). This study will be re-run against the
production population before any auto-publish is considered.

## Result

| metric | value |
|---|---|
| qualifying sample size | **0** |
| true positives | – |
| false positives | – |
| precision | **N/A (empty sample)** |
| **AUTO_ACCEPTABLE enabled** | **NO** |

## Decision & rationale

**Keep the review queue. Do not enable auto-publish.**

By design, deterministic parses of official structured sources
(transparency-register *registrations*, VNK *ownership*) are published directly
as `SOURCE_CONFIRMED` and never enter the candidate lane. Everything that *does*
reach the candidate lane is a `rule` or `llm` extraction — free-text MP
declarations of interest, inferred lobbying-client relationships — which is
exactly the class that needs a human. There is currently no subset that clears
the safety bar, so there is nothing to auto-accept.

The premium 3-pane review panel (`CandidateReviewPanel`, Phase 6-7) with
keyboard-driven approve/reject and per-group deterministic batching is the
throughput mechanism instead.

Re-evaluate only if a future adapter emits `deterministic-parser` candidates
(e.g. a structured source that is authoritative but not fully unambiguous on
entity identity), and only after a labelled precision study on a real sample.
