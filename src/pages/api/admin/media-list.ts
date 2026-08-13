export const prerender = false;

import type { APIRoute } from 'astro';
import { requireUser, isAdmin } from '~/lib/cms/auth';
import { listMedia, mediaUrl } from '~/lib/cms/media';

/**
 * The picture library, for the picker inside the live page editor.
 *
 * Behind the editor session even though the images themselves are public: the
 * list is a map of everything uploaded, including pictures not yet used
 * anywhere, and that isn't something to hand to anonymous callers.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const user = await requireUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  if (!isAdmin(user)) return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403 });

  const items = (await listMedia(200)).map((item) => ({
    id: item.id,
    url: mediaUrl(item.id),
    filename: item.filename,
    alt: item.alt,
  }));

  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
