# Overcurrent Relay Simulator — Audit Report

**Date:** 2026-03-25
**Scope:** Full codebase (`simulator.html`, 1375 lines)
**Auditor:** Claude Code (Opus 4.6)

## Executive Summary

- **Total issues found: 28**
- **Critical: 1 | High: 7 | Medium: 12 | Low: 8**
- **Top 3 areas of concern:**
  1. **XSS vulnerabilities** — User-controlled strings (relay labels, remarks) are injected into `innerHTML` and `document.write()` without HTML escaping at 7+ interpolation points
  2. **Disabled relay cards still accept input** — Only visual opacity change, no pointer-events blocking
  3. **No mobile/touch support** — Zero breakpoints below 1080px, tooltips are mouse-only, touch targets are undersized

### Core Engineering Assessment

**The math is correct.** The IEC 60255 Standard Inverse formula, fault current derivation, log-log coordinate mapping, and table/chart consistency are all sound. No calculation bugs were found.

---

## Findings

### 1. Math & Engineering Accuracy

#### [CORRECT] IEC 60255 Standard Inverse formula
- **Location:** `simulator.html:612-616`
- **Assessment:** `t = (0.14 / (Math.pow(ratio, 0.02) - 1)) * tms` correctly implements the standard. Constants 0.14 (k) and 0.02 (alpha) are correct. The `ratio <= 1` guard correctly returns `Infinity`.

#### [CORRECT] Fault current derivation
- **Location:** `simulator.html:596-599`
- **Assessment:** `I = (MVA * 1000) / (kV * sqrt(3) * Z%/100)` is the correct three-phase short-circuit formula. The `kv <= 0 || zPct <= 0` guard prevents division by zero.

#### [CORRECT] Log-log coordinate mapping
- **Location:** `simulator.html:862-863`
- **Assessment:** `mapX` and `mapY` use standard log10 interpolation. Y-axis is correctly inverted.

#### [CORRECT] Table-chart consistency
- **Location:** `simulator.html:741-791`
- **Assessment:** `updateTable()` uses the same `tripTime()`, `getIset()`, and fault derivation functions as the chart. Values are consistent.

#### [MEDIUM] Pickup multiplier allows zero — division-by-zero semantics
- **Location:** `simulator.html:645, 680`
- **Problem:** HTML `min="0"` and JS `Math.max(0, ...)` allow `pickupMul = 0`, making `Iset = 0`. This produces `tripTime()` result of 0 via `If / 0 = Infinity -> ... -> 0 * tms = 0`. Display shows "No pickup" (guarded at line 728) but behavior is inconsistent.
- **Impact:** Misleading display for an unrealistic parameter value.
- **Fix:** Change HTML `min` to `"0.01"` and JS clamp to `Math.max(0.01, ...)`.

#### [MEDIUM] TMS has no JavaScript-side clamping
- **Location:** `simulator.html:649, 681`
- **Problem:** HTML declares `min="0.10"` but JS applies no clamping: `relays[idx].tms = val`. User can type 0 or negative values directly, producing 0 or negative trip times.
- **Impact:** Physically meaningless results displayed without warning.
- **Fix:** Add `Math.max(0.05, Math.min(1.0, val))` clamping.

#### [MEDIUM] No warning when Primary kV <= Secondary kV
- **Location:** N/A (missing validation)
- **Problem:** Users can enter `priKV = 11` and `secKV = 33` (swapped). Formulas produce valid but misleading results since fault currents would be associated with the wrong relay groups.
- **Impact:** Silently incorrect relay coordination analysis.
- **Fix:** Add a visual warning (not a hard block) when `priKV <= secKV`.

#### [MEDIUM] Fault slider allows 0%
- **Location:** `simulator.html:463`
- **Problem:** `min="0"` allows 0% fault level, which is physically meaningless in relay coordination studies. All relays show "No trip".
- **Impact:** Confusing UX for an impossible scenario.
- **Fix:** Change `min` to `"5"` or `"10"`.

#### [LOW] CT Primary not clamped in JavaScript
- **Location:** `simulator.html:641, 679`
- **Problem:** No JS-side floor. Users can enter fractional or very small CT ratios. Not a math error but unrealistic.
- **Fix:** Add `Math.max(1, Math.round(val))`.

---

### 2. State & Persistence

#### [MEDIUM] `setTimeout(0)` for remarks causes data loss on load-then-close
- **Location:** `simulator.html:556-559`
- **Problem:** Remarks are restored via `setTimeout(0)`, which fires *after* the synchronous init sequence. The init calls `refresh()` -> `saveState()`, which reads the still-empty remarks textarea and overwrites localStorage with empty remarks. If the user closes the tab without interacting, remarks are permanently lost.
- **Impact:** Silent data loss of remarks field on page reload.
- **Fix:** Restore remarks synchronously before `refresh()`, or skip `saveState()` in the initial `refresh()` call.

#### [MEDIUM] Incomplete relay field migration — empty labels overwritten
- **Location:** `simulator.html:550-554`
- **Problem:** `if (!r.label)` uses falsy check, so an intentionally empty label `""` is overwritten with the default. Only `label` and `side` are migrated; other fields could be missing from older state formats.
- **Impact:** Label customizations lost on reload; future field additions could break.
- **Fix:** Use `r.label === undefined` instead of `!r.label`. Merge all fields with defaults.

#### [LOW] Partial `tx` object not merged field-by-field
- **Location:** `simulator.html:547`
- **Problem:** `tx = s.tx || DEFAULTS.tx` accepts a partial `tx` object as-is. Missing fields become `undefined`.
- **Impact:** Latent risk if stored state has missing transformer params.
- **Fix:** Use `{ ...DEFAULTS.tx, ...s.tx }`.

#### [LOW] Relay array length mismatch not enforced
- **Location:** `simulator.html:549`
- **Problem:** If stored state has fewer than 4 relays, the UI expects exactly 4. No padding or truncation.
- **Impact:** Latent risk for corrupted state.
- **Fix:** Enforce `relays.length === 4` after loading.

#### [LOW] `resetToDefaults()` does not clear remarks itself
- **Location:** `simulator.html:566-575`
- **Problem:** Relies on caller (line 1054) to clear the textarea before calling reset. Coupling risk if called from elsewhere.
- **Fix:** Move `document.getElementById('remarksField').value = ''` into `resetToDefaults()`.

#### [LOW] No debouncing on rapid input events
- **Location:** `simulator.html:668-684, 1030-1040`
- **Problem:** Every keystroke triggers full `refresh()` (chart redraw, table rebuild, localStorage write). On low-end devices, rapid typing in numeric fields may cause input lag.
- **Impact:** Performance on slow devices.
- **Fix:** Debounce `refresh()` by ~150ms on text/number inputs.

---

### 3. Chart & Rendering

#### [HIGH] `drawChart()` shows orphan fault lines for disabled relay sides
- **Location:** `simulator.html:952-958`
- **Problem:** Fault line relay arrays are built *without* filtering for `r.enabled`:
  ```js
  const priRelays = relays.map((r, i) => r.side === 'pri' ? i : -1).filter(x => x >= 0);
  ```
  The inner loop (line 973) checks `if (!r.enabled) return`, so operating points are skipped, but the vertical fault line itself is drawn even when ALL relays on that side are disabled. `renderBWChart()` (line 1317) correctly filters: `r.enabled && r.side === 'pri'`.
- **Impact:** Orphan "PRI: 1234A" or "SEC: 5678A" lines visible on chart with no associated operating points.
- **Fix:** Add `r.enabled &&` to the filter at lines 953/957 and wrap with `if (priRelays.length)` guard, matching `renderBWChart()`.

#### [MEDIUM] Curve labels overlap when multiple curves have similar parameters
- **Location:** `simulator.html:934-944`
- **Problem:** All labels positioned at 80% of X-range. If two relays have similar `iset`/`tms`, labels overlap and become unreadable.
- **Impact:** Visual defect making curves indistinguishable.
- **Fix:** Stagger label X positions per relay index (e.g., 60%, 70%, 80%, 90%).

#### [MEDIUM] No resize debouncing
- **Location:** `simulator.html:1366`
- **Problem:** `window.addEventListener('resize', () => drawChart())` fires ~60 times/second during resize. Each call renders ~27,000 line segments.
- **Impact:** CPU churn and jank during window resizing.
- **Fix:** Debounce with `clearTimeout`/`setTimeout` at ~100ms.

#### [LOW] Tooltip has no vertical clamping
- **Location:** `simulator.html:1024-1025`
- **Problem:** Horizontal position is clamped but vertical is not. Tooltip can overflow above/below the canvas wrapper.
- **Fix:** Add `Math.max(0, Math.min(my - 10, rect.height - ttRect.height))`.

#### [LOW] Tooltip horizontal clamp hardcodes 260px (CSS max-width is 320px)
- **Location:** `simulator.html:1024`
- **Problem:** `Math.min(mx + 15, rect.width - 260)` — mismatch with `max-width: 320px` in CSS.
- **Fix:** Use measured tooltip width instead of hardcoded value.

---

### 4. UI & Responsiveness

#### [HIGH] No mobile breakpoints below 1080px
- **Location:** `simulator.html:81, 98, 172`
- **Problem:** The only breakpoint is `@media (max-width: 1080px)` for single-column. At 320px:
  - `.tx-fields` (4-column grid) renders ~60px-wide inputs — unusable
  - `.card-fields` (3-column grid) renders ~80px-wide inputs — cramped
  - `.app` padding wastes 15% of viewport
- **Impact:** App is barely usable on mobile phones.
- **Fix:** Add breakpoints at 540px and 360px collapsing grids to 2-column and 1-column.

#### [HIGH] Tooltips are mouse-only — broken on touch devices
- **Location:** `simulator.html:1000-1027`
- **Problem:** Only `mousemove` and `mouseleave` events. Touch devices get no tooltip functionality.
- **Impact:** Core feature (interactive curve inspection) is invisible on mobile/tablet.
- **Fix:** Add `touchmove` and `touchend` event listeners with same logic.

#### [HIGH] Disabled relay cards still accept input
- **Location:** `simulator.html:122`
- **Problem:** `.relay-card.disabled { opacity: 0.25; }` — only visual change, no `pointer-events: none`. Users can modify parameters on disabled relays without realizing.
- **Impact:** Accidental state changes to disabled relays.
- **Fix:** Add `pointer-events: none` with `.toggle-wrap { pointer-events: auto; }` carve-out.

#### [HIGH] Reset/Export buttons are `<div>` elements — not keyboard accessible
- **Location:** `simulator.html:484-485`
- **Problem:** `<div class="reset-btn">` and `<div class="export-btn">` have no `tabindex`, no `role="button"`, no keyboard handler. Keyboard-only users cannot activate them.
- **Impact:** Accessibility failure — critical actions unreachable via keyboard.
- **Fix:** Change to `<button>` elements.

#### [HIGH] Zero ARIA labels in the entire document
- **Location:** Throughout
- **Problem:** No `aria-label`, `aria-labelledby`, or `role` attributes. The `<canvas>` has no `role="img"`, toggles have no label, slider has no `aria-label`.
- **Impact:** Screen reader users cannot use the tool at all.
- **Fix:** Add ARIA labels to canvas, toggles, slider, and buttons.

#### [MEDIUM] Stale print labels after editing
- **Location:** `simulator.html:626, 635-636`
- **Problem:** `.print-label` and `.print-params` spans are set at `buildCards()` time. Label and parameter edits do NOT update these spans (only `refresh()` is called, not `buildCards()`). Ctrl+P printing shows stale values.
- **Impact:** Print output shows wrong relay labels/parameters.
- **Fix:** Update `printLabel` and `printParams` spans in the label handler and `updateResults()`.

#### [MEDIUM] Touch targets are undersized
- **Location:** `simulator.html:183, 142, 157, 319-323`
- **Problem:** `.num-input` padding is 6px (~28px tall), `.label-input` is 3px (~22px tall), toggle is 34x18px. Minimum recommended: 44x44px.
- **Impact:** Difficult to tap accurately on mobile.
- **Fix:** Increase padding at mobile breakpoints.

#### [MEDIUM] Range slider only styled for WebKit
- **Location:** `simulator.html:319-323, 463`
- **Problem:** Only `::-webkit-slider-thumb` is styled. Firefox users get unstyled default. Inline `style` on the `<input>` also only uses `-webkit-appearance`.
- **Impact:** Poor UX on Firefox.
- **Fix:** Add `-moz-range-thumb` and `-moz-range-track` rules.

#### [MEDIUM] `inset` and `aspect-ratio` CSS compatibility
- **Location:** `simulator.html:33, 160, 285`
- **Problem:** `inset` not supported in Safari < 14.1. `aspect-ratio` not supported in Safari < 15 (canvas would have zero height).
- **Impact:** Broken layout on older Safari versions (~1-2% of users).
- **Fix:** Replace `inset` with `top/right/bottom/left`. Add `padding-bottom` fallback for `aspect-ratio`.

#### [LOW] Color contrast borderline on panel backgrounds
- **Location:** `simulator.html:15 (--text-dim), 11 (--panel)`
- **Problem:** `#64748b` on `#111827` is ~4.2:1 — fails WCAG AA. Used for field labels at tiny font sizes (0.57rem).
- **Fix:** Lighten `--text-dim` to `#8494a7` (~5.5:1).

#### [LOW] `<label>` elements not associated with inputs
- **Location:** `simulator.html:436-448, 640-648`
- **Problem:** No `for`/`id` linking. Clicking labels doesn't focus inputs.
- **Fix:** Add `for`/`id` pairs.

---

### 5. PDF Export

#### [CORRECT] Export data matches on-screen data
- **Assessment:** Export uses the same `tripTime()`, `getIset()`, and fault derivation functions. Transformer params, relay settings table, and fault % table all match.

#### [CORRECT] B&W chart resolution is adequate
- **Assessment:** 2400x1500 at PNG quality 1.0 = 8x5 inches at 300 DPI. Font sizes (22-26px) are appropriately scaled.

#### [MEDIUM] Stale print-only spans in Ctrl+P path
- **Location:** `simulator.html:626, 635-636`
- **Problem:** (Same as UI finding above.) The `.print-label` and `.print-params` spans in the main document are stale after edits. The PDF export function generates its own HTML and is NOT affected — but Ctrl+P browser printing IS affected.
- **Impact:** Wrong labels/params in Ctrl+P output.
- **Fix:** Update these spans on every relevant state change.

---

### 6. Code Quality & Security

#### [CRITICAL] XSS — User strings injected into innerHTML/document.write without escaping
- **Location:** 7 interpolation points across the codebase:
  1. `simulator.html:625` — `value="${r.label}"` in buildCards template
  2. `simulator.html:626` — `>${r.label}</span>` in buildCards template
  3. `simulator.html:693` — `${name}` in buildLegend innerHTML
  4. `simulator.html:1017` — `${name}` in tooltip innerHTML
  5. `simulator.html:1086` — `${r.label}` in export settings table
  6. `simulator.html:1118` — `${r.label}` in export fault table header
  7. `simulator.html:1179` — `${remarks.replace(...)}` in export remarks
- **Problem:** Relay labels (maxlength 30, but localStorage can be edited) and remarks are interpolated raw. A label like `"><svg onload=alert(1)>` (24 chars, within maxlength) executes arbitrary JS.
- **Impact:** Stored XSS. In the export window (`document.write()`), scripts execute in a new browsing context. For a single-user local tool the risk is lower, but localStorage poisoning from another same-origin script is possible.
- **Fix:** Add a single `escapeHTML()` utility and apply at all 7 points:
  ```js
  function escapeHTML(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  ```

#### [MEDIUM] ~155 lines of duplicated logic between drawChart() and renderBWChart()
- **Location:** `simulator.html:793-997` vs `1190-1355`
- **Problem:** Axis auto-fit, `logTicks()`, grid drawing, axis labels, curve drawing loops, and fault vertical lines are nearly identical between the two functions (~155 of 165 lines in `renderBWChart`).
- **Impact:** Maintenance burden — bugs fixed in one must be replicated in the other (as evidenced by the fault line filtering inconsistency).
- **Fix:** Extract shared logic into a parameterized renderer accepting a config/theme object.

#### [LOW] Dead code — unused variable in buildLegend()
- **Location:** `simulator.html:689`
- **Problem:** `const iset = getIset(r)` is computed but never used.
- **Fix:** Remove the line.

#### [LOW] Magic numbers throughout
- **Location:** Multiple
- **Problem:** IEC constants (0.14, 0.02), sampling parameters (1.008, 1.01, 30), axis padding (0.15, 0.25), fallback ranges (50, 25000, 0.1, 100), export dimensions (2400, 1500), print delay (400ms) are all hardcoded.
- **Fix:** Define as named constants at the top of the script block.

#### [LOW] Browser compatibility — IE11 unsupported, Safari <15 partially broken
- **Location:** Throughout
- **Problem:** ES6 syntax (template literals, `const`/`let`, arrow functions), CSS `aspect-ratio`, `inset`, flex `gap` — not supported in IE11. `aspect-ratio` not in Safari <15.
- **Impact:** Negligible for modern target audience. Safari <15 is the only concern (~1-2%).
- **Fix:** Add CSS fallbacks for `inset` and `aspect-ratio`.

---

## Standalone App & Market Viability Assessment

### Market Landscape Summary

| Tier | Examples | Cost | Gap vs. This Simulator |
|------|----------|------|----------------------|
| Enterprise | ETAP, PowerFactory, SKM, EasyPower | $8K-$100K+/year | Massive overkill for quick checks |
| Mid-range | ELEK Cable Pro, MATLAB tools | $29-$900/year | Still requires accounts/installation |
| Free calculators | jCalc.net, SparkyCalc, ea-guide.com | Free | **Single-relay only, no multi-curve overlay, no transformer context** |
| Mobile apps | Effectively nonexistent | N/A | **Completely empty space** |

### The Gap is Real

No free tool exists that combines:
1. Multi-relay IDMT curves on a single log-log chart
2. Transformer-context fault derivation (MVA/kV/Z%)
3. Primary + secondary side coordination view
4. Zero-install, instant-load web app
5. PDF export with printable B&W chart

### Standalone App Recommendation

**Yes, worth pursuing — under these conditions:**

1. **Phase 1 (essential):** Add remaining IEC curves (Very Inverse: k=13.5/alpha=1.0, Extremely Inverse: k=80/alpha=2.0, Long Time: k=120/alpha=1.0) + IEEE C37.112 curves. Per-relay curve type selection. Definite time element. Convert to PWA.
2. **Phase 2 (differentiating):** 6-8 relays, coordination margin display, URL-based state sharing, fuse/MCB curves, user accounts.
3. **Phase 3 (monetization):** Cloud save, team sharing, branded reports, institutional licensing.

**Architecture path:** Stay vanilla JS with ES modules (split into `math.js`, `chart.js`, `ui.js`, `export.js`) through Phase 2. Consider Svelte for Phase 3 if the codebase exceeds ~5000 lines.

**Distribution:** PWA first (trivial to add), Tauri desktop only if needed later. Not Electron.

**Revenue model:** Open-core (free basic calculator + paid advanced features) or freemium SaaS ($5-15/month). Target education first (universities at $200-500/year campus license). Realistic potential: $2K-10K MRR within 2-3 years.

**Validation:** Share existing tool on LinkedIn, r/ElectricalEngineering, IEEE forums, Eng-Tips. Organic traction confirms the market.

---

## Fix Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | XSS — add `escapeHTML()` at 7 points | 30 min | Eliminates all security vulnerabilities |
| 2 | Disabled cards — add `pointer-events: none` | 10 min | Prevents accidental state changes |
| 3 | Remarks data loss — fix `setTimeout` sequencing | 20 min | Prevents silent data loss |
| 4 | Orphan fault lines — align `drawChart` filter | 10 min | Fixes chart visual bug |
| 5 | Div buttons -> `<button>` elements | 15 min | Keyboard accessibility |
| 6 | Mobile breakpoints (320px, 540px) | 1 hour | Makes app usable on phones |
| 7 | Touch event listeners for tooltips | 30 min | Enables core feature on mobile |
| 8 | Input validation (TMS/pickup clamping) | 20 min | Prevents meaningless results |
| 9 | Stale print labels/params | 20 min | Fixes Ctrl+P output |
| 10 | Resize debouncing | 10 min | Performance improvement |
