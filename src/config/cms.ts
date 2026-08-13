// What the admin dashboard offers on this site.
//
// The live editor and enquiries suit every site this template builds, so they
// are always on. Portals are not: most local-business sites have no gated
// document area, and showing an empty "Portals" tab to a plumber is clutter.
//
// Keep this list short. A flag here should mean "this site has a thing the
// others don't", not "this feature is half-finished".

export const cms = {
  /**
   * A gated document area (e.g. a staff or trustee portal).
   *
   * Turning this on adds portal management to /admin, but it does NOT
   * authenticate anyone — the portal routes are protected by Cloudflare Access
   * at the edge, and that is the only thing standing between the public and
   * these documents. See docs/live-editor.md before enabling it on a new site.
   */
  portals: {
    enabled: false,
    /**
     * Each gated area: `slug` must match the route prefix (/staff, /trustee),
     * because the Cloudflare Access policy is bound to that path.
     */
    areas: [] as { slug: string; label: string }[],
  },
};

export type CmsConfig = typeof cms;
