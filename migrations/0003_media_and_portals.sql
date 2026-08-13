-- Migration number: 0003 	 media library + gated document portals
--
-- Two features, one migration, because they share a store: both keep their
-- bytes in R2 and their metadata here.
--
-- The split matters for security. R2 objects are private unless a bucket is
-- deliberately made public, so nothing here is reachable without a Worker route
-- that decides who may have it. Public images and portal documents therefore
-- live under different key prefixes and are served by different routes:
--
--   media/…    → /media/<id>       public, cacheable
--   portal/…   → /<area>/doc/<id>  behind Cloudflare Access, never cached
--
-- Keeping them in separate prefixes is what makes "could a portal document ever
-- be served by the public route?" answerable by looking at one line of code,
-- rather than by a runtime guard that has to be kept correct forever.

CREATE TABLE IF NOT EXISTS media (
  -- Also the R2 object key suffix, so a row and its bytes can never disagree.
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  -- Editors write this; it becomes the alt text wherever the image is used.
  alt TEXT NOT NULL DEFAULT '',
  uploaded_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at);

-- ── Gated document portals ──────────────────────────────────────────────────
--
-- `area` is the route prefix ('staff', 'trustee'). It is not decoration: the
-- Cloudflare Access policy is bound to that path, so a document's area decides
-- which Access policy protects it. Changing an area without changing the Access
-- policy moves documents out from behind their gate.

CREATE TABLE IF NOT EXISTS portal_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT NOT NULL,
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portal_sections_area ON portal_sections(area, position);

CREATE TABLE IF NOT EXISTS portal_documents (
  id TEXT PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES portal_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Exactly one of these is used. `filename` set means the bytes are in R2 under
  -- portal/<id>; `link` set means it's an external URL an editor typed (a
  -- Jotform, a Microsoft form) and no file was uploaded.
  filename TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  link TEXT NOT NULL DEFAULT '',
  -- Pinned above the accordion on the portal page.
  featured INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portal_documents_section ON portal_documents(section_id, position);
