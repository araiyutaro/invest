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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01 | TBD | TBD | UI-02 | — | `renderSectorBarChart` sorts descending, colors green/red correctly, handles empty array | unit | `npx vitest run src/scripts/report-charts.test.ts -t "sector"` | ❌ W0 | ⬜ pending |
| 14-02 | TBD | TBD | UI-02 | — | `renderVixLineChart` renders threshold lines at 20/30, handles empty array, uses viewBox not fixed width/height | unit | `npx vitest run src/scripts/report-charts.test.ts -t "vix"` | ❌ W0 | ⬜ pending |
| 14-03 | TBD | TBD | UI-02 | — | `fetchVixHistory()` maps `chart()` quotes to `{date, close}` shape, filters null closes, catches errors→`[]` | unit | `npx vitest run src/data/market.test.ts` | ❌ W0 | ⬜ pending |
| 14-04 | TBD | TBD | UI-02 | — | `generateDailyReportHtml` output includes both chart SVGs when market data present | integration | `npx vitest run src/scripts/generate-report.test.ts -t "chart"` | ⚠️ W0 (extend) | ⬜ pending |
| 14-05 | TBD | TBD | UI-01 | — | `update-index.ts` groups entries by month, latest month has `open` attribute, older months don't | unit | `npx vitest run src/scripts/update-index.test.ts` | ❌ W0 | ⬜ pending |
| 14-06 | TBD | TBD | UI-01 | — | Mobile CSS media query present in `generateBaseStyles()` output (`@media (max-width: 768px)`) | unit | `npx vitest run src/scripts/generate-report.test.ts -t "responsive"` | ⚠️ W0 (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner assigns final plan/wave IDs; this table is refreshed by the planner/checker against actual PLAN.md task IDs.*

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
