// Editable page text, stored in D1 and rendered server-side.
//
// The design constraint that shapes everything here: the site's pages are
// hand-built .astro layouts with real design work in them, and this does NOT
// replace them with a generic block renderer. A block editor would let a client
// rearrange pages — and would equally let them destroy the layout, and would
// throw away the widget library the site is built from.
//
// So the unit of editing is a *region*, not a page. A page keeps its layout in
// code; individual pieces of copy are tagged with a key and can be overridden
// from the browser. The fallback is the text already in the .astro file, which
// means the site renders identically against an empty database and nothing
// breaks if this whole feature is abandoned.

import { getDb } from './env';
import type { CmsUser } from './auth';

export interface OverrideRow {
  key: string;
  value: string;
  kind: string;
  path: string;
  updated_at: string;
  editor: string | null;
  revisions: number;
}

/** All overrides for one page, as a key → value map. */
export async function overridesFor(pageSlug: string): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    if (!db) return {};

    const { results } = await db
      .prepare('SELECT key, value FROM page_content WHERE key LIKE ?')
      .bind(`${pageSlug}:%`)
      .all<{ key: string; value: string }>();

    return Object.fromEntries((results ?? []).map((r) => [r.key, r.value]));
  } catch (err) {
    // A missing or broken database must never take the public site down — it
    // just means every region falls back to the copy in the .astro file.
    //
    // Logged rather than swallowed: a silent {} here is indistinguishable from
    // "nothing has been edited", which makes a real query failure look like the
    // editor simply not working.
    console.error(`[cms] could not load overrides for "${pageSlug}":`, err);
    return {};
  }
}

export interface SaveOptions {
  key: string;
  value: string;
  path?: string;
  kind?: 'text' | 'image';
  user: CmsUser;
}

/**
 * Save one region, keeping the previous value as a revision.
 *
 * The revision is written before the update and only when the value actually
 * changed — a click that saves identical text shouldn't bury the real previous
 * version under a pile of no-op entries.
 */
export async function saveOverride({ key, value, path = '', kind = 'text', user }: SaveOptions): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('No D1 binding: the CMS database is not configured for this environment.');

  const existing = await db
    .prepare('SELECT value FROM page_content WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();

  if (existing && existing.value !== value) {
    await db
      .prepare('INSERT INTO page_content_revisions (key, value, saved_by) VALUES (?, ?, ?)')
      .bind(key, existing.value, user.id)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO page_content (key, value, kind, path, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         kind = excluded.kind,
         -- Keep the existing path if this save didn't carry one, so an older
         -- row never loses a good link by being re-saved from somewhere odd.
         path = CASE WHEN excluded.path = '' THEN page_content.path ELSE excluded.path END,
         updated_by = excluded.updated_by,
         updated_at = datetime('now')`
    )
    .bind(key, value, kind, path, user.id)
    .run();
}

/** Every override, newest first — for the /admin/pages management view. */
export async function allOverrides(): Promise<OverrideRow[]> {
  const db = await getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT p.key, p.value, p.kind, p.path, p.updated_at,
              NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS editor,
              (SELECT COUNT(*) FROM page_content_revisions r WHERE r.key = p.key) AS revisions
         FROM page_content p
         LEFT JOIN cms_users u ON u.id = p.updated_by
        ORDER BY p.updated_at DESC`
    )
    .all<OverrideRow>();

  return results ?? [];
}

/**
 * Drop an override so the region falls back to the copy in the .astro file.
 *
 * Deliberately a delete rather than "set it back to the original": the code has
 * no idea what the original was, and storing a copy of it at edit time would go
 * stale the moment a developer changed the template.
 */
export async function revertOverride(key: string, user: CmsUser): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('No D1 binding: the CMS database is not configured for this environment.');

  const existing = await db
    .prepare('SELECT value FROM page_content WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  if (existing) {
    await db
      .prepare('INSERT INTO page_content_revisions (key, value, saved_by) VALUES (?, ?, ?)')
      .bind(key, existing.value, user.id)
      .run();
  }

  await db.prepare('DELETE FROM page_content WHERE key = ?').bind(key).run();
}

/** Previous values for one region, newest first. */
export async function revisionsFor(key: string, limit = 10): Promise<{ value: string; saved_at: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const { results } = await db
    .prepare('SELECT value, saved_at FROM page_content_revisions WHERE key = ? ORDER BY saved_at DESC, id DESC LIMIT ?')
    .bind(key, limit)
    .all<{ value: string; saved_at: string }>();

  return results ?? [];
}

/** How many pages have edits, and how many regions in total. */
export async function overrideStats(): Promise<{ regions: number; pages: number; lastEdit: string | null }> {
  const db = await getDb();
  if (!db) return { regions: 0, pages: 0, lastEdit: null };

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS regions,
              COUNT(DISTINCT substr(key, 1, instr(key, ':') - 1)) AS pages,
              MAX(updated_at) AS lastEdit
         FROM page_content`
    )
    .first<{ regions: number; pages: number; lastEdit: string | null }>();

  return row ?? { regions: 0, pages: 0, lastEdit: null };
}
