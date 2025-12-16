import { load } from "cheerio";
import { fetchWithTimeout } from "@/lib/http";

export type YieldmaxTicker = {
  symbol: string;
  name: string;
  roc: number | null;
  rocRaw?: string | null;
};

export type YieldmaxCategory = {
  title: string;
  items: YieldmaxTicker[];
};

// Canonical ordering and names to keep UI stable if the site markup changes.
export const YIELDMAX_CANONICAL: YieldmaxCategory[] = [
  {
    title: "YieldMax® Single Stock Option Income ETFs",
    items: [
      { symbol: "ABNY", name: "YieldMax® ABNB Option Income Strategy ETF", roc: null },
      { symbol: "AIYY", name: "YieldMax® AI Option Income Strategy ETF", roc: null },
      { symbol: "AMDY", name: "YieldMax® AMD Option Income Strategy ETF", roc: null },
      { symbol: "AMZY", name: "YieldMax® AMZN Option Income ETF", roc: null },
      { symbol: "APLY", name: "YieldMax® AAPL Option Income ETF", roc: null },
      { symbol: "BABO", name: "YieldMax® BABA Option Income Strategy ETF", roc: null },
      { symbol: "BRKC", name: "YieldMax® BRK.B Option Income ETF", roc: null },
      { symbol: "CONY", name: "YieldMax® COIN Option Income Strategy ETF", roc: null },
      { symbol: "CRCO", name: "YieldMax® CRCL Option Income Strategy ETF", roc: null },
      { symbol: "CVNY", name: "YieldMax® CVNA Option Income Strategy ETF", roc: null },
      { symbol: "DISO", name: "YieldMax® DIS Option Income ETF", roc: null },
      { symbol: "DRAY", name: "YieldMax® DKNG Option Income Strategy ETF", roc: null },
      { symbol: "FBY", name: "YieldMax® META Option Income ETF", roc: null },
      { symbol: "GDXY", name: "YieldMax® Gold Miners Option Income Strategy ETF", roc: null },
      { symbol: "GMEY", name: "YieldMax® GME Option Income Strategy ETF", roc: null },
      { symbol: "GOOY", name: "YieldMax® GOOGL Option Income ETF", roc: null },
      { symbol: "HIYY", name: "YieldMax® HIMS Option Income Strategy ETF", roc: null },
      { symbol: "HOOY", name: "YieldMax® HOOD Option Income Strategy ETF", roc: null },
      { symbol: "JPMO", name: "YieldMax® JPM Option Income Strategy ETF", roc: null },
      { symbol: "MARO", name: "YieldMax® MARA Option Income Strategy ETF", roc: null },
      { symbol: "MRNY", name: "YieldMax® MRNA Option Income Strategy ETF", roc: null },
      { symbol: "MSFO", name: "YieldMax® MSFT Option Income ETF", roc: null },
      { symbol: "MSTY", name: "YieldMax® MSTR Option Income Strategy ETF", roc: null },
      { symbol: "NFLY", name: "YieldMax® NFLX Option Income Strategy ETF", roc: null },
      { symbol: "NVDY", name: "YieldMax® NVDA Option Income Strategy ETF", roc: null },
      { symbol: "OARK", name: "YieldMax® Innovation Option Income Strategy ETF", roc: null },
      { symbol: "PLTY", name: "YieldMax® PLTR Option Income Strategy ETF", roc: null },
      { symbol: "PYPY", name: "YieldMax® PYPL Option Income Strategy ETF", roc: null },
      { symbol: "RBLY", name: "YieldMax® RBLX Option Income Strategy ETF", roc: null },
      { symbol: "RDYY", name: "YieldMax® RDDT Option Income Strategy ETF", roc: null },
      { symbol: "SMCY", name: "YieldMax® SMCI Option Income Strategy ETF", roc: null },
      { symbol: "SNOY", name: "YieldMax® SNOW Option Income Strategy ETF", roc: null },
      { symbol: "TSLY", name: "YieldMax® TSLA Option Income Strategy ETF", roc: null },
      { symbol: "TSMY", name: "YieldMax® TSM Option Income Strategy ETF", roc: null },
      { symbol: "XOMO", name: "YieldMax® XOM Option Income ETF", roc: null },
      { symbol: "XYZY", name: "YieldMax® XYZ Option Income Strategy ETF", roc: null },
      { symbol: "YBIT", name: "YieldMax® Bitcoin Option Income Strategy ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Short Single Stock Option Income ETFs",
    items: [
      { symbol: "CRSH", name: "YieldMax® Short TSLA Option Income Strategy ETF", roc: null },
      { symbol: "DIPS", name: "YieldMax® Short NVDA Option Income Strategy ETF", roc: null },
      { symbol: "FIAT", name: "YieldMax® Short COIN Option Income Strategy ETF", roc: null },
      { symbol: "WNTR", name: "YieldMax® MSTR Short Option Income Strategy ETF", roc: null },
      { symbol: "YQQQ", name: "YieldMax® Short N100 Option Income Strategy ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Fund of Funds ETFs",
    items: [
      { symbol: "YMAG", name: "YieldMax® Magnificent 7 Fund of Option Income ETF", roc: null },
      { symbol: "YMAX", name: "YieldMax® Universe Fund of Option Income ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Ultra ETFs",
    items: [
      { symbol: "SLTY", name: "YieldMax® Ultra Short Option Income Strategy ETF", roc: null },
      { symbol: "ULTY", name: "YieldMax® Ultra Option Income Strategy ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Dorsey Wright ETFs",
    items: [
      { symbol: "FEAT", name: "YieldMax® Dorsey Wright Featured 5 Income ETF", roc: null },
      { symbol: "FIVY", name: "YieldMax® Dorsey Wright Hybrid 5 Income ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® 0DTE ETFs",
    items: [
      { symbol: "QDTY", name: "YieldMax® Nasdaq 100 0DTE Covered Call Strategy ETF", roc: null },
      { symbol: "RDTY", name: "YieldMax® R2000 0DTE Covered Call Strategy ETF", roc: null },
      { symbol: "SDTY", name: "YieldMax® SP 500 0DTE Covered Call Strategy ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Portfolio ETFs",
    items: [
      { symbol: "CHPY", name: "YieldMax® Semiconductor Portfolio Option Income ETF", roc: null },
      { symbol: "GPTY", name: "YieldMax® AI and Tech Portfolio Option Income ETF", roc: null },
      { symbol: "LFGY", name: "YieldMax® Crypto Industry and Tech Portfolio Option Income ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Target 12™ ETFs",
    items: [
      { symbol: "BIGY", name: "YieldMax® Target 12™ Big 50 Option Income ETF", roc: null },
      { symbol: "RNTY", name: "YieldMax® Target 12™ Real Estate Option Income ETF", roc: null },
      { symbol: "SOXY", name: "YieldMax® Target 12™ Semiconductor Option Income ETF", roc: null },
    ],
  },
  {
    title: "YieldMax® Performance & Distribution Target 25™ ETFs",
    items: [
      { symbol: "MSST", name: "YieldMax® MSTR Performance & Distribution Target 25™ ETF", roc: null },
      { symbol: "NVIT", name: "YieldMax® NVDA Performance & Distribution Target 25™ ETF", roc: null },
      { symbol: "TEST", name: "YieldMax® TSLA Performance & Distribution Target 25™ ETF", roc: null },
    ],
  },
];

const PAGE_URL = "https://yieldmaxetfs.com/our-etfs/";

export async function scrapeYieldmaxRoc(): Promise<{ fetchedAtIso: string; categories: YieldmaxCategory[] }> {
  const res = await fetchWithTimeout(PAGE_URL, { timeoutMs: 8000, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`YieldMax scrape failed with status ${res.status}`);
  }
  const html = await res.text();
  const $ = load(html);

  const categories: YieldmaxCategory[] = [];
  $("h2").each((_, el) => {
    const title = $(el).text().trim();
    if (!title.toLowerCase().includes("yieldmax")) return;
    const table = $(el).nextAll("table").first();
    if (!table || table.length === 0) return;
    const headerRow = table.find("thead tr").first();
    const headerCells = (headerRow.length ? headerRow : table.find("thead")).find("th");
    const columnIndexes: Record<"ticker" | "name" | "roc", number | null> = { ticker: null, name: null, roc: null };
    headerCells.each((idx, th) => {
      const text = $(th).text().toLowerCase();
      if (text.includes("ticker")) columnIndexes.ticker = idx;
      if (text.includes("etf name")) columnIndexes.name = idx;
      if (text.includes("roc")) columnIndexes.roc = idx;
    });
    if (columnIndexes.ticker == null || columnIndexes.roc == null) return;
    const rows = table.find("tbody tr");
    const items: YieldmaxTicker[] = [];
    rows.each((_, row) => {
      const cells = $(row).find("td");
      const tickerCell = cells.eq(columnIndexes.ticker as number).text().trim();
      if (!tickerCell) return;
      const symbol = tickerCell.toUpperCase();
      const name =
        columnIndexes.name != null ? cells.eq(columnIndexes.name).text().trim() || symbol : symbol;
      const rocText = columnIndexes.roc != null ? cells.eq(columnIndexes.roc).text().trim() : "";
      const roc = parseRocValue(rocText);
      items.push({ symbol, name, roc, rocRaw: rocText || null });
    });
    if (items.length > 0) {
      categories.push({ title, items });
    }
  });

  return { fetchedAtIso: new Date().toISOString(), categories };
}

function parseRocValue(text: string): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  return value;
}

