import { escapeHtml, generateBaseStyles, safeHref, formatPublishedAtJst, verdictColor } from "./report-utils.js";
import type { NewsCuration, CuratedArticle } from "../meeting/types.js";
import type { DigestCrossRef } from "../meeting/digest-crossref.js";

const MARKET_ORDER: ReadonlyArray<{ value: CuratedArticle["market"]; label: string }> = [
  { value: "us", label: "米国株" },
  { value: "japan", label: "日本株" },
  { value: "global", label: "グローバル" },
]; // D-05: セクション順は固定

const IMPORTANCE_ORDER: Record<CuratedArticle["importance"], number> = { high: 0, medium: 1, low: 2 };

const IMPORTANCE_LABELS: Record<CuratedArticle["importance"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function importanceColor(importance: CuratedArticle["importance"]): string {
  switch (importance) {
    case "high": return "#ef4444";
    case "medium": return "#f59e0b";
    case "low": return "#6b7280";
  }
}

function importanceBadgeHtml(importance: CuratedArticle["importance"]): string {
  // CURA-07: バッジはソートキー(IMPORTANCE_ORDER)と同一の importance から導出する
  return `<span style="color:${importanceColor(importance)};font-weight:bold;">${IMPORTANCE_LABELS[importance]}</span>`;
}

function sortByImportance(articles: ReadonlyArray<CuratedArticle>): CuratedArticle[] {
  // CURA-06/D-07: ネイティブ安定ソート(ES2019+仕様保証)、イミュータブル
  return [...articles].sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);
}

function formatTickerPillsHtml(a: CuratedArticle): string {
  // D-09: リンクなしのプレーンテキストピル / D-04: 社名欠落時はシンボルのみにフォールバック
  return a.tickers
    .map((symbol) => {
      const name = a.tickerNames?.[symbol];
      const label = name ? `${symbol} ${name}` : symbol;
      return `<span class="ticker-pill">${escapeHtml(label)}</span>`;
    })
    .join(" ");
}

function formatDigestCrossRefChipsHtml(annotation: DigestCrossRef | undefined): string {
  // XREP-01/D-08/D-09/D-12: 注記なし(未定義 or 両配列とも空)の場合は空文字を返す(byte-identical契約)
  if (annotation === undefined) return "";
  if (annotation.tickerMatches.length === 0 && annotation.themeMatches.length === 0) return "";

  const tickerChips = annotation.tickerMatches.map(({ symbol, verdict }) => {
    const verdictPart = verdict === undefined
      ? ""
      : ` <strong style="color:${verdictColor(verdict)}">${escapeHtml(verdict)}</strong>`;
    return `<span class="digest-crossref-chip">🗣 ミーティング言及: ${escapeHtml(symbol)}${verdictPart}</span>`;
  });
  const themeChips = annotation.themeMatches.map(({ keyword }) =>
    `<span class="digest-crossref-chip">🗣 関連テーマ: ${escapeHtml(keyword)}</span>`,
  );

  const chipsHtml = [...tickerChips, ...themeChips].join(" ");
  return `\n      <p class="digest-crossref-row">${chipsHtml}</p>`;
}

function formatArticleCardHtml(a: CuratedArticle, annotation?: DigestCrossRef): string {
  const badge = importanceBadgeHtml(a.importance);
  const timeJst = formatPublishedAtJst(a.publishedAt);
  const tickersHtml = formatTickerPillsHtml(a);
  const href = safeHref(a.url);
  // D-01: 見出し自体を元記事リンクにする。T-16-02-01/02: hrefもescapeHtml + rel=noopener noreferrer(reverse tabnabbing対策)
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>`
    : escapeHtml(a.title);
  const metaTail = tickersHtml ? ` ・ ${tickersHtml}` : "";
  const crossRefRowHtml = formatDigestCrossRefChipsHtml(annotation);

  // D-03: 1行目バッジ+見出し / 2行目ソース・時刻・ティッカーのメタ行 / (新規)crossref注記行 / 3行目解説コメント
  return `<div class="agent-card news-card">
      <h4>${badge} ${titleHtml}</h4>
      <p class="news-meta">${escapeHtml(a.source)} ・ ${escapeHtml(timeJst)}${metaTail}</p>${crossRefRowHtml}
      <p>${escapeHtml(a.commentary)}</p>
    </div>`;
}

function formatMarketGroupsHtml(
  articles: ReadonlyArray<CuratedArticle>,
  crossRefMap?: Readonly<Record<string, DigestCrossRef>>,
): string {
  return MARKET_ORDER.map(({ value, label }) => {
    const groupArticles = sortByImportance(articles.filter((a) => a.market === value));
    const bodyHtml = groupArticles.length === 0
      ? `<p class="agent-card">本日の該当記事なし</p>` // D-06: 0件市場グループも見出しは常時表示
      : groupArticles.map((a) => formatArticleCardHtml(a, crossRefMap?.[a.id])).join("\n");
    return `<h2>${escapeHtml(label)}</h2>\n${bodyHtml}`;
  }).join("\n");
}

function formatLeadInHtml(leadIn: string): string {
  // CURA-09: ページ冒頭に「今日の市場を動かすもの」リード文
  return `<div class="agent-card">
      <h2>今日の市場を動かすもの</h2>
      <p>${escapeHtml(leadIn)}</p>
    </div>`;
}

function renderShell(styles: string, timestamp: string, date: string, bodyHtml: string): string {
  // D-13: タイトルは英語+日本語副題。D-11: ページ内ナビは追加しない(index.html経由のみ)
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News Digest - ${escapeHtml(date)}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>News Digest - ${escapeHtml(date)} <span style="font-size:1rem;font-weight:normal;color:#a78bfa;">AI厳選ニュースダイジェスト</span></h1>
    <p class="timestamp">生成日時: ${timestamp}</p>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

export function generateNewsDigestHtml(
  curation: NewsCuration | null,
  date: string,
  crossRefMap?: Readonly<Record<string, DigestCrossRef>>,
): string {
  const styles = generateBaseStyles("#8b5cf6"); // D-10: パープルアクセント
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  if (curation === null) {
    // D-12: Agent自体が失敗した日 -- 空配列(正常0件)とは明確に区別された文言
    return renderShell(
      styles,
      timestamp,
      date,
      `<div class="agent-card"><p>本日のニュースキュレーションは生成できませんでした。</p></div>`,
    );
  }

  if (curation.articles.length === 0) {
    // D-06後半: Agentは成功したが0件選定(Phase 15で有効な契約)
    return renderShell(
      styles,
      timestamp,
      curation.date,
      `<div class="agent-card"><p>本日は厳選記事なし</p></div>`,
    );
  }

  const bodyHtml = formatLeadInHtml(curation.leadIn) + formatMarketGroupsHtml(curation.articles, crossRefMap);
  return renderShell(styles, timestamp, curation.date, bodyHtml);
}
