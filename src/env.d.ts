// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

// Fontsource packages ship CSS only (no type declarations); declare them so
// side-effect imports type-check under TypeScript 6 strict (ts2882).
declare module '@fontsource-variable/*';
declare module '@fontsource/*';

// Cloudflare Workers runtime module (vars, secrets, and bindings), used by
// on-demand routes like src/pages/api/contact.ts. Minimal declaration so the
// base template doesn't need @cloudflare/workers-types; if a client site later
// runs `wrangler types`, replace this with the generated declarations.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}

// Minimal D1 surface used by src/lib/cms/*. Declared here so the live page
// editor type-checks without adding @cloudflare/workers-types to every clone;
// a site that runs `wrangler types` gets the real declarations and can delete
// these two.
interface D1Result<T> {
  results?: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

// Minimal R2 surface used by src/lib/cms/media.ts, declared for the same
// reason as D1 above.
interface R2HttpMetadata {
  contentType?: string;
}
interface R2Object {
  key: string;
  size: number;
  httpMetadata?: R2HttpMetadata;
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: R2HttpMetadata }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

// Build-time env vars (from .env). Runtime secrets on Cloudflare are read via
// `cloudflare:workers` instead — see src/pages/api/contact.ts.
interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly BREVO_API_KEY?: string;
  readonly BREVO_SENDER_EMAIL?: string;
  readonly BREVO_SENDER_NAME?: string;
  readonly CONTACT_TO_EMAIL?: string;
  readonly CONTACT_TO_NAME?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Set once per request by src/middleware.ts, so any component can render
// editable copy without props being threaded down from the page.
declare namespace App {
  interface Locals {
    /** The signed-in editor, or null for a public visitor. */
    user: import('~/lib/cms/auth').CmsUser | null;
    /** Page slug used to key editable regions, e.g. 'about', 'services-pa'. */
    pageSlug: string;
    /** Stored copy overrides for this page, keyed by region. */
    overrides: Record<string, string>;
    /** True only when a signed-in editor asked for ?edit=1. */
    editing: boolean;
  }
}
