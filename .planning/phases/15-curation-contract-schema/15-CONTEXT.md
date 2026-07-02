# Phase 15: Curation Contract & Schema - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

AIキュレーションの出力契約（`tmp/news-curation.json`）を zod スキーマとして定義し、幻覚URL・不正市場値を構造的に防止する。具体的には: `NewsCuration`/`CuratedArticle` 型（`src/meeting/types.ts`）、`newsCurationSchema`/検証・解決関数（`src/meeting/schemas.ts`）、記事ID付与の純関数と `collect-data.ts` への組み込み、fixture JSON によるスキーマ単体テスト（TDD）。対象要件: CURA-02（ID参照方式選定）、CURA-05（市場enum分類）。

HTMLレンダリング（Phase 16）、パイプライン統合・Agentステップ（Phase 17）、index.htmlリンク（Phase 18）は含まない。

</domain>

<decisions>
## Implementation Decisions

### 記事IDの割り当て方式
- **D-01:** `collect-data.ts` が `tmp/news.json` 書き出し時に各記事へ短い連番IDフィールド（例: n01…n80）を付与する。Agent は短いIDをコピーするだけなので転記ミスが起きにくく、TS側照合も単純。配列インデックス暗黙参照・URLハッシュは不採用。
- **D-02:** ID付与の実装は Phase 15 で `collect-data.ts` の変更まで含めて完結させる（ID付与の純関数 + スキーマ + 組み込み）。Phase 16/17 は「ID付き news.json」を前提にできる。CURA-02 が Phase 15 にマップされていることとも整合。

### 件数ソフトクランプの挙動
- **D-03:** Agent が15件超を選定した場合、キュレーション出力に含まれる Agent 自身の重要度順で上位15件に truncate する（TS実装は配列slice）。filter.ts の `sortByPriorityScore` による再ソートは不採用 — 重要度判断はこのコードベースで一貫してLLM著作（Architecture Pattern 3）。
- **D-04:** 選定件数が10件未満でもそのまま受理し、`console.warn` のみ。件数不足はエラーではなく情報量の少ない日として扱う（fail-soft整合）。プールからの機械的自動補充は不採用（補充記事に解説コメントがなく品質が不揃いになるため）。
- **D-05:** 選定0件も有効な契約として受理する。空配列はバリデーション通過とし、レンダリング側（Phase 16）が「本日は厳選記事なし」のグレースフル表示を出す。スキーマ失敗（null→フォールバック）と「正常だが0件」を区別できるようにする。

### 重要度の契約表現
- **D-06:** 各記事に `importance: high / medium / low` の zod enum フィールドを持たせ、配列順がグループ内の重要度順を表す。TS側でバッジ階層→配列順の安定ソートをかけ、「high の下に low」の矛盾を構造的に解消する（CURA-07「バッジと配列順は同一スコアから導出」の実現方法）。数値スコア方式は不採用（数値スコア否定の既存方針、LLM数値の偏り）。
- **D-07:** 記事リストはフラットな単一 `articles` 配列とし、各記事が `market: us / japan / global` の zod enum フィールドを持つ。市場別グルーピングは Phase 16 のレンダリング側で実施。市場別ネスト構造は不採用（LLMのキー名ドリフト・空グループ表現の契約表面積増を回避）。

### バリデーション寛容度と不正ID処理
- **D-08:** プールに存在しないID・重複IDは drop & `console.warn`。重複は初出のみ採用。残った有効記事でダイジェスト生成を継続する（1件の幻覚IDがダイジェスト全体を道連れにしない）。しきい値方式・全体失敗方式は不採用。
- **D-09:** スキーマは `portfolioAnalysisSchema` 系の passthrough + transform 耐性型パターンに寄せる。未知フィールドは許容し、欠落した任意フィールドはデフォルト補完。ただしコア契約（記事ID・market enum・importance enum）は厳格に検証する（ロードマップ成功基準2: 範囲外market値はバリデーションで検出）。
- **D-10:** 「なぜ重要か」解説コメントが欠落・空文字の記事は drop & 警告。解説コメントはダイジェストの価値の中核であり、掲載記事は必ずコメント付きという品質保証とする。

### Claude's Discretion
- IDの具体的な形式（`n01` 形式か `a1` 形式か、桁数など）
- 型・スキーマ・純関数の命名詳細と関数分割（既存 `schemas.ts` / `types.ts` の慣例に従う）
- fixture JSON の具体的なケース設計（ロードマップ成功基準4のカバレッジ: 正常系・件数過不足・不正enum値・不正ID参照 を満たすこと）
- リード文（CURA-09）・ティッカータグ（CURA-08）等 Phase 16 で描画されるフィールドのスキーマ上の詳細形状 — ただし契約自体は Phase 15 で完全定義する（Phase 16 は「Phase 15 の契約に基づく」ため）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.4 リサーチ（フェーズ構成・ピットフォールの根拠）
- `.planning/research/SUMMARY.md` — v2.4全体の推奨アプローチ・8ピットフォール・Phase 15が回避すべき Pitfall 2/3/6（幻覚URL・硬直件数検証・市場分類の信頼性）
- `.planning/research/PITFALLS.md` — ピットフォールの行レベル根拠
- `.planning/research/ARCHITECTURE.md` — 契約設計・ビルド順序の根拠（Pattern 1-3）

### 既存契約パターン（実装の直接の手本）
- `src/meeting/schemas.ts` — 既存のzod契約群。strict型（`meetingResultSchema`）と passthrough+transform 耐性型（`portfolioAnalysisSchema`、D-09で採用）の両系統、`keyArticles` のURL非保持前例
- `src/meeting/types.ts` — 契約に対応する readonly 型定義の置き場所（`NewsCuration`/`CuratedArticle` 追加先）

### ニュースデータの実形状
- `src/data/news/types.ts` — `RawNewsArticle`（現状IDフィールドなし、`ticker?` は既存フィールド）
- `src/data/news/filter.ts` — フィルタパイプライン（MIN=20/MAX=80）と `sortByPriorityScore`
- `src/scripts/collect-data.ts` — `tmp/news.json` 書き出し箇所（D-01/D-02のID付与組み込み先、失敗時 `[]` フォールバックあり）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `portfolioAnalysisSchema`（`src/meeting/schemas.ts`）: passthrough + transform 耐性型の直接の手本。`rawSchema.transform()` でフィールド名ドリフト吸収・デフォルト補完
- `validatePortfolioAnalysis()` パターン: `validateNewsCuration(data: unknown)` の関数シグネチャの手本
- 既存 fixture ベースのテスト慣例（vitest、`*.test.ts` 同居）

### Established Patterns
- `tmp/*.json` ファイルハンドオフが TS↔Claude の唯一の境界（stdout 不可）
- readonly / ReadonlyArray によるイミュータブル型（CONVENTIONS.md）
- 定性enum（`z.enum(["高","中","低"])` 等）はLLM著作値の確立パターン。ただし新スキーマの market/importance は英語小文字（`us/japan/global`, `high/medium/low`）— ロードマップ成功基準の表記に従う
- グレースフルデグラデーション: 失敗時 null 返却 + `console.warn`/`console.error`、型ガード付き filter

### Integration Points
- `src/meeting/types.ts` / `src/meeting/schemas.ts` — 型とスキーマの追加先（新フォルダ不要）
- `src/scripts/collect-data.ts` の `writeFile(news.json)` 箇所（59行付近） — ID付与の組み込み点
- Phase 16 が消費: `NewsCuration | null` を受けるピュア関数レンダラー
- Phase 17 が消費: `tmp/news-curation.json` の読み込み・検証呼び出し

</code_context>

<specifics>
## Specific Ideas

- ID は「短くコピーしやすい」ことが選定理由 — 長いハッシュはLLM転記ミスを誘発するため避ける
- truncate・drop の各所で `console.warn` による可視化を必須とする（黙って捨てない）
- 「スキーマ失敗（null）」と「正常0件（空配列）」のセマンティクス区別は障害調査のしやすさが動機

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope（v2.5+ の XREP-01 は既に REQUIREMENTS.md で追跡済み）

</deferred>

---

*Phase: 15-Curation Contract & Schema*
*Context gathered: 2026-07-02*
