'use client';

import { useCallback, useMemo, useState } from 'react';
import { validateUsTickerFormat } from '@/lib/ticker';

type Horizon = '5y' | 'max';

export default function InputsPanel() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<number>(1000);
  const [horizon, setHorizon] = useState<Horizon>('5y');

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
      </div>
    </section>
  );
}


