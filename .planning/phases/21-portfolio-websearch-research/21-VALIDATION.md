---
phase: 21
slug: portfolio-websearch-research
status: draft
nyquist_compliant: false
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
| (planner fills) | | | PORT-02 / OPS-05 | | | | | | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
