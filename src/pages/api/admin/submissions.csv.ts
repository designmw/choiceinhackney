export const prerender = false;

import type { APIRoute } from 'astro';
import { requireUser, isAdmin } from '~/lib/cms/auth';
import { listSubmissions, toCsv } from '~/lib/cms/submissions';

/**
 * Export the enquiries currently being looked at.
 *
 * The filter and search terms come straight from the page's own query string,
 * so the file matches what is on screen. "Export" that quietly hands back
 * everything, ignoring the filter someone just set, is the behaviour that makes
 * people distrust a CSV button.
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  const user = await requireUser(cookies);
  if (!user) return new Response('Not signed in', { status: 401 });
  // Enquiries are personal data. A viewer account has no business exporting them.
  if (!isAdmin(user)) return new Response('Not allowed', { status: 403 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status = statusParam === 'new' || statusParam === 'handled' ? statusParam : 'all';

  // No pagination on the export: the point of a spreadsheet is that it holds
  // the lot. 5,000 is a backstop against generating an enormous response, not
  // an expected limit for a local charity's contact form.
  const rows = await listSubmissions({ status, search: url.searchParams.get('q') ?? '', limit: 5000 });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="enquiries-${stamp}.csv"`,
      // Personal data: never let a shared cache hold a copy.
      'Cache-Control': 'private, no-store',
    },
  });
};
