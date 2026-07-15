---
phase: 27-etf-exclusion
reviewed: 2026-07-15T01:45:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/portfolio/etf-exclusion.ts
  - src/portfolio/etf-exclusion.test.ts
  - src/scripts/filter-etf-stocks.ts
  - src/scripts/filter-etf-stocks.test.ts
  - .claude/commands/invest.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
  fixed: 2
  skipped: 0
status: fixed
---

# Phase 27: Code Review Report

**Reviewed:** 2026-07-15T01:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** fixed (WR-01, WR-02 fixed; IN-01..IN-04 remain open, out of scope)

## Summary

Phase 27（ETF Exclusion）の実装5ファイルを standard 深度でレビューした。設計コントラクトの検証結果:

- **D-01（per-ticker fail-closed）**: 準拠。map 未登録・`status:"failed"` の両方が `lookup-failed` として除外される（etf-exclusion.ts:50-54）
- **D-04（allowlist）**: 準拠。`quoteType === "EQUITY"` のみ通過（etf-exclusion.ts:29, 55）
- **D-05（単一 batch quote）**: 準拠。`yahooFinance.quote([...tickers])` 1回のみ（filter-etf-stocks.ts:27）、Test G で検証済み
- **D-07（validate-meeting.ts より前に実行）**: 準拠。invest.md:1173 で filter → invest.md:1197 で validate の順
- **D-08（STEPマーカー）**: 準拠。`[STEP:etf-exclusion:OK]`（invest.md:1183）/ `[STEP:etf-exclusion:FAIL:<短い理由>]`（invest.md:1189）
- **D-09（スキーマ不変）**: 準拠。spread による要素除去のみ（filter-etf-stocks.ts:94）
- **D-10/D-11（第1層プロンプト）**: 準拠。Round 1 全5ブロック（invest.md:191, 237, 283, 329, 375）とモデレーター注意事項（invest.md:1082）に除外指示あり
- **D-02（whole-script fail-soft）**: WR-01/WR-02 のフィックスにより準拠（fail-soft ガードを追加）

テストは 16/16 パス（フィックス後は 9件追加され 439/439 パス、filter-etf-stocks.test.ts は 9/9）。D-02 のフェイルソフト保証にあった1箇所の抜け道（WR-01）と、D-03（銘柄単位失敗とメカニズム故障の区別）の境界の曖昧さ（WR-02）は commit `8f4d2ac` で修正済み。Critical 該当なし。

## Warnings

### WR-01: `highlightedStocks.map` が try/catch 外にあり、形状不正な JSON で D-02（throwしない）契約を破る [fixed]

**Status:** fixed (commit `8f4d2ac`, `fix(27-02): fail-soft guard for malformed highlightedStocks and empty quote response`)
**File:** `src/scripts/filter-etf-stocks.ts:63`
**Issue:** filter-etf-stocks.ts は validate-meeting.ts の**前**に実行される（D-07）ため、この時点の tmp/meeting-result.json はモデレーター LLM の生出力であり、形状検証されていない。invest.md Step 2f のリトライは「有効な JSON か」のみを保証し、`highlightedStocks` フィールドの存在は保証しない。`JSON.parse` は成功するが `highlightedStocks` が欠損／非配列のケースで、line 63 の `.map()` が try/catch の外で TypeError を投げる。結果:
1. `main()` が reject し、D-02 の「throw せず」契約に違反（CLI 実行時は line 100 の `.catch` で拾われ exit 1 になるため元ファイルは保全されるが、契約上のフェイルソフトハンドラを素通りする）
2. stderr に `[filter-etf-stocks] FAIL:` 行が出力されず「Fatal error:」のみになるため、invest.md:1186-1189 の「FAIL 行から理由を要約して `[STEP:etf-exclusion:FAIL:<短い理由>]` を出力する」指示の前提が崩れる

雛形とされた `write-urgency-history.ts:59` は `!Array.isArray(analysis.holdings)` の防御チェックを行っており、本実装はそのパターンから逸脱している。
**Fix:**
```typescript
  } catch (error) { /* 既存の読み込み失敗ハンドリング */ }

  if (!Array.isArray(meetingResult.highlightedStocks)) {
    console.error(
      "[filter-etf-stocks] FAIL: meeting-result.json の highlightedStocks が配列ではありません。フィルタをスキップします。",
    );
    process.exitCode = 1;
    return;
  }

  const tickers = meetingResult.highlightedStocks.map((s) => s.ticker);
```

### WR-02: batch quote() が「成功したが結果0件」の場合、全銘柄が fail-closed 除外され highlightedStocks が空で書き戻される（D-03 の混同）[fixed]

**Status:** fixed (commit `8f4d2ac`, `fix(27-02): fail-soft guard for malformed highlightedStocks and empty quote response`)
**File:** `src/scripts/filter-etf-stocks.ts:24-39, 82-95`
**Issue:** `fetchQuoteTypes` が例外なく空の Map（あるいは全 ticker 不一致の Map）を返した場合 — 例: Yahoo API の劣化応答、全件で `symbol`/`quoteType` フィールド欠損（line 34 のガードで全件スキップ）— コードはこれを「N 銘柄すべての個別 lookup 失敗（D-01 fail-closed）」として扱い、`highlightedStocks: []` を tmp/meeting-result.json に**書き込んで上書きする**。しかし要求 N 件に対し応答 0 件という状況は、個別銘柄の判定不能ではなく「フィルタ機構そのものの故障」の徴候であり、D-03 が明示的に禁止している2つの故障モードの混同にあたる。この場合の正しい挙動は D-02（元ファイル維持・未フィルタで継続）である。当日の全推奨銘柄がレポートおよび翌日の prev-highlighted-stocks 注入から消失するため、影響はフィルタ失敗（未フィルタ継続）より重い。
**Fix:**
```typescript
  // fetchQuoteTypes 呼び出し後、filterEtfStocks の前に追加:
  if (quoteTypeByTicker.size === 0) {
    // D-03: 要求N件に対し応答0件は個別lookup失敗ではなくメカニズム故障とみなす
    console.error(
      `[filter-etf-stocks] FAIL: ${tickers.length}銘柄の要求に対し quote 応答が0件でした。メカニズム故障とみなしフィルタをスキップします。`,
    );
    process.exitCode = 1;
    return;
  }
```

## Info

### IN-01: ticker 表記ゆれ（大文字小文字・シンボル形式）で有効な EQUITY が恒常的に除外される

**File:** `src/scripts/filter-etf-stocks.ts:35` / `src/portfolio/etf-exclusion.ts:49`
**Issue:** map のキーは Yahoo が返す正規化済み `symbol`、lookup キーは meeting-result.json 内の ticker 文字列。LLM 出力の ticker が正規形とずれる場合（例: 小文字 `aapl`、`BRK.B` vs Yahoo 正規形 `BRK-B`）、応答は返っても map が一致せず、有効な個別株が毎回 `lookup-failed` で除外される。fail-closed 設計上は安全側だが、恒常的な偽陽性除外になり得る。
**Fix:** map 登録時と lookup 時の双方で `ticker.toUpperCase()` に正規化する（`.`↔`-` 変換は Phase 28 以降で必要になれば検討）。

### IN-02: macro アナリストの analysis テンプレートに「関連ETF等の詳細」が残存し、第1層の除外指示と逆方向のシグナルになっている

**File:** `.claude/commands/invest.md:272`
**Issue:** macro の Round 1 出力契約の `analysis` テンプレートに「注目銘柄の詳細分析\n[テーマ銘柄や関連ETF等の詳細で…]」とあり、同ブロック末尾（invest.md:283）の「ETF・投資信託・インデックスファンドは picks に含めないこと」と方向が逆のニュアンスを与える。analysis 散文への ETF 言及自体は禁止対象外だが、picks への ETF 混入をわずかに誘発し得る。第2層（決定論フィルタ）が捕捉するため実害は限定的。
**Fix:** 「テーマ銘柄や関連セクターの詳細」等、ETF への言及を picks 禁止と整合する文言に修正。

### IN-03: yahoo-finance2 のレスポンススキーマ検証エラー1件で batch 全体が throw し、当日のフィルタ層全体が無効化される

**File:** `src/scripts/filter-etf-stocks.ts:27`
**Issue:** yahoo-finance2 はデフォルトで結果をスキーマ検証し、1銘柄でも型不一致があると batch 全体が throw する。この場合 D-02 により未フィルタの meeting-result.json がそのまま下流に流れ、ETF が当日のレポート・翌日注入に混入する。D-02 の設計として受容済みの故障モードだが、`quote(symbols, { ... }, { validateResult: false })` を指定すれば、本用途で必要なのは `symbol`/`quoteType` の2フィールドのみ（防御的パース済み）のため、この故障モードを安価に排除できる。
**Fix:** `validateResult: false` オプションの付与を検討（防御的パース（line 30-37）が既にあるため安全）。

### IN-04: Test C/D が process.exitCode の退避・復元を try/finally なしで行っており、アサーション失敗時に他テストへ汚染する

**File:** `src/scripts/filter-etf-stocks.test.ts:116-126, 132-142`
**Issue:** `process.exitCode` をグローバルに退避→検証→復元しているが、途中の `expect` が失敗すると復元行（line 126, 142）に到達せず、`exitCode=1` が残留してワーカープロセスの終了コードと後続テストの前提に影響する（テスト信頼性の問題）。
**Fix:** 退避〜検証を `try { ... } finally { process.exitCode = originalExitCode; }` で囲む。

---

_Reviewed: 2026-07-15T01:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
