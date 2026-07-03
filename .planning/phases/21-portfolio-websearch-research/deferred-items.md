# Deferred Items — Phase 21

## Out-of-scope discoveries (not fixed, logged per scope boundary rule)

- **src/scripts/collect-data.test.ts:297,299,358,360** — Pre-existing `TS7006: Parameter implicitly has an 'any' type` errors surfaced by `npx tsc --noEmit -p tsconfig.json` during 21-01 execution. Not touched by 21-01 (verified via `git log`/`git diff` — file unmodified by this plan's commits). Out of scope for 21-01 (Task 1/Task 2 only modify src/meeting/schemas.ts, src/meeting/schemas.test.ts, src/scripts/validate-portfolio-research.ts, src/scripts/generate-report.test.ts). Deferred to future cleanup.
