# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive overcurrent relay simulator implementing the **IEC 60255 Standard Inverse** time-current characteristic. Calculates trip times for up to 4 relays on a transformer's primary/secondary sides.

**Formula:** `t = (k / ((I_fault / I_set)^alpha - 1)) x TMS` where k=0.14, alpha=0.02 for Standard Inverse.

**Deployed on:** Vercel (previously Netlify)

## Commands

```bash
# Development server (hot reload)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

The legacy `simulator.html` still works standalone (open directly in browser), but the primary codebase is now modular ES modules built with Vite.

## Architecture

**Modular ES modules + Vite.** The app was split from a single-file (`simulator.html`) into clean modules.

### File structure

```
index.html              # Entry point HTML (Vite root)
simulator.html          # Legacy standalone version (still functional)
vite.config.js          # Vite config (build to dist/)
netlify.toml            # Netlify deploy config + redirects
src/
  main.js               # Entry point — init, event wiring, refresh loop
  constants.js           # Colors, defaults, IEC constants, chart params, utilities
  math.js                # Pure math: calcFaultCurrent, tripTime, getIset, fault derivation
  state.js               # Mutable state object, localStorage save/load/reset
  chart.js               # Unified chart renderer (screen + print via theme objects)
  ui.js                  # DOM: buildCards, buildLegend, updateResults, updateTable
  export.js              # PDF export
  tooltip.js             # Mouse + touch tooltip handlers
  style.css              # All CSS (dark theme, responsive, print styles)
```

### Module dependency graph (acyclic)

```
constants.js  ← leaf, no imports
    ↑
math.js       ← imports constants
    ↑
state.js      ← imports constants
chart.js      ← imports constants, math
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

Each relay: `side` (pri/sec), `ctPri` (CT primary), `pickupMul` (pickup multiplier, min 0.01), `tms` (time multiplier setting, 0.05-1.0), `enabled`, `label`. Relays 0-1 default to primary side, 2-3 to secondary.

### Key conventions

- `refresh()` must be called after any state change — it recomputes everything (display, legend, results, table, chart, localStorage save)
- Text/number inputs use `debouncedRefresh()` (150ms). Slider and toggle use immediate `refresh()`.
- Chart uses log-log scale with auto-fit axis ranges based on active relay curves
- Chart rendering is parameterized via theme objects — no code duplication between screen and print
- All user-provided strings (labels, remarks) are sanitized with `escapeHTML()` before innerHTML insertion
- Fault current is derived from transformer params: `I_fault = (MVA x 1000) / (kV x sqrt(3) x Z%/100)`
- `I_set = CT_Primary x Pickup_Multiplier`
- Named constants in `constants.js` for all IEC values and chart parameters

### Current capabilities

Single-page simulator with: 4 configurable relays (pri/sec), transformer parameter derivation, fault level slider (5-100%), live log-log chart with tooltips (mouse + touch), results table at 10% intervals, custom labels, remarks field, PDF export with B&W chart, localStorage persistence, reset to defaults, kV mismatch warning, input validation with clamping, debounced updates.
