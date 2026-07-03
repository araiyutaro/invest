# Phase 19: Data Foundation & Holding-News Supply - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 19-Data Foundation & Holding-News Supply
**Areas discussed:** 日本株カバレッジ戦略, ハンドオフ設計, 銘柄あたり供給上限, 0件銘柄のプロンプト表現

---

## 日本株カバレッジ戦略

### Q1: 日本株4銘柄のニュースマッチングをどうしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 社名部分一致フォールバック追加 (Recommended) | ticker一致を主とし、tickerなし記事に対してのみ nameJa/name のタイトル部分一致で補完。マッチ方式を結果に記録 | ✓ |
| Finnhub限定MVP | ticker一致のみ。日本株は「カバレッジ対象外」と明示。フォールバックはv2.6で判断 | |
| 両方実装して実測で判断 | フォールバック実装 + マッチ方式別件数ログでライブ検証。フラグで無効化可能 | |

**User's choice:** 社名部分一致フォールバック追加

### Q2: 社名フォールバックの適用範囲は？

| Option | Description | Selected |
|--------|-------------|----------|
| 全12銘柄に適用 (Recommended) | 米国株も含め ticker一致 + 社名一致の両方を評価。ロジック均一でテストもシンプル | ✓ |
| 日本株4銘柄のみ | 米国株はticker一致のみ。誤マッチ最小だが銘柄によってロジック分岐 | |
| tickerなし銘柄のみ動的適用 | その日のticker一致0件銘柄にのみ発動。日によって挙動が変わる | |

**User's choice:** 全12銘柄に適用

### Q3: 社名部分一致の照合対象はどこまでとしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| タイトルのみ (Recommended) | filter.ts denylistの前例踏襲。誤マッチが少ない | ✓ |
| タイトル + summary | カバレッジ最大化だが副次的言及もマッチしノイズ増 | |

**User's choice:** タイトルのみ

### Q4: 社名の表記ゆれ（短縮形・略称）をどう扱いますか？

| Option | Description | Selected |
|--------|-------------|----------|
| aliasesフィールド追加 (Recommended) | PORTFOLIO_HOLDINGSに任意のmatchAliases配列。照合は name + nameJa + aliases。人間がキュレーション | ✓ |
| 正式名のみ（name + nameJa） | 追加データなしでシンプル。取りこぼしは実測後にaliases後付け | |
| 自動短縮形生成 | 先頭語自動抽出。"Powell"がFRB議長と衝突する等の制御が難しい | |

**User's choice:** aliasesフィールド追加
**Notes:** POWL の "Powell" のような衝突しやすい略称は登録しない運用。

---

## ハンドオフ設計

### Q1: tmp/holding-news.json には何を保存しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| ID参照 + マッチメタ情報 (Recommended) | 記事ID + マッチ方式（ticker/name/alias）+ 優先度スコア。記事本体はnews.jsonが唯一のソース（v2.4前例踏襲） | ✓ |
| 記事フルコピー | 照合不要で単純だが、同一記事が2ファイルに存在し整合性保証がない | |

**User's choice:** ID参照 + マッチメタ情報

### Q2: 抽出処理はどこで実行しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| collect-data.ts に統合 (Recommended) | Step 1末尾でnews.json直後に生成。新ステップ不要。ロジックはholding-news.tsに切り出しユニットテスト | ✓ |
| 独立スクリプト（新ステップ） | extract-holding-news.ts新設。単独再実行可能だがパイプライン変更箇所が増える | |
| Step 3d 直前にインライン | 鮮度は保証されるがロジックがプロンプト内に埋まりテストしにくい | |

**User's choice:** collect-data.ts に統合

### Q3: portfolio-analyst のプロンプトにはどの形式でニュースを埋め込みますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 解決済み全文埋め込み (Recommended) | ID + 見出し + summary + ソース + 公開日時を照合解決して展開。URLは含めない | ✓ |
| 見出し + ソースのみ | 軽量だが見出しだけでの推測（実質幻覚）を誘発するリスク | |
| IDリストのみ | エージェントの手間が増え確実性が下がる | |

**User's choice:** 解決済み全文埋め込み

### Q4: holding-news.json の fail-soft 挙動はどうしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 常にファイル生成 + 欠損許容 (Recommended) | ニュース0件でも全12銘柄空配列で必ず書く + invest.md側もファイル欠損時に続行（二重fail-soft） | ✓ |
| ファイル必須化 | 供給保証は強いがニュース失敗日にポートフォリオ分析全体が止まる | |

**User's choice:** 常にファイル生成 + 欠損許容

---

## 銘柄あたり供給上限

### Q1: portfolio-analyst への1銘柄あたりの供給上限は何件にしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 5件（UI上限と揃える） (Recommended) | 供給と表示が同一集合になり透明性が保てる。Phase 20はholding-news.jsonをそのまま使える | ✓ |
| 8〜10件（供給は多め） | 判断品質は上がりうるが「判断根拠がカードにない」ケースが生まれる | |
| 3件（最小限） | 取りこぼしリスクあり | |

**User's choice:** 5件（UI上限と揃える）

### Q2: 上限5件超で切り捨てる際の並び順は？

| Option | Description | Selected |
|--------|-------------|----------|
| ticker一致を優先、同格はスコア順 (Recommended) | 確実性の高いticker一致を常に上位に。社名一致は補完 | ✓ |
| マッチ方式を区別せずスコア順のみ | シンプルだが誤マッチ社名記事がticker一致記事を押しのける可能性 | |

**User's choice:** ticker一致を優先、同格はスコア順
**Notes:** 質問文に「上限50件超」と誤記があったが「上限5件超」の意（回答に影響なし）。

---

## 0件銘柄のプロンプト表現

### Q1: 関連ニュースが0件の保有銘柄をプロンプトでどう表現しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 銘柄ごとに明示的な「ニュースなし」 (Recommended) | 全12銘柄を必ず列挙し0件銘柄に「本日の関連ニュースなし」を記載。幻覚検出もしやすい | ✓ |
| 0件銘柄はセクション省略 | プロンプトは短いがエージェントの推測余地が残る | |

**User's choice:** 銘柄ごとに明示的な「ニュースなし」

### Q2: ニュースセクションにエージェント向けの取り扱い指示を添えますか？

| Option | Description | Selected |
|--------|-------------|----------|
| ガード指示を添付 (Recommended) | ニュースなし銘柄はニュースに言及しない・列挙外ニュースを創作しない、を明記。Phase 22 PORT-03検証の土台 | ✓ |
| 指示なし（データのみ） | 反映指示はPhase 22でまとめて設計。それまで未制御 | |

**User's choice:** ガード指示を添付

---

## Claude's Discretion

- holding-news.json の具体的なJSONスキーマ形状
- holding-news.ts の関数分割・命名
- finnhub.ts バグ修正の実装形（回帰テストは複数配列インデックス位置で必須）
- matchAliases の初期キュレーション内容

## Deferred Ideas

- 社名フォールバックの実測誤マッチ率監査（ライブラン）— Phase 20/22 検証時またはマイルストーン監査時
- EE / NXT のWebSearchエンティティ衝突対策 — Phase 21 の領域
