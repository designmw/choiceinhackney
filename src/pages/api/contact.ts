export const prerender = false;

import type { APIRoute } from 'astro';
import { business } from '~/config/business';
import { recordSubmission, markDelivered } from '~/lib/cms/submissions';

// Cloudflare Workers runtime env: vars and secrets set in the Cloudflare
// dashboard or via `wrangler secret put` — rotatable without a rebuild.
// Imported lazily (and Vite-ignored) because `cloudflare:workers` is a
// Workers-only virtual module the Node dev server can't resolve; in dev we
// fall back to build-time env from import.meta.env.
const spec = 'cloudflare:workers';
const cfMod = await import(/* @vite-ignore */ spec).catch(() => ({}) as Record<string, unknown>);

// `env` must be read lazily, per request. Snapshotting `cfMod.env` into a plain
// object at module scope captures it before the runtime populates it, so
// wrangler `vars` silently vanish and build-time .env values win instead.
// Astro v6 removed Astro.locals.runtime.env, so this module is the only source.
const runtimeEnv = new Proxy({} as Record<string, unknown>, {
  get: (_t, key: string) => (cfMod as { env?: Record<string, unknown> }).env?.[key],
});

/** Runtime var/secret first, then build-time env (so `astro dev` still works). */
const envOf = (key: string): string | undefined =>
  (runtimeEnv[key] as string | undefined) ?? (import.meta.env as Record<string, string | undefined>)[key];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Verify a Cloudflare Turnstile token against the siteverify API. Only enforced
// when TURNSTILE_SECRET_KEY is configured, so the form still works without it.
async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = envOf('TURNSTILE_SECRET_KEY');
  if (!secret) return true; // Turnstile not configured — skip the check
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret: String(secret), response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return false;
  }
}

/**
 * Per-IP rate limit (Cloudflare rate-limiting binding, see wrangler.jsonc).
 * Every submission costs two Brevo sends, so an unmetered endpoint is both a
 * billing risk and — because the acknowledgement goes to an address the caller
 * chose — a way to push mail at a third party. No-op if the binding is absent
 * (local `astro dev`), so the form still works in development.
 */
async function withinRateLimit(request: Request): Promise<boolean> {
  const limiter = runtimeEnv.CONTACT_RATE_LIMIT as unknown as
    { limit: (opts: { key: string }) => Promise<{ success: boolean }> } | undefined;
  if (!limiter?.limit) return true;

  const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (err) {
    console.error('Rate limiter error (allowing request):', err);
    return true;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  if (!(await withinRateLimit(request))) {
    return new Response(JSON.stringify({ error: 'Too many messages from this address. Please try again shortly.' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  // Honeypot: silently succeed if a bot filled the hidden field
  if (body.website) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // Cloudflare Turnstile (no-op unless TURNSTILE_SECRET_KEY is set)
  const turnstileToken = String(body['cf-turnstile-response'] ?? '');
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (!(await verifyTurnstile(turnstileToken, remoteIp))) {
    return new Response(JSON.stringify({ error: 'Bot check failed. Please try again.' }), { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const message = String(body.message ?? '').trim();

  if (phone.length > 50) {
    return new Response(JSON.stringify({ error: 'Please enter a valid phone number.' }), { status: 400 });
  }
  if (!name || name.length > 200) {
    return new Response(JSON.stringify({ error: 'Please enter your name.' }), { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), { status: 400 });
  }
  if (!message || message.length > 5000) {
    return new Response(JSON.stringify({ error: 'Please enter your message (max 5,000 characters).' }), {
      status: 400,
    });
  }

  // Prefer Cloudflare runtime vars/secrets; fall back to build-time env
  // (.env files) so local `astro dev` keeps working unchanged.
  const apiKey = envOf('BREVO_API_KEY');
  const senderEmail = envOf('BREVO_SENDER_EMAIL');
  const senderName = (envOf('BREVO_SENDER_NAME') ?? business.name) as string;
  const toEmail = (envOf('CONTACT_TO_EMAIL') ?? business.email) as string;
  const toName = (envOf('CONTACT_TO_NAME') ?? business.name) as string;

  // Store the enquiry BEFORE attempting to send it.
  //
  // The order is the whole point. An enquiry that exists only as an email is
  // lost entirely when Brevo is down, the API key has expired or the recipient
  // address bounces — and lost silently, because nobody knows a message was
  // ever sent. Writing it first means the site holds the record and the email
  // becomes the notification rather than the storage. `delivered` is then set
  // from the result below, so a failed send is visible in /admin/messages
  // instead of invisible everywhere.
  //
  // Returns null (and never throws) when the CMS database isn't configured, so
  // a site without the editor behaves exactly as it did before.
  const submissionId = await recordSubmission({
    name,
    email,
    phone,
    message,
    page: String(body.page ?? request.headers.get('referer') ?? '').slice(0, 300),
  });

  if (!apiKey || !senderEmail || !toEmail) {
    console.error('Contact form: missing BREVO_API_KEY, BREVO_SENDER_EMAIL, or CONTACT_TO_EMAIL');
    return new Response(JSON.stringify({ error: 'Mail service not configured. Please contact us directly.' }), {
      status: 503,
    });
  }

  const htmlContent = `
    <h2>New enquiry from ${escapeHtml(business.name)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        replyTo: { email, name },
        subject: `New enquiry from ${business.name}`,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Brevo API error:', res.status, errText);
      await markDelivered(submissionId, false);
      return new Response(JSON.stringify({ error: 'Failed to send. Please try again.' }), { status: 502 });
    }

    await markDelivered(submissionId, true);

    // Auto-reply to the customer (best-effort — never fails the request).
    //
    // The recipient is an address the CALLER supplied and we cannot verify, so
    // this message must never carry caller-authored content: quoting the
    // submitted message back would turn the form into a way to send arbitrary
    // text to any inbox, signed by our verified sender. Fixed wording only, and
    // the greeting name is truncated so it can't smuggle a sentence.
    const greetingName = name.slice(0, 60);
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey as string, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email, name }],
          subject: `Thanks for contacting ${business.name}`,
          htmlContent: `
            <p>Hi ${escapeHtml(greetingName)},</p>
            <p>Thanks for getting in touch with ${escapeHtml(business.name)} — we've received your message and will get back to you as soon as we can.</p>
            <p>If you did not contact us, you can safely ignore this email.</p>
            <p>Kind regards,<br>${escapeHtml(business.name)}</p>
          `,
        }),
      });
    } catch (replyErr) {
      console.error('Auto-reply failed (enquiry still delivered):', replyErr);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Contact form error:', err);
    await markDelivered(submissionId, false);
    return new Response(JSON.stringify({ error: 'Failed to send. Please try again.' }), { status: 500 });
  }
};
