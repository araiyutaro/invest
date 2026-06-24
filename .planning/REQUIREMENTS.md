# Requirements: Investment Agent

**Defined:** 2026-06-24
**Core Value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること

## v2.0 Requirements

Requirements for Claude Code Migration. Each maps to roadmap phases.

### Skill & Orchestration

- [ ] **SKILL-01**: ユーザーが `/invest` コマンドでデータ収集から分析・レポート生成までの全パイプラインを実行できる
- [ ] **SKILL-02**: パイプラインがデータ収集→並行分析→レポート生成の順序で制御される
- [ ] **SKILL-03**: 各ステップの実行進捗がユーザーに表示される

### Analyst Subagents

- [ ] **AGENT-01**: ファンダメンタルズアナリストが財務データに基づく分析を提供する
- [ ] **AGENT-02**: テンバガーハンターが高成長中小型株を発掘・推奨する
- [ ] **AGENT-03**: マクロエコノミストがマクロ環境とセクターローテーションを分析する
- [ ] **AGENT-04**: テクニカルストラテジストがチャートパターンとエントリーポイントを分析する
- [ ] **AGENT-05**: リスクマネージャーが反論・リスク評価を行う
- [ ] **AGENT-06**: モデレーターが5アナリストの分析を統合・合議しレポートを構成する
- [ ] **AGENT-07**: 各アナリストが定義されたJSONスキーマに従って構造化された出力を返す
- [ ] **AGENT-08**: 5アナリストが並行して実行され分析時間が短縮される

### Data Layer

- [ ] **DATA-01**: 既存の市場データ・ニュース・ポートフォリオ取得がJSON形式で中間ファイルに出力される
- [ ] **DATA-02**: 各アナリストに必要なデータのみが絞り込まれて渡される（トークンコスト最適化）

### Research

- [ ] **RSRCH-01**: 注目銘柄に対してWebSearchで最新情報を調査できる
- [ ] **RSRCH-02**: WebFetchで詳細な記事内容を取得し分析に反映できる

### Report Generation

- [ ] **RPT-01**: 分析結果がBloomberg風ダークテーマHTMLレポートとして出力される
- [ ] **RPT-02**: レポートが `reports/YYYY-MM-DD/` に保存される

### Cleanup

- [ ] **CLN-01**: `@google/generative-ai` と `@google/genai` パッケージが除去される
- [ ] **CLN-02**: Gemini関連ファイル（charts.ts, research.ts, analyzer.ts等）が削除される
- [ ] **CLN-03**: GEMINI_API_KEY環境変数への依存が除去される

## Future Requirements

Deferred to v2.x+. Tracked but not in current roadmap.

### Enhanced Analysis

- **ENH-01**: スコアリングラウンドを専用並列サブエージェントで実行
- **ENH-02**: 前日レポートの注入によるクロスセッション分析記憶
- **ENH-03**: スキル自動起動のチューニング

## Out of Scope

| Feature | Reason |
|---------|--------|
| チャート画像生成 | Claude Code内で画像生成不可；テキストベースで十分 |
| launchd/cron自動実行 | Claude Codeスキルはアクティブセッション必須 |
| 新規アナリスト追加 | 既存5+1構成で十分、まず移行を完了させる |
| OAuth/外部認証 | 個人利用のみ、認証不要 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKILL-01 | — | Pending |
| SKILL-02 | — | Pending |
| SKILL-03 | — | Pending |
| AGENT-01 | — | Pending |
| AGENT-02 | — | Pending |
| AGENT-03 | — | Pending |
| AGENT-04 | — | Pending |
| AGENT-05 | — | Pending |
| AGENT-06 | — | Pending |
| AGENT-07 | — | Pending |
| AGENT-08 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| RSRCH-01 | — | Pending |
| RSRCH-02 | — | Pending |
| RPT-01 | — | Pending |
| RPT-02 | — | Pending |
| CLN-01 | — | Pending |
| CLN-02 | — | Pending |
| CLN-03 | — | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after initial definition*
