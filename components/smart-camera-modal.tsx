// En: components/smart-camera-modal.tsx (VERSIÓN CON GUÍAS DE ESCANEO)

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Loader2, Camera as CameraIcon, CheckCircle } from "lucide-react"

// Pequeño hook para detectar el tamaño de la pantalla
function useMediaQuery(query: string) {
  const [value, setValue] = useState(false)
  useEffect(() => {
    function onChange(event: MediaQueryListEvent) { setValue(event.matches) }
    const result = window.matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);
    return () => result.removeEventListener("change", onChange)
  }, [query])
  return value
}

interface SmartCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export const SmartCameraModal = ({ isOpen, onClose, onCapture }: SmartCameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState("Alinea el documento con el recuadro")
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setFeedbackMessage("✅ ¡Listo para capturar!")
      }
    } catch (err) {
      setFeedbackMessage("❌ Permiso de cámara denegado.")
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
      // Capturamos en alta resolución
      canvas.width = video.videoWidth; 
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9)); // Usamos alta calidad
      stopCamera();
    }
  }

  const handleAccept = () => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onCapture(new File([blob], `captura-escaneada.jpg`, { type: 'image/jpeg' }));
          handleClose();
        }
      }, 'image/jpeg', 0.9);
    }
  }

  const handleRetake = () => { setCapturedImage(null); }
  const handleClose = () => { setCapturedImage(null); onClose(); }

  const CameraUI = (
    <div className="relative bg-black rounded-lg aspect-video overflow-hidden">
        {capturedImage ? <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Guía de Escaneo Superpuesta */}
        {!capturedImage &&
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[90%] h-[85%] border-4 border-dashed border-white border-opacity-70 rounded-lg" />
                <div className="absolute bottom-4 p-2 bg-black bg-opacity-60 rounded-lg text-white text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>{feedbackMessage}</span>
                </div>
            </div>
        }
    </div>
  )

  const FooterButtons = (
     <>
        {capturedImage ? (<><Button onClick={handleRetake} variant="outline">Tomar de Nuevo</Button><Button onClick={handleAccept}>Aceptar y Usar Foto</Button></>) 
        : (<Button onClick={handleCapture} size="lg">Tomar Foto</Button>)}
     </>
  )

  const content = (
    <>
      <div className="px-4 md:px-0"> {CameraUI} </div>
      <div className="flex justify-end gap-2 p-4 pt-2 md:p-0 md:pt-4"> {FooterButtons} </div>
    </>
  )
  
  if (isDesktop) {
    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl p-6">
                <DialogHeader><DialogTitle>Escáner de Documentos</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4">{content}</div>
            </DialogContent>
        </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
        <DrawerContent>
            <DrawerHeader><DrawerTitle>Escáner de Documentos</DrawerTitle></DrawerHeader>
            <div className="flex flex-col gap-4">{content}</div>
        </DrawerContent>
    </Drawer>
  )
}