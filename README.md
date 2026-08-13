# dmw-astro-base

A lean Astro v7 + Tailwind CSS v4 base starter for local Irish SME websites (tradespeople, solicitors, salons, accountants), deployed to Cloudflare.

Built on top of [AstroWind](https://github.com/arthelokyo/astrowind) with all SaaS/marketing-demo content stripped out.

## Stack

|           |                                    |
| --------- | ---------------------------------- |
| Framework | Astro v7                           |
| Styles    | Tailwind CSS v4                    |
| Language  | TypeScript 5.9                     |
| Content   | MDX + Astro Content Collections    |
| Images    | Astro Assets + Unpic               |
| Hosting   | Cloudflare (`@astrojs/cloudflare`) |

## What's included

- Blank page shells: Home, About, Services, Contact, Pricing, Privacy, Terms
- **Page recipes** (`src/recipes/`): ready-made home/about compositions — copy into `src/pages/` and edit
- **Data-driven content**: services, testimonials (with star ratings), and FAQs are Markdown files in `src/data/` — pages, cards, and JSON-LD (Service / FAQPage / Breadcrumb) generate themselves
- Full blog engine: posts, categories, tags, pagination, RSS
- 21 reusable section widgets: Hero, Features, Steps, Content, Testimonials, FAQs, Pricing, Stats, Brands, CallToAction, Contact, and more
- Contact form: Brevo email + customer auto-reply, honeypot + optional Cloudflare Turnstile
- Conversion & trust: sticky mobile Call/WhatsApp bar, "Open now" hours badge, GDPR cookie consent (GA4 Consent Mode v2)
- Dynamic OG image + metadata / OpenGraph handling, LocalBusiness schema
- Sitemap, robots.txt, _headers · skip links, responsive nav (light mode only by default)
- **Live page editor** (off by default): the client signs in at `/admin`, clicks any heading or paragraph on the real page, and saves. No rebuild, no CMS to learn — see [docs/live-editor.md](docs/live-editor.md)

## New client, start to finish

```bash
npm install
cp client.example.yaml client.yaml       # fill in the client's details
npm run setup -- --from client.yaml         # …or `npm run setup` for interactive Q&A
npm run brand path/to/logo.png           # favicons + 1200×628 OG image
cp src/recipes/home.astro src/pages/index.astro   # start from a recipe, then edit
# fill src/data/services|testimonials|faq with real content (npm run new -- …)
npm run check:golive                     # before deploy — fails on leftover placeholders
```

## Commands

| Command                          | Purpose                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run setup`                  | Interactive per-client scaffolder (identity, brand, name)  |
| `npm run setup -- --from a.yaml` | Same, unattended — reads answers from a client intake file |
| `npm run brand <logo>`           | Generate favicons + OG image from one logo                 |
| `npm run new -- <type> "Name"`   | Scaffold a service / faq / testimonial / page file         |
| `npm run dev`                    | Start dev server at localhost:4321                         |
| `npm run build`                  | Production build to `./dist/`                              |
| `npm run preview`                | Preview production build locally                           |
| `npm run check`                  | Run astro check + ESLint + Prettier                        |
| `npm run check:golive`           | Pre-launch guardrail — flags placeholders / noindex        |
| `npm run cms:init`               | Create the live-editor tables (add `-- --remote` for live) |
| `npm run cms:user -- <email>`    | Create or reset an editor login; prints a password once    |
| `npm run fix`                    | Auto-fix ESLint + Prettier issues                          |

## Per-client setup

1. Clone this repo, `npm install`
2. `npm run setup` (or `--from client.yaml`) — fills `src/config/business.ts` (identity, the single source of truth) and `src/config.yaml` (SEO), sets the brand colour in `CustomStyles.astro`, and names the Worker in `wrangler.jsonc`
3. `npm run brand logo.png` — regenerates favicons and the OG image from the client's logo
4. Copy pages from `src/recipes/` into `src/pages/` and edit the copy
5. Replace the `example-*` files in `src/data/services/`, `src/data/testimonials/`, `src/data/faq/` with real content (`npm run new -- service "Boiler Servicing"` etc.)
6. Update `src/navigation.ts` if nav/footer links differ from the defaults
7. Add contact-form / Turnstile secrets to `.env` (see `.env.example`)
8. Before go-live: enable indexing in `config.yaml`, then run `npm run check:golive`

## Deployment (Cloudflare)

`npm run build` emits static pages to `dist/client/`, the on-demand Worker (contact API) to `dist/server/`, and a ready-to-deploy config at `dist/server/wrangler.json`.

- **Dashboard**: connect the repo in Cloudflare (Workers Builds) with build command `npm run build`
- **CLI**: `npx wrangler deploy -c dist/server/wrangler.json`
- Contact-form secrets (`BREVO_API_KEY` etc., see `.env.example`) go in the Worker's runtime env: `wrangler secret put` or the dashboard

## Node.js requirement

\>= 22.12.0
