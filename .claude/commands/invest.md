---
description: "投資分析パイプラインを実行。データ収集→5アナリスト並列分析→モデレーター統合→レポート生成"
allowed-tools:
  - Bash
  - Agent
---

# /invest 投資分析パイプライン

投資分析の全パイプラインを実行します。データ収集から5アナリストの並列分析、モデレーターによる統合、レポート生成まで一括実行します。

---

## Step 1: データ収集

市場データ・ニュース・ポートフォリオデータを収集し、`tmp/` に保存します。

「市場データ収集を開始します...」とユーザーに表示してから、以下のBashコマンドを実行してください:

```bash
cd /Users/arai/invest && npx tsx src/scripts/collect-data.ts
```

データ収集完了後、以下のファイルの存在を確認し、収集サマリーをユーザーに表示してください:

- `tmp/market.json` — 市場指数・セクターETFデータ
- `tmp/news.json` — ニュース記事データ
- `tmp/portfolio.json` — ポートフォリオ銘柄データ

確認コマンド:
```bash
cd /Users/arai/invest && node -e "
const fs = require('fs');
const market = JSON.parse(fs.readFileSync('tmp/market.json', 'utf-8'));
const news = JSON.parse(fs.readFileSync('tmp/news.json', 'utf-8'));
const portfolio = JSON.parse(fs.readFileSync('tmp/portfolio.json', 'utf-8'));
console.log('データ収集完了:');
console.log('  市場指数:', market.indices.length, '件');
console.log('  セクター:', market.sectors.length, '件');
console.log('  ニュース:', news.length, '件');
console.log('  ポートフォリオ銘柄:', portfolio.length, '銘柄');
"
```

---

## Step 2: アナリスト並列分析ミーティング

5アナリストを3ラウンド制で並列実行し、モデレーターが統合して `tmp/meeting-result.json` を生成します。

---

### Step 2.0: 準備

「アナリストミーティングを開始します...」とユーザーに表示してください。

まず中間ファイル用のディレクトリを作成してください:

```bash
mkdir -p /Users/arai/invest/tmp/round-1 /Users/arai/invest/tmp/round-2 /Users/arai/invest/tmp/round-3
```

次に、以下のファイルを Read ツールで読み込んでください（後のステップで Agent prompt に埋め込むために必要です）:

- `/Users/arai/invest/src/agents/fundamentals.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/src/agents/tenbagger.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/src/agents/macro.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/src/agents/technical.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/src/agents/risk-manager.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/src/agents/moderator.ts` — `systemPrompt` フィールドの値を取得
- `/Users/arai/invest/tmp/market.json` — 全内容
- `/Users/arai/invest/tmp/news.json` — 全内容（最新50件に絞って使用）

---

### Step 2a: Round 1 — 分析プレゼンテーション

「Round 1: 5アナリストが分析を実行中...」とユーザーに表示してください。

**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

**Agent 1: ファンダメンタルズアナリスト**
- name: `fundamentals-r1`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/fundamentals.ts` から取得した `systemPrompt` の全文
  - 以下の分析指示:
    ```
    以下の市場データとニュースデータを分析し、ポートフォリオとは独立してニュース・市況から注目銘柄を発掘してください。

    ## 市場データ (tmp/market.json)
    [tmp/market.json の全内容]

    ## ニュースデータ (tmp/news.json) ※最新50件
    [tmp/news.json の最新50件の内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "fundamentals",
      "agentRole": "ファンダメンタルズアナリスト",
      "analysis": "## 市場認識\n[1段落以上、200〜400文字]\n\n## 専門領域からの洞察\n[財務指標・バリュエーション視点で1段落以上、200〜400文字]\n\n## 注目銘柄の詳細分析\n[推奨銘柄のファンダメンタルズ詳細で1段落以上、200〜400文字]\n\n## リスクと懸念\n[1段落以上、200〜400文字]",
      "summary": "全体サマリー（300文字以内）",
      "highlights": ["注目ポイント1", "注目ポイント2", "注目ポイント3"],
      "risks": ["リスク1", "リスク2"],
      "picks": [
        {"ticker": "AAPL", "direction": "強気", "rationale": "推奨理由（300文字以内）"}
      ],
      "sectorView": "セクター見通し（1-2文）"
    }

    注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
    ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
    analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
    ```

**Agent 2: テンバガーハンター**
- name: `tenbagger-r1`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/tenbagger.ts` から取得した `systemPrompt` の全文
  - 以下の分析指示:
    ```
    以下の市場データとニュースデータを分析し、ポートフォリオとは独立してニュース・市況から注目銘柄を発掘してください。

    ## 市場データ (tmp/market.json)
    [tmp/market.json の全内容]

    ## ニュースデータ (tmp/news.json) ※最新50件
    [tmp/news.json の最新50件の内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "tenbagger",
      "agentRole": "テンバガーハンター",
      "analysis": "## 市場認識\n[1段落以上、200〜400文字]\n\n## 専門領域からの洞察\n[成長ストーリー・TAM視点で1段落以上、200〜400文字]\n\n## 注目銘柄の詳細分析\n[テンバガー候補の詳細分析で1段落以上、200〜400文字]\n\n## リスクと懸念\n[1段落以上、200〜400文字]",
      "summary": "全体サマリー（300文字以内）",
      "highlights": ["注目ポイント1", "注目ポイント2", "注目ポイント3"],
      "risks": ["リスク1", "リスク2"],
      "picks": [
        {"ticker": "AAPL", "direction": "強気", "rationale": "推奨理由（300文字以内）"}
      ],
      "sectorView": "セクター見通し（1-2文）"
    }

    注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
    ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
    analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
    ```

**Agent 3: マクロエコノミスト**
- name: `macro-r1`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/macro.ts` から取得した `systemPrompt` の全文
  - 以下の分析指示:
    ```
    以下の市場データとニュースデータを分析し、マクロ経済の視点からセクター・テーマレベルの推奨を提供してください。ポートフォリオとは独立してニュース・市況から注目銘柄を発掘してください。

    ## 市場データ (tmp/market.json)
    [tmp/market.json の全内容]

    ## ニュースデータ (tmp/news.json) ※最新50件
    [tmp/news.json の最新50件の内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "macro",
      "agentRole": "マクロエコノミスト",
      "analysis": "## 市場認識\n[1段落以上、200〜400文字]\n\n## 専門領域からの洞察\n[セクターローテーション・マクロ視点で1段落以上、200〜400文字]\n\n## 注目銘柄の詳細分析\n[テーマ銘柄や関連ETF等の詳細で1段落以上、200〜400文字]\n\n## リスクと懸念\n[1段落以上、200〜400文字]",
      "summary": "全体サマリー（300文字以内）",
      "highlights": ["注目ポイント1", "注目ポイント2", "注目ポイント3"],
      "risks": ["リスク1", "リスク2"],
      "picks": [
        {"ticker": "AAPL", "direction": "強気", "rationale": "推奨理由（300文字以内）"}
      ],
      "sectorView": "セクター見通し（1-2文）"
    }

    注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
    macroはセクターレベルでの推奨が主体なので、個別銘柄picksは 0〜2 銘柄（0件も可）で構いません。ポートフォリオ保有銘柄の評価は対象外です。
    analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
    ```

**Agent 4: テクニカルストラテジスト**
- name: `technical-r1`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/technical.ts` から取得した `systemPrompt` の全文
  - 以下の分析指示:
    ```
    以下の市場データとニュースデータを分析し、テクニカル視点から注目銘柄を発掘してください。

    ## 市場データ (tmp/market.json)
    [tmp/market.json の全内容]

    ## ニュースデータ (tmp/news.json) ※最新50件
    [tmp/news.json の最新50件の内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "technical",
      "agentRole": "テクニカルストラテジスト",
      "analysis": "## 市場認識\n[1段落以上、200〜400文字]\n\n## 専門領域からの洞察\n[チャートパターン・テクニカル指標視点で1段落以上、200〜400文字]\n\n## 注目銘柄の詳細分析\n[エントリー/エグジットポイント含む詳細で1段落以上、200〜400文字]\n\n## リスクと懸念\n[1段落以上、200〜400文字]",
      "summary": "全体サマリー（300文字以内）",
      "highlights": ["注目ポイント1", "注目ポイント2", "注目ポイント3"],
      "risks": ["リスク1", "リスク2"],
      "picks": [
        {"ticker": "AAPL", "direction": "強気", "rationale": "推奨理由（300文字以内）"}
      ],
      "sectorView": "セクター見通し（1-2文）"
    }

    注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
    ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
    analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
    ```

**Agent 5: リスクマネージャー**
- name: `risk-manager-r1`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/risk-manager.ts` から取得した `systemPrompt` の全文
  - 以下の分析指示:
    ```
    以下の市場データとニュースデータを分析し、リスク管理の視点からリスク要因と懸念銘柄を特定してください。

    ## 市場データ (tmp/market.json)
    [tmp/market.json の全内容]

    ## ニュースデータ (tmp/news.json) ※最新50件
    [tmp/news.json の最新50件の内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "risk-manager",
      "agentRole": "リスクマネージャー",
      "analysis": "## 市場認識\n[1段落以上、200〜400文字]\n\n## 専門領域からの洞察\n[リスク要因・地政学的リスク視点で1段落以上、200〜400文字]\n\n## 注目銘柄の詳細分析\n[リスク銘柄や弱気推奨銘柄の詳細で1段落以上、200〜400文字]\n\n## リスクと懸念\n[最悪シナリオを含む1段落以上、200〜400文字]",
      "summary": "全体サマリー（300文字以内）",
      "highlights": ["注目ポイント1", "注目ポイント2", "注目ポイント3"],
      "risks": ["リスク1", "リスク2"],
      "picks": [
        {"ticker": "AAPL", "direction": "弱気", "rationale": "警戒理由（300文字以内）"}
      ],
      "sectorView": "セクター見通し（1-2文）"
    }

    注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
    ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
    analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
    ```

**Round 1 完了後の処理:**

各エージェントの応答をJSONとしてパースし、以下のファイルに保存してください:
- `fundamentals-r1` の出力 → `/Users/arai/invest/tmp/round-1/fundamentals.json`
- `tenbagger-r1` の出力 → `/Users/arai/invest/tmp/round-1/tenbagger.json`
- `macro-r1` の出力 → `/Users/arai/invest/tmp/round-1/macro.json`
- `technical-r1` の出力 → `/Users/arai/invest/tmp/round-1/technical.json`
- `risk-manager-r1` の出力 → `/Users/arai/invest/tmp/round-1/risk-manager.json`

出力が有効なJSONでない場合は、`{"agentId": "...", "error": "invalid JSON", "picks": []}` を保存してください。

**失敗カウント:** 保存に失敗したエージェントをカウントし、3人以上失敗した場合は「エラー: Round 1 で3人以上のアナリストが失敗しました。ミーティングを中止します。」とユーザーに表示してパイプラインを停止してください。

成功したエージェント数をユーザーに表示してください:
「Round 1 完了: N/5 アナリスト成功」

---

### Step 2b: モデレーター介入1 — ティッカー抽出

「ティッカー抽出中...」とユーザーに表示してください。

以下のBashコマンドで、Round 1 の全結果から推奨銘柄ティッカーを収集してください:

```bash
node -e "
const fs = require('fs');
const roundDir = '/Users/arai/invest/tmp/round-1';
const agents = ['fundamentals', 'tenbagger', 'macro', 'technical', 'risk-manager'];
const tickerSet = new Set();

for (const agent of agents) {
  try {
    const data = JSON.parse(fs.readFileSync(roundDir + '/' + agent + '.json', 'utf-8'));
    // picks配列からティッカー抽出
    if (data.picks && Array.isArray(data.picks)) {
      for (const pick of data.picks) {
        if (pick.ticker && typeof pick.ticker === 'string' && pick.ticker !== 'UNKNOWN') {
          tickerSet.add(pick.ticker.trim());
        }
      }
    }
    // summary, highlights, sectorViewからもティッカーパターンを正規表現抽出
    const texts = [data.summary || '', ...(data.highlights || []), data.sectorView || ''].join(' ');
    const usPattern = /\b([A-Z]{1,5})\b/g;
    const jpPattern = /(\d{4})\.T\b/g;
    let m;
    while ((m = usPattern.exec(texts)) !== null) {
      // 一般的な英単語フィルタ（除外リスト）
      const common = new Set(['AI','US','IT','GDP','FRB','BOJ','CPI','PMI','EV','IPO','ETF','PE','PB','CF','MoS','VIX','OK','NO','BY','IN','AT','ON','TO','AS','OF','OR','IF','IS','BE','DO','GO']);
      if (!common.has(m[1]) && m[1].length >= 2) {
        tickerSet.add(m[1]);
      }
    }
    while ((m = jpPattern.exec(texts)) !== null) {
      tickerSet.add(m[1] + '.T');
    }
  } catch(e) {
    // ファイル読み込みエラーは無視
  }
}

const tickers = Array.from(tickerSet);
fs.writeFileSync('/Users/arai/invest/tmp/moderator-tickers.json', JSON.stringify({ tickers }, null, 2));
console.log('ティッカー抽出: ' + tickers.length + '銘柄を特定');
console.log(tickers.join(', '));
"
```

「ティッカー抽出: N銘柄を特定」とユーザーに表示してください。

---

### Step 2c: Round 2 — ディスカッション

「Round 2: ディスカッション実行中...」とユーザーに表示してください。

まず `/Users/arai/invest/tmp/round-1/` の各ファイルを Read ツールで読み込んでください。

各エージェントへの入力として、他4人のRound 1 結果の `highlights` と `picks` のみを抽出します（入力サイズ制御のため `summary` の詳細は除外）。

**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

**Agent 1: ファンダメンタルズアナリスト（Round 2）**
- name: `fundamentals-r2`
- model: `sonnet`
- prompt: 以下の内容を含めてください
  - `src/agents/fundamentals.ts` から取得した `systemPrompt` の全文
  - 以下のディスカッション指示:
    ```
    以下は他のチームメンバーの分析（highlights と picks のみ）です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。

    ## 他メンバーの分析サマリー
    ### テンバガーハンター
    highlights: [tmp/round-1/tenbagger.json の highlights フィールド]
    picks: [tmp/round-1/tenbagger.json の picks フィールド]

    ### マクロエコノミスト
    highlights: [tmp/round-1/macro.json の highlights フィールド]
    picks: [tmp/round-1/macro.json の picks フィールド]

    ### テクニカルストラテジスト
    highlights: [tmp/round-1/technical.json の highlights フィールド]
    picks: [tmp/round-1/technical.json の picks フィールド]

    ### リスクマネージャー
    highlights: [tmp/round-1/risk-manager.json の highlights フィールド]
    picks: [tmp/round-1/risk-manager.json の picks フィールド]

    簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "fundamentals",
      "comment": "500文字以内のディスカッションコメント",
      "agreements": ["同意点1", "同意点2"],
      "disagreements": ["異議点1"]
    }
    ```

**Agent 2: テンバガーハンター（Round 2）**
- name: `tenbagger-r2`
- model: `sonnet`
- prompt: 以下の内容を含めてください
  - `src/agents/tenbagger.ts` から取得した `systemPrompt` の全文
  - 以下のディスカッション指示:
    ```
    以下は他のチームメンバーの分析（highlights と picks のみ）です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。

    ## 他メンバーの分析サマリー
    ### ファンダメンタルズアナリスト
    highlights: [tmp/round-1/fundamentals.json の highlights フィールド]
    picks: [tmp/round-1/fundamentals.json の picks フィールド]

    ### マクロエコノミスト
    highlights: [tmp/round-1/macro.json の highlights フィールド]
    picks: [tmp/round-1/macro.json の picks フィールド]

    ### テクニカルストラテジスト
    highlights: [tmp/round-1/technical.json の highlights フィールド]
    picks: [tmp/round-1/technical.json の picks フィールド]

    ### リスクマネージャー
    highlights: [tmp/round-1/risk-manager.json の highlights フィールド]
    picks: [tmp/round-1/risk-manager.json の picks フィールド]

    簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "tenbagger",
      "comment": "500文字以内のディスカッションコメント",
      "agreements": ["同意点1", "同意点2"],
      "disagreements": ["異議点1"]
    }
    ```

**Agent 3: マクロエコノミスト（Round 2）**
- name: `macro-r2`
- model: `sonnet`
- prompt: 以下の内容を含めてください
  - `src/agents/macro.ts` から取得した `systemPrompt` の全文
  - 以下のディスカッション指示:
    ```
    以下は他のチームメンバーの分析（highlights と picks のみ）です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。

    ## 他メンバーの分析サマリー
    ### ファンダメンタルズアナリスト
    highlights: [tmp/round-1/fundamentals.json の highlights フィールド]
    picks: [tmp/round-1/fundamentals.json の picks フィールド]

    ### テンバガーハンター
    highlights: [tmp/round-1/tenbagger.json の highlights フィールド]
    picks: [tmp/round-1/tenbagger.json の picks フィールド]

    ### テクニカルストラテジスト
    highlights: [tmp/round-1/technical.json の highlights フィールド]
    picks: [tmp/round-1/technical.json の picks フィールド]

    ### リスクマネージャー
    highlights: [tmp/round-1/risk-manager.json の highlights フィールド]
    picks: [tmp/round-1/risk-manager.json の picks フィールド]

    簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "macro",
      "comment": "500文字以内のディスカッションコメント",
      "agreements": ["同意点1", "同意点2"],
      "disagreements": ["異議点1"]
    }
    ```

**Agent 4: テクニカルストラテジスト（Round 2）**
- name: `technical-r2`
- model: `sonnet`
- prompt: 以下の内容を含めてください
  - `src/agents/technical.ts` から取得した `systemPrompt` の全文
  - 以下のディスカッション指示:
    ```
    以下は他のチームメンバーの分析（highlights と picks のみ）です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。

    ## 他メンバーの分析サマリー
    ### ファンダメンタルズアナリスト
    highlights: [tmp/round-1/fundamentals.json の highlights フィールド]
    picks: [tmp/round-1/fundamentals.json の picks フィールド]

    ### テンバガーハンター
    highlights: [tmp/round-1/tenbagger.json の highlights フィールド]
    picks: [tmp/round-1/tenbagger.json の picks フィールド]

    ### マクロエコノミスト
    highlights: [tmp/round-1/macro.json の highlights フィールド]
    picks: [tmp/round-1/macro.json の picks フィールド]

    ### リスクマネージャー
    highlights: [tmp/round-1/risk-manager.json の highlights フィールド]
    picks: [tmp/round-1/risk-manager.json の picks フィールド]

    簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "technical",
      "comment": "500文字以内のディスカッションコメント",
      "agreements": ["同意点1", "同意点2"],
      "disagreements": ["異議点1"]
    }
    ```

**Agent 5: リスクマネージャー（Round 2）**
- name: `risk-manager-r2`
- model: `sonnet`
- prompt: 以下の内容を含めてください
  - `src/agents/risk-manager.ts` から取得した `systemPrompt` の全文
  - 以下のディスカッション指示:
    ```
    以下は他のチームメンバーの分析（highlights と picks のみ）です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。

    ## 他メンバーの分析サマリー
    ### ファンダメンタルズアナリスト
    highlights: [tmp/round-1/fundamentals.json の highlights フィールド]
    picks: [tmp/round-1/fundamentals.json の picks フィールド]

    ### テンバガーハンター
    highlights: [tmp/round-1/tenbagger.json の highlights フィールド]
    picks: [tmp/round-1/tenbagger.json の picks フィールド]

    ### マクロエコノミスト
    highlights: [tmp/round-1/macro.json の highlights フィールド]
    picks: [tmp/round-1/macro.json の picks フィールド]

    ### テクニカルストラテジスト
    highlights: [tmp/round-1/technical.json の highlights フィールド]
    picks: [tmp/round-1/technical.json の picks フィールド]

    簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "agentId": "risk-manager",
      "comment": "500文字以内のディスカッションコメント",
      "agreements": ["同意点1", "同意点2"],
      "disagreements": ["異議点1"]
    }
    ```

**Round 2 完了後の処理:**

各エージェントの応答を以下のファイルに保存してください:
- `fundamentals-r2` の出力 → `/Users/arai/invest/tmp/round-2/fundamentals.json`
- `tenbagger-r2` の出力 → `/Users/arai/invest/tmp/round-2/tenbagger.json`
- `macro-r2` の出力 → `/Users/arai/invest/tmp/round-2/macro.json`
- `technical-r2` の出力 → `/Users/arai/invest/tmp/round-2/technical.json`
- `risk-manager-r2` の出力 → `/Users/arai/invest/tmp/round-2/risk-manager.json`

出力が有効なJSONでない場合は、`{"agentId": "...", "comment": "", "agreements": [], "disagreements": []}` を保存してください。

「Round 2 完了: N/5 アナリスト成功」とユーザーに表示してください。

---

### Step 2d: モデレーター介入2 — 論点整理

「モデレーターが論点を整理中...」とユーザーに表示してください。

まず `/Users/arai/invest/tmp/round-1/` と `/Users/arai/invest/tmp/round-2/` の全ファイルを Read ツールで読み込んでください。

**1つの Agent ツールを呼び出してください:**

- name: `moderator-issues`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/moderator.ts` から取得した `systemPrompt` の全文
  - 以下の論点整理指示:
    ```
    以下はチームミーティングのRound 1（分析）とRound 2（ディスカッション）の全結果です。
    投資判断に関する主要な論点を整理してください。

    ## Round 1 分析結果
    ### ファンダメンタルズアナリスト
    [tmp/round-1/fundamentals.json の全内容]

    ### テンバガーハンター
    [tmp/round-1/tenbagger.json の全内容]

    ### マクロエコノミスト
    [tmp/round-1/macro.json の全内容]

    ### テクニカルストラテジスト
    [tmp/round-1/technical.json の全内容]

    ### リスクマネージャー
    [tmp/round-1/risk-manager.json の全内容]

    ## Round 2 ディスカッション結果
    ### ファンダメンタルズアナリスト
    [tmp/round-2/fundamentals.json の全内容]

    ### テンバガーハンター
    [tmp/round-2/tenbagger.json の全内容]

    ### マクロエコノミスト
    [tmp/round-2/macro.json の全内容]

    ### テクニカルストラテジスト
    [tmp/round-2/technical.json の全内容]

    ### リスクマネージャー
    [tmp/round-2/risk-manager.json の全内容]

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "keyThemes": ["主要テーマ1", "主要テーマ2", "主要テーマ3"],
      "consensus": ["コンセンサスが取れている点1", "コンセンサスが取れている点2"],
      "debates": ["未解決の対立点1（例: A vs B）", "未解決の対立点2"],
      "moderatorComment": "議長としての総括コメント（200文字以内）"
    }
    ```

モデレーターの出力を `/Users/arai/invest/tmp/moderator-issues.json` に保存してください。

モデレーターが失敗した場合は1回リトライしてください。2回目も失敗した場合は `{"keyThemes": [], "consensus": [], "debates": [], "moderatorComment": ""}` を保存して続行してください。

「論点整理完了」とユーザーに表示してください。

---

### Step 2e: Round 3 — 銘柄スコアリング

「Round 3: 銘柄スコアリング実行中...」とユーザーに表示してください。

まず `/Users/arai/invest/tmp/moderator-tickers.json` を Read ツールで読み込み、ティッカーリストを取得してください。

ティッカーが0件の場合は、「スコアリング対象銘柄が0件のためRound 3をスキップします。」とユーザーに表示してステップを終了し、空の round-3 ファイルを作成してください。

**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

各エージェントへの Round 3 スコアリング指示の共通テンプレート（agentId と systemPrompt は各エージェントに合わせて変更）:

```
[各エージェントの systemPrompt]

あなたはこれまでの市場分析とチームディスカッションを踏まえて、以下の銘柄それぞれに対して10段階で投資評価を行ってください。

## 評価対象銘柄
[tmp/moderator-tickers.json の tickers 配列の内容]

## Round 1 あなたの分析サマリー
highlights: [tmp/round-1/{agentId}.json の highlights フィールド]
picks: [tmp/round-1/{agentId}.json の picks フィールド]

## Round 2 ディスカッション要約
[tmp/round-2/{agentId}.json の comment フィールド]

## 評価基準（10段階）
- 10: 極めて強い買い（確信度最高）
- 8-9: 強い買い
- 6-7: やや強気
- 5: 中立
- 3-4: やや弱気
- 1-2: 強い売り/警戒

以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

{
  "agentId": "[エージェントID]",
  "agentRole": "[エージェントロール名]",
  "scores": [
    {"ticker": "AAPL", "score": 7, "reason": "30文字以内の理由"},
    {"ticker": "7203.T", "score": 8, "reason": "30文字以内の理由"}
  ]
}

注意: scoreは必ず1〜10の整数で出力してください。全ての評価対象銘柄についてスコアを出力してください。
```

**Agent 1: ファンダメンタルズアナリスト（Round 3）**
- name: `fundamentals-r3`
- model: `sonnet`
- agentIdは `fundamentals`、agentRoleは `ファンダメンタルズアナリスト`

**Agent 2: テンバガーハンター（Round 3）**
- name: `tenbagger-r3`
- model: `sonnet`
- agentIdは `tenbagger`、agentRoleは `テンバガーハンター`

**Agent 3: マクロエコノミスト（Round 3）**
- name: `macro-r3`
- model: `sonnet`
- agentIdは `macro`、agentRoleは `マクロエコノミスト`

**Agent 4: テクニカルストラテジスト（Round 3）**
- name: `technical-r3`
- model: `sonnet`
- agentIdは `technical`、agentRoleは `テクニカルストラテジスト`

**Agent 5: リスクマネージャー（Round 3）**
- name: `risk-manager-r3`
- model: `sonnet`
- agentIdは `risk-manager`、agentRoleは `リスクマネージャー`

**Round 3 完了後の処理:**

各エージェントの応答を以下のファイルに保存してください:
- `fundamentals-r3` の出力 → `/Users/arai/invest/tmp/round-3/fundamentals.json`
- `tenbagger-r3` の出力 → `/Users/arai/invest/tmp/round-3/tenbagger.json`
- `macro-r3` の出力 → `/Users/arai/invest/tmp/round-3/macro.json`
- `technical-r3` の出力 → `/Users/arai/invest/tmp/round-3/technical.json`
- `risk-manager-r3` の出力 → `/Users/arai/invest/tmp/round-3/risk-manager.json`

出力が有効なJSONでない場合は、`{"agentId": "...", "agentRole": "...", "scores": []}` を保存してください。

「Round 3 完了: N/5 アナリスト成功」とユーザーに表示してください。

---

### Step 2f: モデレーター最終統合

「モデレーターが最終レポートを統合中...」とユーザーに表示してください。

まず以下のファイルを Read ツールで読み込んでください:
- `/Users/arai/invest/tmp/round-1/` の全ファイル（まだ読んでいない場合）
- `/Users/arai/invest/tmp/round-2/` の全ファイル（まだ読んでいない場合）
- `/Users/arai/invest/tmp/round-3/` の全ファイル
- `/Users/arai/invest/tmp/moderator-tickers.json`
- `/Users/arai/invest/tmp/moderator-issues.json`
- `/Users/arai/invest/tmp/market.json`

**1つの Agent ツールを呼び出してください:**

- name: `moderator-final`
- model: `opus`
- prompt: 以下の内容を含めてください
  - `src/agents/moderator.ts` から取得した `systemPrompt` の全文
  - 以下の最終統合指示:
    ```
    以下はチームミーティングの全結果です。投資家向けの最終統合レポートをJSONで作成してください。

    ## 市場データサマリー (tmp/market.json)
    [tmp/market.json の indices, sectors フィールドのみ]

    ## 論点整理 (tmp/moderator-issues.json)
    [tmp/moderator-issues.json の全内容]

    ## Round 1 全分析結果
    ### ファンダメンタルズアナリスト
    [tmp/round-1/fundamentals.json の全内容]

    ### テンバガーハンター
    [tmp/round-1/tenbagger.json の全内容]

    ### マクロエコノミスト
    [tmp/round-1/macro.json の全内容]

    ### テクニカルストラテジスト
    [tmp/round-1/technical.json の全内容]

    ### リスクマネージャー
    [tmp/round-1/risk-manager.json の全内容]

    ## Round 2 ディスカッション結果
    [tmp/round-2/ の全ファイルの comment フィールド]

    ## Round 3 スコアリング結果
    ### ファンダメンタルズアナリスト
    [tmp/round-3/fundamentals.json の全内容]

    ### テンバガーハンター
    [tmp/round-3/tenbagger.json の全内容]

    ### マクロエコノミスト
    [tmp/round-3/macro.json の全内容]

    ### テクニカルストラテジスト
    [tmp/round-3/technical.json の全内容]

    ### リスクマネージャー
    [tmp/round-3/risk-manager.json の全内容]

    ## スコア判定基準
    - 平均スコア 7以上 → 強気
    - 平均スコア 4〜6.9 → 中立
    - 平均スコア 4未満 → 弱気

    ## 重要な注意事項
    - 注目銘柄は中小型株を優先（NVIDIA、Apple、Microsoft、Google等の大型株は避ける）
    - 各銘柄の verdict は必ずスコア計算結果に基づく
    - レポート内容は日本語で記述

    以下のJSONフォーマットのみを出力してください。他のテキストは一切出力しないでください。
    マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

    {
      "date": "YYYY-MM-DD（今日の日付）",
      "generatedAt": "ISO 8601形式のタイムスタンプ",
      "marketOverview": {
        "summary": "エグゼクティブサマリー（3-5文）",
        "trend": "上昇 または 下降 または 混合",
        "keyIndices": [
          {"name": "S&P 500", "changePercent": 0.5}
        ]
      },
      "sectorRecommendations": [
        {"rank": 1, "sector": "セクター名", "rationale": "推奨理由", "outlook": "強気 または 中立 または 弱気"}
      ],
      "highlightedStocks": [
        {
          "ticker": "AAPL",
          "averageScore": 7.2,
          "verdict": "強気",
          "summary": "モデレーターによる統合コメント",
          "agentScores": [
            {"agentRole": "ファンダメンタルズアナリスト", "score": 7, "reason": "理由"}
          ],
          "nominatedBy": ["ファンダメンタルズアナリスト"]
        }
      ],
      "riskWarnings": [
        {"severity": "高 または 中 または 低", "description": "リスク説明"}
      ],
      "actionItems": ["投資家がすべき具体的なアクション1", "アクション2"],
      "weeklyEvents": [
        {"date": "YYYY-MM-DD", "event": "イベント名", "impact": "高 または 中 または 低"}
      ],
      "indexInvestorAdvice": "インデックス投資家向けアドバイス（複数行可）",
      "roundSummary": {
        "round1Count": 5,
        "round2Count": 5,
        "round3Count": 5,
        "scoredTickers": ["AAPL", "7203.T"]
      }
    }
    ```

モデレーターの出力を `/Users/arai/invest/tmp/meeting-result.json` に保存してください。

出力が有効なJSONでない場合は、モデレーターを1回リトライしてください。2回目も失敗した場合は「エラー: モデレーター最終統合に失敗しました。ミーティングを中止します。」とユーザーに表示してパイプラインを停止してください。

「ミーティング統合完了」とユーザーに表示してください。

---

### Step 2g: バリデーション

「meeting-result.json のバリデーションを実行中...」とユーザーに表示してください。

```bash
cd /Users/arai/invest && npx tsx src/scripts/validate-meeting.ts
```

バリデーションが完了したら、以下のコマンドでミーティングサマリーをユーザーに表示してください:

```bash
node -e "
const fs = require('fs');
try {
  const result = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/meeting-result.json', 'utf-8'));
  console.log('=== アナリストミーティング完了 ===');
  console.log('日付:', result.date);
  console.log('市場トレンド:', result.marketOverview?.trend);
  console.log('注目銘柄数:', result.highlightedStocks?.length ?? 0);
  console.log('');
  console.log('--- 注目銘柄 ---');
  if (result.highlightedStocks) {
    for (const stock of result.highlightedStocks.slice(0, 5)) {
      console.log(stock.ticker + ' [' + stock.averageScore + '/10] ' + stock.verdict + ': ' + stock.summary);
    }
  }
  console.log('');
  console.log('--- アクションアイテム ---');
  if (result.actionItems) {
    result.actionItems.forEach((item, i) => console.log((i+1) + '. ' + item));
  }
  console.log('');
  console.log('Round完了: R1=' + result.roundSummary?.round1Count + '/5, R2=' + result.roundSummary?.round2Count + '/5, R3=' + result.roundSummary?.round3Count + '/5');
} catch(e) {
  console.log('meeting-result.json の読み込みに失敗:', e.message);
}
"
```

「Step 2 完了: アナリストミーティングが正常に終了しました。」とユーザーに表示してください。

---

## Step 3: WebSearch リサーチ & レポート生成

---

### Step 3.0: 準備

「Step 3: WebSearchリサーチ & レポート生成を開始します...」とユーザーに表示してください。

まず中間ファイル用のディレクトリを作成してください:

```bash
mkdir -p /Users/arai/invest/tmp/websearch /Users/arai/invest/tmp/reeval
```

次に、以下のファイルを Read ツールで読み込んでください:

- `/Users/arai/invest/tmp/meeting-result.json` — `highlightedStocks` 配列を取得

`highlightedStocks` 配列が0件の場合は「注目銘柄が0件のためWebSearchリサーチをスキップします。」と表示し、Step 3c へジャンプしてください。

---

### Step 3a: WebSearch リサーチ（銘柄ごと並列 Agent）

「WebSearchリサーチ: N銘柄を調査中...」（N は highlightedStocks の件数）とユーザーに表示してください。

`highlightedStocks` の各銘柄に対して、**以下の Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

各銘柄について以下の設定で Agent を呼び出してください:
- name: `websearch-{ticker}`（例: websearch-AAPL、ティッカーの `/` は `-` に置換。例: BRK/B → websearch-BRK-B）
- model: `sonnet`
- 以下の prompt を使用:

```
以下の銘柄について、最新の定性情報をリサーチしてください。

## 調査対象銘柄
ティッカー: {ticker}
モデレーター評価: {verdict}（スコア: {averageScore}/10）
推薦理由: {summary}

## 調査手順
1. WebSearch ツールで以下のクエリを2-3回実行してください:
   - "{ticker} latest news 2026"
   - "{ticker} earnings growth outlook"
   - "{ticker} risk concerns 2026"
2. 重要な記事を2-3件選択し、WebFetch ツールで詳細内容を取得してください
3. 定性情報のみを抽出してください（株価・財務数値等の定量データはリサーチ対象外です。Yahoo Finance APIで別途取得済みのため不要）

## 出力形式（JSONのみ出力、コードブロック不要）
{
  "ticker": "{ticker}",
  "researchSummary": "200文字以内の総合評価",
  "positiveFindings": ["ポジティブな発見1", "ポジティブな発見2"],
  "negativeFindings": ["ネガティブな発見1", "ネガティブな発見2"],
  "keyArticles": [
    {"title": "記事タイトル", "summary": "記事要約（100文字以内）"}
  ],
  "researchedAt": "ISO8601タイムスタンプ（例: 2026-06-24T08:00:00Z）"
}
```

各 Agent の結果を以下のファイルに保存してください（ティッカーの `/` は `-` に置換）:
- `websearch-{ticker}` の出力 → `/Users/arai/invest/tmp/websearch/{ticker}.json`

出力が有効なJSONでない場合は、以下のフォールバックJSONを保存してください:
```json
{"ticker": "...", "researchSummary": "リサーチ失敗", "positiveFindings": [], "negativeFindings": [], "keyArticles": [], "researchedAt": "..."}
```

「WebSearch完了: N/{total}銘柄リサーチ成功」とユーザーに表示してください。

---

### Step 3b: 再評価ラウンド（5アナリスト並列 Agent）

「再評価ラウンド: 5アナリストがWebリサーチ結果を評価中...」とユーザーに表示してください。

まず以下のファイルを Read ツールで読み込んでください:
- `/Users/arai/invest/tmp/websearch/` 配下の全JSONファイル（WebSearch結果）
- `/Users/arai/invest/tmp/round-3/fundamentals.json`
- `/Users/arai/invest/tmp/round-3/tenbagger.json`
- `/Users/arai/invest/tmp/round-3/macro.json`
- `/Users/arai/invest/tmp/round-3/technical.json`
- `/Users/arai/invest/tmp/round-3/risk-manager.json`

Step 2.0 で読み込んだ各エージェントの systemPrompt を再利用してください（再読み込み不要）。

**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

**Agent 1: ファンダメンタルズアナリスト 再評価**
- name: `fundamentals-reeval`
- model: `sonnet`
- prompt:
  - `src/agents/fundamentals.ts` から取得した `systemPrompt` の全文
  - 以下の指示:
    ```
    WebSearchリサーチ結果を踏まえて、各銘柄の評価を再提出してください。

    ## WebSearch リサーチ結果
    [tmp/websearch/ の全JSONファイルの内容]

    ## あなたのRound 3 スコア（参考）
    [tmp/round-3/fundamentals.json の scores フィールドの内容]

    見解が変わった場合はその理由を明記してください。変化がない場合は「変化なし」と記載してください。

    以下のJSONフォーマットのみを出力してください（コードブロック不要）:
    {
      "agentId": "fundamentals",
      "agentRole": "ファンダメンタルズアナリスト",
      "reevaluations": [
        {
          "ticker": "AAPL",
          "originalScore": 7,
          "revisedScore": 8,
          "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
          "changed": true
        }
      ]
    }
    ```

**Agent 2: テンバガーハンター 再評価**
- name: `tenbagger-reeval`
- model: `sonnet`
- prompt:
  - `src/agents/tenbagger.ts` から取得した `systemPrompt` の全文
  - 以下の指示:
    ```
    WebSearchリサーチ結果を踏まえて、各銘柄の評価を再提出してください。

    ## WebSearch リサーチ結果
    [tmp/websearch/ の全JSONファイルの内容]

    ## あなたのRound 3 スコア（参考）
    [tmp/round-3/tenbagger.json の scores フィールドの内容]

    見解が変わった場合はその理由を明記してください。変化がない場合は「変化なし」と記載してください。

    以下のJSONフォーマットのみを出力してください（コードブロック不要）:
    {
      "agentId": "tenbagger",
      "agentRole": "テンバガーハンター",
      "reevaluations": [
        {
          "ticker": "AAPL",
          "originalScore": 7,
          "revisedScore": 8,
          "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
          "changed": true
        }
      ]
    }
    ```

**Agent 3: マクロエコノミスト 再評価**
- name: `macro-reeval`
- model: `sonnet`
- prompt:
  - `src/agents/macro.ts` から取得した `systemPrompt` の全文
  - 以下の指示:
    ```
    WebSearchリサーチ結果を踏まえて、各銘柄の評価を再提出してください。

    ## WebSearch リサーチ結果
    [tmp/websearch/ の全JSONファイルの内容]

    ## あなたのRound 3 スコア（参考）
    [tmp/round-3/macro.json の scores フィールドの内容]

    見解が変わった場合はその理由を明記してください。変化がない場合は「変化なし」と記載してください。

    以下のJSONフォーマットのみを出力してください（コードブロック不要）:
    {
      "agentId": "macro",
      "agentRole": "マクロエコノミスト",
      "reevaluations": [
        {
          "ticker": "AAPL",
          "originalScore": 7,
          "revisedScore": 8,
          "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
          "changed": true
        }
      ]
    }
    ```

**Agent 4: テクニカルストラテジスト 再評価**
- name: `technical-reeval`
- model: `sonnet`
- prompt:
  - `src/agents/technical.ts` から取得した `systemPrompt` の全文
  - 以下の指示:
    ```
    WebSearchリサーチ結果を踏まえて、各銘柄の評価を再提出してください。

    ## WebSearch リサーチ結果
    [tmp/websearch/ の全JSONファイルの内容]

    ## あなたのRound 3 スコア（参考）
    [tmp/round-3/technical.json の scores フィールドの内容]

    見解が変わった場合はその理由を明記してください。変化がない場合は「変化なし」と記載してください。

    以下のJSONフォーマットのみを出力してください（コードブロック不要）:
    {
      "agentId": "technical",
      "agentRole": "テクニカルストラテジスト",
      "reevaluations": [
        {
          "ticker": "AAPL",
          "originalScore": 7,
          "revisedScore": 8,
          "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
          "changed": true
        }
      ]
    }
    ```

**Agent 5: リスクマネージャー 再評価**
- name: `risk-manager-reeval`
- model: `sonnet`
- prompt:
  - `src/agents/risk-manager.ts` から取得した `systemPrompt` の全文
  - 以下の指示:
    ```
    WebSearchリサーチ結果を踏まえて、各銘柄の評価を再提出してください。

    ## WebSearch リサーチ結果
    [tmp/websearch/ の全JSONファイルの内容]

    ## あなたのRound 3 スコア（参考）
    [tmp/round-3/risk-manager.json の scores フィールドの内容]

    見解が変わった場合はその理由を明記してください。変化がない場合は「変化なし」と記載してください。

    以下のJSONフォーマットのみを出力してください（コードブロック不要）:
    {
      "agentId": "risk-manager",
      "agentRole": "リスクマネージャー",
      "reevaluations": [
        {
          "ticker": "AAPL",
          "originalScore": 7,
          "revisedScore": 8,
          "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
          "changed": true
        }
      ]
    }
    ```

各 Agent の結果を以下のファイルに保存してください:
- `fundamentals-reeval` の出力 → `/Users/arai/invest/tmp/reeval/fundamentals.json`
- `tenbagger-reeval` の出力 → `/Users/arai/invest/tmp/reeval/tenbagger.json`
- `macro-reeval` の出力 → `/Users/arai/invest/tmp/reeval/macro.json`
- `technical-reeval` の出力 → `/Users/arai/invest/tmp/reeval/technical.json`
- `risk-manager-reeval` の出力 → `/Users/arai/invest/tmp/reeval/risk-manager.json`

出力が有効なJSONでない場合は、以下のフォールバックJSONを保存してください:
```json
{"agentId": "...", "agentRole": "...", "reevaluations": []}
```

「再評価完了: N/5 アナリスト成功」とユーザーに表示してください。

---

### Step 3c: HTMLレポート生成

「Bloomberg風HTMLレポートを生成中...」とユーザーに表示してください。

以下のBashコマンドを実行してください:

```bash
cd /Users/arai/invest && npx tsx src/scripts/generate-report.ts
```

完了後、以下のコマンドで生成結果を確認してユーザーに表示してください:

```bash
cd /Users/arai/invest && node -e "
const fs = require('fs');
try {
  const result = JSON.parse(fs.readFileSync('tmp/meeting-result.json', 'utf-8'));
  const date = result.date;
  const reportPath = 'reports/' + date + '/daily-report.html';
  const minutesPath = 'reports/' + date + '/meeting-minutes.html';
  console.log('レポート生成完了:');
  console.log('  日付:', date);
  console.log('  Daily Report:', fs.existsSync(reportPath) ? reportPath + ' ✓' : reportPath + ' (未生成)');
  console.log('  Meeting Minutes:', fs.existsSync(minutesPath) ? minutesPath + ' ✓' : minutesPath + ' (未生成)');
  console.log('  注目銘柄数:', result.highlightedStocks?.length ?? 0);
} catch(e) {
  console.log('確認エラー:', e.message);
}
"
```

「レポート生成完了: reports/{date}/daily-report.html」とユーザーに表示してください。
