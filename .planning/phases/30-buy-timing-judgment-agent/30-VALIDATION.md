---
phase: 30
slug: buy-timing-judgment-agent
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (既存 — src/**/*.test.ts 規約) |
| **Config file** | package.json scripts（既存インフラ） |
| **Quick run command** | `npx vitest run <target>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <target>.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 30-01 | 1 | TIME-02 | T-30-01, T-30-03 | TS専用フィールド strip・fail-closed wait デフォルト | unit | `npx vitest run src/meeting/schemas.test.ts` | ❌ W0（新 describe を既存 src/meeting/schemas.test.ts に追記） | ⬜ pending |
| Task 2 | 30-01 | 1 | TIME-03, TIME-04, TIME-05 | T-30-02 | confluence 降格ゲート（signals<2 の buy を wait 降格） | unit | `npx vitest run src/portfolio/watchlist-judgment.test.ts` | ❌ W0（新規テストファイル） | ⬜ pending |
| Task 1 | 30-02 | 2 | TIME-01, TIME-02, TIME-03, TIME-05 | T-30-04, T-30-05, T-30-06, T-30-07 | 銘柄別独立 try/catch DoS 対策・market/asOf 決定論再付与 | typecheck | `npx tsc --noEmit && echo "typecheck-ok"` | ❌ W0（新規 src/scripts/write-watchlist-judgment.ts） | ⬜ pending |
| Task 2 | 30-02 | 2 | TIME-01, TIME-02, TIME-03, TIME-05 | T-30-04, T-30-05, T-30-06, T-30-07 | ENOENT-vs-破損分類・全分岐で有効 JSON・LLM エコー不採用 | integration | `npx vitest run src/scripts/write-watchlist-judgment.test.ts` | ❌ W0（新規テストファイル） | ⬜ pending |
| Task 1 | 30-03 | 3 | TIME-01, TIME-03, TIME-04, TIME-05 | T-30-08, T-30-09, T-30-10, T-30-11 | プロンプト契約二層防御・インジェクション対策・`/`→`-` 防御的 sanitization | static (grep) | `grep -n "### Step 3-J" .claude/commands/invest.md && grep -n "write-watchlist-judgment.ts" .claude/commands/invest.md` | ✅（既存 .claude/commands/invest.md を scoped Edit） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*30-03 Task 2（`checkpoint:human-verify`）はライブパイプライン実行の確認であり静的検証不能のため、下記 Manual-Only Verifications に計上する。*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.（vitest・テストモック規約とも既存。新規フレームワーク導入なし）*

---

## Manual-Only Verifications

| Behavior | Requirement | Source | Why Manual | Test Instructions |
|----------|-------------|--------|------------|-------------------|
| Step 3-J 判定生成と既存4レポート非ブロックのライブパイプライン確認（30-03 Task 2 checkpoint:human-verify） | TIME-01, TIME-03, TIME-05 | 30-03 Task 2 | invest.md パイプラインの Agent 並列起動・実 STEP マーカー出力・実出力ファイル生成は静的解析不能 | launchd 朝8時実行または手動 /invest 実行のログで `[STEP:watchlist-judgment:OK]` 出力・`[PIPELINE:FAIL]` 非出力を確認し、tmp/watchlist-judgment.json（buy 銘柄 signals≥2）と既存4レポート非ブロックを検証 |
| 判定エージェントのライブ実行（Agent 並列起動・STEP マーカー実出力） | TIME-01 | 30-03 Task 2 | invest.md パイプラインの Agent ツール実行は単体テスト不能 | launchd 日次実行または手動 /invest 実行でログ確認 |
| 判定理由が供給データのみに言及（創作なし）のプロンプト契約遵守 | TIME-04 | 30-03 Task 1 プロンプト契約 | LLM 出力品質は静的検証不能（confluence 件数ゲートは自動、内容はレビュー） | 生成された tmp/watchlist-judgment.json の rationale を実データと突き合わせ |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies（自動タスク5件すべてに `<automated>` あり。30-03 Task 2 は checkpoint:human-verify で Manual-Only へ計上）
- [x] Sampling continuity: no 3 consecutive tasks without automated verify（自動タスクが連続し、3連続で自動 verify 欠落なし）
- [x] Wave 0 covers all MISSING references（Wave 0 作業項目なし — vitest・テストモック規約とも既存インフラで充足）
- [x] No watch-mode flags（全コマンドが `vitest run`／`tsc --noEmit`／`grep` の one-shot。watch フラグなし）
- [x] Feedback latency < 60s（フルスイート推定 ~30 秒、タスク別実行はそれ以下）
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
