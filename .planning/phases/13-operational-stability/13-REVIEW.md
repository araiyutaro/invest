---
phase: 13-operational-stability
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - .claude/commands/invest.md
  - scripts/run.sh
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-01
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files were reviewed: the `scripts/run.sh` shell wrapper (which adds HTML checksum protection) and `.claude/commands/invest.md` (which adds `[STEP:*]` pipeline observability markers). The HTML protection logic is conceptually sound but contains a critical correctness bug in exit-code capture that silently discards failure signals. The step marker system adds useful observability but has coverage gaps and a misordered step identifier that could confuse future maintainers or log parsers.

---

## Critical Issues

### CR-01: EXIT_CODE is always 0 — pipeline failures are silently treated as success

**File:** `scripts/run.sh:39-41`

**Issue:** The `|| true` idiom on line 39 is used to suppress `set -e` early-exit on `claude` failure, but it defeats the immediately following `${PIPESTATUS[0]:-$?}` capture on line 41. In bash, `PIPESTATUS` only tracks pipe (`|`) pipelines. After a list expression (`cmd || true`), `PIPESTATUS[0]` holds the exit status of the compound list, which is always `0` because `true` always succeeds. Consequently `EXIT_CODE` is always `0`: the failure branch (`terminal-notifier ... -sound Basso`) is unreachable, the log always records `exit: 0`, and `exit $EXIT_CODE` exits the script with 0 regardless of what the inner `claude` process returned. A dead pipeline is indistinguishable from a successful one.

**Fix:** Replace the `|| true` pattern with `set +e` bracketing so `$?` is captured before being reset:

```bash
# Before (broken):
claude --dangerously-skip-permissions \
  -p "/invest" \
  --model claude-sonnet-4-6 \
  --max-turns 200 \
  >> "$LOG_FILE" 2>&1 || true

EXIT_CODE=${PIPESTATUS[0]:-$?}

# After (correct):
EXIT_CODE=0
claude --dangerously-skip-permissions \
  -p "/invest" \
  --model claude-sonnet-4-6 \
  --max-turns 200 \
  >> "$LOG_FILE" 2>&1 || EXIT_CODE=$?
```

With `cmd || EXIT_CODE=$?`, if `cmd` fails, the right-hand side executes and `$?` in that context is `cmd`'s exit code. If `cmd` succeeds, `EXIT_CODE` stays `0`. This is exempt from `set -e` (commands in `||` lists are exempt), so no `set +e` is needed.

---

## Warnings

### WR-01: grep uses regex matching against paths — fragile checksum lookup

**File:** `scripts/run.sh:48`

**Issue:** `grep "$PROJECT_DIR/$f" "$CHECKSUM_FILE"` interprets the path as a regular expression. Any `.` in the directory path (e.g., a username like `arai.lab`) would match any character, meaning the wrong checksum line could be selected. While `/Users/arai/invest` happens to contain no ambiguous metacharacters today, this is an accidental safety — the code is structurally wrong.

**Fix:** Use `grep -F` (fixed string) for literal path matching:

```bash
EXPECTED=$(grep -F "$PROJECT_DIR/$f" "$CHECKSUM_FILE" | awk '{print $1}')
```

---

### WR-02: Step 3c and Step 3d identifiers are out of document order

**File:** `.claude/commands/invest.md:1542,1643`

**Issue:** `### Step 3d: ポートフォリオ分析` appears at line 1542, while `### Step 3c: HTMLレポート生成` appears at line 1643 — `3d` precedes `3c` in the document. The pipeline summary at line 1823 and the timing display both refer to these steps, but a reader following the document sequentially will encounter them out of alphabetical and logical order. Any automated step parser keying on the section header numbering (3c vs 3d) would also misread the execution sequence.

**Fix:** Renumber the sections so they match document order. If Portfolio Analysis (currently `3d`) executes before HTML generation (currently `3c`), relabel them `3c` and `3d` respectively, or restructure the document to match the intended execution order.

---

### WR-03: Unquoted PROTECT_FILES variable in for loops — susceptible to glob expansion

**File:** `scripts/run.sh:29,46`

**Issue:** `PROTECT_FILES="docs/index.html docs/portfolio.html"` is a space-separated string. `for f in $PROTECT_FILES` is unquoted, so bash performs word-splitting and glob expansion. If either path contained a glob character (`*`, `?`, `[`) or a space, the loop would iterate over unexpected values and could silently protect the wrong files or none at all.

**Fix:** Use a bash array to hold the file list:

```bash
PROTECT_FILES=("docs/index.html" "docs/portfolio.html")
for f in "${PROTECT_FILES[@]}"; do
  ...
done
```

---

### WR-04: STEP markers absent for Steps 3a, 3b, and 3d — blind spots in observability coverage

**File:** `.claude/commands/invest.md:1269,1333,1542`

**Issue:** Phase 13 adds `[STEP:*:START/OK/FAIL]` markers to Steps 1, Round-1, Round-2, Round-3, report-generation, and deploy. However, three substeps of Step 3 receive no markers at all:
- Step 3a (WebSearch Research, line 1269): no START/OK/FAIL markers
- Step 3b (Re-evaluation Round, line 1333): no markers
- Step 3d (Portfolio Analysis, line 1542): no markers

If `run.sh` or a monitoring tool ever parses `[STEP:*]` markers from the log to detect failures, these steps will be invisible. A hang or silent failure in WebSearch or portfolio analysis produces no marker signal.

**Fix:** Add matching START/OK markers (and FAIL markers where the step can be aborted) to these three substeps, consistent with the pattern used in Steps 1, 2, and the rest of Step 3.

---

### WR-05: AI-generated `date` string interpolated unsanitized into execSync shell command

**File:** `.claude/commands/invest.md:1766`

**Issue:** The deploy step constructs a shell command via string concatenation:

```javascript
execSync('git commit -m "report: ' + date + ' daily update"', { stdio: 'inherit' });
```

The `date` value is read from `tmp/meeting-result.json`, which is written by the `moderator-final` AI agent. `execSync` with a single string argument passes the string to the system shell (`/bin/sh -c`). If the agent produces a `date` value containing a double-quote or semicolon (e.g., `2026-07-01"; malicious-cmd #`), the shell would execute unintended commands. While the expected format is `YYYY-MM-DD`, there is no validation of this before the `execSync` call.

**Fix:** Validate the date format before using it, or pass the commit message as an argument array (which bypasses shell interpretation):

```javascript
// Validate format first
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error(`Invalid date format in meeting-result.json: ${date}`);
}
execSync('git commit -m "report: ' + date + ' daily update"', { stdio: 'inherit' });
```

Or, safer — use the array form to avoid shell interpretation entirely (requires Node 12.5+ and is not directly available via `execSync` without `spawn`):

```javascript
const { spawnSync } = require('child_process');
spawnSync('git', ['commit', '-m', `report: ${date} daily update`], { stdio: 'inherit' });
```

---

## Info

### IN-01: Hardcoded absolute paths tied to a specific machine account

**File:** `.claude/commands/invest.md` (throughout)

**Issue:** The command file embeds `/Users/arai/invest/` as an absolute path in dozens of places (Bash blocks, `node -e` scripts, Read instructions). If the project is moved, the machine changes, or the user account changes, every occurrence must be updated manually. This is a fragility that pre-dates Phase 13 but is worth tracking.

**Fix:** Use a variable or a convention where paths are derived from the script's location. For the shell portions this would mean using `$PROJECT_DIR`; for the embedded Node.js one-liners it could use `process.cwd()` (since the command runs from `$PROJECT_DIR`).

---

### IN-02: Checksum file stored in world-readable /tmp with predictable name prefix

**File:** `scripts/run.sh:28`

**Issue:** `CHECKSUM_FILE="/tmp/invest-html-checksums-${TIMESTAMP}.txt"` — the `/tmp` directory is world-readable on macOS. An attacker or another process with filesystem access could read the checksum file before it is removed (line 59). The filename pattern (`invest-html-checksums-YYYY-MM-DD_HHMMSS.txt`) is predictable. In the specific threat model (local personal macOS), this is low risk, but the file is not created with restricted permissions (`umask` is inherited, typically 022, making the file 644).

**Fix:** Create the temp file with restricted permissions, or store it in `$LOG_DIR` (which is inside the project directory with git-managed access):

```bash
CHECKSUM_FILE="$LOG_DIR/html-checksums-${TIMESTAMP}.txt"
```

---

_Reviewed: 2026-07-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
