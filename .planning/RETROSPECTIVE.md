# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.6 — Digest-Meeting Cross-Reference & Urgency History

**Shipped:** 2026-07-04
**Phases:** 3 (24-26) | **Plans:** 8 | **Tasks:** 18

### What Was Built
- 相互参照: news-digest.html 記事への当日ミーティング関連注記を決定論的マッチャー（buildDigestCrossRefMap、ティッカー優先+テーマ照合、holding-news.ts設計を移植）で付与、fail-soft隔離+専用[STEP:digest-crossref:*]マーカー (Phase 24, XREP-01/02)
- 履歴永続化: 純関数 urgency-history.ts（4フィールド抽出・日付キー上書きマージ・no-throw）+ fail-soft CLI write-urgency-history.ts → data/urgency-history.json を git 永続化 (Phase 25, HIST-01/02)
- 週次ロールアップ: 純関数 computeWeeklyUrgencyRollup（7日窓・記録隣接日decision差分・__proto__安全）をTDDで構築 → formatWeeklyUrgencyRollupHtml で portfolio-report.html に描画（後方互換第4引数・null分岐両対応・3段階空状態）+ fail-soft loadUrgencyHistory 配線 (Phase 26, HIST-03)

### What Worked
- v2.5パターンの継続再利用: 決定論的TSマッチング（holding-news.ts→digest-crossref.ts）、fail-soft+専用STEPマーカー、foundation→UI分割（Phase 25永続化→26表示、v2.5のPhase 19→20と同型）で設計議論を最小化
- **v2.5の教訓を実行: マイルストーン監査スキップの連鎖を止め、クローズ前に /gsd-audit-milestone を実行** — これがロールアップ1日遅れという静的検証困難なクロスフェーズ・タイミングの継ぎ目を発見し、クローズ前に修正できた（監査の実価値を実証）
- コードレビューの徹底: Phase 26 で 3 Critical + 5 Warning（暦日不正anchor・非オブジェクトhistory・非文字列フィールドでのthrow）を全件ライブreproで再現→修正、「純関数: throwなし」契約を実際に満たすまでクローズしなかった（366→377テスト）
- wave並列（executor worktree分離）+ 各wave後のマージバック・ポストマージゲートで逐次依存3フェーズを安全に実行

### What Was Inefficient
- Phase 26 の純関数モジュールが当初「throwなし」を宣言しながら3つの入力クラス（暦日不正・null history・非文字列フィールド）でthrowしていた — TDDのテストケースが正常系・shape不正キーに偏り、regex通過する暦日不正やroot shape不正を欠いていた。fail-soft契約を持つモジュールは「契約を破る入力」を最初からテスト行列に含めるべき
- クロスフェーズ・タイミング（Step 3f書き込み vs Step 3c読み取りの順序）を Phase 25/26 のどの計画ドキュメントもフラグしなかった — 単一フェーズ内の検証では見えず、統合チェッカー（マイルストーン監査）で初めて表面化した
- 旧フェーズディレクトリ（11-23等）の未コミット削除が作業ツリーに残存し続けている（v2.5でも指摘、未解消の恒常的ノイズ）

### Patterns Established
- fail-soft/no-throw契約を持つ純関数は、テスト行列に必ず「契約違反入力」（型不正・shape不正・regex通過するが意味的に不正な値）を含める
- クロスフェーズのデータパスは、書き込みステップと読み取りステップの**パイプライン実行順序**まで含めて統合チェッカーで検証する（型の一致だけでなくタイミングの一致）
- マイルストーンクローズ前の /gsd-audit-milestone は「省略可能な儀式」ではなく、単一フェーズ検証では捕捉できないクロスフェーズの継ぎ目を捕まえる実効的ゲートとして常時実行する

### Key Lessons
1. 「純関数: throwなし」と宣言したら、それを反証する入力クラス（calendar-invalid・null root・非文字列フィールド）を最初にテストへ書く。宣言と実装の乖離はレビューで必ず出る。
2. クロスフェーズの正しさは「型が一致するか」だけでなく「実行順序が意図と一致するか」で決まる。データを書くステップが読むステップより前に走ることを、パイプライン定義（invest.md）レベルで確認する。
3. マイルストーン監査は今回その価値を実証した（1日遅れの発見）。今後もスキップしない。

### Cost Observations
- Model mix: 設計・レビュー・監査の主導と全サブエージェント成果物の検証はopus（メインセッション）、executor/researcher/checker系はsonnet委譲
- Notable: discuss→plan→execute の自動チェーン（--auto）で Phase 26 を一気通貫実行。コードレビュー→fixer→再検証ループが「純関数throwなし」契約の実効性を担保。マイルストーン監査の統合チェッカーがタイミング継ぎ目を検出し、クローズ前修正で技術的負債の持ち越しを回避

---

## Milestone: v2.5 — Portfolio News Intelligence

**Shipped:** 2026-07-04
**Phases:** 5 (19-23) | **Plans:** 12 | **Tasks:** 24

### What Was Built
- データ土台: finnhub.ts index-as-ticker汚染バグのTDD修正 + 決定論的な保有銘柄別ニュース抽出（holding-news.ts、ticker一致優先+社名フォールバック）→ portfolio-analystプロンプト注入 (Phase 19)
- カード表示: 保有銘柄カードにID参照方式の関連ニュースサブセクション（安全リンク・0件空状態・社名一致バッジ） (Phase 20)
- リサーチ復活: invest.md Step 3-P で保有12銘柄のWebSearchリサーチを並列実行、tmp/portfolio-research/ 分離保存 + fail-soft [STEP:portfolio-research:*] マーカー (Phase 21)
- 再評価契約: urgent緊急度フラグ（alias硬化）+ TS側決定論的decisionChanged検出（decision-diff.ts）+ 赤「⚠ 緊急」/アンバー「判断変更」バッジ + independent-then-compareアンカリング対策 (Phase 22)
- レポート集中化: 新規組入候補セクションを両パスから削除、highlightedStocksの文脈受け渡しは維持 (Phase 23)

### What Worked
- v2.4確立パターンの再利用が効いた: ID参照方式（カードニュース表示）・fail-soft分離+専用STEPマーカー（Step 3-P）を前例踏襲し、設計議論をほぼスキップできた
- LLM出力の信頼境界設計: decisionChangedをLLM自己申告にせずTS側等値比較で付与し、TS専用フィールドはスキーマtransformで構造的にstrip — 幻覚対策をスキーマ層で完結
- passthrough().transform() によるaliasゆらぎ吸収（urgent 4-alias、webSearchResult 8-alias）でハードエラーによるパイプライン停止を予防
- Phase 21をPhase 19/20と独立依存に設計し、wave並列実行（executor worktree分離）が機能
- コードレビュー→修正ループ: Phase 22 WR-01〜03（per-holding fail-soft・同日再実行ガード・ローダーwarn）、Phase 23 WR-01/02 を全件クローズしてから完了

### What Was Inefficient
- マイルストーン監査を2連続でスキップ（v2.4に続きv2.5も）— 要件トレーサビリティ全Completeを根拠としたが、v2.3で監査が誤判定を発見した実績を考えると省略の常態化はリスク
- ライブ実行依存のHUMAN-UAT未消化が6件（Phase 20/21/22）残ったままのクローズ — WebSearch・LLM rationale実言及など静的検証不能な面積が増えており、クローズ前の1回のフルパイプライン実行を検討すべきだった
- 旧フェーズディレクトリ（11-18）の削除が未コミットのまま作業ツリーに残存し、マイルストーンクローズと混線しかけた

### Patterns Established
- LLM出力に隣接する状態遷移フラグ（decisionChanged等）は「TS側決定論的計算 + スキーマでのLLM値strip」を標準形とする
- 前日データ注入は「独立評価→その後比較」（independent-then-compare）の順でアンカリングを抑制し、同日再実行ガード付きで退避する
- 新設のLLM向けデータ領域は既存領域と物理分離（tmp/portfolio-research/ vs tmp/websearch/）し、構造的隔離テストを付ける

### Key Lessons
1. LLM由来booleanフィールドはalias-transform硬化（複数エイリアス正準化+default）を最初から仕込む。ゆらぎは必ず起きる。
2. HUMAN-UAT（ライブ実行検証）が3フェーズ分溜まる規模になったら、クローズ前に1回のフルパイプライン実行でまとめて消化する方が追跡コストより安い。
3. マイルストーン監査スキップは連続させない。次回（v2.6）はクローズ前に /gsd-audit-milestone を実行する。

### Cost Observations
- Model mix: executor/reviewer系サブエージェント委譲 + portfolio-analyst/リサーチAgent本番はopus
- Notable: 12銘柄WebSearchリサーチ追加で日次パイプライン実行時間が増加（並列実行で緩和）。165コミット/2日という高密度実行はwave並列（worktree分離）に支えられた

---

## Milestone: v2.4 — News Curation Report

**Shipped:** 2026-07-03
**Phases:** 4 (15-18) | **Plans:** 9 | **Tasks:** 17

### What Was Built
- キュレーション契約: 記事プールへの短い連番ID付与（assignArticleIds, n01〜n80）+ zod二層バリデーション（構造検証→プール参照解決）で幻覚URL・不正market値を構造的に防止 (Phase 15)
- news-digestレンダラー: generateNewsDigestHtml ピュア関数（市場別グルーピング・重要度順・High/Medium/Lowバッジ・ティッカーピル・リード文・null/empty/normal 3値フォールバック・XSS/tabnabbing対策） (Phase 16)
- パイプライン統合: invest.md Step 3d news-curator（opus 2体並列）+ Step 3e write-news-digest.ts fail-soft起動、専用 [STEP:news-digest:*] マーカー (Phase 17)
- index統合: News Digestリンクを fs.access() 実在チェックから毎回導出（strip→再導出で自己修復）、118日分ライブ検証+本番デプロイ (Phase 18)

### What Worked
- ID参照方式（AgentはIDのみコピー、URLはTS側で照合）が幻覚URL問題を設計段階で消した — LLM出力の検証をzodスキーマとプール照合の二層に分けたことでエラー原因の切り分けも容易に
- 契約→レンダリング→統合→index/nav の4フェーズ分割でリスククラスタが自然に分離され、各フェーズがTDDで完結
- fail-soft設計のライブ検証（キュレーション意図的失敗→3レポート継続）で「失敗しても本流を止めない」を実証してからクローズ
- Phase 18のライブ実行検証: フル/invest再実行なしで update-index.ts 単体実行 + 実docsツリー118日分のgrep検証という低コスト高確度の手法

### What Was Inefficient
- Phase 16 で検証ギャップ（.ticker-pill CSS未定義・複数ピル連結）が発覚し 16-03 ギャップクローズプランが必要になった — レンダラーのHTML出力とCSS定義の対応はプラン時に突合すべきだった
- 17-01 SUMMARY.md の one_liner 抽出が壊れており（バグリスト先頭行が返る）、マイルストーンアーカイブの自動生成成果リストに混入した（手動修正）
- v2.4-MILESTONE-AUDIT.md を作成せずクローズ（要件12/12 Complete・ライブ検証済みで代替判断）— 監査駆動クローズのv2.3プロセスからは後退

### Patterns Established
- LLM選定ステップは「ID参照 + TS側解決」を標準形とする（keyArticles → news-curation で2例目、再利用可能なパターンとして確立）
- 新規レポート追加時は fail-soft 分離（独自try/catch + 専用STEPマーカー）を必須とし、既存レポートのhard-fail文言を流用しない
- 生成ファイルへのリンクは「実在チェックから毎回導出」（キャッシュ・パース済み状態を信頼しない）

### Key Lessons
1. LLMの出力面積を最小化する（IDのみ選定させる）ことが、後段のバリデーションよりも効果的な幻覚対策になる。
2. レンダラー実装時はHTMLクラス名とCSS定義の対応表をプランに含める（Phase 16の検証ギャップの根本原因）。
3. マイルストーン監査の省略は要件トレーサビリティ全Complete + 最終フェーズのライブ検証済みという強い証拠がある場合に限る。

### Cost Observations
- Model mix: executor/reviewer系サブエージェント委譲 + news-curator本番はopus 2体並列
- Notable: Phase 18-02（5min）のような「単体スクリプトのライブ実行 + grep検証」プランは、フルパイプライン再実行に比べ大幅に安価で確度が高い

---

## Milestone: v2.3 — Analysis Quality & Operational Stability

**Shipped:** 2026-07-01
**Phases:** 5 (11-14.1) | **Plans:** 12 | **Tasks:** 25

### What Was Built
- ニュース品質底上げ: Finnhubティッカー別カンパニーニュース取得、直近6h優先の時間重み付けスコア、英日クロス言語dedup (Phase 11)
- 分析品質: 前日 meeting-result.json をRound 1全5エージェントに注入するクロスセッション記憶、Round 3スコアリングの専用並列エージェント化 (Phase 12)
- 運用安定性: STEP マーカー（START/OK/FAIL）ログ、docs HTMLのSHA256チェックサム保護、macOS通知 (Phase 13)
- レポートUI: 外部ライブラリ不要のインラインSVGチャート（セクター横バー/VIX折れ線）、index.htmlヒーロー+月別アコーディオン刷新、モバイルレスポンシブCSS (Phase 14)
- OPSギャップ実修正: run.sh の stream-json 化でSTEPマーカーがログ到達、EXIT_CODE 実捕捉、deploy の spawnSync 引数配列化でシェルインジェクション除去 (Phase 14.1)

### What Worked
- 監査駆動のギャップクローズ: マイルストーン監査が Phase 13 の「実装済み」誤判定（OPS-01/03）を発見し、Phase 14.1 を挿入して根本バグ（run.sh 35-41行）を実修正できた
- TDD の徹底（RED→GREEN）が Phase 11/14 のピュア関数（スコアリング、SVGレンダラ）で機能
- tmp/*.json ファイル境界による TS↔Claude ハンドオフが安定
- 監査再実行 + gsd-integration-checker による実コード独立検証で、修正後の CONNECTED を客観確認

### What Was Inefficient
- Phase 13 の VERIFICATION がコード実装を「済み」と誤判定し、監査まで発覚しなかった（静的読解のみで run.sh の実挙動を追えていなかった）
- finnhub.ts:43 の Array.map (value, index) シグネチャ取り違えバグが tech debt として残存（tsc で検出済みだが未修正）
- 11-01/11-02 の SUMMARY.md に requirements-completed frontmatter が欠落し、監査で3ソース相互参照が必要になった

### Patterns Established
- 「実装済み」判定は必ず実コード（実ファイル内容）に対する検証を伴うこと。VERIFICATION は静的読解を超えた実挙動確認を要する
- 監査 gaps_found → `/gsd-phase --insert` でクローズフェーズ挿入 → discuss/plan/execute → 監査再実行、のクローズループ
- LLM生成値（date等）を外部コマンドに渡す際は正規表現検証 + spawnSync 引数配列（execSync文字列連結禁止）
- 外部チャートライブラリを足さず、既存の formatXxxHtml 規約に沿ったピュアSVG文字列生成

### Key Lessons
1. 監査は実コードを検証する。Phase単位の VERIFICATION が「human_needed」で止まる領域（run.sh の実行時挙動）こそ、後続監査で実ファイルを読んで裏取りする価値が高い。
2. `set -euo pipefail` 下の grep パイプ（ノーマッチ）はスクリプトを黙って中断しうる。`2>/dev/null | ... || true` でガードする（CR-01）。
3. tsc --noEmit で検出済みの型契約違反は、実害が軽微でも frontmatter/deferred-items に明記し、次マイルストーンで確実に拾う。

### Cost Observations
- Model mix: 主にサブエージェント（executor/reviewer/integration-checker）へ委譲、メインは Opus で監査・レビュー主導
- Notable: 監査再実行 + 統合チェッカーの二段検証が、誤判定の再クローズにおいて費用対効果が高かった

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v2.0 | 4 | Gemini → Claude Code サブエージェント移行 |
| v2.1 | 3 | 3レポート構成復元 + 自動デプロイ |
| v2.2 | 3 | ニュース品質フィルタ（TDDピュア関数モジュール）+ パイプライン計測 |
| v2.3 | 5 | 監査駆動のギャップクローズ（Phase 14.1挿入）で誤判定を実修正 |
| v2.4 | 4 | ID参照方式によるLLM幻覚の構造的防止 + fail-soft統合のライブ実証 |
| v2.5 | 5 | LLM信頼境界の標準化（TS側決定論的検出 + alias硬化 + スキーマstrip）とv2.4パターン再利用 |
| v2.6 | 3 | 監査駆動クローズへ回帰 — 統合チェッカーがクロスフェーズのタイミング継ぎ目（Step 3f書込 vs Step 3c読取の順序）を検出、クローズ前に修正 |

### Top Lessons (Verified Across Milestones)

1. TS↔Claude のハンドオフは stdout ではなく tmp/*.json ファイル境界を経由する（v2.2で確立、v2.3で継続有効）。
2. 新規npm依存を足さずネイティブTypeScript/SVGで実装する方針が品質と保守性を両立（v2.2 Jaccard、v2.3 SVGチャート）。
3. 「実装済み」の主張は実コード検証で裏取りする（v2.3で顕在化。v2.4/v2.5で監査を連続スキップしたが、v2.6でクローズ前 /gsd-audit-milestone を実行し、その価値を再実証した — 1日遅れの継ぎ目を発見・修正）。
4. クロスフェーズの正しさは型一致だけでなく「実行順序が意図と一致するか」で決まる。データを書くステップは読むステップより前に走る必要があり、これは単一フェーズ検証では見えずマイルストーン統合チェッカーで初めて表面化する（v2.6で確立）。
5. fail-soft/no-throw契約を持つ純関数のテスト行列には、契約を破る入力（型不正・shape不正・regex通過するが意味的に不正な値）を必ず含める（v2.6 Phase 26で確立）。
4. LLM出力は選定範囲を最小化（ID参照）し、実データはTS側で解決する（v2.0 keyArticles → v2.4 news-curation → v2.5 カードニュース/decisionChangedで確立）。
5. 判断・状態遷移のフラグはLLM自己申告を信用せず、TS側の決定論的計算で付与しスキーマでLLM値をstripする（v2.5で確立）。
