-- Repair UTF-8 -> Latin-1 mojibake in text columns.
--
-- Root cause (fixed in code, commit "Premium UI/UX"): src/lib/agents/http.ts
-- decoded the Eduskunta API (UTF-8) as ISO-8859-1, storing e.g. "Työelämä-
-- ja tasa-arvovaliokunta" as "TyÃ¶elÃ¤mÃ¤- ja tasa-arvovaliokunta". This
-- migration deterministically reverses that transform on rows already written.
--
-- Safety: repair is applied run-by-run. A maximal run of characters that are
-- all representable as a single Latin-1 byte (<= U+00FF) is converted
-- LATIN1 -> UTF8 only when (a) it carries a mojibake lead byte (Ã / Â / â),
-- (b) the conversion does not raise, and (c) the result no longer carries a
-- mojibake lead byte. Characters > U+00FF (e.g. "—" U+2014) are preserved
-- verbatim and separate runs, so a value that mixes a correct em dash with a
-- mojibake name is still repaired. Anything that fails the checks is left
-- exactly as-is. Re-runnable: after success the WHERE clauses match nothing.

CREATE OR REPLACE FUNCTION pg_temp.demojibake(t text) RETURNS text AS $fn$
DECLARE
  ch     text;
  run    text := '';
  out    text := '';
  fixed  text;
BEGIN
  IF t IS NULL OR t !~ '[ÂÃâ]' THEN
    RETURN t;
  END IF;

  FOR ch IN SELECT regexp_split_to_table(t, '') LOOP
    IF ascii(ch) > 255 THEN
      -- flush the accumulated Latin-1 run, then emit the wide char verbatim
      IF run <> '' THEN
        out := out || pg_temp.demojibake_run(run);
        run := '';
      END IF;
      out := out || ch;
    ELSE
      run := run || ch;
    END IF;
  END LOOP;

  IF run <> '' THEN
    out := out || pg_temp.demojibake_run(run);
  END IF;

  -- Never hand back a value that is still mojibake'd.
  IF out ~ '[ÂÃâ]' THEN
    RETURN t;
  END IF;
  RETURN out;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.demojibake_run(run text) RETURNS text AS $fn$
DECLARE
  fixed text;
BEGIN
  IF run !~ '[ÂÃâ]' THEN
    RETURN run;
  END IF;
  BEGIN
    fixed := convert_from(convert_to(run, 'LATIN1'), 'UTF8');
  EXCEPTION WHEN others THEN
    RETURN run;
  END;
  IF fixed IS NULL OR fixed = run OR fixed ~ '[ÂÃâ]' THEN
    -- try one more inverse pass for double-encoded data
    BEGIN
      fixed := convert_from(convert_to(fixed, 'LATIN1'), 'UTF8');
    EXCEPTION WHEN others THEN
      RETURN run;
    END;
    IF fixed IS NULL OR fixed ~ '[ÂÃâ]' THEN
      RETURN run;
    END IF;
  END IF;
  RETURN fixed;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
  targets text[][] := ARRAY[
    ['Entity','canonicalName'], ['Entity','description'], ['Entity','municipality'],
    ['Entity','region'], ['Entity','country'], ['Entity','jurisdiction'], ['Entity','subtype'],
    ['Person','profession'], ['Person','education'], ['Person','firstName'],
    ['Person','lastName'], ['Person','electoralDistrict'],
    ['Organization','legalForm'], ['Organization','headquarters'],
    ['EntityAlias','name'],
    ['Relationship','role'], ['Relationship','description'], ['Relationship','endedReason'],
    ['RelationshipCandidate','role'], ['RelationshipCandidate','rawText'],
    ['RelationshipCandidate','evidenceTitle'], ['RelationshipCandidate','rejectionReason'],
    ['FinancialFlow','purpose'], ['FinancialFlow','description'], ['FinancialFlow','rawFundingType'],
    ['Project','name'], ['Project','description'], ['Project','programme'],
    ['Project','municipality'], ['Project','locationRegion'],
    ['Source','sourceName'], ['Source','publisher'], ['Source','documentTitle'],
    ['SourceDocument','title'], ['SourceDocument','rawText'],
    ['Evidence','quotedFragment'], ['Evidence','documentTitle'],
    ['Decision','title'], ['Decision','description'], ['Decision','decisionType'], ['Decision','legalBasis'],
    ['Position','role'],
    ['ChangeLog','description'],
    ['Event','description'],
    ['Correction','description']
  ];
  t text[];
  n integer;
  total integer := 0;
  col_exists boolean;
BEGIN
  FOREACH t SLICE 1 IN ARRAY targets LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t[1] AND column_name = t[2]
    ) INTO col_exists;
    IF NOT col_exists THEN
      RAISE NOTICE 'skip %.% (no such column)', t[1], t[2];
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE %I SET %I = pg_temp.demojibake(%I) '
      || 'WHERE %I ~ ''[ÂÃâ]'' AND pg_temp.demojibake(%I) IS DISTINCT FROM %I',
      t[1], t[2], t[2], t[2], t[2], t[2]
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    IF n > 0 THEN
      RAISE NOTICE 'repaired %.%: % row(s)', t[1], t[2], n;
    END IF;
  END LOOP;
  RAISE NOTICE 'mojibake repair complete: % row(s) updated', total;
END $$;
