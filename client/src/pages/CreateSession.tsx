import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSession, resumeSession, getHistory, deleteHistoryEntry } from '../services/storage';
import Toast from '../components/Toast';
import type { HistoryEntry } from '../types';

const SESSION_TYPES = [
  { value: 'stock',   label: 'Recuento de ítems' },
  { value: 'missing', label: 'Etiquetas faltantes' },
  { value: 'verify',  label: 'Verificar stock' },
  { value: 'other',   label: 'Otro' },
];

const TYPE_LABELS: Record<string, string> = {
  stock:   'Recuento de ítems',
  missing: 'Etiquetas faltantes',
  verify:  'Verificar stock',
  other:   'Otro',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h === 0) return `hace ${m} min`;
  return `hace ${h}h ${m}m`;
}

function hoursLeft(isoDate: string): number {
  const diff = 24 * 3_600_000 - (Date.now() - new Date(isoDate).getTime());
  return Math.max(0, Math.floor(diff / 3_600_000));
}

export default function CreateSession() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState('stock');
  const [customType, setCustomType] = useState('');
  const [askInternalCode, setAskInternalCode] = useState(false);
  const [askProductName, setAskProductName] = useState(false);
  const [askPrice, setAskPrice] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewingSession, setViewingSession] = useState<{ shortCode: string; accessCode: string; name: string } | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleStart = () => {
    if (!name.trim()) return;
    if (type === 'other' && !customType.trim()) return;
    const resolvedType = type === 'other' ? customType.trim() : type;
    startSession(name.trim(), resolvedType, { askInternalCode, askProductName, askPrice });
    navigate('/scan');
  };

  const handleResume = (entry: HistoryEntry) => {
    resumeSession(entry);
    navigate('/scan');
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    setHistory(getHistory());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!viewingSession) return;
    copyToClipboard(`${window.location.origin}/i/${viewingSession.shortCode}`);
  };

  const handleCopyCode = () => {
    if (!viewingSession) return;
    copyToClipboard(viewingSession.accessCode);
  };

  const handleCopy = () => {
    if (!viewingSession) return;
    copyToClipboard(
      `URL: ${window.location.origin}/i/${viewingSession.shortCode}\nCódigo de acceso: ${viewingSession.accessCode}`
    );
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <Toast show={showToast} />
      {/* Modal ver código */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40" onClick={() => setViewingSession(null)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-base truncate pr-4">{viewingSession.name}</h2>
              <button onClick={() => setViewingSession(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-primary-50 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">URL de acceso</p>
                <button
                  onClick={handleCopyUrl}
                  className="font-mono text-sm text-primary-700 break-all text-left w-full hover:text-primary-900 transition-colors cursor-pointer"
                  title="Copiar URL"
                >
                  {window.location.origin}/i/{viewingSession.shortCode}
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Código de acceso</p>
                <button
                  onClick={handleCopyCode}
                  className="font-mono text-3xl font-bold text-gray-900 tracking-widest hover:text-primary-600 transition-colors cursor-pointer"
                  title="Copiar código"
                >
                  {viewingSession.accessCode}
                </button>
              </div>
            </div>
            <button onClick={handleCopy} className="btn-outline w-full flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copiar URL y código
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h1M4 10h1M4 14h1M4 18h1M8 6h1M8 10h1M8 14h1M8 18h1M13 6h3M13 10h3M13 14h3M13 18h3M18 6h2M18 10h2M18 14h2M18 18h2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Escáner EAN</h1>
          <p className="text-gray-500 mt-1 text-sm">Creá una nueva sesión para comenzar</p>
        </div>

        {/* Formulario nueva sesión */}
        <div className="card p-6 mb-4">
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre de la sesión <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Recuento depósito A - Marzo 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const dd   = String(now.getDate()).padStart(2, '0');
                  const mm   = String(now.getMonth() + 1).padStart(2, '0');
                  const yyyy = now.getFullYear();
                  const hh   = String(now.getHours()).padStart(2, '0');
                  const min  = String(now.getMinutes()).padStart(2, '0');
                  const stamp = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
                  setName((prev) => (prev.trim() ? `${prev.trim()} ${stamp}` : stamp));
                }}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border-2 border-primary-200 text-primary-500 hover:border-primary-400 hover:bg-primary-50 transition-all"
                title="Agregar fecha y hora al nombre"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de escaneo</label>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    type === t.value
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white border-primary-200 text-gray-600 hover:border-primary-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {type === 'other' && (
              <input
                type="text"
                className="input-field mt-3 text-sm"
                placeholder="Describí el tipo de escaneo..."
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                autoFocus
              />
            )}
          </div>

          <div className="mb-6">
            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-700">Datos solicitados por ítem</label>
            <p className="text-xs text-gray-400">Se solicitará en cada escaneo de ítem</p>
            </div>
            <div className="space-y-2">
              {[
                { key: 'internalCode' as const, label: 'Código interno', state: askInternalCode, setter: setAskInternalCode },
                { key: 'productName'  as const, label: 'Nombre de producto', state: askProductName, setter: setAskProductName },
                { key: 'price'        as const, label: 'Precio', state: askPrice, setter: setAskPrice },
              ].map(({ key, label, state, setter }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state}
                    onChange={(e) => setter(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!name.trim() || (type === 'other' && !customType.trim())}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <span>Iniciar escaneo</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        {/* Aviso 24h */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Las sesiones se eliminan automáticamente a las <strong>24 horas</strong> de su creación.
          </p>
        </div>

        {/* Historial */}
        {history.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sesiones recientes
            </h2>
            <div className="space-y-3">
              {history.map((entry) => {
                const left = hoursLeft(entry.session.createdAt);
                return (
                  <div key={entry.session.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{entry.session.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                            {TYPE_LABELS[entry.session.type] ?? entry.session.type}
                          </span>
                          <span className="text-xs text-gray-400">{timeAgo(entry.session.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.session.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
                        title="Eliminar sesión"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{entry.allScans.length} ítem{entry.allScans.length !== 1 ? 's' : ''}</span>
                        {entry.pendingScans.length > 0 && (
                          <span className="text-amber-600 font-medium">
                            {entry.pendingScans.length} sin sync
                          </span>
                        )}
                        <span className={`${left <= 2 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          Expira en {left}h
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.session.shortCode && entry.session.accessCode && (
                          <button
                            onClick={() => setViewingSession({ shortCode: entry.session.shortCode!, accessCode: entry.session.accessCode!, name: entry.session.name })}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                            title="Ver URL y código de acceso"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Ver código
                          </button>
                        )}
                        <button
                          onClick={() => handleResume(entry)}
                          className="bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Continuar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
