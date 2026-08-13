export const prerender = false;

import type { APIRoute } from 'astro';
import { requireUser, isAdmin } from '~/lib/cms/auth';
import { saveOverride, revertOverride } from '~/lib/cms/page-content';
import { MAX_REGION_LENGTH, overrideKey, KEY_PATTERN, safeInternalPath } from '~/lib/cms/editable';
import { invalidateOverrides } from '~/middleware';
import { log } from '~/lib/cms/activity';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await requireUser(cookies);
  if (!user) return json({ error: 'Not signed in' }, 401);
  // Checked here as well as in the UI. A viewer never sees the editor bar, but
  // "the button isn't rendered" is not a permission check — this endpoint is a
  // plain HTTP POST anyone with a session cookie can send.
  if (!isAdmin(user)) return json({ error: 'Your account cannot change the website' }, 403);

  let body: { changes?: Record<string, string>; path?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const changes = Object.entries(body.changes ?? {});
  if (changes.length === 0) return json({ ok: true, saved: 0 });
  // A page has a few dozen regions at most; a request with hundreds is either a
  // bug or someone poking at the endpoint.
  if (changes.length > 100) return json({ error: 'Too many changes in one request' }, 400);

  const path = safeInternalPath(body.path);

  // Validate everything before writing anything: a request that is half-applied
  // and then rejected is the worst outcome for someone who just clicked Save.
  const validated: { key: string; value: string }[] = [];
  for (const [rawKey, rawValue] of changes) {
    const key = overrideKey(String(rawKey));
    if (!KEY_PATTERN.test(key)) return json({ error: `Invalid region key: ${rawKey}` }, 400);

    const value = String(rawValue ?? '');
    if (value.length > MAX_REGION_LENGTH) return json({ error: `“${key}” is too long` }, 400);

    validated.push({ key, value });
  }

  try {
    for (const { key, value } of validated) {
      // An image override is always a library URL, because the picker is the
      // only thing that can produce one. Recording the kind lets /admin/pages
      // show a thumbnail instead of a meaningless path.
      const kind = /^\/media\/[a-f0-9]{32}$/.test(value) ? 'image' : 'text';
      await saveOverride({ key, value, path, kind, user });

      // Drop the middleware's cache for this page, or the editor saves
      // successfully and then watches the public page serve the old copy for up
      // to a minute — which reads as "the save didn't work".
      invalidateOverrides(key.split(':')[0]);
    }
  } catch (err) {
    console.error('[cms] save failed:', err);
    return json({ error: 'Could not save. Please try again.' }, 500);
  }

  const pages = [...new Set(validated.map((c) => c.key.split(':')[0]))];
  await log(
    user,
    'edited',
    validated.length === 1
      ? `Changed text on ${path || '/' + pages[0]}`
      : `Changed ${validated.length} pieces of text on ${path || pages.map((p) => '/' + p).join(', ')}`
  );

  return json({ ok: true, saved: validated.length });
};

/** Drop an override so the region falls back to the copy in the .astro file. */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  const user = await requireUser(cookies);
  if (!user) return json({ error: 'Not signed in' }, 401);
  if (!isAdmin(user)) return json({ error: 'Your account cannot change the website' }, 403);

  const { key: rawKey } = (await request.json().catch(() => ({}))) as { key?: string };
  const key = overrideKey(String(rawKey ?? ''));
  if (!KEY_PATTERN.test(key)) return json({ error: 'Invalid region key' }, 400);

  await revertOverride(key, user);
  invalidateOverrides(key.split(':')[0]);
  await log(user, 'reverted', `Put “${key}” back to the original wording`);

  return json({ ok: true });
};
