import type { ScanItem, SyncResult, JoinResult } from '../types';

const BASE = '/api';

export async function createSession(
  name: string,
  type: string,
  scans: ScanItem[],
  flags?: { askQuantity?: boolean; askInternalCode?: boolean; askProductName?: boolean; askPrice?: boolean; askModule?: boolean },
): Promise<SyncResult> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, scans, ...flags }),
  });
  if (!res.ok) throw new Error('Error al crear la sesión');
  return res.json();
}

export async function addScans(
  shortCode: string,
  scans: ScanItem[],
): Promise<{ shortCode: string; scans: ScanItem[] }> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scans }),
  });
  if (!res.ok) throw new Error('Error al sincronizar');
  return res.json();
}

export async function updateScan(
  shortCode: string,
  accessCode: string,
  ean: string,
  fields: { quantity?: number; internalCode?: string | null; productName?: string | null; price?: number | null; observations?: string | null; module?: string | null },
): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/scans`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode, ean, ...fields }),
  });
  if (!res.ok) throw new Error('Error al guardar');
}

export async function deleteScans(shortCode: string, eans: string[]): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/scans`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eans }),
  });
  if (!res.ok) throw new Error('Error al eliminar ítems');
}

export async function extendSession(shortCode: string, accessCode: string): Promise<{ createdAt: string }> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  if (!res.ok) throw new Error('No se pudo extender la sesión');
  return res.json();
}

export async function joinSession(shortCode: string, accessCode: string): Promise<JoinResult> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  if (!res.ok) throw new Error('Código incorrecto');
  return res.json();
}

export function getCsvUrl(shortCode: string): string {
  return `${BASE}/sessions/${shortCode}/export`;
}
