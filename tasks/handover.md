# Session Handover — 2026-03-27

## What was done

### Cleanup
- Removed legacy `simulator.html` (1415 lines) and `netlify.toml`
- Cleaned `vercel.json` (removed simulator.html redirect)
- Updated `README.md` to point to Vercel URL
- Cross-referenced IEEE C37.112 constants — all correct (verified against standard Table 1)

### Sprint 4.5 — Definite Time Element
- Per-relay optional DT: `dtEnabled`, `dtPickupMul` (1-50x CT), `dtDelay` (0-1s)
- `effectiveTripTime()` returns `min(IDMT, DT)` when DT active
- Chart draws dashed DT horizontal lines with vertical IDMT connectors
- All consumers updated: UI, chart, tooltip, export, CTI, sharing, state migration

### Sprint 7 — Coordination Overlay Curves
- New `overlays.js` module (pure math, acyclic dependency)
- Cable damage (BS 7671): `t=(kS/I)^2`, 4 materials, 19 cable sizes
- TX inrush (IEEE C37.91): 12x FLC decaying envelope, auto-derived from TX params
- TX through-fault withstand (ANSI C57.109): `t=tBase*(Imax/I)^2`, frequent/infrequent
- MCB curves (IEC 60898): Type B/C/D thermal + magnetic, 13 standard ratings
- Distinct overlay colors/dash patterns, tooltip values, legend items, PDF export table
- URL sharing bumped to v2 (backward-compatible with v1)

### Documentation & Blog Site
- Vite multi-page app: 8 docs pages + 5 blog pages, same build/deployment
- Self-contained `docs-nav.js` injects nav bar on all pages (Simulator/Docs/Blog)
- `docs.css` with prose typography, sidebar, cards, formula boxes, sim-link deep-links
- Docs: Getting Started, Formula Reference, Relay Settings, Overlays, Worked Examples, Export & Sharing, FAQ
- Blog: IDMT curves intro, coordination study guide, IEC vs IEEE comparison, cable protection BS 7671
- SEO: unique title/description/OG/JSON-LD per page, Vercel clean URLs

### UI Revamp — Tabbed Interface
- Replaced single-scroll controls panel with 4 tabs: Transformer | Relays | Overlays | Export
- All sections now discoverable (no hidden collapsible panels)
- Chart stays visible on right at all times
- Action buttons (Reset/PDF/CSV/Share) always visible below tabs
- Mobile: tabs wrap to 2x2 grid

### Removed Features
- Removed studies feature (save/load/delete/import/export named configurations)
- Removed all studies references from docs, blog, and CLAUDE.md
- State persistence via localStorage auto-save and URL sharing remains

## Key decisions
- **Tabbed interface over scroll panel** — collapsible Studies/Overlays panels were invisible to users; tabs make every section discoverable
- **Studies removed** — user requested removal; URL sharing + localStorage auto-save covers the use cases
- **Docs as Vite multi-page app** — no separate framework; same repo, same build, same Vercel deployment
- **Blog as static HTML** — no markdown pipeline; keeps build simple, full control over SEO markup

## Next steps
1. **Deep-link generation** — Create encoded simulator URLs for worked examples in docs pages
2. **Motor starting curve overlay** (Sprint 7.3)
3. **Fuse TCC curves** (Sprint 7.1 — BS 88/IEC 60269, requires digitized lookup data)
4. **OG social preview image** — Create `public/og-image.png` for link sharing

## Gotchas / things to watch
- `chart.js` is the largest module (~500 lines) — could be decomposed later
- PWA service worker aggressively caches HTML — users may need hard refresh after deploys
- Vite pinned to v7.x for vite-plugin-pwa compatibility (v8 not supported yet)
- Blog/docs pages are static HTML (no markdown-to-HTML build step); editing requires HTML knowledge
- URL sharing v2 is backward-compatible with v1 but v1 URLs won't include overlays
