# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive overcurrent relay simulator supporting **IEC 60255** and **IEEE C37.112** IDMT curve types. Calculates trip times for up to 4 relays on a transformer's primary/secondary sides with per-relay curve selection.

**Formula:** `t = (k / ((I_fault / I_set)^alpha - 1) + beta) x TMS` — IEC curves have beta=0, IEEE curves have beta>0.

**Supported curves:** IEC Standard Inverse, Very Inverse, Extremely Inverse, Long Time Inverse; IEEE Moderately Inverse, Very Inverse, Extremely Inverse.

**Deployed on:** Vercel at https://power-system-tool.vercel.app/

## Commands

```bash
# Development server (hot reload)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

The codebase is modular ES modules built with Vite.

## Architecture

**Modular ES modules + Vite.**

### File structure

```
index.html              # Entry point HTML (Vite root)
vite.config.js          # Vite config (build to dist/)
src/
  main.js               # Entry point — init, event wiring, refresh loop
  constants.js           # Colors, defaults, IEC/IEEE constants, chart params, utilities
  math.js                # Pure math: calcFaultCurrent, tripTime, getIset, fault derivation
  state.js               # Mutable state object, localStorage save/load/reset
  chart.js               # Unified chart renderer (screen + print via theme objects)
  ui.js                  # DOM: buildCards, buildLegend, updateResults, updateTable, CTI summary
  export.js              # PDF and CSV export
  tooltip.js             # Mouse + touch tooltip handlers
  cti.js                 # Coordination time interval computation
  overlays.js            # Coordination overlay curves (cable, TX inrush/withstand, MCB)
  sharing.js             # URL-based state encoding/decoding for sharing
  studies.js             # Named study management (save/load/delete/import/export)
  style.css              # All CSS (dark theme, responsive, print styles)
```

### Module dependency graph (acyclic)

```
constants.js  ← leaf, no imports
    ↑
math.js       ← imports constants
    ↑
state.js      ← imports constants
overlays.js   ← imports constants, math
chart.js      ← imports constants, math, overlays
ui.js         ← imports constants, math
tooltip.js    ← imports constants, math
export.js     ← imports constants, math, chart
    ↑
main.js       ← imports all, entry point
```

### Key modules

- **`math.js`** — Pure functions, no DOM access, no global state. All take parameters and return values.
- **`state.js`** — Exports mutable `state` object (`state.tx`, `state.faultPct`, `state.relays`). All modules read/write through this.
- **`chart.js`** — Unified `renderChart(canvas, { relays, tx, faultPct, theme })`. Two exported themes: `SCREEN_THEME` (colored, DPR-aware) and `PRINT_THEME` (B&W, high-res offscreen). Eliminates the old 155-line duplication between `drawChart`/`renderBWChart`.
- **`main.js`** — Defines `refresh()` (the central update loop) and `debouncedRefresh()`. Wires all events. Runs init sequence.

### Relay model

Each relay: `side` (pri/sec), `ctPri` (CT primary), `pickupMul` (pickup multiplier, min 0.01), `tms` (time multiplier setting, 0.05-1.0), `curveType` (key into `CURVES` object, e.g. `'IEC_SI'`, `'IEEE_VI'`), `enabled`, `label`, `dtEnabled` (high-set DT toggle), `dtPickupMul` (DT pickup as CT primary multiple, 1.0-50), `dtDelay` (fixed DT delay in seconds, 0-1.0). Default 4 relays, supports 1-8 (MIN_RELAYS/MAX_RELAYS). Side is user-selectable per relay via dropdown. New relays added via `defaultRelay(index)` factory.

### Key conventions

- `refresh()` must be called after any state change — it recomputes everything (display, legend, results, table, chart, localStorage save)
- Text/number inputs use `debouncedRefresh()` (150ms). Slider and toggle use immediate `refresh()`.
- Chart uses log-log scale with auto-fit axis ranges based on active relay curves
- Chart rendering is parameterized via theme objects — no code duplication between screen and print
- All user-provided strings (labels, remarks) are sanitized with `escapeHTML()` before innerHTML insertion
- Fault current is derived from transformer params: `I_fault = (MVA x 1000) / (kV x sqrt(3) x Z%/100)`
- `I_set = CT_Primary x Pickup_Multiplier`
- Named constants in `constants.js` for all IEC/IEEE values and chart parameters
- `CURVES` object in `constants.js` defines all curve types with `k`, `alpha`, `beta`, `label`, `short`, `standard`
- `tripTime()` accepts an optional `curve` parameter (defaults to `CURVES.IEC_SI`)
- `effectiveTripTime()` returns `min(IDMT, DT)` when DT is enabled and fault exceeds DT pickup
- DT element drawn as dashed horizontal line on chart from DT pickup to right edge

### Current capabilities

Single-page PWA simulator with: 1-8 configurable relays (dynamic add/remove) with per-relay side and IEC/IEEE curve selection (7 curve types), optional high-set definite time (DT) element per relay, coordination overlay curves (cable damage BS 7671, TX inrush IEEE C37.91, TX through-fault withstand ANSI C57.109, MCB curves IEC 60898 B/C/D), transformer parameter derivation, fault level slider (5-100%), live log-log chart with DT lines, overlay curves, CTI brackets and tooltips (mouse + touch), results table at 10% intervals, coordination time interval display, custom labels, remarks field, report settings (company/project/doc ref), PDF export with B&W chart, overlay table, and CTI table, CSV export, URL-based state sharing (v2 with overlay support), named study management (save/load/delete/import/export JSON), localStorage persistence, reset to defaults, kV mismatch warning, input validation with clamping, debounced updates, mobile-responsive layout, ARIA accessibility, keyboard focus indicators, offline support via service worker, installable PWA.
