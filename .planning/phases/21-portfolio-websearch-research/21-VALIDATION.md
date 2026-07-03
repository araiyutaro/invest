---
phase: 21
slug: portfolio-websearch-research
status: final
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | none (package.json scripts) |
| **Quick run command** | `npm test -- <target>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <target>.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01 Task 1: schema 硬化 | 21-01 | 1 | PORT-02 | T-21-03 | agent-authored JSON を zod alias-transform で正準化（フィールド名発明を吸収、データ欠落防止） | unit | `npx vitest run src/meeting/schemas.test.ts && npm test` | ✅ src/meeting/schemas.ts, schemas.test.ts | ⬜ pending |
| 21-01 Task 2: validate script + 隔離テスト | 21-01 | 1 | PORT-02 | T-21-06 | Daily Report ローダーの portfolio-research 非参照を構造的に保証（隔離） | unit + isolation | `npx vitest run src/scripts/generate-report.test.ts && npx tsc --noEmit -p tsconfig.json` | ✅ src/scripts/validate-portfolio-research.ts, generate-report.test.ts | ⬜ pending |
| 21-02 Task 1: Step 3-P 挿入 | 21-02 | 1 | PORT-02 / OPS-05 | T-21-01, T-21-02, T-21-04 | 社名併記クエリ+エンティティ確認+インジェクション防御、fail-soft マーカー（[PIPELINE:FAIL] 非出力） | structural (grep) | `SP=$(grep -n 'Step 3-P' .claude/commands/invest.md \| head -1 \| cut -d: -f1); BR=$(grep -n 'Step 3c へジャンプ' .claude/commands/invest.md \| head -1 \| cut -d: -f1); test -n "$SP" && test -n "$BR" && test "$SP" -lt "$BR" && test $(grep -c 'STEP:portfolio-research:START' .claude/commands/invest.md) -ge 1 && test $(grep -c 'STEP:portfolio-research:OK' .claude/commands/invest.md) -ge 1 && test $(grep -c 'STEP:portfolio-research:FAIL' .claude/commands/invest.md) -ge 1 && test $(grep -c 'tmp/portfolio-research' .claude/commands/invest.md) -ge 3 && test $(grep -c 'PORTFOLIO_HOLDINGS' .claude/commands/invest.md) -ge 1 && test $(grep -c 'portfolioResearchStart' .claude/commands/invest.md) -ge 1 && test $(grep -c 'portfolioResearchEnd' .claude/commands/invest.md) -ge 1` | ✅ .claude/commands/invest.md | ⬜ pending |
| 21-02 Task 2: パイプライン計測行 | 21-02 | 1 | OPS-05 | T-21-04 | 実行時間 metrics 可視化（12x fan-out レート制限の週次監視） | structural (grep) | `grep -c 'portfolioResearchEnd - m.portfolioResearchStart' .claude/commands/invest.md \| grep -qv '^0$' && grep -c 'ポートフォリオリサーチ' .claude/commands/invest.md \| grep -qv '^0$'` | ✅ .claude/commands/invest.md | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (vitest suite already established — schema tests follow existing `src/meeting/schemas` test conventions).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 12銘柄のWebSearchリサーチ実行と tmp/portfolio-research/*.json 保存 | PORT-02 | Agent+WebSearch はライブパイプライン実行時のみ動作（invest.md オーケストレーション） | `/invest` 実行後、`ls tmp/portfolio-research/*.json` で12ファイル確認 + zodスキーマ適合検証 + EE/NXT の内容スポットチェック |
| [STEP:portfolio-research:*] マーカーの出力とパイプライン継続 | OPS-05 | STEPマーカーは invest.md 実行ログにのみ現れる | ライブ実行ログで START/OK(FAIL) マーカー確認、失敗時も後続ステップが継続することを確認 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-03
</content>
