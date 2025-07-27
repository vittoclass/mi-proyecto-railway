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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Cámara ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      alert('No se pudo acceder a la cámara. ¿Permisos denegados?');
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
        onCapture(imageUrl);
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

  // --- Subir imagen desde archivo ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = reader.result as string;
        setCapturedImage(imageUrl);
        onCapture(imageUrl); // Envía la URL al padre
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium mb-2">Capturar o subir imagen</h2>

      {/* Botones principales */}
      <div className="flex flex-wrap gap-3 mb-4">
        {!streaming ? (
          <button
            type="button"
            onClick={startCamera}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md transition"
          >
            📷 Abrir Cámara
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={captureImage}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md"
            >
              ✅ Capturar Foto
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded-md"
            >
              ⏹ Detener
            </button>
          </div>
        )}

        {/* Botón para subir desde archivo */}
        <button
          type="button"
          onClick={triggerFileInput}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-md"
        >
          📁 Subir Imagen
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Vista previa de la cámara */}
      {streaming && (
        <div className="mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-md border border-gray-300 rounded-lg mx-auto"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Imagen capturada o subida */}
      {capturedImage && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Imagen seleccionada:</p>
          <img
            src={capturedImage}
            alt="Previsualización"
            className="max-w-xs border border-gray-300 rounded-lg mx-auto"
          />
        </div>
      )}
    </div>
  );
}