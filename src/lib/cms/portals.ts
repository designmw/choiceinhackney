// Gated document portals: sections, documents, and the files behind them.
//
// SECURITY BOUNDARY — read this before changing anything here.
//
// Nothing in this file authenticates anybody. These documents are protected by
// Cloudflare Access, which is bound to a URL path (/staff, /trustee). The only
// reason a staff policy document isn't public is that the route serving it
// lives underneath that path.
//
// Two consequences:
//
//   1. A document's `area` decides which Access policy protects it. Moving a
//      section to a different area moves its documents behind a different gate,
//      and inventing an area with no matching Access policy publishes them.
//   2. The serving route must stay at /<area>/doc/<id>. Moving it out from
//      under the prefix — even to something that looks tidier, like
//      /api/portal-doc — removes the gate with no error anywhere.
//
// Files live in R2 under the `portal/` prefix, which the public /media route
// cannot read. That separation is structural rather than a runtime check, so
// "can a portal document leak through the public route?" is answered by the
// prefix constant rather than by a guard that has to stay correct.

import { getDb, getUploads } from './env';
import { newId, safeFilename, PORTAL_PREFIX, DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from './media';
import type { CmsUser } from './auth';

export { PORTAL_PREFIX, DOCUMENT_TYPES, MAX_UPLOAD_BYTES };

export interface PortalDocument {
  id: string;
  section_id: number;
  title: string;
  filename: string;
  content_type: string;
  size: number;
  link: string;
  featured: number;
  position: number;
}

export interface PortalSection {
  id: number;
  area: string;
  title: string;
  intro: string;
  position: number;
  /**
   * Where this section was imported from, if it was (migration 0004).
   *
   * A site migrating off an older CMS renders both stores for a while, and this
   * is what stops an already-imported section appearing twice — once from each.
   * Null for anything created by hand in /admin.
   */
  legacy_id: number | null;
  documents: PortalDocument[];
}

/**
 * Sections and documents for one area, in display order.
 *
 * Returns null — not [] — when the query fails. An empty list and a broken
 * database must stay distinguishable: callers that decide access on the result
 * must never read "the lookup failed" as "there are no documents here".
 */
export async function getPortal(area: string): Promise<PortalSection[] | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const { results: sections } = await db
      .prepare(
        'SELECT id, area, title, intro, position, legacy_id FROM portal_sections WHERE area = ? ORDER BY position, id'
      )
      .bind(area)
      .all<Omit<PortalSection, 'documents'>>();

    if (!sections || sections.length === 0) return [];

    const { results: docs } = await db
      .prepare(
        `SELECT d.id, d.section_id, d.title, d.filename, d.content_type, d.size, d.link, d.featured, d.position
           FROM portal_documents d
           JOIN portal_sections s ON s.id = d.section_id
          WHERE s.area = ?
          ORDER BY d.position, d.id`
      )
      .bind(area)
      .all<PortalDocument>();

    return sections.map((section) => ({
      ...section,
      documents: (docs ?? []).filter((d) => d.section_id === section.id),
    }));
  } catch (err) {
    console.error(`[cms] could not load the "${area}" portal:`, err);
    return null;
  }
}

/**
 * Fetch one document's bytes, but only if it belongs to `area`.
 *
 * The area check is the point. Without it, the /staff route would happily serve
 * a trustee document to anyone who holds a staff Access token and can guess an
 * id — the two portals have different audiences, and an id is not a secret.
 */
export async function getPortalFile(
  area: string,
  id: string
): Promise<{ body: ReadableStream; filename: string; type: string } | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;

  const db = await getDb();
  const bucket = await getUploads();
  if (!db || !bucket) return null;

  const row = await db
    .prepare(
      `SELECT d.filename, d.content_type
         FROM portal_documents d
         JOIN portal_sections s ON s.id = d.section_id
        WHERE d.id = ? AND s.area = ?`
    )
    .bind(id, area)
    .first<{ filename: string; content_type: string }>();

  if (!row) return null;

  const object = await bucket.get(PORTAL_PREFIX + id);
  if (!object) return null;

  return {
    body: object.body,
    filename: row.filename || 'document',
    type: row.content_type || 'application/octet-stream',
  };
}

// ── Sections ────────────────────────────────────────────────────────────────

export async function createSection(area: string, title: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const last = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS p FROM portal_sections WHERE area = ?')
    .bind(area)
    .first<{ p: number }>();
  await db
    .prepare('INSERT INTO portal_sections (area, title, position) VALUES (?, ?, ?)')
    .bind(area, title, (last?.p ?? 0) + 1)
    .run();
}

export async function updateSection(id: number, title: string, intro: string): Promise<void> {
  const db = await getDb();
  await db?.prepare('UPDATE portal_sections SET title = ?, intro = ? WHERE id = ?').bind(title, intro, id).run();
}

/**
 * Delete a section and everything in it, R2 objects included.
 *
 * The rows would go anyway (ON DELETE CASCADE), but the files would not — and
 * an orphaned portal document sitting in a bucket nobody lists any more is
 * exactly the sort of thing that turns up in a data-retention audit.
 */
export async function deleteSection(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { results } = await db
    .prepare("SELECT id FROM portal_documents WHERE section_id = ? AND filename != ''")
    .bind(id)
    .all<{ id: string }>();

  const bucket = await getUploads();
  for (const doc of results ?? []) await bucket?.delete(PORTAL_PREFIX + doc.id).catch(() => {});

  await db.prepare('DELETE FROM portal_sections WHERE id = ?').bind(id).run();
}

/** Move a section up or down within its area. */
export async function moveSection(id: number, direction: 'up' | 'down'): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const current = await db
    .prepare('SELECT id, area, position FROM portal_sections WHERE id = ?')
    .bind(id)
    .first<{ id: number; area: string; position: number }>();
  if (!current) return;

  const neighbour = await db
    .prepare(
      direction === 'up'
        ? 'SELECT id, position FROM portal_sections WHERE area = ? AND position < ? ORDER BY position DESC LIMIT 1'
        : 'SELECT id, position FROM portal_sections WHERE area = ? AND position > ? ORDER BY position ASC LIMIT 1'
    )
    .bind(current.area, current.position)
    .first<{ id: number; position: number }>();

  if (!neighbour) return;

  await db.batch([
    db.prepare('UPDATE portal_sections SET position = ? WHERE id = ?').bind(neighbour.position, current.id),
    db.prepare('UPDATE portal_sections SET position = ? WHERE id = ?').bind(current.position, neighbour.id),
  ]);
}

// ── Documents ───────────────────────────────────────────────────────────────

export interface AddDocumentOptions {
  sectionId: number;
  title: string;
  link?: string;
  file?: { bytes: ArrayBuffer; filename: string; contentType: string };
  user: CmsUser;
}

export async function addDocument({ sectionId, title, link = '', file, user }: AddDocumentOptions): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('The site database is not configured.');

  const id = newId();
  const last = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS p FROM portal_documents WHERE section_id = ?')
    .bind(sectionId)
    .first<{ p: number }>();

  let filename = '';
  let contentType = '';
  let size = 0;

  if (file) {
    const bucket = await getUploads();
    if (!bucket) throw new Error('File storage is not configured.');

    // Written to R2 before the row exists. If this throws there is an orphaned
    // object and no row, which costs storage; the other order would list a
    // document that 404s when a staff member clicks it.
    await bucket.put(PORTAL_PREFIX + id, file.bytes, { httpMetadata: { contentType: file.contentType } });

    filename = safeFilename(file.filename);
    contentType = file.contentType;
    size = file.bytes.byteLength;
  }

  await db
    .prepare(
      `INSERT INTO portal_documents (id, section_id, title, filename, content_type, size, link, position, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, sectionId, title, filename, contentType, size, link, (last?.p ?? 0) + 1, user.id)
    .run();
}

export async function updateDocument(id: string, title: string, featured: boolean): Promise<void> {
  const db = await getDb();
  await db
    ?.prepare('UPDATE portal_documents SET title = ?, featured = ? WHERE id = ?')
    .bind(title, featured ? 1 : 0, id)
    .run();
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db?.prepare('DELETE FROM portal_documents WHERE id = ?').bind(id).run();
  await (await getUploads())?.delete(PORTAL_PREFIX + id).catch(() => {});
}

export async function moveDocument(id: string, direction: 'up' | 'down'): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const current = await db
    .prepare('SELECT id, section_id, position FROM portal_documents WHERE id = ?')
    .bind(id)
    .first<{ id: string; section_id: number; position: number }>();
  if (!current) return;

  const neighbour = await db
    .prepare(
      direction === 'up'
        ? 'SELECT id, position FROM portal_documents WHERE section_id = ? AND position < ? ORDER BY position DESC LIMIT 1'
        : 'SELECT id, position FROM portal_documents WHERE section_id = ? AND position > ? ORDER BY position ASC LIMIT 1'
    )
    .bind(current.section_id, current.position)
    .first<{ id: string; position: number }>();

  if (!neighbour) return;

  await db.batch([
    db.prepare('UPDATE portal_documents SET position = ? WHERE id = ?').bind(neighbour.position, current.id),
    db.prepare('UPDATE portal_documents SET position = ? WHERE id = ?').bind(current.position, neighbour.id),
  ]);
}

/** URL a portal page should link to for a document. */
export const documentHref = (area: string, doc: PortalDocument): string =>
  doc.link || (doc.filename ? `/${area}/doc/${doc.id}` : '#');
