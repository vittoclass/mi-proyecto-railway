"use client"

import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, X } from "lucide-react"

type CaptureMode = "sm_vf" | "terminos_pareados" | "desarrollo" | null
interface CameraFeedback {
  confidence: number
}

interface SmartCameraModalProps {
  onCapture: (dataUrl: string, feedback?: CameraFeedback) => void
  onClose: () => void
  captureMode?: CaptureMode
  onFeedbackChange?: Dispatch<SetStateAction<CameraFeedback | null>>
  currentFeedback?: CameraFeedback | null
}

export default function SmartCameraModal({
  onCapture,
  onClose,
  captureMode,
  onFeedbackChange,
  currentFeedback,
}: SmartCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [confidence, setConfidence] = useState(1.0)

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("No se pudo acceder a la cámara")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/png")
        onCapture(dataUrl, { confidence })
        stopCamera()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Captura de Imagen - {captureMode || "General"}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                stopCamera()
                onClose()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>Posiciona la evaluación dentro del marco y captura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex justify-center gap-4">
            <Button onClick={handleCapture} size="lg">
              <Camera className="mr-2 h-5 w-5" />
              Capturar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                stopCamera()
                onClose()
              }}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
