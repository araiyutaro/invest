# Phase 3: Report Builder + WebSearch Research - Research

**Researched:** 2026-06-24
**Domain:** WebSearch調査パイプライン + Bloomberg風HTMLレポート生成（TypeScript）
**Confidence:** HIGH

## Summary

Phase 3はパイプラインの最終段階で、3つのサブシステムを実装する。(1) `tmp/meeting-result.json` の `highlightedStocks` を対象にした銘柄ごとの並列WebSearch+WebFetchリサーチ、(2) リサーチ結果を踏まえた5アナリストの再評価ラウンド（コメント+スコア再提出）、(3) 全結果を統合したBloomberg風HTMLレポートの生成と `reports/YYYY-MM-DD/` への保存。

既存の `src/report/generator.ts`（v1.0）にはBloomberg風CSS、`markdownToHtml()`、`formatScoringHtml()`、`formatResearchHtml()` が揃っており、これらはv2.0 `MeetingResult` 型に対応した新ジェネレータのベースとして直接流用できる。WebSearch AgentはClaude Code組み込みツールとして利用可能で、外部パッケージ追加は不要。

**Primary recommendation:** v1.0 `generator.ts` のCSS・HTML生成ユーティリティを流用した新スクリプト `src/scripts/generate-report.ts` を作成し、invest.md Step 3から `npx tsx` で呼び出す設計を採用する。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**WebSearchリサーチの設計**
- **D-01:** WebSearchリサーチはミーティング後補完方式。Step 2完了後に `tmp/meeting-result.json` の `highlightedStocks` 配列に含まれる全銘柄を対象にWebSearchを実行する
- **D-02:** highlightedStocksの全銘柄をリサーチ対象とする（スコアによるフィルタリングは行わない）
- **D-03:** WebSearch + WebFetchの組み合わせで調査。WebSearchで概要を取得後、重要な記事2-3件をWebFetchで深掘りする
- **D-04:** WebSearch結果を踏まえた再評価ラウンドを実施。5アナリストがWebリサーチ結果を読み、コメント（見解変更理由等）+ スコア再提出を行う
- **D-05:** 既存の制約を継続: WebSearchは定性情報のみ。株価・財務数値等の定量データはYahoo Finance APIを使用

**investスキルへの統合**
- **D-06:** WebSearchリサーチは銘柄ごとに並列Agent（`model: "sonnet"`）でスポーン
- **D-07:** 再評価ラウンドの5アナリストは `model: "sonnet"` で並列実行
- **D-08:** HTMLレポート生成はTSスクリプトで実装。`src/report/generator.ts` を参照しつつ、v2.0の `meeting-result.json` スキーマに対応した新規レポート生成スクリプトを作成。invest.mdから `npx tsx` で実行する
- **D-09:** レポート出力先は `reports/YYYY-MM-DD/`

### Claude's Discretion

- WebSearch Agentの検索クエリ設計（銘柄名+業界キーワードの組み合わせ等）
- WebFetchで取得する記事の選定基準
- 再評価ラウンドの出力JSONスキーマ詳細設計
- TSレポートジェネレータの内部構造（v1.0のgenerator.tsからの流用度合い）
- `tmp/` に保存するWebSearch結果・再評価結果のファイル構成
- レポートのセクション構成・ビジュアルデザインの詳細

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSRCH-01 | 注目銘柄に対してWebSearchで最新情報を調査できる | D-01/D-02/D-06: highlightedStocks全件を銘柄ごと並列Agentで調査 |
| RSRCH-02 | WebFetchで詳細な記事内容を取得し分析に反映できる | D-03/D-04: WebSearch後に2-3記事をWebFetch、再評価ラウンドに反映 |
| RPT-01 | 分析結果がBloomberg風ダークテーマHTMLレポートとして出力される | D-08: v1.0 CSS流用、新スクリプトで実装 |
| RPT-02 | レポートが `reports/YYYY-MM-DD/` に保存される | D-09: 出力先変更（v1.0の `docs/` から `reports/` へ） |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebSearchリサーチ | Skill（invest.md） | Agent（sonnet） | Claude Code組み込みWebSearchツールはAgentサブエージェント内で実行 |
| 再評価ラウンド | Skill（invest.md） | Agent（sonnet） | Phase 2のRound 2パターンと同一構造 |
| 中間JSONファイル保存 | Skill（invest.md） | — | tmp/配下への書き込みはSkillがBashで実行 |
| HTMLレポート生成 | TypeScript Script | — | npx tsxで呼び出す独立スクリプト、Skill外で完結 |
| ファイル出力管理 | TypeScript Script | — | mkdir/writeFileでreports/YYYY-MM-DD/を作成・書き込み |

## Standard Stack

### Core（追加パッケージなし）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6（既存） | WebSearch結果・再評価JSONのバリデーション | Phase 2で確立済みパターン |
| tsx | ^4.21.0（既存） | generate-report.tsの実行 | Phase 1で確立済みパターン |
| node:fs/promises | built-in（Node v24.3.0） | tmp/・reports/へのファイル読み書き | 既存collect-data.tsと同パターン |

### Package Legitimacy Audit

> Phase 3は外部パッケージを新規追加しない。既存パッケージのみ使用するため本セクションの詳細監査は不要。

新規インストールパッケージ: なし

## Architecture Patterns

### System Architecture Diagram

```
[invest.md Step 3]
      |
      v
[Read: tmp/meeting-result.json]
      |
      v
[highlightedStocks 抽出]
      |
      v
[並列 Agent x N (sonnet)]  ← 銘柄ごとにスポーン（D-06）
  ├── WebSearch: "{ticker} {company} latest news"
  ├── WebFetch: 重要記事 2-3件を深掘り
  └── JSON出力: { ticker, searchResults, articles, summary }
      |
      v
[tmp/research/{ticker}.json に保存]
      |
      v
[並列 Agent x 5 (sonnet)]  ← 5アナリスト再評価（D-07）
  ├── Research結果 + Round 1/2/3の自分の分析 を入力
  └── JSON出力: { agentId, comment, revisedScore, scoreChanged }
      |
      v
[tmp/reeval/{agentId}.json に保存]
      |
      v
[Bash: npx tsx src/scripts/generate-report.ts]
      |
      ├── tmp/meeting-result.json 読み込み
      ├── tmp/research/*.json 読み込み
      ├── tmp/reeval/*.json 読み込み
      ├── HTML生成（Bloomberg風ダークテーマ）
      └── reports/YYYY-MM-DD/daily-report.html 書き出し
```

### Recommended Project Structure

```
src/
├── scripts/
│   ├── collect-data.ts       # 既存（Phase 1）
│   ├── validate-meeting.ts   # 既存（Phase 2）
│   └── generate-report.ts    # 新規（Phase 3）
├── report/
│   ├── generator.ts          # v1.0（参照元、変更しない）
│   └── v2-generator.ts       # 新規、または generate-report.ts に統合
tmp/
├── meeting-result.json       # Phase 2出力（入力）
├── research/                 # 新規ディレクトリ
│   ├── AAPL.json
│   └── 7203.T.json
└── reeval/                   # 新規ディレクトリ
    ├── fundamentals.json
    ├── tenbagger.json
    ├── macro.json
    ├── technical.json
    └── risk-manager.json
reports/
└── YYYY-MM-DD/               # D-09: 新規ディレクトリ
    └── daily-report.html
```

### Pattern 1: 銘柄ごと並列WebSearch Agent

Phase 2のRound 1並列パターンを踏襲し、各銘柄に1つのAgentをスポーンする。

```
// invest.md Step 3 指示パターン（疑似コード）
// highlightedStocksの各tickerに対してAgentを並列スポーン

Agent: websearch-{ticker}
  model: sonnet
  allowed-tools: WebSearch, WebFetch
  prompt: |
    以下の銘柄について最新ニュースと動向を調査してください。

    ## 調査対象
    ティッカー: {ticker}
    モデレーターの評価: {verdict} (スコア: {averageScore}/10)
    概要: {summary}

    ## 調査手順
    1. WebSearchで以下のクエリを実行: "{ticker} {companyName} news earnings"
    2. 関連性が高い記事を2-3件選択してWebFetchで内容を取得
    3. 定性情報のみ抽出（株価・財務数値はYahoo Finance APIで別途取得済みのため不要）

    ## 出力形式（JSONのみ）
    {
      "ticker": "{ticker}",
      "searchQueries": ["使用したクエリ1", "クエリ2"],
      "articles": [
        { "url": "...", "title": "...", "keyPoints": ["要点1", "要点2"] }
      ],
      "researchSummary": "200文字以内の定性情報サマリー",
      "sentimentSignal": "positive | negative | neutral",
      "catalysts": ["注目材料1", "注目材料2"]
    }
```

**Anti-Patterns to Avoid:**
- **定量データのWebSearch依存**: 株価・EPS等はYahoo Finance APIから取得済み。WebSearchで重複取得しない（D-05）
- **スコアフィルタリング**: 全highlightedStocksを対象にする（D-02）。平均スコアで足切りしない

### Pattern 2: 再評価ラウンドJSONスキーマ

Phase 2のRound 2/3パターンを踏襲した軽量スキーマ。

```typescript
// src/meeting/schemas.ts に追加する再評価スキーマ
export const webResearchResultSchema = z.object({
  ticker: z.string(),
  searchQueries: z.array(z.string()),
  articles: z.array(z.object({
    url: z.string(),
    title: z.string(),
    keyPoints: z.array(z.string()),
  })),
  researchSummary: z.string(),
  sentimentSignal: z.enum(["positive", "negative", "neutral"]),
  catalysts: z.array(z.string()),
});

export const analystReevalOutputSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  comment: z.string(),             // Webリサーチを踏まえた見解変更理由
  revisedScores: z.array(z.object({
    ticker: z.string(),
    originalScore: z.number().int().min(1).max(10),
    revisedScore: z.number().int().min(1).max(10),
    scoreChanged: z.boolean(),
    changeReason: z.string(),      // 変更ない場合も理由を記載
  })),
});
```

### Pattern 3: HTMLレポートジェネレータ（v2.0）

v1.0の `src/report/generator.ts` から以下を直接流用する。変更が必要な箇所のみ新スクリプトで上書き。

**流用するもの（変更なし）:**
- `HTML_STYLES` 定数（ダークテーマCSS全体）
- `escapeHtml()` 関数
- `markdownToHtml()` 関数
- `formatScoringHtml()` の設計思想（v2.0型に合わせて再実装）
- `formatResearchHtml()` の設計思想（WebSearch結果表示に流用）

**新規で実装するもの:**
- `generateDailyReport(meetingResult, researchResults, reevalResults)` → HTMLテンプレート
- `reports/YYYY-MM-DD/` へのファイル書き出し（v1.0の `docs/` から変更）
- セクション: 市場サマリー / セクター推奨 / 注目銘柄+再評価スコア / WebResearchまとめ / リスク警告 / アクションアイテム

```typescript
// src/scripts/generate-report.ts の大枠
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MeetingResult } from "../meeting/types.js";

const REPORTS_DIR = join(import.meta.dirname, "../../reports");

async function main() {
  const meetingResult: MeetingResult = JSON.parse(
    await readFile(join(import.meta.dirname, "../../tmp/meeting-result.json"), "utf-8")
  );

  const researchResults = await loadResearchResults();
  const reevalResults = await loadReevalResults();

  const html = generateHtml(meetingResult, researchResults, reevalResults);
  const dateDir = join(REPORTS_DIR, meetingResult.date);
  await mkdir(dateDir, { recursive: true });
  await writeFile(join(dateDir, "daily-report.html"), html, "utf-8");

  console.log(`レポート生成完了: reports/${meetingResult.date}/daily-report.html`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTMLエスケープ | カスタムreplace | v1.0の `escapeHtml()` を流用 | エッジケース（&amp;の二重エスケープ等）がある |
| Markdown→HTML変換 | 正規表現の独自実装 | v1.0の `markdownToHtml()` を流用 | 既に実績あり |
| JSONバリデーション | if文による手動チェック | Zodスキーマ（既存パターン） | Phase 2で確立済み、型安全 |
| WebSearch結果のパース | 独自テキスト解析 | AgentにJSON出力を強制 | Phase 2のパターンと同一 |

## Common Pitfalls

### Pitfall 1: tmp/research/ ディレクトリの事前作成漏れ

**What goes wrong:** `writeFile('tmp/research/AAPL.json')` 実行時にディレクトリが存在せず ENOENT エラー
**Why it happens:** `tmp/` は `mkdir -p` 済みだが `tmp/research/` は未作成
**How to avoid:** Step 3冒頭で `mkdir -p tmp/research tmp/reeval` を実行（Phase 2の Step 2.0 パターンと同様）

### Pitfall 2: ティッカー名にスラッシュや特殊文字を含むファイル名

**What goes wrong:** `7203.T` は `tmp/research/7203.T.json` として問題ないが、将来のティッカー形式（`BRK/B`等）でファイル名として無効になる
**Why it happens:** ティッカーをそのままファイル名に使用している
**How to avoid:** `ticker.replace(/\//g, '-')` でサニタイズしてからファイル名に使用する

### Pitfall 3: WebSearch Agent の JSON 出力が壊れている場合の連鎖失敗

**What goes wrong:** 1銘柄のWebSearch AgentがJSONでない出力を返すと、後続の再評価ラウンドで入力データが欠損する
**Why it happens:** JSONパースエラーを無視して続行するコードがない
**How to avoid:** Phase 2と同様のフォールバック：`{"ticker": "...", "researchSummary": "", "catalysts": [], "sentimentSignal": "neutral", "articles": []}` を保存して続行。再評価ラウンドでは「リサーチ結果なし」として扱う

### Pitfall 4: 再評価スコアと Round 3 スコアの混在

**What goes wrong:** HTMLレポートで「Round 3スコア」と「再評価スコア」を別セクションで表示し、閲覧者が混乱する
**Why it happens:** `meeting-result.json` にはRound 3の `agentScores` が既に入っており、再評価で上書きするか別フィールドにするかが曖昧
**How to avoid:** HTMLレポートには「ミーティング時スコア（Round 3）」と「Web調査後の再評価スコア」を明示的に2つのテーブルで表示する。`meeting-result.json` の `agentScores` は変更しない（再評価結果は `tmp/reeval/` にのみ保存）

### Pitfall 5: reports/ ディレクトリを誤って docs/ に出力

**What goes wrong:** v1.0の `generator.ts` は `docs/` に出力する。コピー流用時に出力先が変わらない
**Why it happens:** `const REPORTS_DIR = join(import.meta.dirname, "../../docs")` の定数をそのまま引き継ぐ
**How to avoid:** 新スクリプトでは `../../reports` に変更。既存の `generator.ts` は変更しない

## Validation Architecture

nyquist_validationの設定が明示的にfalseではないため（設定キー自体が存在しない）、バリデーション実施。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest v4.0.18 |
| Config file | vitest.config.ts（存在するか確認要） |
| Quick run command | `npx vitest run src/scripts/validate-meeting.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSRCH-01 | WebSearch Agent が ticker と researchSummary を含むJSONを返す | unit | `npx vitest run src/scripts/generate-report.test.ts` | Wave 0で作成 |
| RSRCH-02 | WebFetch記事がarticles配列に格納される | unit | `npx vitest run src/scripts/generate-report.test.ts` | Wave 0で作成 |
| RPT-01 | generateHtml()がBloomberg風HTMLを返す（CSS classを含む） | unit | `npx vitest run src/scripts/generate-report.test.ts` | Wave 0で作成 |
| RPT-02 | generate-report.tsがreports/YYYY-MM-DD/daily-report.htmlを出力する | integration | `npx vitest run src/scripts/generate-report.test.ts` | Wave 0で作成 |

### Wave 0 Gaps

- [ ] `src/scripts/generate-report.test.ts` — RSRCH-01, RSRCH-02, RPT-01, RPT-02をカバー
- [ ] `src/meeting/schemas.ts` への再評価スキーマ追加（`webResearchResultSchema`, `analystReevalOutputSchema`）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | generate-report.ts実行 | ✓ | v24.3.0 | — |
| tsx | npx tsx generate-report.ts | ✓ | v4.21.0 | — |
| zod | JSONバリデーション | ✓ | ^4.3.6 | — |
| vitest | テスト実行 | ✓ | ^4.0.18 | — |
| WebSearch | Agent内WebSearch | ✓ | Claude組み込み | — |
| WebFetch | Agent内WebFetch | ✓ | Claude組み込み | — |

**Missing dependencies with no fallback:** なし

## Code Examples

### MeetingResult → HTML セクション変換の参照パターン

v1.0 `generator.ts` の `formatScoringHtml()` がv2.0スキーマにどう対応するかの参照:

```typescript
// v1.0 では MeetingRecord.scoreSummaries を使用
// v2.0 では MeetingResult.highlightedStocks を使用（agentScores フィールドが同等）

// v2.0 対応版イメージ
function formatHighlightedStocksHtml(result: MeetingResult): string {
  return result.highlightedStocks.map(stock => {
    const scoreColor = (s: number) => s >= 7 ? "#10b981" : s >= 4 ? "#f59e0b" : "#ef4444";
    const verdictColor = stock.verdict === "強気" ? "#10b981"
      : stock.verdict === "弱気" ? "#ef4444" : "#f59e0b";
    // ... agentScores をテーブル行に変換
  }).join("");
}
```

### WebResearchResult → HTML 表示パターン（v1.0 formatResearchHtml の踏襲）

```typescript
// v1.0 では StockResearchResult.research (markdown文字列) を表示
// v2.0 では WebResearchResult.researchSummary + catalysts + articles を表示

function formatWebResearchHtml(researchResults: WebResearchResult[]): string {
  if (researchResults.length === 0) return "";
  const cards = researchResults.map(r => `
    <div class="agent-card" style="border-left-color: #10b981;">
      <h4>${escapeHtml(r.ticker)}</h4>
      <p>${escapeHtml(r.researchSummary)}</p>
      ${r.catalysts.length > 0 ? `<ul>${r.catalysts.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("");
  return `<hr><h2>WebSearch Research（注目銘柄の最新情報）</h2>${cards}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Search Grounding（Gemini） | Claude Code WebSearch + WebFetch | Phase 3 | 外部API依存なし、Claude組み込みツールで完結 |
| チャート画像生成（NanoBanana） | テキストベース分析のみ | Phase 3 | 画像生成不要、HTML軽量化 |
| `docs/` 出力 | `reports/YYYY-MM-DD/` 出力 | Phase 3 | D-09要件、v1.0との出力先変更 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WebSearch/WebFetchはAgentサブエージェント内で `allowed-tools` に指定すれば使用可能 | Architecture Patterns | AgentのツールをWebSearch許可しないと動作しない；invest.mdのAgent定義に `WebSearch, WebFetch` を明示する必要がある |
| A2 | `tmp/research/` と `tmp/reeval/` を中間ファイル置き場として使う設計（投資フォルダの慣習に合致） | Project Structure | Phase 2の `tmp/round-{N}/` パターンと一貫性がある。違う設計が好まれる場合は要確認 |
| A3 | 再評価スコアは `meeting-result.json` の `agentScores` を変更せず `tmp/reeval/` にのみ保存する | Common Pitfalls | meeting-result.jsonを書き換えない設計が正しいかはClaude's Discretion |

**Assumptionsが少ない理由:** Phase 2で確立されたパターン（並列Agent、tmp/保存、Zodバリデーション）をそのまま踏襲するため、新たな仮定が少ない。

## Open Questions

1. **再評価スコアのHTMLレポートへの反映方法** (RESOLVED)
   - What we know: `meeting-result.json` にはRound 3の `agentScores` が入っている。再評価後スコアは `tmp/reeval/` に保存予定
   - Resolution: Round 3スコアリングマトリクスと、再評価ラウンド結果を別セクションで表示する。再評価セクションでは changed === true の銘柄のみ originalScore → revisedScore の変化を表示する（Plan 02 formatReevalHtml で実装）

2. **highlightedStocks が0件の場合の動作** (RESOLVED)
   - What we know: D-02で「全件対象」だが、ミーティングで銘柄が0件の可能性はある
   - Resolution: 0件を検知してWebSearch/再評価ラウンドをスキップし、HTMLレポートのみ生成する（Plan 01 Task 2 Step 3.0 で実装）

**Note:** RESEARCH.md Pattern 2 のスキーマ案（searchQueries, sentimentSignal, catalysts）は planning 段階で精緻化され、PATTERNS.md・Plan の最終スキーマ（positiveFindings, negativeFindings, keyArticles, researchedAt）が正式版。投資分析のコンテキストに適した構造に改善された。

## Sources

### Primary (HIGH confidence)
- `src/report/generator.ts` — v1.0 Bloomberg風HTML生成コード全体（直接読み取り）
- `src/meeting/types.ts` — v2.0 MeetingResult型定義（直接読み取り）
- `src/meeting/schemas.ts` — v2.0 Zodスキーマ（直接読み取り）
- `.claude/commands/invest.md` — Step 3のプレースホルダーとStep 2の実装パターン（直接読み取り）
- `package.json` — 利用可能パッケージ・バージョン（直接読み取り）

### Secondary (MEDIUM confidence)
- `.planning/phases/03-report-builder-websearch-research/03-CONTEXT.md` — ユーザー決定事項

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 新規パッケージなし、全て既存の確認済み依存
- Architecture: HIGH — Phase 2パターンの直接踏襲、v1.0コードを実際に読んで確認
- Pitfalls: HIGH — v1.0コードの実装を読んで具体的な落とし穴を特定
- WebSearch Agentスキーマ設計: MEDIUM — Claude's Discretion領域、実装で調整可能

**Research date:** 2026-06-24
**Valid until:** 2026-07-24（安定スタック、外部依存なしのため長め）
