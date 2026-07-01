---
phase: 14
slug: report-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` |
| **Config file** | none found — vitest runs with zero-config defaults (no `vitest.config.ts` in repo root) |
| **Quick run command** | `npx vitest run src/scripts/generate-report.test.ts` (or `src/data/market.test.ts` / `src/scripts/report-charts.test.ts` / `src/scripts/update-index.test.ts` once created) |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | ~30s (existing ~30 test cases across `generate-report.test.ts`, `collect-data.test.ts`, `validate-meeting.test.ts`, plus new files) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <touched-file>.test.ts`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Plan-Task | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 14-01 | 1 | UI-02 | T-14-01/02 | `fetchVixHistory()` maps `chart()` quotes to `{date, close}` (YYYY-MM-DD), filters null closes, catches errors→`[]` | unit | `npx vitest run src/data/market.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 14-01-T2 | 14-01 | 1 | UI-02 | — | `collect-data.test.ts` mock stays shape-consistent (`vixHistory: []`) | unit | `npx vitest run src/scripts/collect-data.test.ts` | ✅ extend | ⬜ pending |
| 14-02-T1 | 14-02 | 1 | UI-02 | T-14-03/04 | `renderSectorBarChart` sorts descending, colors green/red, empty→"データ取得エラー", viewBox+width:100% | unit | `npx vitest run src/scripts/report-charts.test.ts -t "sector"` | ❌ W0 (task creates) | ⬜ pending |
| 14-02-T2 | 14-02 | 1 | UI-02 | T-14-03/04 | `renderVixLineChart` renders 20/30 threshold lines, empty→"データ取得エラー", viewBox not fixed px | unit | `npx vitest run src/scripts/report-charts.test.ts -t "vix"` | ❌ W0 (task creates) | ⬜ pending |
| 14-03-T1 | 14-03 | 2 | UI-02 | T-14-05/06 | `generateDailyReportHtml` includes both chart SVGs when market data present; empty→"データ取得エラー" | integration | `npx vitest run src/scripts/generate-report.test.ts -t "chart"` | ⚠️ W0 (extend) | ⬜ pending |
| 14-03-T2 | 14-03 | 2 | UI-02 | T-14-05/06 | `loadMarketData()` reads market.json with empty-fallback; main() threads 4th arg | integration | `npx vitest run src/scripts/generate-report.test.ts` | ⚠️ W0 (extend) | ⬜ pending |
| 14-04-T1 | 14-04 | 1 | UI-01 | T-14-07/08 | `update-index.ts` groups by month, newest month `open`, older not, preserves 2-link entries, deterministic | unit | `npx vitest run src/scripts/update-index.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 14-04-T2 | 14-04 | 1 | UI-01 | T-14-09 | docs/index.html has region markers + hero/accordion/`@media (max-width: 768px)` CSS, theme preserved | grep-gate | `bash -c 'grep -q "/REPORT_ENTRIES" docs/index.html && grep -q "max-width: 768px" docs/index.html && grep -q "month-group" docs/index.html'` | ✅ edit | ⬜ pending |
| 14-05-T1 | 14-05 | 1 | UI-01 | T-14-11 | Mobile media query present in `generateBaseStyles()` (`@media (max-width: 768px)`, overflow-x, 44px) | unit | `npx vitest run src/scripts/report-utils.test.ts` | ❌ W0 (task creates) | ⬜ pending |
| 14-05-T2 | 14-05 | 1 | UI-01 | T-14-10/11 | docs/portfolio.html responsive `@media (max-width: 768px)`, green accent preserved | grep-gate | `bash -c 'grep -q "max-width: 768px" docs/portfolio.html && grep -q "overflow-x: auto" docs/portfolio.html'` | ✅ edit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs bound to actual PLAN.md tasks by the planner (2026-07-01). Note: the responsive-CSS check moved from generate-report.test.ts to a new report-utils.test.ts to avoid a same-wave file-write collision with Plan 14-03.*

---

## Wave 0 Requirements

- [ ] `src/scripts/report-charts.test.ts` — new file, covers UI-02 chart rendering (sort order, colors, empty-state, viewBox presence)
- [ ] `src/data/market.test.ts` — new file, covers `fetchVixHistory()` mapping/error-tolerance (mock `yahoo-finance2` the same way `collect-data.test.ts` already does)
- [ ] `src/scripts/update-index.test.ts` — new file, covers month-grouping/accordion logic; no existing test infrastructure for `update-index.ts` at all currently
- [ ] Extend `src/scripts/generate-report.test.ts`'s `"Daily Report"` describe block with cases for market-data-present and market-data-empty scenarios
- [ ] Extend `collect-data.test.ts`'s `mockMarketData` object to include `vixHistory: []` so the mock stays type-consistent with the updated `fetchAllMarketData()` return shape

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile layout renders without breakage at 375px width | UI-01 | Visual/layout correctness cannot be asserted by unit tests alone | Open generated `docs/YYYY-MM-DD/index.html` in a browser, resize viewport to 375px (or use DevTools device toolbar), confirm no horizontal overflow, links/text are readable and tappable |
| Bloomberg-style dark theme is preserved and reads as "modernized" | Success Criterion 3 | Subjective visual/design judgment | Visual review of generated report against prior report screenshots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
