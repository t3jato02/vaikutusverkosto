-- Sprint C: classify existing financial flows (deterministic, re-runnable).
-- funderCountryCode from the payer entity's countryCode / country / jurisdiction.
UPDATE "FinancialFlow" f SET "funderCountryCode" = sub.cc
FROM (
  SELECT e.id,
         CASE
           WHEN e."countryCode" ~ '^[A-Z]{2}$' THEN e."countryCode"
           WHEN upper(coalesce(e.country, e.jurisdiction, '')) LIKE 'FI%' THEN 'FI'
           WHEN upper(coalesce(e.country, '')) IN ('SUOMI','FINLAND') THEN 'FI'
           ELSE NULL
         END AS cc
  FROM "Entity" e
) sub
WHERE f."payerEntityId" = sub.id AND f."funderCountryCode" IS NULL AND sub.cc IS NOT NULL;

UPDATE "FinancialFlow" f SET "recipientCountryCode" = sub.cc
FROM (
  SELECT e.id,
         CASE
           WHEN e."countryCode" ~ '^[A-Z]{2}$' THEN e."countryCode"
           WHEN upper(coalesce(e.country, e.jurisdiction, '')) LIKE 'FI%' THEN 'FI'
           ELSE NULL
         END AS cc
  FROM "Entity" e
) sub
WHERE f."recipientEntityId" = sub.id AND f."recipientCountryCode" IS NULL AND sub.cc IS NOT NULL;

-- isForeign: funder country known and not Finland.
UPDATE "FinancialFlow"
  SET "isForeign" = ("funderCountryCode" IS NOT NULL AND "funderCountryCode" <> 'FI');

-- fundingType from the legacy flowType (only where NULL).
UPDATE "FinancialFlow" SET "fundingType" =
  CASE "flowType"
    WHEN 'POLITICAL_DONATION' THEN 'DONATION'
    WHEN 'CAMPAIGN_FUNDING' THEN 'DONATION'
    WHEN 'PUBLIC_GRANT' THEN 'GRANT'
    WHEN 'GOVERNMENT_SUBSIDY' THEN 'GRANT'
    WHEN 'MUNICIPAL_GRANT' THEN 'GRANT'
    WHEN 'EU_FUNDING' THEN 'GRANT'
    WHEN 'RESEARCH_FUNDING' THEN 'GRANT'
    WHEN 'FOUNDATION_GRANT' THEN 'GRANT'
    WHEN 'ASSOCIATION_FUNDING' THEN 'GRANT'
    WHEN 'PUBLIC_PROJECT_FUNDING' THEN 'GRANT'
    WHEN 'PROCUREMENT' THEN 'PROCUREMENT'
    WHEN 'CONSULTING_PAYMENT' THEN 'PROCUREMENT'
    WHEN 'INVESTMENT' THEN 'INVESTMENT'
    WHEN 'OWNERSHIP' THEN 'INVESTMENT'
    WHEN 'SPONSORSHIP' THEN 'SPONSORSHIP'
    WHEN 'BOARD_REMUNERATION' THEN 'OTHER'
    WHEN 'SALARY' THEN 'OTHER'
    WHEN 'EXECUTIVE_COMPENSATION' THEN 'OTHER'
    ELSE 'OTHER'
  END::"FundingType"
  WHERE "fundingType" IS NULL;
