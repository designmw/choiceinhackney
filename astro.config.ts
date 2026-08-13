import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import { unified } from '@astrojs/markdown-remark';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

/**
 * The live page editor (docs/live-editor.md) — off by default.
 *
 * This is one switch rather than a per-page decision because it isn't really
 * optional: the editor stores copy in D1 and reads it in src/middleware.ts, and
 * middleware only runs per request for pages rendered on demand. Leave the site
 * on `output: 'static'` and every page is rendered at BUILD time, so a client's
 * edit would appear only after the next deploy — which is the exact behaviour
 * the editor exists to remove.
 *
 * Turning it on means every page becomes a Worker invocation instead of a
 * static asset. For the size of site this template builds that is a good trade
 * (Cloudflare's free tier is 100k requests/day, and `public/_headers` still
 * lets the CDN cache the HTML), but it is a real trade — leave this false on
 * sites where nobody will ever edit copy.
 *
 * Turning it on also requires a D1 binding in wrangler.jsonc and `npm run
 * cms:init`. Without them the site still renders — every region falls back to
 * the copy in the .astro files — but /admin will tell you it isn't configured.
 */
const LIVE_EDITOR = false;

export default defineConfig({
  // Deployment target: Cloudflare (Workers static assets — the successor to
  // Cloudflare Pages, with the same push-to-deploy git workflow via Workers
  // Builds in the dashboard).
  //
  // `output: 'static'` prerenders every page to plain HTML served from
  // Cloudflare's CDN — the right default for the marketing/SME sites this
  // template produces. Routes that opt out with `export const prerender =
  // false` (e.g. `src/pages/api/contact.ts`) run on-demand in a Cloudflare
  // Worker at the edge.
  //
  // The build emits static assets to `dist/client/`, the Worker to
  // `dist/server/`, and a ready-to-deploy config at
  // `dist/server/wrangler.json` — merged from ./wrangler.jsonc, where the
  // per-site Worker `name` is set. Deploy with
  // `npx wrangler deploy -c dist/server/wrangler.json`, or connect the repo
  // in the Cloudflare dashboard with build command `npm run build`.
  //
  // Security/cache headers live in `public/_headers`. Runtime secrets (Brevo
  // keys etc.) are read from the Worker env via `cloudflare:workers` — set
  // them with `wrangler secret put` or in the dashboard.
  // 'server' when the live page editor is on: pages render on demand so a saved
  // edit is live immediately. See the LIVE_EDITOR note above.
  output: LIVE_EDITOR ? 'server' : 'static',
  // `prerenderEnvironment: 'node'` runs build-time prerendering under Node
  // instead of workerd. Our static pages render Markdown/MDX at build time,
  // and that pipeline (micromark → debug) imports Node built-ins like `tty`
  // that workerd can't resolve. Prerendering in Node sidesteps that; only the
  // genuinely on-demand routes (e.g. api/contact) run on workerd at the edge.
  // The adapter's default image service routes through a Workers-only
  // endpoint that imports `cloudflare:workers`, which crashes under the Node
  // dev server. Dev uses passthrough; builds keep Sharp/webp optimization.
  // NB: key off NODE_ENV, not process.argv — `astro dev`'s Cloudflare worker
  // re-evaluates this config without 'dev' in argv, which wrongly selected
  // 'compile' in dev and 500'd the /_image endpoint on local images.
  adapter: cloudflare({
    prerenderEnvironment: 'node',
    imageService: process.env.NODE_ENV === 'production' ? 'compile' : 'passthrough',
  }),

  integrations: [
    sitemap(),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      // Must stay false: astro-compress's second CSS pass strips all
      // @media (width >= …) blocks from Tailwind v4 output, so every
      // breakpoint dies and desktop renders the mobile layout. Vite
      // already minifies CSS and Cloudflare brotli compresses the wire.
      CSS: false,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    // The endpoint route must match the site's trailing-slash behaviour or the
    // dev router 404s every local image. This template ships with
    // trailingSlash: false, so the route is registered WITHOUT the slash
    // ('/_image/' is only correct for trailingSlash 'always').
    endpoint: { route: '/_image' },
    // Astro's default Sharp service handles local images.
    //
    // Most remote CDN images (Unsplash, Cloudinary, Imgix…) are routed by
    // src/components/common/Image.astro through `unpic`, which rewrites the
    // URL with CDN-side query parameters and serves it straight from the
    // provider — Astro never downloads it, so they don't need to be listed.
    //
    // `domains` only matters for remote URLs that fall through to Astro's
    // native <Image /> (i.e. providers Unpic can't detect, like Pixabay).
    // Listed entries are authorized to be processed by Sharp.
    domains: ['cdn.pixabay.com'],
  },

  markdown: {
    processor: unified({
      remarkPlugins: [readingTimeRemarkPlugin],
      rehypePlugins: [responsiveTablesRehypePlugin],
    }),
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
    environments: {
      ssr: {
        // astro-icon pulls in `debug`, which is CJS. The workerd dev runner
        // can't load CJS unless it is prebundled, so any on-demand route that
        // renders an icon 500s with "module is not defined".
        //
        // It bites hardest with LIVE_EDITOR on, where every page is on demand
        // and so every page fails at once. Kept here unconditionally because
        // the /admin routes are on demand either way.
        //
        // Do NOT "fix" a related error — ".vite/deps_ssr/… does not exist" — by
        // adding optimizeDeps.exclude. That error means the dev server's
        // prebundle cache went stale (usually a `npm run build` while dev was
        // running); stop the dev server, delete node_modules/.vite and restart.
        optimizeDeps: {
          include: ['debug', '@iconify/utils'],
        },
      },
    },
  },
});
