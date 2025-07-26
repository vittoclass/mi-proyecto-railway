'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

export default function SmartCameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vision, setVision] = useState<any>(null); // Para cargar MediaPipe dinámicamente

  // Cargar @mediapipe/tasks-vision solo en el cliente y cuando se abre el modal
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);

      async function loadVision() {
        try {
          const vision = await import('@mediapipe/tasks-vision');
          setVision(vision);
          startCamera();
        } catch (err) {
          console.error('Error al cargar MediaPipe:', err);
          setError('No se pudo cargar la cámara. Intenta de nuevo.');
        } finally {
          setLoading(false);
        }
      }

      loadVision();
    }

    return () => {
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      }
    };
  }, [open]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara.');
      console.error(err);
    }
  };

  const captureImage = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      }
    }, 'image/jpeg');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Capturar con Cámara</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-red-600 text-center mb-4">{error}</div>
          ) : loading ? (
            <div className="text-center mb-4">Cargando cámara...</div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-md mb-4"
              />
              <Button
                onClick={captureImage}
                className="w-full"
                disabled={!vision}
              >
                <Camera className="mr-2 h-5 w-5" /> Capturar Foto
              </Button>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}