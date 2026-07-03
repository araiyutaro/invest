# Phase 18: Index/Nav Integration & Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 18-Index/Nav Integration & Validation
**Areas discussed:** 過去日付への遡及反映, リンクの見せ方, 検証（Validation）の深さ

---

## 過去日付への遡及反映

### Q1: news-digest.html の実在チェックの適用範囲

| Option | Description | Selected |
|--------|-------------|----------|
| 毎回全エントリ再スキャン (Recommended) | パース済み全エントリ（約109件）に fs チェックを適用。冪等・自己修復的で 7/3 も次回実行で自動反映 | ✓ |
| 当日のみ（forward-only） | 当日エントリのみチェック。7/3 の欠落は手動修正か放置 | |
| 一回限りの補正 + forward-only | 実装時に一度だけ補正し、以降は当日のみ | |

**User's choice:** 毎回全エントリ再スキャン

### Q2: news-digest リンクの導出方式

| Option | Description | Selected |
|--------|-------------|----------|
| fsから完全導出 (Recommended) | 実在→付与、不在→除去。パース済みリンクは信用せず上書き | ✓ |
| 追加のみ（除去しない） | 欠落時のみ追加。ファイルが消えてもリンク残存の余地 | |

**User's choice:** fsから完全導出

### Q3: 既存3レポートリンクへの実在チェック拡大

| Option | Description | Selected |
|--------|-------------|----------|
| 広げない（現状維持） (Recommended) | 3リンクは従来通り。変更面積を news-digest に限定 | ✓ |
| 4リンクすべてfs導出に統一 | 一貫性は高いが回帰リスク増 | |

**User's choice:** 広げない（現状維持）

---

## リンクの見せ方

### Q1: リンクラベル

| Option | Description | Selected |
|--------|-------------|----------|
| News Digest (Recommended) | 既存英語ラベル慣例・Phase 16 D-13 タイトルと統一 | ✓ |
| ニュースダイジェスト（日本語） | 分かりやすいが既存ラベルと不統一 | |

**User's choice:** News Digest

### Q2: 配置

| Option | Description | Selected |
|--------|-------------|----------|
| 末尾（4番目） (Recommended) | 加法的でレイアウトを乱さない | ✓ |
| 先頭（1番目） | 朝の閲覧優先だが過去日付との並び不一致が目立つ | |
| Daily Report の直後（2番目） | ニュース系コンテンツの隣接配置 | |

**User's choice:** 末尾（4番目）

### Q3: ヒーローブロックへの表示

| Option | Description | Selected |
|--------|-------------|----------|
| 表示する (Recommended) | renderEntryLinks 共有により自動。最新日はファイル常時実在で404リスクなし | ✓ |
| ヒーローは3リンクのまま | 分岐が増える割に利点少 | |

**User's choice:** 表示する

### Q4: 見た目上の区別

| Option | Description | Selected |
|--------|-------------|----------|
| 他リンクと同じ見た目 (Recommended) | index.html の CSS 変更不要、回帰リスクゼロ | ✓ |
| パープル系の強調（#8b5cf6） | 4紙目を視覚的に区別。CSS 追加が必要 | |

**User's choice:** 他リンクと同じ見た目

---

## 検証（Validation）の深さ

### Q1: 検証の範囲

| Option | Description | Selected |
|--------|-------------|----------|
| ユニット + ライブ実行 (Recommended) | TDD + 実機での index.html 反映確認。v2.4最終フェーズとして実機実証で締める | ✓ |
| ユニットテストのみ | ライブ確認は翌朝の launchd に委ねる | |
| ユニット + ライブ + マイルストーン監査 | v2.4 全体監査まで本フェーズに含める | |

**User's choice:** ユニット + ライブ実行

### Q2: 欠落日（成功基準2）の実環境確認

| Option | Description | Selected |
|--------|-------------|----------|
| 過去日付で自然検証 (Recommended) | news-digest.html を持たない既存約108日分がネガティブケース | ✓ |
| 意図的な失敗注入も行う | ファイル一時退避で除去動作まで確認。docs/ の一時操作が必要 | |

**User's choice:** 過去日付で自然検証

### Q3: ライブ検証の実行形態

| Option | Description | Selected |
|--------|-------------|----------|
| update-index.ts 単体実行 (Recommended) | 変更対象のみ実行。フルパイプライン再実行のコスト回避 | ✓ |
| フル /invest 再実行 | E2E 確実性は最高だがエージェント実行コスト大 | |

**User's choice:** update-index.ts 単体実行

---

## Claude's Discretion

- 実在チェックの実装詳細（existsSync 同期 vs access 非同期、関数切り出し・命名）
- テストの fs 依存の扱い（テンポラリ fixture vs チェック関数注入）
- 当日エントリの構築方式（buildStandardLinks への条件付き追加 vs 全エントリ共通導出への統一）
- ライブ検証後の docs/index.html のコミット・デプロイの扱い

## Deferred Ideas

None — discussion stayed within phase scope
