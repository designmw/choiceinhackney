import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { pageContractSchema } from '~/contract/v1';

const metadataDefinition = () =>
  z
    .object({
      title: z.string().optional(),
      ignoreTitleTemplate: z.boolean().optional(),

      canonical: z.url().optional(),

      robots: z
        .object({
          index: z.boolean().optional(),
          follow: z.boolean().optional(),
        })
        .optional(),

      description: z.string().optional(),

      openGraph: z
        .object({
          url: z.string().optional(),
          siteName: z.string().optional(),
          images: z
            .array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
              })
            )
            .optional(),
          locale: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),

      twitter: z
        .object({
          handle: z.string().optional(),
          site: z.string().optional(),
          cardType: z.string().optional(),
        })
        .optional(),
    })
    .optional();

const postCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/post' }),
  schema: z.object({
    publishDate: z.date().optional(),
    updateDate: z.date().optional(),
    draft: z.boolean().optional(),

    title: z.string(),
    excerpt: z.string().optional(),
    image: z.string().optional(),

    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),

    metadata: metadataDefinition(),
  }),
});

// Data-driven service pages. Drop a Markdown file in src/data/services/ and it
// becomes /services/<filename> with its own page, ServiceSchema, and a card on
// the services index — no hand-built pages per service.
const serviceCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/services' }),
  schema: z.object({
    title: z.string(),
    /** Short summary shown on the services index card + used as the meta description fallback */
    excerpt: z.string().optional(),
    /** Tabler icon name for the card, e.g. "tabler:flame" */
    icon: z.string().optional(),
    image: z.string().optional(),
    /** Sort order on the index (lower first) */
    order: z.number().optional(),
    draft: z.boolean().optional(),
    /** Optional bullet list of what the service includes */
    features: z.array(z.string()).optional(),
    metadata: metadataDefinition(),
  }),
});

// Data-driven testimonials. One Markdown file per testimonial in
// src/data/testimonials/ → a card via <TestimonialsData />. Optional rating
// shows a star row; set business.aggregateRating (real) for ⭐ in Google.
const testimonialCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/testimonials' }),
  schema: z.object({
    name: z.string(),
    /** Role + place, e.g. "Homeowner, Tralee" */
    job: z.string().optional(),
    testimonial: z.string(),
    /** 1–5; renders a star row when set */
    rating: z.number().min(1).max(5).optional(),
    image: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Data-driven FAQs. One Markdown file per question in src/data/faq/ →
// rendered by <FaqsData /> which also emits FAQPage JSON-LD automatically.
const faqCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/faq' }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    icon: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Editor-managed pages (content contract v1). One JSON file per page in
// src/data/pages/, written by the visual editor and rendered by
// src/pages/[...page].astro through BlockRenderer. Hand-written files are
// equally valid; the schema is the contract.
const pageCollection = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/data/pages' }),
  schema: pageContractSchema,
});

export const collections = {
  post: postCollection,
  service: serviceCollection,
  testimonial: testimonialCollection,
  faq: faqCollection,
  page: pageCollection,
};
