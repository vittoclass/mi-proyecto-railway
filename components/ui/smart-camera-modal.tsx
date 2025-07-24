"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useMediaPipe } from "@/hooks/use-media-pipe"
import { Loader2, CheckCircle, CameraOff, AlertTriangle } from "lucide-react"

interface SmartCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export const SmartCameraModal = ({ isOpen, onClose, onCapture }: SmartCameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState("Buscando documento...")
  const [isCaptureEnabled, setIsCaptureEnabled] = useState(false)
  const detectionBoxRef = useRef<HTMLDivElement>(null)
  const animationFrameId = useRef<number>()
  
  const { isLoading, error, detectObjects } = useMediaPipe()

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err) {
        console.error("Error al acceder a la cámara:", err)
        setFeedbackMessage("❌ Permiso de cámara denegado.")
      }
    } else {
        setFeedbackMessage("❌ La cámara no es compatible con este navegador.")
    }
  }, [])
  
  useEffect(() => {
    if (isOpen) {
      startCamera()
    }
    return () => stopCamera()
  }, [isOpen, startCamera, stopCamera])

  const detectionLoop = useCallback(() => {
    if (isOpen && !isLoading && !error && videoRef.current && detectionBoxRef.current && !capturedImage) {
        const detected = detectObjects(videoRef.current)
        if (detected.length > 0 && detected.some(d => d.label === 'book')) {
            const doc = detected[0];
            const { x, y, width, height } = doc.boundingBox;
            const video = videoRef.current;
            const box = detectionBoxRef.current;

            box.style.display = 'block';
            box.style.left = `${(x / video.videoWidth) * 100}%`;
            box.style.top = `${(y / video.videoHeight) * 100}%`;
            box.style.width = `${(width / video.videoWidth) * 100}%`;
            box.style.height = `${(height / video.videoHeight) * 100}%`;

            setFeedbackMessage("✅ Documento detectado. ¡Mantén la cámara estable!");
            setIsCaptureEnabled(true);
        } else {
            if(detectionBoxRef.current) detectionBoxRef.current.style.display = 'none';
            setFeedbackMessage("Apunte al documento...");
            setIsCaptureEnabled(false);
        }
        animationFrameId.current = requestAnimationFrame(detectionLoop)
    }
  }, [detectObjects, capturedImage, isOpen, isLoading, error])
  
  useEffect(() => {
      if (isOpen && !isLoading && !error) {
          detectionLoop();
      }
      return () => {
          if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      }
  }, [isOpen, isLoading, error, detectionLoop])

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current; 
      const video = videoRef.current;
      canvas.width = video.videoWidth; 
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg'));
      stopCamera();
    }
  }

  const handleAccept = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onCapture(new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          handleClose();
        }
      }, 'image/jpeg');
    }
  }

  const handleRetake = () => { setCapturedImage(null); startCamera(); }
  const handleClose = () => { setCapturedImage(null); onClose(); }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>Cámara Inteligente</DialogTitle></DialogHeader>
        <div className="relative bg-black rounded-lg aspect-video">
          {capturedImage ? <img src={capturedImage} alt="Captura" className="rounded-lg w-full h-full object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain rounded-lg" />}
          <canvas ref={canvasRef} className="hidden" />
          <div ref={detectionBoxRef} className="absolute border-4 border-green-400 rounded-lg transition-all duration-200 pointer-events-none" style={{ display: 'none' }} />
          
          {isLoading && <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 text-white animate-spin" /><p className="mt-2 text-white">Cargando IA de la cámara...</p></div>}
          {error && <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg"><CameraOff className="w-12 h-12 text-red-400 mb-2"/><p className="text-red-400 text-center max-w-xs">{error}</p></div>}
          
          {!capturedImage && !isLoading && !error && (
            <div className={`absolute bottom-4 left-4 p-2 rounded-lg text-white text-sm flex items-center gap-2 transition-colors ${isCaptureEnabled ? 'bg-green-600' : 'bg-black bg-opacity-50'}`}>
              {isCaptureEnabled ? <CheckCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          {capturedImage ? (<><Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button><Button onClick={handleAccept}>Aceptar y Usar Foto</Button></>) 
          : (<Button onClick={handleCapture} disabled={isLoading || !!error || !isCaptureEnabled} size="lg">Tomar Foto</Button>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}