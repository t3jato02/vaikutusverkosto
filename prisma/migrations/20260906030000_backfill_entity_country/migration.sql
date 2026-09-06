-- Sprint C2: backfill countryCode for known EU and Finnish entities (idempotent).
-- EU first, so an EU-registry entity is never mislabelled FI by the fallback.
UPDATE "Entity" e SET "countryCode" = 'EU', "country" = 'EU'
  WHERE e."countryCode" IS DISTINCT FROM 'EU'
    AND EXISTS (SELECT 1 FROM "ExternalIdentifier" x WHERE x."entityId" = e.id AND x.provider = 'eu-fts');

UPDATE "Entity" e SET "countryCode" = 'FI'
  WHERE e."countryCode" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "ExternalIdentifier" x WHERE x."entityId" = e.id AND x.provider = 'eu-fts')
    AND (
      EXISTS (SELECT 1 FROM "ExternalIdentifier" x WHERE x."entityId" = e.id AND x.provider IN ('ytj','prh','eduskunta-heteka','eduskunta','eduskunta-institution'))
      OR upper(coalesce(e.country, e.jurisdiction, '')) LIKE 'FI%'
      OR upper(coalesce(e.country, '')) IN ('SUOMI','FINLAND')
    );
