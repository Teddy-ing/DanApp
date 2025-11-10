"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedViewConfig, SavedViewSummary } from "@/types/savedView";

type SavedViewsPanelProps = {
  current: SavedViewConfig;
  onApply: (view: SavedViewSummary) => void;
};

type ShareResponse = {
  shareId: string;
  shareUrl: string;
  view: SavedViewSummary;
};

type SaveResponse = {
  view: SavedViewSummary;
};

type ListResponse = {
  items: SavedViewSummary[];
};

type DeleteResponse = {
  ok: boolean;
};

export default function SavedViewsPanel(props: SavedViewsPanelProps) {
  const { current, onApply } = props;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedViewsQuery = useQuery({
    queryKey: ["savedViews"],
    queryFn: async () => {
      const res = await fetch("/api/views", { cache: "no-store" });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Failed to load saved views");
      }
      const data = (await res.json()) as ListResponse;
      return Array.isArray(data?.items) ? data.items : [];
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["savedViews"] }).catch(() => {});
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const payload = {
        name,
        symbols: current.symbols,
        base: current.base,
        horizon: current.horizon,
        custom: current.custom,
        viewMode: current.viewMode,
      };
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Failed to save view");
      }
      return (await res.json()) as SaveResponse;
    },
    onSuccess: () => {
      setMessage("View saved.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save view");
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const res = await fetch(`/api/views/${viewId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Failed to delete view");
      }
      return (await res.json()) as DeleteResponse;
    },
    onSuccess: () => {
      setMessage("View deleted.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete view");
      setMessage(null);
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const res = await fetch(`/api/views/${viewId}/share`, { method: "POST" });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Failed to generate share link");
      }
      return (await res.json()) as ShareResponse;
    },
    onSuccess: async (data) => {
      const shareUrl = data.shareUrl;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          setMessage("Share link copied to clipboard.");
        } else if (typeof window !== "undefined") {
          window.prompt("Copy this link", shareUrl);
          setMessage("Share link ready.");
        }
      } catch {
        if (typeof window !== "undefined") {
          window.prompt("Copy this link", shareUrl);
          setMessage("Share link ready.");
        }
      }
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to generate share link");
      setMessage(null);
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const res = await fetch(`/api/views/${viewId}/share`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Failed to disable sharing");
      }
      return (await res.json()) as { ok: boolean };
    },
    onSuccess: () => {
      setMessage("Sharing disabled.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to disable sharing");
      setMessage(null);
    },
  });

  const views = savedViewsQuery.data ?? [];
  const isLoading = savedViewsQuery.isLoading;
  const loadError = savedViewsQuery.error as Error | null;

  const saveDisabled = createMutation.isPending || current.symbols.length === 0;

  const suggestedName = useMemo(() => {
    if (current.symbols.length === 0) return "";
    const symbolsLabel = current.symbols.join(", ").slice(0, 40);
    const suffix = current.viewMode === "stats" ? " • Stats" : ` • ${current.horizon.toUpperCase()}`;
    return `${symbolsLabel}${suffix}`;
  }, [current.symbols, current.horizon, current.viewMode]);

  const handleSave = () => {
    if (current.symbols.length === 0) {
      setError("Add at least one symbol before saving a view.");
      setMessage(null);
      return;
    }
    const defaultName = suggestedName || "Saved view";
    const name = typeof window !== "undefined" ? window.prompt("Name this view", defaultName) : defaultName;
    if (!name) return;
    createMutation.mutate(name);
  };

  const handleApply = (view: SavedViewSummary) => {
    onApply(view);
    setMessage(`Loaded "${view.name}".`);
    setError(null);
  };

  const handleDelete = (view: SavedViewSummary) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete "${view.name}"?`);
      if (!confirmed) return;
    }
    deleteMutation.mutate(view.id);
  };

  return (
    <section className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Saved Views</h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-2.5 py-1 text-xs font-medium disabled:opacity-60"
        >
          {createMutation.isPending ? "Saving…" : "Save current"}
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        {message && <div className="text-emerald-600 dark:text-emerald-400">{message}</div>}
        {error && <div className="text-red-600 dark:text-red-400">{error}</div>}
        {loadError && <div className="text-red-600 dark:text-red-400">{loadError.message}</div>}
      </div>
      <div className="mt-3">
        {isLoading ? (
          <div className="text-xs text-gray-600 dark:text-gray-400">Loading views…</div>
        ) : views.length === 0 ? (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            No saved views yet. Save your current configuration to reuse it later or share it with a teammate.
          </div>
        ) : (
          <ul className="space-y-3">
            {views.map((view) => (
              <li key={view.id} className="border border-black/5 dark:border-white/10 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{view.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {view.symbols.join(", ")} · {view.horizon.toUpperCase()} · {view.viewMode === "stats" ? "Stats" : "Returns"}
                      {view.custom.enabled && ` · Custom ${view.custom.start}${view.custom.end ? ` → ${view.custom.end}` : ""}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Saved {new Date(view.updatedAt).toLocaleString()}
                      {view.shareId ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-[1px] text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Shared
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleApply(view)}
                      className="inline-flex items-center rounded-md bg-black text-white dark:bg-white dark:text-black px-2.5 py-1 text-xs font-medium"
                    >
                      Apply
                    </button>
                    <div className="flex items-center gap-1">
                      {view.shareId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => shareMutation.mutate(view.id)}
                            disabled={shareMutation.isPending}
                            className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-2 py-0.5 text-[11px] font-medium disabled:opacity-60"
                          >
                            {shareMutation.isPending ? "Copying…" : "Copy link"}
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeShareMutation.mutate(view.id)}
                            disabled={revokeShareMutation.isPending}
                            className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-2 py-0.5 text-[11px] font-medium disabled:opacity-60"
                          >
                            {revokeShareMutation.isPending ? "Working…" : "Stop"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => shareMutation.mutate(view.id)}
                          disabled={shareMutation.isPending}
                          className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-2 py-0.5 text-[11px] font-medium disabled:opacity-60"
                        >
                          {shareMutation.isPending ? "Sharing…" : "Share"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(view)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 disabled:opacity-60"
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


