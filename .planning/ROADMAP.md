# Roadmap: Investment Agent v2.0 — Claude Code Migration

## Overview

既存のTypeScript/yahoo-finance2/HTML層をそのまま維持しながら、AI分析層をGemini APIからClaude Codeのスキル・サブエージェントシステムへ移行する。データ収集基盤とスキルオーケストレーターを先に確立し、5アナリスト+モデレーターを並列サブエージェントとして再実装、WebSearchリサーチとレポート生成を統合した後、Gemini依存を完全除去する。

## Phases

- [ ] **Phase 1: Data Layer + Skill Foundation** - データ収集スクリプト整備とスキルオーケストレーター構築
- [ ] **Phase 2: Analyst Subagents** - 5アナリスト+モデレーターのClaude Codeサブエージェント実装
- [ ] **Phase 3: Report Builder + WebSearch Research** - レポート生成統合とWebSearchリサーチ機能追加
- [ ] **Phase 4: Gemini Cleanup** - Gemini API依存の完全除去とコードベース整理

## Phase Details

### Phase 1: Data Layer + Skill Foundation
**Goal**: ユーザーが `/invest` コマンドでデータ収集から並列分析スポーンまでの骨格パイプラインを起動できる
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, SKILL-01, SKILL-02, SKILL-03
**Success Criteria** (what must be TRUE):
  1. ユーザーが `/invest` を実行するとデータ収集→サブエージェントスポーンの順でパイプラインが起動する
  2. `tmp/*.json` に市場データ・ニュース・ポートフォリオデータが出力されている
  3. 各アナリストには自分の役割に必要なデータのみが絞り込まれて渡される
  4. パイプラインの各ステップ（データ収集完了、分析開始等）の進捗がユーザーに表示される
  5. データ収集完了を確認してからサブエージェントがスポーンされる（実行順序が保証される）
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — collect-data.ts TDD実装 (DATA-01, DATA-02, SKILL-03)
- [ ] 01-02-PLAN.md — /invest スキルコマンド作成 (SKILL-01, SKILL-02, SKILL-03, DATA-02)

### Phase 2: Analyst Subagents
**Goal**: 5アナリストが並列で実行され、それぞれ定義されたJSONスキーマに従った分析結果を返し、モデレーターが統合する
**Depends on**: Phase 1
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07, AGENT-08
**Success Criteria** (what must be TRUE):
  1. ファンダメンタルズ・テンバガー・マクロ・テクニカル・リスクの5アナリストが並行して実行される
  2. 各アナリストが決められたJSONスキーマに従った構造化出力を返す（パースエラーが発生しない）
  3. モデレーターが5つの分析を統合し `tmp/meeting-result.json` を生成する
  4. 5アナリストの並列実行により逐次実行より分析時間が短縮される
**Plans**: TBD
**UI hint**: no

### Phase 3: Report Builder + WebSearch Research
**Goal**: 全パイプラインが `/invest` 一発で完結し、HTMLレポートが生成され、注目銘柄の最新情報がWebSearchで補完される
**Depends on**: Phase 2
**Requirements**: RSRCH-01, RSRCH-02, RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. `/invest` 実行後に `reports/YYYY-MM-DD/` にBloomberg風ダークテーマHTMLレポートが出力される
  2. レポートに5アナリストの分析とモデレーターの統合見解が含まれている
  3. 注目銘柄に対してWebSearchで最新ニュース・定性情報が取得され分析に反映される
  4. WebFetchで詳細記事が取得でき、ティッカーシンボルの定量データ（株価等）はYahoo Finance APIを使用する
**Plans**: TBD

### Phase 4: Gemini Cleanup
**Goal**: Gemini APIに関連するコード・パッケージ・環境変数がコードベースから完全に除去される
**Depends on**: Phase 3
**Requirements**: CLN-01, CLN-02, CLN-03
**Success Criteria** (what must be TRUE):
  1. `@google/generative-ai` と `@google/genai` パッケージが `package.json` から除去されている
  2. `src/data/charts.ts`、`src/data/research.ts`、`src/meeting/runner.ts` 等のGemini依存ファイルが削除されている
  3. `GEMINI_API_KEY` 環境変数への参照がコードベース全体から存在しない
  4. `npm install` + `/invest` 実行が完全にGemini APIなしで成功する
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer + Skill Foundation | 0/2 | Not started | - |
| 2. Analyst Subagents | 0/0 | Not started | - |
| 3. Report Builder + WebSearch Research | 0/0 | Not started | - |
| 4. Gemini Cleanup | 0/0 | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone: v2.0 Claude Code Migration*
