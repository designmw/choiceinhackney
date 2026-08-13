#!/usr/bin/env node
//
// Create or update a live-editor login.
//
// The first account has to be made from here — there is no sign-up page, and
// /admin/users needs an admin to already exist. After that, accounts are
// normally added in the browser.
//
//   npm run cms:user -- tommy@designmywebsite.ie            # local, prints a password
//   npm run cms:user -- tommy@designmywebsite.ie --remote   # against the live D1
//   npm run cms:user -- tommy@designmywebsite.ie --password 'chosen-one'
//   npm run cms:user -- helper@client.ie --role viewer   # read-only account
//
// Passwords are generated and printed once rather than defaulted to something
// memorable: a shared default that reaches production is how a client site ends
// up with a guessable admin login.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;

const argv = process.argv.slice(2);

// Walk once, so a flag's value is never mistaken for the positional email
// argument (`--role editor` must not make "editor" the address).
const BOOLEAN_FLAGS = new Set(['remote']);
const flags = {};
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }
  const name = arg.slice(2);
  if (BOOLEAN_FLAGS.has(name)) flags[name] = true;
  else flags[name] = argv[++i];
}

const flag = (name) => flags[name];

const email = positional[0];
const remote = Boolean(flags.remote);
// Only two roles exist. Anything unrecognised becomes a viewer rather than an
// admin, so a typo can never create an account with more power than intended.
const roleArg = flag('role');
const role = roleArg === undefined ? 'admin' : roleArg === 'admin' ? 'admin' : 'viewer';
const firstName = flag('first') ?? '';
const lastName = flag('last') ?? '';

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run cms:user -- <email> [--role admin|viewer] [--password <pw>] [--remote]');
  process.exit(1);
}

/** Matches the hash format in src/lib/cms/auth.ts: pbkdf2$<iterations>$<salt>$<hash>. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Readable but not guessable — this gets typed by hand or pasted from a message. */
function generatePassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(20))
    .map((b) => alphabet[b % alphabet.length])
    .join('')
    .replace(/(.{5})(?=.)/g, '$1-');
}

/** The database name from wrangler.jsonc, so this script needs no second copy of it. */
function databaseName() {
  const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  // Strip // comments so the JSONC parses. Crude, but wrangler.jsonc has no
  // string containing '//' other than in URLs inside comments.
  const json = raw.replace(/^\s*\/\/.*$/gm, '');
  const match = json.match(/"database_name"\s*:\s*"([^"]+)"/);
  if (!match) {
    console.error(
      'No D1 database found in wrangler.jsonc.\n' +
        'Uncomment the d1_databases block there (and set LIVE_EDITOR = true in astro.config.ts) first.'
    );
    process.exit(1);
  }
  return match[1];
}

const password = flag('password') ?? generatePassword();
const generated = !flag('password');
const hash = hashPassword(password);
const db = databaseName();

// Single-quoted SQL literals, with any embedded quote doubled — the values are
// an email address and a hex hash, but escaping is cheaper than assuming.
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

const sql = `
INSERT INTO cms_users (email, first_name, last_name, role, password_hash)
VALUES (${q(email)}, ${q(firstName)}, ${q(lastName)}, ${q(role)}, ${q(hash)})
ON CONFLICT(email) DO UPDATE SET
  role = excluded.role,
  password_hash = excluded.password_hash;
`.trim();

try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', db, remote ? '--remote' : '--local', '--command', sql], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} catch {
  console.error(`\nCould not write to "${db}". If the tables don't exist yet, run: npm run cms:init`);
  process.exit(1);
}

console.log(`\n  ${remote ? 'Live' : 'Local'} login ready\n`);
console.log(`  Sign in at  ${remote ? 'https://<your-domain>' : 'http://localhost:4321'}/admin`);
console.log(`  Email       ${email}`);
if (generated) {
  console.log(`  Password    ${password}`);
  console.log(`\n  This password is shown once and is not stored anywhere in readable form.`);
} else {
  console.log(`  Password    (the one you passed in)`);
}
console.log(`  Role        ${role === 'admin' ? 'full administrator' : 'can view and download files'}\n`);
