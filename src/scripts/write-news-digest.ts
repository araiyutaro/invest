import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRawNewsCuration, resolveNewsCuration, validateMeetingResult } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import { generateNewsDigestHtml } from "./generate-news-digest.js";
import { buildDigestCrossRefMap } from "../meeting/digest-crossref.js";
import type { DigestCrossRefMap } from "../meeting/digest-crossref.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");

export async function main(): Promise<void> {
  // date は上流で検証済みの meeting-result.json からのみ取得する。
  // news-curation.json (LLM生成、信頼できない) から date を導出しない (T-17-03: パストラバーサル対策)。
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const { date } = JSON.parse(meetingRaw) as { date: string };

  const dateDir = join(DOCS_DIR, date);
  await mkdir(dateDir, { recursive: true });

  try {
    const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8"); // ENOENT時: Agent失敗(D-07)
    const raw = validateRawNewsCuration(JSON.parse(rawJson) as unknown); // 構造/enum違反でthrow (T-17-01)
    const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
    const curation = resolveNewsCuration(raw, pool, date, new Date().toISOString()); // throwしない

    // D-13: crossref計算は既存digest try/catchから独立した孤立ブロック。
    // 例外はcrossRefMapを空のまま残すのみで、digestのexit code/フォールバック表示には一切影響しない(T-24-02)。
    let crossRefMap: DigestCrossRefMap = {};
    try {
      const meetingResult = validateMeetingResult(JSON.parse(meetingRaw));
      crossRefMap = buildDigestCrossRefMap(curation, meetingResult);
      console.error("[digest-crossref] OK");
    } catch (crossRefError) {
      console.error(
        "[digest-crossref] FAIL:",
        crossRefError instanceof Error ? crossRefError.message : crossRefError,
      );
    }

    const html = generateNewsDigestHtml(curation, date, crossRefMap); // T-17-02: HTML生成は既存関数に委譲
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.log(`news-digest.html generated: ${curation.articles.length} articles`);
  } catch (error) {
    // D-08: 失敗時もフォールバックHTMLを必ず書き出す(ファイルは常に存在)
    const html = generateNewsDigestHtml(null, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.error("news-digest fallback:", error instanceof Error ? error.message : error);
    process.exit(1); // D-10: exit codeがOK/FAILシグナル。writeFileの成否とは無関係(Pitfall 2)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
