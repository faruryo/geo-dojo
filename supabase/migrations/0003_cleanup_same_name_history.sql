-- Clean up historical quiz results for same-name municipalities in text modes (A, B, C)
DELETE FROM municipality_quiz_results
USING municipality_master
WHERE municipality_quiz_results.municipality_code = municipality_master.code
  AND municipality_quiz_results.mode IN ('A', 'B', 'C')
  AND (REGEXP_REPLACE(municipality_master.name, '[市区町村]$', '') = REGEXP_REPLACE(municipality_master.prefecture, '[都道府県]$', ''));
--> statement-breakpoint

-- Clean up SRS records for same-name municipalities in text modes (A, B, C)
DELETE FROM srs_records
USING municipality_master
WHERE srs_records.municipality_code = municipality_master.code
  AND srs_records.mode IN ('A', 'B', 'C')
  AND (REGEXP_REPLACE(municipality_master.name, '[市区町村]$', '') = REGEXP_REPLACE(municipality_master.prefecture, '[都道府県]$', ''));
