import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-gray-100">
      <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
        {offlineReady ? (
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </div>
      <p className="flex-1 text-sm text-gray-700">
        {offlineReady ? 'App lista para usar sin internet' : 'Nueva versión disponible'}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            Actualizar
          </button>
        )}
        <button
          onClick={() => { setOfflineReady(false); setNeedRefresh(false); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
