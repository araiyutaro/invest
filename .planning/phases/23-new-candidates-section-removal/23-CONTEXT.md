# Phase 23: New-Candidates Section Removal - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** --auto（Claude が既存パターン・前フェーズ決定・要件文言に基づき推奨決定を自動選択）

<domain>
## Phase Boundary

ポートフォリオレポートが保有銘柄の意思決定に集中し、Daily Report と重複する「新規組入候補（Daily Report より転載）」セクションが表示されない（UI-08）。

具体的な成果物:
1. `src/scripts/generate-portfolio-report.ts` から `formatNewCandidatesHtml()` とその呼び出し（通常パス・フォールバックパスの両方）を削除
2. 削除に伴い未使用となる import（`scoreColor` / `verdictColor`）の除去
3. テスト更新: 既存 Test 30（セクション存在検証）を非存在検証へ反転し、通常パス・フォールバックパスの両方をカバー
4. portfolio-analyst への文脈情報としての `highlightedStocks` 受け渡し（invest.md Step 3d「注目銘柄」セクション）は**維持** — プロンプト入力からは削除しない

Daily Report 側の highlightedStocks 表示（generate-daily-report.ts のスコアリングマトリクス）は Daily Report の専任領域であり本フェーズの対象外。新規アナリスト・新規セクションの追加も対象外。

</domain>

<decisions>
## Implementation Decisions

**注:** `--auto` モードにより、以下は Claude が UI-08 要件文言・ROADMAP Success Criteria・既存コード規約に基づいて確定した推奨決定。

### 削除の実装形
- **D-01:** `formatNewCandidatesHtml()` は**関数ごと完全削除**する（呼び出しのみ除去して dead code を残す案は不採用 — コーディング規約のデッドコード禁止、および将来の誤再配線防止）
- **D-02:** 削除で未使用になる import（`scoreColor` / `verdictColor` — generate-portfolio-report.ts 内では formatNewCandidatesHtml のみが使用）を import 文から除去する。`report-utils.ts` 側の関数本体は削除しない（generate-daily-report.ts が引き続き使用）
- **D-03:** `generatePortfolioReportHtml(result: MeetingResult, ...)` の**シグネチャは変更しない** — `result.date` がタイトル・見出しで引き続き必要であり、呼び出し側（generate-report.ts）への波及を避ける

### フォールバックパスの跡地表現
- **D-04:** フォールバックパス（portfolioAnalysis === null）は既存メッセージ「本日のポートフォリオ分析は生成されませんでした。」**のみ**とし、代替コンテンツは追加しない — 要件外の追加をしない（UI-08 は削除のみを要求）

### テスト更新方針
- **D-05:** 既存 Test 30「HTML に highlightedStocks の新規組入候補セクションが含まれる」は**非存在検証へ反転**する: 通常パス（validPortfolioAnalysis 有り）で `expect(html).not.toContain("新規組入候補")` を検証。highlightedStocks に PLTR を含む validMeetingResult を渡した上で非表示を確認する（空配列での擬似合格を防ぐ）
- **D-06:** フォールバックパス（null）でも `not.toContain("新規組入候補")` を検証するテストを追加（既存 Test 31 への追記 or 新規テスト、planner の裁量）。ROADMAP Success Criteria 1 の「両パスで存在しない」と1対1対応させる
- **D-07:** Daily Report 側のテスト（Test 4: generateHtml の highlightedStocks 表示）は**変更しない** — Daily Report のスコアリングマトリクスは維持対象

### highlightedStocks 受け渡しの維持（Success Criteria 2）
- **D-08:** `.claude/commands/invest.md` Step 3d の portfolio-analyst プロンプト「## 本日のミーティング結果」内の「注目銘柄: [highlightedStocks 配列の全内容]」（1746行目付近）は**一切変更しない**。REQUIREMENTS.md の除外事項「再評価フロー内での新規組入候補の提案」にも触れない（提案機能を足すのではなく、文脈情報の受け渡しを保つだけ）
- **D-09:** フェーズ検証で「invest.md Step 3d に highlightedStocks の受け渡しが残存していること」を grep で確認する（削除作業の巻き込み事故防止）。`MeetingResult.highlightedStocks` 型・スキーマ（types.ts / schemas.ts）も無変更であること

### Claude's Discretion
- 反転テストの配置（Test 30 の番号を維持して書き換えるか、番号体系を整理するか — 既存テストファイルの流儀に従う）
- フォールバックパステストの実装形（Test 31 拡張 vs 新規テスト）
- コミット分割（削除+テスト反転を1コミットにするか、TDD で反転テスト先行にするか — TDD 規約優先）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — UI-08 の正確な要件文言（成功パス・フォールバックパスの両方の呼び出し箇所削除、highlightedStocks 維持）と除外事項「再評価フロー内での新規組入候補の提案」（二重目的化の再発防止）
- `.planning/ROADMAP.md` §Phase 23 — Success Criteria 2項目（両パスでセクション非存在・highlightedStocks 受け渡し維持）

### 前フェーズの決定（隣接契約）
- `.planning/phases/22-portfolio-analyst-re-evaluation/22-CONTEXT.md` — D-21（レンダラーは純関数パターン+ユニットテスト、フォールバックパスの整合確認）。Phase 22 完了後のカード構造（urgent/判断変更バッジ）を壊さないこと
- `.planning/phases/20-holding-card-news-display/20-CONTEXT.md` — フォールバックパス（generate-portfolio-report.ts の null 分岐）に関する既存の整合確認前例

### 実装対象（コード内）
- `src/scripts/generate-portfolio-report.ts` 102-133行目 — `formatNewCandidatesHtml()` 本体（削除対象）
- `src/scripts/generate-portfolio-report.ts` 143・161・186行目 — `newCandidatesHtml` の生成と両パスへの埋め込み（削除対象）
- `src/scripts/generate-portfolio-report.ts` 1行目 — `scoreColor` / `verdictColor` import（未使用化に伴い除去）
- `src/scripts/generate-report.test.ts` Test 30（360-366行目付近）・Test 31 — テスト反転・追加の対象
- `.claude/commands/invest.md` 1746行目付近 — 「注目銘柄: [highlightedStocks 配列の全内容]」（**維持対象・変更禁止**）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/scripts/generate-report.test.ts` の validMeetingResult フィクスチャ（highlightedStocks に PLTR/8.2 を含む）: 非存在検証テストの入力にそのまま使える — 「候補が存在するのに表示されない」ことを検証できる
- 既存の Test 31（フォールバックパス検証）: `not.toContain` 追記先の候補

### Established Patterns
- レンダラーは純関数 + vitest ユニットテスト（generate-report.test.ts に集約）→ D-05/D-06 が踏襲
- TDD: 期待動作のテストを先に書いてから実装（プロジェクト規約）
- 未使用コードを残さない（refactor 時の import 整理を含む）→ D-01/D-02

### Integration Points
- `src/scripts/generate-report.ts` → `generatePortfolioReportHtml(result, portfolioAnalysis, resolvedHoldingNews)` 呼び出し: シグネチャ無変更のため配線変更なし（D-03）
- `src/scripts/report-utils.ts` の `scoreColor` / `verdictColor`: generate-daily-report.ts が引き続き使用するため関数本体は温存（D-02）
- `.claude/commands/invest.md` Step 3d: 読み取り専用の隣接領域 — 本フェーズでは一切変更しない（D-08）

</code_context>

<specifics>
## Specific Ideas

- 非存在検証は「highlightedStocks が非空の入力」で行う — 空配列なら削除前のコードでも空文字を返すため、擬似合格を構造的に排除する（D-05）
- 検証観点は文字列 `新規組入候補` の非含有 + 転載文言「Daily Reportのアナリストミーティングで推奨された銘柄です」の非含有

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope（削除のみの小規模フェーズであり、新規アイデアは発生せず）

</deferred>

---

*Phase: 23-New-Candidates Section Removal*
*Context gathered: 2026-07-04*
