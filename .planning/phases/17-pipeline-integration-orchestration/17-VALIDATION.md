---
phase: 17
slug: pipeline-integration-orchestration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — 179/179 passing baseline) |
| **Config file** | vitest via package.json (existing) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | — | — | CURA-01 / OPS-04 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — vitest is installed and green (179 tests).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/invest` 実行で news-digest.html が生成される | CURA-01 | 実パイプライン（Claude subagent 呼び出し）は CI 外 | `npx tsx src/scripts/write-news-digest.ts` を正常/不正JSON/欠損の3シナリオでスモーク実行 |
| キュレーション失敗時に他3レポートが生成・デプロイされる | OPS-04 | パイプライン全体のオーケストレーションは手動確認 | `tmp/news-curation.json` を不正JSONにして `/invest` 相当のステップを実行し、3レポート生成とログマーカーを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
