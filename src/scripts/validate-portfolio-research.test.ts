import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validate } from "./validate-portfolio-research.js";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const symbolToFile = (symbol: string): string => `${symbol.replaceAll("/", "-")}.json`;

const validResultJson = (ticker: string): string =>
  JSON.stringify({
    ticker,
    researchSummary: "テスト用サマリー",
    positiveFindings: ["ポジティブ材料"],
    negativeFindings: ["ネガティブ材料"],
    keyArticles: [{ title: "記事タイトル", summary: "記事要約" }],
    researchedAt: "2026-07-03T09:00:00.000Z",
  });

describe("validate (portfolio-research)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "portfolio-research-validate-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const writeAllValid = async (): Promise<void> => {
    for (const holding of PORTFOLIO_HOLDINGS) {
      await writeFile(join(dir, symbolToFile(holding.symbol)), validResultJson(holding.symbol), "utf-8");
    }
  };

  it("12ファイル全て有効なら failed=0 を返す", async () => {
    await writeAllValid();
    await expect(validate(dir)).resolves.toBe(0);
  });

  it("空ディレクトリ（リサーチ全滅の0ファイル）では全12銘柄がFAILになる（CR-01: 偽陽性パスの防止）", async () => {
    await expect(validate(dir)).resolves.toBe(PORTFOLIO_HOLDINGS.length);
  });

  it("1ファイル欠落は failed=1 として検知される（D-11: 12ファイル契約）", async () => {
    await writeAllValid();
    const first = PORTFOLIO_HOLDINGS[0];
    if (!first) throw new Error("PORTFOLIO_HOLDINGS が空です");
    await rm(join(dir, symbolToFile(first.symbol)));
    await expect(validate(dir)).resolves.toBe(1);
  });

  it("ファイル名symbolとJSON tickerの不一致はFAILになる（WR-01: Pitfall 5 エンティティ衝突）", async () => {
    await writeAllValid();
    // EE.json の中身が別銘柄 NXT の ticker になっている退化ケース
    await writeFile(join(dir, "EE.json"), validResultJson("NXT"), "utf-8");
    await expect(validate(dir)).resolves.toBe(1);
  });

  it("プレースホルダのまま保存されたフォールバックJSON（ticker=\"...\"）はFAILになる（WR-04退化ケースの検知）", async () => {
    await writeAllValid();
    await writeFile(
      join(dir, "EE.json"),
      JSON.stringify({
        ticker: "...",
        researchSummary: "リサーチ失敗",
        positiveFindings: [],
        negativeFindings: [],
        keyArticles: [],
        researchedAt: "...",
      }),
      "utf-8",
    );
    await expect(validate(dir)).resolves.toBe(1);
  });

  it("無効JSONのファイルはFAILとして数えられ、他銘柄の検証は継続される", async () => {
    await writeAllValid();
    await writeFile(join(dir, symbolToFile("MRNA")), "{ これはJSONではない", "utf-8");
    await expect(validate(dir)).resolves.toBe(1);
  });

  it("`.T` サフィックス付きsymbol（日本株）もファイル名とtickerが正しく突合される", async () => {
    await writeAllValid();
    await writeFile(join(dir, "8522.T.json"), validResultJson("8522.T"), "utf-8");
    await expect(validate(dir)).resolves.toBe(0);
  });

  it("ディレクトリ自体が存在しない場合はrejectする（CLI側で非0終了になる）", async () => {
    await expect(validate(join(dir, "does-not-exist"))).rejects.toThrow();
  });
});
