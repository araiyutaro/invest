---
phase: 15
slug: curation-contract-schema
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18（インストール済み、設定ファイルなし = デフォルト設定） |
| **Config file** | none — `package.json` の `"test": "vitest run"` のみで動作 |
| **Quick run command** | `npx vitest run <target>.test.ts` |
| **Full suite command** | `npm test`（= `vitest run`） |
| **Estimated runtime** | ~5 seconds（純関数・スキーマの単体テストのみ） |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <該当 .test.ts>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CURA-02 | T-15-01 | ID を TS 側で決定的に採番（LLM 由来値なし） | unit | `npx vitest run src/data/news/article-id.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | CURA-02 | T-15-01 | news.json 出力に連番 ID が付与される | unit | `npx vitest run src/scripts/collect-data.test.ts` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 1 | CURA-05 | T-15-05 | 範囲外 market/importance enum を throw で検出 | unit | `npx vitest run src/meeting/schemas.test.ts -t "validateRawNewsCuration"` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | CURA-02 | T-15-03 / T-15-04 / T-15-06 | ID のみ信頼しプールから解決、ソフトクランプで throw しない | unit | `npx vitest run src/meeting/schemas.test.ts -t "resolveNewsCuration"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/data/news/article-id.test.ts` — NEW、assignArticleIds の単体テスト（CURA-02）
- [ ] `src/meeting/schemas.test.ts` — NEW、validateRawNewsCuration / resolveNewsCuration の全ケース（CURA-02 / CURA-05）
- [ ] `src/scripts/collect-data.test.ts` — 既存ファイルへ ID 付与検証ケースを追加
- [ ] フレームワークインストール: 不要（vitest 既にセットアップ済み）

*fixture は独立 JSON ファイルを作らず、各 .test.ts 内のインラインオブジェクトとして定義する（Pitfall 4）。*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

本フェーズは純粋な型・スキーマ設計フェーズであり、全ての受け入れ基準が vitest の単体テストで自動検証可能。HTML 描画（Phase 16）・パイプライン実行（Phase 17）は本フェーズ範囲外のため manual 検証項目は発生しない。

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-02
