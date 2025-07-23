"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useMediaPipe } from "@/hooks/use-media-pipe"
import { Loader2, CheckCircle } from "lucide-react"

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

  const { isLoading, error, detectObjects } = useMediaPipe()

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      console.error("Error al acceder a la cámara:", err)
      setFeedbackMessage("❌ No se pudo acceder a la cámara.")
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera])
  
  const detectionLoop = useCallback(() => {
    if (!videoRef.current || !detectionBoxRef.current || capturedImage) return

    const detected = detectObjects(videoRef.current)
    if (detected.length > 0 && detected[0].label === 'book') {
        const { x, y, width, height } = detected[0].boundingBox
        const video = videoRef.current
        detectionBoxRef.current.style.display = 'block'
        detectionBoxRef.current.style.left = `${(x / video.videoWidth) * 100}%`
        detectionBoxRef.current.style.top = `${(y / video.videoHeight) * 100}%`
        detectionBoxRef.current.style.width = `${(width / video.videoWidth) * 100}%`
        detectionBoxRef.current.style.height = `${(height / video.videoHeight) * 100}%`
        setFeedbackMessage("✅ Documento detectado. ¡Mantén la cámara estable!")
        setIsCaptureEnabled(true)
    } else {
        if(detectionBoxRef.current) detectionBoxRef.current.style.display = 'none'
        setFeedbackMessage("Buscando documento...")
        setIsCaptureEnabled(false)
    }
    requestAnimationFrame(detectionLoop)
  }, [detectObjects, capturedImage])

  useEffect(() => {
      if (isOpen && !isLoading) {
          const frameId = requestAnimationFrame(detectionLoop)
          return () => cancelAnimationFrame(frameId)
      }
  }, [isOpen, isLoading, detectionLoop])

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current; const video = videoRef.current
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      setCapturedImage(canvas.toDataURL('image/jpeg'))
      stopCamera()
    }
  }

  const handleAccept = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onCapture(new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' }))
          handleClose()
        }
      }, 'image/jpeg')
    }
  }

  const handleRetake = () => { setCapturedImage(null); startCamera() }
  const handleClose = () => { setCapturedImage(null); onClose() }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Cámara Inteligente</DialogTitle></DialogHeader>
        <div className="relative">
          {capturedImage ? <img src={capturedImage} alt="Captura" className="rounded-lg" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto rounded-lg" />}
          <canvas ref={canvasRef} className="hidden" />
          <div ref={detectionBoxRef} className="absolute border-2 border-green-500 rounded-lg" style={{ display: 'none' }} />
          {isLoading && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 text-white animate-spin" /><p className="ml-2 text-white">Cargando IA de la cámara...</p></div>}
          {error && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg"><p className="text-red-500">{error}</p></div>}
          {!capturedImage && !isLoading && !error && (
            <div className={`absolute bottom-4 left-4 p-2 rounded-lg text-white text-sm flex items-center gap-2 ${isCaptureEnabled ? 'bg-green-600' : 'bg-black bg-opacity-50'}`}>
              {isCaptureEnabled ? <CheckCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          {capturedImage ? (<><Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button><Button onClick={handleAccept}>Aceptar y Usar Foto</Button></>) 
          : (<Button onClick={handleCapture} disabled={isLoading || !isCaptureEnabled}>Tomar Foto</Button>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}