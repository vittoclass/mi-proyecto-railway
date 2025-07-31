// components/smart-camera-modal.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCcw, Check, X as XIcon } from 'lucide-react';

interface SmartCameraModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export default function SmartCameraModal({ onCapture, onClose }: SmartCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inicia la cámara al montar el componente
  useEffect(() => {
    let mediaStream: MediaStream;
    
    async function setupCamera() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prioriza la cámara trasera
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
      } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        setError("No se pudo acceder a la cámara. Asegúrate de haber dado los permisos necesarios.");
      }
    }

    setupCamera();

    // Limpieza: detiene la cámara cuando el componente se desmonta
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Ajusta el canvas al tamaño del video para máxima calidad
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Dibuja el frame actual del video en el canvas
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        // Convierte el canvas a una imagen DataURL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Calidad del 90%
        setCapturedImage(dataUrl);
      }
    }
  }, []);

  const handleRetake = () => {
    setCapturedImage(null);
  };
  
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose(); // Cierra el modal después de confirmar
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white rounded-lg shadow-2xl p-4 md:p-6 w-11/12 max-w-2xl text-center relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200">
          <XIcon className="h-6 w-6 text-gray-600" />
        </button>

        <h2 className="text-xl font-bold mb-4">Cámara Inteligente</h2>
        
        {error && <p className="text-red-500 bg-red-50 p-3 rounded-md">{error}</p>}
        
        <div className="w-full aspect-video bg-gray-900 rounded-md overflow-hidden mb-4 relative">
          {capturedImage ? (
            <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
          )}
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>

        {!capturedImage ? (
          <>
            <p className="text-gray-600 mb-4">Enfoca claramente el nombre del estudiante y presiona capturar.</p>
            <button onClick={handleCapture} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              <Camera /> Capturar Foto
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">Revisa la calidad de la imagen. ¿Es nítida y legible?</p>
            <div className="flex gap-4">
              <button onClick={handleRetake} className="w-full flex items-center justify-center gap-2 bg-gray-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                <RefreshCcw /> Tomar de Nuevo
              </button>
              <button onClick={handleConfirm} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors">
                <Check /> Confirmar y Usar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}