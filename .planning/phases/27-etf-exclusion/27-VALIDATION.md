---
phase: 27
slug: etf-exclusion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | package.json (`npm test` → vitest run) |
| **Quick run command** | `npx vitest run src/portfolio/etf-exclusion.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/portfolio/etf-exclusion.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| （プランナーがPLAN.md確定後に記入） | | | ETF-01, ETF-02 | — | | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/portfolio/etf-exclusion.test.ts` — stubs for ETF-02（米国ETF・日本ETF・米国個別株・日本個別株・lookup失敗の分類検証）

*既存の vitest インフラ（urgency-history.test.ts 等）が流用可能 — フレームワーク新規導入は不要。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| invest.md プロンプト指示のライブ効果（アナリストがETFをpicksに含めない） | ETF-01 | LLM出力は静的検証不能。第2層（TS決定論フィルタ）が構造的保証を担う | 翌営業日の launchd 実行後、tmp/round-1/*.json の picks と tmp/meeting-result.json の highlightedStocks にETFが含まれないことを確認 |
| Step 2g での filter-etf-stocks.ts 実行と [STEP:etf-exclusion:*] マーカー出力 | ETF-02 | パイプライン統合はライブ実行でのみ確認可能 | ログで [STEP:etf-exclusion:OK] を確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
