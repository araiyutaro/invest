# Phase 6: 3-Report Structure - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

現行の単一 HTML レポート（`src/scripts/generate-report.ts`）を、`daily-report.html` / `meeting-minutes.html` / `portfolio-report.html` の3つの独立した HTML ファイルに分離し、出力先を `reports/` から `docs/YYYY-MM-DD/` に変更する。対象は generate-report.ts のリファクタリング、HTML テンプレートの実装、invest.md の Step 3c 更新。ポートフォリオ評価ロジック（保持/買増/売却判断）は Phase 7 のスコープ。

</domain>

<decisions>
## Implementation Decisions

### レポート分離アーキテクチャ
- **D-01:** ファイル構成（1ファイル3関数 or 3ファイル+共通モジュール）は Claude の裁量に委ねる。
- **D-02:** 出力先を `reports/` から `docs/YYYY-MM-DD/` に変更する。新規レポートのみ `docs/` に出力し、既存の `reports/` ディレクトリはそのまま残す（移行しない）。
- **D-03:** 3レポート間の相互リンクは不要。各ファイルは独立して閲覧できる。
- **D-04:** invest.md の Step 3c の更新方法（TS スクリプト実行 or Claude 直接生成）は Claude の裁量に委ねる。

### デザイン・スタイリング
- **D-05:** 共通の Bloomberg 風ダークテーマを基盤としつつ、レポートごとにアクセントカラーを変える。
- **D-06:** 配色: Daily Report = 青（#3b82f6 系）、Meeting Minutes = オレンジ（#f59e0b 系）、Portfolio Report = 緑（#10b981 系）。

### Meeting Minutes の構成
- **D-07:** ラウンド時系列順（Round 1 → Round 2 → Round 3）で表示する。会議の進行を追体験できる構成。
- **D-08:** Round 1 セクションでは全フィールド（analysis, summary, highlights, risks, picks, sectorView）を表示する。
- **D-09:** Round 2 セクションでは全フィールド（discussion, comment, agreements, disagreements）を表示する。
- **D-10:** Meeting Minutes のデータソース（tmp/ 直接読込 or meeting-result.json 拡張）は Claude の裁量に委ねる。

### Daily Report の構成
- **D-11:** 現行セクションの Daily Report / Meeting Minutes 間の分配は Claude の裁量に委ねる。
- **D-12:** Phase 5 の独立銘柄推奨セクションの追加有無も Claude の裁量に委ねる。

### Portfolio Report
- **D-13:** Phase 6 での Portfolio Report の扱い（プレースホルダー生成 or Phase 7 で新規作成）は Claude の裁量に委ねる。

### Claude's Discretion
- ファイル構成の詳細（D-01）
- invest.md Step 3c の実装方式（D-04）
- Meeting Minutes のデータソース選択（D-10）
- Daily Report のセクション分配（D-11）と独立銘柄推奨セクション（D-12）
- Portfolio Report の Phase 6 での扱い（D-13）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 要件定義
- `.planning/REQUIREMENTS.md` — RPT-01〜RPT-04, PIPE-03 の要件定義（Phase 6 担当分）
- `.planning/ROADMAP.md` §Phase 6 — 成功基準 4 項目（3ファイル生成、Daily Report 内容、Meeting Minutes 散文、ダークテーマ維持）

### 現行実装（改修対象）
- `src/scripts/generate-report.ts` — 現行の単一レポート生成スクリプト（3ファイル出力にリファクタリング対象）
- `.claude/commands/invest.md` — パイプライン定義（Step 3c HTMLレポート生成が改修対象）

### データソース
- `src/meeting/types.ts` — MeetingResult, AnalystRound1Output, AnalystRound2Output, AnalystRound3Output, WebSearchResult, ReevaluationOutput 型定義
- `src/meeting/schemas.ts` — Zod バリデーションスキーマ

### Phase 5 コンテキスト（先行決定事項）
- `.planning/phases/05-analysis-engine-overhaul/05-CONTEXT.md` — analysis / discussion フィールド仕様、ハイブリッド方式、Round データ構造

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate-report.ts` の `escapeHtml()`, `markdownToHtml()`, `HTML_STYLES`: XSS 防止ユーティリティ、Markdown→HTML 変換、共通スタイル定義 — 3レポートで共有可能
- `generate-report.ts` の各 `format*Html()` 関数: 市場概況、セクター推奨、スコアリングマトリクス等の HTML 生成 — Daily Report でそのまま再利用
- `scoreColor()`, `verdictColor()`: スコア/判定の色分けヘルパー — 共通ユーティリティとして抽出可能
- `loadWebSearchResults()`, `loadReevalResults()`: tmp/ からの JSON 読み込みパターン — 同じパターンで Round 1/2 データも読み込み可能

### Established Patterns
- **tmp/ JSON 境界**: TS ↔ Claude のハンドオフは `tmp/*.json` ファイル経由。Round 1/2 の出力先 `tmp/round-1/*.json`, `tmp/round-2/*.json` のパターン
- **並列 Agent 実行**: invest.md で 5 アナリストを同時に Agent ツールで起動する確立されたパターン
- **エラーハンドリング**: 無効 JSON 時のフォールバック保存、null フィルタリング
- **Immutable データ構造**: 全型に `readonly` を使用する規約

### Integration Points
- `invest.md` Step 3c: レポート生成コマンド実行箇所 — 3ファイル生成に更新が必要
- `invest.md` Step 3c 確認コード: `daily-report.html` と `meeting-minutes.html` の存在確認 — `portfolio-report.html` の追加が必要
- `REPORTS_DIR` 定数: `reports/` → `docs/` への変更が必要

</code_context>

<specifics>
## Specific Ideas

- アクセントカラーの使い分け: h1 の border-bottom、h2 の border-left、agent-card の border-left の色をレポートごとに変える
- Meeting Minutes は「会議の議事録」として、Round 1 の各アナリストの詳細な散文分析を完全な長さで表示する（JSON 圧縮ではなく、v1.0 品質のプロフェッショナルな長文）
- Phase 5 で追加された `analysis` フィールド（4セクション構成: 市場認識/専門領域からの洞察/注目銘柄の詳細分析/リスクと懸念）を Meeting Minutes で完全に活用する

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 6-3-Report Structure*
*Context gathered: 2026-06-25*
