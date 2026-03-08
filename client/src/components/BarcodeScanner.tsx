import { useEffect, useRef, useState, useCallback } from 'react';
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

// @zxing — solo como fallback cuando BarcodeDetector no está disponible.
const zxingReader = new MultiFormatReader();
zxingReader.setHints(
  new Map<DecodeHintType, BarcodeFormat[] | boolean>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
  ]),
);

export default function BarcodeScanner({ onDetected, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastEanRef = useRef('');
  const lastTimeRef = useRef(0);
  // Función de captura asignada después de iniciar la cámara
  const captureRef = useRef<(() => Promise<string | null>) | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const beep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1850;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch { /* ignore */ }
  };

  const toggleTorch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { /* ignore */ }
  };

  // Tap-to-focus
  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ready) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setFocusPoint(null), 900);

    try {
      // POI + continuous en una sola llamada: así Chrome Android lo aplica correctamente
      await track.applyConstraints({
        advanced: [{ pointOfInterest: { x, y }, focusMode: 'continuous' } as MediaTrackConstraintSet],
      });
    } catch { /* ignore */ }
  };

  // Captura un frame y devuelve el EAN encontrado (o null)
  const handleCapture = useCallback(async () => {
    if (!captureRef.current || scanning || !ready) return;
    setScanning(true);
    setNotFound(false);

    const result = await captureRef.current();

    if (result) {
      const now = Date.now();
      const debounced = result === lastEanRef.current && now - lastTimeRef.current < 2000;
      if (!debounced) {
        lastEanRef.current = result;
        lastTimeRef.current = now;
        beep();
        setFlash(true);
        setTimeout(() => setFlash(false), 300);
        onDetected(result);
      }
    } else {
      setNotFound(true);
      setTimeout(() => setNotFound(false), 1200);
    }

    setScanning(false);
  }, [scanning, ready, onDetected]);

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

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
          zoom?: { min: number; max: number; step: number };
          focusMode?: string[];
        };

        // Forzar cámara principal evitando el ultra-wide (< 1x).
        if (capabilities.zoom && capabilities.zoom.min < 1) {
          try {
            await track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] });
          } catch { /* ignore */ }
        }

        // Autofocus — forzar búsqueda desde distancia corta para productos cercanos
        if (capabilities.focusMode?.includes('continuous')) {
          try {
            // 1. POI central + continuous juntos (un solo applyConstraints)
            await track.applyConstraints({
              advanced: [{ pointOfInterest: { x: 0.5, y: 0.5 }, focusMode: 'continuous' } as MediaTrackConstraintSet],
            });
            // 2. Intentar sembrar la distancia de enfoque con un valor cercano
            //    antes de volver a continuo, para que el AF no parta desde infinito.
            const extCap = capabilities as MediaTrackCapabilities & { focusDistance?: { min: number; max: number } };
            if (extCap.focusDistance && capabilities.focusMode?.includes('manual')) {
              const nearDist = Math.max(extCap.focusDistance.min ?? 0, 0.12); // ~12 cm
              await track.applyConstraints({
                advanced: [{ focusMode: 'manual', focusDistance: nearDist } as MediaTrackConstraintSet],
              });
              await new Promise<void>((r) => setTimeout(r, 200));
              await track.applyConstraints({
                advanced: [{ pointOfInterest: { x: 0.5, y: 0.5 }, focusMode: 'continuous' } as MediaTrackConstraintSet],
              });
            } else if (capabilities.focusMode?.includes('manual')) {
              // Fallback sin focusDistance: manual breve → continuous
              await track.applyConstraints({
                advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSet],
              });
              await new Promise<void>((r) => setTimeout(r, 150));
              await track.applyConstraints({
                advanced: [{ pointOfInterest: { x: 0.5, y: 0.5 }, focusMode: 'continuous' } as MediaTrackConstraintSet],
              });
            }
          } catch { /* ignore */ }
        }

        if (capabilities.torch) setTorchSupported(true);

        // Intentar BarcodeDetector nativo
        type NativeDetector = { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
        let nativeDetector: NativeDetector | null = null;
        try {
          if ('BarcodeDetector' in window) {
            const BD = (window as any).BarcodeDetector;
            const supported: string[] = await BD.getSupportedFormats();
            if (supported.includes('ean_13')) {
              nativeDetector = new BD({ formats: ['ean_13'] }) as NativeDetector;
            }
          }
        } catch { /* no disponible, usar @zxing */ }

        if (nativeDetector) {
          captureRef.current = async () => {
            const v = videoRef.current!;
            if (v.readyState < v.HAVE_ENOUGH_DATA) return null;
            try {
              const results = await nativeDetector!.detect(v);
              return results.length > 0 ? results[0].rawValue : null;
            } catch {
              return null;
            }
          };
        } else {
          // Fallback @zxing: captura el frame completo al momento del botón
          const canvas = canvasRef.current!;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          captureRef.current = async () => {
            const v = videoRef.current!;
            if (v.readyState < v.HAVE_ENOUGH_DATA || v.videoWidth === 0) return null;
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            try {
              const luminance = new HTMLCanvasElementLuminanceSource(canvas);
              const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
              return zxingReader.decode(bitmap).getText();
            } catch {
              return null;
            }
          };
        }

        setReady(true);
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
      captureRef.current = null;
      try {
        streamRef.current?.getVideoTracks()[0]?.applyConstraints({
          advanced: [{ torch: false } as MediaTrackConstraintSet],
        });
      } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTorchOn(false);
      setTorchSupported(false);
      setReady(false);
    };
  }, [active, restartKey]);

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
    <>
      {/* Canvas oculto para captura con @zxing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Vista de cámara */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-black"
        style={{ height: '260px' }}
        onClick={handleTapToFocus}
      >
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {/* Mira de escaneo */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`relative w-64 h-28 transition-opacity duration-100 ${flash ? 'opacity-0' : 'opacity-100'}`}>
              <div className="absolute top-0 left-0 w-8 h-8 border-primary-400"
                style={{ borderTopWidth: 3, borderLeftWidth: 3 }} />
              <div className="absolute top-0 right-0 w-8 h-8 border-primary-400"
                style={{ borderTopWidth: 3, borderRightWidth: 3 }} />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-primary-400"
                style={{ borderBottomWidth: 3, borderLeftWidth: 3 }} />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-primary-400"
                style={{ borderBottomWidth: 3, borderRightWidth: 3 }} />
            </div>
          </div>
        )}

        {/* Flash al detectar */}
        {flash && <div className="absolute inset-0 bg-primary-400 opacity-25 rounded-2xl pointer-events-none" />}

        {/* Flash rojo cuando no encontró código */}
        {notFound && <div className="absolute inset-0 bg-red-400 opacity-20 rounded-2xl pointer-events-none" />}

        {/* Indicador visual de tap-to-focus */}
        {focusPoint && (
          <div
            className="absolute border-2 border-yellow-300 pointer-events-none rounded-sm"
            style={{ width: 60, height: 60, left: focusPoint.x - 30, top: focusPoint.y - 30 }}
          />
        )}

        {/* Botones torch + reiniciar */}
        {ready && (
          <div className="absolute bottom-3 right-3 z-10 flex gap-2">
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={`rounded-full p-2.5 transition-colors ${torchOn ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'bg-black/50 hover:bg-black/70 text-white'}`}
                title={torchOn ? 'Apagar flash' : 'Encender flash'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setRestartKey((k) => k + 1); }}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
              title="Reiniciar cámara"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}

        {/* Label estado */}
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
            {!ready
              ? 'Iniciando cámara...'
              : notFound
              ? 'No se encontró código'
              : 'Tocá para enfocar'}
          </span>
        </div>
      </div>

      {/* Botón de captura */}
      <button
        onClick={handleCapture}
        disabled={!ready || scanning}
        className={`w-full mt-3 py-3 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-colors ${
          !ready || scanning
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : notFound
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'btn-primary'
        }`}
      >
        {scanning ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Leyendo...
          </>
        ) : notFound ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            No encontrado — intentar de nuevo
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Escanear código
          </>
        )}
      </button>
    </>
  );
}
