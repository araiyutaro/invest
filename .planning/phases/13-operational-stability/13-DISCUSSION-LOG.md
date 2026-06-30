# Phase 13: Operational Stability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 13-operational-stability
**Areas discussed:** エラーログ戦略, HTML保護機構, macOS通知検証

---

## エラーログ戦略 (OPS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| 構造化JSONログ | ステップ別の結果をJSONで logs/ に出力 | |
| テキストマーカー | grep可能なフラットテキストマーカーを invest.md 出力に追加 | ✓ |
| 外部ラッパー | run.sh 側でステップ検出・パースする | |

**User's choice:** 任せる → Claude判断: テキストマーカー方式を採用。invest.md の各ステップに `[STEP:{name}:{status}]` マーカーを追加し、run.sh のログに自動含有
**Notes:** 既存の run.sh ログ記録（全出力→ファイル）をそのまま活用。JSONは過剰

---

## HTML保護機構 (OPS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| git pre-commit hook | コミット時に保護ファイルの変更をブロック | |
| チェックサム検証 | run.sh でパイプライン前後にSHA256比較、不一致時はgit checkout復元 | ✓ |
| ファイルパーミッション | readonly 設定で書き込みを防止 | |

**User's choice:** 任せる → Claude判断: チェックサム方式。pre-commit hook は開発作業に影響、readonly はパイプライン自体のレポート生成にも影響しうるため不採用
**Notes:** 保護対象は docs/index.html と docs/portfolio.html の2ファイルのみ

---

## macOS通知検証 (OPS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 追加実装 | 通知内容の拡充（ステップ別進捗通知等） | |
| 検証ドキュメント化のみ | 動作確認済みのためコード変更なし | ✓ |

**User's choice:** 任せる → Claude判断: 検証ドキュメント化のみ。terminal-notifier は run.sh に実装済みで launchd 環境でも動作確認済み
**Notes:** launchd-out.log で 6/29, 6/30 の正常実行を確認

## Claude's Discretion

- ステップマーカーの具体的な挿入位置
- チェックサム記録・復元ロジックの run.sh 内配置
- OPS-03 の検証結果をどこに記録するか

## Deferred Ideas

None
