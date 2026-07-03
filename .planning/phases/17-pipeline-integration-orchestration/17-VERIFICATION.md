---
phase: 17-pipeline-integration-orchestration
verified: 2026-07-03T09:45:00Z
status: passed
score: 4/4 must-haves verified (roadmap success criteria); 14/14 plan-level truths verified
overrides_applied: 0
---

# Phase 17: Pipeline Integration & Orchestration Verification Report

**Phase Goal:** news-digest.htmlが日次パイプライン（`/invest`）の実行により自動生成され、キュレーションステップの失敗が既存3レポートの生成・デプロイを妨げない
**Verified:** 2026-07-03T09:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/invest`実行後、`docs/YYYY-MM-DD/`に`news-digest.html`が4紙目として生成される | ✓ VERIFIED | `docs/2026-07-03/news-digest.html`（14KB、206行）が実在。commit `286806e`（`report: 2026-07-03 daily update`）に他3レポートと共に含まれ、`origin/master`へpush済み（`git log origin/master -1` が同commitを指す）。HTML内に14件の記事`<h4>`が実データ（Reuters/CNBC/日経/finnhub等の実URL）で描画されている |
| 2 | キュレーションAgentが`tmp/news.json`（フィルタ済み20〜80件）を読み`tmp/news-curation.json`をID参照方式で書き出す | ✓ VERIFIED | `tmp/news.json`は80件（`id/title/summary/source/url/publishedAt/category`）。`tmp/news-curation.json`は15件のarticlesを含み、各要素は`id/market/importance/commentary/tickers/tickerNames`のみで`title/url`を含まない（ID参照方式）。invest.md Step 3d prompt が「title/url/source/publishedAtは出力しないこと」を明記し、`write-news-digest.ts`が`resolveNewsCuration`でpoolから解決 |
| 3 | キュレーションを意図的に失敗させても他3レポートは正常生成・デプロイされる | ✓ VERIFIED | SUMMARY記載のライブ実証: 初回`write-news-digest.ts`実行がバグ（数値ticker混入）でexit=1、`[STEP:news-digest:FAIL:...]`出力、フォールバックHTML書き出し、`[PIPELINE:FAIL]`は出ず他3レポート生成・デプロイは継続。単体テストでも同義のENOENT/不正enumシナリオが green（`write-news-digest.test.ts` Test2/Test3） |
| 4 | 失敗時`[STEP:news-digest:FAIL:...]`、成功時`[STEP:news-digest:OK]`がログに記録される | ✓ VERIFIED | `invest.md` 1805-1817行に両マーカーの出し分けロジックが存在し、`[PIPELINE:FAIL]`を出さない旨が明記されている。ライブ実行で両状態（FAIL→修正後OK）が実証済み |

**Score:** 4/4 truths verified

### Plan-Level Must-Haves (17-01, 17-02 frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | 正常系: news-digest.htmlが書き出される | ✓ VERIFIED | `write-news-digest.test.ts` Test1 green。ライブ実行でも`docs/2026-07-03/news-digest.html`に14記事が描画 |
| 6 | D-08: news-curation.json欠損（ENOENT）でもフォールバックHTMLを書き出しexit 1 | ✓ VERIFIED | `write-news-digest.ts` 20-36行のtry/catch構造。Test2 green。ライブでも実証（バグ時にフォールバック生成＋exit=1） |
| 7 | D-08: news-curation.json不正（enum違反）でもフォールバックHTMLを書き出しexit 1 | ✓ VERIFIED | `validateRawNewsCuration`のthrowをcatchしフォールバック書き出し。Test3 green |
| 8 | D-10: 検証・描画・書き出しは専用CLI（write-news-digest.ts）に集約、generate-report.tsは無改修 | ✓ VERIFIED | `write-news-digest.ts`はPhase15/16関数(`validateRawNewsCuration`/`resolveNewsCuration`/`generateNewsDigestHtml`)を呼ぶのみで独自ロジックなし。`generate-report.ts`側にnews-digest関連の変更なし（Step 3c起動コマンド行1731、無改変） |
| 9 | D-01: Step 3dがportfolio-analystとnews-curatorを1メッセージで2体並列起動 | ✓ VERIFIED | invest.md 1565行「以下2つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください」+ Agent1/Agent2ブロック |
| 10 | D-02: news-curatorのモデルはopus | ✓ VERIFIED | invest.md 1637行 `model: opus` |
| 11 | D-03: URL以外の全フィールドをプロンプトに渡しID参照方式を徹底 | ✓ VERIFIED | invest.md 1643行「id, title, summary, source, publishedAt, ticker の6フィールドのみ」+ 1662行「title/url/source/publishedAtは出力しないこと」。実データ（tmp/news-curation.json）でも遵守を確認 |
| 12 | D-04〜D-06: 市場分類例示・優先度・英語社名ルールがプロンプトに明記 | ✓ VERIFIED | invest.md 1650-1657行に該当記述あり |
| 13 | D-07: 不正JSON時は1回リトライ後ファイル未作成で続行 | ✓ VERIFIED | invest.md 1694行「tmp/news-curation.json を作成しない」を含むリトライ文言 |
| 14 | D-09: Step 3eがexit codeに応じてSTEPマーカーを出し分け、run.shは無改修 | ✓ VERIFIED | invest.md 1805-1817行。`run.sh`への変更はkey-files一覧・git diffともになし |
| 15 | D-11: pipeline-metrics.jsonとタイミング表にnews-digest計測行が追加 | ✓ VERIFIED | invest.md 1794/1828行に`newsDigestStart`/`newsDigestEnd`、2001行のタイミング表に「ニュースダイジェスト」行。ライブ実行の`tmp/pipeline-metrics.json`に両キー実在（1783038054669 / 1783038055265） |

**Score (plan-level):** 11/11 verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/scripts/write-news-digest.ts` | fail-soft CLIオーケストレーター、`main()`をexport | ✓ VERIFIED | 45行。`export async function main`あり。`validateRawNewsCuration`/`resolveNewsCuration`/`generateNewsDigestHtml`を計3回呼び出し。catch内に`generateNewsDigestHtml(null,...)`と`process.exit(1)`両方あり。`fileURLToPath(import.meta.url)`エントリポイントガードあり |
| `src/scripts/write-news-digest.test.ts` | 正常/欠損/不正の3シナリオ | ✓ VERIFIED | `it(`が3件、全て`news-digest.html`アサーションを含む |
| `.claude/commands/invest.md` | news-curator Agent + Step 3e + STEPマーカー + metrics | ✓ VERIFIED | grep検証全通過（news-curator, 2つのAgent並列ヘッダ, Step 3e見出し, STEPマーカー2種, newsDigestStart/End） |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| write-news-digest.ts | src/meeting/schemas.ts | validateRawNewsCuration + resolveNewsCuration | ✓ WIRED | import文（4行目）+ 呼び出し（22, 25行目） |
| write-news-digest.ts | generate-news-digest.ts | generateNewsDigestHtml | ✓ WIRED | import文（6行目）+ 呼び出し（正常系27行目、fallback32行目） |
| invest.md Step 3d | tmp/news-curation.json | news-curator出力の保存 | ✓ WIRED | 1690行「保存」バレット。ライブ実行で実ファイル生成確認済み |
| invest.md Step 3e | write-news-digest.ts | npx tsxによる別プロセス起動 | ✓ WIRED | 1802行 `npx tsx src/scripts/write-news-digest.ts`。generate-report.tsのPromise.allとは別プロセス（プロセス境界分離、D-10充足） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| news-digest.html (docs/2026-07-03) | curation.articles | tmp/news-curation.json (news-curator opus出力) → resolveNewsCuration → tmp/news.json (Finnhub/Google News RSS実データ) | Yes | ✓ FLOWING — 14記事が実URL(Reuters/CNBC/日経/finnhub等)・実出典で描画。ハードコード/空配列なし |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 全テストスイート回帰なし | `npx vitest run` | 183/183 green（13ファイル） | ✓ PASS |
| write-news-digest単体テスト | `npx vitest run src/scripts/write-news-digest.test.ts` | 3/3 green | ✓ PASS |
| 型検査（対象ファイル） | `npx tsc --noEmit` | write-news-digest.ts/test.tsに型エラー0（既存無関係エラー4件は5443c42でOut-of-Scope記録済み、本フェーズ以前から存在） | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — 本フェーズに`scripts/*/tests/probe-*.sh`形式のプローブは存在せず、PLAN/SUMMARYもプローブ方式を宣言していない（vitest単体テスト + ライブ`/invest`実行によるhuman-verifyで検証済み）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CURA-01 | 17-01, 17-02 | ニュースキュレーションHTML（news-digest.html）が4紙目のレポートとしてdocs/YYYY-MM-DD/に生成される | ✓ SATISFIED | docs/2026-07-03/news-digest.html実在・デプロイ済み（commit 286806e） |
| OPS-04 | 17-01, 17-02 | キュレーションステップの失敗時も既存3レポートの生成・デプロイが継続する（fail-soft設計、独自STEPマーカーによる失敗可視化） | ✓ SATISFIED | ライブ実証: 初回exit=1でも他3レポート生成・デプロイ継続、[STEP:news-digest:FAIL]記録、[PIPELINE:FAIL]非出力 |

REQUIREMENTS.md側でも両IDが「Complete」と記録済み（11行目、28行目、55行目、66行目）。両IDともPhase 17の2プランにのみマッピングされており、orphaned requirementsなし。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/scripts/write-news-digest.ts:14-18 | - | date取得・mkdirがtry外（コードレビューWR-06/CR-02指摘）— meeting-result.json自体が欠損/不正な場合はD-08の「フォールバックは常に書かれる」不変条件が破れ、date検証もローカルでは行われない | ⚠️ Warning | Phase 17の明示的must-have（news-curation.json欠損/不正時のフォールバック）は充足済み。但しmeeting-result.json側の異常系・date形式のローカル再検証は未実装（脅威モデルT-17-03は「上流を信頼する」設計判断だが、上流のStep 2gにfail-hardハンドリングの欠落（CR-01）があるため防御が実質的でない、とコードレビューが指摘）。次フェーズ着手前にセキュリティ観点での対応検討を推奨 |

コードレビュー（17-REVIEW.md, status: issues_found）はCritical 2件（CR-01: Step 2gバリデーション失敗時のパイプライン停止ハンドリング欠落、CR-02: write-news-digest.tsのdateパストラバーサル未検証）を指摘している。これらはPhase 17のPLAN.md must_havesが明示的に要求した範囲（news-curation.jsonの欠損/不正ハンドリング）の外側にあるセキュリティ設計判断（脅威T-17-03のディスポジションが実質未達）であり、レビューゲートは助言的なため本検証のstatusはブロックしない。ただし人間の判断のためWARNINGとして記録する。

### Human Verification Required

なし。Task 3（checkpoint:human-verify）は既にライブ`/invest`実行で完了・approved済み（SUMMARY.md記載、docs/2026-07-03/news-digest.html・commit 286806eとして裏取り済み）。

### Gaps Summary

Blockerなし。Phase 17の4つのROADMAP成功基準、両plan（17-01/17-02）が宣言した15件のmust-have真実、CURA-01/OPS-04の2要件はすべてコードベース上の実証（静的解析＋テスト実行＋ライブ実行成果物の直接確認）で裏取りできた。

唯一の留意事項は、コードレビューで指摘されたCR-01/CR-02（date検証・Step 2g停止処理の欠落によるパストラバーサル理論上のリスク）。これはPhase 17のスコープ外（`write-news-digest.ts`のthreat modelはnews-curation.json/HTML本文のtamperingをmitigate対象とし、date自体のバリデーションは「上流に委譲」という設計判断だった）だが、上流のStep 2gに対応するfail-hardガードが欠落しているため、設計意図と実装の間にギャップがある。Phase 18着手前、または別途セキュリティ修正Issueとして起票することを推奨する。

---

*Verified: 2026-07-03T09:45:00Z*
*Verifier: Claude (gsd-verifier)*
