# Design & Tailwind standards

Standing rules for every client build in this repo. Follow these automatically.

---

## The core rule

**Never hardcode a value that Tailwind or the design system already provides.**  
If you find yourself writing `w-[1100px]`, `text-[17px]`, `mt-[32px]`, `bg-[#1a73e8]`, or `font-[600]` — stop and use the scale instead.

Arbitrary values (`[…]`) are allowed only for genuine one-offs that do not exist anywhere in the scale (e.g. a specific clip-path, a background SVG URL, a unique aspect ratio). If the same arbitrary value appears twice, it belongs in `tailwind.css` as a theme token or utility.

---

## Layout and width

### Use max-width + auto margins, never fixed widths

```astro
<!-- Wrong -->
<div class="w-[1100px] mx-auto">
  <!-- Right -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"></div>
</div>
```

### Standard content widths

| Class       | px equiv | Use for                           |
| ----------- | -------- | --------------------------------- |
| `max-w-7xl` | 1280px   | Full-width sections, site wrapper |
| `max-w-6xl` | 1152px   | Wide content areas                |
| `max-w-5xl` | 1024px   | Mid-width grids                   |
| `max-w-4xl` | 896px    | Article/blog content              |
| `max-w-3xl` | 768px    | Narrow prose                      |
| `max-w-2xl` | 672px    | Forms, narrow cards               |
| `max-w-xl`  | 576px    | Short-form content                |

### Always pair max-width with responsive padding

```astro
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"></div>
```

### Use WidgetWrapper for page sections

The `WidgetWrapper` component already handles the container, vertical padding, and background. Use it rather than reimplementing those styles:

```astro
<WidgetWrapper id="services" isDark={false} containerClass="max-w-6xl">
  <!-- section content -->
</WidgetWrapper>
```

---

## Spacing

Use the Tailwind spacing scale. Every step is a multiple of 4px.

```
1 = 4px   2 = 8px   3 = 12px   4 = 16px   6 = 24px
8 = 32px  10 = 40px  12 = 48px  16 = 64px  20 = 80px  24 = 96px
```

```astro
<!-- Wrong -->
<div class="mt-[32px] mb-[48px] gap-[24px]">
  <!-- Right -->
  <div class="mt-8 mb-12 gap-6"></div>
</div>
```

Use `gap-*` on flex/grid containers rather than margins between siblings:

```astro
<!-- Wrong -->
<div class="flex">
  <div class="mr-4">…</div>
  <div class="mr-4">…</div>
</div>

<!-- Right -->
<div class="flex gap-4">
  <div>…</div>
  <div>…</div>
</div>
```

---

## Colour

### Use design token utilities — never hardcode hex or rgb

The project exposes these Tailwind utilities backed by CSS variables:

| Utility          | Variable                  | Use for                   |
| ---------------- | ------------------------- | ------------------------- |
| `bg-page`        | `--aw-color-bg-page`      | Page/section background   |
| `bg-dark`        | `--aw-color-bg-page-dark` | Dark section backgrounds  |
| `text-muted`     | `--aw-color-text-muted`   | Secondary/supporting text |
| `text-primary`   | `--aw-color-primary`      | Primary brand colour text |
| `bg-primary`     | `--aw-color-primary`      | Primary brand colour fill |
| `text-secondary` | `--aw-color-secondary`    | Secondary brand colour    |
| `text-accent`    | `--aw-color-accent`       | Accent highlights         |
| `text-default`   | `--aw-color-text-default` | Body text                 |

```astro
<!-- Wrong -->
<p class="text-[#101010]/66">Supporting text</p>
<div class="bg-[rgb(1,97,239)]">Button</div>

<!-- Right -->
<p class="text-muted">Supporting text</p>
<div class="bg-primary">Button</div>
```

### Changing brand colours per client

Edit `src/components/CustomStyles.astro` — change the CSS variable values only. Do not add new Tailwind classes:

```css
:root {
  --aw-color-primary: rgb(220 38 38); /* client red */
  --aw-color-secondary: rgb(185 28 28);
  --aw-color-accent: rgb(234 179 8);
}
```

### Dark mode

**Client sites ship light-only.** `ui.theme` is `light:only` in `src/config.yaml`, so the `dark` class is never applied, the nav carries no theme toggle, and a visitor's OS dark-mode preference is ignored. Design and review every page in light mode — that is the only mode anyone will see.

The `dark:` variants throughout the theme are kept, not dead weight: they are what makes dark mode a one-line switch if a client wants it. So when you write a new component, still pair a light utility with its dark counterpart, using the variable-backed utilities first:

```astro
<p class="text-default dark:text-slate-300">
  <div class="bg-page dark:bg-dark"></div>
</p>
```

To turn dark mode on for a build: set `ui.theme: 'system'` in `src/config.yaml` and add `showToggleTheme` back to the `<Header>` in `src/layouts/PageLayout.astro`. Both are needed — the config alone controls whether the toggle can render at all.

---

## Typography

### Use the type scale — never pixel sizes

```astro
<!-- Wrong -->
<h2 class="text-[36px] font-[700]">
  <!-- Right -->
  <h2 class="text-3xl md:text-4xl font-bold font-heading"></h2>
</h2>
```

### Common patterns

```astro
<!-- Page heading (H1) -->
<h1 class="font-bold font-heading text-4xl md:text-5xl tracking-tight">
  <!-- Section heading (H2) -->
  <h2 class="font-bold font-heading text-3xl md:text-4xl">
    <!-- Card heading (H3) -->
    <h3 class="font-semibold text-xl">
      <!-- Body text -->
      <p class="text-base text-default">
        <!-- Supporting / caption -->
        <p class="text-sm text-muted">
          <!-- Tagline above heading -->
          <p class="text-sm font-semibold tracking-wide uppercase text-primary"></p>
        </p>
      </p>
    </h3>
  </h2>
</h1>
```

### One colour per heading — no multi-coloured headings

A heading is one block of text in one colour. Do not split a headline across two colours by wrapping part of it in a coloured `<span>` (brand green on line two, black on lines one and three, and so on). It reads as a template flourish, it fights the brand colour used for links and buttons, and it makes the headline harder to scan.

```astro
<!-- Wrong — headline split into brand colour mid-sentence -->
<h1 class="font-bold font-heading text-4xl md:text-5xl">
  Stonemason Kerry:
  <span class="text-accent">traditional stonework</span>
  &amp; restoration
</h1>

<!-- Right — one colour, hierarchy carried by size and weight -->
<h1 class="font-bold font-heading text-4xl md:text-5xl tracking-tight text-heading">
  Stonemason Kerry: traditional stonework &amp; restoration
</h1>
```

- Headings use `text-heading` (or the inherited default). Save the brand colour for links, buttons, icons, and the `tagline` eyebrow above the heading.
- If a phrase genuinely needs emphasis, shorten the headline or move the phrase into the subtitle — don't recolour it.
- Same rule applies to gradient-text headings.

### Fonts

`font-sans` — body text (Inter Variable by default)  
`font-heading` — all headings  
`font-serif` — only if the client brand calls for it

To change the font per client: install the font package (e.g. `@fontsource-variable/poppins`), import it in `CustomStyles.astro`, and update the `--aw-font-*` variables. Do not change the Tailwind class names.

---

## Responsive design

### Mobile-first always

Write base styles for mobile, then layer up with breakpoint prefixes:

```astro
<!-- Wrong — desktop-first -->
<div class="grid grid-cols-3 sm:grid-cols-1">
  <!-- Right — mobile-first -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"></div>
</div>
```

### Breakpoint reference

| Prefix   | Min-width | Typical target             |
| -------- | --------- | -------------------------- |
| _(none)_ | 0px       | Mobile                     |
| `sm:`    | 640px     | Large phone / small tablet |
| `md:`    | 768px     | Tablet                     |
| `lg:`    | 1024px    | Desktop                    |
| `xl:`    | 1280px    | Wide desktop               |
| `2xl:`   | 1536px    | Very wide (use sparingly)  |

### Showing/hiding elements

```astro
<span class="hidden md:inline">Full label</span>
<span class="md:hidden">Short</span>
```

Never use inline styles or arbitrary media queries for this.

---

## Grid and flex

### Prefer grid for 2D layouts, flex for 1D

```astro
<!-- Card grids -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Horizontal nav / button rows -->
  <div class="flex flex-wrap items-center gap-4">
    <!-- Vertical stacks -->
    <div class="flex flex-col gap-4"></div>
  </div>
</div>
```

### Do not control grid/flex child widths with arbitrary values

```astro
<!-- Wrong -->
<div class="w-[calc(33.333%-1rem)]">
  <!-- Right — let the grid do it -->
  <div class="grid grid-cols-3 gap-4">
    <div>…</div>
  </div>
</div>
```

---

## Buttons

Use the built-in button utilities — they are already wired to the brand colour tokens and handle dark mode, focus rings, and hover states:

```astro
import Button from '~/components/ui/Button.astro';

<Button variant="primary" href="/contact">Get in touch</Button>
<Button variant="secondary" href="/services">Our services</Button>
```

Or directly with utilities:

```astro
<a class="btn-primary" href="/contact">Get in touch</a>
<a class="btn" href="/services">Our services</a>
```

Do not recreate button styles with arbitrary padding, colour, and border values.

---

## Pills and badges — use sparingly

A "pill" is any small rounded-full chip: an eyebrow label above a heading, a `Featured` / `Most popular` tag, a category chip, a stat chip. One well-placed pill draws the eye. A page covered in them looks like a template demo, not a business.

Rules:

- **At most one pill per page section**, and most sections need none.
- Never use pills as the main way to present a list (services, features, areas covered, opening hours). Use headings, icon-led lists, or cards.
- Never stack a pill on top of a `tagline` — the widget `tagline` prop already fills the eyebrow slot above a heading. Pick one.
- Reserve pills for genuine status: `Open now`, `Most popular` on one pricing tier, a single `Featured` marker.
- A pill must never carry information that is not repeated elsewhere in plain text — it is decoration, not content.

```astro
<!-- Wrong — a pill wall -->
<div class="flex gap-2">
  <span class="rounded-full bg-primary/10 px-3 py-1">Roofing</span>
  <span class="rounded-full bg-primary/10 px-3 py-1">Guttering</span>
  <span class="rounded-full bg-primary/10 px-3 py-1">Chimneys</span>
</div>

<!-- Right — the content carries itself -->
<Features title="What we do" items={[…]} />
```

---

## Sections and vertical rhythm

All full-width page sections should use consistent vertical padding. The widget system uses `py-16 md:py-20` as the standard. Match this when building custom sections:

```astro
<section class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">…</div>
</section>
```

---

## What arbitrary values ARE acceptable

| OK                         | Because                                     |
| -------------------------- | ------------------------------------------- |
| `aspect-[16/9]`            | No Tailwind default for this ratio          |
| `bg-[url('/pattern.svg')]` | Background image URL                        |
| `translate-x-[1px]`        | Sub-pixel fine-tuning of a specific element |
| `max-w-[42ch]`             | Character-width measure for readable prose  |
| `clip-path-[…]`            | No scale equivalent                         |

If the same arbitrary value appears in more than one place, extract it:

- Add a CSS variable to `CustomStyles.astro`
- Register it as a `@theme` token or `@utility` in `tailwind.css`

---

## Quick checklist before committing

- [ ] No hardcoded px widths (`w-[Npx]`, `max-w-[Npx]`)
- [ ] No hardcoded colours (`text-[#…]`, `bg-[rgb(…)]`)
- [ ] No hardcoded font sizes (`text-[Npx]`, `text-[Nrem]`)
- [ ] No hardcoded spacing (`mt-[Npx]`, `gap-[Npx]`)
- [ ] No hardcoded font weights (`font-[600]`)
- [ ] All headings use `font-heading`
- [ ] Every heading is a single colour — no coloured `<span>` inside a headline
- [ ] All sections are responsive (mobile-first)
- [ ] Brand colours changed only in `CustomStyles.astro`, not in class lists
- [ ] No more than one pill/badge per section, and no pill walls
- [ ] Site copy is free of unnecessary em dashes
- [ ] `npm run check` passes
