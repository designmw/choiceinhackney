// Who changed what.
//
// Worth having on any site where more than one person has a login: the first
// question after an unexpected change is always "who did that, and when". The
// actor's name is denormalised onto the row so the history survives the account
// being deleted — an audit trail that empties itself when someone leaves is
// not an audit trail.

import { getDb } from './env';
import { displayName, type CmsUser } from './auth';

export interface ActivityRow {
  id: number;
  actor: string;
  action: string;
  summary: string;
  at: string;
}

/**
 * Record an action. Never throws: an admin action must not fail because the
 * logging of it did.
 */
export async function log(user: CmsUser | null, action: string, summary: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      ?.prepare('INSERT INTO cms_activity (user_id, actor, action, summary) VALUES (?, ?, ?, ?)')
      .bind(user?.id ?? null, user ? displayName(user) : 'unknown', action, summary)
      .run();
  } catch (err) {
    console.error('[cms] could not write activity log:', err);
  }
}

export async function recentActivity(limit = 20): Promise<ActivityRow[]> {
  const db = await getDb();
  if (!db) return [];

  const { results } = await db
    .prepare('SELECT id, actor, action, summary, at FROM cms_activity ORDER BY at DESC, id DESC LIMIT ?')
    .bind(limit)
    .all<ActivityRow>();

  return results ?? [];
}
