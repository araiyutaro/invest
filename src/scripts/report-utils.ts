const ACCENT_VARIANTS: Record<string, { light: string; lighter: string }> = {
  "#3b82f6": { light: "#60a5fa", lighter: "#93c5fd" },
  "#f59e0b": { light: "#fbbf24", lighter: "#fcd34d" },
  "#10b981": { light: "#34d399", lighter: "#6ee7b7" },
  "#8b5cf6": { light: "#a78bfa", lighter: "#c4b5fd" },
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^\s*][^*]*?)\*(?!\*)/g, "<em>$1</em>");

  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  html = html.replace(/^\|[-| ]+\|\n?/gm, "");
  html = html.replace(
    /^\| (.+) \|$/gm,
    (_, content: string) => {
      const cells = content.split(" | ").map((c: string) => c.trim());
      const row = cells.map((c: string) => `<td>${c}</td>`).join("");
      return `<tr>${row}</tr>`;
    },
  );
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, "<table>$1</table>");

  html = html.replace(/^---$/gm, "<hr>");

  // Normalize the gap after a block-level element into a paragraph break
  // (blank line) so the wrapping pass below can treat it uniformly, even
  // when the block isn't followed by a blank line in the source Markdown
  // (table/list wrapping above may already have consumed the one newline
  // that followed the block, leaving zero newlines before the next text).
  html = html.replace(/(<\/h[1-4]>|<\/ul>|<\/table>|<hr>)\n?(?=[^\n])/g, "$1\n\n");

  html = html.replace(/\n{2,}/g, "\n</p>\n<p>\n");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*(<h[1-4]>)/g, "$1");
  html = html.replace(/(<\/h[1-4]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<table>)/g, "$1");
  html = html.replace(/(<\/table>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<hr>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

export function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#60a5fa";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
}

export function verdictColor(verdict: string): string {
  switch (verdict) {
    case "強気": return "#10b981";
    case "弱気": return "#ef4444";
    default: return "#f59e0b";
  }
}

export function generateBaseStyles(accentColor: string): string {
  const variants = ACCENT_VARIANTS[accentColor] ?? { light: accentColor, lighter: accentColor };
  const { light: accentLight, lighter: accentLighter } = variants;

  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
      background: #0f0f1a;
      color: #e0e0e0;
      line-height: 1.7;
      padding: 2rem;
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 {
      font-size: 1.8rem;
      color: #fff;
      border-bottom: 2px solid ${accentColor};
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      font-size: 1.4rem;
      color: ${accentLight};
      margin-top: 2rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid ${accentColor};
      padding-left: 0.8rem;
    }
    h3 {
      font-size: 1.15rem;
      color: ${accentLighter};
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    h4 {
      font-size: 1rem;
      color: #a5b4fc;
      margin-top: 1.2rem;
      margin-bottom: 0.4rem;
    }
    p { margin-bottom: 0.8rem; }
    ul { list-style: none; padding-left: 0; margin-bottom: 1rem; }
    li {
      padding: 0.5rem 0.8rem;
      margin-bottom: 0.3rem;
      background: #1e1e2e;
      border-radius: 6px;
      border-left: 3px solid ${accentColor};
    }
    strong { color: #fbbf24; }
    hr {
      border: none;
      border-top: 1px solid #333;
      margin: 2rem 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background: #1e1e2e;
      border-radius: 8px;
      overflow: hidden;
    }
    tr:first-child td {
      background: #2a2a3e;
      font-weight: bold;
      color: ${accentLighter};
    }
    td {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid #333;
      text-align: left;
    }
    .timestamp {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .agent-card {
      background: #1e1e2e;
      border-radius: 8px;
      padding: 1.2rem;
      margin-bottom: 1rem;
      border-left: 4px solid #6366f1;
    }
    .agent-card h4 { color: #a5b4fc; margin-top: 0; }
    .discussion-card {
      background: #1a1a28;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid #f59e0b;
    }
    .discussion-card h4 { color: #fbbf24; margin-top: 0; }
    @media (max-width: 768px) {
      body { padding: 1rem; }
      .container { max-width: 100%; }
      table { display: block; overflow-x: auto; white-space: nowrap; }
      h1 { font-size: 1.4rem; }
      .report-links a, summary { min-height: 44px; display: inline-flex; align-items: center; }
    }
  </style>
`;
}
