# Phase 17: Pipeline Integration & Orchestration - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15の契約（`validateRawNewsCuration`/`resolveNewsCuration`）と Phase 16のレンダラー（`generateNewsDigestHtml`）を日次パイプライン（`/invest`）へ fail-soft 統合する。具体的には: `invest.md` へのキュレーションAgentステップ追加（Step 3dと並列）、`tmp/news-curation.json` の書き出し、news-digest.html を書き出す専用CLIスクリプト（検証→描画→書き出し）、専用 `[STEP:news-digest:*]` マーカー、pipeline-metrics へのキュレーション計測追加。対象要件: CURA-01（4紙目の自動生成）、OPS-04（fail-soft・失敗可視化）。

index.htmlの条件付きリンク出し分け（Phase 18）、契約・スキーマの変更（Phase 15完了済み）、レンダラー本体の変更（Phase 16完了済み）は含まない。

</domain>

<decisions>
## Implementation Decisions

### Agentステップの配置とモデル
- **D-01:** キュレーションAgentは Step 3d（portfolio-analyst）と同じメッセージで2体並列起動する。入力は `tmp/news.json` のみでミーティング結果に依存しないため並列可能。実行時間を伸ばさず、既存ステップ構造への変更も最小（リサーチ推奨案）。Round 1バッチへの混載（6体目）は関心事の混在と失敗判定の複雑化のため不採用。
- **D-02:** モデルは **opus**。「なぜ重要か」解説コメントとリード文の執筆品質がダイジェストの価値の中核であり、20〜80件→10〜15件の取捨選択は編集判断。日次1呼び出しのみでコスト影響小。portfolio-analyst（opus）と同格の扱い。

### キュレーションプロンプト設計
- **D-03:** 記事プールは **URL以外の全フィールド**（id + title + summary + source + publishedAt + ticker）を渡す。summaryがあることで解説コメントの根拠が豊かになる。URLを意図的に除外することで、AgentがURLをエコーする余地を構造的になくす（ID参照方式の徹底）。
- **D-04:** 市場分類（us/japan/global）は**数例のルールをプロンプトに明示**する: Fed金融政策・米経済指標→us、日銀・円相場→japan、原油・地政学・世界経済→global、個別企業は上場市場で判定。細部はAgent判断に委ねる（ベストエフォート方針はロードマップで確定済み）。
- **D-05:** 重要度判定（high/medium/low と選定自体）は市場全体へのインパクトを主軸にしつつ、**ポートフォリオ保有銘柄・監視中銘柄に直接関係するニュースは優先度を上げる**とプロンプトに明記する。個人投資家の意思決定支援というツールの目的に合致（NEWS-01のティッカー別取得データを活かす）。
- **D-06:** tickerNames の会社名は**英語正式名で統一**（例: NVDA→NVIDIA）。カタカナ表記の揺れを避ける。※Phase 16 D-04の契約（社名欠落時はシンボルのみ表示）はそのまま。

### 失敗時の挙動詳細
- **D-07:** Agentが不正JSONを返した場合は**1回リトライ**（portfolio-analyst / moderator の既存慣例に一致）。2回目も失敗なら `tmp/news-curation.json` を作成せずに続行（fail-soft）。
- **D-08:** キュレーション完全失敗日も **news-digest.html はフォールバックページとして書き出す**（Phase 16 D-12の「生成できませんでした」ページ）。ファイルは常に存在しindexリンクも常に有効。失敗が読者にも可視化される。Phase 18の条件分岐は主に v2.4 以前の過去日付エントリ向けとなる。
- **D-09:** 失敗の把握は**ログのみ**: `[STEP:news-digest:FAIL:理由]` マーカー（OPS-04要件通り）。fail-soft下ではパイプライン全体は `[PIPELINE:OK]` で完了し、run.sh の通知基盤には手を入れない（Phase 14.1で調整済みの run.sh への回帰リスクを避ける）。成功時は `[STEP:news-digest:OK]`。

### generate-report.ts への統合方式
- **D-10:** 検証（validateRaw→resolve）・描画・書き出しは**専用CLIスクリプト**（例: `src/scripts/write-news-digest.ts`）に置き、invest.md から `generate-report.ts` の後に別コマンドで起動する。プロセス境界そのものが fail-soft 分離になり、exit code / stdout で OK/FAIL 判定が単純。既存 `generate-report.ts` は無改修（回帰リスクゼロ）。
- **D-11:** pipeline-metrics.json と最終タイミング表示に**キュレーションの専用行を追加**する。並列窓（Step 3d）のAgent計測と、news-digest書き出しCLIの計測を追加し、v2.2の12ステップ表示思想を維持する。

### Claude's Discretion
- CLIスクリプトの正確なファイル名・関数分割（既存 `generate-report.ts` / `validate-meeting.ts` の慣例に従う）
- キュレーションAgentの name（例: `news-curator`）とプロンプトの正確な文面（D-03〜D-06の決定を満たすこと。出力JSONフォーマット例は既存Agentステップの様式に従う）
- pipeline-metrics のキー名・タイミング表の行ラベル
- invest.md の Step 3c 完了確認表示への news-digest.html 追加の具体形
- FAILマーカーの理由文字列の粒度（Agent失敗 / JSON不正 / 書き出し失敗の区別が事後調査で分かる程度）
- 「正常だが0件」の日はPhase 15 D-05の通り有効な契約なので `[STEP:news-digest:OK]` 扱い（グレースフル0件表示はレンダラー実装済み）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.4 リサーチ（統合ピットフォールの根拠）
- `.planning/research/SUMMARY.md` — Phase 3（本フェーズ）の推奨アプローチ: Step 3d並列配置、独立try/catch、専用STEPマーカー。Pitfall 1/7/8（Promise.all道連れ・デプロイ阻害・tmp/ハンドオフ違反）
- `.planning/research/PITFALLS.md` — ピットフォールの行レベル根拠
- `.planning/research/ARCHITECTURE.md` — Pattern 1（単発Agent呼び出し、portfolio-analyst と同形）

### 上流成果物（Phase 15/16 — 本フェーズが配線する部品）
- `src/meeting/schemas.ts` — `validateRawNewsCuration`（第1層: 構造検証、throwする）/ `resolveNewsCuration`（第2層: ID解決・ソフトクランプ、throwしない）/ `NewsArticlePoolEntry`
- `src/meeting/types.ts` — `NewsCuration` / `CuratedArticle` 型
- `src/scripts/generate-news-digest.ts` — `generateNewsDigestHtml(curation: NewsCuration | null, date: string): string`（nullでフォールバックページを返す、D-08の前提）
- `.planning/phases/15-curation-contract-schema/15-CONTEXT.md` — D-05（null vs 空配列のセマンティクス）、D-08（不正ID drop）
- `.planning/phases/16-report-generator-html-rendering/16-CONTEXT.md` — D-04（tickerNames契約、プロンプト指示はPhase 17スコープ = 本フェーズ）、D-12（nullフォールバックページ）

### 統合先（本フェーズで変更するファイル）
- `.claude/commands/invest.md` — パイプライン定義。Step 3d（portfolio-analyst並列起動先、1564行付近）、Step 3c（レポート生成・完了確認表示）、STEPマーカー慣例、pipeline-metrics計測ブロック、既存リトライ慣例（moderator/portfolio-analyst = 1回）
- `src/scripts/generate-report.ts` — 無改修方針（D-10）だが呼び出し規約・データローダー慣例の参考
- `src/scripts/report-data-loaders.ts` — `loadPortfolioAnalysis()` の「失敗時null + console.error」ローダーパターン（news-curation読み込みの手本）
- `src/scripts/collect-data.ts` — ID付き `tmp/news.json` の書き出し元（`assignArticleIds` 適用済み、Phase 15完了）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveNewsCuration()`: プール照合・重複/不明ID drop・件数ソフトクランプが実装済み — CLIスクリプトは「読む→validateRaw→resolve→render→write」を繋ぐだけ
- `generateNewsDigestHtml()`: null/空配列/正常系すべてのレンダリングが実装・テスト済み
- invest.md の既存Agentステップ様式: systemPrompt埋め込み・「JSONのみ出力」指示・リトライ→フォールバックの定型文（portfolio-analyst が最も近い手本）
- pipeline-metrics の計測ブロック定型（`node -e` でタイムスタンプ追記）

### Established Patterns
- `tmp/*.json` ファイルハンドオフが TS↔Claude の唯一の境界（Agent出力は invest.md 側が保存）
- STEPマーカー: `[STEP:name:START]` → `[STEP:name:OK]` / `[STEP:name:FAIL:理由]`（Bash echoで出力、run.shがログから検知）
- fail-soft: 部分失敗は console.warn/error + フォールバックで継続、パイプラインは止めない
- 日付は `tmp/meeting-result.json` の `date` を正とし、`^\d{4}-\d{2}-\d{2}$` 検証済みの値のみシェルに渡す（Phase 14.1慣例）

### Integration Points
- `invest.md` Step 3d: portfolio-analyst と同一メッセージにキュレーションAgentを追加（D-01）
- `invest.md` Step 3c後 or Step 4前: 専用CLI起動 + `[STEP:news-digest:*]` マーカー（D-10。generate-report.ts 実行後、update-index.ts 実行前であること — Phase 18がindex反映を担う）
- `src/scripts/write-news-digest.ts`（新規）: `tmp/news-curation.json` + `tmp/news.json`（プール）+ `tmp/meeting-result.json`（date）→ `docs/YYYY-MM-DD/news-digest.html`
- pipeline-metrics.json: キュレーション計測キー追加（D-11）

</code_context>

<specifics>
## Specific Ideas

- 会社名は英語正式名で統一（例: NVIDIA）— カタカナ推奨案をユーザーが明示的に退けた選択。Phase 16 D-04「会社名を書いてほしい」要望の実現形として英語表記を採用
- ダイジェストは中立報道ではなく「自分のポートフォリオを持つ個人投資家のための編集」— 保有銘柄関連ニュースの優遇（D-05）はその表れ
- 失敗日も「ファイルがない」ではなく「生成できませんでしたページがある」状態にする — 障害が閲覧時に分かることを優先（D-08）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope（run.sh通知の拡張はD-09で意図的に不採用として決着、v2.5+のXREP-01は既にREQUIREMENTS.mdで追跡済み）

</deferred>

---

*Phase: 17-Pipeline Integration & Orchestration*
*Context gathered: 2026-07-02*
