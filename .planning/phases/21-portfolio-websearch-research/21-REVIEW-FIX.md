---
phase: 21-portfolio-websearch-research
fixed_at: 2026-07-03T09:50:09Z
review_path: .planning/phases/21-portfolio-websearch-research/21-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-07-03T09:50:09Z
**Source review:** .planning/phases/21-portfolio-websearch-research/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (Critical 1 + Warning 7)
- Fixed: 8
- Skipped: 0

テスト結果: **252/252 パス**（ベースライン 239 + 新規 13）。`npx tsc --noEmit` で修正ファイルに新規型エラーなし（collect-data.test.ts の TS7006 は既存のもの）。

Phase 21 のロック済み決定事項は全て維持: WebSearchResult 形状不変（D-09）、tmp/portfolio-research/ 隔離（D-10）、12ファイル必須書き込み+フォールバックJSON（D-11）、マーカー語彙 START/OK/FAIL のみ（D-13/D-14）。

## Fixed Issues

### CR-01: validate-portfolio-research.ts が空ディレクトリ・ファイル不足でも「成功」で終了する

**Files modified:** `src/scripts/validate-portfolio-research.ts`
**Commit:** 6eb3c33
**Applied fix:** ディレクトリ内の実在ファイルではなく `PORTFOLIO_HOLDINGS` 由来の期待12ファイルリスト（`/`→`-` 置換規約適用）を検査対象に変更。欠落ファイルは `FAIL: {symbol} — ファイルが存在しません` として失敗カウントし、集計の分母も `expected.length`（=12）に固定。リサーチ全滅（0ファイル）は 12/12 FAIL として検知される。挙動は WR-02 コミットで追加したユニットテスト（空ディレクトリ→failed=12、1ファイル欠落→failed=1）で検証済み。

### WR-01: ファイル名の symbol と JSON 内の ticker の一致を検証していない

**Files modified:** `src/scripts/validate-portfolio-research.ts`
**Commit:** 87447b0
**Applied fix:** `webSearchResultSchema.parse` の結果 `parsed.ticker` をファイル名由来の symbol と突合し、不一致は `ticker不一致: ファイル={symbol}, JSON={ticker}` エラーとして FAIL 扱いに。ファイル名規約（`/`→`-` 置換）に合わせ `parsed.ticker.replaceAll("/", "-")` で正規化してから比較（将来 `BRK/B` 型の symbol が追加されても偽陽性にならない）。プレースホルダ `"ticker": "..."` のフォールバック退化ケース（WR-04 関連）もこの突合で検知される。テストで検証済み。

### WR-02: import 時の無条件トップレベル実行 + export 混在（ガードなし・テスト不能）

**Files modified:** `src/scripts/validate-portfolio-research.ts`, `src/scripts/validate-portfolio-research.test.ts`（新規）
**Commit:** e8a9748
**Applied fix:**
- `validate(dir: string = PORTFOLIO_RESEARCH_DIR): Promise<number>` に変更し、`process.exit` を関数から除去して失敗件数を返す純粋なライブラリ関数化。`dir` 引数でテスト用ディレクトリ差し替えに対応。
- CLI エントリガードはレビュー提案の `import.meta.filename` 式ではなく、プロジェクト既存パターン（`generate-report.ts:129` / `update-index.ts:259` と同一の `process.argv[1] === fileURLToPath(import.meta.url)`）に適応して統一。exit code 1（failed > 0 または readdir 失敗）は CLI 境界でのみ発生。
- ユニットテスト8件を新規追加（実FS + 一時ディレクトリ使用）: 12ファイル有効→0 / 空ディレクトリ→12 / 1ファイル欠落→1 / ticker不一致→1 / プレースホルダticker→1 / 無効JSON→1 / `.T` サフィックス突合 / ディレクトリ不存在→reject。

**Note:** レビューが指摘した「本スクリプトにテストが1件も存在しない」状態はこのコミットで解消。CR-01/WR-01 の挙動検証テストも本コミットに含まれる（ガード追加前は import 時に実行副作用があり test-first が不可能だったため）。

### WR-03: FAIL マーカーの bash ブロックにリテラルの例示データが埋め込まれている

**Files modified:** `.claude/commands/invest.md`
**Commit:** f60246f
**Applied fix:** bash ブロックを `echo '[STEP:portfolio-research:FAIL:{N}/12銘柄失敗（{失敗ティッカー}）]'` のプレースホルダ形式に変更し、直前の指示文で「`{N}` = 失敗銘柄数、`{失敗ティッカー}` = 実際に失敗したティッカーをカンマ区切りで列挙。このブロックをそのままコピペ実行してはいけません」と代入を明示。マーカー語彙は FAIL のまま（D-13/D-14 維持）。

### WR-04: フォールバックJSONの `"ticker": "..."` / `"researchedAt": "..."` に実値代入の指示がない

**Files modified:** `.claude/commands/invest.md`
**Commit:** aa086b8
**Applied fix:** フォールバックJSONテンプレート直後に「`ticker` には該当銘柄の symbol（`.T` サフィックスもそのまま）、`researchedAt` には現在時刻の ISO8601 タイムスタンプを設定すること。`"..."` のまま保存してはいけません」を追記。逐語保存された場合の検知網は WR-01 の ticker 突合（validate 側）が担う。

### WR-05: highlightedStocks 0件時の「Step 3c へジャンプ」が Step 3d を飛ばす

**Files modified:** `.claude/commands/invest.md`
**Commit:** 268a547
**Applied fix:** 実際のドキュメント順序を検証した上で修正（確認結果: 3-P(L1267) → 3a(L1408) → 3b(L1472) → **3d(L1681)** → 3c(L1866) → 3e(L1937)。レビューの前提通り 3c ジャンプは 3d をスキップする）。ジャンプ先を「Step 3a/3b のみを飛ばして Step 3d へ進む」に変更し、Step 3d のポートフォリオ分析・ニュースキュレーションと Step 3c/3e は 0件の日でも必ず実行することを明記。

### WR-06: keyArticles の内側スキーマが必須フィールドのままで、1記事の欠落が銘柄全体の検証失敗になる

**Files modified:** `src/meeting/schemas.ts`, `src/meeting/schemas.test.ts`
**Commit:** 159c12a
**Applied fix:** `keyArticles` / `articles`（エイリアス）を `lenientKeyArticlesSchema`（`z.array(z.unknown()).optional().transform(...)`）に変更。記事単位のフェイルソフト:
- `title` / `summary` の欠落・非文字列 → `""` に補完（レビュー第一案の optional/default より広く、`summary: 123` 等の型不正もカバー）
- オブジェクトでない要素（文字列・null・数値・配列） → throw せず除外
- 出力形状は `{title, summary}[]` のまま不変（D-09 維持）。`keyArticles ?? articles ?? []` のエイリアス解決順も不変（transform は undefined を透過）。
- テスト5件を追加（summary欠落補完 / 発明キー headline / 非オブジェクト要素除外 / 型不正補完 / articles エイリアス適用）。既存の webSearchResultSchema テスト・フォールバック形状テストは全て無変更でパス。

### WR-07: Test 39 の隔離保証が readdir のみで、readFile 経由の参照を検出できない

**Files modified:** `src/scripts/generate-report.test.ts`
**Commit:** bb0cd7b
**Applied fix:** Test 39 に readFile モックの全呼び出しを走査するアサーションを追加し、`portfolio-research` を含むパスの直接 readFile も退行として検出可能に。レビュー提案どおりの実装。

---

## Verification

- `npm test`: 252/252 パス（16 test files）
- `npx tsc --noEmit`: 修正ファイル起因の新規エラーなし
- Info findings（IN-01〜IN-04）は fix_scope=critical_warning のため対象外（未着手）

_Fixed: 2026-07-03T09:50:09Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
