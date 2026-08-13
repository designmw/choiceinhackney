// Uploaded files: images for the page editor, documents for gated portals.
//
// Bytes go to R2, metadata to D1. The R2 key prefix is the security boundary:
//
//   media/<id>   public images  → served by /media/[id]
//   portal/<id>  gated documents → served by /<area>/doc/[id], behind Access
//
// Nothing derives a key from user input, so a document can never end up under
// the public prefix by being named cleverly.

import { getDb, getUploads } from './env';
import type { CmsUser } from './auth';

export const MEDIA_PREFIX = 'media/';
export const PORTAL_PREFIX = 'portal/';

/** Public URL for a library image. Matches the route at src/pages/media/[id].ts. */
export const mediaUrl = (id: string): string => `/media/${id}`;

/** Images an editor may place on a page. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

/**
 * Document types allowed in a portal.
 *
 * A deny-list would be the wrong shape here: these files are downloaded by
 * staff, so anything not on this list should be rejected rather than guessed
 * at. Note that SVG is deliberately absent — an SVG is executable markup, and
 * one served from the site's own origin can run script as the site.
 */
export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** 25 MB. Comfortably above a scanned policy PDF, below anything that suggests a mistake. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface MediaItem {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  created_at: string;
}

/**
 * A random, unguessable id.
 *
 * Not derived from the filename: two uploads called "policy.pdf" must not
 * collide, and a guessable key is a way to probe for documents on a route whose
 * only other protection is an access policy.
 */
export const newId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Strip anything that could break a Content-Disposition header or a path. */
export const safeFilename = (name: string): string =>
  (name.split(/[/\\]/).pop() ?? 'file')
    .replace(/["\r\n]/g, '')
    .replace(/[^\w.\-() ]/g, '_')
    .slice(0, 120) || 'file';

/** Pixel dimensions from the file header, so the library can show real sizes. */
export function imageSize(bytes: Uint8Array, type: string): { width: number; height: number } | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (type === 'image/png' && bytes.length > 24) {
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }

    if (type === 'image/gif' && bytes.length > 10) {
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }

    if (type === 'image/jpeg') {
      // Walk the segment chain to the start-of-frame marker, which is the only
      // place the dimensions live.
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (view.getUint8(offset) !== 0xff) break;
        const marker = view.getUint8(offset + 1);
        const length = view.getUint16(offset + 2);
        // SOF0–SOF15, excluding the four markers in that range that aren't frames.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    // Dimensions are a nicety, never a reason to reject a valid upload.
  }
  return null;
}

export interface StoreOptions {
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  alt?: string;
  user: CmsUser;
}

/** Store an image and record it in the library. Returns its id. */
export async function storeImage({ bytes, filename, contentType, alt = '', user }: StoreOptions): Promise<string> {
  const db = await getDb();
  const bucket = await getUploads();
  if (!db || !bucket) throw new Error('Storage is not configured for this environment.');

  const id = newId();
  const name = safeFilename(filename);
  const dims = imageSize(new Uint8Array(bytes), contentType);

  await bucket.put(MEDIA_PREFIX + id, bytes, { httpMetadata: { contentType } });

  await db
    .prepare(
      `INSERT INTO media (id, filename, content_type, size, width, height, alt, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, name, contentType, bytes.byteLength, dims?.width ?? null, dims?.height ?? null, alt, user.id)
    .run();

  return id;
}

/**
 * The library, or an empty list if it can't be read.
 *
 * Same reasoning as the enquiry reads: migrations are applied by hand, so a
 * site can genuinely be missing this table, and that should cost one section of
 * the admin rather than the whole dashboard.
 */
export async function listMedia(limit = 200): Promise<MediaItem[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const { results } = await db
      .prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC LIMIT ?')
      .bind(limit)
      .all<MediaItem>();
    return results ?? [];
  } catch (err) {
    console.error('[cms] could not load the picture library:', err);
    return [];
  }
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    return await db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<MediaItem>();
  } catch (err) {
    console.error('[cms] could not load an image record:', err);
    return null;
  }
}

export async function updateAlt(id: string, alt: string): Promise<void> {
  const db = await getDb();
  await db?.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(alt, id).run();
}

/**
 * Delete an image and its bytes.
 *
 * The row goes first. If the R2 delete then fails the object is orphaned, which
 * costs a little storage; the other order would leave a library entry pointing
 * at bytes that no longer exist, which shows the editor a broken image.
 */
export async function deleteMedia(id: string): Promise<void> {
  const db = await getDb();
  await db?.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  await (await getUploads())?.delete(MEDIA_PREFIX + id);
}

/** Fetch stored bytes for serving. `prefix` decides which route may do it. */
export async function readObject(prefix: string, id: string) {
  const bucket = await getUploads();
  if (!bucket) return null;
  // Ids are hex from newId(); anything else is a probe, and refusing early
  // keeps odd keys out of R2 lookups entirely.
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  return await bucket.get(prefix + id);
}
