---
phase: 13-operational-stability
plan: 01
subsystem: infra
tags: [pipeline, logging, html-protection, shasum, terminal-notifier]

requires:
  - phase: 12
    provides: pipeline execution via invest.md and launchd via run.sh

provides:
  - Structured step markers [STEP:{name}:START/OK/FAIL] in invest.md for all 6 pipeline steps
  - [PIPELINE:OK] and [PIPELINE:FAIL] markers for overall pipeline status
  - SHA256 checksum-based HTML protection for docs/index.html and docs/portfolio.html in run.sh
  - Documented macOS notification verification (OPS-03)

affects: [invest-pipeline, run.sh, launchd-logs]

tech-stack:
  added: []
  patterns:
    - "Step marker pattern: echo '[STEP:{name}:START/OK/FAIL:{reason}]' in invest.md bash blocks"
    - "HTML checksum guard: shasum -a 256 before/after pipeline, git checkout on change"

key-files:
  created: []
  modified:
    - .claude/commands/invest.md
    - scripts/run.sh

key-decisions:
  - "STEP markers inserted as standalone bash echo blocks matching existing pipeline structure"
  - "round-2 has no FAIL marker by design (warnings only, pipeline continues)"
  - "deploy:OK covers both push-completed and no-change-skip cases"
  - "HTML protection uses /tmp checksum file with TIMESTAMP suffix to avoid collision"
  - "macOS notification (OPS-03) verified via logs/launchd-out.log entries — no code change needed"

requirements-completed: [OPS-01, OPS-02, OPS-03]

duration: 15min
completed: 2026-06-30
---

# Phase 13 Plan 01: Operational Stability - Step Markers, HTML Protection, Notification Verification Summary

**Structured pipeline step markers (START/OK/FAIL) added to invest.md for 6 steps, SHA256 HTML checksum protection added to run.sh, macOS notification verified via launchd logs**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-30T23:20:00Z
- **Completed:** 2026-06-30T23:36:44Z
- **Tasks:** 6 (T-01 through T-06)
- **Files modified:** 2

## Accomplishments

- invest.md に 6 ステップ x START/OK マーカーと 5 箇所の FAIL マーカー + PIPELINE:OK/FAIL を追加
- scripts/run.sh に SHA256 チェックサム保護ロジックを追加（docs/index.html, docs/portfolio.html 対象）
- macOS 通知（terminal-notifier）が launchd 環境で動作済みであることを確認（コード変更不要）
- マーカーフォーマット一貫性を grep で検証（STEP: 18 件、PIPELINE:FAIL 5 件、PIPELINE:OK 1 件）
- bash -n による run.sh 構文チェック通過、shasum コマンド利用可能確認

## Task Commits

1. **T-01 + T-02: invest.md ステップマーカー** - `af62dad` (feat: add pipeline step markers START/OK/FAIL)
2. **T-03: run.sh HTML チェックサム保護** - `78ae10d` (feat: add HTML checksum protection)
3. **T-04: macOS 通知検証ドキュメント** - SUMMARY.md に記録（コード変更なし）
4. **T-05: ステップマーカー検証** - grep で全マーカー存在確認（コード変更なし）
5. **T-06: HTML チェックサム検証** - bash -n + shasum 確認（コード変更なし）

## Files Created/Modified

- `.claude/commands/invest.md` - 6 ステップに START/OK マーカー、5 箇所に FAIL マーカー、末尾に PIPELINE:OK 追加
- `scripts/run.sh` - claude コマンド前後にチェックサム記録・検証・復元ロジック追加

## Decisions Made

- round-2 には FAIL マーカーなし（警告のみで続行する設計を維持）
- deploy:OK は「プッシュ完了」「変更なしスキップ」の両方をカバー
- チェックサムファイル名に `${TIMESTAMP}` を含め並列実行時の衝突を回避
- OPS-03（macOS 通知）はコード変更不要 — logs/launchd-out.log (6/29, 6/30 エントリ) で動作確認済み

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 Plan 01 完了。次は 13-02-PLAN.md（存在する場合）または Phase 13 完了
- 今後のパイプライン失敗時: `grep '\[STEP:.*:FAIL\]' logs/invest-*.log` で失敗ステップを即座に特定可能
- HTML 保護: run.sh が docs/index.html と docs/portfolio.html の意図しない変更を自動復元

## Self-Check: PASSED

- [x] STEP markers: `grep -n '\[STEP:' invest.md` → 18 件 (6 steps x START/OK + 5 FAILs + 2 deploy:OK)
- [x] PIPELINE markers: FAIL 5 件 + OK 1 件
- [x] run.sh 構文: `bash -n scripts/run.sh` → 構文OK
- [x] shasum 利用可能: `/usr/bin/shasum` 存在確認、docs/index.html チェックサム取得成功
- [x] round-2 に FAIL なし（計画通り）
- [x] コミット: af62dad, 78ae10d

---
*Phase: 13-operational-stability*
*Completed: 2026-06-30*
