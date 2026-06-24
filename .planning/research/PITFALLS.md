# Pitfalls Research

**Domain:** Claude Code migration from Gemini API — multi-agent investment analysis system
**Researched:** 2026-06-24
**Confidence:** HIGH (based on official docs, GitHub issues, and verified community reports)

## Critical Pitfalls

### Pitfall 1: Subagentコンテキスト爆発によるトークンコスト暴走

**What goes wrong:**
6エージェント（5アナリスト＋モデレーター）を並行スポーンすると、各エージェントが独立したコンテキストウィンドウを持つため、コスト線形増加ではなく乗算的増加が発生する。実例として49サブエージェント並行実行で887K tokens/分・$8,000〜$15,000の請求が報告されている。市場データ（株価、ニュース、ファンダメンタルデータ）は大量なため、各エージェントに全データを渡すと更に悪化する。

**Why it happens:**
Gemini APIでは全エージェントが同一プロセス内でトークンを共有していた。Claude Codeサブエージェントは物理的に独立したコンテキストウィンドウを持つため、6エージェント×コンテキストサイズ分のトークンが消費される。「とりあえず全データを渡す」という設計思想がコスト爆発を招く。

**How to avoid:**
- データ収集後、エージェントごとに必要なデータのみを抽出する「コンテキスト圧縮ステップ」を実装する
- ファンダメンタルアナリストには財務データのみ、テクニカルアナリストにはOHLCVデータのみを渡す
- アナリストエージェントにはHaikuモデルを使用し、モデレーターのみSonnetを使用する
- CLAUDE.md に `max_concurrent_subagents: 3` など並行上限を設定する

**Warning signs:**
- スキル実行1回あたりのトークン使用量が急増する
- 各エージェントへの入力プロンプトが5,000トークンを超える
- `src/data/market.ts` の出力をそのまま全エージェントに渡している

**Phase to address:**
Phase 1（エージェント基盤構築）で最初にトークン上限を設計する。データ圧縮ロジックを先に実装してからエージェントに渡す。

---

### Pitfall 2: サブエージェント出力の非構造化によるレポート生成失敗

**What goes wrong:**
6エージェントのテキスト出力をモデレーターが受け取り、HTMLレポートを生成する際、各エージェントが自由形式のMarkdownで応答すると、モデレーターがデータを正しく統合できない。特定セクション（リスク評価、推奨銘柄リスト）が欠落したり、フォーマットが毎回変わったりする。

**Why it happens:**
Claude Codeはデフォルトで自然言語応答を返す。Gemini APIでは`response_schema`でJSON強制できたが、Claude CodeのサブエージェントはデフォルトでJSON出力しない。エージェントに「JSON形式で返して」と指示しても、会話的な前置き文が混入したり、スキーマが変わったりする。

**How to avoid:**
- 各アナリストエージェントのシステムプロンプトに厳密なJSON スキーマ例を含める（説明ではなく実際の例）
- Claude SDK の structured outputs 機能を使用してスキーマバリデーションを行う
- JSONパースに失敗した場合の再プロンプト（リトライ）ロジックを実装する
- モデレーターには「アナリスト出力をそのまま使う」のではなく「不完全でも生成できる」設計にする

**Warning signs:**
- アナリスト出力のJSONパースが時々失敗する
- レポートの特定セクションが空欄になる
- モデレーターが「不明な形式のデータを受け取りました」と報告する

**Phase to address:**
Phase 1でアナリスト出力スキーマを定義し、モックデータでパイプラインを先に確立する。実際のLLM呼び出しは後から差し込む。

---

### Pitfall 3: Google Search Grounding → WebSearch の品質劣化

**What goes wrong:**
v1.0では Google Search Grounding で個別銘柄のリアルタイムニュース・決算情報を取得していた。WebSearchに移行すると、検索結果の鮮度・精度・日本語対応が低下する。特に日本株銘柄（ポートフォリオに含まれる場合）のニュースが不十分になる。WebSearchはタイトルとURLのみ返すため、実際のコンテンツはWebFetchで別途取得が必要。

**Why it happens:**
Google Search GroundingはGoogleのリアルタイムインデックスに直接アクセスし、引用付き応答を生成する。Claude Code WebSearchはAnthropicが管理する独立したインデックスを使用し、検索エンジンを切り替えられない。金融ニュースのリアルタイム性においてGoogleの優位性は明確。

**How to avoid:**
- 株価データはYahoo Finance API（既存）を必ず維持する（WebSearchで株価を取得しない）
- ニュース取得は既存のFinnhub API・RSS フィードを活用し、WebSearchを補完用途に限定する
- 個別銘柄リサーチで使うWebSearchは「定性情報（競合・業界トレンド）」に限定し、定量データはAPI経由にする
- WebSearch結果はWebFetchで内容を確認してから引用する

**Warning signs:**
- WebSearchで取得した株価・決算データが古い（1〜2週間前）
- 日本株銘柄のニュースがほぼヒットしない
- レポート内の数値がYahoo Finance APIの数値と乖離する

**Phase to address:**
Phase 2（データ取得レイヤー）で「何をAPIから取るか、何をWebSearchで取るか」の境界を明確に定義する。

---

### Pitfall 4: スキル実行フローの同期・非同期混在による実行順序崩壊

**What goes wrong:**
`/invest` スキル実行時に「データ収集（TSスクリプト）→ 並行分析（6エージェント）→ レポート生成（モデレーター）」の順序が必要なのに、Claude Codeが並行実行可能と判断して順序を無視する。特にBashツールでのTSスクリプト実行とサブエージェント呼び出しが混在するフローで発生しやすい。

**Why it happens:**
Claude Codeは「依存関係のないタスクは並行実行する」という最適化を行う。スキルのプロンプトに明示的な順序指示がない場合、データ収集が完了する前にアナリストエージェントが起動される可能性がある。

**How to avoid:**
- スキルプロンプトに「Step 1: データ収集完了を確認してから Step 2 へ進む」を明示する
- データ収集スクリプトは結果をファイル（`/tmp/invest-data-{date}.json`）に書き出し、エージェントはそのファイルを読む設計にする
- 「データファイルが存在しない場合は中断する」チェックをエージェントのシステムプロンプトに含める

**Warning signs:**
- エージェントが「市場データが見つからない」と報告する
- TSスクリプトの実行が完了する前にアナリストの出力が来る
- レポートに昨日のデータが使われている

**Phase to address:**
Phase 1でスキルのステップ定義を作成する際に、明示的なデータ依存関係チェックを設計に含める。

---

### Pitfall 5: allowed-tools フロントマター制限の不動作

**What goes wrong:**
`SKILL.md`のフロントマターで `allowed-tools: [Bash, Read]` と指定しても、Claude CodeのバグによりWebSearch等のツールが制限されない。アナリストエージェントが意図せず株価を直接WebSearchで調べてしまい、Yahoo Finance API経由でない不正確なデータを使う可能性がある。

**Why it happens:**
GitHub Issue #37683, #18837 で報告されている既知のバグ。`allowed-tools` の frontmatter フィールドは解析されるが強制されない。CLIとSDKで挙動が異なる可能性もある。

**How to avoid:**
- ツール制限をfrontmatterに頼らず、エージェントのシステムプロンプトで明示的に禁止する（「株価データはファイル経由でのみ取得すること。WebSearchで株価を調べてはいけない」）
- エージェントが使うべきデータをファイルに事前書き込みしておくアーキテクチャにすることで、そもそもWebSearch不要にする

**Warning signs:**
- エージェントがWebSearchで株価を検索している（ツール呼び出しログ）
- レポートの株価がYahoo Finance APIの値と異なる

**Phase to address:**
Phase 1（スキル設計）で各エージェントのシステムプロンプトに明示的ツール禁止指示を含める。

---

### Pitfall 6: Gemini パッケージ除去時の間接依存関係ビルドエラー

**What goes wrong:**
`npm uninstall @google/generative-ai @google/genai` を実行すると、`src/data/news.ts` や `src/agents/` のimport文が残ったままになる。TypeScriptのビルドは通るが実行時エラーが発生する。さらに、`@google/genai`（画像生成）と`@google/generative-ai`（テキスト分析）は別パッケージのため、片方を削除し忘れる。

**Why it happens:**
二つのGeminiパッケージが用途別に分かれており、全ファイルを横断して import を追跡しないと見落とす。`tsconfig.json`の `strict: false` 設定があると型エラーも出ないまま進む。

**How to avoid:**
- Gemini パッケージ除去前に `grep -r "@google/generative-ai\|@google/genai" src/` で全使用箇所をリストアップする
- 段階的に移行する：新実装をClaude Code版で作成 → import切り替え → Geminiパッケージ削除 の順で進める
- `package.json` からの削除後に `npx tsc --noEmit` で型チェックを通す

**Warning signs:**
- `npm uninstall` 後に `Cannot find module '@google/generative-ai'` エラー
- `src/data/news.ts` に残った `GeminiNewsAnalyzer` クラス
- テストが `@google/generative-ai` をモックしている

**Phase to address:**
Phase 3（Gemini依存除去）を独立フェーズとして設け、移行完了後にまとめて削除する。移行前後でテスト可能にする。

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 全市場データを全エージェントに渡す | 実装が単純 | トークンコスト爆発、遅延増大 | never |
| エージェントに自由形式テキスト出力を許可 | プロンプト設計が楽 | レポート生成が不安定 | never |
| Gemini と Claude Code を並行稼働させる移行期 | リスク軽減 | コード複雑化、両API費用発生 | MVPテスト期間中のみ |
| モデルをSonnetで統一（Haikuを使わない） | 実装が単純 | コスト3〜5倍増 | 品質検証フェーズのみ |
| WebSearchで株価を取得（APIの代替） | 追加API不要 | 数値精度が保証されない | never（株価・財務数値は必ずAPI使用） |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| yahoo-finance2 v3 | `import yahooFinance from 'yahoo-finance2'` のdefault import | `const yf = new YahooFinance()` でインスタンス化 |
| Claude Code subagent + TSスクリプト | Bashでスクリプトを実行しその出力をLLMに直接渡す | スクリプト出力をJSONファイルに保存し、エージェントはファイルを読む |
| WebSearch + WebFetch | WebSearch結果（URL一覧）で回答を生成 | WebSearchで発見したURLをWebFetchで取得してから回答する |
| HTML レポート生成 | エージェントに直接HTMLを書かせる（長大なコンテキスト消費） | エージェントはJSON/Markdownで分析結果を返し、別スクリプトがHTMLを組み立てる |
| 複数エージェント並行 → モデレーター集約 | モデレーターが個別エージェントを順次呼び出す（直列） | 全アナリストを並行スポーン、全結果待機後にモデレーター呼び出し |
| Finnhub API ニュース取得 | 全ニュースをエージェントに渡す | 最新20件に絞り込み、銘柄名でフィルタリングしてからエージェントに渡す |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 全エージェント同時スポーン（6並行） | 実行時間は短いが費用が急増 | 3並行×2バッチに分ける | 毎日実行で月次コスト超過 |
| アナリスト出力をそのままモデレーターに渡す | モデレーターのコンテキスト肥大化 | 各アナリスト出力を500トークン以下に要約する | モデレーターが200Kウィンドウに近づく |
| WebFetchで大量ページを取得 | 1ページ最大100KB → ページ数×コスト | 対象URLを銘柄ごとに1〜3件に絞る | 10銘柄×3URL = 30WebFetch呼び出し |
| レポートHTMLをLLMで生成 | 出力トークン上限（8192）でHTMLが途切れる | HTMLテンプレートにデータを差し込む方式に変更 | レポートが1/3で切れる |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| GEMINI_API_KEY を .env 以外に記載 | APIキーの漏洩、意図しないGemini課金継続 | 移行後に `.env` から `GEMINI_API_KEY` を削除する |
| WebSearch で取得した株価データをバリデーションなしで使用 | 不正確な数値がレポートに掲載され投資判断を誤らせる | Yahoo Finance API の値と照合するか、WebSearch株価は使用しない |
| エージェントへのシステムプロンプトに個人ポートフォリオ全体を含める | LLMプロバイダーへの個人資産情報送信 | ポートフォリオデータは銘柄シンボルのみ渡し、保有数量・損益は含めない |

---

## "Looks Done But Isn't" Checklist

- [ ] **スキル実行**: `/invest` コマンドが動いてもデータが前日のもの — `reports/YYYY-MM-DD/` の日付を確認する
- [ ] **Gemini除去**: `npm ls @google/generative-ai @google/genai` でパッケージが残っていないか確認
- [ ] **エージェント出力**: アナリストが毎回同じ推奨銘柄を返す — プロンプトにその日の市場データが渡っているか確認
- [ ] **HTML生成**: レポートHTMLが開けるが途中で切れている — max_tokens設定を確認
- [ ] **WebSearch移行**: ニュースが取れているが2週間前のもの — WebSearch結果の日付フィールドを確認
- [ ] **コスト**: スキル1回の費用が$0.50以下 — Claude Code のコスト追跡ログで確認

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| トークンコスト暴走 | HIGH | 即座にサブエージェントを停止、並行数を1に下げて再実行、コンテキスト圧縮ロジックを追加 |
| アナリスト出力JSON破損 | LOW | エージェントシステムプロンプトにJSON例を追加、structured outputs APIに切り替え |
| Gemini除去後のビルドエラー | MEDIUM | `grep -r "@google"` で残存import発見、stashで元に戻して段階移行に変更 |
| WebSearch株価エラー | LOW | WebSearchの株価取得を削除しYahoo Finance APIのみ使用に変更 |
| レポート生成HTML切れ | LOW | HTMLテンプレート方式に切り替え（LLMにHTMLを書かせない） |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| トークンコスト暴走 | Phase 1: エージェント基盤設計 | スキル1回実行でのトークン使用量を測定し上限以内か確認 |
| 出力非構造化 | Phase 1: スキーマ定義 | モックデータでJSONパースが100%成功することを確認 |
| Search品質劣化 | Phase 2: データ取得レイヤー | Yahoo Finance APIとWebSearch結果を並列実行し乖離チェック |
| 実行順序崩壊 | Phase 1: スキル設計 | データ収集前にエージェントが起動しないことをログで確認 |
| allowed-tools不動作 | Phase 1: スキル設計 | システムプロンプトで禁止指示を入れ、ツール呼び出しログを確認 |
| Gemini除去ビルドエラー | Phase 3: 依存除去 | `npx tsc --noEmit` と `npm run test` が全通過することを確認 |

---

## Sources

- [Claude Code Subagents — Common Mistakes & Best Practices](https://claudekit.cc/blog/vc-04-subagents-from-basic-to-deep-dive-i-misunderstood)
- [The Claude Code Subagent Cost Explosion: 887K Tokens/Min](https://www.aicosts.ai/blog/claude-code-subagent-cost-explosion-887k-tokens-minute-crisis)
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [allowed-tools frontmatter not enforced — GitHub Issue #37683](https://github.com/anthropics/claude-code/issues/37683)
- [Claude Code WebFetch vs WebSearch — Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-web-tools/)
- [Structured outputs — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [AI Agent Token Budget Management — MindStudio](https://www.mindstudio.ai/blog/ai-agent-token-budget-management-claude-code)
- [Skill creation pitfalls — Lessons from building Claude Code](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)

---
*Pitfalls research for: Gemini API → Claude Code migration, multi-agent investment analysis*
*Researched: 2026-06-24*
