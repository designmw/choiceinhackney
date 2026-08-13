# Page recipes

Ready-made page compositions built from the widget library. **Copy** one into
`src/pages/` and edit the copy — don't wire pages up from a blank file.

```bash
cp src/recipes/home.astro src/pages/index.astro
cp src/recipes/about.astro src/pages/about.astro
```

These files live outside `src/pages/`, so they are **not routes** — but they are
still type-checked by `astro check`, so they stay valid as the widgets evolve.

- `home.astro` — full local-SME homepage: Hero → Features → Steps → Testimonials → FAQs → CTA
- `about.astro` — About page: HeroText → Content → Features → CTA

Testimonials and FAQs are data-driven (`TestimonialsData` / `FaqsData`) — they
read from `src/data/testimonials/` and `src/data/faq/`, so you edit content, not
markup.
