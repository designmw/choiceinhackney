// Access to the Cloudflare bindings the CMS needs.
//
// The binding cannot be imported at module scope. Two reasons, both of which
// have bitten this template before:
//
//   1. `cloudflare:workers` does not exist under Node, and this template
//      prerenders in Node (`prerenderEnvironment: 'node'` in astro.config.ts).
//      A static import crashes the build the moment any prerendered page pulls
//      in a module that touches the CMS.
//
//   2. Reading `env` once at module scope snapshots it. That is the exact bug
//      recorded in the base-theme notes for the contact API — build-time .env
//      values won, and `wrangler secret put` / dashboard vars were silently
//      ignored in production. Resolve per call instead.
//
// The variable specifier keeps Vite from trying to resolve the Workers-only
// module during the Node build (same trick as src/pages/api/contact.ts).

interface CmsEnv {
  DB?: D1Database;
  UPLOADS?: R2Bucket;
}

async function workerEnv(): Promise<CmsEnv | undefined> {
  const spec = 'cloudflare:workers';
  const mod = await import(/* @vite-ignore */ spec).catch(() => ({}) as Record<string, unknown>);
  return (mod as { env?: CmsEnv }).env;
}

/**
 * The D1 database, or undefined when it isn't bound.
 *
 * Undefined is a normal, supported state — a site that hasn't enabled the CMS
 * has no `DB` binding, and every caller here treats that as "no overrides",
 * which renders the copy in the .astro files. The editor being unavailable must
 * never be able to take the public site down.
 */
export async function getDb(): Promise<D1Database | undefined> {
  return (await workerEnv())?.DB;
}

/**
 * The R2 bucket holding uploaded images and portal documents.
 *
 * The bucket must stay PRIVATE (no public r2.dev URL, no custom domain in front
 * of it). Everything is served through a Worker route that decides who may have
 * it — which is the only thing keeping portal documents behind Cloudflare
 * Access. Making the bucket public would expose every gated document to anyone
 * who can guess a key, with no error anywhere to notice.
 */
export async function getUploads(): Promise<R2Bucket | undefined> {
  return (await workerEnv())?.UPLOADS;
}

/** Whether the CMS is wired up at all — used to show a helpful message in /admin. */
export async function cmsAvailable(): Promise<boolean> {
  return Boolean(await getDb());
}

/** Whether uploads are possible — the media library and portals need this. */
export async function storageAvailable(): Promise<boolean> {
  return Boolean(await getUploads());
}
