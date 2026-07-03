---
phase: 23
slug: new-candidates-section-removal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | none — vitest run via `npm run test` script |
| **Quick run command** | `npx vitest run src/scripts/generate-report.test.ts` |
| **Full suite command** | `npm run test` (= `vitest run`) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/scripts/generate-report.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | UI-08 (normal path) | — | N/A | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 30"` | ✅ (Test 30 反転) | ⬜ pending |
| 23-01-02 | 01 | 1 | UI-08 (fallback path) | — | N/A | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 31"` | ✅ (Test 31 拡張) | ⬜ pending |
| 23-01-03 | 01 | 1 | UI-08 (highlightedStocks 維持) | — | N/A | static/grep | `grep -n "highlightedStocks 配列の全内容" .claude/commands/invest.md` | N/A | ⬜ pending |
| 23-01-04 | 01 | 1 | UI-08 (types/schema 無変更) | — | N/A | static/diff | `git diff --stat src/meeting/types.ts src/meeting/schemas.ts`（空を期待） | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.（generate-report.test.ts の validMeetingResult / validPortfolioAnalysis フィクスチャで両テストケースをカバー可能。新規テストファイル・フレームワーク導入は不要）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ライブレポートHTMLでのセクション非表示の目視確認 | UI-08 | 日次パイプライン実行後の実物確認（任意、単体テストで担保済み） | docs/YYYY-MM-DD/portfolio.html を開き「新規組入候補」が無いことを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
