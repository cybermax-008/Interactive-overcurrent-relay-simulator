# Overcurrent Relay Simulator — Development Roadmap

**Created:** 2026-03-25
**Source:** [Audit Report](./audit-report.md)
**Current state:** Single-file app (`simulator.html`, 1375 lines), IEC 60255 Standard Inverse only, deployed on Netlify

---

## Overview

This roadmap merges two tracks into a single execution plan:

1. **Fix track** — Resolve the 28 audit findings (1 critical, 7 high, 12 medium, 8 low)
2. **Growth track** — Evolve from a single-curve demo into a credible multi-curve protection coordination tool

The sprints are ordered so that fixes land before features, and architecture refactoring happens before feature expansion (to avoid building on a fragile base).

```
Sprint 0  ─── Critical Fixes ──────────────────  ~1 day
Sprint 1  ─── Stability & Validation ───────────  ~2 days
Sprint 2  ─── Accessibility & Mobile ───────────  ~3 days
Sprint 3  ─── Architecture Split (multi-file) ──  ~4 days
Sprint 4  ─── IEC/IEEE Curve Types ─────────────  ~3 days
Sprint 5  ─── PWA Conversion ───────────────────  ~1 day
Sprint 6  ─── Product Features ─────────────────  ~2 weeks
Sprint 7  ─── Advanced & Monetization ──────────  ongoing
```

**Total to "credible professional tool" (Sprints 0-5): ~2 weeks**
**Total to "differentiated product" (through Sprint 6): ~1 month**

---

## Sprint 0 — Critical Fixes

> **Goal:** Eliminate security vulnerabilities and data loss bugs. Ship ASAP.
> **Effort:** ~1 day
> **Audit issues resolved:** 6 (1 critical, 2 high, 2 medium, 1 low)

### 0.1 XSS — Add `escapeHTML()` utility and apply everywhere

**Audit ref:** Critical — Code Quality & Security
**Files:** `simulator.html`

- [ ] Add `escapeHTML(s)` function at top of `<script>` block
  ```js
  function escapeHTML(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  ```
- [ ] Apply at all 7 interpolation points:
  - Line 625: `value="${escapeHTML(r.label)}"`
  - Line 626: `>${escapeHTML(r.label)}</span>`
  - Line 693: `${escapeHTML(name)}` in `buildLegend()`
  - Line 1017: `${escapeHTML(name)}` in tooltip
  - Line 1086: `${escapeHTML(r.label || ...)}` in export settings
  - Line 1118: `${escapeHTML(r.label || ...)}` in export fault table
  - Line 1179: `${escapeHTML(remarks).replace(/\n/g,'<br>')}` in export remarks

**Acceptance:** Enter `<svg onload=alert(1)>` as a relay label. Verify no script execution in: live UI, tooltip hover, legend, PDF export window. Enter `<script>alert(1)</script>` in remarks, verify no execution in export.

### 0.2 Remarks data loss — Fix `setTimeout` sequencing

**Audit ref:** Medium — State & Persistence
**Files:** `simulator.html` (lines 534-590)

- [ ] Remove the `setTimeout` wrapper around remarks restoration (lines 556-559)
- [ ] In `loadState()`, return the remarks string instead of setting it via timeout
- [ ] In the init sequence (lines 1368-1371), restore remarks synchronously after `buildCards()` and before `refresh()`:
  ```js
  const savedRemarks = loadState();
  populateTxInputs();
  buildCards();
  if (savedRemarks) document.getElementById('remarksField').value = savedRemarks;
  refresh();
  ```

**Acceptance:** Add remarks, reload page, close tab immediately without interacting. Reopen — remarks must persist.

### 0.3 Disabled cards — Block input on disabled relays

**Audit ref:** High — UI & Responsiveness
**Files:** `simulator.html` (CSS line 122)

- [ ] Add to CSS:
  ```css
  .relay-card.disabled { opacity: 0.25; pointer-events: none; }
  .relay-card.disabled .toggle-wrap { pointer-events: auto; }
  ```

**Acceptance:** Disable a relay via toggle. Verify inputs cannot be clicked/typed. Verify toggle can still be clicked to re-enable.

### 0.4 Orphan fault lines — Align `drawChart()` filter with `renderBWChart()`

**Audit ref:** High — Chart & Rendering
**Files:** `simulator.html` (lines 951-958)

- [ ] Change lines 952-958 to filter for `r.enabled`:
  ```js
  const priRelays = relays.map((r, i) => r.enabled && r.side === 'pri' ? i : -1).filter(x => x >= 0);
  if (priRelays.length) faultLines.push({ val: priFault, label: 'PRI', color: '#c4b5fd', relays: priRelays });
  // Same for secondary
  const secRelays = relays.map((r, i) => r.enabled && r.side === 'sec' ? i : -1).filter(x => x >= 0);
  if (secRelays.length) faultLines.push({ val: secFault, label: 'SEC', color: '#f9a8d4', relays: secRelays });
  ```
- [ ] Remove the now-redundant `if (!r.enabled) return;` guard at line 973 (or keep as defense-in-depth)

**Acceptance:** Disable all primary-side relays. Verify no "PRI: xxxA" vertical line on chart. Same for secondary.

### 0.5 Incomplete relay field migration

**Audit ref:** Medium — State & Persistence
**Files:** `simulator.html` (lines 547-554)

- [ ] Replace falsy checks with `undefined` checks:
  ```js
  if (r.label === undefined) r.label = DEFAULTS.relays[i].label;
  if (r.side === undefined) r.side = DEFAULTS.relays[i].side;
  ```
- [ ] Add field-by-field `tx` merge: `tx = { ...JSON.parse(JSON.stringify(DEFAULTS.tx)), ...s.tx };`
- [ ] Enforce relay array length: pad from DEFAULTS or truncate to 4

**Acceptance:** Manually edit localStorage to remove a field (e.g., delete `tms` from relay 0). Reload — value should fall back to default. Set a label to empty string, reload — it stays empty.

### 0.6 Dead code cleanup

**Audit ref:** Low — Code Quality
**Files:** `simulator.html` (line 689)

- [ ] Remove unused `const iset = getIset(r);` in `buildLegend()`
- [ ] Remove unused alias `const currentPct = faultPct;` in `updateTable()` (use `faultPct` directly)

---

## Sprint 1 — Stability & Validation

> **Goal:** Close all input validation gaps and state management edge cases. Engineering integrity.
> **Effort:** ~2 days
> **Audit issues resolved:** 7 (4 medium, 3 low)
> **Depends on:** Sprint 0

### 1.1 Input validation — JS-side clamping for all relay parameters

**Audit ref:** Medium — pickup multiplier, TMS; Low — CT Primary

- [ ] `pickupMul`: HTML `min="0.01"`, JS `Math.max(0.01, Math.min(2, val))`
- [ ] `tms`: JS `Math.max(0.05, Math.min(1.0, val))`
- [ ] `ctPri`: JS `Math.max(1, Math.round(val))`
- [ ] Fault slider: Change HTML `min` to `"5"` (5% minimum fault level)

### 1.2 Primary/Secondary kV warning

**Audit ref:** Medium — Math & Engineering

- [ ] After transformer input change, check `tx.priKV <= tx.secKV`
- [ ] Show a small inline warning banner below `.tx-results`: "Primary kV is lower than Secondary kV — verify transformer parameters"
- [ ] CSS: yellow border, warning icon, dismissible
- [ ] Do NOT block input — step-up transformers are valid in some cases

### 1.3 `resetToDefaults()` encapsulation

**Audit ref:** Low — State & Persistence

- [ ] Move `document.getElementById('remarksField').value = ''` into `resetToDefaults()` itself
- [ ] Remove from the click handler (line 1054) to prevent coupling

### 1.4 Stale print labels/params

**Audit ref:** Medium — UI & Responsiveness / PDF Export

- [ ] In the label `input` handler (lines 672-675), add:
  ```js
  document.getElementById('printLabel' + idx).textContent = e.target.value;
  ```
- [ ] In `updateResults()`, update `printParams` span for each relay:
  ```js
  document.getElementById('printParams' + i).innerHTML =
    `CT Primary: ${r.ctPri} A | Pickup Mul: ${r.pickupMul.toFixed(2)} | TMS: ${r.tms.toFixed(2)}`;
  ```

### 1.5 Performance — Debounce refresh and resize

**Audit ref:** Low — State & Persistence; Medium — Chart & Rendering

- [ ] Add debounced refresh for text/number `input` events (~150ms)
- [ ] Add debounced resize handler (~100ms):
  ```js
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 100);
  });
  ```
- [ ] Keep slider `input` event un-debounced (needs immediate visual feedback)

### 1.6 Named constants for magic numbers

**Audit ref:** Low — Code Quality

- [ ] Add constants block at top of `<script>`:
  ```js
  // IEC 60255 Standard Inverse
  const IEC_SI_K = 0.14;
  const IEC_SI_ALPHA = 0.02;

  // Chart rendering
  const CURVE_SAMPLE_STEP = 1.008;
  const CURVE_START_FACTOR = 1.01;
  const LOG_PAD_X = 0.15;
  const LOG_PAD_Y = 0.25;
  const DEFAULT_X_RANGE = [50, 25000];
  const DEFAULT_Y_RANGE = [0.1, 100];
  const EXPORT_CHART_SIZE = [2400, 1500];
  ```
- [ ] Replace all hardcoded values with constants

**Why now:** These constants become the foundation for Sprint 4 (multi-curve types), where `K` and `ALPHA` become per-curve variables.

---

## Sprint 2 — Accessibility & Mobile

> **Goal:** Make the app usable on phones and accessible to keyboard/screen-reader users.
> **Effort:** ~3 days
> **Audit issues resolved:** 9 (3 high, 4 medium, 2 low)
> **Depends on:** Sprint 0

### 2.1 Semantic HTML — Convert div buttons to `<button>` elements

**Audit ref:** High — UI & Responsiveness

- [ ] Change `<div class="reset-btn">` to `<button class="reset-btn">`
- [ ] Change `<div class="export-btn">` to `<button class="export-btn">`
- [ ] Add `type="button"` to prevent form submission behavior
- [ ] Update CSS: add `cursor: pointer; border: none; font: inherit;` base styles

### 2.2 ARIA labels

**Audit ref:** High — UI & Responsiveness

- [ ] Canvas: `role="img" aria-label="Trip time vs fault current log-log chart"`
- [ ] Slider: `aria-label="Fault level multiplier"`
- [ ] Toggle checkboxes: `aria-label="Enable relay ${i + 1}"`
- [ ] Remarks textarea: `aria-label="Remarks and notes"`
- [ ] Label-for/id pairs on transformer inputs and relay card inputs

### 2.3 Focus indicators

**Audit ref:** Medium — implied by accessibility

- [ ] Add `:focus-visible` styles to `.num-input`, `.label-input`, `.toggle input + .sl`, buttons
- [ ] Visible focus ring: `outline: 2px solid var(--accent); outline-offset: 2px;`

### 2.4 Mobile breakpoints

**Audit ref:** High — UI & Responsiveness

- [ ] Add `@media (max-width: 540px)`:
  - `.tx-fields`: `grid-template-columns: 1fr 1fr`
  - `.card-fields`: `grid-template-columns: 1fr 1fr`
  - `.app`: `padding: 12px 10px`
  - `.formula-bar`: `font-size: 0.8rem; overflow-x: auto;`
- [ ] Add `@media (max-width: 360px)`:
  - `.tx-fields`: `grid-template-columns: 1fr`
  - `.card-fields`: `grid-template-columns: 1fr`
- [ ] Increase touch targets at mobile widths:
  - `.num-input`: `padding: 10px 8px`
  - `.label-input`: `padding: 8px 7px`
  - `.toggle`: `width: 44px; height: 24px`

### 2.5 Touch tooltip support

**Audit ref:** High — UI & Responsiveness

- [ ] Add `touchmove` listener to canvas (reuse mousemove logic):
  ```js
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    // same logic as mousemove with touch.clientX, touch.clientY
  }, { passive: false });
  canvas.addEventListener('touchend', () => { tooltip.style.display = 'none'; });
  ```
- [ ] Clamp tooltip position vertically (not just horizontally)

### 2.6 Cross-browser slider styling

**Audit ref:** Medium — UI & Responsiveness

- [ ] Add Firefox slider rules:
  ```css
  #faultPctSlider::-moz-range-thumb { ... }
  #faultPctSlider::-moz-range-track { ... }
  ```
- [ ] Move inline slider styles from HTML (line 463) into `<style>` block
- [ ] Increase thumb size to 24x24 at mobile widths

### 2.7 CSS compatibility fallbacks

**Audit ref:** Medium — UI & Responsiveness

- [ ] Replace `inset: 0` with `top: 0; right: 0; bottom: 0; left: 0;` (lines 33, 160)
- [ ] Add `aspect-ratio` fallback for `.canvas-wrap`:
  ```css
  .canvas-wrap { position: relative; width: 100%; padding-bottom: 62.5%; /* 10/16 fallback */ }
  @supports (aspect-ratio: 16/10) {
    .canvas-wrap { padding-bottom: 0; aspect-ratio: 16 / 10; }
  }
  ```

### 2.8 Color contrast improvement

**Audit ref:** Low — UI & Responsiveness

- [ ] Change `--text-dim` from `#64748b` to `#8494a7` (~5.5:1 on panel backgrounds)
- [ ] Increase minimum label font-size from `0.57rem` to `0.65rem`

---

## Sprint 3 — Architecture Split

> **Goal:** Break the single file into modules. Prerequisite for feature expansion.
> **Effort:** ~4 days
> **Audit issues resolved:** 1 (medium — duplicated chart logic)
> **Depends on:** Sprint 1 (named constants)

This sprint transforms the project from a single-file app into a modular codebase. This is necessary before adding curve types (Sprint 4) because the current `drawChart()`/`renderBWChart()` duplication (~155 lines) would multiply with each new feature.

### 3.1 Add build tooling

- [ ] Initialize with Vite (vanilla JS template) — zero-config, fast, good DX
  ```bash
  npm init -y
  npm install -D vite
  ```
- [ ] Create `src/` directory structure:
  ```
  src/
    main.js          # Entry point, init sequence, event wiring
    constants.js      # IEC/IEEE curve constants, colors, defaults
    math.js           # calcFaultCurrent, tripTime, getIset, fault derivation
    state.js          # State management, localStorage, save/load/reset
    ui.js             # buildCards, buildLegend, updateResults, updateTable
    chart.js          # Unified chart renderer (replaces drawChart + renderBWChart)
    export.js         # PDF export
    tooltip.js        # Tooltip logic (mouse + touch)
  index.html          # Shell HTML (was simulator.html)
  style.css           # Extracted CSS
  ```
- [ ] Add `package.json` scripts:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
  ```
- [ ] Configure Vite to output to `dist/` for Netlify

### 3.2 Extract `constants.js`

- [ ] Move `COLORS`, `SIDES`, `DEFAULTS`, storage key
- [ ] Add curve type definitions (prepare for Sprint 4):
  ```js
  export const CURVES = {
    IEC_SI:  { k: 0.14, alpha: 0.02, label: 'IEC Standard Inverse' },
    // Placeholders for Sprint 4:
    // IEC_VI:  { k: 13.5, alpha: 1.0,  label: 'IEC Very Inverse' },
    // IEC_EI:  { k: 80.0, alpha: 2.0,  label: 'IEC Extremely Inverse' },
    // IEC_LI:  { k: 120,  alpha: 1.0,  label: 'IEC Long Time Inverse' },
  };
  ```
- [ ] Move chart rendering constants (`CURVE_SAMPLE_STEP`, padding, fallback ranges, etc.)

### 3.3 Extract `math.js`

- [ ] Move `calcFaultCurrent()`, `tripTime()`, `getIset()`
- [ ] Move `getPriFault100()`, `getSecFault100()`, `getPriFault()`, `getSecFault()`, `getRelayFault()`
- [ ] Make `tripTime()` accept a curve type parameter (default to `IEC_SI`):
  ```js
  export function tripTime(If, iset, tms, curve = CURVES.IEC_SI) {
    const ratio = If / iset;
    if (ratio <= 1) return Infinity;
    return (curve.k / (Math.pow(ratio, curve.alpha) - 1)) * tms;
  }
  ```

### 3.4 Extract & unify `chart.js`

This is the most impactful refactor — eliminates ~155 lines of duplication.

- [ ] Create a single `renderChart(canvas, options)` function:
  ```js
  export function renderChart(canvas, {
    relays, state, theme, // 'screen' | 'print'
    width, height,        // only for offscreen (print)
  }) { ... }
  ```
- [ ] `theme` object controls: colors vs B&W, dash patterns, line widths, font sizes, padding, background
- [ ] Extract `logTicks()`, `autoFitRanges()`, `drawGrid()`, `drawAxes()`, `drawCurves()`, `drawFaultLines()` as internal helpers
- [ ] `drawChart()` becomes: `renderChart(canvas, { theme: screenTheme, relays, state })`
- [ ] `renderBWChart()` becomes: `renderChart(offscreenCanvas, { theme: printTheme, width: 2400, height: 1500, relays, state })`

### 3.5 Extract `state.js`, `ui.js`, `export.js`, `tooltip.js`

- [ ] `state.js`: Global state, `saveState()`, `loadState()`, `resetToDefaults()`, `populateTxInputs()`
- [ ] `ui.js`: `buildCards()`, `buildLegend()`, `updateResults()`, `updateTable()`, `updateTxDisplay()`
- [ ] `export.js`: `exportPDF()`, `escapeHTML()`
- [ ] `tooltip.js`: mousemove, touchmove, mouseleave, touchend handlers

### 3.6 Extract `style.css`

- [ ] Move all CSS from `<style>` to `src/style.css`
- [ ] Import in `main.js`: `import './style.css'`

### 3.7 Update deployment

- [ ] Update Netlify config for `dist/` output
- [ ] Keep `simulator.html` as a redirect to new entry point (backwards compatibility)
- [ ] Update `CLAUDE.md` with new architecture and commands

**Acceptance:** `npm run build` produces a working `dist/index.html`. All existing functionality works identically. Deployed URL serves the same experience.

---

## Sprint 4 — IEC / IEEE Curve Types

> **Goal:** Support all standard IDMT curve types with per-relay selection. This is the #1 feature gap vs. competitors.
> **Effort:** ~3 days
> **Depends on:** Sprint 3 (modular architecture, parameterized `tripTime`)

### 4.1 Add all curve type constants

```js
export const CURVES = {
  IEC_SI:  { k: 0.14,  alpha: 0.02, label: 'IEC Standard Inverse',    standard: 'IEC 60255' },
  IEC_VI:  { k: 13.5,  alpha: 1.0,  label: 'IEC Very Inverse',        standard: 'IEC 60255' },
  IEC_EI:  { k: 80.0,  alpha: 2.0,  label: 'IEC Extremely Inverse',   standard: 'IEC 60255' },
  IEC_LI:  { k: 120.0, alpha: 1.0,  label: 'IEC Long Time Inverse',   standard: 'IEC 60255' },
  IEEE_MI: { k: 0.0515, alpha: 0.02, beta: 0.114, label: 'IEEE Moderately Inverse', standard: 'IEEE C37.112' },
  IEEE_VI: { k: 19.61,  alpha: 2.0,  beta: 0.491, label: 'IEEE Very Inverse',       standard: 'IEEE C37.112' },
  IEEE_EI: { k: 28.2,   alpha: 2.0,  beta: 0.1217,label: 'IEEE Extremely Inverse',  standard: 'IEEE C37.112' },
};
```

**Note:** IEEE curves use `t = (k / (ratio^alpha - 1) + beta) * TMS`. The `tripTime` function needs to handle the additive `beta` term.

### 4.2 Per-relay curve type selector

- [ ] Add `curveType` field to relay model (default: `'IEC_SI'`)
- [ ] Add `<select>` dropdown in relay card UI (in place of or alongside existing fields)
- [ ] Group options by standard: "IEC 60255" / "IEEE C37.112"
- [ ] Update `DEFAULTS` with `curveType: 'IEC_SI'` for all relays
- [ ] Add localStorage migration for missing `curveType` field

### 4.3 Update tripTime for IEEE curves

```js
export function tripTime(If, iset, tms, curve) {
  const ratio = If / iset;
  if (ratio <= 1) return Infinity;
  const t = (curve.k / (Math.pow(ratio, curve.alpha) - 1) + (curve.beta || 0)) * tms;
  return t;
}
```

### 4.4 Update chart, table, legend, export

- [ ] Chart curve labels: include curve type abbreviation (e.g., "Primary OC1 [SI]")
- [ ] Legend: show curve type per relay
- [ ] Results table: same `tripTime` call with relay's curve type
- [ ] PDF export: show curve type in relay settings table
- [ ] B&W chart: curve type in label

### 4.5 Definite time element (high-set instantaneous)

- [ ] Add optional `definiteTime` field to relay model (null = disabled)
- [ ] When `definiteTime` is set, draw a horizontal line at that time value
- [ ] Trip time is `min(IDMT time, definiteTime)` when fault current exceeds a definite-time pickup
- [ ] Add UI inputs: "DT Pickup (A)" and "DT Time (s)" per relay card
- [ ] Update chart to show the composite curve (IDMT + flat DT line)

### 4.6 Update formula bar

- [ ] Show the general formula: `t = k / ((I/Is)^alpha - 1) * TMS`
- [ ] Optionally show the active curve's specific constants

**Acceptance:** Configure 4 relays with different curve types. Verify each curve shape is visually distinct. Verify table values match. Verify PDF export shows correct curve types. Verify IEEE curves have the beta additive term.

---

## Sprint 5 — PWA Conversion

> **Goal:** Installable, offline-capable web app. Massive value for field engineers.
> **Effort:** ~1 day
> **Depends on:** Sprint 3 (Vite build pipeline)

### 5.1 Web app manifest

- [ ] Create `public/manifest.json`:
  ```json
  {
    "name": "IDMT Relay Simulator",
    "short_name": "Relay Sim",
    "description": "Interactive overcurrent relay coordination simulator",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#0a0e17",
    "background_color": "#0a0e17",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```
- [ ] Add `<link rel="manifest" href="/manifest.json">` to `index.html`
- [ ] Create app icons (192x192 and 512x512)

### 5.2 Service worker

- [ ] Use `vite-plugin-pwa` for automatic service worker generation
- [ ] Cache strategy: cache-first for static assets, network-first for nothing (fully static app)
- [ ] Offline: entire app works without network after first visit

### 5.3 Install prompt

- [ ] Listen for `beforeinstallprompt` event
- [ ] Show subtle install banner: "Install for offline use"
- [ ] Dismiss permanently via localStorage flag

**Acceptance:** Visit the deployed URL on a phone. Verify "Add to Home Screen" prompt appears. Install. Turn on airplane mode. Open app — it works fully offline.

---

## Sprint 6 — Product Features

> **Goal:** Build the features that differentiate this from free calculators and make it worth sharing/paying for.
> **Effort:** ~2 weeks
> **Depends on:** Sprint 4 + 5

### 6.1 Expand to 6-8 relays

- [ ] Make relay count configurable (default 4, max 8)
- [ ] Add "Add Relay" / "Remove Relay" buttons
- [ ] Extend `COLORS` array for 8 distinct colors
- [ ] Extend `BW_DASH` patterns for 8 curves
- [ ] Per-relay side selector dropdown (primary/secondary) — remove hardcoded `SIDES` array

### 6.2 Coordination time interval (CTI) display

- [ ] Given two relays on the same side, compute the grading margin at the fault current
- [ ] Display CTI between adjacent relays at the operating point: `CTI = t_backup - t_primary`
- [ ] Show on chart as a vertical bracket with time annotation
- [ ] Color-code: green (>0.3s) / yellow (0.2-0.3s) / red (<0.2s)
- [ ] Industry standard CTI is typically 0.3-0.4s

### 6.3 URL-based state sharing

- [ ] Encode full state into URL query params (compressed via `btoa(JSON.stringify(state))`)
- [ ] "Share" button generates a link with encoded state
- [ ] On load, check URL for state param — if present, load from URL (overrides localStorage)
- [ ] Users can share specific relay configurations via link

### 6.4 Study management — Save/Load named configurations

- [ ] localStorage-based named studies: save current state as "Study: 33/11kV Substation A"
- [ ] Study picker dropdown in header
- [ ] Import/export studies as JSON files
- [ ] Compare two studies side-by-side (stretch goal)

### 6.5 Enhanced export

- [ ] Export to CSV (fault % table data)
- [ ] Branded PDF template with company name/logo field
- [ ] Include coordination margin annotations in PDF chart
- [ ] Add page numbers and document reference fields

---

## Sprint 7 — Advanced Features & Monetization

> **Goal:** Build the moat. Create features that justify a subscription.
> **Effort:** Ongoing
> **Depends on:** Sprint 6

### 7.1 Fuse and MCB TCC curves

- [ ] Add a library of standard fuse TCC curves (BS 88, IEC 60269)
- [ ] Add MCB trip curves (B, C, D types per IEC 60898)
- [ ] Overlay on the same log-log chart for coordination with relay curves
- [ ] Source: digitized from manufacturer datasheets (or user can input points)

### 7.2 Cable and transformer damage curves

- [ ] Cable adiabatic damage curve: `I^2 * t = k^2 * S^2` (user inputs conductor size, material)
- [ ] Transformer through-fault withstand curve (ANSI/IEEE C57.109)
- [ ] Transformer inrush current envelope (12x for 0.1s, decaying)
- [ ] All overlaid on the coordination chart

### 7.3 Motor starting curve overlay

- [ ] Starting current curve: `I_start` = 6-8x FLC, decaying to FLC over start time
- [ ] Locked rotor thermal limit
- [ ] Helps engineers verify relay doesn't trip during motor start

### 7.4 User accounts & cloud storage

- [ ] Auth via email magic link or Google OAuth
- [ ] Cloud-synced studies (replace localStorage for logged-in users)
- [ ] Study history and versioning

### 7.5 Freemium gate

- [ ] **Free tier:** 2 relays, IEC Standard Inverse only, no PDF export
- [ ] **Pro tier ($5-15/month or $49-149/year):** All curve types, 8 relays, PDF export, cloud save, sharing, fuse/cable curves
- [ ] **Institutional tier ($200-500/year):** Campus/team license, branded reports, priority support

### 7.6 Multi-bus / radial feeder view (stretch)

- [ ] Single-line diagram editor for radial feeders
- [ ] Place relays at each bus
- [ ] Auto-compute fault current at each bus (impedance accumulation)
- [ ] Visual coordination waterfall

---

## Architecture Decision Record

### Why vanilla JS + Vite (not React/Vue/Svelte)?

| Factor | Decision |
|--------|----------|
| Current codebase | Already 100% vanilla JS — preserves all existing code |
| Bundle size | Zero runtime overhead — important for PWA/mobile |
| Learning curve | None — no new framework to learn |
| Performance | Direct DOM manipulation is faster for canvas-heavy apps |
| When to reconsider | If codebase exceeds ~5000 lines or complex form state becomes unmanageable, consider Svelte (compiles away, no runtime) |

### Why PWA (not Tauri/Electron)?

| Factor | Decision |
|--------|----------|
| Install friction | PWA: zero (just visit URL). Tauri: download + install binary. |
| Offline support | PWA service worker handles this natively |
| Distribution | No app store needed. Auto-updates on deploy. |
| Binary size | PWA: 0 bytes. Tauri: ~3 MB. Electron: ~100 MB. |
| When to reconsider | If desktop-specific features needed (filesystem, OS integrations), consider Tauri for Sprint 7+ |

---

## Validation Milestones

| Milestone | Sprint | Signal |
|-----------|--------|--------|
| Share existing tool on LinkedIn + engineering forums | Pre-Sprint 0 | Gauge organic interest |
| Post audit-fixed version with curve type selector | After Sprint 4 | Feature requests = market confirmation |
| 100 unique weekly users (analytics) | After Sprint 5 | Product-market fit signal |
| First institutional inquiry | After Sprint 6 | Revenue model viable |
| 10 paying subscribers | Sprint 7 | Sustainable development |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Over-engineering before validation | High | Wasted effort | Share current tool ASAP. Only build Sprint 4+ if organic interest exists. |
| Single-file to multi-file migration breaks deployment | Medium | Downtime | Keep old `simulator.html` as redirect. Test on staging first. |
| IEEE curve constants are wrong | Low | Credibility loss | Cross-reference with IEC 60255-151 and IEEE C37.112 standards. Add automated tests for known trip time values. |
| Enterprise tools add free tiers | Low | Market shrink | Our advantage is simplicity and speed, not features. ETAP adding a free tier wouldn't match our UX. |
| PWA install prompt blocked by browsers | Low | Reduced adoption | PWA works as a regular website even without install. Install is a bonus, not required. |
