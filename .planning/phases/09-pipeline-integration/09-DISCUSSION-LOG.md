# Phase 9: Pipeline Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 09-Pipeline Integration
**Areas discussed:** フロア/シーリング挙動, 統計ログの出力形式, invest.md 記事供給方式

---

## フロア/シーリング挙動

### MIN=20 フォールバック戦略

| Option | Description | Selected |
|--------|-------------|----------|
| そのまま進行（推奨） | フィルタ後が20件未満でもそのまま使用。警告ログのみ出力。祝日や市場閉場日は記事が少ないので単純に少数で良い | |
| フィルタ緩和 | 時間フィルタを 24h → 48h に拡張するなどして 20 件に到達するまでフィルタを緩める。実装が複雑になる | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | ✓ |

**User's choice:** Claudeに任せる

### MAX=80 トリミング基準

| Option | Description | Selected |
|--------|-------------|----------|
| 新しい順に80件（推奨） | 日付降順ソートで最新80件を採用。シンプルで一貫性がある | |
| ソース多様性確保 | Finnhub/Google News/RSSから均等に採用して80件に。特定ソースに偏らないが実装が複雑 | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | ✓ |

**User's choice:** Claudeに任せる

### MIN/MAX制御の配置

| Option | Description | Selected |
|--------|-------------|----------|
| filter.tsに入れる（推奨） | filterNewsArticles()の戻り値が既にMIN/MAX制御済み。collect-data.tsは呼ぶだけ。単体テストで全フローを検証できる | |
| collect-data.tsで制御 | filter.tsはフィルタのみ、件数制御は呼び出し側の責務。関心の分離が明確 | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | ✓ |

**User's choice:** Claudeに任せる

---

## 統計ログの出力形式

### ログ粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 3段階表示（推奨） | Success Criteria通り「ニュース: 160件 → dedup: 120件 → フィルタ後: 85件」の3段階。stats内部の5段階を集約 | |
| 5段階表示 | 内部statsの全段階をそのまま出力。デバッグに便利だが出力が冗長 | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | ✓ |

**User's choice:** Claudeに任せる

---

## invest.md 記事供給方式

### アナリストへの記事供給数

| Option | Description | Selected |
|--------|-------------|----------|
| 全記事をそのまま（推奨） | 「最新50件」を「全件」に置換。filter済みなので品質保証済み、MAX=80なのでトークン増加も最大60%程度 | ✓ |
| 件数を動的表示 | 「フィルタ済みN件」と動的に表示。アナリストが供給数を認識できるがinvest.mdが実行時に件数を入れる必要がある | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | |

**User's choice:** 全記事をそのまま

### 表記の書き換え方

| Option | Description | Selected |
|--------|-------------|----------|
| 「全件」に置換 | 「※最新50件」→「※フィルタ済み全件」。シンプルで明確 | |
| 表記完全削除 | 件数に関する表記自体を削除。「tmp/news.json の内容」のみ残す。制約なしのほうがLLMに自然 | |
| Claudeに任せる | 技術的に最適な方式を下流エージェントが決める | ✓ |

**User's choice:** Claudeに任せる

---

## Claude's Discretion

- MIN=20 フォールバック戦略
- MAX=80 超過時のトリミング基準
- MIN/MAX 制御ロジックの配置先
- 統計ログのフォーマット・粒度
- invest.md の「最新50件」表記の書き換え方

## Deferred Ideas

None
