import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';
import {
  getSessionState,
  addScan,
  removeScan,
  clearPendingScans,
  updateSessionCodes,
  updateQuantity,
  clearSession,
} from '../services/storage';
import { createSession, addScans } from '../services/api';
import type { ScanItem, SessionState } from '../types';

const TYPE_LABELS: Record<string, string> = {
  stock:   'Recuento de ítems',
  missing: 'Etiquetas faltantes',
  verify:  'Verificar stock',
  other:   'Otro',
};

export default function Scanner() {
  const navigate = useNavigate();
  const [state, setState] = useState<SessionState>({ session: null, pendingScans: [], allScans: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastSync, setLastSync] = useState<{ shortCode: string; accessCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualEan, setManualEan] = useState('');
  const [editingQty, setEditingQty] = useState<{ ean: string; value: string } | null>(null);
  const [blinkingEan, setBlinkingEan] = useState<string | null>(null);

  const refresh = () => setState(getSessionState());

  useEffect(() => {
    const s = getSessionState();
    if (!s.session) { navigate('/'); return; }
    setState(s);
  }, [navigate]);

  const triggerBlink = (ean: string) => {
    setBlinkingEan(null);
    requestAnimationFrame(() => setBlinkingEan(ean));
    setTimeout(() => setBlinkingEan(null), 800);
  };

  const handleDetected = useCallback((ean: string) => {
    const isNew = addScan(ean);
    if (!isNew) triggerBlink(ean);
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualAdd = () => {
    const ean = manualEan.trim();
    if (!ean) return;
    const isNew = addScan(ean);
    if (!isNew) triggerBlink(ean);
    setManualEan('');
    refresh();
  };

  const handleRemove = (ean: string) => {
    removeScan(ean);
    refresh();
  };

  const handleQtyEdit = (ean: string, current: number) => {
    setEditingQty({ ean, value: String(current) });
  };

  const handleQtyChange = (val: string) => {
    if (!editingQty) return;
    setEditingQty({ ...editingQty, value: val });
  };

  const handleQtyCommit = (ean: string) => {
    if (!editingQty) return;
    const qty = parseInt(editingQty.value, 10);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(ean, qty);
      refresh();
    }
    setEditingQty(null);
  };

  const handleSync = async () => {
    const current = getSessionState();
    if (!current.session || current.pendingScans.length === 0) return;

    setSyncing(true);
    setSyncError(null);

    try {
      if (!current.session.shortCode) {
        const result = await createSession(current.session.name, current.session.type, current.pendingScans);
        updateSessionCodes({ shortCode: result.shortCode, accessCode: result.accessCode });
        clearPendingScans();
        setLastSync({ shortCode: result.shortCode, accessCode: result.accessCode });
      } else {
        await addScans(current.session.shortCode, current.pendingScans);
        clearPendingScans();
        setLastSync({ shortCode: current.session.shortCode, accessCode: current.session.accessCode! });
      }
      refresh();
      setShowResult(true);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setSyncing(false);
    }
  };

  const handleFinish = () => { clearSession(); navigate('/'); };

  const handleCopy = () => {
    if (!lastSync) return;
    navigator.clipboard.writeText(
      `URL: ${window.location.origin}/i/${lastSync.shortCode}\nCódigo de acceso: ${lastSync.accessCode}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { session, pendingScans } = state;
  if (!session) return null;

  // ────────── Modal resultado ──────────
  if (showResult && lastSync) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">¡Sincronizado!</h2>
            <p className="text-gray-500 text-sm mt-1">Los datos fueron guardados en el servidor</p>
          </div>

          <div className="bg-primary-50 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">URL de acceso</p>
              <p className="font-mono text-sm text-primary-700 break-all">
                {window.location.origin}/i/{lastSync.shortCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Código de acceso</p>
              <p className="font-mono text-3xl font-bold text-gray-900 tracking-widest">{lastSync.accessCode}</p>
            </div>
          </div>

          <button onClick={handleCopy} className="btn-outline w-full mb-3 flex items-center justify-center gap-2">
            {copied ? (
              <><svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>¡Copiado!</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar URL y código</>
            )}
          </button>

          <div className="flex gap-3">
            <button onClick={() => setShowResult(false)} className="btn-primary flex-1 text-sm py-2.5">
              Continuar escaneando
            </button>
            <a href={`/api/sessions/${lastSync.shortCode}/export`} className="btn-outline text-sm py-2.5 px-4 flex items-center gap-1" download>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </a>
          </div>
          <button onClick={handleFinish} className="btn-danger w-full mt-3 text-sm py-2.5">Finalizar sesión</button>
        </div>
      </div>
    );
  }

  // ────────── Vista de escaneo ──────────
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">{session.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {TYPE_LABELS[session.type] ?? session.type}
            </span>
            {session.shortCode && (
              <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-0.5 rounded-full">{session.shortCode}</span>
            )}
          </div>
        </div>
        <button onClick={handleFinish} className="text-red-400 hover:text-red-600 p-1.5 transition-colors" title="Finalizar sesión">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Cámara */}
      <BarcodeScanner onDetected={handleDetected} active={!showResult} />

      {/* Entrada manual de EAN */}
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          inputMode="numeric"
          value={manualEan}
          onChange={(e) => setManualEan(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
          placeholder="Ingresar código EAN manualmente..."
          className="input-field py-2 text-sm"
        />
        <button
          onClick={handleManualAdd}
          disabled={!manualEan.trim()}
          className="btn-primary py-2 px-4 text-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Error de sync */}
      {syncError && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{syncError}</div>
      )}

      {/* Barra de acción */}
      <div className="flex items-center justify-between mt-4 mb-3">
        <span className="text-sm text-gray-500 font-medium">
          {pendingScans.length === 0
            ? session.shortCode ? 'Todo sincronizado' : 'Sin escaneos aún'
            : `${pendingScans.length} ítem${pendingScans.length !== 1 ? 's' : ''} sin sincronizar`}
        </span>
        <button
          onClick={handleSync}
          disabled={syncing || pendingScans.length === 0}
          className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
        >
          {syncing ? (
            <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Sincronizando...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>Sincronizar</>
          )}
        </button>
      </div>

      {/* Lista de scans */}
      {state.allScans.length > 0 && (
        <div className="card overflow-hidden flex-1">
          <div className="px-4 py-2.5 border-b border-primary-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ítems escaneados ({state.allScans.length})
            </p>
            {pendingScans.length > 0 && (
              <span className="text-xs text-amber-600 font-medium">{pendingScans.length} sin sync</span>
            )}
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {[...state.allScans].reverse().map((item: ScanItem) => {
              const isPending = pendingScans.some((p) => p.ean === item.ean);
              const isEditingThis = editingQty?.ean === item.ean;
              return (
                <div key={item.ean} className={`flex items-center justify-between px-4 py-3 gap-2 ${blinkingEan === item.ean ? 'blink-row' : ''}`}>
                  {/* Indicador + EAN */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-primary-400'}`} />
                    <p className="font-mono text-sm text-gray-800 truncate">{item.ean}</p>
                  </div>

                  {/* Cantidad editable + acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditingThis ? (
                      <input
                        type="number"
                        min={1}
                        value={editingQty!.value}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        onBlur={() => handleQtyCommit(item.ean)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQtyCommit(item.ean)}
                        className="w-16 text-center text-sm font-bold border-2 border-primary-400 rounded-lg px-1 py-0.5 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => isPending && handleQtyEdit(item.ean, item.quantity)}
                        title={isPending ? 'Editar cantidad' : undefined}
                        className={`text-sm font-bold px-2.5 py-0.5 rounded-full min-w-[2rem] text-center transition-colors ${
                          isPending
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer'
                            : 'bg-primary-100 text-primary-700 cursor-default'
                        }`}
                      >
                        {item.quantity}
                      </button>
                    )}

                    {isPending ? (
                      <button onClick={() => handleRemove(item.ean)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
