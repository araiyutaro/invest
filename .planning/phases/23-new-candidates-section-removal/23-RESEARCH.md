# Phase 23: New-Candidates Section Removal - Research

**Researched:** 2026-07-04
**Domain:** TypeScript HTML report generator refactor (dead-code removal, targeted vitest test inversion)
**Confidence:** HIGH

## Summary

This is a small, low-risk removal phase. `formatNewCandidatesHtml()` in
`src/scripts/generate-portfolio-report.ts` is a **module-private** function (not exported,
no other file imports it) that renders a "新規組入候補（Daily Report より転載）" table from
`result.highlightedStocks`. It is called exactly twice (once per render path — normal and
fallback) and its output is interpolated into both HTML templates. Removing the function and
its two call sites is mechanically straightforward; the two `import`s it uniquely required
(`scoreColor`, `verdictColor`) become dead and must be dropped from the import line, but the
underlying functions in `report-utils.ts` stay untouched because `generate-daily-report.ts`
still uses them for its own (unrelated) scoring matrix.

All touch points were verified directly in the codebase (not inferred): the function body
(lines 102-133), both call-site interpolations (lines 143, 161, 186), the import line (line 1),
the two vitest tests that must be inverted/extended (Test 30, Test 31), and the exact
`highlightedStocks` prompt line in `invest.md` (line 1746) that must remain untouched. No other
files reference `formatNewCandidatesHtml`, and no type/schema definition needs to change —
`highlightedStocks` stays in `MeetingResult` (types.ts:55) and its zod schema (schemas.ts:69)
exactly as-is, because Success Criteria 2 only requires the *rendering* of the section to
disappear, not the data itself (which portfolio-analyst still needs as prompt context).

**Primary recommendation:** Delete `formatNewCandidatesHtml()` entirely, remove its two call
sites and the `newCandidatesHtml` interpolations, prune the now-unused `scoreColor`/`verdictColor`
imports from `generate-portfolio-report.ts` only, invert Test 30 to a non-existence assertion
using the existing non-empty `validMeetingResult.highlightedStocks` fixture (PLTR/8.2), extend
Test 31 (or add a sibling test) with the same non-existence assertion for the fallback path, and
verify via grep that `invest.md:1746` and the `MeetingResult`/schema definitions are unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portfolio report HTML rendering | Report Generator (TS, `src/scripts/`) | — | Pure function `generatePortfolioReportHtml`, no I/O, consumes `MeetingResult` + `PortfolioAnalysis` |
| `highlightedStocks` data supply | Meeting pipeline (`src/meeting/types.ts`/`schemas.ts`) | — | Untouched by this phase — data continues to flow from meeting orchestration into `MeetingResult` |
| `highlightedStocks` prompt context for portfolio-analyst | Orchestration prompt (`.claude/commands/invest.md` Step 3d) | — | Read-only adjacent area; the LLM prompt still receives this array as context, unrelated to HTML rendering |
| Daily Report scoring matrix (uses `scoreColor`/`verdictColor`) | Report Generator (`generate-daily-report.ts`) | `report-utils.ts` (shared color helpers) | Different report, different responsibility — must not be affected by this removal |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `formatNewCandidatesHtml()` は関数ごと完全削除する（呼び出しのみ除去して dead code を残す案は不採用 — コーディング規約のデッドコード禁止、および将来の誤再配線防止）
- **D-02:** 削除で未使用になる import（`scoreColor` / `verdictColor` — generate-portfolio-report.ts 内では formatNewCandidatesHtml のみが使用）を import 文から除去する。`report-utils.ts` 側の関数本体は削除しない（generate-daily-report.ts が引き続き使用）
- **D-03:** `generatePortfolioReportHtml(result: MeetingResult, ...)` のシグネチャは変更しない — `result.date` がタイトル・見出しで引き続き必要であり、呼び出し側（generate-report.ts）への波及を避ける
- **D-04:** フォールバックパス（portfolioAnalysis === null）は既存メッセージ「本日のポートフォリオ分析は生成されませんでした。」のみとし、代替コンテンツは追加しない — 要件外の追加をしない（UI-08 は削除のみを要求）
- **D-05:** 既存 Test 30「HTML に highlightedStocks の新規組入候補セクションが含まれる」は非存在検証へ反転する: 通常パス（validPortfolioAnalysis 有り）で `expect(html).not.toContain("新規組入候補")` を検証。highlightedStocks に PLTR を含む validMeetingResult を渡した上で非表示を確認する（空配列での擬似合格を防ぐ）
- **D-06:** フォールバックパス（null）でも `not.toContain("新規組入候補")` を検証するテストを追加（既存 Test 31 への追記 or 新規テスト、planner の裁量）。ROADMAP Success Criteria 1 の「両パスで存在しない」と1対1対応させる
- **D-07:** Daily Report 側のテスト（Test 4: generateHtml の highlightedStocks 表示）は変更しない — Daily Report のスコアリングマトリクスは維持対象
- **D-08:** `.claude/commands/invest.md` Step 3d の portfolio-analyst プロンプト「## 本日のミーティング結果」内の「注目銘柄: [highlightedStocks 配列の全内容]」（1746行目付近）は一切変更しない。REQUIREMENTS.md の除外事項「再評価フロー内での新規組入候補の提案」にも触れない（提案機能を足すのではなく、文脈情報の受け渡しを保つだけ）
- **D-09:** フェーズ検証で「invest.md Step 3d に highlightedStocks の受け渡しが残存していること」を grep で確認する（削除作業の巻き込み事故防止）。`MeetingResult.highlightedStocks` 型・スキーマ（types.ts / schemas.ts）も無変更であること

### Claude's Discretion

- 反転テストの配置（Test 30 の番号を維持して書き換えるか、番号体系を整理するか — 既存テストファイルの流儀に従う）
- フォールバックパステストの実装形（Test 31 拡張 vs 新規テスト）
- コミット分割（削除+テスト反転を1コミットにするか、TDD で反転テスト先行にするか — TDD 規約優先）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope（削除のみの小規模フェーズであり、新規アイデアは発生せず）

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-08 | ポートフォリオレポートから「新規組入候補（Daily Report より転載）」セクションが削除される（成功パス・フォールバックパスの両方の呼び出し箇所。portfolio-analyst への文脈情報としての highlightedStocks は維持） | Exact code locations verified below (function body, call sites, import line); test inversion plan mapped to Test 30/31; invest.md:1746 verified as the sole highlightedStocks prompt-context line to preserve; types.ts:55 / schemas.ts:69 verified untouched |

## Project Constraints (from CLAUDE.md)

- GSD コマンドは常にハイフン (`-`) を使用すること。コロン (`:`) は使用しない（本フェーズのタスク記述・コミットメッセージ内で GSD コマンドに言及する場合に適用。実装作業自体には直接関係しないが、planner のタスク文言確認の対象）。

## Standard Stack

No new dependencies are introduced by this phase. It is a pure removal + test-inversion task
within the existing stack.

### Core (existing, unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 [VERIFIED: package.json] | Test runner for `generate-report.test.ts` | Already the project's sole test framework; `npm run test` = `vitest run` |
| TypeScript | strict mode [VERIFIED: tsconfig.json] | Report generator source | `strict: true`; `noUnusedLocals`/`noUnusedParameters` NOT set, so an unused import would NOT fail `tsc` build — removal is a code-quality/lint concern (CLAUDE.md dead-code rule), not a compiler-enforced one |

No installation step required — no packages added or removed.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
MeetingResult (tmp/meeting-result.json)
        │
        │  { date, highlightedStocks, ... }
        ▼
generate-report.ts
        │
        │  generatePortfolioReportHtml(result, portfolioAnalysis, resolvedHoldingNews)
        ▼
generate-portfolio-report.ts
        │
        ├─ portfolioAnalysis === null ──► fallback HTML
        │                                   (message only, NO newCandidatesHtml after this phase)
        │
        └─ portfolioAnalysis !== null ──► normal HTML
                                            (overallComment + holdings + rebalance,
                                             NO newCandidatesHtml after this phase)

[separately, unaffected by this phase]
.claude/commands/invest.md Step 3d
        │
        │  prompt text: "注目銘柄: [highlightedStocks 配列の全内容]"
        ▼
portfolio-analyst (LLM agent) — receives highlightedStocks as CONTEXT ONLY,
                                  does not render or propose new candidates
```

Both HTML render branches currently call `formatNewCandidatesHtml(result)` once at the top of
`generatePortfolioReportHtml` (line 143) and interpolate the same `newCandidatesHtml` string into
both templates (lines 161 and 186). After removal, both interpolation points and the shared
variable disappear; no replacement content is added (per D-04).

### Recommended Project Structure

No structural changes — single-file edit within existing `src/scripts/` layout.

### Pattern 1: Pure-function renderer + colocated vitest suite
**What:** `generatePortfolioReportHtml` and its private helper functions (`formatOverallCommentHtml`,
`formatHoldingEvaluationsHtml`, etc.) are pure functions with no I/O; all tests live in the single
`generate-report.test.ts` file, organized by `describe("Portfolio Report", ...)` block with
sequentially numbered `it("Test N: ...")` cases.
**When to use:** Continue this pattern for the test inversion — do not extract to a new test file.
**Example:**
```typescript
// Source: src/scripts/generate-report.test.ts (existing pattern, Test 26-29)
it("Test 26: generatePortfolioReportHtml が portfolioAnalysis を受け取り保有銘柄の decision を含む HTML を返す", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
  expect(html).toContain("保持");
});
```

### Anti-Patterns to Avoid
- **Leaving the call site but making the function return `""` unconditionally:** This would satisfy
  the "not.toContain" test but violates D-01 (full function deletion required) and leaves dead code
  that could be silently re-wired later.
- **Testing non-existence with an empty `highlightedStocks` array:** A pre-removal build with
  `formatNewCandidatesHtml` intact ALSO returns `""` when `highlightedStocks.length === 0` (see
  line 103 early return). Testing with an empty array would pass even against the *old* code,
  producing a false-positive/pseudo-passing test. D-05 explicitly requires using the existing
  non-empty `validMeetingResult.highlightedStocks` (PLTR/8.2) fixture to make the test
  discriminating.
- **Removing `scoreColor`/`verdictColor` from `report-utils.ts`:** These functions are still used
  by `generate-daily-report.ts` (verified: lines 30, 72, 80, 81, 143, 144). Only the *import* in
  `generate-portfolio-report.ts` should be pruned, not the function definitions.

## Don't Hand-Roll

Not applicable — this phase removes code, it does not introduce new logic requiring a
library/pattern decision.

## Common Pitfalls

### Pitfall 1: Pseudo-passing inverted test via empty-array input
**What goes wrong:** Writing `expect(html).not.toContain("新規組入候補")` using a `MeetingResult`
whose `highlightedStocks` is empty. This assertion passes even on the *pre-removal* code (because
`formatNewCandidatesHtml` early-returns `""` for an empty array at line 103), so the test provides
zero regression protection.
**Why it happens:** Easy to reach for a minimal/empty fixture when writing a "does not contain"
assertion, since fixtures are often trimmed down for negative tests.
**How to avoid:** Reuse the existing `validMeetingResult` fixture (already has one entry: PLTR,
averageScore 8.2, verdict 強気, agentScores from ファンダメンタルズ/テンバガーハンター) for both the
normal-path and fallback-path inverted tests. This is the exact input that previously produced the
section (Test 30 originally asserted `toContain("PLTR")` and `toContain("8.2")` — reusing the same
fixture makes the inversion a true regression test.
**Warning signs:** If the new test still passes when you temporarily revert the deletion (sanity
check), the test is not discriminating.

### Pitfall 2: Accidentally deleting/altering `report-utils.ts` function bodies
**What goes wrong:** Since `scoreColor`/`verdictColor` become unused in `generate-portfolio-report.ts`,
a hasty refactor might also touch `report-utils.ts` where they're defined, breaking
`generate-daily-report.ts` which depends on them for its own scoring matrix (verified 6 usages).
**Why it happens:** "Remove unused" tooling/IDE quick-fixes sometimes offer to delete the
underlying declaration, not just the import reference.
**How to avoid:** Only edit line 1 (the import statement) of `generate-portfolio-report.ts`. Do not
touch `report-utils.ts` at all in this phase.
**Warning signs:** `generate-daily-report.test.ts` (Test 4 and others) failing after the change would
indicate this mistake — Test 4 must remain green and untouched (D-07).

### Pitfall 3: Accidentally editing invest.md's highlightedStocks prompt-context line
**What goes wrong:** Searching/replacing "新規組入候補" or "highlightedStocks" broadly across the repo
could touch `.claude/commands/invest.md:1746` ("注目銘柄: [highlightedStocks 配列の全内容]"), which is
explicitly required to remain (Success Criteria 2 / D-08). Note: the literal string
"新規組入候補" does NOT appear in invest.md at all (verified via grep) — only "highlightedStocks"
appears there, multiple times (lines 101-103, 1096-1097, 1118, 1202-1206, 1263, 1269, 1406, 1424,
1426, 1746, 1958). None of these should be touched by this phase; they are unrelated to the HTML
rendering removal.
**Why it happens:** A broad find-and-replace on "highlightedStocks" without scoping to the specific
TS file/lines could sweep in unrelated prompt text.
**How to avoid:** Scope all edits strictly to `src/scripts/generate-portfolio-report.ts` and
`src/scripts/generate-report.test.ts`. Do not run repo-wide replace operations for this phase.
**Warning signs:** `git diff .claude/commands/invest.md` showing any changes at all — should be
empty for this phase.

### Pitfall 4: Missing the fallback-path test (Success Criteria 1 requires BOTH paths)
**What goes wrong:** Only inverting Test 30 (normal path) and forgetting the fallback path
(`portfolioAnalysis === null`), even though `formatNewCandidatesHtml(result)` is also called and
interpolated at line 161 in the fallback branch.
**Why it happens:** Test 31 already exists for the fallback path but currently only asserts
`toContain("<!DOCTYPE html>")`, `toContain("Portfolio Report")`, and `not.toContain("保有銘柄 個別評価")`
— it does not currently assert anything about "新規組入候補", so it's easy to overlook that this path
also needs coverage.
**How to avoid:** Per D-06, either extend Test 31 with an additional `expect(html).not.toContain("新規組入候補")`
assertion (using `validMeetingResult` which has non-empty `highlightedStocks`, same rationale as
Pitfall 1) or add a new sibling test explicitly for this. Map 1:1 to ROADMAP Success Criteria 1's
"通常パス・フォールバックパスの両方" wording.

## Code Examples

### Current code to be removed (verified exact text)
```typescript
// Source: src/scripts/generate-portfolio-report.ts, lines 102-133 (DELETE entire function)
function formatNewCandidatesHtml(result: MeetingResult): string {
  if (result.highlightedStocks.length === 0) return "";

  const rows = result.highlightedStocks.map((s) => {
    const agentCells = s.agentScores
      .map((a) => `<td style="text-align:center;color:${scoreColor(a.score)}"><strong>${a.score}</strong><br><span style="font-size:0.75rem;color:#888;">${escapeHtml(a.reason)}</span></td>`)
      .join("");

    return `<tr>
      <td><strong>${escapeHtml(s.ticker)}</strong><br><span style="font-size:0.8rem;color:#888;">${escapeHtml(s.summary)}</span></td>
      ${agentCells}
      <td style="text-align:center;"><strong style="color:${scoreColor(s.averageScore)}">${s.averageScore}</strong></td>
      <td style="text-align:center;"><span style="color:${verdictColor(s.verdict)};font-weight:bold;">${escapeHtml(s.verdict)}</span></td>
    </tr>`;
  }).join("\n");

  const agentHeaders = result.highlightedStocks[0]?.agentScores
    .map((a) => `<td style="text-align:center;font-size:0.8rem;">${escapeHtml(a.agentRole)}</td>`)
    .join("") ?? "";

  return `<h2>新規組入候補（Daily Report より転載）</h2>
    <p>Daily Reportのアナリストミーティングで推奨された銘柄です。スコアリングマトリクスを参考に投資判断してください。</p>
    <table>
      <tr>
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;">銘柄</td>
        ${agentHeaders.replace(/(<td)/g, '$1 style="background:#2a2a3e;font-weight:bold;color:#93c5fd;"')}
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;text-align:center;">平均</td>
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;text-align:center;">判定</td>
      </tr>
      ${rows}
    </table>`;
}
```

### Call sites to remove (verified exact lines)
```typescript
// Line 143 — DELETE this line entirely
const newCandidatesHtml = formatNewCandidatesHtml(result);

// Line 161 — inside fallback branch template, DELETE this interpolation line
    ${newCandidatesHtml}

// Line 186 — inside normal branch template, DELETE this interpolation line
    ${newCandidatesHtml}
```

### Import line to edit (verified exact line 1)
```typescript
// BEFORE:
import { escapeHtml, scoreColor, verdictColor, generateBaseStyles, safeHref, formatPublishedAtJst } from "./report-utils.js";

// AFTER (scoreColor, verdictColor removed — both were used ONLY by formatNewCandidatesHtml in this file):
import { escapeHtml, generateBaseStyles, safeHref, formatPublishedAtJst } from "./report-utils.js";
```

### Test inversion pattern (Test 30, existing text to replace)
```typescript
// Source: src/scripts/generate-report.test.ts, lines 360-366 (CURRENT — asserts existence)
it("Test 30: HTML に highlightedStocks の新規組入候補セクションが含まれる (PORT-01)", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
  expect(html).toContain("新規組入候補");
  expect(html).toContain("PLTR");
  expect(html).toContain("8.2");
});
```
Recommended inversion (exact numbering/renaming is Claude's discretion per CONTEXT.md):
```typescript
it("Test 30: HTML に新規組入候補セクションが含まれない (UI-08、通常パス)", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
  // validMeetingResult.highlightedStocks は非空（PLTR/8.2）— 擬似合格を防ぐ (D-05)
  expect(html).not.toContain("新規組入候補");
  expect(html).not.toContain("Daily Reportのアナリストミーティングで推奨された銘柄です");
});
```

### Fallback-path test extension (Test 31, existing text)
```typescript
// Source: src/scripts/generate-report.test.ts, lines 368-374 (CURRENT)
it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, null);
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("Portfolio Report");
  expect(html).not.toContain("保有銘柄 個別評価");
});
```
Recommended extension (add assertion, per D-06):
```typescript
  expect(html).not.toContain("新規組入候補"); // UI-08: フォールバックパスでも非表示 (D-06)
```

## State of the Art

Not applicable — no external library/framework version changes involved in this phase.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase in the sense of renamed
identifiers with runtime state (no database keys, service configs, OS registrations, secrets, or
build artifacts reference "新規組入候補" or `formatNewCandidatesHtml`). This is a pure code-removal
phase confined to two source files.

## Assumptions Log

No `[ASSUMED]` claims were made in this research — every claim was verified directly via `Read`/`grep`
against the actual source files (`generate-portfolio-report.ts`, `generate-report.test.ts`,
`invest.md`, `types.ts`, `schemas.ts`, `report-utils.ts`, `generate-daily-report.ts`, `tsconfig.json`,
`package.json`) in this session.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | — |

**This table is empty:** All claims in this research were verified directly in the codebase — no
user confirmation needed.

## Open Questions

None. All code locations, test locations, and the invest.md preservation point were directly
verified in this session. The only remaining choices (test numbering scheme, commit split) are
explicitly delegated to Claude's discretion in CONTEXT.md.

## Environment Availability

Skipped — this phase has no external tool/service dependencies beyond the existing Node/TypeScript/
vitest toolchain already in use throughout the project (no new installs, no network calls, no
external services).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | none — vitest run via `npm run test` script (no `vitest.config.ts` found in project root) |
| Quick run command | `npx vitest run src/scripts/generate-report.test.ts -t "Portfolio Report"` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-08 (normal path) | 「新規組入候補」セクションが通常パスのHTMLに含まれない（highlightedStocks 非空でも） | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 30"` | Yes — existing Test 30, requires inversion |
| UI-08 (fallback path) | 「新規組入候補」セクションがフォールバックパスのHTMLに含まれない | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 31"` | Yes — existing Test 31, requires extension |
| UI-08 (highlightedStocks preserved as prompt context) | invest.md:1746 の「注目銘柄: [highlightedStocks 配列の全内容]」が無変更 | static/grep (not a vitest test — this is a prompt file, not code under test) | `grep -n "highlightedStocks 配列の全内容" .claude/commands/invest.md` | N/A — verification is a grep check, not automated test |
| UI-08 (types/schema unchanged) | `MeetingResult.highlightedStocks` 型・zod スキーマが無変更 | static/diff | `git diff --stat src/meeting/types.ts src/meeting/schemas.ts` (expect empty) | N/A — verification is a diff check |

### Sampling Rate
- **Per task commit:** `npx vitest run src/scripts/generate-report.test.ts` (scoped to the modified test file, ~1s)
- **Per wave merge:** `npm run test` (full suite — confirms Daily Report/Meeting Minutes tests untouched, especially Test 4 per D-07)
- **Phase gate:** Full suite green, plus the two grep/diff static checks above (invest.md:1746 preserved, types.ts/schemas.ts unchanged) before `/gsd-verify-work`

### Wave 0 Gaps
None — existing test infrastructure (`generate-report.test.ts`, `validMeetingResult`/`validPortfolioAnalysis` fixtures) fully covers both required test cases (Test 30 inversion, Test 31 extension). No new test files, fixtures, or framework installs needed.

## Security Domain

Not applicable to this phase's scope. This is a pure HTML-string-generation removal with no user
input, no authentication/session/access-control surface, no cryptography, and no new external
data ingestion. The ASVS categories (V2 Authentication, V3 Session Management, V4 Access Control,
V5 Input Validation, V6 Cryptography) do not apply — no new attack surface is introduced or
modified. `escapeHtml` usage patterns already in place for other fields are unaffected (this phase
removes an escapeHtml-consuming code path, it does not add one).

## Sources

### Primary (HIGH confidence — verified directly in this session)
- `src/scripts/generate-portfolio-report.ts` (full file read) — function body, call sites, import line
- `src/scripts/generate-report.test.ts` (lines 1-60, 323-392) — fixture `validMeetingResult`, Test 25-34
- `.claude/commands/invest.md` (lines 1730-1759, plus grep for all `highlightedStocks` occurrences) — prompt-context preservation point
- `src/meeting/types.ts` (lines 50-80) — `MeetingResult.highlightedStocks` type definition
- `src/meeting/schemas.ts` (lines 60-90) — zod schema for `highlightedStocks`
- `src/scripts/report-utils.ts` + `src/scripts/generate-daily-report.ts` (grep) — confirmed `scoreColor`/`verdictColor` still used elsewhere
- `tsconfig.json`, `package.json` — confirmed strict mode without `noUnusedLocals`, vitest ^4.0.18, no dedicated vitest.config.ts
- `.planning/phases/23-new-candidates-section-removal/23-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — upstream decisions and project state

### Secondary (MEDIUM confidence)
None required for this phase.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing vitest/TypeScript versions confirmed directly from package.json/tsconfig.json
- Architecture: HIGH — all code locations (function, call sites, import) read and verified verbatim against the actual file, not inferred
- Pitfalls: HIGH — each pitfall is grounded in an actual verified code behavior (e.g., the early-return-on-empty-array behavior at line 103) rather than generic advice

**Research date:** 2026-07-04
**Valid until:** Effectively indefinite for this specific removal task (the code will either be
removed per this research or the phase is complete) — if re-used, treat as stale after any further
edits to `generate-portfolio-report.ts` or `generate-report.test.ts` land from other phases.
