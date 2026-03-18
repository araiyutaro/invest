export interface RawNewsArticle {
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: Date;
  readonly category: string;
}

export interface NewsDigest {
  readonly source: string;
  readonly summary: string;
}

export interface MarketNews {
  readonly usMarket: string;
  readonly japanMarket: string;
  readonly macro: string;
  readonly sectors: string;
  readonly earnings: string;
}
