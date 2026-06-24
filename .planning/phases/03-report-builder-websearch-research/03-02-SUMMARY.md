---
phase: 03-report-builder-websearch-research
plan: 02
subsystem: report-generator
tags: [html-report, bloomberg-theme, tdd, vitest, xss-prevention]
dependency_graph:
  requires:
    - 03-01-SUMMARY.md
  provides:
    - generateHtml function
    - escapeHtml function
    - main() CLI entry for generate-report.ts
    - Bloomberg-style HTML report at reports/YYYY-MM-DD/daily-report.html
  affects:
    - .claude/commands/invest.md Step 3c (consume via npx tsx)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN flow (Vitest)
    - escapeHtml for XSS prevention (T-03-06 mitigation)
    - node:fs/promises readdir + readFile with Zod validation + graceful fallback
    - import.meta.dirname path pattern (Phase 1 established)
    - main().catch() CLI entry pattern
key_files:
  created:
    - src/scripts/generate-report.ts
    - src/scripts/generate-report.test.ts
  modified: []
decisions:
  - escapeHtml applied to all user-controlled text content (XSS prevention, T-03-06 mitigate)
  - loadWebSearchResults/loadReevalResults skip invalid JSON entries (graceful degradation)
  - WebSearch section omitted when results array is empty (no empty section)
  - Reeval section omitted when no changed=true entries exist
  - process.exit mock via vi.spyOn at module top level to prevent unhandled rejection in tests
metrics:
  duration: "2026-06-24"
  completed: "2026-06-24"
---

# Phase 3 Plan 02: Bloomberg-style HTML Report Generator Summary

Bloomberg風ダークテーマHTMLレポートジェネレータ `generate-report.ts` をTDDで実装。MeetingResult + WebSearchResult[] + ReevaluationOutput[] を統合し reports/YYYY-MM-DD/daily-report.html に出力する。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | generate-report テスト作成 | dad9844 | src/scripts/generate-report.test.ts |
| 2 (GREEN) | generate-report.ts 実装 | c9137ac | src/scripts/generate-report.ts (+test fix) |

## What Was Built

### Task 1: テスト (RED フェーズ)

**src/scripts/generate-report.test.ts** に10個のテストを作成:
- Test 1-2: generateHtml の基本動作とBloomberg CSS確認
- Test 3-6: 各セクション（marketOverview.summary, highlightedStocks, WebSearch, 再評価）の内容確認
- Test 7-8: 空配列のエッジケース
- Test 9: main() の fs mock 経由での書き出し確認
- Test 10: escapeHtml の特殊文字エスケープ確認

RED確認: 全10テストが "Cannot find module" で失敗。

### Task 2: 実装 (GREEN フェーズ)

**src/scripts/generate-report.ts** を新規作成:
- `escapeHtml()`: &, <, > をHTMLエンティティに変換（XSS防止、T-03-06）
- `markdownToHtml()`: v1.0 generator.ts から流用したMarkdown→HTML変換
- `HTML_STYLES`: Bloomberg風ダークテーマCSS (#0f0f1a, .agent-card, .discussion-card)
- `generateHtml()`: MeetingResult + WebSearchResult[] + ReevaluationOutput[] → 完全HTML文字列
- セクション順序: タイトル → 市場概況 → セクター推奨 → 注目銘柄スコアリング → WebSearch → 再評価 → リスク警告 → アクション → 週間イベント → インデックス投資アドバイス
- `loadWebSearchResults()`: tmp/websearch/*.json を読み込みZodバリデーション、失敗はスキップ
- `loadReevalResults()`: tmp/reeval/*.json を読み込みZodバリデーション、失敗はスキップ
- `main()`: meeting-result.json読み込み → レポート生成 → reports/{date}/daily-report.html 書き出し

GREEN確認: 全10テストPASS、`npx tsc --noEmit` エラーなし。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] テスト環境での unhandled rejection 修正**
- **Found during:** Task 2 テスト実行
- **Issue:** generate-report.ts のモジュールトップレベルで `main()` が呼ばれる際、`readFile` のデフォルトモックが `vi.fn()` (undefined返却) で `JSON.parse(undefined)` が失敗し、`process.exit(1)` が "unhandled rejection" を引き起こしていた
- **Fix:** テストファイルの `vi.mock("node:fs/promises")` で `readFile` のデフォルトを `mockRejectedValue(new Error("ENOENT"))` に変更し、`vi.spyOn(process, "exit").mockImplementation(...)` でトップレベルに追加
- **Files modified:** src/scripts/generate-report.test.ts
- **Effect:** 全10テストPASS、unhandled rejectionなし

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: xss_mitigated | src/scripts/generate-report.ts | escapeHtml() を全テキストコンテンツに適用してT-03-06 mitigateを実装済み |

## Self-Check: PASSED

- src/scripts/generate-report.ts 存在 ✓
- src/scripts/generate-report.test.ts 存在 ✓
- npm run test -- src/scripts/generate-report.test.ts → 10 passed ✓
- grep -c "export function generateHtml" → 1 ✓
- grep -c "REPORTS_DIR" → 2 (定義+使用) ✓
- grep -c "0f0f1a" → 1 ✓
- grep -c "agent-card" → 6 ✓
- grep -c "validateMeetingResult" → 2 (import+使用) ✓
- grep -c "readdir" → 3 ✓
- grep -c "process.exit(1)" → 1 ✓
- docs/ パスなし (grep = 0) ✓
- npx tsc --noEmit エラーなし ✓
- TDD RED commit (dad9844) → GREEN commit (c9137ac) の順序 ✓
