'use client'

import { useState, useRef } from "react"
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
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, X } from "lucide-react"

// --- IMPORTACIÓN DINÁMICA DE LA CÁMARA ---
const SmartCameraModal = dynamic(
  () => import('@/components/smart-camera-modal'),
  { 
    ssr: false,
    loading: () => <p className="text-center">Cargando cámara...</p> 
  }
)

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  retroalimentacion: z.string().optional(),
  puntaje: z.string().optional(),
  nota: z.string().optional(),
})

interface FilePreview {
  id: string;
  file: File;
  previewUrl: string;
}

export default function LibelIA() {
  const [filesToEvaluate, setFilesToEvaluate] = useState<FilePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [evaluationDone, setEvaluationDone] = useState(false);
  const [evaluationsHistory, setEvaluationsHistory] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", curso: "", rubrica: "", retroalimentacion: "", puntaje: "", nota: "" },
  })

  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFiles = (incomingFiles: File[]) => {
    const newFilePreviews = incomingFiles.map(file => ({
      id: `${file.name}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setFilesToEvaluate(prev => [...prev, ...newFilePreviews]);
    setEvaluationDone(false);
  };

  const removeFile = (id: string) => {
    setFilesToEvaluate(prev => prev.filter(fp => fp.id !== id));
  };

  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    if (filesToEvaluate.length === 0) {
      alert("Por favor, sube al menos un archivo.");
      return;
    }
    setIsProcessing(true);
    setEvaluationDone(false);
    const supabase = getSupabaseClient();

    try {
      const uploadPromises = filesToEvaluate.map(fp => {
        const filePath = `evaluaciones/${Date.now()}_${fp.file.name}`;
        return supabase.storage.from("imagenes").upload(filePath, fp.file);
      });
      const uploadResults = await Promise.all(uploadPromises);
      
      const uploadError = uploadResults.find(res => res.error);
      if (uploadError) throw new Error(`Error al subir a Supabase: ${uploadError.error.message}`);

      const imageUrls = uploadResults.map(res => {
        return supabase.storage.from("imagenes").getPublicUrl(res.data!.path).data.publicUrl;
      });

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: imageUrls,
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
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const onSave = async () => { /* ...Lógica para guardar... */ };

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={(file) => handleFiles([file])} />
      <main className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">LibelIA Evaluator</h1>
          <p className="text-gray-600">Sube una o varias imágenes para un estudiante.</p>
        </div>

        <Card className="mb-8">
          <CardHeader><CardTitle>1. Cargar Evidencias ({filesToEvaluate.length} archivos)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                  <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-blue-600 font-semibold">Subir Archivos</span>
                </div>
              </label>
              <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
              <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara
              </Button>
            </div>
            {filesToEvaluate.length > 0 && (
              <div className="mt-4 grid grid-cols-3 md:grid-cols-5 gap-4">
                {filesToEvaluate.map(fp => (
                  <div key={fp.id} className="relative group">
                    <img src={fp.previewUrl} alt={fp.file.name} className="w-full h-24 object-cover rounded-md" />
                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(fp.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {filesToEvaluate.length > 0 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEvaluate)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>2. Datos y Rúbrica</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nombre" render={({ field }) => (
                      <FormItem><FormLabel>Nombre del Estudiante</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormMessage>
                    )} />
                    <FormField control={form.control} name="curso" render={({ field }) => (
                      <FormItem><FormLabel>Curso</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormMessage>
                    )} />
                  </div>
                  <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem><FormLabel>Rúbrica</FormLabel><FormControl><Textarea placeholder="Pega aquí la rúbrica..." {...field} className="min-h-[150px]" /></FormControl><FormMessage /></FormMessage>
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