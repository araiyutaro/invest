# Phase 17: Pipeline Integration & Orchestration - Research

**Researched:** 2026-07-02
**Domain:** Wiring an already-built, already-tested LLM curation contract (Phase 15) and HTML renderer (Phase 16) into the existing daily `/invest` pipeline (`.claude/commands/invest.md`) as a fail-soft 4th report
**Confidence:** HIGH

## Summary

This phase is pure integration work. Every piece of business logic this phase needs already exists and is unit-tested: `validateRawNewsCuration()` / `resolveNewsCuration()` (Phase 15, `src/meeting/schemas.ts`) and `generateNewsDigestHtml(curation, date)` (Phase 16, `src/scripts/generate-news-digest.ts`). Phase 17's job is exclusively (1) adding a second parallel Agent call to `invest.md`'s existing Step 3d block that reads `tmp/news.json` and writes `tmp/news-curation.json`, and (2) building one new CLI script, `src/scripts/write-news-digest.ts`, that reads that raw output plus the `tmp/news.json` pool plus `tmp/meeting-result.json`'s date, calls the two Phase 15/16 functions, and writes `docs/{date}/news-digest.html` — always, even on total curation failure (Phase 16's `generateNewsDigestHtml(null, date)` fallback branch already exists for this).

The single biggest risk this phase must design against is **failure-isolation regression**: `generate-report.ts`'s existing `Promise.all([...3 writeFile calls])` must not gain a 4th member, and the pipeline's existing hard-fail STEP markers (`report-generation:FAIL`, `deploy:FAIL`) must not be reused for curation failures. `.planning/phases/17-pipeline-integration-orchestration/17-CONTEXT.md`'s locked decisions (D-10 in particular: a separate CLI script invoked as its own Bash command, never touching `generate-report.ts`) already resolve this at the design level — this research confirms the mechanism is sound by tracing `scripts/run.sh`'s actual failure-notification logic (see Pitfall/Finding "run.sh notification is exit-code-gated, not marker-count-gated" below) and by reading the exact file contracts Phase 15/16 produced (which differ in some field names from the earlier pre-implementation `.planning/research/ARCHITECTURE.md` draft — see State of the Art section).

**Primary recommendation:** Add the curation Agent as a second parallel call inside Step 3d's existing message (per D-01), build `write-news-digest.ts` as a small orchestrator around the two already-tested Phase 15/16 functions (never re-implementing their logic), and make its exit code (not its file output) the OK/FAIL signal that `invest.md`'s prose maps to `[STEP:news-digest:OK]` / `[STEP:news-digest:FAIL:...]` — while explicitly instructing the pipeline to continue to Step 4 regardless of that exit code, mirroring the portfolio-analyst retry-then-continue precedent already in the file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Article selection, market/importance classification, Japanese commentary (LLM judgment) | Claude Agent (Agent tool, `news-curator`, opus) | — | Single-purpose judgment call, same shape as `portfolio-analyst`; never TS-side (Pattern 3, `.planning/research/ARCHITECTURE.md`) |
| `tmp/news-curation.json` persistence of raw Agent output | Orchestration Skill (`invest.md` Bash block) | — | Agent tool stdout never reaches `invest.md` directly — must be written to `tmp/*.json` by the orchestrating Claude session, same convention as every other agent step (Pitfall 8) |
| ID resolution, hallucination-proofing, count soft-clamp, structural validation | TS Script (`src/meeting/schemas.ts` — already built, Phase 15) | — | Pure functions, already unit-tested; Phase 17 only calls them, does not modify them |
| HTML rendering (market grouping, badges, escaping, fallback shells) | TS Script (`src/scripts/generate-news-digest.ts` — already built, Phase 16) | — | Pure function, already unit-tested; Phase 17 only calls it |
| `docs/{date}/news-digest.html` file write | TS Script (new: `src/scripts/write-news-digest.ts`) | Filesystem (`docs/`) | New orchestrator script for this phase — the only new production code file |
| Failure isolation (curation failure must not block other 3 reports or deploy) | Orchestration Skill (`invest.md` prose/Bash) | TS Script (process boundary via separate `npx tsx` invocation) | D-10: process boundary IS the isolation mechanism — no shared `Promise.all`, no shared try/catch with `generate-report.ts` |
| `[STEP:news-digest:*]` marker emission | Orchestration Skill (`invest.md` Bash `echo`) | — | Mirrors existing STEP marker convention exactly (Bash echo, `run.sh` greps log) |
| pipeline-metrics timing for curation | Orchestration Skill (`invest.md` `node -e` blocks) | Filesystem (`tmp/pipeline-metrics.json`) | Mirrors existing `portfolioStart`/`portfolioEnd` pattern |
| Deploy (`git add docs/`, commit, push) | Orchestration Skill (Step 4, unchanged) | — | `git add docs/` is already unconditional/recursive — automatically picks up the new file with zero Step 4 code changes |

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` (project-level) contains one actionable directive relevant to this and all phases:

- **GSD command format:** Always use hyphens in GSD command references (`/gsd-execute-phase`), never colons (`/gsd:execute-phase`). This applies to any GSD command mentioned in `invest.md` prose, plan text, or user-facing output produced during this phase (unlikely to be directly relevant to `invest.md` itself, but must be honored in any planning/discussion artifacts this phase's plan produces).

No other project-specific coding conventions, testing rules, or security requirements are declared in `./CLAUDE.md` beyond this. No `.claude/skills/` or `.agents/skills/` directory exists in this project — no additional skill-specific conventions to load.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Agentステップの配置とモデル**
- **D-01:** キュレーションAgentは Step 3d（portfolio-analyst）と同じメッセージで2体並列起動する。入力は `tmp/news.json` のみでミーティング結果に依存しないため並列可能。実行時間を伸ばさず、既存ステップ構造への変更も最小（リサーチ推奨案）。Round 1バッチへの混載（6体目）は関心事の混在と失敗判定の複雑化のため不採用。
- **D-02:** モデルは **opus**。「なぜ重要か」解説コメントとリード文の執筆品質がダイジェストの価値の中核であり、20〜80件→10〜15件の取捨選択は編集判断。日次1呼び出しのみでコスト影響小。portfolio-analyst（opus）と同格の扱い。

**キュレーションプロンプト設計**
- **D-03:** 記事プールは **URL以外の全フィールド**（id + title + summary + source + publishedAt + ticker）を渡す。summaryがあることで解説コメントの根拠が豊かになる。URLを意図的に除外することで、AgentがURLをエコーする余地を構造的になくす（ID参照方式の徹底）。
- **D-04:** 市場分類（us/japan/global）は**数例のルールをプロンプトに明示**する: Fed金融政策・米経済指標→us、日銀・円相場→japan、原油・地政学・世界経済→global、個別企業は上場市場で判定。細部はAgent判断に委ねる（ベストエフォート方針はロードマップで確定済み）。
- **D-05:** 重要度判定（high/medium/low と選定自体）は市場全体へのインパクトを主軸にしつつ、**ポートフォリオ保有銘柄・監視中銘柄に直接関係するニュースは優先度を上げる**とプロンプトに明記する。個人投資家の意思決定支援というツールの目的に合致（NEWS-01のティッカー別取得データを活かす）。
- **D-06:** tickerNames の会社名は**英語正式名で統一**（例: NVDA→NVIDIA）。カタカナ表記の揺れを避ける。※Phase 16 D-04の契約（社名欠落時はシンボルのみ表示）はそのまま。

**失敗時の挙動詳細**
- **D-07:** Agentが不正JSONを返した場合は**1回リトライ**（portfolio-analyst / moderator の既存慣例に一致）。2回目も失敗なら `tmp/news-curation.json` を作成せずに続行（fail-soft）。
- **D-08:** キュレーション完全失敗日も **news-digest.html はフォールバックページとして書き出す**（Phase 16 D-12の「生成できませんでした」ページ）。ファイルは常に存在しindexリンクも常に有効。失敗が読者にも可視化される。Phase 18の条件分岐は主に v2.4 以前の過去日付エントリ向けとなる。
- **D-09:** 失敗の把握は**ログのみ**: `[STEP:news-digest:FAIL:理由]` マーカー（OPS-04要件通り）。fail-soft下ではパイプライン全体は `[PIPELINE:OK]` で完了し、run.sh の通知基盤には手を入れない（Phase 14.1で調整済みの run.sh への回帰リスクを避ける）。成功時は `[STEP:news-digest:OK]`。

**generate-report.ts への統合方式**
- **D-10:** 検証（validateRaw→resolve）・描画・書き出しは**専用CLIスクリプト**（例: `src/scripts/write-news-digest.ts`）に置き、invest.md から `generate-report.ts` の後に別コマンドで起動する。プロセス境界そのものが fail-soft 分離になり、exit code / stdout で OK/FAIL 判定が単純。既存 `generate-report.ts` は無改修（回帰リスクゼロ）。
- **D-11:** pipeline-metrics.json と最終タイミング表示に**キュレーションの専用行を追加**する。並列窓（Step 3d）のAgent計測と、news-digest書き出しCLIの計測を追加し、v2.2の12ステップ表示思想を維持する。

### Claude's Discretion
- CLIスクリプトの正確なファイル名・関数分割（既存 `generate-report.ts` / `validate-meeting.ts` の慣例に従う）
- キュレーションAgentの name（例: `news-curator`）とプロンプトの正確な文面（D-03〜D-06の決定を満たすこと。出力JSONフォーマット例は既存Agentステップの様式に従う）
- pipeline-metrics のキー名・タイミング表の行ラベル
- invest.md の Step 3c 完了確認表示への news-digest.html 追加の具体形
- FAILマーカーの理由文字列の粒度（Agent失敗 / JSON不正 / 書き出し失敗の区別が事後調査で分かる程度）
- 「正常だが0件」の日はPhase 15 D-05の通り有効な契約なので `[STEP:news-digest:OK]` 扱い（グレースフル0件表示はレンダラー実装済み）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope（run.sh通知の拡張はD-09で意図的に不採用として決着、v2.5+のXREP-01は既にREQUIREMENTS.mdで追跡済み）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURA-01 | ニュースキュレーションHTML（news-digest.html）が4紙目のレポートとして docs/YYYY-MM-DD/ に生成される | `generateNewsDigestHtml()` (Phase 16, already built/tested) + new `write-news-digest.ts` CLI wiring it to a file write; `git add docs/` in Step 4 is already unconditional/recursive, needs zero changes to pick up the new file |
| OPS-04 | キュレーションステップの失敗時も既存3レポートの生成・デプロイが継続する（fail-soft設計、独自STEPマーカーによる失敗可視化） | D-10's process-boundary isolation (separate `npx tsx` invocation, never inside `generate-report.ts`'s `Promise.all`); verified `run.sh`'s notification logic is EXIT_CODE-gated, not STEP-marker-count-gated (see Common Pitfalls) — confirms D-09 is technically sound as designed |

</phase_requirements>

## Standard Stack

### Core

No new packages. This phase adds zero npm dependencies — it is pure TypeScript orchestration code plus `.claude/commands/invest.md` prose/Bash edits, using packages already installed and already used throughout the pipeline.

| Library | Version (confirmed via `package.json`) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^4.3.6 [VERIFIED: package.json] | Already used by `validateRawNewsCuration` (Phase 15) — this phase only calls it, doesn't add new schemas | Every `tmp/*.json` contract in this codebase is zod-validated |
| `tsx` | ^4.21.0 [VERIFIED: package.json] | Runs the new `write-news-digest.ts` CLI script exactly like `generate-report.ts`/`validate-meeting.ts`/`update-index.ts` are run today | Established convention — `npx tsx src/scripts/*.ts` is how every pipeline script is invoked from `invest.md` |
| `vitest` | ^4.0.18 [VERIFIED: package.json] | Unit-testing the new script's pure logic (RED→GREEN per this project's TDD convention) | No `vitest.config.*` file exists — defaults apply; `npm test` = `vitest run`, colocated `*.test.ts` files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` (Node built-in) | Node 20+ (project's runtime) | `readFile`/`writeFile`/`mkdir` in the new CLI script | Same as every existing `src/scripts/*.ts` file — no fs wrapper library used anywhere in this codebase |

### Alternatives Considered

None — the phase's own locked decisions (D-10) already prescribe the exact mechanism (separate CLI script, no new deps), and no part of this integration work benefits from any library not already in the project.

**Installation:**
```bash
# No installation required — zero new dependencies for this phase.
```

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages (confirmed above — zero new `package.json` entries needed). The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
tmp/news.json (existing, Step 1 output, 20-80 articles WITH `id` field — Phase 15 complete)
     │
     ├──────────────────────────────────────────────────────────┐
     ▼                                                            │
[Step 3d, Bash]: Read tool loads tmp/news.json                    │
     │ (pool minus `url` per D-03: id/title/summary/source/       │
     │  publishedAt/ticker only, embedded in Agent prompt text)   │
     ▼                                                            │
┌─────────────────────────────┐   ┌──────────────────────────────▼──┐
│ Agent: portfolio-analyst     │   │ Agent: news-curator (NEW)        │
│ (existing, opus)             │   │ (opus, D-02)                     │
│ reads portfolio.json +       │   │ selects 10-15 by ID, classifies  │
│ meeting-result.json          │   │ market/importance, writes        │
│                               │   │ Japanese commentary + leadIn     │
└──────────────┬────────────────┘   └───────────────┬───────────────┘
               │ (parallel, same message — D-01)      │
               ▼                                       ▼
    tmp/portfolio-analysis.json          tmp/news-curation.json (NEW)
    (unchanged path)                      [invest.md Bash: JSON.parse +
                                            retry-once-then-skip, D-07 —
                                            mirrors portfolio-analyst exactly]
               │                                       │
               ▼                                       │ (file may be ABSENT
    generate-report.ts (UNCHANGED — D-10)               │  if Agent failed twice)
    Promise.all([3x writeFile])                         │
    → daily/minutes/portfolio .html                     │
               │                                       ▼
               │                          [NEW, separate Bash command, AFTER
               │                           generate-report.ts, BEFORE update-index.ts]
               │                          npx tsx src/scripts/write-news-digest.ts
               │                             1. read tmp/meeting-result.json → date
               │                             2. try: read+JSON.parse tmp/news-curation.json
               │                                → validateRawNewsCuration() [zod, MAY throw]
               │                                → read tmp/news.json → pool
               │                                → resolveNewsCuration(raw,pool,date,generatedAt)
               │                                   [never throws — Phase 15]
               │                                → generateNewsDigestHtml(curation, date)
               │                                catch: generateNewsDigestHtml(null, date)
               │                                       [D-08 fallback page]
               │                                → ALWAYS writeFile docs/{date}/news-digest.html
               │                                → process.exit(0) on success path,
               │                                  process.exit(1) on any caught failure
               │                                       (exit code = OK/FAIL signal, D-10)
               │                                            │
               ▼                                            ▼
        [invest.md prose reads exit code]
        exit 0 → echo '[STEP:news-digest:OK]'
        exit 1 → echo '[STEP:news-digest:FAIL:<reason>]'
        BOTH branches: continue to Step 4 (never PIPELINE:FAIL) — D-09
               │
               ▼
    Step 4 (UNCHANGED): update-index.ts, git add docs/ (recursive,
    picks up news-digest.html automatically), commit, push
```

### Recommended Project Structure

```
src/scripts/
├── write-news-digest.ts        # NEW — the only new production file this phase adds
├── write-news-digest.test.ts   # NEW — unit tests for the orchestration logic
.claude/commands/
└── invest.md                   # MODIFIED — Step 3d (2nd parallel Agent call),
                                 #   new Bash block after Step 3c / before Step 4,
                                 #   pipeline-metrics keys, STEP marker echoes,
                                 #   Step 3c completion-message file list (discretion)
```

No changes to `src/meeting/types.ts`, `src/meeting/schemas.ts`, `src/scripts/generate-news-digest.ts`, `src/scripts/generate-report.ts`, `src/scripts/report-data-loaders.ts`, or `src/scripts/collect-data.ts` — all of these are Phase 15/16 deliverables this phase only *consumes*.

### Pattern 1: Second Parallel Agent in Step 3d (extend, don't duplicate)

**What:** Add a second `Agent` tool invocation to Step 3d's existing single-Agent message, turning "1つの Agent ツールを呼び出してください" into "以下2つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください" — the exact phrasing pattern already used 3 times in `invest.md` for 5-way parallel analyst rounds (lines 148, 519, 899, 1347), just with N=2 instead of N=5.
**When to use:** Any time a new single-purpose Agent call has no data dependency on an existing parallel call in the same step.
**Example (verified from `invest.md` line 1564 onward, current Step 3d):**
```
**1つの Agent ツールを呼び出してください:**
- name: `portfolio-analyst`
- model: `opus`
- prompt: ...
```
Becomes (illustrative target shape, per D-01):
```
**以下2つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

- name: `portfolio-analyst`
  model: `opus`
  prompt: ... [unchanged]

- name: `news-curator`
  model: `opus`  [D-02]
  prompt: ... [reads tmp/news.json pool minus url, per D-03-D-06]
```

### Pattern 2: Retry-once-then-skip-file (fail-soft agent output handling)

**What:** If the Agent's JSON output fails to parse, retry the Agent call exactly once; if the retry also fails, do NOT write the output file, log a warning to the user, and continue the pipeline.
**When to use:** Any Agent step whose output feeds an optional/gracefully-degradable downstream artifact.
**Example (verbatim precedent, `invest.md` line 1636, portfolio-analyst):**
```
出力が有効な JSON でない場合は、エージェントを1回リトライしてください。2回目も失敗した場合は
「警告: ポートフォリオ分析の生成に失敗しました。フォールバック表示で続行します。」とユーザーに
表示して続行してください（portfolio-analysis.json を作成しない）。
```
The news-curator step should use this template verbatim (D-07), substituting the file name and warning text. **Do not** invent a different retry mechanism.

### Pattern 3: Process-boundary fail-soft isolation via separate CLI invocation (D-10)

**What:** Rather than adding a 4th `writeFile` to `generate-report.ts`'s `Promise.all`, run a wholly separate `npx tsx` process after `generate-report.ts` completes. The OS process boundary means any uncaught exception, `process.exit(1)`, or crash inside `write-news-digest.ts` cannot affect the already-completed writes to `daily-report.html`/`meeting-minutes.html`/`portfolio-report.html` — those files exist on disk regardless of what happens next.
**When to use:** Whenever a new report-generation feature has a materially higher failure rate than the existing trusted reports (here: it depends on a second, less-constrained LLM call).
**Example (mirrors the existing Step 3c → Step 4 command-sequencing style, `invest.md` lines 1672-1680 for the precedent of "run script, check exit behavior, decide STEP marker"):**
```bash
cd /Users/arai/invest && npx tsx src/scripts/write-news-digest.ts
```
Unlike `generate-report.ts`'s failure handling (which **stops the pipeline** — `echo '[PIPELINE:FAIL]'`), the new instruction text must explicitly say the opposite: continue to Step 4 regardless of this command's exit code, only choosing which STEP marker line to echo based on that exit code.

### Anti-Patterns to Avoid

- **Adding `write-news-digest.ts`'s file write into `generate-report.ts`'s `Promise.all`:** Reintroduces Pitfall 1 (a digest bug takes down all 4 reports, not just the digest). D-10 explicitly forbids modifying `generate-report.ts`.
- **Reusing the `report-generation` or `deploy` STEP markers for curation failures:** `run.sh`'s failure-notification path treats any `[STEP:*:FAIL]` name as informational text only (see Common Pitfalls below) — but a naive implementer might still wire `[STEP:report-generation:FAIL]` after a curation failure, which combined with prose that says "stop the pipeline" for that marker (as it currently does for `report-generation`) would incorrectly halt Step 4. Use `[STEP:news-digest:*]` exclusively, and never pair it with `[PIPELINE:FAIL]` (D-09).
- **Making the curation Agent's success gate the file write:** Per D-08, `news-digest.html` must be written on EVERY run, success or failure — the null-fallback branch of `generateNewsDigestHtml()` already exists for exactly this. Do not add an `if (curationSucceeded) writeFile(...)` guard.
- **Treating the CLI script's exit code as something invest.md must react to by stopping:** Unlike `report-generation:FAIL`/`deploy:FAIL` (which the file explicitly instructs to stop the pipeline for), a non-zero exit from `write-news-digest.ts` must be textually instructed to continue to Step 4. Copy-pasting the report-generation "stop the pipeline" prose pattern here is the single most likely way to accidentally regress OPS-04.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structural validation of curation Agent JSON output | A new zod schema or manual field checks inside `write-news-digest.ts` | `validateRawNewsCuration()` (`src/meeting/schemas.ts`, Phase 15, already built/tested) | Duplicating this logic risks drifting from the already-tested enum/passthrough rules (17 existing unit tests cover it) |
| Hallucination-proof URL/title resolution from article IDs | Manual `.find()` lookups against `tmp/news.json` inside the new script | `resolveNewsCuration(raw, pool, date, generatedAt)` (Phase 15) | Already handles unknown-ID drop, duplicate-ID drop, empty-commentary drop, and 15-article truncation with `console.warn` — reimplementing risks silently dropping one of these safety checks |
| Market-grouped, importance-sorted, escaped HTML rendering | A new template string builder in `write-news-digest.ts` | `generateNewsDigestHtml(curation, date)` (`src/scripts/generate-news-digest.ts`, Phase 16, already built/tested) | Already covers the null/empty/normal 3-way fallback (D-08's exact requirement) and all XSS/tabnabbing mitigations — this phase's script should be a thin caller, nothing more |
| STEP marker / retry-once-then-skip semantics | A new failure-handling convention specific to news-curator | The `portfolio-analyst` template verbatim (`invest.md` line 1636) | This project has one established convention for "optional Agent step that may fail" — introducing a second, subtly different one increases audit surface with no benefit |

**Key insight:** This phase has effectively zero new *business logic* to write. The only genuinely new code is the ~40-60 line orchestration script (`write-news-digest.ts`) that sequences 4 already-tested function calls (`validateRawNewsCuration` → build pool → `resolveNewsCuration` → `generateNewsDigestHtml`) plus file I/O. Any plan that proposes touching `src/meeting/schemas.ts` or `src/scripts/generate-news-digest.ts` in this phase should be treated as scope creep — those files are Phase 15/16 deliverables, already merged and tested (179/179 tests passing as of this research).

## Common Pitfalls

### Pitfall 1: `run.sh`'s failure notification is gated by process EXIT_CODE, not by STEP-marker presence — but this must not be assumed, it must be verified per-change

**What goes wrong:** A developer might assume that any `[STEP:*:FAIL]` line appearing in the log will trigger `run.sh`'s Basso failure notification sound, and therefore either (a) avoid emitting `[STEP:news-digest:FAIL:...]` at all (breaking OPS-04's "失敗可視化" requirement), or (b) worry unnecessarily that D-09's "ログのみ" approach is insufficient.

**Why it happens / What is actually verified:** Direct inspection of `/Users/arai/invest/scripts/run.sh` (lines 35-79) confirms: `EXIT_CODE` comes solely from the `claude --dangerously-skip-permissions -p "/invest" ...` process's own exit status (`|| EXIT_CODE=$?`). The `grep -o '\[STEP:[^:]*:FAIL' "$LOG_FILE"` call (line 73) only executes **inside the `else` branch**, i.e., only when `EXIT_CODE -ne 0` already — its sole purpose there is to extract a human-readable step name for the notification message text, not to *decide* pass/fail. Therefore: as long as the Claude Code session running `/invest` completes its turns normally (does not itself error out, get stuck, or hit `--max-turns 200`), `EXIT_CODE` will be `0` and the success notification (`パイプライン正常完了`, Glass sound) fires — regardless of how many `[STEP:news-digest:FAIL:...]` lines are in the log. This confirms D-09's design is technically correct as stated (no `run.sh` changes needed) — but it also means the burden is entirely on `invest.md`'s prose to never itself decide to stop/error out because of a `news-digest:FAIL` marker.

**How to avoid:** Write `invest.md`'s new Bash/prose block so that a non-zero exit from `write-news-digest.ts` is explicitly, textually instructed to be non-fatal — e.g. "スクリプトの終了コードに関わらず、Step 4 へ進んでください" — mirroring how the portfolio-analyst fallback text says "続行してください" rather than anything resembling the `report-generation:FAIL`/`deploy:FAIL` blocks' "パイプラインを停止してください" wording.

**Warning signs:** If `invest.md`'s new prose for this step contains the phrase "パイプラインを停止してください" or emits `[PIPELINE:FAIL]` anywhere near the news-digest block, that is the exact regression this phase must avoid (this is Pitfall 7 from `.planning/research/PITFALLS.md`, now further localized to this specific verified mechanism).

**Phase to address:** This phase (`invest.md` editing).

---

### Pitfall 2: `write-news-digest.ts`'s "OK vs FAIL" signal is not the same as "did a file get written" — these must be decoupled in the script's own exit-code logic

**What goes wrong:** Because D-08 requires `news-digest.html` to be written on *every* run (including total curation failure, via the null-fallback branch), a naive implementation might use "did `writeFile` succeed" as the success signal — which will almost always be true even on a curation-failure day, silently defeating the FAIL marker.

**Why it happens:** The happy-path and the D-08 fallback-path both end in the exact same final statement (`writeFile(docs/{date}/news-digest.html, html)`), so it's easy to conflate "the write succeeded" with "the curation succeeded."

**How to avoid:** The script's exit code must reflect whether `tmp/news-curation.json` was present and passed `validateRawNewsCuration()` — not whether the HTML write succeeded. Recommended shape (see Code Examples): a `try { ...happy path... } catch (e) { ...write null-fallback HTML...; console.error(...); process.exit(1); }` structure, where the `writeFile` call for the fallback page happens *inside* the catch block, immediately before `process.exit(1)`. This guarantees the file always exists (D-08) while still signaling failure via exit code (D-10) for `invest.md`'s STEP marker choice.

**Warning signs:** A test where `tmp/news-curation.json` is deliberately absent still results in the script exiting `0` — this means the FAIL signal has been silently lost.

**Phase to address:** This phase (`write-news-digest.ts` implementation).

---

### Pitfall 3 (inherited from `.planning/research/PITFALLS.md` Pitfall 7/8, now scoped to this phase): Reusing an existing hard-fail STEP marker, or writing curation output outside the `tmp/*.json` handoff convention

**What goes wrong:** Bolting the curation Agent call onto the existing `report-generation` STEP marker (rather than introducing `news-digest` as its own), or having the new script assume it can read the Agent's response directly rather than from `tmp/news-curation.json`.

**Why it happens:** Path of least resistance — Step 3d already has a STEP-marker-free internal Agent call embedded in the broader `report-generation` step wrapper (STEP markers here are coarse-grained, wrapping Steps 3a-3d + 3c together).

**How to avoid:** Confirmed the file-handoff convention is honored 100% of the time in the current `invest.md`: every Agent step's "完了後の処理" prose explicitly says "エージェントの応答を...ファイルに保存してください" before any downstream script reads it. Follow this exactly for `news-curator` → `tmp/news-curation.json`. Emit `[STEP:news-digest:START]` before the new Bash block and `[STEP:news-digest:OK]`/`[STEP:news-digest:FAIL:...]` after it — as its own marker pair, distinct from `report-generation`.

**Phase to address:** This phase.

## Code Examples

Verified patterns from the actual current codebase (not the pre-implementation draft in `.planning/research/ARCHITECTURE.md`, which used a different, now-superseded contract shape):

### Actual Phase 15/16 contract shape (verified by direct read, 2026-07-02)

```typescript
// src/meeting/types.ts (existing, do not modify)
export interface CuratedArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // ISO 8601, resolved from tmp/news.json pool — not agent-authored
  readonly market: "us" | "japan" | "global";       // NOTE: lowercase enum, not 米国株/日本株/グローバル
  readonly importance: "high" | "medium" | "low";    // NOTE: field is `importance`, not `rank`
  readonly commentary: string;
  readonly tickers: ReadonlyArray<string>;
  readonly tickerNames?: Readonly<Record<string, string>>; // symbol -> company name (D-06: English names)
}

export interface NewsCuration {
  readonly date: string;
  readonly generatedAt: string;
  readonly leadIn: string; // CURA-09 lead paragraph — NOT present in the pre-implementation draft contract
  readonly articles: ReadonlyArray<CuratedArticle>;
}

// src/meeting/schemas.ts (existing, do not modify — Phase 17 only calls these)
export function validateRawNewsCuration(data: unknown): RawNewsCuration; // THROWS on structural violation
export interface NewsArticlePoolEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly ticker?: string;
}
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration; // NEVER throws — drops unknown/duplicate IDs and empty commentary via console.warn

// src/scripts/generate-news-digest.ts (existing, do not modify — Phase 17 only calls this)
export function generateNewsDigestHtml(curation: NewsCuration | null, date: string): string;
```

### Recommended shape for the new `write-news-digest.ts` (illustrative — exact structure is Claude's Discretion per CONTEXT.md)

```typescript
// Source: pattern synthesized from validate-meeting.ts (exit-code CLI convention) +
// report-data-loaders.ts's loadPortfolioAnalysis (graceful-null loader pattern)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRawNewsCuration, resolveNewsCuration } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import { generateNewsDigestHtml } from "./generate-news-digest.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");

export async function main(): Promise<void> {
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const date = (JSON.parse(meetingRaw) as { date: string }).date;
  const dateDir = join(DOCS_DIR, date);
  await mkdir(dateDir, { recursive: true });

  try {
    // tmp/news-curation.json may be ABSENT (Agent failed twice, D-07) — readFile throws ENOENT
    const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8");
    const raw = validateRawNewsCuration(JSON.parse(rawJson)); // MAY throw (structural violation)

    const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>; // extra fields OK, ignored

    const curation = resolveNewsCuration(raw, pool, date, new Date().toISOString()); // never throws
    const html = generateNewsDigestHtml(curation, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.log("news-digest.html generated: " + curation.articles.length + " articles");
    // exit 0 implicitly (success path)
  } catch (error) {
    // D-08: fallback page is written on EVERY failure path, never skipped
    const html = generateNewsDigestHtml(null, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.error("news-digest fallback:", error instanceof Error ? error.message : error);
    process.exit(1); // exit code IS the OK/FAIL signal invest.md reads (D-10)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

### Existing Step 3d Agent-invocation precedent to extend (D-01), verbatim excerpt

```
// Source: /Users/arai/invest/.claude/commands/invest.md, lines 1564-1568 (current, single-Agent form)
**1つの Agent ツールを呼び出してください:**

- name: `portfolio-analyst`
- model: `opus`
- prompt: 以下の内容を含めてください
    ...
```
The parallel-form header this project already uses elsewhere for N=5 (lines 148, 519, 899, 1347) is:
```
**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**
```
For D-01 (N=2), the header becomes `以下2つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:`.

### Existing retry-once-then-skip precedent (D-07), verbatim

```
// Source: invest.md line 1636
出力が有効な JSON でない場合は、エージェントを1回リトライしてください。2回目も失敗した場合は
「警告: ポートフォリオ分析の生成に失敗しました。フォールバック表示で続行します。」とユーザーに
表示して続行してください（portfolio-analysis.json を作成しない）。
```

### `tmp/news.json` pool shape available to the curation Agent (Phase 15 complete)

```typescript
// Source: src/data/news/article-id.ts + src/data/news/types.ts — verified current shape
interface NewsArticleWithId {
  readonly id: string;         // "n01".."n80", assigned by assignArticleIds() in collect-data.ts
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string;        // present in the file, but D-03 says: DO NOT include in the Agent's prompt
  readonly publishedAt: string; // ISO string after JSON round-trip
  readonly category: string;   // NOT one of the D-03 listed fields — omit from the prompt per CONTEXT.md
  readonly ticker?: string;
}
```
D-03's "URL以外の全フィールド" is explicit about exactly 6 fields to embed in the prompt: `id, title, summary, source, publishedAt, ticker` — note `category` is present in the raw file but not in D-03's enumerated list, so it should also be omitted from the prompt text (only `url` is called out by name, but the field list is exhaustive and does not include `category`).

## State of the Art

| Old Approach (pre-implementation draft) | Current Approach (Phase 15/16 actual) | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `.planning/research/ARCHITECTURE.md`'s draft schema: `market: "米国株"\|"日本株"\|"グローバル"`, field `rank: number`, LLM outputs full `url`/`title` | Actual `curatedArticleRawSchema`: `market: "us"\|"japan"\|"global"` (lowercase, English), field `importance: "high"\|"medium"\|"low"` (no numeric rank — sort key derived from this enum), Agent outputs `id` only | Phase 15 planning/implementation (2026-07-02) | Any Phase 17 plan or prompt design that copies field names from `.planning/research/ARCHITECTURE.md`'s illustrative code block instead of the actual `src/meeting/types.ts` will be wrong — always source field names from the current `types.ts`/`schemas.ts`, not the pre-Phase-15 research draft |
| Draft schema had no `leadIn` field | Actual `NewsCuration.leadIn: string` (CURA-09) is required by `resolveNewsCuration`'s signature (`raw.leadIn` is read directly) | Phase 15 implementation | The `news-curator` Agent's prompt (this phase's discretion area) MUST instruct the Agent to emit a top-level `leadIn` string field, or `resolveNewsCuration` will silently default it to `""` (schema has `.optional().default("")`) and CURA-09's lead paragraph will always be empty |
| Draft: hard `z.array(...).min(10).max(15)` | Actual: no array-length constraint in the zod schema at all — soft clamp lives entirely in `resolveNewsCuration` (slice to 15, warn-only under 10) | Phase 15 implementation (deliberate, per Pitfall 3 avoidance) | Confirms this phase's script never needs to handle a zod array-length validation error — `validateRawNewsCuration` cannot throw for count reasons, only for enum/type violations |

**Deprecated/outdated:** Nothing in the live codebase is deprecated by this phase — this table exists solely to flag that the milestone-level `.planning/research/*.md` files (written before Phase 15/16 existed) contain an illustrative contract that has since been superseded by the actual implementation. Always prefer `src/meeting/types.ts`/`src/meeting/schemas.ts`/`src/scripts/generate-news-digest.ts` (read directly) over the earlier research drafts when writing prompts or plans.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact prompt wording for `news-curator` (disambiguation examples for us/japan/global, priority-boost wording for portfolio holdings, English-company-name instruction) is not yet written anywhere in the codebase — this research only confirms the *structural* requirements (D-03–D-06) the prompt must satisfy, not verified prompt text | Code Examples / Architecture Patterns | LOW — this is explicitly listed as Claude's Discretion in CONTEXT.md; the planner/implementer must author this prompt text fresh, following the structural constraints documented here |
| A2 | `write-news-digest.ts`'s exact exit-code-as-signal design (shown in Code Examples) is a recommended pattern synthesized from this codebase's existing conventions (`validate-meeting.ts`'s `process.exit(1)`, `report-data-loaders.ts`'s graceful-null loaders) — it is not itself an existing, tested file | Code Examples | MEDIUM — if the planner chooses a different signal mechanism (e.g., a sentinel value on stdout instead of exit code), the `invest.md` prose for reading OK/FAIL must be written consistently with whatever mechanism is chosen; the two must not diverge |
| A3 | `generatedAt` for `resolveNewsCuration`'s 4th parameter should be computed fresh (`new Date().toISOString()`) inside `write-news-digest.ts` rather than sourced from the Agent's own output — this is consistent with D-02 of Phase 16 (`generate-news-digest.ts` also calls `new Date()` freely for its own "生成日時" display) but was not explicitly re-confirmed as a locked decision in Phase 17's CONTEXT.md | Code Examples | LOW — `NewsCuration.generatedAt` is metadata only, not rendered in a way that requires archival-integrity (unlike `publishedAt`, which Phase 16 explicitly locked to never use `Date.now()`) |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Exact placement of the new Bash block relative to Step 3c's existing "生成結果を確認" confirmation display**
   - What we know: D-10 requires the new CLI script to run "generate-report.ts の後に別コマンドで起動する" and CONTEXT.md's Integration Points note it must be "Step 3c後 or Step 4前: 専用CLI起動... generate-report.ts 実行後、update-index.ts 実行前であること."
   - What's unclear: Whether it belongs textually inside the existing "### Step 3c: HTMLレポート生成" section (after its current `[STEP:report-generation:OK]` echo) or as a new, separate "### Step 3e" heading before "## Step 4."
   - Recommendation: A separate `### Step 3e: ニュースダイジェスト生成` heading is cleaner for STEP-marker clarity (this phase introduces its own `[STEP:news-digest:*]` pair, distinct from `report-generation`) and matches this file's existing convention of one heading per STEP-marker-scoped unit of work. This is a low-risk, discretionary formatting choice for the planner.

2. **Whether `write-news-digest.ts` needs its own `.test.ts` covering the D-08 fallback path end-to-end, or whether existing Phase 15/16 unit tests already provide sufficient coverage**
   - What we know: `resolveNewsCuration`/`validateRawNewsCuration` (17 tests) and `generateNewsDigestHtml` (12+1 tests) are both already unit-tested in isolation. `write-news-digest.ts` itself has zero existing test coverage (it doesn't exist yet).
   - What's unclear: Given this project's TDD convention (per user's global CLAUDE.md instructions and this project's own established pattern of `*.test.ts` for every `src/scripts/*.ts` file), the planner should decide whether `main()`'s file-I/O orchestration (not the already-tested pure functions it calls) needs its own fixture-based test — e.g., using `mock-fs`-style techniques or temp directories to verify "absent `tmp/news-curation.json` → fallback HTML written + exit 1."
   - Recommendation: Given `generate-report.ts` itself has no dedicated `.test.ts` (its `main()` is validated only via manual/end-to-end runs, per the codebase's actual current state — confirmed no `generate-report.test.ts` exists), a similarly light-touch approach (manual `npx tsx` verification of the 3 required scenarios — normal day, malformed JSON, missing file — per Success Criterion #3) is consistent with existing project precedent and is likely sufficient; a plan requiring full fixture-driven unit tests for `main()`'s I/O orchestration would be *exceeding* this codebase's established testing rigor for CLI orchestrator scripts specifically (as opposed to the pure functions they call, which ARE always unit-tested).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `tsx` (via `npx`) | Running the new `write-news-digest.ts` CLI script | ✓ | 4.21.0 [VERIFIED: package.json] | — |
| `vitest` | Any new unit tests for this phase | ✓ | 4.0.18 [VERIFIED: package.json] — confirmed via `npx vitest run`: 179/179 tests passing across 12 files, no `vitest.config.*` file, defaults apply | — |
| `git` | Step 4 deploy (unchanged) | ✓ | Already used successfully by existing Step 4 pipeline | — |
| `node` (via `node -e`) | pipeline-metrics.json timestamp bookkeeping (D-11) | ✓ | Already used extensively throughout `invest.md` | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — this phase introduces no new environment dependencies.

## Validation Architecture

`.planning/config.json`'s `workflow` block has no `nyquist_validation` key — treated as enabled (absent = enabled per protocol).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | none — defaults apply (colocated `*.test.ts`, run via `npm test` = `vitest run`) |
| Quick run command | `npx vitest run src/scripts/write-news-digest.test.ts` (new file, if authored) |
| Full suite command | `npm test` (currently 179/179 passing, 12 files) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURA-01 | `news-digest.html` written to `docs/{date}/` on a normal day | manual/smoke (mirrors `generate-report.ts`'s own untested `main()` precedent) | `npx tsx src/scripts/write-news-digest.ts` against a fixture `tmp/news-curation.json` + `tmp/news.json` + `tmp/meeting-result.json`, then `test -f docs/{date}/news-digest.html` | ❌ Wave 0 (fixtures need to be created or reused from Phase 16's test fixtures) |
| OPS-04 (fail-soft) | Deliberately malformed `tmp/news-curation.json` (or absent) still results in the other 3 reports + deploy succeeding | manual/integration | Run `generate-report.ts` then `write-news-digest.ts` with a corrupted/missing `tmp/news-curation.json`; confirm `daily-report.html`/`meeting-minutes.html`/`portfolio-report.html` are unaffected and `write-news-digest.ts` still writes a fallback `news-digest.html` and exits 1 | ❌ Wave 0 |
| OPS-04 (STEP marker) | `[STEP:news-digest:OK]` on success, `[STEP:news-digest:FAIL:...]` on failure | manual (requires running the actual `/invest` skill or simulating its Bash blocks) | Not automatable via vitest alone (STEP markers are emitted by `invest.md`'s Bash `echo`, not by TS code) — verify via a scoped manual replay of the Step 3d→3e Bash sequence, or full `/invest` dry run | N/A — orchestration-level, not unit-testable |

### Sampling Rate
- **Per task commit:** `npx vitest run` (fast, whole suite is <1s per this research's own run)
- **Per wave merge:** `npm test` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus at least one manual `npx tsx src/scripts/write-news-digest.ts` smoke run against both a valid and an absent/malformed `tmp/news-curation.json` fixture (Success Criterion #3 cannot be fully verified by `vitest` alone — it requires observing file-write behavior for the other 3 reports too, which is inherently an integration-level check)

### Wave 0 Gaps
- [ ] Decide whether `write-news-digest.ts` gets a `.test.ts` (Open Question 2) — if yes, fixture JSON for `tmp/news-curation.json`/`tmp/news.json`/`tmp/meeting-result.json` needs to be authored (can likely reuse/adapt fixtures already present in `src/meeting/schemas.test.ts` and `src/scripts/generate-news-digest.test.ts`)
- [ ] No new test framework installation needed — vitest is already fully configured and green

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treated as enabled (absent = enabled per protocol).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface — single-user local batch pipeline |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | `validateRawNewsCuration()` (zod, Phase 15, already built) is the input-validation boundary for the untrusted LLM output this phase wires in — this phase must not bypass it or hand-roll a parallel validation path |
| V6 Cryptography | No | N/A |
| V12 (File/Resource, ASVS 4.0 numbering may vary) — path handling | Yes | `write-news-digest.ts` derives `dateDir` from `meetingResult.date`, which is only used as a path segment (`join(DOCS_DIR, date)`), never shell-interpolated — this phase does not introduce any new shell/date-injection surface beyond what Step 4's existing regex-validated `date` already covers for `git commit`; `write-news-digest.ts` itself performs no shell execution, so the `^\d{4}-\d{2}-\d{2}$` guard used in Step 4 is not strictly required inside this script, but path-joining an unvalidated string from JSON is still worth a defensive check if the planner wants defense-in-depth |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM-controlled HTML injection via curated article commentary/title/href | Tampering | Already fully mitigated in Phase 16's `generateNewsDigestHtml()` (`escapeHtml()` on every interpolation site including `href`, `safeHref()` http(s)-only scheme allowlist) — this phase must not bypass this by, e.g., string-concatenating any curation field directly into a file path or shell command |
| Hallucinated/mismatched article URLs | Tampering / Spoofing | Already fully mitigated by the ID-reference design (Phase 15's `resolveNewsCuration` never trusts LLM-echoed URLs) — this phase's script must pass the *raw* Agent JSON through `validateRawNewsCuration`/`resolveNewsCuration` unmodified, never construct its own lookup shortcut |
| Path traversal via `date` string used in `join(DOCS_DIR, date)` | Tampering | `date` originates from `tmp/meeting-result.json`, itself validated by `validateMeetingResult` (existing, Phase <17) elsewhere in the pipeline before Step 3d/3e ever runs — trust boundary already established upstream; this phase's script should still avoid re-deriving `date` from any less-trusted source (e.g., never read `date` from `tmp/news-curation.json` itself, which is LLM-authored) |

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `/Users/arai/invest/src/meeting/types.ts` (lines 100-145), `/Users/arai/invest/src/meeting/schemas.ts` (lines 190-292) — actual, current `NewsCuration`/`CuratedArticle`/`validateRawNewsCuration`/`resolveNewsCuration`/`NewsArticlePoolEntry` contract (Phase 15 deliverable)
- Direct codebase read: `/Users/arai/invest/src/scripts/generate-news-digest.ts` (full file, 148 lines) — actual, current `generateNewsDigestHtml()` implementation (Phase 16 deliverable)
- Direct codebase read: `/Users/arai/invest/.claude/commands/invest.md` (Step 3d lines 1542-1650, Step 3c lines 1654-1721, Step 4 lines 1725-1832, pipeline completion lines 1836-1899) — exact current Agent invocation, retry, STEP marker, and pipeline-metrics conventions
- Direct codebase read: `/Users/arai/invest/scripts/run.sh` (full file, 84 lines) — verified EXIT_CODE-gated notification logic, confirming D-09's design is sound
- Direct codebase read: `/Users/arai/invest/src/scripts/generate-report.ts`, `report-data-loaders.ts`, `validate-meeting.ts`, `collect-data.ts` (lines 1-70), `/Users/arai/invest/src/data/news/article-id.ts`, `/Users/arai/invest/src/data/news/types.ts` — existing patterns this phase's new script must mirror
- `/Users/arai/invest/package.json` — confirmed zod ^4.3.6, tsx ^4.21.0, vitest ^4.0.18, no new dependencies needed
- `npx vitest run` executed directly during this research session — 179/179 tests passing, confirming baseline is green before this phase begins
- `.planning/phases/15-curation-contract-schema/15-01-SUMMARY.md`, `15-02-SUMMARY.md`, `.planning/phases/16-report-generator-html-rendering/16-01-SUMMARY.md`, `16-02-SUMMARY.md`, `16-03-SUMMARY.md` — completed-phase summaries documenting exact deviations from the earlier research draft
- `.planning/phases/17-pipeline-integration-orchestration/17-CONTEXT.md` — locked decisions (D-01–D-11), canonical references, code context

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` — pre-Phase-15/16 milestone-level research; still valid for architectural *shape* (single-purpose Agent step, process-boundary isolation, fail-soft STEP markers) but its illustrative code/schema examples are superseded by the actual Phase 15/16 implementation (see State of the Art section) — treat its prose recommendations as HIGH confidence, its code samples as MEDIUM/superseded

### Tertiary (LOW confidence)
None used for this phase's research — all findings are grounded in direct codebase inspection or completed-phase summaries, not external/web sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions confirmed via `package.json` and a live `npx vitest run`
- Architecture: HIGH — entirely grounded in direct reading of the actual, current `invest.md`, `run.sh`, `schemas.ts`, `generate-news-digest.ts` (not the pre-implementation draft)
- Pitfalls: HIGH — the `run.sh` EXIT_CODE-gating finding was independently verified by reading the actual bash logic line-by-line, not inferred

**Research date:** 2026-07-02
**Valid until:** 30 days (stable, in-repo codebase; no external API/library surface that could drift)
