# Phase 28: Watchlist Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 28-Watchlist Persistence
**Areas discussed:** 状態テーブルのスキーマ設計, 再追加セマンティクス, 時間ベース失効の閾値, 除外トリガーの入力ソース, パイプライン統合・fail-soft・破損時ポリシー, ETF防御的二重フィルタ
**Mode:** --auto（全質問で推奨オプションを自動選択。ユーザーへの質問なし）

---

## 状態テーブルのスキーマ設計

| Option | Description | Selected |
|--------|-------------|----------|
| ticker キー方式の現在状態テーブル | Record<ticker, entry>。research 4パスが収束した推奨。アクティブ一覧の導出が単純 | ✓ |
| date キー方式の日次追記ログ | urgency-history.json と同型。ただし「現在の状態」導出に全履歴走査が必要 | |

[auto] removedReason enum — Q: 「research 例示の verdict-downgrade/entered-portfolio か REQUIREMENTS.md の downgraded/purchased/expired か」 → Selected: 「REQUIREMENTS.md 正準値 downgraded/purchased/expired」（要件文書が正）
[auto] 会社名 — Q: 「社名をいつ取得するか」 → Selected: 「登録時に batch quote() の longName から取得（ETF判定と同一コール、追加API呼び出しゼロ）、取得失敗時は optional 省略」（recommended default）

---

## 再追加（re-admission）セマンティクス

| Option | Description | Selected |
|--------|-------------|----------|
| 過去の除外記録を保持したまま新規エピソードとして再追加 | Success Criteria 5（除外履歴の追跡可能性）を再追加後も満たす | ✓ |
| 既存レコードを上書きリセット | 最も単純だが再追加時に除外履歴が消え SC5 に抵触 | |
| 再追加を禁止（一度除外されたら永久除外） | 「再強気評価で自然に取り込まれる」という Out of Scope 判断（遡及不要の根拠）と矛盾 | |

**Notes:** 具体構造（エピソード配列 vs removalHistory 配列）はプランナー裁量とし、「アクティブ一覧導出の単純性」と「同一ファイル内での履歴追跡」の両立を要件化。

---

## 時間ベース失効の閾値（WLST-04）

| Option | Description | Selected |
|--------|-------------|----------|
| 30暦日（約20営業日） | research FEATURES の generous window 推奨と PITFALLS の肥大抑止のバランス点。暦日は決定論・依存ゼロ | ✓ |
| 10営業日前後（swing-trader 標準） | research が「本プロジェクトの中長期リストに不適」と明示的に不採用推奨 | |
| 60暦日以上 | 肥大抑止効果が弱く、Pitfall 2（30-60日で50-150銘柄）の窓を超える | |

**Notes:** 名前付き定数で一箇所定義（変更容易性）。営業日計算は日米祝日カレンダーが必要になるため不採用。サイズログを day one から出力。

---

## 除外トリガーの入力ソース（WLST-02/03）

| Option | Description | Selected |
|--------|-------------|----------|
| purchased 判定は PORTFOLIO_HOLDINGS（holdings.ts） | 静的な単一情報源。collect-data の成否に非依存 | ✓ |
| purchased 判定は tmp/portfolio.json | 実行時生成物。collect-data 失敗時に空配列となり誤判定リスク | |

[auto] downgraded 判定 — Q: 「何と照合するか」 → Selected: 「当日 tmp/meeting-result.json の highlightedStocks（当日言及なしは現状維持・失効カウント進行）」（recommended default）
[auto] dateKey — Q: 「日付の取得元」 → Selected: 「tmp/meeting-result.json の date フィールド（Phase 25 D-05 前例）」（recommended default）

---

## パイプライン統合・fail-soft・破損時ポリシー

| Option | Description | Selected |
|--------|-------------|----------|
| 純関数＋fail-soft CLI 分離、Step 2g 直後に新ステップ挿入 | urgency-history 実証済みテンプレート。ETF除外・バリデーション済みデータを入力に、Phase 29/30 より前に状態確定 | ✓ |
| validate-meeting.ts への統合 | 責務混載。バリデーションと永続化の失敗境界が曖昧になる | |
| Step 3f（urgency-history）と同時実行 | Step 3f は portfolio-analysis.json 依存で実行が遅い。watchlist は meeting-result のみ依存であり早期確定が下流に有利 | |

[auto] 破損ファイル — Q: 「JSON 破損時の扱い」 → Selected: 「上書きせず STEP:FAIL で当日更新スキップ（蓄積状態の保全優先。ENOENT のみ空初期化）」（recommended default）
[auto] 同日再実行 — Q: 「専用ガードの要否」 → Selected: 「ticker キー merge の構造的冪等性で担保、専用ガード不要」（recommended default）
[auto] zod — Q: 「watchlist.json の検証に zod を使うか」 → Selected: 「使わない（LLM 出力でない TS 自己生成ファイル。防御的パースは loadUrgencyHistory 様式）」（recommended default）

---

## ETF防御的二重フィルタ

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 27 の filterEtfStocks を admission 内で再利用、新規候補のみ batch quote() 1回 | research 推奨の「2つの独立呼び出し点」の後者。1コールで quoteType＋社名を同時取得 | ✓ |
| Step 2g のフィルタ済み出力を信頼して二重フィルタ省略 | 将来の経路追加で ETF 混入の構造的リスク。research が明示的に非推奨 | |
| 全登録済み銘柄を毎日再検証 | API コール増のみでゲイン無し（登録時検証済み） | |

**Notes:** lookup 失敗は fail-closed（Phase 27 D-01 踏襲）。quote() はラッパー側で実行し純関数は QuoteTypeLookup を引数で受ける。

---

## Claude's Discretion

- WatchlistEntry / WatchlistFile の正確な型定義・エピソード構造の実装詳細
- CLI ラッパーのログ文言・フォーマット詳細
- verdict フィールドを active エントリに保持するか
- ticker 正規化の詳細（extract-tickers.ts 規約への準拠方法）
- 単体テストのケース構成

## Deferred Ideas

- アクティブ銘柄数の上限キャップ（サイズベース強制除外）— ログで肥大傾向が観測されたら将来検討
- 日付キー方式の判定履歴ログファイル — WLST-F2（的中率検証）が必要になった時に別ファイルで
- watchlist ティッカーへの matchAliases 人手キュレーション — Phase 29 で精度不足が観測されたら追補
- 過去レポートからの遡及ブートストラップ — REQUIREMENTS.md Out of Scope で確定済み
