---
phase: 10-pipeline-timing
reviewed: 2026-06-28T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/scripts/collect-data.ts
  - src/scripts/collect-data.test.ts
  - .claude/commands/invest.md
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

3 ファイルをレビューした。`collect-data.ts` はパイプライン計測ロジックを追加したスクリプトで、コアロジックは概ね正しい。ただしプロジェクトの Immutability ルール（CRITICAL）違反と、モジュールレベル実行によるテスト分離上の問題がある。`collect-data.test.ts` には Test 5 がモジュールレベルのエラーハンドラを実際にはテストしていない重大なテスト品質問題がある。`invest.md` ではデプロイ処理で AI 生成の `date` フィールドを shell コマンドに直接展開するコマンドインジェクション脆弱性を検出した。

---

## Critical Issues

### CR-01: AI生成データの無検証シェル文字列展開（コマンドインジェクション）

**File:** `.claude/commands/invest.md:1583`
**Issue:** `meeting-result.json` の `date` フィールドは `moderator-final` AI エージェントが書き込む。この値を検証せずに `execSync()` の引数文字列に直接展開している。LLM が `"` や `;`、`$(...)` を含む文字列を出力した場合、任意コマンドが実行される。

問題コード:
```javascript
execSync('git commit -m "report: ' + date + ' daily update"', { stdio: 'inherit' });
```

`date` が `2026-06-28"; rm -rf /tmp "` のような値になると、意図しないコマンドが実行される。

**Fix:**
```javascript
// 1. date を YYYY-MM-DD 形式に限定して検証する
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!datePattern.test(date)) {
  console.error('Invalid date format in meeting-result.json:', date);
  process.exit(1);
}

// 2. execSync に引数配列を渡す（文字列結合を避ける）
const { execFileSync } = require('child_process');
execFileSync('git', ['commit', '-m', `report: ${date} daily update`], { stdio: 'inherit' });
```

---

## Warnings

### WR-01: `metrics` オブジェクトの直接変更（プロジェクト Immutability ルール違反）

**File:** `src/scripts/collect-data.ts:96`
**Issue:** プロジェクトの coding-style.md は Immutability を **CRITICAL** と定めており「ALWAYS create new objects, NEVER mutate」と明記している。L96 では `metrics` オブジェクトを直接変更している。

問題コード:
```typescript
metrics.collectData = { durationMs };  // mutation
```

**Fix:**
```typescript
metrics = { ...metrics, collectData: { durationMs } };
await writeFile(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
```

---

### WR-02: Test 5 がモジュールレベルの catch ハンドラを実際にはテストしていない

**File:** `src/scripts/collect-data.test.ts:132-147`
**Issue:** テスト名は「fetchAllMarketData が reject したとき process.exit(1) が呼ばれる（モジュールトップレベルの catch）」だが、テスト内でその catch ロジックを自前で再実装している。

```typescript
// テストが自分自身で process.exit(1) を呼び出している
await main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);  // ← これはテストコードが呼んでいる
});
expect(processExitSpy).toHaveBeenCalledWith(1);
```

`collect-data.ts` L101-104 のモジュールレベル `main().catch(...)` を削除しても、このテストは引き続き通過する。製品コードの実際の挙動を検証していない。

**Fix:** `vi.resetModules()` を使用してモジュールを再ロードし、モジュールレベルの catch が発動するかを検証する。

```typescript
it("fetchAllMarketData が reject したとき process.exit(1) が呼ばれる", async () => {
  vi.resetModules();  // モジュールキャッシュをクリア

  // モック設定は再ロード後に再設定が必要
  vi.doMock("../data/market.js", () => ({
    fetchAllMarketData: vi.fn().mockRejectedValue(new Error("Market data fetch failed")),
  }));

  // モジュール再ロードでモジュールレベルの main() が発火する
  await import("./collect-data.js");

  // モジュールレベルの catch が非同期なのでフラッシュが必要
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(processExitSpy).toHaveBeenCalledWith(1);
});
```

---

### WR-03: `fmt(0)` が "スキップ" を返す論理バグ

**File:** `.claude/commands/invest.md:1645` および `src/scripts/collect-data.test.ts:191`
**Issue:** パイプラインタイミング表示の `fmt` 関数が `!ms` で falsy チェックをしているため、`ms === 0`（測定値が 0ms に丸められた場合）も "スキップ" を返す。データ収集が 500ms 未満で完了した場合、`Math.round(performance.now() - t0)` が 0 となり、Step 1 の表示が "スキップ" になる。

```javascript
function fmt(ms) {
  if (!ms || isNaN(ms)) return 'スキップ';  // !0 === true なので 0ms もスキップ扱い
```

テスト (collect-data.test.ts:191) にも同じバグがあり、`fmt(0)` のテストケースが欠落している。

**Fix:**
```javascript
function fmt(ms) {
  if (ms === undefined || ms === null || isNaN(ms) || ms < 0) return 'スキップ';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}
```

テスト追加:
```typescript
expect(fmt(0)).toBe("0m 00s");  // 0ms は "スキップ" ではなく有効な計測値
```

---

### WR-04: invest.md のポートフォリオ銘柄ハードコードリストが holdings.ts と二重管理

**File:** `.claude/commands/invest.md:373`
**Issue:** ティッカー抽出ステップにポートフォリオ保有銘柄の除外リストがハードコードされている。同じ情報が `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` にも存在する。保有銘柄が変更された場合、`invest.md` の inline スクリプトを手動更新しないと除外漏れが発生し、ポートフォリオ保有銘柄がデイリーミーティングの注目銘柄として誤って推薦される。

```javascript
// invest.md:373 - holdings.ts と二重管理
const portfolioSymbols = new Set(['MRNA','JOBY','HII','POWL','FLNC','EE',
  '8522.T','5885.T','5576.T','7711.T','NXT','BWMX']);
```

**Fix:** インライン Node.js スクリプトで `holdings.ts` を直接読み込む（tsx 経由）か、ポートフォリオシンボルを JSON ファイルとして外部化して両者から参照する。

```bash
node -e "
const { execSync } = require('child_process');
const holdingsJson = execSync('npx tsx -e \"import { PORTFOLIO_HOLDINGS } from \\\"./src/portfolio/holdings.js\\\"; console.log(JSON.stringify(PORTFOLIO_HOLDINGS.map(h => h.symbol)))\"').toString();
const portfolioSymbols = new Set(JSON.parse(holdingsJson));
// ... 以下同じ
"
```

---

### WR-05: Step 3c と Step 3d の順番が逆（実行順序の不整合）

**File:** `.claude/commands/invest.md:1373-1474`
**Issue:** ファイル内でのセクション出現順序が Step 3d (ポートフォリオ分析, L1373) → Step 3c (HTMLレポート生成, L1474) となっており、番号の昇順と逆になっている。AI エージェントは「Step 3d」が「Step 3c」より先に現れるファイルを上から実行するため、意図しない順序（ポートフォリオ分析 → レポート生成）で処理される可能性がある。

**Fix:** ファイル内のセクション順序を番号順に並べ直す。

```markdown
### Step 3a: WebSearch リサーチ（銘柄ごと並列 Agent）
### Step 3b: 再評価ラウンド（5アナリスト並列 Agent）
### Step 3c: HTMLレポート生成     ← Step 3d と 3c を入れ替える
### Step 3d: ポートフォリオ分析（Portfolio Analysis）
```

---

## Info

### IN-01: マジックナンバー 80・20 を名前付き定数に

**File:** `src/scripts/collect-data.ts:46,52`
**Issue:** 記事の最大件数 (80) と最小件数 (20) がマジックナンバーで記述されている。

**Fix:**
```typescript
const MAX_ARTICLES = 80;
const MIN_ARTICLES = 20;
```

---

### IN-02: console.log 使用（コーディングスタイル違反）

**File:** `src/scripts/collect-data.ts:16-98`
**Issue:** coding-style.md の Code Quality Checklist に「No console.log statements」と明記されているが、スクリプト全体で多数の `console.log` が使用されている。CLI スクリプトとして進捗表示が必要な場合は、軽量なロガーまたは `process.stdout.write` への切り替えを検討する。

**Fix:** 専用ロガー関数を定義するか、スクリプトとしての用途であれば CLAUDE.md に例外を明記する。

---

### IN-03: invest.md 全体に絶対パスがハードコード

**File:** `.claude/commands/invest.md:22,33,44,72 (他多数)`
**Issue:** すべての inline Node.js スクリプトが `/Users/arai/invest/` に絶対パスで依存している。別のユーザーアカウントや別のディレクトリに移動した場合、全 Step が失敗する。

**Fix:** `process.cwd()` または `__dirname` ベースの相対パスを使用する。

```javascript
const BASE = process.env.INVEST_DIR || process.cwd();
const metricsPath = BASE + '/tmp/pipeline-metrics.json';
```

---

### IN-04: `finalArticles` の二重スプレッドコピー

**File:** `src/scripts/collect-data.ts:45,48`
**Issue:** L45 で `[...filtered]` のコピーを作成した直後、L48 の条件分岐内で同じ `[...filtered]` を再度作成して上書きしている。L45 のコピーは条件が `false` の場合のみ使用されるが、コードの意図が不明瞭。

```typescript
let finalArticles = [...filtered];       // L45: コピー作成
if (filtered.length > 80) {
  finalArticles = [...filtered]          // L48: 同じ配列を再コピーして上書き
    .sort(...)
    .slice(0, 80);
}
```

**Fix:**
```typescript
const finalArticles = filtered.length > 80
  ? [...filtered].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 80)
  : filtered;
```

---

### IN-05: ティッカー抽出の正規表現除外リストが不完全

**File:** `.claude/commands/invest.md:359`
**Issue:** テキストフィールドからのティッカー抽出に使う全大文字1〜5文字マッチ (`/\b([A-Z]{1,5})\b/g`) の除外リストが限定的。`FED`, `SEC`, `CEO`, `CFO`, `AND`, `THE`, `FOR`, `NEW`, `DX`, `ROE`, `PBR` など一般的な金融・英語略語が含まれず、誤ったティッカーが Round 3 スコアリングに流入する。

**Fix:** `picks` 配列からの抽出（信頼度高）を主とし、テキストからの正規表現抽出を廃止するか、信頼度の低いソースとして別フィールドで管理する。除外リストの拡充は根本解決にならない。

---

_Reviewed: 2026-06-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
