export type SavedViewMode = "returns" | "stats";

export type SavedViewHorizon = "5y" | "max";

export type SavedViewCustomRange = {
  enabled: boolean;
  start: string;
  end: string;
};

export type SavedViewConfig = {
  symbols: string[];
  base: number;
  horizon: SavedViewHorizon;
  custom: SavedViewCustomRange;
  viewMode: SavedViewMode;
};

export type SavedViewSummary = SavedViewConfig & {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  shareId?: string | null;
};

export type SharedSavedViewPayload = SavedViewConfig & {
  name: string;
};


