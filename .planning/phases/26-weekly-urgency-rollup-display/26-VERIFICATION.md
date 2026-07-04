---
phase: 26-weekly-urgency-rollup-display
verified: 2026-07-04T17:20:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 26: Weekly Urgency Rollup Display Verification Report

**Phase Goal:** ユーザーは portfolio.html（portfolio-report.html）上で、直近1週間にどの保有銘柄が緊急フラグや判断変更の対象になったかを振り返ることができる
**Verified:** 2026-07-04T17:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | portfolio.html に見出し「今週の緊急・判断変更ロールアップ」を持つ週次ロールアップセクションが存在する（新規ページ追加なし） | ✓ VERIFIED | `src/scripts/generate-portfolio-report.ts:118` emits `<h2>今週の緊急・判断変更ロールアップ</h2>` inside `formatWeeklyUrgencyRollupHtml`, interpolated into `generatePortfolioReportHtml`'s existing single template (no new HTML file/page created) |
| 2 | ロールアップは data/urgency-history.json の直近7日間のエントリから、銘柄ごとの緊急フラグ発生日・判断変更を集計して表示する | ✓ VERIFIED | `computeWeeklyUrgencyRollup` (src/portfolio/urgency-rollup.ts:79-153) filters to `[anchor-6, anchor]` inclusive window, builds per-symbol timeline of urgent dates + adjacent-recorded-date decision diffs; live repro against a 3-entry fixture produced exactly `⚠ 緊急フラグ: 06/28, 07/01` and `判断変更: 06/30 保持 → 一部売却`, matching UI-SPEC |
| 3 | 履歴データが0件または7日に満たない場合でもエラーにならず、3段階のフォールバックで適切な空状態・部分表示を示す | ✓ VERIFIED | Tier 1 (0 valid history entries) / Tier 2 (history exists, 0 movement) / Tier 3 (<7 days, footnote) all implemented in `formatWeeklyUrgencyRollupHtml`; live repro of Tier 3 produced `（過去3日分の履歴に基づく）`; 63 tests in generate-report.test.ts cover all three tiers plus null-portfolioAnalysis fail-soft branch |
| 4 | computeWeeklyUrgencyRollup never throws, even on calendar-invalid anchor, non-object history root, or corrupt snapshot fields (post-review-fix) | ✓ VERIFIED | Live `npx tsx` repro: `computeWeeklyUrgencyRollup({}, "2026-13-01")` → no throw, empty rollup; `computeWeeklyUrgencyRollup(null, "2026-07-01")` → no throw, empty rollup; `generatePortfolioReportHtml` with `nameJa: 12345` snapshot → no throw, entry safely skipped |
| 5 | loadUrgencyHistory reads data/urgency-history.json fail-soft ({} on missing/corrupt/non-object-root, console.warn) | ✓ VERIFIED | `src/scripts/report-data-loaders.ts:143-159`: try/catch around readFile+JSON.parse, additional root-shape guard (null/array/primitive) added post-review-fix (CR-02), returns `{}` with `console.warn` in all failure paths; 8 tests in report-data-loaders.test.ts cover success/ENOENT/parse-fail/null-root/array-root |
| 6 | generate-report.ts wires the loader into the pipeline and passes history as the 4th arg | ✓ VERIFIED | `src/scripts/generate-report.ts:9` imports `loadUrgencyHistory`; line 122 includes it as an 11-way `Promise.all` entry destructured as `urgencyHistory`; line 153 passes it as 4th arg to `generatePortfolioReportHtml` |
| 7 | Tier-selection uses only valid date keys (not raw Object.keys, review fix WR-02) | ✓ VERIFIED | `generate-portfolio-report.ts:170` uses `Object.keys(urgencyHistory).filter(isValidDateKey).length`; live repro with only `__proto__`/`"not-a-date"` keys correctly renders Tier 1 (not Tier 2) |
| 8 | Dynamic strings (symbol/nameJa/decision/dates) are escaped via escapeHtml (review fix WR-03) | ✓ VERIFIED | `generate-portfolio-report.ts` wraps `s.symbol`, `s.nameJa`, `c.from`/`c.to`, and `formatDateKeyShort(...)` output all in `escapeHtml(...)`; XSS regression test (`<script>` payload) asserts `&lt;script&gt;` not raw tag |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/urgency-rollup.ts` | computeWeeklyUrgencyRollup, formatDateKeyShort, result types, throw-free/immutable | ✓ VERIFIED | 162 lines; exports match Plan 01 contract exactly; imports only `isValidDateKey` + types from `urgency-history.js` (no `normalizeHoldingSymbol`, confirmed via grep=0) |
| `src/portfolio/urgency-rollup.test.ts` | TDD coverage for all HIST-03 aggregation behaviors | ✓ VERIFIED | 340 lines, 30 `it(...)` cases (23 original + 7 review-fix regression tests for calendar-invalid anchor / non-object history / corrupt fields) |
| `src/scripts/generate-portfolio-report.ts` | formatWeeklyUrgencyRollupHtml renderer, 4th param urgencyHistory (backward compatible), both-branch insertion, 3-tier fallback, escapeHtml discipline | ✓ VERIFIED | Renderer present at lines ~118-153; 4th param defaults to `{}`; `weeklyRollupHtml` computed once before the null-check and interpolated into both the null-branch and non-null templates (grep confirms 2 occurrences) |
| `src/scripts/generate-report.test.ts` | Backward-compat + rollup-render + null-branch + empty-state assertions | ✓ VERIFIED | `describe("Weekly urgency rollup (HIST-03)")` block at line 542; 63 total tests in file, all green |
| `src/scripts/report-data-loaders.ts` | loadUrgencyHistory (fail-soft, {} fallback, shape-guard) | ✓ VERIFIED | Lines 137-159; DATA_DIR const added; type-assertion + non-object-root guard (CR-02 fix) + try/catch, console.warn severity per D-13 |
| `src/scripts/report-data-loaders.test.ts` | 3-case fail-soft coverage (+ CR-02 regression) | ✓ VERIFIED | `describe("loadUrgencyHistory")` at line 116; 8 cases total (success/ENOENT/parse-fail/null-root/array-root and variants) |
| `src/scripts/generate-report.ts` | loader wired into Promise.all + passed as 4th arg | ✓ VERIFIED | Import line 9, Promise.all entry + destructure line 122, call site line 153 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `urgency-rollup.ts` | `urgency-history.ts` | `import isValidDateKey + types from "./urgency-history.js"` | ✓ WIRED | Confirmed at top of file |
| `generate-portfolio-report.ts` | `urgency-rollup.ts` | `import computeWeeklyUrgencyRollup + formatDateKeyShort` | ✓ WIRED | Confirmed, used in `weeklyRollupHtml` computation and per-symbol date rendering |
| `generate-portfolio-report.ts` | `report-utils.ts` | `escapeHtml(...)` on every dynamic string | ✓ WIRED | Applied to symbol, nameJa, from/to, and (post-fix) formatDateKeyShort output |
| `generate-report.ts` | `report-data-loaders.ts` | `loadUrgencyHistory()` in Promise.all | ✓ WIRED | Confirmed, 11th entry, positional alignment preserved |
| `generate-report.ts` | `generate-portfolio-report.ts` | `urgencyHistory` passed as 4th argument | ✓ WIRED | Confirmed at call site line 153 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `formatWeeklyUrgencyRollupHtml` render | `weeklyRollupHtml` | `computeWeeklyUrgencyRollup(urgencyHistory, result.date)` where `urgencyHistory` comes from `loadUrgencyHistory()` reading `data/urgency-history.json` | Yes (real file read, real aggregation, real per-symbol data — confirmed with realistic multi-date fixture producing correct dates/colors/footnote) | ✓ FLOWING |

Note: `data/urgency-history.json` does not yet exist on disk in this repo checkout (first-run condition — Phase 25's daily persistence has not yet accumulated 7 days locally in this environment). This is the expected Tier-1 empty state and is explicitly designed for (D-14); it does not indicate the feature is broken. The most recent deployed `docs/2026-07-04/portfolio-report.html` predates this phase's commits (generated 07:55 JST; last review-fix commit 17:10 JST) and therefore does not yet contain the section — it will appear on the next scheduled `generate-report.ts` run, which is wired correctly per the key-link checks above.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| computeWeeklyUrgencyRollup never throws on calendar-invalid anchor | `npx tsx -e "computeWeeklyUrgencyRollup({}, '2026-13-01')"` | `{"windowStart":"2026-13-01","windowEnd":"2026-13-01","daysCovered":0,"symbols":[]}` (no throw) | ✓ PASS |
| computeWeeklyUrgencyRollup never throws on null history | `npx tsx -e "computeWeeklyUrgencyRollup(null, '2026-07-01')"` | empty rollup returned, no throw | ✓ PASS |
| generatePortfolioReportHtml never throws on corrupt nameJa | `npx tsx -e "generatePortfolioReportHtml(...,{nameJa:12345,...})"` | HTML returned, heading present, no throw | ✓ PASS |
| Tier-selection correct for malformed-key-only history | `npx tsx -e` with `__proto__`/`"not-a-date"` keys only | Tier 1 message shown (true), Tier 2 message absent (false) | ✓ PASS |
| Realistic multi-date rollup renders correct MM/DD + decision-change + footnote | `npx tsx -e` with 3-date fixture (06/28, 06/30, 07/01) | Produced exactly `⚠ 緊急フラグ: 06/28, 07/01`, `判断変更: 06/30 保持 → 一部売却`, `（過去3日分の履歴に基づく）` | ✓ PASS |
| Full test suite green | `npx vitest run` | 377/377 passed (21 files) | ✓ PASS |
| Typecheck clean (phase-scoped) | `npx tsc --noEmit` | Only pre-existing, out-of-scope TS7006 errors in `src/scripts/collect-data.test.ts` (unrelated Phase 15 file, logged to deferred-items.md) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes declared in PLAN/SUMMARY for this phase; this is a TDD/vitest-verified feature phase, not a migration/CLI-probe phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| HIST-03 | 26-01, 26-02, 26-03 | ユーザーは portfolio.html で直近7日間の緊急フラグ・判断変更履歴のロールアップセクションを見ることができる | ✓ SATISFIED | End-to-end path verified: loader → aggregation → renderer → both templates, all covered by 377/377 green tests + live manual repro |

**Note:** `.planning/REQUIREMENTS.md` line 20 still shows `- [ ] **HIST-03**` (unchecked) and the Traceability table (line 50) still shows `HIST-03 | Phase 26 | Pending` — this is a stale documentation artifact. All three plan SUMMARY.md files declare `requirements-completed: [HIST-03]` and the implementation evidence above fully satisfies the requirement text. This is a non-blocking documentation-sync gap, not a functional gap (see Anti-Patterns section).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 20, 50 | HIST-03 checkbox/status not updated to reflect Phase 26 completion | ℹ️ Info | Documentation-only; does not affect runtime behavior. Recommend updating checkbox to `[x]` and status to `Complete` as part of phase closeout. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 4 phase-modified source files (`urgency-rollup.ts`, `generate-portfolio-report.ts`, `report-data-loaders.ts`, `generate-report.ts`). No empty-implementation stubs, no hardcoded-empty props feeding the render path.

### Human Verification Required

None. All observable truths are deterministic string/color/structure assertions already covered by 377 automated tests plus additional live manual reproductions performed during this verification (calendar-invalid anchor, null history root, corrupt snapshot fields, malformed-key-only tier selection, and a realistic multi-date rollup render matching the locked UI-SPEC copy exactly). The rendered section reuses existing, already-shipped CSS classes (`.agent-card`, `h2`, `h4`, `p`) with no new layout/interaction surface, so no additional visual-only judgment is required beyond what was verified.

### Gaps Summary

No functional gaps found. The 3 Critical + 5 Warning issues surfaced by code review (26-REVIEW.md) were all fixed and independently re-verified in this session via live `npx tsx` reproductions against the current checked-out code (not just re-reading the REVIEW-FIX.md narrative) — all previously-crashing inputs now return safe fail-soft empty rollups, and the WR-02 tier-selection bug is confirmed corrected.

One informational item: `.planning/REQUIREMENTS.md` has not been updated to mark HIST-03 as complete (still shows `[ ]` / "Pending"). This is a documentation housekeeping item, not a code/goal gap, and does not block phase acceptance.

---

*Verified: 2026-07-04T17:20:00Z*
*Verifier: Claude (gsd-verifier)*
