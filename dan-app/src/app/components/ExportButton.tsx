"use client";

import { useCallback, useState } from "react";

type Horizon = "5y" | "max";

export default function ExportButton() {
  const [downloading, setDownloading] = useState(false);

  const onClick = useCallback(async () => {
    try {
      setDownloading(true);
      const stored = (typeof window !== 'undefined' ? window.localStorage.getItem('lastFetchParams') : null) || "{}";
      const params = JSON.parse(stored) as { symbols?: string[]; base?: number; horizon?: Horizon; custom?: { enabled: boolean; start: string; end: string } };
      if (!params.symbols || params.symbols.length === 0) {
        alert('Fetch returns first to set export parameters.');
        return;
      }
      const res = await fetch('/api/export/xlsx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try to honor server-provided filename from Content-Disposition
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
      const suggested = m ? m[1] : undefined;
      a.download = suggested || 'returns.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setDownloading(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
      disabled={downloading}
      title="Export current view to Excel"
    >
      {downloading ? 'Exporting…' : 'Export to Excel'}
    </button>
  );
}


