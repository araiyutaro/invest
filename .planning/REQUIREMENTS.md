# Requirements: Investment Agent — Milestone v2.6

**Defined:** 2026-07-04
**Core Value:** 毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること
**Milestone:** v2.6 Digest-Meeting Cross-Reference & Urgency History

## v2.6 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### クロスリファレンス（XREP）

- [ ] **XREP-01**: ユーザーはニュースダイジェスト（news-digest.html）の記事に、当日ミーティングで議論されたテーマ・銘柄への関連注記を見ることができる（meeting-result.json とのTS側決定論的マッチング — ティッカー一致優先+テーマキーワード照合、holding-news.ts と同じ設計思想）
- [ ] **XREP-02**: クロスリファレンス付与が失敗しても news-digest.html の生成と既存3レポートの生成・デプロイは継続する（fail-soft、専用 STEP マーカーで失敗可視化）

### 緊急度履歴（HIST）

- [ ] **HIST-01**: 日次実行ごとに保有銘柄の緊急度フラグ（urgent）と判断（decision）が `data/urgency-history.json` に追記保存され、git commit/push フローで永続化される
- [ ] **HIST-02**: 同日に複数回実行しても履歴が重複しない（同日エントリは上書き、v2.5 の同日再実行ガードと同方式）
- [ ] **HIST-03**: ユーザーは portfolio.html で直近7日間の緊急フラグ・判断変更履歴のロールアップセクションを見ることができる

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

（なし — 現時点で持ち越し済みの将来要件はすべて本マイルストーンに取り込み済み）

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| LLMベースの関連注記生成 | TS側決定論的マッチングで実現（幻覚リスク回避・再現性確保、v2.5の設計方針を踏襲） |
| 独立した週次レポートHTML（5紙目） | portfolio.html 内セクションで十分、週次判定ロジックの追加複雑性を回避 |
| 緊急度履歴の docs/ 公開 | 履歴は非公開の data/ に保存（GitHub Pages で公開する必要なし） |
| SQLite 等のDB導入 | 12銘柄×日次のデータ量には JSON 追記で十分、既存の tmp/JSON 文化と一貫 |
| 履歴の全期間表示UI | 直近7日間ロールアップで開始、長期表示は必要になってから |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| XREP-01 | Phase 24 | Pending |
| XREP-02 | Phase 24 | Pending |
| HIST-01 | Phase 25 | Pending |
| HIST-02 | Phase 25 | Pending |
| HIST-03 | Phase 26 | Pending |

**Coverage:**
- v2.6 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after roadmap creation (Phases 24-26)*
