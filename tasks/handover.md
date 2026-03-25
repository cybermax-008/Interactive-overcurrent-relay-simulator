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

### Sprint 3 — Architecture Split (Sprint 2 skipped)
- Split `simulator.html` (1416 lines) into 9 ES modules + Vite build
- Unified chart renderer: merged drawChart/renderBWChart into parameterized renderChart() with theme objects (~155 lines duplication eliminated)
- Pure math module (zero DOM/state deps), clean acyclic module graph
- Build output: 21.4 KB JS + 11.8 KB CSS (7.4 KB + 2.9 KB gzipped)
- Legacy `simulator.html` preserved standalone

### Deployment config
- Added `vercel.json` for Vercel (build from dist/, redirect simulator.html → /)
- `netlify.toml` also present as fallback

## Key decisions
- **Vanilla JS + Vite** over React/Svelte — zero runtime overhead, preserves existing code
- **Theme objects for chart** — screen vs print as config, not code duplication
- **Sprint 2 skipped** — user chose architecture split first. Accessibility still on roadmap.
- **Vercel** for deployment going forward

## Next steps
1. **Commit all changes** — significant uncommitted work
2. **Deploy to Vercel** — push to GitHub, connect repo, verify build works
3. **Sprint 2 — Accessibility & Mobile** (mobile breakpoints, touch, ARIA, semantic buttons)
4. **Sprint 4 — IEC/IEEE Curve Types** (the #1 feature gap — architecture is now ready)
5. **Sprint 5 — PWA Conversion**

## Gotchas / things to watch
- `simulator.html` legacy file has Sprint 0+1 fixes but is NOT modular — will drift from `src/` modules. Consider removing once Vercel deploy is confirmed.
- `chart.js` is the largest module (377 lines) — could be further decomposed later
- `index.html` at root is the Vite entry point (not the old redirect)
- `node_modules/` and `dist/` are gitignored — Vercel runs `npm install` + `npm run build`
