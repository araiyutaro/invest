---
phase: 18
slug: index-nav-integration-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (pinned in `package.json` devDependencies; already used by `update-index.test.ts`) |
| **Config file** | none — `package.json` `"test": "vitest run"` script |
| **Quick run command** | `npx vitest run src/scripts/update-index.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/scripts/update-index.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + D-10 live single-script execution
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UI-04 | — | News Digest link appended when `docs/{date}/news-digest.html` exists | unit | `npx vitest run src/scripts/update-index.test.ts -t "adds News Digest link"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-04 | — | No News Digest link (no 404) when file absent | unit | `npx vitest run src/scripts/update-index.test.ts -t "omits News Digest link"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-04 | — | Stale parsed News Digest link removed when file no longer exists | unit | `npx vitest run src/scripts/update-index.test.ts -t "removes stale News Digest link"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-04 | — | Existing 3 report links unaffected (no regression) | unit | `npx vitest run src/scripts/update-index.test.ts` (existing tests unmodified + combined 3+digest assertion) | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/scripts/update-index.test.ts` — extend `vi.mock("node:fs/promises", ...)` factory to include `access: vi.fn()` (currently absent — Pitfall 4)
- [ ] `src/scripts/update-index.test.ts` — add 3-4 new `it(...)` cases per D-08 scenarios (exists→link / absent→no link / stale-link-removed / existing-3-preserved-alongside-4th)
- [ ] No new test file or framework install needed — all new tests belong in the existing `update-index.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live single-script execution against real `docs/` tree | UI-04 (success criteria 1+2) | D-10: real fs state (2026-07-03 has news-digest.html; ~108 historical dates do not) is the natural verification environment | `npx tsx src/scripts/update-index.ts` with `tmp/meeting-result.json` present — verify `docs/index.html` gains a News Digest link only for dates with a real `news-digest.html` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
