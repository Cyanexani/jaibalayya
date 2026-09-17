# Metro OS — website

The website for **Metro OS**, an independent, open-source recreation of the Metro-era
mobile experience. Eleven pages, no build step required to view them, and a working
Metro shell rendered in real DOM rather than screenshots.

> **Metro OS is not affiliated with, endorsed by, or connected to Microsoft Corporation.**
> "Windows", "Windows Phone" and "Metro" are referenced only to describe the design era this
> project preserves; those trademarks belong to their respective owners. Metro OS uses its own
> name, its own four-part rhombus mark and its own icon set throughout.

---

## Running it

The built site is plain static HTML at the repository root — open `index.html`, or serve the
folder:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Any static host works: GitHub Pages, Netlify, Cloudflare Pages, S3.

## Editing it

Pages are assembled from `src/` by a dependency-free Node script so that the head, navigation
and footer live in exactly one place.

```bash
node tools/build.mjs           # build every page into the repo root
node tools/build.mjs --watch   # rebuild on change
```

```
src/
  layout.html          the document shell — head, nav slot, footer slot, scripts
  partials/
    nav.html           desktop navigation + the full-screen mobile tile panel
    footer.html        footer, accent picker, trademark notice
    sprite.html        ~78 inline SVG symbols, referenced with <use href="#i-…">
  pages/*.html         one file per page, each opening with a <!--meta {…} --> block
tools/build.mjs        the builder (no dependencies)
```

A page source starts with its metadata and then contains only the page body:

```html
<!--meta
{ "page": "apps", "title": "Apps — Metro OS", "desc": "…" }
-->
<section class="phead"> … </section>
```

`{{> partial}}` includes a partial, `{{title}}` / `{{desc}}` / `{{page}}` interpolate the
metadata, and the builder marks the matching `data-nav-key` link with `aria-current="page"`.

## Deploying to GitHub Pages

Pages has to be turned on once by hand — there is no way to do it from a commit:

**Repository → Settings → Pages → Build and deployment → Source: `GitHub Actions`**

That is all. `.github/workflows/pages.yml` then runs on every push to `main` (or to
the site branch), regenerates the pages from `src/`, verifies every referenced asset
exists, and publishes. The site appears at `https://<owner>.github.io/<repo>/`.

Choosing **Deploy from a branch** instead also works — the built HTML is committed at
the repository root and `.nojekyll` is present — but the workflow is the better option
because it rebuilds from `src/` first, so a stale commit of the generated HTML can
never reach production.

Every path in the site is relative, so it runs correctly from a project subpath
(`/<repo>/`) as well as from a domain root.

## Architecture

### Design tokens

`assets/css/tokens.css` is the single source of truth: colour, type scale, spacing, tile
geometry, shadows, motion curves and durations. Nothing else in the project hardcodes a value
that lives there. The eight accent themes are `[data-accent="…"]` blocks that redefine four
variables — which is why changing the accent in the footer (or inside the simulated phone)
recolours the entire site instantly and persists across pages.

| File | Contains |
| --- | --- |
| `assets/css/tokens.css` | design tokens and accent themes |
| `assets/css/base.css` | reset, typography, layout primitives, reveal/motion utilities |
| `assets/css/components.css` | nav, buttons, tiles, panels, timeline, footer, lightbox |
| `assets/css/metroui.css` | the device frame and the in-phone Metro UI |
| `assets/css/pages.css` | per-page compositions |

### JavaScript

No framework, no bundler, three files:

| File | Responsibility |
| --- | --- |
| `assets/js/config.js` | site configuration (links, optional GitHub repo) |
| `assets/js/metro.js` | navigation, accent switching, scroll reveal + parallax, live tiles, lightbox, accordions, app showcase |
| `assets/js/simulator.js` | the Metro shell: screen builders, static device mockups, and the interactive simulator |

Scroll reveal and parallax share **one** rAF pass driven by measured geometry rather than
`IntersectionObserver`, because an observer callback can be skipped by an anchor jump or a fast
flick — and a section that never reveals is a blank page.

### The devices

Every phone on this site is real DOM. `simulator.js` exports one set of screen builders used
both for the static mockups (`<div data-phone="start">`) and for the interactive device on the
Experience page (`<div data-simulator>`), so there is one implementation of the Start screen,
not two. Without JavaScript the frames are replaced by real screenshots via `.no-js`.

The interactive device supports pointer, touch (swipe), and keyboard (`←` `→` `Esc` `Home`).

## Accessibility

- Semantic landmarks, one `<h1>` per page, skip link, visible focus rings that are never removed.
- Every meaningful image has alt text; decorative device frames are `aria-hidden` with a
  screen-reader description alongside.
- `prefers-reduced-motion: reduce` disables reveal animations, parallax, tile flips, playback
  timers, the motion demos and cross-document view transitions.
- The site is fully readable and navigable with JavaScript disabled.

## Placeholder content

This repository is the **website**, not the OS. The following are written-in sample data for the
design and should be wired to real sources before publishing:

- repository statistics, commit list and contributor handles
- release notes and version history on the changelog page
- roadmap issue numbers and progress percentages
- device compatibility results

Setting `githubRepo` in `assets/js/config.js` to a real `owner/name` makes the starred/forks/issues
figures fetch live from the GitHub API at runtime, falling back silently to the written-in values.

Device support is deliberately described in *classes* rather than named handsets: the project
does not claim support for a device until somebody has filed a result against a named build.

## Assets

- `assets/brand/` — the Metro OS mark, wordmark and favicon (original SVG).
- `assets/img/` — WebP renders in three widths, plus original generated wallpapers.
- Icons are one inline SVG sprite (`src/partials/sprite.html`), no icon font, no external requests.

## Licence

Site code and design tokens: MIT. Imagery in `assets/img/` is project artwork.
