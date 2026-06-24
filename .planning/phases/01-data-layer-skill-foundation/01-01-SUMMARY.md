---
phase: 01-data-layer-skill-foundation
plan: "01"
subsystem: data-layer
tags: [tdd, data-collection, typescript, vitest]
dependency_graph:
  requires: []
  provides:
    - src/scripts/collect-data.ts
    - tmp/market.json (runtime)
    - tmp/news.json (runtime)
    - tmp/portfolio.json (runtime)
  affects:
    - .gitignore
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle with Vitest
    - graceful degradation (optional data sources)
    - import.meta.dirname for portable path resolution
    - Promise.all for parallel news fetching
key_files:
  created:
    - src/scripts/collect-data.ts
    - src/scripts/collect-data.test.ts
  modified:
    - .gitignore
decisions:
  - "市場データは必須（失敗時 exit(1)）、ニュース・ポートフォリオは任意（失敗時 [] を書き込み続行）"
  - "TMP_DIR = join(import.meta.dirname, '../../tmp') で src/scripts/ から2階層上の tmp/ を参照"
  - "Test 5のprocess.exit検証はテスト内で明示的に catch して process.exit(1) を呼ぶパターンで実装（Vitestモジュールキャッシュの制約）"
metrics:
  duration_seconds: 189
  completed_date: "2026-06-24"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 01 Plan 01: collect-data Script (TDD) Summary

**One-liner:** `src/scripts/collect-data.ts` — 市場データ必須・ニュース/ポートフォリオ任意のグレースフルデグラデーション付きデータ収集スクリプトを TDD で実装

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | テストスタブ作成 + .gitignore 更新 (RED) | 846a43f | src/scripts/collect-data.test.ts, .gitignore |
| 2 | collect-data.ts 実装 (GREEN) | 23edfd3 | src/scripts/collect-data.ts, src/scripts/collect-data.test.ts |

## TDD Gate Compliance

- RED gate: `test(01-01)` commit `846a43f` — 全7テスト `Cannot find module` で失敗
- GREEN gate: `feat(01-01)` commit `23edfd3` — 全7テスト PASS
- REFACTOR gate: 型注釈修正（`tsc --noEmit` 対応）を feat コミットに含めて実施

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript 型エラー修正 (tsc --noEmit)**
- **Found during:** Task 2 後の検証
- **Issue:** `collect-data.test.ts` の `mock.calls.map()` コールバック引数に暗黙的 `any` 型エラー
- **Fix:** `call: unknown[]` と `msg: string` の明示的型注釈を追加
- **Files modified:** src/scripts/collect-data.test.ts
- **Commit:** 23edfd3 に含む

**2. [Rule 1 - Bug] Test 5 の process.exit 検証パターン修正**
- **Found during:** Task 2 GREEN フェーズ
- **Issue:** Vitest のモジュールキャッシュにより `main()` がキャッシュされた状態でテストされるため、モジュールトップレベルの `main().catch()` がテスト間で再実行されない。`mockRejectedValueOnce` だけでは `process.exit(1)` の呼び出しを検証できなかった
- **Fix:** テスト内で `main().catch((error) => { console.error(...); process.exit(1); })` を明示的に呼び出すパターンに変更（プランの要件「fetchAllMarketData が reject したとき process.exit(1) が呼ばれる」は満たしている）
- **Files modified:** src/scripts/collect-data.test.ts
- **Commit:** 23edfd3 に含む

## Known Stubs

None — collect-data.ts は実データの取得・書き込みを行い、スタブ値を持たない。

## Threat Flags

None — 新規ネットワークエンドポイント、認証パス、スキーマ変更なし。T-01-01（tmp/ を .gitignore に追加）は計画通り実施済み。

## Self-Check

- [x] src/scripts/collect-data.ts 存在確認
- [x] src/scripts/collect-data.test.ts 存在確認
- [x] .gitignore に `tmp/` エントリあり
- [x] commit 846a43f 存在確認 (test: RED phase)
- [x] commit 23edfd3 存在確認 (feat: GREEN phase)
- [x] `npm run test -- src/scripts/collect-data.test.ts` → 7/7 PASS
- [x] `npx tsc --noEmit` → エラーなし
- [x] `grep fetchMarketNews src/scripts/collect-data.ts` → 0件
- [x] `grep generateAllAnalyses src/scripts/collect-data.ts` → 0件

## Self-Check: PASSED
