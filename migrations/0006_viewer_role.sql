-- Migration number: 0006 	 two roles: admin and viewer
--
-- The original pair was 'admin' and 'editor', where an editor could change page
-- copy. That turned out to be the wrong split, for a reason worth recording:
-- 'editor' was also enough to manage the gated document portals, so an account
-- handed to somebody to fix a paragraph could also delete a staff policy.
--
-- The roles now say what they actually mean:
--
--   admin   changes the site: page copy, pictures, portal documents, enquiries,
--           and who has an account.
--   viewer  reads. Sees the document lists and nothing else. Cannot change a
--           word of the website.
--
-- Existing 'editor' rows become viewers — the safe direction. Anyone who
-- genuinely needs to edit gets promoted deliberately rather than by a migration
-- quietly granting more than it took away.

UPDATE cms_users SET role = 'viewer' WHERE role NOT IN ('admin', 'viewer');
