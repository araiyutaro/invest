# Pitfalls Research

**Domain:** ニュース品質改善 & パイプラインメトリクス（v2.2 milestone）
**Researched:** 2026-06-26
**Confidence:** HIGH（コードベース直接分析 + 複数公式ソース検証）

> **Note:** このファイルは v2.2 milestone 専用。v2.0/v2.1（Gemini→Claude移行）のピットフォールは旧バージョンのPITFALLS.mdを参照。

---

## Critical Pitfalls

### Pitfall 1: 50文字プレフィックス重複排除の精度崩壊

**What goes wrong:**
`rss-sources.ts` の現行重複排除ロジック（`title.slice(0, 50)` をキーとする Set）は2方向で壊れる。
- **偽陰性（見逃し）**: "Toyota announces Q2 earnings beat" と "Toyota reports strong Q2 results" は同じ決算ニュースだが別キーになる。
- **偽陽性（過剰除去）**: 「【速報】日経平均株価が一時500円高…」というような定型プレフィックスを持つ記事が複数あると、最初の1件しか残らない。

**Why it happens:**
同一記事かどうかを「タイトルの文字列の先頭50文字」で判定しようとしている。しかしニュースは「同じイベントを別の切り口で書く」「ワイヤーサービス（Reuters等）の記事を各社が改変して配信する」という性質を持つ。単純なプレフィックスマッチでは意味的な同一性を捉えられない。さらに日本語全角文字は50文字でもバイト換算で異なるが、現行コードは文字数で切り取っているため日本語・英語混在で境界がズレる。

**How to avoid:**
- タイトルの最初N文字ではなく、**正規化後タイトル全体のハッシュ**をキーにする
- 正規化: NFKC変換 → 小文字化 → 句読点・記号除去 → 空白正規化
- 英語と日本語で戦略を分ける: 英語はtitle全体の類似度(Jaccard係数 > 0.7)、日本語はNFKC正規化後の完全一致
- 実用的な中間策: `title.normalize('NFKC').toLowerCase().replace(/[^a-z0-9぀-鿿]/g, '').slice(0, 80)` をキーにする

**Warning signs:**
- 同じ決算発表ニュースが5件以上並ぶ
- 「日経平均」系の記事が1日1件しかない（過剰除去）
- Finnhub の英語記事に "Reuters", "Bloomberg" が同じ事件で複数本ある

**Phase to address:**
Phase 1（重複排除実装）の最初にキー生成ロジックをテストファーストで実装。モックデータで偽陰性・偽陽性を定量評価してから本番適用。

---

### Pitfall 2: クロスソース重複排除が完全に欠如している

**What goes wrong:**
`collect-data.ts` の現行コード（line 35-44）は `finnhubNews.general`, `finnhubNews.merger`, `googleNews`, `rssNews` を**何も処理せず単純結合**している。クロスソース重複排除ゼロ。

具体的に発生するケース:
- Finnhub (英語): "Reuters: Toyota Q2 earnings beat estimates"
- jp.investing.com RSS (日本語): 「ロイター：トヨタ2Q決算、予想を上回る」

これは同一のロイター記事の英日翻訳版だが、URL・タイトル・言語が異なるためどの既存ロジックにも引っかからない。160件/日のうち理論上20〜40%が実質重複の可能性がある。

**Why it happens:**
各ソース内での重複排除（`rss-sources.ts` の Set）は実装されているが、**ソース間**の重複排除はスコープ外だった。v2.1 まで「とにかく件数を確保」が優先だったため問題が表面化しなかった。

**How to avoid:**
重複排除は2層構造にする:
1. **同一ソース内重複**: 既存の `seen` Set（ただし Pitfall 1 のキー改善後）
2. **クロスソース重複**: `collect-data.ts` で全記事結合後、URLの正規化ハッシュ OR タイトル正規化ハッシュを使って最終重複排除

URL正規化で注意: Google Newsの `link` フィールドは `news.google.com/rss/articles/CBMi...` というリダイレクトURLのため、URL一致では対応不可。**タイトル正規化ハッシュ** による重複検出が必要。

```typescript
// 推奨アプローチ
function deduplicateArticles(articles: RawNewsArticle[]): RawNewsArticle[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    const key = normalizeTitle(article.title); // NFKC + 小文字 + 記号除去
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

**Warning signs:**
- `news.json` に英語と日本語で内容が同じ記事が並んでいる
- アナリストレポートに同じ会社の同じ決算ニュースが複数言及される
- Finnhub 記事数と RSS 記事数を足すと 160件超えるが、重複排除後が 80件程度

**Phase to address:**
Phase 1（重複排除）で `collect-data.ts` の結合ポイントに最終重複排除ステップを追加する。単体テストで Finnhub+RSS の同一イベント記事ペアを使って検証。

---

### Pitfall 3: 関連性フィルタの過剰除外（false positives）でアナリストが投資関連ニュースを失う

**What goes wrong:**
キーワードインクルードリスト方式（「これらのキーワードが含まれていれば投資関連」）は精度が低い。Reuters の実証研究では、標準的なキーワードブロックリストが**54%の正規投資関連URLを誤って除外**した。

過剰除外の具体例:
- 「株」 → 「株式民主主義」「株式漫才」等の非金融記事がPASS、「小型株ファンド」がBLOCK（コンテキスト次第）
- 「リスク」 → 健康リスク、地震リスク、技術リスク など投資と無関係な記事が通過
- 「円」 → 「500円ランチ」「千円札」等が通過

**Why it happens:**
金融用語は文脈依存性が高い。単語レベルの一致では意味的関連性を判断できない。特に日本語は英語より曖昧性が高く（漢字の多義性、同音異義語）、単純なキーワードマッチは機能しない。

**How to avoid:**
**カテゴリベースフィルタ（既存フィールドを使う）を優先**する。`RawNewsArticle.category` フィールドはソース登録時に設定されており（"japan_market", "general", "merger" など）、これをプライマリフィルタとして使う。

キーワードフィルタは「明らかに無関係なカテゴリ」の排除に使う（除外リスト方式）:
```typescript
const IRRELEVANT_CATEGORIES = ['sports', 'entertainment', 'weather', 'lifestyle'];
const IRRELEVANT_TITLE_PATTERNS = [/芸能/, /スポーツ/, /天気/, /グルメ/, /レシピ/];
```

インクルードリスト（「これがあれば金融」）ではなく、**エクスクルードリスト（「これがあれば確実に非金融」）**を使う。False negative（見逃し）はfalse positive（過剰除外）より許容しやすい。

**Warning signs:**
- フィルタ後の記事数が期待値の半分以下（過剰除外）
- 「経済」「株価」というタイトルの記事がフィルタ後に残らない
- フィルタ適用前後で記事数を毎回ログ出力してから判断する

**Phase to address:**
Phase 2（関連性フィルタ）を独立実装し、フィルタ前後の記事数を必ずログ出力する。最初は除外率0%から始め、段階的にルールを追加してテスト。

---

### Pitfall 4: RSS pubDate のパース失敗が記事の時系列を破壊する

**What goes wrong:**
現行コード `new Date(item.pubDate || Date.now())` は、`pubDate` がパース不能な場合に `Date.now()` にフォールバックする。これにより**古い記事が現在時刻として記録**され、時系列ソートで最新記事として最上位に来る。

実際に問題が起きるケース:
- 非標準タイムゾーン文字列: `"Mon, 26 Jun 2026 08:00:00 JST"` → Node.js は `JST` を認識しないため Invalid Date
- RDF形式のNHK経済RSS: `<dc:date>2026-06-26T08:00:00+09:00</dc:date>` という異なるフィールド名
- 空文字列 or 欠損: `pubDate` 要素が存在しない

RFC 822 に準拠しない pubDate は現実のRSSフィードで広く見られる既知問題。

**How to avoid:**
```typescript
function parsePubDate(raw: string | undefined): Date {
  if (!raw) return new Date(0); // エポックにフォールバック（ソート最下位）
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return new Date(0); // Invalid Dateも最下位
  // 未来日付（24時間以上先）も疑わしいのでフォールバック
  if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) return new Date(0);
  return parsed;
}
```

`Date.now()` へのフォールバックは「最新記事として扱う」という意図せぬ挙動を招くため**絶対に使わない**。エポック(new Date(0))にフォールバックすれば最下位にソートされ、ハーム最小化できる。

**Warning signs:**
- `news.json` を確認して `publishedAt` が全記事で同一時刻になっている
- 記事が「2026-06-26T08:00:00.000Z」 (現在時刻) で大量発生
- NHK経済RSSからの記事の `publishedAt` が全て現在時刻

**Phase to address:**
Phase 1（重複排除実装）と合わせて `parsePubDate` ユーティリティを作成し、全ソースで共通使用。Invalid Dateのテストケースを必ず含める。

---

## Moderate Pitfalls

### Pitfall 5: 記事供給数変更時の消費側の見落とし

**What goes wrong:**
PROJECT.mdには「アナリストには最新50件のみ渡している」とあるが、`collect-data.ts` は `news.json` に全記事（160件以上）を書き出している。**50件制限は `collect-data.ts` ではなく、エージェント側のスクリプト**で適用されている可能性が高い。

「フレキシブルな件数に変更」する際に、`collect-data.ts` 側だけ変更して エージェント側の制限を見落とすと、**変更が無効**になる。逆に両方変更し忘れると不整合が生じる。

**How to avoid:**
変更前に `grep -r "50\|slice\|limit\|maxArticles" src/agents/ src/scripts/` で制限が適用されている箇所を全て特定する。変更後も同じ検索で残存箇所がないか確認。

記事数制限は1箇所で管理する設計にする:
```typescript
// src/data/news/config.ts (新規作成)
export const NEWS_LIMITS = {
  perAnalyst: 50, // デフォルト; フィルタ後の有効記事数に置き換え
  finnhubGeneral: 30,
  finnhubMerger: 10,
  googleNews: 20,
  rssPerSource: 10,
} as const;
```

**Warning signs:**
- `collect-data.ts` の変更後もアナリストが「50件のニュース」と言及する
- `src/agents/*.ts` 内に `slice(0, 50)` がハードコードされている
- フィルタ後0件でも「空の配列を渡した」という警告が出ない

**Phase to address:**
Phase 1 着手前に全コードベースで件数ハードコードを検索し、設定定数に集約する。

---

### Pitfall 6: 非同期パイプライン計測に Date.now() を使うと負の値が出る

**What goes wrong:**
`Date.now()` はモノトニック（単調増加）ではない。NTPによるシステムクロック補正が発生すると**時間が後退**し、`endTime - startTime` が負になる。毎朝8時に自動実行するシステムでは、OS の NTP 同期タイミングと重なる可能性がある。

さらに `Promise.all()` で並行実行されるステップのタイミングは、個別ステップが「いつ終わったか」ではなく「全部終わったら」しか計測できない。Finnhubが5秒、RSSが2秒かかっても、記録は「合計7秒」のように見える。

**How to avoid:**
```typescript
// 推奨: performance.now() を使う（Node.js でモノトニック保証）
import { performance } from 'node:perf_hooks';

const pipelineStart = performance.now();

// 個別ステップの計測
const t0 = performance.now();
await collectData();
const collectElapsed = performance.now() - t0; // 常に正の値

const t1 = performance.now();
await runAgents();
const agentElapsed = performance.now() - t1;

const totalElapsed = performance.now() - pipelineStart;
console.log(`パイプライン完了: 合計${totalElapsed.toFixed(0)}ms (収集:${collectElapsed.toFixed(0)}ms, 分析:${agentElapsed.toFixed(0)}ms)`);
```

`performance.now()` は `node:perf_hooks` モジュールから import する（ブラウザの `window.performance` ではない）。

**Warning signs:**
- 計測値がたまに負になる
- 全ステップ合計が「最も遅いステップ」より短い（並行実行の誤計測）
- Finnhub タイムアウトが発生しても計測値が正常に見える

**Phase to address:**
Phase 3（パイプライン計測）。タイミングは最初から `performance.now()` で実装。`Date.now()` は使わない。

---

### Pitfall 7: タイミング計測結果がユーザーに届かない

**What goes wrong:**
`collect-data.ts` は独立したTSスクリプトとして実行される（`npx tsx src/scripts/collect-data.ts`）。ここに `console.log` でタイミングを出力しても、`/invest` スキルの最終サマリーとしてユーザーに表示されない。スキルはBashツールでスクリプトを呼び出し、その出力を内部的に処理するため、計測値がどこで「最終表示」されるかを設計しないと計測結果が消える。

**How to avoid:**
タイミング計測の出力先を明確にする:
1. **オプションA**: `collect-data.ts` がタイミングをJSONとして `tmp/pipeline-metrics.json` に書き出す → スキルの最後でそのファイルを読んで表示
2. **オプションB**: スキル自体（Markdown）がBash呼び出し前後で `performance.now()` を計測し、最終メッセージに含める
3. **オプションC**: `collect-data.ts` の `console.log` 出力を、スキルがBashツール結果として受け取り、そのまま最終メッセージに転記する

オプションAが最も明示的で確実。

**Warning signs:**
- 計測値が `console.log` にあるのに `/invest` 実行後のユーザー表示に出てこない
- スキルの最終出力に「パイプライン完了: X秒」が含まれない
- `tmp/` ディレクトリにメトリクスファイルが存在しない

**Phase to address:**
Phase 3（パイプライン計測）設計時に、「どこで計測してどこに表示するか」の端点を最初に決める。

---

### Pitfall 8: Google News URL がリダイレクトURLでURL一致が使えない

**What goes wrong:**
`google-news.ts` の `item.link` は `https://news.google.com/rss/articles/CBMi...?hl=ja&gl=JP&ceid=JP:ja` という Google のリダイレクト URL を返す。これは同一記事の Canonical URL（例: `https://www.nikkei.com/article/DGXZQO...`）とは全く異なる。

URL ベースの重複排除を実装しても、Google News 経由の記事と直接 RSS 経由の記事は**永遠に別記事として扱われる**。

**How to avoid:**
Google News 経由の記事については URL ベースの重複排除を使わず、**タイトル正規化ハッシュのみ**で重複判定する。URLはレコードとして保持するが、重複排除キーには使わない。

将来的に Canonical URL が必要なら、Google News の redirect を実際にフォローして最終URLを取得する必要があるが、これは100件× HTTP リクエストになるためコスト高い。現状は不要。

**Warning signs:**
- URL ベースの重複排除を実装したが Google News と RSS の同一記事が残る
- `news.json` の Google News 記事 URL が全て `news.google.com` ドメイン
- Canonical URL を取りに行く fetch が大量発生（ネットワーク過負荷）

**Phase to address:**
Phase 1（重複排除）設計時に「URLではなくタイトルベース」と明記する。

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| タイトル50文字プレフィックスキーを維持 | コード変更なし | 重複見逃し・過剰除去の継続 | never（v2.2で必ず修正） |
| インクルードリスト方式の関連性フィルタ | 直感的に実装できる | 過剰除外でアナリスト情報欠乏 | 過剰除外が20%未満であることを確認した場合のみ |
| `Date.now()` で計測 | 実装簡単 | 負の値・NTPジャンプ対応不要 | never（`performance.now()` を使う） |
| `console.log` で計測値を出力するだけ | 実装簡単 | 計測値がスキル最終出力に届かない | スクリプト単体デバッグ時のみ |
| クロスソース重複排除を後回し | 最初の実装が楽 | アナリストへの重複情報供給が継続 | never（v2.2の主要目標） |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Finnhub × RSS 重複排除 | URLで一致しようとする | NFKC正規化タイトルハッシュで一致 |
| Google News RSS `link` フィールド | Canonical URL として扱う | `news.google.com` リダイレクトURLと認識し、URL重複排除から除外 |
| RDF形式RSS（NHK経済） | `item.pubDate` を参照 | `dc:date` フィールドも考慮（fast-xml-parserのnamespace設定に注意） |
| `rss-sources.ts` の内部dedup | 全体のdedup完了と思い込む | これはRSS内の重複のみ。Finnhub・Google News とのクロス重複は別途必要 |
| フィルタ後の記事数 | フィルタ実装=完成 | フィルタ前後の記事数をログして除外率を毎回検証する仕組みが必要 |
| `performance.now()` in Node.js | `window.performance.now()` と混同 | `import { performance } from 'node:perf_hooks'` を使う |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| フィルタ後0件の記事をアナリストに渡す | アナリストが「ニュースがありません」と報告 | フィルタ後記事数の下限チェック（最低10件保証） | フィルタが厳しすぎる場合 |
| 全Google News URLのリダイレクト解決 | 100件以上のHTTPリクエスト発生 | リダイレクト解決は行わずタイトルで重複判定 | URLベースのdedup要求が来たとき |
| 全デデュープ処理をO(n²)比較で実装 | 160件なら問題ないが将来的に遅延 | Set/Mapを使ったO(n)実装を最初から選ぶ | 1000件/日超えたとき |
| パイプラインの各ステップで毎回news.jsonを再読み込み | ディスクI/O増加 | 変数渡しで1回だけ読む | ステップが5つ以上になったとき |

---

## "Looks Done But Isn't" Checklist

- [ ] **重複排除実装**: RSS内のdedup だけでなく、Finnhub+GoogleNews+RSS のクロス重複が排除されているか — `news.json` を目視確認して同じイベントの英日記事が1件になっているか
- [ ] **関連性フィルタ**: フィルタ実装後、フィルタ前後の記事数が両方ログ出力されているか — 除外率が0%（フィルタ未動作）または80%超（過剰除外）でないか
- [ ] **記事数フレキシブル化**: `src/agents/` 内のハードコードされた50件制限が全て除去されているか — `grep -r "slice(0, 50)\|\.slice(0,50)" src/` でゼロ件を確認
- [ ] **タイミング計測**: `performance.now()` の値が `/invest` スキルの最終出力に表示されているか — コンソールではなくユーザー向けメッセージに含まれているか
- [ ] **pubDate正規化**: Invalid Date のフォールバックが `Date.now()` ではなく `new Date(0)` になっているか — NHK RSSや非標準フォーマットのテストケースがあるか
- [ ] **クロスソースdedup**: Google News と jp.investing.com の同一Reuters記事が1件に集約されているか

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 過剰除外でアナリストが情報不足 | LOW | フィルタルールをログで確認、除外率>30%なら除外パターンを1つずつ削除してA/Bテスト |
| タイミング値が負になる | LOW | `Date.now()` を `performance.now()` に全置換（5分作業） |
| 記事数変更が一部のみ適用された | MEDIUM | `grep -r "50"` で残存ハードコードを発見、定数定義に集約し直す |
| 重複排除キーの衝突で記事が0件 | MEDIUM | キーをハッシュ確認し、正規化ロジックを緩める（記号除去を減らす等） |
| pubDate パース失敗で全記事が同一時刻 | LOW | `parsePubDate` を追加し `new Date(0)` フォールバックに変更 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 50文字プレフィックスキーの精度崩壊 | Phase 1: クロスソース重複排除 | 同一イベントの英日記事ペアで重複が1件になるテスト |
| クロスソース重複排除の欠如 | Phase 1: クロスソース重複排除 | `collect-data.ts` 後のnews.jsonでURL重複・タイトル重複が0件 |
| 関連性フィルタの過剰除外 | Phase 2: 関連性フィルタ | フィルタ前後の記事数ログ、除外率5〜30%以内 |
| pubDate パース失敗 | Phase 1: 重複排除（前提作業） | NHK, Yahoo RSSのpubDateが正しく解析されるテスト |
| 記事供給数のハードコード見落とし | Phase 3: 件数フレキシブル化 | `grep` で全ハードコードを除去確認 |
| Date.now() 計測の非モノトニック問題 | Phase 4: パイプライン計測 | `performance.now()` のみ使用、Date.now()をコードベースから禁止 |
| タイミング計測値がユーザーに届かない | Phase 4: パイプライン計測 | `/invest` 実行後の最終出力に計測値が含まれることをE2Eで確認 |
| Google News リダイレクトURLの問題 | Phase 1: 重複排除設計 | URLではなくタイトルをdedup keyとする設計ドキュメント |

---

## Sources

- [NewsCatcher API — Articles Deduplication Guide](https://www.newscatcherapi.com/docs/v3/documentation/guides-and-concepts/articles-deduplication) — 3段階パイプライン（意味的類似度0.95 → Levenshtein → 信頼性）の実装例
- [Media Cloud Tech Brief: How We Deduplicate Content](https://medium.com/media-cloud-project/tech-brief-how-we-deduplicate-content-in-media-cloud-772cd46b6f7f) — URL正規化の限界とタイトルマッチングの現実
- [News Aggregator System Design — CrackingWalnuts](https://crackingwalnuts.com/post/news-aggregator-system-design) — LSH/MinHashによるスケーラブルな重複排除
- [MDN: Performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) — モノトニック計測の公式解説
- [Node.js Performance APIs](https://nodejs.org/api/perf_hooks.html) — `node:perf_hooks` の `performance.now()` 使用方法
- [Text Normalization: Unicode Forms for NLP](https://mbrenndoerfer.com/writing/text-normalization-unicode-nlp) — NFKC正規化が日本語全角文字に必要な理由
- [Keyword Blocking Demonetized 54% of Reuters Brand-Safe Stories](https://www.adexchanger.com/publishers/keyword-blocking-demonetized-more-than-half-of-reuters-brand-safe-stories/) — キーワードブロックの過剰除外リスクの実証例
- [RSS pubDate timezone issues — GitHub Issues](https://github.com/alexdebril/feed-io/issues/134) — RFC-822 非準拠のpubDateが現実に多発する証拠
- コードベース直接分析: `src/data/news/rss-sources.ts` (line 155-161), `src/scripts/collect-data.ts` (line 35-44)

---
*Pitfalls research for: v2.2 ニュース品質改善 & パイプラインメトリクス*
*Researched: 2026-06-26*
