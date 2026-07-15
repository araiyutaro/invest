---
phase: 31
slug: daily-report-watchlist-section
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (tsx) — existing project convention |
| **Config file** | none — `npx tsx --test` direct invocation |
| **Quick run command** | `npx tsx --test src/scripts/report-data-loaders.test.ts src/scripts/generate-report.test.ts` |
| **Full suite command** | `npx tsx --test src/**/*.test.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | UI-09 / UI-10 | — | HTML escaping of LLM-derived text | unit | `npx tsx --test ...` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. (report-data-loaders.test.ts / generate-report.test.ts に追加、新規テストファイル不要 — RESEARCH.md 参照)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| daily-report.html のウォッチリストセクションの実描画（バッジ・色・レイアウト） | UI-09/UI-10 | ブラウザ描画は静的解析不能 | 生成された docs/{date}/daily-report.html をブラウザで開き、バッジ表示・as-of 注記・変化バッジを目視確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
