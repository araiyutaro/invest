---
phase: 04-gemini-cleanup
plan: "01"
subsystem: dependency-cleanup
tags: [gemini, cleanup, npm, typescript]
dependency_graph:
  requires: []
  provides: [gemini-free-codebase]
  affects: [package.json, src/data/, src/scripts/, scripts/run.sh]
tech_stack:
  added: []
  patterns: [file-deletion, npm-uninstall, worktree-cherry-pick]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - scripts/run.sh
  deleted:
    - src/gemini.ts
    - src/data/charts.ts
    - src/data/research.ts
    - src/data/news.ts
    - src/data/news/analyzer.ts
    - src/meeting/runner.ts
    - src/report/generator.ts
    - src/report/portfolio-generator.ts
    - src/index.ts
    - src/portfolio/runner.ts
decisions:
  - "src/data/news.ts も削除対象に追加（Rule 1 - Bug: analyzer.js への参照でtscエラー）"
  - "package.json から 'start' スクリプトも削除（削除済み src/index.ts を参照）"
  - "Task 1 コミットを master に誤って行ったため cherry-pick でworktreeブランチに取り込み"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-25"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 13
---

# Phase 4 Plan 01: Gemini Cleanup — Remove Gemini API Dependencies Summary

Gemini API に関連する全ファイル・パッケージ・環境変数参照をコードベースから完全除去し、tsc コンパイル成功・全テスト PASS の状態を達成。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Gemini依存ファイル削除 | f38b327 | 9ファイル削除 (gemini.ts, charts.ts, research.ts, runner.ts×2, generator.ts×2, analyzer.ts, index.ts) |
| 2 | npm パッケージ削除 + run.sh 更新 | 6bdfe6a | package.json, package-lock.json, scripts/run.sh |
| 3 | TypeScript コンパイル + テスト検証 | f32f8cf | src/data/news.ts 削除 (偏差 Rule 1) |

## Verification Results

- `@google/generative-ai` `@google/genai` — package.json から除去 PASS
- `GEMINI_API_KEY` 参照 — src/ 配下ゼロ件 PASS
- `npx tsc --noEmit` — エラーなし PASS
- `npm test` — 23 tests / 3 files 全 PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] src/data/news.ts の残存による tsc エラー**
- **Found during:** Task 3 (TypeScript コンパイル確認)
- **Issue:** `src/data/news.ts` が削除済みの `./news/analyzer.js` を import しており、`npx tsc --noEmit` でエラー発生
- **Fix:** `src/data/news.ts` を削除（v1.0専用ファイル、v2.0の collect-data.ts は news/* を直接 import）
- **Files modified:** src/data/news.ts (deleted)
- **Commit:** f32f8cf

**2. [Rule 1 - Bug] package.json の 'start' スクリプト残存**
- **Found during:** Task 2 (package.json 確認)
- **Issue:** `"start": "tsx src/index.ts"` が削除済み src/index.ts を参照
- **Fix:** package.json の 'start' スクリプトエントリを削除
- **Files modified:** package.json
- **Commit:** 6bdfe6a

**3. [Process] Task 1 コミットを誤って master ブランチに作成**
- **Found during:** Task 3 実行時の git log 確認
- **Issue:** `cd /Users/arai/invest` で main リポジトリにコミットしてしまい、worktree ブランチに反映されていなかった
- **Fix:** `git cherry-pick ba01275` で worktree ブランチに取り込み
- **Impact:** tsc エラーの直接原因（削除済みファイルが worktree 上に残存していた）

## Known Stubs

None — all deleted files were v1.0 only. No stub data flows to UI.

## Threat Flags

None — this plan only removes code; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/gemini.ts deleted: PASS
- src/data/charts.ts deleted: PASS
- src/data/news.ts deleted: PASS
- src/data/news/analyzer.ts deleted: PASS
- Commit f38b327 exists: PASS
- Commit 6bdfe6a exists: PASS
- Commit f32f8cf exists: PASS
- SUMMARY.md exists: PASS
