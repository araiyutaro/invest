---
phase: 28-watchlist-persistence
fixed_at: 2026-07-15T12:12:30Z
review_path: .planning/phases/28-watchlist-persistence/28-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-07-15T12:12:30Z
**Source review:** .planning/phases/28-watchlist-persistence/28-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4（CR-01, WR-01, WR-02, WR-03 — fix_scope: critical_warning のため IN-01〜03 は対象外）
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: 継続強気の active 銘柄が reconfirm されず 31 日目に誤 expired（D-22 × D-21 fail-closed の合成バグ）

**Files modified:** `src/portfolio/watchlist.ts`, `src/scripts/write-watchlist.ts`, `src/portfolio/watchlist.test.ts`, `src/scripts/write-watchlist.test.ts`
**Commit:** 402c6ea
**Status:** fixed: requires human verification（ロジック修正のため。ただし挙動を検証する回帰テストを追加済み — 下記参照）
**Applied fix:** `admitBullishStocks` 内で「既に active な ticker」を `filterEtfStocks`（第2ゲート）からバイパスし、reconfirm（`lastVerdictDate` 更新）のみ行うよう分離した。レビュー指摘どおり、prune 直後（同一実行内）に除外された銘柄は非 active のため reconfirm パスには乗らず、prune → admit の優先順は保たれる。D-22（batch quote 1回・新規候補のみ）は維持 — quote() コール数は増えていない（統合テストで `quoteMock` 非呼び出しを検証）。
**回帰テスト追加:**
- ユニット: 「既に active な銘柄は quoteType lookup が無くても reconfirm される」
- 統合: 「既に active な非保有銘柄が当日も強気なら quote() を呼ばずに lastVerdictDate が更新される」（レビューが指摘した write-watchlist.test.ts の欠落アサーション — バグに依存して pass していたテスト構造を是正）

### WR-01: admitBullishStocks に PORTFOLIO_HOLDINGS ゲート欠落（WLST-03）— CR-01 と結合修正

**Files modified:** `src/portfolio/watchlist.ts`, `src/scripts/write-watchlist.ts`, `src/portfolio/watchlist.test.ts`, `src/scripts/write-watchlist.test.ts`
**Commit:** 402c6ea（CR-01 と同一コミット — レビューの指示どおり結合修正。CR-01 の active バイパスだけを入れると「保有中 + active + 毎日強気」で prune の purchased 除外が翌 run の reconfirm に打ち消されるため分離不可）
**Status:** fixed: requires human verification（ロジック修正のため。回帰テスト追加済み）
**Applied fix:** `admitBullishStocks` に `holdings: ReadonlyArray<PortfolioHolding>` 引数を追加し、`normalizeHoldingSymbol` 済み保有シンボル Set に一致する候補を admit 対象から除外（二重防御）。CLI は `PORTFOLIO_HOLDINGS` を渡すよう変更。レビュー指摘のとおり write-watchlist.ts:146 の「prune 優先」コメントも実態（holdings ゲートによる担保）に合わせて修正した。
**テスト修正:** 既存の統合「正常系」テストが保有銘柄 MRNA を新規登録候補に使用しており（= WR-01 のバグ経路そのものに依存）、非保有銘柄 NVDA に変更。MRNA の purchased 優先テストには `lastVerdictDate` 非復活のアサーションを追加。ユニットテスト2件（保有銘柄の admit 拒否 / 保有中 active 銘柄の reconfirm 拒否）を追加。

### WR-02: シェイプ未検証 JSON でのクラッシュにより FAIL マーカー契約が破られる

**Files modified:** `src/scripts/write-watchlist.ts`, `src/portfolio/watchlist.ts`, `src/scripts/write-watchlist.test.ts`, `src/portfolio/watchlist.test.ts`
**Commit:** 8d7bb06
**Applied fix:**
- `loadExistingWatchlist`: `JSON.parse` 結果を非 null プレーンオブジェクト検証（null / 配列 / プリミティブは `corrupted: true` → D-18 の保全経路 + `[STEP:watchlist:FAIL:corrupted]`）
- `removeEntry`: `[...(entry.history ?? []), episode]` で history 欠落（手編集・旧フォーマット）を防御
- `main`: `highlightedStocks` を `typeof s?.ticker === "string"` でフィルタし、不正要素での fatal クラッシュを防止（Phase 27 コミット 8f4d2ac の fail-soft 規約に準拠）
**回帰テスト追加:** 不正形状4種（null/配列/文字列/数値）の `it.each`、watchlist.json=null の統合テスト、ticker 欠落要素混在の統合テスト、history 欠落エントリの prune ユニットテスト。

### WR-03: ticker 正規化のレイヤー間非対称 — lookup ミスによる fail-closed 誤除外

**Files modified:** `src/portfolio/watchlist.ts`, `src/scripts/write-watchlist.ts`, `src/portfolio/watchlist.test.ts`, `src/scripts/write-watchlist.test.ts`
**Commit:** 67baf55
**Applied fix:**
- `admitBullishStocks`: `bullishOnly` 構築時に ticker を `normalizeHoldingSymbol` で一括正規化し、以降の全 lookup（watchlist キー / `quoteTypeByTicker`（filterEtfStocks 内）/ `nameByTicker`）を正規化キーで統一
- CLI: `candidateTickers` 算出時と `fetchQuoteTypesAndNames` の Map 構築時に `normalizeHoldingSymbol` を適用し、admit 側と対称化（WatchlistEntry doc コメント行30 の「正規化済みキー」前提を実質担保）
**回帰テスト追加:** 小文字・空白付き ticker の admit / reconfirm ユニットテスト2件、` nvda ` → `quote(["NVDA"])` → `written.NVDA` の統合テスト。

## Skipped Issues

なし（IN-01〜IN-03 は fix_scope=critical_warning のためスコープ外。未対応のまま残置）。

## Verification

- `npx tsc --noEmit`: 修正ファイルに新規エラーなし（`collect-data.test.ts` の既存エラー4件は本修正と無関係の pre-existing）
- `npx vitest run`（全スイート）: 各コミット前に実行、最終 **29 files / 484 tests 全 green**（ベースライン 474 → 回帰テスト10件追加）
- 対象スイート `src/portfolio/watchlist.test.ts`（26 tests）/ `src/scripts/write-watchlist.test.ts`（19 tests）green
- D-22 制約（batch quote 1回・新規候補のみ）: 維持を統合テストで検証（active のみの日は quote 非呼び出し）
- D-17 冪等性 / WLST-05 history 保全: 既存テストが引き続き green

---

_Fixed: 2026-07-15T12:12:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
