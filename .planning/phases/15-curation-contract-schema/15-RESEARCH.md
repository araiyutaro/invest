# Phase 15: Curation Contract & Schema - Research

**Researched:** 2026-07-02
**Domain:** zod スキーマ設計によるLLM出力契約の構造的検証（TS↔Claude JSON境界、既存 `meeting/schemas.ts` パターンの拡張）
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**記事IDの割り当て方式**
- D-01: `collect-data.ts` が `tmp/news.json` 書き出し時に各記事へ短い連番IDフィールド（例: n01…n80）を付与する。Agent は短いIDをコピーするだけなので転記ミスが起きにくく、TS側照合も単純。配列インデックス暗黙参照・URLハッシュは不採用。
- D-02: ID付与の実装は Phase 15 で `collect-data.ts` の変更まで含めて完結させる（ID付与の純関数 + スキーマ + 組み込み）。Phase 16/17 は「ID付き news.json」を前提にできる。CURA-02 が Phase 15 にマップされていることとも整合。

**件数ソフトクランプの挙動**
- D-03: Agent が15件超を選定した場合、キュレーション出力に含まれる Agent 自身の重要度順で上位15件に truncate する（TS実装は配列slice）。filter.ts の `sortByPriorityScore` による再ソートは不採用 — 重要度判断はこのコードベースで一貫してLLM著作（Architecture Pattern 3）。
- D-04: 選定件数が10件未満でもそのまま受理し、`console.warn` のみ。件数不足はエラーではなく情報量の少ない日として扱う（fail-soft整合）。プールからの機械的自動補充は不採用（補充記事に解説コメントがなく品質が不揃いになるため）。
- D-05: 選定0件も有効な契約として受理する。空配列はバリデーション通過とし、レンダリング側（Phase 16）が「本日は厳選記事なし」のグレースフル表示を出す。スキーマ失敗（null→フォールバック）と「正常だが0件」を区別できるようにする。

**重要度の契約表現**
- D-06: 各記事に `importance: high / medium / low` の zod enum フィールドを持たせ、配列順がグループ内の重要度順を表す。TS側でバッジ階層→配列順の安定ソートをかけ、「high の下に low」の矛盾を構造的に解消する（CURA-07「バッジと配列順は同一スコアから導出」の実現方法）。数値スコア方式は不採用（数値スコア否定の既存方針、LLM数値の偏り）。
- D-07: 記事リストはフラットな単一 `articles` 配列とし、各記事が `market: us / japan / global` の zod enum フィールドを持つ。市場別グルーピングは Phase 16 のレンダリング側で実施。市場別ネスト構造は不採用（LLMのキー名ドリフト・空グループ表現の契約表面積増を回避）。

**バリデーション寛容度と不正ID処理**
- D-08: プールに存在しないID・重複IDは drop & `console.warn`。重複は初出のみ採用。残った有効記事でダイジェスト生成を継続する（1件の幻覚IDがダイジェスト全体を道連れにしない）。しきい値方式・全体失敗方式は不採用。
- D-09: スキーマは `portfolioAnalysisSchema` 系の passthrough + transform 耐性型パターンに寄せる。未知フィールドは許容し、欠落した任意フィールドはデフォルト補完。ただしコア契約（記事ID・market enum・importance enum）は厳格に検証する（ロードマップ成功基準2: 範囲外market値はバリデーションで検出）。
- D-10: 「なぜ重要か」解説コメントが欠落・空文字の記事は drop & 警告。解説コメントはダイジェストの価値の中核であり、掲載記事は必ずコメント付きという品質保証とする。

### Claude's Discretion
- IDの具体的な形式（`n01` 形式か `a1` 形式か、桁数など）
- 型・スキーマ・純関数の命名詳細と関数分割（既存 `schemas.ts` / `types.ts` の慣例に従う）
- fixture JSON の具体的なケース設計（ロードマップ成功基準4のカバレッジ: 正常系・件数過不足・不正enum値・不正ID参照 を満たすこと）
- リード文（CURA-09）・ティッカータグ（CURA-08）等 Phase 16 で描画されるフィールドのスキーマ上の詳細形状 — ただし契約自体は Phase 15 で完全定義する（Phase 16 は「Phase 15 の契約に基づく」ため）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope（v2.5+ の XREP-01 は既に REQUIREMENTS.md で追跡済み）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURA-02 | AIキュレーションステップがフィルタ済み記事プール（20〜80件）から重要記事10〜15件をID参照方式で選定する（URLはTS側で照合、幻覚URL防止） | `assignArticleIds()` 純関数の設計（Architecture Patterns）、`resolveNewsCuration()` によるID→実データ照合（Code Examples）、既存 `keyArticles`（URLフィールド非保持）の前例確認 |
| CURA-05 | 記事が市場別（米国株 / 日本株 / グローバル）にグルーピングされる（zod enumで分類値を制約） | `z.enum(["us","japan","global"])` によるコア契約の厳格検証設計（Standard Stack, Common Pitfalls） — グルーピング自体はPhase 16だが、分類値の契約はPhase 15で完結 |
</phase_requirements>

## Summary

このフェーズは新規パッケージを一切導入しない、純粋な型・スキーマ設計フェーズである。既存の `src/meeting/schemas.ts` / `src/meeting/types.ts` に定義された `portfolioAnalysisSchema`（passthrough + transform 耐性型）と `webSearchResultSchema.keyArticles`（URL非保持・title+summaryのみ）という2つの確立済みパターンを、そのままキュレーション契約に適用すればよい。zod 4.3.6 は既にインストール済みで動作実績があり、`.passthrough()` を使った寛容フィールドと厳格フィールドの混在パターンも `holdingEvaluationSchema` で既に検証済みである。

設計の核心は「1つの契約に2層のバリデーションを持たせる」ことである。第1層は zod スキーマによる**構造検証**（`id`/`market`/`importance` の型・enum厳格チェック、それ以外は passthrough + デフォルト補完）。第2層は TypeScript 側の**解決関数**（`resolveNewsCuration()` などの名前）による**クロスリファレンス検証**（IDがプールに実在するか、重複していないか、コメントが空でないか、件数が10〜15の範囲かどうかの誰も知り得ない外部データ依存の検証）。zod単体ではプール（`tmp/news.json`）を参照できないため、ID実在チェックと件数ソフトクランプは必然的にTS関数側の責務になる。この2層構造をRESEARCH.md全体の設計方針として明記した。

**Primary recommendation:** `src/meeting/types.ts` に `NewsCuration`/`CuratedArticle` 型を、`src/meeting/schemas.ts` に「コア契約（id/market/importance）を厳格検証しそれ以外をpassthroughする生スキーマ」+「プール参照によりID解決・重複排除・コメント欠落除去・件数ソフトクランプを行う解決関数」を追加する。ID付与は `src/data/news/` 配下の新規純関数ファイルとして実装し、`collect-data.ts` の `tmp/news.json` 書き出し直前に組み込む。fixture は既存の `validate-meeting.test.ts` の慣例に倣い、独立した `.json` ファイルではなく `.test.ts` 内のインラインオブジェクトとして定義する。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 記事IDの採番 | Backend (collect-data.ts, データ収集層) | — | `tmp/news.json` 書き出し時点でのみ全記事集合が確定するため、この層で確定的に採番する必要がある |
| キュレーションJSON構造検証 | Backend (meeting/schemas.ts, 契約層) | — | 既存の全 `tmp/*.json` 契約が同じ層（`meeting/schemas.ts`）に定義されており、パイプライン内の唯一のTS↔Claude境界検証層 |
| ID→実データ解決（title/url/source照合） | Backend (meeting/schemas.ts, 契約層) | Backend (data/news, データ層) | 幻覚URL防止の要 — LLM出力はIDのみを信頼し、実データはTS側で `tmp/news.json` プールから引く。プールの型定義は data/news 層が所有 |
| market/importance の判定（LLM著作） | External (Claude Agent, Phase 17で呼び出し) | — | Architecture Pattern 3（LLM側分類・TS側レンダリングのみ）を踏襲。本フェーズはこの判定結果を受け取る「型」を定義するのみ |
| 件数ソフトクランプ・重複/欠落コメント除去 | Backend (meeting/schemas.ts, 契約層) | — | プールとの突き合わせが必要なロジックであり zod 単体では表現できない。解決関数（TypeScript純関数）の責務 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6（インストール済み、`node_modules/zod/package.json` で確認） | キュレーションJSON出力の構造検証・enum制約 | プロジェクト内の全 `tmp/*.json` 契約（`meetingResultSchema`, `portfolioAnalysisSchema`, `webSearchResultSchema` 等）が例外なくzodで検証されており、ここだけ生JSONを信頼するのは一貫性を欠く [VERIFIED: npm registry] |
| vitest | ^4.0.18（インストール済み） | スキーマ単体テスト（TDD RED→GREEN） | 既存の `validate-meeting.test.ts`/`collect-data.test.ts` と同じテストランナー。`npm test` = `vitest run` [VERIFIED: npm registry] |

**Version verification:** `npm view zod version` → 現行最新は 4.4.3（レジストリ確認 2026-07-02）。プロジェクトには 4.3.6 がロックされておりインストール済み（`package.json` の `^4.3.6` は 4.4.x への自動更新を許容するが、本フェーズでは新規インストール・バージョン変更は不要）。`npm view vitest version` → 現行最新 4.1.9、プロジェクトは 4.0.18 を使用中。いずれも本フェーズの作業に支障なし。

### Supporting
本フェーズで新規に追加すべきサポートライブラリはない。既存の `zod`/`vitest` のみで完結する。

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod (schema-first, runtime validation) | 型のみ（TypeScript interfaceのみ、実行時検証なし） | 却下 — LLM出力はコンパイル時型に従う保証がなく、このプロジェクトの全JSON契約が実行時検証必須という規約に反する |
| ID方式（連番文字列） | URLハッシュ・配列インデックス暗黙参照 | CONTEXT.md D-01で既に検討済み・却下。連番IDは転記ミスが起きにくく、TS側照合ロジックも単純なため不採用にした代替案は再考不要 |
| `.passthrough()` + 手動transform | zodの `discriminatedUnion`/`superRefine` によるクロスフィールド検証 | ID実在チェック（プール参照）はzodのスキーマ定義時点では不可能（外部データが必要）なため、`superRefine` では表現しきれない。TS側の独立した解決関数が必要 — これは代替案ではなく必然の設計 |

**Installation:**
新規パッケージのインストールは不要（zod/vitest は既にインストール済み）。

## Package Legitimacy Audit

本フェーズは新規外部パッケージを一切導入しない。既存の `zod@4.3.6`（プロジェクト全体で既に採用・実績あり）と `vitest@4.0.18`（既存テストスイートで稼働中）のみを使用する。slopcheck によるパッケージ正当性監査は **対象なし（N/A）** — 新規インストールコマンドが発生しないため実行不要。

もし将来的なプランニングでスキーマライブラリの追加が検討される場合は、その時点で本プロトコルを再実行すること。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ collect-data.ts (既存, MODIFIED)                                 │
│                                                                    │
│  filterNewsArticles()                                             │
│      │  RawNewsArticle[] (20-80件, ID無し)                        │
│      ▼                                                            │
│  assignArticleIds()  ← NEW pure function (このフェーズで実装)     │
│      │  NewsArticleWithId[] (id: "n01".."n80" 付与)               │
│      ▼                                                            │
│  writeFile(tmp/news.json)  ← 書き出しフォーマット変更(ID付き)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ tmp/news.json (Phase 17でAgentが読む・本フェーズは書き出しのみ)
                              ▼
                 [Phase 17: News Curation Agent — 本フェーズの範囲外]
                              │
                              │ 生成される想定JSON (id/market/importance/commentary...)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ meeting/schemas.ts (NEW additions)                                │
│                                                                    │
│  rawNewsCurationSchema.parse(agentOutput)                         │
│      │  第1層: 構造検証                                            │
│      │  - id: 必須string                                          │
│      │  - market: z.enum(["us","japan","global"]) 厳格             │
│      │  - importance: z.enum(["high","medium","low"]) 厳格         │
│      │  - それ以外: passthrough + デフォルト補完                    │
│      │  ※不正enum値・型不一致 → ここでthrow（呼び出し元がcatch）    │
│      ▼  検証通過後のRawNewsCuration
│  resolveNewsCuration(raw, pool, date, generatedAt)                │
│      │  第2層: プール参照によるクロスリファレンス検証                │
│      │  - 不明ID → drop & console.warn                            │
│      │  - 重複ID → 初出のみ採用、以降drop & console.warn           │
│      │  - commentary空文字 → drop & console.warn                  │
│      │  - title/url/source/publishedAt → プールから引く(LLM非依存) │
│      │  - 15件超 → Agent自身の順序で上位15件にslice、console.warn  │
│      │  - 10件未満 → console.warnのみ、そのまま受理                 │
│      │  - 0件 → そのまま有効な空配列として受理                      │
│      ▼                                                            │
│  NewsCuration { date, generatedAt, leadIn, articles: [...] }      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (Phase 16/17で消費 — 本フェーズの範囲外)
                              ▼
                    generateNewsDigestHtml() / tmp/news-curation.json
```

読み方: 本フェーズが実装するのは図の実線ボックス2つ（`assignArticleIds()` と `meeting/schemas.ts` の2層バリデーション）のみ。Agent呼び出し（Phase 17）とHTML描画（Phase 16）は契約の「消費者」として図に含めているが実装対象外。

### Recommended Project Structure
```
src/
├── data/
│   └── news/
│       ├── types.ts          # MODIFIED: NewsArticleWithId 型を追加
│       ├── article-id.ts     # NEW: assignArticleIds() 純関数 + .test.ts
│       └── filter.ts         # 変更なし（既存の20-80件フィルタ済み配列を入力として使う）
├── meeting/
│   ├── types.ts              # MODIFIED: NewsCuration, CuratedArticle 型を追加
│   ├── schemas.ts            # MODIFIED: newsCurationSchema系 + resolveNewsCuration() を追加
│   └── schemas.test.ts       # NEW: このフェーズの中心的TDD対象（現状ファイル自体が存在しない）
└── scripts/
    └── collect-data.ts       # MODIFIED: assignArticleIds() を書き出し直前に組み込み
```

**既存ファイルとの整合性メモ:** `src/meeting/schemas.ts`（現187行）と `src/meeting/types.ts`（現125行）はいずれも400行の目安を大きく下回っており、今回の追加（型定義+スキーマ+解決関数で概算60〜90行程度）を加えても問題なく収まる。新規ファイルを分割する必要はない。一方 `src/data/news/filter.ts`（現304行）にID付与ロジックを追記すると350行超になり得るため、責務分離と「多くの小さいファイル」原則（グローバルCLAUDE.md coding-style.md）に従い、ID付与は独立ファイル `article-id.ts` として新設することを推奨する。

### Pattern 1: 二層バリデーション（構造検証 + クロスリファレンス解決）

**What:** zodスキーマは「単体で検証可能な構造」のみを検証し（型・enum・必須/任意）、「外部データとの整合性検証」（IDがプールに実在するか等）は独立したTypeScript純関数に分離する。
**When to use:** LLM出力が外部の信頼できるデータソース（この場合 `tmp/news.json` のプール）を参照する形式である場合、常にこのパターンを使う。zodの `.refine()`/`.superRefine()` にプールを注入することも技術的には可能だが、既存コードベースにその前例がなく（`validatePortfolioAnalysis` 等はすべて自己完結した検証のみ）、テスタビリティ（プールをモックせずスキーマ単体テストができる）の観点からも関数分離の方が既存パターンに忠実。
**Example:**
```typescript
// Source: 既存 src/meeting/schemas.ts の portfolioAnalysisSchema パターンを踏襲
const curatedArticleRawSchema = z.object({
  id: z.string().min(1),
  market: z.enum(["us", "japan", "global"]),
  importance: z.enum(["high", "medium", "low"]),
  commentary: z.string().optional().default(""),
  tickers: z.array(z.string()).optional().default([]),
}).passthrough();

const rawNewsCurationSchema = z.object({
  leadIn: z.string().optional().default(""),
  articles: z.array(curatedArticleRawSchema).optional().default([]),
}).passthrough();

export function validateRawNewsCuration(data: unknown) {
  return rawNewsCurationSchema.parse(data); // 不正enum値はここでthrow
}
```

### Pattern 2: プール参照による幻覚防止（既存 `keyArticles` 前例の踏襲）

**What:** LLMにはURL/titleを一切出力させず、IDのみを出力させる。実際のtitle/url/source/publishedAtは常にTS側でプール（`tmp/news.json`）から引く。
**When to use:** LLM出力がHTML等の外部公開面に反映される全ての箇所。
**Example:**
```typescript
// Source: 既存 src/meeting/schemas.ts webSearchResultSchema.keyArticles の設計思想を継承
// (既存keyArticlesはurlフィールドを持たない = "LLMにURLを出力させない"の直接の前例)
export const webSearchResultSchema = z.object({
  // ...
  keyArticles: z.array(
    z.object({
      title: z.string(),   // ← urlフィールドが意図的に存在しない
      summary: z.string(),
    }),
  ),
  // ...
});
```
新設計では `keyArticles` と異なり `title` すら出力させず、`id` のみを出力させることで幻覚防止をさらに一段階強化する（`title` も文字列として自由記述させると、プール内の実タイトルとズレるリスクが残るため）。

### Anti-Patterns to Avoid
- **zodスキーマに `min(10).max(15)` のような配列長のハード制約を書く:** D-03/D-04/D-05で明示的に却下。ハード制約は境界値（9件・16件）でパイプライン全体を落とす（Pitfall 3、ARCHITECTURE.mdでも既に指摘済み）。
- **LLMにtitleやurlを自由記述させ、後からTS側で「近そうなもの」を推測でマッチングする:** 幻覚防止の意味がなくなる。IDによる完全一致のみを信頼する。
- **market/importance を数値スコアで表現する:** D-06/既存プロジェクト方針（`highlightedStocks.averageScore` はLLM複数エージェントの平均だが、単一エージェントが自己申告する数値スコアは別問題として明示的に不採用）。定性enumのみを使う。
- **ID実在チェックをzodの `.refine()` でプールをクロージャに閉じ込めて実装する:** 動作はするが、スキーマの再利用性・テスタビリティを損なう。既存コードベースの `.passthrough()` + 独立関数パターンに従い、検証ロジックを分離する。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| enum値の構造検証 | 手書きの `if (!["us","japan","global"].includes(v))` 分岐 | `z.enum(["us","japan","global"])` | 型安全性（`z.infer`でユニオン型が自動導出される）とエラーメッセージの一貫性が既存コードベース全体で確立済み |
| 未知フィールド/欠落フィールドへの耐性 | 独自のマージ・デフォルト補完ロジック | `.passthrough()` + `.optional().default(...)` | `portfolioAnalysisSchema`/`holdingEvaluationSchema` で既に実証済みのパターンをそのまま流用できる |
| HTMLエスケープ | 独自の文字列置換関数 | 既存 `report-utils.ts` の `escapeHtml()`（Phase 16で使用） | 本フェーズはレンダリングを含まないため直接使用しないが、契約設計時点で「commentary/titleは必ずescapeHtml対象になる」ことを前提にした型（プレーンstring、HTML断片を含まない）にしておく必要がある |

**Key insight:** このコードベースには既に「LLM出力の型ドリフトに寛容な検証パターン」（`portfolioAnalysisSchema`）と「LLM出力のURL非信頼パターン」（`webSearchResultSchema.keyArticles`）という2つの確立済み解法が存在する。本フェーズの契約設計はこの2つを組み合わせるだけで完結し、新しい検証手法を発明する必要はない。

## Common Pitfalls

### Pitfall 1: zodの配列長ハード制約による境界値でのパイプライン全断
**What goes wrong:** `z.array(curatedArticleRawSchema).min(10).max(15)` のようにスキーマレベルで件数を制約すると、Agentが9件や16件選定した瞬間に `parse()` がthrowし、その日のキュレーション全体が失敗する。
**Why it happens:** 「10〜15件」という要求をそのままzodの `.min()/.max()` に翻訳したくなるのは自然な発想だが、LLMの選定件数は境界付近でブレやすい（PITFALLS.md Pitfall 3で詳述）。
**How to avoid:** zodスキーマでは配列長を制約しない（`.optional().default([])` のみ）。件数の妥当性は `resolveNewsCuration()` 内でソフトクランプ（15件超はtruncate、10件未満はwarnのみ、0件は正常）として扱う。
**Warning signs:** テストケースで「9件選定」「16件選定」の入力を用意し、`resolveNewsCuration()` がthrowせず正しい件数の配列を返すことを確認する。

### Pitfall 2: 不正ID・重複IDの検証をzodスキーマだけで完結させようとする
**What goes wrong:** zodはスキーマ定義時点で外部データ（`tmp/news.json` のプール）にアクセスできないため、「このIDはプールに実在するか」はzod単体では検証不可能。これを無理にzodの `.refine()` にプールをクロージャで注入して実装すると、スキーマがプール依存になりテスト時に毎回プールのモックが必要になる。
**Why it happens:** 「バリデーションは全部zodでやりたい」という一貫性への欲求から発生しやすい。
**How to avoid:** ID実在チェック・重複排除・コメント欠落チェックは明示的に別関数（`resolveNewsCuration()` 等）に分離する。zodスキーマ単体テストとリゾルバ関数単体テストを別々に書けるようにする。
**Warning signs:** スキーマのテストにプールのモックデータが必要になっている場合、責務分離が崩れている兆候。

### Pitfall 3: `publishedAt` の型がID付与前後・JSON往復前後で食い違う
**What goes wrong:** `RawNewsArticle.publishedAt` は既存コードベースで `Date` 型（`src/data/news/types.ts`）だが、`collect-data.ts` が `JSON.stringify()` で `tmp/news.json` に書き出す時点で自動的にISO文字列に変換される（`Date.toJSON()`）。Phase 17でこのファイルを読み戻す際は `publishedAt: string` になっているため、本フェーズで定義する「プール参照用の型」を `Date` のまま設計すると、実行時の実データ（JSON往復後は必ずstring）と型定義が食い違う。
**Why it happens:** `assignArticleIds()` は `collect-data.ts` 内でJSON化される**前**の in-memory `RawNewsArticle[]`（`publishedAt: Date`）に対して動作するため、実装中は違和感なくDate型を扱ってしまうが、Phase 17でファイルから読み戻す消費者側は必ずstring型になる。
**How to avoid:** `assignArticleIds()` の入出力型（`NewsArticleWithId`）は `RawNewsArticle` を拡張して `Date` のままでよい（collect-data.ts内部の一時的な型）。一方、`resolveNewsCuration()` がプールとして受け取る型は「`tmp/news.json` をJSON.parseした後の実データ形状」＝ `publishedAt: string` として明確に定義する（別名の型、例えば `NewsArticlePoolEntry` などとして区別する）。この区別をコメントで明示すること。
**Warning signs:** `resolveNewsCuration()` のfixtureテストで `publishedAt: new Date(...)` を渡すコードが書かれていたら、実行時の実データ形状と乖離している疑いがある。

### Pitfall 4: 「fixture JSON」を独立した `.json` ファイルとして新設し、既存規約から逸脱する
**What goes wrong:** ロードマップの成功基準4は文字通り「fixture JSON」という表現を使っているため、`fixtures/valid-curation.json` のような独立ファイルを作りたくなるが、このコードベースには `find . -iname "*fixture*"` で確認した限り fixtures ディレクトリの前例が一切ない。既存の `validate-meeting.test.ts`/`collect-data.test.ts` は全て `.test.ts` ファイル内にインラインのJS/TSオブジェクト（またはJSON.stringifyした文字列）としてテストデータを定義している。
**Why it happens:** 「fixture」という言葉から独立ファイルを連想しやすいが、このプロジェクトでは「fixture」＝「テストファイル内に定義された固定データ」という意味で使われている（ロードマップのSUMMARY.mdの文脈からもそう読める）。
**How to avoid:** `src/meeting/schemas.test.ts`（新規作成）内に、正常系・件数過不足・不正enum値・不正ID参照の各ケースをインラインオブジェクトとして定義する。既存テストとの一貫性を優先する。
**Warning signs:** 新しいディレクトリ（`fixtures/`, `__fixtures__/` 等）を作成しようとしている場合は、既存規約からの逸脱を疑う。

## Code Examples

### 型定義（`src/meeting/types.ts` への追加案）
```typescript
// Source: 既存 PortfolioAnalysis/HoldingEvaluation の型設計パターンを踏襲
export interface CuratedArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // ISO 8601, tmp/news.jsonのプールから解決済み
  readonly market: "us" | "japan" | "global";
  readonly importance: "high" | "medium" | "low";
  readonly commentary: string;
  readonly tickers: ReadonlyArray<string>;
}

export interface NewsCuration {
  readonly date: string;
  readonly generatedAt: string;
  readonly leadIn: string; // CURA-09: 「今日の市場を動かすもの」リード文
  readonly articles: ReadonlyArray<CuratedArticle>;
}
```

### ID付与純関数（`src/data/news/article-id.ts`, 新規ファイル）
```typescript
// Source: このコードベースの純関数設計規約（CONVENTIONS.md「関数設計」）を踏襲
import type { RawNewsArticle } from "./types.js";

export interface NewsArticleWithId extends RawNewsArticle {
  readonly id: string;
}

/**
 * フィルタ済み記事配列に短い連番IDを付与する (D-01)。
 * 桁数は MAX=80 に対して2桁ゼロ埋め (n01〜n80) で十分。
 */
export function assignArticleIds(
  articles: ReadonlyArray<RawNewsArticle>,
): ReadonlyArray<NewsArticleWithId> {
  return articles.map((article, i) => ({
    ...article,
    id: `n${String(i + 1).padStart(2, "0")}`,
  }));
}
```

### スキーマ + 解決関数（`src/meeting/schemas.ts` への追加案）
```typescript
// Source: 既存 portfolioAnalysisSchema (passthrough+transform耐性) の設計を踏襲
const curatedArticleRawSchema = z.object({
  id: z.string().min(1),
  market: z.enum(["us", "japan", "global"]),
  importance: z.enum(["high", "medium", "low"]),
  commentary: z.string().optional().default(""),
  tickers: z.array(z.string()).optional().default([]),
}).passthrough();

const rawNewsCurationSchema = z.object({
  leadIn: z.string().optional().default(""),
  articles: z.array(curatedArticleRawSchema).optional().default([]),
}).passthrough();

export type RawNewsCuration = z.infer<typeof rawNewsCurationSchema>;

/** 第1層: 構造検証。不正enum値・型不一致はここでthrowする (D-09)。 */
export function validateRawNewsCuration(data: unknown): RawNewsCuration {
  return rawNewsCurationSchema.parse(data);
}

/** プールから解決する記事の最小形状 (tmp/news.jsonをJSON.parseした後の実データ形状) */
interface NewsArticlePoolEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // JSON往復後は必ずstring (Pitfall 3参照)
  readonly ticker?: string;
}

/**
 * 第2層: プール参照によるID解決・重複排除・件数ソフトクランプ (D-03/D-04/D-05/D-08/D-10)。
 */
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const seenIds = new Set<string>();
  const resolved: CuratedArticle[] = [];

  for (const item of raw.articles) {
    if (seenIds.has(item.id)) {
      console.warn(`[news-curation] 重複記事IDをdrop: ${item.id}`);
      continue;
    }
    const source = poolById.get(item.id);
    if (!source) {
      console.warn(`[news-curation] 不明な記事IDをdrop: ${item.id}`);
      continue;
    }
    if (item.commentary.trim() === "") {
      console.warn(`[news-curation] 解説コメント欠落によりdrop: ${item.id}`);
      continue;
    }
    seenIds.add(item.id);
    resolved.push({
      id: item.id,
      title: source.title,
      url: source.url,
      source: source.source,
      publishedAt: source.publishedAt,
      market: item.market,
      importance: item.importance,
      commentary: item.commentary,
      tickers: source.ticker ? [...new Set([source.ticker, ...item.tickers])] : item.tickers,
    });
  }

  let articles = resolved;
  if (articles.length > 15) {
    console.warn(`[news-curation] 選定${articles.length}件 > 15件、上位15件にtruncate`);
    articles = articles.slice(0, 15); // Agent自身の重要度順を尊重 (D-03, 再ソートしない)
  } else if (articles.length < 10) {
    console.warn(`[news-curation] 選定${articles.length}件 < 10件（情報量の少ない日として受理)`);
  }

  return { date, generatedAt, leadIn: raw.leadIn, articles };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| n/a（このプロジェクトは新規契約を追加するだけで、既存契約からの移行はない） | — | — | — |

**Deprecated/outdated:** なし。本フェーズは既存パターンの新規適用であり、既存契約の置き換えは発生しない。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ID付与は `src/data/news/article-id.ts` という新規ファイルに切り出すべき（`filter.ts` に追記しない） | Recommended Project Structure | 低リスク。プランナーが `filter.ts` への追記を選んでも動作上の問題はないが、300行超のファイルがさらに肥大化する（コーディング規約上の推奨からの逸脱） |
| A2 | fixtureは独立JSONファイルではなく `.test.ts` 内のインラインオブジェクトとすべき | Pitfall 4, Code Examples | 中リスク。ロードマップ文言「fixture JSON」を文字通り独立ファイルと解釈するプランナーがいた場合、本研究の推奨と食い違う。ただし既存コードベースに独立fixtureファイルの前例は皆無なため、確度は高い |
| A3 | `resolveNewsCuration()` という関数名・シグネチャ（プール・date・generatedAtを引数で受け取る設計） | Code Examples | 低リスク。CONTEXT.mdで命名詳細はClaude's discretionと明記されているため、プランナーが別名・別シグネチャを選んでも契約上の問題はない |
| A4 | `tickers` フィールド（CURA-08向け）はLLM出力の `tickers: string[]` とプールの既存 `ticker` フィールドをマージする設計 | Code Examples, Standard Stack | 中リスク。CURA-08の詳細形状はPhase 16の描画対象だが「契約自体はPhase 15で完全定義する」とCONTEXT.mdに明記されているため、この設計が妥当と判断したが、プランナー/ユーザーが別のティッカー抽出方式を意図している可能性がある |
| A5 | `leadIn`（CURA-09のリード文）は `NewsCuration` のトップレベルフィールドとして１個定義する設計 | Code Examples | 低リスク。CURA-09は「ページ冒頭の2〜3文の総括パラグラフ」であり記事単位ではないため、トップレベルフィールドが自然な設計だが、命名（`leadIn` vs `summary` vs `lede`）はClaude's discretion |

**このセクションが空でない理由:** 上記5件はいずれも「訓練データや一般的な設計知識」ではなく、既存コードベースの直接調査（Read/Bashツール）から導出した推論であるため、厳密には `[VERIFIED]` ではなく `[ASSUMED]`（コードベースパターンからの類推）に分類した。ただし全て低〜中リスクであり、CONTEXT.mdの「Claude's Discretion」条項でプランナー側に調整余地が明示的に残されている。

## Open Questions

1. **`resolveNewsCuration()` は Phase 15 でどこまでテストされるべきか**
   - What we know: CONTEXT.mdの canonical_refs は「検証・解決関数（`src/meeting/schemas.ts`）」を明示的にPhase 15の成果物としている。一方 domain boundary では「パイプライン統合・Agentステップ（Phase 17）は含まない」とも書かれている。
   - What's unclear: 解決関数自体の実装・fixtureベースの単体テストはPhase 15の範囲内（プールをfixtureとして注入するテストで完結できる）だが、実際に `tmp/news.json` を読み込み・Agentを呼び出す配線はPhase 17。この境界線は明確だが、プランナーがタスクを分割する際に念のため明記した方がよい。
   - Recommendation: Phase 15のタスクは「`resolveNewsCuration(raw, pool, date, generatedAt)` の純関数としての実装とfixtureベースのユニットテスト」に限定し、実ファイルI/O（`readFile('tmp/news.json')` 等）は一切書かない。I/OはPhase 17に委譲する。

2. **`tickers` フィールドのLLM出力形式（自由文字列 vs プールの既存tickerとの組み合わせ）は市場分類ほど重要度が高くないため、プロンプト設計はPhase 17に委ねてよいか**
   - What we know: CURA-08は「既存tickerフィールド + キュレーション時のタイトル/サマリーからの抽出」と明記されている。
   - What's unclear: LLMが抽出するticker文字列のバリデーション強度（例: `/^[A-Z]{1,5}(\.[A-Z])?$/` のような正規表現制約を入れるべきか、自由文字列のまま許容するか）は本研究では未決定。
   - Recommendation: 本フェーズでは `z.array(z.string())` として緩く受理し、厳格なticker形式検証は導入しない（誤検出によるdropのリスクの方が、多少ノイズが混じるリスクより高いと判断）。将来的にticker表示品質が問題になった場合のみPhase 16/17で強化する。

## Environment Availability

SKIPPED（新規外部依存なし — `zod@4.3.6`、`vitest@4.0.18` はいずれも `package.json`/`node_modules` で導入済みであることを確認済み。新しいCLIツール・サービス・ランタイムへの依存は発生しない）。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18（`package.json` `devDependencies` で確認、設定ファイルなし = デフォルト設定） |
| Config file | none — `vitest.config.*` は存在せず、`package.json` の `"test": "vitest run"` スクリプトのみで動作 |
| Quick run command | `npx vitest run src/meeting/schemas.test.ts` |
| Full suite command | `npm test`（= `vitest run`、全 `*.test.ts` を実行） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURA-02 | 正常系: 有効なID参照・enum値を持つキュレーションJSONが検証を通過し、プールから正しくtitle/url/sourceが解決される | unit | `npx vitest run src/meeting/schemas.test.ts -t "resolveNewsCuration"` | ❌ Wave 0（`src/meeting/schemas.test.ts` は新規作成） |
| CURA-02 | 異常系: プールに存在しないID参照はdropされ、有効な記事のみが返る | unit | 同上 | ❌ Wave 0 |
| CURA-02 | 異常系: 重複IDは初出のみ採用される | unit | 同上 | ❌ Wave 0 |
| CURA-02 | 異常系: 15件超の選定は上位15件にtruncateされる（パイプライン停止なし） | unit | 同上 | ❌ Wave 0 |
| CURA-02 | 異常系: 10件未満・0件でも例外を投げず受理される | unit | 同上 | ❌ Wave 0 |
| CURA-05 | 異常系: `market` に不正な値（例: `"US"`, `"米国"`, `"europe"`）を含むJSONは `validateRawNewsCuration()` でthrowする | unit | `npx vitest run src/meeting/schemas.test.ts -t "market enum"` | ❌ Wave 0 |
| CURA-05 | 正常系: `market` が `us`/`japan`/`global` いずれかであれば通過する | unit | 同上 | ❌ Wave 0 |
| CURA-02 (ID付与側) | `assignArticleIds()` が入力配列の順序通りに `n01`, `n02`... を採番する | unit | `npx vitest run src/data/news/article-id.test.ts` | ❌ Wave 0 |
| CURA-02 (統合) | `collect-data.ts` の `tmp/news.json` 書き出しに `id` フィールドが含まれる | unit | `npx vitest run src/scripts/collect-data.test.ts` | ✅ 既存ファイル（テストケース追加が必要） |

### Sampling Rate
- **Per task commit:** 該当ファイルのみ実行（例: `npx vitest run src/meeting/schemas.test.ts`）
- **Per wave merge:** `npm test`（全スイート）
- **Phase gate:** `npm test` が green であることを `/gsd:verify-work` 実行前に確認

### Wave 0 Gaps
- [ ] `src/meeting/schemas.test.ts` — 新規作成、`newsCurationSchema`系（`validateRawNewsCuration`, `resolveNewsCuration`）の全テストケースを収容
- [ ] `src/data/news/article-id.test.ts` — 新規作成、`assignArticleIds()` の単体テスト
- [ ] `src/scripts/collect-data.test.ts` への追加ケース — 既存ファイルに `tmp/news.json` 出力へのID付与検証を追加（新規ファイルではなく既存ファイルへの追記）
- [ ] フレームワークインストール: 不要（vitest既にセットアップ済み、`npm test` で全テスト実行可能）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 単一ユーザー・ローカルbatchパイプライン、認証機構なし（既存プロジェクト全体の前提） |
| V3 Session Management | no | セッション概念なし |
| V4 Access Control | no | アクセス制御概念なし（ローカル実行のみ） |
| V5 Input Validation | yes | `zod` によるLLM出力の構造検証（本フェーズの中心）。特に「信頼境界を越えるデータ（LLM出力）は必ずスキーマ検証を経る」という既存プロジェクト規約をそのまま適用 |
| V6 Cryptography | no | 暗号化対象データなし |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLMによるURL/タイトルの幻覚・改変（hallucinated article reference） | Tampering | ID参照方式（本フェーズの核心設計）— LLMにURLを一切出力させず、実データは必ずTS側プールから解決する |
| 不正/未知IDによるスキーマ外部データの取り込み試行 | Tampering / Spoofing | `resolveNewsCuration()` によるプール実在チェック。存在しないIDはdrop＆warnし、決してプレースホルダーやフォールバックURLを生成しない |
| HTML断片やスクリプトタグを含む `commentary` フィールドのXSS（描画はPhase 16だが、契約設計時点で対策すべき文字列型として扱う） | Tampering（出力面での改竄） | 本フェーズでは `commentary` を単純な `string` 型として定義し、HTMLエスケープ責務はPhase 16の `escapeHtml()`（既存 `report-utils.ts`）に委ねる。契約側でHTMLタグ除去等の加工は行わない（エスケープは描画直前が正しい層） |
| 件数ハード制約による意図しないDoS的挙動（大量記事や0件でパイプラインが例外停止） | Denial of Service（自己サービスに対する可用性リスク） | ソフトクランプ設計（D-03/D-04/D-05）— zodスキーマレベルで配列長を制約しない |

## Sources

### Primary (HIGH confidence)
- `/Users/arai/invest/src/meeting/schemas.ts`, `/Users/arai/invest/src/meeting/types.ts` — 既存契約パターンの直接読解（`portfolioAnalysisSchema`, `webSearchResultSchema.keyArticles`, `holdingEvaluationSchema`）
- `/Users/arai/invest/src/data/news/types.ts`, `/Users/arai/invest/src/data/news/filter.ts` — `RawNewsArticle` の実形状、MIN=20/MAX=80、既存の純関数設計規約
- `/Users/arai/invest/src/scripts/collect-data.ts` — `tmp/news.json` 書き出し箇所（59行付近）の直接確認
- `/Users/arai/invest/src/scripts/validate-meeting.test.ts`, `/Users/arai/invest/src/scripts/collect-data.test.ts` — 既存テスト規約（インラインfixture、`vi.mock`パターン）の直接確認
- `/Users/arai/invest/.planning/codebase/CONVENTIONS.md` — 命名規約、readonly/ReadonlyArrayパターン、エラーハンドリング規約
- `/Users/arai/invest/package.json`, `node_modules/zod/package.json` — インストール済みバージョンの直接確認（zod 4.3.6、vitest 4.0.18）
- `npm view zod version` / `npm view vitest version`（2026-07-02, レジストリ直接確認）
- `/Users/arai/invest/.planning/research/SUMMARY.md`, `PITFALLS.md`, `ARCHITECTURE.md` — v2.4マイルストーン全体のリサーチ（Pitfall 2/3/6の根拠、Phase 1提案設計）

### Secondary (MEDIUM confidence)
- なし（本フェーズは既存コードベースの直接調査で完結し、外部Web情報への依存が発生しなかった）

### Tertiary (LOW confidence)
- なし

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 新規パッケージなし、既存インストール済みバージョンをレジストリで直接確認
- Architecture: HIGH — 既存コードベースの直接読解に基づく、ARCHITECTURE.md（v2.4全体リサーチ）とも整合
- Pitfalls: HIGH — PITFALLS.md（v2.4全体リサーチ）の既存分析に加え、本フェーズ固有の型不整合（Pitfall 3: publishedAtのDate/string食い違い）を新たに発見・追加

**Research date:** 2026-07-02
**Valid until:** 30日（新規パッケージ依存なし・zod/vitestともに安定版であり陳腐化リスクが低いフェーズのため）
