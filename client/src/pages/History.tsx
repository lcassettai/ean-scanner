import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { resumeSession, getHistory, deleteHistoryEntry } from '../services/storage';
import Toast from '../components/Toast';
import type { HistoryEntry } from '../types';

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

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewingSession, setViewingSession] = useState<{ shortCode: string; accessCode: string; name: string } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleResume = (entry: HistoryEntry) => {
    resumeSession(entry);
    navigate('/scan');
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    setHistory(getHistory());
    setDeleteConfirm(null);
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

  const handleShareSession = async () => {
    if (!viewingSession) return;
    const joinUrl = `${window.location.origin}/unirme?codigo=${viewingSession.shortCode}`;
    const text = `Quiero que te unas a mi sesión de escaneo.\nURL: ${joinUrl}\nClave: ${viewingSession.accessCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Unirse a sesión EAN', text }); } catch { /* cancelado */ }
    } else {
      copyToClipboard(text);
    }
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
                <p className="text-xs text-gray-500 font-medium mb-1">Código de sesión</p>
                <button
                  onClick={() => copyToClipboard(viewingSession.shortCode)}
                  className="font-mono text-xl font-bold text-gray-900 tracking-widest hover:text-primary-600 transition-colors cursor-pointer"
                  title="Copiar código de sesión"
                >
                  {viewingSession.shortCode}
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Clave de acceso</p>
                <button
                  onClick={handleCopyCode}
                  className="font-mono text-3xl font-bold text-gray-900 tracking-widest hover:text-primary-600 transition-colors cursor-pointer"
                  title="Copiar clave"
                >
                  {viewingSession.accessCode}
                </button>
              </div>
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
            </div>
            <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4 mb-4">
              <QRCodeSVG
                value={`${window.location.origin}/unirme?codigo=${viewingSession.shortCode}`}
                size={130}
                bgColor="#f9fafb"
                fgColor="#1e293b"
              />
              <p className="text-xs text-gray-400 mt-2">Escanear para unirse</p>
            </div>
            <div className="space-y-2">
              <button onClick={handleCopy} className="btn-outline w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copiar URL y código
              </button>
              <button onClick={handleShareSession} className="btn-outline w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Compartir sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="card p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center mb-2">¿Eliminar sesión?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Esta acción no se puede deshacer. La sesión se eliminará del historial local.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 text-sm py-2.5">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 text-sm py-2.5">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Historial</h1>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400 text-sm">No hay sesiones recientes</p>
          </div>
        ) : (
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
                      onClick={() => setDeleteConfirm(entry.session.id)}
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
                        <span className="text-amber-600 font-medium">{entry.pendingScans.length} sin sync</span>
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
        )}
      </div>
    </div>
  );
}
