"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useMediaPipe } from "@/hooks/use-media-pipe" // Asegúrate que la ruta sea correcta
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react"

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

  const { isLoading, isReady, error, detectedObjects, processFrame, cleanup, initialize } = useMediaPipe()

  useEffect(() => {
    if (isOpen) {
      initialize()
    } else {
      cleanup()
      stopCamera()
    }
  }, [isOpen, initialize, cleanup])

  useEffect(() => {
    if (isReady && !capturedImage) {
        startCamera()
        const loop = () => {
            if (videoRef.current) {
                processFrame(videoRef.current)
            }
            requestAnimationFrame(loop)
        }
        const frameId = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(frameId)
    }
  }, [isReady, capturedImage, processFrame])

  useEffect(() => {
    if (detectedObjects.length > 0 && detectedObjects.some(d => d.label === 'book' || d.label === 'paper')) {
      setFeedbackMessage("✅ Documento detectado. ¡Mantén la cámara estable!")
      setIsCaptureEnabled(true)
    } else {
      setFeedbackMessage("Buscando documento...")
      setIsCaptureEnabled(false)
    }
  }, [detectedObjects])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err)
      setFeedbackMessage("❌ No se pudo acceder a la cámara.")
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      context?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg')
      setCapturedImage(dataUrl)
      stopCamera()
    }
  }

  const handleAccept = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
          handleClose()
        }
      }, 'image/jpeg')
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
    startCamera()
  }

  const handleClose = () => {
    setCapturedImage(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cámara Inteligente</DialogTitle>
        </DialogHeader>
        <div className="relative">
            {capturedImage ? (
                <img src={capturedImage} alt="Captura" className="rounded-lg" />
            ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg" />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {isLoading && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 text-white animate-spin" /><p className="ml-2 text-white">Cargando IA...</p></div>}

            {!capturedImage && isReady && (
                <div className={`absolute bottom-4 left-4 p-2 rounded-lg text-white text-sm flex items-center gap-2 ${isCaptureEnabled ? 'bg-green-600' : 'bg-black bg-opacity-50'}`}>
                    {isCaptureEnabled ? <CheckCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{feedbackMessage}</span>
                </div>
            )}
        </div>
        <DialogFooter>
          {capturedImage ? (
            <>
              <Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button>
              <Button onClick={handleAccept}>Aceptar y Usar esta Foto</Button>
            </>
          ) : (
            <Button onClick={handleCapture} disabled={!isReady || !isCaptureEnabled}>Tomar Foto</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}