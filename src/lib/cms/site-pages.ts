// Which pages an editor can be pointed at.
//
// Boston's version of this admin hand-listed its editable pages, and its own
// decision brief called that out as the weak spot: "editable regions aren't
// discoverable… every new editable region is a developer task". That is true of
// the *regions*, but it doesn't have to be true of the pages.
//
// The site already keeps a per-client list of its own pages — src/navigation.ts,
// which every clone fills in during setup because the header and footer are
// built from it. Reading that gives the admin an accurate page list with no
// second registry to maintain and nothing to forget to update: add a page to
// the nav and it appears here.
//
// It isn't exhaustive by construction — a page nobody links to won't be listed.
// That's an acceptable floor: an editor can add ?edit=1 to any URL on the site
// and the editor bar appears, so this list is a convenience, not the gate.

import { headerData, footerData } from '~/navigation';
import { pageSlug } from './editable';

export interface SitePage {
  label: string;
  path: string;
  slug: string;
}

interface NavLink {
  text?: string;
  href?: string;
  links?: NavLink[];
}

/** Skip anything that isn't a page on this site. */
function isInternalPage(href: string | undefined): href is string {
  if (!href) return false;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return false;
  return href.startsWith('/');
}

function collect(links: NavLink[] | undefined, into: Map<string, SitePage>): void {
  for (const link of links ?? []) {
    collect(link.links, into);
    if (!isInternalPage(link.href)) continue;

    // Normalise so '/about/' and '/about' don't become two entries.
    const path = link.href.replace(/\/+$/, '') || '/';
    if (into.has(path)) continue;

    into.set(path, { label: link.text?.trim() || path, path, slug: pageSlug(path) });
  }
}

/** Every internal page reachable from the header or footer navigation. */
export function sitePages(): SitePage[] {
  const found = new Map<string, SitePage>();

  collect(headerData?.links as NavLink[] | undefined, found);
  for (const column of (footerData?.links ?? []) as NavLink[]) collect(column.links, found);
  collect(footerData?.secondaryLinks as NavLink[] | undefined, found);

  // Home first, then alphabetically — the order a person looks for them in,
  // rather than the order the nav happens to be written in.
  return [...found.values()].sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.label.localeCompare(b.label);
  });
}
