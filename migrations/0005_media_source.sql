-- Migration number: 0005 	 remember where a library image came from
--
-- Same idea as the portal legacy ids in 0004, for the same reason: importing
-- the site's existing pictures is something you run more than once.
--
-- `source_key` records the origin — 'asset:hero/banner.jpg' for a file in
-- src/assets/images, or whatever an importer uses for an external system. A
-- picture uploaded by hand in /admin has no source key, so re-running an
-- importer can never disturb it.
--
-- Worth being clear about what importing does and does not do: it makes the
-- site's pictures available in the picker as replacements. It does not change
-- how any page currently renders — pages still reference the bundled asset
-- until somebody actually swaps one.

ALTER TABLE media ADD COLUMN source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_source ON media(source_key) WHERE source_key IS NOT NULL;
