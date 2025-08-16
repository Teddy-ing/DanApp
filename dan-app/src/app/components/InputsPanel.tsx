'use client';

import { useCallback, useMemo, useState } from 'react';
import { validateUsTickerFormat } from '@/lib/ticker';
import { useQuery } from '@tanstack/react-query';
import ReturnsChart from '@/app/components/ReturnsChart';
import PriceChart from '@/app/components/PriceChart';

type Horizon = '5y' | 'max';

export default function InputsPanel() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<number>(1000);
  const [horizon, setHorizon] = useState<Horizon>('5y');
  const [requested, setRequested] = useState(false);

  const canAddMore = symbols.length < 5;

  const addSymbol = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      try {
        const normalized = validateUsTickerFormat(trimmed);
        if (symbols.includes(normalized)) {
          setError(null);
          return; // dedupe, preserve original order
        }
        if (!canAddMore) {
          setError('Maximum of 5 symbols');
          return;
        }
        setSymbols((prev) => [...prev, normalized]);
        setInput('');
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid ticker';
        setError(msg);
      }
    },
    [symbols, canAddMore]
  );

  const removeSymbol = useCallback((sym: string) => {
    setSymbols((prev) => prev.filter((s) => s !== sym));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        e.preventDefault();
        addSymbol(input);
        return;
      }
      if (e.key === 'Backspace' && input.length === 0 && symbols.length > 0) {
        e.preventDefault();
        removeSymbol(symbols[symbols.length - 1]);
      }
    },
    [addSymbol, input, symbols, removeSymbol]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      const parts = text.split(/[\s,]+/).filter(Boolean);
      if (parts.length > 0) {
        e.preventDefault();
        for (const part of parts) {
          addSymbol(part);
        }
      }
    },
    [addSymbol]
  );

  const helperText = useMemo(() => {
    if (error) return error;
    return 'Enter to add. Max 5 symbols. Format: AAPL, MSFT, BRK-B';
  }, [error]);

  function onChangeBase(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const asInt = Math.max(1, parseInt(value || '0', 10));
    if (!Number.isNaN(asInt)) setBase(asInt);
  }

  return (
    <section className="w-full rounded-xl border border-black/10 dark:border-white/15 p-4 sm:p-5 bg-white dark:bg-neutral-900">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Symbols</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {symbols.map((sym) => (
              <span key={sym} className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-sm">
                {sym}
                <button
                  type="button"
                  aria-label={`Remove ${sym}`}
                  onClick={() => removeSymbol(sym)}
                  className="-mr-1 rounded-full px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={symbols.length === 0 ? 'Type a ticker and press Enter…' : 'Add another…'}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
          />
          <p className={`mt-1 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>{helperText}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Base amount (USD)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={base}
              onChange={onChangeBase}
              className="w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Horizon</label>
            <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden">
              <button
                type="button"
                onClick={() => setHorizon('5y')}
                className={`px-3 py-1.5 text-sm ${horizon === '5y' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
              >
                5y
              </button>
              <button
                type="button"
                onClick={() => setHorizon('max')}
                className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/15 ${horizon === 'max' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
              >
                max
              </button>
            </div>
          </div>
        </div>

        <FetchReturns
          symbols={symbols}
          base={base}
          horizon={horizon}
          requested={requested}
          onRequest={() => setRequested(true)}
        />
      </div>
    </section>
  );
}

function FetchReturns(props: {
  symbols: string[];
  base: number;
  horizon: Horizon;
  requested: boolean;
  onRequest: () => void;
}) {
  const { symbols, base, horizon, requested, onRequest } = props;
  const queryKey = useMemo(() => ['returns', { symbols, base, horizon }], [symbols, base, horizon]);
  const queryEnabled = requested && symbols.length > 0;

  const query = useQuery({
    queryKey,
    enabled: queryEnabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('symbols', symbols.join(','));
      params.set('horizon', horizon);
      params.set('base', String(base));
      const res = await fetch(`/api/returns?${params.toString()}`, { headers: { 'accept-encoding': 'gzip' }, cache: 'no-store' });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Request failed');
      }
      return data as { meta: unknown; dates: string[]; series: Array<{ symbol: string; value: (number|null)[]; pct: (number|null)[] }>; };
    },
  });

  // Trigger prices only after returns succeeds to avoid upstream 429 due to concurrent calls
  const priceQuery = useQuery({
    queryKey: ['prices', { symbols, range: horizon }],
    enabled: query.isSuccess,
    queryFn: async () => {
      // Small delay to space upstream requests after returns
      await new Promise((r) => setTimeout(r, 1200));
      const params = new URLSearchParams();
      params.set('symbols', symbols.join(','));
      // Map horizon to a sensible range for price chart
      params.set('range', horizon);
      const res = await fetch(`/api/prices?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Prices request failed');
      return data as { items: Array<{ symbol: string; range: string; candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> }> };
    },
  });

  const hasParams = symbols.length > 0;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => onRequest()}
        disabled={!hasParams || query.isFetching}
        className="inline-flex items-center rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {query.isFetching ? 'Fetching…' : 'Fetch returns'}
      </button>
      <div className="mt-2 text-sm">
        {!hasParams && <p className="text-gray-600 dark:text-gray-400">Add at least one symbol to enable fetch.</p>}
        {query.error && <p className="text-red-600 dark:text-red-400">{(query.error as Error).message}</p>}
        {query.isSuccess && (
          <p className="text-gray-700 dark:text-gray-300">Loaded {query.data.dates.length} dates for {query.data.series.length} symbols.</p>
        )}
      </div>

      {query.isSuccess && (
        <div className="mt-4">
          <ReturnsChart dates={query.data.dates} series={query.data.series} />
        </div>
      )}

      {priceQuery.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{(priceQuery.error as Error).message}</p>}
      {priceQuery.isSuccess && (
        <div className="mt-4">
          <PriceChart items={priceQuery.data.items.map((i) => ({ symbol: i.symbol, candles: i.candles }))} />
        </div>
      )}
    </div>
  );
}


