import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { analystRound1OutputSchema, analystRound2OutputSchema, analystRound3OutputSchema, portfolioAnalysisSchema } from "../meeting/schemas.js";
import type { AnalystRound1Output, AnalystRound2Output, AnalystRound3Output, PortfolioAnalysis } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");

export async function loadRound1Results(): Promise<ReadonlyArray<AnalystRound1Output>> {
  const roundDir = join(TMP_DIR, "round-1");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound1OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound1Output;
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound1Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadRound2Results(): Promise<ReadonlyArray<AnalystRound2Output>> {
  const roundDir = join(TMP_DIR, "round-2");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound2OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound2Output;
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound2Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadRound3Results(): Promise<ReadonlyArray<AnalystRound3Output>> {
  const roundDir = join(TMP_DIR, "round-3");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound3OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound3Output;
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound3Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.error('Portfolio analysis load failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
