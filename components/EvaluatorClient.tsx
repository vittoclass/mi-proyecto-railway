'use client'

import { useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'

// --- Componentes de UI ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save } from "lucide-react"

// **CAMBIO CLAVE:** La importación dinámica AHORA SE MUEVE DENTRO DEL COMPONENTE

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  retroalimentacion: z.string().optional(),
  puntaje: z.string().optional(),
  nota: z.string().optional(),
})

export default function EvaluatorClient() {
  // --- IMPORTACIÓN DINÁMICA DENTRO DEL COMPONENTE ---
  const SmartCameraModal = dynamic(
    () => import('@/components/smart-camera-modal').then(mod => mod.SmartCameraModal),
    { 
      ssr: false,
      loading: () => <p>Cargando cámara...</p> 
    }
  )

  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [evaluationDone, setEvaluationDone] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", curso: "", rubrica: "", retroalimentacion: "", puntaje: "", nota: "" },
  })

  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFile = (file: File) => {
    setFileToEvaluate(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    setEvaluationDone(false);
    form.reset();
  }

  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo.");
      return;
    }
    setIsProcessing(true);
    const supabase = getSupabaseClient();
    try {
      const filePath = `evaluaciones/${Date.now()}_${fileToEvaluate.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("imagenes").upload(filePath, fileToEvaluate);
      if (uploadError) throw new Error(`Error al subir a Supabase: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(uploadData.path);
      const fileUrl = urlData.publicUrl;

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, rubrica: values.rubrica })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      form.setValue("retroalimentacion", result.retroalimentacion);
      form.setValue("puntaje", result.puntaje);
      form.setValue("nota", result.nota ? result.nota.toFixed(1) : "N/A");
      setEvaluationDone(true);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  }
  
  const onSave = async () => { /* ... */ }

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFile} />
      <main className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
        {/* Tu JSX completo aquí */}
      </main>
    </>
  )
}