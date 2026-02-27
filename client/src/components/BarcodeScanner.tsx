import { useEffect, useRef, useState } from 'react';
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  BarcodeFormat,
  DecodeHintType,
} from '@zxing/library';
import { HTMLCanvasElementLuminanceSource } from '@zxing/browser';

interface Props {
  onDetected: (ean: string) => void;
  active: boolean;
}

const reader = new MultiFormatReader();
reader.setHints(
  new Map<DecodeHintType, BarcodeFormat[] | boolean>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ]),
);

export default function BarcodeScanner({ onDetected, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastEanRef = useRef('');
  const lastTimeRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;

    let running = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!running) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        function scan() {
          if (!running) return;

          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            try {
              const luminance = new HTMLCanvasElementLuminanceSource(canvas);
              const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
              const result = reader.decode(bitmap);
              const text = result.getText();
              const now = Date.now();

              // Debounce por-EAN: 2s para el mismo código
              const debounced = text === lastEanRef.current && now - lastTimeRef.current < 2000;
              if (!debounced) {
                lastEanRef.current = text;
                lastTimeRef.current = now;
                setFlash(true);
                setTimeout(() => setFlash(false), 300);
                onDetected(text);
              }
            } catch {
              // NotFoundException por frame sin código — normal
            }
          }

          rafRef.current = requestAnimationFrame(scan);
        }

        rafRef.current = requestAnimationFrame(scan);
      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Habilitá el acceso en el navegador.');
        } else {
          setError('No se pudo acceder a la cámara: ' + err.message);
        }
      }
    }

    start();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [active, onDetected]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 rounded-2xl h-56 text-center px-6">
        <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ height: '260px' }}>
      {/* Canvas oculto para procesar frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video visible */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Overlay */}
      {ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`relative w-64 h-28 transition-opacity duration-100 ${flash ? 'opacity-0' : 'opacity-100'}`}>
            {/* Esquinas */}
            <div className="absolute top-0 left-0 w-8 h-8 border-primary-400"
              style={{ borderTopWidth: 3, borderLeftWidth: 3 }} />
            <div className="absolute top-0 right-0 w-8 h-8 border-primary-400"
              style={{ borderTopWidth: 3, borderRightWidth: 3 }} />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-primary-400"
              style={{ borderBottomWidth: 3, borderLeftWidth: 3 }} />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-primary-400"
              style={{ borderBottomWidth: 3, borderRightWidth: 3 }} />
            {/* Línea animada */}
            <div
              className="scan-line absolute left-2 right-2 h-0.5 bg-primary-400"
              style={{ boxShadow: '0 0 8px #4ade80' }}
            />
          </div>
        </div>
      )}

      {/* Flash al detectar */}
      {flash && <div className="absolute inset-0 bg-primary-400 opacity-25 rounded-2xl" />}

      {/* Estado */}
      <div className="absolute bottom-3 left-0 right-0 text-center">
        <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
          {ready ? 'Apuntá al código de barras' : 'Iniciando cámara...'}
        </span>
      </div>
    </div>
  );
}
