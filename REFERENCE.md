# dmw-astro-base Reference

Practical guide to working with this starter. For AI agent instructions and architecture detail see [AGENTS.md](./AGENTS.md). For SEO and layout standing rules see [CLAUDE.md](./CLAUDE.md).

---

## Per-client setup checklist

When you clone this repo for a new client, work through these in order:

1. **[`src/config.yaml`](#site-config)** — site name, production URL, title template, description
2. **[`src/config/business.ts`](#business-config)** — name, address, phone, schema type, image
3. **[`src/navigation.ts`](#navigation)** — nav links, footer columns, social links, footnote
4. **[`src/assets/images/default.png`](#images--favicons)** — replace with client OG image (1200×628 px)
5. **[`src/assets/favicons/`](#images--favicons)** — replace with client favicons
6. **[`src/pages/index.astro`](#pages)** — build the homepage with widgets
7. Remaining pages: `about`, `services`, `contact`, `pricing` — fill in with widgets and real copy

---

## Site config

**File:** [`src/config.yaml`](src/config.yaml)

This is the single source of truth for the domain and global SEO defaults. The integration loads it as a Vite virtual module (`astrowind:config`) so changes hot-reload in dev.

```yaml
site:
  name: Client Business Name # appears in logo and footer
  site: 'https://clientdomain.ie' # drives canonicals, sitemap, robots.txt
  trailingSlash: false

metadata:
  title:
    default: Client Business Name
    template: '%s — Client Business Name' # used on inner pages
  description: '150-160 char description of the business for search results.'
  openGraph:
    site_name: Client Business Name
    images:
      - url: '~/assets/images/default.png' # 1200×628 OG image
        width: 1200
        height: 628

i18n:
  language: en-IE # drives <html lang> and og:locale (en_IE)

analytics:
  vendors:
    googleAnalytics:
      id: null # set to "G-XXXXXXXXXX" when client has GA4

ui:
  theme: 'light:only' # system | light | dark | light:only | dark:only
```

> **Sites are light-only by default.** `light:only` forces light mode and hides the theme toggle everywhere. To offer dark mode, set `theme: 'system'` **and** add `showToggleTheme` back to the `<Header>` in `src/layouts/PageLayout.astro`.

> **`site.site` is the only domain constant** — sitemap index, robots.txt `Sitemap:` URL, and all canonical URLs are derived from it automatically.

---

## Business config

**File:** [`src/config/business.ts`](src/config/business.ts)

Feeds `LocalBusinessSchema` on the homepage and contact page. Fill it in once per client — the schema components read from it by default.

```ts
export const business: BusinessConfig = {
  name: 'Brennan Plumbing & Heating',
  legalName: 'Brennan Plumbing & Heating Ltd',
  type: 'Plumber', // schema.org subtype — see comments in the file
  url: 'https://brennanplumbing.ie',
  telephone: '+353 66 123 4567',
  email: 'info@brennanplumbing.ie',
  address: {
    street: '14 Rock Street',
    locality: 'Tralee',
    region: 'Co. Kerry',
    postalCode: 'V92 XY12',
    country: 'IE',
  },
  image: 'https://brennanplumbing.ie/images/business.jpg',
  description: 'Brennan Plumbing & Heating — boiler servicing, installation, and emergency call-outs across Co. Kerry.',
  openingHours: ['Mo-Fr 08:00-18:00', 'Sa 09:00-13:00'],
  priceRange: '€€',
  sameAs: ['https://www.facebook.com/brennanplumbing', 'https://www.instagram.com/brennanplumbing'],
};
```

Common `type` values: `Plumber` `Electrician` `HVACBusiness` `Roofer` `Attorney` `AccountingService` `LegalService` `HairSalon` `BeautySalon` `Dentist` `AutoRepair` `Restaurant` `LocalBusiness`

---

## Navigation

**File:** [`src/navigation.ts`](src/navigation.ts)

Controls the header nav links, footer link columns, social icons, and footnote text.

```ts
export const headerData = {
  links: [
    { text: 'Home', href: getPermalink('/') },
    { text: 'Services', href: getPermalink('/services') },
    // add a dropdown:
    {
      text: 'Services',
      links: [
        { text: 'Boiler Servicing', href: getPermalink('/services/boiler-servicing') },
        { text: 'Emergency Call-out', href: getPermalink('/services/emergency') },
      ],
    },
    { text: 'Blog', href: getBlogPermalink() },
    { text: 'Contact', href: getPermalink('/contact') },
  ],
  actions: [
    // optional CTA button in the header, e.g.
    { text: 'Call us now', href: 'tel:+35366123456', variant: 'primary' },
  ],
};

export const footerData = {
  links: [
    {
      title: 'Services',
      links: [{ text: 'Boiler Servicing', href: getPermalink('/services') }],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: 'https://facebook.com/…' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: 'https://instagram.com/…' },
  ],
  footNote: `© ${new Date().getFullYear()} Brennan Plumbing & Heating Ltd`,
};
```

---

## Pages

**Directory:** [`src/pages/`](src/pages/)

| File             | Route       | Purpose                               |
| ---------------- | ----------- | ------------------------------------- |
| `index.astro`    | `/`         | Homepage — wire widgets here          |
| `about.astro`    | `/about`    | About the business                    |
| `services.astro` | `/services` | Services overview                     |
| `contact.astro`  | `/contact`  | Contact form + business details       |
| `pricing.astro`  | `/pricing`  | Service packages / pricing            |
| `privacy.md`     | `/privacy`  | Privacy policy (MarkdownLayout)       |
| `terms.md`       | `/terms`    | Terms and conditions (MarkdownLayout) |
| `404.astro`      | `*`         | Error page                            |
| `rss.xml.ts`     | `/rss.xml`  | RSS feed — no editing needed          |
| `[...blog]/`     | `/blog/…`   | Blog engine — no editing needed       |

### Page template

Every page follows this pattern:

```astro
---
import Layout from '~/layouts/PageLayout.astro';
import Hero from '~/components/widgets/Hero.astro';
// import more widgets as needed

const metadata = {
  title: 'Services', // unique, under ~60 chars
  description: 'Boiler servicing, installation, and emergency plumbing across Co. Kerry. Call Brennan Plumbing today.',
};
---

<Layout metadata={metadata}>
  <h1 class="sr-only">Services</h1>
  <!-- if no widget renders the H1 -->

  <Hero tagline="Services" title="What we do" />
  <!-- more widgets -->
</Layout>
```

> Never hand-write `<title>`, `<meta name="description">`, `<link rel="canonical">`, or OG tags. The layout generates all of them from the `metadata` prop.

### Adding LocalBusinessSchema to a page

Homepage and contact already have it. For any other page that needs it:

```astro
---
import LocalBusinessSchema from '~/components/schema/LocalBusinessSchema.astro';
---

<Layout metadata={metadata}>
  <Fragment slot="head">
    <LocalBusinessSchema />
  </Fragment>
  <!-- page content -->
</Layout>
```

### Adding a new page

1. Create `src/pages/your-page.astro`
2. Use `PageLayout` and pass `metadata`
3. Add the route to `src/navigation.ts`

---

## Services (data-driven)

Services are a **content collection**, not hand-built pages. One Markdown file in [`src/data/services/`](src/data/services/) produces `/services/<filename>` (with `ServiceSchema` + breadcrumbs) and a card on the `/services` index — sorted by `order`.

```md
---
title: Boiler Servicing
excerpt: Annual boiler servicing and safety checks across Co. Kerry.
icon: tabler:flame # any Tabler icon
order: 1
features: # optional bullet list on the page
  - Gas Safe registered
  - Same-week appointments
# draft: true            # hide without deleting
---

Full service description in Markdown…
```

Add a service → `npm run new -- service "Boiler Servicing"` (or copy a file). Remove the shipped `example-service-*.md` files before launch (the guardrail flags them). For a header dropdown of services, add the links to `src/navigation.ts` manually.

### Testimonials & FAQs (also data-driven)

Same idea — edit content, not markup:

- **Testimonials**: one file per quote in [`src/data/testimonials/`](src/data/testimonials/) (`name`, `job`, `testimonial`, optional `rating` 1–5). Render with `<TestimonialsData title="…" />`. `npm run new -- testimonial "Mary O'Sullivan"`.
- **FAQs**: one file per question in [`src/data/faq/`](src/data/faq/) (`question`, `answer`, optional `icon`). Render with `<FaqsData title="…" />` — it emits `FAQPage` JSON-LD automatically. `npm run new -- faq "What areas do you cover?"`.

### Page recipes

[`src/recipes/`](src/recipes/) holds ready-made page compositions (`home.astro`, `about.astro`). Copy one into `src/pages/` and edit — don't build a page from scratch:

```bash
cp src/recipes/home.astro src/pages/index.astro
```

They're type-checked but not routed (they live outside `src/pages/`).

### Brand assets

`npm run brand path/to/logo.png` regenerates the favicons (`apple-touch-icon.png`, `favicon.ico`, `favicon.svg`) **and** the 1200×628 OG image (`src/assets/images/default.png`, brand colour + business name). Run it after `npm run setup`.

**Trust & conversion helpers**

- `~/components/common/StickyContact.astro` — mobile Call/WhatsApp bar (in the layout; sourced from `business.ts`).
- `~/components/common/OpeningHours.astro` — hours list + live "Open now / Closed" badge from `business.openingHours`.
- `~/components/common/Breadcrumbs.astro` — visible trail + `BreadcrumbList` JSON-LD for inner pages.
- Star ratings: set `business.aggregateRating` **only** with a real, on-site rating (see `business.ts`).
- The contact form sends the enquiry **and** an auto-reply confirmation to the customer.

---

## Optional features — how to remove each

Every optional feature is a self-contained component or a config flag, so removing one is a one-line change and the build stays green with no leftover references.

| Feature                           | To remove                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sticky Call/WhatsApp bar (mobile) | Delete `<StickyContact />` in `src/layouts/Layout.astro`                                                                                 |
| WhatsApp button only (keep Call)  | Delete the WhatsApp `<a>` block in `src/components/common/StickyContact.astro`; the footer one is in `src/navigation.ts` (`socialLinks`) |
| Opening hours / "Open now" badge  | Delete `<OpeningHours />` in `src/components/widgets/Contact.astro`                                                                      |
| Dev setup banner                  | Delete `<DevBanner />` in `src/layouts/Layout.astro` (never shown to customers regardless)                                               |
| Cookie consent banner             | Set `analytics.vendors.googleAnalytics.id: null` in `config.yaml` (no GA → no banner)                                                    |
| Cloudflare Turnstile              | Leave `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` blank in `.env`                                                               |
| A single service                  | Delete its file in `src/data/services/`, or set `draft: true` in its frontmatter                                                         |
| Star ratings (AggregateRating)    | Leave `business.aggregateRating` unset in `business.ts`                                                                                  |
| Contact auto-reply                | Delete the "Auto-reply to the customer" block in `src/pages/api/contact.ts`                                                              |

---

## Widgets

**Directory:** [`src/components/widgets/`](src/components/widgets/)

Widgets are the building blocks of every page. Compose them by importing and stacking inside `<Layout>`.

### Hero — full-width with image

```astro
<Hero
  tagline="Services"
  title="Boiler servicing you can rely on"
  subtitle="Gas Safe registered engineers covering all of Co. Kerry."
  actions={[
    { variant: 'primary', text: 'Get a quote', href: '/contact' },
    { text: 'Our services', href: '#services' },
  ]}
  image={{ src: '~/assets/images/boiler-hero.jpg', alt: 'Engineer servicing a boiler' }}
/>
```

### Hero2 — side-by-side (image right)

Same props as Hero, different layout. Good for inner pages.

### HeroText — text only, no image

Good for inner page headers (pricing, contact, about).

```astro
<HeroText tagline="Contact" title="Get in touch" subtitle="We respond within one business day." />
```

### Features — icon grid

```astro
<Features
  id="services"
  tagline="What we do"
  title="Our services"
  items={[
    { title: 'Boiler Servicing', description: 'Annual service and safety check.', icon: 'tabler:flame' },
    { title: 'Emergency Call-out', description: '24/7 emergency response.', icon: 'tabler:urgent' },
  ]}
/>
```

`Features2` — smaller cards, good for quick overviews.
`Features3` — grid with optional full-bleed image alongside.

### Content — text + image side by side

```astro
<Content
  title="About our work"
  items={[
    { title: 'Gas Safe registered', icon: 'tabler:certificate' },
    { title: '15 years in business', icon: 'tabler:calendar' },
  ]}
  image={{ src: '~/assets/images/team.jpg', alt: 'The Brennan team on site' }}
  isReversed
  <!--
  flip
  image
  to
  left
  --
>
  >
  <Fragment slot="content">
    <h3>Kerry's most trusted plumbers</h3>
    We've been keeping Kerry homes warm since 2009.
  </Fragment>
</Content>
```

### Steps — numbered process with image

```astro
<Steps
  title="How it works"
  items={[
    { title: 'Book online or call us', icon: 'tabler:number-1' },
    { title: 'We visit and assess', icon: 'tabler:number-2' },
    { title: 'Work completed, guaranteed', icon: 'tabler:number-3' },
  ]}
  image={{ src: '~/assets/images/process.jpg', alt: 'Engineer at work' }}
/>
```

`Steps2` — horizontal icon list, no image. Good for values or quick-fire features.

### Testimonials

```astro
<Testimonials
  title="What our customers say"
  testimonials={[
    {
      testimonial: 'Fantastic service. Fixed our boiler same day.',
      name: "Mary O'Sullivan",
      job: 'Homeowner, Tralee',
      image: { src: '~/assets/images/testimonial-mary.jpg', alt: "Mary O'Sullivan" },
    },
  ]}
/>
```

### FAQs

```astro
<FAQs
  title="Common questions"
  items={[
    { title: 'Are you Gas Safe registered?', description: 'Yes, all our engineers are fully certified.' },
    { title: 'Do you cover emergencies?', description: 'Yes, we offer 24/7 emergency call-outs.' },
  ]}
/>
```

Pair with `FaqSchema` to get the FAQPage JSON-LD (see [Schema components](#schema-components)).

### Pricing

```astro
<Pricing
  title="Service plans"
  prices={[
    {
      title: 'Annual Service',
      price: 120,
      period: 'per visit',
      items: [{ description: 'Full boiler service' }, { description: 'Safety certificate' }],
      callToAction: { text: 'Book now', href: '/contact' },
    },
  ]}
/>
```

### Stats

```astro
<Stats
  stats={[
    { title: 'Years trading', amount: '15' },
    { title: 'Jobs completed', amount: '2,400+' },
    { title: 'Google rating', amount: '4.9★' },
  ]}
/>
```

### Brands — logo strip (certifications / associations)

```astro
<Brands
  title="Accreditations"
  images={[
    { src: '~/assets/images/gas-safe.png', alt: 'Gas Safe registered' },
    { src: '~/assets/images/seai.png', alt: 'SEAI registered' },
  ]}
/>
```

### CallToAction — full-width banner

```astro
<CallToAction
  title="Ready to book?"
  subtitle="Call us or fill in the form and we'll get back to you today."
  actions={[{ variant: 'primary', text: 'Contact us', href: '/contact' }]}
/>
```

### Contact form

```astro
<Contact
  id="form"
  title="Send us a message"
  inputs={[
    { type: 'text', name: 'name', label: 'Name' },
    { type: 'email', name: 'email', label: 'Email' },
    { type: 'tel', name: 'phone', label: 'Phone' },
  ]}
  textarea={{ label: 'Message' }}
  disclaimer={{ label: 'By submitting this form you agree to our privacy policy.' }}
  description="We respond within one business day."
/>
```

> The form renders HTML only — no server action is wired. Connect it to Netlify Forms, Formspree, or a serverless endpoint per project.

### BlogLatestPosts

```astro
<BlogLatestPosts title="From our blog" information="Tips, guides, and news from the team." />
```

### Note — slim callout bar

```astro
<Note title="Tip:" description="Book your annual service before September to avoid the winter rush." />
```

### Announcement — slim bar above the header

Edit [`src/components/widgets/Announcement.astro`](src/components/widgets/Announcement.astro). It is empty by default. Add a `<div>` with content to enable it.

---

## Schema components

**Directory:** [`src/components/schema/`](src/components/schema/)

All output `<script type="application/ld+json">` into `<head>`. Inject via `<Fragment slot="head">`.

### LocalBusinessSchema

Reads all values from `business.ts` by default. Override any prop for a specific page.

```astro
<Fragment slot="head">
  <LocalBusinessSchema />
  <!-- or override individual props: -->
  <LocalBusinessSchema type="Plumber" region="Co. Kerry" />
</Fragment>
```

### ServiceSchema

Add to any dedicated service page.

```astro
<Fragment slot="head">
  <ServiceSchema
    name="Boiler Servicing"
    description="Annual boiler service and safety certificate for Kerry homeowners."
    areaServed="Co. Kerry"
  />
</Fragment>
```

### FaqSchema

Pair with the `FAQs` widget. Pass the same question/answer data to both.

```astro
---
const faqs = [
  { question: 'Are you Gas Safe registered?', answer: 'Yes, all engineers are fully certified.' },
  { question: 'Do you cover emergencies?', answer: 'Yes, 24/7 call-out service is available.' },
];
---

<Layout metadata={metadata}>
  <Fragment slot="head">
    <FaqSchema items={faqs} />
  </Fragment>

  <FAQs title="Common questions" items={faqs.map((f) => ({ title: f.question, description: f.answer }))} />
</Layout>
```

---

## Blog

**Posts directory:** [`src/data/post/`](src/data/post/)

Create `.md` or `.mdx` files. The blog engine (routes, pagination, categories, tags, RSS) requires no editing.

### Post frontmatter

```yaml
---
title: 'Why you should service your boiler every year'
publishDate: 2025-09-01
excerpt: 'A short description shown in blog listings and used as the meta description.'
image: ~/assets/images/blog/boiler-service.jpg
category: Maintenance
tags:
  - boilers
  - safety
author: Seán Brennan
draft: false
metadata:
  title: 'Annual Boiler Servicing — Why It Matters'   # optional override
  description: 'Full 160-char override for this post's meta description.'
---
```

`title` is the only required field. Omit `publishDate` to default to the file's modification date.

### Blog config (posts per page, URL pattern)

Edit [`src/config.yaml`](src/config.yaml) under `apps.blog`. The post permalink pattern is `/%slug%` by default — change to `/%year%/%month%/%slug%` if needed.

---

## Layouts

**Directory:** [`src/layouts/`](src/layouts/)

| Layout                 | Use for                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `PageLayout.astro`     | Every standard page — includes Header + Footer                       |
| `MarkdownLayout.astro` | `.md` pages (privacy, terms) — automatically applied via frontmatter |
| `LandingLayout.astro`  | Campaign landing pages — stripped-down header                        |
| `Layout.astro`         | Root HTML shell — do not use directly in pages                       |

`MarkdownLayout` is applied automatically when a `.md` file sets `layout: '~/layouts/MarkdownLayout.astro'` in its frontmatter.

---

## Images and favicons

**OG / social image:** [`src/assets/images/default.png`](src/assets/images/default.png)
Replace with a 1200×628 px image for the client. Keep the filename or update the path in `config.yaml`.

**Favicons:** [`src/assets/favicons/`](src/assets/favicons/)

| File                   | Purpose                           |
| ---------------------- | --------------------------------- |
| `favicon.svg`          | SVG favicon (modern browsers)     |
| `favicon.ico`          | Fallback ICO                      |
| `apple-touch-icon.png` | iOS home screen icon (180×180 px) |

Generate a complete favicon set from the client's logo at [realfavicongenerator.net](https://realfavicongenerator.net) and drop the files here.

### Using images in pages and widgets

Always use `~/components/common/Image.astro`, not a plain `<img>`:

```astro
import Image from '~/components/common/Image.astro';

<Image src="~/assets/images/team.jpg" alt="The Brennan team outside the van" width={800} height={600} />
```

Local images in `src/assets/images/` are optimised by Sharp at build time. Remote images (Cloudinary, Imgix, etc.) are handled by Unpic. Store per-client images in `src/assets/images/`.

---

## Styles

### Colours and fonts

**File:** [`src/components/CustomStyles.astro`](src/components/CustomStyles.astro)

CSS variables for primary, secondary, accent, text, and background colours — defined separately for light and dark mode. Change these to match the client brand.

```css
:root {
  --aw-color-primary: rgb(1 97 239); /* main brand colour */
  --aw-color-secondary: rgb(1 84 207);
  --aw-color-accent: rgb(109 40 217);
  --aw-font-heading: 'Inter Variable';
  --aw-font-sans: 'Inter Variable';
}
```

To use a different font: add it to the `<head>` in `Layout.astro` (e.g. a Google Fonts `<link>`), then update `--aw-font-sans` and `--aw-font-heading` here.

### Tailwind config

**File:** [`src/assets/styles/tailwind.css`](src/assets/styles/tailwind.css)

Tailwind v4 is CSS-first. Theme tokens, custom utilities, and plugins are all defined here. The Vite plugin (`@tailwindcss/vite`) is wired in `astro.config.ts`.

---

## Build and deploy

```bash
npm run setup        # interactive per-client scaffolder (run first on a new clone)
npm run setup -- --from client.yaml   # …or apply a client intake file unattended
npm run brand logo.png             # regenerate favicons + OG image from a logo
npm run new -- service "Name"      # scaffold a service / faq / testimonial / page
npm run dev          # dev server at localhost:4321 (hot reload)
npm run build        # production build → dist/
npm run preview      # preview the dist/ build locally
npm run check        # astro check + ESLint + Prettier (run before every commit)
npm run check:golive # pre-launch guardrail — fails on leftover placeholders / noindex
npm run fix          # auto-fix lint and formatting issues
```

### `npm run setup` — new client scaffolder

Asks for the business name, type, URL, phone, email, address, description, brand colour, GA id, and Worker name, then writes them into `src/config/business.ts`, `src/config.yaml`, `src/components/CustomStyles.astro`, and `wrangler.jsonc`. Re-runnable (it targets values, not line numbers). `business.ts` is the single source of truth for identity; `config.yaml` holds SEO/site config.

### `npm run check:golive` — pre-launch guardrail

Scans for template leftovers that would break a launch — `example.com` URLs, `robots.index: false`, placeholder business details, the `G-TEST12345` analytics placeholder — and exits non-zero on any blocker. Warnings (empty Search Console token, generic schema type, unreplaced OG image) don't fail. Run it before every deploy.

The deployment target is **Cloudflare** (Workers static assets — the successor to Cloudflare Pages, same push-to-deploy git workflow). The build is split: prerendered pages and assets go to `dist/client/`, and the Worker that serves on-demand routes (e.g. `/api/contact`) goes to `dist/server/`, alongside a ready-to-deploy config at `dist/server/wrangler.json` (merged from the root `wrangler.jsonc` — set the per-site Worker `name` there).

Deploy either way:

- **Dashboard**: connect the repo in Cloudflare (Workers Builds) with build command `npm run build`.
- **CLI**: `npx wrangler deploy -c dist/server/wrangler.json`. The first deploy may prompt to provision the `SESSION` KV namespace the adapter declares.

**Check `wrangler deploy` actually published.** On a Worker served only by a custom domain, with no `routes` declared in the config, `wrangler deploy` prints `No targets deployed` and uploads a *version* without releasing it — the site keeps serving the previous build, silently. If you see that message instead of a `Deployed <name> triggers` line, follow it with:

```
npx wrangler versions deploy <version-id>@100% --name <worker> --yes
```

Cork CIL ran a stale build for hours on this. After any deploy, confirm the change is actually live rather than trusting the exit code.

**Security headers need a zone rule, not `public/_headers`.** `_headers` is applied by Workers static assets, so it only ever reaches prerendered pages and assets — never HTML rendered on demand by the Worker (`/contact` and anything else with `prerender = false`). Those responses go out bare. The file is still worth keeping for cache-control on assets, but the security headers must be set at the zone: add a Response Header Transform Rule (Rules → Transform Rules → Modify Response Header, expression `true`) setting `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`, and turn on HSTS, Always Use HTTPS and minimum TLS 1.2 in the zone's SSL/TLS settings. This is per zone, so it has to be repeated for every client domain.

Verify with `curl -sI https://<domain>/contact` — an on-demand route, not the homepage.

Expected non-error warnings on a fresh clone with no blog posts:

```
[WARN] No files found matching "*.md,*.mdx" in directory "src/data/post"
The collection "post" does not exist or is empty.
```

Both disappear once the first blog post is added.

### Environment variables

The static pages need no environment variables. The contact endpoint (`src/pages/api/contact.ts`) reads its Brevo settings from the Cloudflare Worker **runtime env** first (`wrangler secret put BREVO_API_KEY`, or the Worker's settings in the dashboard — rotatable without a rebuild), then falls back to build-time `.env` values so local `astro dev` works — see `.env.example`. Prefix a variable with `PUBLIC_` only if Astro should expose it client-side.

**Contact-form spam protection.** A hidden honeypot field always runs. To also enable [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (a free, privacy-friendly CAPTCHA), create a Turnstile widget in the Cloudflare dashboard and set two vars: `PUBLIC_TURNSTILE_SITE_KEY` (public, inlined at build) and `TURNSTILE_SECRET_KEY` (a Worker secret in production). Both are optional — the widget in `Form.astro` and the server check in `api/contact.ts` are no-ops when unset, so the form keeps working without them.

**Contact-form email-relay bug (fixed here, check older sites).** `api/contact.ts` never quotes caller-authored `message` content back into an email sent *to* the caller's own address — doing so turns the form into an open relay, since anyone can POST arbitrary text to any inbox, signed by the verified Brevo sender. The confirmation email uses fixed wording only, with the greeting name truncated to 60 chars. A per-IP `CONTACT_RATE_LIMIT` binding (5/min, declared in `wrangler.jsonc` under `unsafe.bindings`) is checked before any Brevo send — every submission costs two sends, so an unmetered endpoint is also a billing/abuse risk. `withinRateLimit()` no-ops safely if the binding is absent. This exact bug was found across most of the client-site fleet (Aug 2026) and ported here so new builds inherit the fix; if you're porting it to an **older Pages-based site** (the `functions/api/contact.ts` + `wrangler.toml` shape, e.g. `dmw`, `container-services-ireland` — predates this Workers-based template), note that **Cloudflare Pages config validation rejects `unsafe.bindings` in `wrangler.toml` outright** ("Configuration file for Pages projects does not support unsafe") — it broke a git-triggered production build on `container-services-ireland`. On a Pages project the rate-limit binding has to be added via the dashboard (Settings → Functions → Bindings) instead; the relay-fix code itself doesn't depend on the binding existing.
