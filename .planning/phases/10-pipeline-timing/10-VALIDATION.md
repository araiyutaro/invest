---
phase: 10
slug: pipeline-timing
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json (`"test": "vitest run"`) |
| **Quick run command** | `npx vitest run src/scripts/collect-data.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/scripts/collect-data.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | METR-01 | — | N/A | unit (TDD) | `npx vitest run src/scripts/collect-data.test.ts` | ✅ (既存ファイルにテスト追加) | ⬜ pending |
| 10-01-02 | 01 | 1 | METR-02 | — | N/A | automated grep | `grep -c "pipeline-metrics.json" .claude/commands/invest.md` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | METR-02 | — | N/A | manual | Manual: run `/invest` and verify timing display | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- `src/scripts/collect-data.test.ts` — existing file, METR-01 tests will be appended (TDD in Task 1)

*No new test files or framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline Timing display block in `/invest` output | METR-02 | Display is rendered by Claude Command (invest.md) via `node -e` scripts, not exportable functions | Run `/invest`, verify Step hierarchy with timing values appears in final output matching D-03 format |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
