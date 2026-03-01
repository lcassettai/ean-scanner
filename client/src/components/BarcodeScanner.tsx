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

// @zxing — solo como fallback cuando BarcodeDetector no está disponible.
// Sin TRY_HARDER: es más lento y no aporta nada para EAN-13.
const zxingReader = new MultiFormatReader();
zxingReader.setHints(
  new Map<DecodeHintType, BarcodeFormat[] | boolean>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
  ]),
);

export default function BarcodeScanner({ onDetected, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastEanRef = useRef('');
  const lastTimeRef = useRef(0);
  const pausedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

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
    } catch { /* ignore si el navegador no lo soporta */ }
  };

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
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

    // 1. Intentar pointOfInterest (estándar W3C)
    try {
      await track.applyConstraints({
        advanced: [{ pointOfInterest: { x, y }, focusMode: 'continuous' } as MediaTrackConstraintSet],
      });
    } catch { /* ignore */ }

    // 2. Ciclo manual → continuo: fuerza un barrido de AF en Samsung y similares
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSet] });
      await new Promise<void>((r) => setTimeout(r, 80));
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!active) {
      pausedRef.current = false;
      setPaused(false);
      return;
    }

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
        // En Samsung S22 Chrome selecciona el ultra-wide por defecto, que es foco
        // fijo a distancia larga y no puede enfocar códigos de barra.
        if (capabilities.zoom && capabilities.zoom.min < 1) {
          try {
            await track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] });
          } catch { /* ignore */ }
        }

        // Autofocus continuo
        if (capabilities.focusMode?.includes('continuous')) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            });
          } catch { /* ignore */ }
        }

        if (capabilities.torch) setTorchSupported(true);

        // Intentar BarcodeDetector nativo (Chrome en Android usa ML Kit — mucho más rápido)
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

        setReady(true);

        const handleDetection = (text: string) => {
          const now = Date.now();
          const debounced = text === lastEanRef.current && now - lastTimeRef.current < 2000;
          if (!debounced) {
            lastEanRef.current = text;
            lastTimeRef.current = now;
            beep();
            setFlash(true);
            setTimeout(() => setFlash(false), 300);
            onDetected(text);
          }
        };

        if (nativeDetector) {
          // Loop async con BarcodeDetector — no necesita canvas, trabaja directo sobre el video
          (async () => {
            while (running) {
              if (!pausedRef.current && video.readyState >= video.HAVE_ENOUGH_DATA) {
                try {
                  const results = await nativeDetector!.detect(video);
                  for (const bc of results) handleDetection(bc.rawValue);
                } catch { /* ignore */ }
              }
              await new Promise<void>((r) => setTimeout(r, 80));
            }
          })();
        } else {
          // Fallback @zxing: recortar solo la banda central del frame para reducir trabajo
          const canvas = canvasRef.current!;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

          function scan() {
            if (!running) return;

            if (!pausedRef.current && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
              // Solo procesar el 50% central en altura (donde está la mira de escaneo)
              const cropY = Math.floor(video.videoHeight * 0.25);
              const cropH = Math.floor(video.videoHeight * 0.5);
              canvas.width = video.videoWidth;
              canvas.height = cropH;
              ctx.drawImage(video, 0, cropY, video.videoWidth, cropH, 0, 0, canvas.width, canvas.height);

              try {
                const luminance = new HTMLCanvasElementLuminanceSource(canvas);
                const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
                handleDetection(zxingReader.decode(bitmap).getText());
              } catch { /* NotFoundException — normal */ }
            }

            rafRef.current = requestAnimationFrame(scan);
          }

          rafRef.current = requestAnimationFrame(scan);
        }
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
      // Apagar el flash antes de cerrar el stream
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
    <>
      {/* Canvas siempre en el DOM (oculto), necesario para el stream */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Cámara: oculta cuando pausada pero el stream sigue vivo para reanudar rápido */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-black ${paused ? 'hidden' : ''}`}
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
              <div className="scan-line absolute left-2 right-2 h-0.5 bg-primary-400"
                style={{ boxShadow: '0 0 8px #4ade80' }} />
            </div>
          </div>
        )}

        {/* Flash al detectar */}
        {flash && <div className="absolute inset-0 bg-primary-400 opacity-25 rounded-2xl pointer-events-none" />}

        {/* Indicador visual de tap-to-focus */}
        {focusPoint && (
          <div
            className="absolute border-2 border-yellow-300 pointer-events-none rounded-sm"
            style={{ width: 60, height: 60, left: focusPoint.x - 30, top: focusPoint.y - 30 }}
          />
        )}

        {/* Botones de control */}
        {ready && (
          <div className="absolute bottom-3 right-3 flex gap-2 z-10">
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
              onClick={(e) => { e.stopPropagation(); togglePause(); }}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
              title="Pausar escaneo"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h3v14H6V5zm9 0h3v14h-3V5z" />
              </svg>
            </button>
          </div>
        )}

        {/* Label */}
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
            {ready ? 'Tocá para enfocar' : 'Iniciando cámara...'}
          </span>
        </div>
      </div>

      {/* Botón reanudar (reemplaza la cámara cuando está pausada) */}
      {paused && (
        <button
          onClick={togglePause}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Seguir escaneando
        </button>
      )}
    </>
  );
}
