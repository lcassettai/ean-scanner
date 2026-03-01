import type { SessionMeta, SessionState, HistoryEntry, ScanItem } from '../types';

const SESSION_KEY = 'ean_session';
const HISTORY_KEY = 'ean_history';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Helpers ────────────────────────────────────────────────────────────────

function isExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > EXPIRY_MS;
}

function mergeScans(scans: ScanItem[], ean: string): { list: ScanItem[]; isNew: boolean } {
  const existing = scans.find((s) => s.ean === ean);
  if (existing) {
    existing.quantity += 1;
    return { list: scans, isNew: false };
  }
  scans.push({ ean, quantity: 1 });
  return { list: scans, isNew: true };
}

// ─── Historial ──────────────────────────────────────────────────────────────

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as HistoryEntry[];
    const valid = entries.filter((e) => !isExpired(e.session.createdAt));
    if (valid.length !== entries.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function syncToHistory(state: SessionState): void {
  if (!state.session) return;
  const entries = getHistory();
  const idx = entries.findIndex((e) => e.session.id === state.session!.id);
  const entry: HistoryEntry = {
    session: state.session,
    pendingScans: state.pendingScans,
    allScans: state.allScans,
  };
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.unshift(entry); // más reciente primero
  }
  saveHistory(entries);
}

export function deleteHistoryEntry(id: string): void {
  const entries = getHistory().filter((e) => e.session.id !== id);
  saveHistory(entries);
}

// ─── Sesión activa ───────────────────────────────────────────────────────────

export function getSessionState(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { session: null, pendingScans: [], allScans: [], pendingDeletes: [] };
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.allScans) parsed.allScans = [...parsed.pendingScans];
    if (!parsed.pendingDeletes) parsed.pendingDeletes = [];
    // Verificar expiración
    if (parsed.session && isExpired(parsed.session.createdAt)) {
      localStorage.removeItem(SESSION_KEY);
      return { session: null, pendingScans: [], allScans: [] };
    }
    return parsed;
  } catch {
    return { session: null, pendingScans: [], allScans: [] };
  }
}

function saveSessionState(state: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  syncToHistory(state);
}

export function startSession(
  name: string,
  type: string,
  flags: { askInternalCode: boolean; askProductName: boolean; askPrice: boolean },
): void {
  const state: SessionState = {
    session: {
      id: Date.now().toString(),
      name,
      type,
      shortCode: null,
      accessCode: null,
      createdAt: new Date().toISOString(),
      askInternalCode: flags.askInternalCode,
      askProductName: flags.askProductName,
      askPrice: flags.askPrice,
    },
    pendingScans: [],
    allScans: [],
    pendingDeletes: [],
  };
  saveSessionState(state);
}

export function resumeSession(entry: HistoryEntry): void {
  const state: SessionState = {
    session: entry.session,
    pendingScans: entry.pendingScans,
    allScans: entry.allScans,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

/** Retorna true si el EAN es nuevo, false si ya existía (duplicado) */
export function addScan(ean: string): boolean {
  const state = getSessionState();

  const pendingResult = mergeScans(state.pendingScans, ean);
  state.pendingScans = pendingResult.list;

  const allResult = mergeScans(state.allScans, ean);
  state.allScans = allResult.list;

  saveSessionState(state);
  return allResult.isNew;
}

export function removeScan(ean: string): void {
  const state = getSessionState();
  // Si ya fue sincronizado, rastrear la eliminación para propagarla al servidor
  if (state.session?.shortCode && !state.pendingDeletes.includes(ean)) {
    state.pendingDeletes.push(ean);
  }
  state.pendingScans = state.pendingScans.filter((s) => s.ean !== ean);
  state.allScans = state.allScans.filter((s) => s.ean !== ean);
  saveSessionState(state);
}

export function updateQuantity(ean: string, quantity: number): void {
  const state = getSessionState();
  const pending = state.pendingScans.find((s) => s.ean === ean);
  if (pending) {
    pending.quantity = quantity;
  } else {
    // El ítem ya fue sincronizado; lo vuelve a pending para que se re-sincronice
    state.pendingScans.push({ ean, quantity });
  }
  const all = state.allScans.find((s) => s.ean === ean);
  if (all) all.quantity = quantity;
  saveSessionState(state);
}

export interface ScanDetails {
  quantity: number;
  internalCode?: string;
  productName?: string;
  price?: number;
}

export function updateScanDetails(ean: string, details: ScanDetails): void {
  const state = getSessionState();
  const pending = state.pendingScans.find((s) => s.ean === ean);
  if (pending) {
    Object.assign(pending, details);
  } else {
    // El ítem ya fue sincronizado; lo vuelve a pending para re-sincronizar
    state.pendingScans.push({ ean, ...details });
  }
  const all = state.allScans.find((s) => s.ean === ean);
  if (all) Object.assign(all, details);
  saveSessionState(state);
}

export function updateSessionCodes(meta: Partial<SessionMeta>): void {
  const state = getSessionState();
  if (state.session) {
    state.session = { ...state.session, ...meta };
    saveSessionState(state);
  }
}

export function clearPendingScans(): void {
  const state = getSessionState();
  state.pendingScans = [];
  state.pendingDeletes = [];
  saveSessionState(state);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  // El historial se mantiene
}
