// smart-camera-modal.tsx
'use client';

import { useState, useRef } from 'react';

interface Props {
  onCapture: (fileUrl: string) => void;
}

export default function SmartCameraModal({ onCapture }: Props) {
  const [streaming, setStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      alert('No se pudo acceder a la cámara.');
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageUrl = canvas.toDataURL('image/png');
        setCapturedImage(imageUrl);
        onCapture(imageUrl); // Aquí se pasa la URL al padre
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setStreaming(false);
      setCapturedImage(null);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium mb-2">Cámara inteligente</h2>
      {!streaming ? (
        <button
          onClick={startCamera}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Iniciar Cámara
        </button>
      ) : (
        <div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-w-sm border rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={captureImage}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Capturar
            </button>
            <button
              onClick={stopCamera}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Detener
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {capturedImage && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Imagen capturada:</p>
          <img src={capturedImage} alt="Capturada" className="mt-1 max-w-xs border rounded" />
        </div>
      )}
    </div>
  );
}