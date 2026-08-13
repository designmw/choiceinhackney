export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionToken, destroySession, clearSessionCookie } from '~/lib/cms/auth';

/**
 * POST rather than GET, so a prefetcher, a link scanner or an <img> on another
 * site can't sign an editor out by being loaded.
 */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = getSessionToken(cookies);

  // Delete the row as well as the cookie: clearing the cookie alone leaves a
  // valid session id in the database that would still work if it were captured.
  if (token) await destroySession(token).catch(() => {});
  clearSessionCookie(cookies);

  return redirect('/admin/login', 303);
};
