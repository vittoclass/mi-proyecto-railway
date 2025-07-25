'use client'

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// ... (todos tus imports de componentes de UI)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
  // ... (otros campos)
});

export default function Page() {
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [evaluationDone, setEvaluationDone] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({ /* ... */ });

  const handleFile = (file: File) => {
    setFileToEvaluate(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    setEvaluationDone(false);
  }

  // --- FUNCIÓN onEvaluate TOTALMENTE REDISEÑADA ---
  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo primero.");
      return;
    }
    setIsProcessing(true)
    setEvaluationDone(false)

    try {
      // 1. Subir el archivo a Supabase PRIMERO para obtener la URL
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("imagenes")
        .upload(`evaluaciones/${Date.now()}_${fileToEvaluate.name}`, fileToEvaluate);

      if (uploadError) throw new Error("Error al subir el archivo a Supabase: " + uploadError.message);
      
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(uploadData.path);
      const fileUrl = urlData.publicUrl;

      // 2. Enviar un JSON limpio a la API
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: fileUrl, // Enviamos la URL, no el archivo
          rubrica: values.rubrica,
          flexibilidad: 3 // Este valor lo podemos añadir al formulario después
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      form.setValue("retroalimentacion", result.retroalimentacion);
      form.setValue("puntaje", result.puntaje);
      form.setValue("nota", result.nota.toFixed(1));
      setEvaluationDone(true);

    } catch (error) {
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  }

  // ... (El resto de tus funciones y el JSX se mantienen igual)
  return (
      // Tu JSX aquí
  )
}