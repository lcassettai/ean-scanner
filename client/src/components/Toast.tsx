interface ToastProps {
  show: boolean;
  message?: string;
}

export default function Toast({ show, message = 'Texto copiado' }: ToastProps) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all duration-300 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}
