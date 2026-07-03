---
phase: 20
slug: holding-card-news-display
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| 20-01 T1 | 20-01 | 1 | UI-05 | T-20-01, T-20-05, T-20-07 | ID照合のみ解決・未知IDdrop・銘柄間ID混入防止・normalizeHoldingSymbolでキー正準化 | unit | `npx vitest run src/portfolio/holding-news.test.ts -t "resolvePortfolioHoldingNews"; npx vitest run src/portfolio/holding-news.test.ts -t "normalizeHoldingSymbol"` | ❌ Wave 0（describe新規追加） | ⬜ pending |
| 20-01 T2 | 20-01 | 1 | UI-05 | T-20-02 | safeHref/formatPublishedAtJst 汎化（挙動不変リファクタ） | unit | `npx vitest run src/scripts/generate-report.test.ts -t "News Digest"; npx tsc --noEmit` | ✅（既存 news-digest テスト） | ⬜ pending |
| 20-01 T3 | 20-01 | 1 | UI-06 | T-20-06 | fail-soft ローダー（[]/{}、no-throw、console.error） | unit | `npx vitest run src/scripts/report-data-loaders.test.ts` | ❌ Wave 0（新規ファイル） | ⬜ pending |
| 20-02 T1 | 20-02 | 2 | UI-05, UI-06 | T-20-02, T-20-03, T-20-04, T-20-07 | escapeHtml/safeHref/rel=noopener・空状態常時描画・normalizeHoldingSymbol参照側キー正規化・後方互換 | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Portfolio Report"` | ❌ Wave 0（既存describeに追加） | ⬜ pending |
| 20-02 T2 | 20-02 | 2 | UI-05, UI-06 | T-20-01 | パイプライン配線（resolver経由の解決済みニュース供給・書き込み側不変） | integration | `npx tsc --noEmit; npm test` | ✅（既存 generate-report.test.ts） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

参照: `20-RESEARCH.md` §Validation Architecture の要件別テストマッピング（UI-05: リゾルバーID照合・正規化キー生成・銘柄間ID混入防止・描画href一致・escapeHtml・参照側キー正規化、UI-06: 空状態出力・カード構造維持、共通: fail-soft ローダー）

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.
（vitest + 既存 `src/portfolio/holding-news.test.ts` / `src/scripts/generate-report.test.ts` の流儀に追記する形で対応可能。新規 `src/scripts/report-data-loaders.test.ts` は 20-01 Task 3 内で作成する）

全タスクに `<automated>` verify が付与されており、Nyquist サンプリング要件（3連続タスク automated 欠落なし）を満たす。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 実データでのライブ描画（日本株0件銘柄カードの正常描画・リンク遷移） | UI-05, UI-06 | 実運用データ依存の目視確認（レイアウト崩れ・リンク先妥当性） | パイプライン実行後の docs/YYYY-MM-DD/portfolio-report.html をブラウザで開き、0件銘柄の空状態表示とニュースリンクの遷移先を確認 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
</content>
