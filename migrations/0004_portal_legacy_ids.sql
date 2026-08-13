-- Migration number: 0004 	 remember where imported portal content came from
--
-- Sites that had a portal before this dashboard existed need their documents
-- imported from wherever they used to live. An import of any size will not be
-- got right first time — it gets run, checked, corrected and run again.
--
-- These columns are what make re-running safe. Each row records the Directus id
-- it came from, so a second run updates the row it already created instead of
-- producing a second copy of all 126 documents. Rows created by hand in /admin
-- have no legacy id and are never touched by the importer.
--
-- The unique indexes are the actual guarantee; the columns alone would only be
-- a convention the script had to remember to honour.

ALTER TABLE portal_sections ADD COLUMN legacy_id INTEGER;
ALTER TABLE portal_documents ADD COLUMN legacy_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_sections_legacy ON portal_sections(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_documents_legacy ON portal_documents(legacy_id) WHERE legacy_id IS NOT NULL;
