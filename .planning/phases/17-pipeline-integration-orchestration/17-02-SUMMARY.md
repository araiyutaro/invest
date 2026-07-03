---
phase: 17-pipeline-integration-orchestration
plan: 02
subsystem: pipeline
tags: [claude-agent, invest.md, fail-soft, news-curation, orchestration]

# Dependency graph
requires:
  - phase: 17-01
    provides: write-news-digest.ts CLIオーケストレーター（正常/欠損/不正の3シナリオ対応、exit code シグナル）
provides:
  - Step 3d に news-curator（opus）を portfolio-analyst と2体並列で追加（D-01〜D-07）
  - Step 3e 新設: write-news-digest.ts の fail-soft 起動と専用STEPマーカー（D-08〜D-10）
  - pipeline-metrics.json / タイミング表への news-digest 計測行追加（D-11）
  - resolveNewsCuration の数値ticker混入バグ修正（TDD、Rule 1）
affects: [phase-18-index-nav-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "並列Agentヘッダの拡張パターン: 「N つの Agent ツールを同時に」文言をN更新して2体目を追記"
    - "fail-softステップの専用STEPマーカー: [STEP:news-digest:OK]/[STEP:news-digest:FAIL:...]、[PIPELINE:FAIL]は絶対に流用しない"
    - "プロセス境界分離: news-digest生成は既存3レポートのPromise.allと別プロセス(npx tsx)起動で失敗が波及しない"

key-files:
  created: []
  modified:
    - .claude/commands/invest.md
    - src/meeting/schemas.ts
    - src/meeting/schemas.test.ts

key-decisions:
  - "news-curatorのモデルはportfolio-analystと同格のopusを採用（D-02）"
  - "news-curatorへの記事プールはURL以外の全フィールド（id+title+summary+source+publishedAt+ticker）のみ渡し、ID参照方式でURL幻覚を防止（D-03）"
  - "news-digest失敗は[PIPELINE:FAIL]を出さずStep 4へ継続するfail-soft設計を徹底（Pitfall 1回帰防止）"

patterns-established:
  - "既存hard-fail文言（パイプラインを停止してください/[PIPELINE:FAIL]）をfail-softステップに絶対流用しない、という判別ルール"

requirements-completed: [CURA-01, OPS-04]

# Metrics
duration: 継続実行（Task1-2は前セッション、Task3検証は2026-07-03に実施）
completed: 2026-07-03
---

# Phase 17 Plan 02: invest.md への news-curator 統合と fail-soft 配線 Summary

**Step 3d に news-curator（opus, 2体並列）を追加し、Step 3e で write-news-digest.ts を fail-soft 起動して news-digest.html を4紙目として自動生成する日次パイプライン配線をライブ検証まで完了**

## Performance

- **Tasks:** 3 (Task 1, Task 2 は auto、Task 3 は checkpoint:human-verify)
- **Files modified:** 3 (.claude/commands/invest.md, src/meeting/schemas.ts, src/meeting/schemas.test.ts)

## Accomplishments
- Step 3d が portfolio-analyst と news-curator を1メッセージで2体並列起動するよう拡張（D-01〜D-07 全充足）
- Step 3e を新設し、write-news-digest.ts の exit code に応じて `[STEP:news-digest:OK]` / `[STEP:news-digest:FAIL:...]` を出し分け、`[PIPELINE:FAIL]` を出さずにパイプラインを継続する fail-soft 設計をライブ実証（D-08〜D-10）
- pipeline-metrics.json とタイミング表に news-digest 計測行を追加（D-11）
- ライブ `/invest` 実行で news-digest.html が4紙目として実際に生成・デプロイされることを確認（CURA-01）
- 検証中に発見した resolveNewsCuration の数値ticker混入バグを TDD で修正（vitest 183/183 green）

## Task Commits

Each task was committed atomically:

1. **Task 1: Step 3d に news-curator を2体目の並列Agentとして追加** - `a3c4fd9` (feat)
2. **Task 2: Step 3e 新設（write-news-digest.ts fail-soft起動・STEPマーカー・metrics/timing）** - `00f1751` (feat)
3. **Task 3: /invest ライブ実行と fail-soft の人手検証** - checkpoint:human-verify → approved（コード変更なし。検証中に発見したバグ修正は以下の逸脱コミット参照）
   - `5ba07f3` test(17): add failing test for numeric pool ticker in resolveNewsCuration (RED)
   - `d56aab7` fix(17): exclude numeric pool tickers when merging in resolveNewsCuration (GREEN)
   - `286806e` report: 2026-07-03 daily update（ライブ /invest 実行によるデプロイ成果物、news-digest.html を含む4レポート）

**Plan metadata:** (this commit) `docs(17-02): complete invest.md fail-soft wiring plan`

## Files Created/Modified
- `.claude/commands/invest.md` - Step 3d に news-curator（opus, 2体並列, ID参照方式）を追加。Step 3e 新設（write-news-digest.ts fail-soft起動、[STEP:news-digest:OK/FAIL]マーカー、metrics/タイミング表への計測行）
- `src/meeting/schemas.ts` - resolveNewsCuration が記事プールの ticker をマージする際、数値混入を除外する型ガードを追加（文字列かつ非空の場合のみマージ）
- `src/meeting/schemas.test.ts` - 数値プールticker混入の失敗テストを追加（RED→GREEN確認済み）

## Decisions Made
- news-curatorのモデルはportfolio-analystと同格のopusを採用（D-02、品質担保）
- news-curatorへの記事プールはURL以外の全フィールドのみ渡し、ID参照方式を徹底（D-03、URL幻覚防止）
- news-digest失敗時は既存report-generation/deployのhard-fail文言（「パイプラインを停止してください」+ `[PIPELINE:FAIL]`）を絶対に流用しない設計を貫徹（RESEARCH.md Pitfall 1 の回帰防止）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resolveNewsCuration の数値ticker混入によるレンダラークラッシュを修正**
- **Found during:** Task 3（ライブ `/invest` 実行時、Step 3e 初回実行が実データで exit=1 となり発覚）
- **Issue:** Phase 15 実装の `resolveNewsCuration`（src/meeting/schemas.ts）が記事プールの `ticker` を無条件マージしていたが、finnhub 由来の merger/business 記事は `ticker` が数値インデックス（0〜9）を持ち、型宣言 `ticker?: string` と実データが不一致。数値が tickers 配列に混入し、レンダラーの `escapeHtml` が `text.replace is not a function` で失敗していた。
- **Fix:** ticker が文字列かつ非空の場合のみマージするよう型ガードを追加。TDD（RED→GREEN）で修正。
- **Files modified:** src/meeting/schemas.ts, src/meeting/schemas.test.ts
- **Verification:** `npx vitest run` 183/183 green。修正後の再ライブ実行で exit=0、news-digest.html（14記事、14KB）が正常生成された。
- **Committed in:** `5ba07f3`（RED）, `d56aab7`（GREEN）

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** ライブ検証がなければ発見できなかった実データ起因のバグ。修正はスコープ内（news-digest生成の正常動作に必須）。plan外の機能追加やスコープクリープなし。

## Issues Encountered
- resolveNewsCuration の数値ticker混入は静的解析・単体テスト（Phase 15時点）では検出されなかった。ライブ `/invest` 実行で finnhub 由来の実データ（merger/business記事の数値ticker）を通したことで初めて顕在化した。今後、Phase 15系のスキーマ変更時は実データパターン（特にfinnhub由来の非文字列フィールド）を意識したテストケース追加が望ましい。
- news-curator出力15記事中、存在しないID "n5" が1件混入したが、既存の `resolveNewsCuration` 設計どおり warn 付きで drop され14記事で正常描画された（想定通りの防御動作、逸脱ではない）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 17 完了。CURA-01（news-digest.htmlの4紙目自動生成）、OPS-04（fail-soft設計・専用STEPマーカー）ともにライブ検証済みで成立。
- ライブ検証エビデンス:
  1. fail-softスモーク: `tmp/news-curation.json` 不在で exit=1、フォールバックHTML生成、既存3レポート無影響（md5チェックサム比較で確認）
  2. 正常系スモーク: 有効な生JSONで exit=0、リード文＋記事カード描画
  3. ライブ `/invest`: フルパイプライン実行、Step 3d news-curator（opus）2体並列起動、Step 3e fail-soft起動、`[STEP:news-digest:OK]`/`[PIPELINE:OK]` マーカー確認、docs/2026-07-03/news-digest.html を含む4レポートをGitHub Pagesへデプロイ（commit 286806e）
  4. pipeline-metrics.json / タイミング表に「ニュースダイジェスト」計測行が表示された（D-11）
- Phase 18（Index/Nav Integration & Validation）に引き継ぎ: index.htmlへのnews-digest.htmlリンク追加（該当日付のみ条件付き表示、404防止）が次の作業対象。

---
*Phase: 17-pipeline-integration-orchestration*
*Completed: 2026-07-03*
