'use client'

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI y el nuevo Modal ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import CameraModal from "@/components/camera-modal" // <-- Nueva importación
import { Camera as CameraIcon } from "lucide-react"

// Conexión a Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Esquema de validación del formulario con Zod
const formSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  curso: z.string().min(1, "Este campo es requerido."),
  profesor: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  departamento: z.string().min(1, "Este campo es requerido."),
  evaluacion: z.string().min(10, "La evaluación debe tener al menos 10 caracteres."),
  retroalimentacion: z.string().min(10, "La retroalimentación debe tener al menos 10 caracteres."),
  puntaje: z.string().min(1, "Este campo es requerido."),
})

// --- Componente Principal ---
export default function Page() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [imagenURL, setImagenURL] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false) // <-- Nuevo estado para el modal
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inicialización de React Hook Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      curso: "",
      profesor: "",
      departamento: "",
      evaluacion: "",
      retroalimentacion: "",
      puntaje: "",
    },
  })

  // Función para subir cualquier archivo (de input o cámara) a Supabase
  const uploadFileToSupabase = async (file: File) => {
    const { data, error } = await supabase.storage.from("imagenes").upload(`evaluaciones/${Date.now()}_${file.name}`, file, {
      cacheControl: '3600',
      upsert: false
    })

    if (error) {
      console.error("Error al subir el archivo:", error)
      alert("Error al subir el archivo.")
      return null
    }

    const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(data.path)
    return urlData.publicUrl
  }

  // Manejador para el input de archivo tradicional
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const url = await uploadFileToSupabase(file)
    if (url) {
      setImagenURL(url)
    }
  }

  // --- Nueva función para manejar la foto capturada por la cámara ---
  const handleCapture = async (photoBlob: Blob | null) => {
    if (photoBlob) {
      const photoFile = new File([photoBlob], `captura-${Date.now()}.jpeg`, { type: "image/jpeg" })
      const url = await uploadFileToSupabase(photoFile)
      if (url) {
        setImagenURL(url)
      }
    }
  }

  // Función que se ejecuta al enviar el formulario
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!imagenURL) {
      alert("Por favor, sube o captura una imagen de evidencia antes de guardar.");
      return;
    }

    setIsSubmitting(true)

    const nuevaEvaluacion = {
      ...values,
      imagen: imagenURL,
      fecha: new Date().toISOString(),
    }

    const { error } = await supabase.from("evaluaciones").insert([nuevaEvaluacion]);

    if (error) {
      alert("Hubo un problema al guardar la evaluación.");
      console.error(error);
    } else {
      alert("Evaluación guardada exitosamente!");
      setEvaluaciones(prev => [...prev, nuevaEvaluacion]);
      form.reset();
      setImagenURL("");
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
    setIsSubmitting(false)
  }

  return (
    <>
      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />

      <main style={{ padding: 20, maxWidth: 800, margin: 'auto', fontFamily: 'Arial' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>Evaluador IA LibelIA</h1>
          <p>Rellena el formulario y adjunta una evidencia para registrar la evaluación.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre del estudiante</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="curso" render={({ field }) => (
                <FormItem><FormLabel>Curso</FormLabel><FormControl><Input placeholder="Ej: 8vo Básico" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="profesor" render={({ field }) => (
                <FormItem><FormLabel>Nombre del profesor</FormLabel><FormControl><Input placeholder="Ej: Ana Contreras" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="departamento" render={({ field }) => (
                <FormItem><FormLabel>Departamento</FormLabel><FormControl><Input placeholder="Ej: Lenguaje" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="evaluacion" render={({ field }) => (
              <FormItem><FormLabel>Texto del estudiante</FormLabel><FormControl><Textarea placeholder="Escribe aquí el texto a evaluar..." {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="retroalimentacion" render={({ field }) => (
              <FormItem><FormLabel>Retroalimentación</FormLabel><FormControl><Textarea placeholder="Escribe aquí la retroalimentación..." {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="puntaje" render={({ field }) => (
              <FormItem><FormLabel>Puntaje</FormLabel><FormControl><Input placeholder="Ej: 25/30" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div>
              <FormLabel>Evidencia</FormLabel>
              <div className="flex items-center gap-4 mt-2">
                <Input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="flex-grow" />
                <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}>
                  <CameraIcon className="mr-2 h-4 w-4" /> Usar Cámara
                </Button>
              </div>
              {imagenURL && <img src={imagenURL} alt="Previsualización de la evidencia" width="200" className="mt-4 rounded-md shadow-md" />}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
              Guardar Evaluación
            </Button>
          </form>
        </Form>

        <div className="mt-12">
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">Historial de Evaluaciones</h2>
          {evaluaciones.length > 0 ? (
            <div className="space-y-4">
              {evaluaciones.map((evalItem, index) => (
                <div key={index} className="border rounded-lg p-4 shadow-sm">
                  <p><strong>Estudiante:</strong> {evalItem.nombre}</p>
                  <p><strong>Curso:</strong> {evalItem.curso}</p>
                  <p><strong>Evaluación:</strong> {evalItem.evaluacion}</p>
                  <img src={evalItem.imagen} alt="Evidencia" width="200" className="mt-2 rounded-md"/>
                </div>
              ))}
            </div>
          ) : (
            <p>Aún no se han guardado evaluaciones.</p>
          )}
        </div>
      </main>
    </>
  )
}