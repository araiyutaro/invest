---
phase: 22
slug: portfolio-analyst-re-evaluation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | none — Vitest defaults（リポジトリルートに vitest.config.ts なし） |
| **Quick run command** | `npx vitest run <touched-file>.test.ts` |
| **Full suite command** | `npm test`（= `vitest run`、リサーチ時点 252/252 green・16ファイル） |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched-file>.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PORT-04 | — | urgent alias-transform（4表記+default false） | unit | `npx vitest run src/meeting/schemas.test.ts -t urgent` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PORT-05 | — | decisionChanged/previousDecision の決定論的計算 | unit | `npx vitest run src/portfolio/decision-diff.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PORT-05 | — | prev欠損・銘柄不一致 → undefined（false と区別） | unit | `npx vitest run src/portfolio/decision-diff.test.ts -t undefined` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PORT-05 | — | LLM出力の decisionChanged/previousDecision を strip | unit | `npx vitest run src/meeting/schemas.test.ts -t strip` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-07 | — | 緊急赤バッジ「⚠ 緊急」描画 | unit | `npx vitest run src/scripts/generate-report.test.ts -t 緊急` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-07 | — | 変化アンバーバッジ（前日→当日）描画 | unit | `npx vitest run src/scripts/generate-report.test.ts -t 判断変更` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-07 | — | border-left decision 色の維持（D-18） | unit | `npx vitest run src/scripts/generate-report.test.ts -t border` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Pitfall 7 debt | — | loadWebSearchResults/loadReevalResults の catch に console.warn | unit | `npx vitest run src/scripts/generate-report.test.ts -t warn` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PORT-05 | — | Test 39 隔離アサーションの prev-portfolio-analysis.json 対応 | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 39"` | ✅（拡張のみ） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/portfolio/decision-diff.test.ts` — 新規ファイル（PORT-05 コア差分ロジック。holding-news.test.ts の TDD スタイル踏襲）
- [ ] `src/meeting/schemas.test.ts` — `describe("holdingEvaluationSchema")` ブロック新設（urgent alias 4表記 + strip ケース。既存テストなしを grep 確認済み）
- [ ] `src/scripts/report-data-loaders.test.ts` — `loadPrevPortfolioAnalysis()` 成功/失敗ケース追加（既存6テストのスタイル踏襲）
- [ ] `src/scripts/generate-report.test.ts` — Portfolio Report ブロック（Tests 25-38）へバッジテスト追加 + Test 39 fsMock に prev-portfolio-analysis.json ハンドリング追加
- [ ] フレームワーク新規インストール不要 — Vitest 構成済み・green

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| rationale がニュース・リサーチ内容へ明示言及 | PORT-03 | LLM散文出力のため決定論的アサーション不能 | 22-HUMAN-UAT.md — ライブラン後にニュース/リサーチ有り銘柄の rationale を目視確認 |
| invest.md Step 3d プロンプトの条件付きセクション動作 | PORT-03 | invest.md は markdown プロンプトで vitest ハーネス外 | ライブラン時に research/prev セクションの有無を確認 |
| changed 比率の複数日健全性（アンカリング検知） | PORT-05 / D-07 | 単発テストで検証不能、複数日のライブデータが必要 | 22-HUMAN-UAT.md — 数日分の decisionChanged 比率を観測（全銘柄常時 false はアンカリング疑い） |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
