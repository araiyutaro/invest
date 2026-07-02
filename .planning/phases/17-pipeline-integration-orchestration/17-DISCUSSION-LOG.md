# Phase 17: Pipeline Integration & Orchestration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 17-Pipeline Integration & Orchestration
**Areas discussed:** Agentステップの配置とモデル, キュレーションプロンプト設計, 失敗時の挙動詳細, generate-report.tsへの統合方式

---

## Agentステップの配置とモデル

| Option | Description | Selected |
|--------|-------------|----------|
| Step 3dと並列 (推奨) | portfolio-analystと同じメッセージで2体並列起動。実行時間を伸ばさず既存構造への変更最小 | ✓ |
| 独立逐次ステップ | 新規の専用逐次ステップ。境界は明確だが1 Agent分実行時間が延びる | |
| 早期配置（Step 2と並行） | Round 1バッチに6体目として混載。最大並列だが関心事混在・失敗判定複雑化 | |

**User's choice:** Step 3dと並列
**Notes:** キュレーション入力は tmp/news.json のみでミーティング結果に非依存のため並列可能。リサーチが「Phase 17計画時に決める」とフラグした未解決論点を解消。

| Option | Description | Selected |
|--------|-------------|----------|
| opus (推奨) | 解説コメント・リード文の執筆品質が価値の中核。日次1呼び出しでコスト影響小。portfolio-analystと同格 | ✓ |
| sonnet | コスト重視。選定を分類・抽出タスクと見なす | |

**User's choice:** opus

---

## キュレーションプロンプト設計

| Option | Description | Selected |
|--------|-------------|----------|
| URL以外を全部渡す (推奨) | id + title + summary + source + publishedAt + ticker。summaryで解説の根拠が豊かに。URL除外でエコーの余地を構造的に排除 | ✓ |
| id+タイトル+ソースのみ | プロンプト最小化だが解説がタイトルからの推測になる | |
| URLも含め全フィールド | 情報最大だがURLエコーの誘因（ID参照設計と矛盾気味） | |

**User's choice:** URL以外を全部渡す

| Option | Description | Selected |
|--------|-------------|----------|
| 数例のルールを明示 (推奨) | Fed・米指標→us、日銀・円相場→japan、原油・地政学→global、個別企業は上場市場。細部はAgent判断 | ✓ |
| 完全にAgent判断 | enum制約のみ。日によって分類が揺れる可能性 | |
| 詳細な判定表を作る | 分類は安定するがベストエフォート方針に対し過剰設計 | |

**User's choice:** 数例のルールを明示

| Option | Description | Selected |
|--------|-------------|----------|
| 保有銘柄を加点要素に (推奨) | 市場インパクト主軸 + 保有・監視銘柄直接関連は優先度アップと明記。ツールの目的に合致 | ✓ |
| 市場インパクトのみ | ミーティングのポートフォリオ非依存原則と揃える中立報道路線 | |
| 観点は指定しない | Agentの編集判断に完全に委ねる | |

**User's choice:** 保有銘柄を加点要素に

| Option | Description | Selected |
|--------|-------------|----------|
| 日本語名優先 (推奨) | 「エヌビディア」等カタカナ/日本語名。既存nameJa慣例と一致 | |
| 英語正式名 | 「NVIDIA」等で統一。表記揺れが減る | ✓ |

**User's choice:** 英語正式名
**Notes:** 推奨（日本語名優先）を退けてユーザーが明示選択。表記揺れの少なさを優先。

---

## 失敗時の挙動詳細

| Option | Description | Selected |
|--------|-------------|----------|
| 1回リトライ (推奨) | portfolio-analyst/moderatorの既存慣例。2回目失敗で news-curation.json 非作成で続行 | ✓ |
| リトライなし | 1回失敗で即フォールバック | |
| 2回リトライ | 粘るが慣例から外れ実行時間ペナルティ大 | |

**User's choice:** 1回リトライ

| Option | Description | Selected |
|--------|-------------|----------|
| フォールバック頁を書く (推奨) | null→D-12のフォールバックページを書き出す。ファイル常存・リンク常有効・失敗が読者にも可視 | ✓ |
| ファイルを書かない | 失敗日は非生成。Phase 18がリンクを出さない | |

**User's choice:** フォールバック頁を書く
**Notes:** Phase 18の条件付きリンクは主に v2.4 以前の過去日付向けの機能になる。

| Option | Description | Selected |
|--------|-------------|----------|
| ログのみ (推奨) | [STEP:news-digest:FAIL:理由] マーカーのみ（OPS-04要件通り）。run.sh無改修 | ✓ |
| run.shに警告通知を追加 | 確実に気づけるがPhase 14.1調整済みのrun.shへの回帰リスク | |

**User's choice:** ログのみ

---

## generate-report.tsへの統合方式

| Option | Description | Selected |
|--------|-------------|----------|
| 専用CLIスクリプト (推奨) | write-news-digest.ts を別コマンド起動。プロセス境界がfail-soft分離、exit codeでOK/FAIL判定単純、generate-report.ts無改修 | ✓ |
| generate-report.tsに組込 | リサーチ推奨案。main()内独自try/catch + loadNewsCuration()。起動1回だがSTEPマーカー判定にstdout目印が必要 | |

**User's choice:** 専用CLIスクリプト
**Notes:** リサーチはgenerate-report.ts組込を推奨していたが、STEPマーカーのOK/FAIL判定がexit codeで単純化できる点と既存スクリプト無改修（回帰ゼロ）を優先。

| Option | Description | Selected |
|--------|-------------|----------|
| 専用行を追加 (推奨) | pipeline-metricsとタイミング表示にキュレーション行を追加。12ステップ表示思想を維持 | ✓ |
| 計測は追加しない | 変更範囲は減るが所要時間・失敗が見えない | |

**User's choice:** 専用行を追加

---

## Claude's Discretion

- CLIスクリプトの正確なファイル名・関数分割
- キュレーションAgentのnameとプロンプトの正確な文面（D-03〜D-06を満たすこと）
- pipeline-metricsのキー名・タイミング表の行ラベル
- invest.md Step 3c完了確認表示へのnews-digest.html追加の具体形
- FAILマーカー理由文字列の粒度
- 正常0件日は [STEP:news-digest:OK] 扱い（Phase 15 D-05のセマンティクス踏襲）

## Deferred Ideas

None — 議論はフェーズスコープ内に収まった（run.sh通知拡張はD-09で意図的不採用として決着）
