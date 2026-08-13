-- Migration number: 0001 	 live page editor: users, sessions, page content
--
-- Schema for the live page editor (see docs/live-editor.md). Everything is
-- prefixed `cms_` except the two content tables, so that a site which already
-- has its own `users`/`sessions` (Changing Ireland, ISCPHM) can adopt this
-- module without a table-name collision.
--
-- Apply locally:  npm run cms:init
-- Apply remotely: npx wrangler d1 migrations apply <db-name> --remote
--
-- There is deliberately no signup UI — an editor account can only be created
-- from the command line (`npm run cms:user`) or by an existing admin in
-- /admin/users. A public site should never expose account creation.

CREATE TABLE IF NOT EXISTS cms_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  -- 'admin' can manage users; 'editor' can only change page copy.
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cms_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
  -- Unix milliseconds. Compared in SQL so an expired session is never returned
  -- even if the sweeper below has not run.
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_sessions_user ON cms_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cms_sessions_expiry ON cms_sessions(expires_at);

-- One row per overridden region. The key is '<page-slug>:<region>', e.g.
-- 'about:our-story-h2'. A region with no row here renders the copy that is in
-- the .astro file — which is why an empty database renders the site exactly as
-- it shipped, and why deleting this whole feature breaks nothing.
CREATE TABLE IF NOT EXISTS page_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  -- 'text' today. Reserved so an image or link override can be added later
  -- without a second table.
  kind TEXT NOT NULL DEFAULT 'text',
  -- The URL the region was edited on, e.g. '/music-school/faculty'.
  --
  -- Stored rather than derived, because the key only carries the flattened
  -- slug: '/music-school/faculty' and '/music-school-faculty' both flatten to
  -- 'music-school-faculty', so a link built from the key alone would sometimes
  -- 404. The editor sends its own location.pathname on save, which is exact.
  path TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Previous values, so any edit can be undone. Written before an update and only
-- when the value actually changed, so re-saving identical text doesn't bury the
-- real previous version under no-op rows.
CREATE TABLE IF NOT EXISTS page_content_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  saved_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_content_revisions_key ON page_content_revisions(key);

-- Who changed what. Small enough to be worth having on a site where several
-- volunteers share the admin, and the first question after a surprise is
-- always "who did that, and when".
CREATE TABLE IF NOT EXISTS cms_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
  actor TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cms_activity_at ON cms_activity(at);
