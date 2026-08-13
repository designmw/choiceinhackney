// Makes hand-written page copy editable without touching the page files.
//
// The <Editable> component covers anything rendered through a shared widget.
// But plenty of pages hand-write their own <section> blocks with inline <h2>
// and <p>, and those would stay uneditable — so "every page is editable" would
// really mean "the parts that happened to use a shared widget are editable".
// Wrapping them by hand across a whole site is a lot of mechanical edits to
// make once and then maintain forever.
//
// Instead this rewrites the rendered HTML on the way out: find text-only
// headings and paragraphs inside <main>, derive a key from the text, swap in an
// override if one exists, and tag the element when an editor is on the page.
//
// Why the key stays stable, which is the part that matters:
//
//   The template always renders the ORIGINAL copy — it knows nothing about
//   overrides. So the text this sees is always the source text, even for a
//   region that has been edited a dozen times. The key is therefore derived
//   from something that only changes when a developer edits the .astro file,
//   not when an editor changes the words.
//
// Deliberately conservative. It only touches elements whose content is plain
// text with no nested markup, which keeps it away from anything structural. An
// element it skips is simply not editable — never broken.

import { regionKeyFrom } from './editable';

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * A stable key for an image.
 *
 * NOT derived from the src, which is the obvious choice and the wrong one:
 * Astro fingerprints built assets, so `/_astro/banner.CZ816Hke_aKB0F.jpg`
 * becomes a different URL on the next deploy and every image override would
 * silently orphan itself. The alt text is authored in the .astro file and only
 * changes when a developer edits it, exactly like the text regions.
 *
 * Where there is no alt (decorative images), the filename with its fingerprint
 * stripped is the next most stable thing available.
 */
function imageKeyFrom(alt: string, src: string, seen: Set<string>): string {
  const basis =
    alt.trim() ||
    // '/_astro/homepage-banner.CZ816Hke_aKB0F.jpg' → 'homepage-banner'
    (src.split('?')[0].split('/').pop() ?? '').split('.')[0] ||
    'image';

  return regionKeyFrom(basis, 'img', seen);
}

/** Elements worth making editable. Headings and paragraphs, nothing structural. */
const TAG_PATTERN = /<(h1|h2|h3|h4|p)(\s[^>]*)?>([^<>]+)<\/\1>/gi;

/** Images. Void element, so this matches the tag rather than a pair. */
const IMG_PATTERN = /<img(\s[^>]*)?>/gi;

/** Ignore boilerplate and fragments too short to be real copy. */
const MIN_LENGTH = 3;

/** Pull one attribute out of a raw tag's attribute string. */
function attr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[2] ?? match[3] ?? '') : null;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface AutoEditableOptions {
  slug: string;
  overrides: Record<string, string>;
  editing: boolean;
}

/**
 * Rewrite a rendered page so its plain-text headings and paragraphs pick up
 * stored overrides, and carry edit handles when an editor is viewing.
 *
 * Returns the HTML unchanged when there is nothing to do, so a public request
 * for an unedited page pays only for the <main> scan.
 */
export function applyAutoEditable(html: string, { slug, overrides, editing }: AutoEditableOptions): string {
  // Nothing stored and nobody editing: the transform can only produce identical
  // output, so skip the work entirely.
  if (!editing && Object.keys(overrides).length === 0) return html;

  // Confine the rewrite to <main>. The header, nav and footer are shared
  // furniture — editing them from one page would silently change every page,
  // which is not what someone clicking a heading expects.
  const start = html.search(/<main[\s>]/i);
  if (start === -1) return html;
  const end = html.indexOf('</main>', start);
  if (end === -1) return html;

  const before = html.slice(0, start);
  const main = html.slice(start, end);
  const after = html.slice(end);

  const seen = new Set<string>();

  const imagesSeen = new Set<string>();

  const withImages = main.replace(IMG_PATTERN, (whole, attrs: string = '') => {
    const src = attr(attrs, 'src');
    if (!src) return whole;

    // Data URIs are inline SVGs and spacers, not content.
    if (/^data:/i.test(src)) return whole;

    const key = `${slug}:${imageKeyFrom(attr(attrs, 'alt') ?? '', src, imagesSeen)}`;
    const stored = overrides[key];

    if (stored === undefined && !editing) return whole;

    let updated = attrs;

    if (stored !== undefined) {
      updated = updated.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*')/i, `src="${escapeAttr(stored)}"`);

      // srcset wins over src in every browser, so leaving Astro's generated one
      // in place would show the ORIGINAL image while the src pointed at the new
      // one — an edit that saves, reports success, and visibly does nothing.
      updated = updated.replace(/\s\bsrcset\s*=\s*("[^"]*"|'[^']*')/gi, '');
      updated = updated.replace(/\s\bsizes\s*=\s*("[^"]*"|'[^']*')/gi, '');
    }

    if (editing) updated += ` data-editable-image="${key}"`;

    return `<img${updated}>`;
  });

  const rewritten = withImages.replace(TAG_PATTERN, (whole, tag: string, attrs: string = '', text: string) => {
    // Already handled by <Editable> — leave it completely alone, or the two
    // mechanisms would fight over the same element.
    if (/\bdata-editable\b/i.test(attrs)) return whole;

    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH) return whole;

    // Entity-bearing text is skipped: the key would be derived from the encoded
    // form while the editor would send back the decoded form, so a save could
    // never match its own region again.
    if (/&[a-z#0-9]+;/i.test(trimmed)) return whole;

    // The key must be issued for every candidate element, including ones with
    // no override and no editor present — the counter in `seen` is what keeps
    // two identically-worded sections apart, and skipping elements early would
    // shift every later key on the page.
    const key = `${slug}:${regionKeyFrom(trimmed, tag.toLowerCase(), seen)}`;
    const stored = overrides[key];

    if (stored === undefined && !editing) return whole;

    const content = stored === undefined ? text : escapeHtml(stored);
    const handle = editing ? ` data-editable="${key}"` : '';

    return `<${tag}${attrs}${handle}>${content}</${tag}>`;
  });

  return before + rewritten + after;
}
