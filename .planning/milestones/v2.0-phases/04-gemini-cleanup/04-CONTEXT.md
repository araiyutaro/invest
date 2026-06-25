---
phase: 04-gemini-cleanup
created: 2026-06-25
decisions: 9
---

# Phase 4: Gemini Cleanup — Implementation Decisions

## Phase Goal
Gemini APIに関連するコード・パッケージ・環境変数がコードベースから完全に除去される

## Decisions

### D-01: 削除対象ファイル（Gemini 直接依存）
**Decision:** 以下のファイルを完全削除する
- `src/gemini.ts` — Gemini API クライアントラッパー
- `src/data/charts.ts` — NanoBanana チャート画像生成 (@google/genai)
- `src/data/research.ts` — Google Search Grounding リサーチ (@google/generative-ai)
- `src/meeting/runner.ts` — v1.0 ミーティングランナー (gemini.ts 依存)
- `src/report/generator.ts` — v1.0 レポートジェネレータ (v2.0 generate-report.ts で置換済み)
- `src/data/news/analyzer.ts` — ニュース分析 (gemini.ts 依存)
- `src/index.ts` — v1.0 エントリポイント (runner.ts, generator.ts を import)
- `src/portfolio/runner.ts` — Portfolio ミーティングランナー (gemini.ts 依存)
- `src/report/portfolio-generator.ts` — Portfolio レポートジェネレータ
**Rationale:** v2.0 では /invest スキルコマンドが全パイプラインをオーケストレーション。上記ファイルは全て v1.0 専用で v2.0 からは参照されない。

### D-02: 残すファイル（Gemini 非依存）
**Decision:** 以下のファイルは残す
- `src/portfolio/data.ts` — Yahoo Finance 経由のポートフォリオデータ取得。collect-data.ts が import している
- `src/portfolio/holdings.ts` — ポートフォリオ銘柄リスト定義。collect-data.ts が import している
- `src/data/market.ts` — 市場データ取得 (Yahoo Finance)
- `src/data/news.ts` — ニュースアグリゲーション
- `src/data/news/finnhub.ts`, `google-news.ts`, `rss-sources.ts`, `types.ts` — ニュースソース
- `src/agents/*.ts` — エージェントプロファイル (Gemini 非依存)
- `src/meeting/types.ts`, `schemas.ts` — 型定義・スキーマ
- `src/scripts/*.ts` — v2.0 スクリプト群
**Rationale:** これらは Gemini に依存しておらず、v2.0 パイプラインで使用中。

### D-03: npm パッケージ削除
**Decision:** package.json から以下を削除
- `@google/generative-ai` (^0.24.1)
- `@google/genai` (^1.44.0)
**Rationale:** 全ての import 元ファイルを D-01 で削除するため、パッケージも不要。

### D-04: 環境変数の扱い
**Decision:** ソースコードから GEMINI_API_KEY への参照を全て削除。.env ファイルは git 管理外のため手動対応（ユーザーに通知）
**Rationale:** .env はリポジトリに含まれないため、コードベースのクリーンアップとして参照コード削除が主スコープ。

### D-05: launchd plist の扱い
**Decision:** Phase 4 スコープ外として触らない
**Rationale:** com.arai.invest-agent.plist は Gemini に直接依存していない。自動実行の再設計は別のフェーズで検討。

### D-06: scripts/run.sh の扱い
**Decision:** 確認して Gemini 依存があれば削除対象に追加
**Rationale:** v1.0 の実行スクリプトだが、GEMINI_API_KEY を source している可能性がある。

### D-07: TypeScript コンパイル確認
**Decision:** 全ファイル削除後に `npx tsc --noEmit` でコンパイルエラーがないことを確認
**Rationale:** 削除したファイルを参照している残存コードがないことの検証。

### D-08: テストスイート確認
**Decision:** `npm test` で全テスト PASS を確認
**Rationale:** 既存テスト (collect-data, validate-meeting, generate-report) が削除の影響を受けていないことの検証。

### D-09: /invest パイプライン動作確認は Phase 4 スコープ外
**Decision:** `/invest` の E2E 実行確認は Phase 3 UAT で完了済み。Phase 4 は TypeScript コンパイル + テスト PASS をもって検証完了とする
**Rationale:** Phase 3 UAT で全パイプラインの動作確認済み。Phase 4 は不要コード削除のみで機能変更なし。

## Deferred Ideas
- launchd plist の v2.0 対応（Claude Code エージェントの自動スケジュール実行）
- portfolio 分析の v2.0 専用機能としての再実装
