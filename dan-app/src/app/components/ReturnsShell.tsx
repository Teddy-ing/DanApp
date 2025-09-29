"use client";

import { useState } from 'react';
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
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8">
          <div>
            <div>
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
            {view === 'returns' && (
              <div className="mt-4">
                <DividendsPanel symbols={symbols} horizon={horizon} custom={custom} />
              </div>
            )}
          </div>
          <div>
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



