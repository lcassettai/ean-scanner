import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSession } from '../services/storage';

const SESSION_TYPES = [
  { value: 'stock',   label: 'Recuento de ítems' },
  { value: 'missing', label: 'Etiquetas faltantes' },
  { value: 'verify',  label: 'Verificar stock' },
  { value: 'other',   label: 'Otro' },
];

export default function NewSession() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState('stock');
  const [customType, setCustomType] = useState('');
  const [askQuantity, setAskQuantity] = useState(false);
  const [askInternalCode, setAskInternalCode] = useState(false);
  const [askProductName, setAskProductName] = useState(false);
  const [askPrice, setAskPrice] = useState(false);

  const handleStart = () => {
    if (!name.trim()) return;
    if (type === 'other' && !customType.trim()) return;
    const resolvedType = type === 'other' ? customType.trim() : type;
    startSession(name.trim(), resolvedType, { askQuantity, askInternalCode, askProductName, askPrice });
    navigate('/scan');
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Nueva sesión</h1>
        </div>

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
                  setName((prev) => (prev.trim() ? `${prev.trim()} - ${stamp}` : stamp));
                }}
                className="flex-shrink-0 w-10 h-12 flex items-center justify-center rounded-xl border-2 border-primary-200 text-primary-500 hover:border-primary-400 hover:bg-primary-50 transition-all"
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
                { key: 'quantity'     as const, label: 'Cantidad',            state: askQuantity,     setter: setAskQuantity },
                { key: 'internalCode' as const, label: 'Código interno',      state: askInternalCode, setter: setAskInternalCode },
                { key: 'productName'  as const, label: 'Nombre de producto',  state: askProductName,  setter: setAskProductName },
                { key: 'price'        as const, label: 'Precio',              state: askPrice,        setter: setAskPrice },
              ].map(({ key, label, state, setter }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state}
                    onChange={(e) => setter(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
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

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Las sesiones se eliminan automáticamente a las <strong>24 horas</strong> de su creación.
          </p>
        </div>
      </div>
    </div>
  );
}
