# Phase 23: New-Candidates Section Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 23-New-Candidates Section Removal
**Areas discussed:** 削除の実装形, テスト更新方針, フォールバックパスの跡地表現, highlightedStocks 維持の検証
**Mode:** --auto（全グレーエリア自動選択・各質問は推奨オプションを自動採用）

---

## 削除の実装形

| Option | Description | Selected |
|--------|-------------|----------|
| 完全削除（推奨） | formatNewCandidatesHtml 関数本体・両パスの呼び出し・未使用化する scoreColor/verdictColor import をすべて削除。dead code を残さない | ✓ |
| 呼び出しのみ除去 | 関数は残して埋め込みだけ外す。差分最小だが dead code が残り将来の誤再配線リスク | |
| フラグで無効化 | 環境変数等で出し分け。要件は恒久削除であり過剰な複雑さ | |

**Auto-selected:** 完全削除
**Notes:** report-utils.ts の scoreColor/verdictColor 本体は generate-daily-report.ts が使用するため温存。generatePortfolioReportHtml のシグネチャは result.date 使用のため無変更。

---

## テスト更新方針

| Option | Description | Selected |
|--------|-------------|----------|
| 非存在検証へ反転 + 両パスカバー（推奨） | Test 30 を not.toContain("新規組入候補") に反転し、highlightedStocks 非空の入力で検証。フォールバックパス（null）にも非存在検証を追加。Success Criteria 1 と1対1対応 | ✓ |
| Test 30 を単純削除 | 削除の回帰防止がなくなる（再導入されても気づけない） | |
| スナップショットテスト化 | HTML全体のスナップショットは既存テスト流儀（toContain ベース）から逸脱 | |

**Auto-selected:** 非存在検証へ反転 + 両パスカバー
**Notes:** Daily Report 側の Test 4（generateHtml の highlightedStocks 表示）は維持対象のため変更しない。

---

## フォールバックパスの跡地表現

| Option | Description | Selected |
|--------|-------------|----------|
| 既存メッセージのみ・追加なし（推奨） | 「本日のポートフォリオ分析は生成されませんでした。」のみ残す。UI-08 は削除のみを要求しており要件外の追加をしない | ✓ |
| 代替コンテンツを追加 | Daily Report へのリンク等を置く — スコープ外の新規能力 | |

**Auto-selected:** 既存メッセージのみ・追加なし

---

## highlightedStocks 維持の検証

| Option | Description | Selected |
|--------|-------------|----------|
| invest.md 無変更 + grep 検証（推奨） | invest.md Step 3d の「注目銘柄」セクションに一切触れず、フェーズ検証で受け渡し残存を grep 確認。types/schemas も無変更 | ✓ |
| プロンプト側にも明示コメント追加 | invest.md へ「削除禁止」注記を足す — 変更対象を増やすだけでリスクに見合わない | |

**Auto-selected:** invest.md 無変更 + grep 検証

---

## Claude's Discretion

- 反転テストの配置（Test 30 番号維持 vs 整理）
- フォールバックパステストの実装形（Test 31 拡張 vs 新規テスト）
- コミット分割（TDD 規約優先で反転テスト先行が自然）

## Deferred Ideas

None — 削除のみの小規模フェーズであり、スコープ外のアイデアは発生せず
