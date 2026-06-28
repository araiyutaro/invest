---
phase: 09-pipeline-integration
plan: 01
status: complete
commits:
  - bb62fec  # test(09-01): add failing tests for filter integration
  - 9ab50db  # feat(09-01): integrate filter.ts into collect-data pipeline
---

# Plan 01 Summary — filter.ts 統合

## 達成した要件

| 要件 | 状態 |
|------|------|
| INTG-01: news.json にフィルタ済み記事のみが書き込まれる | ✓ |
| FILT-03: 3段階統計ログ（raw → dedup → フィルタ後）が出力される | ✓ |
| FILT-04 MAX: フィルタ後 80件超の場合、publishedAt 降順で 80件にトリミング | ✓ |
| FILT-04 MIN: フィルタ後 20件未満の場合、警告ログを出力してそのまま使用 | ✓ |

## 変更ファイル

### src/scripts/collect-data.test.ts
- `import type { RawNewsArticle }` 追加
- `vi.mock("../data/news/filter.js", ...)` 追加（デフォルト実装付き）
- 新 describe ブロック `"news filter integration (INTG-01/FILT-03/FILT-04)"` を追加
  - `makeArticle()` ヘルパー関数
  - INTG-01: フィルタ済み記事のみ news.json に書き込まれることを検証
  - FILT-03: 3段階統計ログの出力を検証
  - FILT-04 MAX: 90件→80件トリミングを検証
  - FILT-04 MIN: 10件で警告ログ出力、記事はそのまま使用を検証

### src/scripts/collect-data.ts
- `import { filterNewsArticles } from "../data/news/filter.js"` 追加
- `allArticles` 結合後にフィルタを適用
- 統計ログ: `ニュース: {raw}件 → dedup: {afterTitleDedup}件 → フィルタ後: {final}件`
- MAX=80: `publishedAt` 降順ソート後に 80件にスライス
- MIN=20: 件数が 20未満なら警告ログを出力
- `news.json` への書き込みを `allArticles` → `finalArticles`（フィルタ済み）に変更
- 旧 `ニュース収集完了 (${allArticles.length}件)` ログを削除

## テスト結果

- Task 1 (RED): 新テスト 4件 FAIL、既存テスト 7件 PASS ✓
- Task 2 (GREEN): 全テスト 11件 PASS ✓
- 全体スイート: 81件 PASS ✓

## 設計判断

- `let finalArticles` でトリミング処理を実装（可読性優先）。オブジェクト自体はミュートせず新配列を生成するためイミュータビリティ原則に準拠
- `vi.mock` のデフォルト実装に `mockReturnValue` を設定し、GREEN 移行後も既存テスト（Test 1-7）が壊れないよう保護
