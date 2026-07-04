---
phase: 26
slug: weekly-urgency-rollup-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts (repo root) |
| **Quick run command** | `npx vitest run src/portfolio/urgency-rollup.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/portfolio/urgency-rollup.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | HIST-03 | — | isValidDateKey rejects malformed / `__proto__` keys on read side | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: `computeWeeklyUrgencyRollup` pure-function tests (7-day window, recorded-adjacent decision comparison, missing days, <7 days, 0-movement, immutability) are the primary Nyquist coverage for HIST-03. HTML-render assertions live in generate-report.test.ts.*

---

## Wave 0 Requirements

- [ ] `src/portfolio/urgency-rollup.test.ts` — pure aggregation tests for HIST-03 (new file, TDD)
- [ ] vitest ^4.0.18 already installed — no framework install needed

*Existing infrastructure (vitest + node:fs/promises mocking pattern) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 週次ロールアップセクションが portfolio-report.html に表示され、視覚的に既存カードのバッジ色（赤=緊急 / アンバー #f59e0b=判断変更）と整合している | HIST-03 (SC #1) | 最終的な視覚整合はブラウザ目視が確実 | パイプライン実行後 docs/{date}/portfolio-report.html をブラウザで開き、ロールアップセクションの存在・空状態文言・バッジ色を確認 |

*HTML 構造・空状態文言・集計ロジックは自動テストでカバー。上記は視覚整合の最終確認のみ。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
