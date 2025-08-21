import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getDecryptedRapidApiKey } from "@/lib/userKey";
import { fetchDailyCandles, fetchSplitsAndDividends, DailyCandle, DividendEvent, SplitEvent } from "@/providers/yahoo";
import { toNyDateString, nyTodayDateString } from "@/lib/calendar";

type Horizon = "5y" | "max" | "1y";
type SpanArg = { period1: number; period2?: number } | Horizon;

export async function POST(req: NextRequest) {
  // Auth and RapidAPI key
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return jsonError(401, "Unauthorized");
  const rapidApiKey = await getDecryptedRapidApiKey(userId);
  if (!rapidApiKey) return jsonError(400, "RapidAPI key not set. Save your key first.");

  const body = await req.json().catch(() => null) as null | {
    symbols?: string[];
    base?: number;
    horizon?: Horizon;
    custom?: { enabled: boolean; start: string; end: string };
  };
  if (!body || !Array.isArray(body.symbols) || body.symbols.length === 0) {
    return jsonError(400, "symbols is required");
  }
  const symbols = body.symbols.slice(0, 5);
  const base = typeof body.base === "number" && isFinite(body.base) ? body.base : 1000;
  const horizon: Horizon = body.horizon === "max" ? "max" : "5y";
  const custom = body.custom && body.custom.enabled ? body.custom : { enabled: false, start: "", end: "" };

  const span: SpanArg = custom.enabled
    ? { period1: Math.floor(new Date(custom.start + "T00:00:00Z").getTime() / 1000) || Math.floor(Date.now() / 1000) - 86400 * 365 * 5,
        period2: Math.floor(new Date(custom.end + "T23:59:59Z").getTime() / 1000) || Math.floor(Date.now() / 1000) }
    : horizon;

  // Fetch per symbol
  const perSymbol: Array<{ symbol: string; candles: DailyCandle[]; dividends: DividendEvent[]; splits: SplitEvent[] }> = [];
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i]!;
    const candles = await fetchDailyCandles(symbol, span, { rapidApiKey });
    const events = await fetchSplitsAndDividends(symbol, span, { rapidApiKey });
    perSymbol.push({ symbol, candles, dividends: events.dividends, splits: events.splits });
    if (i < symbols.length - 1) await new Promise((r) => setTimeout(r, 600));
  }

  // Build workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "DanApp";
  wb.created = new Date();

  // Summary sheet
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 50 },
  ];
  summary.addRow({ field: "Symbols", value: symbols.join(", ") });
  summary.addRow({ field: "Base (USD)", value: base });
  if (custom.enabled) {
    summary.addRow({ field: "Range", value: `${custom.start} → ${custom.end}` });
  } else {
    summary.addRow({ field: "Range", value: horizon });
  }

  const metricsHeaderRow = summary.addRow([]);
  metricsHeaderRow.getCell(1).value = "Symbol";
  metricsHeaderRow.getCell(2).value = "Start Date | End Date | Final Value | Total Return | CAGR";

  // Freeze header rows
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  // Per-symbol sheets and metric rows
  const unionCalendar = new Set<string>();
  for (const s of perSymbol) {
    const sheetName = s.symbol.substring(0, 31);
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Open", key: "open", width: 12 },
      { header: "Close", key: "close", width: 12 },
      { header: "Dividend/Share", key: "divps", width: 16 },
      { header: "Split Ratio", key: "split", width: 12 },
      { header: "Shares (pre)", key: "sharesPre", width: 16 },
      { header: "Reinvested Shares", key: "reinv", width: 18 },
      { header: "Total Shares", key: "shares", width: 14 },
      { header: "Value", key: "value", width: 14 },
      { header: "Return %", key: "ret", width: 12 },
    ];

    // Build row data aligned by trading dates
    const dateToOpen = new Map<string, number>();
    const dateToClose = new Map<string, number>();
    for (const c of s.candles) {
      if (typeof c.close === "number") {
        const d = toNyDateString(c.dateUtcSeconds ?? 0);
        unionCalendar.add(d);
        if (typeof c.open === "number") {
          dateToOpen.set(d, c.open);
        }
        dateToClose.set(d, c.close);
      }
    }
    const dateToDiv = new Map<string, number>();
    for (const d of s.dividends) {
      const key = toNyDateString(d.dateUtcSeconds ?? 0);
      dateToDiv.set(key, (dateToDiv.get(key) ?? 0) + (d.amount ?? 0));
    }
    const dateToSplit = new Map<string, number>();
    for (const sp of s.splits) {
      const key = toNyDateString(sp.dateUtcSeconds ?? 0);
      dateToSplit.set(key, (dateToSplit.get(key) ?? 1) * (sp.ratio || 1));
    }

    const dates = Array.from(dateToClose.keys());
    dates.sort((a, b) => a.localeCompare(b));

    // Add rows and formulas
    for (let idx = 0; idx < dates.length; idx += 1) {
      const date = dates[idx]!;
      const open = dateToOpen.get(date) ?? null;
      const close = dateToClose.get(date) ?? null;
      const div = dateToDiv.get(date) ?? 0;
      const split = dateToSplit.get(date) ?? 1;
      ws.addRow({ date, open, close, divps: div, split });
    }

    // Apply number formats
    ws.getColumn(2).numFmt = "$#,##0.00"; // Open
    ws.getColumn(3).numFmt = "$#,##0.00"; // Close
    ws.getColumn(4).numFmt = "$#,##0.0000"; // Dividend/share
    ws.getColumn(5).numFmt = "0.00"; // Split ratio
    ws.getColumn(6).numFmt = "0.0000"; // Shares pre
    ws.getColumn(7).numFmt = "0.0000"; // Reinvested shares
    ws.getColumn(8).numFmt = "0.0000"; // Total shares
    ws.getColumn(9).numFmt = "$#,##0.00"; // Value
    ws.getColumn(10).numFmt = "0.00%"; // Return %

    const baseCell = summary.getCell("B2");
    baseCell.value = base;

    const firstDataRow = 2;
    const lastRow = ws.rowCount;
    for (let r = firstDataRow; r <= lastRow; r += 1) {
      const isFirst = r === firstDataRow;
      const prevTotalSharesRef = `H${r - 1}`;
      const splitRef = `E${r}`;
      const openRef = `B${r}`;
      const closeRef = `C${r}`;
      const prevDivRef = `D${r - 1}`;
      const divRef = `D${r}`;
      const sharesPreRef = `F${r}`;
      const reinvestRef = `G${r}`;
      const totalSharesRef = `H${r}`;
      const valueRef = `I${r}`;
      const returnRef = `J${r}`;

      ws.getCell(sharesPreRef).value = {
        formula: isFirst ? `Summary!$B$2/${closeRef}` : `${prevTotalSharesRef}*${splitRef}`,
      };
      // Reinvest using previous row's dividend cash at today's open
      ws.getCell(reinvestRef).value = { formula: `IF(${r}=${firstDataRow},0,IFERROR(${prevDivRef}*${prevTotalSharesRef}/${openRef},0))` };
      ws.getCell(totalSharesRef).value = { formula: `${sharesPreRef}+${reinvestRef}` };
      ws.getCell(valueRef).value = { formula: `${totalSharesRef}*${closeRef}` };
      ws.getCell(returnRef).value = { formula: `${valueRef}/Summary!$B$2-1` };
    }

    // Add metrics to summary sheet for this symbol
    const metricsRow = summary.addRow([]);
    metricsRow.getCell(1).value = s.symbol;
    const startDateFormula = `INDEX('${sheetName}'!A:A,2)`;
    const endDateFormula = `INDEX('${sheetName}'!A:A,COUNTA('${sheetName}'!A:A))`;
    const finalValueFormula = `INDEX('${sheetName}'!I:I,COUNTA('${sheetName}'!A:A))`;
    const totalReturnFormula = `${finalValueFormula}/$B$2-1`;
    const daysFormula = `DATEVALUE(${endDateFormula})-DATEVALUE(${startDateFormula})`;
    const cagrFormula = `IF(${daysFormula}>0,POWER(${finalValueFormula}/$B$2,${daysFormula}/365)-1,0)`;
    metricsRow.getCell(2).value = { formula: `${startDateFormula}&" | "&${endDateFormula}&" | "&TEXT(${finalValueFormula},"$#,##0.00")&" | "&TEXT(${totalReturnFormula},"0.00%")&" | "&TEXT(${cagrFormula},"0.00%")` };
  }

  // Forward returns sheet: union calendar with $ and % to present per symbol
  const forwardDates = Array.from(unionCalendar);
  forwardDates.sort((a, b) => a.localeCompare(b));
  if (forwardDates.length > 0) {
    const forward = wb.addWorksheet("Forward");
    const forwardColumns: Array<{ header: string; key: string; width?: number }> = [{ header: "Date", key: "date", width: 12 }];
    for (const s of perSymbol) {
      forwardColumns.push({ header: `${s.symbol} $`, key: `${s.symbol}_$`, width: 14 });
      forwardColumns.push({ header: `${s.symbol} %`, key: `${s.symbol}_pct`, width: 12 });
    }
    forward.columns = forwardColumns as any;

    // number formats
    for (let idx = 0; idx < perSymbol.length; idx += 1) {
      const baseCol = 2 + idx * 2;
      forward.getColumn(baseCol).numFmt = "$#,##0.00"; // $
      forward.getColumn(baseCol + 1).numFmt = "0.00%"; // %
    }

    // Rows
    for (let r = 0; r < forwardDates.length; r += 1) {
      const rowIndex = r + 2;
      const date = forwardDates[r]!;
      const row = forward.addRow({ date });
      // Fill formulas per symbol
      for (let si = 0; si < perSymbol.length; si += 1) {
        const s = perSymbol[si]!;
        const sheetName = s.symbol.substring(0, 31);
        const startVal = `IFERROR(INDEX('${sheetName}'!I:I, MATCH($A${rowIndex}, '${sheetName}'!A:A, 0)), NA())`;
        const endVal = `INDEX('${sheetName}'!I:I, COUNTA('${sheetName}'!A:A))`;
        const dollarCell = forward.getCell(rowIndex, 2 + si * 2);
        const pctCell = forward.getCell(rowIndex, 3 + si * 2);
        dollarCell.value = { formula: `Summary!$B$2*IFERROR(${endVal}/(${startVal})-1, NA())` };
        pctCell.value = { formula: `IFERROR(${endVal}/(${startVal})-1, NA())` };
      }
    }

    // Freeze header
    forward.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Build filename
  const nyToday = nyTodayDateString();
  const filename = `${symbols.join(', ')} ${nyToday} returns.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function jsonError(status: number, message: string) {
  return new NextResponse(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}


