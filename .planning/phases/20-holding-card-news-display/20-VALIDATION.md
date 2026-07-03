---
phase: 20
slug: holding-card-news-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | none — vitest デフォルト設定（Wave 0 不要） |
| **Quick run command** | `npx vitest run src/portfolio/holding-news.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (full) / ~2 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/portfolio/holding-news.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *（プランナーが PLAN.md 作成時に記入）* | — | — | UI-05, UI-06 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

参照: `20-RESEARCH.md` §Validation Architecture の要件別テストマッピング（UI-05: リゾルバーID照合・銘柄間ID混入防止・描画href一致・escapeHtml、UI-06: 空状態出力・カード構造維持、共通: fail-soft ローダー）

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.
（vitest + 既存 `src/portfolio/holding-news.test.ts` / `src/scripts/generate-report.test.ts` の流儀に追記する形で対応可能）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 実データでのライブ描画（日本株0件銘柄カードの正常描画・リンク遷移） | UI-05, UI-06 | 実運用データ依存の目視確認（レイアウト崩れ・リンク先妥当性） | パイプライン実行後の docs/YYYY-MM-DD/portfolio-report.html をブラウザで開き、0件銘柄の空状態表示とニュースリンクの遷移先を確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
