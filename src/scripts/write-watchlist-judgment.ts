import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { watchlistJudgmentSchema } from "../meeting/schemas.js";
import type { WatchlistJudgment, WatchlistJudgmentFile } from "../meeting/types.js";
import {
  applyConfluenceGate,
  attachActionChanges,
  deriveMarket,
  buildSkippedJudgment,
} from "../portfolio/watchlist-judgment.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import { getActiveWatchlistEntries } from "../portfolio/watchlist.js";
import type { WatchlistEntry, WatchlistFile } from "../portfolio/watchlist.js";
import type { TechnicalSnapshot } from "../data/technicals.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const RAW_DIR = join(TMP_DIR, "watchlist-judgment-raw");
const OUTPUT_PATH = join(TMP_DIR, "watchlist-judgment.json");
const PREV_PATH = join(TMP_DIR, "prev-watchlist-judgment.json");
const TECHNICALS_PATH = join(TMP_DIR, "watchlist-technicals.json");
const MEETING_RESULT_PATH = join(TMP_DIR, "meeting-result.json");
const WATCHLIST_PATH = join(import.meta.dirname, "../../data/watchlist.json");

/**
 * D-18/Pitfall 1: tmp/prev-watchlist-judgment.json の ENOENT-vs-破損 二段フェイル読込。
 * write-watchlist.ts の loadExistingWatchlist を verbatim ベースに実装する。
 * ENOENT 判定は `.code` と `.message` の両方をチェックする（このコードベースの
 * テストモック規約 — プレーンな Error("ENOENT") で欠損をシミュレートするため）。
 * 欠損（no-prior-data）と破損はどちらも前日比較をスキップする（prev: null）が、
 * corrupted フラグで区別し監査ログに残せるようにする。
 * CR-01: judgments フィールドの形状（配列・要素オブジェクト・ticker 文字列・todayAction enum）
 * も検証する。破損 prev が attachActionChanges で TypeError → fatal catch → 当日全判定が
 * 空出力で上書きされる全損経路を防ぐ（前日比較は enrichment であり、prev の破損が
 * 当日の出力を破壊してはならない）。throw せず corrupted: true で返す。
 */
export async function loadPrevJudgmentDefensive(): Promise<{
  prev: WatchlistJudgmentFile | null;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(PREV_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { prev: null, corrupted: true };
    }
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.judgments)) {
      return { prev: null, corrupted: true };
    }
    const allElementsValid = record.judgments.every((j: unknown) => {
      if (typeof j !== "object" || j === null || Array.isArray(j)) return false;
      const el = j as Record<string, unknown>;
      return (
        typeof el.ticker === "string" &&
        (el.todayAction === "buy" || el.todayAction === "wait")
      );
    });
    if (!allElementsValid) {
      return { prev: null, corrupted: true };
    }
    return { prev: parsed as WatchlistJudgmentFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { prev: null, corrupted: false } : { prev: null, corrupted: true };
  }
}

/**
 * CR-03/D-20: data/watchlist.json のアクティブ銘柄 ticker 一覧を read-only で防御的に読む。
 * collect-watchlist-data.ts の loadWatchlistDefensive と同じ二段フェイル規約
 * （ENOENT は空正常系、エントリレベルの形状検証あり）を踏襲するが、本 CLI にとって
 * watchlist は skip レコード合成のための secondary 入力のため、破損時も FAIL にせず
 * 警告して空扱いで継続する（fail-soft。当日判定の出力を watchlist の破損で壊さない）。
 * 書き込みは write-watchlist.ts の責務であり、本 CLI は一切変更しない。
 */
export async function loadActiveWatchlistTickersDefensive(): Promise<ReadonlyArray<string>> {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.error(
        "[watchlist-judgment] data/watchlist.json の形状が不正です。skipレコード合成は空扱いで継続します。",
      );
      return [];
    }
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, v]) =>
        typeof v === "object" && v !== null && typeof (v as WatchlistEntry).ticker === "string",
    );
    return getActiveWatchlistEntries(Object.fromEntries(entries) as WatchlistFile).map(
      (entry) => entry.ticker,
    );
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    if (!isMissing) {
      console.error(
        "[watchlist-judgment] data/watchlist.json の読み込みに失敗しました。skipレコード合成は空扱いで継続します。",
        error,
      );
    }
    return [];
  }
}

/**
 * D-18/D-19: 常に有効 JSON を tmp/watchlist-judgment.json に書き出す共通ヘルパ。
 * collect-watchlist-data.ts の writeEmptyOutputs と同趣旨。
 */
export async function writeEmptyOutput(date: string): Promise<void> {
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({ date, generatedAt: new Date().toISOString(), judgments: [] }, null, 2),
    "utf-8",
  );
}

/**
 * D-01/D-02/D-16/D-18/D-19: tmp/watchlist-judgment-raw/{ticker}.json 群を1銘柄ずつ独立に
 * zod 検証し、confluence ゲート・market/asOf 決定論再付与・前日比較を経て
 * tmp/watchlist-judgment.json を書き出す fail-soft CLI エントリポイント。
 * すべての I/O・フェイルソフト分岐をここに集約する。throw せず全分岐で return する。
 */
export async function main(): Promise<void> {
  // 後続分岐に関わらず必ず tmp/ を作成する（write-watchlist.ts の DATA_DIR mkdir と同趣旨）
  await mkdir(TMP_DIR, { recursive: true });

  let date: string;
  try {
    const raw = await readFile(MEETING_RESULT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { date?: unknown };
    if (typeof parsed.date !== "string" || parsed.date === "") {
      throw new Error("date欠落");
    }
    date = parsed.date;
  } catch (error) {
    console.error(
      "[watchlist-judgment] tmp/meeting-result.json の読み込みに失敗しました。空出力で終了します。",
      error,
    );
    // date が取得できないため、フォールバック値（当日 UTC 日付）で空出力を書く。
    const fallbackDate = new Date().toISOString().slice(0, 10);
    await writeEmptyOutput(fallbackDate);
    console.error("[STEP:watchlist-judgment:FAIL:meeting-result読込失敗]");
    return;
  }

  // CR-03/D-20: skip レコード合成のソースとして data/watchlist.json のアクティブ銘柄を読む
  const activeTickers = await loadActiveWatchlistTickersDefensive();

  let rawFiles: string[];
  try {
    rawFiles = (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json"));
  } catch (error) {
    // WR-05: 正常系0件として扱うのはディレクトリ不存在（ENOENT）のみ。
    // EACCES/EIO 等の実障害を OK マーカーで隠蔽すると、判定が丸ごと欠けた日を
    // 監査ログから検出できないため、FAIL マーカー + 空の有効 JSON で報告する（fail-soft）。
    // ENOENT 判定は `.code` と `.message` の両チェック（loadPrevJudgmentDefensive と同じ規約）。
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    if (!isMissing) {
      console.error(
        "[watchlist-judgment] tmp/watchlist-judgment-raw の読み込みに失敗しました。空出力で終了します。",
        error,
      );
      await writeEmptyOutput(date);
      console.error("[STEP:watchlist-judgment:FAIL:raw読込失敗]");
      return;
    }
    // D-19: raw ディレクトリが存在しない場合はアクティブ0件の正常系として扱う。
    rawFiles = [];
  }

  // CR-03: raw が0件でもアクティブ銘柄が存在する場合は skip レコード合成のため続行する
  // （全アクティブ銘柄のスナップショット欠落等で Agent が1体も起動されなかった日）。
  if (rawFiles.length === 0 && activeTickers.length === 0) {
    console.log("[watchlist-judgment] アクティブ銘柄0件");
    await writeEmptyOutput(date);
    console.error("[STEP:watchlist-judgment:OK]");
    return;
  }

  // technicals: asOf 決定論付与・skip 判定のソース（D-08/D-20）
  let technicalsBySymbol = new Map<string, TechnicalSnapshot>();
  try {
    const raw = await readFile(TECHNICALS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { snapshots?: unknown };
    if (Array.isArray(parsed.snapshots)) {
      const entries = (parsed.snapshots as TechnicalSnapshot[])
        .filter((s): s is TechnicalSnapshot => typeof s === "object" && s !== null && typeof s.symbol === "string")
        .map((s) => [normalizeHoldingSymbol(s.symbol), s] as const);
      technicalsBySymbol = new Map(entries);
    }
  } catch (error) {
    console.error(
      "[watchlist-judgment] tmp/watchlist-technicals.json の読み込みに失敗しました。asOf付与・skip判定は空扱いで継続します。",
      error,
    );
  }

  // raw 検証ループ: 1銘柄ずつ独立 try/catch（T-30-04 DoS 対策、D-18）
  const validatedByTicker = new Map<string, WatchlistJudgment>();
  const failedTickers: string[] = [];
  for (const file of rawFiles) {
    const ticker = file.replace(/\.json$/, "");
    try {
      const raw = await readFile(join(RAW_DIR, file), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      const judgment = watchlistJudgmentSchema.parse(parsed);
      const contentKey = normalizeHoldingSymbol(judgment.ticker);
      // WR-01: ファイル名（オーケストレータ管理で信頼できる）と内容 ticker の整合チェック。
      // LLM が ticker をエコーし損ねた場合の silent overwrite（別銘柄の正当な判定が
      // 無警告に上書きされ、当該銘柄の判定が出力から消える）を防ぐ。
      // ファイル名は `/` を `-` に置換して保存される規約のため、逆変換キーとも比較する。
      const filenameKeys = new Set([
        normalizeHoldingSymbol(ticker),
        normalizeHoldingSymbol(ticker.replace(/-/g, "/")),
      ]);
      if (!filenameKeys.has(contentKey)) {
        failedTickers.push(ticker);
        console.warn(
          `[watchlist-judgment] ファイル名と内容tickerの不一致: ${file} の内容ticker=${judgment.ticker}。この判定は出力に含めません。`,
        );
        continue;
      }
      // WR-01: 同一 ticker への重複書込は先勝ちとし、警告して監査ログに残す。
      if (validatedByTicker.has(contentKey)) {
        failedTickers.push(ticker);
        console.warn(
          `[watchlist-judgment] ticker重複: ${contentKey}（${file}）。先勝ちで既存の判定を保持します。`,
        );
        continue;
      }
      validatedByTicker.set(contentKey, judgment as WatchlistJudgment);
    } catch (error) {
      failedTickers.push(ticker);
      console.log(`[watchlist-judgment] 検証失敗: ${ticker} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 順序契約: 検証成功 → confluence ゲート → market/asOf 決定論付与（Pitfall 3/4）。
  // D-20/Pitfall 5: technicals にスナップショットが無い検証済み銘柄は buildSkippedJudgment で
  // 陽性 skip レコードに置き換える（省略ではなく明示記録）。raw 検証失敗銘柄（failedTickers）は
  // technicals の有無に関わらず判定欠落として output に含めない（読み取れた判定が無いため）。
  const processedJudgments: WatchlistJudgment[] = [];
  let downgradedCount = 0;
  for (const [normalizedTicker, judgment] of validatedByTicker) {
    const snapshot = technicalsBySymbol.get(normalizedTicker);
    if (snapshot === undefined) {
      processedJudgments.push(buildSkippedJudgment(judgment.ticker));
      continue;
    }
    const gated = applyConfluenceGate(judgment);
    if (gated.downgraded) {
      downgradedCount += 1;
    }
    processedJudgments.push({
      ...judgment,
      todayAction: gated.todayAction,
      market: deriveMarket(judgment.ticker),
      asOf: snapshot.asOf,
    });
  }

  // CR-03/D-20/Pitfall 5: data/watchlist.json のアクティブ銘柄のうち raw 判定が存在しない銘柄
  // （テクニカルスナップショット欠落等で Agent が起動されず raw ファイル自体が無い銘柄）にも
  // 陽性 skip レコードを合成する。これにより「今日データが無く判定不能」の銘柄が出力から
  // 無言で消えない。raw 検証失敗銘柄（failedTickers）は「読み取れた判定が無い」欠落として
  // FAIL マーカーで報告済みのため、skip 合成の対象にしない（検証失敗と判定不能を区別する）。
  // failedTickers はファイル名由来（`/` → `-` 置換済み）のため逆変換してから照合する。
  const coveredKeys = new Set([
    ...validatedByTicker.keys(),
    ...failedTickers.map((t) => normalizeHoldingSymbol(t.replace(/-/g, "/"))),
  ]);
  for (const activeTicker of activeTickers) {
    if (!coveredKeys.has(normalizeHoldingSymbol(activeTicker))) {
      processedJudgments.push(buildSkippedJudgment(activeTicker));
    }
  }

  // 前日比較（D-11、TIME-03）
  const { prev, corrupted: prevCorrupted } = await loadPrevJudgmentDefensive();
  if (prevCorrupted) {
    console.log("[watchlist-judgment] tmp/prev-watchlist-judgment.json が破損しています。前日比較をスキップします。");
  }
  // WR-03/D-14: 前日の status:"skipped" レコードは「判定不能」であり「wait と判定した」
  // わけではないため、比較対象から除外する（比較不能 undefined と 変化なし false の区別）。
  const prevComparable =
    prev === null ? null : prev.judgments.filter((j) => j.status !== "skipped");
  const withChanges = attachActionChanges(processedJudgments, prevComparable);
  // WR-03: 当日側の skipped レコードにも previousAction/actionChanged を付与しない
  // （判定不能な当日レコードに前日比較の意味を持たせない）。
  const finalJudgments = withChanges.map((j) => {
    if (j.status !== "skipped") return j;
    const { previousAction: _previousAction, actionChanged: _actionChanged, ...rest } = j;
    return rest;
  });

  const output: WatchlistJudgmentFile = {
    date,
    generatedAt: new Date().toISOString(),
    judgments: finalJudgments,
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(
    `[watchlist-judgment] 判定=${finalJudgments.length}件, skip=${finalJudgments.filter((j) => j.status === "skipped").length}件, 降格=${downgradedCount}件`,
  );

  if (failedTickers.length > 0) {
    console.error(
      `[STEP:watchlist-judgment:FAIL:${failedTickers.length}/${rawFiles.length}銘柄失敗（${failedTickers.join(", ")}）]`,
    );
  } else {
    console.error("[STEP:watchlist-judgment:OK]");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    console.error("Fatal error:", error);
    try {
      const fallbackDate = new Date().toISOString().slice(0, 10);
      await writeEmptyOutput(fallbackDate);
    } catch {
      // 出力先にも書けない場合は呼び出し元のフォールバックに委ねる
    }
    console.error("[STEP:watchlist-judgment:FAIL:fatal]");
    process.exitCode = 1;
  });
}
