---
phase: 22-portfolio-analyst-re-evaluation
reviewed: 2026-07-03T12:05:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - .claude/commands/invest.md
  - src/meeting/schemas.test.ts
  - src/meeting/schemas.ts
  - src/meeting/types.ts
  - src/portfolio/decision-diff.test.ts
  - src/portfolio/decision-diff.ts
  - src/scripts/generate-portfolio-report.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/generate-report.ts
  - src/scripts/report-data-loaders.test.ts
  - src/scripts/report-data-loaders.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
fixes:
  fixed_at: 2026-07-03T12:20:00Z
  fix_scope: critical_warning
  fixed:
    - WR-01
    - WR-02
    - WR-03
---

# Phase 22: Code Review Report

**Reviewed:** 2026-07-03T12:05:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 22（Portfolio-Analyst Re-Evaluation）の実装 11 ファイルを standard 深度でレビューした。フェーズの主要不変条件は全て検証し、満たされていることを確認した:

- **PORT-05 strip 不変条件**: `holdingEvaluationSchema` の transform は明示的オブジェクトリテラルで構築されており（`schemas.ts:209-220`）、`...raw` スプレッドは無い。LLM 出力の `decisionChanged`/`previousDecision` は構造的に strip される（テスト `schemas.test.ts:505-513` で担保）。
- **バッジゲーティング**: `formatDecisionChangedBadgeHtml` は厳密な `decisionChanged !== true` 早期 return（`generate-portfolio-report.ts:63`）。undefined（比較不能）と false（変化なし）の両方が非表示になる（Test 42 で担保）。
- **escapeHtml**: バッジ内の動的文字列（`previousDecision`, `decision`）、`symbol`/`nameJa`/`rationale`/`riskNote` は全て `escapeHtml` を通過。`escapeHtml` は `"` `'` も含む 5 文字をエスケープし、`safeHref` は http(s) のみ許可。XSS 経路は確認できず。
- **PORT-04 alias-transform**: urgent/urgency/isUrgent/urgentFlag の 4 エイリアスが解決され、省略時 false（テスト網羅済み）。
- **PORT-03 / invest.md**: portfolio-research セクションは `researchSummary`/`positiveFindings`/`negativeFindings` のみ埋め込み、keyArticles・URL は注入しない。全ての新規セクションはファイル存在条件付き。プロンプトインジェクション注意書きも付与されている。
- **border-left**: バッジ有無に関わらず `decisionColor(h.decision)` 維持（Test 43 で担保）。
- **decision-diff**: 純関数、当日 holdings 駆動ループ、`normalizeHoldingSymbol` によるキー正規化。テストは D-14（undefined/false 区別）を含め妥当。
- 対象 4 テストファイル 104 テスト全パス、`tsc --noEmit` はスコープ内ファイルにエラーなし（`collect-data.test.ts` の TS7006 x4 はスコープ外の既存エラー）。

一方で、堅牢性に関する Warning 3 件（単一フィールドの型ドリフトによる全レポート喪失、同日再実行時の前日スナップショット汚染、Round ローダーのサイレント catch）と Info 5 件を検出した。

## Warnings

### WR-01: holdings 1 銘柄の型ドリフトで portfolio レポート全体がフォールバックに落ちる（per-holding fail-soft なし）

**fixed: true** — `lenientBoolean`（"true"/"false" 文字列を boolean に矯正）を urgent 系 4 エイリアスに適用し、holdings を `z.array(z.unknown()).transform()` の要素単位 safeParse に変更（不正銘柄のみ drop + console.warn、keyArticles の D-12 パターンと同型）。strip 保証（明示的オブジェクトリテラル、`...raw` なし）と alias-transform 意味論は不変。テスト 7 件追加・1 件を fail-soft 仕様に更新（commit `5f13df4`）。

**File:** `src/meeting/schemas.ts:193-229`
**Issue:** `rawHoldingSchema` の `urgent`/`urgency`/`isUrgent`/`urgentFlag` は `z.boolean()` 厳格、`decision`/`action` は enum 厳格。LLM が 12 銘柄中 1 銘柄でも `"urgent": "true"`（文字列）や `"decision": "売却"`（enum 外）を出力すると `portfolioAnalysisSchema.parse` 全体が throw し、`loadPortfolioAnalysis` が null を返して**ポートフォリオレポート全体**が「本日のポートフォリオ分析は生成されませんでした」にフォールバックする。本フェーズは keyArticles に要素単位フェイルソフト（D-12）を導入した設計思想を持つが、holdings 配列には同じ保護がない。urgent はこのフェーズで新設された 4 つの boolean フィールドであり、型ドリフト面が拡大している。invest.md のプロンプト厳守指示とリトライ 1 回が唯一の緩和策。
**Fix:** boolean エイリアスに寛容パーサを適用する:
```typescript
const lenientBoolean = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
  .optional();
// rawHoldingSchema 内: urgent: lenientBoolean, urgency: lenientBoolean, ...
```
さらに理想的には holdings を `z.array(z.unknown()).transform()` で要素単位に safeParse し、不正銘柄のみ drop + console.warn する（keyArticles の `toKeyArticle` パターンと同型）。

### WR-02: 前日スナップショットに日付ガードがなく、同日再実行で decisionChanged の意味が壊れる

**fixed: true** — invest.md Step 3d の退避スニペットに JST 日付ガードを追加（`prev.date === todayJst` の場合は退避スキップ・既存 prev 保持）。防御の重ね掛けとして `generate-report.ts` に純関数 `resolvePrevHoldingsForDiff` を新設し、`prev.date === current.date` の場合は null（= D-14 の decisionChanged undefined 意味論）+ console.warn とした。ユニットテスト 4 件追加（commit `bee5303`）。

**File:** `.claude/commands/invest.md:1699-1716`, `src/scripts/generate-report.ts:114-119`
**Issue:** Step 3d の退避スクリプトは `tmp/portfolio-analysis.json` を無条件に `prev-portfolio-analysis.json` へコピーする。パイプラインを同日に再実行すると（このパイプラインは fail-soft 設計で再実行が想定運用）、**同日の 1 回目の結果**が「前日データ」として退避され、`attachDecisionChanges` は同日比較になる。結果: (a) 実際の前日からの判断変更バッジが消える、(b) 同日 2 回の LLM 実行の揺らぎが「判断変更: 前日 → 当日」と誤表示される。`prev.date` と当日日付の比較はスナップショット側にも `generate-report.ts` 側にも存在しない。また portfolio-analyst 失敗日には `portfolio-analysis.json` が古い日付のまま残るため、翌日は 2 日前のデータが「前日」として比較される（こちらは許容範囲だが無警告）。
**Fix:** 退避スクリプトに日付ガードを追加する:
```javascript
const today = new Date().toISOString().slice(0, 10);
if (prev.date === today) {
  console.log('同日データのため退避スキップ（既存の prev を保持）');
} else if (Array.isArray(prev.holdings) && prev.holdings.length > 0) {
  fs.writeFileSync(...);
}
```
防御の重ね掛けとして `generate-report.ts` 側でも `prevPortfolioAnalysis?.date === meetingResult.date` の場合に null 扱い + console.warn を検討。

### WR-03: loadRound1/2/3 の per-file catch がサイレント（console.warn なし、D-15 不変条件と不整合）

**fixed: true** — 3 ローダーの per-file catch にファイル名 + エラーメッセージ付き console.warn を追加（loadPrevPortfolioAnalysis の D-15 規約と同形式）。malformed ファイルが drop され正常ファイルが残ることを検証するテストを 3 件追加（commit `393f5b0`）。

**File:** `src/scripts/report-data-loaders.ts:21-23, 43-45, 65-67`
**Issue:** 本フェーズの Test 44/45 は `loadWebSearchResults`/`loadReevalResults` の per-file catch が console.warn を出すこと（Pitfall 7 負債回収, D-15）を検証しているが、同一ファイル内の `loadRound1Results`/`loadRound2Results`/`loadRound3Results` の per-file catch は `catch { return null; }` のままサイレント。Round ファイル 1 つが malformed だと、該当アナリストが meeting-minutes から**無警告で消える**。「loaders must console.warn (not silent) on catch」というフェーズ不変条件に対し、同ファイル内で規律が分裂している（既存コードだが、本フェーズで同ファイルを触っており回収機会があった）。
**Fix:** 3 つのローダーの per-file catch を揃える:
```typescript
} catch (error) {
  console.warn(`Round 1 result load failed (${f}):`, error instanceof Error ? error.message : error);
  return null;
}
```

## Info

### IN-01: loadNewsPool/loadHoldingNews の無検証型アサーションは形状ドリフトで main() をクラッシュさせる

**File:** `src/scripts/report-data-loaders.ts:108, 122`
**Issue:** `JSON.parse(raw) as ReadonlyArray<NewsArticlePoolEntry>` — news.json が配列以外の有効 JSON（例: `{"error": ...}`）だった場合、`resolvePortfolioHoldingNews` の `pool.map` が TypeError で throw し、fail-soft 設計にもかかわらず 3 レポート全体の生成が落ちる。自社 TS 生成物のため発生確率は低い（コメントで設計判断として明記済み）。
**Fix:** `const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [];`（loadHoldingNews も同様に非 null オブジェクト検査）。

### IN-02: formatNewCandidatesHtml のヘッダ行に style 属性が重複生成される

**File:** `src/scripts/generate-portfolio-report.ts:118-127`
**Issue:** `agentHeaders` の `<td>` は既に `style="text-align:center;font-size:0.8rem;"` を持つが、127 行目の `.replace(/(<td)/g, '$1 style="background:...")` で 2 つ目の style 属性が挿入される（`<td style="background:..." style="text-align:...">`）。HTML では最初の属性が勝つため、ヘッダの text-align/font-size 指定が無効化される。既存コードの表示品質問題。
**Fix:** ヘッダ用セルは replace ではなく専用テンプレートで直接スタイルを結合して生成する。

### IN-03: ポートフォリオ保有銘柄リストが invest.md 内 2 箇所にハードコード重複

**File:** `.claude/commands/invest.md:471, 1097`
**Issue:** 12 銘柄リスト（`MRNA, JOBY, ... NXT, BWMX`）が Step 2b のフィルタと Step 2f の注意事項に重複ハードコードされており、`src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` と三重管理。保有銘柄変更時に更新漏れするとティッカー除外が壊れる（既存の負債）。
**Fix:** Step 2b のフィルタスクリプトで `holdings.ts` から動的に読む（例: `npx tsx -e` で PORTFOLIO_HOLDINGS を import）か、少なくとも invest.md 冒頭に単一定義してプレースホルダ参照させる。

### IN-04: urgent: true 時の riskNote 必須がプロンプト規約のみでスキーマ非強制

**File:** `src/meeting/schemas.ts:209-220`, `.claude/commands/invest.md:1815`
**Issue:** invest.md は「urgent: true とした銘柄は riskNote にその重大材料を必ず記載すること」と指示するが、スキーマ・レンダラーとも未強制。LLM が riskNote なしで urgent: true を出すと、赤「⚠ 緊急」バッジだけが根拠説明なしで表示される。
**Fix:** transform 内で `urgent && riskNote === undefined` の場合に console.warn する（drop はしない）。

### IN-05: 前日 holding の decision 欠落・シンボル重複が「判断変更」バッジを捏造しうる

**File:** `src/portfolio/decision-diff.ts:27-40`, `src/meeting/schemas.ts:215`
**Issue:** (a) 前日ファイルの holding が `decision`/`action` 両方を欠く場合、スキーマデフォルトで `"保持"` が合成され、当日「買増」と比較して実際には存在しなかった「判断変更: 保持 → 買増」バッジが表示される。(b) `prevBySymbol` Map は正規化後シンボルが重複すると後勝ちで、前日ファイルに重複エントリがあると誤った prev decision と比較される。いずれもエイリアス網羅とプロンプト規約により発生確率は低い。
**Fix:** (a) はデフォルト合成された decision を diff 比較から除外するマーカー（例: transform で `decision` 欠落時は比較スキップ）を検討。(b) は Map 構築時に重複キーを console.warn。

---

_Reviewed: 2026-07-03T12:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
