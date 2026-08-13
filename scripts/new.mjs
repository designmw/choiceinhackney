#!/usr/bin/env node
/**
 * Scaffold a new content file.
 *
 *   npm run new -- service "Boiler Servicing"
 *   npm run new -- faq "What areas do you cover?"
 *   npm run new -- testimonial "Mary O'Sullivan"
 *   npm run new -- page "Areas We Cover"
 *
 * (The `--` is required so npm passes the args through.)
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [type, ...rest] = process.argv.slice(2);
const title = rest.join(' ').trim();

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
const yq = (s) => `'${String(s).replace(/'/g, "''")}'`; // YAML-safe single-quoted

if (!type || !title) {
  console.log('\nUsage: npm run new -- <service|faq|testimonial|page> "<name/question>"\n');
  process.exit(1);
}

const templates = {
  service: (t) => ({
    dir: 'src/data/services',
    file: `${slug(t)}.md`,
    body: `---\ntitle: ${yq(t)}\nexcerpt: 'One-line summary for the card and SEO.'\nicon: tabler:tool\norder: 10\nfeatures:\n  - First highlight\n  - Second highlight\n---\n\nFull description of ${t} in Markdown.\n`,
  }),
  faq: (t) => ({
    dir: 'src/data/faq',
    file: `${slug(t)}.md`,
    body: `---\nquestion: ${yq(t)}\nanswer: 'Replace with the answer.'\nicon: tabler:help\norder: 10\n---\n`,
  }),
  testimonial: (t) => ({
    dir: 'src/data/testimonials',
    file: `${slug(t)}.md`,
    body: `---\nname: ${yq(t)}\njob: 'Role, Town'\ntestimonial: 'Replace with the quote.'\nrating: 5\norder: 10\n---\n`,
  }),
  page: (t) => ({
    dir: 'src/pages',
    file: `${slug(t)}.astro`,
    body: `---\nimport Layout from '~/layouts/PageLayout.astro';\n\nconst metadata = {\n  title: '${t.replace(/'/g, "\\'")}',\n};\n---\n\n<Layout metadata={metadata}>\n  <section class="px-4 py-16 sm:px-6 mx-auto lg:px-8 lg:py-20 max-w-4xl">\n    <h1 class="font-bold font-heading text-4xl md:text-5xl tracking-tight">${t}</h1>\n    <p class="mt-4 text-muted">Add content here.</p>\n  </section>\n</Layout>\n`,
  }),
};

const gen = templates[type];
if (!gen) {
  console.log(`\n✖ Unknown type "${type}". Use: service | faq | testimonial | page\n`);
  process.exit(1);
}

const { dir, file, body } = gen(title);
const dirAbs = join(root, dir);
const fileAbs = join(dirAbs, file);
if (!existsSync(dirAbs)) mkdirSync(dirAbs, { recursive: true });
if (existsSync(fileAbs)) {
  console.log(`\n✖ ${dir}/${file} already exists — not overwriting.\n`);
  process.exit(1);
}
writeFileSync(fileAbs, body);
console.log(`\n✓ Created ${dir}/${file}\n`);
