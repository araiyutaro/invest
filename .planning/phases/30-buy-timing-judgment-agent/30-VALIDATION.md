---
phase: 30
slug: buy-timing-judgment-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (既存 — src/**/*.test.ts 規約) |
| **Config file** | package.json scripts（既存インフラ） |
| **Quick run command** | `npx vitest run <target>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <target>.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| （プランナーが PLAN.md 作成時に記入） | | | TIME-01〜05 | | | unit | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.（vitest・テストモック規約とも既存。新規フレームワーク導入なし）*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 判定エージェントのライブ実行（Agent 並列起動・STEP マーカー実出力） | TIME-01 | invest.md パイプラインの Agent ツール実行は単体テスト不能 | launchd 日次実行または手動 /invest 実行でログ確認 |
| 判定理由が供給データのみに言及（創作なし）のプロンプト契約遵守 | TIME-04 | LLM 出力品質は静的検証不能（confluence 件数ゲートは自動、内容はレビュー） | 生成された tmp/watchlist-judgment.json の rationale を実データと突き合わせ |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
