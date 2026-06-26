# Project Research Summary

**Project:** Investment Agent v2.2 — News Quality & Pipeline Metrics
**Domain:** News pipeline improvement for multi-agent investment analysis system
**Researched:** 2026-06-26
**Confidence:** HIGH

## Executive Summary

v2.2はゼロから構築するものではなく、既存の TypeScript 投資エージェントへの**ピンポイントな追加**である。対象は4機能：クロスソース重複排除、関連性フィルタ、動的記事数供給、パイプライン計測。現状のパイプラインは約161件/日の記事を収集しているが、クロスソース重複排除が完全に欠如しており、非投資記事がアナリストのコンテキストを浪費し、アナリスト側の記事数上限（50件）がハードコードされたままである。研究の結論は「新しいnpm依存を追加せず、純粋なTypeScript関数として `src/data/news/filter.ts` に全フィルタロジックを集約せよ」という一点に集約される。

推奨アプローチはアーキテクチャ研究で定義されたビルド順序に従う3フェーズ構成：まずフィルタモジュール（型定義 + filter.ts + ユニットテスト）を作成し、次にcollect-data.tsとinvest.mdへの統合を行い、最後にパイプライン計測を追加する。既存のフェッチャー（finnhub.ts, google-news.ts, rss-sources.ts）は一切変更しない。フィルタは結合後の全記事を単一モジュールで処理することで、クロスソース比較を可能にする。

最大のリスクは3つある。①50文字プレフィックスによる現行重複排除の精度崩壊（見逃し・過剰除去の両方向に壊れる）、②関連性フィルタの過剰除外（Reutersの実証研究では標準的なキーワードブロックで54%の正規記事を誤除外）、③タイミング計測値がユーザーに届かない設計ミス（collect-data.tsのconsole.logはinvest.md最終出力に自動では届かない）。いずれもTDDアプローチと事前設計で防止できる。

## Key Findings

### Recommended Stack

既存スタック（TypeScript + tsx + yahoo-finance2 + fast-xml-parser + dotenv + zod）は**一切変更しない**。v2.2の全機能はネイティブTypeScript文字列/配列操作と Node.js ビルトイン（`performance.now()` for timing）で実装可能。新規npm依存はゼロ。

**Core technologies:**
- **TypeScript (ESM, "type": "module")**: 全新規コード — 既存プロジェクト設定と一致
- **Inline Dice/Jaccard coefficient**: タイトル類似度による重複排除 — 15行のコードのためにライブラリ不要
- **`performance.now()` (node:perf_hooks)**: パイプライン計測 — モノトニック保証あり（`Date.now()` はNTPジャンプで負値が出るため使用禁止）
- **RegExp配列**: 関連性フィルタ — NLPライブラリ不要
- **NFKC正規化**: 日本語タイトル正規化 — 標準APIで対応可能

**New source files:**
| File | Purpose |
|------|---------|
| `src/data/news/filter.ts` | 重複排除 + 関連性フィルタのピュア関数群 |
| `src/data/news/types.ts` | `NewsFilterStats` / `NewsFilterResult` 型定義追加 |

**Modified files:**
| File | Change |
|------|--------|
| `src/scripts/collect-data.ts` | filter.tsを呼び出し、フィルタ済み記事のみnews.jsonに書き込む |
| `.claude/commands/invest.md` | 50件ハードキャップ除去、パイプライン計測追加 |

⚠️ **Stack内の不一致注意:** STACK.md はDice係数（閾値0.80）を推奨し、FEATURES.md はJaccard類似度（閾値0.70）を推奨している。PITFALLS.mdは NFKC正規化後のハッシュ比較を推奨。**統一判断: NFKC正規化後のトークンJaccard（閾値0.70〜0.75）を採用する。** Dice係数は日本語多語タイトルでは過大評価になりうる。

### Expected Features

**Must have (table stakes — v2.2 scope):**
- **クロスソース重複排除** — Finnhub/GoogleNews/RSS横断で同一記事を除去；現状は完全欠如で理論上20〜40%が重複
- **非投資記事除外** — スポーツ・芸能・天気等のキーワードデナイリストによるフィルタ；Yahoo!ニュース・NHK経済から混入
- **全ソース24h時間フィルタ** — RSS系ソースは現状タイムフィルタなし；古い記事が最新記事として上位に来る
- **動的記事数上限** — 「最新50件」ハードコード除去；フィルタ済み実数をアナリストに供給（MAX=80, MIN=20）
- **パイプライン計測表示** — Step別実行時間と合計をユーザー向け最終出力に含める

**Should have (differentiators):**
- タイトル正規化前処理（NFKC + `【速報】` 等プレフィックス除去）— 重複排除精度の前提条件
- フィルタ前後の記事数ログ（生→dedup後→フィルタ後）— 除外率の継続監視
- 記事数フロア（最低10〜20件）— 過剰フィルタ時のアナリスト情報欠乏防止

**Defer (v2.3+):**
- Finnhubのポートフォリオティッカー別ニュース取得（API呼び出し増加を伴う）
- 時間帯重み付け（直近6h優先）

**Anti-features (do not build):**
- MinHash/LSH — 160件/日には過剰；O(n²)で十分
- ML/LLMベースの関連性スコアリング — 1記事ごとのAPI呼び出しはコスト面で非現実的
- アナリスト別記事パーソナライズ — v2.2スコープ外；全アナリスト共通フィードで十分
- クロス言語（英↔日）重複排除 — 埋め込みモデル必須；v2.2では同言語グループ内のみ

### Architecture Approach

アーキテクチャは「フィルタロジックの単一責任モジュール化」原則に基づく。`filter.ts` はI/Oを持たないピュア関数のみで構成され、単体テストが容易。`collect-data.ts` は既存の結合処理の直後に `filterNewsArticles()` を1回呼び出すだけ。既存のRSSソース別dedup（rss-sources.ts）はそのまま維持し、`filter.ts` は**クロスソース**deupを担当する二層構造。

**Major components:**
1. **`src/data/news/filter.ts` (NEW)** — URL正規化dedup → タイトル正規化dedup → 関連性フィルタ → `NewsFilterResult` を返す
2. **`src/scripts/collect-data.ts` (MODIFIED)** — filterNewsArticlesを呼び出し、フィルタ済み記事のみを`tmp/news.json`に書き込む；セクション別計測追加
3. **`.claude/commands/invest.md` (MODIFIED)** — 50件ハードキャップ削除；全フィルタ済み記事を読み込む；パイプライン全体計測

**Key patterns:**
- フェッチャー内では絶対にフィルタしない（クロスソース比較不可）
- denylist方式（非投資コンテンツを除外）> allowlist方式（投資コンテンツのみ通過）
- タイミング計測は `performance.now()` のみ（`Date.now()` 禁止）
- タイミング値は `tmp/pipeline-metrics.json` に書き出してinvest.mdで読む（stdout捨てられる問題を回避）

**Data flow:**
```
~165件 (raw) → URL dedup → ~145件 → タイトルdedup → ~125件 → 関連性フィルタ → ~85件 (quality)
                                                                                    ↓
                                                              invest.md: 全85件をアナリストに供給
                                                              (旧: 50件ハードキャップ)
```

### Critical Pitfalls

1. **50文字プレフィックスdedup の精度崩壊** — 既存`rss-sources.ts`の`title.slice(0, 50)`は偽陰性（異なる文体の同一記事が残る）と偽陽性（「【速報】…」系の別記事が除去される）の両方向に壊れる → NFKC正規化後のトークンJaccard類似度に置き換える；TDDでテストケースを先に書く

2. **関連性フィルタの過剰除外** — allowlistは54%の正規投資記事を誤除外する（Reuters実証）；「スポーツ用品株」の「スポーツ」でfalse positiveが発生 → denylistのみ使用；フィルタ前後の記事数を毎回ログして除外率5〜30%を監視

3. **RSS pubDateパース失敗による時系列破壊** — `new Date(pubDate || Date.now())`のフォールバックは古い記事を現在時刻として記録し最上位ソートされる → `new Date(0)`（エポック=ソート最下位）にフォールバックする；Invalid Dateのテストケース必須

4. **タイミング計測値がユーザーに届かない** — collect-data.tsのconsole.logはinvest.mdの最終出力に自動では届かない → `tmp/pipeline-metrics.json` への書き出し方式を採用；invest.mdの最後でファイルを読んで表示する

5. **50件制限のハードコード残存** — 変更は`collect-data.ts`だけでなく、エージェント側スクリプトにも`slice(0, 50)`が残存している可能性 → 実装前に`grep -r "slice(0, 50)\|最新50件" src/ .claude/`で全箇所を特定してから修正

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: News Filter Module（filter.ts基盤構築）
**Rationale:** フィルタモジュールはI/Oを持たないピュア関数なので、他コンポーネントと独立して先に作れる。TDDで確実に動作を保証してから統合することで、Pitfall 1（50字dedup精度崩壊）とPitfall 3（pubDateパース）を根本解決できる。
**Delivers:** `src/data/news/types.ts`（型定義）+ `src/data/news/filter.ts`（dedup + 関連性フィルタ）+ 完全なユニットテスト群
**Addresses:**
- クロスソース重複排除（FEATURES: table stakes）
- 非投資記事除外（FEATURES: table stakes）
- タイトル正規化（FEATURES: differentiator）
**Avoids:**
- Pitfall 1: 50文字プレフィックスdedup → NFKC正規化 + Jaccard類似度に置き換え
- Pitfall 2: クロスソースdedup欠如 → filter.tsで全ソース横断
- Pitfall 3: 関連性フィルタ過剰除外 → denylistのみ採用
- Pitfall 4: pubDateパース失敗 → parsePubDate()ユーティリティを合わせて作成
**Test cases (must include):**
- 同一URL、異なるソース → 1件に集約
- 類似タイトル（Jaccard ≥ 0.70）→ 1件に集約
- 「スポーツ用品株」→ denylistの「スポーツ」で除外されない
- Invalid pubDate → エポック(new Date(0))にフォールバック
- フィルタ前後のstatsカウントが正確

### Phase 2: Pipeline Integration（collect-data.ts + invest.md統合）
**Rationale:** Phase 1のフィルタモジュールが完成したあと、collect-data.tsへの統合とinvest.mdの50件ハードキャップ除去を同時に行う。両者はtmp/news.jsonを通じて結合しているため、一度に整合性を確保する。
**Delivers:** フィルタ済み記事のみをtmp/news.jsonに書き込む; アナリストが全フィルタ済み記事（〜85件）を受け取る; フィルタ前後の記事数ログ
**Addresses:**
- 動的記事数上限（FEATURES: table stakes）
- 全ソース24h時間フィルタ適用
- 記事数フロア/シーリング（MIN=20, MAX=80）
**Avoids:**
- Pitfall 5: 50件制限残存 → 統合前に全ハードコードをgrepで特定・除去
- Pitfall 8: Google News リダイレクトURL → タイトルベースdedupのみ使用確認
**Verification:** `collect-data.ts`単体実行でフィルタ統計ログを確認；`tmp/news.json`を目視で非投資記事がないか確認；除外率5〜30%以内

### Phase 3: Pipeline Timing（計測 + ユーザー表示）
**Rationale:** 計測は他機能から独立しているが、表示方式（stdout vs ファイル）を最初に設計しないと計測値がユーザーに届かない（Pitfall 7）。Phase 2完了後に追加することでE2Eで動作確認できる。
**Delivers:** ステップ別実行時間 + 合計をinvest.mdの最終出力に表示; `tmp/pipeline-metrics.json` に計測値を永続化
**Addresses:**
- パイプライン計測表示（FEATURES: table stakes）
- Step別内訳（FEATURES: differentiator）
**Avoids:**
- Pitfall 6: Date.now()の非モノトニック問題 → `performance.now()`のみ使用
- Pitfall 7: 計測値がユーザーに届かない → `tmp/pipeline-metrics.json`経由で表示

### Phase Ordering Rationale

- **フィルタモジュールを先に作る**: ピュア関数で依存がないため、単体テストで品質保証してから統合できる。逆順（統合してからテスト）だと実データで挙動を確認できず、閾値チューニングが困難になる。
- **統合を1フェーズにまとめる**: collect-data.tsとinvest.mdは`tmp/news.json`のコントラクトで接続しているため、両方を同時に変更するほうが中間状態（フィルタ済みだが50件上限のまま）を避けられる。
- **計測を最後に追加する**: 計測はパイプラインの正しい動作に依存しないが、E2Eで計測値を確認するにはPhase 2が完成している必要がある。

### Research Flags

**Needs deeper research during planning:**
- **Phase 1:** Jaccard類似度の閾値（0.70 vs 0.75 vs 0.80）は実データで検証が必要。Mock dataでは見えない偽陰性・偽陽性が出る可能性がある。最初は閾値を高め（0.80）に設定し、実データ確認後に下げることを推奨。
- **Phase 2:** denylistキーワードの精度確認が必要。「スポーツ」→「スポーツ用品株」の偽陽性など、日本語特有の文脈依存性は実データでの検証が必要。

**Standard patterns (skip research-phase):**
- **Phase 1 (実装):** ピュア関数 + TypeScript = 標準パターン。Dice/Jaccard係数の実装は確立済みアルゴリズム。
- **Phase 2 (統合):** importして呼び出すだけ。アーキテクチャ研究で詳細なBefore/Afterコードが提供済み。
- **Phase 3 (計測):** `performance.now()` + JSONファイル書き出しは標準パターン。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | コードベース直接分析 + npm公式ドキュメント確認；新依存ゼロの判断は確実 |
| Features | HIGH | コードベースの実測値（〜161件/日）が根拠；期待削減効果（〜20〜40%重複）はやや推定値 |
| Architecture | HIGH | 直接コード分析；Before/Afterの具体的コード例が提供されている |
| Pitfalls | HIGH | コードベース分析 + 公式ドキュメント + Reuters実証研究；全pitfallに具体的な「Warning signs」あり |

**Overall confidence:** HIGH

### Gaps to Address

- **Jaccard閾値の最適値**: 0.70（FEATURES.md推奨）と0.80（STACK.md推奨）に乖離がある。Phase 1完了後、実際の`tmp/news.json`データで両閾値を試して比較検証が必要。
- **除外率の実態**: フィルタ後に「5〜30%除外」が適切と研究は示しているが、実際のYahoo!ニュース・NHK経済RSSの非投資記事混入率は未測定。初回実行後にログで確認し、denylistを調整する。
- **performance.now() vs Date.now()の使い分け**: STACK.mdはDate.now()を推奨、PITFALLS.mdはperformance.now()を推奨している。**決定: performance.now()を採用**（PITFALLS研究が具体的リスクを示しており、STACK.mdの推奨は精度懸念を考慮していない）。
- **パイプライン計測の出力先設計**: `tmp/pipeline-metrics.json` vs stdout直接キャプチャのどちらが実装しやすいかはinvest.mdの具体的な構造次第。Phase 3で決定する。

## Sources

### Primary (HIGH confidence)
- コードベース直接分析: `src/data/news/rss-sources.ts`, `src/scripts/collect-data.ts`, `.claude/commands/invest.md`, `src/data/news/*.ts` — 実測値・現状コードの根拠
- [Node.js Performance APIs](https://nodejs.org/api/perf_hooks.html) — `performance.now()` モノトニック保証確認
- [Node.js perf_hooks docs](https://nodejs.org/api/perf_hooks.html) — `Date.now()`との差異確認

### Secondary (MEDIUM confidence)
- [NewsCatcher API: Article Deduplication](https://www.newscatcherapi.com/docs/news-api/guides-and-concepts/articles-deduplication) — URL + タイトル類似度の標準アプローチ確認
- [CrackingWalnuts: News Aggregator System Design](https://crackingwalnuts.com/post/news-aggregator-system-design) — 小規模（O(n²)）vs 大規模（MinHash）の分岐点確認
- [Feedly Engineering: News Clustering & Deduplication](https://feedly.com/engineering/posts/reducing-clustering-latency) — Jaccard/MinHashの本番採用事例
- [Scanz: Keyword-Based News Scanning](https://scanz.com/smart-ways-to-create-keyword-based-news-scans/) — 投資ニュースのキーワードallowlist/denylist業界標準確認

### Tertiary (LOW-MEDIUM confidence)
- [Keyword Blocking Demonetized 54% of Reuters Brand-Safe Stories](https://www.adexchanger.com/publishers/keyword-blocking-demonetized-more-than-half-of-reuters-brand-safe-stories/) — allowlist過剰除外リスクの実証（denylist推奨の根拠）
- [Cross-Lingual News Dedup research](https://yingjiezhao.com/en/articles/Cross-Lingual-News-Dedup-at-100-Dollar-a-Month/) — 英日クロス言語dedupが埋め込みモデル必須である根拠
- [RSS pubDate timezone issues](https://github.com/alexdebril/feed-io/issues/134) — RFC-822非準拠pubDateの実態
- [Text Normalization: Unicode Forms for NLP](https://mbrenndoerfer.com/writing/text-normalization-unicode-nlp) — NFKC正規化が日本語全角文字に必要な根拠

---
*Research completed: 2026-06-26*
*Ready for roadmap: yes*
