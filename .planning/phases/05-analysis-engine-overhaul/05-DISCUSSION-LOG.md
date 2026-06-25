# Phase 5: Analysis Engine Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 5-Analysis Engine Overhaul
**Areas discussed:** Round 1 散文分析の形式, 銘柄発掘の入力ソース, Round 2 ディスカッションの深化, invest.md スキルコマンドの改修範囲

---

## Round 1 散文分析の形式

### Q1: Round 1 の出力形式をどう変えますか？

| Option | Description | Selected |
|--------|-------------|----------|
| ハイブリッド | JSON に `analysis` フィールド（複数段落の散文）を追加し、picks 等の構造化フィールドも維持 | ✓ |
| 散文特化 | 純粋な Markdown 散文を出力させ、picks 等は別ステップで抽出 | |
| 完全置換 | summary/highlights/risks を廃止し、analysis + picks のみのシンプルな構造 | |

**User's choice:** ハイブリッド
**Notes:** 既存のティッカー抽出・スコアリングパイプラインとの互換性を重視

### Q2: analysis フィールドの散文に最低限の構成要件を設けますか？

| Option | Description | Selected |
|--------|-------------|----------|
| セクション指定 | 4 セクション構成（市場認識/専門領域からの洞察/注目銘柄の詳細分析/リスクと懸念）を要求 | ✓ |
| 自由形式 | 最低文字数のみ指定し、構成はアナリストに任せる | |

**User's choice:** セクション指定
**Notes:** 各アナリストの専門性に応じた深さを保証するため

### Q3: picks の rationale フィールドも拡張しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 300 文字に拡張 | picks の推奨理由も詳細化 | ✓ |
| 現状維持 (100 文字) | analysis フィールドで詳細はカバー済み | |

**User's choice:** 300 文字に拡張

### Q4: Round 1 の model 設定

| Option | Description | Selected |
|--------|-------------|----------|
| opus 維持 | 散文品質優先 | ✓ |
| sonnet に変更 | コスト削減 | |

**User's choice:** opus 維持

---

## 銘柄発掘の入力ソース

### Q5: Round 1 で各アナリストに渡すデータ構成

| Option | Description | Selected |
|--------|-------------|----------|
| 全員に全データ | market.json + news.json + portfolio.json を渡し、プロンプトで優先度を指示 | |
| ポートフォリオ除外 | market.json + news.json のみ。Portfolio Report は Phase 7 で別流 | ✓ |
| 役割別データ | 役割に応じてデータを使い分け。トークン節約 | |

**User's choice:** ポートフォリオ除外
**Notes:** 新規銘柄発掘に集中させるため、ポートフォリオを完全に切り離す

### Q6: ニュースデータの入力量

| Option | Description | Selected |
|--------|-------------|----------|
| 全員に最新 50 件 | 5 アナリスト全員にニュースを渡す。品質優先 | ✓ |
| 役割別にフィルタ | 各アナリストの専門に応じたニュースのみ | |

**User's choice:** 全員に最新 50 件

### Q7: 各アナリストが推奨する新規銘柄の数

| Option | Description | Selected |
|--------|-------------|----------|
| 1〜3 銘柄 | ROADMAP.md の成功基準と一致。分析が深くなる | ✓ |
| 制限なし | アナリストの判断に任せる | |

**User's choice:** 1〜3 銘柄

---

## Round 2 ディスカッションの深化

### Q8: Round 2 で他アナリストの Round 1 分析をどの程度共有するか

| Option | Description | Selected |
|--------|-------------|----------|
| 全文共有 | analysis 全文 + picks を共有。具体的な相互参照が可能 | ✓ |
| highlights + picks 維持 | 現状維持。コスト控えめ | |
| モデレーター要約経由 | モデレーターが Round 1 を要約してから共有 | |

**User's choice:** 全文共有
**Notes:** トークンコストより議論品質を優先

### Q9: Round 2 の出力形式

| Option | Description | Selected |
|--------|-------------|----------|
| 散文化 | discussion フィールド追加 + 明示的な相互参照要求 | ✓ |
| 現状維持 + 文字数拡張 | comment を 1000 文字に拡張するだけ | |

**User's choice:** 散文化

### Q10: Round 2 の model

| Option | Description | Selected |
|--------|-------------|----------|
| opus に変更 | 議論品質が最重要。他アナリストの分析を読み込む能力が必要 | ✓ |
| sonnet 維持 | コスト控えめ | |

**User's choice:** opus に変更

---

## invest.md スキルコマンドの改修範囲

### Q11: invest.md の改修アプローチ

| Option | Description | Selected |
|--------|-------------|----------|
| インプレース改修 | 既存の invest.md を直接編集。Step 2a/2c のプロンプトと JSON 形式を更新 | ✓ |
| スキルファイル分割 | フェーズごとに invest-data.md / invest-meeting.md / invest-report.md に分割 | |

**User's choice:** インプレース改修

### Q12: TypeScript 側の型定義・スキーマの更新タイミング

| Option | Description | Selected |
|--------|-------------|----------|
| 同時更新 | invest.md のプロンプト変更と合わせて TS 型・Zod スキーマも更新。整合性確保 | ✓ |
| Phase 6 で更新 | プロンプトのみ Phase 5、TS は Phase 6 でまとめて | |

**User's choice:** 同時更新

### Q13: Round 3 スコアリングの reason フィールド

| Option | Description | Selected |
|--------|-------------|----------|
| 100 文字に拡張 | 30 文字 → 100 文字。スコアリングマトリクスのセルが読みやすい範囲 | ✓ |
| 300 文字に拡張 | より詳細な根拠 | |
| 現状維持 (30 文字) | コンパクト維持 | |

**User's choice:** 100 文字に拡張

---

## Claude's Discretion

- エージェント systemPrompt（`src/agents/*.ts`）のニュース駆動銘柄発掘を促す表現の追加内容
- Round 2 の相互参照プロンプトの具体的な文面設計

## Deferred Ideas

None — discussion stayed within phase scope
