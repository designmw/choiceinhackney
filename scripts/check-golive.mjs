#!/usr/bin/env node
/**
 * Go-live guardrail.
 *
 * Scans the per-client config for leftover template placeholders and settings
 * that would break a launch (noindex still on, example.com URLs, unset business
 * details, placeholder analytics ids, …). Run before every deploy:
 *
 *   npm run check:golive
 *
 * ERRORS block go-live (exit 1). WARNINGS are worth a look but don't fail.
 * This reads files as text so it never needs to import/transpile anything.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);

const errors = [];
const warnings = [];
const err = (msg, fix) => errors.push({ msg, fix });
const warn = (msg, fix) => warnings.push({ msg, fix });

// ── src/config.yaml ───────────────────────────────────────────────────────────
const cfg = read('src/config.yaml');
if (!cfg) {
  err('src/config.yaml is missing.', 'Restore it from the template.');
} else {
  if (/site:\s*[\s\S]*?\bsite:\s*['"]?https?:\/\/example\.com/.test(cfg) || /example\.com/.test(cfg))
    err('config.yaml still references example.com.', "Set site.site to the client's real https:// domain.");
  if (/\bname:\s*dmw-astro-base/.test(cfg))
    err('config.yaml site.name is still "dmw-astro-base".', "Set site.name to the client's business name.");
  if (/robots:\s*[\s\S]*?index:\s*false/.test(cfg) || /index:\s*false/.test(cfg))
    err(
      'config.yaml still has robots index: false somewhere (site or blog).',
      'Set every robots.index and robots.follow to true so Google can index the site.'
    );
  if (/id:\s*['"]?G-TEST12345/.test(cfg))
    err(
      'Google Analytics id is the demo placeholder G-TEST12345.',
      "Set the client's real GA4 id, or null to disable."
    );
  if (/id:\s*null/.test(cfg))
    warn('Google Analytics is disabled (id: null).', 'Set the GA4 Measurement ID if the client wants analytics.');
  if (/googleSiteVerificationId:\s*['"]{2}/.test(cfg))
    warn(
      'Search Console token (googleSiteVerificationId) is empty.',
      'Fine if verifying by DNS; otherwise paste the HTML-tag token.'
    );
  if (/description:\s*['"]A lean Astro/.test(cfg))
    warn('metadata.description is still the template description.', 'Write a unique 150–160 char description.');
}

// ── src/config/business.ts ────────────────────────────────────────────────────
const biz = read('src/config/business.ts');
if (!biz) {
  err('src/config/business.ts is missing.', 'Restore it from the template.');
} else {
  const placeholders = [
    ["name: 'Business Name'", 'business.name is still "Business Name".'],
    ['+353 XX XXX XXXX', 'business.telephone is still the placeholder.'],
    ['info@example.com', 'business.email is still the placeholder.'],
    ["url: 'https://example.com'", 'business.url is still example.com.'],
  ];
  for (const [needle, msg] of placeholders)
    if (biz.includes(needle)) err(msg, 'Fill in real values in src/config/business.ts.');
  for (const [needle, msg] of [
    ['1 Main Street', 'business.address.street looks like the placeholder.'],
    ['V92 XXXX', 'business.address.postalCode looks like the placeholder.'],
    ['example.com/images/business.jpg', 'business.image still points at example.com.'],
    ["type: 'LocalBusiness'", 'business.type is the generic fallback (LocalBusiness).'],
  ])
    if (biz.includes(needle)) warn(msg, 'Update it in src/config/business.ts (use a specific schema.org type).');
}

// ── wrangler.jsonc ────────────────────────────────────────────────────────────
const wr = read('wrangler.jsonc');
if (wr && /"name":\s*"dmw-astro-base"/.test(wr))
  warn('wrangler.jsonc Worker name is still "dmw-astro-base".', 'Rename it per client for a unique *.workers.dev URL.');

// ── example collection content ────────────────────────────────────────────────
for (const [dir, label] of [
  ['src/data/services', 'service'],
  ['src/data/testimonials', 'testimonial'],
  ['src/data/faq', 'FAQ'],
  ['src/data/pages', 'editor page'],
]) {
  try {
    const leftover = readdirSync(join(root, dir)).filter((f) => f.startsWith('example'));
    if (leftover.length)
      warn(
        `${leftover.length} example ${label} file(s) still in ${dir}/.`,
        'Replace them with real content, or delete them.'
      );
  } catch {
    /* dir may not exist — fine */
  }
}

// ── contact form endpoint ─────────────────────────────────────────────────────
// The form POSTs to a hard-coded path while Astro registers the endpoint per
// config.yaml's trailingSlash. If the two disagree the POST 404s before the
// handler runs, so the form fails silently and no enquiry is ever sent — the
// kind of break nobody notices until a customer says they got no reply.
const contactPage = read('src/pages/contact.astro');
if (contactPage && cfg) {
  const posted = contactPage.match(/fetch\(\s*['"`](\/api\/contact\/?)['"`]/)?.[1];
  if (posted) {
    const wantsSlash = /trailingSlash:\s*true/.test(cfg);
    const hasSlash = posted.endsWith('/');
    if (wantsSlash !== hasSlash)
      err(
        `Contact form POSTs to "${posted}" but config.yaml has trailingSlash: ${wantsSlash}.`,
        `Change the fetch in src/pages/contact.astro to "/api/contact${wantsSlash ? '/' : ''}" — as-is the form 404s and sends nothing.`
      );
  }
}

// ── assets (reminders — content can't be auto-verified) ───────────────────────
if (existsSync(join(root, 'src/assets/images/default.png')))
  warn(
    'Confirm src/assets/images/default.png is the client OG image (1200×628).',
    'Replace it if it is still the default.'
  );

// ── report ────────────────────────────────────────────────────────────────────
const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RST = '\x1b[0m';

console.log('\nGo-live check\n═════════════');
if (errors.length) {
  console.log(`\n${RED}✖ ${errors.length} blocker${errors.length > 1 ? 's' : ''}${RST}`);
  for (const e of errors) console.log(`  ${RED}✖${RST} ${e.msg}\n    ${DIM}→ ${e.fix}${RST}`);
}
if (warnings.length) {
  console.log(`\n${YEL}⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}${RST}`);
  for (const w of warnings) console.log(`  ${YEL}⚠${RST} ${w.msg}\n    ${DIM}→ ${w.fix}${RST}`);
}
if (!errors.length && !warnings.length) {
  console.log(`\n${GRN}✓ All clear — no template placeholders detected. Ready to deploy.${RST}\n`);
  process.exit(0);
}
console.log(
  `\n${errors.length ? RED + '✖ Not ready: fix the blockers above.' : GRN + '✓ No blockers — review the warnings, then deploy.'}${RST}\n`
);
process.exit(errors.length ? 1 : 0);
