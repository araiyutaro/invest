export interface PortfolioHolding {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
  /**
   * 保有銘柄別ニュース抽出（D-04）における社名フォールバック照合用の追加エイリアス。
   * 人間キュレーション前提で、一般語・人名と衝突する略称は登録しない
   * （例: POWL の "Powell" は FRB 議長と衝突するため未登録）。自動短縮形生成は不採用。
   */
  readonly matchAliases?: ReadonlyArray<string>;
}

export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", name: "Moderna", nameJa: "モデルナ", sector: "Healthcare" },
  { symbol: "JOBY", name: "Joby Aviation", nameJa: "ジョビー・アビエーション", sector: "Industrials", matchAliases: ["Joby"] },
  { symbol: "HII", name: "Huntington Ingalls Industries", nameJa: "ハンティントン・インガルス", sector: "Industrials" },
  { symbol: "POWL", name: "Powell Industries", nameJa: "パウエル・インダストリーズ", sector: "Industrials" },
  { symbol: "EE", name: "Excelerate Energy", nameJa: "エクセラレート・エナジー", sector: "Energy" },
  { symbol: "8522.T", name: "The Bank of Nagoya", nameJa: "名古屋銀行", sector: "Financials", matchAliases: ["名古屋銀"] },
  { symbol: "5885.T", name: "GDEP Advance", nameJa: "ジーデップ・アドバンス", sector: "Technology" },
  { symbol: "5576.T", name: "O.B.System", nameJa: "オービーシステム", sector: "Technology" },
  { symbol: "7711.T", name: "Sukagawa Electric", nameJa: "助川電気工業", sector: "Industrials" },
  { symbol: "NXT", name: "Nextpower", nameJa: "ネクストパワー", sector: "Energy" },
  { symbol: "BWMX", name: "Betterware de Mexico", nameJa: "ベターウェア・デ・メヒコ", sector: "Consumer" },
  { symbol: "YOU", name: "Clear Secure", nameJa: "クリア・セキュア", sector: "Technology" },
  { symbol: "ASML", name: "ASML Holding", nameJa: "ASMLホールディング", sector: "Technology" },
] as const;
