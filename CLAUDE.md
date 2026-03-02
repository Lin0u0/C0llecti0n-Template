# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (requires two terminals)
npm run admin-server   # Start the local admin API on :4322 (required for /admin to work)
npm run dev            # Start Astro dev server on :4321

# Build
npm run build          # Standard build (includes admin panel)
npm run build:prod     # Production build with EXCLUDE_ADMIN=true (used by Vercel, no admin panel)
npm run preview        # Preview the production build locally
```

**Setup:** Copy `.env.example` to `.env` and set `PUBLIC_ADMIN_KEY` and `ADMIN_KEY` to the same value.

## Architecture

This is a **static Astro 5 site** (SSG, no server-side rendering) for personal media collection tracking. All data lives in plain JSON files in `src/data/` (books, movies, series, music).

### Two-server local dev model

The admin panel (`/admin`) depends on a **separate Node.js API server** (`admin-server.mjs`) running on port 4322 that reads/writes the JSON data files directly. The Astro dev server is purely a static frontend — it cannot modify files. The admin panel communicates with this local API using `PUBLIC_ADMIN_KEY` in `X-Admin-Key` headers.

On **Vercel**, the admin is fully blocked via redirects in `vercel.json` (all `/admin` routes → `/404`), and `build:prod` is used which excludes the admin panel from the build entirely via the `EXCLUDE_ADMIN=true` env var.

### Key architectural patterns

- **Types**: All shared TypeScript interfaces are in `src/types/index.ts`. `BaseMedia` is the base for `Book`, `Album`, `Movie`, `Series`. All components import types from here.
- **Filter/Sort system**: Two-layer implementation:
  - Server-side (build time): `src/utils/filters.ts` — pure utility functions for `filterItems()`, `sortItems()`, `extractFilterOptions()`, used in `.astro` page frontmatter.
  - Client-side (runtime): `src/scripts/filter-system.ts` — a `FilterSystem` class injected into pages for interactive filtering. Pages also use `generateFilterScript()` from `src/utils/filters.ts` to inline filter logic as `<script>` tags.
- **Data attributes for client-side filtering**: Each item component renders `data-*` attributes (e.g., `data-year`, `data-country`, `data-added-date`, `data-rating`) on its root element. The client-side filter reads these attributes to show/hide items without a round-trip.
- **Country/multi-value fields**: Values like country use slash-separated format (`"美国 / 英国"`). `splitBySlash()` in `src/utils/filters.ts` handles parsing these for filtering.

### Pages → Components mapping

| Page | Primary component | Data source |
|------|-------------------|-------------|
| `/library` | `Bookshelf` → `BookSpine` | `books.json` |
| `/cinema` | `DiscDrawer` → `DiscCase` | `movies.json` + `series.json` |
| `/concert-hall` | `RecordCabinet` → `VinylRecord` | `music.json` |

### Styling conventions

- Global CSS variables and theme tokens: `src/styles/global.css`
- Animations: `src/styles/animations.css`
- Textures: `src/styles/textures.css`
- Component-scoped styles use Astro `<style>` tags (scoped by default)
- The UI uses a glassmorphism aesthetic with light/dark theme support via CSS variables

### Admin panel (`src/pages/admin/index.astro`)

Fully client-side rendered panel that calls `admin-server.mjs` endpoints. The admin server validates all writes (required fields, type/range checks, enum validation for status fields) before modifying JSON files.
