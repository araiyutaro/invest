---
phase: 21-portfolio-websearch-research
reviewed: 2026-07-03T09:40:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .claude/commands/invest.md
  - src/meeting/schemas.test.ts
  - src/meeting/schemas.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/validate-portfolio-research.ts
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-03T09:40:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 21（保有銘柄WebSearchリサーチ）の5ファイルをレビューした。テストは 72/72 パス（vitest 実行で確認）。schemas.ts の alias-transform 硬化と generate-report.test.ts の隔離テストは概ね堅実で、Step 3-P のプロンプトにはプロンプトインジェクション対策・エンティティ確認指示（Pitfall 5 対応）も含まれている。

一方で、フェーズ検証の要である `validate-portfolio-research.ts` に **12ファイル契約を検証しない偽陽性パス**（Critical）があるほか、ファイル名とticker の突合欠落、invest.md の FAIL マーカー例のリテラル記載、フォールバックJSONのプレースホルダ曖昧性、既存の「Step 3c へジャンプ」指示と Step 3-P の「必ず実行」原則の矛盾（Step 3d スキップ）など、契約の穴が複数見つかった。

なお `tmp/portfolio-research/` の消費側が存在しない点は 21-CONTEXT.md で Phase 22 の領域と明示されており（本フェーズは書き込み側のみ）、欠陥とは扱わない。

## Critical Issues

### CR-01: validate-portfolio-research.ts が空ディレクトリ・ファイル不足でも「成功」で終了する（偽陽性検証）

**File:** `src/scripts/validate-portfolio-research.ts:9-29`
**Issue:** D-12 の契約（21-CONTEXT.md）では本スクリプトは「保存された **12ファイル** のスキーマ適合確認」に使用される。しかし現実装はディレクトリ内に存在する `*.json` だけを検査し、件数を一切検証しない。Step 3-P が完全に失敗して 0 ファイルの場合でも `Validation complete: 0/0 passed` を出力して **exit 0** で終了する。フェーズ検証ツールとして、契約が全く満たされていない状態を「合格」と報告するのは不正な挙動であり、リサーチ全滅を検知できない。Step 3-P は「失敗銘柄も含め12銘柄全てのファイルを必ず書く」フェイルソフト契約なので、12ファイル存在は常に期待できる。
**Fix:**
```typescript
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const expected = PORTFOLIO_HOLDINGS.map((h) => `${h.symbol.replaceAll("/", "-")}.json`);
const missing = expected.filter((f) => !files.includes(f));
for (const f of missing) {
  failed += 1;
  console.log(`  FAIL: ${f.replace(/\.json$/, "")} — ファイルが存在しません`);
}
console.log(`Validation complete: ${expected.length - failed}/${expected.length} passed`);
```

## Warnings

### WR-01: ファイル名の symbol と JSON 内の ticker の一致を検証していない

**File:** `src/scripts/validate-portfolio-research.ts:13-18`
**Issue:** `symbol` をファイル名から導出しているが、`webSearchResultSchema.parse` の結果 `data.ticker` と突合していない。Pitfall 5（EE/NXT のエンティティ衝突）が本フェーズの明示的な懸念事項であるにもかかわらず、エージェントが別銘柄の ticker を出力したファイルや、プレースホルダ `"ticker": "..."` のままのフォールバックファイル（WR-04 参照）がスキーマ検証を素通りする。Phase 22 のローダーが ticker フィールドで銘柄照合する場合に壊れる。
**Fix:**
```typescript
const parsed = webSearchResultSchema.parse(data);
if (parsed.ticker !== symbol) {
  throw new Error(`ticker不一致: ファイル=${symbol}, JSON=${parsed.ticker}`);
}
```

### WR-02: import 時の無条件トップレベル実行 + export 混在（ガードなし・テスト不能）

**File:** `src/scripts/validate-portfolio-research.ts:8,32-35`
**Issue:** `validate` を export しながら、モジュール末尾で `validate().catch(...)` を無条件実行している。テストや他モジュールが `validate` を import した瞬間に実ファイルシステムの読み取りと `process.exit(1)` が発生しうる。結果として本スクリプトにはユニットテストが1件も存在しない（プロジェクト規約は TDD・カバレッジ80%）。また exported 関数内部の `process.exit(1)` はライブラリ関数としての再利用を不可能にする。
**Fix:** エントリポイントガードを追加し、`validate()` は失敗数を返す純粋な関数にする:
```typescript
export async function validate(): Promise<number> { /* ... return failed; */ }

if (process.argv[1] && import.meta.filename === (await import("node:path")).resolve(process.argv[1])) {
  const failed = await validate();
  if (failed > 0) process.exit(1);
}
```
（もしくは Node 24 の `import.meta.main` を使用）

### WR-03: FAIL マーカーの bash ブロックにリテラルの例示データが埋め込まれている

**File:** `.claude/commands/invest.md:1381-1384`
**Issue:** 他ステップの FAIL マーカー（data-collection, round-1, news-digest 等）はそのまま echo すべき固定文言だが、Step 3-P だけは `echo '[STEP:portfolio-research:FAIL:3/12銘柄失敗（EE, NXT, 5576.T）]'` という **例示値入りのコピペ可能な bash ブロック**になっている。実行役の LLM が別の銘柄が失敗した日にこのブロックを逐語実行すると、虚偽の失敗銘柄リストがパイプラインテレメトリに記録される。マーカー語彙の一貫性（固定文言 vs 動的構築）が崩れている。
**Fix:** プレースホルダ形式に変更し、代入を明示する:
```bash
echo '[STEP:portfolio-research:FAIL:{N}/12銘柄失敗（{失敗ティッカーをカンマ区切りで列挙}）]'
```
の直前に「`{N}` と `{失敗ティッカー}` を実際の値に置き換えて実行すること」と明記する。

### WR-04: フォールバックJSONの `"ticker": "..."` / `"researchedAt": "..."` に実値代入の指示がない

**File:** `.claude/commands/invest.md:1371-1374`
**Issue:** フォールバックJSONのテンプレートが `{"ticker": "...", ..., "researchedAt": "..."}` となっているが、`"..."` を該当銘柄の symbol と現在時刻に置き換えよという明示指示がない。逐語的に保存された場合、`ticker: "..."` はスキーマ（`z.string()`）を通過してしまい（schemas.test.ts のフォールバック形状テストも ticker="EE" 前提で、この退化ケースを覆っていない）、Phase 22 での銘柄照合とレポート表示が破綻する。WR-01 の検証欠落と組み合わさると誰もこれを検知できない。
**Fix:** テンプレート直後に「`ticker` には該当銘柄の symbol、`researchedAt` には現在の ISO8601 タイムスタンプを設定すること」を追記する。

### WR-05: highlightedStocks 0件時の「Step 3c へジャンプ」が Step 3d を飛ばす

**File:** `.claude/commands/invest.md:1404`
**Issue:** ドキュメントのセクション順は 3-P → 3a → 3b → **3d（ポートフォリオ分析・ニュースキュレーション）** → 3c（HTMLレポート生成）→ 3e。0件時に「Step 3c へジャンプ」すると、highlightedStocks に依存しない Step 3d までスキップされ、portfolio-analysis.json / news-curation.json が生成されず、ポートフォリオレポートとニュースダイジェストがフォールバック表示に退化する。Step 3-P が「注目銘柄0件の日でも必ず実行」と明記した本フェーズの設計原則（0件の日もポートフォリオ系成果物は維持する）と矛盾する。※文言自体は既存だが、Phase 21 がこの直前に Step 3-P を挿入しており、0件パスの整合性は本フェーズのスコープ（ディレクトリ隔離・fail-soft契約）に直結する。
**Fix:** ジャンプ先を「Step 3d」に変更する（スキップ対象は 3a/3b のみであることを明記）: 「`highlightedStocks` 配列が0件の場合は『注目銘柄が0件のためWebSearchリサーチをスキップします。』と表示し、Step 3a/3b を飛ばして Step 3d へ進んでください。」

### WR-06: keyArticles の内側スキーマが必須フィールドのままで、1記事の欠落が銘柄全体の検証失敗になる

**File:** `src/meeting/schemas.ts:127-132`
**Issue:** D-12 の alias-transform 硬化はトップレベルフィールドのみに適用され、`keyArticles` の要素は `z.object({ title: z.string(), summary: z.string() })` で両フィールド必須のまま。エージェントが記事1件を `{"title": "...", "url": "..."}`（summary 欠落）や `{"headline": ...}` で出力すると、その1記事のために **ファイル全体の parse が throw** し、当該銘柄のリサーチ結果が丸ごと FAIL になる。12並列でプロンプト表面積が12倍という Pitfall 8 の前提に対し、フェイルソフト性が中途半端。
**Fix:**
```typescript
keyArticles: z
  .array(z.object({
    title: z.string().optional().default(""),
    summary: z.string().optional().default(""),
  }))
  .optional(),
```
（あるいは transform 内で不正要素のみ filter して console.warn）

### WR-07: Test 39 の隔離保証が readdir のみで、readFile 経由の参照を検出できない

**File:** `src/scripts/generate-report.test.ts:601-620`
**Issue:** テスト名は「portfolio-research/ を**一切参照しない**」だが、アサーションは `readdir` にしか掛かっていない。現行ローダーは readdir でディレクトリ列挙してから readFile する実装なので今は成立するが、将来 `readFile(join(TMP_DIR, "portfolio-research", ...))` と直接読む退行が起きても本テストは通ってしまい、構造的隔離（PORT-02）の保証が名前倒れになる。readFile モックは既に存在するため追加コストは1行。
**Fix:**
```typescript
const readFileMock = fsMock.readFile as ReturnType<typeof vi.fn>;
for (const call of readFileMock.mock.calls) {
  expect(String(call[0])).not.toContain("portfolio-research");
}
```

## Info

### IN-01: エイリアス優先順位がフィールド定義コメントの並び順と逆

**File:** `src/meeting/schemas.ts:121-123,142`
**Issue:** スキーマ定義では `findings`（122行目）が `positives`（123行目）より先に列挙されているが、transform の解決順は `positiveFindings ?? positives ?? findings`。`findings` と `positives` が同時に存在する入力での勝敗がテストされておらず、コメントからも読み取れない。
**Fix:** 優先順位をコメントに明記し（`// 解決順: positiveFindings > positives > findings`）、両方併存時のテストを1件追加する。

### IN-02: `date` エイリアスは汎用キー名で誤マッピングのリスクがある

**File:** `src/meeting/schemas.ts:135,145`
**Issue:** エージェントが「レポート対象日」の意味で `date` フィールドを出力した場合（meetingResult 等では date=対象日の慣習がある）、それが `researchedAt` に流用される。実害は表示上の軽微なズレに留まるが、エイリアスとしてはやや攻めた選択。
**Fix:** 現状維持でも可。挙動として意図的であることをコメントに明記する。

### IN-03: 「3-report output」describe の afterEach restoreAllMocks がモジュールモック実装を剥がす脆い構造

**File:** `src/scripts/generate-report.test.ts:11,482-484`
**Issue:** `afterEach(() => vi.restoreAllMocks())` は module factory 内の `vi.fn()` の実装（writeFile/mkdir の `mockResolvedValue`）と 11行目の `process.exit` spy まで復元する。2件目以降のテストでは writeFile が undefined を返し（`await undefined` で偶然成立）、process.exit は本物に戻る。新規追加の Test 39 もこの偶然の成立に依存しており、main() がエラー経路に入るとテストプロセスごと落ちる。
**Fix:** `vi.restoreAllMocks()` を `vi.clearAllMocks()` に変更し、beforeEach で必要な実装を再設定する。

### IN-04: validate-portfolio-research.ts が Step 3-P から呼ばれていない

**File:** `src/scripts/validate-portfolio-research.ts` / `.claude/commands/invest.md:1367-1379`
**Issue:** 21-CONTEXT.md（D-12）ではフェーズ検証用途と明示されているため設計どおりだが、Step 3-P の12ファイル保存直後に `npx tsx src/scripts/validate-portfolio-research.ts` を1回実行すれば（fail-soft なので終了コードは無視）、日次運用でもスキーマ逸脱を即日検知できる。Step 2g（validate-meeting.ts）と同じパターンで安価に配線可能。
**Fix:** Step 3-P の保存処理後に検証コマンドの実行を追記する（終了コード非0でも続行、と明記）。

---

_Reviewed: 2026-07-03T09:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
