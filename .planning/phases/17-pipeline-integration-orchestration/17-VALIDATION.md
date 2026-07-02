---
phase: 17
slug: pipeline-integration-orchestration
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| 17-01-01 (RED) | 01 | 1 | CURA-01 | T-17-01 | LLM出力検証は既存 `validateRawNewsCuration` に委譲 | unit | `npx vitest run src/scripts/write-news-digest.test.ts`（失敗確認 → RED_CONFIRMED） | ✅ | ⬜ pending |
| 17-01-02 (GREEN) | 01 | 1 | CURA-01, OPS-04 | T-17-03 / T-17-04 | 日付は `tmp/meeting-result.json` 由来のみ、exit code で fail-soft 分離 | unit + type | `npx vitest run && npx tsc --noEmit` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | CURA-01 | T-17-01 | news-curator は ID参照方式のみ出力（url/title 非出力） | source assertion | `grep -q "news-curator" .claude/commands/invest.md && echo STEP3D_OK` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 2 | CURA-01, OPS-04 | T-17-04 / T-17-05 | `[PIPELINE:FAIL]` 非流用、失敗は `[STEP:news-digest:FAIL:...]` で可視化 | source assertion | `grep -q "Step 3e" .claude/commands/invest.md && ... && echo STEP3E_OK` | ✅ | ⬜ pending |
| 17-02-03 | 02 | 2 | CURA-01, OPS-04 | T-17-04 | ライブ `/invest` で fail-soft と4紙目生成を実証 | manual (checkpoint:human-verify) | N/A — Manual-Only Verifications 参照 | — | ⬜ pending |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies（checkpoint:human-verify は type 上 exempt）
- [x] Sampling continuity: no 3 consecutive tasks without automated verify（Wave 1: 2/2, Wave 2: 2/2）
- [x] Wave 0 covers all MISSING references（MISSING 参照なし — 既存 vitest 基盤でカバー）
- [x] No watch-mode flags
- [x] Feedback latency < 60s（全コマンド30秒未満）
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-02（gsd-plan-checker Dimension 8 PASS に基づく）
