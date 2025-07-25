'use client'

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI y tu SmartCameraModal ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SmartCameraModal } from "@/components/smart-camera-modal" // <-- Usando tu componente correcto
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save } from "lucide-react"

// Conexión a Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Esquema de validación del formulario con Zod
const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  profesor: z.string(),
  departamento: z.string(),
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  retroalimentacion: z.string(),
  puntaje: z.string(),
})

export default function Page() {
  // --- Estados para la UI y el flujo de datos ---
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("")
  const [isExtractingName, setIsExtractingName] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [evaluationDone, setEvaluationDone] = useState(false)

  // Inicialización de React Hook Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "", curso: "", profesor: "", departamento: "", rubrica: "", retroalimentacion: "", puntaje: "",
    },
  })

  // Función ÚNICA para manejar el archivo (de cámara o subida) y extraer el nombre
  const handleFileAndExtractName = async (file: File) => {
    setFileToEvaluate(file)
    if (file.type.startsWith("image/")) {
      // Limpia la URL anterior para evitar que se muestre una imagen antigua
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(URL.createObjectURL(file))
    } else {
      setImagePreviewUrl("")
    }
    
    setIsExtractingName(true)
    setEvaluationDone(false)
    form.reset() // Limpia el formulario para la nueva evaluación

    const formData = new FormData()
    formData.append("files", file)

    try {
      const response = await fetch('/api/extract-name', { method: 'POST', body: formData })
      const result = await response.json()
      if (result.success && result.name) {
        form.setValue("nombre", result.name)
        alert(`Nombre extraído con IA: ${result.name}`)
      } else {
        alert("La IA no pudo extraer el nombre. Por favor, ingrésalo manualmente.")
      }
    } catch (error) {
      alert("Error al contactar la IA para extraer el nombre.")
    } finally {
      setIsExtractingName(false)
    }
  }

  // Función que se llama al presionar "Evaluar con IA"
  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo o usa la cámara primero.");
      return;
    }
    setIsEvaluating(true);
    setEvaluationDone(false);

    const formData = new FormData();
    formData.append("file", fileToEvaluate);
    formData.append("rubrica", values.rubrica);

    try {
      const response = await fetch('/api/evaluate', { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        form.setValue("retroalimentacion", result.retroalimentacion);
        form.setValue("puntaje", result.puntaje);
        setEvaluationDone(true); // Habilita el botón de guardar
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsEvaluating(false);
    }
  };
  
  // Función final para guardar el registro completo en Supabase
  const onSave = async () => {
    if (!fileToEvaluate) return;
    
    setIsSaving(true);
    const values = form.getValues();

    // 1. Subir el archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("imagenes")
        .upload(`evaluaciones/${Date.now()}_${fileToEvaluate.name}`, fileToEvaluate);
    
    if (uploadError) {
        alert("Error al subir el archivo de evidencia a Supabase.");
        setIsSaving(false);
        return;
    }

    // 2. Obtener la URL pública del archivo
    const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(uploadData.path);
    
    // 3. Preparar los datos finales para la base de datos
    const finalData = {
        ...values,
        imagen: urlData.publicUrl,
        fecha: new Date().toISOString()
    };
    
    // 4. Insertar el registro en la tabla 'evaluaciones'
    const { error: insertError } = await supabase.from("evaluaciones").insert([finalData]);
    
    if (insertError) {
        alert("Error al guardar en la base de datos: " + insertError.message);
    } else {
        alert("¡Evaluación guardada exitosamente en Supabase!");
        // Limpiar todo para la siguiente evaluación
        form.reset();
        setFileToEvaluate(null);
        setImagePreviewUrl("");
        setEvaluationDone(false);
    }
    setIsSaving(false);
  }

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFileAndExtractName} />
      <main className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Evaluador IA LibelIA</h1>
          <p className="text-gray-600">Un flujo de trabajo inteligente para evaluaciones automáticas.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                    <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-blue-600 font-semibold">Sube un archivo</span>
                    <p className="text-xs text-gray-500">O arrástralo aquí</p>
                </div>
            </label>
            <input id="file-upload" type="file" className="hidden" onChange={(e) => e.target.files && handleFileAndExtractName(e.target.files[0])} />
            
            <Button type="button" variant="outline" className="flex-1 h-auto md:h-full" onClick={() => setIsCameraOpen(true)}>
                <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara Inteligente
            </Button>
        </div>

        {isExtractingName && <p className="text-center text-blue-600 animate-pulse font-semibold">Extrayendo nombre con IA...</p>}
        {imagePreviewUrl && <img src={imagePreviewUrl} alt="Previsualización" className="mx-auto my-4 max-h-40 rounded-md shadow-md" />}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onEvaluate)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre del Estudiante</FormLabel><FormControl><Input placeholder={isExtractingName ? "Extrayendo..." : "Se autocompletará..."} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="curso" render={({ field }) => (
                <FormItem><FormLabel>Curso</FormLabel><FormControl><Input placeholder="Ej: 8vo Básico" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="rubrica" render={({ field }) => (
                <FormItem><FormLabel>Rúbrica o Instrucciones</FormLabel><FormControl><Textarea placeholder="Pega aquí la rúbrica o las instrucciones para la IA..." {...field} className="min-h-[150px]" /></FormControl><FormMessage /></FormItem>
            )} />
            
            <Button type="submit" disabled={isEvaluating || isExtractingName || !fileToEvaluate} className="w-full text-base py-6">
              {isEvaluating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {isEvaluating ? 'La IA está evaluando...' : '1. Generar Evaluación con IA'}
            </Button>

            {evaluationDone && (
                <div className="space-y-6 border-t-2 pt-6 mt-6 border-green-300 animate-in fade-in-50 duration-500">
                    <FormField control={form.control} name="retroalimentacion" render={({ field }) => (
                        <FormItem><FormLabel>Retroalimentación (Generada por IA)</FormLabel><FormControl><Textarea {...field} className="min-h-[120px] bg-green-50" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="puntaje" render={({ field }) => (
                        <FormItem><FormLabel>Puntaje (Generado por IA)</FormLabel><FormControl><Input {...field} className="bg-green-50" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="button" onClick={onSave} disabled={isSaving} className="w-full text-base py-6 bg-green-600 hover:bg-green-700">
                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                        {isSaving ? 'Guardando en Base de Datos...' : '2. Guardar Evaluación Final'}
                    </Button>
                </div>
            )}
          </form>
        </Form>
      </main>
    </>
  )
}