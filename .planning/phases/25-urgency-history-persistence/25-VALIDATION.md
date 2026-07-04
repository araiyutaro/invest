---
phase: 25
slug: urgency-history-persistence
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-04
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/portfolio/urgency-history.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/portfolio/urgency-history.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-* | 01 | 1 | HIST-01, HIST-02 | — | 純関数の決定論的抽出・同日上書き・イミュータビリティ | unit | `npx vitest run src/portfolio/urgency-history.test.ts` | ❌ W0 | ⬜ pending |
| 25-02-* | 02 | 2 | HIST-01, HIST-02 | — | CLI の空欠損フォールバック・data/ mkdir・書き出し | unit/integration | `npx vitest run src/scripts/write-urgency-history.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Wave / task granularity to be finalized by the planner. Deterministic behaviors requiring coverage: 同日上書き（same-date overwrite）, 空/欠損時スキップ（missing tmp/portfolio-analysis.json or 0 holdings）, イミュータビリティ（入力 history を変更しない）, 全12銘柄保存, dateKey 検証（`/^\d{4}-\d{2}-\d{2}$/`）, normalizeHoldingSymbol 正規化。*

---

## Wave 0 Requirements

- [ ] `src/portfolio/urgency-history.test.ts` — 純関数テスト（extractUrgencySnapshots / appendUrgencySnapshot / isValidDateKey）for HIST-01, HIST-02
- [ ] `src/scripts/write-urgency-history.test.ts`（任意 — CLI I/O のテスト可能部分がある場合）
- vitest is already installed — no framework install needed

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| data/urgency-history.json が git commit/push に含まれる | HIST-01 | 実際の git デプロイフロー（Step 4）の統合はパイプライン実行でのみ検証可能 | パイプライン実行後 `git log` で data/urgency-history.json が report コミットに含まれることを確認 |
| invest.md Step 3f の STEP マーカー発出 | HIST-01, HIST-02 | パイプライン実行時の stdout/stderr マーカー到達はエンドツーエンド実行でのみ観測可能 | パイプライン実行ログに `[STEP:urgency-history:OK]` が出ることを確認 |

*同日上書き・空欠損フォールバック・イミュータビリティ・12銘柄保存の各コアロジックは vitest で自動検証。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-04 (plan-checker Dimension 8 checks 8a–8d all pass)
