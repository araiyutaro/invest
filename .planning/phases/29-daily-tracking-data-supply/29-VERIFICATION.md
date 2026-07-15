---
phase: 29-daily-tracking-data-supply
verified: 2026-07-15T13:40:00Z
status: human_needed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "launchd 毎朝8時実行（または手動 `cd /Users/arai/invest && npx tsx src/scripts/collect-watchlist-data.ts` 実行）で、Step 2h 直後に Step 2i が実行され stderr に [STEP:watchlist-data:OK]（または :FAIL:<reason>）が出力されること"
    expected: "STEP マーカーが Step 2h の直後・Step 3 より前のタイミングで stderr に出力される"
    why_human: "静的解析ではプロセス実行時の実際の stderr 出力タイミングとオーケストレーター（LLM）による Bash 実行順序を確認できない"
  - test: "実行後、tmp/watchlist-technicals.json が {generatedAt, snapshots:[...]} 形状の有効JSON、tmp/watchlist-news.json がアクティブ銘柄キーを持つ有効JSON（HoldingNewsFile）で生成されること"
    expected: "両ファイルが実運用のウォッチリスト・Yahoo Finance・news.json の実データを入力に正しく生成される"
    why_human: "テストはモックデータでのロジック検証のみ。実際の Yahoo Finance API 応答・実運用の watchlist.json 内容での実行結果は実機でしか確認できない"
  - test: "Step 2i のログに [PIPELINE:FAIL] が出ていないこと、既存4レポート（daily/portfolio/meeting-minutes/news-digest）が通常どおり docs/{date}/ に生成・デプロイされること"
    expected: "Step 2i の成功・失敗にかかわらず既存4レポートの生成・デプロイパイプラインが継続する"
    why_human: "invest.md はオーケストレーターLLMが解釈して実行する自然言語スクリプトであり、実際に人間が実行ログを見て fail-soft 配線が意図通り機能したかを確認する必要がある（29-03 Task 2 は human-verify checkpoint、--auto チェーンで自動承認・HUMAN-UAT 追跡）"
---

# Phase 29: Daily Tracking Data Supply Verification Report

**Phase Goal:** ウォッチリストに登録された各銘柄について、当日の株価・テクニカル指標・関連ニュースが判定エージェントへ確実に供給され、1銘柄の取得失敗が他銘柄処理やパイプライン全体を止めない
**Verified:** 2026-07-15T13:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ウォッチリスト銘柄それぞれの当日株価・テクニカル指標が collect-technicals パターン（fetchTechnicalSnapshot 単数形 + buildSnapshot/computeSMA/computeRSI）を流用して日次収集される | VERIFIED | `src/scripts/collect-watchlist-data.ts:4,189` が `fetchTechnicalSnapshot`（`src/data/technicals.ts:138`、per-ticker try/catch で null 返却）を `fetchChunked` の atomic unit として注入。`fetchTechnicalSnapshots`（複数形・無制限並列、collect-technicals.ts が使用するパターン）への依存はゼロ（`grep -c 'fetchTechnicalSnapshots' collect-watchlist-data.ts` = 0）。技術指標計算ロジック自体（buildSnapshot/computeSMA/computeRSI）は technicals.ts の無改変流用 |
| 2 | ウォッチリスト銘柄それぞれの関連ニュースが tmp/news.json から holding-news パターン流用のTS側決定論マッチングで抽出される | VERIFIED | `collect-watchlist-data.ts:240-241` が `toPortfolioHoldingShape(activeEntries)` を `buildHoldingNewsMap`（`holding-news.ts`、Phase 29 で無改変・diff ゼロを git log で確認）へ渡し `tmp/watchlist-news.json` に書込。全アクティブ銘柄キー保証（D-18）をテストで確認（`-t "news"` 該当ケース pass） |
| 3 | 追跡データ収集は銘柄単位で fail-soft に実装されており、1銘柄のAPI取得失敗（レート制限含む）が他銘柄の処理やパイプライン全体の失敗につながらないことがテストで確認できる | VERIFIED | `fetchChunked`（`watchlist-data.ts:92-117`）が per-ticker try/catch で fetchOne の reject/null を吸収し omit（WR-07 修正済み — 修正前は reject で Promise.all 全体が reject する未修正バグがあったが commit fc171b5 で解消。回帰テストで実際に `throw` する fetchOne を使い他銘柄の snapshot 保持を確認）。CLI レベルでも技術・ニュース2ブランチが独立 try/catch（Pitfall 4）で片系失敗が他系を道連れにしない |
| 4 | 新パイプラインステップに専用 [STEP:*] マーカーがあり、失敗時も既存4レポートの生成・デプロイが継続する | VERIFIED（配線は構造的検証済み、実機動作は human_verification） | `collect-watchlist-data.ts` が `[STEP:watchlist-data:OK]` / `[STEP:watchlist-data:FAIL:corrupted]` / `[STEP:watchlist-data:FAIL:fatal]`（WR-04 修正で fatal 経路も追加）を自己出力。`[PIPELINE:FAIL]` の console 出力はゼロ（grep 検証）。invest.md Step 2i が Step 2h 直後・Step 3 より前に配線され（awk 順序確認: OK）、fail-soft 説明・フォールバック指示（WR-04 対応）が記載。実機（launchd/手動実行）での動作確認は Plan 03 Task 2 の human-verify checkpoint 対象で未実施（HUMAN-UAT として29-03-SUMMARY.mdに追跡） |

**Score:** 4/4 truths verified（0 present-behavior-unverified）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/watchlist-data.ts` | toPortfolioHoldingShape/mergeWithCache/chunk/fetchChunked + 名前付き定数 | VERIFIED | 117行、4関数すべて export 済み、CHUNK_SIZE=5/CHUNK_DELAY_MS=300 単一定義、TechnicalsCacheFile 型定義済み |
| `src/portfolio/watchlist-data.test.ts` | 純関数の単体テスト | VERIFIED | 24 tests 全 GREEN |
| `src/scripts/collect-watchlist-data.ts` | fail-soft CLI | VERIFIED | 266行、loadWatchlistDefensive/loadSameDayCache/writeEmptyOutputs/main() すべて実装済み。CR-01/WR-01〜07 全修正反映確認済み |
| `src/scripts/collect-watchlist-data.test.ts` | CLIレベルfail-softテスト | VERIFIED | 20 top-level tests（ネスト含め実質多数ケース）全 GREEN |
| `.claude/commands/invest.md` Step 2i | collect-watchlist-data.ts 実行の fail-soft 配線 | VERIFIED | Step 2h 直後・Step 3 直前に挿入、fatal フォールバック指示（WR-04）も記載済み |
| `tmp/watchlist-technicals.json` / `tmp/watchlist-news.json` | 実行時生成の下流供給契約 | PRESENT（構造は検証済み、実運用生成は human_verification） | writeFile 呼び出しコード・出力形状（{generatedAt,snapshots}/HoldingNewsFile）はテストで検証済み。実機での生成確認は未実施 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `toPortfolioHoldingShape` 出力 | `buildHoldingNewsMap`（holding-news.ts） | `collect-watchlist-data.ts:240-241` | WIRED | symbol/name/nameJa/sector 形状一致、holding-news.ts 無改変（git log 確認） |
| `fetchChunked` | `fetchTechnicalSnapshot`（単数形） | `collect-watchlist-data.ts:189` | WIRED | `fetchTechnicalSnapshots`（複数形）への依存ゼロを grep で確認 |
| テクニカルブランチ | ニュースブランチ | `collect-watchlist-data.ts:172-247` 独立try/catch | WIRED | news.json 欠損時もテクニカルブランチは独立して完走（テスト確認済み、D-20/Pitfall 4） |
| invest.md Step 2h（watchlist.json更新） | invest.md Step 2i（collect-watchlist-data.ts） | ステップ順序（awk判定） | WIRED | Step 2h < Step 2i < Step 3 の順序を awk で構造的に確認（OK） |
| collect-watchlist-data.ts 出力 | Phase 30（買いタイミング判定エージェント、未実装） | tmp/watchlist-technicals.json / tmp/watchlist-news.json | N/A（下流はPhase 30スコープ） | 出力契約の形状のみ本フェーズの検証範囲 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `mergedSnapshots`（テクニカル） | `hitSnapshots` + `fetchedSnapshots` | `loadSameDayCache` + `fetchChunked(fetchTechnicalSnapshot)` | Yes（CR-01修正後、activeSet基準でキャッシュ命中を正しくフィルタ） | FLOWING |
| `newsMap`（ニュース） | `buildHoldingNewsMap(articles, holdings)` | `readFile(NEWS_POOL_PATH)` → isValidPoolArticle filter → Date復元 | Yes（WR-06修正で不正要素を除外し正常記事を保持） | FLOWING |

CR-01修正前は `cachedTickers`（キャッシュ全symbol集合）でフィルタするトートロジーバグがあり、ウォッチリスト外銘柄が漏出する実質 `HOLLOW`（フィルタが機能しない）状態だったが、commit `4a72355` で `activeSet.has(s.symbol)` によるフィルタに修正され、回帰テスト2件（漏出防止・重複去重）で確認済み。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| watchlist-data.ts 純関数テスト全件 | `npx vitest run src/portfolio/watchlist-data.test.ts` | 24 tests pass | PASS |
| CLI レベル fail-soft テスト全件 | `npx vitest run src/scripts/collect-watchlist-data.test.ts` | 20 top-level tests pass（44合計 with nested） | PASS |
| プロジェクト全体回帰 | `npx vitest run`（1回のみ実行） | 528 tests pass（31 files） | PASS |
| tsc 型チェック（Phase 29 ファイル） | `npx tsc --noEmit` → grep watchlist-data/collect-watchlist | Phase 29 ファイルに関する出力なし（既存の無関係ファイル collect-data.test.ts のエラーのみ残存、Phase 29 スコープ外として SUMMARY に記録済み） | PASS |
| CR-01 回帰テスト存在確認 | `grep "CR-01" collect-watchlist-data.test.ts` | 2件ヒット（漏出防止・重複去重） | PASS |

### Probe Execution

該当なし（本フェーズに `scripts/*/tests/probe-*.sh` 形式の probe は存在しない。SKIPPED — no probe files declared or found）

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TRAC-01 | 29-01, 29-02, 29-03 | ウォッチリスト銘柄の当日株価・テクニカル指標が日次収集され判定エージェントに供給される（collect-technicals パターン流用） | SATISFIED | fetchTechnicalSnapshot 単数形 + チャンク化並列取得 + 同日キャッシュ再利用の実装・テスト確認済み |
| TRAC-02 | 29-01, 29-02, 29-03 | ウォッチリスト銘柄の関連ニュースが tmp/news.json からTS側決定論で抽出され判定エージェントに供給される（holding-news パターン流用） | SATISFIED | buildHoldingNewsMap 無改変流用、toPortfolioHoldingShape アダプタ実装・テスト確認済み |
| TRAC-03 | 29-01, 29-02 | 追跡データ収集は銘柄単位で fail-soft（1銘柄の取得失敗が他銘柄の処理やパイプライン全体を止めない、バッチ化でレート制限を考慮） | SATISFIED | fetchChunked の reject 耐性（WR-07修正後）・チャンク化（CHUNK_SIZE=5/CHUNK_DELAY_MS=300）をテストで確認 |
| OPS-06 | 29-02, 29-03 | ウォッチリスト関連の新パイプラインステップは fail-soft 設計（専用[STEP:*]マーカー、失敗時も既存4レポートの生成・デプロイが継続） | SATISFIED（実機動作は human_verification） | [STEP:watchlist-data:*] マーカー実装・[PIPELINE:FAIL]非出力・invest.md配線を構造的に確認。実機での「既存4レポート継続」確認は未実施 |

REQUIREMENTS.md には TRAC-01/02/03/OPS-06 の4件が Phase 29 に Complete としてマークされており、PLAN frontmatter の requirements フィールドと完全一致。オーファン要件（PLAN未claim）なし。

### Anti-Patterns Found

なし。`src/portfolio/watchlist-data.ts` / `src/scripts/collect-watchlist-data.ts` に TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER のいずれも検出されず、placeholder/coming soon/not yet implemented 等の文言も検出されなかった。

### Human Verification Required

Plan 29-03 Task 2 は `checkpoint:human-verify`（gate="blocking"）であり、--auto チェーン実行のため自動承認された。以下は実機（launchd 毎朝8時実行、または手動実行）でのライブ検証が必要な項目（29-03-SUMMARY.md の HUMAN-UAT Tracking セクションと同一内容）:

### 1. Step 2i の実行と STEP マーカー出力

**Test:** launchd 毎朝8時実行（または手動 `cd /Users/arai/invest && npx tsx src/scripts/collect-watchlist-data.ts` 実行）で、Step 2h の直後に Step 2i が実行され stderr に `[STEP:watchlist-data:OK]`（または `:FAIL:<reason>`）が出力されることを確認する。
**Expected:** STEP マーカーが Step 2h の直後・Step 3 より前のタイミングで stderr に出力される。
**Why human:** 静的解析ではプロセス実行時の実際の stderr 出力タイミングとオーケストレーター（LLM）による Bash 実行順序を確認できない。

### 2. 出力2ファイルの実運用生成確認

**Test:** 実行後、`tmp/watchlist-technicals.json` が `{generatedAt, snapshots:[...]}` 形状の有効JSON、`tmp/watchlist-news.json` がアクティブ銘柄キーを持つ有効JSON（HoldingNewsFile）で生成されることを確認する。
**Expected:** 両ファイルが実運用のウォッチリスト・Yahoo Finance API応答・news.json の実データを入力に正しく生成される。
**Why human:** テストはモックデータでのロジック検証のみ。実際の Yahoo Finance API 応答・実運用の watchlist.json 内容での実行結果は実機でしか確認できない。

### 3. 既存4レポートの継続的生成・デプロイ

**Test:** Step 2i のログに `[PIPELINE:FAIL]` が出ていないこと、既存4レポート（daily/portfolio/meeting-minutes/news-digest）が通常どおり `docs/{date}/` に生成・デプロイされることを確認する。
**Expected:** Step 2i の成功・失敗にかかわらず既存4レポートの生成・デプロイパイプラインが継続する。
**Why human:** invest.md はオーケストレーターLLMが解釈して実行する自然言語スクリプトであり、実際に人間が実行ログを見て fail-soft 配線が意図通り機能したかを確認する必要がある。

### Gaps Summary

コードレベルでの実装・テスト・レビュー修正（CR-01 の重大バグ含む8件全修正）はすべて完了し、構造的検証（grep/awk/vitest/tsc）はすべて通過した。残る唯一のギャップは実機ライブ検証（launchd 実行または手動実行での Step 2i 動作・出力ファイル生成・既存4レポート継続確認）であり、これは Plan 29-03 が計画時点から `checkpoint:human-verify` として明示的に human_verification へ切り出していた項目であるため、gaps ではなく human_verification として扱う。

---

_Verified: 2026-07-15T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
