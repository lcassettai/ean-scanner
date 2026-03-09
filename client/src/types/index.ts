export interface ScanItem {
  ean: string;
  quantity: number;
  internalCode?: string;
  productName?: string;
  price?: number;
  observations?: string;
  module?: string;
}

export interface SessionMeta {
  id: string;
  name: string;
  type: string;
  shortCode: string | null;
  accessCode: string | null;
  createdAt: string; // ISO date string
  askQuantity: boolean;
  askInternalCode: boolean;
  askProductName: boolean;
  askPrice: boolean;
  askModule: boolean;
}

export interface SessionState {
  session: SessionMeta | null;
  pendingScans: ScanItem[];
  allScans: ScanItem[];
  pendingDeletes: string[]; // EANs eliminados que el servidor aún no sabe
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
  askQuantity: boolean;
  askInternalCode: boolean;
  askProductName: boolean;
  askPrice: boolean;
  askModule: boolean;
  totalScans: number;
}

export interface JoinResult {
  shortCode: string;
  accessCode: string;
  name: string;
  type: string | null;
  askQuantity: boolean;
  askInternalCode: boolean;
  askProductName: boolean;
  askPrice: boolean;
  askModule: boolean;
  createdAt: string;
  scans: ScanItem[];
}
