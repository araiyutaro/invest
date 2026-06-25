# Requirements: Investment Agent

**Defined:** 2026-06-25
**Core Value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること

## v2.1 Requirements

Requirements for Report Quality & Pipeline Overhaul. v1.0品質の3レポート構成を復元し、分析品質を向上させる。

### Report Structure

- [ ] **RPT-01**: Daily Report（日次投資レポート）がニュース・市況分析に基づく独立した銘柄推奨を含む（ポートフォリオ非依存）
- [ ] **RPT-02**: Meeting Minutes（議事録）が各アナリストの詳細な散文分析を含む（JSON圧縮ではなくプロフェッショナルな長文）
- [ ] **RPT-03**: Portfolio Report（ポートフォリオレポート）が保有銘柄の個別評価（保持/買増/売却）と、Daily Reportの推奨銘柄の組入判断を含む
- [ ] **RPT-04**: 3つのレポートが `docs/YYYY-MM-DD/` に個別HTMLファイルとして出力される

### Analysis Quality

- [x] **ANL-01**: アナリストが市場ニュースを分析し、ポートフォリオとは無関係に注目すべき新規銘柄を発掘する
- [x] **ANL-02**: 各アナリストの Round 1 分析が複数段落の詳細な散文として出力される（v1.0品質）
- [ ] **ANL-03**: Round 2 ディスカッションが具体的な論点に対する実質的な議論を含む
- [ ] **ANL-04**: スコアリング結果が各アナリストの理由付きコメントとともに表形式で Daily Report に表示される

### Pipeline & Deployment

- [ ] **PIPE-01**: レポート生成後に自動で `git add docs/ && git commit && git push` が実行される
- [ ] **PIPE-02**: `/invest` スキルコマンドが3レポート構成のパイプラインを実行する
- [ ] **PIPE-03**: generate-report.ts が3つの独立したHTMLファイルを生成する

### Portfolio Management

- [ ] **PORT-01**: Portfolio Report がデイリーレポートの推奨銘柄を「新規組み入れ候補」として評価する
- [ ] **PORT-02**: 保有銘柄ごとに「保持/買増/一部売却/全売却」の判断と根拠が提示される
- [ ] **PORT-03**: リバランス提案（具体的なアクションアイテム）が含まれる

## Future Requirements

Deferred to v2.x+. Tracked but not in current roadmap.

### Enhanced Analysis

- **ENH-01**: スコアリングラウンドを専用並列サブエージェントで実行
- **ENH-02**: 前日レポートの注入によるクロスセッション分析記憶
- **ENH-03**: スキル自動起動のチューニング

## Out of Scope

| Feature | Reason |
|---------|--------|
| チャート画像生成 | テキストベースで十分、Claude Code内で画像生成不可 |
| launchd/cron自動実行 | Claude Codeスキルはアクティブセッション必須 |
| 新規アナリスト追加 | 既存5+1構成で十分 |
| OAuth/外部認証 | 個人利用のみ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RPT-01 | Phase 6 | Pending |
| RPT-02 | Phase 6 | Pending |
| RPT-03 | Phase 7 | Pending |
| RPT-04 | Phase 6 | Pending |
| ANL-01 | Phase 5 | Complete |
| ANL-02 | Phase 5 | Complete |
| ANL-03 | Phase 5 | Pending |
| ANL-04 | Phase 5 | Pending |
| PIPE-01 | Phase 7 | Pending |
| PIPE-02 | Phase 7 | Pending |
| PIPE-03 | Phase 6 | Pending |
| PORT-01 | Phase 7 | Pending |
| PORT-02 | Phase 7 | Pending |
| PORT-03 | Phase 7 | Pending |

**Coverage:**
- v2.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-06-25*
*Traceability updated: 2026-06-25 — v2.1 roadmap created*
