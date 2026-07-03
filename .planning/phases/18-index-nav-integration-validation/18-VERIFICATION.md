---
phase: 18-index-nav-integration-validation
verified: 2026-07-03T10:50:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 18: Index/Nav Integration & Validation Verification Report

**Phase Goal:** index.htmlの日付エントリがnews-digest.htmlの実在有無に応じて正確にリンクを出し分け、欠落日でも404リンクを生成しない
**Verified:** 2026-07-03T10:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | news-digest.html が生成された日付の index.html エントリに、同ファイルへのリンクが追加される | VERIFIED | `src/scripts/update-index.ts:39-60` implements `newsDigestFileExists()`/`withNewsDigestLink()` using `access()` from `node:fs/promises`; wired into `updateIndexHtml` at line 216 (`Promise.all(merged.map(withNewsDigestLink))`). Live production evidence: `docs/index.html` lines 140 and 152 contain `<a href="2026-07-03/news-digest.html">News Digest</a>` in both the hero block and the accordion entry for 2026-07-03, the only date with a real `docs/2026-07-03/news-digest.html` file on disk (confirmed via `find docs -maxdepth 2 -name news-digest.html` → single match). |
| 2 | news-digest.html が生成されなかった日付のエントリには、当該リンクが追加されない（404リンクなし） | VERIFIED | `grep -c "news-digest.html" docs/index.html` = 2 (both for 2026-07-03: hero + accordion). Sampled 2026-06-10 block contains only 2 links (`daily-report.html`, `meeting-minutes.html`), no `news-digest.html`. All ~117 other date directories under `docs/` lack `news-digest.html` (`find docs -maxdepth 1 -type d` = 118 total date dirs, only 1 has the file), and none of them appear in the 2 total `news-digest.html` occurrences in `index.html`. Unit tests "omits News Digest link" and "removes stale News Digest link" (both green) confirm the strip-then-re-derive logic (`entry.links.filter((l) => l.label !== NEWS_DIGEST_LABEL)` before conditional re-add) self-heals stale/parsed links when the fs check fails. |
| 3 | 既存3レポート（daily-report / meeting-minutes / portfolio-report）のリンク描画ロジックには回帰がない | VERIFIED | `buildStandardLinks`, `renderEntryLinks`, `renderHero`, `renderAccordion`, `parseExistingEntries` are byte-identical to pre-phase code (only 2 new helper functions + 1 constant + 1 import addition + 1 wiring line added). `git show 7b378c0 -- docs/index.html` diff is confined to exactly 2 added lines (the News Digest anchors), with zero changes to the 3 existing links or CSS. Full test suite (`npm test`) passes 187/187, including the 9 `update-index.test.ts` cases (5 pre-existing + 4 new). |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/scripts/update-index.ts` | `withNewsDigestLink`/`newsDigestFileExists` fs-derived link logic, wired into `updateIndexHtml` | VERIFIED | Present at lines 37-60; wired at line 216; `buildStandardLinks`/`renderEntryLinks`/`renderHero`/`renderAccordion`/`parseExistingEntries` unchanged. |
| `src/scripts/update-index.test.ts` | `access` mock + 4 D-08 test cases | VERIFIED | `access:` present in `vi.mock` factory (line 8); 4 new `it(...)` cases present ("adds News Digest link", "omits News Digest link", "removes stale News Digest link", "preserves 3 links alongside News Digest"); all pass (9/9 total). |
| `docs/index.html` | Live-reflected: 2026-07-03 has News Digest link, ~117 past dates do not | VERIFIED | Confirmed via direct file inspection: 2 occurrences of `news-digest.html`, both for 2026-07-03 (hero + accordion); 2026-06-10 sample block has no such link. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `update-index.ts:updateIndexHtml` | `withNewsDigestLink` | `Promise.all(merged.map(withNewsDigestLink))` between `mergeEntry` and `buildRegion` | WIRED | Line 216-218 confirmed in source. |
| `update-index.ts:withNewsDigestLink` | `docs/{date}/news-digest.html` | `access()` from `node:fs/promises` | WIRED | Line 41: `await access(join(DOCS_DIR, date, "news-digest.html"))`, wrapped in try/catch returning boolean. |
| `docs/index.html:2026-07-03 entry` | `docs/2026-07-03/news-digest.html` | News Digest anchor link | WIRED | Live file confirms `<a href="2026-07-03/news-digest.html">News Digest</a>` present in both hero and accordion blocks. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit test suite for update-index.ts | `npx vitest run src/scripts/update-index.test.ts` | 9/9 tests passed (5 pre-existing + 4 new D-08 cases) | PASS |
| Full project test suite (regression check) | `npm test` | 187/187 tests passed, 13/13 files | PASS |
| Type check on phase-scope files | `npx tsc --noEmit` | 5 pre-existing errors in unrelated files (`finnhub.ts`, `collect-data.test.ts`), confirmed byte-identical to pre-phase base commit `ae5407d` via `git show ae5407d:src/data/news/finnhub.ts` diff; zero errors in `update-index.ts`/`update-index.test.ts` | PASS (out-of-scope errors pre-existing, not a regression) |
| Live fs state matches expected link distribution | `find docs -maxdepth 2 -name news-digest.html` / `grep -c news-digest.html docs/index.html` | 1 real file (2026-07-03), 2 link occurrences (hero+accordion for that date only) | PASS |
| Diff scope of live-verification commit | `git show 7b378c0 -- docs/index.html` | Exactly 2 lines added, no other changes | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| UI-04 | 18-01-PLAN.md, 18-02-PLAN.md | index.html の日付エントリに news-digest.html へのリンクがファイル実在時のみ追加される（欠落日は404リンクを生成しない） | SATISFIED | Implementation (18-01) + live production verification (18-02) both confirmed above. REQUIREMENTS.md line 24 marked `[x]` and traceability table (line 65) marks "Phase 18 / Complete", consistent with actual code state. |

No orphaned requirements found — UI-04 is the only requirement mapped to Phase 18 in REQUIREMENTS.md, and it is claimed by both plans.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in `src/scripts/update-index.ts` or `src/scripts/update-index.test.ts`. `console.log` calls present in `update-index.ts` (5 occurrences) are pre-existing (confirmed byte-count-identical against base commit `ae5407d`, not introduced by this phase) and serve as intentional CLI progress output for a script entry point — not a stub/debug leftover.

### Human Verification Required

None outstanding. The plan's `checkpoint:human-verify` task (18-02 Task 2) was already executed and approved during phase execution — SUMMARY.md records explicit human approval ("approved — 今すぐデプロイ") with the deploy decision made and executed (`git push origin master`, confirmed `origin/master` == `7b378c0`, now further advanced with a docs commit `b9599f1` still containing `7b378c0` in its ancestry). No further human action is required for this phase's goal.

### Gaps Summary

No gaps found. All 3 roadmap success criteria are independently verified against live production code and live production `docs/index.html` state (not merely unit-test fixtures): (1) the sole date with a real `news-digest.html` file gained the link, (2) all ~117 other dates did not, and (3) the existing 3-link rendering logic is unchanged and regression-free per both `git diff` inspection and full test-suite pass (187/187). The phase's own human-verify checkpoint was already satisfied and deployed prior to this verification pass.

---

_Verified: 2026-07-03T10:50:00Z_
_Verifier: Claude (gsd-verifier)_
