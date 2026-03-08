import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinSession as storageJoinSession } from '../services/storage';
import { joinSession as joinSessionApi } from '../services/api';

export default function JoinSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joinCode, setJoinCode] = useState(searchParams.get('codigo') ?? '');
  const [joinAccess, setJoinAccess] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinAccess.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinSessionApi(joinCode.trim(), joinAccess.trim());
      storageJoinSession(result);
      navigate('/scan');
    } catch {
      setJoinError('Código de sesión o clave incorrectos.');
    } finally {
      setJoining(false);
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
          <h1 className="text-xl font-bold text-gray-900">Unirme a sesión</h1>
        </div>

        <div className="card p-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-1">Ingresá los datos de la sesión</h2>
          <p className="text-xs text-gray-500 mb-6">El organizador de la sesión debe compartirte el código y la clave.</p>

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
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
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
                value={joinAccess}
                onChange={(e) => setJoinAccess(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus={!!searchParams.get('codigo')}
              />
            </div>
          </div>

          {joinError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 font-medium">{joinError}</p>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={joining || !joinCode.trim() || !joinAccess.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {joining ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Uniéndose...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Unirse
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
