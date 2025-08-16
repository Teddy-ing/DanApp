'use client';

import { useEffect, useMemo, useState } from 'react';

type SaveResponse = { ok?: boolean; error?: { message: string } };
type StatusResponse = { hasKey: boolean } | { error: { message: string } };

export default function KeyModal() {
  const [open, setOpen] = useState(false);
  const [rapidapiKey, setRapidapiKey] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch('/api/user/key', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return; // keep previous state on auth/network issues
        const data: StatusResponse = await res.json();
        if (!cancelled && 'hasKey' in data) {
          setHasKey(Boolean(data.hasKey));
        }
      } catch {
        // ignore; keep existing indicator
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(id);
    }
  }, [toast]);

  const statusBadge = useMemo(() => {
    if (hasKey === null) return null;
    return hasKey ? (
      <span className="ml-2 inline-flex items-center rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 px-2 py-0.5 text-xs">
        Key saved
      </span>
    ) : (
      <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-200 px-2 py-0.5 text-xs">
        No key
      </span>
    );
  }, [hasKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rapidapiKey }),
      });
      const data: SaveResponse & { persisted?: boolean } = await res.json();
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error?.message || 'Failed to save key');
      }
      setHasKey(true);
      setToast('RapidAPI key saved');
      setOpen(false);
      setRapidapiKey('');
      if (data?.persisted === false) {
        setToast('Saved, but could not verify persistence');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        Connect RapidAPI key
      </button>
      {hasKey === null ? (
        <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-200 px-2 py-0.5 text-xs">Checking…</span>
      ) : (
        statusBadge
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-2 text-sm shadow">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-lg p-6 mx-4">
            <h2 className="text-base font-semibold">Connect RapidAPI key</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Paste your RapidAPI key. It is encrypted and stored securely on the server.
            </p>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <input
                type="password"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={rapidapiKey}
                onChange={(e) => setRapidapiKey(e.target.value)}
                placeholder="rapidapiKey_..."
                className="w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
              />
              {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || rapidapiKey.trim().length === 0}
                  className="inline-flex items-center rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Save key'}
                </button>
              </div>
            </form>
            <div className="mt-4 border-t border-black/10 dark:border-white/15 pt-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/user/key/debug', { cache: 'no-store' });
                    const json = await res.json();
                    alert(JSON.stringify(json, null, 2));
                  } catch (e) {
                    alert('Failed to run diagnostics');
                  }
                }}
                className="text-xs underline text-gray-600 dark:text-gray-300 hover:opacity-80"
              >
                Run key diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


