---
phase: 24
slug: digest-meeting-cross-reference
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none explicit — vitest auto-discovers `*.test.ts` co-located with sources |
| **Quick run command** | `npx vitest run src/meeting/digest-crossref.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~10–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `npx vitest run <file>` for the module touched
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-* | 01 | 1 | XREP-01 | — | escapeHtml on all crossref chip text (no injection from meeting/curation strings) | unit | `npx vitest run src/meeting/digest-crossref.test.ts` | ❌ W0 | ⬜ pending |
| 24-02-* | 02 | 2 | XREP-01 | — | 0-annotation render byte-identical to current output; escapeHtml on chip | unit | `npx vitest run src/scripts/generate-news-digest.test.ts` | ✅ | ⬜ pending |
| 24-03-* | 03 | 3 | XREP-02 | — | crossref exception → empty annotations, digest still exit 0 (isolated try/catch) | unit/integration | `npx vitest run src/scripts/write-news-digest.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists column: ✅ = test file already exists (extend it) · ❌ W0 = new test file, created in Wave 0 of its plan*

---

## Wave 0 Requirements

- [ ] `src/meeting/digest-crossref.test.ts` — new test file: unit tests for the deterministic matcher (ticker-priority, theme-keyword fallback with `" (TICKER)"` stripping, cap, symbol normalization, fail-soft no-throw, empty-input → empty-map). Stubs for XREP-01.
- [ ] Extend `src/scripts/generate-news-digest.test.ts` — assert 0-annotation output is unchanged AND annotated cards render the crossref chip with escaped text.
- [ ] Extend `src/scripts/write-news-digest.test.ts` — assert crossref exception is isolated (digest succeeds, exit 0) and does NOT emit the null-fallback "生成できませんでした" page.

*vitest is already installed; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 実ライブパイプラインで news-digest.html にクロスリファレンスchipが表示される | XREP-01 | 本番 meeting-result.json + news-curation.json の実データに依存（当日ミーティング内容次第でマッチ有無が変わる） | 翌朝の launchd 実行後、docs/{date}/news-digest.html を開き、当日ミーティングで議論された銘柄/セクターに一致する記事にchipが出ることを目視。未議論記事にchipが出ないことも確認 |
| `[STEP:digest-crossref:*]` マーカーがパイプラインログに出力される | XREP-02 | invest.md の Step 3e 実行はライブパイプライン内でのみ発火 | 実行ログを grep `[STEP:digest-crossref:` して OK/FAIL いずれかが1回出ることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (digest-crossref.test.ts)
- [ ] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
