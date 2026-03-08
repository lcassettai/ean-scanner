import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { recoverSession as storageRecoverSession } from '../services/storage';
import { joinSession as joinSessionApi } from '../services/api';

export default function RecoverSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('codigo') ?? '');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRecover = async () => {
    if (!code.trim() || !accessCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await joinSessionApi(code.trim(), accessCode.trim());
      storageRecoverSession(result);
      navigate('/scan');
    } catch {
      setError('Código de sesión o clave incorrectos, o la sesión ya expiró.');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-bold text-gray-900">Recuperar sesión</h1>
        </div>

        {/* Aviso explicativo */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            Usá esta opción si perdiste el historial local pero la sesión sigue activa en el servidor.
            Se restaurarán todos los ítems escaneados.
          </p>
        </div>

        <div className="card p-6">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-1">Ingresá los datos de tu sesión</h2>
          <p className="text-xs text-gray-500 mb-6">Los encontrás en el mensaje que compartiste al sincronizar por primera vez.</p>

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Código de sesión <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input-field font-mono tracking-widest text-center text-lg uppercase"
                placeholder="a1b2c3"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
                autoFocus={!searchParams.get('codigo')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Clave de acceso <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input-field font-mono tracking-widest text-center text-2xl font-bold"
                placeholder="1234"
                maxLength={4}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
                autoFocus={!!searchParams.get('codigo')}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleRecover}
            disabled={loading || !code.trim() || !accessCode.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Recuperando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recuperar sesión
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
