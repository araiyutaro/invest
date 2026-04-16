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
  { symbol: "CLS", name: "Celestica", nameJa: "セレスティカ", sector: "Technology" },
  { symbol: "FLNC", name: "Fluence Energy", nameJa: "フルエンス・エナジー", sector: "Energy" },
  { symbol: "EE", name: "Excelerate Energy", nameJa: "エクセラレート・エナジー", sector: "Energy" },
  { symbol: "7095.T", name: "Macbee Planet", nameJa: "Macbee Planet", sector: "Technology" },
] as const;
