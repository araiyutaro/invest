# Phase 15: Curation Contract & Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 15-Curation Contract & Schema
**Areas discussed:** 記事IDの割り当て方式, 件数ソフトクランプの挙動, 重要度の契約表現, バリデーション寛容度と不正ID処理

---

## 記事IDの割り当て方式

### Q1: 記事IDはどこで・どう付与するか

| Option | Description | Selected |
|--------|-------------|----------|
| 書き出し時に短い連番IDを付与（推奨） | collect-data.ts が news.json 書き出し時に n01…n80 のような短いIDフィールドを追加。転記ミスが起きにくく、TS側照合も単純 | ✓ |
| 配列インデックスを暗黙IDに | news.json 無変更、Agentが番号を返す。0/1始まりの取り違えリスク | |
| URLハッシュをIDに | コンテンツ由来で安定だが、日次使い捨てパイプラインでは過剰。長いハッシュはLLM転記ミスを誘発 | |

**User's choice:** 書き出し時に短い連番IDを付与

### Q2: ID付与の実装は Phase 15 でどこまで含めるか

| Option | Description | Selected |
|--------|-------------|----------|
| collect-data.ts の変更まで含める（推奨） | ID付与の純関数 + スキーマ + collect-data.ts への組み込みを Phase 15 で完結。CURA-02のPhase 15マッピングと整合 | ✓ |
| スキーマと純関数のみ、配線はPhase 17 | 関心事は純粋に分離されるが、契約の実動確認が遅れる | |

**User's choice:** collect-data.ts の変更まで含める
**Notes:** IDの具体的形式（n01形式などの細部）はClaudeの裁量に委任。

---

## 件数ソフトクランプの挙動

### Q1: 15件超過時の truncate 基準

| Option | Description | Selected |
|--------|-------------|----------|
| Agent自身の重要度順で上位15件（推奨） | LLM著作の編集判断を尊重（Architecture Pattern 3と一貫）、TS実装はslice | ✓ |
| filter.tsのsortByPriorityScoreで再ソート | 決定的だがLLMの編集判断とtruncate基準が食い違う可能性 | |
| 警告のみで全件受理 | 「厳選」の価値提案が崩れるリスク | |

**User's choice:** Agent自身の重要度順で上位15件

### Q2: 10件未満の場合の扱い

| Option | Description | Selected |
|--------|-------------|----------|
| そのまま受理して警告ログ（推奨） | 件数不足はエラーではなく情報量の少ない日。fail-softと整合 | ✓ |
| 不足分をプールから自動補充 | 補充記事に解説コメントがなく品質が不揃いに | |
| 最低件数をプールサイズ連動に | ロジック複雑化の割に得るものが少ない | |

**User's choice:** そのまま受理して警告ログ

### Q3: 選定0件のケースの契約上の扱い

| Option | Description | Selected |
|--------|-------------|----------|
| 0件も有効な契約として受理（推奨） | 空配列は通過、レンダリング側でグレースフル表示。スキーマ失敗（null）と正常0件を区別でき障害調査しやすい | ✓ |
| 0件はバリデーション失敗扱い | ページ非生成のシンプルさはあるが区別不能に | |

**User's choice:** 0件も有効な契約として受理

---

## 重要度の契約表現

### Q1: スキーマ内での重要度表現

| Option | Description | Selected |
|--------|-------------|----------|
| enumバッジ + 配列順（推奨） | importance: high/medium/low のzod enum + 配列順。TS側でバッジ階層→配列順の安定ソートで矛盾を構造的に解消。既存の定性enumパターンと一貫 | ✓ |
| 数値スコアから両方導出 | 構築上完全に一貫するがLLM数値は7〜8に偏りがち。数値スコア否定の既存方針とも緊張 | |
| 配列順のみ + 順位ベースバッジ | 矛盾は起きないが静かな日でも必ずHighが出るなど実態と乖離 | |

**User's choice:** enumバッジ + 配列順

### Q2: 記事リストの構造

| Option | Description | Selected |
|--------|-------------|----------|
| フラット配列 + marketフィールド（推奨） | 単一 articles 配列、各記事に market: us/japan/global。グルーピングはPhase 16のレンダリング側。バリデーション単純 | ✓ |
| 市場別ネスト構造 | グルーピングが契約に埋め込まれるがLLMのキー名ドリフト等で契約表面積が増える | |

**User's choice:** フラット配列 + marketフィールド

---

## バリデーション寛容度と不正ID処理

### Q1: 存在しないID・重複IDの処理

| Option | Description | Selected |
|--------|-------------|----------|
| drop & 警告ログ（推奨） | 不正IDスキップ・重複は初出のみ・console.warn。1件の幻覚IDがダイジェスト全体を道連れにしない | ✓ |
| 不正率しきい値方式 | 根本的に壊れた出力を検知できるがしきい値の根拠付けが難しい | |
| 1件でも不正なら全体失敗 | 検知は確実だが転記ミス1件でレポート丸ごと消えるのは過剰反応 | |

**User's choice:** drop & 警告ログ

### Q2: スキーマの寛容度スタイル

| Option | Description | Selected |
|--------|-------------|----------|
| passthrough + transform 耐性型（推奨） | portfolioAnalysisSchemaと同パターン。未知フィールド許容・デフォルト補完。コア契約（ID・market・importance）は厳格 | ✓ |
| strict型（meetingResult系） | 契約の明確さは最大だがLLM出力の揺らぎでfail-softパスに落ちる頻度が上がる | |

**User's choice:** passthrough + transform 耐性型

### Q3: 「なぜ重要か」コメント欠落記事の扱い

| Option | Description | Selected |
|--------|-------------|----------|
| その記事をdrop & 警告（推奨） | 解説コメントはダイジェストの価値の中核。掲載記事は必ずコメント付きという品質保証 | ✓ |
| 空コメントで掲載続行 | 記事数は維持されるがコメントなし記事が混ざると一貫性が崩れる | |

**User's choice:** その記事をdrop & 警告

---

## Claude's Discretion

- IDの具体的な形式（n01 / a1 形式、桁数など）
- 型・スキーマ・純関数の命名詳細と関数分割（既存 schemas.ts / types.ts の慣例に従う）
- fixture JSON の具体的ケース設計（成功基準4のカバレッジを満たすこと）
- Phase 16 で描画されるフィールド（リード文・ティッカータグ等）のスキーマ上の詳細形状

## Deferred Ideas

None — discussion stayed within phase scope
