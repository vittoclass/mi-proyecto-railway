'use client'

import { useRef, useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Camera as CameraIcon, Zap } from "lucide-react"

interface SmartCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export const SmartCameraModal = ({ isOpen, onClose, onCapture }: SmartCameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } else {
        setError("La cámara no es compatible con este navegador.")
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err)
      setError("Permiso de cámara denegado. Habilítalo en la configuración de tu navegador.")
    }
  }, [])
  
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [isOpen, capturedImage, startCamera, stopCamera])

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current; 
      const video = videoRef.current;
      canvas.width = video.videoWidth; 
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
      }
    }
  }

  const handleAccept = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onCapture(new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          handleClose();
        }
      }, 'image/jpeg', 0.9);
    }
  }

  const handleRetake = () => { setCapturedImage(null); }
  const handleClose = () => { setCapturedImage(null); onClose(); }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>Capturar Documento</DialogTitle></DialogHeader>
        <div className="relative bg-black rounded-lg aspect-video overflow-hidden">
          {capturedImage ? <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />}
          <canvas ref={canvasRef} className="hidden" />
          {error && <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg"><p className="text-red-400 text-center max-w-xs">{error}</p></div>}
        </div>
        <DialogFooter>
          {capturedImage ? (
            <>
              <Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button>
              <Button onClick={handleAccept}>Aceptar y Usar Foto</Button>
            </>
          ) : (
            <Button onClick={handleCapture} disabled={!!error} size="lg">
              <CameraIcon className="mr-2"/> Tomar Foto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}