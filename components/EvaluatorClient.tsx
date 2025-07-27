'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod" // <-- **ESTA ES LA LÍNEA QUE FALTABA**
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Sparkles, FileUp } from "lucide-react"

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
})

export default function EvaluatorClient() {
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<{ retro: string; nota: string, puntaje: string } | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", curso: "", rubrica: "" },
  })
  
  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileToEvaluate(file)
      setImagePreviewUrl(URL.createObjectURL(file))
      setEvaluationResult(null)
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo.");
      return;
    }
    setIsProcessing(true);
    setEvaluationResult(null);
    const supabase = getSupabaseClient();
    try {
      const filePath = `evaluaciones/${Date.now()}_${fileToEvaluate.name}`;
      const { error: uploadError } = await supabase.storage.from("imagenes").upload(filePath, fileToEvaluate);
      if (uploadError) throw new Error(`Error en Supabase: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(filePath);
      
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: urlData.publicUrl, rubrica: values.rubrica })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setEvaluationResult({ retro: result.retroalimentacion, nota: result.nota.toFixed(1), puntaje: result.puntaje });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto font-sans">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Evaluador IA (Versión Estable)</h1>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>1. Sube la Evidencia</CardTitle></CardHeader>
            <CardContent>
              <label htmlFor="file-upload" className="cursor-pointer border-2 border-dashed rounded-lg p-12 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <span className="text-blue-600 font-semibold">Haz clic para subir un archivo</span>
              </label>
              <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} />
              {imagePreviewUrl && <img src={imagePreviewUrl} alt="Previsualización" className="mt-4 max-h-40 rounded-md shadow-md mx-auto" />}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>2. Datos y Rúbrica</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="curso" render={({ field }) => (
                <FormItem><FormLabel>Curso</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rubrica" render={({ field }) => (
                <FormItem><FormLabel>Rúbrica</FormLabel><FormControl><Textarea {...field} className="min-h-[120px]" /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Button type="submit" disabled={isProcessing} className="w-full text-lg py-6">
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
            {isProcessing ? 'Evaluando...' : 'Evaluar con IA'}
          </Button>

          {evaluationResult && (
            <Card className="border-green-400">
              <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <h3 className="text-2xl font-bold">Nota: {evaluationResult.nota}</h3>
                <p className="font-semibold">Puntaje: {evaluationResult.puntaje}</p>
                <p className="text-sm bg-gray-50 p-3 rounded-md">{evaluationResult.retro}</p>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </main>
  );
}