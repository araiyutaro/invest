---
phase: 03
slug: report-builder-websearch-research
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v4.0.18 |
| **Config file** | vitest.config.ts (要確認) / package.json scripts |
| **Quick run command** | `npx vitest run src/scripts/generate-report.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/scripts/generate-report.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RSRCH-01, RSRCH-02 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | RPT-01 | unit | `npx vitest run src/scripts/generate-report.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | RPT-02 | integration | `npx vitest run src/scripts/generate-report.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | RSRCH-01, RSRCH-02, RPT-01, RPT-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/scripts/generate-report.test.ts` — レポートジェネレータのユニットテスト (RPT-01, RPT-02, RSRCH-01, RSRCH-02)

*Schema validation (WebSearchResult, ReevaluationOutput) は generate-report.test.ts 内で統合テスト。separate schemas.test.ts は不要 — Plan 01 の verify は `npx tsc --noEmit` で型整合性を担保。*

*Existing vitest infrastructure covers test framework — no additional install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebSearch Agent が最新ニュースを返す | RSRCH-01 | ライブWebSearch結果はモック不可 | `/invest` 実行後に `tmp/research/*.json` の `researchSummary` が空でないことを確認 |
| HTMLレポートがBloomberg風ダークテーマで表示される | RPT-01 | ビジュアル確認が必要 | `reports/YYYY-MM-DD/daily-report.html` をブラウザで開き、ダークテーマ・レイアウトを目視確認 |
| 再評価コメントがレポートに反映されている | RSRCH-02 | エンドツーエンドのAgent出力確認 | レポート内「Web調査後の再評価」セクションに各アナリストのコメントが表示されていることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
