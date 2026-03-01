import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';
import Toast from '../components/Toast';
import {
  getSessionState,
  addScan,
  removeScan,
  clearPendingScans,
  updateSessionCodes,
  updateQuantity,
  updateScanDetails,
  clearSession,
  deleteHistoryEntry,
} from '../services/storage';
import { createSession, addScans, deleteScans } from '../services/api';
import type { ScanItem, SessionState } from '../types';

const TYPE_LABELS: Record<string, string> = {
  stock:   'Recuento de ítems',
  missing: 'Etiquetas faltantes',
  verify:  'Verificar stock',
  other:   'Otro',
};

export default function Scanner() {
  const navigate = useNavigate();
  const [state, setState] = useState<SessionState>({ session: null, pendingScans: [], allScans: [], pendingDeletes: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastSync, setLastSync] = useState<{ shortCode: string; accessCode: string } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Texto copiado');
  const [manualEan, setManualEan] = useState('');
  const [editingQty, setEditingQty] = useState<{ ean: string; value: string } | null>(null);
  const [blinkingEan, setBlinkingEan] = useState<string | null>(null);
  const [scanModal, setScanModal] = useState<{ ean: string; currentQty: number } | null>(null);
  const [modalFields, setModalFields] = useState<{
    quantity: string; internalCode: string; productName: string; price: string;
  }>({ quantity: '1', internalCode: '', productName: '', price: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFlags, setSettingsFlags] = useState({ askInternalCode: false, askProductName: false, askPrice: false });
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

  const openScanModal = useCallback((ean: string) => {
    const current = getSessionState();
    const existing = current.allScans.find((s) => s.ean === ean);
    setScanModal({ ean, currentQty: existing?.quantity ?? 1 });
    setModalFields({
      quantity:     String(existing?.quantity ?? 1),
      internalCode: existing?.internalCode ?? '',
      productName:  existing?.productName  ?? '',
      price:        existing?.price != null ? String(existing.price) : '',
    });
  }, []);

  const handleDetected = useCallback((ean: string) => {
    const isNew = addScan(ean);
    if (!isNew) triggerBlink(ean);
    refresh();
    const current = getSessionState();
    const anyFlag = !!(current.session?.askInternalCode || current.session?.askProductName || current.session?.askPrice);
    if (anyFlag) openScanModal(ean);
  }, [openScanModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualAdd = () => {
    const ean = manualEan.trim();
    if (!ean) return;
    const isNew = addScan(ean);
    if (!isNew) triggerBlink(ean);
    setManualEan('');
    refresh();
    const current = getSessionState();
    const anyFlag = !!(current.session?.askInternalCode || current.session?.askProductName || current.session?.askPrice);
    if (anyFlag) openScanModal(ean);
  };

  const handleModalConfirm = () => {
    if (!scanModal) return;
    const qty = parseInt(modalFields.quantity, 10);
    updateScanDetails(scanModal.ean, {
      quantity:     isNaN(qty) || qty < 1 ? scanModal.currentQty : qty,
      internalCode: modalFields.internalCode.trim() || undefined,
      productName:  modalFields.productName.trim()  || undefined,
      price:        modalFields.price !== '' ? parseFloat(modalFields.price) : undefined,
    });
    setScanModal(null);
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
    if (!current.session || (current.pendingScans.length === 0 && current.pendingDeletes.length === 0)) return;

    setSyncing(true);
    setSyncError(null);

    try {
      if (!current.session.shortCode) {
        const { askInternalCode, askProductName, askPrice } = current.session;
        const result = await createSession(
          current.session.name,
          current.session.type,
          current.pendingScans,
          { askInternalCode, askProductName, askPrice },
        );
        updateSessionCodes({
          shortCode: result.shortCode,
          accessCode: result.accessCode,
          askInternalCode: result.askInternalCode,
          askProductName: result.askProductName,
          askPrice: result.askPrice,
        });
        clearPendingScans();
        setLastSync({ shortCode: result.shortCode, accessCode: result.accessCode });
        refresh();
        setShowResult(true);
      } else {
        if (current.pendingDeletes.length > 0) {
          await deleteScans(current.session.shortCode, current.pendingDeletes);
        }
        if (current.pendingScans.length > 0) {
          await addScans(current.session.shortCode, current.pendingScans);
        }
        clearPendingScans();
        refresh();
        setToastMessage('Datos sincronizados');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenSettings = () => {
    const current = getSessionState();
    setSettingsFlags({
      askInternalCode: !!current.session?.askInternalCode,
      askProductName:  !!current.session?.askProductName,
      askPrice:        !!current.session?.askPrice,
    });
    setShowSettings(true);
  };

  const handleSaveSettings = () => {
    updateSessionCodes(settingsFlags);
    refresh();
    setShowSettings(false);
  };

  const handleFinishClick = () => {
    if (state.pendingScans.length > 0) {
      setShowExitConfirm(true);
    } else {
      clearSession();
      navigate('/');
    }
  };

  const handleConfirmExit = () => {
    // Si nunca se sincronizó, eliminar también del historial para no dejar un registro vacío/roto
    if (!state.session?.shortCode && state.session) {
      deleteHistoryEntry(state.session.id);
    }
    clearSession();
    navigate('/');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToastMessage('Texto copiado');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!lastSync) return;
    copyToClipboard(`${window.location.origin}/i/${lastSync.shortCode}`);
  };

  const handleCopyCode = () => {
    if (!lastSync) return;
    copyToClipboard(lastSync.accessCode);
  };

  const handleCopy = () => {
    if (!lastSync) return;
    copyToClipboard(
      `URL: ${window.location.origin}/i/${lastSync.shortCode}\nCódigo de acceso: ${lastSync.accessCode}`
    );
  };

  const { session, pendingScans, pendingDeletes = [] } = state;
  if (!session) return null;

  // ────────── Modal resultado ──────────
  if (showResult && lastSync) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Toast show={showToast} message={toastMessage} />
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
              <button
                onClick={handleCopyUrl}
                className="font-mono text-sm text-primary-700 break-all text-left w-full hover:text-primary-900 transition-colors cursor-pointer"
                title="Copiar URL"
              >
                {window.location.origin}/i/{lastSync.shortCode}
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Código de acceso</p>
              <button
                onClick={handleCopyCode}
                className="font-mono text-3xl font-bold text-gray-900 tracking-widest hover:text-primary-600 transition-colors cursor-pointer"
                title="Copiar código"
              >
                {lastSync.accessCode}
              </button>
            </div>
          </div>

          <button onClick={handleCopy} className="btn-outline w-full mb-3 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copiar URL y código
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
          <button onClick={() => { clearSession(); navigate('/'); }} className="btn-danger w-full mt-3 text-sm py-2.5">Finalizar sesión</button>
        </div>
      </div>
    );
  }

  // ────────── Vista de escaneo ──────────
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-4">
      <Toast show={showToast} message={toastMessage} />

      {/* Modal configuración de flags */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={() => setShowSettings(false)}>
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base">Datos solicitados por ítem</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {([
                { key: 'askInternalCode' as const, label: 'Código interno' },
                { key: 'askProductName'  as const, label: 'Nombre de producto' },
                { key: 'askPrice'        as const, label: 'Precio' },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsFlags[key]}
                    onChange={(e) => setSettingsFlags((f) => ({ ...f, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <button onClick={handleSaveSettings} className="btn-primary w-full text-sm py-2.5">
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Modal error de sincronización */}
      {syncError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="card p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center mb-2">Error al sincronizar</h3>
            <p className="text-sm text-gray-500 text-center mb-5">{syncError}</p>
            <div className="flex gap-3">
              <button onClick={() => setSyncError(null)} className="btn-outline flex-1 text-sm py-2.5">
                Cerrar
              </button>
              <button
                onClick={() => { setSyncError(null); handleSync(); }}
                className="btn-primary flex-1 text-sm py-2.5"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación de salida */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="card p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center mb-2">¿Salir sin sincronizar?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Tenés <span className="font-semibold text-amber-600">{state.pendingScans.length} ítem{state.pendingScans.length !== 1 ? 's' : ''}</span> sin sincronizar.
              {!state.session?.shortCode
                ? ' Esta sesión nunca fue sincronizada y se eliminará por completo.'
                : ' Los ítems pendientes se perderán.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="btn-outline flex-1 text-sm py-2.5">
                Cancelar
              </button>
              <button onClick={handleConfirmExit} className="btn-danger flex-1 text-sm py-2.5">
                Salir igual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal datos adicionales del ítem */}
      {scanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="card p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base">Datos del ítem</h3>
              <span className="font-mono text-xs text-gray-400 truncate max-w-[140px]">{scanModal.ean}</span>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={modalFields.quantity}
                  onChange={(e) => setModalFields((f) => ({ ...f, quantity: e.target.value }))}
                  className="input-field py-2 text-sm"
                  autoFocus
                />
              </div>

              {session.askInternalCode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Código interno</label>
                  <input
                    type="text"
                    value={modalFields.internalCode}
                    onChange={(e) => setModalFields((f) => ({ ...f, internalCode: e.target.value }))}
                    placeholder="Ej: INT-001"
                    className="input-field py-2 text-sm"
                  />
                </div>
              )}

              {session.askProductName && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de producto</label>
                  <input
                    type="text"
                    value={modalFields.productName}
                    onChange={(e) => setModalFields((f) => ({ ...f, productName: e.target.value }))}
                    placeholder="Ej: Leche entera 1L"
                    className="input-field py-2 text-sm"
                  />
                </div>
              )}

              {session.askPrice && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Precio</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={modalFields.price}
                    onChange={(e) => setModalFields((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="input-field py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setScanModal(null)}
                className="btn-outline flex-1 text-sm py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                className="btn-primary flex-1 text-sm py-2.5"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-1">
          <button onClick={handleOpenSettings} className="text-gray-400 hover:text-gray-600 p-1.5 transition-colors" title="Configurar datos por ítem">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={handleFinishClick} className="text-red-400 hover:text-red-600 p-1.5 transition-colors" title="Finalizar sesión">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cámara */}
      <BarcodeScanner onDetected={handleDetected} active={!showResult && scanModal === null} />

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


      {/* Barra de acción */}
      <div className="flex items-center justify-between mt-4 mb-3">
        <span className="text-sm text-gray-500 font-medium">
          {pendingScans.length === 0 && pendingDeletes.length === 0
            ? session.shortCode ? 'Todo sincronizado' : 'Sin escaneos aún'
            : `${pendingScans.length + pendingDeletes.length} cambio${pendingScans.length + pendingDeletes.length !== 1 ? 's' : ''} sin sincronizar`}
        </span>
        <button
          onClick={handleSync}
          disabled={syncing || (pendingScans.length === 0 && pendingDeletes.length === 0)}
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
                  {/* Indicador + EAN + datos extra (clickable para editar) */}
                  <button
                    onClick={() => openScanModal(item.ean)}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                    title="Editar datos del ítem"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-primary-400'}`} />
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-gray-800 truncate">{item.ean}</p>
                      {(item.internalCode || item.productName || item.price != null) && (
                        <p className="text-xs text-gray-400 truncate">
                          {[item.internalCode, item.productName, item.price != null ? `$${item.price}` : null]
                            .filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>

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
                        onClick={() => handleQtyEdit(item.ean, item.quantity)}
                        title="Editar cantidad"
                        className={`text-sm font-bold px-2.5 py-0.5 rounded-full min-w-[2rem] text-center transition-colors cursor-pointer ${
                          isPending
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                        }`}
                      >
                        {item.quantity}
                      </button>
                    )}

                    <button onClick={() => handleRemove(item.ean)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
