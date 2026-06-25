# Milestones

## v2.0 Claude Code Migration (Shipped: 2026-06-25)

**Phases completed:** 4 phases, 7 plans
**Timeline:** 2026-06-24 → 2026-06-25
**Source:** 1,661 LOC (production TS) + 475 LOC (tests) + 1,204 LOC (skill definition)

**Key accomplishments:**

- `/invest` スキルコマンドでデータ収集→分析→レポート生成の全パイプラインを一発実行可能に
- 5アナリスト+モデレーターの3ラウンド並列ミーティングを Claude Code サブエージェントで実装
- WebSearch による注目銘柄リサーチと再評価ラウンドの統合
- Bloomberg風ダークテーマ HTML レポートジェネレータの TDD 実装（23テスト）
- Gemini API 依存の完全除去（10ファイル削除、@google/* 2パッケージ除去）

**Known deferred items at close:** 5 (see STATE.md Deferred Items)

**Archive:** `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-REQUIREMENTS.md`

---
