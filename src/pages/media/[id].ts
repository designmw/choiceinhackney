export const prerender = false;

import type { APIRoute } from 'astro';
import { readObject, MEDIA_PREFIX } from '~/lib/cms/media';

/**
 * Serve a library image.
 *
 * Public and cacheable — these are page images, not private files. The route
 * reads only from the `media/` prefix, so it is structurally incapable of
 * serving a portal document even if an id from one were passed in. That is the
 * whole reason the two live under different prefixes rather than in one bucket
 * root with a flag on the row.
 */
export const GET: APIRoute = async ({ params }) => {
  const object = await readObject(MEDIA_PREFIX, params.id ?? '');
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Long cache: the id is content-addressed in practice (a new upload gets a
      // new id), so a URL's bytes never change. Replacing an image on a page
      // points it at a different id rather than mutating this one.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // The content type is a claim the uploader made. nosniff stops the browser
      // second-guessing it and running something as script.
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
