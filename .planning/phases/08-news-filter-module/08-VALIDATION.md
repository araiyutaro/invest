---
phase: 8
slug: news-filter-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | none — package.json scripts.test only |
| **Quick run command** | `npx vitest run src/data/news/filter.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/data/news/filter.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | DEDUP-01 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | DEDUP-02 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | DEDUP-02 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | FILT-01 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | FILT-01 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 1 | FILT-02 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-04 | 02 | 1 | DEDUP-03 | — | N/A | unit (grep) | `grep -c "title.slice(0, 50)" src/data/news/rss-sources.ts` | ✅ | ⬜ pending |
| 08-02-05 | 02 | 1 | DEDUP-02 | — | N/A | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/data/news/filter.test.ts` — TDD test stubs for DEDUP-01/02/03, FILT-01/02
- [ ] `src/data/news/filter.ts` — skeleton exports (empty implementations that fail tests)

*TDD approach: tests written first, then implementation to pass them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| denylist除外率が5-30%の適正範囲 | FILT-01 | 実データ（tmp/news.json）でのみ検証可能 | Phase 9統合後に `NewsFilterStats.afterRelevance` を確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
