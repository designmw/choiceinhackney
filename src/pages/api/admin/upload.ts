export const prerender = false;

import type { APIRoute } from 'astro';
import { requireUser, isAdmin } from '~/lib/cms/auth';
import { storeImage, IMAGE_TYPES, MAX_UPLOAD_BYTES, mediaUrl } from '~/lib/cms/media';
import { log } from '~/lib/cms/activity';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Upload an image to the media library.
 *
 * Only images: portal documents go through their own endpoint, because they
 * land under a different R2 prefix and behind a different access policy. One
 * shared "upload anything" endpoint would make the destination a parameter, and
 * a parameter is something an attacker can set.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await requireUser(cookies);
  if (!user) return json({ error: 'Not signed in' }, 401);
  if (!isAdmin(user)) return json({ error: 'Your account cannot upload pictures' }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid upload' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file was sent' }, 400);

  if (file.size === 0) return json({ error: 'That file is empty' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: `Images must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB` }, 413);
  }

  // The browser-supplied type is a claim, not a fact, so it is checked against
  // an allow-list and then used verbatim when serving — paired with
  // X-Content-Type-Options: nosniff on the way out so a mislabelled file can't
  // be re-interpreted as something executable.
  const contentType = (file.type || '').toLowerCase();
  if (!IMAGE_TYPES.includes(contentType)) {
    return json({ error: 'That file type is not an image we can use' }, 415);
  }

  try {
    const id = await storeImage({
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType,
      alt: String(form.get('alt') ?? '').slice(0, 300),
      user,
    });

    await log(user, 'uploaded', `Uploaded the image “${file.name}”`);

    return json({ ok: true, id, url: mediaUrl(id) });
  } catch (err) {
    console.error('[cms] image upload failed:', err);
    return json({ error: 'Could not save that image. Please try again.' }, 500);
  }
};
