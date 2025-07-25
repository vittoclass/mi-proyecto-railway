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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

    const formData = new FormData()
    formData.append("file", fileToEvaluate)
    formData.append("rubrica", values.rubrica)

    try {
      const response = await fetch('/api/evaluate', { method: 'POST', body: formData })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      form.setValue("retroalimentacion", result.retroalimentacion)
      form.setValue("puntaje", result.puntaje)
      form.setValue("nota", result.nota.toFixed(1))
      setEvaluationDone(true)
    } catch (error) {
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onSave = async () => {
    setIsProcessing(true)
    const values = form.getValues()
    
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("imagenes")
        .upload(`evaluaciones/${Date.now()}_${fileToEvaluate!.name}`, fileToEvaluate!);
    
    if (uploadError) {
        alert("Error al subir el archivo de evidencia.");
        setIsProcessing(false);
        return;
    }

    const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(uploadData.path);
    
    const finalData = { ...values, imagen: urlData.publicUrl, fecha: new Date().toISOString() };
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Evaluador IA</h1>
          <p className="text-gray-600">Evalúa un estudiante a la vez con análisis multimodal.</p>
        </div>

        <Card className="mb-8">
          <CardHeader><CardTitle>1. Cargar Evidencia</CardTitle></CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
              <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                      <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-blue-600 font-semibold">Sube un archivo</span>
                  </div>
              </label>
              <input id="file-upload" type="file" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
              <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                  <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara
              </Button>
          </CardContent>
          {imagePreviewUrl && <img src={imagePreviewUrl} alt="Previsualización" className="mx-auto my-4 max-h-40 rounded-md shadow-md" />}
        </Card>

        {fileToEvaluate && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEvaluate)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>2. Datos y Rúbrica</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nombre" render={({ field }) => (
                      <FormItem><FormLabel>Nombre del Estudiante</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="curso" render={({ field }) => (
                      <FormItem><FormLabel>Curso</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem><FormLabel>Rúbrica</FormLabel><FormControl><Textarea placeholder="Pega aquí la rúbrica..." {...field} className="min-h-[150px]" /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <div className="text-center">
                <Button type="submit" disabled={isProcessing} className="w-full md:w-1/2 text-base py-6">
                  {isProcessing && !evaluationDone ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  {isProcessing && !evaluationDone ? 'La IA está evaluando...' : 'Evaluar con IA'}
                </Button>
              </div>

              {evaluationDone && (
                  <Card className="border-green-300 animate-in fade-in-50 duration-500">
                      <CardHeader><CardTitle>3. Resultado de la Evaluación</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="nota" render={({ field }) => (
                                <FormItem><FormLabel>Nota (Generada)</FormLabel><FormControl><Input {...field} readOnly className="bg-green-50 font-bold text-lg" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="puntaje" render={({ field }) => (
                                <FormItem><FormLabel>Puntaje (Generado)</FormLabel><FormControl><Input {...field} readOnly className="bg-green-50" /></FormControl></FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="retroalimentacion" render={({ field }) => (
                              <FormItem><FormLabel>Retroalimentación (Generada)</FormLabel><FormControl><Textarea {...field} readOnly className="min-h-[120px] bg-green-50" /></FormControl></FormItem>
                          )} />
                          <Button type="button" onClick={onSave} disabled={isProcessing} className="w-full text-base py-6 bg-green-600 hover:bg-green-700">
                              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                              Guardar Evaluación Final
                          </Button>
                      </CardContent>
                  </Card>
              )}
            </form>
          </Form>
        )}
      </main>
    </>
  )
}