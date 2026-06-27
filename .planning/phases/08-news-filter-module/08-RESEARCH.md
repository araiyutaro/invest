# Phase 8: News Filter Module - Research

**Researched:** 2026-06-27
**Domain:** TypeScript純粋関数モジュール / テキスト正規化 / Jaccard類似度 / キーワードフィルタリング
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 重複排除 (Deduplication)
- **D-01:** Jaccard類似度の閾値は **0.75** に設定する（NFKC正規化後のトークンJaccard）。0.70は積極的すぎ、0.80は保守的すぎる
- **D-02:** 重複記事が見つかった場合、**summaryが長い方を残す**（アナリストへの情報量を最大化するため）
- **D-03:** クロス言語（英↔日）重複排除は**行わない**。同一言語グループ内のみでdedup
- **D-04:** 既存 `rss-sources.ts` の50文字プレフィックスdedup（155-161行目）は**完全削除**し、filter.tsに一元化する。二層構造にはしない

#### 関連性フィルタ (Relevance Filtering)
- **D-05:** マッチング方式は**除外+例外ルール**方式を採用する。denylistキーワードにマッチしても、投資関連キーワード（株、決算、上場、金利 等）が同時に存在すれば記事を通す
- **D-06:** 除外対象カテゴリは**娯楽・スポーツ・天気**の3ジャンル。政治・社会は除外しない（政策・規制は投資に影響するため）
- **D-07:** フィルタ方式は**denylist（ブロックリスト）のみ**。allowlist方式は54%の正規投資記事を誤除外するリスクがあるため使用しない

#### 時間フィルタ (Time Filter)
- **D-08:** 全ソースに統一の24時間以内フィルタを適用する（現状はFinnhubのみ）

### Claude's Discretion
- denylistの具体的なキーワードリストの策定（実データの傾向を見て調整可能）
- NFKC正規化の詳細実装（【速報】等のブラケットプレフィックス除去パターン）
- URL正規化の具体的な方法（Google Newsリダイレクト等の処理）
- `NewsFilterResult` / `NewsFilterStats` の型設計

### Deferred Ideas (OUT OF SCOPE)
なし — discussionがフェーズスコープ内に収まった
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEDUP-01 | Finnhub / Google News / RSS間でURL完全一致による重複記事が排除される | URLをSetのキーに使うPass1で実装。Google NewsリダイレクトURLは直接URLと異なるため、同一フィードからの重複を除去する用途が主 |
| DEDUP-02 | タイトルのNFKC正規化（全角→半角、【速報】等プレフィックス除去）後のJaccard類似度による重複記事が排除される | `String.prototype.normalize('NFKC')` + ブラケット除去 + トークン化 → Jaccard(a,b) ≥ 0.75 でPass2実装 |
| DEDUP-03 | 既存rss-sources.tsの50文字プレフィックスdedupがタイトル正規化Jaccardに置換される | rss-sources.ts 155-161行目の `seen.has(key)` ブロックを完全削除。filter.tsが全責任を持つ |
| FILT-01 | 非投資記事（スポーツ、芸能、天気等）がキーワードdenylistにより除外される | denylist + 投資キーワード例外ルールで実装。D-05のexception-based方式 |
| FILT-02 | 全ニュースソースに統一の24時間以内時間フィルタが適用される | `publishedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000` をfinnhub.ts参考に全ソースへ適用 |
</phase_requirements>

---

## Summary

Phase 8はI/Oを一切持たないピュア関数モジュール `src/data/news/filter.ts` をTDDで構築するフェーズである。入力は `RawNewsArticle[]`（全ソース結合済み）、出力はフィルタ済みの `RawNewsArticle[]` と統計情報を含む `NewsFilterResult` 型オブジェクトである。

このフェーズで実装するのは5つの機能の基盤となるロジックだけであり、collect-data.tsへの統合はPhase 9に委ねられる。filter.ts自体は外部依存ゼロ（新規npm依存なし）で、TypeScriptのビルトイン機能（`String.prototype.normalize('NFKC')`、Set、Array操作）だけで完結する。既存の `rss-sources.ts` 内50文字プレフィックスdedup（155-161行目）はPhase 8の計画08-02で完全削除する。

最大のリスクはJaccard閾値の調整と、denylistの過剰除外の2点である。前者はD-01で0.75に固定されているが、実データ検証で偽陰性（同一記事が残る）・偽陽性（別記事が除去される）の両方向を単体テストで事前に検証する必要がある。後者は「スポーツ用品株」の「スポーツ」でfalse positiveが起きないよう、D-05の投資キーワード例外ルールで防ぐ。

**Primary recommendation:** `filter.ts` をピュア関数のみで構成し、型定義・URL dedup・Jaccard dedup・denylistフィルタ・24hフィルタの5機能を独立した関数として実装する。テストファイル `filter.test.ts` を先に書いてからimplementationを書くTDD順序を厳守する。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL重複排除 | filter.ts (データ層) | — | クロスソース比較はソース別フェッチャーでは不可能。全ソース結合後のピュア関数が責任を持つ |
| タイトル正規化+Jaccard dedup | filter.ts (データ層) | — | 同上。言語非依存の純粋なテキスト類似度計算 |
| 関連性フィルタ (denylist) | filter.ts (データ層) | — | 定義済みルールセット。LLMやI/Oを必要としない |
| 24時間フィルタ | filter.ts (データ層) | — | 全ソース横断で統一適用するため集中管理 |
| rss-sources.ts内dedup削除 | rss-sources.ts (修正) | — | 既存の50文字プレフィックスdedupを完全除去する外科的修正 |
| フィルタ済み記事のnews.json書き込み | collect-data.ts | — | Phase 9担当。今フェーズでは着手しない |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | 実装言語 | プロジェクト既存スタック（変更なし） |
| vitest | ^4.0.18 | ユニットテスト | プロジェクト既存スタック。`npm test` / `npx vitest run` |
| `String.prototype.normalize('NFKC')` | ES2015+ | タイトル正規化 | Node.js/TSビルトイン。外部依存不要 [VERIFIED: MDN] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Set<string>` (ビルトイン) | ES6+ | URL dedup / トークンJaccardの集合演算 | O(n)でURL重複排除、Jaccard計算の交差・和集合に使用 |
| `Array.prototype.filter` (ビルトイン) | ES5+ | 時間フィルタ・関連性フィルタ | 純粋なデータ変換 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| インラインJaccard実装 | `string-similarity` npm | 160件/日に~15行のコードに依存追加は不要。npm pkgはlast updated 2023で事実上メンテなし |
| インラインJaccard（トークンベース） | Dice係数（バイグラム） | Dice係数は日本語の多語タイトルで過大評価になる。トークンJaccardが日英混合タイトルに適切 [CITED: .planning/research/SUMMARY.md] |
| denylist + exception方式 | allowlist方式 | allowlistはReuters実証で54%の正規投資記事を誤除外 [CITED: .planning/research/PITFALLS.md] |

**Installation:** 新規npm依存ゼロ。`package.json` への変更なし。

---

## Package Legitimacy Audit

このフェーズでは外部パッケージのインストールは行わない。既存パッケージ（vitest, typescript, tsx等）を継続使用するのみ。

**Packages removed due to slopcheck [SLOP] verdict:** なし
**Packages flagged as suspicious [SUS]:** なし

---

## Architecture Patterns

### System Architecture Diagram

```
[全ソース結合済み RawNewsArticle[]] (Phase 9でcollect-data.tsが渡す)
         │
         ▼
┌─────────────────────────────────────────┐
│           filterNewsArticles()           │
│                                         │
│  Pass 1: URL Dedup                      │
│  ─────────────────                      │
│  normalizeUrl(url) → Set<string>        │
│  同一URL → summaryが長い方を保持        │
│         │                               │
│         ▼                               │
│  Pass 2: Title Jaccard Dedup            │
│  ──────────────────────────             │
│  normalizeTitle(title)                  │
│    NFKC + 【】/[] 除去 + 小文字化       │
│  tokenize(normalized)                   │
│  jaccardSimilarity(a, b) ≥ 0.75        │
│  → summaryが長い方を保持                │
│  ※ 英語記事vs日本語記事はスキップ       │
│         │                               │
│         ▼                               │
│  Pass 3: Relevance Filter (FILT-01)     │
│  ──────────────────────────────         │
│  isDenylistMatch(title) &&              │
│  !hasFinancialKeyword(title)            │
│  → falseなら除外                        │
│         │                               │
│         ▼                               │
│  Pass 4: 24h Time Filter (FILT-02)     │
│  ─────────────────────────             │
│  publishedAt.getTime() >               │
│  Date.now() - 24*60*60*1000            │
│         │                               │
│         ▼                               │
│  → NewsFilterResult {                   │
│       articles: RawNewsArticle[],       │
│       stats: NewsFilterStats            │
│     }                                   │
└─────────────────────────────────────────┘
         │
         ▼
[フィルタ済み記事] (Phase 9でcollect-data.tsがtmp/news.jsonに書き込む)
```

### Recommended Project Structure

```
src/data/news/
├── types.ts          # 既存: RawNewsArticle + 今回追加: NewsFilterResult, NewsFilterStats
├── filter.ts         # 新規: filterNewsArticles() + ヘルパー関数群
├── filter.test.ts    # 新規: TDDテストファイル (Wave 0で先に作成)
├── finnhub.ts        # 既存: 変更なし
├── google-news.ts    # 既存: 変更なし
└── rss-sources.ts    # 既存: 155-161行目のdedup削除 (Plan 08-02)
```

### Pattern 1: ピュア関数 + 不変データ

**What:** filter.tsの全関数はI/Oを持たず、入力を変更せず新しいオブジェクトを返す
**When to use:** データ変換・フィルタリングの全ステップ

```typescript
// Source: プロジェクトの既存パターン (rss-sources.ts, collect-data.ts)
// readonly型アノテーション必須、スプレッド演算子でイミュータブルに

export function filterNewsArticles(
  articles: ReadonlyArray<RawNewsArticle>
): NewsFilterResult {
  const afterUrlDedup = deduplicateByUrl([...articles]);
  const afterTitleDedup = deduplicateByTitle(afterUrlDedup);
  const afterRelevance = filterByRelevance(afterTitleDedup);
  const afterTimeFilter = filterByTime(afterRelevance);

  return {
    articles: afterTimeFilter,
    stats: {
      raw: articles.length,
      afterUrlDedup: afterUrlDedup.length,
      afterTitleDedup: afterTitleDedup.length,
      afterRelevance: afterRelevance.length,
      final: afterTimeFilter.length,
    },
  };
}
```

### Pattern 2: NFKC正規化 + タイトルトークン化

**What:** 日本語タイトルを比較可能な形式に正規化する
**When to use:** Jaccard類似度計算の前処理として必須

```typescript
// Source: プロジェクトリサーチ (.planning/research/FEATURES.md) + MDN NFKC仕様
// [CITED: https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/normalize]

function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')              // 全角→半角、カタカナ正規化
    .replace(/【[^】]*】/g, '')     // 【速報】等を除去
    .replace(/\[[^\]]*\]/g, '')     // [PR]等を除去
    .replace(/[　\s]+/g, ' ')       // 全角スペースも含めて正規化
    .toLowerCase()
    .trim();
}

function tokenize(normalized: string): Set<string> {
  return new Set(
    normalized
      .split(/[\s　・、。,!?！？]+/)
      .filter(t => t.length >= 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
```

### Pattern 3: denylist + 投資キーワード例外ルール (D-05)

**What:** denylistにマッチしても金融キーワードがあれば通す
**When to use:** FILT-01の関連性フィルタ

```typescript
// Source: CONTEXT.md D-05 + .planning/research/FEATURES.md

// 除外: 娯楽・スポーツ・天気 (D-06)
const DENYLIST_PATTERNS: ReadonlyArray<RegExp> = [
  /スポーツ|野球|サッカー|テニス|競馬|ゴルフ|バスケ|オリンピック/,
  /芸能|タレント|俳優|歌手|アイドル|ドラマ|映画|コンサート/,
  /天気|台風|気象|豪雨|大雪/,
];

// 例外: 投資関連キーワードがあれば除外しない
const FINANCIAL_EXCEPTION_KEYWORDS: ReadonlyArray<RegExp> = [
  /株|株価|上場|決算|業績|利益|売上/,
  /金利|為替|円安|円高|インフレ/,
  /投資|ファンド|ETF|債券|IPO|M&A|買収/,
];

function isDenylisted(title: string): boolean {
  const hasDenyMatch = DENYLIST_PATTERNS.some(p => p.test(title));
  if (!hasDenyMatch) return false;
  // 例外: 投資関連キーワードがある記事は通す (D-05)
  const hasFinancialKeyword = FINANCIAL_EXCEPTION_KEYWORDS.some(p => p.test(title));
  return !hasFinancialKeyword;
}
```

### Pattern 4: URL正規化dedup (DEDUP-01)

**What:** URL完全一致で重複を除去し、summaryが長い方を残す (D-02)
**When to use:** 最初のPass（タイトルdedupより高精度・低コスト）

```typescript
// Source: コードベース分析 + プロジェクトパターン

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // クエリパラメータ（トラッキング等）を除去してcore URLを比較
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url; // パース失敗時はそのまま使用
  }
}

function deduplicateByUrl(
  articles: RawNewsArticle[]
): RawNewsArticle[] {
  const urlMap = new Map<string, RawNewsArticle>();
  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = urlMap.get(key);
    // D-02: summaryが長い方を残す
    if (!existing || article.summary.length > existing.summary.length) {
      urlMap.set(key, article);
    }
  }
  return [...urlMap.values()];
}
```

**注意:** Google NewsのURLは `news.google.com/rss/articles/CBMi...` というリダイレクトURL。同一フィードからの重複は除去できるが、Google NewsとFinnhub/直接RSSの同一記事はURLが異なるためタイトルJaccardが担当する。 [CITED: .planning/research/PITFALLS.md - Pitfall 8]

### Anti-Patterns to Avoid

- **フェッチャー内でフィルタしない:** finnhub.ts / google-news.ts / rss-sources.ts の内部でフィルタを行うと、クロスソース比較が不可能になる。全記事を結合してからfilter.tsに渡す
- **Date.now() をpubDateパースのフォールバックに使わない:** 古い記事が現在時刻として記録されソート最上位に来る。`new Date(0)`（エポック）にフォールバックする [CITED: .planning/research/PITFALLS.md - Pitfall 4]
- **英語記事と日本語記事をJaccard比較しない (D-03):** 同じ事件でも言語が異なれば単語セットが完全に異なる。`isJapaneseTitle(title)` 等で言語グループを判定してからdedup
- **allowlistを使わない (D-07):** 投資キーワードのみ通す方式は54%の正規記事を誤除外する実証あり

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode正規化 | 独自の全角/半角変換 | `String.prototype.normalize('NFKC')` | W3C標準。ES2015+で全環境対応。手動変換テーブルは漏れが出る |
| テキスト類似度 | Levenshtein距離の独自実装 | インラインJaccardトークンセット | 編集距離は単語順序に敏感で多語ニュースタイトルに不適。トークンJaccardは~15行で安全に実装可能 |
| 重複検出の状態管理 | クラスベースの状態持ちDeduplicator | `Map<string, RawNewsArticle>` / `Set<string>` | ピュア関数+ビルトインコレクションで十分。クラスにするとテストが複雑になる |

**Key insight:** 160件/日のO(n²)比較は最大160×160=25,600回。各比較は数百マイクロ秒以下。外部ライブラリ依存なしで<100msで完了する。

---

## Common Pitfalls

### Pitfall 1: 閾値0.75が「スポーツ用品株が高騰」を「スポーツ選手が優勝」と同一視する

**What goes wrong:** Jaccard閾値が低いと無関係な記事が同一視される。特に「スポーツ」「野球」などが両タイトルに含まれる場合
**Why it happens:** タイトルの共通トークン数が多いと閾値を超えてしまう
**How to avoid:** 同言語グループ内のみでdedup (D-03)。テストケースで「スポーツ用品株」vs「スポーツ選手」のJaccard値を事前計算して0.75未満であることを確認する
**Warning signs:** テストでdenylistがあるのにJaccardで除去される記事が出る

### Pitfall 2: rss-sources.tsのdedup削除漏れ

**What goes wrong:** `rss-sources.ts` 155-161行目を削除し忘れると二重dedupが残る
**Why it happens:** filter.tsを作っただけでrss-sources.ts側の修正を忘れがち
**How to avoid:** Plan 08-02のタスクとして明示的に「155-161行目削除」をステップに入れる。削除後に `grep -n "title.slice(0, 50)\|seen.has" src/data/news/rss-sources.ts` でゼロ件を確認
**Warning signs:** rss-sources.tsに `seen.has(key)` と `title.slice(0, 50)` が残っている

### Pitfall 3: Google NewsリダイレクトURLでURL dedup誤動作

**What goes wrong:** `news.google.com/rss/articles/CBMi...` URLをnormalizeUrl()に通すとhostname+pathnameが全記事で同じになる可能性
**Why it happens:** URLPathが記事ごとに異なるbase64エンコードになっているが、パース方法によっては切り落とされる
**How to avoid:** normalizeUrl()のテストにGoogle NewsリダイレクトURLを含める。CBMiトークン全体をpathとして保持することを確認する
**Warning signs:** URL dedup後に全Google News記事が1件になる

### Pitfall 4: 言語グループ判定の実装漏れ

**What goes wrong:** 英語Finnhub記事が日本語RSS記事と0.75以上の類似度になる（「AI」「EV」等の共通英数字トークン）
**Why it happens:** D-03の「同一言語グループ内のみ」制約を実装し忘れる
**How to avoid:** `deduplicateByTitle()` 内で英語記事と日本語記事を分けてから各グループ内でJaccard比較する。簡易実装: タイトルの50%以上がASCIIなら英語グループ
**Warning signs:** Finnhub英語記事が日本語RSS記事によって削除される

### Pitfall 5: denylist例外ルールの文字列照合範囲

**What goes wrong:** タイトルだけでなくsummaryまで照合するとノイズが増える
**Why it happens:** 照合対象がtitleかsummaryか設計が曖昧
**How to avoid:** denylist照合は**タイトルのみ**に適用する。summaryにスポーツ用語があっても投資記事として通す
**Warning signs:** フィルタ後の記事数が期待値の半分以下（過剰除外の兆候）

---

## Code Examples

### 型定義（types.ts追加分）

```typescript
// Source: CONTEXT.md - Claude's Discretion（型設計はClaude裁量）

export interface NewsFilterStats {
  readonly raw: number;
  readonly afterUrlDedup: number;
  readonly afterTitleDedup: number;
  readonly afterRelevance: number;
  readonly final: number;
}

export interface NewsFilterResult {
  readonly articles: ReadonlyArray<RawNewsArticle>;
  readonly stats: NewsFilterStats;
}
```

### 24hフィルタ（FILT-02）- finnhub.tsのパターン踏襲

```typescript
// Source: src/data/news/finnhub.ts lines 39-42 (参考実装)
// [CITED: コードベース直接分析]

function filterByTime(
  articles: ReadonlyArray<RawNewsArticle>
): ReadonlyArray<RawNewsArticle> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return articles.filter(a => a.publishedAt.getTime() > oneDayAgo);
}
```

### vitest テストパターン（プロジェクト標準）

```typescript
// Source: src/scripts/collect-data.test.ts - プロジェクト既存パターン

import { describe, it, expect } from 'vitest';
import { filterNewsArticles } from './filter.js';  // .js拡張子必須 (ESM)

const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: 'デフォルトタイトル',
  summary: 'デフォルト本文',
  source: 'TestSource',
  url: 'https://example.com/article',
  publishedAt: new Date(),
  category: 'japan_market',
  ...overrides,
});

describe('filterNewsArticles', () => {
  it('同一URLの記事が1件に集約される (DEDUP-01)', () => {
    const articles = [
      makeArticle({ url: 'https://nikkei.com/article/1', summary: '短い' }),
      makeArticle({ url: 'https://nikkei.com/article/1', summary: 'こちらの方が長い本文' }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe('こちらの方が長い本文'); // D-02: 長い方を残す
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| タイトル50文字プレフィックスdedup | NFKC正規化後トークンJaccard(≥0.75) dedup | Phase 8 | 偽陰性（見逃し）・偽陽性（過剰除去）の両方を解消 |
| Finnhubのみ24hフィルタ | 全ソース24hフィルタ | Phase 8 | RSSの古い記事が最新記事として混入する問題を解消 |
| ソース別フェッチャー内dedup | filter.tsに一元化 | Phase 8 | クロスソース重複排除が可能になる |

**Deprecated/outdated:**
- `rss-sources.ts` 155-161行目の `title.slice(0, 50)` キー: Phase 8完了時に削除

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 言語グループの簡易判定（50%以上ASCIIなら英語）で十分 | Architecture Patterns Pattern 2 | 英日混合タイトルで誤判定が起きる可能性。実データ確認後に閾値調整が必要 |
| A2 | denylistキーワードの初期リスト（スポーツ系・芸能系・天気系）でYahoo!ニュース・NHK経済の非投資記事を十分に捕捉できる | Common Pitfalls Pitfall 5 | 実データで除外率が5%未満や30%超になる場合はリスト調整が必要 |
| A3 | URL normalizeUrl()でGoogle NewsのCBMiパスが全記事で一意に保たれる | Common Pitfalls Pitfall 3 | 実装後にGoogle News URLテストで確認が必要 |

---

## Open Questions

1. **言語グループ判定の実装方法**
   - What we know: D-03で英語記事と日本語記事を分けてdedup。「同一言語グループ内のみ」
   - What's unclear: 「50%以上ASCIIなら英語」が実際のFinnhub/RSS記事で正確かどうか
   - Recommendation: filter.test.tsに「英語FinnhubタイトルとJapanese RSSタイトルが重複判定されない」テストケースを含める

2. **denylistキーワードの初期リストの妥当性**
   - What we know: 娯楽・スポーツ・天気が除外対象（D-06）
   - What's unclear: 初回実装時の除外率が5〜30%の適正範囲内かどうかは実データでないとわからない
   - Recommendation: Phase 8完了後、`tmp/news.json` の実データでNewsFilterStats.afterRelevanceを確認し、除外率が範囲外の場合はdenylistを調整する

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TypeScript実行 (tsx) | ✓ | — | — |
| vitest | テスト実行 | ✓ | ^4.0.18 (devDependencies) | — |
| TypeScript | 実装言語 | ✓ | ^5.9.3 | — |

**Missing dependencies with no fallback:** なし
**Missing dependencies with fallback:** なし

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | なし（package.json scripts.test のみ） |
| Quick run command | `npx vitest run src/data/news/filter.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEDUP-01 | 同一URLの記事が1件に集約され、summaryが長い方が残る | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| DEDUP-02 | NFKC正規化後Jaccard≥0.75の類似タイトル記事が1件に集約される | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| DEDUP-02 | 「【速報】日経平均株価上昇」と「日経平均株価上昇」が同一視される | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| DEDUP-03 | rss-sources.tsに `title.slice(0, 50)` が存在しない | unit (snapshot/grep) | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| FILT-01 | 「スポーツ選手が優勝」がdenylistで除外される | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| FILT-01 | 「スポーツ用品株が高騰」がdenylistで除外されない（例外ルール） | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| FILT-02 | 25時間前のpublishedAtを持つ記事が除外される | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| FILT-02 | 23時間前のpublishedAtを持つ記事が残る | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |
| DEDUP-02 | 英語記事と日本語記事がJaccardで同一視されない (D-03) | unit | `npx vitest run src/data/news/filter.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/data/news/filter.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` 全件グリーンを確認してから `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/data/news/filter.test.ts` — DEDUP-01/02/03, FILT-01/02の全テストケース（実装前に先に作成）
- [ ] `src/data/news/filter.ts` — テストをパスする実装（Wave 0ではスケルトンのみ）

---

## Security Domain

このフェーズはピュア関数によるデータ変換のみ。外部I/O・ユーザー入力・ネットワーク通信はなし。

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (low risk) | filter関数の入力は内部信頼データ (RawNewsArticle[])。型チェックはTypeScriptが保証 |
| V6 Cryptography | no | — |

**脅威パターン:** 外部入力なし。RSS/APIから取得済みデータをピュア変換するのみ。ReDoS（正規表現のカタストロフィックバックトラッキング）が唯一のリスクだが、denylistのパターンは単純なキーワード一致で発生しない。

---

## Sources

### Primary (HIGH confidence)
- コードベース直接分析: `src/data/news/rss-sources.ts` (155-161行目の削除対象確認), `src/data/news/finnhub.ts` (24hフィルタの参考実装), `src/data/news/types.ts` (入出力型), `src/data/news/google-news.ts` (GoogleニュースURL形式の確認)
- `.planning/phases/08-news-filter-module/08-CONTEXT.md` — ユーザーの確定決定事項 (D-01〜D-08)
- `.planning/research/SUMMARY.md` — v2.2リサーチの統合サマリー
- `.planning/research/STACK.md` — Jaccard/Dice係数のコード例と推奨スタック
- `.planning/research/PITFALLS.md` — 実装落とし穴の詳細分析
- `.planning/research/FEATURES.md` — 機能要件と実装コード例

### Secondary (MEDIUM confidence)
- [MDN: String.prototype.normalize()](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) — NFKC正規化の標準動作確認
- [Keyword Blocking Demonetized 54% of Reuters Stories](https://www.adexchanger.com/publishers/keyword-blocking-demonetized-more-than-half-of-reuters-brand-safe-stories/) — denylist-only方式の根拠

### Tertiary (LOW confidence)
- なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 新規npm依存ゼロ。ビルトインAPIのみ使用。コードベース直接分析で確認
- Architecture: HIGH — ピュア関数モジュールとしての設計はプロジェクトの既存パターンと一致
- Pitfalls: HIGH — コードベース分析 + 先行リサーチ（PITFALLS.md）に基づく実証済みリスク

**Research date:** 2026-06-27
**Valid until:** 2026-07-27（安定技術のため30日）
