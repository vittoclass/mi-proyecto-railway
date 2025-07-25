'use client'

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SmartCameraModal } from "@/components/smart-camera-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save } from "lucide-react"

// **CAMBIO IMPORTANTE:** Ya no creamos el cliente de Supabase aquí.

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  retroalimentacion: z.string(),
  puntaje: z.string(),
  nota: z.string(),
})

export default function Page() {
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [evaluationDone, setEvaluationDone] = useState(false)
  const [evaluationsHistory, setEvaluationsHistory] = useState<any[]>([])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", curso: "", rubrica: "", retroalimentacion: "", puntaje: "", nota: "" },
  })

  // **NUEVA FUNCIÓN:** Crea un cliente de Supabase solo cuando se necesita.
  const getSupabaseClient = () => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const handleFile = (file: File) => {
    setFileToEvaluate(file)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(URL.createObjectURL(file))
    setEvaluationDone(false)
    form.reset()
  }

  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo o usa la cámara primero.");
      return;
    }
    setIsProcessing(true)
    setEvaluationDone(false)
    const supabase = getSupabaseClient(); // Obtenemos un cliente nuevo y seguro

    try {
      const filePath = `evaluaciones/${Date.now()}_${fileToEvaluate.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("imagenes")
        .upload(filePath, fileToEvaluate);

      if (uploadError) throw new Error("Error al subir el archivo a Supabase: " + uploadError.message);
      
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(uploadData.path);
      const fileUrl = urlData.publicUrl;

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: fileUrl,
          rubrica: values.rubrica,
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      form.setValue("retroalimentacion", result.retroalimentacion);
      form.setValue("puntaje", result.puntaje);
      form.setValue("nota", result.nota ? result.nota.toFixed(1) : "N/A");
      setEvaluationDone(true);

    } catch (error) {
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onSave = async () => {
    setIsProcessing(true)
    const values = form.getValues()
    const supabase = getSupabaseClient(); // Obtenemos un cliente nuevo y seguro

    // Reutilizamos la URL de la imagen que ya se subió
    const fileUrl = (await supabase.storage.from('imagenes').getPublicUrl(`evaluaciones/${fileToEvaluate!.name}`)).data.publicUrl;
    
    const finalData = { ...values, imagen: fileUrl, fecha: new Date().toISOString() };
    const { error: insertError } = await supabase.from("evaluaciones").insert([finalData]);
    
    if (insertError) {
        alert("Error al guardar en la base de datos: " + insertError.message);
    } else {
        alert("¡Evaluación guardada exitosamente!");
        setEvaluationsHistory(prev => [finalData, ...prev]);
        form.reset();
        setFileToEvaluate(null);
        setImagePreviewUrl("");
        setEvaluationDone(false);
    }
    setIsProcessing(false);
  }

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFile} />
      <main className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
        {/* Tu JSX se mantiene igual que en la versión estable */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Evaluador IA</h1>
          {/* ... etc ... */}
        </div>
        {/* ... etc ... */}
      </main>
    </>
  )
}