# Phase 20: Holding-Card News Display — UI設計コントラクト

**作成日:** 2026-07-03
**フェーズ:** 20 — Holding-Card News Display
**要件:** UI-05, UI-06
**ステータス:** Draft(checker検証待ち)

---

## 1. スコープ

ポートフォリオレポート(`docs/YYYY-MM-DD/portfolio-report.html`)の各保有銘柄カード(`agent-card`)内に「関連ニュース」サブセクションを追加する。静的HTML・JSなし・ダークテーマという既存制約の中で完結する。

**非スコープ(明示):** 緊急度フラグ・変化バッジ(Phase 22)、ニュースなしカードの視覚的デエンファシス(Phase 22)、折りたたみUI(D-01で不採用)、新規組入候補セクション変更(Phase 23)

---

## 2. レイアウトコントラクト

### 2.1 配置
- ニュースサブセクションは各 `agent-card` 内、rationale(+ riskNote がある場合はその後)の**直後・カード末尾**に配置
- カード構造(`agent-card` クラス、`border-left` ステータス色)は変更しない

### 2.2 サブセクション構造
```html
<div class="holding-news">
  <div class="holding-news-label">関連ニュース</div>
  <ul class="holding-news-list">
    <li>
      <a href="{news.jsonから解決したURL}" target="_blank" rel="noopener noreferrer">{見出し}</a>
      <span class="holding-news-meta">— {ソース名} · {JST時刻}</span>
      <span class="holding-news-badge">社名一致</span><!-- name/aliasマッチのみ -->
    </li>
  </ul>
</div>
```
- 0件時は `<ul>` の代わりに `<div class="holding-news-empty">本日の関連ニュースなし</div>`

### 2.3 スペーシング
- サブセクション上余白: `margin-top: 12px` + `padding-top: 10px` + `border-top: 1px solid #2d3748`(カード内区切り線)
- リスト: `margin: 8px 0 0` / `padding-left: 18px`
- リスト項目間: `margin-bottom: 6px`(最終項目は0)

---

## 3. タイポグラフィコントラクト

| 要素 | サイズ | 色 | その他 |
|------|--------|-----|--------|
| 見出し「関連ニュース」 | 0.8rem | #94a3b8 | font-weight 600 / letter-spacing 0.05em |
| ニュース見出しリンク | 0.85rem | #93c5fd (visited #c4b5fd) | line-height 1.6 |
| メタ(ソース名·時刻) | 0.75rem | #64748b | 見出しと同一行、`—` 区切り |
| バッジ「社名一致」 | 0.7rem | #94a3b8 | border 1px solid #4a5568 / radius 3px / padding 1px 5px |
| 空状態文言 | 0.8rem | #64748b | font-style normal(イタリック不使用) |

- フォントファミリは既存 `generateBaseStyles` の継承のみ(新規指定なし)

---

## 4. カラーコントラクト

すべて既存ダークテーマパレット内(新色の導入なし):
- リンク: `#93c5fd` / visited `#c4b5fd`(確立済みフィードバック踏襲。ホバーで `text-decoration: underline`)
- ミュートテキスト: `#64748b`(メタ・空状態)
- サブ見出し・バッジ文字: `#94a3b8`
- 区切り線・バッジ枠: `#2d3748` / `#4a5568`
- コントラスト比: #93c5fd on #1a202c = 8.2:1(AA+)、#64748b on #1a202c = 4.6:1(AA)、#94a3b8 on #1a202c = 7.0:1(AA+)

---

## 5. コピーライティングコントラクト

| 用途 | 文言(固定) |
|------|------------|
| サブセクション見出し | 関連ニュース |
| 空状態 | 本日の関連ニュースなし |
| マッチ方式バッジ | 社名一致 |

- バッジは matchType が `name` または `alias` の記事のみに付与。`ticker` は無印(D-07)
- matchType 別の文言出し分けはしない(閲覧者に区別の意味がないため `name`/`alias` とも「社名一致」)
- 時刻表記: `M/D HH:mm` 形式のJST絶対時刻(相対時刻不使用 — アーカイブ整合性)

---

## 6. インタラクションコントラクト

- リンクは `target="_blank" rel="noopener noreferrer"`(全ニュースリンク必須)
- ホバー: `text-decoration: underline`(既存リンク挙動踏襲)
- JS・アニメーション・折りたたみなし(静的HTML制約)
- 表示は供給順のまま最大5件(UI側の絞り込み・並べ替え禁止 — D-04/D-05)

---

## 7. アクセシビリティコントラクト

- 全テキストのコントラスト比 AA 以上(§4 の実測値)
- リンクテキストは見出しそのもの(「こちら」等の無意味リンクテキスト禁止)
- `escapeHtml()` を title / source / バッジ文言に適用(XSS防止)
- 空状態は視覚的に明示(色のみに依存しない — テキストで「なし」を伝達)

---

## 8. 検証チェックリスト(checker向け)

- [ ] D-01〜D-10(CONTEXT.md)との整合
- [ ] 新色ゼロ・既存パレット内で完結
- [ ] 空状態の明示的表示(UI-06)
- [ ] URL は解決済みデータからのみ(UI-05)
- [ ] コントラスト比 AA 以上
- [ ] コピー文言の固定(実装時の文言ブレ防止)

---

*Phase: 20-holding-card-news-display*
*UI-SPEC 作成: 2026-07-03*
