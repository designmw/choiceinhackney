// Request middleware: resolve the editor session and load page overrides once,
// into Astro.locals.
//
// This is what makes every page editable without touching every page. A widget
// deep in the tree can render editable copy by reading Astro.locals — it needs
// no props threaded down from the page, and a page needs no awareness that its
// widgets are editable.
//
// IMPORTANT — this only does anything useful on pages rendered on demand.
// With `output: 'static'` (this template's default) middleware runs at BUILD
// time, so saved copy would only appear after a redeploy, which defeats the
// point. Turning the editor on therefore means turning on on-demand rendering:
// see the LIVE_EDITOR switch at the top of astro.config.ts and docs/live-editor.md.
//
// Cost control matters because this runs on every public request:
//
//   - The session lookup only happens when a session cookie is present, so an
//     anonymous visitor never triggers it.
//   - Overrides are cached in memory per slug, so a public visitor to a page
//     nobody has edited costs one cheap D1 read per isolate per minute.

import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, getSessionToken, canEdit, type CmsUser } from '~/lib/cms/auth';
import { overridesFor } from '~/lib/cms/page-content';
import { pageSlug, isEditing } from '~/lib/cms/editable';
import { applyAutoEditable } from '~/lib/cms/auto-editable';
import { checkCsrf, needsCsrfCheck } from '~/lib/cms/csrf';

/**
 * Per-slug override cache.
 *
 * Page copy changes a few times a year; re-querying on every request to serve
 * the same handful of rows is waste.
 *
 * On Workers this cache lives inside one isolate, so invalidateOverrides()
 * clears the isolate that handled the save and no other. That is a deliberate
 * trade rather than an oversight: the editor themselves always bypasses the
 * cache (see below), so they never see their own change go missing, and every
 * other isolate is at most CACHE_MS behind. Making it exact would mean a KV
 * round-trip on every request to save a D1 round-trip on some of them.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; data: Record<string, string> }>();

export function invalidateOverrides(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}

async function loadOverrides(slug: string): Promise<Record<string, string>> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const data = await overridesFor(slug);
  cache.set(slug, { at: Date.now(), data });
  return data;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals } = context;

  // A prerendered page is rendered once at build time, so there is no visitor,
  // no session, and no way for a later edit to reach it — reading overrides
  // here would bake one build's copy into the HTML forever.
  //
  // Skipping is also what keeps a site with LIVE_EDITOR off completely
  // untouched: without this, reading the session cookie during prerendering
  // makes Astro warn about `Astro.request.headers` on every static page.
  if (context.isPrerendered) {
    locals.user = null;
    locals.pageSlug = pageSlug(url.pathname);
    locals.overrides = {};
    locals.editing = false;
    return next();
  }

  // Admin and API routes handle their own auth, and page overrides are
  // meaningless there — but the admin's state-changing requests are exactly
  // what CSRF targets, so they get checked on the way in.
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) {
    if (needsCsrfCheck(url.pathname)) {
      const csrf = checkCsrf(context.request);
      if (!csrf.ok) {
        console.warn(`[cms] CSRF rejected ${context.request.method} ${url.pathname}: ${csrf.reason}`);
        return new Response('Request blocked: it did not come from this site.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
    return next();
  }

  const slug = pageSlug(url.pathname);
  locals.pageSlug = slug;

  // Only look up a session when a cookie is actually present — the common case
  // is an anonymous visitor, and they should never trigger a query.
  let user: CmsUser | null = null;
  if (getSessionToken(cookies)) {
    user = await getSessionUser(getSessionToken(cookies)!).catch(() => null);
  }

  locals.user = user;
  locals.editing = isEditing(url, canEdit(user));

  // An editor with ?edit=1 must always see current data, never the cache.
  locals.overrides = locals.editing ? await overridesFor(slug) : await loadOverrides(slug);

  const response = await next();

  // Only rewrite HTML documents. Redirects, JSON and assets pass straight
  // through — reading the body of a 303 would be both pointless and wasteful.
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return response;

  const html = applyAutoEditable(await response.text(), {
    slug,
    overrides: locals.overrides,
    editing: locals.editing,
  });

  // Content-Length would be wrong after rewriting, and a stale one truncates
  // the page in the browser. Drop it and let the runtime set it.
  const headers = new Headers(response.headers);
  headers.delete('content-length');

  // A page carrying edits must not be served from a shared cache as if it were
  // the published copy, and an editing session must never be cached at all.
  if (locals.editing) headers.set('cache-control', 'private, no-store');

  return new Response(html, { status: response.status, statusText: response.statusText, headers });
});
