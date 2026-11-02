# /invest パイプライン引き継ぎ 2026-11-03（Step 3a 完了時点）

状態: Step 1・Step 2（R1〜R3・最終統合・ETF除外・validate・watchlist 更新 2h・追跡データ 2i）、Step 3.0・3-P（保有14/14成功）・3a（WebSearch 14/14成功）まで全て OK（2026-11-03）。tmp/ に保存済み（meeting-result.json date=2026-11-03, 注目14銘柄: 中立7・弱気7、強気なし）。ウォッチリストはアクティブ0件。未コミット・未デプロイ
次: .claude/commands/invest.md の Step 3-J の CLI（`npx tsx src/scripts/write-watchlist-judgment.ts` のみ。アクティブ0件なので Agent は起動しない）→ 3b 再評価 → 3d（先に前日退避の node コマンド）→ 3f → 3c → 3e → Step 4 を順に実行 → 末尾の完了サマリーと Pipeline Timing 表示
読む: .claude/commands/invest.md（「Step 3-J」〜「3.0」ではなく「### Step 3b」以降と「3-J の 3-J.0 退避コマンド」のみ）, tmp/meeting-result.json（highlightedStocks のティッカー一覧と marketOverview のみ）, src/portfolio/holdings.ts（14銘柄）, 本ファイル「実行メモ」
検証: [STEP:report-generation:OK] / docs/2026-11-03/ に daily-report・meeting-minutes・portfolio-report・news-digest の4ファイル / git push 成功 / [PIPELINE:OK]

（/pickup が読むのはここまでと「次:」が指す節だけ。古い引き継ぎは .planning/HANDOFF-invest-pipeline-2026-10-23.md 以前）

## 実行メモ（2026-11-03 の Step 1〜3a で採った方式）
- 各エージェントには systemPrompt・データを埋め込まず、`src/agents/*.ts` と `tmp/*.json` を Read させる方式。Round 1〜3・モデレーターの出力は最終応答のJSONを `/tmp/extract.cjs`（`node /tmp/extract.cjs <agent output_file> <dest> <id> <role> <r1|r2|r3>`）で所定パスに保存した。Step 3-P・3a はエージェント自身が Write で保存し応答は「done」のみ。`/tmp/extract.cjs` が無ければ、エージェント自身に Write させる方式にする
- Step 3b の再評価5体は `tmp/websearch/*.json`・`tmp/technicals.json`・`tmp/round-3/{agent}.json` を Read させ、`tmp/reeval/{agent}.json` に自分で Write させる（スキーマは invest.md の「Step 3b」の `reevaluations` 配列。`scores` ではなく `reevaluations`）
- 3d: portfolio-analyst と news-curator は opus。`tmp/prev-portfolio-analysis.json` の退避（date ガード付き node コマンド）を**先に**実行。news-curator には `tmp/news.json` の url・category を除く6フィールドのみ渡す。両者の出力は `tmp/portfolio-analysis.json` / `tmp/news-curation.json`（agent に Write させるのが安い）
- ルートに `meeting-result.json` を作らない（generate-report は `tmp/meeting-result.json` を読む）。エージェント名に `.` は使えない
- pipeline-metrics.json は `portfolioResearchEnd` まで記録済み。`webSearchStart`（3a 開始分）は未記録のため 3b 開始時に `webSearchStart` と `webSearchEnd` を記録してよい
- 注意: moderator-tickers に ETF（XLE 等）と曖昧ティッカー（GMO, HBM）が含まれたが、モデレーターが ETF を除外し HBM（Hudbay Minerals）は残した。GMO は除外済み。filter-etf-stocks は 0件除外・14件残存
- 完了待ちに `Monitor` でファイル数を数えない（`tmp/round-2/` に過去日の古いファイルが残る）。Agent の完了通知を数えるか mtime が当日かで判定する
- コミット対象は `docs/ docs_old/ data/` のみ（invest.md の Step 4 の node コマンドに従う）。作業ツリーの他の未コミット変更（agents/*.ts, run.sh 等）は含めない
