# Phase 19: Data Foundation & Holding-News Supply - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

portfolio-analyst が、汚染のないティッカーデータに基づいて決定論的に抽出された保有銘柄別関連ニュースを入力として受け取る。

具体的には3つの成果物:
1. `src/data/news/finnhub.ts:43` のティッカー汚染バグ修正（`.map(toRawArticle)` で配列インデックスが `ticker?: string` に位置的に渡り込む — general/merger記事全件に数値インデックスが混入。NEWS-04）
2. 決定論的な保有銘柄別ニュース抽出モジュール（ticker一致 + 社名部分一致フォールバック、優先度スコア順・銘柄あたり上限付き、ユニットテスト付き。PORT-01）
3. portfolio-analyst プロンプト（`.claude/commands/invest.md` Step 3d）への保有銘柄別関連ニュースの明示的入力セクション追加（PORT-01）

カード表示（Phase 20）、WebSearchリサーチ（Phase 21）、判断根拠への反映・緊急度フラグ・前日比較（Phase 22）は本フェーズの対象外。

</domain>

<decisions>
## Implementation Decisions

### 日本株カバレッジ戦略（マッチングロジック）
- **D-01:** ticker一致を主とし、**社名部分一致フォールバックを追加**する。Finnhub限定MVPは不採用（日本株4銘柄が恒久的に0件になる構造を許容しない）
- **D-02:** 社名フォールバックは**全12銘柄に適用**（日本株限定にしない）。日本語RSSが米国株保有銘柄に言及する記事も拾う。ロジックが全銘柄で均一になりテストもシンプル
- **D-03:** 社名照合対象は**記事タイトルのみ**（summaryは対象外）。`filter.ts` denylist の前例（v2.2 RESEARCH.md Pitfall 5）を踏襲し、副次的言及による誤マッチを避ける
- **D-04:** `PORTFOLIO_HOLDINGS` に任意の **`matchAliases` フィールドを追加**し、照合は name + nameJa + matchAliases。略称は人間がキュレーション（例: "Joby"、"名古屋銀"）。衝突リスクの高い略称（POWL の "Powell" はFRB議長と衝突）は登録しない。自動短縮形生成は不採用

### ハンドオフ設計（tmp/holding-news.json）
- **D-05:** holding-news.json は **ID参照 + マッチメタ情報**を保存（銘柄ごとに記事ID n01〜 + マッチ方式 ticker/name/alias + 優先度スコア）。記事本体は tmp/news.json が唯一のソース（v2.4 ID参照方式の前例踏襲）。記事フルコピーは不採用
- **D-06:** 抽出処理は **collect-data.ts に統合**（news.json 書き出し直後に holding-news.json も生成）。パイプライン新ステップ不要、invest.md の変更最小。抽出ロジック自体は `src/portfolio/holding-news.ts` に純粋関数として切り出しTDD
- **D-07:** portfolio-analyst プロンプトへは**解決済み全文埋め込み**（銘柄ごとに ID + 見出し + summary + ソース + 公開日時を news.json から照合解決して展開）。**URLは含めない**（news-curator と同方針で幻覚URL防止）
- **D-08:** fail-soft: ニュース0件・取得失敗時も**全12銘柄が空配列の holding-news.json を必ず書く**。加えて invest.md 側はファイル欠損時もニュースセクションなしで portfolio-analyst を続行（二重のfail-soft、既存原則踏襲）

### 銘柄あたり供給上限
- **D-09:** 供給上限は**1銘柄あたり5件**。Phase 20 のUI表示上限（3〜5件）と同一集合にし、「カードに見えているニュース = 判断に使われたニュース」の透明性を確保。Phase 20 は holding-news.json をそのまま使える（別の絞り込みロジック不要）。プロンプト最大60記事で肥大化も抑制
- **D-10:** 上限超過時の切り捨て順は **ticker一致を優先、同格は優先度スコア順**（`calculatePriorityScore` 再利用）。確実性の高い ticker一致（Finnhub APIが銘柄指定で返した記事）を常に社名一致より上位に置き、誤マッチ可能性のある社名一致は枠が余ったときの補完に回す

### 0件銘柄のプロンプト表現
- **D-11:** プロンプトのニュースセクションには**全12銘柄を必ず列挙**し、0件銘柄には明示的な「本日の関連ニュースなし」を記載（ニュース不在≠問題なし、をエージェントに誤解させない。リサーチ Pitfall 4 の推奨に従う）。0件銘柄のセクション省略は不採用
- **D-12:** ニュースセクションに**ガード指示を添付**: 「ニュースなしの銘柄は既存の材料（株価・ミーティング結果）のみで判断しニュースに言及しないこと。列挙されていないニュースを推測・創作しないこと」。幻覚ニュース言及を構造的に抑止し、Phase 22 の PORT-03 検証の土台にする

### Claude's Discretion
- holding-news.json の具体的なJSONスキーマ形状（銘柄キー構造、メタフィールド名）
- holding-news.ts の関数分割・命名
- finnhub.ts バグ修正の実装形（明示的ラップ `.map((item) => toRawArticle(item))` が素直だが、複数配列インデックス位置での回帰テスト必須 — Success Criteria 1 参照）
- matchAliases の初期キュレーション内容（衝突回避の原則: 一般語・人名と衝突する略称は登録しない）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.5 マイルストーンリサーチ
- `.planning/research/SUMMARY.md` — v2.5全体の推奨アーキテクチャ。Phase 19相当の推奨（finnhub.tsバグ先行修正、決定論的TSモジュール `holding-news.ts`、LLM ID選定ラウンド不採用の理由）
- `.planning/research/PITFALLS.md` — Pitfall 3（finnhub.tsバグ修正の波及効果と回帰テスト要件）、Pitfall 4（日本株カバレッジギャップ）、Pitfall 5（社名フォールバックの誤マッチリスク）。§Pitfall 3 は修正が `calculatePriorityScore` の型整合に与える影響（挙動変化なし）を明記

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — NEWS-04 / PORT-01 の正確な要件文言
- `.planning/ROADMAP.md` §Phase 19 — Success Criteria 3項目（ticker undefined検証・決定論的マッピング+ユニットテスト・プロンプト入力セクション）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/news/filter.ts` の `calculatePriorityScore()` — 優先度スコア（時間重み + ポートフォリオボーナス）。D-10 の同格ソートで再利用
- `src/data/news/article-id.ts` の `NewsArticleWithId` 型 — news.json の記事形状（id: "n01"〜）。holding-news.json のID参照先
- `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` — 12銘柄（symbol / name / nameJa / sector）。D-04 で `matchAliases?: ReadonlyArray<string>` を追加
- `src/scripts/collect-data.ts` — news.json 書き出し箇所（59-64行目付近）。D-06 の統合ポイント

### Established Patterns
- ID参照方式（v2.4 news-digest）: LLMにはID+内容のみ渡しURLはTS側で照合解決 → D-05/D-07 が踏襲
- fail-soft: collect-data.ts はニュース失敗時 `[]` を書いて続行 → D-08 が同パターン
- TDD + 純粋関数切り出し: filter.ts / article-id.ts はテストファースト済み → holding-news.ts も同様
- tmp/*.json ハンドオフ境界: TS↔Claude の受け渡しは全てファイル経由
- タイトルのみ照合: filter.ts denylist の前例 → D-03 が踏襲

### Integration Points
- `.claude/commands/invest.md` Step 3d（1542行目〜）: portfolio-analyst プロンプト定義。読み込みファイルリストに tmp/holding-news.json を追加し、「## 保有銘柄別関連ニュース」入力セクションを新設（D-07/D-11/D-12）
- `src/data/news/finnhub.ts:43`: `.map(toRawArticle)` バグ箇所。`fetchNewsByCategory`（general/merger）のみ影響、`fetchCompanyNews` は正しく ticker を明示渡ししている
- 既知の副作用（PITFALLS.md Pitfall 3）: バグ修正で `article.ticker` が数値→undefined に変わるが `calculatePriorityScore` の挙動は不変（`string[].includes(number)` は常にfalseだったため）。テストの断り書きに含める

</code_context>

<specifics>
## Specific Ideas

- 0件銘柄のプロンプト文言イメージ: 「本日の関連ニュースなし（ニュース不在は問題なしを意味しない）」— カバレッジなしとニュースなしを混同させない明示表現
- ガード指示イメージ: 「ニュースなしの銘柄は既存の材料のみで判断しニュースに言及しないこと。列挙されていないニュースを推測・創作しないこと」
- matchAliases 例: JOBY → ["Joby"], 8522.T → ["名古屋銀"]。POWL は正式名のみ（"Powell" 単独はFRB議長と衝突するため登録しない）

</specifics>

<deferred>
## Deferred Ideas

- 社名フォールバックの実測誤マッチ率の監査（マッチ方式別件数ログはD-05のメタ情報で可能になる）— Phase 20/22 の検証、またはマイルストーン監査時にライブランで確認
- EE / NXT のWebSearchエンティティ衝突対策（社名併記クエリ）— Phase 21 の領域（リサーチ Pitfall 5）

</deferred>

---

*Phase: 19-Data Foundation & Holding-News Supply*
*Context gathered: 2026-07-03*
