import { randomBytes, randomUUID } from "crypto";
import { createRedisClient } from "@/lib/redis";
import { validateUsTickerFormat } from "@/lib/ticker";
import type { SavedViewConfig, SavedViewCustomRange, SavedViewHorizon, SavedViewMode, SavedViewSummary, SharedSavedViewPayload } from "@/types/savedView";

export class SavedViewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "SavedViewError";
  }
}

type InternalSavedViewRecord = SavedViewConfig & {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  shareId?: string | null;
};

const USER_INDEX_KEY = (userId: string) => `user:${userId}:views`;
const VIEW_KEY = (viewId: string) => `savedView:${viewId}`;
const SHARE_KEY = (shareId: string) => `viewShare:${shareId}`;

function normalizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) {
    throw new SavedViewError("Name is required");
  }
  if (name.length > 80) {
    throw new SavedViewError("Name must be 80 characters or fewer");
  }
  return name;
}

function normalizeSymbols(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new SavedViewError("Symbols must be an array");
  }
  if (raw.length === 0) {
    throw new SavedViewError("At least one symbol is required");
  }
  if (raw.length > 5) {
    throw new SavedViewError("Maximum of 5 symbols allowed");
  }
  const normalized: string[] = [];
  for (const symbol of raw) {
    if (typeof symbol !== "string") {
      throw new SavedViewError("Symbols must be strings");
    }
    const valid = validateUsTickerFormat(symbol);
    if (!normalized.includes(valid)) {
      normalized.push(valid);
    }
  }
  return normalized;
}

function normalizeBase(raw: unknown): number {
  const baseNumber = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(baseNumber) || baseNumber <= 0) {
    throw new SavedViewError("Base amount must be a positive number");
  }
  const rounded = Math.round(baseNumber);
  if (rounded < 1) {
    throw new SavedViewError("Base amount must be at least 1");
  }
  if (rounded > 100000000) {
    throw new SavedViewError("Base amount is too large");
  }
  return rounded;
}

function normalizeHorizon(raw: unknown): SavedViewHorizon {
  return raw === "max" ? "max" : "5y";
}

function normalizeCustom(raw: unknown): SavedViewCustomRange {
  const input =
    typeof raw === "object" && raw != null
      ? {
          enabled: Boolean((raw as { enabled?: unknown }).enabled),
          start: typeof (raw as { start?: unknown }).start === "string" ? ((raw as { start?: string }).start ?? "").trim() : "",
          end: typeof (raw as { end?: unknown }).end === "string" ? ((raw as { end?: string }).end ?? "").trim() : "",
        }
      : { enabled: false, start: "", end: "" };

  if (!input.enabled) {
    return { enabled: false, start: "", end: "" };
  }

  const start = input.start;
  const end = input.end;
  if (!start) {
    throw new SavedViewError("Custom range start date is required when enabled");
  }
  if (start.length !== 10) {
    throw new SavedViewError("Custom range start date must be YYYY-MM-DD");
  }
  if (end && end.length !== 10) {
    throw new SavedViewError("Custom range end date must be YYYY-MM-DD");
  }
  return { enabled: true, start, end: end || "" };
}

function normalizeViewMode(raw: unknown): SavedViewMode {
  return raw === "stats" ? "stats" : "returns";
}

function toSummary(record: InternalSavedViewRecord): SavedViewSummary {
  const { userId: _userId, ...rest } = record;
  void _userId;
  return {
    ...rest,
    shareId: rest.shareId ?? null,
  };
}

async function loadRecord(viewId: string): Promise<InternalSavedViewRecord | null> {
  const redis = createRedisClient();
  return await redis.getJson<InternalSavedViewRecord>(VIEW_KEY(viewId));
}

async function persistRecord(record: InternalSavedViewRecord): Promise<void> {
  const redis = createRedisClient();
  await redis.setJson(VIEW_KEY(record.id), record);
}

function generateShareId(): string {
  return randomBytes(6).toString("base64url");
}

export async function listSavedViews(userId: string): Promise<SavedViewSummary[]> {
  const redis = createRedisClient();
  const ids = (await redis.getJson<string[]>(USER_INDEX_KEY(userId))) ?? [];
  const results: SavedViewSummary[] = [];
  const validIds: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id) continue;
    const record = await redis.getJson<InternalSavedViewRecord>(VIEW_KEY(id));
    if (record && record.userId === userId) {
      results.push(toSummary(record));
      validIds.push(id);
    }
  }
  if (validIds.length !== ids.length) {
    await redis.setJson(USER_INDEX_KEY(userId), validIds);
  }
  results.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return results;
}

export async function createSavedView(userId: string, payload: Partial<SavedViewConfig> & { name?: unknown }): Promise<SavedViewSummary> {
  const name = normalizeName(payload.name);
  const symbols = normalizeSymbols(payload.symbols);
  const base = normalizeBase(payload.base);
  const horizon = normalizeHorizon(payload.horizon);
  const custom = normalizeCustom(payload.custom);
  const viewMode = normalizeViewMode(payload.viewMode);

  const now = new Date().toISOString();
  const record: InternalSavedViewRecord = {
    id: randomUUID(),
    userId,
    name,
    symbols,
    base,
    horizon,
    custom,
    viewMode,
    createdAt: now,
    updatedAt: now,
  };
  const redis = createRedisClient();
  await redis.setJson(VIEW_KEY(record.id), record);
  const index = await redis.getJson<string[]>(USER_INDEX_KEY(userId));
  const existing = Array.isArray(index) ? index.filter((id) => typeof id === "string") : [];
  if (!existing.includes(record.id)) {
    existing.unshift(record.id);
  }
  await redis.setJson(USER_INDEX_KEY(userId), existing);
  return toSummary(record);
}

export async function updateSavedView(userId: string, viewId: string, payload: Partial<SavedViewConfig> & { name?: unknown }): Promise<SavedViewSummary> {
  const existing = await loadRecord(viewId);
  if (!existing || existing.userId !== userId) {
    throw new SavedViewError("Saved view not found", 404);
  }

  const updated: InternalSavedViewRecord = { ...existing };
  if (payload.name !== undefined) {
    updated.name = normalizeName(payload.name);
  }
  if (payload.symbols !== undefined) {
    updated.symbols = normalizeSymbols(payload.symbols);
  }
  if (payload.base !== undefined) {
    updated.base = normalizeBase(payload.base);
  }
  if (payload.horizon !== undefined) {
    updated.horizon = normalizeHorizon(payload.horizon);
  }
  if (payload.custom !== undefined) {
    updated.custom = normalizeCustom(payload.custom);
  }
  if (payload.viewMode !== undefined) {
    updated.viewMode = normalizeViewMode(payload.viewMode);
  }
  updated.updatedAt = new Date().toISOString();
  await persistRecord(updated);
  return toSummary(updated);
}

export async function deleteSavedView(userId: string, viewId: string): Promise<void> {
  const existing = await loadRecord(viewId);
  if (!existing || existing.userId !== userId) {
    throw new SavedViewError("Saved view not found", 404);
  }
  const redis = createRedisClient();
  await redis.raw.del(VIEW_KEY(viewId));
  if (existing.shareId) {
    await redis.raw.del(SHARE_KEY(existing.shareId));
  }
  const ids = (await redis.getJson<string[]>(USER_INDEX_KEY(userId))) ?? [];
  const filtered = ids.filter((id) => id !== viewId);
  await redis.setJson(USER_INDEX_KEY(userId), filtered);
}

export async function enableSavedViewShare(userId: string, viewId: string): Promise<{ shareId: string }> {
  const existing = await loadRecord(viewId);
  if (!existing || existing.userId !== userId) {
    throw new SavedViewError("Saved view not found", 404);
  }
  const redis = createRedisClient();
  let shareId = existing.shareId;
  if (!shareId) {
    for (let attempts = 0; attempts < 3; attempts += 1) {
      const candidate = generateShareId();
      const prior = await redis.getJson<{ viewId: string; userId: string }>(SHARE_KEY(candidate));
      if (!prior) {
        shareId = candidate;
        break;
      }
    }
    if (!shareId) {
      throw new SavedViewError("Unable to generate share link", 500);
    }
  }
  existing.shareId = shareId;
  existing.updatedAt = new Date().toISOString();
  await persistRecord(existing);
  await redis.setJson(SHARE_KEY(shareId), { viewId: existing.id, userId });
  return { shareId };
}

export async function disableSavedViewShare(userId: string, viewId: string): Promise<void> {
  const existing = await loadRecord(viewId);
  if (!existing || existing.userId !== userId) {
    throw new SavedViewError("Saved view not found", 404);
  }
  if (!existing.shareId) {
    return;
  }
  const shareId = existing.shareId;
  existing.shareId = null;
  existing.updatedAt = new Date().toISOString();
  await persistRecord(existing);
  const redis = createRedisClient();
  await redis.raw.del(SHARE_KEY(shareId));
}

export async function getSharedView(shareId: string): Promise<SharedSavedViewPayload | null> {
  if (!shareId) return null;
  const redis = createRedisClient();
  const mapping = await redis.getJson<{ viewId: string; userId: string }>(SHARE_KEY(shareId));
  if (!mapping || typeof mapping.viewId !== "string") {
    return null;
  }
  const record = await redis.getJson<InternalSavedViewRecord>(VIEW_KEY(mapping.viewId));
  if (!record || record.shareId !== shareId) {
    return null;
  }
  return {
    name: record.name,
    symbols: record.symbols,
    base: record.base,
    horizon: record.horizon,
    custom: record.custom,
    viewMode: record.viewMode,
  };
}

export async function getSavedView(userId: string, viewId: string): Promise<SavedViewSummary> {
  const record = await loadRecord(viewId);
  if (!record || record.userId !== userId) {
    throw new SavedViewError("Saved view not found", 404);
  }
  return toSummary(record);
}


