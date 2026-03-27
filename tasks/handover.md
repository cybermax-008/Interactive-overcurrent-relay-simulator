# Session Handover — 2026-03-25

## What was done

### Audit
- Comprehensive 6-category codebase audit (math, state, chart, UI, PDF export, code quality/security)
- 28 issues found (1 critical, 7 high, 12 medium, 8 low). Core math confirmed correct.
- Market viability analysis: gap is real, no free tool matches our multi-relay + transformer derivation combo
- Full audit report written to `tasks/audit-report.md`
- Development roadmap written to `tasks/roadmap.md` (7 sprints)

### Sprint 0 — Critical Fixes
- **XSS fix:** Added `escapeHTML()` utility, applied at 8 interpolation points
- **Remarks data loss:** Removed `setTimeout` hack; synchronous restoration
- **Disabled card blocking:** `pointer-events: none` with toggle carve-out
- **Orphan fault lines:** Aligned `drawChart()` filter with `renderBWChart()`
- **State migration:** Field-by-field merge, `undefined` checks, relay array length enforcement
- **Dead code:** Removed unused variables

### Sprint 1 — Stability & Validation
- **Input validation:** JS-side clamping for pickupMul, tms, ctPri, fault slider min 5%
- **kV warning:** Yellow inline warning when priKV <= secKV
- **Reset encapsulation:** Remarks clearing moved into `resetToDefaults()`
- **Print label sync:** printLabel/printParams spans update on every edit
- **Debouncing:** 150ms on text/number inputs, 100ms on resize
- **Named constants:** IEC_SI_K, IEC_SI_ALPHA, CURVE_SAMPLE_STEP, etc.

### Sprint 3 — Architecture Split (Sprint 2 was deferred)
- Split `simulator.html` (1416 lines) into 9 ES modules + Vite build
- Unified chart renderer: merged drawChart/renderBWChart into parameterized renderChart() with theme objects (~155 lines duplication eliminated)
- Pure math module (zero DOM/state deps), clean acyclic module graph
- Build output: 21.4 KB JS + 11.8 KB CSS (7.4 KB + 2.9 KB gzipped)
- Legacy `simulator.html` preserved standalone

### Deployment
- Added `vercel.json` for Vercel (build from dist/, redirect simulator.html -> /)
- Deployed to Vercel: https://power-system-tool.vercel.app/

### Sprint 2 — Accessibility & Mobile
- **Semantic HTML:** Converted `<div>` reset/export buttons to `<button type="button">` elements
- **ARIA labels:** Canvas `role="img"`, slider `aria-label`, toggle `aria-label="Enable relay N"`, remarks `aria-label`, `for`/`id` pairs on all transformer and relay card inputs
- **Focus indicators:** `:focus-visible` outlines on inputs, buttons, toggles, and slider
- **Mobile breakpoints:** 540px (2-col grids, larger touch targets, bigger slider thumb) and 360px (1-col grids)
- **Touch tooltip:** `passive: false` on touchmove with `preventDefault()`, vertical clamping
- **Cross-browser slider:** Firefox `::-moz-range-thumb` and `::-moz-range-track` rules, inline styles moved to CSS
- **CSS compatibility:** Replaced `inset: 0` with explicit `top/right/bottom/left`, added `aspect-ratio` fallback via `padding-bottom`
- **Color contrast:** `--text-dim` changed from `#64748b` to `#8494a7` (~5.5:1 ratio), min label font-size bumped from 0.57rem to 0.65rem
- Build output: 21.6 KB JS + 13.1 KB CSS (7.5 KB + 3.2 KB gzipped)

## Key decisions
- **Vanilla JS + Vite** over React/Svelte — zero runtime overhead, preserves existing code
- **Theme objects for chart** — screen vs print as config, not code duplication
- **Vercel** for deployment going forward

### Sprint 4 — IEC/IEEE Curve Types
- **CURVES object:** 7 curve types — IEC SI/VI/EI/LI + IEEE MI/VI/EI — with k, alpha, beta, label, short, standard fields
- **Per-relay curve selector:** `<select>` dropdown with `<optgroup>` by standard (IEC 60255 / IEEE C37.112)
- **Updated tripTime:** Accepts curve parameter, supports IEEE beta additive term: `t = (k / (M^alpha - 1) + beta) * TMS`
- **curveType migration:** `loadState()` validates curveType exists in CURVES, falls back to IEC_SI
- **All consumers updated:** chart.js, tooltip.js, export.js, ui.js all pass per-relay curve to tripTime
- **Chart labels:** Show curve abbreviation `[SI]`, `[VI]`, etc. in curve labels, legend, and table headers
- **PDF export:** Added Curve Type column to settings table, updated formula to generic form
- **Formula bar:** Updated to show generic `t = (k / (M^alpha - 1) + beta) * TMS` with IEC/IEEE note
- Build output: 23.7 KB JS + 13.5 KB CSS (8.1 KB + 3.2 KB gzipped)

### Sprint 5 — PWA Conversion
- **vite-plugin-pwa:** Auto-generates service worker (Workbox generateSW) with 13 precached entries
- **Manifest:** name "IDMT Relay Simulator", standalone display, dark theme, app icons (192+512 PNG)
- **Icons:** Lightning bolt SVG icon (amber on dark bg), generated PNGs via sharp
- **Offline:** Full offline support — all assets cached, Google Fonts cached separately (1-year expiry)
- **Install prompt:** Slide-up banner with Install/Dismiss buttons, dismissed state persisted in localStorage
- **Meta tags:** description, theme-color, favicon.svg, apple-touch-icon

### Bug fix — Chart not shrinking
- **Root cause:** CSS grid item `.chart-panel` missing `min-width: 0` — prevented grid from shrinking the panel below its intrinsic content width
- **Fix:** Added `min-width: 0` to `.chart-panel`, `min-width: 0; overflow: hidden` to `.canvas-wrap`, `display: block` to canvas, `overflow: auto` (both axes) to `.results-table`

### Sprint 6A — Dynamic Relay Count
- **1-8 relays:** Add/Remove buttons, 8 colors + 8 B&W dash patterns
- **Side selector:** Per-relay Primary/Secondary dropdown (no longer hardcoded by index)
- **Inline colors:** Replaced CSS `[data-idx]` rules with inline styles — scales to any N
- **Scrollable controls:** Controls panel scrolls when many relays exceed viewport
- **State migration:** Variable-length relay arrays, `defaultRelay()` factory for new relays

### Sprint 6B — URL-Based State Sharing
- **Share button:** Copies encoded URL to clipboard with toast confirmation
- **URL loading:** State encoded as compact base64 JSON, loaded on init (takes precedence over localStorage)
- **Clean URL:** URL parameter cleared after loading via `history.replaceState`

### Sprint 6C — Study Management
- **Collapsible studies panel:** Save/load/delete named configurations
- **Import/Export:** JSON file import/export for studies (single or bulk)
- **localStorage-based:** Studies stored separately from current state

### Sprint 6D — CTI Display
- **Computation:** Groups enabled relays by side, sorts by trip time, computes grading margins
- **Chart brackets:** Color-coded vertical brackets (green >=0.3s, yellow 0.2-0.3s, red <0.2s)
- **UI summary:** Badge display below fault summary with CTI values per relay pair
- **PDF export:** Coordination Margins table with OK/MARGINAL/FAIL status

### Sprint 6E — Enhanced Export
- **CSV export:** Download fault table data as `.csv` file
- **Report settings:** Company name, project ref, doc ref, revision fields (persisted in state)
- **Branded PDF:** Report header with company/project info, page footer with date
- Build output: 36.0 KB JS + 17.8 KB CSS (12.2 KB + 4.0 KB gzipped) — 14 modules

### Cleanup — 2026-03-26
- Removed legacy `simulator.html` (1400+ lines, was drifting from modular codebase)
- Removed `netlify.toml` (no longer on Netlify)
- Cleaned `vercel.json` (removed simulator.html redirect)
- Updated `README.md` (now points to Vercel URL)
- Cross-referenced IEEE C37.112 constants — all correct (verified against standard Table 1)

### Sprint 4.5 — Definite Time Element
- **Per-relay DT fields:** `dtEnabled`, `dtPickupMul` (1.0-50, default 5.0), `dtDelay` (0-1.0s, default 0)
- **effectiveTripTime():** Returns `min(IDMT, DT)` when DT is active and fault exceeds DT pickup
- **Chart:** Dashed horizontal DT lines from pickup current to right edge, vertical connector to IDMT curve
- **All consumers updated:** ui, chart, tooltip, export (PDF+CSV), CTI, sharing, state migration
- **UI:** Checkbox toggle per relay card, shows DT Pickup Mul and DT Delay fields when enabled
- Build output: 39.4 KB JS + 18.3 KB CSS (13.0 KB + 4.1 KB gzipped) — 14 modules

### Sprint 7 — Coordination Overlay Curves
- **New module `overlays.js`:** Pure math for 4 overlay types, imports only constants + math (acyclic)
- **Cable damage** (BS 7671): `t = (kS/I)^2`, materials Cu/Al × PVC/XLPE, 19 standard sizes
- **TX inrush** (IEEE C37.91): Decaying envelope 12× FLC, τ=0.2s, auto-derived from TX params
- **TX through-fault withstand** (ANSI C57.109): `t = tBase × (Imax/I)^2`, frequent/infrequent
- **MCB curves** (IEC 60898): Type B/C/D thermal + magnetic, 13 standard ratings
- **Collapsible UI panel:** "Coordination Overlays" between TX params and relay cards
- **Chart rendering:** Overlay curves drawn after relay curves, before fault lines, distinct colors + dash patterns
- **Overlay styles:** cable=#ff6b6b, inrush=#ffd93d, withstand=#6bcb77, mcb=#4d96ff (distinct from relay colors)
- **All consumers updated:** legend, tooltip, PDF export with overlay table, URL sharing v2, studies, state migration
- Build output: 50.1 KB JS + 19.5 KB CSS (16.0 KB + 4.2 KB gzipped) — 15 modules

### Documentation & Blog Site
- **Vite multi-page app:** 14 entry points (simulator + 8 docs + 5 blog), same build/deployment
- **Self-contained nav bar:** `docs-nav.js` injects CSS + HTML on all pages (Simulator/Docs/Blog)
- **Docs pages:** Hub, Getting Started, Formula Reference, Relay Settings, Coordination Overlays, Worked Examples, Export & Sharing, FAQ
- **Blog posts:** IDMT curves intro, coordination study guide, IEC vs IEEE comparison, cable protection BS 7671
- **SEO:** Unique title/description/OG/JSON-LD per page, clean URLs via Vercel
- **Dark theme docs:** `docs.css` with prose typography, sidebar, cards, formula boxes, sim-link deep-links
- Build output: 30 modules, 28 precached PWA entries

## Next steps
1. **Motor starting curve overlay** (Sprint 7.3 — starting current 6-8× FLC, locked rotor thermal limit)
2. **Fuse TCC curves** (Sprint 7.1 — BS 88/IEC 60269, requires digitized lookup data)
3. **Deep-link generation** — Create encoded simulator URLs for worked examples in docs

## Gotchas / things to watch
- `chart.js` is the largest module (~500 lines) — could be further decomposed later
- `index.html` at root is the Vite entry point
- `node_modules/` and `dist/` are gitignored — Vercel runs `npm install` + `npm run build`
- PWA service worker auto-updates — users get new versions on next visit after deploy
- Vite pinned to v7.x for vite-plugin-pwa compatibility (v8 not supported yet)
