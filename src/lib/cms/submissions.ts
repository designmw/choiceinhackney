// Contact form enquiries, stored on the site.
//
// See migrations/0002_contact_submissions.sql for why these are kept at all —
// short version: so an email failure stops being an invisible lost enquiry.

import { getDb } from './env';

export interface Submission {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  page: string;
  status: 'new' | 'handled';
  delivered: number;
  created_at: string;
}

export interface NewSubmission {
  name: string;
  email: string;
  phone?: string;
  message: string;
  page?: string;
}

/**
 * Record an enquiry, returning its id (or null if it couldn't be stored).
 *
 * Never throws. The contact form's job is to deliver the message; if this
 * table is missing or D1 is having a bad day, the enquiry must still be
 * emailed rather than the visitor being shown an error. The console line is
 * what makes that failure visible instead of silent.
 */
export async function recordSubmission(input: NewSubmission): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const result = (await db
      .prepare(
        `INSERT INTO contact_submissions (name, email, phone, message, page)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id`
      )
      .bind(input.name, input.email, input.phone ?? '', input.message, input.page ?? '')
      .first<{ id: number }>()) as { id: number } | null;

    return result?.id ?? null;
  } catch (err) {
    console.error('[cms] could not store contact submission:', err);
    return null;
  }
}

/** Flag whether the notification email actually went out. Never throws. */
export async function markDelivered(id: number | null, delivered: boolean): Promise<void> {
  if (id === null) return;
  try {
    const db = await getDb();
    await db
      ?.prepare('UPDATE contact_submissions SET delivered = ? WHERE id = ?')
      .bind(delivered ? 1 : 0, id)
      .run();
  } catch (err) {
    console.error('[cms] could not update delivery status:', err);
  }
}

export interface ListOptions {
  status?: 'new' | 'handled' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Reads degrade instead of throwing.
 *
 * Migrations are applied by hand, so "0001 applied, 0002 not yet" is a real
 * state a site can be in — and in it, an uncaught D1 error here takes down the
 * entire dashboard with a stack trace rather than showing an admin who is
 * simply missing one section. The console line keeps the cause visible.
 */
function degrade<T>(what: string, fallback: T) {
  return (err: unknown): T => {
    console.error(`[cms] could not load ${what}:`, err);
    return fallback;
  };
}

export async function listSubmissions(options: ListOptions = {}): Promise<Submission[]> {
  return querySubmissions(options).catch(degrade('enquiries', [] as Submission[]));
}

async function querySubmissions({ status = 'all', search = '', limit = 50, offset = 0 }: ListOptions = {}): Promise<
  Submission[]
> {
  const db = await getDb();
  if (!db) return [];

  const where: string[] = [];
  const params: unknown[] = [];

  if (status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }

  if (search.trim()) {
    // Wildcards in the search term are escaped, so looking for "100%" finds
    // that text rather than matching every row.
    const term = `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(String.raw`(name LIKE ? ESCAPE '\' OR email LIKE ? ESCAPE '\' OR message LIKE ? ESCAPE '\')`);
    params.push(term, term, term);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { results } = await db
    .prepare(`SELECT * FROM contact_submissions ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all<Submission>();

  return results ?? [];
}

export async function submissionCounts(): Promise<{ total: number; unread: number; undelivered: number }> {
  return countSubmissions().catch(degrade('enquiry counts', { total: 0, unread: 0, undelivered: 0 }));
}

async function countSubmissions(): Promise<{ total: number; unread: number; undelivered: number }> {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, undelivered: 0 };

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS unread,
              SUM(CASE WHEN delivered = 0 THEN 1 ELSE 0 END) AS undelivered
         FROM contact_submissions`
    )
    .first<{ total: number; unread: number | null; undelivered: number | null }>();

  return {
    total: row?.total ?? 0,
    unread: row?.unread ?? 0,
    undelivered: row?.undelivered ?? 0,
  };
}

export async function setStatus(id: number, status: 'new' | 'handled'): Promise<void> {
  const db = await getDb();
  await db?.prepare('UPDATE contact_submissions SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteSubmission(id: number): Promise<void> {
  const db = await getDb();
  await db?.prepare('DELETE FROM contact_submissions WHERE id = ?').bind(id).run();
}

/**
 * CSV of the current view.
 *
 * Cells are prefixed with an apostrophe when they start with =, +, - or @.
 * Excel and Sheets treat those as formulas, so a stranger typing
 * `=HYPERLINK(...)` into the message box gets it executed on the machine of
 * whoever opens the export. The form is a place members of the public type
 * arbitrary text, which is exactly the threat model for this.
 */
export function toCsv(rows: Submission[]): string {
  const headers = ['Received', 'Name', 'Email', 'Phone', 'Message', 'Page', 'Status', 'Emailed'];

  const cell = (value: unknown): string => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = rows.map((r) =>
    [
      r.created_at,
      r.name,
      r.email,
      r.phone,
      r.message,
      r.page,
      r.status === 'handled' ? 'Dealt with' : 'New',
      r.delivered ? 'Yes' : 'No',
    ]
      .map(cell)
      .join(',')
  );

  // BOM so Excel opens UTF-8 correctly — without it, Irish names with fadas
  // (Sinéad, Ó Súilleabháin) arrive mangled.
  return '﻿' + [headers.map(cell).join(','), ...lines].join('\r\n');
}
