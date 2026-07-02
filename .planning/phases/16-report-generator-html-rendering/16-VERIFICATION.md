---
phase: 16-report-generator-html-rendering
verified: 2026-07-02T15:54:00+09:00
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "各記事に会社名併記（D-04）のティッカーピル（D-09 リンクなし）が表示され、社名欠落時はシンボルのみにフォールバックする"
    status: failed
    reason: "formatTickerPillsHtml が生成する <span class=\"ticker-pill\"> の CSS 定義が generateBaseStyles / report-utils.ts のどこにも存在しない（grep で src/ 全体を確認 — 参照2箇所・定義0件）。結果、ピルは背景・パディング・角丸を持たない無地のインラインテキストとして描画され「ピル」というUI要件を満たさない。加えて formatTickerPillsHtml は複数ピルを .join(\"\") で連結しており区切り文字がないため、1記事に複数ティッカーがある場合（例 NVDA + MSFT）は実際に \"NVDA エヌビディアMSFT マイクロソフト\" のように可読不能な連結テキストとして出力されることを実レンダリングで直接確認した。"
    artifacts:
      - path: "src/scripts/generate-news-digest.ts"
        issue: "formatTickerPillsHtml (L49-58) が .ticker-pill クラスを参照するが定義側が存在しない。.news-meta も同様。"
      - path: "src/scripts/report-utils.ts"
        issue: "generateBaseStyles (L80-185) に .ticker-pill / .news-meta の style ルールが存在しない（.agent-card / .discussion-card は定義済みだが対応する追加なし）"
    missing:
      - ".ticker-pill と .news-meta の CSS 定義を generateBaseStyles（またはレンダラー側インラインスタイル）に追加する"
      - "formatTickerPillsHtml の .join(\"\") を区切り文字ありの結合（例 .join(\" \") かピル自体に margin-right）に変更する"
      - "複数ティッカーを持つ記事のテストケース（現行12テストは全記事が単一ティッカーのみで、この欠陥をすり抜けている）を追加する"
---

# Phase 16: Report Generator (HTML Rendering) Verification Report

**Phase Goal:** Phase 15の契約に基づき、news-digest.htmlの本文が記事一覧・市場別グルーピング・重要度・関連ティッカー・リード文を含む形で、既存3レポートと同一のBloomberg風ダークテーマ・ナビゲーションで描画される
**Verified:** 2026-07-02T15:54:00+09:00
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP.md Success Criteria (5 items) and 16-02-PLAN.md `must_haves.truths` (8 items, superset detail).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 各記事に見出し（escapeHtml済みhrefリンク, D-01）・ソース名・JST絶対時刻（D-02）が3行カード構成（D-03）で表示される | VERIFIED | `generate-news-digest.ts:65-82` `formatArticleCardHtml`；`escapeHtml(href)` + `target="_blank" rel="noopener noreferrer"` を確認（L71-73）。テスト `CURA-03` で `&amp;` エスケープ・`Reuters`/`Bloomberg`・JST時刻文字列を assert、`npx vitest run` で緑を実測確認 |
| 2 | 各記事に日本語の「なぜ重要か」解説コメントが表示される | VERIFIED | `formatArticleCardHtml` 3行目 `escapeHtml(a.commentary)` (L80)。テスト `CURA-04` で3記事のcommentaryが全てtoContainされることを確認 |
| 3 | 記事が市場別（米国株→日本株→グローバル固定順, D-05）グループ内で重要度順（high→medium→low, D-07）に配列される | VERIFIED | `MARKET_ORDER` 固定配列 (L4-8) + `sortByImportance` ネイティブ安定ソート (L44-47)。テスト「市場順」「CURA-06」で index 比較を確認、実行して緑を確認 |
| 4 | 各記事にHigh/Medium/Lowバッジがimportanceと同一ソース（IMPORTANCE_ORDERと同じフィールド）から導出されて表示される（D-08配色） | VERIFIED | `importanceBadgeHtml`/`importanceColor` (L18-29) が `CuratedArticle["importance"]` を単一ソースとして使用。テスト `CURA-07` で色コード `#ef4444`/`#f59e0b`/`#6b7280` を確認、実行して緑 |
| 5 | 各記事に会社名併記（D-04）のティッカーピル（D-09 リンクなし）が表示され、社名欠落時はシンボルのみにフォールバックする | **FAILED** | フォールバック文言のテキスト自体（`"NVDA エヌビディア"`, `>AAPL<`）はテストで確認できるが、`.ticker-pill`/`.news-meta` の CSS が `report-utils.ts` に一切定義されていない（`grep -rn "ticker-pill\|news-meta" src/` → 定義0件・参照2件）。複数ティッカーを持つ記事で直接レンダリングを実行したところ `<span class="ticker-pill">NVDA エヌビディア</span><span class="ticker-pill">MSFT マイクロソフト</span>` が区切りなしで連結され、スタイルが一切当たらないため視覚的に「ピル」を構成しない。既存テスト12件は全記事が単一ティッカーのみのフィクスチャで、この欠陥を検出できない |
| 6 | ページ冒頭に「今日の市場を動かすもの」リード文が表示される（CURA-09） | VERIFIED | `formatLeadInHtml` (L94-100)。テスト `CURA-09` で `leadIn` の出現位置が `米国株` セクション見出しより前であることを確認、緑 |
| 7 | curationがnullの場合（D-12）と articlesが空配列の場合（D-06）で、区別された文言のグレースフルなフルHTMLページが返る（0件市場グループも見出し常時表示, D-06） | VERIFIED | `generateNewsDigestHtml` の3分岐 (L122-148)：null→「生成できませんでした」、空配列→「厳選記事なし」、通常時→0件市場グループでも `<h2>` + 「本日の該当記事なし」を常時出力 (L84-92)。3系統のテストすべて緑（null / 空配列 / グローバル0件） |
| 8 | 既存3レポートと同じダークテーマCSS・モバイル対応が適用され、ページ内ナビは追加しない（D-11）。タイトルは英語+日本語副題（D-13）。UI-03の「レポート間ナビゲーション」= index.html経由のみという既存構造を踏襲 | VERIFIED | `generateBaseStyles("#8b5cf6")` を他3レポートと同一関数で呼び出し（L123）、`@media (max-width: 768px)` 含む共通CSSをそのまま再利用。`generate-portfolio-report.ts`/`generate-daily-report.ts`/`generate-meeting-minutes.ts` を grep したところ、いずれもレポート間の in-page nav バーは存在せず、ナビは `update-index.ts` が生成する `index.html` の `report-links` 経由のみ — news-digest.html も同構造（新規 nav バーなし）で一致。タイトルは `<title>News Digest - date</title>` + `<h1>` 内に日本語副題「AI厳選ニュースダイジェスト」を確認 (L109, L114) |

**Score:** 7/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/scripts/generate-news-digest.ts` | `generateNewsDigestHtml(curation, date): string` ピュア関数レンダラー、90行以上 | ✓ VERIFIED | 148行、named export確認、`export function generateNewsDigestHtml` (L122) |
| `src/scripts/generate-news-digest.test.ts` | CURA-03/04/06/07/08/09 + UI-03 の5ケース以上のユニットテスト | ✓ VERIFIED | 12 it ブロック、全カテゴリ網羅（正常系/null/空配列/0件市場グループ/社名欠落/不正スキーム） |
| `src/meeting/types.ts` | `CuratedArticle.tickerNames?` オプショナルフィールド | ✓ VERIFIED | L136 `readonly tickerNames?: Readonly<Record<string, string>>;` |
| `src/meeting/schemas.ts` | `curatedArticleRawSchema.tickerNames` + `resolveNewsCuration` 透過 | ✓ VERIFIED | L208 schema定義、L278 `resolved.push` 内 `tickerNames: item.tickerNames` |
| `src/scripts/report-utils.ts` | `ACCENT_VARIANTS["#8b5cf6"]` エントリ | ✓ VERIFIED | L5 `"#8b5cf6": { light: "#a78bfa", lighter: "#c4b5fd" }` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `generate-news-digest.ts` | `report-utils.ts` | `import { escapeHtml, generateBaseStyles } from "./report-utils.js"` | ✓ WIRED | L1、両関数とも実際に呼び出されている（L34, L55, L72他, L123） |
| `generate-news-digest.ts` | `meeting/types.ts` | `import type { NewsCuration, CuratedArticle } from "../meeting/types.js"` | ✓ WIRED | L2、型として全関数シグネチャで使用 |
| 見出しリンク href | escapeHtml + rel=noopener | 全補間箇所を escapeHtml、target=_blank に rel="noopener noreferrer" | ✓ WIRED | L71-73、テスト `CURA-03` で `&amp;` エスケープと `rel="noopener noreferrer"` 出現を確認、緑 |
| `schemas.ts resolveNewsCuration` | `CuratedArticle.tickerNames` | `resolved.push` に `tickerNames: item.tickerNames` | ✓ WIRED | L278、schemas.test.ts のtickerNames透過テスト2件で緑を確認 |

### Data-Flow Trace (Level 4)

`generateNewsDigestHtml` はピュア関数（I/O なし）であり、Phase 17（パイプライン統合）でのみ実データが接続される設計（PLAN 16-02 objective に明記）。本フェーズの成果物単体では該当なし — レンダラーへの入力は全てテストfixtureで、実データソース（キュレーションAgent出力）への接続はPhase 17スコープのため未接続で正しい。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 単一ティッカー記事のピルテキスト表示 | `npx vitest run src/scripts/generate-news-digest.test.ts` | 12/12 pass | ✓ PASS |
| 複数ティッカー記事のレンダリング（テストで未カバーの経路を直接実行） | `npx tsx -e '...generateNewsDigestHtml(multiTickerFixture, date)...'` | `<span class="ticker-pill">NVDA エヌビディア</span><span class="ticker-pill">MSFT マイクロソフト</span>`（CSS未定義・区切りなし） | ✗ FAIL — WR-01の欠陥を実データで確認 |
| 契約層+レンダラー層の全テスト（36件） | `npx vitest run src/scripts/generate-news-digest.test.ts src/meeting/schemas.test.ts src/scripts/report-utils.test.ts` | 36/36 pass | ✓ PASS |
| 全体テストスイート回帰確認 | `npx vitest run` | 178/178 pass | ✓ PASS（Phase 15以前の回帰なし） |
| 型チェック | `npx tsc --noEmit` | 対象外ファイル (finnhub.ts, collect-data.test.ts) にのみ既存の pre-existing エラーが残存、Phase 16ファイルはエラー0 | ✓ PASS（deferred-items.md記載の既存問題と一致、Phase 16スコープ外） |

### Probe Execution

Step 7c: SKIPPED（本プロジェクトに `scripts/*/tests/probe-*.sh` 相当のprobeは存在せず、PLAN/SUMMARYもprobeを宣言していない）

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CURA-03 | 16-02 | 見出し・ソース名・公開時刻・元記事へのリンク | ✓ SATISFIED | Truth #1 |
| CURA-04 | 16-02 | 日本語「なぜ重要か」解説コメント | ✓ SATISFIED | Truth #2 |
| CURA-06 | 16-02 | グループ内重要度順配列 | ✓ SATISFIED | Truth #3 |
| CURA-07 | 16-02 | 重要度バッジ（同一スコアから導出） | ✓ SATISFIED | Truth #4 |
| CURA-08 | 16-01, 16-02 | 関連ティッカータグ表示 | ✗ **BLOCKED** | Truth #5 — テキストは表示されるが「タグ/ピル」としてのUI要件（D-09）を満たさず、CSS未定義・複数ティッカー時に可読性が崩壊 |
| CURA-09 | 16-02 | 冒頭リード文 | ✓ SATISFIED | Truth #6 |
| UI-03 | 16-02 | 既存3レポート同一ダークテーマ・モバイル対応・レポート間ナビゲーション | ✓ SATISFIED | Truth #8 |

REQUIREMENTS.md 側の Phase 16 マッピング（CURA-03/04/06/07/08/09, UI-03）は全て16-01/16-02いずれかのPLAN frontmatterの`requirements`に宣言されており、オーファン要件なし。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/scripts/generate-news-digest.ts` | 49-58, 77-81 | `.ticker-pill`/`.news-meta` CSSクラス未定義（既存 code review WR-01 と同一） | 🛑 Blocker（must-have未達） | CURA-08/D-09のピルUIが視覚的に機能しない。複数ティッカー記事で連結テキスト化 |
| `src/scripts/generate-news-digest.ts` | 31-42 | `formatPublishedAtJst` が不正な `publishedAt` 入力で "Invalid Date" をそのまま出力（既存 code review WR-02） | ⚠️ Warning | 収集系の欠損データが到達した場合のみ発現。現行の正常系入力では発生しない。must-have自体は正常入力で満たされているためBLOCKERとはしないが、Phase 15/16のグレースフルデグラデーション方針との不整合として記録 |
| `src/scripts/generate-news-digest.ts` | 94-100, 146 | `leadIn` が空文字でも見出しのみの空カードが描画される（既存 code review IN-04） | ℹ️ Info | 現行契約では `leadIn` は必須文字列（空文字はzodデフォルト補完時のみ発生）。CURA-09の中核体験には影響しない |
| — | — | TBD/FIXME/XXX デットマーカー | なし | — | Phase 16変更ファイル全体を grep、0件 |

WR-01のみ、Phase 16のmust-have（Truth #5, CURA-08）を直接ブロックするためBlocker（gapsに計上）とした。WR-02/IN-01〜IN-06は code review (16-REVIEW.md) に既出の非ブロッキング事項であり、本検証でもBlocker要件には該当しないと判断した（WR-02は異常系入力時のみ発現、正常系のmust-haveは満たされている）。

### Human Verification Required

なし。ティッカーピルの視覚欠陥はブラウザ確認を待たず、CSSクラス定義の不在という静的事実（grep）と実際のレンダリング出力（直接実行）の両方で機械的に確認済みのため、人間による目視確認を追加で要求する必要はない。

### Gaps Summary

Phase 16 の中核である「記事一覧・市場別グルーピング・重要度・リード文・ダークテーマでの描画」は堅牢に実装されており、7/8のmust-have truthsとCURA-03/04/06/07/09・UI-03はすべて実データ・実テストで裏取りできた。既存3レポートとの回帰もなし（178/178テスト緑）。

唯一のブロッキング欠陥は **CURA-08（関連ティッカータグ表示）** の視覚的成立: `formatTickerPillsHtml` が生成する `<span class="ticker-pill">` に対応するCSS定義が `report-utils.ts` のどこにも存在せず、`.news-meta` も同様。結果、ティッカー情報はテキストとしては出力されるものの「ピル」というUI要件（16-02-PLAN must_haves 明記）を満たさず、さらに1記事に複数ティッカーがある場合は区切り文字なしで連結され実用上判読不能になることを実データで直接確認した。既存の12件のテストは全記事が単一ティッカーのみのフィクスチャで構成されているため、この欠陥をすり抜けている。

この欠陥は code review（16-REVIEW.md WR-01）で既に指摘済みだが、SUMMARY.md はこれを「Warning」として処理し完了扱いにしていた。goal-backward の観点では、CURA-08 と 16-02-PLAN の must_have 文言（「ティッカーピル...が表示され」）がそのまま未達であるため、本検証では Blocker として扱う。

**推奨対応**: `.ticker-pill`/`.news-meta` のCSS定義を `generateBaseStyles` に追加し、複数ピル間に区切り（margin-rightまたはjoin区切り文字）を入れる小規模な修正で解消可能。新規プラン不要、フェーズ内の追補コミットで対応可能な規模。

---

_Verified: 2026-07-02T15:54:00+09:00_
_Verifier: Claude (gsd-verifier)_
