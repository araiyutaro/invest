---
phase: 28-watchlist-persistence
verified: 2026-07-15T03:16:08Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "翌朝の launchd 日次実行ログで Step 2h（write-watchlist.ts）の `[STEP:watchlist:OK]` が filter-etf-stocks / validate-meeting の後に出力されていることを確認する"
    expected: "実パイプライン順序どおりに `[STEP:watchlist:OK]`（または理由付き `[STEP:watchlist:FAIL:<reason>]`）が出力され、`[PIPELINE:FAIL]` は出ない"
    why_human: "launchd の実運用実行環境（本物の meeting-result.json・yahoo-finance2 quote() 応答・実行スケジュール）は静的解析・単体テストでは再現できない"

  - test: "実パイプライン実行後、data/watchlist.json が更新され、Step 4 の `git add docs/ docs_old/ data/` で自動コミットされていることを確認する"
    expected: "data/watchlist.json が当日の強気銘柄・除外理由付きの状態を反映して更新され、既存コミットフローでコミットされる"
    why_human: "実際の git commit 発生と実ファイル内容の実地確認は、テスト環境のフィクスチャ削除運用（本フェーズの smoke test は都度クリーンアップ）では代替できない"

  - test: "既存4レポート（daily/portfolio/meeting-minutes/news-digest）の生成・デプロイが Step 2h 追加後も一切影響を受けていないことを確認する（fail-soft, OPS-06 分担）"
    expected: "Step 2h の成功・失敗に関わらず、既存4レポートが従来どおり生成・デプロイされる"
    why_human: "実パイプライン全体の end-to-end 観測が必要で、静的解析やユニットテストでは既存レポート生成への波及影響を確認できない"
---

# Phase 28: Watchlist Persistence Verification Report

**Phase Goal:** 当日「強気」評価された銘柄（ETF除外後）が `data/watchlist.json` に日次で蓄積され、降格・購入・長期未確認の各理由に応じて理由付きで自動除外される、監査可能な状態テーブルとして機能する
**Verified:** 2026-07-15T03:16:08Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WLST-01: 当日 verdict 強気の highlightedStocks 銘柄（ETF除外後）が ticker キーで watchlist の active エピソードとして登録される。既にアクティブな銘柄の reconfirm（lastVerdictDate 更新、addedDate 保持）も冪等に動作する | ✓ VERIFIED | `src/portfolio/watchlist.ts:110-159` (`admitBullishStocks`)。`filterEtfStocks` 第2ゲート経由で新規候補のみ検証（`watchlist.ts:141`）。CR-01修正により既存 active 銘柄は第2ゲートをバイパスして reconfirm のみ行う設計（`watchlist.ts:131-137`, commit 402c6ea）。テスト: `watchlist.test.ts` の "新規の強気銘柄は...登録される", "reconfirm", "同日2回...冪等", "既に active な銘柄は quoteType lookup が無くても reconfirm される" が全 pass |
| 2 | WLST-02: 再評価で verdict が中立/弱気に転落した銘柄は自動除外される（TS側決定論） | ✓ VERIFIED | `src/portfolio/watchlist.ts:229-232` (`pruneWatchlist` 内 downgraded 判定)。テスト: "active 銘柄が当日 verdict=中立/弱気 で登場したら removedReason=downgraded で除外される" が pass |
| 3 | WLST-03: portfolio.json（PORTFOLIO_HOLDINGS）の保有銘柄はウォッチリストから自動除外される（TS側決定論）。admit 側にも二重防御ゲートがある | ✓ VERIFIED | prune 側: `watchlist.ts:225-227`。admit 側の二重防御（WR-01修正, commit 402c6ea）: `watchlist.ts:118-119, 129`。テスト: "PORTFOLIO_HOLDINGS に一致すれば removedReason=purchased で除外される", "PORTFOLIO_HOLDINGS に含まれる銘柄は強気でも admit されない", "保有銘柄が active 状態でも reconfirm されない" が全 pass |
| 4 | WLST-04: 強気再確認が一定期間（EXPIRY_CALENDAR_DAYS=30日）ない銘柄は時間ベースで自動失効する（TS側決定論） | ✓ VERIFIED | `src/portfolio/watchlist.ts:60` (定数), `234-242`（暦日差判定）。境界テスト: "経過日数がちょうど30日は失効しない" / "31日は失効する" が pass |
| 5 | WLST-05: 除外・失効はレコード削除ではなく理由付き（downgraded/purchased/expired）で記録され、履歴として追跡できる | ✓ VERIFIED | `WatchlistRemovalEpisode` 型（`watchlist.ts:19-24`）、`removeEntry`（`watchlist.ts:175-196`）が addedDate/lastVerdictDate/removedReason/removedDate を history に append。テスト: "除外後も removedReason/removedDate が history に保持され、レコード自体は削除されない", "再度強気なら history を保持したまま新 active エピソードを作る（re-admission）" が pass |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/watchlist.ts` | 純関数モジュール（型定義・admitBullishStocks・pruneWatchlist・EXPIRY_CALENDAR_DAYS・getActiveWatchlistEntries） | ✓ VERIFIED | 全シンボル存在・実装済み。I/O・ネットワーク依存なし（`grep -vE '^\s*(//|\*)' watchlist.ts | grep -cE 'yahoo-finance2|readFile|writeFile|process\.exit'` = 0 確認済み） |
| `src/portfolio/watchlist.test.ts` | WLST-01〜05 の単体テスト | ✓ VERIFIED | 26 tests、全 green（実行確認済み） |
| `src/scripts/write-watchlist.ts` | fail-soft CLI ラッパー（I/O・batch quote()・prune→admit 合成・STEP マーカー） | ✓ VERIFIED | 全機能実装済み。`yahooFinance.quote(` 呼び出し1回のみ（batch, D-22準拠） |
| `src/scripts/write-watchlist.test.ts` | ENOENT/破損/dateKey不正/STEP マーカーのテスト | ✓ VERIFIED | 19 tests、全 green |
| `.claude/commands/invest.md`（Step 2h） | write-watchlist.ts 実行ステップの fail-soft 挿入 | ✓ VERIFIED | Step 2g（validate-meeting, 行1197）後・Step 3（行1279）前に Step 2h（行1251-1277）を確認。awk 順序検証 OK |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `watchlist.ts` | `etf-exclusion.ts` | `filterEtfStocks`（第2ゲート） | ✓ WIRED | `watchlist.ts:141` で新規候補のみに適用。既存 active はバイパス（CR-01修正で正しい設計に是正済み） |
| `watchlist.ts` | `holding-news.ts` | `normalizeHoldingSymbol` | ✓ WIRED | ticker キー正規化に使用（`watchlist.ts:1, 119, 128, 214, 217`） |
| `watchlist.ts` | `urgency-history.ts` | `isValidDateKey` | ✓ WIRED | 日付検証に再利用（`watchlist.ts:3, 237-238`） |
| `write-watchlist.ts` | `watchlist.ts` | `admitBullishStocks`/`pruneWatchlist`/`getActiveWatchlistEntries` | ✓ WIRED | `write-watchlist.ts:5-9, 169-177, 181` で呼び出し、prune→admit 順序が正しい（Pitfall 3 準拠） |
| `write-watchlist.ts` | yahoo-finance2 | batch `quote()` | ✓ WIRED | 1回のみの呼び出し（`write-watchlist.ts:69`）。quoteType+longName/shortName を同時取得（D-04/D-22） |
| `invest.md` Step 2h | `write-watchlist.ts` | `npx tsx src/scripts/write-watchlist.ts` | ✓ WIRED | Step 2g 完了後・Step 3 前に正しく配線。fail-soft 文言・`[PIPELINE:FAIL]` 非出力を確認 |
| `invest.md` Step 4 | `data/` | `git add docs/ docs_old/ data/` | ✓ WIRED | 既存行が data/ を包含（変更不要、確認済み） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| watchlist.test.ts 全体 green | `npx vitest run src/portfolio/watchlist.test.ts` | 26 tests, 26 passed | ✓ PASS |
| write-watchlist.test.ts 全体 green | `npx vitest run src/scripts/write-watchlist.test.ts` | 19 tests, 19 passed | ✓ PASS |
| プロジェクト全体回帰確認 | `npx vitest run` | 29 files, 484 tests, 484 passed | ✓ PASS |
| TypeScript 型チェック | `npx tsc --noEmit` | 新規エラーなし（既存 collect-data.test.ts の pre-existing エラーのみ、本フェーズと無関係） | ✓ PASS |
| invest.md Step 2h 順序検証 | `awk` (validate-meeting < write-watchlist < Step 3) | OK | ✓ PASS |
| `[PIPELINE:FAIL]` 非出力確認 | `grep -c "\[PIPELINE:FAIL\]" write-watchlist.ts` | 0件 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| WLST-01 | 28-01, 28-02, 28-03 | 当日強気銘柄（ETF除外後）の watchlist.json 自動登録 | ✓ SATISFIED | `admitBullishStocks` + reconfirm 修正 + CLI 配線 + invest.md ステップ |
| WLST-02 | 28-01, 28-02, 28-03 | 中立/弱気転落銘柄の自動除外 | ✓ SATISFIED | `pruneWatchlist` downgraded トリガー |
| WLST-03 | 28-01, 28-02, 28-03 | 保有銘柄の自動除外（prune + admit 二重防御） | ✓ SATISFIED | `pruneWatchlist` purchased トリガー + `admitBullishStocks` holdings ゲート（WR-01修正） |
| WLST-04 | 28-01, 28-02, 28-03 | 長期未確認銘柄の時間ベース失効 | ✓ SATISFIED | `EXPIRY_CALENDAR_DAYS=30` + `calendarDaysBetween` 判定・境界テスト |
| WLST-05 | 28-01, 28-02, 28-03 | 除外・失効の理由付き履歴保持 | ✓ SATISFIED | `WatchlistRemovalEpisode` + `removeEntry` の history append |

すべての宣言済み requirement ID（WLST-01〜05）が3プラン全てに一貫して宣言されており、REQUIREMENTS.md のトレーサビリティ表（Phase 28: WLST-01〜05, Complete）と一致。ORPHANED requirement なし。

### Anti-Patterns Found

None. `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` および空実装パターン（`return null`, `return {}`, `=> {}`）を `src/portfolio/watchlist.ts`, `src/scripts/write-watchlist.ts`, `.claude/commands/invest.md` に対して grep したが検出なし。

### Code Review Findings — Post-Fix State

28-REVIEW.md（2026-07-15T02:59:39Z）で Critical 1件・Warning 3件が検出されたが、28-REVIEW-FIX.md 記載のとおり全4件がコミット 402c6ea（CR-01+WR-01結合修正）・8d7bb06（WR-02）・67baf55（WR-03）で修正済みであることをコード読解で確認した：

- **CR-01**（継続強気の active 銘柄が reconfirm されず31日目に誤 expired）: `watchlist.ts:131-137` で active ticker を第2ゲートからバイパスする分離ロジックを確認。回帰テスト "既に active な銘柄は quoteType lookup が無くても reconfirm される" が pass。
- **WR-01**（admit に PORTFOLIO_HOLDINGS ゲート欠落）: `watchlist.ts:118-119, 129` で holdings 引数による二重防御を確認。回帰テスト "PORTFOLIO_HOLDINGS に含まれる銘柄は強気でも admit されない" が pass。
- **WR-02**（シェイプ未検証 JSON でのクラッシュ）: `write-watchlist.ts:40-42`（非null/非配列検証）、`watchlist.ts:194`（history 欠落防御）、`write-watchlist.ts:138-140`（ticker欠落要素フィルタ）を確認。回帰テスト（null/配列/文字列/数値 it.each）が pass。
- **WR-03**（ticker 正規化の非対称）: `watchlist.ts:126-129`（bullishOnly 一括正規化）、`write-watchlist.ts:85, 146-147`（Map構築・candidateTickers 算出時の正規化）を確認。回帰テスト "小文字・空白付きの ticker でも正規化キーで lookup され admit される" が pass。

IN-01〜03（Info）は fix_scope=critical_warning のため未対応のまま（意図的スコープ外、レビュー記載どおり）。

### Human Verification Required

28-03-PLAN.md の Task 2（checkpoint:human-verify, gate=blocking）で明示的に静的検証不能と分類された3項目。28-03-SUMMARY.md にも「虚偽のライブ検証済み表記はしない」と明記されており、フェーズ検証器（本レポート）が human_verification として永続化する。

### 1. launchd 実行ログでの Step 実マーカー確認

**Test:** 翌朝の launchd 日次実行ログを確認し、Step 2h（write-watchlist.ts）の `[STEP:watchlist:OK]` が filter-etf-stocks / validate-meeting の後に出力されていることを確認する
**Expected:** 実パイプライン順序どおりに `[STEP:watchlist:OK]`（または理由付き FAIL マーカー）が出力され、`[PIPELINE:FAIL]` は一度も出ない
**Why human:** launchd の実運用実行環境（実際の meeting-result.json コンテンツ・yahoo-finance2 の実 API 応答・実行スケジュールタイミング）は静的解析・単体テストのモック環境では再現できない

### 2. data/watchlist.json の実生成・自動コミット確認

**Test:** 実パイプライン実行後、`data/watchlist.json` が当日状態を反映して更新され、Step 4 の `git add docs/ docs_old/ data/` でコミットされていることを確認する
**Expected:** data/watchlist.json に当日の強気銘柄が active 登録され、除外銘柄が理由付きで history に記録され、コミットに含まれる
**Why human:** オーケストレーター実施のスモークテスト（28-03-SUMMARY.md 記載）ではフィクスチャと生成ファイルを検証後に削除しており、実運用コミットフローでの永続化確認はまだ行われていない

### 3. 既存4レポートへの無影響確認

**Test:** 既存4レポート（daily/portfolio/meeting-minutes/news-digest）の生成・デプロイが Step 2h 追加後も一切影響を受けていないことを確認する（fail-soft, OPS-06 分担）
**Expected:** Step 2h の成功・失敗に関わらず、既存4レポートが従来どおり生成・デプロイされる
**Why human:** 実パイプライン全体の end-to-end 実行結果の観測が必要で、静的解析・ユニットテストでは波及影響を確認できない

### Gaps Summary

コードレベルでの機能実装・レビュー指摘の修正・テストカバレッジはすべて確認され、WLST-01〜05 の5要件全てが単体テストレベルで検証済み（VERIFIED）。ゼロギャップ。ただし、28-03-PLAN.md 自体が実launchd実行での確認を「Manual-Only」と明示的に分類しており（28-VALIDATION.md 参照）、これは実装の欠陥ではなく計画時から意図された人手検証ステップ。オーケストレーターのスモークテスト（fixture ベース、POWL/SPY 銘柄で実 quote() 呼び出しを実施）は実施済みだが、実運用環境（launchd 日次実行・実 git コミット・既存レポートへの波及）での確認はまだ行われていない。

---

_Verified: 2026-07-15T03:16:08Z_
_Verifier: Claude (gsd-verifier)_
