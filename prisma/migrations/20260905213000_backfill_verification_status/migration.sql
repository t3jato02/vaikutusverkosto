-- Phase 4 — conservative, deterministic, re-runnable backfill of the A7
-- verification model onto existing rows. No row is deleted. No row is set to
-- HUMAN_VERIFIED: there is no per-row human-review audit trail to justify it.
--
-- Legacy -> A7 status mapping (Relationship + FinancialFlow):
--   verificationState = 'REJECTED'                          -> REJECTED
--   verificationState = 'CONFLICTED' OR confidence='DISPUTED' -> DISPUTED
--   verificationState = 'PUBLISHED' AND has >=1 Evidence     -> SOURCE_CONFIRMED
--   everything else                                          -> AUTO_DETECTED (column default; untouched)
--
-- Legacy confidence enum -> confidenceScore (only where NULL, so later manual
-- edits are never clobbered; bucket midpoints, not a recomputed score):
--   VERIFIED 0.95 | HIGH 0.80 | MEDIUM 0.60 | LOW 0.40 | DISPUTED 0.30

-- ---- Relationship: status ----
UPDATE "Relationship"
  SET "verificationStatus" = 'REJECTED'
  WHERE "verificationState" = 'REJECTED'
    AND "verificationStatus" <> 'REJECTED';

UPDATE "Relationship"
  SET "verificationStatus" = 'DISPUTED'
  WHERE ("verificationState" = 'CONFLICTED' OR "confidence" = 'DISPUTED')
    AND "verificationStatus" NOT IN ('REJECTED', 'DISPUTED');

UPDATE "Relationship" r
  SET "verificationStatus" = 'SOURCE_CONFIRMED'
  WHERE r."verificationState" = 'PUBLISHED'
    AND r."verificationStatus" = 'AUTO_DETECTED'
    AND EXISTS (SELECT 1 FROM "Evidence" e WHERE e."relationshipId" = r."id");

-- ---- Relationship: confidenceScore ----
UPDATE "Relationship" SET "confidenceScore" =
  CASE "confidence"
    WHEN 'VERIFIED' THEN 0.95
    WHEN 'HIGH'     THEN 0.80
    WHEN 'MEDIUM'   THEN 0.60
    WHEN 'LOW'      THEN 0.40
    WHEN 'DISPUTED' THEN 0.30
  END
  WHERE "confidenceScore" IS NULL;

-- ---- FinancialFlow: status ----
UPDATE "FinancialFlow"
  SET "verificationStatus" = 'REJECTED'
  WHERE "verificationState" = 'REJECTED'
    AND "verificationStatus" <> 'REJECTED';

UPDATE "FinancialFlow"
  SET "verificationStatus" = 'DISPUTED'
  WHERE ("verificationState" = 'CONFLICTED' OR "confidence" = 'DISPUTED')
    AND "verificationStatus" NOT IN ('REJECTED', 'DISPUTED');

UPDATE "FinancialFlow" f
  SET "verificationStatus" = 'SOURCE_CONFIRMED'
  WHERE f."verificationState" = 'PUBLISHED'
    AND f."verificationStatus" = 'AUTO_DETECTED'
    AND EXISTS (SELECT 1 FROM "Evidence" e WHERE e."flowId" = f."id");

-- ---- FinancialFlow: confidenceScore ----
UPDATE "FinancialFlow" SET "confidenceScore" =
  CASE "confidence"
    WHEN 'VERIFIED' THEN 0.95
    WHEN 'HIGH'     THEN 0.80
    WHEN 'MEDIUM'   THEN 0.60
    WHEN 'LOW'      THEN 0.40
    WHEN 'DISPUTED' THEN 0.30
  END
  WHERE "confidenceScore" IS NULL;
