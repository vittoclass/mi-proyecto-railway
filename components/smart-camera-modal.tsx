'use client'

import { useRef, useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera as CameraIcon, X } from "lucide-react"

interface StableCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export default function SmartCameraModal({ isOpen, onClose, onCapture }: StableCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } else {
        setError("La cámara no es compatible con este navegador.")
      }
    } catch (err) {
      setError("Permiso de cámara denegado. Habilítalo en tu navegador.")
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
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
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

  const handleRetake = () => { setCapturedImage(null); }
  const handleClose = () => { setCapturedImage(null); onClose(); }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Capturar Evidencia</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5"/></Button>
        </DialogHeader>
        <div className="relative bg-black rounded-lg aspect-video overflow-hidden">
          {capturedImage ? <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />}
          <canvas ref={canvasRef} className="hidden" />
          {error && <p className="absolute top-4 left-4 p-2 bg-red-800 bg-opacity-70 text-white rounded">{error}</p>}
        </div>
        <DialogFooter>
          {capturedImage ? (
            <>
              <Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button>
              <Button onClick={handleAccept}>Aceptar Foto</Button>
            </>
          ) : (
            <Button onClick={handleCapture} disabled={!!error} size="lg" className="w-full">
              <CameraIcon className="mr-2"/> Capturar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}