---
phase: 15-curation-contract-schema
verified: 2026-07-02T14:20:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 15: Curation Contract & Schema Verification Report

**Phase Goal:** AIキュレーションの出力契約（記事ID参照方式・市場enum・ソフト件数制約）がzodスキーマとして定義され、幻覚URLと不正な市場分類を構造的に防止する
**Verified:** 2026-07-02T14:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 契約スキーマが記事IDのみを受理し、LLMのタイトル/URL自由生成がTS側実データ照合なしにはHTMLへ反映されない設計 | ✓ VERIFIED | `curatedArticleRawSchema`（src/meeting/schemas.ts:201-209）はid/market/importance/commentary/tickersのみを定義。仮にLLMがtitle/urlを出力しても`.passthrough()`で型上は残るが、`resolveNewsCuration`（238-289行）は`item`からid/market/importance/commentaryのみを読み、title/url/source/publishedAtは必ず`poolById.get(item.id)`（257行）からプールデータで上書きする。テスト「プール実在IDのtitle/url/source/publishedAtが正しく解決される（LLM出力のtitle/urlは使わない）」（schemas.test.ts:122-148）で実証。命名は`newsCurationSchema`ではなく`validateRawNewsCuration`/`rawNewsCurationSchema`だが、15-02-PLAN.mdの`<interfaces>`に「命名詳細はClaude's Discretion（CONTEXT.md）」と明記されており、意図的な裁量範囲内の命名。 |
| 2 | market分類フィールドがzod enum（us/japan/global）で制約され、範囲外の値を含むJSONはバリデーションで検出される | ✓ VERIFIED | `market: z.enum(["us", "japan", "global"])`（schemas.ts:204）。テスト`it.each(["US", "米国", "europe"])`（schemas.test.ts:72-81）で全異常値がthrowすることを確認。実行して green を確認済み。 |
| 3 | 記事選定件数が10〜15件の範囲外でもパイプラインを停止させず、ソフトクランプまたはtruncateされた結果を返す | ✓ VERIFIED | `resolveNewsCuration`はzodスキーマに`.min()`/`.max()`を書かず（grep確認: 0件）、`MAX_ARTICLES=15`超は`.slice(0, MAX_ARTICLES)`でtruncate（283行、再ソートなし）、`MIN_ARTICLES=10`未満はconsole.warnのみで受理（284-286行）、throwしない。テスト「16件→15件truncate」「9件受理」「0件受理」「いかなる入力でもthrowしない」（schemas.test.ts:190-246）で実証。 |
| 4 | fixture JSON（正常系・異常系: 件数過不足、不正enum値、不正ID参照）に対するスキーマ単体テストが全てパスする | ✓ VERIFIED | `npx vitest run src/data/news/article-id.test.ts src/scripts/collect-data.test.ts src/meeting/schemas.test.ts` を実行し、3ファイル35テスト全パスを確認（実行日時: 検証時点で再実行済み）。`npm test`（全体スイート）も11ファイル163テスト全パスで既存への回帰なし。 |

**Score:** 4/4 truths verified

### PLAN Frontmatter Must-Have Truths (D-01〜D-10)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| D-01 | assignArticleIds が入力順に連番ID（n01…）を付与し元配列を変更しない | ✓ VERIFIED | src/data/news/article-id.ts:20-27、`.map()`で新配列生成。テスト4件全パス |
| D-02 | collect-data の news.json 出力の各記事に id フィールドが含まれる | ✓ VERIFIED | src/scripts/collect-data.ts:59-63、`assignArticleIds(finalArticles)`をwriteFile直前に呼び出し。統合テストで実証 |
| 80件で n80（2桁ゼロ埋め） | - | ✓ VERIFIED | article-id.test.ts:37-44 |
| D-06 | importance が high/medium/low の zod enum で制約 | ✓ VERIFIED | schemas.ts:205、テストで"critical"がthrowすることを確認 |
| D-07 | market が us/japan/global の zod enum で制約、フラット単一配列 | ✓ VERIFIED | schemas.ts:204、214（articles はフラット配列） |
| D-09 | コア契約は厳格検証、それ以外は passthrough + デフォルト補完（省略時） | ✓ VERIFIED（下記WARNING参照） | schemas.test.ts:41-57 で articles/commentary/tickers 省略時のデフォルト補完を確認。ただし `null` 値入力時は throw する既知の挙動ギャップあり（下記 Anti-Patterns 参照） |
| - | resolveNewsCuration が LLM 出力の id のみを信頼し title/url/source/publishedAt をプールから解決 | ✓ VERIFIED | schemas.ts:257, 269-272 |
| D-03 | 15件超は Agent 順序のまま上位15件に truncate（再ソートなし） | ✓ VERIFIED | schemas.ts:281-283、テストで順序保持を確認 |
| D-04 | 10件未満は console.warn のみで受理 | ✓ VERIFIED | schemas.ts:284-286、テストで9件受理を確認 |
| D-05 | 0件も有効な契約として受理 | ✓ VERIFIED | schemas.test.ts:217-222 |
| D-08 | プール不在ID・重複IDは drop & warn（重複は初出のみ採用） | ✓ VERIFIED | schemas.ts:253-261、テストで実証 |
| D-10 | 解説コメント欠落・空文字の記事は drop & 警告 | ✓ VERIFIED | schemas.ts:262-265、テストで実証 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/news/article-id.ts` | assignArticleIds 純関数 + NewsArticleWithId 型 | ✓ VERIFIED | 両方 export 済み、substantive（27行、実ロジック） |
| `src/data/news/article-id.test.ts` | 単体テスト | ✓ VERIFIED | 4テスト全パス |
| `src/scripts/collect-data.ts` | assignArticleIds 組み込み | ✓ VERIFIED | import + `assignArticleIds(finalArticles)` 呼び出し確認、`writeFile`直前 |
| `src/meeting/types.ts` | NewsCuration / CuratedArticle 型 | ✓ VERIFIED | readonly型、文字列リテラルユニオン規約に準拠 |
| `src/meeting/schemas.ts` | curatedArticleRawSchema, rawNewsCurationSchema, validateRawNewsCuration, resolveNewsCuration | ✓ VERIFIED | 全export確認済み |
| `src/meeting/schemas.test.ts` | fixture ベース単体テスト | ✓ VERIFIED | 17テスト（validateRawNewsCuration 8件、resolveNewsCuration 9件）全パス |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| src/scripts/collect-data.ts | assignArticleIds | import + `writeFile`直前の呼び出し | ✓ WIRED | `assignArticleIds(finalArticles)`（collect-data.ts:59）、結果を`JSON.stringify(idArticles, null, 2)`で書き出し |
| src/meeting/schemas.ts | z.enum market/importance | curatedArticleRawSchema のコア契約厳格検証 | ✓ WIRED | `z.enum(["us","japan","global"])` / `z.enum(["high","medium","low"])` 確認済み |
| src/meeting/schemas.ts | pool | resolveNewsCuration の poolById 照合 | ✓ WIRED | `poolById.get(item.id)`（schemas.ts:257）でプール参照 |

Note: `resolveNewsCuration`/`NewsCuration`型は本フェーズ時点でまだ本番パイプライン（collect-data.ts や次フェーズのAgentステップ）から消費されていない。これは15-02-PLAN.mdの意図どおり（契約層のみを納品、消費はPhase 17）であり、ORPHANEDとしては扱わない。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| assignArticleIds/collect-data/schemas 単体テスト実行 | `npx vitest run src/data/news/article-id.test.ts src/scripts/collect-data.test.ts src/meeting/schemas.test.ts` | 3 files, 35 tests passed | ✓ PASS |
| 全体スイート回帰チェック | `npm test` | 11 files, 163 tests passed | ✓ PASS |
| 型チェック（対象ファイルのみ） | `npx tsc --noEmit \| grep "src/meeting/\|src/data/news/article-id"` | 該当なし（0件） | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CURA-02 | 15-01, 15-02 | フィルタ済み記事プールから重要記事10〜15件をID参照方式で選定（URLはTS側で照合、幻覚URL防止） | ✓ SATISFIED | assignArticleIds によるID付与 + resolveNewsCuration によるプール解決の両方が実装・テスト済み |
| CURA-05 | 15-02 | 記事が市場別にグルーピングされる（zod enumで分類値を制約） | ✓ SATISFIED（部分） | market enum 制約は実装・テスト済み。ただし「グルーピング」自体（表示上の市場別グループ化）はPhase 16（HTML描画）の責務であり、REQUIREMENTS.mdのトレーサビリティ表でもCURA-06（重要度順配列）がPhase 16に割当済み。Phase 15はデータ契約レベルのenum制約のみを担当— ROADMAPのPhase 15成功基準の文言と一致 |

REQUIREMENTS.md のトレーサビリティ表を確認した結果、Phase 15 に割り当てられた要求IDは CURA-02 / CURA-05 の2件のみで、両方とも15-01/15-02いずれかのPLAN frontmatterの`requirements`に宣言されている。ORPHANED requirement なし。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/meeting/schemas.ts | 206-207, 213-214 | `.optional().default(...)` は zod v4 で `undefined`（省略）のみ許容し `null` は throw する | ⚠️ Warning | LLM が非コアフィールド（commentary/tickers/leadIn/articles）を `null` で出力した場合、D-09 が意図する「デフォルト補完によるグレースフルデグラデーション」が働かず、`validateRawNewsCuration` がキュレーション全体を throw で失う。15-REVIEW.md の WR-01 で既に検出済み（fix案: `.nullish().transform()`への置換）。ROADMAP文言上の「省略時」ケースはテストで実証されており文字通りの D-09 は VERIFIED だが、実運用の LLM 出力パターン（null 頻出）に対する耐性ギャップとして記録する。Phase 17（OPS-04 fail-soft）により被害は「その日の news-digest 欠落」に限定され、他3レポートへは波及しない設計だが、機能自体の可用性を不必要に下げる |
| src/meeting/schemas.ts | 240-241, 252, 262 | resolveNewsCuration の「いかなる入力でも throw しない」というJSDoc上の保証が、raw.articles/item.commentary が undefined でないという型契約に暗黙依存 | ⚠️ Warning | 15-REVIEW.md WR-02。将来の呼び出し側が `validateRawNewsCuration` を経由せず直接キャストで渡した場合 TypeError の可能性。現状のPhase 15スコープ内では resolveNewsCuration は常に validateRawNewsCuration の出力を受け取る設計なので即座の実害はない |
| src/data/news/article-id.test.ts | 26-35 | イミュータビリティテストが浅いコピー比較のため要素の破壊的変更を検出できない | ℹ️ Info | 15-REVIEW.md WR-03。テストの実効性の問題であり、現在の実装（`.map()`による新オブジェクト生成）自体は正しい |
| src/scripts/collect-data.ts | 106-109 | トップレベル `main()` 自動実行がテストの信頼性に影響（既存問題、本フェーズ起因ではない） | ℹ️ Info | 15-REVIEW.md WR-04。ベースコミットから存在する既存の構造的問題 |

TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 等のデットマーカーは対象6ファイルいずれにも存在しない（grep確認済み、0件）。

### Human Verification Required

なし。本フェーズはスキーマ・純関数層のみの実装であり、UI/視覚的要素・外部サービス連携・リアルタイム挙動を含まない。全ての観測可能な真実は自動テスト・grep・型チェックで検証可能だった。

### Gaps Summary

ブロッキングなgapは検出されなかった。ROADMAP Phase 15 の4つの成功基準は全てコードベース上で実証され、PLAN frontmatterのD-01〜D-10全truthもテストで裏付けられている。CURA-02/CURA-05の両要求はPhase 15スコープ内で充足されている。

唯一の実質的な懸念は、コードレビュー（15-REVIEW.md WR-01）で指摘された `null` 値に対する zod `.optional()` の非対応で、LLMが非コアフィールドを`null`で出力した場合に第1層バリデーションがthrowしてしまう点である。これはROADMAP/PLAN文言が明示的に要求する「省略時のデフォルト補完」の範囲では正しく動作しており（テストで実証済み）、Phase 15のGate基準を満たすが、Phase 17でのLLM実出力統合時に頻発するリスクがある。Phase 17は OPS-04 fail-soft 設計（キュレーション失敗時も他3レポートは継続）を持つため致命的な障害には繋がらないが、news-digest自体の可用性が不必要に下がる可能性がある。Phase 17着手前、またはPhase 16でのスキーマ利用開始前に、`.nullish().transform()` への置換を推奨する（BLOCKERではなくフォローアップ推奨事項として記録）。

---

_Verified: 2026-07-02T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
