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

## Step 2: アナリスト並列分析（Phase 2 で実装予定）

<!-- Phase 2 で実装予定: 以下のデータスコーピングに従い、5アナリストを並列スポーンする -->

<!--
データスコーピング（各アナリストが使用するJSONファイル）:

ファンダメンタルズアナリスト:
  - tmp/market.json (市場コンテキスト)
  - tmp/portfolio.json (個別銘柄財務データ)
  - 分析観点: PER/PBR/ROE等のバリュエーション、財務健全性、業績トレンド

テンバガーハンター:
  - tmp/market.json (市場コンテキスト)
  - tmp/portfolio.json (小型・中型株データ)
  - 分析観点: 高成長ポテンシャル銘柄、セクターテーマ、10倍株候補

マクロエコノミスト:
  - tmp/market.json (指数・セクターローテーション)
  - tmp/news.json (マクロニュース・経済指標)
  - 分析観点: 金利・為替・インフレ動向、セクターローテーション戦略

テクニカルストラテジスト:
  - tmp/market.json (市場トレンド・セクター動向)
  - tmp/portfolio.json (個別銘柄価格データ・52週高安値)
  - 分析観点: トレンド分析、サポート/レジスタンス、エントリー/エグジットタイミング

リスクマネージャー:
  - tmp/market.json (市場全体リスク)
  - tmp/news.json (リスクイベント・地政学)
  - tmp/portfolio.json (ポートフォリオ集中リスク)
  - 分析観点: ポートフォリオリスク評価、ヘッジ戦略、ストップロス水準

5アナリストを並列スポーン（Phase 2 で Agent ツールを使用して実装）:
- Agent: fundamentals-analyst → tmp/market.json + tmp/portfolio.json
- Agent: ten-bagger-hunter → tmp/market.json + tmp/portfolio.json
- Agent: macro-economist → tmp/market.json + tmp/news.json
- Agent: technical-strategist → tmp/market.json + tmp/portfolio.json
- Agent: risk-manager → tmp/market.json + tmp/news.json + tmp/portfolio.json
-->

現在 Phase 1 のため、アナリスト並列分析は未実装です。Phase 2 完了後に有効化されます。

「Phase 2 の実装が完了していません。データ収集は正常に完了しました。アナリスト分析機能は Phase 2 実装後に利用可能になります。」とユーザーに表示してください。

---

## Step 3: レポート生成（Phase 3 で実装予定）

<!-- Phase 3 で実装予定:
- モデレーターが5アナリストの分析結果を統合
- Bloomberg風HTMLダークテーマレポートを生成
- reports/YYYY-MM-DD/ に出力
-->

現在 Phase 1 のため、レポート生成は未実装です。Phase 3 完了後に有効化されます。
