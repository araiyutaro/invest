# Phase 18: Index/Nav Integration & Validation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

`src/scripts/update-index.ts` を拡張し、index.html の各日付エントリに `news-digest.html` へのリンクをファイル実在時のみ出し分ける。当日エントリだけでなくパース済みの全既存エントリ（約109件）を毎回再スキャンして fs 実在から導出するため、過去日付の欠落（例: 2026-07-03 の実在ファイルにリンクなし）も自動的に自己修復される。既存3レポートリンクの描画ロジックは無変更で回帰なしを検証する。TDDユニットテスト + `update-index.ts` 単体ライブ実行での実機確認まで本フェーズに含む。対象要件: UI-04（v2.4最終フェーズ）。

キュレーション・レンダリング・パイプライン統合（Phase 15〜17完了済み）、index.html のデザイン/CSS変更、v2.4マイルストーン監査そのものは含まない。

</domain>

<decisions>
## Implementation Decisions

### 実在チェックの適用範囲（遡及反映）
- **D-01:** `updateIndexHtml()` は実行のたびに、パース済みの**全エントリ**に対して `docs/{date}/news-digest.html` の fs 実在チェックを行う（forward-only 不採用）。約109件の existsSync コストは無視できる。冪等・自己修復的で、Phase 17 ライブ実行で生成済みの 2026-07-03 の欠落リンクも次回実行で自動反映される。一回限りのマイグレーションスクリプトは作らない。
- **D-02:** news-digest リンクは**毎回 fs から完全導出**する。実在→付与、不在→除去。パース結果に含まれる news-digest リンクは信用せず上書きする（ファイルが消えればリンクも消える。404リンクの残存余地を構造的に排除）。
- **D-03:** 既存3レポートリンク（daily-report / meeting-minutes / portfolio-report）には実在チェックを**広げない**。従来通りパース保存（過去エントリ）/ 固定生成（当日エントリ）のまま。変更面積を news-digest に限定し、成功基準3「既存ロジックに回帰なし」に忠実。

### リンクの見せ方
- **D-04:** リンクラベルは **"News Digest"**（英語）。既存の Daily Report / Meeting Minutes / Portfolio Report と統一し、Phase 16 D-13 のページタイトル「News Digest - YYYY-MM-DD」とも一致。
- **D-05:** 配置は**末尾（4番目）**: Daily Report / Meeting Minutes / Portfolio Report / News Digest。加法的でレイアウトを乱さず、リンクなしの過去日付との見た目差分も最小。
- **D-06:** ヒーローブロック（最新レポート枠）にも News Digest リンクを表示する。`renderEntryLinks()` がヒーローとアコーディオンで共有されているため専用分岐は追加しない（最新日は Phase 17 D-08 によりファイル常時実在のため404リスクなし）。
- **D-07:** News Digest リンクは**他リンクと同じ見た目**。index.html への CSS 追加・変更は行わない（パープル強調不採用。OPS-02 チェックサム保護下の docs HTML への変更を最小化）。

### 検証（Validation）
- **D-08:** 検証は**ユニットテスト + ライブ実行**の2段構え。TDD で `update-index.test.ts` に「実在→リンク付与」「不在→リンクなし」「パース済みリンクの除去（fs不在時）」「既存3リンクの保存」ケースを追加したうえで、実機で index.html への反映を確認する。
- **D-09:** 成功基準2（生成されなかった日はリンクなし）の実環境確認は、news-digest.html を持たない**既存の約108日分の過去エントリで自然検証**する。意図的な失敗注入・ファイル一時退避は行わない。
- **D-10:** ライブ検証は **`update-index.ts` の単体実行**（`npx tsx src/scripts/update-index.ts`、tmp/meeting-result.json が存在する状態）で行う。フル `/invest` 再実行はしない（パイプライン自体は Phase 17 で実証済み、本フェーズの変更は update-index.ts のみ）。翌朝の launchd 自動実行が自然な E2E となる。

### Claude's Discretion
- 実在チェックの実装詳細（`existsSync` 同期 vs `access` 非同期、チェック関数の切り出し方・命名）— 既存コードの慣例に従う
- テストにおける fs 依存の扱い（テンポラリディレクトリ fixture vs 実在チェック関数の注入）— 既存 `update-index.test.ts` の慣例に従う
- 当日エントリの構築方式（`buildStandardLinks` に条件付き4本目を足すか、全エントリ共通の導出パスに統一するか）— D-01/D-02 を満たす限り自由
- ライブ検証後の docs/index.html のコミット・デプロイの扱い（既存の deploy 慣例に従う）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 変更対象（本フェーズの中心ファイル）
- `src/scripts/update-index.ts` — index.html/portfolio.html 更新ロジック。`parseExistingEntries` / `mergeEntry` / `buildRegion` / `renderEntryLinks` / `buildStandardLinks`（3リンク固定、拡張点）。REPORT_ENTRIES マーカー間のみ書き換える設計
- `src/scripts/update-index.test.ts` — 既存ユニットテスト（TDD追加先、fixture 慣例の手本）

### 上流の前提（Phase 17 の決定 — 本フェーズの条件分岐の意味を規定）
- `.planning/phases/17-pipeline-integration-orchestration/17-CONTEXT.md` — D-08: 失敗日も news-digest.html はフォールバックページとして常時書き出し → 今後の日付はリンク常時有効、条件分岐は主に v2.4 以前の過去日付向け。D-10: write-news-digest.ts は update-index.ts 実行前に走る
- `src/scripts/write-news-digest.ts` — news-digest.html の書き出し元（実在チェック対象ファイルの生成者）

### 統合先パイプライン
- `.claude/commands/invest.md` — Step 4 deploy 内の `npx tsx src/scripts/update-index.ts` 呼び出し（1856行付近）。update-index 失敗時は `[STEP:deploy:FAIL]` → `[PIPELINE:FAIL]` の hard-fail（news-digest の fail-soft とは異なる、既存挙動を維持）
- `docs/index.html` — 直接編集禁止（invest.md 冒頭ルール）。エントリ追加は update-index.ts 経由のみ。OPS-02 SHA256 チェックサム保護の対象

### v2.4 リサーチ
- `.planning/research/SUMMARY.md` — Phase 4（本フェーズ相当）の推奨アプローチと Pitfall（条件付きリンクの根拠）
- `.planning/research/PITFALLS.md` — ピットフォールの行レベル根拠

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseExistingEntries()`: 既存エントリのリンク集合を「3本固定と仮定せず」パースする実装済み関数 — 4本目追加と後方互換
- `renderEntryLinks()` / `renderHero()` / `renderAccordion()`: ヒーローとアコーディオンでリンク描画を共有 — D-06 は無改修で成立
- `mergeEntry()`: 同一日付は new wins — 当日エントリの再実行は安全
- `escapeHtml()`（report-utils.ts）: href/ラベルのエスケープ慣例
- vitest + `update-index.test.ts` の既存テスト基盤

### Established Patterns
- 日付は `tmp/meeting-result.json` の `date` を正とする（`getDate()`）
- 単一 readFile → 単一 writeFile（部分書き込みなし、OPS-02 チェックサム保護と整合）
- readonly / ReadonlyArray、イミュータブル操作（`[...entries].sort()`）
- update-index.ts の失敗はパイプライン hard-fail（deploy ステップの一部。news-digest 生成の fail-soft とは別レイヤー）

### Integration Points
- `buildStandardLinks(date)`: 当日エントリの3リンク固定生成 — news-digest 条件付き4本目の導出点（または全エントリ共通導出への統一点）
- `updateIndexHtml()` 内の merge 後・render 前: 全エントリへの fs 実在チェック適用点（D-01/D-02）
- `docs/{date}/news-digest.html`: 実在チェック対象パス（DOCS_DIR 基準）
- invest.md Step 4: 呼び出し箇所は無変更（引数・実行順は現状維持）

</code_context>

<specifics>
## Specific Ideas

- 「実在すればリンクが付き、消えればリンクも消える」自己修復的な冪等設計を明確に選好 — 一回きりの補正やパース結果への依存より、毎回 fs を真実の源とする
- 変更面積の限定を重視 — 既存3リンク・index.html の CSS・invest.md の呼び出しには触れない
- ライブ検証はコスト意識的に最小構成（update-index 単体実行）とし、翌朝の launchd 自動実行を自然な E2E と位置づける

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-Index/Nav Integration & Validation*
*Context gathered: 2026-07-03*
