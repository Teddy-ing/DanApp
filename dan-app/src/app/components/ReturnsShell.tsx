"use client";

import { useEffect, useState } from 'react';
import InputsPanel from '@/app/components/InputsPanel';
import ReturnsView from '@/app/components/ReturnsView';
import DividendsPanel from '@/app/components/DividendsPanel';
import StatsPanel from '@/app/components/StatsPanel';

export default function ReturnsShell() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [base, setBase] = useState<number>(1000);
  const [horizon, setHorizon] = useState<'5y' | 'max'>('5y');
  const [custom, setCustom] = useState<{ enabled: boolean; start: string; end: string }>({ enabled: false, start: '', end: '' });
  const [view, setView] = useState<'returns' | 'stats'>('returns');
  const hasQuery = symbols.length > 0;

  // Master left panel open/close state with responsive default and persistence
  const [leftOpen, setLeftOpen] = useState<boolean>(true);
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('ui.leftPanel.open') : null;
      if (stored === 'true' || stored === 'false') {
        setLeftOpen(stored === 'true');
        return;
      }
      // Default: open on desktop (md+), closed on mobile
      const isMdUp = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
      setLeftOpen(isMdUp);
    } catch {
      // Fallback to open
      setLeftOpen(true);
    }
  }, []);
  const toggleLeftOpen = (next: boolean) => {
    setLeftOpen(next);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('ui.leftPanel.open', String(next));
    } catch {}
  };

  return (
    <div className="w-full px-4">
      {!hasQuery ? (
        <div className="max-w-md mx-auto">
          <InputsPanel initialSymbols={symbols} initialBase={base} initialHorizon={horizon} initialCustom={custom} onFetch={({ symbols, base, horizon, custom }) => {
            setSymbols(symbols);
            setBase(base);
            setHorizon(horizon);
            setCustom(custom);
            setView('returns');
          }} onStats={({ symbols, horizon, custom }) => {
            setSymbols(symbols);
            setHorizon(horizon);
            setCustom(custom);
            setView('stats');
          }} />
        </div>
      ) : (
        <div className={`max-w-7xl mx-auto grid grid-cols-1 ${leftOpen ? 'md:grid-cols-[320px_1fr]' : 'md:grid-cols-1'} gap-8`}>
          {leftOpen && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div />
                <button
                  type="button"
                  onClick={() => toggleLeftOpen(false)}
                  className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 hover:underline"
                >
                  <span className="text-base leading-none">‹</span>
                  Hide panel
                </button>
              </div>
              <InputsPanel initialSymbols={symbols} initialBase={base} initialHorizon={horizon} initialCustom={custom} onFetch={({ symbols, base, horizon, custom }) => {
                setSymbols(symbols);
                setBase(base);
                setHorizon(horizon);
                setCustom(custom);
                setView('returns');
              }} onStats={({ symbols, horizon, custom }) => {
                setSymbols(symbols);
                setHorizon(horizon);
                setCustom(custom);
                setView('stats');
              }} />
              {view === 'returns' && (
                <div className="mt-4">
                  <DividendsPanel symbols={symbols} horizon={horizon} custom={custom} />
                </div>
              )}
            </div>
          )}
          <div>
            {!leftOpen && (
              <div className="flex items-center justify-start mb-2">
                <button
                  type="button"
                  onClick={() => toggleLeftOpen(true)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-black/10 dark:border-white/15 bg-white/90 dark:bg-neutral-900/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-900"
                >
                  <span className="text-base leading-none">›</span>
                  Show panel
                </button>
              </div>
            )}
            {view === 'returns' ? (
              <ReturnsView symbols={symbols} base={base} horizon={horizon} custom={custom} />
            ) : (
              <StatsPanel symbols={symbols} horizon={horizon} custom={custom} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}



