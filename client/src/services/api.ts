import type { ScanItem, SyncResult } from '../types';

const BASE = '/api';

export async function createSession(
  name: string,
  type: string,
  scans: ScanItem[],
): Promise<SyncResult> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, scans }),
  });
  if (!res.ok) throw new Error('Error al crear la sesión');
  return res.json();
}

export async function addScans(
  shortCode: string,
  scans: ScanItem[],
): Promise<{ shortCode: string; totalScans: number }> {
  const res = await fetch(`${BASE}/sessions/${shortCode}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scans }),
  });
  if (!res.ok) throw new Error('Error al sincronizar');
  return res.json();
}

export function getCsvUrl(shortCode: string): string {
  return `${BASE}/sessions/${shortCode}/export`;
}
