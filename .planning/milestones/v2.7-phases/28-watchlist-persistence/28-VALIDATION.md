---
phase: 28
slug: watchlist-persistence
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (既存: src/**/*.test.ts) |
| **Config file** | package.json scripts（既存テスト規約に準拠） |
| **Quick run command** | `npx vitest run src/portfolio/watchlist.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/portfolio/watchlist.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | WLST-04, WLST-05 | T-28-06 | isValidDateKey による dateKey 検証 | unit (TDD) | `npx vitest run src/portfolio/watchlist.test.ts -t "isActive\|getActiveWatchlistEntries\|EXPIRY"` | ❌ W0 (TDDタスク内で作成) | ⬜ pending |
| 28-01-02 | 01 | 1 | WLST-01, WLST-05 | T-28-02 | ETF第2ゲート fail-closed（lookup失敗は登録しない） | unit (TDD) | `npx vitest run src/portfolio/watchlist.test.ts -t "admitBullishStocks\|idempotent\|ETF\|lookup\|reconfirm\|re-admission"` | ❌ W0 (TDDタスク内で作成) | ⬜ pending |
| 28-01-03 | 01 | 1 | WLST-02, WLST-03, WLST-04, WLST-05 | T-28-01 | ticker 正規化による prototype pollution 防止 | unit (TDD) | `npx vitest run src/portfolio/watchlist.test.ts` | ❌ W0 (TDDタスク内で作成) | ⬜ pending |
| 28-02-01 | 02 | 2 | WLST-01, WLST-05 | T-28-04 | 破損ファイル非上書き（二段フェイル） | unit (TDD) | `npx vitest run src/scripts/write-watchlist.test.ts -t "ENOENT\|corrupted\|quote"` | ❌ W0 (TDDタスク内で作成) | ⬜ pending |
| 28-02-02 | 02 | 2 | WLST-01〜05 | T-28-05 | prune→admit 合成順序・STEP マーカー fail-soft | unit | `npx vitest run src/scripts/write-watchlist.test.ts` | ❌ W0 (TDDタスク内で作成) | ⬜ pending |
| 28-03-01 | 03 | 3 | WLST-01〜05 (配線) | — | fail-soft 挿入（PIPELINE:FAIL を出さない） | source assertion | `grep -n "write-watchlist" .claude/commands/invest.md` | ✅ | ⬜ pending |
| 28-03-02 | 03 | 3 | WLST-01 (ライブ確認) | — | launchd 実行での実マーカー確認 | manual (checkpoint:human-verify) | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/portfolio/watchlist.test.ts` — WLST-01〜05 の純関数テストスタブ（admit/prune/失効/再追加/冪等性）
- 既存の vitest インフラを流用（新規フレームワークインストール不要）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| launchd 日次実行での Step 実マーカー出力・data/watchlist.json 実生成 | WLST-01, OPS-06(分担分) | 静的解析では実パイプライン実行を確認不能 | 翌朝の launchd 実行ログで `[STEP:watchlist:OK]` と data/watchlist.json の生成・コミットを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
