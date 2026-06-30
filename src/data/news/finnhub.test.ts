import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("fetchAllFinnhubNews company field (NEWS-01 / D-02)", () => {
  beforeEach(() => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("FINNHUB_API_KEY未設定の場合はcompany=[]を返す", async () => {
    vi.unstubAllEnvs();
    const { fetchAllFinnhubNews } = await import("./finnhub.js");
    const result = await fetchAllFinnhubNews([]);
    expect(result.company).toEqual([]);
  });

  it("companyTickersが空配列の場合はfetchしない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { fetchAllFinnhubNews } = await import("./finnhub.js");
    const result = await fetchAllFinnhubNews([]);
    const companyFetchCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("company-news"),
    );
    expect(companyFetchCalls).toHaveLength(0);
    expect(result.company).toEqual([]);
  });

  it("FinnhubNews インターフェースに company フィールドが存在する (D-02)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    const { fetchAllFinnhubNews } = await import("./finnhub.js");
    const result = await fetchAllFinnhubNews(["MRNA"]);
    expect(result).toHaveProperty("general");
    expect(result).toHaveProperty("merger");
    expect(result).toHaveProperty("company");
    expect(Array.isArray(result.company)).toBe(true);
  });

  it("company記事のtickerフィールドがティッカーシンボルと一致する (D-03)", async () => {
    const mockItem = {
      category: "company news",
      datetime: Math.floor((Date.now() - 60 * 60 * 1000) / 1000),
      headline: "MRNA announces new treatment",
      id: 1,
      image: "",
      related: "MRNA",
      source: "Reuters",
      summary: "Moderna announced a new treatment.",
      url: "https://reuters.com/mrna-1",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("company-news")) {
        return { ok: true, json: async () => [mockItem] } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });
    const { fetchAllFinnhubNews } = await import("./finnhub.js");
    const result = await fetchAllFinnhubNews(["MRNA"]);
    expect(result.company).toHaveLength(1);
    expect(result.company[0].ticker).toBe("MRNA");
  });
});
