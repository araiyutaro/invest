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
  { symbol: "5885.T", name: "GDEP Advance", nameJa: "ジーデップ・アドバンス", sector: "Technology" },
  { symbol: "5576.T", name: "O.B.System", nameJa: "オービーシステム", sector: "Technology" },
  { symbol: "7711.T", name: "Sukagawa Electric", nameJa: "助川電気工業", sector: "Industrials" },
  { symbol: "NXT", name: "Nextpower", nameJa: "ネクストパワー", sector: "Energy" },
  { symbol: "BWMX", name: "Betterware de Mexico", nameJa: "ベターウェア・デ・メヒコ", sector: "Consumer" },
] as const;
