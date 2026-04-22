export interface PortfolioHolding {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
}

export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", name: "Moderna", nameJa: "モデルナ", sector: "Healthcare" },
  { symbol: "JOBY", name: "Joby Aviation", nameJa: "ジョビー・アビエーション", sector: "Industrials" },
  { symbol: "HII", name: "Huntington Ingalls Industries", nameJa: "ハンティントン・インガルス", sector: "Industrials" },
  { symbol: "POWL", name: "Powell Industries", nameJa: "パウエル・インダストリーズ", sector: "Industrials" },
  { symbol: "FLNC", name: "Fluence Energy", nameJa: "フルエンス・エナジー", sector: "Energy" },
  { symbol: "EE", name: "Excelerate Energy", nameJa: "エクセラレート・エナジー", sector: "Energy" },
  { symbol: "8522.T", name: "The Bank of Nagoya", nameJa: "名古屋銀行", sector: "Financials" },
] as const;
