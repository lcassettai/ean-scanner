import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSession, resumeSession, getHistory, deleteHistoryEntry } from '../services/storage';
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleStart = () => {
    if (!name.trim()) return;
    startSession(name.trim(), type);
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

  return (
    <div className="min-h-screen px-4 py-10">
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
            <input
              type="text"
              className="input-field"
              placeholder="Ej: Recuento depósito A - Marzo 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              autoFocus
            />
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
          </div>

          <button
            onClick={handleStart}
            disabled={!name.trim()}
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
                        {entry.session.shortCode && (
                          <a
                            href={`/i/${entry.session.shortCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Ver web ↗
                          </a>
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
