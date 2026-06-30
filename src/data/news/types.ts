export interface RawNewsArticle {
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: Date;
  readonly category: string;
  readonly ticker?: string;
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

export interface NewsFilterStats {
  readonly raw: number;
  readonly afterUrlDedup: number;
  readonly afterTitleDedup: number;
  readonly afterCrossLangDedup: number;
  readonly afterRelevance: number;
  readonly final: number;
}

export interface NewsFilterResult {
  readonly articles: ReadonlyArray<RawNewsArticle>;
  readonly stats: NewsFilterStats;
}
