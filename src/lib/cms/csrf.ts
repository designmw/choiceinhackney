// Cross-site request forgery protection for the authenticated admin.
//
// Why this exists rather than Astro's built-in `security.checkOrigin`:
// checkOrigin compares Origin against the origin the *server* believes it has,
// which behind a proxy is not the hostname the browser used. This compares
// against the forwarded host instead — the part that breaks generically.
//
// It only matters because there is now a cookie-authenticated admin. Every
// other POST route on these sites is anonymous and validates its input, so
// forging one achieves nothing. A signed-in editor's browser, however, will
// attach their session cookie to a request another site causes it to make, and
// "revert all the copy on the homepage" is exactly what CSRF is for.
//
// SameSite=Lax on the session cookie already blocks cross-site POSTs in current
// browsers. This is deliberately a second layer: Lax is a browser-side
// guarantee that varies by client and version, and the cost of not relying
// solely on it is about twenty lines.

/** Methods that can change state. GET/HEAD/OPTIONS are exempt. */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths this applies to — everything behind the admin session. */
export const needsCsrfCheck = (pathname: string): boolean =>
  pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export interface CsrfResult {
  ok: boolean;
  reason?: string;
}

/**
 * Decide whether a request may change state.
 *
 * Accepts when the request's Origin (or, failing that, Referer) names the same
 * host the request arrived at. Rejects when neither header is present: a browser
 * always sends Origin on a cross-origin form POST and on every fetch, so a
 * missing one on an unsafe method is either a non-browser client — which has no
 * business driving the admin — or an attempt to dodge the check.
 */
export function checkCsrf(request: Request): CsrfResult {
  if (!UNSAFE.has(request.method.toUpperCase())) return { ok: true };

  const headers = request.headers;

  // Behind Cloudflare the request URL's host can be an internal address, so
  // trust the forwarded host the proxy sets, then the Host header.
  const expected = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').toLowerCase();
  if (!expected) return { ok: false, reason: 'no host header to compare against' };

  const origin = hostOf(headers.get('origin'));
  if (origin) {
    return origin === expected ? { ok: true } : { ok: false, reason: `origin ${origin} ≠ ${expected}` };
  }

  // Some browsers historically omitted Origin on same-origin form posts.
  const referer = hostOf(headers.get('referer'));
  if (referer) {
    return referer === expected ? { ok: true } : { ok: false, reason: `referer ${referer} ≠ ${expected}` };
  }

  return { ok: false, reason: 'no Origin or Referer header' };
}
