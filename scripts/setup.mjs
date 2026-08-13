#!/usr/bin/env node
/**
 * Interactive per-client setup.
 *
 *   npm run setup
 *
 * Asks a handful of questions once, then writes the client's details into every
 * place the template needs them:
 *   • src/config/business.ts   — identity, contact, address (feeds schema + footer)
 *   • src/config.yaml          — site name, URL, SEO title/description, GA id
 *   • src/components/CustomStyles.astro — brand colour
 *   • wrangler.jsonc           — Cloudflare Worker name
 *
 * Re-runnable: it targets values, not line numbers, so running it again just
 * updates them. Pass --yes to skip the final confirmation.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => join(root, f);
const read = (f) => readFileSync(p(f), 'utf8');

// Non-interactive mode: `npm run setup --from client.yaml` (or .json). Reads the
// answers from a file instead of prompting — re-runnable and CI-friendly.
const fromIdx = process.argv.indexOf('--from');
const fromFile = fromIdx !== -1 ? process.argv[fromIdx + 1] : null;
let fromData = null;
if (fromFile) {
  try {
    fromData = yaml.load(readFileSync(resolve(process.cwd(), fromFile), 'utf8')) ?? {};
  } catch (e) {
    console.log(`\n✖ Could not read --from file "${fromFile}": ${e.message}\n`);
    process.exit(1);
  }
}
const autoYes = process.argv.includes('--yes') || fromData != null;

// Buffer input lines into a queue so the script works both interactively and
// with piped input. (With a pipe, readline emits every line before the awaits
// register, so a plain rl.question would drop all but the first answer.)
const rl = createInterface({ input: process.stdin, output: process.stdout });
const lineQueue = [];
const waiters = [];
rl.on('line', (line) => {
  const next = waiters.shift();
  if (next) next(line);
  else lineQueue.push(line);
});
const nextLine = () =>
  new Promise((resolve) => {
    const queued = lineQueue.shift();
    if (queued !== undefined) resolve(queued);
    else waiters.push(resolve);
  });
const ask = async (q, def = '') => {
  process.stdout.write(`${q}${def ? ` (${def})` : ''}: `);
  const answer = (await nextLine()).trim();
  return answer || def;
};

// Answer a field from the --from file (by key) when present, else prompt.
const answer = async (key, question, def = '') => {
  if (fromData) {
    const v = fromData[key];
    return v === undefined || v === null || v === '' ? def : String(v);
  }
  return ask(question, def);
};

// ── helpers ───────────────────────────────────────────────────────────────────
const yamlStr = (s) => `'${String(s).replace(/'/g, "''")}'`; // single-quote + escape for YAML
const jsStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; // for the .ts file
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54) || 'client-site';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbCss = ([r, g, b]) => `rgb(${r} ${g} ${b})`;
const darken = ([r, g, b], f = 0.85) => [r, g, b].map((c) => Math.round(c * f));

function replaceOnce(src, re, repl, label, changes) {
  if (!re.test(src)) {
    changes.push(`  ⚠ could not find ${label} — left unchanged`);
    return src;
  }
  changes.push(`  ✓ ${label}`);
  return src.replace(re, repl);
}

// ── questions ─────────────────────────────────────────────────────────────────
if (fromData) console.log(`\nApplying setup from ${fromFile}…\n`);
else console.log('\nPer-client setup — press Enter to accept the default in (parens).\n');

const name = await answer('name', 'Business name', 'Business Name');
const legalName = await answer('legalName', 'Legal name', `${name} Ltd`);
const type = await answer('type', 'Schema.org type (Plumber, Electrician, Attorney, HairSalon, …)', 'LocalBusiness');
let url = await answer('url', 'Website URL', 'https://example.ie');
url = url.replace(/\/+$/, '');
const telephone = await answer('telephone', 'Phone (+353 …)', '+353 1 234 5678');
const email = await answer(
  'email',
  'Email',
  `info@${url.replace(/^https?:\/\//, '').replace(/^www\./, '') || 'example.ie'}`
);
const street = await answer('street', 'Address — street', '1 Main Street');
const locality = await answer('locality', 'Address — town/city', 'Tralee');
const region = await answer('region', 'Address — county', 'Co. Kerry');
const postalCode = await answer('postalCode', 'Address — Eircode', 'V92 XXXX');
const description = await answer(
  'description',
  'Short description (150–160 chars, for SEO + schema)',
  `${name} — quality local service.`
);
const brand = await answer('brand', 'Brand colour (hex, e.g. #1d4ed8)', '#0161ef');
const gaId = await answer('gaId', 'GA4 Measurement ID (blank = none)', '');
const workerName = await answer('workerName', 'Cloudflare Worker name', slug(name));

const rgb = hexToRgb(brand);
if (!rgb) {
  console.log(`\n✖ "${brand}" is not a valid 6-digit hex colour. Aborting.\n`);
  rl.close();
  process.exit(1);
}

// ── build changes ─────────────────────────────────────────────────────────────
const summary = [];

// 1. business.ts — regenerate the object literal
let biz = read('src/config/business.ts');
const bizObject = `export const business: BusinessConfig = {
  name: ${jsStr(name)},
  legalName: ${jsStr(legalName)},
  type: ${jsStr(type)},
  url: ${jsStr(url)},
  telephone: ${jsStr(telephone)},
  email: ${jsStr(email)},
  address: {
    street: ${jsStr(street)},
    locality: ${jsStr(locality)},
    region: ${jsStr(region)},
    postalCode: ${jsStr(postalCode)},
    country: 'IE',
  },
  image: ${jsStr(`${url}/images/business.jpg`)},
  description: ${jsStr(description)},
  openingHours: ['Mo-Fr 09:00-17:00'],
  priceRange: '€€',
  sameAs: [],
};`;
biz = replaceOnce(
  biz,
  /export const business: BusinessConfig = \{[\s\S]*?\n\};/,
  bizObject,
  'src/config/business.ts',
  summary
);

// 2. config.yaml — targeted value replacements (preserves comments)
let cfg = read('src/config.yaml');
cfg = replaceOnce(cfg, /^(\s{2}name:\s*).*$/m, `$1${yamlStr(name)}`, 'config.yaml site.name', summary);
cfg = replaceOnce(cfg, /^(\s{2}site:\s*)['"][^'"]*['"]/m, `$1${yamlStr(url)}`, 'config.yaml site.site', summary);
cfg = replaceOnce(cfg, /^(\s{4}default:\s*).*$/m, `$1${yamlStr(name)}`, 'config.yaml title.default', summary);
cfg = replaceOnce(
  cfg,
  /^(\s{4}template:\s*).*$/m,
  `$1${yamlStr(`%s — ${name}`)}`,
  'config.yaml title.template',
  summary
);
cfg = replaceOnce(cfg, /^(\s{2}description:\s*).*$/m, `$1${yamlStr(description)}`, 'config.yaml description', summary);
cfg = replaceOnce(cfg, /^(\s{4}site_name:\s*).*$/m, `$1${yamlStr(name)}`, 'config.yaml openGraph.site_name', summary);
if (gaId) cfg = replaceOnce(cfg, /^(\s{6}id:\s*).*$/m, `$1${yamlStr(gaId)}`, 'config.yaml googleAnalytics.id', summary);

// 3. CustomStyles.astro — brand colours (root + dark)
let styles = read('src/components/CustomStyles.astro');
const primary = rgbCss(rgb);
const secondary = rgbCss(darken(rgb, 0.85));
styles = styles.replace(/--aw-color-primary: rgb\([^)]*\);/g, `--aw-color-primary: ${primary};`);
styles = styles.replace(/--aw-color-secondary: rgb\([^)]*\);/g, `--aw-color-secondary: ${secondary};`);
styles = styles.replace(/--aw-color-accent: rgb\([^)]*\);/g, `--aw-color-accent: ${primary};`);
summary.push(`  ✓ CustomStyles.astro brand colour → ${primary}`);

// 4. wrangler.jsonc — Worker name
let wrangler = existsSync(p('wrangler.jsonc')) ? read('wrangler.jsonc') : null;
if (wrangler != null)
  wrangler = replaceOnce(wrangler, /("name":\s*)"[^"]*"/, `$1"${workerName}"`, 'wrangler.jsonc name', summary);

// ── confirm + write ───────────────────────────────────────────────────────────
console.log(`\nPlanned changes:\n${summary.join('\n')}\n`);
const go = autoYes ? 'y' : (await ask('Write these changes? [y/N]', 'N')).toLowerCase();
rl.close();

if (go !== 'y' && go !== 'yes') {
  console.log('\nNo changes written.\n');
  process.exit(0);
}

writeFileSync(p('src/config/business.ts'), biz);
writeFileSync(p('src/config.yaml'), cfg);
writeFileSync(p('src/components/CustomStyles.astro'), styles);
if (wrangler != null) writeFileSync(p('wrangler.jsonc'), wrangler);

console.log(`
✓ Done. Next steps:
  1. Replace src/assets/images/default.png (1200×628 OG image) and src/assets/favicons/*
  2. Fill in the contact-form secrets in .env (see .env.example)
  3. Build pages with the widget library
  4. Before launch: enable indexing in config.yaml, then run  npm run check:golive
`);
