import { escapeHtml, generateBaseStyles } from "./report-utils.js";
import type { NewsCuration, CuratedArticle } from "../meeting/types.js";

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

function formatPublishedAtJst(publishedAtIso: string): string {
  // D-02: 実行時刻に依存する相対時刻APIは使わない -- publishedAt文字列からのみ絶対時刻を導出(アーカイブ整合性)
  const d = new Date(publishedAtIso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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

function safeHref(url: string): string | null {
  // T-16-02-03: javascript:/data: 等の非http(s)スキームはリンク化しない(最終防衛線)
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}

function formatArticleCardHtml(a: CuratedArticle): string {
  const badge = importanceBadgeHtml(a.importance);
  const timeJst = formatPublishedAtJst(a.publishedAt);
  const tickersHtml = formatTickerPillsHtml(a);
  const href = safeHref(a.url);
  // D-01: 見出し自体を元記事リンクにする。T-16-02-01/02: hrefもescapeHtml + rel=noopener noreferrer(reverse tabnabbing対策)
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>`
    : escapeHtml(a.title);
  const metaTail = tickersHtml ? ` ・ ${tickersHtml}` : "";

  // D-03: 1行目バッジ+見出し / 2行目ソース・時刻・ティッカーのメタ行 / 3行目解説コメント
  return `<div class="agent-card news-card">
      <h4>${badge} ${titleHtml}</h4>
      <p class="news-meta">${escapeHtml(a.source)} ・ ${escapeHtml(timeJst)}${metaTail}</p>
      <p>${escapeHtml(a.commentary)}</p>
    </div>`;
}

function formatMarketGroupsHtml(articles: ReadonlyArray<CuratedArticle>): string {
  return MARKET_ORDER.map(({ value, label }) => {
    const groupArticles = sortByImportance(articles.filter((a) => a.market === value));
    const bodyHtml = groupArticles.length === 0
      ? `<p class="agent-card">本日の該当記事なし</p>` // D-06: 0件市場グループも見出しは常時表示
      : groupArticles.map(formatArticleCardHtml).join("\n");
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

export function generateNewsDigestHtml(curation: NewsCuration | null, date: string): string {
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

  const bodyHtml = formatLeadInHtml(curation.leadIn) + formatMarketGroupsHtml(curation.articles);
  return renderShell(styles, timestamp, curation.date, bodyHtml);
}
