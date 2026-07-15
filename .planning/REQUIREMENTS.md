# Requirements: Investment Agent v2.7 Entry Timing Watchlist & ETF Exclusion

**Defined:** 2026-07-15
**Core Value:** 毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること

## v2.7 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### ETF除外

- [x] **ETF-01**: アナリストの推奨銘柄（picks / highlightedStocks）からETFを除外するプロンプト指示が全アナリストエージェントに適用される
- [x] **ETF-02**: meeting-result 確定後、TS側で yahoo-finance2 `quote().quoteType` 照合により highlightedStocks からETFを決定論的に除外する（米国・日本ETF両対応、lookup失敗時も throw せず安全側に処理）

### ウォッチリスト

- [x] **WLST-01**: 当日ミーティングで `verdict: 強気` となった銘柄（ETF除外後）が `data/watchlist.json` に自動登録される（ticker キー方式の状態テーブル、addedDate/lastVerdictDate 付き、当日以降の蓄積で過去分の遡及なし）
- [x] **WLST-02**: 再評価で verdict が中立/弱気に転落した銘柄はウォッチリストから自動除外される（TS側決定論）
- [x] **WLST-03**: portfolio.json の保有銘柄に現れたティッカーは「購入済み」としてウォッチリストから自動除外される（TS側決定論）
- [x] **WLST-04**: 強気再確認が一定期間ない銘柄は時間ベースで自動失効する（TS側決定論、リスト無限肥大の構造的防止）
- [x] **WLST-05**: 除外・失効はレコード削除ではなく理由付き（removedReason: downgraded/purchased/expired）で記録され、履歴として追跡できる

### 追跡データ供給

- [ ] **TRAC-01**: ウォッチリスト銘柄の当日株価・テクニカル指標（MA/RSI/出来高等）が日次収集され判定エージェントに供給される（collect-technicals パターン流用）
- [ ] **TRAC-02**: ウォッチリスト銘柄の関連ニュースが tmp/news.json からTS側決定論で抽出され判定エージェントに供給される（holding-news パターン流用）
- [ ] **TRAC-03**: 追跡データ収集は銘柄単位で fail-soft（1銘柄の取得失敗が他銘柄の処理やパイプライン全体を止めない、バッチ化でレート制限を考慮）

### 買いタイミング判定

- [ ] **TIME-01**: 判定エージェントが各ウォッチリスト銘柄について「今日買うべき / 待つべき」の二値判定と判定理由を日次で出力する
- [ ] **TIME-02**: 判定出力はTS側 zod スキーマ（passthrough().transform() alias硬化）で検証され、不正フィールドでパイプラインが停止しない
- [ ] **TIME-03**: 前日判定スナップショットが independent-then-compare 方式で注入され、判定変化（待ち→買い等）はTS側決定論で検出される（フリップフロップ緩和、Phase 22 パターン流用）
- [ ] **TIME-04**: 判定理由は供給された実データの複数シグナル合致（confluence ≥2、例: MA位置＋RSI＋出来高＋ニュース材料）に基づくことがプロンプト契約で要求される（指標値の創作禁止）
- [ ] **TIME-05**: 米国株（前日終値ベース）と日本株（寄付き前）のデータ基準時点の違いが判定入力と表示の両方で区別される（ルックアヘッドバイアス防止）

### レポート表示

- [ ] **UI-09**: Daily Report にウォッチリストセクションが追加され、各銘柄に「今日買うべき」バッジ（または「待ち」表示）と判定理由・会社名が表示される
- [ ] **UI-10**: 前日からの判定変化（新規買いシグナル点灯・買い→待ち転落）が既存バッジUXと同様の様式で区別表示される

### 運用安定性

- [ ] **OPS-06**: ウォッチリスト関連の新パイプラインステップ（登録・データ供給・判定・描画）は fail-soft 設計（専用 [STEP:*] マーカー、失敗時も既存4レポートの生成・デプロイが継続）

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### ウォッチリスト拡張

- **WLST-F1**: 保有銘柄の買い増しタイミング判定（ウォッチリストと同じ仕組みの保有銘柄への適用）
- **WLST-F2**: 買いシグナル的中率の事後検証レポート（シグナル点灯後の株価追跡）

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 過去レポート（docs/ HTML）からのウォッチリスト遡及ブートストラップ | 今日以降の蓄積で開始する方針をユーザー確認済み。HTMLパースは脆弱で、再強気評価で自然に取り込まれる |
| 購入の手動マーク機構 | portfolio.json への追加が購入の記録を兼ねる（既存運用フローで完結） |
| 目標エントリー価格の決定論的アラート（価格到達で機械的点灯） | LLM判定＋TS検証ハイブリッドを採用。固定ルール設計は複数シグナル合致の判定より硬直的 |
| 専用ウォッチリストHTMLページ（5枚目レポート） | Daily Report 内セクションで十分。レポート枚数の増加は閲覧動線を複雑化 |
| ザラ場中のリアルタイム判定 | 日次バッチ（朝8時実行）で十分。既存 Out of Scope「リアルタイム株価ストリーミング」と同方針 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ETF-01 | Phase 27 | Complete |
| ETF-02 | Phase 27 | Complete |
| WLST-01 | Phase 28 | Complete |
| WLST-02 | Phase 28 | Complete |
| WLST-03 | Phase 28 | Complete |
| WLST-04 | Phase 28 | Complete |
| WLST-05 | Phase 28 | Complete |
| TRAC-01 | Phase 29 | Pending |
| TRAC-02 | Phase 29 | Pending |
| TRAC-03 | Phase 29 | Pending |
| TIME-01 | Phase 30 | Pending |
| TIME-02 | Phase 30 | Pending |
| TIME-03 | Phase 30 | Pending |
| TIME-04 | Phase 30 | Pending |
| TIME-05 | Phase 30 | Pending |
| UI-09 | Phase 31 | Pending |
| UI-10 | Phase 31 | Pending |
| OPS-06 | Phase 29 | Pending |

**Coverage:**

- v2.7 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after roadmap creation (Phases 27-31)*
