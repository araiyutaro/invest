# Project Rules

## GSD Command Format

GSD コマンドは常にハイフン (`-`) を使用すること。コロン (`:`) は使用しない。

- `/gsd-execute-phase` (正)
- `/gsd:execute-phase` (誤)

すべての GSD スキル参照（ユーザーへの提案、ドキュメント内の記述を含む）でこのルールを適用する。

## 日次パイプライン

- launchd（`com.arai.invest-agent`、毎日 7:00）が `scripts/run.sh` を起動し、`claude -p "/invest"` を無人実行する。手順の本体は `.claude/commands/invest.md`
- 無人実行は作業ツリーをそのまま使う。master 以外のブランチに切り替えたまま、または壊れた変更を残したままにしない
- 日次コミットは `docs/ docs_old/ data/` だけを add する。`invest.md`・`scripts/`・`src/` の変更は自分でコミットする
- 中間ファイルは `tmp/`（git 管理外）に置く。スクリプトは `tmp/meeting-result.json` などを読む。リポジトリのルートには出力しない
- `docs/index.html` と `docs/portfolio.html` は手で編集しない。エントリの追加は `src/scripts/update-index.ts`、各日のレポート HTML は `src/scripts/generate-*.ts` が生成する
- 保有銘柄は `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` が唯一の定義
- 変更後の確認: `npm test` と `npx tsc --noEmit`
