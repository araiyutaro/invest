---
phase: 22-portfolio-analyst-re-evaluation
plan: 02
subsystem: prompt-orchestration
tags: [invest.md, claude-code-prompt, portfolio-analyst, prompt-injection-defense, alias-transform]

# Dependency graph
requires:
  - phase: 19-data-foundation-holding-news-supply
    provides: "tmp/holding-news.json 供給パイプと保有銘柄別ニュース条件付きセクションの前例（D-07/D-11/D-12）"
  - phase: 21-portfolio-websearch-research
    provides: "tmp/portfolio-research/{symbol}.json（WebSearchResult形状: researchSummary/positiveFindings/negativeFindings/keyArticles）"
provides:
  - "Step 3d 冒頭の前日ポートフォリオ判断退避スニペット（tmp/portfolio-analysis.json → tmp/prev-portfolio-analysis.json、portfolio-analyst 上書き前に実行）"
  - "条件付き保有銘柄別リサーチ結果セクション（researchSummary/positiveFindings/negativeFindingsのみ、keyArticles非注入、全12銘柄列挙+失敗銘柄明示、プロンプトインジェクション注意書き付き）"
  - "条件付き前日判断セクション（判断基準の後・JSONフォーマット指示の前に配置、independent-then-compare構成でアンカリング対策）"
  - "urgent boolean 出力契約（JSON例・フィールド名ルール・乱発防止指示・riskNote理由記載指示）"
  - "rationale 明示言及指示 + 文字数上限200→300拡大"
affects: [22-03-decision-diff-and-schema, 22-04-loader-renderer-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "前日スナップショット退避は ANLQ-01 の node -e パターンをそのまま踏襲（try/catch で失敗時は前日データなしログのみ、throwしない）"
    - "条件付きプロンプトセクションは既存の holding-news 規約（（ファイル/ディレクトリが存在する場合のみ以下を含めること）...（存在しない場合は省略）+ 独立したプロンプトインジェクション注意書き）を新規2セクションにも適用"

key-files:
  created: []
  modified:
    - .claude/commands/invest.md

key-decisions:
  - "prev-portfolio-analysis.json 退避スニペットは Step 3d 見出し直後・読み込みリスト直前に配置し、portfolio-analyst が今日のtmp/portfolio-analysis.jsonを上書きする前に必ず実行される順序を担保（D-12）"
  - "リサーチセクションは keyArticles/URL を一切埋め込まない（D-02、幻覚URL防止の既存規約を踏襲）"
  - "前日判断セクションはプロンプト末尾（判断基準の後）に配置し、independent-then-compare指示でアンカリングバイアスを軽減（D-05）"
  - "urgent はLLM出力・省略時false、乱発防止指示とriskNote理由記載指示を併記（D-08/D-09）。decisionChanged/previousDecisionはTS側計算のためJSONフォーマット例に一切追加しない（D-11、22-03の責務）"

patterns-established:
  - "invest.md への条件付きセクション追加時は、既存3ブロックの「重要:」プロンプトインジェクション注意書きパターンを新セクションにも複製する"

requirements-completed: [PORT-03, PORT-04, PORT-05]

# Metrics
duration: 5min
completed: 2026-07-03
---

# Phase 22 Plan 02: Portfolio-Analyst Prompt Re-Evaluation Summary

**invest.md Step 3d に前日判断スナップショット退避・保有銘柄別リサーチ結果セクション・前日判断セクション・urgent出力契約を追加し、rationale明示言及とindependent-then-compare構成でアンカリング対策を施した**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-03T20:41:23+09:00
- **Completed:** 2026-07-03T20:45:43+09:00
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Step 3d 冒頭に ANLQ-01 前例を踏襲した前日ポートフォリオ判断退避スニペット（tmp/portfolio-analysis.json → tmp/prev-portfolio-analysis.json）を挿入し、portfolio-analyst の上書き前に必ず実行される順序を確立（PORT-05）
- 保有銘柄別リサーチ結果の条件付きセクションを追加。researchSummary/positiveFindings/negativeFindingsのみを展開し、keyArticles/URLは非注入（幻覚URL防止）、全12銘柄列挙+失敗銘柄の明示、プロンプトインジェクション注意書きを付与（PORT-03）
- 前日判断セクションを判断基準の後・JSONフォーマット指示の前（プロンプト末尾）に配置し、independent-then-compare構成でアンカリングバイアスを軽減（PORT-05）
- urgent boolean フィールドをJSON出力契約に追加。乱発防止指示・riskNote理由記載指示・フィールド名ルールへの追記を実施し、rationale上限を200→300文字へ拡大し明示言及指示を追加（PORT-04/PORT-03）

## Task Commits

Each task was committed atomically:

1. **Task 1: 前日判断スナップショット退避スニペットを Step 3d 冒頭へ追加（D-12）** - `af8f334` (feat)
2. **Task 2: リサーチ結果セクション + 前日判断セクション + urgent 契約を Step 3d プロンプトへ追加** - `4fde0a6` (feat)

_Note: 本プランは markdown プロンプト編集のみのためTDDタスクなし（invest.md はvitestハーネス外）。_

## Files Created/Modified
- `.claude/commands/invest.md` - Step 3d（portfolio-analystプロンプト）に前日退避スニペット、リサーチ結果セクション、前日判断セクション、urgent契約を追加

## Decisions Made
- 前日判断スナップショット退避はANLQ-01（prev-highlighted-stocks.json）のnode -eパターンをそのまま流用し、try/catchで失敗時は「前日データなし」ログのみでスキップ（throwしない）
- リサーチセクション・前日判断セクションともに既存holding-newsセクションの条件付き注入規約（存在時のみ含める/存在しない場合は全体省略）を踏襲
- decisionChanged/previousDecisionはTS側（22-03の責務）で計算するため、本プランのJSONフォーマット例には一切追加しない（D-11のLLM自己申告禁止方針を維持）

## Deviations from Plan

None - plan executed exactly as written. 22-PATTERNS.md はこのworktree内には存在しなかったため、メインリポジトリのパス（.planning/phases/22-portfolio-analyst-re-evaluation/22-PATTERNS.md）から直接読み込んで確定文面案を踏襲した（read-only参照であり、worktree外への書き込みは発生していない）。

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- invest.md 側のプロンプト契約（urgent フィールド、prev-portfolio-analysis.json ハンドオフ、リサーチ/前日判断セクション）が確定し、22-01（型/スキーマ）・22-03（decision-diff計算）・22-04（ローダー/レンダラー配線）が参照できる状態になった
- 22-03 は tmp/prev-portfolio-analysis.json を portfolioAnalysisSchema で読み取り、attachDecisionChanges で decisionChanged/previousDecision を計算する実装に進める
- ライブ実行でのrationale実言及・条件付きセクション動作の確認は22-HUMAN-UAT.mdで追跡（D-07、静的検証では確認不能）

---
*Phase: 22-portfolio-analyst-re-evaluation*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created/modified files and commit hashes verified present.
