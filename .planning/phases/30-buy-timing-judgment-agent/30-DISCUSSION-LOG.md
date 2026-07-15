# Phase 30: Buy-Timing Judgment Agent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 30-Buy-Timing Judgment Agent
**Mode:** --auto（AskUserQuestion なし。各エリアで推奨オプションを自動選択）
**Areas discussed:** エージェント構成, 出力スキーマとTS検証, フリップフロップ緩和, as-of/US-JPセッション区別, パイプライン配置とfail-soft

---

## エージェント構成（判定の実行単位）

| Option | Description | Selected |
|--------|-------------|----------|
| 銘柄ごと単一ティッカー並列 Agent（sonnet） | Step 3-P/Round 3 前例。想定1〜12銘柄規模に最適（research ARCHITECTURE 推奨） | ✓ |
| バッチ Agent（5〜8銘柄/コール） | 30銘柄超のスケール対策。launch 時点では過剰 | |
| 全銘柄1コール | プロンプト肥大・銘柄間汚染リスク | |

**Auto-selected:** 単一ティッカー並列（sonnet）。WebSearch 等のライブツールは不許可（供給データに閉じて創作を構造的に防止 — research Pattern 3 では任意だが TIME-04 を優先）。バッチ化は 30銘柄超トリガーの deferred。

---

## 出力スキーマと TS 検証

| Option | Description | Selected |
|--------|-------------|----------|
| schemas.ts 二段階 passthrough→transform ＋ TS confluence ゲート | holdingEvaluationSchema の実証パターン。buy で signals<2 は wait へ決定論降格（fail-closed） | ✓ |
| プロンプト契約のみで confluence を担保 | LLM 自己申告依存 — プロジェクト方針に反する | |
| ハード zod エラー（strict schema） | ゆらぎ1件でパイプライン停止 — TIME-02 に反する | |

**Auto-selected:** 二段階 alias 硬化＋TS 決定論 confluence ゲート。TS 専用フィールド（previousAction/actionChanged/asOf/market）は transform で strip し TS が再付与。

---

## フリップフロップ緩和（research Pitfall 4 / research flag）

| Option | Description | Selected |
|--------|-------------|----------|
| 前日注入＋independent-then-compare＋TS 変化検出（デバウンスなし） | Phase 22 実証パターンの直接流用。デバウンスは判定履歴永続化（WLST-F2）が前提のため観測待ち | ✓ |
| 上記＋TS 側2日デバウンス | research が「consider」とした案。履歴基盤なしでは実装が複雑化、表示は Phase 31 管轄 | |
| プロンプト一貫性指示のみ | temperature=0 でも振動する（research 実証）— 不十分 | |

**Auto-selected:** デバウンスなしの3点セット。research flag「ヒステリシス機構の具体決定」への明示的回答として D-12 に記録（silently omit しない）。

---

## as-of / US-JP セッション区別（research Pitfall 5）

| Option | Description | Selected |
|--------|-------------|----------|
| TS 決定論で market/asOf を入出力両方に付与＋次セッション基準のプロンプト言語 | `.T` サフィックス判定・TechnicalSnapshot.asOf 流用・LLM エコー不採用 | ✓ |
| LLM に market/セッションを判断させる | 決定論方針に反する | |
| 表示のみで区別（Phase 31 送り） | データ契約に含めないと Phase 31 で再構築不能 — Pitfall 5 の「初期データ契約に含める」指示に反する | |

**Auto-selected:** TS 決定論付与。US=前日終値/当日夜JSTセッション、JP=寄付き前/当日9:00 JSTセッションの文脈をプロンプトに明記。

---

## パイプライン配置と fail-soft

| Option | Description | Selected |
|--------|-------------|----------|
| Step 3-P 直後に新ステップ・watchlist-judgment マーカー・銘柄単位 fail-soft | Step 3c より前完了の hard requirement を満たす。Step 3-P の部分失敗マーカー様式踏襲 | ✓ |
| Step 3f 直前に配置 | 動作はするが 3-P との対称性・入力確定直後実行の明快さで劣る | |
| Step 2 系（2j）に配置 | Agent 並列実行は Step 3 系の規約（Step 3-P/3a/3b）— 一貫性で劣る | |

**Auto-selected:** Step 3-P 直後。raw 出力は銘柄別ファイル分離（tmp/watchlist-judgment-raw/）、最終ファイルと prev ファイルはクリーンアップ対象外、空リスト=OK 正常系、純関数＋fail-soft CLI 分離。

---

## Claude's Discretion

- ステップ名・番号の正確な表記、invest.md 記述詳細
- スキーマの alias リスト・型名・signals 要素の形
- 純関数モジュール配置・シグネチャ、raw ディレクトリパス名
- Agent プロンプト文面詳細（契約を満たす範囲で）
- 単体テストケース構成の詳細

## Deferred Ideas

- 判定 LLM のバッチ化（30銘柄超トリガー）
- TS 側表示デバウンス（振動観測後）
- 判定履歴永続化・的中率検証（WLST-F2、別ファイル方式）
- matchAliases 人手キュレーション（継続）
- 保有銘柄への買い増し判定適用（WLST-F1）
