---
phase: 23
slug: new-candidates-section-removal
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-04
---

# Phase 23 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| （新規なし） | 本フェーズは信頼境界を追加しない。既存の `MeetingResult → HTML 文字列生成` 境界から描画コード（新規組入候補テーブル）を削除するのみで、攻撃対象面はむしろ縮小 | なし（削除のみ） |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-23-01 | Tampering | `generate-portfolio-report.ts` 削除に伴う巻き込み事故（report-utils.ts / invest.md / types.ts / schemas.ts の誤変更） | mitigate | 編集スコープを2ファイルに限定。フェーズ全コミット範囲（261b1c1〜9ca32f4）で `git diff --stat -- .claude/commands/invest.md src/meeting/types.ts src/meeting/schemas.ts src/scripts/report-utils.ts` が空であること、および `invest.md:1746`「注目銘柄: [highlightedStocks 配列の全内容]」の grep 残存を 23-VERIFICATION.md で独立検証済み（D-09） | closed |
| T-23-SC | Tampering | npm/pip/cargo installs（サプライチェーン） | accept | 本フェーズは外部パッケージのインストールを一切行わない（RESEARCH.md「no new dependencies」。package.json 無変更をフェーズコミット範囲で確認） | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Threat surface が最小である理由:** 削除のみのフェーズ。新規のユーザー入力・エンドポイント・外部データ取り込み・暗号/認証/セッション面は一切追加されない。ASVS L1 の V2/V3/V4/V5/V6 いずれも新規に該当する攻撃対象面がない。`escapeHtml` を消費する描画パスを1つ削除しており、XSS 表面はむしろ減少。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-23-01 | T-23-SC | 本フェーズはパッケージインストール不在のため Package Legitimacy Gate 適用外。サプライチェーン露出の変化なし | gsd-secure-phase (auto) | 2026-07-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-04 | 2 | 2 | 0 | gsd-secure-phase（short-circuit: plan-time register 全 CLOSED、mitigation 証跡は 23-VERIFICATION.md の独立再検証に基づく） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-04
