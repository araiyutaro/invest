---
phase: 1
slug: data-layer-skill-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | none — default configuration |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DATA-01 | — | N/A | unit | `npm run test -- src/scripts/collect-data.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | DATA-01 | — | N/A | unit | `npm run test -- src/scripts/collect-data.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | DATA-02 | — | N/A | manual | — | N/A | ⬜ pending |
| 01-03-01 | 03 | 1 | SKILL-01 | — | N/A | manual | — | N/A | ⬜ pending |
| 01-04-01 | 04 | 1 | SKILL-02 | — | N/A | manual | — | N/A | ⬜ pending |
| 01-05-01 | 05 | 1 | SKILL-03 | — | N/A | unit | `npm run test -- src/scripts/collect-data.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/scripts/collect-data.test.ts` — stubs for DATA-01, SKILL-03
- [ ] `tmp/` directory added to `.gitignore`

*Existing Vitest infrastructure is present but no project-specific test files exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/invest` コマンドがClaude Codeで認識される | SKILL-01 | Claude Codeスキル登録はランタイムテスト不可 | `/invest` を実行して動作確認 |
| データ収集完了後にAgent骨格がスポーンされる | SKILL-02 | スキルMD内のAgentスポーンは自動テスト困難 | `/invest` 実行後にAgent起動を確認 |
| アナリスト別に必要なJSONファイルのみを参照する | DATA-02 | スキルMD側の制御はユニットテスト不可 | スキルMD内の各Agent指示を目視確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
