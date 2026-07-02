---
phase: 17-pipeline-integration-orchestration
plan: 01
subsystem: pipeline-orchestration
tags: [news-digest, fail-soft, cli-orchestrator, tdd]
dependency-graph:
  requires:
    - src/meeting/schemas.ts (validateRawNewsCuration, resolveNewsCuration, NewsArticlePoolEntry — Phase 15)
    - src/scripts/generate-news-digest.ts (generateNewsDigestHtml — Phase 16)
  provides:
    - src/scripts/write-news-digest.ts (main() CLI orchestrator, exports main for import)
  affects:
    - docs/{date}/news-digest.html (new output file per pipeline run)
tech-stack:
  added: []
  patterns:
    - "process-boundary fail-soft isolation (D-10): curation generation runs as a separate CLI process from generate-report.ts, decoupled by exit code"
    - "exit code as OK/FAIL signal, decoupled from file-write success (D-08/D-10, Pitfall 2)"
key-files:
  created:
    - src/scripts/write-news-digest.ts
    - src/scripts/write-news-digest.test.ts
    - .planning/phases/17-pipeline-integration-orchestration/deferred-items.md
  modified: []
decisions:
  - "vi.spyOn(process, \"exit\") をトップレベルではなく beforeEach 内で再設定する必要があった — afterEach の vi.restoreAllMocks() がスパイを毎テスト後に元に戻すため、2番目以降のテストで process.exit が実際に呼ばれてしまう"
metrics:
  duration: "~25min"
  completed: 2026-07-02
---

# Phase 17 Plan 01: write-news-digest.ts CLI Orchestrator Summary

薄い配線のみで構成される専用CLIスクリプト `src/scripts/write-news-digest.ts` を新規実装し、Phase 15の検証・ID解決関数と Phase 16 の描画関数を接続して `docs/{date}/news-digest.html` を書き出す fail-soft オーケストレーターを実現した。

## What Was Built

- **`src/scripts/write-news-digest.ts`**: `tmp/meeting-result.json` から信頼できる `date` を取得し、`tmp/news-curation.json`（LLM生成、信頼できない）を `validateRawNewsCuration` で構造検証、`tmp/news.json` をプールとして `resolveNewsCuration` でID解決、`generateNewsDigestHtml` でHTMLをレンダリングして `docs/{date}/news-digest.html` に書き出す。正常系は exit 0。curation欠損（ENOENT）または不正（enum/構造違反）の場合は内側 `catch` で `generateNewsDigestHtml(null, date)` によるフォールバックHTMLを**必ず**書き出したうえで `process.exit(1)` — 書き出し成功とcuration成功を混同しない（Pitfall 2）。既存 `generate-report.ts` は無改修。
- **`src/scripts/write-news-digest.test.ts`**: 正常系・curation欠損（ENOENT）・curation不正（enum違反）の3シナリオを `vi.mock("node:fs/promises")` でモックして検証。TDD RED→GREENサイクルで進行。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `process.exit` スパイのスコープ誤り**
- **Found during:** Task 2 (GREEN実装後の初回テスト実行)
- **Issue:** テストファイルのトップレベルで `vi.spyOn(process, "exit").mockImplementation(...)` を1回だけ設定していたが、各テストの `afterEach` で `vi.restoreAllMocks()` を呼んでいるため、1件目のテスト後にスパイが元の `process.exit` に復元されてしまい、2件目以降のテストで実際に `process.exit(1)` が呼ばれ `"process.exit unexpectedly called with 1"` エラーで失敗した（generate-report.test.ts の類似パターンには実際に exit を発生させるテストがなく、この問題が顕在化していなかった）。
- **Fix:** `collect-data.test.ts` の既存慣例（`beforeEach` 内で毎回 `vi.spyOn(process, "exit")` を再設定）に倣い、スパイ設定を `beforeEach` に移動。
- **Files modified:** `src/scripts/write-news-digest.test.ts`
- **Commit:** 829fe3d

### Out-of-Scope Items (logged, not fixed)

`npx tsc --noEmit` 実行時に、本プランが一切触れていないファイルで既存の型エラーが検出された:
- `src/data/news/finnhub.ts:43` — `.map()` コールバックの引数型不一致（`ticker` vs `index`）
- `src/scripts/collect-data.test.ts:297,299,358,360` — 暗黙 `any`

`git diff` で本プランのコミット前後にこれらのファイルへの変更が無いことを確認済み。スコープ境界ルール（現在タスクの変更が直接引き起こした問題のみ自動修正）に従い未修正、`.planning/phases/17-pipeline-integration-orchestration/deferred-items.md` に記録した。`write-news-digest.ts`/`write-news-digest.test.ts` 自体の型エラーは0件。

## TDD Gate Compliance

- RED gate: commit `9f15eb5` `test(17-01): add failing tests for write-news-digest main()` — `npx vitest run src/scripts/write-news-digest.test.ts` は import解決失敗で3件全て失敗（RED確認済み）
- GREEN gate: commit `829fe3d` `feat(17-01): implement write-news-digest.ts CLI orchestrator` — 3件全て通過
- REFACTOR: 該当なし（追加のリファクタリングコミットは発生していない）

Gate sequence verified in git log: test → feat の順序を確認済み。

## Verification Results

- `npx vitest run src/scripts/write-news-digest.test.ts`: 3/3 green
- `npx vitest run`（全スイート）: 182/182 green（既存179 + 新規3、回帰なし）
- `npx tsc --noEmit`: `write-news-digest.ts`/`write-news-digest.test.ts` に型エラー0（既存ファイルの無関係なエラー4件は上記の通りOut-of-Scope）

## Known Stubs

None — スタブ・プレースホルダーなし。

## Threat Flags

None — 本プランで導入した表面は plan の `threat_model` にすべて記載済み（T-17-01/T-17-02/T-17-03 mitigate、T-17-SC accept）で、新規依存追加もなし。

## Self-Check: PASSED

- FOUND: src/scripts/write-news-digest.ts
- FOUND: src/scripts/write-news-digest.test.ts
- FOUND: .planning/phases/17-pipeline-integration-orchestration/deferred-items.md
- FOUND commit: 9f15eb5
- FOUND commit: 829fe3d
- FOUND commit: 5443c42
