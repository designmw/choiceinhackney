/**
 * Content contract, version 1.
 *
 * A page is an ordered list of typed blocks. The Magavani builder writes
 * files matching this schema into the site repo (src/data/pages/*.json)
 * and Astro validates and renders them at build time.
 *
 * This file is the single source of truth for the contract. An identical
 * copy lives in the builder repo at src/lib/contract/v1.ts. If you change
 * one, change the other and bump SCHEMA_VERSION on breaking changes.
 */
import { z } from 'astro/zod';

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Shared value shapes                                                 */
/* ------------------------------------------------------------------ */

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().default(''),
  /** Pixel dimensions. Required by the renderer for URL images (CLS). */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const actionSchema = z.object({
  /** Absent means the widget's own default applies (e.g. ContentRich uses primary). */
  variant: z.enum(['primary', 'secondary', 'tertiary', 'link']).optional(),
  text: z.string().min(1),
  href: z.string().min(1),
  icon: z.string().optional(),
  target: z.string().optional(),
});

export const itemSchema = z.object({
  title: z.string().optional(),
  /** Plain text or minimal inline HTML. */
  description: z.string().optional(),
  /** Icon name in the base's icon set, e.g. "tabler:tool". */
  icon: z.string().optional(),
  /** Optional link shown with the item (e.g. a "View more" link on a card). */
  callToAction: actionSchema.optional(),
});

export const testimonialSchema = z.object({
  title: z.string().optional(),
  testimonial: z.string().min(1),
  name: z.string().optional(),
  job: z.string().optional(),
  image: imageSchema.optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const priceSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  period: z.string().optional(),
  items: z.array(itemSchema).default([]),
  callToAction: actionSchema.optional(),
  hasRibbon: z.boolean().optional(),
  ribbonTitle: z.string().optional(),
});

export const inputSchema = z.object({
  type: z.string().default('text'),
  name: z.string().min(1),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  autocomplete: z.string().optional(),
});

/** Fields shared by every block. */
const blockBase = {
  /** Stable identifier assigned by the editor. Optional in hand-written files. */
  id: z.string().optional(),
  /** Renders the section on the dark background variant. */
  isDark: z.boolean().optional(),
};

/** Fields shared by every section headline. */
const headline = {
  tagline: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
};

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  ...blockBase,
  ...headline,
  /** Optional supporting HTML below the subtitle. */
  content: z.string().optional(),
  actions: z.array(actionSchema).default([]),
  image: imageSchema.optional(),
  /** Optional image gallery, for sites whose hero renders one. */
  gallery: z.array(imageSchema).optional(),
});

export const featuresBlockSchema = z.object({
  type: z.literal('features'),
  ...blockBase,
  ...headline,
  columns: z.number().int().min(1).max(4).default(3),
  items: z.array(itemSchema).default([]),
});

export const stepsBlockSchema = z.object({
  type: z.literal('steps'),
  ...blockBase,
  ...headline,
  items: z.array(itemSchema).default([]),
  image: imageSchema.optional(),
  isReversed: z.boolean().optional(),
});

export const contentBlockSchema = z.object({
  type: z.literal('content'),
  ...blockBase,
  ...headline,
  /** Sanitised HTML produced by the editor's rich text field. */
  content: z.string().optional(),
  image: imageSchema.optional(),
  items: z.array(itemSchema).default([]),
  isReversed: z.boolean().optional(),
  callToAction: actionSchema.optional(),
});

export const testimonialsBlockSchema = z.object({
  type: z.literal('testimonials'),
  ...blockBase,
  ...headline,
  items: z.array(testimonialSchema).default([]),
  callToAction: actionSchema.optional(),
});

export const faqsBlockSchema = z.object({
  type: z.literal('faqs'),
  ...blockBase,
  ...headline,
  columns: z.number().int().min(1).max(2).default(2),
  items: z.array(itemSchema).default([]),
});

export const statsBlockSchema = z.object({
  type: z.literal('stats'),
  ...blockBase,
  ...headline,
  items: z
    .array(
      z.object({
        amount: z.union([z.number(), z.string()]).optional(),
        title: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .default([]),
});

export const pricingBlockSchema = z.object({
  type: z.literal('pricing'),
  ...blockBase,
  ...headline,
  prices: z.array(priceSchema).default([]),
});

export const ctaBlockSchema = z.object({
  type: z.literal('cta'),
  ...blockBase,
  ...headline,
  actions: z.array(actionSchema).default([]),
});

export const brandsBlockSchema = z.object({
  type: z.literal('brands'),
  ...blockBase,
  ...headline,
  images: z.array(imageSchema).default([]),
});

export const contactBlockSchema = z.object({
  type: z.literal('contact'),
  ...blockBase,
  ...headline,
  inputs: z.array(inputSchema).optional(),
  textarea: z
    .object({
      label: z.string().optional(),
      name: z.string().optional(),
      placeholder: z.string().optional(),
      rows: z.number().int().optional(),
    })
    .optional(),
  button: z.string().optional(),
  description: z.string().optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  featuresBlockSchema,
  stepsBlockSchema,
  contentBlockSchema,
  testimonialsBlockSchema,
  faqsBlockSchema,
  statsBlockSchema,
  pricingBlockSchema,
  ctaBlockSchema,
  brandsBlockSchema,
  contactBlockSchema,
]);

export const BLOCK_TYPES = [
  'hero',
  'features',
  'steps',
  'content',
  'testimonials',
  'faqs',
  'stats',
  'pricing',
  'cta',
  'brands',
  'contact',
] as const;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export const pageMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ignoreTitleTemplate: z.boolean().optional(),
  canonical: z.string().optional(),
  robots: z
    .object({
      index: z.boolean().optional(),
      follow: z.boolean().optional(),
    })
    .optional(),
});

export const pageContractSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Page name shown in the editor and used as the default meta title. */
  title: z.string().min(1),
  /**
   * URL path override, e.g. "/" or "/about". When absent the path is
   * derived from the file name, with "home" mapping to "/".
   */
  path: z
    .string()
    .regex(
      /^\/[a-z0-9\-/]*$/,
      'path must start with / and contain only lowercase letters, numbers, hyphens and slashes'
    )
    .optional(),
  draft: z.boolean().default(false),
  metadata: pageMetadataSchema.default({}),
  blocks: z.array(blockSchema).default([]),
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ContractImage = z.infer<typeof imageSchema>;
export type ContractAction = z.infer<typeof actionSchema>;
export type ContractItem = z.infer<typeof itemSchema>;
export type HeroBlock = z.infer<typeof heroBlockSchema>;
export type FeaturesBlock = z.infer<typeof featuresBlockSchema>;
export type StepsBlock = z.infer<typeof stepsBlockSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type TestimonialsBlock = z.infer<typeof testimonialsBlockSchema>;
export type FaqsBlock = z.infer<typeof faqsBlockSchema>;
export type StatsBlock = z.infer<typeof statsBlockSchema>;
export type PricingBlock = z.infer<typeof pricingBlockSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type BrandsBlock = z.infer<typeof brandsBlockSchema>;
export type ContactBlock = z.infer<typeof contactBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block['type'];
export type PageContract = z.infer<typeof pageContractSchema>;

/** Derives the public URL path for a page file, e.g. "home" becomes "/". */
export function pagePathFromId(id: string, page: Pick<PageContract, 'path'>): string {
  if (page.path) return page.path;
  const slug = id.replace(/\.json$/, '');
  return slug === 'home' || slug === 'index' ? '/' : `/${slug}`;
}
