import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { resumeSession, getHistory, deleteHistoryEntry, extendSessionLocally } from '../services/storage';
import { extendSession as extendSessionApi } from '../services/api';
import Toast from '../components/Toast';
import type { HistoryEntry, ScanItem } from '../types';

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

const CSV_FIELDS = [
  { key: 'ean',          label: 'Código EAN',        required: true },
  { key: 'quantity',     label: 'Cantidad',           required: false },
  { key: 'internalCode', label: 'Código interno',     required: false },
  { key: 'productName',  label: 'Nombre de producto', required: false },
  { key: 'price',        label: 'Precio',             required: false },
  { key: 'observations', label: 'Observaciones',      required: false },
  { key: 'module',       label: 'Módulo',             required: false },
] as const;

type CsvFieldKey = (typeof CSV_FIELDS)[number]['key'];

const FIELD_MAP: Record<CsvFieldKey, { header: string; getter: (i: ScanItem) => string }> = {
  ean:          { header: 'EAN',            getter: (i) => i.ean },
  quantity:     { header: 'Cantidad',       getter: (i) => String(i.quantity) },
  internalCode: { header: 'CodigoInterno',  getter: (i) => i.internalCode ?? '' },
  productName:  { header: 'NombreProducto', getter: (i) => i.productName ?? '' },
  price:        { header: 'Precio',         getter: (i) => i.price != null ? String(i.price) : '' },
  observations: { header: 'Observaciones',  getter: (i) => i.observations ?? '' },
  module:       { header: 'Modulo',         getter: (i) => i.module ?? '' },
};

function buildLocalCsv(items: ScanItem[], fields: Record<CsvFieldKey, boolean>): string {
  const selected = CSV_FIELDS.filter((f) => fields[f.key]).map((f) => FIELD_MAP[f.key]);
  const escape = (v: string) => (v.includes(',') || v.includes('"') || v.includes('\n'))
    ? `"${v.replace(/"/g, '""')}"` : v;
  const header = selected.map((f) => f.header).join(',');
  const rows = items.map((item) => selected.map((f) => escape(f.getter(item))).join(','));
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hasAnyData(items: ScanItem[], key: keyof ScanItem): boolean {
  return items.some((i) => i[key] != null && i[key] !== '');
}

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewingSession, setViewingSession] = useState<{ shortCode: string; accessCode: string; name: string } | null>(null);
  const [viewingItems, setViewingItems] = useState<HistoryEntry | null>(null);
  const [itemsFilter, setItemsFilter] = useState('');
  const [csvFields, setCsvFields] = useState<Record<CsvFieldKey, boolean>>({
    ean: true, quantity: true, internalCode: false, productName: false, price: false, observations: false, module: false,
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  // Resetear filtro al cerrar/abrir modal
  useEffect(() => {
    if (!viewingItems) setItemsFilter('');
  }, [viewingItems]);

  // Cuando se abre el modal de ítems, preseleccionar campos que tienen datos
  useEffect(() => {
    if (!viewingItems) return;
    const items = viewingItems.allScans;
    setCsvFields({
      ean:          true,
      quantity:     true,
      internalCode: hasAnyData(items, 'internalCode'),
      productName:  hasAnyData(items, 'productName'),
      price:        hasAnyData(items, 'price'),
      observations: hasAnyData(items, 'observations'),
      module:       hasAnyData(items, 'module'),
    });
  }, [viewingItems]);

  const showToastMsg = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

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
    showToastMsg('Copiado al portapapeles');
  };

  const handleCopyUrl = () => {
    if (!viewingSession) return;
    copyToClipboard(`${window.location.origin}/i/${viewingSession.shortCode}`);
  };

  const handleCopyCode = () => {
    if (!viewingSession) return;
    copyToClipboard(viewingSession.accessCode);
  };

  const handleExtend = async (entry: HistoryEntry) => {
    if (!entry.session.shortCode || !entry.session.accessCode) return;
    setExtending(entry.session.shortCode);
    try {
      const { createdAt } = await extendSessionApi(entry.session.shortCode, entry.session.accessCode);
      extendSessionLocally(entry.session.shortCode, createdAt);
      setHistory(getHistory());
      showToastMsg('Sesión extendida 24 h');
    } catch {
      /* silencioso */
    } finally {
      setExtending(null);
    }
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

  const handleExportCsv = () => {
    if (!viewingItems) return;
    const entry = viewingItems;
    const selectedKeys = (Object.keys(csvFields) as CsvFieldKey[]).filter((k) => csvFields[k]);
    const sessionName = entry.session.name.replace(/[^a-zA-Z0-9]/g, '_');

    if (entry.session.shortCode) {
      const params = new URLSearchParams({ fields: selectedKeys.join(',') });
      const url = `/api/sessions/${entry.session.shortCode}/export?${params}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const csv = buildLocalCsv(entry.allScans, csvFields);
      downloadBlob(csv, `${sessionName}.csv`);
    }
  };

  const toggleField = (key: CsvFieldKey) => {
    if (key === 'ean') return; // EAN siempre requerido
    setCsvFields((prev) => ({ ...prev, [key]: !prev[key] } as Record<CsvFieldKey, boolean>));
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <Toast show={showToast} message={toastMessage} />

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
              <button onClick={handleShareSession} className="btn-outline w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Compartir sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver ítems + exportar CSV */}
      {viewingItems && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setViewingItems(null)}>
          <div
            className="card w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-b-none sm:rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900 text-base truncate">{viewingItems.session.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {viewingItems.allScans.length} ítem{viewingItems.allScans.length !== 1 ? 's' : ''}
                  {viewingItems.pendingScans.length > 0 && (
                    <span className="text-amber-500 ml-1">· {viewingItems.pendingScans.length} sin sync</span>
                  )}
                </p>
              </div>
              <button onClick={() => setViewingItems(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filtro */}
            {viewingItems.allScans.length > 0 && (
              <div className="px-5 pb-2 flex-shrink-0">
                <input
                  type="text"
                  value={itemsFilter}
                  onChange={(e) => setItemsFilter(e.target.value)}
                  placeholder="Filtrar por EAN, código interno o módulo..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary-400 bg-gray-50"
                />
              </div>
            )}

            {/* Lista de ítems */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {(() => {
                const q = itemsFilter.trim().toLowerCase();
                const filtered = q
                  ? viewingItems.allScans.filter(
                      (s) =>
                        s.ean.includes(q) ||
                        s.internalCode?.toLowerCase().includes(q) ||
                        s.module?.toLowerCase().includes(q),
                    )
                  : viewingItems.allScans;
                return filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {q ? `Sin resultados para "${itemsFilter}"` : 'Sin ítems escaneados'}
                  </p>
                ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-2 pr-3 font-medium">EAN</th>
                        <th className="pb-2 pr-3 font-medium text-right">Cant.</th>
                        {hasAnyData(viewingItems.allScans, 'internalCode') && (
                          <th className="pb-2 pr-3 font-medium">Cód. int.</th>
                        )}
                        {hasAnyData(viewingItems.allScans, 'productName') && (
                          <th className="pb-2 pr-3 font-medium">Producto</th>
                        )}
                        {hasAnyData(viewingItems.allScans, 'price') && (
                          <th className="pb-2 pr-3 font-medium text-right">Precio</th>
                        )}
                        {hasAnyData(viewingItems.allScans, 'observations') && (
                          <th className="pb-2 pr-3 font-medium">Obs.</th>
                        )}
                        {hasAnyData(viewingItems.allScans, 'module') && (
                          <th className="pb-2 font-medium">Módulo</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((item) => (
                        <tr key={item.ean} className="hover:bg-gray-50">
                          <td className="py-2 pr-3 font-mono text-gray-700">{item.ean}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-gray-800">{item.quantity}</td>
                          {hasAnyData(viewingItems.allScans, 'internalCode') && (
                            <td className="py-2 pr-3 text-gray-600">{item.internalCode ?? '—'}</td>
                          )}
                          {hasAnyData(viewingItems.allScans, 'productName') && (
                            <td className="py-2 pr-3 text-gray-600 max-w-[120px] truncate">{item.productName ?? '—'}</td>
                          )}
                          {hasAnyData(viewingItems.allScans, 'price') && (
                            <td className="py-2 pr-3 text-right text-gray-600">
                              {item.price != null ? item.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '—'}
                            </td>
                          )}
                          {hasAnyData(viewingItems.allScans, 'observations') && (
                            <td className="py-2 pr-3 text-gray-500 max-w-[100px] truncate">{item.observations ?? '—'}</td>
                          )}
                          {hasAnyData(viewingItems.allScans, 'module') && (
                            <td className="py-2 text-gray-600">{item.module ?? '—'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                );
              })()}
            </div>

            {/* Exportar CSV */}
            <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Exportar CSV</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                {CSV_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={csvFields[field.key]}
                      disabled={field.required}
                      onChange={() => toggleField(field.key)}
                      className="w-3.5 h-3.5 accent-primary-500"
                    />
                    <span className={`text-xs ${field.required ? 'text-gray-500 font-medium' : 'text-gray-600'}`}>
                      {field.label}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleExportCsv}
                disabled={viewingItems.allScans.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar CSV
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
                <div key={entry.session.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingItems(entry)}>
                  {/* Nombre + eliminar */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{entry.session.name}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(entry.session.id); }}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      title="Eliminar sesión"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                    <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[entry.session.type] ?? entry.session.type}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(entry.session.createdAt)}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      {entry.allScans.length} ítem{entry.allScans.length !== 1 ? 's' : ''}
                    </span>
                    {entry.pendingScans.length > 0 && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-amber-600 font-medium">{entry.pendingScans.length} sin sync</span>
                      </>
                    )}
                    <span className="text-xs text-gray-300">·</span>
                    <span className={`text-xs font-medium ${left <= 2 ? 'text-red-500' : 'text-gray-400'}`}>
                      {left}h restantes
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    {/* +24h — izquierda, sutil */}
                    {entry.session.shortCode && entry.session.accessCode ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExtend(entry); }}
                        disabled={extending === entry.session.shortCode}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-500 font-medium disabled:opacity-50 transition-colors"
                        title="Extender 24 h"
                      >
                        {extending === entry.session.shortCode ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        +24h
                      </button>
                    ) : <span />}

                    {/* Acciones principales — derecha */}
                    <div className="flex items-center gap-2">
                      {entry.session.shortCode && entry.session.accessCode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingSession({ shortCode: entry.session.shortCode!, accessCode: entry.session.accessCode!, name: entry.session.name }); }}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Compartir
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResume(entry); }}
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
