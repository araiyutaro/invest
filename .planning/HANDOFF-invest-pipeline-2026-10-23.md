# /invest パイプライン引き継ぎ 2026-10-23（Step 3-J 完了時点）

状態: Step 1・Step 2（R1〜R3・最終統合・ETF除外・validate・watchlist 更新 2h・追跡データ 2i）、Step 3.0・3-P（保有14/14成功）・3-J（判定4件 wait/buy は CLI 出力済み）まで全て OK。tmp/ に保存済み（meeting-result.json date=2026-10-23, 注目11銘柄）。3a 以降は未着手・未コミット
次: .claude/commands/invest.md の Step 3a → 3b → 3d → 3f → 3c → 3e → Step 4 を順に実行（pipeline-metrics.json は webSearchStart から追記。portfolioResearchEnd までは記録済み）
読む: .claude/commands/invest.md（「Step 3a」以降のみ）, tmp/meeting-result.json（highlightedStocks と marketOverview）, tmp/technicals.json, tmp/round-3/*.json, src/portfolio/holdings.ts, tmp/portfolio-research/*.json
検証: [STEP:report-generation:OK] / docs/2026-10-23/ に daily-report・meeting-minutes・portfolio-report・news-digest の4ファイル / git push 成功 / [PIPELINE:OK]

（/pickup が読むのはここまでと「次:」が指す節だけ。古い引き継ぎは .planning/HANDOFF-invest-pipeline-2026-10-19.md 以前）

## 実行メモ（2026-10-23 の Step 1〜3-J で採った方式）
- 各エージェントには systemPrompt・データを埋め込まず、`src/agents/*.ts` と `tmp/*.json` を Read させ、結果は**エージェント自身が Write で所定パスに保存**し最終応答は「OK」のみ、とする方式（出力トークン節約）。Step 3 の 3a・3b・3d もこの方式でよい。保存後は node で JSON.parse と mtime（今日の日付か）を確認する
- 完了待ちに `Monitor` で「ファイル数」を数えてはいけない（`tmp/round-2/` には過去日の古いファイルが残っており即発火した）。Agent の完了通知を数えるか、mtime が当日かで判定する
- Agent 名に `.` は使えない（8522.T → `...-8522T`）。ただし保存ファイル名は `.T` を保持
- `tmp/watchlist-technicals.json` の snapshots のキーは `ticker` ではなく `symbol`
- 3-J は CLI（write-watchlist-judgment.ts）が自前で `[STEP:watchlist-judgment:OK]` を出す。invest.md 側で追加 echo 不要。ここまで出力済み

## 2026-10-23 の結果（Step 3a/3b/3d の入力）
- 市場: S&P -1.21%, NASDAQ -2.60%, Nikkei -2.65%, VIX 19.03（+14%）。AI 過剰投資懸念で半導体・テック急落、ディフェンシブ（XLP +3.3%, XLU +2.1%）高。トレンド=混合
- 注目11銘柄（平均スコア）: 3993.T 6.4 / CHRD 6.2 / KN 5.4 / 3692.T 5.4 / 3923.T 5.4 / EQT 4.8 / NRIM 4.2 / DOW 4.0（以上中立）/ AMBA 3.4 / UAL 2.8 / LRCX 2.6（弱気）。強気 0 件
- extract-tickers.ts が ETF（XLP/XLU/XLF/XLK/XLV）と一般語（PHP/ESMO/CDS/PKSHA）を拾う癖あり（21銘柄中）。最終統合で除外済み。スクリプト側の改善余地
- 3a の websearch 対象は上の11銘柄（Agent 名例: websearch-3993T, websearch-CHRD）。出力先 tmp/websearch/{ticker}.json
- ウォッチリスト active は 5310.T / ALAB / 3891.T / 5334.T の4件。判定は tmp/watchlist-judgment.json（skip 0, 降格 0）
- 前日の注目銘柄は tmp/prev-highlighted-stocks.json に退避済み。Step 3d の前日比較用 tmp/prev-portfolio-analysis.json は 3d 冒頭の node コマンドで作る（未実行）
- 保有14銘柄: MRNA JOBY HII POWL EE 8522.T 5885.T 5576.T 7711.T NXT BWMX YOU ASML IRTC（tmp/portfolio-research/ に14ファイル、全て有効）

## 注意
- Step 4 のデプロイは `git add docs/ docs_old/ data/` → commit → push origin master。作業ツリーに無関係な変更（src/agents/*.ts, scripts/run.sh, .claude/commands/invest.md 等）が残っているが、add 対象外なのでコミットには入らない
- 市場データ・テクニカルは 2026-10-22 終値ベース（実行日 2026-10-23）
