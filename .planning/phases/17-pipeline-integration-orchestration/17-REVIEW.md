---
phase: 17-pipeline-integration-orchestration
reviewed: 2026-07-03T00:32:02Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .claude/commands/invest.md
  - src/meeting/schemas.test.ts
  - src/meeting/schemas.ts
  - src/scripts/write-news-digest.test.ts
  - src/scripts/write-news-digest.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-03T00:32:02Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 17（パイプライン統合・オーケストレーション）の成果物5ファイルをレビューした。ニュースキュレーションの2層バリデーション（`validateRawNewsCuration` / `resolveNewsCuration`）自体はテスト網羅性が高く堅牢だが、**パイプライン全体のセキュリティ前提に穴がある**。`write-news-digest.ts` は「date は上流で検証済み」というコメント（T-17-03）を根拠にローカル検証を省略しているが、その上流である `invest.md` Step 2g のバリデーション失敗時のハンドリングが未定義であり、未検証の LLM 生成 `date` がファイルシステム書き込みパスに到達し得る。この2点の組み合わせがパストラバーサルの攻撃チェーンを構成する（Critical 2件）。

また、`invest.md` のオーケストレーション制御フローに、注目銘柄0件時にポートフォリオ分析・ニュースキュレーションがまるごとスキップされるジャンプ先誤り、デプロイ時に無関係なステージ済み変更を巻き込んでコミットする問題など、実運用で顕在化するバグが複数ある（Warning 6件）。

クロス参照として `src/scripts/validate-meeting.ts`（失敗時 exit 1 を確認）、`src/scripts/generate-news-digest.ts`（`null` 受理を確認）、`src/scripts/collect-data.ts`（`collectData.durationMs` の書き込み元を確認）、`src/meeting/types.ts`、`package.json`（zod ^4.3.6）を検証した。

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Step 2g バリデーション失敗時のハンドリングが未定義 — 未検証の meeting-result.json が下流に流出する

**File:** `.claude/commands/invest.md:1188-1226`
**Issue:** Step 2g は `npx tsx src/scripts/validate-meeting.ts` を実行するが、**失敗（非0終了）時にパイプラインを停止する指示が一切ない**。他のステップ（data-collection, round-1, report-generation, deploy）には明示的な `[STEP:...:FAIL]` + 停止指示があるのに、Step 2g だけ欠落している。`validate-meeting.ts` は失敗時に `process.exit(1)` するが、オーケストレーター（LLM）はそのままサマリー表示に進み、1226行目で無条件に `[STEP:round-3:OK]` を出力してしまう。

結果として、スキーマ違反の LLM 生成 `meeting-result.json`（例: `date` が `^\d{4}-\d{2}-\d{2}$` に一致しない値）が Step 3 以降（`generate-report.ts`、`write-news-digest.ts`、デプロイ）にそのまま流れる。デプロイステップは date を再検証している（1877行目）が、`write-news-digest.ts` は再検証しない（CR-02）。ニュース記事という外部の信頼できない入力がモデレーター LLM を経由して `date` に注入され得るため、これはセキュリティ境界の穴である。
**Fix:** Step 2g に他ステップと同型の失敗ハンドリングを追加する:
```markdown
`validate-meeting.ts` がエラーで終了した場合は、以下を実行してからパイプラインを停止してください:
```bash
echo '[STEP:round-3:FAIL:meeting-result.jsonのバリデーションに失敗]'
echo '[PIPELINE:FAIL] ステップ: round-3, エラー: meeting-result.jsonのバリデーションに失敗'
```
```
バリデーション成功を確認した後にのみ `[STEP:round-3:OK]` を出力すること。

### CR-02: write-news-digest.ts — LLM 生成の `date` を検証せずにファイルパスへ結合（パストラバーサル防御の欠落）

**File:** `src/scripts/write-news-digest.ts:14-17`
**Issue:** コメントは「date は上流で検証済みの meeting-result.json からのみ取得する（T-17-03: パストラバーサル対策）」と主張するが、**このスクリプト自身は何も検証していない**。`meeting-result.json` はモデレーター LLM の生出力であり、検証が保証されるのは Step 2g が成功した場合のみ。CR-01 のとおり Step 2g の失敗はパイプラインを停止しないうえ、本スクリプトは CLI エントリポイント（39-44行目）を持ち単体実行も可能（例: Step 2f と 2g の間で中断したパイプラインの手動再実行）。`date` に `../../..` を含む値が入れば `join(DOCS_DIR, date)` で `docs/` 外の任意ディレクトリに `news-digest.html` を書き込める。また `date` が `undefined` の場合は `join()` が TypeError を投げる（WR-06 参照）。「上流を信頼する」だけの防御は、防御と主張するコメントに対して実体がない。
**Fix:** パス結合前にローカルで検証する（deploy ステップと同じ規則）:
```typescript
const { date } = JSON.parse(meetingRaw) as { date?: unknown };
if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error(`不正なdate形式: ${String(date)}`);
}
```

## Warnings

### WR-01: Step 3.0 の「Step 3c へジャンプ」が Step 3d（ポートフォリオ分析＋ニュースキュレーション）をスキップする

**File:** `.claude/commands/invest.md:1265`
**Issue:** `highlightedStocks` が0件の場合「Step 3c へジャンプ」と指示しているが、文書上の実行順序は 3.0 → 3a → 3b → **3d** → 3c → 3e であり、3c へのジャンプは WebSearch（3a/3b）だけでなく **Step 3d のポートフォリオ分析と news-curator も丸ごとスキップ**する。Step 3d は `highlightedStocks` の件数に依存しない処理（保有12銘柄の評価、ニュースダイジェスト編集）であり、スキップする合理性がない。注目銘柄0件の日（ティッカー抽出0件は現実に起こり得る）には portfolio-report が劣化し、news-digest は必ずフォールバック＋exit 1 になる。あわせてステップ番号が 3d → 3c の順に並んでいること自体が混乱の温床（IN-02 と関連）。
**Fix:** ジャンプ先を「Step 3d」に修正する（「注目銘柄が0件のためWebSearchリサーチと再評価をスキップし、Step 3d へ進んでください」）。あわせてステップ番号を実行順（3c ↔ 3d）に振り直すことを推奨。

### WR-02: デプロイ処理が `git add docs/` 後に index 全体をコミット — 事前にステージ済みの無関係な変更を巻き込む

**File:** `.claude/commands/invest.md:1883-1900`
**Issue:** `execSync('git add docs/')` の後の `spawnSync('git', ['commit', '-m', commitMsg])` は **index にステージされている全変更**をコミットする。ユーザーや別プロセスが事前にステージした無関係なファイル（現にこのリポジトリには `.planning/` 配下の大量の削除がステージされている）が、日次レポートコミットとして GitHub Pages リポジトリに push されてしまう。意図しない公開・意図しないファイル削除の確定というデータ損失リスクがある。`git diff --staged --quiet` の変更検知も index 全体を見るため、docs/ に変更がなくても他のステージ済み変更でコミットが走る。
**Fix:** pathspec 付きコミットで docs/ に限定する:
```javascript
const commitResult = spawnSync('git', ['commit', '-m', commitMsg, '--', 'docs/'], { stdio: 'inherit' });
```
変更検知も `execSync('git diff --staged --quiet -- docs/')` に限定する。

### WR-03: ティッカー抽出の正規表現が誤検出だらけ — 除外リストが不完全

**File:** `.claude/commands/invest.md:455-461`
**Issue:** `\b([A-Z]{1,5})\b` で summary/highlights/sectorView の散文から2〜5文字の大文字語をすべてティッカーとして拾うが、除外リストに `FOMC`, `PCE`, `PPI`, `ECB`, `IMF`, `OPEC`, `EPS`, `ROE`, `PER`, `PBR`, `SEC`, `FDA`, `CEO`, `USD`, `JPY`, `EUR`, `REIT` 等の金融文書頻出語が含まれていない。誤検出された「ティッカー」は `moderator-tickers.json` 経由で Round 3 の全アナリストに10段階スコアリングさせられ、最悪 `highlightedStocks` として最終レポートに載る。また除外リスト内の `'MoS'` は小文字を含むため正規表現 `[A-Z]{1,5}` に絶対にマッチせず、死んだエントリである。
**Fix:** 除外リストに上記の頻出略語を追加する。より堅牢には、散文からの正規表現抽出をやめて `picks[].ticker` のみを信頼するか、抽出後に yahoo-finance2 での実在確認を挟む。

### WR-04: ポートフォリオ保有銘柄リストが invest.md 内に2箇所ハードコード — holdings.ts と乖離するドリフトリスク

**File:** `.claude/commands/invest.md:471, 1097`
**Issue:** 保有銘柄の除外リスト（`MRNA, JOBY, ... BWMX`）が Step 2b の JS コードと Step 2f のモデレータープロンプトの2箇所に直書きされている。信頼できる唯一の情報源は `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS`（Step 3d では実際にそちらを読んでいる）。保有銘柄を売買した際に invest.md の2箇所を更新し忘れると、「ポートフォリオと独立した分析」という不変条件が静かに壊れ、保有銘柄が highlightedStocks に混入する。
**Fix:** Step 2b の node スクリプトで `holdings.ts` から動的に読む（例: `npx tsx -e` で `PORTFOLIO_HOLDINGS` を import して symbol 一覧を取得）か、少なくとも Step 2.0 で holdings.ts を読み込んで両箇所に展開する指示に変更する。

### WR-05: tickers/tickerNames の厳格な型検証により、LLM が数値 ticker を1つでもエコーするとダイジェスト全体がフォールバックする

**File:** `src/meeting/schemas.ts:207-208`
**Issue:** 第1層スキーマの `tickers: z.array(z.string())` と `tickerNames: z.record(z.string(), z.string())` は要素が1つでも非文字列だと `validateRawNewsCuration` 全体が throw し、`write-news-digest.ts` の catch でダイジェスト全体がフォールバック＋exit 1 になる。ところが news-curator のプロンプト（invest.md:1643）は `tmp/news.json` の `ticker` フィールドをそのまま埋め込んでおり、finnhub 由来の merger/business 記事では ticker が数値（0〜9）であることが既にライブ検証で判明している（schemas.test.ts:235-258 のコメント参照）。LLM が見たままの数値をエコーバックする事態は十分現実的で、その場合「記事1件の tickers を捨てる」で済むはずの劣化が「4紙目全損」に増幅される。プール側（`source.ticker`）は `typeof === "string"` でガード済みなのに、LLM 側の同一データ形状にはガードがなく非対称。
**Fix:** グレースフルデグラデーションの設計（D-09）に合わせ、非文字列要素をドロップする前処理を入れる:
```typescript
tickers: z
  .array(z.unknown())
  .optional()
  .default([])
  .transform((arr) => arr.filter((t): t is string => typeof t === "string")),
```
`tickerNames` も同様に非文字列値のエントリを除去する transform を推奨。

### WR-06: write-news-digest.ts — date 取得・mkdir が try 外にあり、D-08 の「フォールバックHTMLは常に書かれる」不変条件が破れる

**File:** `src/scripts/write-news-digest.ts:14-18, 30-36`
**Issue:** catch 節のコメントは「D-08: 失敗時もフォールバックHTMLを必ず書き出す(ファイルは常に存在)」と主張するが、`meeting-result.json` の読み込み・`JSON.parse`・`date` の分割代入・`mkdir` は try ブロックの**外**にある。`meeting-result.json` が欠落／JSON 不正／`date` フィールド欠落（`join(DOCS_DIR, undefined)` は TypeError）の場合、main() はフォールバックを書かずに reject し、CLI ハンドラで exit 1 する。その日の `docs/{date}/news-digest.html` は存在せず、index からのリンクが 404 になり得る。テスト（write-news-digest.test.ts）もこの経路（meeting-result 欠落・date 欠落）を一切カバーしていない。
**Fix:** CR-02 の date 検証と合わせて、date が確定できないケースの方針を明示する（例: date 取得失敗時は当日日付 `new Date().toISOString().slice(0, 10)` でフォールバックHTMLを書いて exit 1）。少なくとも実装と乖離したコメント「ファイルは常に存在」を実態に合わせて修正すること。テストに meeting-result 欠落ケースを追加する。

## Info

### IN-01: デプロイスクリプトの `hasChanges` は代入されるが未使用（デッドコード）

**File:** `.claude/commands/invest.md:1887, 1894`
**Issue:** `let hasChanges = false;` と `hasChanges = true;` は以降どこからも参照されない。
**Fix:** 変数を削除し、catch 到達＝変更ありというフローをコメントで明示する。

### IN-02: `[STEP:round-3:OK/FAIL]` マーカーが Round 3 以外（モデレーター最終統合・バリデーション）まで担っており監視粒度が不正確

**File:** `.claude/commands/invest.md:1151, 1226`
**Issue:** モデレーター最終統合の失敗が `[STEP:round-3:FAIL:モデレーター最終統合に失敗]` として報告され、`[STEP:round-3:OK]` は Step 2g（バリデーション）完了後に出力される。ログ監視側から見ると Round 3 本体の成否と統合・検証の成否が区別できない。
**Fix:** `[STEP:moderator-final:*]` / `[STEP:validation:*]` 等の専用マーカーに分離する（監視側のパーサ更新とセットで）。

### IN-03: Round 2 品質チェックの閾値（400文字）がプロンプト要件（800〜1500文字）と不整合

**File:** `.claude/commands/invest.md:737`
**Issue:** discussion の必須要件は800文字以上だが、警告閾値は400文字未満。401〜799文字の要件未達出力が警告なしで通過する。
**Fix:** 閾値を800に合わせるか、意図的に緩い閾値なら理由を注記する。

### IN-04: picks 由来のティッカーが形式検証なしにファイルパス・Agent 名へ流入する

**File:** `.claude/commands/invest.md:445-448, 1288, 1322`
**Issue:** `pick.ticker` は `'UNKNOWN'` 除外と trim のみで、任意文字列が `tmp/websearch/{ticker}.json` のパスや Agent 名に使われる。`/` は `-` に置換されるためパストラバーサルは概ね塞がれているが、防御が置換1文字に依存しており脆い。
**Fix:** Step 2b の抽出時に `/^[A-Z0-9][A-Z0-9.\-]{0,9}$/` 程度のホワイトリスト検証を追加する。

### IN-05: resolveNewsCuration — プール内の重複 id は警告なしで後勝ちになる

**File:** `src/meeting/schemas.ts:249`
**Issue:** `new Map(pool.map((a) => [a.id, a]))` はプール（tmp/news.json）に同一 id が複数あった場合、黙って最後のエントリで解決する。上流の id 採番バグを隠蔽し得る。
**Fix:** Map 構築時に重複を検出して `console.warn` を出す（他の drop 系警告と同じ粒度）。

---

_Reviewed: 2026-07-03T00:32:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
