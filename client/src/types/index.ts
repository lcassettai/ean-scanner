export interface ScanItem {
  ean: string;
  quantity: number;
  internalCode?: string;
  productName?: string;
  price?: number;
}

export interface SessionMeta {
  id: string;
  name: string;
  type: string;
  shortCode: string | null;
  accessCode: string | null;
  createdAt: string; // ISO date string
  askInternalCode: boolean;
  askProductName: boolean;
  askPrice: boolean;
}

export interface SessionState {
  session: SessionMeta | null;
  pendingScans: ScanItem[];
  allScans: ScanItem[];
}

export interface HistoryEntry {
  session: SessionMeta;
  pendingScans: ScanItem[];
  allScans: ScanItem[];
}

export interface SyncResult {
  shortCode: string;
  accessCode: string;
  name: string;
  type: string | null;
  askInternalCode: boolean;
  askProductName: boolean;
  askPrice: boolean;
  totalScans: number;
}
