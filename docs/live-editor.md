# Live page editor and admin dashboard

A client signs in at `/admin`, opens any page with `?edit=1`, clicks a heading,
paragraph or picture, and hits Save. The change is live immediately — no
rebuild, no deploy, no CMS to learn.

The dashboard also holds everything sent through the contact form, a picture
library, and (optionally) gated document areas like a staff portal.

It is deliberately **not** a page builder. The layout stays in the `.astro`
files where the design work is; only the words can be changed. That boundary is
the point: a client can fix a phone number or reword a paragraph without being
able to dismantle a page.

Off by default. A site with the editor switched off is byte-for-byte the site it
was before — no extra scripts, no database, no admin routes doing anything.

---

## Turning it on

```bash
npx wrangler d1 create mysite-db          # note the database_id it prints
# → paste name + id into the d1_databases block in wrangler.jsonc (uncomment it)
# → set LIVE_EDITOR = true at the top of astro.config.ts

npx wrangler r2 bucket create mysite-uploads   # pictures + portal documents
# → uncomment the r2_buckets block in wrangler.jsonc

npm run cms:init                          # create the tables locally
npm run cms:user -- you@example.ie        # your login; prints a password once
npm run dev
```

The R2 bucket **must stay private** — no `r2.dev` URL, no custom domain in front
of it. Public images and gated portal documents share the bucket, separated only
by key prefix, and every read goes through a Worker route that decides who may
have it. A public bucket URL bypasses those routes entirely.

Then `http://localhost:4321/admin`.

When you go live, do the same against the real database:

```bash
npm run cms:init -- --remote
npm run cms:user -- client@theirdomain.ie --role editor --remote
```

## What the switch actually changes

`LIVE_EDITOR = true` flips `output` from `'static'` to `'server'`.

That is not incidental — it's the whole mechanism. Overrides are read in
`src/middleware.ts`, and middleware only runs per request for pages rendered on
demand. Left on `'static'`, every page is rendered at build time and a client's
edit would appear only after the next deploy, which is the exact behaviour this
feature exists to remove.

The cost: every page becomes a Worker invocation instead of a static asset. For
the size of site this template builds that's a good trade — Cloudflare's free
tier is 100k requests/day and `public/_headers` still lets the CDN cache the
HTML — but it is a real one. Leave the switch off for sites where nobody will
ever edit the copy.

## How a region becomes editable

Two mechanisms, and most sites only need the first.

**Automatic.** `src/lib/cms/auto-editable.ts` rewrites the rendered HTML on the
way out: any `<h1>`–`<h4>` or `<p>` inside `<main>` whose content is plain text
becomes editable. No markup changes, nothing to remember, and it covers pages
written long before this feature existed.

It is deliberately conservative — it skips anything containing nested tags or
HTML entities. An element it skips is simply not editable, never broken.

**Explicit.** Wrap copy in `<Editable>` when you want a key that survives a
wording change, or when the element isn't one of those tags:

```astro
---
import Editable from '~/components/cms/Editable.astro';
---

<Editable key="intro" as="p" class="text-lg"> Looking after Cork families since 1994. </Editable>
```

### Why keys are derived from the text

A region's key comes from the copy in the template, not its position on the
page. Positional keys silently re-point when someone inserts a section above, so
edited copy would jump to the wrong heading.

The trade-off runs the other way: if a **developer** changes the source text in
the `.astro` file, any override made against the old wording is orphaned and the
page falls back to the new source copy. That's the safer direction to fail in —
a developer editing a template usually means the new wording to win — but it's
worth knowing before you wonder where an edit went.

`<Editable key="…">` exists precisely for copy where you don't want that.

## Enquiries

Everything sent through the contact form is stored on the site and listed under
**Enquiries**, with search, a new/dealt-with filter, and a CSV export that
matches whatever filter is on screen.

The enquiry is written to the database **before** the email is attempted, and
the row records whether the email actually went out. That ordering is the whole
point: previously an enquiry existed only as an email, so a Brevo outage, an
expired key or a bouncing address lost it silently. Now the site holds the
record and the email is only the notification — and anything that failed to send
is flagged _Not emailed_ rather than vanishing.

**This is personal data.** Names, addresses, phone numbers and free text from
members of the public now sit in your D1 database as well as an inbox. Before
turning this on for a client: say so in the privacy policy, agree a retention
period, and remember that a "delete my data" request now has a second place to
look.

## Pictures

**Images** is a library: upload once, use anywhere. In the page editor, clicking
any picture opens a picker to choose a different one or upload a new one on the
spot.

Every image should be given a description — it is read aloud by screen readers
and is what search engines use to understand the picture.

Images are public and cached hard (`immutable`), which is safe because replacing
a picture points the page at a _different_ id rather than changing the bytes
behind an existing one.

## Portals (optional)

Off unless `cms.portals.enabled` is true in `src/config/cms.ts`. A portal is a
gated area — a staff or trustee document library — managed from **Portals**:
sections, documents, ordering, and pinning the most-used forms to the top.

**Nothing in this dashboard authenticates anyone.** Portals are protected by
Cloudflare Access, which is bound to a URL path, and that is the only thing
between the public and these documents. So:

- an area's `slug` must match a real Access application (`/staff`, `/trustee`);
  adding one without a matching policy publishes its documents,
- the serving route must stay at `/<area>/doc/<id>`; moving it out from under
  the prefix removes the gate silently,
- people are added and removed in the Cloudflare Zero Trust dashboard, not here.

Documents are checked against the area they were requested under, so a staff
login cannot fetch a trustee document by guessing an id.

## Who can do what

There are two roles, and only one of them can change anything.

|                                      | Can view and download files | Full administrator |
| ------------------------------------ | --------------------------- | ------------------ |
| See and download portal documents    | ✅                          | ✅                 |
| Change page wording and pictures     | —                           | ✅                 |
| Manage portal sections and documents | —                           | ✅                 |
| Read enquiries and export them       | —                           | ✅                 |
| Add and remove people                | —                           | ✅                 |

There is deliberately no middle tier. The first version had one — an "editor"
who could change page copy — and it turned out that the same role could also
delete documents from the staff portal, because both sit behind the same
signed-in admin. An account handed to somebody to fix a paragraph should not be
able to delete a safeguarding policy.

Every check is enforced on the server, not by hiding buttons: a viewer who posts
directly to the save, upload, export or portal endpoints gets a 403.

There is no public sign-up and no password-reset email. A locked-out user gets a
new password set for them in **People**, which also signs them out everywhere.
If every administrator is locked out, `npm run cms:user -- <email> --remote`
resets one from the command line.

## Reverting

`/admin/pages` lists every changed piece of text with its history, and "Put back
the original" deletes the override so the region falls back to the copy in the
`.astro` file.

It's a delete rather than "restore the original value" because the database has
no idea what the original was — and storing a copy at edit time would go stale
the moment a developer changed the template.

## What it does not do

Worth being straight about, since these are the questions clients ask second:

- **No new pages or sections.** The layout lives in code. Pictures and wording
  can change; structure cannot.
- **No image cropping or resizing.** A swapped picture is used as uploaded, so
  it should be roughly the shape of the one it replaces.
- **No reordering.** Same reason.
- **No draft/preview.** A save is live. That's the trade for its simplicity —
  the revision history is the safety net, not a staging step.
- **Region keys are not discoverable from the admin.** `/admin` lists the pages
  from `src/navigation.ts`, but which _pieces_ of a page are editable is only
  visible by opening it with `?edit=1`.

## Files

```
migrations/0001_live_editor.sql       cms_users, cms_sessions, page_content,
                                      page_content_revisions, cms_activity
migrations/0002_contact_submissions.sql  enquiries from the contact form
migrations/0003_media_and_portals.sql    media library + portal sections/documents

src/config/cms.ts                     which features this site turns on
src/middleware.ts                     session + overrides per request, HTML rewrite

src/lib/cms/env.ts                    resolves the D1 and R2 bindings (lazily)
src/lib/cms/auth.ts                   PBKDF2 via WebCrypto, sessions, cookies
src/lib/cms/csrf.ts                   origin check for the signed-in admin
src/lib/cms/editable.ts               key helpers (pure)
src/lib/cms/auto-editable.ts          the HTML rewriter (pure)
src/lib/cms/page-content.ts           reads and writes overrides
src/lib/cms/site-pages.ts             editable page list, derived from navigation.ts
src/lib/cms/submissions.ts            contact form enquiries + CSV export
src/lib/cms/media.ts                  uploads, R2 keys, image dimensions
src/lib/cms/portals.ts                gated sections, documents and file serving

src/components/cms/Editable.astro     explicit editable region
src/components/cms/LiveEditor.astro   the editing overlay + picture picker
src/components/cms/ActivityFeed.astro the who-changed-what timeline
src/layouts/AdminLayout.astro         admin chrome, branded from CustomStyles + Logo

src/pages/admin/*                     sign in, overview, enquiries, edited text,
                                      images, portals, people
src/pages/api/admin/*                 save/revert, upload, media list, CSV, sign out
src/pages/media/[id].ts               public image serving
```

## Notes for whoever touches this next

- **Never give `LiveEditor.astro` an Astro `<style>` block.** Astro bundles a
  component's styles when it is _imported_, not when it renders, so they would
  ship to every public visitor. The styles are an inline string for that reason.
  This already happened once on Boston, where it added 4rem of dead space to the
  bottom of a public page.
- **Don't outline editable regions in the brand colour.** On a page header
  painted in that same colour the outline vanishes — and that's where every
  page's editable title lives.
- **A stored override is rendered with `set:text`, never `set:html`.** It's text
  someone typed into a browser. The `.astro` fallback is trusted markup; the
  stored value is not.
- **The override cache in `src/middleware.ts` is per-isolate.** A save clears
  only the isolate that handled it; others are up to 60s behind. The editor
  bypasses the cache entirely, so they never see their own change go missing.
- **Swapping an image must strip `srcset` and `sizes`.** Astro emits both, and
  they take precedence over `src` — leave them and the edit saves, reports
  success, and visibly does nothing.
- **Image keys come from the alt text, not the `src`.** Astro fingerprints built
  assets, so keying on the URL would orphan every image override on the next
  deploy.
- **Portal routes must stay at `/<area>/doc/<id>`.** Cloudflare Access is bound
  to that path prefix and is the only thing authenticating the visitor. Moving
  the route somewhere tidier removes the gate with no error anywhere.
- **Admin reads degrade rather than throw.** Migrations are applied by hand, so
  a missing table is a real state; it should cost one section of the dashboard,
  not the whole thing.
