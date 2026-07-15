---
phase: 27
slug: etf-exclusion
status: planned
nyquist_compliant: true
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
| 27-01 T1 (RED test) | 27-01 | 1 | ETF-02 | T-27-01 | Map キーで prototype pollution 回避 | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts` | ❌ W0→本タスクで作成 | ⬜ pending |
| 27-01 T2 (pure fn) | 27-01 | 1 | ETF-02 | T-27-01/02 | allowlist=EQUITY, lookup失敗→fail-closed | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts` | ✅ (T1) | ⬜ pending |
| 27-02 T1 (CLI test) | 27-02 | 2 | ETF-02 | T-27-03/04/05 | fail-soft/fail-closed 分離, 書き戻し検証 | unit (mocked) | `npx vitest run src/scripts/filter-etf-stocks.test.ts` | ❌ W0→本タスクで作成 | ⬜ pending |
| 27-02 T2 (CLI impl) | 27-02 | 2 | ETF-02 | T-27-03/04/SC | 単一 batch quote (D-05), fail-soft (D-02) | unit (mocked) | `npx vitest run src/scripts/filter-etf-stocks.test.ts` | ✅ (T1) | ⬜ pending |
| 27-03 T1 (prompts) | 27-03 | 2 | ETF-01 | T-27-07 | 5アナリスト+モデレーター除外指示 | static (grep) | `grep -c "…は picks に含めないこと" .claude/commands/invest.md` (==5) | n/a | ⬜ pending |
| 27-03 T2 (Step 2g wiring) | 27-03 | 2 | ETF-02 | T-27-06 | fail-soft wiring, [PIPELINE:FAIL]禁止 | static (grep+awk) | filter-etf-stocks.ts が validate-meeting.ts より前 (awk順序) | n/a | ⬜ pending |

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
