# Phase 29: Daily Tracking Data Supply - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 29-daily-tracking-data-supply
**Areas discussed:** パイプライン配置とステップ設計, 出力ファイル構成, レート制限対策の実装方式, 同日キャッシュ, ニュースマッチングの入力構成, 欠損データ表現と下流契約
**Mode:** --auto（全エリア自動選択、各質問は推奨オプションで自動確定）

---

## パイプライン配置とステップ設計

| Option | Description | Selected |
|--------|-------------|----------|
| Step 2h 直後の新 Step 2i | ウォッチリスト確定直後・Step 3 より前。決定論的TSインフラ（2g〜2i）を連続配置し Phase 30 より前を構造保証 | ✓ |
| Step 3 内（レポート系と並置） | Step 3.0 準備の後に配置。判定ステップ（Phase 30）との距離は近いが、TSインフラが分散する | |

**User's choice:** 自動確定（推奨: Step 2h 直後の Step 2i、単一 CLI・単一 STEP マーカー `[STEP:watchlist-data:*]`）
**Notes:** research ARCHITECTURE の Step 3-W → 3-W2 順序に対応。空ウォッチリストは正常系（OK マーカー＋空の有効JSON）。

---

## 出力ファイル構成（Phase 30 への供給契約）

| Option | Description | Selected |
|--------|-------------|----------|
| 2ファイル分離（既存形状の完全流用） | watchlist-technicals.json は technicals.json と同形状、watchlist-news.json は holding-news.json と同じID参照形状 | ✓ |
| 1ファイル統合（銘柄キーで technicals+news を同居） | Phase 30 の読み込みは1回で済むが、既存形状・既存解決手順を流用できない新形状になる | |

**User's choice:** 自動確定（推奨: 2ファイル分離。ID参照方式維持、asOf/generatedAt を契約として保持）

---

## レート制限対策の実装方式（TRAC-03）

| Option | Description | Selected |
|--------|-------------|----------|
| 専用CLI新設＋チャンク化取得 | collect-watchlist-data.ts が少数並列＋チャンク間待機で取得。既存 collect-technicals.ts / fetchTechnicalSnapshots は無変更 | ✓ |
| collect-technicals.ts CLI を入力ファイル差し替えで流用 | 新規コード最小だが Promise.all 無制限並列を成長するリストに流用（research Pitfall 3 が明示的に警告する bounded N 前提の継承） | |
| fetchTechnicalSnapshots 自体にスタガーを追加 | 全呼び出し元に影響。Step 2b の既存挙動への回帰リスク | |

**User's choice:** 自動確定（推奨: 専用CLI＋チャンク化。TRAC-03 の「バッチ化でレート制限を考慮」の文言と research Pitfall 3 の「最初から設計に含める」指示を満たす）
**Notes:** チャンクサイズ・待機msの具体値は名前付き定数でプランナー裁量（目安: 並列4〜5、200〜500ms）。

---

## 同日キャッシュ（重複取得の回避）

| Option | Description | Selected |
|--------|-------------|----------|
| tmp/technicals.json を fail-soft 再利用 | Step 2b 取得済み銘柄はコピー、欠落のみ新規取得。当日 admit 銘柄の重複 chart 呼び出しを構造的に削減 | ✓ |
| キャッシュなし（毎回全銘柄取得) | 実装は単純だが research Pitfall 3「Cache same-day repeated lookups」に反する | |

**User's choice:** 自動確定（推奨: 再利用。キャッシュ欠損・破損時は全銘柄取得へフォールバックし、正しさの依存点にしない）

---

## ニュースマッチングの入力構成（Pattern 4 適用詳細）

| Option | Description | Selected |
|--------|-------------|----------|
| buildHoldingNewsMap 無改変流用＋Phase 28 保存済み社名 | watchlist entry を PortfolioHolding 形状にマップ（name = entry.name ?? ticker）。マッチャー変更ゼロ | ✓ |
| マッチャーの watchlist 専用改修 | 上限・優先度をウォッチリスト向けに調整できるが、実証済みコードの分岐が増える | |

**User's choice:** 自動確定（推奨: 無改変流用。MAX_ARTICLES_PER_HOLDING=5 継承、matchAliases キュレーションなしで開始）

---

## 欠損データ表現と下流契約（fail-soft 粒度）

| Option | Description | Selected |
|--------|-------------|----------|
| technicals は omit・news は全キー保証・破損時も有効JSON出力 | 既存2ファイルの契約をそのまま踏襲。watchlist.json 破損時は FAIL マーカー＋空JSON出力（read-only、書き戻しなし） | ✓ |
| 欠落銘柄を null プレースホルダで明示 | 欠落が形として見えるが既存 technicals.json 契約から逸脱し、Phase 30/31 のローダーが新分岐を持つ | |

**User's choice:** 自動確定（推奨: 既存契約踏襲。tmp/news.json 読込失敗はニュース側のみ空で継続する部分 fail-soft）

---

## Claude's Discretion

- 純関数モジュールの配置と正確なシグネチャ
- チャンクサイズ・チャンク間待機msの具体値と定数名
- technicals.ts からの1銘柄取得ロジック再利用手段（fetchTechnicalSnapshot の export 追加 vs チャンク版ヘルパー追加）
- CLI ログ文言・フォーマット詳細
- 単体テストのケース構成詳細

## Deferred Ideas

- matchAliases 人手キュレーション（Phase 28 から継続）
- 判定LLM呼び出しのバッチ化（Phase 30 管轄、30銘柄超がトリガー）
- Finnhub 銘柄別カンパニーニュースのウォッチリスト適用（プール抽出の精度不足が観測されたら）
- アクティブ銘柄数の上限キャップ（monitor first, cap later 継続）
