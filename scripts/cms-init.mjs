#!/usr/bin/env node
//
// Apply the live-editor migrations.
//
//   npm run cms:init             # the local D1 that `astro dev` uses
//   npm run cms:init -- --remote # the real database on Cloudflare
//
// This is a thin wrapper over `wrangler d1 migrations apply` that reads the
// database name out of wrangler.jsonc, so the name lives in exactly one place
// and a clone can't drift between the two.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const remote = process.argv.includes('--remote');

const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const match = raw.replace(/^\s*\/\/.*$/gm, '').match(/"database_name"\s*:\s*"([^"]+)"/);

if (!match) {
  console.error(
    'No D1 database found in wrangler.jsonc.\n\n' +
      'To turn the live page editor on:\n' +
      '  1. npx wrangler d1 create <site>-db\n' +
      '  2. uncomment the d1_databases block in wrangler.jsonc and paste the id\n' +
      '  3. set LIVE_EDITOR = true in astro.config.ts\n' +
      '  4. run this again\n\n' +
      'See docs/live-editor.md.'
  );
  process.exit(1);
}

const db = match[1];
console.log(`Applying migrations to "${db}" (${remote ? 'remote' : 'local'})…\n`);

try {
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', db, remote ? '--remote' : '--local'], {
    stdio: 'inherit',
  });
} catch {
  process.exit(1);
}

console.log(`\nDone. Create your login next:\n  npm run cms:user -- you@example.ie${remote ? ' --remote' : ''}\n`);
